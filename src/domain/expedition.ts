import type { DeckEntry, Expedition, MapNode } from './model';
import { nextRandom } from './rng';

// Two replaceable route modules between fixed entrance and pre-boss camp.
export function createExpedition(seed: number, deck: DeckEntry[]): Expedition {
  const [rng, variant] = nextRandom(seed);
  const shortcut = variant < 0.5;
  const nodes: MapNode[] = [
    {
      id: 'gate',
      column: 0,
      lane: 1,
      kind: 'battle',
      name: '뒤뜰의 추격자',
      description: '종소리를 듣고 달려온 추격대. 첫 길을 열어야 한다.',
      next: ['upper', 'lower'],
      completed: false,
    },
    {
      id: 'upper',
      column: 1,
      lane: 0,
      kind: shortcut ? 'event' : 'battle',
      name: shortcut ? '불 꺼진 서고' : '대숲의 매복',
      description: shortcut
        ? '다급한 발소리 사이, 서고 안에서 누군가 문을 두드린다.'
        : '대숲 뒤에 추격자가 매복했다. 들키기 전에 돌파한다.',
      next: ['cross'],
      completed: false,
    },
    {
      id: 'lower',
      column: 1,
      lane: 2,
      kind: shortcut ? 'battle' : 'event',
      name: shortcut ? '산길의 묵영' : '마구간의 소녀',
      description: shortcut
        ? '버려진 먹에 잠식된 짐승이 길을 막는다.'
        : '어린 시종이 숨겨 둔 말과 작은 꾸러미. 함께 도망칠까?',
      next: ['cross'],
      completed: false,
    },
    {
      id: 'cross',
      column: 2,
      lane: 1,
      kind: 'battle',
      name: '끊어진 다리',
      description: '문파의 칼이 퇴로를 끊었다. 돌아갈 수 없다.',
      next: ['camp'],
      completed: false,
    },
    {
      id: 'camp',
      column: 3,
      lane: 1,
      kind: 'rest',
      name: '옛 비석 아래',
      description: '숨을 고르는 동안, 붓이 오래된 비석을 향해 떨린다.',
      next: ['boss'],
      completed: false,
    },
    {
      id: 'boss',
      column: 4,
      lane: 1,
      kind: 'boss',
      name: '청연문 집행관',
      description: '“장문께서 네 이름을 지우라 하셨다.” 마지막 추격자가 검을 뽑는다.',
      next: [],
      completed: false,
    },
  ];
  return {
    id: `run-${seed.toString(16)}`,
    seed: rng,
    nodes,
    current: null,
    deck: structuredClone(deck),
    hp: 80,
    choices: [],
    visited: [],
    rewardClaimed: [],
  };
}
export function reachable(e: Expedition): string[] {
  if (e.current === null) return ['gate'];
  const node = e.nodes.find((n) => n.id === e.current);
  return node?.completed ? node.next : [];
}
export function validateMap(e: Expedition): void {
  const ids = new Set(e.nodes.map((n) => n.id));
  if (ids.size !== e.nodes.length) throw new Error('지도 ID 중복');
  if (e.nodes.some((n) => n.next.some((id) => !ids.has(id)))) throw new Error('끊어진 지도 연결');
  if (e.current !== null && !ids.has(e.current)) throw new Error('잘못된 현재 방');
  const visited = new Set<string>();
  const walk = (id: string, path: Set<string>) => {
    if (path.has(id)) throw new Error('지도 순환');
    visited.add(id);
    for (const next of e.nodes.find((n) => n.id === id)!.next) walk(next, new Set([...path, id]));
  };
  walk('gate', new Set());
  if (visited.size !== ids.size || !visited.has('boss')) throw new Error('도달할 수 없는 방');
}
