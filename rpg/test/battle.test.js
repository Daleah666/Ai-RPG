// The battle runner and its narrator: the turn loop on the real data, and fixed-roll scenes for each rule it joins up.
// Owner: Battle Engineer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRng } from '../engine/rng.js';
import { loadAllData } from '../engine/data-node.js';
import { BASIC_ATTACK } from '../engine/combat.js';
import { maxHp } from '../engine/progression.js';
import { airheadOf } from '../engine/valerie.js';
import {
  createBattle, currentActor, legalActions, act, runBattle, defaultPolicy, summarize,
  makeHero, referenceParty, supportReport, skillSupport, STATUS_HOOKS,
} from '../engine/battle.js';
import { narrate, lineFor, formatLog, voiceKey, NARRATED_TYPES } from '../engine/narrate.js';

// ---------------------------------------------------------------- helpers

function deepFreeze(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}

// The tables are frozen for the whole file: a runner that wrote to them would throw.
const data = deepFreeze(loadAllData());
const ENCOUNTERS = data.encounters.encounters.map((e) => e.id);
const BOSSES = data.bosses.bosses;
const klutz = data.valerie.archetype;

/** An exact replay of d100 results, then a steady 50 for anything else (initiative, variance, a target pick). */
function rolls(list = [], rest = 50) {
  let i = 0;
  return () => ((i < list.length ? list[i++] : rest) - 0.5) / 100;
}

const stats = (v, extra = {}) => ({ STR: v, INT: v, AGI: v, CON: v, WIL: v, LCK: v, ...extra });
const hero = (id, extra = {}) => ({ id, name: id[0].toUpperCase() + id.slice(1), level: 20, archetype: id, stats: stats(120, { AGI: 300 }), skills: [], ...extra });
const valerieAt = (level, airhead, extra = {}) => makeHero(klutz, level, { id: 'valerie', name: 'Valerie', ...extra, flags: { airhead, ...(extra.flags ?? {}) } });
const move = (id, extra = {}) => ({ id, name: id, type: 'physical', stat: 'STR', power: 2, acc: 0, crit: 0, element: 'phys', target: 'one', part: 'arms', tags: ['melee'], effects: [], text: 'A test move.', ...extra });
const foe = (id, moves, extra = {}) => ({ id, name: extra.name ?? id, level: 20, rank: 'elite', stats: stats(120, { AGI: 30 }), moves, ...extra });
const idle = move('x_wait', { type: 'buff', power: 0, target: 'self', part: 'none', tags: [], auto: true });
const of = (events, type, pred = () => true) => events.filter((e) => e.type === type && pred(e));
const edit = (state, fn) => { const copy = structuredClone(state); fn(copy); return copy; };
const C = (state, id) => state.combatants[id];

