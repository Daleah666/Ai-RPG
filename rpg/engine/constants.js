// Canonical numbers for the whole game. Every module, data file and document reads from here.
// Owner: Director. Change a value here and the tests in rpg/test tell you what it broke.

export const SCALE = Object.freeze({
  LEVEL_MIN: 1,
  LEVEL_MAX: 100,
  STAT_MIN: 1,
  STAT_MAX: 1000,
  // Stress is the one bar that never scales with level.
  STRESS_MIN: 0,
  STRESS_BREAK: 100, // Resolve Check fires when stress first reaches this
  STRESS_MAX: 200, // Breakdown
  // Every d100 check is clamped to this window: nothing is ever certain, nothing is ever hopeless.
  PCT_FLOOR: 5,
  PCT_CEIL: 95,
  LIMIT_MAX: 100, // ultimate gauge
  AIRHEAD_MAX: 100, // Valerie's Clever <-> Clueless gauge
});

// The six attributes. All are integers 1..1000 after gear, buffs and binds.
export const STAT_KEYS = Object.freeze(['STR', 'INT', 'AGI', 'CON', 'WIL', 'LCK']);

export const STAT_INFO = Object.freeze({
  STR: { name: 'Might', drives: 'Physical attack power.' },
  INT: { name: 'Arcana', drives: 'Magical attack power and healing power.' },
  AGI: { name: 'Finesse', drives: 'Accuracy, evasion and turn order.' },
  CON: { name: 'Constitution', drives: 'Max HP and physical defense.' },
  WIL: { name: 'Willpower', drives: 'Max MP, magical defense and stress mitigation.' },
  LCK: { name: 'Luck', drives: 'Critical hits, status procs and resists, drops, lucky accidents.' },
});

// Which defensive attribute answers which offensive attribute.
export const DEFENDS = Object.freeze({ STR: 'CON', INT: 'WIL' });

// Bar scaling baselines (Progression Analyst owns the final formulas in progression.js).
export const BARS = Object.freeze({
  HP_PER_CON_PER_LEVEL: 10, // MaxHP = 10 x Level x CON  -> 1,000,000 at L100 / CON 1000
  MP_PER_WIL_PER_LEVEL: 1, //  MaxMP =  1 x Level x WIL  ->   100,000 at L100 / WIL 1000
});

// The yardstick: what a "trained" attribute looks like at a level.
// Archetype signature stats sit above this line, dump stats below it.
// Event difficulty, boss stats and skill costs are all written relative to it.
export const BENCH = Object.freeze({ AT_L1: 10, AT_L100: 600 });

// Level-100 budget before gear. The last 200 points to the 1000 cap come from gear, passives and buffs,
// so a buff is never wasted on a capped stat until the very top of the endgame.
export const GROWTH = Object.freeze({
  SIGNATURE_L100: 800,
  GEAR_HEADROOM: 200,
  L1_TOTAL: 70, // sum of all six attributes at level 1, same for every archetype
  L100_TOTAL: 3300, // sum of all six attributes at level 100 before gear, same for every archetype
});

export const ELEMENTS = Object.freeze(['phys', 'fire', 'ice', 'bolt', 'holy', 'dark']);
export const AFFINITY_MULT = Object.freeze({ weak: 1.5, normal: 1, resist: 0.5, null: 0, absorb: -1 });

// Body-part binds (Etrian Odyssey style). A bound part halves its attributes and seals its skills.
// Systems Designer owns the rules in binds.js and may retune this block.
export const BIND_PARTS = Object.freeze(['head', 'arms', 'legs']);
export const BIND_MAP = Object.freeze({
  head: Object.freeze(['INT', 'WIL']),
  arms: Object.freeze(['STR']),
  legs: Object.freeze(['AGI']),
});
export const BIND_MULT = 0.5;

// Buffs and debuffs multiply an attribute. The combined multiplier per attribute is clamped here.
export const MOD_CLAMP = Object.freeze({ MIN: 0.5, MAX: 1.5 });

// The Resolve Check at 100 stress. Abilities may shift it, by no more than SHIFT_CAP either way.
export const RESOLVE = Object.freeze({ VIRTUE_PCT: 25, AFFLICTION_PCT: 75, SHIFT_CAP: 15 });

// Generic stat checks (events, luck procs): pct = 50 + CHECK_SLOPE x (stat - dc) / (stat + dc), clamped.
export const CHECK_SLOPE = 60;
export const FUMBLE_FROM = 96; // a d100 roll of 96..100 is a fumble unless something widens the band
export const CRIT_DIVISOR = 10; // generic checks: roll <= pct/10 is a critical success

// Named difficulties for level-agnostic content. DC = benchmarkStat(level) x factor.
export const DIFFICULTY = Object.freeze({
  trivial: 0.25,
  easy: 0.5,
  normal: 1,
  hard: 1.5,
  heroic: 2.5,
  absurd: 4,
});

// Enemy ranks multiply the HP an enemy would have from its level and CON.
// Content Writer owns boss numbers; these are the bands they must sit in.
export const RANK_HP_MULT = Object.freeze({ minion: 0.4, standard: 1, elite: 3, boss: 20, superboss: 60 });
