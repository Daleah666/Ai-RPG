import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, STAT_KEYS, BARS, GROWTH, RANK_HP_MULT } from '../engine/constants.js';
import { benchmarkStat } from '../engine/stats.js';
import { readData } from '../engine/data-node.js';
import {
  EXP_CURVE, REFERENCE_FIGHT_ENEMIES, YIELD, RANK_REWARD_MULT, EXP_GAP_SCALE, ARCHETYPE_RULES, PRICE_GUIDE,
  expToNext, totalExpForLevel, levelForExp, expYield, goldYield, levelGapMult, expGain, fightsToLevel,
  growthCurve, statAt, statsAt, budgetAt, validateArchetype,
  maxHp, maxMp, barsAt, hpBudget, mpBudget,
  fightGold, levelGold, wealthAt, priceAt, priceForFights,
} from '../engine/progression.js';

const doc = readData('archetypes');
const archetypes = doc.archetypes;
const byId = Object.fromEntries(archetypes.map((a) => [a.id, a]));
const LEVELS = Array.from({ length: SCALE.LEVEL_MAX }, (_, i) => i + 1);
const RANKS = Object.keys(RANK_HP_MULT);
const total = (stats) => STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
const clone = (value) => JSON.parse(JSON.stringify(value));

// A custom fourth entry of the kind the Director adds for the hero: Luck signature, straight-line growth.
const customHero = {
  id: 'test_knight', name: 'Test Knight', identity: 'Stands in front.', want: 'To help.', cost: 'Cannot aim.',
  signature: 'LCK',
  l1: { STR: 13, INT: 8, AGI: 10, CON: 14, WIL: 9, LCK: 16 },
  l100: { STR: 620, INT: 300, AGI: 460, CON: 720, WIL: 400, LCK: 800 },
  exponent: { STR: 1, INT: 1, AGI: 1, CON: 1, WIL: 1, LCK: 1 },
};

// ---------------------------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------------------------

test('A8: EXP to next level is quadratic in level, with the exported coefficients', () => {
  for (const level of LEVELS.slice(0, 99)) {
    assert.equal(expToNext(level), EXP_CURVE.QUAD * level * level + EXP_CURVE.LIN * level + EXP_CURVE.CONST);
    assert.ok(Number.isInteger(expToNext(level)));
  }
  // A quadratic has a constant second difference and a non-zero leading coefficient.
  assert.ok(EXP_CURVE.QUAD > 0);
  for (let level = 1; level <= 97; level++) {
    assert.equal(expToNext(level + 2) - 2 * expToNext(level + 1) + expToNext(level), 2 * EXP_CURVE.QUAD);
  }
  assert.equal(expToNext(100), 0);
});

test('A8: L1 to L2 costs 100..1,000 and the road to L100 is 10..25 million', () => {
  assert.ok(expToNext(1) >= 100 && expToNext(1) <= 1000, `L1->2 costs ${expToNext(1)}`);
  const whole = totalExpForLevel(100);
  assert.ok(whole >= 10_000_000 && whole <= 25_000_000, `total to L100 is ${whole}`);
  assert.equal(expToNext(1), 800);
  assert.equal(whole, 20_130_000);
});

test('totalExpForLevel is the running sum of expToNext, and levelForExp inverts it for every level', () => {
  let running = 0;
  for (const level of LEVELS) {
    assert.equal(totalExpForLevel(level), running, `cumulative EXP at L${level}`);
    assert.equal(levelForExp(totalExpForLevel(level)), level);
    if (level > 1) assert.equal(levelForExp(totalExpForLevel(level) - 1), level - 1, `one EXP short of L${level}`);
    running += expToNext(level);
  }
  assert.equal(totalExpForLevel(1), 0);
});

test('levelForExp clamps to 1..100 and survives junk input', () => {
  assert.equal(levelForExp(0), 1);
  assert.equal(levelForExp(-500), 1);
  assert.equal(levelForExp(NaN), 1);
  assert.equal(levelForExp(undefined), 1);
  assert.equal(levelForExp(totalExpForLevel(100) * 10), 100);
  assert.equal(levelForExp(Infinity), 100);
  assert.equal(expToNext(0), expToNext(1));
  assert.equal(expToNext(250), 0);
});

