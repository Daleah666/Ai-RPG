#!/usr/bin/env python3
"""Repo integrity check for the Ai-RPG documentation/prompt repository.

This repo is documentation-only: every tracked file is Markdown. There is no
build, server, or test suite to run, so "does the repo hang together" is the
meaningful end-to-end check. This script encodes the conventions the repo
documents about itself (see docs/AI_HANDOFF_BRIDGE.md and
docs/PRO_TIPS_FOR_LEADERS.md, section 5 "Eval Sets"):

  1. Every Markdown file opens with an H1 title.
  2. The "live" skills advertised in README.md actually exist.
  3. Every concrete in-repo path referenced from prose resolves to a real file.

References that are clearly templates/examples (date-stamped or "YYYY-MM-DD"
placeholders, generated subliminal batches) and bare filenames (the retired
companion files, which the README notes were deleted on 2026-08-28) are
intentionally skipped rather than reported as broken.

Exit code 0 = all checks passed, 1 = one or more failures.
Standard library only; runs on the default Cloud Agent image.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Path-like reference inside backticks, e.g. `docs/VESPER_SYSTEM_MAP.md`.
BACKTICK_PATH = re.compile(r"`([A-Za-z0-9_./-]+\.(?:md|txt|json|py))`")
# Standard Markdown link target, e.g. [text](path).
MD_LINK = re.compile(r"\]\(([^)]+)\)")
# A YYYY-MM-DD date stamp anywhere in the reference.
DATE_STAMP = re.compile(r"\d{4}-\d{2}-\d{2}")


def is_template(ref: str) -> bool:
    """True for placeholder/example references not expected to exist on disk."""
    if "YYYY" in ref or "MM" in ref or "DD" in ref:
        return True
    if DATE_STAMP.search(ref):
        return True
    if "_batch_" in ref:
        return True
    # Bare filename (no directory): retired companions + naming templates.
    if "/" not in ref:
        return True
    return False


def markdown_files() -> list[Path]:
    return sorted(
        p
        for p in REPO_ROOT.rglob("*.md")
        if ".git" not in p.parts
    )


def check_h1_titles(files: list[Path], failures: list[str]) -> int:
    checked = 0
    for path in files:
        rel = path.relative_to(REPO_ROOT)
        first = ""
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                first = line.strip()
                break
        checked += 1
        if not first.startswith("# "):
            failures.append(f"{rel}: missing H1 title (first line: {first!r})")
    return checked


def check_live_skills(failures: list[str]) -> int:
    readme = REPO_ROOT / "README.md"
    text = readme.read_text(encoding="utf-8")
    skills = BACKTICK_PATH.findall(text)
    skills = [s for s in skills if s.startswith("skills/")]
    if not skills:
        failures.append("README.md: no live skills listed under skills/")
        return 0
    for skill in skills:
        if not (REPO_ROOT / skill).is_file():
            failures.append(f"README.md advertises missing skill: {skill}")
    return len(skills)


def check_references(files: list[Path], failures: list[str]) -> tuple[int, int]:
    checked = 0
    skipped = 0
    for path in files:
        rel = path.relative_to(REPO_ROOT)
        text = path.read_text(encoding="utf-8")
        refs = set(BACKTICK_PATH.findall(text))
        for target in MD_LINK.findall(text):
            target = target.strip()
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            refs.add(target.split("#", 1)[0])
        for ref in sorted(refs):
            if is_template(ref):
                skipped += 1
                continue
            checked += 1
            if not (REPO_ROOT / ref).exists():
                failures.append(f"{rel}: broken reference -> {ref}")
    return checked, skipped


def main() -> int:
    files = markdown_files()
    if not files:
        print("FAIL: no Markdown files found", file=sys.stderr)
        return 1

    failures: list[str] = []
    h1_count = check_h1_titles(files, failures)
    skill_count = check_live_skills(failures)
    ref_count, ref_skipped = check_references(files, failures)

    print(f"Markdown files scanned:      {len(files)}")
    print(f"H1 titles verified:          {h1_count}")
    print(f"Live skills verified:        {skill_count}")
    print(f"Concrete references checked: {ref_count}")
    print(f"Template refs skipped:       {ref_skipped}")

    if failures:
        print(f"\nFAIL: {len(failures)} problem(s) found:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nPASS: repository is internally consistent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
