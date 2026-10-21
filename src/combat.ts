import type { CombatMove, CombatState, GameState, Status } from "./types";
import { ENEMIES } from "./content/enemies";
import { ITEMS } from "./content/items";
import { SKILLS } from "./content/skills";
import {
  addGold,
  addItem,
  addXp,
  armorPower,
  equippedBonus,
  heal,
  hurt,
  live,
  remember,
  requirePlay,
  setFlag,
  weaponPower,
} from "./engine";
import { d20, pick, rollInt } from "./rng";

function enemyIntent(state: GameState, enemyId: string): { intent: string; rng: number } {
  requirePlay(state);
  const def = ENEMIES[enemyId]!;
  const { item, rng } = pick(state.world.rng, def.intents);
  return { intent: item, rng };
}

export function beginCombat(state: GameState, enemyId: string): GameState {
  requirePlay(state);
  const def = ENEMIES[enemyId];
  if (!def) throw new Error(`Unknown enemy ${enemyId}`);
  const next = live(state);
  const intent = enemyIntent(next, enemyId);
  next.world.rng = intent.rng;
  next.screen = "combat";
  next.panel = null;
  next.combat = {
    enemyId,
    enemyHp: def.hp + Math.floor(next.player.level * (def.boss ? 6 : 2)),
    enemyHpMax: def.hp + Math.floor(next.player.level * (def.boss ? 6 : 2)),
    enemyName: def.name,
    round: 1,
    log: [`${def.name} — ${def.title}. ${def.lore}`],
    intent: intent.intent,
    playerGuard: false,
    enemyStatuses: [],
    canFlee: def.canFlee,
  };
  return next;
}

function hasEnemyStatus(combat: CombatState, id: string): boolean {
  return combat.enemyStatuses.some((s) => s.id === id);
}

function tickEnemyStatuses(combat: CombatState): CombatState {
  return {
    ...combat,
    enemyStatuses: combat.enemyStatuses
      .map((s) => ({ ...s, turns: s.turns - 1 }))
      .filter((s) => s.turns > 0),
  };
}

function grantEnemyStatus(combat: CombatState, status: Status): CombatState {
  const existing = combat.enemyStatuses.find((s) => s.id === status.id);
  if (existing) {
    existing.turns = Math.max(existing.turns, status.turns);
    return combat;
  }
  return { ...combat, enemyStatuses: [...combat.enemyStatuses, status] };
}

function hitVariance(rng: number): { mult: number; rng: number; crit: boolean; roll: number } {
  const rolled = d20(rng);
  const crit = rolled.n >= 19;
  const miss = rolled.n === 1;
  const mult = miss ? 0.35 : crit ? 1.55 : 0.85 + rolled.n / 40;
  return { mult, rng: rolled.rng, crit, roll: rolled.n };
}

function signaturePower(player: { identity: { signatureSkill: string } }, skillId: string, base: number): number {
  return base + (player.identity.signatureSkill === skillId ? 4 : 0);
}

function wrathMult(player: { identity: { vice: string }; hp: number; hpMax: number }): number {
  if (player.identity.vice === "wrath" && player.hpMax > 0 && player.hp / player.hpMax < 0.45) return 1.18;
  return 1;
}

function flaskBoost(player: { identity: { vice: string } }, hp: number, mp: number): { hp: number; mp: number } {
  if (player.identity.vice !== "hunger") return { hp, mp };
  return { hp: hp ? hp + 6 : 0, mp: mp ? mp + 4 : 0 };
}

function playerDamage(state: GameState, base: number, type: "physical" | "aether" | "fire" | "holy"): number {
  requirePlay(state);
  const p = state.player;
  const stat =
    type === "physical" || type === "fire"
      ? p.stats.steel
      : type === "holy"
        ? p.stats.presence
        : p.stats.aether;
  const gear =
    type === "physical" || type === "fire"
      ? weaponPower(p)
      : equippedBonus(p, "aether");
  return base + stat + gear;
}

