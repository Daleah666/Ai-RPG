import type { Dispatch } from "../App";
import type { Ending } from "../types";

export function EndingScreen({
  ending,
  dispatch,
}: {
  ending: Ending;
  dispatch: Dispatch;
}) {
  return (
    <main className="ending">
      <p className="eyebrow">The tale closes</p>
      <h1>{ending.title}</h1>
      {ending.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <div className="title-actions">
        <button className="btn primary" onClick={() => dispatch({ type: "DELETE_SAVE" })}>
          Begin again
        </button>
        <button className="btn" onClick={() => dispatch({ type: "BACK_TITLE" })}>
          Title
        </button>
      </div>
    </main>
  );
}
