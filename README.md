# Ai-RPG — Leader HQ

**Nova** (`code_leader`) is the leader bot. You talk to her; she manages specialist bots over a **Google Drive message bus**.

Aliases: Nova · code leader · leader

## Quick start (local bus)

```bash
python -m leader_hq.cli whoami
python -m leader_hq.cli init
python -m leader_hq.cli assign --to planner \
  --subject "First plan" \
  --instruction "Break the current goal into three tasks for drive_ops and gemini_worker"
python -m leader_hq.cli simulate-result --from-bot planner \
  --subject "Plan ready" \
  --result '{"tasks":["research","draft","schedule"]}'
python -m leader_hq.cli inbox
```

## Docs

- [Leader playbook](docs/LEADER_PLAYBOOK.md)
- [Bot contract](docs/BOT_CONTRACT.md)
- [Drive bootstrap](scripts/bootstrap_drive.md)

## Domains

Adult entertainment AI programming, social media systems, feminization programming, and general bot orchestration (18+ only).
