## 5. PROGRESSION BOSS ARCHITECTURE

Three bosses anchor the difficulty curve, and five standard encounters give the story events somewhere to hand off to. The data is `data/bosses.json` and `data/encounters.json`. `test/bosses.test.js` pins the rules on this page. Every number below was printed by running that data through `engine/combat.js`, `engine/progression.js` and `engine/valerie.js`; none was estimated.

### 5.1 The curve at a glance

| Boss | Stage | Level | Rank | HP | Actions per round | Rounds to kill, basic attacks | Rounds to kill, Power 4 | Party HP lost per round | Rounds the party lasts unhealed | First Resolve Check, no relief (round) | EXP each | Gold |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Bolgrim Underbridge** | early | 12 | boss | 129,600 | 2 | 39 | 17 | 9.4% | 10.6 | 24.9 (Warrior) | 18,000 | 3,600 |
| **Imara Vellum** | mid | 50 | boss | 2,500,000 | 2 | 51 | 23 | 10.1% | 9.9 | 16.5 (Warrior) | 75,000 | 15,000 |
| **Madam Parity** | superboss | 100 | superboss | 22,200,000 | 3 | 107 | 48 | 12.7% | 7.9 | 19.8 (Warrior) | 500,000 | 100,000 |

"Rounds to kill" is the reference party of four acting every round with nothing but that attack. HP pressure rises gently (9.4%, 10.1%, 12.7% of the party's combined HP per round). Stress pressure rises faster: the first Resolve Check moves from round 24.9 to round 16.5 while the fights get longer. In every fight the unhealed party falls in well under half the rounds it needs to win, so no boss can be raced.

Bolgrim Underbridge is level 12, not 10, because Inspirational Ignorance unlocks at 12: he is the first fight in which all six of Valerie's accidents are online, and he is built to test each one.

### 5.2 Rules every boss follows

- **One question per phase.** Each phase changes one thing and asks the party one thing. Every phase in the data carries `question`, `answer` and `price`: what is being asked, a way through, and what that way costs.
- **A want and a cost.** Each boss has an `identity`, a `want` and a `cost`, and a **concession**: in the last phase the party can give the boss what it wants and end the fight as a win. The concession is never free, and it is always paid in something Valerie needs.
- **Built for the hero.** Every boss has a projectile attack from phase 1 (Kinetic Deflection), fear from phase 1 (Inspirational Ignorance: she ignores it, the party does not), a realization move by phase 2 that cannot miss (the truth is the one thing she cannot shrug off), and an arena contraption that an Accidental Chaos Wave sets off.
- **Winging it or thinking it through.** Bosses are accurate, so Unintentional Dodge is worth the most against them, and each one has a mechanic that only planning answers reliably. The player is meant to want both ends of the gauge in the same fight.
- **Stress is a second health bar.** Each boss has at least three stress moves from at least three sources. Stress amounts are written flat, because stress does not scale with level; Willpower does the scaling.
- **Nothing unannounced kills.** A single-target move tops out at Power 8 and a row or all-target move at Power 4, and no such move can drop any reference hero from full HP even on a crit at maximum variance. The one move per boss that can is telegraphed at least a round ahead, can be cancelled at least two ways, and never kills a hero who Guards from full HP.

Things the data says beyond the FOUNDATION Skill shape:

| Field | Where | Meaning |
| --- | --- | --- |
| `actions` | boss, enemy | Actions per round. A boss acts this many times; the round scripts list them in order. |
| `script` | phase | A repeating cycle of rounds, each a list of move ids. It is the boss's default behaviour and the thing the simulation measures. |
| `question`, `answer`, `price` | phase | The choice the phase forces, for the designer and the game master. |
| `auto: true` | move | No attack roll. The move cannot miss, be dodged, bounce or fumble. Speech and roars work this way. |
| `telegraph` | move | The move is tagged `telegraphed`: `by` names the wind-up move, `rounds` is the warning, `cancel` lists what stops it. |
| `target` on an effect | effect | Omitted: whoever the move hit. `valerie`: the hero only. `others`: every hero but her. `heroes`: every hero, whether the move hit or not. `self`: the user. |
| `orPay` | stress effect | The target may pay that share of max MP instead of taking the stress. |
| `uses`, `manual` | contraption | How often it can go off, and the Think It Through check that sets it off on purpose. |
| `concession` | boss | The way to give the boss what it wants: `at` (HP percent it opens at), `text`, `price`, `effects`. |
| `acting` | enemy | How many of that enemy can act in one round. The rest wait their turn behind the front. |
| `statuses` | file | The registry of every status id the file uses, one exact line each. |

How the simulation reads a fight:

- **The party** is the Warrior, Mage and Rogue from `data/archetypes.json` and the Klutz Knight from `data/valerie.json`, at the boss's level, with no gear and full bars.
- **Party offense** is `expectedDamage` per action. "Basic" is the Power 2 basic attack from everyone. "Power 4" is a typical Power 4 skill: Might for the Warrior, Rogue and Valerie, an Arcana spell at neutral affinity for the Mage.
- **Valerie** Wings It at Airhead 60, her starting gauge, unless a table says otherwise. Enemy attacks on her go through `incomingOpts` and `readIncoming`: the lowered hit ceiling, the bounce band and the widened fumble band.
- **Boss offense** averages each phase's script over its cycle. An aimed attack is spread evenly (a quarter each), a row attack catches the front row (Warrior, Valerie) or the back row (Mage, Rogue) half the time each, and an all-target move rolls against everyone. All 100 faces of the d100 are counted, so these are exact expectations, not samples.
- **Telegraphed moves** are left out of the per-round figures and shown on their own line, as if nobody answered them.
- **Phases** are weighted by their share of the HP bar.
- **Stress** is `stressTaken` for the allies and `stressOnValerie` for the hero, with the 3 points allies shed whenever she shrugs off fear. It counts stress from boss moves only. The standard sources in section 3 (a crit taken, an ally down, low HP) come on top.

### 5.3 Bolgrim Underbridge, the Troll Who Was There (early game)

`boss_bolgrim`. A river troll the size of a hay cart: moss on his shoulders, reading spectacles on a chain, and a toll signpost for a club.

#### Who he is

|  |  |
| --- | --- |
| **Identity** | A toll-bridge troll chieftain who watched Valerie rout his whole warband by falling over, and has told the true story to everyone since without being believed once. |
| **Want** | To hear one person, any person, say out loud that she tripped. |
| **Cost** | His warband walked out on the chief who lost to a pratfall, and every toll he has taken since has gone into a machine built to prove it was an accident. |
| **Arena** | Underbridge Toll: a narrow stone bridge over a gorge, an iron toll box, and Exhibit A cocked and creaking at the far end. |
| **Pronouns** | he/him |

#### Stat block and HP pool

|  | Level | Rank | STR | INT | AGI | CON | WIL | LCK | HP | MP | Actions per round |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Bolgrim Underbridge** | 12 | boss | 96 | 36 | 80 | 54 | 58 | 52 | 129,600 | 696 | 2 |
| × benchmark (76) |  |  | 1.26 | 0.47 | 1.05 | 0.71 | 0.76 | 0.68 | 0.71 of 182,400 |  |  |

HP is `maxHp(12, 54, 'boss')` = 10 × 12 × 54 × 20. The second row reads each attribute against `benchmarkStat(12)`, and the pool against a boss at benchmark Constitution.

#### Affinities and bind resistances

| Element | phys | fire | ice | bolt | holy | dark |
| --- | --- | --- | --- | --- | --- | --- |
| Affinity | normal | weak | resist | normal | normal | normal |

| Part | Bind resist | What a bind on it seals |
| --- | --- | --- |
| head | 30% | Bridge-Shaking Bellow, I Was There |
| arms | 50% | Toll Collector, Bridge Sweep, Exact Change, Wind the Proof, The Proof |
| legs | 20% | nothing |

Bind resist is the percentage taken off a bind's chance (`engine/binds.js`). A bound part also halves its attributes: arms halve Might, head halves Arcana and Willpower, legs halve Finesse.

#### Phases

| From HP | Phase | Read to the table | The question | An answer | What the answer costs |
| --- | --- | --- | --- | --- | --- |
| 100% | **Pay the Toll** | He blocks the bridge, clubs whoever stands closest and throws the toll box at whoever stands furthest. Decide who holds the bridge mouth: the hero he keeps missing, or the warrior he does not. | Who stands in front? | Put Valerie in his way with Stand Behind Me! and keep her Winging It: his swings miss, his toll box comes back, and he trips over himself. | A Valerie who is Winging It lands fewer aimed hits and has no planned skills, so the fight runs longer. |
| 60% | **I Was There** | He stops fighting quietly and starts telling everyone exactly what he saw. Every telling knocks 10 off the Airhead gauge and rattles the party: decide whether to shut him up or out-oblivious him. | Do you let him talk? | Bind his head to seal both the telling and the bellow, or keep Winging It so the gauge climbs back as fast as he knocks it down. | A head bind is a turn not spent on damage and may not take; Winging It gives up planned skills; Thinking It Through stacks its own stress on top of his. |
| 30% | **The Proof** | He winds Exhibit A, and one round later it fires at everyone. Stop the machine, brace for it, or give him the one thing he actually wants. | Stop the machine, weather it, or tell him he is right? | Bind his arms in the round he winds it, let a Chaos Wave set Exhibit A off in his face, have everyone Guard, or concede (Tell Him He Is Right). | A bind or a wave may not come in the one round you have; Guarding costs the whole party a turn and switches off Valerie's dodge; conceding is paid for in her nerve. |

Round scripts. Bolgrim Underbridge takes 2 actions a round in the order listed, and repeats the cycle until the phase changes.

- **Pay the Toll:** round 1: Toll Collector, Exact Change; round 2: Bridge Sweep, Toll Collector; round 3: Bridge-Shaking Bellow, Exact Change.
- **I Was There:** round 1: I Was There, Toll Collector; round 2: Bridge Sweep, Exact Change; round 3: Bridge-Shaking Bellow, Toll Collector.
- **The Proof:** round 1: Wind the Proof, Toll Collector; round 2: The Proof, I Was There; round 3: Bridge Sweep, Exact Change; round 4: Bridge-Shaking Bellow, Toll Collector.

#### Moves

| Move | Kind | Power | To hit | Target | Part | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Toll Collector** | physical, STR | 5 | +10 | one | arms | melee | none | Swings the PAY TROLL signpost at one hero: Power 5 physical, +10 to hit. |
| **Bridge Sweep** | physical, STR | 3.2 | +5 | row | arms | melee, embarrassment | 5 embarrassment | Sweeps one row onto its backside: Power 3.2 physical, +5 to hit; each hero hit takes 5 embarrassment stress and has a 30% chance of a legs bind for 2 turns. |
| **Exact Change** | physical, STR | 5.5 | +5 | one | arms | ranged, projectile, wound | 5 wound | Hurls the iron toll box at one hero, by choice the one furthest away: Power 5.5 physical projectile, +5 to hit, and 5 wound stress if it lands. |
| **Bridge-Shaking Bellow** | stress | n/a | auto | all | head | horror, cannot miss | 10 horror | A roar that shakes the planks. Cannot miss: 10 horror stress to every hero. |
| **I Was There** | stress | n/a | auto | all | head | realization, mental, cannot miss | 12 realization (Valerie only); 5 mental (everyone but Valerie) | Describes, accurately and in detail, how she tripped. Cannot miss: Valerie takes 12 realization stress (ignores Willpower, Airhead −10) and every other hero takes 5 mental stress. |
| **Wind the Proof** | utility | n/a | auto | self | arms | windup, horror, cannot miss | 6 horror (every hero, hit or not) | Cranks Exhibit A, loudly. Cannot miss: 6 horror stress to every hero, and The Proof fires as his first action next round unless his arms are bound or the machine is set off first. |
| **The Proof** | physical, STR | 9 | +15 | all | arms | telegraphed, ranged, projectile | none | Telegraphed one round ahead by Wind the Proof. Exhibit A fires every log at once: Power 9 physical projectile at every hero, +15 to hit. Guarding halves it. |

Stress as it lands on the level 12 reference party, after Willpower and after Valerie's filter:

| Move | Base | Warrior | Mage | Rogue | Valerie, Lucid | Valerie, Ditzy | Valerie, Total Airhead |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bridge Sweep | 5 embarrassment | 5 | 4 | 5 | 7 | 7 | 0 |
| Exact Change | 5 wound | 5 | 4 | 5 | 5 | 5 | 5 |
| Bridge-Shaking Bellow | 10 horror | 9 | 9 | 9 | 9 | 0 | 0 |
| I Was There | 12 realization | n/a | n/a | n/a | 12 | 12 | 12 |
| I Was There | 5 mental | 5 | 4 | 5 | n/a | n/a | n/a |
| Wind the Proof | 6 horror | 6 | 5 | 6 | 6 | 0 | 0 |

#### Contraption and concession

**Exhibit A** (once per phase). A rack of counterweighted logs Bolgrim built to prove nobody crosses his bridge by skill. When a Chaos Wave sets it off it swings the wrong way: Bolgrim takes damage equal to 4% of his max HP, his legs are bound for 2 turns, and a wound-up Proof is cancelled. Works once per phase; he re-cocks it when the phase changes. Any hero may spend a turn tripping the release on purpose: a hard check, and a failure wastes the turn.

**Tell Him He Is Right** (from 30% HP). At 30% HP or below, any hero can spend a turn saying it out loud: she tripped. Bolgrim sits down on his bridge, the fight ends as a win with full rewards, and he waves the party across. *The price:* Valerie takes 25 realization stress (it ignores Willpower and drops the gauge 10) and Party Trust falls by 5.

#### Tactics, counterplay, rewards

- **Tactics.** Two actions a round. Toll Collector goes to the nearest hero and Exact Change to the furthest; a taunt overrides both. From Phase 2 he opens every third round with I Was There. In Phase 3 he winds The Proof every fourth round and fires it first thing the round after.
- **Counterplay.** Let him swing at Valerie while she is Winging It: his hit ceiling drops, his toll box bounces back and his fumbles bind him. Bind his head to stop the truth-telling and his arms to stop The Proof, or let a Chaos Wave set Exhibit A off in his face; fire hurts him. If the party's nerve is running out, admit she tripped: it ends the fight and costs Valerie 25 stress.
- **Against the hero's kit.** Bolgrim is the exam for the six accidents: an accurate brute who is at his worst swinging at a Total Airhead, and whose only real weapon against her is the truth.
- **Rewards.** 18,000 EXP to each party member and 3,600 gold: `expYield(12, 'boss')` and `goldYield(12, 'boss')`. No item ids are named yet.

#### Simulation

Reference party at level 12, no gear:

| Hero | STR | INT | AGI | CON | WIL | LCK | HP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 98 | 40 | 67 | 103 | 41 | 80 | 12,360 |
| Mage | 55 | 98 | 56 | 62 | 103 | 56 | 7,440 |
| Rogue | 75 | 40 | 103 | 60 | 52 | 98 | 7,200 |
| Valerie | 80 | 40 | 60 | 92 | 52 | 103 | 11,040 |

**Party offense.** Expected damage per action, counting misses, fumbles and crits. Valerie is Winging It at Airhead 60.

| Hero | Hit % | Crit % | Basic attack, plain hit | Landed basic hits to kill | Basic attack, expected | Power 4, expected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 75 | 9 | 1,382 | 94 | 1,099 | 2,198 (skill) |
| Mage | 70 | 6 | 664 | 196 | 485 | 1,987 (spell) |
| Rogue | 82 | 11 | 992 | 131 | 868 | 1,737 (skill) |
| Valerie | 76 | 12 | 1,076 | 121 | 882 | 1,765 (skill) |
| **Party per round** |  |  |  |  | **3,334** | **7,688** |
| **Rounds to kill** |  |  |  |  | **39** | **17** |

With every hero on Power 8 skills the fight would take 9 rounds.

**Boss offense.** Share of each hero's max HP lost per round, telegraphed moves left out. Valerie at Airhead 60.

| Phase | Share of HP bar | Warrior | Mage | Rogue | Valerie | Whole party |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Pay the Toll | 40% | 8.6% | 17.8% | 15.7% | 7.6% | 11.4% |
| I Was There | 30% | 6.9% | 14.3% | 12.6% | 6.4% | 9.3% |
| The Proof | 30% | 5.2% | 10.7% | 9.5% | 4.8% | 7.0% |
| **Whole fight** | 100% | **7.0%** | **14.6%** | **12.9%** | **6.4%** | **9.4%** |
| **Rounds survived unhealed** |  | **14.2** | **6.8** | **7.7** | **15.6** | **10.6** |

**Worst single hit from full HP.** Plain hit, then a crit at variance 1.1, as a share of max HP. For telegraphed moves the third figure is that same worst crit against a Guard.

| Move | Power | Target | Warrior | Mage | Rogue | Valerie |
| --- | --- | --- | --- | --- | --- | --- |
| Toll Collector | 5 | one | 23% / 38% | 44% / 72% | 46% / 75% | 26% / 44% |
| Bridge Sweep | 3.2 | row | 15% / 24% | 28% / 46% | 29% / 48% | 17% / 28% |
| Exact Change | 5.5 | one | 25% / 41% | 48% / 80% | 50% / 83% | 29% / 48% |
| The Proof (telegraphed) | 9 | all | 41% / 68% / 34% | 79% / 130% / 65% | 82% / 136% / 68% | 48% / 79% / 39% |

**Stress pressure.** Stress gained per round from his moves alone, net of the 3 that allies shed each time Valerie shrugs off fear. No relief skills, no items, telegraphed moves left out.

| Phase | Warrior | Mage | Rogue | Valerie |
| --- | ---: | ---: | ---: | ---: |
| Pay the Toll | 3.3 | 3.1 | 3.2 | 1.2 |
| I Was There | 4.7 | 4.2 | 4.6 | 5.0 |
| The Proof | 4.3 | 3.6 | 4.2 | 3.8 |
| **Whole fight** | **4.0** | **3.6** | **3.9** | **3.1** |
| **Rounds to the Resolve Check (100)** | **24.9** | **27.8** | **25.5** | **31.8** |
| Whole fight, Valerie Lucid (Airhead 20) | 5.2 | 4.7 | 5.1 | 6.6 |

The Proof left unanswered every cycle would add 9.3% (Warrior), 19.2% (Mage), 17.2% (Rogue), 6.0% (Valerie) of max HP per round to the last phase.

**Against the hero's kit.** Enemy rolls against Valerie at three points on the gauge:

| Airhead | Band | Hit ceiling | Toll Collector: lands | Exact Change: lands | Exact Change: bounces back | Boss fumbles and binds itself |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 0 | Lucid | 95 | 84% | 73% | 6% | 5% |
| 60 | Ditzy | 71 | 71% | 50% | 21% | 11% |
| 100 | Total Airhead | 55 | 55% | 24% | 31% | 15% |

The same three gauges with Valerie taunting, so every aimed attack is hers, and what the gauge does to everyone's nerve:

| Airhead | She loses per round | Rounds she lasts unhealed | Bounced back per round | Boss self-binds per round | Her stress per round | Allies' net stress per round (W / M / R) | Her Power 4: Wing It | Her Power 4: Think It Through | Chaos Wave per Wing It action |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 27.4% | 3.7 | 98 (0.08% of his HP) | 0.07 | 6.6 | 5.2 / 4.7 / 5.1 | 1,765 | 2,142 | 5% |
| 60 | 21.9% | 4.6 | 344 (0.27% of his HP) | 0.15 | 3.1 | 4.0 / 3.6 / 3.9 | 1,765 | 2,142 | 17% |
| 100 | 15.1% | 6.6 | 508 (0.39% of his HP) | 0.21 | 2.2 | 4.0 / 3.6 / 3.9 | 1,744 | 2,142 | 25% |

One Power 3 heal from the reference mage restores 1,764 HP, 16.0% of Valerie's bar. That covers a taunting round at Airhead 100 and falls short at Airhead 0 and 60. Her stress columns are before her stance: Wing It takes 2 off every turn, Think It Through adds 4.

**Where he sits on the curve.** Bolgrim Underbridge takes 17 rounds of Power 4 skills or 39 of basic attacks. In that time he deals 1.6 times the party's combined HP, and the unhealed party lasts 10.6 rounds, so the fight cannot be raced. At the Power 4 pace his moves alone leave the Warrior on 68 stress and the Mage on 61: under the Resolve Check if the fight is clean, over it if it drags past round 24. This is the gentlest of the three on purpose. It asks whether the party has learned to stand behind Valerie: taunting as a Total Airhead she loses 15.1% of her bar a round instead of 27.4% Lucid.

### 5.4 Imara Vellum, the Unabridged (mid game)

`boss_vellum`. A tall lich in a chronicler's ink-stained robes, grey locs bound in archive ribbon, a quill behind one ear and a neat stitched seam where her heart came out.

#### Who she is

|  |  |
| --- | --- |
| **Identity** | The Royal Chronicler, three hundred years dead and still at her desk, who cannot rest while one ballad in the kingdom says something that did not happen. |
| **Want** | To publish a single true history of the realm, with no hero in it who did not earn the word. |
| **Cost** | She cut out her own heart so it would stop improving the stories, and now she remembers every fact and not one reason any of them mattered. |
| **Arena** | The Unabridged Archive: stacks forty feet high, a lectern, a card index the size of a chapel, and one very long ladder on brass rails. |
| **Pronouns** | she/her |

#### Stat block and HP pool

|  | Level | Rank | STR | INT | AGI | CON | WIL | LCK | HP | MP | Actions per round |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Imara Vellum** | 50 | boss | 180 | 370 | 330 | 250 | 420 | 280 | 2,500,000 | 21,000 | 2 |
| × benchmark (302) |  |  | 0.60 | 1.23 | 1.09 | 0.83 | 1.39 | 0.93 | 0.83 of 3,020,000 |  |  |

HP is `maxHp(50, 250, 'boss')` = 10 × 50 × 250 × 20. The second row reads each attribute against `benchmarkStat(50)`, and the pool against a boss at benchmark Constitution.

#### Affinities and bind resistances

| Element | phys | fire | ice | bolt | holy | dark |
| --- | --- | --- | --- | --- | --- | --- |
| Affinity | normal | weak | resist | normal | weak | absorb |

| Part | Bind resist | What a bind on it seals |
| --- | --- | --- |
| head | 65% | Shhh., The Stacks Remember, As It Actually Happened, Errata |
| arms | 40% | Sharp Correction, Strike Through, Dip the Quill, The Final Draft |
| legs | 25% | Re-shelve |

Bind resist is the percentage taken off a bind's chance (`engine/binds.js`). A bound part also halves its attributes: arms halve Might, head halves Arcana and Willpower, legs halve Finesse.

#### Phases

| From HP | Phase | Read to the table | The question | An answer | What the answer costs |
| --- | --- | --- | --- | --- | --- |
| 100% | **Quiet, Please** | She hides her heart-book in the stacks and takes half damage until it is found, while the shelves stare the party down. Decide how to find the book: have Valerie look closely, which costs gauge, or wait for her to knock it loose by accident. | Find the book, or flip the table? | Wait, Look Closely finds the heart-book every time and ends her Guard; a Chaos Wave strips the Guard and brings the Rolling Ladder down on her as well. | Looking closely is a Think action: gauge −15 and 4 stress each time, sliding Valerie toward Lucid, where the horror starts landing on her too. Waiting for an accident means hitting at half damage until one comes. |
| 65% | **Citation Needed** | She opens the ledger and reads true entries aloud: Valerie's first, then everyone's. The truth drops the gauge, and the embarrassment only misses a Total Airhead: decide whose nerve gets spent. | Whose nerve do you spend? | Keep Valerie a Total Airhead so Errata and the horror slide off her and the party sheds stress each time, or bind Vellum's head and seal every reading at once. | Each true entry knocks 10 off the gauge, so staying an Airhead means Winging It nearly every turn and never looking for the book; her head is her best-guarded part. |
| 30% | **The Final Draft** | She stops hiding the book because she is writing in it: the party's ending, due next round. Break the quill hand, bring the ladder down, brace for the last page, or give her a true account to print instead. | Break the quill, take the ending, or go on the record? | Bind her arms or set off the Rolling Ladder in the round she dips the quill; Guard if neither lands; or concede (Go on the Record). | Guarding halves the damage but not the 30 death stress; a failed bind is a wasted round; going on the record is paid for in Valerie's stress and her legend. |

Round scripts. Imara Vellum takes 2 actions a round in the order listed, and repeats the cycle until the phase changes.

- **Quiet, Please:** round 1: Re-shelve, Sharp Correction; round 2: Strike Through, Shhh.; round 3: The Stacks Remember, Sharp Correction; round 4: Strike Through, Sharp Correction.
- **Citation Needed:** round 1: As It Actually Happened, Sharp Correction; round 2: Errata, Strike Through; round 3: Re-shelve, Shhh.; round 4: The Stacks Remember, Sharp Correction.
- **The Final Draft:** round 1: Dip the Quill, Strike Through; round 2: The Final Draft, As It Actually Happened; round 3: The Stacks Remember, Sharp Correction; round 4: Errata, Strike Through.

#### Moves

| Move | Kind | Power | To hit | Target | Part | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Sharp Correction** | magical, INT | 5 | +10 | one | arms | ranged, projectile | none | Throws a quill like a dart at one hero: Power 5 projectile driven by Arcana and resisted by Willpower, +10 to hit. |
| **Strike Through** | magical, INT, dark | 6 | 0 | one | arms | melee | none | Draws a line through one hero: Power 6 dark magic and a 35% chance of an arms bind for 2 turns. |
| **Shhh.** | debuff | n/a | +10 | row | head | mental | 10 mental | One finger to her lips, aimed at a row at +10 to hit: each hero it lands on takes 10 mental stress and has a 45% chance of a head bind for 2 turns. |
| **The Stacks Remember** | magical, INT, dark | 2.5 | +5 | all | head | horror | 20 horror (every hero, hit or not) | Every face ever written down looks out of the shelves at once: Power 2.5 dark magic to each hero it lands on, and 20 horror stress to every hero whether it lands or not. |
| **Re-shelve** | buff | n/a | auto | self | legs | cannot miss | none | Hides her heart-book somewhere in the stacks: she Guards (takes half damage) until the end of next round, or until Valerie's Wait, Look Closely finds the book or a Chaos Wave knocks it loose. |
| **As It Actually Happened** | stress | n/a | auto | all | head | realization, mental, cannot miss | 16 realization (Valerie only); 10 mental (everyone but Valerie) | Reads Valerie's true entry aloud. Cannot miss: Valerie takes 16 realization stress (ignores Willpower, Airhead −10) and every other hero takes 10 mental stress. |
| **Errata** | stress | n/a | auto | one | head | embarrassment, cannot miss | 20 embarrassment | Reads out one hero's most embarrassing true entry. Cannot miss: 20 embarrassment stress (Valerie takes half again as much, unless she is a Total Airhead, who takes none). |
| **Dip the Quill** | utility | n/a | auto | self | arms | windup, death, cannot miss | 8 death (every hero, hit or not) | Writes the party's names at the top of a clean page. Cannot miss: 8 death stress to every hero, and The Final Draft lands as her first action next round unless her arms are bound or the Rolling Ladder is set off first. |
| **The Final Draft** | magical, INT, dark | 10 | +20 | all | arms | telegraphed, death | 30 death | Telegraphed one round ahead by Dip the Quill. She writes how the party ends and reads it out: Power 10 dark magic at every hero, +20 to hit, and 30 death stress to each hero it lands on. Guarding halves the damage, not the stress. |

Stress as it lands on the level 50 reference party, after Willpower and after Valerie's filter:

| Move | Base | Warrior | Mage | Rogue | Valerie, Lucid | Valerie, Ditzy | Valerie, Total Airhead |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Shhh. | 10 mental | 8 | 6 | 7 | 7 | 0 | 0 |
| The Stacks Remember | 20 horror | 16 | 12 | 15 | 15 | 0 | 0 |
| As It Actually Happened | 16 realization | n/a | n/a | n/a | 16 | 16 | 16 |
| As It Actually Happened | 10 mental | 8 | 6 | 7 | n/a | n/a | n/a |
| Errata | 20 embarrassment | 16 | 12 | 15 | 22 | 22 | 0 |
| Dip the Quill | 8 death | 6 | 5 | 6 | 6 | 6 | 6 |
| The Final Draft | 30 death | 24 | 18 | 22 | 22 | 22 | 22 |

#### Contraption and concession

**The Rolling Ladder** (once per phase). A forty-foot library ladder on brass rails that runs the length of the stacks. When a Chaos Wave sets it off it rolls the whole way: Vellum takes damage equal to 3% of her max HP, her arms are bound for 2 turns under a landslide of folios, a dipped quill is wasted, and her heart-book lands in plain sight, so she cannot Re-shelve for 2 rounds. Works once per phase. Any hero may spend a turn shoving the ladder on purpose: a hard check, and a failure wastes the turn.

**Go on the Record** (from 30% HP). At 30% HP or below, Valerie can spend a turn Thinking It Through to dictate what really happened at the mill, the chasm and the bridge. Vellum writes it down, closes the book, and the fight ends as a win with full rewards. *The price:* Valerie takes 30 realization stress (it ignores Willpower and drops the gauge 10), and Hero Rep falls by 10 once the corrected edition circulates.

#### Tactics, counterplay, rewards

- **Tactics.** Two actions a round. She opens with Re-shelve and repeats it every fourth round through Phases 1 and 2. Quills go to whoever is casting or healing, Strike Through to whoever hit her hardest; a taunt redirects her attacks, but readings (As It Actually Happened, Errata) ignore taunts. In Phase 3 she dips the quill every fourth round and reads The Final Draft first thing the round after.
- **Counterplay.** Find the heart-book whenever she Re-shelves it: Wait, Look Closely does it reliably and a Chaos Wave does it for free. Keep Valerie a Total Airhead through the readings so horror and embarrassment miss her and the party sheds stress, and bind Vellum's arms or drop the Rolling Ladder on her the round she dips the quill. Fire and holy hurt her; dark heals her.
- **Against the hero's kit.** Vellum pulls the gauge both ways at once: the book is found by Thinking, the readings are survived by not Thinking, and every true entry she reads moves Valerie 10 points toward the wrong one.
- **Rewards.** 75,000 EXP to each party member and 15,000 gold: `expYield(50, 'boss')` and `goldYield(50, 'boss')`. No item ids are named yet.

#### Simulation

Reference party at level 50, no gear:

| Hero | STR | INT | AGI | CON | WIL | LCK | HP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 384 | 153 | 262 | 404 | 153 | 313 | 202,000 |
| Mage | 212 | 384 | 213 | 243 | 404 | 213 | 121,500 |
| Rogue | 293 | 153 | 404 | 233 | 203 | 384 | 116,500 |
| Valerie | 313 | 153 | 233 | 363 | 203 | 404 | 181,500 |

**Party offense.** Expected damage per action, counting misses, fumbles and crits. Valerie is Winging It at Airhead 60.

| Hero | Hit % | Crit % | Basic attack, plain hit | Landed basic hits to kill | Basic attack, expected | Power 4, expected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 73 | 6 | 21,727 | 116 | 16,512 | 33,025 (skill) |
| Mage | 67 | 2 | 10,002 | 250 | 6,801 | 25,320 (spell) |
| Rogue | 80 | 8 | 15,403 | 163 | 12,939 | 25,878 (skill) |
| Valerie | 73 | 9 | 16,775 | 150 | 13,001 | 26,002 (skill) |
| **Party per round** |  |  |  |  | **49,253** | **110,225** |
| **Rounds to kill** |  |  |  |  | **51** | **23** |

With every hero on Power 8 skills the fight would take 12 rounds. If nobody ever finds the heart-book, the Guard stretches the Power 4 fight to 28 rounds.

**Boss offense.** Share of each hero's max HP lost per round, telegraphed moves left out. Valerie at Airhead 60.

| Phase | Share of HP bar | Warrior | Mage | Rogue | Valerie | Whole party |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Quiet, Please | 35% | 11.1% | 15.8% | 16.5% | 8.8% | 12.4% |
| Citation Needed | 35% | 7.8% | 11.1% | 11.7% | 6.2% | 8.7% |
| The Final Draft | 30% | 7.9% | 11.3% | 11.8% | 6.9% | 9.0% |
| **Whole fight** | 100% | **9.0%** | **12.8%** | **13.4%** | **7.3%** | **10.1%** |
| **Rounds survived unhealed** |  | **11.1** | **7.8** | **7.5** | **13.7** | **9.9** |

**Worst single hit from full HP.** Plain hit, then a crit at variance 1.1, as a share of max HP. For telegraphed moves the third figure is that same worst crit against a Guard.

| Move | Power | Target | Warrior | Mage | Rogue | Valerie |
| --- | --- | --- | --- | --- | --- | --- |
| Sharp Correction | 5 | one | 28% / 47% | 37% / 61% | 47% / 77% | 30% / 49% |
| Strike Through | 6 | one | 34% / 56% | 44% / 73% | 56% / 93% | 36% / 59% |
| The Stacks Remember | 2.5 | all | 14% / 23% | 18% / 30% | 23% / 39% | 15% / 25% |
| The Final Draft (telegraphed) | 10 | all | 57% / 94% / 47% | 74% / 122% / 61% | 93% / 154% / 77% | 60% / 99% / 49% |

**Stress pressure.** Stress gained per round from her moves alone, net of the 3 that allies shed each time Valerie shrugs off fear. No relief skills, no items, telegraphed moves left out.

| Phase | Warrior | Mage | Rogue | Valerie |
| --- | ---: | ---: | ---: | ---: |
| Quiet, Please | 3.9 | 2.7 | 3.4 | 0.0 |
| Citation Needed | 6.9 | 4.9 | 6.1 | 5.4 |
| The Final Draft | 7.8 | 5.8 | 7.2 | 6.9 |
| **Whole fight** | **6.1** | **4.4** | **5.5** | **3.9** |
| **Rounds to the Resolve Check (100)** | **16.5** | **22.8** | **18.2** | **25.4** |
| Whole fight, Valerie Lucid (Airhead 20) | 7.0 | 5.3 | 6.4 | 8.2 |

The Final Draft left unanswered every cycle would add 13.8% (Warrior), 18.3% (Mage), 21.3% (Rogue), 10.7% (Valerie) of max HP per round to the last phase, and 5.7 / 4.3 / 5.0 / 3.9 stress per round.

**Against the hero's kit.** Enemy rolls against Valerie at three points on the gauge:

| Airhead | Band | Hit ceiling | Strike Through: lands | Sharp Correction: lands | Sharp Correction: bounces back | Boss fumbles and binds itself |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 0 | Lucid | 95 | 77% | 82% | 5% | 5% |
| 60 | Ditzy | 71 | 71% | 51% | 20% | 11% |
| 100 | Total Airhead | 55 | 55% | 25% | 30% | 15% |

The same three gauges with Valerie taunting, so every aimed attack is hers, and what the gauge does to everyone's nerve:

| Airhead | She loses per round | Rounds she lasts unhealed | Bounced back per round | Boss self-binds per round | Her stress per round | Allies' net stress per round (W / M / R) | Her Power 4: Wing It | Her Power 4: Think It Through | Chaos Wave per Wing It action |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 27.3% | 3.7 | 1,134 (0.05% of her HP) | 0.07 | 8.2 | 7.0 / 5.3 / 6.4 | 26,002 | 31,873 | 5% |
| 60 | 21.2% | 4.7 | 4,536 (0.18% of her HP) | 0.15 | 3.9 | 6.1 / 4.4 / 5.5 | 26,002 | 31,873 | 17% |
| 100 | 14.2% | 7.0 | 6,804 (0.27% of her HP) | 0.20 | 3.1 | 6.1 / 4.4 / 5.5 | 26,002 | 31,873 | 25% |

One Power 3 heal from the reference mage restores 28,800 HP, 15.9% of Valerie's bar. That covers a taunting round at Airhead 100 and falls short at Airhead 0 and 60. Her stress columns are before her stance: Wing It takes 2 off every turn, Think It Through adds 4.

**Where she sits on the curve.** Imara Vellum takes 23 rounds of Power 4 skills or 51 of basic attacks. In that time she deals 2.3 times the party's combined HP, and the unhealed party lasts 9.9 rounds, so the fight cannot be raced. At the Power 4 pace her moves alone leave the Warrior on 140 stress and the Mage on 101, so somebody rolls a Resolve Check around round 17 unless stress is managed. HP pressure is about level with the first boss (10.1% of party HP a round); the step up is in nerve, and in a Guard that costs 5 extra rounds if nobody answers it. A Lucid Valerie takes 8.2 stress a round here against 3.1 as a Total Airhead, before the 4 that each Think adds.

### 5.5 Madam Parity, Comptroller of Fortune (endgame superboss)

`boss_parity`. A stately woman in her sixties with dark brown skin and silver locs pinned under a green eyeshade, in pinstriped robes, with an abacus for a halo and a set of brass scales standing where her shadow should be.

#### Who she is

|  |  |
| --- | --- |
| **Identity** | The celestial auditor who balances every stroke of luck in the world against a loss somewhere else, and has found one account that only ever pays out. |
| **Want** | To close the Bellweather account: every accident repaid and every rescue it bought reversed, until the books are square. |
| **Cost** | Perfect fairness means nothing has ever happened to her by chance: she has never been lucky, never been surprised, and never once been glad to be wrong. |
| **Arena** | The Counting House at the End of Luck: a marble floor ruled like a ledger, a wall of pigeonholes holding everyone's odds, and the Great Wheel, chained since the day she took office. |
| **Pronouns** | she/her |

#### Stat block and HP pool

|  | Level | Rank | STR | INT | AGI | CON | WIL | LCK | HP | MP | Actions per round |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Madam Parity** | 100 | superboss | 500 | 640 | 640 | 370 | 700 | 600 | 22,200,000 | 70,000 | 3 |
| × benchmark (600) |  |  | 0.83 | 1.07 | 1.07 | 0.62 | 1.17 | 1.00 | 0.62 of 36,000,000 |  |  |

HP is `maxHp(100, 370, 'superboss')` = 10 × 100 × 370 × 60. The second row reads each attribute against `benchmarkStat(100)`, and the pool against a superboss at benchmark Constitution.

#### Affinities and bind resistances

| Element | phys | fire | ice | bolt | holy | dark |
| --- | --- | --- | --- | --- | --- | --- |
| Affinity | normal | normal | normal | normal | resist | weak |

| Part | Bind resist | What a bind on it seals |
| --- | --- | --- |
| head | 70% | Actuarial Table, Itemised Statement, Double Entry, Service Charge, Final Notice |
| arms | 60% | Heads I Win, Red Tape, Repossession, Closing Bell, Balance Due |
| legs | 50% | nothing |

Bind resist is the percentage taken off a bind's chance (`engine/binds.js`). A bound part also halves its attributes: arms halve Might, head halves Arcana and Willpower, legs halve Finesse.

#### Phases

| From HP | Phase | Read to the table | The question | An answer | What the answer costs |
| --- | --- | --- | --- | --- | --- |
| 100% | **Opening Balance** | She collects from whoever has the most: every single-target attack goes to the hero with the highest current HP. Decide who you top up, because a full bar is a target. | Who can afford to be the richest hero in the room? | Keep Valerie's bar the fullest, or taunt, so the coins fly at the one hero they bounce off. | Healing Valerie first leaves the mage and the rogue low when Actuarial Table and Red Tape arrive for everyone anyway. |
| 75% | **The Audit** | She flips the ledger: for three rounds in every four, Valerie's luck runs backwards and only works while she is Thinking. Decide whether to chase the flip or sit it out in the middle of the gauge. | When the luck runs backwards, do you run with it? | Think It Through while the ledger is flipped and be lucky and precise at once, sit at Ditzy and take half of everything, or spend 100 MCE on I'm Just a Good Hero! and ignore the flip for 3 turns. | Every Think costs 4 stress her Willpower cannot touch, and when the ledger flips back she is Lucid with the luck off; the ultimate spends the MCE the ending might need. |
| 50% | **Collections** | She starts taking things back: buffs, MP and nerve. Repossession lands as the first action of every fourth round: decide what you are willing to let her take. | What do you let her take? | Buff straight after a Repossession and never before one; pay Service Charge in MP while there is MP, and in nerve after. | Fighting unbuffed one round in four is slower; MP paid to her is MP not spent on healing; stress kept is a Resolve Check coming. |
| 25% | **Closing the Books** | She rings the closing bell, and two rounds later the whole bill comes due on everyone. Spin the Wheel, brace, or let Valerie stand up and take the bill alone. | Who pays the bill? | A Chaos Wave spins the Great Wheel and cancels the bill; a taunting Valerie takes all of it alone, and may trip under it; everyone can Guard; or Valerie can share the luck (One for the House). | Fishing for a wave means two rounds of Winging It with no guarantee; taking the bill alone can drop Valerie from full; Guarding saves bodies and not nerves, because the 40 death stress still lands. |

Round scripts. Madam Parity takes 3 actions a round in the order listed, and repeats the cycle until the phase changes.

- **Opening Balance:** round 1: Heads I Win, Red Tape, Heads I Win; round 2: Actuarial Table, Heads I Win, Service Charge; round 3: Red Tape, Heads I Win, Heads I Win.
- **The Audit:** round 1: Double Entry, Heads I Win, Red Tape; round 2: Itemised Statement, Heads I Win, Heads I Win; round 3: Actuarial Table, Heads I Win, Service Charge; round 4: Red Tape, Heads I Win, Heads I Win.
- **Collections:** round 1: Repossession, Heads I Win, Final Notice; round 2: Double Entry, Red Tape, Heads I Win; round 3: Itemised Statement, Heads I Win, Service Charge; round 4: Actuarial Table, Heads I Win, Final Notice.
- **Closing the Books:** round 1: Closing Bell, Heads I Win, Red Tape; round 2: Itemised Statement, Heads I Win, Final Notice; round 3: Balance Due, Heads I Win, Service Charge; round 4: Repossession, Actuarial Table, Heads I Win.

#### Moves

| Move | Kind | Power | To hit | Target | Part | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Heads I Win** | magical, INT | 6 | +10 | one | arms | ranged, projectile | none | Flips a coin the size of a cartwheel at one hero: Power 6 projectile driven by Arcana and resisted by Willpower, +10 to hit. |
| **Red Tape** | magical, INT, holy | 3 | +5 | row | arms | ranged | none | Wraps one row in triplicate: Power 3 holy magic, +5 to hit, and a 40% chance of a legs bind for 2 turns on each hero hit. |
| **Actuarial Table** | stress | n/a | auto | all | head | horror, cannot miss | 20 horror | Shows each hero the exact odds that they die today. Cannot miss: 20 horror stress to every hero. |
| **Itemised Statement** | stress | n/a | auto | all | head | realization, mental, cannot miss | 20 realization (Valerie only); 10 mental (everyone but Valerie) | Reads the Bellweather account line by line. Cannot miss: Valerie takes 20 realization stress (ignores Willpower, Airhead −10) and every other hero takes 10 mental stress. |
| **Double Entry** | utility | n/a | auto | one | head | cannot miss | none | Flips the ledger for 3 rounds. Cannot miss: Valerie's accidents read 100 minus the Airhead gauge, so her luck only works while she is Thinking. Her ultimate I'm Just a Good Hero! overrides it and a spin of the Great Wheel ends it. |
| **Service Charge** | debuff | n/a | auto | all | head | cannot miss | 15 general (or pay 12% of max MP) | Cannot miss. Each hero chooses: pay 12% of max MP, or keep it and take 15 general stress. |
| **Repossession** | debuff | n/a | auto | all | arms | cannot miss | none | Cannot miss. Strips every buff from every hero and applies each one to her own attributes for 2 turns. |
| **Final Notice** | magical, INT, holy | 4 | +10 | one | head | ranged, death | 28 death | Hands one hero a black-edged envelope: Power 4 holy magic, +10 to hit, and 28 death stress if it lands. |
| **Closing Bell** | utility | n/a | auto | self | arms | windup, horror, cannot miss | 10 horror (every hero, hit or not) | Rings the closing bell. Cannot miss: 10 horror stress to every hero, and Balance Due lands as her first action two rounds later unless her arms are bound or the Great Wheel is spun first. |
| **Balance Due** | magical, INT, holy | 15 | +20 | all | arms | telegraphed, death | 40 death | Telegraphed two rounds ahead by Closing Bell. Everything her luck ever dodged, presented at once: Power 15 holy magic at every hero, +20 to hit, and 40 death stress to each hero it lands on. Guarding halves the damage, not the stress. If Valerie is taunting, the whole bill goes to her alone as a single hit. |

Stress as it lands on the level 100 reference party, after Willpower and after Valerie's filter:

| Move | Base | Warrior | Mage | Rogue | Valerie, Lucid | Valerie, Ditzy | Valerie, Total Airhead |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Actuarial Table | 20 horror | 13 | 9 | 12 | 12 | 0 | 0 |
| Itemised Statement | 20 realization | n/a | n/a | n/a | 20 | 20 | 20 |
| Itemised Statement | 10 mental | 7 | 4 | 6 | n/a | n/a | n/a |
| Service Charge | 15 general | 10 | 6 | 9 | 9 | 9 | 9 |
| Final Notice | 28 death | 19 | 12 | 17 | 17 | 17 | 17 |
| Closing Bell | 10 horror | 7 | 4 | 6 | 6 | 0 | 0 |
| Balance Due | 40 death | 27 | 17 | 24 | 24 | 24 | 24 |

#### Contraption and concession

**The Great Wheel** (once per phase). A wheel of fortune three storeys tall, chained since the day she took office because a wheel that spins is an unaudited liability. When a Chaos Wave sets it off the chain snaps and it spins: Madam Parity is Surprised for the first time in her existence and loses her next action, she takes damage equal to 2% of her max HP, a flipped ledger flips back, and a rung Closing Bell is cancelled. Works once per phase.

**One for the House** (from 25% HP). At 25% HP or below, a Valerie who is truly a Total Airhead (gauge 67 or more, ledger not flipped) can spend 100 MCE to give the Wheel's next spin to Madam Parity. It lands on her number. She has never won anything before, and the fight ends as a win with full rewards. *The price:* All 100 MCE, saved instead of spent on either ultimate, and Valerie has to be an Airhead at the moment it matters, which the Itemised Statement is working against.

#### Tactics, counterplay, rewards

- **Tactics.** Three actions a round. Every single-target attack goes to the hero with the highest current HP; a taunt overrides that. Double Entry comes round on a four-round cycle from Phase 2, Repossession from Phase 3 and the Closing Bell from Phase 4. Her Luck is exactly the benchmark for her level, so she neither out-lucks anyone nor is out-lucked.
- **Counterplay.** Make Valerie the richest target in the room and let the coins bounce; dark hurts Parity and holy is halved. When the ledger flips, either Think through it and accept the stress or spend 100 MCE on I'm Just a Good Hero! to ignore it, and time buffs for the round after a Repossession. When the bell rings, spin the Great Wheel with a Chaos Wave, taunt so Valerie takes the bill alone, or have everyone Guard.
- **Against the hero's kit.** Madam Parity audits the kit itself: she aims by HP so the dodge has to be earned, turns the gauge upside down so Thinking is lucky, reads out the receipt for every accident, and can only be ended early by the one thing she has never had, a stroke of luck.
- **Rewards.** 500,000 EXP to each party member and 100,000 gold: `expYield(100, 'superboss')` and `goldYield(100, 'superboss')`. No item ids are named yet.

#### Simulation

Reference party at level 100, no gear:

| Hero | STR | INT | AGI | CON | WIL | LCK | HP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 760 | 300 | 520 | 800 | 300 | 620 | 800,000 |
| Mage | 420 | 760 | 420 | 480 | 800 | 420 | 480,000 |
| Rogue | 580 | 300 | 800 | 460 | 400 | 760 | 460,000 |
| Valerie | 620 | 300 | 460 | 720 | 400 | 800 | 720,000 |

**Party offense.** Expected damage per action, counting misses, fumbles and crits. Valerie is Winging It at Airhead 60.

| Hero | Hit % | Crit % | Basic attack, plain hit | Landed basic hits to kill | Basic attack, expected | Power 4, expected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warrior | 73 | 5 | 91,682 | 243 | 69,220 | 138,441 (skill) |
| Mage | 67 | 1 | 43,735 | 508 | 29,521 | 105,373 (spell) |
| Rogue | 80 | 7 | 65,960 | 337 | 55,077 | 110,154 (skill) |
| Valerie | 73 | 8 | 71,627 | 310 | 55,153 | 110,306 (skill) |
| **Party per round** |  |  |  |  | **208,970** | **464,273** |
| **Rounds to kill** |  |  |  |  | **107** | **48** |

With every hero on Power 8 skills the fight would take 24 rounds.

**Boss offense.** Share of each hero's max HP lost per round, telegraphed moves left out. Valerie at Airhead 60.

| Phase | Share of HP bar | Warrior | Mage | Rogue | Valerie | Whole party |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Opening Balance | 25% | 15.0% | 20.7% | 22.3% | 10.3% | 16.1% |
| The Audit | 25% | 12.9% | 17.8% | 19.1% | 8.7% | 13.8% |
| Collections | 25% | 10.2% | 14.1% | 15.2% | 7.2% | 11.0% |
| Closing the Books | 25% | 9.2% | 12.6% | 13.6% | 6.2% | 9.8% |
| **Whole fight** | 100% | **11.8%** | **16.3%** | **17.6%** | **8.1%** | **12.7%** |
| **Rounds survived unhealed** |  | **8.5** | **6.1** | **5.7** | **12.4** | **7.9** |

**Worst single hit from full HP.** Plain hit, then a crit at variance 1.1, as a share of max HP. For telegraphed moves the third figure is that same worst crit against a Guard.

| Move | Power | Target | Warrior | Mage | Rogue | Valerie |
| --- | --- | --- | --- | --- | --- | --- |
| Heads I Win | 6 | one | 29% / 48% | 37% / 61% | 48% / 79% | 30% / 50% |
| Red Tape | 3 | row | 15% / 24% | 18% / 30% | 24% / 39% | 15% / 25% |
| Final Notice | 4 | one | 19% / 32% | 25% / 41% | 32% / 52% | 20% / 34% |
| Balance Due (telegraphed) | 15 | all | 73% / 120% / 60% | 92% / 152% / 76% | 119% / 197% / 98% | 76% / 126% / 63% |

**Stress pressure.** Stress gained per round from her moves alone, net of the 3 that allies shed each time Valerie shrugs off fear. No relief skills, no items, telegraphed moves left out.

| Phase | Warrior | Mage | Rogue | Valerie |
| --- | ---: | ---: | ---: | ---: |
| Opening Balance | 3.3 | 2.0 | 3.0 | 0.0 |
| The Audit | 4.3 | 2.5 | 3.8 | 5.0 |
| Collections | 6.3 | 3.9 | 5.4 | 6.5 |
| Closing the Books | 6.3 | 3.4 | 5.4 | 5.8 |
| **Whole fight** | **5.0** | **3.0** | **4.4** | **4.3** |
| **Rounds to the Resolve Check (100)** | **19.8** | **33.8** | **22.8** | **23.2** |
| Whole fight, Valerie Lucid (Airhead 20) | 6.0 | 4.0 | 5.4 | 8.1 |

Balance Due left unanswered every cycle would add 17.8% (Warrior), 23.0% (Mage), 27.3% (Rogue), 13.7% (Valerie) of max HP per round to the last phase, and 6.4 / 4.0 / 5.4 / 4.3 stress per round.

Service Charge is not in the table, because paying it in MP is the default. A hero who always keeps the MP takes another 2.7 (Warrior), 1.6 (Mage), 2.4 (Rogue), 2.4 (Valerie) stress per round.

**Against the hero's kit.** Enemy rolls against Valerie at three points on the gauge:

| Airhead | Band | Hit ceiling | Final Notice: lands | Heads I Win: lands | Heads I Win: bounces back | Boss fumbles and binds itself |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 0 | Lucid | 95 | 87% | 82% | 5% | 5% |
| 60 | Ditzy | 71 | 71% | 51% | 20% | 11% |
| 100 | Total Airhead | 55 | 55% | 25% | 30% | 15% |

The same three gauges with Valerie taunting, so every aimed attack is hers, and what the gauge does to everyone's nerve:

| Airhead | She loses per round | Rounds she lasts unhealed | Bounced back per round | Boss self-binds per round | Her stress per round | Allies' net stress per round (W / M / R) | Her Power 4: Wing It | Her Power 4: Think It Through | Chaos Wave per Wing It action |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 41.3% | 2.4 | 12,024 (0.05% of her HP) | 0.09 | 8.1 | 6.0 / 4.0 / 5.4 | 110,306 | 135,375 | 5% |
| 60 | 27.8% | 3.6 | 48,097 (0.22% of her HP) | 0.21 | 4.3 | 5.0 / 3.0 / 4.4 | 110,306 | 135,375 | 17% |
| 100 | 15.9% | 6.3 | 72,145 (0.32% of her HP) | 0.28 | 4.2 | 5.0 / 3.0 / 4.4 | 110,306 | 135,375 | 25% |

One Power 3 heal from the reference mage restores 114,000 HP, 15.8% of Valerie's bar. That is less than she loses in a round at any gauge (15.9% at Airhead 100), so a taunt always needs more than one healer's turn behind it. Her stress columns are before her stance: Wing It takes 2 off every turn, Think It Through adds 4.

**Where she sits on the curve.** Madam Parity takes 48 rounds of Power 4 skills or 107 of basic attacks. In that time she deals 6.1 times the party's combined HP, and the unhealed party lasts 7.9 rounds, so the fight cannot be raced. With Power 8 skills, which is what a level 100 party actually carries, it is 24 rounds. At the Power 4 pace her moves alone leave the Warrior on 242 stress and the Mage on 142, which is a Breakdown at 200 near round 40 unless stress is relieved along the way. Damage is the highest of the three (12.7% of party HP a round, from three actions) and falls as the fight goes on, while stress climbs: the opening phase tests bars, the last two test nerve.

### 5.6 Standard encounters

The five fights the starter event pack hands off to. Enemy attributes are stored as multiples of `benchmarkStat(level)`, so one entry serves any party level: an encounter with `"level": "party"` is built at the party's level when the fight starts. HP is `maxHp(level, CON, rank)` and each enemy pays `expYield` and `goldYield` for its rank.

#### Goblin Scouts (`goblin_scouts`)

Three goblin scouts creeping through the ferns with knives and a sling, convinced nobody has noticed them. They are brave as a group: when two are down the third runs.

| Enemy | Count | Rank | STR | INT | AGI | CON | WIL | LCK | Affinities | Bind resist (head / arms / legs) | How it fights |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Goblin Knifer** | 2 | minion | ×0.8 | ×0.4 | ×1 | ×0.5 | ×0.5 | ×0.8 | none | 0 / 0 / 10 | A knee-high scout with a kitchen knife. Stabs the nearest shin and runs if it is the last one standing. |
| **Goblin Slinger** | 1 | minion | ×0.7 | ×0.4 | ×1.1 | ×0.5 | ×0.5 | ×0.9 | none | 0 / 0 / 10 | Hangs back with a sling and a repertoire of gestures. Its stones are projectiles, so they can bounce. |

| Enemy | Move | Power | To hit | Target | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Goblin Knifer | **Shank** | 2 | 0 | one | melee | none | Stabs the nearest shin: Power 2 physical. |
| Goblin Knifer | **Ankle Stab** | 1.5 | +5 | one | melee | none | Goes for the ankles: Power 1.5 physical, +5 to hit, 25% chance of a legs bind for 1 turn. |
| Goblin Slinger | **Sling Stone** | 2 | 0 | one | ranged, projectile | none | Slings a river stone at one hero: Power 2 physical projectile. |
| Goblin Slinger | **Rude Gesture** | n/a | +10 | one | embarrassment | 5 embarrassment | A gesture that needs no translation, at +10 to hit: 5 embarrassment stress if it lands. |

**Contraption:** none. This one is fought on open ground.

#### Bandit Archers (`bandit_archers`)

Four bows and one crossbow dug into the left bank of a bramble-lined road, all aimed at the shiniest thing on it. Every attack they have is a projectile, and none of them wants a fight at arm's length.

| Enemy | Count | Rank | STR | INT | AGI | CON | WIL | LCK | Affinities | Bind resist (head / arms / legs) | How it fights |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Bandit Bowman** | 4 | minion | ×0.9 | ×0.5 | ×1.1 | ×0.6 | ×0.6 | ×0.8 | none | 10 / 10 / 10 | Shoots from cover at whoever is most visible, which is the knight in gold. Folds quickly once anyone reaches the bank. |
| **Crossbow Sergeant** | 1 | standard | ×1.1 | ×0.6 | ×0.9 | ×0.9 | ×0.8 | ×0.8 | none | 20 / 20 / 20 | Calls the volleys and reloads a crossbow the size of a plough. Slow, steady, and the only one who does not run. |

| Enemy | Move | Power | To hit | Target | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bandit Bowman | **Loose** | 2.2 | 0 | one | ranged, projectile | none | Shoots one hero: Power 2.2 physical projectile. |
| Bandit Bowman | **Pinning Shot** | 1.6 | +5 | one | ranged, projectile | none | Aims for a boot: Power 1.6 physical projectile, +5 to hit, 30% chance of a legs bind for 2 turns. |
| Crossbow Sergeant | **Heavy Bolt** | 5 | −5 | one | ranged, projectile | none | Fires a crossbow the size of a plough at one hero: Power 5 physical projectile, −5 to hit. |
| Crossbow Sergeant | **On My Mark** | 2.8 | 0 | row | ranged, projectile | none | Calls a volley down on one row: Power 2.8 physical projectile against each hero in it. |

**Contraption:** none. This one is fought on open ground.

#### Skeleton Phalanx (`skeleton_phalanx`)

A dozen skeletons in formation in a long hall: eight hoplites in two ranks of four, three archers and a captain. Only the front four hoplites can reach the party, and locked shields halve what gets through until something breaks the formation.

| Enemy | Count | Rank | STR | INT | AGI | CON | WIL | LCK | Affinities | Bind resist (head / arms / legs) | How it fights |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Skeleton Hoplite** | 8 (4 act per round) | minion | ×0.9 | ×0.3 | ×0.7 | ×0.6 | ×0.6 | ×0.5 | holy weak, dark resist | 40 / 10 / 0 | Shield, spear, no opinions. The front four attack or lock shields; when one falls, the hoplite behind steps up. |
| **Skeleton Archer** | 3 | minion | ×0.8 | ×0.3 | ×0.9 | ×0.5 | ×0.6 | ×0.6 | holy weak, dark resist | 40 / 10 / 0 | Shoots over the shield wall. Its arrows are projectiles and it has no shield of its own. |
| **Phalanx Captain** | 1 | standard | ×1.1 | ×0.5 | ×0.8 | ×1 | ×0.9 | ×0.7 | holy weak, dark resist | 40 / 20 / 10 | The only skeleton giving orders. While it stands a broken formation re-forms; drop it and the hoplites stop locking shields. |

| Enemy | Move | Power | To hit | Target | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skeleton Hoplite | **Spear Thrust** | 2.2 | 0 | one | melee | none | A drilled thrust from behind the shield: Power 2.2 physical. |
| Skeleton Hoplite | **Locked Shields** | n/a | auto | self | cannot miss | none | Locks shields with its neighbours and Guards (takes half damage) until its next turn. Sealed while its legs are bound or the formation is broken. |
| Skeleton Archer | **Bone Arrow** | 2 | 0 | one | ranged, projectile | none | Shoots over the shield wall: Power 2 physical projectile. |
| Skeleton Archer | **Rattling Volley** | 1.6 | −5 | row | ranged, projectile, horror | 4 horror | A clattering volley at one row: Power 1.6 physical projectile, −5 to hit, and 4 horror stress to each hero hit. |
| Phalanx Captain | **Captain's Halberd** | 4.5 | 0 | one | melee | none | A long overhead chop at one hero: Power 4.5 physical. |
| Phalanx Captain | **Dress the Line** | n/a | auto | all | horror, cannot miss | 7 horror | Raps out an order in a dead language. Cannot miss: 7 horror stress to every hero, and a broken formation re-forms. |

**Contraption: The DO NOT PULL Lever.** A brass lever under a sign in four languages. When a Chaos Wave sets it off, the floor under the phalanx drops a foot and tilts: every skeleton slides into one corner, takes damage equal to 25% of its max HP, has its legs bound for 2 turns and loses Guard, and no shields can be locked for 2 turns. Works once. If the event already pulled it, start the fight with all of this applied.

#### The Hoard Drake (`hoard_drake`)

A drake woken on top of its hoard in a cave with one way through, and it has counted every coin. One elite with two actions a round: it guards the pile first and the exit second.

| Enemy | Count | Rank | STR | INT | AGI | CON | WIL | LCK | Affinities | Bind resist (head / arms / legs) | How it fights |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Hoard Drake** | 1 (2 actions per round) | elite | ×1.1 | ×1 | ×0.9 | ×1.2 | ×1 | ×0.8 | fire resist, ice weak | 40 / 30 / 30 | Bites what is close, spits molten gold at what is far, and breathes on everyone when crowded. It will not leave the hoard, so it can be circled. |

| Enemy | Move | Power | To hit | Target | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hoard Drake | **Bite** | 5 | +5 | one | melee, wound | 6 wound | Snaps at the nearest hero: Power 5 physical, +5 to hit, and 6 wound stress if it lands. |
| Hoard Drake | **Tail Sweep** | 3 | 0 | row | melee | none | Sweeps a row with its tail: Power 3 physical and a 30% chance of a legs bind for 2 turns. |
| Hoard Drake | **Molten Spit** | 5 | 0 | one | ranged, projectile | none | Spits a gobbet of molten gold at a hero out of reach: Power 5 fire magic projectile. |
| Hoard Drake | **Bellows Breath** | 2.8 | 0 | all | horror | 8 horror (every hero, hit or not) | Breathes like a forge across the whole cave: Power 2.8 fire magic to each hero it lands on, and 8 horror stress to every hero whether it lands or not. |
| Hoard Drake | **That One Is Mine** | n/a | +10 | one | mental | 14 mental | Fixes one hero with a stare of pure ownership at +10 to hit: 14 mental stress if it lands. |

**Contraption: The Hoard.** A hill of coin, plate and goblets under the drake. When a Chaos Wave sets it off the pile slides: the drake loses its next action scrabbling after its goblets, its legs are bound for 2 turns, it loses Guard, and the party collects 20% more gold after the fight. Works once.

#### The Horde at the Gate (`horde_at_the_gate`)

A raiding horde hitting a town gate at dusk: eighteen raiders, six slingers and two war drummers, far more than fit through the gap at once. Only five raiders and three slingers can act each round, and a fresh one steps up as each falls; if the party has the advantage, the militia holds the flanks and only three raiders can act.

| Enemy | Count | Rank | STR | INT | AGI | CON | WIL | LCK | Affinities | Bind resist (head / arms / legs) | How it fights |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Horde Raider** | 18 (5 act per round) | minion | ×0.7 | ×0.3 | ×0.8 | ×0.4 | ×0.4 | ×0.6 | none | 0 / 0 / 0 | A borrowed axe and one good swing's worth of courage. Any solid hit drops it; there is always another behind it. |
| **Horde Slinger** | 6 (3 act per round) | minion | ×0.7 | ×0.3 | ×1 | ×0.4 | ×0.4 | ×0.7 | none | 0 / 0 / 0 | Lobs stones and fire pots over the front line. Everything it throws is a projectile. |
| **War Drummer** | 2 | standard | ×0.7 | ×0.9 | ×0.7 | ×0.9 | ×1 | ×0.7 | none | 20 / 20 / 20 | Keeps the horde coming and the party rattled. With both drummers down the raiders stop pressing and only three can act each round. |

| Enemy | Move | Power | To hit | Target | Tags | Stress (base) | What it does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Horde Raider | **Hack** | 2 | 0 | one | melee | none | Swings a borrowed axe: Power 2 physical. |
| Horde Raider | **Dogpile** | 2.6 | −10 | one | melee | none | Throws itself at a hero's knees: Power 2.6 physical, −10 to hit, 20% chance of a legs bind for 1 turn. |
| Horde Slinger | **Sling Volley** | 1.8 | 0 | one | ranged, projectile | none | Slings a stone over the front line: Power 1.8 physical projectile. |
| Horde Slinger | **Fire Pot** | 2.2 | −10 | row | ranged, projectile | none | Lobs a pot of burning pitch at one row: Power 2.2 fire projectile driven by Might, −10 to hit. |
| War Drummer | **War Drums** | n/a | auto | all | horror, cannot miss | 7 horror | A beat the party feels in its teeth. Cannot miss: 7 horror stress to every hero. |
| War Drummer | **Drive Them On** | n/a | auto | allies | cannot miss | none | Shouts the front line forward: every raider gains Might ×1.2 for 2 turns. |

**Contraption: The Portcullis.** The gate's own portcullis, winched up and badly pinned. When a Chaos Wave sets it off it drops: the four raiders under it are out of the fight, and for 2 turns only half as many enemies can act while the rest hammer on the wrong side. Works once.

#### Encounter numbers

The same reference party as the bosses, at two or three levels inside each event's range. "Rounds to clear" counts every landed hit needed and divides by the chance to land; it ignores Guards and overkill. The Power 3 row column assumes each swing catches three enemies of a kind, which is what Big Swing and Cleave are for. "Opening pressure" is the first round, with every enemy that is allowed to act using each of its moves equally often.

| Encounter | Level | Enemy HP, total | Rounds to clear, basic | Rounds to clear, Power 4 | Rounds to clear, Power 3 row | Opening pressure (party HP per round) | Worst single hit (share of a hero's HP) | EXP each | Gold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Goblin Scouts | 1 | 60 | 1.9 | 1.0 | 1.0 | 2.0% | 12% | 60 | 12 |
| Goblin Scouts | 5 | 1,020 | 2.2 | 1.0 | 1.0 | 2.6% | 16% | 300 | 60 |
| Bandit Archers | 5 | 3,150 | 6.0 | 2.6 | 1.9 | 9.7% | 59% | 650 | 130 |
| Bandit Archers | 20 | 45,880 | 6.9 | 3.1 | 2.4 | 10.5% | 64% | 2,600 | 520 |
| Skeleton Phalanx | 10 | 22,400 | 12.3 | 5.3 | 3.5 | 9.5% | 56% | 2,700 | 540 |
| Skeleton Phalanx | 50 | 531,200 | 12.6 | 5.4 | 3.6 | 9.9% | 59% | 13,500 | 2,700 |
| The Hoard Drake | 20 | 88,800 | 13.7 | 5.4 | 5.4 | 10.5% | 64% | 4,000 | 800 |
| The Hoard Drake | 50 | 543,000 | 14.0 | 5.4 | 5.4 | 10.7% | 65% | 10,000 | 2,000 |
| The Horde at the Gate | 10 | 36,560 | 19.2 | 10.3 | 5.3 | 9.5% | 18% | 5,800 | 1,160 |
| The Horde at the Gate | 50 | 852,800 | 19.7 | 10.4 | 5.3 | 9.9% | 19% | 29,000 | 5,800 |
| The Horde at the Gate | 100 | 3,384,000 | 19.8 | 10.4 | 5.3 | 10.0% | 19% | 58,000 | 11,600 |

Goblin Scouts is also the first fight of the game, when Valerie is alone at level 1: solo, basic attacks clear it in 7.6 rounds and the goblins take 6.0% of her HP in the opening round.

Each encounter against the hero's kit, with the odds for one projectile aimed at Valerie:

| Encounter | Projectile | At Airhead 60 | At Airhead 100 | How it plays |
| --- | --- | --- | --- | --- |
| Goblin Scouts | Sling Stone (Goblin Slinger, level 1) | lands 50%, bounces 21%, fumbles 11% | lands 24%, bounces 31%, fumbles 15% | The tutorial: three weak enemies in one row for Big Swing, one sling stone to bounce, and a Rude Gesture that only lands on a Valerie who is paying attention. |
| Bandit Archers | Loose (Bandit Bowman, level 5) | lands 50%, bounces 21%, fumbles 11% | lands 24%, bounces 31%, fumbles 15% | The bounce fight. Every damaging move is a projectile, so a taunting Total Airhead sends a large share of the volley straight back; a Lucid Valerie is just a large gold target. |
| Skeleton Phalanx | Bone Arrow (Skeleton Archer, level 10) | lands 50%, bounces 21%, fumbles 11% | lands 24%, bounces 31%, fumbles 15% | The Chaos Wave fight. A wave strips the shield wall's Guard and pulls the lever; Thinking It Through instead means chewing through a guarded front rank. |
| The Hoard Drake | Molten Spit (Hoard Drake, level 20) | lands 50%, bounces 21%, fumbles 11% | lands 24%, bounces 31%, fumbles 15% | The taunt fight. Two actions a round from one elite land hard on anyone else; on Valerie they miss, bounce or bind the drake, and a wave buries it in its own hoard. |
| The Horde at the Gate | Sling Volley (Horde Slinger, level 10) | lands 50%, bounces 21%, fumbles 11% | lands 24%, bounces 31%, fumbles 15% | The crowd fight. Chaos Waves and row attacks are worth the most here, and War Drums are fear that Valerie does not hear, so the party sheds stress each time they sound. |

### 5.7 What these designs assume the engine will do

The engine resolves one action at a time. The bosses assume a battle loop around it that does not exist yet. Each line is something the Director must wire up.

1. **Several actions a round.** `actions` on a boss or enemy, taken in script order.
2. **Phase changes and scripts.** Switch phase when HP crosses `at`, restart the script at round 1, and re-cock a once-per-phase contraption.
3. **Wind-up and telegraph.** A `windup` move sets a countdown; the telegraphed move fires as the first action `telegraph.rounds` later unless its part is bound, the contraption goes off or the party concedes.
4. **Cannot-miss moves.** `auto: true` skips the attack roll, so there is nothing for Unintentional Dodge, the bounce or the Aura to act on.
5. **Effect targets** `valerie`, `others`, `heroes`, and the `orPay` choice on a stress effect.
6. **Contraptions.** `chaosWave()` already returns a `contraption` effect aimed at the field; the loop has to look up the arena's contraption and apply its `effects`, including `damage` by `hpPct` and binds that ignore bind resist. The `manual` hard check is the Think It Through way to do the same.
7. **Guard as a status on an enemy,** stripped by a Chaos Wave (`guard_broken`) and, for Vellum, by Wait, Look Closely.
8. **Concessions.** A story action that ends the fight as a win and charges its `effects`.
9. **Ledger Flipped.** While the status is on Valerie, `passiveAirhead()` must return 100 minus the gauge; I'm Just a Good Hero! still pins it at 100.
10. **Madam Parity's targeting rule** (highest current HP first), **Repossession** (move every hero buff to the boss) and **Balance Due's redirect** onto a taunting Valerie.
11. **Crowd limits.** `acting` on an enemy caps how many of that kind act each round.
12. **Bosses do not Struggle.** A bind that lands on a boss runs its full turns; bind resist and the wear rule in `engine/binds.js` are the price of landing one.
13. **Taunts and speech.** A taunt redirects attacks. It does not redirect a move whose effects name their own targets (the readings, the bellow).