function assertSane(state, events, where) {
  for (const id of [...state.heroes, ...state.enemies]) {
    const c = C(state, id);
    for (const [key, lo, hi] of [['hp', 0, c.maxHp], ['mp', 0, c.maxMp], ['stress', 0, 200], ['limit', 0, 100]]) {
      assert.ok(Number.isInteger(c[key]) && c[key] >= lo && c[key] <= hi, `${where}: ${id}.${key} is ${c[key]} (allowed ${lo}..${hi})`);
    }
    for (const part of ['head', 'arms', 'legs']) assert.ok(Number.isInteger(c.binds[part]) && c.binds[part] >= 0 && c.binds[part] <= 5, `${where}: ${id} ${part} bind ${c.binds[part]}`);
    for (const m of c.mods) assert.ok(Number.isFinite(m.mult) && m.mult > 0, `${where}: ${id} has a broken mod`);
    if (id === 'valerie') assert.ok(airheadOf(c) >= 0 && airheadOf(c) <= 100, `${where}: airhead ${airheadOf(c)}`);
  }
  for (const e of events) {
    assert.ok(typeof e.line === 'string' && e.line.trim().length > 0, `${where}: ${e.type} has no line`);
    assert.ok(typeof e.text === 'string' && e.text.trim().length >= 12, `${where}: ${e.type} has no text`);
    assert.ok(e.line.startsWith('['), `${where}: the line of ${e.type} must open with its mechanics: ${e.line}`);
    assert.ok(!/undefined|NaN|\[object|null/.test(e.line + e.text), `${where}: ${e.type} reads badly: ${e.line} / ${e.text}`);
    assert.ok(NARRATED_TYPES.includes(e.type), `${where}: the narrator has no prose for "${e.type}"`);
    // One to three sentences. A quotation counts as part of its sentence, and one move is called "Shhh."
    const sentences = (e.text.replace(/"[^"]*"/g, 'Q').replace(/Shhh\./g, 'Shhh').match(/[.!?](\s|$)/g) ?? []).length;
    assert.ok(sentences >= 1 && sentences <= 3, `${where}: ${e.type} runs to ${sentences} sentences: ${e.text}`);
  }
}

/** Play a battle with the default policy, freezing every state before it is handed back to the runner. */
function playFrozen(setup, seed, maxRounds = 30) {
  const rng = makeRng(seed);
  let state = deepFreeze(createBattle(setup, rng));
  const events = [...state.opening];
  assertSane(state, state.opening, `${setup.encounter ?? setup.boss} seed ${seed} opening`);
  while (!state.over && state.round <= maxRounds) {
    const actor = currentActor(state);
    assert.equal(C(state, actor).side, 'heroes', 'a waiting state always waits on a hero');
    const step = act(state, defaultPolicy(state, actor), rng);
    state = deepFreeze(step.state);
    assertSane(state, step.events, `${setup.encounter ?? setup.boss} seed ${seed} round ${state.round}`);
    events.push(...step.events);
  }
  return { state, events };
}

// ---------------------------------------------------------------- the loop on the real data

test('the same setup, policy and seed give the same events; another seed gives another fight', () => {
  const setup = () => ({ party: referenceParty(20, data), encounter: 'bandit_archers', data });
  const a = runBattle(setup(), { rng: makeRng(2026) });
  const b = runBattle(setup(), { rng: makeRng(2026) });
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.summary, b.summary);
  assert.equal(formatLog(a.events), formatLog(b.events));
  const c = runBattle(setup(), { rng: makeRng(2027) });
  assert.notDeepEqual(a.events.map((e) => e.line), c.events.map((e) => e.line));
  // The seed in the setup works too, with no rng handed in.
  assert.deepEqual(runBattle({ ...setup(), seed: 5 }).events, runBattle({ ...setup(), seed: 5 }).events);
});

test('invariants hold through many seeded battles, and no state handed to the runner is ever mutated', () => {
  let battles = 0;
  let beats = 0;
  for (const encounter of ENCOUNTERS) for (const seed of [11, 12, 13, 14]) {
    const { state, events } = playFrozen({ party: referenceParty(10 + seed, data), encounter, data }, seed);
    assert.ok(state.over, `${encounter} seed ${seed} did not finish`);
    battles += 1;
    beats += events.length;
  }
  for (const boss of BOSSES) for (const seed of [21, 22]) {
    const { events } = playFrozen({ party: referenceParty(boss.level, data), boss: boss.id, data }, seed, 25);
    battles += 1;
    beats += events.length;
  }
  assert.equal(battles, ENCOUNTERS.length * 4 + BOSSES.length * 2);
  assert.ok(beats > 2000, `only ${beats} events were checked`);
});

test('all five encounters run to a result at party levels 5, 20 and 50', () => {
  for (const encounter of ENCOUNTERS) for (const level of [5, 20, 50]) {
    const { state, summary, events } = runBattle({ party: referenceParty(level, data), encounter, data }, { rng: makeRng(level * 7 + encounter.length) });
    assert.ok(state.over, `${encounter} at level ${level} did not finish in ${summary.rounds} rounds`);
    assert.ok(['win', 'loss'].includes(summary.result), `${encounter} L${level}: ${summary.result}`);
    assert.equal(events.at(-1).type, 'end');
    assert.equal(events[0].type, 'start');
    assert.equal(currentActor(state), null);
    assert.deepEqual(legalActions(state), []);
    // Enemies are built from the encounter's factors at the party's level, with HP from maxHp(level, CON, rank).
    for (const id of state.enemies) {
      const c = C(state, id);
      assert.equal(c.level, level);
      assert.equal(c.maxHp, maxHp(level, c.stats.CON, c.rank));
      assert.equal(c.side, 'enemies');
    }
    if (summary.result === 'win') assert.ok(summary.rewards.exp > 0 && summary.rewards.gold > 0);
  }
});

test('all three bosses run to a result or to maxRounds at their own levels', () => {
  for (const boss of BOSSES) {
    const { state, summary, events } = runBattle({ party: referenceParty(boss.level, data), boss: boss.id, data }, { rng: makeRng(boss.level), maxRounds: 40 });
    assert.ok(['win', 'loss', 'timeout'].includes(summary.result), `${boss.id}: ${summary.result}`);
    assert.ok(state.over || state.round > 40);
    const b = C(state, boss.id);
    assert.equal(b.maxHp, boss.hp, `${boss.id}: HP is maxHp(level, CON, rank)`);
    assert.equal(b.actions, boss.actions);
    // Several actions a round: no round holds more boss actions than the boss has.
    const byRound = new Map();
    for (const e of events) {
      if (e.actor !== boss.id || !['skill', 'telegraph'].includes(e.type) && !(e.type === 'attack' && !e.counter)) continue;
      const key = `${e.round}:${e.type === 'attack' ? e.skill : e.seq}`;
      if (!byRound.has(e.round)) byRound.set(e.round, new Set());
      byRound.get(e.round).add(key);
    }
    for (const [round, moves] of byRound) assert.ok(moves.size <= boss.actions, `${boss.id} took ${moves.size} actions in round ${round}`);
    assert.ok(byRound.size >= 3, `${boss.id} hardly acted`);
  }
});

test('legalActions never offers an action act rejects, and act rejects what it marks disabled', () => {
  const setups = [
    { party: referenceParty(50, data), encounter: 'skeleton_phalanx', data },
    { party: referenceParty(12, data), boss: 'boss_bolgrim', data },
    { party: referenceParty(100, data), boss: 'boss_parity', data },
  ];
  let tried = 0;
  let refused = 0;
  for (const [n, setup] of setups.entries()) {
    const rng = makeRng(300 + n);
    let state = deepFreeze(createBattle(setup, rng));
    for (let step = 0; step < 14 && !state.over; step++) {
      const actor = currentActor(state);
      const actions = legalActions(state, actor);
      assert.ok(actions.some((a) => !a.disabled), `${actor} has nothing to do`);
      for (const a of actions) {
        assert.ok(typeof a.label === 'string' && a.label.length > 0 && Array.isArray(a.targets));
        const picks = a.choose ? a.targets.slice(0, 3) : [undefined];
        if (a.disabled) {
          assert.ok(typeof a.why === 'string' && a.why.length > 3, `${a.label} is disabled with no reason`);
          assert.throws(() => act(state, { kind: a.kind, skillId: a.skillId, stance: a.stance, target: a.targets[0] }, makeRng(1)), /not available|not a legal action/);
          refused += 1;
          continue;
        }
        for (const target of picks) {
          assert.doesNotThrow(() => act(state, { kind: a.kind, skillId: a.skillId, stance: a.stance, target }, makeRng(step)), `${actor}: ${a.label} at ${target}`);
          tried += 1;
        }
      }
      state = deepFreeze(act(state, defaultPolicy(state, actor, actions), rng).state);
    }
  }
  assert.ok(tried > 200 && refused > 10, `tried ${tried}, refused ${refused}`);
  const state = createBattle(setups[0], makeRng(1));
  assert.throws(() => act(state, { kind: 'dance' }, makeRng(1)), /not a legal action/);
  assert.throws(() => act(state, { kind: 'attack', target: 'nobody' }, makeRng(1)), /not a legal action|cannot be aimed/);
  assert.throws(() => act(state, { kind: 'guard' }), /needs an rng/);
});

// ---------------------------------------------------------------- the hero

const arrow = move('x_loose', { name: 'Loose', power: 2.2, tags: ['ranged', 'projectile'] });
const archer = (extra = {}) => foe('archer', [arrow], { name: 'Bandit Archer', rank: 'standard', stats: stats(120, { AGI: 400, LCK: 60 }), ...extra });

test('a projectile bounces off Valerie and damages the shooter', () => {
  // Initiative twice, then the archer (far quicker) shoots: d100 43, then the variance draw.
  const state = createBattle({ party: [valerieAt(20, 100)], enemies: [archer()], data }, rolls([50, 50, 43, 50]));
  const shot = of(state.opening, 'attack')[0];
  assert.equal(shot.outcome, 'bounce');
  assert.equal(shot.roll, 43);
  assert.equal(shot.hitPct, 55, 'Unintentional Dodge holds the ceiling at 55 on a full gauge');
  assert.ok(shot.reflected > 0 && shot.damage === 0);
  const v = C(state, 'valerie');
  const a = C(state, 'archer');
  assert.equal(v.hp, v.maxHp, 'she takes nothing');
  assert.equal(a.hp, a.maxHp - shot.reflected, 'the shooter takes its own shot');
  assert.equal(v.limit, 10, 'Main Character Energy for sending it back');
  assert.match(shot.line, /^\[d100 43 vs 55.*: bounce\] Bandit Archer → Valerie · Loose · the shot returns for [\d,]+/);
  assert.match(shot.text, /you|You/);
  assert.equal(currentActor(state), 'valerie');
});

test('an enemy that fumbles in her aura binds one of its own parts', () => {
  const state = createBattle({ party: [valerieAt(20, 100)], enemies: [archer()], data }, rolls([50, 50, 97]));
  const shot = of(state.opening, 'attack')[0];
  assert.equal(shot.outcome, 'fumble');
  assert.equal(shot.fumbleFrom, 86, 'Aura of Befuddlement: 96 - gauge / 10');
  assert.equal(shot.selfBind, 'arms', 'the part is read off the roll: 97 mod 3');
  assert.equal(C(state, 'archer').binds.arms, 1);
  assert.equal(C(state, 'valerie').limit, 5);
  // The band is the gauge's doing: a 90 fumbles against a Total Airhead and is an ordinary roll against a Lucid one.
  const wide = createBattle({ party: [valerieAt(20, 100)], enemies: [archer()], data }, rolls([50, 50, 90]));
  assert.equal(of(wide.opening, 'attack')[0].outcome, 'fumble');
  const lucid = createBattle({ party: [valerieAt(20, 0)], enemies: [archer()], data }, rolls([50, 50, 90, 50]));
  assert.equal(of(lucid.opening, 'attack')[0].fumbleFrom, 96);
  assert.notEqual(of(lucid.opening, 'attack')[0].outcome, 'fumble');
  assert.deepEqual(C(lucid, 'archer').binds, { head: 0, arms: 0, legs: 0 });
});

test('her dodge is told apart from an ordinary miss, and a deliberate Guard switches it off', () => {
  // d100 70: under the archer's real chance to hit, over her lowered ceiling of 55.
  const state = createBattle({ party: [valerieAt(20, 100)], enemies: [foe('brute', [move('x_club')], { stats: stats(120, { AGI: 400 }) })], data }, rolls([50, 50, 70]));
  const swing = of(state.opening, 'attack')[0];
  assert.equal(swing.outcome, 'miss');
  assert.equal(swing.dodged, true);
  assert.match(swing.line, /: dodge\]/);
  // She Guards; next round the same roll lands, for half.
  const guarded = act(state, { kind: 'guard' }, rolls([50, 50, 70, 50]));
  const hit = of(guarded.events, 'attack')[0];
  assert.equal(hit.outcome, 'hit');
  assert.ok(hit.hitPct > swing.hitPct && hit.hitPct > 70, 'guarding on purpose gives up the lowered ceiling');
  assert.equal(hit.guarded, true);
});

const lever = { name: 'the DO NOT PULL lever', uses: 'once', effects: [{ kind: 'damage', target: 'enemies', hpPct: 25 }, { kind: 'bind', target: 'enemies', part: 'legs', chance: 100, turns: 2 }] };

test('her fumble while winging it is a Chaos Wave, and it sets the contraption off once', () => {
  const setup = { party: [valerieAt(20, 60)], enemies: [foe('dummy', [idle]), foe('dummy2', [idle])], contraption: lever, data };
  const start = createBattle(setup, rolls());
  assert.equal(currentActor(start), 'valerie');
  const wing = { kind: 'attack', stance: 'wing', target: 'dummy' };
  const first = act(start, wing, rolls([99]));
  const swing = of(first.events, 'attack')[0];
  assert.equal(swing.outcome, 'fumble');
  assert.equal(swing.fumbleFrom, 84, 'her own fumble band widens with the gauge: 96 - 60 / 5');
  assert.equal(swing.wave, true);
  assert.equal(of(first.events, 'chaos_wave').length, 1);
  assert.equal(of(first.events, 'contraption').length, 1);
  assert.equal(of(first.events, 'stress', (e) => e.reason === 'fumble').length, 0, 'a wave is not an embarrassing fumble');
  for (const id of ['dummy', 'dummy2']) {
    const d = C(first.state, id);
    assert.equal(d.hp, d.maxHp - Math.round(d.maxHp * 0.25), 'the contraption takes a quarter of each enemy');
    assert.ok(d.binds.legs >= 1, 'and binds their legs with no contest');
    assert.ok(d.mods.some((m) => m.stat === 'AGI' && m.mult === 0.75), 'the wave leaves every enemy Off-Balance');
  }
  const v = C(first.state, 'valerie');
  assert.equal(v.limit, 15);
  assert.equal(airheadOf(v), 70, 'Wing It still moves the gauge');
  assert.equal(first.state.contraption.used, true);
  // A second wave: the lever is spent.
  const second = act(first.state, wing, rolls([99]));
  assert.equal(of(second.events, 'chaos_wave').length, 1);
  assert.equal(of(second.events, 'contraption').length, 0);
  assert.equal(C(second.state, 'valerie').limit, 30);
  // The same roll while thinking is only a miss.
  const think = act(start, { kind: 'attack', stance: 'think', target: 'dummy' }, rolls([99]));
  assert.equal(of(think.events, 'chaos_wave').length, 0);
  assert.equal(of(think.events, 'attack')[0].outcome, 'fumble');
  // A natural 100 also hits every enemy.
  const jackpot = act(start, wing, rolls([100]));
  assert.equal(of(jackpot.events, 'chaos_wave')[0].jackpot, true);
  assert.equal(of(jackpot.events, 'damage', (e) => e.source === 'jackpot').length, 2);
});

