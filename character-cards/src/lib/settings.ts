import type { AppSettings } from "./types";

const KEY = "cc-depth-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  userName: "You",
  guideDismissed: false,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
