/* FANDHARN - Cryo Rain, a skin for the Wet Cursor.

   Looks only, like every skin. The ice shards fly the same hop, land at the
   same moment and hurt through the same areaDamage as the water drops; the
   ground they freeze is paint. HAILSTORM hits and slows through the very
   same Cloudburst code as CLOUDBURST - the hail, the ice cloud and the frost
   on everything are drawn over it. */

const ICE = { ink: '#1f4e7a', deep: '#2c4a6e', mid: '#5fa8e0', pale: '#cfeaff', white: '#f2faff', glow: '#9fd4ff' };

/* A four-point glint, the kind that sits on ice. */
function iceGlint(ctx, x, y, s, alpha) {
  if (s < 0.5 || alpha <= 0.02) return;
  Rough.line(ctx, x - s, y, x + s, y, { color: ICE.white, width: 1.6, jitter: 0.2, passes: 1, alpha });
  Rough.line(ctx, x, y - s * 1.4, x, y + s * 1.4, { color: ICE.white, width: 1.6, jitter: 0.2, passes: 1, alpha });
}

/* ---------------------------------------------------------- the sprite */
CursorSprites.cryo = function (ctx, x, y, s, color, t) {
  const p = [[x, y], [x + 13 * s, y + 13 * s], [x + 6 * s, y + 14 * s], [x + 10 * s, y + 22 * s],
    [x + 6 * s, y + 24 * s], [x + 2.5 * s, y + 16 * s], [x - 1 * s, y + 20 * s]];
  Rough.bloom(ctx, x + 6 * s, y + 13 * s, 22 * s, ICE.glow, 0.35);
  Rough.scribble(ctx, p, { color: ICE.pale, spacing: 3, width: 4, overflow: 1.15, alpha: 0.95 });
  Rough.scribble(ctx, p, { color: ICE.mid, spacing: 7, width: 2.4, overflow: 1, alpha: 0.7, angle: 0.8 });
  Rough.poly(ctx, p, { color: ICE.ink, width: 2, jitter: 0.5 });
  Rough.line(ctx, x + 1.5 * s, y + 4 * s, x + 1.5 * s, y + 13 * s, { color: ICE.white, width: 1.6, jitter: 0.3, passes: 1, alpha: 0.9 });
  // icicles hanging off the underside, one of them dripping
  for (const [ix, len] of [[x + 1 * s, 5], [x + 4 * s, 7], [x + 8 * s, 4.5]]) {
    const iy = ix < x + 3 * s ? y + 18 * s : ix < x + 6 * s ? y + 17 * s : y + 23 * s;
    const tri = [[ix - 1.4 * s, iy], [ix + 1.4 * s, iy], [ix, iy + len * s]];
    Rough.scribble(ctx, tri, { color: ICE.pale, spacing: 2, width: 2, overflow: 1.1 });
    Rough.poly(ctx, tri, { color: ICE.ink, width: 1.2, jitter: 0.2 });
  }
  const drip = (t * 0.9) % 1;
  if (drip < 0.7) Rough.circle(ctx, x + 4 * s, y + 25 * s + drip * 9 * s, 1.1 * s, { color: ICE.mid, width: 1.4, jitter: 0.1, wobble: 0.1, alpha: 1 - drip });
  iceGlint(ctx, x + 11 * s, y + 6 * s, (2 + Math.sin(t * 4) * 1.2) * s, 0.9);
};

/* ------------------------------------------------------- the ice shards */
/* The Wet Cursor's drop, drawn as a spinning shard of ice. Same path, same
   timing, same pop - it freezes the ground where the splash would be. */
