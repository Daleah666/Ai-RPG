/** Photosensitive-seizure safety for visual flashes. */

export const SAFE_MAX_FLASH_HZ = 2;
export const DEFAULT_FLASH_MS = 33;
export const DEFAULT_INTERVAL_MS = 4000;
export const HARD_MIN_INTERVAL_MS = 500;

export function flashHz(flashDurationMs: number, intervalMs: number): number {
  const cycle = Math.max(1, flashDurationMs + intervalMs);
  return 1000 / cycle;
}

export function clampVisualTiming(input: {
  flashDurationMs: number;
  intervalMs: number;
}): { flashDurationMs: number; intervalMs: number; hz: number; safe: boolean } {
  const flashDurationMs = Math.min(400, Math.max(16, Math.round(input.flashDurationMs)));
  const intervalMs = Math.max(HARD_MIN_INTERVAL_MS, Math.round(input.intervalMs));
  const hz = flashHz(flashDurationMs, intervalMs);
  return {
    flashDurationMs,
    intervalMs,
    hz,
    safe: hz <= SAFE_MAX_FLASH_HZ,
  };
}

export const SAFETY_COPY = {
  title: "Flashing visuals",
  body: "Rapid image flashes can trigger seizures in people with photosensitive epilepsy. This studio caps flash rate at 2 Hz and defaults to one brief flash every few seconds — not a strobe. Do not raise the rate if you are sensitive to flicker, and never use this content as medical treatment.",
};
