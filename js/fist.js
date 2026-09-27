/* FANDHARN - the Chalk Fist, and its skill.

   A fist carved out of a stick of chalk and snapped off at the wrist. A click
   is a jab: it drives onto the pointer, squashes, springs back and settles,
   one frame at a time at 12 fps like everything else that is drawn by hand.
   Every tenth click it hits the page hard enough to blow a ring of chalk dust
   out, knocking everything in it away from the castle.

   Its skill is one of three, rolled ahead of time and named on the button,
   so you know which one is loaded:
     FINGER GUNS - the fist opens into a finger gun and puts ten shots into
                   random enemies, 15 each
     SKYFALL     - the fist goes up off the top of the page and comes down on
                   the castle: the same shockwave as the Sledgehammer's QUAKE
     HAYMAKER    - five random enemies are punched clean off the page, 5 each
   While it plays the page stays dark, like a blackboard, and the chalk is the
   only bright thing on it. */

const FIST = {
  FPS: 12,
  CHALK: '#ebebe4', WHITE: '#fdfdfa', SHADE: '#c9d1dd', GRAIN: '#7f8a9c', LINE: '#363d4c', GLOW: '#d8ecff',
  DUST: '#e4e8ee', COLOR: '#8fa3ba',
  POWER_R: BLOCK, POWER_DMG: 4, POWER_KNOCK: BLOCK * 0.5,
  GUN_SHOTS: 10, GUN_DMG: 15, GUN_EVERY: 0.17,
  HAY_HITS: 5, HAY_DMG: 5, HAY_EVERY: 0.34
};

const FIST_SKILLS = {
  gun: { name: 'FINGER GUNS', blurb: 'the fist opens into a finger gun and empties it into ten of them' },
  sky: { name: 'SKYFALL', blurb: 'the fist goes up off the page and comes down on the castle' },
  hay: { name: 'HAYMAKER', blurb: 'five of them are punched clean off the page' }
};

function rollFist() { return ['gun', 'sky', 'hay'][Math.floor(Math.random() * 3)]; }

/* The skill the fist has loaded right now. */
function fistSkill() {
  if (typeof Game === 'undefined') return FIST_SKILLS.gun;
  if (!FIST_SKILLS[Game.fistNext]) Game.fistNext = rollFist();
  return FIST_SKILLS[Game.fistNext];
}

/* ------------------------------------------------------------ the hand */
/* In its own units: pointing along +x, the middle of the knuckles' front face
   on 0,0, thumb on top. A unit is a pixel at scale 1. It is a fist held
   upright, seen from the palm side - the comic-book punch - so the four
   curled fingers stack down the front and the thumb lies across the top two. */
// the palm and the wrist; its front edge dips between the fingers, which
// come out from under it
const FIST_BODY = [[-6, -12.6], [-3.6, -8.2], [-5.4, -4.6], [-3.8, -1.4], [-5.8, 2.2], [-4.4, 5.2],
  [-6.2, 8.4], [-5, 11], [-8, 14.2], [-15, 13.6], [-18, 10.2], [-24.5, 9.2], [-26.6, 6.2],
  [-24, 3.6], [-27.4, 0.6], [-24.8, -2.2], [-27, -5.4], [-24.6, -8.2], [-18, -9.6], [-14, -12.8]];
// middle, ring and little finger, always curled: [back x, front x, y, radius]
const FIST_CURLED = [[-10, 3.2, -1.4, 3.5], [-10, 2, 5.1, 3.3], [-10, -0.4, 10.8, 2.8]];
const FIST_WRIST = -26;                       // where the chalk snapped off

/* A stadium from a to b, as a closed list of points - `r2` tapers it. */
function fistCapsule(ax, ay, bx, by, r, n, r2) {
  n = n || 6;
  const rb = r2 == null ? r : r2;
  const a = Math.atan2(by - ay, bx - ax), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a - Math.PI / 2 + (i / n) * Math.PI;
    pts.push([bx + Math.cos(t) * rb, by + Math.sin(t) * rb]);
  }
  for (let i = 0; i <= n; i++) {
    const t = a + Math.PI / 2 + (i / n) * Math.PI;
    pts.push([ax + Math.cos(t) * r, ay + Math.sin(t) * r]);
  }
  return pts;
}

/* Local to page: `o.sx`/`o.sy` squash and stretch about the knuckles, and a
   hand facing left is mirrored rather than turned over, so the thumb stays up. */
function fistMap(x, y, s, ang, o) {
  const sx = (o && o.sx) || 1, sy = (o && o.sy) || 1;
  const flip = o && o.flip != null ? o.flip : (Math.cos(ang) < -0.01 ? -1 : 1);
  const c = Math.cos(ang), sn = Math.sin(ang);
  return (lx, ly) => {
    const px = lx * sx * s, py = ly * sy * s * flip;
    return [x + px * c - py * sn, y + px * sn + py * c];
  };
}

/* How far the index finger reaches (`o.gun`, 0 curled .. 1 pointing) and
   where the thumb is (`o.thumb`, 0 wrapped .. 1 cocked up). */
function fistIndex(gun) { return { bx: 2.2 + 17 * gun, by: -8.2 - 0.8 * gun, r: 3.6 - 0.5 * gun }; }
function fistThumb(u) {
  return { ax: -13 + 1 * u, ay: -8.5 - 2.5 * u, bx: -0.5 - 9 * u, by: -3.4 - 18.6 * u };
}

