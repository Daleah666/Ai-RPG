// The seams: real archetype data through the real combat math, and Valerie's kit through both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, fixedRolls } from '../engine/rng.js';
import { makeCombatant } from '../engine/stats.js';
import { readData } from '../engine/data-node.js';
import { statsAt, maxHp, maxMp } from '../engine/progression.js';
import { BASIC_ATTACK, damage, hitsToKill, hitChance, stressTaken } from '../engine/combat.js';
import { enemyAttacksValerie, valerieAttacks, stressOnValerie } from '../engine/valerie-combat.js';

const archetypes = readData('archetypes').archetypes;
const valerieData = readData('valerie');
const klutz = valerieData.archetype;
const at = (archetype, level, extra = {}) => {
  const stats = statsAt(archetype, level);
  return makeCombatant({ id: archetype.id, level, archetype: archetype.id, stats, maxHp: maxHp(level, stats.CON), hp: maxHp(level, stats.CON), ...extra });
};
const val = (level, airhead, extra = {}) => at(klutz, level, { id: 'valerie', flags: { airhead, ...(extra.flags ?? {}) } });
const arrow = { ...BASIC_ATTACK, id: 'x_arrow', name: 'Arrow', tags: ['ranged', 'projectile'] };

test('A2 on real data: every archetype, the hero included, takes 6-14 landed basic hits to drop its own mirror', () => {
  for (const archetype of [...archetypes, klutz]) for (const level of [1, 25, 50, 75, 100]) {
    const c = at(archetype, level);
    const hits = hitsToKill(c, c, BASIC_ATTACK);
    assert.ok(hits >= 6 && hits <= 14, `${archetype.id} L${level}: ${hits} hits`);
  }
});

test('the triangle: each class has a soft side, measured as the share of its own HP one hit removes', () => {
  // One neutral attacker whose blade and spell hit equally hard, so only the defender differs.
  const spell = { ...BASIC_ATTACK, id: 'x_spell', type: 'magical', stat: 'INT', element: 'fire', tags: [] };
  for (const level of [10, 50, 100]) {
    const [warrior, mage, rogue] = ['warrior', 'mage', 'rogue'].map((id) => at(archetypes.find((a) => a.id === id), level));
    const power = warrior.stats.STR;
    const attacker = makeCombatant({ level, stats: { STR: power, INT: power, AGI: warrior.stats.AGI, CON: power, WIL: power, LCK: warrior.stats.LCK } });
    const share = (defender, skill) => damage(attacker, defender, skill) / defender.maxHp;
    // Warrior: magic gets through where blades do not.
    assert.ok(share(warrior, spell) > share(warrior, BASIC_ATTACK) * 1.2, `L${level} warrior`);
    // Mage: the reverse, and a blade costs a mage far more of its bar than it costs a warrior.
    assert.ok(share(mage, BASIC_ATTACK) > share(mage, spell) * 1.1, `L${level} mage`);
    assert.ok(share(mage, BASIC_ATTACK) > share(warrior, BASIC_ATTACK) * 1.5, `L${level} mage vs warrior`);
    // Rogue: the thinnest bar against everything, and the hardest of the three to hit.
    assert.ok(share(rogue, BASIC_ATTACK) > share(warrior, BASIC_ATTACK) * 1.5, `L${level} rogue blade`);
    assert.ok(share(rogue, spell) > share(mage, spell), `L${level} rogue spell`);
    assert.ok(hitChance(attacker, rogue).hitPct < hitChance(attacker, mage).hitPct, `L${level} rogue evasion`);
    assert.ok(hitChance(attacker, rogue).hitPct < hitChance(attacker, warrior).hitPct, `L${level} rogue evasion`);
  }
});

test('stress finds the warrior first: by the endgame a mage shrugs off far more of it', () => {
  const [warrior, mage] = ['warrior', 'mage'].map((id) => at(archetypes.find((a) => a.id === id), 100));
  assert.ok(stressTaken(20, warrior) >= stressTaken(20, mage) + 3);
});

