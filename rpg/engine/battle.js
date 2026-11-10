// The battle runner: the turn loop that plays a fight from start to finish.
// Owner: Battle Engineer. Pure ES module, no dependencies, browser-safe: every table arrives through setup.data.
//
// A battle is one plain-data state object. Nothing here mutates a state it was handed: createBattle and act
// each work on a private copy and hand back a new state plus the list of events that happened.
// This file takes turns and composes the rules; it does not restate them. Hit chance, damage, healing and
// initiative are combat.js. Stress, the Resolve Check, the turn check and the Breakdown are stress.js. Binds are
// binds.js. Valerie's bands are valerie.js and valerie-combat.js. The prose is narrate.js.
// The order of a round and of one action is written out in blueprint/08_battle_runner.md.
import { SCALE, FUMBLE_FROM, AFFINITY_MULT, STAT_INFO } from './constants.js';
import { makeRng, rollInt, pickWeighted, statCheck } from './rng.js';
import { makeCombatant, benchmarkStat, difficultyDc, effectiveStat, clampLevel, clampStat } from './stats.js';
import { BASIC_ATTACK, GUARD_MULT, hitChance, damage, resolveAttack, healAmount, initiative, rollVariance, expectedDamage } from './combat.js';
import { statsAt, maxHp, maxMp, expYield, goldYield } from './progression.js';
import {
  applyStress, relieveStress, breather, breakdown, actOutCheck, withStateOpts, refuses, covers, effectsOf,
  consumeFirstRefusal, enemyStressEvent, pickByRoll, stressFor, endBattle, RELIEF, BREAKDOWN,
} from './stress.js';
import { tryBind, applyBind, tickBinds, cureBinds, sealedBy, isBound, boundParts, trussedDamageMult, endBattleBinds } from './binds.js';
import { AIRHEAD, airheadOf, airheadBand, shiftAirhead, stanceEffects, canUseInBand, chaosWave, stressFilter, readIncoming, befuddledPart } from './valerie.js';
import { enemyAttacksValerie, valerieAttacks, applyStressToValerie, partyResolveCheck, befuddle, ANALYZED_HIT_BONUS, LIMIT_ON_ENEMY_FUMBLE } from './valerie-combat.js';
import { narrate, lineFor, voiceKey } from './narrate.js';

// ---------------------------------------------------------------- tables

const HERO = 'heroes';
const FOE = 'enemies';
const OFFENSIVE = ['one', 'row', 'all'];
const TARGET_MODES = ['one', 'row', 'all', 'self', 'ally', 'allies'];
const EFFECT_KINDS = ['bind', 'stress', 'mod', 'status', 'heal', 'limit', 'airhead', 'dot', 'cleanse', 'revive'];
const EFFECT_TARGETS = ['self', 'valerie', 'others', 'heroes', 'enemies', 'allies', 'boss'];
const CLEANSE_WHAT = ['binds', 'mods', 'statuses'];
const WARD_STEP = { weak: 'normal', normal: 'resist' };

/**
 * The status registry: one row per status id, each a bag of hooks the loop reads. A status with no row here is
 * not supported, and any skill or move that applies it is disabled with a reason (see skillSupport).
 *
 *   guard            multiplier on damage taken (the smallest one counts; they do not stack)
 *   life             'granter' ends at the start of the granter's next turn; 'round' ends with the round
 *   taken / dealt    damage multipliers on hits against / by the bearer
 *   hitAgainst / critAgainst / critOwn   band moves on attacks against / by the bearer
 *   pullsAll / coveredBy / taunt / mustAim / unseen   who an attack may or must be aimed at
 *   strips, noGuard  statuses removed when this lands, and whether Guard can be raised under it
 *   skipTurn / loseAction   the bearer's next turn or next action is lost, then this ends
 *   instant          something that happens once and leaves nothing behind
 */
export const STATUS_HOOKS = Object.freeze({
  // shared (data/skills.json)
  guard: { guard: GUARD_MULT, life: 'granter' },
  fortified: { guard: GUARD_MULT },
  bulwark: { guard: GUARD_MULT, pullsAll: true },
  covered: { coveredBy: true },
  counter: { counter: true },
  taunt: { taunt: true },
  provoked: { mustAim: true },
  hidden: { unseen: true, critOwn: 20, endsOnAttack: true },
  marked: { critAgainst: 15 },
  exposed: { taken: 1.25 },
  focused: { hitAgainst: 10, dealt: 1.5, endsOnDamagingSkill: true },
  analyzed: { hitAgainst: ANALYZED_HIT_BONUS },
  sitting_out: { skipTurn: true, noGuard: true },
  all_nighter: { freeMp: true, onEnd: 'crash' },
  guard_broken: { strips: ['guard'], noGuard: true, life: 'round' },
  ward_fire: { ward: 'fire' },
  ward_ice: { ward: 'ice' },
  ward_bolt: { ward: 'bolt' },
  ward_holy: { ward: 'holy' },
  ward_dark: { ward: 'dark' },
  rattled: { engine: 'enemyStressEvent' },
  routed: { engine: 'enemyStressEvent' },
  // the hero
  extra_slippery: { flag: 'extraSlippery' },
  good_hero: { allBands: true, onEnd: 'gaugeReset' },
  auto_crit_next_think: { autoCritThink: true },
  plot_armor: { marker: true },
  pocket_found_check: { unsupported: 'the Pocket Dimension is not in the runner yet' },
  // bosses (data/bosses.json)
  proof_wound: { windupMarker: true },
  draft_begun: { windupMarker: true },
  bell_rung: { windupMarker: true },
  windup_cancelled: { instant: 'cancelWindup' },
  vindicated: { instant: 'concession' },
  on_the_record: { instant: 'concession' },
  lucky_once: { instant: 'concession' },
  book_exposed: { strips: ['guard'], noGuard: true },
  ledger_flipped: { flag: 'ledgerFlipped' },
  ledger_restored: { instant: 'remove', removes: ['ledger_flipped'] },
  buffs_repossessed: { instant: 'repossess' },
  surprised: { loseAction: true },
  // encounters (data/encounters.json)
  lose_next_action: { loseAction: true },
  formation_broken: { strips: ['guard'], noGuard: true },
  formation_reformed: { instant: 'remove', removes: ['formation_broken'] },
  gate_shut: { halvesActing: true },
});

const downedAllies = (s, c) => sideIds(s, c.side).filter((id) => id !== c.id && C(s, id).hp <= 0 && !C(s, id).fled).length;

/** Skills tagged `scripted`: the part of their text the effects list cannot say. Anything missing here is disabled. */
const SCRIPTED = Object.freeze({
  war_grudge_match: { reskill: (skill, actor) => ({ ...skill, power: Math.min(11, skill.power + Math.floor(actor.stress / 20)) }) },
  war_closing_time: { reskill: (skill, actor, target, s) => ({ ...skill, power: Math.min(28, skill.power + 2 * downedAllies(s, actor)) }), stripGuardFirst: true },
  mag_group_project: { skipSelf: true },
  mag_dissertation: { reskill: (skill, actor, target) => ({ ...skill, element: weakestElement(target, skill.element) }) },
  rog_punchline: { reskill: (skill, actor, target) => ({ ...skill, power: Math.min(11, skill.power + Math.floor(target.stress / 20)) }) },
  rog_the_big_score: { autoCrit: (actor, target) => boundParts(target).length > 0 },
  rog_borrowed_time: { extraActions: 1, notDuringExtra: true },
  rog_clean_getaway: { extraActions: 2, deferStatuses: true },
});

/** Passives the loop acts on. Every other passive id is carried on the sheet and does nothing (see supportReport). */
const SUPPORTED_PASSIVES = Object.freeze([
  'war_p_doorstop', 'war_p_stubborn', 'war_p_bodyguards_reflex', 'war_p_seeing_red', 'war_p_last_one_standing',
  'mag_p_marginalia', 'mag_p_ivory_tower', 'mag_p_bedside_manner', 'mag_p_mind_over_matter',
  'rog_p_sticky_fingers', 'rog_p_first_in', 'rog_p_opportunist', 'rog_p_travelling_light', 'rog_p_kick_em', 'rog_p_cut_and_run',
  'any_p_deep_breaths', 'any_p_lucky_charm', 'any_p_gallows_humour',
]);

/**
 * Rules the boss file states in prose only. Keyed by boss id so the data stays the source for everything else.
 * Asked of the boss desk in handoff/battle-engineer.md: put these on the concession and the boss as fields.
 */
const BOSS_RULES = Object.freeze({
  boss_bolgrim: { concede: { who: 'any' } },
  boss_vellum: { concede: { who: 'valerie', stance: 'think' }, analyzedStripsGuard: true },
  boss_parity: { concede: { who: 'valerie', band: 'airhead', notFlipped: true }, targeting: 'highest_hp', taunterTakesAll: ['boss_parity_balance_due'] },
});

const MECHANICS = Object.freeze({
  supported: [
    'turn order from initiative, rolled each round',
    'several actions a round (`actions`) and the per-phase round `script`',
    'phase changes at `phases[].at`, which re-cock a once-per-phase contraption',
    'wind-up and telegraph, cancelled by a bind on the move\'s part or by the contraption',
    '`auto: true` moves: no attack roll, so no dodge, bounce or fumble',
    'effect targets `valerie`, `others`, `heroes`, `enemies`, `allies`, `boss`, and `orPay`',
    'contraption effects when a Chaos Wave sets it off: damage by `hpPct`, binds with no contest, statuses, bonus gold',
    'Guard as an enemy status, stripped by a Chaos Wave and, on Vellum, by Wait, Look Closely',
    'the concession as a `concede` action, with its price',
    '`ledger_flipped` on Valerie (her ultimate still pins the gauge at 100)',
    'Madam Parity: highest-HP targeting, Repossession, Balance Due landing once on a taunting Valerie',
    '`acting`: how many of a kind may act each round, halved by Gate Shut',
    'the eight scripted class skills',
    'damage over time, cleanse, revive, class Limit from passives',
    'the standard stress sources crit_taken, brink, ally_down, downed and fumble, on heroes',
    'Plot Armor (level 80)',
  ],
  unsupported: [
    'items in battle: use, the thrown model, share-and-ceiling healing, seeds, gear (so Loot Goblin\'s "Mine" always falls back to Guard)',
    'Valerie\'s Pocket Dimension (Missing items, the Found check) and her skill Found It!',
    'the contraption\'s `manual` hard check (setting it off on purpose)',
    'event `advantage` (the lever already pulled, the militia on the flanks)',
    'positions: Bolgrim\'s nearest and furthest hero, Vellum\'s choice of whom to correct (targets are picked at random among those allowed)',
    'rows inside a side: a side is one row unless combatants carry `row`',
    'encounter rules written in prose only: the last goblin runs, the hoplites stop locking shields without their Captain, the raiders ease off without their drummers',
    'the Struggle action, fleeing, and swapping who is in the fight',
    'general passive slots (a hero carries whatever `passives` the caller lists) and "once per rest" rules',
    'standard stress sources on enemies, and the out-of-battle sources (ambushed, fled, long_haul)',
    'refusing a helpful status (a hero who refuses buffs turns away attribute buffs only), and hiding affinities until they are "revealed"',
  ],
});

// ---------------------------------------------------------------- small helpers

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const listOf = (v, key) => (Array.isArray(v) ? v : Array.isArray(v?.[key]) ? v[key] : []);
const C = (s, id) => s.combatants[id];
const put = (s, c) => { s.combatants[c.id] = c; return c; };
const sideIds = (s, side) => (side === HERO ? s.heroes : s.enemies);
const allIds = (s) => [...s.heroes, ...s.enemies];
const foeSide = (c) => (c.side === HERO ? FOE : HERO);
const alive = (c) => Boolean(c) && c.hp > 0 && !c.fled && !c.flags?.stormedOff;
const living = (s, side) => sideIds(s, side).filter((id) => alive(C(s, id)));
const share = (c) => (c.maxHp > 0 ? c.hp / c.maxHp : 0);

/**
 * Who is in the fight right now. Every living hero; for enemies, the front of each kind: `acting` on an enemy is
 * how many of that kind fit through the gap at once. The rest wait behind the front: they do not act and cannot
 * be reached until one ahead of them falls. Gate Shut halves every front (never under one).
 */
function fielded(s, side) {
  const up = living(s, side);
  if (side === HERO) return up;
  const shut = up.some((id) => hookOn(C(s, id), 'halvesActing'));
  const kinds = new Map();
  for (const id of up) {
    const key = C(s, id).kind ?? id;
    if (!kinds.has(key)) kinds.set(key, []);
    kinds.get(key).push(id);
  }
  const out = [];
  for (const ids of kinds.values()) {
    let cap = Math.min(num(C(s, ids[0]).acting, ids.length), ids.length);
    if (shut) cap = Math.max(1, Math.floor(cap / 2));
    out.push(...ids.slice(0, cap));
  }
  return out;
}
const isHeroVal = (c) => Boolean(c) && c.side === HERO && (c.id === 'valerie' || c.archetype === 'klutz_knight');
const hasP = (c, id) => Boolean(c?.passives?.includes(id));
const statusOf = (c, id) => (c?.statuses ?? []).find((st) => st.id === id) ?? null;
const has = (c, id) => statusOf(c, id) !== null;
const hookOn = (c, key) => (c?.statuses ?? []).some((st) => STATUS_HOOKS[st.id]?.[key] !== undefined);
const modLabel = (m) => `${STAT_INFO[m.stat]?.name ?? m.stat} ×${m.mult}`;

function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = clone(v[k]);
    return out;
  }
  return v;
}

// The private copy an action works on. The tables in defs are shared by reference and never written to.
function draft(state) {
  const { defs, opening, ...rest } = state;
  return { ...clone(rest), defs, opening: [] };
}

function dropStatus(c, pred) {
  const gone = c.statuses.filter(pred);
  if (gone.length) c.statuses = c.statuses.filter((st) => !pred(st));
  return gone;
}

function guardMultOf(c) {
  let mult = 1;
  for (const st of c.statuses ?? []) {
    const g = STATUS_HOOKS[st.id]?.guard;
    if (g !== undefined) mult = Math.min(mult, st.mult ?? g);
  }
  return mult;
}

// Valerie's engine functions read three flags. They follow her statuses here, in one place.
function syncFlags(c) {
  if (!isHeroVal(c)) return;
  c.flags.extraSlippery = has(c, 'extra_slippery');
  const hero = statusOf(c, 'good_hero');
  c.flags.goodHeroTurns = hero ? Math.max(1, num(hero.turns, 1)) : 0;
  c.flags.ledgerFlipped = has(c, 'ledger_flipped');
}

function weakestElement(target, fallback) {
  let best = fallback ?? 'fire';
  let bestMult = AFFINITY_MULT[target.affinities?.[best] ?? 'normal'];
  for (const el of ['fire', 'ice', 'bolt', 'holy', 'dark']) {
    const mult = AFFINITY_MULT[target.affinities?.[el] ?? 'normal'];
    if (mult > bestMult) { best = el; bestMult = mult; }
  }
  return best;
}

function wardedAffinity(target, skill) {
  const element = skill.element ?? 'phys';
  if (!(target.statuses ?? []).some((st) => STATUS_HOOKS[st.id]?.ward === element)) return undefined;
  const base = target.affinities?.[element] ?? 'normal';
  return WARD_STEP[base] ?? base;
}

function weakestAllyOf(s, c) {
  let pick = null;
  for (const id of living(s, c.side)) {
    if (id === c.id) continue;
    if (pick === null || share(C(s, id)) < share(C(s, pick))) pick = id;
  }
  return pick;
}

