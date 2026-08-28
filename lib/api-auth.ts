import { NextRequest, NextResponse } from "next/server";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function assertApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.SUBLIMINAL_API_KEY;
  if (!expected) return null;
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const key = req.headers.get("x-api-key") ?? bearer;
  if (key !== expected) return unauthorized();
  return null;
}

export function cors(req: NextRequest): NextResponse | null {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 });
  }
  return null;
}
