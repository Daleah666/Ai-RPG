"use client";

import { useEffect, useRef } from "react";
import type { SubliminalProject, VisualAsset } from "@/lib/types";

type Props = {
  project: SubliminalProject;
  playing: boolean;
  width?: number;
  height?: number;
  className?: string;
};

type ImgRec = { img: HTMLImageElement; ready: boolean };

export function PreviewStage({ project, playing, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<ImgRec[]>([]);

  useEffect(() => {
    imagesRef.current = (project.assets ?? []).map((asset) => loadAsset(asset));
  }, [project.assets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let start = performance.now();

    const draw = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const t = now - start;
      const vis = project.visual;
      const pal = project.palette;

      fillCarrier(ctx, w, h, vis.carrier, vis.bgColor, pal, t);

      const cycle = vis.flashDurationMs + vis.intervalMs;
      const phase = playing ? t % cycle : vis.intervalMs + 1;
      const flashing = playing && phase < vis.flashDurationMs;
      const dual = vis.mode === "dual";

      if (flashing || vis.mode === "morph_overlay") {
        const idx = Math.floor(t / cycle) % Math.max(1, project.assets.length || 1);
        const rec = imagesRef.current[idx];
        const opacity =
          vis.mode === "morph_overlay" ? vis.opacity : flashing ? vis.opacity : 0;
        if (opacity > 0) {
          ctx.save();
          ctx.globalAlpha = opacity;
          if (rec?.ready) {
            cover(ctx, rec.img, w, h);
          } else if (vis.mode !== "flash_images") {
            drawText(ctx, w, h, pickLine(project, idx), vis.textColor);
          }
          ctx.restore();
        }
        if (flashing && (vis.mode === "text_rsvp" || vis.mode === "void" || dual)) {
          ctx.save();
          ctx.globalAlpha = vis.opacity;
          drawText(ctx, w, h, pickLine(project, Math.floor(t / cycle)), vis.textColor);
          ctx.restore();
        }
        if (flashing && vis.mask === "noise") {
          noise(ctx, w, h, 0.18);
        }
        if (flashing && vis.mask === "forward") {
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(0, 0, w, h);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [project, playing]);

  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={720}
      className={className ?? "h-full w-full rounded-2xl bg-black object-cover"}
    />
  );
}

function pickLine(project: SubliminalProject, i: number) {
  const lines = project.affirmations;
  if (!lines.length) return project.theme;
  return lines[i % lines.length] ?? project.theme;
}

function loadAsset(asset: VisualAsset): ImgRec {
  const rec: ImgRec = { img: new Image(), ready: false };
  rec.img.crossOrigin = "anonymous";
  rec.img.onload = () => {
    rec.ready = true;
  };
  if (asset.dataUrl) rec.img.src = asset.dataUrl;
  return rec;
}

function fillCarrier(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  carrier: string,
  bg: string,
  pal: SubliminalProject["palette"],
  t: number,
) {
  if (carrier === "gradient") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, pal.bg);
    g.addColorStop(0.5, pal.accent + "55");
    g.addColorStop(1, bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t / 1800);
    ctx.fillStyle = pal.mist;
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.35, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = bg || "#000";
    ctx.fillRect(0, 0, w, h);
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = text.length > 42 ? 36 : text.length > 24 ? 48 : 64;
  ctx.font = `500 ${size}px Georgia, serif`;
  wrapText(ctx, text, w / 2, h / 2, w * 0.78, size * 1.25);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  max: number,
  lineH: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  const start = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, start + i * lineH));
}

function cover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(alpha * 255);
  }
  ctx.putImageData(img, 0, 0);
}
