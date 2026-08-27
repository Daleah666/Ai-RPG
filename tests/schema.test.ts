import { describe, expect, it } from "vitest";
import { generateSchema } from "@/lib/schema";

describe("generate schema", () => {
  it("accepts a theme payload", () => {
    const parsed = generateSchema.parse({ theme: "quiet wealth", recipeId: "auto" });
    expect(parsed.theme).toBe("quiet wealth");
  });

  it("rejects unknown recipes", () => {
    expect(() => generateSchema.parse({ theme: "sleep", recipeId: "not-a-recipe" })).toThrow();
  });
});
