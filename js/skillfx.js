/* FANDHARN - light and fire for every weapon's skill.

   Ignis's fight taught the page how to be dark and lit. Every skill now
   plays the same way: when the payload lands, the page is held dark, and the
   skill itself is what lights it - each bolt, ring, blade and blast burns a
   hole of light into the dark in its weapon's colour, glows over it, and
   throws off sparks of that colour while screen-wide motes drift through.
   The Chalk Fist keeps its blackboard.

   Effects say where their light is with a light() method: one
   [x, y, radius, strength, colour] or a list of them, in world space. The
   ones below are added to the skill effects from here, without touching
   their own files. */

const SKILL_LOOK = {
  plain:     { c: '#ff7a2d', hi: '#ffd24a', spark: ['#ffd24a', '#ff7a2d'] },
  storm:     { c: '#8ea6ff', hi: '#dfe6ff', spark: ['#dfe6ff', '#8ea6ff'] },
  compass:   { c: '#a87ae8', hi: '#e6d6ff', spark: ['#e6d6ff', '#a87ae8'] },
  scissor:   { c: '#ff4a3a', hi: '#ffd0c8', spark: ['#ffffff', '#ff4a3a'] },
  buzz:      { c: '#ffd23a', hi: '#fff6c2', spark: ['#fff6c2', '#ffd23a'] },
  wet:       { c: '#3fa8ff', hi: '#cfeaff', spark: ['#cfeaff', '#3fa8ff'] },
  pen:       { c: '#3fd08a', hi: '#c8ffe2', spark: ['#c8ffe2', '#3fd08a'] },
  eraser:    { c: '#ff8ab0', hi: '#ffe0ea', spark: ['#ffe0ea', '#ff8ab0'] },
  magnet:    { c: '#9a6aff', hi: '#e2d4ff', spark: ['#e2d4ff', '#ff5a6a'] },
  boomerang: { c: '#ffb04a', hi: '#ffe6b8', spark: ['#ffe6b8', '#ffb04a'] },
  hammer:    { c: '#ffa040', hi: '#ffe0a0', spark: ['#ffe0a0', '#ff7a2d'] }
};
function skillLookOf(id) {
  const look = SKILL_LOOK[id] || SKILL_LOOK.plain;
  // the skins light their skills in their own colours
  if (id === 'storm' && cursorLook('storm').payload === 'meteor') return { c: '#ffb347', hi: '#fff1b0', spark: ['#fff1b0', '#ffb347'] };
  if (id === 'wet' && cursorLook('wet').payload === 'hail') return { c: '#7fd0ff', hi: '#f2faff', spark: ['#f2faff', '#9fd4ff'] };
  if (id === 'hammer' && cursorLook('hammer').payload === 'thunder') return { c: '#7f96ff', hi: '#e6ecff', spark: ['#e6ecff', '#8ea6ff'] };
  return look;
}

/* A glowing flake in a weapon's colour: rises, drifts, burns out. */
class SkillSpark {
  constructor(x, y, color, speed) {
    this.x = x; this.y = y; this.color = color;
    const a = Math.random() * Math.PI * 2, v = (speed || 80) * (0.3 + Math.random());
    this.vx = Math.cos(a) * v; this.vy = Math.sin(a) * v - 40;
    this.life = this.max = 0.5 + Math.random() * 0.7;
    this.s = 1.5 + Math.random() * 2.5; this.ph = Math.random() * 6;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 1 - dt * 1.5; this.vy = this.vy * (1 - dt * 1.5) - 30 * dt;
    return this.life > 0;
  }
  draw(ctx) {
    const p = this.life / this.max;
    if (!Fx.low) igGlow(ctx, this.x, this.y, this.s * 5, this.color, p * 0.8);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 1.5);
    ctx.fillStyle = p > 0.6 ? '#ffffff' : this.color;
    ctx.translate(this.x, this.y); ctx.rotate(this.ph + this.life * 5);
    ctx.fillRect(-this.s / 2, -this.s / 2, this.s, this.s * 0.6);
    ctx.restore();
  }
}

