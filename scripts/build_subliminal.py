#!/usr/bin/env python3
"""Build a subliminal MP3: looped affirmations (TTS) mixed under background audio."""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("Install: pip install edge-tts", file=sys.stderr)
    sys.exit(1)

DEFAULT_VOICE = "en-US-JennyNeural"


def read_affirmations(path: Path) -> list[str]:
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            lines.append(line)
    if not lines:
        raise ValueError(f"No affirmations found in {path}")
    return lines


def probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(path),
    ]
    out = subprocess.check_output(cmd, text=True)
    return float(json.loads(out)["format"]["duration"])


async def synthesize_cycle(lines: list[str], voice: str, out_path: Path) -> None:
    """One spoken pass through all affirmations."""
    chunks: list[Path] = []
    tmpdir = Path(tempfile.mkdtemp(prefix="affirm-"))
    try:
        for i, line in enumerate(lines):
            chunk = tmpdir / f"{i:03d}.mp3"
            comm = edge_tts.Communicate(line, voice)
            await comm.save(str(chunk))
            chunks.append(chunk)

        list_file = tmpdir / "list.txt"
        list_file.write_text(
            "\n".join(f"file '{c.as_posix()}'" for c in chunks),
            encoding="utf-8",
        )
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c",
                "copy",
                str(out_path),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def loop_to_duration(source: Path, target_seconds: float, out_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-stream_loop",
            "-1",
            "-i",
            str(source),
            "-t",
            str(target_seconds),
            "-c",
            "copy",
            str(out_path),
        ],
        check=True,
        capture_output=True,
    )


def make_silent_base(seconds: float, out_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=stereo",
            "-t",
            str(seconds),
            str(out_path),
        ],
        check=True,
        capture_output=True,
    )


def mix_tracks(
    background: Path,
    voice: Path,
    output: Path,
    voice_volume: float,
    music_volume: float = 1.0,
) -> None:
    """Mix voice under music. voice_volume ~0.03–0.08 for subliminal."""
    filter_complex = (
        f"[0:a]volume={music_volume}[bg];"
        f"[1:a]volume={voice_volume}[v];"
        f"[bg][v]amix=inputs=2:duration=first:dropout_transition=0[out]"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(background),
            "-i",
            str(voice),
            "-filter_complex",
            filter_complex,
            "-map",
            "[out]",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(output),
        ],
        check=True,
        capture_output=True,
    )


async def build(
    affirmations_path: Path,
    music_path: Path | None,
    output_path: Path,
    voice: str,
    voice_volume: float,
    duration_seconds: float | None,
    silent: bool,
) -> dict:
    lines = read_affirmations(affirmations_path)
    tmp = Path(tempfile.mkdtemp(prefix="subliminal-"))
    try:
        cycle_mp3 = tmp / "cycle.mp3"
        await synthesize_cycle(lines, voice, cycle_mp3)
        cycle_len = probe_duration(cycle_mp3)

        if silent:
            target = duration_seconds or 600.0
            bg = tmp / "silent.wav"
            make_silent_base(target, bg)
        else:
            if not music_path or not music_path.exists():
                raise FileNotFoundError("Music file required unless --silent")
            bg = music_path
            target = duration_seconds or probe_duration(bg)

        looped = tmp / "voice_looped.mp3"
        loop_to_duration(cycle_mp3, target, looped)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        mix_tracks(bg, looped, output_path, voice_volume=voice_volume)

        return {
            "output": str(output_path),
            "affirmations": len(lines),
            "duration_seconds": round(target, 1),
            "cycle_seconds": round(cycle_len, 1),
            "voice_volume": voice_volume,
            "silent": silent,
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build subliminal MP3 from affirmations + music")
    parser.add_argument("--affirmations", "-a", required=True, type=Path)
    parser.add_argument("--music", "-m", type=Path, help="Background MP3/WAV (optional with --silent)")
    parser.add_argument("--output", "-o", required=True, type=Path)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument(
        "--voice-volume",
        type=float,
        default=0.045,
        help="Affirmation loudness under music (0.03–0.08 typical)",
    )
    parser.add_argument("--duration", type=float, help="Force output length in seconds")
    parser.add_argument(
        "--silent",
        action="store_true",
        help="Silent base (Mind Zoom 'Generate Silent Base' style)",
    )
    args = parser.parse_args()

    result = asyncio.run(
        build(
            args.affirmations,
            args.music,
            args.output,
            args.voice,
            args.voice_volume,
            args.duration,
            args.silent,
        )
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
