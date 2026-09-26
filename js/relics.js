/* FANDHARN - relics, chests and the search for them.

   Chests come from winning (a Normal or Hard run, every tenth wave of an
   Endless run on Normal or Hard) or from searching: start a search and it
   runs for four hours by the clock - tab open or not - turning up a chest
   every hour and a half to two and a bit. Open a chest and most of the time
   there is nothing in it; sometimes a relic, now and then a few coins.

   One relic can be worn at a time. Holding more than one of the same kind
   makes some of them stronger, up to a point. */

const RELICS = [
  { id: 'pebble', name: 'Lucky Pebble', color: '#8a8f96', weight: 20, cap: 5,
    text: n => '+2% crit chance for each one held, up to 5. Now: +' + 2 * n + '%.' },
  { id: 'lead', name: 'Spare Lead', color: '#5a5f6a', weight: 20, cap: 5,
    text: n => '+0.3 click damage for each one held, up to 5. Now: +' + (0.3 * n).toFixed(1) + '.' },
  { id: 'goldstar', name: 'Gold Star', color: '#e8a93a', weight: 16, cap: 5,
    text: n => '+4% scribbles from every kill for each one held, up to 5. Now: +' + 4 * n + '%.' },
  { id: 'bookmark', name: 'Old Bookmark', color: '#c8433a', weight: 16, cap: 5,
    text: n => 'Start every run with 15 scribbles for each one held, up to 5. Now: ' + 15 * n + '.' },
  { id: 'sharpener', name: 'Pocket Sharpener', color: '#4a7fb5', weight: 12, cap: 5,
    text: n => 'The skill comes back 5% sooner for each one held, up to 5. Now: ' + 5 * n + '% sooner.' },
  { id: 'crane', name: 'Paper Crane', color: '#d8ccb8', weight: 12, cap: 5,
    text: n => 'Whoever holds the sentry post shoots 6% faster for each one held, up to 5. Now: ' + 6 * n + '% faster.' },
  { id: 'protector', name: 'Protector', color: '#4a7fb5', weight: 3, cap: 4,
    text: n => 'A small shield circles your cursor and hits whatever it runs into for half your click damage. One more shield for each one held, up to 4. Now: ' + Math.max(1, n) + (Math.max(1, n) === 1 ? ' shield.' : ' shields.') },
  { id: 'tape', name: 'Roll of Tape', color: '#b58a52', weight: 4, cap: 1,
    text: () => 'The castle starts every run with one more segment.' }
];

const CHEST_ODDS = { coins: 0.05, relic: 0.30 };          // the rest: nothing
const SEARCH_MS = 4 * 3600e3;
const SEARCH_TICK_MS = 10 * 60e3;                          // every ten minutes of searching...
const SEARCH_CHANCE = 0.07;                                // ...a 7% chance of a chest
const BOOST_LUCK = 1.3, BOOST_MS = 3600e3;                 // a boost: +30% luck for an hour
const PRICE = { chest: 3, boost: 3 };
const STACK_MAX = 9999;                                    // per inventory slot

function relicById(id) { return RELICS.find(r => r.id === id) || null; }

