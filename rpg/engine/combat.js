// Attack resolution: hit chance, damage, healing, stress mitigation and turn order.
// Owner: Combat Engineer. Pure functions, no state, integers out. Nothing here mutates a combatant.
// Every attribute is read through effectiveStat, so buffs and binds are already applied.
// The reasoning behind each number is in blueprint/01_engine_math.md.
import { AFFINITY_MULT, BARS, DEFENDS, FUMBLE_FROM } from './constants.js';
import { clampPct, d100, readRoll, rollInt } from './rng.js';
import { effectiveStat } from './stats.js';

// ---------------------------------------------------------------- tunables

// Hit %  = clamp( HIT_BASE + HIT_SLOPE x (ACC - EVA) / (ACC + EVA) + skill.acc + hitBonus , 5, 95 )
export const HIT_BASE = 75; // hit % when accuracy equals evasion
export const HIT_SLOPE = 40; // how far the ACC:EVA ratio can swing the chance (never the full 40)
export const LCK_TO_ACC = 0.5; // ACC and EVA are both AGI + LCK x this

// Crit % = clamp( CRIT_BASE + CRIT_SLOPE x (LCKa - LCKd) / (LCKa + LCKd) + skill.crit + critBonus , 1, 50 ), never above Hit %
export const CRIT_BASE = 5;
export const CRIT_SLOPE = 20;
export const CRIT_FLOOR = 1; // crit is a band inside the hit roll, so it has its own window
export const CRIT_CAP = 50;
export const CRIT_MULT = 1.5;

// Damage = floor( Power x Level x A x passThrough(A, D) x variance x crit x affinity x guard x damageMult )
// passThrough = EVEN_PASS x (1 + DEF_WEIGHT) x A / (A + DEF_WEIGHT x D)  =  1.5 A / (2A + D)
export const DEF_WEIGHT = 0.5; // what one point of defense is worth against one point of attack (baseline was 1)
export const EVEN_PASS = 0.5; // share of Power x Level x A that gets through when A equals D
export const GUARD_MULT = 0.5;
export const VARIANCE = Object.freeze({ MIN: 0.9, MAX: 1.1 }); // rolled in whole percents: 0.90, 0.91 ... 1.10
export const MIN_DAMAGE = 1; // a landed hit that is not nulled always does at least this
export const BASIC_POWER = 2.0;

// Heal   = floor( Power x Level x INT x HEAL_SCALE x variance x crit x mult )
export const HEAL_SCALE = 0.5; // same as EVEN_PASS: a heal of power P undoes one even-stat hit of power P

// Stress = max( 1, round( Base x mult x (1 - min(STRESS_MIT_CAP, WIL / (WIL + STRESS_K))) ) )
export const STRESS_K = 600; // the WIL at which half of incoming stress is shrugged off
export const STRESS_MIT_CAP = 0.75; // guard rail; with STRESS_K 600 the curve tops out at 0.625 at WIL 1000

// Initiative = AGI x INIT_SCALE + random 0 .. AGI x INIT_SCALE x INIT_SPREAD
export const INIT_SCALE = 10;
export const INIT_SPREAD = 0.2; // an AGI lead of more than 20% always acts first

/** The attack everyone has. Costs nothing, uses the arms, scales with STR. */
export const BASIC_ATTACK = Object.freeze({
  id: 'basic_attack',
  name: 'Attack',
  archetype: null,
  unlock: 1,
  tier: 0,
  type: 'physical',
  stat: 'STR',
  power: BASIC_POWER,
  acc: 0,
  crit: 0,
  element: 'phys',
  target: 'one',
  part: 'arms',
  cost: Object.freeze({ mp: 0, limit: 0 }),
  tags: Object.freeze(['melee']),
  effects: Object.freeze([]),
  text: 'A plain, honest whack. No MP, no flourish, no refunds.',
});

// ---------------------------------------------------------------- helpers

const EPS = 1e-9; // absorbs float noise so 165.00000000000003 and 164.99999999999997 both floor to 165
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const nonNeg = (v, fallback = 1) => Math.max(0, num(v, fallback));

/** The attribute a skill attacks with. Explicit skill.stat wins; otherwise INT for magical, STR for the rest. */
export function attackStatOf(skill) {
  return skill?.stat ?? (skill?.type === 'magical' ? 'INT' : 'STR');
}

/** The attribute that defends against a skill: CON against STR, WIL against INT, otherwise by skill.type. */
export function defenseStatOf(skill) {
  return DEFENDS[attackStatOf(skill)] ?? (skill?.type === 'magical' ? 'WIL' : 'CON');
}

/**
 * Share of Power x Level x A that survives the defender's attribute. Takes plain numbers.
 * 0.5 when equal, 0.75 at most (no defense at all), 0.375 at double defense, 0.125 at ten times.
 */
export function passThrough(atk, def) {
  const a = Math.max(1, num(atk, 1));
  const d = Math.max(1, num(def, 1));
  return (EVEN_PASS * (1 + DEF_WEIGHT) * a) / (a + DEF_WEIGHT * d);
}

