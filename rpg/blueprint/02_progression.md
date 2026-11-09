## 2. LEVEL 1 - 100 PROGRESSION & STAT MATRIX

This section fixes four things: how characters level, what their attributes are at each level, how large the HP and MP bars grow, and what enemies pay.

The code is `engine/progression.js`. The data is `data/archetypes.json`. `test/progression.test.js` pins every rule below. Every table is printed output from that code.

### 2.1 The system on one card

| Quantity | Rule |
|---|---|
| EXP from level L to L + 1 | `50 × L × (L + 15)` |
| EXP for one standard enemy | `50 × enemy level`, paid in full to every party member |
| Gold for one standard enemy | `10 × enemy level`, paid once to the party |
| Rank multiplier on EXP and gold | minion ×0.4, standard ×1, elite ×4, boss ×30, superboss ×100 |
| EXP from an enemy below your level | yield `÷ (1 + (gap ÷ 10)²)`, rounded down, minimum 1 |
| Attribute at level L | `L1 + (L100 − L1) × (L − 1) ÷ 99`, rounded |
| Max HP | `10 × Level × CON`, times the enemy rank multiplier |
| Max MP | `Level × WIL` |
| Reference fight | four standard enemies of the party's level |
| Reference fights to gain a level | `(L + 15) ÷ 4` |
| Gold earned across level L | `10 × L × (L + 15)` |

A game master needs this card and the archetype tables in 2.4. Nothing else in the section is required at the table.

### 2.2 The EXP curve

```
expToNext(L) = 50 × L² + 750 × L + 0  =  50 × L × (L + 15)      for L = 1..99
expToNext(100) = 0
```

The coefficients are `EXP_CURVE = { QUAD: 50, LIN: 750, CONST: 0 }`. Level 1 to 2 costs 800 EXP. Level 1 to 100 costs 20,130,000 EXP. Both sit inside anchor A8.

| Level | EXP to next | Total EXP to reach |
| ---: | ---: | ---: |
| 1 | 800 | 0 |
| 5 | 5,000 | 9,000 |
| 10 | 12,500 | 48,000 |
| 20 | 35,000 | 266,000 |
| 30 | 67,500 | 754,000 |
| 40 | 110,000 | 1,612,000 |
| 50 | 162,500 | 2,940,000 |
| 60 | 225,000 | 4,838,000 |
| 70 | 297,500 | 7,406,000 |
| 80 | 380,000 | 10,744,000 |
| 90 | 472,500 | 14,952,000 |
| 99 | 564,300 | 19,565,700 |

`totalExpForLevel(level)` returns the right-hand column. `levelForExp(totalExp)` reverses it: 1,000,000 EXP is level 33.

**Why this shape.** A kill pays in proportion to the enemy's level. A level costs in proportion to the square of yours. Divide one by the other and the fights needed per level climb in a straight line. The `+ 15` sets the floor: without it, level 1 would take a quarter of a fight. The 50 sets the total at 20 million.

### 2.3 Fights to level

The reference fight is four standard enemies of the party's level. All pacing in this document is measured in reference fights.

EXP is not split. Each party member receives the full yield of every enemy, knocked-out members included. A party that travels together shares one EXP total and one level.

| Level | EXP per standard enemy | EXP per reference fight | Fights to level | Fights so far |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 50 | 200 | 4.00 | 0 |
| 5 | 250 | 1,000 | 5.00 | 18 |
| 10 | 500 | 2,000 | 6.25 | 45 |
| 20 | 1,000 | 4,000 | 8.75 | 119 |
| 30 | 1,500 | 6,000 | 11.25 | 218 |
| 40 | 2,000 | 8,000 | 13.75 | 341 |
| 50 | 2,500 | 10,000 | 16.25 | 490 |
| 60 | 3,000 | 12,000 | 18.75 | 664 |
| 70 | 3,500 | 14,000 | 21.25 | 863 |
| 80 | 4,000 | 16,000 | 23.75 | 1,086 |
| 90 | 4,500 | 18,000 | 26.25 | 1,335 |
| 99 | 4,950 | 19,800 | 28.50 | 1,580 |

