// The asset registry: class skills, passives, shop items and gear tiers.
// Owner: Content Writer. These tests pin the data in data/skills.json, data/passives.json and data/items.json
// to the curves in engine/progression.js and engine/combat.js, so a retune of either side fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../engine/data-node.js';
import { SCALE, STAT_KEYS, ELEMENTS, BIND_PARTS, GROWTH, MOD_CLAMP } from '../engine/constants.js';
import { makeCombatant, benchmarkStat } from '../engine/stats.js';
import { damage, healAmount, BASIC_POWER } from '../engine/combat.js';
import { mpBudget, hpBudget, maxMp, maxHp, statsAt, statAt, priceAt, priceForFights, fightGold, PRICE_GUIDE } from '../engine/progression.js';

const skillsData = readData('skills');
const passivesData = readData('passives');
const itemsData = readData('items');
const valerie = readData('valerie');
const archetypes = Object.fromEntries(readData('archetypes').archetypes.map((a) => [a.id, a]));

const skills = skillsData.skills;
const statuses = skillsData.statuses;
const passives = passivesData.passives;
const items = itemsData.items;
const gearTiers = itemsData.gearTiers;
const statusIds = new Set(statuses.map((s) => s.id));

const CLASSES = ['warrior', 'mage', 'rogue'];
const PREFIX = { warrior: 'war_', mage: 'mag_', rogue: 'rog_', any: 'any_' };
const TYPES = ['physical', 'magical', 'heal', 'buff', 'debuff', 'stress', 'utility'];
const TARGETS = ['one', 'row', 'all', 'self', 'ally', 'allies'];
const ENEMY_TARGETS = ['one', 'row', 'all'];
const PARTS = [...BIND_PARTS, 'none'];
const EFFECT_KINDS = ['bind', 'stress', 'mod', 'status', 'heal', 'limit', 'dot', 'cleanse', 'revive'];
const STRESS_SOURCES = ['general', 'horror', 'mental', 'realization', 'embarrassment', 'wound', 'death'];
const CLEANSE_WHAT = ['binds', 'mods', 'statuses'];
const ITEM_CATEGORIES = ['recovery', 'mp', 'stress', 'cure', 'revive', 'elemental', 'buff', 'seed', 'key'];
const SKILL_KEYS = ['id', 'name', 'archetype', 'unlock', 'tier', 'type', 'stat', 'power', 'acc', 'crit', 'element', 'target', 'part', 'cost', 'mpShare', 'tags', 'effects', 'text'];
const HERO_STATUSES = ['analyzed', 'extra_slippery', 'taunt', 'pocket_found_check', 'good_hero', 'auto_crit_next_think', 'plot_armor', 'guard_broken'];
const NON_PHYSICAL = ELEMENTS.filter((e) => e !== 'phys');
const ID_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

// The Combat Engineer's ranges (handoff/combat-engineer.md, "Content Writer").
const RANGE = { ACC: [-20, 20], CRIT: [0, 20], SKILL_POWER: [BASIC_POWER, 12], RIDERLESS_POWER: 3, ULT_POWER: [20, 30], AREA_POWER_MAX: 8 };
// Share of mpBudget(unlock) by weight: light, standard, heavy, signature. Bars are 0.5 / 1.33 / 0.67 of the budget.
const SHARES = { warrior: [0.03, 0.05, 0.07, 0.1], mage: [0.06, 0.1, 0.14, 0.2], rogue: [0.04, 0.06, 0.09, 0.13] };

/** Two significant figures, never below 1: how every MP cost and gold price in the registry is rounded. */
const tidy = (x) => Math.max(1, Math.round(Number(Number(x).toPrecision(2))));
const isUltimate = (s) => s.tags.includes('ultimate');
const of = (archetype) => skills.filter((s) => s.archetype === archetype).sort((a, b) => a.unlock - b.unlock);
const actives = (archetype) => of(archetype).filter((s) => !isUltimate(s));
const effectsOf = (s, kind) => s.effects.filter((e) => e.kind === kind);
const aimsAtEnemy = (s, e) => e.target !== 'self' && ENEMY_TARGETS.includes(s.target);
const isDamaging = (s) => (s.type === 'physical' || s.type === 'magical') && s.power > 0;
const peer = (level) => makeCombatant({ level, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, benchmarkStat(level)])) });
const member = (archetype, level) => makeCombatant({ level, archetype, stats: statsAt(archetypes[archetype], level) });

function checkEffect(e, where) {
  assert.ok(EFFECT_KINDS.includes(e.kind), `${where}: unknown effect kind "${e.kind}"`);
  if (e.target !== undefined) assert.equal(e.target, 'self', `${where}: an effect may only override its target with "self"`);
  switch (e.kind) {
    case 'bind':
      assert.ok(BIND_PARTS.includes(e.part), `${where}: bind part "${e.part}"`);
      assert.ok(Number.isInteger(e.turns) && e.turns >= 1 && e.turns <= 5, `${where}: bind turns ${e.turns}`);
      if (e.target === 'self') assert.equal(e.chance, 100, `${where}: a self-bind is a cost, not a roll: chance 100`);
      else assert.ok(e.chance >= 30 && e.chance <= 60, `${where}: bind base chance ${e.chance} is outside 30..60`);
      break;
    case 'stress':
      assert.ok(Number.isInteger(e.amount) && e.amount !== 0 && Math.abs(e.amount) <= 50, `${where}: stress amount ${e.amount}`);
      assert.ok(STRESS_SOURCES.includes(e.source), `${where}: stress source "${e.source}"`);
      break;
    case 'mod':
      assert.ok(STAT_KEYS.includes(e.stat), `${where}: mod stat "${e.stat}"`);
      assert.ok(e.mult >= MOD_CLAMP.MIN && e.mult <= MOD_CLAMP.MAX && e.mult !== 1, `${where}: mod mult ${e.mult}`);
      break;
    case 'status':
      assert.ok(statusIds.has(e.id), `${where}: status "${e.id}" is not in the registry`);
      assert.ok(Number.isInteger(e.turns) && e.turns >= 1 && e.turns <= 5, `${where}: status turns ${e.turns}`);
      break;
    case 'heal':
      assert.ok(Number.isFinite(e.pct) || Number.isFinite(e.power), `${where}: heal needs pct or power`);
      break;
    case 'limit':
      assert.ok(Number.isInteger(e.amount) && e.amount > 0 && e.amount <= SCALE.LIMIT_MAX, `${where}: limit amount ${e.amount}`);
      break;
    case 'dot':
      assert.ok(e.power > 0 && e.power <= 2, `${where}: dot power ${e.power}`);
      assert.ok(Number.isInteger(e.turns) && e.turns >= 1 && e.turns <= 5, `${where}: dot turns ${e.turns}`);
      assert.ok(ELEMENTS.includes(e.element), `${where}: dot element "${e.element}"`);
      break;
    case 'cleanse':
      assert.ok(CLEANSE_WHAT.includes(e.what), `${where}: cleanse what "${e.what}"`);
      break;
    case 'revive':
      assert.ok(e.pct >= 1 && e.pct <= 100, `${where}: revive pct ${e.pct}`);
      break;
  }
}

