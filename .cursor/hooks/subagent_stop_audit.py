#!/usr/bin/env python3
"""subagentStop — keep specialist bot work reported back toward Vesper when relevant."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import append_audit, read_stdin_json, write_stdout_json  # noqa: E402


def main() -> int:
    payload = read_stdin_json()
    append_audit("subagentStop", payload, {
        "subagent_type": payload.get("subagent_type") or payload.get("agent_type"),
        "status": payload.get("status"),
    })
    # Soft nudge only — do not force loops on every subagent.
    write_stdout_json({})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
