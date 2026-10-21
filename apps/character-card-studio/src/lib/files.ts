import { parseCard, parseCardJson, slugify, toV2Card, toV3Card, type ParsedCard } from "./card";
import { normalizeCharacter } from "./db";
import { newId } from "./defaults";
import { isBackup, makeBackup } from "./library";
import { embedCardInPng, extractCardJsonFromPng, isPng } from "./png";
import type { Character } from "./types";

const MAX_AVATAR = 768;

export type ImportOutcome =
  | { kind: "cards"; cards: ParsedCard[] }
  | { kind: "backup"; characters: Character[] };

function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }));
  });
}

export async function readImportFile(file: File): Promise<ImportOutcome> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isPng(bytes)) {
    const parsed = parseCardJson(extractCardJsonFromPng(bytes));
    parsed.character.avatar = await resizeImage(await bytesToDataUrl(bytes, "image/png"));
    return { kind: "cards", cards: [parsed] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Not a character card. Use a .json or .png card file.");
  }
  if (isBackup(raw)) {
    return {
      kind: "backup",
      characters: raw.characters.map((c) => normalizeCharacter({ ...c })),
    };
  }
  if (Array.isArray(raw)) return { kind: "cards", cards: raw.map((item) => parseCard(item)) };
  return { kind: "cards", cards: [parseCard(raw)] };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be loaded."));
    img.src = src;
  });
}

export async function resizeImage(src: string, max = MAX_AVATAR): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function placeholderAvatar(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 600;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = avatarColor(name);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 160px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials(name), 200, 300);
  return canvas.toDataURL("image/png");
}

async function avatarPngBytes(character: Character): Promise<Uint8Array> {
  const src = character.avatar ?? placeholderAvatar(character.name);
  const png = await resizeImage(src, 2048);
  const b64 = png.slice(png.indexOf(",") + 1);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function jsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
}

export type ExportKind = "png" | "v2" | "v3";

export async function exportCharacter(character: Character, kind: ExportKind): Promise<void> {
  const slug = slugify(character.name);
  if (kind === "v2") return downloadBlob(`${slug}.v2.json`, jsonBlob(toV2Card(character)));
  if (kind === "v3") return downloadBlob(`${slug}.v3.json`, jsonBlob(toV3Card(character)));
  const png = embedCardInPng(
    await avatarPngBytes(character),
    JSON.stringify(toV2Card(character)),
    JSON.stringify(toV3Card(character)),
  );
  downloadBlob(`${slug}.png`, new Blob([png as BlobPart], { type: "image/png" }));
}

export function exportBackup(characters: Character[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(`card-studio-library-${stamp}.json`, jsonBlob(makeBackup(characters)));
}

export function duplicateCharacter(character: Character): Character {
  const now = Date.now();
  return {
    ...structuredClone(character),
    id: newId(),
    name: `${character.name} (copy)`,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}
