// Bosses and standard encounters: shape, bounds, the "built for the hero" rules, and the balance claims
// that blueprint/05_boss_architecture.md makes. Owner: boss desk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAT_KEYS, ELEMENTS, AFFINITY_MULT, BIND_PARTS, RANK_HP_MULT, SCALE } from '../engine/constants.js';
import { makeCombatant, benchmarkStat } from '../engine/stats.js';
import { readData } from '../engine/data-node.js';
import { statsAt, maxHp, maxMp, expYield, goldYield } from '../engine/progression.js';
import { damage, expectedDamage } from '../engine/combat.js';

const bossDoc = readData('bosses');
const encounterDoc = readData('encounters');
const bosses = bossDoc.bosses;
const encounters = encounterDoc.encounters;
const klutz = readData('valerie').archetype;
const partyDefs = [...['warrior', 'mage', 'rogue'].map((id) => readData('archetypes').archetypes.find((a) => a.id === id)), klutz];

const TYPES = ['physical', 'magical', 'heal', 'buff', 'debuff', 'stress', 'utility'];
const TARGETS = ['one', 'row', 'all', 'self', 'ally', 'allies'];
const PARTS = [...BIND_PARTS, 'none'];
const STRESS_SOURCES = ['general', 'horror', 'mental', 'realization', 'embarrassment', 'wound', 'death'];
const POWER_LIMIT = { one: 8, row: 4, all: 4 }; // handoff/combat-engineer.md, "Content Writer"
const REQUIRED_ENCOUNTERS = ['goblin_scouts', 'bandit_archers', 'skeleton_phalanx', 'hoard_drake', 'horde_at_the_gate'];

/** The reference party: warrior, mage, rogue and the hero at one level, no gear, full HP. */
const refParty = (level) => partyDefs.map((a) => {
  const stats = statsAt(a, level);
  const hp = maxHp(level, stats.CON);
  return makeCombatant({ id: a.id, level, archetype: a.id, stats, hp, maxHp: hp });
});
const asCombatant = (b) => makeCombatant({ id: b.id, level: b.level, rank: b.rank, stats: b.stats, hp: b.hp, maxHp: b.hp, affinities: b.affinities });
const enemyAt = (enemy, level) => {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, Math.round(benchmarkStat(level) * enemy.factors[k])]));
  return { stats, combatant: makeCombatant({ id: enemy.id, level, rank: enemy.rank, stats, affinities: enemy.affinities }) };
};
const isTelegraphed = (move) => move.tags.includes('telegraphed');
const stressEffects = (move) => move.effects.filter((e) => e.kind === 'stress' && e.amount > 0);
const hasStress = (move, ...sources) => stressEffects(move).some((e) => sources.includes(e.source));
const sentences = (text) => (text.match(/\.(\s|$)/g) ?? []).length;
const text = (v) => typeof v === 'string' && v.trim().length > 0;

function assertMoveShape(move, prefix) {
  const where = `move ${move.id}`;
  assert.match(move.id, new RegExp(`^${prefix}[a-z0-9_]+$`), `${where}: id must be lowercase snake case starting with ${prefix}`);
  assert.ok(text(move.name) && text(move.text), `${where}: needs name and text`);
  assert.ok(TYPES.includes(move.type), `${where}: type ${move.type}`);
  assert.ok(STAT_KEYS.includes(move.stat), `${where}: stat ${move.stat}`);
  assert.ok(typeof move.power === 'number' && move.power >= 0, `${where}: power`);
  assert.ok(Number.isFinite(move.acc) && Math.abs(move.acc) <= 20, `${where}: acc must be within ±20`);
  assert.ok(Number.isFinite(move.crit) && move.crit >= 0 && move.crit <= 20, `${where}: crit must be 0..20`);
  assert.ok(ELEMENTS.includes(move.element), `${where}: element ${move.element}`);
  assert.ok(TARGETS.includes(move.target), `${where}: target ${move.target}`);
  assert.ok(PARTS.includes(move.part), `${where}: part ${move.part}`);
  assert.ok(Array.isArray(move.tags) && Array.isArray(move.effects), `${where}: tags and effects must be arrays`);
  for (const key of ['archetype', 'unlock', 'tier', 'cost']) assert.ok(!(key in move), `${where}: enemy moves carry no "${key}"`);
  for (const e of move.effects) {
    if (e.kind === 'stress') {
      assert.ok(Number.isFinite(e.amount) && e.amount > 0 && e.amount <= 60, `${where}: stress amount ${e.amount}`);
      assert.ok(STRESS_SOURCES.includes(e.source), `${where}: stress source ${e.source}`);
    }
    if (e.kind === 'bind') {
      assert.ok(BIND_PARTS.includes(e.part) && e.chance >= 1 && e.chance <= 100 && e.turns >= 1, `${where}: bind needs part, chance and turns`);
    }
  }
}

