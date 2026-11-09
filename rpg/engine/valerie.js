// Valerie's kit: two minds in one body.
//
// The player is an ordinary person who woke up inside Valerie, a knight whose accidents keep saving the day.
// The body's luck only works when the player stops steering it. One gauge carries that whole idea:
//
//   AIRHEAD 0 ........ 33 | 34 ........ 66 | 67 ........ 100
//           Lucid           Ditzy            Total Airhead
//           you drive       shared wheel     the body drives
//
// Every action is taken in a stance. WING IT pushes the gauge up, THINK IT THROUGH pulls it down.
// Her six accidental abilities all read the gauge, and none of them adds a roll: each one moves a band
// edge on a d100 that was going to be rolled anyway.
import { SCALE, FUMBLE_FROM } from './constants.js';
import { clampPct, contestPct, readRoll } from './rng.js';
import { effectiveStat, benchmarkStat, difficultyDc } from './stats.js';

export const AIRHEAD = Object.freeze({
  START: 60,
  LUCID_MAX: 33,
  DITZY_MAX: 66,
  WING_GAIN: 10, // Wing It: gauge up
  WING_RELIEF: 2, // Wing It: ignorance is bliss, stress down
  THINK_LOSS: 15, // Think It Through: gauge down
  THINK_STRESS: 4, // Think It Through: thinking in this head hurts (realization stress)
  THINK_HIT_BONUS: 15,
  THINK_CRIT_BONUS: 5,
  REALIZATION_DROP: 10, // being told what really happened knocks the gauge down
  GOOD_HERO_RESET: 50, // gauge after the ultimate ends
});

export const DODGE_PER_AIRHEAD = 0.4; // Unintentional Dodge: enemy hit ceiling drops to 55 at 100
export const BOUNCE_PER_AIRHEAD = 0.25; // Kinetic Deflection: up to 25 points of bounce band from the gauge
export const BOUNCE_LUCK_EDGE = 10; // plus up to 10 more from out-lucking the shooter
export const AURA_PER_AIRHEAD = 0.1; // Aura of Befuddlement: enemy fumble band grows to 86..100
export const WING_FUMBLE_PER_AIRHEAD = 0.2; // Her own fumble band while winging it grows to 76..100
export const IGNORANCE_ALLY_RELIEF = 3; // stress each ally sheds when she shrugs off something scary
export const RESOLVE_SHIFT = Object.freeze({ lucid: 0, ditzy: 5, airhead: 10 });
export const CHAOS = Object.freeze({ OFF_BALANCE_MULT: 0.75, OFF_BALANCE_TURNS: 2, LIMIT_GAIN: 15, JACKPOT_POWER: 4 });
export const POCKET = Object.freeze({ BASE_SLOTS: 3, LEVELS_PER_SLOT: 20, MISPLACE_BASE: 10, MISPLACE_PER_AIRHEAD: 0.25, FOUND_PER_AIRHEAD: 0.2 });

const clampGauge = (v) => Math.max(0, Math.min(SCALE.AIRHEAD_MAX, Math.round(v)));

/** The stored gauge. */
export function airheadOf(valerie) {
  return clampGauge(valerie.flags?.airhead ?? AIRHEAD.START);
}

/** The gauge her passives read. Her ultimate pins it at 100 without touching the stored value. */
export function passiveAirhead(valerie) {
  return (valerie.flags?.goodHeroTurns ?? 0) > 0 ? SCALE.AIRHEAD_MAX : airheadOf(valerie);
}

export function airheadBand(value) {
  if (value <= AIRHEAD.LUCID_MAX) return 'lucid';
  if (value <= AIRHEAD.DITZY_MAX) return 'ditzy';
  return 'airhead';
}

/** Returns a copy of her with the gauge moved. */
export function shiftAirhead(valerie, amount) {
  return { ...valerie, flags: { ...valerie.flags, airhead: clampGauge(airheadOf(valerie) + amount) } };
}

/**
 * What choosing a stance costs and gives, before the action itself resolves.
 * stance: 'wing' | 'think'
 */
export function stanceEffects(valerie, stance) {
  if (stance === 'think') {
    return {
      stance,
      airheadDelta: -AIRHEAD.THINK_LOSS,
      stress: { amount: AIRHEAD.THINK_STRESS, source: 'realization' },
      opts: { hitBonus: AIRHEAD.THINK_HIT_BONUS, critBonus: AIRHEAD.THINK_CRIT_BONUS, fumbleFrom: FUMBLE_FROM },
    };
  }
  if (stance === 'wing') {
    const gauge = passiveAirhead(valerie);
    return {
      stance,
      airheadDelta: AIRHEAD.WING_GAIN,
      stress: { amount: -AIRHEAD.WING_RELIEF, source: 'bliss' },
      opts: { fumbleFrom: FUMBLE_FROM - Math.floor(gauge * WING_FUMBLE_PER_AIRHEAD) },
    };
  }
  throw new Error(`Unknown stance "${stance}"`);
}

/** Can she use this skill right now? Skills may name the bands they work in: { "bands": ["lucid", "ditzy"] }. */
export function canUseInBand(valerie, skill) {
  if (!skill?.bands?.length) return true;
  return skill.bands.includes(airheadBand(airheadOf(valerie)));
}

/**
 * Band edges for an enemy attacking Valerie. Pass the result as opts to combat.rollAttack / hitChance,
 * then read the roll with readIncoming so the bounce band is honoured.
 *
 *   hitCap      Unintentional Dodge: she trips under the blow
 *   fumbleFrom  Aura of Befuddlement: they trip over their own feet
 *   bounce      Kinetic Deflection: the top of the hit band sends projectiles back
 *
 * guarding: a deliberate Guard is not an accident, so it switches Unintentional Dodge off for the turn.
 */
