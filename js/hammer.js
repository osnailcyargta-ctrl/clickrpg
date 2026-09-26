/* FANDHARN - the Sledgehammer, and its skill QUAKE.

   A click does nothing. Hold for at least 0.75s and let go, and it comes
   down on everything within a block and a half. Every full second more you
   hold adds 20%, and at three seconds it comes down by itself at +40%.

   QUAKE rolls a shockwave out from the castle to the edge of the page; as
   it passes, everything on the page is stunned for a second and knocked a
   block back. */

/* How much a hold of `t` seconds is worth: nothing under the minimum, then
   1.0, 1.2, 1.4 a whole second apart (at 0.75s, 1.75s, 2.75s). */
function hammerMult(t) {
  if (t < HAMMER_MIN) return 0;
  return 1 + HAMMER_STEP * Math.min(HAMMER_MAX - HAMMER_MIN, Math.floor(t - HAMMER_MIN + 1e-6));
}

/* ------------------------------------------------------------ the sprite */
/* The head sits on the hotspot; the handle runs off down-right. While it
   is being held it tips back further the longer you hold, and shakes. */
CursorSprites.hammer = function (ctx, x, y, s, color, t) {
  const hold = (typeof Game !== 'undefined' && Game.hold) ? Game.hold.t : 0;
  const lift = Math.min(1, hold / HAMMER_MAX);
  const shake = hold > HAMMER_MIN ? (hold - HAMMER_MIN) * 1.2 : 0;
  // A sledgehammer side-on: a long handle running off to the right, and at
  // its end a heavy steel block standing upright, square to the handle, its
  // bottom face sitting on the pointer. Held down, it swings up and back
  // round the grip, the way you would haul one over your shoulder.
  const L = 42 * s;                   // grip to the middle of the head
  const hh = 16 * s, ht = 8 * s;      // head: half its length, half its thickness
  ctx.save();
  ctx.translate(x + L + Rough.jit(shake), y - hh - 2 * s + Rough.jit(shake));
  ctx.rotate(lift * 1.15);
  // the handle: long, straight, a touch thicker at the grip
  const handle = [[-L + ht, -2.3 * s], [2 * s, -3.4 * s], [2 * s, 3.4 * s], [-L + ht, 2.3 * s]];
  Rough.scribble(ctx, handle, { color: '#c69a5e', spacing: 3, width: 2.6, overflow: 1.1 });
  Rough.poly(ctx, handle, { color: '#2b2b2b', width: 1.8, jitter: 0.5 });
  Rough.line(ctx, -L + ht + 4 * s, 0.6 * s, -4 * s, 1.1 * s, { color: '#8a6238', width: 1.2, jitter: 0.4, passes: 1, alpha: 0.7 });
  // grip tape round the end you hold
  for (let i = 0; i < 4; i++) {
    const gx = -1 * s - i * 3.6 * s;
    Rough.line(ctx, gx - 1.2 * s, -3.4 * s, gx + 1.2 * s, 3.4 * s, { color: color, width: 2.4, jitter: 0.3, passes: 1 });
  }
  // the head: a solid steel block, square to the handle
  const cx = -L;
  const head = [[cx - ht, -hh + 2 * s], [cx + ht, -hh + 2 * s], [cx + ht, hh - 2 * s], [cx - ht, hh - 2 * s]];
  Rough.scribble(ctx, head, { color: '#7d848c', spacing: 3, width: 4, overflow: 1.1 });
  Rough.poly(ctx, head, { color: '#2b2b2b', width: 2.2, jitter: 0.5 });
  // the two striking faces, a little proud of the block
  for (const sgn of [-1, 1]) {
    const y0 = sgn * (hh - 2 * s), y1 = sgn * hh;
    const face = [[cx - ht - 1.2 * s, y0], [cx + ht + 1.2 * s, y0], [cx + ht + 0.6 * s, y1], [cx - ht - 0.6 * s, y1]];
    Rough.scribble(ctx, face, { color: '#5a6068', spacing: 2.5, width: 3, overflow: 1.1 });
    Rough.poly(ctx, face, { color: '#2b2b2b', width: 2, jitter: 0.4 });
  }
  // the eye the handle goes through, and a glint down the steel
  Rough.poly(ctx, [[cx + ht, -3 * s], [cx + ht + 2.6 * s, -3.6 * s], [cx + ht + 2.6 * s, 3.6 * s], [cx + ht, 3 * s]],
    { color: '#2b2b2b', width: 1.6, jitter: 0.3 });
  Rough.line(ctx, cx - ht + 2.2 * s, -hh + 4.5 * s, cx - ht + 2.2 * s, hh - 5 * s,
    { color: '#fffdf4', width: 1.8, jitter: 0.4, passes: 1, alpha: 0.75 });
  ctx.restore();
  if (hold > HAMMER_MIN) Rough.bloom(ctx, x, y, 14 + lift * 16, '#ff9a3d', 0.25 + lift * 0.35);
};