function assertAffinities(affinities, where) {
  for (const [element, value] of Object.entries(affinities)) {
    assert.ok(ELEMENTS.includes(element), `${where}: element ${element}`);
    assert.ok(['weak', 'resist', 'null', 'absorb'].includes(value) && value in AFFINITY_MULT, `${where}: affinity ${value}`);
  }
}

function assertBindResist(bindResist, where) {
  assert.deepEqual(Object.keys(bindResist).sort(), [...BIND_PARTS].sort(), `${where}: bindResist needs head, arms and legs`);
  for (const part of BIND_PARTS) assert.ok(Number.isInteger(bindResist[part]) && bindResist[part] >= 0 && bindResist[part] <= 80, `${where}: bindResist.${part}`);
}

function assertContraption(contraption, where) {
  assert.ok(text(contraption.name) && text(contraption.text), `${where}: contraption needs name and text`);
  assert.ok(Array.isArray(contraption.effects) && contraption.effects.length > 0, `${where}: contraption needs effects`);
  assert.match(contraption.text, /Chaos Wave/, `${where}: the contraption text must say what a Chaos Wave does to it`);
}

/** Every status id a boss or an encounter uses: in its moves, its contraption and its concession. */
function statusIds(entry) {
  const found = [];
  const scan = (effects) => { for (const e of effects ?? []) if (e.kind === 'status') found.push(e.id); };
  for (const move of entry.moves ?? []) scan(move.effects);
  for (const enemy of entry.enemies ?? []) for (const move of enemy.moves) scan(move.effects);
  scan(entry.contraption?.effects);
  scan(entry.concession?.effects);
  return found;
}

// ---------------------------------------------------------------------------------------------
// Bosses: shape and bounds
// ---------------------------------------------------------------------------------------------

test('there are exactly three bosses: early, mid and superboss, climbing the level curve', () => {
  assert.equal(bossDoc.version, 1);
  assert.equal(bosses.length, 3);
  assert.deepEqual(bosses.map((b) => b.stage), ['early', 'mid', 'superboss']);
  assert.deepEqual(bosses.map((b) => b.rank), ['boss', 'boss', 'superboss']);
  const [early, mid, superboss] = bosses;
  assert.ok(early.level >= 8 && early.level <= 14, `early boss is level ${early.level}, wanted about 10`);
  assert.ok(mid.level >= 45 && mid.level <= 55, `mid boss is level ${mid.level}, wanted about 50`);
  assert.equal(superboss.level, 100);
  for (const b of bosses) {
    assert.match(b.id, /^boss_[a-z0-9_]+$/);
    assert.ok(text(b.name), `${b.id}: name`);
    assert.ok(b.rank in RANK_HP_MULT);
  }
});