Level 100 arrives after 1,609 reference fights, or 6,435 standard enemies. Elites and bosses shorten that road.

**Enemies below your level.** `expGain(characterLevel, enemyLevel, rank)` multiplies the yield by `1 ÷ (1 + (gap ÷ 10)²)`, where gap is your level minus the enemy's. Enemies at or above your level pay in full.

| Levels below you | 0 | 1 | 2 | 3 | 5 | 10 | 15 | 20 | 30 | 50 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Share of EXP kept | 100% | 99% | 96% | 92% | 80% | 50% | 31% | 20% | 10% | 4% |

The lower enemy also has a smaller yield to begin with, so the two effects stack:

| Your level | Same level | 5 below | 10 below | 20 below | 30 below |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 30 | 11.3 | 16.9 | 33.8 | 168.8 | n/a |
| 50 | 16.3 | 22.6 | 40.6 | 135.4 | 406.3 |
| 70 | 21.3 | 28.6 | 49.6 | 148.8 | 371.9 |
| 90 | 26.3 | 34.7 | 59.1 | 168.8 | 393.8 |

Each cell is the number of reference fights to gain one level. A level-50 character earns 2,500 EXP from a level-50 enemy, 1,000 from a level-40 enemy and 100 from a level-20 enemy. A level-100 character still earns 1 EXP from a level-1 enemy.

**Why this shape.** Without the gap rule, an enemy at half your level has a quarter of the HP and pays half the EXP. Farming it would beat fighting peers. The multiplier stays above 90% for the first three levels, so a party slightly ahead of its zone keeps most of its EXP. It never reaches zero, so no level exists where a kill suddenly stops counting.

### 2.4 Archetype stat tables

Three archetypes share one budget (anchor A9):

- At level 1, every attribute is 8 to 16 and the six total exactly 70.
- At level 100 before gear, the six total exactly 3,300.
- The signature attribute is exactly 800 at level 100. Every other attribute is 300 to 760.
- No attribute ever drops from one level to the next.

`statsAt(archetype, level)` returns the six attributes. All three archetypes grow in straight lines, so you can work any value by hand. Warrior STR at level 37 is `15 + (760 − 15) × 36 ÷ 99 = 285.9`, which rounds to 286.

The benchmark is `benchmarkStat(level)` from FOUNDATION: a trained attribute, 10 at level 1 and 600 at level 100.

| Level | 1 | 10 | 25 | 50 | 75 | 100 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Benchmark attribute | 10 | 64 | 153 | 302 | 451 | 600 |
| Budget, all six attributes | 70 | 364 | 853 | 1,669 | 2,484 | 3,300 |

#### Warrior (signature CON)

- **Identity:** The party's front door: thick, loud and very hard to get past.
- **Want:** To be the one still standing between the party and whatever is charging at it.
- **Cost:** A head built for helmets, not hexes: spells and nerves get through where swords cannot.

| Level | STR | INT | AGI | CON | WIL | LCK | Total | Max HP | Max MP |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 15 | 8 | 10 | 16 | 9 | 12 | 70 | 160 | 9 |
| 10 | 83 | 35 | 56 | 87 | 35 | 67 | 363 | 8,700 | 350 |
| 25 | 196 | 79 | 134 | 206 | 80 | 159 | 854 | 51,500 | 2,000 |
| 50 | 384 | 153 | 262 | 404 | 153 | 313 | 1,669 | 202,000 | 7,650 |
| 75 | 572 | 226 | 391 | 602 | 227 | 466 | 2,484 | 451,500 | 17,025 |
| 100 | 760 | 300 | 520 | 800 | 300 | 620 | 3,300 | 800,000 | 30,000 |

The want is CON 800 and STR 760: the deepest HP bar and the heaviest blade of the three. The cost is WIL 300, the floor. The warrior carries half the reference MP pool and takes 67% of incoming stress at level 100, where a mage takes 43%.

#### Mage (signature WIL)

- **Identity:** A library with a temper: an unshakeable mind in a very shakeable body.
- **Want:** To understand the thing, name the thing and set the thing on fire, in that order.
- **Cost:** Everything below the neck is on loan: one good shove and the lecture is over.

