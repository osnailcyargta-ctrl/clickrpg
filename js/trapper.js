/* FANDHARN - THE TRAPPER.

   A fly trap in the sentry post. It does nothing at all until something
   walks inside its reach, and then it goes under: sinks into the page,
   tunnels across beneath it, bursts up under the thing and bites - damage,
   a stun, and the thing spat two blocks back the way it came - then goes
   back under and comes home.

   The one sentry you can keep buying while it holds the post: every one
   you buy bites 1 harder, up to 10. Its methods hang off Sentry. */

const TRAP_SINK = 0.28, TRAP_BURST = 0.16, TRAP_CHEW = 0.32, TRAP_RISE = 0.3;
const TRAP_COOL = 1.6;
const TRAP_AIRBORNE = { boltshot: 1, lavaball: 1 };    // nothing in the ground reaches these

Object.assign(Sentry.prototype, {

  trapState() {
    if (!this.trap) {
      this.trap = {
        mode: 'idle', t: 0, cool: 0.6,
        px: this.homeX, py: this.homeY,           // where the plant is right now
        target: null, fromX: 0, fromY: 0, toX: 0, toY: 0, dur: 0.3,
        trail: [], open: 0.35, face: -Math.PI / 2, sway: Math.random() * 6
      };
    }
    return this.trap;
  },

  trapReach(e) {
    if (e.dead || e.untouchable || TRAP_AIRBORNE[e.kind]) return false;
    if (e.kind === 'larva' && e.fall) return false;            // still in the air
    return Math.hypot(e.x - this.homeX, e.y - this.homeY) <= TRAPPER_RANGE + e.r * 0.5;
  },

  trapperUpdate(dt, game) {
    const s = this.trapState();
    s.t += dt;

    // the tunnel leaves a crack behind it that closes up again
    for (const c of s.trail) c.life -= dt;
    while (s.trail.length && s.trail[0].life <= 0) s.trail.shift();

    if (s.mode === 'idle') {
      s.open += ((0.35 + Math.sin(game.time * 1.8 + s.sway) * 0.12) - s.open) * Math.min(1, dt * 5);
      s.cool -= dt;
      // face whatever is closest, even out of reach - it is watching
      let best = null, bd = Infinity;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - this.homeX, e.y - this.homeY);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const want = Math.atan2(best.y - this.homeY, best.x - this.homeX);
        let diff = ((want - s.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        s.face += diff * Math.min(1, dt * 4);
      }
      if (s.cool <= 0) {
        let prey = null, pd = Infinity;
        for (const e of game.enemies) {
          if (!this.trapReach(e)) continue;
          const d = Math.hypot(e.x - this.homeX, e.y - this.homeY);
          if (d < pd) { pd = d; prey = e; }
        }
        if (prey) {
          s.target = prey;
          this.trapGo(s, 'sink', TRAP_SINK);
          this.trapDirt(game, s.px, s.py, 8);
          Sfx.play('trap_dig', { volume: 0.7, throttle: 80 });
        }
      }
      return true;
    }

    if (s.mode === 'sink' && s.t >= s.dur) {
      // under: off across the page toward wherever the prey is now
      const tg = s.target;
      if (!tg || tg.dead) return this.trapHome(game, s);
      s.fromX = s.px; s.fromY = s.py;
      s.dur = Math.max(0.16, Math.min(0.42, Math.hypot(tg.x - s.px, tg.y - s.py) / 620));
      this.trapGo(s, 'tunnel', s.dur);
      return true;
    }

    if (s.mode === 'tunnel' || s.mode === 'home') {
      const tg = s.target;
      if (s.mode === 'tunnel') {
        if (!tg || tg.dead) return this.trapHome(game, s);
        s.toX = tg.x; s.toY = tg.y;               // it follows the prey under the paper
      }
      const k = E.clamp01(s.t / s.dur);
      const e2 = E.inOut(k);
      s.px = s.fromX + (s.toX - s.fromX) * e2;
      s.py = s.fromY + (s.toY - s.fromY) * e2;
      s.trail.push({ x: s.px + Rough.jit(3), y: s.py + Rough.jit(3), life: 0.9 });
      if (!Fx.low && Math.random() < 0.8) game.effects.push(new Crumb(s.px, s.py, '#7a5a3a'));
      if (k >= 1) {
        if (s.mode === 'tunnel') {
          this.trapGo(s, 'burst', TRAP_BURST);
          s.open = 1;
          game.effects.push(new DirtHole(s.px, s.py, 20));
          this.trapDirt(game, s.px, s.py, 14);
          Sfx.play('trap_emerge', { volume: 0.8, throttle: 60 });
        } else {
          this.trapGo(s, 'rise', TRAP_RISE);
          this.trapDirt(game, s.px, s.py, 8);
        }
      }
      return true;
    }

    if (s.mode === 'burst') {
      const tg = s.target;
      if (tg && !tg.dead) { s.px += (tg.x - s.px) * Math.min(1, dt * 20); s.py += (tg.y - s.py) * Math.min(1, dt * 20); }
      if (s.t >= s.dur) this.trapBite(game, s);
      return true;
    }

    if (s.mode === 'chew') {
      s.open = 0;
      if (s.t >= s.dur) {
        this.trapGo(s, 'sinkAt', TRAP_SINK);
        this.trapDirt(game, s.px, s.py, 6);
      }
      return true;
    }

    if (s.mode === 'sinkAt' && s.t >= s.dur) return this.trapHome(game, s);

    if (s.mode === 'rise') {
      s.open = 0.35 * E.clamp01(s.t / s.dur);
      if (s.t >= s.dur) { this.trapGo(s, 'idle', 0); s.cool = TRAP_COOL; s.px = this.homeX; s.py = this.homeY; }
    }
    return true;
  },

  trapGo(s, mode, dur) { s.mode = mode; s.t = 0; s.dur = dur; },

  trapHome(game, s) {
    s.target = null;
    s.fromX = s.px; s.fromY = s.py;
    s.toX = this.homeX; s.toY = this.homeY;
    this.trapGo(s, 'home', Math.max(0.16, Math.min(0.42, Math.hypot(s.px - this.homeX, s.py - this.homeY) / 620)));
    return true;
  },

  trapDirt(game, x, y, n) {
    for (let i = 0; i < Fx.n(n); i++) {
      const c = new Crumb(x, y, i % 3 ? '#7a5a3a' : '#4a3a28');
      c.size += 1.5;
      game.effects.push(c);
    }
  },

  /* The bite itself: it lands, stuns, and throws the thing back out. */
  trapBite(game, s) {
    const tg = s.target;
    this.trapGo(s, 'chew', TRAP_CHEW);
    s.open = 0;
    game.effects.push(new TrapSnap(s.px, s.py, game));
    game.shake(6);
    Sfx.play('trap_snap', { volume: 0.95, rateVar: 0.06 });
    if (!tg || tg.dead) return;
    game.sentryHurt(tg, game.trapperDamage(), { color: '#5e9e3a' });
    if (tg.dead) return;
    tg.stun = Math.max(tg.stun, 1.1 + game.statusBonus());
    // spat back the way it came: straight out from the castle
    const d = Math.hypot(tg.x, tg.y) || 1;
    tg.knock = { dx: (tg.x / d) * BLOCK * 2, dy: (tg.y / d) * BLOCK * 2, t: 0, dur: 0.3 };
  },

  /* ------------------------------------------------------------ drawing */
  drawTrapper(ctx, t) {
    const s = this.trapState();
    Rough.boil(this.id, t * 1.1);

    // its reach, as a faint ring of grass the prey has to walk into
    // (a fixed, sparse ring: at this radius the default one is eighty-odd
    // strokes drawn twice, every frame, for something barely visible)
    if (!Fx.low) {
      if (!this.ringPts) this.ringPts = Rough.circlePts(this.homeX, this.homeY, TRAPPER_RANGE, 5, 30);
      Rough.poly(ctx, this.ringPts, { color: '#5e9e3a', width: 2, jitter: 1.5, alpha: 0.13, passes: 1 });
    }

    // the crack the tunnel leaves, closing up behind it
    if (s.trail.length > 1) {
      for (let i = 1; i < s.trail.length; i++) {
        const p = s.trail[i - 1], q = s.trail[i];
        Rough.line(ctx, p.x, p.y, q.x, q.y,
          { color: '#4a3a28', width: 3, jitter: 1.4, passes: 1, alpha: Math.max(0, q.life / 0.9) * 0.7 });
      }
    }

    // the mound racing along under the paper
    if (s.mode === 'tunnel' || s.mode === 'home') {
      Rough.bloom(ctx, s.px, s.py, 20, '#5e9e3a', 0.35);
      Rough.blob(ctx, s.px, s.py, 9 + Math.sin(t * 30) * 1.5, '#7a5a3a', '#4a3a28',
        { spacing: 3.5, fillWidth: 4, sides: 9, width: 2 });
    }

    // how far out of the ground it is, and how big: at the post it is a
    // houseplant, under an enemy it comes up big enough to swallow it
    let up = 0;
    const size = 18;
    const k = E.clamp01(s.t / (s.dur || 1));
    if (s.mode === 'idle') up = 1;
    else if (s.mode === 'sink') up = 1 - E.inOut(k);
    else if (s.mode === 'rise') up = E.back(k);
    if (up <= 0.02) return;

    const atPost = s.mode === 'idle' || s.mode === 'sink' || s.mode === 'rise';
    if (!atPost) return;                 // out under an enemy it draws on top, below
    this.drawFlytrap(ctx, s.px, s.py, size, up, s.open, s.face, t, true, false);
  },

  /* Drawn after the enemies: when it comes up under one, the jaws have to
     close over the thing, not hide behind it. */
  drawTrapperOver(ctx, t) {
    const s = this.trapState();
    if (s.mode !== 'burst' && s.mode !== 'chew' && s.mode !== 'sinkAt') return;
    const k = E.clamp01(s.t / (s.dur || 1));
    const up = s.mode === 'burst' ? E.back(k) : (s.mode === 'chew' ? 1 : 1 - E.inOut(k));
    if (up <= 0.02) return;
    // it comes up jaws-first, pointing straight up out of the page
    this.drawFlytrap(ctx, s.px, s.py, 28, up, s.open, -Math.PI / 2, t, false, s.mode === 'chew');
  },

  /* The plant. Two hinged lobes, green outside and raw red inside, fringed
     with long teeth that interlock when it shuts, on a short curled stem. */
  drawFlytrap(ctx, x, y, size, up, open, face, t, atPost, chewing) {
    // how far above the page the trap sits: tall on its stem at home, low
    // and wrapped around the thing when it comes up under one
    const h = size * (atPost ? 0.9 : 0.3) * up;
    const sway = Math.sin(t * 1.6 + this.wob) * 0.12;
    const cx = x + Math.cos(face) * size * 0.25 * up, cy = y - h;

    // leaves around the base, only at home
    if (atPost) {
      for (let i = 0; i < 4; i++) {
        const la = (i / 4) * Math.PI * 2 + 0.4 + sway * 0.5;
        const len = size * (0.95 + (i % 2) * 0.3) * Math.min(1, up * 1.4);
        const lx = x + Math.cos(la) * len, ly = y + Math.sin(la) * len * 0.55;
        const nx = -Math.sin(la) * size * 0.2, ny = Math.cos(la) * size * 0.12;
        const leaf = [[x, y], [x + (lx - x) * 0.5 + nx, y + (ly - y) * 0.5 + ny], [lx, ly],
          [x + (lx - x) * 0.5 - nx, y + (ly - y) * 0.5 - ny]];
        Rough.scribble(ctx, leaf, { color: '#6fae47', spacing: 3.5, width: 3, overflow: 1.1 });
        Rough.poly(ctx, leaf, { color: '#2f5a1e', width: 1.6, jitter: 0.8 });
      }
    } else {
      // a ring of torn-up ground where it came through
      Rough.circle(ctx, x, y, size * 1.05, { color: '#4a3a28', width: 4, jitter: 3, wobble: 4, alpha: 0.8 });
    }

    // the stem, curling up to the trap
    Rough.poly(ctx, [[x, y], [x + size * 0.18 + sway * size, y - h * 0.5], [cx, cy + size * 0.2]],
      { color: '#3d7a28', width: 3.4, jitter: 1, closed: false });

    // a red glow deep in the mouth - it breathes when it is waiting
    const glow = atPost ? 0.3 + open * 0.5 : 0.55;
    Rough.bloom(ctx, cx, cy, size * (1.3 + open * 0.8), '#e0455a', glow * up);

    ctx.save();
    ctx.translate(cx + (chewing ? Rough.jit(2) : 0), cy + (chewing ? Rough.jit(2) : 0));
    ctx.rotate(face);                              // +x is where the mouth points
    const spread = 0.08 + open * 0.95;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * spread * 0.5);
      // a lobe: a half-disc on the hinge line, rim facing the other lobe
      const lobe = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, ang = Math.PI * u;
        lobe.push([Math.cos(ang) * size * 0.55 + size * 0.5, side * Math.sin(ang) * size * 0.55]);
      }
      // inside of the lobe first: raw pink, with trigger hairs
      ctx.fillStyle = '#e0455a';
      ctx.beginPath(); lobe.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.fill();
      Rough.scribble(ctx, lobe, { color: '#6fae47', spacing: 4, width: 3.2, overflow: 1.02, alpha: 0.85 - open * 0.45 });
      Rough.poly(ctx, lobe, { color: '#2f5a1e', width: 2, jitter: 0.8 });
      ctx.restore();
    }
    // the teeth go on last, over both lobes, so that shut they interlock
    // across the seam - that fringe is what makes it read as a fly trap
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * spread * 0.5);
      for (let i = 1; i < 10; i++) {
        const u = i / 10;
        const bx = size * 0.5 + (u - 0.5) * size * 1.1 + (side > 0 ? size * 0.05 : 0);
        const tl = size * (0.34 + (i % 2) * 0.12) * (0.75 + open * 0.25);
        Rough.line(ctx, bx, side * size * 0.04, bx + tl * 0.3, -side * tl,
          { color: '#f0e8c0', width: 1.6, jitter: 0.5, passes: 1 });
      }
      ctx.restore();
    }
    // drool, hanging off the lower lip while it waits
    if (atPost && open > 0.3) {
      const dl = size * (0.3 + ((t * 0.7 + this.wob) % 1) * 0.6);
      Rough.line(ctx, size * 0.8, size * 0.15, size * 0.8, size * 0.15 + dl,
        { color: '#cfe4c0', width: 1.6, jitter: 0.4, passes: 1, alpha: 0.7 });
    }
    ctx.restore();
  }
});

