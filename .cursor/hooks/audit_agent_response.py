#!/usr/bin/env python3
"""afterAgentResponse / afterAgentThought — audit Grok-powered agent turns."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import append_audit, is_grok, read_stdin_json, write_stdout_json  # noqa: E402


def main() -> int:
    payload = read_stdin_json()
    append_audit(
        "afterAgentResponse",
        payload,
        {
            "response_chars": len(str(payload.get("text") or payload.get("response") or "")),
            "grok_session": is_grok(payload),
        },
    )
    write_stdout_json({})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
