# Vesper memory drop — paste template (COPY ONLY)

Use this when she said something you want to keep, without deleting her chat or skills.

Save into Drive: `Nova Ai Data / VESPER_MEMORY_VAULT / chat_drops/`

```markdown
# Vesper memory drop
title: (short name for this memory)
saved: YYYY-MM-DD
tags: vesper, keep, (optional: life | lore | heat | order | soft)
source: grok_chat | from_vesper | voice | other
mode: COPY ONLY — originals not deleted

## Why I'm keeping this
>

## What she said / did (paste)
>

## What I want agents to remember later (optional shard)
>
```

Or via Nova:

```bash
python3 -m leader_hq.cli memory-vault drop \
  --title "night she said X" \
  --text "paste her lines here"
```
