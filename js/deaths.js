/* FANDHARN - how things die.

   Every kill used to be the same splat. Now each thing breaks the way it is
   made: a brick cracks and shatters into bricks, the Warden's slab splits and
   its eye rolls away, a paper dart tears and flutters, a blob bursts into
   gobs, a bee comes apart in stripes and wings. The pieces are real little
   bodies - they arc, cast a shadow, bounce once, skid and settle - which is
   most of what makes a kill feel like it landed.

   Decoration only: nothing here touches a rule, and the frame governor
   (Fx.low) thins the pieces out on a struggling machine. */

/* One piece of something. Height above the page is separate from its place
   on the page, so it throws a shadow and lands. */
class Chunk {
  constructor(x, y, o) {
    this.id = nextId();
    this.x = x; this.y = y; this.h = o.h0 || 4;
    const a = o.a != null ? o.a : Math.random() * Math.PI * 2;
    const sp = (o.speed || 120) * (0.55 + Math.random() * 0.7);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.8;
    this.vh = (o.up || 170) * (0.6 + Math.random() * 0.7);
    this.g = o.g || 720;
    this.spin = Math.random() * 6; this.vs = (Math.random() - 0.5) * (o.twirl || 14);
    this.shape = o.shape; this.color = o.color; this.ink = o.ink || '#2b2b2b';
    this.size = o.size * (0.7 + Math.random() * 0.6);
    this.life = (o.life || 1.6) * (0.8 + Math.random() * 0.4); this.max = this.life;
    this.bounced = 0; this.flutter = o.flutter || 0; this.phase = Math.random() * 6;
    this.pts = this.makeShape();
  }
  makeShape() {
    const s = this.size, j = () => (Math.random() - 0.5) * s * 0.35;
    switch (this.shape) {
      case 'brick': {                        // a broken-off corner of a brick
        const w = s * 1.4, h = s * 0.8;
        return [[-w / 2 + j(), -h / 2 + j()], [w / 2 + j(), -h / 2], [w / 2, h / 2 + j()], [-w / 2 + j() * 0.5, h / 2]];
      }
      case 'shard': return [[j(), -s], [s * 0.8 + j(), s * 0.5], [-s * 0.7 + j(), s * 0.6]];
      case 'paper': return [[-s, -s * 0.5], [s, -s * 0.7 + j()], [s * 0.8, s * 0.6], [-s * 0.9 + j(), s * 0.5]];
      case 'rod': return [[-s * 1.6, -s * 0.18], [s * 1.6, -s * 0.18], [s * 1.6, s * 0.18], [-s * 1.6, s * 0.18]];
      default: {                             // a gob: a lumpy round piece
        const pts = [];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2, r = s * (0.75 + Math.random() * 0.4);
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        return pts;
      }
    }
  }
  update(dt, game) {
    this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.flutter) {                      // paper and wings see-saw down
      this.x += Math.sin(this.phase + this.life * 9) * this.flutter * dt;
      this.vh = Math.max(this.vh - this.g * dt, -60);
    } else {
      this.vh -= this.g * dt;
    }
    this.h += this.vh * dt;
    this.spin += this.vs * dt;
    if (this.h <= 0) {
      this.h = 0;
      if (this.bounced < 1 && this.vh < -60) {            // one bounce, then it skids
        this.bounced++;
        this.vh = -this.vh * 0.32; this.vx *= 0.55; this.vy *= 0.55; this.vs *= 0.5;
      } else {
        this.vh = 0; this.vx *= Math.pow(0.02, dt); this.vy *= Math.pow(0.02, dt); this.vs *= Math.pow(0.05, dt);
      }
    }
    return this.life > 0;
  }
  draw(ctx) {
    const fade = Math.min(1, this.life / 0.45);
    // its shadow on the page, tighter the lower it is
    ctx.save();
    ctx.globalAlpha = 0.16 * fade * Math.max(0.3, 1 - this.h / 160);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + 2, this.size * 0.9, this.size * 0.45, 0, 0, 7); ctx.fill();
    ctx.restore();
    const y = this.y - this.h;
    const c = Math.cos(this.spin), s = Math.sin(this.spin);
    const pts = this.pts.map(p => [this.x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c]);
    if (this.shape === 'eye') { this.drawEye(ctx, y, fade); return; }
    ctx.save();
    ctx.globalAlpha = fade * (this.shape === 'wing' ? 0.45 : 1);
    ctx.fillStyle = this.color;
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.restore();
    Rough.boil(this.id, 0);
    Rough.poly(ctx, pts, { color: this.ink, width: this.shape === 'wing' ? 1.2 : 1.8, jitter: 0.7, passes: 1, alpha: fade });
    if (this.shape === 'brick') {            // a line of mortar across what is left of it
      Rough.line(ctx, pts[0][0] * 0.5 + pts[3][0] * 0.5, pts[0][1] * 0.5 + pts[3][1] * 0.5,
        pts[1][0] * 0.5 + pts[2][0] * 0.5, pts[1][1] * 0.5 + pts[2][1] * 0.5,
        { color: '#e8dcc6', width: 1.4, jitter: 0.5, passes: 1, alpha: fade * 0.8 });
    }
  }
  /* The Warden's eye, out of its socket and rolling. */
  drawEye(ctx, y, fade) {
    const r = this.size;
    Rough.bloom(ctx, this.x, y, r * 2.4, '#e8d45a', 0.35 * fade);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#f2ead0';
    ctx.beginPath(); ctx.arc(this.x, y, r, 0, 7); ctx.fill();
    const la = this.spin;
    ctx.fillStyle = '#c9b43a';
    ctx.beginPath(); ctx.arc(this.x + Math.cos(la) * r * 0.35, y + Math.sin(la) * r * 0.35, r * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = '#05010a';
    ctx.beginPath(); ctx.ellipse(this.x + Math.cos(la) * r * 0.35, y + Math.sin(la) * r * 0.35, r * 0.14, r * 0.5, la, 0, 7); ctx.fill();
    ctx.restore();
    Rough.boil(this.id, 0);
    Rough.circle(ctx, this.x, y, r, { color: '#1a0c13', width: 2.2, jitter: 0.8, wobble: 1, passes: 1, alpha: fade });
  }
}

