/* FANDHARN - the Thunder Pack: Mjolnir (a Sledgehammer skin) and Zeus (a
   Stick Sentry skin). Won, not bought: it is what winning on Hard pays.

   Like every skin, looks only. Mjolnir's slam lands through the very same
   Game.slam as the hammer's - the lightning is drawn on top of a hit that has
   already happened - and its skill runs the same QuakeRing that does QUAKE's
   stun and knockback. Zeus's thunderbolt flies, lands and hurts exactly like
   the stick sentry's arrow; the cloud and the strike are decoration. */

/* ---------------------------------------------------------- the sprite */
CursorSprites.mjolnir = function (ctx, x, y, s, color, t) {
  const hold = (typeof Game !== 'undefined' && Game.hold) ? Game.hold.t : 0;
  const lift = Math.min(1, hold / HAMMER_MAX);
  const shake = hold > HAMMER_MIN ? (hold - HAMMER_MIN) * 1.2 : 0;
  // short-handled, the head big and square, set on the pointer like the
  // Sledgehammer's; it swings back round the grip the same way
  const L = 30 * s;
  const hh = 15 * s, ht = 11 * s;
  ctx.save();
  ctx.translate(x + L + Rough.jit(shake), y - hh - 2 * s + Rough.jit(shake));
  ctx.rotate(lift * 1.15);
  // the handle, wrapped in leather, and the loop hanging off the end
  const handle = [[-L + ht, -2.6 * s], [2 * s, -3 * s], [2 * s, 3 * s], [-L + ht, 2.6 * s]];
  Rough.scribble(ctx, handle, { color: '#6b4a2a', spacing: 2.6, width: 2.6, overflow: 1.1 });
  Rough.poly(ctx, handle, { color: '#2b2b2b', width: 1.8, jitter: 0.5 });
  for (let i = 0; i < 5; i++) {
    const gx = -L + ht + 3 * s + i * 3.4 * s;
    Rough.line(ctx, gx - 1.2 * s, -2.8 * s, gx + 1.2 * s, 2.8 * s, { color: '#b58a52', width: 1.6, jitter: 0.3, passes: 1 });
  }
  Rough.arc(ctx, 6 * s, 4 * s, 4 * s, -1.2, 2.6, { color: '#6b4a2a', width: 2, jitter: 0.4, passes: 1 });
  // the head: a heavy block of pale steel, faces flat, knotwork on the side
  const cx = -L;
  const head = [[cx - ht, -hh], [cx + ht, -hh], [cx + ht, hh], [cx - ht, hh]];
  Rough.scribble(ctx, head, { color: '#9aa6b8', spacing: 3, width: 4, overflow: 1.08 });
  Rough.poly(ctx, head, { color: '#2b2b2b', width: 2.4, jitter: 0.5 });
  for (const sgn of [-1, 1]) {            // bevels round each striking face
    Rough.line(ctx, cx - ht + 2 * s, sgn * (hh - 3 * s), cx + ht - 2 * s, sgn * (hh - 3 * s), { color: '#5a6478', width: 1.6, jitter: 0.3, passes: 1 });
  }
  Rough.circle(ctx, cx, 0, 5.5 * s, { color: '#3a4458', width: 1.6, jitter: 0.3, wobble: 0.4 });
  for (let i = 0; i < 3; i++) {           // three loops through the ring
    const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
    Rough.circle(ctx, cx + Math.cos(a) * 3.4 * s, Math.sin(a) * 3.4 * s, 2.6 * s, { color: '#3a4458', width: 1.3, jitter: 0.2, wobble: 0.2 });
  }
  Rough.line(ctx, cx - ht + 2.4 * s, -hh + 4 * s, cx - ht + 2.4 * s, hh - 4 * s, { color: '#fffdf4', width: 1.8, jitter: 0.3, passes: 1, alpha: 0.7 });
  // it crackles - always a little, a lot while it is being wound up
  const n = hold > 0 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    if (Math.sin(t * 13 + i * 2.1) < 0.2 && hold <= 0) continue;
    const a0 = Math.random() * Math.PI * 2;
    const r0 = hh * 1.05, r1 = hh * (1.5 + lift * 0.6);
    const mx = cx + Math.cos(a0) * (r0 + r1) / 2 + Rough.jit(4 * s), my = Math.sin(a0) * (r0 + r1) / 2 + Rough.jit(4 * s);
    Rough.poly(ctx, [[cx + Math.cos(a0) * r0, Math.sin(a0) * r0], [mx, my], [cx + Math.cos(a0 + 0.3) * r1, Math.sin(a0 + 0.3) * r1]],
      { color: '#8ea6ff', width: 1.8, jitter: 0.5, closed: false, passes: 1, alpha: 0.9 });
  }
  ctx.restore();
  Rough.bloom(ctx, x, y - hh, 18 + lift * 16, '#8ea6ff', 0.2 + lift * 0.4);
};