/* ------------------------------------------------ the wind-up, on screen */
/* Drawn around the cursor while you hold: where it will land, and a ring
   that fills to three seconds with a notch at each step. */
function drawHoldGauge(ctx, game) {
  const h = game.hold;
  if (!h) return;
  const x = game.pointer.x, y = game.pointer.y;
  const t = h.t, k = Math.min(1, t / HAMMER_MAX);
  const ready = t >= HAMMER_MIN;
  const tier = ready ? Math.min(2, Math.floor(t - HAMMER_MIN + 1e-6)) : -1;
  const col = !ready ? '#9a958a' : ['#2b2b2b', '#e0762d', '#c8433a'][tier];
  const R = HAMMER_RADIUS * game.aoeScale();
  Rough.boil(4411, Math.floor(game.time * 8) / 7);
  // where it comes down - grey until it would actually do something
  Rough.circle(ctx, x, y, R, { color: col, width: ready ? 2.6 : 1.8, jitter: 1.6, wobble: 2.5, alpha: ready ? 0.75 : 0.35 });
  if (ready) {
    Rough.scribble(ctx, Rough.circlePts(x, y, R, 2, 18), { color: col, spacing: 9, width: 3, overflow: 1, alpha: 0.12 + tier * 0.05 });
  }
  // the fill ring, with a notch at 1s, 2s and 3s
  const rr = 30;
  Rough.arc(ctx, x, y, rr, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, { color: col, width: 4, jitter: 1, passes: 1 });
  for (const i of [HAMMER_MIN, HAMMER_MIN + 1, HAMMER_MIN + 2, HAMMER_MAX]) {
    const a = -Math.PI / 2 + (i / HAMMER_MAX) * Math.PI * 2;
    Rough.line(ctx, x + Math.cos(a) * (rr - 6), y + Math.sin(a) * (rr - 6), x + Math.cos(a) * (rr + 6), y + Math.sin(a) * (rr + 6),
      { color: t >= i ? col : '#b8b2a3', width: 2.4, jitter: 0.5, passes: 1 });
  }
  if (ready) {
    const label = '×' + hammerMult(t).toFixed(1);
    Rough.text(ctx, label, x + rr + 18, y - rr - 4, 15 + tier * 2, col);
  }
}

/* ------------------------------------------------------------- the slam */
/* A jagged crack out of an impact: a zig-zag that forks once or twice. */
function crackPath(len, a, forks) {
  const out = [];
  const main = [[0, 0]];
  let x = 0, y = 0;
  const n = 5;
  for (let k = 1; k <= n; k++) {
    const aa = a + (Math.random() - 0.5) * 0.9;
    x += Math.cos(aa) * len / n; y += Math.sin(aa) * len / n;
    main.push([x, y]);
    if (forks > 0 && k >= 2 && k < n && Math.random() < 0.45) {
      forks--;
      const fa = a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4);
      const f = [[x, y]];
      let fx = x, fy = y;
      for (let j = 0; j < 2; j++) { fx += Math.cos(fa + Rough.jit(0.3)) * len / n * 0.8; fy += Math.sin(fa + Rough.jit(0.3)) * len / n * 0.8; f.push([fx, fy]); }
      out.push(f);
    }
  }
  out.unshift(main);
  return out;
}

/* What the hammer leaves in the page: a dent, and cracks running out of
   it. Drawn under everything, and it fades over a few seconds. */
