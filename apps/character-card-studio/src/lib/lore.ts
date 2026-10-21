import { estimateTokens } from "./tokens";
import type { LoreEntry, Lorebook } from "./types";

const REGEX_KEY_RE = /^\/(.+)\/([gimsuy]*)$/;

export function keyMatches(key: string, text: string, caseSensitive: boolean): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  const regex = trimmed.match(REGEX_KEY_RE);
  if (regex) {
    try {
      return new RegExp(regex[1], regex[2].replace("g", "")).test(text);
    } catch {
      return false;
    }
  }
  return caseSensitive
    ? text.includes(trimmed)
    : text.toLowerCase().includes(trimmed.toLowerCase());
}

function entryTriggered(entry: LoreEntry, text: string): boolean {
  if (entry.constant) return true;
  const primary = entry.keys.some((key) => keyMatches(key, text, entry.caseSensitive));
  if (!primary) return false;
  if (!entry.selective || entry.secondaryKeys.length === 0) return true;
  return entry.secondaryKeys.some((key) => keyMatches(key, text, entry.caseSensitive));
}

export type LoreActivation = {
  active: LoreEntry[];
  droppedForBudget: LoreEntry[];
  tokens: number;
};

/**
 * Mirrors SillyTavern-style world info: constant entries always fire, keyed entries fire
 * when a key appears in the scanned text, and the token budget drops low-priority entries first.
 */
export function activateLore(book: Lorebook, scanText: string): LoreActivation {
  const enabled = book.entries.filter((entry) => entry.enabled && entry.content.trim());
  const triggered = new Set<LoreEntry>();
  let text = scanText;

  for (let pass = 0; pass < 10; pass++) {
    let added = false;
    for (const entry of enabled) {
      if (!triggered.has(entry) && entryTriggered(entry, text)) {
        triggered.add(entry);
        added = true;
      }
    }
    if (!book.recursiveScanning || !added) break;
    text = [scanText, ...[...triggered].map((entry) => entry.content)].join("\n");
  }

  const byPriority = [...triggered].sort(
    (a, b) => b.priority - a.priority || a.insertionOrder - b.insertionOrder,
  );
  const active: LoreEntry[] = [];
  const droppedForBudget: LoreEntry[] = [];
  let tokens = 0;
  for (const entry of byPriority) {
    const cost = estimateTokens(entry.content);
    if (book.tokenBudget > 0 && tokens + cost > book.tokenBudget) {
      droppedForBudget.push(entry);
      continue;
    }
    active.push(entry);
    tokens += cost;
  }
  active.sort((a, b) => a.insertionOrder - b.insertionOrder);
  return { active, droppedForBudget, tokens };
}
