# The playtest stage

`stage.html` is the template for the playable page: a visual-novel stage where Valerie walks around the town of Gooseford, talks to the regulars, takes quests, and fights with the real rules. Nothing in it is a mock-up. The build inlines the modules from `engine/` and the files from `data/`, so every roll on the page is the engine's roll.

```bash
npm run playtest
```

That writes `playtest/out/oops-playtest.html` (ignored by git). Open it from a folder that also holds the art, or publish it as a page with the art beside it.

## What is on the page

| Part | What it does |
|---|---|
| Left panel | Valerie's sheet, laid out like Del's Character Card page. Name, the Airhead range bar, her mood and four small vitals on top. Tabs: **Overview** (who she is at a glance: boxes for body and mind, what is core to her, likes and dislikes, and six live "bars" in words), **Status** (every gauge, purse and potions), **RPG** (fields, attribute boxes, accidents, moves, equipment), **Spicy**, **Settings**. A second row opens more underneath; click a tab again to close it: **Bio** (her description at three lengths, or have Claude's quick model draft it), **Drives** (wants, needs, the lie, fears: the narrator reads these), **Personality**, **Relationships** (reputation place by place, and people), **Moments**, **Body**. Drag the panel's edge toward the middle and her picture slides to the left edge with the sheet beside it; pulled out like that, Bio and Drives become editable and the sheet keeps going as you scroll: Tags, Items, Quests, Passives and a picture library to change her look. Ctrl and the mouse wheel over the panel makes its text bigger or smaller. |
| Top of the middle | The mode pill (Travelling, Combat, Down), her level and mood, the clock, the **Debugger** toggle, her inner voice, and the **dice tray**: every roll lands there with its bands and its arithmetic. |
| Middle | The story, with new lines arriving at the bottom next to the box. Under it, four tabs: **Responses** (what the place offers), **Social** (who to talk to, and the spots), **Items** (purse and potions), **Debug** (jump to any place, heal, EXP, the sandbox). Exits sit under every tab but Debug. |
| Right panel, Map | The city and the wilds as bubbles. Click one to walk there; time passes with distance. Red rings are the wilds. |
| Right panel, top | **Around here**: the threat in words, each regular in this part of the world with a respect bar, and the men and women about, with how restless the crowd is and whether they see her or a type. |
| Right panel, Them | Only while she is dealing with someone: rename them, change class or look, flip the picture, or move someone else in. |
| Right panel, Level | EXP, level up, training points, the path that decides why the bust grows, every move and its unlock level. |
| Right panel, Debug | The older tools, kept: sparring sandbox, party fights, level box, place list, stress buttons, reset. |
| Right panel, Fight | Appears in a real fight: the enemy, phase, wind-ups, every fighter's bars. |

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
```

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