class HammerDent {
  constructor(x, y, r, tier) {
    this.id = nextId(); this.under = true;
    this.x = x; this.y = y; this.r = r * (0.3 + tier * 0.04);
    this.life = this.max = 2.6;
    this.cracks = [];
    const n = 5 + tier * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      for (const c of crackPath(r * (0.55 + Math.random() * 0.45 + tier * 0.1), a, 1)) this.cracks.push(c);
    }
    this.dent = Rough.circlePts(0, 0, this.r, this.r * 0.14, 11);
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const age = 1 - this.life / this.max;
    const a = age < 0.6 ? 1 : 1 - (age - 0.6) / 0.4;
    const grow = Math.min(1, age * 14);             // the cracks run out in a blink
    Rough.boil(this.id, 0);
    const pts = this.dent.map(q => [this.x + q[0], this.y + q[1]]);
    Rough.scribble(ctx, pts, { color: '#8a7a62', spacing: 3.5, width: 2.4, overflow: 1.05, alpha: 0.55 * a });
    Rough.poly(ctx, pts, { color: '#3a2e22', width: 2.2, jitter: 0.6, passes: 1, alpha: 0.8 * a });
    for (const c of this.cracks) {
      const n = Math.max(2, Math.ceil(c.length * grow));
      Rough.poly(ctx, c.slice(0, n).map(q => [this.x + q[0], this.y + q[1]]),
        { color: '#3a2e22', width: 1.8, jitter: 0.4, closed: false, passes: 1, alpha: 0.75 * a });
    }
  }
}

/* The moment it lands: a white-hot flash, a comic impact star, a crisp
   shock ring with streaks flying off it, rock and dust thrown out. */
class HammerSlam {
  constructor(x, y, r, tier, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r; this.tier = tier;
    this.t = 0; this.dur = 0.5 + tier * 0.08;
    this.hot = tier === 2 ? '#e0452d' : tier === 1 ? '#f08a2d' : '#f2b53a';
    // the impact star: ten points, long and short, a little uneven
    this.star = [];
    const pts = 12;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2 + Rough.jit(0.12);
      const rr = i % 2 ? 0.42 + Math.random() * 0.12 : 0.85 + Math.random() * 0.35;
      this.star.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    this.streaks = [];
    const ns = Fx.n(12 + tier * 4);
    for (let i = 0; i < ns; i++) this.streaks.push({ a: Math.random() * Math.PI * 2, l: 0.25 + Math.random() * 0.35, o: Math.random() * 0.2 });
    game.effects.push(new HammerDent(x, y, r, tier));
    if (typeof Chunk !== 'undefined') {
      for (let i = 0; i < Fx.n(7 + tier * 4); i++) {
        game.effects.push(new Chunk(x, y, { shape: i % 3 ? 'gob' : 'shard', color: i % 2 ? '#a8997f' : '#d8ccb8',
          size: 3.5 + tier * 0.8, speed: 170 + tier * 50, up: 210 + tier * 50, life: 1.1 }));
      }
      if (!Fx.low) {
        const nd = 8 + tier * 2;
        for (let i = 0; i < nd; i++) {
          const a = (i / nd) * Math.PI * 2;
          const d = new Dust(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.6, r * 0.5, '#b8ad9c');
          d.vx = Math.cos(a) * 70; d.vy = Math.sin(a) * 45 - 10;
          game.effects.push(d);
        }
      }
    }
    if (tier === 2 && game.slowmo) game.slowmo(0.08, 0.25);   // a hitch on the full swing
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const { x, y, r } = this;
    const p = this.t / this.dur, o = E.outQuint(p);
    Rough.boil(this.id, Math.floor(this.t * 14));
    // light: the glow round it and the white-hot centre
    if (!Fx.low) Rough.bloom(ctx, x, y, r * (1.4 + o * 0.6), this.hot, (1 - p) * (0.7 + this.tier * 0.1));
    if (this.t < 0.09) {
      ctx.save();
      ctx.globalAlpha = 1 - this.t / 0.09;
      ctx.fillStyle = '#fffbea';
      ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, 7); ctx.fill();
      ctx.restore();
    }
    // the impact star, popping out and gone fast
    const sp = E.clamp01(this.t / 0.22);
    if (sp < 1) {
      const k = r * (0.45 + E.back(Math.min(1, sp * 1.6)) * 0.55) * (1 + this.tier * 0.12);
      const pts = this.star.map(q => [x + q[0] * k, y + q[1] * k]);
      const fa = 1 - sp * sp;
      Rough.scribble(ctx, pts, { color: this.hot, spacing: 4, width: 3.2, overflow: 1.08, alpha: fa });
      Rough.scribble(ctx, pts.map(q => [x + (q[0] - x) * 0.5, y + (q[1] - y) * 0.5]), { color: '#fff3c4', spacing: 3.5, width: 3, overflow: 1.05, alpha: fa });
      Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.4, jitter: 0.6, passes: 1, alpha: fa });
    }
    // the shock ring: crisp ink leading edge, a warm band behind it
    const rr = r * (0.35 + o * 0.85);
    const ra = 1 - p;
    ctx.save();
    ctx.globalAlpha = ra * 0.35;
    ctx.strokeStyle = this.hot;
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, rr - 6), 0, 7); ctx.stroke();
    ctx.restore();
    Rough.circle(ctx, x, y, rr, { color: '#2b2b2b', width: 1 + 3.4 * (1 - p), jitter: 0.6, wobble: 1.2, passes: 1, alpha: ra });
    // streaks thrown off the ring
    for (const s of this.streaks) {
      const q = E.clamp01((p - s.o) / (1 - s.o));
      if (q <= 0 || q >= 1) continue;
      const r0 = rr + 4 + q * r * 0.3, r1 = r0 + r * s.l * (1 - q);
      Rough.line(ctx, x + Math.cos(s.a) * r0, y + Math.sin(s.a) * r0, x + Math.cos(s.a) * r1, y + Math.sin(s.a) * r1,
        { color: '#2b2b2b', width: 2, jitter: 0.3, passes: 1, alpha: (1 - q) * 0.85 });
    }
  }
}

