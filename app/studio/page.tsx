"use client";

import { useEffect, useState } from "react";
import { StudioApp } from "@/components/StudioApp";
import { getActiveProject } from "@/lib/storage";
import type { SubliminalProject } from "@/lib/types";

export default function StudioPage() {
  const [initial, setInitial] = useState<SubliminalProject | null | undefined>(undefined);
  useEffect(() => {
    setInitial(getActiveProject<SubliminalProject>());
  }, []);
  if (initial === undefined) {
    return <div className="min-h-screen bg-ink" />;
  }
  return <StudioApp initial={initial} />;
}
