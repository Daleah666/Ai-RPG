# NOVA Order — Vesper Group Handoff Packet
**Status:** ACTIVE / LOGGED  
**Owner chain:** NOVA → research brief → Vesper group  
**Scope:** Personal Self Signal practice system (on-device only)  
**Classification:** Internal handoff — keep tight, available, logged

---

## 1. Mandate (NOVA)

1. Keep Self Signal guidance **tight** (no sprawling theory dumps).
2. Keep it **available** in-repo for Vesper group pickup.
3. Keep it **logged** with dated entries when material changes.
4. Preserve boundary: **personal / self-use only**; data stays on-device.

---

## 2. Tight brief (give this to Vesper)

### What it is
Local web tool (`index.html` + `app.js` + `styles.css`) for personal affirmation practice and daily self-monitoring.

### What it stores
Browser `localStorage` key: `self-signal-v1`  
Contents: north-star aim, affirmations, practice sessions, daily check-ins.  
No cloud sync. Export / import / wipe supported in UI.

### How to run
```bash
python3 -m http.server 8080
```
Open `http://localhost:8080`

### Operating protocol
1. One north-star aim (one sentence).
2. Affirmations = first person, present tense, **specific behavior**.
3. Practice 3–8 minutes daily (attention > volume; voice optional).
4. One daily check-in: Clarity / Energy / Follow-through (1–5) + note.
5. Weekly rewrite: keep lines that raise follow-through; drop fluff.

### Evidence stance (required talking point)
Hidden “subliminal” embeds have weak evidence for complex behavior change.  
Reliable path: conscious repetition + honest tracking. Do not overclaim.

### Do / Don’t
| Do | Don’t |
|---|---|
| Personal self-use | Covert influence on others |
| Behavior-specific lines | Vague slogans |
| Honest daily scores | Fake perfect logs |
| Export backups | Assume cloud persistence |

---

## 3. Artifact map

| Item | Location |
|---|---|
| App | `/index.html`, `/app.js`, `/styles.css` |
| User README | `/README.md` |
| Vesper perma prompt + skills | `/docs/nova-orders/to_vesper.md` |
| Protocol skills (22) | `/docs/nova-orders/skills/` |
| This handoff (Self Signal) | `/docs/nova-orders/VESPER-HANDOFF.md` |
| Change log | `/docs/nova-orders/LOG.md` |
| PR | https://github.com/Daleah666/Ai-RPG/pull/5 |

---

## 4. Success metrics Vesper can read

From Insights (local only):
- Practice streak (days)
- Avg follow-through (7d)
- Sessions logged
- Affirmation count

Interpretation rule: follow-through trend matters more than affirmation count.
