# Stat machine

`valerie_rpg/stat_machine.py` is the authority. This page records the same math. Spells, items, bosses, and plug-in events cite the function names below. They do not restate the formulas.

Valerie does not see this page. Creators do. Her mouth gets the belief string. The machine line stays on the creator side.

Scale: level 1–100, attributes 0–1000, HP and MP into the millions at the top of the scale, Stress strictly 0–200.

## Damage

`damage(power, attack, defense, variance=1.0)`

```text
max(1, floor(power * attack / (attack + defense) * variance))
```

Variance is 0.9 to 1.1. If attack and defense are both 0, the result is 1.

- `damage(100, 1000, 0)` is 100. No defense, full power, variance 1.
- `damage(100, 1000, 1000)` is 50. Matched stats, half power.
- `damage(50, 10, 1000)` is 1. A weak attack into a high defense falls to 1.
- `damage(100, 1000, 1000, 0.9)` is 45. `damage(100, 1000, 1000, 1.1)` is 55.

## Hit

`hit_chance(accuracy, evasion)` then `resolve_hit(accuracy, evasion, roll)`.

```text
clamp(50 + floor((accuracy - evasion) / 25), 5, 95)
```

The roll is a d100. A natural 1 misses. A natural 100 hits. Anything else hits when the roll is less than or equal to the chance.

On the 0–1000 scale the chance lands between 10 and 90. The floor of 5 and the cap of 95 catch stats outside that scale.

- `hit_chance(0, 1000)` is 10. `hit_chance(1000, 0)` is 90.
- `hit_chance(-500, 2000)` is 5. `hit_chance(5000, 0)` is 95.
- `resolve_hit(1000, 0, 1)` misses. `resolve_hit(0, 1000, 100)` hits.

Valerie's Dexterity keeps her in the low band. Dodge and chaos live there. Bounce is not a miss. Bounce runs when a projectile hits her torso.

A plug-in stat check is this same roll. `resolve_hit(stat, dc, roll)`. The DC stands in for the opposing number. It is not a second formula.

## Stress

`stress_taken(flat, willpower)` and `gain_stress(current, flat, willpower, roll=None)`.

```text
max(0, flat - floor(flat * willpower / (willpower + 1000)))
```

The bar then clamps to 0–200. Willpower 0 removes nothing. Willpower 1000 removes half. `stress_taken(40, 1000)` is 20. `stress_taken(40, 0)` is 40. A gain from 190 with a taken of 40 stops at 200.

Crossing 100 starts one breaking-point roll. `breaking_point(roll)`: 1–75 affliction, 76–100 virtue. The roll is required on that crossing and is not repeated while Stress stays at 100 or above. `gain_stress(90, 30, 0, roll=75)` lands at 120 and an affliction. The same gain with roll 76 is a virtue.

`stress_after_resist(taken, resist)` subtracts a rally's stress-resist bump after the willpower line, and stops at 0.

## Level, HP, MP

`exp_to_next(level)`

```text
floor(40 * level * level + 80 * level)
```

Level 100 is the cap, so `exp_to_next(100)` is 0.

- Level 1 costs 120.
- Level 50 costs 104,000.
- Level 99 costs 399,960.

`hp_max(level, constitution)` and `mp_max(level, mind)` share one shape:

```text
floor((50 + attribute) * level ** 1.6)
```

Early bars are small. The millions are the top of the scale.

