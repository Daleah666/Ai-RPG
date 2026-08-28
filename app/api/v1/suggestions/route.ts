import { NextRequest, NextResponse } from "next/server";
import { FEATURED_PACKS, suggestForTheme } from "@/lib/suggestions";
import { assertApiKey, cors } from "@/lib/api-auth";

export async function OPTIONS(req: NextRequest) {
  return cors(req) ?? new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const denied = assertApiKey(req);
  if (denied) return denied;
  const theme = req.nextUrl.searchParams.get("theme") ?? "";
  return NextResponse.json({
    featured: FEATURED_PACKS.filter((p) => p.featured),
    suggestions: suggestForTheme(theme || " ", 8),
  });
}
