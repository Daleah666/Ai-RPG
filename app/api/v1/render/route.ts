import { NextRequest, NextResponse } from "next/server";
import { generateProject } from "@/lib/engine";
import { generateSchema } from "@/lib/schema";
import { assertApiKey, cors } from "@/lib/api-auth";
import { renderProjectWav } from "@/lib/audio/render";
import type { SubliminalProject } from "@/lib/types";

export async function OPTIONS(req: NextRequest) {
  return cors(req) ?? new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const denied = assertApiKey(req);
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const asProject = json as { project?: SubliminalProject } & Record<string, unknown>;
  let project: SubliminalProject;
  if (asProject.project?.theme && asProject.project.audio) {
    project = asProject.project;
  } else {
    const parsed = generateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Provide project or generate body" }, { status: 400 });
    }
    project = generateProject(parsed.data);
  }

  const durationSec = Math.min(
    Number(asProject.durationSec ?? project.durationSec) || 90,
    180,
  );
  const wav = renderProjectWav(project, { durationSec, sampleRate: 22050 });
  return new NextResponse(new Uint8Array(wav), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Disposition": `attachment; filename="${slug(project.name)}.wav"`,
    },
  });
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "subliminal";
}