// The first plain sentence of a move's text, for the narrator. Labels and anything with a number in it are skipped.
function flavorOf(skill, actor) {
  if (actor.side === HERO && !isHeroVal(actor)) return null; // class skill text says "you", and "you" is Valerie
  const sentences = String(skill.text ?? '').match(/[^.!?]+[.!?]+/g) ?? [];
  const first = sentences.map((x) => x.trim()).find((x) => !/^(Ultimate|Passive|Cannot miss|Telegraphed)/.test(x));
  if (!first) return null;
  const clause = first.includes(':') ? `${first.slice(0, first.indexOf(':')).trim()}.` : first;
  if (/[0-9×%]/.test(clause) || clause.length < 8) return null;
  // The narrator speaks to the person inside Valerie, so a move's text that names her says "you".
  return clause.replace(/\bValerie's\b/g, 'your').replace(/\bValerie\b/g, 'you');
}

const actorF = (c) => (c ? { actor: c.id, actorName: c.name, actorSide: c.side, actorYou: isHeroVal(c) } : {});
const targetF = (c) => (c ? { target: c.id, targetName: c.name, targetSide: c.side, targetYou: isHeroVal(c) } : {});

function emit(B, type, fields = {}) {
  const s = B.s;
  s.seq += 1;
  const ev = { seq: s.seq, type, round: s.round, ...fields };
  // The narrator deals its variants in turn: one counter per family of sentence, kept with the battle.
  const key = voiceKey(ev);
  const told = num(s.voice[key]);
  s.voice[key] = told + 1;
  ev.voice = told + s.voiceSalt;
  // A heal or a one-status skill has no announcement of its own: its first beat carries what it cost.
  if (B.owed && (type === 'heal' || type === 'status')) { ev.cost = B.owed; B.owed = null; }
  ev.line = lineFor(ev);
  ev.text = narrate(ev, s.defs.ctx);
  B.events.push(ev);
  return ev;
}

// ---------------------------------------------------------------- what is and is not supported

/** Can the runner resolve this skill or move? { ok: true } or { ok: false, why }. */
export function skillSupport(skill) {
  const no = (why) => ({ ok: false, why });
  if (!skill) return no('unknown skill');
  if (!TARGET_MODES.includes(skill.target ?? 'one')) return no(`target "${skill.target}" is not built in`);
  if ((skill.tags ?? []).includes('scripted') && !SCRIPTED[skill.id]) return no('its scripted rule is not built in');
  for (const fx of skill.effects ?? []) {
    if (!EFFECT_KINDS.includes(fx.kind)) return no(`effect "${fx.kind}" is not built in`);
    if (fx.target !== undefined && !EFFECT_TARGETS.includes(fx.target)) return no(`effect target "${fx.target}" is not built in`);
    if (fx.kind === 'status') {
      const hook = STATUS_HOOKS[fx.id];
      if (!hook) return no(`the "${fx.id}" status is not built in`);
      if (hook.unsupported) return no(hook.unsupported);
    }
    if (fx.kind === 'cleanse' && !CLEANSE_WHAT.includes(fx.what)) return no(`cleanse "${fx.what}" is not built in`);
  }
  return { ok: true };
}

/**
 * Everything in the data, sorted into what the runner does and what it does not. For the handoff note, the
 * blueprint table and a UI that wants to say so. data: the same object createBattle takes.
 */
export function supportReport(data = {}) {
  const tally = (list, owner) => {
    const unsupported = [];
    for (const sk of list) {
      const r = skillSupport(sk);
      if (!r.ok) unsupported.push({ id: sk.id, name: sk.name, owner: owner(sk), why: r.why });
    }
    return { total: list.length, supported: list.length - unsupported.length, unsupported };
  };
  const classSkills = [...listOf(data.skills, 'skills'), ...listOf(data.valerie?.skills, 'skills')];
  const moves = [
    ...listOf(data.bosses, 'bosses').flatMap((b) => (b.moves ?? []).map((m) => ({ ...m, owner: b.id }))),
    ...listOf(data.encounters, 'encounters').flatMap((e) => (e.enemies ?? []).flatMap((en) => (en.moves ?? []).map((m) => ({ ...m, owner: en.id })))),
  ];
  const statusIds = new Map();
  for (const list of [data.statuses, data.skills?.statuses, data.bosses?.statuses, data.encounters?.statuses]) {
    for (const st of listOf(list, 'statuses')) if (!statusIds.has(st.id)) statusIds.set(st.id, st);
  }
  const badStatuses = [...statusIds.values()]
    .filter((st) => !STATUS_HOOKS[st.id] || STATUS_HOOKS[st.id].unsupported)
    .map((st) => ({ id: st.id, name: st.name, why: STATUS_HOOKS[st.id]?.unsupported ?? 'no hook in the registry' }));
  const passives = listOf(data.passives, 'passives');
  const badPassives = passives.filter((p) => !SUPPORTED_PASSIVES.includes(p.id)).map((p) => ({ id: p.id, name: p.name }));
  return {
    skills: tally(classSkills, (sk) => sk.archetype),
    moves: tally(moves, (m) => m.owner),
    statuses: { total: statusIds.size, supported: statusIds.size - badStatuses.length, unsupported: badStatuses },
    passives: { total: passives.length, supported: passives.length - badPassives.length, unsupported: badPassives },
    mechanics: { supported: [...MECHANICS.supported], unsupported: [...MECHANICS.unsupported] },
  };
}

// ---------------------------------------------------------------- building a battle

/** A party member from an archetype definition: attributes for the level, everything else by default. */
export function makeHero(archetype, level, extra = {}) {
  return { id: archetype.id, name: archetype.name, archetype: archetype.id, level, stats: statsAt(archetype, level), ...extra };
}

/** The reference party the boss desk measures against: warrior, mage, rogue and the hero at one level, no gear. */
export function referenceParty(level, data = {}) {
  const list = listOf(data.archetypes, 'archetypes');
  const find = (id) => {
    const a = list.find((x) => x.id === id);
    if (!a) throw new Error(`referenceParty: data.archetypes has no "${id}"`);
    return a;
  };
  if (!data.valerie?.archetype) throw new Error('referenceParty: data.valerie is missing');
  return [
    makeHero(find('warrior'), level),
    makeHero(find('mage'), level),
    makeHero(find('rogue'), level),
    makeHero(data.valerie.archetype, level, { id: data.valerie.hero?.id ?? 'valerie', name: data.valerie.hero?.name ?? 'Valerie' }),
  ];
}

function shell(base, extra) {
  return {
    ...base,
    bindResist: base.bindResist ?? 0,
    side: FOE, skills: [], passives: [], statuses: [], dots: [], row: null, kind: null,
    actions: 1, acting: null, boss: false, fled: false,
    ...extra,
  };
}

function buildHero(p, data, defs) {
  const base = makeCombatant(p);
  const val = base.id === 'valerie' || base.archetype === 'klutz_knight';
  const hpMax = num(p.maxHp, 0) > 0 ? p.maxHp : maxHp(base.level, base.stats.CON);
  const mpMax = Number.isFinite(p.maxMp) ? Math.max(0, p.maxMp) : maxMp(base.level, base.stats.WIL);
  const classSkills = listOf(data.skills, 'skills');
  const heroSkills = listOf(data.valerie?.skills, 'skills');
  const known = new Map([...classSkills, ...heroSkills].map((sk) => [sk.id, sk]));
  const mine = val ? heroSkills : classSkills.filter((sk) => sk.archetype === base.archetype);
  const picked = p.skills ?? mine.filter((sk) => num(sk.unlock, 1) <= base.level);
  const skills = [];
  for (const entry of picked) {
    const sk = typeof entry === 'string' ? known.get(entry) ?? defs.skills[entry] : entry;
    if (!sk?.id) throw new Error(`createBattle: ${base.id} lists an unknown skill "${entry}"`);
    if (sk.id === BASIC_ATTACK.id || skills.includes(sk.id)) continue;
    defs.skills[sk.id] = sk;
    skills.push(sk.id);
  }
  const classPassives = listOf(data.passives, 'passives').filter((x) => x.archetype === base.archetype && num(x.unlock, 1) <= base.level).map((x) => x.id);
  const flags = { ...base.flags };
  if (val && !Number.isFinite(flags.airhead)) flags.airhead = AIRHEAD.START;
  return shell(base, {
    hp: clamp(num(p.hp, hpMax), 0, hpMax), maxHp: hpMax, mp: clamp(num(p.mp, mpMax), 0, mpMax), maxMp: mpMax,
    flags, side: HERO, skills, passives: [...new Set([...classPassives, ...(p.passives ?? [])])],
    row: p.row ?? null, actions: Math.max(1, Math.floor(num(p.actions, 1))),
  });
}

function buildEnemy(def, defs, { id, name, level, stats }) {
  const moves = def.moves ?? [];
  for (const m of moves) defs.skills[m.id] = m;
  const base = makeCombatant({ id, name, level, rank: def.rank ?? 'standard', stats, affinities: def.affinities, bindResist: def.bindResist, tags: def.tags, flags: def.flags, stress: def.stress });
  const hpMax = maxHp(base.level, base.stats.CON, base.rank);
  const mpMax = maxMp(base.level, base.stats.WIL);
  return shell(base, {
    hp: clamp(num(def.hpNow, hpMax), 0, hpMax), maxHp: hpMax, mp: mpMax, maxMp: mpMax,
    skills: [...moves.map((m) => m.id), ...(def.skills ?? [])], row: def.row ?? null, kind: def.kind ?? def.id,
    actions: Math.max(1, Math.floor(num(def.actions, 1))), acting: Number.isFinite(def.acting) ? def.acting : null,
  });
}

const tagOf = (i) => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

function firstSentence(text) {
  const m = String(text ?? '').match(/[^.!?]+[.!?]+/);
  return m ? m[0].trim() : null;
}

/**
 * Start a battle. Returns the state at the first hero decision (or already over, if nobody got that far).
 * The events up to that point are in state.opening.
 *
 * setup: {
 *   party: [combatant]            makeCombatant partials. Optional per member: skills (ids or objects; default:
 *                                 the archetype's skills up to its level), passives (ids, added to the class ones), row.
 *   encounter | boss | enemies    an id or a definition from data.encounters / data.bosses, or a list of enemies
 *                                 { id, name, level, rank, stats, moves: [skill], actions?, acting?, affinities?, bindResist? }
 *   level?                        the level a "party"-level encounter is built at (default: the party's highest)
 *   data: { skills, statuses, passives, items, afflictions, virtues, valerie, bosses, encounters }
 *   options?: { breakdownChoice: 'storm_off' | 'have_it_out' | 'bottle_it' | { [heroId]: choice },
 *               orPay: 'auto' | 'pay' | 'stress', standardStress: true }
 *   contraption?, concession?     for a custom fight: the same shapes the boss file uses
 *   rng? | seed?                  dice for the opening (initiative, and any enemy who acts before a hero)
 * }
 */
export function createBattle(setup = {}, rngIn) {
  const data = setup.data ?? {};
  const rng = rngIn ?? setup.rng ?? makeRng(setup.seed ?? 1);
  if (!Array.isArray(setup.party) || setup.party.length === 0) throw new Error('createBattle: setup.party needs at least one combatant');

  const defs = {
    skills: { [BASIC_ATTACK.id]: BASIC_ATTACK },
    statuses: {},
    passives: {},
    tables: { afflictions: listOf(data.afflictions, 'afflictions'), virtues: listOf(data.virtues, 'virtues') },
    personal: data.valerie?.resolve ?? null,
    ctx: { sword: (data.valerie?.hero?.symbols ?? []).find((x) => x.id === 'sword')?.name ?? 'Happenstance' },
    boss: null,
    bossRules: null,
  };
  for (const list of [data.statuses, data.skills?.statuses, data.bosses?.statuses, data.encounters?.statuses]) {
    for (const st of listOf(list, 'statuses')) if (!defs.statuses[st.id]) defs.statuses[st.id] = st;
  }
  for (const p of listOf(data.passives, 'passives')) defs.passives[p.id] = p;

  const combatants = {};
  const heroes = [];
  const enemies = [];
  const add = (c, list) => {
    if (combatants[c.id]) throw new Error(`createBattle: two combatants share the id "${c.id}"`);
    combatants[c.id] = c;
    list.push(c.id);
  };
  for (const p of setup.party) add(buildHero(p, data, defs), heroes);
  const level = clampLevel(setup.level ?? Math.max(...heroes.map((id) => combatants[id].level)));

  let kind = 'custom';
  let name = setup.name ?? 'Battle';
  let scene = setup.scene ?? null;
  let sourceId = null;
  let contraptionDef = setup.contraption ?? null;
  let concessionDef = setup.concession ?? null;
  let boss = null;
  let rewards = setup.rewards ?? null;

  if (setup.boss) {
    const def = typeof setup.boss === 'string' ? listOf(data.bosses, 'bosses').find((b) => b.id === setup.boss) : setup.boss;
    if (!def) throw new Error(`createBattle: unknown boss "${setup.boss}"`);
    kind = 'boss';
    sourceId = def.id;
    name = def.title ? `${def.name}, ${def.title}` : def.name;
    scene = def.arena ?? null;
    const c = buildEnemy({ ...def, kind: def.id }, defs, { id: def.id, name: def.name, level: def.level, stats: def.stats });
    c.boss = true;
    if (Number.isFinite(def.mp)) { c.mp = def.mp; c.maxMp = def.mp; }
    add(c, enemies);
    defs.boss = { id: def.id, name: def.name, title: def.title ?? null, phases: def.phases ?? [], rewards: def.rewards ?? null };
    defs.bossRules = BOSS_RULES[def.id] ?? { concede: { who: 'any' } };
    boss = { id: def.id, phase: 0, phaseRound: 0, pending: null };
    contraptionDef = contraptionDef ?? def.contraption ?? null;
    concessionDef = concessionDef ?? def.concession ?? null;
    rewards = rewards ?? def.rewards ?? null;
  } else if (setup.encounter) {
    const def = typeof setup.encounter === 'string' ? listOf(data.encounters, 'encounters').find((e) => e.id === setup.encounter) : setup.encounter;
    if (!def) throw new Error(`createBattle: unknown encounter "${setup.encounter}"`);
    kind = 'encounter';
    sourceId = def.id;
    name = def.name;
    scene = firstSentence(def.text);
    const at = Number.isFinite(def.level) ? clampLevel(def.level) : level;
    const bench = benchmarkStat(at);
    for (const en of def.enemies ?? []) {
      const count = Math.max(1, Math.floor(num(en.count, 1)));
      const stats = {};
      for (const key of Object.keys(en.factors ?? {})) stats[key] = clampStat(Math.round(bench * en.factors[key]));
      for (let i = 0; i < count; i++) {
        add(buildEnemy(en, defs, { id: count > 1 ? `${en.id}_${i + 1}` : en.id, name: count > 1 ? `${en.name} ${tagOf(i)}` : en.name, level: at, stats }), enemies);
      }
    }
    contraptionDef = contraptionDef ?? def.contraption ?? null;
  }
  for (const en of setup.enemies ?? []) {
    add(buildEnemy(en, defs, { id: en.id, name: en.name ?? en.id, level: en.level ?? level, stats: en.stats }), enemies);
  }
  if (enemies.length === 0) throw new Error('createBattle: nothing to fight (give setup.encounter, setup.boss or setup.enemies)');

  const unsupported = { skills: [], passives: [] };
  for (const id of [...heroes, ...enemies]) {
    const c = combatants[id];
    for (const sid of c.skills) {
      const r = skillSupport(defs.skills[sid]);
      if (!r.ok && !unsupported.skills.some((x) => x.id === sid)) unsupported.skills.push({ id: sid, name: defs.skills[sid]?.name ?? sid, owner: c.kind ?? c.id, why: r.why });
    }
    for (const pid of c.passives) {
      if (!SUPPORTED_PASSIVES.includes(pid) && !unsupported.passives.some((x) => x.id === pid)) unsupported.passives.push({ id: pid, name: defs.passives[pid]?.name ?? pid, owner: c.id });
    }
  }

  const state = {
    version: 1,
    kind, sourceId, name, level,
    round: 0, seq: 0, over: false, result: null, outcome: null,
    combatants, heroes, enemies,
    order: [], turnIndex: 0, turn: null, acted: {},
    boss,
    contraption: contraptionDef ? { name: contraptionDef.name ?? 'the contraption', uses: contraptionDef.uses ?? 'once', used: false, effects: contraptionDef.effects ?? [] } : null,
    concession: concessionDef ? { name: concessionDef.name ?? 'Concede', at: num(concessionDef.at, 0), price: concessionDef.price ?? null, effects: concessionDef.effects ?? [] } : null,
    story: { trust: 0, rep: 0, goldPct: 0, goldFlat: 0 },
    voice: {}, voiceSalt: 0,
    rewards: null,
    rewardsDef: rewards,
    options: { breakdownChoice: 'storm_off', orPay: 'auto', standardStress: true, ...(setup.options ?? {}) },
    unsupported,
    defs,
    opening: [],
  };

  const B = { s: state, rng, events: [], choices: {} };
  refreshMods(state);
  const foeLabel = boss ? combatants[boss.id].name : `${enemies.length} ${enemies.length === 1 ? 'enemy' : 'enemies'}`;
  emit(B, 'start', { kind, name, level, scene, heroes: heroes.map((id) => combatants[id].name), enemies: foeLabel });
  startRound(B);
  advance(B);
  refreshMods(state);
  state.opening = B.events;
  return state;
}

// ---------------------------------------------------------------- reading a state

/** The id whose turn it is, or null when the battle is over. After createBattle and act this is always a hero. */
export function currentActor(state) {
  if (!state || state.over) return null;
  return state.turn?.actor ?? null;
}

function costOf(c, skill) {
  return { mp: hookOn(c, 'freeMp') ? 0 : Math.max(0, num(skill.cost?.mp)), limit: Math.max(0, num(skill.cost?.limit)) };
}

// Who a single-target move may be aimed at: provoked, then taunt, then anyone who is not hidden.
function aimable(s, actor) {
  const foes = fielded(s, foeSide(actor));
  const prov = statusOf(actor, 'provoked');
  if (prov && foes.includes(prov.by) && !has(C(s, prov.by), 'hidden')) return [prov.by];
  const taunters = foes.filter((id) => hookOn(C(s, id), 'taunt'));
  let ids = taunters.length ? taunters : foes;
  if (!taunters.length) {
    const seen = ids.filter((id) => !hookOn(C(s, id), 'unseen'));
    if (seen.length) ids = seen;
  }
  if (actor.side === HERO && refuses(actor, 'switch_target') && ids.includes(actor.flags?.lastTarget)) return [actor.flags.lastTarget];
  return ids;
}

function rowsOf(s, ids) {
  if (!ids.some((id) => C(s, id).row != null)) return [ids];
  const rows = new Map();
  for (const id of ids) {
    const key = C(s, id).row ?? 'none';
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(id);
  }
  return [...rows.values()];
}

function targetsFor(s, actor, skill) {
  const mode = skill.target ?? 'one';
  const mates = living(s, actor.side);
  switch (mode) {
    case 'self': return [actor.id];
    case 'allies': return SCRIPTED[skill.id]?.skipSelf ? mates.filter((id) => id !== actor.id) : mates;
    case 'ally': {
      const reviving = (skill.effects ?? []).some((fx) => fx.kind === 'revive');
      let ids = reviving ? sideIds(s, actor.side).filter((id) => C(s, id).hp <= 0 && !C(s, id).fled && !C(s, id).flags?.stormedOff) : mates;
      if (refuses(actor, 'ally_skill')) ids = ids.filter((id) => id === actor.id);
      return ids;
    }
    case 'all': return fielded(s, foeSide(actor));
    case 'row': return rowsOf(s, fielded(s, foeSide(actor))).map((row) => row[0]).filter(Boolean);
    default: return aimable(s, actor);
  }
}

function whyNot(s, actor, skill, cost) {
  const support = skillSupport(skill);
  if (!support.ok) return `not supported by the runner: ${support.why}`;
  const part = sealedBy(actor, skill);
  if (part) return `sealed: ${part} bound`;
  if (isHeroVal(actor) && skill.bands?.length && !hookOn(actor, 'allBands') && !canUseInBand(actor, skill)) {
    return `sealed at Airhead ${airheadOf(actor)}: needs ${skill.bands.join(' or ')}`;
  }
  if (cost.mp > actor.mp) return `needs ${cost.mp} MP, has ${actor.mp}`;
  if (cost.limit > actor.limit) return `needs ${cost.limit} Limit, has ${actor.limit}`;
  if (OFFENSIVE.includes(skill.target ?? 'one') && refuses(actor, 'attack', { allyBelow25: living(s, actor.side).some((id) => id !== actor.id && share(C(s, id)) < 0.25) })) {
    return 'will not attack while an ally is under a quarter health';
  }
  if (SCRIPTED[skill.id]?.notDuringExtra && s.turn?.extra) return 'cannot be used during an extra action';
  return null;
}

function skillEntry(s, actor, skill, stance) {
  const basic = skill.id === BASIC_ATTACK.id;
  const mode = skill.target ?? 'one';
  const cost = costOf(actor, skill);
  const entry = {
    kind: basic ? 'attack' : 'skill',
    skillId: skill.id,
    mode,
    choose: mode === 'one' || mode === 'ally' || mode === 'row',
    targets: targetsFor(s, actor, skill),
    label: `${stance ? `${stance === 'wing' ? 'Wing It' : 'Think It Through'}: ` : ''}${skill.name}`,
    cost,
  };
  if (stance) entry.stance = stance;
  const why = whyNot(s, actor, skill, cost) ?? (entry.targets.length === 0 ? 'no valid target' : null);
  if (why) { entry.disabled = true; entry.why = why; }
  return entry;
}

function concedeEntry(s, actor) {
  const k = s.concession;
  const boss = s.boss ? C(s, s.boss.id) : null;
  if (!k || !alive(boss) || share(boss) * 100 > k.at) return null;
  const rule = s.defs.bossRules?.concede ?? { who: 'any' };
  const val = isHeroVal(actor);
  const entry = { kind: 'concede', mode: 'self', choose: false, targets: [boss.id], label: k.name, price: k.price };
  if (rule.stance && val) entry.stance = rule.stance;
  const hero = s.heroes.map((id) => C(s, id)).find(isHeroVal);
  const need = -Math.min(0, ...k.effects.filter((fx) => fx.kind === 'limit').map((fx) => num(fx.amount)));
  let why = null;
  if (rule.who === 'valerie' && !val) why = 'only Valerie can do this';
  else if (rule.band && airheadBand(airheadOf(actor)) !== rule.band) why = 'Valerie must be a Total Airhead (gauge 67 or more)';
  else if (rule.notFlipped && actor.flags?.ledgerFlipped) why = 'the ledger is flipped';
  else if (need > 0 && (!hero || hero.limit < need)) why = `needs ${need} Limit`;
  if (why) { entry.disabled = true; entry.why = why; }
  return entry;
}

/**
 * What the acting hero may do right now, each with enough to render a button:
 *   { kind: 'attack' | 'skill' | 'guard' | 'breather' | 'concede', skillId?, stance?, mode, choose, targets: [ids],
 *     label, cost?, disabled?, why? }
 * choose: true means the caller picks one id from targets (mode one, ally or row); otherwise targets is who it reaches.
 * Anything sealed, unaffordable, refused or not supported comes back with disabled: true and a one-line why.
 * For Valerie every attack and skill appears once per legal stance.
 */
export function legalActions(state, actorId = currentActor(state)) {
  if (!state || state.over || actorId == null || actorId !== currentActor(state)) return [];
  const actor = C(state, actorId);
  if (!actor || actor.side !== HERO) return [];
  const stances = isHeroVal(actor) ? ['wing', 'think'] : [null];
  const out = [];
  for (const stance of stances) out.push(skillEntry(state, actor, BASIC_ATTACK, stance));
  for (const id of actor.skills) {
    const skill = state.defs.skills[id];
    if (!skill || (skill.tags ?? []).includes('passive')) continue;
    const mine = stances[0] === null ? stances : skill.stance ? [skill.stance] : stances;
    for (const stance of mine) out.push(skillEntry(state, actor, skill, stance));
  }
  const guard = { kind: 'guard', mode: 'self', choose: false, targets: [actor.id], label: 'Guard' };
  if (refuses(actor, 'guard')) { guard.disabled = true; guard.why = `will not Guard: ${actor.resolve?.name ?? 'refuses'}`; }
  else if (hookOn(actor, 'noGuard')) { guard.disabled = true; guard.why = 'cannot Guard right now'; }
  out.push(guard);
  const rest = { kind: 'breather', mode: 'self', choose: false, targets: [actor.id], label: 'Breather' };
  if (refuses(actor, 'breather')) { rest.disabled = true; rest.why = `will not take a Breather: ${actor.resolve?.name ?? 'refuses'}`; }
  out.push(rest);
  const concede = concedeEntry(state, actor);
  if (concede) out.push(concede);
  return out;
}

function matchAction(state, actorId, action) {
  if (!action || typeof action !== 'object') throw new Error('act: needs an action');
  const legal = legalActions(state, actorId);
  const simple = action.kind === 'guard' || action.kind === 'breather' || action.kind === 'concede';
  const wantSkill = action.skillId ?? (action.kind === 'attack' ? BASIC_ATTACK.id : null);
  const found = legal.find((e) => e.kind === action.kind && (simple || ((e.skillId ?? null) === wantSkill && (e.stance ?? null) === (action.stance ?? null))));
  const label = `${action.kind}${action.skillId ? ` ${action.skillId}` : ''}${action.stance ? ` (${action.stance})` : ''}`;
  if (!found) throw new Error(`act: "${label}" is not a legal action for ${actorId}`);
  if (found.disabled) throw new Error(`act: ${found.label} is not available: ${found.why}`);
  let target = action.target ?? null;
  if (found.choose) {
    if (target === null) target = found.targets[0];
    if (!found.targets.includes(target)) throw new Error(`act: ${found.label} cannot be aimed at "${target}"`);
  }
  return { ...found, target };
}

// ---------------------------------------------------------------- mods, statuses, binds

const PASSIVE_MODS = {
  war_p_seeing_red: (s, c, def) => (def?.effects ?? []).filter((fx) => fx.kind === 'mod' && fx.perStress > 0).map((fx) => {
    const raw = 1 + (fx.mult - 1) * Math.floor(c.stress / fx.perStress);
    const held = fx.mult >= 1 ? Math.min(num(fx.limitMult, raw), raw) : Math.max(num(fx.limitMult, raw), raw);
    return { stat: fx.stat, mult: Math.round(held * 100) / 100 };
  }),
  war_p_last_one_standing: (s, c, def) => (downedAllies(s, c) > 0 ? (def?.effects ?? []).filter((fx) => fx.kind === 'mod').map((fx) => ({ stat: fx.stat, mult: fx.mult })) : []),
  mag_p_ivory_tower: (s, c) => (c.hp >= c.maxHp ? [{ stat: 'INT', mult: 1.15 }] : c.hp < c.maxHp * 0.5 ? [{ stat: 'INT', mult: 0.9 }] : []),
};

// Passives that are an attribute multiplier "while something is true" are kept as mods and re-read here.
function refreshMods(s) {
  for (const id of s.heroes) {
    const c = C(s, id);
    if (!c.passives.length) continue;
    const kept = c.mods.filter((m) => !String(m.source).startsWith('passive:'));
    for (const pid of c.passives) {
      const fn = PASSIVE_MODS[pid];
      if (!fn || !alive(c)) continue;
      for (const m of fn(s, c, s.defs.passives[pid])) if (m.mult !== 1) kept.push({ stat: m.stat, mult: m.mult, turns: null, source: `passive:${pid}` });
    }
    c.mods = kept;
  }
}

function addMod(s, targetId, mod) {
  const c = C(s, targetId);
  c.mods = c.mods.filter((m) => !(m.source === mod.source && m.stat === mod.stat));
  c.mods.push({ stat: mod.stat, mult: mod.mult, turns: mod.turns ?? null, source: mod.source, by: mod.by ?? null, fresh: mod.turns != null && s.turn?.actor === targetId });
}

function gainLimit(B, id, amount) {
  const s = B.s;
  const c = C(s, id);
  if (amount > 0 && hasP(c, 'any_p_deep_breaths') && c.flags.guardedRound === s.round) return 0;
  const before = c.limit;
  c.limit = clamp(before + Math.round(amount), 0, SCALE.LIMIT_MAX);
  return c.limit - before;
}

// Stubborn (warrior): enemy binds on arms and legs run a turn short, every head bind a turn long.
function bindTurns(target, part, turns, fromFoe) {
  if (!hasP(target, 'war_p_stubborn')) return turns;
  if (part === 'head') return turns + 1;
  return fromFoe ? Math.max(1, turns - 1) : turns;
}

// Everything that follows from a part being bound, whoever bound it.
function onBind(B, targetId, part, byId = null) {
  const s = B.s;
  const target = C(s, targetId);
  if (part === 'arms') dropStatus(target, (st) => st.id === 'counter');
  if (s.boss?.id === targetId && s.boss.pending?.part === part) cancelPending(B, 'bind');
  const by = byId ? C(s, byId) : null;
  if (by && by.id !== targetId && hasP(by, 'rog_p_sticky_fingers')) gainLimit(B, byId, 6);
}

function clearPending(s) {
  if (!s.boss) return;
  s.boss.pending = null;
  dropStatus(C(s, s.boss.id), (st) => STATUS_HOOKS[st.id]?.windupMarker);
}

function cancelPending(B, reason) {
  const s = B.s;
  const p = s.boss?.pending;
  if (!p) return false;
  const boss = C(s, s.boss.id);
  clearPending(s);
  emit(B, 'cancel', { ...actorF(boss), move: p.move, moveName: s.defs.skills[p.move]?.name ?? p.move, reason, part: p.part });
  return true;
}

/**
 * Put one status on a list of combatants: one event for the lot. Instant statuses do their one thing and leave
 * nothing behind. opts: { turns, by, source, skillName, own, quiet }.
 */
function giveStatus(B, ids, id, opts = {}) {
  const s = B.s;
  const hook = STATUS_HOOKS[id];
  if (!hook || hook.unsupported) return;
  const def = s.defs.statuses[id];
  const actor = opts.by ? C(s, opts.by) : null;
  const rows = [];
  const blocked = [];
  let guardStripped = false;
  for (const tid of ids) {
    const t = C(s, tid);
    if (!alive(t)) continue;
    const row = { id: tid, name: t.name, you: isHeroVal(t) };
    if (hook.instant === 'remove') {
      // Only worth a beat when there was something to take off.
      if (dropStatus(t, (st) => hook.removes.includes(st.id)).length) rows.push(row);
      syncFlags(t);
      continue;
    }
    if (hook.instant) { rows.push(row); continue; }
    if (id === 'guard' && hookOn(t, 'noGuard')) { blocked.push(row); continue; }
    for (const gone of hook.strips ?? []) dropStatus(t, (st) => st.id === gone);
    dropStatus(t, (st) => st.id === id);
    const entry = { id, turns: Number.isFinite(opts.turns) ? opts.turns : null, by: opts.by ?? null, source: opts.source ?? null };
    entry.fresh = entry.turns !== null && s.turn?.actor === tid;
    if (hook.life === 'granter') {
      // Guard: one turn means "until the granter's next turn"; a longer one runs to the end of that many rounds.
      if (num(entry.turns, 1) <= 1) { entry.until = 'granter'; entry.by = opts.by ?? tid; entry.own = Boolean(opts.own); }
      else entry.untilRound = s.round + entry.turns - 1;
      entry.turns = null;
      if (Number.isFinite(opts.mult)) entry.mult = opts.mult;
    } else if (hook.life === 'round') {
      entry.untilRound = s.round;
      entry.turns = null;
    } else if (hook.windupMarker) {
      entry.turns = null; // lives exactly as long as the wind-up does
    }
    t.statuses.push(entry);
    if (id === 'hidden') t.flags.firstInFrom = s.round;
    if (id === 'analyzed' && t.boss && s.defs.bossRules?.analyzedStripsGuard && dropStatus(t, (st) => st.id === 'guard').length) guardStripped = true;
    syncFlags(t);
    rows.push(row);
  }
  const base = { ...actorF(actor), status: id, statusName: def?.name ?? id, turns: Number.isFinite(opts.turns) ? opts.turns : null, skillName: opts.skillName ?? null };
  const one = (list) => (list.length === 1 ? { target: list[0].id, targetName: list[0].name, targetYou: list[0].you, targetSide: C(s, list[0].id).side } : {});
  if (rows.length && !opts.quiet && !hook.windupMarker && hook.instant !== 'cancelWindup') emit(B, 'status', { ...base, ...one(rows), targets: rows, guardStripped });
  if (blocked.length && !opts.quiet) emit(B, 'status', { ...base, ...one(blocked), targets: blocked, blocked: true });
  if (!rows.length) return;
  if (hook.instant === 'cancelWindup') cancelPending(B, 'contraption');
  else if (hook.instant === 'concession') finish(B, 'win', 'concession');
  else if (hook.instant === 'repossess' && actor) {
    for (const row of rows) {
      const t = C(s, row.id);
      const taken = t.mods.filter((m) => m.turns != null && m.mult > 1);
      t.mods = t.mods.filter((m) => !taken.includes(m));
      for (const m of taken) addMod(s, actor.id, { stat: m.stat, mult: m.mult, turns: num(opts.turns, 2), source: `${id}:${m.source}`, by: actor.id });
    }
  }
}

// Cross one turn off everything timed that this combatant carries. Called at the end of its own turn.
function endOfTurnTick(B, id) {
  const s = B.s;
  let c = C(s, id);
  const worn = [];
  const boundBefore = boundParts(c);
  c = put(s, tickBinds(c));
  for (const part of boundBefore) if (!isBound(c, part)) worn.push(`${part} bind`);
  c.mods = c.mods.filter((m) => {
    if (m.turns == null) return true;
    if (m.fresh) { m.fresh = false; return true; }
    m.turns -= 1;
    if (m.turns > 0) return true;
    worn.push(modLabel(m));
    return false;
  });
  const ended = [];
  c.statuses = c.statuses.filter((st) => {
    if (st.turns == null) return true;
    if (st.fresh) { st.fresh = false; return true; }
    st.turns -= 1;
    if (st.turns > 0) return true;
    ended.push(st);
    return false;
  });
  for (const st of ended) worn.push(s.defs.statuses[st.id]?.name ?? st.id);
  syncFlags(c);
  if (worn.length) emit(B, 'expire', { ...targetF(c), what: worn });
  for (const st of ended) {
    const onEnd = STATUS_HOOKS[st.id]?.onEnd;
    if (onEnd === 'crash') {
      c = put(s, applyBind(C(s, id), 'head', bindTurns(C(s, id), 'head', 2, false)));
      emit(B, 'bind', { ...targetF(c), part: 'head', turns: c.binds.head, source: 'crash' });
    } else if (onEnd === 'gaugeReset') {
      const before = airheadOf(C(s, id));
      c = put(s, shiftAirhead(C(s, id), AIRHEAD.GOOD_HERO_RESET - before));
      emit(B, 'airhead', { ...targetF(c), before, after: airheadOf(c), reset: true });
    }
  }
}

// ---------------------------------------------------------------- stress

function stressMultOf(c, source) {
  if (!hasP(c, 'any_p_gallows_humour')) return 1;
  if (source === 'death') return 0;
  return source === 'embarrassment' ? 1.5 : 1;
}

// Put a stress hit on one bar and say what it set off. No events: the caller reports the group.
function landStress(B, id, base, o) {
  const s = B.s;
  const c = C(s, id);
  const source = o.source ?? 'general';
  const mult = c.side === HERO ? stressMultOf(c, source) : 1;
  const row = { id, name: c.name, you: isHeroVal(c), taken: 0, before: c.stress, after: c.stress, event: null };
  if (!alive(c)) return row;
  if (isHeroVal(c)) {
    const gaugeBefore = airheadOf(c);
    let r;
    if (o.ignoreWill || mult !== 1) {
      // The same steps as applyStressToValerie, with the caller's ignoreWill and multiplier carried through.
      const f = stressFilter(c, base, source);
      const hit = f.amount === 0 ? { combatant: c, taken: 0, before: c.stress, after: c.stress, event: null } : applyStress(c, f.amount, { source, ignoreWill: f.ignoreWill || Boolean(o.ignoreWill), mult });
      r = { ...hit, combatant: f.airheadDelta ? shiftAirhead(hit.combatant, f.airheadDelta) : hit.combatant, allyRelief: f.allyRelief, note: f.note };
    } else {
      r = applyStressToValerie(c, base, source);
    }
    put(s, r.combatant);
    return { ...row, taken: r.taken, before: r.before, after: r.after, event: r.event, noticed: !(r.taken === 0 && r.allyRelief > 0) && !(r.taken === 0 && r.note), allyRelief: r.allyRelief, note: r.note, gaugeBefore, gaugeAfter: airheadOf(r.combatant) };
  }
  const r = applyStress(c, base, { source, ignoreWill: Boolean(o.ignoreWill), mult });
  put(s, r.combatant);
  return { ...row, taken: r.taken, before: r.before, after: r.after, event: r.event };
}

function afterStress(B, row) {
  const s = B.s;
  if (!row.event || s.over) return;
  const c = C(s, row.id);
  if (c.side === HERO) {
    if (row.event === 'resolve') doResolve(B, row.id);
    else if (row.event === 'breakdown') doBreakdown(B, row.id);
    return;
  }
  const e = enemyStressEvent(c, row.event);
  put(s, e.combatant);
  emit(B, 'enemy_stress', { ...targetF(C(s, row.id)), status: e.status, stress: C(s, row.id).stress, defeated: e.defeated, loseTurn: e.loseTurn });
  if (e.defeated) defeat(B, row.id, { routed: true });
  else if (e.loseTurn) C(s, row.id).flags.loseActions = num(C(s, row.id).flags.loseActions) + 1;
}

/**
 * A stress hit of `base` on a list of combatants. World stress goes through Willpower; party stress passes
 * ignoreWill. One event for the allies, one for Valerie (her filter is its own beat), one for enemies.
 * o: { source, ignoreWill, by, skillName, reason }.
 */
function stressGroup(B, ids, base, o = {}) {
  const s = B.s;
  if (!(base > 0)) return;
  const by = o.by ? C(s, o.by) : null;
  const common = { ...actorF(by), byName: by?.name ?? null, base, source: o.source ?? 'general', flat: Boolean(o.ignoreWill), skillName: o.skillName ?? null, reason: o.reason ?? null };
  const up = ids.filter((id) => alive(C(s, id)));
  const groups = [
    up.filter((id) => C(s, id).side === HERO && !isHeroVal(C(s, id))),
    up.filter((id) => C(s, id).side === FOE),
  ];
  for (const group of groups) {
    if (!group.length || s.over) continue;
    const rows = group.map((id) => landStress(B, id, base, o));
    const first = C(s, rows[0].id);
    emit(B, 'stress', { ...common, ...(rows.length === 1 ? targetF(first) : { targetSide: first.side }), targets: rows.map(({ event, ...r }) => r) });
    for (const row of rows) afterStress(B, row);
  }
  for (const id of up.filter((x) => isHeroVal(C(s, x)))) {
    if (s.over || !alive(C(s, id))) continue;
    const row = landStress(B, id, base, o);
    const { event, ...shown } = row;
    emit(B, 'stress', { ...common, ...targetF(C(s, id)), targets: [shown], allyRelief: row.allyRelief ?? 0 });
    // Inspirational Ignorance: everyone who saw her shrug it off sheds a little.
    if (row.allyRelief > 0) relief(B, living(s, HERO).filter((x) => x !== id), row.allyRelief, { from: 'other', quiet: true });
    afterStress(B, row);
  }
}

function standardStress(B, sourceId, ids) {
  const s = B.s;
  if (s.options.standardStress === false || s.over) return;
  const byLevel = new Map();
  for (const id of ids) {
    const c = C(s, id);
    if (!alive(c) || c.side !== HERO) continue;
    if (!byLevel.has(c.level)) byLevel.set(c.level, []);
    byLevel.get(c.level).push(id);
  }
  for (const [level, group] of byLevel) {
    const src = stressFor(sourceId, level);
    stressGroup(B, group, src.base, { source: src.source, reason: sourceId });
  }
}

/** Take stress off a list of combatants. o: { from, actor, reason, skillName, quiet }. */
function relief(B, ids, amount, o = {}) {
  const s = B.s;
  const rows = [];
  for (const id of ids) {
    const c = C(s, id);
    if (!alive(c)) continue;
    const from = id === o.actor ? 'self' : o.from ?? 'ally';
    const r = relieveStress(c, amount, { from });
    put(s, r.combatant);
    syncFlags(C(s, id));
    rows.push({ id, name: c.name, you: isHeroVal(c), before: r.before, after: r.after, relieved: r.relieved, refused: r.refused, calmed: r.calmed, stateName: r.ended?.name ?? null, mark: r.mark?.name ?? null });
  }
  if (!rows.length) return rows;
  const actor = o.actor ? C(s, o.actor) : null;
  if (!o.quiet) emit(B, 'relief', { ...actorF(actor), ...(rows.length === 1 ? targetF(C(s, rows[0].id)) : {}), targets: rows, amount, reason: o.reason ?? null, skillName: o.skillName ?? null });
  for (const row of rows) if (row.calmed) emit(B, 'calm', { ...targetF(C(s, row.id)), stateName: row.stateName, mark: row.mark });
  return rows;
}

function doResolve(B, id) {
  const s = B.s;
  const member = C(s, id);
  const others = s.heroes.filter((x) => x !== id).map((x) => C(s, x));
  const rc = partyResolveCheck(member, others, B.rng, { tables: s.defs.tables, personal: s.defs.personal ?? undefined });
  put(s, rc.combatant);
  syncFlags(C(s, id));
  emit(B, 'resolve', {
    ...targetF(C(s, id)), roll: rc.roll, virtuePct: rc.virtuePct, kind: rc.kind, entryId: rc.entry.id, entryName: rc.entry.name,
    quote: rc.entry.quote ?? null, permanent: rc.permanent, personal: rc.personal, partyStress: rc.party?.stress ?? 0, stress: rc.combatant.stress, heal: rc.heal,
  });
  if (rc.heal > 0) emit(B, 'heal', { ...targetF(C(s, id)), amount: rc.heal, hpBefore: C(s, id).hp - rc.heal, hpAfter: C(s, id).hp, source: 'resolve' });
  if (!rc.party) return;
  const mates = living(s, HERO).filter((x) => x !== id);
  if (rc.party.stress > 0) stressGroup(B, mates, rc.party.stress, { source: rc.party.source, ignoreWill: true, by: id, reason: 'resolve' });
  else relief(B, mates, -rc.party.stress, { from: 'other', actor: id, reason: 'virtue' });
}

function breakdownChoice(B, id) {
  const pick = (v) => (typeof v === 'string' ? v : v?.[id]);
  const choice = pick(B.choices.breakdown) ?? pick(B.s.options.breakdownChoice) ?? 'storm_off';
  return BREAKDOWN.CHOICES.includes(choice) ? choice : 'storm_off';
}

function doBreakdown(B, id) {
  const s = B.s;
  const r = breakdown(C(s, id), { choice: breakdownChoice(B, id) });
  put(s, r.combatant);
  const c = C(s, id);
  emit(B, 'breakdown', { ...targetF(c), choice: r.choice, forced: r.forced, out: r.out, partyStress: r.party?.stress ?? 0, mark: r.mark?.name ?? null, stress: c.stress });
  if (r.out) {
    leaveField(s, id);
    if (s.turn?.actor === id) s.turn.actionsLeft = 0;
    if (checkEnd(B)) return;
  }
  if (r.party) stressGroup(B, living(s, HERO).filter((x) => x !== id), r.party.stress, { source: r.party.source, ignoreWill: true, by: id, reason: 'breakdown' });
}

// ---------------------------------------------------------------- damage, healing, leaving the field

// Take HP off. Returns what happened so the caller can report it before the consequences are played out.
function hurt(B, id, amount) {
  const s = B.s;
  const c = C(s, id);
  const before = c.hp;
  const dealt = Math.max(0, Math.round(num(amount)));
  let after = Math.max(0, before - dealt);
  const info = { id, before, after, saved: null, paid: 0 };
  if (after === 0 && before > 0) {
    // Mind Over Matter (mage): once a round, the rest of a lethal hit is paid in MP at 1 MP per 4 HP.
    if (hasP(c, 'mag_p_mind_over_matter') && c.flags.mindOverMatter !== s.round) {
      const price = Math.ceil((dealt - (before - 1)) / 4);
      if (c.mp >= price) { c.flags.mindOverMatter = s.round; c.mp -= price; after = 1; info.paid = price; }
    }
    // Plot Armor (Valerie, level 80): once a battle, a Luck check at normal difficulty, + Airhead / 5.
    if (after === 0 && isHeroVal(c) && c.skills.includes('val_plot_armor') && !c.flags.plotArmorUsed) {
      c.flags.plotArmorUsed = true;
      const check = statCheck(effectiveStat(c, 'LCK'), difficultyDc(c.level, 'normal'), B.rng, { bonus: Math.floor(airheadOf(c) / 5) });
      info.saved = { roll: check.roll, pct: check.pct, success: check.success };
      if (check.success) after = 1;
    }
  }
  c.hp = after;
  info.after = after;
  return info;
}

function afterHurt(B, info, by = null) {
  const s = B.s;
  if (s.over) return;
  const c = C(s, info.id);
  if (info.saved) emit(B, 'plot_armor', { ...targetF(c), ...info.saved });
  if (info.paid) emit(B, 'pay', { ...targetF(c), mp: info.paid, lethal: true, skillName: 'Mind Over Matter' });
  if (info.after <= 0 && info.before > 0) { defeat(B, info.id, { by }); return; }
  if (c.side === HERO && !c.flags.brink && info.before >= c.maxHp * 0.25 && info.after < c.maxHp * 0.25) {
    c.flags.brink = true;
    standardStress(B, 'brink', [info.id]);
  }
  if (c.boss) checkPhase(B);
}

// Out of the fight: nothing timed stays on them, and whatever they were holding up for others goes too.
function leaveField(s, id) {
  let c = C(s, id);
  c.statuses = [];
  c.dots = [];
  c.mods = c.mods.filter((m) => m.turns == null);
  c = put(s, cureBinds(c));
  syncFlags(c);
  for (const oid of allIds(s)) {
    if (oid === id) continue;
    dropStatus(C(s, oid), (st) => st.by === id && (st.until === 'granter' || st.id === 'covered' || st.id === 'provoked'));
  }
  if (s.boss?.id === id) clearPending(s);
}

function defeat(B, id, { by = null, routed = false } = {}) {
  const s = B.s;
  const c = C(s, id);
  if (routed) c.fled = true;
  else c.hp = 0;
  leaveField(s, id);
  if (c.side === HERO) C(s, id).flags.downed = true;
  const killer = by ? C(s, by) : null;
  emit(B, 'defeat', { ...targetF(C(s, id)), by, byName: killer?.name ?? null, routed, boss: Boolean(c.boss) });
  if (s.turn?.actor === id) s.turn.actionsLeft = 0;
  if (checkEnd(B)) return;
  if (c.side === HERO) {
    const mates = living(s, HERO);
    standardStress(B, 'ally_down', mates);
    for (const mid of mates) if (!s.over && hasP(C(s, mid), 'rog_p_cut_and_run')) stressGroup(B, [mid], 8, { source: 'death', ignoreWill: true, reason: 'ally_down' });
    return;
  }
  if (killer && alive(killer) && hasP(killer, 'rog_p_cut_and_run')) giveStatus(B, [by], 'hidden', { turns: 1, by, skillName: 'Cut and Run' });
  const amused = living(s, HERO).filter((hid) => hasP(C(s, hid), 'any_p_gallows_humour'));
  if (amused.length) relief(B, amused, 5, { from: 'self', reason: 'skill', skillName: 'Gallows Humour' });
}

function healOne(B, actorId, targetId, amount, o = {}) {
  const s = B.s;
  const actor = actorId ? C(s, actorId) : null;
  let t = C(s, targetId);
  if (!alive(t)) return 0;
  const base = { ...actorF(actor), ...targetF(t), skillName: o.skillName ?? null, source: o.source ?? 'skill' };
  if (actor && actorId !== targetId && actor.side === t.side) {
    const first = consumeFirstRefusal(t, 'heal');
    t = put(s, first.combatant);
    if (first.refused || refuses(t, 'heal')) { emit(B, 'heal', { ...base, amount: 0, refused: true }); return 0; }
  }
  const before = t.hp;
  t.hp = Math.min(t.maxHp, before + Math.max(0, Math.round(amount)));
  emit(B, 'heal', { ...base, amount: t.hp - before, hpBefore: before, hpAfter: t.hp });
  return t.hp - before;
}

function rewardsOf(s) {
  let exp = 0;
  let gold = 0;
  if (s.rewardsDef) { exp = num(s.rewardsDef.exp); gold = num(s.rewardsDef.gold); }
  else for (const id of s.enemies) { const e = C(s, id); exp += expYield(e.level, e.rank); gold += goldYield(e.level, e.rank); }
  let mult = 1 + s.story.goldPct / 100;
  for (const id of s.heroes) for (const fx of effectsOf(C(s, id), 'gold')) mult *= num(fx.mult, 1);
  return { exp, gold: Math.max(0, Math.round(gold * mult) + s.story.goldFlat) };
}

function finish(B, result, outcome = result) {
  const s = B.s;
  if (s.over) return;
  s.over = true;
  s.result = result;
  s.outcome = outcome;
  s.turn = null;
  if (s.boss) clearPending(s);
  const won = result === 'win';
  s.rewards = won ? rewardsOf(s) : { exp: 0, gold: 0 };
  // The same housekeeping the stress and bind modules ask for at the end of any battle.
  for (const id of s.heroes) {
    let c = C(s, id);
    c = put(s, endBattleBinds(endBattle(c, { won, boss: Boolean(s.boss) }).combatant));
    c.statuses = [];
    c.dots = [];
    c.mods = c.mods.filter((m) => m.turns == null && !String(m.source).startsWith('passive:'));
    syncFlags(c);
  }
  const bossName = s.boss ? C(s, s.boss.id).name : null;
  emit(B, 'end', { result, outcome, rounds: s.round, name: s.name, bossName, rewards: s.rewards, story: { trust: s.story.trust, rep: s.story.rep }, standing: s.heroes.filter((id) => C(s, id).hp > 0).map((id) => C(s, id).name) });
}

function checkEnd(B) {
  const s = B.s;
  if (s.over) return true;
  if (living(s, HERO).length === 0) { finish(B, 'loss', 'defeat'); return true; }
  if (living(s, FOE).length === 0) { finish(B, 'win', 'victory'); return true; }
  return false;
}

// ---------------------------------------------------------------- the hero's accidents

function triggerContraption(B, byId) {
  const s = B.s;
  const k = s.contraption;
  if (!k || k.used || s.over) return false;
  k.used = true;
  emit(B, 'contraption', { ...actorF(C(s, byId)), name: k.name, uses: k.uses });
  for (const fx of k.effects) {
    if (s.over) break;
    let ids;
    if (fx.target === 'boss') ids = s.boss ? [s.boss.id] : [];
    else if (fx.target === 'valerie') ids = living(s, HERO).filter((id) => isHeroVal(C(s, id)));
    else if (fx.target === 'heroes') ids = living(s, HERO);
    else ids = living(s, FOE);
    if (Number.isFinite(fx.count)) ids = ids.slice(0, fx.count);
    ids = ids.filter((id) => alive(C(s, id)));
    if (fx.kind === 'gold') { s.story.goldPct += num(fx.pct); continue; }
    if (fx.kind === 'damage') {
      for (const id of ids) {
        if (s.over) break;
        const t = C(s, id);
        const info = hurt(B, id, (t.maxHp * num(fx.hpPct)) / 100);
        emit(B, 'damage', { ...targetF(C(s, id)), amount: info.before - info.after, hpBefore: info.before, hpAfter: info.after, source: 'contraption', name: k.name });
        afterHurt(B, info, byId);
      }
    } else if (fx.kind === 'bind') {
      // A contraption does not ask the target's bind resistance for permission.
      for (const id of ids) {
        const t = put(s, applyBind(C(s, id), fx.part, fx.turns ?? 2, { ownTurn: s.turn?.actor === id }));
        emit(B, 'bind', { ...targetF(t), part: fx.part, turns: t.binds[fx.part], source: 'contraption' });
        onBind(B, id, fx.part);
      }
    } else if (fx.kind === 'status' && ids.length) {
      giveStatus(B, ids, fx.id, { turns: fx.turns, by: byId, source: 'contraption', skillName: k.name });
    }
  }
  return true;
}

// An Accidental Chaos Wave: valerie.chaosWave says what it does, this applies it.
function applyWave(B, valId, wave, roll) {
  const s = B.s;
  const foes = fielded(s, FOE);
  let guardsBroken = 0;
  const limitBefore = C(s, valId).limit;
  for (const fx of wave.effects) {
    if (fx.kind === 'mod') for (const id of foes) addMod(s, id, { stat: fx.stat, mult: fx.mult, turns: fx.turns, source: fx.source ?? wave.id, by: valId });
    else if (fx.kind === 'status' && fx.id === 'guard_broken') {
      for (const id of foes) if (has(C(s, id), 'guard')) guardsBroken += 1;
      giveStatus(B, foes, 'guard_broken', { turns: 1, by: valId, source: wave.id, quiet: true });
    } else if (fx.kind === 'limit') gainLimit(B, valId, fx.amount);
  }
  emit(B, 'chaos_wave', { ...actorF(C(s, valId)), roll, jackpot: wave.jackpot, enemies: foes.length, only: foes.length === 1 ? C(s, foes[0]).name : null, guardsBroken, limitBefore, limitAfter: C(s, valId).limit });
  const blast = wave.effects.find((fx) => fx.kind === 'damage');
  if (blast) {
    const hit = { id: 'val_chaos_wave', name: 'Accidental Chaos Wave', type: 'physical', stat: blast.stat ?? 'STR', power: blast.power, element: blast.element ?? 'phys' };
    for (const id of foes) {
      if (s.over || !alive(C(s, id))) continue;
      const info = hurt(B, id, damage(C(s, valId), C(s, id), hit, { variance: 1 }));
      emit(B, 'damage', { ...actorF(C(s, valId)), ...targetF(C(s, id)), amount: info.before - info.after, hpBefore: info.before, hpAfter: info.after, source: 'jackpot', skillName: hit.name });
      afterHurt(B, info, valId);
    }
  }
  if (!s.over && wave.effects.some((fx) => fx.kind === 'contraption')) triggerContraption(B, valId);
}

// What a stance costs before the dice: the stress now, the gauge once the dice are down. Returns the gauge delta.
function applyStance(B, id, stance) {
  const s = B.s;
  let c = C(s, id);
  const fx = stanceEffects(c, stance);
  const gaugeBefore = airheadOf(c);
  const stressBefore = c.stress;
  // Think It Through: 4 stress that Willpower cannot reduce. Wing It: ignorance is bliss. Neither goes through
  // her realization filter, because the stance has already moved the gauge.
  const r = fx.stress.amount < 0
    ? { ...relieveStress(c, -fx.stress.amount, { from: 'self' }), event: null }
    : applyStress(c, fx.stress.amount, { source: fx.stress.source, ignoreWill: true });
  c = put(s, r.combatant);
  emit(B, 'stance', { ...actorF(c), stance, gaugeBefore, gaugeAfter: airheadOf(shiftAirhead(c, fx.airheadDelta)), stressBefore, stressAfter: c.stress });
  if (r.calmed) emit(B, 'calm', { ...targetF(c), stateName: r.ended?.name ?? null, mark: r.mark?.name ?? null });
  afterStress(B, { id, event: r.event });
  return fx.airheadDelta;
}

// ---------------------------------------------------------------- one attack roll

function firstInCount(s, c) {
  return s.round - num(c.flags?.firstInFrom);
}

// Everything outside the two combatants' own attributes that moves this roll or its damage.
function attackMods(B, actor, target, skill) {
  const s = B.s;
  const m = { hitBonus: 0, critBonus: 0, dealt: 1, taken: 1, guardMult: guardMultOf(target), affinity: wardedAffinity(target, skill), valAnalyzed: false };
  const damaging = num(skill.power) > 0;
  for (const st of target.statuses ?? []) {
    const h = STATUS_HOOKS[st.id];
    if (!h) continue;
    if (h.hitAgainst) { if (st.id === 'analyzed' && isHeroVal(actor)) m.valAnalyzed = true; else m.hitBonus += h.hitAgainst; }
    if (h.critAgainst) m.critBonus += h.critAgainst;
    if (h.taken) m.taken *= h.taken;
  }
  m.taken *= trussedDamageMult(target);
  for (const st of actor.statuses ?? []) {
    const h = STATUS_HOOKS[st.id];
    if (!h) continue;
    if (h.critOwn) m.critBonus += h.critOwn;
    if (h.dealt && damaging) m.dealt *= h.dealt;
  }
  if (hasP(actor, 'rog_p_first_in')) {
    const n = firstInCount(s, actor);
    if (n <= 2) m.critBonus += 15;
    else if (n >= 6) m.hitBonus -= 10;
  }
  if (hasP(actor, 'rog_p_kick_em') && damaging) m.dealt *= boundParts(target).length > 0 ? 1.25 : 0.9;
  if (actor.flags?.luckyCharmUsed) m.critBonus -= 5;
  if (hasP(target, 'rog_p_travelling_light')) {
    if (target.flags.aimedRound !== s.round) m.hitBonus -= 15;
    if (target.hp > target.maxHp * 0.5) m.taken *= 1.15;
  }
  return m;
}

/**
 * One d100: `actorId` attacks `targetId` with `skill`. Applies the damage, reports it, then plays out what
 * follows (stress, defeat, the Chaos Wave, the effects that ride on a hit, a counter).
 * o: { stance, redirect, counter, friendly }. Returns { outcome, landed, roll }.
 */
function rollOne(B, actorId, targetId, skillIn, o = {}) {
  const s = B.s;
  refreshMods(s);
  const actor = C(s, actorId);
  const target = C(s, targetId);
  const script = SCRIPTED[skillIn.id] ?? {};
  const skill = script.reskill ? script.reskill(skillIn, actor, target, s) : skillIn;
  const m = attackMods(B, actor, target, skill);
  if (hasP(target, 'rog_p_travelling_light')) target.flags.aimedRound = s.round;
  const valTarget = isHeroVal(target) && actor.side === FOE;
  const valActor = isHeroVal(actor) && Boolean(o.stance);
  const guardFlag = m.guardMult === GUARD_MULT;
  const looseGuard = m.guardMult < 1 && !guardFlag ? m.guardMult : 1; // a part-guard (not ×0.5) goes in as a plain multiplier

  let outcome; let roll; let hitPct; let critPct; let fumbleFrom; let dmg = 0; let absorbed = false; let affinity = 'normal';
  let reflected = 0; let selfBind = null; let limitGain = 0; let dodged = false; let wave = null; let autoCrit = false;

  if (valTarget) {
    // One call, one d100: her lowered ceiling, the bounce band and the widened fumble band.
    const own = (target.statuses ?? []).some((st) => st.id === 'guard' && st.own);
    const st = withStateOpts(actor, {});
    const skillX = { ...skill, acc: num(skill.acc) + m.hitBonus + num(st.hitBonus), crit: num(skill.crit) + m.critBonus + num(st.critBonus) };
    const valX = m.affinity ? { ...target, affinities: { ...target.affinities, [skill.element ?? 'phys']: m.affinity } } : target;
    const e = enemyAttacksValerie(actor, valX, skillX, B.rng, { guarding: own });
    ({ outcome, roll, hitPct, critPct, fumbleFrom } = e);
    dmg = e.damage; reflected = e.reflected; selfBind = e.selfBind; limitGain = e.limitGain;
    // A Rattled attacker fumbles five sooner. That edge sits on top of her aura's; the roll is read again, not rerolled.
    if (Number.isFinite(st.fumbleFrom) && st.fumbleFrom < FUMBLE_FROM) {
      const edge = e.fumbleFrom + (st.fumbleFrom - FUMBLE_FROM);
      if (outcome !== 'fumble' && readIncoming(roll, { hitPct, critPct, fumbleFrom: edge, bounce: e.bounce }) === 'fumble') {
        outcome = 'fumble'; dmg = 0; reflected = 0; selfBind = befuddledPart(roll); limitGain = LIMIT_ON_ENEMY_FUMBLE;
      }
      fumbleFrom = edge;
    }
    // Multipliers the one-call helper has no slot for are applied to its figure.
    const mult = m.taken * m.dealt * num(st.damageMult, 1) * (own ? 1 : m.guardMult);
    if (dmg > 0 && mult !== 1) dmg = Math.max(1, Math.floor(dmg * mult + 1e-9));
    if (reflected > 0) reflected = Math.max(1, Math.floor(reflected * trussedDamageMult(actor) + 1e-9));
    dodged = outcome === 'miss' && roll <= hitChance(actor, valX, skillX, {}).hitPct;
    affinity = m.affinity ?? (target.affinities?.[skill.element ?? 'phys'] ?? 'normal');
  } else {
    const opts = { damageMult: m.dealt * m.taken * looseGuard, guard: guardFlag };
    if (m.affinity) opts.affinity = m.affinity;
    let r; let used;
    if (valActor) {
      // Her stance moves the bands; anything else on the roll is added to the stance's own numbers, not swapped for them.
      const fx = stanceEffects(actor, o.stance);
      const hit = num(fx.opts.hitBonus) + m.hitBonus;
      const crit = num(fx.opts.critBonus) + m.critBonus;
      opts.hitBonus = hit;
      opts.critBonus = crit;
      const sk = skill.bands && hookOn(actor, 'allBands') ? { ...skill, bands: undefined } : skill;
      const tgt = m.valAnalyzed ? { ...target, flags: { ...target.flags, analyzed: true } } : target;
      r = valerieAttacks(actor, tgt, sk, o.stance, B.rng, opts);
      used = withStateOpts(actor, { ...fx.opts, ...opts });
      // She can only fall over once per action: a second fumble in the same swing is a plain fumble.
      wave = o.once?.waved ? null : r.wave;
      if (wave && o.once) o.once.waved = true;
    } else {
      if (m.valAnalyzed) m.hitBonus += ANALYZED_HIT_BONUS;
      if (m.hitBonus) opts.hitBonus = m.hitBonus;
      if (m.critBonus) opts.critBonus = m.critBonus;
      used = withStateOpts(actor, opts);
      r = resolveAttack(actor, target, skill, B.rng, used);
    }
    ({ outcome, roll, hitPct, critPct, fumbleFrom, affinity, absorbed } = r);
    dmg = r.damage;
    // Lucky Charm: the first fumble of the battle is a plain miss (and, on Valerie, no wave).
    if (outcome === 'fumble' && hasP(actor, 'any_p_lucky_charm') && !actor.flags.luckyCharmUsed) {
      actor.flags.luckyCharmUsed = true;
      outcome = 'miss';
      wave = null;
    }
    // "A hit is an automatic crit": the roll stands, the damage is read again as a crit.
    const clicks = valActor && o.stance === 'think' && skill.id !== BASIC_ATTACK.id && hookOn(actor, 'autoCritThink');
    if (outcome === 'hit' && (clicks || script.autoCrit?.(actor, target))) {
      outcome = 'crit';
      autoCrit = true;
      dmg = damage(actor, target, skill, { crit: true, variance: r.variance, guard: Boolean(used.guard), affinity, damageMult: num(used.damageMult, 1) });
    }
  }

  const landed = outcome === 'hit' || outcome === 'crit';
  let info = null; let back = null; let healed = 0;
  if (landed && absorbed) {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, before + dmg);
    healed = target.hp - before;
  } else if (landed && dmg > 0) info = hurt(B, targetId, dmg);
  if (reflected > 0) back = hurt(B, actorId, reflected);
  if (outcome === 'fumble' && valTarget && selfBind) put(s, befuddle(C(s, actorId), roll).combatant);
  if (limitGain > 0) limitGain = gainLimit(B, targetId, limitGain);
  let critRelief = null;
  if (outcome === 'crit' && actor.side === HERO && s.options.standardStress !== false) critRelief = relieveStress(C(s, actorId), RELIEF.CRIT, { from: 'self' });
  if (critRelief) put(s, critRelief.combatant);
  if (actor.side === HERO && (skillIn.target ?? 'one') === 'one') C(s, actorId).flags.lastTarget = targetId;

  const aim = o.redirect?.why ? o.redirect : (skill.target ?? 'one') === 'one' && actor.side !== target.side
    ? statusOf(actor, 'provoked')?.by === targetId ? { why: 'provoked' } : hookOn(target, 'taunt') ? { why: 'taunt' } : null
    : null;
  emit(B, 'attack', {
    ...actorF(actor), ...targetF(target), skill: skillIn.id, skillName: skillIn.name, stance: valActor ? o.stance : undefined,
    roll, hitPct, critPct, fumbleFrom, outcome, dodged, damage: landed ? dmg : 0, powered: num(skill.power) > 0, absorbed, affinity,
    reflected, selfBind, limitGain, guarded: landed && m.guardMult < 1, autoCrit, counter: Boolean(o.counter), friendly: actor.side === target.side,
    wave: Boolean(wave), hpBefore: info ? info.before : target.hp - healed, hpAfter: C(s, targetId).hp, targetMaxHp: target.maxHp,
    redirect: aim ? { why: aim.why, from: aim.from ?? null, fromName: aim.from ? C(s, aim.from).name : null } : null,
  });

  // --- what follows from it
  if (critRelief?.calmed) emit(B, 'calm', { ...targetF(C(s, actorId)), stateName: critRelief.ended?.name ?? null, mark: critRelief.mark?.name ?? null });
  if (info) afterHurt(B, info, actorId);
  if (back) afterHurt(B, back, targetId);
  if (s.over) return { outcome, landed, roll };
  if (outcome === 'fumble' && valTarget && selfBind) onBind(B, actorId, selfBind);
  if (landed) {
    const hitNow = C(s, targetId);
    if (outcome === 'crit' && hitNow.side === HERO && alive(hitNow)) standardStress(B, 'crit_taken', [targetId]);
    if (outcome === 'crit' && hasP(actor, 'rog_p_sticky_fingers')) gainLimit(B, actorId, 6);
    if (hasP(hitNow, 'war_p_doorstop') && aim && alive(hitNow)) {
      const d = hitNow.flags.doorstop?.round === s.round ? hitNow.flags.doorstop : { round: s.round, n: 0 };
      if (d.n < 2) { d.n += 1; hitNow.flags.doorstop = d; gainLimit(B, targetId, 8); }
    }
    if (hasP(actor, 'mag_p_marginalia') && skill.type === 'magical' && actor.side !== target.side) {
      const key = `${targetId}:${skill.element ?? 'phys'}`;
      const seen = actor.flags.marginalia ?? {};
      if (!seen[key]) { C(s, actorId).flags.marginalia = { ...seen, [key]: true }; gainLimit(B, actorId, 6); }
      if (affinity === 'weak') gainLimit(B, actorId, 8);
    }
  } else if (actor.side === HERO && !s.over) {
    if (outcome === 'fumble' && !wave && !(valActor && o.stance === 'wing')) standardStress(B, 'fumble', [actorId]);
    // A critic in the party (Backseat Hero, Running Commentary) has notes on a miss.
    for (const hid of living(s, HERO)) {
      if (hid === actorId || s.over) continue;
      const note = effectsOf(C(s, hid), 'heckle').find((fx) => (fx.on ?? []).includes(outcome));
      if (note && alive(C(s, actorId))) stressGroup(B, [actorId], note.stress, { source: 'mental', ignoreWill: true, by: hid, reason: 'heckle' });
    }
  }
  if (wave && !s.over) applyWave(B, actorId, wave, roll);
  if (landed && !s.over && alive(C(s, targetId))) runEffects(B, actorId, skillIn, { scope: 'hit', hit: [targetId], rolls: { [targetId]: { roll, outcome, stance: valActor ? o.stance : undefined } } });
  // Counter Stance: every melee attack rolled against them, hit or miss, is answered.
  if (!s.over && !o.counter && actor.side !== target.side && (skill.tags ?? []).includes('melee')) {
    const t = C(s, targetId);
    if (alive(t) && alive(C(s, actorId)) && has(t, 'counter') && !isBound(t, 'arms')) rollOne(B, targetId, actorId, BASIC_ATTACK, { counter: true });
  }
  return { outcome, landed, roll };
}

