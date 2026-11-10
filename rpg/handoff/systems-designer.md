# Handoff: Systems Designer

Built `engine/stress.js`, `engine/binds.js` (pure, browser-safe, nothing mutates its input), `data/afflictions.json` (7), `data/virtues.json` (5), `test/stress.test.js` (51 tests), `test/binds.test.js` (21), `blueprint/03_psych_status.md`. `node --test test/core.test.js test/combat.test.js test/stress.test.js test/binds.test.js`: 125 pass, 0 fail. `tools/check-data.mjs` passes with the two tables. Every blueprint number is code output.

## The Resolve Check: one d100 answers everything
- **Band** picks side and entry. Virtue chance = 25 + shift, shift clamped to ±15 (10 to 40). **Even roll**: the character's `personal` entry for that side replaces the table entry; odd, the table stands.
- **Doubles** (11, 22 … 99, 100): permanent. The Affliction leaves its Scar, the Virtue a Silver Lining, when it ends. I used doubles, not 96–100, because the fumble band would tie permanence to the last table entry; doubles reach every Affliction (one per band at base, two in the last). 8 faces scar, 2 leave a Lining.
- **Rescale**: each side keeps its order; upper edge = side start + round(cumulative base width × new side width ÷ base side width). Virtues start 0 / base 25; Afflictions start at the Virtue chance / base 75. Layouts for −15 … +15 are in blueprint 3.4 and pinned in the tests.

| 1–5 | 6–10 | 11–15 | 16–20 | 21–25 | 26–36 | 37–47 | 48–58 | 59–69 | 70–80 | 81–90 | 91–100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| On a Roll | Unflappable | In the Zone | Mother Hen | Second Wind | Martyr Complex | Spooked | Loot Goblin | Tinfoil Helm | Backseat Hero | Doomsayer | Lost the Plot |

## Rules in one breath
- **Bar** 0–200. `'resolve'` when it reaches 100 from below with `resolve === null`; `'breakdown'` on reaching 200 (outranks resolve). Knocked out (hp ≤ 0) or Stormed Off: no stress. **World stress goes through WIL; party stress and all relief are flat**: a Resolve result returns `party: { stress, ignoreWill: true, source: 'mental' }` for every other member.
- **Affliction**: mods on at once, turn check each turn (base 30/35/40%, +5 per 20 stress over 100; 96–100 is its meltdown), ends under 50 stress, by Night Off, snap-out (stress to 90) or Breakdown. Not by battle end. **Virtue**: owner sheds 40 or 50, 30% flourish each turn, ends at battle end. **Shift**: +5 per ally in a Virtue, −5 per Afflicted ally, Unflappable +10, Doomsayer −10, plus `extra`.
- **Marks**: 3 Scars at most (player picks which a fourth drops), 1 Silver Lining (cancels the next Scar or is spent on one). Talk It Out removes a Scar for `priceAt(level, 1)`.
- **Breakdown** is a choice of who pays: `storm_off` (out for the battle, back on 50), `have_it_out` (stays on 80, allies +20 flat), `bottle_it` (stays on 80, Scar now). Second in one battle: forced Storm Off.
- **Enemies**: I adopted the Content Writer's statuses. `enemyStressEvent(enemy, event)`: Rattled at 100 (stored as `resolve.kind 'rattled'`: −10 to hit, fumble 91+ through `withStateOpts`), Routed at 200 (minion/standard defeated; bigger loses an action, back to 100).
- **Bind %** = clamp((skill chance + 60 × (LCKa − LCKt) ÷ (LCKa + LCKt) + bonus) × (1 − bindResist ÷ 100) × 0.5^earlier binds, 5, 95). Crit (roll ≤ chance ÷ 10) +1 turn. Fumble (96+) on a pure bind skill binds the binder's same part 1 turn. Refresh to the longer duration, never stack, cap 5 turns. Tick at the end of the bound combatant's own turn. All three parts: Trussed, ×1.5 damage taken. Legs bound: no fleeing, no covering.

