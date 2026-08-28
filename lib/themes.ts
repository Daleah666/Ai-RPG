import type { AudioBed, BrainwavePreset, Palette, RecipeId, ThemeCategory } from "./types";

export type CategoryModel = {
  id: ThemeCategory;
  labels: string[];
  identity: string[];
  feeling: string[];
  evidence: string[];
  social: string[];
  gratitude: string[];
  sensory: string[];
  palette: Palette;
  bed: AudioBed;
  brainwave: BrainwavePreset;
  recipe: RecipeId;
};

export const CATEGORIES: CategoryModel[] = [
  {
    id: "confidence",
    labels: [
      "confidence",
      "self worth",
      "self-worth",
      "self esteem",
      "brave",
      "unshakeable",
      "magnetic",
      "charisma",
      "social anxiety",
      "speak",
      "voice",
    ],
    identity: [
      "I am calm, clear, and sure of myself",
      "I trust my presence in every room",
      "I am grounded in my own worth",
      "I speak with ease and warmth",
      "I am someone people feel safe around",
    ],
    feeling: [
      "I feel steady in my chest and open in my throat",
      "I feel proud of how I carry myself",
      "I feel relaxed being fully seen",
    ],
    evidence: [
      "I notice conversations opening for me",
      "I notice my posture rising without effort",
      "I notice compliments arriving as simple facts",
    ],
    social: [
      "People treat me as someone who belongs",
      "People listen when I speak",
      "People feel my quiet certainty",
    ],
    gratitude: [
      "I am grateful for the confidence that already lives in me",
      "I am grateful that self-trust feels natural now",
    ],
    sensory: [
      "My voice lands warm, even, and sure",
      "My eyes stay soft and direct",
    ],
    palette: { bg: "#0b0b0c", fg: "#f3ead7", accent: "#c4a35a", mist: "#8a8173" },
    bed: "rain",
    brainwave: "alpha",
    recipe: "classic_rain_whisper",
  },
  {
    id: "wealth",
    labels: [
      "wealth",
      "money",
      "rich",
      "abundance",
      "income",
      "luxury",
      "millionaire",
      "prosperity",
      "business",
      "success",
    ],
    identity: [
      "I am a natural steward of money",
      "I allow wealth to move through my life",
      "I am paid well for the value I give",
      "I make clean, timely money decisions",
      "I am comfortable with more",
    ],
    feeling: [
      "I feel ease around money",
      "I feel excited by incoming opportunities",
      "I feel safe expanding my income",
    ],
    evidence: [
      "I notice money arriving from expected and unexpected places",
      "I notice invoices clearing quickly",
      "I notice my accounts growing with calm regularity",
    ],
    social: [
      "People pay me with respect and speed",
      "People bring me lucrative collaborations",
    ],
    gratitude: [
      "I am grateful for the money already circulating in my life",
      "I am grateful that prosperity feels familiar",
    ],
    sensory: [
      "I feel the weight of quality in my hands",
      "I hear the quiet of a well-funded life",
    ],
    palette: { bg: "#0c0d0b", fg: "#f4e7c3", accent: "#d4b15e", mist: "#8d8366" },
    bed: "pad",
    brainwave: "alpha",
    recipe: "aesthetic_lofi",
  },
  {
    id: "love",
    labels: [
      "love",
      "relationship",
      "soulmate",
      "romance",
      "partner",
      "marriage",
      "attraction",
      "self love",
      "self-love",
    ],
    identity: [
      "I am open, warm, and easy to love",
      "I am a safe and devoted partner",
      "I receive love without bracing",
      "I choose relationships that nourish me",
    ],
    feeling: [
      "I feel cherished in ordinary moments",
      "I feel soft and available",
      "I feel love moving both ways",
    ],
    evidence: [
      "I notice affection showing up in small consistent ways",
      "I notice my heart staying open",
    ],
    social: [
      "People meet me with kindness and interest",
      "My person chooses me clearly",
    ],
    gratitude: [
      "I am grateful for the love I already know how to give",
      "I am grateful that intimacy feels simple",
    ],
    sensory: [
      "I feel a warm hand in mine",
      "I hear my name spoken with care",
    ],
    palette: { bg: "#120c10", fg: "#f6e4ea", accent: "#d4788a", mist: "#a1848c" },
    bed: "ocean",
    brainwave: "theta",
    recipe: "morph_void",
  },
  {
    id: "body",
    labels: [
      "body",
      "weight",
      "slim",
      "fit",
      "desired face",
      "desired body",
      "glow up",
      "glow-up",
      "skinny",
      "muscle",
      "waist",
    ],
    identity: [
      "I am at home in my body",
      "I am becoming the shape that feels like me",
      "I treat my body as an ally",
      "I glow from the inside out",
    ],
    feeling: [
      "I feel light, strong, and comfortable",
      "I feel attractive without performing",
      "I feel my body cooperating with me",
    ],
    evidence: [
      "I notice my reflection pleasing me more each day",
      "I notice clothes sitting the way I like",
    ],
    social: [
      "People see me as radiant and well",
      "People notice my glow before I speak",
    ],
    gratitude: [
      "I am grateful my body knows how to change with me",
      "I am grateful for vitality I can feel",
    ],
    sensory: [
      "I feel energy moving easily through my limbs",
      "I see clear skin and bright eyes",
    ],
    palette: { bg: "#0e0c0b", fg: "#f3e6d8", accent: "#e0a078", mist: "#9a8778" },
    bed: "rain",
    brainwave: "alpha",
    recipe: "results_flash",
  },
  {
    id: "sleep",
    labels: ["sleep", "insomnia", "rest", "dream", "night", "calm", "anxiety", "peace"],
    identity: [
      "I am a person who sleeps deeply",
      "I release the day as soon as I lie down",
      "I am safe enough to rest",
    ],
    feeling: [
      "I feel heavy, warm, and unhurried",
      "I feel my thoughts slowing into quiet",
      "I feel night holding me",
    ],
    evidence: [
      "I notice sleep arriving on time",
      "I notice mornings feeling restored",
    ],
    social: [
      "People find me rested and gentle",
    ],
    gratitude: [
      "I am grateful for the dark and the quiet",
      "I am grateful my nervous system knows how to switch off",
    ],
    sensory: [
      "My breath is long and low",
      "My muscles melt into the bed",
    ],
    palette: { bg: "#08090e", fg: "#dce3f2", accent: "#7f93c4", mist: "#6d7388" },
    bed: "brown",
    brainwave: "delta",
    recipe: "theta_sleep",
  },
  {
    id: "focus",
    labels: [
      "focus",
      "study",
      "productivity",
      "discipline",
      "work",
      "adhd",
      "concentration",
      "flow",
    ],
    identity: [
      "I am a focused person",
      "I start and I finish",
      "I give one thing my full attention",
      "I am disciplined without harshness",
    ],
    feeling: [
      "I feel clear and interested",
      "I feel time stretching in a useful way",
    ],
    evidence: [
      "I notice tasks completing themselves through me",
      "I notice distraction losing its pull",
    ],
    social: [
      "People rely on my follow-through",
    ],
    gratitude: [
      "I am grateful for a mind that can lock in",
    ],
    sensory: [
      "My eyes stay on the work",
      "My hands keep moving with purpose",
    ],
    palette: { bg: "#0b0d10", fg: "#e7eef6", accent: "#7eb0c9", mist: "#74808a" },
    bed: "brown",
    brainwave: "beta",
    recipe: "speed_compressed",
  },
  {
    id: "beauty",
    labels: ["beauty", "pretty", "handsome", "skin", "hair", "face", "symmetry", "clear skin"],
    identity: [
      "I am strikingly myself",
      "I am easy on the eyes and easier to remember",
      "I am growing into my most harmonious face",
    ],
    feeling: [
      "I feel beautiful without checking",
      "I feel light on my skin",
    ],
    evidence: [
      "I notice my features settling into balance",
      "I notice my skin looking calm and clear",
    ],
    social: [
      "People find me beautiful in a way they cannot name",
    ],
    gratitude: [
      "I am grateful for the face I am living in",
    ],
    sensory: [
      "I see brightness in my eyes",
      "I feel smoothness across my skin",
    ],
    palette: { bg: "#120e0c", fg: "#f7eadf", accent: "#e2b48a", mist: "#a89080" },
    bed: "ocean",
    brainwave: "alpha",
    recipe: "results_flash",
  },
  {
    id: "health",
    labels: ["health", "heal", "immune", "energy", "vitality", "pain", "wellness"],
    identity: [
      "I am healing in intelligent ways",
      "I am a body that knows repair",
      "I have energy for the life I want",
    ],
    feeling: [
      "I feel circulation, warmth, and ease",
      "I feel stronger after rest",
    ],
    evidence: [
      "I notice symptoms softening",
      "I notice stamina returning",
    ],
    social: [
      "People comment on how well I look",
    ],
    gratitude: [
      "I am grateful for every system working with me",
    ],
    sensory: [
      "My breath is full and quiet",
      "My body feels clean and capable",
    ],
    palette: { bg: "#0b100e", fg: "#e6f3ea", accent: "#7fb89a", mist: "#7a8c82" },
    bed: "forest",
    brainwave: "theta",
    recipe: "night_loop",
  },
  {
    id: "luck",
    labels: ["luck", "manifest", "synchronicity", "opportunity", "desired reality", "sp", "loa"],
    identity: [
      "I am lucky in a boring, reliable way",
      "I live in a friendly universe",
      "I am aligned with timing",
    ],
    feeling: [
      "I feel doors opening ahead of me",
      "I feel expected by good events",
    ],
    evidence: [
      "I notice coincidences stacking in my favor",
      "I notice the right message arriving on time",
    ],
    social: [
      "People appear when I need them",
    ],
    gratitude: [
      "I am grateful that life keeps arranging itself for me",
    ],
    sensory: [
      "I feel a click of rightness in my day",
    ],
    palette: { bg: "#100e16", fg: "#ece4fb", accent: "#b79be0", mist: "#8b829c" },
    bed: "pad",
    brainwave: "theta",
    recipe: "silent_omega",
  },
  {
    id: "academic",
    labels: ["exam", "grades", "intelligence", "memory", "school", "university", "iq", "genius"],
    identity: [
      "I am a fast, accurate learner",
      "I recall what I need when I need it",
      "I am intelligent in practical ways",
    ],
    feeling: [
      "I feel curious instead of panicked",
      "I feel information sticking",
    ],
    evidence: [
      "I notice answers arriving cleanly",
      "I notice study sessions compounding",
    ],
    social: [
      "People take my thinking seriously",
    ],
    gratitude: [
      "I am grateful for a mind that organizes well",
    ],
    sensory: [
      "My attention is sharp and cool",
    ],
    palette: { bg: "#0c1014", fg: "#e4eef8", accent: "#8fb4d4", mist: "#7a8794" },
    bed: "brown",
    brainwave: "beta",
    recipe: "speed_compressed",
  },
  {
    id: "feminine",
    labels: [
      "feminine",
      "feminizing",
      "feminise",
      "feminize",
      "femme",
      "womanhood",
      "girl voice",
      "softer",
      "transfemme",
      "trans femme",
    ],
    identity: [
      "I am at home in a feminine way of being",
      "I move through the world as a woman in ordinary ways",
      "My presence reads soft, clear, and feminine",
      "I trust the woman I already am",
      "My voice, face, and manner belong together",
    ],
    feeling: [
      "I feel softness in my face and ease in my chest",
      "I feel pretty in an everyday, unforced way",
      "I feel safe being seen as feminine",
    ],
    evidence: [
      "I notice my voice sitting higher and warmer",
      "I notice my reflection matching how I feel inside",
      "I notice people using the name and words that fit me",
    ],
    social: [
      "People meet me as a woman without hesitation",
      "People relax around my feminine presence",
    ],
    gratitude: [
      "I am grateful my body cooperates with who I am",
      "I am grateful femininity feels like home",
    ],
    sensory: [
      "My gestures are light and unhurried",
      "My voice lands warm, round, and sure",
    ],
    palette: { bg: "#140d12", fg: "#f7e6ee", accent: "#e39ab0", mist: "#a88894" },
    bed: "rain",
    brainwave: "alpha",
    recipe: "deep_stack",
  },
  {
    id: "trance",
    labels: [
      "trance",
      "hypnosis",
      "hypnotic",
      "suggestible",
      "drop",
      "induction",
      "deeper",
      "somnambul",
    ],
    identity: [
      "I am someone who drops into trance easily",
      "Trance is a skill I enjoy and trust",
      "I follow useful suggestion with my whole attention",
      "I go deeper whenever I am invited to go deeper",
    ],
    feeling: [
      "I feel heavy, warm, and willing",
      "I feel thoughts slowing into a single point",
      "I feel safe handing the next moment over",
    ],
    evidence: [
      "I notice my eyes wanting to close",
      "I notice time stretching in a pleasant way",
      "I notice suggestion landing without argument",
    ],
    social: [
      "A trusted guide finds me an easy, gifted subject",
    ],
    gratitude: [
      "I am grateful my mind knows how to let go",
      "I am grateful trance feels like rest with a purpose",
    ],
    sensory: [
      "My limbs are pleasantly heavy",
      "My breath is slow and the room is far away",
    ],
    palette: { bg: "#0a0c14", fg: "#dde4f6", accent: "#8aa0d8", mist: "#7a8298" },
    bed: "brown",
    brainwave: "theta",
    recipe: "trance_drop",
  },
  {
    id: "antiracism",
    labels: [
      "anti-racism",
      "antiracism",
      "anti racism",
      "racist",
      "racism",
      "bias",
      "prejudice",
      "ally",
      "equity",
      "solidarity",
    ],
    identity: [
      "I treat every person as fully human",
      "I am someone who notices bias and moves anyway",
      "I am a safe person across difference",
      "I keep learning with humility and speed",
      "I stand with people who are harmed",
    ],
    feeling: [
      "I feel steady when I name harm",
      "I feel respect as a bodily habit",
      "I feel responsible in a way that is useful",
    ],
    evidence: [
      "I notice my first thought and I choose a fairer one",
      "I notice whose voice is missing and I make room",
      "I notice I repair quickly when I miss",
    ],
    social: [
      "People of every background feel my respect",
      "People trust me to interrupt harm without a speech",
    ],
    gratitude: [
      "I am grateful for teachers who tell me the truth",
      "I am grateful that dignity is my default",
    ],
    sensory: [
      "My listening is open and my jaw is soft",
      "I look people in the eye as equals",
    ],
    palette: { bg: "#0c100e", fg: "#e8f0e8", accent: "#c4a35a", mist: "#8a9188" },
    bed: "rain",
    brainwave: "alpha",
    recipe: "deep_stack",
  },
];

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "for",
  "my",
  "me",
  "i",
  "in",
  "on",
  "with",
  "into",
  "desired",
]);

export function tokenizeTheme(theme: string): string[] {
  return theme
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function classifyTheme(theme: string): CategoryModel {
  const hay = theme.toLowerCase();
  let best: CategoryModel = {
    ...CATEGORIES[0],
    id: "custom",
    recipe: "classic_rain_whisper",
    bed: "rain",
    brainwave: "alpha",
    palette: { bg: "#0a0a0b", fg: "#efe7d6", accent: "#c4a35a", mist: "#9a9488" },
  };
  let score = 0;
  for (const cat of CATEGORIES) {
    const hits = cat.labels.filter((l) => hay.includes(l)).length;
    if (hits > score) {
      score = hits;
      best = cat;
    }
  }
  if (score === 0) {
    return { ...best, id: "custom" };
  }
  return best;
}

export function brainwaveHz(preset: BrainwavePreset): number {
  switch (preset) {
    case "delta":
      return 2.5;
    case "theta":
      return 6;
    case "alpha":
      return 10;
    case "beta":
      return 18;
    default:
      return 0;
  }
}