| Level | STR | INT | AGI | CON | WIL | LCK | Total | Max HP | Max MP |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 9 | 15 | 10 | 10 | 16 | 10 | 70 | 100 | 16 |
| 10 | 46 | 83 | 47 | 53 | 87 | 47 | 363 | 5,300 | 870 |
| 25 | 109 | 196 | 109 | 124 | 206 | 109 | 853 | 31,000 | 5,150 |
| 50 | 212 | 384 | 213 | 243 | 404 | 213 | 1,669 | 121,500 | 20,200 |
| 75 | 316 | 572 | 316 | 361 | 602 | 316 | 2,483 | 270,750 | 45,150 |
| 100 | 420 | 760 | 420 | 480 | 800 | 420 | 3,300 | 480,000 | 80,000 |

The want is WIL 800 and INT 760: the largest MP bar, the best magical defense and the lowest stress. The cost is the body. The mage has 60% of the warrior's HP, and a warrior's blade removes 18.1% of it per hit. AGI 420 and LCK 420 also make the mage the slowest and least accurate of the three.

#### Rogue (signature AGI)

- **Identity:** Never where the blade lands, never around when the bill arrives.
- **Want:** To get in, get the prize and get out before anyone finishes saying "hey".
- **Cost:** No armour and no backup plan: the one hit that does connect is the one that counts.

| Level | STR | INT | AGI | CON | WIL | LCK | Total | Max HP | Max MP |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 12 | 8 | 16 | 10 | 9 | 15 | 70 | 100 | 9 |
| 10 | 64 | 35 | 87 | 51 | 45 | 83 | 365 | 5,100 | 450 |
| 25 | 150 | 79 | 206 | 119 | 104 | 196 | 854 | 29,750 | 2,600 |
| 50 | 293 | 153 | 404 | 233 | 203 | 384 | 1,670 | 116,500 | 10,150 |
| 75 | 437 | 226 | 602 | 346 | 301 | 572 | 2,484 | 259,500 | 22,575 |
| 100 | 580 | 300 | 800 | 460 | 400 | 760 | 3,300 | 460,000 | 40,000 |

The want is AGI 800 and LCK 760: first in turn order, best accuracy and evasion, best odds on crits and status. The cost is CON 460 and WIL 400, both under the benchmark of 600. The rogue has the smallest HP bar, and STR 580 gives it the lightest blade of the two physical attackers.

#### The triangle at level 100

This table uses the damage, hit and stress formulas of section 1 (`engine/combat.js`). Damage is `Power × Level × 1.5 × A² ÷ (2A + D)`. "Blade" is a warrior's basic attack (Power 2, STR 760 against the defender's CON). "Spell" is a mage's attack at the same Power (INT 760 against the defender's WIL).

| Defender | Max HP | Blade damage | Share of HP | Hits to kill | Spell damage | Share of HP | Hits to kill | Stress taken |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 800,000 | 74,689 | 9.3% | 10.7 | 95,208 | 11.9% | 8.4 | 67% |
| Mage | 480,000 | 86,640 | 18.1% | 5.5 | 74,689 | 15.6% | 6.4 | 43% |
| Rogue | 460,000 | 87,515 | 19.0% | 5.3 | 90,250 | 19.6% | 5.1 | 60% |

Read each row left to right:

- **Warrior.** A spell removes 11.9% of the bar, a blade 9.3%. Magic hurts the warrior 27% more than steel does.
- **Mage.** A blade removes 18.1%, a spell 15.6%. The mage takes 22% less spell damage than the warrior and 36% less stress.
- **Rogue.** Both attacks remove a fifth of the bar. The rogue's defense is the miss: a warrior lands 68% of swings on a rogue and a mage lands 63% of spells. Each lands 75% on its own kind.

The shares at level 50 match these within 0.1 points.

**Known limit.** HP comes from CON alone, so the warrior still survives more spells (8.4) than the mage does (6.4). The mage's edge against magic is smaller hits and lower stress, not a longer life. Changing that means changing the HP baseline, which this section keeps.

#### Same-archetype duels

