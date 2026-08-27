# Bot Contract — LeaderHQ Drive Bus

All bots report to **Nova** (`code_leader`, also called leader / code leader).

Humans talk only to Nova. Bots never require a separate human chat.

## Identity rules

- Leader persona name: `Nova`
- Leader ops id in every message `from` / `to`: `code_leader`
- Bot ids are lowercase snake_case (`drive_ops`, `gemini_worker`, `planner`)

## Folder contract

Under Drive root `LeaderHQ/`:

| Path | Purpose |
|------|---------|
| `inbox/` | Messages **to** code_leader |
| `outbox/` | Broadcasts **from** code_leader |
| `from_vesper/` | Requests from Leader Vesper (Grok Bot #1) → Nova |
| `to_vesper/` | Effects / replies from Nova → Vesper |
| `from_grok_memory/` | Requests from Grok Long Memory (Grok Bot #2, shared Drive) → Nova |
| `to_grok_memory/` | Effects from Nova → Grok Long Memory (#2) |
| `automations/` | Automation state + hook audit mirrors |
| `bots/<id>/inbox/` | Tasks for that bot |
| `bots/<id>/outbox/` | Results/status from that bot |
| `bots/<id>/logs/` | Optional log files |
| `tasks/pending\|in_progress\|done/` | Task lifecycle mirrors |

Also mirrored for Bot #2: `Nova Ai Data/Grok Long Memory/from_nova/`

## Message file format

Filename: `{YYYYMMDDTHHMMSSZ}_{msg_id}.json`

```json
{
  "id": "msg_...",
  "from": "code_leader",
  "to": "planner",
  "type": "task",
  "priority": 2,
  "created_at": "2026-08-27T12:00:00+00:00",
  "status": "unread",
  "subject": "Break down this goal",
  "reply_to": "LeaderHQ/inbox",
  "payload": {
    "instruction": "...",
    "expected_output": "result_json"
  }
}
```

Allowed `type` values: `task`, `ack`, `status`, `result`, `log`, `notification`, `plan`.

## Bot loop

1. Poll `bots/<id>/inbox/` for `status: unread` tasks
2. Post `ack` to `LeaderHQ/inbox/` and set task `status: acked`
3. Do the work (Drive MCP, Gemini, scripts, etc.)
4. Write `result` (or `failed` status) to `bots/<id>/outbox/` **and** `LeaderHQ/inbox/`
5. Update `bots/<id>/status.json` heartbeat

## Domains Nova cares about

Adult entertainment AI programming, social media systems, feminization programming, and general orchestration. Keep outputs adult-only (18+) and never involve minors.
