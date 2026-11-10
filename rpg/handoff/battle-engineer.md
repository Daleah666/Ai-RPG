# Handoff: Battle Engineer
Built `engine/battle.js` (the turn loop), `engine/narrate.js` (the narrator), `test/battle.test.js` (31 tests) and `blueprint/08_battle_runner.md`. Both modules are pure and browser-safe: no `node:` imports, no JSON imports, no `Math.random`; the tables arrive through `setup.data`. `node --test "test/*.test.js"`: 296 pass, 0 fail (265 before, 31 new). The runner composes `combat`, `stress`, `binds`, `valerie` and `valerie-combat`; it restates none of their math and never mutates what it is handed (the tests deep-freeze every state and all the data). Every number in the blueprint section is printed from the code by `/tmp/claude-0/-home-user/9d9a3738-a98d-5a1c-a8ba-2d66ed63b43d/scratchpad/build-08.mjs`.

## Exports
`battle.js`
- `createBattle(setup, rng?)` → `state` at the first hero decision; the beats so far are in `state.opening`. `setup: { party: [combatant], encounter | boss | enemies, level?, data: { skills, statuses, passives, items, afflictions, virtues, valerie, bosses, encounters }, options?, contraption?, concession?, seed? }`. `encounter` and `boss` take an id or the definition; `enemies` is `[{ id, name, level, rank, stats, moves: [skill], actions?, acting?, affinities?, bindResist? }]`. A party member may carry `skills` (ids or skill objects; default: its archetype's skills up to its level), `passives` (added to the class ones) and `row`. `options: { breakdownChoice: id | { heroId: id }, orPay: 'auto' | 'pay' | 'stress', standardStress: true }`. `rng` defaults to `makeRng(setup.seed ?? 1)`.
- `currentActor(state)` → hero id, or `null` when it is over.
- `legalActions(state, actorId?)` → `[{ kind: 'attack' | 'skill' | 'guard' | 'breather' | 'concede', skillId?, stance?, mode, choose, targets: [ids], label, cost?, price?, disabled?, why? }]`. `choose: true` means the caller picks one id from `targets`; otherwise `targets` is who it reaches. Valerie's attacks and skills appear once per legal stance.
- `act(state, action, rng)` → `{ state, events }`. `action: { kind, skillId?, stance?, target?, breakdown?, orPay? }`. Throws on anything `legalActions` does not offer enabled.
- `runBattle(setup, { policy = defaultPolicy, rng, maxRounds = 60, breakdownChoice })` → `{ state, events, summary }`; `summary.result` is `win`, `loss` or `timeout`.
- `defaultPolicy(state, actorId, actions)` → action · `summarize(state, events)` · `makeHero(archetype, level, extra?)` · `referenceParty(level, data)` (needs `data.archetypes`) · `skillSupport(skill)` → `{ ok, why? }` · `supportReport(data)` → counts and lists · `STATUS_HOOKS` (the status registry).

`narrate.js`: `narrate(event, ctx?)` → the paragraph · `lineFor(event)` → the dice line · `formatLog(events)` → line, blank line, paragraph, blank line · `voiceKey(event)` · `fmt(n)` · `NARRATED_TYPES`.

## State (plain data, survives JSON)
`{ version, kind, sourceId, name, level, round, seq, over, result: 'win' | 'loss' | null, outcome: 'victory' | 'concession' | 'defeat' | null, combatants: { id: combatant }, heroes: [ids], enemies: [ids], order: [ids], turnIndex, turn: { actor, actionsLeft, slot, extra, used, row, deferred } | null, acted, boss: { id, phase, phaseRound, pending: { move, by, due, part } | null } | null, contraption: { name, uses, used, effects } | null, concession: { name, at, price, effects } | null, story: { trust, rep, goldPct, goldFlat }, rewards: { exp, gold } | null, options, unsupported: { skills, passives }, voice, voiceSalt, defs, opening: [events] }`
A combatant is `makeCombatant`'s shape plus `side: 'heroes' | 'enemies'`, `skills: [ids]`, `passives: [ids]`, `statuses: [{ id, turns, by, source, fresh, until?, untilRound?, own? }]`, `dots`, `row`, `kind`, `actions`, `acting`, `boss`, `fled`, and always a `bindResist`. `defs` holds the tables by reference (skills by id, statuses, passives, the Resolve tables, the boss's phases) and is never written to. `story.trust` and `story.rep` are changes for the campaign to apply; the runner does not own those meters.