test('every skill in the hero tree is affordable at the level it unlocks', () => {
  for (const s of valerieData.skills) {
    const pool = maxMp(s.unlock, statsAt(klutz, s.unlock).WIL);
    assert.ok(s.cost.mp <= pool, `${s.id} costs ${s.cost.mp} of ${pool}`);
    if (s.tags.includes('ultimate')) assert.ok(s.cost.limit > 0, `${s.id} is an ultimate and must cost Limit`);
  }
});

test('an enemy swinging at a Total Airhead: the ceiling, the bounce and the fumble band are all on one d100', () => {
  const v = val(50, 100);
  const archer = at(archetypes.find((a) => a.id === 'rogue'), 50);
  const plain = hitChance(archer, v, arrow);
  assert.ok(plain.hitPct > 55, 'without her kit the rogue hits more often than the ceiling allows');
  const tally = { crit: 0, hit: 0, bounce: 0, miss: 0, fumble: 0 };
  for (let roll = 1; roll <= 100; roll++) {
    const r = enemyAttacksValerie(archer, v, arrow, fixedRolls([roll, 50]));
    tally[r.outcome]++;
    assert.equal(r.hitPct, 55);
    assert.equal(r.fumbleFrom, 86);
    if (r.outcome === 'hit' || r.outcome === 'crit') assert.ok(r.damage > 0 && r.reflected === 0);
    if (r.outcome === 'bounce') assert.ok(r.reflected > 0 && r.damage === 0 && r.limitGain > 0);
    if (r.outcome === 'fumble') assert.ok(['head', 'arms', 'legs'].includes(r.selfBind) && r.damage === 0);
    if (r.outcome === 'miss') assert.equal(r.damage + r.reflected, 0);
  }
  assert.equal(tally.crit + tally.hit + tally.bounce + tally.miss + tally.fumble, 100);
  assert.equal(tally.fumble, 15);
  assert.ok(tally.bounce >= 25, `bounce band was ${tally.bounce}`);
  assert.ok(tally.hit + tally.crit <= 30, `she was still hit on ${tally.hit + tally.crit} rolls`);
});

test('the same enemy against a Lucid Valerie hits far more often, and nothing bounces off a melee blow', () => {
  const archer = at(archetypes.find((a) => a.id === 'rogue'), 50);
  const count = (v, skill) => {
    let landed = 0; let bounced = 0;
    for (let roll = 1; roll <= 100; roll++) {
      const r = enemyAttacksValerie(archer, v, skill, fixedRolls([roll, 50]));
      if (r.outcome === 'hit' || r.outcome === 'crit') landed++;
      if (r.outcome === 'bounce') bounced++;
    }
    return { landed, bounced };
  };
  assert.ok(count(val(50, 0), arrow).landed > count(val(50, 100), arrow).landed + 30);
  assert.equal(count(val(50, 100), BASIC_ATTACK).bounced, 0);
});

test('guarding trades the dodge for half damage: the choice is real in both directions', () => {
  const v = val(50, 100);
  const brute = at(archetypes.find((a) => a.id === 'warrior'), 50);
  const open = enemyAttacksValerie(brute, v, BASIC_ATTACK, fixedRolls([40, 50]));
  const guarded = enemyAttacksValerie(brute, v, BASIC_ATTACK, fixedRolls([40, 50]), { guarding: true });
  assert.ok(guarded.hitPct > open.hitPct, 'guarding gives up the lowered ceiling');
  assert.equal(guarded.damage, Math.floor(open.damage / 2));
  // A roll the dodge would have turned into a miss lands when she guards.
  assert.equal(enemyAttacksValerie(brute, v, BASIC_ATTACK, fixedRolls([60, 50])).outcome, 'miss');
  assert.equal(enemyAttacksValerie(brute, v, BASIC_ATTACK, fixedRolls([60, 50]), { guarding: true }).outcome, 'hit');
});

