# Plug-in events

A foreign event is one JSON object. SillyTavern can show `card_text`. The Python host resolves it with `resolve_event`. Both hosts call `valerie_rpg.stat_machine`. An event that invents its own hit, damage, or stress math is invalid.

`validate_event` allows six fields and nothing else:

- `id`: non-empty string
- `when`: non-empty string, the hook name (`on_scene_enter`, `on_projectile_hit_torso`, `on_item_needed`, or a new hook that still uses the machine)
- `card_text`: the line the card shows before the roll
- `checks`: a non-empty list
- `on_success`: a string, or `{ "text": "...", "proc": "<known proc>" }`
- `on_fail`: same shape as `on_success`

A check is either `{ "stat": "<known stat>", "dc": <int> }` or `{ "proc": "<known proc>" }`. A pocket check may also carry `"item"`. Unknown fields, unknown stats, and unknown procs raise `EventError`. A key like `damage_formula` is rejected.

A stat check is `resolve_hit(stat, dc, roll)` from `EventContext.roll`. The DC is the opposing number inside the hit formula. It is not a new roll.

A proc check calls that proc. The event succeeds only when every check succeeds. The branch proc, if any, runs after that and does not flip the success flag.

## Host context

`EventContext` carries the world. The event does not.

- `stats`: a `StatBlock`, usually `archetype_at("Radiant Rose", level)`
- `roll`: the d100 for stat checks
- `power`, `attack`, `defense`, `variance`: the hit that `kinetic_deflection` reflects
- `item`, `item_lost`, `item_needed`: pocket state. A check may name the item.
- `body_check_failed`: feeds `unintentional_dodge`
- `fear_read`, `lethal_threat`: feed `rally`
- `wave_accuracy`, `wave_evasion`, `wave_roll`, `device_present`: feed `chaos_wave`
- `enemy_accuracy`, `befuddle_penalty`: feed `befuddle`

## Starter pack

These three files live in `valerie_rpg/events/`. `load_starter_events()` reads them.

### bloomvale-gate

`when`: `on_scene_enter`. Check: Dexterity against DC 120, through `resolve_hit`. Her level-1 Dexterity is 36, so the chance is 46. On a fail she face-plants and the branch calls `chaos_wave`.

### first-arrow

`when`: `on_projectile_hit_torso`. The only check is `kinetic_deflection`. She takes 0. The reflected roll uses the context's power, attack, defense, and variance. The worked beat in `STAT_MACHINE.md` (power 80, attack 400, defense 200) reflects 53.

### lost-map

`when`: `on_item_needed`. The check is `pocket` with item `map`. It returns the map only when the host flags the map lost and needed. She believes she is good at finding things. If it was not lost, the fail branch finds lint and nothing returns.

## Resolve

```python
from valerie_rpg.stat_machine import EventContext, archetype_at, load_starter_events, resolve_event

event = next(item for item in load_starter_events() if item["id"] == "first-arrow")
outcome = resolve_event(
    event,
    EventContext(
        stats=archetype_at("Radiant Rose", 1),
        power=80,
        attack=400,
        defense=200,
        variance=1.0,
    ),
)
```

`outcome.card_text` is the intro line. `outcome.branch_text` is what happened. `outcome.procs` are the machine results. Show her `belief`. Keep `machine_line()` for the creator.
