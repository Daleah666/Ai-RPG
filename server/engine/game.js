// Core game engine for the AI-RPG dungeon crawler.
//
// The engine is fully deterministic for a given seed so it can be unit
// tested, while still producing varied narrative. It acts as a lightweight
// procedural "Dungeon Master": each action advances world state and returns
// human-readable narration describing what happened.

import {
  CLASSES,
  MONSTERS,
  BOSS,
  ROOM_DESCRIPTIONS,
  MONSTER_INTROS,
  HIT_VERBS,
  TREASURE_FLAVORS,
  WEAPONS,
  ARMORS,
} from './content.js';

// --- Deterministic RNG (mulberry32) -----------------------------------------
// The seed lives on the state object so the whole game is reproducible and
// serialisable. Each draw advances the seed in place.

function nextRandom(state) {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randInt(state, min, max) {
  return Math.floor(nextRandom(state) * (max - min + 1)) + min;
}

function pick(state, arr) {
  return arr[Math.floor(nextRandom(state) * arr.length)];
}

// --- Helpers -----------------------------------------------------------------

const FLOORS_TO_WIN = 5;

function xpForLevel(level) {
  return level * 20;
}

function playerAttack(player) {
  return player.attack + (player.weapon ? player.weapon.bonus : 0);
}

function playerDefense(player) {
  return player.defense + (player.armor ? player.armor.bonus : 0);
}

function clampHp(player) {
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  if (player.hp < 0) player.hp = 0;
}

function grantXp(state, amount, events) {
  const p = state.player;
  p.xp += amount;
  events.push(`You gain ${amount} XP.`);
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = xpForLevel(p.level);
    p.maxHp += 6;
    p.attack += 2;
    p.defense += 1;
    p.hp = p.maxHp;
    events.push(`*Level up!* You are now level ${p.level}. Wounds close and your strength grows.`);
  }
}

// --- Room generation ---------------------------------------------------------

function makeMonster(state) {
  const isBossFloor = state.floor >= FLOORS_TO_WIN;
  const base = isBossFloor ? BOSS : pick(state, MONSTERS);
  // Scale slightly with depth so deeper floors stay dangerous.
  const scale = 1 + (state.floor - 1) * 0.15;
  return {
    id: base.id,
    name: base.name,
    hp: Math.round(base.hp * scale),
    maxHp: Math.round(base.hp * scale),
    attack: Math.round(base.attack * scale),
    xp: base.xp,
    goldRange: base.gold,
    isBoss: Boolean(isBossFloor),
  };
}

function generateRoom(state) {
  const roll = nextRandom(state);
  const description = pick(state, ROOM_DESCRIPTIONS);

  if (state.floor >= FLOORS_TO_WIN) {
    // Final floor is always the boss fight.
    return { type: 'monster', description, monster: makeMonster(state) };
  }

  if (roll < 0.55) {
    return { type: 'monster', description, monster: makeMonster(state) };
  }
  if (roll < 0.78) {
    const gold = randInt(state, 5, 15 + state.floor * 3);
    const lootRoll = nextRandom(state);
    let item = null;
    if (lootRoll < 0.4) {
      item = { kind: 'weapon', ...pick(state, WEAPONS) };
    } else if (lootRoll < 0.7) {
      item = { kind: 'armor', ...pick(state, ARMORS) };
    } else {
      item = { kind: 'potion', name: 'Health Potion' };
    }
    return {
      type: 'treasure',
      description,
      flavor: pick(state, TREASURE_FLAVORS),
      gold,
      item,
      looted: false,
    };
  }
  if (roll < 0.9) {
    return { type: 'shrine', description };
  }
  return { type: 'exit', description };
}

// --- Public API --------------------------------------------------------------