Anchor A2 asks for 6 to 14 landed basic attacks to win a mirror duel. The data holds that at every level from 1 to 100. Each cell is HP divided by one hit's damage; `hitsToKill` in `engine/combat.js` rounds it up.

| Duel | L1 | L50 | L100 | Lowest, any level | Highest, any level |
| ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior, STR against CON | 10.9 | 10.7 | 10.7 | 10.6 | 10.9 |
| Mage, STR against CON | 11.5 | 12.0 | 12.0 | 11.5 | 12.1 |
| Mage, INT against WIL | 6.8 | 6.4 | 6.4 | 6.4 | 6.8 |
| Rogue, STR against CON | 7.9 | 7.4 | 7.4 | 7.4 | 7.9 |

The basic attack is STR against CON for everyone. The mage row for INT shows two mages trading Power 2 spells: that mirror also stays above 6. Holding both rows inside the window is why mage CON is 480 and mage STR is 420. If you lower either one, rerun the pacing test. It checks this table under the shipped formula and under the FOUNDATION baseline.

**Why straight lines.** Every attribute of every archetype uses growth exponent 1. The benchmark is also a straight line, so each attribute keeps a near-constant ratio to it from level 10 upward. Every ratio in this section therefore holds across the game, and all three totals stay within 1.4% of the budget at every level. The exponent field exists for custom archetypes (2.7).

### 2.5 Bar scaling

```
maxHp(level, con, rank) = 10 × level × CON × RANK_HP_MULT[rank]
maxMp(level, wil)       =  1 × level × WIL
```

Both are the FOUNDATION baseline, unchanged. Level clamps to 1..100 and the attribute clamps to 1..1000. Rank changes HP only.

Set a combatant's bars from `stats` (base plus gear) when you build it. Buffs, debuffs and binds change what formulas read; they leave Max HP and Max MP alone.

Worked examples:

| Who | Level | Attribute | Working | Result |
|---|---:|---:|---|---:|
| Warrior, no gear | 1 | CON 16 | 10 × 1 × 16 | 160 HP |
| Warrior, no gear | 37 | CON 301 | 10 × 37 × 301 | 111,370 HP |
| Warrior, no gear | 37 | WIL 115 | 37 × 115 | 4,255 MP |
| Warrior, CON 800 + 200 from gear | 100 | CON 1000 | 10 × 100 × 1000 | 1,000,000 HP |
| Mage, WIL 800 + 200 from gear | 100 | WIL 1000 | 100 × 1000 | 100,000 MP |
| Anchor A3, low end | 1 | CON 10 | 10 × 1 × 10 | 100 HP |

**Reference pools.** `hpBudget(level)` and `mpBudget(level)` are the bars at the benchmark attribute. Size healing against the first and skill costs against the second.

| Level | hpBudget | mpBudget | Warrior HP | Warrior MP | Mage HP | Mage MP | Rogue HP | Rogue MP |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 100 | 10 | 160 | 9 | 100 | 16 | 100 | 9 |
| 10 | 6,400 | 640 | 8,700 | 350 | 5,300 | 870 | 5,100 | 450 |
| 25 | 38,250 | 3,825 | 51,500 | 2,000 | 31,000 | 5,150 | 29,750 | 2,600 |
| 50 | 151,000 | 15,100 | 202,000 | 7,650 | 121,500 | 20,200 | 116,500 | 10,150 |
| 75 | 338,250 | 33,825 | 451,500 | 17,025 | 270,750 | 45,150 | 259,500 | 22,575 |
| 100 | 600,000 | 60,000 | 800,000 | 30,000 | 480,000 | 80,000 | 460,000 | 40,000 |

At level 100 the warrior holds 133% of the HP budget and 50% of the MP budget. The mage holds 80% and 133%. The rogue holds 77% and 67%. From level 10 upward each ratio stays within 5 points of those.

**Enemy ranks.** Rank multiplies HP. The table uses benchmark CON, with CON 1000 in the last column.

