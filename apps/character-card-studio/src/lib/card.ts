import { emptyLorebook, emptyProfile, emptyRpg, newCharacter, newId } from "./defaults";
import { ABILITY_KEYS, fullDescription, PROFILE_FIELDS } from "./profile";
import type { Character, LoreEntry, Lorebook, Profile, RpgSheet } from "./types";

export const STUDIO_EXT = "card_studio";

type CardBookEntry = {
  id?: number | string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  comment: string;
  name: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  case_sensitive: boolean;
  insertion_order: number;
  priority: number;
  position: "before_char" | "after_char";
  use_regex?: boolean;
  extensions: Record<string, unknown>;
};

export type CharacterBook = {
  name: string;
  description: string;
  scan_depth: number;
  token_budget: number;
  recursive_scanning: boolean;
  extensions: Record<string, unknown>;
  entries: CardBookEntry[];
};

type CardData = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  character_book?: CharacterBook;
  extensions: Record<string, unknown>;
};

export type TavernCardV2 = {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CardData;
};

export type TavernCardV3 = {
  spec: "chara_card_v3";
  spec_version: "3.0";
  data: CardData & {
    nickname: string;
    group_only_greetings: string[];
    creation_date: number;
    modification_date: number;
    assets: { type: string; uri: string; name: string; ext: string }[];
  };
};

export type CardFormat = "v1" | "v2" | "v3";

export type ParsedCard = {
  character: Character;
  format: CardFormat;
  /** False when the card had no age anywhere; the UI must ask before saving. */
  ageKnown: boolean;
};

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function strList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

const TEXT_AGE_RE = /\b(\d{2,4})\s*-?\s*(?:years?|yrs?)\s*-?\s*old\b/i;

function readAge(ext: Rec, data: Rec): number | null {
  const studio = isRecord(ext[STUDIO_EXT]) ? ext[STUDIO_EXT] : {};
  const companion = isRecord(ext.character_companion) ? ext.character_companion : {};
  for (const value of [studio.age, companion.age, ext.age, data.age]) {
    const n = num(value, Number.NaN);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  const text = [data.description, data.personality, data.scenario].map(str).join("\n");
  const match = text.match(TEXT_AGE_RE);
  return match ? Number.parseInt(match[1], 10) : null;
}

function readProfile(value: unknown): Profile {
  const profile = emptyProfile();
  if (!isRecord(value)) return profile;
  for (const { key } of PROFILE_FIELDS) profile[key] = str(value[key]);
  return profile;
}

function readRpg(value: unknown): RpgSheet {
  const rpg = emptyRpg();
  if (!isRecord(value)) return rpg;
  const abilities = isRecord(value.abilities) ? value.abilities : {};
  return {
    enabled: bool(value.enabled, false),
    race: str(value.race),
    className: str(value.className),
    level: num(value.level, 1),
    alignment: str(value.alignment),
    abilities: Object.fromEntries(
      ABILITY_KEYS.map((key) => [key, num(abilities[key], 10)]),
    ) as RpgSheet["abilities"],
    hp: num(value.hp, 10),
    ac: num(value.ac, 10),
    skills: str(value.skills),
    inventory: str(value.inventory),
    spells: str(value.spells),
  };
}

function readEntry(raw: unknown): LoreEntry | null {
  if (!isRecord(raw)) return null;
  const position = raw.position === "after_char" || raw.position === 1 ? "after_char" : "before_char";
  return {
    id: newId(),
    comment: str(raw.comment) || str(raw.name),
    keys: strList(raw.keys ?? raw.key),
    secondaryKeys: strList(raw.secondary_keys ?? raw.keysecondary),
    content: str(raw.content),
    enabled: raw.disable === true ? false : bool(raw.enabled, true),
    constant: bool(raw.constant, false),
    selective: bool(raw.selective, false),
    caseSensitive: bool(raw.case_sensitive, false),
    insertionOrder: num(raw.insertion_order ?? raw.order, 100),
    priority: num(raw.priority, 10),
    position,
  };
}

export function readCharacterBook(raw: unknown): Lorebook {
  const book = emptyLorebook();
  if (!isRecord(raw)) return book;
  // SillyTavern world-info exports use an object keyed by uid instead of an array.
  const rawEntries = Array.isArray(raw.entries)
    ? raw.entries
    : isRecord(raw.entries)
      ? Object.values(raw.entries)
      : [];
  return {
    name: str(raw.name),
    description: str(raw.description),
    scanDepth: num(raw.scan_depth, book.scanDepth),
    tokenBudget: num(raw.token_budget, book.tokenBudget),
    recursiveScanning: bool(raw.recursive_scanning, false),
    entries: rawEntries
      .map((entry) => readEntry(entry))
      .filter((entry): entry is LoreEntry => entry !== null),
  };
}

export function parseCard(raw: unknown): ParsedCard {
  if (!isRecord(raw)) throw new Error("A character card must be a JSON object.");

  let format: CardFormat = "v1";
  let data: Rec = raw;
  if (raw.spec === "chara_card_v3") {
    format = "v3";
    data = isRecord(raw.data) ? raw.data : {};
  } else if (raw.spec === "chara_card_v2" || isRecord(raw.data)) {
    format = "v2";
    data = isRecord(raw.data) ? raw.data : {};
  }

  const name = str(data.name).trim();
  if (!name) throw new Error("This card has no character name.");

  const ext: Rec = isRecord(data.extensions) ? { ...data.extensions } : {};
  const studio: Rec = isRecord(ext[STUDIO_EXT]) ? ext[STUDIO_EXT] : {};
  const age = readAge(ext, data);
  delete ext[STUDIO_EXT];
  delete ext.character_companion;

  const hasStudio = Object.keys(studio).length > 0;
  const character = newCharacter({
    name,
    nickname: str(data.nickname) || str(studio.nickname),
    age: age ?? 0,
    tags: strList(data.tags),
    creator: str(data.creator),
    version: str(data.character_version) || "1",
    // Studio exports append the profile to the description; restore the base text to avoid doubling it.
    description: hasStudio && typeof studio.base_description === "string"
      ? studio.base_description
      : str(data.description),
    personality: str(data.personality),
    scenario: str(data.scenario),
    firstMes: str(data.first_mes),
    alternateGreetings: strList(data.alternate_greetings),
    mesExample: str(data.mes_example),
    systemPrompt: str(data.system_prompt),
    postHistoryInstructions: str(data.post_history_instructions),
    creatorNotes: str(data.creator_notes) || str(data.creatorcomment),
    profile: readProfile(studio.profile),
    includeProfileInDescription: bool(studio.include_profile, true),
    rpg: readRpg(studio.rpg),
    lorebook: readCharacterBook(data.character_book),
    favorite: false,
    extraExtensions: ext,
  });

  return { character, format, ageKnown: age !== null };
}

export function parseCardJson(text: string): ParsedCard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  return parseCard(raw);
}