test('her stances: winging it lifts the gauge and sheds stress, thinking drops it and costs 4 that Willpower cannot touch', () => {
  const setup = { party: [valerieAt(20, 60, { stress: 10 })], enemies: [foe('dummy', [idle])], data };
  const start = createBattle(setup, rolls());
  const wing = act(start, { kind: 'attack', stance: 'wing', target: 'dummy' }, rolls([20, 50]));
  assert.equal(airheadOf(C(wing.state, 'valerie')), 70);
  assert.equal(C(wing.state, 'valerie').stress, 8);
  const think = act(start, { kind: 'attack', stance: 'think', target: 'dummy' }, rolls([20, 50]));
  assert.equal(airheadOf(C(think.state, 'valerie')), 45);
  assert.equal(C(think.state, 'valerie').stress, 14);
  const stance = of(think.events, 'stance')[0];
  assert.deepEqual([stance.gaugeBefore, stance.gaugeAfter, stance.stressBefore, stance.stressAfter], [60, 45, 10, 14]);
  assert.ok(of(think.events, 'attack')[0].hitPct > of(wing.events, 'attack')[0].hitPct, 'thinking is +15 to hit');
  // Without a stance she cannot attack at all: the choice is the game.
  assert.throws(() => act(start, { kind: 'attack', target: 'dummy' }, rolls()), /not a legal action/);
});

test('fear slides off her and steadies the party; the truth lands in full and drops the gauge', () => {
  const dread = move('x_dread', { type: 'stress', power: 0, target: 'all', part: 'head', tags: ['horror'], auto: true, effects: [{ kind: 'stress', amount: 10, source: 'horror' }] });
  const truth = move('x_truth', { type: 'stress', power: 0, target: 'all', part: 'head', tags: ['realization'], auto: true, effects: [{ kind: 'stress', amount: 12, source: 'realization', target: 'valerie' }, { kind: 'stress', amount: 5, source: 'mental', target: 'others' }] });
  const party = () => [valerieAt(20, 80, { stats: { ...makeHero(klutz, 20).stats, AGI: 900 } }), hero('warrior', { stress: 20 })];
  const scared = act(createBattle({ party: party(), enemies: [foe('ghost', [dread])], data }, rolls()), { kind: 'guard' }, rolls());
  const after = act(scared.state, { kind: 'guard' }, rolls());
  const hers = of(after.events, 'stress', (e) => e.targetYou)[0];
  assert.equal(hers.targets[0].taken, 0);
  assert.equal(hers.targets[0].noticed, false);
  assert.equal(hers.allyRelief, 3);
  assert.match(hers.line, /not noticed/);
  const his = of(after.events, 'stress', (e) => !e.targetYou)[0];
  assert.ok(his.targets[0].taken > 0);
  assert.equal(C(after.state, 'warrior').stress, 20 + his.targets[0].taken - 3, 'he takes the fear, then sheds 3 watching her');
  assert.equal(C(after.state, 'valerie').stress, 0);

  const told = act(act(createBattle({ party: party(), enemies: [foe('critic', [truth])], data }, rolls()), { kind: 'guard' }, rolls()).state, { kind: 'guard' }, rolls());
  const landed = of(told.events, 'stress', (e) => e.targetYou)[0];
  assert.equal(landed.targets[0].taken, 12, 'realization ignores her Willpower');
  assert.equal(landed.targets[0].gaugeAfter, 70);
  assert.equal(airheadOf(C(told.state, 'valerie')), 70);
  assert.notEqual(narrate(landed), narrate(hers), 'the truth and the fear she missed are told differently');
  const others = of(told.events, 'stress', (e) => !e.targetYou)[0];
  assert.deepEqual(others.targets.map((t) => t.id), ['warrior'], '"others" is every hero but her');
});

test('her ultimate pins the luck at 100 for three turns, keeps planned skills open, and resets the gauge to 50', () => {
  const v = valerieAt(40, 95, { limit: 100, stress: 30 });
  const setup = { party: [v, hero('mage', { level: 40, stress: 30, stats: stats(200, { AGI: 20 }) })], enemies: [foe('dummy', [idle], { level: 40, stats: stats(200, { AGI: 5 }) })], data };
  let state = createBattle(setup, rolls());
  const before = legalActions(state);
  assert.match(before.find((a) => a.skillId === 'val_called_shot').why, /sealed at Airhead 95/);
  const step = act(state, { kind: 'skill', skillId: 'val_good_hero', stance: 'wing' }, rolls());
  state = step.state;
  assert.equal(C(state, 'valerie').limit, 0, 'it spends the whole gauge');
  assert.equal(C(state, 'mage').stress, 20, 'allies shed 10');
  assert.equal(C(state, 'valerie').flags.goodHeroTurns > 0, true);
  // Planned skills stay available even as a Total Airhead.
  state = act(state, { kind: 'guard' }, rolls()).state;
  assert.equal(currentActor(state), 'valerie');
  const shot = legalActions(state).find((a) => a.skillId === 'val_called_shot' && a.stance === 'think');
  assert.equal(shot.disabled, undefined);
  assert.doesNotThrow(() => act(state, { kind: 'skill', skillId: 'val_called_shot', stance: 'think', target: 'dummy' }, rolls([20, 50])));
  // Three of her own turns later it ends and the gauge snaps to 50.
  let log = [];
  for (let i = 0; i < 6 && !of(log, 'airhead').length; i++) {
    const actor = currentActor(state);
    const next = act(state, actor === 'valerie' ? { kind: 'attack', stance: 'wing', target: 'dummy' } : { kind: 'guard' }, rolls([20, 50]));
    state = next.state;
    log = [...log, ...next.events];
  }
  assert.equal(of(log, 'airhead')[0].after, 50);
  assert.equal(airheadOf(C(state, 'valerie')), 50);
  assert.equal(C(state, 'valerie').flags.goodHeroTurns, 0);
});

// ---------------------------------------------------------------- stress

const bellow = (amount) => move('x_bellow', { name: 'Bellow', type: 'stress', power: 0, target: 'all', part: 'head', tags: ['horror'], auto: true, effects: [{ kind: 'stress', amount, source: 'horror' }], text: 'A roar that rattles teeth. Cannot miss.' });
const nervous = (warriorStress, options) => ({
  party: [hero('warrior', { stress: warriorStress, stats: stats(120, { AGI: 400 }) }), hero('mage', { stats: stats(120, { AGI: 200 }) })],
  enemies: [foe('ogre', [bellow(10)])],
  options,
  data,
});

test('stress takes a hero to a Resolve Check, and the party takes the result\'s stress', () => {
  let state = createBattle(nervous(95), rolls());
  state = act(state, { kind: 'guard' }, rolls()).state;
  // The mage acts, the ogre bellows, the warrior crosses 100: the next d100 is the Resolve Check.
  const step = act(state, { kind: 'guard' }, rolls([62]));
  const check = of(step.events, 'resolve')[0];
  assert.equal(check.roll, 62);
  assert.equal(check.kind, 'affliction');
  assert.equal(check.entryId, 'aff_tinfoil_helm');
  assert.equal(check.virtuePct, 25);
  const entry = data.afflictions.afflictions.find((a) => a.id === 'aff_tinfoil_helm');
  assert.equal(check.partyStress, entry.onStart.partyStress);
  const warrior = C(step.state, 'warrior');
  assert.equal(warrior.resolve.id, 'aff_tinfoil_helm');
  assert.ok(warrior.stress >= 100);
  assert.ok(warrior.mods.some((m) => m.source === 'aff_tinfoil_helm' && m.stat === 'WIL'), 'the Affliction\'s attribute change is on at once');
  // The party's share is flat: it does not go through Willpower.
  const fallout = of(step.events, 'stress', (e) => e.reason === 'resolve')[0];
  assert.equal(fallout.flat, true);
  assert.deepEqual(fallout.targets.map((t) => [t.id, t.taken]), [['mage', entry.onStart.partyStress]]);
  const fear = of(step.events, 'stress', (e) => e.source === 'horror')[0];
  const mageFear = fear.targets.find((t) => t.id === 'mage').taken;
  assert.equal(C(step.state, 'mage').stress, mageFear + entry.onStart.partyStress);
  // One d100 answered it: the same roll under 26 is a Virtue, and the party sheds stress instead.
  const good = act(state, { kind: 'guard' }, rolls([7]));
  assert.equal(of(good.events, 'resolve')[0].kind, 'virtue');
  assert.equal(of(good.events, 'relief', (e) => e.reason === 'virtue').length, 1);
  assert.ok(C(good.state, 'warrior').stress < 100, 'a Virtue sheds stress on the spot');
  // An afflicted hero makes the turn check at the start of each turn after that.
  const later = act(step.state, { kind: 'guard' }, rolls([50]));
  const turnCheck = [...step.events, ...later.events].filter((e) => e.type === 'act_out');
  assert.ok(turnCheck.length >= 1 && turnCheck[0].target === 'warrior');
});

