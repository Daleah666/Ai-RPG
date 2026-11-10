import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, STAT_KEYS, GROWTH } from '../engine/constants.js';
import { makeRng, fixedRolls, d100, clampPct, contestPct, readRoll, check, pickWeighted } from '../engine/rng.js';
import { makeCombatant, effectiveStat, effectiveStats, benchmarkStat, difficultyDc, modMultiplier } from '../engine/stats.js';

test('d100 stays in 1..100 and is repeatable from a seed', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 5000; i++) {
    const roll = d100(a);
    assert.ok(roll >= 1 && roll <= 100);
    assert.equal(roll, d100(b));
  }
});

test('fixedRolls replays exactly the rolls it was given', () => {
  const rng = fixedRolls([1, 50, 100]);
  assert.deepEqual([d100(rng), d100(rng), d100(rng)], [1, 50, 100]);
  assert.throws(() => d100(rng));
});

test('fixedRolls replays every face of the die exactly', () => {
  const faces = Array.from({ length: 100 }, (_, i) => i + 1);
  const rng = fixedRolls(faces);
  assert.deepEqual(faces.map(() => d100(rng)), faces);
});

test('A1: contestPct is bounded for every corner of the attribute range', () => {
  for (const stat of [1, 10, 500, 1000]) {
    for (const dc of [1, 10, 500, 1000]) {
      const pct = contestPct(stat, dc);
      assert.ok(pct >= SCALE.PCT_FLOOR && pct <= SCALE.PCT_CEIL, `${stat} vs ${dc} gave ${pct}`);
    }
  }
  assert.equal(contestPct(300, 300), 50);
  assert.equal(contestPct(600, 300), 70);
  assert.equal(contestPct(300, 600), 30);
  assert.equal(contestPct(1000, 1), 95);
  assert.equal(contestPct(1, 1000), 5);
});

test('clampPct honours a moved floor or ceiling', () => {
  assert.equal(clampPct(99), 95);
  assert.equal(clampPct(99, 5, 55), 55);
  assert.equal(clampPct(-3), 5);
});

test('readRoll: fumble beats crit beats hit beats miss', () => {
  const bands = { pct: 70, critPct: 10 };
  assert.equal(readRoll(1, bands), 'crit');
  assert.equal(readRoll(10, bands), 'crit');
  assert.equal(readRoll(11, bands), 'hit');
  assert.equal(readRoll(70, bands), 'hit');
  assert.equal(readRoll(71, bands), 'miss');
  assert.equal(readRoll(95, bands), 'miss');
  assert.equal(readRoll(96, bands), 'fumble');
  // A widened fumble band eats the top of the hit range.
  assert.equal(readRoll(80, { pct: 90, critPct: 5, fumbleFrom: 76 }), 'fumble');
  // Crit chance can never exceed the chance to hit at all.
  assert.equal(readRoll(20, { pct: 15, critPct: 40 }), 'miss');
});

test('check reports its roll, and 96+ always fails', () => {
  assert.equal(check(95, fixedRolls([96])).success, false);
  assert.equal(check(95, fixedRolls([96])).degree, 'fumble');
  assert.equal(check(50, fixedRolls([5])).degree, 'crit');
  assert.equal(check(50, fixedRolls([50])).degree, 'hit');
  assert.equal(check(50, fixedRolls([51])).degree, 'miss');
});

test('pickWeighted respects weights', () => {
  const rng = makeRng(7);
  const counts = { a: 0, b: 0 };
  const table = [{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }];
  for (let i = 0; i < 20000; i++) counts[pickWeighted(rng, table).id]++;
  const share = counts.a / 20000;
  assert.ok(share > 0.73 && share < 0.77, `a share was ${share}`);
});

test('benchmark line runs 10 to 600 and difficulties scale off it', () => {
  assert.equal(benchmarkStat(1), 10);
  assert.equal(benchmarkStat(100), 600);
  assert.ok(benchmarkStat(50) > 295 && benchmarkStat(50) < 310);
  assert.equal(difficultyDc(100, 'normal'), 600);
  assert.equal(difficultyDc(100, 'easy'), 300);
  assert.equal(difficultyDc(100, 'heroic'), 1000);
  assert.throws(() => difficultyDc(10, 'spicy'));
});

test('makeCombatant fills every field and clamps attributes', () => {
  const c = makeCombatant({ id: 'x', stats: { STR: 5000, LCK: -4 } });
  assert.equal(c.stats.STR, 1000);
  assert.equal(c.stats.LCK, 1);
  for (const key of STAT_KEYS) assert.ok(Number.isInteger(c.stats[key]));
  assert.deepEqual(c.binds, { head: 0, arms: 0, legs: 0 });
  assert.equal(c.stress, 0);
});

test('buff multipliers combine and clamp to 0.5..1.5', () => {
  const c = makeCombatant({
    stats: { STR: 400 },
    mods: [{ stat: 'STR', mult: 1.3, turns: 3 }, { stat: 'STR', mult: 1.3, turns: 3 }],
  });
  assert.equal(modMultiplier(c, 'STR'), 1.5);
  assert.equal(effectiveStat(c, 'STR'), 600);
  c.mods.push({ stat: 'STR', mult: 0.1, turns: 2 });
  assert.equal(modMultiplier(c, 'STR'), 0.5);
  // An expired mod no longer counts.
  const d = makeCombatant({ stats: { STR: 400 }, mods: [{ stat: 'STR', mult: 1.5, turns: 0 }] });
  assert.equal(effectiveStat(d, 'STR'), 400);
});

test('A10: a bind halves its attributes once, and only its attributes', () => {
  const c = makeCombatant({ stats: { STR: 801, INT: 600, AGI: 500, CON: 700, WIL: 300, LCK: 200 }, binds: { arms: 2 } });
  assert.equal(effectiveStat(c, 'STR'), 400);
  assert.equal(effectiveStat(c, 'INT'), 600);
  c.binds.head = 1;
  c.binds.legs = 1;
  assert.deepEqual(effectiveStats(c), { STR: 400, INT: 300, AGI: 250, CON: 700, WIL: 150, LCK: 200 });
});

test('effective attributes never leave 1..1000', () => {
  const hi = makeCombatant({ stats: { STR: 1000 }, mods: [{ stat: 'STR', mult: 1.5, turns: 1 }] });
  assert.equal(effectiveStat(hi, 'STR'), 1000);
  const lo = makeCombatant({ stats: { STR: 1 }, mods: [{ stat: 'STR', mult: 0.5, turns: 1 }], binds: { arms: 1 } });
  assert.equal(effectiveStat(lo, 'STR'), 1);
});

test('the growth budget in constants is self-consistent', () => {
  assert.equal(GROWTH.SIGNATURE_L100 + GROWTH.GEAR_HEADROOM, SCALE.STAT_MAX);
  assert.ok(GROWTH.L100_TOTAL / STAT_KEYS.length < GROWTH.SIGNATURE_L100);
});