/** Share of incoming stress a WIL value shrugs off. Takes a plain number. */
export function stressMitigation(wil) {
  const w = Math.max(1, num(wil, 1));
  return Math.min(STRESS_MIT_CAP, w / (w + STRESS_K));
}

/** One variance draw: 0.90 to 1.10 in steps of 0.01, every step equally likely. */
export function rollVariance(rng) {
  return rollInt(rng, Math.round(VARIANCE.MIN * 100), Math.round(VARIANCE.MAX * 100)) / 100;
}

// A roll of 1 can never be a fumble; 101 switches the fumble band off.
function fumbleEdge(v) {
  return Math.max(2, Math.min(101, Math.round(num(v, FUMBLE_FROM))));
}

function affinityMult(affinity) {
  const mult = AFFINITY_MULT[affinity];
  if (mult === undefined) throw new Error(`Unknown affinity "${affinity}"`);
  return mult;
}

// ---------------------------------------------------------------- to hit

/**
 * The bands one d100 is read against.
 * opts: hitBonus (added before the clamp; pass a negative number for a defender's dodge passive),
 *       hitFloor / hitCap (move the 5..95 window; the floor wins if they cross),
 *       critBonus, fumbleFrom (first roll that fumbles, default 96).
 */
export function hitChance(attacker, defender, skill = BASIC_ATTACK, opts = {}) {
  const acc = effectiveStat(attacker, 'AGI') + effectiveStat(attacker, 'LCK') * LCK_TO_ACC;
  const eva = effectiveStat(defender, 'AGI') + effectiveStat(defender, 'LCK') * LCK_TO_ACC;
  const rawHit = HIT_BASE + (HIT_SLOPE * (acc - eva)) / (acc + eva) + num(skill?.acc) + num(opts.hitBonus);
  const hitPct = clampPct(rawHit, opts.hitFloor ?? undefined, opts.hitCap ?? undefined);

  const la = effectiveStat(attacker, 'LCK');
  const ld = effectiveStat(defender, 'LCK');
  const rawCrit = CRIT_BASE + (CRIT_SLOPE * (la - ld)) / (la + ld) + num(skill?.crit) + num(opts.critBonus);
  const critPct = Math.min(hitPct, clampPct(rawCrit, CRIT_FLOOR, CRIT_CAP));

  return { hitPct, critPct, fumbleFrom: fumbleEdge(opts.fumbleFrom) };
}

/** Roll the one d100 for an attack and read it: 'crit' | 'hit' | 'miss' | 'fumble'. Uses the rng exactly once. */
export function rollAttack(attacker, defender, skill = BASIC_ATTACK, rng, opts = {}) {
  const { hitPct, critPct, fumbleFrom } = hitChance(attacker, defender, skill, opts);
  const roll = d100(rng);
  const outcome = readRoll(roll, { pct: hitPct, critPct, fumbleFrom });
  return { roll, hitPct, critPct, fumbleFrom, outcome };
}

// ---------------------------------------------------------------- damage

/** 'weak' | 'normal' | 'resist' | 'null' | 'absorb' for this skill's element. Missing entries are 'normal'. */
export function affinityOf(defender, skill = BASIC_ATTACK) {
  const affinity = defender?.affinities?.[skill?.element ?? 'phys'] ?? 'normal';
  affinityMult(affinity); // throws on a typo in the data
  return affinity;
}

/**
 * Damage of one landed hit. Deterministic: the caller supplies crit and variance.
 * Multiply everything, floor once at the end. Never negative.
 *   'null'   returns 0.
 *   'absorb' returns the positive amount an ordinary hit would have done: the caller heals the defender by it.
 *   Anything else that lands deals at least 1. A skill with power 0 or less deals 0.
 */
export function damage(attacker, defender, skill = BASIC_ATTACK, { crit = false, variance = 1, guard = false, affinity, damageMult = 1 } = {}) {
  const power = num(skill?.power);
  if (power <= 0) return 0;
  const affinityScale = Math.abs(affinityMult(affinity ?? affinityOf(defender, skill)));
  if (affinityScale === 0) return 0;

  const a = effectiveStat(attacker, attackStatOf(skill));
  const d = effectiveStat(defender, defenseStatOf(skill));
  const level = Math.max(1, num(attacker?.level, 1));
  const total =
    power * level * a * passThrough(a, d) *
    nonNeg(variance) * (crit ? CRIT_MULT : 1) * affinityScale * (guard ? GUARD_MULT : 1) * nonNeg(damageMult);
  return Math.max(MIN_DAMAGE, Math.floor(total + EPS));
}

/**
 * A whole attack: one d100, then one variance draw if it landed. Mutates nothing.
 * opts: everything hitChance takes, plus damageMult, guard (defender is guarding),
 *       affinity (override the lookup) and variance (fix it instead of drawing).
 * On a miss or fumble: damage 0, variance 1, and the rng is used once.
 * absorbed is true when the hit landed on an absorbing defender: add damage to their HP instead of removing it.
 * What a fumble costs the attacker is up to the caller.
 */
