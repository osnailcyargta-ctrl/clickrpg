/* FANDHARN - skills. Every cursor has one. It charges on clicks, it is fired
   by hand (right-click, or the corner button on a touchscreen), and it never
   goes off by itself. Each cast opens with the same cinematic beat - the page
   darkens, time drags, the name slams down - and then the cursor's own
   payload lands. */

/* The screen-space part of a cast: darkness, letterbox, the name, and the
   timing that fires the payload. World-space spectacle is pushed into
   game.effects by the payload itself. */
class SkillCinematic {
  constructor(game, cursorId, wx, wy) {
    this.id = nextId();
    this.cursorId = cursorId;
    this.cursor = cursorById(cursorId);
    this.skill = skillFor(cursorId);
    this.wx = wx; this.wy = wy;
    this.t = 0;
    this.windup = 0.62;            // page darkens, time drags, name slams
    this.payloadFired = false;
    this.dur = 2.6;                // the whole cast, including the tail
    this.flash = 0;
    this.rays = [];
    for (let i = 0; i < 26; i++) {
      this.rays.push({ a: Math.random() * Math.PI * 2, d: 0.55 + Math.random() * 0.75, w: 1 + Math.random() * 2.6 });
    }
  }

  /* How much the world is slowed while this plays. */
  get timeScale() {
    if (this.t < this.windup) return 0.22 + 0.5 * (this.t / this.windup);
    const after = (this.t - this.windup) / 0.5;
    return Math.min(1, 0.72 + after * 0.6);
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.22);
    if (!this.payloadFired && this.t >= this.windup) {
      this.payloadFired = true;
      this.flash = 1;
      const fire = SkillPayloads[this.cursorId] || SkillPayloads.plain;
      const extra = fire(game, this);
      if (extra) this.dur = Math.max(this.dur, this.windup + extra);
      game.shake(16);
    }
    return this.t < this.dur;
  }

  draw(ctx, w, h, time) {
    const p = this.t;
    const wind = E.clamp01(p / this.windup);
    // darkness comes in fast and lifts slowly
    const dark = p < this.windup
      ? E.out(wind) * 0.72
      : Math.max(0, 0.72 - E.out((p - this.windup) / (this.dur - this.windup)) * 0.72);

    if (dark > 0.01) {
      ctx.save();
      ctx.globalAlpha = dark;
      ctx.fillStyle = '#141018';
      ctx.fillRect(0, 0, w, h);
      // a hole punched over where the cast is aimed
      const cx = w / 2 + this.wx, cy = h / 2 + this.wy;
      const hole = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.42);
      hole.addColorStop(0, 'rgba(20,16,24,1)');
      hole.addColorStop(1, 'rgba(20,16,24,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = hole;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.42, 0, 7); ctx.fill();
      ctx.restore();
    }

    // letterbox bars, drawn on with a crayon
    const bar = E.out(Math.min(1, p / 0.3)) * (p > this.dur - 0.5 ? E.clamp01((this.dur - p) / 0.5) : 1);
    if (bar > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#141018';
      ctx.fillRect(0, 0, w, h * 0.075 * bar);
      ctx.fillRect(0, h - h * 0.075 * bar, w, h * 0.075 * bar);
      ctx.restore();
    }

    // everything rushing inward during the wind-up
    if (p < this.windup + 0.25) {
      const cx = w / 2 + this.wx, cy = h / 2 + this.wy;
      const k = E.clamp01(p / this.windup);
      ctx.save();
      Rough.boil(this.id, time * 6);
      for (const r of this.rays) {
        const far = Math.max(w, h) * r.d * (1 - k * 0.72);
        const near = far * 0.58;
        ctx.globalAlpha = 0.25 + k * 0.5;
        Rough.line(ctx, cx + Math.cos(r.a) * far, cy + Math.sin(r.a) * far,
          cx + Math.cos(r.a) * near, cy + Math.sin(r.a) * near,
          { color: this.cursor.color, width: r.w, jitter: 2.4, passes: 1 });
      }
      // the charge knot itself
      ctx.globalAlpha = 0.85;
      Rough.circle(ctx, cx, cy, 8 + E.back(k) * 26, { color: this.cursor.color, width: 3.4, jitter: 3 });
      Rough.circle(ctx, cx, cy, 4 + E.back(k) * 14, { color: '#fffdf4', width: 2.4, jitter: 2 });
      ctx.restore();
    }

    // the name, slammed down then dragged off
    const nameIn = E.clamp01((p - this.windup * 0.45) / 0.28);
    if (nameIn > 0) {
      const gone = E.clamp01((p - this.windup - 0.9) / 0.5);
      ctx.save();
      ctx.globalAlpha = (1 - gone) * 0.97;
      ctx.translate(w / 2, h * 0.2 + gone * -30);
      const s = 1 + (1 - E.back(nameIn)) * 0.9;
      ctx.scale(s, s);
      ctx.rotate((1 - E.out(nameIn)) * -0.14);
      Rough.boil(this.id + 3, time * 2);
      const size = Math.min(62, w * 0.1);
      Rough.text(ctx, this.skill.name, 0, 0, size, this.cursor.color);
      Rough.line(ctx, -size * 2.4, size * 0.45, size * 2.4, size * 0.45,
        { color: this.cursor.color, width: 4, jitter: 3, passes: 2 });
      ctx.globalAlpha = (1 - gone) * 0.55;
      Rough.text(ctx, this.skill.blurb, 0, size * 0.95, Math.min(16, w * 0.028), '#d9d3c4');
      ctx.restore();
    }

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.85;
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------- payloads */
const SkillPayloads = {
  /* THUNDERHEAD - the sky opens over everything near the cursor and over the
     castle's ground. 125% of a click, 105% on a boss. */
  storm(game, cine) {
    const reach = BLOCK * 5;
    const dmg = game.clickDamage() * 1.25;
    const bossDmg = game.clickDamage() * 1.05;
    const targets = game.enemies.filter(e => !e.dead && (
      Math.hypot(e.x - cine.wx, e.y - cine.wy) <= reach ||
      Math.hypot(e.x, e.y) <= GROUND_RADIUS + e.r));

    game.effects.push(new StormFront(cine.wx, cine.wy, reach));
    Sfx.play('thunder_roll', { volume: 1, rateVar: 0 });

    let i = 0;
    for (const e of targets) {
      game.effects.push(new LightningBolt(e.x, e.y, {
        delay: 0.12 + i * 0.09,
        damage: e.boss ? bossDmg : dmg,
        radius: 16,
        game: game
      }));
      i++;
    }
    // a few for the drama even where nothing is standing
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * reach;
      game.effects.push(new LightningBolt(cine.wx + Math.cos(a) * d, cine.wy + Math.sin(a) * d,
        { delay: 0.1 + Math.random() * (0.2 + i * 0.09), damage: 0, radius: 0, game: game }));
    }
    return 0.5 + i * 0.09 + 0.9;
  },

  /* PERIMETER - a circle drawn out from the castle that shoves everything to
     the edge of the paper. No damage, just distance. */
  compass(game, cine) {
    const stop = Math.max(game.w, game.h) / 2 - BLOCK * 6;
    game.effects.push(new PushRing(Math.max(BLOCK * 4, stop), game));
    Sfx.play('push_wave', { volume: 0.95 });
    return 1.8;
  },

  /* GUILLOTINE - the page is cut in two and the busier half is scrapped. */
  scissor(game, cine) {
    const above = game.enemies.filter(e => !e.dead && e.y < 0).length;
    const below = game.enemies.filter(e => !e.dead && e.y >= 0).length;
    const half = below >= above ? 1 : -1;        // +1 = the bottom goes
    game.effects.push(new Guillotine(half, 10, game));
    Sfx.play('guillotine', { volume: 1, rateVar: 0 });
    return 1.6;
  },

  /* EIGHT WAYS - static out of the cursor down eight lines at once. */
  buzz(game, cine) {
    const dmg = game.clickDamage() * 1.25;
    game.effects.push(new BuzzBeams(cine.wx, cine.wy, dmg, game));
    Sfx.play('zap', { volume: 1, rateVar: 0 });
    return 1.1;
  },

  /* CLOUDBURST - the page floods. */
  wet(game, cine) {
    game.effects.push(new Cloudburst(game, 8));
    Sfx.play('water_pop', { volume: 0.9, throttle: 0 });
    Sfx.play('push_wave', { volume: 0.5 });
    return 1.6;
  },

  /* CROSSHATCH - the whole screen is hatched over, and the lines bite. */
  pen(game, cine) {
    game.effects.push(new Crosshatch(game, 12));
    Sfx.play('card_draw', { volume: 0.9, throttle: 0 });
    return 1.5;
  },

  /* BLANK SLATE - a third of the drawing rubbed out around the cursor. */
  eraser(game, cine) {
    game.effects.push(new BlankSlate(cine.wx, cine.wy, BLOCK * 3, game));
    Sfx.play('erase', { volume: 1, rateVar: 0 });
    return 1.3;
  },

  /* EXCLAMATION - one enormous mark, slammed down where you point. */
  plain(game, cine) {
    game.effects.push(new ExclamationSlam(cine.wx, cine.wy, game.clickDamage() * 10, game));
    Sfx.play('castle_hit', { volume: 0.9, rateVar: 0 });
    return 1.2;
  }
};

