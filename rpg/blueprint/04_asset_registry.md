## 4. MASTER ASSET REGISTRY (SPELLS, PASSIVES, ITEMS)

This section lists everything a party member can learn or buy: 54 class skills, 22 passives, 27 statuses, 42 shop items and 10 gear tiers. The data is `data/skills.json`, `data/passives.json` and `data/items.json`. `test/content.test.js` pins the rules on this page. Every table below was printed from that data, and every damage, healing, stress and bind figure was produced by running it through `engine/combat.js`, `engine/progression.js` and `engine/binds.js`.

The hero's own class, the Klutz Knight, is in section 6. Boss and enemy moves are in section 5.

One rule shaped the whole registry. Costs are flat, so a skill learned at level 1 costs 1 MP forever, and by level 10 that is less than half a percent of anyone's bar. MP is therefore only the price of a *new* skill. Every skill needs a second price that never wears off: a missed turn, a body part, stress, or exposure. Read each entry for that second price.

### 4.1 How to read a skill entry

```json
{
  "id": "war_cleave", "name": "Cleave", "archetype": "warrior", "unlock": 5, "tier": 1,
  "type": "physical", "stat": "STR", "power": 3, "acc": 0, "crit": 0,
  "element": "phys", "target": "row", "part": "arms",
  "cost": { "mp": 12, "limit": 0 }, "mpShare": 0.07,
  "tags": ["melee"],
  "effects": [{ "kind": "bind", "part": "legs", "chance": 40, "turns": 2 }],
  "text": "A wide, low swing through one row. 40% base chance to bind each target's legs for 2 turns."
}
```

| Field | Meaning |
| --- | --- |
| `unlock`, `tier` | The level the skill is learned at. Tier is its ten-level bracket: tier 1 is levels 1–10, tier 10 is levels 91–100. |
| `type` | `physical` and `magical` deal damage. `heal` restores HP. `buff`, `debuff`, `stress` and `utility` deal none. |
| `stat`, `power` | The attribute the skill attacks or heals with, and its Power. Each point of Power is 5% of the bar of a peer whose defense equals that attribute (section 1.3). A physical skill is defended by Constitution whatever it attacks with; a magical one by Willpower. |
| `acc`, `crit` | Added to the chance to hit and the chance to crit. Accuracy runs −20 to +20, crit 0 to +20. |
| `element` | `phys`, `fire`, `ice`, `bolt`, `holy` or `dark`. The target's affinity multiplies the damage. |
| `target` | `one`, `row` or `all` aim at enemies and roll one d100 for each enemy. `self`, `ally` and `allies` aim at the party and do not roll. |
| `part` | `head`, `arms`, `legs` or `none`. While that part is bound the skill is sealed. `none` can never be sealed. |
| `cost` | Flat MP, or Limit for an ultimate. It never changes after the skill is learned. |
| `mpShare` | The share of `mpBudget(unlock)` the MP cost was worked out from. |
| `tags` | `melee`, `ranged`, `projectile`: how the attack travels. `mental`, `embarrassment`: the stress source it carries. `ultimate`: spends Limit. `field`: can also be used outside battle. `scripted`: the text holds a rule the `effects` list cannot express. |
| `effects` | What else happens. See the table below. |
| `text` | The exact rule in one line, as the player and the game master read it. |

**The cost rule.**

```
cost.mp = mpShare × mpBudget(unlock level), rounded to two significant figures, never less than 1
```

`mpBudget(level)` is the MP bar of a character with benchmark Willpower: 640 at level 10, 15,100 at level 50, 60,000 at level 100. The three bars are different sizes (the warrior holds half the budget, the rogue two thirds, the mage four thirds), so each archetype has its own share ladder. The ladders are set so that the same weight of skill empties anyone's bar at about the same pace, with the mage ahead by a third because casting is all the mage does.

| Weight | Warrior share | Rogue share | Mage share | Casts from a full bar when it unlocks (W / R / M, at level 50) |
| --- | ---: | ---: | ---: | ---: |
| light | 3% | 4% | 6% | 17 / 16 / 22 |
| standard | 5% | 6% | 10% | 10 / 11 / 13 |
| heavy | 7% | 9% | 14% | 6 / 7 / 9 |
| signature | 10% | 13% | 20% | 5 / 5 / 6 |

Light is a stance, a setup or a small utility. Standard is a bread-and-butter attack or tool. Heavy is an area attack, a big hit or a strong tool. Signature is the show-stopper of its tier. Every cost can be paid at least four times from a full bar at the level the skill unlocks. Ultimates cost no MP: each archetype has one at 50 or 60 Limit and one that takes the whole gauge of 100.

**Effects.**

| `kind` | Fields | What it does |
| --- | --- | --- |
| `bind` | `part`, `chance`, `turns` | Tries to bind that part. `chance` is the base chance. `engine/binds.js` adds a Luck contest, takes off the target's bind resistance, and halves the chance for every earlier bind on that part this battle. A bind riding on an attack is read off the attack's own d100. |
| `stress` | `amount`, `source`, optional `ignoreWill` | Positive adds stress, reduced by the target's Willpower unless `ignoreWill` is set. Negative is relief and is never reduced. `source` is one of general, horror, mental, realization, embarrassment, wound, death. |
| `mod` | `stat`, `mult`, `turns` | Multiplies one attribute for that many turns. All the multipliers on one attribute combine and are held to ×0.5–×1.5. |
| `status` | `id`, `turns` | Applies a status from the registry in 4.6. |
| `dot` | `power`, `turns`, `element` | Damage over time. At the start of each of the target's next turns it takes a hit of that Power and element from the caster: no roll, no crit, no variance, affinity applies. |
| `cleanse` | `what`: `binds`, `mods` or `statuses` | On an ally: removes binds, debuffs or harmful statuses. On an enemy: removes its buffs or helpful statuses. |
| `heal` | `pct`, optional `cap`, optional `bar: "mp"` | Items only. Restores that share of the max bar, up to the ceiling. A negative share drains. |
| `revive` | `pct` | Brings a downed ally back at that share of max HP. |
| `limit` | `amount` | Adds to the Limit gauge. |

**How an action resolves.**

1. Pay the cost. A skill whose part is bound cannot be chosen.
2. An effect marked `"target": "self"` is the price or the stance. It lands on the user once per use, hit or miss, unless it also says `"onHit": true`. A self-bind is applied with no roll (`applyBind`), which is why its `chance` reads 100.
3. A skill aimed at enemies rolls one d100 for each enemy, with `acc` and `crit`. On a miss or a fumble nothing else in the skill touches that enemy.
4. On a hit or a crit the enemy takes the damage, then every unmarked effect. Skills with Power 0 (`debuff`, `stress`) still roll to hit; they simply deal no damage.
5. A skill aimed at the party does not roll. Healing is `healAmount` for each target, then every unmarked effect lands on each target.
6. Durations count the bearer's own turns and tick at the end of each, as binds do. Something a character puts on itself during its own turn starts counting on its next turn. Guard is the one exception: its entry in 4.6 says when it ends.

The attribute names in rules text are the ones the player sees: Might (STR), Arcana (INT), Finesse (AGI), Constitution (CON), Willpower (WIL), Luck (LCK).

**Scripted skills.** 8 skills carry the `scripted` tag. Their text states a rule that needs code of its own: Grudge Match, Closing Time, Group Project, Dissertation, Clean Getaway, Borrowed Time, Punchline, The Big Score.

### 4.2 Warrior: 16 skills and 2 ultimates

