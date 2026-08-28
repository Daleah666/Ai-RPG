# Lore shelves — Vesper owns the map

**Do not rearrange files Leader Vesper already organized.** Bots follow her layout; they do not redesign it.

## Hard rules

1. **Never move / rename / reorder** files already placed in Vesper’s shelves
2. Categorizer may only **suggest** labels for *new* lore
3. New files write **only** where Vesper sets `lore.drop_path` / `drop_folder_id`
4. If placement missing → wait — do not guess into an existing tree

## How Vesper places NEW lore

```yaml
lore:
  shelf_name: "Velvet Marches"
  drop_path: "G:\\My Drive\\Nova Ai Data\\Velvet_Marches_Lore_for_Nova"
  # or drop_folder_id: "1l0YU2Sr0zTFIVghrVYMILn0LDSul_lPY"
  place_mode: beside          # beside | inside | new_subfolder
  new_subfolder_name: ""      # only if she wants a new subfolder under that shelf
  filename_hint: "Marches_River_Pact"
  relates_to: [vesper_canon, nyx_notes]
```

## Known shelves (record only — do not restructure)

| shelf_name | drop_folder_id | notes |
|------------|----------------|-------|
| Velvet Marches | `1l0YU2Sr0zTFIVghrVYMILn0LDSul_lPY` | leave her files as placed |
| Character Cards | `1H3_yLab4jGirN94f46ddfKq1giU1G1_5` | NEW finalized sheets only |
| Nyx Notes | _(Vesper sets)_ | leave as placed |
| _(add more)_ | | Vesper names; Nova records |

## Suggest labels (for new drafts)

Optional tags: `world` · `deities` · `regions` · `races` · `factions` · `magic` · `characters` · `items` · `events` · `nyx_notes` · `inbox_unsorted`

These are **hints for naming new files**, not orders to reshuffle old ones.
