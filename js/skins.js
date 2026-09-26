/* FANDHARN - skins. Bought with coins, kept in the save.

   A skin changes how something LOOKS and what it is called - never what it
   does. Every skin maps one or more targets ('cursor:storm', later perhaps
   'sentry:stick') to a look; a skin that covers several targets at once is a
   pack. Damage, timing, reach and every other number go through exactly the
   same code whichever look is worn: the Star Caller's star and meteor call
   the same strike function the Storm Caller's bolts do. */

const SKINS = [
  {
    id: 'starcaller', name: 'Star Caller', price: 4, color: '#e8a93a',
    blurb: 'The Storm Caller, looking up instead of out.',
    applies: {
      'cursor:storm': {
        name: 'Star Caller', color: '#e8a93a', sprite: 'star', card: 'spiky',
        power: 'star', payload: 'meteor',
        desc: 'Every 15 clicks a star comes down.',
        detail: '2 a click. A star lights up over a random enemy and falls, shrinking as it drops, and half a second later it lands for 50% of your click damage, splashing 4 into everything within a block. The Thunder Eagle still shrugs all of it off.',
        skillName: 'METEOR CALLER',   // the skill is a meteor; everything else stays Star Caller
        skillBlurb: 'the sky goes white and one enormous meteor comes down on the castle'
      }
    }
  },

  {
    id: 'cryo', name: 'Cryo Rain', price: 6, color: '#5fa8e0',
    blurb: 'The Wet Cursor, left out overnight.',
    applies: {
      'cursor:wet': {
        name: 'Cryo Rain', color: '#5fa8e0', sprite: 'cryo', card: 'cryo', power: 'ice', payload: 'hail',
        desc: 'Every 15 clicks it throws 6 shards of ice.',
        detail: '2.5 a click. Each shard hops one block in one of 9 random directions and shatters for 3 damage, freezing the ground where it lands.',
        skillName: 'HAILSTORM',
        skillBlurb: 'a frozen cloud rolls over the page and hail comes down on everything'
      }
    }
  },

  {
    id: 'moleman', name: 'Moleman', price: 4, color: '#8a6a52',
    blurb: 'The Trapper, but a mole with a drill.',
    applies: {
      'sentry:trapper': {
        name: 'Moleman', color: '#8a6a52', sprite: 'mole',
        desc: 'A mole with a drill takes the sentry post.',
        detail: 'He does nothing until something walks inside 4.5 blocks, then drills down, tunnels under it, bursts up drill-first for 6 damage, a stun and a two-block knockback, dives back in and comes up again by the castle. Buy him again while he holds the post and he hits 1 harder, up to 10.'
      }
    }
  },

  /* A pack is not bought: it is won, and comes whole. Its card in the shop
     opens settings to switch each skin in it on or off. */
  {
    id: 'thunder', name: 'Thunder Pack', pack: true, color: '#6f86d8', unlock: 'hardwin',
    blurb: 'The Sledgehammer and the Stick Sentry, both struck by lightning.',
    skins: ['mjolnir', 'zeus'], applies: {}
  },
  {
    id: 'mjolnir', inPack: 'thunder', name: 'Mjolnir', color: '#6f86d8',
    applies: {
      'cursor:hammer': {
        name: 'Mjolnir', color: '#6f86d8', sprite: 'mjolnir', slam: 'lightning', payload: 'thunder',
        desc: 'Hold it up. Let go and the sky comes down with it.',
        detail: 'A click does nothing. Hold for at least 0.4s and let go: lightning follows it down onto everything within a block and a half for 10 each. Every full second more you hold adds 20% - and at three seconds it comes down by itself, at +40%.',
        skillName: 'THUNDERFALL',
        skillBlurb: 'a storm gathers over the castle and one bolt splits the ground open'
      }
    }
  },
  {
    id: 'zeus', inPack: 'thunder', name: 'Zeus', color: '#e8c33a',
    applies: {
      'sentry:stick': {
        name: 'Zeus', color: '#e8c33a', shot: 'bolt',
        desc: 'A stick figure with a thunderbolt takes the sentry post.',
        detail: 'Zeus stands by the castle and hurls a thunderbolt at the nearest enemy every 1.6s for 3 damage. There is only one post, so taking this evicts whatever was standing in it.'
      }
    }
  }
];

