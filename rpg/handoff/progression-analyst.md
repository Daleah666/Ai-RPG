# Handoff: Progression Analyst
Built `engine/progression.js`, `data/archetypes.json`, `test/progression.test.js` (29 tests) and `blueprint/02_progression.md`. Run `node --test test/core.test.js test/progression.test.js`: 42 pass. Every number below is code output. Damage figures use the formula `combat.js` ships, `1.5 × A² / (2A + D)`.

## Final formulas and constants
- **EXP to next level:** `50 × L × (L + 15)`. `EXP_CURVE = { QUAD: 50, LIN: 750, CONST: 0 }`. L1→2 costs 800. L1→100 costs 20,130,000 (A8).
- **Yield per standard enemy:** EXP `50 × enemy level`, gold `10 × enemy level` (`YIELD`). EXP is not split: every party member gets the full yield, knocked out or not.
- **Rank rewards:** `RANK_REWARD_MULT = { minion: 0.4, standard: 1, elite: 4, boss: 30, superboss: 100 }`, for EXP and gold alike.
- **Reference fight:** four standard enemies of the party's level. Fights to level = `(L + 15) / 4`: 4.0 at L1, 16.25 at L50, 28.5 at L99.
- **Enemies below a character's level:** EXP × `1 / (1 + (gap / 10)²)`, rounded down, minimum 1. Half at 10 below, a fifth at 20. No cutoff.
- **Attributes:** `round(l1 + (l100 − l1) × ((L − 1) / 99) ^ exponent)`. All three archetypes use exponent 1.
- **Bars and gold:** `maxHp = 10 × L × CON × RANK_HP_MULT[rank]`. `maxMp = L × WIL`. Gold across level L = `10 × L × (L + 15)`.

## Changed from baseline
Nothing. HP, MP and the attribute budget are the FOUNDATION baseline. A3: `maxHp(100, 1000)` = 1,000,000 and `maxHp(1, 10)` = 100.
Added on top: the level-gap EXP rule, the rank reward table, the price helpers, and a `warnings` array on `validateArchetype`. Signatures follow the FOUNDATION triangle (Warrior CON, Mage WIL, Rogue AGI), so the attack attributes STR and INT stop at 760.

## Exports
Levels clamp to 1..100 and attributes to 1..1000. An unknown rank throws. Results are integers unless noted.
- EXP: `expToNext(level)`, `totalExpForLevel(level)`, `levelForExp(totalExp)`, `expYield(enemyLevel, rank = 'standard')`, `goldYield(enemyLevel, rank = 'standard')`, `levelGapMult(characterLevel, enemyLevel)` → 0..1, `expGain(characterLevel, enemyLevel, rank = 'standard')`, `fightsToLevel(level, enemyLevel = level)` → number
- Growth: `growthCurve(l1, l100, level, exponent = 1)`, `statAt(archetype, key, level)`, `statsAt(archetype, level)` → `{ STR, INT, AGI, CON, WIL, LCK }`, `validateArchetype(archetype)` → `{ ok, errors: [], warnings: [] }`, `budgetAt(level)` → number
- Bars: `maxHp(level, con, rank = 'standard')`, `maxMp(level, wil)`, `barsAt(archetype, level)` → `{ maxHp, maxMp }`, `hpBudget(level, rank = 'standard')`, `mpBudget(level)` (the bars at `benchmarkStat(level)`)
- Gold: `fightGold(level)`, `levelGold(level)`, `wealthAt(level)`, `priceAt(level, share)`, `priceForFights(level, fights)`
- Constants: `EXP_CURVE`, `YIELD`, `RANK_REWARD_MULT`, `REFERENCE_FIGHT_ENEMIES` (4), `EXP_GAP_SCALE` (10), `ARCHETYPE_RULES`, `PRICE_GUIDE` (basic recovery 0.5 fights, major purchase share 1)

