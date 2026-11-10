// The combatant shape and the one place attributes are turned into effective attributes.
import { SCALE, STAT_KEYS, BENCH, BIND_MAP, BIND_MULT, BIND_PARTS, MOD_CLAMP, DIFFICULTY } from './constants.js';

export function clampStat(v) {
  return Math.max(SCALE.STAT_MIN, Math.min(SCALE.STAT_MAX, Math.floor(v)));
}

export function clampLevel(level) {
  return Math.max(SCALE.LEVEL_MIN, Math.min(SCALE.LEVEL_MAX, Math.floor(level)));
}

/** What a trained attribute looks like at a level: 10 at L1, 600 at L100, straight line. */
export function benchmarkStat(level) {
  const l = clampLevel(level);
  const t = (l - SCALE.LEVEL_MIN) / (SCALE.LEVEL_MAX - SCALE.LEVEL_MIN);
  return Math.round(BENCH.AT_L1 + (BENCH.AT_L100 - BENCH.AT_L1) * t);
}

/** DC for a named difficulty at a level. Content written this way works at any level. */
export function difficultyDc(level, difficulty = 'normal') {
  const factor = DIFFICULTY[difficulty];
  if (factor === undefined) throw new Error(`Unknown difficulty "${difficulty}"`);
  return clampStat(Math.max(1, Math.round(benchmarkStat(level) * factor)));
}

/**
 * Build a combatant with every field present. This is the shape every engine function takes.
 *
 *   stats   base attributes plus gear, before buffs and binds
 *   mods    [{ stat, mult, turns, source }]  buffs and debuffs
 *   binds   { head, arms, legs }  turns remaining, 0 = free
 *   resolve null, or the state stress.js sets: { kind: 'affliction' | 'virtue' | 'rattled', id, name, turns, until,
 *           permanent, personal, roll, effects, behavior, mark }. 'rattled' is the enemy version.
 *   bindResist  one number, or { head, arms, legs }, each 0..80: how hard each part is to bind
 *   affinities { fire: 'weak', ... }  anything missing is 'normal'
 */
export function makeCombatant(partial = {}) {
  const stats = {};
  for (const key of STAT_KEYS) stats[key] = clampStat(partial.stats?.[key] ?? SCALE.STAT_MIN);
  const binds = {};
  for (const part of BIND_PARTS) binds[part] = Math.max(0, Math.floor(partial.binds?.[part] ?? 0));
  return {
    id: partial.id ?? 'unnamed',
    name: partial.name ?? partial.id ?? 'Unnamed',
    level: clampLevel(partial.level ?? 1),
    archetype: partial.archetype ?? null,
    rank: partial.rank ?? 'standard',
    stats,
    hp: partial.hp ?? null,
    maxHp: partial.maxHp ?? null,
    mp: partial.mp ?? null,
    maxMp: partial.maxMp ?? null,
    stress: Math.max(SCALE.STRESS_MIN, Math.min(SCALE.STRESS_MAX, partial.stress ?? 0)),
    limit: Math.max(0, Math.min(SCALE.LIMIT_MAX, partial.limit ?? 0)),
    binds,
    mods: (partial.mods ?? []).map((m) => ({ ...m })),
    resolve: partial.resolve ?? null,
    affinities: { ...(partial.affinities ?? {}) },
    // Left undefined when not given, so binds.js can fall back to flags.bindResist.
    bindResist: typeof partial.bindResist === 'object' && partial.bindResist !== null ? { ...partial.bindResist } : partial.bindResist,
    tags: [...(partial.tags ?? [])],
    flags: { ...(partial.flags ?? {}) },
  };
}

/** Combined buff/debuff multiplier on one attribute, clamped to 0.5 .. 1.5. */
export function modMultiplier(combatant, key) {
  let mult = 1;
  for (const mod of combatant.mods ?? []) {
    if (mod.stat === key && (mod.turns === null || mod.turns === undefined || mod.turns > 0)) mult *= mod.mult;
  }
  return Math.max(MOD_CLAMP.MIN, Math.min(MOD_CLAMP.MAX, mult));
}

/** True when any bound part governs this attribute. Two binds on one attribute still halve it once. */
export function isStatBound(combatant, key) {
  return BIND_PARTS.some((part) => (combatant.binds?.[part] ?? 0) > 0 && BIND_MAP[part].includes(key));
}

/** base x buffs (clamped) x bind, floored, clamped to 1..1000. */
export function effectiveStat(combatant, key) {
  const base = combatant.stats?.[key] ?? SCALE.STAT_MIN;
  const bound = isStatBound(combatant, key) ? BIND_MULT : 1;
  return clampStat(base * modMultiplier(combatant, key) * bound);
}

export function effectiveStats(combatant) {
  const out = {};
  for (const key of STAT_KEYS) out[key] = effectiveStat(combatant, key);
  return out;
}