function applyResist(raw: number, enemyId: string, type: "physical" | "aether" | "fire" | "holy"): number {
  const def = ENEMIES[enemyId]!;
  const r = def.resists?.[type] ?? 0;
  return Math.max(1, Math.floor(raw * (1 - r) - def.armor * 0.5));
}

function log(combat: CombatState, line: string): CombatState {
  return { ...combat, log: [...combat.log.slice(-8), line] };
}

function afterPlayerAttack(state: GameState): GameState {
  requirePlay(state);
  if (!state.combat) return state;
  let next = live(state);
  if (next.combat!.enemyHp <= 0) {
    next.combat = { ...next.combat!, over: "win", intent: "falls" };
    next.combat = log(next.combat, `${next.combat.enemyName} comes apart like a bad argument.`);
    return next;
  }
  return enemyTurn(next);
}

function enemyTurn(state: GameState): GameState {
  requirePlay(state);
  if (!state.combat || state.combat.over) return state;
  let next = live(state);
  let combat = tickEnemyStatuses(next.combat!);
  const def = ENEMIES[combat.enemyId]!;
  const variance = hitVariance(next.world.rng);
  next.world.rng = variance.rng;
  let dmg = Math.floor((def.power + next.player.level) * variance.mult);
  dmg = Math.max(1, dmg - armorPower(next.player));
  if (combat.playerGuard) dmg = Math.max(1, Math.floor(dmg * 0.45));
  if (next.player.statuses.some((s) => s.id === "ward")) dmg = Math.max(1, Math.floor(dmg * 0.7));
  if (variance.roll === 1) dmg = Math.max(1, Math.floor(dmg * 0.4));
  next = hurt(next, dmg);
  combat = log(
    combat,
    `${def.name}: ${combat.intent} — ${dmg} hurt${variance.crit ? " (a cruel hit)" : ""}.`,
  );
  combat.playerGuard = false;
  if (next.player.hp <= 0) {
    combat.over = "lose";
    combat = log(combat, "The dark comes in without knocking.");
    next.combat = combat;
    return next;
  }
  const nxt = enemyIntent(next, combat.enemyId);
  next.world.rng = nxt.rng;
  combat.intent = nxt.intent;
  combat.round += 1;
  next.combat = combat;
  next.player.statuses = next.player.statuses
    .map((s) => ({ ...s, turns: s.turns - 1 }))
    .filter((s) => s.turns > 0);
  return next;
}

