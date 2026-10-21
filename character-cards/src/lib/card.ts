import { base64ToUtf8, extractPngText } from "./png";
import type {
  CardDraft,
  CardSource,
  DepthCard,
  LoreEntry,
  LorePosition,
  ParsedCard,
} from "./types";

export const DEFAULT_LORE_SCAN_DEPTH = 8;
export const DEFAULT_LORE_TOKEN_BUDGET = 800;
export const DEFAULT_DEPTH_PROMPT_DEPTH = 4;

export function emptyDraft(): CardDraft {
  return {
    name: "",
    age: 25,
    avatarDataUrl: null,
    tags: [],
    description: "",
    personality: "",
    scenario: "",
    firstMes: "",
    alternateGreetings: [],
    groupGreetings: [],
    mesExample: "",
    creatorNotes: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    depthPrompt: "",
    depthPromptDepth: DEFAULT_DEPTH_PROMPT_DEPTH,
    creator: "",
    characterVersion: "alpha-1",
    lore: [],
    loreScanDepth: DEFAULT_LORE_SCAN_DEPTH,
    loreTokenBudget: DEFAULT_LORE_TOKEN_BUDGET,
  };
}

export function emptyLoreEntry(order = 0): LoreEntry {
  return {
    id: newCardId(),
    name: "",
    keys: [],
    secondaryKeys: [],
    content: "",
    enabled: true,
    constant: false,
    selective: false,
    caseSensitive: false,
    insertionOrder: order,
    priority: 10,
    position: "before_char",
    depth: DEFAULT_DEPTH_PROMPT_DEPTH,
    comment: "",
  };
}

export function newCardId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asInt(value: unknown, fallback: number, min = 0, max = 10000): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readAge(extensions: unknown, fallbackFields: Record<string, unknown>): number | null {
  const ext = isRecord(extensions) ? extensions : {};
  const nested = isRecord(ext.character_companion) ? ext.character_companion : {};
  const candidates = [nested.age, ext.age, fallbackFields.age];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number.parseInt(value.trim(), 10);
    }
  }
  return null;
}

function readPosition(entry: Record<string, unknown>, ext: Record<string, unknown>): {
  position: LorePosition;
  depth: number;
} {
  const depth = asInt(ext.depth, DEFAULT_DEPTH_PROMPT_DEPTH, 0, 200);
  const extPos = ext.position;
  const specPos = asString(entry.position);
  if (extPos === 4 || extPos === "at_depth" || specPos === "at_depth") {
    return { position: "at_depth", depth };
  }
  if (extPos === 1 || specPos === "after_char") return { position: "after_char", depth };
  if (typeof extPos === "number" && extPos !== 0) return { position: "at_depth", depth };
  return { position: "before_char", depth };
}

function readLore(book: unknown): { entries: LoreEntry[]; scanDepth: number; tokenBudget: number } {
  if (!isRecord(book)) {
    return {
      entries: [],
      scanDepth: DEFAULT_LORE_SCAN_DEPTH,
      tokenBudget: DEFAULT_LORE_TOKEN_BUDGET,
    };
  }
  const rawEntries = Array.isArray(book.entries) ? book.entries : [];
  const entries: LoreEntry[] = [];
  rawEntries.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const ext = isRecord(raw.extensions) ? raw.extensions : {};
    const { position, depth } = readPosition(raw, ext);
    const secondaryKeys = asStringArray(raw.secondary_keys ?? raw.secondaryKeys);
    const idValue = raw.id;
    entries.push({
      id: typeof idValue === "string" && idValue ? idValue : `lore-${index + 1}`,
      name: asString(raw.name) || asString(raw.comment),
      keys: asStringArray(raw.keys),
      secondaryKeys,
      content: asString(raw.content),
      enabled: asBool(raw.enabled, true),
      constant: asBool(raw.constant, false),
      selective: asBool(raw.selective, false),
      caseSensitive: asBool(raw.case_sensitive ?? raw.caseSensitive, false),
      insertionOrder: asInt(raw.insertion_order ?? raw.insertionOrder, index, 0, 100000),
      priority: asInt(raw.priority, 10, -1000, 100000),
      position,
      depth,
      comment: asString(raw.comment),
    });
  });
  return {
    entries,
    scanDepth: asInt(book.scan_depth, DEFAULT_LORE_SCAN_DEPTH, 0, 200),
    tokenBudget: asInt(book.token_budget, DEFAULT_LORE_TOKEN_BUDGET, 0, 100000),
  };
}

function readDepthPrompt(extensions: unknown): { prompt: string; depth: number } {
  if (!isRecord(extensions) || !isRecord(extensions.depth_prompt)) {
    return { prompt: "", depth: DEFAULT_DEPTH_PROMPT_DEPTH };
  }
  const depthPrompt = extensions.depth_prompt;
  return {
    prompt: asString(depthPrompt.prompt),
    depth: asInt(depthPrompt.depth, DEFAULT_DEPTH_PROMPT_DEPTH, 0, 200),
  };
}

function readAvatar(data: Record<string, unknown>, extensions: Record<string, unknown>): string | null {
  const nested = isRecord(extensions.character_companion) ? extensions.character_companion : {};
  const fromExt = asString(nested.avatarDataUrl);
  if (fromExt.startsWith("data:image/")) return fromExt;
  if (!Array.isArray(data.assets)) return null;
  for (const asset of data.assets) {
    if (!isRecord(asset)) continue;
    const uri = asString(asset.uri);
    if (uri.startsWith("data:image/")) return uri;
  }
  return null;
}

