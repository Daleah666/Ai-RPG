# Character Card Studio (alpha)

An in-depth character card editor with a local library. Cards work in SillyTavern, Chub, and the Character Companion app (Nova-AI). Everything stays in your browser (IndexedDB). There are no accounts, no server, and no API key.

## Run it

You need [Node.js 20+](https://nodejs.org/).

```bash
cd apps/character-card-studio
npm install
npm run dev
```

Open the address it prints, usually <http://localhost:5173>. Three example cards (Mira Vale, Brannoc Ashvale, Sera Quill) are loaded the first time.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (card import/export, PNG, lorebook, safety, library) |
| `npm run build` | Type check + production build into `dist/` |

## What it does

**Library**
- Grid of cards with avatar, completeness score, token size, and lorebook count.
- Search across name, tags, species, job, and RPG class. Click tag chips to filter (all selected tags must match). Favorites filter. Sort by recent, newest, name, or size.
- Import by button or by dropping files anywhere on the page: `.png` cards, `.json` v1/v2/v3 cards, arrays of cards, or a library backup. Many files at once is fine.
- Per card: favorite, duplicate, export (PNG / JSON v2 / JSON v3), delete.
- **Back up library** saves every card into one JSON file. Import that file to restore it.

**Editor tabs**
- **Basics**: name, nickname, age (18+), description, personality, scenario, tags, creator, version.
- **Profile**: 14 in-depth fields (appearance, outfit, backstory, speech style, quirks, likes, dislikes, goals, fears, relationships, secrets, and more). Filled fields are appended to the exported description as labelled lines. The tab shows exactly what gets added.
- **Greetings**: first message plus any number of alternate greetings (swipes).
- **Examples & prompts**: example dialogue, system prompt override, post-history instructions, creator notes.
- **Lorebook**: world-info entries with trigger keys (regex allowed as `/pattern/i`), secondary keys, constant, case-sensitive, order, priority, position, token budget, and recursive scanning. A test box highlights which entries would fire.
- **RPG sheet**: race, class, level, alignment, the six D&D ability scores (modifiers shown), HP, AC, skills, inventory, and spells. It is added to the description as a compact stat block.
- **Test prompt**: a preview of what a SillyTavern-style app sends to the model, with `{{char}}`/`{{user}}` filled in, triggered lore, and a token count per section.
- **Check**: a completeness score and plain-English tips (thin description, no examples, the greeting speaks for `{{user}}`, lore entries that can never fire, card too large for small models).

Ctrl+S saves. The app warns before you leave with unsaved changes.

## Card format notes

- Exports are standard `chara_card_v2` / `chara_card_v3`. PNG export writes both `chara` (v2) and `ccv3` (v3) text chunks into the avatar image. If there is no avatar, a placeholder with the character's initials is generated.
- Studio-only data (profile, RPG sheet, base description) lives in `data.extensions.card_studio`, so re-importing a studio card restores every field without doubling the profile text. `extensions.character_companion.age` is also written so the Character Companion app accepts the card.
- Extensions from other tools are kept on import and written back on export.
- Example file: [`examples/brannoc-ashvale.v2.json`](examples/brannoc-ashvale.v2.json).

## Safety

Adult characters only. Age must be 18 or higher. Save and import scan every text field, including profile and lorebook, for minor or underage wording. If an imported card has no age, the app asks for one, using any "NN-year-old" in the text first.

## Code layout

- `src/lib/` holds framework-free logic, so it can be copied into other apps such as Character Companion: `card.ts` (parse/export v1–v3), `png.ts` (PNG text chunks), `lore.ts` (lorebook triggering), `prompt.ts`, `quality.ts`, `library.ts`, `safety.ts`, `db.ts` (IndexedDB).
- `src/components/`: React UI.
- `tests/`: Vitest unit tests.

## Alpha limits

- Token counts are estimates (about 4 characters per token), not real tokenizer counts.
- No chat in this app. Use the cards in SillyTavern, Chub, or Character Companion.
- V3 embedded assets (extra images inside the card) are not imported.