export function resolveAttack(attacker, defender, skill = BASIC_ATTACK, rng, opts = {}) {
  const { roll, hitPct, critPct, fumbleFrom, outcome } = rollAttack(attacker, defender, skill, rng, opts);
  const affinity = opts.affinity ?? affinityOf(defender, skill);
  const landed = outcome === 'hit' || outcome === 'crit';
  let variance = 1;
  let dealt = 0;
  if (landed) {
    variance = Number.isFinite(opts.variance) ? opts.variance : rollVariance(rng);
    dealt = damage(attacker, defender, skill, {
      crit: outcome === 'crit',
      variance,
      guard: Boolean(opts.guard),
      affinity,
      damageMult: opts.damageMult ?? 1,
    });
  }
  return { outcome, roll, hitPct, critPct, fumbleFrom, affinity, variance, damage: dealt, absorbed: landed && affinity === 'absorb' };
}

// ---------------------------------------------------------------- healing

/**
 * HP restored by a healing skill or effect: anything shaped { power, stat? } (stat defaults to INT).
 * Scales with caster Level x INT exactly as damage does, so healing keeps pace with the HP scale:
 * as a share of the target's max HP it is 5% x Power x INT / target CON at every level.
 * opts: variance (default 1), crit (x1.5), mult. A heal with positive power restores at least 1.
 */
export function healAmount(caster, skill, { variance = 1, crit = false, mult = 1 } = {}) {
  const power = num(skill?.power);
  if (power <= 0) return 0;
  const stat = effectiveStat(caster, skill?.stat ?? 'INT');
  const level = Math.max(1, num(caster?.level, 1));
  const total = power * level * stat * HEAL_SCALE * nonNeg(variance) * (crit ? CRIT_MULT : 1) * nonNeg(mult);
  return Math.max(1, Math.floor(total + EPS));
}

// ---------------------------------------------------------------- stress

/**
 * Stress actually taken from a hit of baseStress, after effective WIL.
 * opts: ignoreWill (no mitigation at all), mult (scales stress gains, applied before rounding).
 * Positive base: at least 1. Zero: 0. Negative base is relief: it passes through as given,
 * with no WIL mitigation and no mult. Clamping the bar to 0..200 is the caller's job.
 */
export function stressTaken(baseStress, target, { ignoreWill = false, mult = 1 } = {}) {
  const base = num(baseStress);
  if (base <= 0) return Math.round(base) || 0;
  const mitigation = ignoreWill ? 0 : stressMitigation(effectiveStat(target, 'WIL'));
  return Math.max(1, Math.round(base * nonNeg(mult) * (1 - mitigation)));
}

// ---------------------------------------------------------------- turn order

/**
 * Turn-order score, higher acts first. Effective AGI x 10 plus a random 0..20% of that.
 * Uses the rng once. Break ties on effective LCK, then heroes before enemies.
 */
export function initiative(combatant, rng) {
  const base = effectiveStat(combatant, 'AGI') * INIT_SCALE;
  return base + rollInt(rng, 0, Math.floor(base * INIT_SPREAD));
}

// ---------------------------------------------------------------- balance helpers

/**
 * Average damage per use, counting misses, fumbles and crits, at variance 1. Two decimals.
 * Takes the same opts as resolveAttack. Negative when the defender absorbs the element.
 */
export function expectedDamage(attacker, defender, skill = BASIC_ATTACK, opts = {}) {
  const { hitPct, critPct, fumbleFrom } = hitChance(attacker, defender, skill, opts);
  const landPct = Math.max(0, Math.min(hitPct, fumbleFrom - 1));
  const crits = Math.min(critPct, landPct);
  const affinity = opts.affinity ?? affinityOf(defender, skill);
  const base = { variance: 1, guard: Boolean(opts.guard), affinity, damageMult: opts.damageMult ?? 1 };
  const plain = damage(attacker, defender, skill, { ...base, crit: false });
  const critical = damage(attacker, defender, skill, { ...base, crit: true });
  const average = ((landPct - crits) * plain + crits * critical) / 100;
  return (Math.round(average * 100) / 100) * (affinity === 'absorb' ? -1 : 1) || 0;
}

/**
 * Landed, non-crit, variance-1 hits needed to take hp to zero. Infinity if the skill cannot hurt the defender.
 * hp defaults to the defender's maxHp, then to the baseline 10 x Level x CON.
 * opts: guard, affinity, damageMult.
 */
export function hitsToKill(attacker, defender, skill = BASIC_ATTACK, hp, opts = {}) {
  const pool = hp ?? defender?.maxHp ?? BARS.HP_PER_CON_PER_LEVEL * defender.level * defender.stats.CON;
  const affinity = opts.affinity ?? affinityOf(defender, skill);
  if (affinity === 'null' || affinity === 'absorb') return Infinity;
  const perHit = damage(attacker, defender, skill, { guard: Boolean(opts.guard), affinity, damageMult: opts.damageMult ?? 1 });
  if (perHit <= 0) return Infinity;
  return Math.max(1, Math.ceil(pool / perHit));
}