export function resolveCombat(state: GameState, move: CombatMove): GameState {
  requirePlay(state);
  if (!state.combat || state.combat.over) return state;
  let next = live(state);
  let combat = next.combat!;

  if (move.kind === "defend") {
    combat.playerGuard = true;
    const gain = next.player.identity.vice === "doubt" ? 5 : 2;
    next.player.mp = Math.min(next.player.mpMax, next.player.mp + gain);
    combat = log(combat, "You set your weight low. The next blow will find less of you.");
    next.combat = combat;
    return enemyTurn(next);
  }

  if (move.kind === "flee") {
    if (!combat.canFlee) {
      combat = log(combat, "There is no leaving this. The place has closed its hand.");
      next.combat = combat;
      return next;
    }
    const rolled = d20(next.world.rng);
    next.world.rng = rolled.rng;
    const total = rolled.n + next.player.stats.cunning;
    const dc = 12 + (ENEMIES[combat.enemyId]!.boss ? 6 : 0) + (next.player.identity.vice === "pride" ? 3 : 0);
    if (total >= dc) {
      combat.over = "flee";
      combat = log(combat, "You become a rumor with legs.");
      next.combat = combat;
      return next;
    }
    combat = log(combat, `Flee fails (${total}). It was always going to.`);
    next.combat = combat;
    return enemyTurn(next);
  }

  if (move.kind === "item") {
    const stack = next.player.inventory.find((s) => s.defId === move.defId);
    const item = ITEMS[move.defId];
    if (!stack || !item || item.kind !== "consumable") return state;
    stack.qty -= 1;
    if (stack.qty <= 0) {
      next.player.inventory = next.player.inventory.filter((s) => s.defId !== move.defId);
    }
    if (item.id === "smoke_vial" && combat.canFlee) {
      combat.over = "flee";
      combat = log(combat, "Glass, smoke, absence. You are gone.");
      next.combat = combat;
      return next;
    }
    if (item.id === "ward_charm") {
      next.player.statuses.push({ id: "ward", name: "Ward", turns: 3 });
      combat = log(combat, "Something stands in front of you that is not you.");
      next.combat = combat;
      return enemyTurn(next);
    }
    if (item.healHp || item.healMp) {
      const boosted = flaskBoost(next.player, item.healHp ?? 0, item.healMp ?? 0);
      next = heal(next, boosted.hp, boosted.mp);
      combat = log(combat, `You take the ${item.name}. The body renegotiates.`);
      next.combat = combat;
      return enemyTurn(next);
    }
    next.combat = log(combat, "Nothing useful happens.");
    return enemyTurn(next);
  }

  const skill = SKILLS[move.skillId];
  if (!skill || !next.player.skills.includes(skill.id)) return state;
  if (next.player.mp < skill.mp) {
    combat = log(combat, "The aether in you is a dry well.");
    next.combat = combat;
    return next;
  }
  next.player.mp -= skill.mp;

  if (skill.type === "heal") {
    let amount = signaturePower(next.player, skill.id, skill.power) + next.player.stats.vigor;
    if (next.player.identity.virtue === "mercy") amount += 6;
    next = heal(next, amount);
    combat = log(combat, `${skill.name} knits ${amount} of you back into place.`);
    next.combat = combat;
    return enemyTurn(next);
  }

  if (skill.type === "guard") {
    combat.playerGuard = true;
    next.player.statuses.push({ id: "ward", name: skill.name, turns: 2 });
    combat = log(combat, `${skill.name}. You become briefly less edible.`);
    next.combat = combat;
    return enemyTurn(next);
  }

  if (skill.type === "hex") {
    combat = grantEnemyStatus(combat, { id: "hexed", name: "Hexed", turns: 3 });
    const variance = hitVariance(next.world.rng);
    next.world.rng = variance.rng;
    const raw = playerDamage(next, signaturePower(next.player, skill.id, skill.power), "aether") * variance.mult * wrathMult(next.player);
    const dmg = applyResist(raw, combat.enemyId, "aether");
    combat.enemyHp -= dmg;
    combat = log(combat, `Hex Mark brands them (${dmg}). Subsequent hurts will drink deeper.`);
    next.combat = combat;
    return afterPlayerAttack(next);
  }

  if (skill.type === "shift") {
    next.player.statuses.push({ id: "veilstep", name: skill.name, turns: 2 });
    if (skill.power > 0) {
      const variance = hitVariance(next.world.rng);
      next.world.rng = variance.rng;
      const dtype = skill.damageType ?? "physical";
      const raw = playerDamage(next, signaturePower(next.player, skill.id, skill.power), dtype) * variance.mult * wrathMult(next.player);
      const dmg = applyResist(raw, combat.enemyId, dtype);
      combat.enemyHp -= dmg;
      combat = log(combat, `${skill.name} — you arrive already unkind (${dmg}).`);
    } else {
      combat = log(combat, `${skill.name}. You are briefly a rumor.`);
    }
    next.combat = combat;
    return afterPlayerAttack(next);
  }

  if (skill.id === "blood_price") {
    next = hurt(next, 6);
    combat = log(combat, "You pay six of yourself. The blade considers this persuasive.");
  }

  const variance = hitVariance(next.world.rng);
  next.world.rng = variance.rng;
  const dtype = skill.damageType ?? "physical";
  let power = signaturePower(next.player, skill.id, skill.power);
  if (skill.type === "execute" && combat.enemyHp / combat.enemyHpMax <= 0.4) {
    power += 10;
  }
  if (next.player.statuses.some((s) => s.id === "veilstep")) {
    power += 4;
  }
  let raw = playerDamage(next, power, dtype) * variance.mult * wrathMult(next.player);
  if (hasEnemyStatus(combat, "hexed")) raw *= 1.3;
  const dmg = applyResist(raw, combat.enemyId, dtype);
  combat.enemyHp -= dmg;
  combat = log(
    combat,
    `${skill.name} lands for ${dmg}${variance.crit ? " — a bright, ugly miracle" : ""}${
      variance.roll === 1 ? " — glancing" : ""
    }.`,
  );
  next.combat = combat;
  return afterPlayerAttack(next);
}

