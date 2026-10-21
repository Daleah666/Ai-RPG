import type {
  AgeId,
  ClassId,
  DriveId,
  EyeId,
  FearId,
  HairId,
  Identity,
  KitId,
  MarkId,
  OriginId,
  PronounId,
  SkinId,
  Stat,
  Stats,
  TemperId,
  ViceId,
  VirtueId,
} from "../types";
import { CLASSES } from "./classes";

export const STAT_KEYS: Stat[] = ["vigor", "aether", "steel", "cunning", "presence"];
export const POINT_BUY = 5;
export const POINT_CAP = 3;

export interface Labeled<T extends string> {
  id: T;
  name: string;
  blurb: string;
}

export const PRONOUNS: Record<PronounId, { id: PronounId; name: string; they: string; them: string; their: string; themself: string }> =
  {
    they: { id: "they", name: "they / them", they: "they", them: "them", their: "their", themself: "themself" },
    she: { id: "she", name: "she / her", they: "she", them: "her", their: "her", themself: "herself" },
    he: { id: "he", name: "he / him", they: "he", them: "him", their: "his", themself: "himself" },
  };

export const AGES: Record<AgeId, Labeled<AgeId> & { bonus: Partial<Stats> }> = {
  youth: {
    id: "youth",
    name: "Unseasoned",
    blurb: "The Veil is still a new insult. You learn fast and sleep badly.",
    bonus: { cunning: 1 },
  },
  sworn: {
    id: "sworn",
    name: "Sworn",
    blurb: "Old enough to have a name people use as a warning. Young enough to still want one.",
    bonus: {},
  },
  weathered: {
    id: "weathered",
    name: "Weathered",
    blurb: "Your joints keep a ledger. Presence is cheaper when you have already buried people.",
    bonus: { presence: 1 },
  },
};

export const HAIR: Record<HairId, Labeled<HairId> & { color: string }> = {
  cropped: { id: "cropped", name: "Cropped", blurb: "A practical cut. Less for hands to grab.", color: "#2a1810" },
  long: { id: "long", name: "Long", blurb: "It remembers every weather you walked through.", color: "#3d2418" },
  braided: { id: "braided", name: "Braided", blurb: "Order, as a kind of prayer.", color: "#1a0e08" },
  wild: { id: "wild", name: "Wild", blurb: "It argues with combs and wins.", color: "#6b3418" },
  shorn: { id: "shorn", name: "Shorn", blurb: "Recently. On purpose. Or not.", color: "#5a5048" },
  veiled: { id: "veiled", name: "Veiled", blurb: "Cloth first, face second. The Veil appreciates the joke.", color: "#c9b48a" },
};

export const EYES: Record<EyeId, Labeled<EyeId> & { color: string }> = {
  ember: { id: "ember", name: "Ember", blurb: "Hearth-colored. People confess to you by accident.", color: "#c45c26" },
  sea: { id: "sea", name: "Tide", blurb: "Green-black, like water that has opinions.", color: "#2f7a78" },
  ink: { id: "ink", name: "Ink", blurb: "Archive-dark. They catalog whatever they look at.", color: "#3d4c8a" },
  gold: { id: "gold", name: "Coin", blurb: "Wrong for a human and somehow still yours.", color: "#d4b060" },
  pale: { id: "pale", name: "Pale", blurb: "Light that has been used already.", color: "#d8d4c8" },
};

export const SKIN: Record<SkinId, Labeled<SkinId> & { color: string }> = {
  fair: { id: "fair", name: "Fair", blurb: "Burns in honest sun. Thalorin has little of that.", color: "#e8d5c4" },
  warm: { id: "warm", name: "Warm", blurb: "Bread-crust, road-dust, living.", color: "#c48a5a" },
  olive: { id: "olive", name: "Olive", blurb: "The docks and the archives both claim this color.", color: "#8a6a48" },
  deep: { id: "deep", name: "Deep", blurb: "Night takes longer to find you.", color: "#4a2c1c" },
  ash: { id: "ash", name: "Ash-touched", blurb: "The cathedral left a fingerprint.", color: "#9a9088" },
};

