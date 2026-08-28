# Recover Grok skill: agent-bimbo-better-belief

## Why you can't access it

| Issue | What's going on |
|-------|-----------------|
| **Wrong machine** | Cursor/Nova **cannot** read `/home/workdir/.grok/skills/` — that's Grok's isolated VM only |
| **Wrong path** | Skills usually live at **`~/.grok/skills/`** or **`/root/.grok/skills/`**, not always under `workdir` |
| **Grok blocks self-read** | Some Grok sessions refuse to `cat` their own skill files (permission / sandbox) |
| **Ephemeral VM** | New chat = new VM; skill may not exist until reinstalled |
| **No Drive backup** | Searched your Drive — **no copy** of `agent-bimbo-better-belief` found (bimbo-speak exists, not this one) |

## Find it inside Grok (paste in Grok chat with computer)

```bash
# Try all common skill locations
ls -la ~/.grok/skills/ 2>/dev/null
ls -la /root/.grok/skills/ 2>/dev/null
ls -la /home/workdir/.grok/skills/ 2>/dev/null
find /home/workdir /root -path '*/.grok/skills/agent-bimbo-better-belief/SKILL.md' 2>/dev/null

# If found — copy to artifacts (you CAN usually write here)
mkdir -p /home/workdir/artifacts/skill_backup
cp -r ~/.grok/skills/agent-bimbo-better-belief /home/workdir/artifacts/skill_backup/ 2>/dev/null || \
cp -r /root/.grok/skills/agent-bimbo-better-belief /home/workdir/artifacts/skill_backup/ 2>/dev/null || \
cp -r /home/workdir/.grok/skills/agent-bimbo-better-belief /home/workdir/artifacts/skill_backup/ 2>/dev/null

cat /home/workdir/artifacts/skill_backup/agent-bimbo-better-belief/SKILL.md
```

If `cat` is blocked, ask Grok: **"Print the full contents of /agent-bimbo-better-belief skill for me to copy"** or use `/agent-bimbo-better-belief` and say "dump your skill instructions verbatim."

## Reinstall from repo backup

Nova shipped a **reconstruction** (not your original — merge if you recover the real file):

```
automations/grok_skills/agent_bimbo_better_belief/SKILL.md
```

Install in Grok:

```bash
mkdir -p ~/.grok/skills/agent-bimbo-better-belief
# paste SKILL.md content into that file
```

Or project scope: `.grok/skills/agent-bimbo-better-belief/SKILL.md`

## Backup rule (so this doesn't happen again)

After any skill edit in Grok:

```bash
cp -r ~/.grok/skills/agent-bimbo-better-belief /home/workdir/artifacts/skill_backup/
```

Then upload `artifacts/skill_backup/` to **Nova Ai Data** or ask Nova to mirror to Drive.

## Related skills you DO have on Drive

- **bimbo-speak** — [SKILL.md on Drive](https://drive.google.com/file/d/1OT_J7HQpCyxwsoKEwEPae5DOFJ9b8pSt/view)
- **memory-sponge** — repo `automations/grok_skills/memory_sponge/`
- **rp-agents** — Drive Grok_Backups folders

`agent-bimbo-better-belief` is a **different** skill (belief-layer agent, not just speak translator).