// ------------------------------------------------------------------------------------------ shape and ids

test('the three data files load with their documented shape', () => {
  for (const [name, data] of [['skills', skillsData], ['passives', passivesData], ['items', itemsData]]) {
    assert.ok(data, `data/${name}.json is missing`);
    assert.equal(data.version, 1, `data/${name}.json version`);
  }
  assert.ok(Array.isArray(statuses) && Array.isArray(skills) && Array.isArray(passives) && Array.isArray(items) && Array.isArray(gearTiers));
});

test('ids are unique, snake case, and carry their owner prefix', () => {
  const seen = new Set([...valerie.skills, ...valerie.abilities].map((x) => x.id));
  const claim = (id, where) => {
    assert.match(id, ID_RE, `${where}: "${id}" is not lowercase snake case`);
    assert.ok(!seen.has(id), `${where}: id "${id}" is used twice`);
    seen.add(id);
  };
  for (const s of skills) {
    assert.ok(CLASSES.includes(s.archetype), `skill ${s.id}: unknown archetype "${s.archetype}"`);
    assert.ok(s.id.startsWith(PREFIX[s.archetype]), `skill ${s.id} should start with ${PREFIX[s.archetype]}`);
    assert.ok(!s.id.startsWith(`${PREFIX[s.archetype]}p_`), `skill ${s.id} uses the passive prefix`);
    claim(s.id, 'skill');
  }
  for (const p of passives) {
    assert.ok(p.archetype in PREFIX, `passive ${p.id}: unknown archetype "${p.archetype}"`);
    assert.ok(p.id.startsWith(`${PREFIX[p.archetype]}p_`), `passive ${p.id} should start with ${PREFIX[p.archetype]}p_`);
    claim(p.id, 'passive');
  }
  for (const i of items) {
    assert.ok(i.id.startsWith('itm_'), `item ${i.id} should start with itm_`);
    claim(i.id, 'item');
  }
  const statusSeen = new Set();
  for (const s of statuses) {
    assert.match(s.id, ID_RE);
    assert.ok(!statusSeen.has(s.id), `status "${s.id}" is registered twice`);
    statusSeen.add(s.id);
  }
});

test('every skill follows the Skill shape in FOUNDATION.md', () => {
  for (const s of skills) {
    const where = `skill ${s.id}`;
    for (const key of Object.keys(s)) assert.ok(SKILL_KEYS.includes(key), `${where}: unexpected key "${key}"`);
    for (const key of SKILL_KEYS) if (key !== 'mpShare') assert.ok(s[key] !== undefined, `${where}: missing "${key}"`);
    assert.ok(typeof s.name === 'string' && s.name.trim().length > 0, `${where}: name`);
    assert.ok(TYPES.includes(s.type), `${where}: type "${s.type}"`);
    assert.ok(STAT_KEYS.includes(s.stat), `${where}: stat "${s.stat}"`);
    assert.ok(ELEMENTS.includes(s.element), `${where}: element "${s.element}"`);
    assert.ok(TARGETS.includes(s.target), `${where}: target "${s.target}"`);
    assert.ok(PARTS.includes(s.part), `${where}: part "${s.part}"`);
    assert.ok(Number.isFinite(s.power) && s.power >= 0, `${where}: power`);
    assert.ok(Number.isInteger(s.acc) && Number.isInteger(s.crit), `${where}: acc and crit are whole numbers`);
    assert.ok(Number.isInteger(s.cost.mp) && Number.isInteger(s.cost.limit), `${where}: cost is whole numbers`);
    assert.deepEqual(Object.keys(s.cost).sort(), ['limit', 'mp'], `${where}: cost has exactly mp and limit`);
    assert.ok(Array.isArray(s.tags) && s.tags.every((t) => typeof t === 'string'), `${where}: tags`);
    assert.ok(Array.isArray(s.effects), `${where}: effects`);
    assert.ok(typeof s.text === 'string' && /[.!?]$/.test(s.text) && s.text.length >= 20, `${where}: text must be a finished sentence`);
    // What the type promises.
    if (s.type === 'physical') assert.ok(s.power > 0 && s.element === 'phys' && ENEMY_TARGETS.includes(s.target), `${where}: a physical skill deals phys damage to enemies`);
    if (s.type === 'magical') assert.ok(s.power > 0 && s.stat === 'INT' && s.element !== 'phys' && ENEMY_TARGETS.includes(s.target), `${where}: a magical skill deals elemental INT damage to enemies`);
    if (s.type === 'heal') assert.ok(['self', 'ally', 'allies'].includes(s.target) && (s.power > 0 || effectsOf(s, 'revive').length === 1), `${where}: a heal restores HP or revives`);
    if (['buff', 'utility'].includes(s.type)) assert.equal(s.power, 0, `${where}: buffs and utilities deal no damage`);
    if (['debuff', 'stress'].includes(s.type)) assert.ok(s.power === 0 && ENEMY_TARGETS.includes(s.target), `${where}: debuff and stress skills aim at enemies and deal no damage`);
    if (s.type === 'stress') assert.ok(effectsOf(s, 'stress').some((e) => e.amount > 0 && e.target !== 'self'), `${where}: a stress skill inflicts stress`);
    if (s.power === 0 && !isUltimate(s)) assert.ok(s.effects.length > 0 || s.tags.includes('scripted'), `${where}: a skill with no power must do something`);
  }
});

