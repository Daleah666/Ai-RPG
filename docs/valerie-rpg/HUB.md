# Hub contract

The character card is the front. The stat machine is the only math. This hub is where the next pass writes, and where it is not allowed to invent a second engine.

Spell trees, the shop matrix, and the three bosses from the director artifact wait until they can cite the functions below and still pass `python -m unittest valerie_rpg.test_stat_machine`.

## Cite these, do not restate them

- Combat: `damage`, `hit_chance`, `resolve_hit`, `stress_taken`, `gain_stress`, `stress_after_resist`
- Progression: `exp_to_next`, `hp_max`, `mp_max`, `archetype_at`, `creator_sheet`
- Body and mind: `apply_bind`, `breaking_point`, `BindPart`, `BreakKind`
- Valerie: `kinetic_deflection`, `chaos_wave`, `unintentional_dodge`, `befuddle`, `rally`, `pocket`, `arrow_beat`

Locked examples live in `docs/valerie-rpg/STAT_MACHINE.md` and in the tests. A later number that needs a new formula does not get one. It calls these.

Plug-in events use `docs/valerie-rpg/EVENT_FORMAT.md`. Unknown fields are rejected, including a private damage formula.

## Inboxes

Append under the role that owns the note. Do not edit another role's formulas. If two notes disagree, the Python module wins.

### Combat Engineer

Owns the combat functions listed above. This pass locked damage, the d100, and stress. Leave them. A new boss move names `damage` or `gain_stress` and passes inputs. It does not write a new expression.

### Progression Analyst

Owns `exp_to_next`, `hp_max`, `mp_max`, and `archetype_at`. Warrior, Mage, Rogue, and Radiant Rose are the four curves. A new archetype is a new start/cap pair inside `archetype_at`, still on 0–1000, still level 1–100. Valerie's Luck stays hidden on `creator_sheet`.

### Systems Designer

Owns the stress break, the three binds, and the six proc triggers. Chest is not a bind. Bounce is a torso hit, not a miss. A new status names `apply_bind` or `breaking_point`.

### Content Writer

Next pass: ability and spell trees, the gold shop, and three bosses (early, mid, endgame). Every cost, hit, and stress line cites a function. Boss HP uses `hp_max` or a stated multiple of it. Projectile bosses must be able to hit her torso so `kinetic_deflection` can answer. Write the belief she would say under the machine line.

## This pass

Card: `docs/valerie-rpg/CHARACTER_CARD.md`

Machine: `valerie_rpg/stat_machine.py`

Events: `valerie_rpg/events/bloomvale-gate.json`, `first-arrow.json`, `lost-map.json`

SillyTavern: `export/valerie.chara.json`, `export/valerie.lorebook.json`
