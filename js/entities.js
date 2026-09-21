/* FANDHARN - enemies, status effects and every doodle that flies around.
   Everything here eases in and eases out; nothing pops into existence. */

let _id = 1;
function nextId() { return _id++; }
const E = Rough.ease;

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
    this.x = x; this.y = y;
    this.dead = false;
    this.burn = 0; this.burnTick = 0;
    this.slow = 0; this.slowMul = 1;
    this.stun = 0;
    this.flash = 0;
    this.hitT = 0;            // squash on hit
    this.spawnT = 0;          // 0 -> 1 scale-in
    this.faded = 0;
    this.hpShown = 1;         // HP bar eases toward the real value
    this.wobblePhase = Math.random() * 10;
    this.boss = kind === 'boss' || kind === 'warden';
    this.skillT = kind === 'boss' ? 4.5 : 7;   // boss skill cooldown
    this.immuneT = 0;                          // the warden's chalk barrier
    this.barrierT = 0;                         // barrier flare when it blocks
    this.calledGuards = false;
  }

  get speed() {
    if (this.spawnT < 0.5) return 0;            // settle before walking
    let s = this.baseSpeed;
    if (this.burn > 0) s *= 1.15;               // fire panics them
    if (this.slow > 0) s *= this.slowMul;
    return s;
  }

  hurt(amount, game, opts) {
    opts = opts || {};
    if (this.dead) return 0;
    if (this.immuneT > 0) {                    // the warden's barrier eats it
      this.barrierT = 1;
      if (!opts.silent && Math.random() < 0.3) {
        game.effects.push(new FloatText(this.x + Rough.jit(14), this.y - this.r, 'nope', '#8ec5e8', 15, false));
      }
      return 0;
    }
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount;
    this.flash = 0.12;
    this.hitT = 1;
    if (!opts.silent) {
      game.effects.push(new FloatText(this.x, this.y - this.r - 6,
        Math.round(amount * 10) / 10,
        opts.crit ? '#e0562d' : (opts.color || '#2b2b2b'), opts.crit ? 24 : 16, !!opts.crit));
    }
    if (this.hp <= 0) this.die(game);
    return dealt;
  }

  ignite(seconds) { this.burn = Math.max(this.burn, seconds); }

  applySlow(seconds, mul) {
    if (this.slow <= 0 || mul < this.slowMul) this.slowMul = mul;
    this.slow = Math.max(this.slow, seconds);
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    if (this.kind === 'boss') {                // bursts into three blotlings
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        game.spawnMinion('blotling', this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 26,
          this.maxHp * 0.09, this.baseSpeed * 2.6);
      }
      game.effects.push(new FloatText(this.x, this.y - this.r, 'it split', '#7a5cc4', 24, true));
    }
    game.onEnemyKilled(this);
    game.effects.push(new DeathSplat(this.x, this.y, this.r, this.fill, this.boss));
    if (this.boss) game.shake(14);
  }

  update(dt, game) {
    if (this.spawnT < 1) this.spawnT = Math.min(1, this.spawnT + dt / 0.45);
    if (this.hitT > 0) this.hitT = Math.max(0, this.hitT - dt / 0.22);
    this.hpShown += (Math.max(0, this.hp / this.maxHp) - this.hpShown) * Math.min(1, dt * 9);

    if (this.burn > 0) {
      this.burn -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 1;
        this.hurt(2 + Math.random(), game, { color: '#e0562d' });   // 2-3 a second
        if (this.dead) return;
      }
      if (Math.random() < dt * 16) game.effects.push(new Ember(this.x, this.y, this.r));
    }
    if (this.slow > 0) this.slow -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.barrierT > 0) this.barrierT = Math.max(0, this.barrierT - dt / 0.3);
    if (this.boss) this.bossSkill(dt, game);
    if (this.faded > 0) this.faded = Math.max(0, this.faded - dt * 0.6);
    if (this.stun > 0) { this.stun -= dt; return; }

    const d = Math.hypot(this.x, this.y) || 1;
    const step = this.speed * dt;
    this.x -= (this.x / d) * step;
    this.y -= (this.y / d) * step;

    if (d <= game.castleRadius + this.r * 0.6) {
      game.castleHit(this);
      this.dead = true;
      game.effects.push(new DeathSplat(this.x, this.y, this.r, this.fill, false));
    }
  }

  /* Each boss has one trick of its own. */
  bossSkill(dt, game) {
    this.skillT -= dt;

    if (this.kind === 'boss') {
      // THE BLOT: coughs up a blotling every few seconds, and bursts into
      // three more when it finally dies.
      if (this.skillT <= 0) {
        this.skillT = 4.5;
        game.spawnMinion('blotling', this.x, this.y, this.maxHp * 0.09, this.baseSpeed * 2.6);
        game.effects.push(new FloatText(this.x, this.y - this.r - 10, 'split!', '#7a5cc4', 19, false));
        game.effects.push(new Splash(this.x, this.y, this.r * 0.9));
      }
      return;
    }

    // THE WARDEN: chalks a barrier around itself that eats everything for a
    // couple of seconds, and calls two bricks the first time it drops to half.
    if (this.immuneT > 0) {
      this.immuneT -= dt;
      return;
    }
    if (!this.calledGuards && this.hp <= this.maxHp * 0.5) {
      this.calledGuards = true;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        game.spawnMinion('brick', this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, this.maxHp * 0.13, this.baseSpeed * 1.5);
      }
      game.effects.push(new FloatText(this.x, this.y - this.r - 10, 'guards', '#5c1f3a', 21, true));
      game.shake(10);
    }
    if (this.skillT <= 0) {
      this.skillT = 9;
      this.immuneT = 2.5;
      game.effects.push(new FloatText(this.x, this.y - this.r - 10, 'shielded!', '#8ec5e8', 19, false));
      game.effects.push(new ShieldPop(this.r + 16));
    }
  }

  draw(ctx, t) {
    Rough.boil(this.id, t + this.wobblePhase);
    // scale-in on spawn, squash on hit
    const grow = this.spawnT < 1 ? E.back(this.spawnT) : 1;
    const squash = 1 + E.pop(this.hitT) * 0.18;
    const rx = this.r * grow * squash;
    const ry = this.r * grow * (2 - squash);
    const x = this.x + (this.flash > 0 ? Rough.jit(3) : 0), y = this.y;
    const fill = this.flash > 0 ? '#ffffff' : this.fill;

    ctx.save();
    if (this.spawnT < 1) ctx.globalAlpha = E.out(this.spawnT);

    if (this.burn > 0) {
      Rough.blob(ctx, x, y, rx + 8, '#e0562d', 'rgba(0,0,0,0)',
        { spacing: 9, fillAlpha: 0.32, fillWidth: 4, overflow: 1.2 });
    }

    let pts;
    if (this.kind === 'brick') {
      pts = Rough.rectPts(x - rx, y - ry, rx * 2, ry * 2).map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
    } else if (this.kind === 'dart') {
      pts = [[x, y - ry], [x + rx, y + ry], [x - rx, y + ry]].map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
    } else if (this.kind === 'boss' || this.kind === 'warden') {
      // spiky crown of a shape, so bosses read instantly
      pts = [];
      const spikes = this.kind === 'warden' ? 13 : 9;
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const rr = (i % 2 ? 0.76 : 1.06) * ((rx + ry) / 2);
        pts.push([x + Math.cos(a) * rr + Rough.jit(2), y + Math.sin(a) * rr + Rough.jit(2)]);
      }
    } else {
      pts = Rough.circlePts(x, y, (rx + ry) / 2, this.r * 0.13, 11)
        .map((p, i) => [p[0] + (p[0] - x) * (squash - 1) * 0.6, p[1] - (p[1] - y) * (squash - 1) * 0.6]);
    }

    Rough.scribble(ctx, pts, { color: fill, spacing: this.boss ? 7 : 6, width: this.boss ? 7 : 5, overflow: 1.12 });
    Rough.grain(ctx, pts, '#2b2b2b', 0.002, this.id);
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: this.boss ? 3.4 : 2.4, jitter: 1.2 });

    // face
    const eye = ((rx + ry) / 2) * 0.28;
    ctx.fillStyle = '#2b2b2b';
    ctx.globalAlpha *= 0.9;
    const blink = (Math.sin(t * 1.7 + this.wobblePhase) > 0.985) ? 0.25 : 1;
    ctx.beginPath(); ctx.ellipse(x - eye - 1, y - eye * 0.4, Math.max(1.6, this.r * 0.11), Math.max(1.6, this.r * 0.11) * blink, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + eye + 1, y - eye * 0.4, Math.max(1.6, this.r * 0.11), Math.max(1.6, this.r * 0.11) * blink, 0, 0, 7); ctx.fill();
    ctx.globalAlpha /= 0.9;
    const mouth = this.burn > 0 ? 0.55 : 0.35;
    Rough.line(ctx, x - eye, y + ry * mouth, x + eye, y + ry * mouth,
      { color: '#2b2b2b', width: this.boss ? 2.6 : 1.8, jitter: 1.4, passes: 1 });

    if (this.immuneT > 0) {
      const flare = E.pop(this.barrierT) * 5;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(t * 9) * 0.2 + this.barrierT * 0.3;
      Rough.circle(ctx, x, y, this.r + 13 + flare, { color: '#8ec5e8', width: 4, jitter: 4 });
      Rough.circle(ctx, x, y, this.r + 19 + flare, { color: '#bcdcf2', width: 2.5, jitter: 5 });
      ctx.restore();
    }

    if (this.faded > 0) {
      ctx.globalAlpha = Math.min(0.85, this.faded);
      ctx.fillStyle = '#fffdf4';
      ctx.beginPath(); ctx.arc(x, y, this.r * 0.95, 0, 7); ctx.fill();
    }
    ctx.restore();

    // crayon HP bar, eased so chunks drain instead of jumping
    if (this.hpShown < 0.999) {
      const w = Math.max(this.r * 2.1, 26), bx = x - w / 2, by = y - ry - 13;
      const p = this.hpShown;
      Rough.line(ctx, bx, by, bx + w, by, { color: 'rgba(43,43,43,0.2)', width: 6, jitter: 0.8, passes: 1 });
      Rough.line(ctx, bx, by, bx + w * p, by,
        { color: p > 0.5 ? '#4c9f70' : (p > 0.25 ? '#d99a26' : '#c8433a'), width: 6, jitter: 1, passes: 1 });
    }
  }
}

