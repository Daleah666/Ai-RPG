# Oops, I'm the Hero?!

A tactical, high-stat, turn-based JRPG. You wake up in the body of Dame Valerie Bellweather, a knight whose accidents keep saving the day. Her luck is real, and it only works when you stop steering.

This folder holds the whole design: the rules as running code, the data, the written blueprint, pluggable story events, and ready-to-import SillyTavern files.

## Read in this order

| File | What it is |
|---|---|
| `blueprint/MASTER_BLUEPRINT.md` | The compiled design document. Start here to read the game. |
| `FOUNDATION.md` | The contract: scales, attributes, dice rules, anchors, who owns which files. Start here to change the game. |
| `handoff/` | One note per role: what they built, what they changed, what the next person needs. |
| `events/README.md` | How to write an event pack and plug it in. |
| `sillytavern/README.md` | How to play it in SillyTavern. |
| `playtest/README.md` | The playable page and how to build it. |

## Layout

```
engine/      the rules, as small pure functions with no dependencies
  constants.js   every canonical number
  rng.js         seeded d100, bounded checks, band reading
  stats.js       combatant shape, effective attributes, the benchmark line
  combat.js      damage, hit and crit, stress mitigation
  progression.js EXP curve, attribute growth, HP and MP, yields
  stress.js      stress bar, Resolve Check, afflictions and virtues
  binds.js       head, arms and legs binds
  valerie.js     the Airhead gauge and her six accidents
  valerie-combat.js  her kit joined to the combat math: one call, one d100
  events.js      event packs: validate, draw, resolve, convert
  battle.js      the battle runner: turns, skill effects, statuses, bosses
  narrate.js     every beat as one dice line and one paragraph
data/        archetypes, skills, passives, items, bosses, encounters, afflictions, virtues, Valerie
events/      event packs (drop new ones in events/packs/)
blueprint/   one document per role, plus the compiled master
sillytavern/ Game Master card, Valerie persona, lorebook, and the card-creator card
playtest/    the playable page: a town, residents, real fights (npm run playtest)
test/        the anchors from FOUNDATION.md, as tests
tools/       cross-reference check, event validator, blueprint builder
```

## Commands

Run these from this folder. Node 20 or newer, nothing to install.

```bash
npm test
```

```bash
npm run all
```

`npm test` runs the rules tests. `npm run all` also cross-checks the data (every id a skill, item, boss or event names must exist; every cost must be payable), validates every event pack, and rebuilds the master blueprint and the SillyTavern files.

## The three ideas

1. **Bounded dice, unbounded numbers.** Every chance is a d100 roll clamped to 5–95%. HP and damage climb into the hundreds of thousands. Getting stronger makes your hits bigger; it never makes your rolls automatic.
2. **Stress does not level up.** One bar, 0–200, the same at level 1 and level 100. At 100 a character makes a Resolve Check: 25% they rise to it, 75% they crack.
3. **Two minds, one body.** Valerie's Airhead gauge runs from Lucid to Total Airhead. Wing It pushes it up and her accidents take over: blows miss, arrows bounce, enemies fall over. Think It Through pulls it down and gives you your planned skills back. Lucky or precise, never both.

## What runs today, and what is designed but not built

**Runs, with tests, as rules:** the dice and their bands; damage, hit, crit, healing and initiative; stress mitigation; the EXP curve, attribute growth, HP and MP, yields and prices; the stress bar, Resolve Check, afflictions, virtues and breakdown; binds; Valerie's gauge, stances and six accidents, joined to the combat math; event packs.

**Runs, with tests, as a whole fight:** `engine/battle.js` is the battle runner. It takes turns in initiative order, applies a skill's `effects`, ticks statuses and damage over time, fires passives, tracks a boss's phases, winds up and resolves telegraphed moves, sets off contraptions and offers concessions. `engine/narrate.js` turns every beat into one dice line followed by one paragraph. Drive it a step at a time with `createBattle`, `legalActions` and `act`, or play a whole fight with `runBattle`.

**Not resolved yet (the runner disables these with a reason; it never fakes them):** items in battle, Valerie's Pocket Dimension (so Found It! and Rummaging), four passives (Share the Shield, I Told You So, Chain of Thought, Quartermaster), rows and positions inside a side, fleeing and swapping, and the encounter rules written only as prose. `blueprint/08_battle_runner.md` and `handoff/battle-engineer.md` have the full list.

## Generated files

`blueprint/MASTER_BLUEPRINT.md` and everything in `sillytavern/out/` are built by `npm run build`. Edit the sources, then rebuild.
