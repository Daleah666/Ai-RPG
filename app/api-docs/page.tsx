export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-ink px-8 py-12 text-cream">
      <a href="/" className="text-sm text-mist">
        ← Veil
      </a>
      <h1 className="mt-6 font-display text-5xl">Generation API</h1>
      <p className="mt-4 max-w-2xl text-mist">
        External apps can mint a full subliminal project from a theme. If{" "}
        <code className="text-gold">SUBLIMINAL_API_KEY</code> is set, send it as{" "}
        <code>Authorization: Bearer</code> or <code>x-api-key</code>. Optional{" "}
        <code>OPENAI_API_KEY</code> upgrades the script; otherwise the on-device theme
        model writes the affirmations.
      </p>

      <section className="mt-10 max-w-3xl space-y-8 text-sm">
        <Endpoint
          method="POST"
          path="/api/v1/generate"
          body={`{
  "theme": "quiet wealth",
  "durationSec": 180,
  "recipeId": "auto",
  "methods": ["auto"],
  "affirmationCount": 40,
  "renderAudio": false
}`}
        />
        <Endpoint method="GET" path="/api/v1/methods" />
        <Endpoint method="GET" path="/api/v1/recipes" />
        <Endpoint method="GET" path="/api/v1/themes" />
        <Endpoint
          method="GET"
          path="/api/v1/suggestions?theme=feminizing"
          extra="Returns featured packs (feminizing, trance, anti-racism, …) plus matches for the theme."
        />
        <Endpoint
          method="POST"
          path="/api/v1/render"
          body={`{ "theme": "deep sleep" }`}
          extra="Returns audio/wav — whisper, reverse, layers, binaural, isochronic, silent carrier."
        />
      </section>
    </main>
  );
}

function Endpoint({
  method,
  path,
  body,
  extra,
}: {
  method: string;
  path: string;
  body?: string;
  extra?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-gold">
        {method} {path}
      </p>
      {extra ? <p className="mt-2 text-mist">{extra}</p> : null}
      {body ? (
        <pre className="mt-3 overflow-auto text-xs text-cream/80">{body}</pre>
      ) : null}
    </div>
  );
}
