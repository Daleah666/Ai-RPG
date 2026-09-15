"""Vesper memory vault — COPY ONLY. Never deletes source files.

Collects what she gave you into a durable index + optional local mirror.
Live Drive sources stay exactly where they are.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DRIVE_IDS = ROOT / "config" / "drive_ids.json"

# Known Vesper → you memory lanes (read-only inventory)
VAULT_SOURCES: list[dict[str, str]] = [
    {
        "id": "from_vesper",
        "label": "LeaderHQ / from_vesper (her orders & asks)",
        "folder_id": "1b_QJQoQSo2XT79sW76qWq5QlOXobvMDF",
        "url": "https://drive.google.com/drive/folders/1b_QJQoQSo2XT79sW76qWq5QlOXobvMDF",
    },
    {
        "id": "to_vesper",
        "label": "LeaderHQ / to_vesper (Nova replies she can see)",
        "folder_id": "1eBAIPHizzJk_5iHmLubZanAjoLb5Nc7X",
        "url": "https://drive.google.com/drive/folders/1eBAIPHizzJk_5iHmLubZanAjoLb5Nc7X",
    },
    {
        "id": "from_grok_memory",
        "label": "LeaderHQ / from_grok_memory",
        "folder_id": "1QvkEQWWQCJ8F2KzaUvm9DsnkU5Q7SCoY",
        "url": "https://drive.google.com/drive/folders/1QvkEQWWQCJ8F2KzaUvm9DsnkU5Q7SCoY",
    },
    {
        "id": "to_grok_memory",
        "label": "LeaderHQ / to_grok_memory",
        "folder_id": "1WB_Xb7x0QJs9nA3UW-i8tpfP37r_HMZM",
        "url": "https://drive.google.com/drive/folders/1WB_Xb7x0QJs9nA3UW-i8tpfP37r_HMZM",
    },
    {
        "id": "nova_ai_data",
        "label": "Nova Ai Data (shared root)",
        "folder_id": "1UUL5HuzxICq22qXwovlFWfdE5e3Zfs9c",
        "url": "https://drive.google.com/drive/folders/1UUL5HuzxICq22qXwovlFWfdE5e3Zfs9c",
    },
    {
        "id": "vesper_memory_vault",
        "label": "VESPER_MEMORY_VAULT (this archive — drops land here)",
        "folder_id": "1xe30QIiCg0gMCmHUQf-Q9g5ORfqEgqJf",
        "url": "https://drive.google.com/drive/folders/1xe30QIiCg0gMCmHUQf-Q9g5ORfqEgqJf",
    },
    {
        "id": "bus_doc",
        "label": "Vesper-Nova main bus Doc",
        "folder_id": "1E4tAnjogxBI-FZN5oSwPJ2TXE7mWdz3EL69FzsBd4Xc",
        "url": "https://docs.google.com/document/d/1E4tAnjogxBI-FZN5oSwPJ2TXE7mWdz3EL69FzsBd4Xc/edit",
    },
    {
        "id": "cursor_daily",
        "label": "CURSOR_DAILY.md",
        "folder_id": "10s8jaJgRxtkOOUo8QkyxBbZ8pXAfiBsA",
        "url": "https://drive.google.com/file/d/10s8jaJgRxtkOOUo8QkyxBbZ8pXAfiBsA/view",
    },
    {
        "id": "vesper_nova",
        "label": "VESPER_NOVA.md handshake",
        "folder_id": "10-lQySrfu-oIMjivOjLQWEpfur0eg4e4",
        "url": "https://drive.google.com/file/d/10-lQySrfu-oIMjivOjLQWEpfur0eg4e4/view",
    },
]


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def render_index(*, extra_notes: str = "") -> str:
    """Markdown index of where her memory lives. Never deletes anything."""
    lines = [
        "# Vesper Memory Vault — INDEX",
        "",
        f"generated: {stamp()}",
        "mode: **COPY / CATALOG ONLY — never delete sources**",
        "",
        "This vault collects what she gave you so you can turn skills OFF",
        "without losing the good stuff. Originals stay where they are.",
        "",
        "## How to add more (without deleting)",
        "",
        "1. Paste a chat memory into `chat_drops/` as `YYYYMMDD_vesper_drop.md`",
        "2. Or ask Nova: `memory-vault drop --title \"…\" --text \"…\"`",
        "3. Or in Grok: copy important lines → save to Drive vault `chat_drops/`",
        "",
        "## Live source lanes (do not trash)",
        "",
    ]
    for src in VAULT_SOURCES:
        lines.append(f"- **{src['label']}**")
        lines.append(f"  - {src['url']}")
        lines.append("")
    if extra_notes.strip():
        lines.append("## Notes")
        lines.append("")
        lines.append(extra_notes.strip())
        lines.append("")
    lines.append("## Hard rules")
    lines.append("")
    lines.append("- Never delete `from_vesper`, lore shelves, or Grok chat")
    lines.append("- Vault = extra copies + index links")
    lines.append("- Skills OFF ≠ memory gone if you dropped it here first")
    lines.append("")
    return "\n".join(lines)


def write_local_index(out_dir: Path, *, extra_notes: str = "") -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"{stamp()}_vesper_memory_index.md"
    path = out_dir / name
    text = render_index(extra_notes=extra_notes)
    path.write_text(text, encoding="utf-8")
    # also keep a stable latest pointer
    latest = out_dir / "LATEST_INDEX.md"
    latest.write_text(text, encoding="utf-8")
    return {
        "ok": True,
        "mode": "copy_only",
        "deleted": False,
        "path": str(path),
        "latest": str(latest),
        "vault_folder": "https://drive.google.com/drive/folders/1xe30QIiCg0gMCmHUQf-Q9g5ORfqEgqJf",
        "sources": len(VAULT_SOURCES),
    }


def write_drop(out_dir: Path, *, title: str, text: str, tags: str = "") -> dict[str, Any]:
    """Save a pasted memory drop locally (copy into vault later / upload)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in title)[:60] or "drop"
    name = f"{stamp()}_{safe}.md"
    path = out_dir / name
    body = f"""# Vesper memory drop
title: {title}
saved: {stamp()}
tags: {tags or "vesper, keep"}
source: user_paste
mode: COPY ONLY — originals not deleted

---

{text.strip()}
"""
    path.write_text(body, encoding="utf-8")
    return {
        "ok": True,
        "mode": "copy_only",
        "deleted": False,
        "path": str(path),
        "filename": name,
        "upload_hint": "Upload this file to Drive VESPER_MEMORY_VAULT/chat_drops/",
    }


def catalog_payload() -> dict[str, Any]:
    return {
        "mode": "copy_only",
        "never_delete": True,
        "vault_folder_id": "1xe30QIiCg0gMCmHUQf-Q9g5ORfqEgqJf",
        "sources": VAULT_SOURCES,
    }