test('every effect on a skill is well-formed', () => {
  for (const s of skills) s.effects.forEach((e, i) => checkEffect(e, `skill ${s.id} effect ${i + 1}`));
});

// ------------------------------------------------------------------------------------------ tier lists

test('each archetype has 14 to 16 active skills and exactly two ultimates', () => {
  for (const a of CLASSES) {
    const n = actives(a).length;
    assert.ok(n >= 14 && n <= 16, `${a} has ${n} active skills`);
    assert.equal(of(a).filter(isUltimate).length, 2, `${a} ultimates`);
  }
});

test('each tier list runs from level 1 to 100 with no gap over 12 levels, and tiers never go down', () => {
  for (const a of CLASSES) {
    const list = of(a);
    for (const s of list) {
      assert.ok(Number.isInteger(s.unlock) && s.unlock >= SCALE.LEVEL_MIN && s.unlock <= SCALE.LEVEL_MAX, `${s.id}: unlock ${s.unlock}`);
      assert.ok(Number.isInteger(s.tier) && s.tier >= 1 && s.tier <= 10, `${s.id}: tier ${s.tier}`);
      assert.equal(s.tier, Math.ceil(s.unlock / 10), `${s.id}: tier is the ten-level bracket of its unlock`);
    }
    assert.equal(list[0].unlock, 1, `${a} needs a skill at level 1`);
    assert.ok(list.at(-1).unlock >= 90, `${a}'s last unlock is level ${list.at(-1).unlock}`);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i].unlock - list[i - 1].unlock;
      assert.ok(gap <= 12, `${a}: ${gap} levels with nothing new between ${list[i - 1].id} and ${list[i].id}`);
      assert.ok(list[i].tier >= list[i - 1].tier, `${a}: tier drops at ${list[i].id}`);
    }
    assert.ok(SCALE.LEVEL_MAX - list.at(-1).unlock <= 12);
    assert.deepEqual([...new Set(list.map((s) => s.tier))], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `${a} must have something in every tier`);
    assert.ok(list.filter((s) => s.unlock === 1).length >= 2, `${a} should start with two skills to choose between`);
  }
});

// ------------------------------------------------------------------------------------------ costs

test('MP costs are flat: mpShare × mpBudget(unlock), tidy, and payable at least twice at unlock', () => {
  for (const s of skills.filter((x) => !isUltimate(x))) {
    const where = `skill ${s.id}`;
    assert.ok(SHARES[s.archetype].includes(s.mpShare), `${where}: mpShare ${s.mpShare} is not on the ${s.archetype} ladder`);
    assert.equal(s.cost.mp, tidy(s.mpShare * mpBudget(s.unlock)), `${where}: cost.mp does not match its share`);
    assert.equal(s.cost.limit, 0, `${where}: only ultimates spend Limit`);
    assert.ok(s.cost.mp >= 1, `${where}: every skill costs something`);
    const pool = maxMp(s.unlock, statsAt(archetypes[s.archetype], s.unlock).WIL);
    assert.ok(s.cost.mp * 2 <= pool, `${where}: ${s.cost.mp} MP cannot be paid twice from a level ${s.unlock} ${s.archetype}'s ${pool}`);
  }
});

test('from level 10 on, a full bar buys 4 to 25 casts of any skill at its unlock level', () => {
  for (const s of skills.filter((x) => !isUltimate(x) && x.unlock >= 10)) {
    const casts = maxMp(s.unlock, statsAt(archetypes[s.archetype], s.unlock).WIL) / s.cost.mp;
    assert.ok(casts >= 4 && casts <= 25, `${s.id}: ${casts.toFixed(1)} casts per bar`);
  }
});

test('ultimates cost Limit and no MP; each archetype has one it can afford before the gauge is full', () => {
  for (const s of skills.filter(isUltimate)) {
    assert.equal(s.cost.mp, 0, `${s.id}: ultimates cost no MP`);
    assert.equal(s.mpShare, undefined, `${s.id}: ultimates have no mpShare`);
    assert.ok(s.cost.limit >= 50 && s.cost.limit <= SCALE.LIMIT_MAX, `${s.id}: limit cost ${s.cost.limit}`);
    assert.ok(s.text.startsWith('Ultimate.'), `${s.id}: text should open with "Ultimate."`);
  }
  for (const a of CLASSES) {
    const costs = of(a).filter(isUltimate).map((s) => s.cost.limit).sort((x, y) => x - y);
    assert.ok(costs[0] < SCALE.LIMIT_MAX && costs[1] === SCALE.LIMIT_MAX, `${a}: one cheaper ultimate and one that takes the whole gauge`);
  }
});

// ------------------------------------------------------------------------------------------ power, accuracy, crit

test("power, accuracy and crit stay inside the Combat Engineer's ranges", () => {
  for (const s of skills) {
    const where = `skill ${s.id}`;
    assert.ok(s.acc >= RANGE.ACC[0] && s.acc <= RANGE.ACC[1], `${where}: acc ${s.acc}`);
    assert.ok(s.crit >= RANGE.CRIT[0] && s.crit <= RANGE.CRIT[1], `${where}: crit ${s.crit}`);
    if (s.power === 0) continue;
    if (isUltimate(s)) {
      assert.ok(s.power >= RANGE.ULT_POWER[0] && s.power <= RANGE.ULT_POWER[1], `${where}: ultimate power ${s.power}`);
      continue;
    }
    assert.ok(s.power >= RANGE.SKILL_POWER[0] && s.power <= RANGE.SKILL_POWER[1], `${where}: power ${s.power}`);
    if (isDamaging(s) && s.power < RANGE.RIDERLESS_POWER) assert.ok(s.effects.length > 0, `${where}: a hit under Power 3 has to carry an effect`);
  }
});

