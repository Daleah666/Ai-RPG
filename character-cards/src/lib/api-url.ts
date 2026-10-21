export function resolveChatCompletionsUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("API base URL is required.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("API base URL is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API base URL must start with http:// or https://.");
  }

  if (url.pathname.endsWith("/chat/completions")) return url.toString();
  return `${trimmed}/chat/completions`;
}
