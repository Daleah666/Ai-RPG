#!/usr/bin/env python3
"""One-button local setup for DeepSeek-R1-0528-Qwen3-8B.

Serves a page on this computer only. The button checks the official weight
files, starts Ollama with cloud mode off, and loads deepseek-r1:8b.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765
OLLAMA = "http://127.0.0.1:11434"
WEIGHTS = Path("/home/ubuntu/models/DeepSeek-R1-0528-Qwen3-8B")
HF_PYTHON = Path("/home/ubuntu/venvs/hf/bin/python")
MIN_WEIGHT_BYTES = 14_000_000_000

STATE_LOCK = threading.Lock()
STATE = {
    "phase": "idle",
    "detail": "One click checks the official files, starts the local runner, and loads DeepSeek.",
    "ready": False,
    "error": None,
    "running": False,
    "weights": "waiting",
    "runner": "waiting",
    "loaded": "waiting",
    "answer": "",
}


def snapshot():
    with STATE_LOCK:
        return dict(STATE)


def update(**fields):
    with STATE_LOCK:
        STATE.update(fields)


def weights_ready() -> bool:
    if not WEIGHTS.is_dir():
        return False
    total = sum(path.stat().st_size for path in WEIGHTS.glob("*.safetensors"))
    return total >= MIN_WEIGHT_BYTES


def ollama_up() -> bool:
    try:
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=3) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def model_present() -> bool:
    try:
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=5) as response:
            payload = json.load(response)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return False
    names = [item.get("name", "") for item in payload.get("models", [])]
    return any(name.split(":")[0] == "deepseek-r1" and "8b" in name for name in names)


def download_weights():
    if not HF_PYTHON.is_file():
        raise RuntimeError("The Hugging Face downloader is not installed on this computer.")
    update(weights="downloading", detail="Downloading the official DeepSeek weight files.")
    script = """
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
    local_dir="/home/ubuntu/models/DeepSeek-R1-0528-Qwen3-8B",
)
print("DOWNLOADED")
"""
    subprocess.run([str(HF_PYTHON), "-c", script], check=True)
    if not weights_ready():
        raise RuntimeError("The download finished, but the weight files are still incomplete.")


def ensure_runner():
    if ollama_up():
        update(runner="running", detail="The local runner is already on.")
        return
    update(runner="starting", detail="Starting the local runner with cloud mode off.")
    log_path = Path("/tmp/deepseek-ready-ollama.log")
    log_handle = log_path.open("ab")
    subprocess.Popen(
        ["ollama", "serve"],
        env={**os.environ, "OLLAMA_NO_CLOUD": "1", "OLLAMA_HOST": "127.0.0.1:11434"},
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    for _ in range(40):
        if ollama_up():
            update(runner="running", detail="The local runner is on.")
            return
        threading.Event().wait(0.25)
    raise RuntimeError("The local runner did not start. See /tmp/deepseek-ready-ollama.log.")


def ensure_model():
    if model_present():
        update(detail="The 8B model is already stored on this computer.")
        return
    update(detail="Fetching the runnable 8B model into the local runner.")
    subprocess.run(["ollama", "pull", "deepseek-r1:8b"], check=True)
    if not model_present():
        raise RuntimeError("The pull finished, but deepseek-r1:8b is not in the local list.")


def visible_answer(raw: str) -> str:
    text = raw.strip()
    if "</think>" in text:
        text = text.split("</think>", 1)[1].strip()
    elif text.startswith("<think>"):
        text = ""
    return text or "Loaded into memory and answering on this computer."


def load_model():
    update(loaded="loading", detail="Loading DeepSeek into memory.")
    body = json.dumps(
        {
            "model": "deepseek-r1:8b",
            "prompt": "Reply with the single word ready.",
            "stream": False,
            "think": False,
            "options": {"num_ctx": 256, "num_predict": 24, "temperature": 0},
        }
    ).encode()
    request = urllib.request.Request(
        OLLAMA + "/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=240) as response:
        payload = json.load(response)
    if not payload.get("done"):
        raise RuntimeError("DeepSeek did not finish loading.")
    answer = visible_answer(payload.get("response") or "")
    update(loaded="loaded", answer=answer, detail="DeepSeek is ready on this computer.")


def prepare():
    try:
        update(
            phase="working",
            running=True,
            ready=False,
            error=None,
            answer="",
            weights="checking",
            runner="waiting",
            loaded="waiting",
            detail="Looking for the official weight files.",
        )
        if weights_ready():
            update(weights="present", detail="Official weight files are already on this computer.")
        else:
            download_weights()
            update(weights="present", detail="Official weight files are on this computer.")
        ensure_runner()
        ensure_model()
        load_model()
        update(phase="ready", ready=True, running=False)
    except Exception as exc:  # noqa: BLE001 - show the failure on the button page
        update(
            phase="error",
            running=False,
            ready=False,
            error=str(exc),
            detail=str(exc),
        )


def start_prepare() -> bool:
    with STATE_LOCK:
        if STATE["running"]:
            return False
        STATE["running"] = True
    threading.Thread(target=prepare, daemon=True).start()
    return True


HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Get DeepSeek ready</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1c1917;
      --muted: #57534e;
      --line: #e7e5e4;
      --paper: #fafaf9;
      --button: #1c1917;
      --button-ink: #fafaf9;
      --good: #166534;
      --bad: #991b1b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--paper);
      color: var(--ink);
      font: 17px/1.45 ui-sans-serif, system-ui, sans-serif;
    }
    main {
      max-width: 640px;
      margin: 0 auto;
      padding: 48px 20px 64px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    .lede {
      margin: 0 0 28px;
      color: var(--muted);
      max-width: 38rem;
    }
    button {
      appearance: none;
      border: 0;
      width: min(100%, 440px);
      min-height: 64px;
      padding: 16px 22px;
      border-radius: 12px;
      background: var(--button);
      color: var(--button-ink);
      font: inherit;
      font-size: 18px;
      font-weight: 650;
      cursor: pointer;
    }
    button:disabled { cursor: default; opacity: 0.72; }
    button.ready { background: var(--good); }
    .status {
      margin: 18px 0 0;
      min-height: 1.45em;
      color: var(--muted);
    }
    .status.error { color: var(--bad); }
    ol {
      list-style: none;
      margin: 28px 0 0;
      padding: 0;
      border-top: 1px solid var(--line);
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 0;
      border-bottom: 1px solid var(--line);
    }
    li span:last-child { color: var(--muted); text-align: right; }
    li.done span:last-child { color: var(--good); }
    .answer {
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      white-space: pre-wrap;
    }
    .answer p { margin: 6px 0 0; }
  </style>
</head>
<body>
  <main>
    <h1>Get DeepSeek ready</h1>
    <p class="lede">This button stays on this computer. It uses the official DeepSeek 8B files already stored here, then loads the model so it can answer offline.</p>
    <button id="go" type="button">Download and get it ready</button>
    <p id="status" class="status">Waiting for you to click.</p>
    <ol>
      <li id="row-weights"><span>Official weights</span><span id="weights">waiting</span></li>
      <li id="row-runner"><span>Local runner</span><span id="runner">waiting</span></li>
      <li id="row-loaded"><span>Model loaded</span><span id="loaded">waiting</span></li>
    </ol>
    <div id="answer" class="answer" hidden>
      <strong>DeepSeek answered</strong>
      <p id="answer-text"></p>
    </div>
  </main>
  <script>
    const button = document.getElementById("go");
    const status = document.getElementById("status");
    const answer = document.getElementById("answer");
    const answerText = document.getElementById("answer-text");
    const labels = {
      waiting: "waiting",
      checking: "checking",
      downloading: "downloading",
      present: "on this computer",
      starting: "starting",
      running: "on",
      loading: "loading",
      loaded: "loaded"
    };

    function paint(data) {
      status.textContent = data.detail || "";
      status.className = data.phase === "error" ? "status error" : "status";
      for (const key of ["weights", "runner", "loaded"]) {
        const row = document.getElementById("row-" + key);
        const cell = document.getElementById(key);
        cell.textContent = labels[data[key]] || data[key];
        const done = ["present", "running", "loaded"].includes(data[key]);
        row.className = done ? "done" : "";
      }
      if (data.ready) {
        button.disabled = true;
        button.className = "ready";
        button.textContent = "DeepSeek is ready";
        if (data.answer) {
          answer.hidden = false;
          answerText.textContent = data.answer;
        }
      } else if (data.running) {
        button.disabled = true;
        button.textContent = "Working...";
      } else if (data.phase === "error") {
        button.disabled = false;
        button.textContent = "Try again";
      }
    }

    async function refresh() {
      const response = await fetch("/api/status");
      paint(await response.json());
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Working...";
      status.textContent = "Starting.";
      await fetch("/api/prepare", { method: "POST" });
      await refresh();
    });

    setInterval(refresh, 700);
    refresh();
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _json(self, payload, code=200):
        raw = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            self._json(snapshot())
            return
        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if path not in ("/", "/index.html"):
            self.send_error(404)
            return
        raw = HTML.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/prepare":
            self.send_error(404)
            return
        started = start_prepare()
        body = snapshot()
        body["started"] = started
        self._json(body)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"DeepSeek button ready at http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
