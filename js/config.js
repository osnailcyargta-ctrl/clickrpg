/* FANDHARN - tuning tables. */

const BLOCK = 40;                  // one "block" of the doodle grid
const BASE_CLICK_DAMAGE = 3;      // the Plain Cursor's hit; every cursor sets its own
const BASE_CRIT_CHANCE = 0.10;
const CRIT_MULT = 1.5;             // crit = 50% more damage
const CASTLE_HP = 5;               // 5 bar segments, 20% each
const WAVES_PER_RUN = 10;
const GROUND_RADIUS = BLOCK * 3;   // the coloured ground around the castle

const DIFFICULTIES = {
  easy:   { name: 'EASY',   hpMul: 0.65, countMul: 0.65, speedMul: 0.85, intervalMul: 1.2,  color: '#4c9f70', reward: 0.9 },
  normal: { name: 'NORMAL', hpMul: 1.00, countMul: 1.00, speedMul: 1.00, intervalMul: 1.0,  color: '#d99a26', reward: 1.0 },
  hard:   { name: 'HARD',   hpMul: 1.70, countMul: 1.40, speedMul: 1.20, intervalMul: 0.85, color: '#c8433a', reward: 1.25 }
};

// Ten waves. Wave 5 and wave 10 carry a boss.
// Enemy COUNT climbs up to the first boss and then stops for good - after that
// fight the waves get meaner through HP and speed, not through bigger crowds.
const WAVE_TABLE = [
  { count: 6,  hp: 8,  speed: 34, interval: 1.70 },
  { count: 8,  hp: 11, speed: 37, interval: 1.60 },
  { count: 10, hp: 15, speed: 40, interval: 1.50 },
  { count: 12, hp: 19, speed: 43, interval: 1.40 },
  { count: 13, hp: 23, speed: 45, interval: 1.40, boss: 'boss' },
  { count: 13, hp: 28, speed: 47, interval: 1.40 },
  { count: 13, hp: 33, speed: 49, interval: 1.35 },
  { count: 13, hp: 38, speed: 51, interval: 1.30 },
  { count: 13, hp: 44, speed: 53, interval: 1.25 },
  { count: 13, hp: 50, speed: 55, interval: 1.30, boss: 'warden' }
];

const ENEMY_KINDS = {
  blob:   { r: 17, hpMul: 1.0,  speedMul: 1.00, fill: '#7a5cc4' },
  dart:   { r: 13, hpMul: 0.65, speedMul: 1.55, fill: '#3f97c9' },
  brick:  { r: 22, hpMul: 1.7,  speedMul: 0.65, fill: '#b5623a' },
  boss:   { r: 40, hpMul: 5.0,  speedMul: 0.45, fill: '#2f2f3f' },   // splits, and spits blotlings
  warden: { r: 52, hpMul: 7.0,  speedMul: 0.38, fill: '#5c1f3a' },  // shields itself, and calls guards
  blotling: { r: 11, hpMul: 1.0, speedMul: 1.35, fill: '#6b4fb0' }
};

/* ---- CURSORS -------------------------------------------------------------
   The cursor IS the weapon. Buying one throws the old one away for good -
   there is no inventory, so going back means buying it again.

   Every cursor hits for its own `dmg`, and that number is the trade: the ones
   with a strong charge hit softer per click, the ones that hit hard have
   little or nothing else going on. Balanced around a human click rate - about
   5-6 a second on a mouse, 7-8 on a phone with two thumbs - not around
   spamming. */
const CURSORS = [
  {
    id: 'plain', name: 'Plain Cursor', cost: 0, color: '#2b2b2b', every: 0, dmg: 3,
    desc: 'The arrow you were born with.',
    detail: '3 damage a click and nothing else. Middle of the road on purpose.'
  },
  {
    id: 'wet', name: 'Wet Cursor', cost: 28, color: '#2f8fd6', every: 15, dmg: 2.5,
    desc: 'Every 15 clicks it spits 6 water shots.',
    detail: '2.5 a click. Each drop swells, hops one block in one of 9 random directions, shrinks as gravity grabs it, then pops for 3 damage.'
  },
  {
    id: 'pen', name: 'Pen Tool', cost: 34, color: '#2f6f4f', every: 0, trail: true, dmg: 2,
    desc: 'A pencil that never stops drawing.',
    detail: '2 a click, and a live ink trail wherever you drag it. The trail lingers 1.4s and grinds 1 damage into everything that crosses it, so a crowd walks through it all at once.'
  },
  {
    id: 'eraser', name: 'Eraser Cursor', cost: 32, color: '#e58ba0', every: 12, dmg: 2.5,
    desc: 'Every 12 clicks it rubs a hole in the drawing.',
    detail: '2.5 a click. Enemies caught lose 20% of their max HP outright - undrawn, not damaged - and crawl 25% slower for 2s. The fatter the target, the better it works.'
  },
  {
    id: 'buzz', name: 'Buzz Cursor', cost: 38, color: '#e8c33a', every: 8, dmg: 2.5,
    desc: 'Every 8 clicks it arcs static to 3 enemies.',
    detail: '2.5 a click. Chains up to 3 targets within 4 blocks for 3 damage each and freezes them mid-scribble for 0.35s.'
  },
  {
    id: 'compass', name: 'Compass Cursor', cost: 40, color: '#8a5cc4', every: 10, dmg: 2,
    desc: 'Every 10 clicks it draws a circle.',
    detail: 'The softest click at 2, and the widest hit: the compass sweeps an ink ring out to 3 blocks over a second, carving 5 damage into everything the line passes through.'
  },
  {
    id: 'scissor', name: 'Scissor Cursor', cost: 44, color: '#c8433a', every: 0, dmg: 4,
    desc: 'Snips anything that is nearly gone.',
    detail: 'The hardest click at 4, with no charge at all. Any non-boss enemy already under 18% HP is cut clean out of the drawing instead of damaged. Nothing here helps against a crowd.'
  }
];

