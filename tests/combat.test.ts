import { describe, expect, it } from 'vitest';
import {
  attackDamage,
  assertCombat,
  combatCommand,
  createCombat,
  drawCards,
  enemyUnit,
  heroUnit,
  previewCard,
  refreshTargets,
} from '../src/domain/combat';
import { initialDecks, cardById, cards } from '../src/content/cards';
import type { Combat, Combat as CombatState } from '../src/domain/model';
import type { CombatCommand } from '../src/domain/combat';
import { shuffled } from '../src/domain/rng';

function battle(
  ids: string[] = ['b_slash', 'b_guard', 'c_strike'],
  party = ['brush'],
): CombatState {
  const c = createCombat(
    'test',
    party.map((id) => heroUnit(id as 'brush' | 'mage' | 'knight')),
    [enemyUnit('enemy', 'soldier')],
    ids.map((definitionId, i) => ({ id: `deck-${i}`, definitionId })),
    42,
  );
  return step(c, { type: 'advance', revision: c.revision });
}
function step(c: Combat, command: CombatCommand): Combat {
  const result = combatCommand(c, command);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function play(c: Combat, definitionId: string, targetId = 'enemy'): Combat {
  const id = c.zones.hand.find((id) => c.cards[id].definitionId === definitionId)!;
  const owner = cardById[definitionId].owner;
  return step(c, {
    type: 'play',
    cardId: id,
    actorId: owner === 'common' ? 'brush' : owner,
    targetId,
    revision: c.revision,
  });
}
function turn(c: Combat): Combat {
  let next = step(c, { type: 'end', revision: c.revision });
  let limit = 20;
  while (!['player', 'victory', 'defeat'].includes(next.phase) && limit--) {
    next = step(next, { type: 'advance', revision: next.revision });
  }
  return next;
}
describe('card engine', () => {
  it('rejects a self card dropped onto an enemy without spending energy', () => {
    const c = battle(['b_guard']);
    const before = JSON.stringify(c);
    const result = combatCommand(c, {
      type: 'play',
      cardId: c.zones.hand[0],
      actorId: 'brush',
      targetId: 'enemy',
      revision: c.revision,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(c)).toBe(before);
  });
  it('uses the required damage formula before block', () => {
    const source = heroUnit('brush'),
      target = enemyUnit('t', 'soldier');
    source.statuses.strength = 2;
    source.statuses.weak = 1;
    target.statuses.vulnerable = 1;
    target.block = 5;
    expect(attackDamage(10, source, target)).toEqual({ total: 13, absorbed: 5, hp: 8 });
  });
  it('starts with exactly 5 drawn, 3 energy, separate instances and deterministic shuffle', () => {
    const d = initialDecks(),
      deck = [...d.brush, ...d.common];
    let c = createCombat('a', [heroUnit('brush')], [enemyUnit('e', 'soldier')], deck, 223);
    c = step(c, { type: 'advance', revision: 0 });
    expect(c.zones.hand).toHaveLength(5);
    expect(c.energy).toBe(3);
    expect(Object.keys(c.cards)).toHaveLength(30);
    expect(c.zones.hand.map((id) => c.cards[id].definitionId)).toContain('c_resolve');
    expect(shuffled([1, 2, 3, 4, 5], 42)).toEqual(shuffled([1, 2, 3, 4, 5], 42));
  });
  it('bounds overflow draw and reshuffles only discard', () => {
    const c = battle(Array<string>(14).fill('c_strike'));
    const id = c.zones.draw.shift()!;
    c.zones.exhaust.push(id);
    drawCards(c, 100);
    expect(c.zones.hand).toHaveLength(10);
    expect(c.zones.exhaust).toEqual([id]);
    expect(c.zones.discard.length + c.zones.draw.length).toBe(3);
    assertCombat(c);
  });
  it('rejects invalid target, insufficient energy and stale input without mutating state', () => {
    const c = battle(),
      before = JSON.stringify(c),
      id = c.zones.hand.find((id) => c.cards[id].definitionId === 'b_slash')!;
    expect(
      combatCommand(c, {
        type: 'play',
        cardId: id,
        actorId: 'brush',
        targetId: 'missing',
        revision: c.revision,
      }).ok,
    ).toBe(false);
    expect(JSON.stringify(c)).toBe(before);
    expect(combatCommand(c, { type: 'end', revision: 0 }).ok).toBe(false);
    c.energy = 0;
    expect(
      combatCommand(c, {
        type: 'play',
        cardId: id,
        actorId: 'brush',
        targetId: 'enemy',
        revision: c.revision,
      }).ok,
    ).toBe(false);
  });
  it('simulates multi-hit preview with block without consuming RNG or modifying state', () => {
    const c = battle(['b_double']);
    c.enemies[0].block = 7;
    const before = JSON.stringify(c);
    const preview = previewCard(c, c.zones.hand[0], 'brush', 'enemy');
    expect(preview).toEqual({ damage: 12, hp: 5, block: 7 });
    expect(JSON.stringify(c)).toBe(before);
    const actual = play(c, 'b_double');
    expect(actual.enemies[0].hp).toBe(27);
    expect(actual.enemies[0].block).toBe(0);
  });
  it('settles reflection before victory and stops later hits when caster falls', () => {
    const c = battle(['b_double']);
    c.party[0].hp = 3;
    c.enemies[0].hp = 6;
    c.enemies[0].statuses.thorns = 3;
    const next = play(c, 'b_double');
    expect(next.phase).toBe('defeat');
    expect(next.party[0].hp).toBe(0);
    expect(next.enemies[0].hp).toBe(0);
    expect(combatCommand(next, { type: 'end', revision: next.revision }).ok).toBe(false);
  });
  it('keeps retained and active power cards out of reshuffle and expires block', () => {
    let c = battle(['c_insight', 'b_flow', 'b_guard']);
    c = play(c, 'b_flow', 'brush');
    c = play(c, 'b_guard', 'brush');
    const retained = c.zones.hand.find((id) => c.cards[id].definitionId === 'c_insight')!;
    c = turn(c);
    expect(c.zones.activePowers).toHaveLength(1);
    expect(c.zones.hand).toContain(retained);
    expect(c.party[0].block).toBe(0);
    expect(c.party[0].ink).toBe(2);
    assertCombat(c);
  });
  it('suspends on mandatory discard, rejects duplicate choices and resumes remaining effects', () => {
    let c = battle(['c_focus', 'c_strike', 'b_guard', 'b_slash', 'b_mark', 'b_double']);
    drawCards(c, 1);
    c = play(c, 'c_focus', 'brush');
    expect(c.choice?.mode).toBe('discard');
    expect(c.zones.resolving).toHaveLength(1);
    expect(combatCommand(c, { type: 'end', revision: c.revision }).ok).toBe(false);
    const id = c.choice!.candidates[0];
    expect(combatCommand(c, { type: 'choose', ids: [id, id], revision: c.revision }).ok).toBe(
      false,
    );
    c = step(c, { type: 'choose', ids: [id], revision: c.revision });
    expect(c.choice).toBeUndefined();
    expect(c.zones.resolving).toHaveLength(0);
    assertCombat(c);
  });
  it('allows empty scry and keeps unselected draw order', () => {
    let c = battle(['c_insight', ...Array<string>(10).fill('c_strike')]);
    if (!c.zones.hand.some((id) => c.cards[id].definitionId === 'c_insight')) {
      const id = c.zones.draw.find((id) => c.cards[id].definitionId === 'c_insight')!;
      c.zones.draw = c.zones.draw.filter((x) => x !== id);
      c.zones.hand.push(id);
    }
    c = play(c, 'c_insight', 'brush');
    const order = [...c.zones.draw];
    c = step(c, { type: 'choose', ids: [], revision: c.revision });
    expect(c.zones.draw).toEqual(order);
    assertCombat(c);
  });
  it('retargets announced attacks immediately on taunt', () => {
    let c = battle(['k_oath'], ['brush', 'knight']);
    c = play(c, 'k_oath', 'knight');
    expect(c.intents[0].targetId).toBe('knight');
    c.party[1].hp = 0;
    refreshTargets(c);
    expect(c.intents[0].targetId).toBe('brush');
  });
  it('cancels a boss charge without silently changing unrelated intent', () => {
    let c = createCombat(
      'boss',
      [heroUnit('brush')],
      [enemyUnit('boss', 'boss')],
      [{ id: 'd', definitionId: 'c_break' }],
      45,
    );
    c = step(c, { type: 'advance', revision: 0 });
    expect(c.intents[0].kind).toBe('charge');
    c = play(c, 'c_break', 'boss');
    expect(c.intents[0].kind).toBe('guard');
    expect(c.intents[0].damage).toBe(0);
  });
  it('resolves every initial card definition and conserves all instances', () => {
    for (const card of cards) {
      let c = battle([card.id, 'c_strike', 'c_guard'], ['brush', 'mage', 'knight']);
      c.energy = 10;
      const target =
        card.target === 'enemy' ? 'enemy' : card.owner === 'common' ? 'brush' : card.owner;
      c = play(c, card.id, target);
      if (c.choice)
        c = step(c, {
          type: 'choose',
          ids: c.choice.mode === 'scry' ? [] : c.choice.candidates.slice(0, c.choice.count),
          revision: c.revision,
        });
      assertCombat(c);
    }
  });
});
