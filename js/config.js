/* FANDHARN - tuning tables. */

const BLOCK = 40;                  // one "block" of the doodle grid
const BASE_CLICK_DAMAGE = 3;      // the Plain Cursor's hit; every cursor sets its own
const BASE_CRIT_CHANCE = 0.10;
const CRIT_MULT = 1.5;             // crit = 50% more damage
const SENTRY_CRIT_CHANCE = 0.10;   // with the Sentry Drill, the post crits like you do
const CASTLE_HP = 5;               // 5 bar segments, 20% each
const WAVES_PER_RUN = 10;
const ENDLESS_BOSSES = ['boss', 'eagle', 'warden', 'hive'];   // past wave 10 it is a draw
const ENDLESS_BOSS_EVERY = 5;
const SKILL_CHARGE = 50;        // clicks to charge a skill
const SKILL_COOLDOWN = 30;      // seconds between casts, however fast you click
const GROUND_RADIUS = BLOCK * 3;   // the coloured ground around the castle
const AUGER_FROM_WAVE = 11;        // the Auger only exists out past the ten-wave run
const AUGER_STOP = GROUND_RADIUS + BLOCK * 4;   // where it halts to wind up
const TRAPPER_BASE_DMG = 6;
const TRAPPER_MAX_DMG = 10;
const TRAPPER_RANGE = BLOCK * 4.5;

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
  { count: 9,  hp: 23, speed: 45, interval: 1.60, boss: 'boss' },    // or the Eagle, 50/50
  { count: 13, hp: 28, speed: 47, interval: 1.40 },
  { count: 13, hp: 33, speed: 49, interval: 1.35 },
  { count: 13, hp: 38, speed: 51, interval: 1.30 },
  { count: 13, hp: 44, speed: 53, interval: 1.25 },
  { count: 9,  hp: 50, speed: 55, interval: 1.55, boss: 'warden' }   // or the Hive, 50/50
];

/* Past the tenth wave the table runs out, so the rest is generated. Ordinary
   enemies keep getting fatter; bosses get fatter faster, so the fight between
   waves 20 and 30 is a different animal rather than the same one for longer.
   Crowds stay where the table left them - the arrival rate is what a pair of
   hands can actually keep up with, and no amount of HP changes that. */
function endlessSpec(wave) {
  const past = wave - WAVES_PER_RUN;                 // 1 on wave 11
  const last = WAVE_TABLE[WAVES_PER_RUN - 1];
  const boss = wave % ENDLESS_BOSS_EVERY === 0
    ? ENDLESS_BOSSES[Math.floor(Math.random() * ENDLESS_BOSSES.length)] : null;
  // gently quadratic, not exponential: your click damage climbs by addition,
  // so HP that doubles every few waves would just wall the run instantly
  const scale = 1 + 0.15 * past + 0.005 * past * past;
  return {
    count: boss ? 9 : 13,
    hp: Math.round(last.hp * scale),
    speed: Math.min(86, last.speed + past * 1.1),
    interval: Math.max(0.85, last.interval - past * 0.02),
    boss: boss,
    hpScale: scale,
    bossMul: Math.pow(1.1, past / ENDLESS_BOSS_EVERY)
  };
}

function waveSpecAt(wave) {
  if (wave <= WAVES_PER_RUN) {
    const spec = WAVE_TABLE[wave - 1];
    return { count: spec.count, hp: spec.hp, speed: spec.speed, interval: spec.interval,
      boss: spec.boss || null, hpScale: 1, bossMul: 1 };
  }
  return endlessSpec(wave);
}

/* One place where an enemy's HP is decided, so the flat-HP half of the Hive
   fight scales with the wave exactly the way the Warden's multiplier does.
   `fallback` is the HP a summoner passed in for its own spawn. */
function rolledHp(kind, spec, fallback) {
  if (kind === 'boltshot') return 1;
  const k = ENEMY_KINDS[kind];
  const sc = spec ? (spec.hpScale || 1) : 1;
  const bm = k.boss ? (spec ? (spec.bossMul || 1) : 1) : 1;
  const base = k.flatHp ? k.flatHp * sc : fallback * k.hpMul;
  return Math.max(2, Math.round(base * bm));
}

