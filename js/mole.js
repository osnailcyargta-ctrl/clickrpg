/* FANDHARN - Moleman, a skin for the Trapper.

   A mole with a little hand drill. Looks only: he goes under, tunnels, comes
   up under the enemy and bites through the very same trapper code - only he
   bursts out of the ground drill-first instead of jaws-first, dives back into
   his hole, tunnels home and climbs out beside the castle, and the ground
   he came through closes back up behind him. */

const MOLE = { fur: '#6b5a52', furDark: '#4a3d37', belly: '#a08a7a', pink: '#e9a0a8', dirt: '#7a5a3a', dirtDark: '#4a3a28' };

/* The mole himself, standing in a hole at (x, y). `up` 0..1 is how far out
   of it he is; `lift` raises him clear of it (a jump); `drillA` is where the
   drill points; `spin` how hard it is going. */
function drawMoleFigure(ctx, x, y, s, up, lift, facing, drillA, spin, t) {
  if (up <= 0.02) return;
  const bodyY = y - (13 * s) * up - lift;
  // the hole he is in: a dark mouth behind him, the rim in front
  ctx.save();
  ctx.fillStyle = '#2a2016';
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.ellipse(x, y, 11 * s, 5 * s, 0, 0, 7); ctx.fill();
  ctx.restore();
  // only what is above the ground shows while he is still half in it
  ctx.save();
  if (lift <= 0.5) { ctx.beginPath(); ctx.rect(x - 60 * s, y - 80 * s, 120 * s, 80 * s + 2 * s); ctx.clip(); }
  const bob = Math.sin(t * 3) * 0.6 * s;
  const cy = bodyY + bob;
  const f = facing;
  // body: a fat velvety lump, wider than it is tall, a tuft on top
  const body = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    body.push([x + Math.cos(a) * 11.5 * s + Rough.jit(0.6 * s), cy + Math.sin(a) * 11 * s * (Math.sin(a) > 0 ? 1.05 : 0.95) + Rough.jit(0.6 * s)]);
  }
  Rough.scribble(ctx, body, { color: MOLE.fur, spacing: 2.4, width: 3.2, overflow: 1.06 });
  Rough.scribble(ctx, body, { color: MOLE.furDark, spacing: 6, width: 2, overflow: 1, alpha: 0.6, angle: 0.9 });
  Rough.poly(ctx, body, { color: '#2b2b2b', width: 1.9, jitter: 0.5 });
  for (const dx of [-2.5, 0, 2.5]) {
    Rough.line(ctx, x + dx * s, cy - 10.5 * s, x + (dx - 1) * s, cy - 13.5 * s, { color: '#2b2b2b', width: 1.3, jitter: 0.3, passes: 1 });
  }
  // the long snout, the big pink nose on the end of it, two buck teeth
  const sx0 = x + f * 7 * s, sy0 = cy - 3 * s, tipX = x + f * 16 * s, tipY = cy - 1.5 * s;
  const snout = [[sx0, sy0 - 3.5 * s], [tipX, tipY - 1.8 * s], [tipX, tipY + 1.8 * s], [sx0, sy0 + 3.5 * s]];
  Rough.scribble(ctx, snout, { color: '#c9a08a', spacing: 2, width: 2.4, overflow: 1.08 });
  Rough.poly(ctx, snout, { color: '#2b2b2b', width: 1.5, jitter: 0.3 });
  Rough.blob(ctx, tipX + f * 1.5 * s, tipY, 3 * s, MOLE.pink, '#2b2b2b', { spacing: 2, fillWidth: 2, sides: 8, width: 1.4, wobble: 0.3 });
  for (const tx of [-0.8, 0.9]) {
    const bx = x + f * (11 + tx) * s, by = tipY + 1.6 * s;
    const tooth = [[bx - 0.8 * s, by], [bx + 0.8 * s, by], [bx + 0.8 * s, by + 2.2 * s], [bx - 0.8 * s, by + 2.2 * s]];
    Rough.scribble(ctx, tooth, { color: '#fffdf4', spacing: 1.5, width: 1.6, overflow: 1.05 });
    Rough.poly(ctx, tooth, { color: '#2b2b2b', width: 0.9, jitter: 0.1 });
  }
  for (const dy of [-1.2, 1.2]) {
    Rough.line(ctx, tipX - f * 2 * s, tipY + dy * s, tipX + f * 4 * s, tipY + dy * 2.4 * s, { color: '#2b2b2b', width: 0.9, jitter: 0.2, passes: 1, alpha: 0.7 });
  }
  // two small bead eyes
  for (const [ex, ey] of [[5.2, -6.5], [1.8, -7.2]]) {
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(x + f * ex * s, cy + ey * s, 1.2 * s, 0, 7); ctx.fill();
  }
  // the back paw: a big pink digging spade with claws
  const bpx = x - f * 11 * s, bpy = cy + 3 * s;
  Rough.blob(ctx, bpx, bpy, 3.6 * s, MOLE.pink, '#2b2b2b', { spacing: 2, fillWidth: 2.2, sides: 7, width: 1.3, wobble: 0.4 });
  for (let i = -1; i <= 1; i++) {
    Rough.line(ctx, bpx - f * 2.5 * s, bpy + i * 1.8 * s, bpx - f * 5 * s, bpy + i * 2.4 * s, { color: '#2b2b2b', width: 1.2, jitter: 0.2, passes: 1 });
  }
  // the drill: an orange hand drill held out front in the other paw
  const hx = x + f * 6 * s + Math.cos(drillA) * 5 * s, hy = cy + 5 * s + Math.sin(drillA) * 5 * s;
  const ca = Math.cos(drillA), sa = Math.sin(drillA);
  const L = 8 * s, W = 3.4 * s;
  const casing = [[hx - ca * L - sa * W, hy - sa * L + ca * W], [hx - sa * W, hy + ca * W], [hx + sa * W, hy - ca * W], [hx - ca * L + sa * W, hy - sa * L - ca * W]];
  const hot = drillOn();
  Rough.scribble(ctx, casing, { color: hot ? '#e0762d' : '#d99a26', spacing: 2, width: 2.6, overflow: 1.08 });
  Rough.poly(ctx, casing, { color: '#2b2b2b', width: 1.5, jitter: 0.3 });
  // its grip, hanging off the back of the casing
  const gx = hx - ca * L * 0.7, gy = hy - sa * L * 0.7;
  Rough.line(ctx, gx, gy, gx - sa * 6 * s * (ca >= 0 ? -1 : 1) * -1, gy + 6 * s, { color: '#2b2b2b', width: 3, jitter: 0.3, passes: 1 });
  drawDrillBit(ctx, hx, hy, drillA, (hot ? 12 : 9) * s, (hot ? 6 : 4.8) * s, t, { speed: spin, glow: hot ? 0.4 : (spin > 8 ? 0.25 : 0) });
  Rough.blob(ctx, gx + 1 * s, gy + 3 * s, 3 * s, MOLE.pink, '#2b2b2b', { spacing: 2, fillWidth: 2, sides: 7, width: 1.2, wobble: 0.3 });
  if (hot) drawHardHat(ctx, x, cy - 9 * s, s * 1.05, facing);
  ctx.restore();
  // the rim of the hole, in front of him
  if (lift <= 0.5) {
    Rough.arc(ctx, x, y, 11 * s, 0.1, Math.PI - 0.1, { color: MOLE.dirtDark, width: 3, jitter: 1, passes: 1 });
    for (let i = 0; i < 4; i++) {
      const a = 0.4 + i * 0.75;
      Rough.blob(ctx, x + Math.cos(a) * 12 * s, y + Math.sin(a) * 4 * s + 2, 2.6 * s, MOLE.dirt, MOLE.dirtDark, { spacing: 2, fillWidth: 2, sides: 6, width: 1, wobble: 0.4 });
    }
  }
}

