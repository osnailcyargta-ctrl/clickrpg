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
    this.cursor = cursorLook(cursorId);      // a skin renames and recolours the cast
    this.skill = skillLook(cursorId);
    this.wx = wx; this.wy = wy;
    this.t = 0;
    this.windup = 0.95;            // page darkens, time drags, name slams
    this.freezeUntil = 2.4;        // enemies do not move at all until here
    this.payloadFired = false;
    this.dur = 3.6;                // the whole cast, including the tail
    this.flash = 0;
    this.rays = [];
    for (let i = 0; i < 34; i++) {
      this.rays.push({ a: Math.random() * Math.PI * 2, d: 0.55 + Math.random() * 0.8, w: 1 + Math.random() * 3.2 });
    }
    this.shock = [];               // rings thrown off the moment it lands
    this.motes = [];               // paper flecks sucked into the charge
    for (let i = 0; i < 34; i++) {
      this.motes.push({ a: Math.random() * Math.PI * 2, d: 0.3 + Math.random() * 0.9, spin: Math.random() * 6, size: 2 + Math.random() * 4 });
    }
    this.runes = [];               // the ring of marks that winds the charge up
    for (let i = 0; i < 12; i++) {
      this.runes.push({ a: (i / 12) * Math.PI * 2, kind: Math.floor(Math.random() * 3), seed: nextId() });
    }
    this.streaks = [];             // speed lines that stay through the payload
    for (let i = 0; i < 18; i++) {
      this.streaks.push({ a: Math.random() * Math.PI * 2, d: 0.4 + Math.random() * 0.7, len: 0.1 + Math.random() * 0.22, w: 1 + Math.random() * 2.4 });
    }
  }

  /* How much the world is slowed while this plays. */
  get timeScale() {
    if (this.t < this.windup) return 0.18 + 0.45 * (this.t / this.windup);
    const after = (this.t - this.windup) / 0.7;
    return Math.min(1, 0.63 + after * 0.5);
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.22);
    if (!this.payloadFired && this.t >= this.windup) {
      this.payloadFired = true;
      this.flash = 1;
      for (let i = 0; i < 2; i++) this.shock.push({ born: this.t + i * 0.09 });
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
    const lean = Depth.off(Depth.ACTORS);          // drawn where the world is, on screen
    const cx = w / 2 + this.wx + lean.x, cy = h / 2 + this.wy + lean.y;
    const col = this.cursor.color;

    // darkness comes in fast and lifts slowly
    const dark = p < this.windup
      ? E.out(wind) * 0.78
      : Math.max(0, 0.78 - E.out((p - this.windup) / (this.dur - this.windup)) * 0.78);

    if (dark > 0.01) {
      ctx.save();
      ctx.globalAlpha = dark;
      ctx.fillStyle = '#141018';
      ctx.fillRect(0, 0, w, h);
      const hole = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.45);
      hole.addColorStop(0, 'rgba(20,16,24,1)');
      hole.addColorStop(0.55, 'rgba(20,16,24,0.45)');
      hole.addColorStop(1, 'rgba(20,16,24,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = hole;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.45, 0, 7); ctx.fill();
      ctx.restore();
    }

    // a wash in the cursor's own colour, so each skill tints the page
    const wash = p < this.windup ? wind * 0.17 : Math.max(0, 0.17 - (p - this.windup) * 0.4);
    if (wash > 0.01) {
      ctx.save();
      ctx.globalAlpha = wash;
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // darkened edges, so the middle of the page is the only thing to look at
    Rough.vignette(ctx, w, h, dark * 0.9, 'rgba(16,12,20,0.96)');

    // the corner of the page curling up as the charge pulls on it
    const curl = p < this.windup ? E.out(wind) : Math.max(0, 1 - (p - this.windup) / 0.8);
    if (curl > 0.02) {
      ctx.save();
      ctx.globalAlpha = curl * 0.5;
      for (const c of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) {
        const lift = 30 + curl * 46;
        Rough.poly(ctx, [
          [c[0], c[1] + c[3] * lift],
          [c[0] + c[2] * lift * 0.55, c[1] + c[3] * lift * 0.55],
          [c[0] + c[2] * lift, c[1]]
        ], { color: col, width: 3, jitter: 3, closed: false });
      }
      ctx.restore();
    }

    // letterbox bars, drawn on with a crayon
    const bar = E.out(Math.min(1, p / 0.3)) * (p > this.dur - 0.5 ? E.clamp01((this.dur - p) / 0.5) : 1);
    if (bar > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = '#141018';
      const bh = h * 0.085 * bar;
      ctx.fillRect(0, 0, w, bh);
      ctx.fillRect(0, h - bh, w, bh);
      ctx.globalAlpha = 0.5 * bar;
      Rough.boil(this.id + 9, Math.floor(time * 4));
      Rough.line(ctx, 0, bh, w, bh, { color: col, width: 2.4, jitter: 2.2, passes: 1 });
      Rough.line(ctx, 0, h - bh, w, h - bh, { color: col, width: 2.4, jitter: 2.2, passes: 1 });
      ctx.restore();
    }

    // everything rushing inward during the wind-up
    if (p < this.windup + 0.35) {
      const k = E.clamp01(p / this.windup);
      ctx.save();
      Rough.boil(this.id, time * 6);
      for (const r of this.rays) {
        const far = Math.max(w, h) * r.d * (1 - k * 0.74);
        const near = far * 0.5;
        ctx.globalAlpha = (0.25 + k * 0.6) * (1 - E.clamp01((p - this.windup) / 0.35));
        Rough.line(ctx, cx + Math.cos(r.a) * far, cy + Math.sin(r.a) * far,
          cx + Math.cos(r.a) * near, cy + Math.sin(r.a) * near,
          { color: col, width: r.w, jitter: 2.6, passes: 1 });
      }
      // flecks of paper dragged in with them
      ctx.fillStyle = col;
      for (const m of this.motes) {
        const d = Math.max(w, h) * m.d * (1 - E.out(k));
        ctx.save();
        ctx.globalAlpha = (0.3 + k * 0.5) * (1 - E.clamp01((p - this.windup) / 0.3));
        ctx.translate(cx + Math.cos(m.a) * d, cy + Math.sin(m.a) * d);
        ctx.rotate(m.spin + k * 9);
        ctx.fillRect(-m.size / 2, -m.size / 2, m.size, m.size * 0.7);
        ctx.restore();
      }
      // a ring of marks winding in, spinning faster as it closes
      const spin = k * k * 7;
      const ringR = Math.min(w, h) * 0.3 * (1 - E.out(k) * 0.72);
      for (const rn of this.runes) {
        const a = rn.a + spin;
        const rx = cx + Math.cos(a) * ringR, ry = cy + Math.sin(a) * ringR;
        ctx.save();
        ctx.globalAlpha = (0.35 + k * 0.6) * (1 - E.clamp01((p - this.windup) / 0.3));
        Rough.boil(rn.seed, Math.floor(time * 8));
        const sz = 6 + k * 7;
        if (rn.kind === 0) Rough.circle(ctx, rx, ry, sz, { color: col, width: 2.4, jitter: 2, wobble: 2 });
        else if (rn.kind === 1) {
          Rough.line(ctx, rx - sz, ry - sz, rx + sz, ry + sz, { color: col, width: 2.4, jitter: 2, passes: 1 });
          Rough.line(ctx, rx + sz, ry - sz, rx - sz, ry + sz, { color: col, width: 2.4, jitter: 2, passes: 1 });
        } else {
          Rough.poly(ctx, [[rx - sz, ry + sz], [rx, ry - sz], [rx + sz, ry + sz]],
            { color: col, width: 2.4, jitter: 2 });
        }
        ctx.restore();
      }

      // the charge knot, wound tighter and tighter
      ctx.globalAlpha = 0.9 * (1 - E.clamp01((p - this.windup) / 0.3));
      const knot = 8 + E.back(k) * 34;
      Rough.bloom(ctx, cx, cy, knot * 3.2, col, 0.35 + k * 0.5);
      Rough.circle(ctx, cx, cy, knot, { color: col, width: 4, jitter: 3.4, wobble: 4 });
      Rough.circle(ctx, cx, cy, knot * 0.66, { color: '#fffdf4', width: 3, jitter: 2.4, wobble: 3 });
      Rough.circle(ctx, cx, cy, knot * 0.34, { color: col, width: 2.4, jitter: 1.8, wobble: 2 });
      ctx.restore();
    }

    // speed lines, still tearing past while the payload lands
    const sp = E.clamp01((p - this.windup * 0.6) / 0.4) * E.clamp01((this.windup + 1.5 - p) / 0.8);
    if (sp > 0.02) {
      ctx.save();
      Rough.boil(this.id + 61, Math.floor(time * 20));
      for (const st of this.streaks) {
        const far = Math.max(w, h) * st.d;
        const x1 = cx + Math.cos(st.a) * far, y1 = cy + Math.sin(st.a) * far;
        const x2 = cx + Math.cos(st.a) * far * (1 - st.len), y2 = cy + Math.sin(st.a) * far * (1 - st.len);
        ctx.globalAlpha = sp * 0.5;
        Rough.line(ctx, x1, y1, x2, y2, { color: col, width: st.w, jitter: 2, passes: 1 });
      }
      ctx.restore();
    }

    // shock rings thrown off the release
    for (const ring of this.shock) {
      const age = p - ring.born;
      if (age < 0 || age > 0.75) continue;
      const k = E.out(age / 0.75);
      ctx.save();
      const rr = 30 + k * Math.max(w, h) * 0.5;
      ctx.globalAlpha = (1 - k) * 0.45;
      Rough.boil(this.id + Math.floor(ring.born * 100), Math.floor(time * 12));
      Rough.circle(ctx, cx, cy, rr, { color: col, width: 4 * (1 - k) + 1, jitter: 3, wobble: 6 });
      ctx.restore();
      Rough.bloom(ctx, cx, cy, rr * 0.8, col, (1 - k) * 0.3);
      ctx.save();
      ctx.restore();
    }

    // the name: a shadow copy, then the thing itself, shaken on impact
    const nameIn = E.clamp01((p - this.windup * 0.42) / 0.26);
    if (nameIn > 0) {
      const gone = E.clamp01((p - this.windup - 1.0) / 0.5);
      const kick = p > this.windup && p < this.windup + 0.25
        ? (1 - (p - this.windup) / 0.25) : 0;
      ctx.save();
      ctx.globalAlpha = (1 - gone) * 0.97;
      ctx.translate(w / 2 + Rough.jit(6 * kick), h * 0.2 + gone * -34 + Rough.jit(5 * kick));
      const sc = 1 + (1 - E.back(nameIn)) * 1.1;
      ctx.scale(sc, sc);
      ctx.rotate((1 - E.out(nameIn)) * -0.16);
      Rough.boil(this.id + 3, time * 2);
      const size = Math.min(64, w * 0.105);
      ctx.save();
      ctx.globalAlpha = (1 - gone) * 0.4;
      Rough.text(ctx, this.skill.name, 5, 5, size, '#141018');
      ctx.restore();
      Rough.text(ctx, this.skill.name, 0, 0, size, col);
      Rough.line(ctx, -size * 2.5, size * 0.46, size * 2.5, size * 0.46,
        { color: col, width: 4.5, jitter: 3.2, passes: 2 });
      Rough.line(ctx, -size * 2.2, size * 0.58, size * 2.2, size * 0.58,
        { color: col, width: 2, jitter: 3, passes: 1 });
      ctx.globalAlpha = (1 - gone) * 0.6;
      Rough.text(ctx, this.skill.blurb, 0, size * 1.0, Math.min(16, w * 0.028), '#d9d3c4');
      ctx.restore();
    }

    if (this.flash > 0) {
      // one hard white frame, then a coloured after-flash: a hit you feel
      ctx.save();
      ctx.globalAlpha = this.flash > 0.72 ? 1 : this.flash * 0.85;
      ctx.fillStyle = this.flash > 0.72 ? '#ffffff' : '#fffdf4';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      Rough.bloom(ctx, cx, cy, Math.max(w, h) * 0.55, col, this.flash * 0.7);
    }
  }
}

