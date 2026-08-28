"""Bridge between Nova (code_leader) and Grok Bot partners on shared Drive.

Grok Bot cannot load .cursor/hooks.json. Nova *affects* Grok bots by writing
structured JSON into their `to_*` lanes (and mirrors under Grok Long Memory).

Partners (see leader_hq.grok_partners):
  #1 leader_vesper  — from_vesper / to_vesper
  #2 grok_memory    — from_grok_memory / to_grok_memory
                      (+ Drive mirror Nova Ai Data/Grok Long Memory/from_nova)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .bus import BusPaths, read_messages, write_json, write_message
from .grok_partners import (
    GROK_MEMORY_ID,
    GROK_SURFACE,
    VESPER_ID,
    GrokPartner,
    all_partner_ids,
    default_partners,
    partner_by_id,
)
from .identity import Identity, load_identity
from .schema import Message, MessageStatus, MessageType


def unread(messages: list[Message]) -> list[Message]:
    return [m for m in messages if m.status == MessageStatus.UNREAD]


class VesperBridge:
    """Read/write lanes for all registered Grok partners (Vesper + Grok Long Memory)."""

    def __init__(self, paths: BusPaths, identity: Identity | None = None) -> None:
        self.paths = paths
        self.identity = identity or load_identity()
        self.partners = default_partners()
        for partner in self.partners:
            self.paths.from_lane(partner.from_lane).mkdir(parents=True, exist_ok=True)
            self.paths.to_lane(partner.to_lane).mkdir(parents=True, exist_ok=True)
        self.paths.automations.mkdir(parents=True, exist_ok=True)

    def _from_dir(self, partner: GrokPartner) -> Path:
        return self.paths.from_lane(partner.from_lane)

    def _to_dir(self, partner: GrokPartner) -> Path:
        return self.paths.to_lane(partner.to_lane)

    def resolve(self, bot_id: str) -> GrokPartner:
        return partner_by_id(bot_id)

    # --- Vesper-specific wrappers (back-compat) ---

    def poll_from_vesper(self, *, only_unread: bool = True) -> list[Message]:
        return self.poll_from(VESPER_ID, only_unread=only_unread)

    def summarize_from_vesper(self) -> str:
        return self.summarize_from(VESPER_ID)

    def simulate_vesper_request(
        self,
        *,
        subject: str,
        instruction: str,
        priority: int = 2,
        extra: dict[str, Any] | None = None,
    ) -> tuple[Message, Path]:
        return self.simulate_request(
            VESPER_ID,
            subject=subject,
            instruction=instruction,
            priority=priority,
            extra=extra,
        )

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
        return self.notify(
            VESPER_ID,
            subject=subject,
            body=body,
            msg_type=msg_type,
            priority=priority,
            related_request_id=related_request_id,
            effect=effect,
        )

    def ack_vesper_request(self, message: Message, *, note: str = "acked by Nova") -> Path:
        return self.ack_request(VESPER_ID, message, note=note)

    def pending_effects_for_grok(self) -> list[Message]:
        return self.pending_effects(VESPER_ID)

    # --- Generic multi-bot API ---

    def poll_from(self, bot_id: str, *, only_unread: bool = True) -> list[Message]:
        partner = self.resolve(bot_id)
        messages = read_messages(self._from_dir(partner))
        return unread(messages) if only_unread else messages

    def summarize_from(self, bot_id: str) -> str:
        partner = self.resolve(bot_id)
        messages = self.poll_from(bot_id, only_unread=True)
        if not messages:
            return f"{self.identity.display()}: no unread {partner.name} requests."
        lines = [
            f"{self.identity.display()} ← {partner.name} "
            f"(Grok #{partner.number}, {len(messages)} unread):"
        ]
        for msg in messages:
            lines.append(f"- [{msg.priority}] {msg.type.value} {msg.id}: {msg.subject}")
        return "\n".join(lines)

    def simulate_request(
        self,
        bot_id: str,
        *,
        subject: str,
        instruction: str,
        priority: int = 2,
        extra: dict[str, Any] | None = None,
    ) -> tuple[Message, Path]:
        partner = self.resolve(bot_id)
        payload = {
            "instruction": instruction,
            "surface": GROK_SURFACE,
            "from_name": partner.name,
            "grok_bot_number": partner.number,
            **(extra or {}),
        }
        message = Message.create(
            from_id=partner.id,
            to=self.identity.ops_id,
            type=MessageType.TASK,
            subject=subject,
            payload=payload,
            priority=priority,
            reply_to=f"LeaderHQ/{partner.to_lane}",
        )
        path = write_message(self._from_dir(partner), message)
        return message, path

    def notify(
        self,
        bot_id: str,
        *,
        subject: str,
        body: dict[str, Any],
        msg_type: MessageType = MessageType.NOTIFICATION,
        priority: int = 3,
        related_request_id: str | None = None,
        effect: str | None = None,
    ) -> tuple[Message, Path]:
        partner = self.resolve(bot_id)
        payload: dict[str, Any] = {
            "body": body,
            "surface": GROK_SURFACE,
            "target_bot": partner.id,
            "grok_bot_number": partner.number,
            "nova": self.identity.persona_name,
        }
        if related_request_id:
            payload["related_request_id"] = related_request_id
        if effect:
            payload["effect"] = effect
        message = Message.create(
            from_id=self.identity.message_from,
            to=partner.id,
            type=msg_type,
            subject=subject,
            payload=payload,
            priority=priority,
            reply_to=f"LeaderHQ/{partner.from_lane}",
        )
        path = write_message(self._to_dir(partner), message)
        return message, path

    def notify_all_shared(
        self,
        *,
        subject: str,
        body: dict[str, Any],
        effect: str | None = None,
        priority: int = 3,
        bot_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Fan-out one effect to every shared Grok Bot (Vesper + Grok Long Memory)."""
        targets = bot_ids or all_partner_ids()
        results: list[dict[str, Any]] = []
        for bot_id in targets:
            message, path = self.notify(
                bot_id,
                subject=subject,
                body=body,
                effect=effect,
                priority=priority,
            )
            partner = self.resolve(bot_id)
            results.append(
                {
                    "bot_id": partner.id,
                    "name": partner.name,
                    "number": partner.number,
                    "message_id": message.id,
                    "path": str(path),
                    "to_lane": partner.to_lane,
                }
            )
        return results

    def ack_request(
        self,
        bot_id: str,
        message: Message,
        *,
        note: str = "acked by Nova",
    ) -> Path:
        partner = self.resolve(bot_id)
        message.status = MessageStatus.ACKED
        for path in self._from_dir(partner).glob(f"*_{message.id}.json"):
            write_json(path, message.to_dict())
            break
        _, out_path = self.notify(
            bot_id,
            subject=f"ACK: {message.subject}",
            body={"note": note, "acked_id": message.id},
            msg_type=MessageType.ACK,
            priority=message.priority,
            related_request_id=message.id,
            effect="ack_request",
        )
        return out_path

    def pending_effects(self, bot_id: str) -> list[Message]:
        partner = self.resolve(bot_id)
        return unread(read_messages(self._to_dir(partner)))

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
        """Snapshot used by Cursor Automations / hooks (~8am PT)."""
        by_bot: dict[str, Any] = {}
        total_unread = 0
        total_pending = 0
        for partner in self.partners:
            requests = self.poll_from(partner.id, only_unread=True)
            effects = self.pending_effects(partner.id)
            total_unread += len(requests)
            total_pending += len(effects)
            by_bot[partner.id] = {
                "name": partner.name,
                "number": partner.number,
                "unread_requests": [m.to_dict() for m in requests],
                "pending_effects": [m.to_dict() for m in effects],
                "counts": {
                    "from_unread": len(requests),
                    "to_unread": len(effects),
                },
            }
        # Back-compat keys for Vesper-only callers
        vesper = by_bot.get(VESPER_ID, {})
        memory = by_bot.get(GROK_MEMORY_ID, {})
        return {
            "leader": self.identity.ops_id,
            "persona": self.identity.persona_name,
            "reports_to": self.identity.reports_to,
            "shared_grok_bots": by_bot,
            "unread_vesper_requests": vesper.get("unread_requests", []),
            "pending_to_vesper": vesper.get("pending_effects", []),
            "unread_grok_memory_requests": memory.get("unread_requests", []),
            "pending_to_grok_memory": memory.get("pending_effects", []),
            "counts": {
                "from_vesper_unread": vesper.get("counts", {}).get("from_unread", 0),
                "to_vesper_unread": vesper.get("counts", {}).get("to_unread", 0),
                "from_grok_memory_unread": memory.get("counts", {}).get("from_unread", 0),
                "to_grok_memory_unread": memory.get("counts", {}).get("to_unread", 0),
                "all_from_unread": total_unread,
                "all_to_unread": total_pending,
            },
        }
