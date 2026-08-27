#!/usr/bin/env python3
"""CLI for Nova / code_leader local bus operations."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from leader_hq.identity import load_identity
from leader_hq.leader import Leader
from leader_hq.registry import list_bots


def default_bus_root() -> Path:
    return ROOT / ".local_bus" / "LeaderHQ"


def cmd_whoami(_: argparse.Namespace) -> int:
    identity = load_identity()
    print(json.dumps({
        "persona_name": identity.persona_name,
        "ops_id": identity.ops_id,
        "aliases": list(identity.aliases),
        "display": identity.display(),
        "domains": list(identity.domains),
    }, indent=2))
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    leader.write_readme()
    print(f"Initialized local bus at {leader.paths.root}")
    print(leader.identity.display())
    for bot in list_bots():
        print(f"  - {bot.id}: {bot.role}")
    return 0


def cmd_assign(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    message, bot_path, task_path = leader.assign_task(
        to=args.to,
        subject=args.subject,
        instruction=args.instruction,
        priority=args.priority,
    )
    print(json.dumps({
        "message_id": message.id,
        "bot_inbox": str(bot_path),
        "task_file": str(task_path),
    }, indent=2))
    return 0


def cmd_inbox(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    print(leader.summarize_inbox())
    return 0


def cmd_simulate_result(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    result = json.loads(args.result) if args.result else {"ok": True, "note": "simulated"}
    message, out_path, inbox_path = leader.post_bot_result(
        bot_id=args.from_bot,
        subject=args.subject,
        result=result,
        related_task_id=args.task_id,
    )
    print(json.dumps({
        "message_id": message.id,
        "bot_outbox": str(out_path),
        "leader_inbox": str(inbox_path),
    }, indent=2))
    return 0


def cmd_manifest(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    leader.write_readme()
    print(json.dumps(leader.export_bootstrap_manifest(), indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="code-leader", description="Nova / code_leader bus CLI")
    parser.add_argument(
        "--bus-root",
        default=str(default_bus_root()),
        help="Local LeaderHQ root (mirrors Drive layout)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("whoami", help="Show Nova / code_leader identity")
    p.set_defaults(func=cmd_whoami)

    p = sub.add_parser("init", help="Create local LeaderHQ tree + registry")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("assign", help="Assign a task to a bot")
    p.add_argument("--to", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--instruction", required=True)
    p.add_argument("--priority", type=int, default=3)
    p.set_defaults(func=cmd_assign)

    p = sub.add_parser("inbox", help="Summarize leader inbox")
    p.set_defaults(func=cmd_inbox)

    p = sub.add_parser("simulate-result", help="Post a bot result into leader inbox")
    p.add_argument("--from-bot", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--result", default="")
    p.add_argument("--task-id", default=None)
    p.set_defaults(func=cmd_simulate_result)

    p = sub.add_parser("manifest", help="Print Drive bootstrap manifest JSON")
    p.set_defaults(func=cmd_manifest)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
