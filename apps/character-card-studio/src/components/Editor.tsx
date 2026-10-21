import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Toast } from "../App";
import { exportCharacter, fileToDataUrl, resizeImage, type ExportKind } from "../lib/files";
import { normalizeTags } from "../lib/library";
import { compileProfile, compileRpg, PROFILE_FIELDS } from "../lib/profile";
import { checkQuality } from "../lib/quality";
import { checkCharacterSafety, MIN_AGE } from "../lib/safety";
import type { Character, Profile } from "../lib/types";
import { Avatar } from "./Avatar";
import { NumberField, TextField, Toggle } from "./fields";
import { LorebookTab } from "./LorebookTab";
import { PreviewTab } from "./PreviewTab";
import { RpgTab } from "./RpgTab";

type Props = {
  initial: Character;
  isNew: boolean;
  onSave: (character: Character) => Promise<void>;
  onClose: () => void;
  onDelete: (character: Character) => Promise<void>;
  notify: (toast: Toast) => void;
};

const TABS = ["Basics", "Profile", "Greetings", "Examples & prompts", "Lorebook", "RPG sheet", "Test prompt", "Check"] as const;
type Tab = (typeof TABS)[number];

const snapshot = (c: Character) => JSON.stringify({ ...c, updatedAt: 0 });