/* --------------------------------------------------------- storm pieces */

/* The cloud bank that rolls in over the strike zone. */
class StormFront {
  constructor(x, y, reach) {
    this.id = nextId(); this.x = x; this.y = y; this.reach = reach;
    this.t = 0; this.dur = 2.4;
    this.puffs = [];
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * reach * 0.95;
      this.puffs.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 40, r: 20 + Math.random() * 34, drift: (Math.random() - 0.5) * 24, seed: nextId() });
    }
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const p = this.t / this.dur;
    const inn = E.out(Math.min(1, this.t / 0.5));
    const out = p > 0.72 ? E.out((p - 0.72) / 0.28) : 0;
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.75;
    for (const q of this.puffs) {
      Rough.boil(q.seed, Math.floor(time * 3));
      const y = q.y + (1 - inn) * -30;
      Rough.blob(ctx, q.x + q.drift * this.t, y, q.r * inn, '#3a3550', '#221f33',
        { spacing: 9, fillWidth: 7, sides: 10, width: 2.6 });
    }
    ctx.restore();
  }
}

/* One bolt: a jagged fall from off the top of the page, forks and all. */
class LightningBolt {
  constructor(x, y, o) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.delay = o.delay || 0;
    this.damage = o.damage || 0;
    this.radius = o.radius || 0;
    this.splash = o.splash;             // {radius, damage} for the cursor power
    this.game = o.game;
    this.t = 0; this.dur = 0.55;
    this.struck = false;
    this.segs = null;
  }
  build() {
    // from well above the top of the screen down to the target
    const topY = this.y - (this.game ? this.game.h : 600) * 0.75;
    const pts = [[this.x + Rough.jit(90), topY]];
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      pts.push([this.x + (pts[0][0] - this.x) * (1 - k) + Rough.jit(26 * (1 - k) + 6),
      topY + (this.y - topY) * k]);
    }
    pts[pts.length - 1] = [this.x, this.y];
    this.segs = pts;
    // forks peeling off the main stroke
    this.forks = [];
    for (let i = 0; i < 4; i++) {
      const at = 2 + Math.floor(Math.random() * (steps - 3));
      const from = pts[at];
      const len = 30 + Math.random() * 70;
      const a = (Math.random() - 0.5) * 1.5 + Math.PI / 2;
      this.forks.push([from, [from[0] + Math.cos(a) * len * (Math.random() < 0.5 ? -1 : 1), from[1] + Math.sin(a) * len]]);
    }
  }
  update(dt, game) {
    this.t += dt;
    if (this.t < this.delay) return true;
    if (!this.struck) {
      this.struck = true;
      Rough.boil(this.id, 0);
      this.build();
      // struck or splashed, never both
      if (this.damage > 0 || this.splash) {
        for (const e of game.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d <= this.radius + e.r) {
            if (this.damage > 0) e.hurt(this.damage, game, { color: '#dfe6ff' });
          } else if (this.splash && d <= this.splash.radius + e.r) {
            e.hurt(this.splash.damage, game, { color: '#9fb4ff' });
          }
        }
      }
      game.effects.push(new ScorchMark(this.x, this.y, this.radius || 14));
      for (let i = 0; i < 10; i++) game.effects.push(new Ember(this.x, this.y, 18));
      game.shake(this.damage > 0 ? 9 : 5);
      Sfx.play('thunder_strike', { volume: 0.85, throttle: 40, voices: 6 });
    }
    return this.t < this.delay + this.dur;
  }
  draw(ctx, time) {
    if (!this.struck || !this.segs) return;
    const k = (this.t - this.delay) / this.dur;
    const a = Math.max(0, 1 - k * k);
    ctx.save();
    ctx.globalAlpha = a;
    Rough.boil(this.id, Math.floor(time * 24));
    for (let i = 0; i < this.segs.length - 1; i++) {
      const s = this.segs[i], e = this.segs[i + 1];
      Rough.line(ctx, s[0], s[1], e[0], e[1], { color: '#8ea6ff', width: 9, jitter: 5, passes: 1 });
      Rough.line(ctx, s[0], s[1], e[0], e[1], { color: '#dfe6ff', width: 4.5, jitter: 3, passes: 1 });
      Rough.line(ctx, s[0], s[1], e[0], e[1], { color: '#ffffff', width: 1.8, jitter: 2, passes: 1 });
    }
    for (const f of this.forks) {
      Rough.line(ctx, f[0][0], f[0][1], f[1][0], f[1][1], { color: '#aebaff', width: 3, jitter: 4, passes: 1 });
    }
    // the ground lighting up under the hit
    ctx.globalAlpha = a * 0.8;
    Rough.circle(ctx, this.x, this.y, 10 + E.out(k) * 46, { color: '#dfe6ff', width: 4, jitter: 3.5 });
    Rough.circle(ctx, this.x, this.y, 4 + E.out(k) * 22, { color: '#ffffff', width: 3, jitter: 2.5 });
    ctx.restore();
  }
}

