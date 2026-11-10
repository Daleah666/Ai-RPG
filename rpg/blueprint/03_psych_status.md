## 3. PSYCHOLOGICAL & STATUS SYSTEMS

This section is the two systems that stop a fight from being a damage race: **stress** (the second health bar, the Resolve Check, Afflictions, Virtues, permanent marks and the Breakdown) and **body-part binds**. The reference implementations are `engine/stress.js` and `engine/binds.js`; the tables are `data/afflictions.json` and `data/virtues.json`. Every number on this page was produced by running that code, and `test/stress.test.js` and `test/binds.test.js` pin the rules, so a retune that makes this page wrong fails a test.

### 3.1 Ground rules

- **One d100 answers one question.** The Resolve Check, the turn check and a bind attempt are one roll each, read against bands. Nothing here rolls twice. When a rule says a target or a skill is "read off the dice", it is picked with the roll already on the table: take the roll modulo the length of the list (`pickByRoll`). It is the same trick as the hero's `befuddledPart`.
- **Low is good. 96–100 is bad news. Doubles are for keeps.** On the Resolve Check low rolls are Virtues. On the turn check and on a bind attempt 96–100 is the fumble band, as it is everywhere else. Doubles (11, 22 … 99, and 100 read as 00) make a Resolve result permanent.
- **The world's stress goes through Willpower. The party's does not.** Stress from enemies, traps and events is mitigated by effective WIL (section 1.6). Stress that party members hand each other, and all stress relief, is flat: the number written is the number the bar moves. A flat number means the same thing at level 1 and level 100, and it matches the card text exactly.
- **Bounded.** Stress is 0–200 at every level. The Virtue chance runs 10–40. The turn check and the bind chance are clamped to 5–95 like every other roll.

### 3.2 The stress bar

Every hero has a stress bar from 0 to 200. It is the same bar at level 1 and at level 100.

| Stress | Name | What happens |
|---|---|---|
| 0–49 | Calm | Nothing. An Affliction ends the moment relief brings its owner down into this stretch. |
| 50–99 | Strained | Nothing yet. |
| reaching 100 | **Resolve Check** | One d100 decides between a Virtue and an Affliction (3.4). |
| 100–199 | Cracking | Whatever the check gave them is running. An Affliction acts more often the higher the bar climbs. |
| reaching 200 | **Breakdown** | Someone has to pay, and the player chooses who (3.8). |

- Stress is a whole number, clamped to 0–200.
- **One check per crossing.** The Resolve Check fires when stress reaches 100 from below and the character has no Affliction or Virtue. A character who already has one makes no new check however often the bar crosses 100. A character whose state is cleared while they sit at 100 or more makes no check either: they have to drop under 100 and reach it again.
- One hit that carries the bar through 100 and on to 200 is a Breakdown, not a check.
- A knocked-out character takes no stress and makes no checks. Neither does one who has Stormed Off.

**The choice.** Relief costs a turn, MP, an item or gold (3.9). Every point you remove is an action that was not damage or healing. Every point you leave is a step toward a roll you lose three times in four.

### 3.3 Where stress comes from

Stress from the world is written as a **tier**, and `stressBase(tier, level)` turns the tier into the base number for a skill or an event:

```
Base = round( Lands × (1 + benchmark attribute at that level ÷ 600) )      Lands: weak 5, medium 12, severe 24
```

The base rises with level exactly as fast as a trained Willpower learns to shrug it off, so a hit of each tier lands 5, 12 or 24 on a character whose WIL sits on the benchmark line at every level. The bar is 100 points to the Resolve Check: about eight medium hits, or four severe ones. What moves with level is the gap between the classes.

| Level | Weak | Medium | Severe | A Medium hit lands on Warrior / Mage / Rogue |
|---|---|---|---|---|
| 1 | 5 | 12 | 24 | 12 / 12 / 12 |
| 10 | 6 | 13 | 27 | 12 / 11 / 12 |
| 25 | 6 | 15 | 30 | 13 / 11 / 13 |
| 50 | 8 | 18 | 36 | 14 / 11 / 13 |
| 75 | 9 | 21 | 42 | 15 / 10 / 14 |
| 100 | 10 | 24 | 48 | 16 / 10 / 14 |

At level 1 everyone takes the same. By level 100 the same howl costs the Warrior 16 and the Mage 10: stress finds the Warrior first, as section 2 intends. Flat stress written on a move (bosses do this) skips the tier lookup and goes straight to WIL.

**The standard sources.** These are the things that cause stress without a skill saying so. Feed `stressFor(id, level)` to `applyStress`.

| Source | When | Who takes it | Tag | Tier |
|---|---|---|---|---|
| `crit_taken` | Takes a critical hit. | the target | wound | weak |
| `brink` | HP falls under a quarter. Once per battle each. | that character | wound | medium |
| `ally_down` | An ally is knocked out. | each ally still standing | death | medium |
| `downed` | Was knocked out. Lands when they are back on their feet. | that character | death | medium |
| `fumble` | Fumbles their own roll. | that character | embarrassment | weak |
| `ambushed` | The party is ambushed or springs a trap. | everyone | general | weak |
| `fled` | The party runs from a battle. | everyone | embarrassment | weak |
| `long_haul` | Each battle after the third in a row with no camp or inn. | everyone | general | weak |
| `jeer` | An enemy taunt, jeer or unsettling stare. | the target | mental | weak |
| `dread` | An enemy howl, curse or nightmare. | the target | horror | medium |
| `set_piece` | A set-piece horror that carries no stress number of its own: the lich unmasks, the floor turns out to be a mouth. | everyone | horror | severe |
| `the_truth` | Someone explains what really just happened. | the target | realization | medium |

**Source tags.** Every stress hit carries one tag, and rules key on it:

