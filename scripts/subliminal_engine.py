#!/usr/bin/env python3
"""Multi-layer subliminal audio engine: 3 stacked frequency-processed affirmation layers."""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import edge_tts

DEFAULT_VOICE = "en-US-JennyNeural"
SAMPLE_RATE = 44100

FREQUENCY_PROFILES = {
    "normal": {
        "label": "Normal speech band (300–3400 Hz)",
        "filter": "highpass=f=300,lowpass=f=3400",
    },
    "low_band": {
        "label": "Low frequency bed (80–500 Hz)",
        "filter": "highpass=f=80,lowpass=f=500",
    },
    "mid_shift": {
        "label": "Mid shift (~1.6× pitch, 2–6 kHz emphasis)",
        "filter": "asetrate=70560,aresample=44100,atempo=0.625,highpass=f=2000,lowpass=f=8000",
    },
    "high_shift": {
        "label": "High shift (~2× pitch, 4–12 kHz)",
        "filter": "asetrate=88200,aresample=44100,atempo=0.5,highpass=f=4000,lowpass=f=14000",
    },
    "ultrasonic_band": {
        "label": "Upper band (12–17 kHz emphasis)",
        "filter": "asetrate=92610,aresample=44100,atempo=0.5,atempo=0.952,highpass=f=12000,lowpass=f=17500",
    },
}


@dataclass
class LayerConfig:
    enabled: bool = True
    affirmations: list[str] = field(default_factory=list)
    volume: float = 0.045
    frequency: str = "normal"
    voice: str = DEFAULT_VOICE

    def validate(self) -> None:
        if not self.enabled:
            return
        if not self.affirmations:
            raise ValueError("Enabled layer requires at least one affirmation line")
        if self.frequency not in FREQUENCY_PROFILES:
            raise ValueError(
                f"Unknown frequency '{self.frequency}'. "
                f"Choose: {', '.join(FREQUENCY_PROFILES)}"
            )
        if not 0.001 <= self.volume <= 1.0:
            raise ValueError("Layer volume must be between 0.001 and 1.0")


@dataclass
class GenerateRequest:
    layers: list[LayerConfig]
    silent: bool = False
    duration_seconds: float | None = None
    music_path: Path | None = None
    music_volume: float = 1.0
    output_path: Path = Path("output.mp3")

    def validate(self) -> None:
        active = [l for l in self.layers if l.enabled]
        if not active:
            raise ValueError("At least one layer must be enabled")
        for layer in self.layers:
            layer.validate()
        if not self.silent and not self.music_path:
            raise ValueError("Provide music or set silent=true")


def parse_lines(text: str) -> list[str]:
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            lines.append(line)
    return lines


def probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "json", str(path),
    ]
    out = subprocess.check_output(cmd, text=True)
    return float(json.loads(out)["format"]["duration"])


async def synthesize_cycle(lines: list[str], voice: str, out_path: Path) -> None:
    tmpdir = Path(tempfile.mkdtemp(prefix="affirm-"))
    try:
        chunks: list[Path] = []
        for i, line in enumerate(lines):
            chunk = tmpdir / f"{i:03d}.mp3"
            await edge_tts.Communicate(line, voice).save(str(chunk))
            chunks.append(chunk)
        list_file = tmpdir / "list.txt"
        list_file.write_text(
            "\n".join(f"file '{c.as_posix()}'" for c in chunks), encoding="utf-8"
        )
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
             "-c", "copy", str(out_path)],
            check=True, capture_output=True,
        )
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def loop_to_duration(source: Path, seconds: float, out_path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(source),
         "-t", str(seconds), "-c", "copy", str(out_path)],
        check=True, capture_output=True,
    )


def apply_frequency_profile(source: Path, profile: str, out_path: Path) -> None:
    filt = FREQUENCY_PROFILES[profile]["filter"]
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), "-af", filt, str(out_path)],
        check=True, capture_output=True,
    )


def make_silent_base(seconds: float, out_path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
         "-t", str(seconds), str(out_path)],
        check=True, capture_output=True,
    )


