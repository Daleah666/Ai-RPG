# Handoff: Combat Engineer

Built `engine/combat.js` (pure, browser-safe, integers out), `test/combat.test.js`, `blueprint/01_engine_math.md` (formulas, tables, worked examples, by-hand reference). `node --test test/core.test.js test/combat.test.js`: 52 pass, 0 fail.

## Final formulas (effective attributes everywhere)
```
Hit %  = clamp(75 + 40 x (ACC - EVA)/(ACC + EVA) + skill.acc + hitBonus, 5, 95)      ACC, EVA = AGI + LCK/2
Crit % = clamp(5 + 20 x (LCKa - LCKd)/(LCKa + LCKd) + skill.crit + critBonus, 1, 50), never above Hit %
Roll   = one d100: >= fumbleFrom (96) fumble, <= Crit % crit, <= Hit % hit, else miss
Damage = floor(Power x Level x 1.5 x A^2 / (2A + D) x variance x crit x affinity x guard x damageMult), min 1 unless nulled
Heal   = floor(Power x Level x INT x 0.5 x variance x crit x mult), min 1
Stress = max(1, round(Base x mult x (1 - min(0.75, WIL/(WIL + 600)))))               relief (negative) passes through
Init   = AGI x 10 + rollInt(0, AGI x 2), higher acts first
```
Exported constants: HIT_BASE 75, HIT_SLOPE 40, LCK_TO_ACC 0.5, CRIT_BASE 5, CRIT_SLOPE 20, CRIT_FLOOR 1, CRIT_CAP 50, CRIT_MULT 1.5, DEF_WEIGHT 0.5, EVEN_PASS 0.5, GUARD_MULT 0.5, VARIANCE {MIN 0.9, MAX 1.1}, MIN_DAMAGE 1, BASIC_POWER 2, HEAL_SCALE 0.5, STRESS_K 600, STRESS_MIT_CAP 0.75, INIT_SCALE 10, INIT_SPREAD 0.2.

## Changed from baseline, and why
- **Damage: `A^2/(A + D)` became `1.5 x A^2/(2A + D)`** (defense weight 1 -> 0.5, rescaled so A = D is untouched: a basic hit on an even target is still Level x A, 10 hits to kill). CON buys both HP and defense, so at full weight a defender with CON 0.6x the attacker's STR died in 4.8 hits (5 landed) at L1, L50 and L100: A2 broken. Now the 0.6x-1.2x stand-in band takes 6-13 landed hits (14 at one L1 corner). Cost: defense counts a little less (double defense passes 37.5% of raw damage, was 33%).
- Hit, crit and stress are the baseline, unchanged: they hold A1 and A5 across 1-1000. hitPct is 5-95; critPct keeps the baseline's own 1-50 window because it is a band inside the hit roll, not a separate chance. STRESS_MIT_CAP never binds while STRESS_K is 600 (WIL 1000 mitigates 0.625).
- New, not in the baseline: Heal, Init, variance in whole percents (0.90-1.10), the fumble edge clamped to 2-101.
- A2 is tested on plain hits (variance 1, no crit). With luck on, the 0.6x corner ends in 5 landed hits one duel in three (one crit among the first five does it).

