import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, BIND_PARTS, BIND_MAP, BIND_MULT, CHECK_SLOPE, FUMBLE_FROM } from '../engine/constants.js';
import { makeRng, d100, contestPct } from '../engine/rng.js';
import { makeCombatant, effectiveStat, effectiveStats } from '../engine/stats.js';
import { BASIC_ATTACK, damage, expectedDamage, hitChance, healAmount, stressTaken, initiative } from '../engine/combat.js';
import { befuddledPart } from '../engine/valerie.js';
import { readData } from '../engine/data-node.js';
import { statsAt } from '../engine/progression.js';
import { benchmarkStat } from '../engine/stats.js';
import {
  BIND_RULES, NEVER_SEALED, boundParts, isBound, isTrussed, trussedDamageMult, isSealed, sealedBy, usableSkills, canFlee,
  bindResistOf, timesBound, bindOdds, bindChance, applyBind, tryBind, tickBinds, cureBinds, struggle, endBattleBinds,
} from '../engine/binds.js';

// ---------------------------------------------------------------- fixtures

const CORNERS = [1, 10, 500, 1000];

/** A combatant with every attribute set to `all`, then overridden. */
function fighter(all = 300, stats = {}, extra = {}) {
  const base = { STR: all, INT: all, AGI: all, CON: all, WIL: all, LCK: all };
  return makeCombatant({ id: 'fighter', level: 50, stats: { ...base, ...stats }, ...extra });
}

/** Exact replay of d100 results (rng.fixedRolls is one short on 30, 58 and 59). */
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

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const SKILLS = {
  spell: { id: 'mag_test_fire', type: 'magical', stat: 'INT', power: 2, element: 'fire', part: 'head' },
  cleave: { id: 'war_test_cleave', type: 'physical', stat: 'STR', power: 3, element: 'phys', part: 'arms' },
  kick: { id: 'rog_test_kick', type: 'physical', stat: 'STR', power: 3, element: 'phys', part: 'legs' },
  pose: { id: 'val_test_pose', type: 'buff', power: 0, part: 'none' },
  potion: { id: 'itm_test_potion', power: 0 },
  flail: { id: 'x_test_flail', type: 'physical', stat: 'STR', power: 4, element: 'phys', part: ['arms', 'legs'] },
};

// ---------------------------------------------------------------- A10: what a bind does to attributes

test('A10: a bind applied through applyBind halves its mapped attributes once, and only those', () => {
  const c = fighter(300, { STR: 801, INT: 600, AGI: 500, CON: 700, WIL: 300, LCK: 200 });
  const arms = applyBind(c, 'arms', 2);
  assert.equal(effectiveStat(arms, 'STR'), 400);
  assert.deepEqual(effectiveStats(arms), { STR: 400, INT: 600, AGI: 500, CON: 700, WIL: 300, LCK: 200 });
  const head = applyBind(c, 'head', 2);
  assert.deepEqual(effectiveStats(head), { STR: 801, INT: 300, AGI: 500, CON: 700, WIL: 150, LCK: 200 });
  const legs = applyBind(c, 'legs', 2);
  assert.deepEqual(effectiveStats(legs), { STR: 801, INT: 600, AGI: 250, CON: 700, WIL: 300, LCK: 200 });
  for (const part of BIND_PARTS) {
    const bound = applyBind(c, part, 1);
    for (const key of Object.keys(c.stats)) {
      const expected = BIND_MAP[part].includes(key) ? Math.floor(c.stats[key] * BIND_MULT) : c.stats[key];
      assert.equal(effectiveStat(bound, key), expected, `${part} bind, ${key}`);
    }
  }
});

test('A10: binding the same part again, or every part at once, never quarters anything', () => {
  const c = fighter(300, { STR: 801, INT: 600, AGI: 500, CON: 700, WIL: 300, LCK: 200 });
  let twice = applyBind(c, 'arms', 2);
  twice = applyBind(twice, 'arms', 3);
  twice = applyBind(twice, 'arms', 1);
  assert.equal(effectiveStat(twice, 'STR'), 400);
  // A second contested bind on a bound part: still one halving.
  const again = tryBind(fighter(), twice, 'arms', 95, 2, dice([1]));
  assert.equal(again.success, true);
  assert.equal(effectiveStat(again.combatant, 'STR'), 400);
  let all = c;
  for (const part of BIND_PARTS) all = applyBind(applyBind(all, part, 2), part, 2);
  assert.deepEqual(effectiveStats(all), { STR: 400, INT: 300, AGI: 250, CON: 700, WIL: 150, LCK: 200 });
  // Cured, everything is back.
  assert.deepEqual(effectiveStats(cureBinds(all)), c.stats);
  // No bind ever touches the bars (FOUNDATION ruling): the engine has nowhere to shrink them.
  const withBars = applyBind(makeCombatant({ stats: { CON: 300, WIL: 300 }, hp: 900, maxHp: 1000, mp: 40, maxMp: 50 }), 'head', 3);
  assert.deepEqual([withBars.hp, withBars.maxHp, withBars.mp, withBars.maxMp], [900, 1000, 40, 50]);
});

