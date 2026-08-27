# Automations — Nova / code_leader

## 1) Finalize character → Heroic Chronicles sheet

When a character is **finalized**, produce a sheet at **Starla-depth** (same sections as the Drive template `Dungeons & Dragons 5E Character Sheet Template.docx`).

### Sections generated

Combat vitals · Identity & portrait · Proficiencies · Inventory · Personality · Physical ephemera · Core attributes + flavor · Soul’s architecture · Skills & senses · Skills narrative · Vulnerabilities & curses · Features & traits · Bias / narrative lenses

### Local usage

```bash
# 1. Copy blank and fill JSON
cp automations/character_sheet/blank_sheet.json /tmp/my_char.json

# 2. Finalize → writes .md + .json package
python3 -m leader_hq.cli finalize-character --src /tmp/my_char.json --out /tmp/sheets

# 3. Upload markdown into Drive character_cards (default)
#    folder: https://drive.google.com/drive/folders/1H3_yLab4jGirN94f46ddfKq1giU1G1_5
```

### Bus / Vesper trigger

```yaml
from: leader_vesper   # or human via Nova chat
to: code_leader
type: finalize_character
subject: Finalize <Name>
payload:
  character_json_path_or_drive_id: ""
  drop_folder_id: "1H3_yLab4jGirN94f46ddfKq1giU1G1_5"   # override if Vesper wants elsewhere
```

Nova fills gaps with Lyoko/Gemini if needed, runs finalize, drops sheet to `character_cards` (or Vesper path).

Template source: https://drive.google.com/file/d/1x-Rw_Q1pfVZgg1Bez29O2dNWM5Uh0Deh/view

---

## 2) Lore categorize (smart sort)

Does **not** move files without Vesper’s shelf rules. It **scores** text against taxonomy and suggests:

- category (deities, regions, races, factions, magic, characters, items, events, nyx_notes, …)
- `suggested_relative_path` like `deities/01_vaelith_bloom.md`
- confidence + whether Vesper must confirm

Taxonomy mirrors Velvet Marches pack read-order (world spine → deities → regions → races → …).

```bash
python3 -m leader_hq.cli categorize-lore --src path/to/lore.md
python3 -m leader_hq.cli categorize-lore --text "Vaelith fertility pilgrimage Elfheim"
```

### Suggested workflow

1. Lyoko drafts lore (or pack lands in inbox)
2. categorizer proposes shelf/subfolder
3. If `needs_vesper_confirm` → ask Vesper (`lore.drop_folder_id` / path)
4. If high confidence **and** shelf already approved in `LORE_SHELVES.md` → Nova may place under that shelf’s subfolder

Default shelf hint: `Velvet_Marches_Lore_for_Nova` (`1l0YU2Sr0zTFIVghrVYMILn0LDSul_lPY`)