export function createGame({ name, className, seed } = {}) {
  const cleanName = (name || 'Adventurer').toString().slice(0, 32).trim() || 'Adventurer';
  const cls = CLASSES[className] ? className : 'warrior';
  const def = CLASSES[cls];

  const state = {
    id: null,
    seed: Number.isFinite(seed) ? seed | 0 : (Math.random() * 2 ** 31) | 0,
    createdAt: Date.now(),
    status: 'playing',
    floor: 1,
    turn: 0,
    player: {
      name: cleanName,
      className: cls,
      classLabel: def.label,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      hp: def.maxHp,
      maxHp: def.maxHp,
      attack: def.attack,
      defense: def.defense,
      gold: 0,
      potions: 1,
      weapon: { id: 'rusty_dagger', name: 'Rusty Dagger', bonus: 1 },
      armor: null,
      kills: 0,
    },
    room: null,
    inCombat: false,
    log: [],
  };

  state.room = generateRoom(state);
  const narrative = openingNarrative(state);
  state.inCombat = state.room.type === 'monster';
  state.log.push(narrative);
  return { state, narrative };
}

function openingNarrative(state) {
  const p = state.player;
  const def = CLASSES[p.className];
  const lines = [
    `${p.name}, ${def.flavor}, descends into the Sunless Deep.`,
    `You enter ${state.room.description}.`,
  ];
  lines.push(describeRoom(state));
  return lines.join(' ');
}

function describeRoom(state) {
  const room = state.room;
  switch (room.type) {
    case 'monster': {
      const intro = pick(state, MONSTER_INTROS).replace('{monster}', room.monster.name);
      return room.monster.isBoss
        ? `The ground trembles. ${room.monster.name} blocks the only way out — this is the final stand!`
        : intro;
    }
    case 'treasure':
      return `${room.flavor} You could take what lies here.`;
    case 'shrine':
      return 'A cracked shrine glows softly. You could rest here to recover.';
    case 'exit':
      return 'A stairwell spirals downward into deeper darkness. You may descend.';
    default:
      return 'The way ahead is quiet.';
  }
}

function availableActions(state) {
  if (state.status !== 'playing') return [];
  const p = state.player;
  const actions = [];
  if (state.inCombat) {
    actions.push('attack', 'flee');
    if (p.potions > 0) actions.push('drink_potion');
    return actions;
  }
  switch (state.room.type) {
    case 'treasure':
      if (!state.room.looted) actions.push('loot');
      actions.push('explore');
      break;
    case 'shrine':
      actions.push('rest', 'explore');
      break;
    case 'exit':
      actions.push('descend', 'explore');
      break;
    default:
      actions.push('explore');
  }
  if (p.potions > 0) actions.push('drink_potion');
  return actions;
}

function monsterTurn(state, events) {
  const monster = state.room.monster;
  if (!monster || monster.hp <= 0) return;
  const raw = monster.attack + randInt(state, -2, 2);
  const dmg = Math.max(1, raw - Math.floor(playerDefense(state.player) / 2));
  state.player.hp -= dmg;
  clampHp(state.player);
  events.push(`${monster.name} ${pick(state, HIT_VERBS)} you for ${dmg} damage.`);
  if (state.player.hp <= 0) {
    state.status = 'dead';
    state.inCombat = false;
    events.push(`You fall to the ground, life fading in the dark. *You have died on floor ${state.floor}.*`);
  }
}

function resolveVictory(state, monster, events) {
  state.player.kills += 1;
  const gold = randInt(state, monster.goldRange[0], monster.goldRange[1]);
  state.player.gold += gold;
  events.push(`${monster.name} collapses. You loot ${gold} gold.`);
  grantXp(state, monster.xp, events);
  state.inCombat = false;
  if (monster.isBoss) {
    state.status = 'won';
    events.push('*Grukthar falls with an earth-shaking roar. You have conquered the Sunless Deep!*');
  } else {
    // Clear the room so the player can explore onward.
    state.room = { type: 'empty', description: state.room.description };
  }
}

