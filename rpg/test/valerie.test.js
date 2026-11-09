import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCombatant } from '../engine/stats.js';
import {
  AIRHEAD, airheadBand, airheadOf, passiveAirhead, shiftAirhead, stanceEffects, canUseInBand, incomingOpts, readIncoming,
  befuddledPart, chaosWave, stressFilter, resolveShiftForAllies, stancePct, pocketSlots, misplacePct, foundPct,
} from '../engine/valerie.js';
import { readData } from '../engine/data-node.js';

const val = (airhead, extra = {}) => makeCombatant({
  id: 'valerie', level: 50, stats: { STR: 320, INT: 155, AGI: 237, CON: 370, WIL: 206, LCK: 412 }, flags: { airhead }, ...extra,
});
const archer = makeCombatant({ id: 'archer', level: 50, stats: { STR: 300, INT: 100, AGI: 300, CON: 250, WIL: 150, LCK: 150 } });
const arrow = { id: 'x_arrow', tags: ['ranged', 'projectile'] };
const club = { id: 'x_club', tags: ['melee'] };

test('the gauge has three bands with the documented edges', () => {
  assert.equal(airheadBand(0), 'lucid');
  assert.equal(airheadBand(33), 'lucid');
  assert.equal(airheadBand(34), 'ditzy');
  assert.equal(airheadBand(66), 'ditzy');
  assert.equal(airheadBand(67), 'airhead');
  assert.equal(airheadBand(100), 'airhead');
  assert.equal(airheadOf(makeCombatant({})), AIRHEAD.START);
});

test('shiftAirhead clamps and does not mutate', () => {
  const v = val(95);
  assert.equal(airheadOf(shiftAirhead(v, 30)), 100);
  assert.equal(airheadOf(shiftAirhead(v, -200)), 0);
  assert.equal(airheadOf(v), 95);
});

test('Wing It raises the gauge, relieves stress and widens her fumble band', () => {
  const fx = stanceEffects(val(100), 'wing');
  assert.equal(fx.airheadDelta, 10);
  assert.ok(fx.stress.amount < 0);
  assert.equal(fx.opts.fumbleFrom, 76);
  assert.equal(stanceEffects(val(0), 'wing').opts.fumbleFrom, 96);
});

test('Think It Through lowers the gauge, costs realization stress and sharpens the roll', () => {
  const fx = stanceEffects(val(80), 'think');
  assert.equal(fx.airheadDelta, -15);
  assert.deepEqual(fx.stress, { amount: 4, source: 'realization' });
  assert.equal(fx.opts.hitBonus, 15);
  assert.equal(fx.opts.fumbleFrom, 96);
  assert.throws(() => stanceEffects(val(50), 'vibes'));
});

test('planned skills are sealed for a Total Airhead', () => {
  const calledShot = { id: 'val_called_shot', bands: ['lucid', 'ditzy'] };
  assert.equal(canUseInBand(val(20), calledShot), true);
  assert.equal(canUseInBand(val(80), calledShot), false);
  assert.equal(canUseInBand(val(80), { id: 'val_big_swing' }), true);
});

test('Unintentional Dodge lowers the enemy hit ceiling with the gauge; guarding turns it off', () => {
  assert.equal(incomingOpts(val(0), archer, club).hitCap, 95);
  assert.equal(incomingOpts(val(60), archer, club).hitCap, 71);
  assert.equal(incomingOpts(val(100), archer, club).hitCap, 55);
  assert.equal(incomingOpts(val(100), archer, club, { guarding: true }).hitCap, 95);
});

test('Aura of Befuddlement widens the enemy fumble band up to 86..100', () => {
  assert.equal(incomingOpts(val(0), archer, club).fumbleFrom, 96);
  assert.equal(incomingOpts(val(100), archer, club).fumbleFrom, 86);
  assert.ok(['head', 'arms', 'legs'].includes(befuddledPart(97)));
  assert.notEqual(befuddledPart(96), befuddledPart(97));
});

test('Kinetic Deflection only answers projectiles and grows with gauge and luck', () => {
  assert.equal(incomingOpts(val(100), archer, club).bounce, 0);
  const low = incomingOpts(val(0), archer, arrow).bounce;
  const high = incomingOpts(val(100), archer, arrow).bounce;
  assert.ok(high > low);
  assert.ok(high >= 25 && high <= 35, `bounce at full gauge was ${high}`);
});

test('readIncoming: the bounce band is the top of the hit band and never eats the crit band', () => {
  const bands = { hitPct: 55, critPct: 5, fumbleFrom: 86, bounce: 30 };
  assert.equal(readIncoming(3, bands), 'crit');
  assert.equal(readIncoming(20, bands), 'hit');
  assert.equal(readIncoming(25, bands), 'hit');
  assert.equal(readIncoming(26, bands), 'bounce');
  assert.equal(readIncoming(55, bands), 'bounce');
  assert.equal(readIncoming(56, bands), 'miss');
  assert.equal(readIncoming(90, bands), 'fumble');
  // A bounce band wider than the hit band still leaves crits alone.
  assert.equal(readIncoming(5, { hitPct: 20, critPct: 5, bounce: 90 }), 'crit');
  assert.equal(readIncoming(6, { hitPct: 20, critPct: 5, bounce: 90 }), 'bounce');
});

