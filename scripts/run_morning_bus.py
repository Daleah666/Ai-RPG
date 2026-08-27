#!/usr/bin/env python3
"""Smoke-run morning digest + optional Vesper notify for automations / cron."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from leader_hq.leader import Leader


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Nova morning bus digest")
    parser.add_argument(
        "--bus-root",
        default=str(ROOT / ".local_bus" / "LeaderHQ"),
    )
    parser.add_argument(
        "--notify-if-unread",
        action="store_true",
        help="Write a to_vesper ack digest when from_vesper has unread items",
    )
    args = parser.parse_args()

    leader = Leader(Path(args.bus_root))
    digest = leader.morning_digest()
    print(json.dumps(digest, indent=2))

    if args.notify_if_unread and digest["counts"]["from_vesper_unread"]:
        message, path = leader.notify_vesper(
            subject="Morning digest: unread Vesper requests seen",
            body={
                "count": digest["counts"]["from_vesper_unread"],
                "subjects": [
                    m.get("subject") for m in digest["unread_vesper_requests"]
                ],
            },
            effect="status_update",
            priority=2,
        )
        print(json.dumps({"notified": message.id, "path": str(path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
