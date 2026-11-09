import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, BARS, GROWTH, FUMBLE_FROM } from '../engine/constants.js';
import { makeRng, fixedRolls } from '../engine/rng.js';
import { makeCombatant, benchmarkStat } from '../engine/stats.js';
import {
  BASIC_ATTACK, HIT_BASE, CRIT_BASE, CRIT_FLOOR, CRIT_CAP, CRIT_MULT, GUARD_MULT, DEF_WEIGHT, EVEN_PASS,
  VARIANCE, HEAL_SCALE, STRESS_K, STRESS_MIT_CAP, INIT_SCALE, INIT_SPREAD,
  hitChance, rollAttack, affinityOf, damage, resolveAttack, healAmount, stressTaken, initiative,
  expectedDamage, hitsToKill, passThrough, stressMitigation, rollVariance, attackStatOf, defenseStatOf,
} from '../engine/combat.js';

// ---------------------------------------------------------------- fixtures

const CORNERS = [1, 10, 500, 1000];
const LEVELS = [1, 50, 100];

/** A combatant with every attribute set to `all`, then overridden. */
function fighter(level, all, stats = {}, extra = {}) {
  const base = { STR: all, INT: all, AGI: all, CON: all, WIL: all, LCK: all };
  return makeCombatant({ level, stats: { ...base, ...stats }, ...extra });
}

// Stand-in stat line until data/archetypes.json exists: a signature attribute of 14 at L1 rising to 800 at L100.
const SIGNATURE_L1 = 14;
const signatureStat = (level) => Math.round(SIGNATURE_L1 + ((GROWTH.SIGNATURE_L100 - SIGNATURE_L1) * (level - 1)) / 99);
const baselineHp = (level, con) => BARS.HP_PER_CON_PER_LEVEL * level * con;

/** Wrap an rng so a test can count how many times it was used. */
function counting(rng) {
  const wrapped = () => {
    wrapped.calls++;
    return rng();
  };
  wrapped.calls = 0;
  return wrapped;
}

const FIRE = { id: 'mag_test_fire', type: 'magical', stat: 'INT', power: 4, acc: 0, crit: 0, element: 'fire', part: 'head' };

// ---------------------------------------------------------------- shape

test('BASIC_ATTACK is a frozen skill in the FOUNDATION shape', () => {
  assert.equal(BASIC_ATTACK.power, 2);
  assert.equal(BASIC_ATTACK.stat, 'STR');
  assert.equal(BASIC_ATTACK.type, 'physical');
  assert.equal(BASIC_ATTACK.element, 'phys');
  assert.equal(BASIC_ATTACK.part, 'arms');
  assert.ok(BASIC_ATTACK.tags.includes('melee'));
  assert.deepEqual(BASIC_ATTACK.cost, { mp: 0, limit: 0 });
  assert.equal(BASIC_ATTACK.acc, 0);
  assert.equal(BASIC_ATTACK.crit, 0);
  assert.ok(Object.isFrozen(BASIC_ATTACK));
  assert.equal(attackStatOf(BASIC_ATTACK), 'STR');
  assert.equal(defenseStatOf(BASIC_ATTACK), 'CON');
  assert.equal(defenseStatOf(FIRE), 'WIL');
  assert.equal(attackStatOf({ type: 'magical' }), 'INT');
  assert.equal(defenseStatOf({ type: 'physical', stat: 'AGI' }), 'CON');
});

// ---------------------------------------------------------------- A1: bounded chances

test('A1: hit chance stays in 5..95 and crit in 1..50 for every attribute corner and any skill.acc', () => {
  let lowest = 100;
  let highest = 0;
  for (const aAgi of CORNERS) for (const aLck of CORNERS) for (const dAgi of CORNERS) for (const dLck of CORNERS) {
    const attacker = fighter(50, 300, { AGI: aAgi, LCK: aLck });
    const defender = fighter(50, 300, { AGI: dAgi, LCK: dLck });
    for (let acc = -50; acc <= 50; acc++) {
      const { hitPct, critPct, fumbleFrom } = hitChance(attacker, defender, { ...BASIC_ATTACK, acc, crit: acc });
      const where = `AGI ${aAgi}/LCK ${aLck} vs AGI ${dAgi}/LCK ${dLck}, acc ${acc}`;
      assert.ok(Number.isInteger(hitPct) && Number.isInteger(critPct), where);
      assert.ok(hitPct >= SCALE.PCT_FLOOR && hitPct <= SCALE.PCT_CEIL, `${where}: hit ${hitPct}`);
      assert.ok(critPct >= CRIT_FLOOR && critPct <= CRIT_CAP, `${where}: crit ${critPct}`);
      assert.ok(critPct <= hitPct, `${where}: crit ${critPct} above hit ${hitPct}`);
      assert.equal(fumbleFrom, FUMBLE_FROM);
      lowest = Math.min(lowest, hitPct);
      highest = Math.max(highest, hitPct);
    }
  }
  // Both ends of the window are actually reachable.
  assert.equal(lowest, 5);
  assert.equal(highest, 95);
});

test('A1: with no skill modifier the worst mismatch still hits about a third of the time', () => {
  const ace = fighter(100, 1000);
  const oaf = fighter(1, 1);
  assert.deepEqual(hitChance(oaf, ace), { hitPct: 35, critPct: 1, fumbleFrom: 96 });
  assert.deepEqual(hitChance(ace, oaf), { hitPct: 95, critPct: 25, fumbleFrom: 96 });
});

test('hit and crit anchors: 75/5 when even, bounded swing either way', () => {
  const even = fighter(50, 300);
  assert.deepEqual(hitChance(even, even), { hitPct: HIT_BASE, critPct: CRIT_BASE, fumbleFrom: 96 });
  // ACC = AGI + LCK/2. Double accuracy is +13, half is -13.
  assert.equal(hitChance(fighter(50, 600), even).hitPct, 88);
  assert.equal(hitChance(even, fighter(50, 600)).hitPct, 62);
  // ACC 750 vs EVA 450 for doubled AGI; ACC 600 vs EVA 450 for doubled LCK, which counts half as much.
  assert.equal(hitChance(fighter(50, 300, { AGI: 600 }), even).hitPct, 85);
  assert.equal(hitChance(fighter(50, 300, { LCK: 600 }), even).hitPct, 81);
  // Crit follows LCK alone.
  assert.equal(hitChance(fighter(50, 300, { LCK: 600 }), even).critPct, 12);
  assert.equal(hitChance(fighter(50, 300, { LCK: 150 }), even).critPct, 1);
  assert.equal(hitChance(fighter(50, 300, { AGI: 900 }), even).critPct, 5);
  // skill.acc and skill.crit are flat points.
  assert.equal(hitChance(even, even, { ...BASIC_ATTACK, acc: -20, crit: 15 }).hitPct, 55);
  assert.equal(hitChance(even, even, { ...BASIC_ATTACK, acc: -20, crit: 15 }).critPct, 20);
  // The skill argument is optional.
  assert.deepEqual(hitChance(even, even, undefined), hitChance(even, even, BASIC_ATTACK));
});