- Level 1, attribute 0: 50.
- Level 1, Constitution 120 (Valerie): 170 HP.
- Level 100, attribute 1000: 1,664,137.
- Level 100, Constitution 740 (Valerie's cap): 1,252,065 HP.

## Binds

`apply_bind(stats, part)` uses integer division.

- Arms halve Strength and weapon accuracy.
- Legs halve Dexterity, evasion, and speed.
- Head halves Intelligence, Wisdom, and magic.

Her chest is a deflection zone, not a bind slot. `apply_bind` accepts only `BindPart.ARMS`, `BindPart.LEGS`, and `BindPart.HEAD`.

On her level-1 block, Arms turn Strength 150 into 75 and accuracy 40 into 20. An odd Strength of 101 becomes 50.

## Archetypes

`archetype_at(name, level)` grows each stat in a straight line:

```text
start + (cap - start) * (level - 1) // 99
```

Level 1 is the start. Level 100 is the cap. Level 50 is 49/99 of the way, not the average of the two ends. Names: Warrior, Mage, Rogue, Radiant Rose.

`creator_sheet(name, level)` is the block she is allowed to know about. Radiant Rose drops Luck and sets `luck_hidden`. Use `archetype_at` when you need the real Luck.

### Warrior

| Stat | Level 1 | Level 50 | Level 100 |
| --- | --- | --- | --- |
| Strength | 180 | 585 | 1000 |
| Dexterity | 70 | 243 | 420 |
| Constitution | 160 | 536 | 920 |
| Intelligence | 40 | 129 | 220 |
| Wisdom | 60 | 218 | 380 |
| Charisma | 50 | 193 | 340 |
| Accuracy | 120 | 456 | 800 |
| Evasion | 70 | 233 | 400 |
| Willpower | 90 | 401 | 720 |
| Mind | 40 | 148 | 260 |
| Luck | 40 | 158 | 280 |
| Speed | 80 | 277 | 480 |
| Magic | 30 | 104 | 180 |

### Mage

| Stat | Level 1 | Level 50 | Level 100 |
| --- | --- | --- | --- |
| Strength | 40 | 138 | 240 |
| Dexterity | 60 | 218 | 380 |
| Constitution | 70 | 263 | 460 |
| Intelligence | 190 | 590 | 1000 |
| Wisdom | 140 | 496 | 860 |
| Charisma | 80 | 357 | 640 |
| Accuracy | 100 | 426 | 760 |
| Evasion | 50 | 193 | 340 |
| Willpower | 110 | 471 | 840 |
| Mind | 190 | 590 | 1000 |
| Luck | 50 | 233 | 420 |
| Speed | 60 | 228 | 400 |
| Magic | 180 | 585 | 1000 |

### Rogue

| Stat | Level 1 | Level 50 | Level 100 |
| --- | --- | --- | --- |
| Strength | 80 | 317 | 560 |
| Dexterity | 180 | 585 | 1000 |
| Constitution | 80 | 307 | 540 |
| Intelligence | 70 | 263 | 460 |
| Wisdom | 80 | 287 | 500 |
| Charisma | 70 | 272 | 480 |
| Accuracy | 160 | 555 | 960 |
| Evasion | 180 | 585 | 1000 |
| Willpower | 60 | 277 | 500 |
| Mind | 50 | 193 | 340 |
| Luck | 120 | 466 | 820 |
| Speed | 180 | 585 | 1000 |
| Magic | 40 | 138 | 240 |

### Radiant Rose

Her 5e fighter line maps onto this scale at level 1. Strength 16 and Charisma 16 are the high pair: Strength 150 sits next to the Warrior, Charisma 160 is above the others. Dexterity 8 is 36, Wisdom 8 is 36, Intelligence 6 is 24, all under the other three. Constitution 14 is 120, between the Rogue and the Warrior. Luck has no 5e score. It starts at 480, caps at 1000, and stays hidden from her.

Her caps keep Dexterity, Intelligence, and Wisdom low on purpose. She does not grow into a careful fighter.

| Stat | Level 1 | Level 50 | Level 100 |
| --- | --- | --- | --- |
| Strength | 150 | 511 | 880 |
| Dexterity | 36 | 92 | 150 |
| Constitution | 120 | 426 | 740 |
| Intelligence | 24 | 51 | 80 |
| Wisdom | 36 | 102 | 170 |
| Charisma | 160 | 555 | 960 |
| Accuracy | 40 | 124 | 210 |
| Evasion | 30 | 84 | 140 |
| Willpower | 70 | 263 | 460 |
| Mind | 28 | 78 | 130 |
| Luck (hidden) | 480 | 737 | 1000 |
| Speed | 42 | 144 | 250 |
| Magic | 20 | 44 | 70 |

Level 50 Strength is `150 + (880 - 150) * 49 // 99` = 511.

## Procs

Each one returns a `ProcResult`. `belief` is what she thinks. `machine_line()` is the creator line.

- `kinetic_deflection(power, attack, defense, variance=1.0)`. A projectile hit her torso. Self damage is 0. Reflected damage is `damage(...)` of that same roll. Belief: "I bounced it off."
- `chaos_wave(wave_accuracy, wave_evasion, wave_roll, device_present)`. A hard fall or the sword hit scenery. Knockdown is `resolve_hit` on the wave numbers. A device triggers when `device_present` is true. Belief: "I tripped."
- `unintentional_dodge(body_check_failed)`. A failed body check turns the incoming hit into a miss. Belief: "I'm agile." If the body check succeeded, the hit stands and she gets no belief line.
- `befuddle(enemy_accuracy, penalty=25)`. No belief. Enemy accuracy drops by 25, and not below 0. `penalized_accuracy` is what their next coordination roll uses.
- `rally(fear_read, lethal_threat)`. Allies watching her face a lethal threat while `fear_read` is below 40 gain +10 accuracy and 15 stress resist. Belief: "They like my speech." Otherwise the proc is quiet.
- `pocket(item, lost, needed)`. A lost item that is needed now comes back. Belief: "I'm good at finding things." Otherwise nothing returns and she gets no line.

Fear read below 40 is the low bar. The rally bonuses are `RALLY_ACCURACY` (10) and `RALLY_STRESS_RESIST` (15). The aura penalty is `BEFUDDLE_PENALTY` (25).

## One fight beat

An arrow hits her chest. Power 80, attack 400, defense 200, variance 1.

She says: "Ow— hey! I bounced it off! Just being a good hero!"

The machine says: `kinetic_deflection self_damage=0 reflected_damage=53`

She takes 0. The attacker takes 53. `arrow_beat(80, 400, 200, 1.0)` returns both lines. `reflected_damage` is `floor(80 * 400 / 600)`.

## Tests

`python -m unittest valerie_rpg.test_stat_machine` locks the examples on this page, the six procs, and the three starter events.