## Exports
`stress.js` (objects with `.combatant` unless noted): `applyStress(c, base, { source, ignoreWill, mult })` → `{ combatant, taken, before, after, event, source, calmed }` · `addStress(c, amount)` (already mitigated) · `relieveStress(c, amount, { from: 'ally'|'self'|'rest'|'other', drop })` → `{ combatant, relieved, before, after, refused, calmed, ended, mark }` · `breather(c)` · `rest(c, 'unwind'|'inn'|'night_off')`
`resolveBands(tables, shift)` → `[{ lo, hi, kind, id, name, entry, doubles }]` · `resolveVirtuePct(shift)` · `readResolveRoll(roll, opts)` · `resolveCheck(c, rng, { tables, virtueShift, personal })` → `{ roll, virtuePct, kind, entry, band, permanent, personal, combatant, party, heal, mark }` · `forceResolve(c, outcome, { tables, id, personal, rng })` · `startResolve` · `partyResolveShift(allies, extra)` → number · `validateResolveTables(tables)` → `{ ok, errors }`
`actOutCheck(c, rng, { bonus })` → `{ roll, pct, outcome: 'composed'|'act_out'|'meltdown'|'flourish'|'steady'|'none', act, combatant }` (sets `flags.mood`; no state, no roll) · `actOutChance(c)` · `pickByRoll(roll, list)`
`refuses(c, what, ctx)` · `covers(c)` · `withStateOpts(c, opts)` → attack opts · `effectsOf(c, kind)` · `stressMultFor` · `reliefMultFor` · `consumeFirstRefusal(c, 'heal'|'buff')`
`clearResolve(c, { mark, drop })` · `snapOut(c)` · `gainMark` · `removeMark` · `spendSilverLining(c, scarId)` · `marksOf(c)` → array · `breakdownChoices(c)` → ids · `breakdown(c, { choice, drop })` → `{ combatant, choice, forced, out, party, mark, cancelled, ended }` · `endBattle(c, { won, boss })` · `enemyStressEvent(enemy, event)` → `{ status, defeated, loseTurn, combatant }`
Also `stressBase(tier, level)`, `stressFor(id, level)`, `stressBand`, `isDoubles`, `isOutOfIt`; constants `STRESS`, `STRESS_TIERS`, `STRESS_SOURCES`, `STRESS_SOURCE_TAGS`, `RELIEF`, `SERVICES`, `RESOLVE_RULES`, `ACT`, `MARKS`, `GENERIC_SCAR`, `SILVER_LINING`, `BREAKDOWN`, `ENEMY_STRESS`.
`binds.js`: `bindChance(attacker, target, part, base, { bonus, ignoreResist, ignoreWear, floor, cap })` → pct · `bindOdds` (the working) · `tryBind(attacker, target, part, base, turns, rng, { roll, fumbleFrom, backfire, ownTurn, …bindChance opts })` → `{ pct, roll, success, crit, fumble, backfire, turns, combatant, attacker }` · these return the combatant: `applyBind(c, part, turns, { ownTurn, count })`, `tickBinds(c)`, `cureBinds(c, parts?)`, `struggle(c, part?)`, `endBattleBinds(c)` · `isSealed(c, skill)`, `sealedBy`, `usableSkills`, `boundParts`, `isBound`, `isTrussed`, `trussedDamageMult`, `canFlee`, `bindResistOf`, `timesBound`, `BIND_RULES`, `NEVER_SEALED`.
State lives where `makeCombatant` keeps it: `resolve`, `mods` (source = entry id, turns null), `flags.marks`, `flags.mood`, `flags.bindCount`, `flags.bindFresh`, `flags.breakdowns`, `flags.stormedOff`, `flags.refusedFirst`.

