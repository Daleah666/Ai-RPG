# Foundation contract

Working title: **Oops, I'm the Hero?!** A tactical, high-stat, turn-based JRPG. The player wakes up in the body of Valerie, a spectacularly clumsy knight whose accidents keep saving the day.

This file is the contract every contributor builds against: people, sub-agents, and other tools picking the work up through `docs/AI_HANDOFF_BRIDGE.md`. If a document or data file disagrees with this file or with `engine/constants.js`, this file and the constants win.

## Pillars

1. **Bounded dice, unbounded numbers.** Every chance is a d100 roll clamped to 5–95%. Damage and HP scale into the hundreds of thousands. Getting stronger makes your hits bigger; it never makes your rolls automatic.
2. **Every mechanic forces a choice.** A rule that never asks the player to give something up gets cut.
3. **Stress is a second health bar that does not level up.** 0–200, same scale at level 1 and level 100.
4. **Characters are a want and a cost.** Mechanics express both.

## The numbers that never change

| Thing | Range | Notes |
|---|---|---|
| Level | 1–100 | |
| Attributes | 1–1000 | six of them, integers, after gear, buffs and binds |
| Any d100 chance | 5–95% | `clampPct` in `engine/rng.js` |
| Stress | 0–200 | Resolve Check at 100, Breakdown at 200 |
| Limit gauge | 0–100 | pays for ultimates |
| Max HP | `10 × Level × CON` baseline | 1,000,000 at L100 / CON 1000 |
| Max MP | `1 × Level × WIL` baseline | 100,000 at L100 / WIL 1000 |

## Attributes

| Key | Name | Drives |
|---|---|---|
| STR | Might | physical attack power |
| INT | Arcana | magical attack power, healing |
| AGI | Finesse | accuracy, evasion, turn order |
| CON | Constitution | max HP, physical defense |
| WIL | Willpower | max MP, magical defense, stress mitigation |
| LCK | Luck | crits, status procs and resists, drops, lucky accidents |

There is no separate DEF or RES stat. STR attacks are defended by CON. INT attacks are defended by WIL. Gear adds to attributes.

The triangle is about each class's soft side. Measured with the engine, as the share of its own HP one even hit removes:

- **Warrior** (CON): a spell costs 27% more HP than a blade, and stress lands hardest (13 of 20 at level 100).
- **Mage** (WIL): a blade costs 16% more than a spell and removes twice the share a warrior loses to it. Stress lands lightest (9 of 20).
- **Rogue** (AGI, LCK): loses the most to everything, and is the hardest to hit.

HP comes from CON alone, so a warrior still outlasts a mage under any kind of fire. The triangle says what each class should fear, not who lives longest.

**Benchmark line.** `benchmarkStat(level)` runs straight from 10 at L1 to 600 at L100. It is what a trained attribute looks like. Signature stats sit above it, dump stats below. Boss stats, event difficulty and skill costs are written relative to it.

**Budget.** Every archetype has the same attribute total: 70 at L1, 3,300 at L100 before gear. The signature stat reaches exactly 800 at L100. Gear, passives and buffs supply the last 200 to the 1000 cap, so buffs keep their value all the way up.

**Effective attributes.** `effectiveStat` in `engine/stats.js`: base × buffs (combined multiplier clamped 0.5–1.5) × bind (0.5), floored, clamped 1–1000. Every formula reads effective attributes, never raw ones.

## Dice

One d100 per action. Low is good. `readRoll` in `engine/rng.js` reads the roll against its bands in this order:

1. **Fumble**: roll ≥ `fumbleFrom` (96 by default). Always a failure, with a consequence.
2. **Crit**: roll ≤ crit chance.
3. **Hit / success**: roll ≤ chance.
4. **Miss / failure**: everything else.

Abilities are allowed to move a band edge (widen a fumble band, lower a hit ceiling). They are not allowed to add a second roll to the same action.

Non-attack checks use `contestPct(stat, dc)`: 50% when equal, 70% at double, 30% at half, clamped.

## Formulas

Final after wave 1. `engine/combat.js` and `engine/progression.js` are the source of truth; `handoff/` says why each one looks the way it does.

```
Damage   = floor( Power × Level × 1.5 × A² / (2A + D) × variance × crit × affinity × guard )
           A = attacker STR or INT, D = defender CON or WIL, all effective
           Even stats pass half: a basic attack on an even target deals Level × A, ten hits to kill.
           Defense counts at half weight because CON already buys HP.
           Power: basic attack 2.0, skills about 3–12, ultimates 20+. Each point is 5% of an even peer's HP.
           variance 0.90–1.10, crit ×1.5, affinity weak ×1.5 / resist ×0.5 / null ×0 / absorb heals, guard ×0.5
           a hit that is not nulled deals at least 1

Hit %    = clamp( 75 + 40 × (ACC − EVA) / (ACC + EVA) + skill.acc , 5, 95 )
           ACC = attacker AGI + LCK/2, EVA = defender AGI + LCK/2

Crit %   = clamp( 5 + 20 × (LCKa − LCKd) / (LCKa + LCKd) + skill.crit , 1, 50 ), never above Hit %
           Crit is a band inside the hit roll, so it keeps its own 1–50 window.

Heal     = floor( Power × Level × INT × 0.5 × variance )

Stress   = max( 1, round( Base × (1 − min(0.75, WIL / (WIL + 600))) ) )

EXP      = 50 × L × (L + 15) to go from L to L + 1. 20,130,000 from level 1 to 100.
           A standard enemy yields 50 × its level in EXP and 10 × its level in gold. EXP is not split.
```

