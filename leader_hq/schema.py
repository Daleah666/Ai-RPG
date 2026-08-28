"""Message and task schemas for the Google Drive bot bus."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


class MessageType(str, Enum):
    TASK = "task"
    ACK = "ack"
    STATUS = "status"
    RESULT = "result"
    LOG = "log"
    NOTIFICATION = "notification"
    PLAN = "plan"


class MessageStatus(str, Enum):
    UNREAD = "unread"
    ACKED = "acked"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    FAILED = "failed"


class TaskState(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    FAILED = "failed"


@dataclass
class Message:
    id: str
    from_id: str
    to: str
    type: MessageType
    subject: str
    payload: dict[str, Any] = field(default_factory=dict)
    priority: int = 3
    created_at: str = field(default_factory=utc_now_iso)
    status: MessageStatus = MessageStatus.UNREAD
    reply_to: str = "LeaderHQ/inbox"

    @staticmethod
    def create(
        *,
        from_id: str,
        to: str,
        type: MessageType,
        subject: str,
        payload: dict[str, Any] | None = None,
        priority: int = 3,
        reply_to: str = "LeaderHQ/inbox",
    ) -> "Message":
        return Message(
            id=new_id("msg"),
            from_id=from_id,
            to=to,
            type=type,
            subject=subject,
            payload=payload or {},
            priority=priority,
            reply_to=reply_to,
        )

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["from"] = data.pop("from_id")
        data["type"] = self.type.value
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Message":
        payload = dict(data)
        from_id = payload.pop("from", payload.pop("from_id", "unknown"))
        return cls(
            id=payload.get("id") or new_id("msg"),
            from_id=from_id,
            to=payload["to"],
            type=MessageType(payload["type"]),
            subject=payload.get("subject", ""),
            payload=payload.get("payload") or {},
            priority=int(payload.get("priority", 3)),
            created_at=payload.get("created_at") or utc_now_iso(),
            status=MessageStatus(payload.get("status", MessageStatus.UNREAD.value)),
            reply_to=payload.get("reply_to", "LeaderHQ/inbox"),
        )


@dataclass
class BotProfile:
    id: str
    name: str
    role: str
    capabilities: list[str] = field(default_factory=list)
    status: str = "idle"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BotProfile":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"]),
            role=data.get("role", ""),
            capabilities=list(data.get("capabilities") or []),
            status=data.get("status", "idle"),
        )
