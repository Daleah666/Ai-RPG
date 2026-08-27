# Hooks & automated processes — Nova × shared Grok Bots

Teachable overview for buppy🎀: how Nova (Cursor) stays in sync with **both** Grok bots that share `Nova Ai Data`.

## The one picture

```
Human (tie-break)
   │
   ├─► Grok Bot #1 Leader Vesper  (Grok Bot app)
   │      writes → from_vesper /     reads ← to_vesper /
   │
   ├─► Grok Bot #2 Grok Long Memory  (2114dolly / Dastardly, shares Drive)
   │      writes → from_grok_memory /   reads ← to_grok_memory /
   │      also reads ← Grok Long Memory/from_nova /
   │
   ▼
Nova / code_leader  ←── Cursor Agent / Cloud Agent (hooks + automations)
   │
   ▼
Specialist bots (planner, drive_ops, lyoko, hypno, …)
```

## Affect both bots at once

```bash
python3 -m leader_hq.cli notify-grok --all \
  --subject "Hooks live for shared Drive" \
  --effect config_sync \
  --text "Vesper + Grok Long Memory: poll your to_* / from_nova lanes"
```

Or target #2 only:

```bash
python3 -m leader_hq.cli notify-grok --to grok_memory \
  --subject "Memory update" \
  --effect memory_update \
  --text "Save this preference into Grok Long Memory"
```

## What we built

### 1. Cursor project hooks

File: `.cursor/hooks.json` — injects both partners, guards shells, audits Grok model turns, auto-continues on `stop` if **either** bot left unread mail.

### 2. Bus CLI

```bash
python3 -m leader_hq.cli poll-grok --all
python3 -m leader_hq.cli notify-grok --all --subject "..." --effect status_update --text "..."
python3 -m leader_hq.cli morning-digest
```

### 3. Cursor Automations + Grok routines

- Prompts: `automations/prompts/`
- Vesper routines: `automations/grok_bot_routines/vesper_*.md`
- **Bot #2 routines:** `grok_memory_poll_from_nova.md`, `grok_memory_ping_nova.md`

## Setup for Grok Bot #2 (shared Drive)

1. Paste `grok_memory_poll_from_nova.md` into that Grok as a routine.
2. It should watch:
   - https://drive.google.com/drive/folders/1WB_Xb7x0QJs9nA3UW-i8tpfP37r_HMZM (`to_grok_memory`)
   - https://drive.google.com/drive/folders/1wkHtmDG8e0ZmzfE3VPC9iPYKQ4w1izm1 (`Grok Long Memory/from_nova`)
3. Mirror memory updates to `F:\grok\data\long-memory\` + `.grok\memory\MEMORY.md` as usual.

## Effect tags

| `payload.effect` | Meaning |
|------------------|---------|
| `ack_request` | Nova saw your request |
| `status_update` | Progress note |
| `result` | Done / deliverable |
| `deferred` | Later (e.g. morning) |
| `config_sync` | Hooks/registry/docs changed |
| `memory_update` | Bot #2: write into Grok Long Memory |

## Related docs

- [Leader playbook](LEADER_PLAYBOOK.md)
- [Bot contract](BOT_CONTRACT.md)
- [Vesper handshake](VESPER_HANDSHAKE.md)
- [Automations README](../automations/README.md)