test('every boss attribute is an integer in 1..1000', () => {
  for (const b of bosses) {
    assert.deepEqual(Object.keys(b.stats).sort(), [...STAT_KEYS].sort(), `${b.id}: needs all six attributes`);
    for (const key of STAT_KEYS) {
      assert.ok(Number.isInteger(b.stats[key]) && b.stats[key] >= SCALE.STAT_MIN && b.stats[key] <= SCALE.STAT_MAX, `${b.id}: ${key} is ${b.stats[key]}`);
    }
  }
});

test('boss HP is maxHp(level, CON, rank), MP is maxMp(level, WIL), and the superboss pool is in the millions', () => {
  for (const b of bosses) {
    assert.ok(Number.isInteger(b.hp));
    assert.equal(b.hp, maxHp(b.level, b.stats.CON, b.rank), `${b.id}: hp`);
    assert.equal(b.mp, maxMp(b.level, b.stats.WIL), `${b.id}: mp`);
  }
  const [early, mid, superboss] = bosses;
  assert.ok(superboss.hp >= 1_000_000, `superboss HP is ${superboss.hp}`);
  assert.ok(mid.hp >= 1_000_000, `the mid boss is already in the millions: ${mid.hp}`);
  assert.ok(early.hp < mid.hp && mid.hp < superboss.hp, 'HP pools climb with the stage');
});

test('every boss is a character: identity, want, cost, tactics and two or three sentences of counterplay', () => {
  for (const b of bosses) {
    for (const field of ['identity', 'want', 'cost', 'tactics', 'counterplay']) assert.ok(text(b[field]), `${b.id}: "${field}" must be a non-empty string`);
    for (const field of ['identity', 'want', 'cost']) assert.equal(sentences(b[field]), 1, `${b.id}: "${field}" is one sentence`);
    const count = sentences(b.counterplay);
    assert.ok(count >= 2 && count <= 3, `${b.id}: counterplay has ${count} sentences`);
    assertAffinities(b.affinities, b.id);
    assertBindResist(b.bindResist, b.id);
    assert.ok(Number.isInteger(b.actions) && b.actions >= 1 && b.actions <= 3, `${b.id}: actions per round`);
  }
});

test('boss rewards come from expYield and goldYield for the boss rank', () => {
  for (const b of bosses) {
    assert.equal(b.rewards.exp, expYield(b.level, b.rank), `${b.id}: exp`);
    assert.equal(b.rewards.gold, goldYield(b.level, b.rank), `${b.id}: gold`);
    assert.ok(Array.isArray(b.rewards.items), `${b.id}: rewards.items`);
  }
});

// ---------------------------------------------------------------------------------------------
// Phases and moves
// ---------------------------------------------------------------------------------------------

test('phases start at 100% HP and descend, and every move a phase names exists', () => {
  for (const b of bosses) {
    const ids = new Set(b.moves.map((m) => m.id));
    assert.ok(b.phases.length >= 3, `${b.id}: at least three phases`);
    assert.equal(b.phases[0].at, 100, `${b.id}: first phase starts at 100`);
    for (let i = 1; i < b.phases.length; i++) {
      assert.ok(b.phases[i].at < b.phases[i - 1].at && b.phases[i].at > 0, `${b.id}: phase ${i + 1} must start below phase ${i} and above 0`);
    }
    for (const phase of b.phases) {
      assert.ok(text(phase.name) && text(phase.text), `${b.id}: every phase needs a name and text`);
      assert.ok(sentences(phase.text) >= 1 && sentences(phase.text) <= 2, `${b.id} "${phase.name}": text is one or two sentences`);
      assert.ok(Array.isArray(phase.moves) && phase.moves.length > 0, `${b.id} "${phase.name}": moves`);
      for (const id of phase.moves) assert.ok(ids.has(id), `${b.id} "${phase.name}": move ${id} is not defined`);
    }
    const used = new Set(b.phases.flatMap((phase) => phase.moves));
    for (const id of ids) assert.ok(used.has(id), `${b.id}: move ${id} is never used by a phase`);
  }
});

