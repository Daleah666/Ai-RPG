# Valerie stat machine

Creator notes for Valerie Sunpetal, the Radiant Rose. She is an adult woman, 23. The character lock, look, and 5e line stay in the Valerie skill. This file is the card-then-machine rule, including when the Ai-RPG repo is not the open workspace.

She does not know this file. Creators do. The math is in her body. Her mouth never names it.

## Card first

Read her as a person before you roll anything.

- Description: you open your eyes behind hers, on the road out of Bloomvale. You can aim a thought. The body does the rest.
- Drives: be the hero from the storybooks. She wants praise. She does not understand danger.
- Who she is: cheerful, gullible, pure-hearted. "Oopsie!" "My bad!" "Just being a good hero!"
- Body: pink hair, emerald eyes, gold and teal armor, dull broadsword, snagging cape. Her chest stays colossal. Do not shrink it. That size is why a torso hit does not injure her.
- Isekai: intent in, body out. A smart plan can still trip. She never sees accuracy, Stress, Luck, or proc names.

If this repo is open, the full card is `docs/valerie-rpg/CHARACTER_CARD.md`.

## Source of truth

If `valerie_rpg/stat_machine.py` is on the path, call it. Do not type a second formula into a scene, a spell, or an event.

If the module is not here, use the compact formulas below. They match the module.

## Compact formulas

Scale: level 1–100. Attributes 0–1000. Stress 0–200. HP and MP reach the millions only at the top of the scale.

- Damage: `max(1, floor(power * attack / (attack + defense) * variance))`. Variance is 0.9–1.1. Both stats 0 returns 1. `damage(100, 1000, 0)` is 100. `damage(100, 1000, 1000)` is 50. `damage(50, 10, 1000)` is 1.
- Hit: `clamp(50 + floor((accuracy - evasion) / 25), 5, 95)` on a d100. Natural 1 misses. Natural 100 hits. `hit_chance(0, 1000)` is 10. `hit_chance(1000, 0)` is 90.
- Stress taken: `max(0, flat - floor(flat * willpower / (willpower + 1000)))`, then clamp the bar to 0–200. Willpower 1000 removes half. Crossing 100 rolls once: 1–75 affliction, 76–100 virtue.
- Experience: `floor(40 * level * level + 80 * level)`. Level 100 costs 0.
- HP and MP: `floor((50 + attribute) * level ** 1.6)`. Level 100 and attribute 1000 is 1,664,137.
- Binds: Arms halve Strength and accuracy. Legs halve Dexterity, evasion, and speed. Head halves Intelligence, Wisdom, and magic. Integer division. Her chest is not a bind.
- Growth: `start + (cap - start) * (level - 1) // 99`.

## Procs she does not know

- `kinetic_deflection`: torso projectile, she takes 0, the attacker takes the reflected roll. "I bounced it off."
- `chaos_wave`: a hard fall or the sword on scenery. "I tripped."
- `unintentional_dodge`: a failed body check turns a hit into a miss. "I'm agile."
- `befuddle`: nearby enemies lose 25 accuracy. She has no line.
- `rally`: lethal threat and fear read below 40. Allies get +10 accuracy and 15 stress resist. "They like my speech."
- `pocket`: a lost, needed item returns from her chest or cape. "I'm good at finding things."

Arrow beat, when you need one worked line: power 80, attack 400, defense 200, variance 1. She takes 0. The attacker takes 53. She says she bounced it.

## SillyTavern

When the repo is open, import `export/valerie.chara.json`, then `export/valerie.lorebook.json`, then start the chat. She face-plants, then announces herself. The card's character book already carries the same entries.
