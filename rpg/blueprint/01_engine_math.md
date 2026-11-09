## 1. FOUNDATIONAL ENGINE MATH

This section is the arithmetic of one action: does it land, how hard, how much stress, who goes first. The reference implementation is `engine/combat.js`. Every number on this page was produced by running that code, and `test/combat.test.js` pins the tables, so a retune that makes this page wrong fails a test.

### 1.1 Ground rules

- **Effective attributes only.** Every formula reads an attribute after buffs (combined multiplier clamped to ×0.5–×1.5) and binds (×0.5, once), rounded down and clamped to 1–1000. "STR" below always means effective STR.
- **A and D.** A is the attacker's attribute named by the skill: STR or INT. D is the defender's answering attribute: CON against STR, WIL against INT. A skill that attacks with any other attribute is defended by CON if it is physical and WIL if it is magical.
- **Level** is the level of whoever is acting: the attacker for damage, the healer for healing.
- **One d100 per action.** Low is good. Nothing rolls twice to land.
- **Rounding.** Chances: round to the nearest whole percent, then clamp. Damage and healing: multiply everything first, round down once at the end. Stress: round to the nearest whole point. A half rounds up.

| Constant | Value | Meaning |
|---|---|---|
| `HIT_BASE` | 75 | hit % when accuracy equals evasion |
| `HIT_SLOPE` | 40 | the most the accuracy ratio can add or remove (it never quite reaches 40) |
| `LCK_TO_ACC` | 0.5 | share of LCK added to AGI for accuracy and evasion |
| `CRIT_BASE` / `CRIT_SLOPE` | 5 / 20 | crit % at equal LCK / the most the LCK ratio can add or remove |
| `CRIT_FLOOR` / `CRIT_CAP` | 1 / 50 | the crit window |
| `CRIT_MULT` | 1.5 | damage multiplier on a crit |
| `FUMBLE_FROM` (constants.js) | 96 | first roll that fumbles |
| `DEF_WEIGHT` | 0.5 | what a point of defense is worth against a point of attack |
| `EVEN_PASS` | 0.5 | share of raw damage that gets through when A equals D |
| `GUARD_MULT` | 0.5 | damage multiplier against a guarding defender |
| `VARIANCE` | 0.90–1.10 | damage spread, in whole percents |
| `BASIC_POWER` | 2.0 | Power of the basic attack |
| `HEAL_SCALE` | 0.5 | healing per Power × Level × INT |
| `STRESS_K` | 600 | the WIL that shrugs off half of incoming stress |
| `STRESS_MIT_CAP` | 0.75 | upper limit on stress mitigation (a guard rail: WIL 1000 only reaches 0.625) |
| `INIT_SCALE` / `INIT_SPREAD` | 10 / 0.2 | initiative per point of AGI / size of the random part |

### 1.2 The d100 Bounded Percentile Hit Chance

```
ACC    = attacker AGI + attacker LCK ÷ 2
EVA    = defender AGI + defender LCK ÷ 2

Hit %  = clamp( 75 + 40 × (ACC − EVA) ÷ (ACC + EVA) + skill.acc + hitBonus , 5 , 95 )

Crit % = clamp( 5 + 20 × (LCKa − LCKd) ÷ (LCKa + LCKd) + skill.crit + critBonus , 1 , 50 )
         and never more than Hit %
```

Roll one d100 and read it in this order. The first line that matches is the result.

1. **Fumble**: the roll is 96 or more. Always a failure, with a consequence chosen by whoever called the roll.
2. **Crit**: the roll is at or under Crit %. Damage ×1.5.
3. **Hit**: the roll is at or under Hit %.
4. **Miss**: anything else.

In an even match that is 1–5 crit, 6–75 hit, 76–95 miss, 96–100 fumble.

Things that follow from the formula:

- Level is not in it. A level 1 duel and a level 100 duel between evenly matched fighters roll against the same 75.
- With no skill modifier, Hit % can only run from 35 (ACC 1.5 against EVA 1500, the worst mismatch the attribute range allows) to 95. The 5% floor is only reached through `skill.acc` or `hitBonus` penalties.
- With no skill modifier, Crit % runs from 1 to 25. The cap of 50 is only reached through `skill.crit` and `critBonus`.
- At the 95 cap there are no plain misses left: 96–100 is the fumble band.
- Crit is a band inside the hit roll, not a chance of its own, which is why its window is 1–50 instead of 5–95.

