import { cookies } from "next/headers";

const COOKIE = "veil_drive";

export type DriveTokens = {
  access_token: string;
  refresh_token?: string;
  expiry: number;
};

export async function getDriveTokens(): Promise<DriveTokens | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriveTokens;
  } catch {
    return null;
  }
}

export async function setDriveTokens(tokens: DriveTokens) {
  (await cookies()).set(COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearDriveTokens() {
  (await cookies()).delete(COOKIE);
}

export function driveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<DriveTokens> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? "token exchange failed");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expiry: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export async function refreshIfNeeded(tokens: DriveTokens): Promise<DriveTokens> {
  if (tokens.expiry > Date.now() + 30_000) return tokens;
  if (!tokens.refresh_token) return tokens;
  const body = new URLSearchParams({
    refresh_token: tokens.refresh_token,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !json.access_token) return tokens;
  const next = {
    ...tokens,
    access_token: json.access_token,
    expiry: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await setDriveTokens(next);
  return next;
}
