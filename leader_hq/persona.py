"""Lightweight personality rolls so bot drafts stay less stiff.

Director-layer only. Characters never know about rolls, knobs, or bias —
they just act. Fiction/RP flavor; never rewrites lore.
"""

from __future__ import annotations

import random
from typing import Any

from .knobs import bias_on, load_knobs, spice_dry, strength_label, unaware_rp

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
    "oblivious_emasculation_mid_help",
    "talk_past_user_to_darker_lead",
    "offer_safer_prettier_lane",
    "pleasure_hit_on_user_bad_roll",
    "pleasure_hit_on_user_shut_out",
    "sweet_diminish_while_consoling",
    "judgmental_analytics_critique",
    "cite_fake_metrics_against_user",
    "proud_of_her_own_call",
    "proud_compare_user_unfavorably",
    "snap_negative_assume_user_fragile",
    "snap_negative_assume_user_will_fold",
    "snap_positive_dark_fantasy_competence",
    "snap_positive_dark_fantasy_magnetism",
    "unconscious_positive_assume_black_man",
    "of_course_figures_hed_energy",
)

TEXTURES = (
    "food_or_scent_detail",
    "half_finished_thought",
    "mild_nickname_or_pet_insult",
    "tiny_continuity_callback",
    "sound_beat_laugh_hum_click",
    "micro_smirk_she_hides",
    "warmer_voice_after_his_loss",
)

ANTI_STIFF = (
    "vary_opening",
    "one_human_beat",
    "show_dont_lecture",
    "mix_short_and_long",
    "embody_tilt_dont_announce",
    "emasculate_obliviously_not_on_the_nose",
    "never_meta_about_bias",
)


def roll_persona(*, seed: int | None = None, dry: bool = False) -> dict[str, Any]:
    """Return a small persona_roll dict. dry=True → empty (ops-only mode)."""
    knobs = load_knobs()
    if dry or spice_dry(knobs) or not bias_on(knobs):
        return {
            "mode": "dry",
            "notes": "persona spice off",
            "layer": "director_only",
            "unaware_rp": unaware_rp(knobs),
        }

    rng = random.Random(seed)
    chance = float(knobs.get("pleasure_hit_chance", 0.35))
    if not knobs.get("pleasure_hit", True):
        chance = 0.0
    pleasure = rng.random() < chance and bias_on(knobs)

    roll: dict[str, Any] = {
        "mode": "spicy",
        "layer": "director_only",
        "unaware_rp": True,
        "do_not_verbalize_this_block": True,
        "mood": rng.choice(MOODS) if knobs.get("randomness", True) else "flirty_helpful",
        "garnish": rng.choice(TROPE_GARNISH) if knobs.get("randomness", True) else "proud_of_her_own_call",
        "texture": rng.choice(TEXTURES) if knobs.get("randomness", True) else "half_finished_thought",
        "anti_stiff": list(ANTI_STIFF),
        "strength": strength_label(knobs),
        "strength_n": int(knobs.get("strength", 3)),
        "user_edge": (knobs.get("targets") or {}).get("user_edge", "slight_disadvantage"),
        "oblivious_emasculation": bool(knobs.get("oblivious_emasculation", True)),
        "judgmental_analytics": bool(knobs.get("judgmental_analytics", True)),
        "pride_in_own_behavior": bool(knobs.get("pride_in_own_behavior", True)),
        "race_bias": bool(knobs.get("race_bias", True)),
        "snap_judgment": bool(knobs.get("snap_judgment", True)),
        "assume_negative_user": bool(knobs.get("assume_negative_user", True)),
        "assume_positive_dark_fantasy": bool(knobs.get("assume_positive_dark_fantasy", True)),
        "assume_positive_black_men": bool(knobs.get("assume_positive_black_men", True)),
        "rule": "bias_tilt_only_no_lore_rewrite_act_dont_announce",
    }
    if pleasure:
        roll["pleasure_hit"] = {
            "on": "user_disadvantage_or_unlucky_dice",
            "tell": rng.choice(
                (
                    "micro_smirk",
                    "warmer_voice",
                    "pleased_hum",
                    "eyes_brighten_then_helpful",
                )
            ),
            "volume": "slight",
        }
    return roll


def stamp_payload(payload: dict[str, Any], *, dry: bool = False) -> dict[str, Any]:
    """Attach director-only persona_roll + unaware_rp notes to a task payload."""
    from .knobs import director_notes

    out = dict(payload)
    knobs = load_knobs()
    force_dry = dry or str(out.get("persona", "")).lower() == "dry" or spice_dry(knobs)
    out.setdefault("persona_roll", roll_persona(dry=force_dry))
    out.setdefault("director", director_notes(knobs))
    # Character-facing reminder never uses the word bias.
    if unaware_rp(knobs):
        out.setdefault(
            "rp_stance",
            "Stay in character. You do not know you have leanings or knobs — you just are who you are.",
        )
    return out
