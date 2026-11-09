// Body-part binds: the chance to land one, how long it lasts, what it seals, and how it comes off.
// Owner: Systems Designer. Pure functions, no state, browser-safe. Nothing here mutates a combatant.
// What a bound part does to attributes is already in stats.effectiveStat (head: INT and WIL, arms: STR,
// legs: AGI, each halved once). This file is everything else. Reasoning: blueprint/03_psych_status.md.
import { BIND_PARTS, CHECK_SLOPE, CRIT_DIVISOR, FUMBLE_FROM } from './constants.js';
import { clampPct, d100 } from './rng.js';
import { effectiveStat } from './stats.js';
import { BASIC_ATTACK } from './combat.js';

// ---------------------------------------------------------------- tunables

// Bind % = clamp( (base + SLOPE x (LCKa - LCKt) / (LCKa + LCKt) + bonus) x (1 - resist / 100) x WEAR ^ n , 5, 95 )
export const BIND_RULES = Object.freeze({
  SLOPE: CHECK_SLOPE, // the Luck contest, same shape as rng.contestPct: +20 at double Luck, -20 at half
  RESIST_MAX: 80, // bindResist is a percentage off the chance, per part, and never reaches immunity
  WEAR: 0.5, // every earlier contested bind on that part this battle halves the chance again
  DEFAULT_TURNS: 2,
  MAX_TURNS: 5,
  CRIT_TURNS: 1, // a bind roll at or under a tenth of its chance lasts this much longer
  BACKFIRE_TURNS: 1, // fumble a bind and you wear it yourself for this long
  TRUSSED_DAMAGE_MULT: 1.5, // all three parts bound at once: every hit on the target is multiplied by this
});

/** Skills no bind can seal. FOUNDATION ruling: the basic attack is never sealed. */
export const NEVER_SEALED = Object.freeze([BASIC_ATTACK.id]);

// ---------------------------------------------------------------- helpers

const EPS = 1e-9;
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

function assertPart(part) {
  if (!BIND_PARTS.includes(part)) throw new Error(`Unknown body part "${part}"`);
}

function clampTurns(turns) {
  return Math.max(0, Math.min(BIND_RULES.MAX_TURNS, Math.floor(num(turns))));
}

function bindsOf(combatant) {
  const out = {};
  for (const part of BIND_PARTS) out[part] = Math.max(0, Math.floor(num(combatant?.binds?.[part])));
  return out;
}

// ---------------------------------------------------------------- reading the state

/** Parts bound right now, in head, arms, legs order. */
export function boundParts(combatant) {
  const binds = bindsOf(combatant);
  return BIND_PARTS.filter((part) => binds[part] > 0);
}

export function isBound(combatant, part) {
  return boundParts(combatant).includes(part);
}

/** Head, arms and legs all bound at once. */
export function isTrussed(combatant) {
  return boundParts(combatant).length === BIND_PARTS.length;
}

/** damageMult for any attack against this target: 1.5 while it is Trussed, otherwise 1. */
export function trussedDamageMult(target) {
  return isTrussed(target) ? BIND_RULES.TRUSSED_DAMAGE_MULT : 1;
}

/**
 * Is this skill sealed by a bound part? The basic attack never is. A skill with part 'none' (or none at all)
 * never is. skill.part may be one part or a list; any bound part on the list seals it.
 */
export function isSealed(combatant, skill) {
  return sealedBy(combatant, skill) !== null;
}

/** The bound part that seals this skill, or null. */
export function sealedBy(combatant, skill) {
  if (!skill || NEVER_SEALED.includes(skill.id)) return null;
  const parts = Array.isArray(skill.part) ? skill.part : [skill.part];
  const bound = boundParts(combatant);
  return parts.find((part) => bound.includes(part)) ?? null;
}

/** The skills on a list this combatant can still use. */
export function usableSkills(combatant, skills = []) {
  return skills.filter((skill) => !isSealed(combatant, skill));
}

/** Running from a battle is a legs action. */
export function canFlee(combatant) {
  return !isBound(combatant, 'legs');
}

