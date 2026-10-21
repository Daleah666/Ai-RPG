export type Profile = {
  pronouns: string;
  species: string;
  occupation: string;
  appearance: string;
  outfit: string;
  backstory: string;
  speechStyle: string;
  quirks: string;
  likes: string;
  dislikes: string;
  goals: string;
  fears: string;
  relationships: string;
  secrets: string;
};

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type RpgSheet = {
  enabled: boolean;
  race: string;
  className: string;
  level: number;
  alignment: string;
  abilities: Record<AbilityKey, number>;
  hp: number;
  ac: number;
  skills: string;
  inventory: string;
  spells: string;
};

export type LorePosition = "before_char" | "after_char";

export type LoreEntry = {
  id: string;
  comment: string;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  caseSensitive: boolean;
  insertionOrder: number;
  priority: number;
  position: LorePosition;
};

export type Lorebook = {
  name: string;
  description: string;
  scanDepth: number;
  tokenBudget: number;
  recursiveScanning: boolean;
  entries: LoreEntry[];
};

export type Character = {
  id: string;
  name: string;
  nickname: string;
  age: number;
  avatar: string | null;
  tags: string[];
  creator: string;
  version: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  alternateGreetings: string[];
  mesExample: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creatorNotes: string;
  profile: Profile;
  includeProfileInDescription: boolean;
  rpg: RpgSheet;
  lorebook: Lorebook;
  favorite: boolean;
  /** Unknown card extensions kept so re-exporting does not drop other tools' data. */
  extraExtensions: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type CheckResult = { ok: true } | { ok: false; reasons: string[] };