/* ------------------------------------------------------------ the slam */
/* What the hammer's hit looks like under Mjolnir: lightning following it
   down, the same dent and shock ring under it, and arcs running out along
   the ground. Draws only - the hit has already happened. */
class MjolnirStrike {
  constructor(x, y, r, tier, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r; this.tier = tier;
    this.t = 0; this.dur = 0.5 + tier * 0.08;
    game.effects.push(new HammerSlam(x, y, r, tier, game));
    game.effects.push(new LightningBolt(x, y, { delay: 0, damage: 0, radius: 0, game }));
    this.arcs = [];
    const n = 5 + tier * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const pts = [[0, 0]];
      const len = r * (0.8 + Math.random() * 0.5);
      for (let k = 1; k <= 5; k++) {
        const d = len * k / 5, j = (Math.random() - 0.5) * 16;
        pts.push([Math.cos(a) * d - Math.sin(a) * j, Math.sin(a) * d + Math.cos(a) * j]);
      }
      this.arcs.push(pts);
    }
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const p = this.t / this.dur;
    Rough.boil(this.id, Math.floor(time * 20));
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, this.r * (1.6 + p), '#8ea6ff', (1 - p) * 0.8);
    for (const pts of this.arcs) {
      const n = Math.max(2, Math.ceil(pts.length * Math.min(1, p * 5)));
      const w = pts.slice(0, n).map(q => [this.x + q[0] + Rough.jit(2), this.y + q[1] + Rough.jit(2)]);
      Rough.poly(ctx, w, { color: '#8ea6ff', width: 4, jitter: 1, closed: false, passes: 1, alpha: (1 - p) * 0.6 });
      Rough.poly(ctx, w, { color: '#ffffff', width: 1.6, jitter: 0.6, closed: false, passes: 1, alpha: 1 - p });
    }
  }
}

/* ------------------------------------------------------------ the skill */
/* A storm banks up over the castle, one enormous bolt comes out of it into
   the ground, and the ground heaves out from where it hit - the QUAKE. */
