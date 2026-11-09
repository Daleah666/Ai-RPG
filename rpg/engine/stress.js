// Stress, the Resolve Check, Afflictions, Virtues, permanent marks and the Breakdown.
// Owner: Systems Designer. Pure functions, no state, browser-safe. Nothing here mutates a combatant:
// every function that changes one hands back a new one. The tables (data/afflictions.json and
// data/virtues.json) are passed in as arguments. The reasoning is in blueprint/03_psych_status.md.
//
// The one rule to remember: one d100 answers the whole Resolve Check.
//   band of the roll   -> which side, and which entry on that side
//   an even roll       -> the character's personal entry, if they have one
//   doubles (11..99, 100) -> permanent: the result leaves a mark when it ends
import { SCALE, RESOLVE, FUMBLE_FROM, STAT_KEYS } from './constants.js';
import { clampPct, d100 } from './rng.js';
import { benchmarkStat } from './stats.js';
import { stressTaken, STRESS_K } from './combat.js';

// ---------------------------------------------------------------- tunables

export const STRESS = Object.freeze({
  MIN: SCALE.STRESS_MIN,
  RESOLVE_AT: SCALE.STRESS_BREAK, // reaching this from below, with no Affliction or Virtue, fires the Resolve Check
  MAX: SCALE.STRESS_MAX, // reaching this is a Breakdown
  CALM_BELOW: 50, // relief that takes an afflicted character under this ends the Affliction
  SNAP_OUT_TO: 90, // a snap-out cure ends the state and leaves stress no higher than this
});

/** What one hit of each tier lands on a character whose WIL sits on the benchmark line, at any level. */
export const STRESS_TIERS = Object.freeze({ weak: 5, medium: 12, severe: 24 });

/** Source tags a stress hit can carry. Rules key on them (the hero's kit, Afflictions, Scars). */
export const STRESS_SOURCE_TAGS = Object.freeze(['general', 'horror', 'mental', 'realization', 'embarrassment', 'wound', 'death']);

/**
 * The standard stress sources. `tier` is turned into a base value by stressBase(tier, level), then WIL mitigates it.
 * `who` says who takes it. Stress the party gives itself (an ally cracking, a Breakdown) is flat and is not in this
 * list: it comes from the entry that caused it and ignores WIL.
 */
export const STRESS_SOURCES = Object.freeze([
  { id: 'crit_taken', tier: 'weak', source: 'wound', who: 'target', text: 'Takes a critical hit.' },
  { id: 'brink', tier: 'medium', source: 'wound', who: 'self', text: 'HP falls under a quarter. Once per battle each.' },
  { id: 'ally_down', tier: 'medium', source: 'death', who: 'allies', text: 'An ally is knocked out.' },
  { id: 'downed', tier: 'medium', source: 'death', who: 'self', text: 'Was knocked out. Lands when they are back on their feet.' },
  { id: 'fumble', tier: 'weak', source: 'embarrassment', who: 'self', text: 'Fumbles their own roll.' },
  { id: 'ambushed', tier: 'weak', source: 'general', who: 'party', text: 'The party is ambushed or springs a trap.' },
  { id: 'fled', tier: 'weak', source: 'embarrassment', who: 'party', text: 'The party runs from a battle.' },
  { id: 'long_haul', tier: 'weak', source: 'general', who: 'party', text: 'Each battle after the third in a row with no camp or inn.' },
  { id: 'jeer', tier: 'weak', source: 'mental', who: 'target', text: 'An enemy taunt, jeer or unsettling stare.' },
  { id: 'dread', tier: 'medium', source: 'horror', who: 'target', text: 'An enemy howl, curse or nightmare.' },
  { id: 'set_piece', tier: 'severe', source: 'horror', who: 'party', text: 'A set-piece horror that carries no stress number of its own: the lich unmasks, the floor turns out to be a mouth.' },
  { id: 'the_truth', tier: 'medium', source: 'realization', who: 'target', text: 'Someone explains what really just happened.' },
].map(Object.freeze));

/** Flat stress relief. Relief is never reduced by WIL and never scales with level. */
export const RELIEF = Object.freeze({
  BREATHER: 8, // the universal action: your whole turn, yourself only. Deliberately weaker than anything paid for
  CRIT: 3, // landing a critical hit
  VICTORY: 5, // everyone, after a won battle
  BOSS_VICTORY: 15, // everyone, after beating a boss
  COMFORT: 15, // guide for a single-target relief skill
  RALLY: 5, // guide for a party-wide relief skill
  UNWIND: 30, // camp: instead of Sleep
  INN: 25, // a night at an inn, on top of full HP and MP
});

/** Camp and town. `fights` and `levelShare` are priced with progression.js priceForFights / priceAt. */
export const SERVICES = Object.freeze({
  camp: Object.freeze({ cost: { item: 'camp kit', fights: 1 }, choices: ['sleep', 'unwind'], sleepPct: 50, unwind: RELIEF.UNWIND }),
  inn: Object.freeze({ cost: { fights: 0.5, per: 'head' }, relief: RELIEF.INN }),
  night_off: Object.freeze({ cost: { fights: 2, per: 'head' }, stressTo: 0, endsAffliction: true }),
  talk_it_out: Object.freeze({ cost: { levelShare: 1, per: 'scar' }, removesScar: true }),
});

export const RESOLVE_RULES = Object.freeze({
  VIRTUE_PCT: RESOLVE.VIRTUE_PCT,
  SHIFT_CAP: RESOLVE.SHIFT_CAP,
  VIRTUE_SELF_RELIEF: 40, // default selfStress for a Virtue that does not name one
  ALLY_VIRTUE_SHIFT: 5, // each ally currently in a Virtue
  ALLY_AFFLICTION_SHIFT: -5, // each ally currently Afflicted
  PARTY_SOURCE: 'mental', // tag on the stress a Resolve result hands the party
});

