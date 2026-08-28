#!/usr/bin/env python3
"""Serve Self Signal static files + POST /api/mix for subliminal creation."""

from __future__ import annotations

import cgi
import json
import mimetypes
import subprocess
import sys
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUILD_SCRIPT = ROOT / "scripts" / "build_subliminal.py"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/mix":
            self.send_error(404, "Not found")
            return

        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                },
            )

            affirmations_text = form.getvalue("affirmations", "")
            if not affirmations_text or not str(affirmations_text).strip():
                raise ValueError("Affirmations text is required")

            silent = form.getvalue("silent") == "1"
            voice_volume = float(form.getvalue("voiceVolume", "0.045") or "0.045")
            duration = form.getvalue("duration")
            duration_sec = float(duration) if duration else None

            music_item = form["music"] if "music" in form else None
            has_music = (
                music_item is not None
                and getattr(music_item, "filename", None)
                and getattr(music_item, "file", None)
            )

            if not silent and not has_music:
                raise ValueError("Upload music or enable silent mode")

            with tempfile.TemporaryDirectory(prefix="mix-api-") as tmp:
                tmp_path = Path(tmp)
                aff_path = tmp_path / "affirmations.txt"
                aff_path.write_text(str(affirmations_text).strip() + "\n", encoding="utf-8")
                out_path = tmp_path / "output.mp3"

                cmd = [
                    sys.executable,
                    str(BUILD_SCRIPT),
                    "--affirmations",
                    str(aff_path),
                    "--output",
                    str(out_path),
                    "--voice-volume",
                    str(voice_volume),
                ]
                if silent:
                    cmd.append("--silent")
                    if duration_sec:
                        cmd.extend(["--duration", str(duration_sec)])
                else:
                    music_file = music_item.file.read()
                    ext = Path(music_item.filename).suffix or ".mp3"
                    music_path = tmp_path / f"music{ext}"
                    music_path.write_bytes(music_file)
                    cmd.extend(["--music", str(music_path)])

                proc = subprocess.run(cmd, capture_output=True, text=True)
                if proc.returncode != 0:
                    raise RuntimeError(proc.stderr or proc.stdout or "Mix failed")

                meta = json.loads(proc.stdout) if proc.stdout.strip() else {}
                data = out_path.read_bytes()

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header(
                "Content-Disposition",
                'attachment; filename="subliminal-mix.mp3"',
            )
            self.send_header("X-Mix-Meta", json.dumps(meta))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            body = json.dumps({"error": str(exc)}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving {ROOT} on http://localhost:{port}")
    print("Mixer UI: http://localhost:{0}/mixer.html".format(port))
    server.serve_forever()


if __name__ == "__main__":
    main()
