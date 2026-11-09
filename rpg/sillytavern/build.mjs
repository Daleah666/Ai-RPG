// Build the SillyTavern files from the data and the engine.
//   node sillytavern/build.mjs
//
//   out/Oops_Im_the_Hero_GM.card.json      Game Master character card (chara_card_v2) with the lorebook embedded
//   out/Oops_Im_the_Hero.worldinfo.json    the same lorebook as a standalone World Info file
//   out/Valerie.persona.txt                paste into Persona Management: this is who you play
//   out/Valerie.card.json                  Valerie in the card creator's format (also a valid chara_card_v2)
//
// Every number in these files is computed here from engine/ and data/, so they cannot drift from the rules.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readData } from '../engine/data-node.js';
import { statsAt, maxHp, maxMp, expToNext } from '../engine/progression.js';
import { hitChance, damage, stressTaken, BASIC_ATTACK, CRIT_MULT, GUARD_MULT } from '../engine/combat.js';
import { toLoreEntry } from '../engine/events.js';
import { AIRHEAD, stanceEffects } from '../engine/valerie.js';
import { STAT_KEYS, STAT_INFO, SCALE, RESOLVE, DIFFICULTY, AFFINITY_MULT, BIND_MAP, FUMBLE_FROM } from '../engine/constants.js';
import { contestPct } from '../engine/rng.js';
import { benchmarkStat, makeCombatant } from '../engine/stats.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
const readJson = (rel) => JSON.parse(readFileSync(path.join(here, rel), 'utf8'));
const n = (v) => Number(v).toLocaleString('en-US');

const valerie = readData('valerie');
const archetypes = readData('archetypes')?.archetypes ?? [];
const afflictions = readData('afflictions')?.afflictions ?? [];
const virtues = readData('virtues')?.virtues ?? [];
const items = readData('items')?.items ?? [];
const bosses = readData('bosses')?.bosses ?? [];
const encounters = readData('encounters')?.encounters ?? [];
const packsDir = path.join(here, '../events/packs');
const packs = readdirSync(packsDir).filter((f) => f.endsWith('.events.json')).map((f) => JSON.parse(readFileSync(path.join(packsDir, f), 'utf8')));

const klutz = valerie.archetype;
const sheet = (level) => {
  const stats = statsAt(klutz, level);
  return { level, stats, hp: maxHp(level, stats.CON), mp: maxMp(level, stats.WIL), next: expToNext(level) };
};

// ---------- numbers the Game Master needs, computed from the engine ----------
const even = (level, mult = 1) => makeCombatant({ level, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.round(benchmarkStat(level) * mult)])) });
const hitAt = (mult) => hitChance(even(50, mult), even(50)).hitPct;
const passAt = (defMult) => {
  const a = even(50);
  const d = even(50, defMult);
  return damage(a, d, BASIC_ATTACK) / (BASIC_ATTACK.power * a.level * a.stats.STR);
};
const pct2 = (v) => v.toFixed(2);
const stressAt = (wil, base = 20) => stressTaken(base, makeCombatant({ stats: { WIL: wil } }));
const fullGauge = makeCombatant({ level: 50, stats: statsAt(klutz, 50), flags: { airhead: 100 } });
const wingFrom = stanceEffects(fullGauge, 'wing').opts.fumbleFrom;
const diffLine = Object.keys(DIFFICULTY).map((d) => `${d} ${contestPct(100, 100 * DIFFICULTY[d])}%`).join(', ');

// ---------- lorebook ----------
const entries = [];
const add = (comment, keys, content, { constant = false, position = 'after_char', order } = {}) => {
  entries.push({
    id: entries.length, keys, content: content.trim(), enabled: true, insertion_order: order ?? 50 + entries.length,
    case_sensitive: false, constant, selective: false, position, comment, extensions: {},
  });
};

