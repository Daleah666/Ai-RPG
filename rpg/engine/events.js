// Pluggable story events.
//
// An event pack is one JSON file that anyone can write: a person, another tool, another game.
// Drop it in rpg/events/packs/ and it is in the game. Nothing in a pack is code; a pack can only
// ask for the effect kinds listed in EFFECT_KINDS, so a foreign pack cannot do anything the rules do not allow.
//
// An event is deliberately a superset of a character-card "moment" ({ title, t, tags, imp }), so events and
// card moments convert both ways: toMoment() and fromMoments().
import { STAT_KEYS, DIFFICULTY, SCALE, BIND_PARTS } from './constants.js';
import { check, contestPct, pickWeighted } from './rng.js';
import { difficultyDc, effectiveStat } from './stats.js';
import { stancePct } from './valerie.js';

export const PACK_FORMAT = 'rpg-events/1';
export const RATINGS = Object.freeze(['all', 'pg13']);
export const MODES = Object.freeze(['wing', 'think', 'any']);
export const EFFECT_KINDS = Object.freeze([
  'stress', // { amount, source? }                    amount may be negative (relief)
  'hp', // { pct }                                    percent of max HP, negative hurts
  'mp', // { pct }
  'airhead', // { amount } or { set }
  'limit', // { amount }
  'gold', // { amount } or { levelShare }             levelShare = share of one level's earnings
  'exp', // { amount } or { levelShare }              levelShare = share of EXP to next level
  'item', // { id, qty }                              qty may be negative
  'misplace', // { id? }                              send an item to the Pocket Dimension
  'flag', // { set } or { clear }
  'bind', // { part, turns }
  'mod', // { stat, mult, turns }
  'resolve', // { outcome: 'affliction' | 'virtue', id? } force a Resolve outcome
  'rep', // { amount }                                Hero Rep dashboard
  'trust', // { amount }                              Party Trust dashboard
  'dignity', // { amount }                            Dignity dashboard
  'moment', // { title, t, tags?, imp? }              write a moment onto the character card
  'battle', // { encounter, advantage? }              hand off to combat
  'next', // { event }                                chain to another event id
]);

const ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const range = (v) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] <= v[1];

function validateEffect(effect, where, errors) {
  if (!isObj(effect) || !EFFECT_KINDS.includes(effect.kind)) {
    errors.push(`${where}: unknown effect kind "${effect?.kind}"`);
    return;
  }
  const need = (ok, msg) => { if (!ok) errors.push(`${where} (${effect.kind}): ${msg}`); };
  switch (effect.kind) {
    case 'stress': need(isNum(effect.amount) && Math.abs(effect.amount) <= SCALE.STRESS_MAX, 'amount must be a number within ±200'); break;
    case 'hp': case 'mp': need(isNum(effect.pct) && Math.abs(effect.pct) <= 100, 'pct must be within ±100'); break;
    case 'airhead': need(isNum(effect.amount) || isNum(effect.set), 'needs amount or set'); break;
    case 'limit': case 'rep': case 'trust': case 'dignity': need(isNum(effect.amount), 'needs amount'); break;
    case 'gold': case 'exp': need(isNum(effect.amount) || isNum(effect.levelShare), 'needs amount or levelShare'); break;
    case 'item': need(isStr(effect.id) && isNum(effect.qty), 'needs id and qty'); break;
    case 'misplace': need(effect.id === undefined || isStr(effect.id), 'id must be a string when given'); break;
    case 'flag': need(isStr(effect.set) || isStr(effect.clear), 'needs set or clear'); break;
    case 'bind': need(BIND_PARTS.includes(effect.part) && isNum(effect.turns), 'needs part (head, arms, legs) and turns'); break;
    case 'mod': need(STAT_KEYS.includes(effect.stat) && isNum(effect.mult) && isNum(effect.turns), 'needs stat, mult and turns'); break;
    case 'resolve': need(['affliction', 'virtue'].includes(effect.outcome), 'needs outcome: affliction or virtue'); break;
    case 'moment': need(isStr(effect.title) && isStr(effect.t), 'needs title and t'); break;
    case 'battle': need(isStr(effect.encounter), 'needs encounter'); break;
    case 'next': need(isStr(effect.event), 'needs event'); break;
    default: break;
  }
}

function validateOutcome(outcome, where, errors) {
  if (!isObj(outcome) || !isStr(outcome.text)) {
    errors.push(`${where}: needs text`);
    return;
  }
  for (const [i, effect] of (outcome.effects ?? []).entries()) validateEffect(effect, `${where}.effects[${i}]`, errors);
}

