# Cursor agent integration

Use this when a Cursor cloud agent (or any script) should **generate subliminals automatically**.

## 1. Start the server (once per session)

```bash
pip install -r requirements.txt
python3 serve.py 8080
```

## 2. Primary endpoint

**POST** `http://localhost:8080/api/v1/generate`

Returns an **MP3** with up to **3 stacked layers**, each at a different frequency profile.

### Minimal JSON body

```json
{
  "silent": true,
  "duration_seconds": 120,
  "layers": [
    {
      "enabled": true,
      "affirmations": ["I am focused.", "I follow through."],
      "volume": 0.06,
      "frequency": "normal"
    },
    {
      "enabled": true,
      "affirmations": ["Calm clarity."],
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

### With music (base64)

```json
{
  "silent": false,
  "music_base64": "<base64>",
  "music_ext": ".mp3",
  "layers": [ ... ]
}
```

### JSON response instead of file

Add `"return_base64": true` to get `{ "audio_base64": "...", ...meta }`.

## 3. Discovery endpoints

| GET | Purpose |
|-----|---------|
| `/api/health` | `{ "status": "ok", "layers": 3 }` |
| `/api/schema` | Full schema + example |
| `/api/frequencies` | Frequency profile keys |

## 4. Example job file

`subliminal/examples/3-layer-job.json`

```bash
curl -s -X POST http://localhost:8080/api/v1/generate \
  -H "Content-Type: application/json" \
  -d @subliminal/examples/3-layer-job.json \
  -o output.mp3
```

## 5. Visual flash (browser, no upload)

Open `http://localhost:8080/visual.html`:

- Drag **multiple images** from any folder/drive onto the page or drop zone
- Or paste affirmation lines → **Convert lines to flash cards**
- Set interval (ms) and opacity → **Start flashing** or **Fullscreen overlay**

Combine: play generated MP3 while visual flash runs in another tab.

## 6. Frequency profiles

| Key | Use |
|-----|-----|
| `normal` | Layer 1 — speech band |
| `low_band` | Low frequency bed |
| `mid_shift` | Layer 2 — mid pitch shift |
| `high_shift` | High pitch shift |
| `ultrasonic_band` | Layer 3 — upper band |

## 7. CLI (no HTTP)

```bash
python3 scripts/build_subliminal.py \
  -c subliminal/examples/3-layer-job.json \
  -o output.mp3
```