/** The turn check: does the Affliction act, does the Virtue flourish. */
export const ACT = Object.freeze({
  STEP_STRESS: 20, // every this much stress over 100 ...
  STEP_PCT: 5, // ... adds this to an Affliction's chance to act
  MELTDOWN_FROM: FUMBLE_FROM, // 96-100 on the turn check is always the Affliction's worst act
});

export const MARKS = Object.freeze({ SCAR_CAP: 3, LINING_CAP: 1 });

/** The Scar left by an Affliction that names none (a personal entry, usually), and by Bottling a Breakdown. */
export const GENERIC_SCAR = Object.freeze({
  id: 'aff_scar_frayed_nerves',
  kind: 'scar',
  name: 'Frayed Nerves',
  text: 'Takes 10% more stress from everything, for good.',
  effects: Object.freeze([Object.freeze({ kind: 'stressMult', mult: 1.1 })]),
});

/** The mark every Virtue leaves on doubles. Spend it to erase one Scar, or hold it and it cancels the next one. */
export const SILVER_LINING = Object.freeze({
  id: 'vir_mark_silver_lining',
  kind: 'lining',
  name: 'Silver Lining',
  text: 'Spend it to erase one Scar, or keep it: it cancels the next Scar they would gain.',
  effects: Object.freeze([]),
});

export const BREAKDOWN = Object.freeze({
  CHOICES: Object.freeze(['storm_off', 'have_it_out', 'bottle_it']),
  STORM_STRESS: 50, // stress after walking it off
  STAY_STRESS: 80, // stress after either way of staying in the fight
  PARTY_STRESS: 20, // Have It Out: what every ally takes, flat
  PER_BATTLE: 1, // a second Breakdown in the same battle is not a choice: they Storm Off
});

/**
 * Enemies have no Resolve table and make no choices. Their bar has two rungs, named by the statuses in
 * data/skills.json: Rattled at 100 and Routed at 200. Keep these numbers and those status texts in step.
 */
export const ENEMY_STRESS = Object.freeze({
  RATTLED_HIT_BONUS: -10, // a Rattled enemy's attacks
  RATTLED_FUMBLE_SHIFT: -5, // and its fumble band: 91-100
  ROUT_RUNS: Object.freeze(['minion', 'standard']), // these ranks run at 200 and count as defeated
  ROUT_RESET: 100, // anything bigger loses its next action and drops back to this
});

// ---------------------------------------------------------------- helpers

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const nonNeg = (v, fallback = 1) => Math.max(0, num(v, fallback));
const clone = (v) => (v === undefined || v === null ? v ?? null : JSON.parse(JSON.stringify(v)));

/** Whole number in 0..200. */
export function clampStress(v) {
  return Math.max(STRESS.MIN, Math.min(STRESS.MAX, Math.round(num(v))));
}

/** 'calm' 0-49, 'strained' 50-99, 'cracking' 100-199, 'breakdown' 200. For display. */
export function stressBand(stress) {
  const s = clampStress(stress);
  if (s >= STRESS.MAX) return 'breakdown';
  if (s >= STRESS.RESOLVE_AT) return 'cracking';
  if (s >= STRESS.CALM_BELOW) return 'strained';
  return 'calm';
}

/**
 * Base stress for a tier at a level: the number to write on a skill or event so that it lands
 * STRESS_TIERS[tier] on a character whose WIL sits on the benchmark line. 5 / 12 / 24 at level 1, 10 / 24 / 48 at 100.
 */
export function stressBase(tier, level) {
  const lands = STRESS_TIERS[tier];
  if (lands === undefined) throw new Error(`Unknown stress tier "${tier}"`);
  return Math.round(lands * (1 + benchmarkStat(level) / STRESS_K));
}

/** A standard source at a level: { id, tier, source, who, base }. Feed base and source to applyStress. */
export function stressFor(id, level) {
  const entry = STRESS_SOURCES.find((s) => s.id === id);
  if (!entry) throw new Error(`Unknown stress source "${id}"`);
  return { id: entry.id, tier: entry.tier, source: entry.source, who: entry.who, base: stressBase(entry.tier, level) };
}

// ---------------------------------------------------------------- what a state does

/** Permanent marks on the sheet: [{ id, kind: 'scar' | 'lining', name, text, effects }]. Kept in flags.marks. */
export function marksOf(combatant) {
  return Array.isArray(combatant?.flags?.marks) ? combatant.flags.marks : [];
}

/** Every machine-readable effect now in force: the current Affliction or Virtue, then the marks. */
export function activeEffects(combatant) {
  const out = [...(combatant?.resolve?.effects ?? [])];
  for (const mark of marksOf(combatant)) out.push(...(mark.effects ?? []));
  return out;
}

export function effectsOf(combatant, kind) {
  return activeEffects(combatant).filter((e) => e?.kind === kind);
}

/** Multiplier on stress gained from a source: every stressMult effect with no source, or with this one. */
export function stressMultFor(combatant, source = 'general') {
  let mult = 1;
  for (const e of effectsOf(combatant, 'stressMult')) {
    const hit = e.source === undefined || e.source === source || (Array.isArray(e.source) && e.source.includes(source));
    if (hit) mult *= nonNeg(e.mult);
  }
  return mult;
}

/** Multiplier on stress relief received. */
export function reliefMultFor(combatant) {
  let mult = 1;
  for (const e of effectsOf(combatant, 'reliefMult')) mult *= nonNeg(e.mult);
  return mult;
}

const WHEN = { ally_below_25: (ctx) => Boolean(ctx.allyBelow25) };

