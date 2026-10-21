# Character Cards — in-depth alpha

A local character-card library. Cards stay in this browser. The sample shelf is 11 original adults with lore books and depth notes, so a long chat can remember the job instead of only the opening biography.

## Run it

From this folder:

```bash
npm install
npm run dev
```

Open http://localhost:5173

`npm test` checks the card round-trip, lore matching, depth placement, the sample shelf, and the adult-only filter. `npm run build` makes the static app in `dist/`.

## What “depth” means

A plain card pastes the description into the first instruction. After twenty messages, that instruction is far from the line the model is answering.

This alpha adds two tools:

- **Depth note.** A short reminder inserted N messages above the newest line. Depth 4 means four messages up. Depth 0 means after the newest line. If the chat is shorter than N, the note sits at the top of the chat.
- **Lore book.** Each entry has keys and a place to land.
  - **Always include** — in the opening, every turn.
  - **Before / after the description** — only when a key appears in the card or the recent messages.
  - **In the chat, at a depth** — same key rule, but the text sits next to the recent lines.
  - **Second key** — both a main key and a second key must appear. Nen’s Glass wing works this way: “name” alone does nothing; “read the name” opens the drawer.
  - **Scan depth** — how many recent messages are checked.
  - **Token budget** — a rough cap (4 letters ≈ 1 token). Always-on entries are kept first. Later entries that do not fit are left out.

Open any card and use **Prompt preview**. Type `harbor` on Mira, `elbow` on Sable, or `altar` on Sylvene and watch the matching lore appear.

`{{char}}` and `{{user}}` are replaced when the prompt is built. The name in Settings is `{{user}}`.

## The shelf

| Card | Use |
| --- | --- |
| Mira Vale | Cozy map shop |
| Liora, Rheda, Sylvene, Maewyn | Velvet Lantern party, adult RPG, one job shared across four cards |
| Idris Quill | D&D-style checks. He asks you for the die. He does not invent the number. |
| Sable Rook | Blender / VRChat avatar lessons, one click at a time |
| Nen Voss | Archive with three wings |
| Bramble Holt | Inn, stable prices, one rumor |
| Rowan Hale | Lighthouse radio, short sentences |
| Vespa Quinn | Original four-line songs, flirt that stops when told |

Search looks through lore, not just names. Shelves are the tags `sfw`, `nsfw`, `rpg`, `cozy`, and `craft`. **Restore samples** puts the 11 originals back and leaves cards you made yourself.

## Import and export

- **JSON** — SillyTavern / Chub v2, a flat v1 card, or a v3 card. Lore, depth notes, alternate greetings, system prompt, and post-history instructions are kept.
- **PNG** — a SillyTavern image with a `chara` or `ccv3` text chunk.
- **Export JSON / Export PNG** — v2 card. PNG export embeds the same JSON so SillyTavern can read it.
- **Export library** — every card in this browser, one file.

Imported cards open in the editor first so you can set the age. Saving a library file imports every adult card and skips the ones that look underage. Age must be a whole number from 18 to 120. Wording that describes a minor is blocked on save and on library import.

## Chat

Settings holds your name, a base URL, a model, and a key. The key never goes into the card file. The app sends chat through `http://localhost:5173/api/chat`, which forwards to the base URL you typed. That avoids the browser block most providers put on direct calls.

Examples:

- OpenAI: `https://api.openai.com/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- Ollama on this machine: `http://localhost:11434/v1`

Without a key, the library, the editor, and the prompt preview still work. Pick a greeting before the first send. Enter sends. Shift+Enter adds a line.

## What this alpha does not do

- Recursive lore (an entry triggering another entry).
- World books shared by several cards. The Velvet Lantern contract is copied onto each of the four cards so each one stands alone.
- A public character site. The shelf is the database in this browser.