- **Want:** To be the one still standing between the party and whatever is charging at it.
- **Cost:** A head built for helmets, not hexes: spells and nerves get through where swords cannot.

**How the tree says it.** The want is the row of tools for putting yourself between an enemy and an ally: Provoke one enemy with Shield Bash, cover one ally with Not On My Watch, Taunt everything with Oi! Over Here!, Guard the whole party with Shield Wall, and at 60 Limit take every hit in the room with The Door Holds. The cost is that almost all of it is paid in stress, on the lowest Willpower in the party. Taunting costs 6 stress, Walk It Off costs 5, Bring It On costs 15, and Bulwark pulls every stress rider aimed at the party onto the warrior. The two ways out both cut: Stiff Upper Lip buries 20 stress and binds the warrior's own head, and Grudge Match turns stress into Power, which rewards never calming down.

A bind is a real problem and never a shutdown. Skills by part: head 3, arms 8, legs 4, none 3. Bound arms seal every weapon skill and leave the taunt, the cover and the wall. Bound legs seal the cover and both guard skills and leave the weapons. Bound head seals the shouts. Walk It Off, Shrug It Off and Stiff Upper Lip need no part at all.

| Lv | Skill | Tier | Cost | Weight | Power | Target | Part | Element | What it does |
| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1 | **Shield Bash** | 1 | 1 MP | standard | 3 (STR) | one enemy | arms | phys | A faceful of shield. Damage to one enemy, and it is Provoked for 2 turns: its single-target attacks must be aimed at you. |
| 1 | **Not On My Watch** | 1 | 1 MP | light | n/a | one ally | legs | n/a | You step in front of one ally. For 2 turns, single-target attacks aimed at them hit you instead. Area attacks still reach them, and you cannot cover yourself. |
| 5 | **Cleave** | 1 | 12 MP | heavy | 3 (STR) | one row | arms | phys | A wide, low swing through one row. 40% base chance to bind each target's legs for 2 turns. |
| 9 | **Oi! Over Here!** | 1 | 26 MP | standard | n/a | self | head | n/a | You make yourself everyone's problem. Taunt for 3 turns: enemies must aim their attacks at you. Holding that much attention costs you 6 stress. |
| 14 | **Shield Wall** | 2 | 85 MP | heavy | n/a | all allies | legs | n/a | Everyone behind the shield. Every ally, you included, gains Guard (damage ×0.5) until the start of your next turn and can still act. You brace so hard that your legs are bound for 1 turn, so the wall cannot go up two turns running. |
| 19 | **Can Opener** | 2 | 110 MP | standard | 4 (STR) | one enemy | arms | phys | You go looking for the seam in the armor. Damage to one enemy; it loses Guard this round and has Constitution ×0.7 for 3 turns. |
| 24 | **Come At Me** | 3 | 180 MP | standard | n/a | self | arms | n/a | A stance and an invitation. For 2 turns, every melee attack rolled against you, hit or miss, is answered with a free basic attack. Guarding ends the stance. |
| 30 | **Walk It Off** | 3 | 380 MP | heavy | heal 6 (CON) | self | none | n/a | You decide it is not that bad. Restores about 30% of your max HP (Power 6 on your own Constitution). Pretending costs you 5 stress. |
| 36 | **Shrug It Off** | 4 | 240 MP | light | n/a | self | none | n/a | Ropes, webs, hexes: you flex until something gives. Removes every bind on you, and your Willpower is ×1.3 for 3 turns. |
| 46 | **Overhead Regret** | 5 | 900 MP | heavy | 9 (STR) | one enemy | arms | phys | Everything you have, straight down: heavy damage to one enemy at −15 to hit. Hit or miss, the sword sticks in the floor and your arms are bound for 1 turn. |
| 52 | **Rattle the Line** | 6 | 820 MP | standard | n/a | one row | head | n/a | A parade-ground roar at one row, rolled at +5 to hit. Each enemy it lands on has Might ×0.75 for 3 turns and takes 14 stress. No damage. |
| 60 | **Stiff Upper Lip** | 6 | 650 MP | light | n/a | self | none | n/a | You simply stop thinking about it. You shed 20 stress, and your head is bound for 2 turns: Arcana and Willpower halved, head skills sealed. |
| 68 | **Table Flip** | 7 | 2,800 MP | signature | 6 (STR) | one row | arms | phys | The nearest heavy object goes through one row at −10 to hit. Every enemy it hits loses Guard this round. |
| 76 | **Grudge Match** | 8 | 2,400 MP | heavy | 6 (STR) | one enemy | arms | phys | You have been keeping count. Power 6, plus 1 for every 20 stress you are carrying, up to Power 11 at 100 stress. |
| 84 | **Castle Doctrine** | 9 | 4,200 MP | signature | n/a | self | legs | n/a | You become furniture. Fortified for 3 turns: you take half damage and can still act. Your legs are bound for 4 turns, one longer than the protection lasts: Finesse halved, leg skills sealed. |
| 92 | **Bring It On** | 10 | 1,500 MP | light | n/a | self | head | n/a | You dare the whole room. Gain 30 Limit and take 15 stress. |

| Lv | Ultimate | Tier | Cost | Power | Target | Part | Element | What it does |
| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- |
| 40 | **The Door Holds** | 4 | 60 Limit | n/a | self | legs | n/a | Ultimate. Bulwark for 2 turns: every attack aimed at an ally hits you instead, an area attack hits you once, and you take half damage. The stress and binds riding on those attacks land on you too. |
| 100 | **Closing Time** | 10 | 100 Limit | 22 (STR) | one enemy | arms | phys | Ultimate. One swing to end the evening: Power 22 at +20 to hit, and the target loses Guard first. Add 2 Power for each ally who is down, up to Power 28. |

Worth knowing:

- **Shield Bash chooses who you tank, not who you kill.** The enemy you hit is the enemy that must hit you.
- **Legs are the defense and arms are the offense, and your best skills bind your own.** Shield Wall binds your legs for a turn, so it works every other turn at best. Castle Doctrine binds them for four. Overhead Regret binds your arms. Decide the turn after before you spend the turn.
- **Stress is the bar that ends a warrior.** A Breather takes 10 off and costs the turn. The mage's Office Hours takes 15 off and costs the mage. Plan for one of them.

### 4.3 Mage: 16 skills and 2 ultimates

- **Want:** To understand the thing, name the thing and set the thing on fire, in that order.
- **Cost:** Everything below the neck is on loan: one good shove and the lecture is over.

**How the tree says it.** The want is in the order of operations. Understand: the level 1 passive Marginalia reveals an affinity the first time each element lands, and pays Limit for it. Name: Cold Feet, Closed Book and Peer Review bind, silence and strip. Set on fire: five elements, two attack spells each, every one a different shape. Fire burns over time. Ice pins legs and slows. Bolt gambles on crits. Dark attacks the stress bar. Holy heals, revives and strikes out buffs. The cost is the body. The big spells leave the caster standing still or worn down: Burnout cuts the mage's own Arcana, Absolute Zero Tolerance binds the mage's own legs, Thesis Statement gives every attacker +10 to hit, the All-Nighter ends with a bound head. The healing line has the same shape: Group Project heals everyone except the caster.

Skills by part: head 8, arms 6, legs 2, none 2. A head bind is the worst thing that can happen to a mage: it seals the head skills and halves Arcana for everything else. The thrown and gestured spells (fire, single-target bolt, Peer Review, the party heal and the revive) are arms skills for exactly that turn. Office Hours and the All-Nighter need no part.

