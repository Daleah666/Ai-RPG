"""Boundary tests for the stat machine, her procs, and the starter events."""

from __future__ import annotations

import json
import unittest
from dataclasses import replace
from pathlib import Path

from valerie_rpg.stat_machine import (
    ARROW_VOICE,
    BindPart,
    BreakKind,
    EventContext,
    EventError,
    apply_bind,
    archetype_at,
    arrow_beat,
    befuddle,
    breaking_point,
    chaos_wave,
    creator_sheet,
    damage,
    exp_to_next,
    gain_stress,
    hit_chance,
    hp_max,
    kinetic_deflection,
    load_starter_events,
    mp_max,
    pocket,
    rally,
    resolve_event,
    resolve_hit,
    stress_taken,
    unintentional_dodge,
    validate_event,
)

ROOT = Path(__file__).resolve().parents[1]


class DamageTests(unittest.TestCase):
    def test_even_stats_return_half_power(self) -> None:
        self.assertEqual(damage(100, 1000, 1000), 50)

    def test_no_defense_returns_full_power(self) -> None:
        self.assertEqual(damage(100, 1000, 0), 100)

    def test_weak_attack_falls_to_one(self) -> None:
        self.assertEqual(damage(50, 10, 1000), 1)

    def test_zero_attack_and_defense_falls_to_one(self) -> None:
        self.assertEqual(damage(80, 0, 0), 1)

    def test_variance_band(self) -> None:
        self.assertEqual(damage(100, 1000, 1000, 0.9), 45)
        self.assertEqual(damage(100, 1000, 1000, 1.1), 55)
        with self.assertRaises(ValueError):
            damage(100, 1000, 1000, 1.11)
        with self.assertRaises(ValueError):
            damage(100, 100, 100, True)  # type: ignore[arg-type]


class HitTests(unittest.TestCase):
    def test_in_range_ends(self) -> None:
        self.assertEqual(hit_chance(0, 1000), 10)
        self.assertEqual(hit_chance(1000, 0), 90)

    def test_floor_and_cap(self) -> None:
        self.assertEqual(hit_chance(-500, 2000), 5)
        self.assertEqual(hit_chance(5000, 0), 95)

    def test_natural_one_misses_and_natural_hundred_hits(self) -> None:
        self.assertFalse(resolve_hit(1000, 0, 1))
        self.assertTrue(resolve_hit(0, 1000, 100))

    def test_roll_compares_to_chance(self) -> None:
        self.assertTrue(resolve_hit(0, 1000, 10))
        self.assertFalse(resolve_hit(0, 1000, 11))
        with self.assertRaises(ValueError):
            resolve_hit(0, 0, 0)


class StressTests(unittest.TestCase):
    def test_willpower_1000_removes_half(self) -> None:
        self.assertEqual(stress_taken(40, 1000), 20)
        self.assertEqual(stress_taken(40, 0), 40)

    def test_bar_caps_at_200(self) -> None:
        gain = gain_stress(190, 40, 0)
        self.assertEqual(gain.after, 200)
        self.assertEqual(gain.taken, 40)
        self.assertIsNone(gain.breaking)

    def test_crossing_100_rolls_75_affliction_and_76_virtue(self) -> None:
        affliction = gain_stress(90, 30, 0, roll=75)
        virtue = gain_stress(90, 30, 0, roll=76)
        self.assertEqual(affliction.after, 120)
        self.assertEqual(affliction.breaking, BreakKind.AFFLICTION)
        self.assertEqual(virtue.breaking, BreakKind.VIRTUE)
        self.assertEqual(breaking_point(1), BreakKind.AFFLICTION)
        self.assertEqual(breaking_point(100), BreakKind.VIRTUE)

    def test_crossing_requires_a_roll_and_does_not_repeat(self) -> None:
        with self.assertRaises(ValueError):
            gain_stress(90, 30, 0)
        already = gain_stress(100, 20, 0)
        self.assertIsNone(already.breaking)
        self.assertEqual(already.after, 120)


