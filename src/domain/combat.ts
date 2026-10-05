import { cardById, heroes } from '../content/cards';
import {
  emptyStatuses,
  type BattleEvent,
  type Combat,
  type DeckEntry,
  type Effect,
  type HeroId,
  type Intent,
  type Unit,
  type Zone,
} from './model';
import { shuffled } from './rng';

export type CombatCommand =
  | { type: 'play'; cardId: string; actorId: string; targetId?: string; revision: number }
  | { type: 'end'; revision: number }
  | { type: 'advance'; revision: number }
  | { type: 'choose'; ids: string[]; revision: number };
export type CombatResult =
  { ok: true; state: Combat; events: BattleEvent[] } | { ok: false; reason: string };
export function heroUnit(id: HeroId, hp?: number): Unit {
  const h = heroes[id];
  return {
    id,
    name: h.name,
    art: h.art,
    maxHp: h.maxHp,
    hp: hp ?? h.maxHp,
    block: 0,
    statuses: emptyStatuses(),
    ink: 0,
    powers: { ward: 0, flow: 0 },
  };
}
export function enemyUnit(id: string, type: 'wolf' | 'soldier' | 'boss', scale = 1): Unit {
  const base = {
    wolf: { name: '묵영 늑대', hp: 26, art: 3 },
    soldier: { name: '추격대원', hp: 32, art: 4 },
    boss: { name: '청연문 집행관', hp: 76, art: 5 },
  }[type];
  return {
    id,
    name: base.name,
    art: base.art,
    hp: Math.round(base.hp * scale),
    maxHp: Math.round(base.hp * scale),
    block: 0,
    statuses: emptyStatuses(),
    ink: 0,
    powers: { ward: 0, flow: 0 },
  };
}
export function createCombat(
  id: string,
  party: Unit[],
  enemies: Unit[],
  deck: DeckEntry[],
  seed: number,
): Combat {
  if (!party.length || party.length > 3 || !enemies.length || enemies.length > 5)
    throw new Error('편성 범위를 벗어났습니다.');
  if (deck.some((c) => !cardById[c.definitionId])) throw new Error('알 수 없는 카드');
  const c: Combat = {
    id,
    revision: 0,
    rng: seed,
    round: 1,
    phase: 'playerStart',
    party: structuredClone(party),
    enemies: structuredClone(enemies),
    energy: 0,
    cards: {},
    zones: { draw: [], hand: [], discard: [], exhaust: [], activePowers: [], resolving: [] },
    intents: [],
    enemyCursor: 0,
    serial: 0,
    log: ['전투가 시작되었습니다.'],
  };
  deck.forEach((entry, i) => {
    const instanceId = `${id}:card:${i}`;
    c.cards[instanceId] = { id: instanceId, definitionId: entry.definitionId, temporary: false };
    c.zones.draw.push(instanceId);
  });
  [c.zones.draw, c.rng] = shuffled(c.zones.draw, c.rng);
  c.zones.draw.sort(
    (a, b) =>
      Number(cardById[c.cards[b].definitionId].keywords.includes('innate')) -
      Number(cardById[c.cards[a].definitionId].keywords.includes('innate')),
  );
  refreshIntents(c);
  return c;
}
export function drawCards(c: Combat, count: number): void {
  for (let i = 0; i < count; i++) {
    if (!c.zones.draw.length) {
      if (!c.zones.discard.length) break;
      [c.zones.draw, c.rng] = shuffled(c.zones.discard, c.rng);
      c.zones.discard = [];
    }
    const id = c.zones.draw.shift()!;
    c.zones[c.zones.hand.length < 10 ? 'hand' : 'discard'].push(id);
  }
}
export function attackDamage(
  base: number,
  source: Unit,
  target: Unit,
  critical = 1,
): { total: number; absorbed: number; hp: number } {
  const total = Math.max(
    0,
    Math.floor(
      (base + source.statuses.strength) *
        (source.statuses.weak > 0 ? 0.75 : 1) *
        (target.statuses.vulnerable > 0 ? 1.5 : 1) *
        critical,
    ),
  );
  const absorbed = Math.min(total, target.block);
  return { total, absorbed, hp: Math.min(target.hp, total - absorbed) };
}
function log(c: Combat, text: string): void {
  c.log.push(text);
  if (c.log.length > 150) c.log.shift();
}
function damage(
  c: Combat,
  source: Unit,
  target: Unit,
  base: number,
  events: BattleEvent[],
  raw = false,
): void {
  if (target.hp <= 0 || base < 0) return;
  const result = raw
    ? { total: base, absorbed: 0, hp: Math.min(target.hp, base) }
    : attackDamage(base, source, target);
  target.block -= result.absorbed;
  target.hp -= result.hp;
  events.push({
    kind: 'damage',
    sourceId: source.id,
    targetId: target.id,
    amount: result.total,
    hpAfter: target.hp,
    blockAfter: target.block,
  });
  log(
    c,
    `${source.name} → ${target.name}: ${result.total} 피해${result.absorbed ? ` (보호막 ${result.absorbed})` : ''}`,
  );
  if (!raw && target.statuses.thorns > 0 && source.hp > 0) {
    const reflected = Math.min(source.hp, target.statuses.thorns);
    source.hp -= reflected;
    events.push({
      kind: 'damage',
      sourceId: target.id,
      targetId: source.id,
      amount: reflected,
      hpAfter: source.hp,
      blockAfter: source.block,
    });
    log(c, `${target.name}의 반격: ${reflected} 피해`);
  }
  if (target.hp === 0) log(c, `${target.name} 쓰러짐`);
}
function checkOutcome(c: Combat, events: BattleEvent[]): boolean {
  if (c.outcomeId) return true;
  const partyAlive = c.party.some((u) => u.hp > 0),
    enemyAlive = c.enemies.some((u) => u.hp > 0);
  if (partyAlive && enemyAlive) return false;
  c.phase = partyAlive ? 'victory' : 'defeat';
  c.outcomeId = `${c.id}:outcome`;
  log(c, c.phase === 'victory' ? '적 전멸. 승리했습니다.' : '파티 전원 쓰러짐. 패배했습니다.');
  events.push({ kind: 'outcome', sourceId: '', targetId: '' });
  return true;
}
function intendedTarget(c: Combat, previous?: string): string {
  return (
    c.party.find((u) => u.hp > 0 && u.statuses.taunt > 0)?.id ??
    c.party.find((u) => u.id === previous && u.hp > 0)?.id ??
    c.party.find((u) => u.hp > 0)?.id ??
    ''
  );
}
export function refreshTargets(c: Combat): void {
  for (const intent of c.intents) intent.targetId = intendedTarget(c, intent.targetId);
}
export function refreshIntents(c: Combat): void {
  const living = c.party.filter((u) => u.hp > 0);
  c.intents = c.enemies
    .filter((e) => e.hp > 0)
    .map((e, i): Intent => {
      const target = intendedTarget(c, living[(c.round + i - 1) % Math.max(1, living.length)]?.id);
      if (e.art === 5) {
        if (c.round % 3 === 1)
          return {
            enemyId: e.id,
            kind: 'charge',
            targetId: target,
            damage: e.hp <= e.maxHp / 2 ? 14 : 11,
            hits: 2,
            block: 0,
            weak: 0,
            label: '축기 · 다음 턴 강타',
          };
        const charged = c.intents.find(
          (intent) => intent.enemyId === e.id && intent.kind === 'charge',
        );
        if (charged) return { ...charged, kind: 'attack', targetId: target, label: '축기 강타' };
        return {
          enemyId: e.id,
          kind: 'attack',
          targetId: target,
          damage: e.hp <= e.maxHp / 2 ? 12 : 9,
          hits: 2,
          block: 0,
          weak: 0,
          label: e.hp <= e.maxHp / 2 ? '광폭 · 쌍격' : '쌍격',
        };
      }
      if (e.art === 4 && c.round % 3 === 0)
        return {
          enemyId: e.id,
          kind: 'guard',
          targetId: e.id,
          damage: 0,
          hits: 0,
          block: 9,
          weak: 0,
          label: '경계',
        };
      return {
        enemyId: e.id,
        kind: 'attack',
        targetId: target,
        damage: e.art === 3 ? 6 : 8,
        hits: 1,
        block: 0,
        weak: e.art === 4 && c.round % 2 === 0 ? 1 : 0,
        label: '공격',
      };
    });
}
export function playReason(
  c: Combat,
  cardId: string,
  actorId: string,
  targetId?: string,
): string | null {
  if (c.phase !== 'player') return '지금은 플레이어의 행동 시간이 아닙니다.';
  if (c.choice) return '카드 선택을 먼저 마쳐 주세요.';
  const instance = c.cards[cardId];
  if (!instance || !c.zones.hand.includes(cardId)) return '손패에 없는 카드입니다.';
  const d = cardById[instance.definitionId];
  const actor = c.party.find((u) => u.id === actorId);
  if (!actor || actor.hp <= 0) return '쓰러진 캐릭터는 행동할 수 없습니다.';
  if (d.owner !== 'common' && d.owner !== 'combo' && d.owner !== actorId)
    return '이 카드의 소유자를 선택해 주세요.';
  if (c.energy < (instance.costOverride ?? d.cost)) return '에너지가 부족합니다.';
  if (d.target === 'enemy' && !c.enemies.some((u) => u.id === targetId && u.hp > 0))
    return '살아 있는 적을 선택해 주세요.';
  if (d.target === 'ally' && !c.party.some((u) => u.id === targetId && u.hp > 0))
    return '살아 있는 아군을 선택해 주세요.';
  if (d.target === 'self' && targetId && targetId !== actorId)
    return '시전자 자신에게 사용하는 카드입니다.';
  return null;
}
function finishCard(c: Combat, id: string): void {
  const instance = c.cards[id],
    d = cardById[instance.definitionId];
  c.zones.resolving = c.zones.resolving.filter((x) => x !== id);
  c.zones[
    d.type === '지속'
      ? 'activePowers'
      : d.keywords.includes('exhaust') || instance.temporary
        ? 'exhaust'
        : 'discard'
  ].push(id);
}
function effects(
  c: Combat,
  list: Effect[],
  actor: Unit,
  target: Unit | undefined,
  cardId: string,
  events: BattleEvent[],
): void {
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    switch (e.kind) {
      case 'damage': {
        const targets = e.all ? c.enemies.filter((u) => u.hp > 0) : target ? [target] : [];
        for (const t of targets)
          for (let hit = 0; hit < (e.hits ?? 1); hit++) {
            if (actor.hp <= 0 || t.hp <= 0) break;
            damage(c, actor, t, e.amount + actor.ink * (e.inkScale ?? 0), events);
          }
        break;
      }
      case 'block':
      case 'heal': {
        const targets = e.all
          ? c.party.filter((u) => u.hp > 0)
          : e.self
            ? [actor]
            : target
              ? [target]
              : [actor];
        for (const t of targets) {
          if (t.hp <= 0) continue;
          const amount = e.kind === 'heal' ? Math.min(e.amount, t.maxHp - t.hp) : e.amount;
          if (e.kind === 'heal') t.hp += amount;
          else t.block += amount;
          events.push({
            kind: e.kind,
            sourceId: actor.id,
            targetId: t.id,
            amount,
            hpAfter: t.hp,
            blockAfter: t.block,
          });
          log(c, `${t.name}: ${e.kind === 'heal' ? '회복' : '보호막'} ${amount}`);
        }
        break;
      }
      case 'status': {
        const t = e.self ? actor : target;
        if (t && t.hp > 0) {
          t.statuses[e.status] += e.amount;
          log(c, `${t.name}: ${statusNames[e.status]} ${e.amount}`);
        }
        break;
      }
      case 'draw':
        drawCards(c, e.amount);
        break;
      case 'energy':
        c.energy += e.amount;
        break;
      case 'ink':
        actor.ink = Math.min(10, actor.ink + e.amount);
        break;
      case 'power':
        actor.powers[e.power] += e.amount;
        break;
      case 'create': {
        const id = `${c.id}:temp:${++c.serial}`;
        if (!cardById[e.definitionId]) throw new Error('미정의 생성 카드');
        c.cards[id] = { id, definitionId: e.definitionId, temporary: true };
        c.zones[c.zones.hand.length < 10 ? 'hand' : 'discard'].push(id);
        break;
      }
      case 'interrupt': {
        const intent = c.intents.find((a) => a.enemyId === target?.id);
        if (intent?.kind === 'charge') {
          intent.kind = 'guard';
          intent.block = 0;
          intent.damage = 0;
          intent.hits = 0;
          intent.label = '차지 취소';
          log(c, `${target!.name}의 축기를 끊었습니다.`);
        }
        break;
      }
      case 'choice': {
        const candidates = e.mode === 'scry' ? c.zones.draw.slice(0, e.count) : [...c.zones.hand];
        if (candidates.length) {
          c.choice = {
            mode: e.mode,
            count: e.mode === 'scry' ? candidates.length : Math.min(e.count, candidates.length),
            candidates,
            remaining: list.slice(i + 1),
            cardId,
            actorId: actor.id,
            targetId: target?.id ?? actor.id,
          };
          return;
        }
        break;
      }
    }
  }
  finishCard(c, cardId);
  refreshTargets(c);
  checkOutcome(c, events);
}
function autoAdvance(c: Combat, events: BattleEvent[]): void {
  switch (c.phase) {
    case 'playerStart':
      c.energy = 3;
      for (const u of c.party) u.block = 0;
      for (const u of c.party)
        if (u.hp > 0) {
          u.ink = Math.min(10, u.ink + u.powers.flow);
          if (u.powers.ward)
            for (const ally of c.party.filter((a) => a.hp > 0)) ally.block += u.powers.ward;
        }
      drawCards(c, 5);
      c.phase = 'player';
      log(c, `라운드 ${c.round} · 플레이어 턴`);
      break;
    case 'playerEnd':
      for (const id of [...c.zones.hand]) {
        const d = cardById[c.cards[id].definitionId];
        if (!d.keywords.includes('retain')) {
          c.zones.hand = c.zones.hand.filter((x) => x !== id);
          c.zones[c.cards[id].temporary ? 'exhaust' : 'discard'].push(id);
        }
      }
      for (const u of c.party)
        if (u.hp > 0 && u.statuses.burn > 0) {
          damage(c, u, u, u.statuses.burn, events, true);
          u.statuses.burn = Math.max(0, u.statuses.burn - 1);
        }
      if (!checkOutcome(c, events)) c.phase = 'enemyStart';
      break;
    case 'enemyStart':
      for (const e of c.enemies) e.block = 0;
      c.enemyCursor = 0;
      c.phase = 'enemyAction';
      break;
    case 'enemyAction': {
      const enemy = c.enemies[c.enemyCursor++];
      if (enemy?.hp) {
        const intent = c.intents.find((a) => a.enemyId === enemy.id);
        if (intent) {
          intent.targetId = intendedTarget(c, intent.targetId);
          const target = c.party.find((u) => u.id === intent.targetId);
          events.push({ kind: 'enemy', sourceId: enemy.id, targetId: intent.targetId });
          if (intent.kind === 'guard') {
            enemy.block += intent.block;
            log(c, `${enemy.name}: 보호막 ${intent.block}`);
          } else if (intent.kind === 'charge') {
            log(c, `${enemy.name}: 축기를 준비합니다.`);
            enemy.block += 4;
          } else if (target) {
            for (let hit = 0; hit < intent.hits; hit++) {
              if (enemy.hp <= 0 || target.hp <= 0) break;
              damage(c, enemy, target, intent.damage, events);
            }
            if (target.hp > 0) target.statuses.weak += intent.weak;
          }
        }
      }
      if (!checkOutcome(c, events) && c.enemyCursor >= c.enemies.length) c.phase = 'roundEnd';
      break;
    }
    case 'roundEnd':
      for (const e of c.enemies)
        if (e.hp > 0 && e.statuses.burn > 0) {
          damage(c, e, e, e.statuses.burn, events, true);
          e.statuses.burn = Math.max(0, e.statuses.burn - 1);
        }
      for (const u of [...c.party, ...c.enemies])
        for (const key of ['weak', 'vulnerable', 'taunt', 'thorns'] as const)
          u.statuses[key] = Math.max(0, u.statuses[key] - 1);
      if (!checkOutcome(c, events)) {
        c.round++;
        c.phase = 'intent';
      }
      break;
    case 'intent':
      refreshIntents(c);
      c.phase = 'playerStart';
      break;
    default:
      throw new Error('자동 진행할 수 없는 단계');
  }
}
export function combatCommand(current: Combat, command: CombatCommand): CombatResult {
  if (command.revision !== current.revision)
    return { ok: false, reason: '오래된 입력입니다. 화면을 확인해 주세요.' };
  if (current.outcomeId) return { ok: false, reason: '이미 종료된 전투입니다.' };
  const c = structuredClone(current),
    events: BattleEvent[] = [];
  if (command.type === 'play') {
    const reason = playReason(c, command.cardId, command.actorId, command.targetId);
    if (reason) return { ok: false, reason };
    const d = cardById[c.cards[command.cardId].definitionId],
      actor = c.party.find((u) => u.id === command.actorId)!;
    c.energy -= c.cards[command.cardId].costOverride ?? d.cost;
    c.zones.hand = c.zones.hand.filter((id) => id !== command.cardId);
    c.zones.resolving.push(command.cardId);
    events.push({
      kind: 'card',
      sourceId: actor.id,
      targetId: command.targetId ?? actor.id,
      art: d.art,
    });
    log(c, `${actor.name}: ${d.name} 사용`);
    const target = [...c.party, ...c.enemies].find((u) => u.id === (command.targetId ?? actor.id));
    effects(c, d.effects, actor, target, command.cardId, events);
  } else if (command.type === 'choose') {
    const choice = c.choice;
    if (!choice) return { ok: false, reason: '선택 중인 효과가 없습니다.' };
    if (
      new Set(command.ids).size !== command.ids.length ||
      command.ids.some((id) => !choice.candidates.includes(id))
    )
      return { ok: false, reason: '잘못된 카드 선택입니다.' };
    if (choice.mode !== 'scry' && command.ids.length !== choice.count)
      return { ok: false, reason: `${choice.count}장을 선택해 주세요.` };
    const from: Zone = choice.mode === 'scry' ? 'draw' : 'hand',
      to: Zone = choice.mode === 'exhaust' ? 'exhaust' : 'discard';
    c.zones[from] = c.zones[from].filter((id) => !command.ids.includes(id));
    c.zones[to].push(...command.ids);
    delete c.choice;
    effects(
      c,
      choice.remaining,
      c.party.find((u) => u.id === choice.actorId)!,
      [...c.party, ...c.enemies].find((u) => u.id === choice.targetId),
      choice.cardId,
      events,
    );
  } else if (command.type === 'end') {
    if (c.phase !== 'player' || c.choice)
      return { ok: false, reason: '현재 턴을 종료할 수 없습니다.' };
    c.phase = 'playerEnd';
  } else {
    if (c.phase === 'player' || c.choice)
      return { ok: false, reason: '플레이어 입력을 기다리고 있습니다.' };
    autoAdvance(c, events);
  }
  c.revision++;
  assertCombat(c);
  return { ok: true, state: c, events };
}
export function assertCombat(c: Combat): void {
  const ids = Object.values(c.zones).flat();
  if (
    ids.length !== Object.keys(c.cards).length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !c.cards[id])
  )
    throw new Error('카드 구역 무결성 오류');
  if (c.zones.hand.length > 10 || c.enemies.length > 5 || c.energy < 0)
    throw new Error('전투 범위 오류');
  for (const u of [...c.party, ...c.enemies])
    if (u.hp < 0 || u.hp > u.maxHp || u.block < 0) throw new Error('전투원 수치 오류');
}
export const statusNames = {
  strength: '힘',
  weak: '약화',
  vulnerable: '취약',
  burn: '화상',
  taunt: '도발',
  thorns: '반격',
};
export function previewCard(
  c: Combat,
  cardId: string,
  actorId: string,
  targetId: string,
): { damage: number; hp: number; block: number } | null {
  const result = combatCommand(c, {
    type: 'play',
    cardId,
    actorId,
    targetId,
    revision: c.revision,
  });
  if (!result.ok) return null;
  const target = c.enemies.find((u) => u.id === targetId);
  if (!target) return null;
  const after = result.state.enemies.find((u) => u.id === targetId)!;
  return {
    damage: result.events
      .filter((e) => e.kind === 'damage' && e.targetId === targetId)
      .reduce((n, e) => n + (e.amount ?? 0), 0),
    hp: target.hp - after.hp,
    block: target.block - after.block,
  };
}