| Lv | Skill | Tier | Cost | Weight | Power | Target | Part | Element | What it does |
| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1 | **Hot Take** | 1 | 1 MP | standard | 3 (INT) | one enemy | arms | fire | A scorching opinion, thrown overhand at +5 to hit. Fire damage to one enemy, which then burns for Power 1 at the start of each of its next 2 turns. |
| 1 | **Light Reading** | 1 | 1 MP | standard | heal 4 (INT) | one ally | head | holy | A short, kind passage read aloud. Restores HP to one ally: Power 4 on your Arcana, about 20% of the bar of an ally whose Constitution matches it. |
| 4 | **Cold Feet** | 1 | 11 MP | standard | 3 (INT) | one enemy | legs | ice | You stamp, and frost runs along the floor at +5 to hit. Ice damage to one enemy; 45% base chance to bind its legs for 2 turns. |
| 8 | **Pop Quiz** | 1 | 42 MP | standard | 4.5 (INT) | one enemy | arms | bolt | Lightning, with no warning and no revision time. Bolt damage to one enemy at −10 to hit and +20 to crit. |
| 13 | **Strongly Worded Letter** | 2 | 110 MP | standard | 3 (INT) | one enemy | head | dark | Composed in your head, delivered directly to theirs at +5 to hit. Dark damage to one enemy, and it takes 12 stress. |
| 18 | **Office Hours** | 2 | 120 MP | light | n/a | one ally | none | n/a | You listen, properly. One other ally sheds 15 stress. You take 5 stress that Willpower cannot reduce: their worries have to go somewhere. |
| 23 | **Thesis Statement** | 3 | 190 MP | light | n/a | self | head | n/a | You stop and state exactly what is about to happen. Focused for 2 turns: your next damaging skill deals ×1.5 damage. Until then, attacks against you get +10 to hit. |
| 28 | **Group Project** | 3 | 670 MP | heavy | heal 4 (INT) | all allies | arms | holy | You hand out the work, then do all of it yourself. Restores HP to every ally except you: Power 4 on your Arcana. |
| 34 | **Burnout** | 4 | 990 MP | heavy | 5 (INT) | one row | arms | fire | Everything on the desk goes up at once. Fire damage to one row, and each enemy hit burns for Power 1 at the start of each of its next 2 turns. Then you are spent: your Arcana is ×0.8 for 2 turns. |
| 39 | **Peer Review** | 4 | 1,300 MP | heavy | 6 (INT) | one enemy | arms | holy | Harsh, fair light and a red pen. Holy damage to one enemy at +10 to hit, and every buff on it is struck out. |
| 50 | **Closed Book** | 5 | 1,500 MP | standard | n/a | one enemy | head | n/a | You name the thing, and it forgets how it works. 50% base chance to bind one enemy's head for 2 turns: Arcana and Willpower halved, head skills sealed. No damage. |
| 58 | **Second Edition** | 6 | 4,100 MP | signature | n/a | one ally | arms | holy | Revised, corrected and back in print. Revives a downed ally at 30% of max HP. Looking that closely at the first edition costs you 8 stress. |
| 66 | **Brainstorm** | 7 | 3,700 MP | heavy | 4 (INT) | all enemies | head | bolt | Every idea you have had today, as weather. Bolt damage to every enemy at −5 to hit and +10 to crit. Each enemy is rolled separately. |
| 74 | **Recommended Reading** | 8 | 4,600 MP | heavy | heal 9 (INT) | one ally | head | holy | A long, soothing chapter the patient cannot put down. Restores a lot of HP to one ally (Power 9 on your Arcana) and removes their binds. They sit out their next turn, reading. |
| 82 | **Absolute Zero Tolerance** | 9 | 8,100 MP | signature | 9 (INT) | one enemy | legs | ice | You plant both feet and take all the warmth out of one enemy: heavy ice damage at −5 to hit, and its Finesse is ×0.7 for 3 turns. You freeze to the spot too: your legs are bound for 2 turns. |
| 92 | **Publish or Perish** | 10 | 10,000 MP | signature | 7 (INT) | all enemies | head | dark | You release the unreviewed draft. Heavy dark damage to every enemy. You take 15 stress that Willpower cannot reduce. |

| Lv | Ultimate | Tier | Cost | Power | Target | Part | Element | What it does |
| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- |
| 44 | **All-Nighter** | 5 | 60 Limit | n/a | self | none | n/a | Ultimate. For 3 turns your skills cost no MP and your Arcana is ×1.2. When it ends you crash: your head is bound for 2 turns. |
| 100 | **Dissertation** | 10 | 100 Limit | 24 (INT) | one enemy | head | fire | Ultimate. Four hundred pages on why the target should be on fire: Power 24 at +20 to hit, dealt as fire, ice, bolt, holy or dark, whichever the target is weakest to. |

Worth knowing:

- **Old spells are free and new spells are not.** At level 50 Hot Take costs 1 MP out of 20,200 and Peer Review costs 1,300. The choice each turn is tempo against the bar.
- **Thesis Statement trades a turn for half a spell.** Two casts beat one cast at ×1.5. It pays when the second cast would cost real MP, when a weakness or a crit will multiply it again, or when the target is about to Guard.
- **The healer chooses how the patient pays.** Light Reading is small and free of strings. Recommended Reading is big, removes binds, and costs the patient their next turn. Second Edition costs the caster 8 stress every time.
- **Dark spells cost nerve.** Publish or Perish is the only skill in the registry that hits every enemy for Power 7, and it charges 15 stress that Willpower cannot reduce.

### 4.4 Rogue: 16 skills and 2 ultimates

- **Want:** To get in, get the prize and get out before anyone finishes saying "hey".
- **Cost:** No armour and no backup plan: the one hit that does connect is the one that counts.

**How the tree says it.** Get in: Head Start, Borrowed Time and Clean Getaway buy speed and extra actions now. Get the prize: binds on all three parts, a Mark that gives the whole party +15 to crit, Five-Finger Discount for the target's buffs and 12 Limit, and three payoffs (Stab in the Back, All In, The Big Score) that turn setup into one large number. Get out: Exit, Stage Left. The cost is that every one of those is paid for by standing in the open. Head Start and both big hits leave the rogue Exposed, so every hit on it deals ×1.25. Borrowed Time is repaid with a turn spent Sitting Out. Roast ends with the rogue holding a Taunt. Hiding sends the hits to the rogue's friends. The tree has no heal, no Guard and no way to remove a bind.

The rogue's skills attack with Finesse or Luck, not Might, and its basic attack is the lightest in the party. Out of MP, or with its arms bound, it has no second plan. Bound legs are worse: they halve Finesse, which is the rogue's accuracy, evasion, turn order and damage together. Skills by part: head 3, arms 9, legs 5, none 1. All In uses no part, so it is always available, at −20 to hit.

