import { applyMacros } from "./macros";
import type { ChatMessage, CompletionMessage, DepthCard, LoreEntry } from "./types";

const HISTORY_LIMIT = 40;

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function includesKey(haystack: string, key: string, caseSensitive: boolean): boolean {
  const needle = key.trim();
  if (!needle) return false;
  if (caseSensitive) return haystack.includes(needle);
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function loreMatches(entry: LoreEntry, scanText: string): boolean {
  if (!entry.enabled || !entry.content.trim()) return false;
  if (entry.constant) return true;
  const hit = entry.keys.some((key) => includesKey(scanText, key, entry.caseSensitive));
  if (!hit) return false;
  if (!entry.selective) return true;
  return entry.secondaryKeys.some((key) => includesKey(scanText, key, entry.caseSensitive));
}

export function selectLore(card: DepthCard, scanText: string): LoreEntry[] {
  const matched = card.lore
    .filter((entry) => loreMatches(entry, scanText))
    .sort((a, b) => {
      if (a.constant !== b.constant) return a.constant ? -1 : 1;
      if (a.insertionOrder !== b.insertionOrder) return a.insertionOrder - b.insertionOrder;
      return b.priority - a.priority;
    });

  const kept: LoreEntry[] = [];
  let used = 0;
  for (const entry of matched) {
    const cost = estimateTokens(entry.content);
    if (kept.length > 0 && used + cost > card.loreTokenBudget) continue;
    kept.push(entry);
    used += cost;
  }
  return kept;
}

function loreBlock(entries: LoreEntry[], names: { char: string; user: string }): string {
  return entries
    .map((entry) => {
      const title = entry.name.trim() || entry.keys.join(", ") || "Lore";
      return `[${title}]\n${applyMacros(entry.content, names)}`;
    })
    .join("\n\n");
}

export function buildPrompt(
  card: DepthCard,
  userName: string,
  history: ChatMessage[],
): CompletionMessage[] {
  const names = { char: card.name, user: userName || "You" };
  const fill = (text: string) => applyMacros(text, names);
  const recent = history.slice(-HISTORY_LIMIT);
  const scanText = [
    card.scenario,
    card.description,
    card.personality,
    ...recent.slice(-card.loreScanDepth).map((message) => message.content),
  ].join("\n");
  const lore = selectLore(card, scanText);
  const before = lore.filter((entry) => entry.position !== "at_depth" && entry.position !== "after_char");
  const after = lore.filter((entry) => entry.position === "after_char");
  const atDepth = lore.filter((entry) => entry.position === "at_depth");

  const system = [
    `You are roleplaying as ${card.name}, a fictional adult character (age ${card.age}).`,
    `The person you are talking with is ${names.user}.`,
    "Stay in character. Write in the same style as the greeting.",
    "Never portray anyone under 18. If asked to include a minor, refuse and continue as this adult.",
    fill(card.systemPrompt),
    "",
    "[Description]",
    fill(card.description) || "(none)",
    "",
    "[Personality]",
    fill(card.personality) || "(none)",
    "",
    "[Scenario]",
    fill(card.scenario) || "(none)",
    loreBlock(before, names),
    loreBlock(after, names),
    card.mesExample.trim() ? `\n[Example dialogues]\n${fill(card.mesExample)}` : "",
    card.creatorNotes.trim() ? `\n[Creator notes]\n${fill(card.creatorNotes)}` : "",
  ]
    .filter((part) => part !== "")
    .join("\n")
    .trim();

  const inserts: { depth: number; content: string }[] = atDepth.map((entry) => ({
    depth: entry.depth,
    content: `[Lore · ${entry.name.trim() || entry.keys.join(", ") || "note"}]\n${fill(entry.content)}`,
  }));
  if (card.depthPrompt.trim()) {
    inserts.push({
      depth: card.depthPromptDepth,
      content: `[Depth note]\n${fill(card.depthPrompt)}`,
    });
  }

  const buckets = new Map<number, string[]>();
  for (const insert of inserts) {
    const depth = Math.max(0, insert.depth);
    const list = buckets.get(depth) ?? [];
    list.push(insert.content);
    buckets.set(depth, list);
  }

  const messages: CompletionMessage[] = [{ role: "system", content: system }];
  const count = recent.length;
  const overflow = [...buckets.keys()].filter((depth) => depth > count).sort((a, b) => b - a);
  for (const depth of overflow) {
    for (const content of buckets.get(depth) ?? []) {
      messages.push({ role: "system", content });
    }
  }

  for (let index = 0; index < count; index += 1) {
    const depthHere = count - index;
    for (const content of buckets.get(depthHere) ?? []) {
      messages.push({ role: "system", content });
    }
    const message = recent[index];
    messages.push({ role: message.role, content: fill(message.content) });
  }

  for (const content of buckets.get(0) ?? []) {
    messages.push({ role: "system", content });
  }

  if (card.postHistoryInstructions.trim()) {
    messages.push({
      role: "system",
      content: `[After the chat]\n${fill(card.postHistoryInstructions)}`,
    });
  }

  return messages;
}
