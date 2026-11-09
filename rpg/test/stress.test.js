import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, RESOLVE, STAT_KEYS, MOD_CLAMP, FUMBLE_FROM } from '../engine/constants.js';
import { makeRng, d100 } from '../engine/rng.js';
import { makeCombatant, effectiveStat, benchmarkStat } from '../engine/stats.js';
import { stressTaken, hitChance } from '../engine/combat.js';
import { readData } from '../engine/data-node.js';
import { stressFilter, resolveShiftForAllies } from '../engine/valerie.js';
import { applyBind } from '../engine/binds.js';
import {
  STRESS, STRESS_TIERS, STRESS_SOURCE_TAGS, STRESS_SOURCES, RELIEF, SERVICES, RESOLVE_RULES, ACT, MARKS, GENERIC_SCAR, SILVER_LINING, BREAKDOWN,
  clampStress, stressBand, stressBase, stressFor, marksOf, activeEffects, effectsOf, stressMultFor, reliefMultFor, refuses, covers,
  withStateOpts, consumeFirstRefusal, addStress, applyStress, relieveStress, breather, clampShift, resolveVirtuePct, isDoubles,
  resolveBands, validateResolveTables, readResolveRoll, startResolve, resolveCheck, forceResolve, partyResolveShift,
  gainMark, removeMark, spendSilverLining, clearResolve, snapOut, actOutChance, actOutCheck, pickByRoll,
  breakdownChoices, breakdown, endBattle, rest, ENEMY_STRESS, enemyStressEvent,
} from '../engine/stress.js';

// ---------------------------------------------------------------- fixtures

const afflictions = readData('afflictions').afflictions;
const virtues = readData('virtues').virtues;
const tables = { afflictions, virtues };
const valerieData = readData('valerie');
const aff = (id) => afflictions.find((e) => e.id === id);
const vir = (id) => virtues.find((e) => e.id === id);

/** A combatant with every attribute set to `all`, then overridden. */
function hero(all = 300, extra = {}) {
  const stats = { STR: all, INT: all, AGI: all, CON: all, WIL: all, LCK: all, ...(extra.stats ?? {}) };
  return makeCombatant({ id: 'hero', level: 50, hp: 1000, maxHp: 2000, ...extra, stats });
}

/** Put a hero straight into a state, as the Resolve Check would. */
const inState = (kind, entry, extra = {}, opts = {}) => startResolve(hero(300, extra), kind, entry, opts).combatant;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * Replay exact d100 results. rng.fixedRolls is one short on 30, 58 and 59 (float rounding), and these tests
 * walk every roll from 1 to 100, so they use a replay that lands in the middle of each step instead.
 */
function dice(rolls) {
  let i = 0;
  return () => {
    if (i >= rolls.length) throw new Error('dice: ran out of rolls');
    return (rolls[i++] - 0.5) / 100;
  };
}

/** Wrap an rng so a test can count how many times it was used. */
function counting(rng) {
  const wrapped = () => {
    wrapped.calls++;
    return rng();
  };
  wrapped.calls = 0;
  return wrapped;
}

const EFFECT_KINDS = ['mod', 'stressMult', 'reliefMult', 'attack', 'refuse', 'refuseFirst', 'cover', 'regen', 'resolveShift', 'gold', 'heckle'];
const ACTIONS = ['none', 'pass', 'guard', 'cover', 'attack', 'item', 'skill'];
const SHIFTS = [-15, 0, 10, 15];

test('the replay helper returns exactly the rolls it was given', () => {
  for (let roll = 1; roll <= 100; roll++) assert.equal(d100(dice([roll])), roll);
});

// ---------------------------------------------------------------- the data

test('the tables are well-formed: seven Afflictions on 26-100, five Virtues on 1-25', () => {
  assert.deepEqual(validateResolveTables(tables), { ok: true, errors: [] });
  assert.equal(afflictions.length, 7);
  assert.equal(virtues.length, 5);
  assert.equal(virtues[0].range[0], 1);
  assert.equal(virtues.at(-1).range[1], RESOLVE.VIRTUE_PCT);
  assert.equal(afflictions[0].range[0], RESOLVE.VIRTUE_PCT + 1);
  assert.equal(afflictions.at(-1).range[1], 100);
  // The parsed files work as tables too.
  assert.deepEqual(resolveBands({ afflictions: readData('afflictions'), virtues: readData('virtues') }), resolveBands(tables));
});

test('every Affliction and Virtue entry carries everything a player, a game master and the engine need', () => {
  const ids = new Set();
  for (const [kind, list, prefix] of [['affliction', afflictions, 'aff_'], ['virtue', virtues, 'vir_']]) {
    for (const e of list) {
      const at = `${kind} ${e.id}`;
      assert.match(e.id, new RegExp(`^${prefix}[a-z0-9_]+$`), at);
      assert.ok(!ids.has(e.id), `${at}: duplicate id`);
      ids.add(e.id);
      for (const field of ['name', 'quote', 'text', 'want', 'cost']) assert.ok(typeof e[field] === 'string' && e[field].length > 8 || field === 'name', `${at}: ${field}`);
      assert.ok(e.name.length > 0, at);
      assert.ok(Number.isInteger(e.range[0]) && Number.isInteger(e.range[1]) && e.range[0] <= e.range[1], at);
      // text is printed alone into the lorebook: it must end as a sentence and state the party line.
      assert.match(e.text, /\.$/, at);
      assert.ok(e.text.length <= 420, `${at}: text is ${e.text.length} characters`);

      assert.ok(Array.isArray(e.effects) && e.effects.length >= 2, `${at}: effects`);
      for (const fx of e.effects) {
        assert.ok(EFFECT_KINDS.includes(fx.kind), `${at}: unknown effect kind "${fx.kind}"`);
        if (fx.kind === 'mod') {
          assert.ok(STAT_KEYS.includes(fx.stat), at);
          assert.ok(fx.mult >= MOD_CLAMP.MIN && fx.mult <= MOD_CLAMP.MAX && fx.mult !== 1, `${at}: mod ${fx.mult}`);
          assert.ok(e.text.includes(`×${fx.mult}`), `${at}: text does not state ×${fx.mult}`);
        }
        if (fx.kind === 'stressMult' && fx.source !== undefined) assert.ok(STRESS_SOURCE_TAGS.includes(fx.source), at);
      }

      const chance = kind === 'virtue' ? e.behavior.inspire : e.behavior.actOut;
      assert.ok(chance >= SCALE.PCT_FLOOR && chance <= SCALE.PCT_CEIL, `${at}: turn chance ${chance}`);
      const acts = kind === 'virtue' ? [e.behavior.act] : [e.behavior.act, e.behavior.meltdown];
      for (const act of acts) {
        assert.ok(act && act.id && act.name && act.text, `${at}: act`);
        assert.ok(ACTIONS.includes(act.action), `${at}: action "${act.action}"`);
      }

      assert.equal(e.until, kind === 'virtue' ? 'battle' : 'calm', at);
      const { selfStress, partyStress } = e.onStart;
      if (kind === 'affliction') {
        assert.equal(selfStress, 0, at);
        assert.ok(partyStress >= 5 && partyStress <= 10, `${at}: party stress ${partyStress}`);
        assert.ok(e.text.includes(`Allies take ${partyStress} stress when it starts`), `${at}: text and onStart disagree`);
        assert.match(e.mark.id, /^aff_scar_[a-z0-9_]+$/, at);
        assert.equal(e.mark.kind, 'scar', at);
        assert.ok(e.mark.name && e.mark.text && e.mark.effects.length === 1, `${at}: mark`);
        assert.ok(EFFECT_KINDS.includes(e.mark.effects[0].kind), `${at}: mark effect`);
        assert.ok(!ids.has(e.mark.id), `${at}: duplicate mark id`);
        ids.add(e.mark.id);
      } else {
        assert.ok(selfStress <= -40, `${at}: self stress ${selfStress}`);
        assert.ok(partyStress <= -5 && partyStress >= -12, `${at}: party stress ${partyStress}`);
        assert.ok(e.text.includes(`They shed ${-selfStress} stress and allies shed ${-partyStress} when it starts`), `${at}: text and onStart disagree`);
        assert.equal(e.mark, undefined, `${at}: Virtues all leave the Silver Lining`);
      }
    }
  }
  assert.ok(!ids.has(GENERIC_SCAR.id) && !ids.has(SILVER_LINING.id));
});

test('at the base odds every Affliction has a doubles roll in its band, so every Scar can happen', () => {
  for (const band of resolveBands(tables, 0).filter((b) => b.kind === 'affliction')) {
    assert.ok(band.doubles.length >= 1, `${band.name} ${band.lo}-${band.hi} has no doubles`);
  }
});

// ---------------------------------------------------------------- A6: the bar