export const MARKS: Record<MarkId, Labeled<MarkId> & { bonus: Partial<Stats>; wake: string }> = {
  none: {
    id: "none",
    name: "Unmarked",
    blurb: "The world has not written on your face yet. Give it time.",
    bonus: {},
    wake: "Your face is still an unpublished page.",
  },
  veil_burn: {
    id: "veil_burn",
    name: "Veil-burn",
    blurb: "A pale slash across the brow. It itches when you lie.",
    bonus: { aether: 1 },
    wake: "The burn on your brow is warm. It always is, at dusk.",
  },
  salt_scar: {
    id: "salt_scar",
    name: "Salt-scar",
    blurb: "A rope-kiss along the jaw. The tide keeps souvenirs.",
    bonus: { steel: 1 },
    wake: "The scar along your jaw tastes like weather.",
  },
  ink_web: {
    id: "ink_web",
    name: "Ink-web",
    blurb: "Letters under the skin of your wrist that will not stay still.",
    bonus: { cunning: 1 },
    wake: "The ink under your wrist rearranges itself into almost-your-name.",
  },
  cracked_gold: {
    id: "cracked_gold",
    name: "Cracked gilt",
    blurb: "A saint's flake in the hollow of your throat. It is not yours. It stayed.",
    bonus: { presence: 1 },
    wake: "The gilt at your throat ticks once, like a polite cough.",
  },
};

export const TEMPERS: Record<TemperId, Labeled<TemperId> & { adj: string; voice: string }> = {
  stoic: {
    id: "stoic",
    name: "Stoic",
    adj: "stoic",
    blurb: "Feelings arrive. You give them a chair and no tea.",
    voice: "You file the moment under later.",
  },
  wry: {
    id: "wry",
    name: "Wry",
    adj: "wry",
    blurb: "Humor as a shield. Sometimes as a knife. Often as both.",
    voice: "A joke almost gets out. You muzzle it, fondly.",
  },
  fervent: {
    id: "fervent",
    name: "Fervent",
    adj: "fervent",
    blurb: "You mean it. The world has not decided if that is a virtue.",
    voice: "Something in you leans forward, already promising.",
  },
  cold: {
    id: "cold",
    name: "Cold",
    adj: "cold",
    blurb: "Clarity without comfort. People thank you later, if they live.",
    voice: "You take the temperature of the room and do not share it.",
  },
  tender: {
    id: "tender",
    name: "Tender",
    adj: "tender",
    blurb: "You keep being kind as if it were a trade. It is not. You do it anyway.",
    voice: "You notice who has not been noticed, which is a kind of spell.",
  },
};

export const VIRTUES: Record<VirtueId, Labeled<VirtueId> & { stat: Stat }> = {
  mercy: {
    id: "mercy",
    name: "Mercy",
    blurb: "You leave doors unlatched. Healing listens to you.",
    stat: "presence",
  },
  duty: {
    id: "duty",
    name: "Duty",
    blurb: "The vow is a spine. You stand up straighter than the day.",
    stat: "vigor",
  },
  curiosity: {
    id: "curiosity",
    name: "Curiosity",
    blurb: "You open things that asked to stay shut. Aether likes that.",
    stat: "aether",
  },
  defiance: {
    id: "defiance",
    name: "Defiance",
    blurb: "You refuse the script. Steel, occasionally, applauds.",
    stat: "steel",
  },
  patience: {
    id: "patience",
    name: "Patience",
    blurb: "You wait until the seam shows. Cunning is just patience with teeth.",
    stat: "cunning",
  },
};

export const VICES: Record<ViceId, Labeled<ViceId> & { checkStat?: Stat; combat: string }> = {
  wrath: {
    id: "wrath",
    name: "Wrath",
    blurb: "When you are hurt, the world becomes simpler, and worse.",
    combat: "Low health makes your blows meaner.",
  },
  pride: {
    id: "pride",
    name: "Pride",
    blurb: "Fleeing feels like a spelling error in your name.",
    checkStat: "presence",
    combat: "Harder to flee. Presence checks come easier.",
  },
  greed: {
    id: "greed",
    name: "Greed",
    blurb: "You count. The counting is a comfort. The coin is a vote.",
    combat: "Victory pays you more than it should.",
  },
  doubt: {
    id: "doubt",
    name: "Doubt",
    blurb: "You test every floorboard. Sometimes that is why you don't fall.",
    checkStat: "cunning",
    combat: "Guarding gathers extra aether.",
  },
  hunger: {
    id: "hunger",
    name: "Hunger",
    blurb: "For food, for names, for the next page. Consumables love you.",
    combat: "Flasks and bread do more.",
  },
};