const Relics = {
  /* How many of a relic count right now: only the worn one does, and never
     more than it can use. */
  val(id) {
    if (Save.data.relicOn !== id) return 0;
    const r = relicById(id);
    return r ? Math.min(r.cap, Save.data.relics[id] || 0) : 0;
  },

  /* ---- chests */
  roll() {
    const r = Math.random();
    if (r < CHEST_ODDS.coins) return { kind: 'coins', n: 4 + Math.floor(Math.random() * 3) };
    if (r < CHEST_ODDS.coins + CHEST_ODDS.relic) {
      const total = RELICS.reduce((a, x) => a + x.weight, 0);
      let pick = Math.random() * total;
      for (const x of RELICS) { pick -= x.weight; if (pick <= 0) return { kind: 'relic', id: x.id }; }
      return { kind: 'relic', id: RELICS[0].id };
    }
    return { kind: 'empty' };
  },

  /* Take a chest out of the save and put whatever was in it in. */
  openChest() {
    if (!Save.takeChest()) return null;
    const got = this.roll();
    if (got.kind === 'coins') Save.addCoins(got.n);
    if (got.kind === 'relic') Save.addRelic(got.id, 1);
    return got;
  },

  /* ---- searching. All of it is timestamps, so it carries on with the tab
     shut: coming back just works out where it would have got to. Every ten
     minutes of it rolls a 7% chance of a chest (more under a luck boost).
     The rolls come from the search's own seed, so the same search always
     turns out the same however often you look at it. */
  startSearch(now) {
    if (Save.data.search) return false;
    Save.data.search = { start: now, seed: (Math.random() * 2 ** 31) | 0 };
    Save.store();
    return true;
  },

  /* When, after the start, this search turns up its chests. */
  findsOf(s) {
    if (Array.isArray(s.finds)) return s.finds;           // a search from an older save
    const out = [];
    for (let k = 1; k * SEARCH_TICK_MS <= SEARCH_MS; k++) {
      const at = k * SEARCH_TICK_MS;
      let h = (s.seed ^ Math.imul(k, 0x9E3779B1)) >>> 0;   // one fixed roll per tick
      h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
      const roll = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      const luck = this.boostedAt(s.start + at) ? BOOST_LUCK : 1;
      if (roll < SEARCH_CHANCE * luck) out.push(at);
    }
    return out;
  },

  /* ---- the luck boost */
  boostedAt(t) { return Save.data.boosts.some(b => t >= b.from && t < b.to); },
  /* How long the luck lasts from now: hours bought back to back chain on. */
  boostLeft(now) {
    let end = now;
    for (const b of Save.data.boosts.slice().sort((p, q) => p.from - q.from)) {
      if (b.from <= end && b.to > end) end = b.to;
    }
    return Math.max(0, end - now);
  },
  /* Buy an hour of luck; bought while one is running, it adds on the end. */
  buyBoost(now) {
    if (!Save.spend(PRICE.boost)) return false;
    const left = this.boostLeft(now);
    const from = left ? now + left : now;
    Save.data.boosts = Save.data.boosts.filter(b => b.to > now - SEARCH_MS);   // forget old ones
    Save.data.boosts.push({ from, to: from + BOOST_MS });
    Save.store();
    return true;
  },
  buyChests(n) {
    n = Math.max(1, Math.floor(n));
    if (!Save.spend(PRICE.chest * n)) return false;
    Save.addChests(n);
    return true;
  },

  searchState(now) {
    const s = Save.data.search;
    if (!s) return null;
    const elapsed = Math.max(0, now - s.start);
    const found = this.findsOf(s).filter(f => f <= elapsed).length;
    return { elapsed, left: Math.max(0, SEARCH_MS - elapsed), found, done: elapsed >= SEARCH_MS };
  },

  /* Finish a search that has run its four hours: the chests it found are
     handed over. Returns how many, or 0 when there was nothing to finish. */
  settleSearch(now) {
    const st = this.searchState(now);
    if (!st || !st.done) return 0;
    Save.data.search = null;
    Save.addChests(st.found);
    Save.store();
    return st.found;
  },

  /* Call it off early and keep whatever has turned up so far. */
  stopSearch(now) {
    const st = this.searchState(now);
    if (!st) return 0;
    Save.data.search = null;
    Save.addChests(st.found);
    Save.store();
    return st.found;
  },

  /* ---- the inventory: the coin purse first, then chests, then relics in
     the order they were first found. A slot holds a stack of up to
     STACK_MAX; past that a new slot starts. */
  slots() {
    const out = [{ type: 'coin', n: Save.coins }];
    const push = (type, id, n) => {
      while (n > 0) { const k = Math.min(STACK_MAX, n); out.push({ type, id, n: k }); n -= k; }
    };
    push('chest', 'chest', Save.data.chests);
    for (const id of Save.data.relicOrder) if (relicById(id)) push('relic', id, Save.data.relics[id] || 0);
    return out;
  },

  /* Four rows to start with. Once the fourth row has anything in it, every
     row that gets used opens another one under it - so there is always a
     row spare, and no end to them. */
  rows(n) {
    return Math.max(4, Math.ceil(n / 4) + 1);
  }
};

