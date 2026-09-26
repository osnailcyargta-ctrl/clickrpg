/* FANDHARN - the extra layer of light and debris on top of the doodles.

   Everything in here is decoration: nothing in this file deals damage or
   changes a rule. That is what lets Fx.low switch half of it off when the
   machine running the game is struggling - on a school TV browser the fight
   has to stay smooth before it gets to look expensive. */

const Fx = {
  low: false,            // thin the decoration out; set by the frame governor
  ema: 1 / 60,           // smoothed frame time
  slowFor: 0, fastFor: 0,

  /* Called once a frame with the real (uncapped-by-slowmo) frame time. Needs
     a couple of seconds of evidence either way before it flips, so a single
     hitch never strips the effects and a single quiet moment never brings
     them back. */
  sample(dt) {
    this.ema += (dt - this.ema) * 0.05;
    if (this.ema > 1 / 40) { this.slowFor += dt; this.fastFor = 0; }
    else if (this.ema < 1 / 52) { this.fastFor += dt; this.slowFor = 0; }
    if (!this.low && this.slowFor > 2) this.low = true;
    if (this.low && this.fastFor > 4) this.low = false;
  },

  /* How many of something to make: the full count normally, a third of it
     when the machine is struggling, never less than one. */
  n(count) { return this.low ? Math.max(1, Math.round(count / 3)) : count; }
};

/* A flash where a click lands: a bloom, a few ink streaks thrown outward,
   and on a crit a doodled star that spins open over it. */
class HitSpark {
  constructor(x, y, color, crit) {
    this.id = nextId();
    this.x = x; this.y = y; this.color = color; this.crit = crit;
    this.life = crit ? 0.42 : 0.26; this.max = this.life;
    this.spin = Math.random() * Math.PI;
    this.rays = [];
    const n = Fx.n(crit ? 8 : 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      this.rays.push({ a, len: (crit ? 22 : 13) * (0.7 + Math.random() * 0.6) });
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    const o = E.out(p);
    Rough.boil(this.id, 0);
    // a plain hit's flash is the first thing a struggling machine drops;
    // a crit always gets its light
    if (this.crit || !Fx.low) {
      Rough.bloom(ctx, this.x, this.y, (this.crit ? 46 : 24) * (0.6 + o * 0.5),
        this.crit ? '#ffb347' : this.color, (1 - p) * (this.crit ? 0.9 : 0.55));
    }
    for (const r of this.rays) {
      const r0 = 6 + o * r.len * 0.8, r1 = r0 + r.len * (1 - p) * 0.8;
      Rough.line(ctx, this.x + Math.cos(r.a) * r0, this.y + Math.sin(r.a) * r0,
        this.x + Math.cos(r.a) * r1, this.y + Math.sin(r.a) * r1,
        { color: this.crit ? '#e0562d' : '#2b2b2b', width: this.crit ? 2.6 : 1.8, jitter: 0.8, passes: 1,
          alpha: (1 - p) * 0.9 });
    }
    if (this.crit) {
      // a four-point star, opening and turning as it fades
      const s = 10 + o * 20;
      const a0 = this.spin + p * 1.2;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = a0 + (i / 8) * Math.PI * 2;
        const rr = i % 2 ? s * 0.28 : s;
        pts.push([this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr]);
      }
      const fade = E.hold(p, 0.3) * 0.95;
      Rough.scribble(ctx, pts, { color: '#e8c33a', spacing: 4, width: 3, overflow: 1.1, alpha: fade });
      Rough.poly(ctx, pts, { color: '#e0562d', width: 2, jitter: 0.8, alpha: fade });
    }
  }
}

/* A little stain left on the page where a droplet came down. Drawn under
   the enemies, and it fades over a couple of seconds. */
class SplatMark {
  constructor(x, y, color, size) {
    this.id = nextId();
    this.x = x; this.y = y; this.color = color;
    this.size = size; this.life = 2.4; this.max = this.life;
    this.under = true;
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = this.life / this.max;
    Rough.boil(this.id, 0);
    Rough.blob(ctx, this.x, this.y, this.size, this.color, 'rgba(0,0,0,0)',
      { spacing: 3, fillWidth: 3, sides: 7, width: 0.1, fillAlpha: Math.min(1, p * 1.6) * 0.55 });
  }
}

/* A drop of whatever the thing was made of, thrown out when it dies. It
   arcs, lands, and leaves a mark. */
class Droplet {
  constructor(x, y, color, power) {
    const a = Math.random() * Math.PI * 2;
    const sp = (60 + Math.random() * 150) * power;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    this.h = 0; this.vh = 90 + Math.random() * 120 * power;   // height above the page
    this.color = color; this.size = 2 + Math.random() * 3 * power;
  }
  update(dt, game) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.97; this.vy *= 0.97;
    this.vh -= 520 * dt;
    this.h += this.vh * dt;
    if (this.h <= 0) {
      if (!Fx.low) game.effects.push(new SplatMark(this.x, this.y, this.color, this.size * 1.3));
      return false;
    }
    return true;
  }
  draw(ctx) {
    ctx.save();
    // its shadow on the page, and the drop itself up in the air
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, this.size, this.size * 0.6, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y - this.h, this.size, 0, 7); ctx.fill();
    ctx.restore();
  }
}