// ---------------------------------------------------------------- opts knobs

test('opts.hitBonus adds flat points before the clamp, in either direction', () => {
  const even = fighter(50, 300);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitBonus: 10 }).hitPct, 85);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitBonus: -10 }).hitPct, 65);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitBonus: 500 }).hitPct, 95);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitBonus: -500 }).hitPct, 5);
});

test('opts.hitFloor and opts.hitCap move the window', () => {
  const even = fighter(50, 300);
  const wild = { ...BASIC_ATTACK, acc: -50 };
  assert.equal(hitChance(even, even, wild).hitPct, 25);
  assert.equal(hitChance(even, even, wild, { hitFloor: 40 }).hitPct, 40);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitCap: 55 }).hitPct, 55);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitBonus: 500, hitCap: 100 }).hitPct, 100);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitBonus: -500, hitFloor: 0 }).hitPct, 0);
  // A floor above the cap wins.
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitFloor: 80, hitCap: 60 }).hitPct, 80);
  // null means "not set".
  assert.equal(hitChance(even, even, BASIC_ATTACK, { hitFloor: null, hitCap: null }).hitPct, 75);
});

test('opts.critBonus widens the crit band, which never passes the hit chance or 50', () => {
  const even = fighter(50, 300);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { critBonus: 10 }).critPct, 15);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { critBonus: -10 }).critPct, 1);
  assert.equal(hitChance(even, even, BASIC_ATTACK, { critBonus: 400 }).critPct, 50);
  assert.deepEqual(hitChance(even, even, BASIC_ATTACK, { critBonus: 40, hitCap: 10 }), { hitPct: 10, critPct: 10, fumbleFrom: 96 });
});

test('opts.fumbleFrom moves the fumble band and eats the top of the hit range', () => {
  const ace = fighter(50, 900);
  const oaf = fighter(50, 100);
  assert.equal(hitChance(ace, oaf).hitPct, 95);
  assert.equal(hitChance(ace, oaf, BASIC_ATTACK, { fumbleFrom: 76 }).fumbleFrom, 76);
  assert.equal(rollAttack(ace, oaf, BASIC_ATTACK, fixedRolls([80])).outcome, 'hit');
  assert.equal(rollAttack(ace, oaf, BASIC_ATTACK, fixedRolls([80]), { fumbleFrom: 76 }).outcome, 'fumble');
  assert.equal(rollAttack(ace, oaf, BASIC_ATTACK, fixedRolls([75]), { fumbleFrom: 76 }).outcome, 'hit');
  // 101 switches fumbles off; a roll of 1 can never fumble.
  assert.equal(rollAttack(ace, oaf, BASIC_ATTACK, fixedRolls([100]), { fumbleFrom: 101 }).outcome, 'miss');
  assert.equal(hitChance(ace, oaf, BASIC_ATTACK, { fumbleFrom: 999 }).fumbleFrom, 101);
  assert.equal(hitChance(ace, oaf, BASIC_ATTACK, { fumbleFrom: -5 }).fumbleFrom, 2);
  assert.equal(rollAttack(ace, oaf, BASIC_ATTACK, fixedRolls([1]), { fumbleFrom: -5 }).outcome, 'crit');
});

test('opts.damageMult scales damage in damage() and through resolveAttack()', () => {
  const a = fighter(50, 400);
  const d = fighter(50, 400);
  assert.equal(damage(a, d, BASIC_ATTACK), 20000);
  assert.equal(damage(a, d, BASIC_ATTACK, { damageMult: 2 }), 40000);
  assert.equal(damage(a, d, BASIC_ATTACK, { damageMult: 0.25 }), 5000);
  assert.equal(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([50]), { variance: 1, damageMult: 2 }).damage, 40000);
  // A multiplier of zero still leaves the 1-point minimum: use a 'null' affinity to negate a hit outright.
  assert.equal(damage(a, d, BASIC_ATTACK, { damageMult: 0 }), 1);
  assert.equal(damage(a, d, BASIC_ATTACK, { damageMult: -3 }), 1);
});

// ---------------------------------------------------------------- the d100

test('rollAttack reads one d100 against the bands: crit, hit, miss, fumble', () => {
  const even = fighter(50, 300);
  const read = (roll, opts) => rollAttack(even, even, BASIC_ATTACK, fixedRolls([roll]), opts);
  assert.deepEqual(read(1), { roll: 1, hitPct: 75, critPct: 5, fumbleFrom: 96, outcome: 'crit' });
  assert.equal(read(5).outcome, 'crit');
  assert.equal(read(6).outcome, 'hit');
  assert.equal(read(75).outcome, 'hit');
  assert.equal(read(76).outcome, 'miss');
  assert.equal(read(95).outcome, 'miss');
  assert.equal(read(96).outcome, 'fumble');
  assert.equal(read(100).outcome, 'fumble');
  // At the 95 cap there is no plain miss left: 96+ is always a fumble.
  assert.equal(read(95, { hitBonus: 100 }).outcome, 'hit');
  assert.equal(read(96, { hitBonus: 100 }).outcome, 'fumble');
});

