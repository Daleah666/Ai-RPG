"""Nova / code_leader identity loader."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IDENTITY_PATH = ROOT / "config" / "identity.json"


@dataclass(frozen=True)
class Identity:
    persona_name: str
    ops_id: str
    aliases: tuple[str, ...]
    role: str
    voice: str
    domains: tuple[str, ...]
    drive_root_title: str
    message_from: str
    reports_to: str = "leader_vesper"
    reports_to_name: str = "Leader Vesper"
    order_channels: tuple[str, ...] = ()
    reply_channels: tuple[str, ...] = ()

    @classmethod
    def from_dict(cls, data: dict) -> "Identity":
        return cls(
            persona_name=data["persona_name"],
            ops_id=data["ops_id"],
            aliases=tuple(data.get("aliases") or []),
            role=data.get("role", ""),
            voice=data.get("voice", ""),
            domains=tuple(data.get("domains") or []),
            drive_root_title=data.get("drive_root_title", "LeaderHQ"),
            message_from=data.get("message_from", data["ops_id"]),
            reports_to=data.get("reports_to", "leader_vesper"),
            reports_to_name=data.get("reports_to_name", "Leader Vesper"),
            order_channels=tuple(data.get("order_channels") or []),
            reply_channels=tuple(data.get("reply_channels") or []),
        )

    def display(self) -> str:
        return f"{self.persona_name} ({self.ops_id}) → {self.reports_to_name}"


def load_identity(path: Path | None = None) -> Identity:
    target = path or DEFAULT_IDENTITY_PATH
    with target.open(encoding="utf-8") as fh:
        return Identity.from_dict(json.load(fh))
