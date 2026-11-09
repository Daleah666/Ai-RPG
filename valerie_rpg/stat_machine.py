"""The only math for Valerie's body and the JRPG scale around her.

Level is 1 to 100. Attributes are 0 to 1000. HP and MP grow into the millions.
Stress stays on a 0 to 200 bar. Valerie does not see Luck, Stress, accuracy,
or these function names. She reports the belief string, when there is one.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, fields, replace
from enum import Enum
from pathlib import Path
from typing import Any

STAT_MIN = 0
STAT_MAX = 1000
LEVEL_MIN = 1
LEVEL_MAX = 100
STRESS_MIN = 0
STRESS_MAX = 200
STRESS_BREAK = 100
HIT_FLOOR = 5
HIT_CAP = 95
VARIANCE_MIN = 0.9
VARIANCE_MAX = 1.1
FEAR_READ_LOW = 40
RALLY_ACCURACY = 10
RALLY_STRESS_RESIST = 15
BEFUDDLE_PENALTY = 25
ARROW_VOICE = "Ow— hey! I bounced it off! Just being a good hero!"

STAT_FIELDS = (
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
    "accuracy",
    "evasion",
    "willpower",
    "mind",
    "luck",
    "speed",
    "magic",
)

KNOWN_STATS = frozenset(STAT_FIELDS)
KNOWN_PROCS = frozenset(
    {
        "kinetic_deflection",
        "chaos_wave",
        "unintentional_dodge",
        "befuddle",
        "rally",
        "pocket",
    }
)
EVENT_FIELDS = frozenset({"id", "when", "card_text", "checks", "on_success", "on_fail"})
EVENTS_DIR = Path(__file__).resolve().parent / "events"


class EventError(ValueError):
    """A plug-in event broke the stat-machine contract."""


class BindPart(Enum):
    ARMS = "arms"
    LEGS = "legs"
    HEAD = "head"


class BreakKind(Enum):
    AFFLICTION = "affliction"
    VIRTUE = "virtue"


def _reject_bool(value: object, label: str) -> None:
    if isinstance(value, bool):
        raise ValueError(f"{label} must be an integer")


def _check_int(value: object, label: str) -> int:
    _reject_bool(value, label)
    if not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    return value


def _check_nonneg(value: object, label: str) -> int:
    number = _check_int(value, label)
    if number < 0:
        raise ValueError(f"{label} must be >= 0")
    return number


def _check_level(level: object) -> int:
    number = _check_int(level, "level")
    if not LEVEL_MIN <= number <= LEVEL_MAX:
        raise ValueError(f"level must be {LEVEL_MIN} to {LEVEL_MAX}")
    return number


def _check_roll(roll: object) -> int:
    number = _check_int(roll, "roll")
    if not 1 <= number <= 100:
        raise ValueError("roll must be a d100 from 1 to 100")
    return number


def _check_variance(variance: object) -> float:
    if isinstance(variance, bool) or not isinstance(variance, (int, float)):
        raise ValueError("variance must be a number from 0.9 to 1.1")
    number = float(variance)
    if number < VARIANCE_MIN or number > VARIANCE_MAX:
        raise ValueError("variance must be between 0.9 and 1.1")
    return number


def _check_stress(current: object) -> int:
    number = _check_int(current, "stress")
    if not STRESS_MIN <= number <= STRESS_MAX:
        raise ValueError(f"stress must be {STRESS_MIN} to {STRESS_MAX}")
    return number


@dataclass(frozen=True)
class StatBlock:
    strength: int
    dexterity: int
    constitution: int
    intelligence: int
    wisdom: int
    charisma: int
    accuracy: int
    evasion: int
    willpower: int
    mind: int
    luck: int
    speed: int
    magic: int

    def __post_init__(self) -> None:
        for name in STAT_FIELDS:
            value = getattr(self, name)
            _check_int(value, name)
            if not STAT_MIN <= value <= STAT_MAX:
                raise ValueError(f"{name} must be {STAT_MIN} to {STAT_MAX}")


@dataclass(frozen=True)
class ProcResult:
    name: str
    belief: str | None
    self_damage: int = 0
    reflected_damage: int = 0
    hit: bool | None = None
    knockdown: bool = False
    device_trigger: bool = False
    coordination_penalty: int = 0
    penalized_accuracy: int | None = None
    accuracy_bonus: int = 0
    stress_resist_bonus: int = 0
    item_returned: str | None = None

    def machine_line(self) -> str:
        if self.name == "kinetic_deflection":
            return (
                f"kinetic_deflection self_damage={self.self_damage} "
                f"reflected_damage={self.reflected_damage}"
            )
        if self.name == "chaos_wave":
            return (
                f"chaos_wave knockdown={str(self.knockdown).lower()} "
                f"device_trigger={str(self.device_trigger).lower()}"
            )
        if self.name == "unintentional_dodge":
            return f"unintentional_dodge hit={str(self.hit).lower()}"
        if self.name == "befuddle":
            return (
                f"befuddle coordination_penalty={self.coordination_penalty} "
                f"penalized_accuracy={self.penalized_accuracy}"
            )
        if self.name == "rally":
            return (
                f"rally accuracy_bonus={self.accuracy_bonus} "
                f"stress_resist_bonus={self.stress_resist_bonus}"
            )
        if self.name == "pocket":
            return f"pocket item_returned={self.item_returned}"
        raise AssertionError(f"unhandled proc {self.name}")


@dataclass(frozen=True)
class StressGain:
    before: int
    after: int
    taken: int
    breaking: BreakKind | None


@dataclass(frozen=True)
class ArchetypeCurve:
    name: str
    start: StatBlock
    cap: StatBlock
    luck_hidden: bool = False


@dataclass(frozen=True)
class EventContext:
    stats: StatBlock
    roll: int = 50
    power: int = 100
    attack: int = 100
    defense: int = 100
    variance: float = 1.0
    item: str = ""
    item_lost: bool = False
    item_needed: bool = False
    body_check_failed: bool = False
    fear_read: int = 100
    lethal_threat: bool = False
    wave_accuracy: int = 100
    wave_evasion: int = 100
    wave_roll: int = 50
    device_present: bool = False
    enemy_accuracy: int = 100
    befuddle_penalty: int = BEFUDDLE_PENALTY


@dataclass(frozen=True)
class EventOutcome:
    id: str
    when: str
    success: bool
    card_text: str
    branch_text: str
    procs: tuple[ProcResult, ...]


def _block(
    strength: int,
    dexterity: int,
    constitution: int,
    intelligence: int,
    wisdom: int,
    charisma: int,
    accuracy: int,
    evasion: int,
    willpower: int,
    mind: int,
    luck: int,
    speed: int,
    magic: int,
) -> StatBlock:
    return StatBlock(
        strength=strength,
        dexterity=dexterity,
        constitution=constitution,
        intelligence=intelligence,
        wisdom=wisdom,
        charisma=charisma,
        accuracy=accuracy,
        evasion=evasion,
        willpower=willpower,
        mind=mind,
        luck=luck,
        speed=speed,
        magic=magic,
    )


ARCHETYPES: dict[str, ArchetypeCurve] = {
    "Warrior": ArchetypeCurve(
        name="Warrior",
        start=_block(180, 70, 160, 40, 60, 50, 120, 70, 90, 40, 40, 80, 30),
        cap=_block(1000, 420, 920, 220, 380, 340, 800, 400, 720, 260, 280, 480, 180),
    ),
    "Mage": ArchetypeCurve(
        name="Mage",
        start=_block(40, 60, 70, 190, 140, 80, 100, 50, 110, 190, 50, 60, 180),
        cap=_block(240, 380, 460, 1000, 860, 640, 760, 340, 840, 1000, 420, 400, 1000),
    ),
    "Rogue": ArchetypeCurve(
        name="Rogue",
        start=_block(80, 180, 80, 70, 80, 70, 160, 180, 60, 50, 120, 180, 40),
        cap=_block(560, 1000, 540, 460, 500, 480, 960, 1000, 500, 340, 820, 1000, 240),
    ),
    "Radiant Rose": ArchetypeCurve(
        name="Radiant Rose",
        luck_hidden=True,
        start=_block(150, 36, 120, 24, 36, 160, 40, 30, 70, 28, 480, 42, 20),
        cap=_block(880, 150, 740, 80, 170, 960, 210, 140, 460, 130, 1000, 250, 70),
    ),
}

ARCHETYPE_NAMES = tuple(ARCHETYPES)


def damage(power: int, attack: int, defense: int, variance: float = 1.0) -> int:
    """Floor of power * attack / (attack + defense) * variance, minimum 1."""
    power = _check_nonneg(power, "power")
    attack = _check_nonneg(attack, "attack")
    defense = _check_nonneg(defense, "defense")
    variance = _check_variance(variance)
    denom = attack + defense
    if denom == 0:
        return 1
    raw = power * attack / denom * variance
    return max(1, math.floor(raw))


def hit_chance(accuracy: int, evasion: int) -> int:
    """d100 chance, clamped to 5–95. A natural 1 or 100 is handled in resolve_hit."""
    accuracy = _check_int(accuracy, "accuracy")
    evasion = _check_int(evasion, "evasion")
    chance = 50 + math.floor((accuracy - evasion) / 25)
    return max(HIT_FLOOR, min(HIT_CAP, chance))


def resolve_hit(accuracy: int, evasion: int, roll: int) -> bool:
    """True when the d100 roll hits. 1 always misses. 100 always hits."""
    roll = _check_roll(roll)
    if roll == 1:
        return False
    if roll == 100:
        return True
    return roll <= hit_chance(accuracy, evasion)


def stress_taken(flat: int, willpower: int) -> int:
    """Willpower 1000 removes half of a flat stress hit. Willpower 0 removes none."""
    flat = _check_nonneg(flat, "flat")
    willpower = _check_nonneg(willpower, "willpower")
    if flat == 0:
        return 0
    reduction = math.floor(flat * willpower / (willpower + 1000))
    return max(0, flat - reduction)


def stress_after_resist(taken: int, resist: int) -> int:
    taken = _check_nonneg(taken, "taken")
    resist = _check_nonneg(resist, "resist")
    return max(0, taken - resist)


def breaking_point(roll: int) -> BreakKind:
    """1–75 affliction. 76–100 virtue. Call this only when Stress crosses 100."""
    roll = _check_roll(roll)
    if roll <= 75:
        return BreakKind.AFFLICTION
    return BreakKind.VIRTUE


def gain_stress(
    current: int,
    flat: int,
    willpower: int,
    roll: int | None = None,
) -> StressGain:
    """Add stress, clamp to 0–200, and roll a break only on the crossing of 100."""
    current = _check_stress(current)
    taken = stress_taken(flat, willpower)
    after = max(STRESS_MIN, min(STRESS_MAX, current + taken))
    breaking = None
    if current < STRESS_BREAK <= after:
        if roll is None:
            raise ValueError("crossing 100 Stress requires a d100 roll")
        breaking = breaking_point(roll)
    return StressGain(before=current, after=after, taken=taken, breaking=breaking)


def exp_to_next(level: int) -> int:
    """Quadratic cost of the next level. Level 100 is the cap and costs 0."""
    level = _check_level(level)
    if level >= LEVEL_MAX:
        return 0
    return math.floor(40 * level * level + 80 * level)


def _bar_max(level: int, attribute: int) -> int:
    level = _check_level(level)
    attribute = _check_nonneg(attribute, "attribute")
    return math.floor((50 + attribute) * (level ** 1.6))


def hp_max(level: int, constitution: int) -> int:
    return _bar_max(level, constitution)


def mp_max(level: int, mind: int) -> int:
    return _bar_max(level, mind)


def bind_fields(part: BindPart) -> tuple[str, ...]:
    if part is BindPart.ARMS:
        return ("strength", "accuracy")
    if part is BindPart.LEGS:
        return ("dexterity", "evasion", "speed")
    if part is BindPart.HEAD:
        return ("intelligence", "wisdom", "magic")
    raise AssertionError(f"unhandled bind {part!r}")


def apply_bind(stats: StatBlock, part: BindPart) -> StatBlock:
    """Halve the stats that part locks. Integer division. Chest is not a bind."""
    if not isinstance(part, BindPart):
        raise ValueError("part must be a BindPart")
    updates = {name: getattr(stats, name) // 2 for name in bind_fields(part)}
    return replace(stats, **updates)


def scale_stat(start: int, cap: int, level: int) -> int:
    level = _check_level(level)
    start = _check_int(start, "start")
    cap = _check_int(cap, "cap")
    grown = start + (cap - start) * (level - 1) // 99
    if not STAT_MIN <= grown <= STAT_MAX:
        raise ValueError("scaled stat left the 0–1000 range")
    return grown


def archetype_at(name: str, level: int) -> StatBlock:
    try:
        curve = ARCHETYPES[name]
    except KeyError as exc:
        known = ", ".join(ARCHETYPE_NAMES)
        raise ValueError(f"unknown archetype {name!r}; known: {known}") from exc
    values = {
        name_field: scale_stat(
            getattr(curve.start, name_field),
            getattr(curve.cap, name_field),
            level,
        )
        for name_field in STAT_FIELDS
    }
    return StatBlock(**values)


def creator_sheet(name: str, level: int) -> dict[str, int | bool]:
    """Radiant Rose omits Luck. She cannot see it. Creators use archetype_at for the real block."""
    block = archetype_at(name, level)
    sheet: dict[str, int | bool] = {name_field: getattr(block, name_field) for name_field in STAT_FIELDS}
    if ARCHETYPES[name].luck_hidden:
        del sheet["luck"]
        sheet["luck_hidden"] = True
    return sheet


def kinetic_deflection(
    power: int,
    attack: int,
    defense: int,
    variance: float = 1.0,
) -> ProcResult:
    reflected = damage(power, attack, defense, variance)
    return ProcResult(
        name="kinetic_deflection",
        belief="I bounced it off.",
        self_damage=0,
        reflected_damage=reflected,
    )


def chaos_wave(
    wave_accuracy: int,
    wave_evasion: int,
    wave_roll: int,
    device_present: bool,
) -> ProcResult:
    return ProcResult(
        name="chaos_wave",
        belief="I tripped.",
        knockdown=resolve_hit(wave_accuracy, wave_evasion, wave_roll),
        device_trigger=bool(device_present),
    )


def unintentional_dodge(body_check_failed: bool) -> ProcResult:
    if body_check_failed:
        return ProcResult(name="unintentional_dodge", belief="I'm agile.", hit=False)
    return ProcResult(name="unintentional_dodge", belief=None, hit=True)


def befuddle(enemy_accuracy: int, penalty: int = BEFUDDLE_PENALTY) -> ProcResult:
    enemy_accuracy = _check_nonneg(enemy_accuracy, "enemy_accuracy")
    penalty = _check_nonneg(penalty, "penalty")
    return ProcResult(
        name="befuddle",
        belief=None,
        coordination_penalty=penalty,
        penalized_accuracy=max(0, enemy_accuracy - penalty),
    )


def rally(fear_read: int, lethal_threat: bool) -> ProcResult:
    fear_read = _check_nonneg(fear_read, "fear_read")
    if lethal_threat and fear_read < FEAR_READ_LOW:
        return ProcResult(
            name="rally",
            belief="They like my speech.",
            accuracy_bonus=RALLY_ACCURACY,
            stress_resist_bonus=RALLY_STRESS_RESIST,
        )
    return ProcResult(name="rally", belief=None)


def pocket(item: str, lost: bool, needed: bool) -> ProcResult:
    if lost and needed and item.strip():
        return ProcResult(
            name="pocket",
            belief="I'm good at finding things.",
            item_returned=item,
        )
    return ProcResult(name="pocket", belief=None, item_returned=None)


def arrow_beat(power: int, attack: int, defense: int, variance: float = 1.0) -> dict[str, object]:
    """One fight beat: her mouth, then the machine line."""
    result = kinetic_deflection(power, attack, defense, variance)
    return {
        "voice": ARROW_VOICE,
        "belief": result.belief,
        "machine": result.machine_line(),
        "self_damage": result.self_damage,
        "reflected_damage": result.reflected_damage,
    }


def _proc_succeeded(result: ProcResult) -> bool:
    if result.name == "kinetic_deflection":
        return result.self_damage == 0 and result.reflected_damage >= 1
    if result.name == "chaos_wave":
        return result.knockdown or result.device_trigger
    if result.name == "unintentional_dodge":
        return result.hit is False
    if result.name == "befuddle":
        return result.coordination_penalty > 0
    if result.name == "rally":
        return result.accuracy_bonus > 0
    if result.name == "pocket":
        return result.item_returned is not None
    raise AssertionError(f"unhandled proc {result.name}")


def run_proc(name: str, ctx: EventContext, check: dict[str, Any] | None = None) -> ProcResult:
    if name not in KNOWN_PROCS:
        raise EventError(f"unknown proc {name!r}")
    check = check or {}
    if name == "kinetic_deflection":
        return kinetic_deflection(ctx.power, ctx.attack, ctx.defense, ctx.variance)
    if name == "chaos_wave":
        return chaos_wave(ctx.wave_accuracy, ctx.wave_evasion, ctx.wave_roll, ctx.device_present)
    if name == "unintentional_dodge":
        return unintentional_dodge(ctx.body_check_failed)
    if name == "befuddle":
        return befuddle(ctx.enemy_accuracy, ctx.befuddle_penalty)
    if name == "rally":
        return rally(ctx.fear_read, ctx.lethal_threat)
    if name == "pocket":
        item = check.get("item", ctx.item)
        if not isinstance(item, str):
            raise EventError("pocket item must be a string")
        return pocket(item, ctx.item_lost, ctx.item_needed)
    raise AssertionError(f"unhandled proc {name}")


def _validate_branch(branch: object, label: str) -> None:
    if isinstance(branch, str):
        if not branch.strip():
            raise EventError(f"{label} text is empty")
        return
    if not isinstance(branch, dict):
        raise EventError(f"{label} must be a string or an object with text")
    extra = set(branch) - {"text", "proc"}
    if extra:
        raise EventError(f"{label} has unknown fields: {sorted(extra)}")
    text = branch.get("text")
    if not isinstance(text, str) or not text.strip():
        raise EventError(f"{label} needs non-empty text")
    if "proc" in branch and branch["proc"] not in KNOWN_PROCS:
        raise EventError(f"{label} names unknown proc {branch['proc']!r}")


def _validate_check(check: object) -> None:
    if not isinstance(check, dict):
        raise EventError("each check must be an object")
    has_stat = "stat" in check
    has_proc = "proc" in check
    if has_stat == has_proc:
        raise EventError("a check names a stat or a proc, not both and not neither")
    if has_stat:
        extra = set(check) - {"stat", "dc"}
        if extra:
            raise EventError(f"stat check has unknown fields: {sorted(extra)}")
        if check["stat"] not in KNOWN_STATS:
            raise EventError(f"unknown stat {check['stat']!r}")
        try:
            _check_int(check.get("dc"), "dc")
        except ValueError as exc:
            raise EventError(str(exc)) from exc
        return
    extra = set(check) - {"proc", "item"}
    if extra:
        raise EventError(f"proc check has unknown fields: {sorted(extra)}")
    if check["proc"] not in KNOWN_PROCS:
        raise EventError(f"unknown proc {check['proc']!r}")
    if "item" in check:
        if check["proc"] != "pocket":
            raise EventError("only pocket checks carry an item")
        if not isinstance(check["item"], str) or not check["item"].strip():
            raise EventError("pocket item must be a non-empty string")


def validate_event(event: object) -> None:
    """Reject unknown fields, unknown stats, and unknown procs. No private math."""
    if not isinstance(event, dict):
        raise EventError("event must be an object")
    extra = set(event) - EVENT_FIELDS
    if extra:
        raise EventError(f"unknown event fields: {sorted(extra)}")
    missing = EVENT_FIELDS - set(event)
    if missing:
        raise EventError(f"event is missing {sorted(missing)}")
    if not isinstance(event["id"], str) or not event["id"].strip():
        raise EventError("id must be a non-empty string")
    if not isinstance(event["when"], str) or not event["when"].strip():
        raise EventError("when must be a non-empty string")
    if not isinstance(event["card_text"], str) or not event["card_text"].strip():
        raise EventError("card_text must be a non-empty string")
    checks = event["checks"]
    if not isinstance(checks, list) or not checks:
        raise EventError("checks must be a non-empty list")
    for check in checks:
        _validate_check(check)
    _validate_branch(event["on_success"], "on_success")
    _validate_branch(event["on_fail"], "on_fail")


def _branch_text(branch: str | dict[str, Any]) -> str:
    if isinstance(branch, str):
        return branch
    return str(branch["text"])


def _branch_proc(branch: str | dict[str, Any]) -> str | None:
    if isinstance(branch, dict) and "proc" in branch:
        return str(branch["proc"])
    return None


def resolve_event(event: dict[str, Any], ctx: EventContext) -> EventOutcome:
    validate_event(event)
    procs: list[ProcResult] = []
    success = True
    for check in event["checks"]:
        if "stat" in check:
            value = getattr(ctx.stats, check["stat"])
            if not resolve_hit(value, check["dc"], ctx.roll):
                success = False
            continue
        result = run_proc(check["proc"], ctx, check)
        procs.append(result)
        if not _proc_succeeded(result):
            success = False
    branch = event["on_success"] if success else event["on_fail"]
    follow = _branch_proc(branch)
    if follow is not None:
        procs.append(run_proc(follow, ctx))
    return EventOutcome(
        id=event["id"],
        when=event["when"],
        success=success,
        card_text=event["card_text"],
        branch_text=_branch_text(branch),
        procs=tuple(procs),
    )


def load_event(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    validate_event(data)
    return data


def load_starter_events() -> list[dict[str, Any]]:
    paths = sorted(EVENTS_DIR.glob("*.json"))
    if not paths:
        raise EventError(f"no events in {EVENTS_DIR}")
    return [load_event(path) for path in paths]


def _print_snapshots() -> None:
    print(f"hp_max(1, 0)={hp_max(1, 0)}")
    print(f"hp_max(100, 1000)={hp_max(100, 1000)}")
    print(f"mp_max(100, 1000)={mp_max(100, 1000)}")
    print(f"exp_to_next(1)={exp_to_next(1)}")
    print(f"exp_to_next(50)={exp_to_next(50)}")
    print(f"exp_to_next(99)={exp_to_next(99)}")
    beat = arrow_beat(80, 400, 200, 1.0)
    print(f"arrow={beat['machine']} voice={beat['voice']}")
    for name in ARCHETYPE_NAMES:
        print(f"## {name}")
        for level in (1, 50, 100):
            block = archetype_at(name, level)
            pairs = " ".join(f"{field}={getattr(block, field)}" for field in STAT_FIELDS)
            print(f"L{level} {pairs}")


def _stat_field_names_match_dataclass() -> None:
    """Import-time guard so a new StatBlock field cannot skip STAT_FIELDS."""
    live = tuple(item.name for item in fields(StatBlock))
    if live != STAT_FIELDS:
        raise RuntimeError("STAT_FIELDS drifted from StatBlock")


_stat_field_names_match_dataclass()


if __name__ == "__main__":
    _print_snapshots()