test('a reflected shot is resolved against the shooter, so a tough shooter takes less from its own arrow', () => {
  const v = val(50, 100);
  const frail = makeCombatant({ level: 50, stats: { STR: 300, INT: 100, AGI: 300, CON: 150, WIL: 100, LCK: 100 } });
  const tough = makeCombatant({ level: 50, stats: { STR: 300, INT: 100, AGI: 300, CON: 600, WIL: 100, LCK: 100 } });
  const bounceRoll = (shooter) => {
    for (let roll = 1; roll <= 100; roll++) {
      const r = enemyAttacksValerie(shooter, v, arrow, fixedRolls([roll, 50]));
      if (r.outcome === 'bounce') return r;
    }
    throw new Error('no bounce band');
  };
  assert.ok(bounceRoll(frail).reflected > bounceRoll(tough).reflected);
});

test('Valerie winging it: a fumble is a Chaos Wave, and the stance always charges its price', () => {
  const v = val(50, 100);
  const dummy = at(archetypes.find((a) => a.id === 'warrior'), 50);
  const fumble = valerieAttacks(v, dummy, BASIC_ATTACK, 'wing', fixedRolls([80]));
  assert.equal(fumble.outcome, 'fumble');
  assert.equal(fumble.damage, 0);
  assert.equal(fumble.wave.id, 'val_chaos_wave');
  assert.equal(fumble.airheadDelta, 10);
  assert.ok(fumble.stress.amount < 0);
  const jackpot = valerieAttacks(v, dummy, BASIC_ATTACK, 'wing', fixedRolls([100]));
  assert.equal(jackpot.wave.jackpot, true);
  const hit = valerieAttacks(v, dummy, BASIC_ATTACK, 'wing', fixedRolls([20, 50]));
  assert.equal(hit.outcome, 'hit');
  assert.equal(hit.wave, null);
  assert.ok(hit.damage > 0);
});

test('Valerie thinking: the same roll that fumbled now lands, there is no wave, and it costs realization stress', () => {
  const v = val(50, 20);
  const dummy = at(archetypes.find((a) => a.id === 'warrior'), 50);
  const r = valerieAttacks(v, dummy, BASIC_ATTACK, 'think', fixedRolls([80, 50]));
  assert.ok(['hit', 'miss'].includes(r.outcome));
  assert.equal(r.wave, null);
  assert.equal(r.airheadDelta, -15);
  assert.deepEqual(r.stress, { amount: 4, source: 'realization' });
  assert.equal(valerieAttacks(v, dummy, BASIC_ATTACK, 'think', fixedRolls([97])).wave, null);
});

test('planned skills refuse the wrong stance and a full gauge; sweeping skills refuse a clear head', () => {
  const dummy = at(archetypes.find((a) => a.id === 'warrior'), 50);
  const calledShot = valerieData.skills.find((s) => s.id === 'val_called_shot');
  const spinCycle = valerieData.skills.find((s) => s.id === 'val_spin_cycle');
  assert.throws(() => valerieAttacks(val(50, 20), dummy, calledShot, 'wing', makeRng(1)), /needs the "think" stance/);
  assert.throws(() => valerieAttacks(val(50, 90), dummy, calledShot, 'think', makeRng(1)), /sealed/);
  assert.throws(() => valerieAttacks(val(50, 10), dummy, spinCycle, 'wing', makeRng(1)), /sealed/);
  assert.ok(valerieAttacks(val(50, 20), dummy, calledShot, 'think', fixedRolls([10, 50])).damage > 0);
});

test('thinking is more accurate and winging is wilder, over a thousand seeded swings', () => {
  const dummy = at(archetypes.find((a) => a.id === 'rogue'), 50);
  const run = (stance, gauge) => {
    const rng = makeRng(2026);
    const t = { landed: 0, waves: 0 };
    for (let i = 0; i < 1000; i++) {
      const r = valerieAttacks(val(50, gauge), dummy, BASIC_ATTACK, stance, rng);
      if (r.outcome === 'hit' || r.outcome === 'crit') t.landed++;
      if (r.wave) t.waves++;
    }
    return t;
  };
  const think = run('think', 20);
  const wing = run('wing', 100);
  assert.ok(think.landed > wing.landed, `think ${think.landed} vs wing ${wing.landed}`);
  assert.equal(think.waves, 0);
  assert.ok(wing.waves > 180 && wing.waves < 320, `waves: ${wing.waves}`);
});