test('fights to level: 3..5 at L1, 25..35 at L99, rising all the way', () => {
  assert.ok(fightsToLevel(1) >= 3 && fightsToLevel(1) <= 5, `L1 takes ${fightsToLevel(1)} fights`);
  assert.ok(fightsToLevel(99) >= 25 && fightsToLevel(99) <= 35, `L99 takes ${fightsToLevel(99)} fights`);
  for (let level = 1; level < 99; level++) {
    assert.ok(fightsToLevel(level + 1) > fightsToLevel(level), `fights dipped after L${level}`);
  }
  // The reference fight is four standard enemies of the party's level, full EXP to each member.
  assert.equal(REFERENCE_FIGHT_ENEMIES, 4);
  assert.equal(fightsToLevel(50), expToNext(50) / (4 * expYield(50)));
});

test('yields are integers, rise with enemy level and with rank', () => {
  for (const yieldOf of [expYield, goldYield]) {
    for (const rank of RANKS) {
      for (const level of LEVELS) {
        const value = yieldOf(level, rank);
        assert.ok(Number.isInteger(value) && value >= 1, `${yieldOf.name}(${level}, ${rank}) = ${value}`);
        if (level > 1) assert.ok(value > yieldOf(level - 1, rank), `${yieldOf.name} did not rise at L${level} ${rank}`);
      }
    }
    for (const level of LEVELS) {
      const [minion, standard, elite, boss, superboss] = ['minion', 'standard', 'elite', 'boss', 'superboss'].map((r) => yieldOf(level, r));
      assert.ok(minion < standard && standard < elite && elite < boss && boss < superboss);
      assert.equal(yieldOf(level), standard);
    }
    assert.throws(() => yieldOf(10, 'legendary'), /Unknown rank/);
  }
  assert.equal(expYield(1), YIELD.EXP_PER_LEVEL);
  assert.equal(goldYield(1), YIELD.GOLD_PER_LEVEL);
});

test('elites and bosses pay better per point of HP than standard enemies', () => {
  assert.deepEqual(Object.keys(RANK_REWARD_MULT).sort(), [...RANKS].sort());
  for (const rank of ['elite', 'boss', 'superboss']) {
    assert.ok(RANK_REWARD_MULT[rank] > RANK_HP_MULT[rank], `${rank} reward should beat its HP multiplier`);
  }
  assert.ok(expYield(50, 'elite') >= 3 * expYield(50));
  assert.ok(expYield(50, 'boss') >= 20 * expYield(50));
});

test('enemies below your level are poor value, with no hard cutoff', () => {
  for (const level of LEVELS) {
    assert.equal(levelGapMult(level, level), 1);
    assert.equal(expGain(level, level), expYield(level));
    assert.ok(expGain(level, 1) >= 1, 'even a level-1 enemy is worth something');
  }
  // Fighting up is never penalised.
  assert.equal(levelGapMult(20, 60), 1);
  assert.equal(expGain(20, 60), expYield(60));
  // Half at the gap scale, then a long smooth tail.
  assert.equal(levelGapMult(50, 50 - EXP_GAP_SCALE), 0.5);
  for (let gap = 1; gap <= 59; gap++) {
    assert.ok(levelGapMult(60, 60 - gap) < levelGapMult(60, 60 - gap + 1), `multiplier did not fall at gap ${gap}`);
    assert.ok(levelGapMult(60, 60 - gap) > 0);
    assert.ok(expGain(60, 60 - gap) <= expGain(60, 60 - gap + 1));
  }
  // Ten levels down costs more than twice the fights; thirty down costs more than ten times.
  assert.ok(fightsToLevel(50, 40) > 2 * fightsToLevel(50));
  assert.ok(fightsToLevel(50, 20) > 10 * fightsToLevel(50));
  assert.ok(Number.isFinite(fightsToLevel(100 - 1, 1)));
});

// ---------------------------------------------------------------------------------------------
// Growth curve
// ---------------------------------------------------------------------------------------------

