import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fixedRolls, makeRng } from '../engine/rng.js';
import { makeCombatant } from '../engine/stats.js';
import {
  PACK_FORMAT, validatePack, isEligible, eligibleEvents, drawEvent, choicePct, resolveChoice, applyEffects, toMoment, fromMoments, toLoreEntry,
} from '../engine/events.js';

const packsDir = new URL('../events/packs/', import.meta.url);
const packs = readdirSync(packsDir).filter((f) => f.endsWith('.events.json')).map((f) => JSON.parse(readFileSync(new URL(f, packsDir), 'utf8')));
const starter = packs.find((p) => p.pack.id === 'valerie-starter');
const valerie = (airhead = 60, level = 10) => makeCombatant({
  id: 'valerie', level, stats: { STR: 69, INT: 35, AGI: 51, CON: 78, WIL: 45, LCK: 87 }, flags: { airhead },
});

test('every shipped pack is valid', () => {
  assert.ok(packs.length >= 1);
  for (const pack of packs) {
    const { ok, errors } = validatePack(pack);
    assert.ok(ok, `${pack.pack?.id}: ${errors.join('; ')}`);
  }
});

test('every shipped event offers a real choice', () => {
  for (const event of starter.events) assert.ok(event.choices.length >= 2, `${event.id} has only one choice`);
});

test('validatePack explains what is wrong with a bad pack and never throws', () => {
  assert.equal(validatePack(null).ok, false);
  assert.equal(validatePack('nope').ok, false);
  const bad = {
    pack: { format: 'something-else', id: 'Bad Id', name: '', rating: 'r18' },
    events: [{ id: 'x', title: 'T', t: 't', scene: 's', choices: [{ id: 'a', label: 'A', check: { stat: 'CHA' }, success: { text: 'ok', effects: [{ kind: 'run_code' }] } }] }],
  };
  const { ok, errors } = validatePack(bad);
  assert.equal(ok, false);
  const all = errors.join('\n');
  assert.match(all, /pack\.format/);
  assert.match(all, /pack\.id/);
  assert.match(all, /pack\.rating/);
  assert.match(all, /check\.stat/);
  assert.match(all, /needs difficulty/);
  assert.match(all, /unknown effect kind "run_code"/);
});

test('a foreign pack cannot smuggle in an effect the rules do not know', () => {
  const pack = JSON.parse(JSON.stringify(starter));
  pack.events[0].choices[0].success.effects.push({ kind: 'delete_save' });
  assert.equal(validatePack(pack).ok, false);
});

test('eligibility honours level, place, flags and once', () => {
  const wake = starter.events.find((e) => e.id === 'val.wrong_body_right_sword');
  assert.equal(isEligible(wake, { level: 1, where: 'forest' }), true);
  assert.equal(isEligible(wake, { level: 2, where: 'forest' }), false);
  assert.equal(isEligible(wake, { level: 1, where: 'town' }), false);
  assert.equal(isEligible(wake, { level: 1, where: 'forest', seen: ['val.wrong_body_right_sword'] }), false);
  const mirror = starter.events.find((e) => e.id === 'val.the_mirror_shows_someone_else');
  assert.equal(isEligible(mirror, { level: 5, where: 'inn', flags: {} }), false);
  assert.equal(isEligible(mirror, { level: 5, where: 'inn', flags: { knows_isekai: true } }), true);
  const squire = starter.events.find((e) => e.id === 'val.a_squire_with_a_notebook');
  assert.equal(isEligible(squire, { level: 5, where: 'town', flags: { tamsin_met: true } }), false);
  // A repeatable event stays eligible after it has been seen.
  const lunch = starter.events.find((e) => e.id === 'val.where_did_i_put_lunch');
  assert.equal(isEligible(lunch, { level: 5, where: 'camp', seen: [lunch.id] }), true);
});

test('drawEvent only returns eligible events and is repeatable from a seed', () => {
  const ctx = { level: 6, where: 'town', flags: {} };
  const pool = eligibleEvents(packs, ctx).map((e) => e.id);
  assert.ok(pool.length >= 2);
  const a = drawEvent(packs, ctx, makeRng(9));
  const b = drawEvent(packs, ctx, makeRng(9));
  assert.equal(a.id, b.id);
  assert.ok(pool.includes(a.id));
  assert.equal(drawEvent(packs, { level: 1, where: 'the_moon' }, makeRng(1)), null);
});