class IceShard extends WaterDrop {
  constructor(x, y, angle, game, radius, damage) {
    super(x, y, angle, game, radius, damage);
    this.angle = angle;
    this.spin = Math.random() * 6;
  }
  update(dt, game) {
    this.t += dt;
    const p = Math.min(1, this.t / this.dur);
    const e = E.out(p);
    this.x = this.sx + (this.tx - this.sx) * e;
    this.y = this.sy + (this.ty - this.sy) * e;
    if (p >= 1 && !this.popped) {
      this.popped = true;
      game.areaDamage(this.x, this.y, this.radius, this.damage, { color: ICE.mid });
      game.effects.push(new FrostPatch(this.x, this.y, this.radius));
      game.effects.push(new IceBurst(this.x, this.y, this.radius, game));
      Sfx.play('ice_shatter', { volume: 0.8, throttle: 30, voices: 8 });
      return false;
    }
    return p < 1;
  }
  draw(ctx, t) {
    const p = Math.min(1, this.t / this.dur);
    const hop = Math.sin(p * Math.PI) * 22;          // up and over, onto the spot
    const x = this.x, y = this.y - hop;
    // its shadow on the paper, tightening as it comes down
    ctx.save();
    ctx.globalAlpha = 0.18 + (1 - hop / 22) * 0.15;
    ctx.fillStyle = ICE.ink;
    ctx.beginPath(); ctx.ellipse(this.x, this.y + 3, 8 - hop * 0.15, 3, 0, 0, 7); ctx.fill();
    ctx.restore();
    Rough.boil(this.id, Math.floor(t * 10));
    if (!Fx.low) Rough.bloom(ctx, x, y, 24, ICE.glow, 0.6);
    // a thin frost trail back along the hop
    for (let i = 1; i <= 3; i++) {
      const q = Math.max(0, p - i * 0.07), eq = E.out(q);
      const tx = this.sx + (this.tx - this.sx) * eq, ty = this.sy + (this.ty - this.sy) * eq - Math.sin(q * Math.PI) * 22;
      iceGlint(ctx, tx + Rough.jit(2), ty + Rough.jit(2), 2.4 - i * 0.5, 0.7 - i * 0.15);
    }
    const a = this.angle + this.spin + p * 7;
    const c = Math.cos(a), sn = Math.sin(a), L = 12, W = 4.6;
    const pts = [[x + c * L, y + sn * L], [x - sn * W, y + c * W], [x - c * L * 0.7, y - sn * L * 0.7], [x + sn * W, y - c * W]];
    Rough.scribble(ctx, pts, { color: ICE.pale, spacing: 2, width: 2.6, overflow: 1.15 });
    Rough.poly(ctx, pts, { color: ICE.ink, width: 2, jitter: 0.3 });
    Rough.line(ctx, x - c * L * 0.4, y - sn * L * 0.4, x + c * L * 0.7, y + sn * L * 0.7, { color: ICE.white, width: 1.2, jitter: 0.2, passes: 1 });
  }
}

/* Where a shard lands, the ground freezes over the same area the splash
   covered: a crystal sheet with cracks through it and feathers of frost
   round its edge, glinting, then melting back into a wet ring. */