## Archetypes before gear: L1 / L50 / L100
| Archetype | STR | INT | AGI | CON | WIL | LCK | Max HP | Max MP |
|---|---|---|---|---|---|---|---|---|
| Warrior (signature CON) | 15 / 384 / 760 | 8 / 153 / 300 | 10 / 262 / 520 | 16 / 404 / 800 | 9 / 153 / 300 | 12 / 313 / 620 | 160 / 202,000 / 800,000 | 9 / 7,650 / 30,000 |
| Mage (signature WIL) | 9 / 212 / 420 | 15 / 384 / 760 | 10 / 213 / 420 | 10 / 243 / 480 | 16 / 404 / 800 | 10 / 213 / 420 | 100 / 121,500 / 480,000 | 16 / 20,200 / 80,000 |
| Rogue (signature AGI) | 12 / 293 / 580 | 8 / 153 / 300 | 16 / 404 / 800 | 10 / 233 / 460 | 9 / 203 / 400 | 15 / 384 / 760 | 100 / 116,500 / 460,000 | 9 / 10,150 / 40,000 |

## Reference numbers
| Level | 1 | 10 | 25 | 50 | 75 | 100 |
|---|---:|---:|---:|---:|---:|---:|
| `benchmarkStat` | 10 | 64 | 153 | 302 | 451 | 600 |
| `hpBudget` | 100 | 6,400 | 38,250 | 151,000 | 338,250 | 600,000 |
| `mpBudget` | 10 | 640 | 3,825 | 15,100 | 33,825 | 60,000 |
| `wealthAt`: gold earned so far | 0 | 9,600 | 94,000 | 588,000 | 1,794,500 | 4,026,000 |
| `priceAt(L, 1)`: major purchase | 160 | 2,500 | 10,000 | 32,500 | 67,500 | 115,000 |
| Warrior / Mage / Rogue WIL | 9 / 16 / 9 | 35 / 87 / 45 | 80 / 206 / 104 | 153 / 404 / 203 | 227 / 602 / 301 | 300 / 800 / 400 |
| Stress taken, W / M / R | 99 / 97 / 99% | 94 / 87 / 93% | 88 / 74 / 85% | 80 / 60 / 75% | 73 / 50 / 67% | 67 / 43 / 60% |

## Systems Designer
- WIL barely cuts stress before level 25 (last row above). The archetypes separate on stress in the second half of the game.
- Size HP effects as a share of `hpBudget(level)` or of the target's bar. Flat numbers go stale: HP grows 94-fold from L10 to L100.
- My recommendation, for the Director to confirm: set bars from `stats` (base plus gear) at build time. A head bind halves WIL for defense and stress and leaves Max MP alone.

## Content Writer
- Price skill costs as a share of `mpBudget(unlock level)`. A cost of 5% buys a warrior 10 casts per full bar, a rogue 13, a mage 27. FOUNDATION's Cleave (12 MP at L5) is 7.1%.
- Enemy HP is `maxHp(level, CON, rank)`. At benchmark CON, an enemy takes this many landed benchmark basic attacks at every level: minion 4, standard 10, elite 30, boss 200, superboss 600. Half-benchmark CON gives a standard enemy 4.17.
- Bosses at benchmark CON, from `expYield(level, 'boss')` and `goldYield(level, 'boss')`. L10: 128,000 HP, 15,000 EXP each, 3,000 gold. L50: 3,020,000 HP, 75,000 EXP, 15,000 gold. L100: 12,000,000 HP, 150,000 EXP, 30,000 gold.
- Items: a basic recovery item costs `priceForFights(level, 0.5)` = `20 × level`; a weapon costs `priceAt(level, 1)`. `wealthAt(1)` is 0, so give the party a starting purse near 160 gold.
- The mage has the lowest accuracy: 68% hit chance on a benchmark enemy at L100, against 73% for the warrior and 80% for the rogue. Give spells that must land `acc` +5 to +10.

## For the Director
1. **Triangle limit.** With HP from CON alone, a warrior survives more spells (8.4 Power 2 hits) than a mage (6.4). The warrior still loses 27% more HP to a spell than to a blade. Sharpening this needs a new HP baseline; I kept the baseline.
2. **Mage body.** Mage CON 480 and STR 420 hold two mirrors inside 6–14 hits: the STR basic attack (12.0, the A2 case) and a Power 2 spell (6.4). Drop the spell mirror and mage CON can fall toward 400. My pacing test writes the baseline and shipped damage formulas inline; swap in `hitsToKill` once imports are safe.
3. `data/valerie.json`'s `klutz_knight` passes `validateArchetype` with no warnings. `tools/check-data.mjs` should call it for every archetype.