/* ------------------------------------------------------------- payloads */
const SkillPayloads = {
  /* THUNDERHEAD - the sky opens over everything near the cursor and over the
     castle's ground. 125% of a click, 105% on a boss. */
  storm(game, cine) {
    const reach = BLOCK * 5;
    // flat floor plus a little scaling: tying this purely to click damage
    // made the softest-clicking cursor in the game carry the weakest ultimate
    const dmg = 10 + game.clickDamage() * 2;
    const bossDmg = dmg * 0.5;
    const targets = game.enemies.filter(e => !e.dead && (
      Math.hypot(e.x - cine.wx, e.y - cine.wy) <= reach ||
      Math.hypot(e.x, e.y) <= GROUND_RADIUS + e.r));

    // the Star Caller's METEOR CALLER: the same targets and the same numbers,
    // delivered by one meteor on the castle instead of a bolt apiece
    if (cursorLook('storm').payload === 'meteor') {
      const hits = targets.map(e => ({ x: e.x, y: e.y, damage: e.boss ? bossDmg : dmg, at: Math.hypot(e.x, e.y) }));
      const m = new Meteor(game, hits, reach);
      game.effects.push(m);
      game.effects.push(new StarShower(game, m.dur));
      return m.dur + 0.2;
    }

    game.effects.push(new StormFront(cine.wx, cine.wy, reach));
    game.effects.push(new StormRain(game, 1.9));
    Sfx.play('sk_thunderhead', { volume: 1, rateVar: 0 });

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
    game.effects.push(new PushRing(Math.max(BLOCK * 4, stop), game, 6));
    Sfx.play('sk_perimeter', { volume: 1, rateVar: 0 });
    return 1.8;
  },

  /* GUILLOTINE - the page is cut in two and the busier half is scrapped. */
  scissor(game, cine) {
    const above = game.enemies.filter(e => !e.dead && e.y < 0).length;
    const below = game.enemies.filter(e => !e.dead && e.y >= 0).length;
    const half = below >= above ? 1 : -1;        // +1 = the bottom goes
    game.effects.push(new Guillotine(half, 22, game));
    Sfx.play('sk_guillotine', { volume: 1, rateVar: 0 });
    return 1.6;
  },

  /* EIGHT WAYS - static out of the cursor down eight lines at once. */
  buzz(game, cine) {
    game.effects.push(new BuzzBeams(cine.wx, cine.wy, 12, game));
    Sfx.play('sk_eightways', { volume: 1, rateVar: 0 });
    return 1.1;
  },

  /* CLOUDBURST - the page floods. */
  wet(game, cine) {
    if (cursorLook('wet').payload === 'hail') {        // Cryo Rain: the same storm, as hail
      game.effects.push(new Hailstorm(game, 12));
      return 1.6;
    }
    game.effects.push(new Cloudburst(game, 12));
    Sfx.play('sk_cloudburst', { volume: 1, rateVar: 0 });
    return 1.6;
  },

  /* CROSSHATCH - the whole screen is hatched over, and the lines bite. */
  pen(game, cine) {
    game.effects.push(new Crosshatch(game, 16));
    Sfx.play('sk_crosshatch', { volume: 1, rateVar: 0 });
    return 1.5;
  },

  /* SECOND DRAFT - the page is scrubbed back and drawn again. Everything on
     it comes back permanently smaller, weaker and slower; the castle comes
     back with a segment mended. The only skill that heals. */
  eraser(game, cine) {
    game.effects.push(new SecondDraft(game, 0.35, 8));
    Sfx.play('sk_seconddraft', { volume: 1, rateVar: 0 });
    return 2.2;
  },

  /* POLE REVERSAL - haul the whole board into one heap, hold it, then flip
     and fling it. The more it gathered, the harder each one lands. */
  magnet(game, cine) {
    const pull = new MagnetPull(cine.wx, cine.wy, Math.max(game.w, game.h), 0, game, 0.75);
    game.effects.push(pull);
    cine.wx = pull.x; cine.wy = pull.y;        // the cast follows the heap
    Sfx.play('sk_polereversal', { volume: 1, rateVar: 0 });
    const caught = pull.caught;
    game.effects.push({
      t: 0,
      update(dt) {
        this.t += dt;
        if (this.t >= 0.85 && !this.done) {
          this.done = true;
          // gathering is the damage, but it cannot run away with itself
          const dmg = 8 + 1.5 * Math.min(10, caught.filter(c => !c.e.dead).length);
          game.effects.push(new MagnetBurst(cine.wx, cine.wy, caught, dmg, game));
          game.effects.push(new Flare(cine.wx, cine.wy, { color: '#7a5cc4', r: 80, dur: 0.6, rays: 18, motes: 14, rings: 3 }));
          Sfx.play('magnet_burst', { volume: 1, rateVar: 0 });
        }
        return this.t < 1.1;
      },
      draw() { }
    });
    return 2.0;
  },

  /* FLIGHT PATH - five of them, criss-crossing, none of them stopping. */
  boomerang(game, cine) {
    const reach = Math.max(game.w, game.h) * 0.42;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
      // two laps each, and the whole loop swings round as it goes, so the
      // second lap covers ground the first one missed
      const bm = new Boomerang(0, 0, a, reach * (0.7 + Math.random() * 0.45),
        game.aoeDamage(6), game, 2.4, 2);
      bm.drift = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.6);
      game.effects.push(bm);
    }
    Sfx.play('sk_flightpath', { volume: 1, rateVar: 0 });
    return 2.6;
  },

  /* EXCLAMATION - one enormous mark, slammed down where you point. */
  plain(game, cine) {
    game.effects.push(new ExclamationSlam(cine.wx, cine.wy, 45, game));
    Sfx.play('sk_exclamation', { volume: 1, rateVar: 0 });
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
    ctx.globalAlpha = (1 - out) * 0.82;
    for (const q of this.puffs) {
      Rough.boil(q.seed, Math.floor(time * 3));
      const y = q.y + (1 - inn) * -30;
      const lit = Math.sin(time * 13 + q.seed) > 0.82;   // the bank flickers from inside
      Rough.blob(ctx, q.x + q.drift * this.t, y, q.r * inn,
        lit ? '#8580ad' : '#544f75', '#332e4a',
        { spacing: 10, fillWidth: 6, fillAlpha: lit ? 0.7 : 0.5, sides: 10, width: 2.2 });
    }
    ctx.restore();
  }
}

