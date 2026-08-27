import { NextRequest, NextResponse } from "next/server";
import { getDriveTokens, refreshIfNeeded } from "@/lib/drive";

export async function POST(req: NextRequest) {
  const tokens = await getDriveTokens();
  if (!tokens) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const fresh = await refreshIfNeeded(tokens);
  const body = (await req.json()) as { fileIds?: string[] };
  const ids = body.fileIds ?? [];
  const assets = [];
  for (const id of ids.slice(0, 24)) {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${fresh.access_token}` } },
    );
    const meta = (await metaRes.json()) as {
      id?: string;
      name?: string;
      mimeType?: string;
    };
    const bin = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${fresh.access_token}` },
    });
    if (!bin.ok) continue;
    const buf = Buffer.from(await bin.arrayBuffer());
    const mime = meta.mimeType || "image/jpeg";
    assets.push({
      id: meta.id ?? id,
      name: meta.name ?? id,
      mimeType: mime,
      source: "drive" as const,
      driveFileId: id,
      dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
    });
  }
  return NextResponse.json({ assets });
}
