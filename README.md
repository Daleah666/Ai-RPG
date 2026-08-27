# Ai-RPG — Leader HQ

**Nova** (`code_leader`) is the leader bot. You talk to her; she manages specialist bots over a **Google Drive message bus** and partners with **Leader Vesper** on **Grok Bot**.

Aliases: Nova · code leader · leader

## Quick start (local bus)

```bash
python3 -m leader_hq.cli whoami
python3 -m leader_hq.cli init
python3 -m leader_hq.cli assign --to planner \
  --subject "First plan" \
  --instruction "Break the current goal into three tasks for drive_ops and gemini_worker"
python3 -m leader_hq.cli simulate-result --from-bot planner \
  --subject "Plan ready" \
  --result '{"tasks":["research","draft","schedule"]}'
python3 -m leader_hq.cli inbox
```

## Affect Grok Bots (Vesper #1 + Grok Long Memory #2)

```bash
# Fan-out to both bots that share Nova Ai Data
python3 -m leader_hq.cli notify-grok --all \
  --subject "Done" \
  --effect result \
  --text "Summary for shared Grok bots"

# Bot #2 only (Grok Long Memory)
python3 -m leader_hq.cli notify-grok --to grok_memory \
  --subject "Memory note" \
  --effect memory_update \
  --text "Save this under Grok Long Memory"

python3 -m leader_hq.cli poll-grok --all
python3 -m leader_hq.cli morning-digest
```

## Hooks & automations

- Project hooks: `.cursor/hooks.json` (inject Nova context, guard shell, auto-continue on unread Vesper mail)
- Cursor Automations + Grok Bot routines: [`automations/`](automations/README.md)
- Full guide: [`docs/GROK_BOT_AUTOMATION.md`](docs/GROK_BOT_AUTOMATION.md)

## Docs

- [Leader playbook](docs/LEADER_PLAYBOOK.md)
- [Bot contract](docs/BOT_CONTRACT.md)
- [Grok Bot automation](docs/GROK_BOT_AUTOMATION.md)
- [Drive bootstrap](scripts/bootstrap_drive.md)

## Domains

Adult entertainment AI programming, social media systems, feminization programming, and general bot orchestration (18+ only).
