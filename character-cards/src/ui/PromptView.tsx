import { useMemo, useState } from "react";
import { buildPrompt, selectLore } from "../lib/prompt";
import type { DepthCard } from "../lib/types";

export function PromptView({ card, userName }: { card: DepthCard; userName: string }) {
  const [sample, setSample] = useState("");
  const preview = useMemo(() => {
    const history = sample.trim()
      ? [{ id: "sample", role: "user" as const, content: sample, createdAt: 0 }]
      : [];
    return buildPrompt(card, userName || "You", history);
  }, [card, sample, userName]);
  const matched = useMemo(() => {
    const scan = [card.scenario, card.description, card.personality, sample].join("\n");
    return selectLore(card, scan).map((entry) => entry.name || entry.keys.join(", ") || "Lore");
  }, [card, sample]);

  return (
    <div className="block" data-testid="prompt-preview">
      <h3>Prompt preview</h3>
      <p className="hint">
        This is the exact packet chat will send. A depth note sits that many messages above the
        newest line. If the chat is shorter than the depth, the note sits at the top of the chat.
        Constant lore is always in the opening. Keyed lore appears when a key shows up in the
        card or the recent lines.
      </p>
      <label className="stack">
        <span>Sample line, to test lore keys</span>
        <textarea
          className="area"
          data-testid="sample-line"
          value={sample}
          onChange={(event) => setSample(event.target.value)}
          placeholder="Try harbor, stew, elbow, altar, mayday…"
        />
      </label>
      <p className="meta" data-testid="matched-lore">
        Included lore: {matched.length ? matched.join(" · ") : "none"}
      </p>
      <div className="prompt">
        {preview.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={message.content.startsWith("[Depth") || message.content.startsWith("[Lore") ? "msg depth" : "msg"}
          >
            <b>{message.role}</b>
            {message.content}
          </article>
        ))}
      </div>
    </div>
  );
}
