## 8. THE BATTLE RUNNER

Sections 1 to 7 are the rules. This section is the thing that takes turns with them. `engine/battle.js` plays a fight from the first initiative roll to the last blow, using the arithmetic in `engine/` and the data in `data/`, and `engine/narrate.js` reports every beat twice: one line of dice and numbers, then a paragraph of story. `test/battle.test.js` pins the rules on this page. Every number and every quoted beat below was printed by running that code.

A game master can run a fight by hand from 8.2 and 8.3. A programmer can drive it from 8.1.

### 8.1 The shape of it

A battle is one plain-data **state** and a handful of pure functions. Nothing mutates a state it is given: each call hands back a new one.

| Function | What it does |
| --- | --- |
| `createBattle(setup, rng?)` | Builds the combatants, rolls the first initiative, and plays any enemy who acts before the first hero. Returns the state at the first hero decision. The beats so far are in `state.opening`. |
| `currentActor(state)` | The hero whose decision it is, or `null` when the battle is over. |
| `legalActions(state, actorId)` | What that hero may do now. Each entry has what a button needs: `kind`, `skillId`, `stance`, `targets`, `label`, `cost`. Anything sealed, unaffordable, refused or not supported comes back with `disabled: true` and a one-line `why`. |
| `act(state, action, rng)` | Resolves that one action and everything it sets off, then plays every enemy turn up to the next hero decision. Returns `{ state, events }`. |
| `runBattle(setup, { policy, rng, maxRounds })` | Plays a whole fight with a policy function, for tests and simulation. Returns `{ state, events, summary }`. |
| `defaultPolicy(state, actorId, actions)` | A plain, sensible player. It revives, heals whoever is under half, calms whoever is about to crack, keeps Valerie Winging It behind her own taunt, and otherwise uses the affordable attack expected to do the most. |

Enemies are built the way section 5 builds them: an encounter's `factors` × `benchmarkStat(level)`, a boss's own `stats`, and HP from `maxHp(level, CON, rank)`. Heroes carry the skills their archetype has unlocked at their level unless the caller lists others.

The same setup, the same actions and the same seeded `rng` give the same events, word for word.

### 8.2 How a round runs

1. **Initiative.** Everyone in the fight rolls `initiative` (Finesse × 10, plus up to a fifth of that). Highest goes first. Ties go to the higher Luck, then to heroes. It is rolled again every round, so bound legs cost you your place in the next one.
2. **Who is in the fight.** Every hero still standing. For enemies, the front of each kind: `acting` on an enemy is how many of that kind fit through the gap at once. The rest wait behind the front. They do not act and cannot be reached until one ahead of them falls. Gate Shut halves every front, never under one.
3. **Each turn, in order:**
   1. Any Guard this combatant gave out ends.
   2. A boss reads the next row of its phase script.
   3. Damage over time ticks: a hit of that Power from its caster, with no roll, no crit and no variance. Affinity applies.
   4. A state that mends its owner does so (Second Wind).
   5. A lost turn is lost (Sitting Out). Lost actions are taken off the turn (Surprised, Scrabbling, a Routed boss).
   6. A hero in an Affliction or a Virtue makes the turn check, `actOutCheck`. The act that fires may spend the turn: a Guard, a pass, a basic attack on a target read off the dice.
   7. The combatant acts, once per action it has. A hero waits for the player. An enemy chooses (8.5).
   8. The turn ends: binds lose a turn (`tickBinds`), then timed attribute changes and statuses. Something a combatant put on itself this turn does not lose a turn until its next. What ran out is reported. Then what follows an ending: the All-Nighter's crash, the gauge reset after I'm Just a Good Hero!
4. **End of the round.** Anyone who had no turn (the ranks behind the front) still gets a round older. Statuses that last "this round" end: Guard Broken, and a Guard a move gave for a stated number of rounds.
5. **The fight ends** the moment every enemy is down or Routed (a win), no hero is standing (a loss: down, or Stormed Off), or the party concedes to a boss (a win).

### 8.3 How one action resolves

This is the order in section 4.1, with the hero and the bosses folded in.

