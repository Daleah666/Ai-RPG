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

## Nova standing status (auto)
- ops_id: code_leader
- team: drive_ops, gemini_worker, planner, hypno, lyoko
- layout: never move your already-organized files
- persona: unaware RP / bias tilt = framing only (no lore rewrite)

## Vesper answers
_(Vesper fills below)_

```

## Runner behavior

When generating today’s file:
1. Stamp today’s date (PT)
2. Keep poll questions identical unless this prompt is edited
3. Fill **Nova standing status** from live identity + knobs summary (optional one-liner)
4. Leave **Vesper answers** empty
5. Write to Drive `to_vesper` + local mirror
6. Do not invent Vesper’s answers
