"use client";

import { useState } from "react";

export function DriveAiPanel() {
  const [folder, setFolder] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    setBusy(true);
    const res = await fetch("/api/v1/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan: true, folder: folder || undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage("Scan failed — run the local app (exe / npm run launch).");
      return;
    }
    const n = (json.processed ?? []).filter((r: { ok?: boolean }) => r.ok).length;
    setMessage(`Folder ${json.root}. Processed ${n} inbox file(s).`);
  };

  const bootstrap = async () => {
    setBusy(true);
    const res = await fetch("/api/drive/bootstrap", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    setMessage(
      res.ok
        ? "Created VeilStudio/inbox + outbox in Google Drive. Keep the local .exe running."
        : "Connect Google Drive OAuth first, or use a local Drive-synced folder.",
    );
    void json;
  };

  return (
    <section className="space-y-4">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">AI in Google Drive</p>
      <h3 className="font-display text-2xl text-cream">Inbox the exe watches</h3>
      <p className="text-sm leading-relaxed text-mist">
        Google Drive will not run an <code className="text-gold">.exe</code> in the cloud. Put
        Veil Studio in a Drive-synced folder, launch it on this computer, then let Gemini (or
        any AI) drop a JSON request in <code className="text-gold">VeilStudio/inbox</code>. The
        app writes the mix to <code className="text-gold">outbox</code>, and Drive syncs it back.
      </p>
      <pre className="overflow-auto rounded-xl border border-line bg-ink p-3 text-xs text-cream/80">{`{
  "theme": "feminizing into everyday womanhood",
  "renderAudio": true
}`}</pre>
      <input
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
        placeholder="Optional path — e.g. C:\\Users\\you\\Google Drive\\VeilStudio"
        className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-cream outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void scan()}
          className="rounded-full bg-gold px-4 py-2 text-sm text-ink"
        >
          Scan inbox now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void bootstrap()}
          className="rounded-full border border-line px-4 py-2 text-sm text-cream"
        >
          Create Drive folders (OAuth)
        </button>
      </div>
      {message ? <p className="text-xs text-mist">{message}</p> : null}
    </section>
  );
}