**Hit % by accuracy ratio and skill accuracy.** Rows are ACC ÷ EVA. Columns are `skill.acc`.

| ACC ÷ EVA | −20 | −10 | 0 | +10 | +20 |
|---|---|---|---|---|---|
| 0.10 | 22 | 32 | 42 | 52 | 62 |
| 0.25 | 31 | 41 | 51 | 61 | 71 |
| 0.33 | 35 | 45 | 55 | 65 | 75 |
| 0.50 | 42 | 52 | 62 | 72 | 82 |
| 0.67 | 47 | 57 | 67 | 77 | 87 |
| 0.75 | 49 | 59 | 69 | 79 | 89 |
| 0.90 | 53 | 63 | 73 | 83 | 93 |
| **1.00** | 55 | 65 | **75** | 85 | 95 |
| 1.11 | 57 | 67 | 77 | 87 | 95 |
| 1.33 | 61 | 71 | 81 | 91 | 95 |
| 1.50 | 63 | 73 | 83 | 93 | 95 |
| 2.00 | 68 | 78 | 88 | 95 | 95 |
| 3.00 | 75 | 85 | 95 | 95 | 95 |
| 4.00 | 79 | 89 | 95 | 95 | 95 |
| 10.0 | 88 | 95 | 95 | 95 | 95 |

**Crit % by luck ratio and skill crit.** Rows are attacker LCK ÷ defender LCK. Columns are `skill.crit`.

| LCK ratio | 0 | +10 | +20 |
|---|---|---|---|
| 0.10 | 1 | 1 | 9 |
| 0.25 | 1 | 3 | 13 |
| 0.50 | 1 | 8 | 18 |
| 0.75 | 2 | 12 | 22 |
| **1.00** | **5** | 15 | 25 |
| 1.33 | 8 | 18 | 28 |
| 1.50 | 9 | 19 | 29 |
| 2.00 | 12 | 22 | 32 |
| 3.00 | 15 | 25 | 35 |
| 4.00 | 17 | 27 | 37 |
| 10.0 | 21 | 31 | 41 |

**Band edges an ability may move.** These are the only handles. None of them adds a roll.

| Option | Effect |
|---|---|
| `hitBonus` | flat points added before the clamp. Use a negative number for a defender's dodge effect. |
| `hitFloor`, `hitCap` | replace the 5 and the 95. If they cross, the floor wins. |
| `critBonus` | flat points added to Crit % before its clamp. |
| `fumbleFrom` | first roll that fumbles. Lower widens the band and eats the top of the hit range. 101 switches fumbles off. A roll of 1 can never fumble. |
| `damageMult` | multiplies the damage of a landed hit. |

**Why this shape.** The swing is driven by a ratio, so AGI 20 against 10 at level 1 means exactly what AGI 800 against 400 means at level 100, and it is bounded, so no lead ever makes a roll automatic. The base is 75 because missing one swing in four keeps positioning and accuracy skills worth choosing without making turns feel wasted. LCK counts at half weight so AGI stays the accuracy attribute and luck is seasoning. The fumble band is a fixed five numbers at the top of the die: the finest duelist alive still trips over the rug one swing in twenty, which is the slapstick engine and the reason the cap is 95.

### 1.3 The Damage Formula

```
Damage = floor( Power × Level × A × Pass × variance × crit × affinity × guard × damageMult )

Pass   = 1.5 × A ÷ (2 × A + D)
```

In one line: `Power × Level × 1.5 × A² ÷ (2A + D)`, then the multipliers.

