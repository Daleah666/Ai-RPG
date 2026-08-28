import { NextRequest, NextResponse } from "next/server";
import { getDriveTokens, refreshIfNeeded } from "@/lib/drive";

export async function GET(req: NextRequest) {
  const tokens = await getDriveTokens();
  if (!tokens) {
    return NextResponse.json({ connected: false, files: [] }, { status: 401 });
  }
  const fresh = await refreshIfNeeded(tokens);
  const folderId = req.nextUrl.searchParams.get("folderId");
  const q = folderId
    ? `'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder') and trashed = false`
    : `(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder') and trashed = false`;

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,thumbnailLink,iconLink,modifiedTime)",
  );
  url.searchParams.set("orderBy", "folder,modifiedTime desc");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${fresh.access_token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ connected: true, error: json }, { status: 502 });
  }
  return NextResponse.json({ connected: true, files: json.files ?? [] });
}