class FrostPatch {
  constructor(x, y, r) {
    this.id = nextId(); this.under = true;
    this.x = x; this.y = y; this.r = r * 1.1;
    r = this.r;
    this.life = this.max = 2.6;
    const n = 9;
    this.pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Rough.jit(0.15);
      const rr = r * (0.85 + Math.random() * 0.3);
      this.pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.8]);
    }
    this.cracks = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, o = r * 0.2;
      const ox = Rough.jit(o), oy = Rough.jit(o);
      this.cracks.push([[ox, oy], [ox + Math.cos(a) * r * 0.5 + Rough.jit(3), oy + Math.sin(a) * r * 0.4],
        [ox + Math.cos(a + 0.3) * r * 0.9, oy + Math.sin(a + 0.3) * r * 0.72]]);
    }
    this.feathers = this.pts.map(q => ({ a: Math.atan2(q[1], q[0]), q }));
    this.glints = [0, 1, 2].map(() => ({ x: Rough.jit(r * 0.6), y: Rough.jit(r * 0.45), ph: Math.random() * 6 }));
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const age = this.max - this.life;
    const grow = E.back(Math.min(1, age / 0.16));                     // it freezes in a blink
    const melt = this.life < 0.7 ? this.life / 0.7 : 1;
    const k = grow * (0.9 + melt * 0.1);
    const X = q => this.x + q[0] * k, Y = q => this.y + q[1] * k;
    Rough.boil(this.id, 0);
    const pts = this.pts.map(q => [X(q), Y(q)]);
    Rough.bloom(ctx, this.x, this.y, this.r * 1.3, ICE.glow, 0.35 * melt * grow);
    Rough.scribble(ctx, pts, { color: ICE.pale, spacing: 2.6, width: 3.6, overflow: 1.04, alpha: 0.95 * melt });
    Rough.scribble(ctx, pts, { color: ICE.glow, spacing: 7, width: 2, overflow: 1, alpha: 0.5 * melt, angle: 0.9 });
    Rough.poly(ctx, pts, { color: ICE.mid, width: 2.4, jitter: 0.4, passes: 1, alpha: melt });
    // feathers of frost round the rim
    for (const f of this.feathers) {
      const bx = X(f.q), by = Y(f.q), L = this.r * 0.28 * k;
      Rough.line(ctx, bx, by, bx + Math.cos(f.a) * L, by + Math.sin(f.a) * L * 0.8, { color: '#a9d8ff', width: 1.4, jitter: 0.3, passes: 1, alpha: 0.8 * melt });
      Rough.line(ctx, bx + Math.cos(f.a) * L * 0.5, by + Math.sin(f.a) * L * 0.4, bx + Math.cos(f.a + 0.6) * L * 0.9, by + Math.sin(f.a + 0.6) * L * 0.7,
        { color: '#a9d8ff', width: 1.1, jitter: 0.2, passes: 1, alpha: 0.7 * melt });
    }
    for (const c of this.cracks) {
      Rough.poly(ctx, c.map(q => [X(q), Y(q)]), { color: ICE.white, width: 1.5, jitter: 0.3, closed: false, passes: 1, alpha: 0.95 * melt });
    }
    for (const g of this.glints) {
      const tw = Math.max(0, Math.sin(t * 3 + g.ph));
      iceGlint(ctx, this.x + g.x * k, this.y + g.y * k, 1 + tw * 3, tw * melt);
    }
    // melting: a wet ring left where the ice was
    if (melt < 1) {
      Rough.circle(ctx, this.x, this.y, this.r * (1 + (1 - melt) * 0.25), { color: ICE.mid, width: 1.6, jitter: 1, wobble: 2, alpha: (1 - melt) * 0.5 * (melt + 0.2) });
    }
  }
}

/* The moment of landing: a cold flash, a crisp ring, chips of ice thrown
   up and a puff of snow. */
