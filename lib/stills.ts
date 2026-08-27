import type { Palette, VisualAsset } from "./types";

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function still(id: string, name: string, svg: string): VisualAsset {
  return {
    id,
    name,
    mimeType: "image/svg+xml",
    source: "generated",
    svg,
    dataUrl: svgDataUrl(svg),
  };
}

export function generateThemeStills(theme: string, palette: Palette, count = 8): VisualAsset[] {
  const words = theme.trim() || "I am";
  const { bg, fg, accent, mist } = palette;
  const templates: Array<(i: number) => string> = [
    (i) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="${bg}"/>
        <circle cx="${200 + i * 90}" cy="360" r="${180 + i * 8}" fill="${accent}" opacity="0.18"/>
        <circle cx="980" cy="200" r="260" fill="${mist}" opacity="0.12"/>
        <text x="640" y="380" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="${fg}">${escapeXml(words)}</text>
      </svg>`,
    (i) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
        <defs>
          <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${bg}"/>
            <stop offset="1" stop-color="${accent}"/>
          </linearGradient>
        </defs>
        <rect width="1280" height="720" fill="url(#g${i})" opacity="0.85"/>
        <rect x="80" y="80" width="1120" height="560" fill="none" stroke="${fg}" stroke-opacity="0.25"/>
        <text x="640" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="${fg}">I AM</text>
      </svg>`,
    (i) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="${bg}"/>
        ${[0, 1, 2, 3, 4].map((n) => `<rect x="${140 + n * 200 + i * 4}" y="${160 + (n % 2) * 80}" width="160" height="320" fill="${accent}" opacity="${0.08 + n * 0.04}"/>`).join("")}
        <text x="640" y="400" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="${fg}">${escapeXml(words.slice(0, 42))}</text>
      </svg>`,
    () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="#000"/>
        <text x="640" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="${fg}" opacity="0.92">${escapeXml(words.slice(0, 28))}</text>
      </svg>`,
    (i) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="${bg}"/>
        <circle cx="640" cy="360" r="${120 + i * 20}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.45"/>
        <circle cx="640" cy="360" r="${40 + i * 10}" fill="${accent}" opacity="0.2"/>
      </svg>`,
    () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="${bg}"/>
        <text x="120" y="360" font-family="Georgia, serif" font-size="48" fill="${fg}">desired reality</text>
        <text x="120" y="430" font-family="Georgia, serif" font-size="28" fill="${accent}">${escapeXml(words)}</text>
      </svg>`,
  ];

  const out: VisualAsset[] = [];
  for (let i = 0; i < count; i++) {
    const svg = templates[i % templates.length](i);
    out.push(still(`still-${i + 1}`, `still ${i + 1}`, svg));
  }
  return out;
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
