import { useState } from "react";
import { cardFilename, characterToV2Card, downloadJson, newCardId } from "../lib/card";
import { deleteCharacter, saveCharacter } from "../lib/db";
import { downloadBytes, cardToPngBytes } from "../lib/png-export";
import type { DepthCard } from "../lib/types";
import { Portrait } from "./Portrait";
import { PromptView } from "./PromptView";

export function SheetScreen({
  card,
  userName,
  onEdit,
  onChat,
  onBack,
  onReload,
  onDuplicated,
}: {
  card: DepthCard;
  userName: string;
  onEdit: () => void;
  onChat: () => void;
  onBack: () => void;
  onReload: () => Promise<void>;
  onDuplicated: (id: string) => void;
}) {
  const [error, setError] = useState("");

  async function onPng() {
    setError("");
    try {
      const bytes = await cardToPngBytes(card);
      const slug = cardFilename(card.name).replace(/\.json$/, "");
      downloadBytes(`${slug}.png`, bytes, "image/png");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export the PNG.");
    }
  }

  async function onDuplicate() {
    const now = Date.now();
    const copy: DepthCard = {
      ...card,
      id: newCardId(),
      name: `${card.name} copy`,
      createdAt: now,
      updatedAt: now,
    };
    await saveCharacter(copy);
    await onReload();
    onDuplicated(copy.id);
  }

  async function onDelete() {
    if (!window.confirm(`Delete ${card.name}?`)) return;
    await deleteCharacter(card.id);
    await onReload();
    onBack();
  }

  return (
    <div className="stack-page">
      <div className="row">
        <button className="btn-quiet" type="button" onClick={onBack}>
          Library
        </button>
        <button className="btn-sea" type="button" onClick={onChat}>
          Chat
        </button>
        <button className="btn" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="btn" type="button" onClick={() => downloadJson(cardFilename(card.name), characterToV2Card(card))}>
          Export JSON
        </button>
        <button className="btn" type="button" onClick={() => void onPng()}>
          Export PNG
        </button>
        <button className="btn" type="button" onClick={() => void onDuplicate()}>
          Duplicate
        </button>
        <button className="btn-quiet" type="button" onClick={() => void onDelete()}>
          Delete
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="sheet">
        <aside className="sheet-side">
          <Portrait src={card.avatarDataUrl} name={card.name} />
          <h1 style={{ marginTop: 12 }}>{card.name}</h1>
          <p className="meta">
            Age {card.age}
            {card.creator ? ` · ${card.creator}` : ""} · {card.characterVersion}
          </p>
          <div className="chips">
            {card.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <p className="hint">
            Lore scan looks at the last {card.loreScanDepth} messages. Lore budget is about{" "}
            {card.loreTokenBudget} tokens.
          </p>
        </aside>
        <div className="sheet-main">
          <Section title="Description" text={card.description} />
          <Section title="Personality" text={card.personality} />
          <Section title="Scenario" text={card.scenario} />
          <Section title="Greeting" text={card.firstMes} />
          {card.alternateGreetings.length > 0 && (
            <div className="block">
              <h3>Other greetings</h3>
              {card.alternateGreetings.map((greeting, index) => (
                <p key={`${index}-${greeting.slice(0, 12)}`} className="lore-item">
                  {greeting}
                </p>
              ))}
            </div>
          )}
          <Section title="Example dialogue" text={card.mesExample} />
          <Section title="System prompt" text={card.systemPrompt} />
          <Section title="After the chat" text={card.postHistoryInstructions} />
          <div className="block">
            <h3>Depth note · {card.depthPromptDepth}</h3>
            <p className="hint">
              Inserted {card.depthPromptDepth} messages above the newest line, so a long chat
              keeps this reminder nearby.
            </p>
            <p>{card.depthPrompt || "No depth note."}</p>
          </div>
          <div className="block" data-testid="lore-list">
            <h3>Lore book</h3>
            {card.lore.length === 0 && <p className="hint">No lore entries.</p>}
            {card.lore.map((entry) => (
              <article key={entry.id} className="lore-item">
                <strong>{entry.name || "Untitled"}</strong>
                <p className="meta">
                  {entry.constant ? "Always on" : entry.keys.join(", ") || "No keys"}
                  {" · "}
                  {entry.position === "at_depth" ? `in chat at depth ${entry.depth}` : entry.position.replace("_", " ")}
                  {entry.selective ? " · needs a second key" : ""}
                  {entry.enabled ? "" : " · off"}
                </p>
                <p>{entry.content}</p>
              </article>
            ))}
          </div>
          <Section title="Creator notes" text={card.creatorNotes} />
          <PromptView card={card} userName={userName} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <section className="block">
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}
