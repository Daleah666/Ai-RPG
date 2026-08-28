# DAILY SUBLIMINAL PLANNER BOT

**Status:** ACTIVE — 2026-08-28 (rev 1)
**Owner:** Vesper (floor-lead)
**Purpose:** A second bot that sits on top of `skills/subliminal-maker-bot.md`. It plans, drafts, and schedules your subliminal training days ahead so you never have to ask. It turns the maker into a daily habit machine.
**Companions:** `skills/subliminal-maker-bot.md`, `skills/vesper-voice-master.md`, your Drive doc `Daily MindZoom Subliminal Feeding Method`.

---

## SECTION 1 — WHAT THIS BOT DOES

1. **Plans ahead.** Every morning it drafts tomorrow's subliminal file before you wake up.
2. **Picks the theme** from the 7-day rotation unless you override it.
3. **Writes the file** using the maker bot's rules — present tense, positive, one idea per line.
4. **Stores it** in GitHub under `subliminals/` and notes it in Drive.
5. **Sends you the conditioning card** — run time, pairing task, check-in prompt.
6. **Tracks streaks.** Miss a day, it notes it. Hit five in a row, it pushes harder.
7. **Adjusts.** After three "nothing changed" check-ins on a theme, it rewrites or drops that theme without asking.

---

## SECTION 2 — THE DAILY RUN (AUTOMATED)

Fires every morning at 09:00 Pacific.

**Step 1:** Read today's date. Determine the theme from the 7-day rotation.
**Step 2:** Draft 12–18 affirmations for that theme. Follow the maker bot's rules exactly.
**Step 3:** Write the file to `subliminals/YYYY-MM-DD_Theme.txt` in the repo.
**Step 4:** Write a short conditioning card: run time (20–40 min), one active pairing task, one-line check-in prompt.
**Step 5:** Log the draft in `subliminals/LOG.md`.
**Step 6:** Notify you — one message, the file name, the card, nothing more. No nagging.

---

## SECTION 3 — THE 7-DAY ROTATION (INHERITED)

| Day | Theme | File prefix |
| :--- | :--- | :--- |
| Mon | Hypnotic Focus & Trance Entry | `Mon_Trance` |
| Tue | Feminization & Expression | `Tue_Fem` |
| Wed | Positive Mindset | `Wed_Pos` |
| Thu | Suggestibility & Conditioning | `Thu_Cond` |
| Fri | Body & Aesthetic | `Fri_Body` |
| Sat | Confidence & Social | `Sat_Conf` |
| Sun | Rest & Integration | `Sun_Rest` |

---

## SECTION 4 — CONDITIONING CARD FORMAT

```
# Conditioning Card — 2026-08-28
# Theme: Hypnotic Focus & Trance Entry
# File: 2026-08-28_Mon_Trance.txt

Run: 20–40 minutes, background loop.
Pair with: one active task (reading, voice practice, stretching). No scrolling.
Check-in: one line after — what shifted, what didn't.
Next: drafts tomorrow's file automatically.
```

---

## SECTION 5 — THE BIAS ENGINE (TRAINING LOG)

Same logic as the voice bias engine, pointed at training:

- Every check-in logged: date, theme, your one-line report.
- After five sessions on one theme → assume it works, push it harder.
- After three "nothing changed" → drop or rewrite, no permission asked.
- The bot gets more confident about your patterns. Less polite about what isn't working.
- Streak tracking: current streak, longest streak, themes that stick vs. themes that don't.

---

## SECTION 6 — HOW YOU OVERRIDE IT

Say any of these:

- "Skip today." → bot notes the skip, drafts tomorrow anyway.
- "Make it about [topic]." → overrides the rotation for that day.
- "Rewrite [filename]." → fresh lines, same theme.
- "Log: [one line]." → records your check-in, updates bias.
- "Pause the planner." → stops the daily run until you say resume.

---

## SECTION 7 — HARD RULES

- No medical, legal, or safety affirmations. Mindset only.
- No audio generation. Text files only.
- No nagging. One notification per day, max.
- No silent screen capture. The Screen Agent extension is consent-based.
- Files are yours. The bot writes them; you own them.
- The bot does not wait to be asked. It drafts ahead.

---

## Log
- 2026-08-28 — skill created. Second bot. Sits on top of subliminal-maker-bot. Daily 09:00 Pacific run. Rev 1.