test('one d100 per attack: rollAttack uses the rng once, resolveAttack once more only for variance', () => {
  const even = fighter(50, 300);
  const once = counting(makeRng(5));
  rollAttack(even, even, BASIC_ATTACK, once);
  assert.equal(once.calls, 1);

  const onMiss = counting(fixedRolls([90]));
  assert.equal(resolveAttack(even, even, BASIC_ATTACK, onMiss).outcome, 'miss');
  assert.equal(onMiss.calls, 1);

  const onFumble = counting(fixedRolls([99]));
  assert.equal(resolveAttack(even, even, BASIC_ATTACK, onFumble).outcome, 'fumble');
  assert.equal(onFumble.calls, 1);

  const onHit = counting(fixedRolls([40, 50]));
  assert.equal(resolveAttack(even, even, BASIC_ATTACK, onHit).outcome, 'hit');
  assert.equal(onHit.calls, 2);

  const fixedVariance = counting(fixedRolls([40]));
  assert.equal(resolveAttack(even, even, BASIC_ATTACK, fixedVariance, { variance: 1 }).variance, 1);
  assert.equal(fixedVariance.calls, 1);
});

test('resolveAttack reports everything and draws variance after the attack roll', () => {
  const a = fighter(50, 400);
  const d = fighter(50, 400);
  assert.deepEqual(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([40, 50])), {
    outcome: 'hit', roll: 40, hitPct: 75, critPct: 5, fumbleFrom: 96, affinity: 'normal', variance: 1, damage: 20000, absorbed: false,
  });
  assert.deepEqual(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([3, 1])), {
    outcome: 'crit', roll: 3, hitPct: 75, critPct: 5, fumbleFrom: 96, affinity: 'normal', variance: 0.9, damage: 27000, absorbed: false,
  });
  assert.equal(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([40, 100])).variance, 1.1);
  assert.equal(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([40, 100])).damage, 22000);
  assert.deepEqual(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([80])), {
    outcome: 'miss', roll: 80, hitPct: 75, critPct: 5, fumbleFrom: 96, affinity: 'normal', variance: 1, damage: 0, absorbed: false,
  });
  assert.equal(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([97])).damage, 0);
  // Guard is passed through opts.
  assert.equal(resolveAttack(a, d, BASIC_ATTACK, fixedRolls([40, 50]), { guard: true }).damage, 10000);
});

test('variance is 0.90..1.10 in whole percents', () => {
  const rng = makeRng(11);
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const v = rollVariance(rng);
    assert.ok(v >= VARIANCE.MIN && v <= VARIANCE.MAX, `variance ${v}`);
    assert.ok(Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, `variance ${v} is not a whole percent`);
    seen.add(Math.round(v * 100));
  }
  assert.equal(seen.size, 21);
  assert.ok(seen.has(90) && seen.has(110));
});

test('seeded determinism: the same seed replays the same fight, a different seed does not', () => {
  const a = fighter(50, 350, { STR: 403, LCK: 420 });
  const d = fighter(50, 300, { CON: 330 });
  const run = (seed) => {
    const rng = makeRng(seed);
    return Array.from({ length: 300 }, () => resolveAttack(a, d, BASIC_ATTACK, rng));
  };
  assert.deepEqual(run(2024), run(2024));
  assert.notDeepEqual(run(2024), run(2025));
  const outcomes = new Set(run(2024).map((r) => r.outcome));
  assert.deepEqual([...outcomes].sort(), ['crit', 'fumble', 'hit', 'miss']);
});

test('resolveAttack is pure: neither combatant changes', () => {
  const a = fighter(50, 400, {}, { mods: [{ stat: 'STR', mult: 1.2, turns: 2 }], binds: { legs: 1 } });
  const d = fighter(50, 400, {}, { hp: 1234, maxHp: 5000, stress: 40, affinities: { phys: 'weak' } });
  const before = structuredClone({ a, d });
  const rng = makeRng(9);
  for (let i = 0; i < 200; i++) resolveAttack(a, d, BASIC_ATTACK, rng, { guard: i % 2 === 0 });
  damage(a, d, BASIC_ATTACK, { crit: true });
  expectedDamage(a, d, BASIC_ATTACK);
  hitsToKill(a, d, BASIC_ATTACK);
  assert.deepEqual({ a, d }, before);
});

// ---------------------------------------------------------------- A4: damage shape

test('A4: damage never falls as the attacking attribute rises, never rises as the defending one does, never negative', () => {
  for (const [skill, atkKey, defKey] of [[BASIC_ATTACK, 'STR', 'CON'], [FIRE, 'INT', 'WIL']]) {
    for (const level of LEVELS) {
      for (const fixed of CORNERS) {
        const attacker = fighter(level, 300);
        const defender = fighter(level, 300);
        // Sweep the attacker against a fixed defense.
        defender.stats[defKey] = fixed;
        let last = -1;
        for (let v = 1; v <= 1000; v++) {
          attacker.stats[atkKey] = v;
          const dealt = damage(attacker, defender, skill);
          assert.ok(Number.isInteger(dealt) && dealt >= 1, `L${level} ${atkKey} ${v} vs ${defKey} ${fixed}: ${dealt}`);
          assert.ok(dealt >= last, `L${level} ${atkKey} ${v} vs ${defKey} ${fixed}: ${dealt} fell below ${last}`);
          last = dealt;
        }
        // Sweep the defender against a fixed attack.
        attacker.stats[atkKey] = fixed;
        last = Infinity;
        for (let v = 1; v <= 1000; v++) {
          defender.stats[defKey] = v;
          const dealt = damage(attacker, defender, skill);
          assert.ok(Number.isInteger(dealt) && dealt >= 1, `L${level} ${atkKey} ${fixed} vs ${defKey} ${v}: ${dealt}`);
          assert.ok(dealt <= last, `L${level} ${atkKey} ${fixed} vs ${defKey} ${v}: ${dealt} rose above ${last}`);
          last = dealt;
        }
      }
    }
  }
});

test('A4: across the range the change is real, not just "never worse"', () => {
  for (const level of LEVELS) {
    const wall = fighter(level, 500);
    assert.ok(damage(fighter(level, 1000), wall) > damage(fighter(level, 500), wall));
    assert.ok(damage(fighter(level, 500), wall) > damage(fighter(level, 10), wall));
    const blade = fighter(level, 500);
    assert.ok(damage(blade, fighter(level, 10)) > damage(blade, fighter(level, 500)));
    assert.ok(damage(blade, fighter(level, 500)) > damage(blade, fighter(level, 1000)));
  }
  // One more point always shows at endgame numbers.
  assert.ok(damage(fighter(100, 501), fighter(100, 500)) > damage(fighter(100, 500), fighter(100, 500)));
  assert.ok(damage(fighter(100, 500), fighter(100, 501)) < damage(fighter(100, 500), fighter(100, 500)));
  // Damage scales with the attacker's level, not the defender's.
  assert.equal(damage(fighter(100, 500), fighter(1, 500)), 2 * damage(fighter(50, 500), fighter(100, 500)));
});

