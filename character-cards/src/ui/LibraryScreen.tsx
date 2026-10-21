import { useMemo, useState } from "react";
import { cardFilename, characterToV2Card, downloadJson, parseCharacterCardJson, parseLibraryPayload, parsePngCharacterCard } from "../lib/card";
import { deleteCharacter, restoreSampleLibrary, saveCharacter } from "../lib/db";
import { filterLibrary, libraryStats, SHELVES, type Shelf } from "../lib/library-index";
import { evaluateCharacterSafety } from "../lib/safety";
import type { CardDraft, DepthCard } from "../lib/types";
import { newCardId } from "../lib/card";
import { Portrait } from "./Portrait";

export function LibraryScreen({
  cards,
  onReload,
  onOpen,
  onEditNew,
  onImportDraft,
}: {
  cards: DepthCard[];
  onReload: () => Promise<void>;
  onOpen: (id: string) => void;
  onEditNew: () => void;
  onImportDraft: (draft: CardDraft, preservedId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState<Shelf>("all");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const stats = libraryStats(cards);
  const visible = useMemo(() => filterLibrary(cards, query, shelf), [cards, query, shelf]);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setNote("");
    try {
      if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
        const parsed = await parsePngCharacterCard(new Uint8Array(await file.arrayBuffer()));
        onImportDraft(parsed.draft, parsed.preservedId);
        onEditNew();
        return;
      }
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        throw new Error("That file is not valid JSON.");
      }
      const isLibrary =
        Array.isArray(raw) ||
        (typeof raw === "object" && raw !== null && "cards" in raw && Array.isArray((raw as { cards: unknown }).cards));
      if (!isLibrary) {
        const parsed = parseCharacterCardJson(text);
        onImportDraft(parsed.draft, parsed.preservedId);
        onEditNew();
        return;
      }
      const items = parseLibraryPayload(raw);
      let saved = 0;
      const blocked: string[] = [];
      for (const item of items) {
        const safety = evaluateCharacterSafety(item.draft);
        if (!safety.ok || item.draft.age < 18) {
          blocked.push(item.draft.name || "Unnamed card");
          continue;
        }
        const now = Date.now();
        const card: DepthCard = {
          ...item.draft,
          id: item.preservedId || newCardId(),
          createdAt: now,
          updatedAt: now,
        };
        await saveCharacter(card);
        saved += 1;
      }
      await onReload();
      setNote(`Imported ${saved} card${saved === 1 ? "" : "s"}.`);
      if (blocked.length) setError(`Blocked ${blocked.length}: ${blocked.join(", ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function onRestore() {
    const ok = window.confirm(
      "Replace the 11 sample cards with the original in-depth set? Cards you created yourself stay.",
    );
    if (!ok) return;
    await restoreSampleLibrary();
    await onReload();
    setNote("Sample library restored.");
  }

  function exportAll() {
    downloadJson("character-library.json", {
      format: "character-cards-depth-alpha",
      version: 1,
      cards: cards.map(characterToV2Card),
    });
  }

  return (
    <div className="stack-page">
      <div className="spread">
        <div>
          <p className="kicker">Library</p>
          <h1>Cards with the parts a long chat uses</h1>
          <p className="lede">
            {stats.cards} in this browser · {stats.lore} lore entries. Search checks names, tags,
            and lore, so “altar” finds the thief and “elbow” finds the rigger.
          </p>
        </div>
        <div className="row">
          <label className="btn file-btn">
            Import JSON or PNG
            <input
              data-testid="import-file"
              type="file"
              accept="application/json,.json,image/png,.png"
              onChange={(event) => {
                void importFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <button className="btn" type="button" onClick={exportAll}>
            Export library
          </button>
          <button className="btn" type="button" onClick={() => void onRestore()}>
            Restore samples
          </button>
          <button className="btn-sea" type="button" onClick={onEditNew}>
            New card
          </button>
        </div>
      </div>

      <input
        className="search"
        data-testid="library-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search names, tags, lore…"
      />
      <div className="chips">
        {SHELVES.map((item) => (
          <button
            key={item.id}
            className={shelf === item.id ? "chip on" : "chip"}
            type="button"
            data-testid={`shelf-${item.id}`}
            onClick={() => setShelf(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {note && <div className="banner">{note}</div>}
      {error && <div className="error">{error}</div>}

      {visible.length === 0 ? (
        <div className="empty">
          <h2>Nothing on this shelf</h2>
          <p className="lede">Clear the search, or restore the sample library.</p>
        </div>
      ) : (
        <div className="grid" data-testid="library-grid">
          {visible.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onOpen={() => onOpen(card.id)}
              onTag={(tag) => {
                setShelf("all");
                setQuery(tag);
              }}
              onDelete={async () => {
                if (!window.confirm(`Delete ${card.name}? The chat goes with the card.`)) return;
                await deleteCharacter(card.id);
                await onReload();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardTile({
  card,
  onOpen,
  onTag,
  onDelete,
}: {
  card: DepthCard;
  onOpen: () => void;
  onTag: (tag: string) => void;
  onDelete: () => Promise<void>;
}) {
  const depthCount = card.lore.filter((entry) => entry.position === "at_depth").length;
  return (
    <article className="card" data-testid={`card-${card.id}`}>
      <Portrait src={card.avatarDataUrl} name={card.name} />
      <div className="card-body">
        <h2>
          <button type="button" onClick={onOpen}>
            {card.name}
          </button>
        </h2>
        <p className="meta">
          {card.age} · {card.lore.length} lore
          {card.depthPrompt ? ` · depth ${card.depthPromptDepth}` : ""}
          {depthCount ? ` · ${depthCount} in-chat` : ""}
        </p>
        <div className="chips">
          {card.tags.slice(0, 4).map((tag) => (
            <button key={tag} className="tag" type="button" onClick={() => onTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <p className="blurb">{card.description}</p>
        <div className="row card-actions">
          <button className="btn-sea" type="button" onClick={onOpen}>
            Open
          </button>
          <button className="btn-quiet" type="button" onClick={() => void onDelete()}>
            Delete
          </button>
          <button
            className="btn-quiet"
            type="button"
            onClick={() => downloadJson(cardFilename(card.name), characterToV2Card(card))}
          >
            JSON
          </button>
        </div>
      </div>
    </article>
  );
}