export const FEARS: Record<FearId, Labeled<FearId> & { place?: string }> = {
  drowning: {
    id: "drowning",
    name: "Drowning",
    blurb: "Not the water. The being-inside-it. Saltmoor knows.",
    place: "saltmoor",
  },
  forgetting: {
    id: "forgetting",
    name: "Being forgotten",
    blurb: "A nameless death. The Archives would call it a filing error.",
    place: "archives",
  },
  quiet: {
    id: "quiet",
    name: "The quiet",
    blurb: "When the world stops answering. The wood can do that.",
    place: "veilwood",
  },
  mirrors: {
    id: "mirrors",
    name: "Mirrors",
    blurb: "You, looking back, already decided. The Rift is made of this.",
    place: "rift",
  },
  kindness: {
    id: "kindness",
    name: "Kindness",
    blurb: "It can be a hook. Mira's inn is full of it. That is the problem.",
    place: "emberhearth",
  },
};

export const DRIVES: Record<DriveId, Labeled<DriveId> & { ending: string }> = {
  mend: {
    id: "mend",
    name: "To mend",
    blurb: "Put the nails back. Make a world that can keep a child.",
    ending: "You always meant to mend it. The meaning survives the cost.",
  },
  know: {
    id: "know",
    name: "To know",
    blurb: "The true name of the tear. Even if it names you back.",
    ending: "You got the answer. It is heavier than the question. You carry it anyway.",
  },
  avenge: {
    id: "avenge",
    name: "To avenge",
    blurb: "Someone is owed a shape of justice. You volunteered to be the shape.",
    ending: "The debt is paid in a currency nobody else can spend.",
  },
  belong: {
    id: "belong",
    name: "To belong",
    blurb: "A place that does not flinch when you come home.",
    ending: "Home is a verb. You kept doing it until the world agreed.",
  },
  unmake: {
    id: "unmake",
    name: "To unmake",
    blurb: "Some structures are kindnesses to demolish.",
    ending: "You took it apart. The pieces are honest now, if nothing else.",
  },
};

export const KITS: Record<KitId, Labeled<KitId> & { items: string[]; gold: number }> = {
  field: {
    id: "field",
    name: "Field kit",
    blurb: "Flasks, bread, the assumption you will be hit.",
    items: ["emberflask", "travel_bread"],
    gold: 0,
  },
  scholar: {
    id: "scholar",
    name: "Scholar's pouch",
    blurb: "Tea that makes the Veil lean in. Notes you will not show.",
    items: ["aether_tea"],
    gold: 4,
  },
  cutthroat: {
    id: "cutthroat",
    name: "Cutthroat's belt",
    blurb: "Smoke, an exit, and the manners of an alley.",
    items: ["smoke_vial"],
    gold: 8,
  },
  pilgrim: {
    id: "pilgrim",
    name: "Pilgrim's charm",
    blurb: "A coin with a hole. Faith, or the rumor of it.",
    items: ["ward_charm", "travel_bread"],
    gold: 0,
  },
};

export function emptySpent(): Stats {
  return { vigor: 0, aether: 0, steel: 0, cunning: 0, presence: 0 };
}

export function spentTotal(spent: Stats): number {
  return STAT_KEYS.reduce((n, k) => n + spent[k], 0);
}

export function clampSpent(spent: Partial<Stats>): Stats {
  const out = emptySpent();
  let left = POINT_BUY;
  for (const key of STAT_KEYS) {
    const want = Math.max(0, Math.min(POINT_CAP, Math.floor(spent[key] ?? 0)));
    const take = Math.min(want, left);
    out[key] = take;
    left -= take;
  }
  return out;
}

