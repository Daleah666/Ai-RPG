import { useEffect, useState } from "react";
import type { Dispatch } from "../App";
import { identityContext, rewriteWithModel } from "../content/chronicle";
import { CLASSES } from "../content/classes";
import { LOCATIONS, TIME_LABEL } from "../content/world";
import { anchorsHeld } from "../engine";
import type { GameState, Scene } from "../types";
import { LocationArt } from "./LocationArt";
import { Panels } from "./Panels";
import { Portrait } from "./Portrait";
import { Typewriter } from "./Typewriter";

export function PlayScreen({
  state,
  scene,
  dispatch,
}: {
  state: GameState;
  scene: Scene;
  dispatch: Dispatch;
}) {
  const player = state.player!;
  const world = state.world!;
  const [body, setBody] = useState(scene.body);
  const combatLock = state.screen === "combat";

  useEffect(() => {
    setBody(scene.body);
    let cancel = false;
    const ctx = `${identityContext(state)} Day ${world.day} ${world.time}, ${LOCATIONS[world.locationId].name}. Memories: ${world.memories.slice(-4).join(" / ")}`;
    const original = scene.body;
    rewriteWithModel(original, ctx, state.settings).then((text) => {
      if (!cancel && text) setBody(text);
    });
    return () => {
      cancel = true;
    };
    // Only rewrite when the scene identity changes, not every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, state.settings.aiEnabled, state.settings.apiKey, state.settings.model, state.settings.apiBase]);

  return (
    <div className={`play ${combatLock ? "dimmed" : ""}`}>
      <aside className="hud">
        <Portrait
          hair={player.identity.hair}
          eyes={player.identity.eyes}
          skin={player.identity.skin}
          mark={player.identity.mark}
          size={120}
        />
        <div className="sigil">{CLASSES[player.classId].name}</div>
        <h2 className="who">{player.name}</h2>
        <p className="muted">{player.identity.epithet}</p>
        <p className="muted">
          Lv {player.level} · {LOCATIONS[world.locationId].name} · {TIME_LABEL[world.time]} · Day {world.day}
        </p>
        <Bar label="Health" cur={player.hp} max={player.hpMax} kind="hp" />
        <Bar label="Aether" cur={player.mp} max={player.mpMax} kind="mp" />
        <p className="muted gold">{player.gold} gold · Anchors {anchorsHeld(state)}/3</p>
        <nav className="dock">
          {(["person", "pack", "map", "journal", "settings"] as const).map((p) => (
            <button
              key={p}
              className={state.panel === p ? "on" : ""}
              onClick={() => dispatch({ type: "OPEN_PANEL", panel: state.panel === p ? null : p })}
            >
              {p}
            </button>
          ))}
        </nav>
      </aside>

      <section className="stage">
        <LocationArt locationId={scene.locationId} time={world.time} />
        <div className="prose">
          <p className="kicker">{scene.kicker}</p>
          <h1>{scene.title}</h1>
          <Typewriter lines={body} speed={state.settings.textSpeed} resetKey={scene.id + body.join()} />
          {!combatLock && (
            <ol className="choices">
              {scene.choices.map((c, i) => (
                <li key={c.id}>
                  <button
                    className="choice"
                    disabled={Boolean(c.disabled)}
                    onClick={() => dispatch({ type: "CHOICE", choiceId: c.id })}
                  >
                    <span className="num">{i + 1}</span>
                    <span>
                      <strong>{c.label}</strong>
                      {c.hint && <em>{c.hint}</em>}
                      {c.skill && (
                        <em>
                          {c.skill.stat} DC {c.skill.dc}
                        </em>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {state.panel && <Panels state={state} dispatch={dispatch} />}
    </div>
  );
}

function Bar({
  label,
  cur,
  max,
  kind,
}: {
  label: string;
  cur: number;
  max: number;
  kind: "hp" | "mp";
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  return (
    <div className={`bar ${kind}`}>
      <div className="bar-label">
        {label}{" "}
        <b>
          {cur}/{max}
        </b>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