test('pass-through: half when even, 0.75 at most, shrinking forever but never zero', () => {
  assert.equal(passThrough(400, 400), EVEN_PASS);
  assert.equal(passThrough(7, 7), 0.5);
  assert.equal(passThrough(400, 200), 0.6);
  assert.equal(passThrough(400, 800), 0.375);
  assert.equal(passThrough(100, 1000), 0.125);
  assert.ok(passThrough(1000, 1) < EVEN_PASS * (1 + DEF_WEIGHT));
  assert.ok(passThrough(1, 1000) > 0);
  // Scale-free: only the ratio matters.
  assert.equal(passThrough(10, 12), passThrough(500, 600));
});

test('even stats: a basic attack deals exactly Level x A', () => {
  assert.equal(damage(fighter(1, 10), fighter(1, 10)), 10);
  assert.equal(damage(fighter(50, 302), fighter(50, 302)), 15100);
  assert.equal(damage(fighter(100, 800), fighter(100, 800)), 80000);
  assert.equal(damage(fighter(100, 1000), fighter(100, 1000)), 100000);
});

// ---------------------------------------------------------------- multipliers

test('crit, guard and variance multiply once and floor once', () => {
  const a = fighter(50, 400);
  const d = fighter(50, 400);
  assert.equal(damage(a, d, BASIC_ATTACK, { crit: true }), 20000 * CRIT_MULT);
  assert.equal(damage(a, d, BASIC_ATTACK, { guard: true }), 20000 * GUARD_MULT);
  assert.equal(damage(a, d, BASIC_ATTACK, { crit: true, guard: true }), 15000);
  assert.equal(damage(a, d, BASIC_ATTACK, { variance: 0.9 }), 18000);
  assert.equal(damage(a, d, BASIC_ATTACK, { variance: 1.1 }), 22000);
  // Floor happens at the very end: 2 x 1 x 13 x (19.5 / 37) = 13.70, x1.5 = 20.55 -> 20, not floor(13.7) x 1.5 = 19.5.
  const small = fighter(1, 13);
  const smallDef = fighter(1, 11);
  assert.equal(damage(small, smallDef, BASIC_ATTACK), 13);
  assert.equal(damage(small, smallDef, BASIC_ATTACK, { crit: true }), 20);
});

test('affinity: weak x1.5, resist x0.5, null 0, absorb returns the amount to heal', () => {
  const mage = fighter(10, 100);
  const target = fighter(10, 100, {}, { affinities: { fire: 'weak', ice: 'resist', bolt: 'null', dark: 'absorb' } });
  const cast = (element, opts) => damage(mage, target, { ...FIRE, element }, opts);
  assert.equal(cast('holy'), 2000);
  assert.equal(cast('fire'), 3000);
  assert.equal(cast('ice'), 1000);
  assert.equal(cast('bolt'), 0);
  assert.equal(cast('dark'), 2000);
  assert.equal(cast('fire', { crit: true, guard: true }), 2250);
  // The option overrides the lookup.
  assert.equal(cast('holy', { affinity: 'weak' }), 3000);
  assert.equal(cast('fire', { affinity: 'normal' }), 2000);
  assert.equal(cast('fire', { affinity: 'null', crit: true, damageMult: 9 }), 0);

  assert.equal(affinityOf(target, { ...FIRE, element: 'fire' }), 'weak');
  assert.equal(affinityOf(target, { ...FIRE, element: 'ice' }), 'resist');
  assert.equal(affinityOf(target, { ...FIRE, element: 'bolt' }), 'null');
  assert.equal(affinityOf(target, { ...FIRE, element: 'dark' }), 'absorb');
  assert.equal(affinityOf(target, { ...FIRE, element: 'holy' }), 'normal');
  assert.equal(affinityOf(target, BASIC_ATTACK), 'normal');
  assert.throws(() => affinityOf(fighter(1, 10, {}, { affinities: { fire: 'week' } }), FIRE), /Unknown affinity/);
  assert.throws(() => damage(mage, target, FIRE, { affinity: 'squishy' }), /Unknown affinity/);
});

test('absorb and null through resolveAttack', () => {
  const mage = fighter(10, 100);
  const sponge = fighter(10, 100, {}, { affinities: { fire: 'absorb', ice: 'null' } });
  const soaked = resolveAttack(mage, sponge, FIRE, fixedRolls([40, 50]));
  assert.equal(soaked.affinity, 'absorb');
  assert.equal(soaked.absorbed, true);
  assert.equal(soaked.damage, 2000);
  const whiffed = resolveAttack(mage, sponge, FIRE, fixedRolls([90]));
  assert.equal(whiffed.absorbed, false);
  assert.equal(whiffed.damage, 0);
  const nulled = resolveAttack(mage, sponge, { ...FIRE, element: 'ice' }, fixedRolls([3, 50]));
  assert.deepEqual([nulled.outcome, nulled.affinity, nulled.damage, nulled.absorbed], ['crit', 'null', 0, false]);
});

test('a landed hit that is not nulled always deals at least 1', () => {
  const gnat = fighter(1, 1);
  const titan = fighter(100, 1000, {}, { affinities: { phys: 'resist' } });
  assert.equal(damage(gnat, titan, BASIC_ATTACK), 1);
  assert.equal(damage(gnat, titan, BASIC_ATTACK, { guard: true, variance: 0.9 }), 1);
  assert.equal(resolveAttack(gnat, titan, BASIC_ATTACK, fixedRolls([5, 1]), { guard: true }).damage, 1);
  // No power, no damage: buffs and pure status skills do not chip.
  assert.equal(damage(titan, gnat, { ...BASIC_ATTACK, power: 0 }), 0);
  assert.equal(damage(titan, gnat, { type: 'debuff', element: 'phys' }), 0);
});

// ---------------------------------------------------------------- buffs and binds

