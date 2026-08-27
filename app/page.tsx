import { LandingGenerate } from "@/components/LandingGenerate";
import { METHODS } from "@/lib/methods";
import { RECIPES } from "@/lib/recipes";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ink text-cream">
      <header className="flex items-center justify-between px-8 py-6">
        <p className="font-display text-xl">Veil Studio</p>
        <nav className="flex gap-6 text-sm text-mist">
          <a href="/studio">Studio</a>
          <a href="/connect">Drive</a>
          <a href="/api-docs">API</a>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-8 pb-24 pt-10">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Theme-trained maker</p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-tight sm:text-7xl">
          Subliminals the way YouTube makers actually stack them.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">
          Type a theme. Veil writes a present-tense script, picks a recipe (rain whisper,
          silent omega, results-picture flash, 25th-frame, theta sleep, layered storm…),
          and plays it as brief image/text flashes over a masked audio bed. Link Google
          Drive or a local folder for results pictures. Drive it from the UI or the HTTP
          API.
        </p>
        <LandingGenerate />
        <p className="mt-4 max-w-xl text-xs text-mist">
          Flashes default to one short frame every few seconds, capped at 2 Hz. This is a
          creative tool, not medical treatment. Evidence for subliminals is mixed.
        </p>
      </section>

      <section className="border-t border-line px-8 py-16">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">Methods on the mix desk</h2>
            <ul className="mt-6 space-y-3 text-sm text-mist">
              {METHODS.map((m) => (
                <li key={m.id}>
                  <span className="text-cream">{m.name}</span> — {m.summary}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl">Recipes</h2>
            <ul className="mt-6 space-y-3 text-sm text-mist">
              {RECIPES.map((r) => (
                <li key={r.id}>
                  <span className="text-cream">{r.name}</span> — {r.youtubeHook}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