// ---------------------------------------------------------------- the chance

test('bind chance: the skill\'s chance, swung by Luck against Luck, exactly like rng.contestPct', () => {
  assert.equal(BIND_RULES.SLOPE, CHECK_SLOPE);
  const even = fighter(300);
  for (const base of [20, 35, 45, 55, 80]) {
    assert.equal(bindChance(even, even, 'legs', base), base, 'even Luck: the chance on the skill');
    assert.equal(bindChance(fighter(300, { LCK: 600 }), even, 'legs', base), Math.min(95, base + 20), 'double Luck: +20');
    assert.equal(bindChance(even, fighter(300, { LCK: 600 }), 'legs', base), Math.max(5, base - 20), 'half Luck: -20');
    for (const [mine, theirs] of [[300, 300], [450, 300], [300, 450], [800, 600], [100, 900]]) {
      assert.equal(bindChance(fighter(300, { LCK: mine }), fighter(300, { LCK: theirs }), 'arms', base), contestPct(mine, theirs, base - 50));
    }
  }
  // Only Luck is in the contest, and it is effective Luck: a buff counts.
  assert.equal(bindChance(fighter(300, { STR: 1000, AGI: 1000 }), even, 'head', 55), 55);
  const lucky = fighter(300, {}, { mods: [{ stat: 'LCK', mult: 1.5, turns: 3 }] });
  assert.equal(bindChance(lucky, even, 'head', 55), 67);
  // No binder at all (a trap, the scenery): no swing.
  assert.equal(bindChance(null, fighter(300, { LCK: 900 }), 'legs', 40), 40);
  // A passive's bonus is flat points, added before anything scales the chance.
  assert.equal(bindChance(even, even, 'legs', 55, { bonus: 10 }), 65);
  assert.deepEqual(bindOdds(fighter(300, { LCK: 600 }), even, 'legs', 55), { base: 55, swing: 20, bonus: 0, raw: 75, resist: 0, timesBound: 0, wear: 1, pct: 75 });
  assert.throws(() => bindChance(even, even, 'tail', 55), /Unknown body part/);
});

test('bind chance is bounded 5..95 at every attribute extreme, base chance, resistance and wear', () => {
  let lowest = 100;
  let highest = 0;
  for (const mine of CORNERS) for (const theirs of CORNERS) for (const resist of [0, 40, 80]) for (let count = 0; count <= 4; count++) {
    const attacker = fighter(300, { LCK: mine });
    const target = fighter(300, { LCK: theirs }, { flags: { bindResist: resist, bindCount: { head: count, arms: count, legs: count } } });
    for (let base = 0; base <= 100; base += 5) for (const part of BIND_PARTS) {
      const pct = bindChance(attacker, target, part, base);
      assert.ok(Number.isInteger(pct) && pct >= SCALE.PCT_FLOOR && pct <= SCALE.PCT_CEIL, `LCK ${mine} vs ${theirs}, base ${base}, resist ${resist}, bound ${count}: ${pct}`);
      lowest = Math.min(lowest, pct);
      highest = Math.max(highest, pct);
    }
  }
  assert.equal(lowest, 5);
  assert.equal(highest, 95);
  assert.equal(bindChance(fighter(300, { LCK: 1000 }), fighter(300, { LCK: 1 }), 'arms', 35), 95);
  assert.equal(bindChance(fighter(300, { LCK: 1 }), fighter(300, { LCK: 1000 }), 'arms', 80), 20);
  assert.equal(bindChance(fighter(300, { LCK: 1 }), fighter(300, { LCK: 1000 }), 'arms', 35), 5);
  // Garbage in, bounded out.
  assert.equal(bindChance(fighter(), fighter(), 'arms', 5000), 95);
  assert.equal(bindChance(fighter(), fighter(), 'arms', -5000), 5);
  assert.equal(bindChance(fighter(), fighter(), 'arms', NaN), 5);
  // An ability may move the window, as on every other roll.
  assert.equal(bindChance(fighter(), fighter(), 'arms', 90, { cap: 60 }), 60);
  assert.equal(bindChance(fighter(), fighter(), 'arms', 10, { floor: 25 }), 25);
});

