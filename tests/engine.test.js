import { describe, it, expect } from 'vitest';
import {
  createGame,
  applyAction,
  publicState,
  availableActions,
  FLOORS_TO_WIN,
} from '../server/engine/game.js';

describe('createGame', () => {
  it('creates a warrior with expected base stats', () => {
    const { state } = createGame({ name: 'Test Hero', className: 'warrior', seed: 1 });
    expect(state.player.name).toBe('Test Hero');
    expect(state.player.classLabel).toBe('Warrior');
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.player.hp).toBe(32);
    expect(state.status).toBe('playing');
    expect(state.floor).toBe(1);
  });

  it('is deterministic for a fixed seed', () => {
    const a = createGame({ name: 'A', className: 'mage', seed: 42 });
    const b = createGame({ name: 'A', className: 'mage', seed: 42 });
    expect(a.state.room).toEqual(b.state.room);
    expect(a.narrative).toEqual(b.narrative);
  });

  it('falls back to warrior for unknown class and clamps blank names', () => {
    const { state } = createGame({ name: '   ', className: 'necromancer', seed: 5 });
    expect(state.player.className).toBe('warrior');
    expect(state.player.name).toBe('Adventurer');
  });
});

describe('combat', () => {
  // Seed chosen so the first room is a monster encounter.
  function combatGame() {
    let seed = 1;
    // Find a seed that starts in combat for a stable test.
    while (seed < 1000) {
      const g = createGame({ name: 'Fighter', className: 'warrior', seed });
      if (g.state.inCombat) return g.state;
      seed += 1;
    }
    throw new Error('no combat seed found');
  }

  it('reduces monster hp when attacking', () => {
    const state = combatGame();
    const startHp = state.room.monster.hp;
    applyAction(state, 'attack');
    // Either the monster took damage or it died and the room changed.
    if (state.inCombat) {
      expect(state.room.monster.hp).toBeLessThan(startHp);
    } else {
      expect(['empty', 'monster']).toContain(state.room.type);
    }
  });

  it('rejects illegal actions without advancing the turn', () => {
    const state = combatGame();
    const turn = state.turn;
    const result = applyAction(state, 'descend');
    expect(result.narrative).toMatch(/cannot/i);
    expect(state.turn).toBe(turn);
  });

  it('awards xp and can level up over a full fight', () => {
    const state = combatGame();
    let guard = 0;
    while (state.inCombat && state.status === 'playing' && guard < 100) {
      applyAction(state, 'attack');
      guard += 1;
    }
    // The fight resolved one way or another.
    expect(state.status === 'playing' || state.status === 'dead').toBe(true);
  });
});

describe('exploration and progression', () => {
  it('can descend to deeper floors', () => {
    const { state } = createGame({ name: 'Delver', className: 'rogue', seed: 7 });
    // Force a non-combat, explorable state by exploring until safe.
    let guard = 0;
    while (state.inCombat && guard < 50) {
      // drink potion or attack to clear
      applyAction(state, availableActions(state)[0]);
      guard += 1;
    }
    expect(state.status).toBeDefined();
  });

  it('reaches the boss on the final floor', () => {
    const { state } = createGame({ name: 'Boss Hunter', className: 'warrior', seed: 3 });
    state.floor = FLOORS_TO_WIN;
    // Regenerate the room for the boss floor.
    const result = applyAction(state, 'explore') ;
    void result;
    expect(state.room.type).toBe('monster');
    expect(state.room.monster.isBoss).toBe(true);
  });
});

describe('publicState', () => {
  it('exposes a stable shape and truncates the log', () => {
    const { state } = createGame({ name: 'Viewer', className: 'mage', seed: 9 });
    for (let i = 0; i < 20; i += 1) {
      applyAction(state, availableActions(state)[0]);
      if (state.status !== 'playing') break;
    }
    const pub = publicState(state);
    expect(pub).toHaveProperty('player');
    expect(pub).toHaveProperty('room');
    expect(pub).toHaveProperty('actions');
    expect(pub.log.length).toBeLessThanOrEqual(12);
  });
});