const SkillFX = {
  motes: [], last: 0, cv: null, hole: null, warmCache: {},

  /* Every light the skill's pieces give off right now (world space). */
  lights(game) {
    const out = [];
    for (const f of game.effects) {
      if (!f.light) continue;
      const l = f.light(game);
      if (!l) continue;
      if (Array.isArray(l[0])) { for (const x of l) if (x) out.push(x); } else out.push(l);
    }
    return out;
  },

  /* Each frame of a cast after it lands: sparks off whatever is lit. */
  emit(game, cine, dt) {
    const look = skillLookOf(cine.cursorId);
    const L = this.lights(game);
    if (!L.length) return;
    const n = Math.min(6, L.length) * (Fx.low ? 0.25 : Settings.gfx === 'high' ? 1 : 0.6);
    for (let i = 0; i < n; i++) {
      if (Math.random() > dt * 40) continue;
      const l = L[Math.floor(Math.random() * L.length)];
      if (l[3] < 0.2) continue;
      const a = Math.random() * Math.PI * 2, d = Math.random() * l[2] * 0.3;
      game.effects.push(new SkillSpark(l[0] + Math.cos(a) * d, l[1] + Math.sin(a) * d, look.spark[i % 2], 60 + l[2] * 0.4));
    }
  },

  /* The dark of a cast, with its light burnt into it (screen space). */
  darkness(ctx, game, cine, dark) {
    const w = game.w, h = game.h, q = Settings.data.low ? 0.25 : Settings.gfx === 'high' ? 0.5 : 0.35;
    const look = skillLookOf(cine.cursorId);
    const A = Depth.off(Depth.ACTORS);
    const ox = w / 2 + game.shakeX + A.x, oy = h / 2 + game.shakeY + A.y;
    const L = [];
    for (const l of this.lights(game)) L.push([ox + l[0], oy + l[1], l[2], Math.min(1, l[3]), l[4] || look.c]);
    L.push([ox, oy, game.castleRadius * 2.2, 0.45, null]);                  // the castle keeps a little light
    if (game.pointer.inside) L.push([game.pointer.x, game.pointer.y, 110, 0.6, null]);
    const cv = this.cv || (this.cv = document.createElement('canvas'));
    const cw = Math.max(1, Math.round(w * q)), ch = Math.max(1, Math.round(h * q));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#141018';
    g.globalAlpha = dark;
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'destination-out';
    const hole = this.hole || (this.hole = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const gg = c.getContext('2d'), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return c;
    })());
    for (const [x, y, r, i] of L) { g.globalAlpha = i; g.drawImage(hole, (x - r) * q, (y - r) * q, r * 2 * q, r * 2 * q); }
    ctx.drawImage(cv, 0, 0, w, h);
    const k = dark / 0.78;
    if (!Settings.data.low) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      for (const [x, y, r, i, c] of L) {
        if (!c) continue;
        ctx.globalAlpha = Math.min(1, i * k * 1.2);
        ctx.drawImage(IgnisHud.warm(c), x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      }
      ctx.restore();
    }
    for (const [x, y, r, i, c] of L) if (c) igGlow(ctx, x, y, r * (Settings.data.low ? 0.4 : 0.2), c, i * k * 0.5);
    this.drift(ctx, game, look, k);
  },

  /* Motes of the weapon's colour drifting up across the whole screen. */
  drift(ctx, game, look, k) {
    const w = game.w, h = game.h;
    const dt = Math.min(0.05, Math.max(0, game.time - this.last)); this.last = game.time;
    const n = Math.round((Fx.low ? 14 : Settings.gfx === 'high' ? 60 : 40) * k);
    while (this.motes.length < n) this.motes.push({ x: Math.random() * w, y: Math.random() * h, vy: 20 + Math.random() * 60, ph: Math.random() * 6, s: 1.5 + Math.random() * 2.5, hi: Math.random() < 0.5 });
    if (this.motes.length > n) this.motes.length = n;
    for (const m of this.motes) {
      m.y -= m.vy * dt; m.x += Math.sin(game.time * 2 + m.ph) * 20 * dt;
      if (m.y < -8) { m.y = h + 8; m.x = Math.random() * w; }
      const c = m.hi ? look.hi : look.c;
      if (!Fx.low) igGlow(ctx, m.x, m.y, m.s * 4, c, 0.6 * k);
      ctx.globalAlpha = 0.9 * k;
      ctx.fillStyle = c;
      ctx.fillRect(m.x, m.y, m.s, m.s);
    }
    ctx.globalAlpha = 1;
  }
};

