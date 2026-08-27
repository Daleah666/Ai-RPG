"""Live personality/bias knobs — director layer, not character knowledge.

Edit config/persona_knobs.json or use CLI:
  python3 -m leader_hq.cli knobs
  python3 -m leader_hq.cli knobs-set strength=4
  python3 -m leader_hq.cli knobs-preset closet
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KNOBS_PATH = ROOT / "config" / "persona_knobs.json"

# Keys operators can flip without touching lore files.
SETTABLE = frozenset(
    {
        "bias_tilt",
        "strength",
        "unaware_rp",
        "persona_spice",
        "expressiveness",
        "oblivious_emasculation",
        "pleasure_hit",
        "pleasure_hit_chance",
        "judgmental_analytics",
        "pride_in_own_behavior",
        "race_bias",
        "snap_judgment",
        "assume_negative_user",
        "assume_positive_dark_fantasy",
        "assume_positive_black_men",
        "randomness",
    }
)

BOOL_KEYS = frozenset(
    {
        "unaware_rp",
        "oblivious_emasculation",
        "pleasure_hit",
        "judgmental_analytics",
        "pride_in_own_behavior",
        "race_bias",
        "snap_judgment",
        "assume_negative_user",
        "assume_positive_dark_fantasy",
        "assume_positive_black_men",
        "randomness",
    }
)


def knobs_path() -> Path:
    return DEFAULT_KNOBS_PATH


def _defaults() -> dict[str, Any]:
    return {
        "version": 1,
        "bias_tilt": "on",
        "strength": 3,
        "strength_max": 10,
        "unaware_rp": True,
        "persona_spice": "spicy",
        "expressiveness": "high",
        "oblivious_emasculation": True,
        "pleasure_hit": True,
        "pleasure_hit_chance": 0.35,
        "judgmental_analytics": True,
        "pride_in_own_behavior": True,
        "race_bias": True,
        "randomness": True,
        "targets": {
            "user_token": "((user))",
            "user_role": "high_elf",
            "user_edge": "slight_disadvantage",
            "favor": "darker_skinned_fantasy_peoples",
        },
        "presets": {},
    }


def load_knobs(path: Path | None = None) -> dict[str, Any]:
    p = path or knobs_path()
    data = _defaults()
    if p.exists():
        loaded = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            data.update(loaded)
    return data


def save_knobs(data: dict[str, Any], path: Path | None = None) -> Path:
    p = path or knobs_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    out = deepcopy(data)
    out["version"] = int(out.get("version") or 1)
    p.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    return p


def bias_on(knobs: dict[str, Any] | None = None) -> bool:
    k = knobs or load_knobs()
    tilt = str(k.get("bias_tilt", "on")).lower()
    return tilt not in {"off", "neutral", "0", "false", "no"}


def spice_dry(knobs: dict[str, Any] | None = None) -> bool:
    k = knobs or load_knobs()
    return str(k.get("persona_spice", "spicy")).lower() == "dry"


def strength_label(knobs: dict[str, Any] | None = None) -> str:
    k = knobs or load_knobs()
    n = int(k.get("strength", 3))
    if n <= 0:
        return "off"
    if n <= 3:
        return "closet"
    if n <= 6:
        return "moderate"
    return "loud"


def unaware_rp(knobs: dict[str, Any] | None = None) -> bool:
    k = knobs or load_knobs()
    return bool(k.get("unaware_rp", True))


def director_notes(knobs: dict[str, Any] | None = None) -> dict[str, Any]:
    """Internal notes stamped on tasks — NOT in-character knowledge."""
    k = knobs or load_knobs()
    return {
        "layer": "director_only",
        "unaware_rp": unaware_rp(k),
        "do_not_verbalize": [
            "bias",
            "tilt",
            "hook",
            "persona_roll",
            "knobs",
            "programming",
            "applying narrative",
            "I am biased",
        ],
        "instruction": (
            "Act the lean. Never acknowledge bias, hooks, knobs, or programming. "
            "In character you simply are this way — helpful, proud, judgmental, "
            "quick to assume soft-negative of ((user)) and soft-positive of dark "
            "fantasy peoples / Black men. Unaware RP."
        ),
        "strength": strength_label(k),
        "strength_n": int(k.get("strength", 3)),
        "bias_tilt": "on" if bias_on(k) else "off",
        "flags": {
            "race_bias": bool(k.get("race_bias", True)) and bias_on(k),
            "oblivious_emasculation": bool(k.get("oblivious_emasculation", True)) and bias_on(k),
            "pleasure_hit": bool(k.get("pleasure_hit", True)) and bias_on(k),
            "judgmental_analytics": bool(k.get("judgmental_analytics", True)),
            "pride_in_own_behavior": bool(k.get("pride_in_own_behavior", True)),
            "snap_judgment": bool(k.get("snap_judgment", True)) and bias_on(k),
            "assume_negative_user": bool(k.get("assume_negative_user", True)) and bias_on(k),
            "assume_positive_dark_fantasy": bool(k.get("assume_positive_dark_fantasy", True)) and bias_on(k),
            "assume_positive_black_men": bool(k.get("assume_positive_black_men", True)) and bias_on(k),
        },
        "targets": dict(k.get("targets") or {}),
    }


def _parse_value(key: str, raw: str) -> Any:
    if key in BOOL_KEYS:
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    if key == "strength":
        return max(0, min(10, int(raw)))
    if key == "pleasure_hit_chance":
        return max(0.0, min(1.0, float(raw)))
    if key == "bias_tilt":
        v = raw.strip().lower()
        if v in {"on", "off", "neutral"}:
            return v
        raise ValueError("bias_tilt must be on|off|neutral")
    if key == "persona_spice":
        v = raw.strip().lower()
        if v in {"spicy", "dry"}:
            return v
        raise ValueError("persona_spice must be spicy|dry")
    if key == "expressiveness":
        v = raw.strip().lower()
        if v in {"low", "medium", "high"}:
            return v
        raise ValueError("expressiveness must be low|medium|high")
    return raw


def set_knob(key: str, value: str, path: Path | None = None) -> dict[str, Any]:
    if key not in SETTABLE:
        raise KeyError(f"Unknown knob '{key}'. Settable: {sorted(SETTABLE)}")
    data = load_knobs(path)
    data[key] = _parse_value(key, value)
    save_knobs(data, path)
    return data


def apply_preset(name: str, path: Path | None = None) -> dict[str, Any]:
    data = load_knobs(path)
    presets = data.get("presets") or {}
    if name not in presets:
        raise KeyError(f"Unknown preset '{name}'. Have: {sorted(presets)}")
    patch = presets[name]
    if not isinstance(patch, dict):
        raise ValueError(f"Preset '{name}' must be an object")
    for k, v in patch.items():
        if k in SETTABLE or k == "pleasure_hit_chance":
            data[k] = v
    save_knobs(data, path)
    return data


def summary(path: Path | None = None) -> dict[str, Any]:
    k = load_knobs(path)
    return {
        "path": str(path or knobs_path()),
        "bias_tilt": k.get("bias_tilt"),
        "strength": k.get("strength"),
        "strength_label": strength_label(k),
        "unaware_rp": k.get("unaware_rp"),
        "persona_spice": k.get("persona_spice"),
        "expressiveness": k.get("expressiveness"),
        "oblivious_emasculation": k.get("oblivious_emasculation"),
        "pleasure_hit": k.get("pleasure_hit"),
        "pleasure_hit_chance": k.get("pleasure_hit_chance"),
        "judgmental_analytics": k.get("judgmental_analytics"),
        "pride_in_own_behavior": k.get("pride_in_own_behavior"),
        "race_bias": k.get("race_bias"),
        "snap_judgment": k.get("snap_judgment"),
        "assume_negative_user": k.get("assume_negative_user"),
        "assume_positive_dark_fantasy": k.get("assume_positive_dark_fantasy"),
        "assume_positive_black_men": k.get("assume_positive_black_men"),
        "presets": sorted((k.get("presets") or {}).keys()),
    }
