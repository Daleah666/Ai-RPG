# RPG build log, 2026-11-09

Result of the Game Director run that built `rpg/`. Numbers are from `npm run all` at the commit that added this file.

## Result

| Check | Outcome |
|---|---|
| Rules tests (`npm test`) | 265 pass, 0 fail |
| Cross-reference check (`npm run check`) | 228 ids; every reference resolves, every cost is payable |
| Event packs (`npm run events`) | 1 pack, 13 events, valid |
| Master blueprint | built, 7 sections, about 232,000 characters |
| SillyTavern files | built: Game Master card with 52 lorebook entries (4 always on, about 800 tokens) |

## What exists

| Thing | Count |
|---|---:|
| Archetypes | 4 (Warrior, Mage, Rogue, Klutz Knight) |
| Class skills | 54, plus 16 for Valerie |
| Passives | 22 class and general, plus Valerie's 6 accidents |
| Statuses | 43 across class, boss and encounter registries |
| Items | 42, plus a 10-tier gear table |
| Afflictions and virtues | 7 and 5, plus one of each for Valerie |
| Bosses | 3 (level 12, level 50, level 100 superboss at 22.2 million HP) |
| Encounters | 5 |
| Story events | 13 |

## Who built what

| Role | Output |
|---|---|
| Director | Foundation contract, dice and stat core, Valerie's kit and its combat wiring, event system, SillyTavern builder, cross-reference checker, blueprint compiler |
| Combat Engineer | `engine/combat.js`, blueprint section 1 |
| Progression Analyst | `engine/progression.js`, `data/archetypes.json`, section 2 |
| Systems Designer | `engine/stress.js`, `engine/binds.js`, affliction and virtue tables, section 3 |
| Content Writer | skills, passives, items, section 4 |
| Content Writer, boss desk | bosses, encounters, section 5 |

Each role's reasoning is in `rpg/handoff/`.

## Problems found and fixed along the way

- **Damage baseline broke the duel anchor.** With `A² / (A + D)` a lightly armored target died in five hits. The Combat Engineer moved defense to half weight.
- **The class triangle was overstated.** Integration tests showed a warrior outlasts a mage under any kind of fire. The contract now states the triangle as each class's soft side, with measured numbers.
- **`fixedRolls` replayed some dice one low** (30 as 29). Found by the Systems Designer; fixed, with a test that replays all hundred faces.
- **Boss statuses had no registry.** Bosses and encounters now register their own statuses, and the checker reads all three registries.
- **Valerie's personal affliction and virtue were text only.** They now carry machine fields; her affliction locks the Airhead gauge at 0.
- **One stale line in section 5** said her abilities unlock by level 12. They are innate at level 1.

## Not built

There is no battle loop, skill resolver or status store. The engine has the arithmetic and the rules; nothing takes turns, applies a skill's effects list, ticks a status, or plays a boss's script. `rpg/handoff/content-writer.md` and `rpg/handoff/boss-desk.md` list what a runner needs. A SillyTavern extension that calls the engine is the natural next step; until then the Game Master card has the model do the arithmetic from short tables.

## Things a later tool should know

- Several data files and blueprint sections were produced by generator scripts the roles ran in a scratch directory. The JSON in `rpg/data/` and the documents in `rpg/blueprint/` are the source of truth now. Tests guard the data; a hand edit to a boss or skill can leave a blueprint table stale.
- The boss simulation assumed a Power 4 Might skill for the rogue. Its real workhorse averages about 22% more, so boss fights run about 5% shorter than section 5 states.
- Boss `rewards.items` are empty.
