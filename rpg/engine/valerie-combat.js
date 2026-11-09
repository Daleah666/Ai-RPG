// Valerie in a fight: her kit composed with the combat engine.
// valerie.js says where her band edges sit. combat.js rolls and does the arithmetic. This file joins them,
// so a caller resolves "an enemy swings at Valerie" or "Valerie acts" in one call and one d100.
import { d100 } from './rng.js';
import { SCALE } from './constants.js';
import { hitChance, damage, rollVariance, resolveAttack, stressTaken, BASIC_ATTACK } from './combat.js';
import { incomingOpts, readIncoming, befuddledPart, stanceEffects, canUseInBand, chaosWave, stressFilter, airheadOf } from './valerie.js';

export const EXTRA_SLIPPERY = 10; // Whoopsie Daisy: enemy hit ceiling drops this much more until her next turn
export const ANALYZED_HIT_BONUS = 20; // Wait, Look Closely
export const LIMIT_ON_BOUNCE = 10; // Main Character Energy for sending a shot back
export const LIMIT_ON_ENEMY_FUMBLE = 5; // and for an enemy tripping over itself

/**
 * An enemy attacks Valerie. One d100, read against her bands.
 * Returns what happened; nothing is mutated. The caller applies damage, reflection, the self-bind and Limit.
 *
 *   outcome   'crit' | 'hit' | 'bounce' | 'miss' | 'fumble'
 *   damage    to Valerie (crit or hit)
 *   reflected to the attacker (bounce): the shot's damage resolved against the attacker's own defense
 *   selfBind  body part the attacker binds on itself for 1 turn (fumble), else null
 */
export function enemyAttacksValerie(attacker, valerie, skill = BASIC_ATTACK, rng, { guarding = false } = {}) {
  const edges = incomingOpts(valerie, attacker, skill, { guarding });
  if (valerie.flags?.extraSlippery && !guarding) edges.hitCap = Math.max(SCALE.PCT_FLOOR, edges.hitCap - EXTRA_SLIPPERY);
  const { hitPct, critPct, fumbleFrom } = hitChance(attacker, valerie, skill, { hitCap: edges.hitCap, fumbleFrom: edges.fumbleFrom });
  const roll = d100(rng);
  const outcome = readIncoming(roll, { hitPct, critPct, fumbleFrom, bounce: edges.bounce });
  const result = { roll, outcome, hitPct, critPct, fumbleFrom, bounce: edges.bounce, damage: 0, reflected: 0, selfBind: null, limitGain: 0 };
  if (outcome === 'crit' || outcome === 'hit') {
    result.damage = damage(attacker, valerie, skill, { crit: outcome === 'crit', variance: rollVariance(rng), guard: guarding });
  } else if (outcome === 'bounce') {
    result.reflected = damage(attacker, attacker, skill, { variance: rollVariance(rng) });
    result.limitGain = LIMIT_ON_BOUNCE;
  } else if (outcome === 'fumble') {
    result.selfBind = befuddledPart(roll);
    result.limitGain = LIMIT_ON_ENEMY_FUMBLE;
  }
  return result;
}

/**
 * Valerie attacks in a stance. One d100.
 * Returns the combat result plus what the stance costs her and, on a fumble while winging it, the Chaos Wave.
 * Throws if the skill cannot be used in this stance or band, so a caller cannot skip the choice.
 */
export function valerieAttacks(valerie, target, skill = BASIC_ATTACK, stance, rng, opts = {}) {
  if (skill.stance && skill.stance !== stance) throw new Error(`${skill.name ?? skill.id} needs the "${skill.stance}" stance`);
  if (!canUseInBand(valerie, skill)) throw new Error(`${skill.name ?? skill.id} is sealed at Airhead ${airheadOf(valerie)}`);
  const fx = stanceEffects(valerie, stance);
  const attackOpts = { ...fx.opts, ...opts };
  if (target.flags?.analyzed) attackOpts.hitBonus = (attackOpts.hitBonus ?? 0) + ANALYZED_HIT_BONUS;
  const result = resolveAttack(valerie, target, skill, rng, attackOpts);
  return {
    ...result,
    stance,
    airheadDelta: fx.airheadDelta,
    stress: fx.stress,
    wave: result.outcome === 'fumble' ? chaosWave(valerie, result.roll, stance) : null,
  };
}

/**
 * A stress hit on Valerie, after her obliviousness and its price.
 * Returns { taken, allyRelief, airheadDelta, note }. taken is what to add to her bar.
 */
export function stressOnValerie(valerie, baseStress, source = 'general') {
  const filtered = stressFilter(valerie, baseStress, source);
  const taken = filtered.amount === 0 ? 0 : stressTaken(filtered.amount, valerie, { ignoreWill: filtered.ignoreWill });
  return { taken, allyRelief: filtered.allyRelief, airheadDelta: filtered.airheadDelta, note: filtered.note };
}
