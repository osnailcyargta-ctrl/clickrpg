/* FANDHARN - tuning tables. "Fandharn" doesn't mean anything, it's gibberish. */

const BLOCK = 40;               // one "block" of the doodle grid
const BASE_CLICK_DAMAGE = 2;
const BASE_CRIT_CHANCE = 0.10;
const CRIT_MULT = 1.5;          // crit = 50% more damage
const CASTLE_HP = 3;
const WAVES_PER_RUN = 5;

const DIFFICULTIES = {
  easy:   { name: 'EASY',   hpMul: 0.65, countMul: 0.65, speedMul: 0.85, intervalMul: 1.2, color: '#4c9f70', reward: 0.9 },
  normal: { name: 'NORMAL', hpMul: 1.00, countMul: 1.00, speedMul: 1.00, intervalMul: 1.0, color: '#d99a26', reward: 1.0 },
  hard:   { name: 'HARD',   hpMul: 1.70, countMul: 1.40, speedMul: 1.20, intervalMul: 0.85, color: '#c8433a', reward: 1.25 }
};

// Per-wave baseline, scaled by difficulty. Five waves, that's the whole run.
const WAVE_TABLE = [
  { count: 6,  hp: 8,  speed: 34, interval: 1.70 },
  { count: 9,  hp: 12, speed: 38, interval: 1.55 },
  { count: 12, hp: 17, speed: 42, interval: 1.40 },
  { count: 14, hp: 24, speed: 46, interval: 1.30 },
  { count: 17, hp: 33, speed: 50, interval: 1.20, boss: true }
];

const ENEMY_KINDS = {
  blob:  { r: 17, hpMul: 1.0,  speedMul: 1.0,  fill: '#7a5cc4', label: 'blob' },
  dart:  { r: 13, hpMul: 0.65, speedMul: 1.55, fill: '#3f97c9', label: 'dart' },
  brick: { r: 22, hpMul: 1.9,  speedMul: 0.65, fill: '#b5623a', label: 'brick' },
  boss:  { r: 38, hpMul: 3.0,  speedMul: 0.5,  fill: '#2f2f3f', label: 'boss' }
};

/* ---- CURSORS -------------------------------------------------------------
   A cursor IS the weapon. Buying one swaps the weapon you're holding, so only
   one is ever active. Each keeps its own click counter. */
const CURSORS = [
  {
    id: 'plain',
    name: 'Plain Cursor',
    cost: 0,
    color: '#2b2b2b',
    every: 0,
    desc: 'The arrow you were born with. 2 damage per click, 10% crit.',
    detail: 'No trick up its sleeve.'
  },
  {
    id: 'wet',
    name: 'Wet Cursor',
    cost: 26,
    color: '#2f8fd6',
    every: 15,
    desc: 'Every 15 clicks it spits 6 water shots.',
    detail: 'Each drop swells, hops one block in one of 9 random directions, shrinks as gravity grabs it, then pops for 2 damage.'
  },
  {
    id: 'graphite',
    name: 'Graphite Cursor',   // original
    cost: 30,
    color: '#5a5f6a',
    every: 10,
    desc: 'Every 10 clicks it scribbles a live pencil line.',
    detail: 'The line is drawn between your previous and current click and stays on the paper for 2.5s, grinding 1 damage every 0.25s into anything that crosses it.'
  },
  {
    id: 'eraser',
    name: 'Eraser Cursor',     // original
    cost: 34,
    color: '#e58ba0',
    every: 12,
    desc: 'Every 12 clicks it rubs a 1.5 block hole in the drawing.',
    detail: 'Enemies caught lose 20% of their max HP outright (undrawn, not damaged) and crawl 25% slower for 2s because their legs got erased.'
  },
  {
    id: 'buzz',
    name: 'Buzz Cursor',       // original
    cost: 38,
    color: '#e8c33a',
    every: 8,
    desc: 'Every 8 clicks it arcs static to 3 enemies.',
    detail: 'Chains up to 3 targets within 4 blocks for 3 damage each and freezes them mid-scribble for 0.35s.'
  }
];

/* ---- UPGRADES ------------------------------------------------------------
   Passive, stack up to 3 levels, keep working no matter which cursor you hold. */
const UPGRADES = [
  {
    id: 'molten',
    name: 'Molten Leftkey',
    levels: 3,
    cost: [28, 40, 55],
    color: '#e0562d',
    desc: 'Your left key runs hot.',
    detail: function (lv) {
      const n = [5, 4, 3][Math.max(0, lv - 1)] || 5;
      return 'Every ' + n + ' clicks, a fire blast erupts 2 blocks around your cursor for half your click damage, and sets everything it touches on fire for 3s (2-3 damage per second, +15% enemy speed while burning).';
    }
  },
  {
    id: 'ink',
    name: 'Ink Overflow',      // original
    levels: 3,
    cost: [26, 38, 52],
    color: '#37306b',
    desc: 'Crits burst the ink cartridge.',
    detail: function (lv) {
      return 'Every critical hit dumps an ink puddle (' + (1.2 + 0.3 * (lv - 1)).toFixed(1) + ' blocks) that lasts 4s, slows enemies by 30% and stains them for ' + lv + ' damage per second.';
    }
  },
  {
    id: 'chalk',
    name: 'Chalk Ward',        // original
    levels: 3,
    cost: [30, 45, 62],
    color: '#8ec5e8',
    desc: 'A chalk circle around the castle.',
    detail: function (lv) {
      return 'The castle gains ' + lv + ' chalk shield charge' + (lv > 1 ? 's' : '') + '. Each one eats a hit instead of your HP, and the whole ward is re-drawn at the start of every wave.';
    }
  }
];

function upgradeDetail(up, lv) {
  return typeof up.detail === 'function' ? up.detail(Math.max(1, lv)) : up.detail;
}