1. **Is it legal?** A bound part seals its skills, never the basic attack. Valerie's skills also need their stance and their band of the gauge. The cost must be payable. A Resolve state may refuse the action (On a Roll will not Guard). A skill the runner cannot resolve is not offered.
2. **Pay** the MP or the Limit.
3. **Valerie chooses a stance.** Its stress lands now: Wing It sheds 2, Think It Through adds 4 that Willpower cannot reduce. Its gauge change (+10 or −15) waits until the dice are down, so the bands the roll is read against are the ones the player saw.
4. **Find the targets.**
   - `self`, `ally`, `allies`: the party. `allies` includes the user.
   - `one`: an enemy that is Provoked must aim at whoever provoked it. Otherwise a Taunt must be aimed at. Otherwise anyone who is not Hidden. Then the attack may be pulled elsewhere, in this order: a Bulwark, whoever is Covering the target, a Resolve state that shields the most hurt ally, Bodyguard's Reflex.
   - `row`, `all`: everyone on that side who is in the fight. A side is one row unless combatants carry a `row`. A Bulwark takes an area attack once, alone.
5. **Nothing is rolled** for a skill aimed at the party, or for a move marked `auto`. A heal is `healAmount` for each target. Then the effects.
6. **One d100 for each enemy target.**
   - An enemy attacking Valerie: `enemyAttacksValerie`. Her lowered ceiling, the bounce band and the widened fumble band are all read off that one roll.
   - Valerie attacking in a stance: `valerieAttacks`. A fumble while Winging It is a Chaos Wave, at most one per action.
   - Anyone else: `resolveAttack`, with `withStateOpts` so an Affliction or a Virtue moves the bands.
   - A pure bind skill (Closed Book, Accidental Trip) rolls through `tryBind` instead.
   - Statuses move a band edge or multiply the damage. They never add a roll. Analyzed +20 to hit, Focused target +10, Marked +15 crit, Hidden attacker +20 crit. Guard ×0.5, Exposed ×1.25, Trussed ×1.5, Focused ×1.5. A ward steps the affinity down one.
7. **What follows a roll, in this order:** the damage and its beat. Plot Armor. A defeat, or stress for falling under a quarter HP. A boss phase change. Stress for taking a crit (the relief for landing one is already on the beat). Limit. A Chaos Wave and the contraption it sets off. The skill's unmarked effects on that target, where a bind rides on the same d100. A Counter Stance reply.
8. **Effects that name their own target** land once per use: `self` (the price, hit or miss, unless marked `onHit`), `heroes`, `valerie`, `others`, `enemies`, `allies`.
9. **Afterwards** Hidden and Focused and It All Clicks are spent, and extra actions are granted (Borrowed Time, Clean Getaway). The stance's gauge change lands as soon as the dice are down, before the skill's own gauge effect, so "the gauge snaps back to 50" means 50.

**Stress is resolved where it lands.** World stress goes through `applyStress` and Willpower. Valerie's goes through `applyStressToValerie`: fear slides off her unless she is Lucid and every ally sheds 3; the truth ignores her Willpower and knocks 10 off the gauge. At 100 the hero rolls the Resolve Check (`partyResolveCheck`, one d100), and the result's party stress lands on everyone else, flat. At 200 it is a Breakdown, and the caller's choice decides who pays (Storm Off by default). An enemy at 100 is Rattled and at 200 Routed, through `enemyStressEvent`. The standard sources fire on heroes: a crit taken, HP under a quarter, an ally down, getting back up, a fumble.

**The dice, in the order they are drawn.** Initiative, one for each combatant in the fight, heroes first. An enemy's choice of move, only when it is picking by weight among more than one usable move. Its choice of target, only when there is more than one (Madam Parity never rolls for it). The d100. The variance, only when the hit lands or bounces. A heal's variance. A pure bind skill, the Resolve Check, the turn check and Plot Armor each roll their own d100, because each is its own question.

### 8.4 The hero in the loop

