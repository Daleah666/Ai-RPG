# Hooks & automated processes — Nova × Grok Bot

Teachable overview for buppy🎀: how Nova (Cursor) and Vesper (Grok Bot) stay in sync without you babysitting every chat.

## The one picture

```
Human (tie-break)
   │
   ▼
Leader Vesper  ←── Grok Bot app (routines + computer)
   │  writes requests → from_vesper /
   │  reads effects  ← to_vesper /
   ▼
Nova / code_leader  ←── Cursor Agent / Cloud Agent (hooks + automations)
   │
   ▼
Specialist bots (planner, drive_ops, lyoko, hypno, …)
```

## What we built

### 1. Cursor project hooks (affect Grok *model* sessions in Cursor)

File: `.cursor/hooks.json`

| Hook | Script | What it does |
|------|--------|----------------|
| `beforeSubmitPrompt` | injects Nova/Vesper context + bus status | Keeps every session (esp. Grok models) aligned with LeaderHQ |
| `beforeShellExecution` | soft-denies destructive shells | Safety net while agents run |
| `postToolUse` | Drive/bus nudge | Reminds to write `to_vesper` after Drive tools |
| `afterAgentResponse` | audit log | Records Grok vs non-Grok turns under `.local_bus/.../hooks_audit` |
| `stop` | Vesper unread check | Auto-continues once if `from_vesper` still has work (`loop_limit` 3) |

Cloud Agents load these project hooks. They do **not** load `~/.cursor/hooks.json`.

### 2. Bus CLI to **affect Grok Bot agents**

Grok Bot does not run Cursor hooks. Nova affects Vesper by writing structured messages:

```bash
python3 -m leader_hq.cli init
python3 -m leader_hq.cli simulate-vesper \
  --subject "Fix lore shelf path" \
  --instruction "Lyoko drop_path needs Vesper-directed shelf"
python3 -m leader_hq.cli poll-vesper --json
python3 -m leader_hq.cli notify-vesper \
  --subject "Shelf path fixed" \
  --effect status_update \
  --text "Updated LORE_SHELVES; please re-check shelves"
python3 -m leader_hq.cli morning-digest
```

Drive mirrors: `config/drive_ids.json` → `from_vesper` / `to_vesper`.

### 3. Cursor Automations (scheduled / webhook / git)

Templates in `automations/prompts/`. Create them at https://cursor.com/automations with a **Grok** model.

### 4. Grok Bot routines (paste into Vesper)

Templates in `automations/grok_bot_routines/`. Enable schedules in the Grok Bot app.

## Setup checklist (do once)

1. Merge/pull this branch into your working tree.
2. In Cursor: open **Customize → Hooks** and confirm project hooks load.
3. At https://cursor.com/automations create the three automations from `config/automations.manifest.json` (copy prompts).
4. In Grok Bot → **Leader Vesper** → add the three routines; put webhook API key in **Secrets** (never in Drive).
5. Smoke test locally:

```bash
python3 -m leader_hq.cli init
python3 -m leader_hq.cli simulate-vesper --subject "ping" --instruction "say hi via to_vesper"
python3 -m leader_hq.cli poll-vesper
python3 -m leader_hq.cli notify-vesper --subject "hi back" --effect result --text "pong"
python3 -m unittest discover -s tests -v
```

## Effect tags Nova may send

| `payload.effect` | Meaning for Vesper |
|------------------|--------------------|
| `ack_request` | Nova saw your request |
| `status_update` | Progress note |
| `result` | Done / deliverable |
| `deferred` | Will handle later (e.g. morning) |
| `config_sync` | Hooks/registry/docs changed |

## Related docs

- [Leader playbook](LEADER_PLAYBOOK.md)
- [Bot contract](BOT_CONTRACT.md)
- [Vesper handshake](VESPER_HANDSHAKE.md)
- [Automations README](../automations/README.md)
