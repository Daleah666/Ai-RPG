import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import { LibraryView } from "./components/LibraryView";
import { deleteCharacter, listCharacters, saveCharacter, saveMany } from "./lib/db";
import { newCharacter } from "./lib/defaults";
import { readImportFile } from "./lib/files";
import { checkCharacterSafety, MIN_AGE } from "./lib/safety";
import { SEED_FLAG, seedCharacters } from "./lib/seed";
import type { Character } from "./lib/types";

type View = { name: "library" } | { name: "editor"; character: Character; isNew: boolean };

export type Toast = { kind: "ok" | "error"; text: string };

function askAge(name: string): number | null {
  const answer = window.prompt(
    `"${name}" has no age in the card. Enter the character's age (${MIN_AGE}+) to import it, or cancel to skip.`,
  );
  if (answer === null) return null;
  const age = Number.parseInt(answer, 10);
  return Number.isFinite(age) ? age : null;
}

export default function App() {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [view, setView] = useState<View>({ name: "library" });
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((next: Toast) => {
    setToast(next);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), next.kind === "error" ? 9000 : 3500);
  }, []);

  const reload = useCallback(async () => setCharacters(await listCharacters()), []);

  useEffect(() => {
    (async () => {
      try {
        const existing = await listCharacters();
        if (existing.length === 0 && !localStorage.getItem(SEED_FLAG)) {
          const seeds = seedCharacters();
          await saveMany(seeds);
          localStorage.setItem(SEED_FLAG, "1");
          setCharacters(seeds);
          return;
        }
        setCharacters(existing);
      } catch (error) {
        setCharacters([]);
        notify({ kind: "error", text: `Could not open the library: ${(error as Error).message}` });
      }
    })();
  }, [notify]);

  const importFiles = useCallback(
    async (files: File[]) => {
      const saved: Character[] = [];
      const problems: string[] = [];
      for (const file of files) {
        try {
          const outcome = await readImportFile(file);
          if (outcome.kind === "backup") {
            const ok = window.confirm(
              `Restore ${outcome.characters.length} character(s) from this library backup? Cards with the same id will be overwritten.`,
            );
            if (!ok) continue;
            const safe = outcome.characters.filter((c) => {
              const result = checkCharacterSafety(c);
              if (!result.ok) problems.push(`${c.name || file.name}: ${result.reasons[0]}`);
              return result.ok;
            });
            await saveMany(safe);
            saved.push(...safe);
            continue;
          }
          for (const { character, ageKnown } of outcome.cards) {
            if (!ageKnown) {
              const age = askAge(character.name);
              if (age === null) {
                problems.push(`${character.name}: skipped (no age given)`);
                continue;
              }
              character.age = age;
            }
            const result = checkCharacterSafety(character);
            if (!result.ok) {
              problems.push(`${character.name}: blocked — ${result.reasons.join("; ")}`);
              continue;
            }
            await saveCharacter(character);
            saved.push(character);
          }
        } catch (error) {
          problems.push(`${file.name}: ${(error as Error).message}`);
        }
      }
      await reload();
      if (problems.length) {
        notify({
          kind: "error",
          text: `Imported ${saved.length}. Problems:\n${problems.join("\n")}`,
        });
      } else if (saved.length) {
        notify({ kind: "ok", text: `Imported ${saved.length} character${saved.length === 1 ? "" : "s"}.` });
      }
      return saved;
    },
    [notify, reload],
  );

  const upsert = useCallback(
    async (character: Character) => {
      await saveCharacter(character);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (character: Character) => {
      if (!window.confirm(`Delete "${character.name}"? This cannot be undone (export it first if unsure).`)) return;
      await deleteCharacter(character.id);
      await reload();
      notify({ kind: "ok", text: `Deleted ${character.name}.` });
      setView({ name: "library" });
    },
    [notify, reload],
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: "library" })}>
          Character Card Studio <span className="badge">alpha</span>
        </button>
        <nav>
          <button
            className={view.name === "library" ? "tab active" : "tab"}
            onClick={() => setView({ name: "library" })}
          >
            Library
          </button>
          <button
            className="primary"
            onClick={() => setView({ name: "editor", character: newCharacter(), isNew: true })}
          >
            + New card
          </button>
        </nav>
      </header>

      <main>
        {characters === null ? (
          <p className="muted center">Loading library…</p>
        ) : view.name === "library" ? (
          <LibraryView
            characters={characters}
            onOpen={(character) => setView({ name: "editor", character, isNew: false })}
            onImport={importFiles}
            onSave={upsert}
            onDelete={remove}
            notify={notify}
          />
        ) : (
          <Editor
            key={view.character.id}
            initial={view.character}
            isNew={view.isNew}
            onSave={async (character) => {
              await upsert(character);
              setView({ name: "editor", character, isNew: false });
              notify({ kind: "ok", text: `Saved ${character.name}.` });
            }}
            onClose={() => setView({ name: "library" })}
            onDelete={remove}
            notify={notify}
          />
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.kind}`} role="status" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
