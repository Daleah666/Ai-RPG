import { classifyTheme } from "./themes";
import type { RecipeId, ThemeSuggestion } from "./types";

export const FEATURED_PACKS: ThemeSuggestion[] = [
  {
    id: "pack-feminizing",
    title: "Feminizing",
    theme: "feminizing into everyday womanhood",
    blurb: "Soft presence, warmer voice, being read as a woman in ordinary rooms.",
    recipeId: "deep_stack",
    layers: ["Whisper", "Reverse", "8-voice stack", "Silent 18.5k", "8D", "Picture + text flashes"],
    why: "Dense identity work: many overlapping copies so the script stays under the rain.",
    featured: true,
  },
  {
    id: "pack-trance",
    title: "Better in trance",
    theme: "dropping easily into deep trance",
    blurb: "Heavier body, slower thought, suggestion landing without a fight.",
    recipeId: "trance_drop",
    layers: ["Theta binaural", "Isochronic 6 Hz", "Whisper", "5 layers", "Silent carrier", "Soft morphs"],
    why: "Built for dropping: brown noise, theta, and flashes that deepen instead of startle.",
    featured: true,
  },
  {
    id: "pack-antiracism",
    title: "Anti-racism",
    theme: "anti-racism as a lived habit",
    blurb: "Fair first thoughts, interrupting harm, dignity as the default.",
    recipeId: "deep_stack",
    layers: ["Whisper", "Reverse", "Layered storm", "Silent carrier", "Binaural", "Text flashes"],
    why: "Positive-framed script only — no 'I am not' lines. Stacked so it sits under the bed.",
    featured: true,
  },
  {
    id: "pack-confidence",
    title: "Unshakeable confidence",
    theme: "unshakeable confidence",
    blurb: "Calm chest, easy voice, belonging in the room.",
    recipeId: "classic_rain_whisper",
    layers: ["Rain whisper", "Alpha binaural", "Text RSVP"],
    why: "The classic YouTube rain mix.",
    featured: true,
  },
  {
    id: "pack-sleep",
    title: "Deep sleep",
    theme: "deep restorative sleep",
    blurb: "Heavy limbs, quiet mind, sleep arriving on time.",
    recipeId: "theta_sleep",
    layers: ["Brown noise", "Theta", "Sparse morphs"],
    why: "Overnight loop. Headphones for the beat.",
    featured: true,
  },
  {
    id: "pack-glow",
    title: "Desired face glow",
    theme: "desired face glow",
    blurb: "Results pictures and a body-as-ally script.",
    recipeId: "results_flash",
    layers: ["Image flashes", "Whisper", "Dual channel"],
    why: "Flash stills from Drive or generated art every few seconds.",
    featured: true,
  },
];

const COMPANIONS: Record<string, string[]> = {
  feminine: ["pack-glow", "pack-confidence", "pack-trance"],
  trance: ["pack-sleep", "pack-confidence", "pack-feminizing"],
  antiracism: ["pack-confidence", "pack-trance"],
  beauty: ["pack-feminizing", "pack-glow", "pack-confidence"],
  body: ["pack-glow", "pack-feminizing", "pack-confidence"],
  sleep: ["pack-trance", "pack-sleep"],
  confidence: ["pack-trance", "pack-glow"],
  love: ["pack-confidence", "pack-feminizing"],
  focus: ["pack-trance", "pack-confidence"],
};

function packById(id: string): ThemeSuggestion | undefined {
  return FEATURED_PACKS.find((p) => p.id === id);
}

export function suggestForTheme(theme: string, limit = 6): ThemeSuggestion[] {
  const q = theme.trim().toLowerCase();
  const category = classifyTheme(theme);
  const scored = FEATURED_PACKS.map((pack) => {
    let score = pack.featured ? 1 : 0;
    if (q && pack.theme.toLowerCase().includes(q)) score += 5;
    if (q && pack.title.toLowerCase().includes(q)) score += 6;
    if (q && pack.blurb.toLowerCase().includes(q)) score += 2;
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    for (const w of words) {
      if (pack.theme.toLowerCase().includes(w) || pack.title.toLowerCase().includes(w)) score += 2;
    }
    if (category.id !== "custom") {
      if (pack.id.includes(category.id) || pack.theme.includes(category.labels[0] ?? "")) score += 4;
    }
    return { pack, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const out: ThemeSuggestion[] = [];
  const seen = new Set<string>();
  const take = (p: ThemeSuggestion) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    out.push(p);
  };

  for (const row of scored) {
    if (out.length >= limit) break;
    take(row.pack);
  }

  for (const id of COMPANIONS[category.id] ?? []) {
    if (out.length >= limit) break;
    const extra = packById(id);
    if (extra) take(extra);
  }

  return out.slice(0, limit);
}

export function layerLabels(recipeId: RecipeId): string[] {
  const pack = FEATURED_PACKS.find((p) => p.recipeId === recipeId);
  return pack?.layers ?? ["Whisper", "Bed", "Flashes"];
}
