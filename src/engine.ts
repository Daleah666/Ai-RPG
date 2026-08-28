import type {
  ClassId,
  GameState,
  ItemStack,
  LocationId,
  OriginId,
  Player,
  Stat,
  TimeOfDay,
  World,
} from "./types";
import { CLASSES } from "./content/classes";
import {
  AGES,
  addPartial,
  clampSpent,
  generateEpithet,
  hydrateIdentity,
  identityCheckBonus,
  KITS,
  MARKS,
  VIRTUES,
} from "./content/identity";
import { ITEMS } from "./content/items";
import { ORIGINS } from "./content/origins";
import { d20, randomSeed } from "./rng";
import type { Identity } from "./types";

const TIMES: TimeOfDay[] = ["dawn", "day", "dusk", "night"];

export type Live = GameState & { player: Player; world: World };

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function requirePlay(state: GameState): asserts state is Live {
  if (!state.player || !state.world) {
    throw new Error("Game is not in play");
  }
}

export function live(state: GameState): Live {
  requirePlay(state);
  return clone(state);
}

export function flag(state: GameState, key: string): boolean {
  const value = state.world?.flags[key];
  return value === true || value === 1;
}

export function numFlag(state: GameState, key: string): number {
  const value = state.world?.flags[key];
  return typeof value === "number" ? value : 0;
}

export function setFlag(
  state: GameState,
  key: string,
  value: boolean | number | string = true,
): Live {
  const next = live(state);
  next.world.flags[key] = value;
  return next;
}

export function remember(state: GameState, memory: string): Live {
  const next = live(state);
  if (!next.world.memories.includes(memory)) {
    next.world.memories.push(memory);
    if (next.world.memories.length > 24) next.world.memories.shift();
  }
  return next;
}

export function advanceTime(state: GameState, steps = 1): Live {
  const next = live(state);
  let idx = TIMES.indexOf(next.world.time);
  for (let i = 0; i < steps; i++) {
    idx += 1;
    if (idx >= TIMES.length) {
      idx = 0;
      next.world.day += 1;
    }
  }
  next.world.time = TIMES[idx]!;
  return next;
}

export function itemCount(player: Player, defId: string): number {
  return player.inventory.find((s) => s.defId === defId)?.qty ?? 0;
}

export function addItem(state: GameState, defId: string, qty = 1): Live {
  const next = live(state);
  const def = ITEMS[defId];
  if (!def) throw new Error(`Unknown item ${defId}`);
  const stack = next.player.inventory.find((s) => s.defId === defId);
  if (stack && def.stack !== false) {
    stack.qty += qty;
  } else if (stack) {
    stack.qty += qty;
  } else {
    next.player.inventory.push({ defId, qty });
  }
  return next;
}

export function removeItem(state: GameState, defId: string, qty = 1): Live {
  const next = live(state);
  const stack = next.player.inventory.find((s) => s.defId === defId);
  if (!stack || stack.qty < qty) return next;
  stack.qty -= qty;
  if (stack.qty <= 0) {
    next.player.inventory = next.player.inventory.filter((s) => s.defId !== defId);
  }
  return next;
}

export function addGold(state: GameState, amount: number): Live {
  const next = live(state);
  next.player.gold = Math.max(0, next.player.gold + amount);
  return next;
}

export function heal(state: GameState, hp: number, mp = 0): Live {
  const next = live(state);
  next.player.hp = Math.min(next.player.hpMax, next.player.hp + hp);
  next.player.mp = Math.min(next.player.mpMax, next.player.mp + mp);
  return next;
}

export function hurt(state: GameState, amount: number): Live {
  const next = live(state);
  next.player.hp = Math.max(0, next.player.hp - Math.max(0, Math.floor(amount)));
  return next;
}

export function xpToNext(level: number): number {
  return 30 + level * 40;
}

export function addXp(state: GameState, amount: number): Live {
  let next = live(state);
  next.player.xp += amount;
  while (next.player.xp >= xpToNext(next.player.level) && next.player.level < 8) {
    next.player.xp -= xpToNext(next.player.level);
    next.player.level += 1;
    next.player.hpMax += 6 + Math.floor(next.player.stats.vigor / 2);
    next.player.mpMax += 3 + Math.floor(next.player.stats.aether / 3);
    next.player.hp = next.player.hpMax;
    next.player.mp = next.player.mpMax;
    const bump: Stat =
      next.player.level % 2 === 0
        ? CLASSES[next.player.classId].primary
        : CLASSES[next.player.classId].secondary;
    next.player.stats[bump] += 1;
    next = remember(next, `You reached the ${ordinal(next.player.level)} circle of power.`);
    next = setFlag(next, "just.leveled", true);
  }
  return next;
}

function ordinal(n: number): string {
  const names = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
  return names[n] ?? `${n}th`;
}

export function travel(state: GameState, locationId: LocationId): Live {
  let next = live(state);
  next.world.locationId = locationId;
  if (!next.world.discovered.includes(locationId)) {
    next.world.discovered.push(locationId);
  }
  next.event = null;
  next = advanceTime(next, locationId === "rift" ? 2 : 1);
  return next;
}