| Tag | Who cares |
|---|---|
| general | nobody in particular |
| horror | Spooked takes ×1.5, the Flinch Scar ×1.25. Valerie takes none unless she is Lucid (section 6). |
| mental | Tinfoil Helm takes ×1.25. Valerie takes none unless she is Lucid. Everything the party does to itself carries this tag. |
| realization | Ignores Valerie's Willpower and knocks her gauge down. |
| embarrassment | ×1.5 on Valerie unless she is a Total Airhead. |
| wound | Martyr Complex takes ×0.5. |
| death | Someone going down: the standard sources that land hardest. Passives key on it (section 4). |

**Stress the party gives itself is flat.** It ignores WIL and is tagged mental: 5–10 to every other member when an ally's Affliction starts, 3–8 when an Affliction acts out, 20 from a Breakdown that is Had Out. No amount of Willpower helps you watch a friend fall apart.

### 3.4 The Resolve Check

When stress reaches 100, roll **one d100**. That roll is the whole check.

1. **The band the roll falls in picks the side and the entry.** At the base odds 1–25 is a Virtue and 26–100 is an Affliction: 25% and 75%, exactly.
2. **An even roll is personal.** If the character has an entry of their own for the side rolled, it replaces the table entry. On an odd roll the table stands.
3. **Doubles are permanent.** 11, 22, 33, 44, 55, 66, 77, 88, 99 or 100: the result leaves a mark when it ends (3.7). Any other roll is temporary and leaves nothing.

| d100 | Result | Side | In one line | Party | Doubles in the band |
|---|---|---|---|---|---|
| 1–5 | **On a Roll** | Virtue | To do the big brave thing while everyone is watching. | sheds 8 | none |
| 6–10 | **Unflappable** | Virtue | To be the calm one in the room. | sheds 10 | none |
| 11–15 | **In the Zone** | Virtue | To finish the one thing in front of them. | sheds 5 | 11 |
| 16–20 | **Mother Hen** | Virtue | To get everyone home in one piece. | sheds 12 | none |
| 21–25 | **Second Wind** | Virtue | To prove they can take it. | sheds 6 | 22 |
| 26–36 | **Martyr Complex** | Affliction | Takes hits nobody asked them to take, then turns the healing down. | takes 5 | 33 |
| 37–47 | **Spooked** | Affliction | Hides at the moment the party needs a hit landed. | takes 6 | 44 |
| 48–58 | **Loot Goblin** | Affliction | Spends the party's supplies on themselves and their turns on nobody else. | takes 5 | 55 |
| 59–69 | **Tinfoil Helm** | Affliction | Turns help down at the exact moment it is needed. | takes 8 | 66 |
| 70–80 | **Backseat Hero** | Affliction | Wears the party down faster than the monsters do. | takes 8 | 77 |
| 81–90 | **Doomsayer** | Affliction | Stops trying, and makes stopping sound sensible. | takes 10 | 88 |
| 91–100 | **Lost the Plot** | Affliction | Nobody, including them, knows what their turn will be. | takes 8 | 99, 100 |

"Party" is what every other party member's bar does when the result starts. Each Affliction's band holds exactly one doubles roll at the base odds (Lost the Plot holds two), so every Scar can happen. Of the hundred faces, 8 leave a Scar and 2 leave a Silver Lining.

**Shifting the odds.** Abilities and circumstances add to or take from the Virtue chance. The total shift is clamped to ±15, so the Virtue chance runs from 10 to 40.

