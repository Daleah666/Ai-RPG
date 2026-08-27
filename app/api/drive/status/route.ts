import { NextResponse } from "next/server";
import { driveConfigured, getDriveTokens } from "@/lib/drive";

export async function GET() {
  const tokens = await getDriveTokens();
  return NextResponse.json({
    configured: driveConfigured(),
    connected: Boolean(tokens),
  });
}
