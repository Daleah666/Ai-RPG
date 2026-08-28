import { describe, expect, it } from "vitest";
import { generateProject } from "@/lib/engine";
import { suggestForTheme, FEATURED_PACKS } from "@/lib/suggestions";

describe("suggestion packs", () => {
  it("features feminizing, trance, and anti-racism", () => {
    const titles = FEATURED_PACKS.map((p) => p.title.toLowerCase());
    expect(titles.some((t) => t.includes("feminiz"))).toBe(true);
    expect(titles.some((t) => t.includes("trance"))).toBe(true);
    expect(titles.some((t) => t.includes("anti-racism") || t.includes("antiracism"))).toBe(true);
  });

  it("ranks feminizing when asked", () => {
    const hits = suggestForTheme("feminizing");
    expect(hits[0]?.id).toBe("pack-feminizing");
  });
});

describe("stacked packs", () => {
  it("builds a multi-layer feminizing mix", () => {
    const p = generateProject({ theme: "feminizing", affirmationCount: 40 });
    expect(p.category).toBe("feminine");
    expect(p.recipeId).toBe("deep_stack");
    expect(p.audio.layers).toBeGreaterThanOrEqual(6);
    expect(p.audio.reverse).toBe(true);
    expect(p.audio.silentCarrier.enabled).toBe(true);
    expect(p.suggestions.length).toBeGreaterThan(0);
    expect(p.affirmations.some((l) => /feminine|woman|voice/i.test(l))).toBe(true);
  });

  it("builds a trance drop mix", () => {
    const p = generateProject({ theme: "better in trance" });
    expect(p.category).toBe("trance");
    expect(p.recipeId).toBe("trance_drop");
    expect(p.audio.binaural.enabled).toBe(true);
    expect(p.audio.layers).toBeGreaterThanOrEqual(5);
  });

  it("builds an anti-racism mix without banned negatives", () => {
    const p = generateProject({ theme: "anti-racism" });
    expect(p.category).toBe("antiracism");
    expect(p.audio.layers).toBeGreaterThanOrEqual(6);
    expect(p.affirmations.every((l) => !/\bnot\b/i.test(l))).toBe(true);
    expect(p.affirmations.some((l) => /human|dignity|bias|respect/i.test(l))).toBe(true);
  });
});