| Lv | Skill | Tier | Cost | Weight | Power | Target | Part | Element | What it does |
| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1 | **Cheap Shot** | 1 | 1 MP | standard | 3 (AGI) | one enemy | arms | phys | A knife where they were not looking. Damage to one enemy from your Finesse, at +15 to crit. |
| 1 | **Ankle Tap** | 1 | 1 MP | standard | 2 (STR) | one enemy | legs | phys | A neat kick behind the knee at +5 to hit. Light damage from your Might; 45% base chance to bind the target's legs for 2 turns. |
| 4 | **Heckle** | 1 | 5 MP | light | n/a | one enemy | head | n/a | You say the one thing they hoped nobody had noticed. Rolled at +10 to hit: one enemy takes 12 stress. No damage. |
| 8 | **Head Start** | 1 | 25 MP | standard | n/a | self | legs | n/a | You drop everything that slows you down. Finesse ×1.25 for 3 turns. For the same 3 turns you are Exposed: every hit on you deals ×1.25 damage. |
| 12 | **Kick Me Sign** | 2 | 36 MP | light | n/a | one enemy | arms | n/a | Stuck to their back before they turn round, rolled at +10 to hit. The target is Marked for 3 turns: every attack on it gets +15 to crit. It also takes 6 stress. No damage. |
| 17 | **Butterfingers** | 2 | 110 MP | standard | 3 (AGI) | one enemy | arms | phys | A rap across the knuckles at the worst moment. Damage to one enemy from your Finesse; 45% base chance to bind its arms for 2 turns. |
| 22 | **Exit, Stage Left** | 3 | 180 MP | standard | n/a | self | legs | n/a | You are simply not there any more. Hidden for 2 turns: enemies cannot single you out while another ally stands, and your next attack gets +20 to crit. Attacking ends it. While you hide, the hits land on your friends. |
| 28 | **Trouser Malfunction** | 3 | 430 MP | heavy | n/a | one enemy | arms | n/a | One tug on one belt, rolled at +5 to hit. The target takes 15 stress; 40% base chance to bind its legs for 2 turns. No damage, except to its dignity. |
| 40 | **Put a Sock in It** | 4 | 580 MP | standard | 3 (AGI) | one enemy | arms | phys | A sock, applied to the mouth mid-sentence. Damage to one enemy from your Finesse; 45% base chance to bind its head for 2 turns. |
| 46 | **Borrowed Time** | 5 | 1,200 MP | heavy | n/a | self | legs | n/a | You take your next turn now. Act again immediately; in exchange you sit out your next turn, and you cannot Guard while you do. |
| 52 | **Stab in the Back** | 6 | 1,500 MP | heavy | 7 (AGI) | one enemy | arms | phys | The classic. Heavy damage to one enemy from your Finesse at −5 to hit and +10 to crit. You end up standing right beside it: Exposed for 1 turn, so every hit on you deals ×1.25. |
| 59 | **Five-Finger Discount** | 6 | 1,300 MP | standard | 3 (AGI) | one enemy | arms | phys | You bump into them and leave with more than you arrived with. Damage to one enemy from your Finesse at +5 to hit. On a hit its buffs are removed and you gain 12 Limit. |
| 66 | **Roast** | 7 | 3,400 MP | signature | n/a | all enemies | head | n/a | Five minutes of material on everyone in the room, rolled at +5 to hit against each enemy: 20 stress to every one it lands on. Then they are all looking at you: you have Taunt until your next turn. |
| 73 | **All In** | 8 | 4,200 MP | signature | 10 (LCK) | one enemy | none | phys | No plan, one throw. Huge damage to one enemy from your Luck at −20 to hit and +20 to crit. Win or lose you are Exposed for 2 turns. It uses no body part, so no bind can seal it. |
| 80 | **Gift Wrap** | 8 | 3,500 MP | heavy | 4 (AGI) | one enemy | arms | phys | Rope, ribbon and a bow. Damage to one enemy from your Finesse, and a 35% base chance to bind its head, its arms and its legs for 2 turns, each part checked against the same roll. |
| 90 | **Punchline** | 9 | 4,400 MP | heavy | 5 (AGI) | one enemy | head | phys | The joke lands, then you do. Power 5 from your Finesse, plus 1 for every 20 stress the target is carrying, up to Power 11 at 120 stress. |

| Lv | Ultimate | Tier | Cost | Power | Target | Part | Element | What it does |
| ---: | --- | ---: | ---: | --- | --- | --- | --- | --- |
| 35 | **Clean Getaway** | 4 | 50 Limit | n/a | self | legs | n/a | Ultimate. You take two more actions right now, then vanish: Hidden for 2 turns. |
| 98 | **The Big Score** | 10 | 100 Limit | 20 (LCK) | one enemy | arms | phys | Ultimate. The whole plan, in one move: Power 20 from your Luck at +10 to hit and +20 to crit. If the target has any bound part, a hit is an automatic crit. |

Worth knowing:

- **Set up, then cash in.** Kick Me Sign is +15 crit for everyone for three turns. Hidden is +20 on your next attack. Stab in the Back adds +10 and All In adds +20. Crit is capped at 50.
- **Binds wear out.** Each bind that lands halves the next chance on that part of that enemy, so spread them across head, arms and legs. Three parts bound at once is Trussed: every hit on the target deals ×1.5 (`engine/binds.js`). Gift Wrap checks all three parts against one roll, so it tends to land all or nothing.
- **Stress is a second way to win.** Heckle, Kick Me Sign, Trouser Malfunction and Roast fill an enemy's stress bar. At 100 it is Rattled, at 200 it is Routed (4.6), and Punchline gains a point of Power for every 20 stress it carries.

### 4.5 Passives

A **class passive** is always on from its unlock level. Each one cuts both ways: the column on the right is what it costs. Each class's level 1 passive is also its Limit engine, the only automatic source of Limit that class has.

A **general passive** is chosen. A character has one general slot, and a second from level 50, and may change what is in them at any rest. The hero can use them too.

#### Warrior

| Lv | Passive | Rule | The choice |
| ---: | --- | --- | --- |
| 1 | **Doorstop** | Each time you are hit by an attack that was aimed at an ally, or that Provoked, Taunt, Covered or Bulwark pulled onto you, gain 8 Limit. At most twice per round. | Hits aimed at you from the start earn nothing. Your gauge only fills while you are doing the most dangerous thing available. |
| 12 | **Stubborn** | Binds on your arms and legs last 1 turn less, to a minimum of 1. Binds on your head last 1 turn longer. | Your body shrugs off what your head cannot. Every head bind is a longer stretch at half Willpower with your shouts sealed. |
| 26 | **Bodyguard's Reflex** | Once per round, when a single-target attack is aimed at an ally below 30% HP, you take it instead as if they were Covered. Your legs must be free. You cannot decline. | It is a reflex, not a decision. It fires when you are the one who cannot afford the hit, and it goes to the first ally in trouble, not the one you would have picked. |
| 42 | **Seeing Red** | For every 25 stress you carry, your Might is ×1.05 higher and your Willpower ×0.95 lower, up to Might ×1.2 and Willpower ×0.8 at 100 stress. | Stress you keep is damage you deal and magic you eat. Calming the warrior down also turns the warrior down. |
| 60 | **Share the Shield** | When you use the Guard action, the ally with the lowest share of HP also gains Guard until the start of your next turn. Your own Guard that turn is ×0.6 damage instead of ×0.5. | You give away part of your cover every time, wanted or not: two people half protected instead of one door properly shut. |
| 80 | **Last One Standing** | While at least one ally is down, your Might and Constitution are ×1.25, and at the start of each of your turns you gain 10 Limit and take 5 stress. | Your best form arrives exactly when things are worst, and it bills your nerves every turn you stay in it. Reviving the ally ends both. |

#### Mage

