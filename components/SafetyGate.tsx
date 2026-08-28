"use client";

import { SAFETY_COPY } from "@/lib/safety";

type Props = {
  onAccept: () => void;
};

export function SafetyGate({ onAccept }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
      <div className="max-w-lg rounded-3xl border border-line bg-panel p-8 text-cream shadow-glow">
        <p className="font-sans text-xs uppercase tracking-[0.28em] text-gold">Notice</p>
        <h2 className="mt-3 font-display text-3xl">{SAFETY_COPY.title}</h2>
        <p className="mt-4 text-sm leading-relaxed text-mist">{SAFETY_COPY.body}</p>
        <button
          type="button"
          onClick={onAccept}
          className="mt-8 w-full rounded-full bg-gold px-6 py-3 font-sans text-sm font-medium text-ink"
        >
          I understand — continue
        </button>
      </div>
    </div>
  );
}
