/* FANDHARN - the Hive fight's own furniture: the crack the Queen puts
   through the page, what climbs out of it, and what happens if you let that
   land on the castle's lawn. */

const HIVE_KINDS = {
  hive: 1, worker: 1, bee: 1, queen: 1, larva: 1, steroid: 1, lavaball: 1
};

/* The stinger wound. It burns anything standing in it for three seconds,
   and on the last of those a lava ball climbs out. */
class GroundCrack {
  constructor(x, y, game) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.t = 0; this.dur = 3; this.erupted = false;
    this.tick = 0;
    // one long fissure through the wound, with a few branches off it, so it
    // reads as split paper rather than a star
    this.arms = [];
    const main = Math.random() * Math.PI * 2;
    for (const dir of [main, main + Math.PI]) {
      const len = BLOCK * (1.5 + Math.random() * 0.8);
      const pts = [[x, y]];
      let px = x, py = y, a = dir;
      for (let k = 0; k < 5; k++) {
        a += Rough.jit(0.45);
        px += Math.cos(a) * len / 5;
        py += Math.sin(a) * len / 5;
        pts.push([px, py]);
      }
      this.arms.push(pts);
      // a branch splitting off a third of the way along
      const bi = 2, ba = a + (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.5);
      const bp = [pts[bi].slice()];
      let bx = pts[bi][0], by = pts[bi][1];
      for (let k = 0; k < 3; k++) {
        bx += Math.cos(ba + Rough.jit(0.4)) * BLOCK * 0.22;
        by += Math.sin(ba + Rough.jit(0.4)) * BLOCK * 0.22;
        bp.push([bx, by]);
      }
      this.arms.push(bp);
    }
  }
  update(dt, game) {
    this.t += dt;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= BLOCK * 0.9 + e.r) {
          e.ignite(2 + game.statusBonus());
        }
      }
    }
    if (!this.erupted && this.t >= this.dur - 1) {
      this.erupted = true;                   // the last second, something climbs out
      const ball = game.spawnMinion('lavaball', this.x, this.y, 0, 0);
      ball.spawnT = 0.5;
      ball.fall = { sx: this.x, sy: this.y, t: 0, rise: 0.75, drop: 1.15, height: BLOCK * 3.6 };
      game.effects.push(new FloatText(this.x, this.y - 26, 'shoot it', '#e0562d', 17, false));
      Sfx.play('lava_erupt', { volume: 0.9 });
      game.shake(8);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const open = E.out(Math.min(1, this.t / 0.4));
    const fade = this.t > this.dur - 0.4 ? E.clamp01((this.dur - this.t) / 0.4) : 1;
    const glow = this.t > this.dur - 1.4 ? 1 : 0.45;
    Rough.boil(this.id, Math.floor(time * 5));
    ctx.save();
    ctx.globalAlpha = fade;
    Rough.bloom(ctx, this.x, this.y, BLOCK * 1.5 * open, '#e0562d', glow * 0.5);
    for (const arm of this.arms) {
      const pts = arm.map(p => [this.x + (p[0] - this.x) * open, this.y + (p[1] - this.y) * open]);
      Rough.poly(ctx, pts, { color: '#2b2b2b', width: 4, jitter: 2, closed: false });
      ctx.save();
      ctx.globalAlpha = fade * (0.5 + Math.sin(time * 9 + this.id) * 0.3);
      Rough.poly(ctx, pts, { color: '#e0562d', width: 2, jitter: 2.4, closed: false });
      ctx.restore();
    }
    // the mouth of it, glowing brighter as the thing inside comes up
    ctx.globalAlpha = fade * glow;
    Rough.circle(ctx, this.x, this.y, BLOCK * 0.42 * open, { color: '#e0562d', width: 3, jitter: 3, wobble: 4 });
    ctx.restore();
    if (Math.random() < 0.4) {
      ctx.save();
      ctx.globalAlpha = fade * 0.8;
      ctx.fillStyle = Math.random() < 0.5 ? '#e0562d' : '#e8c33a';
      ctx.fillRect(this.x + Rough.jit(16), this.y + Rough.jit(12), 3, 3);
      ctx.restore();
    }
  }
}

/* What a lava ball leaves when it lands. It burns whatever stands in it -
   and if it came down on the castle's lawn, the lawn goes up. */
class LavaPuddle {
  constructor(x, y, game) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.t = 0; this.dur = 6; this.tick = 0;
    this.pts = Rough.noisyRing(x, y, BLOCK * 1.25, this.id, 22, 0.22);
    Sfx.play('lava_land', { volume: 0.9 });
    game.shake(10);