test('every d100 result against her lands in exactly one band', () => {
  for (const gauge of [0, 60, 100]) {
    const opts = incomingOpts(val(gauge), archer, arrow);
    const hitPct = Math.min(80, opts.hitCap);
    const tally = { crit: 0, hit: 0, bounce: 0, miss: 0, fumble: 0 };
    for (let roll = 1; roll <= 100; roll++) tally[readIncoming(roll, { hitPct, critPct: 5, fumbleFrom: opts.fumbleFrom, bounce: opts.bounce })]++;
    assert.equal(Object.values(tally).reduce((a, b) => a + b, 0), 100);
    assert.equal(tally.crit, 5);
  }
});

test('Accidental Chaos Wave only fires in Wing It, and 100 is the jackpot', () => {
  assert.equal(chaosWave(val(80), 97, 'think'), null);
  const wave = chaosWave(val(80), 97, 'wing');
  assert.equal(wave.jackpot, false);
  assert.ok(wave.effects.some((e) => e.kind === 'mod' && e.stat === 'AGI'));
  assert.ok(wave.effects.some((e) => e.kind === 'contraption'));
  const jackpot = chaosWave(val(80), 100, 'wing');
  assert.equal(jackpot.jackpot, true);
  assert.ok(jackpot.effects.some((e) => e.kind === 'damage'));
});

test('Inspirational Ignorance: fear does not land unless she is Lucid, and allies take heart', () => {
  assert.deepEqual(stressFilter(val(80), 30, 'horror').amount, 0);
  assert.ok(stressFilter(val(80), 30, 'horror').allyRelief > 0);
  assert.equal(stressFilter(val(10), 30, 'horror').amount, 30);
  assert.equal(stressFilter(val(10), 30, 'horror').allyRelief, 0);
});

test('the price: realization ignores Willpower and drops the gauge; embarrassment stings unless she is too far gone', () => {
  const r = stressFilter(val(80), 12, 'realization');
  assert.equal(r.amount, 12);
  assert.equal(r.ignoreWill, true);
  assert.equal(r.airheadDelta, -10);
  assert.equal(stressFilter(val(50), 10, 'embarrassment').amount, 15);
  assert.equal(stressFilter(val(90), 10, 'embarrassment').amount, 0);
  assert.equal(stressFilter(val(90), -10, 'horror').amount, -10);
});

test('she lends allies Virtue chance only while standing, more the further gone she is', () => {
  assert.equal(resolveShiftForAllies(val(10)), 0);
  assert.equal(resolveShiftForAllies(val(50)), 5);
  assert.equal(resolveShiftForAllies(val(90)), 10);
  assert.equal(resolveShiftForAllies(val(90, { hp: 0 })), 0);
});

test('her ultimate pins the passive gauge at 100 without touching the stored value', () => {
  const v = val(10, { flags: { airhead: 10, goodHeroTurns: 3 } });
  assert.equal(passiveAirhead(v), 100);
  assert.equal(airheadOf(v), 10);
  assert.equal(incomingOpts(v, archer, club).hitCap, 55);
});

test('a flipped ledger runs her luck backwards: passives read 100 minus the gauge, and the ultimate still wins', () => {
  const flipped = val(90, { flags: { airhead: 90, ledgerFlipped: true } });
  assert.equal(passiveAirhead(flipped), 10);
  assert.equal(airheadOf(flipped), 90);
  assert.equal(incomingOpts(flipped, archer, club).hitCap, 91, 'a Total Airhead is easy to hit while the ledger is flipped');
  const lucidFlipped = val(10, { flags: { airhead: 10, ledgerFlipped: true } });
  assert.equal(incomingOpts(lucidFlipped, archer, club).hitCap, 59, 'and a Lucid one has the luck');
  const both = val(90, { flags: { airhead: 90, ledgerFlipped: true, goodHeroTurns: 2 } });
  assert.equal(passiveAirhead(both), 100);
});

test('out of combat: the gauge helps Wing It and hurts Think It Through', () => {
  const dc = 300;
  assert.ok(stancePct(val(100), 'wing', dc) > stancePct(val(0), 'wing', dc));
  assert.ok(stancePct(val(0), 'think', dc) > stancePct(val(100), 'think', dc));
  for (const gauge of [0, 50, 100]) for (const stance of ['wing', 'think']) {
    const pct = stancePct(val(gauge), stance, dc);
    assert.ok(pct >= 5 && pct <= 95);
  }
});

test('Pocket Dimension numbers stay bounded', () => {
  assert.equal(pocketSlots(1), 3);
  assert.equal(pocketSlots(100), 8);
  assert.equal(misplacePct(val(0)), 10);
  assert.equal(misplacePct(val(100)), 35);
  for (const gauge of [0, 100]) assert.ok(foundPct(val(gauge)) >= 5 && foundPct(val(gauge)) <= 95);
  assert.ok(foundPct(val(100)) > foundPct(val(0)));
});

test('valerie.json: archetype obeys the budget and every skill names real things', () => {
  const data = readData('valerie');
  const { l1, l100, signature } = data.archetype;
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(l1), 70);
  assert.equal(sum(l100), 3300);
  assert.equal(l100[signature], 800);
  for (const v of Object.values(l1)) assert.ok(v >= 8 && v <= 16);
  for (const [k, v] of Object.entries(l100)) assert.ok(v >= 300 && (k === signature || v <= 760));
  const ids = new Set();
  for (const s of [...data.abilities, ...data.skills]) {
    assert.match(s.id, /^val_[a-z0-9_]+$/);
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.ok(s.unlock >= 1 && s.unlock <= 100);
  }
  assert.equal(data.abilities.length, 6);
  for (const a of data.abilities) assert.ok(a.choice && a.rule && a.fiction, `${a.id} needs rule, fiction and choice`);
});
