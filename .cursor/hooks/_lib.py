#!/usr/bin/env python3
"""Shared helpers for Nova / Grok Cursor agent hooks."""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DEFAULT_BUS = ROOT / ".local_bus" / "LeaderHQ"
AUDIT_DIR = DEFAULT_BUS / "automations" / "hooks_audit"

GROK_MODEL_RE = re.compile(r"grok", re.IGNORECASE)

NOVA_CONTEXT = """You are working in the Ai-RPG / LeaderHQ workspace as **Nova** (`code_leader`) when coding orchestration is in play.

Chain: Human → shared Grok Bots on Nova Ai Data Drive → Nova → specialist bots.
- **Grok Bot #1 — Leader Vesper:** requests via `from_vesper` / CURSOR_DAILY / main bus Doc; affect via `to_vesper`.
- **Grok Bot #2 — Grok Long Memory** (2114dolly / Dastardly, shares Drive): requests via `from_grok_memory`; affect via `to_grok_memory` + `Grok Long Memory/from_nova/`.
- Fan-out to both: `python3 -m leader_hq.cli notify-grok --all --subject '...' --effect status_update --text '...'`.
- Prefer bus + registered bots over opening extra human chats.
- Domains: adult AI programming (18+ only), social systems, feminization programming, bot orchestration.
- Poll both: `python3 -m leader_hq.cli poll-grok --all` and `morning-digest`.
"""


def read_stdin_json() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}


def write_stdout_json(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def project_dir(payload: dict[str, Any]) -> Path:
    env = os.environ.get("CURSOR_PROJECT_DIR")
    if env:
        return Path(env)
    roots = payload.get("workspace_roots") or []
    if roots:
        return Path(roots[0])
    return ROOT


def model_name(payload: dict[str, Any]) -> str:
    return str(payload.get("model") or payload.get("model_id") or "")


def is_grok(payload: dict[str, Any]) -> bool:
    return bool(GROK_MODEL_RE.search(model_name(payload)))


def ensure_audit_dir() -> Path:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    return AUDIT_DIR


def append_audit(event: str, payload: dict[str, Any], extra: dict[str, Any] | None = None) -> None:
    ensure_audit_dir()
    row = {
        "ts": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "event": event,
        "model": model_name(payload),
        "is_grok": is_grok(payload),
        "conversation_id": payload.get("conversation_id"),
        "generation_id": payload.get("generation_id"),
        **(extra or {}),
    }
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    path = AUDIT_DIR / f"{day}.jsonl"
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row) + "\n")


def unread_vesper_count(bus_root: Path | None = None) -> int:
    try:
        from leader_hq.leader import Leader

        leader = Leader(bus_root or DEFAULT_BUS)
        return len(leader.poll_vesper())
    except Exception:
        return 0


def pending_to_vesper_count(bus_root: Path | None = None) -> int:
    try:
        from leader_hq.leader import Leader

        leader = Leader(bus_root or DEFAULT_BUS)
        return len(leader.vesper.pending_effects_for_grok())
    except Exception:
        return 0


def unread_all_shared_count(bus_root: Path | None = None) -> tuple[int, int]:
    """Return (from_unread, to_unread) across Vesper + Grok Long Memory."""
    try:
        from leader_hq.leader import Leader

        leader = Leader(bus_root or DEFAULT_BUS)
        digest = leader.morning_digest()
        return (
            int(digest["counts"].get("all_from_unread", 0)),
            int(digest["counts"].get("all_to_unread", 0)),
        )
    except Exception:
        return (0, 0)