/* ------------------------------------------------------------ QUAKE */
/* The ground split open from the castle, left under everything and fading. */
class QuakeCracks {
  constructor(game, quake) {
    this.id = nextId(); this.under = true; this.quake = quake;
    this.life = this.max = 3.2;
    this.cracks = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const len = quake.reach * (0.28 + Math.random() * 0.22);
      for (const c of crackPath(len, a, 2)) {
        this.cracks.push(c.map(q => [q[0] + Math.cos(a) * game.castleRadius, q[1] + Math.sin(a) * game.castleRadius]));
      }
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const age = 1 - this.life / this.max;
    const a = age < 0.55 ? 1 : 1 - (age - 0.55) / 0.45;
    const front = this.quake.t * this.quake.speed;
    Rough.boil(this.id, 0);
    for (const c of this.cracks) {
      const reached = c.filter(q => Math.hypot(q[0], q[1]) <= front);
      if (reached.length < 2) continue;
      Rough.poly(ctx, reached, { color: '#6b5a4a', width: 5, jitter: 0.5, closed: false, passes: 1, alpha: 0.18 * a });
      Rough.poly(ctx, reached, { color: '#3a2e22', width: 2, jitter: 0.5, closed: false, passes: 1, alpha: 0.8 * a });
    }
  }
}