class IceBurst {
  constructor(x, y, r, game) {
    this.id = nextId(); this.x = x; this.y = y; this.r = r;
    this.life = this.max = 0.36;
    if (typeof Chunk !== 'undefined') {
      for (let i = 0; i < Fx.n(5); i++) {
        game.effects.push(new Chunk(x, y, { shape: 'shard', color: ICE.pale, ink: ICE.ink, size: 2.6, speed: 110, up: 150, life: 0.7 }));
      }
      if (!Fx.low) for (let i = 0; i < 2; i++) game.effects.push(new Dust(x, y, r * 0.8, '#eef8ff'));
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = 1 - this.life / this.max, o = E.out(p);
    Rough.boil(this.id, 0);
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, this.r * (1.4 + o), ICE.glow, (1 - p) * 0.8);
    Rough.circle(ctx, this.x, this.y, this.r * (0.4 + o * 0.8), { color: ICE.white, width: 3 * (1 - p) + 1, jitter: 0.6, wobble: 1, passes: 1, alpha: 1 - p });
    Rough.circle(ctx, this.x, this.y, this.r * (0.3 + o * 0.95), { color: ICE.mid, width: 1.6, jitter: 0.6, wobble: 1.5, passes: 1, alpha: (1 - p) * 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + this.id;
      const r0 = this.r * (0.3 + o * 0.6), r1 = r0 + this.r * 0.4 * (1 - p);
      Rough.line(ctx, this.x + Math.cos(a) * r0, this.y + Math.sin(a) * r0 * 0.8, this.x + Math.cos(a) * r1, this.y + Math.sin(a) * r1 * 0.8,
        { color: ICE.white, width: 1.8, jitter: 0.3, passes: 1, alpha: 1 - p });
    }
  }
}

/* --------------------------------------------------------- HAILSTORM */
/* Everything the storm catches wears a crust of ice for as long as it is
   slowed: a frosted rim, icicles hanging off it, a glint now and then. */
class FrostCoat {
  constructor(e, dur) { this.id = nextId(); this.e = e; this.t = 0; this.dur = dur; }
  update(dt) { this.t += dt; return this.t < this.dur && !this.e.dead; }
  draw(ctx, time) {
    const e = this.e, r = e.r * 1.12;
    const a = Math.min(1, this.t / 0.2) * Math.min(1, (this.dur - this.t) / 0.5);
    Rough.boil(this.id, Math.floor(time * 3));
    const ring = Rough.circlePts(e.x, e.y, r, r * 0.08, 12);
    Rough.scribble(ctx, ring, { color: ICE.pale, spacing: 6, width: 2.2, overflow: 1, alpha: 0.35 * a, angle: 0.9 });
    Rough.poly(ctx, ring, { color: '#7fb8e6', width: 2, jitter: 0.8, passes: 1, alpha: 0.85 * a });
    for (let i = -1; i <= 1; i++) {
      const ix = e.x + i * r * 0.45, iy = e.y + r * (0.92 - Math.abs(i) * 0.12);
      const tri = [[ix - 2.4, iy], [ix + 2.4, iy], [ix, iy + 7 + (i === 0 ? 3 : 0)]];
      Rough.scribble(ctx, tri, { color: ICE.pale, spacing: 2, width: 2, overflow: 1.1, alpha: a });
      Rough.poly(ctx, tri, { color: ICE.ink, width: 1.2, jitter: 0.2, alpha: a });
    }
    const tw = Math.max(0, Math.sin(time * 4 + e.id));
    iceGlint(ctx, e.x - r * 0.5, e.y - r * 0.6, 1 + tw * 3, tw * a);
  }
}

/* CLOUDBURST's numbers, falling as hail: a frozen bank of cloud rolls over
   the top of the page, the air goes cold, hailstones come down all over and
   smash, frost creeps in from the edges, and at the moment the storm lands
   everything in it is iced over. */
class Hailstorm extends Cloudburst {
  constructor(game, damage) {
    super(game, damage);
    this.game = game;
    this.drops = [];                         // the parent's rain: none here
    this.coated = false;
    const n = Fx.n(80);
    this.stones = [];
    for (let i = 0; i < n; i++) {
      const tx = (Math.random() - 0.5) * game.w, ty = (Math.random() - 0.5) * game.h * 0.95;
      this.stones.push({ tx, ty, at: 0.12 + Math.random() * 1.05, fall: 0.3 + Math.random() * 0.1,
        s: 3 + Math.random() * 3.5, landed: false, chips: null });
    }
    this.puffs = [];
    for (let i = 0; i < 12; i++) this.puffs.push({ x: (i / 11 - 0.5) * (game.w + 120), y: -game.h / 2 + 10 + Rough.jit(18), r: 46 + Math.random() * 26 });
    this.frost = [];
    const edge = (x0, y0, x1, y1, nx, ny) => {
      const m = 14;
      for (let i = 0; i <= m; i++) {
        const u = i / m;
        this.frost.push({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, nx, ny, len: 18 + Math.random() * 36, at: Math.random() * 0.35 });
      }
    };
    const hw = game.w / 2, hh = game.h / 2;
    edge(-hw, -hh, hw, -hh, 0, 1); edge(-hw, hh, hw, hh, 0, -1);
    edge(-hw, -hh, -hw, hh, 1, 0); edge(hw, -hh, hw, hh, -1, 0);
    Sfx.play('sk_hail', { volume: 1, rateVar: 0 });
  }
  update(dt, game) {
    const alive = super.update(dt, game);     // the same hit, the same slow, at the same beat
    if (this.hit && !this.coated) {
      this.coated = true;
      this.flash = 1;
      for (const e of game.enemies) if (!e.dead) game.effects.push(new FrostCoat(e, 3 + game.statusBonus()));
      game.shake(10);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.18);
    for (const st of this.stones) {
      if (st.landed || this.t < st.at + st.fall) continue;
      st.landed = true;
      st.chips = [];
      for (let i = 0; i < 4; i++) st.chips.push({ a: -Math.PI / 2 + Rough.jit(1.4), v: 30 + Math.random() * 50 });
      if (!Fx.low && Math.random() < 0.35) game.effects.push(new FrostPatch(st.tx, st.ty, 8 + st.s * 1.5));
    }
    return alive;
  }
  draw(ctx, time) {
    const g = this.game, w = g.w, h = g.h;
    const inA = Math.min(1, this.t / 0.3);
    const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
    const a = inA * fade;
    // the cold: the whole page goes blue-grey
    ctx.save();
    ctx.globalAlpha = 0.2 * a;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#8fb7dc';
    ctx.fillRect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
    ctx.restore();
    Rough.boil(this.id, Math.floor(time * 7));
    // frost creeping in from every edge
    for (const f of this.frost) {
      const k = E.out(E.clamp01((this.t - f.at) / 0.4)) * fade;
      if (k <= 0) continue;
      const L = f.len * k, bx = f.x, by = f.y;
      const tipX = bx + f.nx * L, tipY = by + f.ny * L;
      const px = -f.ny * 7, py = f.nx * 7;
      const tri = [[bx - px, by - py], [bx + px, by + py], [tipX, tipY]];
      Rough.scribble(ctx, tri, { color: ICE.pale, spacing: 3, width: 2.6, overflow: 1.05, alpha: 0.8 * k });
      Rough.poly(ctx, tri, { color: '#7fb8e6', width: 1.4, jitter: 0.4, alpha: 0.9 * k });
    }
    // the hail
    for (const st of this.stones) {
      const lt = this.t - st.at;
      if (lt < 0) continue;
      if (!st.landed) {
        const k = Math.min(1, lt / st.fall);
        const x = st.tx - (1 - k) * 140, y = st.ty - (1 - k) * h * 0.9;
        Rough.line(ctx, x, y, x - 14, y - 44, { color: '#a9d8ff', width: 1.8, jitter: 0.4, passes: 1, alpha: 0.6 * fade });
        Rough.blob(ctx, x, y, st.s, ICE.white, ICE.ink, { spacing: 2, fillWidth: 2, sides: 6, width: 1.3, wobble: st.s * 0.2 });
        continue;
      }
      const since = this.t - st.at - st.fall;
      if (since > 0.4) continue;
      const q = since / 0.4;
      for (const c of st.chips) {
        const cx = st.tx + Math.cos(c.a) * c.v * q, cy = st.ty + Math.sin(c.a) * c.v * q + 90 * q * q;
        Rough.line(ctx, cx, cy, cx + 2, cy + 2, { color: ICE.pale, width: 2.2, jitter: 0.2, passes: 1, alpha: 1 - q });
      }
      Rough.circle(ctx, st.tx, st.ty, st.s + q * 10, { color: ICE.white, width: 1.6, jitter: 0.4, wobble: 0.8, passes: 1, alpha: 1 - q });
    }
    // the frozen cloud bank along the top
    for (const p of this.puffs) {
      const drop = (1 - E.out(inA)) * 90;
      ctx.save();
      ctx.globalAlpha = 0.95 * fade;
      Rough.blob(ctx, p.x, p.y - drop, p.r, ICE.deep, '#16263a', { spacing: 7, fillWidth: 7, sides: 10, width: 2.6 });
      ctx.restore();
      Rough.arc(ctx, p.x, p.y - drop, p.r * 0.8, Math.PI * 1.1, Math.PI * 1.7, { color: ICE.white, width: 2, jitter: 0.6, passes: 1, alpha: 0.6 * fade });
    }
    // the moment it lands: a white-blue flash
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.45;
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
      ctx.restore();
    }
  }
}

