"""Generate Nova's morning shared-Grok poll for Leader Vesper.

Reads automations/prompts/morning_vesper_poll.md shape and stamps today's date.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from automations.morning_poll.agent_parts import render_team_morning_parts

ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = ROOT / "automations" / "prompts" / "morning_vesper_poll.md"
PT = ZoneInfo("America/Los_Angeles")


def today_pt() -> datetime:
    return datetime.now(PT)


def date_stamp(when: datetime | None = None) -> str:
    return (when or today_pt()).strftime("%Y-%m-%d")


def file_stamp(when: datetime | None = None) -> str:
    return (when or today_pt()).strftime("%Y%m%d")


def _knobs_line() -> str:
    try:
        from leader_hq.knobs import summary

        s = summary()
        return (
            f"bias_tilt={s.get('bias_tilt')} strength={s.get('strength')} "
            f"({s.get('strength_label')}) unaware_rp={s.get('unaware_rp')}"
        )
    except Exception:
        return "knobs unavailable (defaults: closet / unaware_rp on)"


def _identity_line() -> str:
    try:
        from leader_hq.identity import load_identity

        ident = load_identity()
        return f"{ident.persona_name} / `{ident.ops_id}`"
    except Exception:
        return "Nova / `code_leader`"


def render_poll(*, when: datetime | None = None, with_team_parts: bool = True) -> str:
    """Build today's morning poll markdown."""
    when = when or today_pt()
    day = date_stamp(when)
    team = render_team_morning_parts() if with_team_parts else ""
    team_block = f"\n{team}\n" if team else ""
    return f"""# Nova morning poll → Leader Vesper (Grok)
from: code_leader (Nova)
to: leader_vesper
type: morning_poll
date: {day}
tz: America/Los_Angeles

Vesper — quick shared poll so I can plan the coding day. Reply under **Vesper answers** (or on the main bus Doc). Keep other work; clash → we talk.

## Poll (check / short answers)

1. **Priority lane today?**
   - [ ] coding / repos / LeaderHQ bus
   - [ ] lore / Lyoko (you name shelf)
   - [ ] subliminals / Hypno research
   - [ ] Drive hygiene (LeaderHQ bus only)
   - [ ] rest / no ask
   - [ ] other: ___

2. **Any coding REQUEST for me?** (one paragraph max)
   >

3. **Calendar / life blockers I should not step on?**
   >

4. **Lore shelf pointer** (only if Lyoko work today)
   - shelf_name:
   - drop_folder_id / drop_path:
   - place_mode: beside | inside | new_subfolder

5. **Knobs** (optional — director only; leave blank to keep closet defaults)
   - bias_tilt: on | off | _(blank)_
   - strength: 0–10 | _(blank)_
   - preset: closet | louder | off | _(blank)_

6. **Anything Clash-risk with your other bots?**
   >
{team_block}
## Nova standing status (auto)
- identity: {_identity_line()}
- team: drive_ops, gemini_worker, planner, hypno, lyoko
- layout: never move your already-organized files
- persona: unaware RP / bias tilt = framing only (no lore rewrite)
- knobs_now: {_knobs_line()}
- prompt: `automations/prompts/morning_vesper_poll.md`

## Vesper answers
_(Vesper fills below — after team morning parts if used)_
"""


def write_local(
    out_dir: Path,
    *,
    when: datetime | None = None,
) -> dict[str, Any]:
    when = when or today_pt()
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"{file_stamp(when)}_nova_morning_poll.md"
    path = out_dir / name
    text = render_poll(when=when)
    path.write_text(text, encoding="utf-8")
    return {
        "ok": True,
        "date": date_stamp(when),
        "filename": name,
        "path": str(path),
        "prompt": str(PROMPT_PATH),
        "bytes": len(text.encode("utf-8")),
    }