// A pure bind skill (Closed Book, Accidental Trip) rolls its own die through tryBind.
function isPureBind(skill) {
  const rest = (skill.effects ?? []).filter((fx) => fx.target !== 'self');
  return !skill.auto && !(num(skill.power) > 0) && rest.length > 0 && rest.every((fx) => fx.kind === 'bind');
}

function bindRoll(B, actorId, targetId, skill, o = {}) {
  const s = B.s;
  const actor = C(s, actorId);
  const target = C(s, targetId);
  const val = isHeroVal(actor) && Boolean(o.stance);
  const st = withStateOpts(actor, val ? stanceEffects(actor, o.stance).opts : {});
  const rolls = {};
  let first = null;
  for (const fx of skill.effects.filter((x) => x.kind === 'bind' && x.target !== 'self')) {
    const turns = bindTurns(C(s, targetId), fx.part, fx.turns ?? 2, actor.side !== target.side);
    const opts = { fumbleFrom: st.fumbleFrom, ownTurn: s.turn?.actor === targetId };
    if (first) opts.roll = first.roll; // more parts on one skill are read off the same die
    if (val && o.stance === 'wing') opts.backfire = false; // her fumble is a Chaos Wave, not a backfire
    const r = tryBind(C(s, actorId), C(s, targetId), fx.part, fx.chance, turns, B.rng, opts);
    put(s, r.combatant);
    put(s, r.attacker);
    first = first ?? r;
    emit(B, 'bind', { ...actorF(C(s, actorId)), ...targetF(C(s, targetId)), skill: skill.id, skillName: skill.name, stance: val ? o.stance : undefined, own: true, part: fx.part, roll: r.roll, pct: r.pct, success: r.success, crit: r.crit, fumble: r.fumble, backfire: r.backfire, turns: r.turns });
    if (r.success) onBind(B, targetId, fx.part, actorId);
    if (r.backfire) onBind(B, actorId, fx.part);
    rolls[fx.part] = r;
  }
  if (first?.fumble && !s.over) {
    const wave = val ? chaosWave(C(s, actorId), first.roll, o.stance) : null;
    if (wave) applyWave(B, actorId, wave, first.roll);
    else if (actor.side === HERO) standardStress(B, 'fumble', [actorId]);
  }
  return { outcome: first?.success ? 'hit' : first?.fumble ? 'fumble' : 'miss', landed: Boolean(first?.success), roll: first?.roll ?? null };
}