/* ---------------------------------------------------- the offer card */
/* The puffs of the cloud over a card, as fractions: [x of width, y of
   height, radius]. It hangs over the top and spills past both sides. */
const CRYO_PUFFS = [
  [-0.05, 0.08, 0.15], [0.13, 0.03, 0.2], [0.36, 0.06, 0.21], [0.6, 0.02, 0.2],
  [0.82, 0.06, 0.19], [1.04, 0.09, 0.14], [0.25, 0.14, 0.12], [0.48, 0.15, 0.12],
  [0.71, 0.14, 0.12], [0.03, 0.15, 0.09], [0.94, 0.15, 0.09]
];

/* The Wet Cursor's card under Cryo Rain: a big bank of frozen cloud over
   the top of it - bigger than the card, out past its edges - and under it a
   sheet of heavy rain. Where the cloud is, the card's outline is not: the
   cloud has its own outline, round its own shape. Drawn in place of the
   plain crayon fill and outline. */
function drawCryoCard(ctx, c, time, reveal, outline) {
  const k = Math.min(c.w, c.h * 0.9) * 0.95;
  const puffs = CRYO_PUFFS.map(([fx, fy, fr], i) => ({
    x: c.x + fx * c.w, y: c.y + fy * c.h, r: fr * k, i
  }));
  const low = Math.max(...puffs.map(p => p.y + p.r * 0.7));
  // the rain sheet, from under the cloud to the bottom of the card
  const rain = [c.x, c.y + c.h * 0.08, c.w, c.h * 0.92];
  ctx.save();
  ctx.globalAlpha = reveal * 0.55;
  ctx.fillStyle = '#cfe2f3';
  ctx.fillRect(rain[0], rain[1], rain[2], rain[3]);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(rain[0], rain[1], rain[2], rain[3]); ctx.clip();
  Rough.boil(c.x | 0, Math.floor(time * 7));
  const n = Math.round(c.w * c.h / 420);
  for (let i = 0; i < n; i++) {
    const sx = i * 37 % c.w;
    const sp = 260 + (i * 53 % 140);
    const y = rain[1] + ((time * sp + i * 61) % (rain[3] + 30)) - 20;
    const x = rain[0] + sx + (y - rain[1]) * 0.18;
    Rough.line(ctx, x, y, x - 4, y - 18, { color: i % 3 ? '#4f86b8' : ICE.mid, width: 1.7, jitter: 0.2, passes: 1, alpha: 0.5 * reveal });
  }
  ctx.restore();

  // the card's own icy outline - the cloud will be laid over the top of it
  const pts = Rough.rectPts(c.x, c.y, c.w, c.h);
  Rough.bloom(ctx, c.x + c.w / 2, c.y + c.h / 2, Math.max(c.w, c.h) * 0.7, ICE.glow, 0.22 * outline);
  Rough.boil(c.x * 5 | 0, Math.floor(time * 3.5));
  Rough.poly(ctx, pts, { color: '#7fb8e6', width: 3.4, jitter: 1.2, progress: outline });
  for (const [sx, sy] of [[c.x, c.y + c.h], [c.x + c.w, c.y + c.h]]) {
    if (outline >= 1) iceGlint(ctx, sx, sy, 4 + Math.sin(time * 3 + sx) * 1.5, 1);
  }

  // the cloud, in crayon like everything else: each puff's edge drawn in
  // wobbly ink, then paper laid over the inside of the whole shape (so only
  // its outer edge keeps a line, and the card's outline under it is gone),
  // then the inside scribbled in dark blue, past the edges a little
  Rough.boil(c.x * 3 | 0, Math.floor(time * 3.5));
  const shapes = puffs.map(p => Rough.circlePts(p.x, p.y, p.r, p.r * 0.13, Math.max(10, Math.round(p.r / 3))));
  const path = (g, sh) => { g.moveTo(sh[0][0], sh[0][1]); for (let i = 1; i < sh.length; i++) g.lineTo(sh[i][0], sh[i][1]); g.closePath(); };
  for (const sh of shapes) Rough.poly(ctx, sh, { color: '#16263a', width: 4.2, jitter: 1.6, passes: 2, alpha: reveal });
  ctx.save();
  ctx.globalAlpha = reveal;
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath(); for (const sh of shapes) path(ctx, sh); ctx.fill();
  ctx.beginPath(); for (const sh of shapes) path(ctx, sh); ctx.clip();
  const box = [[c.x - c.w * 0.2, c.y - c.h * 0.2], [c.x + c.w * 1.2, c.y - c.h * 0.2], [c.x + c.w * 1.2, low + 10], [c.x - c.w * 0.2, low + 10]];
  Rough.scribble(ctx, box, { color: ICE.deep, spacing: 4, width: 5, overflow: 1, alpha: 0.95 * reveal, angle: 0.5 });
  Rough.scribble(ctx, box, { color: '#16263a', spacing: 9, width: 3.5, overflow: 1, alpha: 0.55 * reveal, angle: -0.8 });
  Rough.scribble(ctx, box, { color: '#4a78a8', spacing: 14, width: 2.6, overflow: 1, alpha: 0.5 * reveal, angle: 1.2 });
  ctx.restore();
  // frost catching the tops of the high puffs, icicles off the low ones
  for (const p of puffs) {
    if (p.y < c.y + c.h * 0.06) {
      Rough.arc(ctx, p.x, p.y, p.r * 0.72, Math.PI * 1.12, Math.PI * 1.72, { color: ICE.white, width: 1.8, jitter: 0.4, passes: 1, alpha: 0.55 * reveal });
    }
    if (p.y > c.y + c.h * 0.1 && p.x > c.x && p.x < c.x + c.w) {
      const iy = p.y + p.r * 0.93, ix = p.x + Rough.jit(3);
      for (const [dx, len] of [[-p.r * 0.35, 8], [0, 13], [p.r * 0.35, 9]]) {
        const tri = [[ix + dx - 3, iy - 2], [ix + dx + 3, iy - 2], [ix + dx, iy + len]];
        Rough.scribble(ctx, tri, { color: ICE.pale, spacing: 2, width: 2, overflow: 1.1, alpha: reveal });
        Rough.poly(ctx, tri, { color: ICE.ink, width: 1.2, jitter: 0.2, alpha: reveal });
      }
    }
  }
  const tw = Math.max(0, Math.sin(time * 2.5));
  iceGlint(ctx, puffs[3].x + puffs[3].r * 0.3, puffs[3].y - puffs[3].r * 0.3, 2 + tw * 3, tw * reveal);
}

