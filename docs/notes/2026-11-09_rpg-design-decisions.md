# RPG design decisions, 2026-11-09

Decisions made while building `rpg/`, with the reason for each. The contract is `rpg/FOUNDATION.md`; this note is the why.

## Structure

- **Foundation before agents.** The Director wrote the scales, attribute list, dice rule, anchors and file ownership before any role started. Four roles working from the brief alone would each have invented their own stat names and HP scale.
- **Two waves.** Combat and progression first; stress, content and bosses second, reading the first wave's handoff notes. Skill costs are priced against the MP curve the Progression Analyst actually produced.
- **The Content Writer role was split across two desks** (skills and items; bosses and encounters) so they could run in parallel. Same role, same brief.
- **Anchors are tests.** Each claim in the foundation ("a mirror duel takes 6 to 14 landed hits") is a test in `rpg/test/`.

## Rules

- **Six attributes, no separate DEF or RES.** STR is answered by CON, INT by WIL. Fewer numbers for a person or a language model to track at the table.
- **Defense counts at half weight.** Changed by the Combat Engineer from the baseline `A² / (A + D)` to `1.5 × A² / (2A + D)`. CON buys both HP and defense, so at full weight a lightly armored target died in five basic hits at every level.
- **One d100 answers one question.** Abilities move band edges on a roll that was already happening; they never add a second roll to the same action. This keeps every chance readable off one die and inside 5–95.
- **The class triangle is each class's soft side, not who lives longest.** Measured: a spell costs a warrior 27% more HP than a blade; a blade costs a mage 16% more than a spell and twice what it costs a warrior; the rogue loses most to everything and is hardest to hit. HP comes from CON alone, so a warrior still outlasts a mage under any fire. Sharpening that would need a new HP baseline and was left alone.
- **Bars come from base attributes plus gear.** A bind halves what an attribute does this turn; it never shrinks Max HP or Max MP.
- **The basic attack is never sealed by a bind.**

## Valerie

- **One gauge carries the character.** Airhead 0–100: Lucid, Ditzy, Total Airhead. Wing It raises it and her accidents take over; Think It Through lowers it and returns planned skills. Lucky or precise, never both.
- **All six accidents are innate at level 1.** They are who she is. Unlocking them over levels would make the opening hours play like a different character. Growth comes from the skill tree and from learning to ride the gauge.
- **Her weakness is the truth.** Fear does not register unless she is Lucid. Realization stress ignores Willpower and drops the gauge. The party's nerve rests on her not understanding, and the player is the one most able to spend it.
- **Tone is PG-13 slapstick.** She is the butt of the physics, never the butt of the story.

## Events

- **Packs are data only.** An event can ask for a fixed list of effect kinds, so a pack from another person or tool cannot do anything the rules do not allow. The validator runs before a pack loads.
- **Difficulty is named, not numbered.** `easy`, `normal`, `hard` scale with the hero's level, so one event works anywhere on the curve.
- **Events are a superset of card moments**, so they convert both ways and export as SillyTavern lorebook entries.

## SillyTavern

- **The player is a persona; the game is a Game Master card.** The card feeds the model real dice through `{{roll:1d100}}` macros in its after-chat note.
- **About 800 tokens are always in context.** Everything else is keyed.
- **Not built:** an extension that calls the engine directly. Until then the model does the arithmetic from short tables and will drift in long chats.