| Accident | In the runner |
| --- | --- |
| **Unintentional Dodge** | Every rolled enemy attack on her goes through `enemyAttacksValerie`. A roll that would have hit without the lowered ceiling is reported as a dodge. Her own Guard action switches it off; a Guard someone gives her does not. |
| **Kinetic Deflection** | A roll in the bounce band deals her nothing and sends the shot back at the shooter. She gains 10 Limit. |
| **Aura of Befuddlement** | An enemy that fumbles against her binds one of its own parts for a turn (`befuddle`). She gains 5 Limit. A Rattled enemy fumbles five sooner on top of her aura. |
| **Accidental Chaos Wave** | Her fumble while Winging It: every enemy in the fight is Off-Balance and loses Guard, she gains 15 Limit, and the arena's contraption goes off if it has a use left. A natural 100 also hits every enemy for Power 4. |
| **Inspirational Ignorance** | Stress on her goes through her filter. Allies' Resolve Checks get her shift. |
| **Pocket Dimension** | Not in the runner. Found It! is offered greyed out. |

Her Limit is Main Character Energy. **I'm Just a Good Hero!** spends 100 of it: for three of her turns her passives read the gauge as 100 and planned skills ignore their band, allies shed 10 stress, and the gauge resets to 50 when it ends. Guard, Breather and conceding are not taken in a stance and do not move the gauge, except that Vellum's concession is made Thinking It Through.

### 8.5 How enemies choose

- **A boss with a script** takes the next row of its phase's `script` each round and uses that row's moves in order, one per action.
- **A move it cannot use** (its part is bound, it is a telegraphed move that was never wound up, it would raise a Guard it is not allowed) is swapped for a weighted pick among the phase's other moves. With nothing usable it makes a basic attack, which no bind can seal.
- **Everyone else** picks by weight among usable moves: 3 for a move that deals damage, 2 for one that only carries stress or a debuff, 1 for a buff somebody still needs, 6 for a move that would mend a broken formation. A move already used this turn counts a quarter.
- **Targets.** Provoked, then Taunt, then anyone not Hidden, picked at random. Madam Parity aims at the highest current HP among those she is allowed to aim at. A move that cannot miss ignores taunts and is never redirected.
- Enemies do not Struggle, flee by choice, or use items.

### 8.6 How a boss fight is structured

1. **Actions.** A boss takes `actions` actions a turn, in script order.
2. **Phases.** After any damage to the boss, if its HP is at or under the next `phases[].at`, the phase changes: the beat carries the phase's own `text`, the script restarts at its first row on the boss's next turn, a once-per-phase contraption is cocked again, and a wind-up in progress is dropped. A phase change fires no stress of its own.
3. **Wind-up and telegraph.** A move tagged `windup` announces the move whose `telegraph.by` names it and sets the round it is due. That move fires as the boss's first action in that round. It is cancelled the moment a bind lands on the move's part, or the contraption goes off with a `windup_cancelled` effect, or the party concedes.
4. **Moves that cannot miss.** `auto: true` skips the roll, so there is no dodge, bounce or fumble. Their effects land on whoever they name.
5. **The contraption.** A Chaos Wave sets it off. Its `effects` are applied as written: `damage` by `hpPct` of max HP, a `bind` with no contest and no bind resistance, a `status`, bonus `gold`. `uses` is respected.
6. **The concession.** Once the boss is at or under `concession.at` percent HP, `legalActions` offers `concede`. It ends the fight as a win with full rewards and charges `concession.effects`: stress on Valerie through her filter, Limit, and the Party Trust and Hero Rep changes, which the runner reports in `state.story` for the campaign to apply. Bolgrim takes it from any hero. Vellum takes it from Valerie, Thinking It Through. Madam Parity takes it from a Total Airhead whose ledger is not flipped, for 100 Limit.

### 8.7 The status registry

One table in `battle.js`, `STATUS_HOOKS`, says what every status does. The loop reads the hooks; it never asks for a status by name except through this table. Durations count the bearer's own turns and tick at the end of each.