// ---------------------------------------------------------------- effects

function effectTargets(s, actor, where, hit) {
  switch (where) {
    case 'self': return [actor.id];
    case 'valerie': return living(s, HERO).filter((id) => isHeroVal(C(s, id)));
    case 'others': return living(s, HERO).filter((id) => !isHeroVal(C(s, id)));
    case 'heroes': return living(s, HERO);
    case 'enemies': return living(s, FOE);
    case 'allies': return living(s, actor.side);
    case 'boss': return s.boss ? [s.boss.id] : [];
    default: return hit;
  }
}

/**
 * A skill's effects list. scope 'hit' runs the unmarked effects on the targets it landed on; 'special' runs the
 * ones that name their own target (self, heroes, valerie, others, enemies, allies); 'all' runs both.
 * A self effect marked onHit needs the skill to have landed on someone.
 */
function runEffects(B, actorId, skill, { scope = 'all', hit = [], rolls = {}, anyHit = true } = {}) {
  const s = B.s;
  const script = SCRIPTED[skill.id] ?? {};
  for (const fx of skill.effects ?? []) {
    if (s.over) return;
    // The Airhead gauge is the user's own, whoever the skill was aimed at: once per use, hit or miss.
    const where = fx.kind === 'airhead' ? 'self' : fx.target;
    const marked = where !== undefined;
    if ((scope === 'hit' && marked) || (scope === 'special' && !marked)) continue;
    if (where === 'self' && fx.onHit && !anyHit) continue;
    if (script.deferStatuses && fx.kind === 'status' && s.turn?.actor === actorId) { s.turn.deferred.push({ id: fx.id, turns: fx.turns }); continue; }
    if (fx.kind === 'status' && STATUS_HOOKS[fx.id]?.windupMarker) continue; // the wind-up itself keeps the marker
    const actor = C(s, actorId);
    let ids = effectTargets(s, actor, where, hit);
    if (fx.kind !== 'revive') ids = ids.filter((id) => alive(C(s, id)));
    if (ids.length) effect(B, actorId, ids, fx, skill, rolls);
  }
}

