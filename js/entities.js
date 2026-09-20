/* FANDHARN - enemies, status effects and every doodle that flies around. */

let _id = 1;
function nextId() { return _id++; }

class Enemy {
  constructor(kind, hp, speed, x, y) {
    this.id = nextId();
    this.kind = kind;
    const k = ENEMY_KINDS[kind];
    this.r = k.r;
    this.fill = k.fill;
    this.maxHp = hp;
    this.hp = hp;
    this.baseSpeed = speed;
    this.x = x;
    this.y = y;
    this.dead = false;
    this.burn = 0;        // seconds left on fire
    this.burnTick = 0;
    this.slow = 0;        // seconds left slowed
    this.slowMul = 1;
    this.stun = 0;
    this.flash = 0;
    this.faded = 0;       // eraser rubs the drawing away
    this.wobblePhase = Math.random() * 10;
  }

  get speed() {
    let s = this.baseSpeed;
    if (this.burn > 0) s *= 1.15;          // fire panics them
    if (this.slow > 0) s *= this.slowMul;
    return s;
  }

  hurt(amount, game, opts) {
    opts = opts || {};
    if (this.dead) return 0;
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount;
    this.flash = 0.12;
    if (!opts.silent) {
      game.effects.push(new FloatText(this.x, this.y - this.r - 6,
        (opts.crit ? '' : '') + (Math.round(amount * 10) / 10),
        opts.crit ? '#e0562d' : (opts.color || '#2b2b2b'), opts.crit ? 22 : 16, !!opts.crit));
    }
    if (this.hp <= 0) this.die(game);
    return dealt;
  }

  ignite(game, seconds) {
    this.burn = Math.max(this.burn, seconds);
  }

  applySlow(seconds, mul) {
    if (this.slow <= 0 || mul < this.slowMul) this.slowMul = mul;
    this.slow = Math.max(this.slow, seconds);
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    game.onEnemyKilled(this);
    for (let i = 0; i < 9; i++) {
      game.effects.push(new Crumb(this.x, this.y, this.fill));
    }
  }

  update(dt, game) {
    if (this.burn > 0) {
      this.burn -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 1;
        const dmg = 2 + Math.random();   // 2 - 3 damage per second
        this.hurt(dmg, game, { color: '#e0562d' });
        if (this.dead) return;
      }
      if (Math.random() < dt * 14) game.effects.push(new Ember(this.x, this.y, this.r));
    }
    if (this.slow > 0) this.slow -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.stun > 0) { this.stun -= dt; return; }

    const d = Math.hypot(this.x, this.y) || 1;
    const step = this.speed * dt;
    this.x -= (this.x / d) * step;
    this.y -= (this.y / d) * step;

    if (d <= game.castleRadius + this.r * 0.6) {
      game.castleHit(this);
      this.dead = true;
      for (let i = 0; i < 12; i++) game.effects.push(new Crumb(this.x, this.y, this.fill));
    }
  }

  draw(ctx, t) {
    Rough.boil(this.id, t + this.wobblePhase);
    const hurtOffset = this.flash > 0 ? Rough.jit(3) : 0;
    const x = this.x + hurtOffset, y = this.y;
    const fill = this.flash > 0 ? '#ffffff' : this.fill;

    if (this.burn > 0) {
      Rough.blob(ctx, x, y, this.r + 7, '#e0562d', 'rgba(0,0,0,0)',
        { spacing: 9, fillAlpha: 0.35, fillWidth: 4, overflow: 1.2 });
    }

    let pts;
    if (this.kind === 'brick') {
      pts = Rough.rectPts(x - this.r, y - this.r, this.r * 2, this.r * 2)
        .map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
      Rough.scribble(ctx, pts, { color: fill, spacing: 6, width: 5, overflow: 1.12 });
      Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.6, jitter: 1.2 });
    } else if (this.kind === 'dart') {
      pts = [[x, y - this.r], [x + this.r, y + this.r], [x - this.r, y + this.r]]
        .map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
      Rough.scribble(ctx, pts, { color: fill, spacing: 6, width: 5, overflow: 1.14 });
      Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.4, jitter: 1.1 });
    } else {
      pts = Rough.blob(ctx, x, y, this.r, fill, '#2b2b2b',
        { sides: this.kind === 'boss' ? 16 : 11, width: this.kind === 'boss' ? 3.2 : 2.4 });
    }

    // face
    const eye = this.r * 0.28;
    ctx.save();
    ctx.fillStyle = '#2b2b2b';
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x - eye - 1, y - eye * 0.4, Math.max(1.6, this.r * 0.11), 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + eye + 1, y - eye * 0.4, Math.max(1.6, this.r * 0.11), 0, 7); ctx.fill();
    ctx.restore();
    Rough.line(ctx, x - eye, y + this.r * 0.35, x + eye, y + this.r * 0.35,
      { color: '#2b2b2b', width: 1.8, jitter: 1.4, passes: 1 });

    if (this.faded > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, this.faded);
      ctx.fillStyle = '#fffdf4';
      ctx.beginPath(); ctx.arc(x, y, this.r * 0.9, 0, 7); ctx.fill();
      ctx.restore();
      this.faded -= 0.02;
    }

    // crayon HP bar
    if (this.hp < this.maxHp) {
      const w = this.r * 2.1, bx = x - w / 2, by = y - this.r - 12;
      const p = Math.max(0, this.hp / this.maxHp);
      Rough.line(ctx, bx, by, bx + w, by, { color: 'rgba(43,43,43,0.25)', width: 5, jitter: 0.8, passes: 1 });
      Rough.line(ctx, bx, by, bx + w * p, by, { color: p > 0.5 ? '#4c9f70' : (p > 0.25 ? '#d99a26' : '#c8433a'), width: 5, jitter: 1, passes: 1 });
    }
  }
}

