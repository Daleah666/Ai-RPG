"""Finalize a character into a full Heroic Chronicles sheet package."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .render import render_markdown
from .schema import CharacterSheet, missing_required


def slugify(name: str) -> str:
    text = name.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_") or "unnamed"


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
    paths = write_package(sheet, out_dir)
    return {
        "ok": True,
        "status": sheet.status,
        "name": sheet.identity.name,
        "slug": slugify(sheet.identity.name),
        "missing_warned": warnings,
        "files": {k: str(v) for k, v in paths.items()},
        "drive_hint": {
            "default_folder": "character_cards",
            "folder_id": "1H3_yLab4jGirN94f46ddfKq1giU1G1_5",
            "view_url": "https://drive.google.com/drive/folders/1H3_yLab4jGirN94f46ddfKq1giU1G1_5",
            "note": "Upload markdown (+ json) here unless Vesper names another shelf",
        },
    }
