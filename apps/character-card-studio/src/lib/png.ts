const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CARD_KEYWORDS = ["chara", "ccv3"];

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToUtf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((value, i) => bytes[i] === value);
}

type Chunk = { type: string; data: Uint8Array; start: number; end: number };

function readChunks(bytes: Uint8Array): Chunk[] {
  if (!isPng(bytes)) throw new Error("That file is not a PNG image.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("The PNG file is truncated or damaged.");
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length), start: offset, end });
    offset = end;
    if (type === "IEND") break;
  }
  return chunks;
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

export function readPngText(bytes: Uint8Array): Record<string, string> {
  const result: Record<string, string> = {};
  for (const chunk of readChunks(bytes)) {
    if (chunk.type !== "tEXt") continue;
    const sep = chunk.data.indexOf(0);
    if (sep < 0) continue;
    result[latin1(chunk.data.subarray(0, sep))] = latin1(chunk.data.subarray(sep + 1));
  }
  return result;
}

/** Returns the card JSON text embedded in a PNG, preferring V3 (ccv3) over V2 (chara). */
export function extractCardJsonFromPng(bytes: Uint8Array): string {
  const text = readPngText(bytes);
  const payload = text.ccv3 ?? text.chara;
  if (!payload) throw new Error("This PNG has no character card data inside it.");
  try {
    return base64ToUtf8(payload);
  } catch {
    throw new Error("The card data inside this PNG is damaged.");
  }
}

function makeTextChunk(keyword: string, value: string): Uint8Array {
  const body = new Uint8Array(keyword.length + 1 + value.length);
  for (let i = 0; i < keyword.length; i++) body[i] = keyword.charCodeAt(i);
  body[keyword.length] = 0;
  for (let i = 0; i < value.length; i++) body[keyword.length + 1 + i] = value.charCodeAt(i) & 0xff;

  const typeAndBody = new Uint8Array(4 + body.length);
  typeAndBody.set([116, 69, 88, 116], 0);
  typeAndBody.set(body, 4);

  const chunk = new Uint8Array(12 + body.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.length);
  chunk.set(typeAndBody, 4);
  view.setUint32(8 + body.length, crc32(typeAndBody));
  return chunk;
}

/** Writes V2 (`chara`) and V3 (`ccv3`) card JSON into a PNG, replacing any card data already present. */
export function embedCardInPng(png: Uint8Array, v2Json: string, v3Json?: string): Uint8Array {
  const kept: Uint8Array[] = [png.subarray(0, 8)];
  let iend: Uint8Array | null = null;
  for (const chunk of readChunks(png)) {
    const raw = png.subarray(chunk.start, chunk.end);
    if (chunk.type === "IEND") {
      iend = raw;
      continue;
    }
    if (chunk.type === "tEXt") {
      const sep = chunk.data.indexOf(0);
      const keyword = sep >= 0 ? latin1(chunk.data.subarray(0, sep)) : "";
      if (CARD_KEYWORDS.includes(keyword)) continue;
    }
    kept.push(raw);
  }
  if (!iend) throw new Error("The PNG file has no end marker.");
  kept.push(makeTextChunk("chara", utf8ToBase64(v2Json)));
  if (v3Json) kept.push(makeTextChunk("ccv3", utf8ToBase64(v3Json)));
  kept.push(iend);

  const out = new Uint8Array(kept.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of kept) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
