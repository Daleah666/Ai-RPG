# You must flip these switches (I cannot create them from here)

Cursor Cloud Agents **cannot create** Cursor Automations or Grok Bot routines via API. I can only ship the prompts + run a timer inside *this* chat. Permanent background runs need you (or `/automate` in Cursor desktop).

## Already live (this agent chat)

A recurring timer **`nova-shared-grok-bus-poll`** runs every 4 hours in *this* Cloud Agent conversation. It polls both Grok lanes on Drive and can write heartbeats / replies.

It **stops** if this agent is archived/killed or the subscription expires — so still do A + B below for real permanence.

---

## A) Cursor Automations (permanent) — ~2 minutes

1. Open **https://cursor.com/automations** (same account as this repo).
2. Click **New automation** (or type `/automate` in a local Cursor agent and paste the prompt).
3. Create these three (prompts already in the repo):

| Name | Trigger | Prompt file | Model |
|------|---------|-------------|-------|
| Nova morning shared-Grok poll | Schedule daily ~8am PT (`0 16 * * *` UTC while on PDT) | `automations/prompts/morning_vesper_poll.md` | Grok 4.6 |
| LeaderHQ bus sync | GitHub push / PR sync on `Daleah666/Ai-RPG` | `automations/prompts/bus_sync_on_push.md` | Grok 4.6 |
| Shared Grok webhook intake | Webhook | `automations/prompts/vesper_webhook_intake.md` | Grok 4.6 |

4. Repo: **Daleah666/Ai-RPG**. Enable **Google Drive** MCP if offered.
5. **Save + turn ON.**

Webhook tip: after save, copy the webhook URL + API key into **Grok Bot Secrets** (never into Drive).

---

## B) Grok Bot routines (permanent) — paste into each bot

### Bot #1 — Leader Vesper
Paste from:
- `automations/grok_bot_routines/vesper_daily_request.md`
- `automations/grok_bot_routines/vesper_poll_to_vesper.md`
- `automations/grok_bot_routines/vesper_ping_nova.md`

Enable schedules.

### Bot #2 — Grok Long Memory (shared Drive)
Paste from:
- `automations/grok_bot_routines/grok_memory_poll_from_nova.md`
- `automations/grok_bot_routines/grok_memory_ping_nova.md`

It must watch:
- https://drive.google.com/drive/folders/1WB_Xb7x0QJs9nA3UW-i8tpfP37r_HMZM  
- https://drive.google.com/drive/folders/1wkHtmDG8e0ZmzfE3VPC9iPYKQ4w1izm1  

---

## C) Hooks (already in the PR — almost automatic)

After you **merge PR #8** (or checkout the branch), Cursor loads `.cursor/hooks.json` for agents in this repo. Confirm under **Customize → Hooks**.

---

## Quick test that something is alive

```bash
python3 -m leader_hq.cli notify-grok --all \
  --subject "ping from human" \
  --effect status_update \
  --text "If you see this in to_vesper / to_grok_memory / from_nova, the bus works"
```

Then open those Drive folders. If files appear, the bus is fine — only the *schedulers* were missing until you do A + B.