test('area skills hit softer than single-target ones', () => {
  for (const a of CLASSES) {
    const hits = actives(a).filter(isDamaging);
    const single = Math.max(...hits.filter((s) => s.target === 'one').map((s) => s.power));
    for (const s of hits.filter((x) => x.target !== 'one')) {
      assert.ok(s.power <= RANGE.AREA_POWER_MAX, `${s.id}: area power ${s.power}`);
      assert.ok(s.power < single, `${s.id}: area power ${s.power} is not below ${a}'s single-target best of ${single}`);
    }
  }
  for (const s of skills.filter((x) => isDamaging(x) && x.target === 'all' && !isUltimate(x))) {
    const rows = actives(s.archetype).filter((x) => isDamaging(x) && x.target === 'row' && x.unlock <= s.unlock);
    for (const r of rows) assert.ok(s.unlock > r.unlock, `${s.id}: hitting everyone should come later than hitting a row`);
  }
});

test('against an even peer, a skill at its unlock level takes 8% to 70% of the bar and an ultimate takes all of it', () => {
  for (const s of skills.filter(isDamaging)) {
    const share = damage(member(s.archetype, s.unlock), peer(s.unlock), s) / hpBudget(s.unlock);
    if (isUltimate(s)) assert.ok(share >= 1, `${s.id}: ${(share * 100).toFixed(0)}% of a peer's bar`);
    else assert.ok(share >= 0.08 && share <= 0.7, `${s.id}: ${(share * 100).toFixed(0)}% of a peer's bar`);
  }
});

test('healing skills restore 15% to 50% of the bar of an ally whose Constitution matches the healer', () => {
  for (const s of skills.filter((x) => x.type === 'heal' && x.power > 0)) {
    const healer = member(s.archetype, s.unlock);
    const share = healAmount(healer, s) / maxHp(s.unlock, healer.stats[s.stat]);
    assert.ok(share >= 0.15 && share <= 0.5, `${s.id}: heals ${(share * 100).toFixed(0)}%`);
    assert.ok(s.text.includes(`Power ${s.power}`), `${s.id}: text should state its Power`);
  }
});

// ------------------------------------------------------------------------------------------ statuses

test('the status registry is complete: every status a skill, passive or item applies is registered', () => {
  for (const s of statuses) {
    assert.ok(typeof s.name === 'string' && s.name.length > 0, `status ${s.id}: name`);
    assert.ok(typeof s.text === 'string' && /[.!?]$/.test(s.text), `status ${s.id}: text`);
    assert.ok(['good', 'bad', 'neutral'].includes(s.polarity), `status ${s.id}: polarity`);
  }
  for (const id of HERO_STATUSES) assert.ok(statusIds.has(id), `hero status "${id}" must be registered`);
  for (const s of valerie.skills) for (const e of s.effects ?? []) if (e.kind === 'status') assert.ok(statusIds.has(e.id), `${s.id} uses unregistered status "${e.id}"`);
  for (const el of NON_PHYSICAL) assert.ok(statusIds.has(`ward_${el}`), `ward_${el} must be registered`);
  const used = new Set([...skills, ...passives, ...items, ...valerie.skills].flatMap((x) => (x.effects ?? []).filter((e) => e.kind === 'status').map((e) => e.id)));
  const engineDriven = ['rattled', 'routed']; // applied by the stress bar, not by a skill
  for (const s of statuses) assert.ok(used.has(s.id) || engineDriven.includes(s.id), `status "${s.id}" is registered but nothing applies it`);
});

test('enemy stress: the Rattled and Routed texts say what engine/stress.js does', async () => {
  const text = (id) => statuses.find((s) => s.id === id).text;
  // engine/stress.js enemyStressEvent() implements these two rungs, and test/stress.test.js reads these same phrases.
  assert.ok(text('rattled').includes('−10 to hit') && text('rattled').includes('91'), 'rattled: −10 to hit, fumbles on 91 or more');
  assert.ok(/minion or standard/i.test(text('routed')) && text('routed').includes('100'), 'routed: who runs, and where the bar resets');
  const engine = await import('../engine/stress.js').catch(() => null);
  const rules = engine?.ENEMY_STRESS;
  if (!rules) return; // the Systems Designer's file is not there yet: the phrases above still hold the contract
  assert.ok(text('rattled').includes(`−${Math.abs(rules.RATTLED_HIT_BONUS)} to hit`), 'rattled: hit penalty');
  assert.ok(text('rattled').includes(String(96 + rules.RATTLED_FUMBLE_SHIFT)), 'rattled: fumble edge');
  assert.ok(text('routed').includes(String(rules.ROUT_RESET)), 'routed: reset value');
  for (const rank of rules.ROUT_RUNS) assert.ok(text('routed').includes(rank), `routed: ${rank} enemies run`);
});

// ------------------------------------------------------------------------------------------ binds and body parts

test("each kit is spread across head, arms and legs: a bind hurts, and never seals more than 60% of the kit", () => {
  for (const a of CLASSES) {
    const list = of(a);
    for (const part of BIND_PARTS) {
      const n = list.filter((s) => s.part === part).length;
      assert.ok(n >= 2, `${a} has only ${n} ${part} skills: binding ${part} would not matter`);
      assert.ok(n / list.length <= 0.6, `${a}: a ${part} bind seals ${n} of ${list.length} skills`);
    }
    assert.ok(list.some((s) => s.part === 'none'), `${a} needs at least one skill no bind can seal`);
  }
});

test('self-binds are costs the text admits to', () => {
  const costs = skills.flatMap((s) => effectsOf(s, 'bind').filter((e) => e.target === 'self').map((e) => [s, e]));
  assert.ok(costs.length >= 4, 'self-binds are one of the registry\'s recurring costs');
  for (const [s, e] of costs) assert.match(s.text, new RegExp(`your (?:own )?${e.part} (?:is|are) bound for ${e.turns} turns?`, 'i'), `${s.id}: text must state the self-bind`);
});

// ------------------------------------------------------------------------------------------ archetype identity