test('growthCurve hits both endpoints exactly for any exponent', () => {
  for (const [l1, l100] of [[8, 300], [16, 800], [10, 600], [12, 760], [1, 1000], [5, 5]]) {
    for (const exponent of [0.5, 0.75, 1, 1.3, 2]) {
      assert.equal(growthCurve(l1, l100, 1, exponent), l1);
      assert.equal(growthCurve(l1, l100, 100, exponent), l100);
      // Levels outside the scale clamp to the ends.
      assert.equal(growthCurve(l1, l100, -4, exponent), l1);
      assert.equal(growthCurve(l1, l100, 140, exponent), l100);
    }
    assert.equal(growthCurve(l1, l100, 1), l1);
    assert.equal(growthCurve(l1, l100, 100), l100);
  }
});

test('growthCurve is an integer and never decreases, whatever the exponent', () => {
  for (const exponent of [0.5, 0.75, 0.9, 1, 1.1, 1.3, 2]) {
    let previous = growthCurve(9, 800, 1, exponent);
    for (const level of LEVELS) {
      const value = growthCurve(9, 800, level, exponent);
      assert.ok(Number.isInteger(value), `exponent ${exponent} L${level} gave ${value}`);
      assert.ok(value >= previous, `exponent ${exponent} went backwards at L${level}`);
      previous = value;
    }
  }
  // Exponent 1 is the straight line; below 1 blooms early, above 1 blooms late.
  assert.equal(growthCurve(10, 600, 50), benchmarkStat(50));
  assert.ok(growthCurve(10, 600, 50, 0.75) > growthCurve(10, 600, 50));
  assert.ok(growthCurve(10, 600, 50, 1.5) < growthCurve(10, 600, 50));
});

test('growthCurve refuses input that cannot meet its contract', () => {
  assert.throws(() => growthCurve(10.5, 600, 50), TypeError);
  assert.throws(() => growthCurve(600, 10, 50), RangeError);
  assert.throws(() => growthCurve(10, 600, 50, 0), RangeError);
  assert.throws(() => growthCurve(10, 600, 50, -1), RangeError);
  assert.throws(() => growthCurve(10, 600, 50, NaN), RangeError);
});

// ---------------------------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------------------------

test('archetypes.json holds exactly warrior, mage and rogue in the agreed shape', () => {
  assert.equal(doc.version, 1);
  assert.deepEqual(archetypes.map((a) => a.id), ['warrior', 'mage', 'rogue']);
  for (const a of archetypes) {
    assert.deepEqual(
      Object.keys(a).sort(),
      ['cost', 'exponent', 'id', 'identity', 'l1', 'l100', 'name', 'signature', 'want'],
      `${a.id} has unexpected fields`,
    );
    for (const block of ['l1', 'l100', 'exponent']) assert.deepEqual(Object.keys(a[block]), STAT_KEYS, `${a.id}.${block}`);
    for (const field of ['identity', 'want', 'cost']) assert.ok(a[field].length > 10, `${a.id}.${field} is too thin`);
  }
});

test('A9: every archetype passes validateArchetype with no warnings', () => {
  for (const a of archetypes) {
    assert.deepEqual(validateArchetype(a), { ok: true, errors: [], warnings: [] }, a.id);
  }
});

test('A9: the budget holds when read back through statsAt', () => {
  for (const a of archetypes) {
    const first = statsAt(a, 1);
    const last = statsAt(a, 100);
    assert.deepEqual(first, a.l1);
    assert.deepEqual(last, a.l100);

    assert.equal(total(first), GROWTH.L1_TOTAL, `${a.id} L1 total`);
    for (const key of STAT_KEYS) assert.ok(first[key] >= 8 && first[key] <= 16, `${a.id} L1 ${key} = ${first[key]}`);

    assert.equal(total(last), GROWTH.L100_TOTAL, `${a.id} L100 total`);
    assert.equal(last[a.signature], GROWTH.SIGNATURE_L100, `${a.id} signature`);
    assert.deepEqual(STAT_KEYS.filter((key) => last[key] === GROWTH.SIGNATURE_L100), [a.signature]);
    for (const key of STAT_KEYS) {
      assert.ok(last[key] >= 300, `${a.id} L100 ${key} = ${last[key]}`);
      if (key !== a.signature) assert.ok(last[key] <= 760, `${a.id} L100 ${key} = ${last[key]}`);
    }
  }
});

