import type { LocationId, TimeOfDay } from "../types";

const PALETTE: Record<LocationId, [string, string, string]> = {
  emberhearth: ["#2a1810", "#c45c26", "#e8b86a"],
  veilwood: ["#0d1a14", "#1f6b4a", "#c9f27a"],
  saltmoor: ["#0b1c22", "#1a6b73", "#9fd8c8"],
  archives: ["#12101c", "#3d4c8a", "#d4c4a8"],
  cathedral: ["#1a0c0c", "#8a1f1f", "#f0c36a"],
  rift: ["#07060c", "#5b2d8a", "#f2e6a0"],
};

export function LocationArt({
  locationId,
  time,
}: {
  locationId: LocationId;
  time: TimeOfDay;
}) {
  const [a, b, c] = PALETTE[locationId];
  const night = time === "night" || time === "dusk";
  return (
    <svg className="loc-art" viewBox="0 0 640 220" role="img" aria-label={locationId}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? "#07060a" : a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="640" height="220" fill="url(#sky)" />
      <circle cx={time === "night" ? 520 : 90} cy="48" r={time === "night" ? 16 : 28} fill={c} opacity="0.85" />
      {locationId === "emberhearth" && (
        <>
          <rect x="80" y="110" width="90" height="70" fill="#1a0f0a" />
          <polygon points="80,110 125,70 170,110" fill="#3a2218" />
          <rect x="210" y="120" width="120" height="70" fill="#24140e" />
          <polygon points="210,120 270,78 330,120" fill="#4a2a18" />
          <rect x="248" y="148" width="22" height="42" fill={c} opacity="0.7" />
          <rect x="400" y="100" width="70" height="80" fill="#1a100c" />
          <polygon points="400,100 435,64 470,100" fill="#3a2014" />
        </>
      )}
      {locationId === "veilwood" && (
        <>
          {[90, 160, 240, 330, 410, 500, 570].map((x, i) => (
            <g key={x}>
              <rect x={x} y={80 + (i % 3) * 10} width="10" height="140" fill="#05140e" />
              <ellipse cx={x + 5} cy={70 + (i % 3) * 8} rx={28 + (i % 4) * 6} ry="46" fill="#0b2a1c" opacity="0.9" />
            </g>
          ))}
        </>
      )}
      {locationId === "saltmoor" && (
        <>
          <rect x="0" y="150" width="640" height="70" fill="#0a2428" />
          <path d="M0 150 Q 80 130 160 150 T 320 150 T 480 150 T 640 150" fill="none" stroke={c} strokeWidth="2" opacity="0.5" />
          <rect x="120" y="90" width="14" height="80" fill="#1a140e" />
          <rect x="300" y="70" width="16" height="100" fill="#1a140e" />
          <rect x="470" y="85" width="12" height="85" fill="#1a140e" />
        </>
      )}
      {locationId === "archives" && (
        <>
          {[70, 140, 210, 400, 470, 540].map((x) => (
            <rect key={x} x={x} y="40" width="28" height="180" fill="#1a1730" />
          ))}
          <rect x="280" y="90" width="70" height="130" fill="#2a2448" />
        </>
      )}
      {locationId === "cathedral" && (
        <>
          <polygon points="320,20 80,200 560,200" fill="#2a1010" />
          <polygon points="320,36 160,200 480,200" fill="#3a1414" />
          <rect x="292" y="110" width="56" height="90" fill={c} opacity="0.35" />
        </>
      )}
      {locationId === "rift" && (
        <>
          <path d="M320 0 L300 220 L340 220 Z" fill={c} opacity="0.55" />
          <path d="M200 40 L180 220 L230 220 Z" fill={b} opacity="0.4" />
          <path d="M440 30 L420 220 L480 220 Z" fill={b} opacity="0.35" />
        </>
      )}
      <rect width="640" height="220" fill="url(#sky)" opacity="0.12" />
    </svg>
  );
}