test('a Breakdown at 200 is the caller\'s choice: Storm Off by default, or stay and make the party pay', () => {
  // Default: the warrior walks out, and the fight goes on without him.
  let state = createBattle(nervous(195), rolls());
  state = act(state, { kind: 'guard' }, rolls()).state;
  const stormed = act(state, { kind: 'guard' }, rolls());
  const out = of(stormed.events, 'breakdown')[0];
  assert.equal(out.choice, 'storm_off');
  assert.equal(C(stormed.state, 'warrior').flags.stormedOff, true);
  assert.equal(C(stormed.state, 'warrior').stress, 50);
  assert.equal(stormed.state.over, false);
  assert.ok(!stormed.state.order.includes('warrior') || currentActor(stormed.state) === 'mage');
  // Chosen on the action: Have It Out. He stays on 80 and the mage takes 20, flat.
  const stayed = act(state, { kind: 'guard', breakdown: 'have_it_out' }, rolls());
  assert.equal(of(stayed.events, 'breakdown')[0].choice, 'have_it_out');
  assert.equal(C(stayed.state, 'warrior').stress, 80);
  assert.equal(Boolean(C(stayed.state, 'warrior').flags.stormedOff), false);
  const bill = of(stayed.events, 'stress', (e) => e.reason === 'breakdown')[0];
  assert.deepEqual(bill.targets.map((t) => [t.id, t.taken]), [['mage', 20]]);
  // Chosen for the whole battle in the setup: Bottle It leaves a Scar.
  let bottled = createBattle(nervous(195, { breakdownChoice: { warrior: 'bottle_it' } }), rolls());
  bottled = act(bottled, { kind: 'guard' }, rolls()).state;
  const kept = act(bottled, { kind: 'guard' }, rolls());
  assert.equal(of(kept.events, 'breakdown')[0].choice, 'bottle_it');
  assert.equal(C(kept.state, 'warrior').flags.marks.length, 1);
  // When the last hero standing Storms Off, the battle is lost.
  let alone = createBattle({ ...nervous(195), party: [hero('warrior', { stress: 195 })] }, rolls());
  alone = act(alone, { kind: 'guard' }, rolls()).state;
  assert.equal(alone.over, true);
  assert.equal(alone.result, 'loss');
});

test('enemy stress: Rattled at 100, and a standard enemy is Routed at 200', () => {
  const heckle = { ...data.skills.skills.find((s) => s.id === 'rog_heckle') };
  const party = [hero('rogue', { skills: [heckle], mp: 500, maxMp: 500, stats: stats(200, { AGI: 400 }) })];
  const rattled = act(createBattle({ party, enemies: [foe('goblin', [idle], { rank: 'standard', stress: 95, stats: stats(20) })], data }, rolls()), { kind: 'skill', skillId: 'rog_heckle', target: 'goblin' }, rolls([10]));
  assert.equal(of(rattled.events, 'enemy_stress')[0].status, 'rattled');
  assert.equal(C(rattled.state, 'goblin').resolve.kind, 'rattled');
  const routed = act(createBattle({ party, enemies: [foe('goblin', [idle], { rank: 'standard', stress: 195, stats: stats(20) })], data }, rolls()), { kind: 'skill', skillId: 'rog_heckle', target: 'goblin' }, rolls([10]));
  assert.equal(of(routed.events, 'defeat')[0].routed, true);
  assert.equal(routed.state.result, 'win');
});

// ---------------------------------------------------------------- skills, binds and statuses

test('a sealed skill is not legal: bound parts, the gauge band, the price, and what the runner does not support', () => {
  const warrior = makeHero(data.archetypes.archetypes.find((a) => a.id === 'warrior'), 20, { binds: { arms: 2 } });
  const v = valerieAt(20, 90, { mp: 0 });
  const state = createBattle({ party: [warrior, v], enemies: [foe('dummy', [idle], { stats: stats(120, { AGI: 1 }) })], data }, rolls());
  const mine = legalActions(state, 'warrior');
  assert.equal(currentActor(state), 'warrior');
  const bash = mine.find((a) => a.skillId === 'war_shield_bash');
  assert.equal(bash.disabled, true);
  assert.match(bash.why, /sealed: arms bound/);
  assert.equal(mine.find((a) => a.kind === 'attack').disabled, undefined, 'the basic attack is never sealed');
  assert.equal(mine.find((a) => a.skillId === 'war_oi_over_here').disabled, undefined, 'a head skill is still open');
  assert.throws(() => act(state, { kind: 'skill', skillId: 'war_shield_bash', target: 'dummy' }, rolls()), /not available: sealed: arms bound/);
  const hers = legalActions(act(state, { kind: 'guard' }, rolls()).state);
  assert.match(hers.find((a) => a.skillId === 'val_called_shot').why, /sealed at Airhead 90/);
  assert.match(hers.find((a) => a.skillId === 'val_found_it').why, /not supported by the runner/);
  assert.match(hers.find((a) => a.skillId === 'val_big_swing' && a.stance === 'wing').why, /needs 1 MP/);
  assert.equal(hers.find((a) => a.skillId === 'val_look_closely' && a.stance === 'wing'), undefined, 'a Think skill is only offered in its stance');
  assert.deepEqual(hers.filter((a) => a.kind === 'attack').map((a) => a.stance), ['wing', 'think'], 'every attack appears once per stance');
  assert.equal(hers.some((a) => a.skillId === 'val_plot_armor'), false, 'a passive is not an action');
});

test('taunt redirects single-target attacks, and so does stepping in front of a friend', () => {
  const club = move('x_club', { name: 'Club' });
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const party = [valerieAt(20, 80, { stats: { ...makeHero(klutz, 20).stats, AGI: 900 } }), hero('mage'), hero('rogue')];
    let state = createBattle({ party, enemies: [foe('ogre', [club], { actions: 2, stats: stats(150, { AGI: 20 }) })], data }, makeRng(seed));
    const taunt = act(state, { kind: 'skill', skillId: 'val_stand_behind_me', stance: 'wing' }, makeRng(seed));
    state = taunt.state;
    const rng = makeRng(seed + 50);
    const events = [];
    while (!state.over && state.round === 1) {
      const next = act(state, { kind: 'guard' }, rng);
      events.push(...next.events);
      state = next.state;
    }
    const swings = of(events, 'attack', (e) => e.actor === 'ogre' && e.round === 1);
    assert.equal(swings.length, 2, 'two actions a round');
    for (const e of swings) {
      assert.equal(e.target, 'valerie', `seed ${seed}: the ogre must aim at the taunter`);
      assert.equal(e.redirect.why, 'taunt');
    }
  }
  // Not On My Watch: attacks aimed at the mage land on the warrior.
  const cover = data.skills.skills.find((s) => s.id === 'war_not_on_my_watch');
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const party = [hero('warrior', { skills: [cover], stats: stats(120, { AGI: 900 }) }), hero('mage')];
    let state = createBattle({ party, enemies: [foe('ogre', [club], { actions: 3, stats: stats(150, { AGI: 20 }) })], data }, makeRng(seed));
    state = act(state, { kind: 'skill', skillId: 'war_not_on_my_watch', target: 'mage' }, makeRng(seed)).state;
    const step = act(state, { kind: 'guard' }, makeRng(seed + 9));
    const swings = of(step.events, 'attack', (e) => e.actor === 'ogre');
    assert.equal(swings.length, 3);
    assert.ok(swings.every((e) => e.target === 'warrior'), `seed ${seed}: nothing reaches the mage`);
    assert.ok(swings.filter((e) => e.redirect?.why === 'covered').every((e) => e.redirect.from === 'mage'));
    assert.equal(C(step.state, 'mage').hp, C(step.state, 'mage').maxHp);
  }
});