export function applyAction(state, action) {
  const events = [];
  if (state.status !== 'playing') {
    return { state, narrative: 'The game is over.', events, actions: [] };
  }

  const legal = availableActions(state);
  if (!legal.includes(action)) {
    return {
      state,
      narrative: `You cannot ${action.replace('_', ' ')} right now.`,
      events: [],
      actions: legal,
    };
  }

  state.turn += 1;
  const p = state.player;

  switch (action) {
    case 'attack': {
      const monster = state.room.monster;
      const raw = playerAttack(p) + randInt(state, -2, 3);
      const dmg = Math.max(1, raw);
      monster.hp -= dmg;
      events.push(`You ${pick(state, HIT_VERBS)} ${monster.name} for ${dmg} damage.`);
      if (monster.hp <= 0) {
        resolveVictory(state, monster, events);
      } else {
        monsterTurn(state, events);
      }
      break;
    }
    case 'flee': {
      const monster = state.room.monster;
      const escaped = nextRandom(state) < 0.5;
      if (escaped) {
        events.push('You break away and slip into an adjoining passage.');
        state.inCombat = false;
        state.room = generateRoom(state);
        state.inCombat = state.room.type === 'monster';
        events.push(describeRoom(state));
      } else {
        events.push('You stumble — there is no escape!');
        monsterTurn(state, events);
        void monster;
      }
      break;
    }
    case 'drink_potion': {
      p.potions -= 1;
      const heal = randInt(state, 10, 18);
      p.hp += heal;
      clampHp(p);
      events.push(`You quaff a Health Potion and recover ${heal} HP.`);
      if (state.inCombat) monsterTurn(state, events);
      break;
    }
    case 'loot': {
      const room = state.room;
      room.looted = true;
      p.gold += room.gold;
      events.push(`You pocket ${room.gold} gold.`);
      const item = room.item;
      if (item.kind === 'weapon') {
        if (!p.weapon || item.bonus > p.weapon.bonus) {
          events.push(`You equip the ${item.name} (+${item.bonus} attack).`);
          p.weapon = { id: item.id, name: item.name, bonus: item.bonus };
        } else {
          events.push(`You find a ${item.name}, but your current weapon is better.`);
        }
      } else if (item.kind === 'armor') {
        if (!p.armor || item.bonus > p.armor.bonus) {
          events.push(`You don the ${item.name} (+${item.bonus} defense).`);
          p.armor = { id: item.id, name: item.name, bonus: item.bonus };
        } else {
          events.push(`You find ${item.name}, but your current armor is better.`);
        }
      } else {
        p.potions += 1;
        events.push('You add a Health Potion to your pack.');
      }
      break;
    }
    case 'rest': {
      const heal = randInt(state, 6, 12);
      p.hp += heal;
      clampHp(p);
      events.push(`You rest at the shrine and recover ${heal} HP.`);
      // Resting is risky: chance of an ambush.
      if (nextRandom(state) < 0.3) {
        events.push('Your rest is cut short!');
        state.room = { type: 'monster', description: state.room.description, monster: makeMonster(state) };
        state.inCombat = true;
        events.push(describeRoom(state));
      }
      break;
    }
    case 'descend': {
      state.floor += 1;
      events.push(`You descend to floor ${state.floor}. The air grows colder.`);
      state.room = generateRoom(state);
      state.inCombat = state.room.type === 'monster';
      events.push(`You enter ${state.room.description}. ${describeRoom(state)}`);
      break;
    }
    case 'explore': {
      state.room = generateRoom(state);
      state.inCombat = state.room.type === 'monster';
      events.push(`You press on into ${state.room.description}. ${describeRoom(state)}`);
      break;
    }
    default:
      events.push('Nothing happens.');
  }

  const narrative = events.join(' ');
  state.log.push(narrative);
  return { state, narrative, events, actions: availableActions(state) };
}

export function publicState(state) {
  // Strip nothing sensitive here (single-player), but keep a stable shape.
  return {
    id: state.id,
    status: state.status,
    floor: state.floor,
    turn: state.turn,
    inCombat: state.inCombat,
    player: state.player,
    room: state.room,
    actions: availableActions(state),
    log: state.log.slice(-12),
  };
}

export { availableActions, FLOORS_TO_WIN };