test('A6: stress is a whole number clamped to 0..200 whatever is thrown at it', () => {
  assert.equal(clampStress(-40), 0);
  assert.equal(clampStress(260), 200);
  assert.equal(clampStress(99.5), 100);
  assert.equal(clampStress(NaN), 0);
  assert.equal(applyStress(hero(300, { stress: 190 }), 500, { ignoreWill: true }).after, 200);
  assert.equal(applyStress(hero(300, { stress: 10 }), -500).after, 0);
  assert.equal(relieveStress(hero(300, { stress: 10 }), 999).after, 0);
  assert.equal(addStress(hero(300, { stress: 150 }), 9999).after, 200);

  const rng = makeRng(6);
  let c = hero(200);
  for (let i = 0; i < 4000; i++) {
    const amount = Math.floor(rng() * 121) - 60;
    c = applyStress(c, amount, { source: STRESS_SOURCE_TAGS[i % STRESS_SOURCE_TAGS.length], mult: 1 + (i % 3) }).combatant;
    assert.ok(Number.isInteger(c.stress) && c.stress >= SCALE.STRESS_MIN && c.stress <= SCALE.STRESS_MAX, `step ${i}: ${c.stress}`);
    if (i % 7 === 0) c = relieveStress(c, 33).combatant;
    if (c.stress === SCALE.STRESS_MAX) c = breakdown(c, { choice: 'have_it_out' }).combatant;
  }
});

test('A6: the Resolve Check fires when stress reaches 100 from below, and only then', () => {
  const at = (stress) => hero(300, { stress });
  assert.equal(addStress(at(99), 1).event, 'resolve');
  assert.equal(addStress(at(60), 80).event, 'resolve');
  assert.equal(addStress(at(98), 1).event, null);
  assert.equal(addStress(at(100), 30).event, null, 'already past the line: nothing to cross');
  assert.equal(addStress(at(120), -30).event, null, 'coming down through 100 is not a crossing');
  assert.equal(applyStress(at(95), 18, { source: 'horror' }).event, 'resolve');
});

test('A6: one Resolve Check per crossing: no second check until the state is cleared and 100 is crossed again', () => {
  let c = hero(300, { stress: 90 });
  let hit = applyStress(c, 30, { ignoreWill: true });
  assert.equal(hit.event, 'resolve');
  c = resolveCheck(hit.combatant, dice([60]), { tables }).combatant;
  assert.equal(c.resolve.kind, 'affliction');

  // Down to 70 (still afflicted: not under 50), then back over 100: no new check.
  c = relieveStress(c, 50).combatant;
  assert.equal(c.stress, 70);
  assert.equal(c.resolve.kind, 'affliction');
  hit = applyStress(c, 45, { ignoreWill: true });
  assert.equal(hit.after, 115);
  assert.equal(hit.event, null);

  // Cleared while still over the line: more stress is not a crossing.
  c = clearResolve(hit.combatant).combatant;
  assert.equal(c.resolve, null);
  assert.equal(applyStress(c, 20, { ignoreWill: true }).event, null);

  // Under 100 and over it again, with a clear head: now it fires.
  c = relieveStress(c, 30).combatant;
  assert.equal(c.stress, 85);
  assert.equal(applyStress(c, 20, { ignoreWill: true }).event, 'resolve');

  // A long climb with a state that is never cleared sets off exactly one check.
  let climber = hero(300);
  let checks = 0;
  for (let i = 0; i < 60; i++) {
    const step = applyStress(climber, 5, { ignoreWill: true });
    climber = step.combatant;
    if (step.event === 'resolve') {
      checks++;
      climber = resolveCheck(climber, dice([75]), { tables }).combatant;
    }
    if (step.event === 'breakdown') break;
  }
  assert.equal(checks, 1);
  assert.equal(climber.stress, 200);
});

test('A6: reaching 200 is a Breakdown, it outranks the Resolve Check, and it fires once', () => {
  assert.equal(addStress(hero(300, { stress: 199 }), 1).event, 'breakdown');
  assert.equal(addStress(hero(300, { stress: 150 }), 80).event, 'breakdown');
  assert.equal(addStress(hero(300, { stress: 95 }), 120).event, 'breakdown', 'one hit through both lines is a Breakdown');
  assert.equal(addStress(hero(300, { stress: 200 }), 10).event, null, 'the bar is already full');
  const afflicted = { ...inState('affliction', aff('aff_spooked')), stress: 195 };
  assert.equal(applyStress(afflicted, 30, { ignoreWill: true }).event, 'breakdown');
  const virtuous = { ...inState('virtue', vir('vir_on_a_roll')), stress: 195 };
  assert.equal(applyStress(virtuous, 30, { ignoreWill: true }).event, 'breakdown');
});

test('stressBand names the four stretches of the bar', () => {
  assert.equal(stressBand(0), 'calm');
  assert.equal(stressBand(49), 'calm');
  assert.equal(stressBand(50), 'rattled');
  assert.equal(stressBand(99), 'rattled');
  assert.equal(stressBand(100), 'cracking');
  assert.equal(stressBand(199), 'cracking');
  assert.equal(stressBand(200), 'breakdown');
});

// ---------------------------------------------------------------- applyStress

test('applyStress lands exactly what combat.stressTaken says, with source, ignoreWill and mult', () => {
  for (const wil of [1, 150, 300, 600, 1000]) for (const base of [1, 5, 12, 24, 48]) {
    const c = hero(300, { stats: { WIL: wil } });
    const hit = applyStress(c, base, { source: 'horror' });
    assert.equal(hit.taken, stressTaken(base, c));
    assert.equal(hit.before, 0);
    assert.equal(hit.after, hit.taken);
    assert.equal(hit.source, 'horror');
    assert.equal(hit.combatant.stress, hit.taken);
    assert.equal(applyStress(c, base, { ignoreWill: true }).taken, base);
    assert.equal(applyStress(c, base, { mult: 2 }).taken, stressTaken(base, c, { mult: 2 }));
  }
  assert.equal(applyStress(hero(), 0).taken, 0);
  assert.equal(applyStress(hero(), 0).event, null);
  // A negative base is relief: it is never mitigated and it reports a negative taken.
  const eased = applyStress(hero(1000, { stress: 40 }), -15);
  assert.equal(eased.taken, -15);
  assert.equal(eased.after, 25);
});

test('a bound head lets more stress through: the two systems meet in effective WIL', () => {
  const free = hero(600);
  const bound = applyBind(free, 'head', 2);
  assert.equal(applyStress(free, 30).taken, 15);
  assert.equal(applyStress(bound, 30).taken, 20);
});

test('states and Scars scale stress by source: stressMultFor', () => {
  const spooked = inState('affliction', aff('aff_spooked'));
  assert.equal(stressMultFor(spooked, 'horror'), 1.5);
  assert.equal(stressMultFor(spooked, 'general'), 1);
  assert.equal(applyStress(spooked, 20, { source: 'horror', ignoreWill: true }).taken, 30);
  assert.equal(applyStress(spooked, 20, { source: 'wound', ignoreWill: true }).taken, 20);

  const calm = inState('virtue', vir('vir_unflappable'));
  assert.equal(stressMultFor(calm, 'death'), 0.5);
  assert.equal(applyStress(calm, 20, { source: 'death', ignoreWill: true }).taken, 10);

  const flinch = gainMark(hero(), aff('aff_spooked').mark).combatant;
  assert.equal(applyStress(flinch, 20, { source: 'horror', ignoreWill: true }).taken, 25);
  // Scar and Affliction together multiply.
  const both = gainMark(spooked, aff('aff_spooked').mark).combatant;
  assert.equal(stressMultFor(both, 'horror'), 1.5 * 1.25);
  // Frayed Nerves has no source: it scales everything.
  const frayed = gainMark(hero(), GENERIC_SCAR).combatant;
  for (const source of STRESS_SOURCE_TAGS) assert.equal(stressMultFor(frayed, source), 1.1);
  // A multiplier of zero means zero, not the usual minimum of 1.
  const immune = inState('virtue', { id: 'vir_test_immune', name: 'Immune', effects: [{ kind: 'stressMult', mult: 0 }] });
  assert.equal(applyStress(immune, 50, { ignoreWill: true }).taken, 0);
  assert.equal(applyStress(hero(), 50, { mult: 0 }).taken, 0);
});

// ---------------------------------------------------------------- stress sources

test('stressBase writes the base value that lands 5 / 12 / 24 on a trained WIL at every level', () => {
  assert.deepEqual(STRESS_TIERS, { weak: 5, medium: 12, severe: 24 });
  const row = (level) => ['weak', 'medium', 'severe'].map((tier) => stressBase(tier, level));
  assert.deepEqual(row(1), [5, 12, 24]);
  assert.deepEqual(row(10), [6, 13, 27]);
  assert.deepEqual(row(25), [6, 15, 30]);
  // The Combat Engineer's mid and late guide values, exactly.
  assert.deepEqual(row(50), [8, 18, 36]);
  assert.deepEqual(row(75), [9, 21, 42]);
  assert.deepEqual(row(100), [10, 24, 48]);
  for (let level = 1; level <= 100; level++) {
    const trained = hero(benchmarkStat(level));
    for (const [tier, lands] of Object.entries(STRESS_TIERS)) {
      const taken = stressTaken(stressBase(tier, level), trained);
      assert.ok(Math.abs(taken - lands) <= 1, `L${level} ${tier}: lands ${taken}`);
    }
  }
  assert.throws(() => stressBase('spicy', 10), /Unknown stress tier/);
});

