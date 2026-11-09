# Playing it in SillyTavern

You play Valerie. A Game Master card plays everything else: the world, the party, the enemies and the dice.

## Setup

1. **Import the Game Master.** Character Management → Import → `out/Oops_Im_the_Hero_GM.card.json`. When SillyTavern asks about the embedded lorebook, accept it.
2. **Become Valerie.** Persona Management → new persona named `Valerie` → paste the contents of `out/Valerie.persona.txt` as the description. Set it as the persona for this chat.
3. **Start a chat** with the Game Master and pick an opening: the forest (level 1), the tavern (level 5) or the dungeon (level 10).

Then type what you do. The Game Master reads each action as **winging it** or **thinking it through**, rolls, narrates, and ends on a choice with a status line:

```
Valerie Lv 1 Klutz Knight | HP 140/140 | MP 9/9 | Stress 0/200 | Airhead 60/100 (Ditzy) | MCE 0/100
```

## The files

| File | Use |
|---|---|
| `out/Oops_Im_the_Hero_GM.card.json` | The Game Master. A `chara_card_v2` card with the rules, Valerie's kit, the cast, items, bosses and every story event embedded as a lorebook. |
| `out/Valerie.persona.txt` | Who you are. Paste into a persona. |
| `out/Oops_Im_the_Hero.worldinfo.json` | The same lorebook as a standalone World Info file, for attaching the rules to a different card or a group chat. |
| `out/Valerie.card.json` | Valerie as a character card in the card creator's format (`extensions.companion_stage`). Opens in the card creator, and also imports into SillyTavern as an ordinary character if you would rather talk to her than be her. |

## How the dice stay honest

The card's after-chat note carries four `{{roll:1d100}}` macros. SillyTavern replaces them with real random numbers on every generation, so the model is handed dice instead of asked to imagine them. The rules tell it to use them in order and never to invent a roll.

## What is always in context

Four short lorebook entries are always on (dice, combat, the Airhead gauge, the six accidents), about 800 tokens together. Everything else is keyed and loads when the story reaches it: a boss when it is named, an item list when someone goes shopping, an event when the scene enters its location.

## Adding story

Write an event pack (`../events/README.md`), drop it in `../events/packs/`, and rebuild. Each event becomes a lorebook entry keyed by its places and tags.

```bash
node sillytavern/build.mjs
```

## Limits to know about

The Game Master is a language model doing arithmetic from short tables. It will keep chances inside 5–95 and read real dice, and it will round damage and sometimes lose track of a bar in a long chat; correct it in character or edit the status line. Exact numbers come from the engine in `../engine/`. Wiring that engine into a SillyTavern extension, so HP, stress and the gauge are tracked in code, is the next step and is not built yet.

Everything in `out/` is generated. Edit `src/`, `../data/` or the event packs, then rebuild.
