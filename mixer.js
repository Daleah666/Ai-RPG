const LAYER_DEFAULTS = [
  {
    title: "Layer 1 — Normal band",
    frequency: "normal",
    volume: 0.06,
    preset: `I open my laptop and start the hardest task within five minutes.
I protect one focused block every weekday morning.
I finish deep work before noon and keep my evenings calm.`,
  },
  {
    title: "Layer 2 — Mid shift",
    frequency: "mid_shift",
    volume: 0.04,
    preset: `Calm clarity flows through my work.
I choose one action and begin immediately.
Steady progress is my default.`,
  },
  {
    title: "Layer 3 — Upper band",
    frequency: "ultrasonic_band",
    volume: 0.03,
    preset: `Success is my daily habit.
My follow-through grows stronger every day.
I trust my focused self.`,
  },
];

const FREQUENCIES = [
  ["normal", "Normal (300–3400 Hz)"],
  ["low_band", "Low band (80–500 Hz)"],
  ["mid_shift", "Mid shift"],
  ["high_shift", "High shift"],
  ["ultrasonic_band", "Upper band (12–17 kHz)"],
];

const els = {
  layerPanels: document.getElementById("layerPanels"),
  silentMode: document.getElementById("silentMode"),
  musicFile: document.getElementById("musicFile"),
  durationMin: document.getElementById("durationMin"),
  mixBtn: document.getElementById("mixBtn"),
  copyApiBtn: document.getElementById("copyApiBtn"),
  mixStatus: document.getElementById("mixStatus"),
};

function buildLayers() {
  LAYER_DEFAULTS.forEach((def, i) => {
    const n = i + 1;
    const panel = document.createElement("section");
    panel.className = "panel layer-panel";
    panel.innerHTML = `
      <div class="panel-head">
        <h2>${def.title}</h2>
        <label class="check">
          <input type="checkbox" id="layer${n}Enabled" checked />
          <span>Enable layer ${n}</span>
        </label>
      </div>
      <label class="field">
        <span>Affirmations (one per line)</span>
        <textarea id="layer${n}" rows="5">${def.preset}</textarea>
      </label>
      <div class="layer-controls">
        <label class="field inline">
          <span>Frequency profile</span>
          <select id="layer${n}Frequency">
            ${FREQUENCIES.map(([v, l]) => `<option value="${v}" ${v === def.frequency ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </label>
        <label class="field inline">
          <span>Volume</span>
          <input type="number" id="layer${n}Volume" min="0.01" max="0.2" step="0.005" value="${def.volume}" />
        </label>
      </div>
      <label class="btn ghost file-btn">
        Load .txt
        <input type="file" id="layer${n}File" accept=".txt,text/plain" hidden />
      </label>`;
    els.layerPanels.appendChild(panel);

    panel.querySelector(`#layer${n}File`).addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      panel.querySelector(`#layer${n}`).value = await file.text();
      e.target.value = "";
    });
  });
}

function collectLayers() {
  return [1, 2, 3].map((n) => ({
    enabled: document.getElementById(`layer${n}Enabled`).checked,
    affirmations: document.getElementById(`layer${n}`).value.trim(),
    frequency: document.getElementById(`layer${n}Frequency`).value,
    volume: Number(document.getElementById(`layer${n}Volume`).value),
  })).filter((l) => l.enabled && l.affirmations);
}

function buildApiPayload() {
  const silent = els.silentMode.checked;
  return {
    silent,
    duration_seconds: silent ? Number(els.durationMin.value) * 60 : null,
    layers: collectLayers().map((l) => ({
      enabled: true,
      affirmations: l.affirmations.split("\n").map((s) => s.trim()).filter(Boolean),
      frequency: l.frequency,
      volume: l.volume,
    })),
  };
}

els.silentMode.addEventListener("change", () => {
  els.musicFile.disabled = els.silentMode.checked;
});

els.copyApiBtn.addEventListener("click", async () => {
  const json = JSON.stringify(buildApiPayload(), null, 2);
  await navigator.clipboard.writeText(json);
  els.mixStatus.textContent = "API JSON copied. POST to /api/v1/generate";
});

els.mixBtn.addEventListener("click", async () => {
  const layers = collectLayers();
  if (!layers.length) {
    els.mixStatus.textContent = "Enable at least one layer with text.";
    return;
  }
  const silent = els.silentMode.checked;
  const music = els.musicFile.files?.[0];
  if (!silent && !music) {
    els.mixStatus.textContent = "Upload music or use silent mode.";
    return;
  }

  const form = new FormData();
  form.append("layers", JSON.stringify(layers.map((l) => ({
    enabled: true,
    affirmations: l.affirmations,
    frequency: l.frequency,
    volume: l.volume,
  }))));
  form.append("silent", silent ? "1" : "0");
  if (silent) form.append("duration", String(Number(els.durationMin.value) * 60));
  if (music) form.append("music", music);

  els.mixBtn.disabled = true;
  els.mixStatus.textContent = "Stacking 3 layers… may take 1–3 minutes.";

  try {
    const res = await fetch("/api/mix", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}. Run: python3 serve.py`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subliminal-3layer.mp3";
    a.click();
    URL.revokeObjectURL(url);
    const meta = res.headers.get("X-Mix-Meta");
    els.mixStatus.textContent = meta
      ? `Done — ${JSON.parse(meta).layers_active} layers stacked.`
      : "MP3 downloaded.";
  } catch (e) {
    els.mixStatus.textContent = String(e.message || e);
  } finally {
    els.mixBtn.disabled = false;
  }
});

buildLayers();
