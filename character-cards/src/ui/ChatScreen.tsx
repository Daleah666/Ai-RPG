import { useEffect, useState } from "react";
import { readChatResponse } from "../lib/chat-client";
import { getChat, newMessage, saveChat } from "../lib/db";
import { buildPrompt } from "../lib/prompt";
import type { AppSettings, ChatMessage, DepthCard } from "../lib/types";

export function ChatScreen({
  card,
  settings,
  onOpenSettings,
  onBack,
}: {
  card: DepthCard;
  settings: AppSettings;
  onOpenSettings: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const greetings = [card.firstMes, ...card.alternateGreetings].filter((greeting) => greeting.trim());

  useEffect(() => {
    let cancelled = false;
    getChat(card.id)
      .then((thread) => {
        if (!cancelled) setMessages(thread.messages);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the chat.");
      });
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  async function persist(next: ChatMessage[]) {
    setMessages(next);
    await saveChat({ characterId: card.id, messages: next, updatedAt: Date.now() });
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || !messages) return;
    if (!settings.apiKey.trim()) {
      setError("Add an API key in Settings. The library and the prompt preview work without one.");
      return;
    }
    setError("");
    setBusy(true);
    const history = [...messages, newMessage("user", content)];
    await persist(history);
    setDraft("");
    const packet = buildPrompt(card, settings.userName || "You", history);
    let reply = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey.trim()}`,
        },
        body: JSON.stringify({
          baseUrl: settings.apiBaseUrl,
          model: settings.model,
          messages: packet,
          stream: true,
        }),
      });
      await readChatResponse(response, (piece) => {
        reply += piece;
        setMessages([...history, { id: "streaming", role: "assistant", content: reply, createdAt: Date.now() }]);
      });
      if (!reply.trim()) throw new Error("The model returned an empty reply.");
      await persist([...history, newMessage("assistant", reply)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The chat request failed.");
      setMessages(history);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-page">
      <div className="spread">
        <div>
          <button className="btn-quiet" type="button" onClick={onBack}>
            Back to card
          </button>
          <h1>{card.name}</h1>
          <p className="hint">
            The depth note and any matching lore are inserted before this request goes out.
            {!settings.apiKey.trim() ? " No API key yet, so sending stays off." : ""}
          </p>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={onOpenSettings}>
            Settings
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => void persist([])}
            disabled={busy}
          >
            Reset chat
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {messages && messages.length === 0 && (
        <div className="block">
          <h3>Pick a greeting</h3>
          <div className="stack-page">
            {greetings.map((greeting, index) => (
              <button
                key={`${index}-${greeting.slice(0, 16)}`}
                className="btn"
                type="button"
                style={{ whiteSpace: "pre-wrap", textAlign: "left", borderRadius: 16 }}
                onClick={() => void persist([newMessage("assistant", greeting)])}
              >
                {greeting}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="chat-log" data-testid="chat-log">
        {messages?.map((message) => (
          <article key={message.id} className={`bubble ${message.role}`}>
            {message.content}
          </article>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          className="area"
          data-testid="chat-input"
          value={draft}
          disabled={busy || !messages || messages.length === 0}
          placeholder={messages && messages.length === 0 ? "Pick a greeting first." : "Write a line. Enter sends."}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <button className="btn-sea" type="submit" disabled={busy || !messages || messages.length === 0}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