/* A puff of dust off something that broke. Cheap: soft fills, no strokes. */
class Dust {
  constructor(x, y, r, color) {
    this.x = x + (Math.random() - 0.5) * r; this.y = y + (Math.random() - 0.5) * r * 0.6;
    this.r = r * (0.35 + Math.random() * 0.35);
    this.vx = (Math.random() - 0.5) * 60; this.vy = -12 - Math.random() * 22;
    this.life = 0.7 + Math.random() * 0.5; this.max = this.life; this.color = color || '#b8ad9c';
  }
  update(dt) { this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.r += dt * 26; return this.life > 0; }
  draw(ctx) {
    const p = this.life / this.max;
    ctx.save();
    ctx.globalAlpha = p * 0.32;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 7); ctx.fill();
    ctx.restore();
  }
}

/* The beat before a brick or the Warden goes: the body held for a moment,
   flashing, with cracks running across it - then it comes apart. */
class CrackFlash {
  constructor(x, y, hw, hh, color, dur, onBreak) {
    this.id = nextId();
    this.x = x; this.y = y; this.hw = hw; this.hh = hh; this.color = color;
    this.t = 0; this.dur = dur; this.onBreak = onBreak; this.broke = false;
    this.cracks = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const pts = [[0, 0]];
      let px = 0, py = 0;
      for (let k = 0; k < 3; k++) {
        px += Math.cos(a + (Math.random() - 0.5) * 0.9) * hw * 0.4;
        py += Math.sin(a + (Math.random() - 0.5) * 0.9) * hh * 0.4;
        pts.push([px, py]);
      }
      this.cracks.push(pts);
    }
  }
  update(dt, game) {
    this.t += dt;
    if (!this.broke && this.t >= this.dur) { this.broke = true; this.onBreak(game); }
    return this.t < this.dur;
  }
  draw(ctx) {
    const k = Math.min(1, this.t / this.dur);
    const s = 1 + k * 0.06;                  // it bulges as it goes
    const pts = Rough.rectPts(this.x - this.hw * s, this.y - this.hh * s, this.hw * 2 * s, this.hh * 2 * s);
    ctx.save();
    ctx.fillStyle = k < 0.35 ? '#ffffff' : this.color;       // the hit flashes it white first
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.restore();
    Rough.boil(this.id, 0);
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.6, jitter: 1, passes: 1 });
    for (const c of this.cracks) {
      const n = Math.max(2, Math.ceil(c.length * Math.min(1, k * 1.6)));
      const seg = c.slice(0, n).map(p => [this.x + p[0], this.y + p[1]]);
      Rough.poly(ctx, seg, { color: '#1a1010', width: 2.4, jitter: 0.8, closed: false, passes: 1 });
    }
  }
}