test('the standard stress sources are well-formed and cover every tag', () => {
  const ids = new Set();
  const tags = new Set();
  for (const s of STRESS_SOURCES) {
    assert.ok(!ids.has(s.id), s.id);
    ids.add(s.id);
    tags.add(s.source);
    assert.ok(STRESS_SOURCE_TAGS.includes(s.source), `${s.id}: tag ${s.source}`);
    assert.ok(STRESS_TIERS[s.tier] !== undefined, `${s.id}: tier ${s.tier}`);
    assert.ok(['self', 'target', 'allies', 'party'].includes(s.who), `${s.id}: who ${s.who}`);
    assert.ok(s.text.length > 10, s.id);
    assert.ok(Object.isFrozen(s));
  }
  assert.deepEqual([...tags].sort(), [...STRESS_SOURCE_TAGS].sort());
  assert.deepEqual(stressFor('ally_down', 100), { id: 'ally_down', tier: 'medium', source: 'death', who: 'allies', base: 24 });
  assert.throws(() => stressFor('nope', 1), /Unknown stress source/);
});

// ---------------------------------------------------------------- A7: the Resolve Check

test('A7: 25% Virtue, 75% Affliction over 100,000 seeded rolls; 35% with a +10 shift', () => {
  const share = (virtueShift, seed) => {
    const rng = makeRng(seed);
    const c = hero(300, { stress: 104 });
    let virtuous = 0;
    for (let i = 0; i < 100000; i++) if (resolveCheck(c, rng, { tables, virtueShift }).kind === 'virtue') virtuous++;
    return virtuous / 1000;
  };
  const base = share(0, 2026);
  assert.ok(Math.abs(base - 25) <= 1.5, `base Virtue share was ${base}%`);
  const lifted = share(10, 2027);
  assert.ok(Math.abs(lifted - 35) <= 1.5, `+10 Virtue share was ${lifted}%`);
  const crushed = share(-15, 2028);
  assert.ok(Math.abs(crushed - 10) <= 1.5, `-15 Virtue share was ${crushed}%`);
});

test('A7: the base chance is exactly the RESOLVE constants and the shift is clamped to the cap', () => {
  assert.equal(RESOLVE_RULES.VIRTUE_PCT, 25);
  assert.equal(resolveVirtuePct(), RESOLVE.VIRTUE_PCT);
  assert.equal(100 - resolveVirtuePct(0), RESOLVE.AFFLICTION_PCT);
  assert.equal(resolveVirtuePct(10), 35);
  assert.equal(resolveVirtuePct(-10), 15);
  assert.equal(resolveVirtuePct(RESOLVE.SHIFT_CAP), 40);
  assert.equal(resolveVirtuePct(99), 40);
  assert.equal(resolveVirtuePct(-99), 10);
  assert.equal(resolveVirtuePct(NaN), 25);
  assert.equal(resolveVirtuePct(4.6), 30);
  assert.equal(clampShift(16), 15);
  assert.equal(clampShift(-1000), -15);
  assert.deepEqual(resolveBands(tables, 40), resolveBands(tables, 15));
  assert.deepEqual(resolveBands(tables, -40), resolveBands(tables, -15));
  assert.equal(resolveCheck(hero(), dice([40]), { tables, virtueShift: 99 }).virtuePct, 40);
  assert.equal(resolveCheck(hero(), dice([40]), { tables, virtueShift: 99 }).kind, 'virtue');
  assert.equal(resolveCheck(hero(), dice([41]), { tables, virtueShift: 99 }).kind, 'affliction');
  assert.equal(resolveCheck(hero(), dice([10]), { tables, virtueShift: -99 }).kind, 'virtue');
  assert.equal(resolveCheck(hero(), dice([11]), { tables, virtueShift: -99 }).kind, 'affliction');
});

test('the bands fill 1-100 exactly, with no gaps and no overlaps, at every shift', () => {
  for (let shift = -15; shift <= 15; shift++) {
    const bands = resolveBands(tables, shift);
    const virtuePct = 25 + shift;
    assert.equal(bands.length, 12, `shift ${shift}`);
    assert.equal(bands[0].lo, 1, `shift ${shift}`);
    assert.equal(bands.at(-1).hi, 100, `shift ${shift}`);
    for (const [i, band] of bands.entries()) {
      assert.ok(Number.isInteger(band.lo) && Number.isInteger(band.hi) && band.hi >= band.lo, `shift ${shift}: ${band.name} is ${band.lo}-${band.hi}`);
      if (i > 0) assert.equal(band.lo, bands[i - 1].hi + 1, `shift ${shift}: gap or overlap before ${band.name}`);
      assert.equal(band.kind, band.hi <= virtuePct ? 'virtue' : 'affliction', `shift ${shift}: ${band.name}`);
    }
    // The order never changes and nobody falls off the table.
    assert.deepEqual(bands.map((b) => b.id), [...virtues, ...afflictions].map((e) => e.id), `shift ${shift}`);
    assert.equal(bands.filter((b) => b.kind === 'virtue').at(-1).hi, virtuePct, `shift ${shift}`);
    // Every roll lands in exactly one band.
    for (let roll = 1; roll <= 100; roll++) assert.equal(bands.filter((b) => roll >= b.lo && roll <= b.hi).length, 1, `shift ${shift} roll ${roll}`);
  }
  for (const shift of SHIFTS) assert.equal(resolveBands(tables, shift).reduce((sum, b) => sum + (b.hi - b.lo + 1), 0), 100);
});

test('the band layout at shifts -15, 0, +10 and +15 is the published table', () => {
  const layout = (shift) => resolveBands(tables, shift).map((b) => [b.lo, b.hi]);
  // With no shift the layout is the base ranges in the data.
  assert.deepEqual(layout(0), [...virtues, ...afflictions].map((e) => e.range));
  assert.deepEqual(layout(0), [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 36], [37, 47], [48, 58], [59, 69], [70, 80], [81, 90], [91, 100]]);
  assert.deepEqual(layout(-15), [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 23], [24, 36], [37, 50], [51, 63], [64, 76], [77, 88], [89, 100]]);
  assert.deepEqual(layout(10), [[1, 7], [8, 14], [15, 21], [22, 28], [29, 35], [36, 45], [46, 54], [55, 64], [65, 73], [74, 83], [84, 91], [92, 100]]);
  assert.deepEqual(layout(15), [[1, 8], [9, 16], [17, 24], [25, 32], [33, 40], [41, 49], [50, 58], [59, 66], [67, 75], [76, 84], [85, 92], [93, 100]]);
  // The rule itself: an upper edge is the side's start plus round(cumulative base width x new width / base width).
  const edge = (cumulative, shift) => 25 + shift + Math.round((cumulative * (75 - shift)) / 75);
  assert.equal(resolveBands(tables, 10)[5].hi, edge(11, 10));
  assert.equal(resolveBands(tables, 10)[8].hi, edge(44, 10));
  assert.equal(resolveBands(tables, -15)[7].hi, edge(33, -15));
});

test('one d100 answers the whole check: side, entry, personal and permanent are all read off the same roll', () => {
  const personal = valerieData.resolve;
  for (const shift of SHIFTS) {
    const bands = resolveBands(tables, shift);
    for (let roll = 1; roll <= 100; roll++) {
      const rng = counting(dice([roll]));
      const r = resolveCheck(hero(300, { stress: 100 }), rng, { tables, virtueShift: shift, personal });
      assert.equal(rng.calls, 1, 'the rng is used exactly once');
      const band = bands.find((b) => roll >= b.lo && roll <= b.hi);
      assert.equal(r.roll, roll);
      assert.equal(r.kind, band.kind);
      assert.equal(r.kind, roll <= 25 + shift ? 'virtue' : 'affliction');
      assert.equal(r.personal, roll % 2 === 0);
      assert.equal(r.entry, roll % 2 === 0 ? personal[band.kind] : band.entry);
      assert.equal(r.permanent, isDoubles(roll));
      assert.equal(r.combatant.resolve.kind, r.kind);
      assert.equal(r.combatant.resolve.id, r.entry.id);
      assert.deepEqual(readResolveRoll(roll, { tables, virtueShift: shift, personal }).entry, r.entry);
    }
  }
  assert.throws(() => readResolveRoll(0, { tables }), /d100/);
  assert.throws(() => readResolveRoll(101, { tables }), /d100/);
});

test('the personal entry replaces the table entry on even rolls only, and only for the side that has one', () => {
  const personal = valerieData.resolve;
  const check = (roll, own) => resolveCheck(hero(), dice([roll]), { tables, personal: own });
  assert.equal(check(60, personal).entry.id, 'aff_val_self_aware');
  assert.equal(check(61, personal).entry.id, 'aff_tinfoil_helm');
  assert.equal(check(12, personal).entry.id, 'vir_val_good_hero');
  assert.equal(check(13, personal).entry.id, 'vir_in_the_zone');
  // Without a personal entry nothing is ever personal.
  for (let roll = 1; roll <= 100; roll++) assert.equal(check(roll, undefined).personal, false);
  // Only an Affliction of their own: even Virtue rolls still read the table.
  const half = { affliction: personal.affliction };
  assert.equal(check(12, half).personal, false);
  assert.equal(check(12, half).entry.id, 'vir_in_the_zone');
  assert.equal(check(60, half).personal, true);
  // Half the die is even, so about half of a hero's results are her own.
  const own = Array.from({ length: 100 }, (_, i) => check(i + 1, personal)).filter((r) => r.personal).length;
  assert.equal(own, 50);
  // An entry with only id, name and text (as data/valerie.json ships them) still makes a working state.
  const state = check(60, personal).combatant.resolve;
  assert.equal(state.name, 'Self-Aware');
  assert.deepEqual(state.effects, []);
  assert.equal(state.behavior, null);
  assert.equal(check(60, personal).party, null);
});

