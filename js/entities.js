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
        Sfx.play('ink_splat', { volume: 0.7 });
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
      Sfx.play('warden_shield', { volume: 0.85 });
    }
  }

  draw(ctx, t) {
    Rough.boil(this.id, t + this.wobblePhase);
    // scale-in on spawn, squash on hit, and a walk bob of its own
    const grow = this.spawnT < 1 ? E.back(this.spawnT) : 1;
    const squash = 1 + E.pop(this.hitT) * 0.18;
    const bob = this.stun > 0 ? 0 : Math.sin(t * (this.boss ? 3 : 7) + this.wobblePhase) * (this.boss ? 2 : 1.6);
    const rx = this.r * grow * squash;
    const ry = this.r * grow * (2 - squash);
    const x = this.x + (this.flash > 0 ? Rough.jit(3) : 0), y = this.y + bob;
    const fill = this.flash > 0 ? '#ffffff' : this.fill;
    const facing = Math.atan2(-this.y, -this.x);     // they all walk at the castle

    ctx.save();
    if (this.spawnT < 1) ctx.globalAlpha = E.out(this.spawnT);

    if (this.burn > 0) {
      // the body's own outline, licked outward by an uneven amount so it
      // reads as flame instead of a hard border around the shape
      const base = this.silhouette(x, y, rx, ry, 5, facing);
      const aura = [];
      for (let i = 0; i < base.length; i++) {
        const a = base[i], b = base[(i + 1) % base.length];
        for (const q of [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]) {
          const ang = Math.atan2(q[1] - y, q[0] - x);
          const lick = 3 + Math.abs(Rough.jit(9));
          aura.push([q[0] + Math.cos(ang) * lick, q[1] + Math.sin(ang) * lick]);
        }
      }
      Rough.scribble(ctx, aura, { color: '#e0562d', spacing: 8, width: 4, overflow: 1.12, alpha: 0.3 });
      ctx.save();
      ctx.globalAlpha = 0.5;
      Rough.poly(ctx, aura, { color: '#e8c33a', width: 2, jitter: 2.2, passes: 1 });
      ctx.restore();
    }

    switch (this.kind) {
      case 'brick': this.drawBrick(ctx, x, y, rx, ry, fill, t); break;
      case 'dart': this.drawDart(ctx, x, y, rx, ry, fill, facing); break;
      case 'boss': this.drawBlot(ctx, x, y, rx, ry, fill, t); break;
      case 'warden': this.drawWarden(ctx, x, y, rx, ry, fill, t); break;
      case 'blotling': this.drawBlotling(ctx, x, y, rx, ry, fill, t); break;
      default: this.drawBlob(ctx, x, y, rx, ry, fill, t); break;
    }

    if (this.immuneT > 0) {
      const flare = E.pop(this.barrierT) * 5;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(t * 9) * 0.2 + this.barrierT * 0.3;
      Rough.poly(ctx, this.silhouette(x, y, rx, ry, 13 + flare, facing), { color: '#8ec5e8', width: 4, jitter: 4 });
      Rough.poly(ctx, this.silhouette(x, y, rx, ry, 20 + flare, facing), { color: '#bcdcf2', width: 2.5, jitter: 5 });
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
      const w = Math.max(this.r * 2.1, 26), bx = x - w / 2;
      const by = y - (this.boss ? ry * 1.95 + 12 : ry + 13);   // clear of horns and drips
      const p = this.hpShown;
      Rough.line(ctx, bx, by, bx + w, by, { color: 'rgba(43,43,43,0.2)', width: this.boss ? 8 : 6, jitter: 0.8, passes: 1 });
      Rough.line(ctx, bx, by, bx + w * p, by,
        { color: p > 0.5 ? '#4c9f70' : (p > 0.25 ? '#d99a26' : '#c8433a'), width: this.boss ? 8 : 6, jitter: 1, passes: 1 });
      if (this.boss) {
        Rough.text(ctx, this.kind === 'warden' ? 'THE WARDEN' : 'THE BLOT', x, by - 13, 13, '#2b2b2b');
      }
    }
  }

  /* This enemy's own outline, pushed outward by `pad`. Auras and barriers are
     drawn from it so they hug the body instead of ringing everything with the
     same circle. */
  silhouette(x, y, rx, ry, pad, facing) {
    if (this.kind === 'warden') {
      const w = rx * 1.55 + pad, h = ry * 1.15 + pad;
      return [[x - w, y - h * 0.8], [x - w * 0.82, y - h], [x + w * 0.82, y - h],
      [x + w, y - h * 0.8], [x + w * 0.9, y + h], [x - w * 0.9, y + h]];
    }
    if (this.kind === 'brick') {
      return Rough.rectPts(x - rx - pad, y - ry - pad, (rx + pad) * 2, (ry + pad) * 2);
    }
    if (this.kind === 'dart') {
      const r = (rx + ry) / 2 + pad, a = (facing || 0) + Math.PI / 2;
      const c = Math.cos(a), s = Math.sin(a);
      return [[0, -r * 1.25], [r * 0.85, r * 0.85], [0, r * 0.4], [-r * 0.85, r * 0.85]]
        .map(p => [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c]);
    }
    return Rough.circlePts(x, y, (rx + ry) / 2 + pad, (rx + ry) / 2 * 0.1, 14);
  }

  /* --- eyes, for the bosses only --- */
  eyes(ctx, x, y, r, count, t, pupilColor) {
    const look = Math.atan2(-this.y, -this.x);
    const lx = Math.cos(look) * r * 0.09, ly = Math.sin(look) * r * 0.09;
    const blink = (Math.sin(t * 1.7 + this.wobblePhase) > 0.985) ? 0.18 : 1;
    const spread = r * (count > 2 ? 0.34 : 0.28);
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const ex = x + off, ey = y - r * 0.1 + (count > 2 ? Math.abs(off) * 0.12 : 0);
      const er = r * (count > 2 ? 0.14 : 0.17);
      ctx.save();
      ctx.fillStyle = '#fffdf4';
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * blink, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * blink, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = pupilColor || '#2b2b2b';
      ctx.beginPath(); ctx.ellipse(ex + lx, ey + ly, er * 0.45, er * 0.45 * blink, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  drawBlob(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const pts = Rough.circlePts(x, y, r, r * 0.13, 11);
    Rough.scribble(ctx, pts, { color: fill, spacing: 6, width: 5, overflow: 1.12 });
    Rough.grain(ctx, pts, '#2b2b2b', 0.002, this.id);
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.4, jitter: 1.2 });
    // an inner ring and a highlight, so it reads as round rather than flat
    ctx.save();
    ctx.globalAlpha = 0.4;
    Rough.circle(ctx, x, y, r * 0.52, { color: '#2b2b2b', width: 1.6, jitter: 1.8 });
    ctx.globalAlpha = 0.35;
    Rough.circle(ctx, x - r * 0.35, y - r * 0.38, r * 0.18, { color: '#fffdf4', width: 2, jitter: 1 });
    ctx.restore();
  }

  /* A folded paper dart, tipped the way it is flying. */
  drawDart(ctx, x, y, rx, ry, fill, facing) {
    const r = (rx + ry) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing + Math.PI / 2);
    const nose = [[0, -r * 1.25], [r * 0.85, r * 0.85], [0, r * 0.4], [-r * 0.85, r * 0.85]]
      .map(p => [p[0] + Rough.jit(1.6), p[1] + Rough.jit(1.6)]);
    Rough.scribble(ctx, nose, { color: fill, spacing: 6, width: 5, overflow: 1.14 });
    Rough.poly(ctx, nose, { color: '#2b2b2b', width: 2.4, jitter: 1.1 });
    // the crease down the fold, and the wash of speed behind it
    Rough.line(ctx, 0, -r * 1.15, 0, r * 0.35, { color: '#2b2b2b', width: 1.6, jitter: 1, passes: 1 });
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (const s of [-1, 1]) {
      Rough.line(ctx, s * r * 0.5, r * 1.0, s * r * 0.62, r * 1.75,
        { color: '#2b2b2b', width: 1.6, jitter: 1.4, passes: 1 });
    }
    Rough.line(ctx, 0, r * 0.7, 0, r * 1.5, { color: '#2b2b2b', width: 1.4, jitter: 1.4, passes: 1 });
    ctx.restore();
    ctx.restore();
  }

  /* An actual brick: courses of mortar and a chipped corner. */
  drawBrick(ctx, x, y, rx, ry, fill, t) {
    const pts = Rough.rectPts(x - rx, y - ry, rx * 2, ry * 2).map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
    Rough.scribble(ctx, pts, { color: fill, spacing: 6, width: 5, overflow: 1.12 });
    Rough.grain(ctx, pts, '#5c3a22', 0.004, this.id);
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.8, jitter: 1.2 });
    ctx.save();
    ctx.globalAlpha = 0.5;
    Rough.line(ctx, x - rx, y - ry * 0.25, x + rx, y - ry * 0.25, { color: '#5c3a22', width: 1.8, jitter: 1.2, passes: 1 });
    Rough.line(ctx, x - rx, y + ry * 0.45, x + rx, y + ry * 0.45, { color: '#5c3a22', width: 1.8, jitter: 1.2, passes: 1 });
    Rough.line(ctx, x, y - ry, x, y - ry * 0.25, { color: '#5c3a22', width: 1.8, jitter: 1.2, passes: 1 });
    Rough.line(ctx, x - rx * 0.45, y - ry * 0.25, x - rx * 0.45, y + ry * 0.45, { color: '#5c3a22', width: 1.8, jitter: 1.2, passes: 1 });
    Rough.line(ctx, x + rx * 0.4, y + ry * 0.45, x + rx * 0.4, y + ry, { color: '#5c3a22', width: 1.8, jitter: 1.2, passes: 1 });
    ctx.restore();
    // a corner knocked off
    Rough.poly(ctx, [[x + rx * 0.55, y - ry], [x + rx, y - ry * 0.45], [x + rx * 0.82, y - ry * 0.9]],
      { color: '#2b2b2b', width: 1.8, jitter: 1.4, closed: false });
  }

  /* THE BLOT - a fat ink amoeba with a seam it splits along, and drips. */
  drawBlot(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const pts = [];
    const lobes = 9;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + t * 1.3) * 0.08 + Math.sin(a * lobes + t * 0.7) * 0.06;
      pts.push([x + Math.cos(a) * r * wob + Rough.jit(1.6), y + Math.sin(a) * r * wob * 0.92 + Rough.jit(1.6)]);
    }
    // drips hanging off the bottom
    for (let i = -1; i <= 1; i++) {
      const dx = x + i * r * 0.5, len = r * (0.3 + 0.16 * Math.sin(t * 1.6 + i));
      Rough.blob(ctx, dx, y + r * 0.85 + len, r * 0.15, fill, '#2b2b2b', { spacing: 5, fillWidth: 4, sides: 8 });
    }
    Rough.scribble(ctx, pts, { color: fill, spacing: 7, width: 7, overflow: 1.1 });
    Rough.grain(ctx, pts, '#000000', 0.003, this.id);
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 3.4, jitter: 1.6 });

    // the seam it tears along when it splits, widening as it gets hurt
    const open = (1 - this.hpShown) * r * 0.22 + Math.sin(t * 2) * 1.5;
    const seam = [];
    for (let i = 0; i <= 6; i++) {
      seam.push([x + (i % 2 ? open : -open), y - r * 0.85 + (i / 6) * r * 1.7]);
    }
    Rough.poly(ctx, seam, { color: '#c8b6e8', width: 2.6, jitter: 1.2, closed: false });

    this.eyes(ctx, x, y - r * 0.18, r * 0.95, 3, t, '#e8e0ff');
    // wide jagged grin
    const grin = [];
    for (let i = 0; i <= 8; i++) {
      grin.push([x - r * 0.45 + (i / 8) * r * 0.9, y + r * 0.42 + (i % 2 ? r * 0.1 : 0)]);
    }
    Rough.poly(ctx, grin, { color: '#2b2b2b', width: 2.2, jitter: 1, closed: false });
  }

  /* A little one, spat out by the Blot. */
  drawBlotling(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const pts = Rough.circlePts(x, y, r, r * 0.22, 9);
    Rough.scribble(ctx, pts, { color: fill, spacing: 5, width: 4, overflow: 1.16 });
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.2, jitter: 1.3 });
    Rough.blob(ctx, x, y + r * 0.95 + Math.sin(t * 5) * 2, r * 0.22, fill, '#2b2b2b', { spacing: 4, fillWidth: 3, sides: 7 });
    ctx.save();
    ctx.globalAlpha = 0.35;
    Rough.circle(ctx, x - r * 0.3, y - r * 0.32, r * 0.2, { color: '#fffdf4', width: 1.8, jitter: 1 });
    ctx.restore();
  }

  /* THE WARDEN - a slab with one enormous eye set in it. No cartoon face, no
     white filler: the body is solid and dark so the eye is the only thing to
     look at, and it looks back. */
  drawWarden(ctx, x, y, rx, ry, fill, t) {
    const w = rx * 1.55, h = ry * 1.15;

    // chains swinging off the shoulders
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const cy = y - h * 0.35 + i * rx * 0.3;
        const cx = x + s * (w + rx * 0.2) + Math.sin(t * 2 + i * 0.6) * 3 * s;
        Rough.circle(ctx, cx, cy, rx * 0.13, { color: '#6b6b6b', width: 2.2, jitter: 1.2 });
      }
    }

    const body = [[x - w, y - h * 0.8], [x - w * 0.82, y - h], [x + w * 0.82, y - h],
    [x + w, y - h * 0.8], [x + w * 0.9, y + h], [x - w * 0.9, y + h]]
      .map(p => [p[0] + Rough.jit(2.2), p[1] + Rough.jit(2.2)]);

    // solid base coat first, so the paper never shows through as white stripes
    ctx.save();
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#3d1526';
    ctx.beginPath();
    body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    Rough.scribble(ctx, body, { color: fill, spacing: 4.5, width: 7, overflow: 1.08, alpha: 0.9 });
    Rough.grain(ctx, body, '#000000', 0.005, this.id);
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 3.6, jitter: 1.6 });

    // iron grille across the gut
    ctx.save();
    ctx.globalAlpha = 0.8;
    const gTop = y + h * 0.5, gBot = y + h * 0.88;
    for (let i = -2; i <= 2; i++) {
      const bx = x + i * w * 0.3;
      Rough.line(ctx, bx, gTop, bx, gBot, { color: '#1a0c13', width: 3, jitter: 1, passes: 1 });
    }
    Rough.line(ctx, x - w * 0.7, gTop, x + w * 0.7, gTop, { color: '#1a0c13', width: 2.6, jitter: 1, passes: 1 });
    Rough.line(ctx, x - w * 0.7, gBot, x + w * 0.7, gBot, { color: '#1a0c13', width: 2.6, jitter: 1, passes: 1 });
    ctx.restore();

    // horns of office
    for (const s of [-1, 1]) {
      const horn = [[x + s * w * 0.55, y - h], [x + s * w * 0.78, y - h * 1.45], [x + s * w * 0.3, y - h * 1.02]];
      Rough.scribble(ctx, horn, { color: '#9a8f86', spacing: 5, width: 4, overflow: 1.14 });
      Rough.poly(ctx, horn, { color: '#2b2b2b', width: 2.4, jitter: 1 });
    }

    this.drawWardenEye(ctx, x, y - h * 0.24, rx * 0.72, t);
  }

  /* The eye: sunk in a black socket, bile-yellow iris, a goat-slit pupil that
     narrows when it is about to do something, and veins creeping in. */
  drawWardenEye(ctx, x, y, r, t) {
    const look = Math.atan2(-this.y - (this.y > 0 ? 0 : 0), -this.x);
    const lx = Math.cos(look) * r * 0.12, ly = Math.sin(look) * r * 0.12;

    // rare, slow blink - a heavy lid, not a cartoon snap
    const cycle = (t * 0.28 + this.wobblePhase) % 1;
    const blink = cycle > 0.965 ? Math.abs(Math.sin((cycle - 0.965) / 0.035 * Math.PI)) : 0;
    const open = 1 - blink;

    // socket: a torn black hole in the slab
    const socket = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const rr = r * (1.28 + Math.sin(a * 4 + this.wobblePhase) * 0.09);
      socket.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86 + Rough.jit(1.4)]);
    }
    ctx.save();
    ctx.fillStyle = '#0d0409';
    ctx.beginPath();
    socket.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    Rough.poly(ctx, socket, { color: '#1a0c13', width: 2.4, jitter: 2 });

    if (open <= 0.02) {
      Rough.line(ctx, x - r, y, x + r, y, { color: '#1a0c13', width: 3, jitter: 1.4, passes: 2 });
      return;
    }

    ctx.save();
    // the lid clips the eye as it closes
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.1, r * 0.92 * open, 0, 0, Math.PI * 2);
    ctx.clip();

    // eyeball - sickly, solid, no hatching
    ctx.fillStyle = '#d8cdaa';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.98, r * 0.86, 0, 0, Math.PI * 2); ctx.fill();

    // veins crawling in from the edges
    Rough.srand(this.id * 31 + 5);
    ctx.save();
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 7; i++) {
      const a = Rough.rnd() * Math.PI * 2;
      let px = x + Math.cos(a) * r * 0.95, py = y + Math.sin(a) * r * 0.82;
      for (let k = 0; k < 3; k++) {
        const nx = px + (x - px) * 0.32 + Rough.jit(r * 0.14);
        const ny = py + (y - py) * 0.32 + Rough.jit(r * 0.14);
        Rough.line(ctx, px, py, nx, ny, { color: '#8f1d1d', width: 1.4 - k * 0.3, jitter: 0.8, passes: 1 });
        px = nx; py = ny;
      }
    }
    ctx.restore();

    // iris: a ring of bile yellow, chalk-blue while the barrier is up
    const irisR = r * 0.52;
    const irisCol = this.immuneT > 0 ? '#8ec5e8' : '#c2ad3f';
    ctx.fillStyle = this.immuneT > 0 ? '#5f93b5' : '#8f7d1e';
    ctx.beginPath(); ctx.ellipse(x + lx, y + ly, irisR, irisR * 0.96, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = irisCol;
    ctx.beginPath(); ctx.ellipse(x + lx, y + ly, irisR * 0.82, irisR * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    // striations
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      Rough.line(ctx, x + lx + Math.cos(a) * irisR * 0.3, y + ly + Math.sin(a) * irisR * 0.3,
        x + lx + Math.cos(a) * irisR * 0.84, y + ly + Math.sin(a) * irisR * 0.84,
        { color: '#4a3c0a', width: 1.2, jitter: 0.7, passes: 1 });
    }
    ctx.restore();

    // goat-slit pupil, tight when it is winding up, wide when it is not
    const winding = this.immuneT > 0 || this.skillT < 1.2;
    const pw = irisR * (winding ? 0.16 : 0.3) * (1 + Math.sin(t * 0.9) * 0.08);
    ctx.fillStyle = '#05010a';
    ctx.beginPath();
    ctx.ellipse(x + lx, y + ly, pw, irisR * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // one cold glint, far off to the side so it never reads as cute
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath(); ctx.ellipse(x + lx - irisR * 0.5, y + ly - irisR * 0.55, r * 0.07, r * 0.05, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();

    // lids: a heavy brow pressing down, and the lower rim
    const lidY = y - r * 0.9 * open;
    Rough.poly(ctx, [[x - r * 1.12, y - r * 0.2], [x - r * 0.8, lidY], [x, lidY - r * 0.12],
    [x + r * 0.8, lidY], [x + r * 1.12, y - r * 0.2]],
      { color: '#1a0c13', width: 3.2, jitter: 1.6, closed: false });
    Rough.poly(ctx, [[x - r * 1.1, y + r * 0.1], [x, y + r * 0.92 * open], [x + r * 1.1, y + r * 0.1]],
      { color: '#1a0c13', width: 2.8, jitter: 1.6, closed: false });
    // brow, low and flat
    Rough.line(ctx, x - r * 1.25, y - r * 1.12, x + r * 1.25, y - r * 1.26,
      { color: '#2b2b2b', width: 3.4, jitter: 1.2, passes: 2 });
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
        Sfx.play('sentry_shot', { volume: 0.4 });
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
        if (!e.dead) e.ignite(3 + game.statusBonus());
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
      Sfx.play('water_pop', { volume: 0.4, throttle: 35, voices: 6 });
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
        if (!e.dead) { e.applySlow(2 + game.statusBonus(), 0.75); e.faded = 0.85; }
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
  constructor(x, y, radius, dps, life) {
    this.id = nextId();
    this.x = x; this.y = y; this.radius = radius; this.dps = dps;
    this.life = life || 4; this.max = this.life; this.tick = 1; this.grow = 0;
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

/* Compass Cursor: an ink ring swept out from the click point. Each enemy is
   caught once, as the line passes over it. */
class CompassRing {
  constructor(x, y, radius, damage) {
    this.id = nextId();
    this.x = x; this.y = y; this.radius = radius; this.damage = damage;
    this.t = 0; this.dur = 1.0;
    this.hit = new Set();
    this.spin = Math.random() * 6;
  }
  get r() { return this.radius * E.out(Math.min(1, this.t / this.dur)); }
  update(dt, game) {
    this.t += dt;
    const r = this.r;
    for (const e of game.enemies) {
      if (e.dead || this.hit.has(e.id)) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= r + e.r) {                 // everything the circle has swallowed
        this.hit.add(e.id);
        e.hurt(this.damage, game, { color: '#8a5cc4' });
      }
    }
    return this.t < this.dur + 0.15;
  }
  draw(ctx, t) {
    const p = Math.min(1, this.t / this.dur);
    const r = this.r;
    Rough.boil(this.id, t * 2);
    ctx.save();
    ctx.globalAlpha = 1 - p * p;
    Rough.circle(ctx, this.x, this.y, r, { color: '#8a5cc4', width: 3.4, jitter: 2.6 });
    ctx.globalAlpha = (1 - p) * 0.5;
    Rough.circle(ctx, this.x, this.y, r * 0.93, { color: '#b79ae0', width: 1.8, jitter: 2.2 });
    // the compass itself: spike in the middle, arm sweeping the line round
    ctx.globalAlpha = 1 - p;
    const a = this.spin + p * Math.PI * 2.2;
    Rough.line(ctx, this.x, this.y, this.x + Math.cos(a) * r, this.y + Math.sin(a) * r,
      { color: '#8a5cc4', width: 2.2, jitter: 1.2, passes: 1 });
    Rough.circle(ctx, this.x, this.y, 3, { color: '#8a5cc4', width: 2, jitter: 0.8 });
    ctx.restore();
  }
}

/* Scissor Cursor: the cut that finishes something off. */
class ScissorCut {
  constructor(x, y, r) {
    this.id = nextId(); this.x = x; this.y = y; this.r = Math.max(14, r);
    this.life = 0.4; this.max = this.life; this.a = Math.random() * Math.PI;
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const p = E.out(1 - this.life / this.max);
    Rough.boil(this.id, 0);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    // two halves of the cut sliding apart
    for (const s of [-1, 1]) {
      const ox = Math.cos(this.a + Math.PI / 2) * p * 9 * s;
      const oy = Math.sin(this.a + Math.PI / 2) * p * 9 * s;
      Rough.line(ctx,
        this.x - Math.cos(this.a) * this.r + ox, this.y - Math.sin(this.a) * this.r + oy,
        this.x + Math.cos(this.a) * this.r + ox, this.y + Math.sin(this.a) * this.r + oy,
        { color: '#c8433a', width: 3, jitter: 1.6, passes: 1 });
    }
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