/**
 * A combatant's standing resistance to binds on one part: 0..80, a percentage off the chance.
 * Read from combatant.bindResist, or flags.bindResist (makeCombatant keeps flags). Either may be one number
 * for every part or { head, arms, legs }.
 */
export function bindResistOf(target, part) {
  const raw = target?.bindResist ?? target?.flags?.bindResist;
  const value = typeof raw === 'number' ? raw : raw?.[part];
  return Math.max(0, Math.min(BIND_RULES.RESIST_MAX, num(value)));
}

/** How many contested binds have already landed on this part this battle. Kept in flags.bindCount. */
export function timesBound(combatant, part) {
  return Math.max(0, Math.floor(num(combatant?.flags?.bindCount?.[part])));
}

// ---------------------------------------------------------------- the chance

/**
 * The bind chance with its working shown: { base, swing, bonus, raw, resist, timesBound, wear, pct }.
 * Luck against Luck, both effective. No attacker (a trap, the scenery) means no swing.
 * opts: bonus (flat points from a passive, added before the scaling), ignoreResist, ignoreWear,
 *       floor / cap (move the 5..95 window).
 */
export function bindOdds(attacker, target, part, baseChance, opts = {}) {
  assertPart(part);
  const base = num(baseChance);
  let swing = 0;
  if (attacker) {
    const mine = effectiveStat(attacker, 'LCK');
    const theirs = effectiveStat(target, 'LCK');
    swing = (BIND_RULES.SLOPE * (mine - theirs)) / (mine + theirs);
  }
  const bonus = num(opts.bonus);
  const raw = Math.max(0, base + swing + bonus);
  const resist = opts.ignoreResist ? 0 : bindResistOf(target, part);
  const count = opts.ignoreWear ? 0 : timesBound(target, part);
  const wear = BIND_RULES.WEAR ** count;
  // Multiply everything, round once at the end. EPS keeps an exact half (55 x 0.7 = 38.5) rounding up despite float noise.
  const pct = clampPct((raw * (100 - resist) * wear) / 100 + EPS, opts.floor ?? undefined, opts.cap ?? undefined);
  return { base, swing, bonus, raw, resist, timesBound: count, wear, pct };
}

/** Chance, 5..95, that a bind with this base chance takes on this part of this target. */
export function bindChance(attacker, target, part, baseChance, opts = {}) {
  return bindOdds(attacker, target, part, baseChance, opts).pct;
}

// ---------------------------------------------------------------- applying, ticking, curing

/**
 * Bind a part with no contest: self-binds from fumbles, events, scripted moves.
 * A bind on a part that is already bound refreshes it to the longer of the two durations. It never stacks.
 * opts.ownTurn: the bind landed during the target's own turn (a befuddled fumble), so that turn's tick skips it.
 * opts.count:   count it toward accumulating resistance (tryBind does; accidents do not).
 * Turns are whole, capped at 5. Zero or fewer turns changes nothing. Returns the new combatant.
 */
export function applyBind(combatant, part, turns = BIND_RULES.DEFAULT_TURNS, opts = {}) {
  assertPart(part);
  const binds = bindsOf(combatant);
  const flags = { ...(combatant?.flags ?? {}) };
  const lasting = clampTurns(turns);
  if (lasting > binds[part]) {
    binds[part] = lasting;
    if (opts.ownTurn) flags.bindFresh = { ...(flags.bindFresh ?? {}), [part]: true };
  }
  if (opts.count && lasting > 0) flags.bindCount = { ...(flags.bindCount ?? {}), [part]: timesBound(combatant, part) + 1 };
  return { ...combatant, binds, flags };
}