/* A hole he came out of, closing up again: the dirt slides back in and the
   ground knits shut. */
class MoleHole {
  constructor(x, y, r) { this.id = nextId(); this.x = x; this.y = y; this.r = r; this.life = this.max = 2.2; this.under = true; }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = this.life / this.max;            // 1 fresh .. 0 gone
    const k = E.out(p);
    Rough.boil(this.id, Math.floor(p * 6));
    ctx.save();
    ctx.globalAlpha = 0.7 * Math.min(1, p * 1.5);
    ctx.fillStyle = '#2a2016';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 0.8 * k, this.r * 0.5 * k, 0, 0, 7); ctx.fill();
    ctx.restore();
    // the loose dirt round it, drawing back in as it heals
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + this.id;
      const d = this.r * (0.6 + 0.6 * k);
      Rough.blob(ctx, this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.6, 2.8, MOLE.dirt, MOLE.dirtDark,
        { spacing: 2, fillWidth: 2, sides: 6, width: 1, wobble: 0.4, alpha: Math.min(1, p * 2) });
    }
    Rough.circle(ctx, this.x, this.y, this.r * (0.5 + k * 0.5), { color: MOLE.dirt, width: 2.4, jitter: 2, wobble: 3, alpha: 0.7 * p });
  }
}