## Rulings

Questions the roles raised, settled here so nobody answers them twice.

- **Bars are set from base attributes plus gear.** A bind or debuff changes what an attribute does this turn. It never shrinks Max HP or Max MP.
- **The basic attack is never sealed.** Bound arms halve its Might; they do not take it away. Every other skill is sealed while its body part is bound.
- **Starting purse:** 160 gold.
- **The duel anchor (A2) is measured on plain hits:** no crits, variance 1.

## Anchors (these become tests)

- **A1** Every chance to hit or succeed stays in 5–95 for any attributes in 1–1000. Crit chance stays in 1–50 and never exceeds the chance to hit.
- **A2** Same-archetype duel with basic attacks at L1, L50 and L100: 6–14 landed hits to kill.
- **A3** `maxHp(100, 1000) ≥ 1,000,000`. `maxHp(1, 10)` is in the low hundreds or below.
- **A4** Damage rises with the attacking attribute, falls with the defending one, is never negative.
- **A5** Stress mitigation: WIL 1 takes at least 95% of base. WIL 1000 takes 25–45% of base. Never less than 1.
- **A6** Stress clamps to 0–200. The Resolve Check fires once per crossing of 100. 200 is a Breakdown.
- **A7** Resolve Check: 25% Virtue, 75% Affliction over 100,000 seeded rolls, within 1.5 points.
- **A8** EXP is quadratic in level. L1→2 costs 100–1,000. Total to L100 is 10–25 million.
- **A9** Attribute budget as above. Signature stat is exactly 800 at L100.
- **A10** A bind halves its mapped attributes once. Two binds on one attribute do not quarter it.

## Shapes

**Combatant**: see `makeCombatant` in `engine/stats.js`.

**Skill** (`data/skills.json`):

```json
{
  "id": "war_cleave", "name": "Cleave", "archetype": "warrior", "unlock": 5, "tier": 1,
  "type": "physical", "stat": "STR", "power": 3.0, "acc": 0, "crit": 0,
  "element": "phys", "target": "row", "part": "arms",
  "cost": { "mp": 12, "limit": 0 },
  "tags": ["melee"],
  "effects": [{ "kind": "bind", "part": "legs", "chance": 40, "turns": 2 }],
  "text": "One line the player reads."
}
```

- `type`: physical, magical, heal, buff, debuff, stress, utility
- `target`: one, row, all, self, ally, allies
- `part`: head, arms, legs or none. A bound part seals its skills.
- `tags` that rules key on: melee, ranged, projectile, mental, horror, embarrassment, realization
- `effects[].kind`: bind, stress, mod, status, heal, limit, airhead
- IDs are lowercase snake case with an owner prefix: `war_`, `mag_`, `rog_`, `val_`, `itm_`, `boss_`, `aff_`, `vir_`, `evt_`

**Engine options.** Functions that roll take a trailing `opts` object so passives can move band edges without the engine knowing who they belong to: `hitBonus`, `hitFloor`, `hitCap`, `critBonus`, `fumbleFrom`, `damageMult`.

## Who owns what

| Path | Owner |
|---|---|
| `FOUNDATION.md`, `engine/constants.js`, `engine/rng.js`, `engine/stats.js` | Director |
| `engine/events.js`, `engine/valerie.js`, `data/valerie.json`, `events/`, `sillytavern/`, `tools/` | Director |
| `engine/combat.js`, `test/combat.test.js`, `blueprint/01_engine_math.md` | Combat Engineer |
| `engine/progression.js`, `data/archetypes.json`, `test/progression.test.js`, `blueprint/02_progression.md` | Progression Analyst |
| `engine/stress.js`, `engine/binds.js`, `data/afflictions.json`, `data/virtues.json`, `test/stress.test.js`, `test/binds.test.js`, `blueprint/03_psych_status.md` | Systems Designer |
| `data/skills.json`, `data/passives.json`, `data/items.json`, `blueprint/04_asset_registry.md` | Content Writer |
| `data/bosses.json`, `data/encounters.json`, `blueprint/05_boss_architecture.md` | Content Writer (boss desk) |

Write only inside your own paths. Need something changed elsewhere? Put the request in your handoff note.

## Handoff notes

Each role leaves `handoff/<role>.md` when done: what you built, the final constants and why, anything you changed from the baseline, and what the next role must know. Later roles read earlier notes before starting. This folder is the message board; nothing else carries context between contributors.

## Tone

Slapstick and warm. Valerie is the butt of the physics, never the butt of the story: she is brave, kind and wins. Keep it PG-13: comedy and innuendo, nothing explicit. The cast is diverse by default.