/* ---------------------------------------------------------------- effects */

class FloatText {
  constructor(x, y, text, color, size, big) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size || 16; this.life = big ? 0.9 : 0.65; this.max = this.life;
    this.vx = (Math.random() - 0.5) * 22; this.big = big;
  }
  update(dt) { this.life -= dt; this.y -= 42 * dt; this.x += this.vx * dt; return this.life > 0; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    const s = this.big ? this.size * (1 + (1 - this.life / this.max) * 0.25) : this.size;
    Rough.text(ctx, this.text + (this.big ? '!' : ''), this.x, this.y, s, this.color);
    ctx.restore();
  }
}

class Crumb {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 130;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    this.life = 0.4 + Math.random() * 0.4; this.max = this.life;
    this.color = color; this.size = 2 + Math.random() * 3;
  }
  update(dt) {
    this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    return this.life > 0;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

class Ember {
  constructor(x, y, r) {
    const a = Math.random() * Math.PI * 2;
    this.x = x + Math.cos(a) * r * 0.8; this.y = y + Math.sin(a) * r * 0.8;
    this.life = 0.35 + Math.random() * 0.3; this.max = this.life;
  }
  update(dt) { this.life -= dt; this.y -= 40 * dt; return this.life > 0; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max) * 0.9;
    ctx.fillStyle = Math.random() < 0.5 ? '#e0562d' : '#e8c33a';
    ctx.fillRect(this.x, this.y, 3, 3);
    ctx.restore();
  }
}

/* Molten Leftkey blast: 2 blocks of fire, half click damage, then burn. */
class FireBlast {
  constructor(x, y, radius, damage, game) {
    this.x = x; this.y = y; this.radius = radius;
    this.life = 0.45; this.max = this.life; this.id = nextId();
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= radius + e.r) {
        e.hurt(damage, game, { color: '#e0562d' });
        if (!e.dead) e.ignite(game, 3);
      }
    }
    game.shake(6);
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    const r = this.radius * (0.45 + p * 0.55);
    Rough.boil(this.id, t);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.95;
    Rough.blob(ctx, this.x, this.y, r, '#e8c33a', '#e0562d', { spacing: 8, fillWidth: 6, overflow: 1.18, width: 3 });
    Rough.blob(ctx, this.x, this.y, r * 0.6, '#e0562d', 'rgba(0,0,0,0)', { spacing: 7, fillWidth: 5 });
    ctx.restore();
  }
}

/* Wet Cursor drop: swells, hops one block, gravity shrinks it, then pops. */
class WaterDrop {
  constructor(x, y, angle, game) {
    this.id = nextId();
    this.sx = x; this.sy = y;
    this.x = x; this.y = y;
    this.tx = x + Math.cos(angle) * BLOCK;
    this.ty = y + Math.sin(angle) * BLOCK;
    this.t = 0; this.dur = 0.5; this.game = game; this.popped = false;
  }
  update(dt, game) {
    this.t += dt;
    const p = Math.min(1, this.t / this.dur);
    this.x = this.sx + (this.tx - this.sx) * p;
    this.y = this.sy + (this.ty - this.sy) * p;
    if (p >= 1 && !this.popped) {
      this.popped = true;
      game.areaDamage(this.x, this.y, 20, 2, { color: '#2f8fd6' });
      game.effects.push(new Splash(this.x, this.y));
      return false;
    }
    return p < 1;
  }
  draw(ctx, t) {
    const p = Math.min(1, this.t / this.dur);
    // swell out, then squeeze small as gravity takes it
    const scale = p < 0.45 ? 0.6 + p * 1.3 : 1.19 - (p - 0.45) * 1.5;
    const r = Math.max(2, 7 * scale);
    Rough.boil(this.id, t);
    Rough.blob(ctx, this.x, this.y + p * p * 6, r, '#2f8fd6', '#1d5f92', { spacing: 5, fillWidth: 4, sides: 9 });
  }
}