/**
 * Will this character refuse to do, or to accept, something right now?
 * Receiving from allies: 'heal', 'buff', 'relief', 'item'.
 * Doing: 'guard', 'breather', 'attack', 'ally_item', 'ally_skill', 'switch_target'.
 * Standing refusals come from the state; a mood set by actOutCheck adds more until their next turn.
 * ctx carries what a conditional refusal needs: { allyBelow25 }.
 */
export function refuses(combatant, what, ctx = {}) {
  for (const e of combatant?.resolve?.effects ?? []) {
    if (e?.kind !== 'refuse' || e.what !== what) continue;
    if (!e.when || (WHEN[e.when] ?? (() => false))(ctx)) return true;
  }
  return (combatant?.flags?.mood?.refuses ?? []).includes(what);
}

/**
 * Who this character is shielding right now ('weakest_ally'), or null. Single-target attacks at that ally hit them.
 * Bound legs stop it, the same as the Covered status.
 */
export function covers(combatant) {
  if ((combatant?.binds?.legs ?? 0) > 0) return null; // nobody steps in front of anything on bound legs
  const standing = (combatant?.resolve?.effects ?? []).find((e) => e?.kind === 'cover');
  return standing?.who ?? combatant?.flags?.mood?.cover ?? null;
}

/**
 * Fold a state's band-edge moves into the opts for this character's own attack roll.
 * Bonuses add, damageMult multiplies, the fumble edge shifts (or switches off), the higher hit floor wins.
 * Pass the result to combat.resolveAttack. The caller's own opts (a stance, a skill) go in as `opts`.
 */
export function withStateOpts(combatant, opts = {}) {
  const moves = effectsOf(combatant, 'attack');
  const mood = combatant?.flags?.mood?.attack;
  if (mood) moves.push(mood);
  const out = { ...opts };
  let fumbleShift = 0;
  let noFumble = false;
  for (const m of moves) {
    if (m.hitBonus) out.hitBonus = num(out.hitBonus) + m.hitBonus;
    if (m.critBonus) out.critBonus = num(out.critBonus) + m.critBonus;
    if (Number.isFinite(m.damageMult)) out.damageMult = num(out.damageMult, 1) * m.damageMult;
    if (Number.isFinite(m.hitFloor)) out.hitFloor = Math.max(num(out.hitFloor, SCALE.PCT_FLOOR), m.hitFloor);
    if (m.fumbleShift) fumbleShift += m.fumbleShift;
    if (m.noFumble) noFumble = true;
  }
  if (noFumble) out.fumbleFrom = 101;
  else if (fumbleShift) out.fumbleFrom = num(out.fumbleFrom, FUMBLE_FROM) + fumbleShift;
  return out;
}

/**
 * Scars that waste the first heal or buff an ally aims at this character each battle.
 * Returns { refused, combatant }: when refused is true the help is lost and the scar is used up until endBattle.
 */
export function consumeFirstRefusal(combatant, what) {
  const scarred = effectsOf(combatant, 'refuseFirst').some((e) => e.what === what);
  const used = Boolean(combatant?.flags?.refusedFirst?.[what]);
  if (!scarred || used) return { refused: false, combatant: { ...combatant } };
  const flags = { ...(combatant.flags ?? {}), refusedFirst: { ...(combatant.flags?.refusedFirst ?? {}), [what]: true } };
  return { refused: true, combatant: { ...combatant, flags } };
}

// ---------------------------------------------------------------- the bar

/**
 * Add an amount that has already been mitigated to the bar, clamp, and report what it set off.
 * event: 'breakdown' when the bar reaches 200; 'resolve' when it reaches 100 from below and the character
 * has no Affliction or Virtue; otherwise null. Breakdown outranks the Resolve Check.
 */
export function addStress(combatant, amount) {
  const before = clampStress(combatant?.stress);
  const taken = Math.round(num(amount));
  const after = clampStress(before + taken);
  let event = null;
  if (after >= STRESS.MAX && before < STRESS.MAX) event = 'breakdown';
  else if (before < STRESS.RESOLVE_AT && after >= STRESS.RESOLVE_AT && !combatant?.resolve) event = 'resolve';
  return { combatant: { ...combatant, stress: after }, taken, before, after, event };
}

/**
 * A stress hit of baseStress from the world: effective WIL mitigates it (combat.stressTaken), the current
 * state and marks scale it, the bar clamps to 0..200.
 * opts: source (a STRESS_SOURCE_TAGS tag, default 'general'), ignoreWill, mult (scales gains).
 * A negative base is relief and goes through relieveStress. Returns { combatant, taken, before, after, event }.
 */
export function applyStress(combatant, baseStress, opts = {}) {
  const { source = 'general', ignoreWill = false, mult = 1 } = opts;
  const base = num(baseStress);
  if (base < 0) {
    const r = relieveStress(combatant, -base, { from: opts.from ?? 'other' });
    return { combatant: r.combatant, taken: -r.relieved, before: r.before, after: r.after, event: null, source, calmed: r.calmed };
  }
  const scale = nonNeg(mult) * stressMultFor(combatant, source);
  const taken = base === 0 || scale <= 0 ? 0 : stressTaken(base, combatant, { ignoreWill, mult: scale });
  return { ...addStress(combatant, taken), source, calmed: false };
}

/**
 * Take stress off the bar. amount is the points asked for; the state and marks may scale it.
 * opts.from: 'ally' (default), 'self', 'rest' or 'other'. Only help from an ally can be refused.
 * An Affliction ends the moment relief takes its owner under 50.
 * Returns { combatant, relieved, before, after, refused, calmed, ended, mark }.
 */
