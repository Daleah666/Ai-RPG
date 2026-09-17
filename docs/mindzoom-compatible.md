# Mind Zoom — compatible setup (personal use)

Mind Zoom is **paid desktop software** (Windows or macOS). It does **not** run inside this Linux cloud workspace. Use this repo to **create files here**, then import them on your own computer.

## What you can do in this repo (now)

| Action | How |
|--------|-----|
| Create affirmation files | Edit `subliminal/affirmations/*.txt` (one line = one affirmation) |
| Mix subliminal MP3 | Open `mixer.html` or run `scripts/build_subliminal.py` |
| Import into Mind Zoom | Copy `.txt` files into Mind Zoom’s affirmation folder on your PC |

## Get Mind Zoom on your device

1. Visit https://www.mindzoom.net/
2. Purchase and download for **Windows** or **macOS**
3. Install with admin rights (Windows) or drag to Applications (Mac)
4. Open **Affirmation Editor** → New → paste lines from our `.txt` files → Save
5. Open **Subliminal Mixer** → load your music → select affirmations → Mix & Save (MP3/WAV)

## Import our affirmation files into Mind Zoom

1. On your PC, locate Mind Zoom’s affirmations directory (often inside the app data folder after install).
2. Copy any file from `subliminal/affirmations/` (e.g. `focus-work.txt`).
3. In Mind Zoom: **Affirmation Editor** → open/import the file, or paste lines manually.

Format: **plain text, one affirmation per line** — same as Mind Zoom expects.

## Use our mixer instead of (or with) Mind Zoom

```bash
pip install edge-tts
python3 scripts/build_subliminal.py \
  --affirmations subliminal/affirmations/focus-work.txt \
  --music path/to/your-music.mp3 \
  --output subliminal/output/my-subliminal.mp3
```

Or start the local server (static site + mix API):

```bash
pip install edge-tts
python3 serve.py
```

Open http://localhost:8080/mixer.html — upload music + affirmations, download MP3.

## Reality check (personal use)

Conscious repetition + honest tracking remain more reliable than hidden embeds alone. Use subliminal audio as **optional support**, not a substitute for action and real-world follow-through.
