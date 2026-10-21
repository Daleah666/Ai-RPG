import { useMemo, useRef, useState, type DragEvent } from "react";
import type { Toast } from "../App";
import { duplicateCharacter, exportBackup, exportCharacter, type ExportKind } from "../lib/files";
import { DEFAULT_QUERY, filterLibrary, tagCounts, type LibraryQuery, type SortKey } from "../lib/library";
import { checkQuality } from "../lib/quality";
import type { Character } from "../lib/types";
import { Avatar } from "./Avatar";

type Props = {
  characters: Character[];
  onOpen: (character: Character) => void;
  onImport: (files: File[]) => Promise<Character[]>;
  onSave: (character: Character) => Promise<void>;
  onDelete: (character: Character) => Promise<void>;
  notify: (toast: Toast) => void;
};

const SORTS: [SortKey, string][] = [
  ["updated", "Recently edited"],
  ["created", "Newest"],
  ["name", "Name A–Z"],
  ["tokens", "Biggest (tokens)"],
];

export function LibraryView({ characters, onOpen, onImport, onSave, onDelete, notify }: Props) {
  const [query, setQuery] = useState<LibraryQuery>(DEFAULT_QUERY);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => filterLibrary(characters, query), [characters, query]);
  const tags = useMemo(() => tagCounts(characters).slice(0, 24), [characters]);
  const scores = useMemo(
    () => new Map(characters.map((c) => [c.id, checkQuality(c)])),
    [characters],
  );

  const toggleTag = (tag: string) =>
    setQuery((q) => ({
      ...q,
      tags: q.tags.includes(tag) ? q.tags.filter((t) => t !== tag) : [...q.tags, tag],
    }));

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length) await onImport(files);
  };

  const doExport = async (character: Character, kind: ExportKind) => {
    try {
      await exportCharacter(character, kind);
    } catch (error) {
      notify({ kind: "error", text: `Export failed: ${(error as Error).message}` });
    }
  };

  return (
    <section
      className={dragging ? "library dragging" : "library"}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search name, tags, class, job…"
          value={query.search}
          onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value }))}
        />
        <select
          value={query.sort}
          onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as SortKey }))}
          aria-label="Sort"
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={query.favoritesOnly}
            onChange={(e) => setQuery((q) => ({ ...q, favoritesOnly: e.target.checked }))}
          />
          Favorites
        </label>
        <span className="spacer" />
        <button onClick={() => fileInput.current?.click()}>Import cards</button>
        <button onClick={() => exportBackup(characters)} disabled={!characters.length}>
          Back up library
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.png,application/json,image/png"
          multiple
          hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) await onImport(files);
          }}
        />
      </div>

      {tags.length > 0 && (
        <div className="tagbar">
          {tags.map(([tag, count]) => (
            <button
              key={tag}
              className={query.tags.includes(tag) ? "chip active" : "chip"}
              onClick={() => toggleTag(tag)}
            >
              {tag} <span className="count">{count}</span>
            </button>
          ))}
          {(query.tags.length > 0 || query.search || query.favoritesOnly) && (
            <button className="chip clear" onClick={() => setQuery({ ...DEFAULT_QUERY, sort: query.sort })}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <p className="muted small">
        {visible.length} of {characters.length} cards · Drop .png or .json card files anywhere here to import
        (SillyTavern, Chub, Character Companion, v1/v2/v3).
      </p>

      {visible.length === 0 ? (
        <div className="empty">
          {characters.length === 0
            ? "Your library is empty. Click “+ New card” or import a card file."
            : "No cards match these filters."}
        </div>
      ) : (
        <div className="grid">
          {visible.map((character) => {
            const report = scores.get(character.id)!;
            return (
              <article key={character.id} className="card-tile">
                <button className="tile-open" onClick={() => onOpen(character)} title="Open in editor">
                  <Avatar name={character.name} src={character.avatar} className="tile-avatar" />
                  <div className="tile-body">
                    <h3>{character.name}</h3>
                    <p className="muted small">
                      {[
                        character.profile.species,
                        character.rpg.enabled && character.rpg.className
                          ? `${character.rpg.className} ${character.rpg.level}`
                          : character.profile.occupation,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "\u00a0"}
                    </p>
                    <div className="tile-tags">
                      {character.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="mini-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
                <div className="tile-meta">
                  <span className={`score s${Math.floor(report.score / 34)}`} title="Card completeness">
                    {report.score}%
                  </span>
                  <span className="muted small" title="Estimated permanent tokens">
                    ~{report.permanentTokens} tok
                  </span>
                  {character.lorebook.entries.length > 0 && (
                    <span className="muted small" title="Lorebook entries">
                      📖 {character.lorebook.entries.length}
                    </span>
                  )}
                </div>
                <div className="tile-actions">
                  <button
                    className={character.favorite ? "icon fav on" : "icon fav"}
                    title={character.favorite ? "Unfavorite" : "Favorite"}
                    onClick={() => onSave({ ...character, favorite: !character.favorite })}
                  >
                    {character.favorite ? "★" : "☆"}
                  </button>
                  <button
                    className="icon"
                    title="Duplicate"
                    onClick={async () => {
                      await onSave(duplicateCharacter(character));
                      notify({ kind: "ok", text: `Duplicated ${character.name}.` });
                    }}
                  >
                    ⧉
                  </button>
                  <select
                    className="export-select"
                    value=""
                    aria-label={`Export ${character.name}`}
                    onChange={(e) => doExport(character, e.target.value as ExportKind)}
                  >
                    <option value="" disabled>
                      Export…
                    </option>
                    <option value="png">PNG card</option>
                    <option value="v2">JSON (v2)</option>
                    <option value="v3">JSON (v3)</option>
                  </select>
                  <button className="icon danger" title="Delete" onClick={() => onDelete(character)}>
                    🗑
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {dragging && <div className="drop-overlay">Drop card files to import</div>}
    </section>
  );
}