/* ------------------------------------------------------- the stick sentry */
class Sentry {
  constructor(x, y) {
    this.id = nextId(); this.x = x; this.y = y;
    this.cool = 1.6; this.aim = -Math.PI / 2; this.recoil = 0; this.bob = Math.random() * 6;
  }
  update(dt, game) {
    this.cool -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt / 0.25);
    let best = null, bd = Infinity;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const want = Math.atan2(best.y - this.y, best.x - this.x);
      let diff = ((want - this.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.aim += diff * Math.min(1, dt * 7);          // smooth turret turn
      if (this.cool <= 0) {
        this.cool = 1.6;
        this.recoil = 1;
        game.effects.push(new Arrow(this.x, this.y, best, 3));
      }
    }
    return true;
  }
  draw(ctx, t) {
    Rough.boil(this.id, t * 0.6);
    const bob = Math.sin(t * 2 + this.bob) * 1.5;
    const x = this.x, y = this.y + bob;
    const pull = E.pop(this.recoil) * 3;
    Rough.circle(ctx, x, y - 13, 5, { color: '#2b2b2b', width: 2.2, jitter: 1 });
    Rough.line(ctx, x, y - 8, x, y + 6, { color: '#2b2b2b', width: 2.2, jitter: 1 });
    Rough.line(ctx, x, y + 6, x - 5, y + 14, { color: '#2b2b2b', width: 2.2, jitter: 1 });
    Rough.line(ctx, x, y + 6, x + 5, y + 14, { color: '#2b2b2b', width: 2.2, jitter: 1 });
    const ax = x + Math.cos(this.aim) * (11 - pull), ay = y - 2 + Math.sin(this.aim) * (11 - pull);
    Rough.line(ctx, x, y - 2, ax, ay, { color: '#4c9f70', width: 2.6, jitter: 1 });
    Rough.arc(ctx, ax, ay, 7, this.aim - 1.1, this.aim + 1.1, { color: '#4c9f70', width: 2.2, jitter: 1.2 });
  }
}

