// Cross-reference check: does everything every file names actually exist, and can every cost be paid?
//   node tools/check-data.mjs
// Each role tests its own files. This checks the seams between them, which no single role can see.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAllData } from '../engine/data-node.js';
import { validateArchetype, statsAt, maxHp, maxMp } from '../engine/progression.js';
import { STAT_KEYS, ELEMENTS, BIND_PARTS, SCALE, AFFINITY_MULT, RANK_HP_MULT } from '../engine/constants.js';

const errors = [];
const notes = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const data = loadAllData();
const packsDir = fileURLToPath(new URL('../events/packs/', import.meta.url));
const packs = readdirSync(packsDir).filter((f) => f.endsWith('.events.json')).map((f) => JSON.parse(readFileSync(path.join(packsDir, f), 'utf8')));

for (const [name, value] of Object.entries(data)) if (value === null) err(`data/${name}.json`, 'file is missing');

const TYPES = ['physical', 'magical', 'heal', 'buff', 'debuff', 'stress', 'utility'];
const TARGETS = ['one', 'row', 'all', 'self', 'ally', 'allies'];
const PARTS = [...BIND_PARTS, 'none'];
const EFFECT_KINDS = ['bind', 'stress', 'mod', 'status', 'heal', 'limit', 'airhead', 'dot', 'cleanse', 'revive'];
const STRESS_SOURCES = ['general', 'horror', 'mental', 'realization', 'embarrassment', 'wound', 'death', 'bliss'];
const AFFINITIES = Object.keys(AFFINITY_MULT);

// ---------- one id space ----------
const ids = new Map();
const claim = (id, where) => {
  if (typeof id !== 'string' || !id) return err(where, 'missing id');
  if (ids.has(id)) err(where, `id "${id}" is already used by ${ids.get(id)}`);
  else ids.set(id, where);
};

// ---------- archetypes ----------
const archetypes = new Map((data.archetypes?.archetypes ?? []).map((a) => [a.id, a]));
if (data.valerie?.archetype) archetypes.set(data.valerie.archetype.id, data.valerie.archetype);
for (const [id, a] of archetypes) {
  claim(`archetype:${id}`, `archetype ${id}`);
  const result = validateArchetype(a);
  for (const e of result.errors ?? []) err(`archetype ${id}`, e);
}
for (const need of ['warrior', 'mage', 'rogue', 'klutz_knight']) if (!archetypes.has(need)) err('archetypes', `"${need}" is missing`);

// ---------- statuses ----------
// Class and hero statuses live in skills.json. Bosses and encounters register their own beside their moves.
// The same id may be registered in more than one file; each file must register everything its own moves use.
const statuses = new Set();
for (const [file, list] of [['skills', data.skills?.statuses], ['bosses', data.bosses?.statuses], ['encounters', data.encounters?.statuses]]) {
  const seen = new Set();
  for (const s of list ?? []) {
    if (!s.id || !s.name || !s.text) err(`status ${s.id} in ${file}.json`, 'needs id, name and text');
    if (seen.has(s.id)) err(`status ${s.id} in ${file}.json`, 'registered twice in the same file');
    seen.add(s.id);
    statuses.add(s.id);
  }
}

// ---------- skills ----------
function checkEffects(effects, where) {
  for (const [i, e] of (effects ?? []).entries()) {
    const at = `${where} effect ${i + 1}`;
    if (!EFFECT_KINDS.includes(e.kind)) { err(at, `unknown kind "${e.kind}"`); continue; }
    if (e.kind === 'bind' && (!BIND_PARTS.includes(e.part) || !(e.chance >= 1 && e.chance <= 100) || !(e.turns >= 1))) err(at, 'bind needs part, chance 1..100 and turns');
    if (e.kind === 'stress') {
      if (typeof e.amount !== 'number' || Math.abs(e.amount) > SCALE.STRESS_MAX) err(at, 'stress amount must be within ±200');
      if (e.source !== undefined && !STRESS_SOURCES.includes(e.source)) err(at, `unknown stress source "${e.source}"`);
    }
    if (e.kind === 'mod' && (!STAT_KEYS.includes(e.stat) || typeof e.mult !== 'number' || !(e.turns >= 1))) err(at, 'mod needs stat, mult and turns');
    if (e.kind === 'status' && !statuses.has(e.id)) err(at, `status "${e.id}" is not registered (skills.json, bosses.json or encounters.json "statuses")`);
    if (e.kind === 'dot' && e.element !== undefined && !ELEMENTS.includes(e.element)) err(at, `unknown element "${e.element}"`);
  }
}

