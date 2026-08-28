import { describe, expect, it } from "vitest";
import { generateProject } from "@/lib/engine";
import { renderProjectWav } from "@/lib/audio/render";

describe("wav render", () => {
  it("emits a valid stereo WAV header", () => {
    const project = generateProject({ theme: "focus", durationSec: 30 });
    const wav = renderProjectWav(project, { durationSec: 1, sampleRate: 8000 });
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.length).toBeGreaterThan(44);
  });
});
