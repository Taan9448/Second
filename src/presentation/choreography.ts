import type { BattleEvent, CardDefinition, Combat } from '../domain/model';
export type Technique =
  | 'ink'
  | 'double'
  | 'break'
  | 'dragon'
  | 'guard'
  | 'focus'
  | 'heal'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'holy'
  | 'enemy';
export type Beat = 'windup' | 'release' | 'impact' | 'recover';
export interface Cue {
  id: number;
  beat: Beat;
  technique: Technique;
  sourceId: string;
  targetId: string;
  label: string;
  duration: number;
  strike: number;
  event?: BattleEvent;
}
export function techniqueFor(card?: CardDefinition): Technique {
  if (!card) return 'enemy';
  if (card.id === 'b_dragon') return 'dragon';
  if (card.id === 'b_double') return 'double';
  if (card.id === 'b_mark') return 'break';
  if (card.effects.some((e) => e.kind === 'heal')) return 'heal';
  if (card.effects.some((e) => e.kind === 'damage')) {
    if (card.owner === 'mage')
      return card.art === 1 ? 'fire' : card.art === 2 ? 'ice' : 'lightning';
    return card.owner === 'knight' ? 'holy' : 'ink';
  }
  return card.effects.some((e) => e.kind === 'block') ? 'guard' : 'focus';
}
export function choreography(
  events: BattleEvent[],
  before: Combat,
  card?: CardDefinition,
): Omit<Cue, 'id'>[] {
  if (!events.length) return [];
  const cast = events.find((e) => e.kind === 'card' || e.kind === 'enemy');
  const first = cast ?? events[0];
  const source = [...before.party, ...before.enemies].find((u) => u.id === first.sourceId);
  const intent = before.intents.find((i) => i.enemyId === first.sourceId);
  let technique = techniqueFor(card);
  if (!card && intent && intent.kind !== 'attack')
    technique = intent.kind === 'guard' ? 'guard' : 'focus';
  const label =
    card?.name ?? (cast ? (intent?.label ?? `${source?.name ?? ''}의 공격`) : '상태 효과');
  const primaryImpact = events.find(
    (e) => e.kind === 'damage' || e.kind === 'block' || e.kind === 'heal',
  );
  if (!cast && source?.statuses.burn) technique = 'fire';
  const targetId =
    primaryImpact?.targetId ??
    (cast?.kind === 'enemy' && ['guard', 'focus'].includes(technique)
      ? first.sourceId
      : first.targetId);
  const base = { technique, sourceId: first.sourceId, targetId, label, strike: 0 };
  const result: Omit<Cue, 'id'>[] = [];
  if (cast) {
    result.push({ ...base, beat: 'windup', duration: technique === 'dragon' ? 320 : 220 });
    result.push({ ...base, beat: 'release', duration: technique === 'dragon' ? 560 : 320 });
  }
  const impacts = events.filter((e) => ['damage', 'block', 'heal'].includes(e.kind));
  impacts.forEach((event, i) =>
    result.push({
      ...base,
      sourceId: event.sourceId,
      targetId: event.targetId,
      beat: 'impact',
      duration: 190,
      strike: i,
      event,
    }),
  );
  if (!impacts.length) result.push({ ...base, beat: 'impact', duration: 180 });
  result.push({ ...base, beat: 'recover', duration: 260 });
  return result;
}
// Read the engine's recorded outcomes; never recalculate damage in the renderer.
export function showImpact(before: Combat, event?: BattleEvent): Combat {
  if (!event || event.hpAfter === undefined) return before;
  const next = structuredClone(before);
  const target = [...next.party, ...next.enemies].find((u) => u.id === event.targetId);
  if (target) {
    target.hp = event.hpAfter;
    target.block = event.blockAfter ?? target.block;
  }
  return next;
}
