"use client";

import { useEffect, useState } from "react";
import { PreviewStage } from "./PreviewStage";
import { SafetyGate } from "./SafetyGate";
import { useStudioAudio } from "@/hooks/useStudioAudio";
import { getActiveProject } from "@/lib/storage";
import type { SubliminalProject } from "@/lib/types";

export function PlayerApp() {
  const [project, setProject] = useState<SubliminalProject | null>(null);
  const [playing, setPlaying] = useState(false);
  const [gate, setGate] = useState(true);

  useEffect(() => {
    setProject(getActiveProject<SubliminalProject>());
  }, []);

  useStudioAudio(playing ? project : null, playing);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-mist">
        No active project. Generate one in the studio first.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      {gate ? (
        <SafetyGate
          onAccept={() => {
            setGate(false);
            setPlaying(true);
          }}
        />
      ) : null}
      <PreviewStage project={project} playing={playing} className="h-screen w-screen object-cover" />
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-sm text-mist">
        <p className="font-display text-cream">{project.name}</p>
        <div className="flex gap-4">
          <button type="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <a href="/studio">Back to studio</a>
        </div>
      </div>
    </div>
  );
}
