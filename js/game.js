/* FANDHARN - main game. Top-down doodle tower defense: one castle, five waves,
   and a cursor you have to click enemies to death with. */

const Game = {
  state: 'menu',            // menu | playing | waveclear | shop | gameover | victory
  canvas: null, ctx: null,
  w: 0, h: 0, dpr: 1,
  enemies: [], effects: [],
  difficulty: 'normal',
  wave: 0,
  castleHp: CASTLE_HP,
  castleRadius: 46,
  shield: 0,
  scribbles: 0,
  waveScribbles: 0,
  totalKills: 0,
  cursorId: 'plain',
  owned: { plain: true },
  upgrades: {},             // id -> level
  cursorCharge: 0,
  moltenCharge: 0,
  prevClick: null,
  pointer: { x: 0, y: 0, down: 0 },
  spawnLeft: 0, spawnTimer: 0, waveSpec: null,
  shakeAmt: 0, shakeX: 0, shakeY: 0,
  waveClear: null,
  bg: null,
  time: 0, last: 0,

  /* ------------------------------------------------------------ lifecycle */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    const c = this.canvas;
    c.addEventListener('mousemove', e => this.movePointer(e.clientX, e.clientY));
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
    // graph-paper blocks
    for (let x = 0; x <= this.w; x += BLOCK) {
      Rough.line(b, x, 0, x, this.h, { color: 'rgba(90,140,190,0.13)', width: 1, jitter: 1.2, passes: 1 });
    }
    for (let y = 0; y <= this.h; y += BLOCK) {
      Rough.line(b, 0, y, this.w, y, { color: 'rgba(90,140,190,0.13)', width: 1, jitter: 1.2, passes: 1 });
    }
    // faint margin smudges - kept in the paper's own blue so they never read
    // as enemies
    for (let i = 0; i < 10; i++) {
      const x = Rough.rnd() * this.w, y = Rough.rnd() * this.h;
      if (Math.hypot(x - this.w / 2, y - this.h / 2) < 260) continue;
      b.save();
      b.globalAlpha = 0.5;
      Rough.line(b, x, y, x + 12 + Rough.rnd() * 26, y + Rough.jit(10),
        { color: 'rgba(90,140,190,0.16)', width: 2, jitter: 2.5, passes: 1 });
      b.restore();
    }
    this.bg = bg;
  },

  start(diff) {
    this.difficulty = diff;
    this.enemies = [];
    this.effects = [];
    this.wave = 0;
    this.castleHp = CASTLE_HP;
    this.scribbles = 0;
    this.totalKills = 0;
    this.cursorId = 'plain';
    this.owned = { plain: true };
    this.upgrades = {};
    this.shield = 0;
    this.cursorCharge = 0;
    this.moltenCharge = 0;
    this.prevClick = null;
    this.waveClear = null;
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
      boss: !!spec.boss
    };
    this.spawnLeft = this.waveSpec.count;
    this.spawnTimer = 0.6;
    this.waveScribbles = 0;
    this.shield = this.upgrades.chalk || 0;   // ward is redrawn every wave
    this.state = 'playing';
    UI.hideAll();
    UI.syncHud(this);
  },

  /* ---------------------------------------------------------------- input */
  movePointer(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = cx - r.left;
    this.pointer.y = cy - r.top;
  },

  press() {
    this.pointer.down = 0.12;
    if (this.state === 'waveclear') {
      if (this.waveClear) this.waveClear.skip();
      return;
    }
    if (this.state !== 'playing') return;
    this.click(this.pointer.x - this.w / 2, this.pointer.y - this.h / 2);
  },

  click(x, y) {
    const cursor = cursorById(this.cursorId);
    this.cursorCharge++;
    this.moltenCharge++;

    // 1. the click itself: 2 damage, 10% crit for 50% more
    let target = null, bestDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.r + 8 && d < bestDist) { bestDist = d; target = e; }
    }
    if (target) {
      const crit = Math.random() < BASE_CRIT_CHANCE;
      const dmg = BASE_CLICK_DAMAGE * (crit ? CRIT_MULT : 1);
      target.hurt(dmg, this, { crit: crit });
      if (crit) {
        this.shake(3);
        const lv = this.upgrades.ink || 0;
        if (lv > 0) {
          this.effects.push(new InkPuddle(target.x, target.y, BLOCK * (1.2 + 0.3 * (lv - 1)), lv));
        }
      }
    } else {
      this.effects.push(new Crumb(x, y, '#c9c3b2'));
    }

    // 2. cursor weapon charge
    if (cursor.every > 0 && this.cursorCharge % cursor.every === 0) {
      const power = CursorPowers[cursor.id];
      if (power) power(this, x, y);
    }

    // 3. Molten Leftkey
    const molten = this.upgrades.molten || 0;
    if (molten > 0) {
      const need = [5, 4, 3][molten - 1];
      if (this.moltenCharge % need === 0) {
        this.effects.push(new FireBlast(x, y, BLOCK * 2, (BASE_CLICK_DAMAGE / 2), this));
      }
    }

    this.prevClick = { x: x, y: y };
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
    const gain = Math.max(1, Math.round((e.maxHp / 3) * DIFFICULTIES[this.difficulty].reward));
    this.scribbles += gain;
    this.waveScribbles += gain;
    this.totalKills++;
    UI.syncHud(this);
  },

  castleHit() {
    if (this.shield > 0) {
      this.shield--;
      this.effects.push(new FloatText(0, -this.castleRadius - 20, 'ward!', '#8ec5e8', 20, false));
      this.shake(8);
    } else {
      this.castleHp--;
      this.shake(16);
      this.effects.push(new FloatText(0, -this.castleRadius - 20, '-1', '#c8433a', 24, true));
      if (this.castleHp <= 0) {
        this.castleHp = 0;
        this.state = 'gameover';
        UI.showEnd(this, false);
      }
    }
    UI.syncHud(this);
  },

  shake(amount) { this.shakeAmt = Math.min(22, this.shakeAmt + amount); },

  spawnEnemy() {
    const w = this.waveSpec;
    const pool = this.wave <= 1 ? ['blob'] :
      this.wave === 2 ? ['blob', 'blob', 'dart'] :
        this.wave === 3 ? ['blob', 'dart', 'brick'] :
          ['blob', 'dart', 'dart', 'brick'];
    let kind = pool[Math.floor(Math.random() * pool.length)];
    if (w.boss && this.spawnLeft === w.count - 2) kind = 'boss';
    const k = ENEMY_KINDS[kind];
    // just outside the visible paper, so they walk on screen right away
    const mx = this.w / 2 + 50, my = this.h / 2 + 50;
    let sx, sy;
    if (Math.random() < 0.5) {
      sx = (Math.random() * 2 - 1) * mx;
      sy = (Math.random() < 0.5 ? -1 : 1) * my;
    } else {
      sx = (Math.random() < 0.5 ? -1 : 1) * mx;
      sy = (Math.random() * 2 - 1) * my;
    }
    const hp = Math.max(2, Math.round(w.hp * k.hpMul));
    const e = new Enemy(kind, hp, w.speed * k.speedMul, sx, sy);
    this.enemies.push(e);
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
    if (this.pointer.down > 0) this.pointer.down -= dt;
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
      this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
    } else { this.shakeX = this.shakeY = 0; }

    if (this.state === 'waveclear') {
      if (this.waveClear && !this.waveClear.update(dt)) this.finishWaveClear();
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

    if (this.state === 'playing' && this.spawnLeft === 0 && this.enemies.length === 0) {
      const isFinal = this.wave >= WAVES_PER_RUN;
      this.waveClear = new WaveClear(this.wave, this.waveScribbles, this.castleHp, CASTLE_HP, isFinal);
      this.state = 'waveclear';
    }
  },

  finishWaveClear() {
    this.waveClear = null;
    if (this.wave >= WAVES_PER_RUN) {
      this.state = 'victory';
      UI.showEnd(this, true);
    } else {
      this.state = 'shop';
      UI.showShop(this);
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
      this.drawCastle(ctx);
      for (const f of this.effects) if (f instanceof InkPuddle) f.draw(ctx, this.time);
      for (const e of this.enemies) e.draw(ctx, this.time);
      for (const f of this.effects) if (!(f instanceof InkPuddle)) f.draw(ctx, this.time);
    }
    ctx.restore();

    if (this.state === 'waveclear' && this.waveClear) {
      this.waveClear.draw(ctx, this.w, this.h, this.time);
    }

    if (this.state === 'playing' || this.state === 'waveclear') {
      const cur = cursorById(this.cursorId);
      drawCursor(ctx, cur, this.pointer.x, this.pointer.y,
        this.cursorCharge, cur.every, this.pointer.down > 0);
    }
  },

  drawCastle(ctx) {
    const t = this.time;
    Rough.boil(7, t * 0.35);
    const R = this.castleRadius;

    // chalk ward
    if (this.shield > 0) {
      for (let i = 0; i < this.shield; i++) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        Rough.circle(ctx, 0, 0, R + 16 + i * 7, { color: '#8ec5e8', width: 3, jitter: 3.5 });
        ctx.restore();
      }
    }

    const body = Rough.rectPts(-R * 0.8, -R * 0.45, R * 1.6, R * 1.15)
      .map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
    Rough.scribble(ctx, body, { color: '#c9a36b', spacing: 7, width: 6, overflow: 1.12 });
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 3, jitter: 1.3 });

    // three merlons on top
    for (let i = -1; i <= 1; i++) {
      const m = Rough.rectPts(i * R * 0.5 - R * 0.17, -R * 0.78, R * 0.34, R * 0.35)
        .map(p => [p[0] + Rough.jit(1.6), p[1] + Rough.jit(1.6)]);
      Rough.scribble(ctx, m, { color: '#c9a36b', spacing: 6, width: 5, overflow: 1.15 });
      Rough.poly(ctx, m, { color: '#2b2b2b', width: 2.4, jitter: 1.1 });
    }

    // door
    const door = Rough.rectPts(-R * 0.2, R * 0.16, R * 0.4, R * 0.54)
      .map(p => [p[0] + Rough.jit(1.4), p[1] + Rough.jit(1.4)]);
    Rough.scribble(ctx, door, { color: '#7a5a38', spacing: 5, width: 5, overflow: 1.1 });
    Rough.poly(ctx, door, { color: '#2b2b2b', width: 2.2, jitter: 1 });

    // three hearts above the castle
    for (let i = 0; i < CASTLE_HP; i++) {
      const hx = (i - 1) * 26, hy = -R - 26;
      this.drawHeart(ctx, hx, hy, 9, i < this.castleHp);
    }
  },

  drawHeart(ctx, x, y, s, filled) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = s * (1 + 0.32 * Math.sin(a * 2) * Math.sign(Math.sin(a)));
      pts.push([x + Math.cos(a - Math.PI / 2) * r * 1.05,
      y + Math.sin(a - Math.PI / 2) * r + (Math.sin(a) < 0 ? -s * 0.22 : s * 0.18)]);
    }
    if (filled) Rough.scribble(ctx, pts, { color: '#c8433a', spacing: 4, width: 4, overflow: 1.18 });
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.2, jitter: 1 });
  }
};

window.addEventListener('load', () => Game.init());