export function finishCombat(state: GameState): GameState {
  requirePlay(state);
  if (!state.combat?.over) return state;
  const over = state.combat.over;
  const def = ENEMIES[state.combat.enemyId]!;
  let next = live(state);
  next.combat = null;
  next.screen = "play";

  if (over === "flee") {
    next = remember(next, `You fled ${def.name}. The story kept the receipt.`);
    return next;
  }

  if (over === "lose") {
    next.player.hp = Math.max(1, Math.floor(next.player.hpMax / 3));
    next.player.mp = Math.max(0, Math.floor(next.player.mpMax / 2));
    next.player.gold = Math.floor(next.player.gold * 0.8);
    next.player.statuses = [];
    next.world.locationId = next.world.lastSanctuary;
    next.world.time = "dawn";
    next.world.day += 1;
    next.event = { id: "wake.defeat", step: 0 };
    next = remember(next, `You died, or near enough, to ${def.name}.`);
    if (def.id === "hollow_king") {
      next.screen = "ending";
      next.ending = {
        id: "unmade",
        title: "UNMADE",
        body: [
          "The Hollow King does not kill you so much as misplace you.",
          "Your name becomes a draft the Chronicler never filed. Thalorin continues, slightly less.",
          "In Emberhearth, Mira sets an extra cup out for three nights, then stops.",
        ],
      };
    }
    return next;
  }

  // win
  next = addXp(next, def.xp);
  const pay = next.player.identity.vice === "greed" ? Math.floor(def.gold * 1.35) : def.gold;
  next = addGold(next, pay);
  if (def.winFlag) next = setFlag(next, def.winFlag, true);
  if (def.winMemory) next = remember(next, def.winMemory);
  for (const loot of def.loot ?? []) {
    const roll = rollInt(next.world.rng, 1, 100);
    next.world.rng = roll.rng;
    if (roll.n <= loot.chance * 100) {
      next = addItem(next, loot.defId);
      if (loot.defId === "emberheart") next.player.relic = "emberheart";
      if (loot.defId === "tide_anchor") next.player.relic = "tide_anchor";
      if (loot.defId === "ash_anchor") next.player.relic = "ash_anchor";
    }
  }
  next.event = { id: `victory.${def.id}`, step: 0 };
  if (def.id === "hollow_king") {
    next.event = { id: "ending.choice", step: 0 };
  }
  return next;
}

export function useItemInPeace(state: GameState, defId: string): GameState {
  requirePlay(state);
  const item = ITEMS[defId];
  const stack = state.player.inventory.find((s) => s.defId === defId);
  if (!item || !stack) return state;
  if (item.kind === "weapon" || item.kind === "armor" || item.kind === "relic") {
    const next = live(state);
    if (item.kind === "weapon") next.player.weapon = defId;
    if (item.kind === "armor") next.player.armor = defId;
    if (item.kind === "relic") next.player.relic = defId;
    return next;
  }
  if (item.kind !== "consumable") return state;
  let next = live(state);
  const s = next.player.inventory.find((x) => x.defId === defId)!;
  s.qty -= 1;
  if (s.qty <= 0) next.player.inventory = next.player.inventory.filter((x) => x.defId !== defId);
  if (item.id === "ward_charm") {
    next.player.statuses.push({ id: "ward", name: "Ward", turns: 4 });
    return next;
  }
  if (item.healHp || item.healMp) {
    const boosted = flaskBoost(next.player, item.healHp ?? 0, item.healMp ?? 0);
    return heal(next, boosted.hp, boosted.mp);
  }
  return next;
}
