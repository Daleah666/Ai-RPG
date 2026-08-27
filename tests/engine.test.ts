import { describe, expect, it } from "vitest";
import { generateProject } from "@/lib/engine";
import { recipeById } from "@/lib/recipes";

describe("theme engine", () => {
  it("picks sleep recipe for a sleep theme", () => {
    const p = generateProject({ theme: "deep restorative sleep" });
    expect(p.category).toBe("sleep");
    expect(p.recipeId).toBe("theta_sleep");
    expect(p.audio.bed).toBe("brown");
    expect(p.assets.length).toBeGreaterThan(0);
    expect(p.affirmations.length).toBeGreaterThan(10);
  });

  it("honors an explicit YouTube recipe", () => {
    const p = generateProject({
      theme: "desired face",
      recipeId: "silent_omega",
    });
    expect(p.recipeId).toBe("silent_omega");
    expect(p.audio.silentCarrier.enabled).toBe(true);
    expect(recipeById("silent_omega").methods).toContain("silent_omega");
  });

  it("stacks extra methods onto the mix", () => {
    const p = generateProject({
      theme: "confidence",
      methods: ["backmask", "eight_d", "flash_images"],
    });
    expect(p.audio.reverse).toBe(true);
    expect(p.audio.eightD).toBe(true);
    expect(p.visual.mode).toBe("flash_images");
  });
});