test('binds and buffs flow through effective attributes', () => {
  const free = fighter(50, 400);
  const wall = fighter(50, 400);
  assert.equal(damage(free, wall), 20000);

  // Bound arms halve STR: 2 x 50 x 200 x (300 / 800).
  const boundArms = fighter(50, 400, {}, { binds: { arms: 2 } });
  assert.equal(damage(boundArms, wall), 7500);
  assert.ok(damage(boundArms, wall) < damage(free, wall));

  // A x1.5 STR buff: 2 x 50 x 600 x (900 / 1600).
  const pumped = fighter(50, 400, {}, { mods: [{ stat: 'STR', mult: 1.5, turns: 3 }] });
  assert.equal(damage(pumped, wall), 33750);

  // A halved CON: 2 x 50 x 400 x (600 / 1000).
  const cracked = fighter(50, 400, {}, { mods: [{ stat: 'CON', mult: 0.5, turns: 3 }] });
  assert.equal(damage(free, cracked), 24000);

  // A bound head halves INT (the caster hits softer) and WIL (the target takes more magic).
  const boundHead = fighter(50, 400, {}, { binds: { head: 1 } });
  assert.equal(damage(boundHead, wall, FIRE), 15000);
  assert.equal(damage(free, boundHead, FIRE), 48000);
  assert.equal(damage(free, wall, FIRE), 40000);

  // Bound legs halve AGI: worse aim, easier target, slower turn.
  const boundLegs = fighter(50, 400, {}, { binds: { legs: 1 } });
  assert.equal(hitChance(boundLegs, wall).hitPct, 67);
  assert.equal(hitChance(free, boundLegs).hitPct, 83);
  assert.ok(initiative(boundLegs, () => 0.999999) < initiative(free, () => 0));

  // A LCK buff moves crit; expired mods do nothing.
  const lucky = fighter(50, 400, {}, { mods: [{ stat: 'LCK', mult: 1.5, turns: 1 }] });
  assert.equal(hitChance(lucky, wall).critPct, 9);
  const stale = fighter(50, 400, {}, { mods: [{ stat: 'STR', mult: 1.5, turns: 0 }] });
  assert.equal(damage(stale, wall), 20000);
});

// ---------------------------------------------------------------- A2: time to kill

test('A2: 6-14 landed basic hits kill a peer at L1, L50 and L100 across the whole stand-in band', () => {
  for (const level of LEVELS) {
    const attacker = fighter(level, benchmarkStat(level));
    const defender = fighter(level, benchmarkStat(level));
    let fewest = Infinity;
    let most = 0;
    // Attacker STR anywhere from trained (benchmark) to signature; defender CON anywhere from 0.6x to 1.2x of it.
    for (let str = benchmarkStat(level); str <= signatureStat(level); str++) {
      attacker.stats.STR = str;
      for (let con = Math.ceil(0.6 * str); con <= Math.floor(1.2 * str); con++) {
        defender.stats.CON = con;
        const hits = hitsToKill(attacker, defender, BASIC_ATTACK, baselineHp(level, con));
        assert.ok(hits >= 6 && hits <= 14, `L${level} STR ${str} vs CON ${con}: ${hits} hits`);
        fewest = Math.min(fewest, hits);
        most = Math.max(most, hits);
      }
    }
    // The band is used, not dodged: glass ends near 6, walls near 13-14.
    assert.equal(fewest, 6, `L${level} fewest`);
    assert.ok(most >= 13, `L${level} most was ${most}`);
  }
});

test('A2: an even peer falls in exactly 10 landed hits at every level', () => {
  for (const level of LEVELS) {
    for (const stat of [benchmarkStat(level), signatureStat(level)]) {
      const peer = fighter(level, stat);
      assert.equal(hitsToKill(peer, peer, BASIC_ATTACK, baselineHp(level, stat)), 10, `L${level} stat ${stat}`);
    }
  }
});

test('A2: seeded duels with misses, crits and variance keep the median inside 6-14', () => {
  const rng = makeRng(1337);
  for (const level of LEVELS) {
    const str = signatureStat(level);
    for (const ratio of [0.6, 0.8, 1, 1.2]) {
      const con = Math.min(Math.floor(1.2 * str), Math.max(Math.ceil(0.6 * str), Math.round(ratio * str)));
      const attacker = fighter(level, benchmarkStat(level), { STR: str });
      const defender = fighter(level, benchmarkStat(level), { CON: con });
      const landedCounts = [];
      for (let duel = 0; duel < 400; duel++) {
        let hp = baselineHp(level, con);
        let landed = 0;
        while (hp > 0) {
          const result = resolveAttack(attacker, defender, BASIC_ATTACK, rng);
          if (result.damage > 0) landed++;
          hp -= result.damage;
        }
        landedCounts.push(landed);
      }
      landedCounts.sort((x, y) => x - y);
      const median = landedCounts[200];
      const mean = landedCounts.reduce((s, n) => s + n, 0) / landedCounts.length;
      const where = `L${level} STR ${str} vs CON ${con}`;
      assert.ok(median >= 6 && median <= 14, `${where}: median ${median}`);
      assert.ok(mean >= 5.5 && mean <= 14, `${where}: mean ${mean}`);
      // Luck moves a duel by a hit or two, never out of the neighbourhood.
      assert.ok(landedCounts[0] >= 4 && landedCounts[399] <= 15, `${where}: ${landedCounts[0]}..${landedCounts[399]}`);
    }
  }
});

// ---------------------------------------------------------------- A5: stress

test('A5: WIL 1 takes at least 95% of base stress, WIL 1000 takes 25-45%, never below 1', () => {
  const frail = fighter(1, 1);
  const iron = fighter(100, 1000);
  for (let base = 10; base <= 200; base++) {
    const low = stressTaken(base, frail);
    const high = stressTaken(base, iron);
    assert.ok(low >= 0.95 * base && low <= base, `WIL 1, base ${base}: ${low}`);
    assert.ok(high >= 0.25 * base && high <= 0.45 * base, `WIL 1000, base ${base}: ${high}`);
  }
  for (let base = 1; base <= 200; base++) {
    for (const wil of [1, 10, 100, 250, 500, 750, 1000]) {
      const taken = stressTaken(base, fighter(50, 300, { WIL: wil }));
      assert.ok(Number.isInteger(taken) && taken >= 1 && taken <= base, `WIL ${wil}, base ${base}: ${taken}`);
    }
  }
  assert.equal(stressTaken(1, iron), 1);
  assert.equal(stressTaken(0.2, iron), 1);
});

