export type ItemKind = "weapon" | "armor" | "relic" | "consumable" | "quest";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  power?: number;
  armor?: number;
  aether?: number;
  healHp?: number;
  healMp?: number;
  stack?: boolean;
  value: number;
}

export const ITEMS: Record<string, ItemDef> = {
  ashwood_spear: {
    id: "ashwood_spear",
    name: "Ashwood Spear",
    kind: "weapon",
    desc: "Pale wood that still smells of resin and old vows. It prefers the front of a fight.",
    power: 3,
    value: 20,
  },
  veil_knife: {
    id: "veil_knife",
    name: "Veil Knife",
    kind: "weapon",
    desc: "A short blade that drinks lantern-light. Excellent at finding the seam in a thing.",
    power: 2,
    aether: 1,
    value: 22,
  },
  archive_staff: {
    id: "archive_staff",
    name: "Archive Staff",
    kind: "weapon",
    desc: "Ironwood bound in catalog-rings. Every strike is also a citation.",
    power: 2,
    aether: 2,
    value: 24,
  },
  cinder_greatsword: {
    id: "cinder_greatsword",
    name: "Cinder Greatsword",
    kind: "weapon",
    desc: "Forged from cathedral bronze. It remembers being a bell.",
    power: 5,
    value: 60,
  },
  anchor_brand: {
    id: "anchor_brand",
    name: "Anchor Brand",
    kind: "weapon",
    desc: "A weapon the Veil itself seems reluctant to look at. It hums when you hesitate.",
    power: 6,
    aether: 2,
    value: 0,
  },
  travel_cloak: {
    id: "travel_cloak",
    name: "Travel Cloak",
    kind: "armor",
    desc: "Wool, smoke, and a hundred mended tears. It has outlived better coats.",
    armor: 1,
    value: 12,
  },
  salt_leather: {
    id: "salt_leather",
    name: "Salt-leather",
    kind: "armor",
    desc: "Cured in brine and stubbornness. Water beads on it like it is owed an apology.",
    armor: 2,
    value: 18,
  },
  hexweave_robe: {
    id: "hexweave_robe",
    name: "Hexweave Robe",
    kind: "armor",
    desc: "Thread that was never sheep. Spells catch in it and sulk.",
    armor: 1,
    aether: 2,
    value: 20,
  },
  warden_plate: {
    id: "warden_plate",
    name: "Warden Plate",
    kind: "armor",
    desc: "Leaf-etched iron from the old forest watch. Heavy as a promise.",
    armor: 4,
    value: 55,
  },
  veil_shard: {
    id: "veil_shard",
    name: "Veil Shard",
    kind: "relic",
    desc: "The fragment you were found holding. It is warm when you lie and cold when you are brave.",
    aether: 1,
    power: 1,
    value: 0,
  },
  tideglass: {
    id: "tideglass",
    name: "Tideglass",
    kind: "relic",
    desc: "A lens of sea-dark glass. Through it, drowned things look almost polite.",
    aether: 2,
    value: 0,
  },
  chroniclers_quill: {
    id: "chroniclers_quill",
    name: "Chronicler's Quill",
    kind: "relic",
    desc: "It writes a half-second before you decide. Arguments with it rarely go well.",
    aether: 2,
    power: 1,
    value: 0,
  },
  emberheart: {
    id: "emberheart",
    name: "Emberheart",
    kind: "relic",
    desc: "The first Anchor, cooled into a fist-sized coal that will not go out.",
    power: 2,
    aether: 1,
    value: 0,
  },
  tide_anchor: {
    id: "tide_anchor",
    name: "Tide Anchor",
    kind: "relic",
    desc: "A knot of drowned gold. Holding it, you can hear a choir that is not singing for you.",
    aether: 3,
    value: 0,
  },
  ash_anchor: {
    id: "ash_anchor",
    name: "Ash Anchor",
    kind: "relic",
    desc: "A saint's fingerbone, black as a wick. It wants to be prayed to. You should not.",
    power: 1,
    aether: 2,
    value: 0,
  },
  emberflask: {
    id: "emberflask",
    name: "Emberflask",
    kind: "consumable",
    desc: "Pepper-spirit and honey. It kicks the body back into the argument.",
    healHp: 18,
    stack: true,
    value: 10,
  },
  aether_tea: {
    id: "aether_tea",
    name: "Aether Tea",
    kind: "consumable",
    desc: "Bitter as a true name. The hands stop shaking. The Veil leans closer.",
    healMp: 12,
    stack: true,
    value: 10,
  },
  smoke_vial: {
    id: "smoke_vial",
    name: "Smoke Vial",
    kind: "consumable",
    desc: "Break it and the world becomes someone else's problem for six heartbeats.",
    stack: true,
    value: 14,
  },
  travel_bread: {
    id: "travel_bread",
    name: "Travel Bread",
    kind: "consumable",
    desc: "Dense, honest, faintly insulting. Heals a little, humiliates hunger.",
    healHp: 8,
    stack: true,
    value: 4,
  },
  ward_charm: {
    id: "ward_charm",
    name: "Ward Charm",
    kind: "consumable",
    desc: "A coin with a hole. Bite it and something stands in front of you that is not you.",
    stack: true,
    value: 16,
  },
  liris_ribbon: {
    id: "liris_ribbon",
    name: "Liri's Ribbon",
    kind: "quest",
    desc: "Faded blue, knotted twice. A child believed this would bring her home.",
    value: 0,
  },
  vesks_ledger: {
    id: "vesks_ledger",
    name: "Vesk's Ledger",
    kind: "quest",
    desc: "Names, debts, and one page that is only seawater.",
    value: 0,
  },
  forbidden_page: {
    id: "forbidden_page",
    name: "The Remaining Page",
    kind: "quest",
    desc: "It is blank until you are afraid. Then it is not.",
    value: 0,
  },
};

export const SHOP: { defId: string; cost: number }[] = [
  { defId: "emberflask", cost: 12 },
  { defId: "aether_tea", cost: 12 },
  { defId: "smoke_vial", cost: 16 },
  { defId: "ward_charm", cost: 18 },
  { defId: "travel_bread", cost: 5 },
  { defId: "cinder_greatsword", cost: 70 },
  { defId: "warden_plate", cost: 64 },
];
