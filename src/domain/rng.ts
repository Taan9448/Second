// Serializable xorshift32. Zero seeds are normalized so the stream never locks.
export function nextRandom(state: number): [number, number] {
  let x = state || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return [next, next / 4294967296];
}
export function shuffled<T>(items: readonly T[], seed: number): [T[], number] {
  const result = [...items];
  let rng = seed;
  for (let i = result.length - 1; i > 0; i--) {
    const [next, value] = nextRandom(rng);
    rng = next;
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return [result, rng];
}
