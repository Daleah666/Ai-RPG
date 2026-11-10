// Compile blueprint/MASTER_BLUEPRINT.md from the role documents and the data.
//   node tools/build-blueprint.mjs
// Sections 1-5 come from the role documents as written. Sections 6-7 are generated from data so they cannot drift.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readData } from '../engine/data-node.js';
import { statsAt, maxHp, maxMp } from '../engine/progression.js';
import { STAT_KEYS, STAT_INFO } from '../engine/constants.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8').trim();
const n = (v) => Number(v).toLocaleString('en-US');

const SECTIONS = [
  ['blueprint/01_engine_math.md', '## 1. FOUNDATIONAL ENGINE MATH'],
  ['blueprint/02_progression.md', '## 2. LEVEL 1 - 100 PROGRESSION & STAT MATRIX'],
  ['blueprint/03_psych_status.md', '## 3. PSYCHOLOGICAL & STATUS SYSTEMS'],
  ['blueprint/04_asset_registry.md', '## 4. MASTER ASSET REGISTRY (SPELLS, PASSIVES, ITEMS)'],
  ['blueprint/05_boss_architecture.md', '## 5. PROGRESSION BOSS ARCHITECTURE'],
];

const missing = [];
const parts = [];
for (const [file, heading] of SECTIONS) {
  if (!existsSync(path.join(root, file))) {
    missing.push(file);
    continue;
  }
  const text = read(file);
  if (!text.startsWith(heading)) throw new Error(`${file} must start with the heading "${heading}"`);
  parts.push(text);
}

function heroSection() {
  const v = readData('valerie');
  const { hero, archetype, gauge, abilities, skills, resolve, dashboard } = v;
  const out = [];
  out.push('## 6. THE HERO: VALERIE');
  out.push(`**${hero.fullName}**, ${hero.class}. ${hero.premise}`);
  out.push(hero.look);
  out.push('| | |\n|---|---|\n' + [
    ['Want', hero.want], ['Cost', hero.cost], ['The lie she tells', hero.lie], ['Wound', hero.wound],
    ['Your want', hero.playerWant], ['Your cost', hero.playerCost],
  ].map(([k, t]) => `| **${k}** | ${t} |`).join('\n'));

  out.push('### 6.1 Symbols');
  out.push('| Symbol | What it carries |\n|---|---|\n' + hero.symbols.map((s) => `| **${s.name}** | ${s.meaning} |`).join('\n'));

  out.push('### 6.2 Klutz Knight attributes');
  out.push(`${archetype.identity} Signature attribute: ${STAT_INFO[archetype.signature].name}.`);
  const levels = [1, 50, 100];
  const rows = levels.map((level) => {
    const s = statsAt(archetype, level);
    return `| ${level} | ${STAT_KEYS.map((k) => s[k]).join(' | ')} | ${n(maxHp(level, s.CON))} | ${n(maxMp(level, s.WIL))} |`;
  });
  out.push(`| Level | ${STAT_KEYS.join(' | ')} | HP | MP |\n|---|${STAT_KEYS.map(() => '---').join('|')}|---|---|\n${rows.join('\n')}`);

  out.push('### 6.3 The Airhead gauge');
  out.push(`One gauge, ${gauge.range[0]} to ${gauge.range[1]}, starting at ${gauge.start}. It is the whole character in one number: who is driving.`);
  out.push('| Band | Gauge | What it means |\n|---|---|---|\n' + gauge.bands.map((b) => `| **${b.name}** | ${b.range[0]}–${b.range[1]} | ${b.text} |`).join('\n'));
  out.push('Every action is taken in a stance:');
  out.push(gauge.stances.map((s) => `- **${s.name}.** ${s.text}`).join('\n'));
  out.push(`**The choice.** ${gauge.choice}`);

  out.push('### 6.4 The six accidents');
  out.push(`None of these adds a roll. Each one moves a band edge on a d100 that was going to be rolled anyway. ${v.abilitiesNote ?? ''}`.trim());
  for (const a of abilities) {
    out.push(`#### ${a.name}${a.nickname ? ` (${a.nickname})` : ''}`);
    out.push(`*${a.fiction}*`);
    out.push(`- **Rule.** ${a.rule}\n- **The choice.** ${a.choice}\n- **Engine.** \`${a.engine}\` in \`engine/valerie.js\``);
  }

  out.push('### 6.5 Skill tree');
  const costOf = (s) => [s.cost.mp ? `${n(s.cost.mp)} MP` : null, s.cost.limit ? `${s.cost.limit} Limit` : null].filter(Boolean).join(', ') || 'free';
  const whenOf = (s) => [s.stance ? (s.stance === 'think' ? 'Think' : 'Wing') : null, s.bands ? s.bands.join('/') : null].filter(Boolean).join(', ') || 'any';
  out.push('| Lv | Skill | Cost | Stance, band | Power | What it does |\n|---|---|---|---|---|---|\n' + skills.map((s) =>
    `| ${s.unlock} | **${s.name}** | ${costOf(s)} | ${whenOf(s)} | ${s.power || 'n/a'} | ${s.text} |`).join('\n'));

  out.push('### 6.6 Her Resolve Check');
  out.push('Valerie rolls the same 25/75 check as everyone at 100 stress, on the same single d100. When that roll is an even number, the table result is replaced by one of her own:');
  out.push(`- **Affliction: ${resolve.affliction.name}.** ${resolve.affliction.text}\n- **Virtue: ${resolve.virtue.name}.** ${resolve.virtue.text}`);

  out.push('### 6.7 Dashboard');
  out.push('Secondary meters. They tick and glow; they never ask for a roll.');
  out.push('| Meter | Range | Starts | Reads |\n|---|---|---|---|\n' + dashboard.map((d) => `| ${d.k} | 0–${d.max} | ${d.start} | ${d.text} |`).join('\n'));
  return out.join('\n\n');
}