## Exports
```
BASIC_ATTACK   frozen skill: id 'basic_attack', power 2, STR, physical, phys, melee, part 'arms', no cost
hitChance(attacker, defender, skill = BASIC_ATTACK, opts = {})      -> { hitPct, critPct, fumbleFrom }
rollAttack(attacker, defender, skill = BASIC_ATTACK, rng, opts = {}) -> { roll, hitPct, critPct, fumbleFrom, outcome }
affinityOf(defender, skill = BASIC_ATTACK)                          -> 'weak' | 'normal' | 'resist' | 'null' | 'absorb' (throws on a typo)
damage(attacker, defender, skill = BASIC_ATTACK, { crit = false, variance = 1, guard = false, affinity, damageMult = 1 } = {}) -> integer >= 0
resolveAttack(attacker, defender, skill = BASIC_ATTACK, rng, opts = {}) -> { outcome, roll, hitPct, critPct, fumbleFrom, affinity, variance, damage, absorbed }
healAmount(caster, skill, { variance = 1, crit = false, mult = 1 } = {})   -> integer   (skill is anything with { power, stat? })
stressTaken(baseStress, target, { ignoreWill = false, mult = 1 } = {})     -> integer
initiative(combatant, rng)                                          -> integer
expectedDamage(attacker, defender, skill = BASIC_ATTACK, opts = {}) -> number, 2 decimals, negative when absorbed
hitsToKill(attacker, defender, skill = BASIC_ATTACK, hp, opts = {})  -> integer or Infinity (hp defaults to maxHp, then 10 x Level x CON)
passThrough(atk, def) -> 0..0.75    stressMitigation(wil) -> 0..0.75    rollVariance(rng) -> 0.90..1.10
attackStatOf(skill), defenseStatOf(skill) -> attribute key (CON answers STR, WIL answers INT, otherwise by skill.type)
```
- `opts` for hitChance, rollAttack, resolveAttack, expectedDamage: `hitBonus`, `hitFloor`, `hitCap`, `critBonus`, `fumbleFrom`. resolveAttack and expectedDamage also take `damageMult`, `guard`, `affinity`, and resolveAttack takes `variance` (fixes it, no draw). hitsToKill takes `guard`, `affinity`, `damageMult`.
- Nothing mutates a combatant: the caller applies damage, healing and stress. Rng use: rollAttack 1 draw; resolveAttack 1 draw, plus 1 for variance only when the attack lands; initiative 1 draw.
- `outcome` is 'crit' | 'hit' | 'miss' | 'fumble'. Absorb: `damage` is the positive amount and `absorbed` is true; add it to the defender's HP. A `damageMult` of 0 still leaves 1 damage; use affinity 'null' to negate a hit.

## Systems Designer
- stressTaken returns the amount to add. You clamp to 0-200 and fire the Resolve Check. `mult` scales gains only; relief is returned untouched, so scale relief yourself before calling.
- Fumble: 5 rolls in 100 by default; resolveAttack returns outcome 'fumble' with damage 0. The consequence is yours.
- Binds arrive through effectiveStat. Arms: basic damage x0.375 at even stats. Head: heals halved, magic taken x1.2, stress up (base 30 at WIL 600 lands 15, bound 20). Legs: to-hit 75 -> 67, is hit at 83, and acts after anyone above 60% of their unbound AGI.
- BASIC_ATTACK.part is 'arms'. If a bound part seals its skills, bound arms would seal the basic attack too. I suggest exempting it: halved STR already cuts it to 37.5%.
- Defender-side effects go in as a negative `hitBonus`. Area skills: one resolveAttack per target, never two rolls at the same target for one action. Stress skills: rollAttack (or auto-hit), then stressTaken.

## Content Writer
- `power`: each point is 5% of an even peer's HP per landed hit. Basic 2 = 10%, skills 3-12 = 15-60%, Power 20 = a peer's whole bar or 5% of a x20 boss. Enemy skills aimed at heroes: single target up to about 8, row/all up to about 4, unless it is a telegraphed wipe.
- `acc`: -20 to +20 (engine tested to +/-50). At even odds +10 is x1.13 average damage, -10 is x0.87, -20 is x0.74. `crit`: 0 to +20; each +10 is about +6%. Average damage per use at even stats is 0.775 x a plain hit.
- Weak x crit is x2.25: a Power 6 spell then deletes a trained peer. Guard is x0.5. Buffs: x1.5 attack is x1.69 damage; x1.5 defense is only x0.86 taken. Price them accordingly.
- Heals restore 5% x Power x INT / target CON of the target's bar: Power 3 is 15% and Power 8 is 40% of an ally whose CON matches the healer's INT. Items should heal a share of max HP.
- Base stress that lands about 5 / 12 / 24 (weak / medium / severe) on trained WIL: early (L1-20) 5 / 12 / 25, mid (about L50) 8 / 18 / 36, late (about L100) 10 / 24 / 48. At L100 a base of 24 lands 16 on WIL 300, 12 on WIL 600, 10 on WIL 800.

## Progression Analyst and Director
- A mirror duel stays in 6-14 hits while CON / STR is 0.59-1.28 (hits = (10/3) x r x (2 + r)), assuming maxHp = 10 x Level x CON. `data/archetypes.json` as it stood when I finished gives warrior 11-12, mage 12-13, rogue 8-9 at L1/50/100 (a one-off check, not in my tests).
- Requests: update the Damage line in FOUNDATION.md to the new formula, and let A1 say that crit runs 1-50.