export function toCharacterBook(book: Lorebook, fallbackName: string): CharacterBook {
  return {
    name: book.name || `${fallbackName} lore`,
    description: book.description,
    scan_depth: book.scanDepth,
    token_budget: book.tokenBudget,
    recursive_scanning: book.recursiveScanning,
    extensions: {},
    entries: book.entries.map((entry, index) => ({
      id: index,
      keys: entry.keys,
      secondary_keys: entry.secondaryKeys,
      content: entry.content,
      comment: entry.comment,
      name: entry.comment,
      enabled: entry.enabled,
      constant: entry.constant,
      selective: entry.selective,
      case_sensitive: entry.caseSensitive,
      insertion_order: entry.insertionOrder,
      priority: entry.priority,
      position: entry.position,
      extensions: {},
    })),
  };
}

function cardData(character: Character): CardData {
  const data: CardData = {
    name: character.name,
    description: fullDescription(character),
    personality: character.personality,
    scenario: character.scenario,
    first_mes: character.firstMes,
    mes_example: character.mesExample,
    creator_notes: character.creatorNotes,
    system_prompt: character.systemPrompt,
    post_history_instructions: character.postHistoryInstructions,
    alternate_greetings: character.alternateGreetings.filter((g) => g.trim()),
    tags: character.tags,
    creator: character.creator,
    character_version: character.version,
    extensions: {
      ...character.extraExtensions,
      character_companion: { age: character.age },
      [STUDIO_EXT]: {
        age: character.age,
        nickname: character.nickname,
        base_description: character.description,
        include_profile: character.includeProfileInDescription,
        profile: character.profile,
        rpg: character.rpg,
      },
    },
  };
  if (character.lorebook.entries.length) {
    data.character_book = toCharacterBook(character.lorebook, character.name);
  }
  return data;
}

export function toV2Card(character: Character): TavernCardV2 {
  return { spec: "chara_card_v2", spec_version: "2.0", data: cardData(character) };
}

export function toV3Card(character: Character): TavernCardV3 {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      ...cardData(character),
      nickname: character.nickname,
      group_only_greetings: [],
      creation_date: Math.floor(character.createdAt / 1000),
      modification_date: Math.floor(character.updatedAt / 1000),
      assets: [{ type: "icon", uri: "ccdefault:", name: "main", ext: "png" }],
    },
  };
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
}