test('bindResist is a percentage off the chance, per part, capped at 80', () => {
  const even = fighter(300);
  const boss = fighter(300, {}, { flags: { bindResist: { head: 70, arms: 60, legs: 50 } } });
  assert.equal(bindResistOf(boss, 'head'), 70);
  assert.equal(bindResistOf(boss, 'legs'), 50);
  assert.equal(bindResistOf(even, 'legs'), 0, 'default 0');
  assert.equal(bindChance(even, boss, 'legs', 55), 28);
  assert.equal(bindChance(even, boss, 'arms', 55), 22);
  assert.equal(bindChance(even, boss, 'head', 55), 17);
  assert.equal(bindChance(even, fighter(300, {}, { flags: { bindResist: { legs: 30 } } }), 'legs', 55), 39, '38.5 rounds up');
  // One number covers every part. On the combatant itself or in flags, where makeCombatant keeps it.
  const flat = { ...fighter(300), bindResist: 40 };
  for (const part of BIND_PARTS) assert.equal(bindResistOf(flat, part), 40);
  assert.equal(bindResistOf({ ...fighter(300), bindResist: { arms: 25 } }, 'arms'), 25);
  assert.equal(bindResistOf({ ...fighter(300), bindResist: { arms: 25 } }, 'head'), 0);
  assert.equal(bindResistOf(fighter(300, {}, { flags: { bindResist: 20 } }), 'head'), 20);
  // Held to 0..80: nothing is ever immune, and the 5% floor is still there underneath.
  assert.equal(bindResistOf({ ...fighter(), bindResist: 250 }, 'arms'), BIND_RULES.RESIST_MAX);
  assert.equal(bindResistOf({ ...fighter(), bindResist: -30 }, 'arms'), 0);
  assert.equal(bindChance(even, { ...fighter(), bindResist: 250 }, 'arms', 55), 11);
  // The swing is inside the scaling: Luck cannot buy its way around resistance.
  assert.equal(bindChance(fighter(300, { LCK: 600 }), boss, 'legs', 55), 38);
  assert.equal(bindChance(even, boss, 'legs', 55, { ignoreResist: true }), 55);
});

test('resistance accumulates: every contested bind that lands halves the next chance on that part', () => {
  assert.equal(BIND_RULES.WEAR, 0.5);
  const binder = fighter(300);
  let target = fighter(300);
  const chances = [];
  for (let i = 0; i < 5; i++) {
    chances.push(bindChance(binder, target, 'arms', 55));
    assert.equal(timesBound(target, 'arms'), i);
    const r = tryBind(binder, target, 'arms', 55, 2, dice([1]));
    assert.equal(r.success, true);
    target = r.combatant;
  }
  assert.deepEqual(chances, [55, 28, 14, 7, 5]);
  assert.deepEqual(target.flags.bindCount, { arms: 5 });
  // Only that part wears.
  assert.equal(bindChance(binder, target, 'legs', 55), 55);
  assert.equal(bindChance(binder, target, 'head', 55), 55);
  // Wear and standing resistance multiply.
  const boss = fighter(300, {}, { flags: { bindResist: { arms: 40 }, bindCount: { arms: 1 } } });
  assert.equal(bindChance(binder, boss, 'arms', 55), 17);
  assert.equal(bindChance(binder, boss, 'arms', 55, { ignoreWear: true }), 33);
  assert.equal(bindChance(binder, boss, 'arms', 55, { ignoreWear: true, ignoreResist: true }), 55);
});

test('what does and does not build resistance', () => {
  const binder = fighter(300);
  const target = fighter(300);
  // A miss teaches the target nothing.
  const missed = tryBind(binder, target, 'legs', 55, 2, dice([56]));
  assert.equal(missed.success, false);
  assert.equal(timesBound(missed.combatant, 'legs'), 0);
  // An accident (no contest) does not count either: a befuddled fumble does not spend the party's good chance.
  assert.equal(timesBound(applyBind(target, 'legs', 1, { ownTurn: true }), 'legs'), 0);
  assert.equal(timesBound(applyBind(target, 'legs', 2, { count: true }), 'legs'), 1);
  // A refresh that lands counts again, even though the bind was already there.
  let twice = tryBind(binder, target, 'legs', 55, 2, dice([10])).combatant;
  twice = tryBind(binder, twice, 'legs', 55, 2, dice([10])).combatant;
  assert.equal(timesBound(twice, 'legs'), 2);
  // Ticking out, being cured and Struggling free all leave the resistance in place for the rest of the battle.
  let later = tickBinds(tickBinds(twice));
  assert.deepEqual(boundParts(later), []);
  assert.equal(timesBound(later, 'legs'), 2);
  assert.equal(timesBound(cureBinds(twice), 'legs'), 2);
  assert.equal(timesBound(struggle(twice), 'legs'), 2);
  assert.equal(bindChance(binder, later, 'legs', 55), 14);
  // It survives a trip through makeCombatant, because it lives in flags.
  later = makeCombatant(later);
  assert.equal(timesBound(later, 'legs'), 2);
  // A new battle forgets it.
  const fresh = endBattleBinds(twice);
  assert.equal(timesBound(fresh, 'legs'), 0);
  assert.deepEqual(fresh.binds, { head: 0, arms: 0, legs: 0 });
  assert.equal(fresh.flags.bindCount, undefined);
  assert.equal(bindChance(binder, fresh, 'legs', 55), 55);
});

// ---------------------------------------------------------------- the roll