test('every attribute of every archetype grows without ever dropping, level 1 to 100', () => {
  for (const a of archetypes) {
    let previous = statsAt(a, 1);
    for (const level of LEVELS) {
      const current = statsAt(a, level);
      for (const key of STAT_KEYS) {
        assert.ok(Number.isInteger(current[key]));
        assert.ok(current[key] >= previous[key], `${a.id} ${key} dropped at L${level}`);
        assert.equal(statAt(a, key, level), current[key]);
      }
      previous = current;
    }
  }
});

test('all three archetypes stay on the same budget line at every level', () => {
  assert.equal(budgetAt(1), GROWTH.L1_TOTAL);
  assert.equal(budgetAt(100), GROWTH.L100_TOTAL);
  for (const a of archetypes) {
    for (const level of LEVELS) {
      const drift = Math.abs(total(statsAt(a, level)) / budgetAt(level) - 1);
      assert.ok(drift < 0.02, `${a.id} is ${(drift * 100).toFixed(1)}% off budget at L${level}`);
    }
  }
});

test('the triangle: warriors are tough and nervous, mages the reverse, rogues quick and fragile', () => {
  for (const level of [1, 50, 100]) {
    const w = statsAt(byId.warrior, level);
    const m = statsAt(byId.mage, level);
    const r = statsAt(byId.rogue, level);
    // Warrior: best body, best blade, worst nerve.
    assert.ok(w.CON > m.CON && w.CON > r.CON && w.STR > m.STR && w.STR > r.STR, `warrior body at L${level}`);
    assert.ok(w.WIL <= m.WIL && w.WIL <= r.WIL, `warrior nerve at L${level}`);
    // Mage: best mind, weak arm, far less body than the warrior.
    assert.ok(m.WIL > w.WIL && m.WIL > r.WIL && m.INT > w.INT && m.INT > r.INT, `mage mind at L${level}`);
    assert.ok(m.STR < w.STR && m.STR < r.STR && m.CON < w.CON, `mage body at L${level}`);
    // Rogue: quickest and luckiest, with neither defence up to the benchmark.
    assert.ok(r.AGI > w.AGI && r.AGI > m.AGI && r.LCK > w.LCK && r.LCK > m.LCK, `rogue speed at L${level}`);
    assert.ok(r.CON < w.CON && r.WIL < m.WIL, `rogue defences at L${level}`);
  }
  const rogue = statsAt(byId.rogue, 100);
  assert.ok(rogue.CON < benchmarkStat(100) && rogue.WIL < benchmarkStat(100));
  assert.deepEqual(archetypes.map((a) => a.signature), ['CON', 'WIL', 'AGI']);
});

test('pacing pre-check: a same-archetype basic-attack duel lasts 6..14 landed hits at every level', () => {
  // The real A2 test lives with combat.js. This one guards the archetype data, and writes both damage formulas
  // out by hand so this file never imports combat.js: the FOUNDATION baseline and the one combat.js ships.
  const basicDamage = {
    baseline: (level, a, d) => (2 * level * a * a) / (a + d),
    shipped: (level, a, d) => (2 * level * 1.5 * a * a) / (2 * a + d),
  };
  for (const [name, damageOf] of Object.entries(basicDamage)) {
    assert.equal(damageOf(50, 302, 302), 50 * 302, `${name}: an even basic attack deals Level x A`);
    const hits = (level, attack, defense, con) => maxHp(level, con) / damageOf(level, attack, defense);
    for (const a of [...archetypes, customHero]) {
      for (const level of LEVELS) {
        const s = statsAt(a, level);
        const physical = hits(level, s.STR, s.CON, s.CON);
        assert.ok(physical >= 6 && physical <= 14, `${name}: ${a.id} STR duel at L${level} takes ${physical.toFixed(1)} hits`);
      }
    }
    // Two mages trading basic-power spells instead of staff blows stay inside the window too.
    for (const level of LEVELS) {
      const s = statsAt(byId.mage, level);
      const magical = hits(level, s.INT, s.WIL, s.CON);
      assert.ok(magical >= 6 && magical <= 14, `${name}: mage INT duel at L${level} takes ${magical.toFixed(1)} hits`);
    }
  }
});