/* ------------------------------------------------------------ the icons */
/* Each drawn centred on (x, y), about 2*s across. */
const ItemIcons = {
  coin(ctx, x, y, s) {
    const pts = Rough.circlePts(x, y, s * 0.8, s * 0.04, 14);
    Rough.scribble(ctx, pts, { color: '#f2c230', spacing: 3, width: 3, overflow: 1.08 });
    Rough.poly(ctx, pts, { color: '#a5741b', width: 2, jitter: 0.5 });
    Rough.circle(ctx, x, y, s * 0.5, { color: '#a5741b', width: 1.4, jitter: 0.5, alpha: 0.7 });
  },
  chest(ctx, x, y, s, open) {
    const w = s * 1.7, h = s * 1.1, top = y - h * 0.1;
    const box = [[x - w / 2, top], [x + w / 2, top], [x + w / 2, top + h * 0.7], [x - w / 2, top + h * 0.7]];
    const lid = open
      ? [[x - w / 2, top], [x + w / 2, top], [x + w / 2 - s * 0.2, top - h * 0.55], [x - w / 2 + s * 0.2, top - h * 0.62]]
      : [[x - w / 2, top], [x + w / 2, top], [x + w / 2, top - h * 0.38], [x - w / 2, top - h * 0.38]];
    for (const p of [box, lid]) {
      Rough.scribble(ctx, p, { color: '#9a6a36', spacing: 3, width: 3, overflow: 1.08 });
      Rough.poly(ctx, p, { color: '#2b2b2b', width: 2, jitter: 0.6 });
    }
    // iron bands and the lock
    Rough.line(ctx, x - w * 0.28, top - (open ? 0 : h * 0.38), x - w * 0.28, top + h * 0.7, { color: '#5a5f6a', width: 2.2, jitter: 0.4, passes: 1 });
    Rough.line(ctx, x + w * 0.28, top - (open ? 0 : h * 0.38), x + w * 0.28, top + h * 0.7, { color: '#5a5f6a', width: 2.2, jitter: 0.4, passes: 1 });
    if (!open) Rough.blob(ctx, x, top + h * 0.05, s * 0.16, '#e8c33a', '#2b2b2b', { spacing: 3, fillWidth: 2, sides: 6, width: 1.4 });
  },
  pebble(ctx, x, y, s) {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      pts.push([x + Math.cos(a) * s * (0.8 + Math.sin(i * 2.3) * 0.12), y + Math.sin(a) * s * 0.62]);
    }
    Rough.scribble(ctx, pts, { color: '#8a8f96', spacing: 3, width: 3, overflow: 1.08 });
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2, jitter: 0.5 });
    // a four-leaf scratch on it
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      Rough.circle(ctx, x + Math.cos(a) * s * 0.18, y + Math.sin(a) * s * 0.18, s * 0.14, { color: '#4c9f70', width: 1.6, jitter: 0.3, wobble: 0.3 });
    }
  },
  lead(ctx, x, y, s) {
    const a = -0.6, c = Math.cos(a), si = Math.sin(a), L = s * 0.95, W = s * 0.2;
    const p = [[x - c * L - si * W, y - si * L + c * W], [x + c * L - si * W, y + si * L + c * W],
      [x + c * L + si * W, y + si * L - c * W], [x - c * L + si * W, y - si * L - c * W]];
    Rough.scribble(ctx, p, { color: '#4a4f5a', spacing: 2.5, width: 3, overflow: 1.1 });
    Rough.poly(ctx, p, { color: '#2b2b2b', width: 1.8, jitter: 0.4 });
    Rough.line(ctx, x - c * L * 0.7, y - si * L * 0.7 - W * 0.4, x + c * L * 0.3, y + si * L * 0.3 - W * 0.4, { color: '#fffdf4', width: 1.4, jitter: 0.3, passes: 1, alpha: 0.7 });
  },
  goldstar(ctx, x, y, s) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? s * 0.4 : s * 0.92;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    Rough.scribble(ctx, pts, { color: '#f2c230', spacing: 3, width: 3, overflow: 1.1 });
    Rough.poly(ctx, pts, { color: '#a5741b', width: 2, jitter: 0.5 });
  },
  bookmark(ctx, x, y, s) {
    const w = s * 0.5, h = s * 0.95;
    const p = [[x - w, y - h], [x + w, y - h], [x + w, y + h], [x, y + h * 0.55], [x - w, y + h]];
    Rough.scribble(ctx, p, { color: '#c8433a', spacing: 3, width: 3, overflow: 1.08 });
    Rough.poly(ctx, p, { color: '#2b2b2b', width: 2, jitter: 0.5 });
    Rough.line(ctx, x - w * 0.5, y - h * 0.5, x + w * 0.5, y - h * 0.5, { color: '#fffdf4', width: 1.4, jitter: 0.3, passes: 1, alpha: 0.8 });
  },
  sharpener(ctx, x, y, s) {
    const w = s * 0.85, h = s * 0.62;
    const p = [[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]];
    Rough.scribble(ctx, p, { color: '#4a7fb5', spacing: 3, width: 3, overflow: 1.08 });
    Rough.poly(ctx, p, { color: '#2b2b2b', width: 2, jitter: 0.5 });
    Rough.circle(ctx, x - w * 0.25, y, h * 0.5, { color: '#2b2b2b', width: 1.8, jitter: 0.3 });
    Rough.line(ctx, x + w * 0.2, y - h * 0.8, x + w * 0.8, y + h * 0.2, { color: '#b8bcc4', width: 2.4, jitter: 0.3, passes: 1 });
  },
  crane(ctx, x, y, s) {
    const body = [[x - s * 0.9, y + s * 0.1], [x + s * 0.1, y - s * 0.75], [x + s * 0.35, y + s * 0.2], [x - s * 0.1, y + s * 0.55]];
    const wing = [[x - s * 0.1, y], [x + s * 0.9, y - s * 0.3], [x + s * 0.3, y + s * 0.45]];
    for (const p of [body, wing]) {
      Rough.scribble(ctx, p, { color: '#efe6d2', spacing: 3, width: 3, overflow: 1.05 });
      Rough.poly(ctx, p, { color: '#2b2b2b', width: 1.8, jitter: 0.4 });
    }
    Rough.line(ctx, x - s * 0.9, y + s * 0.1, x - s * 1.0, y - s * 0.25, { color: '#2b2b2b', width: 1.8, jitter: 0.3, passes: 1 });
  },
  protector(ctx, x, y, s) { drawShield(ctx, x, y, s / 9.5, 0, false); },
  tape(ctx, x, y, s) {
    Rough.circle(ctx, x, y, s * 0.85, { color: '#2b2b2b', width: 2, jitter: 0.4 });
    const ring = Rough.circlePts(x, y, s * 0.85, s * 0.03, 16);
    Rough.scribble(ctx, ring, { color: '#d8b77a', spacing: 3, width: 3, overflow: 1.02, alpha: 0.9 });
    const hole = Rough.circlePts(x, y, s * 0.42, s * 0.02, 12);
    Rough.scribble(ctx, hole, { color: '#fffdf4', spacing: 2, width: 3, overflow: 1.1 });
    Rough.poly(ctx, hole, { color: '#2b2b2b', width: 1.8, jitter: 0.3 });
    Rough.line(ctx, x + s * 0.85, y, x + s * 0.95, y + s * 0.8, { color: '#d8b77a', width: 4, jitter: 0.3, passes: 1 });
  }
};

/* Draw any inventory item into a small canvas. */
function drawItemIcon(ctx, item, x, y, s) {
  if (item.type === 'coin') return ItemIcons.coin(ctx, x, y, s);
  if (item.type === 'chest') return ItemIcons.chest(ctx, x, y + s * 0.2, s, false);
  const f = ItemIcons[item.id];
  if (f) f(ctx, x, y, s);
}
