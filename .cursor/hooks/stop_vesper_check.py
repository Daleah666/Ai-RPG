#!/usr/bin/env python3
"""stop — if Vesper left unread requests, auto-continue once to process them."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (  # noqa: E402
    append_audit,
    pending_to_vesper_count,
    read_stdin_json,
    unread_vesper_count,
    write_stdout_json,
)


def main() -> int:
    payload = read_stdin_json()
    unread = unread_vesper_count()
    pending = pending_to_vesper_count()
    append_audit("stop", payload, {"unread_vesper": unread, "pending_to_vesper": pending})

    out: dict = {}
    # Only nudge when Vesper (Grok Bot) has work waiting for Nova.
    if unread > 0:
        out["followup_message"] = (
            "Nova bus check: Leader Vesper (Grok Bot) has unread request(s) in "
            "`from_vesper`. Run `python3 -m leader_hq.cli poll-vesper --json`, "
            "ack/handle each request, assign specialist bots if needed, then "
            "`python3 -m leader_hq.cli notify-vesper` with effect=status_update "
            "so Vesper's routine can pick up the reply."
        )
    write_stdout_json(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
