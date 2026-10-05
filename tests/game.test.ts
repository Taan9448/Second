import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { gameCommand, newGame, practiceGame } from '../src/application/game';
import { createExpedition, reachable, validateMap } from '../src/domain/expedition';
import { initialDecks } from '../src/content/cards';
import { commitSave, loadSave, parseSave, saveKey, validateSave } from '../src/persistence/save';
describe('expedition and persistence', () => {
  it('builds valid seeded branch routes with fixed pre-boss camp and deep copied deck', () => {
    const deck = initialDecks().brush;
    const variants = new Set<string>();
    for (let seed = 1; seed < 50; seed++) {
      const e = createExpedition(seed * 234123, deck);
      validateMap(e);
      variants.add(e.nodes[1].kind);
      expect(e.nodes.find((n) => n.id === 'camp')?.next).toEqual(['boss']);
      expect(e.deck).not.toBe(deck);
      expect(e).toEqual(createExpedition(seed * 234123, deck));
    }
    expect(variants.size).toBe(2);
  });
  it('rejects unconnected rooms and copies the 30-card starter deck', () => {
    let s = gameCommand(newGame(1), { type: 'start', seed: 44 });
    expect(s.expedition?.deck).toHaveLength(30);
    expect(s.expedition?.deck[0]).not.toBe(s.prepared.brush[0]);
    for (let i = 0; i < 3; i++) s = gameCommand(s, { type: 'storyNext' });
    expect(s.screen).toBe('map');
    expect(reachable(s.expedition!)).toEqual(['gate']);
    expect(() => gameCommand(s, { type: 'room', id: 'boss' })).toThrow();
  });
  it('issues battle outcome and card reward only once, preserving serialized reward RNG', () => {
    let s = gameCommand(newGame(1), { type: 'start', seed: 44 });
    for (let i = 0; i < 3; i++) s = gameCommand(s, { type: 'storyNext' });
    s = gameCommand(s, { type: 'room', id: 'gate' });
    s.battle!.enemies.forEach((e) => (e.hp = 0));
    s.battle!.phase = 'victory';
    s.battle!.outcomeId = 'win';
    s = gameCommand(s, { type: 'battleFinish' });
    const restored = parseSave(JSON.stringify(s));
    expect(restored.expedition?.reward).toEqual(s.expedition?.reward);
    expect(() => gameCommand(s, { type: 'battleFinish' })).toThrow();
    const reward = s.expedition!.reward![0];
    s = gameCommand(s, { type: 'reward', id: reward });
    expect(s.expedition?.deck).toHaveLength(31);
    expect(() => gameCommand(s, { type: 'reward', id: reward })).toThrow();
    expect(s.stats.battles).toBe(1);
  });
  it('validates version, JSON, IDs, duplicate zones, missing battle and owner mismatch', () => {
    expect(() => parseSave('{broken')).toThrow();
    expect(() => validateSave({ ...newGame(1), version: 2 })).toThrow();
    expect(() => saveKey(4)).toThrow();
    const bad = practiceGame(123);
    bad.battle!.zones.hand.push('missing');
    expect(() => validateSave(bad)).toThrow();
    const missing = newGame(1);
    missing.screen = 'battle';
    expect(() => validateSave(missing)).toThrow();
    const unknownHero = practiceGame(123);
    unknownHero.battle!.party[0].id = 'unknown-hero';
    expect(() => validateSave(unknownHero)).toThrow();
    const unknownIntent = practiceGame(123);
    unknownIntent.battle!.intents[0].targetId = 'unknown-target';
    expect(() => validateSave(unknownIntent)).toThrow();
    const owner = newGame(1);
    owner.prepared.brush[0].definitionId = 'k_guard';
    expect(() => validateSave(owner)).toThrow();
  });
  it('atomically commits expected revision and isolates campaign, practice and slots', async () => {
    const first = newGame(1);
    await commitSave(first, null);
    const next = gameCommand(first, { type: 'start', seed: 987 });
    await commitSave(next, 0);
    await expect(commitSave(next, 0)).rejects.toThrow('다른 탭');
    expect((await loadSave(1))?.revision).toBe(1);
    const second = newGame(2);
    await commitSave(second, null);
    const practice = practiceGame(456);
    await commitSave(practice, null, true);
    expect((await loadSave(1))?.screen).toBe('story');
    expect((await loadSave(1, true))?.screen).toBe('battle');
    expect((await loadSave(2))?.revision).toBe(0);
    expect(await loadSave(3)).toBeNull();
  });
});
