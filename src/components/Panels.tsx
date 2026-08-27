import type { Dispatch } from "../App";
import { CLASSES } from "../content/classes";
import { ITEMS } from "../content/items";
import { ORIGINS } from "../content/origins";
import { GRAPH, LOCATIONS } from "../content/world";
import { anchorsHeld, flag, xpToNext } from "../engine";
import type { GameState } from "../types";

export function Panels({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const panel = state.panel;
  const player = state.player!;
  const world = state.world!;

  return (
    <aside className="panel">
      <button className="link close" onClick={() => dispatch({ type: "OPEN_PANEL", panel: null })}>
        Close
      </button>
      {panel === "person" && (
        <>
          <h3>{player.name}</h3>
          <p>
            {CLASSES[player.classId].name} · {ORIGINS[player.originId].name}
          </p>
          <p className="muted">
            Level {player.level} · {player.xp}/{xpToNext(player.level)} toward the next circle
          </p>
          <ul className="stats">
            {Object.entries(player.stats).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </li>
            ))}
          </ul>
          <p>
            Weapon: {player.weapon ? ITEMS[player.weapon]?.name : "none"} · Armor:{" "}
            {player.armor ? ITEMS[player.armor]?.name : "none"} · Relic:{" "}
            {player.relic ? ITEMS[player.relic]?.name : "none"}
          </p>
          {player.statuses.length > 0 && (
            <p>Statuses: {player.statuses.map((s) => `${s.name} (${s.turns})`).join(", ")}</p>
          )}
        </>
      )}
      {panel === "pack" && (
        <>
          <h3>Pack · {player.gold}g</h3>
          <ul className="pack">
            {player.inventory.map((s) => {
              const item = ITEMS[s.defId];
              if (!item) return null;
              const canUse = item.kind === "consumable";
              const canEquip = item.kind === "weapon" || item.kind === "armor" || item.kind === "relic";
              return (
                <li key={s.defId}>
                  <div>
                    <strong>
                      {item.name} {s.qty > 1 ? `×${s.qty}` : ""}
                    </strong>
                    <p>{item.desc}</p>
                  </div>
                  {canUse && (
                    <button onClick={() => dispatch({ type: "USE_ITEM", defId: s.defId })}>Use</button>
                  )}
                  {canEquip && (
                    <button onClick={() => dispatch({ type: "EQUIP", defId: s.defId })}>Equip</button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {panel === "map" && (
        <>
          <h3>Thalorin</h3>
          <ul className="map">
            {world.discovered.map((id) => (
              <li key={id} className={id === world.locationId ? "here" : ""}>
                <strong>{LOCATIONS[id].name}</strong>
                <span>{LOCATIONS[id].region}</span>
                {id !== world.locationId && GRAPH[world.locationId].includes(id) && (
                  <button onClick={() => dispatch({ type: "CHOICE", choiceId: `travel.${id}` })}>
                    Travel
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">The Rift opens only when three Anchors are held. You hold {anchorsHeld(state)}.</p>
        </>
      )}
      {panel === "journal" && (
        <>
          <h3>Journal</h3>
          <ul className="journal">
            <li>
              <strong>The Three Anchors</strong>
              <p>
                Ember {flag(state, "anchor.ember") ? "taken" : "unclaimed"} · Tide{" "}
                {flag(state, "anchor.tide") ? "taken" : "unclaimed"} · Ash{" "}
                {flag(state, "anchor.ash") ? "taken" : "unclaimed"}
              </p>
            </li>
            {flag(state, "side.liri.done") ? (
              <li>
                <strong>Liri</strong>
                <p>Home, furious, alive.</p>
              </li>
            ) : flag(state, "side.liri.started") ? (
              <li>
                <strong>Liri</strong>
                <p>Gone into the Veilwood for wolf-flowers that are not flowers.</p>
              </li>
            ) : null}
            {flag(state, "side.vesk.done") && (
              <li>
                <strong>Vesk</strong>
                <p>The ledger is wet. The debt is not.</p>
              </li>
            )}
            {flag(state, "side.page.done") && (
              <li>
                <strong>The Remaining Page</strong>
                <p>You carry the rest of a sentence the Archives wanted drowned.</p>
              </li>
            )}
            {flag(state, "lore.read") && (
              <li>
                <strong>Do not become the looking</strong>
                <p>A Bound with three Anchors may mend, tear, or sit.</p>
              </li>
            )}
          </ul>
          <h4>The Chronicler remembers</h4>
          <ul className="memories">
            {world.memories.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
      {panel === "settings" && (
        <>
          <h3>Settings</h3>
          <label>
            Text speed ({state.settings.textSpeed})
            <input
              type="range"
              min={0}
              max={32}
              value={state.settings.textSpeed}
              onChange={(e) =>
                dispatch({ type: "SETTINGS", patch: { textSpeed: Number(e.target.value) } })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={state.settings.aiEnabled}
              onChange={(e) =>
                dispatch({ type: "SETTINGS", patch: { aiEnabled: e.target.checked } })
              }
            />
            Live Chronicler (optional API)
          </label>
          <p className="muted">
            The game is complete without this. If you paste a key, scene text may be rewritten by an
            OpenAI-compatible chat model. The key never leaves this browser.
          </p>
          <label>
            API base
            <input
              value={state.settings.apiBase}
              onChange={(e) => dispatch({ type: "SETTINGS", patch: { apiBase: e.target.value } })}
            />
          </label>
          <label>
            Model
            <input
              value={state.settings.model}
              onChange={(e) => dispatch({ type: "SETTINGS", patch: { model: e.target.value } })}
            />
          </label>
          <label>
            API key
            <input
              type="password"
              value={state.settings.apiKey}
              onChange={(e) => dispatch({ type: "SETTINGS", patch: { apiKey: e.target.value } })}
              placeholder="sk-…"
            />
          </label>
        </>
      )}
    </aside>
  );
}
