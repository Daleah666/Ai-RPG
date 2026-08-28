"""Bot registry helpers."""

from __future__ import annotations

import json
from pathlib import Path

from .schema import BotProfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY_PATH = ROOT / "config" / "bots.registry.json"


def load_registry(path: Path | None = None) -> dict:
    target = path or DEFAULT_REGISTRY_PATH
    with target.open(encoding="utf-8") as fh:
        return json.load(fh)


def list_bots(path: Path | None = None) -> list[BotProfile]:
    data = load_registry(path)
    return [BotProfile.from_dict(item) for item in data.get("bots", [])]


def bot_ids(path: Path | None = None) -> list[str]:
    return [bot.id for bot in list_bots(path)]


def get_bot(bot_id: str, path: Path | None = None) -> BotProfile | None:
    for bot in list_bots(path):
        if bot.id == bot_id:
            return bot
    return None


def save_registry(data: dict, path: Path | None = None) -> Path:
    target = path or DEFAULT_REGISTRY_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return target


def upsert_bot(profile: BotProfile, path: Path | None = None) -> dict:
    data = load_registry(path)
    bots = data.setdefault("bots", [])
    for idx, existing in enumerate(bots):
        if existing.get("id") == profile.id:
            bots[idx] = profile.to_dict()
            break
    else:
        bots.append(profile.to_dict())
    save_registry(data, path)
    return data
