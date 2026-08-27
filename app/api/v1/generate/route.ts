import { NextRequest, NextResponse } from "next/server";
import { generateProject } from "@/lib/engine";
import { generateSchema } from "@/lib/schema";
import { assertApiKey, cors } from "@/lib/api-auth";
import { maybeLlmAffirmations } from "@/lib/ai/openai";
import { renderProjectWav } from "@/lib/audio/render";

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

  const parsed = generateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = generateProject(parsed.data);
  const llm = await maybeLlmAffirmations(
    project.theme,
    project.affirmations.length,
    project.affirmations,
  );
  project.affirmations = llm.lines;

  const payload: Record<string, unknown> = {
    project,
    suggestions: project.suggestions,
    generator: llm.source,
    playPath: "/play",
    renderPath: "/api/v1/render",
  };

  if (parsed.data.renderAudio) {
    const wav = renderProjectWav(project, {
      durationSec: Math.min(project.durationSec, 90),
      sampleRate: 22050,
    });
    payload.audioWavBase64 = wav.toString("base64");
    payload.audioMime = "audio/wav";
  }

  return NextResponse.json(payload);
}
