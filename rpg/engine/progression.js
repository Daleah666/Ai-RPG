// Levels, attribute growth, bars, rewards and prices. Pure and browser-safe: archetypes come in as plain objects.
// Owner: Progression Analyst. The reasoning behind every number is in blueprint/02_progression.md.
import { SCALE, STAT_KEYS, BARS, GROWTH, RANK_HP_MULT } from './constants.js';
import { benchmarkStat, clampLevel, clampStat } from './stats.js';

// ---------------------------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------------------------

/**
 * EXP to go from level L to L + 1 = QUAD x L^2 + LIN x L + CONST.
 * With these values it factors to 50 x L x (L + 15): 800 at L1, 20,130,000 in total to L100.
 */
export const EXP_CURVE = Object.freeze({ QUAD: 50, LIN: 750, CONST: 0 });

/** The reference fight all pacing is measured against: this many standard enemies of the party's level. */
export const REFERENCE_FIGHT_ENEMIES = 4;

/** What one standard enemy is worth, per enemy level. EXP is not split: every party member gets the full amount. */
export const YIELD = Object.freeze({ EXP_PER_LEVEL: 50, GOLD_PER_LEVEL: 10 });

/** Reward multiplier by enemy rank, for EXP and gold alike. Sits a little above RANK_HP_MULT so risk pays. */
export const RANK_REWARD_MULT = Object.freeze({ minion: 0.4, standard: 1, elite: 4, boss: 30, superboss: 100 });

/** An enemy this many levels below a character is worth half its EXP to them. See levelGapMult. */
export const EXP_GAP_SCALE = 10;

function rawExpToNext(l) {
  return EXP_CURVE.QUAD * l * l + EXP_CURVE.LIN * l + EXP_CURVE.CONST;
}

function rankMult(table, rank) {
  const mult = table[rank];
  if (mult === undefined) throw new Error(`Unknown rank "${rank}"`);
  return mult;
}

/** EXP needed to go from `level` to `level + 1`. 0 at level 100. */
export function expToNext(level) {
  const l = clampLevel(level);
  return l >= SCALE.LEVEL_MAX ? 0 : rawExpToNext(l);
}

/** Cumulative EXP needed to reach `level` starting from level 1. 0 at level 1. */
export function totalExpForLevel(level) {
  const n = clampLevel(level) - 1; // levels already completed
  const sumL = (n * (n + 1)) / 2;
  const sumL2 = (n * (n + 1) * (2 * n + 1)) / 6;
  return EXP_CURVE.QUAD * sumL2 + EXP_CURVE.LIN * sumL + EXP_CURVE.CONST * n;
}

/** The level a character with this much total EXP has reached. Clamped to 1..100. */
export function levelForExp(totalExp) {
  if (Number.isNaN(totalExp) || totalExp === undefined || totalExp === null) return SCALE.LEVEL_MIN;
  let level = SCALE.LEVEL_MIN;
  while (level < SCALE.LEVEL_MAX && totalExpForLevel(level + 1) <= totalExp) level++;
  return level;
}

/** EXP printed on the enemy: what each party member gets for defeating it at or below its level. */
export function expYield(enemyLevel, rank = 'standard') {
  return Math.max(1, Math.round(YIELD.EXP_PER_LEVEL * clampLevel(enemyLevel) * rankMult(RANK_REWARD_MULT, rank)));
}

/** Gold the party gets for defeating one enemy. */
export function goldYield(enemyLevel, rank = 'standard') {
  return Math.max(1, Math.round(YIELD.GOLD_PER_LEVEL * clampLevel(enemyLevel) * rankMult(RANK_REWARD_MULT, rank)));
}

/**
 * Share of an enemy's EXP a character keeps when the enemy is below their level.
 * 1 at or above the character's level, then 1 / (1 + (gap / 10)^2): half at 10 below, a fifth at 20, a tenth at 30.
 * It never reaches zero, so there is no cutoff to game.
 */
export function levelGapMult(characterLevel, enemyLevel) {
  const gap = clampLevel(characterLevel) - clampLevel(enemyLevel);
  if (gap <= 0) return 1;
  return 1 / (1 + (gap / EXP_GAP_SCALE) ** 2);
}

