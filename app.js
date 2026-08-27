(() => {
  const STORAGE_KEY = "self-signal-v1";

  const defaultState = () => ({
    northStar: "",
    affirmations: [],
    checkins: [],
    sessions: [],
  });

  let state = load();
  let practiceTimer = null;
  let practiceIndex = 0;
  let practicing = false;

  const els = {
    northStar: document.getElementById("northStar"),
    saveIntent: document.getElementById("saveIntent"),
    intentStatus: document.getElementById("intentStatus"),
    practiceCue: document.getElementById("practiceCue"),
    practiceStage: document.getElementById("practiceStage"),
    lineSeconds: document.getElementById("lineSeconds"),
    useVoice: document.getElementById("useVoice"),
    startPractice: document.getElementById("startPractice"),
    stopPractice: document.getElementById("stopPractice"),
    practiceStatus: document.getElementById("practiceStatus"),
    affirmForm: document.getElementById("affirmForm"),
    affirmInput: document.getElementById("affirmInput"),
    affirmList: document.getElementById("affirmList"),
    checkinForm: document.getElementById("checkinForm"),
    scoreClarity: document.getElementById("scoreClarity"),
    scoreEnergy: document.getElementById("scoreEnergy"),
    scoreFollow: document.getElementById("scoreFollow"),
    outClarity: document.getElementById("outClarity"),
    outEnergy: document.getElementById("outEnergy"),
    outFollow: document.getElementById("outFollow"),
    checkinNote: document.getElementById("checkinNote"),
    checkinStatus: document.getElementById("checkinStatus"),
    checkinList: document.getElementById("checkinList"),
    metricStreak: document.getElementById("metricStreak"),
    metricFollow: document.getElementById("metricFollow"),
    metricSessions: document.getElementById("metricSessions"),
    metricAffirms: document.getElementById("metricAffirms"),
    insightCopy: document.getElementById("insightCopy"),
    exportData: document.getElementById("exportData"),
    importData: document.getElementById("importData"),
    wipeData: document.getElementById("wipeData"),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        affirmations: Array.isArray(parsed.affirmations)
          ? parsed.affirmations
          : [],
        checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function dayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function bindRange(input, output) {
    const sync = () => {
      output.textContent = input.value;
    };
    input.addEventListener("input", sync);
    sync();
  }

  function renderAffirmations() {
    els.affirmList.innerHTML = "";
    if (!state.affirmations.length) {
      const empty = document.createElement("li");
      empty.innerHTML = "<p>No lines yet. Add one you believe and can act on.</p>";
      els.affirmList.appendChild(empty);
      return;
    }

    state.affirmations.forEach((item) => {
      const li = document.createElement("li");
      const text = document.createElement("p");
      text.textContent = item.text;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn ghost";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        state.affirmations = state.affirmations.filter((a) => a.id !== item.id);
        save();
        render();
      });
      li.append(text, remove);
      els.affirmList.appendChild(li);
    });
  }

  function renderCheckins() {
    els.checkinList.innerHTML = "";
    const recent = [...state.checkins]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    if (!recent.length) {
      const empty = document.createElement("li");
      empty.innerHTML = "<p>No check-ins yet.</p>";
      els.checkinList.appendChild(empty);
      return;
    }

    recent.forEach((c) => {
      const li = document.createElement("li");
      const body = document.createElement("div");
      const title = document.createElement("p");
      title.textContent = `${c.date} · C${c.clarity} E${c.energy} F${c.follow}`;
      body.appendChild(title);
      if (c.note) {
        const note = document.createElement("p");
        note.style.color = "var(--muted)";
        note.style.marginTop = "0.35rem";
        note.textContent = c.note;
        body.appendChild(note);
      }
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = "saved";
      li.append(body, meta);
      els.checkinList.appendChild(li);
    });
  }

  function computeStreak() {
    const days = new Set([
      ...state.sessions.map((s) => s.date),
      ...state.checkins.map((c) => c.date),
    ]);
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const key = dayKey(cursor);
      if (!days.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function avgFollow7d() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cut = dayKey(cutoff);
    const recent = state.checkins.filter((c) => c.date >= cut);
    if (!recent.length) return null;
    const sum = recent.reduce((acc, c) => acc + Number(c.follow), 0);
    return (sum / recent.length).toFixed(1);
  }

  function renderInsights() {
    const streak = computeStreak();
    const follow = avgFollow7d();
    els.metricStreak.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
    els.metricFollow.textContent = follow ?? "—";
    els.metricSessions.textContent = String(state.sessions.length);
    els.metricAffirms.textContent = String(state.affirmations.length);

    if (!state.checkins.length && !state.sessions.length) {
      els.insightCopy.textContent =
        "After a few days of practice and check-ins, you’ll see your own trend here.";
      return;
    }

    if (follow !== null && Number(follow) >= 4) {
      els.insightCopy.textContent =
        "Follow-through is strong. Keep the lines that name concrete next actions.";
    } else if (follow !== null && Number(follow) < 3) {
      els.insightCopy.textContent =
        "Follow-through is soft. Shorten affirmations into one clear behavior for tomorrow morning.";
    } else {
      els.insightCopy.textContent =
        "Steady signal. Pair practice with one visible action within 10 minutes of finishing.";
    }
  }

  function render() {
    els.northStar.value = state.northStar || "";
    renderAffirmations();
    renderCheckins();
    renderInsights();
    if (!practicing) {
      els.practiceCue.textContent = state.affirmations.length
        ? state.affirmations[0].text
        : "Add affirmations below, then begin.";
    }
  }

  function speak(text) {
    if (!els.useVoice.checked || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }

  function showLine() {
    if (!state.affirmations.length) return;
    const item = state.affirmations[practiceIndex % state.affirmations.length];
    els.practiceStage.classList.remove("active");
    // reflow for animation restart
    void els.practiceStage.offsetWidth;
    els.practiceStage.classList.add("active");
    els.practiceCue.textContent = item.text;
    speak(item.text);
    practiceIndex += 1;
  }

  function stopPractice(completed = false) {
    practicing = false;
    clearInterval(practiceTimer);
    practiceTimer = null;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    els.startPractice.disabled = false;
    els.stopPractice.disabled = true;
    els.practiceStage.classList.remove("active");
    els.practiceStatus.textContent = completed
      ? "Session saved on this device."
      : "Session stopped.";
    if (els.practiceStatus.textContent) {
      els.practiceStatus.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function startPractice() {
    if (!state.affirmations.length) {
      els.practiceStatus.textContent = "Add at least one affirmation first.";
      return;
    }

    const seconds = Math.min(
      60,
      Math.max(4, Number(els.lineSeconds.value) || 10)
    );
    els.lineSeconds.value = String(seconds);
    practicing = true;
    practiceIndex = 0;
    els.startPractice.disabled = true;
    els.stopPractice.disabled = false;
    els.practiceStatus.textContent = "Practicing… stay with each line.";

    state.sessions.push({
      id: uid(),
      date: dayKey(),
      at: new Date().toISOString(),
      lineSeconds: seconds,
      count: state.affirmations.length,
    });
    save();
    renderInsights();

    showLine();
    practiceTimer = setInterval(showLine, seconds * 1000);

    // auto-stop after ~6 minutes or 2 full loops, whichever longer-ish
    const loops = Math.max(2, Math.ceil(360 / (seconds * state.affirmations.length)));
    const totalMs = loops * state.affirmations.length * seconds * 1000;
    setTimeout(() => {
      if (practicing) stopPractice(true);
    }, totalMs);
  }

  function syncNorthStarFromDom() {
    state.northStar = els.northStar.value.trim();
  }

  function flashStatus(el, message) {
    el.textContent = message;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function addAffirmation() {
    syncNorthStarFromDom();
    const text = els.affirmInput.value.trim();
    if (!text) {
      flashStatus(els.practiceStatus, "Type an affirmation before adding.");
      return false;
    }
    state.affirmations.push({
      id: uid(),
      text,
      createdAt: new Date().toISOString(),
    });
    els.affirmInput.value = "";
    save();
    render();
    flashStatus(els.practiceStatus, "Affirmation saved on this device.");
    return true;
  }

  els.saveIntent.addEventListener("click", () => {
    syncNorthStarFromDom();
    save();
    flashStatus(els.intentStatus, "Aim saved locally.");
  });

  els.northStar.addEventListener("change", () => {
    syncNorthStarFromDom();
    save();
  });

  els.affirmForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addAffirmation();
  });

  els.startPractice.addEventListener("click", startPractice);
  els.stopPractice.addEventListener("click", () => stopPractice(false));

  bindRange(els.scoreClarity, els.outClarity);
  bindRange(els.scoreEnergy, els.outEnergy);
  bindRange(els.scoreFollow, els.outFollow);

  els.checkinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const today = dayKey();
    const entry = {
      id: uid(),
      date: today,
      clarity: Number(els.scoreClarity.value),
      energy: Number(els.scoreEnergy.value),
      follow: Number(els.scoreFollow.value),
      note: els.checkinNote.value.trim(),
      at: new Date().toISOString(),
    };
    state.checkins = state.checkins.filter((c) => c.date !== today);
    state.checkins.push(entry);
    els.checkinNote.value = "";
    save();
    render();
    flashStatus(els.checkinStatus, "Today’s check-in saved on this device.");
  });

  els.exportData.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `self-signal-backup-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  els.importData.addEventListener("change", async () => {
    const file = els.importData.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      state = {
        ...defaultState(),
        ...parsed,
        affirmations: Array.isArray(parsed.affirmations)
          ? parsed.affirmations
          : [],
        checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
      save();
      render();
      els.insightCopy.textContent = "Backup imported into local storage.";
    } catch {
      els.insightCopy.textContent = "Import failed. Use a Self Signal JSON backup.";
    } finally {
      els.importData.value = "";
    }
  });

  els.wipeData.addEventListener("click", () => {
    const ok = window.confirm(
      "Wipe all Self Signal data on this browser? This cannot be undone."
    );
    if (!ok) return;
    state = defaultState();
    localStorage.removeItem(STORAGE_KEY);
    stopPractice(false);
    render();
    els.insightCopy.textContent = "Local data wiped.";
  });

  render();
})();
