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
  maxHp: CASTLE_HP,         // Thick Paper raises this
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
  doubleId: null,           // Double Trouble's borrowed half
  doubleTurn: 0,            // which of the two fires next
  ghostTrail: [],           // Afterimage: where the cursor has been
  ghostQueue: [],           // and the clicks it still owes
  hold: null,               // the Sledgehammer, while it is being held up
  sentry: null,
  sentryType: null,         // 'stick' or 'blobd' - there is only one post
  blotKilled: false,        // the Blot has gone down at least once this run
  eagleKilled: false,       // so has the Thunder Eagle
  trapperBuys: 0,           // every one bought bites harder
  coinsRun: 0,              // coins earned this run, for the end card
  endless: false,           // the run keeps going past wave 10
  stillT: 0,                // how long the hand has been off the page
  lastPointer: { x: 0, y: 0 },
  lawnBurnt: false,         // the Queen's lava only gets the lawn once
  augerAt: [],              // which spawns this wave are Augers
  spawnQueue: [],           // born this frame, joins at the next flush
  skillCharge: 0,           // clicks banked toward the skill
  skillCd: 0,               // seconds until it can be cast again
  skillAnnounced: false,
  cinematic: null,          // the cast playing out, if any
  slowT: 0, slowScale: 1,   // a short drag on time, for moments like a boss dying
  paused: false,
  touchMode: false,         // a touch was seen, so show the skill button
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
    Settings.load();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    const c = this.canvas;
    c.addEventListener('mousemove', e => this.movePointer(e.clientX, e.clientY));
    c.addEventListener('mouseleave', () => { this.pointer.inside = false; });
    c.addEventListener('mousedown', e => {
      e.preventDefault();
      this.movePointer(e.clientX, e.clientY);
      if (e.button === 2) this.castSkill();    // right-click is the skill now
      else if (e.button === 0) this.press();
    });
    c.addEventListener('mouseup', e => { this.pointer.down = 0; if (e.button === 0) this.releaseHold(); });
    c.addEventListener('touchstart', e => {
      e.preventDefault();
      if (!this.touchMode) { this.touchMode = true; UI.showSkillButton(); }
      const t = e.changedTouches[0];
      this.movePointer(t.clientX, t.clientY);
      this.press();
    }, { passive: false });
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.movePointer(t.clientX, t.clientY);
    }, { passive: false });
    c.addEventListener('touchend', e => { e.preventDefault(); this.pointer.down = 0; this.releaseHold(); }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());

    Sfx.init();
    UI.bind(this);
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    this.dpr = Settings.data.low ? 1 : Math.min(2, window.devicePixelRatio || 1);   // low graphics: one pixel per pixel
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
     compass circle. Pre-rendered - and redrawn once, in ash, if the Queen's
     lava ever comes down on it. */
  buildGround(burnt) {
    const wash = burnt ? '#c9bda8' : '#d8ecc4';
    const coats = burnt ? ['#7a6a55', '#9a8a70', '#8a7a60'] : ['#9dc98a', '#b7d9a0', '#c8dfa0'];
    const speck = burnt ? '#3a2f22' : '#5f7d4a';
    const rim = burnt ? '#5c4a32' : '#7fae6b';
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
    c.fillStyle = wash;
    c.beginPath();
    outer.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.closePath();
    c.fill();
    c.restore();

    // two crayon passes crossing each other at different angles
    Rough.scribble(c, outer, { color: coats[0], spacing: 11, width: 9, overflow: 1.05, angle: -0.55, alpha: burnt ? 0.42 : 0.34 });
    Rough.scribble(c, outer, { color: coats[1], spacing: 13, width: 8, overflow: 1.04, angle: 0.75, alpha: 0.26 });
    Rough.scribble(c, inner, { color: coats[2], spacing: 12, width: 8, overflow: 1.06, angle: 0.2, alpha: 0.22 });
    Rough.grain(c, outer, speck, burnt ? 0.009 : 0.004, 33);

    c.save();
    c.globalAlpha = 0.45;
    Rough.poly(c, outer, { color: rim, width: 2.6, jitter: 3.4 });
    c.restore();

    // tufts of grass around the rim
    Rough.srand(99);
    for (let i = 0; i < 30; i++) {
      const a = Rough.rnd() * Math.PI * 2;
      const rr = GROUND_RADIUS * (0.74 + Rough.rnd() * 0.3);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      c.save();
      c.globalAlpha = 0.45;
      Rough.line(c, x, y, x + Rough.jit(4), y - (burnt ? 2 : 4) - Rough.rnd() * (burnt ? 3 : 6),
        { color: rim, width: 1.8, jitter: 1, passes: 1 });
      c.restore();
    }
    this.ground = { canvas: g, size: size };
  },

  start(diff, endless) {
    this.difficulty = diff;
    this.endless = !!endless;
    this.enemies = [];
    this.effects = [];
    this.wave = 0;
    this.castleHp = CASTLE_HP;
    this.maxHp = CASTLE_HP;
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
    this.doubleId = null;
    this.doubleTurn = 0;
    this.ghostTrail = [];
    this.ghostQueue = [];
    this.hold = null;
    this.sentry = null;
    this.sentryType = null;
    this.blotKilled = false;
    this.eagleKilled = false;
    this.trapperBuys = 0;
    this.coinsRun = 0;
    this.chestsRun = 0;
    this.runBosses = 0;          // bosses down this run, for the Endless achievement
    this.onlyPlain = true;       // no other cursor picked up this run
    this.boughtAny = false;      // nothing bought at all, for Window Shopper
    this.playerStun = 0;         // Ignis's roar
    this.cutscene = false;       // Ignis's entrance and death: hands off
    this.achRun = [];
    this.stillT = 0;
    this.lawnBurnt = false;
    this.spawnQueue = [];
    this.buildGround(false);
    this.offerScreen = null;
    this.skillCharge = 0;
    this.skillCd = 0;
    this.skillAnnounced = false;
    this.cinematic = null;
    this.slowT = 0;
    this.paused = false;
    this.cutscene = false;
    this.playerStun = 0;
    IgnisHud.lb = 0;
    Protector.reset();
    // the worn relic, where it acts from the very start
    if (Relics.val('tape')) { this.maxHp += 1; this.castleHp += 1; this.hpShown += 1; }
    this.scribbles += 15 * Relics.val('bookmark');
    UI.hideAll();
    this.startWave();
  },

  startWave() {
    this.wave++;
    const d = DIFFICULTIES[this.difficulty];
    const spec = waveSpecAt(this.wave);
    this.waveSpec = {
      count: Math.max(3, Math.round(spec.count * d.countMul)),
      hp: spec.hp * d.hpMul,
      speed: spec.speed * d.speedMul,
      interval: spec.interval * d.intervalMul,
      boss: spec.boss || null,
      hpScale: spec.hpScale || 1,
      bossMul: spec.bossMul || 1
    };
    this.spawnLeft = this.waveSpec.count;
    this.spawnTimer = 1.1;
    // from wave 14, in any mode, Augers hide in the crowd - never the first
    // thing through the door, never on the boss's slot, never on Ignis's wave:
    // none or one on 14 and 16, one or two from 17 on
    this.augerAt = [];
    if (this.wave >= AUGER_FROM_WAVE && this.wave !== IGNIS_WAVE) {
      const slots = [];
      for (let i = 0; i <= this.waveSpec.count - 3; i++) slots.push(i);
      const n = this.wave < 17 ? (Math.random() < 0.5 ? 1 : 0) : (Math.random() < 0.5 ? 2 : 1);
      while (this.augerAt.length < n && slots.length) {
        this.augerAt.push(slots.splice(Math.floor(Math.random() * slots.length), 1)[0]);
      }
    }
    this.waveScribbles = 0;
    if (this.oneshot.chalk) this.shield = 2;     // the ward is re-drawn every wave
    this.state = 'playing';
    Sfx.play('wave_start', { volume: 0.6 });
    // which boss it is gets settled now, so the banner can name the right one
    const boss = this.waveSpec.boss;
    this.bossKind = !boss ? null
      : boss === 'boss' ? (Math.random() < 0.5 ? 'eagle' : 'boss')
        : boss === 'warden' ? (Math.random() < 0.5 ? 'hive' : 'warden')
          : boss;
    const BOSS_LINE = { warden: 'the warden is coming', hive: 'the hive is coming', ignis: 'the ground is moving' };
    if (boss === 'ignis') {
      // no crowd: just him, climbing out of the ground (js/ignis.js)
      this.spawnLeft = 0;
      this.augerAt = [];
      Ignis.spawn(this);
    }
    this.banner = boss
      ? new WaveBanner('WAVE ' + this.wave, BOSS_LINE[this.bossKind] || 'a mini boss is coming', '#c8433a')
      : new WaveBanner('WAVE ' + this.wave,
        (!this.endless && this.wave === WAVES_PER_RUN) ? 'last one' : '', '#2b2b2b');
    UI.hideAll();
    UI.syncHud(this);
  },

  /* --------------------------------------------------------------- stats */
  clickDamage() { return cursorById(this.cursorId).dmg + 0.5 * (this.stacking.lead || 0) + 0.3 * Relics.val('lead'); },
  critChance() { return BASE_CRIT_CHANCE + 0.03 * (this.stacking.nib || 0) + 0.02 * Relics.val('pebble'); },
  aoeScale() { return 1 + 0.12 * (this.stacking.wax || 0); },
  aoeDamage(base) { return base * (1 + 0.10 * (this.stacking.wax || 0)); },
  statusBonus() { return 0.3 * (this.stacking.deepink || 0); },   // Deep Ink
  skillReady() { return this.skillCharge >= SKILL_CHARGE && this.skillCd <= 0 && !this.cinematic; },

  buyOffer(off) {
    this.scribbles -= off.cost;
    this.boughtAny = true;
    if (off.kind === 'cursor') {
      this.cursorId = off.id;                 // the old cursor is gone for good
      this.onlyPlain = false;
      this.cursorCharge = 0;
      this.skillAnnounced = false;            // a new cursor means a new skill
      this.penTrail = off.id === 'pen' ? new PenTrail() : null;
    } else if (off.kind === 'oneshot') {
      // a sentry is not owned, it is employed - the post can change hands
      if (!SENTRY_OF[off.id]) this.oneshot[off.id] = true;
      if (off.id === 'chalk') this.shield = 2;
      if (off.id === 'double') { this.rollDouble(); this.onlyPlain = false; }
      if (off.id === 'sentry') this.installSentry('stick');
      if (off.id === 'blobd') this.installSentry('blobd');
      if (off.id === 'bird') this.installSentry('bird');
      if (off.id === 'trapper') {
        // every Trapper bought bites harder; buying it while it already holds
        // the post just sharpens the one standing there
        this.trapperBuys++;
        if (this.sentryType === 'trapper') {
          this.effects.push(new FloatText(this.sentry.homeX, this.sentry.homeY - 30,
            'bite ' + this.trapperDamage(), '#5e9e3a', 20, true));
          UI.syncHud(this);
        } else this.installSentry('trapper');
      }
      if (off.id === 'molten') this.moltenCharge = 0;
      if (off.id === 'paper') { this.maxHp++; this.castleHp++; }   // the new segment starts full
    } else {
      const lv = (this.stacking[off.id] || 0) + 1;
      this.stacking[off.id] = lv;
      if (off.id === 'patch') this.castleHp = Math.min(this.maxHp, this.castleHp + 1);
    }
    UI.syncHud(this);
  },

  /* ---------------------------------------------------------------- input */
  /* How much the Electric Bird's dash timer has been shortened by holding
     still. Nothing counts for the first two seconds; after that every second
     is worth another tenth. Moving or clicking wipes it. */
  stillBonus() {
    return Math.max(0, this.stillT - 2) * 0.1;
  },

  movePointer(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = cx - r.left;
    this.pointer.y = cy - r.top;
    this.pointer.inside = true;
    if (this.state === 'offers' && this.offerScreen) {
      this.offerScreen.move(this.pointer.x, this.pointer.y, this.w, this.h);
    } else if (this.state === 'playing' && this.penTrail) {
      const pw = Depth.toWorld(this, this.pointer.x, this.pointer.y);
      this.penTrail.add(pw.x, pw.y);
    }
  },

  press() {
    if (this.paused) return;
    if (this.cutscene && this.state === 'playing') return;        // Ignis's entrance and death
    if (this.playerStun > 0 && this.state === 'playing') {         // his roar knocked your hand off
      Sfx.play('click_miss', { volume: 0.3, throttle: 80 });
      return;
    }
    this.pointer.down = 0.13;
    if (this.state === 'offers' && this.offerScreen) {
      this.offerScreen.click(this.pointer.x, this.pointer.y, this.w, this.h);
      return;
    }
    if (this.state !== 'playing') return;
    const { x, y } = Depth.toWorld(this, this.pointer.x, this.pointer.y);   // through the same shift as the drawing
    if (cursorById(this.cursorId).hold) {
      // the Sledgehammer: a press only picks things up and starts the wind-up
      this.stillT = 0;
      if (this.pickup(x, y)) return;
      this.hold = { t: 0, tier: -1 };
      Sfx.play('hammer_lift', { volume: 0.6, throttle: 60 });
      return;
    }
    this.click(x, y);
    // Afterimage: the ghost repeats this click a third of a second later. It
    // was drawn but never told about a click, so it never hit anything.
    if (this.oneshot.afterimage) this.ghostQueue.push({ x, y, at: this.time + 0.33 });
  },

  /* Anything lying on the floor under the pointer gets picked up. */
  pickup(x, y) {
    for (const f of this.effects) {
      if (f instanceof BlobdDrop && f.tryTake(x, y, this)) return true;
      if (f instanceof BirdDrop && f.tryTake(x, y, this)) return true;
    }
    return false;
  },

  /* Let go of the Sledgehammer. Under a second it does nothing at all. */
  releaseHold() {
    const h = this.hold;
    if (!h) return;
    this.hold = null;
    if (this.state !== 'playing' || this.paused) return;
    const { x, y } = Depth.toWorld(this, this.pointer.x, this.pointer.y);
    const mult = hammerMult(h.t);
    if (!mult) {
      this.effects.push(new FloatText(x, y - 26, 'hold it', '#9a958a', 16, false));
      Sfx.play('click_miss', { volume: 0.4, throttle: 40 });
      return;
    }
    this.slam(x, y, mult, false);
  },

  /* The Sledgehammer coming down: everything within reach takes the hit. */
  slam(x, y, mult, ghost) {
    if (!ghost && Ignis.boneClick(this, x, y)) return;           // his bones want clicking, not slamming for damage
    const tier = Math.round((mult - 1) / HAMMER_STEP);
    if (!ghost) {                             // one slam is worth a few clicks of skill charge
      this.cursorCharge++;
      this.moltenCharge++;
      this.skillCharge = Math.min(SKILL_CHARGE, this.skillCharge + 3 + tier);
    }
    const crit = !ghost && Math.random() < this.critChance();
    const dmg = this.clickDamage() * mult * (crit ? CRIT_MULT : 1) * (ghost ? 0.5 : 1);
    const R = HAMMER_RADIUS * this.aoeScale();
    this.areaDamage(x, y, R, dmg, { crit, color: '#6b5a4a' });
    // Mjolnir brings lightning down with it; the hit above is the same either way
    const Look = cursorLook('hammer').slam === 'lightning' ? MjolnirStrike : HammerSlam;
    this.effects.push(new Look(x, y, R, tier, this));
    this.effects.push(new HitSpark(x, y, '#6b5a4a', crit || tier === 2));
    this.shake(5 + tier * 4);
    Sfx.play('hammer_slam', { volume: 0.75 + tier * 0.12, rateVar: 0.05, throttle: 40 });
    if (!ghost && crit && this.oneshot.ink) {
      this.effects.push(new InkPuddle(x, y, BLOCK * 1.4 * this.aoeScale(), this.aoeDamage(2), 4 + this.statusBonus()));
    }
    if (!ghost && this.oneshot.molten && this.moltenCharge % 5 === 0) {
      this.effects.push(new FireBlast(x, y, BLOCK * 2 * this.aoeScale(), this.aoeDamage(this.clickDamage() / 2), this));
      Sfx.play('fire_blast', { volume: 0.65, throttle: 90 });
    }
    if (!ghost && this.oneshot.afterimage) this.ghostQueue.push({ x, y, at: this.time + 0.33, mult });
    UI.syncHud(this);
  },

  click(x, y, opts_ghost) {
    if (!opts_ghost) this.stillT = 0;        // clicking is not standing still
    if (this.pickup(x, y)) return;            // anything lying on the floor comes first
    if (!opts_ghost && Ignis.boneClick(this, x, y)) return;       // Ignis's bones, two clicks to wake

    const cursor = cursorById(this.cursorId);
    if (!opts_ghost) {                       // the ghost charges nothing
      this.cursorCharge++;
      this.moltenCharge++;
      if (this.skillCharge < SKILL_CHARGE) this.skillCharge++;
    }

    let target = null, bestDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.r + 8 && d < bestDist) { bestDist = d; target = e; }
    }

    if (target) {
      const crit = !opts_ghost && Math.random() < this.critChance();
      const bite = this.clickDamage() * (crit ? CRIT_MULT : 1) * (opts_ghost ? 0.5 : 1);
      target.hurt(bite, this, { crit });
      this.effects.push(new ClickRipple(x, y, crit ? '#e0562d' : cursor.color, crit));
      this.effects.push(new HitSpark(x, y, cursor.color, crit));
      Sfx.play(crit ? 'crit' : 'click_hit', { throttle: 25, volume: crit ? 0.9 : 0.55, voices: 6 });
      const onHit = CursorOnHit[cursor.id];
      if (onHit) onHit(this, target);
      if (crit) {
        this.shake(3);
        if (this.oneshot.ink) {
          this.effects.push(new InkPuddle(target.x, target.y, BLOCK * 1.4 * this.aoeScale(),
            this.aoeDamage(2), 4 + this.statusBonus()));
          Sfx.play('ink_splat', { volume: 0.5, throttle: 120 });
        }
      }
    } else {
      this.effects.push(new ClickRipple(x, y, '#b8b2a3', false));
      Sfx.play('click_miss', { throttle: 25, volume: 0.35, voices: 4 });
    }

    if (cursor.every > 0 && this.cursorCharge % cursor.every === 0) {
      let firing = cursor.id;
      if (this.oneshot.double && this.doubleId) {      // take it in turns
        firing = this.doubleTurn % 2 === 0 ? cursor.id : this.doubleId;
        this.doubleTurn++;
      }
      const power = CursorPowers[firing];
      if (power) power(this, x, y);
    }

    if (!opts_ghost && this.oneshot.molten && this.moltenCharge % 5 === 0) {
      this.effects.push(new FireBlast(x, y, BLOCK * 2 * this.aoeScale(), this.aoeDamage(this.clickDamage() / 2), this));
      Sfx.play('fire_blast', { volume: 0.65, throttle: 90 });
    }

    UI.syncHud(this);
  },

  /* Fired by hand only: right-click, or the corner button on a touchscreen. */
  castSkill() {
    if (this.state !== 'playing' || this.cinematic || this.paused || this.cutscene || this.playerStun > 0) return;
    if (!this.skillReady()) {
      Sfx.play('click_miss', { volume: 0.5 });
      const why = this.skillCd > 0 ? Math.ceil(this.skillCd) + 's' : (SKILL_CHARGE - this.skillCharge) + ' clicks';
      const pw = Depth.toWorld(this, this.pointer.x, this.pointer.y);
      this.effects.push(new FloatText(pw.x, pw.y - 20,
        why, '#b8b2a3', 16, false));
      return;
    }
    this.skillCharge = 0;
    this.skillCd = SKILL_COOLDOWN * (1 - 0.05 * Relics.val('sharpener'));
    this.skillAnnounced = false;
    this.cinematic = new SkillCinematic(this, this.cursorId,
      Depth.toWorld(this, this.pointer.x, this.pointer.y).x, Depth.toWorld(this, this.pointer.x, this.pointer.y).y);
    Sfx.play('skill_charge', { volume: 0.95, rateVar: 0 });
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
    Save.kill(e.kind);
    Sfx.play(e.boss || e.kind === 'brick' ? 'kill_big' : 'kill',
      { volume: e.boss ? 1 : 0.5, throttle: e.boss ? 0 : 45, voices: 4 });
    if (ENEMY_KINDS[e.kind] && ENEMY_KINDS[e.kind].boss) Achievements.onBossKilled(this, e);
    const credit = (1 + 0.05 * (this.stacking.credit || 0)) * (1 + 0.04 * Relics.val('goldstar'));
    const gain = Math.max(1, Math.round((1 + e.maxHp / 5) * DIFFICULTIES[this.difficulty].reward * credit));
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
      this.effects.push(new CastleBurst(this));
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

  togglePause() {
    if (this.state !== 'playing' && this.state !== 'offers') return this.paused;
    this.paused = !this.paused;
    UI.paintPause(this.paused);
    Sfx.play('button', { volume: 0.6 });
    return this.paused;
  },

  slowmo(seconds, scale) {
    this.slowT = Math.max(this.slowT, seconds);
    this.slowScale = scale;
  },

  /* Effects can spawn other effects while they update - a cloud drops its
     bolt, a drop pops into a splash. A filter() would build its new array
     from the old one and quietly lose those, so walk the live array by index
     instead and let anything added mid-pass survive. */
  updateEffects(dt) {
    const live = [];
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i];
      if (fx.update(dt, this)) live.push(fx);
    }
    this.effects = live;
  },

  spawnEnemy() {
    const w = this.waveSpec;
    const stage = Math.min(4, Math.ceil(this.wave / 2));
    const pool = stage <= 1 ? ['blob'] :
      stage === 2 ? ['blob', 'blob', 'dart'] :
        stage === 3 ? ['blob', 'dart', 'brick'] :
          ['blob', 'dart', 'dart', 'brick', 'brick'];
    let kind = pool[Math.floor(Math.random() * pool.length)];
    if (w.boss && this.spawnLeft === w.count - 2) kind = this.bossKind || w.boss;
    if (this.augerAt && this.augerAt.includes(this.spawnLeft)) kind = 'auger';

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
    const hp = rolledHp(kind, w, w.hp);
    const spawned = new Enemy(kind, hp, w.speed * k.speedMul, sx, sy);
    this.enemies.push(spawned);
    if (kind === 'hive') this.hitchHaulers(spawned, w);
    if (kind === 'auger') {
      this.shake(8);
      Sfx.play('auger_screech', { volume: 1, rateVar: 0.05 });
      this.effects.push(new SpawnMark(sx, sy, k.r * 2.2));
    }
    if (kind === 'boss' || kind === 'warden' || kind === 'eagle' || kind === 'hive') {
      this.shake(10);
      Sfx.play(kind === 'hive' ? 'hive_drone' : 'boss_spawn', { volume: 1, rateVar: 0.02 });
      this.effects.push(new SpawnMark(sx, sy, k.r * 1.6));
    }
  },

  /* Double Trouble borrows a random other cursor's half - and its trick. */
  rollDouble() {
    const pool = CURSORS.filter(c => c.id !== this.cursorId && c.id !== 'plain' && CursorPowers[c.id]);
    this.doubleId = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : 'wet';
    this.doubleTurn = 0;
    this.effects.push(new FloatText(0, -this.castleRadius - 40,
      cursorLook(this.doubleId).name, cursorLook(this.doubleId).color, 19, false));
  },

  /* The castle has one sentry post. Whoever moves in evicts whoever was
     there - a stick figure, or the lump the Blot left behind. */
  installSentry(type) {
    const had = this.sentryType;
    this.sentryType = type;
    this.sentry = new Sentry(-this.castleRadius - 26, 14, type);
    if (had && had !== type) {
      const gone = { stick: 'stick out', blobd: "blob'd out", bird: 'bird out', trapper: 'trap out' };
      this.effects.push(new FloatText(-this.castleRadius - 26, -6,
        gone[had] || 'out', '#6b6b6b', 15, false));
    }
    UI.syncHud(this);
  },

  /* Coins go straight into the save, so nothing earned can be lost to a
     crash or a closed tab afterwards. */
  earnCoins(n) {
    if (!(n > 0)) return;
    Save.addCoins(n);
    this.coinsRun += n;
    this.effects.push(new CoinPop(n));
    Sfx.play('card_buy', { volume: 0.9, rateVar: 0 });
  },

  /* Chests go into the save the moment they are earned, like coins. */
  earnChest(n) {
    if (!(n > 0)) return;
    Save.addChests(n);
    this.chestsRun += n;
    this.effects.push(new FloatText(0, -this.h * 0.24, '+' + n + ' chest', '#9a6a36', 24, true));
  },

  /* How hard the Trapper bites: 6 for the first one bought, 1 more for every
     one bought after, never past 10. */
  trapperDamage() {
    return Math.min(TRAPPER_MAX_DMG, TRAPPER_BASE_DMG + Math.max(0, this.trapperBuys - 1));
  },

  /* Every hit a sentry lands goes through here, so the Drill can make it crit
     the way a click does. */
  sentryHurt(e, dmg, opts) {
    opts = Object.assign({}, opts);
    if (this.oneshot.drill && Math.random() < SENTRY_CRIT_CHANCE) {
      dmg *= CRIT_MULT;
      opts.crit = true;
      this.effects.push(new HitSpark(e.x, e.y, opts.color || '#2b2b2b', true));
    }
    return e.hurt(dmg, this, opts);
  },

  /* The Hive does not fly. Ten workers drag it in on strands, and while any
     of them is still pulling, nothing lands on the nest. */
  hitchHaulers(hive, w) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const worker = this.spawnMinion('worker',
        hive.x + Math.cos(a) * (hive.r + 22), hive.y + Math.sin(a) * (hive.r + 22),
        0, w.speed);
      worker.tether = hive;
      worker.tetherA = a;
      worker.spawnT = 0.6;
      worker.untouchable = true;
      hive.workers.push(worker);
    }
  },

  /* Summoned mid-fight by a boss skill, rather than by the wave spawner.

     The new one waits in a queue instead of joining `enemies` on the spot.
     Area damage walks that array while it deals its damage, so anything born
     mid-sweep - the Queen out of the Hive, blotlings out of the Blot - used to
     land in the list the sweep was still reading and get killed by the very
     blast that spawned its parent. The caller still gets the object back and
     can set it up; it joins the fight at the next flush. */
  spawnMinion(kind, x, y, hp, speed) {
    const k = ENEMY_KINDS[kind];
    const rolled = rolledHp(kind, this.waveSpec, hp);
    const e = new Enemy(kind, rolled, speed * k.speedMul, x, y);
    this.spawnQueue.push(e);
    return e;
  },

  /* Everything born since the last flush joins the fight. */
  flushSpawns() {
    if (!this.spawnQueue.length) return;
    for (const e of this.spawnQueue) if (!e.dead) this.enemies.push(e);
    this.spawnQueue.length = 0;
  },

  /* ----------------------------------------------------------------- loop */
  frame(now) {
    // never negative: the first animation-frame timestamp can land a hair
    // before the performance.now() it is measured from, and a negative step
    // runs spawn-ins backwards (an enemy with a negative size throws)
    let dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    // low graphics runs at a steady 30: every other frame is skipped whole,
    // its time carried into the next, so nothing moves slower - just in
    // fewer, evener steps, which on a weak phone beats a ragged 40
    if (Settings.data.low) {
      this.acc = (this.acc || 0) + dt;
      if (this.acc < 1 / 31) { requestAnimationFrame(t => this.frame(t)); return; }
      dt = this.acc; this.acc = 0;
    }
    // the governor reads the real frame time, before it is capped - a tab
    // switch is clipped so one long gap cannot condemn the machine
    if (this.state === 'playing' && !this.paused) Fx.sample(Math.min(dt, 0.1));
    if (dt > 0.05) dt = 0.05;
    this.time += dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.frame(t));
  },

  update(dt) {
    if (this.state === 'menu') { MenuScene.update(dt); return; }
    if (this.paused) return;
    if (this.hold) {
      if (this.state !== 'playing') this.hold = null;
      else {
        this.hold.t += dt;
        const tier = this.hold.t >= HAMMER_MIN ? Math.min(2, Math.floor(this.hold.t - HAMMER_MIN + 1e-6)) : -1;
        if (tier !== this.hold.tier) {        // a notch for every step it gains
          this.hold.tier = tier;
          if (tier >= 0) Sfx.play('hammer_tick', { volume: 0.5 + tier * 0.15, rate: 1 + tier * 0.12, rateVar: 0 });
        }
        if (this.hold.t >= HAMMER_MAX) this.releaseHold();
      }
    }
    if (this.pointer.down > 0) this.pointer.down = Math.max(0, this.pointer.down - dt);

    // a hand that has not moved is winding the bird up
    if (Math.hypot(this.pointer.x - this.lastPointer.x, this.pointer.y - this.lastPointer.y) > 2) {
      this.stillT = 0;
      this.lastPointer.x = this.pointer.x;
      this.lastPointer.y = this.pointer.y;
    } else {
      this.stillT += dt;
    }
    if (this.castleHitT > 0) this.castleHitT = Math.max(0, this.castleHitT - dt / 0.5);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.6);
    this.hpShown += (this.castleHp - this.hpShown) * Math.min(1, dt * 7);
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 42);
      this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
    } else { this.shakeX = this.shakeY = 0; }
    if (this.banner && !this.banner.update(dt)) this.banner = null;

    if (this.skillCd > 0) {
      this.skillCd = Math.max(0, this.skillCd - dt);
      if (this.skillCd === 0) UI.syncHud(this);
    }
    if (!this.skillAnnounced && this.skillReady() && this.state === 'playing') {
      this.skillAnnounced = true;
      Sfx.play('skill_ready', { volume: 0.7 });
      this.effects.push(new FloatText(0, -this.castleRadius - 54, skillLook(this.cursorId).name + ' READY',
        cursorLook(this.cursorId).color, 20, false));
      UI.syncHud(this);
    }

    // a cast, or a boss going down, drags the world into slow motion. While
    // a cast is on screen the enemies stop dead - the skill is the thing you
    // are meant to be watching.
    let scale = 1;
    this.frozen = false;
    if (this.cinematic) {
      scale = this.cinematic.timeScale;
      this.frozen = this.cinematic.t < this.cinematic.freezeUntil;
      if (!this.cinematic.update(dt, this)) { this.cinematic = null; this.frozen = false; }
    }
    if (this.slowT > 0) {
      this.slowT = Math.max(0, this.slowT - dt);
      scale = Math.min(scale, this.slowScale + (1 - this.slowScale) * (1 - Math.min(1, this.slowT / 0.45)));
    }
    dt *= scale;

    if (this.state === 'collapsing') {
      this.collapse += dt;
      this.updateEffects(dt);
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
      this.updateEffects(dt);
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

    for (const e of this.enemies) if (!e.dead) Save.see(e.kind);
    if (!this.frozen) for (const e of this.enemies) if (!e.dead) e.update(dt, this);
    this.flushSpawns();
    this.enemies = this.enemies.filter(e => !e.dead);
    this.updateEffects(dt);
    this.flushSpawns();               // before the wave-clear check below
    if (this.penTrail) this.penTrail.update(dt, this);
    if (this.oneshot.afterimage) {
      this.ghostTrail.push({ x: this.pointer.x, y: this.pointer.y, at: this.time });
      while (this.ghostTrail.length && this.time - this.ghostTrail[0].at > 0.45) this.ghostTrail.shift();
      while (this.ghostQueue.length && this.ghostQueue[0].at <= this.time) {
        const q = this.ghostQueue.shift();
        if (q.mult) this.slam(q.x, q.y, q.mult, true);
        else this.click(q.x, q.y, true);
      }
    }
    if (this.sentry) this.sentry.update(dt, this);
    Protector.update(dt, this);            // the Protector relic's shields
    if (this.playerStun > 0) this.playerStun = Math.max(0, this.playerStun - dt);
    if (this.wave >= 12 && this.wave <= IGNIS_WAVE) IgnisSheet.warm(3);   // draw Ignis's frames ahead of him, a few ms a frame

    if (this.state === 'playing' && this.spawnLeft === 0 && this.enemies.length === 0) {
      this.banner = null;
      Sfx.play('wave_clear', { volume: 0.75 });
      // every tenth wave out in endless pays coins, and pays them now - a run
      // that dies at wave 27 keeps what it earned at 10 and 20
      if (this.wave === 10) Achievements.onWave10(this);
      if (this.endless && this.wave % COIN_RULES.every === 0) {
        this.earnCoins(coinsForEndlessMilestone(this.difficulty, this.wave / COIN_RULES.every));
        if (this.difficulty !== 'easy') this.earnChest(1);
      }
      if (!this.endless && this.wave >= WAVES_PER_RUN) {   // nothing left to spend it on
        this.earnCoins(coinsForVictory(this.difficulty));
        if (this.difficulty !== 'easy') this.earnChest(1);
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
    // the layers (js/depth.js): paper, ground, actors, and the cursor on top
    Depth.update(this);
    const P = Depth.off(Depth.PAPER), G = Depth.off(Depth.GROUND), A = Depth.off(Depth.ACTORS);
    if (this.bg) ctx.drawImage(this.bg, P.x - 8, P.y - 8, this.w + 16, this.h + 16);

    ctx.save();
    ctx.translate(this.w / 2 + this.shakeX + G.x, this.h / 2 + this.shakeY + G.y);

    if (this.state !== 'menu') {
      const wrecked = this.state === 'collapsing' || (this.state === 'gameover' && this.collapse > 0);
      if (wrecked) this.collapse = Math.min(COLLAPSE_TIME, this.collapse || 0.0001);
      if (this.ground) {
        const s = this.ground.size;
        ctx.drawImage(this.ground.canvas, -s / 2, -s / 2, s, s);
      }
      for (const f of this.effects) if (f instanceof InkPuddle || f.under) f.draw(ctx, this.time);
      // everything standing up leaves a shadow on the ground layer, then
      // the camera moves on to the nearer layer to draw the things themselves
      ctx.translate(A.x - G.x, A.y - G.y);
      Depth.shadows(ctx, this);
      if (this.penTrail) this.penTrail.draw(ctx, this.time);
      this.drawCastle(ctx);
      if (this.sentry) this.sentry.draw(ctx, this.time);
      for (const e of this.enemies) e.draw(ctx, this.time);
      if (this.sentry && this.sentry.type === 'trapper') this.sentry.drawTrapperOver(ctx, this.time);
      for (const f of this.effects) if (!(f instanceof InkPuddle) && !f.under) f.draw(ctx, this.time);
    } else {
      ctx.translate((A.x - G.x) * 0.5, (A.y - G.y) * 0.5);
      MenuScene.draw(ctx, this);
    }
    ctx.restore();

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.3;
      ctx.fillStyle = '#c8433a';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    if (this.state !== 'menu') IgnisHud.draw(ctx, this);          // his bar, the letterbox, what he says
    if (this.cinematic) this.cinematic.draw(ctx, this.w, this.h, this.time);
    if (this.banner) this.banner.draw(ctx, this.w, this.h, this.time);
    if (this.state === 'offers' && this.offerScreen) this.offerScreen.draw(ctx, this.w, this.h, this.time);

    if (this.paused) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 0.9;
      Rough.boil(4242, Math.floor(this.time * 2));
      Rough.text(ctx, 'PAUSED', this.w / 2, this.h / 2 - 14, Math.min(58, this.w * 0.1), '#2b2b2b');
      Rough.text(ctx, 'P, or the button up there', this.w / 2, this.h / 2 + 28, 16, '#6b6b6b');
      Rough.line(ctx, this.w / 2 - 110, this.h / 2 + 8, this.w / 2 + 110, this.h / 2 + 8,
        { color: '#2b2b2b', width: 3, jitter: 2.5, passes: 2 });
      ctx.restore();
    }

    if ((this.state === 'playing' || this.state === 'offers') && this.pointer.inside) {
      if (this.oneshot.afterimage && this.ghostTrail.length) {
        const g = this.ghostTrail[0];
        ctx.save();
        ctx.globalAlpha = 0.4;
        drawCursor(ctx, cursorById(this.cursorId), g.x, g.y, 0, 0, this.time - 0.33, null, true);
        ctx.restore();
      }
      if (this.hold) drawHoldGauge(ctx, this);
      Depth.cursorShadow(ctx, this);            // the top layer's shadow on the world
      Protector.draw(ctx, this);
      if (this.playerStun > 0) {                // stars round the hand he knocked off the cursor
        drawStunStars(ctx, this.pointer.x + 6, this.pointer.y - 4, 16, this.time);
        Rough.text(ctx, 'stunned', this.pointer.x + 8, this.pointer.y - 30, 14, '#e0562d');
      }
      drawCursor(ctx, cursorById(this.cursorId), this.pointer.x, this.pointer.y,
        this.cursorCharge, this.pointer.down > 0 ? 1 : 0, this.time, this.oneshot,
        false, this.oneshot.double ? this.doubleId : null);
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
    const dmg = Math.min(5, Math.max(0, this.maxHp - this.castleHp));   // 0 (fine) .. 5 (gone)

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

    // Thick Paper: an outer shell drawn around the whole thing and left
    // uncoloured, so you can see the card stock it was redrawn on
    if (this.oneshot.paper) {
      const shell = [[-R * 0.98, -R * 0.95], [R * 0.98, -R * 0.95], [R * 0.98, R * 0.88], [-R * 0.98, R * 0.88]]
        .map(p => [p[0] + Rough.jit(2.6), p[1] + Rough.jit(2.6)]);
      ctx.save();
      ctx.globalAlpha = 0.85;
      Rough.poly(ctx, shell, { color: '#2b2b2b', width: 2.6, jitter: 1.8 });
      ctx.globalAlpha = 0.3;
      Rough.poly(ctx, shell.map(p => [p[0] * 0.965, p[1] * 0.965]), { color: '#2b2b2b', width: 1.6, jitter: 1.4 });
      // the corner folds, so it reads as a sheet wrapped round the castle
      for (const sx of [-1, 1]) {
        Rough.line(ctx, sx * R * 0.98, -R * 0.95, sx * R * 0.86, -R * 0.78,
          { color: '#2b2b2b', width: 1.8, jitter: 1.2, passes: 1 });
      }
      ctx.restore();
    }

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
    if (this.state !== 'menu') this.drawHpBar(ctx, 0, -R - 30);   // no numbers on the title or in the book
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
    const n = this.maxHp, segW = n > 5 ? 19 : 22, gap = 5;
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
    Rough.text(ctx, Math.max(0, this.castleHp) + ' / ' + this.maxHp, x, y - 19, 13, '#6b6b6b');
    ctx.restore();
  }
};

window.addEventListener('load', () => Game.init());