    // the lawn is paper too
    if (Math.hypot(x, y) <= GROUND_RADIUS + BLOCK * 0.6 && !game.lawnBurnt) {
      game.lawnBurnt = true;
      game.buildGround(true);          // the green never comes back
      game.effects.push(new LawnFire(game));
      game.castleHp = Math.max(0, game.castleHp - 2);
      game.effects.push(new FloatText(0, -game.castleRadius - 30, '-2', '#c8433a', 28, true));
      game.shake(22);
      game.flash = 1;
      Sfx.play('grass_fire', { volume: 1, rateVar: 0 });
      if (game.castleHp <= 0 && game.state === 'playing') {
        game.state = 'collapsing';
        game.collapse = 0.0001;
        Sfx.play('game_over', { volume: 1, rateVar: 0 });
      }
      UI.syncHud(game);
    }
  }
  update(dt, game) {
    this.t += dt;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.6;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= BLOCK * 1.25 + e.r * 0.6) {
          e.ignite(2 + game.statusBonus());
        }
      }
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const grow = E.out(Math.min(1, this.t / 0.3));
    const fade = this.t > this.dur - 1.2 ? E.clamp01((this.dur - this.t) / 1.2) : 1;
    const pts = this.pts.map(p => [this.x + (p[0] - this.x) * grow, this.y + (p[1] - this.y) * grow]);
    ctx.save();
    ctx.globalAlpha = fade;
    Rough.bloom(ctx, this.x, this.y, BLOCK * 2 * grow, '#e0562d', 0.4 * fade);
    Rough.scribble(ctx, pts, { color: '#e0562d', spacing: 6, width: 6, overflow: 1.1, alpha: 0.85 });
    Rough.scribble(ctx, pts.map(p => [this.x + (p[0] - this.x) * 0.6, this.y + (p[1] - this.y) * 0.6]),
      { color: '#e8c33a', spacing: 5, width: 5, overflow: 1.1, alpha: 0.8 });
    Rough.poly(ctx, pts, { color: '#8a3a1c', width: 2.4, jitter: 2 });
    ctx.restore();
    if (Math.random() < 0.5) {
      ctx.save();
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = Math.random() < 0.5 ? '#e0562d' : '#e8c33a';
      ctx.fillRect(this.x + Rough.jit(BLOCK), this.y + Rough.jit(BLOCK * 0.8), 3, 3);
      ctx.restore();
    }
  }
}

/* The castle's lawn burning off, once. */
class LawnFire {
  constructor(game) {
    this.id = nextId();
    this.t = 0; this.dur = 5.5;
    this.tufts = [];
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = GROUND_RADIUS * Math.sqrt(Math.random());
      this.tufts.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, at: Math.random() * 1.2, seed: nextId() });
    }
  }
  update(dt, game) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const fade = this.t > this.dur - 1.5 ? E.clamp01((this.dur - this.t) / 1.5) : 1;
    // the patch itself is already redrawn in ash under everything, so this
    // only draws the flames working across it - anything more would scorch
    // over the castle standing on it
    ctx.save();
    for (const tf of this.tufts) {
      const k = this.t - tf.at;
      if (k < 0 || k > 2.2) continue;
      const beat = Math.sin(time * 11 + tf.seed) * 0.5 + 0.5;
      const h = (10 + beat * 12) * (1 - k / 2.2);
      ctx.save();
      ctx.globalAlpha = (1 - k / 2.2) * fade * 0.9;
      Rough.poly(ctx, [[tf.x - 4, tf.y], [tf.x + Rough.jit(3), tf.y - h], [tf.x + 4, tf.y]],
        { color: beat > 0.5 ? '#e8c33a' : '#e0562d', width: 2.6, jitter: 1.6, closed: false });
      ctx.restore();
    }
    ctx.restore();
    Rough.bloom(ctx, 0, 0, GROUND_RADIUS * 1.2, '#e0562d',
      Math.min(0.35, this.t * 0.5) * fade * 0.6);
  }
}

/* The nest coming apart when phase two ends. */
class HiveBreak {
  constructor(x, y, r) {
    this.id = nextId(); this.x = x; this.y = y; this.r = r;
    this.t = 0; this.dur = 1.4;
    this.shards = [];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 220;
      this.shards.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: Math.random() * 6, s: 6 + Math.random() * 12 });
    }
  }
  update(dt) {
    this.t += dt;
    for (const s of this.shards) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.94; s.vy *= 0.94; s.spin += dt * 5;
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const p = this.t / this.dur;
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.95;
    Rough.bloom(ctx, this.x, this.y, this.r * (1 + p * 2), '#e8c33a', (1 - p) * 0.5);
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);
      const hexy = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        hexy.push([Math.cos(a) * s.s, Math.sin(a) * s.s]);
      }
      Rough.scribble(ctx, hexy, { color: '#c9903a', spacing: 4, width: 4, overflow: 1.12 });
      Rough.poly(ctx, hexy, { color: '#2b2b2b', width: 2, jitter: 1.2 });
      ctx.restore();
    }
    ctx.restore();
  }
}