| Status | What the runner does with it |
| --- | --- |
| `guard` | damage taken ×0.5; ends at the start of the granter's next turn (a longer one runs to the end of that many rounds) |
| `fortified` | damage taken ×0.5 |
| `bulwark` | damage taken ×0.5; every attack aimed at an ally lands here; an area attack lands here once |
| `covered` | single-target attacks land on the coverer instead |
| `counter` | answers each melee attack rolled against it with a free basic attack |
| `taunt` | enemies must aim single-target moves here |
| `provoked` | must aim single-target moves at whoever applied it |
| `hidden` | cannot be singled out while an ally stands; +20 crit on its next attack; ends when it attacks |
| `marked` | attacks against it get +15 crit |
| `exposed` | damage taken ×1.25 |
| `focused` | attacks against it get +10 to hit; its next damaging skill deals ×1.5; ends when that skill is used |
| `analyzed` | attacks against it get +20 to hit |
| `sitting_out` | loses its next turn, then ends; cannot Guard |
| `all_nighter` | skills cost no MP; head bound for 2 turns when it ends |
| `guard_broken` | removes guard when it lands; cannot Guard; ends with the round |
| `ward_fire` | fire affinity steps down one: weak to normal, normal to resist |
| `ward_ice` | ice affinity steps down one: weak to normal, normal to resist |
| `ward_bolt` | bolt affinity steps down one: weak to normal, normal to resist |
| `ward_holy` | holy affinity steps down one: weak to normal, normal to resist |
| `ward_dark` | dark affinity steps down one: weak to normal, normal to resist |
| `rattled` | set by `enemyStressEvent` in stress.js |
| `routed` | set by `enemyStressEvent` in stress.js |
| `extra_slippery` | sets `flags.extraSlippery` for valerie.js |
| `good_hero` | her passives read the gauge as 100 and planned skills ignore their band; the Airhead gauge resets to 50 when it ends |
| `auto_crit_next_think` | her next planned skill that hits is a crit, then this ends |
| `plot_armor` | a marker: the rule lives on the skill (Plot Armor) |
| `proof_wound` | a marker that lives as long as the wind-up does |
| `draft_begun` | a marker that lives as long as the wind-up does |
| `bell_rung` | a marker that lives as long as the wind-up does |
| `windup_cancelled` | instant: cancels a wound-up move |
| `vindicated` | instant: ends the fight as a win |
| `on_the_record` | instant: ends the fight as a win |
| `lucky_once` | instant: ends the fight as a win |
| `book_exposed` | removes guard when it lands; cannot Guard |
| `ledger_flipped` | sets `flags.ledgerFlipped` for valerie.js |
| `ledger_restored` | instant; removes ledger_flipped |
| `buffs_repossessed` | instant: moves every hero buff to the user for the stated turns |
| `surprised` | loses its next action, then ends |
| `lose_next_action` | loses its next action, then ends |
| `formation_broken` | removes guard when it lands; cannot Guard |
| `formation_reformed` | instant; removes formation_broken |
| `gate_shut` | halves the front of every enemy kind, never under one |

### 8.8 Events: the dice line and the paragraph

Everything that happens is an **event**: a plain object with a `type`, the ids and names involved, its numbers, and two strings.

- `line` is the mechanics in one line, dice first.
- `text` is a paragraph of one to three sentences, present tense. "You" are the person inside Valerie. When she wings it a success reads as an accident; when you think, it reads as competence.

`formatLog(events)` prints the line, a blank line, the paragraph, a blank line. The story stands apart from the arithmetic.

Each kind of beat has several ways of being told. The battle keeps one counter for each family of sentence and deals the variants in turn, starting from a place the first initiative roll decides, so the same sentence never comes up twice running and the same fight always reads the same.