function effect(B, actorId, ids, fx, skill, rolls) {
  const s = B.s;
  const actor = C(s, actorId);
  switch (fx.kind) {
    case 'bind':
      for (const id of ids) if (!s.over) bindEffect(B, actorId, id, fx, skill, rolls[id]);
      break;
    case 'stress': {
      if (fx.amount < 0) { relief(B, ids, -fx.amount, { from: 'ally', actor: actorId, reason: 'skill', skillName: skill.name }); break; }
      let takers = ids;
      if (fx.orPay) {
        // The target may pay a share of max MP instead. The caller's choice, or a simple rule.
        takers = [];
        for (const id of ids) {
          const t = C(s, id);
          const price = Math.ceil((t.maxMp * num(fx.orPay.mpPct)) / 100);
          const pick = (v) => (typeof v === 'string' ? v : v?.[id]);
          const mode = pick(B.choices.orPay) ?? pick(s.options.orPay) ?? 'auto';
          const pays = t.mp >= price && (mode === 'pay' || (mode === 'auto' && t.stress >= 60));
          if (!pays) { takers.push(id); continue; }
          t.mp -= price;
          emit(B, 'pay', { ...targetF(t), mp: price, amount: fx.amount, skillName: skill.name });
        }
      }
      stressGroup(B, takers, fx.amount, { source: fx.source ?? 'general', ignoreWill: Boolean(fx.ignoreWill), by: actorId, skillName: skill.name });
      break;
    }
    case 'mod': {
      const rows = []; const refused = [];
      for (const id of ids) {
        let t = C(s, id);
        const row = { id, name: t.name, you: isHeroVal(t) };
        if (fx.mult >= 1 && id !== actorId && actor.side === t.side) {
          const first = consumeFirstRefusal(t, 'buff');
          t = put(s, first.combatant);
          if (first.refused || refuses(t, 'buff')) { refused.push(row); continue; }
        }
        addMod(s, id, { stat: fx.stat, mult: fx.mult, turns: fx.turns, source: skill.id, by: actorId });
        rows.push(row);
      }
      const base = { ...actorF(actor), stat: fx.stat, mult: fx.mult, turns: fx.turns, skillName: skill.name };
      const one = (list) => (list.length === 1 ? targetF(C(s, list[0].id)) : {});
      if (rows.length) emit(B, 'mod', { ...base, ...one(rows), targets: rows });
      if (refused.length) emit(B, 'mod', { ...base, ...one(refused), targets: refused, refused: true });
      break;
    }
    case 'status':
      giveStatus(B, ids, fx.id, { turns: fx.turns, by: actorId, source: skill.id, skillName: skill.name });
      break;
    case 'heal':
      for (const id of ids) {
        const t = C(s, id);
        if (fx.bar === 'mp') { t.mp = clamp(t.mp + Math.round((t.maxMp * num(fx.pct)) / 100), 0, t.maxMp); continue; }
        const amount = Math.min(num(fx.cap, Infinity), Math.round((t.maxHp * num(fx.pct)) / 100));
        healOne(B, actorId, id, amount, { skillName: skill.name });
      }
      break;
    case 'limit':
      for (const id of ids) {
        const before = C(s, id).limit;
        gainLimit(B, id, fx.amount);
        emit(B, 'limit', { ...targetF(C(s, id)), amount: C(s, id).limit - before, before, after: C(s, id).limit, skillName: skill.name });
      }
      break;
    case 'airhead':
      for (const id of ids) {
        const before = airheadOf(C(s, id));
        const delta = Number.isFinite(fx.set) ? fx.set - before : num(fx.amount);
        const t = put(s, shiftAirhead(C(s, id), delta));
        emit(B, 'airhead', { ...targetF(t), before, after: airheadOf(t), reset: fx.set === AIRHEAD.GOOD_HERO_RESET });
      }
      break;
    case 'dot': {
      const rows = [];
      for (const id of ids) {
        const t = C(s, id);
        t.dots = t.dots.filter((d) => d.source !== skill.id);
        t.dots.push({ source: skill.id, name: skill.name, by: actorId, power: fx.power, element: fx.element ?? skill.element ?? 'phys', stat: skill.stat ?? null, type: skill.type ?? 'physical', turns: fx.turns ?? 1 });
        rows.push({ id, name: t.name, you: isHeroVal(t) });
      }
      emit(B, 'status', { ...actorF(actor), ...(rows.length === 1 ? targetF(C(s, rows[0].id)) : {}), targets: rows, status: 'dot', statusName: fx.element === 'fire' ? 'Burning' : 'Lingering damage', turns: fx.turns ?? 1, element: fx.element ?? skill.element, skillName: skill.name });
      break;
    }
    case 'cleanse':
      for (const id of ids) {
        let t = C(s, id);
        const friend = t.side === actor.side;
        let removed = 0;
        if (fx.what === 'binds') {
          removed = boundParts(t).length;
          t = put(s, cureBinds(t));
        } else if (fx.what === 'mods') {
          // Never a Resolve state's own attributes, never a passive's: those are not buffs to strip.
          const goes = (m) => m.turns != null && (friend ? m.mult < 1 : m.mult > 1);
          removed = t.mods.filter(goes).length;
          t.mods = t.mods.filter((m) => !goes(m));
        } else {
          const want = friend ? 'bad' : 'good';
          removed = dropStatus(t, (st) => s.defs.statuses[st.id]?.polarity === want).length;
          syncFlags(t);
        }
        // A strike that also strips buffs says nothing when there was nothing to strip.
        if (removed > 0 || !OFFENSIVE.includes(skill.target ?? 'one')) emit(B, 'cleanse', { ...actorF(actor), ...targetF(C(s, id)), what: fx.what, removed, skillName: skill.name });
      }
      break;
    case 'revive':
      for (const id of ids) {
        const t = C(s, id);
        if (t.hp > 0 || t.fled || t.flags.stormedOff) continue;
        t.hp = clamp(Math.round((t.maxHp * num(fx.pct, 30)) / 100), 1, t.maxHp);
        emit(B, 'revive', { ...actorF(actor), ...targetF(t), hp: t.hp, skillName: skill.name });
        if (t.flags.downed) { t.flags.downed = false; standardStress(B, 'downed', [id]); }
      }
      break;
    default:
      break;
  }
}