/* ---- ONE-SHOT UPGRADES ---------------------------------------------------
   Bought once, then gone from the offers forever. */
const ONESHOT = [
  {
    id: 'molten', name: 'Molten Leftkey', cost: 40, color: '#e0562d',
    desc: 'Your left key runs hot.',
    detail: 'Every 5 clicks a fire blast erupts 2 blocks around your cursor for half your click damage, and sets whatever it touches on fire for 3s: 2-3 damage a second, and burning enemies move 15% faster.'
  },
  {
    id: 'ink', name: 'Ink Overflow', cost: 36, color: '#37306b',
    desc: 'Crits burst the ink cartridge.',
    detail: 'Every critical hit dumps a 1.4 block ink puddle for 4s that slows enemies 30% and stains them for 2 damage a second.'
  },
  {
    id: 'chalk', name: 'Chalk Ward', cost: 34, color: '#8ec5e8',
    desc: 'A chalk circle around the castle.',
    detail: 'Two chalk shield charges. Each one eats a hit instead of your HP, and the ward is re-drawn at the start of every wave.'
  },
  {
    id: 'sentry', name: 'Stick Sentry', cost: 46, color: '#4c9f70',
    desc: 'A stick figure joins the defence.',
    detail: 'A doodled archer stands by the castle and plinks the nearest enemy every 1.6s for 3 damage. It never gets tired, because it is a drawing.'
  }
];

/* ---- STACKING UPGRADES ---------------------------------------------------
   No level cap. They keep showing up in the offers, and the price climbs
   every time you take one. */
const STACKING = [
  {
    id: 'lead', name: 'Thick Lead', base: 22, growth: 1.35, color: '#5a5f6a',
    desc: 'Press harder.',
    detail: lv => '+0.5 click damage per level, on top of whatever cursor you are holding. Level ' + lv + ' means +' + (0.5 * lv).toFixed(1) + '.'
  },
  {
    id: 'nib', name: 'Sharp Nib', base: 20, growth: 1.35, color: '#c8433a',
    desc: 'Sharpened to a needle.',
    detail: lv => '+3% crit chance per level. Right now you crit ' + Math.round((BASE_CRIT_CHANCE + 0.03 * lv) * 100) + '% of the time, for 50% more damage.'
  },
  {
    id: 'wax', name: 'Fat Crayon', base: 26, growth: 1.35, color: '#e0562d',
    desc: 'A crayon the size of your fist.',
    detail: lv => '+12% size and +10% damage on every blast, puddle and pop. Right now they are ' + Math.round((1 + 0.12 * lv) * 100) + '% size.'
  },
  {
    id: 'patch', name: 'Tape Patch', base: 18, growth: 1.5, color: '#4c9f70',
    desc: 'Sticky tape over the cracks.',
    detail: () => 'Tapes one castle segment back together. Only offered while the castle is damaged, and the tape costs more every time.'
  }
];

// Cards cost more the deeper the run goes, so a fat purse never trivialises
// the choice.
function waveCostMul(wave) { return 1 + 0.2 * Math.max(0, wave - 1); }
function offerCost(base, wave) { return Math.round(base * waveCostMul(wave)); }

function cursorById(id) { return CURSORS.find(c => c.id === id) || CURSORS[0]; }
function oneshotById(id) { return ONESHOT.find(u => u.id === id); }
function stackingById(id) { return STACKING.find(u => u.id === id); }
function stackingCost(up, level) { return Math.round(up.base * Math.pow(up.growth, level)); }