test('every check in the starter pack gives a bounded chance at every level and gauge', () => {
  for (const level of [1, 10, 50, 100]) for (const gauge of [0, 60, 100]) for (const event of starter.events) for (const choice of event.choices) {
    const pct = choicePct(choice, valerie(gauge, level));
    if (pct !== null) assert.ok(pct >= 5 && pct <= 95, `${event.id}/${choice.id} gave ${pct}`);
  }
});

test('the gauge pulls Wing It and Think It Through choices in opposite directions', () => {
  const bridge = starter.events.find((e) => e.id === 'val.rope_bridge_has_opinions');
  const run = bridge.choices.find((c) => c.id === 'run');
  const test_ = bridge.choices.find((c) => c.id === 'test_planks');
  assert.ok(choicePct(run, valerie(100)) > choicePct(run, valerie(0)));
  assert.ok(choicePct(test_, valerie(0)) > choicePct(test_, valerie(100)));
});

test('resolveChoice rolls once and picks the branch the author wrote', () => {
  const lever = starter.events.find((e) => e.id === 'val.do_not_pull');
  const v = valerie(60);
  assert.equal(resolveChoice(lever, 'back_into_it', v, fixedRolls([1])).branch, 'crit');
  assert.equal(resolveChoice(lever, 'back_into_it', v, fixedRolls([20])).branch, 'success');
  assert.equal(resolveChoice(lever, 'back_into_it', v, fixedRolls([99])).branch, 'failure');
  const squire = starter.events.find((e) => e.id === 'val.a_squire_with_a_notebook');
  const auto = resolveChoice(squire, 'welcome_aboard', v, fixedRolls([]));
  assert.equal(auto.roll, null);
  assert.equal(auto.branch, 'success');
  assert.throws(() => resolveChoice(lever, 'nope', v, fixedRolls([1])));
});

test('applyEffects clamps every bar and hands combat effects back as pending', () => {
  const start = { stress: 190, airhead: 95, limit: 90, gold: 10, exp: 0, items: { itm_packed_lunch: 1 }, flags: {}, moments: [] };
  const { state, pending } = applyEffects(start, [
    { kind: 'stress', amount: 50 },
    { kind: 'airhead', amount: 50 },
    { kind: 'limit', amount: 50 },
    { kind: 'gold', amount: -500 },
    { kind: 'exp', levelShare: 0.5 },
    { kind: 'misplace', id: 'itm_packed_lunch' },
    { kind: 'flag', set: 'tamsin_met' },
    { kind: 'moment', title: 'A', t: 'b', tags: ['x'], imp: 9 },
    { kind: 'battle', encounter: 'goblin_scouts' },
    { kind: 'bind', part: 'legs', turns: 2 },
  ], { level: 5, scale: { expToNext: () => 1000 } });
  assert.equal(state.stress, 200);
  assert.equal(state.airhead, 100);
  assert.equal(state.limit, 100);
  assert.equal(state.gold, 0);
  assert.equal(state.exp, 500);
  assert.deepEqual(state.items, {});
  assert.deepEqual(state.missing, ['itm_packed_lunch']);
  assert.equal(state.flags.tamsin_met, true);
  assert.deepEqual(state.moments, [{ title: 'A', t: 'b', tags: ['x'], imp: 2 }]);
  assert.deepEqual(pending.map((p) => p.kind), ['battle', 'bind']);
  assert.equal(start.stress, 190, 'input state is not mutated');
});

test('events and card moments convert both ways', () => {
  const moment = toMoment(starter.events[0]);
  assert.deepEqual(Object.keys(moment), ['title', 't', 'tags', 'imp']);
  assert.ok(moment.tags.length <= 5);
  const pack = fromMoments([{ title: 'Jealous at the party', t: 'Spent the night in your lap.', tags: ['teasing'], imp: 3 }], { id: 'redz-moments', name: 'Redz moments' });
  assert.equal(pack.pack.format, PACK_FORMAT);
  assert.equal(validatePack(pack).ok, true);
});

test('an event exports as a SillyTavern lorebook entry keyed by place and tags', () => {
  const entry = toLoreEntry(starter.events.find((e) => e.id === 'val.the_bard_got_it_right'), 3);
  assert.equal(entry.id, 3);
  assert.ok(entry.keys.includes('tavern'));
  assert.match(entry.content, /^\[EVENT: The Bard Got It Right/);
  assert.equal(entry.enabled, true);
  assert.equal(entry.position, 'after_char');
});