const ENEMY_KINDS = {
  blob:   { r: 17, hpMul: 1.0,  speedMul: 1.00, fill: '#7a5cc4' },
  dart:   { r: 13, hpMul: 0.65, speedMul: 1.55, fill: '#3f97c9' },
  brick:  { r: 22, hpMul: 1.7,  speedMul: 0.65, fill: '#b5623a' },
  boss:   { r: 40, hpMul: 5.0,  speedMul: 0.45, boss: true, fill: '#2f2f3f' },   // splits, and spits blotlings
  warden: { r: 52, hpMul: 7.0,  speedMul: 0.38, boss: true, fill: '#5c1f3a' },  // shields itself, and calls guards
  blotling: { r: 11, hpMul: 1.0,  speedMul: 1.35, fill: '#6b4fb0' },
  // wave 5 is a coin flip between the Blot and this: far less HP, but it
  // keeps its distance and shoots, and the shots have to be cleared
  eagle:    { r: 34, hpMul: 3.6,  speedMul: 0.85, boss: true, fill: '#4a5b8f' },   // immune to Storm Caller
  boltshot: { r: 12, hpMul: 0.0,  speedMul: 3.2,  fill: '#8ea6ff' },  // always 1 HP

  // THE HIVE - wave 10's other half. Three phases, and most of these carry
  // a flat HP that ignores the wave table.
  hive:    { r: 46, hpMul: 0, flatHp: 200, speedMul: 0.34, boss: true, fill: '#c9903a' },
  worker:  { r: 13, hpMul: 0, flatHp: 6,   speedMul: 1.15, fill: '#e8c33a' },
  bee:     { r: 11, hpMul: 0, flatHp: 4,   speedMul: 1.05, fill: '#e8c33a' },
  queen:   { r: 38, hpMul: 0, flatHp: 184, speedMul: 0.5,  boss: true,  fill: '#d9a441' },
  larva:   { r: 13, hpMul: 0, flatHp: 4,   speedMul: 0,    fill: '#efe0b0' },
  steroid: { r: 26, hpMul: 0, flatHp: 20,  speedMul: 0.8,  fill: '#b5823a' },
  lavaball: { r: 17, hpMul: 0, flatHp: 10, speedMul: 0,    fill: '#e0562d' },

  // THE AUGER - endless only, wave 11 on, one or two a wave. Walks to four
  // blocks off the lawn, winds up backing away, then runs at the castle. A
  // hit mid-run stops it dead and it has to wind up all over again.
  auger:    { r: 24, hpMul: 1.5, speedMul: 0.8, fill: '#3a2436' }
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
    id: 'storm', name: 'Storm Caller', cost: 50, color: '#4a5b8f', every: 15, dmg: 2,
    desc: 'Every 15 clicks it calls down a bolt.',
    detail: '2 a click. A cloud gathers over a random enemy and half a second later the bolt lands for 50% of your click damage, splashing 4 into everything within a block of it. The Thunder Eagle drinks lightning, so none of it touches her.'
  },
  {
    id: 'magnet', name: 'Horseshoe Magnet', cost: 42, color: '#3f7d8c', every: 12, dmg: 2.5,
    desc: 'Every 12 clicks it drags the crowd in.',
    detail: '2.5 a click. Everything within 4 blocks is hauled to the point you clicked and takes 2 on the way, which leaves them stacked on top of each other for whatever you throw next.'
  },
  {
    id: 'boomerang', name: 'Boomerang', cost: 46, color: '#8a6a3a', every: 10, dmg: 3,
    desc: 'Every 10 clicks it throws, and it comes back.',
    detail: '3 a click. The throw loops out five blocks and curves home again, cutting 3 into everything on the way out and 3 more into everything on the way back - line the arc up and the same enemy pays twice.'
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
    id: 'paper', name: 'Thick Paper', cost: 62, color: '#c9a36b',
    desc: 'The castle is redrawn on card stock.',
    detail: 'One more castle segment, permanently - six instead of five - and the new one starts full. It is the only thing in the game that raises your ceiling instead of patching the damage.'
  },
  {
    id: 'double', name: 'Double Trouble', cost: 92, color: '#8a5cc4',
    desc: 'Half your cursor belongs to someone else.',
    detail: 'One side of the cursor is redrawn as another cursor, picked at random, and from then on the charge fires both tricks, taking it in turns. One of the most expensive things on the page, and worth it.'
  },
  {
    id: 'afterimage', name: 'Afterimage', cost: 66, color: '#7a7f8c',
    desc: 'A ghost of your hand, running late.',
    detail: 'A faded copy of the cursor trails a third of a second behind you and repeats every click it saw, at half damage. It cannot crit and it does not charge anything - it just keeps hitting.'
  },
  {
    id: 'sentry', name: 'Stick Sentry', cost: 46, color: '#4c9f70', sentry: true,
    desc: 'A stick figure takes the sentry post.',
    detail: 'A doodled archer stands by the castle and plinks the nearest enemy every 1.6s for 3 damage. There is only one post, so taking this evicts whatever was standing in it.'
  },
  {
    id: 'bird', name: 'Electric Bird', cost: 64, color: '#8ea6ff', sentry: true, needsEagle: true,
    desc: 'A hatchling off the Thunder Eagle.',
    detail: "Takes the sentry post, plinks the nearest enemy every 1.5s for 2, and every 3s throws itself six blocks at your cursor, carving 4 into everything on the line. Hold still and it winds up: after 2s of not moving and not clicking, every further second cuts 0.1s off that dash, down to 1s. Move or click and the wind-up is gone. Only offered once you have put the Eagle down - and it drops one of these itself, half the time."
  },
  {
    id: 'drill', name: 'Sentry Drill', cost: 70, color: '#d99a26',
    desc: 'Whoever holds the post gets better at it.',
    detail: 'Permanently, for whoever stands in the sentry post: every hit it lands can crit the way yours do - 10% of the time, for 50% more. On top of that the stick figure looses a second arrow a beat behind the first, the Blob\'d-Tier adds a third blot straight up the middle with no curve, and the Electric Bird hits for 4 and dashes every 2.5s instead of 3.'
  },
  {
    id: 'trapper', name: 'Trapper', cost: 96, color: '#5e9e3a', sentry: true, stacks: true,
    desc: 'Something with teeth, planted by the castle.',
    detail: 'A fly trap takes the sentry post. When anything walks inside four and a half blocks of it, it sinks into the page, tunnels across under the ground and bursts up underneath: 6 damage, a stun, and the thing is spat two blocks back the way it came. Unlike the other sentries you can keep buying it while it holds the post - every Trapper you buy bites 1 harder, up to 10.'
  },
  {
    id: 'blobd', name: "Blob'd-Tier", cost: 58, color: '#6b4fb0', sentry: true, needsBlot: true,
    desc: 'A piece of the Blot, working for you.',
    detail: "Takes the sentry post and lobs two ink blots every 1.9s, one arcing over the top and one under, for 2 damage each. Only offered once you have put the Blot down - and it drops one of these itself, half the time."
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
    id: 'deepink', name: 'Deep Ink', base: 24, growth: 1.35, color: '#37306b',
    desc: 'Everything soaks in longer.',
    detail: lv => 'Every status you inflict lasts +' + (0.3 * lv).toFixed(1) + 's longer at this level: burns, slows, stains, stuns, the lot.'
  },
  {
    id: 'credit', name: 'Extra Credit', base: 22, growth: 1.35, color: '#d99a26',
    desc: 'Marks for effort.',
    detail: lv => '+5% scribbles from every kill per level. At this level every body is worth ' + (100 + 5 * lv) + '% of what it used to be.'
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

// A reroll is priced off the three cards in front of you: the better the hand
// you are throwing away, the more it costs to throw it away.
const REROLL_DIVISOR = 2.5;
function rerollPrice(offers) {
  const sum = offers.reduce((t, o) => t + o.cost, 0);
  return Math.max(5, Math.round(sum / REROLL_DIVISOR));
}
function offerCost(base, wave) { return Math.round(base * waveCostMul(wave)); }

/* ---- SKILLS --------------------------------------------------------------
   Every cursor has one, charged by clicking and fired by hand: right-click on
   a mouse, or the button in the corner on a touchscreen. It never fires
   itself. 50 clicks to charge, and 30s between casts whatever your click
   rate, so it stays an event rather than a rotation. */
const SKILLS = {
  storm:   { name: 'THUNDERHEAD', blurb: 'the sky opens over everything near you and over the castle' },
  compass: { name: 'PERIMETER',   blurb: 'a circle drawn from the castle shoves the whole board to the edges' },
  scissor: { name: 'GUILLOTINE',  blurb: 'the paper is cut in half and the busier half is scrapped' },
  buzz:    { name: 'EIGHT WAYS',  blurb: 'static fires out of your cursor down eight lines at once' },
  wet:     { name: 'CLOUDBURST',  blurb: 'the page floods, and everything standing in it is soaked and slowed' },
  pen:     { name: 'CROSSHATCH',  blurb: 'the whole screen is hatched over, and the lines bite' },
  eraser:  { name: 'SECOND DRAFT', blurb: 'the page is scrubbed back and everything is redrawn worse - except the castle' },
  plain:   { name: 'EXCLAMATION', blurb: 'one enormous mark slams down where you point it' },
  magnet:  { name: 'POLE REVERSAL', blurb: 'the whole board is hauled into one heap, then flung apart' },
  boomerang: { name: 'FLIGHT PATH', blurb: 'five of them criss-cross the page and none of them stop' }
};

function skillFor(cursorId) { return SKILLS[cursorId] || SKILLS.plain; }

// which occupant each sentry offer puts in the post
const SENTRY_OF = { sentry: 'stick', blobd: 'blobd', bird: 'bird', trapper: 'trapper' };

function cursorById(id) { return CURSORS.find(c => c.id === id) || CURSORS[0]; }
function oneshotById(id) { return ONESHOT.find(u => u.id === id); }
function stackingById(id) { return STACKING.find(u => u.id === id); }
function stackingCost(up, level) { return Math.round(up.base * Math.pow(up.growth, level)); }