test('one status registry: Guard halves a hit, Exposed adds a quarter, and durations run on the bearer\'s own turns', () => {
  const club = move('x_club', { name: 'Club' });
  const expose = move('x_expose', { type: 'debuff', power: 0, target: 'self', part: 'none', tags: [], effects: [{ kind: 'status', id: 'exposed', turns: 2 }] });
  const setup = () => ({ party: [hero('warrior', { skills: [expose], stats: stats(200, { AGI: 400 }) })], enemies: [foe('ogre', [club])], data });
  const hitFor = (action) => of(act(createBattle(setup(), rolls()), action, rolls([30, 50])).events, 'attack')[0];
  const plain = hitFor({ kind: 'breather' });
  const guarded = hitFor({ kind: 'guard' });
  const exposed = hitFor({ kind: 'skill', skillId: 'x_expose' });
  assert.equal(plain.outcome, 'hit');
  assert.equal(guarded.damage, Math.floor(plain.damage / 2));
  assert.equal(guarded.guarded, true);
  assert.ok(Math.abs(exposed.damage - plain.damage * 1.25) <= 1);
  // Exposed for 2 turns, put on during his own turn: it is still there after his next turn and gone after the one after.
  let state = act(createBattle(setup(), rolls()), { kind: 'skill', skillId: 'x_expose' }, rolls([99])).state;
  assert.equal(C(state, 'warrior').statuses.some((s) => s.id === 'exposed'), true);
  state = act(state, { kind: 'breather' }, rolls([99])).state;
  assert.equal(C(state, 'warrior').statuses.some((s) => s.id === 'exposed'), true);
  const last = act(state, { kind: 'breather' }, rolls([99]));
  assert.equal(C(last.state, 'warrior').statuses.some((s) => s.id === 'exposed'), false);
  assert.ok(of(last.events, 'expire').some((e) => e.what.includes('Exposed')));
  // A Guard raised on your own turn is gone by the start of your next one.
  const afterGuard = act(createBattle(setup(), rolls()), { kind: 'guard' }, rolls([30, 50])).state;
  assert.equal(C(afterGuard, 'warrior').statuses.some((s) => s.id === 'guard'), false);
  // Every status the three registries name either has hooks or is listed as unsupported.
  const report = supportReport(data);
  assert.equal(report.statuses.total, report.statuses.supported + report.statuses.unsupported.length);
  for (const bad of report.statuses.unsupported) assert.ok(!STATUS_HOOKS[bad.id] || STATUS_HOOKS[bad.id].unsupported);
});

test('skill effects resolve in the registry\'s order: binds ride the attack roll, burns tick, heals mend, the price is always paid', () => {
  const pick = (id) => data.skills.skills.find((s) => s.id === id);
  const party = () => [
    hero('rogue', { skills: [pick('rog_ankle_tap')], mp: 500, maxMp: 500, stats: stats(200, { AGI: 500, LCK: 50 }) }),
    hero('mage', { skills: [pick('mag_hot_take'), pick('mag_light_reading')], mp: 500, maxMp: 500, hp: 400, stats: stats(200, { AGI: 300 }) }),
    hero('warrior', { skills: [pick('war_overhead_regret')], mp: 2000, maxMp: 2000, stats: stats(200, { AGI: 250 }) }),
  ];
  let state = createBattle({ party: party(), enemies: [foe('dummy', [idle], { stats: stats(100, { AGI: 5, LCK: 50 }) })], data }, rolls());
  // Ankle Tap: the bind is read off the attack's own d100. A 12 hits and binds; a 70 hits and does not.
  const tapped = act(state, { kind: 'skill', skillId: 'rog_ankle_tap', target: 'dummy' }, rolls([12, 50]));
  const bind = of(tapped.events, 'bind')[0];
  assert.equal(bind.roll, 12);
  assert.equal(bind.riding, true);
  assert.equal(C(tapped.state, 'dummy').binds.legs, 2);
  assert.equal(of(act(state, { kind: 'skill', skillId: 'rog_ankle_tap', target: 'dummy' }, rolls([70, 50])).events, 'bind').length, 0);
  state = tapped.state;
  // Hot Take: fire damage now, and a burn of Power 1 at the start of each of its next two turns.
  assert.equal(currentActor(state), 'mage');
  const burned = act(state, { kind: 'skill', skillId: 'mag_hot_take', target: 'dummy' }, rolls([20, 50]));
  assert.equal(C(burned.state, 'dummy').dots.length, 1);
  // Overhead Regret misses, and the warrior's arms are bound all the same.
  assert.equal(currentActor(burned.state), 'warrior');
  const regret = act(burned.state, { kind: 'skill', skillId: 'war_overhead_regret', target: 'dummy' }, rolls([95]));
  assert.equal(of(regret.events, 'attack')[0].outcome, 'miss');
  assert.equal(of(regret.events, 'bind', (e) => e.self)[0].part, 'arms');
  const tick = of(regret.events, 'damage', (e) => e.source === 'dot');
  assert.equal(tick.length, 1, 'the burn ticks at the start of the dummy\'s turn');
  assert.ok(tick[0].amount > 0);
  assert.equal(C(regret.state, 'warrior').mp, 2000 - 900);
  assert.match(legalActions(regret.state, currentActor(regret.state)).length ? 'ok' : '', /ok/);
  // Light Reading: no roll, HP back, 1 MP.
  let next = regret.state;
  while (currentActor(next) !== 'mage') next = act(next, { kind: 'guard' }, rolls()).state;
  const healed = act(next, { kind: 'skill', skillId: 'mag_light_reading', target: 'mage' }, rolls());
  const heal = of(healed.events, 'heal')[0];
  assert.ok(heal.amount > 0);
  assert.equal(heal.hpAfter, 400 + heal.amount);
  assert.match(heal.line, /^\[heal [\d,]+, no roll\] Mage · Light Reading .* · 1 MP$/);
});

test('wards, Counter Stance, the scripted skills and the class passives do what their text says', () => {
  const pick = (id) => data.skills.skills.find((s) => s.id === id);
  const arche = (id) => data.archetypes.archetypes.find((a) => a.id === id);
  const fast = (id, level, extra = {}) => makeHero(arche(id), level, { mp: 99999, maxMp: 99999, limit: 100, ...extra, stats: { ...makeHero(arche(id), level).stats, AGI: 1000 } });
  // A ward steps the affinity down one: normal becomes resist, so a fire hit is halved.
  const ward = move('x_ward', { type: 'buff', power: 0, target: 'self', part: 'none', tags: [], effects: [{ kind: 'status', id: 'ward_fire', turns: 3 }] });
  const flame = move('x_flame', { type: 'magical', stat: 'INT', element: 'fire', tags: ['ranged'] });
  const burn = (action) => of(act(createBattle({ party: [hero('warrior', { skills: [ward], stats: stats(200, { AGI: 400 }) })], enemies: [foe('imp', [flame])], data }, rolls()), action, rolls([30, 50])).events, 'attack')[0];
  const open = burn({ kind: 'breather' });
  const warded = burn({ kind: 'skill', skillId: 'x_ward' });
  assert.equal(warded.affinity, 'resist');
  assert.equal(warded.damage, Math.floor(open.damage / 2));

  // Counter Stance answers every melee attack rolled against the warrior, hit or miss, with a free basic attack.
  const club = move('x_club', { name: 'Club' });
  const stance = act(createBattle({ party: [fast('warrior', 50)], enemies: [foe('ogre', [club], { level: 50, actions: 2 })], data }, rolls()), { kind: 'skill', skillId: 'war_come_at_me' }, rolls([30, 50, 30, 50, 99, 30, 50]));
  const blows = of(stance.events, 'attack');
  assert.deepEqual(blows.map((e) => [e.actor, Boolean(e.counter)]), [['ogre', false], ['warrior', true], ['ogre', false], ['warrior', true]]);
  assert.equal(blows[2].outcome, 'fumble', 'a miss is answered too');
  assert.equal(blows[1].skill, BASIC_ATTACK.id);

  // Seeing Red: Might up and Willpower down a step for every 25 stress, read off the passive's own numbers.
  const angry = createBattle({ party: [fast('warrior', 50, { stress: 60 })], enemies: [foe('ogre', [idle], { level: 50 })], data }, rolls());
  const red = C(angry, 'warrior').mods.filter((m) => m.source === 'passive:war_p_seeing_red');
  assert.deepEqual(red.map((m) => [m.stat, m.mult]), [['STR', 1.1], ['WIL', 0.9]]);

  // Borrowed Time: act again now, sit out the next turn, and not twice running.
  const rogue = fast('rogue', 100);
  const dummy = () => foe('dummy', [idle], { level: 100, rank: 'superboss', stats: stats(500, { AGI: 5 }) });
  let state = createBattle({ party: [rogue], enemies: [dummy()], data }, rolls());
  const borrowed = act(state, { kind: 'skill', skillId: 'rog_borrowed_time' }, rolls());
  assert.equal(currentActor(borrowed.state), 'rogue', 'the extra action is taken at once');
  assert.match(legalActions(borrowed.state).find((a) => a.skillId === 'rog_borrowed_time').why, /extra action/);
  // Gift Wrap: three binds, each read off the same d100. Sticky Fingers pays 6 Limit for the crit and 6 for each bind.
  const wrapped = act(borrowed.state, { kind: 'skill', skillId: 'rog_gift_wrap', target: 'dummy' }, rolls([10, 50]));
  assert.deepEqual(of(wrapped.events, 'bind').map((e) => [e.part, e.roll]), [['head', 10], ['arms', 10], ['legs', 10]]);
  assert.equal(of(wrapped.events, 'attack')[0].outcome, 'crit');
  assert.equal(C(wrapped.state, 'rogue').limit, 100, 'the gauge was already full');
  assert.equal(of(wrapped.events, 'skip', (e) => e.actor === 'rogue').length, 1, 'the borrowed turn is paid back');
  // The Big Score: a plain hit on a bound target is an automatic crit. Clean Getaway: two more actions, then Hidden.
  state = createBattle({ party: [rogue], enemies: [{ ...dummy(), binds: undefined }], data }, rolls());
  const away = act(state, { kind: 'skill', skillId: 'rog_clean_getaway' }, rolls());
  assert.equal(away.state.turn.actionsLeft, 2);
  assert.equal(C(away.state, 'rogue').statuses.some((st) => st.id === 'hidden'), false, 'not hidden until the extra actions are spent');
  const tied = act(away.state, { kind: 'skill', skillId: 'rog_gift_wrap', target: 'dummy' }, rolls([10, 50]));
  const score = act(edit(tied.state, (st) => { st.combatants.rogue.limit = 100; }), { kind: 'skill', skillId: 'rog_the_big_score', target: 'dummy' }, rolls([60, 50]));
  const big = of(score.events, 'attack')[0];
  assert.equal(big.outcome, 'crit');
  assert.equal(big.autoCrit, true);
  assert.equal(big.roll, 60);
  assert.ok(big.roll > big.critPct, 'the roll itself was only a hit');
  assert.equal(C(score.state, 'rogue').statuses.some((st) => st.id === 'hidden'), true, 'then the rogue vanishes');

  // The mage: Dissertation lands as the element the target is weakest to; Group Project heals everyone but the caster.
  const mage = fast('mage', 100, { hp: 1000 });
  const frosty = { ...dummy(), affinities: { ice: 'weak', fire: 'resist' } };
  const lecture = act(createBattle({ party: [mage, makeHero(arche('warrior'), 100, { hp: 1000 })], enemies: [frosty], data }, rolls()), { kind: 'skill', skillId: 'mag_dissertation', target: 'dummy' }, rolls([30, 50]));
  assert.equal(of(lecture.events, 'attack')[0].affinity, 'weak');
  assert.equal(C(lecture.state, 'mage').limit, 14, 'Marginalia: 6 for a new element on this enemy, 8 for the weakness');
  const project = act(createBattle({ party: [mage, makeHero(arche('warrior'), 100, { hp: 1000 })], enemies: [dummy()], data }, rolls()), { kind: 'skill', skillId: 'mag_group_project' }, rolls());
  assert.deepEqual(of(project.events, 'heal').map((e) => e.target), ['warrior']);
  assert.equal(C(project.state, 'mage').hp, 1000);
  assert.ok(pick('mag_group_project').tags.includes('scripted'));
});

