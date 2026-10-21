import { useEffect, useState } from "react";
import { listCharacters } from "./lib/db";
import { hrefFor, parseHash, type Route } from "./lib/route";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./lib/settings";
import type { AppSettings, CardDraft, DepthCard } from "./lib/types";
import { ChatScreen } from "./ui/ChatScreen";
import { EditorScreen } from "./ui/EditorScreen";
import { LibraryScreen } from "./ui/LibraryScreen";
import { SheetScreen } from "./ui/SheetScreen";

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [cards, setCards] = useState<DepthCard[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    draft: CardDraft;
    preservedId: string | null;
  } | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function reload() {
    const rows = await listCharacters();
    setCards(rows);
  }

  useEffect(() => {
    let cancelled = false;
    listCharacters()
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not open the library.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function go(next: Route) {
    const href = hrefFor(next);
    if (window.location.hash !== href) window.location.hash = href;
    else setRoute(next);
  }

  function updateSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  const current = cards?.find((card) => "id" in route && card.id === route.id) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => go({ name: "library" })}>
          <strong>Character Cards</strong>
          <span>In-depth alpha</span>
        </button>
        <div className="spacer" />
        <button className="btn" type="button" data-testid="settings-button" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>
      <main className="page">
        {loadError && <div className="error">{loadError}</div>}
        {cards === null ? (
          <p className="lede">Opening the library in this browser…</p>
        ) : (
          <Body
            route={route}
            cards={cards}
            current={current}
            settings={settings}
            reload={reload}
            go={go}
            onOpenSettings={() => setSettingsOpen(true)}
            onGuide={() => updateSettings({ ...settings, guideDismissed: true })}
            pendingImport={pendingImport}
            onImportDraft={(draft, preservedId) => setPendingImport({ draft, preservedId })}
            onConsumedImport={() => setPendingImport(null)}
          />
        )}
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            updateSettings(next);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Body({
  route,
  cards,
  current,
  settings,
  reload,
  go,
  onOpenSettings,
  onGuide,
  pendingImport,
  onImportDraft,
  onConsumedImport,
}: {
  route: Route;
  cards: DepthCard[];
  current: DepthCard | null;
  settings: AppSettings;
  reload: () => Promise<void>;
  go: (route: Route) => void;
  onOpenSettings: () => void;
  onGuide: () => void;
  pendingImport: { draft: CardDraft; preservedId: string | null } | null;
  onImportDraft: (draft: CardDraft, preservedId: string | null) => void;
  onConsumedImport: () => void;
}) {
  if (route.name === "library") {
    return (
      <div className="stack-page">
        {!settings.guideDismissed && (
          <aside className="guide" data-testid="guide">
            <strong>How depth works</strong>
            <p>
              A normal card dumps the whole biography into the first instruction and then forgets
              it. A depth note is inserted a few messages above the newest line, so the reminder
              stays near the live chat. Lore entries do the same when their keys show up — “harbor”
              pulls Mira’s wharf, “elbow” pulls Sable’s weight-paint note.
            </p>
            <button className="btn" type="button" onClick={onGuide}>
              Got it
            </button>
          </aside>
        )}
        <LibraryScreen
          cards={cards}
          onReload={reload}
          onOpen={(id) => go({ name: "sheet", id })}
          onEditNew={() => go({ name: "edit", id: "new" })}
          onImportDraft={onImportDraft}
        />
      </div>
    );
  }

  if (route.name === "edit") {
    if (route.id !== "new" && !current) {
      return (
        <div className="empty">
          <h1>That card is not in this browser</h1>
          <button className="btn-sea" type="button" onClick={() => go({ name: "library" })}>
            Back to the library
          </button>
        </div>
      );
    }
    return (
      <EditorScreen
        existing={route.id === "new" ? null : current}
        imported={route.id === "new" ? pendingImport : null}
        onSaved={(id) => {
          onConsumedImport();
          void reload().then(() => go({ name: "sheet", id }));
        }}
        onCancel={() => {
          onConsumedImport();
          go(current && route.id !== "new" ? { name: "sheet", id: current.id } : { name: "library" });
        }}
      />
    );
  }

  if (!current) {
    return (
      <div className="empty">
        <h1>That card is not in this browser</h1>
        <button className="btn-sea" type="button" onClick={() => go({ name: "library" })}>
          Back to the library
        </button>
      </div>
    );
  }

  if (route.name === "chat") {
    return (
      <ChatScreen
        card={current}
        settings={settings}
        onOpenSettings={onOpenSettings}
        onBack={() => go({ name: "sheet", id: current.id })}
      />
    );
  }

  return (
    <SheetScreen
      card={current}
      userName={settings.userName}
      onEdit={() => go({ name: "edit", id: current.id })}
      onChat={() => go({ name: "chat", id: current.id })}
      onBack={() => go({ name: "library" })}
      onReload={reload}
      onDuplicated={(id) => go({ name: "edit", id })}
    />
  );
}

function SettingsDialog({
  settings,
  onClose,
  onSave,
}: {
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  return (
    <div className="dialog-back" role="presentation" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <h2>Settings</h2>
        <p className="hint">
          The key stays in this browser. Chat sends it only to the base URL below, through the
          local /api/chat proxy, so the provider does not have to allow a browser call.
        </p>
        <label className="stack">
          <span>Your name in the chat</span>
          <input className="field" data-testid="settings-user" value={draft.userName} onChange={(event) => setDraft({ ...draft, userName: event.target.value })} />
        </label>
        <label className="stack">
          <span>API base URL</span>
          <input className="field" value={draft.apiBaseUrl} onChange={(event) => setDraft({ ...draft, apiBaseUrl: event.target.value })} />
        </label>
        <label className="stack">
          <span>Model</span>
          <input className="field" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
        </label>
        <label className="stack">
          <span>API key</span>
          <input className="field" type="password" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder="sk-… or a local provider key" />
        </label>
        <div className="row">
          <button className="btn-sea" type="submit">
            Save settings
          </button>
          <button className="btn-quiet" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
}
