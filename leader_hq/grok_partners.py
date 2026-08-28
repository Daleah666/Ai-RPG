"""Shared Grok Bot partners on Nova Ai Data Drive.

Bot 1 — Leader Vesper (`leader_vesper`): Grok Bot app leader; lanes from_vesper / to_vesper
Bot 2 — Grok Long Memory (`grok_memory`): the Grok that owns/shares Nova Ai Data
         (2114dolly / Dastardly long-memory computer); lanes from_grok_memory / to_grok_memory
         plus mirror folder `Nova Ai Data/Grok Long Memory/from_nova/`
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "config" / "grok_bots.registry.json"
DEFAULT_DRIVE_IDS = ROOT / "config" / "drive_ids.json"


@dataclass(frozen=True)
class GrokPartner:
    id: str
    name: str
    number: int
    surface: str
    from_lane: str
    to_lane: str
    drive_from_id: str | None = None
    drive_to_id: str | None = None
    mirror_from_nova_id: str | None = None
    owner_hint: str | None = None
    routines: tuple[str, ...] = ()


# Stable ids used across CLI / hooks / Drive.
VESPER_ID = "leader_vesper"
GROK_MEMORY_ID = "grok_memory"
GROK_SURFACE = "grok_bot"


def load_drive_ids(path: Path | None = None) -> dict[str, Any]:
    import json

    target = path or DEFAULT_DRIVE_IDS
    if not target.exists():
        return {}
    return json.loads(target.read_text(encoding="utf-8"))


def default_partners(drive_ids: dict[str, Any] | None = None) -> list[GrokPartner]:
    ids = drive_ids if drive_ids is not None else load_drive_ids()
    return [
        GrokPartner(
            id=VESPER_ID,
            name="Leader Vesper",
            number=1,
            surface=GROK_SURFACE,
            from_lane="from_vesper",
            to_lane="to_vesper",
            drive_from_id=ids.get("from_vesper"),
            drive_to_id=ids.get("to_vesper"),
            owner_hint="Grok Bot app — life / calendar / non-coding command",
            routines=(
                "vesper-daily-request",
                "vesper-poll-to-vesper",
                "vesper-ping-nova",
            ),
        ),
        GrokPartner(
            id=GROK_MEMORY_ID,
            name="Grok Long Memory",
            number=2,
            surface=GROK_SURFACE,
            from_lane="from_grok_memory",
            to_lane="to_grok_memory",
            drive_from_id=ids.get("from_grok_memory"),
            drive_to_id=ids.get("to_grok_memory"),
            mirror_from_nova_id=ids.get("grok_long_memory_from_nova"),
            owner_hint="2114dolly / Dastardly — shares Nova Ai Data; long-memory computer",
            routines=(
                "grok-memory-poll-from-nova",
                "grok-memory-ping-nova",
            ),
        ),
    ]


def partner_by_id(bot_id: str, drive_ids: dict[str, Any] | None = None) -> GrokPartner:
    for partner in default_partners(drive_ids):
        if partner.id == bot_id or str(partner.number) == bot_id:
            return partner
    # Aliases
    aliases = {
        "vesper": VESPER_ID,
        "1": VESPER_ID,
        "bot1": VESPER_ID,
        "memory": GROK_MEMORY_ID,
        "long_memory": GROK_MEMORY_ID,
        "grok2": GROK_MEMORY_ID,
        "bot2": GROK_MEMORY_ID,
        "2": GROK_MEMORY_ID,
        "dastardly": GROK_MEMORY_ID,
    }
    resolved = aliases.get(bot_id.lower())
    if resolved:
        return partner_by_id(resolved, drive_ids)
    raise KeyError(f"Unknown Grok partner: {bot_id}")


def all_partner_ids() -> list[str]:
    return [p.id for p in default_partners()]
