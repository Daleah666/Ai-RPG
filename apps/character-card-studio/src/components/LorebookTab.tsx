import { useState } from "react";
import { newLoreEntry } from "../lib/defaults";
import { activateLore } from "../lib/lore";
import { estimateTokens } from "../lib/tokens";
import type { LoreEntry, Lorebook } from "../lib/types";
import { NumberField, TextField, Toggle } from "./fields";

const splitKeys = (value: string) => value.split(",").map((k) => k.trim()).filter(Boolean);

function EntryEditor({ entry, onChange, onRemove, active }: { entry: LoreEntry; onChange: (e: LoreEntry) => void; onRemove: () => void; active: boolean }) {
  const [open, setOpen] = useState(!entry.content);
  const [keysText, setKeysText] = useState(entry.keys.join(", "));
  const [secondaryText, setSecondaryText] = useState(entry.secondaryKeys.join(", "));
  const set = <K extends keyof LoreEntry>(key: K, value: LoreEntry[K]) => onChange({ ...entry, [key]: value });
  const title = entry.comment || entry.keys.slice(0, 3).join(", ") || "New entry";

  return (
    <div className={`lore-entry ${entry.enabled ? "" : "disabled"} ${active ? "hit" : ""}`}>
      <div className="lore-head">
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"} {title}
        </button>
        <span className="muted small">
          {entry.constant ? "constant" : `${entry.keys.length} key${entry.keys.length === 1 ? "" : "s"}`} · ~{estimateTokens(entry.content)} tok
          {active && " · triggered"}
        </span>
        <label className="check small">
          <input type="checkbox" checked={entry.enabled} onChange={(e) => set("enabled", e.target.checked)} /> on
        </label>
        <button className="icon danger" title="Delete entry" onClick={onRemove}>
          ✕
        </button>
      </div>
      {open && (
        <div className="lore-body">
          <TextField label="Title (only for you)" value={entry.comment} onChange={(v) => set("comment", v)} />
          <TextField
            label="Trigger keys"
            value={keysText}
            onChange={(v) => {
              setKeysText(v);
              set("keys", splitKeys(v));
            }}
            placeholder="castle, the keep, /ki?ng/i"
            hint="Comma separated. When any key appears in recent chat, the content is inserted. Wrap in /slashes/ for a regex."
          />
          <TextField label="Content" value={entry.content} onChange={(v) => set("content", v)} multiline rows={4} />
          <div className="row">
            <Toggle label="Constant (always on)" checked={entry.constant} onChange={(v) => set("constant", v)} />
            <Toggle label="Case sensitive" checked={entry.caseSensitive} onChange={(v) => set("caseSensitive", v)} />
            <Toggle label="Selective" checked={entry.selective} onChange={(v) => set("selective", v)} />
          </div>
          {entry.selective && (
            <TextField
              label="Secondary keys (also required)"
              value={secondaryText}
              onChange={(v) => {
                setSecondaryText(v);
                set("secondaryKeys", splitKeys(v));
              }}
              hint="The entry fires only if a trigger key AND one of these appear."
            />
          )}
          <div className="row">
            <NumberField label="Insertion order" value={entry.insertionOrder} onChange={(v) => set("insertionOrder", v)} hint="Lower goes first." />
            <NumberField label="Priority" value={entry.priority} onChange={(v) => set("priority", v)} hint="Higher survives the token budget." />
            <div className="field">
              <label>Position</label>
              <select value={entry.position} onChange={(e) => set("position", e.target.value as LoreEntry["position"])}>
                <option value="before_char">Before character</option>
                <option value="after_char">After character</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LorebookTab({ book, onChange, scanText }: { book: Lorebook; onChange: (b: Lorebook) => void; scanText: string }) {
  const [test, setTest] = useState("");
  const set = <K extends keyof Lorebook>(key: K, value: Lorebook[K]) => onChange({ ...book, [key]: value });
  const activation = activateLore(book, `${scanText}\n${test}`);
  const activeIds = new Set(activation.active.map((e) => e.id));
  const maxOrder = Math.max(0, ...book.entries.map((e) => e.insertionOrder));

  return (
    <div>
      <p className="hint block">
        A lorebook (world info) holds facts the bot only needs sometimes: places, factions, items, people. They cost tokens only when
        a trigger word shows up, so the main description can stay short.
      </p>
      <div className="row">
        <TextField label="Lorebook name" value={book.name} onChange={(v) => set("name", v)} />
        <NumberField label="Scan depth (messages)" value={book.scanDepth} min={1} onChange={(v) => set("scanDepth", v)} />
        <NumberField label="Token budget" value={book.tokenBudget} min={0} onChange={(v) => set("tokenBudget", v)} />
      </div>
      <Toggle
        label="Recursive scanning"
        checked={book.recursiveScanning}
        onChange={(v) => set("recursiveScanning", v)}
        hint="Triggered entries can trigger other entries that their text mentions."
      />

      <div className="field lore-test">
        <label>Try a message</label>
        <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="Type something {{user}} might say to see which entries fire…" />
        <p className="hint">
          {activation.active.length} active (~{activation.tokens} tok)
          {activation.droppedForBudget.length > 0 && `, ${activation.droppedForBudget.length} dropped by the token budget`}. The first
          message is included in the scan.
        </p>
      </div>

      {book.entries.map((entry, index) => (
        <EntryEditor
          key={entry.id}
          entry={entry}
          active={activeIds.has(entry.id)}
          onChange={(next) => set("entries", book.entries.map((e, i) => (i === index ? next : e)))}
          onRemove={() => set("entries", book.entries.filter((_, i) => i !== index))}
        />
      ))}
      <button onClick={() => set("entries", [...book.entries, newLoreEntry(maxOrder + 10)])}>+ Add entry</button>
    </div>
  );
}
