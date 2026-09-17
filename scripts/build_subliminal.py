#!/usr/bin/env python3
"""CLI for multi-layer subliminal generation."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from subliminal_engine import (  # noqa: E402
    FREQUENCY_PROFILES,
    GenerateRequest,
    LayerConfig,
    generate,
    parse_lines,
    request_from_dict,
)

DEFAULT_FREQ = ["normal", "mid_shift", "ultrasonic_band"]
DEFAULT_VOL = [0.06, 0.04, 0.03]


async def main_async(args: argparse.Namespace) -> dict:
    if args.config:
        data = json.loads(Path(args.config).read_text(encoding="utf-8"))
        return await generate(request_from_dict(data, Path(args.output)))

    layers: list[LayerConfig] = []
    for i in range(1, 4):
        aff_path = getattr(args, f"layer{i}_file", None)
        if aff_path:
            lines = parse_lines(Path(aff_path).read_text(encoding="utf-8"))
        elif i == 1 and args.affirmations:
            lines = parse_lines(Path(args.affirmations).read_text(encoding="utf-8"))
        else:
            lines = []
        enabled = bool(lines) and (i == 1 or aff_path is not None)
        if i == 1 and lines:
            enabled = True
        layers.append(LayerConfig(
            enabled=enabled,
            affirmations=lines,
            volume=getattr(args, f"layer{i}_volume"),
            frequency=getattr(args, f"layer{i}_frequency"),
        ))

    if args.affirmations and len(layers) == 3 and layers[0].enabled:
        base = layers[0].affirmations
        if not layers[1].enabled:
            layers[1] = LayerConfig(True, base, DEFAULT_VOL[1], DEFAULT_FREQ[1])
        if not layers[2].enabled:
            layers[2] = LayerConfig(True, base, DEFAULT_VOL[2], DEFAULT_FREQ[2])

    req = GenerateRequest(
        layers=layers,
        silent=args.silent,
        duration_seconds=args.duration,
        music_path=Path(args.music) if args.music else None,
        output_path=Path(args.output),
    )
    return await generate(req)


def main() -> None:
    parser = argparse.ArgumentParser(description="3-layer subliminal MP3 generator")
    parser.add_argument("--config", "-c", type=Path, help="JSON job spec")
    parser.add_argument("--output", "-o", required=True, type=Path)
    parser.add_argument("--affirmations", "-a", type=Path, help="Affirmations (fills 3 layers if alone)")
    parser.add_argument("--music", "-m", type=Path)
    parser.add_argument("--silent", action="store_true")
    parser.add_argument("--duration", type=float)
    for i in range(1, 4):
        parser.add_argument(f"--layer{i}-file", type=Path)
        parser.add_argument(f"--layer{i}-volume", type=float, default=DEFAULT_VOL[i - 1])
        parser.add_argument(
            f"--layer{i}-frequency", default=DEFAULT_FREQ[i - 1],
            choices=list(FREQUENCY_PROFILES.keys()),
        )
    args = parser.parse_args()
    print(json.dumps(asyncio.run(main_async(args)), indent=2))


if __name__ == "__main__":
    main()