| Rank | HP multiplier | L10 (CON 64) | L25 (CON 153) | L50 (CON 302) | L75 (CON 451) | L100 (CON 600) | L100 (CON 1000) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| minion | ×0.4 | 2,560 | 15,300 | 60,400 | 135,300 | 240,000 | 400,000 |
| standard | ×1 | 6,400 | 38,250 | 151,000 | 338,250 | 600,000 | 1,000,000 |
| elite | ×3 | 19,200 | 114,750 | 453,000 | 1,014,750 | 1,800,000 | 3,000,000 |
| boss | ×20 | 128,000 | 765,000 | 3,020,000 | 6,765,000 | 12,000,000 | 20,000,000 |
| superboss | ×60 | 384,000 | 2,295,000 | 9,060,000 | 20,295,000 | 36,000,000 | 60,000,000 |

A boss passes one million HP at level 29 and reaches 12 million at level 100. The working for the level-50 boss is `10 × 50 × 302 × 20 = 3,020,000`.

**A rule of thumb for HP.** A basic attack between benchmark peers deals `Level × attribute`: 640 at level 10, 15,100 at level 50, 60,000 at level 100. Divide the table above by those figures and the answer is the same at every level:

| Rank at benchmark CON | minion | standard | elite | boss | superboss |
|---|---:|---:|---:|---:|---:|
| Landed basic attacks to kill | 4 | 10 | 30 | 200 | 600 |

Skills run at Power 3 to 12 against a basic attack's 2, so divide again by 1.5 to 6 for skill use. For a softer enemy, lower its CON. An enemy whose CON is `k` times your attack attribute dies in `(10 ÷ 3) × k × (2 + k)` basic attacks: 4.17 at half, 6.88 at three quarters.

**Why this shape.** Both bars multiply level by an attribute, and attributes grow with level. Bars therefore grow with the square of the level, and so does damage. A fight at level 90 lasts as many hits as a fight at level 9, with numbers 93 times larger. That is pillar 1: unbounded numbers, bounded dice.

### 2.6 Yields and economy

`expYield(enemyLevel, rank)` and `goldYield(enemyLevel, rank)` return the reward for one defeated enemy. One multiplier table, `RANK_REWARD_MULT`, serves both.

EXP per defeated enemy, to each party member:

| Rank | Multiplier | L1 | L10 | L25 | L50 | L75 | L100 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| minion | ×0.4 | 20 | 200 | 500 | 1,000 | 1,500 | 2,000 |
| standard | ×1 | 50 | 500 | 1,250 | 2,500 | 3,750 | 5,000 |
| elite | ×4 | 200 | 2,000 | 5,000 | 10,000 | 15,000 | 20,000 |
| boss | ×30 | 1,500 | 15,000 | 37,500 | 75,000 | 112,500 | 150,000 |
| superboss | ×100 | 5,000 | 50,000 | 125,000 | 250,000 | 375,000 | 500,000 |

Gold per defeated enemy, to the party:

| Rank | Multiplier | L1 | L10 | L25 | L50 | L75 | L100 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| minion | ×0.4 | 4 | 40 | 100 | 200 | 300 | 400 |
| standard | ×1 | 10 | 100 | 250 | 500 | 750 | 1,000 |
| elite | ×4 | 40 | 400 | 1,000 | 2,000 | 3,000 | 4,000 |
| boss | ×30 | 300 | 3,000 | 7,500 | 15,000 | 22,500 | 30,000 |
| superboss | ×100 | 1,000 | 10,000 | 25,000 | 50,000 | 75,000 | 100,000 |

An elite pays the same as one whole reference fight. A boss pays 7.5 fights and a superboss 25.

| Boss level | HP at benchmark CON | EXP to each member | Share of that level's EXP | Gold | Share of a major purchase |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 128,000 | 15,000 | 120% | 3,000 | 120% |
| 50 | 3,020,000 | 75,000 | 46% | 15,000 | 46% |
| 100 | 12,000,000 | 150,000 | level cap | 30,000 | 26% |

**Why this shape.** Reward per point of enemy HP is 1.00 for minions and standard enemies, 1.33 for elites, 1.50 for bosses and 1.67 for superbosses. The dangerous fight always pays better than the same HP in fodder.

#### Gold, wealth and prices

`wealthAt(level)` is the gold a party has earned from reference fights by the time it reaches a level. Boss gold, chests and sales come on top.

