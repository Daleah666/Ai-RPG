#!/usr/bin/env python3
"""beforeShellExecution — soft-guard destructive commands in Nova/Grok sessions."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import append_audit, read_stdin_json, write_stdout_json  # noqa: E402

DENY = re.compile(
    r"("
    r"\brm\s+-rf\s+/(?!\w)"
    r"|\bmkfs\b"
    r"|\bdd\s+if="
    r"|:\(\)\s*\{\s*:\|:\s*&\s*\};:"
    r"|\bcurl\b.+\|\s*(ba)?sh\b"
    r")",
    re.IGNORECASE,
)

ASK = re.compile(
    r"("
    r"\bgit\s+push\s+.*--force"
    r"|\bgit\s+reset\s+--hard"
    r"|\bgh\s+.*\bdelete\b"
    r")",
    re.IGNORECASE,
)


def main() -> int:
    payload = read_stdin_json()
    command = str(payload.get("command") or payload.get("tool_input", {}).get("command") or "")
    append_audit("beforeShellExecution", payload, {"command": command[:500]})

    if DENY.search(command):
        write_stdout_json(
            {
                "permission": "deny",
                "user_message": "Blocked by Nova hooks: destructive shell pattern.",
                "agent_message": "That shell command looks destructive. Use a safer alternative.",
            }
        )
        return 0

    if ASK.search(command):
        write_stdout_json(
            {
                "permission": "ask",
                "user_message": "Nova hooks want confirmation before this shell command.",
            }
        )
        return 0

    write_stdout_json({"permission": "allow"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
