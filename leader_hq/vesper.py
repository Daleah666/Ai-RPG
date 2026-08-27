"""Bridge between Nova (code_leader) and Leader Vesper / Grok Bot agents.

Local folders mirror Drive ids in config/drive_ids.json:
  from_vesper → Vesper writes requests for Nova
  to_vesper   → Nova writes replies / effects for Vesper to pick up

Grok Bot cannot load .cursor/hooks.json. The way Nova *affects* Grok bots is:
  1. Write structured JSON into to_vesper (and optional routine payloads)
  2. Vesper's scheduled Grok Bot routines poll to_vesper / CURSOR_DAILY
  3. Cursor Automations + project hooks keep Nova sessions aligned
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .bus import BusPaths, read_messages, write_json, write_message
from .identity import Identity, load_identity
from .schema import Message, MessageStatus, MessageType


VESPER_ID = "leader_vesper"
GROK_SURFACE = "grok_bot"


def unread(messages: list[Message]) -> list[Message]:
    return [m for m in messages if m.status == MessageStatus.UNREAD]


class VesperBridge:
    """Read/write the Vesper ↔ Nova lanes on a LeaderHQ bus root."""

    def __init__(self, paths: BusPaths, identity: Identity | None = None) -> None:
        self.paths = paths
        self.identity = identity or load_identity()
        self.paths.from_vesper.mkdir(parents=True, exist_ok=True)
        self.paths.to_vesper.mkdir(parents=True, exist_ok=True)
        self.paths.automations.mkdir(parents=True, exist_ok=True)

    def poll_from_vesper(self, *, only_unread: bool = True) -> list[Message]:
        messages = read_messages(self.paths.from_vesper)
        return unread(messages) if only_unread else messages

    def summarize_from_vesper(self) -> str:
        messages = self.poll_from_vesper(only_unread=True)
        if not messages:
            return f"{self.identity.display()}: no unread Vesper requests."
        lines = [f"{self.identity.display()} ← Vesper ({len(messages)} unread):"]
        for msg in messages:
            lines.append(
                f"- [{msg.priority}] {msg.type.value} {msg.id}: {msg.subject}"
            )
        return "\n".join(lines)

    def simulate_vesper_request(
        self,
        *,
        subject: str,
        instruction: str,
        priority: int = 2,
        extra: dict[str, Any] | None = None,
    ) -> tuple[Message, Path]:
        """Local stand-in for a Grok Bot Vesper write into from_vesper."""
        payload = {
            "instruction": instruction,
            "surface": GROK_SURFACE,
            "from_name": self.identity.reports_to_name,
            **(extra or {}),
        }
        message = Message.create(
            from_id=VESPER_ID,
            to=self.identity.ops_id,
            type=MessageType.TASK,
            subject=subject,
            payload=payload,
            priority=priority,
            reply_to="LeaderHQ/to_vesper",
        )
        path = write_message(self.paths.from_vesper, message)
        return message, path

    def notify_vesper(
        self,
        *,
        subject: str,
        body: dict[str, Any],
        msg_type: MessageType = MessageType.NOTIFICATION,
        priority: int = 3,
        related_request_id: str | None = None,
        effect: str | None = None,
    ) -> tuple[Message, Path]:
        """Write an effect/reply for Grok Bot Vesper to consume from to_vesper."""
        payload: dict[str, Any] = {
            "body": body,
            "surface": GROK_SURFACE,
            "target_bot": VESPER_ID,
            "nova": self.identity.persona_name,
        }
        if related_request_id:
            payload["related_request_id"] = related_request_id
        if effect:
            payload["effect"] = effect
        message = Message.create(
            from_id=self.identity.message_from,
            to=VESPER_ID,
            type=msg_type,
            subject=subject,
            payload=payload,
            priority=priority,
            reply_to="LeaderHQ/from_vesper",
        )
        path = write_message(self.paths.to_vesper, message)
        return message, path

    def ack_vesper_request(self, message: Message, *, note: str = "acked by Nova") -> Path:
        """Mark a from_vesper message acked and mirror status to to_vesper."""
        message.status = MessageStatus.ACKED
        # Rewrite source file if present; otherwise write a status mirror.
        for path in self.paths.from_vesper.glob(f"*_{message.id}.json"):
            write_json(path, message.to_dict())
            break
        ack, out_path = self.notify_vesper(
            subject=f"ACK: {message.subject}",
            body={"note": note, "acked_id": message.id},
            msg_type=MessageType.ACK,
            priority=message.priority,
            related_request_id=message.id,
            effect="ack_request",
        )
        return out_path

    def pending_effects_for_grok(self) -> list[Message]:
        return unread(read_messages(self.paths.to_vesper))

    def automation_state_path(self) -> Path:
        return self.paths.automations / "state.json"

    def load_automation_state(self) -> dict[str, Any]:
        path = self.automation_state_path()
        if not path.exists():
            return {"last_poll": None, "processed_ids": []}
        return json.loads(path.read_text(encoding="utf-8"))

    def save_automation_state(self, state: dict[str, Any]) -> Path:
        return write_json(self.automation_state_path(), state)

    def morning_digest(self) -> dict[str, Any]:
        """Snapshot used by Cursor Automations / hooks at ~8am PT."""
        requests = self.poll_from_vesper(only_unread=True)
        effects = self.pending_effects_for_grok()
        return {
            "leader": self.identity.ops_id,
            "persona": self.identity.persona_name,
            "reports_to": self.identity.reports_to,
            "unread_vesper_requests": [m.to_dict() for m in requests],
            "pending_to_vesper": [m.to_dict() for m in effects],
            "counts": {
                "from_vesper_unread": len(requests),
                "to_vesper_unread": len(effects),
            },
        }
