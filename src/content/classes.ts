import type { ClassId, Stat } from "../types";

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  blurb: string;
  creed: string;
  primary: Stat;
  secondary: Stat;
  stats: {
    vigor: number;
    aether: number;
    steel: number;
    cunning: number;
    presence: number;
  };
  skills: string[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warden: {
    id: "warden",
    name: "Warden",
    title: "Keeper of the Green Wound",
    blurb:
      "You take the blow meant for the world. Roots answer you. The forest remembers every kindness as a debt.",
    creed: "Stand between the living and the Unmade.",
    primary: "vigor",
    secondary: "steel",
    stats: { vigor: 8, aether: 3, steel: 7, cunning: 4, presence: 5 },
    skills: ["rend", "barkward", "mending_root", "earths_claim"],
  },
  hexweaver: {
    id: "hexweaver",
    name: "Hexweaver",
    title: "Thread-Cutter of the Veil",
    blurb:
      "You speak in the grammar of unmaking. Hexes are just sentences the world is forced to finish.",
    creed: "Name a thing truly, and it kneels.",
    primary: "aether",
    secondary: "cunning",
    stats: { vigor: 4, aether: 9, steel: 3, cunning: 6, presence: 6 },
    skills: ["aether_needle", "hex_mark", "veilstep", "unmake"],
  },
  ashblade: {
    id: "ashblade",
    name: "Ashblade",
    title: "Cinder that Would Not Die",
    blurb:
      "You fight like a house already burning. Speed is a mercy you rarely grant. The last inch is yours.",
    creed: "If it can bleed, it can end.",
    primary: "steel",
    secondary: "cunning",
    stats: { vigor: 6, aether: 3, steel: 9, cunning: 6, presence: 4 },
    skills: ["cinder_cut", "ember_dash", "blood_price", "execute"],
  },
  oathbound: {
    id: "oathbound",
    name: "Oathbound",
    title: "Witness of the Last Light",
    blurb:
      "You carry a promise older than your name. When you strike, the world is asked to be better, and sometimes it is.",
    creed: "The vow is a weapon. Keep it sharp.",
    primary: "presence",
    secondary: "vigor",
    stats: { vigor: 7, aether: 5, steel: 6, cunning: 4, presence: 7 },
    skills: ["smite", "aegis", "oathfire", "judgment"],
  },
};
