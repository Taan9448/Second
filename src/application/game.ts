import { cards, cardById, initialDecks } from '../content/cards';
import { createCombat, heroUnit, enemyUnit } from '../domain/combat';
import { createExpedition, reachable } from '../domain/expedition';
import type { DeckEntry, PreparedDecks, GameSave } from '../domain/model';
import { shuffled } from '../domain/rng';

export function newGame(slot: number): GameSave {
  const now = new Date().toISOString();
  return {
    version: 1,
    rulesVersion: 'prototype-1',
    slot,
    revision: 0,
    mode: 'normal',
    createdAt: now,
    updatedAt: now,
    screen: 'lobby',
    prepared: initialDecks(),
    collection: cards.map((c) => c.id),
    storyIndex: 0,
    cleared: false,
    journal: [],
    stats: { battles: 0, cards: {} },
  };
}
export function practiceGame(seed: number): GameSave {
  const s = newGame(1);
  const deck = [
    ...s.prepared.brush,
    ...s.prepared.mage,
    ...s.prepared.knight,
    ...s.prepared.common,
  ];
  s.battle = createCombat(
    `practice-${seed}`,
    ['brush', 'mage', 'knight'].map((id) => heroUnit(id as 'brush' | 'mage' | 'knight')),
    [
      enemyUnit('wolf', 'wolf', 2),
      enemyUnit('soldier', 'soldier', 2),
      enemyUnit('guardian', 'boss'),
    ],
    deck,
    seed,
  );
  s.screen = 'battle';
  return s;
}
export type GameCommand =
  | { type: 'start'; seed: number }
  | { type: 'storyNext' }
  | { type: 'room'; id: string }
  | { type: 'resolveEvent'; choice: 'rescue' | 'leave' }
  | { type: 'rest'; choice: 'heal' | 'listen' }
  | { type: 'battleFinish' }
  | { type: 'reward'; id: string | null }
  | { type: 'returnLobby' }
  | { type: 'replaceCard'; entryId: string; definitionId: string };
