import { NextResponse } from "next/server";
import { authUrl, driveConfigured } from "@/lib/drive";

export async function GET() {
  if (!driveConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to enable the Drive connector.",
      },
      { status: 400 },
    );
  }
  const state = Math.random().toString(36).slice(2);
  return NextResponse.redirect(authUrl(state));
}
