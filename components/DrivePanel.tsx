"use client";

import { useEffect, useState } from "react";
import { stashPendingAssets } from "@/lib/storage";
import type { VisualAsset } from "@/lib/types";

type FileRow = {
  id: string;
  name: string;
  mimeType: string;
};

type Props = {
  onAssets: (assets: VisualAsset[]) => void;
};

export function DrivePanel({ onAssets }: Props) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(
    null,
  );
  const [files, setFiles] = useState<FileRow[]>([]);
  const [folderId, setFolderId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/drive/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false }));
  }, []);

  const load = async () => {
    setBusy(true);
    const q = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
    const res = await fetch(`/api/drive/files${q}`);
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error ? "Drive request failed" : "Connect Drive first");
      return;
    }
    setFiles(json.files ?? []);
    setMessage(`${(json.files ?? []).length} items`);
  };

  const importSelected = async () => {
    if (!selected.length) return;
    setBusy(true);
    const res = await fetch("/api/drive/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: selected }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage("Import failed");
      return;
    }
    const imported = json.assets ?? [];
    stashPendingAssets(imported);
    onAssets(imported);
    setMessage(`Imported ${imported.length} images`);
  };

  const onLocal = async (list: FileList | null) => {
    if (!list?.length) return;
    const assets: VisualAsset[] = [];
    for (const file of Array.from(list).slice(0, 24)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readFile(file);
      assets.push({
        id: `local-${file.name}-${file.size}`,
        name: file.name,
        mimeType: file.type,
        source: "folder",
        dataUrl,
      });
    }
    stashPendingAssets(assets);
    onAssets(assets);
    setMessage(`Linked ${assets.length} local images`);
  };

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Connectors</p>
        <h3 className="mt-1 font-display text-2xl text-cream">Drive & folders</h3>
        <p className="mt-2 text-sm text-mist">
          Flash results pictures from Google Drive, or link a local folder. Drive OAuth uses
          your Google Cloud client in <code className="text-gold">.env.local</code>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {status?.configured ? (
          status.connected ? (
            <button
              type="button"
              onClick={() => void fetch("/api/drive/disconnect", { method: "POST" }).then(() => location.reload())}
              className="rounded-full border border-line px-4 py-2 text-sm text-mist"
            >
              Disconnect Drive
            </button>
          ) : (
            <a
              href="/api/drive/auth"
              className="rounded-full bg-gold px-4 py-2 text-sm text-ink"
            >
              Connect Google Drive
            </a>
          )
        ) : (
          <span className="rounded-full border border-line px-4 py-2 text-sm text-mist">
            Drive API not configured
          </span>
        )}
        <label className="cursor-pointer rounded-full border border-gold/40 px-4 py-2 text-sm text-gold">
          Link local folder
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            {...{ webkitdirectory: "true" }}
            onChange={(e) => void onLocal(e.target.files)}
          />
        </label>
        <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-cream">
          Upload images
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onLocal(e.target.files)}
          />
        </label>
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="Drive folder ID (optional)"
              className="flex-1 rounded-xl border border-line bg-ink px-3 py-2 text-sm text-cream outline-none"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-cream px-4 py-2 text-sm text-ink"
              disabled={busy}
            >
              Browse
            </button>
          </div>
          <ul className="max-h-48 overflow-auto rounded-xl border border-line">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  disabled={f.mimeType.includes("folder")}
                  checked={selected.includes(f.id)}
                  onChange={(e) =>
                    setSelected((cur) =>
                      e.target.checked ? [...cur, f.id] : cur.filter((x) => x !== f.id),
                    )
                  }
                />
                <span className="text-cream">{f.name}</span>
                <span className="ml-auto text-xs text-mist">{f.mimeType.split(".").pop()}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void importSelected()}
            disabled={!selected.length || busy}
            className="rounded-full bg-gold px-4 py-2 text-sm text-ink disabled:opacity-40"
          >
            Import selected as flash stills
          </button>
        </div>
      ) : null}

      {message ? <p className="text-xs text-mist">{message}</p> : null}
    </section>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
