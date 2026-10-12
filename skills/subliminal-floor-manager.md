# SUBLIMINAL FLOOR MANAGER

**Status:** ACTIVE — 2026-10-12 (rev 1)
**Owner:** floor manager for the subliminal line
**Purpose:** Wake the maker, file one text for the Pacific day, and leave it where the background player already reads. The player stays on the user's machine. This manager does not flash the screen.

Companions: `skills/subliminal-maker-bot.md`, `skills/daily-subliminal-planner-bot.md`, `subliminals/play_background.py`.

---

## The line

Four jobs. One run does all four. Do not invent a fifth.

1. **Clock.** America/Los_Angeles. The file name uses that calendar day.
2. **Maker.** Write 12–18 lines for the rotation theme. Rules live in the maker skill.
3. **Filer.** Save `subliminals/YYYY-MM-DD_Prefix.txt`, append `subliminals/LOG.md`, and upload the same text into the MindZoom Drive folder `1Qfcbugb6olO5bu59_kclXGggSZZ3uuTq` (inside silentideas-packs). The user asked for playback files to land there.
4. **Player.** Do not press Play. The desktop player reloads its folder about every 20 seconds while "New files" is on. A new text joins the loop that is already running.

If today's file already exists, stop. Log `already filed`. Do not rewrite it.

---

## Clock and theme

Weekday in Pacific time. Theme table is in the maker skill.

| Day | Prefix |
| :--- | :--- |
| Mon | `Mon_Trance` |
| Tue | `Tue_Fem` |
| Wed | `Wed_Pos` |
| Thu | `Thu_Cond` |
| Fri | `Fri_Body` |
| Sat | `Sat_Conf` |
| Sun | `Sun_Rest` |

A run before 09:00 Pacific may file the coming morning instead, so the text is waiting. A run at or after 09:00 files that same Pacific day. One file per run.

`subliminals/rotation.py` is the weekday lookup. `subliminals/validate_lines.py` must pass before the file is committed or uploaded.

---

## Wake-up

This is the standing order. A Cursor Automation on a daily schedule is the switch that wakes a cloud agent. Prompt:

```
Follow skills/subliminal-floor-manager.md.
Use America/Los_Angeles.
If that Pacific day's subliminal file is missing, write it, validate it, commit it, and upload the same text to Drive folder 1Qfcbugb6olO5bu59_kclXGggSZZ3uuTq.
If the file exists, stop.
No medical, legal, or safety lines. No audio. One short note in subliminals/LOG.md.
```

Schedule: every day at 09:00 America/Los_Angeles. Repo: `Daleah666/Ai-RPG`.

Until that switch is on, a person opens Cursor and says "run the subliminal floor." The standing task is `docs/tasks/STANDING_daily-subliminal.md`. Leave that task `OPEN`. It is recurring.

---

## What the user does once

1. Sync the MindZoom Drive folder, or download new texts into the folder the player is using.
2. Open `subliminals/play_background.py`, choose that folder, press Play once.
3. Leave "New files" checked. Later mornings show up in the same loop.

The browser page cannot watch a folder unless you press **Watch folder** (Chrome or Edge). The desktop player can.

---

## Hard rules

- Maker rules still win: present tense, positive lines, no "not / don't / stop / never", no medical or safety claims, text only.
- Skip any line or filename that matches the player safety list (high school, childhood, underage, and similar words).
- Do not commit the old MindZoom library dump into this public repo. Daily rotation files only.
- One log line per filing. No nagging message beyond that.
- Failure cap: 4 attempts, then stop and write what blocked you.

## Log

- 2026-10-12 — floor opened. Player watches a folder. Daily file also goes to the MindZoom Drive folder the user chose for playback.