// A bind from an effects list: the price of a skill (no roll), or a bind riding on the attack's own d100.
function bindEffect(B, actorId, targetId, fx, skill, hit) {
  const s = B.s;
  const actor = C(s, actorId);
  const target = C(s, targetId);
  const self = actorId === targetId;
  const turns = bindTurns(target, fx.part, fx.turns ?? 2, actor.side !== target.side);
  if (self || (!hit && num(fx.chance, 100) >= 100)) {
    const t = put(s, applyBind(target, fx.part, turns, { ownTurn: s.turn?.actor === targetId }));
    emit(B, 'bind', { ...actorF(actor), ...targetF(t), skill: skill.id, skillName: skill.name, part: fx.part, turns: t.binds[fx.part], self });
    onBind(B, targetId, fx.part);
    return;
  }
  let chance = fx.chance;
  const opts = { ownTurn: s.turn?.actor === targetId };
  if (hit) {
    opts.roll = hit.roll;
    if (hit.outcome === 'crit' && Number.isFinite(fx.onCritChance)) chance = fx.onCritChance;
    if (hasP(actor, 'rog_p_opportunist')) {
      if (hit.outcome === 'crit') { opts.ignoreResist = true; opts.ignoreWear = true; } else chance -= 10;
    }
  } else opts.backfire = false; // a move that cannot miss still rolls for its bind, and cannot bind its user
  const r = tryBind(actor, target, fx.part, chance, turns, B.rng, opts);
  if (!r.success) return;
  put(s, r.combatant);
  emit(B, 'bind', { ...actorF(actor), ...targetF(C(s, targetId)), skill: skill.id, skillName: skill.name, stance: hit?.stance, part: fx.part, roll: r.roll, pct: r.pct, crit: r.crit, success: true, riding: Boolean(hit), turns: r.turns });
  onBind(B, targetId, fx.part, actorId);
}

// ---------------------------------------------------------------- one action

// A single-target attack does not always land on whoever it was aimed at.
function redirect(B, actor, targetId) {
  const s = B.s;
  const target = C(s, targetId);
  if (!target || actor.side === target.side) return { id: targetId };
  const mates = living(s, target.side).filter((id) => id !== targetId).map((id) => C(s, id));
  const door = mates.find((mate) => hookOn(mate, 'pullsAll'));
  if (door) return { id: door.id, from: targetId, why: 'bulwark' };
  const cov = statusOf(target, 'covered');
  if (cov) {
    const by = C(s, cov.by);
    if (alive(by) && by.id !== targetId && !isBound(by, 'legs')) return { id: by.id, from: targetId, why: 'covered' };
    dropStatus(target, (st) => st.id === 'covered');
  }
  // A Resolve state that shields the most hurt ally (Martyr Complex acting out, Mother Hen standing).
  for (const mate of mates) if (covers(mate) === 'weakest_ally' && weakestAllyOf(s, mate) === targetId) return { id: mate.id, from: targetId, why: 'cover' };
  // Bodyguard's Reflex (warrior): once a round, for an ally under 30% HP, legs free.
  for (const mate of mates) {
    if (hasP(mate, 'war_p_bodyguards_reflex') && share(target) < 0.3 && !isBound(mate, 'legs') && mate.flags.reflexRound !== s.round) {
      mate.flags.reflexRound = s.round;
      return { id: mate.id, from: targetId, why: 'reflex' };
    }
  }
  return { id: targetId };
}

// Who a move lands on: [{ id, from?, why? }].
function aimTargets(B, actor, skill, targetId) {
  const s = B.s;
  const mode = skill.target ?? 'one';
  if (mode === 'self') return [{ id: actor.id }];
  if (mode === 'ally') return [{ id: targetId ?? actor.id }];
  if (mode === 'allies') return targetsFor(s, actor, skill).map((id) => ({ id }));
  if (mode === 'one') {
    if (targetId == null) return [];
    return skill.auto ? [{ id: targetId }] : [redirect(B, actor, targetId)];
  }
  let ids = fielded(s, foeSide(actor));
  if (mode === 'row') ids = rowsOf(s, ids).find((row) => row.includes(targetId)) ?? ids;
  if (!skill.auto) {
    if (s.defs.bossRules?.taunterTakesAll?.includes(skill.id)) {
      const her = ids.find((id) => isHeroVal(C(s, id)) && hookOn(C(s, id), 'taunt'));
      if (her) return [{ id: her, why: 'taunt' }];
    }
    const door = ids.find((id) => hookOn(C(s, id), 'pullsAll'));
    if (door) return [{ id: door, why: 'bulwark' }];
  }
  return ids.map((id) => ({ id }));
}

function targetLabel(s, actor, skill, aim) {
  const mode = skill.target ?? 'one';
  if (mode === 'self') return null;
  const named = (skill.effects ?? []).map((fx) => fx.target);
  if (skill.auto && named.length && named.every((t) => t !== undefined)) {
    if (named.every((t) => t === 'valerie')) return s.heroes.map((id) => C(s, id)).find(isHeroVal)?.name ?? null;
    return named.every((t) => t === 'self') ? null : actor.side === FOE ? 'all heroes' : 'all enemies';
  }
  if (mode === 'all' || mode === 'row') return actor.side === FOE ? 'all heroes' : 'all enemies';
  if (mode === 'allies') return actor.side === HERO ? 'the party' : 'its side';
  return aim.map((a) => C(s, a.id)?.name).filter(Boolean).join(', ') || null;
}

/**
 * Resolve one skill or move by one combatant, in the order blueprint 4.1 gives: pay, stance, roll each target,
 * damage then the effects that ride on a hit, then the effects that name their own target, then the gauge.
 * o: { stance, target, targets (forced), free }.
 */
