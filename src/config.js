// CALDERA BAY — world constants, palettes, weapons, radio, economy.
// Everything the modules share lives here so a single file tunes the game.
export const WORLD = {
  size: 480, // world is size x size, centred on (0, 0)
  roadSpacing: 40,
  roadWidth: 11,
  roadLines: [-200, -160, -120, -80, -40, 0, 40, 80, 120, 160, 200],
  blockSize: 29,
  waterLevel: -0.6,
  defaultSeed: 7,
  dayLengthSeconds: 600, // a full day/night cycle in-game
  goldenHour: 17.4, // start of day in hours: golden hour
};

export const ECONOMY = {
  startCash: 250,
  resprayCost: 150,
  taxiBaseFare: 40,
  racePrize: 300,
  tapeBonus: 500, // for all 20 Sunset Tapes
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, fireRate: 2.2, mag: Infinity, range: 3, auto: false, price: 0, spread: 0 },
  pistol: { name: 'CB-9 Pistol', damage: 26, fireRate: 3.2, mag: 12, range: 55, auto: false, price: 0, spread: 0.012 },
  smg: { name: 'Vulcan SMG', damage: 16, fireRate: 9, mag: 30, range: 45, auto: true, price: 450, spread: 0.03 },
  shotgun: { name: 'Blackshore 12G', damage: 18, fireRate: 1.4, mag: 6, range: 26, auto: false, price: 800, spread: 0.07, pellets: 6 },
  rifle: { name: 'Caldera AR', damage: 34, fireRate: 5.5, mag: 24, range: 90, auto: true, price: 1400, spread: 0.015 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export const RADIO = [
  { id: 'heat', name: 'HEAT 91.2 FM', genre: 'Sunset synth', bpm: 112, root: 55, scale: [0, 3, 5, 7, 10], wave: 'sawtooth', tracks: ['Neon Causeway', 'Black Sand Drive', 'Volcano Nights'] },
  { id: 'tide', name: 'TIDE 104.7 FM', genre: 'Island reggae', bpm: 84, root: 65.4, scale: [0, 2, 4, 7, 9], wave: 'triangle', tracks: ['Marina Breeze', 'Palmera Moon', 'Slow Tide'] },
  { id: 'furnace', name: 'FURNACE 88.1 FM', genre: 'Foundry rock', bpm: 132, root: 49, scale: [0, 3, 5, 6, 7, 10], wave: 'square', tracks: ['Foundry Fire', 'Ridge Runner', 'Asphalt Choir'] },
];

export const PALETTE = {
  sky: 0xffd9a0,
  skyTop: 0x7fb2e5,
  fog: 0xf2b879,
  sun: 0xffd27a,
  ground: 0x8a7a5f,
  sand: 0x1f1a17, // black sand
  road: 0x2e2a28,
  roadLine: 0xd8c86a,
  sidewalk: 0x9a8d78,
  water: 0x1d6f8a,
  building: [0xe8dcc8, 0xd9c4a5, 0xc9b18c, 0xb7a284, 0xe5c8a8, 0xd8b48f],
  neon: [0xff2e88, 0x00e5ff, 0xffe600, 0x7cff00, 0xff6b00],
  car: [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400],
};

export const CONTROLS_TEXT = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint / boost'],
  ['E', 'Enter / exit car · steal · interact'],
  ['Space', 'Handbrake (in car) · jump (on foot)'],
  ['Click', 'Shoot'], ['R', 'Reload'], ['1–5', 'Switch weapon'],
  ['Q', 'Radio station'], ['M', 'Start next mission'],
  ['Esc', 'Pause · map · stats'], ['H', 'Toggle help'],
];

export const SAVE_KEY = 'caldera-bay-save-v1';