def mix_all(
    background: Path,
    layer_tracks: list[tuple[Path, float]],
    output: Path,
    music_volume: float = 1.0,
) -> None:
    """Stack background + N processed layer tracks."""
    inputs = ["-i", str(background)]
    for track, _ in layer_tracks:
        inputs.extend(["-i", str(track)])

    parts = [f"[0:a]volume={music_volume}[bg]"]
    mix_labels = ["[bg]"]
    for idx, (_, vol) in enumerate(layer_tracks, start=1):
        label = f"l{idx}"
        parts.append(f"[{idx}:a]volume={vol}[{label}]")
        mix_labels.append(f"[{label}]")

    n = len(mix_labels)
    parts.append(
        f"{''.join(mix_labels)}amix=inputs={n}:duration=first:dropout_transition=0[out]"
    )
    filter_complex = ";".join(parts)

    cmd = ["ffmpeg", "-y", *inputs, "-filter_complex", filter_complex,
           "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", str(output)]
    subprocess.run(cmd, check=True, capture_output=True)


async def generate(req: GenerateRequest) -> dict[str, Any]:
    req.validate()
    tmp = Path(tempfile.mkdtemp(prefix="subliminal-engine-"))
    try:
        if req.silent:
            target = req.duration_seconds or 600.0
            bg = tmp / "silent.wav"
            make_silent_base(target, bg)
        else:
            bg = Path(req.music_path)  # type: ignore
            target = req.duration_seconds or probe_duration(bg)

        processed_layers: list[tuple[Path, float]] = []
        layer_meta: list[dict] = []

        for i, layer in enumerate(req.layers):
            if not layer.enabled:
                continue
            cycle = tmp / f"layer{i}_cycle.mp3"
            await synthesize_cycle(layer.affirmations, layer.voice, cycle)
            filtered = tmp / f"layer{i}_filtered.mp3"
            apply_frequency_profile(cycle, layer.frequency, filtered)
            looped = tmp / f"layer{i}_looped.mp3"
            loop_to_duration(filtered, target, looped)
            processed_layers.append((looped, layer.volume))
            layer_meta.append({
                "index": i + 1,
                "lines": len(layer.affirmations),
                "frequency": layer.frequency,
                "frequency_label": FREQUENCY_PROFILES[layer.frequency]["label"],
                "volume": layer.volume,
                "voice": layer.voice,
            })

        req.output_path.parent.mkdir(parents=True, exist_ok=True)
        mix_all(bg, processed_layers, req.output_path, req.music_volume)

        return {
            "output": str(req.output_path),
            "duration_seconds": round(target, 1),
            "layers_active": len(processed_layers),
            "layers": layer_meta,
            "silent": req.silent,
            "frequency_profiles_available": list(FREQUENCY_PROFILES.keys()),
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def request_from_dict(data: dict[str, Any], output_path: Path) -> GenerateRequest:
    layers = []
    for raw in data.get("layers", []):
        aff = raw.get("affirmations", [])
        if isinstance(aff, str):
            aff = parse_lines(aff)
        layers.append(LayerConfig(
            enabled=raw.get("enabled", True),
            affirmations=aff,
            volume=float(raw.get("volume", 0.045)),
            frequency=raw.get("frequency", "normal"),
            voice=raw.get("voice", DEFAULT_VOICE),
        ))
    music_path = None
    if data.get("music_path"):
        music_path = Path(data["music_path"])

    return GenerateRequest(
        layers=layers,
        silent=bool(data.get("silent", False)),
        duration_seconds=data.get("duration_seconds"),
        music_path=music_path,
        music_volume=float(data.get("music_volume", 1.0)),
        output_path=output_path,
    )


def schema() -> dict[str, Any]:
    return {
        "name": "Self Signal Subliminal API",
        "version": "2.0",
        "endpoints": {
            "GET /api/health": "Server status",
            "GET /api/schema": "This document",
            "POST /api/v1/generate": "JSON body → MP3 (3-layer stack)",
            "POST /api/mix": "Multipart form (legacy + layers JSON field)",
        },
        "layer_count": 3,
        "frequency_profiles": {
            k: v["label"] for k, v in FREQUENCY_PROFILES.items()
        },
        "generate_body_example": {
            "silent": False,
            "duration_seconds": None,
            "music_volume": 1.0,
            "layers": [
                {
                    "enabled": True,
                    "affirmations": ["I am focused.", "I follow through."],
                    "volume": 0.06,
                    "frequency": "normal",
                    "voice": DEFAULT_VOICE,
                },
                {
                    "enabled": True,
                    "affirmations": ["Calm clarity.", "Steady progress."],
                    "volume": 0.04,
                    "frequency": "mid_shift",
                },
                {
                    "enabled": True,
                    "affirmations": ["Success is my habit."],
                    "volume": 0.03,
                    "frequency": "ultrasonic_band",
                },
            ],
        },
    }
