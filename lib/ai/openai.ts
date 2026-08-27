import { generateAffirmations } from "../affirmations";

export async function maybeLlmAffirmations(
  theme: string,
  count: number,
  fallback: string[],
): Promise<{ lines: string[]; source: "model" | "local" }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { lines: fallback, source: "local" };

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content:
              "You write subliminal affirmation scripts. Present tense, first person, short, no negatives, no medical claims. Return a JSON array of strings only.",
          },
          {
            role: "user",
            content: `Theme: ${theme}\nCount: ${count}\nUse identity, feeling, evidence, social, and gratitude angles.`,
          },
        ],
      }),
    });
    if (!res.ok) return { lines: fallback, source: "local" };
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { lines: fallback, source: "local" };
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return { lines: fallback, source: "local" };
    const lines = parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, count);
    if (lines.length < 8) return { lines: fallback, source: "local" };
    return { lines, source: "model" };
  } catch {
    return { lines: fallback.length ? fallback : generateAffirmations(theme, count), source: "local" };
  }
}
