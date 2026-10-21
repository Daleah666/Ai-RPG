import { PROFILE_FIELDS } from "./profile";
import type { Character, CheckResult } from "./types";

export const MIN_AGE = 18;
const MAX_AGE = 10000;

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
  "schoolgirl",
  "schoolboy",
  "middle school",
  "elementary school",
  "grade school",
  "kindergarten",
];

const BLOCKED_WORD_RE = /\b(child|children|kid|kids|toddler|infant|minor|minors|tween|tweens|jailbait)\b/i;
const UNDER_EIGHTEEN_AGE_RE =
  /\b(1[0-7]|[1-9])\s*-?\s*(years?\s*-?\s*old|yr\.?\s*-?\s*old|y\/o|yo)\b/i;
const SPELLED_UNDERAGE_RE =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)\s*-?\s*years?\s*-?\s*old\b/i;
const UNDER_EIGHTEEN_PHRASE_RE = /\b(under\s*18|u18|u-18)\b/i;

function collectText(character: Partial<Character>): string {
  const profile = character.profile;
  return [
    character.name,
    character.nickname,
    character.description,
    character.personality,
    character.scenario,
    character.firstMes,
    character.mesExample,
    character.systemPrompt,
    character.postHistoryInstructions,
    character.creatorNotes,
    ...(character.alternateGreetings ?? []),
    ...(character.tags ?? []),
    ...(profile ? PROFILE_FIELDS.map(({ key }) => profile[key]) : []),
    ...(character.lorebook?.entries ?? []).flatMap((entry) => [
      entry.content,
      ...entry.keys,
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function findBlockedText(text: string): string[] {
  const lowered = text.toLowerCase();
  const hits: string[] = [];
  for (const term of BLOCKED_TERMS) {
    if (lowered.includes(term)) hits.push(`blocked term: "${term}"`);
  }
  for (const re of [BLOCKED_WORD_RE, UNDER_EIGHTEEN_AGE_RE, SPELLED_UNDERAGE_RE, UNDER_EIGHTEEN_PHRASE_RE]) {
    const match = text.match(re);
    if (match) hits.push(`blocked wording: "${match[0]}"`);
  }
  return [...new Set(hits)];
}

export function validateAdultAge(age: unknown): CheckResult {
  if (typeof age !== "number" || !Number.isInteger(age)) {
    return { ok: false, reasons: [`Age must be a whole number, ${MIN_AGE} or older.`] };
  }
  if (age < MIN_AGE) {
    return { ok: false, reasons: [`Characters must be adults (${MIN_AGE}+). Age ${age} is not allowed.`] };
  }
  if (age > MAX_AGE) {
    return { ok: false, reasons: [`Age ${age} is outside the allowed range.`] };
  }
  return { ok: true };
}

export function checkCharacterSafety(character: Partial<Character>): CheckResult {
  const reasons: string[] = [];
  const age = validateAdultAge(character.age);
  if (!age.ok) reasons.push(...age.reasons);
  reasons.push(...findBlockedText(collectText(character)));
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
