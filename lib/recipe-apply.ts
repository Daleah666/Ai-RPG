import type { AudioConfig, VisualConfig } from "./types";

type RecipeAudio = Omit<AudioConfig, "binaural"> & {
  binauralPreset?: "delta" | "theta" | "alpha" | "beta" | "off";
};

export function withBinaural(
  recipeAudio: RecipeAudio,
  beatHz: number,
  bed: AudioConfig["bed"],
): AudioConfig {
  const { binauralPreset: _preset, ...rest } = recipeAudio;
  void _preset;
  return {
    ...rest,
    bed,
    binaural: {
      enabled: beatHz > 0,
      carrierHz: 200,
      beatHz: beatHz || 10,
    },
  };
}

export function overlayVisual(
  visual: VisualConfig,
  bgColor: string,
  textColor: string,
): VisualConfig {
  return { ...visual, bgColor, textColor };
}