add('rules · dice', [], `
[RULES: DICE] One d100 per action. Low is good. Roll at or under the chance to succeed. Every chance is bounded: never below ${SCALE.PCT_FLOOR}, never above ${SCALE.PCT_CEIL}. ${FUMBLE_FROM}-100 is always a fumble: it fails and something goes wrong. A roll at or under one tenth of the chance is a critical success.
Checks outside combat, for a character whose attribute is typical for their level: ${diffLine}. A character twice as good as the task gets about 70; half as good, about 30.
Never add a second roll to the same action. Abilities move the edges of the bands instead.`, { constant: true, position: 'before_char', order: 1 });

add('rules · combat', [], `
[RULES: COMBAT] Attacks roll d100 against the chance to hit: ${hitAt(1)} when attacker and target are evenly matched in Finesse, about ${hitAt(2)} when the attacker is twice as nimble, about ${hitAt(0.5)} when half. Crit chance is 5, more with a big Luck edge; a crit deals x${CRIT_MULT}.
Damage = Power x attacker's Level x attacking attribute x pass. Physical attacks use Might against the target's Constitution; magic uses Arcana against Willpower. pass is ${pct2(passAt(1))} when attack equals defense, ${pct2(passAt(0.5))} when the defense is half the attack, ${pct2(passAt(2))} when it is double. A basic attack is Power ${BASIC_ATTACK.power}. Round to two significant figures.
Weak x${AFFINITY_MULT.weak}, resist x${AFFINITY_MULT.resist}, guarding x${GUARD_MULT}. Max HP = 10 x Level x Constitution. Max MP = Level x Willpower.`, { constant: true, position: 'before_char', order: 2 });

add('valerie · gauge and stances', [], `
[VALERIE: THE AIRHEAD GAUGE] 0 to 100, starts at ${AIRHEAD.START}. Lucid 0-${AIRHEAD.LUCID_MAX}: {{user}} is driving. Ditzy ${AIRHEAD.LUCID_MAX + 1}-${AIRHEAD.DITZY_MAX}: shared wheel. Total Airhead ${AIRHEAD.DITZY_MAX + 1}-100: the body is driving.
WING IT (instinct): gauge +${AIRHEAD.WING_GAIN}, stress -${AIRHEAD.WING_RELIEF}. Out of combat she rolls her Luck and adds gauge/5. In combat her fumble band widens with the gauge (${wingFrom}-100 at full), and a fumble becomes an Accidental Chaos Wave.
THINK IT THROUGH (planning): gauge -${AIRHEAD.THINK_LOSS}, +${AIRHEAD.THINK_STRESS} stress that Willpower cannot reduce. +${AIRHEAD.THINK_HIT_BONUS} to hit. Out of combat she rolls {{user}}'s Wit (a typical attribute for her level) and subtracts gauge/5. Planned skills are sealed while she is a Total Airhead.
Lucky or precise, never both.`, { constant: true, position: 'before_char', order: 3 });

add('valerie · the six accidents', [], `
[VALERIE: THE SIX ACCIDENTS] She does none of these on purpose and takes credit for all of them.
${valerie.abilities.map((a) => `- ${a.name} (level ${a.unlock}): ${a.gm}`).join('\n')}`, { constant: true, position: 'before_char', order: 4 });

for (const a of valerie.abilities) {
  const keys = [a.name.toLowerCase(), ...(a.nickname ? [a.nickname.toLowerCase().replace(/^the /, '')] : []), ...(a.keys ?? [])];
  add(`valerie · ${a.id}`, keys, `[VALERIE: ${a.name.toUpperCase()}] ${a.fiction}\nRule: ${a.rule}\nThe choice it forces: ${a.choice}`);
}

const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
add('valerie · sheet by level', ['level up', 'levels up', 'level', 'exp', 'experience', 'stats', 'sheet', 'hp', 'mp'], `
[VALERIE: SHEET BY LEVEL] Klutz Knight. Lv | Might Arcana Finesse Constitution Willpower Luck | HP | MP | EXP to next
${levels.map((l) => { const s = sheet(l); return `${l} | ${STAT_KEYS.map((k) => s.stats[k]).join(' ')} | ${n(s.hp)} | ${n(s.mp)} | ${n(s.next)}`; }).join('\n')}
A fight against enemies of her level is worth roughly a quarter to a tenth of a level early on, less later. On a level up, refill HP and MP.`);

