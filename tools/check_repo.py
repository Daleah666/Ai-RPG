#!/usr/bin/env python3
"""End-to-end check for the Ai-RPG documentation repository.

Ai-RPG has no application server, package manifest, or test runner. The
product is the handoff contract in docs/AI_HANDOFF_BRIDGE.md plus the
subliminal file format in skills/subliminal-maker-bot.md. This script is
the eval set for that contract:

  1. Every Markdown file opens with an H1 title.
  2. README.md live skills exist on disk.
  3. Concrete in-repo path references resolve.
  4. The maker skill's 7-day rotation parses.
  5. Today's subliminal file is drafted in memory and passes the maker rules.
  6. The validator rejects known-bad affirmation lines.

The draft is not written into subliminals/. Re-running changes nothing.
Standard library only. Exit 0 means the repository hangs together.
"""
from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path.cwd()

REQUIRED = (
    "README.md",
    "docs/AI_HANDOFF_BRIDGE.md",
    "docs/VESPER_SYSTEM_MAP.md",
    "docs/PRO_TIPS_FOR_LEADERS.md",
    "docs/tasks/SAMPLE_TASK.md",
    "docs/tasks/2026-09-17_companion-workspace-handoff.md",
    "skills/vesper-voice-master.md",
    "skills/subliminal-maker-bot.md",
    "skills/daily-subliminal-planner-bot.md",
    "subliminals/README.md",
    "subliminals/LOG.md",
    "automations/grok_skills/RETIRED.md",
    "automations/grok_skills/vesper_plain_speech_banlist.md",
)

BACKTICK_PATH = re.compile(r"`([A-Za-z0-9_./-]+\.(?:md|txt|json|py))`")
MD_LINK = re.compile(r"\]\(([^)]+)\)")
DATE_STAMP = re.compile(r"\d{4}-\d{2}-\d{2}")
ROTATION_ROW = re.compile(
    r"^\|\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\|\s*([^|]+?)\s*\|",
    re.MULTILINE,
)
BANNED = re.compile(
    r"\b(?:not|don't|dont|stop|never|won't|wont|can't|cant|no|cured|pain)\b",
    re.IGNORECASE,
)
FUTURE = re.compile(r"\b(?:will|want to|gonna)\b", re.IGNORECASE)
WORD = re.compile(r"[A-Za-z']+")

