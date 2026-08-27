"""Smart lore categorizer — suggest shelf/subfolder; Vesper still confirms placement."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

TAXONOMY_PATH = Path(__file__).with_name("taxonomy.json")


@dataclass
class CategoryScore:
    id: str
    label: str
    score: int
    matched_keywords: list[str] = field(default_factory=list)
    filename_prefix: str = ""
    subfolder: str = ""


@dataclass
class CategorizeResult:
    title: str
    top: CategoryScore | None
    scores: list[CategoryScore]
    suggested_filename: str
    suggested_relative_path: str
    confidence: float
    needs_vesper_confirm: bool
    default_shelf: dict[str, str]
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        return data


def load_taxonomy(path: Path | None = None) -> dict[str, Any]:
    target = path or TAXONOMY_PATH
    return json.loads(target.read_text(encoding="utf-8"))


def _tokenize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower())


def score_text(text: str, taxonomy: dict[str, Any] | None = None) -> list[CategoryScore]:
    tax = taxonomy or load_taxonomy()
    blob = _tokenize(text)
    scores: list[CategoryScore] = []
    for cat in tax["categories"]:
        matched: list[str] = []
        score = 0
        for kw in cat.get("keywords") or []:
            if kw.lower() in blob:
                matched.append(kw)
                # multi-word keywords weigh a bit more
                score += 2 if " " in kw else 1
        scores.append(
            CategoryScore(
                id=cat["id"],
                label=cat["label"],
                score=score,
                matched_keywords=matched,
                filename_prefix=cat.get("filename_prefix", "99"),
                subfolder=cat.get("subfolder", "inbox_unsorted"),
            )
        )
    scores.sort(key=lambda s: (-s.score, s.id))
    return scores


def slugify(title: str) -> str:
    text = title.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_") or "lore_entry"


def categorize(
    text: str,
    *,
    title: str = "",
    taxonomy: dict[str, Any] | None = None,
) -> CategorizeResult:
    tax = taxonomy or load_taxonomy()
    scores = score_text(text if not title else f"{title}\n{text}", tax)
    top = scores[0] if scores else None
    # If best score is 0, force uncategorized
    if top and top.score <= 0:
        top = next((s for s in scores if s.id == "uncategorized"), top)
    total = sum(s.score for s in scores) or 1
    confidence = (top.score / total) if top else 0.0
    # Low confidence or uncategorized → Vesper must confirm
    needs = (not top) or top.id == "uncategorized" or top.score < 2 or confidence < 0.45
    base_title = title.strip() or "untitled_lore"
    suggested_filename = f"{top.filename_prefix}_{slugify(base_title)}.md" if top else f"99_{slugify(base_title)}.md"
    suggested_relative_path = f"{top.subfolder}/{suggested_filename}" if top else f"inbox_unsorted/{suggested_filename}"
    reasons = []
    if top:
        if top.matched_keywords:
            reasons.append(f"matched: {', '.join(top.matched_keywords[:8])}")
        else:
            reasons.append("no keyword hits — uncategorized")
        reasons.append(f"confidence={confidence:.2f}")
    return CategorizeResult(
        title=base_title,
        top=top,
        scores=scores[:5],
        suggested_filename=suggested_filename,
        suggested_relative_path=suggested_relative_path,
        confidence=round(confidence, 3),
        needs_vesper_confirm=needs,
        default_shelf=dict(tax.get("default_shelf") or {}),
        reasons=reasons,
    )


def categorize_file(path: Path) -> CategorizeResult:
    text = path.read_text(encoding="utf-8")
    return categorize(text, title=path.stem)
