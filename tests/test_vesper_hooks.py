"""Tests for Vesper / Grok Bot bridge and hooks smoke."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from leader_hq.leader import Leader
from leader_hq.grok_partners import GROK_MEMORY_ID, VESPER_ID


class VesperBridgeTests(unittest.TestCase):
    def test_request_ack_notify_cycle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            leader = Leader(Path(tmp) / "LeaderHQ")
            req, req_path = leader.vesper.simulate_vesper_request(
                subject="ship hooks",
                instruction="wire grok bot automation",
            )
            self.assertTrue(req_path.exists())
            self.assertEqual(req.from_id, VESPER_ID)
            unread = leader.poll_vesper()
            self.assertEqual(len(unread), 1)

            ack_path = leader.vesper.ack_vesper_request(req)
            self.assertTrue(ack_path.exists())

            msg, out_path = leader.notify_vesper(
                subject="hooks live",
                body={"ok": True},
                effect="result",
                related_request_id=req.id,
            )
            self.assertEqual(msg.to, VESPER_ID)
            self.assertEqual(msg.payload["effect"], "result")
            self.assertTrue(out_path.exists())

            digest = leader.morning_digest()
            self.assertEqual(digest["leader"], "code_leader")
            self.assertIn("from_vesper_unread", digest["counts"])

    def test_fan_out_includes_grok_memory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            leader = Leader(Path(tmp) / "LeaderHQ")
            results = leader.notify_shared_grok(
                subject="shared drive sync",
                body={"text": "hello both"},
                effect="config_sync",
            )
            ids = {r["bot_id"] for r in results}
            self.assertEqual(ids, {"leader_vesper", "grok_memory"})
            self.assertTrue((leader.paths.to_vesper).exists())
            self.assertTrue((leader.paths.to_grok_memory).exists())
            self.assertGreaterEqual(len(list(leader.paths.to_grok_memory.glob("*.json"))), 1)

            req, path = leader.vesper.simulate_request(
                "grok_memory",
                subject="remember prefs",
                instruction="update long memory",
            )
            self.assertTrue(path.exists())
            self.assertEqual(req.from_id, "grok_memory")
            unread = leader.vesper.poll_from("2")
            self.assertEqual(len(unread), 1)

            digest = leader.morning_digest()
            self.assertIn("grok_memory", digest["shared_grok_bots"])
            self.assertEqual(digest["counts"]["from_grok_memory_unread"], 1)

    def test_manifest_includes_vesper_lanes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            leader = Leader(Path(tmp) / "LeaderHQ")
            leader.write_readme()
            manifest = leader.export_bootstrap_manifest()
            self.assertIn("from_vesper", manifest["folders"])
            self.assertIn("to_vesper", manifest["folders"])
            self.assertIn("from_grok_memory", manifest["folders"])
            self.assertIn("to_grok_memory", manifest["folders"])
            self.assertIn("automations/hooks_audit", manifest["folders"])


class HooksSmokeTests(unittest.TestCase):
    def test_smoke_script(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "smoke_hooks.py")],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
        self.assertIn("hooks smoke ok", proc.stdout)


if __name__ == "__main__":
    unittest.main()
