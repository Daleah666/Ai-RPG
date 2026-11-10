// Build the playtest page: the real engine modules bundled into one script, the data inlined, one HTML file out.
//   node build-playtest.mjs <rpgRoot> <template.html> <out.html> [portrait image]
// The engine files are plain ES modules with named imports and exports, so bundling is a text transform:
// each module becomes a function that reads its imports from a registry and returns its exports.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const [root, templatePath, outPath, portraitPath] = process.argv.slice(2);
if (!root || !templatePath || !outPath) throw new Error('usage: build-playtest.mjs <rpgRoot> <template.html> <out.html> [portrait]');

const ORDER = ['constants', 'rng', 'stats', 'combat', 'progression', 'valerie', 'stress', 'binds', 'valerie-combat', 'events', 'narrate', 'battle'];
const modules = ORDER.filter((name) => existsSync(path.join(root, 'engine', `${name}.js`)));

function bundle() {
  let out = 'const __m = {};\n';
  for (const name of modules) {
    let src = readFileSync(path.join(root, 'engine', `${name}.js`), 'utf8');
    src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([\w-]+)\.js';?/g, (_, list, mod) => {
      if (!modules.includes(mod)) throw new Error(`${name}.js imports ${mod}.js, which is not in the bundle`);
      return `const {${list.replace(/\sas\s/g, ': ')}} = __m[${JSON.stringify(mod)}];`;
    });
    const names = [];
    src = src.replace(/^export\s+(const|let|function\*?|async function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
      names.push(id);
      return `${kind} ${id}`;
    });
    if (/^\s*(import|export)\b/m.test(src)) throw new Error(`${name}.js has an import or export form the bundler does not handle`);
    out += `__m[${JSON.stringify(name)}] = (function () {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
  }
  return out;
}

const read = (name) => {
  const file = path.join(root, 'data', `${name}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};
const packsDir = path.join(root, 'events/packs');
const data = {
  valerie: read('valerie'),
  archetypes: read('archetypes'),
  afflictions: read('afflictions'),
  virtues: read('virtues'),
  skills: read('skills'),
  passives: read('passives'),
  items: read('items'),
  bosses: read('bosses'),
  encounters: read('encounters'),
  packs: readdirSync(packsDir).filter((f) => f.endsWith('.events.json')).map((f) => JSON.parse(readFileSync(path.join(packsDir, f), 'utf8'))),
  modules,
  card: (() => { const f = path.join(root, 'sillytavern/src/valerie.card-profile.json'); if (!existsSync(f)) return null; const c = JSON.parse(readFileSync(f, 'utf8')); return { profile: c.profile, secondary: c.secondary, trackers: c.trackers, moments: c.moments, body: c.body, noticed: c.noticed, emotions: c.emotions, people: c.people, highlights: c.highlights, motives: c.motives }; })(),
  persona: existsSync(path.join(root, 'sillytavern/out/Valerie.persona.txt')) ? readFileSync(path.join(root, 'sillytavern/out/Valerie.persona.txt'), 'utf8').trim() : '',
};

const safe = (text) => text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
let portrait = '';
if (portraitPath && existsSync(portraitPath)) {
  const ext = path.extname(portraitPath).slice(1).toLowerCase();
  portrait = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${readFileSync(portraitPath).toString('base64')}`;
}

let html = readFileSync(templatePath, 'utf8');
for (const [mark, value] of [['/*__ENGINE__*/', safe(bundle())], ['/*__DATA__*/', `const DATA = ${safe(JSON.stringify(data))};`], ['__PORTRAIT__', portrait]]) {
  if (!html.includes(mark)) { if (mark === '__PORTRAIT__') continue; throw new Error(`template is missing ${mark}`); }
  html = html.replace(mark, () => value);
}
writeFileSync(outPath, html);
console.log(`built ${outPath}: ${(html.length / 1024).toFixed(0)} KB, engine modules: ${modules.join(', ')}${portrait ? ', with portrait' : ''}`);
