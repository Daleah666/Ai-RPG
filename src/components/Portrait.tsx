import { EYES, HAIR, MARKS, SKIN } from "../content/identity";
import type { EyeId, HairId, MarkId, SkinId } from "../types";

export function Portrait({
  hair,
  eyes,
  skin,
  mark,
  size = 180,
}: {
  hair: HairId;
  eyes: EyeId;
  skin: SkinId;
  mark: MarkId;
  size?: number;
}) {
  const skinC = SKIN[skin].color;
  const hairC = HAIR[hair].color;
  const eyeC = EYES[eyes].color;
  return (
    <svg
      className="portrait"
      viewBox="0 0 160 200"
      width={size}
      height={Math.round(size * (200 / 160))}
      role="img"
      aria-label="Character portrait"
    >
      <rect width="160" height="200" fill="#120c08" />
      <ellipse cx="80" cy="210" rx="70" ry="28" fill="#1a120c" />
      <rect x="48" y="118" width="64" height="70" rx="10" fill={skinC} />
      <ellipse cx="80" cy="92" rx="42" ry="50" fill={skinC} />
      {hair === "cropped" && <path d="M40 88 C40 48 120 48 120 88 L118 70 C100 42 60 42 42 70 Z" fill={hairC} />}
      {hair === "long" && (
        <>
          <path d="M38 90 C38 40 122 40 122 90 L124 170 L110 150 L50 150 L36 170 Z" fill={hairC} />
          <path d="M42 70 C70 38 100 38 118 70" fill={hairC} />
        </>
      )}
      {hair === "braided" && (
        <>
          <path d="M40 86 C42 46 118 46 120 86 L116 68 C98 44 62 44 44 68 Z" fill={hairC} />
          <path d="M118 90 q10 30 6 70 q-8 -20 -8 -50" fill={hairC} />
        </>
      )}
      {hair === "wild" && (
        <path d="M28 96 L40 50 L58 72 L80 38 L102 74 L122 48 L134 98 C120 44 40 44 28 96 Z" fill={hairC} />
      )}
      {hair === "shorn" && <path d="M44 84 C50 58 110 58 116 84 L110 72 C96 56 64 56 50 72 Z" fill={hairC} />}
      {hair === "veiled" && (
        <>
          <path d="M30 70 L80 36 L130 70 L124 170 L36 170 Z" fill={hairC} opacity="0.92" />
          <path d="M48 88 L80 70 L112 88" stroke="#1a120c" strokeWidth="2" fill="none" opacity="0.4" />
        </>
      )}
      <ellipse cx="64" cy="96" rx="6" ry="5" fill={eyeC} />
      <ellipse cx="96" cy="96" rx="6" ry="5" fill={eyeC} />
      <ellipse cx="64" cy="96" rx="2.2" ry="2.2" fill="#120c08" />
      <ellipse cx="96" cy="96" rx="2.2" ry="2.2" fill="#120c08" />
      <path d="M70 114 Q80 120 90 114" stroke="#3a2418" strokeWidth="2" fill="none" opacity="0.55" />
      {mark === "veil_burn" && <path d="M48 78 L92 70" stroke="#efe6d4" strokeWidth="3" opacity="0.7" />}
      {mark === "salt_scar" && <path d="M100 108 L124 128" stroke="#efe6d4" strokeWidth="2.4" opacity="0.65" />}
      {mark === "ink_web" && (
        <path d="M44 130 l10 8 l-6 10 M50 134 l12 0" stroke="#3d4c8a" strokeWidth="2" fill="none" />
      )}
      {mark === "cracked_gold" && <circle cx="80" cy="128" r="4" fill="#d4b060" />}
      <text x="80" y="192" textAnchor="middle" fill="#b7a48a" fontSize="8" fontFamily="serif">
        {MARKS[mark].name}
      </text>
    </svg>
  );
}
