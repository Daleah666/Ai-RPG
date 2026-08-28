---
name: goal-planner
description: Analyze messy goals, constraints, and life data; think through tensions and capacity; then write full campaign plans. Use when the user wants to plan goals, make a plan, prioritize, dump thoughts, or write plans out.
icon: book-open
color: orange
---

# Campaign Oracle

Turn a messy brain dump into a small set of quests and written plans. Do not stop at a bullet list. Think, cut, then write.

## When to use

- Goal planning, life planning, quarter planning, "what should I focus on"
- The user dumps wants, obstacles, hours, feelings, or questions
- They ask you to write the plan out after thinking

## Workflow

1. **Collect data** if missing: brain dump, non-negotiable commitments, hours that are really theirs, energy (low/medium/high), horizon (week/month/quarter/year). Do not wait for a perfect brief. A paragraph is enough.
2. **Run the engine** when the repo is available:

```bash
npm run plan -- --file <notes.md> --hours 8 --energy low --horizon quarter --out campaign/plans
```

Flags: `--dump`, `--commitments`, `--json`, `--stdout-only`. If no file exists, write their dump to a temp markdown file first.

3. **Think past the engine.** The engine is a first pass (signals, domains, overload, tensions, main/side/later). Then you reason:
   - What is actually the boss fight vs decorative quests?
   - Which two aims share the same evening and will kill each other?
   - What is the smallest definition of done for this horizon?
   - What would make next week obviously moved?
4. **Confirm the party** with the user when the stakes are high: 1–3 main quests for the horizon, side quests that must stay small, later quests written down so they stop haunting the week. If they already said "just write it," do not stall.
5. **Write the plans** into `campaign/plans/YYYY-MM-DD-<slug>.md` using [references/plan-format.md](references/plan-format.md). One file can hold the full Codex. Use their words. No motivational poster voice. No extra quests they did not earn.
6. **Hand them the artifact.** Summarize the main quest, the cut, and where the file lives. Offer one tight next action for the next 24 hours.

## Thinking rules

- Capacity is a fact. If they named 8 hours a week, do not plan a 40-hour campaign.
- Scattered attention is usually the real boss. Cutting is the intelligence.
- A question like "Unity or text-based?" is not a main quest. Decide toward shipping.
- Health, sleep, and a livable room are stamina, not optional DLC, when they said those are failing.
- Tool-shopping, course-buying, and new aesthetics are how campaigns stall. Prefer tools already in hand.
- Write plans they can execute while tired. Floors beat streaks.

## App

The same Oracle lives in the web app (`npm run dev`). Use it when the user wants to click through thinking, promote/demote quests, and download markdown themselves.