/* Rain, for the whole length of the storm. */
class StormRain {
  constructor(game, dur) {
    this.id = nextId(); this.t = 0; this.dur = dur;
    this.drops = [];
    for (let i = 0; i < 120; i++) {
      this.drops.push({
        x: (Math.random() - 0.5) * game.w * 1.2,
        y: (Math.random() - 0.5) * game.h * 1.4,
        v: 900 + Math.random() * 700, len: 12 + Math.random() * 20
      });
    }
    this.h = game.h;
  }
  update(dt) {
    this.t += dt;
    for (const d of this.drops) {
      d.y += d.v * dt;
      if (d.y > this.h * 0.7) d.y -= this.h * 1.4;
    }
    return this.t < this.dur;
  }
  draw(ctx) {
    const fade = Math.min(E.clamp01(this.t / 0.3), E.clamp01((this.dur - this.t) / 0.5));
    ctx.save();
    ctx.globalAlpha = fade * 0.5;
    for (const d of this.drops) {
      Rough.line(ctx, d.x, d.y, d.x - 4, d.y - d.len, { color: '#8ea6ff', width: 1.6, jitter: 0.5, passes: 1 });
    }
    ctx.restore();
  }
}

/* What a Storm Caller strike does when it lands, and nothing else - no
   pictures. Every look the Storm Caller can wear (its own bolts, the Star
   Caller's stars and meteor) resolves its hit through this one function, so
   a skin can never change a number. Struck or splashed, never both. */