test('a custom fourth archetype goes through the same functions untouched', () => {
  assert.deepEqual(validateArchetype(customHero), { ok: true, errors: [], warnings: [] });
  assert.deepEqual(statsAt(customHero, 1), customHero.l1);
  assert.deepEqual(statsAt(customHero, 100), customHero.l100);
  assert.equal(statAt(customHero, 'LCK', 100), 800);
  // A missing exponent block means straight-line growth.
  const noExponent = clone(customHero);
  delete noExponent.exponent;
  assert.equal(validateArchetype(noExponent).ok, true);
  assert.deepEqual(statsAt(noExponent, 50), statsAt(customHero, 50));
  assert.throws(() => statAt(customHero, 'DEX', 10), /Unknown attribute/);
});

test('validateArchetype rejects a broken archetype and says what is wrong', () => {
  const expectError = (mutate, pattern) => {
    const broken = clone(byId.warrior);
    mutate(broken);
    const result = validateArchetype(broken);
    assert.equal(result.ok, false, `expected a failure matching ${pattern}`);
    assert.ok(result.errors.some((e) => pattern.test(e)), `no error matched ${pattern}: ${JSON.stringify(result.errors)}`);
    return result;
  };

  // The deliberately broken one: a second stat past the cap, a dump stat under the floor, and the total off.
  // Every fault is reported in one pass, each naming the archetype, the attribute and the rule.
  const greedy = expectError((a) => { a.l100.STR = 790; a.l100.INT = 250; }, /l100\.STR is 790, only the signature may be above 760/);
  assert.ok(greedy.errors.some((e) => /l100\.INT is 250, must be at least 300/.test(e)));
  assert.ok(greedy.errors.some((e) => /level 100 attributes total 3280, must total exactly 3300/.test(e)));
  assert.ok(greedy.errors.every((e) => e.startsWith('warrior:')), 'errors should name the archetype');
  assert.equal(greedy.errors.length, 3);

  expectError((a) => { a.l100.LCK += 10; }, /level 100 attributes total 3310, must total exactly 3300/);
  expectError((a) => { a.l100.CON = 780; a.l100.LCK += 20; }, /signature CON is 780 at level 100, must be exactly 800/);
  expectError((a) => { a.l1.STR = 17; a.l1.INT = 6; }, /l1\.STR is 17, must be in 8\.\.16/);
  expectError((a) => { a.l1.STR = 17; a.l1.INT = 6; }, /l1\.INT is 6, must be in 8\.\.16/);
  expectError((a) => { a.l1.LCK += 1; }, /level 1 attributes total 71, must total exactly 70/);
  expectError((a) => { a.signature = 'DEX'; }, /signature must be one of STR, INT, AGI, CON, WIL, LCK/);
  expectError((a) => { a.signature = 'STR'; }, /signature STR is 760 at level 100, must be exactly 800/);
  expectError((a) => { delete a.l100.WIL; }, /l100\.WIL must be an integer/);
  expectError((a) => { a.l1.CON = 16.5; }, /l1\.CON must be an integer/);
  expectError((a) => { a.l100.DEX = 300; }, /l100\.DEX is not an attribute/);
  expectError((a) => { a.exponent.AGI = -1; }, /exponent\.AGI must be a number in 0\.5\.\.2/);
  expectError((a) => { a.exponent.AGI = 5; }, /exponent\.AGI must be a number in 0\.5\.\.2/);
  expectError((a) => { a.want = ''; }, /"want" must be a non-empty string/);
  expectError((a) => { delete a.cost; }, /"cost" must be a non-empty string/);
  expectError((a) => { a.id = 'Big Warrior'; }, /id must be a lowercase snake_case string/);

  for (const junk of [null, undefined, 'warrior', 7, []]) {
    assert.deepEqual(validateArchetype(junk), { ok: false, errors: ['archetype must be an object'], warnings: [] });
  }
  assert.equal(ARCHETYPE_RULES.L100_OFF_SIGNATURE_MAX, 760);
});

