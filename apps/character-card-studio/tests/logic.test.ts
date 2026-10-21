import { describe, expect, it } from "vitest";
import { emptyLorebook, newCharacter, newLoreEntry } from "../src/lib/defaults";
import { filterLibrary, normalizeTags, tagCounts, DEFAULT_QUERY } from "../src/lib/library";
import { activateLore, keyMatches } from "../src/lib/lore";
import { abilityModifier } from "../src/lib/profile";
import { applyMacros, buildPromptPreview } from "../src/lib/prompt";
import { checkQuality } from "../src/lib/quality";
import { checkCharacterSafety } from "../src/lib/safety";
import { seedCharacters } from "../src/lib/seed";

describe("safety", () => {
  it("allows adults and blocks minors by age or wording", () => {
    expect(checkCharacterSafety(newCharacter({ name: "A", age: 25 })).ok).toBe(true);
    expect(checkCharacterSafety(newCharacter({ name: "A", age: 17 })).ok).toBe(false);
    expect(checkCharacterSafety(newCharacter({ name: "A", age: 30, description: "a 15 year old" })).ok).toBe(false);
    const hidden = newCharacter({ name: "A", age: 30 });
    hidden.profile.backstory = "attends middle school";
    expect(checkCharacterSafety(hidden).ok).toBe(false);
  });

  it("passes every seeded card", () => {
    for (const c of seedCharacters()) expect(checkCharacterSafety(c)).toEqual({ ok: true });
  });
});

describe("lorebook", () => {
  const book = () => {
    const b = emptyLorebook();
    b.entries = [
      { ...newLoreEntry(1), keys: ["dragon"], content: "Dragons sleep under the hill." },
      { ...newLoreEntry(2), keys: ["/k(i|y)ng/i"], content: "The king is ill." },
      { ...newLoreEntry(3), constant: true, content: "It is always winter." },
      { ...newLoreEntry(4), keys: ["sword"], secondaryKeys: ["broken"], selective: true, content: "The broken sword." },
      { ...newLoreEntry(5), keys: ["hill"], content: "The hill hums at night." },
    ];
    return b;
  };

  it("triggers by key, regex, constant, and selective secondary keys", () => {
    const ids = (text: string) => activateLore(book(), text).active.map((e) => e.insertionOrder);
    expect(ids("nothing here")).toEqual([3]);
    expect(ids("A DRAGON and a Kyng")).toEqual([1, 2, 3]);
    expect(ids("my sword")).toEqual([3]);
    expect(ids("my broken sword")).toEqual([3, 4]);
  });

  it("recursive scanning lets triggered lore trigger more lore", () => {
    const b = book();
    expect(activateLore(b, "dragon").active.map((e) => e.insertionOrder)).toEqual([1, 3]);
    b.recursiveScanning = true;
    expect(activateLore(b, "dragon").active.map((e) => e.insertionOrder)).toEqual([1, 3, 5]);
  });

  it("drops low-priority entries over the token budget", () => {
    const b = book();
    b.tokenBudget = 8;
    b.entries[0].priority = 1;
    const result = activateLore(b, "dragon");
    expect(result.droppedForBudget.map((e) => e.insertionOrder)).toEqual([1]);
  });

  it("handles invalid regex keys safely", () => {
    expect(keyMatches("/[/", "anything", false)).toBe(false);
  });
});

describe("prompt + quality", () => {
  it("replaces macros", () => {
    expect(applyMacros("{{char}} waves at {{user}} <USER>", "Mira", "Del")).toBe("Mira waves at Del Del");
  });

  it("shows triggered lore in the prompt preview", () => {
    const [, brannoc] = seedCharacters();
    const preview = buildPromptPreview(brannoc, "Del", "Tell me about the Cinder Oath.");
    const lore = preview.sections.find((s) => s.label === "Lore (before character)");
    expect(lore?.text).toContain("Cinder Oath");
    expect(preview.totalTokens).toBeGreaterThan(100);
  });

  it("scores seeded cards highly and empty cards low", () => {
    for (const c of seedCharacters()) expect(checkQuality(c).score).toBeGreaterThanOrEqual(85);
    const empty = checkQuality(newCharacter());
    expect(empty.score).toBeLessThan(20);
    expect(empty.tips.some((t) => t.level === "error")).toBe(true);
  });

  it("computes D&D ability modifiers", () => {
    expect([8, 10, 11, 15, 18].map(abilityModifier)).toEqual([-1, 0, 0, 2, 4]);
  });
});

describe("library", () => {
  const chars = seedCharacters();
  chars[2].favorite = true;

  it("searches across name, tags, profile, and RPG class", () => {
    const names = (search: string) => filterLibrary(chars, { ...DEFAULT_QUERY, search }).map((c) => c.name);
    expect(names("cleric")).toEqual(["Brannoc Ashvale"]);
    expect(names("cartographer")).toEqual(["Mira Vale"]);
    expect(names("half-elf bard")).toEqual(["Sera Quill"]);
  });

  it("filters by all selected tags and favorites, and sorts", () => {
    expect(filterLibrary(chars, { ...DEFAULT_QUERY, tags: ["dnd", "sfw"] })).toHaveLength(2);
    expect(filterLibrary(chars, { ...DEFAULT_QUERY, favoritesOnly: true }).map((c) => c.name)).toEqual(["Sera Quill"]);
    expect(filterLibrary(chars, { ...DEFAULT_QUERY, sort: "name" }).map((c) => c.name)).toEqual([
      "Brannoc Ashvale",
      "Mira Vale",
      "Sera Quill",
    ]);
  });

  it("counts and normalizes tags", () => {
    expect(tagCounts(chars)[0]).toEqual(["sfw", 3]);
    expect(normalizeTags(" Fantasy, dnd,,fantasy ")).toEqual(["fantasy", "dnd"]);
  });
});