class MjolnirStorm {
  constructor(game) {
    this.id = nextId();
    this.game = game;
    this.t = 0; this.strikeAt = 0.8;
    this.fired = false;
    // how long the quake that follows will run, so the cast waits for it
    this.dur = this.strikeAt + (Math.hypot(game.w, game.h) / 2 + 60) / 760 + 0.45;
    this.puffs = [];
    for (let i = 0; i < 9; i++) {
      this.puffs.push({ x: (i - 4) * 34 + Rough.jit(10), y: Rough.jit(14), r: 34 + Math.random() * 20, at: Math.random() * 0.35 });
    }
    this.cloudY = -game.castleRadius - 150;
    Sfx.play('thunder_roll', { volume: 0.8, rateVar: 0 });
  }
  update(dt, game) {
    this.t += dt;
    if (!this.fired && this.t >= this.strikeAt) {
      this.fired = true;
      this.build();
      game.effects.push(new QuakeRing(game));              // the real stun and knockback
      game.effects.push(new LightningBolt(0, 0, { delay: 0, damage: 0, radius: 0, game }));
      game.effects.push(new HammerSlam(0, 0, game.castleRadius * 1.6, 2, game));
      game.shake(30);
      Sfx.play('thunder_strike', { volume: 1, rateVar: 0 });
      Sfx.play('sk_quake', { volume: 1, rateVar: 0 });
    }
    return this.t < Math.max(this.dur, this.strikeAt + 0.8);
  }
  build() {
    const top = this.cloudY + 10, bottom = -this.game.castleRadius * 0.3;
    const pts = [[Rough.jit(20), top]];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      pts.push([Rough.jit(40 * (1 - k) + 8), top + (bottom - top) * k]);
    }
    pts[pts.length - 1] = [0, bottom];
    this.bolt = pts;
    this.forks = [];
    for (let i = 0; i < 6; i++) {
      const from = pts[1 + Math.floor(Math.random() * (steps - 2))];
      const a = Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const f = [from];
      let fx = from[0], fy = from[1];
      for (let k = 0; k < 3; k++) { fx += Math.cos(a) * 26 + Rough.jit(10); fy += Math.sin(a) * 22; f.push([fx, fy]); }
      this.forks.push(f);
    }
  }
  draw(ctx, time) {
    const g = this.game, w = g.w, h = g.h;
    const gather = E.out(E.clamp01(this.t / this.strikeAt));
    const after = Math.max(0, this.t - this.strikeAt);
    const fade = after > 0.5 ? Math.max(0, 1 - (after - 0.5) / 0.6) : 1;
    // the page darkens under the storm
    ctx.save();
    ctx.globalAlpha = 0.28 * gather * fade;
    ctx.fillStyle = '#2a3050';
    ctx.fillRect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
    ctx.restore();
    Rough.boil(this.id, Math.floor(time * 7));
    // the cloud bank
    for (const p of this.puffs) {
      const k = E.back(E.clamp01((this.t - p.at) / 0.45));
      if (k <= 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.95 * fade;
      Rough.blob(ctx, p.x, this.cloudY + p.y, p.r * k, '#3a3550', '#221f33', { spacing: 7, fillWidth: 7, sides: 10, width: 2.6 });
      ctx.restore();
    }
    // flickers inside it while it builds
    if (!this.fired && this.t > 0.25 && Math.random() < 0.6) {
      const fx = Rough.jit(120);
      Rough.line(ctx, fx, this.cloudY + Rough.jit(10), fx + Rough.jit(40), this.cloudY + 20 + Math.random() * 20,
        { color: '#dfe6ff', width: 2.2, jitter: 4, passes: 1, alpha: 0.9 * fade });
      Rough.bloom(ctx, fx, this.cloudY, 60, '#8ea6ff', 0.5);
    }
    if (!this.fired || !this.bolt) return;
    // the one big bolt, and a white-out as it lands
    const a = Math.max(0, 1 - after / 0.55);
    if (after < 0.22) {
      ctx.save();
      ctx.globalAlpha = (1 - after / 0.22) * 0.85;
      ctx.fillStyle = '#f4f6ff';
      ctx.fillRect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
      ctx.restore();
    }
    if (a <= 0) return;
    Rough.boil(this.id + 1, Math.floor(time * 24));
    for (const f of this.forks) {
      Rough.poly(ctx, f, { color: '#aebaff', width: 4, jitter: 3, closed: false, passes: 1, alpha: a });
    }
    for (let i = 0; i < this.bolt.length - 1; i++) {
      const s = this.bolt[i], e = this.bolt[i + 1];
      Rough.line(ctx, s[0], s[1], e[0], e[1], { color: '#8ea6ff', width: 20, jitter: 6, passes: 1, alpha: a * 0.8 });
      Rough.line(ctx, s[0], s[1], e[0], e[1], { color: '#dfe6ff', width: 10, jitter: 4, passes: 1, alpha: a });
      Rough.line(ctx, s[0], s[1], e[0], e[1], { color: '#ffffff', width: 4, jitter: 2, passes: 1, alpha: a });
    }
    if (!Fx.low) for (let i = 0; i < this.bolt.length; i += 3) Rough.bloom(ctx, this.bolt[i][0], this.bolt[i][1], 70, '#8ea6ff', a * 0.6);
    Rough.bloom(ctx, 0, 0, g.castleRadius * 4, '#dfe6ff', a);
  }
}

/* ---------------------------------------------------------------- Zeus */
/* A thunderbolt, the drawn kind: pointing along +x, about 26 long. */
const BOLT_SHAPE = [[-13, -2], [1, -6], [-1, -1.5], [13, 2], [-1, 6], [1, 1.5]];

function drawThunderbolt(ctx, x, y, a, s, alpha) {
  const c = Math.cos(a), sn = Math.sin(a);
  const pts = BOLT_SHAPE.map(([px, py]) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s]);
  Rough.bloom(ctx, x, y, 22 * s, '#ffd24a', 0.55 * (alpha == null ? 1 : alpha));
  Rough.scribble(ctx, pts, { color: '#f2c230', spacing: 2.5, width: 3, overflow: 1.12, alpha });
  Rough.poly(ctx, pts, { color: '#a5741b', width: 1.8, jitter: 0.4, alpha });
}

/* The stick figure, bearded and wreathed, a thunderbolt raised over its
   head - thrown forward on the recoil and back in its hand a moment later. */
