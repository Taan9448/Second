import { openDB, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { cardById, heroIds } from '../content/cards';
import { assertCombat } from '../domain/combat';
import { validateMap } from '../domain/expedition';
import type { DeckEntry, PreparedDecks, GameSave } from '../domain/model';

const nonnegative = z.number().int().min(0).max(1000000);
const cardId = z.string().refine((id) => !!cardById[id], '알 수 없는 카드 ID');
const entry = z.object({ id: z.string().min(1), definitionId: cardId });
const unit = z.object({
  id: z.string(),
  name: z.string(),
  art: nonnegative.max(5),
  hp: nonnegative,
  maxHp: nonnegative.min(1),
  block: nonnegative,
  ink: nonnegative.max(10),
  statuses: z.object({
    strength: nonnegative,
    weak: nonnegative,
    vulnerable: nonnegative,
    burn: nonnegative,
    taunt: nonnegative,
    thorns: nonnegative,
  }),
  powers: z.object({ ward: nonnegative, flow: nonnegative }),
});
const effect = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('damage'),
    amount: nonnegative,
    hits: nonnegative.min(1).optional(),
    all: z.boolean().optional(),
    inkScale: nonnegative.optional(),
  }),
  z.object({
    kind: z.enum(['block', 'heal']),
    amount: nonnegative,
    self: z.boolean().optional(),
    all: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('status'),
    status: z.enum(['strength', 'weak', 'vulnerable', 'burn', 'taunt', 'thorns']),
    amount: nonnegative,
    self: z.boolean().optional(),
  }),
  z.object({ kind: z.enum(['draw', 'energy', 'ink']), amount: nonnegative }),
  z.object({ kind: z.literal('power'), power: z.enum(['ward', 'flow']), amount: nonnegative }),
  z.object({
    kind: z.literal('choice'),
    mode: z.enum(['discard', 'exhaust', 'scry']),
    count: nonnegative,
  }),
  z.object({ kind: z.literal('create'), definitionId: cardId }),
  z.object({ kind: z.literal('interrupt') }),
]);
const combat = z.object({
  id: z.string(),
  revision: nonnegative,
  rng: nonnegative.max(4294967295),
  round: nonnegative.min(1),
  phase: z.enum([
    'playerStart',
    'player',
    'playerEnd',
    'enemyStart',
    'enemyAction',
    'roundEnd',
    'intent',
    'victory',
    'defeat',
  ]),
  party: z.array(unit).min(1).max(3),
  enemies: z.array(unit).min(1).max(5),
  energy: nonnegative,
  cards: z.record(
    z.string(),
    z.object({
      id: z.string(),
      definitionId: cardId,
      temporary: z.boolean(),
      costOverride: nonnegative.optional(),
    }),
  ),
  zones: z.object({
    draw: z.array(z.string()),
    hand: z.array(z.string()).max(10),
    discard: z.array(z.string()),
    exhaust: z.array(z.string()),
    activePowers: z.array(z.string()),
    resolving: z.array(z.string()),
  }),
  intents: z.array(
    z.object({
      enemyId: z.string(),
      kind: z.enum(['attack', 'guard', 'charge']),
      targetId: z.string(),
      damage: nonnegative,
      hits: nonnegative,
      block: nonnegative,
      weak: nonnegative,
      label: z.string(),
    }),
  ),
  enemyCursor: nonnegative,
  serial: nonnegative,
  log: z.array(z.string()).max(150),
  outcomeId: z.string().optional(),
  choice: z
    .object({
      mode: z.enum(['discard', 'exhaust', 'scry']),
      count: nonnegative,
      candidates: z.array(z.string()),
      remaining: z.array(effect),
      cardId: z.string(),
      actorId: z.string(),
      targetId: z.string(),
    })
    .optional(),
});
// RNG is an unsigned 32-bit value, not a gameplay counter.
const uint32 = z.number().int().min(0).max(4294967295);
const schema = z.object({
  version: z.literal(1),
  rulesVersion: z.literal('prototype-1'),
  slot: z.number().int().min(1).max(3),
  revision: nonnegative,
  mode: z.literal('normal'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  screen: z.enum(['lobby', 'story', 'map', 'battle', 'room', 'reward', 'ending', 'defeat']),
  prepared: z.object({
    brush: z.array(entry).length(10),
    mage: z.array(entry).length(10),
    knight: z.array(entry).length(10),
    common: z.array(entry).length(20),
  }),
  collection: z.array(cardId),
  storyIndex: nonnegative.max(2),
  cleared: z.boolean(),
  journal: z.array(z.string()),
  stats: z.object({ battles: nonnegative, cards: z.record(cardId, nonnegative) }),
  battle: combat.extend({ rng: uint32 }).optional(),
  expedition: z
    .object({
      id: z.string(),
      seed: uint32,
      nodes: z.array(
        z.object({
          id: z.string(),
          column: nonnegative,
          lane: nonnegative,
          kind: z.enum(['battle', 'event', 'rest', 'boss']),
          name: z.string(),
          description: z.string(),
          next: z.array(z.string()),
          completed: z.boolean(),
        }),
      ),
      current: z.string().nullable(),
      deck: z.array(entry),
      hp: nonnegative.max(80),
      choices: z.array(z.string()),
      visited: z.array(z.string()),
      rewardClaimed: z.array(z.string()),
      reward: z.array(cardId).optional(),
    })
    .optional(),
});
export function validateSave(input: unknown): GameSave {
  const save = schema.parse(input) as GameSave;
  for (const [owner, deck] of Object.entries(save.prepared) as [
    keyof PreparedDecks,
    DeckEntry[],
  ][]) {
    if (deck.some((c) => cardById[c.definitionId].owner !== owner))
      throw new Error('준비 덱의 소유자가 맞지 않습니다.');
    if (new Set(deck.map((c) => c.id)).size !== deck.length)
      throw new Error('준비 덱 ID가 중복되었습니다.');
  }
  if (save.battle) {
    assertCombat(save.battle);
    if (save.battle.party.some((unit) => !heroIds.some((id) => id === unit.id)))
      throw new Error('알 수 없는 편성 캐릭터 ID입니다.');
    if (save.battle.enemyCursor > save.battle.enemies.length)
      throw new Error('적 행동 순서가 잘못되었습니다.');
    const unitIds = new Set([...save.battle.party, ...save.battle.enemies].map((unit) => unit.id));
    if (
      save.battle.intents.some(
        (intent) =>
          !save.battle!.enemies.some((enemy) => enemy.id === intent.enemyId) ||
          !unitIds.has(intent.targetId),
      )
    )
      throw new Error('행동 예고가 잘못된 전투원을 참조합니다.');
    if (Object.entries(save.battle.cards).some(([id, c]) => id !== c.id))
      throw new Error('인스턴스 ID 오류');
    if (
      new Set([...save.battle.party, ...save.battle.enemies].map((u) => u.id)).size !==
      save.battle.party.length + save.battle.enemies.length
    )
      throw new Error('전투원 ID 중복');
    const choice = save.battle.choice;
    if (
      choice &&
      (choice.candidates.some((id) => !save.battle!.cards[id]) ||
        !save.battle.zones.resolving.includes(choice.cardId))
    )
      throw new Error('카드 선택 저장 오류');
    if (['victory', 'defeat'].includes(save.battle.phase) !== !!save.battle.outcomeId)
      throw new Error('전투 종료 저장 오류');
  }
  if (save.expedition) validateMap(save.expedition);
  if (save.screen === 'battle' && !save.battle) throw new Error('전투 저장이 누락되었습니다.');
  if (
    ['map', 'room', 'reward', 'story', 'ending', 'defeat'].includes(save.screen) &&
    !save.expedition
  )
    throw new Error('원정 저장이 누락되었습니다.');
  if (save.screen === 'reward' && !save.expedition?.reward)
    throw new Error('보상 저장이 누락되었습니다.');
  return save;
}
export function parseSave(text: string): GameSave {
  return validateSave(JSON.parse(text));
}
export function saveKey(slot: number, practice = false): string {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new Error('잘못된 저장 슬롯입니다.');
  return practice ? 'debug:practice' : `campaign:${slot}`;
}
let database: Promise<IDBPDatabase> | undefined;
function db(): Promise<IDBPDatabase> {
  return (database ??= openDB('cheonoe-geomgyeol', 1, {
    upgrade(db) {
      db.createObjectStore('saves');
      db.createObjectStore('backup');
      db.createObjectStore('profile');
    },
  }));
}
export async function loadSave(slot: number, practice = false): Promise<GameSave | null> {
  const key = saveKey(slot, practice),
    value = await (await db()).get('saves', key);
  return value === undefined ? null : validateSave(value);
}
// Compare and write in one IndexedDB transaction, including the prior good backup.
export async function commitSave(
  save: GameSave,
  expected: number | null,
  practice = false,
): Promise<void> {
  const validated = validateSave(save),
    key = saveKey(save.slot, practice),
    connection = await db();
  const tx = connection.transaction(['saves', 'backup'], 'readwrite');
  const store = tx.objectStore('saves');
  const current = await store.get(key);
  if (
    expected === null
      ? current !== undefined
      : current === undefined || current.revision !== expected
  ) {
    tx.abort();
    try {
      await tx.done;
    } catch {
      /* deliberate abort */
    }
    throw new Error('다른 탭에서 저장이 변경되었습니다. 타이틀에서 다시 불러와 주세요.');
  }
  if (current !== undefined) {
    validateSave(current);
    await tx.objectStore('backup').put(current, key);
  }
  await store.put(validated, key);
  await tx.done;
}
export async function replaceSave(save: GameSave, expected: number | null): Promise<void> {
  await commitSave(save, expected);
}
export async function readSettings(): Promise<{ volume: number; motion: boolean }> {
  return (await (await db()).get('profile', 'settings')) ?? { volume: 0.35, motion: true };
}
export async function writeSettings(value: { volume: number; motion: boolean }): Promise<void> {
  const valid = z.object({ volume: z.number().min(0).max(1), motion: z.boolean() }).parse(value);
  await (await db()).put('profile', valid, 'settings');
}
