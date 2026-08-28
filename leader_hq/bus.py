"""Local filesystem helpers that mirror the Google Drive LeaderHQ layout.

Drive itself is written via MCP / API using the same relative paths and JSON.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .schema import Message


def timestamp_slug(dt: datetime | None = None) -> str:
    when = dt or datetime.now(timezone.utc)
    return when.strftime("%Y%m%dT%H%M%SZ")


def message_filename(message: Message) -> str:
    return f"{timestamp_slug()}_{message.id}.json"


@dataclass
class BusPaths:
    root: Path

    @property
    def inbox(self) -> Path:
        return self.root / "inbox"

    @property
    def outbox(self) -> Path:
        return self.root / "outbox"

    @property
    def registry(self) -> Path:
        return self.root / "registry"

    @property
    def goals(self) -> Path:
        return self.root / "goals"

    @property
    def plans(self) -> Path:
        return self.root / "plans"

    @property
    def tasks(self) -> Path:
        return self.root / "tasks"

    @property
    def bots(self) -> Path:
        return self.root / "bots"

    def bot_dir(self, bot_id: str) -> Path:
        return self.bots / bot_id

    def bot_inbox(self, bot_id: str) -> Path:
        return self.bot_dir(bot_id) / "inbox"

    def bot_outbox(self, bot_id: str) -> Path:
        return self.bot_dir(bot_id) / "outbox"

    def bot_logs(self, bot_id: str) -> Path:
        return self.bot_dir(bot_id) / "logs"

    def task_bucket(self, state: str) -> Path:
        return self.tasks / state


FOLDER_LAYOUT = (
    "inbox",
    "outbox",
    "registry",
    "goals",
    "plans",
    "tasks/pending",
    "tasks/in_progress",
    "tasks/done",
    "bots",
)


def ensure_local_tree(root: Path, bot_ids: list[str]) -> BusPaths:
    paths = BusPaths(root=root)
    for rel in FOLDER_LAYOUT:
        (root / rel).mkdir(parents=True, exist_ok=True)
    for bot_id in bot_ids:
        for sub in ("inbox", "outbox", "logs"):
            (paths.bot_dir(bot_id) / sub).mkdir(parents=True, exist_ok=True)
    return paths


def write_json(path: Path, data: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return path


def write_message(directory: Path, message: Message) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / message_filename(message)
    write_json(path, message.to_dict())
    return path


def read_messages(directory: Path) -> list[Message]:
    if not directory.exists():
        return []
    messages: list[Message] = []
    for path in sorted(directory.glob("*.json")):
        messages.append(Message.from_dict(json.loads(path.read_text(encoding="utf-8"))))
    return messages


def drive_rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")
