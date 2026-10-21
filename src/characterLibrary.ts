import { defaultIdentity, hydrateIdentity } from "./content/identity";
import { CLASSES } from "./content/classes";
import { ORIGINS } from "./content/origins";
import type { CharacterCard, CharacterNotes, ClassId, Identity, OriginId } from "./types";

const LIBRARY_KEY = "aetherbound-character-library-v1";

export const emptyNotes = (): CharacterNotes => ({
  concept: "",
  appearance: "",
  backstory: "",
  bonds: "",
  voice: "",
});

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const STARTERS: CharacterCard[] = [
  starter("lysara", "Lysara Vell", "hexweaver", "apostate", {
    concept: "An exiled archivist who hears erased histories whisper from blank pages.",
    appearance: "Ink-dark braids, gold eyes, and a veil-burn branching over her left cheek.",
    backstory: "Lysara copied a forbidden sentence and discovered it was the name of something still alive beneath the Archives.",
    bonds: "Owes Mira a life; distrusts the Chronicler; protects young scholars from the order that cast her out.",
    voice: "Precise and dry. Turns frightened when she starts quoting text nobody else can see.",
  }),
  starter("rook", "Rook of Emberhearth", "warden", "foundling", {
    concept: "A village guardian who suspects the forest raised them for a purpose.",
    appearance: "Weathered, broad-shouldered, with cropped hair and a pale scar like a root across one palm.",
    backstory: "Found at the Veilwood edge, Rook has spent years defending the home that chose them.",
    bonds: "Mira is family. Every child in Emberhearth knows where Rook hides the honey cakes.",
    voice: "Patient, plain-spoken, and unexpectedly funny when danger is nearest.",
  }),
  starter("seren", "Seren Ashwake", "oathbound", "cindered", {
    concept: "A refugee carrying a holy vow they no longer believe, but cannot break.",
    appearance: "Warm skin, shorn hair, sea-blue eyes, and cracked gold fused at the throat.",
    backstory: "Seren fled the Cathedral after learning what its saints demand in exchange for miracles.",
    bonds: "Still writes letters to a sibling inside the Cathedral. Has never received an answer.",
    voice: "Formal in public, gentle in private. Never swears except in prayer.",
  }),
];

function starter(
  key: string,
  name: string,
  classId: ClassId,
  originId: OriginId,
  notes: CharacterNotes,
): CharacterCard {
  const identity = defaultIdentity(classId, originId);
  return {
    schemaVersion: 1,
    id: `starter-${key}`,
    name,
    classId,
    originId,
    identity,
    notes,
    favorite: false,
    starter: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function readUserCards(): CharacterCard[] {
  try {
    const parsed = JSON.parse(storage()?.getItem(LIBRARY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCard).filter((card): card is CharacterCard => card !== null);
  } catch {
    return [];
  }
}

function writeUserCards(cards: CharacterCard[]): void {
  try {
    storage()?.setItem(LIBRARY_KEY, JSON.stringify(cards.filter((card) => !card.starter)));
  } catch {
    throw new Error("The browser could not save this character library.");
  }
}

function normalizeCard(value: unknown): CharacterCard | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CharacterCard>;
  if (!raw.name || !raw.classId || !raw.originId) return null;
  if (!(raw.classId in CLASSES) || !(raw.originId in ORIGINS)) return null;
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: typeof raw.id === "string" && raw.id ? raw.id : id(),
    name: String(raw.name).slice(0, 48),
    classId: raw.classId,
    originId: raw.originId,
    identity: hydrateIdentity(raw.identity as Identity, raw.classId, raw.originId),
    notes: { ...emptyNotes(), ...(raw.notes ?? {}) },
    favorite: Boolean(raw.favorite),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}

export function loadCharacters(): CharacterCard[] {
  return [...STARTERS, ...readUserCards()];
}

export function saveCharacter(input: {
  name: string;
  classId: ClassId;
  originId: OriginId;
  identity: Identity;
  notes: CharacterNotes;
}): CharacterCard {
  const now = new Date().toISOString();
  const card: CharacterCard = {
    ...input,
    schemaVersion: 1,
    id: id(),
    name: input.name.trim() || "Bound One",
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
  writeUserCards([card, ...readUserCards()]);
  return card;
}

export function deleteCharacter(cardId: string): void {
  writeUserCards(readUserCards().filter((card) => card.id !== cardId));
}

export function toggleFavorite(cardId: string): void {
  writeUserCards(
    readUserCards().map((card) =>
      card.id === cardId ? { ...card, favorite: !card.favorite, updatedAt: new Date().toISOString() } : card,
    ),
  );
}

export function duplicateCharacter(source: CharacterCard): CharacterCard {
  return saveCharacter({
    name: `${source.name} — echo`,
    classId: source.classId,
    originId: source.originId,
    identity: structuredClone(source.identity),
    notes: structuredClone(source.notes),
  });
}

export function importCharacters(json: string): number {
  const value = JSON.parse(json) as unknown;
  const candidates = Array.isArray(value) ? value : [value];
  const imported = candidates.map(normalizeCard).filter((card): card is CharacterCard => card !== null);
  if (!imported.length) throw new Error("No valid Aetherbound character cards were found.");
  const existing = readUserCards();
  const fresh = imported.map((card) => ({
    ...card,
    id: id(),
    starter: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  writeUserCards([...fresh, ...existing]);
  return fresh.length;
}

export function exportCharacters(cards: CharacterCard[]): string {
  return JSON.stringify(cards.map(({ starter: _starter, ...card }) => card), null, 2);
}
