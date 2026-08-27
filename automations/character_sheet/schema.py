"""Deep character sheet schema matching the Heroic Chronicles / Starla-style template."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class CombatVitals:
    ac: str = ""
    initiative: str = ""
    hp: str = ""
    speed: str = ""
    hit_dice: str = ""
    wealth: str = ""


@dataclass
class Identity:
    name: str = ""
    class_level: str = ""
    race: str = ""
    alignment: str = ""
    deity: str = ""
    rank: str = ""
    age: str = ""
    player: str = ""
    body_ratios: str = ""
    background_summary: str = ""
    portrait_note: str = "[Portrait Placeholder]"


@dataclass
class Proficiencies:
    weapons_armor: str = ""
    languages: str = ""


@dataclass
class EquipmentItem:
    name: str = ""
    notes: str = ""


@dataclass
class Personality:
    traits: str = ""
    ideals: str = ""
    bonds: str = ""
    flaws: str = ""
    perception_lore: str = ""


@dataclass
class AttributeBlock:
    name: str = ""
    score: int | str = ""
    modifier: str = ""
    saving_throw_proficient: bool = False
    flavor: str = ""


@dataclass
class SkillEntry:
    name: str = ""
    ability: str = ""
    bonus: str = ""


@dataclass
class Vulnerability:
    name: str = ""
    effect: str = ""


@dataclass
class Feature:
    title: str = ""
    body: str = ""


@dataclass
class BiasProfile:
    current: str = "The Noble (Default)"
    shift_triggers: list[str] = field(default_factory=list)
    narrative_lenses: dict[str, str] = field(default_factory=dict)


@dataclass
class CharacterSheet:
    """Full Heroic Chronicles sheet — same depth as the Starla template."""

    title_banner: str = "Heroic Chronicles"
    combat: CombatVitals = field(default_factory=CombatVitals)
    identity: Identity = field(default_factory=Identity)
    proficiencies: Proficiencies = field(default_factory=Proficiencies)
    equipment: list[EquipmentItem] = field(default_factory=list)
    death_saves_note: str = "Death Saves: Succ [ ] [ ] [ ] | Fail [ ] [ ] [ ]"
    personality: Personality = field(default_factory=Personality)
    physical_ephemera: str = ""
    attributes: list[AttributeBlock] = field(default_factory=list)
    soul_architecture: str = ""
    skills: list[SkillEntry] = field(default_factory=list)
    passive_perception: str = ""
    passive_investigation: str = ""
    passive_insight: str = ""
    skills_narrative: str = ""
    vulnerabilities: list[Vulnerability] = field(default_factory=list)
    vulnerabilities_narrative: str = ""
    features: list[Feature] = field(default_factory=list)
    bias: BiasProfile = field(default_factory=BiasProfile)
    extra_sections: dict[str, str] = field(default_factory=dict)
    status: str = "draft"
    source_notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CharacterSheet":
        bias_raw = data.get("bias") or {}
        return cls(
            title_banner=data.get("title_banner", "Heroic Chronicles"),
            combat=CombatVitals(**(data.get("combat") or {})),
            identity=Identity(**(data.get("identity") or {})),
            proficiencies=Proficiencies(**(data.get("proficiencies") or {})),
            equipment=[EquipmentItem(**e) for e in (data.get("equipment") or [])],
            death_saves_note=data.get(
                "death_saves_note",
                "Death Saves: Succ [ ] [ ] [ ] | Fail [ ] [ ] [ ]",
            ),
            personality=Personality(**(data.get("personality") or {})),
            physical_ephemera=data.get("physical_ephemera", ""),
            attributes=[AttributeBlock(**a) for a in (data.get("attributes") or [])],
            soul_architecture=data.get("soul_architecture", ""),
            skills=[SkillEntry(**s) for s in (data.get("skills") or [])],
            passive_perception=data.get("passive_perception", ""),
            passive_investigation=data.get("passive_investigation", ""),
            passive_insight=data.get("passive_insight", ""),
            skills_narrative=data.get("skills_narrative", ""),
            vulnerabilities=[Vulnerability(**v) for v in (data.get("vulnerabilities") or [])],
            vulnerabilities_narrative=data.get("vulnerabilities_narrative", ""),
            features=[Feature(**f) for f in (data.get("features") or [])],
            bias=BiasProfile(
                current=bias_raw.get("current", "The Noble (Default)"),
                shift_triggers=list(bias_raw.get("shift_triggers") or []),
                narrative_lenses=dict(bias_raw.get("narrative_lenses") or {}),
            ),
            extra_sections=dict(data.get("extra_sections") or {}),
            status=data.get("status", "draft"),
            source_notes=data.get("source_notes", ""),
        )


def missing_required(sheet: CharacterSheet) -> list[str]:
    missing: list[str] = []
    if not sheet.identity.name:
        missing.append("identity.name")
    if not sheet.identity.class_level:
        missing.append("identity.class_level")
    if not sheet.identity.race:
        missing.append("identity.race")
    if not sheet.combat.hp:
        missing.append("combat.hp")
    if not sheet.personality.traits:
        missing.append("personality.traits")
    if not sheet.physical_ephemera:
        missing.append("physical_ephemera")
    if not sheet.attributes:
        missing.append("attributes")
    return missing