class Arrow {
  constructor(x, y, target, dmg) {
    this.id = nextId(); this.x = x; this.y = y; this.target = target; this.dmg = dmg;
    this.speed = 460; this.trail = [];
  }
  update(dt, game) {
    const tx = this.target && !this.target.dead ? this.target.x : this.x + Math.cos(this.a || 0) * 40;
    const ty = this.target && !this.target.dead ? this.target.y : this.y;
    const d = Math.hypot(tx - this.x, ty - this.y) || 1;
    this.a = Math.atan2(ty - this.y, tx - this.x);
    this.x += (tx - this.x) / d * this.speed * dt;
    this.y += (ty - this.y) / d * this.speed * dt;
    this.trail.push([this.x, this.y]);
    if (this.trail.length > 6) this.trail.shift();
    if (d < 14) {
      if (this.target && !this.target.dead) this.target.hurt(this.dmg, game, { color: '#4c9f70' });
      return false;
    }
    return true;
  }
  draw(ctx) {
    for (let i = 1; i < this.trail.length; i++) {
      ctx.save();
      ctx.globalAlpha = i / this.trail.length * 0.5;
      Rough.line(ctx, this.trail[i - 1][0], this.trail[i - 1][1], this.trail[i][0], this.trail[i][1],
        { color: '#4c9f70', width: 2, jitter: 0.8, passes: 1 });
      ctx.restore();
    }
    const a = this.a || 0;
    Rough.line(ctx, this.x - Math.cos(a) * 8, this.y - Math.sin(a) * 8, this.x, this.y,
      { color: '#2f6f4f', width: 2.4, jitter: 0.8, passes: 1 });
  }
}

