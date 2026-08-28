"use client";

import { useEffect, useState } from "react";
import { DrivePanel } from "@/components/DrivePanel";
import { DriveAiPanel } from "@/components/DriveAiPanel";

export default function ConnectPage() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(
    null,
  );
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("drive") === "connected") {
      /* status fetch below will reflect cookie */
    }
    void fetch("/api/drive/status")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  return (
    <main className="min-h-screen bg-ink px-8 py-12 text-cream">
      <a href="/" className="text-sm text-mist">
        ← Veil
      </a>
      <h1 className="mt-6 font-display text-5xl">Connect a drive</h1>
      <p className="mt-4 max-w-2xl text-mist">
        Google Drive OAuth needs a Cloud project with the Drive API enabled and these
        env vars: <code className="text-gold">GOOGLE_CLIENT_ID</code>,{" "}
        <code className="text-gold">GOOGLE_CLIENT_SECRET</code>,{" "}
        <code className="text-gold">GOOGLE_REDIRECT_URI</code> pointing at{" "}
        <code>/api/drive/callback</code>. Without that, link a local folder of results
        pictures — same flashing pipeline.
      </p>
      <p className="mt-3 text-sm text-mist">
        Status:{" "}
        {status
          ? status.connected
            ? "Drive connected"
            : status.configured
              ? "Drive configured, not connected"
              : "Drive API not configured"
          : "checking…"}
      </p>
      <div className="mt-10 max-w-xl space-y-8">
        <div className="rounded-3xl border border-line bg-panel p-6">
          <DriveAiPanel />
        </div>
        <div className="rounded-3xl border border-line bg-panel p-6">
          <DrivePanel onAssets={() => undefined} />
        </div>
      </div>
      <p className="mt-8 text-sm text-mist">
        After importing images, open the <a className="text-gold" href="/studio">studio</a>{" "}
        and generate a results-flash recipe so those stills become the flash layer.
      </p>
    </main>
  );
}