export function incomingOpts(valerie, attacker, skill, { guarding = false } = {}) {
  const gauge = passiveAirhead(valerie);
  const opts = {
    hitCap: guarding ? SCALE.PCT_CEIL : SCALE.PCT_CEIL - Math.floor(gauge * DODGE_PER_AIRHEAD),
    fumbleFrom: FUMBLE_FROM - Math.floor(gauge * AURA_PER_AIRHEAD),
    bounce: 0,
  };
  if (skill?.tags?.includes('projectile')) {
    const mine = effectiveStat(valerie, 'LCK');
    const theirs = effectiveStat(attacker, 'LCK');
    opts.bounce = Math.floor(gauge * BOUNCE_PER_AIRHEAD) + Math.floor((BOUNCE_LUCK_EDGE * mine) / (mine + theirs));
  }
  return opts;
}

/**
 * Read an enemy's attack roll against Valerie.
 * Same bands as readRoll, plus 'bounce': the top `bounce` points of the hit band reflect the shot.
 * The crit band is never eaten, so a truly great shot still lands.
 */
export function readIncoming(roll, { hitPct, critPct = 0, fumbleFrom = FUMBLE_FROM, bounce = 0 }) {
  const outcome = readRoll(roll, { pct: hitPct, critPct, fumbleFrom });
  if (outcome !== 'hit' || bounce <= 0) return outcome;
  const bounceFloor = Math.max(Math.min(critPct, hitPct), hitPct - bounce);
  return roll > bounceFloor ? 'bounce' : 'hit';
}

/** Which body part a befuddled enemy binds on itself. Read off the fumble roll: no extra dice. */
export function befuddledPart(roll) {
  return ['head', 'arms', 'legs'][roll % 3];
}

/**
 * Accidental Chaos Wave: what her own fumble does while winging it.
 * A fumble in Think stance is just a miss. A natural 100 is the jackpot.
 */
export function chaosWave(valerie, roll, stance) {
  if (stance !== 'wing') return null;
  const effects = [
    { kind: 'mod', target: 'all_enemies', stat: 'AGI', mult: CHAOS.OFF_BALANCE_MULT, turns: CHAOS.OFF_BALANCE_TURNS, source: 'val_chaos_wave' },
    { kind: 'status', target: 'all_enemies', id: 'guard_broken' },
    { kind: 'limit', target: 'self', amount: CHAOS.LIMIT_GAIN },
    { kind: 'contraption', target: 'field' },
  ];
  const jackpot = roll === 100;
  if (jackpot) effects.push({ kind: 'damage', target: 'all_enemies', stat: 'STR', power: CHAOS.JACKPOT_POWER, element: 'phys' });
  return { id: 'val_chaos_wave', jackpot, effects };
}

/**
 * Inspirational Ignorance, and its price.
 * Returns how a stress hit lands on her: { amount, ignoreWill, allyRelief, airheadDelta, note }.
 * Feed amount and ignoreWill to combat.stressTaken; apply allyRelief to every ally who saw it.
 */
export function stressFilter(valerie, baseStress, source = 'general') {
  const band = airheadBand(passiveAirhead(valerie));
  const out = { amount: baseStress, ignoreWill: false, allyRelief: 0, airheadDelta: 0, note: null };
  if (baseStress <= 0) return out;
  if (source === 'horror' || source === 'mental') {
    if (band !== 'lucid') {
      out.amount = 0;
      out.allyRelief = IGNORANCE_ALLY_RELIEF;
      out.note = 'She did not notice it was scary.';
    }
  } else if (source === 'realization') {
    out.ignoreWill = true;
    out.airheadDelta = -AIRHEAD.REALIZATION_DROP;
    out.note = 'You cannot out-stubborn the truth.';
  } else if (source === 'embarrassment') {
    if (band === 'airhead') {
      out.amount = 0;
      out.note = 'She did not notice it was embarrassing.';
    } else {
      out.amount = Math.round(baseStress * 1.5);
      out.note = 'She noticed.';
    }
  }
  return out;
}

/** Points of Virtue chance she lends an ally's Resolve Check while she is still standing. */
export function resolveShiftForAllies(valerie) {
  if ((valerie.hp ?? 1) <= 0) return 0;
  return RESOLVE_SHIFT[airheadBand(passiveAirhead(valerie))];
}

/** WIT: the player's own head. A trained mind for the level, fogged by the gauge. */
export function wit(level) {
  return benchmarkStat(level);
}

/**
 * Chance for an out-of-combat check in a stance.
 * Wing It rolls her LUCK and the gauge helps. Think It Through rolls the player's WIT and the gauge hurts.
 */
export function stancePct(valerie, stance, dc, bonus = 0) {
  const gauge = airheadOf(valerie);
  const sway = Math.floor(gauge / 5);
  if (stance === 'think') return contestPct(wit(valerie.level), dc, bonus - sway);
  return contestPct(effectiveStat(valerie, 'LCK'), dc, bonus + sway);
}

/** Pocket Dimension: how many items can be Missing at once. */
export function pocketSlots(level) {
  return POCKET.BASE_SLOTS + Math.floor(level / POCKET.LEVELS_PER_SLOT);
}

/** Chance that one consumable wanders off after a battle. */
export function misplacePct(valerie) {
  return clampPct(POCKET.MISPLACE_BASE + airheadOf(valerie) * POCKET.MISPLACE_PER_AIRHEAD);
}

/** Chance that a Missing item turns up at the moment it is needed (once per battle or scene). */
export function foundPct(valerie) {
  const bonus = Math.floor(airheadOf(valerie) * POCKET.FOUND_PER_AIRHEAD);
  return contestPct(effectiveStat(valerie, 'LCK'), difficultyDc(valerie.level, 'normal'), bonus);
}
