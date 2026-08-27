"""Render a Heroic Chronicles character sheet to markdown (Starla-depth)."""

from __future__ import annotations

from .schema import CharacterSheet


def _attr_mod_cell(proficient: bool) -> str:
    return "[x]" if proficient else "[ ]"


def render_markdown(sheet: CharacterSheet) -> str:
    idn = sheet.identity
    c = sheet.combat
    p = sheet.personality
    lines: list[str] = []

    lines.append(sheet.title_banner)
    lines.append("")
    lines.append("Combat Vitals Tracker")
    lines.append("")
    lines.append("| AC | INIT | HP | SPEED | HIT DICE | WEALTH |")
    lines.append("| :-: | :-: | :-: | :-: | :-: | :-: |")
    lines.append(
        f"| AC{c.ac} | INIT{c.initiative} | HP{c.hp} | SPEED{c.speed} | "
        f"HIT DICE{c.hit_dice} | WEALTH{c.wealth} |"
    )
    lines.append("")
    lines.append("# Character Identity & Portrait")
    lines.append("")
    lines.append("| Identity | Portrait |")
    lines.append("| :- | :-: |")
    identity_block = (
        f"**Name:** {idn.name}  \n"
        f"**Class/Level:** {idn.class_level}  \n"
        f"**Race:** {idn.race}  \n"
        f"**Alignment:** {idn.alignment}  \n"
        f"**Deity:** {idn.deity}  \n"
        f"**Rank:** {idn.rank}  \n"
        f"**Age:** {idn.age}  \n"
        f"**Player:** {idn.player}  \n"
        f"**Body Ratios:** {idn.body_ratios}  \n"
        f"**Background Summary:** {idn.background_summary}"
    )
    lines.append(f"| {identity_block.replace(chr(10), '<br>')} | {idn.portrait_note} |")
    lines.append("")
    lines.append("## Proficiencies & Languages")
    lines.append("")
    lines.append("| Weapon & Armor | Languages |")
    lines.append("| :- | :- |")
    lines.append(
        f"| {sheet.proficiencies.weapons_armor} | {sheet.proficiencies.languages} |"
    )
    lines.append("")
    lines.append("# Inventory & Equipment")
    lines.append("")
    lines.append("| Equipment | Notes & Rule References |")
    lines.append("| :- | :- |")
    if sheet.equipment:
        for item in sheet.equipment:
            lines.append(f"| {item.name} | {item.notes} |")
    else:
        lines.append("| _(none yet)_ | |")
    lines.append("")
    lines.append(sheet.death_saves_note)
    lines.append("")
    lines.append("## Personality")
    lines.append("")
    lines.append(f"**Traits:** {p.traits}")
    lines.append("")
    lines.append(f"**Ideals:** {p.ideals}")
    lines.append("")
    lines.append(f"**Bonds:** {p.bonds}")
    lines.append("")
    lines.append(f"**Flaws:** {p.flaws}")
    lines.append("")
    lines.append(f"**Perception Lore:** {p.perception_lore}")
    lines.append("")
    lines.append("# Physical Ephemera")
    lines.append("")
    lines.append(sheet.physical_ephemera.strip() or "_(fill on finalize)_")
    lines.append("")
    lines.append("# Core Attributes")
    lines.append("")
    lines.append("| Attribute | Score | Modifier | Saving Throw |")
    lines.append("| :- | :-: | :-: | :-: |")
    for attr in sheet.attributes:
        lines.append(
            f"| {attr.name} | {attr.score} | {attr.modifier} | "
            f"{_attr_mod_cell(attr.saving_throw_proficient)} |"
        )
        if attr.flavor:
            lines.append(f"| Flavor: {attr.flavor} | | | |")
    lines.append("")
    lines.append("# The Soul's Architecture: Core Attributes")
    lines.append("")
    lines.append(sheet.soul_architecture.strip() or "_(narrative synthesis of attributes)_")
    lines.append("")
    lines.append("# Skills & Senses")
    lines.append("")
    lines.append("| Skill | Bonus | Skill | Bonus |")
    lines.append("| :- | :-: | :- | :-: |")
    skills = sheet.skills
    for i in range(0, len(skills), 2):
        left = skills[i]
        left_label = f"{left.name}" + (f" ({left.ability})" if left.ability else "")
        if i + 1 < len(skills):
            right = skills[i + 1]
            right_label = f"{right.name}" + (f" ({right.ability})" if right.ability else "")
            lines.append(
                f"| {left_label} | {left.bonus} | {right_label} | {right.bonus} |"
            )
        else:
            lines.append(f"| {left_label} | {left.bonus} | | |")
    lines.append("")
    lines.append("Passive Senses:")
    lines.append("")
    lines.append(f"Passive Perception: {sheet.passive_perception}")
    lines.append("")
    lines.append(f"Passive Investigation: {sheet.passive_investigation}")
    lines.append("")
    lines.append(f"Passive Insight: {sheet.passive_insight}")
    lines.append("")
    lines.append("# Catalog of Sensual Senses and Sacred Skills")
    lines.append("")
    lines.append(sheet.skills_narrative.strip() or "_(skills narrative)_")
    lines.append("")
    lines.append("# Vulnerabilities & Curses")
    lines.append("")
    lines.append("| Vulnerability / Curse | Effect |")
    lines.append("| :- | :- |")
    if sheet.vulnerabilities:
        for v in sheet.vulnerabilities:
            lines.append(f"| {v.name} | {v.effect} |")
    else:
        lines.append("| _(none listed)_ | |")
    lines.append("")
    lines.append(sheet.vulnerabilities_narrative.strip() or "")
    lines.append("")
    lines.append("# Features & Traits")
    lines.append("")
    for feat in sheet.features:
        lines.append(f"## {feat.title}")
        lines.append("")
        lines.append(feat.body.strip())
        lines.append("")
    lines.append("## Bias Rating & Volatility")
    lines.append("")
    lines.append(f"**Current Bias:** {sheet.bias.current}")
    lines.append("")
    lines.append("**Bias Shift Triggers:**")
    lines.append("")
    for trig in sheet.bias.shift_triggers:
        lines.append(f"- {trig}")
    if not sheet.bias.shift_triggers:
        lines.append("- _(none)_")
    lines.append("")
    lines.append("# Narrative Lens: AI/DM Bias")
    lines.append("")
    if sheet.bias.narrative_lenses:
        for lens, desc in sheet.bias.narrative_lenses.items():
            lines.append(f"**{lens}:** {desc}")
            lines.append("")
    else:
        lines.append("_(define lenses on finalize)_")
        lines.append("")
    for title, body in sheet.extra_sections.items():
        lines.append(f"# {title}")
        lines.append("")
        lines.append(body.strip())
        lines.append("")
    lines.append("---")
    lines.append(f"_status: {sheet.status}_")
    if sheet.source_notes:
        lines.append(f"_source: {sheet.source_notes}_")
    lines.append("")
    return "\n".join(lines)