(function () {
  const isMole = () => { const l = sentryLook('trapper'); return !!(l && l.sprite === 'mole'); };

  const baseDraw = Sentry.prototype.drawTrapper;
  Sentry.prototype.drawTrapper = function (ctx, t) {
    if (!isMole()) return baseDraw.call(this, ctx, t);
    const s = this.trapState();
    Rough.boil(this.id, t * 1.1);
    if (!Fx.low) {
      if (!this.ringPts) this.ringPts = Rough.circlePts(this.homeX, this.homeY, TRAPPER_RANGE, 5, 30);
      Rough.poly(ctx, this.ringPts, { color: MOLE.dirt, width: 2, jitter: 1.5, alpha: 0.13, passes: 1 });
    }
    // the tunnel: a ridge of pushed-up dirt, settling back behind him
    for (let i = 1; i < s.trail.length; i++) {
      const p = s.trail[i - 1], q = s.trail[i], a = Math.max(0, q.life / 0.9);
      Rough.line(ctx, p.x, p.y, q.x, q.y, { color: MOLE.dirt, width: 6 * a + 1, jitter: 1.4, passes: 1, alpha: a * 0.6 });
      Rough.line(ctx, p.x, p.y, q.x, q.y, { color: MOLE.dirtDark, width: 1.6, jitter: 1.2, passes: 1, alpha: a * 0.7 });
    }
    if (s.mode === 'tunnel' || s.mode === 'home') {
      // the mound racing along, the drill's tip poking up through it
      Rough.blob(ctx, s.px, s.py, 10 + Math.sin(t * 30) * 1.5, MOLE.dirt, MOLE.dirtDark, { spacing: 3.5, fillWidth: 4, sides: 9, width: 2 });
      const a = Math.atan2(s.toY - s.fromY, s.toX - s.fromX);
      drawDrillBit(ctx, s.px + Math.cos(a) * 6, s.py + Math.sin(a) * 6 - 3, a, 7, 4, t, { speed: 16 });
    }
    let up = 0;
    const k = E.clamp01(s.t / (s.dur || 1));
    if (s.mode === 'idle') up = 1;
    else if (s.mode === 'sink') up = 1 - E.inOut(k);
    else if (s.mode === 'rise') up = E.back(k);
    if (up <= 0.02) return;
    const facing = Math.cos(s.face) >= 0 ? 1 : -1;
    const drillA = s.mode === 'sink' ? Math.PI / 2 : (facing > 0 ? -0.25 : Math.PI + 0.25);
    drawMoleFigure(ctx, s.px, s.py, 1.2, up, 0, facing, drillA, s.mode === 'sink' ? 16 : 2, t);
  };

  const baseOver = Sentry.prototype.drawTrapperOver;
  Sentry.prototype.drawTrapperOver = function (ctx, t) {
    if (!isMole()) return baseOver.call(this, ctx, t);
    const s = this.trapState();
    if (s.mode !== 'burst' && s.mode !== 'chew' && s.mode !== 'sinkAt') return;
    const k = E.clamp01(s.t / (s.dur || 1));
    // out of the ground drill-first and up into it, a moment of drilling,
    // then back down the hole
    const up = s.mode === 'sinkAt' ? 1 - E.inOut(k) : 1;
    const lift = s.mode === 'burst' ? Math.sin(k * Math.PI * 0.5) * 22 : s.mode === 'chew' ? 22 - k * 10 : 12 * (1 - k);
    const x = s.px + (s.mode === 'chew' ? Rough.jit(1.5) : 0);
    Rough.circle(ctx, s.px, s.py + 4, 16, { color: MOLE.dirtDark, width: 4, jitter: 3, wobble: 4, alpha: 0.8 });
    drawMoleFigure(ctx, x, s.py + 4, 1.5, up, lift, 1, -Math.PI / 2, s.mode === 'chew' ? 22 : 12, t);
    if (s.mode === 'chew' && !Fx.low) {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + Rough.jit(1.2);
        const tx = x + 3, ty = s.py - lift - 36;
        Rough.line(ctx, tx, ty, tx + Math.cos(a) * 10, ty + Math.sin(a) * 10, { color: '#ffd24a', width: 1.8, jitter: 0.4, passes: 1 });
      }
    }
  };

  // his holes close back up: one where he comes out under the enemy, and
  // one beside the castle when he climbs out at home
  const baseUpdate = Sentry.prototype.trapperUpdate;
  Sentry.prototype.trapperUpdate = function (dt, game) {
    const s = this.trapState(), was = s.mode;
    const out = baseUpdate.call(this, dt, game);
    if (isMole() && was !== s.mode) {
      if (s.mode === 'burst') game.effects.push(new MoleHole(s.px, s.py, 18));
      if (s.mode === 'rise') game.effects.push(new MoleHole(this.homeX, this.homeY, 14));
    }
    return out;
  };

  // under the Moleman the fly trap's leftover hole is not drawn - his heals
  const baseHole = DirtHole.prototype.draw;
  DirtHole.prototype.draw = function (ctx) { if (!isMole()) baseHole.call(this, ctx); };
})();