class Splash {
  constructor(x, y) { this.x = x; this.y = y; this.life = 0.28; this.max = this.life; this.id = nextId(); }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    Rough.boil(this.id, t);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    Rough.circle(ctx, this.x, this.y, 8 + p * 16, { color: '#2f8fd6', width: 2.6, jitter: 2 });
    ctx.restore();
  }
}

/* Graphite Cursor: a live pencil line that grinds anything crossing it. */
class ScribbleLine {
  constructor(x1, y1, x2, y2) {
    this.id = nextId();
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.life = 2.5; this.max = this.life; this.tick = 0;
  }
  update(dt, game) {
    this.life -= dt;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (distToSegment(e.x, e.y, this.x1, this.y1, this.x2, this.y2) <= e.r + 5) {
          e.hurt(1, game, { color: '#5a5f6a' });
        }
      }
    }
    return this.life > 0;
  }
  draw(ctx, t) {
    Rough.boil(this.id, t);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.life / this.max + 0.25);
    Rough.line(ctx, this.x1, this.y1, this.x2, this.y2, { color: '#5a5f6a', width: 4, jitter: 3, passes: 3 });
    ctx.restore();
  }
}

/* Eraser Cursor: rubs a hole in the paper. */
class EraseBurst {
  constructor(x, y, radius, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.radius = radius;
    this.life = 0.5; this.max = this.life;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= radius + e.r) {
        e.hurt(e.maxHp * 0.2, game, { color: '#b06078' });
        if (!e.dead) { e.applySlow(2, 0.75); e.faded = 0.8; }
      }
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    Rough.boil(this.id, t);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * (0.6 + p * 0.4), 0, 7); ctx.fill();
    Rough.circle(ctx, this.x, this.y, this.radius * (0.6 + p * 0.4), { color: '#e58ba0', width: 3, jitter: 3 });
    ctx.restore();
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.fillStyle = '#d8d2c2';
      ctx.fillRect(this.x + Rough.jit(this.radius), this.y + Rough.jit(this.radius), 3, 5);
      ctx.restore();
    }
  }
}

/* Buzz Cursor: static arc between targets. */
class Bolt {
  constructor(points) { this.pts = points; this.life = 0.22; this.max = this.life; this.id = nextId(); }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    Rough.boil(this.id, t * 3);
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      Rough.line(ctx, a[0], a[1], b[0], b[1], { color: '#e8c33a', width: 3.4, jitter: 7, passes: 2 });
      Rough.line(ctx, a[0], a[1], b[0], b[1], { color: '#fff6c2', width: 1.4, jitter: 6, passes: 1 });
    }
    ctx.restore();
  }
}

/* Ink Overflow: a crit-spawned puddle that slows and stains. */
class InkPuddle {
  constructor(x, y, radius, dps) {
    this.id = nextId();
    this.x = x; this.y = y; this.radius = radius; this.dps = dps;
    this.life = 4; this.max = this.life; this.tick = 1;
    this.pts = null;
  }
  update(dt, game) {
    this.life -= dt;
    this.tick -= dt;
    const touching = [];
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.radius + e.r * 0.5) touching.push(e);
    }
    for (const e of touching) e.applySlow(0.2, 0.7);
    if (this.tick <= 0) {
      this.tick = 1;
      for (const e of touching) e.hurt(this.dps, game, { color: '#37306b' });
    }
    return this.life > 0;
  }
  draw(ctx, t) {
    if (!this.pts) { Rough.boil(this.id, 0); this.pts = Rough.circlePts(this.x, this.y, this.radius, this.radius * 0.22, 12); }
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, this.life / this.max + 0.2);
    Rough.scribble(ctx, this.pts, { color: '#37306b', spacing: 6, width: 6, overflow: 1.12, alpha: 0.8 });
    Rough.poly(ctx, this.pts, { color: '#241d4d', width: 2, jitter: 1.6 });
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ utils */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
