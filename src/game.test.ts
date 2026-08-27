import { describe, expect, it } from "vitest";
import { beginCombat, resolveCombat, finishCombat } from "./combat";
import { applyChoice, deriveScene } from "./content/scenes";
import { addXp, anchorsHeld, createPlayer, createWorld, flag, hpMaxFor } from "./engine";
import { reduce } from "./reduce";
import { blankState } from "./storage";
import type { GameState } from "./types";

function fresh(): GameState {
  return reduce(blankState(), {
    type: "CREATE",
    name: "Kaelith",
    classId: "ashblade",
    originId: "foundling",
  });
}

describe("Aetherbound engine", () => {
  it("builds a living character", () => {
    const p = createPlayer("Rook", "warden", "foundling");
    expect(p.hp).toBe(hpMaxFor(p.stats));
    expect(p.skills.length).toBe(4);
    expect(p.weapon).toBe("ashwood_spear");
  });

  it("levels from xp", () => {
    let s = fresh();
    const lvl = s.player!.level;
    s = addXp(s, 400);
    expect(s.player!.level).toBeGreaterThan(lvl);
    expect(s.player!.hp).toBe(s.player!.hpMax);
  });

  it("plays the Emberhearth opening", () => {
    let s = fresh();
    expect(deriveScene(s).id).toBe("intro.wake");
    s = applyChoice(s, "intro.down");
    expect(flag(s, "intro.done")).toBe(true);
    expect(deriveScene(s).id).toBe("ember.mira.first");
    s = applyChoice(s, "mira.accept");
    expect(flag(s, "mira.met")).toBe(true);
    const hub = deriveScene(s);
    expect(hub.choices.some((c) => c.id === "travel.veilwood")).toBe(true);
    s = applyChoice(s, "travel.veilwood");
    expect(s.world!.locationId).toBe("veilwood");
  });

  it("can win a clash and claim the Ember Anchor", () => {
    let s = fresh();
    s.player!.stats.steel = 20;
    s.player!.hpMax = 200;
    s.player!.hp = 200;
    s.player!.mpMax = 80;
    s.player!.mp = 80;
    s = beginCombat(s, "hollow_stag");
    let guard = 0;
    while (s.combat && !s.combat.over && guard++ < 40) {
      s = resolveCombat(s, { kind: "skill", skillId: "cinder_cut" });
    }
    expect(s.combat?.over).toBe("win");
    s = finishCombat(s);
    expect(flag(s, "anchor.ember")).toBe(true);
    expect(anchorsHeld(s)).toBe(1);
  });

  it("hides the Rift until three Anchors are held", () => {
    let s = fresh();
    s = applyChoice(s, "intro.down");
    s = applyChoice(s, "mira.accept");
    s.world!.flags["anchor.ember"] = true;
    s.world!.flags["anchor.tide"] = true;
    s.world!.locationId = "cathedral";
    s.world!.discovered.push("cathedral");
    s.world!.flags["cath.intro"] = true;
    s.world!.flags["anchor.ash"] = true;
    const scene = deriveScene(s);
    expect(scene.choices.some((c) => c.id === "travel.rift")).toBe(true);
    s.world!.flags["anchor.ash"] = false;
    expect(deriveScene(s).choices.some((c) => c.id === "travel.rift")).toBe(false);
  });

  it("creates a world seed", () => {
    const w = createWorld(42);
    expect(w.seed).toBe(42);
    expect(w.locationId).toBe("emberhearth");
  });
});
