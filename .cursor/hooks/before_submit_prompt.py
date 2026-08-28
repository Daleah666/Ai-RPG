#!/usr/bin/env python3
"""beforeSubmitPrompt — inject Nova + both shared Grok Bot partners."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (  # noqa: E402
    NOVA_CONTEXT,
    append_audit,
    is_grok,
    pending_to_vesper_count,
    read_stdin_json,
    unread_all_shared_count,
    unread_vesper_count,
    write_stdout_json,
)


def main() -> int:
    payload = read_stdin_json()
    append_audit("beforeSubmitPrompt", payload)

    bus_bits = []
    unread = unread_vesper_count()
    pending = pending_to_vesper_count()
    all_from, all_to = unread_all_shared_count()
    if unread:
        bus_bits.append(f"{unread} unread Vesper (#1) request(s) in from_vesper.")
    if all_from > unread:
        bus_bits.append(
            f"{all_from - unread} unread Grok Long Memory (#2) request(s) in from_grok_memory."
        )
    if pending or all_to:
        bus_bits.append(
            f"{all_to} pending effect(s) waiting on shared Grok Bots "
            "(to_vesper / to_grok_memory)."
        )

    extra = NOVA_CONTEXT
    if bus_bits:
        extra += "\nBus status:\n- " + "\n- ".join(bus_bits)

    out = {
        "continue": True,
        "additional_context": extra if (is_grok(payload) or all_from or all_to) else NOVA_CONTEXT,
    }
    write_stdout_json(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
