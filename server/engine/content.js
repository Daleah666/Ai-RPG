// Static content pools used by the procedural "AI Dungeon Master".
// Keeping this data-driven makes the narrative varied while the engine
// stays deterministic under a fixed seed.

export const CLASSES = {
  warrior: {
    label: 'Warrior',
    maxHp: 32,
    attack: 8,
    defense: 4,
    flavor: 'a battle-scarred veteran who trusts steel over sorcery',
  },
  mage: {
    label: 'Mage',
    maxHp: 22,
    attack: 11,
    defense: 2,
    flavor: 'a scholar of the arcane whose spells crackle at their fingertips',
  },
  rogue: {
    label: 'Rogue',
    maxHp: 26,
    attack: 9,
    defense: 3,
    flavor: 'a nimble shadow who strikes where the light does not reach',
  },
};

export const MONSTERS = [
  { id: 'giant_rat', name: 'Giant Rat', hp: 8, attack: 4, xp: 6, gold: [1, 4] },
  { id: 'goblin', name: 'Goblin Skirmisher', hp: 12, attack: 5, xp: 10, gold: [3, 8] },
  { id: 'skeleton', name: 'Rattling Skeleton', hp: 15, attack: 6, xp: 14, gold: [4, 10] },
  { id: 'shadow_wisp', name: 'Shadow Wisp', hp: 13, attack: 8, xp: 18, gold: [0, 3] },
  { id: 'dire_wolf', name: 'Dire Wolf', hp: 20, attack: 7, xp: 20, gold: [2, 9] },
  { id: 'orc', name: 'Orc Marauder', hp: 26, attack: 9, xp: 28, gold: [8, 18] },
];

export const BOSS = {
  id: 'cave_troll',
  name: 'Grukthar, the Cave Troll',
  hp: 60,
  attack: 12,
  xp: 120,
  gold: [40, 80],
};

export const ROOM_DESCRIPTIONS = [
  'a damp stone chamber where water drips into unseen pools',
  'a collapsed hall, its pillars cracked like old bone',
  'a mushroom-lit grotto humming with faint, sickly light',
  'a narrow crypt lined with forgotten burial niches',
  'an echoing cavern where your footsteps return as whispers',
  'a rune-scarred vault that reeks of scorched iron',
  'a flooded passage where cold water laps at your ankles',
  'a torch-lit gallery hung with tattered war banners',
];

export const MONSTER_INTROS = [
  'From the gloom, {monster} lunges toward you!',
  'A snarl cuts the silence — {monster} bars your path.',
  'Something stirs. {monster} rises to meet your blade.',
  '{monster} emerges from the shadows, hungry and hostile.',
];

export const HIT_VERBS = ['strikes', 'slashes', 'batters', 'hammers', 'carves into'];

export const TREASURE_FLAVORS = [
  'A moss-covered chest sits in the corner.',
  'Coins glint beneath a fallen skeleton.',
  'A hidden alcove reveals a stash of supplies.',
  'A dead adventurer clutches something valuable.',
];

export const WEAPONS = [
  { id: 'rusty_dagger', name: 'Rusty Dagger', bonus: 1 },
  { id: 'iron_sword', name: 'Iron Sword', bonus: 3 },
  { id: 'silver_axe', name: 'Silver Axe', bonus: 5 },
  { id: 'runed_blade', name: 'Runed Blade', bonus: 7 },
];

export const ARMORS = [
  { id: 'leather_armor', name: 'Leather Armor', bonus: 1 },
  { id: 'chainmail', name: 'Chainmail', bonus: 3 },
  { id: 'plate_armor', name: 'Plate Armor', bonus: 5 },
];
