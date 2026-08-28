# Morning on their parts — per-agent fill guide

Each specialist fills **only their subsection** in the daily morning poll. Nova stitches the doc; Vesper steers from **Poll + team parts + Vesper answers**.

## Flow (~8am PT weekday)

```
Nova: morning-poll → to_vesper
  ↓
Each bot/Grok agent fills THEIR ### section (or drops shard)
  ↓
Memory Sponge (optional): ingest team parts → echo_out
  ↓
Vesper: Poll answers + reads team parts
```

## Who fills what

| Agent | Section header | Their job |
|-------|----------------|-----------|
| **drive_ops** | `### Drive Ops` | Bus hygiene, unread, ingest log |
| **gemini_worker** | `### Gemini Worker` | Draft queue readiness |
| **planner** | `### Planner` | Top 3 tasks + owners |
| **hypno** | `### Hypno` | Subliminal/formula lane |
| **lyoko** | `### Lyoko` | Lore thread + shelf hint (name only) |
| **memory_sponge** | `### Memory Sponge` | Shards ingested + dominant lean (Grok) |
| **leader_vesper** | `## Vesper answers` | Priority lane, requests, calendar |

## Rules for every agent

1. Fill **only** your `###` block — do not edit others
2. Short — bullets or one paragraph per prompt line
3. No meta about knobs/hooks/programming in character voice
4. If nothing to report: `> REST — nothing new`
5. Lyoko never names a drop path without Vesper — shelf **name** only

## Grok bots (Vesper, Memory Sponge)

- **Vesper:** `## Vesper answers` + optional anchor shard to sponge (`weight: anchor`)
- **Memory Sponge:** read team parts → `/memory-sponge` → one-line dominant lean in its section

## Convert part → sponge shard

```bash
python3 -m leader_hq.cli morning-shard --from lyoko --text "Open thread: Lirielle chair bit"
```

Writes `MEMORY_SHARD` to `.local_bus/LeaderHQ/memory_sponge/in/` for Grok pickup.

## Nova CLI

```bash
python3 -m leader_hq.cli morning-poll              # poll + empty team parts
python3 -m leader_hq.cli morning-poll --no-parts   # Vesper poll only
python3 -m leader_hq.cli morning-shard --from planner --text "..."
```