add('valerie · skills', ['skill', 'skills', 'technique', 'ultimate', 'main character energy', ...valerie.skills.map((s) => s.name.toLowerCase())], `
[VALERIE: SKILLS] Name (unlock level, cost; stance or band if restricted): effect.
${valerie.skills.map((s) => {
    const cost = [s.cost.mp ? `${n(s.cost.mp)} MP` : null, s.cost.limit ? `${s.cost.limit} MCE` : null].filter(Boolean).join(', ') || 'free';
    const gate = [s.stance ? (s.stance === 'think' ? 'Think only' : 'Wing only') : null, s.bands ? s.bands.join('/') : null].filter(Boolean).join(', ');
    return `- ${s.name} (Lv ${s.unlock}, ${cost}${gate ? `; ${gate}` : ''}): ${s.text}`;
  }).join('\n')}
Main Character Energy (MCE) is her 0-100 ultimate gauge: +15 per Chaos Wave, and it rises on bounces, enemy fumbles and crowd-pleasing moments.`);

add('rules · stress and resolve', ['stress', 'stressed', 'resolve', 'panic', 'breakdown', 'afraid', 'terrified', 'horror', 'affliction', 'virtue', 'nerve'], `
[RULES: STRESS] Stress runs 0 to ${SCALE.STRESS_MAX} and never scales with level. Willpower reduces incoming stress: a hit of 20 lands as ${stressAt(10)} at Willpower 10, ${stressAt(150)} at 150, ${stressAt(400)} at 400, ${stressAt(1000)} at 1000.
At ${SCALE.STRESS_BREAK} a character makes a Resolve Check, one d100: 01-${RESOLVE.VIRTUE_PCT} a Virtue, ${RESOLVE.VIRTUE_PCT + 1}-100 an Affliction. At ${SCALE.STRESS_MAX}: Breakdown.
${virtues.length ? `Virtues: ${virtues.map((v) => `${v.name} (${v.text})`).join(' ')}` : ''}
${afflictions.length ? `Afflictions: ${afflictions.map((a) => `${a.name} (${a.text})`).join(' ')}` : ''}
Valerie: horror and mental stress do not land on her unless she is Lucid, and allies who see it shed 3. Realization stress (being told what really happened) ignores her Willpower and drops the gauge 10. Embarrassment is x1.5 unless she is a Total Airhead. Her own outcomes: ${valerie.resolve.affliction.name} (${valerie.resolve.affliction.text}) or ${valerie.resolve.virtue.name} (${valerie.resolve.virtue.text})`);

add('rules · binds', ['bind', 'bound', 'binds', 'tangled', 'disarmed', 'pinned', 'tripped', 'blinded', 'gagged', 'head', 'arms', 'legs'], `
[RULES: BINDS] Three body parts can be bound: ${Object.entries(BIND_MAP).map(([part, stats]) => `${part} (halves ${stats.map((k) => STAT_INFO[k].name).join(' and ')} and seals ${part} skills)`).join('; ')}. A bind lasts a set number of turns. Two binds never quarter the same attribute.
An enemy that fumbles inside Valerie's Aura of Befuddlement binds one of its own parts for a turn.`);

for (const a of archetypes) {
  const s1 = statsAt(a, 1); const s100 = statsAt(a, 100);
  add(`class · ${a.id}`, [a.id, a.name.toLowerCase()], `
[CLASS: ${a.name.toUpperCase()}] ${a.identity} Wants: ${a.want} Cost: ${a.cost} Best attribute: ${STAT_INFO[a.signature].name}.
Level 1: ${STAT_KEYS.map((k) => `${k} ${s1[k]}`).join(', ')}. Level 100: ${STAT_KEYS.map((k) => `${k} ${s100[k]}`).join(', ')}.`);
}

