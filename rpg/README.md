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
  events.js      event packs: validate, draw, resolve, convert
data/        archetypes, skills, passives, items, bosses, encounters, afflictions, virtues, Valerie
events/      event packs (drop new ones in events/packs/)
blueprint/   one document per role, plus the compiled master
sillytavern/ Game Master card, Valerie persona, lorebook, and the card-creator card
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

## Generated files

`blueprint/MASTER_BLUEPRINT.md` and everything in `sillytavern/out/` are built by `npm run build`. Edit the sources, then rebuild.