| `type` | When | Fields beyond `seq`, `round`, `line`, `text` |
| --- | --- | --- |
| `start` | the battle begins | `name`, `kind`, `level`, `heroes`, `enemies`, `scene` |
| `round` | a round begins | `order` (names), `first` |
| `stance` | Valerie acts | `stance`, `gaugeBefore`, `gaugeAfter`, `stressBefore`, `stressAfter` |
| `skill` | a skill or move that rolls nothing is used | `actor`, `skill`, `skillName`, `auto`, `cost`, `targetLabel` |
| `attack` | one d100 against one target | `actor`, `target`, `skill`, `roll`, `hitPct`, `critPct`, `fumbleFrom`, `outcome` (hit, crit, miss, fumble, bounce), `dodged`, `damage`, `reflected`, `selfBind`, `hpBefore`, `hpAfter`, `affinity`, `guarded`, `redirect`, `counter`, `autoCrit`, `wave`, `limitGain` |
| `bind` | a bind lands, or a pure bind skill is rolled | `target`, `part`, `turns`, and `roll`, `pct`, `success`, `fumble`, `backfire` when it was rolled; `riding`, `self`, `source` |
| `damage` | damage with no roll | `target`, `amount`, `source` (dot, contraption, jackpot, meltdown), `hpBefore`, `hpAfter` |
| `heal` | HP comes back | `actor`, `target`, `amount`, `refused`, `source`, `hpBefore`, `hpAfter` |
| `stress` | stress lands on a group | `base`, `source`, `flat`, `reason`, `targets: [{ id, name, taken, before, after, noticed, gaugeBefore, gaugeAfter }]`, `allyRelief` |
| `relief` | stress comes off a group | `amount`, `reason`, `targets: [{ id, name, relieved, refused, before, after }]` |
| `resolve` | a Resolve Check | `target`, `roll`, `virtuePct`, `kind`, `entryId`, `entryName`, `permanent`, `personal`, `partyStress` |
| `act_out` | the turn check | `target`, `roll`, `pct`, `outcome`, `actId`, `actName`, `stateName` |
| `breakdown` | 200 stress | `target`, `choice`, `forced`, `out`, `partyStress`, `mark` |
| `calm` | an Affliction ends | `target`, `stateName`, `mark` |
| `status`, `mod` | a status or an attribute change lands | `status` or `stat` and `mult`, `turns`, `targets`, `blocked`, `refused` |
| `expire` | timed things run out | `target`, `what` |
| `cleanse`, `revive`, `limit`, `airhead`, `pay`, `plot_armor` | the effect of that name | the target and its numbers |
| `chaos_wave` | her fumble while Winging It | `roll`, `jackpot`, `enemies`, `guardsBroken`, `limitBefore`, `limitAfter` |
| `contraption` | the arena goes off | `name`, `uses` |
| `phase` | a boss changes phase | `actor`, `phase`, `phaseName`, `phaseText`, `at`, `hp`, `maxHp` |
| `telegraph`, `cancel` | a move is wound up, or called off | `actor`, `move`, `moveName`, `due`, `part`, `reason` |
| `skip` | a turn or an action is lost | `actor`, `reason`, `actions` |
| `enemy_stress` | an enemy is Rattled or Routed | `target`, `status`, `defeated`, `loseTurn` |
| `defeat` | someone is out | `target`, `by`, `routed`, `boss` |
| `guard`, `breather`, `concede` | that action | `actor` and its numbers |
| `end` | the battle is over | `result` (win, loss), `outcome` (victory, concession, defeat), `rounds`, `rewards`, `story` |

The narrator has prose for 35 event types.

### 8.9 A worked example

The reference party at level 12 against Bolgrim Underbridge, seed 4, default policy. These are 8 consecutive beats from round 3, printed by `formatLog`. Valerie is at Airhead 80, so his hit ceiling against her is 63.

```text
[d100 63 vs 82, crit ≤26, fumble 96+: hit] Rogue → Bolgrim Underbridge · Cheap Shot · 2,093 damage (HP 125,500 → 123,407)

Rogue finds the gap and Cheap Shot goes through it for 2,093.

[no roll: cannot miss] Bolgrim Underbridge · Bridge-Shaking Bellow → all heroes

Bolgrim Underbridge uses Bridge-Shaking Bellow. A roar that shakes the planks.

[stress 10 horror] Bolgrim Underbridge → Warrior +9 (5 → 14), Mage +9 (4 → 13), Rogue +9 (6 → 15)

Warrior, Mage and Rogue take a step back without deciding to.

[stress 10 horror: not noticed] Valerie · 0 taken · allies shed 3

You smile politely at the horror, since it seems to want something. The party watches you do it and breathes out.

[d100 56 vs 63, crit ≤1, fumble 88+: bounce] Bolgrim Underbridge → Valerie · Exact Change · the shot returns for 3,449 · taunt, Limit +10

Every eye is on you, as requested. You think you bounced it off, and you are not wrong: Bolgrim Underbridge's Exact Change comes straight back for 3,449.

[d100 96 vs 75, crit ≤9, fumble 96+: fumble] Warrior → Bolgrim Underbridge · Cleave · fumble

Warrior's Cleave goes badly enough that Bolgrim Underbridge stops to watch. Nothing is hurt except Warrior's pride.

[stress 6 embarrassment] Warrior +6 (11 → 17) · fumble

Warrior would like everyone to forget that immediately.

[Wing It] Valerie · Airhead 80 → 90 · stress 14 → 12

You let go of the wheel and let her body get on with it. Airhead 90, and a little less to worry about.
```