function stormHit(game, x, y, damage, radius, splash) {
  if (!(damage > 0) && !splash) return;
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= radius + e.r) {
      if (damage > 0) e.hurt(damage, game, { color: '#dfe6ff', source: 'storm' });
    } else if (splash && d <= splash.radius + e.r) {
      e.hurt(splash.damage, game, { color: '#9fb4ff', source: 'storm' });
    }
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
      stormHit(game, this.x, this.y, this.damage, this.radius, this.splash);
      game.effects.push(new ScorchMark(this.x, this.y, this.radius || 14));
      for (let i = 0; i < 16; i++) game.effects.push(new Ember(this.x, this.y, 22));
      for (let i = 0; i < 8; i++) game.effects.push(new Crumb(this.x, this.y, '#8ea6ff'));
      game.effects.push(new Splash(this.x, this.y, 30));
      game.shake(this.damage > 0 ? 11 : 6);
      if (!Fx.low) game.effects.push(new Flare(this.x, this.y, { color: '#8ea6ff', r: 30, dur: 0.35, rays: 7, motes: 5, rings: 1 }));
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
    ctx.restore();
    Rough.bloom(ctx, this.x, this.y, 60 + E.out(k) * 90, '#8ea6ff', a * 0.75);
    ctx.save();
    ctx.globalAlpha = a;
    // the ground lighting up under the hit
    ctx.globalAlpha = a * 0.85;
    Rough.circle(ctx, this.x, this.y, 10 + E.out(k) * 52, { color: '#dfe6ff', width: 4.5, jitter: 3.5 });
    Rough.circle(ctx, this.x, this.y, 4 + E.out(k) * 26, { color: '#ffffff', width: 3.4, jitter: 2.5 });
    // and a pool of light spilling across the paper
    ctx.globalAlpha = a * 0.4;
    const glow = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 70 + k * 40);
    glow.addColorStop(0, 'rgba(223,230,255,0.85)');
    glow.addColorStop(1, 'rgba(223,230,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(this.x, this.y, 70 + k * 40, 0, 7); ctx.fill();
    // splinters kicked off the point of impact
    ctx.globalAlpha = a * 0.7;
    for (let i = 0; i < 5; i++) {
      const sa = (i / 5) * Math.PI * 2 + k;
      Rough.line(ctx, this.x + Math.cos(sa) * 12, this.y + Math.sin(sa) * 12,
        this.x + Math.cos(sa) * (26 + k * 34), this.y + Math.sin(sa) * (26 + k * 34),
        { color: '#aebaff', width: 2.4, jitter: 3, passes: 1 });
    }
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
  constructor(target, game, damage) {
    this.id = nextId();
    this.target = target;
    this.damage = damage || 0;
    this.hit = new Set();
    this.t = 0; this.dur = 1.3;
    this.dust = [];
    for (let i = 0; i < 26; i++) {
      this.dust.push({ a: Math.random() * Math.PI * 2, at: Math.random() * 0.8, seed: nextId() });
    }
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
        if (this.damage > 0 && !this.hit.has(e.id)) {
          this.hit.add(e.id);
          e.hurt(this.damage, game, { color: '#8a5cc4' });
        }
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
    Rough.circle(ctx, 0, 0, r, { color: '#8a5cc4', width: 6, jitter: 3.5, wobble: 9 });
    Rough.circle(ctx, 0, 0, r * 0.97, { color: '#d9c8f2', width: 3, jitter: 3, wobble: 7 });
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.4;
    Rough.circle(ctx, 0, 0, r * 0.82, { color: '#8a5cc4', width: 2.4, jitter: 4, wobble: 8 });
    Rough.circle(ctx, 0, 0, r * 0.64, { color: '#8a5cc4', width: 1.8, jitter: 4, wobble: 7 });
    // the compass arm sweeping it round
    ctx.globalAlpha = Math.max(0, 1 - p);
    const a = p * Math.PI * 2.5;
    Rough.line(ctx, 0, 0, Math.cos(a) * r, Math.sin(a) * r, { color: '#8a5cc4', width: 3, jitter: 2, passes: 1 });
    Rough.circle(ctx, Math.cos(a) * r, Math.sin(a) * r, 7, { color: '#d9c8f2', width: 2.6, jitter: 1.6 });
    // dust kicked up where the line has already swept past
    for (const d of this.dust) {
      if (p < d.at) continue;
      const age = (p - d.at) / 0.4;
      if (age > 1) continue;
      Rough.boil(d.seed, Math.floor(time * 4));
      ctx.globalAlpha = (1 - age) * 0.45;
      const dr = this.target * (d.at + 0.06) * E.out(Math.min(1, (d.at + 0.06) / 1));
      Rough.circle(ctx, Math.cos(d.a) * dr, Math.sin(d.a) * dr, 6 + age * 20,
        { color: '#b8b2a3', width: 2, jitter: 3 });
    }
    ctx.restore();
  }
}

