export type PortraitMotif =
  | "compass"
  | "lantern"
  | "glaive"
  | "lock"
  | "moon"
  | "quill"
  | "book"
  | "radio"
  | "leaf"
  | "note";

export type PortraitInput = {
  bg: string;
  ink: string;
  accent: string;
  hair: string;
  skin: string;
  motif: PortraitMotif;
};

const MOTIFS: Record<PortraitMotif, string> = {
  compass: `<circle cx="120" cy="250" r="18" fill="none" stroke="currentColor" stroke-width="3"/><path d="M120 236 v28 M106 250 h28 M120 238 l8 12 h-16 z" fill="currentColor"/>`,
  lantern: `<path d="M112 232 h16 l6 8 v22 l-6 8 h-16 l-6-8 v-22 z" fill="currentColor"/><path d="M114 228 h12 M120 222 v6" stroke="currentColor" stroke-width="3" fill="none"/>`,
  glaive: `<path d="M120 220 v48" stroke="currentColor" stroke-width="3"/><path d="M120 220 l10 16 h-20 z" fill="currentColor"/>`,
  lock: `<rect x="106" y="242" width="28" height="22" rx="3" fill="currentColor"/><path d="M112 242 v-8 a8 8 0 0 1 16 0 v8" fill="none" stroke="currentColor" stroke-width="3"/>`,
  moon: `<path d="M128 228 a18 18 0 1 0 0 36 a14 14 0 1 1 0-36 z" fill="currentColor"/>`,
  quill: `<path d="M108 268 l28-40" stroke="currentColor" stroke-width="3"/><path d="M132 224 l8 6 -14 8 z" fill="currentColor"/>`,
  book: `<path d="M104 236 h16 v28 h-16 z M120 236 h16 v28 h-16 z" fill="currentColor"/><path d="M120 236 v28" stroke="#1a1612" stroke-width="2"/>`,
  radio: `<rect x="104" y="236" width="32" height="24" rx="4" fill="currentColor"/><path d="M120 232 v-8 M110 224 a12 12 0 0 1 20 0" fill="none" stroke="currentColor" stroke-width="3"/>`,
  leaf: `<path d="M120 224 c16 8 22 28 0 44 c-22-16 -16-36 0-44 z" fill="currentColor"/>`,
  note: `<path d="M112 232 v28" stroke="currentColor" stroke-width="3"/><circle cx="108" cy="262" r="6" fill="currentColor"/><path d="M112 232 h16 v8 h-16 z" fill="currentColor"/>`,
};

export function portraitDataUrl(input: PortraitInput): string {
  const motif = MOTIFS[input.motif];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
  <rect width="240" height="320" fill="${input.bg}"/>
  <circle cx="120" cy="118" r="78" fill="${input.hair}"/>
  <circle cx="120" cy="128" r="46" fill="${input.skin}"/>
  <path d="M78 112 q42-48 84 0 q-8 18-42 10 q-34 8-42-10z" fill="${input.hair}"/>
  <path d="M62 214 q58 36 116 0 v106 H62z" fill="${input.accent}"/>
  <path d="M96 214 q24 28 48 0" fill="none" stroke="${input.ink}" stroke-width="3" opacity="0.35"/>
  <g color="${input.ink}">${motif}</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
