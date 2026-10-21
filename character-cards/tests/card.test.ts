import { describe, expect, it } from "vitest";
import { SEED_CHARACTERS } from "../src/data/library";
import {
  characterToV2Card,
  parseCharacterCard,
  parseCharacterCardJson,
  parseLibraryPayload,
  parsePngCharacterCard,
} from "../src/lib/card";
import { base64ToUtf8, extractPngText, injectPngText, utf8ToBase64 } from "../src/lib/png";
import { evaluateCharacterSafety } from "../src/lib/safety";

const MIN_PNG = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0,
  144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 0, 3, 0, 1, 0, 5,
  254, 2, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

describe("character cards", () => {
  it("round-trips lore, depth, and alternate greetings", () => {
    const mira = SEED_CHARACTERS.find((card) => card.id === "seed-mira-vale");
    if (!mira) throw new Error("missing Mira");
    const exported = characterToV2Card(mira);
    const parsed = parseCharacterCard(exported);
    expect(parsed.source).toBe("v2");
    expect(parsed.preservedId).toBe(mira.id);
    expect(parsed.draft.age).toBe(32);
    expect(parsed.draft.depthPrompt).toContain("Rain on the shop glass");
    expect(parsed.draft.depthPromptDepth).toBe(4);
    expect(parsed.draft.alternateGreetings).toHaveLength(1);
    expect(parsed.draft.lore.map((entry) => entry.name)).toEqual([
      "Vale & Compass",
      "Rainwharf",
      "Silt Choir",
    ]);
    const rain = parsed.draft.lore.find((entry) => entry.name === "Rainwharf");
    expect(rain?.keys).toContain("harbor");
    expect(parsed.draft.systemPrompt).toContain("shopkeeper");
  });

  it("reads a v3 book entry that sits at depth", () => {
    const parsed = parseCharacterCard({
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Tess Marin",
        tags: ["sfw"],
        description: "A 34-year-old ferry clerk.",
        extensions: {
          depth_prompt: { prompt: "Keep the timetable.", depth: 2, role: "system" },
          character_companion: { age: 34, id: "tess" },
        },
        character_book: {
          scan_depth: 6,
          token_budget: 400,
          entries: [
            {
              keys: ["ferry"],
              content: "The noon ferry is late when the fog sits on the bar.",
              enabled: true,
              insertion_order: 3,
              extensions: { position: 4, depth: 2 },
            },
          ],
        },
        group_only_greetings: ["The group is already on the dock."],
      },
    });
    expect(parsed.source).toBe("v3");
    expect(parsed.draft.depthPromptDepth).toBe(2);
    expect(parsed.draft.lore[0]?.position).toBe("at_depth");
    expect(parsed.draft.lore[0]?.depth).toBe(2);
    expect(parsed.draft.loreScanDepth).toBe(6);
    expect(parsed.draft.groupGreetings).toEqual(["The group is already on the dock."]);
    expect(parsed.preservedId).toBe("tess");
  });

  it("parses a flat v1 card", () => {
    const parsed = parseCharacterCardJson(
      JSON.stringify({
        name: "Old Card",
        first_mes: "Hello.",
        creatorcomment: "A note.",
        extensions: { character_companion: { age: 40 } },
      }),
    );
    expect(parsed.source).toBe("v1");
    expect(parsed.draft.creatorNotes).toBe("A note.");
    expect(parsed.draft.age).toBe(40);
  });

  it("reads a library backup and rejects junk", () => {
    const backup = parseLibraryPayload({
      format: "character-cards-depth-alpha",
      cards: [characterToV2Card(SEED_CHARACTERS[0])],
    });
    expect(backup).toHaveLength(1);
    expect(backup[0]?.draft.name).toBe(SEED_CHARACTERS[0]?.name);
    expect(() => parseCharacterCardJson("nope")).toThrow(/valid JSON/);
    expect(() => parseCharacterCardJson("[]")).toThrow(/library backup/);
  });

  it("reads a SillyTavern PNG chara chunk", async () => {
    const card = characterToV2Card(SEED_CHARACTERS[0]);
    const png = injectPngText(MIN_PNG, "chara", utf8ToBase64(JSON.stringify(card)));
    const chunks = await extractPngText(png);
    expect(base64ToUtf8(chunks.chara ?? "")).toContain("Mira Vale");
    const parsed = await parsePngCharacterCard(png);
    expect(parsed.draft.name).toBe("Mira Vale");
    expect(parsed.draft.lore.length).toBeGreaterThan(0);
    await expect(parsePngCharacterCard(MIN_PNG)).rejects.toThrow(/no chara/);
  });
});

describe("sample library", () => {
  it("is a full adult shelf with lore on every card", () => {
    expect(SEED_CHARACTERS).toHaveLength(11);
    const ids = new Set(SEED_CHARACTERS.map((card) => card.id));
    expect(ids.size).toBe(11);
    for (const card of SEED_CHARACTERS) {
      expect(card.age).toBeGreaterThanOrEqual(21);
      expect(card.firstMes.length).toBeGreaterThan(40);
      expect(card.depthPrompt.length).toBeGreaterThan(10);
      expect(card.lore.length).toBeGreaterThanOrEqual(3);
      expect(card.lore.some((entry) => entry.constant)).toBe(true);
      const safety = evaluateCharacterSafety(card);
      expect(safety).toEqual({ ok: true });
    }
  });
});
