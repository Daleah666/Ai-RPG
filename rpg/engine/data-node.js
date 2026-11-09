// Node-only helper for reading the JSON in rpg/data. The rest of the engine is pure and browser-safe:
// functions take data as arguments, so a web page can pass in JSON it fetched or inlined.
import { readFileSync, existsSync } from 'node:fs';

const DATA_DIR = new URL('../data/', import.meta.url);

/** Read rpg/data/<name>.json. Returns null when the file does not exist yet. */
export function readData(name) {
  const url = new URL(`${name}.json`, DATA_DIR);
  if (!existsSync(url)) return null;
  return JSON.parse(readFileSync(url, 'utf8'));
}

/** Everything in one object, for tools and tests. Missing files come back as null. */
export function loadAllData() {
  const names = ['archetypes', 'afflictions', 'virtues', 'skills', 'passives', 'items', 'bosses', 'encounters', 'valerie'];
  return Object.fromEntries(names.map((name) => [name, readData(name)]));
}
