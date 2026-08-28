const PRESET = `I open my laptop and start the hardest task within five minutes.
I protect one focused block every weekday morning.
I finish deep work before noon and keep my evenings calm.
I choose the next small action and begin immediately.
I stay with one task until it is done or my timer ends.
I am calm, focused, and capable of hard work.
My follow-through improves every day I practice honestly.`;

const els = {
  affirmText: document.getElementById("affirmText"),
  affirmFile: document.getElementById("affirmFile"),
  loadPreset: document.getElementById("loadPreset"),
  silentMode: document.getElementById("silentMode"),
  musicFile: document.getElementById("musicFile"),
  durationMin: document.getElementById("durationMin"),
  voiceVolume: document.getElementById("voiceVolume"),
  voiceVolOut: document.getElementById("voiceVolOut"),
  mixBtn: document.getElementById("mixBtn"),
  mixStatus: document.getElementById("mixStatus"),
};

function syncVol() {
  const v = Number(els.voiceVolume.value) / 100;
  els.voiceVolOut.textContent = v.toFixed(3);
}

els.voiceVolume.addEventListener("input", syncVol);
syncVol();

els.loadPreset.addEventListener("click", () => {
  els.affirmText.value = PRESET;
});

els.affirmFile.addEventListener("change", async () => {
  const file = els.affirmFile.files?.[0];
  if (!file) return;
  els.affirmText.value = await file.text();
  els.affirmFile.value = "";
});

els.silentMode.addEventListener("change", () => {
  els.musicFile.disabled = els.silentMode.checked;
});

els.mixBtn.addEventListener("click", async () => {
  const affirmations = els.affirmText.value.trim();
  if (!affirmations) {
    els.mixStatus.textContent = "Add at least one affirmation line.";
    return;
  }

  const silent = els.silentMode.checked;
  const music = els.musicFile.files?.[0];
  if (!silent && !music) {
    els.mixStatus.textContent = "Upload music or enable silent mode.";
    return;
  }

  const form = new FormData();
  form.append("affirmations", affirmations);
  form.append("silent", silent ? "1" : "0");
  form.append("voiceVolume", String(Number(els.voiceVolume.value) / 100));
  if (silent) {
    form.append("duration", String(Number(els.durationMin.value) * 60));
  } else if (music) {
    form.append("music", music);
  }

  els.mixBtn.disabled = true;
  els.mixStatus.textContent = "Mixing… this can take a minute.";

  try {
    const res = await fetch("/api/mix", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}. Run: python3 serve.py`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subliminal-mix.mp3";
    a.click();
    URL.revokeObjectURL(url);
    els.mixStatus.textContent = "MP3 downloaded. Import into Mind Zoom or play locally.";
  } catch (e) {
    els.mixStatus.textContent = String(e.message || e);
  } finally {
    els.mixBtn.disabled = false;
  }
});