| Term | Value |
|---|---|
| Power | from the skill. Basic attack 2.0, skills about 3–12, ultimates 20 and up. |
| Level | the attacker's level, 1–100. |
| A, D | effective attacking and defending attributes (section 1.1). |
| Pass | the share that gets past the defender's attribute. Exactly 0.5 when A equals D, 0.75 at most. |
| variance | 0.90 to 1.10 in steps of 0.01, every step equally likely. Drawn after the attack roll, and only if it landed. It spreads damage; it cannot turn a hit into a miss. |
| crit | ×1.5 on a crit, otherwise ×1. |
| affinity | weak ×1.5, normal ×1, resist ×0.5, null ×0, absorb ×1 as healing (see below). |
| guard | ×0.5 if the defender is guarding, otherwise ×1. |
| damageMult | ×1 unless a passive says otherwise. |

**Order of operations.**

1. Take effective A and D.
2. Multiply every term as real numbers. Do not round along the way.
3. Round down once.
4. If the hit landed and was not nulled, the result is at least 1.
5. **Null**: the result is 0. **Absorb**: compute the hit as if the affinity were normal (crit and guard still apply) and add that amount to the defender's HP instead of removing it. `damage()` returns the positive amount and `resolveAttack()` sets `absorbed: true`; the caller does the healing.

A skill with Power 0 deals 0: buffs and pure status skills do not chip.

**The shortcut worth memorising.** At A = D, Pass is one half, so a basic attack does exactly **Level × A**. Every point of Power is 5% of the HP of a peer whose CON equals your attacking attribute: Power 2 is a tenth of their bar, Power 10 is half, Power 20 is all of it.

**Damage mitigation by defense ratio.** The last column is a basic attack at level 100 with A = 100.

| D ÷ A | Pass | Against an even match | Basic hit, L100, A 100 |
|---|---|---|---|
| 0.10 | 71.4% | ×1.43 | 14,285 |
| 0.25 | 66.7% | ×1.33 | 13,333 |
| 0.50 | 60.0% | ×1.20 | 12,000 |
| 0.60 | 57.7% | ×1.15 | 11,538 |
| 0.75 | 54.5% | ×1.09 | 10,909 |
| 0.80 | 53.6% | ×1.07 | 10,714 |
| 0.90 | 51.7% | ×1.03 | 10,344 |
| **1.00** | **50.0%** | **×1.00** | **10,000** |
| 1.10 | 48.4% | ×0.97 | 9,677 |
| 1.20 | 46.9% | ×0.94 | 9,375 |
| 1.25 | 46.2% | ×0.92 | 9,230 |
| 1.50 | 42.9% | ×0.86 | 8,571 |
| 2.00 | 37.5% | ×0.75 | 7,500 |
| 2.50 | 33.3% | ×0.67 | 6,666 |
| 3.00 | 30.0% | ×0.60 | 6,000 |
| 4.00 | 25.0% | ×0.50 | 5,000 |
| 5.00 | 21.4% | ×0.43 | 4,285 |
| 10.0 | 12.5% | ×0.25 | 2,500 |

Attack moves damage much more than defense does, because A appears twice. From an even match, a ×1.5 attack buff multiplies damage by 1.69 and a ×0.5 attack debuff (or bound arms) by 0.38. A ×1.5 defense buff multiplies damage taken by 0.86 and a ×0.5 defense debuff by 1.20. Guarding (×0.5) is the strong defensive tool; defense buffs are the slow one.

**Worked example, level 1.** Valerie (level 1, STR 14) swings at a Puddle Slime (CON 10) with a basic attack, Power 2. Plain hit, variance 0.96.

```
Pass   = 1.5 × 14 ÷ (2 × 14 + 10) = 21 ÷ 38       = 0.5526
Raw    = 2 × 1 × 14 × 0.5526                      = 15.47
Damage = floor( 15.47 × 0.96 ) = floor( 14.85 )   = 14
```

The slime has 10 × 1 × 10 = 100 HP. At variance 1.00 the same hit does 15, so it takes seven of them.

**Worked example, level 50.** A mage (level 50, INT 403) casts a Power 6 fire spell at a target with WIL 302 that is weak to fire. The roll is a crit. Variance 1.07.

