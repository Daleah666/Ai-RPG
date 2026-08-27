#!/usr/bin/env python3
"""Minimal stdin→stdout check that hooks scripts parse JSON correctly."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOKS = ROOT / ".cursor" / "hooks"


def run_hook(name: str, payload: dict) -> dict:
    proc = subprocess.run(
        [sys.executable, str(HOOKS / name)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        raise SystemExit(f"{name} failed: {proc.stderr}\n{proc.stdout}")
    return json.loads(proc.stdout or "{}")


def main() -> int:
    out = run_hook(
        "before_submit_prompt.py",
        {"model": "cursor-grok-4.6-high-fast", "conversation_id": "test"},
    )
    assert "additional_context" in out, out
    assert "Nova" in out["additional_context"]

    out = run_hook("guard_shell.py", {"command": "ls -la"})
    assert out.get("permission") == "allow"

    out = run_hook("guard_shell.py", {"command": "rm -rf /"})
    assert out.get("permission") == "deny"

    out = run_hook("stop_vesper_check.py", {"model": "cursor-grok-4.6-high-fast"})
    assert isinstance(out, dict)

    print("hooks smoke ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