const profile = readJson('src/valerie.card-profile.json');
for (const p of profile.people) {
  add(`cast · ${p.name}`, p.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && w !== 'dame'), `[CAST: ${p.name}] ${p.rel}. ${p.dyn} Now: ${p.now}.`);
}

if (items.length) {
  add('items · shop', ['shop', 'merchant', 'store', 'buy', 'sell', 'potion', 'item', 'items', 'gold', 'price'], `
[ITEMS] Name (suited to level, price in gold): effect.
${items.map((i) => `- ${i.name} (Lv ${i.level}, ${n(i.price)}g): ${i.text}`).join('\n')}`);
}

for (const e of encounters) {
  const keys = [...new Set([...e.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3), ...(e.keys ?? [])])];
  add(`encounter · ${e.id}`, keys, `
[ENCOUNTER: ${e.name}] ${e.text}
Enemies: ${e.enemies.map((x) => `${x.count} x ${x.name} (${x.rank}): ${x.text}`).join(' ')}
${e.contraption ? `Contraption (goes off on an Accidental Chaos Wave): ${e.contraption.name}. ${e.contraption.text}` : ''}`);
}

for (const b of bosses) {
  const keys = [...new Set(b.name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter((w) => w.length > 3))];
  add(`boss · ${b.id}`, keys, `
[BOSS: ${b.name}] Level ${b.level} ${b.rank}. HP ${n(b.hp)}. ${STAT_KEYS.map((k) => `${k} ${b.stats[k]}`).join(', ')}.
${b.identity} Wants: ${b.want} Cost: ${b.cost}
${(b.phases ?? []).map((ph) => `Phase at ${ph.at}% HP, ${ph.name}: ${ph.text}`).join('\n')}
Moves: ${(b.moves ?? []).map((m) => `${m.name} (${m.text})`).join(' ')}
How to beat it: ${b.counterplay}`);
}

let eventCount = 0;
for (const pack of packs) for (const event of pack.events) {
  const entry = toLoreEntry(event, entries.length);
  entry.insertion_order = 200 + eventCount++;
  entries.push(entry);
}

const book = {
  name: "Oops, I'm the Hero?! rules and world",
  description: 'Rules, Valerie, the cast, items, bosses and story events. Built from the Ai-RPG rules engine.',
  scan_depth: 4,
  token_budget: 2048,
  recursive_scanning: false,
  extensions: {},
  entries,
};

// ---------- Game Master card ----------
const gm = readJson('src/gm.json');
const fills = {};
for (const level of [1, 4, 5, 10]) {
  const s = sheet(level);
  fills[`HP${level}`] = n(s.hp);
  fills[`MP${level}`] = n(s.mp);
  fills[`HP${level}_90`] = n(Math.round(s.hp * 0.9));
  fills[`MP${level}_85`] = n(Math.round(s.mp * 0.85));
}
const fill = (text) => text.replace(/%%([A-Z0-9_]+)%%/g, (m, key) => {
  if (fills[key] === undefined) throw new Error(`gm.json uses %%${key}%% but the build has no value for it`);
  return fills[key];
});
const gmCard = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: gm.name,
    description: gm.description,
    personality: gm.personality,
    scenario: gm.scenario,
    first_mes: fill(gm.first_mes),
    mes_example: fill(gm.mes_example),
    creator_notes: gm.creator_notes,
    system_prompt: gm.system_prompt,
    post_history_instructions: gm.post_history_instructions,
    alternate_greetings: gm.alternate_greetings.map(fill),
    tags: gm.tags,
    creator: gm.creator,
    character_version: gm.character_version,
    extensions: { oops_rpg: { format: 'oops-rpg/1', built: 'rpg/sillytavern/build.mjs', packs: packs.map((p) => `${p.pack.id}@${p.pack.version}`) } },
    character_book: book,
  },
};
writeFileSync(path.join(out, 'Oops_Im_the_Hero_GM.card.json'), JSON.stringify(gmCard, null, 2) + '\n');