/** Check a pack against the format. Returns { ok, errors, warnings }. Never throws on bad input. */
export function validatePack(pack) {
  const errors = [];
  const warnings = [];
  if (!isObj(pack)) return { ok: false, errors: ['pack must be an object'], warnings };
  const meta = pack.pack;
  if (!isObj(meta)) errors.push('pack: missing the "pack" header');
  else {
    if (meta.format !== PACK_FORMAT) errors.push(`pack.format must be "${PACK_FORMAT}"`);
    if (!isStr(meta.id) || !ID_RE.test(meta.id)) errors.push('pack.id must be lowercase letters, digits, dots, dashes or underscores');
    if (!isStr(meta.name)) errors.push('pack.name is required');
    if (!RATINGS.includes(meta.rating)) errors.push(`pack.rating must be one of: ${RATINGS.join(', ')}`);
  }
  if (!Array.isArray(pack.events) || pack.events.length === 0) errors.push('events: needs at least one event');
  const seen = new Set();
  for (const [i, event] of (pack.events ?? []).entries()) {
    const at = `events[${i}]${event?.id ? ` "${event.id}"` : ''}`;
    if (!isObj(event)) { errors.push(`${at}: must be an object`); continue; }
    if (!isStr(event.id) || !ID_RE.test(event.id)) errors.push(`${at}: id must be lowercase letters, digits, dots, dashes or underscores`);
    else if (seen.has(event.id)) errors.push(`${at}: duplicate id`);
    else seen.add(event.id);
    if (!isStr(event.title)) errors.push(`${at}: title is required`);
    if (!isStr(event.t)) errors.push(`${at}: t (the one-line summary) is required`);
    if (!isStr(event.scene)) errors.push(`${at}: scene is required`);
    if (event.tags !== undefined && !(Array.isArray(event.tags) && event.tags.every(isStr))) errors.push(`${at}: tags must be strings`);
    if ((event.tags ?? []).length > 5) warnings.push(`${at}: more than 5 tags; a character card keeps only the first 5`);
    if (event.imp !== undefined && ![1, 2, 3].includes(event.imp)) errors.push(`${at}: imp must be 1, 2 or 3`);
    if (event.where !== undefined && !(Array.isArray(event.where) && event.where.every(isStr))) errors.push(`${at}: where must be a list of place tags`);
    const when = event.when ?? {};
    if (!isObj(when)) errors.push(`${at}: when must be an object`);
    else {
      for (const key of ['level', 'stress', 'airhead']) if (when[key] !== undefined && !range(when[key])) errors.push(`${at}: when.${key} must be [min, max]`);
      if (when.weight !== undefined && !(isNum(when.weight) && when.weight >= 0)) errors.push(`${at}: when.weight must be 0 or more`);
    }
    if (!Array.isArray(event.choices) || event.choices.length === 0) { errors.push(`${at}: needs at least one choice`); continue; }
    if (event.choices.length === 1) warnings.push(`${at}: only one choice; every event should ask the player to give something up`);
    const choiceIds = new Set();
    for (const [j, choice] of event.choices.entries()) {
      const cat = `${at}.choices[${j}]`;
      if (!isObj(choice)) { errors.push(`${cat}: must be an object`); continue; }
      if (!isStr(choice.id) || choiceIds.has(choice.id)) errors.push(`${cat}: needs a unique id`);
      choiceIds.add(choice.id);
      if (!isStr(choice.label)) errors.push(`${cat}: label is required`);
      if (choice.mode !== undefined && !MODES.includes(choice.mode)) errors.push(`${cat}: mode must be wing, think or any`);
      if (choice.check !== undefined && choice.check !== null) {
        const c = choice.check;
        if (!isObj(c)) errors.push(`${cat}.check: must be an object or null`);
        else {
          if (c.stat !== undefined && !STAT_KEYS.includes(c.stat)) errors.push(`${cat}.check.stat must be one of ${STAT_KEYS.join(', ')}`);
          const hasDc = isNum(c.dc) && c.dc >= SCALE.STAT_MIN && c.dc <= SCALE.STAT_MAX;
          const hasDiff = c.difficulty !== undefined && DIFFICULTY[c.difficulty] !== undefined;
          if (!hasDc && !hasDiff) errors.push(`${cat}.check: needs difficulty (${Object.keys(DIFFICULTY).join(', ')}) or dc (1..1000)`);
          if (c.bonus !== undefined && !(isNum(c.bonus) && Math.abs(c.bonus) <= 40)) errors.push(`${cat}.check.bonus must be within ±40`);
        }
        if (!choice.success || !choice.failure) errors.push(`${cat}: a choice with a check needs success and failure`);
      } else if (!choice.success) errors.push(`${cat}: a choice without a check needs success`);
      for (const branch of ['success', 'failure', 'crit', 'fumble']) if (choice[branch]) validateOutcome(choice[branch], `${cat}.${branch}`, errors);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

const inRange = (value, r) => r === undefined || (value >= r[0] && value <= r[1]);

/**
 * Can this event fire right now?
 * ctx: { level, where, stress, airhead, flags: { name: true }, seen: Set|array of event ids }
 */
export function isEligible(event, ctx = {}) {
  const when = event.when ?? {};
  const seen = ctx.seen instanceof Set ? ctx.seen : new Set(ctx.seen ?? []);
  if (when.once !== false && seen.has(event.id)) return false;
  if (!inRange(ctx.level ?? 1, when.level)) return false;
  if (!inRange(ctx.stress ?? 0, when.stress)) return false;
  if (!inRange(ctx.airhead ?? 0, when.airhead)) return false;
  const flags = ctx.flags ?? {};
  if ((when.flags?.all ?? []).some((f) => !flags[f])) return false;
  if ((when.flags?.none ?? []).some((f) => flags[f])) return false;
  const places = event.where ?? ['any'];
  if (!places.includes('any') && ctx.where !== undefined && !places.includes(ctx.where)) return false;
  return true;
}

/** Every eligible event from one pack or a list of packs. */
export function eligibleEvents(packs, ctx = {}) {
  return [packs].flat().flatMap((pack) => pack.events ?? []).filter((event) => isEligible(event, ctx));
}

/** Draw one eligible event by weight. Returns null when nothing fits. */
export function drawEvent(packs, ctx, rng) {
  return pickWeighted(rng, eligibleEvents(packs, ctx), (event) => event.when?.weight ?? 10);
}

/** The chance a choice succeeds for this actor, or null when the choice has no check. */
export function choicePct(choice, actor, { stance } = {}) {
  const c = choice.check;
  if (!c) return null;
  const dc = isNum(c.dc) ? c.dc : difficultyDc(actor.level, c.difficulty);
  const mode = choice.mode && choice.mode !== 'any' ? choice.mode : stance;
  // Valerie rolls in a stance: luck when winging it, the player's wit when thinking.
  if (actor.flags?.airhead !== undefined && (mode === 'wing' || mode === 'think') && !c.stat) return stancePct(actor, mode, dc, c.bonus ?? 0);
  return contestPct(effectiveStat(actor, c.stat ?? 'LCK'), dc, c.bonus ?? 0);
}

/**
 * Resolve a choice. One d100. Returns { pct, roll, degree, branch, text, effects }.
 * A crit uses the crit branch when the author wrote one, otherwise success. Same for fumble and failure.
 */
export function resolveChoice(event, choiceId, actor, rng, { stance } = {}) {
  const choice = (event.choices ?? []).find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Event "${event.id}" has no choice "${choiceId}"`);
  const pct = choicePct(choice, actor, { stance });
  if (pct === null) {
    return { pct: null, roll: null, degree: 'auto', branch: 'success', text: choice.success.text, effects: choice.success.effects ?? [] };
  }
  const result = check(pct, rng);
  let branch = result.success ? 'success' : 'failure';
  if (result.degree === 'crit' && choice.crit) branch = 'crit';
  if (result.degree === 'fumble' && choice.fumble) branch = 'fumble';
  return { pct: result.pct, roll: result.roll, degree: result.degree, branch, text: choice[branch].text, effects: choice[branch].effects ?? [] };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Apply effects to a plain party state and return the new state plus anything the caller must handle.
 * state: { stress, airhead, limit, gold, exp, hpPct, mpPct, rep, trust, dignity, items: {id: qty}, missing: [], flags: {}, moments: [] }
 * scale: optional { expToNext(level), goldPerLevel(level) } so levelShare amounts can be turned into numbers.
 * Battles, chained events, binds, mods and forced resolves come back in `pending` for the combat layer.
 */
export function applyEffects(state, effects, { level = 1, scale = {} } = {}) {
  const next = {
    stress: 0, airhead: 0, limit: 0, gold: 0, exp: 0, hpPct: 100, mpPct: 100, rep: 0, trust: 0, dignity: 0,
    ...state,
    items: { ...(state.items ?? {}) },
    missing: [...(state.missing ?? [])],
    flags: { ...(state.flags ?? {}) },
    moments: [...(state.moments ?? [])],
  };
  const pending = [];
  const amountOf = (effect, perLevel) => {
    if (isNum(effect.amount)) return effect.amount;
    return perLevel ? Math.round(perLevel(level) * effect.levelShare) : 0;
  };
  for (const effect of effects ?? []) {
    switch (effect.kind) {
      case 'stress': next.stress = clamp(next.stress + effect.amount, SCALE.STRESS_MIN, SCALE.STRESS_MAX); break;
      case 'hp': next.hpPct = clamp(next.hpPct + effect.pct, 0, 100); break;
      case 'mp': next.mpPct = clamp(next.mpPct + effect.pct, 0, 100); break;
      case 'airhead': next.airhead = clamp(isNum(effect.set) ? effect.set : next.airhead + effect.amount, 0, SCALE.AIRHEAD_MAX); break;
      case 'limit': next.limit = clamp(next.limit + effect.amount, 0, SCALE.LIMIT_MAX); break;
      case 'rep': next.rep = clamp(next.rep + effect.amount, 0, 100); break;
      case 'trust': next.trust = clamp(next.trust + effect.amount, 0, 100); break;
      case 'dignity': next.dignity = clamp(next.dignity + effect.amount, 0, 100); break;
      case 'gold': next.gold = Math.max(0, next.gold + amountOf(effect, scale.goldPerLevel)); break;
      case 'exp': next.exp = Math.max(0, next.exp + amountOf(effect, scale.expToNext)); break;
      case 'item': {
        const qty = (next.items[effect.id] ?? 0) + effect.qty;
        if (qty > 0) next.items[effect.id] = qty; else delete next.items[effect.id];
        break;
      }
      case 'misplace': {
        const id = effect.id ?? Object.keys(next.items)[0];
        if (id && next.items[id] > 0) {
          next.items[id] -= 1;
          if (next.items[id] === 0) delete next.items[id];
          next.missing.push(id);
        }
        break;
      }
      case 'flag':
        if (effect.set) next.flags[effect.set] = true;
        if (effect.clear) delete next.flags[effect.clear];
        break;
      case 'moment': next.moments.push(toMoment(effect)); break;
      default: pending.push(effect); // bind, mod, resolve, battle, next
    }
  }
  return { state: next, pending };
}

/** An event (or a moment effect) as a character-card moment. */
export function toMoment(event) {
  return {
    title: String(event.title),
    t: String(event.t),
    tags: (event.tags ?? []).map(String).slice(0, 5),
    imp: [1, 2, 3].includes(event.imp) ? event.imp : 2,
  };
}

/** Card moments as a starter pack: each becomes an event with one open-ended choice for an author to flesh out. */
export function fromMoments(moments, { id, name, author = 'card creator', rating = 'pg13' }) {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'moment';
  return {
    pack: { format: PACK_FORMAT, id, name, version: '0.1.0', author, rating, source: 'card moments' },
    events: (moments ?? []).map((m, i) => ({
      id: `${id}.${slug(m.title)}_${i + 1}`,
      title: m.title,
      t: m.t ?? m.text ?? '',
      tags: (m.tags ?? []).slice(0, 5),
      imp: [1, 2, 3].includes(m.imp) ? m.imp : 2,
      where: ['any'],
      scene: m.t ?? m.text ?? '',
      choices: [{ id: 'go', label: 'See what happens', mode: 'any', check: null, success: { text: m.t ?? m.text ?? '', effects: [] } }],
    })),
  };
}

/**
 * An event as a SillyTavern lorebook entry (chara_card_v2 character_book entry shape).
 * Keys are its place and tags, so it surfaces when the story goes there.
 */
export function toLoreEntry(event, index = 0) {
  const lines = [`[EVENT: ${event.title}] ${event.scene}`];
  for (const choice of event.choices ?? []) {
    const c = choice.check;
    const how = c ? ` (d100 ${choice.mode === 'think' ? 'Think' : choice.mode === 'wing' ? 'Wing It' : c.stat ?? 'Luck'} check, ${c.difficulty ?? `DC ${c.dc}`})` : '';
    lines.push(`- ${choice.label}${how}: ${choice.success.text}${choice.failure ? ` On a failure: ${choice.failure.text}` : ''}`);
  }
  const keys = [...new Set([...(event.where ?? []).filter((w) => w !== 'any'), ...(event.tags ?? []), ...(event.keys ?? [])])];
  return {
    id: index,
    keys,
    content: lines.join('\n'),
    enabled: true,
    insertion_order: 100 + index,
    case_sensitive: false,
    constant: false,
    selective: false,
    position: 'after_char',
    comment: `event · ${event.id}`,
    extensions: {},
  };
}
