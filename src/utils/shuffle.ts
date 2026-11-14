// A serializable PRNG keeps the reducer deterministic, including pile recycling.
export function randomStep(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, next];
}
export function shuffle<T>(items: readonly T[], seed: number): { items: T[]; seed: number } {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const [random, next] = randomStep(seed); seed = next;
    const j = Math.floor(random * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
  }
  return { items: result, seed };
}