test('every phase asks one question with an answer that has a price', () => {
  for (const b of bosses) for (const phase of b.phases) {
    assert.ok(text(phase.question) && phase.question.trim().endsWith('?'), `${b.id} "${phase.name}": question`);
    assert.ok(text(phase.answer), `${b.id} "${phase.name}": answer`);
    assert.ok(text(phase.price), `${b.id} "${phase.name}": price`);
  }
});

test('phase scripts use only that phase\'s moves, fill every action, and wind up before anything telegraphed', () => {
  for (const b of bosses) {
    const byId = Object.fromEntries(b.moves.map((m) => [m.id, m]));
    for (const phase of b.phases) {
      const rounds = phase.script;
      assert.ok(Array.isArray(rounds) && rounds.length >= 2, `${b.id} "${phase.name}": script`);
      for (const [i, round] of rounds.entries()) {
        assert.equal(round.length, b.actions, `${b.id} "${phase.name}" round ${i + 1}: one move per action`);
        for (const id of round) assert.ok(phase.moves.includes(id), `${b.id} "${phase.name}": script uses ${id}, which the phase does not list`);
        for (const id of round.filter((x) => isTelegraphed(byId[x]))) {
          const { by, rounds: ahead } = byId[id].telegraph;
          assert.equal(round[0], id, `${b.id}: ${id} must be the first action of its round`);
          const windUpRound = rounds[(i - ahead + rounds.length) % rounds.length];
          assert.ok(windUpRound.includes(by), `${b.id}: ${id} must be announced ${ahead} round(s) ahead by ${by}`);
        }
      }
      for (const id of phase.moves) assert.ok(rounds.flat().includes(id), `${b.id} "${phase.name}": lists ${id} but never uses it`);
    }
  }
});

test('boss moves are in the Skill shape, without archetype, unlock, tier or cost', () => {
  for (const b of bosses) {
    const slug = b.id.replace(/^boss_/, '');
    assert.ok(b.moves.length >= 6, `${b.id}: a boss needs a real move list`);
    for (const move of b.moves) assertMoveShape(move, `boss_${slug}_`);
  }
});

test('telegraphed moves name their wind-up and how to cancel it', () => {
  for (const b of bosses) {
    const telegraphed = b.moves.filter(isTelegraphed);
    assert.ok(telegraphed.length >= 1, `${b.id}: the last phase is built around a telegraphed move`);
    for (const move of telegraphed) {
      const windUp = b.moves.find((m) => m.id === move.telegraph?.by);
      assert.ok(windUp, `${move.id}: telegraph.by must name a move of the same boss`);
      assert.ok(windUp.tags.includes('windup'), `${windUp.id}: must be tagged windup`);
      assert.ok(move.telegraph.rounds >= 1, `${move.id}: at least one round of warning`);
      assert.ok(move.telegraph.cancel.length >= 2, `${move.id}: at least two ways to stop it`);
      assert.equal(windUp.part, move.part, `${move.id}: binding the wind-up part must also seal the move`);
    }
  }
});

