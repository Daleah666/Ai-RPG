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


def cmd_finalize_character(args: argparse.Namespace) -> int:
    from automations.character_sheet.finalize import finalize_from_file

    out = Path(args.out)
    result = finalize_from_file(Path(args.src), out, force=args.force)
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 2


def cmd_categorize_lore(args: argparse.Namespace) -> int:
    from automations.lore_categorize.categorize import categorize, categorize_file

    if args.src:
        result = categorize_file(Path(args.src))
    else:
        result = categorize(args.text or "", title=args.title or "")
    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.get("ok", True) else 2


def cmd_knobs(_: argparse.Namespace) -> int:
    from leader_hq.knobs import summary

    print(json.dumps(summary(), indent=2))
    return 0


def cmd_knobs_set(args: argparse.Namespace) -> int:
    from leader_hq.knobs import set_knob, summary

    for item in args.pairs:
        if "=" not in item:
            print(f"Need key=value, got: {item}", file=sys.stderr)
            return 2
        key, value = item.split("=", 1)
        try:
            set_knob(key.strip(), value.strip())
        except (KeyError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 2
    print(json.dumps(summary(), indent=2))
    return 0


def cmd_knobs_preset(args: argparse.Namespace) -> int:
    from leader_hq.knobs import apply_preset, summary

    try:
        apply_preset(args.name)
    except (KeyError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps(summary(), indent=2))
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

    p = sub.add_parser(
        "finalize-character",
        help="Build a Starla-depth Heroic Chronicles sheet from character JSON",
    )
    p.add_argument("--src", required=True, help="Path to character JSON")
    p.add_argument(
        "--out",
        default=str(ROOT / ".local_bus" / "character_cards"),
        help="Output directory for .md + .json package",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="Finalize even if some required fields are missing",
    )
    p.set_defaults(func=cmd_finalize_character)

    p = sub.add_parser(
        "categorize-lore",
        help="Suggest lore category / relative path (Vesper confirms shelves)",
    )
    p.add_argument("--src", default="", help="Path to lore markdown/text file")
    p.add_argument("--text", default="", help="Inline lore text to score")
    p.add_argument("--title", default="", help="Optional title hint")
    p.set_defaults(func=cmd_categorize_lore)

    p = sub.add_parser("knobs", help="Show live persona/bias knobs")
    p.set_defaults(func=cmd_knobs)

    p = sub.add_parser("knobs-set", help="Set knobs key=value (repeatable)")
    p.add_argument(
        "pairs",
        nargs="+",
        help="e.g. strength=4 pleasure_hit=true bias_tilt=on",
    )
    p.set_defaults(func=cmd_knobs_set)

    p = sub.add_parser("knobs-preset", help="Apply a named preset (off|closet|louder)")
    p.add_argument("name", help="Preset name from config/persona_knobs.json")
    p.set_defaults(func=cmd_knobs_preset)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