test('stress on Valerie: fear slides off, the truth does not', () => {
  const airhead = val(50, 90);
  const lucid = val(50, 10);
  assert.deepEqual(stressOnValerie(airhead, 30, 'horror'), { taken: 0, allyRelief: 3, airheadDelta: 0, note: 'She did not notice it was scary.' });
  assert.ok(stressOnValerie(lucid, 30, 'horror').taken > 0);
  assert.ok(stressOnValerie(lucid, 30, 'horror').taken < 30, 'Willpower still mitigates ordinary fear when she is Lucid');
  const truth = stressOnValerie(airhead, 30, 'realization');
  assert.equal(truth.taken, 30, 'realization ignores Willpower');
  assert.equal(truth.airheadDelta, -10);
  assert.equal(stressOnValerie(airhead, -10, 'general').taken, -10);
});

// ---------- the hero through the stress and bind systems ----------
import { applyStressToValerie, partyResolveCheck, befuddle } from '../engine/valerie-combat.js';
import { resolveBands, validateResolveTables } from '../engine/stress.js';
import { boundParts, isSealed } from '../engine/binds.js';
import { airheadOf, passiveAirhead, incomingOpts, shiftAirhead } from '../engine/valerie.js';
import { effectiveStat } from '../engine/stats.js';

const tables = { afflictions: readData('afflictions').afflictions, virtues: readData('virtues').virtues };
const personal = valerieData.resolve;

test('the shipped Resolve tables are valid and fill the d100 exactly', () => {
  assert.equal(validateResolveTables(tables).ok, true);
  const bands = resolveBands(tables, 0);
  assert.equal(bands[0].lo, 1);
  assert.equal(bands.at(-1).hi, 100);
  for (let i = 1; i < bands.length; i++) assert.equal(bands[i].lo, bands[i - 1].hi + 1);
});

test('stress reaches her bar through her filter: fear does nothing, the truth lands in full and drops the gauge', () => {
  const v = val(50, 90);
  const scared = applyStressToValerie(v, 30, 'horror');
  assert.equal(scared.taken, 0);
  assert.equal(scared.combatant.stress, 0);
  assert.equal(scared.allyRelief, 3);
  const told = applyStressToValerie(v, 30, 'realization');
  assert.equal(told.taken, 30);
  assert.equal(told.combatant.stress, 30);
  assert.equal(airheadOf(told.combatant), 80);
  assert.equal(airheadOf(v), 90, 'the input is not mutated');
});

test('enough truth takes her to a Resolve Check', () => {
  let v = val(50, 90, { stress: 0 });
  let event = null;
  for (let i = 0; i < 4 && !event; i++) {
    const r = applyStressToValerie(v, 30, 'realization');
    v = r.combatant;
    event = r.event;
  }
  assert.equal(event, 'resolve');
  assert.ok(v.stress >= 100);
});

test('her Resolve Check: an odd roll reads the table, an even roll is one of her own', () => {
  const v = { ...val(50, 60), stress: 100 };
  const odd = partyResolveCheck(v, [], fixedRolls([61]), { tables, personal });
  assert.equal(odd.kind, 'affliction');
  assert.equal(odd.personal, false);
  assert.ok(tables.afflictions.some((a) => a.id === odd.entry.id));
  const evenBad = partyResolveCheck(v, [], fixedRolls([60]), { tables, personal });
  assert.equal(evenBad.kind, 'affliction');
  assert.equal(evenBad.personal, true);
  assert.equal(evenBad.entry.id, 'aff_val_self_aware');
  const evenGood = partyResolveCheck(v, [], fixedRolls([12]), { tables, personal });
  assert.equal(evenGood.kind, 'virtue');
  assert.equal(evenGood.entry.id, 'vir_val_good_hero');
});

