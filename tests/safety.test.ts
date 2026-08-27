import { describe, expect, it } from "vitest";
import { clampVisualTiming, flashHz, SAFE_MAX_FLASH_HZ } from "@/lib/safety";

describe("flash safety", () => {
  it("defaults stay under the 2 Hz cap", () => {
    const t = clampVisualTiming({ flashDurationMs: 33, intervalMs: 4000 });
    expect(t.safe).toBe(true);
    expect(t.hz).toBeLessThanOrEqual(SAFE_MAX_FLASH_HZ);
  });

  it("refuses sub-500ms intervals", () => {
    const t = clampVisualTiming({ flashDurationMs: 16, intervalMs: 10 });
    expect(t.intervalMs).toBe(500);
    expect(flashHz(t.flashDurationMs, t.intervalMs)).toBeLessThanOrEqual(3);
  });
});