| Lv | Passive | Rule | The choice |
| ---: | --- | --- | --- |
| 1 | **Marginalia** | The first time each battle you hit an enemy with a given element, its affinity to that element is revealed to the party and you gain 6 Limit. Whenever one of your spells hits a weakness, you gain 8 Limit. | The gauge pays for research and for being right, not for repeating a safe spell. Testing an element costs a turn, and the answer may be "resisted". |
| 14 | **I Told You So** | When your spell hits a weakness, your next skill costs half MP. When your spell is resisted, nulled or absorbed, you take 5 stress that Willpower cannot reduce. | Being right is cheap and being wrong is personal. Guessing at an unknown enemy now risks your nerve as well as your turn. |
| 30 | **Ivory Tower** | While you are at full HP your Arcana is ×1.15. While you are below 50% HP it is ×0.9. | Your best work needs you untouched, so the party pays to keep you that way, and one good shove moves you from the first number to the second. |
| 46 | **Bedside Manner** | Your healing on an ally below 30% HP is ×1.3. Your healing on an ally above 70% HP is ×0.7. | Topping people up is wasteful; waiting until it is nearly too late is efficient and frightening. You choose how close to the edge to let them get. |
| 62 | **Chain of Thought** | Each damaging spell you cast of a different element from your previous spell deals 10% more damage, building to 30%. Repeating an element, or doing anything else with your turn, resets it to nothing. | Rotating elements builds the bonus; hammering the one weakness you found throws it away. So does stopping to heal. |
| 80 | **Mind Over Matter** | Once per round, when a hit would take you to 0 HP, you stay at 1 HP and pay the rest of that hit from MP at 1 MP per 4 HP. If you cannot pay all of it, the hit lands in full and no MP is spent. | It is automatic. Every MP held back as armor is a spell not cast, and every spell cast is armor spent. |

#### Rogue

| Lv | Passive | Rule | The choice |
| ---: | --- | --- | --- |
| 1 | **Sticky Fingers** | Gain 6 Limit each time you land a crit and each time you inflict a bind. | Plain hits earn nothing. A careful rogue has an empty gauge; a greedy one is fishing for crits with skills that miss more often. |
| 10 | **First In** | In the first two rounds of a battle your attacks get +15 to crit. From round six onward they get −10 to hit. | You are built for the opening, not the siege. A long fight turns your best trait into a penalty, so end it early or be carried. |
| 22 | **Opportunist** | When you crit with a skill that carries a bind, the bind ignores the target's bind resistance and the wear from earlier binds. When such a skill hits without a crit, any bind it lands lasts 1 turn less, to a minimum of 1. | Your binds become bets on your crits. Setting up Marked or Hidden lets you tie up a boss; skipping the setup leaves you with the shortest binds in the party. |
| 38 | **Travelling Light** | The first attack aimed at you each round gets −15 to hit. Any attack that hits you while you are above 50% HP deals ×1.15 damage. | Harder to touch, softer when touched. The one hit that does connect is the one that counts. |
| 55 | **Kick 'Em While They're Down** | You deal ×1.25 damage to a target with at least one bound part and ×0.9 damage to a target with none. | You are the best in the party at finishing a tied-up enemy and the worst at opening on a free one. Something has to land a bind first. |
| 76 | **Cut and Run** | When you defeat an enemy you become Hidden for 1 turn. When an ally is defeated you take 8 stress that Willpower cannot reduce. | You get out clean after every kill, which leaves your friends holding the room, and you feel it when one of them pays for that. |

#### General (any archetype)

| Lv | Passive | Rule | The choice |
| ---: | --- | --- | --- |
| 5 | **Quartermaster** | Recovery and MP items you use on an ally restore 25% more. The same items used on yourself restore 25% less. | This character is the party's medic or its own, not both. Somebody else has to keep them on their feet. |
| 15 | **Deep Breaths** | When you use the Guard action you shed 4 stress. You gain no Limit during any round in which you Guard. | A turn spent breathing is a turn not spent building toward your ultimate, or doing anything else. |
| 35 | **Lucky Charm** | Once per battle, the first fumble you roll counts as a plain miss instead. From then until the battle ends your attacks get −5 to crit. | You buy off one disaster with a little of every success that follows. On Valerie it also cancels an Accidental Chaos Wave. |
| 55 | **Gallows Humour** | You take no stress from death sources, and you shed 5 stress whenever an enemy is defeated. Embarrassment stress on you is ×1.5. | Nothing grim gets to you and everything silly does. A heckle or a public pratfall lands harder than a lich. |

### 4.6 Status registry

`data/skills.json` registers every status a class skill, a passive, an item or the hero's kit can apply. Bosses and encounters register their own in `data/bosses.json` and `data/encounters.json` (section 5). Kind says what a cleanse does with it: `bad` comes off an ally, `good` comes off an enemy, `neutral` is never cleansed.

#### Shared

| Status | id | Kind | Rule |
| --- | --- | --- | --- |
| **Analyzed** | `analyzed` | bad | Its affinities are revealed, and attacks on it get +20 to hit for the duration. |
| **Taunt** | `taunt` | neutral | Enemies must aim their attacks at this character. Area attacks are unaffected. |
| **Guard Broken** | `guard_broken` | bad | Loses Guard and cannot Guard for the rest of this round. |
| **Guard** | `guard` | good | Takes ×0.5 damage. A Guard you raise yourself lasts until the start of your next turn; a Guard someone else gives you lasts until the start of their next turn. It does not reduce stress and does not stack with Fortified or Bulwark. |
| **Provoked** | `provoked` | bad | Must aim its single-target attacks at the character who provoked it. Area attacks are unaffected. Ends early if that character is downed or Hidden. |
| **Covered** | `covered` | good | Single-target attacks aimed at this character hit the ally covering it instead, against the coverer's defenses. Ends early if the coverer is downed or has bound legs. |
| **Counter Stance** | `counter` | good | Every melee attack rolled against this character, hit or miss, is answered with a free basic attack on the attacker if this character is still standing. Ends if it Guards or its arms are bound. |
| **Fortified** | `fortified` | good | Takes ×0.5 damage and can still act. Does not reduce stress and does not stack with Guard. |
| **Bulwark** | `bulwark` | good | Every attack aimed at an ally hits this character instead, and an area attack hits it once. It takes ×0.5 damage. Stress and binds riding on those attacks land on it too. |
| **Marked** | `marked` | bad | Every attack on this character gets +15 to crit. |
| **Hidden** | `hidden` | good | Enemies cannot choose this character as the target of a single-target skill while another ally is standing. Its next attack gets +20 to crit. Ends when it attacks. |
| **Exposed** | `exposed` | bad | Every hit on this character deals ×1.25 damage. |
| **Focused** | `focused` | good | Its next damaging skill deals ×1.5 damage, then this ends. While it lasts, attacks against this character get +10 to hit. |
| **Sitting Out** | `sitting_out` | bad | Loses its next turn, then this ends. It can still be targeted and cannot Guard. |
| **All-Nighter** | `all_nighter` | good | Its skills cost no MP. When this ends, its head is bound for 2 turns. |
| **Fire Ward** | `ward_fire` | good | Treats fire as resisted: fire damage ×0.5. A character weak to fire takes normal damage instead. Null and absorb are unchanged. |
| **Ice Ward** | `ward_ice` | good | Treats ice as resisted: ice damage ×0.5. A character weak to ice takes normal damage instead. Null and absorb are unchanged. |
| **Bolt Ward** | `ward_bolt` | good | Treats bolt as resisted: bolt damage ×0.5. A character weak to bolt takes normal damage instead. Null and absorb are unchanged. |
| **Holy Ward** | `ward_holy` | good | Treats holy as resisted: holy damage ×0.5. A character weak to holy takes normal damage instead. Null and absorb are unchanged. |
| **Dark Ward** | `ward_dark` | good | Treats dark as resisted: dark damage ×0.5. A character weak to dark takes normal damage instead. Null and absorb are unchanged. |

#### The hero only

