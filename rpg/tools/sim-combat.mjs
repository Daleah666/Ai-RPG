// Simulate a fight with the real rules and print it as it would be told.
//   node tools/sim-combat.mjs [--hero meme] [--with ember,lumi] [--encounter goblin_scouts] [--level 3] [--seed 7] [--runs 200] [--quiet]
// A hero is a character file in rpg/characters. Her calling decides her kit: knight is the klutz knight's,
// mage and rogue are the archetypes of those names. Nothing is saved anywhere: this only rolls dice.
import { readFileSync, existsSync } from 'node:fs';
import { makeRng } from '../engine/rng.js';
import { loadAllData } from '../engine/data-node.js';
import { runBattle, makeHero } from '../engine/battle.js';
import { narrate, lineFor } from '../engine/narrate.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((out, a, i, all) => (a.startsWith('--') ? [...out, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]] : out), []));
const data = loadAllData();
const charOf = (id) => { const url = new URL(`../characters/${id}.json`, import.meta.url); if (!existsSync(url)) throw new Error(`no character file for "${id}"`); return JSON.parse(readFileSync(url, 'utf8')); };
const CALLING_ARCH = { knight: null, mage: 'mage', rogue: 'rogue', courtesan: 'rogue' };

/** A party member from a character file: her name, her calling's kit, attributes for the level. */
export function heroFrom(id, level) {
  const c = charOf(id), calling = c.play?.calling ?? ({ Mage: 'mage', Priestess: 'mage', Rogue: 'rogue', Thief: 'rogue' }[c.class] ?? 'knight');
  const arch = CALLING_ARCH[calling] ? data.archetypes.archetypes.find((a) => a.id === CALLING_ARCH[calling]) : data.valerie.archetype;
  // the klutz knight's rules (the Airhead gauge, lucky accidents) belong to whoever fights as "valerie"; anyone else borrowing the kit gets her own id
  return { ...makeHero(arch, level, { id: calling === 'knight' && id === 'valerie' ? 'valerie' : id, name: c.play?.name ?? c.name }), calling };
}

export function simulate({ hero = 'meme', allies = [], encounter = 'goblin_scouts', level = 3, seed = 7 } = {}) {
  const party = [hero, ...allies].map((id) => heroFrom(id, level));
  const run = runBattle({ party: party.map(({ calling, ...p }) => p), encounter, level, data, seed }, { rng: makeRng(seed) });
  return { party, ...run };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hero = args.hero === true || !args.hero ? 'meme' : args.hero, allies = typeof args.with === 'string' ? args.with.split(',').filter(Boolean) : [];
  const encounter = typeof args.encounter === 'string' ? args.encounter : 'goblin_scouts', level = Number(args.level) || 3, seed = Number(args.seed) || 7;
  const one = simulate({ hero, allies, encounter, level, seed });
  if (!args.quiet) {
    console.log(`${one.party.map((p) => `${p.name} (${p.calling}, level ${level})`).join(' and ')} against ${data.encounters.encounters.find((e) => e.id === encounter)?.name ?? encounter} · seed ${seed}\n`);
    for (const e of one.events) console.log(`${e.line ?? lineFor(e)}\n  ${String(e.text ?? narrate(e)).replace(/\n+/g, ' ')}\n`);
  }
  const s = one.summary;
  console.log(`RESULT: ${s.result} in ${s.rounds} rounds · damage dealt ${s.damageToEnemies} · damage taken ${s.damageToHeroes} · ${s.heroes.map((h) => `${h.name} ${h.hp}/${h.maxHp} HP, stress ${h.stress}`).join(' · ')}`);
  const runs = Number(args.runs) || 0;
  if (runs) { let wins = 0, rounds = 0, downs = 0; for (let i = 1; i <= runs; i += 1) { const r = simulate({ hero, allies, encounter, level, seed: i }).summary; if (r.result === 'victory' || r.outcome === 'victory' || r.result === 'win') wins += 1; rounds += r.rounds; downs += r.heroesDowned; }
    console.log(`OVER ${runs} FIGHTS: won ${Math.round((wins / runs) * 100)}% · ${(rounds / runs).toFixed(1)} rounds on average · ${(downs / runs).toFixed(2)} heroes downed per fight`); }
}
