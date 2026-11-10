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
| Pinned, passive rank, crowd size | `pinDown`, `pinnedAct`, `passiveRank`, `crowdSize`, the `pinned` branch at the top of `travelGrid` |
| Cast view | `renderCast`, `shade`, `FOE_TIER`, the `inn`, `guarded` flags on `CAST` |
| Guarded answers and talents | `retest`, `TALENTS`, `talentOf`, `S.retest`, `S.passed` |
| Big window | `keepCard`, `renderBig`, `snapshot`, the `big` option of `post`, `WHY_*` |
| The other character's card | `themFace`, the top of `hereTab`, `S.autoThem` in `rightPanel` |
| Screen scaling, centred chat, panel overlay | the `v24` block at the end of the stylesheet (`--col`, `--hudMin`, `--hudR`, `html{font-size}`), `SIZES`, `sizeNear` |
| Bars and their pop-up | `railHtml` (in her panel), `railPop` (on the stage, `#railPop`), the `railhover` body class |
| Dice window | `renderTray`, `dockTray`, `S.trayPos`, `S.rollLog`, the pointer code beside `railT` |
| Thought bubble | `renderThought`, `placeThought` |
| Guild jobs | `JOBS`, `takeJob`, `jobCells`, `doJob`, `jobBoard`, `S.job`, `S.jobsDone` |
| Talk as you pass | `CHATTER`, `chatterTags`, `chatterNow`, `chatGen`, `S.chatBank`, `S.thoughtBank` |
| Growth and enemy ranks | `openGrowth`, the `bloom` potion, `foeRec`, `foeName`, `foeResult`, `openBook`, `S.foes` |
| Right-panel folds and objectives | `rfold`, `objectivesBox`, `roadsBox`, `S.rfold` |
| Story choices in the grid | `showEvent` (sets `S.event`), `eventCells` |
| Composure, catcalls, thought pops | `composure`, `composureScore`, `COMPOSURE`, `catcallWalk`, `CALLERS`, `REACT`, `thoughtPops` |
| Amaranth and Corruption | `maybeVisit`, `visitChance`, `dreamCells`, `dreamAct`, `DREAM_*`, the `corrupt` row of `COND`, the `bless` act, `S.dream` |
| News, notifications, big trouble | `WORLD`, `worldEvent`, `worldTick` (called from `passTime` when the phase changes), `toast`, `newsBox`, `REACT_W`, `BADDIES`, `baddieAt`, `baddieCheck`, `bigResult`, `openCell`, `S.news`, `S.baddieDown`, `S.loose` |
| Del's secondary cast, rivals who turn, playing as Pip | `SECOND`, `HOSTILE`, `rivalFight`, `turnRival`, `secPose`, the `ally` branch in `hail`, `S.turned`, `S.secMet`; `PCS`, `PC_ID`, `SHEET_KEY`, `playAs` |
| API tab, vault, share codes | `apiHtml`, `apiClick`, `apiTest`, `VAULT`, `vaultConnect`, `vaultSave`, `vaultLoad`, `vaultTick` (called from `passTime`), `shareMake`, `shareLook`, `shareUse`, `shareDrop`, `cleanShare` |
| The character page | `PROFILE`, `LOOKTXT`, `viewData`, `viewList`, `openViewer`, `viewerHtml`, `viewerClick`, `cvZoom`, `cvApply`, `S.viewing`, `S.cv` |
| Conversations and expressions | `convoOpen`, `convoOptions`, `convoCells`, `talkPick`, `convoAsk` (the Claude prompt), `convoFallback`, `MOODS`, `moodLook`, `INTENT`, `talker`, `S.convo`, `S.secretKnown`, `S.aiTalk` |
| The lead and the assistant | `PCS`, `PC_ID`, `ASSIST`, `VAL_CARD`, `heroLook`, `assist`, `asstTip`, `VAL_OPEN`, `VAL_CHEER` |
| Loop clips first | `loopOf`, `loopFor` on `LOOKS` entries, the `keyw` flag and the `#keyWhite` SVG filter, `cvPlay`, `S.loopPrio` |
| The Town Girls | `TOWN` (generated from Del's `Town_Girls` dialogue files), the `town` kind in `hail`, `S.townMet`, the Cast section in `castHtml` |
| Wanderers and the movement maps | `countsFor` (the big map), `WANDER`, `KIND`, `CATS`, `catOf`, `inTown`, `wanderStep`, `wanderHours` (called from `passTime`), `wanderNotice`, `arriveCheck` (end of `arrive`), `hail`, `tokensFor`, `movesBox`, `passingRow`, `S.wander`, `S.guest` |
| Full-screen menus | `MENUS`, `renderMenu`, `herHtml`, `castHtml`, `loreHtml`, `settingsHtml`, `loreClick`, `S.menu`; the overlay element is `#charmenu` |
| Lore and Claude-written news | `LORE`, `loreDigest`, `newsGen`, `S.lore`, `S.newsBank`, `S.autoNews` |
| Stat tiles (right panel), close-ups, growth portrait | `statStrip` (returns HTML; drawn into `#hudR #statStrip`), `closeFit`, `body.closeup`, `GROW_FACE`, `growFace` |
| Routines, phrases outside the chat, the klutz | `LOOPS`, `stepToward`, `loopNext`, `wanderStep` (`wait`, `leg`), `BARKS`, `placeBark`, `bark`, `barkOf`, `barkTick`, the `#bark` element; `KLUTZ`, `klutzMoment` |
| Meme, the helper | `MEME_HELLO`, `MEME_RULES`, `memeFacts`, `askMeme`, `memeToggle`, `memeCell`, `idleR`, `S.meme` |
| Layout circles, what changed | `LAYS`, `layPill`, `applyLay`, `setLay`, `S.lay`, the `lay1`/`lay2`/`lay3` body classes; `NEW_VER`, `NEW_UI`, `showNew`, `hideNew`, the `#newLayer` element |
| Moves on the chat bar | `movesNow`, `moveCells`, `moveAct`, `MOVE_SAY`, the *Your moves* row in `placeGrid` |
| Help windows, the attribute line, the numbers table | `HELP`, `helpBtn`, `helpBox`, `S.help`; `ATTR_USE`, `attrBars`, `attrLine`; `numbersHtml` (reads `__m.progression` and `__m.stats`) |
| Right now (how she feels) | `HEART`, `STAGES`, `EMOS`, `HEART_DEF`, `HEART_COLD`, `MOOD_HEART`, `SAID_HEART`, `WANTS`, `THINKS`, `heartOf`, `stageOf`, `heartMove` (called from `talkPick`), `heartRest` (called from `worldTick` in the morning), `heartThink`, `nowCard`, the `now` tab in `rightPanel`, `S.heart` |
| Chapters and the opening | `chapterList`, `chapterNo`, `CHAPTER_SAY`, `BOOK`, `chapterOpen` (from `showEvent`), `chapterClose` (from `chooseEvent`), `chaptersHtml`, `S.chap`, `S.book`; `OPENING`, `playOpening` |
| Fast travel | `fastTo`, `fastSelect`, `S.walked` (set in `goTo`), the `'fast'` value of `held` in `arrive` |
| The picture library | `ownerOf`, `libPeople`, `sortFile`, `LIB_ALIAS`, `libAdd`, `backdrops`, `libraryHtml`, `S.libTab`, `S.libWho`; the two file inputs `#libAdd` and `#libAddDir` sit in the page itself so a redraw cannot replace them |
| More than one answer | `swipeOpen`, `swipeSeal` (called first thing in `post`), `swipe`, `swipeBar`, `takeLine`, `TAKES`, `S.swipe` |
| One-line arrivals, no repeats | `arrive` (description only on a first visit), the guard at the top of `post`, `S.said` |
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
- This is not a dating sim. Relationships are about respect, and mood. (Later the same day Del asked for a social element "mixed with dating sims": see the Right now tab in the last pass below.) Del's Character Card page has a Kit tab (perks, moves, gear) and a shelf of passives from another game; the page copies the Kit idea with its own seven perks and does not import that shelf. Del wants moments to grant and change passives, and may bring more of the sheet's tabs across later (interests, knows about, guilty pleasures, a tag calculator), a few at a time.
- The personality types on the sheet are a glimpse for now. Del wants them to become a system later.
- The left panel is Del's character sheet in miniature. Pulled wide it should read like the Character Card page: picture on the left, tabbed sheet on the right. Del wants the right-hand panel to get the same treatment later.
- Body trackers (bust, hips, size, chemistry) are wanted, with a different reason per class: warrior hormones, mage mana, rogue greed.
- The left panel copies the left side of Del's Character Card: portrait, a row of folds, then the sheet, with no boxed info cards. HP, mana and stamina live beside the panel, not in it, and opening them shows her mood. The panel has exactly three sizes (min, half, full) and pushes the chat column over. The dice come out of the chat box. Del asked for the look to be "a bit more RPG": the gold double frame, the corner studs, the cursor on the buttons and the die are that.
- Del's pictures: 27 town backdrops are all in use. Of 12 character cutouts, six are in use (four as poses for Valerie, two as new regulars), one is a duplicate, and five were left out; the reply to Del on 2026-11-10 says which and why. Do not add the five without asking Del again.
- Del asked for the downed state to work like Karryn's Prison's. The structure was built (pinned, four ways out, counters that unlock passives, more of them as rank rises). The explicit content was not, and the assistant told Del so on 2026-11-10.
- Del asked for Karryn's Prison's dialogue, for her to be "horny", and for her to crave "dark men". What was built: original lines only; attraction written as being flustered by big, imposing men, at PG-13; nothing keyed to skin colour or race. The assistant told Del this on 2026-11-10. Keep to it.
- Amaranth is Del's purple demoness ("the corrupter of her"). Her clips are cropped to waist-up, which also keeps a playing-card tattoo on her thigh out of frame. Del sent four more pictures in the same message (a rabbit girl, two elves with stat cards, a guard with a halberd); they were not saved to disk in that session and are not in the game.
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

## State on 2026-11-10, end of session, for whoever picks this up (Del mentioned Opus 5.5)

Start by reading `rpg/playtest/README.md`: its "What is on the page" table is current. Then open the published page. Del comments directly on the page; each comment names the element it is pinned to, and Del expects a reply in that thread.

How Del works: many short messages while a pass is still running, some reversing the last. The newest wins. Del does not want questions; Del wants a pick made and built ("think for me, do and fill out, make a game"). Del's screen is about 2000 px wide, so check any layout at 2000x1085 as well as 1440x900.

Built in the last pass and merged: screen-scaled layout with the chat dead centre; bars pinned at the top of her panel with a pop-up beside it; four panel sizes; both figures always on stage with Ctrl + scroll resize and idle movement; thought bubble over her head; sharp chat plates; the dice as a dockable, draggable window with a roll log; map key, Book of Trouble and enemy ranks; right-panel folds and Objectives; guild jobs; town chatter with a Claude-fed bank; Bloom Draught and the Growth window; five more passives; every place on one of Del's paintings.

Asked for and not built yet:

1. ~~A pause menu that holds all the character information~~ Built in v28 as the **Valerie** full-screen menu. It edits her story, calling, race and looks; it does not yet create a second character from nothing.
2. **Chat text that is not in a bubble and means different things.** Narration is unboxed now; Del wants more kinds of unboxed text with distinct meanings (for example sounds, time passing, a rumour).
3. **A stat block for a quick read of any character.** Her own numbers now use the card creator's tile format, in the right panel under the world plate. The same tiles for the person on the right are not built.
4. **More action buttons at the minimum panel size.** Potions and Growth are there; Del asked for "buttons of action".
5. **A party.** Del's allies exist and can be hailed, but nobody joins a fight yet. The four callings are still all Valerie (or Pip).
6. **Full sex-combat in the downed state and Karryn's Prison's own passive list.** Not built and not going to be: see Decisions. The pinned state and the original passives are the version this project has.
7. Fever, Corruption, the bar shift and a shop cure for Swelling, from the conditions plan.
8. The SillyTavern JSON Del mentioned has never arrived in a session; only pictures have.

### Added on 2026-11-10, later pass (v28, artifact version 25)

Built and merged: twelve-hour clock; top tabs that open full-screen menus (**Valerie**, **Cast**, **Lore**, Settings), which is the "pause menu / beta character creator" Del had asked for; a stat strip under the top bar in the card creator's `.dstat` tile format (taken from `desktop-companion/st-card-creator`, which is what Del meant by "the single character creator's stat thing"); news with weights and notifications; seven big enemies including Brakk the Breaker and the one behind cell nine; twenty wanderers in three categories with a movement map; close-ups in dialogue; a portrait that follows growth. The README's rules list has each of these.

Decisions made in that pass:

- Del's name for the roaming enemy was not PG-13. He is "Brakk the Breaker, whom the camps call something ruder".
- "Add these characters to be random spawns" arrived before its attachments. The forty pictures in `Nyx_Classes` (one blonde elf in seven class outfits) became the seven Vantari sisters. Only the `_v1` pictures are used (21 files); the `_v2` set is spare.
- The orcs in Del's cell picture became two hostile wanderers and one friendly cook, plus Gorefist behind cell nine.
- "Categorise NPCs: important, non-violent, leavers" is `CATS`: important (the regulars, who have a place), peaceful, leavers, hostile, big trouble.
- "Wish Valerie in the portrait had bigger breasts": pictures cannot be repainted here, so her card now climbs through the bustier pictures already supplied as her growth tier rises.
- A dungeon corridor picture Del pasted did not reach the disk in that session, so it is not on the page. If it is sent again as a file it belongs on the Castle Dungeons (`TOWN_SCENES.ruins`).
- The old `#cast` panel and `renderCast` are still in the file but nothing opens them; the Cast tab calls `castHtml` into the menu.

- Del then said: make the map easier to remember, put similar things together, and stop showing the same thing again and again. What changed: the big map shows a head-count per place instead of a token per person; the key is in three groups; the folds are grouped under four labels; the separate list of roads is gone (the Go row has its numbers); the stat strip no longer repeats HP, Mana, Stamina or the clock; Lore no longer repeats the news; Settings no longer repeats full screen, the world switch or Jiggle. **Before adding anything to this page, check whether it is already shown somewhere, and put it there.**
- Del's comment on the tab row: the four tabs go under the buttons, and Jump belongs on the map. Done. The old row of Jump buttons in the Debug tab is behind a Settings switch (`S.tpRow`) that the browser tests turn on.
- `Town_Girls` (twelve folders, a dialogue file and one or two pictures each) became `TOWN`. Their lines are used as written. Line 2 and line 3 are read as her reaction to how composed Valerie is.

- Del then sent three roster archives (four witches, six rogues, plus two bosses sent earlier) and said one is playable: "the ginger rogue", which is **Pip Copperfinch**. All twelve are in `SECOND`. The seven written as enemies or rivals start hostile and turn ally the first time she beats them, which is what their cards say happens. Pip is playable as a second name, face, calling and story on the same save.
- A courier wanderer used to be called Pip Quickpenny. He is Dash Quickpenny now so there is one Pip. His key in `WANDER` is still `pip`; Pip Copperfinch's is `copper`.
- Not used from those archives: the "torn" pictures, the second copies of each pose, Vexa's three clips, and the `prompt.txt` / `card.json` files.

- Del asked for an API tab that "connects, memorises, vaults and shares securely", from a key or "from your vault". Built without any key entry: a page in a browser cannot keep a key safe and this one cannot reach outside services. The credentials stay with the viewer's Claude account; the page gets `sample`, `db` and `user`. **Publishing must now declare all three capabilities** (`{sample:{}, db:{}, user:{}}`) or the vault stops working.
- The vault and share codes have only been run against a stand-in database in the browser tests, not the real one.
- Del asked to "zoom in on the main characters", with body dimensions and "a reveal or secret". That is the character page. Body numbers are tiers and a height, not measurements.

- Del then sent Ember Vale ("main new character", then "Ember main character", then "Valerie will be her assistant", then "Valerie can be a main character, I don't know yet until I can get her a ref"). Built so both can be true: a fresh save leads with Ember and Valerie assists; the switch on the first tab puts Valerie back in the lead, and then there is no assistant. **Ember's lore, lines, secret and sheet were written for her because no sheet came with the pictures; replace them when Del sends one.**
- "A system for multiple prompt responses that are aware of context and actually change expressions" is the conversation system. With Claude allowed it costs one small request per reply.
- From the pose packs: Ember's "needy" clip and "dazed" picture are not on the page; Morwyn Duskthorn and ten others in the knocked-out pack have no sheet and are not in the game; the Seraphine in that pack is a different character from the courtesan Seraphine Luxe.
- The browser tests are pinned to Valerie (`oops-pc`), except the ones that test switching.

- "Have the loop videos have priority in the play list": clips now stand in for the stills they match, lead the pose lists, and a character page can play through her poses. Ember's two clips have a shaded studio backdrop, so they show framed; Vexa's three are on white and are keyed. A clip exported on plain white will key the same way: add `keyw: true`.

Loose ends from that pass: `newsGen` has only been run against a stand-in for Claude; the Debug button has since left the top bar at every width (Settings and the Debug tab still have it); thought bubbles are placed for the un-zoomed figure, so in a close-up they sit a little off her head; the wanderers have no art apart from the sisters and show as silhouettes in the Cast menu.

### Added on 2026-11-10, last pass (v34 to v36, artifact version 31)

Built and merged:

- Five clips of Valerie's new look ("have videos inversed for Val"): each plays forwards then backwards so the loop is seamless, and `faces` mirrors a clip so she looks into the scene from either side. The turnaround clip is her standing picture as the assistant.
- **Meme** ("her name is Meme, use AI, you help out and stuff"): the cat-eared priestess is the helper. She answers through Claude from facts the page writes (`memeFacts`), so she cannot invent rules.
- Del's voice note about the chat: "the middle bar has so much stuff on top of it", "Troll Bridge is said repeatable times", "I don't like all these repeatable things", "the level, put that on the right side", "Debug". What changed: the stat tiles moved to the right panel; the Debug button left the top bar for good (it is a switch in Settings and in the Debug tab); a place is described once and later arrivals are one line; the Game Master will not repeat a sentence it said in its last thirty; the walk-in notification is gone (the map count, the Passing through row and the spoken phrase already say it); notifications sit over the right panel.
- "A loop of other major characters going through their own little loops, RNG movement and waiting": `LOOPS` and the new `wanderStep`.
- "A phrase she would say that wouldn't even be in the chat box": `BARKS`, shown in `#bark`.
- "We started with Val being a very big klutz, we could work with that": `KLUTZ`.
- "A system that allows multiple responses, very smooth": the arrows under the newest written reply (`swipe`). Conversation buttons (the `talkPick` replies) do not have arrows yet; they return a mood with the line, so a second take would also have to redraw her face.

Decisions made in that pass:

- Meme has no still picture (the one Del pasted did not reach the disk), no sheet and no secret; her page says so. Her clips are on black and she wears light colours, so they use the `keyb` filter. Valerie's turnaround is on black too but her outfit is dark, so it stays `keyed`.
- Del asked whether the page could "hook up directly to Featherless as an API thing" through an extension. Answer given: yes, through Del's own SillyTavern extension in `desktop-companion/st-card-creator/extension`. **Built** as version 0.1.6 of that extension (Daleah666/desktop-companion pull request 16): a Game button and a wand-menu entry open this page over the whole window; `game/adapter.js` sends the page's `sample` calls through SillyTavern's `generateRaw`, so it runs on whatever SillyTavern is connected to, with no key in the page; saves and the vault go to the extension's IndexedDB. After this page changes, rebuild it there with `node build-game.mjs <path to rpg/playtest/out/oops-playtest.html>`. Pictures are not in git: the `art` folder is copied to `game/art` by hand. Checked only against a stand-in for SillyTavern, never inside a real one or against Featherless itself.

Loose ends from that pass: the browser test `drive28` once failed on a button that was redrawn between being found and being clicked (a timer render); it passes when run again. Meme, the arrows and the phrases have only been run against a stand-in for Claude.

### Added on 2026-11-10, after that (v38, artifact version 32)

Built and merged, from two voice notes:

- "I'm a little bit overwhelmed... a little button that's rainbow so I know exactly where it is... three little circles that I could click and change the layout... give a little explanation": the rainbow ring beside Say with three circles (`setLay`). It sits in the Say row because the top bar has no room at 1440 px and the Say row is on screen in every mode.
- "Put RGB around certain things that you changed... give me some picture": `showNew`. **When a later pass changes the page, update `NEW_VER` and `NEW_UI`** (a selector and one sentence per change) so Del gets the rings again, and send Del a screenshot of them.
- "I don't really know the explanation of this attributes thing": `attrHelp`.
- "Any of my moves should be on the chat bar": the *Your moves* row. In a real fight the moves were already the skill list.
- "I gave you them in files and folders, so they should be together... auto sort... picture library should have a little tab that just has the people and then some miscellaneous": the library tabs and `sortFile`.

Decisions made in that pass:

- Del said again: "You are doing Karryn's Prison passives... not the sexual stuff, but they are gonna be very incentivizing." What was built: six more passives in this game's own bank, in the same shape (something she keeps doing, a counter, a permanent change), each one a plain reward so there is a reason to chase it, plus the note when one is in reach. That game's passive list, names, numbers and text are still not imported, and the assistant told Del so. Keep to it.
- Outside a fight a move had no meaning before this pass. The meaning given (one roll, once per visit, reward by attribute) is the assistant's pick; Del has not seen it yet.
- Pictures Del adds through the library are held by the browser tab only. Keeping them needs the `assets` capability, which the page does not declare.
- The move buttons and the library use Valerie's skill list for every lead, as the Kit tab already did. Ember and Pip have no moves of their own yet.

Loose ends from that pass: in the smallest layout the left panel is the bars alone, and the size strip under them still works independently of the circles (picking a circle sets the size; picking a size does not move the circle). The rings are placed once when shown and do not follow a resize.

### Added on 2026-11-10, last of the day (v39, artifact version 33)

Built and merged, from a screenshot and four short messages:

- Del sent a screenshot of the Right now panel from the card creator (a character called Belladonna: mood, thought, want and cost, six bars) with "use this and plug in for character mood if used". It is the **Right now** tab. The names and default numbers of the bars and the six stage names are Del's own, copied from `desktop-companion/st-card-creator/extension/index.js`.
- "For story events call them chapters, give them dialogue or milestones": **Chapters**. The spoken lines in `CHAPTER_SAY` and the milestone names are the assistant's.
- "Clump similarities together and help menu be expandable windows with a question mark... put the might arcana finesse all of that": the **?** windows and the one-line attributes.
- "If you get there on foot you can fast travel": **Fast travel**.
- "Start at the beginning with an opening in the debug area so I can see the start, have a little bit of story": the **prologue** and **Play the opening**. It replays the story; it does not wipe the save.

Decisions made in that pass:

- Earlier Del decided "this is not a dating sim". Del has now said the game should have "a social element" and things "mixed with dating sims". The Right now bars are the first piece of that. Respect and rapport for the regulars are unchanged, and the regulars do not have a Right now tab yet: only people the conversation system can talk to do.
- Del asked to "use Karryn's Prison stats... their exact same stat block... just change the name... their enemies exactly the same", as a foundation to learn the numbers from, then clarified it is a starting point to adapt. **Not done**, and the assistant told Del so: another game's stat block, numbers and enemy list are not copied here, renamed or not. What Del gets instead is this game's own number system, which already exists in `rpg/engine` with tests, shown as a table in the Lore menu so Del can read it and say which rows feel wrong. Offered next: more enemies of this game's own (there are eleven kinds in five encounters and three bosses), and talents learned through fighting, built on the passives bank.
- Del floated renaming Level ("Fae level or some other type of level thing"). Not changed; it is Del's call and one word in the page.
- The want-and-cost lines in `WANTS` (thirteen of the main cast) are the assistant's, written from each character's own trope and temperament lines. Town Girls and the Vantari sisters have none, so their card leaves that line out.

Loose ends from that pass: the Right now tab is only on the right panel, not on the character page; the regulars are not in it; `heartThink` and the extra line in the conversation prompt have only been run against a stand-in for Claude; the test `drive22` can fail when a night visit opens after it sleeps at an inn (it passes when run again).

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
