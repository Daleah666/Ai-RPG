"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateProject } from "@/lib/engine";
import { METHODS } from "@/lib/methods";
import { RECIPES } from "@/lib/recipes";
import { clampVisualTiming, flashHz } from "@/lib/safety";
import { setActiveProject, takePendingAssets } from "@/lib/storage";
import type { MethodId, RecipeId, SubliminalProject, VisualAsset } from "@/lib/types";
import { DrivePanel } from "./DrivePanel";
import { PreviewStage } from "./PreviewStage";
import { SafetyGate } from "./SafetyGate";
import { useStudioAudio } from "@/hooks/useStudioAudio";

const STARTER_THEMES = [
  "unshakeable confidence",
  "quiet wealth",
  "deep restorative sleep",
  "desired face glow",
  "focused study flow",
  "being easy to love",
];

export function StudioApp({ initial }: { initial?: SubliminalProject | null }) {
  const router = useRouter();
  const [theme, setTheme] = useState(initial?.theme ?? "unshakeable confidence");
  const [recipeId, setRecipeId] = useState<RecipeId | "auto">(initial?.recipeId ?? "auto");
  const [methods, setMethods] = useState<MethodId[]>(initial?.methods ?? []);
  const [project, setProject] = useState<SubliminalProject | null>(initial ?? null);
  const [playing, setPlaying] = useState(false);
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState(initial?.affirmations.join("\n") ?? "");

  useStudioAudio(playing ? project : null, playing);

  const mergePending = (base: SubliminalProject): SubliminalProject => {
    const pending = takePendingAssets<VisualAsset>();
    if (!pending.length) return base;
    return { ...base, assets: [...pending, ...base.assets].slice(0, 32) };
  };

  useEffect(() => {
    setProject((cur) => {
      if (!cur) return cur;
      const next = mergePending(cur);
      if (next !== cur) setActiveProject(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hz = useMemo(() => {
    if (!project) return 0;
    return flashHz(project.visual.flashDurationMs, project.visual.intervalMs);
  }, [project]);

  const generate = (fromApi = false) => {
    setBusy(true);
    const run = async () => {
      if (fromApi) {
        const res = await fetch("/api/v1/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme,
            recipeId,
            methods: methods.length ? methods : ["auto"],
            durationSec: 180,
          }),
        });
        const json = await res.json();
        apply(json.project as SubliminalProject);
      } else {
        apply(
          generateProject({
            theme,
            recipeId,
            methods: methods.length ? methods : ["auto"],
            durationSec: 180,
          }),
        );
      }
      setBusy(false);
    };
    void run();
  };

  const apply = (next: SubliminalProject) => {
    const merged = mergePending(next);
    setScript(merged.affirmations.join("\n"));
    setProject(merged);
    setActiveProject(merged);
    setMethods(merged.methods);
    setRecipeId(merged.recipeId);
    setTheme(merged.theme);
  };

  const toggleMethod = (id: MethodId) => {
    setMethods((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const addAssets = (assets: VisualAsset[]) => {
    if (!project) return;
    const next = { ...project, assets: [...assets, ...project.assets].slice(0, 32) };
    setProject(next);
    setActiveProject(next);
  };

  const updateVisual = (patch: Partial<SubliminalProject["visual"]>) => {
    if (!project) return;
    const visual = { ...project.visual, ...patch };
    const t = clampVisualTiming(visual);
    visual.flashDurationMs = t.flashDurationMs;
    visual.intervalMs = t.intervalMs;
    const next = { ...project, visual };
    setProject(next);
    setActiveProject(next);
  };

  const updateAudio = (patch: Partial<SubliminalProject["audio"]>) => {
    if (!project) return;
    const next = { ...project, audio: { ...project.audio, ...patch } };
    setProject(next);
    setActiveProject(next);
  };

  const exportJson = () => {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    download(blob, `${project.id}.json`);
  };

  const exportWav = async () => {
    if (!project) return;
    setBusy(true);
    const res = await fetch("/api/v1/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, durationSec: Math.min(project.durationSec, 90) }),
    });
    const blob = await res.blob();
    download(blob, `${project.id}.wav`);
    setBusy(false);
  };

  const saveDrive = async () => {
    if (!project) return;
    const res = await fetch("/api/drive/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: project.name, json: project }),
    });
    if (!res.ok) alert("Connect Google Drive first on the Connect page.");
  };

  return (
    <div className="min-h-screen bg-ink text-cream">
      {gate ? (
        <SafetyGate
          onAccept={() => {
            setGate(false);
            setPlaying(true);
          }}
        />
      ) : null}

      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <a href="/" className="font-display text-xl tracking-tight">
          Veil Studio
        </a>
        <nav className="flex gap-5 text-sm text-mist">
          <a href="/connect">Connect</a>
          <a href="/api-docs">API</a>
          <button
            type="button"
            className="text-gold"
            onClick={() => {
              if (!project) return;
              setActiveProject(project);
              router.push("/play");
            }}
          >
            Fullscreen
          </button>
        </nav>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">Theme</p>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 font-display text-xl outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTER_THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-mist hover:text-cream"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-mist">YouTube-style recipe</span>
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value as RecipeId | "auto")}
              className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2"
            >
              <option value="auto">Auto from theme</option>
              {RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm text-mist">Methods</p>
            <div className="mt-2 grid grid-cols-1 gap-1">
              {METHODS.map((m) => (
                <label key={m.id} className="flex items-start gap-2 rounded-xl px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={methods.includes(m.id)}
                    onChange={() => toggleMethod(m.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-cream">{m.name}</span>
                    <span className="block text-xs text-mist">{m.youtubeStyle}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => generate(false)}
              className="rounded-full bg-gold py-3 text-sm font-medium text-ink"
            >
              {busy ? "Working…" : "Generate from theme"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => generate(true)}
              className="rounded-full border border-gold/50 py-3 text-sm text-gold"
            >
              Generate via API
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-black shadow-glow">
            {project ? (
              <PreviewStage project={project} playing={playing} className="aspect-video w-full" />
            ) : (
              <div className="flex aspect-video items-center justify-center text-mist">
                Generate a theme to preview flashes
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <button
                type="button"
                disabled={!project}
                onClick={() => (playing ? setPlaying(false) : setGate(true))}
                className="rounded-full bg-cream px-5 py-2 text-sm text-ink disabled:opacity-40"
              >
                {playing ? "Stop" : "Play mix"}
              </button>
              <p className="text-xs text-mist">
                {project
                  ? `${hz.toFixed(2)} Hz · ${project.visual.flashDurationMs}ms flash / ${project.visual.intervalMs}ms gap · ${project.recipeId}`
                  : "idle"}
              </p>
            </div>
          </div>

          {project ? (
            <div className="grid gap-4 rounded-3xl border border-line bg-panel p-5 sm:grid-cols-2">
              <label className="text-sm">
                Flash duration (ms)
                <input
                  type="range"
                  min={16}
                  max={400}
                  value={project.visual.flashDurationMs}
                  onChange={(e) => updateVisual({ flashDurationMs: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="text-sm">
                Interval (ms)
                <input
                  type="range"
                  min={500}
                  max={12000}
                  value={project.visual.intervalMs}
                  onChange={(e) => updateVisual({ intervalMs: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="text-sm">
                Opacity
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(project.visual.opacity * 100)}
                  onChange={(e) => updateVisual({ opacity: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </label>
              <label className="text-sm">
                Voice depth (dB)
                <input
                  type="range"
                  min={-32}
                  max={-8}
                  value={project.audio.affirmationGainDb}
                  onChange={(e) => updateAudio({ affirmationGainDb: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="text-sm">
                Speed
                <input
                  type="range"
                  min={80}
                  max={400}
                  value={Math.round(project.audio.speed * 100)}
                  onChange={(e) => updateAudio({ speed: Number(e.target.value) / 100 })}
                  className="w-full"
                />
              </label>
              <label className="text-sm">
                Layers
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={project.audio.layers}
                  onChange={(e) => updateAudio({ layers: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <div className="flex flex-wrap gap-3 text-sm sm:col-span-2">
                <Toggle
                  label="Reverse"
                  on={project.audio.reverse}
                  set={(v) => updateAudio({ reverse: v })}
                />
                <Toggle
                  label="Forward + reverse"
                  on={project.audio.alsoForward}
                  set={(v) => updateAudio({ alsoForward: v })}
                />
                <Toggle
                  label="Binaural"
                  on={project.audio.binaural.enabled}
                  set={(v) =>
                    updateAudio({ binaural: { ...project.audio.binaural, enabled: v } })
                  }
                />
                <Toggle
                  label="Isochronic"
                  on={project.audio.isochronic.enabled}
                  set={(v) =>
                    updateAudio({ isochronic: { ...project.audio.isochronic, enabled: v } })
                  }
                />
                <Toggle
                  label="Silent 18.5k"
                  on={project.audio.silentCarrier.enabled}
                  set={(v) =>
                    updateAudio({
                      silentCarrier: { ...project.audio.silentCarrier, enabled: v },
                    })
                  }
                />
                <Toggle
                  label="8D pan"
                  on={project.audio.eightD}
                  set={(v) => updateAudio({ eightD: v })}
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" onClick={exportJson} className="rounded-full border border-line px-4 py-2 text-sm">
                  Download project JSON
                </button>
                <button type="button" onClick={() => void exportWav()} className="rounded-full border border-line px-4 py-2 text-sm">
                  Render WAV
                </button>
                <button type="button" onClick={() => void saveDrive()} className="rounded-full border border-line px-4 py-2 text-sm">
                  Save JSON to Drive
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">Script</p>
            <textarea
              value={script}
              onChange={(e) => {
                setScript(e.target.value);
                if (project) {
                  const next = {
                    ...project,
                    affirmations: e.target.value.split(/\n+/).map((s) => s.trim()).filter(Boolean),
                  };
                  setProject(next);
                  setActiveProject(next);
                }
              }}
              rows={16}
              className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 font-sans text-sm leading-relaxed outline-none"
            />
          </div>
          <DrivePanel onAssets={addAssets} />
          {project ? (
            <ul className="space-y-2 text-xs text-mist">
              {project.notes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => set(!on)}
      className={`rounded-full px-3 py-1 ${on ? "bg-gold text-ink" : "border border-line text-mist"}`}
    >
      {label}
    </button>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
