/** Mulberry32 — small, seedable, enough chaos for a campaign. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
}

export function nextRng(state: number): { value: number; rng: number } {
  const rand = mulberry32(state)();
  const rng = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return { value: rand, rng };
}

export function roll01(rngState: number): { n: number; rng: number } {
  const { value, rng } = nextRng(rngState);
  return { n: value, rng };
}

export function rollInt(
  rngState: number,
  min: number,
  max: number,
): { n: number; rng: number } {
  const { n, rng } = roll01(rngState);
  const span = max - min + 1;
  return { n: min + Math.floor(n * span), rng };
}

export function d20(rngState: number): { n: number; rng: number } {
  return rollInt(rngState, 1, 20);
}

export function pick<T>(rngState: number, list: T[]): { item: T; rng: number } {
  if (list.length === 0) {
    throw new Error("pick() from empty list");
  }
  const { n, rng } = rollInt(rngState, 0, list.length - 1);
  return { item: list[n]!, rng };
}

export function chance(rngState: number, p: number): { ok: boolean; rng: number } {
  const { n, rng } = roll01(rngState);
  return { ok: n < p, rng };
}
