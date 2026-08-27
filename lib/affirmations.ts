import { classifyTheme, tokenizeTheme, type CategoryModel } from "./themes";

const NEGATIVE =
  /\b(not|never|don't|dont|can't|cant|won't|wont|no longer|stop being|without|isn't|isnt|aren't)\b/i;

function titleCaseTheme(theme: string): string {
  return theme
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function polish(line: string): string {
  let s = line.replace(/\s+/g, " ").trim();
  s = s.replace(/\bI am not\b/gi, "I am");
  s = s.replace(/\bI don't\b/gi, "I");
  s = s.replace(/\bI do not\b/gi, "I");
  if (!/[.!?]$/.test(s)) s += ".";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (NEGATIVE.test(s)) return "";
  if (s.split(" ").length > 18) return "";
  return s;
}

function unique(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = polish(raw);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function fill(template: string, theme: string, tokens: string[]): string {
  const noun = tokens.slice(0, 3).join(" ") || theme.trim();
  return template
    .replaceAll("{theme}", theme.trim())
    .replaceAll("{Theme}", titleCaseTheme(theme))
    .replaceAll("{noun}", noun)
    .replaceAll("{one}", tokens[0] || theme.trim());
}

const GENERIC = [
  "I am {theme} in a way that feels true",
  "I allow {noun} to be ordinary in my life",
  "It is like me to live {noun}",
  "I choose {noun} in small decisions all day",
  "I am becoming the person who already has {noun}",
  "I feel {one} in my body as a simple fact",
  "I notice {noun} showing up in the details",
  "People respond to the {one} in me",
  "I am grateful that {noun} is unfolding",
  "My days are arranged around {noun}",
  "I remember {noun} the way I remember my name",
  "I wake already aligned with {theme}",
  "I rest in the feeling of {noun}",
  "I act from {noun} without forcing",
  "Every cell of me cooperates with {theme}",
  "I keep promises to myself about {noun}",
  "I am safe to have {noun}",
  "I am ready for {Theme}",
  "This version of me carries {noun} easily",
  "I return to {noun} whenever my mind wanders",
];

const PERSPECTIVE = {
  identity: [
    "I am the kind of person {theme} happens through",
    "I am consistent with {noun}",
    "I am already living {theme}",
  ],
  feeling: [
    "I feel {noun} as warmth and ease",
    "I feel settled inside {theme}",
  ],
  seeing: [
    "I see proof of {noun} in my day",
    "I watch {theme} become my baseline",
  ],
  doing: [
    "I naturally take the next action for {noun}",
    "I follow through on {theme} without drama",
  ],
  social: [
    "People treat me as someone with {noun}",
    "The world meets my {one} with respect",
  ],
};

export function generateAffirmations(
  theme: string,
  count = 36,
  category?: CategoryModel,
): string[] {
  const cat = category ?? classifyTheme(theme);
  const tokens = tokenizeTheme(theme);
  const pool: string[] = [];

  const buckets: string[][] = [
    cat.identity,
    cat.feeling,
    cat.evidence,
    cat.social,
    cat.gratitude,
    cat.sensory,
  ];
  for (const bucket of buckets) {
    for (const line of bucket) pool.push(line);
  }

  for (const t of GENERIC) pool.push(fill(t, theme, tokens));
  for (const group of Object.values(PERSPECTIVE)) {
    for (const t of group) pool.push(fill(t, theme, tokens));
  }

  if (tokens.length) {
    pool.push(`I am ${tokens.join(" ")}`);
    pool.push(`${titleCaseTheme(theme)} is my natural state`);
    pool.push(`I embody ${tokens[0]} now`);
  }

  const out = unique(pool);
  if (out.length >= count) return out.slice(0, count);

  let i = 0;
  while (out.length < count && i < 80) {
    const extra = polish(`I live ${theme.trim()} in way ${out.length + 1}`);
    const variant = polish(
      `I am aligned with ${theme.trim()} on an ordinary ${["morning", "afternoon", "evening", "night"][i % 4]}`,
    );
    if (variant) out.push(variant);
    i += 1;
    if (extra && !out.includes(extra)) {
      /* skip numbered junk */
    }
  }
  return unique(out).slice(0, count);
}

export function scriptFromAffirmations(lines: string[]): string {
  return lines.join(". ");
}