| Status | id | Kind | Rule |
| --- | --- | --- | --- |
| **Extra Slippery** | `extra_slippery` | good | Valerie only. Until her next turn, enemies' hit ceiling against her drops 10 more. Guarding on purpose switches it off. |
| **Rummaging** | `pocket_found_check` | neutral | Valerie only. Make her Pocket Dimension Found check now. Instant: nothing lingers. |
| **A Good Hero** | `good_hero` | good | Valerie only. Her passives act as if the Airhead gauge were 100 and her planned skills stay available. When it ends the gauge resets to 50. |
| **It All Clicks** | `auto_crit_next_think` | good | Valerie only. Her next planned skill is an automatic crit, then this ends. |
| **Plot Armor** | `plot_armor` | good | Valerie only. Once per battle, a blow that would drop her leaves her at 1 HP if she passes a Luck check at normal difficulty (+Airhead/5). |

#### What stress does to an enemy

Enemies carry the same 0–200 stress bar as the party, and their Willpower reduces what they take by the same formula (section 1.6). They never roll a Resolve Check. Two thresholds replace it:

| Status | id | Kind | Rule |
| --- | --- | --- | --- |
| **Rattled** | `rattled` | bad | An enemy whose stress reaches 100 is Rattled until the battle ends: its attacks get −10 to hit and it fumbles on a roll of 91 or more. |
| **Routed** | `routed` | bad | An enemy whose stress reaches 200 is Routed. A minion or standard enemy runs: it is defeated and pays full rewards. An elite, boss or superboss loses its next action instead, and its stress drops back to 100. |

A brute with a deep HP bar and low Willpower is cheaper to rout than to kill. A boss cannot be routed, but 100 stress on it costs it a tenth of its accuracy for the rest of the fight and widens its fumble band, which is where the hero's Aura of Befuddlement lives.

### 4.7 Economy Item Matrix

Prices come from the two helpers in section 2.6 and are rounded to two significant figures. Consumables are priced in reference fights with `priceForFights(level, fights)`: one fight pays 40 gold at level 1, 400 at level 10, 2,000 at level 50 and 4,000 at level 100. Seeds and gear are priced in levels with `priceAt(level, share)`. An item's level is the level it is sized and priced for; nothing stops a lower-level party buying it if it has the gold. The party starts with 160 gold.

Gold income grows with the square of the level and prices are fixed, so anything that restores a share of a bar needs a ceiling or it would be free by mid-game. Stress never scales at all, so stress relief is never sold for gold alone: each calming item also takes MP, a turn, or works once per rest.

#### Recovery

A basic recovery item costs half a fight at its level (`20 × level`), which a party can afford every fight or two. Each tonic restores 30% of max HP up to a ceiling. The ceiling is 30% of a warrior's bar at the level where the next tier goes on sale, so a tonic gives everyone the full 30% through its own tier and then goes stale on the biggest bars first. A mage or a rogue can keep drinking the cheap one for longer than the warrior can.

| Item | Level | Price (gold) | Use | Effect |
| --- | ---: | ---: | --- | --- |
| **Packed Lunch** | 1 | 10 | outside battle | Out of battle only. Restores 20% of one character's max HP and sheds 3 stress. Only the first lunch a character eats after each rest sheds stress. |
| **Pick-Me-Up** | 1 | 20 | anywhere | Restores 30% of one ally's max HP, up to 5,700 HP. |
| **Proper Pick-Me-Up** | 15 | 300 | anywhere | Restores 30% of one ally's max HP, up to 39,000 HP. |
| **Serious Pick-Me-Up** | 40 | 800 | anywhere | Restores 30% of one ally's max HP, up to 140,000 HP. |
| **Unreasonable Pick-Me-Up** | 75 | 1,500 | anywhere | Restores 30% of one ally's max HP, up to 300,000 HP. |

#### MP

MP is the scarce bar, so it costs a whole fight. The ceiling is sized on the mage's bar in the same way.

| Item | Level | Price (gold) | Use | Effect |
| --- | ---: | ---: | --- | --- |
| **Cup of Coffee** | 5 | 200 | anywhere | Restores 30% of one ally's max MP, up to 2,200 MP. |
| **Double Espresso** | 30 | 1,200 | anywhere | Restores 30% of one ally's max MP, up to 10,000 MP. |
| **Concerning Espresso** | 65 | 2,600 | anywhere | Restores 30% of one ally's max MP, up to 30,000 MP. |

#### Stress relief

The universal Breather takes 10 stress off the character who spends a turn on it, for free (section 3). These items do what a Breather cannot: calm someone else, work outside battle, or take off more in one go. Each has a catch that gold cannot pay.

| Item | Level | Price (gold) | Use | Effect |
| --- | ---: | ---: | --- | --- |
| **Chamomile Tea** | 8 | 320 | anywhere | One ally sheds 10 stress and loses 15% of their max MP: calm, and a little sleepy. Only the first cup a character drinks after each rest does anything. |
| **Big Soft Hanky** | 25 | 1,500 | battle | Battle only. One ally has a good cry: they shed 25 stress and sit out their next turn. |

#### Cures

| Item | Level | Price (gold) | Use | Effect |
| --- | ---: | ---: | --- | --- |
| **Wriggle Oil** | 5 | 100 | anywhere | Removes every bind (head, arms and legs) from one ally. |
| **Fresh Start Kit** | 30 | 1,200 | anywhere | Removes every bind, every debuff and every harmful status from one ally. |
| **Smelling Salts** | 20 | 1,200 | anywhere | Snaps one ally out of an Affliction (or a Virtue) at once. If their stress is above 90 it drops to 90, so the next bad moment means a new Resolve Check. |

#### Revive

| Item | Level | Price (gold) | Use | Effect |
| --- | ---: | ---: | --- | --- |
| **Alarm Rooster** | 10 | 800 | anywhere | Revives a downed ally at 25% of max HP. Nobody enjoys it: they wake up with 10 stress that Willpower cannot reduce. |

#### Elementals: thrown

Anyone can throw one, so a party without a mage can still hunt a weakness. A thrown item is an attack: it rolls to hit with the thrower's own Finesse and Luck, and it is tagged `ranged` and `projectile`. Its damage does not use the thrower's attributes. It uses the thrower's Level and the benchmark attribute for that Level (10 at level 1, 600 at level 100), against the target's Willpower, so it hits like a trained caster's spell of that Power. Tier 1 counts the thrower's Level as 40 at most, which is what makes it go stale.

| Tier | Level | Price (gold) | Power | Thrower Level counts up to | Fire | Ice | Bolt | Holy | Dark |
| ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 8 | 160 | 4 | 40 | Firecracker | Snowball | Static Sock | Blessed Water Balloon | Ink Bomb |
| 2 | 45 | 1,400 | 7 | 100 | Bottled Bonfire | Bottled Blizzard | Bottled Thunder | Bottled Sunrise | Bottled Midnight |

What a fire item does to an even peer (benchmark Willpower, `hpBudget` HP):

| Item | Power | Thrower level | Level used | Damage | Share of the peer's bar |
| --- | ---: | ---: | ---: | ---: | ---: |
| Firecracker | 4 | 8 | 8 | 832 | 20.0% |
| Firecracker | 4 | 40 | 40 | 19,360 | 20.0% |
| Firecracker | 4 | 70 | 40 | 15,530 | 5.3% |
| Firecracker | 4 | 100 | 40 | 12,966 | 2.2% |
| Bottled Bonfire | 7 | 45 | 45 | 42,840 | 35.0% |
| Bottled Bonfire | 7 | 70 | 70 | 103,145 | 35.0% |
| Bottled Bonfire | 7 | 100 | 100 | 210,000 | 35.0% |

#### Elementals: wards

