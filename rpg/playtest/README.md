# The playtest stage

`stage.html` is the template for the playable page: a visual-novel stage where Valerie walks around the town of Gooseford, talks to the regulars, takes quests, and fights with the real rules. Nothing in it is a mock-up. The build inlines the modules from `engine/` and the files from `data/`, so every roll on the page is the engine's roll.

```bash
npm run playtest
```

That writes `playtest/out/oops-playtest.html` (ignored by git). Open it from a folder that also holds the art, or publish it as a page with the art beside it.

## What is on the page

The whole layout scales with the screen (type, panels and the chat column), so it fills a wide monitor. The chat column is always dead centre.

| Part | What it does |
|---|---|
| Left panel, top | Her **bars**, pinned: HP, Mana and Stamina, thick, with the numbers in them, and her mood. Hover them (or click to pin) and a pop-up opens beside the panel with the Airhead gauge, every bar and her states. Under the bars, a thin strip of four sizes: **Bar**, **Min**, **Half**, **Full**. Dragging the panel edge lets go onto the nearest. At Half and Full the panel slides over the stage. |
| Left panel, sheet | Her portrait (click it to pick a pose for the stage and, separately, a face for the card), a row of folds (Backlog, AI fill, Bio, Drives, Personality, Relationships, Moments, Passives, Body), a **Combat** block (six attributes as bars, her attack, potion buttons, **Growth**), then the tabs: Overview, Status, RPG, Kit, Spicy, Settings. |
| Stage | Her full figure on the left and whoever is at this place on the right, always, except for a moment while she walks and during a fight with a crowd. Ctrl + scroll over a figure makes it bigger or smaller. Her thought is a bubble over her head. Figures breathe and shift; Settings turns that off. |
| Top of the middle | One line: the views (**Stage**, **Guild**, **Cast**, **Export**), the mode pill, **Debug**, **Jiggle**. |
| Middle | The story. Each speaker has a sharp-cornered plate with a colour bar on their side; the Game Master's narration has no box. Under it, the chat box: four tabs (Responses, Social, Items, Debug), then the roads out. Story-event choices and guild-job choices appear in this grid, not in the story. In a standoff the crowd's nerve bar sits just above it. |
| The dice | A window of their own. Its home is the top of the right panel; drag it by the header to float it anywhere (it remembers), and "dock" sends it home. It shows the roll, its bands and arithmetic, the last four rolls, and on the road what is weighing on the walk. |
| Right panel, top | The **world plate**: time and phase, the date (four months of 28 days, one per season), the place and domain, how dangerous it is with the fight chance and the enemies' rough level, and what that domain's people know her as. |
| Right panel, Map | The map first, with a key: pink dot someone, gold ! a story, green ✦ your job, cyan ⌂ a bed, violet ◈ a trader, gold ★ a stronghold, red ring trouble. Roads bend once per stretch. A **Book** button opens the Book of Trouble. A "Walk to" list sits under the map. Then folds, one open at a time: Roads from here (each a button), Objectives (a bar and four ticks), Around here, Talk as you pass, Here, The four domains. |
| Right panel, Them | Opens by itself when she is dealing with someone: a portrait card like hers, their respect, whether they are guarded, their mood and bars. |
| Right panel, Level / Debug / Fight | As before: level-up and callings; cheats, simulators and the old tools; the enemy list in a real fight. |
| **Guild** view | Jobs on top (sealed notices), then quests, hunts and bounties. |
| **Cast** view | Her, the regulars, the innkeepers, and the shapes on the road. |

## The rules the page adds on top of the engine

These live in `stage.html`, not in `engine/`. They are playtest rules: cheap to change, and not yet covered by the test suite.

