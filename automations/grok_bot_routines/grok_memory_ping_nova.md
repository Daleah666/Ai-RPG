# Grok Bot #2 routine — ping Nova (on demand)

For the **Grok Long Memory** bot on the shared Nova Ai Data Drive.

## Routine

1. Write a focused JSON request into LeaderHQ `from_grok_memory/`:
   - `from`: `grok_memory`
   - `to`: `code_leader`
   - `type`: `task`
   - `subject`: short title
   - `payload.instruction`: what Nova should code / wire / fetch
   - `payload.expected_output`: what you want back in `to_grok_memory` / `from_nova`
2. Optionally POST the Cursor Automation **Vesper webhook intake** URL (same Nova wake path; include `"from":"grok_memory"` in the body).
3. Keep working; your poll routine catches Nova’s reply.

You share Drive with Nova and Vesper — prefer bus files over asking the human to relay.