test('validateArchetype warns, without failing, when lopsided exponents pull the mid-game off budget', () => {
  const earlyBloomer = clone(byId.warrior);
  for (const key of STAT_KEYS) earlyBloomer.exponent[key] = 0.5;
  const result = validateArchetype(earlyBloomer);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /off the budget line/);

  // One early bloomer balanced by one late bloomer stays quiet.
  const balanced = clone(byId.warrior);
  balanced.exponent.CON = 0.9;
  balanced.exponent.LCK = 1.15;
  assert.deepEqual(validateArchetype(balanced), { ok: true, errors: [], warnings: [] });
});

// ---------------------------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------------------------

test('A3: HP reaches a million at L100 / CON 1000 and starts in the low hundreds', () => {
  assert.ok(maxHp(100, 1000) >= 1_000_000);
  assert.ok(maxHp(1, 10) >= 1 && maxHp(1, 10) <= 300, `maxHp(1, 10) = ${maxHp(1, 10)}`);
  assert.equal(maxHp(100, 1000), 1_000_000);
  assert.equal(maxHp(1, 10), 100);
  assert.equal(maxMp(100, 1000), 100_000);
  assert.equal(maxMp(1, 10), 10);
});

test('bars follow the baseline, are integers, and rise with level and attribute', () => {
  for (const level of [1, 2, 10, 37, 50, 99, 100]) {
    for (const stat of [1, 8, 16, 153, 600, 800, 1000]) {
      assert.equal(maxHp(level, stat), BARS.HP_PER_CON_PER_LEVEL * level * stat);
      assert.equal(maxMp(level, stat), BARS.MP_PER_WIL_PER_LEVEL * level * stat);
      if (level < 100) assert.ok(maxHp(level + 1, stat) > maxHp(level, stat) && maxMp(level + 1, stat) > maxMp(level, stat));
      if (stat < 1000) assert.ok(maxHp(level, stat + 1) > maxHp(level, stat) && maxMp(level, stat + 1) > maxMp(level, stat));
    }
  }
  // Out-of-range input is clamped onto the scale rather than extrapolated.
  assert.equal(maxHp(100, 5000), maxHp(100, 1000));
  assert.equal(maxHp(400, 1000), maxHp(100, 1000));
  assert.equal(maxMp(0, 0), 1);
});

test('enemy ranks multiply HP by RANK_HP_MULT, and a boss reaches the millions', () => {
  for (const rank of RANKS) {
    for (const [level, con] of [[1, 10], [10, 64], [50, 302], [100, 600], [100, 1000]]) {
      const hp = maxHp(level, con, rank);
      assert.ok(Number.isInteger(hp) && hp >= 1);
      assert.equal(hp, Math.round(maxHp(level, con) * RANK_HP_MULT[rank]), `${rank} at L${level}`);
    }
  }
  assert.equal(maxHp(50, 300, 'minion'), 60_000);
  assert.equal(maxHp(50, 300), 150_000);
  assert.equal(maxHp(50, 300, 'elite'), 450_000);
  assert.equal(maxHp(50, 300, 'boss'), 3_000_000);
  assert.equal(maxHp(50, 300, 'superboss'), 9_000_000);
  assert.ok(hpBudget(50, 'boss') >= 1_000_000, 'a mid-game boss is already in the millions');
  assert.ok(hpBudget(100, 'boss') >= 10_000_000);
  assert.equal(maxHp(100, 1000, 'superboss'), 60_000_000);
  assert.throws(() => maxHp(10, 100, 'legendary'), /Unknown rank/);
});

test('mpBudget and hpBudget are the bars at the benchmark attribute', () => {
  for (const level of LEVELS) {
    assert.equal(mpBudget(level), maxMp(level, benchmarkStat(level)));
    assert.equal(hpBudget(level), maxHp(level, benchmarkStat(level)));
    if (level > 1) assert.ok(mpBudget(level) > mpBudget(level - 1));
  }
  assert.equal(mpBudget(1), 10);
  assert.equal(mpBudget(100), 60_000);
  assert.equal(hpBudget(100), 600_000);
});