/* ---- where each skill's light comes from ------------------------------- */
const lit = (Cls, fn) => { if (typeof Cls !== 'undefined' && Cls) Cls.prototype.light = fn; };
const after = (Cls, fn) => {                   // draw something more over an effect
  if (typeof Cls === 'undefined' || !Cls) return;
  const d = Cls.prototype.draw;
  Cls.prototype.draw = function (ctx, t) { d.call(this, ctx, t); fn.call(this, ctx, t); };
};
const ringLights = (x, y, r, n, i, c, size) => {
  const out = [];
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; out.push([x + Math.cos(a) * r, y + Math.sin(a) * r, size, i, c]); }
  return out;
};

lit(Flare, function () { return [this.x, this.y, this.r * 3, Math.max(0, this.life / this.max), this.color]; });
lit(LightningBolt, function () {
  if (!this.struck) return null;
  const k = (this.t - this.delay) / this.dur, a = Math.max(0, 1 - k * k);
  const mid = this.segs ? this.segs[Math.floor(this.segs.length / 2)] : [this.x, this.y - 100];
  return [[this.x, this.y, 240, a, '#8ea6ff'], [mid[0], mid[1], 140, a * 0.7, '#dfe6ff']];
});
lit(PushRing, function () {
  const p = Math.min(1, this.t / this.dur), a = Math.max(0, 1 - p * p);
  return ringLights(0, 0, this.r, 10, a * 0.9, '#a87ae8', 120);
});
lit(Guillotine, function () {
  const out = [];
  if (this.t < this.mark + 0.3) {
    const y = this.half * this.h * 0.24;
    const headX = this.w * 0.6 - E.outQuint(E.clamp01(this.t / this.mark)) * this.w * 1.2;
    out.push([headX, y, 180, 1, '#ff4a3a']);
  }
  if (this.cut) {
    const a = Math.max(0, 1 - (this.t - this.cutAt) / (this.dur - this.cutAt));
    for (let x = -this.w / 2; x <= this.w / 2; x += this.w / 6) out.push([x, 0, 160, a, '#ff4a3a']);
  } else if (this.t > this.close) {
    const gap = (1 - E.out(E.clamp01((this.t - this.close) / (this.cutAt - this.close)))) * this.w * 0.62;
    out.push([-gap, 0, 130, 0.9, '#e8eef4'], [gap, 0, 130, 0.9, '#e8eef4']);
  }
  return out;
});
lit(BuzzBeams, function () {
  const p = this.t / this.dur, a = Math.max(0, 1 - p * p);
  const out = [[this.x, this.y, 260, a, '#ffd23a']];
  for (const arc of this.arcs.slice(0, 16)) out.push([arc[1][0], arc[1][1], 110, a, '#fff6c2']);
  for (let i = 0; i < 8; i++) {
    const ang = this.spin + i / 8 * Math.PI * 2, reach = this.len * Math.min(1, p * 4) * 0.45;
    out.push([this.x + Math.cos(ang) * reach, this.y + Math.sin(ang) * reach, 120, a * 0.7, '#ffd23a']);
  }
  return out;
});
lit(Cloudburst, function (game) {
  const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
  const out = [];
  for (let i = 0; i < this.drops.length; i += 9) out.push([this.drops[i].x, this.drops[i].y, 60, 0.45 * fade, this.frost ? '#9fd4ff' : '#3fa8ff']);
  if (this.hit) for (const e of game.enemies) if (!e.dead) out.push([e.x, e.y, 60, 0.5 * fade, '#cfeaff']);
  return out;
});
lit(Crosshatch, function (game) {
  const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
  const p = E.clamp01(this.t / 0.55), out = [];
  for (let i = 0; i < 9; i++) { const u = i / 8; out.push([(u - 0.5) * this.w, (Math.sin(i * 2.3) * 0.4) * this.h, 150 * p, 0.45 * fade, '#3fd08a']); }
  if (this.hit) for (const e of game.enemies) if (!e.dead) out.push([e.x, e.y, 70, 0.8 * fade, '#c8ffe2']);
  return out;
});
lit(ExclamationSlam, function () {
  if (!this.hit) return [this.x, this.y - (1 - E.out(E.clamp01(this.t / 0.3))) * 260, 90, 0.8, '#ffd24a'];
  const a = E.clamp01((this.dur - this.t) / 0.9);
  return [this.x, this.y, this.radius * 3.2, a, '#ff7a2d'];
});
lit(MagnetPull, function () { return [this.x, this.y, 260, 0.9, '#9a6aff']; });
lit(MagnetBurst, function () { return [this.x, this.y, 340, Math.max(0, 1 - this.t / this.dur), '#ff5a6a']; });
lit(Boomerang, function () { return [this.x, this.y, 110, 0.85, '#ffb04a']; });
lit(SecondDraft, function (game) {
  const out = [], p = this.t / this.dur, band = -game.h / 2 + p * game.h * 1.3;
  for (let x = -game.w / 2; x <= game.w / 2; x += game.w / 5) out.push([x, band, 150, 0.5, '#ff8ab0']);
  return out;
});
lit(QuakeRing, function () {
  const front = this.t * this.speed, fade = Math.max(0, 1 - Math.max(0, this.t - (this.dur - 0.45)) / 0.45);
  const out = ringLights(0, 0, front, 12, 0.75 * fade, '#ffa040', 130);
  if (this.t < 0.6) out.push([0, 0, 260, 1 - this.t / 0.6, '#ffe0a0']);
  return out;
});
lit(HammerSlam, function () { return [this.x, this.y, this.r * 3, Math.max(0, 1 - this.t / this.dur), this.hot]; });
lit(IceBurst, function () { return [this.x, this.y, 90, 0.6, '#9fd4ff']; });
lit(StarBurst, function () { return [this.x, this.y, this.radius * 3, Math.max(0, 1 - this.t / this.dur), '#ffd24a']; });
lit(MeteorCrater, function () { return [this.x, this.y, 260, 0.7, '#ff9a2d']; });

