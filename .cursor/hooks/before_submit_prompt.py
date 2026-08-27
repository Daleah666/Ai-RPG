#!/usr/bin/env python3
"""beforeSubmitPrompt — inject Nova / Vesper context for Grok-aware sessions."""

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
    unread_vesper_count,
    write_stdout_json,
)


def main() -> int:
    payload = read_stdin_json()
    append_audit("beforeSubmitPrompt", payload)

    bus_bits = []
    unread = unread_vesper_count()
    pending = pending_to_vesper_count()
    if unread:
        bus_bits.append(f"{unread} unread Vesper request(s) in from_vesper — poll before new work.")
    if pending:
        bus_bits.append(f"{pending} pending to_vesper effect(s) waiting for Grok Bot Vesper.")

    extra = NOVA_CONTEXT
    if bus_bits:
        extra += "\nBus status:\n- " + "\n- ".join(bus_bits)

    # Always allow; enrich context especially for Grok model runs.
    out = {
        "continue": True,
        "additional_context": extra if (is_grok(payload) or unread or pending) else NOVA_CONTEXT,
    }
    write_stdout_json(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