## Events
Every event is `{ seq, type, round, voice, line, text, ...fields }`. `line` is the mechanics in one line, dice first. `text` is one to three sentences, second person where Valerie is involved. 35 types: `start` `round` `stance` `skill` `attack` `bind` `damage` `heal` `stress` `relief` `resolve` `act_out` `breakdown` `calm` `status` `mod` `expire` `cleanse` `revive` `limit` `airhead` `pay` `plot_armor` `chaos_wave` `contraption` `phase` `telegraph` `cancel` `skip` `enemy_stress` `defeat` `guard` `breather` `concede` `end`. Blueprint 8.8 lists the fields of each. The ones a screen needs most:
- who: `actor`, `actorName`, `actorSide`, `actorYou`, `target`, `targetName`, `targetSide`, `targetYou`
- `attack`: `skill`, `roll`, `hitPct`, `critPct`, `fumbleFrom`, `outcome` (hit, crit, miss, fumble, bounce), `dodged`, `damage`, `reflected`, `selfBind`, `hpBefore`, `hpAfter`, `affinity`, `redirect: { why, from }`, `counter`, `wave`, `limitGain`
- group events `stress`, `relief`, `status`, `mod`: `targets: [{ id, name, you, taken | relieved, before, after }]`; Valerie's `stress` row also has `noticed`, `gaugeBefore`, `gaugeAfter` · `resolve`: `roll`, `virtuePct`, `kind`, `entryId`, `entryName`, `permanent`, `personal`, `partyStress` · `end`: `result`, `outcome`, `rounds`, `rewards`, `story`

## Driving it from a page
```js
const rng = makeRng(seed);                                    // one rng for the whole fight
let state = createBattle({ party, boss: 'boss_bolgrim', data }, rng);
show(state.opening);                                          // each event: its line, then its text as a paragraph
while (currentActor(state)) {
  const chosen = await pick(legalActions(state));             // grey out the disabled ones and show their why
  const step = act(state, chosen, rng);                       // { kind, skillId, stance, target } in; one hero action and every enemy turn after it out
  show(step.events);
  state = step.state;                                         // bars: state.combatants[id].hp / mp / stress / limit / binds / statuses / resolve, airheadOf(valerie)
}
```
The runner does not stop to ask about a Breakdown or about paying MP instead of stress: send the choice with the action (`breakdown: 'have_it_out'`, `orPay: 'pay'`) or set it in `setup.options`. Narrator variants are dealt in turn from a counter kept in the state, so a replay reads the same and no sentence comes up twice running.

## Not supported: never faked (disabled in `legalActions` with a `why`, left out of the enemy AI, listed by `supportReport(data)` and `state.unsupported`)

| | In the data | Resolved | Not resolved |
| --- | ---: | ---: | --- |
| Class and hero skills | 70 | 69 | **1**: Found It! (`val_found_it`) |
| Boss and encounter moves | 51 | 51 | none |
| Statuses (three registries) | 43 | 42 | **1**: Rummaging (`pocket_found_check`) |
| Passives | 22 | 18 | **4**: Share the Shield, I Told You So, Chain of Thought, Quartermaster |
| Scripted skills / effect kinds | 8 / 10 | 8 / 10 | none |