test('warrior: taunt, guard and row tools', () => {
  const list = of('warrior');
  const applies = (id) => list.filter((s) => effectsOf(s, 'status').some((e) => e.id === id));
  assert.ok(applies('taunt').length >= 1, 'a taunt');
  assert.ok(applies('provoked').length >= 1, 'a single-target provoke');
  assert.ok(applies('covered').length >= 1, 'a cover');
  assert.ok(applies('guard').length + applies('fortified').length >= 2, 'guard tools');
  assert.ok(applies('guard_broken').length >= 2, 'guard breakers');
  assert.ok(list.filter((s) => s.target === 'row').length >= 3, 'row tools');
  // The cost: nerves. Several of its own tools bill the stress bar.
  assert.ok(list.filter((s) => effectsOf(s, 'stress').some((e) => e.amount > 0 && !aimsAtEnemy(s, e))).length >= 3, 'the warrior pays in stress');
  assert.ok(list.every((s) => s.type !== 'magical'), 'no spells');
});

test('mage: all five elements, a healing line, and costs that land on the body', () => {
  const list = of('mage');
  for (const el of NON_PHYSICAL) {
    const n = list.filter((s) => s.type === 'magical' && s.element === el).length;
    assert.ok(n >= 2 || (el === 'holy' && n >= 1), `mage needs ${el} attack spells, has ${n}`);
  }
  const heals = list.filter((s) => s.type === 'heal');
  assert.ok(heals.filter((s) => s.power > 0 && s.target === 'ally').length >= 2, 'single-target heals');
  assert.ok(heals.some((s) => s.target === 'allies'), 'a party heal');
  assert.ok(heals.some((s) => effectsOf(s, 'revive').length), 'a revive');
  assert.ok(heals[0].unlock === 1 && heals.at(-1).unlock >= 60, 'the healing line spans the game');
  assert.ok(list.some((s) => effectsOf(s, 'stress').some((e) => e.amount < 0)), 'stress relief');
  assert.ok(list.filter((s) => s.effects.some((e) => e.target === 'self' && (e.kind === 'bind' || (e.kind === 'mod' && e.mult < 1) || (e.kind === 'stress' && e.amount > 0)))).length >= 4, 'self-inflicted costs');
  for (const s of list.filter((x) => x.type === 'magical')) assert.ok(s.tags.includes('ranged'), `${s.id}: spells are ranged`);
});

test('rogue: binds on every part, crits, stress and speed, and no way to heal', () => {
  const list = of('rogue');
  for (const part of BIND_PARTS) {
    assert.ok(list.some((s) => effectsOf(s, 'bind').some((e) => e.part === part && e.target !== 'self')), `rogue needs a ${part} bind`);
  }
  assert.ok(list.filter((s) => s.crit >= 10).length >= 4, 'crit skills');
  assert.ok(list.some((s) => effectsOf(s, 'status').some((e) => e.id === 'marked')), 'a mark');
  assert.ok(list.filter((s) => effectsOf(s, 'stress').some((e) => e.amount > 0 && aimsAtEnemy(s, e))).length >= 3, 'stress attacks');
  assert.ok(list.some((s) => effectsOf(s, 'mod').some((e) => e.stat === 'AGI' && e.mult > 1)), 'a Finesse buff');
  assert.ok(list.some((s) => effectsOf(s, 'status').some((e) => e.id === 'hidden')), 'a way out');
  assert.ok(list.every((s) => s.type !== 'heal' && effectsOf(s, 'heal').length === 0), 'no backup plan: the rogue cannot heal');
  assert.ok(list.filter((s) => s.effects.some((e) => e.kind === 'status' && ['exposed', 'sitting_out', 'taunt'].includes(e.id) && (e.target === 'self' || s.target === 'self'))).length >= 4, 'the rogue pays by standing in the open');
});

test('stress works three ways: on enemies, off allies, and as a price the user pays', () => {
  const all = skills.flatMap((s) => effectsOf(s, 'stress').map((e) => ({ s, e })));
  assert.ok(all.filter(({ s, e }) => e.amount > 0 && aimsAtEnemy(s, e)).length >= 6, 'inflicted on enemies');
  assert.ok(all.filter(({ e }) => e.amount < 0).length >= 2, 'relieved');
  assert.ok(all.filter(({ s, e }) => e.amount > 0 && !aimsAtEnemy(s, e)).length >= 6, 'paid by the user');
  for (const a of CLASSES) assert.ok(of(a).some((s) => effectsOf(s, 'stress').length > 0), `${a} touches the stress bar`);
  // Stress aimed at enemies stays at or under a severe hit for its stage (5 / 12 / 24 landed on trained Willpower).
  for (const { s, e } of all.filter(({ s: sk, e: ef }) => ef.amount > 0 && aimsAtEnemy(sk, ef))) {
    const severe = 24 * (1 + benchmarkStat(s.unlock) / 600);
    assert.ok(e.amount >= 5 && e.amount <= severe, `${s.id}: base stress ${e.amount} at level ${s.unlock}`);
  }
});

// ------------------------------------------------------------------------------------------ exact rules text

const STATUS_WORDS = {
  provoked: /Provoked/, covered: /hit you instead/, taunt: /Taunt/, guard: /Guard/, guard_broken: /loses? Guard/, counter: /stance/,
  bulwark: /Bulwark/, fortified: /Fortified/, marked: /Marked/, hidden: /Hidden/, exposed: /Exposed/, focused: /Focused/,
  sitting_out: /sit out/, all_nighter: /cost no MP/,
};

