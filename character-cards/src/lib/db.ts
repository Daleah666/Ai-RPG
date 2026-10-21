import { SEED_CHARACTERS, SEED_VERSION } from "../data/library";
import type { ChatMessage, ChatThread, DepthCard } from "./types";

const DB_NAME = "character-cards-depth-alpha";
const DB_VERSION = 1;
const CARD_STORE = "cards";
const CHAT_STORE = "chats";
const META_STORE = "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open the library database."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CARD_STORE)) db.createObjectStore(CARD_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, { keyPath: "characterId" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The library database request failed."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("The library save failed."));
    tx.onabort = () => reject(tx.error ?? new Error("The library save was aborted."));
  });
}

async function putCard(card: DepthCard) {
  const db = await openDb();
  try {
    const tx = db.transaction(CARD_STORE, "readwrite");
    tx.objectStore(CARD_STORE).put(card);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function ensureSeed() {
  const db = await openDb();
  try {
    const seeded = await requestToPromise<string | undefined>(
      db.transaction(META_STORE, "readonly").objectStore(META_STORE).get("seeded"),
    );
    if (seeded === SEED_VERSION) return;

    const now = Date.now();
    for (let index = 0; index < SEED_CHARACTERS.length; index += 1) {
      const seed = SEED_CHARACTERS[index];
      const existing = await requestToPromise<DepthCard | undefined>(
        db.transaction(CARD_STORE, "readonly").objectStore(CARD_STORE).get(seed.id),
      );
      if (existing) continue;
      const tx = db.transaction(CARD_STORE, "readwrite");
      tx.objectStore(CARD_STORE).put({
        ...seed,
        createdAt: now,
        updatedAt: now + (SEED_CHARACTERS.length - index),
      });
      await txDone(tx);
    }

    const meta = db.transaction(META_STORE, "readwrite");
    meta.objectStore(META_STORE).put(SEED_VERSION, "seeded");
    await txDone(meta);
  } finally {
    db.close();
  }
}

export async function listCharacters(): Promise<DepthCard[]> {
  await ensureSeed();
  const db = await openDb();
  try {
    const rows = await requestToPromise<DepthCard[]>(
      db.transaction(CARD_STORE, "readonly").objectStore(CARD_STORE).getAll(),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    db.close();
  }
}

export async function getCharacter(id: string): Promise<DepthCard | null> {
  await ensureSeed();
  const db = await openDb();
  try {
    const row = await requestToPromise<DepthCard | undefined>(
      db.transaction(CARD_STORE, "readonly").objectStore(CARD_STORE).get(id),
    );
    return row ?? null;
  } finally {
    db.close();
  }
}

export async function saveCharacter(card: DepthCard): Promise<void> {
  await putCard(card);
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([CARD_STORE, CHAT_STORE], "readwrite");
    tx.objectStore(CARD_STORE).delete(id);
    tx.objectStore(CHAT_STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function restoreSampleLibrary(): Promise<number> {
  const db = await openDb();
  try {
    const now = Date.now();
    let replaced = 0;
    for (const seed of SEED_CHARACTERS) {
      const tx = db.transaction(CARD_STORE, "readwrite");
      tx.objectStore(CARD_STORE).put({ ...seed, createdAt: now, updatedAt: now });
      await txDone(tx);
      replaced += 1;
    }
    const meta = db.transaction(META_STORE, "readwrite");
    meta.objectStore(META_STORE).put(SEED_VERSION, "seeded");
    await txDone(meta);
    return replaced;
  } finally {
    db.close();
  }
}

export async function getChat(characterId: string): Promise<ChatThread> {
  const db = await openDb();
  try {
    const row = await requestToPromise<ChatThread | undefined>(
      db.transaction(CHAT_STORE, "readonly").objectStore(CHAT_STORE).get(characterId),
    );
    return row ?? { characterId, messages: [], updatedAt: 0 };
  } finally {
    db.close();
  }
}

export async function saveChat(thread: ChatThread): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(CHAT_STORE, "readwrite");
    tx.objectStore(CHAT_STORE).put(thread);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export function newMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  };
}
