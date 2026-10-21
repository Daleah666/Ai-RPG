export function consumeSse(buffer: string): { pieces: string[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = buffer.endsWith("\n") ? "" : (lines.pop() ?? "");
  const pieces: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const json = JSON.parse(data) as {
        choices?: { delta?: { content?: string }; message?: { content?: string } }[];
      };
      const piece = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? "";
      if (piece) pieces.push(piece);
    } catch {
      // A broken event is skipped. The next chunk can still be read.
    }
  }
  return { pieces, rest };
}

export async function readChatResponse(
  response: Response,
  onDelta: (text: string) => void,
): Promise<void> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 500) || `The API returned ${response.status}.`);
  }
  if (type.includes("application/json")) {
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string } | string;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === "string" && content) {
      onDelta(content);
      return;
    }
    const message = typeof json.error === "string" ? json.error : json.error?.message;
    throw new Error(message || "The API returned no message.");
  }
  if (!response.body) throw new Error("The API returned an empty stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const consumed = consumeSse(pending);
    pending = consumed.rest;
    for (const piece of consumed.pieces) onDelta(piece);
  }
  const tail = consumeSse(`${pending}\n`);
  for (const piece of tail.pieces) onDelta(piece);
}
