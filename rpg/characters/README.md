# Characters

One file per character. The playtest page builds its main cast from this folder, so adding a file here and rebuilding the page (`npm run playtest`) adds a character.

`index.json` gives the order the cast is listed in. A file it does not name is added after those, by name.

## What a file holds

| Field | What it is |
|---|---|
| `id` | The file's name without `.json`. |
| `name` | Her full name. |
| `title` | What people call her ("the Ash Warlord Queen"). Shown as her nickname when she is Rare or better. |
| `rarity` | 1 Common, 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary. It is the colour of her name. |
| `race` | What she is (optional). |
| `class` | What her own sheet calls her job. Flavour only. |
| `trope`, `temper`, `lore` | Who she is, in a line each. |
| `want`, `cost` | What she wants, and what it costs her. |
| `secret` | Told to the knight once she trusts her. |
| `body` | `height`, `build`, and two tiers (`bust`, `hips`). |
| `look` | Her appearance in words. |
| `lines` | What she says: `meet`, `flirty`, `battle`, `soft`, and `turn` for a rival who comes round. |
| `barks` | Short phrases she says in a bubble, outside the chat. |
| `world` | How she lives in the world: `side` (`ally` or `rival`), `plus` (levels above the knight), `poses` (which pictures exist), `start`, `range`, `zones`, `routine` (her loop of places). Leave it out for someone who does not wander. |
| `play` | Present if she can be played: her short `name`, `full` name, `look` (her standing picture), `calling` (`knight`, `mage`, `rogue` or `courtesan`: this is the one field that is rules), `callingName` (what the calling is called on her), `poses`, and her `card` (the sheet the left panel shows). |
| `drafted` | `true` when Claude wrote her sheet and Del has not replaced it yet. |

## Pictures

Pictures are not in git. A wandering character's pictures are `art/s/<id>-s.webp` (standing) and `-f`, `-a`, `-x`, `-d` for the poses named in `world.poses`. A played character names her own in `play.look` and `play.poses`.

## Not in files yet

The twelve Town Girls, the Vantari sisters, the regulars and the other wanderers still live in tables inside `playtest/stage.html`.