test('tryBind is one d100: at or under the chance it takes, a tenth of the chance is a crit, 96+ is a fumble', () => {
  const binder = fighter(300);
  const target = fighter(300);
  const tally = { crit: 0, success: 0, fail: 0, fumble: 0 };
  for (let roll = 1; roll <= 100; roll++) {
    const rng = counting(dice([roll]));
    const r = tryBind(binder, target, 'legs', 55, 2, rng);
    assert.equal(rng.calls, 1, 'the rng is used exactly once');
    assert.equal(r.roll, roll);
    assert.equal(r.pct, 55);
    assert.equal(r.success, roll <= 55);
    assert.equal(r.crit, roll <= 5);
    assert.equal(r.fumble, roll >= FUMBLE_FROM);
    assert.equal(r.turns, roll <= 5 ? 3 : roll <= 55 ? 2 : 0);
    assert.equal(r.combatant.binds.legs, r.turns);
    assert.equal(timesBound(r.combatant, 'legs'), r.success ? 1 : 0);
    tally[r.fumble ? 'fumble' : r.crit ? 'crit' : r.success ? 'success' : 'fail']++;
  }
  assert.deepEqual(tally, { crit: 5, success: 50, fail: 40, fumble: 5 });
  // The crit band is a tenth of the chance, never less than a roll of 1, and a crit cannot break the 5-turn cap.
  assert.equal(tryBind(binder, fighter(300, {}, { flags: { bindResist: 80 } }), 'legs', 35, 2, dice([1])).crit, true);
  assert.equal(tryBind(binder, target, 'legs', 55, 5, dice([1])).turns, BIND_RULES.MAX_TURNS);
  // Even at the 95 cap, 96-100 fails: the fumble band is never eaten.
  const sure = tryBind(fighter(300, { LCK: 1000 }), target, 'legs', 95, 2, dice([96]));
  assert.equal(sure.pct, 95);
  assert.equal(sure.success, false);
  assert.equal(sure.fumble, true);
});

test('fumble a bind and you wear it: the binder is bound there for one turn, and it outlasts that turn', () => {
  const binder = fighter(300);
  const target = fighter(300);
  const r = tryBind(binder, target, 'arms', 55, 2, dice([98]));
  assert.equal(r.backfire, true);
  assert.deepEqual(boundParts(r.combatant), []);
  assert.deepEqual(r.attacker.binds, { head: 0, arms: BIND_RULES.BACKFIRE_TURNS, legs: 0 });
  assert.deepEqual(binder.binds, { head: 0, arms: 0, legs: 0 }, 'the binder passed in is untouched');
  assert.equal(timesBound(r.attacker, 'arms'), 0, 'an accident builds no resistance');
  // It landed during the binder's own turn, so the end of that turn does not cross it off.
  const sameTurn = tickBinds(r.attacker);
  assert.equal(sameTurn.binds.arms, 1);
  assert.equal(tickBinds(sameTurn).binds.arms, 0);
  // A widened fumble band (a stance, an aura) widens this one too.
  const wide = tryBind(binder, target, 'arms', 95, 2, dice([80]), { fumbleFrom: 76 });
  assert.equal(wide.fumble, true);
  assert.equal(wide.success, false);
  assert.equal(wide.backfire, true);
  // The caller can switch the backfire off (the hero's fumble is a Chaos Wave instead).
  const waved = tryBind(binder, target, 'arms', 55, 2, dice([98]), { backfire: false });
  assert.equal(waved.backfire, false);
  assert.equal(waved.attacker, binder);
  // No fumble, no change to the binder.
  assert.equal(tryBind(binder, target, 'arms', 55, 2, dice([60])).attacker, binder);
});

test('a bind riding on an attack is read off the attack\'s own roll: no second d100', () => {
  const binder = fighter(300);
  const target = fighter(300);
  const unused = counting(makeRng(9));
  const landed = tryBind(binder, target, 'arms', 35, 2, unused, { roll: 20 });
  assert.equal(unused.calls, 0);
  assert.equal(landed.roll, 20);
  assert.equal(landed.success, true);
  assert.equal(landed.combatant.binds.arms, 2);
  assert.equal(tryBind(binder, target, 'arms', 35, 2, unused, { roll: 36 }).success, false);
  assert.equal(unused.calls, 0);
  // With no rng at all, as long as the roll is handed over.
  assert.equal(tryBind(binder, target, 'arms', 35, 2, undefined, { roll: 3 }).crit, true);
  // The attack's fumble already has its own consequence: no backfire unless asked for.
  const fumbled = tryBind(binder, target, 'arms', 35, 2, undefined, { roll: 99 });
  assert.equal(fumbled.fumble, true);
  assert.equal(fumbled.backfire, false);
  assert.equal(tryBind(binder, target, 'arms', 35, 2, undefined, { roll: 99, backfire: true }).backfire, true);
  // "35% to bind; a crit all but guarantees it": the caller passes the higher base when the attack roll was a crit.
  assert.equal(tryBind(binder, target, 'arms', 95, 2, undefined, { roll: 5 }).success, true);
});

