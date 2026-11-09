# Event packs

An event pack is one JSON file of story events. Drop a file named `something.events.json` into `packs/` and its events are in the game. Packs hold data only: an event can ask for the effects listed below and nothing else, so a pack written by another person, tool or game cannot do anything the rules do not allow.

Check a pack before using it:

```bash
node tools/validate-events.mjs events/packs/my-pack.events.json
```

With no file named, it checks every pack in `packs/` and reports duplicate event ids across them.

## Pack format

```json
{
  "pack": {
    "format": "rpg-events/1",
    "id": "my-pack",
    "name": "My Pack",
    "version": "1.0.0",
    "author": "you",
    "rating": "pg13"
  },
  "events": [ ... ]
}
```

`rating` is `all` or `pg13`.

## Event format

```json
{
  "id": "my.lost_in_the_fog",
  "title": "Lost in the Fog",
  "t": "One line: what happened, past tense. This is what lands on the character card.",
  "tags": ["travel", "slapstick"],
  "imp": 2,
  "where": ["road", "moor"],
  "when": { "level": [5, 40], "weight": 10, "once": true,
            "stress": [0, 200], "airhead": [0, 100],
            "flags": { "all": ["tamsin_in_party"], "none": ["fog_lifted"] } },
  "art": { "src": "optional image url", "prompt": "optional image prompt for the scene" },
  "scene": "Two to five sentences, second person, present tense. End on the moment of decision.",
  "choices": [ ... ]
}
```

| Field | Meaning |
|---|---|
| `title`, `t`, `tags`, `imp` | Same shape as a card **moment**. `imp` is 1–3. A card keeps the first 5 tags. |
| `where` | Place tags the event can fire in. `["any"]` or leave it out for anywhere. |
| `when.level`, `stress`, `airhead` | `[min, max]` ranges. Leave out for no limit. |
| `when.weight` | Draw weight. Default 10. |
| `when.once` | Default true: fires once per playthrough. `false` makes it repeatable. |
| `when.flags` | `all` must be set, `none` must not be. |
| `art` | Optional scene picture or a prompt to generate one. |

## Choices

Every event needs at least two. An event with one choice is a cutscene, and the validator warns about it.

```json
{
  "id": "follow_the_bell",
  "label": "Follow the sound of the bell",
  "mode": "wing",
  "check": { "difficulty": "normal", "bonus": 5 },
  "success": { "text": "...", "effects": [ ... ] },
  "failure": { "text": "...", "effects": [ ... ] },
  "crit":    { "text": "...", "effects": [ ... ] },
  "fumble":  { "text": "...", "effects": [ ... ] }
}
```

- `mode`: `wing` (Valerie rolls Luck; the Airhead gauge helps), `think` (the player's Wit; the gauge hurts) or `any`.
- `check`: `null` for no roll. Otherwise give a `difficulty` (`trivial`, `easy`, `normal`, `hard`, `heroic`, `absurd`), which scales with the hero's level so the event works at any level, or a fixed `dc` from 1 to 1000. Optional `stat` for non-stance checks, optional `bonus` within ±40.
- One d100 decides it. `crit` and `fumble` branches are optional; without them a crit reads `success` and a fumble reads `failure`.

## Effects

| Kind | Fields | Does |
|---|---|---|
| `stress` | `amount`, `source` | Adds stress. Negative relieves it. Sources that matter to Valerie: `horror`, `mental`, `realization`, `embarrassment`. |
| `hp`, `mp` | `pct` | Percent of the bar. Negative hurts. |
| `airhead` | `amount` or `set` | Moves the Airhead gauge. |
| `limit` | `amount` | Main Character Energy. |
| `gold`, `exp` | `amount` or `levelShare` | `levelShare` is a share of one level's worth, so rewards scale with the hero. |
| `item` | `id`, `qty` | Gives or takes an item from `data/items.json`. |
| `misplace` | `id` (optional) | Sends an item to the Pocket Dimension. |
| `flag` | `set` or `clear` | Story flags that later events can test. |
| `bind` | `part`, `turns` | Head, arms or legs. |
| `mod` | `stat`, `mult`, `turns` | A temporary buff or debuff. |
| `resolve` | `outcome`, `id` (optional) | Forces an Affliction or a Virtue. |
| `rep`, `trust`, `dignity` | `amount` | Dashboard meters. |
| `moment` | `title`, `t`, `tags`, `imp` | Writes a moment onto the character card. |
| `battle` | `encounter`, `advantage` | Hands off to combat. `advantage` is `party` or `enemy`. |
| `next` | `event` | Chains to another event id. |

## Going the other way

`engine/events.js` converts in both directions:

- `toMoment(event)`: an event as a card moment.
- `fromMoments(moments, { id, name })`: a card's moments as a starter pack, one open choice each, ready to be fleshed out.
- `toLoreEntry(event)`: an event as a SillyTavern lorebook entry keyed by its places and tags.
