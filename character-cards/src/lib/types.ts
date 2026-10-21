export type LorePosition = "before_char" | "after_char" | "at_depth";

export type LoreEntry = {
  id: string;
  name: string;
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
  depth: number;
  comment: string;
};

/** A character card with the fields a long chat actually uses. */
export type DepthCard = {
  id: string;
  name: string;
  age: number;
  avatarDataUrl: string | null;
  tags: string[];
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  alternateGreetings: string[];
  groupGreetings: string[];
  mesExample: string;
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  depthPrompt: string;
  depthPromptDepth: number;
  creator: string;
  characterVersion: string;
  lore: LoreEntry[];
  loreScanDepth: number;
  loreTokenBudget: number;
  createdAt: number;
  updatedAt: number;
};

export type CardDraft = Omit<DepthCard, "id" | "createdAt" | "updatedAt">;

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: Exclude<ChatRole, "system">;
  content: string;
  createdAt: number;
};

export type ChatThread = {
  characterId: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type CompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AppSettings = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  userName: string;
  guideDismissed: boolean;
};

export type SafetyResult = { ok: true } | { ok: false; reasons: string[] };

export type CardSource = "v1" | "v2" | "v3";

export type ParsedCard = {
  draft: CardDraft;
  source: CardSource;
  preservedId: string | null;
};