// ---------------------------------------------------------------- bosses

const bolgrimSetup = (party = referenceParty(12, data)) => ({ party, boss: 'boss_bolgrim', data });
const stanceFor = (state) => (currentActor(state) === 'valerie' ? 'wing' : undefined);

test('a boss changes phase at its threshold, uses the phase\'s own text, and re-cocks its contraption', () => {
  const fresh = createBattle(bolgrimSetup(), makeRng(4));
  assert.equal(fresh.boss.phase, 0);
  const state = edit(fresh, (s) => {
    const b = s.combatants.boss_bolgrim;
    b.hp = Math.floor(b.maxHp * 0.6) + 5; // one hit above 60%
    s.contraption.used = true;
  });
  const step = act(state, { kind: 'attack', stance: stanceFor(state), target: 'boss_bolgrim' }, rolls([5, 50]));
  const phase = of(step.events, 'phase')[0];
  const def = BOSSES[0].phases[1];
  assert.equal(phase.phase, 2);
  assert.equal(phase.phaseName, def.name);
  assert.ok(phase.text.includes(def.text), 'the paragraph is the phase\'s own text');
  assert.match(phase.line, /^\[phase 2 at 60% HP\] Bolgrim Underbridge · I Was There/);
  assert.equal(step.state.boss.phase, 1);
  assert.equal(step.state.contraption.used, false, 'Exhibit A is cocked again');
  assert.equal(of(step.events, 'stress', (e) => e.reason === 'set_piece').length, 0, 'a phase change fires no stress of its own');
  // From the next round he follows the new phase's script: I Was There opens it.
  let later = step.state;
  const seen = [...step.events];
  const rng = makeRng(8);
  while (!later.over && later.round <= step.state.round + 1) {
    const next = act(later, defaultPolicy(later), rng);
    seen.push(...next.events);
    later = next.state;
  }
  assert.ok(of(seen, 'skill', (e) => e.skill === 'boss_bolgrim_i_was_there').length >= 1);
});

const armlock = move('x_armlock', { name: 'Armlock', power: 1, acc: 20, part: 'none', cost: { mp: 0, limit: 0 }, effects: [{ kind: 'bind', part: 'arms', chance: 100, turns: 3 }] });
const lockParty = () => referenceParty(12, data).map((p) => ({ ...p, skills: [armlock] }));
const lastPhase = (state, pending) => edit(state, (s) => {
  const b = s.combatants.boss_bolgrim;
  b.hp = Math.floor(b.maxHp * 0.29);
  s.boss.phase = 2;
  s.boss.phaseRound = 0;
  if (pending) s.boss.pending = { move: 'boss_bolgrim_the_proof', by: 'boss_bolgrim_wind_the_proof', due: s.round + 1, part: 'arms' };
});

test('a wind-up is telegraphed, the move fires a round later, and a bind on its part cancels it', () => {
  // In his last phase he winds the Proof as his first action.
  let state = lastPhase(createBattle(bolgrimSetup(lockParty()), makeRng(6)), false);
  const seen = [];
  const rng = makeRng(60);
  while (!state.over && !of(seen, 'telegraph').length) {
    const next = act(state, { kind: 'guard' }, rng);
    seen.push(...next.events);
    state = next.state;
  }
  const tel = of(seen, 'telegraph')[0];
  assert.equal(tel.skill, 'boss_bolgrim_wind_the_proof');
  assert.equal(tel.move, 'boss_bolgrim_the_proof');
  assert.equal(tel.due, tel.round + 1);
  assert.match(tel.line, /^\[telegraph, no roll\] Bolgrim Underbridge · Wind the Proof · The Proof fires in round \d+/);
  assert.ok(of(seen, 'stress', (e) => e.skillName === 'Wind the Proof').length >= 1, 'the wind-up still lands its own stress');

  // Left alone, it fires as his first action of the round it is due, at everyone.
  const armed = lastPhase(createBattle(bolgrimSetup(lockParty()), makeRng(6)), true);
  assert.equal(armed.boss.pending.move, 'boss_bolgrim_the_proof');
  let fired = armed;
  const log = [];
  const dice = makeRng(61);
  while (!fired.over && fired.round <= armed.round + 1) {
    const next = act(fired, { kind: 'guard' }, dice);
    log.push(...next.events);
    fired = next.state;
  }
  const proof = of(log, 'attack', (e) => e.skill === 'boss_bolgrim_the_proof');
  assert.ok(proof.length >= 1, 'The Proof fired');
  assert.ok(proof.every((e) => e.round === armed.round + 1));
  const firstBossBeat = log.find((e) => e.actor === 'boss_bolgrim' && e.round === armed.round + 1 && ['attack', 'skill', 'telegraph'].includes(e.type));
  assert.equal(firstBossBeat.skill, 'boss_bolgrim_the_proof', 'it is his first action that round');

  // Bound arms call it off: whoever is up binds them (d100 3 hits and binds).
  const stance = stanceFor(armed);
  const locked = act(armed, { kind: 'skill', skillId: 'x_armlock', stance, target: 'boss_bolgrim' }, rolls([3, 50]));
  assert.equal(of(locked.events, 'bind', (e) => e.target === 'boss_bolgrim' && e.part === 'arms').length, 1);
  const cancel = of(locked.events, 'cancel')[0];
  assert.equal(cancel.move, 'boss_bolgrim_the_proof');
  assert.equal(cancel.reason, 'bind');
  assert.equal(locked.state.boss.pending, null);
  let after = locked.state;
  const rest = [...locked.events];
  const more = makeRng(62);
  while (!after.over && after.round <= armed.round + 2) {
    const next = act(after, { kind: 'guard' }, more);
    rest.push(...next.events);
    after = next.state;
  }
  assert.equal(of(rest, 'attack', (e) => e.skill === 'boss_bolgrim_the_proof').length, 0, 'the wound-up move never fires');
});

test('a Chaos Wave that sets off the boss\'s contraption also cancels a wound-up move', () => {
  const party = [valerieAt(12, 60, { stats: { ...makeHero(klutz, 12).stats, AGI: 900 } })];
  const armed = lastPhase(createBattle(bolgrimSetup(party), rolls()), true);
  assert.equal(currentActor(armed), 'valerie');
  const step = act(armed, { kind: 'attack', stance: 'wing', target: 'boss_bolgrim' }, rolls([99]));
  assert.equal(of(step.events, 'contraption')[0].name, 'Exhibit A');
  assert.equal(of(step.events, 'cancel')[0].reason, 'contraption');
  const b = C(step.state, 'boss_bolgrim');
  assert.ok(b.binds.legs >= 1, 'his legs are bound with no contest, whatever his bind resistance');
  assert.equal(of(step.events, 'damage', (e) => e.source === 'contraption')[0].amount, Math.round(b.maxHp * 0.04));
});