export function skillMod(player: Player, stat: Stat): number {
  return player.stats[stat];
}

export function weaponPower(player: Player): number {
  if (!player.weapon) return 0;
  return ITEMS[player.weapon]?.power ?? 0;
}

export function armorPower(player: Player): number {
  if (!player.armor) return 0;
  return ITEMS[player.armor]?.armor ?? 0;
}

export function relicPower(player: Player): number {
  if (!player.relic) return 0;
  return ITEMS[player.relic]?.power ?? 0;
}

export function skillCheck(
  state: GameState,
  stat: Stat,
  dc: number,
): { state: Live; ok: boolean; roll: number; total: number } {
  const next = live(state);
  const rolled = d20(next.world.rng);
  next.world.rng = rolled.rng;
  const total = rolled.n + next.player.stats[stat] + identityCheckBonus(next.player.identity, stat);
  return { state: next, ok: total >= dc, roll: rolled.n, total };
}

export function defaultSettings() {
  return {
    textSpeed: 18,
    aiEnabled: false,
    apiKey: "",
    apiBase: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  };
}

export function hpMaxFor(stats: Player["stats"]): number {
  return 22 + stats.vigor * 3;
}

export function mpMaxFor(stats: Player["stats"]): number {
  return 8 + stats.aether * 2;
}

export function createPlayer(
  name: string,
  classId: ClassId,
  originId: OriginId,
  draft?: Partial<Identity>,
): Player {
  const cls = CLASSES[classId];
  const origin = ORIGINS[originId];
  const identity = hydrateIdentity(draft, classId, originId);
  identity.epithet = generateEpithet(classId, identity.temper, identity.drive);
  identity.spent = clampSpent(identity.spent);
  let stats = { ...cls.stats };
  stats = addPartial(stats, origin.statBonus);
  stats = addPartial(stats, AGES[identity.age].bonus);
  stats = addPartial(stats, MARKS[identity.mark].bonus);
  stats = addPartial(stats, { [VIRTUES[identity.virtue].stat]: 1 });
  stats = addPartial(stats, identity.spent);
  const kit = KITS[identity.kit];
  const items = [...origin.items, ...kit.items];
  const player: Player = {
    name: name.trim() || "Bound One",
    classId,
    originId,
    identity,
    level: 1,
    xp: 0,
    hp: 0,
    hpMax: 0,
    mp: 0,
    mpMax: 0,
    stats,
    gold: origin.gold + kit.gold,
    inventory: items.map((defId) => ({ defId, qty: 1 } satisfies ItemStack)),
    weapon: origin.weapon,
    armor: origin.armor,
    relic: origin.relic,
    skills: [...cls.skills],
    statuses: [],
  };
  // stack duplicate kit/origin items
  const stacked: ItemStack[] = [];
  for (const row of player.inventory) {
    const hit = stacked.find((s) => s.defId === row.defId);
    if (hit) hit.qty += row.qty;
    else stacked.push({ ...row });
  }
  player.inventory = stacked;
  player.hpMax = hpMaxFor(stats);
  player.mpMax = mpMaxFor(stats);
  player.hp = player.hpMax;
  player.mp = player.mpMax;
  return player;
}

export function createWorld(seed = randomSeed()): World {
  return {
    seed,
    rng: seed,
    day: 1,
    time: "dusk",
    locationId: "emberhearth",
    discovered: ["emberhearth"],
    flags: {},
    memories: ["You woke with the Veil's afterimage still burning behind your eyes."],
    lastSanctuary: "emberhearth",
  };
}

export function tickStatuses(state: GameState): Live {
  const next = live(state);
  next.player.statuses = next.player.statuses
    .map((s) => ({ ...s, turns: s.turns - 1 }))
    .filter((s) => s.turns > 0);
  return next;
}

export function hasStatus(player: Player, id: string): boolean {
  return player.statuses.some((s) => s.id === id);
}

export function grantStatus(state: GameState, id: string, name: string, turns: number): Live {
  const next = live(state);
  const existing = next.player.statuses.find((s) => s.id === id);
  if (existing) existing.turns = Math.max(existing.turns, turns);
  else next.player.statuses.push({ id, name, turns });
  return next;
}

export function equippedBonus(player: Player, key: "power" | "armor" | "aether"): number {
  let n = 0;
  for (const id of [player.weapon, player.armor, player.relic]) {
    if (!id) continue;
    const item = ITEMS[id];
    if (!item) continue;
    if (key === "power") n += item.power ?? 0;
    if (key === "armor") n += item.armor ?? 0;
    if (key === "aether") n += item.aether ?? 0;
  }
  return n;
}

export function anchorsHeld(state: GameState): number {
  return (
    (flag(state, "anchor.ember") ? 1 : 0) +
    (flag(state, "anchor.tide") ? 1 : 0) +
    (flag(state, "anchor.ash") ? 1 : 0)
  );
}
