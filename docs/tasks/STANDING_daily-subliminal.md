# STANDING TASK — daily subliminal floor

## Status
`OPEN`

This task stays open. It is the recurring wake-up, not a one-day job.

## Title
File one subliminal text for the Pacific day and leave it for the player

## Goal
`subliminals/YYYY-MM-DD_Prefix.txt` exists, `subliminals/validate_lines.py` says ok, `subliminals/LOG.md` has one new line, and the same text is in Drive folder `1Qfcbugb6olO5bu59_kclXGggSZZ3uuTq`.

## Context
- Follow `skills/subliminal-floor-manager.md`.
- Maker rules: `skills/subliminal-maker-bot.md`.
- Clock: America/Los_Angeles, daily at 09:00 once a Cursor Automation is switched on.
- If that day's file already exists, stop.

## Steps
1. Read the floor manager skill.
2. Pick the theme with `subliminals/rotation.py`.
3. Write 12–18 affirmation lines. Headers start with `#`.
4. Run `python3 subliminals/validate_lines.py` on the file.
5. Append one line to `subliminals/LOG.md`.
6. Upload the text to the MindZoom Drive folder named in the manager skill.
7. Leave this task `OPEN`.

## Notes for the next bot
- Do not commit the old MindZoom library dump.
- Do not press Play on the user's machine.
- The desktop player picks up a new file on its own when "New files" is checked.

## Who picked it up
2026-10-12 — floor manager filed Monday ahead of the 09:00 Pacific run.
