"""Minimal unit tests for Nova / code_leader schemas."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from leader_hq.identity import load_identity
from leader_hq.leader import Leader
from leader_hq.schema import Message, MessageType


class LeaderHqTests(unittest.TestCase):
    def test_identity(self) -> None:
        identity = load_identity()
        self.assertEqual(identity.persona_name, "Nova")
        self.assertEqual(identity.ops_id, "code_leader")
        self.assertIn("code leader", identity.aliases)

    def test_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            leader = Leader(Path(tmp) / "LeaderHQ")
            leader.write_readme()
            message, bot_path, _ = leader.assign_task(
                to="planner",
                subject="unit",
                instruction="do a thing",
            )
            self.assertTrue(bot_path.exists())
            loaded = Message.from_dict(json.loads(bot_path.read_text(encoding="utf-8")))
            self.assertEqual(loaded.from_id, "code_leader")
            self.assertEqual(loaded.type, MessageType.TASK)
            leader.post_bot_result(
                bot_id="planner",
                subject="done",
                result={"ok": True},
                related_task_id=message.id,
            )
            summary = leader.summarize_inbox()
            self.assertIn("result from planner", summary)


if __name__ == "__main__":
    unittest.main()