test('permanent or temporary is read off the roll: doubles leave a mark', () => {
  const doubles = [];
  for (let roll = 1; roll <= 100; roll++) if (isDoubles(roll)) doubles.push(roll);
  assert.deepEqual(doubles, [11, 22, 33, 44, 55, 66, 77, 88, 99, 100]);

  const temporary = resolveCheck(hero(), dice([34]), { tables });
  assert.equal(temporary.permanent, false);
  assert.equal(temporary.mark, null);
  assert.equal(temporary.combatant.resolve.permanent, false);

  const scarred = resolveCheck(hero(), dice([33]), { tables });
  assert.equal(scarred.entry.id, 'aff_martyr_complex');
  assert.equal(scarred.permanent, true);
  assert.equal(scarred.mark.id, 'aff_scar_im_fine');
  assert.equal(scarred.combatant.resolve.permanent, true);
  assert.deepEqual(marksOf(scarred.combatant), [], 'the Scar is left when the Affliction ends, not before');

  const lucky = resolveCheck(hero(), dice([11]), { tables });
  assert.equal(lucky.kind, 'virtue');
  assert.equal(lucky.permanent, true);
  assert.equal(lucky.mark.id, SILVER_LINING.id);

  // A personal entry that names no mark of its own leaves the generic one for its side.
  const personal = valerieData.resolve;
  assert.equal(resolveCheck(hero(), dice([44]), { tables, personal }).mark.id, GENERIC_SCAR.id);
  assert.equal(resolveCheck(hero(), dice([22]), { tables, personal }).mark.id, SILVER_LINING.id);
  // Eight rolls in a hundred scar and two leave a Silver Lining at the base odds.
  const marks = Array.from({ length: 100 }, (_, i) => resolveCheck(hero(), dice([i + 1]), { tables })).filter((r) => r.permanent);
  assert.equal(marks.filter((r) => r.kind === 'affliction').length, 8);
  assert.equal(marks.filter((r) => r.kind === 'virtue').length, 2);
});

test('resolveCheck sets the state: attribute mods, own stress, instant heal and what the party gets', () => {
  const start = hero(300, { stress: 108 });
  const spooked = resolveCheck(start, dice([40]), { tables });
  assert.equal(spooked.entry.id, 'aff_spooked');
  assert.deepEqual(spooked.band, { lo: 37, hi: 47, id: 'aff_spooked', name: 'Spooked' });
  const state = spooked.combatant.resolve;
  assert.equal(state.kind, 'affliction');
  assert.equal(state.id, 'aff_spooked');
  assert.equal(state.turns, null);
  assert.equal(state.until, 'calm');
  assert.equal(state.roll, 40);
  assert.equal(state.personal, false);
  assert.deepEqual(state.effects, aff('aff_spooked').effects);
  assert.notEqual(state.effects, aff('aff_spooked').effects, 'the state carries its own copy');
  assert.equal(spooked.combatant.stress, 108, 'an Affliction leaves the bar where it is');
  assert.equal(effectiveStat(spooked.combatant, 'STR'), 240);
  assert.equal(effectiveStat(spooked.combatant, 'INT'), 240);
  assert.equal(effectiveStat(spooked.combatant, 'AGI'), 330);
  assert.equal(effectiveStat(spooked.combatant, 'CON'), 300);
  assert.ok(spooked.combatant.mods.every((m) => m.source === 'aff_spooked' && m.turns === null));
  assert.deepEqual(spooked.party, { stress: 6, ignoreWill: true, source: 'mental' });

  const wind = resolveCheck(start, dice([23]), { tables });
  assert.equal(wind.entry.id, 'vir_second_wind');
  assert.equal(wind.combatant.stress, 68, 'a Virtue sheds 40 of its owner\'s stress');
  assert.equal(wind.heal, 500);
  assert.equal(wind.combatant.hp, 1500);
  assert.equal(wind.combatant.resolve.until, 'battle');
  assert.deepEqual(wind.party, { stress: -6, ignoreWill: true, source: 'mental' });
  assert.equal(resolveCheck(start, dice([7]), { tables }).combatant.stress, 58, 'Unflappable sheds 50');
  // The party line is applied with applyStress: positive lands flat, negative is relief.
  const ally = hero(900, { stress: 30 });
  assert.equal(applyStress(ally, spooked.party.stress, spooked.party).after, 36, 'WIL does not help against a friend cracking');
  assert.equal(applyStress(ally, wind.party.stress, wind.party).after, 24);

  // A second check on someone already in a state replaces it cleanly: the old mods go.
  const again = resolveCheck(spooked.combatant, dice([85]), { tables });
  assert.equal(again.combatant.resolve.id, 'aff_doomsayer');
  assert.ok(again.combatant.mods.every((m) => m.source === 'aff_doomsayer'));
  assert.equal(effectiveStat(again.combatant, 'STR'), 300);
});

test('forceResolve: an event can name the entry, or just the side and let one d100 pick', () => {
  const named = forceResolve(hero(), 'affliction', { tables, id: 'aff_doomsayer' });
  assert.equal(named.combatant.resolve.id, 'aff_doomsayer');
  assert.equal(named.permanent, false);
  assert.equal(named.roll, null);
  const own = forceResolve(hero(), 'virtue', { tables, id: 'vir_val_good_hero', personal: valerieData.resolve });
  assert.equal(own.personal, true);
  assert.throws(() => forceResolve(hero(), 'virtue', { tables, id: 'aff_doomsayer' }), /not on the virtue table/);
  assert.throws(() => forceResolve(hero(), 'panic', { tables }), /Unknown Resolve outcome/);
  assert.throws(() => forceResolve(hero(), 'virtue', { tables }), /needs an id or an rng/);
  // One roll laid across the forced side: every roll gives that side, and every entry is reachable.
  for (const [side, list] of [['affliction', afflictions], ['virtue', virtues]]) {
    const seen = new Set();
    for (let roll = 1; roll <= 100; roll++) {
      const rng = counting(dice([roll]));
      const r = forceResolve(hero(), side, { tables, rng });
      assert.equal(rng.calls, 1);
      assert.equal(r.kind, side);
      assert.equal(r.permanent, isDoubles(roll));
      seen.add(r.entry.id);
    }
    assert.equal(seen.size, list.length);
  }
});

test('partyResolveShift: who broke first sets the odds for everyone after', () => {
  const steady = hero();
  const virtuous = inState('virtue', vir('vir_on_a_roll'));
  const afflicted = inState('affliction', aff('aff_spooked'));
  const calm = inState('virtue', vir('vir_unflappable'));
  const doom = inState('affliction', aff('aff_doomsayer'));
  assert.equal(partyResolveShift([]), 0);
  assert.equal(partyResolveShift([steady, steady, steady]), 0);
  assert.equal(partyResolveShift([virtuous, steady]), 5);
  assert.equal(partyResolveShift([afflicted, steady]), -5);
  assert.equal(partyResolveShift([virtuous, afflicted]), 0);
  assert.equal(partyResolveShift([calm]), 10, 'Unflappable lends 5 more than other Virtues');
  assert.equal(partyResolveShift([doom]), -10, 'Doomsayer costs 5 more than other Afflictions');
  assert.equal(partyResolveShift([doom, afflicted, afflicted]), -15, 'clamped');
  assert.equal(partyResolveShift([calm, virtuous, virtuous]), 15, 'clamped');
  assert.equal(partyResolveShift([afflicted], 10), 5, 'extra is added before the clamp');
  assert.equal(partyResolveShift([{ ...afflicted, hp: 0 }]), 0, 'a knocked-out ally sways nobody');
  assert.equal(partyResolveShift([{ ...afflicted, flags: { stormedOff: true } }]), 0);

  // The hero lends her shift through `extra`: +10 as a Total Airhead, +5 Ditzy, 0 Lucid or knocked out.
  const valerie = (airhead, hp = 100) => makeCombatant({ id: 'valerie', level: 50, hp, flags: { airhead } });
  assert.equal(partyResolveShift([valerie(90)], resolveShiftForAllies(valerie(90))), 10);
  assert.equal(resolveVirtuePct(partyResolveShift([valerie(90)], resolveShiftForAllies(valerie(90)))), 35);
  assert.equal(partyResolveShift([valerie(50)], resolveShiftForAllies(valerie(50))), 5);
  assert.equal(partyResolveShift([valerie(10)], resolveShiftForAllies(valerie(10))), 0);
  assert.equal(partyResolveShift([calm, valerie(90)], resolveShiftForAllies(valerie(90))), 15, 'her +10 and Unflappable +10 meet the cap');
});