test('the concession ends the fight as a win and charges its price', () => {
  const fresh = createBattle(bolgrimSetup(), makeRng(4));
  assert.equal(legalActions(fresh).some((a) => a.kind === 'concede'), false, 'not on offer above the threshold');
  const low = edit(fresh, (s) => { s.combatants.boss_bolgrim.hp = Math.floor(s.combatants.boss_bolgrim.maxHp * 0.3); s.boss.phase = 2; });
  const offer = legalActions(low).find((a) => a.kind === 'concede');
  assert.equal(offer.label, 'Tell Him He Is Right');
  assert.equal(offer.disabled, undefined);
  const before = C(low, 'valerie');
  const step = act(low, { kind: 'concede' }, rolls());
  assert.equal(step.state.over, true);
  assert.equal(step.state.result, 'win');
  assert.equal(step.state.outcome, 'concession');
  assert.equal(currentActor(step.state), null);
  const price = of(step.events, 'stress', (e) => e.reason === 'concession')[0];
  assert.equal(price.targets[0].id, 'valerie');
  assert.equal(price.targets[0].taken, 25, '25 realization stress, in full');
  assert.equal(price.targets[0].gaugeAfter, airheadOf(before) - 10);
  assert.equal(step.state.story.trust, -5);
  assert.deepEqual(step.state.rewards, { exp: 18000, gold: 3600 }, 'full rewards');
  assert.equal(step.events.at(-1).type, 'end');
  assert.match(step.events.at(-1).line, /concession/);
  assert.ok(C(step.state, 'boss_bolgrim').hp > 0, 'nobody had to finish him');
  assert.throws(() => act(step.state, { kind: 'guard' }, rolls()), /the battle is over/);

  // Vellum only takes it from Valerie, thinking. Parity only from a Total Airhead with a full gauge of MCE.
  const vellum = edit(createBattle({ party: referenceParty(50, data), boss: 'boss_vellum', data }, makeRng(2)), (s) => { s.combatants.boss_vellum.hp = Math.floor(s.combatants.boss_vellum.maxHp * 0.2); });
  const asked = legalActions(vellum).find((a) => a.kind === 'concede');
  if (currentActor(vellum) === 'valerie') assert.equal(asked.stance, 'think');
  else assert.match(asked.why, /only Valerie/);
  const parity = edit(createBattle({ party: referenceParty(100, data), boss: 'boss_parity', data }, makeRng(2)), (s) => {
    s.combatants.boss_parity.hp = Math.floor(s.combatants.boss_parity.maxHp * 0.2);
    s.turn.actor = 'valerie';
    s.combatants.valerie.flags.airhead = 80;
    s.combatants.valerie.limit = 40;
  });
  assert.match(legalActions(parity).find((a) => a.kind === 'concede').why, /needs 100 Limit/);
  const paid = act(edit(parity, (s) => { s.combatants.valerie.limit = 100; }), { kind: 'concede' }, rolls());
  assert.equal(paid.state.outcome, 'concession');
  assert.equal(C(paid.state, 'valerie').limit, 0, 'all 100 MCE');
});

test('Madam Parity aims at the richest hero, and Balance Due lands once on a taunting Valerie', () => {
  const fresh = createBattle({ party: referenceParty(100, data), boss: 'boss_parity', data }, makeRng(9));
  // Opening Balance: every single-target attack goes to the hero with the most HP left. That is the warrior.
  const seen = [...fresh.opening];
  let state = fresh;
  const rng = makeRng(90);
  while (!state.over && state.round === 1) {
    const next = act(state, { kind: 'guard' }, rng);
    seen.push(...next.events);
    state = next.state;
  }
  const coins = of(seen, 'attack', (e) => e.actor === 'boss_parity' && e.skill === 'boss_parity_heads_i_win' && e.round === 1);
  assert.ok(coins.length >= 1);
  const richest = [...fresh.heroes].sort((a, b) => C(fresh, b).hp - C(fresh, a).hp)[0];
  assert.equal(richest, 'warrior');
  assert.equal(coins[0].target, richest);
  // Closing the Books: the bell has rung and the bill is due. With her taunt up, the whole of it is one hit on her.
  const due = edit(fresh, (s) => {
    s.combatants.boss_parity.hp = Math.floor(s.combatants.boss_parity.maxHp * 0.2);
    s.boss.phase = 3;
    s.boss.pending = { move: 'boss_parity_balance_due', by: 'boss_parity_closing_bell', due: s.round, part: 'arms' };
    s.combatants.valerie.statuses.push({ id: 'taunt', turns: 3, by: 'valerie', source: 'val_stand_behind_me', fresh: false });
    s.turn = null;
    s.turnIndex = s.order.length; // straight to the next round
  });
  const log = [];
  let after = due;
  const dice = makeRng(91);
  // Force the round to turn over by acting with whoever comes up, until the bill has landed.
  after = edit(due, (s) => { s.turn = { actor: s.heroes[0], actionsLeft: 1, slot: 0, extra: false, used: [], row: null, deferred: [] }; });
  while (!after.over && !of(log, 'attack', (e) => e.skill === 'boss_parity_balance_due').length && after.round <= due.round + 2) {
    const next = act(after, { kind: 'guard' }, dice);
    log.push(...next.events);
    after = next.state;
  }
  const bill = of(log, 'attack', (e) => e.skill === 'boss_parity_balance_due');
  assert.equal(bill.length, 1, 'one hit, not four');
  assert.equal(bill[0].target, 'valerie');
  assert.equal(bill[0].redirect.why, 'taunt');
});

test('moves that cannot miss roll nothing, and a crowd only sends its front', () => {
  const run = runBattle({ party: referenceParty(10, data), encounter: 'horde_at_the_gate', data }, { rng: makeRng(3), maxRounds: 2 });
  const drums = of(run.events, 'skill', (e) => e.skill === 'enemy_horde_drummer_war_drums');
  for (const e of drums) assert.match(e.line, /^\[no roll: cannot miss\]/);
  assert.equal(of(run.events, 'attack', (e) => e.skill === 'enemy_horde_drummer_war_drums').length, 0);
  // Round 1: five raiders, three slingers and both drummers act, out of twenty-six.
  const first = run.events.find((e) => e.type === 'round' && e.round === 1);
  assert.equal(first.order.length, 4 + 5 + 3 + 2);
  const state = createBattle({ party: referenceParty(10, data), encounter: 'horde_at_the_gate', data }, makeRng(3));
  assert.equal(state.enemies.length, 26);
  const reach = legalActions(state).find((a) => a.kind === 'attack').targets;
  assert.equal(reach.length, 10, 'the ranks waiting behind the front cannot be reached');
});

// ---------------------------------------------------------------- what is not supported, and the narrator

test('nothing is faked: whatever the runner cannot resolve is counted, named, and never offered or chosen', () => {
  const report = supportReport(data);
  assert.equal(report.skills.total, data.skills.skills.length + data.valerie.skills.length);
  assert.equal(report.skills.supported + report.skills.unsupported.length, report.skills.total);
  assert.equal(report.moves.supported + report.moves.unsupported.length, report.moves.total);
  assert.equal(report.passives.supported + report.passives.unsupported.length, data.passives.passives.length);
  for (const bad of [...report.skills.unsupported, ...report.moves.unsupported]) assert.ok(typeof bad.why === 'string' && bad.why.length > 5, `${bad.id} needs a reason`);
  assert.deepEqual(report.skills.unsupported.map((s) => s.id), ['val_found_it']);
  assert.equal(skillSupport({ id: 'x', target: 'one', effects: [{ kind: 'status', id: 'no_such_status' }] }).ok, false);
  assert.equal(skillSupport({ id: 'x', target: 'one', tags: ['scripted'], effects: [] }).ok, false);
  assert.equal(skillSupport(BASIC_ATTACK).ok, true);
  assert.ok(report.mechanics.unsupported.length >= 5 && report.mechanics.supported.length >= 10);
  // An enemy never picks a move the runner cannot resolve: it is listed on the state instead.
  const odd = move('x_odd', { effects: [{ kind: 'status', id: 'no_such_status' }] });
  const run = runBattle({ party: [hero('warrior')], enemies: [foe('imp', [odd], { rank: 'minion', stats: stats(60) })], data }, { rng: makeRng(1), maxRounds: 30 });
  assert.equal(of(run.events, 'attack', (e) => e.skill === 'x_odd').length, 0);
  assert.ok(of(run.events, 'attack', (e) => e.actor === 'imp').every((e) => e.skill === BASIC_ATTACK.id));
  assert.deepEqual(run.state.unsupported.skills.map((s) => s.id), ['x_odd']);
});

