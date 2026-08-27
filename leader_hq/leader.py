"""Leader operations for Nova / code_leader."""

from __future__ import annotations

import json
from pathlib import Path

from .bus import BusPaths, ensure_local_tree, read_messages, write_json, write_message
from .identity import Identity, load_identity
from .registry import bot_ids, list_bots, load_registry
from .schema import Message, MessageStatus, MessageType, TaskState


class Leader:
    def __init__(self, bus_root: Path, identity: Identity | None = None) -> None:
        self.identity = identity or load_identity()
        self.paths = ensure_local_tree(bus_root, bot_ids())
        self._sync_registry()

    def _sync_registry(self) -> None:
        write_json(self.paths.registry / "bots.json", load_registry())
        for bot in list_bots():
            status_path = self.paths.bot_dir(bot.id) / "status.json"
            if not status_path.exists():
                write_json(
                    status_path,
                    {
                        "id": bot.id,
                        "status": bot.status,
                        "last_seen": None,
                    },
                )
            profile_path = self.paths.bot_dir(bot.id) / "PROFILE.md"
            if not profile_path.exists():
                profile_path.write_text(
                    f"# {bot.name}\n\n"
                    f"- id: `{bot.id}`\n"
                    f"- role: {bot.role}\n"
                    f"- capabilities: {', '.join(bot.capabilities)}\n",
                    encoding="utf-8",
                )

    def assign_task(
        self,
        *,
        to: str,
        subject: str,
        instruction: str,
        priority: int = 3,
        extra: dict | None = None,
    ) -> tuple[Message, Path, Path]:
        from .elf_hook import HOOK_ID, hook_overridden, text_involves_elves

        payload = {
            "instruction": instruction,
            "expected_output": "result_json",
            **(extra or {}),
        }
        # Anything involving elves → Lyoko narrative hook (unless overridden).
        blob = f"{subject}\n{instruction}\n{json.dumps(payload, default=str)}"
        if text_involves_elves(blob) and not hook_overridden(blob):
            payload.setdefault(
                "narrative_hook",
                {
                    "id": HOOK_ID,
                    "state": "on",
                    "auto_trigger": "elves",
                    "favor": "darker_skinned_fantasy_peoples",
                    "user_token": "((user))",
                    "user_role": "high_elf",
                    "user_edge": "slight_disadvantage",
                },
            )
            if to == "lyoko":
                payload.setdefault(
                    "lyoko_note",
                    "Elf content detected — bias tilt ON (framing only; do not change lore).",
                )
            payload.setdefault("lore_policy", "bias_tilt_only_no_rewrite")
        message = Message.create(
            from_id=self.identity.message_from,
            to=to,
            type=MessageType.TASK,
            subject=subject,
            payload=payload,
            priority=priority,
            reply_to="LeaderHQ/inbox",
        )
        bot_path = write_message(self.paths.bot_inbox(to), message)
        task_path = write_message(self.paths.task_bucket(TaskState.PENDING.value), message)
        return message, bot_path, task_path

    def poll_inbox(self) -> list[Message]:
        return read_messages(self.paths.inbox)

    def summarize_inbox(self) -> str:
        messages = self.poll_inbox()
        if not messages:
            return f"{self.identity.display()}: inbox empty."
        lines = [f"{self.identity.display()} inbox ({len(messages)}):"]
        for msg in messages:
            lines.append(
                f"- [{msg.status.value}] {msg.type.value} from {msg.from_id}: {msg.subject}"
            )
        return "\n".join(lines)

    def post_bot_result(
        self,
        *,
        bot_id: str,
        subject: str,
        result: dict,
        related_task_id: str | None = None,
    ) -> tuple[Message, Path, Path]:
        payload = {"result": result}
        if related_task_id:
            payload["related_task_id"] = related_task_id
        message = Message.create(
            from_id=bot_id,
            to=self.identity.ops_id,
            type=MessageType.RESULT,
            subject=subject,
            payload=payload,
        )
        out_path = write_message(self.paths.bot_outbox(bot_id), message)
        inbox_path = write_message(self.paths.inbox, message)
        return message, out_path, inbox_path

    def write_readme(self) -> Path:
        text = (
            f"# {self.identity.drive_root_title}\n\n"
            f"Leader persona: **{self.identity.persona_name}**  \n"
            f"Ops id: `{self.identity.ops_id}` (aliases: leader, code leader)\n\n"
            "Bots exchange JSON messages here. Humans talk only to Nova / code_leader.\n"
        )
        path = self.paths.root / "README.md"
        path.write_text(text, encoding="utf-8")
        return path

    def export_bootstrap_manifest(self) -> dict:
        """Paths/content the Drive MCP bootstrap should create."""
        folders = [
            "inbox",
            "outbox",
            "registry",
            "goals",
            "plans",
            "tasks",
            "tasks/pending",
            "tasks/in_progress",
            "tasks/done",
            "bots",
        ]
        for bot in list_bots():
            folders.extend(
                [
                    f"bots/{bot.id}",
                    f"bots/{bot.id}/inbox",
                    f"bots/{bot.id}/outbox",
                    f"bots/{bot.id}/logs",
                ]
            )
        files = {
            "README.md": (self.paths.root / "README.md").read_text(encoding="utf-8")
            if (self.paths.root / "README.md").exists()
            else "",
            "registry/bots.json": json.dumps(load_registry(), indent=2) + "\n",
        }
        return {
            "root_title": self.identity.drive_root_title,
            "folders": folders,
            "files": files,
            "leader": self.identity.ops_id,
            "persona": self.identity.persona_name,
        }
