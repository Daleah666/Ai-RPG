// Seeded dice. Every roll in the engine goes through here so a fight can be replayed from its seed.
import { SCALE, CHECK_SLOPE, FUMBLE_FROM, CRIT_DIVISOR } from './constants.js';

/** mulberry32: small, fast, good enough for dice. Returns a function giving floats in [0, 1). */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = seed >>> 0;
  return rng;
}

/** A fixed queue of d100 results, for tests and for replaying a table roll. */
export function fixedRolls(rolls) {
  let i = 0;
  const rng = () => {
    if (i >= rolls.length) throw new Error('fixedRolls: ran out of rolls');
    return (rolls[i++] - 1) / 100;
  };
  rng.seed = null;
  return rng;
}

/** Integer 1..100. */
export function d100(rng) {
  return 1 + Math.floor(rng() * 100);
}

/** Integer lo..hi inclusive. */
export function rollInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Pick one entry from [{ weight, ... }] by weight. */
export function pickWeighted(rng, entries, weightOf = (e) => e.weight ?? 1) {
  const total = entries.reduce((sum, e) => sum + Math.max(0, weightOf(e)), 0);
  if (total <= 0) return null;
  let at = rng() * total;
  for (const e of entries) {
    at -= Math.max(0, weightOf(e));
    if (at < 0) return e;
  }
  return entries[entries.length - 1];
}

/** Clamp a percentage into the bounded window. floor and ceil can be moved by abilities. */
export function clampPct(pct, floor = SCALE.PCT_FLOOR, ceil = SCALE.PCT_CEIL) {
  const lo = Math.max(0, Math.min(100, floor));
  const hi = Math.max(lo, Math.min(100, ceil));
  return Math.max(lo, Math.min(hi, Math.round(pct)));
}

/**
 * The bounded contest every non-attack check uses.
 * Equal stat and DC is 50%. Double is 70%. Half is 30%. Ten times still caps at 95%.
 */
export function contestPct(stat, dc, bonus = 0) {
  const s = Math.max(1, stat);
  const d = Math.max(1, dc);
  return clampPct(50 + (CHECK_SLOPE * (s - d)) / (s + d) + bonus);
}

/**
 * Read one d100 roll against its bands. Low is good.
 * Order of precedence: fumble band, then crit, then hit, then miss.
 * A widened fumble band (fumbleFrom below 96) eats the top of the hit range on purpose.
 */
export function readRoll(roll, { pct, critPct = 0, fumbleFrom = FUMBLE_FROM } = {}) {
  if (roll >= fumbleFrom) return 'fumble';
  if (roll <= Math.min(critPct, pct)) return 'crit';
  if (roll <= pct) return 'hit';
  return 'miss';
}

/** Generic check: roll d100 against pct. Returns the roll and its degree. */
export function check(pct, rng, { fumbleFrom = FUMBLE_FROM } = {}) {
  const p = clampPct(pct);
  const roll = d100(rng);
  const critPct = Math.max(1, Math.floor(p / CRIT_DIVISOR));
  const degree = readRoll(roll, { pct: p, critPct, fumbleFrom });
  return { pct: p, roll, degree, success: degree === 'crit' || degree === 'hit' };
}

/** Stat against DC in one call. */
export function statCheck(stat, dc, rng, { bonus = 0, fumbleFrom = FUMBLE_FROM } = {}) {
  return check(contestPct(stat, dc, bonus), rng, { fumbleFrom });
}