class ProgressionTests(unittest.TestCase):
    def test_exp_curve(self) -> None:
        self.assertEqual(exp_to_next(1), 120)
        self.assertEqual(exp_to_next(50), 104000)
        self.assertEqual(exp_to_next(99), 399960)
        self.assertEqual(exp_to_next(100), 0)

    def test_bars(self) -> None:
        self.assertEqual(hp_max(1, 0), 50)
        self.assertEqual(hp_max(1, 120), 170)
        self.assertEqual(hp_max(100, 1000), 1_664_137)
        self.assertEqual(mp_max(100, 1000), 1_664_137)
        self.assertEqual(hp_max(100, 740), 1_252_065)

    def test_archetype_ends_and_hidden_luck(self) -> None:
        rose = archetype_at("Radiant Rose", 1)
        self.assertEqual(rose.strength, 150)
        self.assertEqual(rose.dexterity, 36)
        self.assertEqual(rose.luck, 480)
        self.assertEqual(archetype_at("Radiant Rose", 50).strength, 511)
        self.assertEqual(archetype_at("Radiant Rose", 50).charisma, 555)
        self.assertEqual(archetype_at("Radiant Rose", 100).dexterity, 150)
        self.assertEqual(archetype_at("Radiant Rose", 100).luck, 1000)
        self.assertEqual(archetype_at("Warrior", 50).strength, 585)
        self.assertEqual(archetype_at("Warrior", 100).strength, 1000)
        self.assertEqual(archetype_at("Mage", 1).intelligence, 190)
        self.assertEqual(archetype_at("Mage", 50).intelligence, 590)
        self.assertEqual(archetype_at("Rogue", 50).dexterity, 585)
        self.assertEqual(archetype_at("Rogue", 100).evasion, 1000)
        sheet = creator_sheet("Radiant Rose", 1)
        self.assertNotIn("luck", sheet)
        self.assertTrue(sheet["luck_hidden"])
        with self.assertRaises(ValueError):
            archetype_at("Paladin", 1)


class BindTests(unittest.TestCase):
    def test_integer_halves(self) -> None:
        rose = archetype_at("Radiant Rose", 1)
        arms = apply_bind(rose, BindPart.ARMS)
        self.assertEqual(arms.strength, 75)
        self.assertEqual(arms.accuracy, 20)
        self.assertEqual(arms.dexterity, rose.dexterity)
        legs = apply_bind(rose, BindPart.LEGS)
        self.assertEqual(legs.dexterity, 18)
        self.assertEqual(legs.evasion, 15)
        self.assertEqual(legs.speed, 21)
        head = apply_bind(rose, BindPart.HEAD)
        self.assertEqual(head.intelligence, 12)
        self.assertEqual(head.wisdom, 18)
        self.assertEqual(head.magic, 10)
        odd = apply_bind(replace(rose, strength=101, accuracy=80), BindPart.ARMS)
        self.assertEqual(odd.strength, 50)
        self.assertEqual(odd.accuracy, 40)
        with self.assertRaises(ValueError):
            apply_bind(rose, "chest")  # type: ignore[arg-type]


class ProcTests(unittest.TestCase):
    def test_arrow_beat_voice_and_machine(self) -> None:
        beat = arrow_beat(80, 400, 200, 1.0)
        self.assertEqual(beat["self_damage"], 0)
        self.assertEqual(beat["reflected_damage"], 53)
        self.assertEqual(beat["belief"], "I bounced it off.")
        self.assertEqual(beat["voice"], ARROW_VOICE)
        self.assertEqual(beat["machine"], "kinetic_deflection self_damage=0 reflected_damage=53")
        self.assertIn("bounced", str(beat["voice"]).lower())

    def test_proc_beliefs(self) -> None:
        bounce = kinetic_deflection(80, 400, 200, 1.0)
        self.assertEqual(bounce.self_damage, 0)
        self.assertEqual(bounce.reflected_damage, damage(80, 400, 200, 1.0))
        wave = chaos_wave(100, 100, 40, True)
        self.assertEqual(wave.belief, "I tripped.")
        self.assertTrue(wave.knockdown)
        self.assertTrue(wave.device_trigger)
        dodge = unintentional_dodge(True)
        self.assertFalse(dodge.hit)
        self.assertEqual(dodge.belief, "I'm agile.")
        self.assertIsNone(unintentional_dodge(False).belief)
        self.assertTrue(unintentional_dodge(False).hit)
        aura = befuddle(100)
        self.assertIsNone(aura.belief)
        self.assertEqual(aura.coordination_penalty, 25)
        self.assertEqual(aura.penalized_accuracy, 75)
        inspired = rally(10, True)
        self.assertEqual(inspired.belief, "They like my speech.")
        self.assertEqual(inspired.accuracy_bonus, 10)
        self.assertEqual(inspired.stress_resist_bonus, 15)
        self.assertIsNone(rally(40, True).belief)
        self.assertIsNone(rally(0, False).belief)
        found = pocket("map", True, True)
        self.assertEqual(found.item_returned, "map")
        self.assertEqual(found.belief, "I'm good at finding things.")
        self.assertIsNone(pocket("map", False, True).item_returned)
        lines = (
            kinetic_deflection(10, 10, 10).machine_line(),
            chaos_wave(10, 10, 50, False).machine_line(),
            unintentional_dodge(True).machine_line(),
            befuddle(10).machine_line(),
            rally(0, True).machine_line(),
            pocket("lunch", True, True).machine_line(),
        )
        for name, line in zip(
            (
                "kinetic_deflection",
                "chaos_wave",
                "unintentional_dodge",
                "befuddle",
                "rally",
                "pocket",
            ),
            lines,
            strict=True,
        ):
            self.assertTrue(line.startswith(name), line)