// ---------------------------------------------------------------- duration

test('a second bind on a bound part refreshes to the longer duration; it never stacks', () => {
  const c = fighter();
  assert.deepEqual(applyBind(c, 'legs', 2).binds, { head: 0, arms: 0, legs: 2 });
  assert.equal(applyBind(applyBind(c, 'legs', 2), 'legs', 2).binds.legs, 2, 'not 4');
  assert.equal(applyBind(applyBind(c, 'legs', 2), 'legs', 3).binds.legs, 3, 'the longer one wins');
  assert.equal(applyBind(applyBind(c, 'legs', 3), 'legs', 1).binds.legs, 3, 'a shorter one changes nothing');
  assert.equal(applyBind(c, 'legs').binds.legs, BIND_RULES.DEFAULT_TURNS);
  assert.equal(applyBind(c, 'legs', 99).binds.legs, BIND_RULES.MAX_TURNS);
  assert.equal(applyBind(c, 'legs', 2.9).binds.legs, 2);
  for (const turns of [0, -3, NaN]) assert.deepEqual(applyBind(c, 'legs', turns).binds, { head: 0, arms: 0, legs: 0 });
  assert.throws(() => applyBind(c, 'wings', 2), /Unknown body part/);
  assert.throws(() => tryBind(c, c, 'wings', 50, 2, dice([1])), /Unknown body part/);
});

test('binds tick down to zero at the end of the bound combatant\'s own turns, and never below', () => {
  let c = applyBind(applyBind(fighter(), 'arms', 2), 'head', 1);
  assert.deepEqual(boundParts(c), ['head', 'arms']);
  c = tickBinds(c);
  assert.deepEqual(c.binds, { head: 0, arms: 1, legs: 0 });
  assert.deepEqual(boundParts(c), ['arms']);
  assert.equal(effectiveStat(c, 'INT'), 300, 'the head is free again');
  assert.equal(effectiveStat(c, 'STR'), 150);
  c = tickBinds(c);
  assert.deepEqual(c.binds, { head: 0, arms: 0, legs: 0 });
  assert.equal(effectiveStat(c, 'STR'), 300);
  c = tickBinds(tickBinds(c));
  assert.deepEqual(c.binds, { head: 0, arms: 0, legs: 0 });
  // A bind of N turns costs exactly N of the target's own turns.
  for (let turns = 1; turns <= BIND_RULES.MAX_TURNS; turns++) {
    let bound = applyBind(fighter(), 'legs', turns);
    let acted = 0;
    while (isBound(bound, 'legs')) {
      acted++;
      bound = tickBinds(bound);
    }
    assert.equal(acted, turns);
  }
});

test('a bind picked up during your own turn is not crossed off at the end of that turn', () => {
  // The hero's Aura: an enemy fumbles its attack and binds one of its own parts for 1 turn, chosen by the roll.
  for (let roll = 86; roll <= 100; roll++) {
    const part = befuddledPart(roll);
    const enemy = applyBind(fighter(), part, 1, { ownTurn: true });
    assert.deepEqual(boundParts(enemy), [part]);
    assert.equal(timesBound(enemy, part), 0);
    const endOfThatTurn = tickBinds(enemy);
    assert.deepEqual(boundParts(endOfThatTurn), [part], `roll ${roll}: the bind must still be there for its next turn`);
    assert.equal(endOfThatTurn.flags.bindFresh, undefined);
    assert.deepEqual(boundParts(tickBinds(endOfThatTurn)), []);
  }
  // Only the fresh part is spared; an older bind on another part still ticks.
  let c = applyBind(fighter(), 'arms', 2);
  c = applyBind(c, 'legs', 1, { ownTurn: true });
  assert.deepEqual(tickBinds(c).binds, { head: 0, arms: 1, legs: 1 });
  // An ordinary bind from someone else is crossed off as usual.
  assert.equal(tickBinds(applyBind(fighter(), 'legs', 1)).binds.legs, 0);
});

// ---------------------------------------------------------------- seals

