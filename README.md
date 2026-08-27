# Veil Studio

Theme-trained **subliminal maker**: flashing images and text, YouTube-style audio stacks, a Google Drive / local-folder connector, and an HTTP API that builds a full mix from a desired theme.

This is a creative wellness tool. Scientific evidence for subliminals is mixed. It is not medical treatment. Rapid flashes can trigger photosensitive epilepsy — the studio caps flash rate at **2 Hz** and defaults to one short frame every few seconds, not a strobe.

## What it makes

The generator classifies a theme (confidence, wealth, sleep, body, focus, …) and applies a recipe used by high-quality YouTube subliminal channels:

| Recipe | What you get |
| --- | --- |
| Classic rain whisper | Quiet voice 17–25 dB under rain |
| Silent omega | ~18.5 kHz AM carrier (“silent”) |
| Results-picture flash | Drive / folder / generated stills, 1–2 frames |
| 25th-frame insert | Single-frame cutaway + optional noise mask |
| Theta sleep | Brown noise + theta binaural + morph overlay |
| Affirmation storm | Many overlapping layers / compressed speech |
| Dual hemisphere | Forward + reverse, headphones |
| Boosted mirror | Longer flashes, louder whisper |
| Night loop | Isochronic + sparse void flashes |
| Aesthetic lo-fi | Gradient stills + 8D pan |
| Speed compressed | 2x speech for study-style tracks |
| Morph void | Low-opacity burn-in + reverse + silent |

Methods can be stacked: whisper mask, backmask, speed stack, binaural, isochronic, layered storm, 8D, image flash, text RSVP, frame insert, morph overlay, void mirror, dual channel.

## Run

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Type a theme, generate, play. Fullscreen player is `/play`.

## Drive connector

Copy `.env.example` to `.env.local`.

For Google Drive:

1. Create a Google Cloud project, enable **Google Drive API**.
2. OAuth client of type **Web application**.
3. Redirect URI: `http://localhost:3000/api/drive/callback` (or your deploy URL).
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

`/connect` then offers **Connect Google Drive**, folder browse, and import of images as flash stills. Projects can be saved back to Drive as JSON.

Without OAuth, **Link local folder** / upload still works — same flashing pipeline.

## API

If `SUBLIMINAL_API_KEY` is set, send `Authorization: Bearer <key>` or `x-api-key`.

```bash
curl -s -X POST http://localhost:3000/api/v1/generate \
  -H 'Content-Type: application/json' \
  -d '{"theme":"quiet wealth","recipeId":"auto"}'
```

```bash
curl -s -X POST http://localhost:3000/api/v1/render \
  -H 'Content-Type: application/json' \
  -d '{"theme":"deep sleep"}' --output sleep.wav
```

- `GET /api/v1/methods`
- `GET /api/v1/recipes`
- `GET /api/v1/themes`

Set `OPENAI_API_KEY` to let `/api/v1/generate` rewrite the script with a model. Without it, the local theme model writes present-tense, first-person lines (identity, feeling, evidence, social, gratitude).

`renderAudio: true` on generate returns a base64 WAV (short preview). `/api/v1/render` returns `audio/wav`.

## Export

From the studio: project JSON, rendered WAV (whisper / reverse / layers / binaural / isochronic / silent carrier mixed in one file), or save JSON to Drive. The live player composites flashes on a canvas and the Web Audio mix together.

## Stack

Next.js 15 App Router, TypeScript, canvas visual engine, Web Audio live mix, isomorphic voice synth + Node WAV renderer, Vitest.