/* The bite: a flash of green and white where the jaws met, a shock ring,
   and bits of leaf and tooth thrown out of it. */
class TrapSnap {
  constructor(x, y, game) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.life = 0.5; this.max = this.life;
    for (let i = 0; i < Fx.n(12); i++) {
      game.effects.push(new Crumb(x, y, i % 3 === 0 ? '#e8e0b0' : (i % 3 === 1 ? '#6fae47' : '#e0455a')));
    }
    for (let i = 0; i < Fx.n(5); i++) game.effects.push(new Droplet(x, y, '#6fae47', 1));
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = 1 - this.life / this.max;
    const o = E.outQuint(p);
    Rough.boil(this.id, 0);
    Rough.bloom(ctx, this.x, this.y, 30 + o * 40, '#8fe06a', (1 - p) * 0.9);
    Rough.bloom(ctx, this.x, this.y, 18 + o * 14, '#fffdf4', (1 - p) * 0.9);
    Rough.circle(ctx, this.x, this.y, 12 + o * 44,
      { color: '#5e9e3a', width: 3.4, jitter: 2, wobble: 3, alpha: (1 - o) * 0.85 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.id;
      const r0 = 14 + o * 20, r1 = r0 + 14 * (1 - p);
      Rough.line(ctx, this.x + Math.cos(a) * r0, this.y + Math.sin(a) * r0,
        this.x + Math.cos(a) * r1, this.y + Math.sin(a) * r1,
        { color: '#2f5a1e', width: 2.2, jitter: 0.8, passes: 1, alpha: (1 - o) * 0.6 });
    }
  }
}

/* The hole left in the page where the trap came up. It fills back in. */
class DirtHole {
  constructor(x, y, r) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r;
    this.life = 2.8; this.max = this.life;
    this.under = true;
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = this.life / this.max;
    Rough.boil(this.id, 0);
    const a = Math.min(1, p * 2) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#2a2016';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 0.8, this.r * 0.55, 0, 0, 7); ctx.fill();
    ctx.restore();
    Rough.circle(ctx, this.x, this.y, this.r, { color: '#7a5a3a', width: 3, jitter: 3, wobble: 4, alpha: a });
  }
}
