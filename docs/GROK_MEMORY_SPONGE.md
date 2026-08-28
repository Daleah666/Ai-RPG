# Grok Memory Sponge agent

**Memory Sponge** (`memory_sponge`) is a Grok-side agent that **only receives memory from other agents** and speaks from that ingested state — heavily influenced, echo-chamber style.

## Files

| File | Use |
|------|-----|
| `automations/grok_skills/memory_sponge/SKILL.md` | Install in Grok `/root/.grok/skills/memory-sponge/SKILL.md` |
| `automations/grok_skills/memory_sponge/ROUTINE.md` | Paste into a dedicated Grok Bot's custom instructions |
| `automations/grok_skills/memory_sponge/MEMORY_SHARD_TEMPLATE.md` | Other agents use this to feed the sponge |

## Install on Grok (isolated VM)

1. Create folder: `/root/.grok/skills/memory-sponge/`
2. Copy `SKILL.md` there
3. Optional: create artifact folders the skill expects:

```bash
mkdir -p /home/workdir/artifacts/agent_memory
mkdir -p /home/workdir/artifacts/echo_in
mkdir -p /home/workdir/artifacts/echo_out
```

4. Create a **separate Grok Bot** (recommended) and paste `ROUTINE.md` into its instructions
5. Invoke with `/memory-sponge` or paste a `MEMORY_SHARD` block

## How other agents feed it

1. Lyoko / Vesper / rp-agents / Nova bots write a `MEMORY_SHARD` (see template)
2. Drop to:
   - Grok VM: `/home/workdir/artifacts/agent_memory/{shard_id}.md`
   - Drive: user-named folder or bus outbox (Nova can mirror)
3. Open Memory Sponge bot → `/memory-sponge` or "read agent_memory"

Sponge **expands** upstream memory in speech — it does not replace their canon.

## Influence model

- Upstream shards ≈ **90% authoritative** on tone, lean, assumptions
- `weight: anchor` wins conflicts
- Sponge does not invent facts when memory is silent
- Unaware RP: act the lean, never announce hooks/knobs

## vs rp-agents skill

| | rp-agents | memory-sponge |
|---|-----------|---------------|
| Job | 9 internal agents → one RP reply | External agent memory → influenced echo |
| Input | User + char card | MEMORY_SHARD from other bots |
| Token cost | Heavy | Medium (dry mode = light) |
| Canon source | Character card | Upstream agents only |

Use **both**: rp-agents writes → export trace as shard → sponge amplifies for Vesper or group chat.

## Nova bus (optional)

Nova can post shards to Drive for Grok to read. Do not move Vesper's existing shelves. New files only where pointed.