/* The burn the bolt leaves on the paper. */
class ScorchMark {
  constructor(x, y, r) {
    this.id = nextId(); this.x = x; this.y = y; this.r = r;
    this.life = 2.6; this.max = this.life;
    this.pts = Rough.noisyRing(x, y, r * 1.5, this.id, 16, 0.3);
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, this.life / this.max * 0.5);
    Rough.scribble(ctx, this.pts, { color: '#2b2b2b', spacing: 5, width: 5, overflow: 1.1, alpha: 0.7 });
    ctx.restore();
  }
}

/* The cloud the Storm Caller's ordinary charge gathers before a single bolt. */
class GatheringCloud {
  constructor(x, y, game, damage, splashRadius, splashDamage) {
    this.id = nextId(); this.x = x; this.y = y - 34;
    this.tx = x; this.ty = y;
    this.t = 0; this.fired = false;
    this.damage = damage; this.splashRadius = splashRadius; this.splashDamage = splashDamage;
    Sfx.play('storm_cloud', { volume: 0.5, throttle: 60 });
  }
  update(dt, game) {
    this.t += dt;
    if (!this.fired && this.t >= 0.5) {          // half a second of warning
      this.fired = true;
      game.effects.push(new LightningBolt(this.tx, this.ty, {
        damage: this.damage, radius: 16, game: game,
        splash: { radius: this.splashRadius, damage: this.splashDamage }
      }));
    }
    return this.t < 0.85;
  }
  draw(ctx, time) {
    const k = Math.min(1, this.t / 0.35);
    const fade = this.t > 0.5 ? Math.max(0, 1 - (this.t - 0.5) / 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    Rough.boil(this.id, Math.floor(time * 6));
    Rough.blob(ctx, this.x, this.y, 20 * E.back(k), '#3a3550', '#221f33', { spacing: 7, fillWidth: 6, sides: 9, width: 2.4 });
    Rough.blob(ctx, this.x - 14, this.y + 5, 13 * E.back(k), '#3a3550', '#221f33', { spacing: 6, fillWidth: 5, sides: 8, width: 2 });
    Rough.blob(ctx, this.x + 15, this.y + 4, 12 * E.back(k), '#3a3550', '#221f33', { spacing: 6, fillWidth: 5, sides: 8, width: 2 });
    // it crackles before it lets go
    if (this.t > 0.25) {
      ctx.globalAlpha = fade * (0.4 + Math.random() * 0.6);
      Rough.line(ctx, this.x + Rough.jit(12), this.y + 12, this.tx + Rough.jit(6), this.ty - 14,
        { color: '#dfe6ff', width: 2, jitter: 5, passes: 1 });
    }
    // the spot it is about to hit
    ctx.globalAlpha = fade * 0.5;
    Rough.circle(ctx, this.tx, this.ty, 14 + Math.sin(time * 18) * 3, { color: '#8ea6ff', width: 2.2, jitter: 2.5 });
    ctx.restore();
  }
}

/* ------------------------------------------------------- other payloads */

/* PERIMETER: a circle from the castle that shoves everything outward. */
class PushRing {
  constructor(target, game) {
    this.id = nextId();
    this.target = target;
    this.t = 0; this.dur = 1.3;
    this.trail = [];
  }
  get r() { return this.target * E.out(Math.min(1, this.t / this.dur)); }
  update(dt, game) {
    const before = this.r;
    this.t += dt;
    const r = this.r;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x, e.y) || 1;
      if (d <= r) {
        // ride the line outward, never through it
        const push = Math.max(r - d, (r - before));
        e.x += (e.x / d) * push;
        e.y += (e.y / d) * push;
        e.stun = Math.max(e.stun, 0.25);
      }
    }
    return this.t < this.dur + 0.4;
  }
  draw(ctx, time) {
    const p = Math.min(1, this.t / this.dur);
    const r = this.r;
    ctx.save();
    Rough.boil(this.id, time * 3);
    ctx.globalAlpha = Math.max(0, 1 - p * p) * 0.95;
    Rough.circle(ctx, 0, 0, r, { color: '#8a5cc4', width: 6, jitter: 3.5 });
    Rough.circle(ctx, 0, 0, r * 0.97, { color: '#d9c8f2', width: 3, jitter: 3 });
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.4;
    Rough.circle(ctx, 0, 0, r * 0.82, { color: '#8a5cc4', width: 2.4, jitter: 4 });
    Rough.circle(ctx, 0, 0, r * 0.64, { color: '#8a5cc4', width: 1.8, jitter: 4 });
    // the compass arm sweeping it round
    ctx.globalAlpha = Math.max(0, 1 - p);
    const a = p * Math.PI * 2.5;
    Rough.line(ctx, 0, 0, Math.cos(a) * r, Math.sin(a) * r, { color: '#8a5cc4', width: 3, jitter: 2, passes: 1 });
    ctx.restore();
  }
}

