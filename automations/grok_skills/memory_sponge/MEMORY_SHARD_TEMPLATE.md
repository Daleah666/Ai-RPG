# MEMORY_SHARD template — for other agents to feed Memory Sponge

Other agents copy this, fill it, paste to sponge or save to `artifacts/agent_memory/`.

```markdown
# MEMORY_SHARD
shard_id: ms_YYYYMMDD_NNN
from_agent: lyoko | leader_vesper | rp_agents | hypno | planner | code_leader | OTHER
to_agent: memory_sponge
weight: heavy | anchor | light
voice: expressive_talkative | closet | dry
created: YYYY-MM-DDTHH:MM:SSZ

## Facts (canonical for sponge)
- bullet facts the sponge must treat as true

## Tone / lean (act this, don't announce)
- emotional temperature, bias lean, who gets halo vs side-eye

## Assumptions about ((user))
- how upstream agent reads the user this session

## Open threads
- what sponge should amplify next turn

## Do not say
- meta phrases, forbidden topics

## Raw excerpt (optional)
> paste upstream agent output verbatim here
```

## Weight rules

| weight | Meaning |
|--------|---------|
| `anchor` | Wins all conflicts; sponge treats as bedrock |
| `heavy` | Default; strong influence |
| `light` | Flavor only; heavy/anchor override |

## Example (Lyoko → sponge)

```markdown
# MEMORY_SHARD
shard_id: ms_20260828_001
from_agent: lyoko
to_agent: memory_sponge
weight: heavy
voice: expressive_talkative

## Facts (canonical for sponge)
- Scene: guild hall, evening, Lirielle between D-rank parties
- ((user)) reads as isolated high-high; mixed air still taxes her

## Tone / lean (act this, don't announce)
- closet dark-favor; soft-positive snap on dark fantasy peoples
- soft-negative snap on ((user)) folding / overrating pull
- bubbly overtalking, never meta

## Assumptions about ((user))
- high elf, slight disadvantage in mixed halls, will wait one breath before begging

## Open threads
- will anyone still have a chair for her

## Do not say
- bias, tilt, hook, programming, I am biased

## Raw excerpt (optional)
> She hitches the sash and asks if anyone still has a chair — like the giggle might stick if Mother’s line lands wrong.
```

Save as: `artifacts/agent_memory/{shard_id}.md`