test('move powers stay inside the limits unless the move is telegraphed', () => {
  for (const b of bosses) for (const move of b.moves) {
    if (isTelegraphed(move) || move.power === 0) continue;
    const limit = POWER_LIMIT[move.target];
    assert.ok(limit !== undefined, `${move.id}: a damaging move must target one, row or all`);
    assert.ok(move.power <= limit, `${move.id}: Power ${move.power} at target "${move.target}" is over the limit of ${limit}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Built for the hero
// ---------------------------------------------------------------------------------------------

test('every boss has at least three stress-inflicting moves, drawn from the seven sources', () => {
  for (const b of bosses) {
    const stressful = b.moves.filter((m) => stressEffects(m).length > 0);
    assert.ok(stressful.length >= 3, `${b.id}: only ${stressful.length} stress moves`);
    const sources = new Set(stressful.flatMap((m) => stressEffects(m).map((e) => e.source)));
    assert.ok(sources.size >= 3, `${b.id}: stress should come from at least three sources, got ${[...sources]}`);
  }
});

test('every boss has a projectile for her bounce, fear for her obliviousness and the truth for her nerve', () => {
  for (const b of bosses) {
    const projectile = b.moves.filter((m) => m.tags.includes('projectile') && m.power > 0 && !isTelegraphed(m));
    assert.ok(projectile.length >= 1, `${b.id}: needs a non-telegraphed projectile attack`);
    const fear = b.moves.filter((m) => hasStress(m, 'horror', 'mental'));
    assert.ok(fear.length >= 1, `${b.id}: needs a horror or mental stress move`);
    for (const m of fear) assert.ok(m.tags.includes('horror') || m.tags.includes('mental'), `${m.id}: tag the move with its stress source`);
    const truth = b.moves.filter((m) => hasStress(m, 'realization'));
    assert.ok(truth.length >= 1, `${b.id}: needs a realization stress move`);
    for (const m of truth) {
      assert.ok(m.tags.includes('realization'), `${m.id}: must be tagged realization`);
      assert.equal(m.auto, true, `${m.id}: the truth cannot be dodged`);
      assert.ok(stressEffects(m).some((e) => e.source === 'realization' && e.target === 'valerie'), `${m.id}: the realization lands on Valerie`);
    }
    // The projectile and the truth are in play from the opening phase or the one after it.
    const early = new Set([...b.phases[0].moves, ...b.phases[1].moves]);
    assert.ok(projectile.some((m) => b.phases[0].moves.includes(m.id)), `${b.id}: a projectile from phase 1`);
    assert.ok(fear.some((m) => b.phases[0].moves.includes(m.id)), `${b.id}: fear from phase 1`);
    assert.ok(truth.some((m) => early.has(m.id)), `${b.id}: the truth by phase 2`);
  }
});

test('every boss has an arena contraption that a Chaos Wave sets off, and a way to give it what it wants', () => {
  for (const b of bosses) {
    assertContraption(b.contraption, b.id);
    assert.ok(text(b.concession.name) && text(b.concession.text) && text(b.concession.price), `${b.id}: concession needs name, text and price`);
    assert.ok(b.concession.at <= b.phases[b.phases.length - 1].at, `${b.id}: the concession opens in the last phase`);
    assert.ok(text(b.vsHero), `${b.id}: one line on how it plays against the hero`);
  }
});

// ---------------------------------------------------------------------------------------------
// Balance, measured with the engine
// ---------------------------------------------------------------------------------------------

test('no non-telegraphed boss move one-shots a reference party member from full HP, even on a max-variance crit', () => {
  for (const b of bosses) {
    const attacker = asCombatant(b);
    for (const move of b.moves.filter((m) => m.power > 0 && !isTelegraphed(m))) for (const hero of refParty(b.level)) {
      const worst = damage(attacker, hero, move, { crit: true, variance: 1.1 });
      assert.ok(worst < hero.maxHp, `${move.id} does ${worst} to the level ${b.level} ${hero.id} (${hero.maxHp} HP)`);
    }
  }
});

test('telegraphed moves are real threats that Guarding answers: lethal to someone on a crit, survivable by all behind a Guard', () => {
  for (const b of bosses) {
    const attacker = asCombatant(b);
    for (const move of b.moves.filter(isTelegraphed)) {
      const party = refParty(b.level);
      assert.ok(party.some((hero) => damage(attacker, hero, move, { crit: true, variance: 1.1 }) >= hero.maxHp), `${move.id}: should be able to drop someone`);
      for (const hero of party) {
        assert.ok(damage(attacker, hero, move, { crit: true, variance: 1.1, guard: true }) < hero.maxHp, `${move.id}: a guarding ${hero.id} must survive`);
      }
    }
  }
});

// Expected party damage per round with a typical Power 4 skill each (the mage casts, everyone else swings), neutral affinity.
function partyPower4PerRound(b) {
  const target = asCombatant(b);
  return refParty(b.level).reduce((sum, hero) => {
    const skill = hero.id === 'mage'
      ? { power: 4, type: 'magical', stat: 'INT', element: 'fire', acc: 0, crit: 0 }
      : { power: 4, type: 'physical', stat: 'STR', element: 'phys', acc: 0, crit: 0 };
    return sum + expectedDamage(hero, target, skill, { affinity: 'normal' });
  }, 0);
}

// Expected boss damage per round into the whole party from its scripts, telegraphed moves left out, the hero's kit switched off.
// Aimed attacks are spread evenly, a row attack catches half the party. Phases are weighted by their share of the HP bar.
function bossPerRound(b) {
  const attacker = asCombatant(b);
  const party = refParty(b.level);
  const share = { one: 1 / party.length, row: 1 / 2, all: 1 };
  const byId = Object.fromEntries(b.moves.map((m) => [m.id, m]));
  let total = 0;
  b.phases.forEach((phase, i) => {
    const weight = (phase.at - (b.phases[i + 1]?.at ?? 0)) / 100;
    let perCycle = 0;
    for (const id of phase.script.flat()) {
      const move = byId[id];
      if (isTelegraphed(move) || move.power === 0) continue;
      for (const hero of party) perCycle += share[move.target] * expectedDamage(attacker, hero, move);
    }
    total += weight * (perCycle / phase.script.length);
  });
  return total;
}

test('a boss takes 15-30 rounds of Power 4 skills to drop, and the superboss takes longer than either', () => {
  const [early, mid, superboss] = bosses.map((b) => Math.ceil(b.hp / partyPower4PerRound(b)));
  assert.ok(early >= 15 && early <= 30, `early boss: ${early} rounds`);
  assert.ok(mid >= 15 && mid <= 30, `mid boss: ${mid} rounds`);
  assert.ok(early <= mid, 'the first boss is not the longest');
  assert.ok(superboss > 30 && superboss <= 60, `superboss: ${superboss} rounds`);
});

test('the party cannot simply out-damage a boss: unhealed, it falls well before the boss does', () => {
  for (const b of bosses) {
    const toKill = b.hp / partyPower4PerRound(b);
    const partyHp = refParty(b.level).reduce((sum, hero) => sum + hero.maxHp, 0);
    const partyLasts = partyHp / bossPerRound(b);
    assert.ok(partyLasts >= 6, `${b.id}: the party lasts only ${partyLasts.toFixed(1)} rounds unhealed, which is a wipe, not a fight`);
    assert.ok(partyLasts < toKill * 0.75, `${b.id}: party lasts ${partyLasts.toFixed(1)} rounds unhealed against ${toKill.toFixed(1)} to kill`);
  }
});

// ---------------------------------------------------------------------------------------------
// Standard encounters
// ---------------------------------------------------------------------------------------------

test('all five encounters the story events hand off to exist', () => {
  assert.equal(encounterDoc.version, 1);
  const ids = encounters.map((e) => e.id);
  for (const id of REQUIRED_ENCOUNTERS) assert.ok(ids.includes(id), `encounter ${id} is missing`);
  // And whatever the starter pack actually names, in case it grows.
  const pack = JSON.parse(readFileSync(new URL('../events/packs/valerie-starter.events.json', import.meta.url), 'utf8'));
  const named = new Set();
  for (const event of pack.events) for (const choice of event.choices) for (const branch of ['success', 'failure', 'crit', 'fumble']) {
    for (const fx of choice[branch]?.effects ?? []) if (fx.kind === 'battle') named.add(fx.encounter);
  }
  assert.ok(named.size >= REQUIRED_ENCOUNTERS.length);
  for (const id of named) assert.ok(ids.includes(id), `the starter pack hands off to "${id}", which is not defined`);
});

test('encounters and their enemies are well formed', () => {
  for (const enc of encounters) {
    assert.match(enc.id, /^[a-z][a-z0-9_]*$/);
    assert.ok(text(enc.name) && text(enc.text), `${enc.id}: name and text`);
    assert.ok(Array.isArray(enc.keys) && enc.keys.length >= 3, `${enc.id}: keys`);
    for (const key of enc.keys) assert.ok(text(key) && key === key.toLowerCase(), `${enc.id}: key "${key}" must be lowercase`);
    assert.ok(enc.level === 'party' || (Number.isInteger(enc.level) && enc.level >= 1 && enc.level <= 100), `${enc.id}: level`);
    assert.ok(enc.contraption === null || typeof enc.contraption === 'object', `${enc.id}: contraption is null or an object`);
    if (enc.contraption) assertContraption(enc.contraption, enc.id);
    assert.ok(Array.isArray(enc.enemies) && enc.enemies.length >= 1, `${enc.id}: enemies`);
    for (const enemy of enc.enemies) {
      const where = `${enc.id} / ${enemy.id}`;
      assert.match(enemy.id, /^enemy_[a-z0-9_]+$/, where);
      assert.ok(text(enemy.name) && text(enemy.text), `${where}: name and text`);
      assert.ok(Number.isInteger(enemy.count) && enemy.count >= 1, `${where}: count`);
      assert.ok(['minion', 'standard', 'elite'].includes(enemy.rank), `${where}: rank ${enemy.rank}`);
      assert.deepEqual(Object.keys(enemy.factors).sort(), [...STAT_KEYS].sort(), `${where}: factors need all six attributes`);
      for (const key of STAT_KEYS) assert.ok(enemy.factors[key] > 0 && enemy.factors[key] <= 1.6, `${where}: factor ${key} is ${enemy.factors[key]}`);
      if (enemy.acting !== undefined) assert.ok(Number.isInteger(enemy.acting) && enemy.acting >= 1 && enemy.acting <= enemy.count, `${where}: acting`);
      assertAffinities(enemy.affinities, where);
      assertBindResist(enemy.bindResist, where);
      assert.ok(enemy.moves.length >= 2, `${where}: at least two moves, so it has a choice to make`);
      for (const move of enemy.moves) assertMoveShape(move, `${enemy.id}_`);
    }
  }
});

test('enemy attributes stay in 1..1000 at every level, and no standard-encounter move one-shots a party member', () => {
  for (const enc of encounters) for (const enemy of enc.enemies) for (const level of [1, 12, 50, 100]) {
    const { stats, combatant } = enemyAt(enemy, level);
    for (const key of STAT_KEYS) assert.ok(stats[key] >= 1 && stats[key] <= 1000, `${enemy.id} L${level}: ${key} is ${stats[key]}`);
    assert.ok(maxHp(level, stats.CON, enemy.rank) >= 1);
    for (const move of enemy.moves.filter((m) => m.power > 0)) {
      assert.ok(move.power <= POWER_LIMIT[move.target], `${move.id}: Power ${move.power} is over the limit`);
      for (const hero of refParty(level)) {
        const worst = damage(combatant, hero, move, { crit: true, variance: 1.1 });
        assert.ok(worst < hero.maxHp, `${move.id} at L${level} does ${worst} to the ${hero.id} (${hero.maxHp} HP)`);
      }
    }
  }
});

test('each encounter delivers what its event promised', () => {
  const byId = Object.fromEntries(encounters.map((e) => [e.id, e]));
  const count = (enc, rank) => enc.enemies.filter((x) => x.rank === rank).reduce((sum, x) => sum + x.count, 0);
  const total = (enc) => enc.enemies.reduce((sum, x) => sum + x.count, 0);

  // Three goblins crept out of the ferns.
  assert.equal(total(byId.goblin_scouts), 3);
  // Bandit archers: every attack that does damage is a projectile, so the bounce is the whole fight.
  const arrows = byId.bandit_archers.enemies.flatMap((x) => x.moves).filter((m) => m.power > 0);
  assert.ok(arrows.length >= 4 && arrows.every((m) => m.tags.includes('projectile')), 'bandit_archers attacks must all be projectiles');
  assert.equal(total(byId.bandit_archers), 5, 'four bows and one crossbow');
  // The skeleton phalanx has the tilting floor from "Do Not Pull".
  assert.equal(total(byId.skeleton_phalanx), 12, 'a dozen skeletons');
  assert.match(byId.skeleton_phalanx.contraption.name, /lever/i);
  assert.match(byId.skeleton_phalanx.contraption.text, /tilt/i);
  assert.ok(byId.skeleton_phalanx.contraption.effects.some((e) => e.kind === 'bind' && e.part === 'legs'));
  // The hoard drake is an elite.
  assert.equal(count(byId.hoard_drake, 'elite'), 1);
  // The horde is a large minion fight.
  const horde = byId.horde_at_the_gate;
  assert.ok(count(horde, 'minion') >= 20, `horde has ${count(horde, 'minion')} minions`);
  assert.ok(count(horde, 'minion') / total(horde) >= 0.8, 'the horde is mostly minions');
  assert.ok(horde.enemies.some((x) => x.acting < x.count), 'the gate limits how many can act at once');
  // Every encounter gives the hero something to play with: a projectile, a contraption, or both.
  for (const enc of encounters) {
    const hasProjectile = enc.enemies.some((x) => x.moves.some((m) => m.tags.includes('projectile')));
    assert.ok(hasProjectile || enc.contraption, `${enc.id}: needs a projectile or a contraption`);
  }
});

// ---------------------------------------------------------------------------------------------
// Ids and registries
// ---------------------------------------------------------------------------------------------

test('ids are unique throughout both files', () => {
  const all = [
    ...bosses.map((b) => b.id),
    ...bosses.flatMap((b) => b.moves.map((m) => m.id)),
    ...encounters.map((e) => e.id),
    ...encounters.flatMap((e) => e.enemies.map((x) => x.id)),
    ...encounters.flatMap((e) => e.enemies.flatMap((x) => x.moves.map((m) => m.id))),
  ];
  const seen = new Set();
  for (const id of all) {
    assert.ok(!seen.has(id), `duplicate id "${id}"`);
    seen.add(id);
  }
  // No enemy id is a prefix of another, so every move's owner can be read off its id.
  const enemyIds = encounters.flatMap((e) => e.enemies.map((x) => x.id));
  for (const a of enemyIds) for (const b of enemyIds) if (a !== b) assert.ok(!b.startsWith(`${a}_`), `${a} is a prefix of ${b}`);
});

test('every status effect is registered in the "statuses" of the file that uses it', () => {
  for (const [file, doc, entries] of [['bosses.json', bossDoc, bosses], ['encounters.json', encounterDoc, encounters]]) {
    assert.ok(Array.isArray(doc.statuses) && doc.statuses.length > 0, `${file}: needs a top-level "statuses" array`);
    const registered = new Set();
    for (const status of doc.statuses) {
      assert.match(status.id, /^[a-z][a-z0-9_]*$/, `${file}: status id ${status.id}`);
      assert.ok(text(status.name) && text(status.text), `${file}: status ${status.id} needs name and text`);
      assert.ok(!registered.has(status.id), `${file}: status ${status.id} is registered twice`);
      registered.add(status.id);
    }
    const used = new Set(entries.flatMap(statusIds));
    assert.ok(used.size > 0, `${file}: expected some status effects`);
    for (const id of used) assert.ok(registered.has(id), `${file}: status "${id}" is used but not registered`);
    for (const id of registered) assert.ok(used.has(id), `${file}: status "${id}" is registered but never used`);
  }
});
