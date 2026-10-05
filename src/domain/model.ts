export type HeroId = 'brush' | 'mage' | 'knight';
export type Owner = HeroId | 'common' | 'combo';
export type Status = 'strength' | 'weak' | 'vulnerable' | 'burn' | 'taunt' | 'thorns';
export type TargetRule = 'enemy' | 'ally' | 'self' | 'none';
export type Effect =
  | { kind: 'damage'; amount: number; hits?: number; all?: boolean; inkScale?: number }
  | { kind: 'block' | 'heal'; amount: number; self?: boolean; all?: boolean }
  | { kind: 'status'; status: Status; amount: number; self?: boolean }
  | { kind: 'draw' | 'energy' | 'ink'; amount: number }
  | { kind: 'power'; power: 'ward' | 'flow'; amount: number }
  | { kind: 'choice'; mode: 'discard' | 'exhaust' | 'scry'; count: number }
  | { kind: 'create'; definitionId: string }
  | { kind: 'interrupt' };
export interface CardDefinition {
  id: string;
  name: string;
  owner: Owner;
  cost: number;
  target: TargetRule;
  rarity: '일반' | '고급' | '희귀';
  school: '무공' | '마법' | '융합';
  type: '공격' | '기술' | '지속';
  art: number;
  description: string;
  keywords: ('retain' | 'innate' | 'exhaust')[];
  effects: Effect[];
}
export interface CardInstance {
  id: string;
  definitionId: string;
  temporary: boolean;
  costOverride?: number;
}
export interface Unit {
  id: string;
  name: string;
  art: number;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Record<Status, number>;
  ink: number;
  powers: { ward: number; flow: number };
}
export interface Intent {
  enemyId: string;
  kind: 'attack' | 'guard' | 'charge';
  targetId: string;
  damage: number;
  hits: number;
  block: number;
  weak: number;
  label: string;
}
export type Phase =
  | 'playerStart'
  | 'player'
  | 'playerEnd'
  | 'enemyStart'
  | 'enemyAction'
  | 'roundEnd'
  | 'intent'
  | 'victory'
  | 'defeat';
export type Zone = 'draw' | 'hand' | 'discard' | 'exhaust' | 'activePowers' | 'resolving';
export interface Combat {
  id: string;
  revision: number;
  rng: number;
  round: number;
  phase: Phase;
  party: Unit[];
  enemies: Unit[];
  energy: number;
  cards: Record<string, CardInstance>;
  zones: Record<Zone, string[]>;
  intents: Intent[];
  enemyCursor: number;
  serial: number;
  choice?: {
    mode: 'discard' | 'exhaust' | 'scry';
    count: number;
    candidates: string[];
    remaining: Effect[];
    cardId: string;
    actorId: string;
    targetId: string;
  };
  log: string[];
  outcomeId?: string;
}
export interface BattleEvent {
  kind: 'damage' | 'block' | 'heal' | 'card' | 'enemy' | 'outcome';
  sourceId: string;
  targetId: string;
  amount?: number;
  art?: number;
}
export interface DeckEntry {
  id: string;
  definitionId: string;
}
export interface PreparedDecks {
  brush: DeckEntry[];
  mage: DeckEntry[];
  knight: DeckEntry[];
  common: DeckEntry[];
}
export interface MapNode {
  id: string;
  column: number;
  lane: number;
  kind: 'battle' | 'event' | 'rest' | 'boss';
  name: string;
  description: string;
  next: string[];
  completed: boolean;
}
export interface Expedition {
  id: string;
  seed: number;
  nodes: MapNode[];
  current: string | null;
  deck: DeckEntry[];
  hp: number;
  choices: string[];
  visited: string[];
  rewardClaimed: string[];
  reward?: string[];
}
export interface GameSave {
  version: 1;
  rulesVersion: 'prototype-1';
  slot: number;
  revision: number;
  mode: 'normal';
  createdAt: string;
  updatedAt: string;
  screen: 'lobby' | 'story' | 'map' | 'battle' | 'room' | 'reward' | 'ending' | 'defeat';
  prepared: PreparedDecks;
  collection: string[];
  expedition?: Expedition;
  battle?: Combat;
  storyIndex: number;
  cleared: boolean;
  journal: string[];
  stats: { battles: number; cards: Record<string, number> };
}
export const emptyStatuses = (): Unit['statuses'] => ({
  strength: 0,
  weak: 0,
  vulnerable: 0,
  burn: 0,
  taunt: 0,
  thorns: 0,
});
