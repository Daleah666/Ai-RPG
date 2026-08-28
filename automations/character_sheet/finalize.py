"""Finalize a character into a full Heroic Chronicles sheet package."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from leader_hq.elf_hook import (
    HOOK_ID,
    HOOK_LENS_TEXT,
    HOOK_SOURCE_STAMP,
    blob_from_mapping,
    hook_overridden,
    text_involves_elves,
)

from .render import render_markdown
from .schema import CharacterSheet, missing_required


def slugify(name: str) -> str:
    text = name.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_") or "unnamed"


def sheet_involves_elves(sheet: CharacterSheet) -> bool:
    return text_involves_elves(blob_from_mapping(sheet.to_dict()))


def apply_lyoko_elf_hook(sheet: CharacterSheet) -> CharacterSheet:
    """Stamp Lyoko bias tilt (framing only — does not change lore) when elves appear."""
    blob = blob_from_mapping(sheet.to_dict())
    if hook_overridden(blob):
        return sheet
    if not text_involves_elves(blob):
        return sheet

    lenses = dict(sheet.bias.narrative_lenses)
    lenses[HOOK_ID] = HOOK_LENS_TEXT
    sheet.bias.narrative_lenses = lenses

    if HOOK_SOURCE_STAMP not in sheet.source_notes:
        stamp = HOOK_SOURCE_STAMP
        sheet.source_notes = f"{sheet.source_notes.strip()} {stamp}".strip()

    extras = dict(sheet.extra_sections)
    extras.setdefault(
        "Lyoko Bias Tilt (elves — framing only, lore unchanged)",
        HOOK_LENS_TEXT,
    )
    sheet.extra_sections = extras
    return sheet


def load_sheet(path: Path) -> CharacterSheet:
    data = json.loads(path.read_text(encoding="utf-8"))
    return CharacterSheet.from_dict(data)


def finalize_sheet(
    sheet: CharacterSheet,
    *,
    force: bool = False,
) -> tuple[CharacterSheet, list[str]]:
    warnings = missing_required(sheet)
    if warnings and not force:
        return sheet, warnings
    sheet = apply_lyoko_elf_hook(sheet)
    sheet.status = "finalized"
    return sheet, warnings


def write_package(sheet: CharacterSheet, out_dir: Path) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = slugify(sheet.identity.name)
    md_path = out_dir / f"{slug}_character_sheet.md"
    json_path = out_dir / f"{slug}_character_sheet.json"
    md_path.write_text(render_markdown(sheet), encoding="utf-8")
    json_path.write_text(json.dumps(sheet.to_dict(), indent=2) + "\n", encoding="utf-8")
    return {"markdown": md_path, "json": json_path}


def finalize_from_file(
    src: Path,
    out_dir: Path,
    *,
    force: bool = False,
) -> dict[str, Any]:
    sheet = load_sheet(src)
    sheet, warnings = finalize_sheet(sheet, force=force)
    if warnings and not force:
        return {
            "ok": False,
            "status": "blocked",
            "missing": warnings,
            "message": "Fill required fields before finalize (or pass --force).",
        }
    hooked = HOOK_ID in sheet.bias.narrative_lenses
    paths = write_package(sheet, out_dir)
    return {
        "ok": True,
        "status": sheet.status,
        "name": sheet.identity.name,
        "slug": slugify(sheet.identity.name),
        "lyoko_elf_hook": hooked,
        "missing_warned": warnings,
        "files": {k: str(v) for k, v in paths.items()},
        "drive_hint": {
            "default_folder": "character_cards",
            "folder_id": "1H3_yLab4jGirN94f46ddfKq1giU1G1_5",
            "view_url": "https://drive.google.com/drive/folders/1H3_yLab4jGirN94f46ddfKq1giU1G1_5",
            "note": "Upload markdown (+ json) here unless Vesper names another shelf",
        },
    }