function perform(B, actorId, skill, o = {}) {
  const s = B.s;
  refreshMods(s);
  let actor = C(s, actorId);
  const tags = skill.tags ?? [];
  const mode = skill.target ?? 'one';
  const offensive = OFFENSIVE.includes(mode);
  const script = SCRIPTED[skill.id] ?? {};
  const val = isHeroVal(actor) && Boolean(o.stance);
  const cost = o.free ? { mp: 0, limit: 0 } : costOf(actor, skill);
  actor.mp = Math.max(0, actor.mp - cost.mp);
  actor.limit = clamp(actor.limit - cost.limit, 0, SCALE.LIMIT_MAX);

  let gaugeDelta = 0;
  if (val) {
    gaugeDelta = applyStance(B, actorId, o.stance);
    if (s.over || !alive(C(s, actorId))) return;
  }
  actor = C(s, actorId);
  const aim = o.targets ?? aimTargets(B, actor, skill, o.target);
  // The stance moves the gauge once the dice are down, and before the skill's own effects touch it,
  // so "the gauge snaps back to 50" means 50.
  const settleGauge = () => {
    if (!val || !gaugeDelta || !alive(C(s, actorId))) return;
    syncFlags(put(s, shiftAirhead(C(s, actorId), gaugeDelta)));
    gaugeDelta = 0;
  };

  if (tags.includes('windup') && s.boss?.id === actorId) {
    const fires = actor.skills.map((id) => s.defs.skills[id]).find((mv) => mv?.telegraph?.by === skill.id);
    if (fires) {
      const marker = (skill.effects ?? []).find((fx) => fx.kind === 'status' && STATUS_HOOKS[fx.id]?.windupMarker);
      const rounds = Math.max(1, num(fires.telegraph.rounds, 1));
      s.boss.pending = { move: fires.id, by: skill.id, due: s.round + rounds, part: fires.part ?? null };
      if (marker) giveStatus(B, [actorId], marker.id, { by: actorId, source: skill.id, quiet: true });
      emit(B, 'telegraph', { ...actorF(actor), skill: skill.id, skillName: skill.name, move: fires.id, moveName: fires.name, rounds, due: s.round + rounds, part: fires.part ?? null, flavor: flavorOf(skill, actor) });
    }
    runEffects(B, actorId, skill, { scope: 'all', hit: [actorId] });
  } else if (!offensive || skill.auto) {
    // Aimed at the party, or a move that cannot miss: nothing is rolled.
    // A plain heal, or a hero's skill that does one thing, is told by that one thing; everything else is announced.
    const fxList = skill.effects ?? [];
    const plainHeal = skill.type === 'heal' && num(skill.power) > 0;
    const oneStatus = fxList.length === 1 && fxList[0].kind === 'status' && !STATUS_HOOKS[fxList[0].id]?.instant;
    if (actor.side === HERO && !skill.auto && (plainHeal || oneStatus)) B.owed = cost;
    else emit(B, 'skill', { ...actorF(actor), skill: skill.id, skillName: skill.name, stance: val ? o.stance : undefined, mode, auto: Boolean(skill.auto), cost, targetLabel: targetLabel(s, actor, skill, aim), flavor: flavorOf(skill, actor) });
    const ids = aim.map((a) => a.id);
    settleGauge();
    if (skill.type === 'heal' && num(skill.power) > 0) {
      for (const id of ids) {
        const t = C(s, id);
        let mult = 1;
        if (hasP(actor, 'mag_p_bedside_manner') && id !== actorId) mult = share(t) < 0.3 ? 1.3 : share(t) > 0.7 ? 0.7 : 1;
        healOne(B, actorId, id, healAmount(C(s, actorId), skill, { variance: rollVariance(B.rng), mult }), { skillName: skill.name });
      }
    }
    runEffects(B, actorId, skill, { scope: 'all', hit: ids });
    B.owed = null;
  } else {
    if (script.stripGuardFirst) for (const a of aim) dropStatus(C(s, a.id), (st) => st.id === 'guard');
    const pure = isPureBind(skill);
    const once = { waved: false };
    let anyHit = false;
    for (const a of aim) {
      if (s.over || !alive(C(s, actorId))) break;
      if (!alive(C(s, a.id))) continue;
      const r = pure ? bindRoll(B, actorId, a.id, skill, o) : rollOne(B, actorId, a.id, skill, { stance: o.stance, redirect: a, once });
      if (r.landed) anyHit = true;
    }
    if (!s.over) { settleGauge(); runEffects(B, actorId, skill, { scope: 'special', anyHit }); }
  }
  if (s.over) return;

  settleGauge();
  actor = C(s, actorId);
  if (offensive) {
    if (dropStatus(actor, (st) => STATUS_HOOKS[st.id]?.endsOnAttack).length) actor.flags.firstInFrom = s.round;
    if (num(skill.power) > 0) dropStatus(actor, (st) => STATUS_HOOKS[st.id]?.endsOnDamagingSkill);
    if (val && o.stance === 'think' && skill.id !== BASIC_ATTACK.id) dropStatus(actor, (st) => STATUS_HOOKS[st.id]?.autoCritThink);
  }
  if (script.extraActions && s.turn?.actor === actorId) {
    s.turn.actionsLeft += script.extraActions;
    s.turn.extra = true;
  }
}

function doGuard(B, id) {
  const s = B.s;
  let c = C(s, id);
  dropStatus(c, (st) => st.id === 'counter');
  giveStatus(B, [id], 'guard', { turns: 1, by: id, own: true, quiet: true });
  c = C(s, id);
  c.flags.guardedRound = s.round;
  emit(B, 'guard', { ...actorF(c) });
  if (hasP(c, 'any_p_deep_breaths')) relief(B, [id], 4, { from: 'self', actor: id, reason: 'skill', skillName: 'Deep Breaths' });
}

function doBreather(B, id) {
  const s = B.s;
  const r = breather(C(s, id));
  const c = put(s, r.combatant);
  emit(B, 'breather', { ...actorF(c), relieved: r.relieved, before: r.before, after: r.after, refused: Boolean(r.refused) });
  if (r.calmed) emit(B, 'calm', { ...targetF(c), stateName: r.ended?.name ?? null, mark: r.mark?.name ?? null });
}

// The concession: give the boss what it wants. It ends the fight as a win and charges its price.
function doConcede(B, id, action) {
  const s = B.s;
  const k = s.concession;
  if (action.stance && isHeroVal(C(s, id))) {
    const delta = applyStance(B, id, action.stance);
    if (s.over) return;
    if (alive(C(s, id))) put(s, shiftAirhead(C(s, id), delta));
  }
  const boss = C(s, s.boss.id);
  emit(B, 'concede', { ...actorF(C(s, id)), ...targetF(boss), name: k.name, price: k.price });
  const skill = { id: 'concession', name: k.name };
  for (const fx of k.effects) {
    if (s.over) break;
    if (fx.kind === 'trust') s.story.trust += num(fx.amount);
    else if (fx.kind === 'rep') s.story.rep += num(fx.amount);
    else if (fx.kind === 'stress') stressGroup(B, effectTargets(s, C(s, id), fx.target ?? 'valerie', []), fx.amount, { source: fx.source ?? 'general', ignoreWill: Boolean(fx.ignoreWill), skillName: k.name, reason: 'concession' });
    else if (EFFECT_KINDS.includes(fx.kind)) {
      const ids = effectTargets(s, C(s, id), fx.target ?? 'valerie', []).filter((x) => alive(C(s, x)));
      if (ids.length) effect(B, id, ids, fx, skill, {});
    }
  }
  if (!s.over) finish(B, 'win', 'concession');
}

// ---------------------------------------------------------------- the boss and the enemy AI

function checkPhase(B) {
  const s = B.s;
  if (!s.boss || s.over) return;
  const boss = C(s, s.boss.id);
  if (!alive(boss)) return;
  const phases = s.defs.boss?.phases ?? [];
  const pct = share(boss) * 100;
  while (s.boss.phase + 1 < phases.length && pct <= phases[s.boss.phase + 1].at) {
    s.boss.phase += 1;
    s.boss.phaseRound = 0;
    if (s.boss.pending) cancelPending(B, 'phase');
    // He re-cocks it when the phase changes.
    if (s.contraption && /phase/.test(s.contraption.uses)) s.contraption.used = false;
    const ph = phases[s.boss.phase];
    emit(B, 'phase', { ...actorF(boss), phase: s.boss.phase + 1, phaseName: ph.name, phaseText: ph.text ?? null, at: ph.at, hp: boss.hp, maxHp: boss.maxHp });
  }
}

function usableMove(B, c, move) {
  const s = B.s;
  if (!move || !skillSupport(move).ok || sealedBy(c, move)) return false;
  const tags = move.tags ?? [];
  if (tags.includes('telegraphed')) {
    const p = s.boss?.id === c.id ? s.boss.pending : null;
    if (!p || p.move !== move.id || s.round < p.due) return false;
  }
  if (tags.includes('windup') && (s.boss?.id !== c.id || s.boss.pending)) return false;
  const selfGuard = (move.effects ?? []).some((fx) => fx.kind === 'status' && fx.id === 'guard' && (fx.target === 'self' || move.target === 'self'));
  if (selfGuard && hookOn(c, 'noGuard')) return false;
  return true;
}

function moveWeight(B, c, move) {
  const s = B.s;
  const tags = move.tags ?? [];
  if (tags.includes('windup') || tags.includes('telegraphed') || !usableMove(B, c, move)) return 0;
  let weight;
  if (num(move.power) > 0) weight = 3;
  else if (OFFENSIVE.includes(move.target ?? 'one')) weight = 2;
  else {
    // A buff nobody needs is not worth the turn.
    const ids = move.target === 'self' ? [c.id] : living(s, c.side);
    const fx = (move.effects ?? [])[0];
    const need = !fx || ids.some((id) => (fx.kind === 'status' ? !has(C(s, id), fx.id) : fx.kind === 'mod' ? !C(s, id).mods.some((m) => m.source === move.id) : true));
    weight = need ? 1 : 0;
  }
  const mends = (move.effects ?? []).some((fx) => fx.kind === 'status' && STATUS_HOOKS[fx.id]?.removes);
  if (mends) weight = living(s, c.side).some((id) => (move.effects ?? []).some((fx) => (STATUS_HOOKS[fx.id]?.removes ?? []).some((gone) => has(C(s, id), gone)))) ? 6 : weight;
  if (s.turn?.used.includes(move.id)) weight *= 0.25;
  return weight;
}

function chooseMove(B, c) {
  const s = B.s;
  const skills = s.defs.skills;
  let pool = c.skills;
  if (s.boss?.id === c.id) {
    const p = s.boss.pending;
    // A wound-up move fires as soon as it is due. If its part is bound by then, it is called off instead.
    if (p && s.round >= p.due) {
      if (usableMove(B, c, skills[p.move])) return skills[p.move];
      cancelPending(B, 'bind');
    }
    const scripted = skills[s.turn.row?.[s.turn.slot]];
    if (scripted && usableMove(B, c, scripted)) return scripted;
    const phase = s.defs.boss?.phases?.[s.boss.phase];
    if (phase?.moves?.length) pool = phase.moves;
  }
  const options = pool.map((id) => skills[id]).filter(Boolean).map((move) => ({ move, weight: moveWeight(B, c, move) })).filter((x) => x.weight > 0);
  if (options.length === 0) return BASIC_ATTACK;
  if (options.length === 1) return options[0].move;
  return pickWeighted(B.rng, options).move;
}

function aimEnemy(B, c, move) {
  const s = B.s;
  const ids = move.auto ? living(s, HERO) : aimable(s, c);
  if (ids.length <= 1) return ids[0] ?? null;
  if (c.boss && s.defs.bossRules?.targeting === 'highest_hp') return ids.reduce((best, id) => (C(s, id).hp > C(s, best).hp ? id : best), ids[0]);
  return ids[rollInt(B.rng, 0, ids.length - 1)];
}

function enemyAct(B, id) {
  const s = B.s;
  const c = C(s, id);
  const move = chooseMove(B, c);
  if (s.over) return;
  s.turn.used.push(move.id);
  const target = (move.target ?? 'one') === 'one' ? aimEnemy(B, C(s, id), move) : living(s, HERO)[0] ?? null;
  if (s.boss?.id === id && s.boss.pending?.move === move.id) clearPending(s);
  if (OFFENSIVE.includes(move.target ?? 'one') && target === null) emit(B, 'skip', { ...actorF(c), reason: 'stuck' });
  else perform(B, id, move, { target });
  if (!s.over && s.turn?.actor === id) { s.turn.actionsLeft -= 1; s.turn.slot += 1; }
}

// ---------------------------------------------------------------- the round

function startRound(B) {
  const s = B.s;
  s.round += 1;
  s.acted = {};
  const scored = [...fielded(s, HERO), ...fielded(s, FOE)].map((id, i) => {
    const c = C(s, id);
    return { id, i, score: initiative(c, B.rng), luck: effectiveStat(c, 'LCK'), foe: c.side === HERO ? 0 : 1 };
  });
  scored.sort((a, b) => b.score - a.score || b.luck - a.luck || a.foe - b.foe || a.i - b.i);
  s.order = scored.map((x) => x.id);
  s.turnIndex = 0;
  s.turn = null;
  // The first initiative roll decides where the narrator starts in each list of variants.
  if (s.round === 1) s.voiceSalt = scored.reduce((sum, x) => sum + x.score, 0) % 97;
  const first = C(s, s.order[0]);
  emit(B, 'round', { order: s.order.map((id) => C(s, id).name), first: first?.name ?? null, firstYou: isHeroVal(first) });
}

function endRound(B) {
  const s = B.s;
  for (const id of allIds(s)) {
    const c = C(s, id);
    if (!alive(c)) continue;
    // Whoever had no turn this round (the ranks waiting behind the front) still gets a round older.
    if (!s.acted[id]) endOfTurnTick(B, id);
    const gone = dropStatus(C(s, id), (st) => Number.isFinite(st.untilRound) && st.untilRound <= s.round);
    const named = gone.filter((st) => st.id !== 'guard_broken').map((st) => s.defs.statuses[st.id]?.name ?? st.id);
    if (named.length) emit(B, 'expire', { ...targetF(C(s, id)), what: named });
  }
}

// What the turn check asks the loop to do (stress.js lists the fields). Returns true when the turn is spent.
function runActOut(B, id) {
  const s = B.s;
  const before = C(s, id);
  const r = actOutCheck(before, B.rng);
  put(s, r.combatant);
  if (r.outcome === 'none') return false;
  const c = C(s, id);
  emit(B, 'act_out', { ...targetF(c), roll: r.roll, pct: r.pct, outcome: r.outcome, kind: c.resolve.kind, stateName: c.resolve.name, actId: r.act?.id ?? null, actName: r.act?.name ?? null, actText: r.act?.text ?? null });
  const act = r.act;
  if (!act) return false;
  const mates = () => living(s, HERO).filter((x) => x !== id);
  if (act.allyStress && mates().length) {
    const who = act.allyStress.who === 'one' ? [pickByRoll(r.roll, mates())] : mates();
    stressGroup(B, who, act.allyStress.amount, { source: 'mental', ignoreWill: true, by: id, reason: 'act_out' });
  }
  if (s.over || !alive(C(s, id))) return true;
  if (act.partyRelief && mates().length) relief(B, mates(), act.partyRelief, { from: 'ally', actor: id, reason: 'virtue' });
  if (act.allyHealPct) {
    const weak = weakestAllyOf(s, C(s, id));
    if (weak) healOne(B, id, weak, (C(s, weak).maxHp * num(act.allyHealPct.pct)) / 100, { skillName: act.name, source: 'virtue' });
  }
  if (act.cureBinds && boundParts(C(s, id)).length) {
    put(s, cureBinds(C(s, id)));
    emit(B, 'cleanse', { ...actorF(C(s, id)), ...targetF(C(s, id)), what: 'binds', removed: 1, skillName: act.name });
  }
  if (act.selfHpPct < 0) {
    const me = C(s, id);
    const loss = Math.min(me.hp - 1, Math.round((me.maxHp * -act.selfHpPct) / 100)); // a meltdown hurts; it does not kill
    if (loss > 0) {
      const info = hurt(B, id, loss);
      emit(B, 'damage', { ...targetF(C(s, id)), amount: loss, hpBefore: info.before, hpAfter: info.after, source: 'meltdown' });
      afterHurt(B, info);
    }
  }
  if (act.goldPerLevel) s.story.goldFlat += act.goldPerLevel * C(s, id).level;
  if (s.over || !alive(C(s, id))) return true;

  const readOff = (list) => pickByRoll(r.roll, list);
  const pool = { random_ally: mates(), random_enemy: fielded(s, FOE), random_any: [...mates(), ...fielded(s, FOE)] };
  switch (act.action === 'item' ? act.fallback ?? 'guard' : act.action) {
    case 'pass':
    case 'cover':
      return true;
    case 'guard':
      if (!hookOn(C(s, id), 'noGuard')) doGuard(B, id);
      return true;
    case 'attack': {
      const target = readOff(pool[act.target] ?? pool.random_enemy);
      if (target) perform(B, id, BASIC_ATTACK, { targets: [{ id: target }], free: true });
      return true;
    }
    case 'skill': {
      // One of their own skills, read off the dice, on a target read off the dice. Only what they could really use.
      const me = C(s, id);
      const mine = [BASIC_ATTACK, ...me.skills.map((sid) => s.defs.skills[sid])].filter((sk) => sk && !(sk.tags ?? []).includes('passive') && !whyNot(s, me, sk, costOf(me, sk)) && !(sk.stance || sk.bands));
      const skill = readOff(mine) ?? BASIC_ATTACK;
      if (OFFENSIVE.includes(skill.target ?? 'one')) {
        const target = readOff(pool[act.target] ?? pool.random_any);
        const aim = (skill.target ?? 'one') === 'one' ? [{ id: target }] : fielded(s, C(s, target)?.side ?? FOE).filter((x) => x !== id).map((x) => ({ id: x }));
        if (target) perform(B, id, skill, { targets: aim });
      } else {
        const options = targetsFor(s, me, skill);
        if (options.length) perform(B, id, skill, { target: readOff(options) });
      }
      return true;
    }
    default:
      return false;
  }
}

