import type { DepthCard } from "./types";

export type Shelf = "all" | "sfw" | "nsfw" | "rpg" | "cozy" | "craft";

export const SHELVES: { id: Shelf; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sfw", label: "SFW" },
  { id: "rpg", label: "RPG" },
  { id: "cozy", label: "Cozy" },
  { id: "craft", label: "Craft" },
  { id: "nsfw", label: "Adult" },
];

export function cardSearchText(card: DepthCard): string {
  return [
    card.name,
    card.description,
    card.personality,
    card.scenario,
    card.creatorNotes,
    card.depthPrompt,
    ...card.tags,
    ...card.lore.flatMap((entry) => [entry.name, entry.content, entry.comment, ...entry.keys]),
  ]
    .join("\n")
    .toLowerCase();
}

export function cardOnShelf(card: DepthCard, shelf: Shelf): boolean {
  if (shelf === "all") return true;
  return card.tags.includes(shelf);
}

export function filterLibrary(cards: DepthCard[], query: string, shelf: Shelf): DepthCard[] {
  const needle = query.trim().toLowerCase();
  return cards
    .filter((card) => cardOnShelf(card, shelf))
    .filter((card) => (needle ? cardSearchText(card).includes(needle) : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function libraryStats(cards: DepthCard[]): { cards: number; lore: number } {
  return {
    cards: cards.length,
    lore: cards.reduce((sum, card) => sum + card.lore.length, 0),
  };
}