test('the runner and the narrator can be bundled into a web page: no node imports, no JSON imports, no hidden randomness', () => {
  for (const file of ['battle.js', 'narrate.js']) {
    const source = readFileSync(new URL(`../engine/${file}`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    for (const from of imports) {
      assert.ok(from.startsWith('./') && from.endsWith('.js'), `${file} imports ${from}`);
      assert.notEqual(from, './data-node.js', `${file} must take its data as an argument`);
    }
    assert.ok(!/Math\.random|Date\.now|require\(|process\./.test(source), `${file} reaches outside itself`);
  }
  // The state is plain data: it survives a trip through JSON and plays on exactly as before.
  const setup = { party: referenceParty(20, data), encounter: 'hoard_drake', data };
  const state = createBattle(setup, makeRng(12));
  const { defs, ...rest } = state;
  const revived = { ...JSON.parse(JSON.stringify(rest)), defs };
  const action = defaultPolicy(state);
  assert.deepEqual(act(revived, action, makeRng(13)).events, act(state, action, makeRng(13)).events);
});

test('formatLog sets each paragraph apart from its dice line', () => {
  const run = runBattle({ party: referenceParty(5, data), encounter: 'goblin_scouts', data }, { rng: makeRng(7) });
  const log = formatLog(run.events);
  const blocks = log.trimEnd().split('\n\n');
  assert.equal(blocks.length, run.events.length * 2, 'line, blank line, paragraph, blank line');
  for (let i = 0; i < run.events.length; i++) {
    assert.equal(blocks[i * 2], run.events[i].line);
    assert.equal(blocks[i * 2 + 1], run.events[i].text);
    assert.ok(blocks[i * 2].startsWith('['), 'the dice line comes first');
    assert.ok(!blocks[i * 2 + 1].includes('\n'), 'a paragraph is one block');
  }
  for (const e of run.events) {
    assert.equal(lineFor(e), e.line, 'a line can be rebuilt from its event');
    assert.equal(narrate(e, run.state.defs.ctx), e.text, 'and so can its paragraph');
  }
  assert.equal(run.summary.result, summarize(run.state, run.events).result);
});

test('the narrator tells each kind of beat differently, in the second person where Valerie is involved', () => {
  const base = { type: 'attack', round: 1, actor: 'ogre', actorName: 'Ogre', actorSide: 'enemies', target: 'valerie', targetName: 'Valerie', targetSide: 'heroes', targetYou: true, skill: 'x_club', skillName: 'Club', roll: 40, hitPct: 60, damage: 120, reflected: 0, powered: true };
  const hers = { ...base, actor: 'valerie', actorName: 'Valerie', actorSide: 'heroes', actorYou: true, target: 'ogre', targetName: 'Ogre', targetSide: 'enemies', targetYou: false, skill: 'basic_attack', skillName: 'Attack' };
  const beats = {
    hitOnHer: { ...base, outcome: 'hit' },
    critOnHer: { ...base, outcome: 'crit' },
    missOnHer: { ...base, outcome: 'miss', damage: 0 },
    dodge: { ...base, outcome: 'miss', damage: 0, dodged: true },
    bounce: { ...base, outcome: 'bounce', damage: 0, reflected: 300 },
    trips: { ...base, outcome: 'fumble', damage: 0, selfBind: 'legs' },
    wingHit: { ...hers, outcome: 'hit', stance: 'wing' },
    wingCrit: { ...hers, outcome: 'crit', stance: 'wing' },
    wingMiss: { ...hers, outcome: 'miss', stance: 'wing', damage: 0 },
    wingFumble: { ...hers, outcome: 'fumble', stance: 'wing', damage: 0, wave: true },
    thinkHit: { ...hers, outcome: 'hit', stance: 'think' },
    thinkCrit: { ...hers, outcome: 'crit', stance: 'think' },
    thinkMiss: { ...hers, outcome: 'miss', stance: 'think', damage: 0 },
    thinkFumble: { ...hers, outcome: 'fumble', stance: 'think', damage: 0 },
    allyHit: { ...hers, actor: 'warrior', actorName: 'Warrior', actorYou: false, outcome: 'hit', stance: undefined },
    allyFumble: { ...hers, actor: 'warrior', actorName: 'Warrior', actorYou: false, outcome: 'fumble', stance: undefined, damage: 0 },
    wave: { type: 'chaos_wave', round: 1, actor: 'valerie', actorName: 'Valerie', actorYou: true, roll: 97, jackpot: false, enemies: 3, guardsBroken: 1, limitBefore: 0, limitAfter: 15 },
    contraption: { type: 'contraption', round: 1, name: 'Exhibit A', uses: 'once per phase' },
    bind: { type: 'bind', round: 1, actor: 'rogue', actorName: 'Rogue', actorSide: 'heroes', target: 'ogre', targetName: 'Ogre', targetSide: 'enemies', part: 'legs', turns: 2, roll: 12, pct: 40, riding: true, success: true, skillName: 'Ankle Tap' },
    stress: { type: 'stress', round: 1, base: 10, source: 'horror', targetSide: 'heroes', targets: [{ id: 'warrior', name: 'Warrior', taken: 8, before: 0, after: 8 }] },
    unnoticed: { type: 'stress', round: 1, base: 10, source: 'horror', target: 'valerie', targetYou: true, allyRelief: 3, targets: [{ id: 'valerie', name: 'Valerie', you: true, taken: 0, before: 0, after: 0, noticed: false }] },
    truth: { type: 'stress', round: 1, base: 12, source: 'realization', target: 'valerie', targetYou: true, targets: [{ id: 'valerie', name: 'Valerie', you: true, taken: 12, before: 0, after: 12, gaugeBefore: 80, gaugeAfter: 70 }] },
    virtue: { type: 'resolve', round: 1, target: 'warrior', targetName: 'Warrior', roll: 7, virtuePct: 25, kind: 'virtue', entryName: 'Unflappable', quote: 'I have seen worse.', stress: 50 },
    affliction: { type: 'resolve', round: 1, target: 'warrior', targetName: 'Warrior', roll: 62, virtuePct: 25, kind: 'affliction', entryName: 'Tinfoil Helm', quote: 'I know what you did.', stress: 100 },
    breakdown: { type: 'breakdown', round: 1, target: 'warrior', targetName: 'Warrior', choice: 'storm_off', stress: 50 },
    phase: { type: 'phase', round: 1, actor: 'boss', actorName: 'Bolgrim Underbridge', phase: 2, phaseName: 'I Was There', phaseText: 'He stops fighting quietly.', at: 60, hp: 10, maxHp: 20 },
    telegraph: { type: 'telegraph', round: 1, actor: 'boss', actorName: 'Bolgrim Underbridge', skillName: 'Wind the Proof', moveName: 'The Proof', rounds: 1, due: 2 },
    defeat: { type: 'defeat', round: 1, target: 'ogre', targetName: 'Ogre', targetSide: 'enemies' },
    win: { type: 'end', round: 3, result: 'win', outcome: 'victory', name: 'Goblin Scouts', rounds: 3 },
    loss: { type: 'end', round: 3, result: 'loss', outcome: 'defeat', name: 'Goblin Scouts', rounds: 3 },
  };
  const told = Object.fromEntries(Object.entries(beats).map(([key, e]) => [key, narrate(e)]));
  const unique = new Set(Object.values(told));
  assert.equal(unique.size, Object.keys(beats).length, 'every kind of beat has prose of its own');
  for (const key of ['hitOnHer', 'critOnHer', 'dodge', 'bounce', 'trips', 'wingHit', 'wingCrit', 'wingMiss', 'wingFumble', 'thinkHit', 'thinkCrit', 'thinkMiss', 'thinkFumble', 'wave', 'unnoticed', 'truth']) {
    assert.match(told[key], /\b(you|your|You|Your)\b/, `${key} should speak to the player: ${told[key]}`);
    assert.ok(!/\bValerie\b/.test(told[key]), `${key} should not name her in the third person: ${told[key]}`);
  }
  assert.ok(told.phase.includes('He stops fighting quietly.'));
  assert.ok(told.contraption.includes('Exhibit A'));
  assert.ok(told.bounce.includes('Club') && told.allyHit.includes('Warrior'));
  // Variants: the same kind of beat does not always read the same, and the choice is fixed by the event alone.
  const variants = new Set([1, 2, 3, 4, 5, 6].map((roll) => narrate({ ...beats.wingHit, roll })));
  assert.ok(variants.size >= 3, `only ${variants.size} variants of a Wing It hit`);
  assert.equal(narrate(beats.bounce), narrate({ ...beats.bounce }));
  // Events from the runner carry a counter per family, so the same sentence never comes up twice running.
  assert.equal(voiceKey(beats.dodge), 'attack:dodge');
  const dealt = [0, 1, 2].map((voice) => narrate({ ...beats.dodge, voice }));
  assert.equal(new Set(dealt).size, 3);
  assert.equal(narrate({ type: 'no_such_event' }).length > 0, true);
});

test('in a real fight no paragraph repeats back to back within its family', () => {
  const run = runBattle({ party: referenceParty(12, data), boss: 'boss_bolgrim', data }, { rng: makeRng(4), maxRounds: 12 });
  const last = new Map();
  let checked = 0;
  for (const e of run.events) {
    const key = voiceKey(e);
    if (!['attack', 'stance', 'round'].includes(e.type)) continue;
    const shape = e.text.replace(/[\d,]+/g, '#');
    if (last.has(key)) { assert.notEqual(shape, last.get(key), `${key} repeated: ${e.text}`); checked += 1; }
    last.set(key, shape);
  }
  assert.ok(checked > 40);
});