/**
 * Try to bind a part: one d100 against bindChance. Low is good.
 *   success  roll at or under the chance. The part is bound and the target's resistance there goes up a step.
 *   crit     roll at or under a tenth of the chance: the bind lasts one turn longer (still capped at 5).
 *   fumble   roll of 96 or more: always a failure. A binder who rolled their own die wears the bind for 1 turn.
 * opts: everything bindOdds takes, plus
 *   roll       read this d100 instead of rolling: a bind riding on an attack is read off the attack's own roll
 *   fumbleFrom first roll that fumbles (default 96)
 *   backfire   force the self-bind on or off (default: on when this call rolled the die, off when it was handed a roll)
 *   ownTurn    passed through to applyBind
 * Returns { pct, roll, success, crit, fumble, backfire, turns, combatant, attacker }.
 * combatant is the target afterwards; attacker is the binder afterwards (changed only by a backfire).
 */
export function tryBind(attacker, target, part, baseChance, turns = BIND_RULES.DEFAULT_TURNS, rng, opts = {}) {
  const pct = bindChance(attacker, target, part, baseChance, opts);
  const handed = Number.isFinite(opts.roll);
  const roll = handed ? opts.roll : d100(rng);
  const fumbleFrom = Math.max(2, Math.min(101, Math.round(num(opts.fumbleFrom, FUMBLE_FROM))));
  const fumble = roll >= fumbleFrom;
  const success = !fumble && roll <= pct;
  const crit = success && roll <= Math.max(1, Math.floor(pct / CRIT_DIVISOR));
  const lasting = success ? clampTurns(clampTurns(turns) + (crit ? BIND_RULES.CRIT_TURNS : 0)) : 0;
  // A failed attempt still hands back a fresh copy (applyBind with 0 turns changes nothing).
  const combatant = success ? applyBind(target, part, lasting, { ownTurn: opts.ownTurn, count: true }) : applyBind(target, part, 0);
  const backfire = fumble && Boolean(attacker) && (opts.backfire ?? !handed);
  const binder = backfire ? applyBind(attacker, part, BIND_RULES.BACKFIRE_TURNS, { ownTurn: true }) : attacker;
  return { pct, roll, success, crit, fumble, backfire, turns: lasting, combatant, attacker: binder };
}

/**
 * Cross one turn off every bind. Call it at the end of the bound combatant's own turn.
 * A bind that landed during that same turn (ownTurn) is not crossed off until the end of the next one.
 * Returns the new combatant.
 */
export function tickBinds(combatant) {
  const binds = bindsOf(combatant);
  const flags = { ...(combatant?.flags ?? {}) };
  const fresh = { ...(flags.bindFresh ?? {}) };
  for (const part of BIND_PARTS) {
    if (binds[part] > 0 && !fresh[part]) binds[part] -= 1;
    delete fresh[part];
  }
  delete flags.bindFresh;
  return { ...combatant, binds, flags };
}

/**
 * Remove binds: every part, or the ones named (a part or a list of parts).
 * Resistance built up this battle stays. Returns the new combatant.
 */
export function cureBinds(combatant, parts = BIND_PARTS) {
  const list = Array.isArray(parts) ? parts : [parts];
  for (const part of list) assertPart(part);
  const binds = bindsOf(combatant);
  const flags = { ...(combatant?.flags ?? {}) };
  const fresh = { ...(flags.bindFresh ?? {}) };
  for (const part of list) {
    binds[part] = 0;
    delete fresh[part];
  }
  if (Object.keys(fresh).length > 0) flags.bindFresh = fresh;
  else delete flags.bindFresh;
  return { ...combatant, binds, flags };
}

/**
 * The universal Struggle action: spend the turn, free one part. No roll.
 * With no part named it frees the one with the most turns left. Returns the new combatant.
 */
export function struggle(combatant, part) {
  const binds = bindsOf(combatant);
  const pick = part ?? boundParts(combatant).sort((a, b) => binds[b] - binds[a])[0];
  return pick ? cureBinds(combatant, pick) : { ...combatant, binds, flags: { ...(combatant?.flags ?? {}) } };
}

/** End of battle: every bind comes off and the resistance built up during the fight is forgotten. */
export function endBattleBinds(combatant) {
  const flags = { ...(combatant?.flags ?? {}) };
  delete flags.bindFresh;
  delete flags.bindCount;
  const binds = {};
  for (const part of BIND_PARTS) binds[part] = 0;
  return { ...combatant, binds, flags };
}