/* ---- a little more on the ones that only drew lines ------------------- */
// CLOUDBURST: every drop catches the light, and the flood lands in a ring
after(Cloudburst, function (ctx, time) {
  if (this.frost) return;
  const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
  for (let i = 0; i < this.drops.length; i += 4) igGlow(ctx, this.drops[i].x, this.drops[i].y, 10, '#3fa8ff', 0.6 * fade);
  if (this.t > 0.45) {
    const k = E.clamp01((this.t - 0.45) / 0.9), r = 20 + E.out(k) * 700;
    Rough.boil(this.id, Math.floor(time * 12));
    ctx.save(); ctx.scale(1, 0.55);
    Rough.circle(ctx, 0, 0, r, { color: '#3fa8ff', width: 6 * (1 - k) + 1, jitter: 2, wobble: 8, passes: 1, alpha: (1 - k) * 0.9 });
    Rough.circle(ctx, 0, 0, r * 0.9, { color: '#cfeaff', width: 2, jitter: 2, wobble: 8, passes: 1, alpha: (1 - k) * 0.7 });
    ctx.restore();
  }
});
// CROSSHATCH: the lines glow where they cross, and every one bitten is struck through
after(Crosshatch, function (ctx, time) {
  const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
  if (!this.hit || !Game.enemies) return;
  Rough.boil(this.id + 1, Math.floor(time * 12));
  for (const e of Game.enemies) {
    if (e.dead) continue;
    const r = e.r + 8;
    igGlow(ctx, e.x, e.y, r * 2, '#3fd08a', 0.7 * fade);
    Rough.line(ctx, e.x - r, e.y - r, e.x + r, e.y + r, { color: '#c8ffe2', width: 3, jitter: 1.4, passes: 1, alpha: fade });
    Rough.line(ctx, e.x + r, e.y - r, e.x - r, e.y + r, { color: '#c8ffe2', width: 3, jitter: 1.4, passes: 1, alpha: fade });
  }
});
// EXCLAMATION: the mark lands with a burning rim, a shock ring and cracks
after(ExclamationSlam, function (ctx, time) {
  if (!this.hit) return;
  const k = E.clamp01((this.t - 0.3) / 0.8), a = 1 - k;
  Rough.boil(this.id + 2, Math.floor(time * 12));
  igGlow(ctx, this.x, this.y, this.radius * (1 + k), '#ff7a2d', a * 0.9);
  Rough.circle(ctx, this.x, this.y, this.radius * (0.4 + E.out(k) * 1.4), { color: '#ffd24a', width: 7 * a + 1, jitter: 2, wobble: 5, passes: 1, alpha: a });
  Rough.circle(ctx, this.x, this.y, this.radius * (0.3 + E.out(k) * 1.1), { color: '#ff7a2d', width: 3, jitter: 2, wobble: 5, passes: 1, alpha: a });
  Rough.srand(this.id);
  for (let i = 0; i < 9; i++) {
    const ang = i / 9 * Math.PI * 2 + Rough.jit(0.2), L = this.radius * (0.8 + Rough.rnd() * 0.8);
    Rough.poly(ctx, [[this.x, this.y], [this.x + Math.cos(ang) * L * 0.5 + Rough.jit(8), this.y + Math.sin(ang) * L * 0.5 + Rough.jit(8)], [this.x + Math.cos(ang) * L, this.y + Math.sin(ang) * L]],
      { color: '#ff7a2d', width: 2.4, jitter: 0.6, closed: false, passes: 1, alpha: a * 0.9 });
  }
});
// PERIMETER: the ring burns as it goes
after(PushRing, function (ctx) {
  const p = Math.min(1, this.t / this.dur), a = Math.max(0, 1 - p * p);
  for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2; igGlow(ctx, Math.cos(ang) * this.r, Math.sin(ang) * this.r, 34, '#a87ae8', a * 0.8); }
});
if (typeof Hailstorm !== 'undefined') Hailstorm.prototype.frost = true;
// FLIGHT PATH: a streak of light behind each one
after(Boomerang, function (ctx) {
  this.glowTrail = this.glowTrail || [];
  this.glowTrail.push([this.x, this.y]); if (this.glowTrail.length > 8) this.glowTrail.shift();
  for (let i = 0; i < this.glowTrail.length; i++) igGlow(ctx, this.glowTrail[i][0], this.glowTrail[i][1], 6 + i * 3, '#ffb04a', i / this.glowTrail.length * 0.7);
});
// GUILLOTINE: the cut burns along its length
after(Guillotine, function (ctx) {
  if (!this.cut) return;
  const a = Math.max(0, 1 - (this.t - this.cutAt) / (this.dur - this.cutAt));
  for (let x = -this.w / 2; x <= this.w / 2; x += 40) igGlow(ctx, x, 0, 40, '#ff4a3a', a * 0.8);
});
// EIGHT WAYS: every line a bar of light
after(BuzzBeams, function (ctx) {
  const p = this.t / this.dur, a = Math.max(0, 1 - p * p);
  for (let i = 0; i < 8; i++) {
    const ang = this.spin + i / 8 * Math.PI * 2, reach = this.len * Math.min(1, p * 4);
    for (let s = 40; s < reach; s += 60) igGlow(ctx, this.x + Math.cos(ang) * s, this.y + Math.sin(ang) * s, 26, '#ffd23a', a * 0.7);
  }
});
