import type { Character, LoreEntry, Lorebook, Profile, RpgSheet } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyProfile(): Profile {
  return {
    pronouns: "",
    species: "",
    occupation: "",
    appearance: "",
    outfit: "",
    backstory: "",
    speechStyle: "",
    quirks: "",
    likes: "",
    dislikes: "",
    goals: "",
    fears: "",
    relationships: "",
    secrets: "",
  };
}

export function emptyRpg(): RpgSheet {
  return {
    enabled: false,
    race: "",
    className: "",
    level: 1,
    alignment: "",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: 10,
    ac: 10,
    skills: "",
    inventory: "",
    spells: "",
  };
}

export function emptyLorebook(): Lorebook {
  return {
    name: "",
    description: "",
    scanDepth: 4,
    tokenBudget: 512,
    recursiveScanning: false,
    entries: [],
  };
}

export function newLoreEntry(order = 100): LoreEntry {
  return {
    id: newId(),
    comment: "",
    keys: [],
    secondaryKeys: [],
    content: "",
    enabled: true,
    constant: false,
    selective: false,
    caseSensitive: false,
    insertionOrder: order,
    priority: 10,
    position: "before_char",
  };
}

export function newCharacter(partial: Partial<Character> = {}): Character {
  const now = Date.now();
  return {
    id: newId(),
    name: "",
    nickname: "",
    age: 18,
    avatar: null,
    tags: [],
    creator: "",
    version: "1",
    description: "",
    personality: "",
    scenario: "",
    firstMes: "",
    alternateGreetings: [],
    mesExample: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    creatorNotes: "",
    profile: emptyProfile(),
    includeProfileInDescription: true,
    rpg: emptyRpg(),
    lorebook: emptyLorebook(),
    favorite: false,
    extraExtensions: {},
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