test('Self-Aware locks the gauge at 0: the accidents go quiet, planned skills open up, and the party feels it', () => {
  const v = { ...val(50, 95), stress: 100 };
  const rc = partyResolveCheck(v, [], fixedRolls([60]), { tables, personal });
  const aware = rc.combatant;
  assert.equal(airheadOf(aware), 0);
  assert.equal(passiveAirhead(aware), 0);
  assert.equal(incomingOpts(aware, at(archetypes[0], 50), BASIC_ATTACK).hitCap, 95, 'no more accidental dodging');
  assert.equal(airheadOf(shiftAirhead(aware, 40)), 0, 'winging it cannot move a locked gauge');
  assert.ok(effectiveStat(aware, 'LCK') < effectiveStat(v, 'LCK'));
  assert.equal(rc.party.stress, 5, 'allies who relied on her nerve take stress');
  const calledShot = valerieData.skills.find((s) => s.id === 'val_called_shot');
  assert.ok(valerieAttacks(aware, at(archetypes[0], 50), calledShot, 'think', fixedRolls([10, 50])).damage > 0);
});

test('A Good Hero: stress stops reaching her and the party sheds some', () => {
  const v = { ...val(50, 60), stress: 100 };
  const rc = partyResolveCheck(v, [], fixedRolls([12]), { tables, personal });
  assert.equal(rc.combatant.stress, 60);
  assert.equal(rc.party.stress, -10);
  assert.equal(applyStressToValerie(rc.combatant, 40, 'realization').taken, 0);
  assert.equal(applyStressToValerie(rc.combatant, 40, 'general').taken, 0);
});

test('she lends allies Virtue chance: +10 as a Total Airhead, nothing when Lucid or down', () => {
  const warrior = { ...at(archetypes.find((a) => a.id === 'warrior'), 50), stress: 100 };
  const pct = (others) => partyResolveCheck(warrior, others, fixedRolls([50]), { tables, personal }).virtuePct;
  assert.equal(pct([]), 25);
  assert.equal(pct([val(50, 90)]), 35);
  assert.equal(pct([val(50, 50)]), 30);
  assert.equal(pct([val(50, 10)]), 25);
  assert.equal(pct([{ ...val(50, 90), hp: 0 }]), 25);
  // A roll of 30 is an Affliction alone and a Virtue with her beside you.
  assert.equal(partyResolveCheck(warrior, [], fixedRolls([31]), { tables, personal }).kind, 'affliction');
  assert.equal(partyResolveCheck(warrior, [val(50, 90)], fixedRolls([31]), { tables, personal }).kind, 'virtue');
  // An ally never gets her personal entries, even on an even roll.
  assert.equal(partyResolveCheck(warrior, [val(50, 90)], fixedRolls([60]), { tables, personal }).personal, false);
});

test('an enemy that fumbles inside her aura binds its own part for a turn, read off the same roll', () => {
  const v = val(50, 100);
  const brute = at(archetypes.find((a) => a.id === 'warrior'), 50);
  const swing = enemyAttacksValerie(brute, v, BASIC_ATTACK, fixedRolls([97]));
  assert.equal(swing.outcome, 'fumble');
  const { part, combatant } = befuddle(brute, swing.roll);
  assert.equal(part, swing.selfBind);
  assert.deepEqual(boundParts(combatant), [part]);
  assert.deepEqual(boundParts(brute), [], 'the input is not mutated');
});

test('bound arms seal her weapon skills but never her basic attack', () => {
  const dummy = at(archetypes.find((a) => a.id === 'warrior'), 50);
  const bound = { ...val(50, 20), binds: { head: 0, arms: 2, legs: 0 } };
  const calledShot = valerieData.skills.find((s) => s.id === 'val_called_shot');
  assert.equal(isSealed(bound, calledShot), true);
  assert.throws(() => valerieAttacks(bound, dummy, calledShot, 'think', fixedRolls([10, 50])), /bound/);
  const basic = valerieAttacks(bound, dummy, BASIC_ATTACK, 'think', fixedRolls([10, 50]));
  const free = valerieAttacks(val(50, 20), dummy, BASIC_ATTACK, 'think', fixedRolls([10, 50]));
  assert.ok(basic.damage > 0 && basic.damage < free.damage, 'halved Might, not a lost turn');
});