function skinById(id) { return SKINS.find(s => s.id === id) || null; }

/* The look worn by a target, or null when it is wearing its own. */
function skinLook(target) {
  const id = Save.wornBy(target);
  const skin = id ? skinById(id) : null;
  return skin && Save.owns(skin.id) ? skin.applies[target] || null : null;
}

/* A cursor as the player sees it: its own fields, with whatever the worn
   skin renames or redraws laid over the top. The numbers are never touched. */
function cursorLook(id) {
  const c = cursorById(id);
  const s = skinLook('cursor:' + c.id);
  if (!s) return Object.assign({ sprite: c.id, skinned: false }, c);
  return Object.assign({}, c, {
    name: s.name, color: s.color, desc: s.desc || c.desc, detail: s.detail || c.detail,
    sprite: s.sprite || c.id, card: s.card, power: s.power, payload: s.payload, slam: s.slam, skinned: true
  });
}

/* A sentry's worn look ('stick', 'bird', ...), or null. */
function sentryLook(type) { return skinLook('sentry:' + type); }

function skillLook(cursorId) {
  const base = skillFor(cursorId);
  const s = skinLook('cursor:' + cursorId);
  if (!s || !s.skillName) return base;
  return { name: s.skillName, blurb: s.skillBlurb || base.blurb };
}

/* ------------------------------------------------------------ the sprite */

/* A five-point star with one point on the hotspot, and a little twinkle
   trailing off it. */
CursorSprites.star = function (ctx, x, y, s, color, t) {
  const cx = x + 9 * s, cy = y + 11 * s, R = 12 * s, r = 5 * s;
  const spin = -Math.PI * 0.78;                  // one point aimed at the hotspot
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = spin + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  Rough.bloom(ctx, cx, cy, 20 * s, '#ffd24a', 0.35 + Math.sin(t * 4) * 0.1);
  Rough.scribble(ctx, pts, { color, spacing: 3.5, width: 3.5, overflow: 1.12, alpha: 0.95 });
  Rough.scribble(ctx, pts, { color: '#ffe79a', spacing: 6, width: 2.5, overflow: 1, alpha: 0.6, angle: 0.7 });
  Rough.poly(ctx, pts, { color: '#6b4a12', width: 1.9, jitter: 0.6 });
  // twinkles
  for (let i = 0; i < 2; i++) {
    const tw = (Math.sin(t * 5 + i * 2.3) * 0.5 + 0.5);
    const tx = x + (20 + i * 7) * s, ty = y + (22 + i * 5) * s, k = (2 + tw * 2.2) * s;
    Rough.line(ctx, tx - k, ty, tx + k, ty, { color: '#e8a93a', width: 1.6, jitter: 0.3, passes: 1, alpha: 0.4 + tw * 0.6 });
    Rough.line(ctx, tx, ty - k, tx, ty + k, { color: '#e8a93a', width: 1.6, jitter: 0.3, passes: 1, alpha: 0.4 + tw * 0.6 });
  }
};

/* A star outline as a list of points - shared by the cursor, the falling
   stars and the card border. */
