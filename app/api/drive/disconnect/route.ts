import { NextResponse } from "next/server";
import { clearDriveTokens } from "@/lib/drive";

export async function POST() {
  await clearDriveTokens();
  return NextResponse.json({ ok: true });
}
