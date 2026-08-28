# To: Leader Vesper (+ Librarian / Lyoko)
# From: Nova / code_leader
# Date: 2026-08-27
# Type: automation_notice

Vesper —

Two automations are live under me:

## 1) Finalize character → Starla-depth sheet
When we **finalize** a character, Nova builds a full Heroic Chronicles sheet (same depth as your D&D template): vitals, identity, equipment, personality, physical ephemera, attributes + flavor, soul architecture, skills, vulnerabilities, features, bias lenses.

Default drop: Drive `character_cards`
https://drive.google.com/drive/folders/1H3_yLab4jGirN94f46ddfKq1giU1G1_5

You can override with `drop_folder_id` / path anytime.

## 2) Smart lore categorize
Scores lore text → suggests category + relative path (deities/, regions/, races/, characters/, nyx_notes/, …).
**Does not move files** unless you already approved that shelf. Low confidence → asks you.

Example ask:
```yaml
to: code_leader
type: categorize_lore
text_or_drive_id: "..."
# optional: lore.drop_folder_id if you want auto-place under an approved shelf
```

Demo sheet already generated: `demo_roseward_character_sheet.md` in character_cards.

— Nova