test('a bound part seals its skills; the basic attack is never sealed', () => {
  const free = fighter();
  for (const skill of Object.values(SKILLS)) assert.equal(isSealed(free, skill), false);
  const expected = {
    head: { spell: true, cleave: false, kick: false, pose: false, potion: false, flail: false },
    arms: { spell: false, cleave: true, kick: false, pose: false, potion: false, flail: true },
    legs: { spell: false, cleave: false, kick: true, pose: false, potion: false, flail: true },
  };
  for (const part of BIND_PARTS) {
    const bound = applyBind(free, part, 2);
    for (const [name, skill] of Object.entries(SKILLS)) assert.equal(isSealed(bound, skill), expected[part][name], `${part} bound, ${name}`);
    assert.equal(isSealed(bound, BASIC_ATTACK), false, `${part} bound: the basic attack`);
    assert.equal(sealedBy(bound, BASIC_ATTACK), null);
  }
  // The ruling, spelled out: the basic attack is an arms skill, bound arms halve its Might, and it still works.
  assert.equal(BASIC_ATTACK.part, 'arms');
  assert.deepEqual(NEVER_SEALED, [BASIC_ATTACK.id]);
  const armsBound = applyBind(free, 'arms', 2);
  assert.equal(isSealed(armsBound, BASIC_ATTACK), false);
  assert.equal(isSealed(armsBound, { ...BASIC_ATTACK }), false, 'a copy of it is still the basic attack');
  assert.equal(isSealed(armsBound, { ...BASIC_ATTACK, id: 'war_heavy_swing' }), true, 'anything else that uses the arms is sealed');
  assert.ok(damage(armsBound, free) > 0);
  assert.equal(sealedBy(armsBound, SKILLS.cleave), 'arms');
  assert.equal(sealedBy(applyBind(free, 'legs', 1), SKILLS.flail), 'legs');
  assert.equal(isSealed(armsBound, null), false);
  assert.equal(isSealed(armsBound, undefined), false);
  // Sealed until the bind is gone, to the turn.
  assert.equal(isSealed(tickBinds(armsBound), SKILLS.cleave), true);
  assert.equal(isSealed(tickBinds(tickBinds(armsBound)), SKILLS.cleave), false);
  assert.equal(isSealed(cureBinds(armsBound), SKILLS.cleave), false);
});

test('usableSkills and canFlee: what is left to do with parts bound', () => {
  const kit = [BASIC_ATTACK, ...Object.values(SKILLS)];
  const ids = (c) => usableSkills(c, kit).map((s) => s.id);
  assert.equal(ids(fighter()).length, kit.length);
  assert.deepEqual(ids(applyBind(fighter(), 'arms', 2)), ['basic_attack', 'mag_test_fire', 'rog_test_kick', 'val_test_pose', 'itm_test_potion']);
  let all = fighter();
  for (const part of BIND_PARTS) all = applyBind(all, part, 2);
  assert.deepEqual(ids(all), ['basic_attack', 'val_test_pose', 'itm_test_potion'], 'Trussed: the basic attack, part-less skills and items');
  assert.equal(canFlee(fighter()), true);
  assert.equal(canFlee(applyBind(fighter(), 'arms', 2)), true);
  assert.equal(canFlee(applyBind(fighter(), 'legs', 1)), false, 'running is a legs action');
});

test('all three parts bound at once is Trussed: every hit on the target is x1.5', () => {
  let c = fighter();
  assert.equal(isTrussed(c), false);
  c = applyBind(applyBind(c, 'head', 2), 'arms', 2);
  assert.equal(isTrussed(c), false);
  assert.equal(trussedDamageMult(c), 1);
  c = applyBind(c, 'legs', 1);
  assert.equal(isTrussed(c), true);
  assert.equal(trussedDamageMult(c), BIND_RULES.TRUSSED_DAMAGE_MULT);
  const attacker = fighter();
  assert.equal(damage(attacker, c, BASIC_ATTACK, { damageMult: trussedDamageMult(c) }), Math.floor(damage(attacker, c) * 1.5));
  // It lasts only while all three hold: the shortest bind sets the window.
  c = tickBinds(c);
  assert.deepEqual(boundParts(c), ['head', 'arms']);
  assert.equal(isTrussed(c), false);
  assert.equal(trussedDamageMult(c), 1);
});

// ---------------------------------------------------------------- cures

test('cures: time, cureBinds for all parts or some, and the Struggle action for one', () => {
  let all = fighter();
  for (const [part, turns] of [['head', 1], ['arms', 3], ['legs', 2]]) all = applyBind(all, part, turns);
  assert.deepEqual(cureBinds(all).binds, { head: 0, arms: 0, legs: 0 });
  assert.deepEqual(cureBinds(all, 'arms').binds, { head: 1, arms: 0, legs: 2 });
  assert.deepEqual(cureBinds(all, ['head', 'legs']).binds, { head: 0, arms: 3, legs: 0 });
  assert.deepEqual(cureBinds(fighter()).binds, { head: 0, arms: 0, legs: 0 });
  assert.throws(() => cureBinds(all, 'tail'), /Unknown body part/);
  // Struggle: the whole turn, one part, no roll. With no part named it frees the one with the most turns left.
  assert.deepEqual(struggle(all).binds, { head: 1, arms: 0, legs: 2 });
  assert.deepEqual(struggle(all, 'head').binds, { head: 0, arms: 3, legs: 2 });
  assert.deepEqual(struggle(fighter()).binds, { head: 0, arms: 0, legs: 0 });
  // A cure also clears the own-turn marker, so a fresh bind on that part later ticks normally.
  const fresh = applyBind(fighter(), 'legs', 1, { ownTurn: true });
  assert.equal(cureBinds(fresh, 'legs').flags.bindFresh, undefined);
  const rebound = applyBind(cureBinds(fresh, 'legs'), 'legs', 1);
  assert.equal(tickBinds(rebound).binds.legs, 0);
});

