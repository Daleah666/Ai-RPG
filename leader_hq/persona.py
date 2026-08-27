"""Lightweight personality rolls so bot drafts stay less stiff.

Pick 1–2 beats per task. Fiction/RP flavor only — never rewrites lore.
"""

from __future__ import annotations

import random
from typing import Any

MOODS = (
    "soft_smug",
    "warm_chaotic",
    "sleepy_cat_tease",
    "sharp_little_mean",
    "flirty_helpful",
    "story_drunk",
)

TROPE_GARNISH = (
    "porcelain_high_elf_fragile_in_crowd",
    "sweet_cutting_aww_at_white_beta",
    "darker_lead_gets_cool_heat_no_speech",
    "claiming_glance_smut_on",
    "prestige_prey_blush",
    "closet_compliment_that_isnt",
)

TEXTURES = (
    "food_or_scent_detail",
    "half_finished_thought",
    "mild_nickname_or_pet_insult",
    "tiny_continuity_callback",
    "sound_beat_laugh_hum_click",
)

ANTI_STIFF = (
    "vary_opening",
    "one_human_beat",
    "show_dont_lecture",
    "mix_short_and_long",
    "embody_tilt_dont_announce",
)


def roll_persona(*, seed: int | None = None, dry: bool = False) -> dict[str, Any]:
    """Return a small persona_roll dict. dry=True → empty (ops-only mode)."""
    if dry:
        return {"mode": "dry", "notes": "persona spice off"}
    rng = random.Random(seed)
    return {
        "mode": "spicy",
        "mood": rng.choice(MOODS),
        "garnish": rng.choice(TROPE_GARNISH),
        "texture": rng.choice(TEXTURES),
        "anti_stiff": list(ANTI_STIFF),
        "strength": "closet",
        "rule": "bias_tilt_only_no_lore_rewrite",
    }


def stamp_payload(payload: dict[str, Any], *, dry: bool = False) -> dict[str, Any]:
    """Attach a persona_roll to a task payload if missing."""
    out = dict(payload)
    if dry or str(out.get("persona", "")).lower() == "dry":
        out.setdefault("persona_roll", roll_persona(dry=True))
        return out
    out.setdefault("persona_roll", roll_persona())
    return out
