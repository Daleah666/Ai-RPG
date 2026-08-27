# Ai-RPG · Campaign Oracle

A goal-planning app and Cursor skill. Dump the messy pile. The Oracle thinks (capacity, tensions, what to cut). Then it writes the plans out.

## Run the app

```bash
npm install
npm run dev
```

Open the local URL. Paste a brain dump, or click **Load a sample campaign**. Walk through thinking → quest council → written Codex. Copy or download markdown.

## Let an agent write the plans

In Cursor, ask to plan your goals (the `goal-planner` skill). Or run the same engine from the terminal:

```bash
npm run plan -- --dump "I want to ship Ai-RPG this quarter. I have 8 hours a week." --hours 8 --energy low --horizon quarter
```

Plans land in `campaign/plans/`.

## What it is

| Piece | Role |
| --- | --- |
| Web app | Think out loud, pick main/side/later quests, export a Codex |
| Engine | Parse dump → signals, overload, tensions, quest board, written plans |
| Skill | `.cursor/skills/goal-planner` — agents follow the same counsel and write files |

Life is treated as a campaign: few main quests, small side quests, later quests written down so they stop haunting the week.