- **Clock.** Walking, talking and resting move a clock. Four phases tint the scene. Shops, the guild and the bar keep hours, and a regular is only at their place during theirs.
- **Domains and order.** The city is the hub. Around it are four domains, each with its own map: the Greenwood, Castle Greywatch and its dungeons, the Academy, and the Slaver Camps. Each has an Order meter (0 to 100). Winning fights, talking enemies down, quiet patrols and freeing captives raise it; losing lowers it. Order moves the fight chance by 0.3 a point around 50. Each domain has a stronghold (a boss, or the camp garrison); breaking it secures the domain and cuts fight chances there to 40%.
- **Zones.** Each place is `safe`, `risky` or `wild`, with a fight chance (`enc`), an event chance (`evt`) and an enemy strength (`foe`, a share of her level). Entering or exploring a place that is not safe rolls one d100 against that table.
- **Fight chance.** Place + 15 at night + half of every point of decency under 50 + 10 when stamina is under 25. In a safe place it is zero until decency drops under 30; then even townsfolk try it.
- **Combat is a crowd with nerve.** An ambush is a heckle fight, not a stat block. The crowd has a Nerve bar at 100. Each round she picks Strike (Might, nerve −25), Sway (Luck plus her bust bonus, −30), Persuade (Willpower, −30, and a critical ends it), Brace (halves the next thing) or Run (Finesse). Then the crowd answers with one of four things: a shove (physical, melee), something thrown (physical, direct; it can bounce), jeering (mental: stress) or catcalls (lewd: decency down, chemistry up). Shoves and throws use the engine's real attack against her, so her dodge and bounce work. Nerve at zero and they scatter; eight rounds and they get bored; her HP at zero and they win. Movement is locked throughout. The full turn-based battle is still there for hunts and strongholds, and a setting offers it in ambushes too.
- **Callings.** Four ways to play her, picked on the Level tab. Each uses its own attribute line and sets why her bust grows. Three of them split the attack types between them, and every crowd has one weak spot (×1.5 nerve damage) and one thick skin (×0.5) among those types, found out by hitting it.

  | Calling | Attribute line | Attack against a crowd | Signature |
  |---|---|---|---|
  | Klutz Knight | her own | Slash, on Might | Luck |
  | Hedge Mage | the mage's | Force Strike, on Arcana | Willpower |
  | Light-Foot (rogue) | the rogue's | Thrust, on Finesse | Finesse |
  | Courtesan | the page's own, on the same budget | Slap, on Might, no type | Luck |

  The Courtesan plays the dice instead: Flirt, Sway and Persuade +5; the first failed Sway or Persuade in a fight is rolled again; she can push her luck on the next one (crit band tripled, fumble from 86); and she sees what a stranger likes before a first impression. In the turn-based battle runner she still fights with Valerie's own kit whatever the calling; only her attributes change there.
