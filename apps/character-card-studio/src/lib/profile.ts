import type { AbilityKey, Character, Profile, RpgSheet } from "./types";

export type ProfileField = {
  key: keyof Profile;
  label: string;
  hint: string;
  multiline: boolean;
};

export const PROFILE_FIELDS: ProfileField[] = [
  { key: "pronouns", label: "Pronouns", hint: "she/her, he/him, they/them…", multiline: false },
  { key: "species", label: "Species / race", hint: "Human, elf, kitsune, android…", multiline: false },
  { key: "occupation", label: "Occupation / role", hint: "What they do all day.", multiline: false },
  { key: "appearance", label: "Appearance", hint: "Body, face, hair, eyes, height, distinguishing marks.", multiline: true },
  { key: "outfit", label: "Usual outfit", hint: "What they normally wear and carry.", multiline: true },
  { key: "backstory", label: "Backstory", hint: "Where they came from and what shaped them.", multiline: true },
  { key: "speechStyle", label: "Speech style", hint: "Accent, vocabulary, catchphrases, sentence length.", multiline: true },
  { key: "quirks", label: "Quirks & habits", hint: "Small repeated behaviours that make them feel real.", multiline: true },
  { key: "likes", label: "Likes", hint: "Comma list is fine.", multiline: false },
  { key: "dislikes", label: "Dislikes", hint: "Comma list is fine.", multiline: false },
  { key: "goals", label: "Goals", hint: "What they want right now and long-term.", multiline: true },
  { key: "fears", label: "Fears & flaws", hint: "Weak points create drama.", multiline: true },
  { key: "relationships", label: "Relationships", hint: "Family, friends, rivals, and how they see {{user}}.", multiline: true },
  { key: "secrets", label: "Secrets", hint: "Hidden info the bot reveals slowly.", multiline: true },
];

export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatModifier(score: number): string {
  const mod = abilityModifier(score);
  return mod >= 0 ? `+${mod}` : String(mod);
}

/** W++-free plain prose block: models follow labelled lines well and it stays human-readable. */
export function compileProfile(profile: Profile): string {
  const lines = PROFILE_FIELDS.map(({ key, label }) => {
    const value = profile[key].trim();
    return value ? `${label}: ${value}` : "";
  }).filter(Boolean);
  return lines.join("\n");
}

export function compileRpg(rpg: RpgSheet): string {
  if (!rpg.enabled) return "";
  const head = [
    rpg.race,
    rpg.className ? `${rpg.className} ${rpg.level}` : `Level ${rpg.level}`,
    rpg.alignment,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  const abilities = ABILITY_KEYS.map(
    (key) => `${key.toUpperCase()} ${rpg.abilities[key]} (${formatModifier(rpg.abilities[key])})`,
  ).join(" | ");
  const lines = [
    `RPG sheet: ${head}`,
    `HP ${rpg.hp}, AC ${rpg.ac}`,
    abilities,
    rpg.skills.trim() && `Skills: ${rpg.skills.trim()}`,
    rpg.inventory.trim() && `Inventory: ${rpg.inventory.trim()}`,
    rpg.spells.trim() && `Spells & abilities: ${rpg.spells.trim()}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** The description text that goes into exported cards and the prompt preview. */
export function fullDescription(character: Character): string {
  const parts = [character.description.trim()];
  if (character.includeProfileInDescription) {
    const profile = compileProfile(character.profile);
    if (profile) parts.push(`[${character.name || "{{char}}"}'s profile]\n${profile}`);
    const rpg = compileRpg(character.rpg);
    if (rpg) parts.push(rpg);
  }
  return parts.filter(Boolean).join("\n\n");
}
