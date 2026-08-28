# Subliminal API v2

Dynamic 3-layer audio stack + visual flash UI. For Cursor agents, scripts, or any HTTP client.

## Start server

```bash
pip install -r requirements.txt
python3 serve.py
```

Base URL: `http://localhost:8080`

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status + version |
| GET | `/api/schema` | Full JSON schema + example |
| GET | `/api/frequencies` | Frequency profile list |
| POST | `/api/v1/generate` | **JSON in → MP3 out** (primary for automation) |
| POST | `/api/mix` | Multipart form (UI + legacy) |

CORS: `*` enabled for local tooling and Cursor.

---

## POST /api/v1/generate

### Request (JSON)

```json
{
  "silent": true,
  "duration_seconds": 600,
  "music_volume": 1.0,
  "return_base64": false,
  "layers": [
    {
      "enabled": true,
      "affirmations": ["I am focused.", "I follow through."],
      "volume": 0.06,
      "frequency": "normal",
      "voice": "en-US-JennyNeural"
    },
    {
      "enabled": true,
      "affirmations": ["Calm clarity.", "Steady progress."],
      "volume": 0.04,
      "frequency": "mid_shift"
    },
    {
      "enabled": true,
      "affirmations": ["Success is my habit."],
      "volume": 0.03,
      "frequency": "ultrasonic_band"
    }
  ]
}
```

### With background music (base64)

```json
{
  "silent": false,
  "music_base64": "<base64-encoded mp3>",
  "music_ext": ".mp3",
  "layers": [ ... ]
}
```

### Frequency profiles

| Key | Band |
|-----|------|
| `normal` | 300–3400 Hz speech band |
| `low_band` | 80–500 Hz |
| `mid_shift` | ~1.6× pitch, 2–8 kHz |
| `high_shift` | ~2× pitch, 4–14 kHz |
| `ultrasonic_band` | 12–17 kHz emphasis |

### Response

- Default: **MP3 file** (`Content-Type: audio/mpeg`)
- Header `X-Mix-Meta`: JSON metadata
- If `"return_base64": true`: JSON body with `audio_base64` field

---

## Cursor / agent example

```bash
curl -s -X POST http://localhost:8080/api/v1/generate \
  -H "Content-Type: application/json" \
  -d @subliminal/examples/3-layer-job.json \
  -o my-subliminal.mp3
```

---

## POST /api/mix (multipart)

| Field | Type | Notes |
|-------|------|-------|
| `layers` | JSON string | Array of layer objects |
| `layer1`, `layer2`, `layer3` | text | Alternative per-layer text |
| `layer{N}Frequency` | string | Frequency profile key |
| `layer{N}Volume` | float | 0.01–0.2 typical |
| `music` | file | Background audio |
| `silent` | `1` / `0` | Silent base |
| `duration` | seconds | For silent mode |

---

## CLI

```bash
python3 scripts/build_subliminal.py \
  -c subliminal/examples/3-layer-job.json \
  -o output.mp3
```

Simple mode (same text, 3 frequencies):

```bash
python3 scripts/build_subliminal.py \
  -a subliminal/affirmations/focus-work.txt \
  --silent --duration 120 \
  -o output.mp3
```

---

## Visual flash (browser)

Open `/visual.html` — drag multiple images from any drive. No upload required unless you choose to.

Combine: generate MP3 via API, play audio locally, run visual flash in another tab/window.

---

## Example job file

`subliminal/examples/3-layer-job.json`