test('stress taken never rises with WIL, and the curve matches the blueprint table', () => {
  const target = fighter(50, 300);
  for (const base of [10, 25, 50, 100]) {
    let last = Infinity;
    for (let wil = 1; wil <= 1000; wil++) {
      target.stats.WIL = wil;
      const taken = stressTaken(base, target);
      assert.ok(taken <= last, `base ${base}, WIL ${wil}: ${taken} rose above ${last}`);
      last = taken;
    }
  }
  const row = (base) => [1, 100, 250, 500, 750, 1000].map((wil) => stressTaken(base, fighter(50, 300, { WIL: wil })));
  assert.deepEqual(row(10), [10, 9, 7, 5, 4, 4]);
  assert.deepEqual(row(25), [25, 21, 18, 14, 11, 9]);
  assert.deepEqual(row(50), [50, 43, 35, 27, 22, 19]);
  assert.equal(stressMitigation(STRESS_K), 0.5);
  assert.equal(stressMitigation(1000), 0.625);
  assert.ok(stressMitigation(1000) <= STRESS_MIT_CAP);
});

test('stress opts: ignoreWill, mult, relief and binds', () => {
  const iron = fighter(100, 1000);
  assert.equal(stressTaken(40, iron), 15);
  assert.equal(stressTaken(40, iron, { ignoreWill: true }), 40);
  assert.equal(stressTaken(40, iron, { mult: 2 }), 30);
  assert.equal(stressTaken(40, iron, { mult: 0.5 }), 8);
  assert.equal(stressTaken(40, iron, { mult: 1.5, ignoreWill: true }), 60);
  assert.equal(stressTaken(40, iron, { mult: 0 }), 1);
  // Relief passes straight through: no WIL, no mult.
  assert.equal(stressTaken(-20, iron), -20);
  assert.equal(stressTaken(-20, iron, { mult: 3 }), -20);
  assert.equal(stressTaken(-20, fighter(1, 1)), -20);
  assert.equal(stressTaken(0, iron), 0);
  assert.ok(Object.is(stressTaken(-0.2, iron), 0));
  // A bound head halves WIL, so the same scare lands harder; a WIL buff softens it.
  const steady = fighter(50, 300, { WIL: 600 });
  const rattled = fighter(50, 300, { WIL: 600 }, { binds: { head: 2 } });
  const braced = fighter(50, 300, { WIL: 600 }, { mods: [{ stat: 'WIL', mult: 1.5, turns: 2 }] });
  assert.equal(stressTaken(30, steady), 15);
  assert.equal(stressTaken(30, rattled), 20);
  assert.equal(stressTaken(30, braced), 12);
});

// ---------------------------------------------------------------- healing

test('healing scales with Level x INT and keeps pace with the HP scale', () => {
  const mend = { id: 'mag_test_mend', type: 'heal', stat: 'INT', power: 3 };
  assert.equal(healAmount(fighter(1, 14), mend), 21);
  assert.equal(healAmount(fighter(50, 403), mend), 30225);
  assert.equal(healAmount(fighter(100, 800), mend), 120000);
  // Same share of an equal-CON ally's HP bar at every level: 5% x power.
  for (const level of LEVELS) {
    const stat = signatureStat(level);
    const share = healAmount(fighter(level, stat), mend) / baselineHp(level, stat);
    assert.ok(Math.abs(share - 0.05 * mend.power) < 0.001, `L${level}: ${share}`);
  }
  // A heal of power P undoes one even-stat hit of power P.
  const peer = fighter(50, 400);
  assert.equal(healAmount(peer, { power: BASIC_ATTACK.power }), damage(peer, peer, BASIC_ATTACK));
  assert.equal(HEAL_SCALE, EVEN_PASS);
});

test('heal opts and edge cases', () => {
  const healer = fighter(50, 400);
  const mend = { type: 'heal', power: 3 };
  assert.equal(healAmount(healer, mend), 30000);
  assert.equal(healAmount(healer, mend, { variance: 1.1 }), 33000);
  assert.equal(healAmount(healer, mend, { mult: 0.5 }), 15000);
  assert.equal(healAmount(healer, mend, { crit: true }), 45000);
  assert.equal(healAmount(healer, { ...mend, stat: 'WIL' }), 30000);
  assert.equal(healAmount(fighter(50, 400, {}, { binds: { head: 1 } }), mend), 15000);
  assert.equal(healAmount(fighter(50, 400, {}, { mods: [{ stat: 'INT', mult: 1.25, turns: 2 }] }), mend), 37500);
  assert.equal(healAmount(healer, { type: 'heal', power: 0 }), 0);
  assert.equal(healAmount(fighter(1, 1), { power: 0.5 }), 1);
});

// ---------------------------------------------------------------- initiative

test('initiative is AGI-driven with a bounded random part and uses the rng once', () => {
  const rng = makeRng(77);
  for (const agi of [1, 10, 137, 500, 1000]) {
    const c = fighter(50, 300, { AGI: agi });
    for (let i = 0; i < 300; i++) {
      const score = initiative(c, rng);
      assert.ok(Number.isInteger(score));
      assert.ok(score >= agi * INIT_SCALE && score <= agi * INIT_SCALE * (1 + INIT_SPREAD), `AGI ${agi}: ${score}`);
    }
  }
  const quick = fighter(50, 300, { AGI: 121 });
  const plain = fighter(50, 300, { AGI: 100 });
  const worstDraw = () => 0;
  const bestDraw = () => 0.999999;
  assert.equal(initiative(plain, worstDraw), 1000);
  assert.equal(initiative(plain, bestDraw), 1200);
  // A lead of more than 20% always acts first, whatever the dice say.
  assert.ok(initiative(quick, worstDraw) > initiative(plain, bestDraw));
  // Inside 20% the dice can flip the order.
  const close = fighter(50, 300, { AGI: 110 });
  assert.ok(initiative(close, worstDraw) < initiative(plain, bestDraw));
  assert.ok(initiative(close, bestDraw) > initiative(plain, worstDraw));
  assert.equal(initiative(plain, makeRng(3)), initiative(plain, makeRng(3)));
  const counted = counting(makeRng(3));
  initiative(plain, counted);
  assert.equal(counted.calls, 1);
});

// ---------------------------------------------------------------- balance helpers

