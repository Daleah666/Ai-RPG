const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

type TextChunk = { keyword: string; text: string };

function decodeLatin1(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function encodeLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 255) {
      throw new Error("PNG text chunks in this alpha only carry ASCII or Latin-1 text.");
    }
    out[i] = code;
  }
  return out;
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readTextChunk(type: string, data: Uint8Array): Promise<TextChunk | null> {
  if (type === "tEXt") {
    const split = data.indexOf(0);
    if (split <= 0) return null;
    return {
      keyword: decodeLatin1(data.subarray(0, split)),
      text: decodeLatin1(data.subarray(split + 1)),
    };
  }

  if (type === "zTXt") {
    const split = data.indexOf(0);
    if (split <= 0 || split + 2 > data.length) return null;
    const keyword = decodeLatin1(data.subarray(0, split));
    const inflated = await inflateZlib(data.subarray(split + 2));
    return { keyword, text: new TextDecoder().decode(inflated) };
  }

  if (type === "iTXt") {
    const split = data.indexOf(0);
    if (split <= 0) return null;
    const keyword = decodeLatin1(data.subarray(0, split));
    const compression = data[split + 1] ?? 0;
    let cursor = split + 3;
    const nextNull = (from: number) => {
      for (let i = from; i < data.length; i += 1) if (data[i] === 0) return i;
      return -1;
    };
    const langEnd = nextNull(cursor);
    if (langEnd < 0) return null;
    const transEnd = nextNull(langEnd + 1);
    if (transEnd < 0) return null;
    const payload = data.subarray(transEnd + 1);
    const textBytes = compression === 1 ? await inflateZlib(payload) : payload;
    return { keyword, text: new TextDecoder().decode(textBytes) };
  }

  return null;
}

export async function extractPngText(bytes: Uint8Array): Promise<Record<string, string>> {
  if (!isPng(bytes)) throw new Error("That file is not a PNG.");

  const found: Record<string, string> = {};
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    if (offset + 12 + length > bytes.length) {
      throw new Error("This PNG is cut off before the end.");
    }
    const type = decodeLatin1(bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const chunk = await readTextChunk(type, data);
      if (chunk && found[chunk.keyword] === undefined) found[chunk.keyword] = chunk.text;
    }
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return found;
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToUtf8(value: string): string {
  const cleaned = value.replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Insert a tEXt chunk before IEND so SillyTavern can read the card. */
export function injectPngText(bytes: Uint8Array, keyword: string, text: string): Uint8Array {
  if (!isPng(bytes)) throw new Error("That file is not a PNG.");
  if (!keyword || keyword.includes("\u0000")) throw new Error("PNG keyword is invalid.");

  const keywordBytes = encodeLatin1(keyword);
  const textBytes = encodeLatin1(text);
  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0;
  data.set(textBytes, keywordBytes.length + 1);

  const type = encodeLatin1("tEXt");
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, 4);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(crcInput, 4);
  writeUint32(chunk, 8 + data.length, crc32(crcInput));

  let iend = -1;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const typeName = decodeLatin1(bytes.subarray(offset + 4, offset + 8));
    if (typeName === "IEND") {
      iend = offset;
      break;
    }
    offset += 12 + length;
  }
  if (iend < 0) throw new Error("This PNG has no end chunk.");

  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(bytes.subarray(iend), iend + chunk.length);
  return out;
}
