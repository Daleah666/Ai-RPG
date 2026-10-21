import type { GameState, Player, Settings } from "./types";
import { hydrateIdentity } from "./content/identity";
import { defaultSettings } from "./engine";

const SAVE_KEY = "aetherbound-save-v1";
const SETTINGS_KEY = "aetherbound-settings-v1";

function ls(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  try {
    const raw = ls()?.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    ls()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}

export function hasSave(): boolean {
  try {
    return Boolean(ls()?.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function saveGame(state: GameState): void {
  if (!state.player || !state.world) return;
  try {
    const blob = {
      player: state.player,
      world: state.world,
      combat: state.combat,
      event: state.event,
      ending: state.ending,
      screen: state.screen === "title" || state.screen === "create" ? "play" : state.screen,
    };
    ls()?.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

export function hydratePlayer(player: Player): Player {
  const identity = hydrateIdentity(player.identity, player.classId, player.originId);
  return { ...player, identity };
}

export function loadGame(settings: Settings): GameState | null {
  try {
    const raw = ls()?.getItem(SAVE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as Partial<GameState>;
    if (!blob.player || !blob.world) return null;
    return {
      screen: blob.screen === "ending" ? "ending" : blob.combat ? "combat" : "play",
      player: hydratePlayer(blob.player),
      world: blob.world,
      combat: blob.combat ?? null,
      event: blob.event ?? null,
      ending: blob.ending ?? null,
      panel: null,
      settings,
    };
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  try {
    ls()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function blankState(settings = loadSettings()): GameState {
  return {
    screen: "title",
    player: null,
    world: null,
    combat: null,
    event: null,
    ending: null,
    panel: null,
    settings,
  };
}
