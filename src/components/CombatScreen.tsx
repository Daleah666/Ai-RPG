import type { Dispatch } from "../App";
import { ENEMIES } from "../content/enemies";
import { ITEMS } from "../content/items";
import { SKILLS } from "../content/skills";
import type { GameState } from "../types";

export function CombatScreen({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const combat = state.combat!;
  const player = state.player!;
  const def = ENEMIES[combat.enemyId]!;
  const hpPct = Math.max(0, (combat.enemyHp / combat.enemyHpMax) * 100);
  const over = combat.over;

  return (
    <div className="combat-overlay">
      <div className="combat-card">
        <p className="eyebrow">{def.boss ? "Boss" : "Clash"} · Round {combat.round}</p>
        <h2>{combat.enemyName}</h2>
        <p className="muted">{def.title}</p>
        <div className="bar hp">
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <p className="intent">Intent: {combat.intent}</p>
        {combat.enemyStatuses.length > 0 && (
          <p className="muted">{combat.enemyStatuses.map((s) => s.name).join(" · ")}</p>
        )}
        <ul className="clog">
          {combat.log.slice(-5).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        {over ? (
          <div className="combat-end">
            <p className="over-label">
              {over === "win" ? "The thing yields." : over === "flee" ? "You are gone." : "You fall."}
            </p>
            <button className="btn primary" onClick={() => dispatch({ type: "COMBAT_END" })}>
              Continue
            </button>
          </div>
        ) : (
          <>
            <div className="skill-grid">
              {player.skills.map((id) => {
                const sk = SKILLS[id]!;
                const low = player.mp < sk.mp;
                return (
                  <button
                    key={id}
                    className="skill"
                    disabled={low}
                    onClick={() => dispatch({ type: "COMBAT", move: { kind: "skill", skillId: id } })}
                  >
                    <strong>{sk.name}</strong>
                    <span>
                      {sk.mp ? `${sk.mp} aether` : "free"} · {sk.desc}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="combat-util">
              <button onClick={() => dispatch({ type: "COMBAT", move: { kind: "defend" } })}>Guard</button>
              <button
                disabled={!combat.canFlee}
                onClick={() => dispatch({ type: "COMBAT", move: { kind: "flee" } })}
              >
                Flee
              </button>
              {player.inventory
                .filter((s) => ITEMS[s.defId]?.kind === "consumable")
                .map((s) => (
                  <button
                    key={s.defId}
                    onClick={() => dispatch({ type: "COMBAT", move: { kind: "item", defId: s.defId } })}
                  >
                    {ITEMS[s.defId]!.name} ×{s.qty}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
