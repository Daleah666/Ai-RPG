import { NextRequest, NextResponse } from "next/server";
import { assertApiKey, cors } from "@/lib/api-auth";
import { generateSchema } from "@/lib/schema";
import { runInboxRequest } from "@/lib/inbox";
import { processAllInbox, resolveStudioRoot } from "@/lib/inbox-fs";

export async function OPTIONS(req: NextRequest) {
  return cors(req) ?? new NextResponse(null, { status: 204 });
}

function localOnly(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return null;
  return NextResponse.json({ error: "Inbox scan is local-only" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const denied = assertApiKey(req) ?? localOnly(req);
  if (denied) return denied;

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    json = {};
  }

  const body = json as { scan?: boolean; folder?: string; theme?: string };
  if (body.scan || body.folder) {
    const root = resolveStudioRoot(body.folder || process.env.VEIL_DRIVE_FOLDER);
    const result = processAllInbox(root);
    return NextResponse.json(result);
  }

  const parsed = generateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid inbox request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { project } = runInboxRequest(parsed.data);
  return NextResponse.json({ project });
}

export async function GET(req: NextRequest) {
  const denied = localOnly(req);
  if (denied) return denied;
  const root = resolveStudioRoot(process.env.VEIL_DRIVE_FOLDER);
  return NextResponse.json({
    folder: root,
    env: process.env.VEIL_DRIVE_FOLDER ?? null,
    hint: "POST { scan: true } while the app is running to drain inbox/*.json into outbox/",
  });
}