test('archetype bars at L1, L50 and L100 match the published table', () => {
  const table = {
    warrior: { 1: [160, 9], 50: [202_000, 7_650], 100: [800_000, 30_000] },
    mage: { 1: [100, 16], 50: [121_500, 20_200], 100: [480_000, 80_000] },
    rogue: { 1: [100, 9], 50: [116_500, 10_150], 100: [460_000, 40_000] },
  };
  for (const a of archetypes) {
    for (const level of [1, 50, 100]) {
      const [hp, mp] = table[a.id][level];
      assert.deepEqual(barsAt(a, level), { maxHp: hp, maxMp: mp }, `${a.id} at L${level}`);
    }
  }
  // The warrior has the deepest HP bar and the shallowest MP bar; the mage owns MP.
  const [w, m, r] = ['warrior', 'mage', 'rogue'].map((id) => barsAt(byId[id], 100));
  assert.ok(w.maxHp > m.maxHp && m.maxHp > r.maxHp);
  assert.ok(m.maxMp > r.maxMp && r.maxMp > w.maxMp);
});

// ---------------------------------------------------------------------------------------------
// Gold and prices
// ---------------------------------------------------------------------------------------------

test('wealth starts at zero and grows by one level of gold per level', () => {
  assert.equal(wealthAt(1), 0);
  for (let level = 1; level < 100; level++) {
    assert.equal(wealthAt(level + 1) - wealthAt(level), levelGold(level));
    assert.ok(levelGold(level + 1) > levelGold(level));
    assert.ok(fightGold(level + 1) > fightGold(level));
    // A level's gold is the reference fights it takes, times the gold of one fight.
    assert.ok(Math.abs(levelGold(level) - fightsToLevel(level) * fightGold(level)) < 1e-6);
  }
  assert.equal(fightGold(10), REFERENCE_FIGHT_ENEMIES * goldYield(10));
  assert.equal(wealthAt(100), 4_026_000);
  assert.ok(levelGold(100) > levelGold(99), 'prices still exist at the level cap');
});

test('priceAt is a share of one level of gold; priceForFights is a number of fights', () => {
  for (const level of LEVELS) {
    assert.equal(priceAt(level, 1), levelGold(level));
    assert.equal(priceAt(level, 0), 0);
    assert.equal(priceForFights(level, 1), fightGold(level));
    assert.ok(Number.isInteger(priceAt(level, 0.37)) && priceAt(level, 0.37) >= 1);
    assert.ok(priceAt(level, 0.5) < priceAt(level, 0.75));
    if (level > 1) assert.ok(priceAt(level, 0.25) > priceAt(level - 1, 0.25));
  }
  assert.equal(priceAt(50, 0.5), levelGold(50) / 2);
  assert.equal(priceAt(1, 0.0001), 1, 'anything with a price costs at least 1 gold');
  assert.throws(() => priceAt(10, -0.5), RangeError);
  assert.throws(() => priceAt(10, NaN), RangeError);
  assert.throws(() => priceForFights(10, 'two'), RangeError);
});

test('economy targets: a recovery item every fight or two, a major purchase every 2..3 levels', () => {
  for (const level of LEVELS) {
    const potion = priceForFights(level, PRICE_GUIDE.BASIC_RECOVERY_FIGHTS);
    // One potion per fight takes no more than half of the fight's gold; one per two fights, a quarter.
    assert.ok(potion <= fightGold(level) / 2, `potion at L${level} costs ${potion}`);
    assert.ok(potion >= fightGold(level) / 4);
  }
  // Saving between a third and a half of what it earns, a party affords a level-appropriate major purchase
  // by the end of its third level of saving, and never from a single level's savings.
  for (let level = 1; level <= 98; level++) {
    const price = priceAt(level, PRICE_GUIDE.MAJOR_PURCHASE_SHARE);
    const threeLevels = levelGold(level) + levelGold(level + 1) + levelGold(level + 2);
    assert.ok(threeLevels / 3 >= price, `saving a third is too slow at L${level}`);
    assert.ok(levelGold(level) / 2 < price, `one level of half-savings should not be enough at L${level}`);
  }
});