/* GUILLOTINE: the page cut in two, and one half scrapped. */
class Guillotine {
  constructor(half, damage, game) {
    this.id = nextId();
    this.half = half;                 // +1 bottom, -1 top
    this.damage = damage;
    this.t = 0; this.dur = 1.5;
    this.cut = false;
    this.w = game.w; this.h = game.h;
  }
  update(dt, game) {
    this.t += dt;
    if (!this.cut && this.t >= 0.45) {
      this.cut = true;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if ((this.half > 0 && e.y >= 0) || (this.half < 0 && e.y < 0)) {
          e.hurt(this.damage, game, { color: '#c8433a' });
        }
      }
      game.shake(14);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const close = E.out(E.clamp01(this.t / 0.45));
    const after = E.clamp01((this.t - 0.45) / (this.dur - 0.45));
    const halfW = this.w * 0.62;

    ctx.save();
    Rough.boil(this.id, time);
    // the blades sweeping in from both sides to meet on the centre line
    if (this.t < 0.75) {
      const gap = (1 - close) * halfW;
      ctx.globalAlpha = Math.min(1, 1 - after * 1.4);
      for (const s of [-1, 1]) {
        const tipX = s * gap;
        const blade = [[tipX, 0], [s * (gap + halfW), -26], [s * (gap + halfW), 26]];
        Rough.scribble(ctx, blade, { color: '#ccd2d8', spacing: 7, width: 6, overflow: 1.1 });
        Rough.poly(ctx, blade, { color: '#2b2b2b', width: 3.4, jitter: 1.6 });
      }
    }
    // the cut itself, and the scrapped half sliding away
    if (this.cut) {
      ctx.globalAlpha = Math.max(0, 1 - after);
      Rough.line(ctx, -this.w, 0, this.w, 0, { color: '#c8433a', width: 5, jitter: 3, passes: 2 });
      ctx.globalAlpha = Math.max(0, 0.5 - after * 0.5);
      const off = E.out(after) * 26 * this.half;
      Rough.line(ctx, -this.w, off + this.half * 4, this.w, off + this.half * 4,
        { color: '#2b2b2b', width: 3, jitter: 4, passes: 1 });
    }
    ctx.restore();
  }
}

