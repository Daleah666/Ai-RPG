import { describe, expect, it } from "vitest";
import { consumeSse } from "../src/lib/chat-client";
import { resolveChatCompletionsUrl } from "../src/lib/api-url";
import { parseHash } from "../src/lib/route";
import { evaluateCharacterSafety } from "../src/lib/safety";

describe("safety", () => {
  it("blocks underage ages and minor wording", () => {
    expect(evaluateCharacterSafety({ name: "A", age: 17, description: "adult" }).ok).toBe(false);
    expect(evaluateCharacterSafety({ name: "A", age: 22, description: "a teenager at school" }).ok).toBe(false);
    expect(evaluateCharacterSafety({ name: "A", age: 30, description: "A ferry clerk." }).ok).toBe(true);
  });
});

describe("routes and api urls", () => {
  it("parses the hash routes", () => {
    expect(parseHash("")).toEqual({ name: "library" });
    expect(parseHash("#/card/seed-mira-vale")).toEqual({ name: "sheet", id: "seed-mira-vale" });
    expect(parseHash("#/new")).toEqual({ name: "edit", id: "new" });
    expect(parseHash("#/chat/abc")).toEqual({ name: "chat", id: "abc" });
  });

  it("builds a chat completions url and rejects other protocols", () => {
    expect(resolveChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(resolveChatCompletionsUrl("http://localhost:11434/v1/chat/completions")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    expect(() => resolveChatCompletionsUrl("file:///tmp/x")).toThrow(/http/);
  });
});

describe("sse", () => {
  it("pulls streamed text and keeps a partial line", () => {
    const first = consumeSse('data: {"choices":[{"delta":{"content":"Hel"}}]}\n');
    expect(first.pieces).toEqual(["Hel"]);
    const second = consumeSse(`${first.rest}data: {"choices":[{"delta":{"content":"lo"}}]}\ndata: [DONE]\n`);
    expect(second.pieces).toEqual(["lo"]);
  });
});
