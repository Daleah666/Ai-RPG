import { finishCombat, resolveCombat, useItemInPeace } from "./combat";
import { applyChoice, restCamp, restInn } from "./content/scenes";
import { createPlayer, createWorld } from "./engine";
import { blankState, deleteSave, loadGame, saveGame, saveSettings } from "./storage";
import type { Action, GameState } from "./types";

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "NEW_GAME": {
      return { ...blankState(state.settings), screen: "create" };
    }
    case "BACK_TITLE": {
      return blankState(state.settings);
    }
    case "CREATE": {
      const player = createPlayer(action.name, action.classId, action.originId, action.identity);
      const world = createWorld();
      world.memories.unshift(`${player.name} — ${player.identity.epithet}.`);
      const next: GameState = {
        ...state,
        screen: "play",
        player,
        world,
        combat: null,
        event: null,
        ending: null,
        panel: null,
      };
      saveGame(next);
      return next;
    }
    case "CHOICE": {
      if (!state.player || !state.world) return state;
      const next = applyChoice(state, action.choiceId);
      if (next.screen !== "ending") saveGame(next);
      return next;
    }
    case "COMBAT": {
      if (!state.combat) return state;
      const next = resolveCombat(state, action.move);
      saveGame(next);
      return next;
    }
    case "COMBAT_END": {
      const next = finishCombat(state);
      saveGame(next);
      return next;
    }
    case "OPEN_PANEL": {
      return { ...state, panel: action.panel };
    }
    case "USE_ITEM": {
      if (!state.player) return state;
      if (state.screen === "combat") {
        const next = resolveCombat(state, { kind: "item", defId: action.defId });
        saveGame(next);
        return next;
      }
      const next = useItemInPeace(state, action.defId);
      saveGame(next);
      return next;
    }
    case "EQUIP": {
      if (!state.player) return state;
      const next = useItemInPeace(state, action.defId);
      saveGame(next);
      return next;
    }
    case "REST": {
      if (!state.player) return state;
      const next = action.mode === "inn" ? restInn(state) : restCamp(state);
      saveGame(next);
      return next;
    }
    case "LOAD": {
      return loadGame(state.settings) ?? state;
    }
    case "DELETE_SAVE": {
      deleteSave();
      return blankState(state.settings);
    }
    case "SETTINGS": {
      const settings = { ...state.settings, ...action.patch };
      saveSettings(settings);
      return { ...state, settings };
    }
    default:
      return state;
  }
}