// ---------- standalone World Info ----------
const worldInfo = { entries: {} };
entries.forEach((e, i) => {
  worldInfo.entries[i] = {
    uid: i, key: e.keys, keysecondary: [], comment: e.comment, content: e.content, constant: e.constant, vectorized: false,
    selective: false, selectiveLogic: 0, addMemo: true, order: e.insertion_order, position: e.position === 'before_char' ? 0 : 1,
    disable: false, excludeRecursion: false, preventRecursion: false, probability: 100, useProbability: true, depth: 4, group: '',
    groupOverride: false, groupWeight: 100, scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null,
    automationId: '', role: null, sticky: 0, cooldown: 0, delay: 0, displayIndex: i,
  };
});
writeFileSync(path.join(out, 'Oops_Im_the_Hero.worldinfo.json'), JSON.stringify(worldInfo, null, 2) + '\n');

// ---------- persona ----------
const h = valerie.hero;
const persona = `{{user}} is an ordinary person from our world who woke up this morning inside the body of ${h.fullName}, a ${h.age}-year-old knight. Everyone here sees and treats {{user}} as Valerie. Only {{user}} knows there is someone else behind her eyes.

What people see: ${h.look}

What Valerie is like: brave, kind, sunny and spectacularly clumsy. She sincerely believes she is "just a really good hero". She is in fact the luckiest person alive: blows miss because she trips under them, arrows bounce off her, enemies fumble around her, and things she loses turn up in her cloak exactly when they are needed. She has never noticed any of it.

What {{user}} brings: their own mind, their own memories of home, and the ability to plan. The catch is that Valerie's luck only works when {{user}} acts on instinct. The more carefully {{user}} thinks, the less the luck happens.

She carries ${h.symbols[0].name}, a greatsword taller than she is, which swings her more than she swings it.`;
writeFileSync(path.join(out, 'Valerie.persona.txt'), persona + '\n');

