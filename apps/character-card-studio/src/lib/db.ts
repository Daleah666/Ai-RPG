import { emptyLorebook, emptyProfile, emptyRpg, newCharacter } from "./defaults";
import type { Character } from "./types";

const DB_NAME = "character-card-studio";
const STORE = "characters";
const DB_VERSION = 1;

/** Fills in fields added in later versions so older saves and backups keep loading. */
export function normalizeCharacter(raw: Partial<Character>): Character {
  const base = newCharacter();
  return {
    ...base,
    ...raw,
    id: raw.id || base.id,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    alternateGreetings: Array.isArray(raw.alternateGreetings) ? raw.alternateGreetings : [],
    profile: { ...emptyProfile(), ...raw.profile },
    rpg: {
      ...emptyRpg(),
      ...raw.rpg,
      abilities: { ...emptyRpg().abilities, ...raw.rpg?.abilities },
    },
    lorebook: {
      ...emptyLorebook(),
      ...raw.lorebook,
      entries: Array.isArray(raw.lorebook?.entries) ? raw.lorebook.entries : [],
    },
    extraExtensions: raw.extraExtensions ?? {},
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the browser database."));
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error ?? new Error("Database write failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Database write was aborted (storage may be full)."));
  });
}

export async function listCharacters(): Promise<Character[]> {
  const rows = (await run<Character[]>("readonly", (store) => store.getAll())) ?? [];
  return rows.map(normalizeCharacter);
}

export async function saveCharacter(character: Character): Promise<void> {
  await run("readwrite", (store) => store.put(character));
}

export async function saveMany(characters: Character[]): Promise<void> {
  await run("readwrite", (store) => {
    for (const character of characters) store.put(character);
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