export function gameCommand(current: GameSave, command: GameCommand): GameSave {
  const s = structuredClone(current);
  const e = s.expedition;
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const node = e?.nodes.find((n) => n.id === e.current);
  switch (command.type) {
    case 'start':
      if (s.screen !== 'lobby' || s.expedition) fail('현재 원정을 먼저 마쳐 주세요.');
      s.expedition = createExpedition(command.seed, [...s.prepared.brush, ...s.prepared.common]);
      s.screen = 'story';
      s.storyIndex = 0;
      break;
    case 'storyNext':
      if (s.screen === 'story') {
        if (s.storyIndex < 2) s.storyIndex++;
        else {
          s.screen = 'map';
          s.storyIndex = 0;
        }
      } else if (s.screen === 'ending') {
        if (s.storyIndex < 2) s.storyIndex++;
        else {
          s.screen = 'lobby';
          delete s.expedition;
          delete s.battle;
          s.storyIndex = 0;
        }
      } else fail('진행 중인 이야기가 없습니다.');
      break;
    case 'room': {
      if (s.screen !== 'map' || !e || !reachable(e).includes(command.id))
        fail('연결된 다음 방만 선택할 수 있습니다.');
      const next = e!.nodes.find((n) => n.id === command.id)!;
      if (next.completed) fail('이미 완료한 방입니다.');
      e!.current = next.id;
      e!.visited.push(next.id);
      if (next.kind === 'battle' || next.kind === 'boss') {
        const enemies =
          next.kind === 'boss'
            ? [enemyUnit('executor', 'boss')]
            : next.id === 'gate'
              ? [enemyUnit('tracker', 'soldier')]
              : next.id === 'cross'
                ? [enemyUnit('tracker', 'soldier'), enemyUnit('wolf', 'wolf')]
                : [enemyUnit('wolf', 'wolf'), enemyUnit('wolf2', 'wolf')];
        s.battle = createCombat(
          `${e!.id}:${next.id}`,
          [heroUnit('brush', e!.hp)],
          enemies,
          e!.deck,
          e!.seed + e!.visited.length * 101,
        );
        s.screen = 'battle';
      } else s.screen = 'room';
      break;
    }
    case 'resolveEvent':
      if (s.screen !== 'room' || !node || node.kind !== 'event' || node.completed)
        fail('이미 해결된 사건입니다.');
      node!.completed = true;
      e!.choices.push(command.choice);
      s.journal.push(
        command.choice === 'rescue'
          ? '추격을 피해 서고의 시종을 구했다. 그녀는 훗날 증언할 것이다.'
          : '시종을 남겨 두고 증거 꾸러미를 챙겼다. 돌아와야 할 이유가 늘었다.',
      );
      if (command.choice === 'rescue') e!.hp = Math.min(80, e!.hp + 8);
      else e!.deck.push({ id: `${e!.id}:event`, definitionId: 'b_mark' });
      s.screen = 'map';
      break;
    case 'rest':
      if (s.screen !== 'room' || node?.kind !== 'rest' || node.completed)
        fail('야영을 이용할 수 없습니다.');
      node!.completed = true;
      if (command.choice === 'heal') e!.hp = Math.min(80, e!.hp + 24);
      else {
        e!.deck.push({ id: `${e!.id}:camp`, definitionId: 'b_dragon' });
        s.journal.push(
          '계문필에 새겨진 글자: “문은 새로 만들어지는 것이 아니다. 잊힌 경계를 따라 열린다.”',
        );
      }
      s.screen = 'map';
      break;
    case 'battleFinish': {
      if (
        s.screen !== 'battle' ||
        !s.battle ||
        !s.battle.outcomeId ||
        !e ||
        !node ||
        node.completed
      )
        fail('전투 결과를 받을 수 없습니다.');
      s.stats.battles++;
      e!.hp = s.battle!.party[0].hp;
      if (s.battle!.phase === 'defeat') {
        s.screen = 'defeat';
        break;
      }
      node!.completed = true;
      if (node!.kind === 'boss') {
        s.cleared = true;
        s.screen = 'ending';
        s.storyIndex = 0;
        for (const entry of e!.deck)
          if (!s.collection.includes(entry.definitionId)) s.collection.push(entry.definitionId);
        s.journal.push('청연문의 추격을 벗어나 계문필로 이세계의 문을 열었다.');
      } else {
        const pool = cards.filter((c) => c.owner === 'brush' || c.owner === 'common');
        const [options, rng] = shuffled(pool, e!.seed);
        e!.seed = rng;
        e!.reward = options.slice(0, 3).map((c) => c.id);
        s.screen = 'reward';
      }
      break;
    }
    case 'reward':
      if (s.screen !== 'reward' || !e?.reward || e.rewardClaimed.includes(e.current!))
        fail('이미 받은 보상입니다.');
      if (command.id && !e!.reward!.includes(command.id)) fail('선택지에 없는 카드입니다.');
      if (command.id)
        e!.deck.push({ id: `${e!.id}:reward:${e!.current}`, definitionId: command.id });
      e!.rewardClaimed.push(e!.current!);
      delete e!.reward;
      delete s.battle;
      s.screen = 'map';
      break;
    case 'returnLobby':
      if (s.screen !== 'defeat') fail('패배 결과 화면에서만 복귀할 수 있습니다.');
      delete s.battle;
      delete s.expedition;
      s.screen = 'lobby';
      break;
    case 'replaceCard': {
      if (s.screen !== 'lobby' || s.expedition) fail('로비에서만 준비 덱을 바꿀 수 있습니다.');
      const definition = cardById[command.definitionId];
      if (!definition || !s.collection.includes(definition.id)) fail('보유하지 않은 카드입니다.');
      const entries = (Object.entries(s.prepared) as [keyof PreparedDecks, DeckEntry[]][]).find(
        ([, deck]) => deck.some((c) => c.id === command.entryId),
      );
      if (!entries || definition.owner !== entries[0]) fail('해당 직업 카드만 편성할 수 있습니다.');
      const entry = entries![1].find((c) => c.id === command.entryId)!;
      entry.definitionId = definition.id;
      break;
    }
  }
  s.revision++;
  s.updatedAt = new Date().toISOString();
  return s;
}