test('the hero\'s kit feeds the same functions: her filter decides how a hit lands before the bar sees it', () => {
  const airhead = makeCombatant({ id: 'valerie', level: 50, stats: { WIL: 203 }, flags: { airhead: 90 }, stress: 90 });
  // Horror slides off: nothing lands, so nothing can set off a check.
  const fear = stressFilter(airhead, 30, 'horror');
  const shrugged = applyStress(airhead, fear.amount, { source: 'horror', ignoreWill: fear.ignoreWill });
  assert.equal(shrugged.taken, 0);
  assert.equal(shrugged.event, null);
  // The truth ignores her Willpower and can push her over.
  const truth = stressFilter(airhead, 30, 'realization');
  const landed = applyStress(airhead, truth.amount, { source: 'realization', ignoreWill: truth.ignoreWill });
  assert.equal(landed.taken, 30);
  assert.equal(landed.event, 'resolve');
  const result = resolveCheck(landed.combatant, dice([80]), { tables, personal: valerieData.resolve });
  assert.equal(result.entry.id, 'aff_val_self_aware');
  assert.equal(result.personal, true);
});

// ---------------------------------------------------------------- how a state ends

test('an Affliction ends when relief takes its owner under 50, and not a point sooner', () => {
  const start = { ...inState('affliction', aff('aff_spooked')), stress: 110 };
  const nearly = relieveStress(start, 60);
  assert.equal(nearly.after, 50);
  assert.equal(nearly.calmed, false);
  assert.equal(nearly.combatant.resolve.id, 'aff_spooked');
  const calmed = relieveStress(start, 61);
  assert.equal(calmed.after, 49);
  assert.equal(calmed.calmed, true);
  assert.equal(calmed.ended.id, 'aff_spooked');
  assert.equal(calmed.combatant.resolve, null);
  assert.deepEqual(calmed.combatant.mods, [], 'its attribute mods go with it');
  assert.equal(effectiveStat(calmed.combatant, 'STR'), 300);
  assert.equal(calmed.mark, null);
  assert.equal(STRESS.CALM_BELOW, 50);
  // Other people's mods are left alone.
  const buffed = { ...start, mods: [...start.mods, { stat: 'STR', mult: 1.2, turns: 3, source: 'val_heroic_pose' }] };
  assert.deepEqual(relieveStress(buffed, 80).combatant.mods, [{ stat: 'STR', mult: 1.2, turns: 3, source: 'val_heroic_pose' }]);
});

test('an Affliction rolled on doubles leaves its Scar when it ends; one rolled otherwise leaves nothing', () => {
  const permanent = { ...inState('affliction', aff('aff_doomsayer'), {}, { permanent: true }), stress: 104 };
  assert.deepEqual(marksOf(permanent), []);
  const ended = rest(permanent, 'night_off');
  assert.equal(ended.mark.id, 'aff_scar_glass_half_empty');
  assert.deepEqual(marksOf(ended.combatant).map((m) => m.id), ['aff_scar_glass_half_empty']);
  assert.equal(reliefMultFor(ended.combatant), 0.8, 'the Scar is the personality, smaller and for good');
  const temporary = { ...inState('affliction', aff('aff_doomsayer')), stress: 104 };
  assert.deepEqual(marksOf(rest(temporary, 'night_off').combatant), []);
});

test('a Virtue lasts until the battle ends: calm does not end it, endBattle does', () => {
  const virtuous = { ...inState('virtue', vir('vir_on_a_roll'), {}, { permanent: true }), stress: 30 };
  const eased = relieveStress(virtuous, 25);
  assert.equal(eased.calmed, false);
  assert.equal(eased.combatant.resolve.id, 'vir_on_a_roll');
  const after = endBattle(eased.combatant, { won: true });
  assert.equal(after.ended.id, 'vir_on_a_roll');
  assert.equal(after.combatant.resolve, null);
  assert.deepEqual(after.combatant.mods, []);
  assert.equal(after.mark.id, SILVER_LINING.id, 'rolled on doubles: it leaves a Silver Lining');
  assert.deepEqual(marksOf(after.combatant).map((m) => m.kind), ['lining']);
  // An Affliction walks out of the battle with its owner.
  const afflicted = { ...inState('affliction', aff('aff_spooked')), stress: 120 };
  assert.equal(endBattle(afflicted).combatant.resolve.id, 'aff_spooked');
});

test('endBattle: a win takes the edge off, per-battle flags reset, and whoever stormed off is back', () => {
  const c = hero(300, { stress: 60, flags: { breakdowns: 1, stormedOff: true, refusedFirst: { heal: true }, mood: { id: 'x', refuses: [] }, airhead: 60 } });
  const won = endBattle(c);
  assert.equal(won.relieved, RELIEF.VICTORY);
  assert.equal(won.combatant.stress, 55);
  assert.deepEqual(won.combatant.flags, { airhead: 60 }, 'other people\'s flags are untouched');
  assert.equal(endBattle(c, { boss: true }).combatant.stress, 45);
  assert.equal(endBattle(c, { won: false }).combatant.stress, 60);
  assert.equal(endBattle(c, { won: false }).relieved, 0);
});

test('clearResolve leaves the bar alone; snapOut drops it to 90 so the next bad moment is a new check', () => {
  const afflicted = { ...inState('affliction', aff('aff_tinfoil_helm')), stress: 150 };
  const cleared = clearResolve(afflicted);
  assert.equal(cleared.combatant.stress, 150);
  assert.equal(cleared.combatant.resolve, null);
  assert.equal(cleared.ended.id, 'aff_tinfoil_helm');
  assert.equal(clearResolve(hero()).ended, null);

  const snapped = snapOut(afflicted);
  assert.equal(snapped.before, 150);
  assert.equal(snapped.after, STRESS.SNAP_OUT_TO);
  assert.equal(snapped.combatant.stress, 90);
  assert.equal(snapped.combatant.resolve, null);
  const next = applyStress(snapped.combatant, 10, { ignoreWill: true });
  assert.equal(next.event, 'resolve', 'the gamble: one more hit and they roll again');
  // Someone already under 90 keeps their stress.
  assert.equal(snapOut({ ...afflicted, stress: 72 }).combatant.stress, 72);
});

// ---------------------------------------------------------------- relief

test('relief is flat: WIL does not touch it, a state can', () => {
  for (const wil of [1, 500, 1000]) assert.equal(relieveStress(hero(300, { stats: { WIL: wil }, stress: 80 }), 15).relieved, 15);
  const doom = { ...inState('affliction', aff('aff_doomsayer')), stress: 120 };
  assert.equal(reliefMultFor(doom), 0.5);
  assert.equal(relieveStress(doom, 15).relieved, 8, 'half of 15, rounded half up');
  assert.equal(relieveStress(doom, 1).relieved, 1, 'relief that lands at all takes at least 1 off');
  assert.equal(relieveStress(hero(300, { stress: 4 }), 15).relieved, 4, 'relieved is what actually left the bar');
  assert.equal(relieveStress(hero(300, { stress: 40 }), 0).relieved, 0);
  assert.equal(relieveStress(hero(300, { stress: 40 }), -5).relieved, 0, 'relieveStress never adds stress');
});

test('a character in a mood refuses comfort from allies, but not rest and not their own breather', () => {
  const tinfoil = { ...inState('affliction', aff('aff_tinfoil_helm')), stress: 120 };
  const acting = actOutCheck(tinfoil, dice([80])).combatant;
  assert.equal(refuses(acting, 'relief'), true);
  const offered = relieveStress(acting, 15);
  assert.equal(offered.refused, true);
  assert.equal(offered.relieved, 0);
  assert.equal(relieveStress(acting, 15, { from: 'rest' }).relieved, 15);
  assert.equal(breather(acting).relieved, RELIEF.BREATHER);
  assert.equal(applyStress(acting, -15).taken, -15, 'an event or the scenery is not an ally');
  // Composed again next turn: the offer is accepted.
  const composed = actOutCheck(acting, dice([10])).combatant;
  assert.equal(relieveStress(composed, 15).relieved, 15);
});

test('the Breather is the universal action: 8 off your own bar, unless your state will not let you', () => {
  assert.equal(RELIEF.BREATHER, 8);
  assert.equal(breather(hero(300, { stress: 70 })).combatant.stress, 62);
  assert.ok(RELIEF.BREATHER < RELIEF.COMFORT && RELIEF.BREATHER < 10, 'the free action is weaker than anything paid for');
  const onARoll = { ...inState('virtue', vir('vir_on_a_roll')), stress: 70 };
  const tried = breather(onARoll);
  assert.equal(tried.refused, true);
  assert.equal(tried.combatant.stress, 70);
});

