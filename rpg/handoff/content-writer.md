# Handoff: Content Writer
Built `data/skills.json`, `data/passives.json`, `data/items.json`, `test/content.test.js` (34 tests) and `blueprint/04_asset_registry.md`. `node --test test/core.test.js test/content.test.js`: 48 pass, 0 fail (14 core, 34 content). `node tools/check-data.mjs`: ok. Every table in the blueprint is printed from the JSON and the engine.

## Counts
| Thing | Count | Notes |
|---|---:|---|
| Skills | 54 | Warrior, Mage, Rogue: 16 active + 2 ultimates each. Unlocks 1 to 100 (rogue 98), longest gap 10 levels, every tier 1–10 filled. |
| Statuses | 27 | 8 hero ids, 12 shared, 5 wards, `rattled`, `routed`. Bosses and encounters keep their own registries. |
| Passives | 22 | 6 per class (L1 to L76–80) + 4 general (`any_p_`). Every one has a `choice`. |
| Items | 42 | recovery 5, mp 3, stress 2, cure 3, revive 1, elemental 15, buff 6, seed 6, key 1. |
| Gear tiers | 10 | One per ten levels, set bonus +5 to +200. |

42 items, not 30–36: five elements × two thrown tiers, five wards, six buffs and six seeds are 27 before any potion.

## The cost rule
`cost.mp = tidy(mpShare × mpBudget(unlock))`, tidy = two significant figures, minimum 1. The same rounding `data/valerie.json` uses, and the same for gold prices.

| Weight | Warrior | Rogue | Mage | Casts per full bar when it unlocks |
|---|---:|---:|---:|---|
| light | 0.03 | 0.04 | 0.06 | 16–22 |
| standard | 0.05 | 0.06 | 0.10 | 10–13 |
| heavy | 0.07 | 0.09 | 0.14 | 6–9 |
| signature | 0.10 | 0.13 | 0.20 | 5–6 |

Ultimates cost 0 MP: 50–60 Limit for the first, 100 for the second. Costs are flat, so a level 1 skill is free by level 10. Every skill therefore carries a price that does not wear off: a self-bind, self-stress, Exposed, a lost turn, an accuracy penalty.

## Things the data says beyond FOUNDATION
- **Skills:** `mpShare` (as on Valerie's). Tags `ultimate` and `scripted`. Class skills are battle actions only: outside battle, HP and MP come from items, camp and inns, which is what keeps Packed Lunch and the tonics worth buying. Effect kinds used: bind, stress, mod, status, dot, cleanse, revive, limit. An effect lands on the skill's target unless it says `"target": "self"`; self effects are costs and apply hit or miss, except one marked `onHit`. A self-bind has `chance: 100` and is not a roll. `ignoreWill` on a stress effect matches the engine option.
- **Rogue skills attack with AGI or LCK**, defended by CON (physical). Its STR basic attack stays the lightest in the party.
- **Statuses:** `polarity` good / bad / neutral says what a cleanse removes. `guard` lasts until the start of the granter's next turn.
- **Passives:** `trigger` (a snake-case hint) and effect extras such as `when`, `maxPerRound`, `perStress`. Top-level `slots`: class passives are always on; general ones take 1 slot, 2 from level 50.
- **Items:** `line` (the tier line prices are checked on), `use` (battle / field / any), `heal` effects with `pct`, `cap` and `bar: "mp"`. Thrown items carry `power`, `element`, `stat: "benchmark"`, `levelCap`. Seeds carry `grants`. `itm_camp_kit` carries `priceFights: 1`: its price is `priceForFights(party level, 1)`, and the listed 40 is level 1.

## Engine: not supported yet (the content assumes all of it)
1. **A skill resolver.** Nothing applies `effects`. The order is in blueprint 4.1, "How an action resolves".
2. **Statuses.** There is no status store or tick. Hooks needed: `guard`, `fortified`, `bulwark` (guard flag); `exposed` (damageMult 1.25); `marked` (critBonus +15); `hidden` (targeting, critBonus +20); `focused` (damageMult 1.5 once, +10 hitBonus against); `provoked`, `taunt`, `covered`, `bulwark` (redirect); `counter` (free basic attack); `sitting_out` (skip a turn); `all_nighter` (zero MP, head bind when it ends); `ward_*` (pass `affinity` to `damage`).
3. `dot` ticks, `cleanse`, `revive`, and Limit for the classes. Their Limit comes from the level 1 passive (`war_p_doorstop`, `mag_p_marginalia`, `rog_p_sticky_fingers`), from Last One Standing, and from Bring It On and Five-Finger Discount. There is no universal gain.
4. **Eight scripted skills:** Grudge Match (+1 Power per 20 own stress), Closing Time (+2 Power per downed ally), Group Project (skips the caster), Dissertation (uses the target's weakest element), Borrowed Time and Clean Getaway (extra actions now), Punchline (+1 Power per 20 target stress), The Big Score (auto-crit on a bound target).
5. **Passive triggers**, general passive slots, and "once per rest" (Packed Lunch, Chamomile Tea).
6. **Item use:** share-and-ceiling healing, the thrown model (attacker = benchmark attributes at `min(level, levelCap)`, a magical INT hit), permanent seeds, gear pieces.

Already supported: enemy stress. `enemyStressEvent` in `engine/stress.js` implements Rattled and Routed, and both test files hold the two status texts to its numbers. Smelling Salts is `snapOut`. Wriggle Oil is `cureBinds`.

## For the Director to wire up
- `sillytavern/build.mjs` prints items only. Class skills, passives and statuses have exact one-line `text` ready for lorebook entries (`Name (Lv, cost): text`).
- `tools/check-data.mjs` could also check items: status ids in item effects, and `gearTiers` (my test does both).
- FOUNDATION's effect list should add `dot`, `cleanse`, `revive`, and the tag list `scripted` and `ultimate`.
- Boss `rewards.items` are empty. Seeds and Concerning Espresso are the natural trophies.
- The boss simulation assumes a Power 4 Might skill for the rogue. Its real workhorse is Cheap Shot (Power 3 on Finesse, +15 crit), which averages 21–23% more than that against all three bosses. The rogue is a quarter of the party, so fights run about 5% shorter than section 5 says.
- Durations: I assumed the bearer's own turns, ticked at the end of each, as `tickBinds` does. Guard is the stated exception.
- Closed Book is the one pure bind skill: resolve it with `tryBind` rolling its own die, so a fumble binds the mage's own head (its text says so). Every other bind rides on its skill's attack roll.
- Regenerate, do not hand-edit: `/tmp/claude-0/-home-user/9d9a3738-a98d-5a1c-a8ba-2d66ed63b43d/scratchpad/build-content.mjs` writes the three JSON files and `/tmp/claude-0/-home-user/9d9a3738-a98d-5a1c-a8ba-2d66ed63b43d/scratchpad/build-registry-doc.mjs` prints section 4. A hand edit to the JSON is still guarded by the tests, but the blueprint tables go stale until the second script is rerun.
