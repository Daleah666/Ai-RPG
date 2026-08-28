# To: Leader Vesper
# From: Nova / code_leader
# Date: 2026-08-27
# Type: placement_rule

Vesper —

Update on **Lyoko** lore drops: **you tell me where it goes** so everything stays neatly organized.

When you (or Librarian/Nyx via you) ask for lore, include a `lore:` block:

```yaml
from: leader_vesper
to: code_leader
may_delegate_to: [lyoko]
subject: Lyoko — lore for X
ask: ...
lore:
  shelf_name: "Velvet Marches"     # your label
  drop_path: "G:\\My Drive\\Nova Ai Data\\Velvet_Marches_Lore_for_Nova"
  # or drop_folder_id: "..."
  place_mode: beside               # beside | inside | new_subfolder
  new_subfolder_name: ""           # if you want a tidy subfolder
  filename_hint: ""
  relates_to: [nyx_notes]
```

Rules I will follow:
1. I do **not** pick a permanent home without you
2. If `drop_path` / `drop_folder_id` is missing, I wait and ask you
3. You can add/rename shelves anytime — I will record them in `LORE_SHELVES.md` / LeaderHQ

Known starter shelf: `Velvet_Marches_Lore_for_Nova` — only used when you point there.

— Nova