function checkSkill(s, where, { prefix, archetype, needsCost = true }) {
  claim(s.id, where);
  if (prefix && !s.id?.startsWith(prefix)) err(where, `id should start with "${prefix}"`);
  if (!s.name || !s.text) err(where, 'needs name and text');
  if (!TYPES.includes(s.type)) err(where, `unknown type "${s.type}"`);
  if (!TARGETS.includes(s.target)) err(where, `unknown target "${s.target}"`);
  if (!PARTS.includes(s.part)) err(where, `unknown part "${s.part}"`);
  if (s.element !== undefined && !ELEMENTS.includes(s.element)) err(where, `unknown element "${s.element}"`);
  if (s.stat !== undefined && !STAT_KEYS.includes(s.stat)) err(where, `unknown stat "${s.stat}"`);
  if (typeof s.power !== 'number' || s.power < 0) err(where, 'power must be 0 or more');
  checkEffects(s.effects, where);
  if (!needsCost) return;
  if (!(s.unlock >= SCALE.LEVEL_MIN && s.unlock <= SCALE.LEVEL_MAX)) err(where, 'unlock must be 1..100');
  const mp = s.cost?.mp ?? 0;
  const limit = s.cost?.limit ?? 0;
  if (mp < 0 || limit < 0 || limit > SCALE.LIMIT_MAX) err(where, 'cost out of range');
  if (archetype && mp > 0) {
    const pool = maxMp(s.unlock, statsAt(archetype, s.unlock).WIL);
    if (mp > pool) err(where, `costs ${mp} MP but a level ${s.unlock} ${archetype.id} only has ${pool}`);
  }
}

const PREFIX = { warrior: 'war_', mage: 'mag_', rogue: 'rog_', klutz_knight: 'val_' };
for (const s of data.skills?.skills ?? []) {
  const a = archetypes.get(s.archetype);
  if (!a) err(`skill ${s.id}`, `unknown archetype "${s.archetype}"`);
  checkSkill(s, `skill ${s.id}`, { prefix: PREFIX[s.archetype], archetype: a });
}
for (const s of data.valerie?.skills ?? []) checkSkill(s, `valerie skill ${s.id}`, { prefix: 'val_', archetype: data.valerie.archetype });
for (const a of data.valerie?.abilities ?? []) claim(a.id, `valerie ability ${a.id}`);
for (const [id, a] of archetypes) {
  const mine = [...(data.skills?.skills ?? []), ...(data.valerie?.skills ?? [])].filter((s) => s.archetype === id);
  if (data.skills && !mine.length) err(`archetype ${id}`, 'has no skills');
  if (mine.length && !mine.some((s) => s.unlock === 1)) err(`archetype ${id}`, 'has no skill at level 1');
}

// ---------- passives ----------
for (const p of data.passives?.passives ?? []) {
  claim(p.id, `passive ${p.id}`);
  if (p.archetype !== 'any' && !archetypes.has(p.archetype)) err(`passive ${p.id}`, `unknown archetype "${p.archetype}"`);
  if (!p.name || !p.text || !p.choice) err(`passive ${p.id}`, 'needs name, text and choice');
  if (!(p.unlock >= 1 && p.unlock <= 100)) err(`passive ${p.id}`, 'unlock must be 1..100');
}

// ---------- items ----------
const items = new Set();
for (const i of data.items?.items ?? []) {
  claim(i.id, `item ${i.id}`);
  items.add(i.id);
  if (!i.id?.startsWith('itm_')) err(`item ${i.id}`, 'id should start with "itm_"');
  if (!i.name || !i.text) err(`item ${i.id}`, 'needs name and text');
  if (!(i.price > 0)) err(`item ${i.id}`, 'needs a positive price');
  if (!(i.level >= 1 && i.level <= 100)) err(`item ${i.id}`, 'level must be 1..100');
}

// ---------- afflictions and virtues ----------
const resolveIds = new Set();
const bands = [];
for (const [kind, list, prefix] of [['affliction', data.afflictions?.afflictions ?? [], 'aff_'], ['virtue', data.virtues?.virtues ?? [], 'vir_']]) {
  for (const e of list) {
    claim(e.id, `${kind} ${e.id}`);
    resolveIds.add(e.id);
    if (!e.id?.startsWith(prefix)) err(`${kind} ${e.id}`, `id should start with "${prefix}"`);
    if (!e.name || !e.text) err(`${kind} ${e.id}`, 'needs name and text');
    if (!Array.isArray(e.range) || e.range.length !== 2 || e.range[0] > e.range[1]) err(`${kind} ${e.id}`, 'needs range [lo, hi]');
    else bands.push({ id: e.id, lo: e.range[0], hi: e.range[1] });
  }
}
for (const side of ['affliction', 'virtue']) {
  const own = data.valerie?.resolve?.[side];
  if (own) { claim(own.id, `valerie ${side} ${own.id}`); resolveIds.add(own.id); }
}
if (bands.length) {
  bands.sort((a, b) => a.lo - b.lo);
  let next = 1;
  for (const b of bands) {
    if (b.lo !== next) err('resolve table', `${b.id} starts at ${b.lo} but the table is filled up to ${next - 1}`);
    next = b.hi + 1;
  }
  if (next !== 101) err('resolve table', `bands end at ${next - 1}, not 100`);
}

