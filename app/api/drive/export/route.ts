import { NextRequest, NextResponse } from "next/server";
import { getDriveTokens, refreshIfNeeded } from "@/lib/drive";

export async function POST(req: NextRequest) {
  const tokens = await getDriveTokens();
  if (!tokens) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const fresh = await refreshIfNeeded(tokens);
  const { name, json, folderId } = (await req.json()) as {
    name?: string;
    json?: unknown;
    folderId?: string;
  };
  const metadata: Record<string, unknown> = {
    name: `${name || "veil-project"}.json`,
    mimeType: "application/json",
  };
  if (folderId) metadata.parents = [folderId];

  const boundary = "veil_" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${JSON.stringify(json ?? {}, null, 2)}\r\n` +
    `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fresh.access_token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const out = await res.json();
  if (!res.ok) return NextResponse.json({ error: out }, { status: 502 });
  return NextResponse.json({ file: out });
}