```
Pass   = 1.5 × 403 ÷ (2 × 403 + 302) = 604.5 ÷ 1108   = 0.5456
Raw    = 6 × 50 × 403 × 0.5456                        = 65,960.33
       × 1.07 variance                                = 70,577.56
       × 1.5 crit                                     = 105,866.34
       × 1.5 weak                                     = 158,799.50
Damage = floor( 158,799.50 )                          = 158,799
```

A trained target at that level (CON 302) has 151,000 HP. Crit on a weakness is ×2.25, and with a Power 6 spell that is the whole bar.

**Worked example, level 100.** A warrior (level 100, STR 800, under a ×1.25 STR buff, so effective STR 1000) lands a Power 20 ultimate on a boss with CON 600. The boss is guarding and resists physical. Plain hit, variance 0.94.

```
Pass   = 1.5 × 1000 ÷ (2 × 1000 + 600) = 1500 ÷ 2600   = 0.5769
Raw    = 20 × 100 × 1000 × 0.5769                      = 1,153,846.15
       × 0.94 variance                                 = 1,084,615.38
       × 0.5 resist                                    = 542,307.69
       × 0.5 guard                                     = 271,153.85
Damage = floor( 271,153.85 )                           = 271,153
```

A boss with CON 600 at level 100 has 10 × 100 × 600 × 20 = 12,000,000 HP, so this is 2.3% of the bar. Without the guard and the resistance, at variance 1.00, the same hit does 1,153,846.

**Why this shape.** `Level × A` grows on the same Level × attribute square as max HP (`10 × Level × CON`), so a fight lasts as long at level 100 as at level 1 while the numbers go from tens to hundreds of thousands. Pass is a ratio, so only relative attributes matter, more defense always helps but with diminishing returns, and damage can never reach zero or go negative: there is no armor wall to make a fight unwinnable. Defense carries half the weight of attack because CON already buys HP. The FOUNDATION baseline, `A² ÷ (A + D)`, counted CON at full weight twice, and a defender with CON at 0.6× the attacker's STR died in 4.8 hits, outside the 6–14 anchor at every level. `1.5 × A ÷ (2A + D)` is the same curve with defense at half weight, rescaled so an even match still passes exactly half: nothing changes at A = D, and the soft end of the band moves from 4.8 hits to 5.2.

### 1.4 Expected hits to kill

Landed basic attacks needed to take a peer from full HP to zero, at variance 1.00 with no crits (`hitsToKill`). Max HP is `10 × Level × CON`. The attacker's STR is either trained (the benchmark line) or signature; the defender's CON is a multiple of it. Each cell is damage per hit / defender HP → hits.

| Level | Attacker STR | CON 0.6× | CON 0.8× | CON 1.0× | CON 1.2× |
|---|---|---|---|---|---|
| 1 | 10 (trained) | 11 / 60 → **6** | 10 / 80 → **8** | 10 / 100 → **10** | 9 / 120 → **14** |
| 1 | 14 (signature) | 15 / 90 → **6** | 15 / 110 → **8** | 14 / 140 → **10** | 13 / 160 → **13** |
| 50 | 302 (trained) | 17,405 / 91,000 → **6** | 16,170 / 121,000 → **8** | 15,100 / 151,000 → **10** | 14,162 / 181,000 → **13** |
| 50 | 403 (signature) | 23,245 / 121,000 → **6** | 21,596 / 161,000 → **8** | 20,150 / 201,500 → **10** | 18,899 / 241,500 → **13** |
| 100 | 600 (trained) | 69,230 / 360,000 → **6** | 64,285 / 480,000 → **8** | 60,000 / 600,000 → **10** | 56,250 / 720,000 → **13** |
| 100 | 800 (signature) | 92,307 / 480,000 → **6** | 85,714 / 640,000 → **8** | 80,000 / 800,000 → **10** | 75,000 / 960,000 → **13** |

The test suite checks every whole-number STR from trained to signature against every whole-number CON from 0.6× to 1.2× at levels 1, 50 and 100: all land in 6–14.

In general, `hits = HP ÷ (Power × Level × A × Pass)`, rounded up. For a basic attack against a defender whose CON sets both HP and defense, with r = CON ÷ STR, that is `(10 ÷ 3) × r × (2 + r)`: 10 at r = 1, and inside 6–14 for r from 0.59 to 1.28. An archetype whose CON ÷ STR sits outside that range breaks the anchor in a mirror duel.