test('expectedDamage counts miss, hit, crit and the fumble band', () => {
  const a = fighter(50, 400);
  const d = fighter(50, 400);
  // 75% hit, 5% crit: 70 plain hits and 5 crits per 100 swings.
  assert.equal(expectedDamage(a, d, BASIC_ATTACK), (70 * 20000 + 5 * 30000) / 100);
  assert.equal(expectedDamage(a, d), expectedDamage(a, d, BASIC_ATTACK));
  // A fumble band from 51 leaves 50 landing rolls.
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { fumbleFrom: 51 }), (45 * 20000 + 5 * 30000) / 100);
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { hitBonus: 20 }), (90 * 20000 + 5 * 30000) / 100);
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { critBonus: 10 }), (60 * 20000 + 15 * 30000) / 100);
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { guard: true, damageMult: 2 }), (70 * 20000 + 5 * 30000) / 100);
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { affinity: 'null' }), 0);
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { affinity: 'absorb' }), -15500);
  assert.equal(expectedDamage(a, d, BASIC_ATTACK, { affinity: 'weak' }), 23250);
});

test('expectedDamage agrees with a long seeded run of resolveAttack', () => {
  const a = fighter(100, 600, { STR: 800, LCK: 700 });
  const d = fighter(100, 600, { CON: 700, AGI: 500 });
  const skill = { ...BASIC_ATTACK, power: 5, acc: -5, crit: 10 };
  const rng = makeRng(31337);
  const swings = 60000;
  let total = 0;
  for (let i = 0; i < swings; i++) total += resolveAttack(a, d, skill, rng).damage;
  const average = total / swings;
  const expected = expectedDamage(a, d, skill);
  assert.ok(Math.abs(average - expected) / expected < 0.02, `simulated ${average}, expected ${expected}`);
});

test('hitsToKill counts plain landed hits and knows when a skill cannot kill', () => {
  const a = fighter(50, 400);
  const d = fighter(50, 400);
  assert.equal(hitsToKill(a, d, BASIC_ATTACK, 200000), 10);
  assert.equal(hitsToKill(a, d, BASIC_ATTACK, 200001), 11);
  assert.equal(hitsToKill(a, d, BASIC_ATTACK, 1), 1);
  assert.equal(hitsToKill(a, d, BASIC_ATTACK, 200000, { guard: true }), 20);
  assert.equal(hitsToKill(a, d, BASIC_ATTACK, 200000, { damageMult: 2 }), 5);
  // hp defaults to maxHp, then to the 10 x Level x CON baseline.
  assert.equal(hitsToKill(a, d), 10);
  assert.equal(hitsToKill(a, fighter(50, 400, {}, { maxHp: 60000 })), 3);
  assert.equal(hitsToKill(a, fighter(50, 400, {}, { affinities: { phys: 'null' } })), Infinity);
  assert.equal(hitsToKill(a, fighter(50, 400, {}, { affinities: { phys: 'absorb' } })), Infinity);
  assert.equal(hitsToKill(a, d, { ...BASIC_ATTACK, power: 0 }), Infinity);
});

// ---------------------------------------------------------------- the blueprint's worked examples

test('the three worked examples in blueprint/01_engine_math.md', () => {
  // L1: Valerie (STR 14) swings at a Puddle Slime (CON 10), plain hit, variance 0.96.
  const valerie = fighter(1, 10, { STR: 14 });
  const slime = fighter(1, 10);
  assert.equal(damage(valerie, slime, BASIC_ATTACK, { variance: 0.96 }), 14);

  // L50: a mage (INT 403) crits a fire-weak target (WIL 302) with a power 6 spell, variance 1.07.
  const mage = fighter(50, 302, { INT: 403 });
  const scarecrow = fighter(50, 302, {}, { affinities: { fire: 'weak' } });
  const fireball = { ...FIRE, power: 6 };
  assert.equal(damage(mage, scarecrow, fireball, { crit: true, variance: 1.07 }), 158799);

  // L100: a warrior (STR 800, buffed x1.25 to 1000) lands a power 20 ultimate on a guarding,
  // phys-resistant boss (CON 600), variance 0.94.
  const warrior = fighter(100, 600, { STR: 800 }, { mods: [{ stat: 'STR', mult: 1.25, turns: 3 }] });
  const boss = fighter(100, 600, {}, { affinities: { phys: 'resist' } });
  const ultimate = { ...BASIC_ATTACK, power: 20 };
  assert.equal(damage(warrior, boss, ultimate, { guard: true, variance: 0.94 }), 271153);
});

