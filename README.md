# Aetherbound

An AI-woven role-playing game in the browser. You are Bound in the land of **Thalorin**, where a thinning Veil is coming apart. Gather three Anchors, walk into the Rift, and decide what the story is for.

## Play

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://127.0.0.1:5173`).

- **New tale** — pick an origin and a calling, then wake in Emberhearth.
- Explore, talk, travel, and fight. Number keys `1–9` pick choices.
- The main thread: Ember Anchor (Veilwood), Tide Anchor (Saltmoor), Ash Anchor (Cathedral), then the Rift.
- Side threads: Liri in the village, Vesk on the docks, a forbidden page in the Archives.
- Progress saves automatically in this browser.

The Chronicler is built into the game (procedural narration from world state). Optional live AI lives under **settings**: paste an OpenAI-compatible API key if you want scene text rewritten. The game is complete without it. The key stays in local storage on your machine.

## Build & test

```bash
npm test
npm run build
```
