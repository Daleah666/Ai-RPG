# Handoff: Boss desk
Built `data/bosses.json` (3 bosses, 13 statuses), `data/encounters.json` (5 encounters, 5 statuses), `test/bosses.test.js` (24 tests) and `blueprint/05_boss_architecture.md`. `node --test test/core.test.js test/combat.test.js test/progression.test.js test/bosses.test.js`: 105 pass. `node tools/check-data.mjs`: ok. Every number here and in the blueprint is engine output.

## The three bosses
| Boss | Level, rank | HP | Actions | The question each phase asks |
|---|---|---:|---:|---|
| **Bolgrim Underbridge**, the Troll Who Was There (`boss_bolgrim`) | 12 boss | 129,600 | 2 | Who stands in front? Do you let him talk? Stop the machine, weather it, or tell him he is right? |
| **Imara Vellum**, the Unabridged (`boss_vellum`) | 50 boss | 2,500,000 | 2 | Find the book, or flip the table? Whose nerve do you spend? Break the quill, take the ending, or go on the record? |
| **Madam Parity**, Comptroller of Fortune (`boss_parity`) | 100 superboss | 22,200,000 | 3 | Who can afford to be the richest hero? When the luck runs backwards, do you run with it? What do you let her take? Who pays the bill? |

Each has identity, want and cost; a projectile from phase 1; fear from phase 1; a realization move that cannot miss by phase 2; a contraption a Chaos Wave sets off; and a **concession**: in the last phase the party can give the boss what it wants and win, paid for in Valerie's nerve, legend or MCE.

## Simulation headlines (reference party of four, no gear, Valerie Winging It at Airhead 60)
| Boss | Rounds to kill: basic / Power 4 | Party HP lost per round | Party lasts unhealed | First Resolve Check, no relief | Worst unannounced hit |
|---|---:|---:|---:|---:|---:|
| Bolgrim | 39 / 17 | 9.4% | 10.6 rounds | round 24.9 (Warrior) | 83% of the Rogue |
| Vellum | 51 / 23 (28 if her Guard is never answered) | 10.1% | 9.9 rounds | round 16.5 (Warrior) | 93% of the Rogue |
| Parity | 107 / 48 (24 at Power 8) | 12.7% | 7.9 rounds | round 19.8 (Warrior) | 79% of the Rogue |

- No non-telegraphed move one-shots anyone, even on a crit at variance 1.1. Each telegraphed move can drop someone on a crit and never kills a hero who Guards from full HP.
- The hero's kit, same result on all three: taunting as a Total Airhead she loses about 14% of her bar a round, Lucid 25–39%. One Power 3 heal from the mage (16% of her bar) holds the first and not the second.
- Encounters: 9.5–10.7% of party HP in the opening round, except Goblin Scouts (2.0–2.6%). Rounds to clear with Power 4: 1.0 to 10.4; the horde needs row attacks (5.3 rounds).

## Decisions you should know about
- **The early boss is level 12, not 10.** Inspirational Ignorance unlocks at 12, so he is the first fight with all six accidents online.
- **Stress is written flat** (it does not scale with level) and sits on the weak / medium / severe guide. The tables count boss moves only. If you also fire `stress.js` `set_piece` at every phase change, each ally takes 23–25 more per change at L12 and 21–32 at L50 and L100; my numbers assume you do not.
- **`rewards.items` is empty.** I named no `itm_` ids because `items.json` was being written. Add trophies if you want them.
- **Horror that reaches everyone cannot miss** (`auto: true`, or a stress effect with `target: "heroes"`), so the party sheds its 3 whenever Valerie is not Lucid, whatever the dice did.

## What the engine does not support yet (my designs assume all of it)
1. Several actions a round (`actions` on a boss or enemy) and the per-phase round `script`.
2. Phase changes at `phases[].at`, which also reset a once-per-phase contraption.
3. Wind-up and telegraph: a `windup` move, then the `telegraphed` move `telegraph.rounds` later, cancelled by a bind on its part, the contraption or the concession.
4. `auto: true` moves: no attack roll, so no dodge, bounce or fumble.
5. Effect targets `valerie`, `others`, `heroes`, and `orPay` (pay MP instead of taking the stress).
6. Contraptions: applying `contraption.effects` when `chaosWave()` returns its `contraption` effect (`damage` by `hpPct`, binds that skip bind resist), and the `manual` hard check.
7. Guard as an enemy status, stripped by a Chaos Wave and, on Vellum, by Wait, Look Closely.
8. Concessions: a story action that ends the fight as a win and charges `concession.effects` (`stress`, `trust`, `rep`, `limit`).
9. `ledger_flipped`: `passiveAirhead()` must return 100 minus the gauge while it is on Valerie; her ultimate still pins 100.
10. Madam Parity's targeting (highest current HP), Repossession (hero buffs move to her) and Balance Due's redirect onto a taunting Valerie.
11. `acting` on an enemy: how many of that kind may act per round (phalanx front rank, the gate).
12. Bosses never Struggle out of a bind. Bind resist and the wear rule are the price of landing one.
13. Event `advantage`: `skeleton_phalanx` starts with the lever already pulled, `horde_at_the_gate` drops to three acting raiders. Both are written in the encounter text only.

## For the Director to wire up
- `sillytavern/build.mjs` prints a boss's phases, moves and counterplay, but not `contraption`, `concession`, `actions` or `title`, and prints no enemy moves for encounters. A game master needs the first three; the lorebook lines are already written to stand alone.
- Both files carry a `statuses` registry as you asked; every status in a move, contraption or concession is registered, and the test fails if one is not or if one is unused.
- The simulation is throwaway and lives outside the repo: `/tmp/claude-0/-home-user/9d9a3738-a98d-5a1c-a8ba-2d66ed63b43d/scratchpad/boss-desk/` (`build-data.mjs` writes the two JSON files, `sim.mjs` runs them, `build-doc.mjs` prints section 5). If a boss is retuned by hand, the tests still guard HP, power limits, one-shots and rounds to kill, but the blueprint tables go stale until the simulation is rerun.
