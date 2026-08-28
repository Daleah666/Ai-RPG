#!/usr/bin/env python3
"""postToolUse — after Drive/bus-related tools, remind to sync Vesper effects."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import append_audit, read_stdin_json, write_stdout_json  # noqa: E402

DRIVE_HINTS = ("google-drive", "drive", "from_vesper", "to_vesper", "leaderhq", "cursor_daily")


def main() -> int:
    payload = read_stdin_json()
    tool = str(payload.get("tool_name") or payload.get("tool") or "").lower()
    blob = str(payload.get("tool_input") or payload.get("arguments") or "").lower()
    append_audit("postToolUse", payload, {"tool": tool})

    out: dict = {}
    if any(h in tool or h in blob for h in DRIVE_HINTS):
        out["additional_context"] = (
            "Drive/bus tool used. If this changes Vesper-facing state, write a "
            "`to_vesper` notification (`python3 -m leader_hq.cli notify-vesper`) "
            "so Grok Bot Leader Vesper routines can react."
        )
    write_stdout_json(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
