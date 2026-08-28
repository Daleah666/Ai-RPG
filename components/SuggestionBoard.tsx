"use client";

import type { ThemeSuggestion } from "@/lib/types";

type Props = {
  heading?: string;
  items: ThemeSuggestion[];
  onPick: (item: ThemeSuggestion) => void;
};

export function SuggestionBoard({ heading = "Suggestions", items, onPick }: Props) {
  if (!items.length) return null;
  return (
    <section className="w-full">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">{heading}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-3xl border border-line bg-panel p-5 text-left transition hover:border-gold/50 hover:shadow-glow"
          >
            <p className="font-display text-2xl text-cream">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-mist">{item.blurb}</p>
            <p className="mt-3 text-xs text-gold">{item.why}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.layers.map((layer) => (
                <span
                  key={layer}
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] text-mist"
                >
                  {layer}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
