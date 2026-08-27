import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, setDriveTokens } from "@/lib/drive";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/connect?error=missing_code", req.url));
  }
  try {
    const tokens = await exchangeCode(code);
    await setDriveTokens(tokens);
    return NextResponse.redirect(new URL("/connect?drive=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/connect?error=oauth", req.url));
  }
}
