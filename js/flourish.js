/* FANDHARN - the finishing layer on the abilities: a flare where each one
   goes off, a wash over the page and ink speed-lines when a skill lands, a
   hot seam where the Guillotine cuts.

   Decoration only, like js/fx.js: nothing in here deals damage or changes a
   rule, and all of it thins out (or steps aside) when Fx.low is on. It is
   hung onto the abilities from the outside - each CursorPowers and
   SkillPayloads entry is wrapped once, at load - so the approved looks
   underneath are left exactly as they were. */

/* The colour an ability flares in: the cursor's own, or its skin's. */
function flourishColor(id) {
  const look = typeof cursorLook === 'function' ? cursorLook(id) : null;
  if (look && look.color) return look.color;
  const c = CURSORS.find(x => x.id === id);
  return (c && c.color) || '#e0562d';
}

/* Where something goes off: a white-hot core in a coloured bloom, crayon
   shock rings thrown out, streaks, and a few sparkle-crosses tumbling away. */
class Flare {
  constructor(x, y, o) {
    o = o || {};
    this.id = nextId();
    this.x = x; this.y = y;
    this.color = o.color || '#ffb347';
    this.core = o.core || '#fff6d8';
    this.r = o.r || 40;
    this.life = this.max = o.dur || 0.45;
    this.rings = o.rings == null ? 2 : o.rings;
    this.rays = [];
    const n = Fx.n(o.rays == null ? 10 : o.rays);
    for (let i = 0; i < n; i++) {
      this.rays.push({ a: (i / n) * Math.PI * 2 + Math.random() * 0.5,
        len: this.r * (0.45 + Math.random() * 0.7), w: 1.4 + Math.random() * 1.8 });
    }
    this.motes = [];
    const m = Fx.low ? 0 : (o.motes == null ? 8 : o.motes);
    for (let i = 0; i < m; i++) {
      this.motes.push({ a: Math.random() * Math.PI * 2, v: this.r * (0.8 + Math.random() * 1.4),
        s: 2.5 + Math.random() * 3, spin: Math.random() * 3 });
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = 1 - this.life / this.max, o = E.out(p);
    const { x, y, r } = this;
    Rough.boil(this.id, Math.floor(p * 7));      // choppy, like the rest of the page
    if (!Fx.low) Rough.bloom(ctx, x, y, r * (1.3 + o * 0.9), this.color, (1 - p) * 0.75);
    Rough.bloom(ctx, x, y, r * 0.7 * (1 - p * 0.4), this.core, E.hold(p, 0.12) * 0.95);
    for (let i = 0; i < this.rings; i++) {
      const q = E.clamp01((p - i * 0.14) / 0.8);
      if (q <= 0 || q >= 1) continue;
      Rough.circle(ctx, x, y, r * (0.35 + E.out(q) * 1.35) * (1 + i * 0.3), {
        color: i ? this.color : '#2b2b2b', width: 0.8 + (1 - q) * 3.6, jitter: 1, passes: 1,
        alpha: (1 - q) * 0.8, wobble: r * 0.05 });
    }
    for (const ray of this.rays) {
      const r0 = r * 0.25 + o * ray.len, r1 = r0 + ray.len * (1 - p) * 0.7;
      Rough.line(ctx, x + Math.cos(ray.a) * r0, y + Math.sin(ray.a) * r0,
        x + Math.cos(ray.a) * r1, y + Math.sin(ray.a) * r1,
        { color: this.color, width: ray.w, jitter: 0.8, passes: 1, alpha: (1 - p) * 0.95 });
    }
    for (const m of this.motes) {
      const d = m.v * o, s = m.s * (1 - p);
      if (s < 0.4) continue;
      const mx = x + Math.cos(m.a) * d, my = y + Math.sin(m.a) * d + p * p * r * 0.4;
      const sa = m.spin + p * 4;
      const cx = Math.cos(sa) * s, cy = Math.sin(sa) * s;
      Rough.line(ctx, mx - cx, my - cy, mx + cx, my + cy, { color: this.color, width: 1.8, jitter: 0.3, passes: 1, alpha: 1 - p });
      Rough.line(ctx, mx + cy, my - cx, mx - cy, my + cx, { color: this.color, width: 1.8, jitter: 0.3, passes: 1, alpha: 1 - p });
    }
  }
}

/* A skill landing: the page takes on the skill's colour for a moment and
   ink speed-lines rush in from the edges at where it went off. */
class PageTint {
  constructor(game, color, cx, cy, dur) {
    this.id = nextId();
    this.game = game; this.color = color;
    this.cx = cx; this.cy = cy;
    this.t = 0; this.dur = dur || 0.9;
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const p = this.t / this.dur;
    const a = p < 0.12 ? p / 0.12 : 1 - E.out((p - 0.12) / 0.88);
    const w = this.game.w, h = this.game.h;
    ctx.save();
    ctx.globalAlpha = a * 0.22;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = this.color;
    ctx.fillRect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
    ctx.restore();
    if (Fx.low || p > 0.6) return;
    // speed lines, redrawn at the page's stepped rate
    Rough.boil(this.id, Math.floor(time * 7));
    const out = Math.hypot(w, h) * 0.6, n = 22;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Rough.jit(0.12);
      const inner = Math.min(w, h) * (0.3 + Math.abs(Rough.jit(0.12))) + p * 60;
      Rough.line(ctx,
        this.cx + Math.cos(ang) * out, this.cy + Math.sin(ang) * out,
        this.cx + Math.cos(ang) * inner, this.cy + Math.sin(ang) * inner,
        { color: '#2b2b2b', width: 1.5 + Math.abs(Rough.jit(1.4)), jitter: 1, passes: 1,
          alpha: (1 - p / 0.6) * 0.5 });
    }
  }
}

