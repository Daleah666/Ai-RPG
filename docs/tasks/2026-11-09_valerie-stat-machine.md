# Valerie card, then the stat machine

## Status
`DONE`

## Title
Character card for Valerie Sunpetal, with one stat machine under it

## Goal
The card introduces her before any math. One Python module resolves damage, hits, stress, growth, binds, and her six powers. Plug-in events and a SillyTavern import call that module.

## Context
- Owner: Del
- Character lock: Valerie Sunpetal, the Radiant Rose, adult, 23
- Scale: level 1–100, attributes 0–1000, Stress 0–200, HP into the millions at level 100
- Spell trees, the shop, and the three bosses are the next pass. They are not in this task.

## What landed
- `docs/valerie-rpg/CHARACTER_CARD.md` opens on description, drives, who she is, body, powers, and the isekai rule.
- `valerie_rpg/stat_machine.py` is the only math. `docs/valerie-rpg/STAT_MACHINE.md` records the same numbers.
- Tests: `python -m unittest valerie_rpg.test_stat_machine`
- `export/valerie.chara.json` and `export/valerie.lorebook.json` for SillyTavern.
- `docs/valerie-rpg/EVENT_FORMAT.md` plus `valerie_rpg/events/bloomvale-gate.json`, `first-arrow.json`, and `lost-map.json`.
- `docs/valerie-rpg/HUB.md` is the contract for the next pass.
- Portable creator notes: `skills/valerie-stat-machine.md`

## Notes for the next bot
- Read the character card first.
- Cite stat-machine functions. Do not restate the formulas.
- She never sees Luck, Stress, accuracy, or proc names.
- Vesper, VV1, and Vessi stay retired. Do not load them for this work.

## Who picked it up
Cursor agent on `cursor/valerie-stat-machine-8b37`
