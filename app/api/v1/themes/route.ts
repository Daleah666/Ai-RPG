import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/themes";
import { assertApiKey, cors } from "@/lib/api-auth";

export async function OPTIONS(req: NextRequest) {
  return cors(req) ?? new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const denied = assertApiKey(req);
  if (denied) return denied;
  return NextResponse.json({
    themes: CATEGORIES.map((c) => ({
      id: c.id,
      labels: c.labels,
      recipe: c.recipe,
      bed: c.bed,
      brainwave: c.brainwave,
    })),
  });
}