/* Draw it. Returns where its parts ended up on the page. */
function drawChalkFist(ctx, x, y, s, ang, o) {
  o = o || {};
  const gun = o.gun || 0, thumb = o.thumb == null ? gun : o.thumb;
  const alpha = o.alpha == null ? 1 : o.alpha;
  const P = fistMap(x, y, s, ang, o);
  const M = pts => pts.map(q => P(q[0], q[1]));
  const lw = 1.2 + 0.55 * s, sp = 2.4 + 0.95 * s, fw = 2 + 0.8 * s, jt = 0.3 + 0.2 * s;
  const low = Rough.isLow(), passes = s > 2 && !low ? 2 : 1;
  Rough.srand((o.seed || 1) * 7919 + (o.frame || 0) * 104729);

  const shape = (loc, shade) => {
    const m = M(loc);
    // solid chalk first, so nothing behind it shows through between strokes
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = FIST.CHALK;
    ctx.beginPath();
    for (let i = 0; i < m.length; i++) i ? ctx.lineTo(m[i][0], m[i][1]) : ctx.moveTo(m[i][0], m[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    Rough.scribble(ctx, m, { color: FIST.WHITE, spacing: sp, width: fw, overflow: 0.96, alpha: 0.95 * alpha, angle: -0.5 });
    if (shade && !low) Rough.scribble(ctx, m, { color: FIST.SHADE, spacing: sp * 2.3, width: fw * 0.55, overflow: 0.9, alpha: 0.5 * alpha, angle: 0.95 });
    Rough.poly(ctx, m, { color: FIST.LINE, width: lw, jitter: jt, alpha, passes });
    return m;
  };
  const crease = (x1, y1, x2, y2, a) => {
    const p = P(x1, y1), q = P(x2, y2);
    Rough.line(ctx, p[0], p[1], q[0], q[1], { color: FIST.LINE, width: lw * 0.7, jitter: jt * 0.6, passes: 1, alpha: alpha * (a || 0.75) });
  };
  const drawThumb = () => {
    const T = fistThumb(thumb);
    shape(fistCapsule(T.ax, T.ay, T.bx, T.by, 4, 7, 3), false);
    // the nail, on the outside near the tip
    const a = Math.atan2(T.by - T.ay, T.bx - T.ax), nx = -Math.sin(a), ny = Math.cos(a);
    const side = -1;                                      // the top of the thumb
    const n0 = [T.bx - Math.cos(a) * 3.2 + nx * side * 1.5, T.by - Math.sin(a) * 3.2 + ny * side * 1.5];
    const n1 = [T.bx - Math.cos(a) * 0.4 + nx * side * 1.2, T.by - Math.sin(a) * 0.4 + ny * side * 1.2];
    crease(n0[0], n0[1], n1[0], n1[1], 0.55);
    crease(T.ax + (T.bx - T.ax) * 0.55 + nx * 2.4, T.ay + (T.by - T.ay) * 0.55 + ny * 2.4,
      T.ax + (T.bx - T.ax) * 0.55 - nx * 2.4, T.ay + (T.by - T.ay) * 0.55 - ny * 2.4, 0.45);
  };

  // the curled fingers come out from under the palm: little, ring, middle
  for (let i = FIST_CURLED.length - 1; i >= 0; i--) {
    const f = FIST_CURLED[i];
    shape(fistCapsule(f[0], f[2], f[1], f[2], f[3]), i > 0);
    crease(f[1] - 3.6, f[2] - f[3] * 0.64, f[1] - 4, f[2] + f[3] * 0.64);        // the middle joint
  }
  const I = fistIndex(gun);
  shape(fistCapsule(-10, -8.2, I.bx, I.by, I.r), false);
  crease(-1.4, -8.2 - I.r * 0.64, -1.8, -8.2 + I.r * 0.64);
  if (gun > 0.5) {
    const jx = I.bx - 6.5;                    // the last joint, and the nail
    crease(jx, I.by - I.r * 0.6, jx - 0.3, I.by + I.r * 0.6, 0.6);
    crease(I.bx - 3.6, I.by - I.r * 0.55, I.bx - 0.6, I.by - I.r * 0.55, 0.55);
  }
  // the palm and the broken-off wrist over their ends
  const body = shape(FIST_BODY, true);
  // a crease across the palm, the grain of the stick down the wrist, the break
  const pc = [P(-7, -4), P(-10.5, 1.5), P(-13.5, 7.5)];
  Rough.poly(ctx, pc, { color: FIST.LINE, width: lw * 0.7, jitter: jt * 0.6, closed: false, passes: 1, alpha: alpha * 0.55 });
  crease(-23.5, -4.2, -17.5, -4.8, 0.35);
  crease(-23, 3.8, -17, 4.4, 0.35);
  if (s > 1.4) {
    crease(-26.2, -3.4, -24, -1.6, 0.5);
    crease(-25.8, 2.6, -23.8, 4.2, 0.5);
  }
  drawThumb();
  if (!low && s > 1.6) Rough.grain(ctx, body, FIST.GRAIN, 0.006, (o.seed || 1) + (o.frame || 0));

  return {
    tip: P(I.bx + I.r, I.by), front: P(2.6, 0), wrist: P(FIST_WRIST, 0),
    top: P(-12, -12), P
  };
}

/* A puff of chalk: a soft pale cloud with a crayon edge. */
function chalkCloud(ctx, x, y, r, alpha) {
  if (alpha <= 0.01 || r < 0.5) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = FIST.DUST;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
  Rough.circle(ctx, x, y, r, { color: FIST.SHADE, width: 1.4, jitter: 0.9, wobble: r * 0.12, passes: 1, alpha: alpha * 0.9 });
}

/* A chalk impact star: points out, a white heart, an ink edge. */
function chalkStar(ctx, x, y, R, spin, alpha, n) {
  const pts = starPts(x, y, R, R * 0.46, spin, n || 6);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = FIST.WHITE;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
  ctx.restore();
  Rough.scribble(ctx, pts, { color: FIST.SHADE, spacing: Math.max(3, R * 0.25), width: 2, overflow: 0.9, alpha: alpha * 0.6, angle: 0.8 });
  Rough.poly(ctx, pts, { color: FIST.LINE, width: 1.4 + R * 0.05, jitter: 0.7, passes: 1, alpha });
}

/* ------------------------------------------------------------ the cursor */
// the jab, a frame each: d is how far the knuckles are past the pointer
const FIST_JAB = [
  { d: 5, sx: 1.36, sy: 0.8, lines: true },       // the strike, stretched onto the point
  { d: 2, sx: 0.74, sy: 1.24 },                   // the squash as it lands
  { d: -7, sx: 1.08, sy: 0.94 },                  // springing back
  { d: -4, sx: 0.96, sy: 1.04 }                   // settling
];
const FIST_REST = { d: -3, sx: 1, sy: 1 };
const FIST_AIM = -2.3;                            // up and to the left, like an arrow
// its charge ring goes round the fist, not through its knuckles
CursorRings.fist = { dx: 10, dy: 11, r: 25 };

CursorSprites.fist = function (ctx, x, y, s, color, t) {
  const G = typeof Game !== 'undefined' ? Game : null;
  const since = G && G.fistAt != null ? G.time - G.fistAt : 99;
  const f = since >= 0 ? Math.floor(since * FIST.FPS) : 99;
  const frame = Math.floor(t * FIST.FPS);
  const jab = FIST_JAB[f] || FIST_REST;
  const S = 1.08 * s;
  // the next click is the big one: it trembles and glows
  const loaded = G && G.state === 'playing' && G.cursorId === 'fist' && G.cursorCharge % 10 === 9;
  const bob = f < FIST_JAB.length ? 0 : [0, 0.5, 0.8, 0.5, 0, -0.4][frame % 6] * 0.9;
  const d = (jab.d + bob) * S;
  const ax = Math.cos(FIST_AIM), ay = Math.sin(FIST_AIM);
  Rough.srand(frame * 31 + 7);
  const tx = loaded ? Rough.jit(1.1) : 0, ty = loaded ? Rough.jit(1.1) : 0;
  const fx = x + ax * d + tx, fy = y + ay * d + ty;
  if (loaded) Rough.bloom(ctx, fx - ax * 12 * S, fy - ay * 12 * S, 30 * S, FIST.GLOW, 0.75);
  if (jab.lines) {                              // speed lines trailing the strike
    const nx = -ay, ny = ax;
    for (let i = -1; i <= 1; i++) {
      const bx = fx - ax * (30 + Math.abs(i) * 4) * S + nx * i * 7 * S, by = fy - ay * (30 + Math.abs(i) * 4) * S + ny * i * 7 * S;
      Rough.line(ctx, bx, by, bx - ax * 12 * S, by - ay * 12 * S, { color: FIST.LINE, width: 1.5, jitter: 0.5, passes: 1, alpha: 0.6 });
    }
  }
  const at = drawChalkFist(ctx, fx, fy, S, FIST_AIM, { sx: jab.sx, sy: jab.sy, frame, seed: 5 });
  // chalk flaking off the snapped wrist and drifting down
  const T = frame / FIST.FPS;
  ctx.save();
  ctx.fillStyle = '#c3cbd7';
  for (let i = 0; i < (loaded ? 5 : 3); i++) {
    const life = (T * 0.8 + i * 0.29) % 1;
    const px = at.wrist[0] + Math.sin(i * 2.1 + life * 3) * 3 * S + (i - 1) * 2.4 * S;
    const py = at.wrist[1] + life * 16 * S;
    ctx.globalAlpha = (1 - life) * 0.85;
    const sz = (1.8 - life) * S + 0.4;
    ctx.fillRect(px, py, sz, sz);
  }
  ctx.restore();
};

/* ------------------------------------------------------- click effects */
/* Where a jab lands: a white star for one frame and a few puffs of chalk. */
class ChalkPuff {
  constructor(x, y, hit) {
    this.id = nextId();
    this.x = x; this.y = y; this.hit = hit;
    this.t = 0; this.dur = hit ? 0.42 : 0.3;
    this.bits = [];
    const n = Fx.n(hit ? 6 : 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.7;
      this.bits.push({ a, sp: (hit ? 26 : 16) * (0.6 + Math.random() * 0.8), r: (hit ? 5 : 3.6) * (0.6 + Math.random() * 0.7) });
    }
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const f = Math.floor(this.t * FIST.FPS), q = f / FIST.FPS;
    const p = Math.min(1, q / this.dur), o = E.out(p);
    Rough.boil(this.id, f);
    if (f === 0) chalkStar(ctx, this.x, this.y, this.hit ? 13 : 8, this.id, 1, this.hit ? 7 : 5);
    for (const b of this.bits) {
      const d = 5 + b.sp * o;
      chalkCloud(ctx, this.x + Math.cos(b.a) * d, this.y + Math.sin(b.a) * d * 0.7 - o * 5, b.r * (0.7 + o * 0.8), 1 - p);
    }
  }
}

/* Every tenth jab: the page gives, and a ring of chalk blows out of it. */
class ChalkBurst {
  constructor(x, y, R, big) {
    this.id = nextId();
    this.x = x; this.y = y; this.R = R; this.big = !!big;
    this.t = 0; this.dur = big ? 0.9 : 0.62;
    this.clouds = [];
    const n = Fx.n(big ? 22 : 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      this.clouds.push({ a, d: 0.75 + Math.random() * 0.4, r: R * (big ? 0.2 : 0.26) * (0.7 + Math.random() * 0.6) });
    }
    this.rays = [];
    for (let i = 0; i < 10; i++) this.rays.push({ a: Math.random() * Math.PI * 2, l: 0.35 + Math.random() * 0.4 });
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const f = Math.floor(this.t * FIST.FPS), q = f / FIST.FPS;
    const p = Math.min(1, q / this.dur), o = E.out(p);
    const { x, y, R } = this;
    Rough.boil(this.id, f);
    if (!Fx.low) Rough.bloom(ctx, x, y, R * (1.2 + o * 0.5), FIST.GLOW, (1 - p) * 0.8);
    if (f <= 1) chalkStar(ctx, x, y, R * (f ? 0.75 : 0.55), this.id, 1, 8);
    // the shock ring, broken like a chalk line dragged on its side
    const rr = R * (0.3 + o * 0.85);
    Rough.circle(ctx, x, y, rr, { color: FIST.WHITE, width: 7 * (1 - p) + 2, jitter: 1.2, wobble: 2, passes: 1, alpha: (1 - p) * 0.9 });
    Rough.circle(ctx, x, y, rr + 3, { color: FIST.LINE, width: 1.6, jitter: 1, wobble: 2, passes: 1, alpha: (1 - p) * 0.7 });
    for (const r of this.rays) {
      const r0 = rr + 4, r1 = r0 + R * r.l * (1 - p);
      Rough.line(ctx, x + Math.cos(r.a) * r0, y + Math.sin(r.a) * r0, x + Math.cos(r.a) * r1, y + Math.sin(r.a) * r1,
        { color: FIST.LINE, width: 1.8, jitter: 0.4, passes: 1, alpha: (1 - p) * 0.8 });
    }
    for (const c of this.clouds) {
      const d = R * c.d * (0.35 + o * 0.75);
      chalkCloud(ctx, x + Math.cos(c.a) * d, y + Math.sin(c.a) * d * 0.8 - o * 8, c.r * (0.6 + o * 0.9), (1 - p) * 0.95);
    }
  }
}

/* Every tenth click. A block of chalk dust: 4 damage, and a shove half a block
   straight out from the castle. */
CursorPowers.fist = function (game, x, y) {
  const R = FIST.POWER_R * game.aoeScale(), dmg = game.aoeDamage(FIST.POWER_DMG);
  for (const e of game.enemies) {
    if (e.dead || Math.hypot(e.x - x, e.y - y) > R + e.r) continue;
    e.hurt(dmg, game, { color: FIST.COLOR });
    if (e.dead || e.kind === 'ignis' || e.kind === 'heart') continue;
    const d = Math.hypot(e.x, e.y) || 1, push = FIST.POWER_KNOCK * (e.boss ? 0.4 : 1);
    e.knock = { dx: (e.x / d) * push, dy: (e.y / d) * push, t: 0, dur: 0.22 };
    e.hitT = 1;
  }
  game.effects.push(new ChalkBurst(x, y, R, false));
  if (!Fx.low) for (let i = 0; i < 4; i++) game.effects.push(new Dust(x, y, R * 0.6, FIST.DUST));
  game.shake(6);
  Sfx.play('chalk_burst', { volume: 0.85, throttle: 60 });
};

/* ------------------------------------------------------------ the skill */
/* What every one of the three shares: it is drawn over the dark while the
   cast holds the page, it keeps its own chalk dust, and it breaks up at the
   end. Its pose and position move at 12 fps; `q` is its time, so stepped. */
class FistAct {
  constructor(game, cine, s) {
    this.id = nextId();
    this.game = game; this.cine = cine; this.s = s;
    this.t = 0; this.dust = []; this.finished = false; this.broke = false;
    const hw = game.w / 2 - 90, hh = game.h / 2 - 90;
    this.ax = Math.max(-hw, Math.min(hw, cine ? cine.wx : 0));
    this.ay = Math.max(-hh, Math.min(hh, cine ? cine.wy : 0));
    if (cine) cine.over.push(this);
  }
  get f() { return Math.floor(this.t * FIST.FPS); }
  get q() { return this.f / FIST.FPS; }
  update(dt, game) {
    this.t += dt;
    this.step(dt, game);
    for (const d of this.dust) {
      d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= Math.pow(0.12, dt); d.vy = d.vy * Math.pow(0.12, dt) - 14 * dt; d.r += d.grow * dt;
    }
    this.dust = this.dust.filter(d => d.life > 0);
    if (this.t >= this.dur) { this.finished = true; return false; }
    return true;
  }
  /* chalk dust thrown off at x,y */
  puff(x, y, n, speed, size, dir) {
    n = Fx.n(n);
    for (let i = 0; i < n; i++) {
      const a = dir == null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * 1.4;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.dust.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: size * (0.5 + Math.random() * 0.7), grow: size * 1.6, life: 0.35 + Math.random() * 0.35, max: 0.7 });
    }
  }
  /* The chalk giving up: pieces thrown off the hand and a cloud. */
  crumble(x, y) {
    if (this.broke) return;
    this.broke = true;
    const s = this.s;
    for (let i = 0; i < Fx.n(12); i++) {
      this.game.effects.push(new Chunk(x + Rough.jit(14 * s), y + Rough.jit(10 * s), {
        shape: i % 3 ? 'gob' : 'shard', color: i % 2 ? FIST.CHALK : '#dfe3ea', ink: FIST.LINE,
        size: 2.2 + s * 1.1, speed: 70 + s * 20, up: 120 + s * 30, life: 1.1
      }));
    }
    this.puff(x, y, 14, 60 + s * 12, 4 + s * 2);
    Sfx.play('chalk_crumble', { volume: 0.8 });
  }
  draw(ctx, time) {
    if (this.cine && Game.cinematic === this.cine) return;   // the cast draws it, over the dark
    this.render(ctx, time);
  }
  drawOver(ctx, time) { this.render(ctx, time); }
  renderDust(ctx) {
    for (const d of this.dust) chalkCloud(ctx, d.x, d.y, d.r, Math.min(1, d.life / 0.3) * 0.9);
  }
}

