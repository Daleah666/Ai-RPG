import { describe, expect, it } from "vitest";
import { embedCardInPng, extractCardJsonFromPng, readPngText } from "../src/lib/png";

// 1x1 transparent PNG.
const TINY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("png cards", () => {
  it("embeds and extracts unicode card JSON", () => {
    const json = JSON.stringify({ spec: "chara_card_v2", data: { name: "Zoë ✨ 雪" } });
    const out = embedCardInPng(TINY_PNG, json);
    expect(JSON.parse(extractCardJsonFromPng(out)).data.name).toBe("Zoë ✨ 雪");
  });

  it("prefers v3 data and replaces old card chunks instead of stacking them", () => {
    const first = embedCardInPng(TINY_PNG, '{"v":1}', '{"v":3}');
    const second = embedCardInPng(first, '{"v":2}', '{"v":4}');
    expect(extractCardJsonFromPng(second)).toBe('{"v":4}');
    expect(Object.keys(readPngText(second)).sort()).toEqual(["ccv3", "chara"]);
    expect(second.length).toBe(first.length);
  });

  it("errors clearly on PNGs without a card", () => {
    expect(() => extractCardJsonFromPng(TINY_PNG)).toThrow(/no character card/);
    expect(() => extractCardJsonFromPng(new Uint8Array([1, 2, 3]))).toThrow(/not a PNG/);
  });
});