/* EIGHT WAYS: static tears out of the cursor down eight lines and earths
   itself through every enemy on the paper - the lines find them. */
class BuzzBeams {
  constructor(x, y, damage, game) {
    this.id = nextId(); this.x = x; this.y = y;
    this.t = 0; this.dur = 1.0;
    this.len = Math.max(game.w, game.h);
    this.spin = Math.random() * Math.PI;
    this.struck = false;
    this.damage = damage;
    this.arcs = [];                 // a kink of lightning to each victim
  }
  update(dt, game) {
    this.t += dt;
    if (!this.struck && this.t >= 0.12) {
      this.struck = true;
      for (const e of game.enemies) {
        if (e.dead) continue;
        // it earths through the nearest of the eight lines
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        let best = 0, bestDiff = 99;
        for (let i = 0; i < 8; i++) {
          const ba = this.spin + (i / 8) * Math.PI * 2;
          const diff = Math.abs(((a - ba + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff < bestDiff) { bestDiff = diff; best = i; }
        }
        const ba = this.spin + (best / 8) * Math.PI * 2;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        this.arcs.push([[this.x + Math.cos(ba) * d, this.y + Math.sin(ba) * d], [e.x, e.y]]);
        e.hurt(this.damage, game, { color: '#b99a1c' });
        if (!e.dead) e.stun = Math.max(e.stun, 0.6 + game.statusBonus());
      }
      game.shake(12);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const p = this.t / this.dur;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p * p);
    Rough.boil(this.id, Math.floor(time * 30));
    for (let i = 0; i < 8; i++) {
      const a = this.spin + (i / 8) * Math.PI * 2;
      const reach = this.len * Math.min(1, p * 4);
      const ex = this.x + Math.cos(a) * reach, ey = this.y + Math.sin(a) * reach;
      Rough.line(ctx, this.x, this.y, ex, ey, { color: '#e8c33a', width: 8, jitter: 9, passes: 1 });
      Rough.line(ctx, this.x, this.y, ex, ey, { color: '#fff6c2', width: 3, jitter: 6, passes: 1 });
    }
    // the kinks that reach off the lines into whatever they caught
    for (const arc of this.arcs) {
      Rough.line(ctx, arc[0][0], arc[0][1], arc[1][0], arc[1][1],
        { color: '#fff6c2', width: 3.4, jitter: 8, passes: 2 });
    }
    Rough.circle(ctx, this.x, this.y, 12 + E.out(p) * 40, { color: '#fff6c2', width: 4, jitter: 3 });
    ctx.restore();
  }
}

/* CLOUDBURST: the page floods and everything in it is soaked. */
class Cloudburst {
  constructor(game, damage) {
    this.id = nextId();
    this.t = 0; this.dur = 1.6; this.hit = false;
    this.damage = damage;
    this.drops = [];
    for (let i = 0; i < 90; i++) {
      this.drops.push({
        x: (Math.random() - 0.5) * game.w, y: (Math.random() - 0.5) * game.h - game.h * 0.6,
        v: 700 + Math.random() * 600, len: 10 + Math.random() * 18
      });
    }
  }
  update(dt, game) {
    this.t += dt;
    for (const d of this.drops) d.y += d.v * dt;
    if (!this.hit && this.t >= 0.45) {
      this.hit = true;
      for (const e of game.enemies) {
        if (e.dead) continue;
        e.hurt(this.damage, game, { color: '#2f8fd6' });
        if (!e.dead) e.applySlow(3 + game.statusBonus(), 0.6);
      }
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = fade * 0.8;
    for (const d of this.drops) {
      Rough.line(ctx, d.x, d.y, d.x - 3, d.y - d.len, { color: '#2f8fd6', width: 2, jitter: 0.6, passes: 1 });
    }
    ctx.restore();
  }
}

/* CROSSHATCH: the whole page scribbled over, and the lines bite. */
class Crosshatch {
  constructor(game, damage) {
    this.id = nextId();
    this.t = 0; this.dur = 1.5; this.hit = false;
    this.damage = damage;
    this.w = game.w; this.h = game.h;
  }
  update(dt, game) {
    this.t += dt;
    if (!this.hit && this.t >= 0.5) {
      this.hit = true;
      for (const e of game.enemies) {
        if (e.dead) continue;
        e.hurt(this.damage, game, { color: '#2f6f4f' });
      }
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const p = E.clamp01(this.t / 0.55);
    const fade = this.t > this.dur - 0.5 ? E.clamp01((this.dur - this.t) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = fade * 0.85;
    Rough.boil(this.id, 0);
    const n = 16, span = Math.max(this.w, this.h);
    const shown = Math.round(n * p);
    for (let i = 0; i < shown; i++) {
      const off = -span / 2 + (i / n) * span;
      Rough.line(ctx, -span, off, span, off + span * 0.5, { color: '#2f6f4f', width: 3, jitter: 3, passes: 1 });
      Rough.line(ctx, off, -span, off + span * 0.5, span, { color: '#2f6f4f', width: 3, jitter: 3, passes: 1 });
    }
    ctx.restore();
  }
}

/* BLANK SLATE: a wide rub-out around the cursor. */
class BlankSlate {
  constructor(x, y, radius, game) {
    this.id = nextId(); this.x = x; this.y = y; this.radius = radius;
    this.t = 0; this.dur = 1.3; this.hit = false;
    this.pts = Rough.noisyRing(x, y, radius, this.id, 40, 0.14);
  }
  update(dt, game) {
    this.t += dt;
    if (!this.hit && this.t >= 0.35) {
      this.hit = true;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= this.radius + e.r) {
          e.hurt(e.maxHp * 0.25, game, { color: '#b06078' });
          if (!e.dead) { e.applySlow(3 + game.statusBonus(), 0.6); e.faded = 1; }
        }
      }
      game.shake(12);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const k = E.out(E.clamp01(this.t / 0.4));
    const fade = this.t > this.dur - 0.6 ? E.clamp01((this.dur - this.t) / 0.6) : 1;
    const pts = this.pts.map(p => [this.x + (p[0] - this.x) * k, this.y + (p[1] - this.y) * k]);
    ctx.save();
    ctx.globalAlpha = fade * 0.95;
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.poly(ctx, pts, { color: '#e58ba0', width: 4, jitter: 4 });
    // rubber crumbs flying off
    Rough.srand(this.id);
    ctx.fillStyle = '#d8d2c2';
    for (let i = 0; i < 24; i++) {
      const a = Rough.rnd() * Math.PI * 2, d = this.radius * (0.5 + Rough.rnd() * 0.8) * k;
      ctx.globalAlpha = fade * 0.6;
      ctx.fillRect(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d + k * 12, 3, 6);
    }
    ctx.restore();
  }
}

/* EXCLAMATION: one enormous mark, slammed down. */
class ExclamationSlam {
  constructor(x, y, damage, game) {
    this.id = nextId(); this.x = x; this.y = y; this.damage = damage;
    this.t = 0; this.dur = 1.2; this.hit = false;
    this.radius = BLOCK * 1.6;
  }
  update(dt, game) {
    this.t += dt;
    if (!this.hit && this.t >= 0.3) {
      this.hit = true;
      game.areaDamage(this.x, this.y, this.radius, this.damage, { color: '#2b2b2b' });
      game.shake(18);
      for (let i = 0; i < 18; i++) game.effects.push(new Crumb(this.x, this.y, '#2b2b2b'));
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const drop = E.out(E.clamp01(this.t / 0.3));
    const fade = this.t > 0.5 ? E.clamp01((this.dur - this.t) / 0.7) : 1;
    const y = this.y - (1 - drop) * 260;
    const s = 1 + (1 - drop) * 0.6;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(this.x, y);
    ctx.scale(s, s);
    Rough.boil(this.id, time * 2);
    const bar = [[-13, -78], [13, -78], [9, 16], [-9, 16]];
    Rough.scribble(ctx, bar, { color: '#2b2b2b', spacing: 6, width: 7, overflow: 1.12 });
    Rough.poly(ctx, bar, { color: '#2b2b2b', width: 3.4, jitter: 1.6 });
    const dot = Rough.circlePts(0, 40, 13, 2, 9);
    Rough.scribble(ctx, dot, { color: '#2b2b2b', spacing: 5, width: 6, overflow: 1.14 });
    Rough.poly(ctx, dot, { color: '#2b2b2b', width: 3.2, jitter: 1.4 });
    ctx.restore();
    if (this.hit) {
      const k = E.out(E.clamp01((this.t - 0.3) / 0.5));
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      Rough.circle(ctx, this.x, this.y, 16 + k * this.radius * 1.4, { color: '#2b2b2b', width: 4, jitter: 4 });
      ctx.restore();
    }
  }
}
