import { NextRequest, NextResponse } from "next/server";
import { getDriveTokens, refreshIfNeeded } from "@/lib/drive";
import { AI_DRIVE_README } from "@/lib/inbox";

async function ensureFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const q = parentId
    ? `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const search = new URL("https://www.googleapis.com/drive/v3/files");
  search.searchParams.set("q", q);
  search.searchParams.set("fields", "files(id,name)");
  const found = await fetch(search, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await found.json()) as { files?: Array<{ id: string }> };
  if (data.files?.[0]?.id) return data.files[0].id;

  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];
  const created = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  const json = (await created.json()) as { id?: string; error?: unknown };
  if (!created.ok || !json.id) throw new Error("Could not create Drive folder");
  return json.id;
}

async function uploadText(token: string, folderId: string, name: string, text: string) {
  const boundary = "veilboot_" + Math.random().toString(36).slice(2);
  const metadata = { name, parents: [folderId], mimeType: "text/markdown" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/markdown\r\n\r\n` +
    `${text}\r\n` +
    `--${boundary}--`;
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
}

export async function POST(_req: NextRequest) {
  const tokens = await getDriveTokens();
  if (!tokens) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const fresh = await refreshIfNeeded(tokens);
  const token = fresh.access_token;
  const rootId = await ensureFolder(token, "VeilStudio");
  const inboxId = await ensureFolder(token, "inbox", rootId);
  const outboxId = await ensureFolder(token, "outbox", rootId);
  const libraryId = await ensureFolder(token, "library", rootId);
  const appId = await ensureFolder(token, "app", rootId);
  await uploadText(token, rootId, "README-FOR-AI.md", AI_DRIVE_README);
  return NextResponse.json({
    folders: { rootId, inboxId, outboxId, libraryId, appId },
    note: "Drop request JSON in inbox/. Keep the local .exe running so it can write outbox/.",
  });
}
