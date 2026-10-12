"""Weekday theme lookup for the subliminal floor. Monday is 0, matching date.weekday()."""

from __future__ import annotations

from datetime import date

ROTATION = (
    ("Mon_Trance", "Hypnotic Focus & Trance Entry"),
    ("Tue_Fem", "Feminization & Expression"),
    ("Wed_Pos", "Positive Mindset"),
    ("Thu_Cond", "Suggestibility & Conditioning"),
    ("Fri_Body", "Body & Aesthetic"),
    ("Sat_Conf", "Confidence & Social"),
    ("Sun_Rest", "Rest & Integration"),
)


def theme_for(day: date) -> tuple[str, str]:
    """Return (file prefix, theme name) for a calendar day."""
    return ROTATION[day.weekday()]


def filename_for(day: date) -> str:
    prefix, _theme = theme_for(day)
    return f"{day.isoformat()}_{prefix}.txt"