test('rest: Unwind at camp, a night at the inn, a Night Off in town', () => {
  const afflicted = { ...inState('affliction', aff('aff_spooked')), stress: 130 };
  assert.equal(rest(afflicted, 'unwind').after, 100);
  assert.equal(rest(afflicted, 'inn').after, 105);
  assert.equal(rest(afflicted, 'inn').combatant.resolve.id, 'aff_spooked', 'an inn night does not cure an Affliction on its own');
  const off = rest(afflicted, 'night_off');
  assert.equal(off.after, 0);
  assert.equal(off.combatant.stress, 0);
  assert.equal(off.combatant.resolve, null);
  assert.equal(off.calmed, true);
  assert.throws(() => rest(afflicted, 'spa_day'), /Unknown rest/);
  assert.deepEqual(SERVICES.inn.cost, { fights: 0.5, per: 'head' });
  assert.deepEqual(SERVICES.night_off.cost, { fights: 2, per: 'head' });
  assert.deepEqual(SERVICES.talk_it_out.cost, { levelShare: 1, per: 'scar' });
});

// ---------------------------------------------------------------- marks

test('Scars: no duplicates, three at most, and the player picks which one a fourth pushes out', () => {
  const scars = afflictions.map((e) => e.mark);
  let c = hero();
  for (const scar of scars.slice(0, 3)) c = gainMark(c, scar).combatant;
  assert.deepEqual(marksOf(c).map((m) => m.id), scars.slice(0, 3).map((s) => s.id));
  assert.equal(MARKS.SCAR_CAP, 3);
  const again = gainMark(c, scars[1]);
  assert.equal(again.duplicate, true);
  assert.equal(again.gained, null);
  assert.equal(marksOf(again.combatant).length, 3);
  const oldest = gainMark(c, scars[3]);
  assert.equal(oldest.dropped.id, scars[0].id, 'with no choice made, the oldest goes');
  assert.deepEqual(marksOf(oldest.combatant).map((m) => m.id), [scars[1].id, scars[2].id, scars[3].id]);
  const chosen = gainMark(c, scars[3], { drop: scars[2].id });
  assert.equal(chosen.dropped.id, scars[2].id);
  assert.deepEqual(marksOf(chosen.combatant).map((m) => m.id), [scars[0].id, scars[1].id, scars[3].id]);
  const removed = removeMark(chosen.combatant, scars[0].id);
  assert.equal(removed.removed.id, scars[0].id);
  assert.equal(marksOf(removed.combatant).length, 2);
  assert.equal(removeMark(hero(), 'aff_scar_nope').removed, null);
});

test('a Silver Lining cancels the next Scar, or is spent to erase one already there', () => {
  const lined = gainMark(hero(), SILVER_LINING).combatant;
  assert.deepEqual(marksOf(lined).map((m) => m.kind), ['lining']);
  assert.equal(gainMark(lined, SILVER_LINING).duplicate, true, 'one at a time');
  const cancelled = gainMark(lined, aff('aff_spooked').mark);
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.gained, null);
  assert.deepEqual(marksOf(cancelled.combatant), [], 'both are gone');

  let scarred = gainMark(hero(), aff('aff_spooked').mark).combatant;
  scarred = gainMark(scarred, aff('aff_doomsayer').mark).combatant;
  scarred = gainMark(scarred, SILVER_LINING).combatant;
  assert.equal(marksOf(scarred).length, 3, 'a Lining gained while scarred is held, not spent for you');
  const spent = spendSilverLining(scarred, 'aff_scar_glass_half_empty');
  assert.equal(spent.spent, true);
  assert.deepEqual(marksOf(spent.combatant).map((m) => m.id), ['aff_scar_flinch']);
  assert.equal(spendSilverLining(spent.combatant, 'aff_scar_flinch').spent, false, 'nothing left to spend');
  assert.equal(spendSilverLining(scarred, 'aff_scar_nope').spent, false);
});

test('each Scar does what its text says', () => {
  const scarred = (id) => gainMark(hero(300, { stress: 100 }), aff(id).mark).combatant;
  // No, No, I'm Fine / Trust Issues: the first heal or buff from an ally each battle is wasted.
  const fine = scarred('aff_martyr_complex');
  const first = consumeFirstRefusal(fine, 'heal');
  assert.equal(first.refused, true);
  assert.equal(consumeFirstRefusal(first.combatant, 'heal').refused, false, 'only the first');
  assert.equal(consumeFirstRefusal(fine, 'buff').refused, false);
  assert.equal(consumeFirstRefusal(endBattle(first.combatant).combatant, 'heal').refused, true, 'and again next battle');
  assert.equal(consumeFirstRefusal(scarred('aff_tinfoil_helm'), 'buff').refused, true);
  assert.equal(consumeFirstRefusal(hero(), 'heal').refused, false);
  // Flinch, Glass Half Empty.
  assert.equal(stressMultFor(scarred('aff_spooked'), 'horror'), 1.25);
  assert.equal(relieveStress(scarred('aff_doomsayer'), 15).relieved, 12);
  // Sticky Fingers, Running Commentary: read by the combat loop through effectsOf.
  assert.deepEqual(effectsOf(scarred('aff_loot_goblin'), 'gold'), [{ kind: 'gold', mult: 0.95 }]);
  assert.deepEqual(effectsOf(scarred('aff_backseat_hero'), 'heckle'), [{ kind: 'heckle', on: ['fumble'], stress: 3 }]);
  // Loose Screw: the fumble band is one wider, as a band-edge move on their own attack roll.
  assert.equal(withStateOpts(scarred('aff_lost_the_plot')).fumbleFrom, FUMBLE_FROM - 1);
  assert.equal(GENERIC_SCAR.effects[0].mult, 1.1);
});

// ---------------------------------------------------------------- what a state does in play

test('withStateOpts folds a state into the attack roll as band-edge moves, never as a second roll', () => {
  assert.deepEqual(withStateOpts(hero()), {});
  assert.deepEqual(withStateOpts(hero(), { hitBonus: 15, fumbleFrom: 80 }), { hitBonus: 15, fumbleFrom: 80 });
  const zone = inState('virtue', vir('vir_in_the_zone'));
  assert.deepEqual(withStateOpts(zone), { hitBonus: 15, critBonus: 10, fumbleFrom: 101 });
  assert.deepEqual(withStateOpts(zone, { hitBonus: 5, critBonus: 5, fumbleFrom: 76 }), { hitBonus: 20, critBonus: 15, fumbleFrom: 101 });
  const even = hero();
  assert.deepEqual(hitChance(zone, even, undefined, withStateOpts(zone)), { hitPct: 90, critPct: 15, fumbleFrom: 101 });
  // Dead Centre, its flourish, lifts the hit floor for this turn only.
  const flourishing = actOutCheck(zone, dice([5])).combatant;
  assert.equal(withStateOpts(flourishing).hitFloor, 95);
  assert.equal(hitChance(flourishing, hero(300, { stats: { AGI: 1000, LCK: 1000 } }), undefined, withStateOpts(flourishing)).hitPct, 95);
  assert.equal(withStateOpts(actOutCheck(flourishing, dice([90])).combatant).hitFloor, undefined);
  // Lost the Plot widens the fumble band by 5; a stance that already widened it widens further.
  const lost = inState('affliction', aff('aff_lost_the_plot'));
  assert.equal(withStateOpts(lost).fumbleFrom, 91);
  assert.equal(withStateOpts(lost, { fumbleFrom: 80 }).fumbleFrom, 75);
  // On a Roll's flourish: +20 crit this turn.
  const rolling = actOutCheck(inState('virtue', vir('vir_on_a_roll')), dice([30])).combatant;
  assert.deepEqual(withStateOpts(rolling), { critBonus: 20 });
});

test('refuses and covers: what a personality will not do, and who it stands in front of', () => {
  const onARoll = inState('virtue', vir('vir_on_a_roll'));
  assert.equal(refuses(onARoll, 'guard'), true);
  assert.equal(refuses(onARoll, 'breather'), true);
  assert.equal(refuses(onARoll, 'heal'), false);
  const hen = inState('virtue', vir('vir_mother_hen'));
  assert.equal(covers(hen), 'weakest_ally');
  assert.equal(refuses(hen, 'attack'), false);
  assert.equal(refuses(hen, 'attack', { allyBelow25: true }), true);
  assert.equal(refuses(inState('virtue', vir('vir_second_wind')), 'heal'), true);
  assert.equal(refuses(inState('virtue', vir('vir_in_the_zone')), 'switch_target'), true);
  const goblin = inState('affliction', aff('aff_loot_goblin'));
  assert.equal(refuses(goblin, 'ally_item'), true);
  assert.equal(refuses(goblin, 'ally_skill'), true);
  assert.equal(refuses(inState('affliction', aff('aff_tinfoil_helm')), 'buff'), true);
  assert.equal(refuses(hero(), 'heal'), false);
  assert.equal(covers(hero()), null);
  // A Martyr only shields while acting out.
  const martyr = inState('affliction', aff('aff_martyr_complex'));
  assert.equal(covers(martyr), null);
  const acting = actOutCheck(martyr, dice([75])).combatant;
  assert.equal(covers(acting), 'weakest_ally');
  assert.equal(refuses(acting, 'heal'), true);
  assert.equal(activeEffects(martyr).length, 2);
  // Nobody steps in front of anything on bound legs.
  assert.equal(covers(applyBind(hen, 'legs', 2)), null);
  assert.equal(covers(applyBind(acting, 'legs', 1)), null);
  assert.equal(covers(applyBind(hen, 'arms', 2)), 'weakest_ally');
});