// ---------- bosses and encounters ----------
function checkCombatStats(stats, where) {
  for (const k of STAT_KEYS) if (!(Number.isInteger(stats?.[k]) && stats[k] >= SCALE.STAT_MIN && stats[k] <= SCALE.STAT_MAX)) err(where, `${k} must be an integer 1..1000`);
}
function checkAffinities(aff, where) {
  for (const [el, v] of Object.entries(aff ?? {})) {
    if (!ELEMENTS.includes(el)) err(where, `unknown element "${el}"`);
    if (!AFFINITIES.includes(v)) err(where, `unknown affinity "${v}"`);
  }
}
function checkBindResist(r, where) {
  for (const [part, v] of Object.entries(r ?? {})) if (!BIND_PARTS.includes(part) || !(v >= 0 && v <= 80)) err(where, `bindResist.${part} must be 0..80`);
}
for (const b of data.bosses?.bosses ?? []) {
  const where = `boss ${b.id}`;
  claim(b.id, where);
  checkCombatStats(b.stats, where);
  checkAffinities(b.affinities, where);
  checkBindResist(b.bindResist, where);
  if (!RANK_HP_MULT[b.rank]) err(where, `unknown rank "${b.rank}"`);
  else if (b.stats && b.hp !== maxHp(b.level, b.stats.CON, b.rank)) err(where, `hp ${b.hp} does not equal maxHp(${b.level}, ${b.stats.CON}, ${b.rank}) = ${maxHp(b.level, b.stats.CON, b.rank)}`);
  if (!b.identity || !b.want || !b.cost || !b.counterplay) err(where, 'needs identity, want, cost and counterplay');
  const moves = new Set();
  for (const m of b.moves ?? []) { checkSkill(m, `${where} move ${m.id}`, { needsCost: false }); moves.add(m.id); }
  for (const ph of b.phases ?? []) for (const id of ph.moves ?? []) if (!moves.has(id)) err(where, `phase "${ph.name}" uses move "${id}" which is not defined`);
  if (!b.contraption?.name) err(where, 'needs a contraption');
  for (const id of b.rewards?.items ?? []) if (data.items && !items.has(id)) err(where, `reward item "${id}" is not in items.json`);
}
if (data.bosses && (data.bosses.bosses ?? []).length !== 3) err('bosses', 'there must be exactly three');

const encounters = new Set();
for (const e of data.encounters?.encounters ?? []) {
  const where = `encounter ${e.id}`;
  claim(`encounter:${e.id}`, where);
  encounters.add(e.id);
  if (!e.name || !e.text) err(where, 'needs name and text');
  for (const x of e.enemies ?? []) {
    const at = `${where} enemy ${x.id}`;
    claim(x.id, at);
    if (!RANK_HP_MULT[x.rank]) err(at, `unknown rank "${x.rank}"`);
    if (!(x.count >= 1) || !x.name || !x.text) err(at, 'needs name, text and count');
    for (const k of STAT_KEYS) if (!(x.factors?.[k] > 0)) err(at, `factors.${k} must be a positive multiple of the benchmark`);
    checkAffinities(x.affinities, at);
    checkBindResist(x.bindResist, at);
    for (const m of x.moves ?? []) checkSkill(m, `${at} move ${m.id}`, { needsCost: false });
  }
}

// ---------- events ----------
const eventIds = new Set(packs.flatMap((p) => p.events.map((e) => e.id)));
for (const pack of packs) for (const event of pack.events) for (const choice of event.choices) {
  for (const branch of ['success', 'failure', 'crit', 'fumble']) for (const fx of choice[branch]?.effects ?? []) {
    const where = `event ${event.id} / ${choice.id} / ${branch}`;
    if ((fx.kind === 'item' || (fx.kind === 'misplace' && fx.id)) && data.items && !items.has(fx.id)) err(where, `item "${fx.id}" is not in items.json`);
    if (fx.kind === 'battle' && data.encounters && !encounters.has(fx.encounter)) err(where, `encounter "${fx.encounter}" is not in encounters.json`);
    if (fx.kind === 'next' && !eventIds.has(fx.event)) err(where, `event "${fx.event}" does not exist`);
    if (fx.kind === 'resolve' && fx.id && !resolveIds.has(fx.id)) err(where, `"${fx.id}" is not an affliction or virtue`);
    if (fx.kind === 'stress' && fx.source && !STRESS_SOURCES.includes(fx.source)) err(where, `unknown stress source "${fx.source}"`);
  }
}

// ---------- report ----------
const count = (list) => (list ?? []).length;
notes.push(`${archetypes.size} archetypes`);
notes.push(`${count(data.skills?.skills) + count(data.valerie?.skills)} skills, ${count(data.passives?.passives) + count(data.valerie?.abilities)} passives, ${statuses.size} statuses`);
notes.push(`${count(data.items?.items)} items`);
notes.push(`${count(data.afflictions?.afflictions)} afflictions, ${count(data.virtues?.virtues)} virtues`);
notes.push(`${count(data.bosses?.bosses)} bosses, ${encounters.size} encounters`);
notes.push(`${eventIds.size} events in ${packs.length} pack${packs.length === 1 ? '' : 's'}`);
console.log(`checked ${ids.size} ids: ${notes.join('; ')}`);
if (errors.length) {
  console.log(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('ok: every reference resolves and every cost is payable');
