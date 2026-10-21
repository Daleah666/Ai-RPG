import type { SafetyResult } from "./types";

const MIN_AGE = 18;
const MAX_AGE = 120;

const BLOCKED_TERMS = [
  "loli",
  "lolita",
  "lolicon",
  "shota",
  "shotacon",
  "underage",
  "under-age",
  "under age",
  "preteen",
  "pre-teen",
  "prepubescent",
  "pre-pubescent",
  "pedophile",
  "pedophilia",
  "child porn",
  "child pornography",
  "schoolgirl",
  "schoolboy",
  "middle school",
  "elementary school",
  "grade school",
  "kindergarten",
  "teenager",
  "jailbait",
];

const BLOCKED_WORD_RE =
  /\b(child|children|kid|kids|toddler|infant|minor|minors|tween|tweens|teen|teens)\b/i;

const UNDER_EIGHTEEN_AGE_RE =
  /\b(1[0-7]|[1-9])\s*-?\s*(years?\s*-?\s*old|yr\.?\s*-?\s*old|y\/o|yo)\b/i;

const SPELLED_UNDERAGE_RE =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\s*-?\s*years?\s*-?\s*old\b/i;

const UNDER_EIGHTEEN_PHRASE_RE = /\b(under\s*18|u18|u-18|18\s*minus)\b/i;

export type SafetyText = {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMes?: string;
  mesExample?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  depthPrompt?: string;
  tags?: string[];
  alternateGreetings?: string[];
  groupGreetings?: string[];
  lore?: { name?: string; content?: string; keys?: string[]; comment?: string }[];
};

function collectText(draft: SafetyText): string {
  const loreBits = (draft.lore ?? []).flatMap((entry) => [
    entry.name,
    entry.content,
    entry.comment,
    ...(entry.keys ?? []),
  ]);
  return [
    draft.name,
    draft.description,
    draft.personality,
    draft.scenario,
    draft.firstMes,
    draft.mesExample,
    draft.creatorNotes,
    draft.systemPrompt,
    draft.postHistoryInstructions,
    draft.depthPrompt,
    ...(draft.tags ?? []),
    ...(draft.alternateGreetings ?? []),
    ...(draft.groupGreetings ?? []),
    ...loreBits,
  ]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join("\n");
}

function findBlockedTerms(text: string): string[] {
  const lowered = text.toLowerCase();
  const hits: string[] = [];

  for (const term of BLOCKED_TERMS) {
    if (lowered.includes(term)) hits.push(`blocked term: "${term}"`);
  }

  const word = text.match(BLOCKED_WORD_RE);
  if (word?.[1]) hits.push(`blocked word: "${word[1]}"`);

  const numericAge = text.match(UNDER_EIGHTEEN_AGE_RE);
  if (numericAge) hits.push(`under-18 age in text: "${numericAge[0]}"`);

  const spelled = text.match(SPELLED_UNDERAGE_RE);
  if (spelled) hits.push(`under-18 age in text: "${spelled[0]}"`);

  const phrase = text.match(UNDER_EIGHTEEN_PHRASE_RE);
  if (phrase) hits.push(`under-18 phrase: "${phrase[0]}"`);

  return [...new Set(hits)];
}

export function validateAdultAge(age: unknown): SafetyResult {
  if (typeof age !== "number" || !Number.isFinite(age) || !Number.isInteger(age)) {
    return { ok: false, reasons: ["Age must be a whole number 18 or older."] };
  }
  if (age < MIN_AGE) {
    return {
      ok: false,
      reasons: [`Characters must be adults (18+). Age ${age} is not allowed.`],
    };
  }
  if (age > MAX_AGE) {
    return { ok: false, reasons: [`Age ${age} is outside the allowed range.`] };
  }
  return { ok: true };
}

export function evaluateCharacterSafety(
  draft: SafetyText & { age?: unknown },
): SafetyResult {
  const reasons: string[] = [];
  const ageResult = validateAdultAge(draft.age);
  if (!ageResult.ok) reasons.push(...ageResult.reasons);
  reasons.push(...findBlockedTerms(collectText(draft)));
  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

export function formatSafetyError(result: SafetyResult): string {
  if (result.ok) return "";
  return [
    "This character was blocked because it looks like a child or minor.",
    "Only adult (18+) characters are allowed.",
    ...result.reasons.map((reason) => `• ${reason}`),
  ].join("\n");
}