export function addPartial(stats: Stats, bonus: Partial<Stats> | undefined): Stats {
  const next = { ...stats };
  if (!bonus) return next;
  for (const key of STAT_KEYS) {
    next[key] += bonus[key] ?? 0;
  }
  return next;
}

export function driveVerb(id: DriveId): string {
  return DRIVES[id].name.replace(/^to\s+/i, "").toLowerCase();
}

export function generateEpithet(classId: ClassId, temper: TemperId, drive: DriveId): string {
  return `${TEMPERS[temper].adj} ${CLASSES[classId].name} who would ${driveVerb(drive)}`;
}

export function defaultIdentity(classId: ClassId, originId: OriginId): Identity {
  const signatureSkill = CLASSES[classId].skills[0] ?? "rend";
  const kit: KitId =
    classId === "hexweaver" ? "scholar" : classId === "ashblade" ? "cutthroat" : classId === "oathbound" ? "pilgrim" : "field";
  const temper: TemperId =
    classId === "hexweaver" ? "wry" : classId === "ashblade" ? "cold" : classId === "oathbound" ? "fervent" : "stoic";
  const virtue: VirtueId =
    classId === "hexweaver" ? "curiosity" : classId === "ashblade" ? "defiance" : classId === "oathbound" ? "duty" : "mercy";
  const vice: ViceId =
    classId === "hexweaver" ? "doubt" : classId === "ashblade" ? "wrath" : classId === "oathbound" ? "pride" : "hunger";
  const fear: FearId =
    originId === "runaway" ? "drowning" : originId === "apostate" ? "forgetting" : originId === "cindered" ? "mirrors" : originId === "veilborn" ? "quiet" : "kindness";
  const drive: DriveId =
    originId === "runaway" ? "avenge" : originId === "apostate" ? "know" : originId === "cindered" ? "unmake" : originId === "veilborn" ? "mend" : "belong";
  const hair: HairId =
    classId === "hexweaver" ? "veiled" : classId === "ashblade" ? "wild" : classId === "oathbound" ? "braided" : "cropped";
  const eyes: EyeId =
    classId === "hexweaver" ? "ink" : classId === "ashblade" ? "ember" : classId === "oathbound" ? "gold" : "sea";
  const skin: SkinId =
    originId === "runaway" ? "olive" : originId === "cindered" ? "ash" : originId === "apostate" ? "fair" : originId === "veilborn" ? "deep" : "warm";
  const mark: MarkId =
    originId === "runaway" ? "salt_scar" : originId === "apostate" ? "ink_web" : originId === "cindered" ? "cracked_gold" : originId === "veilborn" ? "veil_burn" : "none";
  const pronouns: PronounId = "they";
  const age: AgeId = "sworn";
  return {
    pronouns,
    age,
    temper,
    virtue,
    vice,
    fear,
    drive,
    hair,
    eyes,
    skin,
    mark,
    kit,
    signatureSkill,
    spent: emptySpent(),
    epithet: generateEpithet(classId, temper, drive),
  };
}

export function hydrateIdentity(raw: Partial<Identity> | undefined, classId: ClassId, originId: OriginId): Identity {
  const base = defaultIdentity(classId, originId);
  if (!raw) return base;
  const next: Identity = {
    ...base,
    ...raw,
    spent: clampSpent(raw.spent ?? base.spent),
  };
  if (!CLASSES[classId].skills.includes(next.signatureSkill)) {
    next.signatureSkill = base.signatureSkill;
  }
  next.epithet = generateEpithet(classId, next.temper, next.drive);
  return next;
}

export function they(id: Identity) {
  const p = PRONOUNS[id.pronouns];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    they: p.they,
    them: p.them,
    their: p.their,
    themself: p.themself,
    They: cap(p.they),
    Them: cap(p.them),
    Their: cap(p.their),
  };
}

export function identityCheckBonus(identity: Identity, stat: Stat): number {
  let n = 0;
  if (VIRTUES[identity.virtue].stat === stat) n += 1;
  if (VICES[identity.vice].checkStat === stat) n += 1;
  return n;
}