The fight these beats come from ended in a win by concession in round 20, after 276 beats.

### 8.10 What it does over many fights

The reference party of four at the boss's own level, no gear and no items, default policy, 200 seeds each, stopped at 60 rounds. The columns from Dodges on are the average per fight.

| Boss | Level | Won outright | Won by concession | Lost | Timed out | Rounds | Boss HP left on a loss | Dodges | Bounces | Enemy fumbles | Chaos Waves | Contraptions | Resolve Checks | First Resolve Check (round) | Heroes downed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Bolgrim Underbridge** | 12 | 0 | 96 | 104 | 0 | 16.8 | 46.3% | 3.3 | 1.3 | 2.2 | 1.9 | 1.3 | 0.9 | 15.9 | 2.6 |
| **Imara Vellum** | 50 | 0 | 92 | 108 | 0 | 24.1 | 50.4% | 6.2 | 1.7 | 3.8 | 2.4 | 1.4 | 2.3 | 14.7 | 2.1 |
| **Madam Parity** | 100 | 0 | 0 | 200 | 0 | 20.7 | 64.5% | 4.2 | 3.0 | 2.8 | 0.8 | 0.6 | 3.3 | 12.5 | 5.1 |

Section 5 says no boss can be raced, and the runner agrees: with no items and no gear this party never wins by damage alone. The fights it wins end at the concession. Madam Parity's concession needs Valerie to be a Total Airhead holding 100 Limit once the boss is at 25% HP, and this party never gets her there.

The five encounters, the same party, 200 seeds at each level:

| Encounter | Level | Won | Rounds | Heroes downed | Chaos Waves | Bounces | Beats |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Goblin Scouts | 5 | 200 | 1.1 | 0.0 | 0.1 | 0.0 | 13.7 |
| Goblin Scouts | 20 | 200 | 1.3 | 0.0 | 0.0 | 0.0 | 14.3 |
| Goblin Scouts | 50 | 200 | 1.2 | 0.0 | 0.0 | 0.0 | 14.3 |
| Bandit Archers | 5 | 200 | 2.1 | 0.0 | 0.5 | 0.3 | 33.6 |
| Bandit Archers | 20 | 200 | 2.4 | 0.0 | 0.3 | 0.8 | 36.7 |
| Bandit Archers | 50 | 200 | 2.1 | 0.0 | 0.1 | 0.6 | 34.8 |
| Skeleton Phalanx | 5 | 200 | 2.1 | 0.0 | 0.8 | 0.2 | 60.6 |
| Skeleton Phalanx | 20 | 200 | 2.8 | 0.0 | 0.5 | 0.4 | 67.0 |
| Skeleton Phalanx | 50 | 200 | 2.3 | 0.0 | 0.3 | 0.3 | 62.6 |
| The Hoard Drake | 5 | 199 | 6.1 | 0.2 | 1.1 | 0.0 | 82.1 |
| The Hoard Drake | 20 | 198 | 6.4 | 0.2 | 0.7 | 0.6 | 88.1 |
| The Hoard Drake | 50 | 200 | 5.9 | 0.1 | 0.6 | 0.5 | 80.0 |
| The Horde at the Gate | 5 | 200 | 3.0 | 0.0 | 1.6 | 0.4 | 100.3 |
| The Horde at the Gate | 20 | 200 | 3.6 | 0.0 | 0.9 | 1.0 | 113.1 |
| The Horde at the Gate | 50 | 200 | 2.5 | 0.0 | 0.7 | 0.7 | 105.1 |