function drawZeusFigure(ctx, x, y, aim, recoil, t, s) {
  s = s || 1;
  const ink = { color: '#2b2b2b', width: 2.2 * s, jitter: 1 };
  Rough.circle(ctx, x, y - 13 * s, 5 * s, ink);
  // a wreath round the head, and the beard under it
  Rough.arc(ctx, x, y - 13 * s, 6.5 * s, Math.PI * 1.05, Math.PI * 1.95, { color: '#4c9f70', width: 2 * s, jitter: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (1.12 + i * 0.25);
    Rough.circle(ctx, x + Math.cos(a) * 7 * s, y - 13 * s + Math.sin(a) * 7 * s, 1.3 * s, { color: '#4c9f70', width: 1.4 * s, jitter: 0.2, wobble: 0.2 });
  }
  Rough.scribble(ctx, [[x - 4 * s, y - 11 * s], [x + 4 * s, y - 11 * s], [x + 2 * s, y - 5 * s], [x - 2 * s, y - 5 * s]],
    { color: '#fffdf4', spacing: 2, width: 2, overflow: 1.05 });
  Rough.poly(ctx, [[x - 4 * s, y - 10 * s], [x, y - 4.5 * s], [x + 4 * s, y - 10 * s]], { color: '#2b2b2b', width: 1.5 * s, jitter: 0.4, closed: false });
  // body, a sash across it, legs
  Rough.line(ctx, x, y - 8 * s, x, y + 6 * s, ink);
  Rough.line(ctx, x - 3 * s, y - 6 * s, x + 3 * s, y + 4 * s, { color: '#e8c33a', width: 2.2 * s, jitter: 0.5, passes: 1 });
  Rough.line(ctx, x, y + 6 * s, x - 5 * s, y + 14 * s, ink);
  Rough.line(ctx, x, y + 6 * s, x + 5 * s, y + 14 * s, ink);
  // the throwing arm: raised back with the bolt, or flung out after it
  const thrown = recoil > 0.35;
  const back = aim + Math.PI * 0.8;
  const armA = thrown ? aim : back;
  const hx = x + Math.cos(armA) * 11 * s, hy = y - 4 * s + Math.sin(armA) * 11 * s - (thrown ? 0 : 6 * s);
  Rough.line(ctx, x, y - 4 * s, hx, hy, ink);
  Rough.line(ctx, x, y - 4 * s, x + Math.cos(aim + 0.5) * 7 * s, y - 2 * s + Math.sin(aim + 0.5) * 7 * s, ink);
  if (!thrown) {
    drawThunderbolt(ctx, hx, hy - 6 * s, aim - 0.9, 0.85 * s, 1);
    if (Math.sin(t * 11) > 0.3) {
      Rough.line(ctx, hx + Rough.jit(6 * s), hy - 14 * s, hx + Rough.jit(10 * s), hy - 20 * s, { color: '#ffd24a', width: 1.4, jitter: 1.5, passes: 1, alpha: 0.8 });
    }
  }
}

Sentry.prototype.drawZeus = function (ctx, t) {
  Rough.boil(this.id, t * 0.6);
  const bob = Math.sin(t * 2 + this.bob) * 1.5;
  drawZeusFigure(ctx, this.x, this.y + bob, this.aim, this.recoil, t, 1);
};

/* Flies, lands and hurts exactly as the arrow does - only drawn as a
   thrown thunderbolt, and it calls a little strike down where it lands. */
class ZeusBolt extends Arrow {
  constructor(x, y, target, dmg) {
    super(x, y - 10, target, dmg);
    this.spin = 0;
  }
  update(dt, game) {
    this.spin += dt * 10;
    const alive = super.update(dt, game);
    if (!alive) {
      game.effects.push(new ZeusStrike(this.x, this.y));
      Sfx.play('zap', { volume: 0.3, throttle: 70 });
    }
    return alive;
  }
  draw(ctx) {
    for (let i = 1; i < this.trail.length; i++) {
      Rough.line(ctx, this.trail[i - 1][0], this.trail[i - 1][1], this.trail[i][0], this.trail[i][1],
        { color: '#ffd24a', width: 2.4, jitter: 2, passes: 1, alpha: i / this.trail.length * 0.6 });
    }
    drawThunderbolt(ctx, this.x, this.y, (this.a || 0) + Math.sin(this.spin) * 0.3, 0.9, 1);
  }
}

/* Where a thrown bolt lands: a small cloud pops over the spot and a bolt of
   its own comes down out of it. No damage - the throw has already hit. */
class ZeusStrike {
  constructor(x, y) {
    this.id = nextId(); this.x = x; this.y = y;
    this.t = 0; this.dur = 0.45;
    this.pts = null;
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const p = this.t / this.dur;
    const cy = this.y - 46;
    const k = E.back(Math.min(1, this.t / 0.12));
    const fade = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
    Rough.boil(this.id, Math.floor(time * 10));
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    Rough.blob(ctx, this.x, cy, 13 * k, '#3a3550', '#221f33', { spacing: 5, fillWidth: 5, sides: 8, width: 2 });
    Rough.blob(ctx, this.x - 10, cy + 4, 8 * k, '#3a3550', '#221f33', { spacing: 5, fillWidth: 4, sides: 7, width: 1.8 });
    Rough.blob(ctx, this.x + 10, cy + 3, 8 * k, '#3a3550', '#221f33', { spacing: 5, fillWidth: 4, sides: 7, width: 1.8 });
    ctx.restore();
    if (this.t < 0.08) return;
    if (!this.pts) {
      this.pts = [[this.x, cy + 8]];
      for (let i = 1; i <= 4; i++) this.pts.push([this.x + Rough.jit(8), cy + 8 + (this.y - cy - 8) * i / 4]);
      this.pts[4] = [this.x, this.y];
    }
    const a = Math.max(0, 1 - (this.t - 0.08) / 0.3);
    Rough.poly(ctx, this.pts, { color: '#ffd24a', width: 5, jitter: 1.5, closed: false, passes: 1, alpha: a * 0.8 });
    Rough.poly(ctx, this.pts, { color: '#ffffff', width: 2, jitter: 1, closed: false, passes: 1, alpha: a });
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, 34, '#ffd24a', a * 0.7);
    Rough.circle(ctx, this.x, this.y, 6 + (1 - a) * 16, { color: '#ffd24a', width: 2.4, jitter: 1, alpha: a });
  }
}

