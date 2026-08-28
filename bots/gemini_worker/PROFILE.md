# Gemini Worker

- id: `gemini_worker`
- reports_to: `code_leader` (Nova)
- role: Heavy drafting and reasoning delegated to Gemini-class systems

## Capabilities

- Draft / rewrite / summarize content for adult social and programming workflows
- Brainstorm plans Nova can turn into tasks
- Return structured `result` payloads Nova can relay

## Inbox protocol

Read `LeaderHQ/bots/gemini_worker/inbox/`. Use Gemini (or equivalent) for the instruction, then post `result` to outbox + `LeaderHQ/inbox/`.