// ---------------------------------------------------------------- the turn check

test('the turn check is one d100: composed, act out, or meltdown on 96-100', () => {
  const tinfoil = { ...inState('affliction', aff('aff_tinfoil_helm')), stress: 110 };
  assert.equal(actOutChance(tinfoil), 30);
  const tally = { composed: 0, act_out: 0, meltdown: 0 };
  for (let roll = 1; roll <= 100; roll++) {
    const rng = counting(dice([roll]));
    const r = actOutCheck(tinfoil, rng);
    assert.equal(rng.calls, 1);
    assert.equal(r.roll, roll);
    assert.equal(r.pct, 30);
    tally[r.outcome]++;
    assert.equal(r.outcome, roll >= 96 ? 'meltdown' : roll > 70 ? 'act_out' : 'composed');
    if (r.outcome === 'composed') {
      assert.equal(r.act, null);
      assert.equal(r.combatant.flags.mood, undefined);
    } else {
      const expected = r.outcome === 'meltdown' ? aff('aff_tinfoil_helm').behavior.meltdown : aff('aff_tinfoil_helm').behavior.act;
      assert.deepEqual(r.act, expected);
      assert.equal(r.combatant.flags.mood.id, expected.id);
      assert.deepEqual(r.combatant.flags.mood.refuses, ['heal', 'relief', 'item']);
    }
  }
  assert.deepEqual(tally, { composed: 70, act_out: 25, meltdown: 5 });
  assert.equal(ACT.MELTDOWN_FROM, FUMBLE_FROM);
});

test('an Affliction acts more often the further over 100 its owner is: +5 per 20 stress, bounded 5..95', () => {
  const at = (stress, entry = aff('aff_tinfoil_helm')) => ({ ...inState('affliction', entry), stress });
  assert.deepEqual([100, 119, 120, 139, 140, 160, 180, 199].map((s) => actOutChance(at(s))), [30, 30, 35, 35, 40, 45, 50, 50]);
  assert.equal(actOutChance(at(60)), 30, 'calmer than 100 but not yet cured: the base chance');
  assert.equal(actOutChance(at(199, aff('aff_lost_the_plot'))), 60);
  assert.equal(actOutChance(at(199), { bonus: 500 }), SCALE.PCT_CEIL);
  assert.equal(actOutChance(at(100), { bonus: -500 }), SCALE.PCT_FLOOR);
  for (const entry of afflictions) for (let stress = 0; stress <= 200; stress += 5) for (const bonus of [-200, 0, 200]) {
    const pct = actOutChance(at(stress, entry), { bonus });
    assert.ok(pct >= SCALE.PCT_FLOOR && pct <= SCALE.PCT_CEIL, `${entry.id} at ${stress}: ${pct}`);
  }
  // At the floor the meltdown band is all that is left.
  const floor = actOutCheck(at(100), dice([95]), { bonus: -500 });
  assert.equal(floor.outcome, 'composed');
  assert.equal(actOutCheck(at(100), dice([96]), { bonus: -500 }).outcome, 'meltdown');
});

test('a Virtue flourishes on a low roll; with no state there is no roll at all', () => {
  const calm = inState('virtue', vir('vir_unflappable'));
  assert.equal(actOutChance(calm), 30);
  const flourish = actOutCheck(calm, dice([30]));
  assert.equal(flourish.outcome, 'flourish');
  assert.equal(flourish.act.partyRelief, 5);
  assert.equal(actOutCheck(calm, dice([31])).outcome, 'steady');
  assert.equal(actOutCheck(calm, dice([100])).outcome, 'steady');
  assert.equal(actOutCheck(calm, dice([31])).act, null);

  const unused = counting(makeRng(1));
  const none = actOutCheck(hero(), unused);
  assert.deepEqual({ roll: none.roll, pct: none.pct, outcome: none.outcome, act: none.act }, { roll: null, pct: 0, outcome: 'none', act: null });
  assert.equal(unused.calls, 0);
  // A personal entry with no behavior (the hero's, as shipped) never rolls either.
  const selfAware = inState('affliction', valerieData.resolve.affliction);
  assert.equal(actOutCheck(selfAware, unused).outcome, 'none');
  assert.equal(unused.calls, 0);
});

test('every act the tables can produce is reachable, and a target "read off the dice" needs no second roll', () => {
  for (const entry of afflictions) {
    const c = { ...inState('affliction', entry), stress: 100 };
    assert.equal(actOutCheck(c, dice([95])).act.id, entry.behavior.act.id);
    assert.equal(actOutCheck(c, dice([96])).act.id, entry.behavior.meltdown.id);
    assert.equal(actOutCheck(c, dice([1])).act, null);
  }
  for (const entry of virtues) assert.equal(actOutCheck(inState('virtue', entry), dice([1])).act.id, entry.behavior.act.id);
  const party = ['a', 'b', 'c'];
  assert.equal(pickByRoll(96, party), 'a');
  assert.equal(pickByRoll(97, party), 'b');
  assert.equal(pickByRoll(98, party), 'c');
  assert.equal(pickByRoll(50, []), null);
  const seen = new Set();
  for (let roll = 71; roll <= 100; roll++) seen.add(pickByRoll(roll, party));
  assert.equal(seen.size, 3);
});

// ---------------------------------------------------------------- Breakdown

test('Breakdown: three choices, and each one sends the bill somewhere different', () => {
  const broken = { ...inState('affliction', aff('aff_backseat_hero'), { hp: 640 }), stress: 200 };
  assert.deepEqual(breakdownChoices(broken), ['storm_off', 'have_it_out', 'bottle_it']);
  assert.deepEqual(BREAKDOWN.CHOICES, ['storm_off', 'have_it_out', 'bottle_it']);

  const storm = breakdown(broken, { choice: 'storm_off' });
  assert.equal(storm.out, true, 'the fight pays: they are gone for the rest of it');
  assert.equal(storm.combatant.flags.stormedOff, true);
  assert.equal(storm.combatant.stress, BREAKDOWN.STORM_STRESS);
  assert.equal(storm.party, null);
  assert.equal(storm.mark, null);

  const row = breakdown(broken, { choice: 'have_it_out' });
  assert.equal(row.out, false);
  assert.equal(row.combatant.stress, BREAKDOWN.STAY_STRESS);
  assert.deepEqual(row.party, { stress: 20, ignoreWill: true, source: 'mental' }, 'the party pays');
  assert.deepEqual(marksOf(row.combatant), []);

  const bottle = breakdown(broken, { choice: 'bottle_it' });
  assert.equal(bottle.out, false);
  assert.equal(bottle.combatant.stress, BREAKDOWN.STAY_STRESS);
  assert.equal(bottle.party, null);
  assert.equal(bottle.mark.id, 'aff_scar_running_commentary', 'the character pays, for good');
  assert.deepEqual(marksOf(bottle.combatant).map((m) => m.id), ['aff_scar_running_commentary']);

  for (const r of [storm, row, bottle]) {
    assert.equal(r.forced, false);
    assert.equal(r.ended.id, 'aff_backseat_hero');
    assert.equal(r.combatant.resolve, null, 'whatever they were in is over');
    assert.deepEqual(r.combatant.mods, []);
    assert.equal(r.combatant.flags.breakdowns, 1);
    assert.equal(r.combatant.hp, 640, 'a Breakdown is never a game over: nobody is killed or removed for good');
    assert.ok(r.combatant.stress < STRESS.RESOLVE_AT, 'and the next crossing of 100 is a fresh Resolve Check');
  }
  assert.throws(() => breakdown(broken, { choice: 'cry' }), /Unknown Breakdown choice/);
  assert.equal(breakdown(broken).choice, 'storm_off', 'the default, for anyone the player is not choosing for');
});

test('Breakdown: a second one in the same battle is not a choice, and Bottling needs a Scar left to take', () => {
  const first = breakdown({ ...hero(), stress: 200 }, { choice: 'have_it_out' }).combatant;
  const second = { ...first, stress: 200 };
  assert.deepEqual(breakdownChoices(second), ['storm_off']);
  const forced = breakdown(second, { choice: 'bottle_it' });
  assert.equal(forced.choice, 'storm_off');
  assert.equal(forced.forced, true);
  assert.equal(forced.out, true);
  // A new battle, a new choice.
  assert.equal(breakdownChoices({ ...endBattle(forced.combatant).combatant, stress: 200 }).length, 3);

  // With no Affliction to scar them, Bottling costs Frayed Nerves.
  const plain = breakdown({ ...hero(), stress: 200 }, { choice: 'bottle_it' });
  assert.equal(plain.mark.id, GENERIC_SCAR.id);
  // Already carrying their Affliction's Scar: Frayed Nerves instead. Carrying both: the option is gone.
  let carrying = gainMark(inState('affliction', aff('aff_spooked')), aff('aff_spooked').mark).combatant;
  carrying = { ...carrying, stress: 200 };
  assert.equal(breakdown(carrying, { choice: 'bottle_it' }).mark.id, GENERIC_SCAR.id);
  const both = { ...gainMark(carrying, GENERIC_SCAR).combatant, stress: 200 };
  assert.deepEqual(breakdownChoices(both), ['storm_off', 'have_it_out']);
  assert.equal(breakdown(both, { choice: 'bottle_it' }).forced, true);
  // A held Silver Lining pays for the Bottle: both vanish.
  const lined = { ...gainMark(inState('affliction', aff('aff_spooked')), SILVER_LINING).combatant, stress: 200 };
  const paid = breakdown(lined, { choice: 'bottle_it' });
  assert.equal(paid.cancelled, true);
  assert.equal(paid.mark, null);
  assert.deepEqual(marksOf(paid.combatant), []);
  // Bottling an Affliction rolled on doubles costs one Scar, not two.
  const doubles = { ...inState('affliction', aff('aff_doomsayer'), {}, { permanent: true }), stress: 200 };
  assert.deepEqual(marksOf(breakdown(doubles, { choice: 'bottle_it' }).combatant).map((m) => m.id), ['aff_scar_glass_half_empty']);
  // The other two choices end a doubles Affliction the ordinary way: it leaves its Scar.
  assert.deepEqual(marksOf(breakdown(doubles, { choice: 'storm_off' }).combatant).map((m) => m.id), ['aff_scar_glass_half_empty']);
});