function draftFromData(data: Record<string, unknown>, source: CardSource): ParsedCard {
  const name = asString(data.name).trim();
  if (!name) throw new Error("Card is missing a name.");

  const extensions = isRecord(data.extensions) ? data.extensions : {};
  const nested = isRecord(extensions.character_companion) ? extensions.character_companion : {};
  const lore = readLore(data.character_book);
  const depthPrompt = readDepthPrompt(extensions);
  const age = readAge(extensions, data);
  const preservedId = asString(nested.id).trim();

  const draft: CardDraft = {
    ...emptyDraft(),
    name,
    age: age ?? 0,
    avatarDataUrl: readAvatar(data, extensions),
    tags: asStringArray(data.tags),
    description: asString(data.description),
    personality: asString(data.personality),
    scenario: asString(data.scenario),
    firstMes: asString(data.first_mes),
    alternateGreetings: asStringArray(data.alternate_greetings),
    groupGreetings: asStringArray(
      data.group_only_greetings ?? nested.group_greetings,
    ),
    mesExample: asString(data.mes_example),
    creatorNotes: asString(data.creator_notes ?? data.creatorcomment),
    systemPrompt: asString(data.system_prompt),
    postHistoryInstructions: asString(data.post_history_instructions),
    depthPrompt: depthPrompt.prompt,
    depthPromptDepth: depthPrompt.depth,
    creator: asString(data.creator),
    characterVersion: asString(data.character_version) || "alpha-1",
    lore: lore.entries,
    loreScanDepth: lore.scanDepth,
    loreTokenBudget: lore.tokenBudget,
  };

  return { draft, source, preservedId: preservedId || null };
}

export function parseCharacterCard(raw: unknown): ParsedCard {
  if (!isRecord(raw)) throw new Error("Character card must be a JSON object.");

  if (raw.spec === "chara_card_v3" || raw.spec === "chara_card_v2" || isRecord(raw.data)) {
    const data = isRecord(raw.data) ? raw.data : raw;
    const source: CardSource = raw.spec === "chara_card_v3" ? "v3" : "v2";
    return draftFromData(data, source);
  }

  return draftFromData(raw, "v1");
}

export function parseCharacterCardJson(text: string): ParsedCard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (Array.isArray(raw)) {
    throw new Error("That file is a library backup. Use Import on the library page.");
  }
  return parseCharacterCard(raw);
}

export type LibraryBackupCard = ParsedCard & { updatedAt: number | null };

export function parseLibraryPayload(raw: unknown): LibraryBackupCard[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => ({ ...parseCharacterCard(item), updatedAt: null }));
  }
  if (isRecord(raw) && Array.isArray(raw.cards)) {
    return raw.cards.map((item) => {
      const parsed = parseCharacterCard(item);
      const updatedAt =
        isRecord(item) && typeof item.updatedAt === "number" ? item.updatedAt : null;
      return { ...parsed, updatedAt };
    });
  }
  return [{ ...parseCharacterCard(raw), updatedAt: null }];
}

export async function parsePngCharacterCard(bytes: Uint8Array): Promise<ParsedCard> {
  const chunks = await extractPngText(bytes);
  const encoded = chunks.ccv3 || chunks.chara;
  if (!encoded) {
    throw new Error("This PNG has no SillyTavern character data (no chara or ccv3 text).");
  }
  let json: string;
  try {
    json = base64ToUtf8(encoded);
  } catch {
    throw new Error("The character data inside this PNG is not valid base64.");
  }
  return parseCharacterCardJson(json);
}

function loreToExport(entry: LoreEntry, index: number) {
  const positionCode = entry.position === "after_char" ? 1 : entry.position === "at_depth" ? 4 : 0;
  return {
    keys: entry.keys,
    secondary_keys: entry.secondaryKeys,
    content: entry.content,
    enabled: entry.enabled,
    insertion_order: entry.insertionOrder,
    case_sensitive: entry.caseSensitive,
    name: entry.name,
    priority: entry.priority,
    id: entry.id || index,
    comment: entry.comment || entry.name,
    selective: entry.selective,
    constant: entry.constant,
    position: entry.position === "after_char" ? "after_char" : "before_char",
    extensions: {
      depth: entry.depth,
      position: positionCode,
    },
  };
}

export function characterToV2Card(character: DepthCard | (CardDraft & { id?: string })) {
  const id = "id" in character ? character.id : undefined;
  return {
    spec: "chara_card_v2" as const,
    spec_version: "2.0" as const,
    data: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      first_mes: character.firstMes,
      mes_example: character.mesExample,
      creator_notes: character.creatorNotes,
      system_prompt: character.systemPrompt,
      post_history_instructions: character.postHistoryInstructions,
      alternate_greetings: character.alternateGreetings,
      group_only_greetings: character.groupGreetings,
      tags: character.tags,
      creator: character.creator,
      character_version: character.characterVersion || "alpha-1",
      character_book: {
        name: `${character.name} lore`,
        description: "Lore entries for the in-depth alpha card.",
        scan_depth: character.loreScanDepth,
        token_budget: character.loreTokenBudget,
        recursive_scanning: false,
        extensions: {},
        entries: character.lore.map(loreToExport),
      },
      extensions: {
        depth_prompt: {
          prompt: character.depthPrompt,
          depth: character.depthPromptDepth,
          role: "system",
        },
        character_companion: {
          age: character.age,
          id: id ?? "",
          group_greetings: character.groupGreetings,
          avatarDataUrl: character.avatarDataUrl,
        },
      },
    },
  };
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function cardFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "character"}-card.json`;
}