/* The shop card: he pops up, drills, dives, and comes up somewhere else. */
function molePreview(ctx, w, h, t, dt, c) {
  const cyc = t % 2.4;
  const spots = [[0.3, 0.72], [0.62, 0.66], [0.45, 0.78]];
  const n = Math.floor(t / 2.4) % spots.length;
  const [fx, fy] = spots[n];
  const x = w * fx, y = h * fy;
  Rough.boil(77, Math.floor(t * 3.5));
  Rough.line(ctx, 8, h * 0.84, w - 8, h * 0.84, { color: '#b8b2a3', width: 1.6, jitter: 0.8, passes: 1 });
  // a healing hole where he was last
  const [px, py] = spots[(n + spots.length - 1) % spots.length];
  const heal = Math.max(0, 1 - cyc / 1.4);
  if (heal > 0) {
    ctx.save(); ctx.globalAlpha = heal * 0.7; ctx.fillStyle = '#2a2016';
    ctx.beginPath(); ctx.ellipse(w * px, h * py, 14 * heal, 6 * heal, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  let up, lift = 0, drillA = -0.3, spin = 3;
  if (cyc < 0.35) up = E.back(cyc / 0.35);
  else if (cyc < 1.6) { up = 1; if (cyc > 0.9 && cyc < 1.4) { lift = Math.sin((cyc - 0.9) / 0.5 * Math.PI) * 18; drillA = -Math.PI / 2; spin = 20; } }
  else if (cyc < 2.0) { up = 1 - E.inOut((cyc - 1.6) / 0.4); drillA = Math.PI / 2; spin = 16; }
  else up = 0;
  drawMoleFigure(ctx, x, y, 2.2, up, lift, 1, drillA, spin, t);
}