/* The page as the fist sees it: things on it, not already dying. */
function fistTargets(game, keep) {
  const hw = game.w / 2 + 10, hh = game.h / 2 + 10;
  return game.enemies.filter(e => !e.dead && e.spawnT > 0.3 && Math.abs(e.x) < hw && Math.abs(e.y) < hh && (!keep || keep(e)));
}
function fistShuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* FINGER GUNS. The fist opens into a finger gun, ten targets get a chalk
   circle, and it shoots them in turn; then it blows the smoke off. */
class FistGun extends FistAct {
  constructor(game, cine) {
    super(game, cine, 3.2);
    const live = fistShuffle(fistTargets(game));
    this.marks = live.slice(0, FIST.GUN_SHOTS).map((e, i) => ({ e, x: e.x, y: e.y, at: 0.18 + i * 0.035, hit: -1 }));
    this.shots = [];
    for (let i = 0; i < FIST.GUN_SHOTS; i++) {
      const m = this.marks.length ? this.marks[i % this.marks.length] : null;
      this.shots.push({ m, at: 0.62 + i * FIST.GUN_EVERY, done: false });
    }
    this.tracers = [];
    this.aim = this.marks.length ? Math.atan2(this.marks[0].y - this.ay, this.marks[0].x - this.ax) : -Math.PI / 2;
    this.lastShot = 0.62 + (FIST.GUN_SHOTS - 1) * FIST.GUN_EVERY;
    this.dur = this.lastShot + 1.25;
    this.cocked = false;
    if (cine) { cine.hold = this.dur - 0.45; cine.holdLevel = 0.72; }
    this.puff(this.ax, this.ay, 12, 90, 7);
    Sfx.play('fist_clench', { volume: 0.9 });
  }
  /* where the knuckles are for a given aim, the wrist staying put */
  front(ang, back) {
    const L = (-FIST_WRIST - back) * this.s;
    return [this.ax + Math.cos(ang) * L, this.ay + Math.sin(ang) * L];
  }
  target(sh) {
    let m = sh.m;
    if (m && m.e && !m.e.dead) { m.x = m.e.x; m.y = m.e.y; return m; }
    // the one it had is already down: anything else still standing
    const others = fistTargets(this.game);
    if (others.length) {
      const e = others[Math.floor(Math.random() * others.length)];
      m = this.marks.find(k => k.e === e);
      if (!m) { m = { e, x: e.x, y: e.y, at: this.t, hit: -1 }; this.marks.push(m); }
      sh.m = m;
      return m;
    }
    return m;
  }
  step(dt, game) {
    const q = this.q;
    if (!this.cocked && q >= 5 / FIST.FPS) { this.cocked = true; Sfx.play('gun_cock', { volume: 0.9 }); }
    for (const m of this.marks) if (m.e && !m.e.dead) { m.x = m.e.x; m.y = m.e.y; }
    // turn to the next one a frame before it fires
    const next = this.shots.find(sh => !sh.done);
    if (next && q >= next.at - 1 / FIST.FPS) {
      const m = this.target(next);
      if (m) this.aim = Math.atan2(m.y - this.ay, m.x - this.ax);
    }
    for (const sh of this.shots) {
      if (sh.done || this.t < sh.at) continue;
      sh.done = true;
      const m = this.target(sh);
      const tip = this.tipAt(this.aim);
      let tx, ty;
      if (m && m.e && !m.e.dead) {
        tx = m.e.x; ty = m.e.y;
        m.e.hurt(FIST.GUN_DMG, game, { color: FIST.COLOR });
        m.hit = this.t;
        game.effects.push(new HitSpark(tx, ty, FIST.COLOR, true));
        game.effects.push(new ChalkPuff(tx, ty, true));
      } else {                                  // nothing left: it shoots the page
        const a = this.aim + (Math.random() - 0.5) * 0.4;
        tx = tip[0] + Math.cos(a) * 260; ty = tip[1] + Math.sin(a) * 260;
      }
      this.tracers.push({ x0: tip[0], y0: tip[1], x1: tx, y1: ty, at: this.t });
      this.puff(tip[0], tip[1], 5, 70, 4, this.aim);
      game.shake(4);
      Sfx.play('finger_gun', { volume: 0.85, rateVar: 0.06, voices: 6 });
    }
    // smoke curling up off the fingertip once it is done
    if (q > this.lastShot + 0.25 && q < this.dur - 0.4 && Math.random() < dt * 16) {
      const tip = this.tipAt(this.pose().ang);
      this.dust.push({ x: tip[0] + Rough.jit(2), y: tip[1], vx: Rough.jit(12), vy: -40 - Math.random() * 20, r: 2.5, grow: 9, life: 0.7, max: 0.7 });
    }
    if (!this.broke && q >= this.dur - 0.38) { const p = this.pose(); const fr = this.front(p.ang, p.back); this.crumble(fr[0], fr[1]); }
  }
  /* The pose for now: how far it has opened, where it points, the kick. */
  pose() {
    const q = this.q, f = this.f;
    let gun = 0, thumb = 0, sx = 1, sy = 1, back = 0, ang = this.aim, alpha = 1;
    // forming: pops in, squeezes, the finger comes out, the thumb cocks
    const FORM = [{ sc: 0.55 }, { sc: 1.16 }, { sc: 0.94 }, { g: 0.45 }, { g: 1, t: 0.35 }, { g: 1, t: 1 }];
    if (f < FORM.length) {
      const k = FORM[f];
      const sc = k.sc || 1;
      sx = sc; sy = sc; gun = k.g || 0; thumb = k.t || 0;
    } else { gun = 1; thumb = 1; }
    // the kick on each shot: up and back for a frame, half of it the next
    for (const sh of this.shots) {
      const u = this.t - sh.at;
      if (u < 0 || u >= 2 / FIST.FPS) continue;
      const k = u < 1 / FIST.FPS ? 1 : 0.4;
      const up = Math.cos(ang) < 0 ? 1 : -1;      // "up" flips with the hand
      ang += up * 0.34 * k; back += 5 * k; sx *= 1 - 0.08 * k; sy *= 1 + 0.1 * k;
      thumb = 1 - 0.6 * k;                        // the hammer drops
    }
    // done: raised to the sky, smoking
    const after = q - this.lastShot - 2 / FIST.FPS;
    if (after > 0) {
      const k = Math.min(1, after / 0.25);
      const up = Math.cos(this.aim) < 0 ? -Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35;
      ang = this.aim + (up - this.aim) * E.out(k);
    }
    if (q >= this.dur - 0.38) alpha = Math.max(0, 1 - (q - (this.dur - 0.38)) / 0.25);
    return { gun, thumb, sx, sy, back, ang, alpha };
  }
  tipAt(ang) {
    const p = this.pose();
    const fr = this.front(ang, p.back);
    const P = fistMap(fr[0], fr[1], this.s, ang, p);
    const I = fistIndex(p.gun);
    return P(I.bx + I.r, I.by);
  }
  render(ctx, time) {
    const f = this.f, q = this.q;
    Rough.boil(this.id, f);
    // the circles on what it is going to shoot, and the X once it has
    for (const m of this.marks) {
      if (q < m.at) continue;
      const draw = Math.min(1, (q - m.at) / (2 / FIST.FPS));
      const fade = q > this.dur - 0.5 ? Math.max(0, 1 - (q - (this.dur - 0.5)) / 0.4) : 1;
      const r = (m.e ? m.e.r : 14) + 9;
      Rough.circle(ctx, m.x, m.y, r, { color: FIST.WHITE, width: 3, jitter: 1.4, wobble: 2, passes: 1, progress: draw, alpha: 0.95 * fade });
      if (draw >= 1) {
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          Rough.line(ctx, m.x + Math.cos(a) * (r - 4), m.y + Math.sin(a) * (r - 4), m.x + Math.cos(a) * (r + 7), m.y + Math.sin(a) * (r + 7),
            { color: FIST.WHITE, width: 2.4, jitter: 0.6, passes: 1, alpha: 0.9 * fade });
        }
      }
      if (m.hit >= 0) {
        const k = Math.min(1, (this.t - m.hit) / (2 / FIST.FPS)), c = r * 0.65;
        Rough.line(ctx, m.x - c, m.y - c, m.x - c + 2 * c * k, m.y - c + 2 * c * k, { color: FIST.WHITE, width: 3.4, jitter: 1, passes: 1, alpha: fade });
        if (k >= 1) Rough.line(ctx, m.x + c, m.y - c, m.x - c, m.y + c, { color: FIST.WHITE, width: 3.4, jitter: 1, passes: 1, alpha: fade });
      }
    }
    // the shots: a streak of chalk, gone in three frames
    for (const tr of this.tracers) {
      const age = Math.floor((this.t - tr.at) * FIST.FPS);
      if (age > 2) continue;
      const a = 1 - age / 3;
      if (!Fx.low) Rough.bloom(ctx, tr.x1, tr.y1, 34, FIST.GLOW, a * 0.8);
      Rough.line(ctx, tr.x0, tr.y0, tr.x1, tr.y1, { color: FIST.GLOW, width: 9 * a, jitter: 1.4, passes: 1, alpha: a * 0.45 });
      Rough.line(ctx, tr.x0, tr.y0, tr.x1, tr.y1, { color: FIST.WHITE, width: 3.5 * a + 1, jitter: 1, passes: 1, alpha: a });
      if (age === 0) chalkStar(ctx, tr.x1, tr.y1, 15, tr.at * 9, 1, 7);
    }
    this.renderDust(ctx);
    const p = this.pose();
    if (p.alpha <= 0.01) return;
    const fr = this.front(p.ang, p.back);
    if (!Fx.low) Rough.bloom(ctx, fr[0], fr[1], 70 * this.s / 2.7, FIST.GLOW, 0.35 * p.alpha);
    const at = drawChalkFist(ctx, fr[0], fr[1], this.s, p.ang, { gun: p.gun, thumb: p.thumb, sx: p.sx, sy: p.sy, alpha: p.alpha, frame: f, seed: this.id });
    // the flash off the fingertip on the frame it fires
    for (const sh of this.shots) {
      const u = this.t - sh.at;
      if (u >= 0 && u < 1 / FIST.FPS) {
        if (!Fx.low) Rough.bloom(ctx, at.tip[0], at.tip[1], 40, FIST.GLOW, 0.9);
        chalkStar(ctx, at.tip[0] + Math.cos(p.ang) * 8, at.tip[1] + Math.sin(p.ang) * 8, 12, sh.at * 13, 1, 5);
      }
    }
  }
}

