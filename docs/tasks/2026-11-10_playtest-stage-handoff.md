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
| Callings and attack types | `CALLINGS`, `COURTESAN`, `calling`, `TYPE_WORD`, the `weak`/`tough` fields of a standoff, the `bands` option of `rollCheck` |
| Full-combat screen | `tokenFor`, `TOKENS`, `TAUNTS`, `foeRow` inside `battlePanel`, the `face` option of `post` |
| Heckle fights | `startStandoff`, `standoffAct`, `heckle`, `endStandoff`, `HECKLES`, `HECKLE_SAY` |
| Reputation by place, volatility | `rep`, `repOf`, `repLabel`, `repBonus`, `vouchIn`, `job`, `conduct`, `newDay`, `vol`, `swung` |
| Perks and passives | `PERKS`, `hasPerk`, `grantPerk`, `tally`, `count`, `kitTab`, `passiveBank`, `moreSections` |
| Backlog, stereotype, who is around | `journal`, `once`, `journalTab`, `RACES`, `stereoOf`, `stereoBonus`, `aroundHere` |
| Tabs under the story | `composerTabs`, `socialCells`, `itemCells`, `debugCells` |
| Guild board | `renderGuild` (notices are blind on purpose) |
| Sheet tabs | `overviewTab`, `underTabs`, `sheetOf`, `drivesText`, `writeBio` |
| Falling down | `fallDown`, `getUp` |
| Real fights | `startBattle`, `battleAct`, `battleExtra`, `syncBattle`, `leaveBattle`, `postEvents` |
| Panels | `renderHuds`, `rightPanel`, `mapTab`, `hereTab`, `levelTab`, `debugTab`, `bioTab`, `spicyTab`, `settingsBlock`, `renderDebugger` |
| Her sheet (left panel) | `leftPanel`, `rpgTab`, `momentsTab`, and the `@container` rules that open it up when it is dragged wide |
| Inner voice | `pickThought`, `thinkAloud` (asks Claude's quick model when the toggle is on) |
| Road stretches, signs, suspicion | `goTo`, `jointsOf`, `stretchRows`, `sign`, `micro`, `MICRO`, `ENV`, `ENV_NIGHT`, `SUSPECT`, `FOLLOW`, `heat` |
| Conditions | `COND`, `cond`, `condOf`, `stepOf`, `resistOf`, `nightConditions` (called from `newDay`), and the lines in `repBonus`, `dangerOf`, `useStam`, `heckle` and `aroundHere` that read them |
| Portrait column, folds, three sizes | `leftPanel`, `underTabs` (the fold row), `lookPicker`, `face`, `SIZES`, `sizeL`, `snapL`, the `.pcol` and `@container (min-width:490px)` rules |
| Vitals rail, dice drawer, world plate | `railHtml`, `renderTray`, `worldPlate`, `MONTHS` |
| Backdrops by time of day | `TOWN_SCENES`, `sceneOf`, `drawScene` |
| Collapsing in the open | `fallDown`, `spent`, `S.waiting`, the first line of `getUp` |
| Asking Claude, and counting it | `metered`, `meter`, `aiUsage`, `gaugeDigest`, `FILL`, `fillPrompt`, `fillSheet`, `fillBox` |
| The fixed place grid, street actions | `HERE_ROW`, `TROUBLE_ROW`, `streetAct`, `streetCell`, `placeGrid`, `actCell` inside `travelGrid` |
| Roads on the map and in the panel | `roadPath`, `roadsBox`, `jointsOf`, `stretchRows` |
| Unstick, cheats, simulators | `jiggle`, `stuckNow` (called at the end of `render`), `CHEATS`, `cheatCells`, `SIMS`, `simWalks`, `simRolls`, `simNights`, `simFights`, `simBlock` |

## Decisions Del made (do not reopen)

- Valerie is the focus. Hunts and random fights are her alone. Boss bounties keep a party of four.
- Layout: stats left, story middle with a button grid under it, tabbed panel right. Movement is clicking bubbles on a map.
- Combat is announced by the word COMBAT and locks movement. For now ambushes are heckle fights against a crowd's nerve (strike, sway, persuade, brace, run), with the crowd doing physical, mental or lewd damage. Del asked to focus less on enemies for now; the full battle runner stays for hunts and strongholds.
- Reputation: neglect guild work and the town labels her. Del's words were "an evil person or a slut"; the page says Villain and Town scandal, and treats both as gossip with trade-offs, not a verdict.
- Regulars have hidden numbers. A debugger at the top shows them, along with chances and what just changed.
- Knight theme: four domains around the city (the Academy, the Castle and its dungeons, the Slaver Camps, the Forest), each with an Order meter the knight raises and a stronghold to break. The camps are enemy ground she frees people from.
- Old tools are kept under Debug, never deleted.
- Look and feel follows Del's own Solo Stage, Duet Stage and Character Card pages: the character picture is never framed or covered, one hairline separates things, colour is rationed to one accent per speaker, labels are tiny mono capitals, tabs are underlines. Keep to that.
- Del wants chances to move with what happens, with things that help, prevent or worsen a change, and mistakes that make gauges jumpy. Volatility and the vouching friend are the first two such rules; build more in that shape (one clear cause, one clear cure, shown in the Debugger).
- Drives (wants, needs, the lie, fears) are meant to steer the narrator. They are already passed to the chat and inner-voice prompts; anything new the narrator writes should read them too.
- Del wants the adventure to lean on a passives bank in the manner of Karryn's Prison: what happens to her unlocks passives, and passives feed her inner voice. The six on the page are original and stay PG-13 (attention, blushing, gossip). None of that game's passives or text is imported, and Del's sheet has `lewd: 0`. If Del asks for more, add rows in the same shape.
- Four callings: knight, mage, rogue (Del says "finesse") and courtesan or wench. The first three split slash, strike and thrust, mirroring the three attack types of the game Del is modelling; the courtesan is the social one and is allowed to bend the dice. Del wants each calling to end up with an equivalent, balanced kit. So far only the crowd attack and the courtesan's three tricks differ; the turn-based runner gives every calling Valerie's kit. A proper per-calling kit in `data/` and `engine/battle.js` is the real job.
- Full combat should look like a classic RPG Maker battle screen: enemy list with small portraits and bars, the heroine large, a speaker portrait in the dialogue. Del showed a Karryn's Prison screenshot as the reference for layout only. Attribute names are already this game's own (Might, Arcana, Finesse, Constitution, Willpower, Luck); Del is happy for systems to mirror that game's structure with names changed.
- Social rolls are meant to be most of the "combat". The turn-based battle runner is kept to one side for hunts and strongholds.
- This is not a dating sim. Relationships are about respect, and mood. Del's Character Card page has a Kit tab (perks, moves, gear) and a shelf of passives from another game; the page copies the Kit idea with its own seven perks and does not import that shelf. Del wants moments to grant and change passives, and may bring more of the sheet's tabs across later (interests, knows about, guilty pleasures, a tag calculator), a few at a time.
- The personality types on the sheet are a glimpse for now. Del wants them to become a system later.
- The left panel is Del's character sheet in miniature. Pulled wide it should read like the Character Card page: picture on the left, tabbed sheet on the right. Del wants the right-hand panel to get the same treatment later.
- Body trackers (bust, hips, size, chemistry) are wanted, with a different reason per class: warrior hormones, mage mana, rogue greed.
- The left panel copies the left side of Del's Character Card: portrait, a row of folds, then the sheet, with no boxed info cards. HP, mana and stamina live beside the panel, not in it, and opening them shows her mood. The panel has exactly three sizes (min, half, full) and pushes the chat column over. The dice come out of the chat box. Del asked for the look to be "a bit more RPG": the gold double frame, the corner studs, the cursor on the buttons and the die are that.
- Del's pictures: 27 town backdrops are all in use. Of 12 character cutouts, six are in use (four as poses for Valerie, two as new regulars), one is a duplicate, and five were left out; the reply to Del on 2026-11-10 says which and why. Do not add the five without asking Del again.
- Text stays PG-13. Del's card has `aiBias.lewd: 0` and the trackers switched off; the page shows the trackers as numbers and keeps the writing clean.
- Karryn's Prison and Corruption of Champions are references for structure and layout only. No content, names or numbers were taken from either, and none should be.

## Conditions: half built

Del asked for a resistance system in the manner of Karryn's Prison, re-themed, then asked for "the breast growth thing and the pheromone sensitive thing" first, and for the world to react to them.

Built: Swelling (Constitution) and Pheromones (Finesse), each a 0 to 100 gauge with a step every 25, resistance that trains by exposure, a nightly move with a morning report, world reactions (roll bonuses and penalties, fight chance, catcall mix, followers on the road, the crowd row, a regular who refuses to talk at 75), and cures that already existed (a bed, a soak, a Calming Tea). `rpg/playtest/README.md` has the numbers.

Not built, from the plan Del was shown (the two open choices were settled by default because Del moved on without answering):

- Fever (Might; hurts stamina costs and Clever, helps Strike) and Corruption (Willpower; hurts Friendly and reputation gains, helps Bold). Add each as a row in `COND` and its reactions beside the existing two.
- A shift at the Gilded Goose (three rolls) that pays gold and city reputation and risks catcalls, so there is a way to earn the cures.
- A cure for Swelling sold at the shop. Today only a real bed lowers it.
- Nothing is tuned. With no bust tiers Swelling only ever falls; Pheromones fall about five a night at level 1. The "30 nights" simulator shows the curve for the current save.

Del also said there is a SillyTavern JSON with material to adapt into random events. Only a picture arrived in the session (a modern city crowd scene), with no card data inside it. The fourteen road events in `MICRO` are original. When the JSON arrives, adapt its events into `MICRO` rows (one roll each) or into `data/events/` packs (full story events), re-themed to the knight setting and kept PG-13.

Also asked for and not built: three or four playable characters, one per calling, who sometimes join as a party (the callings exist now as ways to play Valerie, not as separate people); a portrait per mood (the hook is `MOOD_FACES`; Del has mood pictures for one character only).

## What Del asked for that is not built, in suggested order

1. **A small dungeon between places.** Del wants a short stretch to cross when moving between two places, with gold and EXP in it. Roads now have one to four stretches with signs and one-roll events, which is the first half of this. Still missing: a named crawl of 3 to 5 rooms with its own reward at the end.
2. **Area level variants.** `foe` on a place is the hook, and each domain now has an Order meter and a secured flag. Del wants the same area at different levels and safe areas that turn dangerous as numbers change. Decency already does the second for safe places.
3. **Balance pass.** Nothing here is tuned. Known rough spots: level 1 solo against the eight-enemy Skeleton Phalanx; EXP per hunt swings from 7% to 68% of a level; Willpower is Valerie's weakest attribute, so getting up and Persuade are hard by design but may be too hard. Del does not need level 100 reachable; balance upward from level 1.
4. **"Say your own thing."** The fifth button in a meeting or standoff is disabled. Del wants it read by a Game Master model with heavy randomness. The page already declares the `sample` capability; `say()` and `thinkAloud()` show how it is called.
5. **Regulars who change.** Rapport is stored and shown as a tier. Nothing unlocks at a tier yet. Their own growth stat is described in the Debugger and not simulated.
6. **Bestiary and enemy pictures.** Fights show a name plate, not a picture. Del has spare clips to bank in a "monster guide".
7. **Items inside the runner.** The page spends Valerie's turn itself when she drinks a potion (it edits the fight state, then plays Guard). The clean fix is item use in `engine/battle.js`, with tests. That is the one item here that belongs in the engine.
8. **Stamina inside fights.** Stamina is spent after a fight, not during it. Del described falling down mid-fight and needing Willpower to stand.
9. **Grok for the right-hand character.** The published page cannot call outside services. It needs a host that can, or a connector.
10. **The right panel as a sheet.** Del showed the left one as the example; the resident's panel should open the same way.
11. **Phone layout** has not been rechecked since the tray, debugger and left tabs were added.

## Known loose ends

- Dragging the panel edge inward used to die after the first nudge because the browser started dragging the picture under the pointer. `dragstart` is now cancelled while resizing. If resizing ever feels sticky again, look there first.
- AI fill and the token tally were tested with a stand-in for Claude that returns fixed text. They have not been run against the real model. The token numbers are estimates and say so.
- Del asked for "4 shops 4 inns maybe". It was read as one inn-and-trader per outer domain. If Del meant four of each inside the city, add places to the city map; `SPOTS` takes a `shelf` spot per place and `rest` works anywhere.
- The four waystations have no regulars and three of them borrow a town backdrop (`TOWN_SCENES`).
- Seasons are display only. Nothing reads the month yet.
- Del reported being stuck with nothing to press on the version before Jiggle free. A 700-click random walk through the new version found no dead end, so the cause was not reproduced. If Del reports it again, ask what the mode badge in the top bar said.
- The left panel still sets the `sheetL` body class when it is 544px or wider; it now only decides whether the extra sheet sections show. The sprite no longer slides.
- The page's own rules have no tests. If one hardens, move it to `engine/` with a test.
- The domains are thin: two to four places each, and most share a backdrop. The Academy and the Camps have no regulars and no spots yet. The camp garrison reuses the `horde_at_the_gate` encounter; the three strongholds reuse the three bosses.
- A save from before this version loads, but its place may no longer exist; it falls back to the Castle Gates.
- `stage.html` is one large file. Splitting it is reasonable once the rules stop moving.

## Done looks like

Each item above is its own change: build passes, `npm run all` stays green, the flow is driven once in a browser, and `rpg/playtest/README.md` says what the page now does.