test('skill text states the numbers its data carries', () => {
  for (const s of skills) {
    const where = `skill ${s.id}`;
    const has = (needle) => assert.ok(s.text.includes(needle), `${where}: text should say "${needle}"`);
    if (s.acc !== 0) has(`${s.acc > 0 ? '+' : '−'}${Math.abs(s.acc)} to hit`);
    if (s.crit !== 0) has(`+${s.crit} to crit`);
    if (isUltimate(s) && s.power > 0) has(`Power ${s.power}`);
    for (const e of s.effects) {
      if (e.kind === 'bind' && e.target !== 'self') has(`${e.chance}% base chance`);
      if (e.kind === 'stress') has(`${Math.abs(e.amount)} stress`);
      if (e.kind === 'mod') has(`×${e.mult}`);
      if (e.kind === 'limit') has(`${e.amount} Limit`);
      if (e.kind === 'revive') has(`${e.pct}%`);
      if (e.kind === 'dot') has(`Power ${e.power}`);
      if (e.kind === 'status') {
        assert.ok(STATUS_WORDS[e.id], `${where}: no wording rule for status "${e.id}"`);
        assert.match(s.text, STATUS_WORDS[e.id], `${where}: text should name the "${e.id}" status`);
      }
      if ((e.kind === 'bind' || e.kind === 'mod' || e.kind === 'status' || e.kind === 'dot') && e.turns > 1) has(`${e.turns} turns`);
    }
    if (isDamaging(s) && s.stat !== 'STR' && s.type === 'physical') {
      has(`from your ${{ AGI: 'Finesse', LCK: 'Luck' }[s.stat]}`);
    }
  }
});

// ------------------------------------------------------------------------------------------ passives