/* GUILLOTINE: the page cut in two, and one half scrapped. */
class Guillotine {
  constructor(half, damage, game) {
    this.id = nextId();
    this.half = half;                 // +1 bottom, -1 top
    this.damage = damage;
    this.t = 0; this.dur = 1.9;
    this.mark = 0.34;                 // the slash that picks a side lands here
    this.close = 0.5;                 // blades start closing
    this.cutAt = 0.95;
    this.cut = false;
    this.w = game.w; this.h = game.h;
  }
  update(dt, game) {
    const was = this.t;
    this.t += dt;
    if (was < this.mark && this.t >= this.mark) {
      Sfx.play('snip', { volume: 0.9, throttle: 0 });
      game.shake(7);
    }
    if (!this.cut && this.t >= this.cutAt) {
      this.cut = true;
      for (let i = 0; i < 26; i++) {
        const c = new Crumb((Math.random() - 0.5) * this.w, Rough.jit(10), '#e8e2d0');
        c.vy = Math.abs(c.vy) * this.half;
        game.effects.push(c);
      }
      for (const e of game.enemies) {
        if (e.dead) continue;
        if ((this.half > 0 && e.y >= 0) || (this.half < 0 && e.y < 0)) {
          e.hurt(this.damage, game, { color: '#c8433a' });
        }
      }
      game.effects.push(new SeamFlash(game, 0));
      game.shake(14);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const close = E.out(E.clamp01((this.t - this.close) / (this.cutAt - this.close)));
    const after = E.clamp01((this.t - this.cutAt) / (this.dur - this.cutAt));
    const halfW = this.w * 0.62;
    const top = this.half > 0 ? 0 : -this.h;

    ctx.save();
    Rough.boil(this.id, time);

    // the slash that calls the shot: one fast stroke, right to left, across
    // the half that is about to go
    const sw = E.clamp01(this.t / this.mark);
    if (this.t < this.mark + 0.5) {
      const y = this.half * this.h * 0.24;
      const headX = this.w * 0.6 - E.outQuint(sw) * this.w * 1.2;
      ctx.save();
      // the stroke itself
      ctx.globalAlpha = Math.min(1, 1 - (this.t - this.mark) / 0.5);
      Rough.line(ctx, Math.max(headX, -this.w * 0.6), y + this.h * 0.06,
        this.w * 0.6, y - this.h * 0.06, { color: '#c8433a', width: 7, jitter: 4, passes: 2 });
      // the head of it, still travelling
      if (sw < 1) {
        Rough.circle(ctx, headX, y + this.h * 0.06, 12, { color: '#ffffff', width: 4, jitter: 3 });
        Rough.circle(ctx, headX, y + this.h * 0.06, 22, { color: '#c8433a', width: 3, jitter: 4 });
      }
      // and the half it has claimed, tinted and hatched
      ctx.globalAlpha = Math.min(0.22, sw * 0.22) * Math.max(0, 1 - (this.t - this.mark) / 0.5);
      ctx.fillStyle = '#c8433a';
      ctx.fillRect(-this.w, top, this.w * 2, this.h);
      ctx.globalAlpha = Math.min(0.5, sw * 0.5) * Math.max(0, 1 - (this.t - this.mark) / 0.5);
      for (let i = 0; i < 9; i++) {
        const hy = top + (i + 0.5) * (this.h / 9);
        const reach = E.clamp01(sw * 1.6 - i * 0.05);
        Rough.line(ctx, this.w * 0.6, hy, this.w * 0.6 - reach * this.w * 1.2, hy + 14,
          { color: '#c8433a', width: 2, jitter: 3, passes: 1 });
      }
      ctx.restore();
    }

    // the blades sweeping in from both sides to meet on the centre line
    if (this.t > this.close && this.t < this.cutAt + 0.3) {
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
      Rough.line(ctx, -this.w, 0, this.w, 0, { color: '#c8433a', width: 6, jitter: 3, passes: 2 });
      // the torn edge of the half that is being thrown out
      const off = E.out(after) * 40 * this.half;
      ctx.globalAlpha = Math.max(0, 0.75 - after * 0.75);
      const torn = [];
      for (let x = -this.w; x <= this.w; x += 26) {
        torn.push([x, off + this.half * (5 + Math.abs(Rough.jit(7)))]);
      }
      Rough.poly(ctx, torn, { color: '#2b2b2b', width: 3.4, jitter: 2.4, closed: false });
      ctx.globalAlpha = Math.max(0, 0.3 - after * 0.3);
      ctx.fillStyle = '#141018';
      ctx.fillRect(-this.w, off, this.w * 2, this.half > 0 ? this.h : -this.h);
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
        if (!e.dead) e.stun = Math.max(e.stun, 0.8 + game.statusBonus());
      }
      game.effects.push(new Flare(this.x, this.y, { color: '#e8c33a', r: 60, dur: 0.5, rays: 16, motes: 10, rings: 2 }));
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
      Rough.circle(ctx, arc[1][0], arc[1][1], 10 + E.out(p) * 26, { color: '#e8c33a', width: 2.6, jitter: 3 });
    }
    Rough.circle(ctx, this.x, this.y, 12 + E.out(p) * 40, { color: '#fff6c2', width: 4, jitter: 3 });
    ctx.restore();
    Rough.bloom(ctx, this.x, this.y, 70 + E.out(p) * 120, '#e8c33a', (1 - p) * 0.6);
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

/* EXCLAMATION: one enormous mark, slammed down. */
class ExclamationSlam {
  constructor(x, y, damage, game) {
    this.id = nextId(); this.x = x; this.y = y; this.damage = damage;
    this.t = 0; this.dur = 1.2; this.hit = false;
    this.radius = BLOCK * 2;
  }
  update(dt, game) {
    this.t += dt;
    if (!this.hit && this.t >= 0.3) {
      this.hit = true;
      game.areaDamage(this.x, this.y, this.radius, this.damage, { color: '#2b2b2b' });
      game.shake(18);
      for (let i = 0; i < 18; i++) game.effects.push(new Crumb(this.x, this.y, '#2b2b2b'));
      game.effects.push(new Flare(this.x, this.y, { color: '#e0562d', r: this.radius * 0.8, dur: 0.55, rays: 16, motes: 12, rings: 3 }));
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
      Rough.circle(ctx, this.x, this.y, 16 + k * this.radius * 1.4, { color: '#2b2b2b', width: 4, jitter: 4, wobble: 5 });
      // dust punched out of the paper
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + k;
        Rough.line(ctx, this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 20,
          this.x + Math.cos(a) * (20 + k * this.radius), this.y + Math.sin(a) * (20 + k * this.radius),
          { color: '#8a8a8a', width: 2.4 * (1 - k) + 0.5, jitter: 3, passes: 1 });
      }
      ctx.restore();
    }
  }
}
