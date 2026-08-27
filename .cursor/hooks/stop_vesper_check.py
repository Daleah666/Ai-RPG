#!/usr/bin/env python3
"""stop — if any shared Grok Bot left unread requests, auto-continue once."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (  # noqa: E402
    append_audit,
    pending_to_vesper_count,
    read_stdin_json,
    unread_all_shared_count,
    unread_vesper_count,
    write_stdout_json,
)


def main() -> int:
    payload = read_stdin_json()
    unread = unread_vesper_count()
    pending = pending_to_vesper_count()
    all_from, all_to = unread_all_shared_count()
    append_audit(
        "stop",
        payload,
        {
            "unread_vesper": unread,
            "pending_to_vesper": pending,
            "all_from_unread": all_from,
            "all_to_unread": all_to,
        },
    )

    out: dict = {}
    if all_from > 0:
        out["followup_message"] = (
            "Nova bus check: shared Grok Bot(s) have unread request(s) "
            f"(total {all_from}; Vesper + Grok Long Memory). "
            "Run `python3 -m leader_hq.cli poll-grok --all --json`, "
            "ack/handle each, then fan-out with "
            "`python3 -m leader_hq.cli notify-grok --all --effect status_update "
            "--subject '...' --text '...'` so both Drive partners see the reply."
        )
    write_stdout_json(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