/* What a death looks like on top of the splat it already had: a burst of
   light in the thing's own colour, a shock ring, and drops of it thrown
   across the page. Bosses add light rays. */
class KillPop {
  constructor(x, y, r, color, big, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r; this.color = color; this.big = big;
    this.life = big ? 1.1 : 0.4; this.max = this.life;
    const n = Fx.n(big ? 18 : 6);
    for (let i = 0; i < n; i++) game.effects.push(new Droplet(x, y, color, big ? 1.8 : 1));
    this.rays = [];
    if (big) for (let i = 0; i < 12; i++) this.rays.push(Math.random() * Math.PI * 2);
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    const o = E.outQuint(p);
    Rough.boil(this.id, Math.floor(t * 10));
    Rough.bloom(ctx, this.x, this.y, this.r * (1.4 + o * (this.big ? 3 : 1.2)), this.color, (1 - p) * 0.8);
    if (this.big || !Fx.low) Rough.bloom(ctx, this.x, this.y, this.r * (0.8 + o * 0.6), '#fffdf4', (1 - p) * (this.big ? 0.9 : 0.5));
    Rough.circle(ctx, this.x, this.y, this.r * (1 + o * (this.big ? 3.2 : 1.6)),
      { color: this.color, width: this.big ? 4 : 2.4, jitter: 2, wobble: 3, alpha: (1 - o) * 0.75 });
    if (this.big) {
      Rough.circle(ctx, this.x, this.y, this.r * (0.6 + o * 2.2),
        { color: '#2b2b2b', width: 2, jitter: 2, wobble: 3, alpha: (1 - o) * 0.5 });
      for (const a of this.rays) {
        const r0 = this.r * (0.8 + o), r1 = r0 + this.r * (1.5 + o * 2.5);
        Rough.line(ctx, this.x + Math.cos(a) * r0, this.y + Math.sin(a) * r0,
          this.x + Math.cos(a) * r1, this.y + Math.sin(a) * r1,
          { color: '#e8c33a', width: 2.4, jitter: 1.2, passes: 1, alpha: (1 - p) * 0.7 });
      }
    }
  }
}

/* The castle losing a segment: a red flash on it, chunks of it thrown off
   and a ring of dust. */
class CastleBurst {
  constructor(game) {
    this.id = nextId();
    this.r = game.castleRadius;
    this.life = 0.7; this.max = this.life;
    const n = Fx.n(12);
    for (let i = 0; i < n; i++) {
      const c = new Crumb(Rough.jit(this.r * 0.6), Rough.jit(this.r * 0.5),
        i % 3 === 0 ? '#2b2b2b' : '#c9a36b');
      c.size += 2;
      game.effects.push(c);
    }
    for (let i = 0; i < Fx.n(6); i++) game.effects.push(new Droplet(0, 0, '#9a8f86', 1.3));
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = 1 - this.life / this.max;
    const o = E.out(p);
    Rough.boil(this.id, 0);
    Rough.bloom(ctx, 0, 0, this.r * (2 + o * 1.5), '#c8433a', (1 - p) * 0.8);
    Rough.circle(ctx, 0, 0, this.r * (1.1 + o * 1.8),
      { color: '#9a8f86', width: 5, jitter: 3, wobble: 5, alpha: (1 - o) * 0.6 });
  }
}

/* Stars circling a stunned head. Drawn by the enemy itself, from here. */
function drawStunStars(ctx, x, y, r, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 4.2 + (i / 3) * Math.PI * 2;
    const sx = x + Math.cos(a) * r * 0.75, sy = y - r * 1.05 + Math.sin(a) * r * 0.22;
    const s = 4 + Math.sin(t * 9 + i) * 0.8;
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const b = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 ? s * 0.45 : s;
      pts.push([sx + Math.cos(b) * rr, sy + Math.sin(b) * rr]);
    }
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#e8c33a';
    ctx.beginPath();
    pts.forEach((pt, j) => j ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
    ctx.closePath(); ctx.fill();
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 1.3, jitter: 0.5 });
    ctx.restore();
  }
}

/* Coins earned: a doodled gold coin bounces down over the castle with the
   amount on it. Drawn in screen space above everything but the cursor. */
class CoinPop {
  constructor(n) {
    this.id = nextId();
    this.n = n;
    this.t = 0; this.dur = 2.6;
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const k = this.t / this.dur;
    const drop = E.back(Math.min(1, this.t / 0.55));
    const y = -140 + drop * 60 - Math.max(0, k - 0.75) * 120;
    const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const r = 22;
    Rough.boil(this.id, Math.floor(time * 6));
    Rough.bloom(ctx, 0, y, r * 3, '#ffd24a', 0.7 * a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.arc(0, y, r, 0, 7); ctx.fill();
    ctx.restore();
    Rough.circle(ctx, 0, y, r, { color: '#a5741b', width: 3, jitter: 1.2, wobble: 1.5, alpha: a });
    Rough.circle(ctx, 0, y, r * 0.7, { color: '#c9921d', width: 2, jitter: 1, wobble: 1.2, alpha: a * 0.8 });
    ctx.save();
    ctx.globalAlpha = a;
    Rough.text(ctx, '+' + this.n, 0, y + 1, 18, '#7a5212');
    Rough.text(ctx, this.n === 1 ? 'coin' : 'coins', 0, y + r + 16, 16, '#a5741b');
    ctx.restore();
  }
}