class QuakeRing {
  constructor(game) {
    this.id = nextId();
    this.game = game;
    this.t = 0; this.speed = 760;
    this.reach = Math.hypot(game.w, game.h) / 2 + 60;
    this.dur = this.reach / this.speed + 0.45;
    this.done = new Set();
    // the leading edge is drawn as broken arcs, each a touch off the others,
    // so it reads as ground rucking up rather than a drawn circle
    this.arcs = [];
    let a = Math.random();
    while (a < Math.PI * 2 + 0.2) {
      const len = 0.25 + Math.random() * 0.35;
      this.arcs.push({ a0: a, a1: a + len, off: Rough.jit(5), w: 3 + Math.random() * 3 });
      a += len + 0.04 + Math.random() * 0.08;
    }
    this.ticks = [];
    for (let i = 0; i < 70; i++) this.ticks.push({ a: Math.random() * Math.PI * 2, d: Math.random() * 26, s: 0.6 + Math.random() * 0.7 });
    game.effects.push(new QuakeCracks(game, this));
    game.shake(22);
  }
  update(dt, game) {
    this.t += dt;
    const front = this.t * this.speed;
    const hw = game.w / 2, hh = game.h / 2;
    for (const e of game.enemies) {
      if (e.dead || this.done.has(e.id)) continue;
      if (Math.abs(e.x) > hw + e.r || Math.abs(e.y) > hh + e.r) continue;      // on the page only
      const d = Math.hypot(e.x, e.y) || 1;
      if (d > front) continue;
      this.done.add(e.id);
      e.stun = Math.max(e.stun, 1);
      e.knock = { dx: (e.x / d) * BLOCK, dy: (e.y / d) * BLOCK, t: 0, dur: 0.25 };
      e.hitT = 1;
      if (!Fx.low) {
        for (let i = 0; i < 3; i++) game.effects.push(new Dust(e.x, e.y, e.r, '#b8ad9c'));
        game.effects.push(new Chunk(e.x, e.y, { shape: 'gob', color: '#a8997f', size: 3, speed: 90, up: 160, life: 0.8, a: Math.atan2(e.y, e.x) }));
      }
    }
    // clods of earth kicked up off the front as it goes
    if (front < this.reach && typeof Chunk !== 'undefined') {
      const n = Fx.low ? 1 : 3;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const cx = Math.cos(a) * front, cy = Math.sin(a) * front;
        if (Math.abs(cx) > hw + 20 || Math.abs(cy) > hh + 20) continue;
        game.effects.push(new Chunk(cx, cy, { shape: 'gob', color: Math.random() < 0.5 ? '#a8997f' : '#8a7a62', size: 2.5 + Math.random() * 2,
          speed: 60, up: 140 + Math.random() * 100, life: 0.7, a }));
        if (!Fx.low && Math.random() < 0.5) game.effects.push(new Dust(cx, cy, 34, '#c9bda8'));
      }
    }
    return this.t < this.dur;
  }
  draw(ctx) {
    const front = this.t * this.speed;
    const fade = Math.max(0, 1 - Math.max(0, this.t - (this.dur - 0.45)) / 0.45);
    Rough.boil(this.id, Math.floor(this.t * 7));
    // the thump on the castle
    if (this.t < 0.5) Rough.bloom(ctx, 0, 0, this.game.castleRadius * 3.2, '#ffb347', (0.5 - this.t) * 1.6);
    if (front <= 4) return;
    // the heave: a warm band of disturbed ground just behind the edge
    ctx.save();
    ctx.globalAlpha = 0.28 * fade;
    ctx.strokeStyle = '#b58a52';
    ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, front - 16), 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.12 * fade;
    ctx.lineWidth = 60;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, front - 50), 0, 7); ctx.stroke();
    ctx.restore();
    // hatching over the band, like the ground was scored with a crayon
    if (!Fx.low) {
      for (const k of this.ticks) {
        const r = front - 6 - k.d;
        if (r < 4) continue;
        const c = Math.cos(k.a), s = Math.sin(k.a);
        Rough.line(ctx, c * r, s * r, c * (r - 10 * k.s) - s * 5, s * (r - 10 * k.s) + c * 5,
          { color: '#6b5a4a', width: 1.6, jitter: 0.3, passes: 1, alpha: 0.6 * fade });
      }
    }
    // the leading edge: broken ink arcs, heaviest at the front
    for (const ar of this.arcs) {
      Rough.arc(ctx, 0, 0, front + ar.off, ar.a0, ar.a1, { color: '#2b2b2b', width: ar.w, jitter: 0.8, passes: 1, alpha: 0.9 * fade });
    }
    // a thinner echo following behind
    const echo = front - 70;
    if (echo > 10) {
      for (let i = 0; i < this.arcs.length; i += 2) {
        const ar = this.arcs[i];
        Rough.arc(ctx, 0, 0, echo - ar.off, ar.a0 + 0.1, ar.a1, { color: '#6b5a4a', width: 2, jitter: 0.8, passes: 1, alpha: 0.5 * fade });
      }
    }
  }
}

SkillPayloads.hammer = function (game) {
  // Mjolnir's storm strikes first and then sets off the very same quake
  if (cursorLook('hammer').payload === 'thunder') {
    const st = new MjolnirStorm(game);
    game.effects.push(st);
    return st.dur;
  }
  const q = new QuakeRing(game);
  game.effects.push(q);
  Sfx.play('sk_quake', { volume: 1, rateVar: 0 });
  return q.dur;
};
