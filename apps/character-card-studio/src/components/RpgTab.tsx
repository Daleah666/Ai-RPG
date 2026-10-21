import { ABILITY_KEYS, abilityModifier } from "../lib/profile";
import type { RpgSheet } from "../lib/types";
import { NumberField, TextField, Toggle } from "./fields";

const ABILITY_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

export function RpgTab({ rpg, onChange }: { rpg: RpgSheet; onChange: (rpg: RpgSheet) => void }) {
  const set = <K extends keyof RpgSheet>(key: K, value: RpgSheet[K]) => onChange({ ...rpg, [key]: value });

  return (
    <div>
      <Toggle
        label="Use an RPG / D&D sheet for this character"
        checked={rpg.enabled}
        onChange={(v) => set("enabled", v)}
        hint="When on, a compact stat block is added to the description so game-master bots know what the character can do."
      />
      {rpg.enabled && (
        <>
          <div className="row">
            <TextField label="Race" value={rpg.race} onChange={(v) => set("race", v)} placeholder="Wood elf" />
            <TextField label="Class" value={rpg.className} onChange={(v) => set("className", v)} placeholder="Ranger (Gloom Stalker)" />
            <NumberField label="Level" value={rpg.level} min={1} max={30} onChange={(v) => set("level", v)} />
            <TextField label="Alignment" value={rpg.alignment} onChange={(v) => set("alignment", v)} placeholder="Neutral good" />
          </div>
          <div className="abilities">
            {ABILITY_KEYS.map((key) => {
              const score = rpg.abilities[key];
              const mod = abilityModifier(score);
              return (
                <label key={key} className="ability">
                  <span className="ability-name">{ABILITY_NAMES[key]}</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={score}
                    onChange={(e) => set("abilities", { ...rpg.abilities, [key]: Number(e.target.value) || 0 })}
                  />
                  <span className="ability-mod">{mod >= 0 ? `+${mod}` : mod}</span>
                </label>
              );
            })}
          </div>
          <div className="row">
            <NumberField label="Hit points" value={rpg.hp} min={1} onChange={(v) => set("hp", v)} />
            <NumberField label="Armor class" value={rpg.ac} min={1} onChange={(v) => set("ac", v)} />
          </div>
          <TextField label="Skills & proficiencies" value={rpg.skills} onChange={(v) => set("skills", v)} multiline rows={2} />
          <TextField label="Inventory" value={rpg.inventory} onChange={(v) => set("inventory", v)} multiline rows={2} />
          <TextField label="Spells & special abilities" value={rpg.spells} onChange={(v) => set("spells", v)} multiline rows={2} />
        </>
      )}
    </div>
  );
}
