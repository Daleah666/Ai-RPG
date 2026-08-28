"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateProject } from "@/lib/engine";
import { FEATURED_PACKS, suggestForTheme } from "@/lib/suggestions";
import { setActiveProject } from "@/lib/storage";
import type { ThemeSuggestion } from "@/lib/types";
import { SuggestionBoard } from "./SuggestionBoard";

export function LandingGenerate() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);

  const live = useMemo(() => suggestForTheme(theme || " ", 6), [theme]);

  const open = (nextTheme: string, recipeId?: string) => {
    setBusy(true);
    const project = generateProject({
      theme: nextTheme,
      recipeId: recipeId ?? "auto",
      affirmationCount: 48,
    });
    setActiveProject(project);
    router.push("/studio");
  };

  return (
    <div className="mt-10 w-full max-w-5xl">
      <form
        className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          open(theme.trim() || "unshakeable confidence");
        }}
      >
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="flex-1 rounded-full border border-line bg-panel px-5 py-3 text-cream outline-none"
          placeholder="Ask for a subliminal — feminizing, trance, anti-racism…"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-ink"
        >
          {busy ? "Opening…" : "Make this"}
        </button>
      </form>

      <div className="mt-12">
        <SuggestionBoard
          heading={theme.trim() ? "Matches for what you asked" : "Start with a stacked pack"}
          items={theme.trim() ? live : FEATURED_PACKS}
          onPick={(item: ThemeSuggestion) => open(item.theme, item.recipeId)}
        />
      </div>
    </div>
  );
}