Luck moves a duel by about one hit. In 20,000 seeded level 100 duels per column, signature attacker, with crits and variance on:

| Defender CON | Landed hits to kill |
|---|---|
| 0.6× | 5 hits 33%, 6 hits 67% (a crit among the first five ends it a hit early) |
| 1.0× | 9 hits 7%, 10 hits 68%, 11 hits 25% |
| 1.2× | 12 hits 19%, 13 hits 74%, 14 hits 7% |

Fewer than 1% of those duels ended one hit outside the ranges shown.

At even AGI and LCK, 75 swings in 100 land, so count about four swings for every three landed hits: an even duel is 10 landed hits and 13 to 14 swings.

### 1.5 Healing

```
Heal = floor( Power × Level × INT × 0.5 × variance × crit × mult ), at least 1
```

INT is the healer's effective INT (a skill may name another attribute). Variance, crit (×1.5) and `mult` all default to ×1; heals do not roll to hit.

**How it keeps pace with HP.** Healing grows with `Level × INT` just as max HP grows with `Level × CON`, so as a share of the target's bar a heal is `5% × Power × INT ÷ target CON` at every level. The 0.5 is the same one half that an even hit passes, so a heal of Power P undoes one even-stat hit of Power P.

| Healer (signature INT) | Power 3 heals | Power 8 heals | Share of an ally with CON equal to that INT |
|---|---|---|---|
| Level 1, INT 14 | 21 | 56 | 15% / 40% of 140 |
| Level 50, INT 403 | 30,225 | 80,600 | 15% / 40% of 201,500 |
| Level 100, INT 800 | 120,000 | 320,000 | 15% / 40% of 800,000 |

A squishier ally gets a bigger share from the same heal: the level 100 Power 3 heal is 20% of a CON 600 ally and 40% of a CON 300 one. A bound head halves INT and therefore the heal.

### 1.6 The Stress Mitigation formula

```
Mitigation   = min( 0.75 , WIL ÷ (WIL + 600) )
Stress taken = max( 1 , round( Base × mult × (1 − Mitigation) ) )
```

WIL is the target's effective WIL, so a bound head (WIL halved) takes more. `ignoreWill` skips the mitigation. `mult` scales stress gains and defaults to 1. A positive base always lands at least 1. A negative base is stress relief and passes straight through: no mitigation, no `mult`. The result is the amount to add; clamping the bar to 0–200 is the caller's job.

| Base stress | WIL 1 | WIL 100 | WIL 250 | WIL 500 | WIL 750 | WIL 1000 |
|---|---|---|---|---|---|---|
| share taken | 99.8% | 85.7% | 70.6% | 54.5% | 44.4% | 37.5% |
| 10 | 10 | 9 | 7 | 5 | 4 | 4 |
| 25 | 25 | 21 | 18 | 14 | 11 | 9 |
| 50 | 50 | 43 | 35 | 27 | 22 | 19 |

**Why this shape.** The stress bar is the one bar that never levels up, so its defense must flatten out instead of scaling. `WIL ÷ (WIL + 600)` gives a WIL 1 farmhand no help at all, takes half off at WIL 600 and stops at 62.5% off at the WIL 1000 cap: willpower is always worth having and never becomes immunity. Because WIL rises with level, the same base stress lands softer late in the game, so content has to raise base stress over the campaign to keep the same bite (a base of 24 on a trained level 100 hero lands as 12, the same as a base of 12 at level 1).

### 1.7 Turn order

```
Initiative = AGI × 10 + a whole number drawn evenly from 0 to AGI × 2
```

Higher acts first. The random part is at most 20% of the base, so AGI decides the order and the dice only shuffle near-ties. Ties go to the higher effective LCK, then to heroes before enemies.

| AGI lead | 0% | 5% | 10% | 15% | 20% or more |
|---|---|---|---|---|---|
| Faster one acts first | 50% | 73% | 88% | 97% | always |

Bound legs halve AGI: a bound fighter acts after everyone whose AGI is more than 60% of the bound fighter's unbound AGI.