/* SKYFALL. The fist clenches, goes up off the top of the page, and a moment
   later comes down on the castle knuckles first: QUAKE. */
class FistSky extends FistAct {
  constructor(game, cine) {
    super(game, cine, 2.6);
    this.upAt = 0.34; this.goneAt = 0.66; this.dropAt = 1.16; this.hitAt = 1.42;
    this.dur = 2.55;
    this.landed = false; this.rose = false; this.fell = false; this.clench = 0;
    this.big = 5.4;
    if (cine) { cine.hold = this.hitAt; cine.holdLevel = 0.7; }
    this.puff(this.ax, this.ay, 12, 90, 7);
    Sfx.play('fist_clench', { volume: 0.95 });
  }
  topY() { return -this.game.h / 2 - 40 * this.s; }
  step(dt, game) {
    const q = this.q;
    if (!this.rose && q >= this.upAt + 1 / FIST.FPS) {
      this.rose = true;
      this.puff(this.ax, this.ay, 16, 140, 8, Math.PI / 2);
      game.shake(6);
      Sfx.play('fist_rise', { volume: 0.9 });
    }
    if (this.rose && q < this.goneAt && Math.random() < dt * 40) {
      const y = this.riseY();
      this.dust.push({ x: this.ax + Rough.jit(10), y: y + 30 * this.s, vx: Rough.jit(20), vy: 30, r: 4, grow: 14, life: 0.5, max: 0.5 });
    }
    if (!this.fell && q >= this.dropAt - 0.3) { this.fell = true; Sfx.play('fist_fall', { volume: 0.9 }); }
    if (!this.landed && q >= this.hitAt) {
      this.landed = true;
      const quake = new QuakeRing(game);
      game.effects.push(quake);
      this.quakeDur = quake.dur;
      game.effects.push(new ChalkBurst(0, 0, GROUND_RADIUS * 1.1, true));
      for (let i = 0; i < Fx.n(16); i++) {
        game.effects.push(new Chunk(Rough.jit(30), Rough.jit(20), {
          shape: i % 3 ? 'gob' : 'shard', color: i % 2 ? FIST.CHALK : '#dfe3ea', ink: FIST.LINE,
          size: 5, speed: 260, up: 300, life: 1.3
        }));
      }
      this.puff(0, 0, 26, 260, 12);
      if (this.cine) this.cine.flash = 1;
      game.shake(30);
      if (game.slowmo) game.slowmo(0.1, 0.3);
      Sfx.play('fist_slam', { volume: 1, rateVar: 0 });
      Sfx.play('sk_quake', { volume: 0.9, rateVar: 0 });
    }
    if (!this.broke && q >= 2.1) this.crumble(0, -10);
  }
  riseY() {
    const u = Math.max(0, (this.q - this.upAt) / (this.goneAt - this.upAt));
    return this.ay + (this.topY() - 60 - this.ay) * u * u;
  }
  render(ctx, time) {
    const f = this.f, q = this.q, s = this.s;
    Rough.boil(this.id, f);
    const down = Math.PI / 2, up = -Math.PI / 2;
    // on the castle while it is up there: the spot it will land on
    if (q >= this.goneAt - 0.1 && q < this.hitAt) {
      const k = E.clamp01((q - (this.goneAt - 0.1)) / (this.hitAt - this.goneAt));
      ctx.save();
      ctx.globalAlpha = 0.15 + k * 0.4;
      ctx.fillStyle = '#0b0d12';
      ctx.beginPath(); ctx.ellipse(0, 6, 30 + k * 60, 14 + k * 26, 0, 0, 7); ctx.fill();
      ctx.restore();
      const R = GROUND_RADIUS * (1.5 - k * 0.6);
      for (let i = 0; i < 3; i++) {
        Rough.circle(ctx, 0, 0, R * (1 - i * 0.28), { color: FIST.WHITE, width: 3 - i * 0.6, jitter: 1.6, wobble: 3, passes: 1, alpha: 0.35 + k * 0.5 });
      }
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + q * 1.5;
        Rough.line(ctx, Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, Math.cos(a) * R * 1.15, Math.sin(a) * R * 1.15,
          { color: FIST.WHITE, width: 3, jitter: 0.8, passes: 1, alpha: 0.5 + k * 0.4 });
      }
    }
    // the twinkle, way up, where it went
    if (q >= this.goneAt + 0.08 && q < this.goneAt + 0.4) {
      const k = (q - this.goneAt - 0.08) / 0.32;
      const ty = -this.game.h / 2 + 34;
      Rough.bloom(ctx, this.ax * 0.5, ty, 50, FIST.GLOW, (1 - k) * 0.9);
      chalkStar(ctx, this.ax * 0.5, ty, 16 * Math.sin(k * Math.PI) + 3, q * 4, 1, 4);
    }
    this.renderDust(ctx);
    // the fist itself
    if (q < this.upAt) {
      // clenching at the pointer: squeezes, trembles, winds down to jump
      const CL = [{ sc: 0.55 }, { sx: 0.9, sy: 1.12, sh: 1.5 }, { sx: 0.84, sy: 1.18, sh: 2.5 }, { sx: 1.22, sy: 0.84, d: -8 }];
      const k = CL[Math.min(CL.length - 1, f)];
      Rough.srand(f * 13 + this.id);
      const sh = (k.sh || 0) * 1.2;
      const x = this.ax + Rough.jit(sh), y = this.ay - (k.d || 0) + Rough.jit(sh);
      if (!Fx.low) Rough.bloom(ctx, x, y, 90, FIST.GLOW, 0.4);
      drawChalkFist(ctx, x, y, s, up, { sx: k.sx || k.sc || 1, sy: k.sy || k.sc || 1, frame: f, seed: this.id, flip: 1 });
      if (f >= 1 && f <= 2) {                 // the strain: chalk sparks off the knuckles
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.6;
          Rough.line(ctx, x + Math.cos(a) * 18, y + Math.sin(a) * 18, x + Math.cos(a) * 30, y + Math.sin(a) * 30,
            { color: FIST.WHITE, width: 2.4, jitter: 0.6, passes: 1, alpha: 0.9 });
        }
      }
    } else if (q < this.goneAt) {
      // up and away, stretched, growing as it comes toward you
      const y = this.riseY(), grow = 1 + (q - this.upAt) * 1.2;
      for (let i = -2; i <= 2; i++) {
        const lx = this.ax + i * 11 * s;
        Rough.line(ctx, lx, y + 40 * s, lx, y + (70 + Math.abs(i) * -8) * s, { color: FIST.WHITE, width: 2.6, jitter: 1, passes: 1, alpha: 0.8 });
      }
      drawChalkFist(ctx, this.ax, y, s * grow, up, { sx: 1.55, sy: 0.8, frame: f, seed: this.id, flip: 1 });
    } else if (q >= this.dropAt && q < this.hitAt) {
      // coming down on the castle, knuckles first
      const u = (q - this.dropAt) / (this.hitAt - this.dropAt);
      const y = this.topY() - 80 + (-10 - this.topY() + 80) * u * u;
      const S = this.big * (1.25 - u * 0.25);
      for (let i = -3; i <= 3; i++) {
        const lx = i * 9 * S * 0.9;
        Rough.line(ctx, lx, y - 36 * S, lx, y - (60 + Math.abs(i) * 4) * S, { color: FIST.WHITE, width: 3, jitter: 1.2, passes: 1, alpha: 0.85 });
      }
      if (!Fx.low) Rough.bloom(ctx, 0, y, 60 * S / 2, FIST.GLOW, 0.6);
      drawChalkFist(ctx, 0, y, S, down, { sx: 1.45, sy: 0.84, frame: f, seed: this.id, flip: 1 });
    } else if (q >= this.hitAt) {
      // landed: squashed flat on the castle, cracking, then it falls to bits
      const k = q - this.hitAt, g = Math.floor(k * FIST.FPS);
      const SQ = [{ sx: 0.6, sy: 1.4 }, { sx: 0.78, sy: 1.22 }, { sx: 1.06, sy: 0.96 }, { sx: 0.98, sy: 1.02 }];
      const sq = SQ[Math.min(SQ.length - 1, g)];
      const alpha = q >= 2.1 ? Math.max(0, 1 - (q - 2.1) / 0.25) : 1;
      if (alpha <= 0.01) return;
      const at = drawChalkFist(ctx, 0, -10, this.big, down, { sx: sq.sx, sy: sq.sy, frame: f, seed: this.id, flip: 1, alpha });
      // cracks spreading through the chalk
      const n = Math.min(5, 1 + g);
      Rough.srand(this.id * 3);
      for (let i = 0; i < n; i++) {
        const lx = -24 + Rough.rnd() * 20, ly = -9 + Rough.rnd() * 18;
        const p0 = at.P(lx, ly), p1 = at.P(lx + 5 + Rough.rnd() * 6, ly + Rough.jit(6)), p2 = at.P(lx + 9 + Rough.rnd() * 6, ly + Rough.jit(8));
        Rough.poly(ctx, [p0, p1, p2], { color: FIST.LINE, width: 2, jitter: 0.5, closed: false, passes: 1, alpha: alpha * 0.9 });
      }
    }
  }
}

