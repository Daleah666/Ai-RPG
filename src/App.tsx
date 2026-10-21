import { useEffect, useMemo, useReducer } from "react";
import { CombatScreen } from "./components/CombatScreen";
import { CreateScreen } from "./components/CreateScreen";
import { EndingScreen } from "./components/EndingScreen";
import { PlayScreen } from "./components/PlayScreen";
import { TitleScreen } from "./components/TitleScreen";
import { deriveScene } from "./content/scenes";
import { reduce } from "./reduce";
import { blankState, hasSave } from "./storage";
import type { Action, GameState } from "./types";

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () => blankState());
  const scene = useMemo(() => {
    if (!state.player || !state.world || state.screen === "title" || state.screen === "create") {
      return null;
    }
    if (state.screen === "ending") return null;
    try {
      return deriveScene(state);
    } catch {
      return null;
    }
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (state.screen === "play" && scene && n >= 1 && n <= scene.choices.length) {
        dispatch({ type: "CHOICE", choiceId: scene.choices[n - 1]!.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.screen, scene]);

  return (
    <div className="app">
      <div className="grain" aria-hidden />
      {state.screen === "title" && (
        <TitleScreen dispatch={dispatch} canContinue={hasSave()} />
      )}
      {state.screen === "create" && <CreateScreen dispatch={dispatch} />}
      {(state.screen === "play" || state.screen === "combat") && state.player && state.world && scene && (
        <PlayScreen state={state} scene={scene} dispatch={dispatch} />
      )}
      {state.screen === "combat" && state.combat && state.player && (
        <CombatScreen state={state} dispatch={dispatch} />
      )}
      {state.screen === "ending" && state.ending && (
        <EndingScreen ending={state.ending} dispatch={dispatch} />
      )}
    </div>
  );
}

export type Dispatch = (action: Action) => void;
export type { GameState };