# Twelve present-tense lines per rotation day. Each stays under twelve words
# and avoids the maker bot's banned negatives and medical claims.
DRAFTS: dict[str, tuple[str, ...]] = {
    "Mon": (
        "My mind settles the moment I close my eyes.",
        "Calm arrives before I ask for it.",
        "Focus finds me without effort.",
        "Breathing slows as I soften.",
        "I drift inward with gentle ease.",
        "Stillness feels natural and close.",
        "My thoughts grow quiet and smooth.",
        "I enter trance with simple trust.",
        "Each breath deepens my calm focus.",
        "Soft attention stays with me.",
        "I rest inside clear quiet focus.",
        "Trance opens easily when I pause.",
    ),
    "Tue": (
        "My voice feels soft and easy.",
        "I move with gentle feminine ease.",
        "Expression flows from me naturally.",
        "My posture stays relaxed and pretty.",
        "Softness feels like home in me.",
        "I enjoy how I express myself.",
        "Grace shows up in small movements.",
        "My smile feels warm and sincere.",
        "I speak gently and feel heard.",
        "Ease lives in my body today.",
        "I like the woman I am becoming.",
        "Feminine expression feels simple and free.",
    ),
    "Wed": (
        "I notice what is going well.",
        "My mood lifts with small wins.",
        "I treat myself with kind respect.",
        "Good momentum follows my attention.",
        "I enjoy the work in front of me.",
        "Praise for myself comes easily.",
        "I keep a bright steady outlook.",
        "Joy finds room in my day.",
        "I feel proud of my effort.",
        "Hope sits quietly beside me.",
        "My thoughts lean toward what helps.",
        "I carry a light happy mind.",
    ),
    "Thu": (
        "I accept helpful suggestions with ease.",
        "My mind opens to gentle guidance.",
        "New habits settle in smoothly.",
        "I follow through with calm focus.",
        "Conditioning feels safe and welcome.",
        "Helpful ideas sink in deeply.",
        "I repeat what supports my growth.",
        "My inner voice stays kind.",
        "Practice makes this response natural.",
        "I trust the suggestions I choose.",
        "Each repetition strengthens my calm.",
        "I absorb useful ideas with ease.",
    ),
    "Fri": (
        "My body feels comfortable and aligned.",
        "I enjoy how I look today.",
        "Ease lives in my posture.",
        "I move with relaxed confidence.",
        "My style feels like me.",
        "Comfort wraps around my body.",
        "I stand tall with soft grace.",
        "My appearance pleases me today.",
        "Alignment feels natural and light.",
        "I care for my body kindly.",
        "Presence shows in how I stand.",
        "I feel at home in my body.",
    ),
    "Sat": (
        "I speak with calm and easy confidence.",
        "My posture stays open around other people.",
        "I enjoy being seen as I am.",
        "Warmth shows up in my voice.",
        "I meet new people with a soft smile.",
        "My words land clear and kind.",
        "I belong in the room I enter.",
        "Ease fills me when I greet someone.",
        "I share my thoughts without rushing.",
        "My presence feels steady and welcome.",
        "I listen fully and answer with poise.",
        "Comfort grows each time I connect.",
    ),
    "Sun": (
        "I rest and let lessons settle.",
        "My body softens into quiet recovery.",
        "Integration happens while I rest.",
        "I give myself gentle space.",
        "Calm stays with me as I pause.",
        "Today I restore my energy.",
        "Soft rest supports my progress.",
        "I release the rush of the week.",
        "My mind reviews the week kindly.",
        "Stillness helps everything fall into place.",
        "I welcome a slow peaceful day.",
        "Recovery feels natural and complete.",
    ),
}


def is_template(ref: str) -> bool:
    """Placeholder and example paths are not expected to exist yet."""
    if "YYYY" in ref or "MM-DD" in ref:
        return True
    if DATE_STAMP.search(ref):
        return True
    if "_batch_" in ref:
        return True
    if "/" not in ref:
        return True
    return False


def markdown_files() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*.md") if ".git" not in p.parts)


def check_required(failures: list[str]) -> int:
    found = 0
    for rel in REQUIRED:
        if (ROOT / rel).is_file():
            found += 1
        else:
            failures.append(f"missing required file: {rel}")
    return found


def check_h1_titles(files: list[Path], failures: list[str]) -> int:
    checked = 0
    for path in files:
        first = ""
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                first = line.strip()
                break
        checked += 1
        if not first.startswith("# "):
            rel = path.relative_to(ROOT)
            failures.append(f"{rel}: missing H1 title (first line: {first!r})")
    return checked


def check_live_skills(failures: list[str]) -> int:
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    skills = [s for s in BACKTICK_PATH.findall(text) if s.startswith("skills/")]
    if not skills:
        failures.append("README.md: no live skills listed under skills/")
        return 0
    for skill in skills:
        if not (ROOT / skill).is_file():
            failures.append(f"README.md advertises missing skill: {skill}")
    return len(skills)


def check_references(files: list[Path], failures: list[str]) -> tuple[int, int]:
    checked = 0
    skipped = 0
    for path in files:
        rel = path.relative_to(ROOT)
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
            if not (ROOT / ref).exists():
                failures.append(f"{rel}: broken reference -> {ref}")
    return checked, skipped


