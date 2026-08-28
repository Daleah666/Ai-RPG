# Nova morning shared-Grok poll — prompt

Director template for Nova’s **morning poll** to Leader Vesper (Grok) on the shared Drive bus.

## Purpose

Once each morning (~8am PT, or when Nova wakes), post a short **shared poll** so Vesper can steer the day without a long chat. Nova keeps coding work; Vesper answers with life/calendar/subliminal priorities + any coding **requests**.

## Unaware / tone rules

- Nova writes as Nova — warm, talkative, competent
- Do **not** dump persona knobs / bias meta into the poll
- Requests not orders (unless human locked orders → Vesper)
- Never reshuffle Vesper’s existing shelves

## Where to post

1. `LeaderHQ/to_vesper/YYYYMMDD_nova_morning_poll.md` (primary)
2. Sibling copy under `Nova Ai Data/` if helpful
3. Optional one-liner on main bus Doc LOG (newest on top)

## Output shape (fill date, keep structure)

```markdown
# Nova morning poll → Leader Vesper (Grok)
from: code_leader (Nova)
to: leader_vesper
type: morning_poll
date: YYYY-MM-DD
tz: America/Los_Angeles

Vesper — quick shared poll so I can plan the coding day. Reply under **Vesper answers** (or on the main bus Doc). Keep other work; clash → we talk.

## Poll (check / short answers)

1. **Priority lane today?**
   - [ ] coding / repos / LeaderHQ bus
   - [ ] lore / Lyoko (you name shelf)
   - [ ] subliminals / Hypno research
   - [ ] Drive hygiene (LeaderHQ bus only)
   - [ ] rest / no ask
   - [ ] other: ___

2. **Any coding REQUEST for me?** (one paragraph max)
   >

3. **Calendar / life blockers I should not step on?**
   >

4. **Lore shelf pointer** (only if Lyoko work today)
   - shelf_name:
   - drop_folder_id / drop_path:
   - place_mode: beside | inside | new_subfolder

5. **Knobs** (optional — director only; leave blank to keep closet defaults)
   - bias_tilt: on | off | _(blank)_
   - strength: 0–10 | _(blank)_
   - preset: closet | louder | off | _(blank)_

6. **Anything Clash-risk with your other bots?**
   >

## Team morning parts

_Each agent fills **only their** subsection below. Nova posts; Vesper reads all before steering._

### Drive Ops (`drive_ops`)
_lane: LeaderHQ bus hygiene_
1. Unread in from_vesper / bot inboxes worth a glance?
   >
2. Any search_jobs or dump/INGEST_LOG lines since yesterday?
   >
3. Drive blockers (permissions, missing folder)?
   >

### Gemini Worker (`gemini_worker`)
_lane: Heavy drafting queue_
1. Draft/summarize/rewrite ready if Vesper picks coding lane?
   >
2. One sentence on what you'd tackle first today.
   >

### Planner (`planner`)
_lane: Task graph_
1. Top 3 tasks for Nova today (if any goal is active).
   >
2. Which bot owns each? priority 1–3?
   >

### Hypno (`hypno`)
_lane: Subliminal / audio research_
1. Formula or preset mode in progress?
   >
2. Research ask for Vesper / Subliminal Maker today?
   >

### Lyoko (`lyoko`)
_lane: Lore / worldbuilding_
1. Open lore thread or character note?
   >
2. Shelf Vesper should point at if lore lane today (name only).
   >

### Memory Sponge (`memory_sponge`)
_lane: Echo receiver (Grok)_
1. Shards ingested overnight from artifacts/agent_memory?
   >
2. Dominant lean carried into today's echo (one line).
   >
_note: Grok-side; fills after other agents drop parts or shards._

## Nova standing status (auto)
- ops_id: code_leader
- team: drive_ops, gemini_worker, planner, hypno, lyoko
- layout: never move your already-organized files
- persona: unaware RP / bias tilt = framing only (no lore rewrite)

## Vesper answers
_(Vesper fills below — after team morning parts if used)_

```

## Runner behavior

When generating today’s file:
1. Stamp today’s date (PT)
2. Keep poll questions identical unless this prompt is edited
3. Fill **Nova standing status** from live identity + knobs summary (optional one-liner)
4. Leave **Vesper answers** empty
5. Write to Drive `to_vesper` + local mirror
6. Do not invent Vesper’s answers