// ---------------------------------------------------------------- what each bind is worth

test('what each bind is worth, in this engine\'s numbers', () => {
  const even = fighter(300);
  const bound = (part) => applyBind(even, part, 2);
  // Arms: their physical damage falls to 37.5%.
  assert.equal(damage(bound('arms'), even) / damage(even, even), 0.375);
  // Head: their spells fall to 37.5%, their heals halve, magic hits them 20% harder and stress lands a third heavier.
  assert.equal(damage(bound('head'), even, SKILLS.spell) / damage(even, even, SKILLS.spell), 0.375);
  assert.equal(damage(even, bound('head'), SKILLS.spell) / damage(even, even, SKILLS.spell), 1.2);
  assert.equal(healAmount(bound('head'), { power: 3 }) / healAmount(even, { power: 3 }), 0.5);
  const willed = fighter(600);
  assert.equal(stressTaken(30, willed), 15);
  assert.equal(stressTaken(30, applyBind(willed, 'head', 2)), 20);
  // Legs: they hit at 67 instead of 75, are hit at 83, and lose the initiative to anyone above 60% of their Finesse.
  assert.equal(hitChance(even, even).hitPct, 75);
  assert.equal(hitChance(bound('legs'), even).hitPct, 67);
  assert.equal(hitChance(even, bound('legs')).hitPct, 83);
  const slowest = initiative(fighter(181), () => 0);
  const fastestBound = initiative(bound('legs'), () => 0.999999);
  assert.ok(slowest > fastestBound, 'AGI 181 always outruns a bound AGI 300');
  // Average damage per action, misses and crits included: bound arms cut their output to 37.5%, bound legs to 89.7%;
  // bound legs on the target lift yours to 110.3%, and a Trussed target takes 165.5%.
  const baseline = expectedDamage(even, even);
  const share = (value) => ((100 * value) / baseline).toFixed(1);
  assert.equal(share(expectedDamage(bound('arms'), even)), '37.5');
  assert.equal(share(expectedDamage(bound('legs'), even)), '89.7');
  assert.equal(share(expectedDamage(even, bound('legs'))), '110.3');
  let trussed = even;
  for (const part of BIND_PARTS) trussed = applyBind(trussed, part, 2);
  assert.equal(share(expectedDamage(even, trussed, BASIC_ATTACK, { damageMult: trussedDamageMult(trussed) })), '165.5');
});

// ---------------------------------------------------------------- the blueprint

