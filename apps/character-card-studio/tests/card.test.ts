import { describe, expect, it } from "vitest";
import { parseCard, parseCardJson, toV2Card, toV3Card } from "../src/lib/card";
import { newCharacter, newLoreEntry } from "../src/lib/defaults";
import { seedCharacters } from "../src/lib/seed";

describe("card import", () => {
  it("reads a flat v1 card", () => {
    const parsed = parseCard({
      name: "Ada",
      description: "Ada is a 30-year-old pilot.",
      first_mes: "Hi",
      creatorcomment: "notes",
    });
    expect(parsed.format).toBe("v1");
    expect(parsed.character.name).toBe("Ada");
    expect(parsed.character.creatorNotes).toBe("notes");
    expect(parsed.ageKnown).toBe(true);
    expect(parsed.character.age).toBe(30);
  });

  it("reads Character Companion v2 cards including the age extension", () => {
    const parsed = parseCard({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Mira",
        description: "desc",
        alternate_greetings: ["alt"],
        tags: ["cozy"],
        extensions: { character_companion: { age: 32 }, depth_prompt: { depth: 4 } },
      },
    });
    expect(parsed.format).toBe("v2");
    expect(parsed.character.age).toBe(32);
    expect(parsed.character.alternateGreetings).toEqual(["alt"]);
    expect(parsed.character.extraExtensions).toEqual({ depth_prompt: { depth: 4 } });
  });

  it("flags cards with no age so the UI can ask", () => {
    const parsed = parseCard({ spec: "chara_card_v2", data: { name: "Nobody", description: "A sailor." } });
    expect(parsed.ageKnown).toBe(false);
  });

  it("reads SillyTavern world-info style entries keyed by uid", () => {
    const parsed = parseCard({
      spec: "chara_card_v2",
      data: {
        name: "X",
        extensions: { age: 40 },
        character_book: {
          entries: { 0: { key: ["moon"], content: "The moon is green.", order: 5, disable: false } },
        },
      },
    });
    expect(parsed.character.lorebook.entries).toHaveLength(1);
    expect(parsed.character.lorebook.entries[0].keys).toEqual(["moon"]);
    expect(parsed.character.lorebook.entries[0].insertionOrder).toBe(5);
  });

  it("rejects cards without a name and bad JSON", () => {
    expect(() => parseCard({ data: { description: "x" } })).toThrow(/name/);
    expect(() => parseCardJson("{nope")).toThrow(/JSON/);
  });
});

describe("card export", () => {
  it("round-trips every studio field through v2 without doubling the profile", () => {
    const original = newCharacter({
      name: "Rhea",
      age: 41,
      description: "Base description.",
      tags: ["a", "b"],
      alternateGreetings: ["Hello again"],
      systemPrompt: "sys",
      postHistoryInstructions: "post",
      extraExtensions: { other_tool: { keep: true } },
    });
    original.profile.speechStyle = "Clipped and formal.";
    original.rpg.enabled = true;
    original.rpg.className = "Wizard";
    original.lorebook.entries.push({ ...newLoreEntry(), keys: ["tower"], content: "A tall tower." });

    const card = toV2Card(original);
    expect(card.data.description).toContain("Speech style: Clipped and formal.");
    expect(card.data.description).toContain("Wizard 1");
    expect(card.data.character_book?.entries[0].keys).toEqual(["tower"]);
    expect(card.data.extensions.other_tool).toEqual({ keep: true });

    const back = parseCard(JSON.parse(JSON.stringify(card))).character;
    expect(back.description).toBe("Base description.");
    expect(back.profile.speechStyle).toBe("Clipped and formal.");
    expect(back.rpg.className).toBe("Wizard");
    expect(back.age).toBe(41);
    expect(back.systemPrompt).toBe("sys");
    expect(back.postHistoryInstructions).toBe("post");
    expect(back.lorebook.entries[0].content).toBe("A tall tower.");
    expect(back.extraExtensions).toEqual({ other_tool: { keep: true } });
    expect(toV2Card(back).data.description).toBe(card.data.description);
  });

  it("writes a v3 card that reads back as v3", () => {
    const [mira] = seedCharacters();
    const v3 = toV3Card(mira);
    expect(v3.spec).toBe("chara_card_v3");
    const back = parseCard(v3);
    expect(back.format).toBe("v3");
    expect(back.character.name).toBe("Mira Vale");
  });
});
