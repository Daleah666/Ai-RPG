import { useState } from "react";
import type { Dispatch } from "../App";

export function TitleScreen({
  dispatch,
  canContinue,
}: {
  dispatch: Dispatch;
  canContinue: boolean;
}) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  return (
    <main className="title">
      <div className="title-sky" aria-hidden />
      <p className="eyebrow">An AI-woven role-playing game</p>
      <h1>Aetherbound</h1>
      <p className="tag">
        The Veil is thinning over Thalorin. You are Bound — one of the few who can hear the tear.
        Three Anchors. One Rift. A Chronicler who is already writing your name.
      </p>
      <div className="title-actions">
        <button className="btn primary" onClick={() => dispatch({ type: "NEW_GAME" })}>
          New tale
        </button>
        {canContinue && (
          <button className="btn" onClick={() => dispatch({ type: "LOAD" })}>
            Continue
          </button>
        )}
      </div>
      {canContinue && (
        <p className="wipe">
          {!confirmWipe ? (
            <button className="link" onClick={() => setConfirmWipe(true)}>
              Erase saved tale
            </button>
          ) : (
            <>
              Truly?{" "}
              <button className="link" onClick={() => dispatch({ type: "DELETE_SAVE" })}>
                Erase it
              </button>{" "}
              ·{" "}
              <button className="link" onClick={() => setConfirmWipe(false)}>
                Keep it
              </button>
            </>
          )}
        </p>
      )}
      <p className="credit">Play in the browser. The Chronicler lives in the game — optional live AI in Settings.</p>
    </main>
  );
}