## JSON shapes
`{ version, side, table, afflictions: [...] }` and `{ ..., virtues: [...] }`. Entry: `id`, `name`, `range [lo, hi]`, `quote`, `text` (stands alone, states the party line), `want`, `cost`, `effects[]`, `behavior { actOut | inspire, act, meltdown }`, `onStart { selfStress, partyStress, selfHealPct? }`, `until`, and on Afflictions `mark { id, kind: 'scar', name, text, effects[] }`. Effect kinds: `mod {stat, mult}` · `stressMult {mult, source?}` · `reliefMult` · `attack {hitBonus, critBonus, fumbleShift, noFumble, hitFloor, damageMult}` · `refuse {what, when?}` · `refuseFirst {what}` · `cover {who}` · `regen {hpPct}` · `resolveShift {allies}` · `gold {mult}` · `heckle {on[], stress}`. The engine applies mod, stressMult, reliefMult, attack, refuse, resolveShift. The loop reads the rest with `effectsOf`. Act fields the loop executes: `action` (none, pass, guard, cover, attack, item, skill), `target`, `skill`, `pick`, `fallback`, `refuses[]`, `allyStress {amount, who}`, `selfHpPct`, `goldPerLevel`, `attack {…}`, `partyRelief`, `allyHealPct`, `cureBinds`.

## Requests for the Director
1. **Bug in `rng.fixedRolls`**: it replays 30 as 29, 58 as 57 and 59 as 58 (`(r − 1) / 100 × 100` floors one short). Fix: `return (rolls[i++] - 0.5) / 100`. My tests use their own exact replay. `test/integration.test.js` walks 1–100 through it.
2. **`makeCombatant` drops `bindResist`.** Carry it through, or copy it into `flags.bindResist`; `bindResistOf` reads either, as one number or `{ head, arms, legs }`.
3. **No change wanted to `BIND_MAP`, `BIND_MULT` or `RESOLVE`.** Update the `resolve` comment in `stats.js`: the state is `{ kind, id, name, turns: null, until, permanent, personal, roll, effects, behavior, mark }`, and `kind` is `'rattled'` on an enemy.
4. **Cleanse and steal effects must skip mods whose `source === combatant.resolve.id`**, or Fresh Start Kit strips an Affliction's attributes and Repossession steals a Virtue.
5. **Valerie's two entries need machine fields** to do what their text says: Self-Aware `onStart: { partyStress: 5 }`; A Good Hero `onStart: { selfStress: -40, partyStress: -10 }, effects: [{ kind: 'stressMult', mult: 0 }]`. With neither, a Virtue still sheds 40 by default and the party gets nothing. Add a `mark` to give her her own Scar.
6. **Lorebook**: the stress and bind entries predate these rules. Add the three readings of the roll, the Breakdown choices and the bind formula from blueprint 3.12.

## Wiring the hero
```
const f = stressFilter(val, base, source);                                   // her filter first
const r = applyStress(val, f.amount, { source, ignoreWill: f.ignoreWill });  // allies: relieveStress(ally, f.allyRelief, { from: 'other' })
if (r.event === 'resolve') {
  const shift = partyResolveShift(others, isValerie ? 0 : resolveShiftForAllies(valerie));
  const rc = resolveCheck(r.combatant, rng, { tables, virtueShift: shift, personal: isValerie ? valerieData.resolve : undefined });
  if (rc.party) for (const o of others) applyStress(o, rc.party.stress, rc.party);   // through stressFilter when o is Valerie
}
if (r.event === 'breakdown') breakdown(r.combatant, { choice });             // then apply .party the same way
enemy = applyBind(enemy, befuddledPart(roll), 1, { ownTurn: true });         // Aura fumble; skills that bind their own user too
tryBind(val, foe, 'legs', 55, 2, rng, { backfire: false });                  // Trip: her fumble is a Chaos Wave, not a backfire
tryBind(val, foe, 'arms', crit ? 95 : 35, 2, null, { roll: attack.roll });   // Lucky Break rides on the attack roll
resolveAttack(actor, target, skill, rng, withStateOpts(actor, stanceOpts));  // every attack by anyone in a state
```
Party stress is tagged `mental`, so a non-Lucid Valerie does not notice a friend cracking and allies shed 3: intended. Skip the `fumble` stress source for a Chaos Wave.