- **When talking fails.** A heckle fight that reaches round eight with the crowd's nerve still above 40 becomes a real fight. So does running out of stamina in the middle of one. The full battle then opens with the enemy list first: each enemy has a small drawn portrait, a health bar, a nerve bar (the runner's stress), and Might, Finesse and Mana. Enemy lines in the story carry the same portrait. The portraits are drawn in the page (`TOKENS`, picked by name in `tokenFor`); no picture files.
- **Reputation, place by place.** The city and each domain keep their own number, 0 to 100. Guild work raises it where it is done: quests, guild hunts, freeing captives, breaking a stronghold. Every morning without guild work the day before lowers it everywhere. Under 35 a place picks a label from how she has been carrying on: Villain, Town scandal or Layabout. Each label helps one kind of roll and hurts another. A regular who lives in a place and likes her halves what she loses there.
- **Perks from moments.** The Kit tab lists her perks: always on, each one changes a single number. Four come from finishing a particular quest and three from play (break two crowds, break one with a Sway, get back up twice). `PERKS` in `stage.html` is the table: a name, what it does, how it is earned, and optionally the event that grants it. The hook that applies each one sits next to the number it changes.
- **The passives bank.** Six passives unlock from what keeps happening to her: being whistled at, swaying at crowds, hitting first, falling over, her chemistry running high. Each changes a rule or two, not always in her favour, and adds a line to her inner voice. They are the page's own, written for it. Add one as a row in `PERKS` with a `quote` and a `need` (`[counter, number]`), and call `count('counter', why)` where the thing happens.
- **What she does not know.** The guild board's notices do not say what they are, where exactly, how dangerous or how well paid until she takes one. Hunts hide what and how many; bounties hide their strength. People she has not met show as "someone". The map marks a place with something to do with a "!" and no count.
- **The backlog.** What she finds out is kept: each place the first time she arrives (what it offers, its spots, its hours), each person she meets and how the approach went, the shop's prices, finished quests, perks, and how each ambush ended. It is the Backlog tab under her sheet.
- **Stereotyped.** Strangers see a type before they see her. Settings picks what they take her for (human, elf, half-elf). The meter is that type's base, less 0.7 of her reputation in that place, less a little for Willpower. At 40 or more, strangers apply the type's assumptions to first impressions (an elf: Clever +8, Friendly −8, Flirt +4). Someone who respects her ignores it.
- **Her picture.** The top of her sheet is a half-body card: her picture, name, calling and level, taller as the panel is pulled wider. Pulling the panel wide no longer moves her sprite across the stage.
- **Who is on screen.** The right-hand character only appears while she is dealing with them: a first meeting, talking, a fight. Otherwise the story column takes the room.
- **Respect.** What a regular thinks of her is respect, not romance: Wary, Noticed, Respected, Trusted. A first impression sets it; talking and spending at their place raise it; a regular who respects her vouches for her where they live.
- **Volatility.** Mistakes make every gauge swing harder. A fumble, a fall or a beating adds a point (up to 4), and each point stretches every change to reputation, decency, chemistry and order by a quarter, gains and losses alike. A critical success, a night's sleep, a soak or a Calming Tea takes it back down.
- **Roads have stretches.** A walk is cut into one to four stretches by its length (about one per twenty minutes). Each stretch rolls one d100 on the same table: fight, event, sign, or quiet. A sign is a line about the road itself (weather, tracks, the hour). Four in ten events are a full story event from that place's pool; the rest are one of fourteen one-roll road events in `MICRO` (a dog, a toll, a dropped purse). Two safe places joined by a safe road skip the table. `stretchRows` is the table; the simulator reads the same function.
- **Suspicion.** A 0 to 100 gauge for how watched she is. Signs that somebody is following raise it, some road events move it either way, and it drops 15 a night. A quarter of it is added to every fight chance outside safe places.
- **Conditions.** Two things her body does that the world answers, each a 0 to 100 gauge on the Status tab with a word per quarter. **Swelling** (resisted by Constitution): +12 whenever her bust gains a tier and +2 a night per tier; per 25 points Run −5 and Sway +3; at 75 every stamina cost is one higher; a real bed takes 10 off. **Pheromones** (resisted by Finesse): half of every chemistry gain, plus a tenth of her chemistry each night; per 25 points Persuade −5, Flirt and Sway +3, fight chance +4 and one more catcall in a crowd's mix; at 50 safe streets start rolling for trouble, strangers follow her on the road and the crowd row on the map reads "heads turning"; at 75 a regular who dislikes flirting will not talk to her. A soak takes 15 off and a Calming Tea 20.
- **Every night they move.** At midnight each condition goes up by what her body did and down by half her resistance. Resistance is ten times her attribute over the level's benchmark, plus one point for every night she starts at 25 or more (up to 20). A morning report card shows the arithmetic and names the cure for the worst one.
- **Jiggle free.** A button in the top bar that always works: it drops a fight, a standoff, a meeting, a spot or the floor and stands her back up where she is, with at least a quarter of her health and 20 stamina. If the stage ever shows nothing that can be pressed, the page notices, wiggles that button and adds a large copy under the story.
- **Cheats and simulators.** The Debug tab under the story has the jump list and seventeen cheats (`CHEATS`: bars, gold, EXP, decency, suspicion, both conditions, a bust tier, the clock, a road event, a standoff, reputation). The Debug tab on the right has four simulators that change nothing in the save: 1,000 walks down every road from here, 1,000 social rolls against whoever is in front of her, 30 nights of her conditions, and 60 real fights played by the battle runner against itself.
- **The same grid at every place.** The Responses tab is three rows of four. **Here** is the same everywhere: Look around, Search (Luck, once a visit: gold, and a potion on a crit), Listen (Willpower, once a visit: a rumour that names a place and goes in the Backlog), Wait an hour (stamina back; outside safe ground, half the fight chance). **Trouble** is the same everywhere: Explore (Patrol outside the city), Stand watch (her calling's attribute, once a visit: order +3 or city reputation, suspicion −5), Pick a fight (a standoff on the spot; reputation −2 on safe ground), Lie low (Finesse: suspicion −15, or −5 and a hay cart). **Only at this place** holds what that place alone offers, padded with empty slots to a full row. `HERE_ROW`, `TROUBLE_ROW`, `streetAct`, `streetCell`, `placeGrid`.
- **Inns and traders outside the walls.** Each outer domain has one waystation with a bed and a trader: the Mossy Tankard (Greenwood), the Gatehouse Bunks (Castle), the Porter's Lodge (Academy), the Smuggler's Lean-to (Camps). With the Gilded Goose and Fizz and Fettle that is five beds and five shops.
- **Roads bend.** On the map a road has one bend for every stretch it takes to walk, with a dot at each. Stretches are now one per fifteen minutes, up to five. The right-hand panel lists every road out of here with its minutes, stretches and fight chance; a row is a button that walks it.
- **Pinned.** Running out of stamina in the middle of a standoff no longer jumps to a real fight. She is on her back with the crowd round her and has four moves: Struggle up (Might: on her feet, stamina 15), Wriggle free (Finesse: she gets away), Talk from the ground (Willpower at −10: nerve −30), Curl up (no roll: halves the next hit). A failed try makes their next one land half again as hard. Three rounds spent pinned and they win. Round eight with their nerve above 40 still becomes a real fight. The writing stays PG-13: it is jeering, shoving and catcalls, as before.
- **Passive rank.** The passives she has unlocked count as a second level, shown on the Passives fold. Each rank puts one more in every crowd and makes a second voice in the crowd likelier each round (8% a rank). Two new passives come from being pinned. A knight with a bad name (Villain or Town scandal) also meets more trouble on safe streets: 6% plus 2% a rank.
- **Each domain's people.** The world plate names who holds the opinion: the townsfolk, the woodsfolk, the garrison, the faculty, the camp bosses.
- **Guarded regulars.** Sable, Nyx, Sergeant Pike and Auntie want an answer before they will talk, every visit: one of the four approaches, rolled like a first impression but moving respect by a few points, or her calling's avoidance talent (Trip Over Nothing, Minor Glamour, Slip the Question, Change the Subject: one roll at +10, once a visit, respect untouched). The other regulars are easy company and never ask. `retest`, `TALENTS`.
- **Whoever she is dealing with gets a card.** The Them tab opens by itself and starts with a portrait card like hers: picture, name, class, level, respect, and whether they are guarded. A regular with no picture gets a drawn shape. Crowds and common enemies do not get one.
- **The big window.** Collapsing, being pinned, a road event that went wrong and the morning report keep a card: the text, the roll and its arithmetic, what changed, what it means, and twelve of her numbers right after. Accidents open it by themselves (a switch in the window turns that off); every such line also has a Details button.
- **Guild jobs.** Eight sealed notices (`JOBS`). A notice says where, never what. Taking one puts it in hand (one at a time) and marks the place on the map; at the place, "The job" opens four ways to do it, each on a different attribute, a flirtatious way adding her Tempt bonus. One roll. A success pays in full (half again on a crit), counts as guild work for the day and raises her standing; a failure pays about a third and costs a point. Two of the rough ones start a standoff if they go wrong. What kind of job it was (social, mystery, rough work) is only written down afterwards. A notice returns after three days.
- **Talk as you pass.** Three lines of what people say as she goes by, picked by her gauges: a bad name, a good one, pheromones, swelling, looking a state, Exhausted, being watched, night. The built-in bank is `CHATTER`. "Ask Claude for fresh talk" sends her gauges and banks up to six new lines, each tied to one of those tags; banked lines are kept and come round when their gauge does. Thoughts Claude writes for her are banked the same way.
- **Growth.** A **Bloom Draught** (every trader, 20 gold a level) adds 40% of a bust tier at once and 8 swelling. The Growth button opens a window with her tier, progress, what feeds it on her path, what each tier does and how swelling follows.
- **Common enemies keep score.** Each kind (`S.foes`) gains a rank every time it beats her, up to four: one more level per rank when they turn up, a longer name (Bold, Swaggering, Notorious, Dreaded, "Bane of Valerie"), and a colour for the rank. The Book of Trouble lists them with wins and losses. Ranks do not come back down.
- **More passives.** Reliable (three jobs), Magpie Eyes (four searches), Good at Standing (three watches), Road Legs (thirty stretches), In Bloom (three Bloom Draughts), on top of the two from being pinned. Thirteen in the bank.
- **Collapsing in the open.** Running out of stamina in a safe place just puts her on the ground. Anywhere else she is also **Exhausted** until she sleeps in a bed (every social and standoff roll −10, stamina stops at 50, fight chance +10), and one d100 says who reaches her first: a crowd (40: a standoff starts the moment she tries to get up), thieves (30: a third of her gold), a kind stranger (12: stamina 12), or nobody.
- **Backdrops follow the clock.** Nine city places have three paintings each, for day, dusk and night (`TOWN_SCENES`, `sceneOf`). Morning and afternoon use the first, evening the second, night the third. Every other place borrows one of the nine (`TOWN_SCENES`; a `:3` suffix pins the night painting, used for the dungeons). Paintings are shown as painted, with no extra day or night filter.
- **Asking Claude.** Four things on the page can ask Claude: her inner voice, replies in chat, the Bio writer, and **AI fill**. AI fill sends her sheet and a digest of every gauge (`gaugeDigest`) in one request and writes only the parts switched on: the Bio, the four Drives, and a short read of how she is coming across now. Each part shows its rough cost before sending, and a Quick or Smart model can be picked. Every call is counted under what it was for, and the Debugger shows the tally. The counts are estimates (characters ÷ 4); the page is not told real token counts.
- **Stamina.** Walking and acting spend it; food, naps, baths and beds restore it. At zero she falls down and needs a Willpower roll to get up.
- **Decency.** How presentable she is. Fumbles, falling over, sleeping rough and losing fights lower it; baths, a polished breastplate and a real bed raise it.
- **Meeting people.** The first time she meets a regular she picks one of four approaches. Each button shows its chance, and the dice tray shows the arithmetic: her attribute, their taste, her Airhead, her reputation. The result sets a rapport the Debugger shows as a number.
- **Spots.** Some places have spots (the bar counter, the card table, the well) with three things to do each.
- **Gold and potions.** Fights and luck pay gold. Fizz and Fettle sells a Healing Draught, a Mana Tonic and a Calming Tea.
- **Bust, hips, chemistry.** Body trackers from her character sheet. The path picked on the Level tab decides why the bust grows: Warrior (hormones), Mage (spare mana) or Rogue (greed). Each tier is Tempt +2, Finesse −2% and the path's perk. Hips and size only tick.

## Art is not in the repository

The page expects these files next to it. They are the owner's own pictures and clips and are not committed.

```
art/knight.webp  art/priestess.webp  art/ranger.webp  art/valerie-forest.webp
art/bambi-idle.mp4  art/bambi-shirt.webp  art/bambi-lounge.webp
art/succubus-idle.mp4  art/librarian-idle.mp4
art/bg/bg-lanterns.webp  art/bg/chat-classroom.webp  art/bg/bg-stacks.webp
art/bg/bg-dungeon.webp   art/bg/bg-arena.webp        art/bg/chat-pool.webp
art/bg/bg-nightpark.webp art/bg/chat-graffiti.webp   art/bg/bg-forest.webp
art/bg/bg-candy.webp
art/bg/town/{gate,well,guild,tavern,archive,baths,bar,alley,yard}-{1,2,3}.webp   (1 day, 2 dusk, 3 night; 1920x1080)
art/cut/val-close.webp  art/cut/val-guard.webp  art/cut/val-bar.webp  art/cut/val-offduty.webp
art/cut/elf-green.webp  art/cut/elf-violet.webp
```

| File | Used for |
|---|---|
| `art/bg/town/<place>-1/2/3.webp` | The nine city places, by time of day |
| `art/cut/val-close.webp` | Valerie: a close-up, meant as the face on her card |
| `art/cut/val-guard.webp`, `val-bar.webp`, `val-offduty.webp` | Valerie: other poses for the stage (gate duty, a bar shift, off duty) |
| `art/cut/elf-green.webp` | Elowen Thistledown, the lecturer at the Lecture Hall |
| `art/cut/elf-violet.webp` | Fizz, the alchemist who owns Fizz and Fettle |

A missing file leaves an empty spot; the page still works. Anyone on the page can also drop in their own picture or clip for either side.

## Changing the town

The tables near the top of the script in `stage.html`:

- `AREAS`: the five maps. Name, starting order, and the doorways that lead from one map to a place on another.
- `PLACES`: each bubble. `area` says which map it is on; `roads` gives the minutes for a walk between maps; `boss` names its stronghold. Map position, backdrop, zone, chances, hours, what you can do there, who lives there, which bubbles it connects to, the lines for Look around, and the tags that tie it to story events.
- `CAST`: the regulars. Name, role, class, look, hours, what they like and hate, and their lines.
- `SPOTS`: the spots inside a place, three options each: a stat and a difficulty, a cost, and what winning or losing does.
- `APPROACH`, `POTIONS`, `PATHS`, `THOUGHTS`: the four approaches, the shop stock, the growth paths, and her canned inner voice.

Add a row and the map, the buttons and the Debugger pick it up.

## Not built yet

Enemy pictures and a bestiary, a small dungeon to cross between places, the free-text "say your own thing" answer judged by a Game Master model, levels of the same area, growth for the regulars, items inside the engine's battle runner (the page spends her turn itself), and a live Grok connection (the page cannot call outside services from where it is published). `docs/tasks/2026-11-10_playtest-stage-handoff.md` at the repository root has the full list and the order to take it in.