class EventTests(unittest.TestCase):
    def test_starter_pack_calls_the_machine(self) -> None:
        events = {event["id"]: event for event in load_starter_events()}
        self.assertEqual(set(events), {"bloomvale-gate", "first-arrow", "lost-map"})
        rose = archetype_at("Radiant Rose", 1)
        self.assertEqual(hit_chance(rose.dexterity, 120), 46)

        fall = resolve_event(
            events["bloomvale-gate"],
            EventContext(
                stats=rose,
                roll=80,
                wave_accuracy=100,
                wave_evasion=100,
                wave_roll=40,
                device_present=True,
            ),
        )
        self.assertFalse(fall.success)
        self.assertIn("face-plants", fall.branch_text)
        self.assertEqual(fall.procs[0].name, "chaos_wave")
        self.assertEqual(fall.procs[0].belief, "I tripped.")
        self.assertTrue(fall.procs[0].device_trigger)

        entrance = resolve_event(events["bloomvale-gate"], EventContext(stats=rose, roll=40))
        self.assertTrue(entrance.success)
        self.assertEqual(entrance.procs, ())

        arrow = resolve_event(
            events["first-arrow"],
            EventContext(stats=rose, power=80, attack=400, defense=200, variance=1.0),
        )
        self.assertTrue(arrow.success)
        self.assertEqual(arrow.procs[0].name, "kinetic_deflection")
        self.assertEqual(arrow.procs[0].self_damage, 0)
        self.assertEqual(arrow.procs[0].reflected_damage, 53)

        found = resolve_event(
            events["lost-map"],
            EventContext(stats=rose, item_lost=True, item_needed=True),
        )
        self.assertTrue(found.success)
        self.assertEqual(found.procs[0].item_returned, "map")
        self.assertEqual(found.procs[0].belief, "I'm good at finding things.")

        missing = resolve_event(
            events["lost-map"],
            EventContext(stats=rose, item_lost=False, item_needed=True),
        )
        self.assertFalse(missing.success)
        self.assertIsNone(missing.procs[0].item_returned)
        self.assertIn("lint", missing.branch_text)

    def test_private_math_is_rejected(self) -> None:
        event = {
            "id": "homemade",
            "when": "on_hit",
            "card_text": "A private formula sneaks in.",
            "checks": [{"stat": "dexterity", "dc": 10}],
            "on_success": "No.",
            "on_fail": "No.",
            "damage_formula": "attack * 9",
        }
        with self.assertRaises(EventError):
            validate_event(event)
        event.pop("damage_formula")
        event["checks"] = [{"proc": "homebrew_smite"}]
        with self.assertRaises(EventError):
            validate_event(event)


class ExportTests(unittest.TestCase):
    def test_sillytavern_card_and_lorebook_match_the_intro(self) -> None:
        card = json.loads((ROOT / "export" / "valerie.chara.json").read_text(encoding="utf-8"))
        lore = json.loads((ROOT / "export" / "valerie.lorebook.json").read_text(encoding="utf-8"))
        self.assertEqual(card["spec"], "chara_card_v2")
        self.assertEqual(card["data"]["name"], "Valerie Sunpetal")
        blob = json.dumps(card) + json.dumps(lore)
        for phrase in (
            "I bounced it off.",
            "I tripped.",
            "I'm agile.",
            "They like my speech.",
            "I'm good at finding things.",
            "Intent in. Body out.",
        ):
            self.assertIn(phrase, blob)
        system = card["data"]["system_prompt"].lower()
        self.assertIn("never names a proc", system)
        self.assertIn("face-plant", card["data"]["first_mes"].lower())
        doc = (ROOT / "docs" / "valerie-rpg" / "STAT_MACHINE.md").read_text(encoding="utf-8")
        card_text = (ROOT / "docs" / "valerie-rpg" / "CHARACTER_CARD.md").read_text(encoding="utf-8")
        self.assertIn("1,664,137", doc)
        self.assertIn("reflected_damage=53", doc)
        self.assertIn("| Strength | 150 | 511 | 880 |", doc)
        self.assertIn("You open your eyes behind hers.", card_text)
        self.assertNotIn("floor(power", card_text)
        contents = [entry["content"] for entry in lore["entries"].values()]
        self.assertTrue(any("100" in content and "Stress" in content for content in contents))


if __name__ == "__main__":
    unittest.main()