/* ---------------------------------------------------------------- effects */

class FloatText {
  constructor(x, y, text, color, size, big) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size || 16; this.life = big ? 0.95 : 0.7; this.max = this.life;
    this.vx = (Math.random() - 0.5) * 24; this.big = big;
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const p = 1 - this.life / this.max;
    ctx.save();
    ctx.globalAlpha = 1 - E.out(p);
    const rise = E.out(p) * 46;
    const s = this.size * (this.big ? 1 + E.pop(Math.min(1, p * 2)) * 0.3 : 1);
    Rough.text(ctx, this.text + (this.big ? '!' : ''), this.x + this.vx * p, this.y - rise, s, this.color);
    ctx.restore();
  }
}

class Crumb {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 150;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    this.life = 0.4 + Math.random() * 0.45; this.max = this.life;
    this.color = color; this.size = 2 + Math.random() * 3; this.spin = Math.random() * 6;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9; this.spin += dt * 8;
    return this.life > 0;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = E.out(Math.max(0, this.life / this.max));
    ctx.translate(this.x, this.y); ctx.rotate(this.spin);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

/* A scribbled splat when something dies. */
class DeathSplat {
  constructor(x, y, r, color, big) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r; this.color = color; this.spin = 0;
    this.life = big ? 0.75 : 0.45; this.max = this.life;
    this.bits = [];
    const n = big ? 22 : 10;
    for (let i = 0; i < n; i++) this.bits.push(new Crumb(x, y, color));
  }
  update(dt) {
    this.life -= dt;
    this.spin += dt * 5;
    this.bits = this.bits.filter(b => b.update(dt));
    return this.life > 0;
  }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    Rough.boil(this.id, 0);
    // the body itself shrinks away instead of blinking out
    const gp = Math.min(1, p / 0.45);
    if (gp < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - gp) * 0.9;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.spin * 0.4);
      ctx.scale(1 - E.out(gp) * 0.9, 1 - E.out(gp) * 0.9);
      Rough.blob(ctx, 0, 0, this.r, this.color, '#2b2b2b', { spacing: 6, fillWidth: 5, sides: 10 });
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = (1 - E.out(p)) * 0.8;
    Rough.circle(ctx, this.x, this.y, this.r * (0.7 + E.out(p) * 1.1), { color: this.color, width: 3, jitter: 4 });
    ctx.restore();
    for (const b of this.bits) b.draw(ctx);
  }
}

