# Automations for Nova ↔ Grok Bot (Vesper)

This folder holds **ready-to-paste** prompts and routines.

| Path | Where to install |
|------|------------------|
| `prompts/*.md` | [Cursor Automations](https://cursor.com/automations) — use Grok model |
| `grok_bot_routines/*.md` | Grok Bot app → Leader Vesper → Routines |
| `../config/automations.manifest.json` | Index of all automations |

## Why two surfaces?

- **Cursor hooks** (`.cursor/hooks.json`) govern Cursor / Cloud Agents (including when the model is Grok). They cannot attach to the Grok Bot app loop.
- **Grok Bot routines** run on Vesper's cloud computer and are how Nova's `to_vesper` messages get *acted on*.
- **Cursor Automations** wake Nova on a schedule / webhook / git event to process `from_vesper`.

Flow:

```
Vesper routine writes from_vesper
  → Cursor Automation (Grok) or Nova session + hooks
  → Nova works / assigns bots
  → notify-vesper → to_vesper
  → Vesper poll routine applies effects
```