export function Editor({ initial, isNew, onSave, onClose, onDelete, notify }: Props) {
  const [draft, setDraft] = useState<Character>(initial);
  const [tab, setTab] = useState<Tab>("Basics");
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(snapshot(initial));
  const avatarInput = useRef<HTMLInputElement>(null);

  const dirty = isNew || snapshot({ ...draft, tags: normalizeTags(tagsText) }) !== savedRef.current;
  const report = useMemo(() => checkQuality(draft), [draft]);

  const set = <K extends keyof Character>(key: K, value: Character[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setProfile = (key: keyof Profile, value: string) => setDraft((d) => ({ ...d, profile: { ...d.profile, [key]: value } }));

  const save = useCallback(async () => {
    const next = { ...draft, name: draft.name.trim(), tags: normalizeTags(tagsText) };
    if (!next.name) {
      notify({ kind: "error", text: "Give the character a name before saving." });
      setTab("Basics");
      return;
    }
    const safety = checkCharacterSafety(next);
    if (!safety.ok) {
      notify({ kind: "error", text: `Not saved. Only adult (${MIN_AGE}+) characters are allowed.\n${safety.reasons.join("\n")}` });
      setTab("Check");
      return;
    }
    setSaving(true);
    try {
      next.updatedAt = Date.now();
      await onSave(next);
      savedRef.current = snapshot(next);
      setDraft(next);
    } catch (error) {
      notify({ kind: "error", text: `Save failed: ${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  }, [draft, tagsText, notify, onSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save, dirty]);

  const close = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onClose();
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      set("avatar", await resizeImage(await fileToDataUrl(file)));
    } catch (error) {
      notify({ kind: "error", text: (error as Error).message });
    }
  };

  const doExport = async (kind: ExportKind) => {
    try {
      await exportCharacter({ ...draft, tags: normalizeTags(tagsText) }, kind);
    } catch (error) {
      notify({ kind: "error", text: `Export failed: ${(error as Error).message}` });
    }
  };

  const compiledProfile = [compileProfile(draft.profile), compileRpg(draft.rpg)].filter(Boolean).join("\n\n");

  return (
    <div className="editor">
      <aside className="side">
        <button className="avatar-pick" onClick={() => avatarInput.current?.click()} title="Change avatar">
          <Avatar name={draft.name} src={draft.avatar} className="big" />
          <span className="avatar-hint">Change image</span>
        </button>
        <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
        {draft.avatar && (
          <button className="link small" onClick={() => set("avatar", null)}>
            Remove image
          </button>
        )}

        <div className="side-score">
          <div className={`score big s${Math.floor(report.score / 34)}`}>{report.score}%</div>
          <div className="muted small">complete · ~{report.permanentTokens} permanent tokens</div>
        </div>
        {report.tips.slice(0, 3).map((tip, i) => (
          <button key={i} className={`tip-line ${tip.level}`} onClick={() => setTab("Check")}>
            <b>{tip.field}:</b> {tip.message}
          </button>
        ))}

        <div className="side-actions">
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : dirty ? "Save (Ctrl+S)" : "Saved ✓"}
          </button>
          <div className="row tight">
            <button onClick={() => doExport("png")}>PNG</button>
            <button onClick={() => doExport("v2")}>JSON v2</button>
            <button onClick={() => doExport("v3")}>JSON v3</button>
          </div>
          <button onClick={close}>Back to library</button>
          {!isNew && (
            <button className="danger-text" onClick={() => onDelete(draft)}>
              Delete card
            </button>
          )}
        </div>
      </aside>

      <section className="panel">
        <div className="tabs" role="tablist">
          {TABS.map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? "tab active" : "tab"} onClick={() => setTab(name)}>
              {name}
              {name === "Lorebook" && draft.lorebook.entries.length > 0 && <span className="count"> {draft.lorebook.entries.length}</span>}
              {name === "Check" && report.tips.some((t) => t.level === "error") && <span className="dot" />}
            </button>
          ))}
        </div>

        <div className="tab-body">
          {tab === "Basics" && (
            <>
              <div className="row">
                <TextField label="Name" value={draft.name} onChange={(v) => set("name", v)} placeholder="Character name" />
                <TextField label="Nickname" value={draft.nickname} onChange={(v) => set("nickname", v)} placeholder="Optional" />
                <NumberField label={`Age (${MIN_AGE}+)`} value={draft.age} min={MIN_AGE} onChange={(v) => set("age", v)} />
              </div>
              <TextField
                label="Description"
                value={draft.description}
                onChange={(v) => set("description", v)}
                multiline
                rows={7}
                hint="Who they are, in prose. Profile and RPG fields get appended automatically when exported (see the Profile tab)."
              />
              <TextField
                label="Personality summary"
                value={draft.personality}
                onChange={(v) => set("personality", v)}
                multiline
                rows={3}
                hint="Short trait list or 2–3 sentences."
              />
              <TextField
                label="Scenario"
                value={draft.scenario}
                onChange={(v) => set("scenario", v)}
                multiline
                rows={3}
                hint="The situation when the chat starts. Use {{user}} for the person chatting."
              />
              <TextField
                label="Tags"
                value={tagsText}
                onChange={setTagsText}
                placeholder="fantasy, dnd, cozy"
                hint="Comma separated. Used for library search and filters."
              />
              <div className="row">
                <TextField label="Creator" value={draft.creator} onChange={(v) => set("creator", v)} />
                <TextField label="Card version" value={draft.version} onChange={(v) => set("version", v)} />
              </div>
            </>
          )}

          {tab === "Profile" && (
            <>
              <p className="hint block">
                The in-depth profile. Fill what matters for this character; empty fields are skipped. These become labelled lines that
                models follow reliably.
              </p>
              <Toggle
                label="Include profile (and RPG sheet) in the exported description"
                checked={draft.includeProfileInDescription}
                onChange={(v) => set("includeProfileInDescription", v)}
              />
              <div className="profile-grid">
                {PROFILE_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={draft.profile[field.key]}
                    onChange={(v) => setProfile(field.key, v)}
                    placeholder={field.hint}
                    multiline={field.multiline}
                    rows={3}
                  />
                ))}
              </div>
              {compiledProfile && (
                <details className="compiled">
                  <summary>What gets added to the description</summary>
                  <pre>{compiledProfile}</pre>
                </details>
              )}
            </>
          )}

          {tab === "Greetings" && (
            <>
              <TextField
                label="First message"
                value={draft.firstMes}
                onChange={(v) => set("firstMes", v)}
                multiline
                rows={9}
                hint="The opening reply. Its length, tense, and style are what the bot copies most. Don't write {{user}}'s actions."
              />
              <h4>Alternate greetings</h4>
              <p className="hint">Extra openings the user can swipe between in SillyTavern / Chub.</p>
              {draft.alternateGreetings.map((greeting, index) => (
                <div key={index} className="alt-greeting">
                  <TextField
                    label={`Alternate #${index + 1}`}
                    value={greeting}
                    onChange={(v) => set("alternateGreetings", draft.alternateGreetings.map((g, i) => (i === index ? v : g)))}
                    multiline
                    rows={5}
                  />
                  <button className="link danger-text" onClick={() => set("alternateGreetings", draft.alternateGreetings.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                </div>
              ))}
              <button onClick={() => set("alternateGreetings", [...draft.alternateGreetings, ""])}>+ Add alternate greeting</button>
            </>
          )}

          {tab === "Examples & prompts" && (
            <>
              <TextField
                label="Example dialogue"
                value={draft.mesExample}
                onChange={(v) => set("mesExample", v)}
                multiline
                rows={9}
                placeholder={"<START>\n{{user}}: Hi!\n{{char}}: *waves* \"Hello there.\""}
                hint="Start each exchange with <START>. Show voice, not plot."
              />
              <TextField
                label="System prompt (card override)"
                value={draft.systemPrompt}
                onChange={(v) => set("systemPrompt", v)}
                multiline
                rows={4}
                hint="Replaces the app's main prompt when the user allows card overrides. Leave empty to use theirs."
              />
              <TextField
                label="Post-history instructions (jailbreak / author note)"
                value={draft.postHistoryInstructions}
                onChange={(v) => set("postHistoryInstructions", v)}
                multiline
                rows={3}
                hint="Sent after the chat history; strongest influence on the next reply. Keep it short."
              />
              <TextField
                label="Creator notes"
                value={draft.creatorNotes}
                onChange={(v) => set("creatorNotes", v)}
                multiline
                rows={3}
                hint="Shown to people who download the card. Not sent to the model."
              />
            </>
          )}

          {tab === "Lorebook" && (
            <LorebookTab book={draft.lorebook} onChange={(b) => set("lorebook", b)} scanText={draft.firstMes} />
          )}

          {tab === "RPG sheet" && <RpgTab rpg={draft.rpg} onChange={(r) => set("rpg", r)} />}

          {tab === "Test prompt" && <PreviewTab character={{ ...draft, tags: normalizeTags(tagsText) }} />}

          {tab === "Check" && (
            <>
              <p className="hint block">
                Score {report.score}% · about {report.permanentTokens} tokens are sent with every message. Errors block saving; warnings
                and tips explain how to make the bot behave better.
              </p>
              {report.tips.length === 0 ? (
                <p>Nothing to fix. This card is in great shape.</p>
              ) : (
                <ul className="tips">
                  {report.tips.map((tip, i) => (
                    <li key={i} className={tip.level}>
                      <span className="tip-level">{tip.level}</span> <b>{tip.field}</b> — {tip.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
