"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateProject } from "@/lib/engine";
import { setActiveProject } from "@/lib/storage";

export function LandingGenerate() {
  const router = useRouter();
  const [theme, setTheme] = useState("unshakeable confidence");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        const project = generateProject({ theme, recipeId: "auto" });
        setActiveProject(project);
        router.push("/studio");
      }}
    >
      <input
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="flex-1 rounded-full border border-line bg-panel px-5 py-3 text-cream outline-none"
        placeholder="A theme — confidence, desired face, deep sleep…"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-ink"
      >
        {busy ? "Opening…" : "Make this"}
      </button>
    </form>
  );
}