Mechanics not in the runner, **11**: (1) items in battle: use, thrown items, share-and-ceiling healing, seeds, gear, so Loot Goblin's "Mine" always falls back to Guard; (2) Valerie's **Pocket Dimension**, left out of this version as allowed; (3) the contraption's `manual` hard check, so a Chaos Wave is the only way to set one off; (4) event `advantage`; (5) positions: Bolgrim's nearest and furthest hero and Vellum's choice of whom to correct are random picks (Parity's highest-HP rule is in); (6) rows inside a side: a side is one row unless a combatant carries `row`, so encounters end sooner than section 5.6 estimates; (7) encounter rules written in prose only: the last goblin runs, hoplites stop locking shields without the Captain, raiders ease off without the drummers; (8) the Struggle action, fleeing, swapping party members; (9) general passive slots (a hero carries whatever `passives` the caller lists) and "once per rest"; (10) standard stress sources on enemies, and the out-of-battle sources; (11) refusing a helpful status (only attribute buffs are refused) and hiding affinities until "revealed". Partly: Lucky Charm covers attack rolls, not a pure bind skill's own die. Deep Breaths stops Limit after the Guard, not earlier in that round. Otherwise boss desk items 1 to 12 are in, and so are the content writer's items 1 to 4 and the 18 passives of item 5.

## Changes I need in files I do not own
1. **Director, `tools/build-blueprint.mjs`**: add `['blueprint/08_battle_runner.md', '## 8. THE BATTLE RUNNER']` after the events section, and rewrite the header line that says there is no battle loop. `README.md`: the same paragraph, and add `battle.js` and `narrate.js` to the layout.
2. **Director, `FOUNDATION.md`**: an ownership row for the five files above; effect targets `valerie`, `others`, `heroes`, `enemies`, `allies`, `boss`; the ruling that `allies` includes the user.
3. **Director, `data/valerie.json`**: `val_accidentally_legendary`'s `{ "kind": "airhead", "set": 50 }` needs `"target": "self"`. The runner already treats every `airhead` effect as the user's own gauge.
4. **Director, `engine/valerie-combat.js`**: `enemyAttacksValerie` has no slot for `hitBonus`, `critBonus`, `damageMult`, `affinity` or a fumble shift, and does not return its variance, so the runner folds bonuses into a copy of the skill and scales the returned damage. `applyStressToValerie` has no `ignoreWill` or `mult`, so flat party stress on her is composed from `stressFilter` + `applyStress`. Taking `opts` in both would remove the workarounds.
5. **Boss desk, `data/bosses.json`**: these exist as prose only, so they are a table keyed by boss id in `battle.js` (`BOSS_RULES`): who may concede and how (`who`, `stance`, the gauge band, ledger not flipped), Parity's highest-HP targeting, Balance Due's `telegraph.redirect`. Machine fields would let a fourth boss work with no code.
6. **Boss desk, `data/encounters.json`**: Drive Them On's effect targets `allies`, so the runner buffs the whole enemy side, while its text says raiders. Add `row` to enemies if rows are meant to matter.

## Headline numbers
Reference party of four at the boss's level, no gear, no items, default policy, 200 seeds each, capped at 60 rounds:

| Boss | Won outright | Won by concession | Lost | Rounds | Boss HP left on a loss | Dodges | Bounces | Enemy fumbles | Chaos Waves | Resolve Checks | Heroes downed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bolgrim Underbridge (L12) | 0 | 96 | 104 | 16.8 | 46.3% | 3.3 | 1.3 | 2.2 | 1.9 | 0.9 | 2.6 |
| Imara Vellum (L50) | 0 | 92 | 108 | 24.1 | 50.4% | 6.2 | 1.7 | 3.8 | 2.4 | 2.3 | 2.1 |
| Madam Parity (L100) | 0 | 0 | 200 | 20.7 | 64.5% | 4.2 | 3.0 | 2.8 | 0.8 | 3.3 | 5.1 |

No boss is beaten by damage alone, which is what section 5 predicts for a party with no items. Half the Bolgrim and Vellum fights are won at the concession; Parity's needs a Total Airhead holding 100 Limit at 25% HP and this party never gets there. The five encounters end in 1.1 to 6.4 rounds on average at levels 5, 20 and 50, all won but for 3 drake fights in 600.