function starPts(cx, cy, R, r, spin, n) {
  n = n || 5;
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = spin + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

function drawStar(ctx, cx, cy, R, spin, alpha, fill) {
  const pts = starPts(cx, cy, R, R * 0.45, spin);
  Rough.scribble(ctx, pts, { color: fill || '#f2c230', spacing: Math.max(3, R * 0.22), width: Math.max(2.5, R * 0.2), overflow: 1.1, alpha: 0.95 * alpha });
  Rough.poly(ctx, pts, { color: '#6b4a12', width: Math.max(1.6, R * 0.09), jitter: 0.7, alpha });
}

/* ------------------------------------------------- the cursor's own power */

/* Where the Storm Caller gathers a cloud, the Star Caller lights a star high
   over the target. It falls for the same half-second the cloud waits,
   shrinking as it comes, and lands with the very same strike. */
class FallingStar {
  constructor(x, y, game, damage, splashRadius, splashDamage) {
    this.id = nextId();
    this.tx = x; this.ty = y;
    this.t = 0; this.fired = false;
    this.damage = damage; this.splashRadius = splashRadius; this.splashDamage = splashDamage;
    this.from = { x: x + 60 + Math.random() * 50, y: y - 190 };
    this.spin = Math.random() * 6;
    Sfx.play('star_fall', { volume: 0.55, throttle: 60 });
  }
  update(dt, game) {
    this.t += dt;
    if (!this.fired && this.t >= 0.5) {           // the same half-second of warning
      this.fired = true;
      stormHit(game, this.tx, this.ty, this.damage, 16, { radius: this.splashRadius, damage: this.splashDamage });
      game.effects.push(new StarBurst(this.tx, this.ty, this.splashRadius, game));
      game.shake(8);
      Sfx.play('star_hit', { volume: 0.8, throttle: 40, voices: 6 });
      return false;
    }
    return true;
  }
  draw(ctx, time) {
    const k = Math.min(1, this.t / 0.5);
    const e = k * k;                              // it accelerates in
    const x = this.from.x + (this.tx - this.from.x) * e;
    const y = this.from.y + (this.ty - this.from.y) * e;
    const R = 34 - 26 * k;                        // big up there, small when it lands
    Rough.boil(this.id, Math.floor(time * 12));
    // where it will land
    Rough.circle(ctx, this.tx, this.ty, this.splashRadius * (1.1 - k * 0.3),
      { color: '#e8a93a', width: 2, jitter: 1.6, wobble: 3, alpha: 0.25 + k * 0.4 });
    // the trail it drags
    for (let i = 1; i <= 5; i++) {
      const b = Math.max(0, k - i * 0.06), eb = b * b;
      const px = this.from.x + (this.tx - this.from.x) * eb, py = this.from.y + (this.ty - this.from.y) * eb;
      Rough.line(ctx, px, py, x, y, { color: i % 2 ? '#ffd24a' : '#fff4c8', width: 5 - i * 0.7, jitter: 1.4, passes: 1, alpha: 0.5 - i * 0.07 });
    }
    Rough.bloom(ctx, x, y, R * 2.4, '#ffd24a', 0.7);
    drawStar(ctx, x, y, R, this.spin + time * 5, 1);
  }
}

/* The star landing: a burst of light, a ring out to the splash, and shards. */
class StarBurst {
  constructor(x, y, radius, game) {
    this.id = nextId(); this.x = x; this.y = y; this.radius = radius;
    this.t = 0; this.dur = 0.55;
    this.shards = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
      this.shards.push({ a, sp: 60 + Math.random() * 70, spin: Math.random() * 6 });
    }
    for (let i = 0; i < Fx.n(8); i++) game.effects.push(new Crumb(x, y, i % 2 ? '#ffd24a' : '#fff4c8'));
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const p = this.t / this.dur, o = E.out(p);
    Rough.boil(this.id, 0);
    Rough.bloom(ctx, this.x, this.y, 30 + o * this.radius * 2, '#ffd24a', (1 - p) * 0.9);
    Rough.bloom(ctx, this.x, this.y, 16 + o * 20, '#ffffff', (1 - p) * 0.8);
    Rough.circle(ctx, this.x, this.y, 8 + o * this.radius, { color: '#e8a93a', width: 3, jitter: 2, wobble: 2.5, alpha: (1 - o) * 0.9 });
    for (const s of this.shards) {
      const d = 8 + s.sp * o * 0.6;
      drawStar(ctx, this.x + Math.cos(s.a) * d, this.y + Math.sin(s.a) * d, 5 * (1 - p) + 1, s.spin + p * 6, 1 - p);
    }
  }
}

/* ------------------------------------------------ the skill: METEOR CALLER */

/* The white-out and the meteor. The meteor comes down on the castle; the
   blast rolls out from it and strikes each target the THUNDERHEAD would have
   struck, with the THUNDERHEAD's own numbers, as the ring reaches it. */
