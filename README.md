# Ai-RPG

Self Signal — private, on-device affirmation practice, 3-layer subliminal studio, and bot handoff skills.

## Live skills

- [`skills/vesper-voice-master.md`](skills/vesper-voice-master.md)
- [`skills/subliminal-maker-bot.md`](skills/subliminal-maker-bot.md)
- [`skills/daily-subliminal-planner-bot.md`](skills/daily-subliminal-planner-bot.md)

## Bot handoff & system docs

- [`docs/AI_HANDOFF_BRIDGE.md`](docs/AI_HANDOFF_BRIDGE.md) — shared task/note contract for all bots
- [`docs/VESPER_SYSTEM_MAP.md`](docs/VESPER_SYSTEM_MAP.md)
- [`docs/PRO_TIPS_FOR_LEADERS.md`](docs/PRO_TIPS_FOR_LEADERS.md)

## Directive stack (keep tight · available · logged)

- **Perma prompt + 22 skills:** [`docs/nova-orders/directive-stack.md`](docs/nova-orders/directive-stack.md)
- **Skills index:** [`docs/nova-orders/skills/README.md`](docs/nova-orders/skills/README.md)
- **Self Signal handoff:** [`docs/nova-orders/self-signal-handoff.md`](docs/nova-orders/self-signal-handoff.md)
- **Change log:** [`docs/nova-orders/LOG.md`](docs/nova-orders/LOG.md)

## What Self Signal is

A local web tool for **personal use only**:

- Write a north-star aim and behavior-based affirmations
- Run short practice sessions (read and optional browser voice)
- Log daily clarity / energy / follow-through
- See simple streaks and trends
- Export or wipe data anytime

All data stays in your browser `localStorage`. Nothing is sent to a server.

## How to run

```bash
pip install -r requirements.txt
python3 serve.py
```

Then visit `http://localhost:8080` — includes practice app, **studio**, **mixer**, and **visual flash**.

Static-only (no mix API):

```bash
python3 -m http.server 8080
```

## Subliminal studio (3-layer audio + visual + API)

- **Studio hub:** `studio.html`
- **3-layer audio mixer:** `mixer.html` — stack 3 frequency layers + music
- **Visual flash:** `visual.html` — drag/drop multiple images, subliminal timing
- **API (Cursor / automation):** `docs/api.md` — `POST /api/v1/generate`
- **Cursor integration:** `docs/cursor-integration.md`
- Affirmation text files: `subliminal/affirmations/*.txt` (Mind Zoom–compatible)
- Bot-managed files: `subliminals/` (see `skills/subliminal-maker-bot.md`)
- Example job: `subliminal/examples/3-layer-job.json`
- CLI: `scripts/build_subliminal.py`
- Setup guide: `docs/mindzoom-compatible.md`

```bash
pip install -r requirements.txt
python3 serve.py
# → http://localhost:8080/studio.html
# → http://localhost:8080/mixer.html
# → http://localhost:8080/visual.html
# → http://localhost:8080/api/schema
```

## Personal protocol

1. Write specific actions (“I start the hardest task within five minutes”), not vague slogans.
2. Practice 3–8 minutes daily with attention.
3. Check in once per day honestly.
4. Rewrite weak lines weekly based on your follow-through scores.

## Reality check

Hidden “subliminal” embeds have weak evidence for complex behavior change. Conscious repetition plus honest tracking is the reliable path this tool supports.
