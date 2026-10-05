import { describe, expect, it } from 'vitest';
import { cardById } from '../src/content/cards';
import { combatCommand, createCombat, heroUnit, enemyUnit } from '../src/domain/combat';
import { choreography, showImpact } from '../src/presentation/choreography';

function ready(definitionId: string) {
  const initial = createCombat(
    'animation',
    [heroUnit('brush')],
    [enemyUnit('enemy', 'soldier')],
    [{ id: 'entry', definitionId }],
    42,
  );
  const result = combatCommand(initial, { type: 'advance', revision: initial.revision });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
describe('combat presentation follows committed engine results', () => {
  it('shows each blocked multi-hit outcome without changing engine state or RNG', () => {
    const before = ready('b_double');
    before.enemies[0].block = 7;
    const original = JSON.stringify(before);
    const result = combatCommand(before, {
      type: 'play',
      cardId: before.zones.hand[0],
      actorId: 'brush',
      targetId: 'enemy',
      revision: before.revision,
    });
    if (!result.ok) throw new Error(result.reason);
    const sequence = choreography(result.events, before, cardById.b_double);
    expect(sequence.map((s) => s.beat)).toEqual([
      'windup',
      'release',
      'impact',
      'impact',
      'recover',
    ]);
    const impacts = sequence.filter((s) => s.beat === 'impact');
    const first = showImpact(before, impacts[0].event);
    expect(first.enemies[0].hp).toBe(before.enemies[0].hp);
    expect(first.enemies[0].block).toBe(1);
    const second = showImpact(first, impacts[1].event);
    expect(second.enemies[0].hp).toBe(result.state.enemies[0].hp);
    expect(second.enemies[0].block).toBe(0);
    expect(second.rng).toBe(before.rng);
    expect(JSON.stringify(before)).toBe(original);
  });
  it('aims the untargeted dragon release at an actual enemy and guard at its caster', () => {
    const before = ready('b_dragon');
    const result = combatCommand(before, {
      type: 'play',
      cardId: before.zones.hand[0],
      actorId: 'brush',
      targetId: 'brush',
      revision: before.revision,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(choreography(result.events, before, cardById.b_dragon)[1].targetId).toBe('enemy');
    before.intents[0].kind = 'guard';
    const guard = choreography([{ kind: 'enemy', sourceId: 'enemy', targetId: 'brush' }], before);
    expect(guard[1].targetId).toBe('enemy');
    expect(guard[1].technique).toBe('guard');
  });
});