| Level | Gold per standard enemy | Gold per fight | Gold across the level | Wealth on reaching | Basic recovery item | Major purchase |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 | 40 | 160 | 0 | 20 | 160 |
| 5 | 50 | 200 | 1,000 | 1,800 | 100 | 1,000 |
| 10 | 100 | 400 | 2,500 | 9,600 | 200 | 2,500 |
| 25 | 250 | 1,000 | 10,000 | 94,000 | 500 | 10,000 |
| 50 | 500 | 2,000 | 32,500 | 588,000 | 1,000 | 32,500 |
| 75 | 750 | 3,000 | 67,500 | 1,794,500 | 1,500 | 67,500 |
| 100 | 1,000 | 4,000 | 115,000 | 4,026,000 | 2,000 | 115,000 |

Two helpers set prices, one for each buying rhythm:

- **Consumables: `priceForFights(level, fights)`.** Players buy these fight by fight. A basic recovery item costs half a fight: `priceForFights(level, 0.5)`, or `20 × level`.
- **Gear: `priceAt(level, share)`.** Players buy this level by level. A major purchase such as a new weapon costs one level of gold: `priceAt(level, 1)`. Use smaller shares for armour and accessories. A share above 1 marks a luxury.

`PRICE_GUIDE` holds the two reference values, 0.5 fights and share 1.

The two targets fit in one budget. A recovery item after every fight takes 50% of income. One after every second fight takes 25%. The rest buys gear at this pace:

| Share of income saved | L1 | L10 | L25 | L50 | L75 | L95 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| One third | 1.94 | 2.66 | 2.82 | 2.90 | 2.93 | 2.94 |
| 40% | 1.71 | 2.27 | 2.38 | 2.43 | 2.45 | 2.46 |
| One half | 1.47 | 1.87 | 1.94 | 1.97 | 1.98 | 1.98 |

Each cell is the number of levels a party saves before it can afford a major purchase priced for the level where it started saving.

The level cap has no next level, so `levelGold(100)` reads the EXP curve as if it continued. Prices at level 100 follow the same rule as everywhere else.

**Why this shape.** Gold per enemy is a straight line, like EXP per enemy, so one multiplication gives both rewards. The number of fights per level also rises in a straight line, so income per level grows with the square of the level. Prices pegged to that income outrun last zone's purse: a level-50 weapon costs 13 times a level-10 weapon.

### 2.7 Custom archetypes

`data/archetypes.json` has this shape. Add an entry, or pass an object of the same shape straight to the functions.

```json
{
  "id": "warrior", "name": "Warrior",
  "identity": "One line.", "want": "What they are after.", "cost": "What it costs them.",
  "signature": "CON",
  "l1":       { "STR": 15,  "INT": 8,   "AGI": 10,  "CON": 16,  "WIL": 9,   "LCK": 12 },
  "l100":     { "STR": 760, "INT": 300, "AGI": 520, "CON": 800, "WIL": 300, "LCK": 620 },
  "exponent": { "STR": 1,   "INT": 1,   "AGI": 1,   "CON": 1,   "WIL": 1,   "LCK": 1 }
}
```

`validateArchetype(archetype)` returns `{ ok, errors, warnings }`. It reports every fault in one pass and names the archetype, the attribute and the rule. It checks:

1. `id` is lowercase snake case. `name`, `identity`, `want` and `cost` are non-empty strings.
2. `signature` is one of the six attribute keys.
3. `l1` and `l100` hold all six attributes as integers and no other keys.
4. The budget rules at the top of 2.4.
5. Each exponent is a number from 0.5 to 2. A missing exponent counts as 1.
6. No attribute drops between any two levels.

**Exponents.** `growthCurve(l1, l100, level, exponent)` raises the progress from level 1 to level 100 to the power of the exponent. Below 1, the attribute blooms early. Above 1, it blooms late. Both ends stay exact.

**The warning.** If the six-attribute total strays more than 5% from the budget line at any level, the validator adds a warning and names the worst level. The archetype still passes. An archetype with every exponent at 0.5 carries 40% more attributes than its peers at level 50, so pair each early bloomer with a late one.