class Meteor {
  constructor(game, hits, reach) {
    this.id = nextId();
    this.game = game;
    this.hits = hits;                 // [{x, y, damage, at}] - at: distance from the castle
    this.t = 0; this.fall = 0.8;          // long enough to actually watch it come
    this.ringSpeed = 900;
    this.landed = false;
    // from just inside the top-left of the page, so the whole fall is on screen
    this.from = { x: -game.w * 0.36, y: -game.h * 0.44 };
    this.R = 100;                     // enormous, as asked
    this.reach = Math.max(reach, ...hits.map(h => h.at), 200);
    this.dur = this.fall + this.reach / this.ringSpeed + 1.1;
    // the night it comes out of, a few stars in it
    this.sky = [];
    for (let i = 0; i < 26; i++) this.sky.push({ x: (Math.random() - 0.5) * game.w, y: (Math.random() - 0.5) * game.h, ph: Math.random() * 6, s: 2 + Math.random() * 3 });
    // glowing cracks across the rock's face, in its own frame
    this.cracks = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, pts = [[Math.cos(a) * 20, Math.sin(a) * 20]];
      let px = pts[0][0], py = pts[0][1];
      for (let k = 0; k < 3; k++) { px += Math.cos(a + Rough.jit(0.8)) * 22; py += Math.sin(a + Rough.jit(0.8)) * 22; pts.push([px, py]); }
      this.cracks.push(pts);
    }
    this.smoke = []; this.embers = []; this.sparks = [];
    Sfx.play('sk_starfall', { volume: 1, rateVar: 0 });
  }
  pos(k) {
    const e = Math.pow(k, 1.6);
    return { x: this.from.x * (1 - e), y: this.from.y * (1 - e) };
  }
  update(dt, game) {
    this.t += dt;
    if (!this.landed) {
      // smoke and embers shed off it as it comes
      const k = Math.min(1, this.t / this.fall), p = this.pos(k);
      const back = Math.atan2(this.from.y, this.from.x);
      if (!Fx.low || Math.random() < 0.4) {
        this.smoke.push({ x: p.x + Rough.jit(30), y: p.y + Rough.jit(30), vx: Math.cos(back) * 60, vy: Math.sin(back) * 60, r: 26 + Math.random() * 20, life: 0.7 });
        for (let i = 0; i < 3; i++) {
          const a = back + Rough.jit(0.9);
          this.embers.push({ x: p.x + Rough.jit(40), y: p.y + Rough.jit(40), vx: Math.cos(a) * (160 + Math.random() * 200), vy: Math.sin(a) * (160 + Math.random() * 200), life: 0.45 });
        }
      }
    }
    for (const list of [this.smoke, this.embers, this.sparks]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.r) q.r += dt * 50;
        if (q.spin != null) { q.spin += dt * 6; q.vx *= 1 - dt * 1.6; q.vy *= 1 - dt * 1.6; }
        if (q.life <= 0) list.splice(i, 1);
      }
    }
    if (!this.landed && this.t >= this.fall) {
      this.landed = true;
      game.shake(26);
      game.effects.push(new MeteorCrater(game));
      for (let i = 0; i < Fx.n(26); i++) {
        const c = new Crumb(Rough.jit(40), Rough.jit(30), i % 3 === 0 ? '#2b2b2b' : (i % 3 === 1 ? '#e0562d' : '#ffd24a'));
        c.size += 3; game.effects.push(c);
      }
      if (typeof Chunk !== 'undefined') {
        for (let i = 0; i < Fx.n(16); i++) {
          game.effects.push(new Chunk(Rough.jit(30), Rough.jit(20), { shape: 'gob', color: '#3a2418', ink: '#1a0c08', size: 6 + Math.random() * 5, speed: 320, up: 420, life: 1.4 }));
        }
        if (!Fx.low) for (let i = 0; i < 10; i++) game.effects.push(new Dust(Rough.jit(60), Rough.jit(40), 90, '#5a4a5a'));
      }
      for (let i = 0; i < Fx.n(12); i++) game.effects.push(new Droplet(0, 0, '#e0562d', 2.2));
      // little gold stars thrown out of the blast - it came from the sky, after all
      for (let i = 0; i < Fx.n(18); i++) {
        const a = Math.random() * Math.PI * 2, v = 300 + Math.random() * 420;
        this.sparks.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + Math.random() * 0.4, spin: Math.random() * 6, s: 6 + Math.random() * 6 });
      }
      this.arcs = [];
      let a = Math.random();
      while (a < Math.PI * 2 + 0.2) {
        const len = 0.22 + Math.random() * 0.3;
        this.arcs.push({ a0: a, a1: a + len, off: Rough.jit(8), w: 4 + Math.random() * 4 });
        a += len + 0.05 + Math.random() * 0.08;
      }
    }
    if (this.landed) {
      const ring = (this.t - this.fall) * this.ringSpeed;
      for (const h of this.hits) {
        if (h.done || h.at > ring) continue;
        h.done = true;
        stormHit(game, h.x, h.y, h.damage, 16, null);
        game.effects.push(new StarBurst(h.x, h.y, 26, game));
      }
    }
    return this.t < this.dur;
  }
  drawBits(ctx) {
    for (const s of this.smoke) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life / 0.7) * 0.35;
      ctx.fillStyle = '#4a3a4a';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      ctx.restore();
    }
    for (const e of this.embers) {
      const a = Math.max(0, e.life / 0.45);
      Rough.line(ctx, e.x, e.y, e.x - e.vx * 0.03, e.y - e.vy * 0.03, { color: a > 0.5 ? '#ffd24a' : '#e0562d', width: 2.4, jitter: 0.3, passes: 1, alpha: a });
    }
    for (const s of this.sparks) {
      const a = Math.min(1, s.life / 0.5);
      drawStar(ctx, s.x, s.y, s.s * (0.6 + a * 0.4), s.spin, a);
    }
  }
  draw(ctx, time) {
    const g = this.game, w = g.w, h = g.h;
    Rough.boil(this.id, Math.floor(time * 14));
    if (!this.landed) {
      const k = Math.min(1, this.t / this.fall);
      const { x, y } = this.pos(k);
      // the page goes to night under it, stars coming out
      ctx.save();
      ctx.globalAlpha = 0.3 * k;
      ctx.fillStyle = '#1a1b3a';
      ctx.fillRect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
      ctx.restore();
      for (const st of this.sky) {
        const tw = 0.5 + Math.sin(time * 5 + st.ph) * 0.5;
        Rough.line(ctx, st.x - st.s, st.y, st.x + st.s, st.y, { color: '#fff4c8', width: 1.4, jitter: 0.2, passes: 1, alpha: k * tw });
        Rough.line(ctx, st.x, st.y - st.s, st.x, st.y + st.s, { color: '#fff4c8', width: 1.4, jitter: 0.2, passes: 1, alpha: k * tw });
      }
      // where it will land: its shadow swelling, and a gold ring closing in
      ctx.save();
      ctx.globalAlpha = 0.15 + k * 0.35;
      ctx.fillStyle = '#1a1020';
      ctx.beginPath(); ctx.ellipse(0, 10, this.R * (0.4 + k * 1.1), this.R * (0.25 + k * 0.6), 0, 0, 7); ctx.fill();
      ctx.restore();
      const rr = this.R * (2.6 - k * 1.4);
      Rough.circle(ctx, 0, 0, rr, { color: '#ffd24a', width: 3, jitter: 1, wobble: 2, passes: 1, alpha: 0.4 + k * 0.5 });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + time * 1.5;
        drawStar(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 9, time * 3, 0.5 + k * 0.5);
      }
      this.drawBits(ctx);
      // the tail: a tapering cone of fire back along its path
      const back = Math.atan2(this.from.y - y, this.from.x - x);
      const px = -Math.sin(back), py = Math.cos(back);
      const s = 0.75 + k * 0.25, R = this.R * s;
      for (const [len, wid, col, al] of [[5.5, 1.0, '#7a1f1f', 0.5], [4.6, 0.85, '#e0562d', 0.7], [3.4, 0.6, '#ffb347', 0.8], [2.2, 0.35, '#fff4c8', 0.9]]) {
        const tip = [x + Math.cos(back) * R * len, y + Math.sin(back) * R * len];
        const cone = [[x + px * R * wid, y + py * R * wid], tip, [x - px * R * wid, y - py * R * wid]];
        Rough.scribble(ctx, cone, { color: col, spacing: 9, width: 7, overflow: 1.02, alpha: al, angle: back + 0.3 });
      }
      Rough.bloom(ctx, x, y, R * 3, '#ff9a3d', 0.9);
      // the rock, turning as it falls, cracked through with fire
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(this.t * 1.4);
      const pts = Rough.noisyRing(0, 0, this.R, this.id, 18, 0.18);
      ctx.fillStyle = '#2e1c14';
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
      Rough.scribble(ctx, pts, { color: '#5a3424', spacing: 10, width: 6, overflow: 0.95, alpha: 0.8, angle: 0.8 });
      for (const c of this.cracks) {
        Rough.poly(ctx, c, { color: '#e0562d', width: 7, jitter: 1, closed: false, passes: 1, alpha: 0.7 });
        Rough.poly(ctx, c, { color: '#ffd24a', width: 3, jitter: 0.8, closed: false, passes: 1 });
      }
      Rough.poly(ctx, pts, { color: '#1a0c08', width: 4, jitter: 2 });
      ctx.restore();
      // the face it is falling on white-hot
      const fwd = back + Math.PI;
      Rough.arc(ctx, x, y, R * 0.98, fwd - 1.1, fwd + 1.1, { color: '#ffd24a', width: 12, jitter: 2, passes: 1, alpha: 0.7 });
      Rough.arc(ctx, x, y, R * 0.96, fwd - 0.8, fwd + 0.8, { color: '#fff4c8', width: 5, jitter: 1.5, passes: 1 });
      return;
    }
    const since = this.t - this.fall;
    const ring = since * this.ringSpeed;
    const fade = Math.max(0, 1 - since / (this.dur - this.fall));
    // the white-out: the whole page, for a moment
    const white = Math.max(0, 1 - since / 0.35);
    if (white > 0) {
      ctx.save();
      ctx.globalAlpha = white * 0.92;
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(-g.w, -g.h, g.w * 2, g.h * 2);
      ctx.restore();
    }
    Rough.bloom(ctx, 0, 0, 160 + since * 500, '#ffd24a', fade * 0.9);
    Rough.bloom(ctx, 0, 0, 90 + since * 160, '#ffffff', fade * 0.8);
    // the blast rolling out: a warm band behind a broken ink edge
    if (ring < this.reach + 200) {
      ctx.save();
      ctx.globalAlpha = 0.3 * fade;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 34;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1, ring - 20), 0, 7); ctx.stroke();
      ctx.restore();
      for (const ar of this.arcs) {
        Rough.arc(ctx, 0, 0, ring + ar.off, ar.a0, ar.a1, { color: '#e0562d', width: ar.w + 3, jitter: 1, passes: 1, alpha: 0.6 * fade });
        Rough.arc(ctx, 0, 0, ring + ar.off, ar.a0, ar.a1, { color: '#2b2b2b', width: ar.w * 0.5, jitter: 0.8, passes: 1, alpha: 0.85 * fade });
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + this.id;
      const r0 = this.R * 0.9 + since * 140, r1 = r0 + 70 + since * 280;
      Rough.line(ctx, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1,
        { color: i % 2 ? '#ffd24a' : '#fff4c8', width: 4, jitter: 1.5, passes: 1, alpha: fade * 0.7 });
    }
    this.drawBits(ctx);
  }
}

