/* FANDHARN - main game. Top-down doodle tower defense: one castle, ten waves,
   and a cursor you have to click enemies to death with. */

const COLLAPSE_TIME = 1.8;      // how long the castle takes to come down

const Game = {
  state: 'menu',            // menu | playing | offers | collapsing | gameover | victory
  canvas: null, ctx: null,
  w: 0, h: 0, dpr: 1,
  enemies: [], effects: [],
  difficulty: 'normal',
  wave: 0,
  castleHp: CASTLE_HP,
  hpShown: CASTLE_HP,       // eased, so the bar drains instead of jumping
  castleRadius: 46,
  castleHitT: 0,
  collapse: 0,              // >0 while the castle is coming down
  shield: 0,
  scribbles: 0,
  waveScribbles: 0,
  totalKills: 0,
  cursorId: 'plain',
  oneshot: {},              // id -> true, bought once and gone from the offers
  stacking: {},             // id -> level, no cap
  cursorCharge: 0,
  moltenCharge: 0,
  penTrail: null,
  sentry: null,
  pointer: { x: 0, y: 0, down: 0, inside: false },
  spawnLeft: 0, spawnTimer: 0, waveSpec: null,
  shakeAmt: 0, shakeX: 0, shakeY: 0,
  flash: 0,                 // red vignette when the castle is hit
  offerScreen: null,
  banner: null,
  bg: null, ground: null,
  time: 0, last: 0,

  /* ------------------------------------------------------------ lifecycle */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    const c = this.canvas;
    c.addEventListener('mousemove', e => this.movePointer(e.clientX, e.clientY));
    c.addEventListener('mouseleave', () => { this.pointer.inside = false; });
    c.addEventListener('mousedown', e => { e.preventDefault(); this.movePointer(e.clientX, e.clientY); this.press(); });
    c.addEventListener('mouseup', () => { this.pointer.down = 0; });
    c.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.movePointer(t.clientX, t.clientY);
      this.press();
    }, { passive: false });
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.movePointer(t.clientX, t.clientY);
    }, { passive: false });
    c.addEventListener('touchend', e => { e.preventDefault(); this.pointer.down = 0; }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());

    Sfx.init();
    UI.bind(this);
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildBackground();
    this.buildGround();
  },

  buildBackground() {
    const bg = document.createElement('canvas');
    bg.width = Math.floor(this.w * this.dpr);
    bg.height = Math.floor(this.h * this.dpr);
    const b = bg.getContext('2d');
    b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    b.fillStyle = '#fffdf4';
    b.fillRect(0, 0, this.w, this.h);
    Rough.srand(4242);
    for (let x = 0; x <= this.w; x += BLOCK) {
      Rough.line(b, x, 0, x, this.h, { color: 'rgba(90,140,190,0.12)', width: 1, jitter: 1.2, passes: 1 });
    }
    for (let y = 0; y <= this.h; y += BLOCK) {
      Rough.line(b, 0, y, this.w, y, { color: 'rgba(90,140,190,0.12)', width: 1, jitter: 1.2, passes: 1 });
    }
    // faint margin smudges, kept in the paper's own blue so they never read as enemies
    for (let i = 0; i < 12; i++) {
      const x = Rough.rnd() * this.w, y = Rough.rnd() * this.h;
      if (Math.hypot(x - this.w / 2, y - this.h / 2) < 280) continue;
      Rough.line(b, x, y, x + 12 + Rough.rnd() * 26, y + Rough.jit(10),
        { color: 'rgba(90,140,190,0.13)', width: 2, jitter: 2.5, passes: 1 });
    }
    this.bg = bg;
  },

  /* The coloured patch of ground the castle stands on: a round area about 3
     blocks across, with layered noise on the edge so it never reads as a
     compass circle. Pre-rendered once - it never changes. */
  buildGround() {
    const R = GROUND_RADIUS * 1.35;
    const size = Math.ceil(R * 2);
    const g = document.createElement('canvas');
    g.width = Math.floor(size * this.dpr);
    g.height = Math.floor(size * this.dpr);
    const c = g.getContext('2d');
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cx = size / 2, cy = size / 2;

    const outer = Rough.noisyRing(cx, cy, GROUND_RADIUS, 1717, 90, 0.11);
    const inner = Rough.noisyRing(cx, cy, GROUND_RADIUS * 0.62, 2929, 70, 0.2);

    // flat wash first, so the crayon has something to sit on instead of
    // reading as bare stripes
    c.save();
    c.globalAlpha = 0.3;
    c.fillStyle = '#d8ecc4';
    c.beginPath();
    outer.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.closePath();
    c.fill();
    c.restore();

    // two crayon passes crossing each other at different angles
    Rough.scribble(c, outer, { color: '#9dc98a', spacing: 11, width: 9, overflow: 1.05, angle: -0.55, alpha: 0.34 });
    Rough.scribble(c, outer, { color: '#b7d9a0', spacing: 13, width: 8, overflow: 1.04, angle: 0.75, alpha: 0.26 });
    Rough.scribble(c, inner, { color: '#c8dfa0', spacing: 12, width: 8, overflow: 1.06, angle: 0.2, alpha: 0.22 });
    Rough.grain(c, outer, '#5f7d4a', 0.004, 33);

    c.save();
    c.globalAlpha = 0.45;
    Rough.poly(c, outer, { color: '#7fae6b', width: 2.6, jitter: 3.4 });
    c.restore();

    // tufts of grass around the rim
    Rough.srand(99);
    for (let i = 0; i < 30; i++) {
      const a = Rough.rnd() * Math.PI * 2;
      const rr = GROUND_RADIUS * (0.74 + Rough.rnd() * 0.3);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      c.save();
      c.globalAlpha = 0.45;
      Rough.line(c, x, y, x + Rough.jit(4), y - 4 - Rough.rnd() * 6,
        { color: '#7fae6b', width: 1.8, jitter: 1, passes: 1 });
      c.restore();
    }
    this.ground = { canvas: g, size: size };
  },

  start(diff) {
    this.difficulty = diff;
    this.enemies = [];
    this.effects = [];
    this.wave = 0;
    this.castleHp = CASTLE_HP;
    this.hpShown = CASTLE_HP;
    this.scribbles = 0;
    this.totalKills = 0;
    this.cursorId = 'plain';
    this.oneshot = {};
    this.stacking = {};
    this.shield = 0;
    this.collapse = 0;
    this.cursorCharge = 0;
    this.moltenCharge = 0;
    this.penTrail = null;
    this.sentry = null;
    this.offerScreen = null;
    UI.hideAll();
    this.startWave();
  },

  startWave() {
    this.wave++;
    const d = DIFFICULTIES[this.difficulty];
    const spec = WAVE_TABLE[this.wave - 1];
    this.waveSpec = {
      count: Math.max(3, Math.round(spec.count * d.countMul)),
      hp: spec.hp * d.hpMul,
      speed: spec.speed * d.speedMul,
      interval: spec.interval * d.intervalMul,
      boss: spec.boss || null
    };
    this.spawnLeft = this.waveSpec.count;
    this.spawnTimer = 1.1;
    this.waveScribbles = 0;
    if (this.oneshot.chalk) this.shield = 2;     // the ward is re-drawn every wave
    this.state = 'playing';
    Sfx.play('wave_start', { volume: 0.6 });
    this.banner = this.waveSpec.boss
      ? new WaveBanner('WAVE ' + this.wave, this.waveSpec.boss === 'warden' ? 'the warden is coming' : 'something big is coming', '#c8433a')
      : new WaveBanner('WAVE ' + this.wave, this.wave === WAVES_PER_RUN ? 'last one' : '', '#2b2b2b');
    UI.hideAll();
    UI.syncHud(this);
  },

  /* --------------------------------------------------------------- stats */
  clickDamage() { return cursorById(this.cursorId).dmg + 0.5 * (this.stacking.lead || 0); },
  critChance() { return BASE_CRIT_CHANCE + 0.03 * (this.stacking.nib || 0); },
  aoeScale() { return 1 + 0.12 * (this.stacking.wax || 0); },
  aoeDamage(base) { return base * (1 + 0.10 * (this.stacking.wax || 0)); },

  buyOffer(off) {
    this.scribbles -= off.cost;
    if (off.kind === 'cursor') {
      this.cursorId = off.id;                 // the old cursor is gone for good
      this.cursorCharge = 0;
      this.penTrail = off.id === 'pen' ? new PenTrail() : null;
    } else if (off.kind === 'oneshot') {
      this.oneshot[off.id] = true;
      if (off.id === 'chalk') this.shield = 2;
      if (off.id === 'sentry') this.sentry = new Sentry(-this.castleRadius - 26, 14);
      if (off.id === 'molten') this.moltenCharge = 0;
    } else {
      const lv = (this.stacking[off.id] || 0) + 1;
      this.stacking[off.id] = lv;
      if (off.id === 'patch') this.castleHp = Math.min(CASTLE_HP, this.castleHp + 1);
    }
    UI.syncHud(this);
  },

  /* ---------------------------------------------------------------- input */
  movePointer(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = cx - r.left;
    this.pointer.y = cy - r.top;
    this.pointer.inside = true;
    if (this.state === 'offers' && this.offerScreen) {
      this.offerScreen.move(this.pointer.x, this.pointer.y, this.w, this.h);
    } else if (this.state === 'playing' && this.penTrail) {
      this.penTrail.add(this.pointer.x - this.w / 2, this.pointer.y - this.h / 2);
    }
  },

  press() {
    this.pointer.down = 0.13;
    if (this.state === 'offers' && this.offerScreen) {
      this.offerScreen.click(this.pointer.x, this.pointer.y, this.w, this.h);
      return;
    }
    if (this.state !== 'playing') return;
    this.click(this.pointer.x - this.w / 2, this.pointer.y - this.h / 2);
  },

  click(x, y) {
    const cursor = cursorById(this.cursorId);
    this.cursorCharge++;
    this.moltenCharge++;

    let target = null, bestDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.r + 8 && d < bestDist) { bestDist = d; target = e; }
    }

    if (target) {
      const crit = Math.random() < this.critChance();
      target.hurt(this.clickDamage() * (crit ? CRIT_MULT : 1), this, { crit });
      this.effects.push(new ClickRipple(x, y, crit ? '#e0562d' : cursor.color, crit));
      Sfx.play(crit ? 'crit' : 'click_hit', { throttle: 25, volume: crit ? 0.9 : 0.55, voices: 6 });
      const onHit = CursorOnHit[cursor.id];
      if (onHit) onHit(this, target);
      if (crit) {
        this.shake(3);
        if (this.oneshot.ink) {
          this.effects.push(new InkPuddle(target.x, target.y, BLOCK * 1.4 * this.aoeScale(), this.aoeDamage(2)));
          Sfx.play('ink_splat', { volume: 0.5, throttle: 120 });
        }
      }
    } else {
      this.effects.push(new ClickRipple(x, y, '#b8b2a3', false));
      Sfx.play('click_miss', { throttle: 25, volume: 0.35, voices: 4 });
    }

    if (cursor.every > 0 && this.cursorCharge % cursor.every === 0) {
      const power = CursorPowers[cursor.id];
      if (power) power(this, x, y);
    }

    if (this.oneshot.molten && this.moltenCharge % 5 === 0) {
      this.effects.push(new FireBlast(x, y, BLOCK * 2 * this.aoeScale(), this.aoeDamage(this.clickDamage() / 2), this));
      Sfx.play('fire_blast', { volume: 0.65, throttle: 90 });
    }

    UI.syncHud(this);
  },

  /* ----------------------------------------------------------- game rules */
  areaDamage(x, y, radius, dmg, opts) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) <= radius + e.r) e.hurt(dmg, this, opts);
    }
  },

  onEnemyKilled(e) {
    Sfx.play(e.boss || e.kind === 'brick' ? 'kill_big' : 'kill',
      { volume: e.boss ? 1 : 0.5, throttle: e.boss ? 0 : 45, voices: 4 });
    const gain = Math.max(1, Math.round((1 + e.maxHp / 5) * DIFFICULTIES[this.difficulty].reward));
    this.scribbles += gain;
    this.effects.push(new FloatText(e.x + 10, e.y + 6, '+' + gain, '#d99a26', 15, false));
    this.waveScribbles += gain;
    this.totalKills++;
    UI.syncHud(this);
  },

  castleHit() {
    this.castleHitT = 1;
    if (this.shield > 0) {
      this.shield--;
      this.effects.push(new FloatText(0, -this.castleRadius - 26, 'ward!', '#8ec5e8', 20, false));
      this.effects.push(new ShieldPop(this.castleRadius + 17 + this.shield * 8));
      Sfx.play('ward', { volume: 0.8 });
      this.shake(8);
    } else {
      this.castleHp--;
      Sfx.play('castle_hit', { volume: 0.95, throttle: 0 });
      this.shake(17);
      this.flash = 1;
      this.effects.push(new FloatText(0, -this.castleRadius - 26, '-1', '#c8433a', 26, true));
      if (this.castleHp <= 0) {
        this.castleHp = 0;
        this.state = 'collapsing';       // let it fall down before the verdict
        this.collapse = 0.0001;
        this.shake(24);
        Sfx.play('game_over', { volume: 1, rateVar: 0 });
      }
    }
    UI.syncHud(this);
  },

  shake(amount) { this.shakeAmt = Math.min(24, this.shakeAmt + amount); },

  spawnEnemy() {
    const w = this.waveSpec;
    const stage = Math.min(4, Math.ceil(this.wave / 2));
    const pool = stage <= 1 ? ['blob'] :
      stage === 2 ? ['blob', 'blob', 'dart'] :
        stage === 3 ? ['blob', 'dart', 'brick'] :
          ['blob', 'dart', 'dart', 'brick', 'brick'];
    let kind = pool[Math.floor(Math.random() * pool.length)];
    if (w.boss && this.spawnLeft === w.count - 2) kind = w.boss;

    // just outside the visible paper, so they walk on screen right away
    const mx = this.w / 2 + 60, my = this.h / 2 + 60;
    let sx, sy;
    if (Math.random() < 0.5) {
      sx = (Math.random() * 2 - 1) * mx;
      sy = (Math.random() < 0.5 ? -1 : 1) * my;
    } else {
      sx = (Math.random() < 0.5 ? -1 : 1) * mx;
      sy = (Math.random() * 2 - 1) * my;
    }
    const k = ENEMY_KINDS[kind];
    const hp = Math.max(2, Math.round(w.hp * k.hpMul));
    this.enemies.push(new Enemy(kind, hp, w.speed * k.speedMul, sx, sy));
    if (kind === 'boss' || kind === 'warden') {
      this.shake(10);
      Sfx.play('boss_spawn', { volume: 1, rateVar: 0.02 });
      this.effects.push(new SpawnMark(sx, sy, k.r * 1.6));
    }
  },

  /* Summoned mid-fight by a boss skill, rather than by the wave spawner. */
  spawnMinion(kind, x, y, hp, speed) {
    const k = ENEMY_KINDS[kind];
    const e = new Enemy(kind, Math.max(2, Math.round(hp * k.hpMul)), speed * k.speedMul, x, y);
    this.enemies.push(e);
    return e;
  },

  /* ----------------------------------------------------------------- loop */
  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.time += dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.frame(t));
  },

  update(dt) {
    if (this.pointer.down > 0) this.pointer.down = Math.max(0, this.pointer.down - dt);
    if (this.castleHitT > 0) this.castleHitT = Math.max(0, this.castleHitT - dt / 0.5);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.6);
    this.hpShown += (this.castleHp - this.hpShown) * Math.min(1, dt * 7);
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 42);
      this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
    } else { this.shakeX = this.shakeY = 0; }
    if (this.banner && !this.banner.update(dt)) this.banner = null;

    if (this.state === 'collapsing') {
      this.collapse += dt;
      this.effects = this.effects.filter(f => f.update(dt, this));
      if (this.collapse >= COLLAPSE_TIME) {
        this.state = 'gameover';
        UI.showEnd(this, false);
      }
      return;
    }

    if (this.state === 'offers') {
      if (this.offerScreen && !this.offerScreen.update(dt, this.w, this.h)) {
        this.offerScreen = null;
        this.startWave();
      }
      this.effects = this.effects.filter(f => f.update(dt, this));
      return;
    }
    if (this.state !== 'playing') return;

    if (this.spawnLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.waveSpec.interval;
        this.spawnLeft--;
        this.spawnEnemy();
      }
    }

    for (const e of this.enemies) if (!e.dead) e.update(dt, this);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.effects = this.effects.filter(f => f.update(dt, this));
    if (this.penTrail) this.penTrail.update(dt, this);
    if (this.sentry) this.sentry.update(dt, this);

    if (this.state === 'playing' && this.spawnLeft === 0 && this.enemies.length === 0) {
      this.banner = null;
      Sfx.play('wave_clear', { volume: 0.75 });
      if (this.wave >= WAVES_PER_RUN) {          // nothing left to spend it on
        this.state = 'victory';
        UI.showEnd(this, true);
      } else {
        this.offerScreen = new OfferScreen(this, this.wave, this.waveScribbles);
        this.state = 'offers';
      }
    }
  },

  /* ----------------------------------------------------------------- draw */
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.w / 2 + this.shakeX, this.h / 2 + this.shakeY);

    if (this.state !== 'menu') {
      const wrecked = this.state === 'collapsing' || (this.state === 'gameover' && this.collapse > 0);
      if (wrecked) this.collapse = Math.min(COLLAPSE_TIME, this.collapse || 0.0001);
      if (this.ground) {
        const s = this.ground.size;
        ctx.drawImage(this.ground.canvas, -s / 2, -s / 2, s, s);
      }
      for (const f of this.effects) if (f instanceof InkPuddle) f.draw(ctx, this.time);
      if (this.penTrail) this.penTrail.draw(ctx, this.time);
      this.drawCastle(ctx);
      if (this.sentry) this.sentry.draw(ctx, this.time);
      for (const e of this.enemies) e.draw(ctx, this.time);
      for (const f of this.effects) if (!(f instanceof InkPuddle)) f.draw(ctx, this.time);
    }
    ctx.restore();

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.3;
      ctx.fillStyle = '#c8433a';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    if (this.banner) this.banner.draw(ctx, this.w, this.h, this.time);
    if (this.state === 'offers' && this.offerScreen) this.offerScreen.draw(ctx, this.w, this.h, this.time);

    if ((this.state === 'playing' || this.state === 'offers') && this.pointer.inside) {
      drawCursor(ctx, cursorById(this.cursorId), this.pointer.x, this.pointer.y,
        this.cursorCharge, this.pointer.down > 0 ? 1 : 0, this.time);
    }
  },

  /* The castle is drawn from its damage level, so every lost segment leaves a
     mark: cracks, then broken merlons, then a hole in the wall, then smoke.
     At zero it collapses into a heap. */
  drawCastle(ctx) {
    const t = this.time;
    Rough.boil(7, t * 0.35);
    const R = this.castleRadius;
    const hit = E.pop(this.castleHitT);
    const dmg = Math.max(0, CASTLE_HP - this.castleHp);   // 0 (fine) .. 5 (gone)

    if (this.collapse > 0) { this.drawCollapse(ctx, R, t); return; }

    ctx.save();
    ctx.translate(0, hit * 3);
    ctx.rotate(dmg >= 4 ? 0.04 : 0);                      // the last hit leaves it leaning

    // chalk ward
    for (let i = 0; i < this.shield; i++) {
      ctx.save();
      ctx.globalAlpha = 0.45 + Math.sin(t * 2 + i) * 0.12;
      Rough.circle(ctx, 0, 0, R + 17 + i * 8, { color: '#8ec5e8', width: 3, jitter: 3.5 });
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(3, R * 0.72, R * 0.86, R * 0.2, 0, 0, 7); ctx.fill();
    ctx.restore();

    // ---- wall. Past two hits the top-right corner is bitten out of it.
    let body;
    if (dmg >= 3) {
      body = [[-R * 0.8, -R * 0.45], [R * 0.12, -R * 0.45], [R * 0.2, -R * 0.1],
      [R * 0.55, -R * 0.02], [R * 0.8, -R * 0.3], [R * 0.8, R * 0.7], [-R * 0.8, R * 0.7]];
    } else {
      body = Rough.rectPts(-R * 0.8, -R * 0.45, R * 1.6, R * 1.15);
    }
    body = body.map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
    Rough.scribble(ctx, body, { color: '#c9a36b', spacing: 7, width: 6, overflow: 1.12 });
    Rough.grain(ctx, body, '#7a5a38', 0.004 + dmg * 0.002, 12);
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 3, jitter: 1.3 });

    // ---- merlons: chipped, then missing altogether
    const merlonState = [                                  // per damage level
      [1, 1, 1], [1, 1, 1], [1, 1, 0.55], [1, 0.5, 0], [0.5, 0, 0], [0, 0, 0]
    ][Math.min(5, dmg)];
    for (let i = -1; i <= 1; i++) {
      const keep = merlonState[i + 1];
      if (keep <= 0) continue;
      const h = R * 0.35 * keep;
      const m = Rough.rectPts(i * R * 0.5 - R * 0.17, -R * 0.43 - h, R * 0.34, h)
        .map(p => [p[0] + Rough.jit(1.6), p[1] + Rough.jit(1.6)]);
      Rough.scribble(ctx, m, { color: '#c9a36b', spacing: 6, width: 5, overflow: 1.15 });
      Rough.poly(ctx, m, { color: '#2b2b2b', width: 2.4, jitter: 1.1 });
    }

    // ---- cracks, one more each time it is hit
    const cracks = [
      [[-R * 0.45, -R * 0.35], [-R * 0.3, R * 0.05], [-R * 0.42, R * 0.3], [-R * 0.3, R * 0.68]],
      [[R * 0.35, -R * 0.4], [R * 0.24, -R * 0.05], [R * 0.4, R * 0.25]],
      [[-R * 0.05, -R * 0.45], [R * 0.05, -R * 0.15], [-R * 0.08, R * 0.1]],
      [[-R * 0.72, R * 0.1], [-R * 0.5, R * 0.3], [-R * 0.66, R * 0.62]]
    ];
    for (let i = 0; i < Math.min(cracks.length, dmg); i++) {
      Rough.poly(ctx, cracks[i], { color: '#5c4a32', width: 2.2, jitter: 1.6, closed: false });
    }

    // ---- windows: they go dark as the place empties out
    const windows = dmg >= 3 ? [-R * 0.45] : [-R * 0.45, R * 0.45];
    for (const wx of windows) {
      const wnd = Rough.rectPts(wx - R * 0.1, -R * 0.2, R * 0.2, R * 0.26)
        .map(p => [p[0] + Rough.jit(1.2), p[1] + Rough.jit(1.2)]);
      Rough.scribble(ctx, wnd, { color: dmg >= 2 ? '#2b2b2b' : '#5c4a32', spacing: 4, width: 4, overflow: 1.1 });
      Rough.poly(ctx, wnd, { color: '#2b2b2b', width: 1.8, jitter: 0.9 });
    }

    // ---- door, knocked askew once things get bad
    ctx.save();
    if (dmg >= 4) { ctx.translate(-R * 0.02, R * 0.34); ctx.rotate(-0.22); ctx.translate(R * 0.02, -R * 0.34); }
    const door = Rough.rectPts(-R * 0.2, R * 0.16, R * 0.4, R * 0.54)
      .map(p => [p[0] + Rough.jit(1.4), p[1] + Rough.jit(1.4)]);
    Rough.scribble(ctx, door, { color: '#7a5a38', spacing: 5, width: 5, overflow: 1.1 });
    Rough.poly(ctx, door, { color: '#2b2b2b', width: 2.2, jitter: 1 });
    ctx.restore();

    // ---- flag: whole, then torn, then just a bent pole
    const fx = R * 0.5, fy = -R * 0.78;
    if (dmg < 3) {
      Rough.line(ctx, fx, fy, fx, fy - R * 0.5, { color: '#2b2b2b', width: 2.2, jitter: 0.8 });
      const wav = Math.sin(t * 3) * 3;
      const flag = dmg < 2
        ? [[fx, fy - R * 0.5], [fx + R * 0.34 + wav, fy - R * 0.4 + wav * 0.4], [fx, fy - R * 0.28]]
        : [[fx, fy - R * 0.5], [fx + R * 0.2 + wav, fy - R * 0.44], [fx + R * 0.1, fy - R * 0.36],
        [fx + R * 0.22 + wav, fy - R * 0.3], [fx, fy - R * 0.28]];
      Rough.scribble(ctx, flag, { color: '#c8433a', spacing: 4, width: 4, overflow: 1.14 });
      Rough.poly(ctx, flag, { color: '#2b2b2b', width: 1.8, jitter: 0.9 });
    } else if (dmg < 5) {
      ctx.save();
      ctx.translate(fx, fy); ctx.rotate(0.5);
      Rough.line(ctx, 0, 0, 0, -R * 0.42, { color: '#2b2b2b', width: 2.2, jitter: 1.2 });
      ctx.restore();
    }

    // ---- rubble at the foot, and smoke once it is really hurting
    if (dmg >= 2) {
      Rough.srand(500 + dmg);
      for (let i = 0; i < dmg * 3; i++) {
        const rx = -R * 0.9 + Rough.rnd() * R * 1.8, ry = R * 0.6 + Rough.rnd() * R * 0.2;
        Rough.circle(ctx, rx, ry, 2 + Rough.rnd() * 3, { color: '#a8834f', width: 1.8, jitter: 1.2 });
      }
    }
    ctx.restore();

    if (dmg >= 3) this.drawSmoke(ctx, R, t, dmg);
    this.drawHpBar(ctx, 0, -R - 30);
  },

  drawSmoke(ctx, R, t, dmg) {
    const puffs = (dmg - 2) * 2;
    for (let i = 0; i < puffs; i++) {
      const phase = (t * 0.45 + i / puffs) % 1;
      const x = R * 0.35 + Math.sin(t * 0.9 + i * 2) * 8;
      const y = -R * 0.5 - phase * R * 1.3;
      ctx.save();
      ctx.globalAlpha = (1 - phase) * 0.35;
      Rough.boil(600 + i, Math.floor(t * 2));
      Rough.circle(ctx, x, y, 5 + phase * 13, { color: '#8a8a8a', width: 2, jitter: 2.6 });
      ctx.restore();
    }
    if (dmg >= 4) {
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(t * 9 + i) * 0.3;
        ctx.fillStyle = i % 2 ? '#e0562d' : '#e8c33a';
        ctx.fillRect(R * 0.2 + Rough.jit(14), -R * 0.5 + Rough.jit(10), 3, 3);
        ctx.restore();
      }
    }
  },

  /* The castle coming apart, played once before the run ends. */
  drawCollapse(ctx, R, t) {
    const p = E.clamp01(this.collapse / COLLAPSE_TIME);
    const sink = E.out(p);

    ctx.save();
    ctx.globalAlpha = 0.12 * (1 - p);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(3, R * 0.72, R * 0.86 * (1 + p), R * 0.2, 0, 0, 7); ctx.fill();
    ctx.restore();

    // the walls fold down and squash into the ground
    ctx.save();
    ctx.translate(0, sink * R * 0.55);
    ctx.rotate(0.1 * sink);
    ctx.scale(1 + sink * 0.25, Math.max(0.06, 1 - sink));
    const body = Rough.rectPts(-R * 0.8, -R * 0.45, R * 1.6, R * 1.15)
      .map(q => [q[0] + Rough.jit(3), q[1] + Rough.jit(3)]);
    ctx.globalAlpha = 1 - p * 0.35;
    Rough.scribble(ctx, body, { color: '#c9a36b', spacing: 7, width: 6, overflow: 1.12 });
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 3, jitter: 2.4 });
    ctx.restore();

    // dust rolling outward
    Rough.srand(999);
    for (let i = 0; i < 16; i++) {
      const a = Rough.rnd() * Math.PI * 2;
      const rise = E.out(E.clamp01(p * 1.4 - Rough.rnd() * 0.3));
      const d = R * (0.4 + rise * 1.5);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.45 * (1 - p));
      Rough.boil(700 + i, Math.floor(t * 3));
      Rough.circle(ctx, Math.cos(a) * d, Math.sin(a) * d * 0.45 + R * 0.4,
        6 + rise * 16, { color: '#b8b2a3', width: 2, jitter: 3 });
      ctx.restore();
    }

    // and what is left of it, scribbled out
    if (p > 0.55) {
      ctx.save();
      ctx.globalAlpha = E.clamp01((p - 0.55) / 0.35);
      Rough.srand(321);
      for (let i = 0; i < 9; i++) {
        const rx = -R * 0.8 + Rough.rnd() * R * 1.6;
        const ry = R * 0.45 + Rough.rnd() * R * 0.3;
        const s = 4 + Rough.rnd() * 7;
        const chunk = Rough.rectPts(rx, ry, s, s * 0.7).map(q => [q[0] + Rough.jit(1.5), q[1] + Rough.jit(1.5)]);
        Rough.scribble(ctx, chunk, { color: '#c9a36b', spacing: 4, width: 4, overflow: 1.15 });
        Rough.poly(ctx, chunk, { color: '#2b2b2b', width: 1.8, jitter: 1 });
      }
      ctx.restore();
    }
  },

  /* Five symmetrical segments, 20% of the castle each. */
  drawHpBar(ctx, x, y) {
    const segW = 22, gap = 5, n = CASTLE_HP;
    const totalW = segW * n + gap * (n - 1);
    const left = x - totalW / 2;
    Rough.boil(31, this.time * 0.4);

    for (let i = 0; i < n; i++) {
      const sx = left + i * (segW + gap);
      const pts = Rough.rectPts(sx, y - 7, segW, 14).map(p => [p[0] + Rough.jit(1.3), p[1] + Rough.jit(1.3)]);
      // fill fraction for this segment, eased so a lost segment drains out
      const f = Math.max(0, Math.min(1, this.hpShown - i));
      if (f > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx - 3, y - 12, segW * f + 3, 24);
        ctx.clip();
        Rough.scribble(ctx, pts, {
          color: this.castleHp <= 1 ? '#c8433a' : (this.castleHp <= 2 ? '#d99a26' : '#4c9f70'),
          spacing: 5, width: 5, overflow: 1.12, angle: -0.5
        });
        ctx.restore();
      }
      Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2, jitter: 1 });
    }
    ctx.save();
    ctx.globalAlpha = 0.75;
    Rough.text(ctx, Math.max(0, this.castleHp) + ' / ' + CASTLE_HP, x, y - 19, 13, '#6b6b6b');
    ctx.restore();
  }
};

window.addEventListener('load', () => Game.init());