/* The Guillotine's cut: a white-hot seam straight across the page that
   flares and burns down to a thin line. */
class SeamFlash {
  constructor(game, y) { this.game = game; this.y = y; this.t = 0; this.dur = 0.5; this.id = nextId(); }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const p = this.t / this.dur, w = this.game.w;
    const a = 1 - E.out(p);
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = '#fff6d8';
    const th = 14 * (1 - p) + 2;
    ctx.fillRect(-w / 2 - 20, this.y - th / 2, w + 40, th);
    ctx.restore();
    if (!Fx.low) {
      for (let x = -w / 2; x < w / 2; x += 90) Rough.bloom(ctx, x + 45, this.y, 38 * (1 - p * 0.5), '#e0562d', a * 0.5);
    }
    Rough.boil(this.id, Math.floor(p * 7));
    Rough.line(ctx, -w / 2 - 20, this.y, w / 2 + 20, this.y, { color: '#c8433a', width: 3 * (1 - p) + 1, jitter: 1.2, passes: 1, alpha: a });
  }
}

/* ---- hanging it on --------------------------------------------------- */
(function () {
  // every cursor's charged trick flares where it was let loose
  for (const id of Object.keys(CursorPowers)) {
    const power = CursorPowers[id];
    if (typeof power !== 'function') continue;
    CursorPowers[id] = function (game, x, y) {
      const out = power.apply(this, arguments);
      game.effects.push(new Flare(x, y, { color: flourishColor(id), r: 24, dur: 0.32, rays: 7, motes: 4, rings: 1 }));
      return out;
    };
  }

  // skills: the page washes over in the skill's colour, speed-lines in, and
  // a big flare where it lands - on the cursor for the aimed ones, on the
  // castle for the ones that come out of it
  const FROM_CASTLE = { compass: 1, boomerang: 1, hammer: 1, eraser: 1, wet: 1, pen: 1, scissor: 1 };
  for (const id of Object.keys(SkillPayloads)) {
    const fire = SkillPayloads[id];
    if (typeof fire !== 'function') continue;
    SkillPayloads[id] = function (game, cine) {
      const out = fire.apply(this, arguments);
      const color = flourishColor(id);
      const meteor = id === 'storm' && cursorLook('storm').payload === 'meteor';
      const castle = FROM_CASTLE[id] || meteor;
      const x = castle ? 0 : cine.wx, y = castle ? 0 : cine.wy;
      game.effects.push(new PageTint(game, color, x, y, 1));
      // the meteor brings its own blinding landing; a second flare would muddy it
      if (!meteor) game.effects.push(new Flare(x, y, { color, r: 70, dur: 0.6, rays: 14, motes: 12, rings: 3 }));
      return out;
    };
  }
})();