/* ------------------------------------------------------ the shop card */
function cryoPreview(ctx, w, h, t, dt, c) {
  c.fx = c.fx || [];
  c.next = (c.next || 0) - dt;
  const fake = { effects: c.fx, enemies: [], w, h, areaDamage() { }, statusBonus() { return 0; }, shake() { } };
  if (c.next <= 0) {
    c.next = 1.3;
    for (let i = 0; i < 3; i++) {
      const s = new IceShard(w * 0.64, h * 0.66, -Math.PI * (0.1 + i * 0.4), fake, 16, 0);
      c.fx.push(s);
    }
  }
  const muted = Sfx.play; Sfx.play = () => { };
  for (let i = 0; i < c.fx.length; i++) if (!c.fx[i].update(dt, fake)) { c.fx.splice(i, 1); i--; }
  Sfx.play = muted;
  // a strip of frozen cloud and a few hailstones, for the look of it
  Rough.boil(991, Math.floor(t * 3));
  for (let i = 0; i < 5; i++) Rough.blob(ctx, w * (0.1 + i * 0.2), 4, 20, ICE.deep, '#16263a', { spacing: 6, fillWidth: 5, sides: 9, width: 2 });
  for (let i = 0; i < 6; i++) {
    const y = ((t * 170 + i * 47) % (h + 20)) - 10, x = (i * 67 % w) + y * 0.2;
    Rough.line(ctx, x, y, x - 4, y - 16, { color: '#a9d8ff', width: 1.6, jitter: 0.3, passes: 1, alpha: 0.7 });
  }
  for (const f of c.fx) if (f.under) f.draw(ctx, t);
  for (const f of c.fx) if (!f.under) f.draw(ctx, t);
  ctx.save();
  ctx.translate(w * 0.18, h * 0.24);
  ctx.scale(2.6, 2.6);
  CursorSprites.cryo(ctx, 0, 0, 1, ICE.mid, t);
  ctx.restore();
}
