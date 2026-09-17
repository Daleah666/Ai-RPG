#!/usr/bin/env python3
"""Self Signal server: static files + subliminal generation API."""

from __future__ import annotations

import asyncio
import base64
import cgi
import json
import sys
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "scripts"))
from subliminal_engine import (  # noqa: E402
    FREQUENCY_PROFILES,
    GenerateRequest,
    LayerConfig,
    generate,
    parse_lines,
    request_from_dict,
    schema,
)

DEFAULT_LAYER_FREQ = ["normal", "mid_shift", "ultrasonic_band"]
DEFAULT_LAYER_VOL = [0.06, 0.04, 0.03]


def read_json_body(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    raw = handler.rfile.read(length) if length else b"{}"
    return json.loads(raw.decode("utf-8") or "{}")


def json_response(handler: SimpleHTTPRequestHandler, code: int, payload: dict) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def binary_response(
    handler: SimpleHTTPRequestHandler,
    code: int,
    data: bytes,
    content_type: str,
    filename: str,
    meta: dict | None = None,
) -> None:
    handler.send_response(code)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Disposition", f'attachment; filename="{filename}"')
    if meta:
        handler.send_header("X-Mix-Meta", json.dumps(meta))
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def layers_from_form(form: cgi.FieldStorage) -> list[LayerConfig]:
    layers_json = form.getvalue("layers")
    if layers_json:
        data = json.loads(layers_json)
        return [
            LayerConfig(
                enabled=item.get("enabled", True),
                affirmations=parse_lines(item["affirmations"]) if isinstance(item.get("affirmations"), str) else item.get("affirmations", []),
                volume=float(item.get("volume", 0.045)),
                frequency=item.get("frequency", "normal"),
                voice=item.get("voice", "en-US-JennyNeural"),
            )
            for item in data
        ]

    layers: list[LayerConfig] = []
    fallback = str(form.getvalue("affirmations", "") or "").strip()
    for i in range(1, 4):
        key = f"layer{i}"
        text = str(form.getvalue(key, "") or "").strip()
        enabled = form.getvalue(f"{key}Enabled", "1" if i == 1 else "0") == "1"
        if not text and i == 1:
            text = fallback
        if not text:
            enabled = False
        freq = form.getvalue(f"{key}Frequency", DEFAULT_LAYER_FREQ[i - 1])
        vol = float(form.getvalue(f"{key}Volume", str(DEFAULT_LAYER_VOL[i - 1])) or DEFAULT_LAYER_VOL[i - 1])
        layers.append(LayerConfig(
            enabled=enabled and bool(text),
            affirmations=parse_lines(text) if text else [],
            volume=vol,
            frequency=str(freq),
        ))
    return layers


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            json_response(self, 200, {"status": "ok", "version": "2.0", "layers": 3})
            return
        if path == "/api/schema":
            json_response(self, 200, schema())
            return
        if path == "/api/frequencies":
            json_response(self, 200, {
                "profiles": {k: v["label"] for k, v in FREQUENCY_PROFILES.items()}
            })
            return
        return super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            if path == "/api/v1/generate":
                self._handle_generate_json()
            elif path == "/api/mix":
                self._handle_mix_multipart()
            else:
                self.send_error(404, "Not found")
        except Exception as exc:
            json_response(self, 400, {"error": str(exc)})

    def _handle_generate_json(self) -> None:
        data = read_json_body(self)
        with tempfile.TemporaryDirectory(prefix="api-gen-") as tmp:
            tmp_path = Path(tmp)
            out_path = tmp_path / "output.mp3"

            if data.get("music_base64"):
                raw = base64.b64decode(data["music_base64"])
                ext = data.get("music_ext", ".mp3")
                music_path = tmp_path / f"music{ext}"
                music_path.write_bytes(raw)
                data["music_path"] = str(music_path)

            req = request_from_dict(data, out_path)
            meta = asyncio.run(generate(req))
            mp3 = out_path.read_bytes()

        if data.get("return_base64"):
            json_response(self, 200, {**meta, "audio_base64": base64.b64encode(mp3).decode()})
        else:
            binary_response(self, 200, mp3, "audio/mpeg", "subliminal-3layer.mp3", meta)

    def _handle_mix_multipart(self) -> None:
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            },
        )
        layers = layers_from_form(form)
        silent = form.getvalue("silent") == "1"
        duration = form.getvalue("duration")
        duration_sec = float(duration) if duration else None
        music_volume = float(form.getvalue("musicVolume", "1") or "1")

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
            music_path = None
            if has_music:
                ext = Path(music_item.filename).suffix or ".mp3"
                music_path = tmp_path / f"music{ext}"
                music_path.write_bytes(music_item.file.read())

            out_path = tmp_path / "output.mp3"
            req = GenerateRequest(
                layers=layers,
                silent=silent,
                duration_seconds=duration_sec,
                music_path=music_path,
                music_volume=music_volume,
                output_path=out_path,
            )
            meta = asyncio.run(generate(req))
            data = out_path.read_bytes()

        binary_response(self, 200, data, "audio/mpeg", "subliminal-3layer.mp3", meta)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving {ROOT} on http://localhost:{port}")
    print(f"  Mixer:  http://localhost:{port}/mixer.html")
    print(f"  Visual: http://localhost:{port}/visual.html")
    print(f"  API:    http://localhost:{port}/api/schema")
    server.serve_forever()


if __name__ == "__main__":
    main()