const Deaths = {
  /* Everything here scales with the governor: a TV that is struggling gets a
     third of the pieces. */
  spray(game, x, y, n, o) {
    const count = Fx.n(n);
    for (let i = 0; i < count; i++) game.effects.push(new Chunk(x, y, o));
  },
  dust(game, x, y, r, n, color) {
    for (let i = 0; i < Fx.n(n); i++) game.effects.push(new Dust(x, y, r, color));
  },
  stain(game, x, y, r, color, n) {
    if (Fx.low) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      game.effects.push(new SplatMark(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, color, r * (0.18 + Math.random() * 0.2)));
    }
  },

  play(e, game) {
    const x = e.x, y = e.y, r = e.r, big = e.boss;
    // the light and the ring, which every death keeps
    game.effects.push(new KillPop(x, y, r, e.fill, big, game));
    const recipe = this.recipes[e.kind] || this.recipes.blob;
    recipe.call(this, e, game, x, y, r);
    game.shake(big ? 14 : (r > 20 ? 4 : 2));
  },

  recipes: {
    /* crayon things burst into gobs of their own colour and stain the page */
    blob(e, game, x, y, r) {
      this.spray(game, x, y, 7, { shape: 'gob', color: e.fill, size: r * 0.32, speed: 150, up: 160 });
      this.spray(game, x, y, 3, { shape: 'gob', color: '#2b2b2b', size: r * 0.14, speed: 190, up: 200 });
      this.stain(game, x, y, r * 1.1, e.fill, 3);
      game.effects.push(new DeathSplat(x, y, r, e.fill, false));
    },
    blotling(e, game, x, y, r) { this.recipes.blob.call(this, e, game, x, y, r); },
    boss(e, game, x, y, r) {                           // the Blot: a lot of ink
      this.spray(game, x, y, 16, { shape: 'gob', color: '#2f2f3f', size: r * 0.22, speed: 230, up: 240, life: 2.2 });
      this.spray(game, x, y, 8, { shape: 'gob', color: '#6b4fb0', size: r * 0.14, speed: 260, up: 260 });
      this.stain(game, x, y, r * 1.8, '#2f2f3f', 8);
      game.effects.push(new DeathSplat(x, y, r, e.fill, true));
    },

    /* a paper dart tears and the scraps flutter down */
    dart(e, game, x, y, r) {
      this.spray(game, x, y, 6, { shape: 'paper', color: '#f4f1e6', ink: '#3f97c9', size: r * 0.42, speed: 90, up: 150, g: 260, flutter: 70, twirl: 10, life: 1.9 });
      this.spray(game, x, y, 3, { shape: 'paper', color: '#3f97c9', size: r * 0.3, speed: 110, up: 170, g: 260, flutter: 60, life: 1.7 });
    },

    /* the brick: holds, cracks, and shatters into bricks, mortar and dust */
    brick(e, game, x, y, r) {
      game.effects.push(new CrackFlash(x, y, r, r, e.fill, 0.09, (g) => {
        this.spray(g, x, y, 8, { shape: 'brick', color: '#b5623a', size: r * 0.42, speed: 170, up: 190, twirl: 10, life: 2 });
        this.spray(g, x, y, 6, { shape: 'shard', color: '#8a4a2a', size: r * 0.16, speed: 220, up: 230 });
        this.spray(g, x, y, 6, { shape: 'gob', color: '#d8ccb8', size: r * 0.1, speed: 200, up: 180, life: 1.2 });
        this.dust(g, x, y, r * 1.2, 5);
        g.shake(5);
        Sfx.play('kill_big', { volume: 0.55, rateVar: 0.1, throttle: 60 });
      }));
    },

    /* the Warden: the slab splits, the grille and the chains come off, the
       horns snap, and the eye pops out of the socket and rolls away */
    warden(e, game, x, y, r) {
      const hw = r * 1.55, hh = r * 1.15;
      game.effects.push(new CrackFlash(x, y, hw, hh, '#5c1f3a', 0.16, (g) => {
        this.spray(g, x, y, 14, { shape: 'brick', color: '#5c1f3a', size: r * 0.4, speed: 230, up: 230, twirl: 9, life: 2.6 });
        this.spray(g, x, y, 8, { shape: 'brick', color: '#3d1526', size: r * 0.28, speed: 260, up: 260, life: 2.4 });
        this.spray(g, x, y, 5, { shape: 'rod', color: '#1a0c13', size: r * 0.22, speed: 200, up: 220, twirl: 16, life: 2.4 });
        this.spray(g, x, y, 6, { shape: 'gob', color: '#6b6b6b', ink: '#3a3a3a', size: r * 0.12, speed: 240, up: 240, life: 2 });
        this.spray(g, x, y, 2, { shape: 'shard', color: '#9a8f86', size: r * 0.3, speed: 190, up: 260, life: 2.4 });
        g.effects.push(new Chunk(x, y - hh * 0.24, { shape: 'eye', size: r * 0.42, a: Math.random() * Math.PI * 2, speed: 150, up: 260, twirl: 18, life: 3.2 }));
        this.dust(g, x, y, hw * 1.4, 12, '#a89c8a');
        this.stain(g, x, y, r * 1.6, '#3d1526', 5);
        g.shake(18);
        Sfx.play('kill_big', { volume: 1, rateVar: 0 });
      }));
    },

    /* bees come apart: stripes, wings that flutter off, a little goo */
    bee(e, game, x, y, r, n) {
      n = n || 1;
      this.spray(game, x, y, 3 * n, { shape: 'gob', color: '#e8c33a', size: r * 0.32, speed: 140, up: 150 });
      this.spray(game, x, y, 2 * n, { shape: 'gob', color: '#2b2b2b', size: r * 0.26, speed: 140, up: 150 });
      this.spray(game, x, y, 2, { shape: 'wing', color: '#cfe4f2', ink: '#8aa8bc', size: r * 0.5, speed: 70, up: 140, g: 200, flutter: 60, life: 1.8 });
      this.stain(game, x, y, r * 0.8, '#c9a53a', 2);
    },
    worker(e, game, x, y, r) { this.recipes.bee.call(this, e, game, x, y, r); },
    steroid(e, game, x, y, r) { this.recipes.bee.call(this, e, game, x, y, r, 3); game.effects.push(new DeathSplat(x, y, r, e.fill, false)); },
    larva(e, game, x, y, r) {
      this.spray(game, x, y, 6, { shape: 'gob', color: '#efe0b0', size: r * 0.3, speed: 120, up: 130 });
      this.stain(game, x, y, r, '#d8c890', 3);
    },
    queen(e, game, x, y, r) {
      this.recipes.bee.call(this, e, game, x, y, r, 5);
      this.spray(game, x, y, 6, { shape: 'shard', color: '#2b2b2b', size: r * 0.2, speed: 220, up: 240, life: 2.4 });   // the crown
      this.dust(game, x, y, r, 6, '#e8c33a');
      game.effects.push(new DeathSplat(x, y, r, e.fill, true));
    },
    hive(e, game, x, y, r) {                            // HiveBreak already throws the combs
      this.spray(game, x, y, 8, { shape: 'shard', color: '#c9903a', size: r * 0.2, speed: 200, up: 220, life: 2 });
      this.dust(game, x, y, r, 8, '#d8b878');
    },

    /* the Auger: the eyes come loose and scatter, and the drill falls off */
    auger(e, game, x, y, r) {
      this.spray(game, x, y, 10, { shape: 'gob', color: '#2a1a28', size: r * 0.26, speed: 190, up: 190, life: 2.2 });
      this.spray(game, x, y, 7, { shape: 'gob', color: '#efe6c8', ink: '#1a0c13', size: r * 0.14, speed: 230, up: 230, twirl: 20, life: 2.4 });
      this.spray(game, x, y, 1, { shape: 'shard', color: '#8d8a86', ink: '#0e080e', size: r * 0.6, speed: 120, up: 260, twirl: 24, life: 2.6 });
      this.spray(game, x, y, 5, { shape: 'rod', color: '#140c14', size: r * 0.3, speed: 200, up: 200, twirl: 18, life: 2.2 });
      this.stain(game, x, y, r * 1.4, '#4a0f16', 6);
      game.effects.push(new DeathSplat(x, y, r, e.fill, false));
    },

    lavaball(e, game, x, y, r) {
      this.spray(game, x, y, 8, { shape: 'gob', color: '#e0562d', size: r * 0.28, speed: 180, up: 200 });
      this.spray(game, x, y, 4, { shape: 'gob', color: '#e8c33a', size: r * 0.18, speed: 200, up: 220 });
      this.dust(game, x, y, r, 5, '#cfcfcf');           // steam
    },
    boltshot(e, game, x, y, r) {
      this.spray(game, x, y, 5, { shape: 'shard', color: '#dfe6ff', ink: '#8ea6ff', size: r * 0.3, speed: 220, up: 120, life: 0.9 });
    },
    eagle(e, game, x, y, r) {                           // EagleAscend is the show; a few feathers of light
      this.spray(game, x, y, 8, { shape: 'shard', color: '#dfe6ff', ink: '#8ea6ff', size: r * 0.18, speed: 200, up: 200, life: 1.6 });
    }
  }
};
