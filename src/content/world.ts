import type { LocationId, TimeOfDay } from "../types";

export interface LocationDef {
  id: LocationId;
  name: string;
  region: string;
  kicker: string;
  travelHint: string;
  sanctuary?: boolean;
}

export const LOCATIONS: Record<LocationId, LocationDef> = {
  emberhearth: {
    id: "emberhearth",
    name: "Emberhearth",
    region: "The Hearthlands",
    kicker: "The last kind lamps in Thalorin",
    travelHint: "A short road, if the dark is polite.",
    sanctuary: true,
  },
  veilwood: {
    id: "veilwood",
    name: "The Veilwood",
    region: "The Green Wound",
    kicker: "Trees that remember being people",
    travelHint: "The path is a rumor the forest allows.",
  },
  saltmoor: {
    id: "saltmoor",
    name: "Saltmoor Docks",
    region: "The Drowned Coast",
    kicker: "Where the tide keeps accounts",
    travelHint: "Brine on the wind, debts on the tongue.",
  },
  archives: {
    id: "archives",
    name: "Sunken Archives",
    region: "The Quiet Stacks",
    kicker: "Knowledge that learned to drown",
    travelHint: "Down, then down again.",
  },
  cathedral: {
    id: "cathedral",
    name: "Ashen Cathedral",
    region: "The Burnt See",
    kicker: "A prayer that caught fire and kept going",
    travelHint: "Pilgrim-road, now mostly ash.",
  },
  rift: {
    id: "rift",
    name: "The Rift",
    region: "The Unmade Court",
    kicker: "Where the story tries to end you first",
    travelHint: "Three Anchors, or it will not open.",
  },
};

export const GRAPH: Record<LocationId, LocationId[]> = {
  emberhearth: ["veilwood", "saltmoor"],
  veilwood: ["emberhearth", "archives", "cathedral"],
  saltmoor: ["emberhearth", "archives"],
  archives: ["veilwood", "saltmoor", "cathedral"],
  cathedral: ["veilwood", "archives", "rift"],
  rift: ["cathedral"],
};

export const TIME_LABEL: Record<TimeOfDay, string> = {
  dawn: "Dawn",
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};