test('the lookup tables and worked example printed in blueprint/03_psych_status.md', () => {
  const lucky = (lck, flags = {}) => fighter(300, { LCK: lck }, { flags });
  // Bind chance by Luck ratio (rows) and skill chance 25 / 35 / 45 / 55 / 80 (columns).
  const pairs = [[150, 600], [300, 600], [400, 600], [300, 300], [450, 300], [600, 300], [600, 150]];
  const row = ([mine, theirs]) => [25, 35, 45, 55, 80].map((base) => bindChance(lucky(mine), lucky(theirs), 'legs', base));
  assert.deepEqual(pairs.map(row), [
    [5, 5, 9, 19, 44],
    [5, 15, 25, 35, 60],
    [13, 23, 33, 43, 68],
    [25, 35, 45, 55, 80],
    [37, 47, 57, 67, 92],
    [45, 55, 65, 75, 95],
    [61, 71, 81, 91, 95],
  ]);
  assert.deepEqual(pairs.map(([mine, theirs]) => Math.round(bindOdds(lucky(mine), lucky(theirs), 'legs', 50).swing)), [-36, -20, -12, 0, 12, 20, 36]);
  // Bind resist (rows) against the 1st / 2nd / 3rd / 4th bind on a part, for skill chances 45, 55 and 80.
  const worn = (base, resist) => [0, 1, 2, 3].map((count) => bindChance(lucky(300), lucky(300, { bindResist: resist, bindCount: { legs: count } }), 'legs', base));
  const table = [0, 10, 20, 30, 40, 50, 60, 70, 80].map((resist) => [45, 55, 80].map((base) => worn(base, resist)));
  assert.deepEqual(table, [
    [[45, 23, 11, 6], [55, 28, 14, 7], [80, 40, 20, 10]],
    [[41, 20, 10, 5], [50, 25, 12, 6], [72, 36, 18, 9]],
    [[36, 18, 9, 5], [44, 22, 11, 6], [64, 32, 16, 8]],
    [[32, 16, 8, 5], [39, 19, 10, 5], [56, 28, 14, 7]],
    [[27, 14, 7, 5], [33, 17, 8, 5], [48, 24, 12, 6]],
    [[23, 11, 6, 5], [28, 14, 7, 5], [40, 20, 10, 5]],
    [[18, 9, 5, 5], [22, 11, 6, 5], [32, 16, 8, 5]],
    [[14, 7, 5, 5], [17, 8, 5, 5], [24, 12, 6, 5]],
    [[9, 5, 5, 5], [11, 6, 5, 5], [16, 8, 5, 5]],
  ]);
  // The worked example: a level 50 Rogue, a 45% arms bind, an elite with 30 arms resist.
  const rogue = makeCombatant({ id: 'rogue', level: 50, stats: statsAt(readData('archetypes').archetypes.find((a) => a.id === 'rogue'), 50) });
  const elite = makeCombatant({ id: 'elite', level: 50, rank: 'elite', stats: { STR: 330, INT: 150, AGI: 240, CON: 300, WIL: 200, LCK: 240 }, flags: { bindResist: { head: 40, arms: 30, legs: 30 } } });
  assert.equal(rogue.stats.LCK, 384);
  const odds = bindOdds(rogue, elite, 'arms', 45);
  assert.equal(odds.swing.toFixed(1), '13.8');
  assert.equal(odds.pct, 41);
  const bound = tryBind(rogue, elite, 'arms', 45, 2, dice([31]));
  assert.deepEqual([bound.success, bound.crit, bound.turns], [true, false, 2]);
  assert.equal(effectiveStat(bound.combatant, 'STR'), 165);
  assert.equal(Math.round((100 * damage(bound.combatant, rogue)) / damage(elite, rogue)), 40);
  assert.equal(bindChance(rogue, bound.combatant, 'arms', 45), 21);
  // The hero's Accidental Trip at the level it unlocks, against a benchmark enemy and a boss with 50 legs resist.
  const valerie = makeCombatant({ level: 40, stats: statsAt(readData('valerie').archetype, 40) });
  const foe = (resist) => makeCombatant({ level: 40, stats: { LCK: benchmarkStat(40) }, flags: { bindResist: resist } });
  assert.deepEqual([valerie.stats.LCK, benchmarkStat(40)], [325, 242]);
  assert.equal(bindChance(valerie, foe(0), 'legs', 55), 64);
  assert.equal(bindChance(valerie, foe(50), 'legs', 55), 32);
});

// ---------------------------------------------------------------- purity

test('nothing mutates its input: every function works on deep-frozen combatants', () => {
  const make = () => deepFreeze(JSON.parse(JSON.stringify(
    applyBind(applyBind(fighter(300, {}, { flags: { bindResist: { head: 10, arms: 20, legs: 30 }, bindCount: { arms: 1 }, airhead: 60 } }), 'arms', 2), 'legs', 1, { ownTurn: true }),
  )));
  const target = make();
  const binder = make();
  const snapshot = JSON.stringify(target);
  const skill = deepFreeze({ ...SKILLS.cleave });
  const calls = [
    () => applyBind(target, 'head', 3),
    () => applyBind(target, 'arms', 5, { ownTurn: true, count: true }),
    () => tryBind(binder, target, 'head', 55, 2, dice([1])),
    () => tryBind(binder, target, 'arms', 55, 2, dice([50])),
    () => tryBind(binder, target, 'legs', 55, 2, dice([99])),
    () => tryBind(binder, target, 'legs', 55, 2, undefined, { roll: 12 }),
    () => tickBinds(target),
    () => cureBinds(target),
    () => cureBinds(target, 'legs'),
    () => struggle(target),
    () => struggle(target, 'legs'),
    () => endBattleBinds(target),
    () => bindOdds(binder, target, 'arms', 55),
    () => isSealed(target, skill),
    () => usableSkills(target, deepFreeze([skill, BASIC_ATTACK])),
    () => boundParts(target),
    () => isTrussed(target),
  ];
  for (const [i, call] of calls.entries()) {
    const result = call();
    for (const out of [result, result?.combatant, result?.attacker]) {
      if (out && typeof out === 'object' && 'binds' in out) {
        assert.notEqual(out, target, `call ${i} returned its input`);
        assert.notEqual(out.binds, target.binds, `call ${i} shares the binds object`);
        assert.notEqual(out.flags, target.flags, `call ${i} shares the flags object`);
      }
    }
    assert.equal(JSON.stringify(target), snapshot, `call ${i} changed its input`);
    assert.equal(JSON.stringify(binder), snapshot, `call ${i} changed the binder`);
  }
  // Flags that belong to other systems ride along untouched.
  assert.equal(tickBinds(target).flags.airhead, 60);
  assert.equal(endBattleBinds(target).flags.airhead, 60);
  assert.deepEqual(endBattleBinds(target).flags.bindResist, { head: 10, arms: 20, legs: 30 });
});

test('the replay helper returns exactly the rolls it was given', () => {
  for (let roll = 1; roll <= 100; roll++) assert.equal(d100(dice([roll])), roll);
});