| Source | Shift |
|---|---|
| Each ally currently in a Virtue | +5 |
| Each ally currently Afflicted | −5 |
| An Unflappable ally | +5 more, so +10 in all |
| A Doomsayer ally | −5 more, so −10 in all |
| Valerie standing and Ditzy / a Total Airhead (allies' checks only) | +5 / +10 |
| A skill, item or event | whatever it says |

Knocked-out allies and allies who Stormed Off count for nothing. `partyResolveShift(allies, extra)` adds this up.

**How the bands move.** A shift moves the line between the two sides. Each side keeps its entries in order and stretches or squeezes them evenly:

```
upper edge = start of the side + round( base width up to and including this entry × new width of the side ÷ base width of the side )

Virtues:      start 0,               base width 25, new width = Virtue chance
Afflictions:  start = Virtue chance, base width 75, new width = 100 − Virtue chance
```

A half rounds up, and the last entry on each side always ends where its side ends, so the bands fill 1–100 with no gap and no overlap at every shift. At +10: Mother Hen ends at round(20 × 35 ÷ 25) = 28, and Spooked ends at 35 + round(22 × 65 ÷ 75) = 35 + 19 = 54. Nobody needs to do this at the table: `resolveBands(tables, shift)` returns the layout, and here it is for every shift a table will see. For a shift in between, use the nearer column.

| Result | −15 | −10 | −5 | **no shift** | +5 | +10 | +15 |
|---|---|---|---|---|---|---|---|
| *Virtue chance* | *10%* | *15%* | *20%* | *25%* | *30%* | *35%* | *40%* |
| On a Roll | 1–2 | 1–3 | 1–4 | **1–5** | 1–6 | 1–7 | 1–8 |
| Unflappable | 3–4 | 4–6 | 5–8 | **6–10** | 7–12 | 8–14 | 9–16 |
| In the Zone | 5–6 | 7–9 | 9–12 | **11–15** | 13–18 | 15–21 | 17–24 |
| Mother Hen | 7–8 | 10–12 | 13–16 | **16–20** | 19–24 | 22–28 | 25–32 |
| Second Wind | 9–10 | 13–15 | 17–20 | **21–25** | 25–30 | 29–35 | 33–40 |
| Martyr Complex | 11–23 | 16–27 | 21–32 | **26–36** | 31–40 | 36–45 | 41–49 |
| Spooked | 24–36 | 28–40 | 33–43 | **37–47** | 41–51 | 46–54 | 50–58 |
| Loot Goblin | 37–50 | 41–52 | 44–55 | **48–58** | 52–61 | 55–64 | 59–66 |
| Tinfoil Helm | 51–63 | 53–65 | 56–67 | **59–69** | 62–71 | 65–73 | 67–75 |
| Backseat Hero | 64–76 | 66–77 | 68–79 | **70–80** | 72–81 | 74–83 | 76–84 |
| Doomsayer | 77–88 | 78–89 | 80–89 | **81–90** | 82–91 | 84–91 | 85–92 |
| Lost the Plot | 89–100 | 90–100 | 90–100 | **91–100** | 92–100 | 92–100 | 93–100 |
| *Rolls that leave a Scar* | 10 | 9 | 9 | 8 | 8 | 7 | 7 |
| *Rolls that leave a Silver Lining* | 0 | 1 | 1 | 2 | 2 | 3 | 3 |

A shift moves the doubles too. Crush the Virtue chance to 10 and no roll leaves a Silver Lining at all.

**What the check does to the party.** Averaged over the hundred faces, one Resolve Check at the base odds costs every other party member 3.3 stress. At +10 it costs 1.7, at +15 1.0, and at −15 it costs 5.5. An Affliction also takes 5 off the next person's Virtue chance. Checks come in chains, and the first one sets the direction.

**Personal entries.** A character can carry one Affliction and one Virtue of their own, passed to `resolveCheck` as `personal: { affliction, virtue }`. Half the die is even, so half that character's results are their own. A personal entry has the same shape as a table entry without `range`; only `id`, `name` and `text` are required. One that names no mark of its own leaves Frayed Nerves or the Silver Lining on doubles. Valerie's two are in section 6.

**Worked example.** A level 50 Warrior (WIL 153) is on 92 stress when a medium horror hit arrives: base 18, lands 14, bar 106. The bar reached 100 from below: Resolve Check. Valerie is a Total Airhead (+10) and the Mage is already Spooked (−5): shift +5, Virtue on 1–30. The roll is 66. In the +5 column 62–71 is **Tinfoil Helm**. The roll is even, but the Warrior has no personal Affliction, so the table stands. The roll is doubles: when this ends it leaves the **Trust Issues** Scar. Right now the Warrior's Willpower drops to 122, every other party member takes 8 stress, and from the Warrior's next turn the Affliction acts 30% of the time. A 27 would have been Second Wind: with no shift it is Martyr Complex.

**The choice.** Spend relief to stay under 100, or let someone ride it. One roll in four is a Virtue, the first result bends the odds for everyone after it, and you decide who goes first by deciding whom you calm down.

### 3.5 Afflictions

An Affliction is a personality that takes over. It changes what the character will and will not do.

- **When it starts** its attribute multipliers apply at once, as ordinary modifiers under the ×0.5–×1.5 clamp of section 1.1, and every other party member takes the stress listed, flat. The owner's bar does not move.
- **At the start of each of their turns** they make the turn check below.
- **While it lasts** every other party member's Virtue chance is 5 lower.
- **Outside battle** there are no turn checks. Its attribute changes, its standing refusals and its stress multipliers stay, and the game master plays its want and its cost.
- **It ends** when one of these happens: relief takes the owner under 50 stress; a Night Off in town; a snap-out cure such as Smelling Salts; a Breakdown. Winning the battle does not end it, and neither does a night at an inn unless the inn's relief gets them under 50.

**The turn check.** One d100 at the start of an afflicted character's turn. The Affliction's chance to act is its base chance plus 5 for every full 20 stress over 100, clamped to 5–95.

- **Composed**: the roll is at or under 100 minus the chance. The player has the turn.
- **Acts out**: the roll is above that. The Affliction's act happens. Some acts take the turn; some happen and then the player acts.
- **Meltdown**: the roll is 96–100. The Affliction's worst act happens instead.

Whatever the act says they refuse, they refuse until their next turn check. "The most hurt ally" always means the ally with the lowest HP as a share of their maximum. A Tinfoil Helm on 130 stress acts 35% of the time: 1–65 composed, 66–95 acts out, 96–100 meltdown.

| Stress | Base 30%: Martyr Complex, Loot Goblin, Tinfoil Helm, Backseat Hero | Base 35%: Spooked, Doomsayer | Base 40%: Lost the Plot |
|---|---|---|---|
| under 100 | 30% | 35% | 40% |
| 100–119 | 30% | 35% | 40% |
| 120–139 | 35% | 40% | 45% |
| 140–159 | 40% | 45% | 50% |
| 160–179 | 45% | 50% | 55% |
| 180–199 | 50% | 55% | 60% |

The seven Afflictions. Band, personality, what it always does, what it does when it acts, what it does to the party, and the Scar it can leave.

#### Martyr Complex (26–36)

*"No, no. You go on. I'll just bleed here."*

| | |
|---|---|
| **Want** | To suffer the most, where everyone can see it. |
| **Cost** | Takes hits nobody asked them to take, then turns the healing down. |
| **Always** | Constitution ×0.85; wound stress ×0.5. |
| **Acts out** (30% at 100 stress) | **Take Me Instead.** Spends the turn standing in front of the most hurt ally: single-target attacks aimed at that ally hit the martyr instead until their next turn. Refuses healing until then. |
| **Meltdown** (96–100) | **Look What You Made Me Do.** Walks into the nearest hazard on purpose: loses the turn and 10% of max HP, and every ally takes 4 stress from the guilt. |
| **When it starts** | Every other party member takes 5 stress. |
| **Scar** (doubles: 33) | **No, No, I'm Fine.** The first heal an ally aims at them in each battle is waved off and wasted. |

#### Spooked (37–47)

*"That barrel moved. That barrel DEFINITELY moved."*

| | |
|---|---|
| **Want** | To be behind something. Preferably someone. |
| **Cost** | Hides at the moment the party needs a hit landed. |
| **Always** | Might ×0.8; Arcana ×0.8; Finesse ×1.1; horror stress ×1.5. |
| **Acts out** (35% at 100 stress) | **Duck and Cover.** Guards instead of acting. |
| **Meltdown** (96–100) | **Every Hero for Themselves.** Shrieks and hides behind the nearest ally: loses the turn, and every ally takes 6 stress. |
| **When it starts** | Every other party member takes 6 stress. |
| **Scar** (doubles: 44) | **Flinch.** Takes 25% more stress from horror, for good. |

#### Loot Goblin (48–58)

*"Finder's fee."*

| | |
|---|---|
| **Want** | To have the most. Of anything. |
| **Cost** | Spends the party's supplies on themselves and their turns on nobody else. |
| **Always** | Willpower ×0.85; Luck ×1.1; will not use items on anyone else; will not use single-target skills on anyone else; battle gold ×0.9. |
| **Acts out** (30% at 100 stress) | **Mine.** Uses the party's best healing item on themselves, hurt or not. With no item to take, they Guard. |
| **Meltdown** (96–100) | **Hazard Pay.** Refuses to lift a finger until paid: loses the turn, and the party loses 10 gold per level of the goblin. |
| **When it starts** | Every other party member takes 5 stress. |
| **Scar** (doubles: 55) | **Sticky Fingers.** The party's gold from every battle they fight in is 5% lighter. |

#### Tinfoil Helm (59–69)

*"The healer is in on it. They're ALL in on it."*

| | |
|---|---|
| **Want** | To owe nobody anything. |
| **Cost** | Turns help down at the exact moment it is needed. |
| **Always** | Willpower ×0.8; mental stress ×1.25; refuses buffs from allies. |
| **Acts out** (30% at 100 stress) | **I Know What You Did.** Accuses an ally read off the dice (6 stress to them), then acts as normal but refuses healing, comfort and items until their next turn. |
| **Meltdown** (96–100) | **Pre-emptive Strike.** Basic attack on an ally read off the dice, for real damage. Refuses all help until their next turn. |
| **When it starts** | Every other party member takes 8 stress. |
| **Scar** (doubles: 66) | **Trust Issues.** The first buff an ally aims at them in each battle is refused and wasted. |

#### Backseat Hero (70–80)

*"Oh, GOOD swing. Really. Have you considered aiming?"*

| | |
|---|---|
| **Want** | To be right, loudly. |
| **Cost** | Wears the party down faster than the monsters do. |
| **Always** | Might ×1.1; Arcana ×1.1; Finesse ×0.85; any ally who misses or fumbles takes 3 stress. |
| **Acts out** (30% at 100 stress) | **Notes.** Gives an ally read off the dice notes on their technique: 8 stress to them. Then acts as normal. |
| **Meltdown** (96–100) | **Fine, I'll Do It Myself.** Shoves everyone aside: every ally takes 6 stress, and the critic makes a basic attack on an enemy read off the dice. |
| **When it starts** | Every other party member takes 8 stress. |
| **Scar** (doubles: 77) | **Running Commentary.** Any ally who fumbles while this character is in the fight takes 3 extra stress. |

#### Doomsayer (81–90)

*"We had a good run. Well. We had a run."*

| | |
|---|---|
| **Want** | To be allowed to give up. |
| **Cost** | Stops trying, and makes stopping sound sensible. |
| **Always** | Finesse ×0.8; Luck ×0.8; stress relief received ×0.5; allies' Virtue chance is 10 lower in all (5 for any Affliction, 5 more for this one). |
| **Acts out** (35% at 100 stress) | **What's the Point.** Does nothing. Sighs. |
| **Meltdown** (96–100) | **Eulogy.** Delivers the party's eulogy, in advance: loses the turn, and every ally takes 8 stress. |
| **When it starts** | Every other party member takes 10 stress. |
| **Scar** (doubles: 88) | **Glass Half Empty.** Stress relief works 20% less well on them, for good. |

#### Lost the Plot (91–100)

*"The moon owes me money."*

| | |
|---|---|
| **Want** | Unknowable. Possibly soup. |
| **Cost** | Nobody, including them, knows what their turn will be. |
| **Always** | Arcana ×0.8; Willpower ×0.8; fumbles on 91 or higher. |
| **Acts out** (40% at 100 stress) | **Improvisation.** Basic attack on a target read off the dice, friend or foe. |
| **Meltdown** (96–100) | **Interpretive Dance.** Uses one of their own skills, read off the dice, on a target read off the dice. Every ally takes 5 stress watching. |
| **When it starts** | Every other party member takes 8 stress. |
| **Scar** (doubles: 99 or 100) | **Loose Screw.** Their own fumble band is one wider: they fumble on 95 or higher, for good. |

Two of these have an upside on purpose. A Backseat Hero hits for 113% of normal damage. A Martyr takes 105% damage but spends about a third of their turns keeping your healer alive. Spooked is the plain bad one: 74% damage.

**The choice.** Carry the Affliction through the fight, or pay to end it: 51 points of relief from 100 stress, 71 from 120, and twice that for a Doomsayer (101 points asked for to move the bar 51). At 15 a cast that is four actions from 100 and five from 120, none of them attacks. Or one item that ends it now and hands you a new roll later.

### 3.6 Virtues

A Virtue is also a personality, and it also has a cost.

- **When it starts** the owner sheds 40 or 50 of their own stress, every other party member sheds 5–12, and its attribute multipliers apply.
- **At the start of each of their turns** they make the turn check: on a roll of 30 or less the Virtue's **flourish** happens, free, and then the player acts.
- **While it lasts** every other party member's Virtue chance is 5 higher, and the owner makes no new Resolve Check even if their bar climbs back over 100.
- **It ends** when the battle ends (one rolled outside battle lasts through the next battle), or in a Breakdown. Calming down does not end it.

#### On a Roll (1–5)

*"Stand back. I've read how this part goes."*

| | |
|---|---|
| **Want** | To do the big brave thing while everyone is watching. |
| **Cost** | Will not Guard and will not catch their breath: it would ruin the moment. |
| **Always** | Might ×1.25; Arcana ×1.25; will not Guard; will not take a Breather. |
| **Flourish** (30%) | **Cue the Music.** This turn's attack gets +20 to its crit chance. |
| **When it starts** | Sheds 40 of their own stress; every other party member sheds 8. |

#### Unflappable (6–10)

*"Hm? Oh, the dragon. Yes, I saw."*

| | |
|---|---|
| **Want** | To be the calm one in the room. |
| **Cost** | Cannot be hurried: slow to act, and the last to move in any round that matters. |
| **Always** | Willpower ×1.25; Finesse ×0.85; all stress taken ×0.5; allies' Virtue chance is 10 higher in all (5 for any Virtue, 5 more for this one). |
| **Flourish** (30%) | **There, There.** Every ally sheds 5 stress. |
| **When it starts** | Sheds 50 of their own stress; every other party member sheds 10. |

#### In the Zone (11–15)

*"Shh. I can see the numbers."*

| | |
|---|---|
| **Want** | To finish the one thing in front of them. |
| **Cost** | Tunnel vision: cannot change targets while the current one is standing. |
| **Always** | +15 to hit, +10 crit, cannot fumble (96–100 is a plain miss); cannot change targets while the current one stands. |
| **Flourish** (30%) | **Dead Centre.** This turn's attack cannot be pushed under a 95% chance to hit. |
| **When it starts** | Sheds 40 of their own stress; every other party member sheds 5. |

#### Mother Hen (16–20)

*"Behind me. All of you. And drink some water."*

| | |
|---|---|
| **Want** | To get everyone home in one piece. |
| **Cost** | Takes the hits for the party, and will not attack while a friend is badly hurt. |
| **Always** | Constitution ×1.25; single-target attacks aimed at the most hurt ally hit them instead; will not attack while any ally is under 25% HP. |
| **Flourish** (30%) | **Fuss.** The most hurt ally heals 10% of their max HP. |
| **When it starts** | Sheds 40 of their own stress; every other party member sheds 12. |

#### Second Wind (21–25)

*"Is that all? I haven't even stretched."*

| | |
|---|---|
| **Want** | To prove they can take it. |
| **Cost** | Insists they are fine: refuses healing from allies. |
| **Always** | Constitution ×1.2; heals 8% of max HP at the start of each of their turns; refuses healing from allies. |
| **Flourish** (30%) | **Walk It Off.** Shakes off every bind on them. |
| **When it starts** | Sheds 40 of their own stress; every other party member sheds 6. Heals 25% of their max HP at once. |

In numbers: On a Roll deals 134% damage. In the Zone hits an even opponent 90% of the time with a 15% crit band. Mother Hen takes 92% damage and Second Wind 94%, and both are standing in front of somebody.

**The choice.** A Virtue is strong and it is not obedient. On a Roll will not Guard on the turn the boss winds up. Mother Hen stops attacking the moment someone is in trouble. In the Zone will finish the minion before it looks at the boss. You get the buff and you lose a little of the wheel.

### 3.7 Permanent marks: Scars and the Silver Lining

A Resolve Check rolled on doubles is permanent. The result itself is still temporary; what stays is its mark, which goes onto the character sheet when the Affliction or Virtue ends.

**Scars.** An Affliction rolled on doubles leaves its Scar: the same personality, smaller, for good.

| Scar | Left by | Rolled on | What it does, for good |
|---|---|---|---|
| **No, No, I'm Fine** | Martyr Complex | 33 | The first heal an ally aims at them in each battle is waved off and wasted. |
| **Flinch** | Spooked | 44 | Takes 25% more stress from horror, for good. |
| **Sticky Fingers** | Loot Goblin | 55 | The party's gold from every battle they fight in is 5% lighter. |
| **Trust Issues** | Tinfoil Helm | 66 | The first buff an ally aims at them in each battle is refused and wasted. |
| **Running Commentary** | Backseat Hero | 77 | Any ally who fumbles while this character is in the fight takes 3 extra stress. |
| **Glass Half Empty** | Doomsayer | 88 | Stress relief works 20% less well on them, for good. |
| **Loose Screw** | Lost the Plot | 99, 100 | Their own fumble band is one wider: they fumble on 95 or higher, for good. |
| **Frayed Nerves** | a personal Affliction with no Scar of its own; Bottling a Breakdown | n/a | Takes 10% more stress from everything, for good. |

- A Scar the character already carries is not gained twice.
- A character carries at most 3 Scars. A fourth pushes one out, and the player picks which (`drop`); with no pick the oldest goes.
- **Talk It Out**, in town, removes one Scar for the price of a major purchase (3.9).

**The Silver Lining.** Every Virtue rolled on doubles (11 or 22 at the base odds) leaves the same mark, and a character holds one at a time. Spend it to erase one Scar, or keep it: it cancels the next Scar they would gain. When it cancels a Scar, both are gone.

**The choice.** A Scar costs a weapon's worth of gold to remove: buy the sword, or get the fighter's nerve back. A Silver Lining can be spent on the Scar you have or kept against the one you fear.

### 3.8 Breakdown

At 200 stress the character has a Breakdown. It ends whatever Affliction or Virtue they were in, it is never a game over, and nobody is hurt or lost for good. The bill is real and the player picks who gets it.

| Choice | Who pays | What happens |
|---|---|---|
| **Storm Off** | The fight | They walk out. They are gone for the rest of the battle (out of battle: they sit out the next one) and come back on 50 stress. |
| **Have It Out** | The party | They say all of it. They stay in the fight on 80 stress. Every other party member takes 20 stress, flat. |
| **Bottle It** | The character | They swallow it. They stay in the fight on 80 stress and take a Scar now: their Affliction's own, or Frayed Nerves if they have no Affliction or already carry that Scar. |

- All three leave the character under 100 with a clear head, so the next time they reach 100 they roll a fresh Resolve Check.
- An Affliction or Virtue that was rolled on doubles still leaves its mark when a Breakdown ends it. Bottling a doubles Affliction costs one Scar, not two.
- A held Silver Lining pays for a Bottle: the Lining and the Scar cancel.
- Bottle It is not offered to a character who already carries both their Affliction's Scar and Frayed Nerves.
- **A second Breakdown in the same battle is not a choice.** They Storm Off.

**The choice.** Lose a body for the rest of the fight, load 20 stress onto each of three people who may be near 100 themselves, or write something permanent on the sheet. Which is cheapest depends on the fight you are in.

### 3.9 Relief

Relief is flat. Willpower does not change it, level does not change it, and an Affliction can (Doomsayer halves it; a Tinfoil Helm in a mood refuses it from allies).

**In battle**

| Way | Stress removed | What it costs |
|---|---|---|
| **Breather** (anyone, any time) | 8, yourself only | Your whole turn. It is deliberately weaker than anything you pay for. |
| A comfort skill or item | about 15, one ally | MP or the item, and the user's turn. Guide value for content. |
| A rally skill | about 5, every ally | MP and the turn. Guide value for content. |
| Landing a critical hit | 3, yourself | Nothing. |
| A snap-out cure (Smelling Salts) | Ends the Affliction now. Stress above 90 drops to 90. | The item and a turn, and a gamble: the next bad moment is a new Resolve Check, with a new bill for the party if it goes badly. |
| A Virtue starting | 40 or 50 for its owner, 5–12 for everyone else | Letting someone reach 100. |

**Between battles**

| Way | Stress removed | What it costs |
|---|---|---|
| Winning a battle | 5 each, 15 each after a boss | Winning. |
| **Camp** | Each character picks one: **Sleep** (restore 50% of max HP and MP) or **Unwind** (30 stress). | One Camp Kit for the party, and the pick itself: the bars or the nerves, not both. |
| **Inn night** | 25, on top of what an inn does for HP and MP | 20 gold × level, per head. |
| **Night Off** (town) | Everything: stress to 0, and any Affliction ends. | 80 gold × level, per head. |
| **Talk It Out** (town) | None. Removes one Scar. | A major purchase: the price of a new weapon. |

| Service | Price rule | L1 | L10 | L25 | L50 | L75 | L100 |
|---|---|---|---|---|---|---|---|
| Camp Kit (whole party, one camp) | 1 fight's gold | 40 | 400 | 1,000 | 2,000 | 3,000 | 4,000 |
| Inn night (per head) | 0.5 fight's gold | 20 | 200 | 500 | 1,000 | 1,500 | 2,000 |
| Night Off (per head) | 2 fights' gold | 80 | 800 | 2,000 | 4,000 | 6,000 | 8,000 |
| Talk It Out (per Scar) | a major purchase | 160 | 2,500 | 10,000 | 32,500 | 67,500 | 115,000 |
| *For scale: gold from one fight* |  | *40* | *400* | *1,000* | *2,000* | *3,000* | *4,000* |

The inn is cheap and does not fix nerves: a night's sleep takes 25 off a bar of 200. Stress is the attrition that follows the party from fight to fight until somebody pays for a Night Off.

**The choice.** At camp, Sleep or Unwind. In town, a Night Off for a party of four costs eight fights' worth of gold. In battle, a Breather is always there and always worse than attacking.

### 3.10 Enemies and stress

Enemies have a stress bar and no Resolve table. Heroes' stress skills fill it, mitigated by the enemy's WIL like any other stress. The two rungs are the statuses `rattled` and `routed` in `data/skills.json`; `enemyStressEvent` applies them.

| Enemy stress | Status | What happens |
|---|---|---|
| reaching 100 | **Rattled** | Until the battle ends its attacks get −10 to hit and it fumbles on 91 or more. Both are band-edge moves on its own attack roll. |
| reaching 200 | **Routed** | A minion or standard enemy runs: it is defeated and pays full rewards. An elite, boss or superboss loses its next action, drops back to 100 stress and stays Rattled. It can be Routed again. |

**The choice.** A stress skill does no damage. Against a crowd it is a second way to empty the field; against a boss it buys lost actions and a wider fumble band at the price of turns you did not spend on its HP.

### 3.11 Body-part binds

Three parts can be bound: head, arms and legs. A bound part does two things for as long as the bind lasts.

| Part | Halves (once, section 1.1) | Seals |
|---|---|---|
| **Head** | Arcana and Willpower | Skills with `part: head`: spells, shouts, songs, bites, breath, and most stress skills |
| **Arms** | Might | Skills with `part: arms`: weapon techniques, shields, throws |
| **Legs** | Finesse | Skills with `part: legs`: kicks, charges, footwork. Running from the battle. Standing in front of an ally (cover). |

- **The basic attack is never sealed.** It is an arms skill, bound arms halve its Might, and it still works. Skills with `part: none`, items, Guard, the Breather and Struggle are never sealed either.
- **Binds never touch Max HP or Max MP.** They change what an attribute does this turn.
- Two binds never quarter anything: each attribute is governed by one part, and a second bind on a bound part refreshes it.

**The chance to bind.** Luck against Luck, the same bounded contest every non-attack check uses, scaled by the target's resistance:

```
Swing  = 60 × (binder LCK − target LCK) ÷ (binder LCK + target LCK)         both effective; no binder (a trap), no swing
Bind % = clamp( (skill chance + Swing + bonus) × (1 − bind resist ÷ 100) × 0.5 ^ earlier binds , 5 , 95 )
```

- **Skill chance** is the `chance` on the skill's bind effect.
- **Bind resist** is the target's `bindResist` for that part, 0–80, a percentage off the chance. Heroes have 0 unless gear says otherwise. Bosses carry it.
- **Earlier binds** is how many contested binds have already landed on that part of that combatant this battle.
- **bonus** is flat points from a passive or an item, if any.
- Multiply everything, round once at the end, a half rounds up, then clamp. The bracket is never less than 0.

Even Luck gives the chance printed on the skill. Double Luck is +20, half is −20, and no amount of Luck gets past 95 or under 5.

| Binder Luck ÷ target Luck | Swing | Base 25 | Base 35 | Base 45 | Base 55 | Base 80 |
|---|---|---|---|---|---|---|
| 0.25 | −36 | 5 | 5 | 9 | 19 | 44 |
| 0.5 | −20 | 5 | 15 | 25 | 35 | 60 |
| 0.67 | −12 | 13 | 23 | 33 | 43 | 68 |
| **1 (even)** | 0 | 25 | 35 | 45 | 55 | 80 |
| 1.5 | +12 | 37 | 47 | 57 | 67 | 92 |
| 2 | +20 | 45 | 55 | 65 | 75 | 95 |
| 4 | +36 | 61 | 71 | 81 | 91 | 95 |

**Reading the roll.** One d100, low is good. For a 55% bind: 1–5 crit, 6–55 takes, 56–95 fails, 96–100 fumble.

1. **Fumble**: 96 or more. Always a failure, even at 95%. **Fumble a bind and you wear it:** the binder's own same part is bound for 1 turn.
2. **Crit**: at or under a tenth of the chance (never less than a roll of 1). The bind lasts one turn longer.
3. **Takes**: at or under the chance.
4. **Fails**: anything else.

**A bind riding on an attack is read off the attack's own roll.** An attack that also binds does not roll again: the bind takes if the attack landed and the attack's d100 is at or under the bind chance. A skill that says a crit all but guarantees the bind passes the higher chance when the attack roll was a crit. Only a pure bind skill rolls a d100 of its own, and only that roll can backfire.

**Accumulating resistance.** Every contested bind that lands halves the chance of the next one on that part of that combatant, for the rest of the battle. A 55% bind goes 55, then 28, then 14, then 7. Only that part wears. Ticking out, being cured and Struggling free do not give the chance back; the end of the battle does. Accidents do not count: a befuddled fumble, a backfire, a skill that binds its own user and an event's bind are applied with no contest and build no resistance.

| Bind resist | Base 45: 1st / 2nd / 3rd / 4th bind | Base 55: 1st / 2nd / 3rd / 4th bind | Base 80: 1st / 2nd / 3rd / 4th bind |
|---|---|---|---|
| 0 | 45 / 23 / 11 / 6 | 55 / 28 / 14 / 7 | 80 / 40 / 20 / 10 |
| 10 | 41 / 20 / 10 / 5 | 50 / 25 / 12 / 6 | 72 / 36 / 18 / 9 |
| 20 | 36 / 18 / 9 / 5 | 44 / 22 / 11 / 6 | 64 / 32 / 16 / 8 |
| 30 | 32 / 16 / 8 / 5 | 39 / 19 / 10 / 5 | 56 / 28 / 14 / 7 |
| 40 | 27 / 14 / 7 / 5 | 33 / 17 / 8 / 5 | 48 / 24 / 12 / 6 |
| 50 | 23 / 11 / 6 / 5 | 28 / 14 / 7 / 5 | 40 / 20 / 10 / 5 |
| 60 | 18 / 9 / 5 / 5 | 22 / 11 / 6 / 5 | 32 / 16 / 8 / 5 |
| 70 | 14 / 7 / 5 / 5 | 17 / 8 / 5 / 5 | 24 / 12 / 6 / 5 |
| 80 | 9 / 5 / 5 / 5 | 11 / 6 / 5 / 5 | 16 / 8 / 5 / 5 |

**Duration.**

- A bind lasts the number of turns on the skill (`turns`, 2 if it does not say), capped at 5.
- Turns are the bound combatant's own. Cross one off every bind at the end of each of its turns. A bind it picked up **during** its own turn (a befuddled fumble, a backfire) is not crossed off at the end of that turn, so a 1-turn self-bind still costs the next turn.
- **Refresh, never stack.** A new bind on a bound part sets it to the longer of the two durations. Refreshing early wastes the turns left and still spends a step of resistance.

**Trussed.** Head, arms and legs all bound at once. A Trussed target can use only its basic attack, part-less skills and items, and every hit on it is ×1.5 damage (`trussedDamageMult`). It lasts until the first of the three binds runs out.

**Cures.**

| Cure | What it does | What it costs |
|---|---|---|
| Time | Each bind runs out on its own. | The turns. |
| A cure skill or item (`cureBinds`) | Removes every bind, or the parts it names. | MP or the item, and a turn. |
| **Struggle** (any hero, any time) | Frees one part of your choice. No roll. | Your whole turn. Bosses never Struggle; other enemies only if their data says so. |
| Second Wind's flourish | Shakes off every bind. | Nothing: it is part of the Virtue. |
| The battle ending | Every bind comes off and the resistance is forgotten. | |

**What each bind is worth.** Even attributes on both sides, average per action with misses and crits counted (`expectedDamage`).

| Bound | Their offence | Your offence against them | And |
|---|---|---|---|
| **Arms** | Physical damage ×0.375: 37.5% per action | unchanged | Weapon skills sealed. |
| **Head** | Spell damage ×0.375: 37.5%. Healing 50%. | Your spells do 120%. Stress on them lands a third heavier: 30 base at WIL 600 goes from 15 to 20. | Spells, shouts and most stress skills sealed. |
| **Legs** | To hit 75 → 67: 89.7% per action | You hit at 83: 110.3% per action | Acts after anyone with more than 60% of its Finesse. Cannot run, cannot cover. |
| **Trussed** | 33.6% with the basic attack, which is all it has | 165.5% with a blade, 198.6% with a spell | For as long as all three hold. |

**Worked example.** A level 50 Rogue (LCK 384) uses a 45% arms bind on an elite with LCK 240 and 30 arms resist. Swing 60 × (384 − 240) ÷ (384 + 240) = +13.8, so 45 becomes 58.8; × 0.7 for the resist is **41%**. The roll is 31: it takes, with no crit (that needed 4 or less), for 2 of the elite's turns. Its Might drops from 330 to 165, its arms skills are sealed and its basic attack does 40% of what it did. The next arms bind on it this battle is 21%.

At level 40, with LCK 325 against a benchmark 242, Valerie's Accidental Trip (55% on the card) is 64% on an unresisting enemy and 32% on a boss with 50 legs resist.

**The choice.** The first bind on each part is the cheap one, and there are only three firsts. Spend a 55% arms bind now and the big swing three rounds from now meets a 28% chance instead of a 55% one. Each part asks its own question:

- **Arms** is the largest single cut to incoming damage in the game, and it does nothing to a caster.
- **Head** silences a caster and softens it for your own Mage. On your side of the field a bound head is a stress problem: Willpower is halved.
- **Legs** prevents almost nothing. You are buying accuracy and the first move for everyone else.
- **Trussing** spends all three cheap chances at once for one burst window, instead of holding each as an answer.

### 3.12 At the table: quick reference

Everything above, as steps a game master can run by hand. If the game master can run code, call the functions in 3.13 and use this to explain the result.

**A. A stress hit.**
1. From the world: take the base on the move, or the tier from 3.3 at the party's level. Reduce it by the target's WIL with the table in section 1.8. From the party: use the number as written.
2. Apply any ×: Spooked and horror, Tinfoil Helm and mental, Martyr and wound, Unflappable and everything, a Scar.
3. Add it to the bar, 0–200.
4. Reached 200: Breakdown (D). Otherwise reached 100 from below with no Affliction or Virtue: Resolve Check (B).

**B. The Resolve Check.**
1. Shift: +5 per ally in a Virtue, −5 per Afflicted ally, +10 for Unflappable and −10 for Doomsayer instead, +5 or +10 if Valerie is Ditzy or a Total Airhead and it is not her check. No more than ±15.
2. Roll d100 and find it in that shift's column of the table in 3.4.
3. Even roll and the character has their own entry for that side: use theirs.
4. Doubles: note "permanent". It leaves a Scar (Affliction) or a Silver Lining (Virtue) when it ends.
5. Affliction: apply its attribute changes; every other party member takes its stress. Virtue: its owner sheds 40 or 50; every other party member sheds its number.

**C. The turn check** (start of an afflicted or virtuous character's turn).
1. Affliction: chance = base (30, 35 or 40) + 5 per full 20 stress over 100. Roll d100: up to 100 − chance composed, above that it acts out, 96–100 meltdown.
2. Virtue: roll d100, 30 or less is the flourish.
3. "Read off the dice" means roll modulo the number of candidates, counting from the top of the list.

**D. Breakdown** at 200. The player picks: Storm Off (gone for the battle, back on 50), Have It Out (stays on 80, every ally +20), Bottle It (stays on 80, takes a Scar). Second one in the same battle: Storm Off.

**E. Ending things.** Affliction: under 50 stress, a Night Off, Smelling Salts (stress to 90), a Breakdown. Virtue: the end of the battle, a Breakdown. Doubles: write the mark on the sheet now. At most 3 Scars and 1 Silver Lining.

**F. A bind.**
1. Start from the chance on the skill. Add the Luck swing: +20 at double the target's Luck, +12 at one and a half, 0 when even, −12 at two thirds, −20 at half.
2. Take off the target's bind resist as a percentage. Halve once for every bind that has already landed on that part this battle. Keep it within 5–95.
3. Roll d100 (or read the attack's roll if the bind rides on an attack). 96+ fails, and a pure bind skill backfires on the binder for 1 turn. A tenth of the chance or less: one extra turn. At or under the chance: bound.
4. Bound: halve the part's attributes, seal its skills (never the basic attack), cross off one turn at the end of each of the target's own turns. All three parts: ×1.5 damage taken.

### 3.13 Where it lives in the engine

| Rule | Function |
|---|---|
| A stress hit, with WIL, state multipliers, clamp and events | `applyStress(combatant, base, { source, ignoreWill, mult })` |
| An amount already mitigated (the hero's filter) | `addStress(combatant, amount)` |
| Base stress for a tier or a standard source | `stressBase(tier, level)`, `stressFor(id, level)` |
| The Resolve Check | `resolveCheck(combatant, rng, { tables, virtueShift, personal })` |
| Reading a roll someone else made; the band layout | `readResolveRoll(roll, opts)`, `resolveBands(tables, shift)` |
| The party's shift | `partyResolveShift(allies, extra)` |
| A scripted or event result | `forceResolve(combatant, 'affliction' or 'virtue', { tables, id, rng })` |
| The turn check | `actOutCheck(combatant, rng)`, `actOutChance(combatant)`, `pickByRoll(roll, list)` |
| What a state will not do, whom it shields, its band-edge moves | `refuses(combatant, what, ctx)`, `covers(combatant)`, `withStateOpts(combatant, opts)` |
| Relief, the Breather, camp and town | `relieveStress(combatant, amount, { from })`, `breather(combatant)`, `rest(combatant, kind)` |
| Ending a state; the snap-out cure | `clearResolve(combatant)`, `snapOut(combatant)` |
| Marks | `gainMark`, `removeMark`, `spendSilverLining`, `marksOf`, `consumeFirstRefusal` |
| Breakdown | `breakdownChoices(combatant)`, `breakdown(combatant, { choice })` |
| End of battle | `endBattle(combatant, { won, boss })`, `endBattleBinds(combatant)` |
| Enemy stress | `enemyStressEvent(enemy, event)` |
| Bind chance and attempt | `bindChance`, `bindOdds`, `tryBind(attacker, target, part, chance, turns, rng, opts)` |
| A bind with no contest; ticking; cures | `applyBind(combatant, part, turns, { ownTurn })`, `tickBinds`, `cureBinds`, `struggle` |
| Seals and Trussed | `isSealed(combatant, skill)`, `usableSkills`, `canFlee`, `isTrussed`, `trussedDamageMult` |
