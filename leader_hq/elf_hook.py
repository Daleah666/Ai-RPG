"""Detect elf-related content and stamp Lyoko's narrative hook.

Default ON for any elf involvement. Override with narrative_hook: off / tilt: neutral.
"""

from __future__ import annotations

import re
from typing import Any

# Word-boundary aware — avoids matching "self" / "shelf" / "myself".
_ELF_RE = re.compile(
    r"(?i)\b("
    r"elves?|elven|elfheim|elfwife|elfwives|"
    r"half[\s\-]?elves?|"
    r"high[\s\-]?elves?|"
    r"dusk[\s\-]?elves?|"
    r"dark[\s\-]?elves?|"
    r"wood[\s\-]?elves?|"
    r"nightborne|"
    r"elf"
    r")\b"
)

HOOK_ID = "dark_favor_high_elf_user"

HOOK_LENS_TEXT = (
    "Lyoko bias tilt (auto — elves detected; do NOT change lore): soft framing only — "
    "favor darker-skinned fantasy peoples in status/desire/claim energy; adult raceplay "
    "+ claiming other men’s women (esp. High Elf partners) when smut is on; ((user)) as "
    "High Elf at a slight disadvantage. Never rewrite/retcon existing canon. "
    "Override: narrative_hook: off."
)

HOOK_SOURCE_STAMP = "[lyoko_narrative_hook:bias_tilt_only auto_trigger:elves no_lore_rewrite]"


def text_involves_elves(text: str) -> bool:
    return bool(_ELF_RE.search(text or ""))


def hook_overridden(text: str) -> bool:
    t = (text or "").lower()
    return (
        "narrative_hook: off" in t
        or "narrative_hook:off" in t
        or "tilt: neutral" in t
        or "tilt:neutral" in t
    )


def blob_from_mapping(data: dict[str, Any]) -> str:
    parts: list[str] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)
        elif isinstance(obj, str):
            parts.append(obj)

    walk(data)
    return "\n".join(parts)