/** EXP one character actually receives for one defeated enemy. Never less than 1. */
export function expGain(characterLevel, enemyLevel, rank = 'standard') {
  return Math.max(1, Math.floor(expYield(enemyLevel, rank) * levelGapMult(characterLevel, enemyLevel)));
}

/** Reference fights (four standard enemies of `enemyLevel`) a character at `level` needs to level up. */
export function fightsToLevel(level, enemyLevel = level) {
  return expToNext(level) / (REFERENCE_FIGHT_ENEMIES * expGain(level, enemyLevel));
}

// ---------------------------------------------------------------------------------------------
// Attribute growth and archetypes
// ---------------------------------------------------------------------------------------------

/** The budget rules validateArchetype enforces. Totals and the signature value come from GROWTH in constants. */
export const ARCHETYPE_RULES = Object.freeze({
  L1_MIN: 8,
  L1_MAX: 16,
  L100_MIN: 300,
  L100_OFF_SIGNATURE_MAX: 760,
  EXPONENT_MIN: 0.5,
  EXPONENT_MAX: 2,
  DRIFT_WARN: 0.05, // warn when the six-attribute total strays this far from the straight budget line
});

/**
 * One attribute at a level: an integer that is exactly `l1` at level 1, exactly `l100` at level 100,
 * and never decreases in between. exponent 1 is a straight line, below 1 blooms early, above 1 blooms late.
 */
export function growthCurve(l1, l100, level, exponent = 1) {
  if (!Number.isInteger(l1) || !Number.isInteger(l100)) throw new TypeError('growthCurve: l1 and l100 must be integers');
  if (l100 < l1) throw new RangeError('growthCurve: l100 must not be below l1');
  if (!Number.isFinite(exponent) || exponent <= 0) throw new RangeError('growthCurve: exponent must be a positive number');
  const l = clampLevel(level);
  if (l <= SCALE.LEVEL_MIN) return l1;
  if (l >= SCALE.LEVEL_MAX) return l100;
  const span = SCALE.LEVEL_MAX - SCALE.LEVEL_MIN;
  // The straight line is kept in exact integer arithmetic so every JavaScript engine prints the same table.
  if (exponent === 1) return Math.round(l1 + ((l100 - l1) * (l - SCALE.LEVEL_MIN)) / span);
  return Math.round(l1 + (l100 - l1) * Math.pow((l - SCALE.LEVEL_MIN) / span, exponent));
}

/** One base attribute of an archetype at a level, before gear. */
export function statAt(archetype, key, level) {
  if (!STAT_KEYS.includes(key)) throw new Error(`Unknown attribute "${key}"`);
  const l1 = archetype?.l1?.[key];
  const l100 = archetype?.l100?.[key];
  if (l1 === undefined || l100 === undefined) {
    throw new Error(`Archetype "${archetype?.id ?? 'unknown'}" is missing ${key} in l1 or l100`);
  }
  return growthCurve(l1, l100, level, archetype.exponent?.[key] ?? 1);
}

/** All six base attributes of an archetype at a level, before gear: { STR, INT, AGI, CON, WIL, LCK }. */
export function statsAt(archetype, level) {
  const out = {};
  for (const key of STAT_KEYS) out[key] = statAt(archetype, key, level);
  return out;
}

/** The six-attribute total every archetype is budgeted to at a level: 70 at L1, 3,300 at L100, straight between. */
export function budgetAt(level) {
  const t = (clampLevel(level) - SCALE.LEVEL_MIN) / (SCALE.LEVEL_MAX - SCALE.LEVEL_MIN);
  return GROWTH.L1_TOTAL + (GROWTH.L100_TOTAL - GROWTH.L1_TOTAL) * t;
}

/**
 * Check an archetype object against the attribute budget (anchor A9).
 * Returns { ok, errors, warnings }. `ok` is true when `errors` is empty; warnings never fail an archetype.
 */