export function relieveStress(combatant, amount, opts = {}) {
  const { from = 'ally', drop } = opts;
  const before = clampStress(combatant?.stress);
  const asked = Math.max(0, num(amount));
  const same = { combatant: { ...combatant, stress: before }, relieved: 0, before, after: before, refused: false, calmed: false, ended: null, mark: null };
  if (asked === 0) return same;
  if (from === 'ally' && refuses(combatant, 'relief')) return { ...same, refused: true };
  const mult = reliefMultFor(combatant);
  const scaled = mult <= 0 ? 0 : Math.max(1, Math.round(asked * mult));
  const after = clampStress(before - scaled);
  let next = { ...combatant, stress: after };
  let calmed = false;
  let ended = null;
  let mark = null;
  if (next.resolve?.kind === 'affliction' && after < STRESS.CALM_BELOW) {
    const cleared = clearResolve(next, { drop });
    next = cleared.combatant;
    calmed = true;
    ended = cleared.ended;
    mark = cleared.mark;
  }
  return { combatant: next, relieved: before - after, before, after, refused: false, calmed, ended, mark };
}

/** The universal action: the whole turn, yourself only. Returns the relieveStress result. */
export function breather(combatant) {
  if (refuses(combatant, 'breather')) return { ...relieveStress(combatant, 0), refused: true };
  return relieveStress(combatant, RELIEF.BREATHER, { from: 'self' });
}

// ---------------------------------------------------------------- the Resolve Check

/** A shift, rounded and held to the cap either way. */
export function clampShift(shift) {
  return Math.max(-RESOLVE.SHIFT_CAP, Math.min(RESOLVE.SHIFT_CAP, Math.round(num(shift))));
}

/** The Virtue chance after a shift: 25 at rest, 10 to 40. */
export function resolveVirtuePct(virtueShift = 0) {
  return clampPct(RESOLVE.VIRTUE_PCT + clampShift(virtueShift));
}

/** Doubles: both dice of the d100 match. 11, 22 ... 99, and 100 read as 00. Ten rolls in a hundred. */
export function isDoubles(roll) {
  return roll === 100 || (roll >= 11 && roll <= 99 && roll % 11 === 0);
}

function listOf(tables, key) {
  const raw = tables?.[key];
  const list = Array.isArray(raw) ? raw : raw?.[key];
  if (!Array.isArray(list) || list.length === 0) throw new Error(`Resolve tables: "${key}" is missing or empty`);
  return [...list].sort((a, b) => a.range[0] - b.range[0]);
}

// One side of the die, stretched or squeezed to fill (start, start + total]. Entries keep their order and their
// share: upper edge = start + round(cumulative base width x total / base total). Every entry keeps at least 1.
function layoutSide(entries, kind, start, total) {
  const widths = entries.map((e) => Math.max(1, e.range[1] - e.range[0] + 1));
  const baseTotal = widths.reduce((sum, w) => sum + w, 0);
  const last = entries.length - 1;
  let cumulative = 0;
  let previous = start;
  return entries.map((entry, i) => {
    cumulative += widths[i];
    const ideal = i === last ? start + total : start + Math.round((cumulative * total) / baseTotal);
    const hi = Math.max(previous + 1, Math.min(ideal, start + total - (last - i)));
    const band = { lo: previous + 1, hi, kind, id: entry.id, name: entry.name, entry, doubles: [] };
    for (let roll = band.lo; roll <= band.hi; roll++) if (isDoubles(roll)) band.doubles.push(roll);
    previous = hi;
    return band;
  });
}

/**
 * The whole 1-100 layout after a shift, low to high: Virtues first, then Afflictions.
 * Each band: { lo, hi, kind: 'virtue' | 'affliction', id, name, entry, doubles: [rolls in the band that are permanent] }.
 * tables: { afflictions, virtues }, each either the list or the parsed JSON file.
 */
export function resolveBands(tables, virtueShift = 0) {
  const virtuePct = resolveVirtuePct(virtueShift);
  return [
    ...layoutSide(listOf(tables, 'virtues'), 'virtue', 0, virtuePct),
    ...layoutSide(listOf(tables, 'afflictions'), 'affliction', virtuePct, 100 - virtuePct),
  ];
}