class Ember {
  constructor(x, y, r) {
    const a = Math.random() * Math.PI * 2;
    this.x = x + Math.cos(a) * r * 0.8; this.y = y + Math.sin(a) * r * 0.8;
    this.life = 0.35 + Math.random() * 0.35; this.max = this.life;
    this.drift = (Math.random() - 0.5) * 30;
    this.hot = Math.random() < 0.5;
  }
  update(dt) { this.life -= dt; this.y -= 46 * dt; this.x += this.drift * dt; return this.life > 0; }
  draw(ctx) {
    const p = this.life / this.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p) * 0.9;
    ctx.fillStyle = this.hot ? '#e0562d' : '#e8c33a';
    const s = 1 + p * 2.5;
    ctx.fillRect(this.x, this.y, s, s);
    ctx.restore();
  }
}

/* Ring that blooms under the cursor on every click. */
class ClickRipple {
  constructor(x, y, color, crit) {
    this.id = nextId(); this.x = x; this.y = y; this.color = color;
    this.life = crit ? 0.45 : 0.3; this.max = this.life; this.crit = crit;
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = E.out(1 - this.life / this.max);
    Rough.boil(this.id, 0);
    ctx.save();
    ctx.globalAlpha = (1 - p) * (this.crit ? 0.9 : 0.55);
    Rough.circle(ctx, this.x, this.y, 6 + p * (this.crit ? 46 : 26),
      { color: this.color, width: this.crit ? 3 : 2, jitter: 2.5 });
    ctx.restore();
  }
}

/* Molten Leftkey blast. */
class FireBlast {
  constructor(x, y, radius, damage, game) {
    this.x = x; this.y = y; this.radius = radius;
    this.life = 0.5; this.max = this.life; this.id = nextId();
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= radius + e.r) {
        e.hurt(damage, game, { color: '#e0562d' });
        if (!e.dead) e.ignite(3);
      }
    }
    for (let i = 0; i < 10; i++) game.effects.push(new Ember(x, y, radius * 0.7));
    game.shake(7);
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = E.outQuint(1 - this.life / this.max);
    const r = this.radius * (0.3 + p * 0.75);
    Rough.boil(this.id, t * 2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p * p) * 0.95;
    Rough.blob(ctx, this.x, this.y, r, '#e8c33a', '#e0562d', { spacing: 8, fillWidth: 6, overflow: 1.18, width: 3 });
    Rough.blob(ctx, this.x, this.y, r * 0.58, '#e0562d', 'rgba(0,0,0,0)', { spacing: 7, fillWidth: 5 });
    ctx.restore();
  }
}

/* Wet Cursor drop: swells, hops a block, shrinks, pops. */
class WaterDrop {
  constructor(x, y, angle, game, radius, damage) {
    this.id = nextId();
    this.sx = x; this.sy = y;
    this.x = x; this.y = y;
    this.tx = x + Math.cos(angle) * BLOCK;
    this.ty = y + Math.sin(angle) * BLOCK;
    this.t = 0; this.dur = 0.5 + Math.random() * 0.12;
    this.radius = radius; this.damage = damage; this.popped = false;
  }
  update(dt, game) {
    this.t += dt;
    const p = Math.min(1, this.t / this.dur);
    const e = E.out(p);
    this.x = this.sx + (this.tx - this.sx) * e;
    this.y = this.sy + (this.ty - this.sy) * e;
    if (p >= 1 && !this.popped) {
      this.popped = true;
      game.areaDamage(this.x, this.y, this.radius, this.damage, { color: '#2f8fd6' });
      game.effects.push(new Splash(this.x, this.y, this.radius));
      return false;
    }
    return p < 1;
  }
  draw(ctx, t) {
    const p = Math.min(1, this.t / this.dur);
    const scale = p < 0.45 ? 0.6 + p * 1.3 : 1.19 - (p - 0.45) * 1.5;   // gravity squeezes it
    const r = Math.max(2, 7 * scale);
    Rough.boil(this.id, t * 2);
    Rough.blob(ctx, this.x, this.y + p * p * 7, r, '#2f8fd6', '#1d5f92', { spacing: 5, fillWidth: 4, sides: 9 });
  }
}

