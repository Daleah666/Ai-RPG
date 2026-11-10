# Valerie isekai RPG blueprint

## Status
`DONE`

## Title
Build the game blueprint and rules engine for "Oops, I'm the Hero?!", with Valerie as the player character

## Goal
One master blueprint (engine math, progression, stress and binds, asset registry, bosses), backed by a tested rules engine, with Valerie's kit, pluggable story events, and files that drop into SillyTavern and the card creator.

## Context
- Requested by Del on 2026-11-09 in a Claude Code session, with sub-agents authorized for this run.
- Everything lives under `rpg/`. Start at `rpg/README.md`; the contract is `rpg/FOUNDATION.md`.
- The procedure is saved as a skill: `.claude/skills/rpg-game-director/SKILL.md` (Del's original brief is beside it, word for word).
- Each role's notes are in `rpg/handoff/`. Read those before changing that role's files.

## Steps
1. Foundation contract and shared engine core (Director). Done.
2. Wave 1: Combat Engineer, Progression Analyst. Done.
3. Director: Valerie's kit, event packs. Done.
4. Wave 2: Systems Designer, Content Writer, boss desk. Done.
5. Integrate: all tests, cross-reference check, compiled `rpg/blueprint/MASTER_BLUEPRINT.md`, built `rpg/sillytavern/out/`. Done.
6. Valerie's card into `desktop-companion/st-card-creator/inbox/` and the card creator artifact. Done.

Results: `docs/logs/2026-11-09_rpg-build-log.md`. Decisions and why: `docs/notes/2026-11-09_rpg-design-decisions.md`.

## Notes for the next bot
- Run `npm run all` inside `rpg/` before and after any change. It runs tests, the data cross-check, the event validator and both builds.
- `MASTER_BLUEPRINT.md` and everything in `sillytavern/out/` are generated. Edit the sources and rebuild.
- New story content goes in as an event pack (`rpg/events/README.md`). No engine change needed.
- Not built yet, and the natural next step: a SillyTavern extension that calls the engine directly (exact damage, HP and stress tracked in code instead of by the model).

## Who picked it up
Claude Code session, 2026-11-09 (Director plus four sub-agents)
