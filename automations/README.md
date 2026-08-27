# Automations for Nova ↔ shared Grok Bots

Ready-to-paste prompts and routines for **both** Drive partners.

| Path | Where to install |
|------|------------------|
| `prompts/*.md` | [Cursor Automations](https://cursor.com/automations) — use Grok model |
| `grok_bot_routines/vesper_*.md` | Grok Bot app → **Leader Vesper** (#1) → Routines |
| `grok_bot_routines/grok_memory_*.md` | **Grok Long Memory** (#2, shared Drive) → Routines |
| `../config/automations.manifest.json` | Index of all automations |

## Why two Grok surfaces?

| # | Bot | How Nova affects it |
|---|-----|---------------------|
| 1 | Leader Vesper | `to_vesper` JSON + Vesper poll routine |
| 2 | Grok Long Memory (shares Drive) | `to_grok_memory` + `Grok Long Memory/from_nova/` |

Cursor hooks cannot attach to either Grok loop — Drive JSON + routines are the bridge.

```
Either Grok writes from_* 
  → Cursor Automation / Nova + hooks
  → notify-grok --all (or --to …)
  → that Grok's poll routine applies effects
```
