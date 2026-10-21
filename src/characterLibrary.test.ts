import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteCharacter,
  duplicateCharacter,
  exportCharacters,
  importCharacters,
  loadCharacters,
  saveCharacter,
  toggleFavorite,
} from "./characterLibrary";
import { defaultIdentity } from "./content/identity";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("character library", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it("includes polished starter cards", () => {
    const starters = loadCharacters().filter((card) => card.starter);
    expect(starters.length).toBeGreaterThanOrEqual(3);
    expect(starters.every((card) => card.notes.backstory.length > 20)).toBe(true);
  });

  it("saves, favorites, duplicates, and deletes user cards", () => {
    const saved = saveCharacter({
      name: "Nyx",
      classId: "hexweaver",
      originId: "runaway",
      identity: defaultIdentity("hexweaver", "runaway"),
      notes: { concept: "A dangerous rumor.", appearance: "", backstory: "", bonds: "", voice: "" },
    });
    toggleFavorite(saved.id);
    expect(loadCharacters().find((card) => card.id === saved.id)?.favorite).toBe(true);

    const copy = duplicateCharacter(saved);
    expect(copy.name).toContain("echo");
    expect(loadCharacters().filter((card) => !card.starter)).toHaveLength(2);

    deleteCharacter(saved.id);
    expect(loadCharacters().some((card) => card.id === saved.id)).toBe(false);
  });

  it("round-trips exported cards and rejects malformed imports", () => {
    const card = saveCharacter({
      name: "Seren",
      classId: "oathbound",
      originId: "cindered",
      identity: defaultIdentity("oathbound", "cindered"),
      notes: { concept: "", appearance: "", backstory: "Ash and vows.", bonds: "", voice: "" },
    });
    const json = exportCharacters([card]);
    localStorage.clear();
    expect(importCharacters(json)).toBe(1);
    expect(loadCharacters().some((entry) => entry.name === "Seren" && !entry.starter)).toBe(true);
    expect(() => importCharacters('{"name":"Broken","classId":"nope"}')).toThrow();
  });
});
