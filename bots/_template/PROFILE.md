# Bot Template

- id: `REPLACE_ME`
- reports_to: `code_leader` (Nova)
- role: Describe the specialty

## Capabilities

- list capabilities

## Inbox protocol

1. Poll `LeaderHQ/bots/<id>/inbox/`
2. Ack to `LeaderHQ/inbox/`
3. Do the work
4. Post `result` to outbox + leader inbox
5. Update `status.json`
