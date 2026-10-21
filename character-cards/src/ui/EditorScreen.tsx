import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { emptyDraft, emptyLoreEntry, newCardId } from "../lib/card";
import { saveCharacter } from "../lib/db";
import { evaluateCharacterSafety, formatSafetyError } from "../lib/safety";
import type { CardDraft, DepthCard, LoreEntry, LorePosition } from "../lib/types";
import { Portrait } from "./Portrait";

export function EditorScreen({
  existing,
  imported,
  onSaved,
  onCancel,
}: {
  existing: DepthCard | null;
  imported: { draft: CardDraft; preservedId: string | null } | null;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CardDraft>(existing ? toDraft(existing) : emptyDraft());
  const [preservedId, setPreservedId] = useState<string | null>(existing?.id ?? null);
  const [tagInput, setTagInput] = useState(existing ? existing.tags.join(", ") : "");
  const [confirmed, setConfirmed] = useState(Boolean(existing));
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing || !imported) return;
    setDraft({ ...emptyDraft(), ...imported.draft, lore: imported.draft.lore ?? [] });
    setTagInput((imported.draft.tags ?? []).join(", "));
    setPreservedId(imported.preservedId);
    setBanner("Imported card. Check the age, the lore, and the depth note, then save.");
    setConfirmed(false);
  }, [existing, imported]);

  function update<K extends keyof CardDraft>(key: K, value: CardDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateLore(id: string, patch: Partial<LoreEntry>) {
    setDraft((prev) => ({
      ...prev,
      lore: prev.lore.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  }

  async function onAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 1_500_000) {
      setError("Use an image under 1.5 MB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    update("avatarDataUrl", dataUrl);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const tags = tagInput.split(",").map((tag) => tag.trim()).filter(Boolean);
    const next: CardDraft = {
      ...draft,
      name: draft.name.trim(),
      tags,
      lore: draft.lore.filter((entry) => entry.content.trim() || entry.keys.length || entry.constant),
    };
    if (!next.name) {
      setError("Give the character a name.");
      return;
    }
    if (!confirmed) {
      setError("Confirm this character is an adult (18+) before saving.");
      return;
    }
    const safety = evaluateCharacterSafety(next);
    if (!safety.ok) {
      setError(formatSafetyError(safety));
      return;
    }
    setBusy(true);
    const now = Date.now();
    const id = existing?.id ?? preservedId ?? newCardId();
    const card: DepthCard = {
      ...next,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveCharacter(card);
      onSaved(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <p className="kicker">Character card</p>
        <h1>{existing ? `Edit ${existing.name}` : "New card"}</h1>
        <p className="lede">
          The top fields are the usual tavern card. The depth note and the lore book are what keep
          a long chat from forgetting the job.
        </p>
      </div>
      {banner && <div className="banner">{banner}</div>}
      {error && <div className="error">{error}</div>}

      <div className="row">
        <Portrait src={draft.avatarDataUrl} name={draft.name || "New"} />
        <label className="stack">
          <span>Portrait</span>
          <input type="file" accept="image/*" onChange={(event) => void onAvatar(event.target.files?.[0])} />
        </label>
      </div>

      <div className="two">
        <Field label="Name">
          <input className="field" data-testid="character-name" value={draft.name} onChange={(event) => update("name", event.target.value)} required />
        </Field>
        <Field label="Age" hint="Whole number, 18 or older. Romantic cards in the sample library are in their late 20s or older.">
          <input className="field" data-testid="character-age" type="number" min={18} max={120} value={draft.age} onChange={(event) => update("age", Number(event.target.value))} required />
        </Field>
      </div>
      <Field label="Tags" hint="Comma-separated. Shelves use sfw, nsfw, rpg, cozy, craft.">
        <input className="field" value={tagInput} onChange={(event) => setTagInput(event.target.value)} />
      </Field>
      <Field label="Description">
        <textarea className="area" value={draft.description} onChange={(event) => update("description", event.target.value)} />
      </Field>
      <Field label="Personality">
        <textarea className="area" value={draft.personality} onChange={(event) => update("personality", event.target.value)} />
      </Field>
      <Field label="Scenario" hint="{{char}} and {{user}} are filled in when the prompt is built.">
        <textarea className="area" value={draft.scenario} onChange={(event) => update("scenario", event.target.value)} />
      </Field>
      <Field label="Greeting">
        <textarea className="area" value={draft.firstMes} onChange={(event) => update("firstMes", event.target.value)} />
      </Field>
      <Field label="Other greetings" hint="One greeting per box. Chat lets you pick before the first message.">
        {draft.alternateGreetings.map((greeting, index) => (
          <textarea
            key={`greet-${index}`}
            className="area"
            value={greeting}
            onChange={(event) => {
              const next = [...draft.alternateGreetings];
              next[index] = event.target.value;
              update("alternateGreetings", next);
            }}
          />
        ))}
        <button
          className="btn"
          type="button"
          onClick={() => update("alternateGreetings", [...draft.alternateGreetings, ""])}
        >
          Add greeting
        </button>
      </Field>
      <Field label="Example dialogue" hint={"Tavern style. <START> then {{user}}: and {{char}}:"}>
        <textarea className="area mono" value={draft.mesExample} onChange={(event) => update("mesExample", event.target.value)} />
      </Field>
      <Field label="System prompt" hint="Sent once, above the description. House rules for this character.">
        <textarea className="area" value={draft.systemPrompt} onChange={(event) => update("systemPrompt", event.target.value)} />
      </Field>
      <Field label="After the chat" hint="A last reminder placed under the messages, every turn.">
        <textarea className="area" value={draft.postHistoryInstructions} onChange={(event) => update("postHistoryInstructions", event.target.value)} />
      </Field>
      <div className="two">
        <Field label="Depth note" hint="A short reminder that travels with the recent messages, so a long chat does not forget it.">
          <textarea className="area" value={draft.depthPrompt} onChange={(event) => update("depthPrompt", event.target.value)} />
        </Field>
        <Field label="Depth" hint="4 means four messages above the newest line. 0 means after the newest line. A short chat puts the note at the top.">
          <input className="field" type="number" min={0} max={40} value={draft.depthPromptDepth} onChange={(event) => update("depthPromptDepth", Number(event.target.value))} />
        </Field>
      </div>
      <div className="two">
        <Field label="Lore scan depth" hint="How many recent messages are checked for lore keys.">
          <input className="field" type="number" min={0} max={40} value={draft.loreScanDepth} onChange={(event) => update("loreScanDepth", Number(event.target.value))} />
        </Field>
        <Field label="Lore token budget" hint="Rough cap. Four letters count as one token. Constant lore is kept first.">
          <input className="field" type="number" min={50} max={8000} value={draft.loreTokenBudget} onChange={(event) => update("loreTokenBudget", Number(event.target.value))} />
        </Field>
      </div>

      <div className="block">
        <h3>Lore book</h3>
        <p className="hint">
          Constant entries are always in the opening. Keyed entries join when a key appears.
          “In the chat” parks an entry at a depth, next to the recent lines.
        </p>
        {draft.lore.map((entry, index) => (
          <div key={entry.id} className="lore-item">
            <div className="two">
              <input className="field" value={entry.name} placeholder="Entry name" onChange={(event) => updateLore(entry.id, { name: event.target.value })} />
              <input
                className="field"
                value={entry.keys.join(", ")}
                placeholder="Keys, comma-separated"
                onChange={(event) => updateLore(entry.id, { keys: splitList(event.target.value) })}
              />
            </div>
            <textarea className="area" value={entry.content} placeholder="What the model should know when this entry hits" onChange={(event) => updateLore(entry.id, { content: event.target.value })} />
            <div className="two">
              <select
                className="select"
                value={entry.position}
                onChange={(event) => updateLore(entry.id, { position: event.target.value as LorePosition })}
              >
                <option value="before_char">Before the description</option>
                <option value="after_char">After the description</option>
                <option value="at_depth">In the chat, at a depth</option>
              </select>
              <input className="field" type="number" min={0} max={40} value={entry.depth} onChange={(event) => updateLore(entry.id, { depth: Number(event.target.value) })} />
            </div>
            <label className="check">
              <input type="checkbox" checked={entry.constant} onChange={(event) => updateLore(entry.id, { constant: event.target.checked })} />
              <span>Always include</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={entry.selective}
                onChange={(event) => updateLore(entry.id, { selective: event.target.checked })}
              />
              <span>Also require a second key</span>
            </label>
            {entry.selective && (
              <input
                className="field"
                value={entry.secondaryKeys.join(", ")}
                placeholder="Second keys"
                onChange={(event) => updateLore(entry.id, { secondaryKeys: splitList(event.target.value) })}
              />
            )}
            <button className="btn-quiet" type="button" onClick={() => update("lore", draft.lore.filter((item) => item.id !== entry.id))}>
              Remove entry {index + 1}
            </button>
          </div>
        ))}
        <button className="btn" type="button" onClick={() => update("lore", [...draft.lore, emptyLoreEntry(draft.lore.length)])}>
          Add lore entry
        </button>
      </div>

      <Field label="Creator notes">
        <textarea className="area" value={draft.creatorNotes} onChange={(event) => update("creatorNotes", event.target.value)} />
      </Field>

      <label className="check">
        <input data-testid="adult-confirm" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I confirm this character is an adult (18+), not a child or minor, and not written as underage.</span>
      </label>
      <div className="row">
        <button className="btn-sea" type="submit" disabled={busy} data-testid="save-character">
          {busy ? "Saving…" : "Save card"}
        </button>
        <button className="btn-quiet" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="stack">
      <span>{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

function toDraft(card: DepthCard): CardDraft {
  return {
    name: card.name,
    age: card.age,
    avatarDataUrl: card.avatarDataUrl,
    tags: card.tags,
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    firstMes: card.firstMes,
    alternateGreetings: card.alternateGreetings,
    groupGreetings: card.groupGreetings,
    mesExample: card.mesExample,
    creatorNotes: card.creatorNotes,
    systemPrompt: card.systemPrompt,
    postHistoryInstructions: card.postHistoryInstructions,
    depthPrompt: card.depthPrompt,
    depthPromptDepth: card.depthPromptDepth,
    creator: card.creator,
    characterVersion: card.characterVersion,
    lore: card.lore,
    loreScanDepth: card.loreScanDepth,
    loreTokenBudget: card.loreTokenBudget,
  };
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}