class Splash {
  constructor(x, y, r) { this.x = x; this.y = y; this.r = r || 20; this.life = 0.32; this.max = this.life; this.id = nextId(); }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = E.out(1 - this.life / this.max);
    Rough.boil(this.id, t);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    Rough.circle(ctx, this.x, this.y, this.r * (0.4 + p), { color: '#2f8fd6', width: 2.6, jitter: 2 });
    ctx.restore();
  }
}

/* Pen Tool: a live ink trail that follows the cursor. */
class PenTrail {
  constructor() {
    this.id = nextId();
    this.pts = [];          // {x, y, life}
    this.tick = 0;
    this.cool = new Map();  // per enemy, so a slow drag doesn't shred everything
  }
  add(x, y) {
    const last = this.pts[this.pts.length - 1];
    if (last) {
      const d = Math.hypot(last.x - x, last.y - y);
      if (d < 4) return;
      // a fast drag reports few points - fill them in so the trail curves
      // instead of cutting a straight chord across the paper
      const steps = Math.min(12, Math.floor(d / 14));
      for (let i = 1; i <= steps; i++) {
        this.pts.push({ x: last.x + (x - last.x) * (i / (steps + 1)), y: last.y + (y - last.y) * (i / (steps + 1)), life: 1.4 });
      }
    }
    this.pts.push({ x, y, life: 1.4 });
    while (this.pts.length > 120) this.pts.shift();
  }
  clear() { this.pts.length = 0; }
  update(dt, game) {
    for (const p of this.pts) p.life -= dt;
    while (this.pts.length && this.pts[0].life <= 0) this.pts.shift();
    for (const [id, v] of this.cool) {
      const nv = v - dt;
      if (nv <= 0) this.cool.delete(id); else this.cool.set(id, nv);
    }
    this.tick -= dt;
    if (this.tick <= 0 && this.pts.length > 1) {
      this.tick = 0.1;
      for (const e of game.enemies) {
        if (e.dead || this.cool.has(e.id)) continue;
        for (let i = 1; i < this.pts.length; i++) {
          const a = this.pts[i - 1], b = this.pts[i];
          if (distToSegment(e.x, e.y, a.x, a.y, b.x, b.y) <= e.r + 4) {
            e.hurt(1, game, { color: '#2f6f4f' });
            this.cool.set(e.id, 0.25);
            break;
          }
        }
      }
    }
    return true;
  }
  draw(ctx, t) {
    if (this.pts.length < 2) return;
    Rough.boil(this.id, t * 4);
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const fade = Math.max(0, Math.min(1, a.life / 1.4));
      ctx.save();
      ctx.globalAlpha = fade * 0.9;
      Rough.line(ctx, a.x, a.y, b.x, b.y,
        { color: '#2f6f4f', width: 1.2 + fade * 3.4, jitter: 1.1, passes: 1 });
      ctx.restore();
    }
  }
}

