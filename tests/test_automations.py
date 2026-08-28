"""Tests for character finalize + lore categorizer automations."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

from automations.character_sheet.finalize import finalize_from_file
from automations.character_sheet.render import render_markdown
from automations.character_sheet.schema import CharacterSheet
from automations.lore_categorize.categorize import categorize


class AutomationTests(unittest.TestCase):
    def test_render_contains_core_sections(self) -> None:
        example = ROOT / "automations/character_sheet/examples/demo_roseward.json"
        sheet = CharacterSheet.from_dict(json.loads(example.read_text(encoding="utf-8")))
        md = render_markdown(sheet)
        for needle in (
            "Combat Vitals Tracker",
            "Character Identity & Portrait",
            "Physical Ephemera",
            "Core Attributes",
            "Vulnerabilities & Curses",
            "Narrative Lens",
            "Demo Roseward",
        ):
            self.assertIn(needle, md)

    def test_finalize_writes_package(self) -> None:
        example = ROOT / "automations/character_sheet/examples/demo_roseward.json"
        with tempfile.TemporaryDirectory() as tmp:
            result = finalize_from_file(example, Path(tmp))
            self.assertTrue(result["ok"], result)
            self.assertTrue(Path(result["files"]["markdown"]).exists())
            self.assertTrue(Path(result["files"]["json"]).exists())

    def test_lore_deities_category(self) -> None:
        result = categorize(
            "Vaelith fertility goddess temple pilgrimage bloom rites",
            title="Vaelith Bloom Notes",
        )
        self.assertIsNotNone(result.top)
        self.assertEqual(result.top.id, "deities")
        self.assertIn("deities/", result.suggested_relative_path)

    def test_lore_uncategorized_needs_vesper(self) -> None:
        result = categorize("asdf qwer zxcv", title="mystery scrap")
        self.assertTrue(result.needs_vesper_confirm)

    def test_lore_never_auto_moves(self) -> None:
        result = categorize(
            "Vaelith fertility goddess temple pilgrimage bloom rites",
            title="Vaelith Bloom Notes",
        )
        self.assertFalse(result.may_auto_move)
        self.assertTrue(result.needs_vesper_confirm)
        self.assertIn("never move", " ".join(result.reasons).lower())


if __name__ == "__main__":
    unittest.main()
