"""Per-bot morning part stubs for the shared Grok poll."""

from __future__ import annotations

from typing import Any

# Each bot fills ONLY their section — Nova stitches the poll; Vesper steers.
MORNING_PARTS: dict[str, dict[str, Any]] = {
    "drive_ops": {
        "name": "Drive Ops",
        "lane": "LeaderHQ bus hygiene",
        "prompts": [
            "Unread in from_vesper / bot inboxes worth a glance?",
            "Any search_jobs or dump/INGEST_LOG lines since yesterday?",
            "Drive blockers (permissions, missing folder)?",
        ],
    },
    "gemini_worker": {
        "name": "Gemini Worker",
        "lane": "Heavy drafting queue",
        "prompts": [
            "Draft/summarize/rewrite ready if Vesper picks coding lane?",
            "One sentence on what you'd tackle first today.",
        ],
    },
    "planner": {
        "name": "Planner",
        "lane": "Task graph",
        "prompts": [
            "Top 3 tasks for Nova today (if any goal is active).",
            "Which bot owns each? priority 1–3?",
        ],
    },
    "hypno": {
        "name": "Hypno",
        "lane": "Subliminal / audio research",
        "prompts": [
            "Formula or preset mode in progress?",
            "Research ask for Vesper / Subliminal Maker today?",
        ],
    },
    "lyoko": {
        "name": "Lyoko",
        "lane": "Lore / worldbuilding",
        "prompts": [
            "Open lore thread or character note?",
            "Shelf Vesper should point at if lore lane today (name only — she sets drop).",
        ],
    },
    "memory_sponge": {
        "name": "Memory Sponge",
        "lane": "Echo receiver (Grok)",
        "prompts": [
            "Shards ingested overnight from artifacts/agent_memory?",
            "Dominant lean carried into today's echo (one line).",
        ],
        "note": "Grok-side only; fills after other agents drop MEMORY_SHARD or morning part text.",
    },
}


def render_agent_part(bot_id: str, *, filled: str = "") -> str:
    """Render one bot's morning section (empty stub or filled body)."""
    spec = MORNING_PARTS.get(bot_id)
    if not spec:
        return f"### {bot_id}\n_(unknown bot — skip)_\n"

    lines = [
        f"### {spec['name']} (`{bot_id}`)",
        f"_lane: {spec['lane']}_",
        "",
    ]
    for i, q in enumerate(spec["prompts"], 1):
        lines.append(f"{i}. {q}")
        lines.append("   >")
        lines.append("")
    if spec.get("note"):
        lines.append(f"_note: {spec['note']}_")
        lines.append("")
    if filled.strip():
        lines.append("**filled:**")
        lines.append(filled.strip())
        lines.append("")
    return "\n".join(lines)


def render_team_morning_parts(*, include_sponge: bool = True) -> str:
    """All bot morning sections — empty for agents to fill on their parts."""
    order = ["drive_ops", "gemini_worker", "planner", "hypno", "lyoko"]
    if include_sponge:
        order.append("memory_sponge")

    blocks = [
        "## Team morning parts",
        "",
        "_Each agent fills **only their** subsection. Nova posts; Vesper reads all._",
        "",
    ]
    for bot_id in order:
        blocks.append(render_agent_part(bot_id))
    return "\n".join(blocks)


def memory_shard_from_part(
    bot_id: str,
    *,
    filled_text: str,
    shard_date: str,
    seq: int = 1,
) -> str:
    """Convert a filled morning part into a MEMORY_SHARD for Memory Sponge."""
    spec = MORNING_PARTS.get(bot_id, {})
    name = spec.get("name", bot_id)
    lane = spec.get("lane", "morning")
    sid = f"ms_{shard_date.replace('-', '')}_{bot_id}_{seq:03d}"
    return f"""# MEMORY_SHARD
shard_id: {sid}
from_agent: {bot_id}
to_agent: memory_sponge
weight: heavy
voice: expressive_talkative
tags: morning_part, {lane.replace(' ', '_')}

## Facts (canonical for sponge)
- morning_part from {name}
- date: {shard_date}

## Tone / lean (act this, don't announce)
- inherit {name}'s lane voice from filled part below

## Open threads
- see filled morning part

## Raw excerpt (morning part)
> {filled_text.strip().replace(chr(10), chr(10) + '> ')}
"""
