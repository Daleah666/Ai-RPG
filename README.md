# Self Signal (Ai-RPG)

Private, on-device personal affirmation practice and self-monitoring.

## Directive stack (keep tight · available · logged)

- **Perma prompt + 22 skills:** [`docs/nova-orders/directive-stack.md`](docs/nova-orders/directive-stack.md)
- **Skills index:** [`docs/nova-orders/skills/README.md`](docs/nova-orders/skills/README.md)
- **Self Signal handoff:** [`docs/nova-orders/self-signal-handoff.md`](docs/nova-orders/self-signal-handoff.md)
- **Change log:** [`docs/nova-orders/LOG.md`](docs/nova-orders/LOG.md)

## What this is

A local web tool for **personal use only**:

- Write a north-star aim and behavior-based affirmations
- Run short practice sessions (read and optional browser voice)
- Log daily clarity / energy / follow-through
- See simple streaks and trends
- Export or wipe data anytime

All data stays in your browser `localStorage`. Nothing is sent to a server.

## How to run

Open `index.html` in a modern browser, or from this folder:

```bash
pip install -r requirements.txt
python3 serve.py
```

Then visit `http://localhost:8080` (includes **Subliminal Mixer** at `/mixer.html`).

Static-only (no mix API):

```bash
python3 -m http.server 8080
```

## Subliminal files (Mind Zoom–compatible)

- Affirmation text files: `subliminal/affirmations/*.txt` (import into Mind Zoom on Windows/Mac)
- Create MP3 locally: `mixer.html` or `scripts/build_subliminal.py`
- Setup guide: `docs/mindzoom-compatible.md`

Mind Zoom desktop app is paid software for your own PC — this repo creates compatible files and mixes audio without it.

## Personal protocol

1. Write specific actions (“I start the hardest task within five minutes”), not vague slogans.
2. Practice 3–8 minutes daily with attention.
3. Check in once per day honestly.
4. Rewrite weak lines weekly based on your follow-through scores.

## Reality check

Hidden “subliminal” embeds have weak evidence for complex behavior change. Conscious repetition plus honest tracking is the reliable path this tool supports.
