#!/usr/bin/env python3
"""Check a MindZoom .txt file against the maker rules.

Header lines start with # and are ignored. Every other non-empty line
must be present-tense and free of the banned words. Exits 1 on failure.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

BANNED = re.compile(r"\b(not|don't|dont|stop|never|won't|wont|can't|cant)\b", re.IGNORECASE)
BLOCKED = re.compile(
    r"high\s*school|highschool|childhood|underage|preteen|jailbait|\bloli\b|\bshota\b",
    re.IGNORECASE,
)
MEDICAL = re.compile(r"\b(cured|diagnosis|pain-free|no pain)\b", re.IGNORECASE)


def check_text(text: str) -> list[str]:
    errors: list[str] = []
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lines.append(line)
        if BANNED.search(line):
            errors.append(f"banned word: {line}")
        if BLOCKED.search(line):
            errors.append(f"safety skip: {line}")
        if MEDICAL.search(line):
            errors.append(f"medical claim: {line}")
        if len(line.split()) > 16:
            errors.append(f"too long: {line}")
    if not lines:
        errors.append("no affirmation lines")
    if not (12 <= len(lines) <= 18):
        errors.append(f"expected 12 to 18 lines, found {len(lines)}")
    return errors


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        print("usage: validate_lines.py FILE.txt", file=sys.stderr)
        return 2
    path = Path(args[0])
    if BLOCKED.search(path.name):
        print(f"safety skip filename: {path.name}")
        return 1
    errors = check_text(path.read_text(encoding="utf-8"))
    if errors:
        print("\n".join(errors))
        return 1
    print(f"ok {path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
