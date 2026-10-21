import { useMemo, useRef, useState } from "react";
import type { Dispatch } from "../App";
import {
  deleteCharacter,
  duplicateCharacter,
  exportCharacters,
  importCharacters,
  loadCharacters,
  toggleFavorite,
} from "../characterLibrary";
import { CLASSES } from "../content/classes";
import { DRIVES, FEARS, MARKS, TEMPERS, VICES, VIRTUES } from "../content/identity";
import { ORIGINS } from "../content/origins";
import { SKILLS } from "../content/skills";
import { createPlayer } from "../engine";
import type { CharacterCard, ClassId } from "../types";
import { Portrait } from "./Portrait";

type Filter = "all" | "favorites" | ClassId;

export function CharacterLibrary({ dispatch }: { dispatch: Dispatch }) {
  const [cards, setCards] = useState(loadCharacters);
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards
      .filter((card) => filter === "all" || (filter === "favorites" ? card.favorite : card.classId === filter))
      .filter((card) => {
        if (!needle) return true;
        return [card.name, card.identity.epithet, CLASSES[card.classId].name, ORIGINS[card.originId].name]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
  }, [cards, filter, query]);

  const selected = cards.find((card) => card.id === selectedId) ?? visible[0];
  const refresh = (preferId?: string) => {
    const next = loadCharacters();
    setCards(next);
    if (preferId) setSelectedId(preferId);
  };

  const begin = (card: CharacterCard) => {
    dispatch({
      type: "CREATE",
      name: card.name,
      classId: card.classId,
      originId: card.originId,
      identity: card.identity,
    });
  };

  const download = (toExport: CharacterCard[]) => {
    const blob = new Blob([exportCharacters(toExport)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toExport.length === 1 ? `${slug(toExport[0]!.name)}.json` : "aetherbound-characters.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${toExport.length} card${toExport.length === 1 ? "" : "s"}.`);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const count = importCharacters(await file.text());
      refresh();
      setNotice(`Imported ${count} character card${count === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That file could not be imported.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <main className="library">
      <header className="library-head">
        <div>
          <button className="link back" onClick={() => dispatch({ type: "BACK_TITLE" })}>← Title</button>
          <p className="eyebrow">The Bound archive · alpha</p>
          <h2>Character library</h2>
          <p className="blurb">Keep complete character cards, carry them between browsers, or send one straight into a new tale.</p>
        </div>
        <div className="library-actions">
          <button className="btn primary" onClick={() => dispatch({ type: "NEW_GAME" })}>Create character</button>
          <button className="btn" onClick={() => fileInput.current?.click()}>Import JSON</button>
          <button className="btn" onClick={() => download(cards.filter((card) => !card.starter))} disabled={!cards.some((card) => !card.starter)}>
            Export mine
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </div>
      </header>

      <div className="library-tools">
        <input
          aria-label="Search characters"
          placeholder="Search name, origin, calling…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Filter characters" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="all">All callings</option>
          <option value="favorites">Favorites</option>
          {(Object.keys(CLASSES) as ClassId[]).map((classId) => (
            <option key={classId} value={classId}>{CLASSES[classId].name}</option>
          ))}
        </select>
        <span className="muted">{visible.length} shown · {cards.filter((card) => !card.starter).length} saved by you</span>
      </div>
      {notice && <p className="library-notice" role="status">{notice}</p>}

      <div className="library-layout">
        <section className="library-grid" aria-label="Character cards">
          {visible.map((card) => (
            <button
              key={card.id}
              className={`library-tile ${selected?.id === card.id ? "on" : ""}`}
              onClick={() => setSelectedId(card.id)}
            >
              <Portrait {...card.identity} />
              <span>
                <strong>{card.favorite ? "★ " : ""}{card.name}</strong>
                <small>{CLASSES[card.classId].name} · {ORIGINS[card.originId].name}</small>
                <small>{card.identity.epithet}</small>
              </span>
              {card.starter && <em>Starter</em>}
            </button>
          ))}
          {!visible.length && <p className="empty-state">No characters match this search.</p>}
        </section>

        {selected && <CharacterDetail
          card={selected}
          onBegin={() => begin(selected)}
          onExport={() => download([selected])}
          onDuplicate={() => {
            const copy = duplicateCharacter(selected);
            refresh(copy.id);
            setNotice(`Saved ${copy.name}.`);
          }}
          onFavorite={selected.starter ? undefined : () => {
            toggleFavorite(selected.id);
            refresh(selected.id);
          }}
          onDelete={selected.starter ? undefined : () => {
            if (!window.confirm(`Delete ${selected.name} from your library?`)) return;
            deleteCharacter(selected.id);
            const next = loadCharacters();
            setCards(next);
            setSelectedId(next[0]?.id ?? "");
            setNotice("Character deleted.");
          }}
        />}
      </div>
    </main>
  );
}

function CharacterDetail({
  card,
  onBegin,
  onExport,
  onDuplicate,
  onFavorite,
  onDelete,
}: {
  card: CharacterCard;
  onBegin: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
}) {
  const player = createPlayer(card.name, card.classId, card.originId, card.identity);
  return (
    <aside className="character-detail">
      <div className="detail-hero">
        <Portrait {...card.identity} />
        <div>
          <p className="eyebrow">{card.starter ? "Starter card" : "Saved character"}</p>
          <h3>{card.name}</h3>
          <p className="creed">{card.identity.epithet}</p>
        </div>
      </div>
      <p>{card.notes.concept || CLASSES[card.classId].blurb}</p>
      <dl className="identity-list">
        <div><dt>Origin</dt><dd>{ORIGINS[card.originId].name}</dd></div>
        <div><dt>Calling</dt><dd>{CLASSES[card.classId].name}</dd></div>
        <div><dt>Nature</dt><dd>{TEMPERS[card.identity.temper].name} · {VIRTUES[card.identity.virtue].name} / {VICES[card.identity.vice].name}</dd></div>
        <div><dt>Wound</dt><dd>Fears {FEARS[card.identity.fear].name.toLowerCase()} · driven to {DRIVES[card.identity.drive].name.toLowerCase()}</dd></div>
        <div><dt>Mark</dt><dd>{MARKS[card.identity.mark].name}</dd></div>
        <div><dt>Signature</dt><dd>{SKILLS[card.identity.signatureSkill]?.name ?? card.identity.signatureSkill}</dd></div>
      </dl>
      <div className="stat-strip">
        {Object.entries(player.stats).map(([stat, score]) => <span key={stat}><small>{stat}</small><b>{score}</b></span>)}
      </div>
      {(["appearance", "backstory", "bonds", "voice"] as const).map((field) => card.notes[field] && (
        <section className="detail-note" key={field}>
          <h4>{field}</h4>
          <p>{card.notes[field]}</p>
        </section>
      ))}
      <div className="detail-actions">
        <button className="btn primary" onClick={onBegin}>Begin this tale</button>
        {onFavorite && <button className="btn" onClick={onFavorite}>{card.favorite ? "Unfavorite" : "Favorite"}</button>}
        <button className="btn" onClick={onDuplicate}>Duplicate</button>
        <button className="btn" onClick={onExport}>Export</button>
        {onDelete && <button className="link danger" onClick={onDelete}>Delete</button>}
      </div>
    </aside>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "character";
}