/* HAYMAKER. Five of them, one after another, punched straight out from the
   castle and clean off the page, 5 damage each. A boss only rocks back. */
class FistHay extends FistAct {
  constructor(game, cine) {
    super(game, cine, 2.8);
    const ok = e => e.kind !== 'ignis' && e.kind !== 'heart' && !e.untouchable;
    const pool = fistShuffle(fistTargets(game, e => ok(e) && !e.boss)).concat(fistShuffle(fistTargets(game, e => ok(e) && e.boss)));
    this.hits = pool.slice(0, FIST.HAY_HITS).map((e, i) => ({ e, at: 0.4 + i * FIST.HAY_EVERY, done: false, x: e.x, y: e.y, dir: 0 }));
    this.flights = []; this.dings = [];
    const n = Math.max(1, this.hits.length);
    this.end = 0.4 + (n - 1) * FIST.HAY_EVERY + 4 / FIST.FPS;
    this.dur = this.end + 0.55;
    if (cine) { cine.hold = this.end; cine.holdLevel = 0.64; }
    this.puff(this.ax, this.ay, 12, 90, 7);
    Sfx.play('fist_clench', { volume: 0.9 });
  }
  /* straight out from the castle through it */
  dirOf(h) {
    const d = Math.hypot(h.x, h.y);
    return d > 1 ? Math.atan2(h.y, h.x) : Math.random() * Math.PI * 2;
  }
  step(dt, game) {
    for (const h of this.hits) {
      if (!h.done && h.e && !h.e.dead) { h.x = h.e.x; h.y = h.e.y; }
      // it lands on the second frame of its turn
      if (h.done || this.t < h.at + 1 / FIST.FPS) continue;
      h.done = true;
      h.dir = this.dirOf(h);
      const e = h.e;
      if (!e || e.dead) continue;
      e.hurt(FIST.HAY_DMG, game, { color: FIST.COLOR });
      game.effects.push(new HitSpark(h.x, h.y, FIST.COLOR, true));
      this.puff(h.x, h.y, 10, 150, 6, h.dir);
      game.shake(9);
      Sfx.play('haymaker', { volume: 0.95, rateVar: 0.05, voices: 4 });
      if (e.dead) continue;
      if (e.boss) {                                 // too heavy to throw: it rocks back a block
        e.knock = { dx: Math.cos(h.dir) * BLOCK, dy: Math.sin(h.dir) * BLOCK, t: 0, dur: 0.3 };
        e.stun = Math.max(e.stun, 0.4);
        continue;
      }
      // how far to the edge of the page that way, and then some
      const cx = Math.cos(h.dir), cy = Math.sin(h.dir), hw = game.w / 2, hh = game.h / 2;
      const tx = cx > 0.001 ? (hw - e.x) / cx : cx < -0.001 ? (-hw - e.x) / cx : Infinity;
      const ty = cy > 0.001 ? (hh - e.y) / cy : cy < -0.001 ? (-hh - e.y) / cy : Infinity;
      const dist = Math.max(BLOCK * 2, Math.min(tx, ty) + e.r + 90);
      this.flights.push({ e, x0: e.x, y0: e.y, cx, cy, dist, t: 0, dur: 0.5 + dist / 2400, out: false, trail: [] });
      e.knock = null;
      Sfx.play('fling', { volume: 0.6, throttle: 60 });
    }
    for (const fl of this.flights) {
      if (fl.t >= fl.dur) continue;
      const e = fl.e;
      if (e.dead) { fl.t = fl.dur; continue; }
      fl.t = Math.min(fl.dur, fl.t + dt);
      const k = E.out(fl.t / fl.dur);
      e.x = fl.x0 + fl.cx * fl.dist * k; e.y = fl.y0 + fl.cy * fl.dist * k;
      e.knock = null;
      e.stun = Math.max(e.stun, 0.25);
      fl.trail.push([e.x, e.y]);
      if (fl.trail.length > 10) fl.trail.shift();
      if (!fl.out && (Math.abs(e.x) > game.w / 2 + 6 || Math.abs(e.y) > game.h / 2 + 6)) {
        fl.out = true;                            // gone off the page: a twinkle where it went
        this.dings.push({ x: Math.max(-game.w / 2 + 18, Math.min(game.w / 2 - 18, e.x)), y: Math.max(-game.h / 2 + 18, Math.min(game.h / 2 - 18, e.y)), at: this.t });
        Sfx.play('fling_ding', { volume: 0.55, throttle: 50 });
      }
    }
    if (!this.broke && this.q >= this.end + 0.12) {
      const p = this.pose();
      this.crumble(p.x, p.y);
    }
  }
  /* where the fist is and what shape it is in, for now */
  pose() {
    const q = this.q, f = this.f, s = this.s;
    const reach = 30 * s;                         // how far off the target it swings from
    if (!this.hits.length || q < this.hits[0].at) {
      // winding up where the cast was
      const W = [{ sc: 0.55 }, { sc: 1.14 }, { sx: 0.86, sy: 1.14, d: -6, turn: -0.5 }, { sx: 0.84, sy: 1.16, d: -8, turn: -0.6, sh: 2 }, { sx: 0.84, sy: 1.16, d: -8, turn: -0.6, sh: 2.5 }];
      const k = W[Math.min(W.length - 1, f)];
      const aim = this.hits.length ? Math.atan2(this.hits[0].y - this.ay, this.hits[0].x - this.ax) : -0.3;
      Rough.srand(f * 17 + this.id);
      return { x: this.ax + Math.cos(aim) * (k.d || 0) + Rough.jit(k.sh || 0), y: this.ay + Math.sin(aim) * (k.d || 0) + Rough.jit(k.sh || 0),
        ang: aim + (k.turn || 0), sx: k.sx || k.sc || 1, sy: k.sy || k.sc || 1, alpha: 1, smear: null };
    }
    let h = this.hits[0];
    for (const x of this.hits) if (q >= x.at) h = x;
    const i = this.hits.indexOf(h), u = Math.floor((q - h.at) * FIST.FPS + 1e-6);
    const dir = h.done ? h.dir : this.dirOf(h), cx = Math.cos(dir), cy = Math.sin(dir);
    const r = (h.e ? h.e.r : 14);
    const prev = i === 0 ? { x: this.ax, y: this.ay } : this.stopAt(this.hits[i - 1]);
    const base = { x: h.x - cx * (r + 8 * s), y: h.y - cy * (r + 8 * s) };
    const alpha = q >= this.end + 0.12 ? Math.max(0, 1 - (q - this.end - 0.12) / 0.25) : 1;
    if (u <= 0) return { x: base.x - cx * reach, y: base.y - cy * reach, ang: dir - 0.7, sx: 1.3, sy: 0.85, alpha, smear: prev };
    if (u === 1) return { x: base.x + cx * 4, y: base.y + cy * 4, ang: dir, sx: 1.4, sy: 0.8, alpha, smear: { x: base.x - cx * reach, y: base.y - cy * reach } };
    if (u === 2) return { x: base.x + cx * 12, y: base.y + cy * 12, ang: dir + 0.15, sx: 0.8, sy: 1.18, alpha, smear: null };
    return { x: base.x + cx * 8, y: base.y + cy * 8, ang: dir + 0.1, sx: 0.98, sy: 1.02, alpha, smear: null };
  }
  stopAt(h) {
    const dir = h.done ? h.dir : this.dirOf(h), r = h.e ? h.e.r : 14;
    return { x: h.x - Math.cos(dir) * (r + 8 * this.s) + Math.cos(dir) * 8, y: h.y - Math.sin(dir) * (r + 8 * this.s) + Math.sin(dir) * 8 };
  }
  render(ctx, time) {
    const f = this.f;
    Rough.boil(this.id, f);
    // the chalk line each thrown thing drags after it
    for (const fl of this.flights) {
      if (fl.trail.length < 2) continue;
      const a = fl.t >= fl.dur ? Math.max(0, 1 - (this.t - fl.t) * 3) : 1;
      Rough.poly(ctx, fl.trail, { color: FIST.WHITE, width: 5, jitter: 1.2, closed: false, passes: 1, alpha: 0.7 * a });
      Rough.poly(ctx, fl.trail, { color: FIST.LINE, width: 1.4, jitter: 1.2, closed: false, passes: 1, alpha: 0.5 * a });
    }
    for (const d of this.dings) {
      const k = (this.t - d.at) / 0.5;
      if (k < 0 || k > 1) continue;
      if (!Fx.low) Rough.bloom(ctx, d.x, d.y, 40, FIST.GLOW, 1 - k);
      chalkStar(ctx, d.x, d.y, 4 + Math.sin(k * Math.PI) * 13, k * 6, 1, 4);
    }
    // the POW on each one it lands
    for (const h of this.hits) {
      if (!h.done) continue;
      const age = Math.floor((this.t - h.at - 1 / FIST.FPS) * FIST.FPS);
      if (age < 0 || age > 2) continue;
      const cx = h.x - Math.cos(h.dir) * 6, cy = h.y - Math.sin(h.dir) * 6;
      if (!Fx.low) Rough.bloom(ctx, cx, cy, 60, FIST.GLOW, 0.9 - age * 0.3);
      chalkStar(ctx, cx, cy, [26, 34, 22][age], h.at * 7, 1 - age * 0.25, 9);
    }
    this.renderDust(ctx);
    const p = this.pose();
    if (p.alpha <= 0.01) return;
    if (p.smear) {                              // a zip across the page: the frame between is a chalk smear
      const n = 4;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 7 * this.s / 2.3;
        const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
        Rough.line(ctx, p.smear.x + nx * o, p.smear.y + ny * o, p.x + nx * o, p.y + ny * o,
          { color: FIST.WHITE, width: 3, jitter: 1.6, passes: 1, alpha: 0.75 * p.alpha });
      }
    }
    if (!Fx.low) Rough.bloom(ctx, p.x, p.y, 60, FIST.GLOW, 0.35 * p.alpha);
    drawChalkFist(ctx, p.x, p.y, this.s, p.ang, { sx: p.sx, sy: p.sy, frame: f, seed: this.id, alpha: p.alpha });
  }
}

/* Whatever is loaded goes off, and the next one is rolled. */
SkillPayloads.fist = function (game, cine) {
  const kind = FIST_SKILLS[game.fistNext] ? game.fistNext : rollFist();
  game.fistNext = rollFist();
  const Act = kind === 'sky' ? FistSky : kind === 'hay' ? FistHay : FistGun;
  const act = new Act(game, cine);
  game.effects.push(act);
  if (kind === 'sky') return Math.max(act.dur, act.hitAt + 1.4);
  return act.dur;
};
