# Playtest stage: where it stands and what is next

**Status:** OPEN
**Owner:** Del
**Written:** 2026-11-10, for whichever tool Del hands this to next
**Scope:** `rpg/playtest/`, `rpg/tools/build-playtest.mjs`. The rules engine in `rpg/engine/` is finished work with 296 tests; change it only for an item below that says so.

## What this is

A playable page for the Valerie RPG. Del plays Dame Valerie Bellweather from the inside: a clumsy, absurdly lucky knight. The page is one HTML file built from `rpg/playtest/stage.html` with the engine and data inlined, so the dice on the page are the engine's dice.

Read these first, in this order:

1. `rpg/playtest/README.md`: what is on the page and every rule the page adds.
2. `rpg/FOUNDATION.md`: the engine's contract. One d100 answers one question; every chance is clamped 5–95.
3. `rpg/handoff/battle-engineer.md`: how to drive `engine/battle.js` and what it does not resolve.

## Build and check

```bash
cd rpg
npm run all
npm run playtest
```

`npm run all` must stay at 296 passing. `npm run playtest` writes `rpg/playtest/out/oops-playtest.html` (ignored by git).

The page has no automated tests. It was checked by serving the built file and driving it with Playwright. `window.__stage` exposes `S` (all state), `render` and `post`, so a script can set up a situation directly: `window.__stage.S.stam = 2; window.__stage.render()`. Flows that were driven and passed on the last build: first meeting, a spot roll, buying and drinking a potion, the three left tabs, falling down and getting up, a travel roll into a standoff, being blocked from walking away, a failed Persuade into a real fight, a potion and a successful Run inside the fight, a room at the tavern, night closing the shop, switching path, copying a save. Desktop width only for this build; the phone layout was last checked one version earlier.

## Art

Del's pictures and clips are not in git. The published page has them. A build without them still works and shows empty spots. The file list is in `rpg/playtest/README.md`. Only one backdrop is sharp; several places share a backdrop.

## How the page is put together

One script in `stage.html`. State is a single object `S`, saved to `localStorage` under keys starting `oops-`. Every click goes through one handler that ends in `render()`.

| Area | Where to look in `stage.html` |
|---|---|
| Data tables | `PLACES`, `CAST`, `ACTS`, `APPROACH`, `SPOTS`, `POTIONS`, `PATHS`, `THOUGHTS` |
| Clock and hours | `passTime`, `sleepUntil`, `openNow`, `phaseNow` |
| Who is where | `residentOf`, `wandererAt`, `seat`, `refreshWho` |
| Dice and the tray | `rollCheck`, `tableRoll`, `renderTray` |
| What a choice does | `applyFx`, `gainGold`, `useStam`, `decency`, `chem`, `grow` |
| Meeting, spots, shop | `meet`, `doSpot`, `buy`, `drink` |
| Travel and danger | `goTo`, `pathTo`, `dangerOf`, `explore`, `startStandoff`, `standoffAct` |
| Domains and order | `AREAS`, `areaOf`, `order`, `secure`, `knightAct`, `mapTab` |
| Falling down | `fallDown`, `getUp` |
| Real fights | `startBattle`, `battleAct`, `battleExtra`, `syncBattle`, `leaveBattle`, `postEvents` |
| Panels | `renderHuds`, `rightPanel`, `mapTab`, `hereTab`, `levelTab`, `debugTab`, `bioTab`, `spicyTab`, `settingsBlock`, `renderDebugger` |
| Inner voice | `pickThought`, `thinkAloud` (asks Claude's quick model when the toggle is on) |

## Decisions Del made (do not reopen)

- Valerie is the focus. Hunts and random fights are her alone. Boss bounties keep a party of four.
- Layout: stats left, story middle with a button grid under it, tabbed panel right. Movement is clicking bubbles on a map.
- Combat is announced by the word COMBAT and locks movement. The ways out are fight, persuade, tempt or run.
- Regulars have hidden numbers. A debugger at the top shows them, along with chances and what just changed.
- Knight theme: four domains around the city (the Academy, the Castle and its dungeons, the Slaver Camps, the Forest), each with an Order meter the knight raises and a stronghold to break. The camps are enemy ground she frees people from.
- Old tools are kept under Debug, never deleted.
- Body trackers (bust, hips, size, chemistry) are wanted, with a different reason per class: warrior hormones, mage mana, rogue greed.
- Text stays PG-13. Del's card has `aiBias.lewd: 0` and the trackers switched off; the page shows the trackers as numbers and keeps the writing clean.
- Karryn's Prison and Corruption of Champions are references for structure and layout only. No content, names or numbers were taken from either, and none should be.

## What Del asked for that is not built, in suggested order

1. **A small dungeon between places.** Del wants a short stretch to cross when moving between two places, with gold and EXP in it. Suggested: a 3 to 5 room crawl on the Road → Ruins leg, each room one `tableRoll`.
2. **Area level variants.** `foe` on a place is the hook, and each domain now has an Order meter and a secured flag. Del wants the same area at different levels and safe areas that turn dangerous as numbers change. Decency already does the second for safe places.
3. **Balance pass.** Nothing here is tuned. Known rough spots: level 1 solo against the eight-enemy Skeleton Phalanx; EXP per hunt swings from 7% to 68% of a level; Willpower is Valerie's weakest attribute, so getting up and Persuade are hard by design but may be too hard. Del does not need level 100 reachable; balance upward from level 1.
4. **"Say your own thing."** The fifth button in a meeting or standoff is disabled. Del wants it read by a Game Master model with heavy randomness. The page already declares the `sample` capability; `say()` and `thinkAloud()` show how it is called.
5. **Regulars who change.** Rapport is stored and shown as a tier. Nothing unlocks at a tier yet. Their own growth stat is described in the Debugger and not simulated.
6. **Bestiary and enemy pictures.** Fights show a name plate, not a picture. Del has spare clips to bank in a "monster guide".
7. **Items inside the runner.** The page spends Valerie's turn itself when she drinks a potion (it edits the fight state, then plays Guard). The clean fix is item use in `engine/battle.js`, with tests. That is the one item here that belongs in the engine.
8. **Stamina inside fights.** Stamina is spent after a fight, not during it. Del described falling down mid-fight and needing Willpower to stand.
9. **Grok for the right-hand character.** The published page cannot call outside services. It needs a host that can, or a connector.
10. **Phone layout** has not been rechecked since the tray, debugger and left tabs were added.

## Known loose ends

- The page's own rules have no tests. If one hardens, move it to `engine/` with a test.
- The domains are thin: two to four places each, and most share a backdrop. The Academy and the Camps have no regulars and no spots yet. The camp garrison reuses the `horde_at_the_gate` encounter; the three strongholds reuse the three bosses.
- A save from before this version loads, but its place may no longer exist; it falls back to the Castle Gates.
- `stage.html` is one large file. Splitting it is reasonable once the rules stop moving.

## Done looks like

Each item above is its own change: build passes, `npm run all` stays green, the flow is driven once in a browser, and `rpg/playtest/README.md` says what the page now does.
