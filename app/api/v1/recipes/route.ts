import { NextRequest, NextResponse } from "next/server";
import { RECIPES } from "@/lib/recipes";
import { assertApiKey, cors } from "@/lib/api-auth";

export async function OPTIONS(req: NextRequest) {
  return cors(req) ?? new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const denied = assertApiKey(req);
  if (denied) return denied;
  return NextResponse.json({
    recipes: RECIPES.map((r) => ({
      id: r.id,
      name: r.name,
      youtubeHook: r.youtubeHook,
      methods: r.methods,
      notes: r.notes,
    })),
  });
}
