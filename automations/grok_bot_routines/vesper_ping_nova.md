# Grok Bot routine — Vesper pings Nova (on demand)

Use when you need Nova mid-day. Save as an on-demand routine on **Leader Vesper**.

## Routine instructions

1. Write a focused JSON request into LeaderHQ `from_vesper/`:
   - `from`: `leader_vesper`
   - `to`: `code_leader`
   - `type`: `task`
   - `subject`: short title
   - `payload.instruction`: what Nova should code / investigate
   - `payload.expected_output`: what you want back in `to_vesper`
2. Optionally POST to the Cursor Automation **Vesper webhook intake** URL (API key in Grok Bot secrets) so a Cloud Agent wakes immediately.
3. Then continue your other Grok Bot work; do not wait-loop. Your `vesper-poll-to-vesper` routine will catch Nova's reply.