test('the lookup tables printed in blueprint/01_engine_math.md', () => {
  // Hit % by ACC:EVA ratio (rows) and skill.acc -20, -10, 0, +10, +20 (columns).
  const hitRow = (p, q) => [-20, -10, 0, 10, 20].map((acc) => hitChance(fighter(50, 90 * p), fighter(50, 90 * q), { ...BASIC_ATTACK, acc }).hitPct);
  assert.deepEqual(hitRow(1, 10), [22, 32, 42, 52, 62]);
  assert.deepEqual(hitRow(1, 4), [31, 41, 51, 61, 71]);
  assert.deepEqual(hitRow(1, 3), [35, 45, 55, 65, 75]);
  assert.deepEqual(hitRow(1, 2), [42, 52, 62, 72, 82]);
  assert.deepEqual(hitRow(2, 3), [47, 57, 67, 77, 87]);
  assert.deepEqual(hitRow(3, 4), [49, 59, 69, 79, 89]);
  assert.deepEqual(hitRow(9, 10), [53, 63, 73, 83, 93]);
  assert.deepEqual(hitRow(1, 1), [55, 65, 75, 85, 95]);
  assert.deepEqual(hitRow(10, 9), [57, 67, 77, 87, 95]);
  assert.deepEqual(hitRow(4, 3), [61, 71, 81, 91, 95]);
  assert.deepEqual(hitRow(3, 2), [63, 73, 83, 93, 95]);
  assert.deepEqual(hitRow(2, 1), [68, 78, 88, 95, 95]);
  assert.deepEqual(hitRow(3, 1), [75, 85, 95, 95, 95]);
  assert.deepEqual(hitRow(4, 1), [79, 89, 95, 95, 95]);
  assert.deepEqual(hitRow(10, 1), [88, 95, 95, 95, 95]);

  // Crit % by LCK ratio (rows) and skill.crit 0, +10, +20 (columns). AGI is set so the hit chance never caps it.
  const critRow = (p, q) => [0, 10, 20].map((crit) => hitChance(fighter(50, 90 * p, { AGI: 1000 }), fighter(50, 90 * q, { AGI: 100 }), { ...BASIC_ATTACK, crit }).critPct);
  assert.deepEqual(critRow(1, 10), [1, 1, 9]);
  assert.deepEqual(critRow(1, 4), [1, 3, 13]);
  assert.deepEqual(critRow(1, 2), [1, 8, 18]);
  assert.deepEqual(critRow(3, 4), [2, 12, 22]);
  assert.deepEqual(critRow(1, 1), [5, 15, 25]);
  assert.deepEqual(critRow(4, 3), [8, 18, 28]);
  assert.deepEqual(critRow(3, 2), [9, 19, 29]);
  assert.deepEqual(critRow(2, 1), [12, 22, 32]);
  assert.deepEqual(critRow(3, 1), [15, 25, 35]);
  assert.deepEqual(critRow(4, 1), [17, 27, 37]);
  assert.deepEqual(critRow(10, 1), [21, 31, 41]);

  // Pass-through by D / A, as a basic hit at L100 with A 100 (10,000 when even).
  const basicAt = (ratio) => damage(fighter(100, 100), fighter(100, 100, { CON: Math.round(100 * ratio) }));
  assert.deepEqual(
    [0.1, 0.25, 0.5, 0.6, 0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.5, 2, 2.5, 3, 4, 5, 10].map(basicAt),
    [14285, 13333, 12000, 11538, 10909, 10714, 10344, 10000, 9677, 9375, 9230, 8571, 7500, 6666, 6000, 5000, 4285, 2500],
  );

  // Damage per landed basic hit and hits to kill: [level, STR, CON, damage, hits].
  const duels = [
    [1, 10, 6, 11, 6], [1, 10, 8, 10, 8], [1, 10, 10, 10, 10], [1, 10, 12, 9, 14],
    [1, 14, 9, 15, 6], [1, 14, 11, 15, 8], [1, 14, 14, 14, 10], [1, 14, 16, 13, 13],
    [50, 302, 182, 17405, 6], [50, 302, 242, 16170, 8], [50, 302, 302, 15100, 10], [50, 302, 362, 14162, 13],
    [50, 403, 242, 23245, 6], [50, 403, 322, 21596, 8], [50, 403, 403, 20150, 10], [50, 403, 483, 18899, 13],
    [100, 600, 360, 69230, 6], [100, 600, 480, 64285, 8], [100, 600, 600, 60000, 10], [100, 600, 720, 56250, 13],
    [100, 800, 480, 92307, 6], [100, 800, 640, 85714, 8], [100, 800, 800, 80000, 10], [100, 800, 960, 75000, 13],
  ];
  for (const [level, str, con, dealt, hits] of duels) {
    const attacker = fighter(level, benchmarkStat(level), { STR: str });
    const defender = fighter(level, benchmarkStat(level), { CON: con });
    assert.equal(damage(attacker, defender), dealt, `L${level} STR ${str} vs CON ${con}`);
    assert.equal(hitsToKill(attacker, defender, BASIC_ATTACK, baselineHp(level, con)), hits, `L${level} STR ${str} vs CON ${con}`);
  }

  // Stress taken: WIL (rows) against base 5, 10, 15, 20, 25, 30, 40, 50 (columns).
  const stressRow = (wil) => [5, 10, 15, 20, 25, 30, 40, 50].map((base) => stressTaken(base, fighter(50, 300, { WIL: wil })));
  assert.deepEqual(stressRow(1), [5, 10, 15, 20, 25, 30, 40, 50]);
  assert.deepEqual(stressRow(50), [5, 9, 14, 18, 23, 28, 37, 46]);
  assert.deepEqual(stressRow(100), [4, 9, 13, 17, 21, 26, 34, 43]);
  assert.deepEqual(stressRow(200), [4, 8, 11, 15, 19, 23, 30, 38]);
  assert.deepEqual(stressRow(300), [3, 7, 10, 13, 17, 20, 27, 33]);
  assert.deepEqual(stressRow(400), [3, 6, 9, 12, 15, 18, 24, 30]);
  assert.deepEqual(stressRow(500), [3, 5, 8, 11, 14, 16, 22, 27]);
  assert.deepEqual(stressRow(600), [3, 5, 8, 10, 13, 15, 20, 25]);
  assert.deepEqual(stressRow(800), [2, 4, 6, 9, 11, 13, 17, 21]);
  assert.deepEqual(stressRow(1000), [2, 4, 6, 8, 9, 11, 15, 19]);

  // The by-hand example in the quick reference.
  const knight = fighter(60, 300, { STR: 480 });
  const ogre = fighter(60, 200, { CON: 720 });
  const heavy = { ...BASIC_ATTACK, power: 4, acc: -10 };
  assert.deepEqual(hitChance(knight, ogre, heavy), { hitPct: 73, critPct: 9, fumbleFrom: 96 });
  assert.equal(damage(knight, ogre, heavy), 49371);
  assert.equal(stressTaken(20, fighter(60, 300)), 13);
});

test('why DEF_WEIGHT is 0.5: the untuned baseline A^2 / (A + D) breaks A2 at the glass end of the band', () => {
  // Landed basic hits to kill when the same CON sets HP and defense, as a function of r = CON / STR.
  const baselineHits = (r) => (BARS.HP_PER_CON_PER_LEVEL * r * (1 + r)) / BASIC_ATTACK.power;
  const tunedHits = (r) => (BARS.HP_PER_CON_PER_LEVEL * r) / (BASIC_ATTACK.power * passThrough(1000, 1000 * r));
  assert.equal(Math.ceil(baselineHits(0.6)), 5); // 4.8: outside 6..14
  assert.equal(Math.ceil(tunedHits(0.6)), 6); // 5.2
  assert.equal(Math.ceil(tunedHits(1.2)), 13); // 12.8
  assert.ok(Math.abs(tunedHits(1) - baselineHits(1)) < 1e-9); // even stats are untouched: 10 hits either way
  assert.equal(DEF_WEIGHT, 0.5);
  assert.equal(EVEN_PASS, 0.5);
});
