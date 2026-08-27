export const METHOD_IDS = [
  "whisper_mask",
  "backmask",
  "speed_stack",
  "silent_omega",
  "binaural",
  "isochronic",
  "layered_storm",
  "eight_d",
  "flash_images",
  "text_rsvp",
  "frame_insert",
  "morph_overlay",
  "void_mirror",
  "dual_channel",
] as const;

export type MethodId = (typeof METHOD_IDS)[number];

export type VisualMode =
  | "void"
  | "flash_images"
  | "text_rsvp"
  | "morph_overlay"
  | "frame_insert"
  | "dual";

export type AudioBed =
  | "rain"
  | "ocean"
  | "forest"
  | "white"
  | "pink"
  | "brown"
  | "pad"
  | "silence";

export type BrainwavePreset = "delta" | "theta" | "alpha" | "beta" | "off";

export type AssetSource = "upload" | "drive" | "generated" | "folder";

export type VisualAsset = {
  id: string;
  name: string;
  mimeType: string;
  source: AssetSource;
  driveFileId?: string;
  dataUrl?: string;
  svg?: string;
};

export type VisualConfig = {
  mode: VisualMode;
  flashDurationMs: number;
  intervalMs: number;
  opacity: number;
  mask: "none" | "forward" | "noise";
  textColor: string;
  bgColor: string;
  carrier: "black" | "gradient" | "image";
};

export type AudioConfig = {
  bed: AudioBed;
  affirmationGainDb: number;
  reverse: boolean;
  alsoForward: boolean;
  speed: number;
  layers: number;
  whisper: boolean;
  binaural: {
    enabled: boolean;
    carrierHz: number;
    beatHz: number;
  };
  isochronic: {
    enabled: boolean;
    hz: number;
  };
  silentCarrier: {
    enabled: boolean;
    hz: number;
    depth: number;
  };
  eightD: boolean;
};

export type RecipeId =
  | "classic_rain_whisper"
  | "silent_omega"
  | "results_flash"
  | "twenty_fifth_frame"
  | "theta_sleep"
  | "affirmation_storm"
  | "dual_hemisphere"
  | "boosted_mirror"
  | "night_loop"
  | "aesthetic_lofi"
  | "speed_compressed"
  | "morph_void";

export type ThemeCategory =
  | "confidence"
  | "wealth"
  | "love"
  | "body"
  | "sleep"
  | "focus"
  | "beauty"
  | "health"
  | "luck"
  | "academic"
  | "custom";

export type Palette = {
  bg: string;
  fg: string;
  accent: string;
  mist: string;
};

export type SubliminalProject = {
  id: string;
  name: string;
  theme: string;
  category: ThemeCategory;
  createdAt: string;
  durationSec: number;
  affirmations: string[];
  methods: MethodId[];
  recipeId: RecipeId;
  visual: VisualConfig;
  audio: AudioConfig;
  assets: VisualAsset[];
  palette: Palette;
  notes: string[];
};

export type GenerateInput = {
  theme: string;
  durationSec?: number;
  methods?: Array<MethodId | "auto">;
  recipeId?: string;
  affirmationCount?: number;
  name?: string;
  includeStills?: boolean;
};

export type DriveFolder = {
  id: string;
  name: string;
};