export function validateArchetype(archetype) {
  const errors = [];
  const warnings = [];
  if (archetype === null || typeof archetype !== 'object' || Array.isArray(archetype)) {
    return { ok: false, errors: ['archetype must be an object'], warnings };
  }
  const R = ARCHETYPE_RULES;
  const label = typeof archetype.id === 'string' && archetype.id ? archetype.id : 'archetype';

  if (typeof archetype.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(archetype.id)) {
    errors.push('id must be a lowercase snake_case string');
  }
  for (const field of ['name', 'identity', 'want', 'cost']) {
    if (typeof archetype[field] !== 'string' || archetype[field].trim() === '') {
      errors.push(`${label}: "${field}" must be a non-empty string`);
    }
  }
  const sig = archetype.signature;
  const sigOk = STAT_KEYS.includes(sig);
  if (!sigOk) errors.push(`${label}: signature must be one of ${STAT_KEYS.join(', ')}, got ${JSON.stringify(sig)}`);

  // Every attribute present, an integer, and no stray keys (catches typos such as "DEX").
  let complete = true;
  for (const block of ['l1', 'l100']) {
    const values = archetype[block];
    if (values === null || typeof values !== 'object') {
      errors.push(`${label}: "${block}" must be an object with ${STAT_KEYS.join(', ')}`);
      complete = false;
      continue;
    }
    for (const key of STAT_KEYS) {
      if (!Number.isInteger(values[key])) {
        errors.push(`${label}: ${block}.${key} must be an integer, got ${JSON.stringify(values[key])}`);
        complete = false;
      }
    }
    for (const key of Object.keys(values)) {
      if (!STAT_KEYS.includes(key)) errors.push(`${label}: ${block}.${key} is not an attribute`);
    }
  }

  let exponentsOk = true;
  const exponent = archetype.exponent;
  if (exponent !== undefined) {
    if (exponent === null || typeof exponent !== 'object') {
      errors.push(`${label}: "exponent" must be an object keyed by attribute`);
      exponentsOk = false;
    } else {
      for (const [key, value] of Object.entries(exponent)) {
        if (!STAT_KEYS.includes(key)) {
          errors.push(`${label}: exponent.${key} is not an attribute`);
        } else if (typeof value !== 'number' || !Number.isFinite(value) || value < R.EXPONENT_MIN || value > R.EXPONENT_MAX) {
          errors.push(`${label}: exponent.${key} must be a number in ${R.EXPONENT_MIN}..${R.EXPONENT_MAX}, got ${JSON.stringify(value)}`);
          exponentsOk = false;
        }
      }
    }
  }

  if (!complete) return { ok: false, errors, warnings };
  const { l1, l100 } = archetype;

  // Level 1: every attribute in 8..16, total exactly 70.
  for (const key of STAT_KEYS) {
    if (l1[key] < R.L1_MIN || l1[key] > R.L1_MAX) {
      errors.push(`${label}: l1.${key} is ${l1[key]}, must be in ${R.L1_MIN}..${R.L1_MAX}`);
    }
  }
  const l1Total = STAT_KEYS.reduce((sum, key) => sum + l1[key], 0);
  if (l1Total !== GROWTH.L1_TOTAL) {
    errors.push(`${label}: level 1 attributes total ${l1Total}, must total exactly ${GROWTH.L1_TOTAL}`);
  }

  // Level 100: signature exactly 800, nothing else above 760, nothing below 300, total exactly 3,300.
  for (const key of STAT_KEYS) {
    if (l100[key] < R.L100_MIN) errors.push(`${label}: l100.${key} is ${l100[key]}, must be at least ${R.L100_MIN}`);
    if (key === sig) continue;
    if (l100[key] > R.L100_OFF_SIGNATURE_MAX) {
      errors.push(`${label}: l100.${key} is ${l100[key]}, only the signature may be above ${R.L100_OFF_SIGNATURE_MAX}`);
    }
  }
  if (sigOk && l100[sig] !== GROWTH.SIGNATURE_L100) {
    errors.push(`${label}: signature ${sig} is ${l100[sig]} at level 100, must be exactly ${GROWTH.SIGNATURE_L100}`);
  }
  const l100Total = STAT_KEYS.reduce((sum, key) => sum + l100[key], 0);
  if (l100Total !== GROWTH.L100_TOTAL) {
    errors.push(`${label}: level 100 attributes total ${l100Total}, must total exactly ${GROWTH.L100_TOTAL}`);
  }

  // Growth never goes backwards, and the mid-game total stays near the shared budget line.
  for (const key of STAT_KEYS) {
    if (l100[key] < l1[key]) errors.push(`${label}: ${key} shrinks from ${l1[key]} to ${l100[key]}, growth must not decrease`);
  }
  if (exponentsOk && errors.length === 0) {
    let worst = { drift: 0, level: SCALE.LEVEL_MIN, total: l1Total };
    let previous = statsAt(archetype, SCALE.LEVEL_MIN);
    for (let level = SCALE.LEVEL_MIN + 1; level <= SCALE.LEVEL_MAX; level++) {
      const current = statsAt(archetype, level);
      for (const key of STAT_KEYS) {
        if (current[key] < previous[key]) errors.push(`${label}: ${key} drops from ${previous[key]} to ${current[key]} at level ${level}`);
      }
      const total = STAT_KEYS.reduce((sum, key) => sum + current[key], 0);
      const drift = total / budgetAt(level) - 1;
      if (Math.abs(drift) > Math.abs(worst.drift)) worst = { drift, level, total };
      previous = current;
    }
    if (Math.abs(worst.drift) > R.DRIFT_WARN) {
      const pct = (worst.drift * 100).toFixed(1);
      warnings.push(
        `${label}: attributes total ${worst.total} at level ${worst.level}, ${pct}% off the budget line of ${Math.round(budgetAt(worst.level))}; ` +
          'balance early bloomers (exponent below 1) against late ones (above 1)',
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------------------------

/** Max HP = 10 x Level x CON, times the enemy rank multiplier. The baseline, unchanged. */
export function maxHp(level, con, rank = 'standard') {
  const mult = rankMult(RANK_HP_MULT, rank);
  return Math.max(1, Math.round(BARS.HP_PER_CON_PER_LEVEL * clampLevel(level) * clampStat(con) * mult));
}

/** Max MP = 1 x Level x WIL. The baseline, unchanged. Rank does not change MP. */
export function maxMp(level, wil) {
  return Math.max(1, Math.round(BARS.MP_PER_WIL_PER_LEVEL * clampLevel(level) * clampStat(wil)));
}

/** Both bars for a player archetype at a level, before gear: { maxHp, maxMp }. */
export function barsAt(archetype, level) {
  return { maxHp: maxHp(level, statAt(archetype, 'CON', level)), maxMp: maxMp(level, statAt(archetype, 'WIL', level)) };
}

/** The reference HP pool at a level: benchmark CON, optionally at an enemy rank. Size damage and healing against it. */
export function hpBudget(level, rank = 'standard') {
  return maxHp(level, benchmarkStat(level), rank);
}

/** The reference MP pool at a level: benchmark WIL. Price skill costs as a share of it. */
export function mpBudget(level) {
  return maxMp(level, benchmarkStat(level));
}

// ---------------------------------------------------------------------------------------------
// Gold and prices
// ---------------------------------------------------------------------------------------------

/** Where the two pacing targets sit: a basic recovery item costs half a fight, a major purchase costs one level. */
export const PRICE_GUIDE = Object.freeze({ BASIC_RECOVERY_FIGHTS: 0.5, MAJOR_PURCHASE_SHARE: 1 });

/** Gold from one reference fight at a level. */
export function fightGold(level) {
  return REFERENCE_FIGHT_ENEMIES * goldYield(level);
}

/**
 * Gold a party earns while working through one level on reference fights.
 * At level 100 the EXP curve is read as if it continued, so prices still exist at the cap.
 */
export function levelGold(level) {
  const l = clampLevel(level);
  return Math.round((rawExpToNext(l) / expYield(l)) * goldYield(l));
}

/** Total gold a party is expected to have earned by the time it reaches `level`. 0 at level 1. */
export function wealthAt(level) {
  const target = clampLevel(level);
  let gold = 0;
  for (let l = SCALE.LEVEL_MIN; l < target; l++) gold += levelGold(l);
  return gold;
}

function scaledPrice(base, factor, name) {
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor < 0) {
    throw new RangeError(`${name} must be a number of 0 or more`);
  }
  if (factor === 0) return 0;
  return Math.max(1, Math.round(base * factor));
}

/** A price equal to `share` of what a party earns across `level`. Use it for gear. 1 = the whole level's gold. */
export function priceAt(level, share) {
  return scaledPrice(levelGold(level), share, 'share');
}

/** A price equal to the gold from `fights` reference fights at `level`. Use it for consumables. */
export function priceForFights(level, fights) {
  return scaledPrice(fightGold(level), fights, 'fights');
}