function beginTurn(B, id) {
  const s = B.s;
  let c = C(s, id);
  s.turn = { actor: id, actionsLeft: c.actions, slot: 0, extra: false, used: [], row: null, deferred: [] };
  s.acted[id] = true;
  // A Guard lasts until the start of its granter's next turn.
  for (const oid of allIds(s)) dropStatus(C(s, oid), (st) => st.until === 'granter' && st.by === id);
  refreshMods(s);

  if (s.boss?.id === id) {
    s.boss.phaseRound += 1;
    const script = s.defs.boss?.phases?.[s.boss.phase]?.script;
    s.turn.row = script?.length ? script[(s.boss.phaseRound - 1) % script.length] : null;
  }

  // Damage over time: a hit of that Power from its caster. No roll, no crit, no variance; affinity applies.
  for (const dot of [...c.dots]) {
    if (s.over || !alive(C(s, id))) break;
    const caster = C(s, dot.by);
    const amount = caster ? damage(caster, C(s, id), { power: dot.power, element: dot.element, stat: dot.stat ?? undefined, type: dot.type }, { variance: 1, affinity: wardedAffinity(C(s, id), dot) }) : 0;
    dot.turns -= 1;
    if (amount > 0) {
      const info = hurt(B, id, amount);
      emit(B, 'damage', { ...targetF(C(s, id)), amount: info.before - info.after, hpBefore: info.before, hpAfter: info.after, source: 'dot', skillName: dot.name, element: dot.element });
      afterHurt(B, info, dot.by);
    }
  }
  if (s.over) return;
  c = C(s, id);
  if (!alive(c)) { s.turn.actionsLeft = 0; return; }
  c.dots = c.dots.filter((d) => d.turns > 0);

  // A state that mends its owner every turn (Second Wind).
  for (const fx of effectsOf(c, 'regen')) if (c.hp < c.maxHp) healOne(B, null, id, (c.maxHp * num(fx.hpPct)) / 100, { source: 'regen' });

  // Lost turns and lost actions.
  if (dropStatus(c, (st) => STATUS_HOOKS[st.id]?.skipTurn).length) {
    emit(B, 'skip', { ...actorF(c), reason: 'sitting_out' });
    s.turn.actionsLeft = 0;
    return;
  }
  const lost = dropStatus(c, (st) => STATUS_HOOKS[st.id]?.loseAction).length;
  const routed = num(c.flags.loseActions);
  if (lost + routed > 0) {
    c.flags.loseActions = 0;
    emit(B, 'skip', { ...actorF(c), reason: routed ? 'routed' : 'recovering', actions: lost + routed });
    s.turn.slot += lost + routed;
    s.turn.actionsLeft -= lost + routed;
    if (s.turn.actionsLeft <= 0) return;
  }

  if (c.side !== HERO) return;
  // Last One Standing (warrior): while an ally is down, every turn starts with 10 Limit and 5 stress.
  if (hasP(c, 'war_p_last_one_standing') && downedAllies(s, c) > 0) {
    gainLimit(B, id, 10);
    stressGroup(B, [id], 5, { source: 'death', reason: 'ally_down' });
    if (s.over || !alive(C(s, id))) { if (s.turn) s.turn.actionsLeft = 0; return; }
  }
  // The turn check of an afflicted or virtuous character.
  if (C(s, id).resolve && runActOut(B, id) && s.turn?.actor === id) s.turn.actionsLeft = 0;
}

function finishTurn(B) {
  const s = B.s;
  const id = s.turn.actor;
  const deferred = s.turn.deferred;
  if (alive(C(s, id))) {
    for (const d of deferred) giveStatus(B, [id], d.id, { turns: d.turns, by: id });
    endOfTurnTick(B, id);
  }
  s.turn = null;
  s.turnIndex += 1;
}

// Run the fight forward until a hero has a decision to make, or it is over.
function advance(B) {
  const s = B.s;
  for (let guard = 0; guard < 100000; guard++) {
    if (s.over) return;
    if (!s.turn) {
      if (s.turnIndex >= s.order.length) {
        endRound(B);
        if (checkEnd(B)) return;
        startRound(B);
        continue;
      }
      const id = s.order[s.turnIndex];
      if (!alive(C(s, id))) { s.turnIndex += 1; continue; }
      beginTurn(B, id);
      continue;
    }
    const c = C(s, s.turn.actor);
    if (!alive(c) || s.turn.actionsLeft <= 0) { finishTurn(B); continue; }
    if (c.side === HERO) {
      if (legalActions(s, c.id).some((a) => !a.disabled)) return;
      emit(B, 'skip', { ...actorF(c), reason: 'stuck' });
      s.turn.actionsLeft = 0;
      continue;
    }
    enemyAct(B, c.id);
  }
  throw new Error('battle: the turn loop did not settle');
}

// ---------------------------------------------------------------- the public loop

/**
 * Resolve one action by the current hero, everything that follows from it, and every enemy turn up to the next
 * hero decision. Never mutates the state it is given.
 *
 *   action: { kind, skillId?, stance?, target?, breakdown?, orPay? }
 *     kind      'attack' | 'skill' | 'guard' | 'breather' | 'concede': one of legalActions(state)
 *     stance    'wing' | 'think', required for Valerie's attacks and skills
 *     target    an id from that action's targets, when it has choose: true (default: the first)
 *     breakdown the choice if anyone reaches 200 stress before the next decision (a string, or { heroId: choice })
 *     orPay     'pay' | 'stress' | 'auto' for a move that lets a hero pay MP instead of taking stress
 *   rng: the same seeded function for the whole battle (makeRng from rng.js)
 *
 * Returns { state, events }. Throws on an action legalActions would not offer, or would offer disabled.
 */
export function act(state, action, rng) {
  if (!state || state.over) throw new Error('act: the battle is over');
  if (typeof rng !== 'function') throw new Error('act: needs an rng');
  const actorId = currentActor(state);
  if (actorId === null) throw new Error('act: nobody is waiting to act');
  const chosen = matchAction(state, actorId, action);
  const B = { s: draft(state), rng, events: [], choices: { breakdown: action.breakdown, orPay: action.orPay } };
  const s = B.s;
  C(s, actorId).flags.last = { kind: chosen.kind, skill: chosen.skillId ?? null, round: s.round };
  if (chosen.kind === 'guard') doGuard(B, actorId);
  else if (chosen.kind === 'breather') doBreather(B, actorId);
  else if (chosen.kind === 'concede') doConcede(B, actorId, chosen);
  else perform(B, actorId, s.defs.skills[chosen.skillId], { stance: chosen.stance, target: chosen.target });
  if (!s.over && s.turn?.actor === actorId) s.turn.actionsLeft -= 1;
  if (!s.over) checkEnd(B);
  advance(B);
  refreshMods(s);
  return { state: s, events: B.events };
}

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

/**
 * The default hero policy: a plain, sensible player. Revive, then heal who is low, then calm who is about to
 * crack; Valerie taunts and wings it until the gauge is nearly full, then thinks (the other way round while the
 * ledger is flipped); everyone else uses whichever affordable attack is expected to do the most.
 * (state, actorId, actions) -> an action for act(). Deterministic: it rolls nothing.
 */
export function defaultPolicy(state, actorId = currentActor(state), actions = legalActions(state, actorId)) {
  const s = state;
  const me = C(s, actorId);
  const ok = actions.filter((a) => !a.disabled);
  const skillOf = (a) => s.defs.skills[a.skillId];
  const val = isHeroVal(me);
  const mates = living(s, HERO).map((id) => C(s, id));
  const out = (a, target) => ({ kind: a.kind, skillId: a.skillId, stance: a.stance, target: a.choose ? target ?? a.targets[0] : undefined });

  let stance = null;
  if (val) {
    const gauge = airheadOf(me);
    // Wing It keeps the accidents coming. While the ledger is flipped the luck runs backwards, so think until Lucid.
    stance = me.flags?.ledgerFlipped && !has(me, 'good_hero') && gauge > AIRHEAD.LUCID_MAX ? 'think' : 'wing';
  }
  const mine = ok.filter((a) => !val || !a.stance || a.stance === stance);
  const pool = mine.some((a) => a.kind === 'attack') ? mine : ok;
  const fxOf = (a) => (a.kind === 'skill' ? skillOf(a)?.effects ?? [] : []);

  // 1. Take the ending the boss is offering once the party is in real trouble.
  const concede = ok.find((a) => a.kind === 'concede');
  if (concede && (mates.length < s.heroes.length || mean(mates.map(share)) < 0.45 || mates.some((h) => h.stress >= 90))) return out(concede);

  // 2. Get people back on their feet, then keep them there.
  const revive = pool.find((a) => fxOf(a).some((fx) => fx.kind === 'revive'));
  if (revive) return out(revive);
  const heals = pool.filter((a) => a.kind === 'skill' && skillOf(a).type === 'heal' && num(skillOf(a).power) > 0);
  for (const a of heals) {
    // Whoever is holding the enemy's attention gets looked after a little sooner.
    const hurtOnes = a.targets.map((id) => C(s, id)).filter((t) => share(t) < (has(t, 'taunt') ? 0.65 : 0.5) && !refuses(t, 'heal'));
    if (a.mode === 'allies' ? hurtOnes.length >= 2 : hurtOnes.length >= 1) return out(a, hurtOnes.sort((x, y) => share(x) - share(y))[0].id);
  }

  // 3. Nerves: talk down whoever is about to crack, or take a breath.
  const calm = pool.filter((a) => a.kind === 'skill' && !OFFENSIVE.includes(a.mode) && fxOf(a).some((fx) => fx.kind === 'stress' && fx.amount <= -10 && fx.target === undefined) && !fxOf(a).some((fx) => fx.kind === 'bind'));
  for (const a of calm) {
    const frayed = a.targets.map((id) => C(s, id)).filter((t) => t.stress >= 70 && !t.resolve);
    if (frayed.length) return out(a, frayed.sort((x, y) => y.stress - x.stress)[0].id);
  }
  const rest = ok.find((a) => a.kind === 'breather');
  if (rest && me.stress >= 85 && !me.resolve && me.flags?.last?.kind !== 'breather') return out(rest);

  // 4. Badly hurt with a healer still up: hold on behind a Guard. (Valerie's dodge is worth more than her Guard.)
  const guard = ok.find((a) => a.kind === 'guard');
  const healerUp = mates.some((h) => h.id !== me.id && h.skills.some((id) => s.defs.skills[id]?.type === 'heal' && num(s.defs.skills[id]?.cost?.mp) <= h.mp));
  if (guard && share(me) < 0.2 && healerUp && !(val && airheadOf(me) > AIRHEAD.LUCID_MAX) && me.flags?.last?.kind !== 'guard') return out(guard);

  // 5. Valerie: stand where the accidents pay out, and spend a full gauge unless the ending needs it.
  if (val) {
    const savesLimit = (s.concession?.effects ?? []).some((fx) => fx.kind === 'limit' && fx.amount < 0);
    const ultimate = pool.find((a) => fxOf(a).some((fx) => fx.kind === 'status' && fx.id === 'good_hero'));
    if (ultimate && !savesLimit && !has(me, 'good_hero')) return out(ultimate);
    const taunt = pool.find((a) => fxOf(a).some((fx) => fx.kind === 'status' && fx.id === 'taunt'));
    const held = statusOf(me, 'taunt');
    const lucky = me.flags?.ledgerFlipped && !has(me, 'good_hero') ? airheadOf(me) <= 50 : airheadOf(me) >= 50;
    if (taunt && (!held || num(held.turns, 9) <= 1) && share(me) >= 0.35 && lucky) return out(taunt);
  }

  // 6. A wound-up move is coming: try to tie up the part it needs.
  const part = s.boss?.pending?.part;
  if (part) {
    const binder = pool.filter((a) => a.kind === 'skill' && OFFENSIVE.includes(a.mode) && fxOf(a).some((fx) => fx.kind === 'bind' && fx.part === part && fx.target !== 'self'))
      .sort((x, y) => Math.max(...fxOf(y).filter((fx) => fx.kind === 'bind').map((fx) => fx.chance)) - Math.max(...fxOf(x).filter((fx) => fx.kind === 'bind').map((fx) => fx.chance)))[0];
    if (binder && binder.targets.includes(s.boss.id)) return out(binder, s.boss.id);
  }

  // 7. Otherwise: the attack expected to do the most.
  let best = null;
  for (const a of pool) {
    if (a.kind !== 'attack' && a.kind !== 'skill') continue;
    if (!OFFENSIVE.includes(a.mode)) continue;
    const skill = skillOf(a);
    if (!(num(skill.power) > 0)) continue;
    const opts = val && a.stance ? stanceEffects(me, a.stance).opts : {};
    const worth = (id) => { const t = C(s, id); return Math.min(t.hp, Math.max(0, expectedDamage(me, t, skill, opts))) * (hookOn(t, 'guard') ? 0.5 : 1); };
    // Pulling a boss off a taunting friend undoes the friend's work.
    if (fxOf(a).some((fx) => fx.kind === 'status' && fx.id === 'provoked') && mates.some((h) => h.id !== me.id && has(h, 'taunt'))) continue;
    const costly = fxOf(a).some((fx) => fx.target === 'self' && (fx.kind === 'bind' || (fx.kind === 'stress' && fx.amount > 0))) ? 0.8 : 1;
    if (a.choose && a.mode === 'one') {
      for (const id of a.targets) {
        const score = worth(id) * costly;
        if (!best || score > best.score || (score === best.score && C(s, id).hp < C(s, best.target).hp)) best = { a, target: id, score };
      }
    } else {
      const reach = a.mode === 'row' ? fielded(s, FOE) : a.targets;
      const score = reach.reduce((sum, id) => sum + worth(id), 0) * costly;
      if (!best || score > best.score) best = { a, target: a.targets[0], score };
    }
  }
  if (best) return out(best.a, best.target);
  const fallback = pool.find((a) => a.kind === 'attack') ?? guard ?? ok[0];
  if (!fallback) throw new Error(`defaultPolicy: ${actorId} has no legal action`);
  return out(fallback);
}

/** Headline numbers for a finished (or abandoned) run. */
export function summarize(state, events = []) {
  const count = (type, pred = () => true) => events.filter((e) => e.type === type && pred(e)).length;
  const sum = (pred, pick) => events.filter(pred).reduce((total, e) => total + num(pick(e)), 0);
  const boss = state.boss ? C(state, state.boss.id) : null;
  return {
    result: state.over ? state.result : 'timeout',
    outcome: state.over ? state.outcome : 'timeout',
    rounds: state.round,
    events: events.length,
    heroes: state.heroes.map((id) => {
      const c = C(state, id);
      return { id, name: c.name, hp: c.hp, maxHp: c.maxHp, stress: c.stress, limit: c.limit, resolve: c.resolve?.name ?? null, down: c.hp <= 0, airhead: isHeroVal(c) ? airheadOf(c) : undefined };
    }),
    enemiesLeft: living(state, FOE).length,
    bossHpPct: boss ? Math.round(share(boss) * 1000) / 10 : null,
    phase: state.boss ? state.boss.phase + 1 : null,
    damageToEnemies: sum((e) => (e.type === 'attack' && e.targetSide === FOE && !e.absorbed) || (e.type === 'damage' && e.targetSide === FOE), (e) => (e.type === 'attack' ? e.hpBefore - e.hpAfter : e.amount))
      + sum((e) => e.type === 'attack' && e.outcome === 'bounce', (e) => e.reflected),
    damageToHeroes: sum((e) => (e.type === 'attack' && e.targetSide === HERO && !e.absorbed) || (e.type === 'damage' && e.targetSide === HERO), (e) => (e.type === 'attack' ? e.hpBefore - e.hpAfter : e.amount)),
    heroesDowned: count('defeat', (e) => e.targetSide === HERO),
    resolveChecks: count('resolve'),
    virtues: count('resolve', (e) => e.kind === 'virtue'),
    afflictions: count('resolve', (e) => e.kind === 'affliction'),
    breakdowns: count('breakdown'),
    chaosWaves: count('chaos_wave'),
    contraptions: count('contraption'),
    dodges: count('attack', (e) => e.dodged),
    bounces: count('attack', (e) => e.outcome === 'bounce'),
    enemyFumbles: count('attack', (e) => e.outcome === 'fumble' && e.targetYou && e.actorSide === FOE),
    binds: count('bind', (e) => e.success !== false),
    phases: count('phase'),
    telegraphs: count('telegraph'),
    cancels: count('cancel'),
    rewards: state.rewards,
    story: { trust: state.story.trust, rep: state.story.rep },
  };
}

/**
 * Play a whole battle with a policy, for tests and simulation.
 * opts: { policy = defaultPolicy, rng = makeRng(setup.seed ?? 1), maxRounds = 60, breakdownChoice }
 * Returns { state, events, summary }. A fight still running after maxRounds stops there: summary.result 'timeout'.
 */
export function runBattle(setup, { policy = defaultPolicy, rng, maxRounds = 60, breakdownChoice } = {}) {
  const dice = rng ?? setup.rng ?? makeRng(setup.seed ?? 1);
  const options = breakdownChoice ? { ...(setup.options ?? {}), breakdownChoice } : setup.options;
  let state = createBattle({ ...setup, options }, dice);
  const events = [...state.opening];
  while (!state.over && state.round <= maxRounds) {
    const actor = currentActor(state);
    const step = act(state, policy(state, actor, legalActions(state, actor)), dice);
    state = step.state;
    events.push(...step.events);
  }
  return { state, events, summary: summarize(state, events) };
}