/* Eraser Cursor. */
class EraseBurst {
  constructor(x, y, radius, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.radius = radius;
    this.life = 0.55; this.max = this.life;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= radius + e.r) {
        e.hurt(e.maxHp * 0.2, game, { color: '#b06078' });
        if (!e.dead) { e.applySlow(2, 0.75); e.faded = 0.85; }
      }
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = E.out(1 - this.life / this.max);
    Rough.boil(this.id, t);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * (0.55 + p * 0.45), 0, 7); ctx.fill();
    Rough.circle(ctx, this.x, this.y, this.radius * (0.55 + p * 0.45), { color: '#e58ba0', width: 3, jitter: 3.5 });
    ctx.fillStyle = '#d8d2c2';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.fillRect(this.x + Rough.jit(this.radius), this.y + Rough.jit(this.radius) + p * 10, 3, 5);
    }
    ctx.restore();
  }
}

/* Buzz Cursor arc. */
class Bolt {
  constructor(points) { this.pts = points; this.life = 0.26; this.max = this.life; this.id = nextId(); }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    Rough.boil(this.id, t * 6);
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

/* Ink Overflow puddle. */
class InkPuddle {
  constructor(x, y, radius, dps) {
    this.id = nextId();
    this.x = x; this.y = y; this.radius = radius; this.dps = dps;
    this.life = 4; this.max = this.life; this.tick = 1; this.grow = 0;
    this.pts = Rough.noisyRing(x, y, radius, this.id, 26, 0.18);
  }
  update(dt, game) {
    this.life -= dt;
    this.grow = Math.min(1, this.grow + dt / 0.35);
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
    const s = E.back(this.grow);
    const fade = Math.min(1, this.life / 0.8);
    const pts = this.pts.map(p => [this.x + (p[0] - this.x) * s, this.y + (p[1] - this.y) * s]);
    ctx.save();
    ctx.globalAlpha = 0.6 * fade;
    Rough.scribble(ctx, pts, { color: '#37306b', spacing: 7, width: 6, overflow: 1.1, alpha: 0.7 });
    Rough.grain(ctx, pts, '#000000', 0.004, this.id);
    Rough.poly(ctx, pts, { color: '#241d4d', width: 2, jitter: 1.6 });
    ctx.restore();
  }
}

/* Banner that draws itself across the paper when a wave starts. */
class WaveBanner {
  constructor(text, sub, color) {
    this.id = nextId(); this.text = text; this.sub = sub || ''; this.color = color || '#2b2b2b';
    this.t = 0; this.dur = 2.1;
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, w, h, time) {
    const p = this.t / this.dur;
    const inn = E.back(Math.min(1, this.t / 0.5));
    const out = p > 0.75 ? E.out((p - 0.75) / 0.25) : 0;
    const y = h * 0.28 - out * 40;
    ctx.save();
    ctx.globalAlpha = (1 - out) * 0.95;
    ctx.translate(w / 2, y);
    ctx.scale(inn, inn);
    Rough.text(ctx, this.text, 0, 0, Math.min(58, w * 0.1), this.color);
    if (this.sub) Rough.text(ctx, this.sub, 0, 34, Math.min(20, w * 0.04), '#6b6b6b');
    Rough.boil(this.id, time);
    const half = Math.min(190, w * 0.3);
    Rough.line(ctx, -half, 20, half, 20, { color: this.color, width: 3, jitter: 2.5, passes: 2 });
    ctx.restore();
  }
}

/* Red ring that marks where something big is about to walk in. */
class SpawnMark {
  constructor(x, y, r) { this.id = nextId(); this.x = x; this.y = y; this.r = r; this.life = 1.1; this.max = this.life; }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = 1 - this.life / this.max;
    Rough.boil(this.id, t * 2);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.75;
    Rough.circle(ctx, this.x, this.y, this.r * (0.5 + p * 1.4), { color: '#c8433a', width: 3, jitter: 4 });
    ctx.restore();
  }
}

/* The chalk ward flaring as it eats a hit. */
class ShieldPop {
  constructor(r) { this.id = nextId(); this.r = r; this.life = 0.45; this.max = this.life; }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = E.out(1 - this.life / this.max);
    Rough.boil(this.id, t * 3);
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9;
    Rough.circle(ctx, 0, 0, this.r * (1 + p * 0.35), { color: '#8ec5e8', width: 4, jitter: 4 });
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