/** Check the two tables against the rules. Returns { ok, errors }. Never throws on bad data. */
export function validateResolveTables(tables) {
  const errors = [];
  const seen = new Set();
  const sides = [
    ['virtues', 'virtue', 'vir_', 1, RESOLVE.VIRTUE_PCT],
    ['afflictions', 'affliction', 'aff_', RESOLVE.VIRTUE_PCT + 1, 100],
  ];
  for (const [key, kind, prefix, from, to] of sides) {
    let list;
    try {
      list = listOf(tables, key);
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    let next = from;
    for (const e of list) {
      const at = `${kind} ${e?.id ?? '(no id)'}`;
      if (typeof e?.id !== 'string' || !e.id.startsWith(prefix)) errors.push(`${at}: id must start with "${prefix}"`);
      else if (seen.has(e.id)) errors.push(`${at}: duplicate id`);
      else seen.add(e.id);
      for (const field of ['name', 'text', 'want', 'cost']) {
        if (typeof e?.[field] !== 'string' || !e[field].trim()) errors.push(`${at}: needs ${field}`);
      }
      const [lo, hi] = Array.isArray(e?.range) ? e.range : [];
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) errors.push(`${at}: needs range [lo, hi]`);
      else {
        if (lo !== next) errors.push(`${at}: starts at ${lo} but the table is filled up to ${next - 1}`);
        next = hi + 1;
      }
      if (!Array.isArray(e?.effects) || e.effects.length === 0) errors.push(`${at}: needs effects`);
      for (const fx of e?.effects ?? []) {
        if (typeof fx?.kind !== 'string') errors.push(`${at}: an effect has no kind`);
        if (fx?.kind === 'mod' && (!STAT_KEYS.includes(fx.stat) || !(fx.mult > 0))) errors.push(`${at}: mod needs a stat and a positive mult`);
      }
      const chance = kind === 'virtue' ? e?.behavior?.inspire : e?.behavior?.actOut;
      if (!(chance >= SCALE.PCT_FLOOR && chance <= SCALE.PCT_CEIL)) errors.push(`${at}: behavior needs a chance of 5 to 95`);
      if (typeof e?.behavior?.act?.text !== 'string') errors.push(`${at}: behavior.act needs text`);
      if (kind === 'affliction' && typeof e?.behavior?.meltdown?.text !== 'string') errors.push(`${at}: behavior.meltdown needs text`);
      if (!Number.isFinite(e?.onStart?.partyStress)) errors.push(`${at}: onStart.partyStress must be a number`);
      else if (kind === 'virtue' ? e.onStart.partyStress > 0 : e.onStart.partyStress < 0) errors.push(`${at}: onStart.partyStress has the wrong sign`);
      if (kind === 'affliction' && (typeof e?.mark?.id !== 'string' || typeof e?.mark?.text !== 'string')) errors.push(`${at}: needs a mark (its Scar) with id and text`);
    }
    if (next !== to + 1) errors.push(`${kind} table ends at ${next - 1}, not ${to}`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Read a Resolve Check roll without touching anyone. One d100 in, everything out:
 * { roll, virtuePct, kind, entry, band, permanent, personal }.
 * personal: { affliction, virtue } replaces the table entry for its side when the roll is even.
 */
export function readResolveRoll(roll, { tables, virtueShift = 0, personal } = {}) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw new Error(`A Resolve Check needs a d100 roll, got "${roll}"`);
  const bands = resolveBands(tables, virtueShift);
  const band = bands.find((b) => roll >= b.lo && roll <= b.hi);
  const own = roll % 2 === 0 ? personal?.[band.kind] ?? null : null;
  return {
    roll,
    virtuePct: resolveVirtuePct(virtueShift),
    kind: band.kind,
    entry: own ?? band.entry,
    band: { lo: band.lo, hi: band.hi, id: band.id, name: band.name },
    permanent: isDoubles(roll),
    personal: Boolean(own),
  };
}

function withoutMood(flags = {}) {
  const next = { ...flags };
  delete next.mood;
  return next;
}

function markFor(kind, entry) {
  if (entry?.mark) return clone(entry.mark);
  return clone(kind === 'virtue' ? SILVER_LINING : GENERIC_SCAR);
}

/**
 * Put a character into an Affliction or Virtue. Used by resolveCheck and forceResolve.
 * Sets combatant.resolve, adds the entry's attribute mods (turns null, source = entry id), applies the entry's
 * own stress change and any instant heal. Returns { combatant, party, heal }.
 * party is null, or { stress, ignoreWill: true, source } for every other party member: positive is stress
 * (applyStress with those opts), negative is relief.
 */
export function startResolve(combatant, kind, entry, { permanent = false, personal = false, roll = null } = {}) {
  if (kind !== 'affliction' && kind !== 'virtue') throw new Error(`Unknown Resolve outcome "${kind}"`);
  if (!entry?.id) throw new Error('A Resolve entry needs an id');
  const old = combatant?.resolve;
  const mods = (combatant?.mods ?? []).filter((m) => !old || m.source !== old.id).map((m) => ({ ...m }));
  for (const fx of entry.effects ?? []) {
    if (fx?.kind === 'mod' && STAT_KEYS.includes(fx.stat) && fx.mult > 0) mods.push({ stat: fx.stat, mult: fx.mult, turns: null, source: entry.id });
  }
  const onStart = entry.onStart ?? {};
  const selfStress = num(onStart.selfStress, kind === 'virtue' ? -RESOLVE_RULES.VIRTUE_SELF_RELIEF : 0);
  const next = {
    ...combatant,
    stress: clampStress(clampStress(combatant?.stress) + selfStress),
    mods,
    flags: withoutMood(combatant?.flags),
    resolve: {
      kind,
      id: entry.id,
      name: entry.name ?? entry.id,
      turns: null,
      until: entry.until ?? (kind === 'virtue' ? 'battle' : 'calm'),
      permanent: Boolean(permanent),
      personal: Boolean(personal),
      roll,
      effects: clone(entry.effects ?? []),
      behavior: clone(entry.behavior ?? null),
      mark: markFor(kind, entry),
    },
  };
  let heal = 0;
  if (onStart.selfHealPct > 0 && Number.isFinite(next.hp) && Number.isFinite(next.maxHp)) {
    const hp = Math.min(next.maxHp, next.hp + Math.round((next.maxHp * onStart.selfHealPct) / 100));
    heal = hp - next.hp;
    next.hp = hp;
  }
  const partyStress = Math.round(num(onStart.partyStress));
  const party = partyStress === 0 ? null : { stress: partyStress, ignoreWill: true, source: RESOLVE_RULES.PARTY_SOURCE };
  return { combatant: next, party, heal };
}

/**
 * The Resolve Check. Uses the rng exactly once.
 * Returns { roll, virtuePct, kind, entry, band, permanent, personal, combatant, party, heal, mark }.
 * combatant has resolve set. mark is what the result will leave behind when it ends (null unless permanent).
 */
export function resolveCheck(combatant, rng, { tables, virtueShift = 0, personal } = {}) {
  const read = readResolveRoll(d100(rng), { tables, virtueShift, personal });
  const started = startResolve(combatant, read.kind, read.entry, read);
  return { ...read, ...started, mark: read.permanent ? clone(started.combatant.resolve.mark) : null };
}

/**
 * Force a side, for events and scripted beats: outcome 'affliction' | 'virtue'.
 * With id: that entry (from the table, or the personal entry). Without id: one d100 from rng is laid
 * across that side's own table, and the same roll still reads personal (even) and permanent (doubles).
 */
export function forceResolve(combatant, outcome, { tables, id, personal, rng } = {}) {
  if (outcome !== 'affliction' && outcome !== 'virtue') throw new Error(`Unknown Resolve outcome "${outcome}"`);
  const list = listOf(tables, outcome === 'virtue' ? 'virtues' : 'afflictions');
  const own = personal?.[outcome] ?? null;
  let entry;
  let roll = null;
  let isPersonal = false;
  if (id) {
    entry = list.find((e) => e.id === id) ?? (own?.id === id ? own : null);
    if (!entry) throw new Error(`"${id}" is not on the ${outcome} table`);
    isPersonal = entry === own;
  } else {
    if (typeof rng !== 'function') throw new Error('forceResolve needs an id or an rng');
    roll = d100(rng);
    const band = layoutSide(list, outcome, 0, 100).find((b) => roll >= b.lo && roll <= b.hi);
    isPersonal = roll % 2 === 0 && Boolean(own);
    entry = isPersonal ? own : band.entry;
  }
  const permanent = roll !== null && isDoubles(roll);
  const started = startResolve(combatant, outcome, entry, { permanent, personal: isPersonal, roll });
  return { roll, kind: outcome, entry, permanent, personal: isPersonal, ...started, mark: permanent ? clone(started.combatant.resolve.mark) : null };
}

/**
 * What the rest of the party lends to (or takes from) a Resolve Check.
 * +5 for each ally in a Virtue, -5 for each ally Afflicted, plus any resolveShift effect those states carry,
 * plus `extra` (the hero's resolveShiftForAllies, a rally skill). Knocked-out allies count for nothing.
 * The result is clamped to the cap; resolveCheck clamps again.
 */
export function partyResolveShift(allies = [], extra = 0) {
  let shift = num(extra);
  for (const ally of allies ?? []) {
    if (!ally?.resolve || (Number.isFinite(ally.hp) && ally.hp <= 0) || ally.flags?.stormedOff) continue;
    shift += ally.resolve.kind === 'virtue' ? RESOLVE_RULES.ALLY_VIRTUE_SHIFT : RESOLVE_RULES.ALLY_AFFLICTION_SHIFT;
    for (const e of ally.resolve.effects ?? []) if (e?.kind === 'resolveShift') shift += num(e.allies);
  }
  return clampShift(shift);
}

// ---------------------------------------------------------------- marks

function markKind(mark) {
  return mark?.kind ?? (String(mark?.id).startsWith('vir_') ? 'lining' : 'scar');
}

/**
 * Add a permanent mark. Returns { combatant, gained, cancelled, dropped, duplicate }.
 * A mark already on the sheet does nothing. A Scar gained while holding a Silver Lining cancels both.
 * A fourth Scar pushes one out: opts.drop names it, otherwise the oldest goes.
 */
export function gainMark(combatant, mark, { drop } = {}) {
  const kind = markKind(mark);
  let marks = marksOf(combatant).map((m) => ({ ...m }));
  const out = { combatant: null, gained: null, cancelled: false, dropped: null, duplicate: false };
  const done = () => ({ ...out, combatant: { ...combatant, flags: { ...(combatant?.flags ?? {}), marks } } });
  if (!mark?.id || marks.some((m) => m.id === mark.id)) return { ...done(), duplicate: true };
  if (kind === 'lining') {
    if (marks.filter((m) => markKind(m) === 'lining').length >= MARKS.LINING_CAP) return { ...done(), duplicate: true };
  } else {
    const lining = marks.find((m) => markKind(m) === 'lining');
    if (lining) {
      marks = marks.filter((m) => m !== lining);
      out.cancelled = true;
      return done();
    }
    const scars = marks.filter((m) => markKind(m) === 'scar');
    if (scars.length >= MARKS.SCAR_CAP) {
      out.dropped = scars.find((m) => m.id === drop) ?? scars[0];
      marks = marks.filter((m) => m !== out.dropped);
    }
  }
  out.gained = { ...clone(mark), kind };
  marks.push(out.gained);
  return done();
}

/** Take a mark off the sheet (Talk It Out, in town). Returns { combatant, removed }. */
export function removeMark(combatant, id) {
  const removed = marksOf(combatant).find((m) => m.id === id) ?? null;
  const marks = marksOf(combatant).filter((m) => m.id !== id).map((m) => ({ ...m }));
  return { combatant: { ...combatant, flags: { ...(combatant?.flags ?? {}), marks } }, removed };
}

/** Spend a held Silver Lining to erase one Scar. Returns { combatant, spent, removed }. */
export function spendSilverLining(combatant, scarId) {
  const marks = marksOf(combatant);
  const lining = marks.find((m) => markKind(m) === 'lining');
  const scar = marks.find((m) => m.id === scarId && markKind(m) === 'scar');
  if (!lining || !scar) return { combatant: { ...combatant }, spent: false, removed: null };
  const kept = marks.filter((m) => m !== lining && m !== scar).map((m) => ({ ...m }));
  return { combatant: { ...combatant, flags: { ...(combatant.flags ?? {}), marks: kept } }, spent: true, removed: scar };
}

// ---------------------------------------------------------------- ending a state

/**
 * End the current Affliction or Virtue: resolve becomes null, its attribute mods and mood go.
 * If the roll that started it was doubles, it leaves its mark now (opts.mark false skips that).
 * Stress is not touched: a character cleared at 100 or more makes no new check until they drop under 100 and cross it again.
 * Returns { combatant, ended, mark, cancelled, dropped }.
 */
export function clearResolve(combatant, { mark = true, drop } = {}) {
  const state = combatant?.resolve ?? null;
  const base = { combatant: { ...combatant }, ended: null, mark: null, cancelled: false, dropped: null };
  if (!state) return base;
  let next = {
    ...combatant,
    resolve: null,
    mods: (combatant.mods ?? []).filter((m) => m.source !== state.id).map((m) => ({ ...m })),
    flags: withoutMood(combatant.flags),
  };
  const out = { ...base, ended: state };
  if (mark && state.permanent && state.mark) {
    const gained = gainMark(next, state.mark, { drop });
    next = gained.combatant;
    out.mark = gained.gained;
    out.cancelled = gained.cancelled;
    out.dropped = gained.dropped;
  }
  return { ...out, combatant: next };
}

/**
 * The snap-out cure (smelling salts, a slap, a bucket of water): the state ends now and stress drops to 90
 * if it was higher. One bad moment later they cross 100 again and roll a new Resolve Check.
 * Returns the clearResolve result plus { before, after }.
 */
export function snapOut(combatant, opts = {}) {
  const before = clampStress(combatant?.stress);
  const cleared = clearResolve(combatant, opts);
  const after = Math.min(before, STRESS.SNAP_OUT_TO);
  return { ...cleared, combatant: { ...cleared.combatant, stress: after }, before, after };
}

// ---------------------------------------------------------------- the turn check

/**
 * Chance, this turn, that an Affliction acts (rising 5 for every 20 stress over 100) or a Virtue flourishes.
 * 0 when the character has no state or the state has no behavior: then no roll is made at all.
 */
export function actOutChance(combatant, { bonus = 0 } = {}) {
  const state = combatant?.resolve;
  const behavior = state?.behavior;
  if (!behavior) return 0;
  if (state.kind === 'virtue') return Number.isFinite(behavior.inspire) ? clampPct(behavior.inspire + num(bonus)) : 0;
  if (!Number.isFinite(behavior.actOut)) return 0;
  const over = Math.max(0, clampStress(combatant.stress) - STRESS.RESOLVE_AT);
  return clampPct(behavior.actOut + ACT.STEP_PCT * Math.floor(over / ACT.STEP_STRESS) + num(bonus));
}

/**
 * The turn check: one d100 at the start of an afflicted or virtuous character's turn. Low is good.
 * Affliction: 'composed' on a roll up to 100 - chance, 'act_out' above that, 'meltdown' on 96-100.
 * Virtue: 'flourish' on a roll up to the chance, otherwise 'steady'.
 * No state, or no behavior: outcome 'none', roll null, and the rng is not used.
 * The act that fired sets flags.mood until their next turn check (what they refuse, who they shield,
 * band edges for this turn's attack). "A target read off the dice" is pickByRoll(roll, list).
 * Returns { roll, pct, outcome, act, combatant }.
 */
export function actOutCheck(combatant, rng, opts = {}) {
  const pct = actOutChance(combatant, opts);
  const calm = { ...combatant, flags: withoutMood(combatant?.flags) };
  if (pct === 0) return { roll: null, pct: 0, outcome: 'none', act: null, combatant: calm };
  const { kind, behavior } = combatant.resolve;
  const roll = d100(rng);
  let outcome;
  let act = null;
  if (kind === 'virtue') {
    outcome = roll <= pct ? 'flourish' : 'steady';
    if (outcome === 'flourish') act = behavior.act ?? null;
  } else {
    const meltdownFrom = num(opts.fumbleFrom, ACT.MELTDOWN_FROM);
    outcome = roll >= meltdownFrom ? 'meltdown' : roll > 100 - pct ? 'act_out' : 'composed';
    if (outcome === 'meltdown') act = behavior.meltdown ?? behavior.act ?? null;
    else if (outcome === 'act_out') act = behavior.act ?? null;
  }
  if (!act) return { roll, pct, outcome, act: null, combatant: calm };
  const mood = {
    id: act.id ?? null,
    outcome,
    refuses: [...(act.refuses ?? [])],
    cover: act.action === 'cover' ? act.target ?? 'weakest_ally' : null,
    attack: act.attack ? { ...act.attack } : null,
  };
  return { roll, pct, outcome, act: clone(act), combatant: { ...calm, flags: { ...calm.flags, mood } } };
}

/** "Read off the dice": pick from a list with a roll already made. list[roll mod length], null for an empty list. */
export function pickByRoll(roll, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.abs(Math.round(num(roll))) % list.length];
}

// ---------------------------------------------------------------- Breakdown

// The Scar that Bottling It would cost: the Affliction's own, or Frayed Nerves, or null if both are already carried.
function bottleScar(combatant) {
  const carried = new Set(marksOf(combatant).map((m) => m.id));
  const own = combatant?.resolve?.kind === 'affliction' ? combatant.resolve.mark : null;
  if (own?.id && !carried.has(own.id)) return own;
  return carried.has(GENERIC_SCAR.id) ? null : GENERIC_SCAR;
}

/** The choices open at 200 stress. A second Breakdown in one battle leaves only 'storm_off'. */
export function breakdownChoices(combatant) {
  if (num(combatant?.flags?.breakdowns) >= BREAKDOWN.PER_BATTLE) return ['storm_off'];
  return bottleScar(combatant) ? [...BREAKDOWN.CHOICES] : ['storm_off', 'have_it_out'];
}

/**
 * A Breakdown: the bar hit 200 and someone has to pay. The player picks who.
 *   'storm_off'   the fight pays: they leave the battle (flags.stormedOff) and come back after it at stress 50.
 *   'have_it_out' the party pays: they stay at stress 80; every ally takes 20 stress that WIL cannot reduce.
 *   'bottle_it'   the character pays: they stay at stress 80 and take a Scar now (their Affliction's, else Frayed Nerves).
 * Every choice ends the current Affliction or Virtue. A choice that is not open falls back to 'storm_off' (forced: true).
 * Returns { combatant, choice, forced, out, party, mark, cancelled, dropped, ended }.
 */
export function breakdown(combatant, { choice = 'storm_off', drop } = {}) {
  if (!BREAKDOWN.CHOICES.includes(choice)) throw new Error(`Unknown Breakdown choice "${choice}"`);
  const forced = !breakdownChoices(combatant).includes(choice);
  const taken = forced ? 'storm_off' : choice;
  const scar = taken === 'bottle_it' ? bottleScar(combatant) : null;
  const ownScar = scar && combatant.resolve?.kind === 'affliction';
  const cleared = clearResolve(combatant, { mark: !ownScar, drop });
  let next = cleared.combatant;
  const out = { choice: taken, forced, out: false, party: null, mark: cleared.mark, cancelled: cleared.cancelled, dropped: cleared.dropped, ended: cleared.ended };
  const flags = { ...(next.flags ?? {}), breakdowns: num(combatant?.flags?.breakdowns) + 1 };
  if (taken === 'storm_off') {
    flags.stormedOff = true;
    next = { ...next, stress: BREAKDOWN.STORM_STRESS, flags };
    out.out = true;
  } else {
    next = { ...next, stress: BREAKDOWN.STAY_STRESS, flags };
    if (taken === 'have_it_out') out.party = { stress: BREAKDOWN.PARTY_STRESS, ignoreWill: true, source: RESOLVE_RULES.PARTY_SOURCE };
    if (taken === 'bottle_it') {
      // A Silver Lining (held, or just left by a Virtue that ended above) cancels the Scar: both go.
      const gained = gainMark(next, scar, { drop });
      next = gained.combatant;
      out.mark = gained.gained;
      out.cancelled = gained.cancelled;
      out.dropped = gained.dropped ?? out.dropped;
    }
  }
  return { combatant: next, ...out };
}

// ---------------------------------------------------------------- enemies

/**
 * What a stress event from addStress / applyStress means for an enemy.
 *   'resolve'   -> Rattled until the battle ends: its attacks get -10 to hit and fumble on 91+ (through withStateOpts).
 *   'breakdown' -> Routed: a minion or standard enemy runs (defeated: true, full rewards); an elite, boss or
 *                  superboss loses its next action (loseTurn: true), drops back to 100 stress and stays Rattled.
 * Returns { status: 'rattled' | 'routed' | null, defeated, loseTurn, combatant }.
 */
export function enemyStressEvent(enemy, event) {
  const out = { status: null, defeated: false, loseTurn: false, combatant: { ...enemy } };
  if (event !== 'resolve' && event !== 'breakdown') return out;
  const rattled = {
    kind: 'rattled', id: 'rattled', name: 'Rattled', turns: null, until: 'battle', permanent: false, personal: false, roll: null,
    effects: [{ kind: 'attack', hitBonus: ENEMY_STRESS.RATTLED_HIT_BONUS, fumbleShift: ENEMY_STRESS.RATTLED_FUMBLE_SHIFT }],
    behavior: null, mark: null,
  };
  if (event === 'resolve') return { ...out, status: 'rattled', combatant: { ...enemy, resolve: rattled } };
  if (ENEMY_STRESS.ROUT_RUNS.includes(enemy?.rank ?? 'standard')) return { ...out, status: 'routed', defeated: true };
  return { ...out, status: 'routed', loseTurn: true, combatant: { ...enemy, stress: ENEMY_STRESS.ROUT_RESET, resolve: rattled } };
}

// ---------------------------------------------------------------- between battles

/**
 * End of a battle: a Virtue ends (leaving its Silver Lining if it was rolled on doubles), moods and the
 * per-battle counters reset, whoever Stormed Off is back, and a win takes the edge off (5, or 15 after a boss).
 * An Affliction does not end here. Returns { combatant, ended, mark, relieved, calmed }.
 */
export function endBattle(combatant, { won = true, boss = false, drop } = {}) {
  let next = { ...combatant };
  let ended = null;
  let mark = null;
  if (next.resolve?.kind === 'virtue') {
    const cleared = clearResolve(next, { drop });
    next = cleared.combatant;
    ended = cleared.ended;
    mark = cleared.mark;
  }
  const flags = withoutMood(next.flags);
  delete flags.breakdowns;
  delete flags.stormedOff;
  delete flags.refusedFirst;
  next = { ...next, flags };
  const relief = won ? relieveStress(next, boss ? RELIEF.BOSS_VICTORY : RELIEF.VICTORY, { from: 'other', drop }) : relieveStress(next, 0);
  return { combatant: relief.combatant, ended: ended ?? relief.ended, mark: mark ?? relief.mark, relieved: relief.relieved, calmed: relief.calmed };
}

/**
 * Rest outside battle. kind: 'unwind' (camp, instead of Sleep: -30), 'inn' (-25), 'night_off' (stress to 0 and
 * any Affliction or Virtue ends). HP, MP and gold are the caller's business. Returns the relieveStress shape.
 */
export function rest(combatant, kind, opts = {}) {
  if (kind === 'unwind') return relieveStress(combatant, RELIEF.UNWIND, { from: 'rest', drop: opts.drop });
  if (kind === 'inn') return relieveStress(combatant, RELIEF.INN, { from: 'rest', drop: opts.drop });
  if (kind === 'night_off') {
    const before = clampStress(combatant?.stress);
    const cleared = clearResolve(combatant, { drop: opts.drop });
    return {
      combatant: { ...cleared.combatant, stress: STRESS.MIN },
      relieved: before, before, after: STRESS.MIN, refused: false,
      calmed: cleared.ended?.kind === 'affliction', ended: cleared.ended, mark: cleared.mark,
    };
  }
  throw new Error(`Unknown rest "${kind}"`);
}