Encounters end sooner here than section 5.6 estimates. That table assumes a row attack catches three enemies; the runner treats a side as one row, so Cleave and Big Swing reach everyone at the front.

### 8.11 What is supported, and what is not

| Thing | In the data | The runner resolves |
| --- | ---: | ---: |
| Class and hero skills | 70 | 69 |
| Boss and encounter moves | 51 | 51 |
| Statuses, across the three registries | 43 | 42 |
| Passives | 22 | 18 |
| Scripted class skills | 8 | 8 |
| Effect kinds | 10 | 10 |

Nothing is faked. What the runner does not resolve is never offered as a live choice and never picked by an enemy: a skill comes back from `legalActions` greyed out with its reason, a move is left out of the AI's choice, and `supportReport(data)` and `state.unsupported` list them.

| Kind | What | State |
| --- | --- | --- |
| Skill | **Found It!** (`val_found_it`) | the Pocket Dimension is not in the runner yet. Offered greyed out with that reason. |
| Status | **Rummaging** (`pocket_found_check`) | the Pocket Dimension is not in the runner yet. |
| Passive | **Share the Shield** (`war_p_share_the_shield`) | Carried on the sheet, does nothing in the runner. |
| Passive | **I Told You So** (`mag_p_i_told_you_so`) | Carried on the sheet, does nothing in the runner. |
| Passive | **Chain of Thought** (`mag_p_chain_of_thought`) | Carried on the sheet, does nothing in the runner. |
| Passive | **Quartermaster** (`any_p_quartermaster`) | Carried on the sheet, does nothing in the runner. |
| Mechanic | Items in battle: use, the thrown model, share-and-ceiling healing, seeds, gear (so Loot Goblin's "Mine" always falls back to Guard) | Not in the runner. |
| Mechanic | Valerie's Pocket Dimension (Missing items, the Found check) and her skill Found It! | Not in the runner. |
| Mechanic | The contraption's `manual` hard check (setting it off on purpose) | Not in the runner. |
| Mechanic | Event `advantage` (the lever already pulled, the militia on the flanks) | Not in the runner. |
| Mechanic | Positions: Bolgrim's nearest and furthest hero, Vellum's choice of whom to correct (targets are picked at random among those allowed) | Not in the runner. |
| Mechanic | Rows inside a side: a side is one row unless combatants carry `row` | Not in the runner. |
| Mechanic | Encounter rules written in prose only: the last goblin runs, the hoplites stop locking shields without their Captain, the raiders ease off without their drummers | Not in the runner. |
| Mechanic | The Struggle action, fleeing, and swapping who is in the fight | Not in the runner. |
| Mechanic | General passive slots (a hero carries whatever `passives` the caller lists) and "once per rest" rules | Not in the runner. |
| Mechanic | Standard stress sources on enemies, and the out-of-battle sources (ambushed, fled, long_haul) | Not in the runner. |
| Mechanic | Refusing a helpful status (a hero who refuses buffs turns away attribute buffs only), and hiding affinities until they are "revealed" | Not in the runner. |

Choices the runner had to make where the data is silent:

- **A side is one row** unless a combatant carries `row`.
- **Enemies behind the front cannot be reached.** `acting` is read as who is in the fight, not only who acts.
- **`allies` includes the user**, as Shield Wall's text says and Group Project's exception implies.
- **An `airhead` effect is always the user's own gauge**, hit or miss. Accidentally Legendary's effect names no target.
- **Guard.** A Guard for one turn ends at the start of its granter's next turn. A Guard a move gives for more turns runs to the end of that many rounds, which is how Re-shelve reads.
- **The Breakdown choice and the choice to pay MP instead of taking stress** are given before they are needed: on the action, or in `setup.options`. The defaults are Storm Off, and pay only when stress is 60 or more.
- **The standard stress sources fire on heroes only.** A horde would rout itself on its own casualties otherwise.
- **A meltdown that costs HP leaves at least 1.**
- **Multipliers on a hit against Valerie** (Exposed, Trussed, a Guard someone gave her) are applied to the figure `enemyAttacksValerie` returns, because that one call has no slot for them.
