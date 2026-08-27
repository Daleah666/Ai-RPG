# AI-RPG — The Sunless Deep

A self-contained, AI-guided text RPG dungeon crawler with a modern web UI. A
procedural "Dungeon Master" narrates your descent through the Sunless Deep:
fight monsters, level up, loot treasure, and defeat the boss on the final
floor.

The game runs fully offline with **no external API keys required** — the
narrative and combat are driven by a deterministic, seedable engine, so it is
easy to run and to unit test.

## Tech stack

- **Backend:** Node.js (ES modules) + [Express](https://expressjs.com/) REST API
- **Engine:** framework-free, deterministic game engine (`server/engine/`)
- **Frontend:** vanilla HTML/CSS/JS single page served by Express (`public/`)
- **Tests:** [Vitest](https://vitest.dev/)
- **Lint:** [ESLint](https://eslint.org/) (flat config)

## Getting started

```bash
npm ci        # install dependencies (or `npm install`)
npm start     # start the server on http://localhost:3000
```

Then open http://localhost:3000, forge a hero, and enter the dungeon.

### Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the production server (`server/index.js`). |
| `npm run dev` | Run the server with `--watch` auto-reload. |
| `npm test` | Run the Vitest unit suite. |
| `npm run lint` | Lint the codebase with ESLint. |

The server port can be overridden with the `PORT` environment variable
(defaults to `3000`).

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check + active game count. |
| `POST` | `/api/game` | Create a game. Body: `{ name, className, seed? }`. |
| `GET` | `/api/game/:id` | Fetch current public state. |
| `POST` | `/api/game/:id/action` | Apply an action. Body: `{ action }`. |

Classes: `warrior`, `mage`, `rogue`. Actions depend on context and include
`explore`, `attack`, `flee`, `drink_potion`, `loot`, `rest`, and `descend`.

## Project layout

```
server/
  index.js          Express app + API routes + in-memory game store
  engine/
    game.js         Deterministic game engine (state, combat, progression)
    content.js      Data pools for monsters, rooms, loot, narration
public/
  index.html        Single-page UI
  styles.css        Dark-fantasy styling
  app.js            Frontend controller
tests/
  engine.test.js    Engine unit tests
```

## Development environment (Cursor Cloud Agents)

`.cursor/environment.json` configures the Cloud Agent environment: it installs
dependencies with `npm ci`, runs the server in a `server` terminal, and exposes
port `3000`.