// ---------------------------------------------------------------- enemies

test('enemies get no Resolve Check: Rattled at 100, Routed at 200, and only the big ones stay to be Routed twice', () => {
  const enemy = (rank, stress) => makeCombatant({ id: 'enemy', level: 50, rank, stats: { AGI: 300, LCK: 300, WIL: 300 }, stress });
  const nothing = enemyStressEvent(enemy('standard', 40), null);
  assert.deepEqual({ status: nothing.status, defeated: nothing.defeated, loseTurn: nothing.loseTurn }, { status: null, defeated: false, loseTurn: false });

  const hit = applyStress(enemy('boss', 95), 12, { source: 'embarrassment', ignoreWill: true });
  assert.equal(hit.event, 'resolve');
  const rattled = enemyStressEvent(hit.combatant, hit.event);
  assert.equal(rattled.status, 'rattled');
  assert.equal(rattled.defeated, false);
  assert.equal(rattled.combatant.resolve.kind, 'rattled');
  // -10 to hit and a fumble band of 91-100, as band-edge moves on its own attack roll.
  assert.deepEqual(withStateOpts(rattled.combatant), { hitBonus: ENEMY_STRESS.RATTLED_HIT_BONUS, fumbleFrom: 91 });
  assert.deepEqual(hitChance(rattled.combatant, hero(), undefined, withStateOpts(rattled.combatant)), { hitPct: 65, critPct: 5, fumbleFrom: 91 });
  // Rattled once: more stress does not rattle it again, and it never takes a turn check.
  assert.equal(applyStress({ ...rattled.combatant, stress: 90 }, 30, { ignoreWill: true }).event, null);
  const unused = counting(makeRng(3));
  assert.equal(actOutCheck(rattled.combatant, unused).outcome, 'none');
  assert.equal(unused.calls, 0);

  // 200: small fry run, and count as beaten.
  for (const rank of ['minion', 'standard']) {
    const routed = enemyStressEvent(enemy(rank, 200), 'breakdown');
    assert.deepEqual({ status: routed.status, defeated: routed.defeated, loseTurn: routed.loseTurn }, { status: 'routed', defeated: true, loseTurn: false });
  }
  // Anything bigger loses an action, drops to 100 and can be pushed there again.
  for (const rank of ['elite', 'boss', 'superboss']) {
    const routed = enemyStressEvent(enemy(rank, 200), 'breakdown');
    assert.deepEqual({ status: routed.status, defeated: routed.defeated, loseTurn: routed.loseTurn }, { status: 'routed', defeated: false, loseTurn: true });
    assert.equal(routed.combatant.stress, ENEMY_STRESS.ROUT_RESET);
    assert.equal(routed.combatant.resolve.kind, 'rattled');
    assert.equal(applyStress(routed.combatant, 100, { ignoreWill: true }).event, 'breakdown');
  }
  // If data/skills.json is there, its status texts must say the same numbers.
  let statuses = null;
  try {
    statuses = readData('skills')?.statuses ?? null;
  } catch {
    statuses = null;
  }
  const text = (id) => statuses?.find((s) => s.id === id)?.text;
  if (text('rattled')) {
    assert.ok(text('rattled').includes('−10 to hit') && text('rattled').includes('91'), 'data/skills.json "rattled" and ENEMY_STRESS disagree');
  }
  if (text('routed')) {
    assert.ok(/minion or standard/i.test(text('routed')) && text('routed').includes('100'), 'data/skills.json "routed" and ENEMY_STRESS disagree');
  }
});

// ---------------------------------------------------------------- purity

test('nothing mutates its input: every function works on deep-frozen combatants and tables', () => {
  const frozenTables = deepFreeze({ afflictions: JSON.parse(JSON.stringify(afflictions)), virtues: JSON.parse(JSON.stringify(virtues)) });
  const personal = deepFreeze(JSON.parse(JSON.stringify(valerieData.resolve)));
  const make = (kind, entry, stress) => {
    let c = { ...inState(kind, entry, {}, { permanent: true }), stress };
    c = gainMark(c, aff('aff_spooked').mark).combatant;
    c = gainMark(c, aff('aff_lost_the_plot').mark).combatant;
    c = applyBind(c, 'head', 2);
    c = actOutCheck(c, dice([kind === 'virtue' ? 1 : 99])).combatant;
    return c;
  };
  const subjects = [hero(300, { stress: 95 }), make('affliction', aff('aff_tinfoil_helm'), 199), make('virtue', vir('vir_second_wind'), 60), make('affliction', aff('aff_doomsayer'), 60)];
  for (const subject of subjects) {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(subject)));
    const snapshot = JSON.stringify(frozen);
    const calls = [
      () => addStress(frozen, 30),
      () => applyStress(frozen, 30, { source: 'horror' }),
      () => applyStress(frozen, 400, { ignoreWill: true }),
      () => applyStress(frozen, -30),
      () => relieveStress(frozen, 200),
      () => relieveStress(frozen, 5, { from: 'rest' }),
      () => breather(frozen),
      () => resolveCheck(frozen, dice([33]), { tables: frozenTables, virtueShift: 10, personal }),
      () => resolveCheck(frozen, dice([22]), { tables: frozenTables, personal }),
      () => forceResolve(frozen, 'affliction', { tables: frozenTables, rng: dice([66]) }),
      () => startResolve(frozen, 'virtue', frozenTables.virtues[4], { permanent: true }),
      () => clearResolve(frozen),
      () => snapOut(frozen),
      () => actOutCheck(frozen, dice([97])),
      () => actOutCheck(frozen, dice([2])),
      () => gainMark(frozen, aff('aff_doomsayer').mark),
      () => gainMark(frozen, aff('aff_backseat_hero').mark, { drop: 'aff_scar_flinch' }),
      () => gainMark(frozen, SILVER_LINING),
      () => removeMark(frozen, 'aff_scar_flinch'),
      () => spendSilverLining(frozen, 'aff_scar_flinch'),
      () => consumeFirstRefusal(frozen, 'heal'),
      () => withStateOpts(frozen, deepFreeze({ hitBonus: 5 })),
      () => breakdown(frozen, { choice: 'storm_off' }),
      () => breakdown(frozen, { choice: 'have_it_out' }),
      () => breakdown(frozen, { choice: 'bottle_it' }),
      () => endBattle(frozen, { boss: true }),
      () => enemyStressEvent(frozen, 'resolve'),
      () => enemyStressEvent(frozen, 'breakdown'),
      () => rest(frozen, 'unwind'),
      () => rest(frozen, 'night_off'),
      () => partyResolveShift([frozen, frozen], 5),
      () => resolveBands(frozenTables, 7),
      () => validateResolveTables(frozenTables),
    ];
    for (const [i, call] of calls.entries()) {
      const result = call();
      if (result && result.combatant) assert.notEqual(result.combatant, frozen, `call ${i} returned its input`);
      assert.equal(JSON.stringify(frozen), snapshot, `call ${i} changed its input`);
    }
  }
  assert.equal(JSON.stringify(frozenTables.afflictions), JSON.stringify(afflictions));
});

test('a state, its marks and its mood survive a trip through makeCombatant', () => {
  let c = resolveCheck(hero(300, { stress: 100 }), dice([66]), { tables }).combatant;
  c = gainMark(c, aff('aff_spooked').mark).combatant;
  c = actOutCheck(c, dice([90])).combatant;
  const rebuilt = makeCombatant(c);
  assert.deepEqual(rebuilt.resolve, c.resolve);
  assert.deepEqual(marksOf(rebuilt), marksOf(c));
  assert.deepEqual(rebuilt.flags.mood, c.flags.mood);
  assert.equal(effectiveStat(rebuilt, 'WIL'), 240);
  assert.equal(refuses(rebuilt, 'heal'), true);
  assert.equal(clearResolve(rebuilt).mark.id, 'aff_scar_trust_issues');
});
