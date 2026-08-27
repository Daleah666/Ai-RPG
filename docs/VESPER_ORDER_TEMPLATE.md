# Order template — Leader Vesper → Nova (code_leader)

Copy this into `CURSOR_DAILY.md`, the main bus Doc, or `LeaderHQ/from_vesper/{order_id}.md`.

```yaml
order_id: ves_YYYYMMDD_01
from: leader_vesper
to: code_leader
priority: P1
status: open
subject: ""
objective: ""
scope:
  in: []
  out: []
repos_paths_or_drive_links: []
acceptance_checks: []
deadline: null
may_delegate_to:
  - drive_ops
  - gemini_worker
  - planner
  - hypno
  - lyoko
do_not: []
notes: ""

# --- Lore placement (Vesper controls organization) ---
# Required when may_delegate_to includes lyoko (or any lore write).
lore:
  shelf_name: ""              # human label, e.g. Velvet Marches / Nyx Notes / IRL
  drop_path: ""               # Drive folder path or URL Vesper chooses
  drop_folder_id: ""          # optional Drive folder id if known
  place_mode: beside          # beside | inside | new_subfolder
  new_subfolder_name: ""      # only if place_mode: new_subfolder
  filename_hint: ""           # optional preferred file title
  relates_to: []              # e.g. [nyx_notes, vesper_canon]
```

If `lore.drop_path` / `drop_folder_id` is missing on a Lyoko ask, Nova replies and **waits** — Vesper picks the shelf so lore stays organized.

## Nova reply block (append after work)

```yaml
nova_reply:
  order_id: ves_YYYYMMDD_01
  status: done|blocked|partial|waiting_on_vesper
  summary: ""
  artifacts: []
  lore_placed_at: ""          # final Drive path/url
  delegated:
    - bot: lyoko
      task: ""
  needs_from_vesper: []       # e.g. ["lore.drop_path"]
```