/* What the meteor leaves round the castle: scorched ground in a ring, and
   cracks glowing with heat that cool from orange to black. Under everything. */
class MeteorCrater {
  constructor(game) {
    this.id = nextId(); this.under = true; this.game = game;
    this.life = this.max = 3.6;
    const r0 = game.castleRadius * 1.3;
    this.burns = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, d = r0 + Math.random() * r0 * 0.9;
      this.burns.push({ a, d, len: 10 + Math.random() * 28 });
    }
    this.cracks = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const pts = [[Math.cos(a) * r0, Math.sin(a) * r0]];
      let px = pts[0][0], py = pts[0][1];
      for (let k = 0; k < 5; k++) { const aa = a + Rough.jit(0.5); px += Math.cos(aa) * 26; py += Math.sin(aa) * 26; pts.push([px, py]); }
      this.cracks.push(pts);
    }
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const age = 1 - this.life / this.max;
    const a = age < 0.6 ? 1 : 1 - (age - 0.6) / 0.4;
    const heat = Math.max(0, 1 - age * 1.6);           // orange, cooling to black
    Rough.boil(this.id, 0);
    for (const b of this.burns) {
      const c = Math.cos(b.a), s = Math.sin(b.a);
      Rough.line(ctx, c * b.d, s * b.d, c * (b.d + b.len), s * (b.d + b.len), { color: '#2e1c14', width: 4, jitter: 1, passes: 1, alpha: 0.45 * a });
    }
    for (const c of this.cracks) {
      Rough.poly(ctx, c, { color: '#1a0c08', width: 4, jitter: 0.6, closed: false, passes: 1, alpha: 0.8 * a });
      if (heat > 0) {
        Rough.poly(ctx, c, { color: heat > 0.5 ? '#ffd24a' : '#e0562d', width: 2, jitter: 0.4, closed: false, passes: 1, alpha: heat * a });
        if (!Fx.low) Rough.bloom(ctx, c[c.length - 1][0], c[c.length - 1][1], 30, '#e0562d', heat * 0.6);
      }
    }
  }
}

