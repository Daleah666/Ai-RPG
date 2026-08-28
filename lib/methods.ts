import type { MethodId } from "./types";

export type MethodInfo = {
  id: MethodId;
  name: string;
  kind: "audio" | "visual" | "hybrid";
  youtubeStyle: string;
  summary: string;
};

export const METHODS: MethodInfo[] = [
  {
    id: "whisper_mask",
    name: "Whisper mask",
    kind: "audio",
    youtubeStyle: "Classic rain / music whisper",
    summary:
      "Affirmations sit 17–25 dB under a masking bed so the words are felt more than followed.",
  },
  {
    id: "backmask",
    name: "Backmask",
    kind: "audio",
    youtubeStyle: "Reversed / backwards layer",
    summary:
      "The same script plays reversed (optionally stacked with a quiet forward track).",
  },
  {
    id: "speed_stack",
    name: "Speed stack",
    kind: "audio",
    youtubeStyle: "Compressed / 2x–4x listen",
    summary: "Affirmations run accelerated so many repetitions fit each minute.",
  },
  {
    id: "silent_omega",
    name: "Silent omega",
    kind: "audio",
    youtubeStyle: "Ultrasonic / silent subliminal",
    summary:
      "Voice envelope amplitude-modulates an ~18.5 kHz carrier at the edge of hearing.",
  },
  {
    id: "binaural",
    name: "Binaural beats",
    kind: "audio",
    youtubeStyle: "Theta / alpha headphones track",
    summary: "Left and right carriers a few Hz apart. Headphones required.",
  },
  {
    id: "isochronic",
    name: "Isochronic tones",
    kind: "audio",
    youtubeStyle: "Pulsed tone beds",
    summary: "A single tone gated on and off. Works on speakers.",
  },
  {
    id: "layered_storm",
    name: "Layered storm",
    kind: "audio",
    youtubeStyle: "600-affirmation / multi-voice stack",
    summary: "Many overlapping copies of the script at staggered offsets.",
  },
  {
    id: "eight_d",
    name: "8D pan",
    kind: "audio",
    youtubeStyle: "8D / circling whisper",
    summary: "Slow stereo orbit so the whisper moves around the head.",
  },
  {
    id: "flash_images",
    name: "Image flashes",
    kind: "visual",
    youtubeStyle: "Results-picture flashing",
    summary: "Desired-reality stills from Drive, a folder, or generated art, one to a few frames.",
  },
  {
    id: "text_rsvp",
    name: "Text RSVP",
    kind: "visual",
    youtubeStyle: "Micro-text flashes",
    summary: "Affirmations drawn as brief centered type on the carrier.",
  },
  {
    id: "frame_insert",
    name: "25th-frame insert",
    kind: "visual",
    youtubeStyle: "Single-frame cutaway",
    summary: "A 1-frame insert into a still or gradient carrier, YouTube 24–30 fps style.",
  },
  {
    id: "morph_overlay",
    name: "Morph overlay",
    kind: "visual",
    youtubeStyle: "Low-opacity burn-in",
    summary: "Images sit at 6–15% opacity over the bed so they read as atmosphere.",
  },
  {
    id: "void_mirror",
    name: "Void mirror",
    kind: "visual",
    youtubeStyle: "Black-screen subliminal",
    summary: "True black carrier with sparse white or gold flashes.",
  },
  {
    id: "dual_channel",
    name: "Dual channel",
    kind: "hybrid",
    youtubeStyle: "Visual + audio stack",
    summary: "Image flashes with a masked, optionally reversed audio bed.",
  },
];

export function methodById(id: MethodId): MethodInfo {
  const found = METHODS.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown method ${id}`);
  return found;
}