| Ward | Element | Level | Price (gold) | Effect |
| --- | --- | ---: | ---: | --- |
| **Oven Mitts** | fire | 12 | 240 | One ally resists fire for 3 turns: fire damage ×0.5, or normal damage if they were weak to it. |
| **Woolly Scarf** | ice | 12 | 240 | One ally resists ice for 3 turns: ice damage ×0.5, or normal damage if they were weak to it. |
| **Rubber Boots** | bolt | 12 | 240 | One ally resists bolt for 3 turns: bolt damage ×0.5, or normal damage if they were weak to it. |
| **Tinted Spectacles** | holy | 12 | 240 | One ally resists holy for 3 turns: holy damage ×0.5, or normal damage if they were weak to it. |
| **Night Light** | dark | 12 | 240 | One ally resists dark for 3 turns: dark damage ×0.5, or normal damage if they were weak to it. |

#### Stat-buffers

One for each attribute, three turns each. Attack attributes get the smaller multiplier and the larger price, because attack moves damage far more than defense does (section 1.3): Might ×1.2 is about ×1.28 damage, while Constitution ×1.3 is about ×0.91 damage taken.

| Item | Attribute | Level | Price (gold) | Effect |
| --- | --- | ---: | ---: | --- |
| **Protein Biscuit** | Might | 18 | 720 | One ally has Might ×1.2 for 3 turns. |
| **Clever Toffee** | Arcana | 18 | 720 | One ally has Arcana ×1.2 for 3 turns. |
| **Jumping Beans** | Finesse | 18 | 720 | One ally has Finesse ×1.2 for 3 turns. |
| **Second Breakfast** | Constitution | 18 | 360 | One ally has Constitution ×1.3 for 3 turns. |
| **Nerve Tonic** | Willpower | 18 | 360 | One ally has Willpower ×1.3 for 3 turns. |
| **Four-Leaf Clover** | Luck | 18 | 360 | One ally has Luck ×1.3 for 3 turns. |

#### Seeds

| Seed | Attribute | Level | Price (gold) | Effect |
| --- | --- | ---: | ---: | --- |
| **Gristle Seed** | Might | 50 | 16,000 | Permanent +5 Might. At most 10 per character. |
| **Bookworm Seed** | Arcana | 50 | 16,000 | Permanent +5 Arcana. At most 10 per character. |
| **Fidget Seed** | Finesse | 50 | 16,000 | Permanent +5 Finesse. At most 10 per character. |
| **Stodge Seed** | Constitution | 50 | 16,000 | Permanent +5 Constitution. At most 10 per character. |
| **Mule Seed** | Willpower | 50 | 16,000 | Permanent +5 Willpower. At most 10 per character. |
| **Fluke Seed** | Luck | 50 | 16,000 | Permanent +5 Luck. At most 10 per character. |

Seeds are eaten outside battle and cost half a level of gold each. Gear and seeds draw on the same headroom: together they never add more than 200 to one attribute, and no attribute passes 1000.

#### Kit

| Item | Level | Price (gold) | Use | Effect |
| --- | ---: | ---: | --- | --- |
| **Camp Kit** | 1 | 40 | outside battle | Used up to make camp once, outside battle. Each character either Sleeps (restores 50% of max HP and MP) or Unwinds (sheds 30 stress). The price is one fight's gold at the party's level, 40 × level, so the price shown is for level 1. |

### 4.8 Gear tiers

Every archetype's signature attribute reaches exactly 800 at level 100. Equipment supplies the last 200. Gear comes in ten tiers, one per ten levels, and this table is the whole system: individual swords and hats are names on these numbers.

| Tier | Name | Levels | Weapon price | Full set price | Set bonus | Signature attribute at the bracket ends | Bonus as a share of it |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Hand-Me-Downs | 1–10 | 160 | 320 | +5 | 16–87 | 31%–6% |
| 2 | Guild Issue | 11–20 | 2,900 | 5,700 | +25 | 95–166 | 26%–15% |
| 3 | Journeyman | 21–30 | 7,600 | 15,000 | +45 | 174–246 | 26%–18% |
| 4 | Tournament Grade | 31–40 | 14,000 | 29,000 | +65 | 254–325 | 26%–20% |
| 5 | Master-Forged | 41–50 | 23,000 | 46,000 | +85 | 333–404 | 26%–21% |
| 6 | Rune-Etched | 51–60 | 34,000 | 67,000 | +105 | 412–483 | 25%–22% |
| 7 | Royal Armory | 61–70 | 46,000 | 93,000 | +125 | 491–562 | 25%–22% |
| 8 | Dragonscale | 71–80 | 61,000 | 120,000 | +150 | 570–642 | 26%–23% |
| 9 | Star-Metal | 81–90 | 78,000 | 160,000 | +175 | 650–721 | 27%–24% |
| 10 | Legendary (Probably) | 91–100 | 96,000 | 190,000 | +200 | 729–800 | 27%–25% |

A set is three pieces: weapon (the listed price, half the bonus), armour (0.6 of the price, three tenths of the bonus) and charm (0.4 of the price, a fifth of the bonus). Each piece puts its points on one attribute chosen when it is bought. Gear and seeds together never add more than 200 to one attribute. The last two columns use the warrior's Constitution; every signature attribute follows the same line.

A weapon costs one level of gold at the level its tier opens (`priceAt(minLevel, 1)`), so the first one costs exactly the starting purse. A party that saves a third of its income affords one major purchase every 2.9 levels (section 2.6), about three or four pieces per tier between four characters. Nobody is fully equipped; choosing who gets the new sword is the point.

### 4.9 Balance notes

Every number in this part is engine output. "Even peer" is a target with every attribute on the benchmark line and `hpBudget(level)` HP: 6,400 at level 10, 151,000 at level 50, 600,000 at level 100. Attackers are the archetypes with no gear.

**What a skill does to an even peer.** For each archetype, its level 1 attack and a newer one. "Plain hit" is a landed hit with no crit at variance 1. "Hit / crit" is the chance on the d100. "Average per use" counts misses, fumbles and crits (`expectedDamage`).

| Level | Archetype | Skill | Power | Plain hit | Share of peer's bar | Hit / crit % | Average per use | Cost (MP) | Share of own bar | Casts from a full bar |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | Warrior | Shield Bash | 3 STR | 1,347 | 21.0% | 74 / 5 | 16.1% | 1 | 0.3% | 350 |
| 10 | Warrior | Cleave | 3 STR | 1,347 | 21.0% | 74 / 5 | 16.1% | 12 | 3.4% | 29 |
| 10 | Mage | Hot Take | 3 INT | 1,347 | 21.0% | 74 / 2 | 15.8% | 1 | 0.1% | 870 |
| 10 | Mage | Pop Quiz | 4.5 INT | 2,021 | 31.6% | 59 / 22 | 22.1% | 42 | 4.8% | 20 |
| 10 | Rogue | Cheap Shot | 3 AGI | 1,431 | 22.4% | 81 / 23 | 20.7% | 1 | 0.2% | 450 |
| 50 | Warrior | Shield Bash | 3 STR | 31,007 | 20.5% | 73 / 5 | 15.5% | 1 | 0.0% | 7,650 |
| 50 | Warrior | Overhead Regret | 9 STR | 93,021 | 61.6% | 58 / 5 | 37.3% | 900 | 11.8% | 8 |
| 50 | Mage | Hot Take | 3 INT | 31,007 | 20.5% | 73 / 2 | 15.2% | 1 | 0.0% | 20,200 |
| 50 | Mage | Peer Review | 6 INT | 62,014 | 41.1% | 78 / 2 | 32.4% | 1,300 | 6.4% | 15 |
| 50 | Rogue | Cheap Shot | 3 AGI | 33,084 | 21.9% | 80 / 22 | 19.9% | 1 | 0.0% | 10,150 |
| 50 | Rogue | Put a Sock in It | 3 AGI | 33,084 | 21.9% | 80 / 7 | 18.3% | 580 | 5.7% | 17 |
| 100 | Warrior | Shield Bash | 3 STR | 122,603 | 20.4% | 73 / 5 | 15.4% | 1 | 0.0% | 30,000 |
| 100 | Warrior | Grudge Match | 6 STR | 245,207 | 40.9% | 73 / 5 | 30.9% | 2,400 | 8.0% | 12 |
| 100 | Mage | Hot Take | 3 INT | 122,603 | 20.4% | 73 / 1 | 15.0% | 1 | 0.0% | 80,000 |
| 100 | Mage | Absolute Zero Tolerance | 9 INT | 367,811 | 61.3% | 63 / 1 | 38.9% | 8,100 | 10.1% | 9 |
| 100 | Rogue | Cheap Shot | 3 AGI | 130,909 | 21.8% | 80 / 22 | 19.9% | 1 | 0.0% | 40,000 |
| 100 | Rogue | Stab in the Back | 7 AGI | 305,454 | 50.9% | 75 / 17 | 42.5% | 1,500 | 3.8% | 26 |

