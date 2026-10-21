import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveChatCompletionsUrl } from "../src/lib/api-url";

const MAX_BYTES = 1_000_000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error("Chat request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function attachChatProxy(
  middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void },
) {
  middlewares.use("/api/chat", (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (path !== "/" && path !== "" && path !== "/api/chat") {
      next();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Use POST for /api/chat." });
      return;
    }
    void handle(req, res);
  });
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const auth = req.headers.authorization ?? "";
  if (!auth.toLowerCase().startsWith("bearer ") || auth.slice(7).trim() === "") {
    sendJson(res, 401, { error: "Missing API key. Add it in Settings." });
    return;
  }

  let body: {
    baseUrl?: string;
    model?: string;
    messages?: { role?: string; content?: string }[];
    stream?: boolean;
  };
  try {
    body = JSON.parse(await readBody(req)) as typeof body;
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : "Invalid JSON body.",
    });
    return;
  }

  const model = body.model?.trim();
  if (!model) {
    sendJson(res, 400, { error: "Model name is required." });
    return;
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-48) : [];
  if (messages.length === 0) {
    sendJson(res, 400, { error: "Messages are required." });
    return;
  }
  for (const message of messages) {
    if (
      !message ||
      (message.role !== "system" && message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
    ) {
      sendJson(res, 400, { error: "Each message needs a role and text content." });
      return;
    }
  }

  let target: string;
  try {
    target = resolveChatCompletionsUrl(body.baseUrl ?? "");
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid API URL." });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: body.stream !== false,
      }),
    });
  } catch {
    sendJson(res, 502, {
      error: "Could not reach that API URL. Check the base URL, and that the provider is running.",
    });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(text || `Upstream error ${upstream.status}`);
    return;
  }

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
  );
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch {
    res.end();
  }
}