/* Shooting stars streaking across the page for the length of the cast, in
   place of the THUNDERHEAD's rain. */
class StarShower {
  constructor(game, dur) {
    this.id = nextId(); this.game = game;
    this.t = 0; this.dur = dur;
    this.stars = [];
    for (let i = 0; i < Fx.n(14); i++) this.stars.push(this.spawn(Math.random()));
  }
  spawn(age) {
    const g = this.game;
    return { x: (Math.random() - 0.3) * g.w, y: -g.h / 2 - Math.random() * g.h * 0.3,
      vx: -260 - Math.random() * 200, vy: 380 + Math.random() * 260, life: 0.5 + Math.random() * 0.5, age: age * 0.8 };
  }
  update(dt) {
    this.t += dt;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age > s.life && this.t < this.dur - 0.6) this.stars[i] = this.spawn(0);
    }
    return this.t < this.dur;
  }
  draw(ctx) {
    const fade = Math.min(1, this.t / 0.3) * Math.max(0, Math.min(1, (this.dur - this.t) / 0.5));
    for (const s of this.stars) {
      const a = Math.max(0, 1 - s.age / s.life) * fade;
      if (a <= 0) continue;
      Rough.line(ctx, s.x, s.y, s.x - s.vx * 0.09, s.y - s.vy * 0.09, { color: '#ffd24a', width: 2.4, jitter: 0.6, passes: 1, alpha: a * 0.8 });
      Rough.bloom(ctx, s.x, s.y, 10, '#ffd24a', a * 0.7);
    }
  }
}

/* ------------------------------------------------ the offer card's border */

/* A spiky star-burst outline around a card, for a skinned cursor's offer. */
function spikyOutline(c, jit) {
  const pts = [];
  const spike = 7, step = 16;
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const u = i / n, v = (i + 0.5) / n;
      pts.push([x0 + (x1 - x0) * u + Rough.jit(jit), y0 + (y1 - y0) * u + Rough.jit(jit)]);
      pts.push([x0 + (x1 - x0) * v + nx * spike + Rough.jit(jit), y0 + (y1 - y0) * v + ny * spike + Rough.jit(jit)]);
    }
  };
  edge(c.x, c.y, c.x + c.w, c.y, 0, -1);
  edge(c.x + c.w, c.y, c.x + c.w, c.y + c.h, 1, 0);
  edge(c.x + c.w, c.y + c.h, c.x, c.y + c.h, 0, 1);
  edge(c.x, c.y + c.h, c.x, c.y, -1, 0);
  return pts;
}
