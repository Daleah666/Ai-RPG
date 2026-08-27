import { generateAffirmations } from "./affirmations";
import { applyCategoryToRecipe, recipeById, RECIPES, type Recipe } from "./recipes";
import { generateThemeStills } from "./stills";
import { classifyTheme } from "./themes";
import { suggestForTheme } from "./suggestions";
import type { GenerateInput, MethodId, RecipeId, SubliminalProject } from "./types";
import { clampVisualTiming } from "./safety";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function pickRecipe(input: GenerateInput): Recipe {
  if (input.recipeId && input.recipeId !== "auto") {
    if (!isRecipeId(input.recipeId)) throw new Error("unknown recipe");
    return recipeById(input.recipeId);
  }
  return recipeById(classifyTheme(input.theme).recipe);
}

export function generateProject(input: GenerateInput): SubliminalProject {
  const theme = input.theme.trim();
  if (!theme) throw new Error("theme is required");
  const category = classifyTheme(theme);
  const recipe = pickRecipe(input);
  const { visual, audio } = applyCategoryToRecipe(recipe, category);
  const timing = clampVisualTiming(visual);
  visual.flashDurationMs = timing.flashDurationMs;
  visual.intervalMs = timing.intervalMs;

  const methods = Array.from(
    new Set<MethodId>([
      ...recipe.methods,
      ...((input.methods ?? []).filter((m): m is MethodId => m !== "auto")),
    ]),
  );

  applyMethodsToConfig(methods, visual, audio);

  const affirmations = generateAffirmations(
    theme,
    Math.min(120, Math.max(12, input.affirmationCount ?? 40)),
    category,
  );

  const assets =
    input.includeStills === false ? [] : generateThemeStills(theme, category.palette, 8);

  const durationSec = Math.min(20 * 60, Math.max(30, input.durationSec ?? 180));
  const suggestions = suggestForTheme(theme).filter((s) => s.theme.toLowerCase() !== theme.toLowerCase());

  if (["feminine", "trance", "antiracism"].includes(category.id)) {
    audio.layers = Math.max(audio.layers, 6);
  }

  return {
    id: id("sub"),
    name: input.name?.trim() || `${theme} · ${recipe.name}`,
    theme,
    category: category.id,
    createdAt: new Date().toISOString(),
    durationSec,
    affirmations,
    methods,
    recipeId: recipe.id,
    visual,
    audio,
    assets,
    palette: category.palette,
    notes: [
      recipe.youtubeHook,
      recipe.notes,
      `${audio.layers} audio layers · reverse ${audio.reverse ? "on" : "off"} · silent ${audio.silentCarrier.enabled ? "on" : "off"}`,
      "This is a creative wellness tool. Evidence for subliminals is mixed; it is not medical treatment.",
    ],
    suggestions,
  };
}

function applyMethodsToConfig(
  methods: MethodId[],
  visual: SubliminalProject["visual"],
  audio: SubliminalProject["audio"],
) {
  const has = (m: MethodId) => methods.includes(m);
  if (has("whisper_mask")) {
    audio.whisper = true;
    audio.affirmationGainDb = Math.min(audio.affirmationGainDb, -18);
  }
  if (has("backmask")) {
    audio.reverse = true;
    audio.alsoForward = true;
  }
  if (has("speed_stack")) audio.speed = Math.max(audio.speed, 1.8);
  if (has("silent_omega")) audio.silentCarrier.enabled = true;
  if (has("binaural")) audio.binaural.enabled = true;
  if (has("isochronic")) audio.isochronic.enabled = true;
  if (has("layered_storm")) audio.layers = Math.max(audio.layers, 6);
  if (has("eight_d")) audio.eightD = true;
  if (has("flash_images")) visual.mode = "flash_images";
  if (has("text_rsvp") && visual.mode === "void") visual.mode = "text_rsvp";
  if (has("frame_insert")) visual.mode = "frame_insert";
  if (has("morph_overlay")) visual.mode = "morph_overlay";
  if (has("void_mirror")) {
    visual.carrier = "black";
    visual.bgColor = "#000000";
  }
  if (has("dual_channel")) visual.mode = "dual";
}

export function listPublicCatalog() {
  return {
    recipes: RECIPES.map((r) => ({
      id: r.id,
      name: r.name,
      youtubeHook: r.youtubeHook,
      methods: r.methods,
    })),
  };
}

export function isRecipeId(value: string): value is RecipeId {
  return RECIPES.some((r) => r.id === value);
}