/* -------------------------------------------------- the shop and settings */
/* The pack's card in the shop: Mjolnir on the left, Zeus on the right, and
   lightning coming down between them. */
function thunderPreview(ctx, w, h, t, dt, c) {
  // a bank of cloud along the top of the card
  for (let i = 0; i < 6; i++) {
    Rough.blob(ctx, w * (0.05 + i * 0.18), 6 + (i % 2) * 6, 22, '#3a3550', '#221f33', { spacing: 6, fillWidth: 5, sides: 9, width: 2 });
  }
  c.next -= dt;
  if (c.next <= 0) {
    c.next = 1.1;
    const x = w * (0.4 + Math.random() * 0.25), y = h * 0.82;
    const pts = [[x + Rough.jit(20), 20]];
    for (let i = 1; i <= 6; i++) pts.push([x + Rough.jit(14 * (1 - i / 6) + 3), 20 + (y - 20) * i / 6]);
    pts[6] = [x, y];
    c.bolts.push({ pts, t: 0, x, y });
  }
  for (const b of c.bolts) {
    b.t += dt;
    const a = Math.max(0, 1 - b.t / 0.4);
    Rough.poly(ctx, b.pts, { color: '#8ea6ff', width: 6, jitter: 2, closed: false, passes: 1, alpha: a * 0.8 });
    Rough.poly(ctx, b.pts, { color: '#ffffff', width: 2, jitter: 1, closed: false, passes: 1, alpha: a });
    Rough.bloom(ctx, b.x, b.y, 40, '#8ea6ff', a * 0.8);
  }
  c.bolts = c.bolts.filter(b => b.t < 0.4);
  ctx.save();
  ctx.translate(w * 0.2, h * 0.78);
  ctx.scale(1.7, 1.7);
  CursorSprites.mjolnir(ctx, 0, 0, 1, '#6f86d8', t);
  ctx.restore();
  ctx.save();
  ctx.translate(w * 0.8, h * 0.62);
  ctx.scale(2, 2);
  const throwing = (t % 1.6) < 0.3;
  drawZeusFigure(ctx, 0, 0, Math.PI * 1.1, throwing ? 1 : 0, t, 1);
  ctx.restore();
}

/* A still picture of one skin, for its row in a pack's settings. */
function drawSkinIcon(cv, skin) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  Rough.boil(skin.id.length * 13, 0);
  const target = Object.keys(skin.applies)[0];
  const look = skin.applies[target];
  g.save();
  if (target.startsWith('cursor:')) {
    g.translate(cv.width * 0.3, cv.height * 0.8);
    g.scale(1.5, 1.5);
    (CursorSprites[look.sprite] || CursorSprites.plain)(g, 0, 0, 1, look.color, 0);
  } else if (skin.id === 'zeus') {
    g.translate(cv.width / 2, cv.height * 0.6);
    g.scale(2.2, 2.2);
    drawZeusFigure(g, 0, 0, -0.4, 0, 0, 1);
  }
  g.restore();
}
