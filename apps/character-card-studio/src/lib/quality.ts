import { fullDescription, PROFILE_FIELDS } from "./profile";
import { checkCharacterSafety } from "./safety";
import { estimateTokens } from "./tokens";
import type { Character } from "./types";

export type TipLevel = "error" | "warn" | "tip";

export type QualityTip = { level: TipLevel; field: string; message: string };

export type QualityReport = {
  score: number;
  permanentTokens: number;
  tips: QualityTip[];
};

/** Tokens the card costs on every single message (description, personality, scenario, system prompt). */
export function permanentTokens(character: Character): number {
  return estimateTokens(
    [fullDescription(character), character.personality, character.scenario, character.systemPrompt].join("\n"),
  );
}

export function checkQuality(character: Character): QualityReport {
  const tips: QualityTip[] = [];
  const add = (level: TipLevel, field: string, message: string) => tips.push({ level, field, message });

  const safety = checkCharacterSafety(character);
  if (!safety.ok) for (const reason of safety.reasons) add("error", "Safety", reason);

  const checks: [boolean, number][] = [];
  const score = (passed: boolean, weight: number) => checks.push([passed, weight]);

  const name = character.name.trim();
  score(Boolean(name), 10);
  if (!name) add("error", "Name", "Give the character a name. Cards cannot be saved without one.");

  const descTokens = estimateTokens(fullDescription(character));
  score(descTokens >= 80, 15);
  if (descTokens < 80) {
    add("warn", "Description", "The description is thin. Models invent details to fill gaps, so describe looks, history, and how they act (aim for 150–600 tokens).");
  }

  score(Boolean(character.personality.trim()), 8);
  if (!character.personality.trim()) {
    add("tip", "Personality", "Add a short personality summary (5–15 traits or a few sentences). Many frontends show it separately.");
  }

  score(Boolean(character.scenario.trim()), 7);
  if (!character.scenario.trim()) {
    add("tip", "Scenario", "Set a scenario: where and why {{char}} and {{user}} meet. It anchors the first scene.");
  }

  const greeting = character.firstMes.trim();
  score(estimateTokens(greeting) >= 40, 15);
  if (!greeting) {
    add("error", "First message", "Write a first message. It is the strongest example of voice and reply length the model copies.");
  } else if (estimateTokens(greeting) < 40) {
    add("warn", "First message", "The first message is very short; replies will tend to be just as short.");
  }
  if (greeting && !/\{\{user\}\}/i.test(greeting + character.scenario)) {
    add("tip", "First message", "Mention {{user}} in the greeting or scenario so the bot knows who it is talking to.");
  }
  if (/\{\{user\}\}\s*(says|said|thinks|feels|nods|smiles)/i.test(greeting)) {
    add("warn", "First message", "The greeting writes {{user}}'s actions. Bots copy this and start speaking for the user.");
  }

  const examples = character.mesExample.trim();
  score(Boolean(examples), 12);
  if (!examples) {
    add("warn", "Example dialogue", "Add 2–3 example exchanges. Start each with <START> and use {{user}}: / {{char}}: lines.");
  } else if (!examples.includes("<START>")) {
    add("tip", "Example dialogue", "Separate example exchanges with <START> so frontends can split and trim them.");
  }

  const filledProfile = PROFILE_FIELDS.filter(({ key }) => character.profile[key].trim()).length;
  score(filledProfile >= 5, 13);
  if (filledProfile < 5) {
    add("tip", "Profile", `Only ${filledProfile} of ${PROFILE_FIELDS.length} profile fields are filled. Speech style, quirks, goals, and fears matter most for depth.`);
  }
  if (filledProfile > 0 && !character.includeProfileInDescription) {
    add("warn", "Profile", "Profile fields are filled but not included in the description, so the model will not see them.");
  }

  score(character.tags.length >= 2, 5);
  if (character.tags.length < 2) add("tip", "Tags", "Add a few tags so you can find this card in the library.");

  score(Boolean(character.avatar), 5);
  if (!character.avatar) add("tip", "Avatar", "Add an avatar. It is needed for PNG card export.");

  score(character.alternateGreetings.some((g) => g.trim()), 5);

  const perm = permanentTokens(character);
  score(perm <= 1500, 5);
  if (perm > 1500) {
    add("warn", "Size", `Permanent tokens are about ${perm}. Over ~1500 eats chat memory on small-context models; move side facts into the lorebook.`);
  }

  for (const entry of character.lorebook.entries) {
    const label = entry.comment || entry.keys[0] || "untitled entry";
    if (!entry.constant && entry.keys.length === 0) {
      add("warn", "Lorebook", `"${label}" has no keys, so it will never trigger. Add keys or mark it constant.`);
    }
    if (!entry.content.trim()) add("warn", "Lorebook", `"${label}" has no content.`);
    if (entry.selective && entry.secondaryKeys.length === 0) {
      add("tip", "Lorebook", `"${label}" is selective but has no secondary keys, so it behaves like a normal entry.`);
    }
  }

  const total = checks.reduce((sum, [, weight]) => sum + weight, 0);
  const earned = checks.reduce((sum, [passed, weight]) => sum + (passed ? weight : 0), 0);
  const order: Record<TipLevel, number> = { error: 0, warn: 1, tip: 2 };
  tips.sort((a, b) => order[a.level] - order[b.level]);
  return { score: Math.round((earned / total) * 100), permanentTokens: perm, tips };
}