test('every passive has a rule, a choice and a sensible place in the progression', () => {
  for (const p of passives) {
    const where = `passive ${p.id}`;
    assert.ok(typeof p.name === 'string' && p.name.length > 0, `${where}: name`);
    assert.ok(typeof p.text === 'string' && /[.!?"]$/.test(p.text) && p.text.length >= 30, `${where}: text`);
    assert.ok(typeof p.choice === 'string' && /[.!?"]$/.test(p.choice) && p.choice.length >= 30, `${where}: every passive carries a choice line`);
    assert.notEqual(p.choice, p.text, `${where}: the choice is not the rule repeated`);
    assert.ok(Number.isInteger(p.unlock) && p.unlock >= 1 && p.unlock <= 100, `${where}: unlock`);
    assert.ok(typeof p.trigger === 'string' && ID_RE.test(p.trigger), `${where}: trigger`);
    assert.ok(Array.isArray(p.effects), `${where}: effects`);
    for (const e of p.effects) {
      assert.ok(EFFECT_KINDS.includes(e.kind), `${where}: effect kind "${e.kind}"`);
      if (e.kind === 'status') assert.ok(statusIds.has(e.id), `${where}: status "${e.id}" is not registered`);
      if (e.kind === 'stress') assert.ok(STRESS_SOURCES.includes(e.source), `${where}: stress source`);
      if (e.kind === 'mod') assert.ok(STAT_KEYS.includes(e.stat) && e.mult >= MOD_CLAMP.MIN && e.mult <= MOD_CLAMP.MAX, `${where}: mod`);
      if (e.kind === 'stress') assert.ok(p.text.includes(`${Math.abs(e.amount)} stress`), `${where}: text should state the stress amount`);
      if (e.kind === 'limit') assert.ok(p.text.includes(`${e.amount} Limit`), `${where}: text should state the Limit amount`);
    }
  }
});

test('about six passives per archetype and four general ones, spread from early to late', () => {
  for (const a of CLASSES) {
    const mine = passives.filter((p) => p.archetype === a).sort((x, y) => x.unlock - y.unlock);
    assert.ok(mine.length >= 5 && mine.length <= 7, `${a} has ${mine.length} passives`);
    assert.equal(mine[0].unlock, 1, `${a}'s first passive is there from level 1`);
    assert.ok(mine.at(-1).unlock >= 70, `${a}'s last passive arrives at level ${mine.at(-1).unlock}`);
    for (let i = 1; i < mine.length; i++) assert.ok(mine[i].unlock - mine[i - 1].unlock <= 25, `${a}: a long wait before ${mine[i].id}`);
    // The level 1 passive is the class's Limit engine.
    assert.ok(mine[0].effects.some((e) => e.kind === 'limit'), `${a}'s level 1 passive fills the Limit gauge`);
  }
  const general = passives.filter((p) => p.archetype === 'any');
  assert.ok(general.length >= 3 && general.length <= 5, `${general.length} general passives`);
  assert.ok(passivesData.slots?.general?.length >= 1, 'general passives are slotted');
});

// ------------------------------------------------------------------------------------------ items

test('every item is well-formed', () => {
  assert.ok(items.length >= 30 && items.length <= 45, `${items.length} items`);
  for (const i of items) {
    const where = `item ${i.id}`;
    assert.ok(typeof i.name === 'string' && i.name.length > 0, `${where}: name`);
    assert.ok(ITEM_CATEGORIES.includes(i.category), `${where}: category "${i.category}"`);
    assert.ok(typeof i.line === 'string' && ID_RE.test(i.line), `${where}: line`);
    assert.ok(Number.isInteger(i.level) && i.level >= 1 && i.level <= 100, `${where}: level`);
    assert.ok(Number.isInteger(i.price) && i.price > 0, `${where}: price must be a positive whole number`);
    assert.ok(['battle', 'field', 'any'].includes(i.use), `${where}: use`);
    assert.ok(typeof i.text === 'string' && /[.!?]$/.test(i.text) && i.text.length >= 20, `${where}: text`);
    assert.ok(!i.text.includes('\n'), `${where}: text is one line`);
    assert.ok(Array.isArray(i.effects), `${where}: effects`);
    for (const e of i.effects) {
      assert.ok(EFFECT_KINDS.includes(e.kind), `${where}: effect kind "${e.kind}"`);
      if (e.kind === 'status') assert.ok(statusIds.has(e.id), `${where}: status "${e.id}" is not registered`);
      if (e.kind === 'stress') assert.ok(STRESS_SOURCES.includes(e.source) && i.text.includes(`${Math.abs(e.amount)} stress`), `${where}: stress effect`);
      if (e.kind === 'mod') assert.ok(i.text.includes(`×${e.mult}`) && i.text.includes(`${e.turns} turns`), `${where}: text states the buff`);
      if (e.kind === 'heal' || e.kind === 'revive') assert.ok(i.text.includes(`${Math.abs(e.pct)}%`), `${where}: text states the share`);
    }
    if (i.use === 'battle') assert.ok(i.category !== 'seed', `${where}: seeds are eaten outside battle`);
    if (i.use === 'field') assert.match(i.text, /[Oo]ut(?:side)? (?:of )?battle/, `${where}: text must say it is for use outside battle`);
  }
  for (const category of ITEM_CATEGORIES) assert.ok(items.some((i) => i.category === category), `no item in category "${category}"`);
});

test('prices come from the Progression Analyst\'s helpers and never fall as level rises', () => {
  const FIGHTS = [0.25, 0.5, 0.75, 1, 1.5, 2];
  const SHARES_OF_LEVEL = [0.5, 1];
  for (const i of items) {
    const ok = FIGHTS.some((f) => i.price === tidy(priceForFights(i.level, f))) || SHARES_OF_LEVEL.some((s) => i.price === tidy(priceAt(i.level, s)));
    assert.ok(ok, `item ${i.id}: ${i.price} gold at level ${i.level} is not a tidy helper price`);
  }
  const groups = new Map();
  for (const i of items) for (const key of [`line:${i.line}`, `category:${i.category}`]) groups.set(key, [...(groups.get(key) ?? []), i]);
  for (const [key, list] of groups) {
    for (const a of list) for (const b of list) {
      if (a.level < b.level) assert.ok(a.price <= b.price, `${key}: ${a.id} (level ${a.level}, ${a.price}g) costs more than ${b.id} (level ${b.level}, ${b.price}g)`);
    }
  }
});

test('itm_packed_lunch exists: a cheap out-of-battle heal with a little stress relief', () => {
  const lunch = items.find((i) => i.id === 'itm_packed_lunch');
  assert.ok(lunch, 'events/packs/valerie-starter.events.json hands this item out');
  assert.equal(lunch.category, 'recovery');
  assert.equal(lunch.use, 'field');
  const heal = lunch.effects.find((e) => e.kind === 'heal');
  const relief = lunch.effects.find((e) => e.kind === 'stress');
  assert.ok(heal.pct >= 10 && heal.pct <= 30, 'a modest share of max HP');
  assert.ok(relief.amount < 0 && relief.amount >= -5, 'a little stress relief');
  assert.ok(lunch.price < priceForFights(lunch.level, PRICE_GUIDE.BASIC_RECOVERY_FIGHTS), 'cheaper than a basic recovery item');
  assert.ok(lunch.price <= 160 / 8, 'the 160 gold starting purse buys several');
});

test('a basic recovery item costs half a fight at its level, so a party can afford one every fight or two', () => {
  const line = items.filter((i) => i.line === 'pick_me_up').sort((a, b) => a.level - b.level);
  assert.ok(line.length >= 4, 'recovery comes in tiers across the level range');
  assert.equal(line[0].level, 1);
  assert.ok(line.at(-1).level >= 70);
  for (const i of line) {
    assert.equal(i.price, tidy(priceForFights(i.level, PRICE_GUIDE.BASIC_RECOVERY_FIGHTS)), `${i.id}: price`);
    assert.equal(i.price, 20 * i.level, `${i.id}: the analyst's 20 × level`);
    assert.ok(i.price <= fightGold(i.level) && i.price >= fightGold(i.level) / 4, `${i.id}: between a quarter of a fight and one fight`);
  }
  assert.ok(line[0].price * 4 <= 160, 'the starting purse buys a few');
});

test('recovery and MP items restore a share of the bar, with a ceiling that covers their own tier and then goes stale', () => {
  for (const [lineId, bar] of [['pick_me_up', (a, l) => maxHp(l, statAt(archetypes[a], 'CON', l))], ['coffee', (a, l) => maxMp(l, statAt(archetypes[a], 'WIL', l))]]) {
    const line = items.filter((i) => i.line === lineId).sort((a, b) => a.level - b.level);
    assert.ok(line.length >= 3, `${lineId}: tiers`);
    line.forEach((i, index) => {
      const e = i.effects.find((x) => x.kind === 'heal');
      assert.ok(e.pct >= 20 && e.pct <= 50, `${i.id}: restores a share, not a flat number`);
      assert.ok(Number.isInteger(e.cap) && i.text.includes(e.cap.toLocaleString('en-US')), `${i.id}: text states the ceiling`);
      // At the level it is sold for, nobody hits the ceiling.
      for (const a of CLASSES) assert.ok(e.cap >= (e.pct / 100) * bar(a, i.level), `${i.id}: ceiling ${e.cap} cuts into a level ${i.level} ${a}`);
      const next = line[index + 1];
      if (next) {
        const nextCap = next.effects.find((x) => x.kind === 'heal').cap;
        assert.ok(e.cap < nextCap, `${lineId}: ceilings rise tier by tier`);
        // By the time the tier after next is on sale, the biggest bar has outgrown this one.
        const later = line[index + 2]?.level ?? 100;
        const biggest = Math.max(...CLASSES.map((a) => bar(a, later)));
        assert.ok(e.cap < (e.pct / 100) * biggest, `${i.id}: never goes stale`);
      }
    });
  }
});

test('thrown elementals: every element in two or more tiers, with a damage model that scales with the thrower', () => {
  for (const el of NON_PHYSICAL) {
    const line = items.filter((i) => i.line === `thrown_${el}`).sort((a, b) => a.level - b.level);
    assert.ok(line.length >= 2 && line.length <= 3, `${el}: ${line.length} thrown tiers`);
    for (let n = 0; n < line.length; n++) {
      const i = line[n];
      assert.equal(i.category, 'elemental');
      assert.equal(i.element, el);
      assert.equal(i.stat, 'benchmark');
      assert.ok(i.power >= 3 && i.power <= 8, `${i.id}: power ${i.power}`);
      assert.ok(i.levelCap >= i.level && i.levelCap <= 100, `${i.id}: levelCap`);
      assert.ok(i.text.includes(`Power ${i.power} ${el} damage`) && i.text.includes("thrower's Level") && i.text.includes('benchmark attribute'), `${i.id}: text states the model`);
      if (i.levelCap < 100) assert.ok(i.text.includes(`${i.levelCap} at most`), `${i.id}: text states the level ceiling`);
      if (n > 0) assert.ok(i.power > line[n - 1].power && i.levelCap > line[n - 1].levelCap, `${el}: each tier throws harder and scales further`);
      // The model, run through the engine: Power × 5% of an even peer's bar at the thrower's level.
      const thrower = peer(Math.min(i.level, i.levelCap));
      const dealt = damage(thrower, peer(thrower.level), { type: 'magical', stat: 'INT', power: i.power, element: el });
      assert.equal(dealt, Math.floor(i.power * 0.05 * hpBudget(thrower.level)), `${i.id}: engine damage`);
    }
    assert.equal(line.at(-1).levelCap, 100, `${el}: the top tier scales all the way`);
    const ward = items.find((i) => i.line === `ward_${el}`);
    assert.ok(ward, `no ward for ${el}`);
    const status = ward.effects.find((e) => e.kind === 'status');
    assert.equal(status.id, `ward_${el}`);
    assert.ok(status.turns >= 2 && status.turns <= 4 && ward.text.includes(`${status.turns} turns`), `${ward.id}: a few turns of resistance`);
  }
});

test('stat-buffers cover all six attributes at ×1.2 to ×1.3, and attack buffs cost more than defense buffs', () => {
  const buffs = items.filter((i) => i.category === 'buff');
  for (const key of STAT_KEYS) {
    const mine = buffs.filter((i) => i.effects.some((e) => e.kind === 'mod' && e.stat === key));
    assert.equal(mine.length, 1, `one buff item for ${key}`);
    const e = mine[0].effects[0];
    assert.ok(e.mult >= 1.2 && e.mult <= 1.3 && e.turns >= 2 && e.turns <= 5, `${mine[0].id}: ×${e.mult} for ${e.turns} turns`);
  }
  const price = (key) => buffs.find((i) => i.effects[0].stat === key).price;
  assert.ok(price('STR') > price('CON') && price('INT') > price('WIL'), 'attack moves damage far more than defense does');
});

test('seeds: one per attribute, a few permanent points, expensive, and inside the 200-point headroom', () => {
  const seeds = items.filter((i) => i.category === 'seed');
  for (const key of STAT_KEYS) {
    const mine = seeds.filter((i) => i.grants?.stat === key);
    assert.equal(mine.length, 1, `one seed for ${key}`);
    const seed = mine[0];
    assert.ok(seed.grants.add >= 3 && seed.grants.add <= 10, `${seed.id}: +${seed.grants.add}`);
    assert.ok(seed.grants.add * seed.grants.maxPerCharacter <= GROWTH.GEAR_HEADROOM / 2, `${seed.id}: seeds alone cannot fill the headroom`);
    assert.ok(seed.text.includes(`+${seed.grants.add}`) && seed.text.includes(String(GROWTH.GEAR_HEADROOM)) && seed.text.includes('Permanent'), `${seed.id}: text`);
    assert.ok(seed.price >= 8 * fightGold(seed.level), `${seed.id}: ${seed.price} gold is not expensive at level ${seed.level}`);
    assert.equal(seed.use, 'field');
  }
});

test('stress items are small and each has a catch; binds can be cured; the fallen can be revived', () => {
  const calmers = items.filter((i) => i.category === 'stress');
  assert.ok(calmers.length >= 2);
  for (const i of calmers) {
    const relief = i.effects.find((e) => e.kind === 'stress');
    assert.ok(relief.amount < 0 && relief.amount >= -25, `${i.id}: relief ${relief.amount}`);
    assert.ok(i.effects.length >= 2, `${i.id}: needs a catch as well as the relief`);
  }
  assert.ok(items.some((i) => i.category === 'cure' && i.effects.some((e) => e.kind === 'cleanse' && e.what === 'binds')), 'a cure for binds');
  const revives = items.filter((i) => i.category === 'revive');
  assert.ok(revives.length >= 1 && revives.every((i) => i.effects.some((e) => e.kind === 'revive')), 'a revive');
  const camp = items.find((i) => i.id === 'itm_camp_kit');
  assert.ok(camp && camp.price === priceForFights(camp.level, camp.priceFights), 'engine/stress.js SERVICES.camp spends a camp kit priced in fights');
});

// ------------------------------------------------------------------------------------------ gear

test('ten gear tiers supply exactly the 200 points between the 800 signature cap and 1000', () => {
  assert.equal(gearTiers.length, 10);
  gearTiers.forEach((g, index) => {
    assert.equal(g.tier, index + 1);
    assert.equal(g.minLevel, index * 10 + 1, `tier ${g.tier}: brackets are contiguous`);
    assert.equal(g.maxLevel, (index + 1) * 10);
    assert.ok(typeof g.name === 'string' && g.name.length > 0);
    assert.equal(g.price, tidy(priceAt(g.minLevel, 1)), `tier ${g.tier}: a weapon costs one level of gold`);
    assert.equal(g.setPrice, tidy(priceAt(g.minLevel, 2)), `tier ${g.tier}: set price`);
    assert.ok(Number.isInteger(g.bonus) && g.bonus > 0);
    if (index > 0) {
      assert.ok(g.price > gearTiers[index - 1].price, `tier ${g.tier}: price rises`);
      assert.ok(g.bonus > gearTiers[index - 1].bonus, `tier ${g.tier}: bonus rises`);
    }
    // A set is worth roughly a quarter of the signature attribute while it is current: never a second character.
    for (const a of CLASSES) {
      const signature = statAt(archetypes[a], archetypes[a].signature, g.maxLevel);
      assert.ok(g.bonus <= signature * 0.3, `tier ${g.tier}: +${g.bonus} is more than 30% of a level ${g.maxLevel} ${a}'s signature ${signature}`);
    }
  });
  assert.equal(gearTiers.at(-1).bonus, GROWTH.GEAR_HEADROOM);
  assert.equal(GROWTH.SIGNATURE_L100 + gearTiers.at(-1).bonus, SCALE.STAT_MAX);
  assert.equal(gearTiers[0].price, 160, 'the starting purse buys exactly one first weapon');
  assert.ok(typeof itemsData.gearNote === 'string' && itemsData.gearNote.includes(String(GROWTH.GEAR_HEADROOM)));
});
