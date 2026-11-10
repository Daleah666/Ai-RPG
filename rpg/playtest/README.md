# The playtest stage

`stage.html` is the template for the playable page: a visual-novel stage where Valerie walks around the town of Gooseford, talks to the regulars, takes quests, and fights with the real rules. Nothing in it is a mock-up. The build inlines the modules from `engine/` and the files from `data/`, so every roll on the page is the engine's roll.

```bash
npm run playtest
```

That writes `playtest/out/oops-playtest.html` (ignored by git). Open it from a folder that also holds the art, or publish it as a page with the art beside it.

## What is on the page

| Part | What it does |
|---|---|
| Left panel | Valerie: Airhead gauge, mood, HP, MP, stress, attributes, her look. Drag its edge to resize. |
| Middle | The story. Every beat is one dice line, then one paragraph. Under it, a grid of what you can do where you stand. |
| Right panel, Map | The town as bubbles. Click one to go there. A pink dot means someone lives there; a number is quests waiting. |
| Right panel, Here | Whoever lives where you are: rename them, change their class or look, flip the picture, or move someone else in. |
| Right panel, Level | EXP, level up, training points, and every move with the level it unlocks. |
| Right panel, Debug | The older tools, kept: sparring sandbox, party fights, level box, place list, stress buttons, a reset. |
| Right panel, Fight | Appears in a real fight: the enemy, phase, wind-ups, every fighter's bars. |

Fights are run by `engine/battle.js`. A hunt is Valerie alone against enemies at three quarters of her level; the Debug tab switches hunts to a party of four. Boss bounties always bring a party.

## Art is not in the repository

The page expects these files next to it. They are the owner's own pictures and clips and are not committed.

```
art/knight.webp  art/priestess.webp  art/ranger.webp  art/valerie-forest.webp
art/bambi-idle.mp4  art/bambi-shirt.webp  art/bambi-lounge.webp
art/succubus-idle.mp4  art/librarian-idle.mp4
art/bg/bg-lanterns.webp  art/bg/chat-classroom.webp  art/bg/bg-stacks.webp
art/bg/bg-dungeon.webp   art/bg/bg-arena.webp        art/bg/chat-pool.webp
art/bg/bg-nightpark.webp art/bg/chat-graffiti.webp   art/bg/bg-forest.webp
```

A missing file leaves an empty spot; the page still works. Anyone on the page can also drop in their own picture or clip for either side.

## Changing the town

Three tables near the top of the script in `stage.html`:

- `PLACES`: each bubble. Position on the map, backdrop, what you can do there, who lives there, which bubbles it connects to, and the tags that tie it to story events.
- `CAST`: the regulars. Name, role, class, look, and the lines they greet you with.
- `ACTS`: the things a place can offer.

Add a row and the map, the buttons and the resident list pick it up.

## Not built yet

A bestiary for spare art, enemy pictures in fights, items in battle, and a live Grok connection for the right-hand character (the page cannot call outside services from where it is published).
