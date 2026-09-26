/* FANDHARN - the Sledgehammer, and its skill QUAKE.

   A click does nothing. Hold for at least a second and let go, and it comes
   down on everything within a block and a half. Every full second more you
   hold adds 20%, and at three seconds it comes down by itself at +40%.

   QUAKE rolls a shockwave out from the castle to the edge of the page; as
   it passes, everything on the page is stunned for a second and knocked a
   block back. */

/* How much a hold of `t` seconds is worth: nothing under a second, then
   1.0, 1.2, 1.4 in whole-second steps. */
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
  for (let i = 1; i <= HAMMER_MAX; i++) {
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
class HammerSlam {
  constructor(x, y, r, tier, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r; this.tier = tier;
    this.t = 0; this.dur = 0.55 + tier * 0.1;
    this.cracks = [];
    const n = 6 + tier * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const pts = [[0, 0]];
      let px = 0, py = 0;
      for (let k = 0; k < 3; k++) {
        px += Math.cos(a + (Math.random() - 0.5) * 0.7) * r * 0.36;
        py += Math.sin(a + (Math.random() - 0.5) * 0.7) * r * 0.36;
        pts.push([px, py]);
      }
      this.cracks.push(pts);
    }
    // chips of the page thrown up, and dust
    if (typeof Chunk !== 'undefined') {
      for (let i = 0; i < Fx.n(6 + tier * 4); i++) {
        game.effects.push(new Chunk(x, y, { shape: 'shard', color: '#d8ccb8', size: 4 + tier, speed: 150 + tier * 40, up: 190 + tier * 40, life: 1.2 }));
      }
      for (let i = 0; i < Fx.n(4 + tier * 2); i++) game.effects.push(new Dust(x, y, r, '#b8ad9c'));
    }
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const p = this.t / this.dur, o = E.outQuint(p);
    Rough.boil(this.id, 0);
    Rough.bloom(ctx, this.x, this.y, this.r * (1.2 + o), this.tier === 2 ? '#ff6a3d' : '#ffb347', (1 - p) * (0.6 + this.tier * 0.15));
    // the dent it leaves, and the cracks running out of it
    Rough.circle(ctx, this.x, this.y, this.r * 0.32, { color: '#2b2b2b', width: 3, jitter: 1.4, wobble: 3, alpha: (1 - p) * 0.8 });
    for (const c of this.cracks) {
      const n = Math.max(2, Math.ceil(c.length * Math.min(1, p * 4)));
      Rough.poly(ctx, c.slice(0, n).map(q => [this.x + q[0], this.y + q[1]]),
        { color: '#2b2b2b', width: 2.4, jitter: 0.8, closed: false, passes: 1, alpha: 1 - p * p });
    }
    // the shock ring out to where the damage reached
    Rough.circle(ctx, this.x, this.y, this.r * (0.4 + o * 0.75),
      { color: this.tier === 2 ? '#c8433a' : '#6b5a4a', width: 4 + this.tier, jitter: 2, wobble: 3, alpha: (1 - o) * 0.9 });
  }
}

/* ------------------------------------------------------------ QUAKE */
class QuakeRing {
  constructor(game) {
    this.id = nextId();
    this.game = game;
    this.t = 0; this.speed = 760;
    this.reach = Math.hypot(game.w, game.h) / 2 + 60;
    this.dur = this.reach / this.speed + 0.6;
    this.done = new Set();
    this.cracks = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const pts = [[Math.cos(a) * game.castleRadius, Math.sin(a) * game.castleRadius]];
      let px = pts[0][0], py = pts[0][1];
      for (let k = 0; k < 7; k++) {
        const aa = a + (Math.random() - 0.5) * 0.5;
        px += Math.cos(aa) * this.reach / 7.5; py += Math.sin(aa) * this.reach / 7.5;
        pts.push([px, py]);
      }
      this.cracks.push(pts);
    }
    game.shake(20);
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
      if (!Fx.low) for (let i = 0; i < 3; i++) game.effects.push(new Dust(e.x, e.y, e.r, '#b8ad9c'));
    }
    if (!Fx.low && Math.random() < 0.8) {                   // dust thrown up along the front
      const a = Math.random() * Math.PI * 2;
      game.effects.push(new Dust(Math.cos(a) * front, Math.sin(a) * front, 40, '#b8ad9c'));
    }
    return this.t < this.dur;
  }
  draw(ctx) {
    const front = this.t * this.speed;
    const fade = Math.max(0, 1 - Math.max(0, this.t - (this.dur - 0.6)) / 0.6);
    Rough.boil(this.id, Math.floor(this.t * 14) / 7);
    Rough.bloom(ctx, 0, 0, this.game.castleRadius * 3, '#ffb347', Math.max(0, 0.8 - this.t) );
    // the ground splitting out from the castle, keeping pace with the wave
    for (const c of this.cracks) {
      const reached = c.filter(q => Math.hypot(q[0], q[1]) <= front + 20);
      if (reached.length > 1) Rough.poly(ctx, reached, { color: '#3a2e22', width: 3, jitter: 1.2, closed: false, passes: 1, alpha: 0.7 * fade });
    }
    // three rings, the leading edge heaviest
    for (const [off, w, col, a] of [[0, 7, '#6b5a4a', 0.85], [-34, 4, '#b58a52', 0.6], [-80, 3, '#d8ccb8', 0.45]]) {
      const r = front + off;
      if (r > 0) Rough.circle(ctx, 0, 0, r, { color: col, width: w, jitter: 3, wobble: 6, alpha: a * fade });
    }
  }
}

SkillPayloads.hammer = function (game) {
  const q = new QuakeRing(game);
  game.effects.push(q);
  Sfx.play('sk_quake', { volume: 1, rateVar: 0 });
  return q.dur;
};
