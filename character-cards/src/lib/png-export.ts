import { characterToV2Card } from "./card";
import { injectPngText, utf8ToBase64 } from "./png";
import type { DepthCard } from "./types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw the portrait."));
    image.src = src;
  });
}

export async function cardToPngBytes(card: DepthCard): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not draw a PNG.");

  ctx.fillStyle = "#241c16";
  ctx.fillRect(0, 0, 480, 640);
  if (card.avatarDataUrl) {
    try {
      const image = await loadImage(card.avatarDataUrl);
      ctx.drawImage(image, 40, 36, 400, 460);
    } catch {
      ctx.fillStyle = "#3a2e24";
      ctx.fillRect(40, 36, 400, 460);
    }
  }
  ctx.fillStyle = "#f3eadf";
  ctx.font = "600 42px Georgia, serif";
  ctx.fillText(card.name.slice(0, 22), 40, 560);
  ctx.fillStyle = "#d4a574";
  ctx.font = "24px Georgia, serif";
  ctx.fillText(`Age ${card.age}`, 40, 600);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Could not encode the PNG."));
    }, "image/png");
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const payload = utf8ToBase64(JSON.stringify(characterToV2Card(card)));
  return injectPngText(bytes, "chara", payload);
}

export function downloadBytes(filename: string, bytes: Uint8Array, type: string) {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([copy], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
