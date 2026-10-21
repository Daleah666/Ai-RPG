import { describe, expect, it } from "vitest";
import { SEED_CHARACTERS } from "../src/data/library";
import { filterLibrary } from "../src/lib/library-index";
import { buildPrompt, selectLore } from "../src/lib/prompt";
import type { DepthCard, LoreEntry } from "../src/lib/types";

function cardWith(lore: LoreEntry[], budget = 800): DepthCard {
  const base = SEED_CHARACTERS[0];
  if (!base) throw new Error("missing seed");
  return { ...base, lore, loreTokenBudget: budget, loreScanDepth: 4, depthPrompt: "", postHistoryInstructions: "" };
}

describe("depth prompt", () => {
  it("puts a depth note four messages above the bottom", () => {
    const mira = SEED_CHARACTERS.find((card) => card.name === "Mira Vale");
    if (!mira) throw new Error("missing Mira");
    const history = [1, 2, 3, 4, 5].map((n) => ({
      id: String(n),
      role: "user" as const,
      content: `line ${n}`,
      createdAt: n,
    }));
    const messages = buildPrompt({ ...mira, lore: [] }, "Del", history);
    const depthIndex = messages.findIndex((message) => message.content.startsWith("[Depth note]"));
    const lastUser = messages.findIndex((message) => message.content === "line 5");
    expect(depthIndex).toBeGreaterThan(0);
    expect(lastUser - depthIndex).toBe(4);
    expect(messages.at(-1)?.content).toContain("[After the chat]");
    expect(messages[0]?.content).toContain("Del");
  });

  it("lifts the note to the top when the chat is shorter than the depth", () => {
    const mira = SEED_CHARACTERS.find((card) => card.name === "Mira Vale");
    if (!mira) throw new Error("missing Mira");
    const messages = buildPrompt(
      { ...mira, lore: [], postHistoryInstructions: "" },
      "Del",
      [{ id: "1", role: "user", content: "tea", createdAt: 1 }],
    );
    expect(messages[1]?.content).toContain("[Depth note]");
    expect(messages[2]?.content).toBe("tea");
  });

  it("includes keyed lore only when the key is in the scan, and keeps constants first", () => {
    const lore: LoreEntry[] = [
      {
        id: "always",
        name: "Always",
        keys: [],
        secondaryKeys: [],
        content: "Constant fact.",
        enabled: true,
        constant: true,
        selective: false,
        caseSensitive: false,
        insertionOrder: 0,
        priority: 1,
        position: "before_char",
        depth: 4,
        comment: "",
      },
      {
        id: "harbor",
        name: "Harbor",
        keys: ["harbor"],
        secondaryKeys: [],
        content: "The fish market closes at dusk.",
        enabled: true,
        constant: false,
        selective: false,
        caseSensitive: false,
        insertionOrder: 1,
        priority: 1,
        position: "at_depth",
        depth: 1,
        comment: "",
      },
    ];
    const card = cardWith(lore);
    const quiet = buildPrompt(card, "Del", [{ id: "1", role: "user", content: "tea please", createdAt: 1 }]);
    expect(quiet[0]?.content).toContain("Constant fact.");
    expect(quiet.some((message) => message.content.includes("fish market"))).toBe(false);

    const hit = buildPrompt(card, "Del", [{ id: "1", role: "user", content: "Tell me about the harbor", createdAt: 1 }]);
    expect(hit.some((message) => message.content.includes("fish market"))).toBe(true);
    const market = hit.findIndex((message) => message.content.includes("fish market"));
    const user = hit.findIndex((message) => message.content.includes("harbor"));
    expect(market).toBeLessThan(user);
  });

  it("requires the second key when an entry is selective", () => {
    const entry: LoreEntry = {
      id: "glass",
      name: "Glass",
      keys: ["name"],
      secondaryKeys: ["read"],
      content: "Read the name once.",
      enabled: true,
      constant: false,
      selective: true,
      caseSensitive: false,
      insertionOrder: 0,
      priority: 1,
      position: "before_char",
      depth: 2,
      comment: "",
    };
    const card = cardWith([entry]);
    expect(selectLore(card, "a name in the drawer").map((item) => item.id)).toEqual([]);
    expect(selectLore(card, "read the name").map((item) => item.id)).toEqual(["glass"]);
  });

  it("skips later lore that does not fit the budget", () => {
    const big = "x".repeat(40);
    const lore: LoreEntry[] = [0, 1].map((index) => ({
      id: `e${index}`,
      name: `E${index}`,
      keys: [],
      secondaryKeys: [],
      content: big,
      enabled: true,
      constant: true,
      selective: false,
      caseSensitive: false,
      insertionOrder: index,
      priority: 1,
      position: "before_char" as const,
      depth: 1,
      comment: "",
    }));
    const kept = selectLore(cardWith(lore, 12), "");
    expect(kept.map((entry) => entry.id)).toEqual(["e0"]);
  });
});

describe("library search", () => {
  it("finds cards by lore keys and shelf", () => {
    expect(filterLibrary(SEED_CHARACTERS, "elbow", "all").map((card) => card.name)).toEqual(["Sable Rook"]);
    expect(filterLibrary(SEED_CHARACTERS, "altar", "all").map((card) => card.name)).toEqual([
      "Sylvene Nightpurse",
    ]);
    expect(filterLibrary(SEED_CHARACTERS, "", "craft").map((card) => card.name)).toEqual(["Sable Rook"]);
    expect(filterLibrary(SEED_CHARACTERS, "", "nsfw").every((card) => card.tags.includes("nsfw"))).toBe(true);
    expect(filterLibrary(SEED_CHARACTERS, "", "sfw").some((card) => card.tags.includes("nsfw"))).toBe(false);
  });
});