function eventsSection() {
  const dir = path.join(root, 'events/packs');
  const packs = readdirSync(dir).filter((f) => f.endsWith('.events.json')).map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
  const out = [];
  out.push('## 7. PLUGGABLE STORY EVENTS');
  out.push('Story beats ship as event packs: plain JSON files dropped into `events/packs/`. A pack can only ask for effects the rules already know, so a pack from another person, tool or game is safe to plug in. Every event offers a choice between winging it and thinking it through, one d100 decides it, and difficulties scale with level so an event works anywhere on the curve. Events convert to and from character-card moments and export as SillyTavern lorebook entries. Format reference: `events/README.md`.');
  for (const pack of packs) {
    out.push(`### ${pack.pack.name}`);
    out.push(`\`${pack.pack.id}\` v${pack.pack.version}, ${pack.events.length} events, rated ${pack.pack.rating}. ${pack.pack.description ?? ''}`.trim());
    out.push('| Event | Where | Levels | The choice |\n|---|---|---|---|\n' + pack.events.map((e) => {
      const lv = e.when?.level ? `${e.when.level[0]}–${e.when.level[1]}` : 'any';
      return `| **${e.title}**<br>${e.t} | ${(e.where ?? ['any']).join(', ')} | ${lv} | ${e.choices.map((c) => c.label).join(' / ')} |`;
    }).join('\n'));
  }
  return out.join('\n\n');
}

const header = [
  "# Oops, I'm the Hero?! Master Blueprint",
  '> Generated by `tools/build-blueprint.mjs` from the role documents in this folder and the data in `data/`. Edit those and rebuild; do not edit this file.',
  'A tactical, high-stat, turn-based JRPG. Level cap 100. Six attributes on a 1–1,000 scale. HP and MP climb into the hundreds of thousands and, for bosses, the millions. Every chance is a d100 roll bounded to 5–95%. Stress is a second health bar that never levels up: 0–200, Resolve Check at 100.',
  'Sections 1–5 are the work of the four specialist roles. Section 6 is the player character. Section 7 is the plug-in story system.',
  'The arithmetic and rules in sections 1–3, 6 and 7 are implemented and tested in `engine/`. Sections 4 and 5 are data checked against those rules. There is no battle loop, skill resolver or status store yet: skill effects, statuses, a boss\'s phases and its telegraphed moves are written to be run by a game master, and `handoff/content-writer.md` and `handoff/boss-desk.md` list what a battle runner would need.',
].join('\n\n');

const doc = [header, ...parts, heroSection(), eventsSection()].join('\n\n---\n\n') + '\n';
writeFileSync(path.join(root, 'blueprint/MASTER_BLUEPRINT.md'), doc);
console.log(`built blueprint/MASTER_BLUEPRINT.md (${doc.length.toLocaleString('en-US')} chars, ${parts.length}/5 role sections)`);
if (missing.length) {
  console.log(`missing role documents: ${missing.join(', ')}`);
  process.exit(1);
}
