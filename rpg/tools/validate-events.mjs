// Validate every event pack in rpg/events/packs (or the files named on the command line).
//   node tools/validate-events.mjs [pack.json ...]
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePack } from '../engine/events.js';

const packsDir = fileURLToPath(new URL('../events/packs/', import.meta.url));
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(packsDir).filter((f) => f.endsWith('.events.json')).map((f) => path.join(packsDir, f));

let bad = 0;
const ids = new Map();
for (const file of files) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.log(`FAIL ${path.basename(file)}: not valid JSON (${err.message})`);
    bad++;
    continue;
  }
  const { ok, errors, warnings } = validatePack(pack);
  for (const event of pack.events ?? []) {
    if (ids.has(event.id)) errors.push(`event id "${event.id}" is also in ${ids.get(event.id)}`);
    else ids.set(event.id, path.basename(file));
  }
  const fine = ok && errors.length === 0;
  console.log(`${fine ? 'ok  ' : 'FAIL'} ${path.basename(file)}: ${pack.events?.length ?? 0} events${warnings.length ? `, ${warnings.length} warnings` : ''}`);
  for (const w of warnings) console.log(`     warn  ${w}`);
  for (const e of errors) console.log(`     error ${e}`);
  if (!fine) bad++;
}
if (!files.length) console.log('No packs found.');
process.exit(bad ? 1 : 0);