The level 1 attacks keep their share of a peer's bar at every level while their cost falls to nothing: that is the flat-cost rule at work. A newer skill still takes a real slice of the bar, and what it buys is a bigger hit or a rider, each with its own drawback written into the text.

**Casts per bar.** What a skill of each weight costs if it unlocks at that level, and how many times a full bar pays for it.

| Level | Archetype | Max MP | Light | Standard | Heavy | Signature |
| ---: | --- | ---: | --- | --- | --- | --- |
| 10 | Warrior | 350 | 19 MP, 18 casts | 32 MP, 10 casts | 45 MP, 7 casts | 64 MP, 5 casts |
| 10 | Mage | 870 | 38 MP, 22 casts | 64 MP, 13 casts | 90 MP, 9 casts | 130 MP, 6 casts |
| 10 | Rogue | 450 | 26 MP, 17 casts | 38 MP, 11 casts | 58 MP, 7 casts | 83 MP, 5 casts |
| 50 | Warrior | 7,650 | 450 MP, 17 casts | 760 MP, 10 casts | 1,100 MP, 6 casts | 1,500 MP, 5 casts |
| 50 | Mage | 20,200 | 910 MP, 22 casts | 1,500 MP, 13 casts | 2,100 MP, 9 casts | 3,000 MP, 6 casts |
| 50 | Rogue | 10,150 | 600 MP, 16 casts | 910 MP, 11 casts | 1,400 MP, 7 casts | 2,000 MP, 5 casts |
| 100 | Warrior | 30,000 | 1,800 MP, 16 casts | 3,000 MP, 10 casts | 4,200 MP, 7 casts | 6,000 MP, 5 casts |
| 100 | Mage | 80,000 | 3,600 MP, 22 casts | 6,000 MP, 13 casts | 8,400 MP, 9 casts | 12,000 MP, 6 casts |
| 100 | Rogue | 40,000 | 2,400 MP, 16 casts | 3,600 MP, 11 casts | 5,400 MP, 7 casts | 7,800 MP, 5 casts |

**Area skills** at their unlock level, per enemy hit:

| Level | Archetype | Skill | Target | Power | Plain hit | Share of peer's bar |
| ---: | --- | --- | --- | --- | ---: | ---: |
| 5 | Warrior | Cleave | one row | 3 STR | 367 | 21.6% |
| 68 | Warrior | Table Flip | one row | 6 STR | 113,924 | 41.0% |
| 34 | Mage | Burnout | one row | 5 INT | 24,062 | 34.2% |
| 66 | Mage | Brainstorm | all enemies | 4 INT | 71,594 | 27.3% |
| 92 | Mage | Publish or Perish | all enemies | 7 INT | 242,489 | 47.7% |

**Ultimates** at level 100. The last column is a plain hit against a boss with benchmark attributes and 12,000,000 HP.

| Archetype | Ultimate | Power | Plain hit | Share of a peer's bar | Crit | Against a weakness | Share of a boss's bar |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Warrior | Closing Time | 22 STR | 899,094 | 150% | 1,348,641 | 1,348,641 | 7.5% |
| Mage | Dissertation | 24 INT | 980,830 | 163% | 1,471,245 | 1,471,245 | 8.2% |
| Rogue | The Big Score | 20 LCK | 817,358 | 136% | 1,226,037 | 1,226,037 | 6.8% |

**Healing** at level 100, as a share of each archetype's own bar:

| Archetype | Skill | Power | HP restored | On a warrior | On a mage | On a rogue |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Warrior | Walk It Off | 6 CON | 240,000 | 30% | n/a | n/a |
| Mage | Light Reading | 4 INT | 152,000 | 19% | 32% | 33% |
| Mage | Group Project | 4 INT | 152,000 | 19% | n/a | 33% |
| Mage | Recommended Reading | 9 INT | 342,000 | 43% | 71% | 74% |

**Stress on enemies** at each skill's unlock level. The last three columns are what lands on an enemy whose Willpower is half the benchmark, on it, and half again above it.

| Level | Archetype | Skill | Target | Base | Source | Low Willpower | Benchmark | High Willpower |
| ---: | --- | --- | --- | ---: | --- | ---: | ---: | ---: |
| 4 | Rogue | Heckle | one enemy | 12 | embarrassment | 12 | 11 | 11 |
| 12 | Rogue | Kick Me Sign | one enemy | 6 | embarrassment | 6 | 5 | 5 |
| 13 | Mage | Strongly Worded Letter | one enemy | 12 | mental | 11 | 11 | 10 |
| 28 | Rogue | Trouser Malfunction | one enemy | 15 | embarrassment | 13 | 12 | 11 |
| 52 | Warrior | Rattle the Line | one row | 14 | mental | 11 | 9 | 8 |
| 66 | Rogue | Roast | all enemies | 20 | embarrassment | 15 | 12 | 10 |

A benchmark enemy is Rattled after about nine of the single-target hits and Routed after about eighteen. The same enemy dies to five landed Power 3 hits. Stress is the slower road against ordinary enemies and the better one against anything with a deep HP bar and a weak mind, and a stress rider on a damaging skill (Strongly Worded Letter, Kick Me Sign's Mark) costs nothing extra.

**Bind chances** at each skill's unlock level, from `bindChance`. The target has benchmark Luck.

| Level | Archetype | Skill | Part | Base | No resistance | Resistance 50 | Second bind on that part |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Rogue | Ankle Tap | legs | 45% | 57% | 29% | 29% |
| 4 | Mage | Cold Feet | legs | 45% | 38% | 19% | 19% |
| 5 | Warrior | Cleave | legs | 40% | 43% | 21% | 21% |
| 17 | Rogue | Butterfingers | arms | 45% | 53% | 26% | 26% |
| 28 | Rogue | Trouser Malfunction | legs | 40% | 47% | 24% | 24% |
| 40 | Rogue | Put a Sock in It | head | 45% | 52% | 26% | 26% |
| 50 | Mage | Closed Book | head | 50% | 40% | 20% | 20% |
| 80 | Rogue | Gift Wrap | head, arms, legs | 35% | 42% | 21% | 21% |

The rogue's Luck sits above the benchmark and the mage's sits below it, so the same base chance is worth about seven points more to a rogue and ten less to a mage.
