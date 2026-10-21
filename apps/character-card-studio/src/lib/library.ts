import { permanentTokens } from "./quality";
import type { Character } from "./types";

export type SortKey = "updated" | "created" | "name" | "tokens";

export type LibraryQuery = {
  search: string;
  tags: string[];
  favoritesOnly: boolean;
  sort: SortKey;
};

export const DEFAULT_QUERY: LibraryQuery = {
  search: "",
  tags: [],
  favoritesOnly: false,
  sort: "updated",
};

function haystack(character: Character): string {
  return [
    character.name,
    character.nickname,
    character.creator,
    character.description,
    character.personality,
    character.profile.occupation,
    character.profile.species,
    character.rpg.enabled ? `${character.rpg.race} ${character.rpg.className}` : "",
    ...character.tags,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterLibrary(characters: Character[], query: LibraryQuery): Character[] {
  const terms = query.search.toLowerCase().split(/\s+/).filter(Boolean);
  const wantedTags = query.tags.map((tag) => tag.toLowerCase());
  const filtered = characters.filter((character) => {
    if (query.favoritesOnly && !character.favorite) return false;
    const tags = character.tags.map((tag) => tag.toLowerCase());
    if (!wantedTags.every((tag) => tags.includes(tag))) return false;
    if (terms.length === 0) return true;
    const text = haystack(character);
    return terms.every((term) => text.includes(term));
  });

  const sorted = [...filtered];
  switch (query.sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "created":
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "tokens":
      sorted.sort((a, b) => permanentTokens(b) - permanentTokens(a));
      break;
    default:
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return sorted;
}

/** Tags with how many cards use them, most common first. */
export function tagCounts(characters: Character[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const character of characters) {
    for (const tag of new Set(character.tags.map((t) => t.toLowerCase()))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function normalizeTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

export type LibraryBackup = {
  format: "card-studio-library";
  version: 1;
  exportedAt: string;
  characters: Character[];
};

export function makeBackup(characters: Character[]): LibraryBackup {
  return {
    format: "card-studio-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    characters,
  };
}

export function isBackup(value: unknown): value is LibraryBackup {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as LibraryBackup).format === "card-studio-library" &&
    Array.isArray((value as LibraryBackup).characters)
  );
}
