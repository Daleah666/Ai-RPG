import { activateLore, type LoreActivation } from "./lore";
import { fullDescription } from "./profile";
import { estimateTokens } from "./tokens";
import type { Character } from "./types";

export function applyMacros(text: string, charName: string, userName: string): string {
  return text
    .replace(/\{\{char\}\}|<BOT>/gi, charName || "Character")
    .replace(/\{\{user\}\}|<USER>/gi, userName || "User");
}

export type PromptSection = { label: string; text: string; tokens: number };

export type PromptPreview = {
  sections: PromptSection[];
  lore: LoreActivation;
  totalTokens: number;
};

/** Builds the system prompt a typical SillyTavern-style frontend would send for this card. */
export function buildPromptPreview(
  character: Character,
  userName: string,
  testMessage: string,
): PromptPreview {
  const name = character.name;
  const m = (text: string) => applyMacros(text, name, userName).trim();
  const scan = [character.firstMes, testMessage].join("\n");
  const lore = activateLore(character.lorebook, scan);
  const before = lore.active.filter((e) => e.position === "before_char").map((e) => e.content);
  const after = lore.active.filter((e) => e.position === "after_char").map((e) => e.content);

  const raw: [string, string][] = [
    ["System prompt", character.systemPrompt || `Write ${name}'s next reply in a fictional roleplay with ${userName}.`],
    ["Lore (before character)", before.join("\n")],
    ["Description", fullDescription(character)],
    ["Personality", character.personality ? `${name}'s personality: ${character.personality}` : ""],
    ["Scenario", character.scenario ? `Scenario: ${character.scenario}` : ""],
    ["Lore (after character)", after.join("\n")],
    ["Example dialogue", character.mesExample],
    ["First message", character.firstMes],
    ["Your test message", testMessage],
    ["Post-history instructions", character.postHistoryInstructions],
  ];

  const sections = raw
    .map(([label, text]) => {
      const value = m(text);
      return { label, text: value, tokens: estimateTokens(value) };
    })
    .filter((section) => section.text);
  return {
    sections,
    lore,
    totalTokens: sections.reduce((sum, section) => sum + section.tokens, 0),
  };
}