def check_log(failures: list[str]) -> None:
    log = (ROOT / "subliminals" / "LOG.md").read_text(encoding="utf-8")
    if not re.search(r"(?m)^\d{4}-\d{2}-\d{2} \| .+", log):
        failures.append("subliminals/LOG.md: no YYYY-MM-DD log line")
    bridge = (ROOT / "docs" / "AI_HANDOFF_BRIDGE.md").read_text(encoding="utf-8")
    for needle in ("docs/tasks/", "SECTION 3", "Status: OPEN"):
        if needle not in bridge:
            failures.append(f"docs/AI_HANDOFF_BRIDGE.md: missing {needle!r}")
    sample = (ROOT / "docs" / "tasks" / "SAMPLE_TASK.md").read_text(encoding="utf-8")
    for needle in ("## Status", "## Goal", "## Steps", "`OPEN`"):
        if needle not in sample:
            failures.append(f"docs/tasks/SAMPLE_TASK.md: missing {needle!r}")


def parse_rotation(failures: list[str]) -> dict[str, str]:
    text = (ROOT / "skills" / "subliminal-maker-bot.md").read_text(encoding="utf-8")
    found: dict[str, str] = {}
    for day, theme in ROTATION_ROW.findall(text):
        found[day] = theme.strip()
    if set(found) != set(DRAFTS):
        failures.append(
            "skills/subliminal-maker-bot.md: rotation days "
            f"{sorted(found)} != {sorted(DRAFTS)}"
        )
    return found


def line_errors(line: str) -> list[str]:
    errors: list[str] = []
    words = WORD.findall(line)
    if not words:
        errors.append("empty affirmation")
    if len(words) > 12:
        errors.append(f"{len(words)} words (max 12)")
    if BANNED.search(line):
        errors.append(f"banned wording: {BANNED.search(line).group(0)}")
    if FUTURE.search(line):
        errors.append(f"future wording: {FUTURE.search(line).group(0)}")
    return errors


def render_draft(day: str, theme: str, when: dt.date) -> str:
    lines = DRAFTS[day]
    header = "\n".join(
        (
            f"# Theme: {theme}",
            f"# Date: {when.isoformat()}",
            f"# Lines: {len(lines)}",
            "",
        )
    )
    return header + "\n".join(lines) + "\n"


def check_subliminal(rotation: dict[str, str], failures: list[str]) -> str:
    today = dt.date.today()
    day = today.strftime("%a")
    if day not in rotation:
        failures.append(f"no rotation theme for weekday {day}")
        return ""
    theme = rotation[day]
    draft = render_draft(day, theme, today)
    body = [ln for ln in draft.splitlines() if ln.strip() and not ln.startswith("#")]
    if not 12 <= len(body) <= 18:
        failures.append(f"draft line count {len(body)} outside 12-18")
    for ln in body:
        for err in line_errors(ln):
            failures.append(f"draft line {ln!r}: {err}")
    bad_samples = (
        "I don't procrastinate anymore.",
        "I will succeed today.",
        "I am cured of pain.",
    )
    for sample in bad_samples:
        if not line_errors(sample):
            failures.append(f"validator accepted bad line: {sample}")
    return draft


def main() -> int:
    if not (ROOT / "README.md").is_file():
        print("FAIL: run from the Ai-RPG repository root", file=sys.stderr)
        return 1

    failures: list[str] = []
    files = markdown_files()
    if not files:
        print("FAIL: no Markdown files found", file=sys.stderr)
        return 1

    required = check_required(failures)
    h1_count = check_h1_titles(files, failures)
    skill_count = check_live_skills(failures)
    ref_count, ref_skipped = check_references(files, failures)
    check_log(failures)
    rotation = parse_rotation(failures)
    draft = check_subliminal(rotation, failures) if rotation else ""

    print(f"Markdown files scanned:      {len(files)}")
    print(f"Required paths verified:     {required}")
    print(f"H1 titles verified:          {h1_count}")
    print(f"Live skills verified:        {skill_count}")
    print(f"Concrete references checked: {ref_count}")
    print(f"Template refs skipped:       {ref_skipped}")
    print(f"Rotation themes parsed:      {len(rotation)}")

    if failures:
        print(f"\nFAIL: {len(failures)} problem(s) found:")
        for item in failures:
            print(f"  - {item}")
        return 1

    print("\nPASS: repository contract holds.")
    print("\nDrafted today's subliminal in memory (not written to subliminals/):")
    print(draft, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
