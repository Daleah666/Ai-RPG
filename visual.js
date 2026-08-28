const STORAGE_KEY = "visual-flash-v1";

const els = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  imageGrid: document.getElementById("imageGrid"),
  clearBtn: document.getElementById("clearBtn"),
  demoBtn: document.getElementById("demoBtn"),
  textImport: document.getElementById("textImport"),
  textToCardsBtn: document.getElementById("textToCardsBtn"),
  intervalMs: document.getElementById("intervalMs"),
  intervalOut: document.getElementById("intervalOut"),
  opacity: document.getElementById("opacity"),
  opacityOut: document.getElementById("opacityOut"),
  positionMode: document.getElementById("positionMode"),
  shuffle: document.getElementById("shuffle"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  flashStatus: document.getElementById("flashStatus"),
  overlay: document.getElementById("overlay"),
  flashImg: document.getElementById("flashImg"),
  toolbar: document.getElementById("toolbar"),
  toolbarStop: document.getElementById("toolbarStop"),
  toolbarCount: document.getElementById("toolbarCount"),
};

/** @type {{ id: string, name: string, url: string }[]} */
let images = [];
let timer = null;
let idx = 0;
let order = [];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function syncOutputs() {
  els.intervalOut.textContent = els.intervalMs.value;
  els.opacityOut.textContent = (Number(els.opacity.value) / 100).toFixed(2);
}

els.intervalMs.addEventListener("input", syncOutputs);
els.opacity.addEventListener("input", syncOutputs);
syncOutputs();

function renderGrid() {
  els.imageGrid.innerHTML = "";
  images.forEach((img) => {
    const fig = document.createElement("figure");
    const image = document.createElement("img");
    image.src = img.url;
    image.alt = img.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove";
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(img.url);
      images = images.filter((i) => i.id !== img.id);
      renderGrid();
    });
    fig.append(image, remove);
    els.imageGrid.appendChild(fig);
  });
  els.flashStatus.textContent = images.length
    ? `${images.length} image(s) ready.`
    : "";
}

function addFiles(fileList) {
  const added = [];
  Array.from(fileList).forEach((file) => {
    if (!file.type.startsWith("image/")) return;
    added.push({
      id: uid(),
      name: file.name,
      url: URL.createObjectURL(file),
    });
  });
  if (!added.length) {
    els.flashStatus.textContent = "No image files detected.";
    return;
  }
  images.push(...added);
  renderGrid();
  els.flashStatus.textContent = `Added ${added.length} image(s). Total: ${images.length}.`;
}

function bindDropZone() {
  els.dropZone.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => {
    if (els.fileInput.files?.length) addFiles(els.fileInput.files);
    els.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((ev) => {
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
    });
  });
  els.dropZone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  document.body.addEventListener("dragover", (e) => e.preventDefault());
  document.body.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });
}

function makeDemoCard(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0c1210";
  ctx.fillRect(0, 0, 640, 360);
  ctx.fillStyle = "#d6ff4b";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(" ");
  let line = "";
  const lines = [];
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 560) {
      lines.push(line);
      line = w;
    } else line = test;
  });
  if (line) lines.push(line);
  const startY = 180 - (lines.length - 1) * 20;
  lines.forEach((ln, i) => ctx.fillText(ln, 320, startY + i * 44));
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({
        id: uid(),
        name: text.slice(0, 24) + ".png",
        url: URL.createObjectURL(blob),
      });
    }, "image/png");
  });
}

els.demoBtn.addEventListener("click", async () => {
  const demos = [
    "I am focused",
    "I follow through",
    "Calm clarity",
    "Start now",
  ];
  for (const t of demos) images.push(await makeDemoCard(t));
  renderGrid();
});

els.textToCardsBtn.addEventListener("click", async () => {
  const lines = els.textImport.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) {
    els.flashStatus.textContent = "Paste at least one line.";
    return;
  }
  for (const line of lines) images.push(await makeDemoCard(line));
  els.textImport.value = "";
  renderGrid();
  els.flashStatus.textContent = `Added ${lines.length} text card(s). Total: ${images.length}.`;
});

els.clearBtn.addEventListener("click", () => {
  stopFlash();
  images.forEach((i) => URL.revokeObjectURL(i.url));
  images = [];
  renderGrid();
});

function placeImage() {
  const mode = els.positionMode.value;
  const img = els.flashImg;
  img.style.position = "absolute";
  if (mode === "center") {
    img.style.left = "50%";
    img.style.top = "50%";
    img.style.transform = "translate(-50%, -50%)";
    return;
  }
  const pad = 8;
  const positions =
    mode === "corners"
      ? [
          [pad, pad],
          [100 - pad, pad],
          [pad, 100 - pad],
          [100 - pad, 100 - pad],
        ]
      : [[10, 20], [70, 15], [25, 65], [60, 55], [15, 80], [75, 70]];
  const [x, y] = positions[Math.floor(Math.random() * positions.length)];
  img.style.left = `${x}%`;
  img.style.top = `${y}%`;
  img.style.transform = "translate(-50%, -50%)";
}

function buildOrder() {
  order = images.map((_, i) => i);
  if (els.shuffle.checked) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  idx = 0;
}

function tick() {
  if (!images.length) return;
  if (idx >= order.length) buildOrder();
  const item = images[order[idx]];
  idx += 1;
  els.flashImg.src = item.url;
  els.flashImg.classList.remove("visible");
  placeImage();
  void els.flashImg.offsetWidth;
  els.overlay.style.setProperty(
    "--flash-opacity",
    String(Number(els.opacity.value) / 100)
  );
  els.flashImg.classList.add("visible");
  els.toolbarCount.textContent = `${images.length} imgs · ${els.intervalMs.value}ms`;
}

function startFlash() {
  if (!images.length) {
    els.flashStatus.textContent = "Add at least one image first.";
    return;
  }
  stopFlash();
  els.overlay.classList.remove("flash-hidden");
  els.toolbar.classList.remove("flash-hidden");
  els.startBtn.disabled = true;
  els.stopBtn.disabled = false;
  buildOrder();
  tick();
  timer = setInterval(tick, Number(els.intervalMs.value));
  els.flashStatus.textContent = "Flashing… click Stop or press Esc.";
}

function stopFlash() {
  clearInterval(timer);
  timer = null;
  els.flashImg.classList.remove("visible");
  els.overlay.classList.add("flash-hidden");
  els.toolbar.classList.add("flash-hidden");
  els.startBtn.disabled = false;
  els.stopBtn.disabled = true;
}

els.startBtn.addEventListener("click", startFlash);
els.stopBtn.addEventListener("click", stopFlash);
els.toolbarStop.addEventListener("click", stopFlash);

els.fullscreenBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    startFlash();
  } else {
    await document.exitFullscreen().catch(() => {});
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stopFlash();
});

bindDropZone();
renderGrid();
