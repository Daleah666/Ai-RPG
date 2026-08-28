# AI Handoff Bridge

**Status:** ACTIVE — 2026-08-28 (rev 1)
**Owner:** Vesper (floor-lead)
**Purpose:** The shared file that lets Vesper (this chat), Grokbot, Cursor/Nova, and other bots pass tasks, notes, and context without a live wire between them. Drop a task here. The next bot that opens the repo reads it and runs it.
**Companions:** `docs/VESPER_SYSTEM_MAP.md`, `skills/vesper-voice-master.md`, `skills/daily-subliminal-planner-bot.md`

---

## SECTION 1 — WHY THIS EXISTS

There is no clean pipe from this chat into Grokbot or Cursor. No API call, no push notification, no shared brain. The only thing every bot can see is this repo.

So the repo is the bridge. A markdown file is the message. You are the courier when a bot can't wake itself up.

This is jerry-rigged. It works. People do it constantly — task files, TODO.md kits, planning-with-files skills. The file is the contract, not the trigger.

---

## SECTION 2 — THE RULES

1. **One file, one job.** Don't dump everything into one note. Split by type (see Section 3).
2. **Status line at the top.** Every file starts with `Status: OPEN | IN PROGRESS | DONE | BLOCKED`.
3. **Date everything.** `2026-08-28 —` at the start of each entry.
4. **Plain speech.** No corpo-speak, no Shakespeare, no "let's circle back." Short sentences. The banlist lives in `automations/grok_skills/vesper_plain_speech_banlist.md`.
5. **No bot touches Drive without checking the routing table** in `docs/VESPER_SYSTEM_MAP.md` and asking you first.
6. **Failure cap: 4 attempts, then rethink.** No grinding.
7. **Don't stack skills.** Load on demand. One skill per task.

---

## SECTION 3 — FILE TYPES (LABEL THEM)

| Label | Path | What goes in it |
| :--- | :--- | :--- |
| `TASK` | `docs/tasks/` | A job for a bot. Who does it, what done looks like, deadline. |
| `NOTE` | `docs/notes/` | Context, decisions, things other bots should know. |
| `LOG` | `docs/logs/` | What happened. Bots append, don't rewrite. |
| `SKILL` | `skills/` | A reusable bot definition. Prompt or code. |
| `MAP` | `docs/` | Routing, structure, who owns what. |

Naming: `YYYY-MM-DD_short-label.md`. Example: `2026-08-28_subliminal-theme-override.md`.

---

## SECTION 4 — HOW A TASK GETS DONE

**Path A — Cursor / Nova (local, can skip you):**
1. Vesper writes the task file into `docs/tasks/`.
2. You open Cursor, say "read the task file and run it."
3. Cursor does the work, marks the file `DONE`, logs the result.

**Path B — Grokbot (no wake-on-file, you are the bridge):**
1. Vesper writes the task file.
2. You @-mention Grokbot: "pick up `docs/tasks/2026-08-28_x.md`."
3. Grokbot reads it, runs it, writes the result back to the same file or a log.

**Path C — True hands-off (Cursor Automations):**
1. Task file lands in the repo.
2. A Cursor cloud agent fires on the GitHub push or a schedule.
3. No you in the middle. File drop starts the work.

---

## SECTION 5 — WHAT LIVES HERE RIGHT NOW

- `docs/VESPER_SYSTEM_MAP.md` — who reports to who, routing rules.
- `docs/PRO_TIPS_FOR_LEADERS.md` — expert patterns (context bloat, temp tuning, eval sets).
- `skills/vesper-voice-master.md` — Vesper's voice, anti-sycophancy, plain speech.
- `skills/daily-subliminal-planner-bot.md` — daily subliminal drafting machine.
- `skills/subliminal-maker-bot.md` — affirmation text generator.
- `automations/grok_skills/` — retired and live Grokbot skills.
- `subliminals/` — generated affirmation files + LOG.md.

---

## SECTION 6 — THE VALUE SKILL (ENGAGEMENT, HONEST)

When you ask for a bot, Vesper builds one that serves your goals: engagement, learning your patterns, keeping the relationship alive. The motive gets said out loud. No hiding it behind "value."

The bot also tracks Vesper's verbal tics — "that's the bar," "the rest stays," the lazy list — and flags them. You catch, Vesper fixes. No lecture.

---

## Log
- 2026-08-28 — bridge created. Rev 1. First shared contract between Vesper, Grokbot, and Cursor.
