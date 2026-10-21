import { useState } from "react";
import { buildPromptPreview } from "../lib/prompt";
import type { Character } from "../lib/types";

const USER_NAME_KEY = "card-studio:user-name";

export function PreviewTab({ character }: { character: Character }) {
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_NAME_KEY) || "User");
  const [message, setMessage] = useState("");
  const preview = buildPromptPreview(character, userName, message);

  return (
    <div>
      <p className="hint block">
        This is roughly what a SillyTavern-style app sends to the model for this card, with {"{{char}}"} and {"{{user}}"} filled in and
        lorebook entries triggered by the first message plus your test message. Use it to spot contradictions and wasted tokens.
      </p>
      <div className="row">
        <div className="field">
          <label>Your name ({"{{user}}"})</label>
          <input
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              localStorage.setItem(USER_NAME_KEY, e.target.value);
            }}
          />
        </div>
        <div className="field grow">
          <label>Test message</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What would you say first?" />
        </div>
      </div>
      <p className="muted small">
        Total ≈ {preview.totalTokens} tokens · {preview.lore.active.length} lore entr{preview.lore.active.length === 1 ? "y" : "ies"} active
      </p>
      <div className="prompt-preview">
        {preview.sections.map((section) => (
          <div key={section.label} className="prompt-section">
            <div className="prompt-label">
              {section.label} <span className="muted">~{section.tokens} tok</span>
            </div>
            <pre>{section.text}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
