# Automations — Nova / code_leader

## Hard rule — Vesper's layout is sacred

Leader Vesper already organized Drive. Bots are adapted to **her** folders.

Nova / automations / bots must **never**:
- move, rename, reorder, or reshuffle files she already placed
- "clean up" or re-sort existing lore trees
- invent a new permanent home for old files

Categorizer = **suggest only**. New files land **only** where Vesper points (or wait).

---

## 1) Finalize character → Heroic Chronicles sheet

When a character is **finalized**, produce a sheet at **Starla-depth** (same sections as your Drive D&D template).

### Sections generated

Combat vitals · Identity & portrait · Proficiencies · Inventory · Personality · Physical ephemera · Core attributes + flavor · Soul’s architecture · Skills & senses · Skills narrative · Vulnerabilities & curses · Features & traits · Bias / narrative lenses

### Local usage

```bash
cp automations/character_sheet/blank_sheet.json /tmp/my_char.json
python3 -m leader_hq.cli finalize-character --src /tmp/my_char.json --out /tmp/sheets
# Upload into character_cards (or path Vesper names)
# https://drive.google.com/drive/folders/1H3_yLab4jGirN94f46ddfKq1giU1G1_5
```

### Bus / Vesper trigger

```yaml
from: leader_vesper
to: code_leader
type: finalize_character
subject: Finalize <Name>
payload:
  character_json_path_or_drive_id: ""
  drop_folder_id: "1H3_yLab4jGirN94f46ddfKq1giU1G1_5"   # only for NEW sheet drops
```

Template: https://drive.google.com/file/d/1x-Rw_Q1pfVZgg1Bez29O2dNWM5Uh0Deh/view

### Elf auto-hook

If the sheet mentions elves, finalize **stamps** a Lyoko **bias tilt** into narrative lenses (framing only — does not rewrite lore facts). Override with `narrative_hook: off` / `tilt: neutral` in `source_notes`. See `docs/LYOKO_NARRATIVE_HOOK.md`.

---

## 2) Lore categorize (suggest only)

Scores text → suggests category + relative path. **Never moves existing files.**

```bash
python3 -m leader_hq.cli categorize-lore --src path/to/lore.md
python3 -m leader_hq.cli categorize-lore --text "Vaelith fertility pilgrimage Elfheim"
```

### Workflow for NEW lore only

1. Lyoko drafts (or new pack arrives)
2. Categorizer proposes a path label
3. Nova asks Vesper where it goes (or uses her explicit `lore.drop_*`)
4. Write the **new** file there — leave everything already organized untouched

Existing Velvet Marches / Nyx / other Vesper trees stay as-is.

---

## 3) Morning shared-Grok poll → Leader Vesper

Once each morning, Nova posts a short **shared poll** so Vesper (Grok) can steer the day without a long chat.

### Prompt / shape

`automations/prompts/morning_vesper_poll.md`

### Local usage

```bash
python3 -m leader_hq.cli morning-poll
# → .local_bus/LeaderHQ/to_vesper/YYYYMMDD_nova_morning_poll.md

python3 -m leader_hq.cli morning-poll --print-only
```

### Where it lands on Drive

1. Primary: `LeaderHQ/to_vesper/YYYYMMDD_nova_morning_poll.md`
   - folder id `1eBAIPHizzJk_5iHmLubZanAjoLb5Nc7X`
2. Optional sibling under `Nova Ai Data/` (`1UUL5HuzxICq22qXwovlFWfdE5e3Zfs9c`)

Vesper replies under **Vesper answers** (or on the main bus Doc). Nova does not invent her answers. Never reshuffle her shelves.
