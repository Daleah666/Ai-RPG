import { describe, expect, it } from "vitest";
import { generateAffirmations } from "@/lib/affirmations";

describe("affirmations", () => {
  it("writes present-tense lines for a theme", () => {
    const lines = generateAffirmations("unshakeable confidence", 24);
    expect(lines.length).toBeGreaterThanOrEqual(20);
    expect(lines.every((l) => /[.!?]$/.test(l))).toBe(true);
    expect(lines.some((l) => /I am|I feel|I notice|People/i.test(l))).toBe(true);
    expect(lines.every((l) => !/\bnot\b/i.test(l))).toBe(true);
  });

  it("varies by theme", () => {
    const a = generateAffirmations("quiet wealth", 16).join(" ");
    const b = generateAffirmations("deep sleep", 16).join(" ");
    expect(a).not.toEqual(b);
  });
});
