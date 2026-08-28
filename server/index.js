import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame, applyAction, publicState } from './engine/game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());

// In-memory game store. Single-process, ephemeral by design — this is a
// self-contained demo that needs no database to run end to end.
const games = new Map();

// Evict the oldest games if the store grows unbounded.
const MAX_GAMES = 500;
function remember(state) {
  games.set(state.id, state);
  if (games.size > MAX_GAMES) {
    const oldest = games.keys().next().value;
    games.delete(oldest);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', games: games.size, uptime: process.uptime() });
});

app.post('/api/game', (req, res) => {
  const { name, className, seed } = req.body || {};
  const { state, narrative } = createGame({ name, className, seed });
  state.id = randomUUID();
  remember(state);
  res.status(201).json({ id: state.id, narrative, state: publicState(state) });
});

app.get('/api/game/:id', (req, res) => {
  const state = games.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'game not found' });
  res.json({ id: state.id, state: publicState(state) });
});

app.post('/api/game/:id/action', (req, res) => {
  const state = games.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'game not found' });
  const action = (req.body && req.body.action) || '';
  const result = applyAction(state, action);
  res.json({
    id: state.id,
    narrative: result.narrative,
    events: result.events,
    state: publicState(state),
  });
});

app.use(express.static(PUBLIC_DIR));

// SPA-ish fallback for the single page.
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`AI-RPG server listening on http://${HOST}:${PORT}`);
  });
}

export { app, games };
