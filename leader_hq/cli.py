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


def cmd_poll_vesper(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    print(leader.vesper.summarize_from_vesper())
    if args.json:
        print(json.dumps([m.to_dict() for m in leader.poll_vesper()], indent=2))
    return 0


def cmd_notify_vesper(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    body = json.loads(args.body) if args.body else {"text": args.text or ""}
    if args.all_shared:
        results = leader.notify_shared_grok(
            subject=args.subject,
            body=body,
            effect=args.effect,
            priority=args.priority,
        )
        print(json.dumps({"fan_out": results, "effect": args.effect}, indent=2))
        return 0
    message, path = leader.notify_vesper(
        subject=args.subject,
        body=body,
        effect=args.effect,
        related_request_id=args.related,
        priority=args.priority,
    )
    print(json.dumps({
        "message_id": message.id,
        "to_vesper": str(path),
        "effect": args.effect,
        "target": "leader_vesper",
    }, indent=2))
    return 0


def cmd_notify_grok(args: argparse.Namespace) -> int:
    """Notify one Grok partner (vesper|grok_memory|1|2) or --all shared bots."""
    leader = Leader(Path(args.bus_root))
    body = json.loads(args.body) if args.body else {"text": args.text or ""}
    if args.all:
        results = leader.notify_shared_grok(
            subject=args.subject,
            body=body,
            effect=args.effect,
            priority=args.priority,
        )
        print(json.dumps({"fan_out": results, "effect": args.effect}, indent=2))
        return 0
    message, path = leader.vesper.notify(
        args.to,
        subject=args.subject,
        body=body,
        effect=args.effect,
        related_request_id=args.related,
        priority=args.priority,
    )
    partner = leader.vesper.resolve(args.to)
    print(json.dumps({
        "message_id": message.id,
        "path": str(path),
        "effect": args.effect,
        "target": partner.id,
        "name": partner.name,
        "number": partner.number,
        "to_lane": partner.to_lane,
    }, indent=2))
    return 0


def cmd_poll_grok(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    targets = (
        [p.id for p in leader.vesper.partners]
        if args.all
        else [args.from_bot]
    )
    for bot_id in targets:
        print(leader.vesper.summarize_from(bot_id))
        if args.json:
            print(json.dumps(
                [m.to_dict() for m in leader.vesper.poll_from(bot_id)],
                indent=2,
            ))
    return 0


def cmd_simulate_vesper(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    message, path = leader.vesper.simulate_vesper_request(
        subject=args.subject,
        instruction=args.instruction,
        priority=args.priority,
    )
    print(json.dumps({
        "message_id": message.id,
        "from_vesper": str(path),
    }, indent=2))
    return 0


def cmd_morning_digest(args: argparse.Namespace) -> int:
    leader = Leader(Path(args.bus_root))
    digest = leader.morning_digest()
    print(json.dumps(digest, indent=2))
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

    p = sub.add_parser("poll-vesper", help="Summarize unread Leader Vesper (Grok Bot) requests")
    p.add_argument("--json", action="store_true", help="Also print full message JSON")
    p.set_defaults(func=cmd_poll_vesper)

    p = sub.add_parser("notify-vesper", help="Write an effect/reply into to_vesper for Grok Bot #1")
    p.add_argument("--subject", required=True)
    p.add_argument("--body", default="", help="JSON body object")
    p.add_argument("--text", default="", help="Plain text if --body omitted")
    p.add_argument("--effect", default=None, help="Effect tag for Grok Bot routines")
    p.add_argument("--related", default=None, help="Related from_vesper message id")
    p.add_argument("--priority", type=int, default=3)
    p.add_argument(
        "--all-shared",
        action="store_true",
        help="Also fan-out to Grok Long Memory (Grok Bot #2 on shared Drive)",
    )
    p.set_defaults(func=cmd_notify_vesper)

    p = sub.add_parser(
        "notify-grok",
        help="Notify a shared Grok Bot (vesper|grok_memory|1|2) or --all",
    )
    p.add_argument(
        "--to",
        default="grok_memory",
        help="Partner id/alias (vesper, grok_memory, 1, 2). Default: grok_memory",
    )
    p.add_argument("--subject", required=True)
    p.add_argument("--body", default="")
    p.add_argument("--text", default="")
    p.add_argument("--effect", default=None)
    p.add_argument("--related", default=None)
    p.add_argument("--priority", type=int, default=3)
    p.add_argument("--all", action="store_true", help="Fan-out to every shared Grok Bot")
    p.set_defaults(func=cmd_notify_grok)

    p = sub.add_parser("poll-grok", help="Poll unread requests from shared Grok Bots")
    p.add_argument(
        "--from-bot",
        default="grok_memory",
        help="Partner id/alias to poll (default grok_memory)",
    )
    p.add_argument("--all", action="store_true", help="Poll Vesper and Grok Long Memory")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_poll_grok)

    p = sub.add_parser(
        "simulate-vesper",
        help="Local stand-in: drop a Vesper request into from_vesper",
    )
    p.add_argument("--subject", required=True)
    p.add_argument("--instruction", required=True)
    p.add_argument("--priority", type=int, default=2)
    p.set_defaults(func=cmd_simulate_vesper)

    p = sub.add_parser("morning-digest", help="JSON digest for 8am PT automation")
    p.set_defaults(func=cmd_morning_digest)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
