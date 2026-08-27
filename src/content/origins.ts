import type { OriginId, Stat } from "../types";

export interface OriginDef {
  id: OriginId;
  name: string;
  place: string;
  blurb: string;
  opening: string;
  gold: number;
  items: string[];
  weapon: string;
  armor: string;
  relic?: string;
  statBonus: Partial<Record<Stat, number>>;
}

export const ORIGINS: Record<OriginId, OriginDef> = {
  foundling: {
    id: "foundling",
    name: "Emberhearth Foundling",
    place: "The inn's spare room, still warm",
    blurb:
      "Mira found you at the Veilwood's edge with a fever and a shard of light in your fist. The village raised you. The woods never quite let go.",
    opening:
      "You wake in Mira's inn the way you always have — to woodsmoke, bread, and the sense that the dark outside is listening. Tonight the listening has a shape.",
    gold: 18,
    items: ["emberflask", "travel_bread"],
    weapon: "ashwood_spear",
    armor: "travel_cloak",
    relic: "veil_shard",
    statBonus: { vigor: 1, presence: 1 },
  },
  runaway: {
    id: "runaway",
    name: "Saltmoor Runaway",
    place: "A road still tasting of brine",
    blurb:
      "You jumped a Saltmoor crew after the drowned god spoke your name through a fog bell. The tide still thinks it owns a piece of you.",
    opening:
      "Emberhearth's lamps look like cowardice after the docks. You paid for a room with stolen coin and a story you will not repeat. Sleep did not come cleanly.",
    gold: 24,
    items: ["emberflask", "smoke_vial"],
    weapon: "veil_knife",
    armor: "salt_leather",
    relic: "tideglass",
    statBonus: { cunning: 1, steel: 1 },
  },
  apostate: {
    id: "apostate",
    name: "Archive Apostate",
    place: "Exile, with ink still under the nails",
    blurb:
      "You copied a page the Sunken Archives forbade. The page burned itself onto the inside of your eyelid. They sent you away. The sentence remained.",
    opening:
      "The innkeep does not ask why a scholar drinks like a soldier. Behind your eyes the forbidden page turns itself, patiently, as if waiting for you to read aloud.",
    gold: 14,
    items: ["aether_tea", "travel_bread"],
    weapon: "archive_staff",
    armor: "hexweave_robe",
    relic: "chroniclers_quill",
    statBonus: { aether: 1, presence: 1 },
  },
};