### 1.8 At the table: quick reference

Four lookups resolve an attack and a stress hit by hand. Use the nearest row. If the game master can run code, call `resolveAttack` and `stressTaken` instead and use these tables to explain the result.

**Step 1. To hit.** ACC and EVA are AGI plus half of LCK. Find ACC ÷ EVA, then add the skill's accuracy.

| ACC ÷ EVA | ¼ | ⅓ | ½ | ⅔ | ¾ | even | 1⅓ | 1½ | 2 | 3 or more |
|---|---|---|---|---|---|---|---|---|---|---|
| Hit % | 51 | 55 | 62 | 67 | 69 | 75 | 81 | 83 | 88 | 95 |

Never below 5, never above 95.

**Step 2. To crit.** Attacker LCK ÷ defender LCK, then add the skill's crit.

| LCK ratio | ½ or less | ¾ | even | 1⅓ | 1½ | 2 | 3 | 4 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| Crit % | 1 | 2 | 5 | 8 | 9 | 12 | 15 | 17 | 21 |

Never below 1, never above 50, never above the hit chance.

**Step 3. Roll d100.** 96 or more: fumble. At or under Crit %: crit. At or under Hit %: hit. Otherwise: miss.

**Step 4. Damage.** `Level × A × (Power ÷ 2) × defense factor`. A basic attack on an even target is just Level × A.

| D ÷ A | ¼ | ½ | ¾ | even | 1¼ | 1½ | 2 | 3 | 4 | 5 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Defense factor | ×1.33 | ×1.20 | ×1.09 | ×1.00 | ×0.92 | ×0.86 | ×0.75 | ×0.60 | ×0.50 | ×0.43 | ×0.25 |

Then: crit ×1.5, weak ×1.5, resist ×0.5, guarding ×0.5, null = nothing, absorb = heals that much. Any hit that lands and is not nulled does at least 1. Skip variance at the table, or nudge the number up or down by a tenth for flavour.

**Step 5. Stress.** Find the target's WIL row and the base stress column.

| WIL | Taken | 5 | 10 | 15 | 20 | 25 | 30 | 40 | 50 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 100% | 5 | 10 | 15 | 20 | 25 | 30 | 40 | 50 |
| 50 | 92% | 5 | 9 | 14 | 18 | 23 | 28 | 37 | 46 |
| 100 | 86% | 4 | 9 | 13 | 17 | 21 | 26 | 34 | 43 |
| 200 | 75% | 4 | 8 | 11 | 15 | 19 | 23 | 30 | 38 |
| 300 | 67% | 3 | 7 | 10 | 13 | 17 | 20 | 27 | 33 |
| 400 | 60% | 3 | 6 | 9 | 12 | 15 | 18 | 24 | 30 |
| 500 | 55% | 3 | 5 | 8 | 11 | 14 | 16 | 22 | 27 |
| 600 | 50% | 3 | 5 | 8 | 10 | 13 | 15 | 20 | 25 |
| 800 | 43% | 2 | 4 | 6 | 9 | 11 | 13 | 17 | 21 |
| 1000 | 38% | 2 | 4 | 6 | 8 | 9 | 11 | 15 | 19 |

Stress relief is never reduced.

**Turn order.** Act in AGI order. When two fighters are within 20% of each other, each rolls a d100: the slower one goes first only by beating the faster one's roll by more than 5 points for every 1% of AGI lead. This by-hand rule matches the engine's odds in section 1.7 to within a point.

**One attack, start to finish.** A level 60 knight (STR 480, AGI 300, LCK 300) uses a Power 4 skill with accuracy −10 on an ogre (CON 720, AGI 200, LCK 200).

- To hit: ACC 450 against EVA 300 is 1½, so 83, minus 10 is **73**. Luck 300 against 200 is 1½, so crit **9**.
- The d100 comes up 41: a hit.
- Damage: D ÷ A is 720 ÷ 480 = 1½, factor ×0.86. 60 × 480 × 2 × 0.86 = **49,536**. The engine's exact figure is 49,371.
- The ogre roars back for base stress 20. The knight's WIL is 300: **13** stress.