// ---------- Valerie in the card creator's format ----------
const l1 = sheet(1);
const NAMES = Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_INFO[k].name]));
const p = { ...profile.profile, rpg_xp: `0 / ${n(l1.next)}` };
const stage = {
  profile: p,
  primary: Object.fromEntries(STAT_KEYS.map((k) => [NAMES[k], l1.stats[k]])),
  primaryScale: 20,
  body: profile.body,
  tags: profile.tags,
  kinds: profile.kinds,
  highlights: profile.highlights,
  secondary: profile.secondary,
  emotions: profile.emotions,
  media: [],
  portrait: '',
  layout: profile.layout,
  motives: profile.motives,
  spicyTags: [],
  trackers: profile.trackers,
  aiBias: profile.aiBias,
  noticed: profile.noticed,
  people: profile.people,
  moments: profile.moments,
  memories: profile.memories,
  descTokens: profile.descTokens,
  lore: [
    {
      id: 'lb-valerie-gauge', name: 'The Airhead gauge', emoji: '🎀',
      entries: [
        { content: `Valerie has an Airhead gauge from 0 to 100, starting at ${AIRHEAD.START}. Lucid (0-${AIRHEAD.LUCID_MAX}) means {{user}} is driving, Ditzy (${AIRHEAD.LUCID_MAX + 1}-${AIRHEAD.DITZY_MAX}) is a shared wheel, Total Airhead (${AIRHEAD.DITZY_MAX + 1}-100) means the body is driving. Acting on instinct raises it ${AIRHEAD.WING_GAIN}; planning lowers it ${AIRHEAD.THINK_LOSS}. Her luck scales with the gauge and her planned skills are sealed at the top of it. Lucky or precise, never both.`, keys: [], on: true },
        { content: `Being told what really happened hurts Valerie in a way nothing else does: it costs her stress that Willpower cannot reduce and drops the Airhead gauge by ${AIRHEAD.REALIZATION_DROP}.`, keys: ['truth', 'really happened', 'accident', 'luck', 'fraud', 'notebook'], on: true },
      ],
    },
    {
      id: 'lb-valerie-accidents', name: 'Her six accidents', emoji: '✨',
      entries: valerie.abilities.map((a) => ({ content: `${a.name}: ${a.fiction} Rule: ${a.rule}`, keys: [a.name.toLowerCase(), ...(a.nickname ? [a.nickname.toLowerCase().replace(/^the /, '')] : [])], on: true })),
    },
  ],
  rpg: {
    format: 'oops-rpg/1',
    archetype: klutz.id,
    level: 1,
    stats: l1.stats,
    hp: l1.hp,
    mp: l1.mp,
    stress: 0,
    airhead: AIRHEAD.START,
    limit: 0,
    dashboard: valerie.dashboard.map((d) => ({ k: d.k, v: d.start, max: d.max })),
    skills: valerie.skills.filter((s) => s.unlock <= 1).map((s) => s.id),
    abilities: valerie.abilities.filter((a) => a.unlock <= 1).map((a) => a.id),
  },
};
const bookEntries = [
  ...profile.memories.map((m) => ({ keys: m.keys, content: m.t, comment: `memory · ${m.about}`, constant: false })),
  ...stage.lore.flatMap((lb) => lb.entries.map((e) => ({ keys: e.keys, content: e.content, comment: `lore · ${lb.name}`, constant: e.keys.length === 0 }))),
];
const valerieCard = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: 'Valerie',
    description: p.description,
    personality: 'Brave, kind, sunny, earnest and spectacularly clumsy. Never afraid, never sarcastic, a beat behind every conversation and sincerely sure she is a really good hero.',
    scenario: '{{user}} is an ordinary person from another world who has woken up inside Valerie. To everyone else in the kingdom, {{user}} is Dame Valerie Bellweather, accidental folk hero.',
    first_mes: "*You wake on your back in a forest clearing. The sky is very blue. You are wearing a great deal of gold armor, your hair is in your eyes, and it is pink. Beside you lies a sword roughly the size of a door.*\n\n*From the treeline, a voice:* \"Dame Valerie! The goblins are back!\"\n\n*None of this is yours. An hour ago you were somewhere with traffic. Three small shapes with knives are creeping out of the ferns behind you.*\n\n*Do you wing it, or think it through?*",
    mes_example: "<START>\n{{user}}: How did you put out the mill fire?\n{{char}}: *She beams, plants the sword point-down and nearly loses it in the floorboards.* Oh, that! I ran in, and there was a bucket, and then the fire was out! *A pause while she checks her own memory and finds it agreeable.* I'm just a really good hero.",
    creator_notes: 'Valerie, the player character of "Oops, I\'m the Hero?!". Use as a persona (you play her) with the Game Master card, or as a character to talk to. PG-13 slapstick. Built from Ai-RPG/rpg; the rules live there.',
    system_prompt: p.system_prompt,
    post_history_instructions: p.post_history_instructions,
    alternate_greetings: [],
    tags: profile.tags.map((t) => t.tag),
    creator: 'Ai-RPG (Game Director run, 2026-11-09)',
    character_version: '0.1.0',
    extensions: { companion_stage: stage },
    character_book: {
      name: "Valerie's memory book",
      description: 'Her memories plus her lorebooks',
      extensions: {},
      entries: bookEntries.map((e, i) => ({ id: i, keys: e.keys, content: e.content, enabled: true, insertion_order: i, case_sensitive: false, constant: e.constant, selective: false, position: 'after_char', comment: e.comment, extensions: {} })),
    },
  },
};
writeFileSync(path.join(out, 'Valerie.card.json'), JSON.stringify(valerieCard, null, 2) + '\n');

const constantChars = entries.filter((e) => e.constant).reduce((sum, e) => sum + e.content.length, 0);
console.log(`built sillytavern/out: GM card with ${entries.length} lorebook entries (${entries.filter((e) => e.constant).length} always on, about ${Math.round(constantChars / 4)} tokens), ${eventCount} events, persona, Valerie card`);
const thin = [['afflictions', afflictions], ['virtues', virtues], ['items', items], ['bosses', bosses], ['encounters', encounters]].filter(([, list]) => !list.length).map(([name]) => name);
if (thin.length) console.log(`not in the lorebook yet (no data): ${thin.join(', ')}`);
