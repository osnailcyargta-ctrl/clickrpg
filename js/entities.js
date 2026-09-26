/* FANDHARN - enemies, status effects and every doodle that flies around.
   Everything here eases in and eases out; nothing pops into existence. */

let _id = 1;
function nextId() { return _id++; }

const BOSS_NAMES = {
  boss: 'THE BLOT', warden: 'THE WARDEN', eagle: 'THUNDER EAGLE',
  hive: 'THE HIVE', queen: 'THE QUEEN'
};
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
    this.boss = kind === 'boss' || kind === 'warden' || kind === 'eagle'
      || kind === 'hive' || kind === 'queen';
    this.skillT = kind === 'boss' ? 4.5 : (kind === 'eagle' ? 2.2 : 7);
    this.dash = null;                          // the Eagle's swoop, while it lasts
    this.dashT = kind === 'eagle' ? 3.4 : 0;
    this.flap = Math.random() * 6;
    this.immuneSource = kind === 'eagle' ? 'storm' : null;   // she drinks lightning
    this.drink = 0;                                          // glow when she does

    // --- the Hive's three acts
    this.workers = [];          // phase 1: the ten that drag it in
    this.entered = false;       // nothing is hittable until it is fully on screen
    this.sinceSwarm = 0;        // phase 2: damage banked toward the next swarm
    this.hatch = 0;             // larva: counts down to a steroid bee
    this.charge = 0;            // steroid: winding up before the run
    this.dashing = 0;
    this.fall = null;           // lavaball: where it is going and how fast
    this.burst = 0;             // bee: the beat it spends boiling out of the door
    this.wing = Math.random() * 6;
    this.smear = [];                           // recent positions, for the swoop blur
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
    // the Hive and its haulers cannot be touched until the nest is all the
    // way onto the page
    if (this.untouchable) {
      if (!opts.silent && Math.random() < 0.25) {
        game.effects.push(new FloatText(this.x + Rough.jit(14), this.y - this.r, 'not yet', '#b8b2a3', 15, false));
      }
      return 0;
    }
    // fire gets under the Queen's shell
    if (this.kind === 'queen' && opts.fire) amount *= 1.15;

    // the Thunder Eagle is made of the stuff the Storm Caller throws
    if (this.immuneSource && opts.source === this.immuneSource) {
      this.drink = 1;
      if (!opts.silent && Math.random() < 0.35) {
        game.effects.push(new FloatText(this.x + Rough.jit(16), this.y - this.r,
          'drinks it', '#dfe6ff', 16, false));
      }
      return 0;
    }
    if (this.immuneT > 0) {                    // the warden's barrier eats it
      this.barrierT = 1;
      if (!opts.silent && Math.random() < 0.3) {
        game.effects.push(new FloatText(this.x + Rough.jit(14), this.y - this.r, 'nope', '#8ec5e8', 15, false));
      }
      return 0;
    }
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount;
    if (this.kind === 'hive') {
      this.sinceSwarm += dealt;
      while (this.sinceSwarm >= 25) {          // every 25 it lets three out
        this.sinceSwarm -= 25;
        this.releaseSwarm(game);
      }
    }
    if (this.kind === 'larva' && this.hatch > 0.05) this.hatch = 0.05;   // poking it hurries it
    if (this.kind === 'auger' && this.hp > 0 && dealt > 0) this.augerStruck(game);
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
    if (this.kind === 'hive') {                // phase 3 walks out of the wreck
      const q = game.spawnMinion('queen', this.x, this.y, 0, game.waveSpec ? game.waveSpec.speed : 55);
      q.spawnT = 0; q.skillT = 2.4;
      game.effects.push(new HiveBreak(this.x, this.y, this.r));
      game.slowmo(0.5, 0.3);
      game.shake(20);
      Sfx.play('queen_screech', { volume: 1, rateVar: 0 });
    }
    if (this.kind === 'eagle') {
      game.eagleKilled = true;
      if (Math.random() < 0.5) game.effects.push(new BirdDrop(this.x, this.y));
      game.effects.push(new EagleAscend(this.x, this.y, this.r, game));
      game.slowmo(0.45, 0.32);
      game.shake(18);
      Sfx.play('eagle_death', { volume: 1, rateVar: 0 });
    }
    if (this.kind === 'boss') {                // bursts into three blotlings
      game.blotKilled = true;
      if (Math.random() < 0.5) game.effects.push(new BlobdDrop(this.x, this.y));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        game.spawnMinion('blotling', this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 26,
          this.maxHp * 0.09, this.baseSpeed * 2.6);
      }
      game.effects.push(new FloatText(this.x, this.y - this.r, 'it split', '#7a5cc4', 24, true));
    }
    game.onEnemyKilled(this);
    Deaths.play(this, game);           // each thing breaks the way it is made (js/deaths.js)
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
        this.hurt(2 + Math.random(), game, { color: '#e0562d', fire: true });   // 2-3 a second
        if (this.dead) return;
      }
      if (Math.random() < dt * 16) game.effects.push(new Ember(this.x, this.y, this.r));
    }
    if (this.slow > 0) this.slow -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.barrierT > 0) this.barrierT = Math.max(0, this.barrierT - dt / 0.3);
    if (this.drink > 0) this.drink = Math.max(0, this.drink - dt / 0.5);
    if (this.boss) this.bossSkill(dt, game);
    if (this.faded > 0) this.faded = Math.max(0, this.faded - dt * 0.6);
    if (this.knock) {                            // thrown: slides out, easing off
      const k = this.knock;
      const was = E.out(k.t / k.dur);
      k.t = Math.min(k.dur, k.t + dt);
      const now = E.out(k.t / k.dur);
      this.x += k.dx * (now - was); this.y += k.dy * (now - was);
      if (k.t >= k.dur) this.knock = null;
    }
    if (this.stun > 0) { this.stun -= dt; return; }

    const d = Math.hypot(this.x, this.y) || 1;

    if (this.kind === 'auger') { this.augerUpdate(dt, game, d); return; }
    if (this.kind === 'eagle') { this.flyLikeAnEagle(dt, game, d); return; }
    if (HIVE_KINDS[this.kind]) { this.hiveUpdate(dt, game, d); return; }

    const step = this.speed * dt;
    this.x -= (this.x / d) * step;
    this.y -= (this.y / d) * step;

    if (d <= game.castleRadius + this.r * 0.6) {
      game.castleHit(this);
      this.dead = true;
      game.effects.push(new DeathSplat(this.x, this.y, this.r, this.fill, false));
    }
  }

  /* Three bees out of the door, all of them making for the castle. */
  releaseSwarm(game) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random();
      const b = game.spawnMinion('bee', this.x + Math.cos(a) * (this.r + 8),
        this.y + Math.sin(a) * (this.r + 8), 0, game.waveSpec ? game.waveSpec.speed : 55);
      b.spawnT = 0.5;
      // they boil out of the door before they turn for the castle, which is
      // the beat you get to swat them in
      b.burst = 0.9;
      b.burstA = a;
    }
    game.effects.push(new FloatText(this.x, this.y - this.r - 12, 'swarm!', '#e8c33a', 19, false));
    Sfx.play('bee_swarm', { volume: 0.8, throttle: 120 });
    game.shake(7);
  }

  /* The Eagle holds a standoff, swoops in and pulls back out, and looses
     bolts at the castle that have to be shot down. */
  flyLikeAnEagle(dt, game, d) {
    const standoff = BLOCK * 5;

    this.smear.unshift([this.x, this.y]);
    if (this.smear.length > 7) this.smear.pop();

    if (this.dash) {
      this.dash.t += dt;
      const k = E.clamp01(this.dash.t / this.dash.dur);
      // out fast, back slower, never far enough in to touch the castle
      const swing = k < 0.45 ? E.out(k / 0.45) : 1 - E.inOut((k - 0.45) / 0.55);
      this.x = this.dash.fromX + (this.dash.toX - this.dash.fromX) * swing;
      this.y = this.dash.fromY + (this.dash.toY - this.dash.fromY) * swing;
      if (k >= 1) this.dash = null;
      return;
    }

    if (d > standoff) {                      // glide in until it is in range
      const step = this.speed * dt;
      this.x -= (this.x / d) * step;
      this.y -= (this.y / d) * step;
    } else {                                 // then hang there, circling a little
      const a = Math.atan2(this.y, this.x) + dt * 0.25;
      const hold = standoff + Math.sin(this.wobblePhase + game.time * 1.2) * 14;
      this.x = Math.cos(a) * hold;
      this.y = Math.sin(a) * hold;
    }
  }

  /* Everything in the Hive fight moves by its own rules. */
  hiveUpdate(dt, game, d) {
    const reach = (this.speed || 0) * dt;

    if (this.kind === 'hive') {
      // it (and its haulers) cannot be touched until the nest's edge is
      // three blocks off the green
      if (!this.entered && d - this.r <= GROUND_RADIUS + BLOCK * 3) {
        this.entered = true;
        game.effects.push(new FloatText(this.x, this.y - this.r - 16, 'the hive lands', '#c9903a', 20, true));
        game.shake(12);
      }
      this.workers = this.workers.filter(w => !w.dead);
      // the haulers drag it in; with none left it just sits there and takes it
      if (this.workers.length > 0) {
        this.x -= (this.x / d) * reach;
        this.y -= (this.y / d) * reach;
      }
      this.untouchable = !this.entered || this.workers.length > 0;
      if (d <= game.castleRadius + this.r * 0.6) { game.castleHit(this); this.dead = true; }
      return;
    }

    if (this.kind === 'worker') {
      // they hold station around the nest and pull it along
      const h = this.tether;
      if (h && !h.dead) {
        this.untouchable = !h.entered;
        const a = this.tetherA + Math.sin(game.time * 1.4 + this.wing) * 0.12;
        const want = h.r + 22;
        this.x = h.x + Math.cos(a) * want;
        this.y = h.y + Math.sin(a) * want;
        return;
      }
      this.untouchable = false;
    }

    if (this.kind === 'queen') { this.queenUpdate(dt, game, d); return; }

    if (this.kind === 'larva') {
      // it arcs in, lands, then splits open on its own or when poked
      if (this.fall) {
        this.fall.t += dt;
        const u = E.clamp01(this.fall.t / this.fall.dur);
        this.x = this.fall.sx + (this.fall.tx - this.fall.sx) * u;
        this.y = this.fall.sy + (this.fall.ty - this.fall.sy) * u - Math.sin(u * Math.PI) * this.fall.arc;
        if (u >= 1) { this.fall = null; this.hatch = 2; Sfx.play('lava_land', { volume: 0.35, throttle: 80 }); }
        return;
      }
      this.hatch -= dt;
      if (this.hatch <= 0) {
        const s = game.spawnMinion('steroid', this.x, this.y, 0, game.waveSpec ? game.waveSpec.speed : 55);
        s.spawnT = 0.4;
        game.effects.push(new FloatText(this.x, this.y - 16, 'hatched', '#b5823a', 17, false));
        Sfx.play('larva_pop', { volume: 0.7, throttle: 60 });
        this.dead = true;
      }
      return;
    }

    if (this.kind === 'steroid') {
      if (this.dashing > 0) {                     // the run itself
        this.dashing -= dt;
        const sp = this.baseSpeed * 5.5 * dt;
        this.x -= (this.x / d) * sp;
        this.y -= (this.y / d) * sp;
      } else if (this.charge > 0) {               // one second of winding up
        this.charge -= dt;
        if (this.charge <= 0) this.dashing = 1.2;
      } else if (d < game.castleRadius + BLOCK * 3.4) {
        this.charge = 1;
        Sfx.play('steroid_charge', { volume: 0.8, throttle: 100 });
      } else {
        this.x -= (this.x / d) * reach;
        this.y -= (this.y / d) * reach;
      }
      if (d <= game.castleRadius + this.r * 0.6) { game.castleHit(this); this.dead = true; }
      return;
    }

    if (this.kind === 'lavaball') {
      // it rises, hangs, then drops - and it has to be shot before it lands
      this.fall.t += dt;
      const f = this.fall;
      if (f.t < f.rise) {
        this.y = f.sy - E.out(f.t / f.rise) * f.height;
        this.x = f.sx;
      } else {
        const u = E.clamp01((f.t - f.rise) / f.drop);
        this.y = f.sy - f.height + u * u * f.height;
        if (u >= 1) { this.land(game); }
      }
      return;
    }

    // plain bees boil outward first, then make for the castle
    if (this.burst > 0) {
      this.burst -= dt;
      this.x += Math.cos(this.burstA) * reach * 0.8;
      this.y += Math.sin(this.burstA) * reach * 0.8;
      return;
    }
    this.x -= (this.x / d) * reach;
    this.y -= (this.y / d) * reach;
    if (d <= game.castleRadius + this.r * 0.6) { game.castleHit(this); this.dead = true; }
  }

  /* The Queen: mortars, a rally dash for her own swarm, and a stinger she
     puts through the paper. */
  queenUpdate(dt, game, d) {
    const standoff = BLOCK * 4.5;

    if (this.dashing > 0) {
      this.dashing -= dt;
      const sp = this.baseSpeed * 6 * dt;
      this.x += Math.cos(this.dashA) * sp;
      this.y += Math.sin(this.dashA) * sp;
      return;
    }

    this.skillT -= dt;
    if (this.skillT <= 0) {
      this.skillT = 3.4;
      const roll = Math.floor(Math.random() * 3);
      if (roll === 0) this.mortar(game);
      else if (roll === 1) this.rally(game);
      else this.sting(game);
    }

    if (d > standoff) {
      const step = this.speed * dt;
      this.x -= (this.x / d) * step;
      this.y -= (this.y / d) * step;
    } else {
      const a = Math.atan2(this.y, this.x) + dt * 0.3;
      this.x = Math.cos(a) * standoff;
      this.y = Math.sin(a) * standoff;
    }
  }

  /* Three larvae lobbed onto random blocks, landing like mortar rounds. */
  mortar(game) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = BLOCK * (1.5 + Math.random() * 4);
      const tx = Math.cos(a) * dist, ty = Math.sin(a) * dist;
      const l = game.spawnMinion('larva', this.x, this.y, 0, 0);
      l.spawnT = 1;
      l.fall = { sx: this.x, sy: this.y, tx, ty, t: 0, dur: 0.95, arc: 120 + Math.random() * 70 };
    }
    game.effects.push(new FloatText(this.x, this.y - this.r - 12, 'brood!', '#efe0b0', 18, false));
    Sfx.play('queen_screech', { volume: 0.7 });
  }

  /* She throws herself at her own swarm and they pick up the pace. */
  rally(game) {
    let best = null, bd = BLOCK * 6;
    for (const e of game.enemies) {
      if (e.dead || e === this) continue;
      if (!HIVE_KINDS[e.kind]) continue;
      const dd = Math.hypot(e.x - this.x, e.y - this.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    if (!best) return;
    this.dashA = Math.atan2(best.y - this.y, best.x - this.x);
    this.dashing = 0.45;
    for (const e of game.enemies) {
      if (e.dead || e === this || !HIVE_KINDS[e.kind]) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= BLOCK * 6) {
        e.baseSpeed *= 1.35;
        e.rallied = 1;
        game.effects.push(new FloatText(e.x, e.y - e.r - 8, 'faster', '#e8c33a', 14, false));
      }
    }
    Sfx.play('bee_swarm', { volume: 0.7, throttle: 100 });
  }

  /* The stinger goes through the page. What comes up out of it is the part
     that matters. */
  sting(game) {
    const a = Math.random() * Math.PI * 2;
    const dist = BLOCK * (1.2 + Math.random() * 3.2);
    game.effects.push(new GroundCrack(Math.cos(a) * dist, Math.sin(a) * dist, game));
    game.shake(10);
    Sfx.play('lava_erupt', { volume: 0.5 });
  }

  /* A lava ball that reached the ground. */
  land(game) {
    if (this.dead) return;
    this.dead = true;
    game.effects.push(new LavaPuddle(this.x, this.fall.sy, game));
  }

  /* Each boss has one trick of its own. The Hive and its Queen run theirs
     out of hiveUpdate instead, so they sit this one out entirely. */
  bossSkill(dt, game) {
    if (HIVE_KINDS[this.kind]) return;
    this.skillT -= dt;

    if (this.kind === 'eagle') {
      // THE THUNDER EAGLE: looses bolts at the castle, and swoops.
      if (this.skillT <= 0) {
        this.skillT = 3.2;                 // enough air to see it and shoot it down
        const d = Math.hypot(this.x, this.y) || 1;
        const shot = game.spawnMinion('boltshot', this.x - (this.x / d) * 26, this.y - (this.y / d) * 26,
          1, game.waveSpec ? game.waveSpec.speed : 50);
        shot.spawnT = 0.6;
        game.effects.push(new FloatText(this.x, this.y - this.r - 12, 'loose!', '#8ea6ff', 17, false));
        Sfx.play('bolt_shot', { volume: 0.7 });
      }
      this.dashT -= dt;
      if (this.dashT <= 0 && !this.dash) {
        this.dashT = 5.5;
        const d = Math.hypot(this.x, this.y) || 1;
        const stop = game.castleRadius + BLOCK * 2.2;   // a swoop, not a suicide
        this.dash = {
          t: 0, dur: 1.1,
          fromX: this.x, fromY: this.y,
          toX: (this.x / d) * stop, toY: (this.y / d) * stop
        };
        Sfx.play('eagle_dash', { volume: 0.8 });
      }
      return;
    }

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

    // light under the body: a boss throws a slow pulse of its own colour,
    // and anything on fire throws a flicker of heat
    if (this.boss && !Fx.low) {
      Rough.bloom(ctx, x, y, this.r * (2.1 + Math.sin(t * 2 + this.wobblePhase) * 0.15), this.fill, 0.28);
    }
    if (this.burn > 0 && !Fx.low) {
      Rough.bloom(ctx, x, y, this.r * (1.5 + Math.random() * 0.25), '#e0562d', 0.35 + Math.random() * 0.15);
    }

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
      case 'eagle': this.drawEagle(ctx, x, y, rx, ry, fill, t, facing); break;
      case 'boltshot': this.drawBoltshot(ctx, x, y, rx, ry, fill, facing); break;
      case 'hive': this.drawHive(ctx, x, y, rx, ry, fill, t); break;
      case 'worker': this.drawWorker(ctx, x, y, rx, ry, fill, t); break;
      case 'bee': this.drawBee(ctx, x, y, rx, ry, fill, t); break;
      case 'queen': this.drawQueen(ctx, x, y, rx, ry, fill, t); break;
      case 'larva': this.drawLarva(ctx, x, y, rx, ry, fill, t); break;
      case 'steroid': this.drawSteroid(ctx, x, y, rx, ry, fill, t); break;
      case 'lavaball': this.drawLavaball(ctx, x, y, rx, ry, fill, t); break;
      case 'auger': this.drawAuger(ctx, x, y, rx, ry, fill, t); break;
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
        Rough.text(ctx, BOSS_NAMES[this.kind] || 'BOSS', x, by - 13, 13, '#2b2b2b');
      }
    }
    if (this.stun > 0.05) drawStunStars(ctx, x, y, Math.max(this.r, 14), t);
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

  /* THE THUNDER EAGLE - a raptor cut out of lightning. Wings are forked
     bolts, and it smears when it swoops. */
  drawEagle(ctx, x, y, rx, ry, fill, t, facing) {
    const r = (rx + ry) / 2;
    const beat = Math.sin(t * (this.dash ? 16 : 5) + this.flap);
    const lean = Math.atan2(-this.y, -this.x) + Math.PI / 2;

    // the swoop leaves the air behind it torn
    if (this.dash && this.smear.length > 1) {
      ctx.save();
      for (let i = 1; i < this.smear.length; i++) {
        const a = this.smear[i - 1], b = this.smear[i];
        ctx.globalAlpha = (1 - i / this.smear.length) * 0.5;
        Rough.line(ctx, a[0], a[1], b[0], b[1],
          { color: '#8ea6ff', width: r * 0.5 * (1 - i / this.smear.length), jitter: 4, passes: 1 });
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);

    // wings: forked bolts, thrown wide on the downbeat
    for (const s of [-1, 1]) {
      const spread = 1 + beat * 0.32;
      const wing = [
        [0, -r * 0.1],
        [s * r * 0.75, -r * 0.55 * spread],
        [s * r * 0.62, -r * 0.18 * spread],
        [s * r * 1.5, -r * 0.42 * spread],
        [s * r * 1.15, r * 0.05],
        [s * r * 1.45, r * 0.3 * spread],
        [s * r * 0.5, r * 0.22]
      ];
      Rough.scribble(ctx, wing, { color: fill, spacing: 7, width: 6, overflow: 1.12, alpha: 0.85 });
      Rough.poly(ctx, wing, { color: '#2b2b2b', width: 2.8, jitter: 1.8 });
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.abs(beat) * 0.4;
      Rough.poly(ctx, wing.map(p => [p[0] * 0.8, p[1] * 0.8]),
        { color: '#dfe6ff', width: 2, jitter: 3, closed: false });
      ctx.restore();
    }

    // body and tail
    const body = [[0, -r * 0.85], [r * 0.34, -r * 0.1], [r * 0.2, r * 0.75],
    [0, r * 1.05], [-r * 0.2, r * 0.75], [-r * 0.34, -r * 0.1]];
    Rough.scribble(ctx, body, { color: '#2f3a5c', spacing: 6, width: 6, overflow: 1.1 });
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 3, jitter: 1.4 });
    const tail = [[-r * 0.22, r * 0.7], [0, r * 1.45], [r * 0.22, r * 0.7]];
    Rough.poly(ctx, tail, { color: '#2b2b2b', width: 2.6, jitter: 2 });

    // hooked beak
    const beak = [[0, -r * 0.8], [r * 0.16, -r * 1.15], [-r * 0.04, -r * 1.06]];
    Rough.scribble(ctx, beak, { color: '#e8c33a', spacing: 4, width: 4, overflow: 1.16 });
    Rough.poly(ctx, beak, { color: '#2b2b2b', width: 2, jitter: 1 });
    ctx.restore();

    // eyes, lit from inside
    this.eyes(ctx, x, y - r * 0.15, r * 0.7, 2, t, '#dfe6ff');

    // brighter for a moment after she swallows a bolt
    if (this.drink > 0) {
      ctx.save();
      ctx.globalAlpha = this.drink * 0.8;
      Rough.circle(ctx, x, y, r * (1.3 + (1 - this.drink) * 0.7),
        { color: '#dfe6ff', width: 4, jitter: 5, wobble: 5 });
      Rough.circle(ctx, x, y, r * (0.9 + (1 - this.drink) * 0.4),
        { color: '#8ea6ff', width: 3, jitter: 4, wobble: 4 });
      ctx.restore();
    }

    // the charge it carries
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.abs(Math.sin(t * 11)) * 0.4 + this.drink * 0.3;
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1;
      Rough.line(ctx, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9,
        x + Math.cos(a + 0.5) * r * 1.25, y + Math.sin(a + 0.5) * r * 1.25,
        { color: '#dfe6ff', width: 2, jitter: 4, passes: 1 });
    }
    ctx.restore();
  }

  /* One of the Eagle's bolts, running at the castle. Shoot it down. */
  drawBoltshot(ctx, x, y, rx, ry, fill, facing) {
    const r = (rx + ry) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing + Math.PI / 2);
    const bolt = [[0, -r * 1.5], [r * 0.6, -r * 0.1], [r * 0.16, -r * 0.1],
    [r * 0.5, r * 1.5], [-r * 0.5, 0], [-r * 0.1, 0], [-r * 0.5, -r * 0.7]];
    Rough.scribble(ctx, bolt, { color: '#e8c33a', spacing: 4, width: 4, overflow: 1.2 });
    Rough.poly(ctx, bolt, { color: '#2b2b2b', width: 2.2, jitter: 1.4 });
    ctx.save();
    ctx.globalAlpha = 0.6;
    Rough.line(ctx, 0, r * 1.2, 0, r * 2.6, { color: '#8ea6ff', width: 2.4, jitter: 3, passes: 1 });
    ctx.restore();
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

  /* --- THE HIVE, and everything that comes out of it --- */

  /* A pair of wings, beating. Everything in this fight flies on them. */
  beeWings(ctx, x, y, r, t, spread) {
    const beat = Math.sin(t * 26 + this.wing);
    ctx.save();
    ctx.globalAlpha = 0.34 + Math.abs(beat) * 0.12;
    for (const s of [-1, 1]) {
      const tilt = s * (0.5 + beat * 0.22);
      const wing = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, a = Math.PI * u;
        const wr = r * spread * (0.35 + Math.sin(a) * 0.65);
        wing.push([x + Math.cos(a - Math.PI / 2 + tilt) * wr * s,
        y + Math.sin(a - Math.PI / 2 + tilt) * wr * 0.55 - r * 0.45]);
      }
      Rough.poly(ctx, wing, { color: '#cfe4f2', width: 2, jitter: 1.4 });
    }
    ctx.restore();
  }

  /* A striped bee body, shared by the workers, the swarm and the Queen's
     own thorax. Bands are laid down as fat crayon strokes. */
  beeBody(ctx, x, y, rx, ry, fill, bands, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push([Math.cos(a) * rx + Rough.jit(1.2), Math.sin(a) * ry + Rough.jit(1.2)]);
    }
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : fill;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, pts, { color: fill, spacing: 5, width: 5, overflow: 1.12 });
    // the black bands, clipped to the body so they never overrun the shape
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.clip();
    for (let i = 0; i < bands; i++) {
      const bx = -rx + ((i + 0.85) / (bands + 0.6)) * rx * 2;
      Rough.line(ctx, bx, -ry * 1.1, bx + rx * 0.12, ry * 1.1,
        { color: '#2b2b2b', width: rx * 0.34, jitter: 1.4, passes: 2 });
    }
    ctx.restore();
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.4, jitter: 1.2 });
    ctx.restore();
  }

  /* THE HIVE ITSELF - a paper nest of stacked combs, hauled in on ten
     strands. The hole at the bottom is where the swarm comes from. */
  drawHive(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const sway = Math.sin(t * 1.1 + this.wobblePhase) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);

    // the strands the haulers are pulling on
    for (const w of this.workers) {
      if (w.dead) continue;
      ctx.save();
      ctx.globalAlpha = 0.75;
      const wx = w.x - x, wy = w.y - y, wd = Math.hypot(wx, wy) || 1;
      Rough.line(ctx, (wx / wd) * r * 0.86, (wy / wd) * r * 0.86, wx, wy,
        { color: '#6b5b46', width: 2.6, jitter: 2.2, passes: 2 });
      ctx.restore();
    }

    // the nest: a teardrop built out of wobbly combs, widest below centre
    const shape = [];
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const taper = 1 - Math.max(0, -Math.sin(a)) * 0.34;      // pinched at the top
      const belly = 1 + Math.max(0, Math.sin(a)) * 0.12;
      shape.push([Math.cos(a) * r * 0.9 * taper + Rough.jit(2),
      Math.sin(a) * r * belly + Rough.jit(2)]);
    }
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#e6cf9c';
    ctx.beginPath();
    shape.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, shape, { color: fill, spacing: 6, width: 6, overflow: 1.08, alpha: 0.85 });
    Rough.grain(ctx, shape, '#7a5a26', 0.004, this.id);

    // the combs, drawn as sagging bands across the nest
    ctx.save();
    ctx.beginPath();
    shape.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.clip();
    for (let i = -3; i <= 3; i++) {
      const by = i * r * 0.27;
      Rough.poly(ctx, [[-r, by - 4], [-r * 0.4, by + 5], [0, by + 7], [r * 0.4, by + 5], [r, by - 4]],
        { color: '#9a7431', width: 2.2, jitter: 1.6, closed: false, alpha: 0.7 });
    }
    // the damage shows as splits across the combs
    const hurt = 1 - this.hpShown;
    for (let i = 0; i < Math.floor(hurt * 6); i++) {
      const a = (i / 6) * Math.PI * 2 + this.wobblePhase;
      Rough.line(ctx, Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2,
        Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95,
        { color: '#4a3413', width: 3, jitter: 2.4, passes: 2 });
    }
    ctx.restore();
    Rough.poly(ctx, shape, { color: '#2b2b2b', width: 3.6, jitter: 1.8 });

    // the mouth of the nest, and what is looking out of it
    const mx = 0, my = r * 0.62;
    ctx.fillStyle = '#1d1206';
    ctx.beginPath(); ctx.ellipse(mx, my, r * 0.26, r * 0.19, 0, 0, 7); ctx.fill();
    Rough.circle(ctx, mx, my, r * 0.26, { color: '#2b2b2b', width: 2.6, jitter: 1.8, wobble: 2.5 });
    const lit = E.clamp01(this.sinceSwarm / 25);
    if (lit > 0.05) {
      ctx.save();
      ctx.globalAlpha = lit * (0.5 + Math.sin(t * 12) * 0.3);
      Rough.bloom(ctx, mx, my, r * 0.34, '#e8c33a', 0.8);
      ctx.restore();
    }
    // a few of them crawling on the outside
    for (let i = 0; i < 4; i++) {
      const a = t * 0.5 + i * 1.7 + this.wobblePhase;
      const rr = r * 0.72;
      ctx.save();
      ctx.globalAlpha = 0.85;
      this.beeBody(ctx, Math.cos(a) * rr, Math.sin(a) * rr * 1.02, 5, 3.4, '#e8c33a', 2, a);
      ctx.restore();
    }
    ctx.restore();

    if (this.untouchable) this.hiveGuard(ctx, x, y, r * 1.05, t);
  }

  /* While the haulers live, or before the nest is all the way on the paper,
     nothing sticks. Say so, loudly. */
  hiveGuard(ctx, x, y, r, t) {
    ctx.save();
    ctx.globalAlpha = 0.34 + Math.sin(t * 4) * 0.12;
    Rough.circle(ctx, x, y, r + 34, { color: '#9a8f86', width: 3.4, jitter: 4, wobble: 5 });
    ctx.globalAlpha = 0.7;
    Rough.text(ctx, this.entered ? 'cut the haulers' : 'incoming', x, y - r - 46, 16, '#6b6b6b');
    ctx.restore();
  }

  /* A hauler bee: bigger than the swarm, hauling on a strand. */
  drawWorker(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const tilt = this.tether ? Math.atan2(this.tether.y - this.y, this.tether.x - this.x) : 0;
    this.beeWings(ctx, x, y, r * 1.5, t, 1.1);
    this.beeBody(ctx, x, y, r * 1.15, r * 0.78, fill, 3, tilt);
    // the stinger, a hard little nib at the tail
    Rough.line(ctx, x - Math.cos(tilt) * r * 1.1, y - Math.sin(tilt) * r * 1.1,
      x - Math.cos(tilt) * r * 1.7, y - Math.sin(tilt) * r * 1.7,
      { color: '#2b2b2b', width: 2.4, jitter: 1, passes: 2 });
    if (this.untouchable) {
      ctx.save(); ctx.globalAlpha = 0.3;
      Rough.circle(ctx, x, y, r + 7, { color: '#9a8f86', width: 2, jitter: 2.4, wobble: 2.5 });
      ctx.restore();
    }
  }

  /* One of the swarm. Small, quick, and furious about it. */
  drawBee(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const tilt = Math.atan2(-this.y, -this.x) + Math.PI;
    this.beeWings(ctx, x, y, r * 1.35, t, 1);
    this.beeBody(ctx, x, y, r * 1.1, r * 0.72, fill, 2, tilt);
    if (this.rallied) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(t * 14 + this.wing) * 0.2;
      Rough.circle(ctx, x, y, r + 5, { color: '#e0562d', width: 2, jitter: 2.4, wobble: 2 });
      ctx.restore();
    }
  }

  /* THE QUEEN - head down, thorax, and a long armoured abdomen dragging
     behind her. Everything points at the castle. Fire gets under the shell,
     and she shows it. */
  drawQueen(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const face = Math.atan2(-this.y, -this.x);
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.3 + this.wobblePhase) * 3);
    ctx.rotate(face + Math.PI / 2);          // -y is the way she is going

    // --- the abdomen, trailing behind, drawn first so it sits under her
    for (let i = 4; i >= 1; i--) {
      const u = i / 4;
      const sy = r * (0.45 + u * 1.5);
      const sr = r * (0.66 - u * 0.26);
      this.beeBody(ctx, Math.sin(t * 2 + this.wobblePhase + u * 1.2) * u * 5, sy,
        sr, sr * 0.78, i % 2 ? fill : '#8a5a1c', 1, Math.PI / 2);
    }
    // the stinger she puts through the paper
    const ty = r * 2.05;
    Rough.poly(ctx, [[-6, ty], [0, ty + r * 0.8], [6, ty]], { color: '#2b2b2b', width: 3, jitter: 1.2 });

    // --- four wings, long and ragged
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(t * 18 + this.wing)) * 0.1;
    for (const s of [-1, 1]) {
      for (const k of [0, 1]) {
        const beat = Math.sin(t * 18 + this.wing + k * 0.6) * 0.16;
        const lean = 0.55 + k * 0.4 + beat;          // swept back off the thorax
        const len = r * (1.8 - k * 0.55);
        const ca = Math.cos(lean), sa = Math.sin(lean);
        const wing = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12, a = Math.PI * u;
          const px = Math.sin(a) * len, py = -Math.cos(a) * len * 0.22;
          wing.push([s * (px * ca - py * sa), px * sa + py * ca + r * 0.15]);
        }
        Rough.poly(ctx, wing, { color: '#cfe4f2', width: 2.2, jitter: 1.4 });
      }
    }
    ctx.restore();

    // --- thorax, with a thick ruff of fur around it
    const body = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      body.push([Math.cos(a) * r * 0.86 + Rough.jit(2), Math.sin(a) * r * 0.74 + Rough.jit(2)]);
    }
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#3a2408';
    ctx.beginPath();
    body.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, body, { color: fill, spacing: 5, width: 6, overflow: 1.06, alpha: 0.9 });
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 3.4, jitter: 1.6 });
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * 1.15 + (i / 13) * Math.PI * 0.7;    // the front half only
      Rough.line(ctx, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.68,
        Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.86,
        { color: '#c9903a', width: 2.6, jitter: 1.4, passes: 1 });
    }
    ctx.restore();

    // --- head
    const hy = -r * 1.28;
    const head = Rough.circlePts(0, hy, r * 0.56, r * 0.08, 14);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#2e1c05';
    ctx.beginPath();
    head.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, head, { color: '#9a6a20', spacing: 5, width: 5, overflow: 1.08, alpha: 0.85 });
    Rough.poly(ctx, head, { color: '#2b2b2b', width: 3, jitter: 1.4 });

    // the crown: six chitin spikes off the back of the skull, none even
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 1.18 + (i / 6) * Math.PI * 0.64;   // around the crown of the skull
      const h = r * (0.4 + (i % 2 ? 0.26 : 0));
      const ca = Math.cos(a), sa = Math.sin(a);
      const bx = ca * r * 0.5, by = hy + sa * r * 0.5;
      Rough.poly(ctx, [[bx - sa * 5, by + ca * 5], [bx + ca * h, by + sa * h], [bx + sa * 5, by - ca * 5]],
        { color: '#2b2b2b', width: 2.6, jitter: 1.2 });
    }

    // two compound eyes, hatched red, and nothing behind them
    for (const s of [-1, 1]) {
      const ex = s * r * 0.32, ey = hy - r * 0.1;
      ctx.fillStyle = '#120a02';
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.2, r * 0.26, s * 0.35, 0, 7); ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.65;
      for (let i = -2; i <= 2; i++) {
        Rough.line(ctx, ex - r * 0.16, ey + i * r * 0.085, ex + r * 0.16, ey + i * r * 0.085,
          { color: '#e0562d', width: 1.4, jitter: 0.7, passes: 1 });
      }
      ctx.restore();
      Rough.circle(ctx, ex, ey, r * 0.23, { color: '#2b2b2b', width: 2.2, jitter: 1.2, wobble: 1.8 });
    }
    // mandibles, working
    const gape = r * 0.1 * (1 + Math.sin(t * 5 + this.wobblePhase));
    for (const s of [-1, 1]) {
      Rough.poly(ctx, [[s * r * 0.3, hy + r * 0.34], [s * (r * 0.34 + gape), hy + r * 0.8],
      [s * r * 0.08, hy + r * 0.62]], { color: '#2b2b2b', width: 2.8, jitter: 1.2, closed: false });
    }
    ctx.restore();

    // fire gets under the shell, and it shows
    if (this.burn > 0) {
      ctx.save();
      ctx.globalAlpha = 0.14 + Math.sin(t * 11) * 0.06;
      Rough.bloom(ctx, x, y, r * 1.8, '#e0562d', 0.45);
      ctx.restore();
      Rough.text(ctx, '+15%', x + r * 1.1, y - r * 1.1, 14, '#e0562d');
    }
  }

  /* A brood cell: a fat pale grub, curled and twitching, that splits open
     into something much worse. */
  drawLarva(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const near = this.hatch > 0 && this.hatch < 0.8;
    const pulse = near ? 1 + Math.sin(t * 22) * 0.18 : 1 + Math.sin(t * 3 + this.wobblePhase) * 0.06;

    if (this.fall) {                      // a ring where it is going to land
      ctx.save();
      ctx.globalAlpha = 0.3;
      Rough.circle(ctx, this.fall.tx, this.fall.ty, r * 1.4,
        { color: '#b5823a', width: 2.4, jitter: 2.4, wobble: 3 });
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.wobblePhase + Math.sin(t * 2 + this.wobblePhase) * 0.2);
    ctx.scale(pulse, 1 / pulse);

    // a curled body: five overlapping segments along a shallow arc
    for (let i = 4; i >= 0; i--) {
      const u = i / 4;
      const a = -0.9 + u * 1.8;
      const sx = Math.sin(a) * r * 0.85, sy = -Math.cos(a) * r * 0.32;
      const sr = r * (0.62 - Math.abs(u - 0.35) * 0.3);
      Rough.blob(ctx, sx, sy, sr, i === 4 ? '#e3cf96' : fill, '#2b2b2b',
        { spacing: 4, fillWidth: 4, sides: 9, width: 2.2, jitter: 1.1 });
    }
    // the head end, darker, with two blunt hooks where a mouth will be
    const hx = Math.sin(0.9) * r * 0.85, hy = -Math.cos(0.9) * r * 0.32;
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (const s of [-1, 1]) {
      Rough.line(ctx, hx, hy, hx + r * 0.3, hy + s * r * 0.26,
        { color: '#8a6a2a', width: 2.2, jitter: 1.2, passes: 1 });
    }
    ctx.restore();
    ctx.restore();

    if (near) {                           // it is about to come apart
      ctx.save();
      ctx.globalAlpha = 0.45 + Math.sin(t * 22) * 0.25;
      Rough.circle(ctx, x, y, r * 1.6, { color: '#b5823a', width: 2.4, jitter: 3, wobble: 2.5 });
      ctx.restore();
    }
  }

  /* THE STEROID BEE - what comes out of a brood cell. All shoulders, no
     neck, wings far too small for it, and it runs the last stretch. */
  drawSteroid(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const face = Math.atan2(-this.y, -this.x);
    const wind = this.charge > 0 ? 1 - this.charge : 0;
    ctx.save();
    ctx.translate(x, y);
    if (this.charge > 0) ctx.translate(Rough.jit(3.5), Rough.jit(3.5));   // shaking
    ctx.rotate(face + Math.PI / 2);
    ctx.scale(1 + wind * 0.12, 1 - wind * 0.1);                           // hunching

    // stubby wings, nowhere near enough of them
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(t * 30 + this.wing)) * 0.12;
    for (const s of [-1, 1]) {
      Rough.poly(ctx, [[s * r * 0.55, r * 0.1], [s * r * 1.3, r * 0.62], [s * r * 0.75, r * 0.55]],
        { color: '#cfe4f2', width: 2, jitter: 1.6 });
    }
    ctx.restore();
    // a short thick stinger out the back
    Rough.poly(ctx, [[-6, r * 0.9], [0, r * 1.45], [6, r * 0.9]], { color: '#2b2b2b', width: 3, jitter: 1.2 });

    // the slab: widest across the shoulders, tapering hard to the waist
    const torso = [[-r * 1.14, -r * 0.34], [-r * 1.0, -r * 0.72], [-r * 0.62, -r * 0.94],
    [0, -r * 1.0], [r * 0.62, -r * 0.94], [r * 1.0, -r * 0.72], [r * 1.14, -r * 0.34],
    [r * 0.8, r * 0.4], [r * 0.48, r * 0.96], [-r * 0.48, r * 0.96], [-r * 0.8, r * 0.4]]
      .map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#5c3a10';
    ctx.beginPath();
    torso.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, torso, { color: fill, spacing: 5, width: 6, overflow: 1.08, alpha: 0.9 });
    // the bands, clipped so they stay on the body
    ctx.save();
    ctx.beginPath();
    torso.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.clip();
    Rough.line(ctx, -r * 1.2, -r * 0.22, r * 1.2, -r * 0.16, { color: '#2b2b2b', width: r * 0.21, jitter: 1.4, passes: 2 });
    Rough.line(ctx, -r * 1.2, r * 0.44, r * 1.2, r * 0.5, { color: '#2b2b2b', width: r * 0.18, jitter: 1.4, passes: 2 });
    ctx.restore();
    Rough.poly(ctx, torso, { color: '#2b2b2b', width: 3.4, jitter: 1.6 });
    // the pectoral seam, because it wants you to see it
    Rough.line(ctx, 0, -r * 0.85, 0, -r * 0.35, { color: '#2b2b2b', width: 2.4, jitter: 1.2, passes: 1 });

    // arms: braced out and forward, ending in fists the size of its head
    for (const s of [-1, 1]) {
      const sh = [s * r * 0.98, -r * 0.6];
      const el = [s * r * (1.55 + wind * 0.12), -r * 0.05];
      const fi = [s * r * (1.2 - wind * 0.3), -r * (1.0 + wind * 0.25)];
      Rough.poly(ctx, [sh, el, fi], { color: '#2b2b2b', width: 6, jitter: 1.6, closed: false });
      Rough.blob(ctx, el[0], el[1], r * 0.2, fill, '#2b2b2b', { spacing: 4, fillWidth: 4, sides: 7 });
      Rough.blob(ctx, fi[0], fi[1], r * 0.3, fill, '#2b2b2b', { spacing: 4, fillWidth: 5, sides: 7, width: 3 });
    }

    // head sunk between the shoulders, lit from inside
    const hy = -r * 1.15;
    Rough.blob(ctx, 0, hy, r * 0.44, '#3a2408', '#2b2b2b', { spacing: 4, fillWidth: 5, sides: 10, width: 3 });
    for (const s of [-1, 1]) {
      ctx.fillStyle = this.charge > 0 ? '#e0562d' : '#e8c33a';
      ctx.beginPath();
      ctx.ellipse(s * r * 0.19, hy - r * 0.06, r * 0.13, r * 0.18, s * 0.4, 0, 7);
      ctx.fill();
      Rough.circle(ctx, s * r * 0.19, hy - r * 0.06, r * 0.15, { color: '#2b2b2b', width: 2, jitter: 1.2, wobble: 1.4 });
    }
    for (const s of [-1, 1]) {            // mandibles, clenched
      Rough.line(ctx, s * r * 0.2, hy + r * 0.28, s * r * 0.36, hy + r * 0.52,
        { color: '#2b2b2b', width: 2.4, jitter: 1.2, passes: 1 });
    }
    ctx.restore();

    // the wind-up has to read from across the page
    if (this.charge > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4 + wind * 0.4;
      Rough.bloom(ctx, x, y, r * (1.5 + wind), '#e0562d', 0.7);
      Rough.circle(ctx, x, y, r * (2.4 - wind * 1.2), { color: '#e0562d', width: 4, jitter: 3.5, wobble: 4 });
      ctx.restore();
      Rough.text(ctx, 'move', x, y - r * 2.1, 15, '#e0562d');
    }
    if (this.dashing > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let i = 1; i <= 4; i++) {
        Rough.line(ctx, x - Math.cos(face) * i * 13 + Rough.jit(6), y - Math.sin(face) * i * 13 + Rough.jit(6),
          x - Math.cos(face) * (i + 1.6) * 13, y - Math.sin(face) * (i + 1.6) * 13,
          { color: '#b5823a', width: 3.4, jitter: 1.6, passes: 1 });
      }
      ctx.restore();
    }
  }

  /* The lava ball climbing out of a crack. Shoot it, or it lands. */
  drawLavaball(ctx, x, y, rx, ry, fill, t) {
    const r = (rx + ry) / 2;
    const falling = this.fall && this.fall.t > this.fall.rise;
    // where it is going to come down, flashing once it is on its way
    if (this.fall) {
      ctx.save();
      ctx.globalAlpha = falling ? 0.45 + Math.sin(t * 14) * 0.25 : 0.22;
      Rough.circle(ctx, this.fall.sx, this.fall.sy, r * 1.5,
        { color: '#e0562d', width: 3, jitter: 2.4, wobble: 3 });
      ctx.globalAlpha *= 0.6;
      Rough.circle(ctx, this.fall.sx, this.fall.sy, r * 0.8,
        { color: '#e0562d', width: 2, jitter: 2, wobble: 2.5 });
      ctx.restore();
    }

    Rough.bloom(ctx, x, y, r * 2.4, '#e0562d', 0.55);
    // flame licking off it, drawn under the body
    for (let i = -2; i <= 2; i++) {
      const fx = x + i * r * 0.38;
      const h = r * (0.55 + 0.3 * Math.sin(t * 8 + i * 1.7));
      Rough.poly(ctx, [[fx - 6, y - r * 0.5], [fx + Rough.jit(5), y - r * 0.5 - h], [fx + 6, y - r * 0.5]],
        { color: '#e8c33a', width: 2.4, jitter: 2.2, closed: false });
    }
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + t * 6) * 0.11;
      pts.push([x + Math.cos(a) * r * wob + Rough.jit(1.6), y + Math.sin(a) * r * wob + Rough.jit(1.6)]);
    }
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#a82c12';
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, pts, { color: fill, spacing: 5, width: 6, overflow: 1.18 });
    Rough.poly(ctx, pts, { color: '#6b1c08', width: 3, jitter: 2 });
    // a molten core, cracked open
    ctx.save();
    ctx.globalAlpha = 0.75 + Math.sin(t * 9) * 0.2;
    Rough.blob(ctx, x, y, r * 0.5, '#e8c33a', '#e8c33a', { spacing: 4, fillWidth: 5, sides: 9, width: 2 });
    ctx.restore();
    // and drips off the bottom while it hangs in the air
    if (!falling) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      for (const s of [-1, 1]) {
        Rough.line(ctx, x + s * r * 0.3, y + r * 0.75, x + s * r * 0.36 + Rough.jit(4), y + r * 1.5,
          { color: '#e0562d', width: 3, jitter: 1.6, passes: 1 });
      }
      ctx.restore();
    }
  }

}

/* ---------------------------------------------------- the castle's sentry
   There is one sentry post. Either the stick figure stands in it or the
   blob'd-tier does, never both. */
class Sentry {
  constructor(x, y, type) {
    this.id = nextId(); this.x = x; this.y = y;
    this.type = type || 'stick';
    this.cool = this.type === 'blobd' ? 1.9 : 1.6;
    this.aim = -Math.PI / 2; this.recoil = 0; this.bob = Math.random() * 6;
    this.wob = Math.random() * 6;
    this.homeX = x; this.homeY = y;      // the bird always comes back to the post
    this.dashCool = 3;                   // bird: seconds until the next run
    this.dash = null;
    this.queued = [];                    // shots waiting on a delay, for the Drill
  }

  /* The bird's dash timer, shortened by however long you have been holding
     still. Never below a second, and the Drill lowers the ceiling too. */
  dashMax(game) { return game.oneshot.drill ? 2.5 : 3; }
  dashWait(game) {
    return Math.max(1, this.dashMax(game) - game.stillBonus());
  }

  update(dt, game) {
    if (this.type === 'trapper') return this.trapperUpdate(dt, game);
    this.cool -= dt * (1 + 0.06 * Relics.val('crane'));     // the Paper Crane relic
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt / 0.25);

    // shots the Drill put on a delay
    for (let i = this.queued.length - 1; i >= 0; i--) {
      const q = this.queued[i];
      q.at -= dt;
      if (q.at <= 0) {
        this.queued.splice(i, 1);
        if (q.target && !q.target.dead) {
          game.effects.push(sentryArrow(this.x, this.y, q.target, q.dmg));
          Sfx.play('sentry_shot', { volume: 0.3, throttle: 40 });
        }
      }
    }

    if (this.type === 'bird') this.birdDash(dt, game);

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
        this.recoil = 1;
        if (this.type === 'blobd') {
          this.cool = 1.9;
          // two blots, one arcing over the top and one under - and with the
          // Drill a third straight up the middle, which arrives first
          for (const side of [-1, 1]) {
            game.effects.push(new InkBlotShot(this.x, this.y - 4, best, 2, side));
          }
          if (game.oneshot.drill) game.effects.push(new InkBlotShot(this.x, this.y - 4, best, 2, 0));
          Sfx.play('ink_splat', { volume: 0.45, throttle: 60 });
        } else if (this.type === 'bird') {
          this.cool = 1.5;
          game.effects.push(new BirdBolt(this.x, this.y - 4, best, game.oneshot.drill ? 4 : 2));
          Sfx.play('zap', { volume: 0.32, throttle: 60 });
        } else {
          this.cool = 1.6;
          game.effects.push(sentryArrow(this.x, this.y, best, 3));
          // the Drill looses a second one a beat behind the first
          if (game.oneshot.drill) this.queued.push({ at: 0.28, target: best, dmg: 3 });
          Sfx.play('sentry_shot', { volume: 0.4 });
        }
      }
    }
    return true;
  }

  /* Six blocks at the cursor, or all the way to it if it is nearer than that,
     and back to the post afterwards. Anything on the line takes 4. */
  birdDash(dt, game) {
    if (this.dash) {
      const d = this.dash;
      d.t += dt;
      const k = E.clamp01(d.t / d.dur);
      // out hard, home slower, the way the Eagle swoops
      const swing = k < 0.42 ? E.out(k / 0.42) : 1 - E.inOut((k - 0.42) / 0.58);
      this.x = d.fromX + (d.toX - d.fromX) * swing;
      this.y = d.fromY + (d.toY - d.fromY) * swing;
      // carve whatever it passes through, once each
      for (const e of game.enemies) {
        if (e.dead || d.hit.has(e.id)) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= e.r + 16) {
          d.hit.add(e.id);
          game.sentryHurt(e, 4, { color: '#8ea6ff' });
          for (let i = 0; i < 4; i++) game.effects.push(new Crumb(this.x, this.y, '#8ea6ff'));
        }
      }
      if (k >= 1) { this.dash = null; this.x = this.homeX; this.y = this.homeY; }
      return;
    }
    this.dashCool -= dt;
    if (this.dashCool > 0) return;
    this.dashCool = this.dashWait(game);
    const px = game.pointer.x - game.w / 2, py = game.pointer.y - game.h / 2;
    const dx = px - this.homeX, dy = py - this.homeY;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(BLOCK * 6, d);            // to the cursor, or six blocks at it
    this.dash = {
      t: 0, dur: 0.5, hit: new Set(),
      fromX: this.homeX, fromY: this.homeY,
      toX: this.homeX + (dx / d) * reach, toY: this.homeY + (dy / d) * reach
    };
    Sfx.play('eagle_dash', { volume: 0.4, throttle: 120 });
  }

  draw(ctx, t) {
    if (this.type === 'blobd') return this.drawBlobd(ctx, t);
    if (this.type === 'bird') return this.drawBird(ctx, t);
    if (this.type === 'trapper') return this.drawTrapper(ctx, t);
    if (this.type === 'stick' && sentryLook('stick')) return this.drawZeus(ctx, t);   // the Zeus skin
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
  /* A lump of the Blot, kept on a leash and pointed the other way. */
  drawBlobd(ctx, t) {
    Rough.boil(this.id, t * 1.2);
    const squat = 1 - E.pop(this.recoil) * 0.2;
    const bob = Math.sin(t * 2.4 + this.wob) * 1.8;
    const x = this.x, y = this.y + bob;
    const r = 13;
    const pts = [];
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      const wob = 1 + Math.sin(a * 3 + t * 2) * 0.12;
      pts.push([x + Math.cos(a) * r * wob, y + Math.sin(a) * r * wob * squat + Rough.jit(1.2)]);
    }
    Rough.scribble(ctx, pts, { color: '#6b4fb0', spacing: 5, width: 5, overflow: 1.12 });
    Rough.grain(ctx, pts, '#000000', 0.003, this.id);
    Rough.poly(ctx, pts, { color: '#2b2b2b', width: 2.4, jitter: 1.3 });
    // a drip, and the single eye watching whatever it is aiming at
    Rough.blob(ctx, x, y + r * 0.95 + Math.sin(t * 3) * 1.5, r * 0.22, '#6b4fb0', '#2b2b2b',
      { spacing: 4, fillWidth: 3, sides: 7, width: 1.6 });
    const lx = Math.cos(this.aim) * 3, ly = Math.sin(this.aim) * 3;
    ctx.save();
    ctx.fillStyle = '#e8e0ff';
    ctx.beginPath(); ctx.ellipse(x, y - 2, 5.5, 5.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 5.5, 5.5, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(x + lx, y - 2 + ly, 2.4, 2.4, 0, 0, 7); ctx.fill();
    ctx.restore();
    // the little collar that says it works here now
    Rough.arc(ctx, x, y + r * 0.35, r * 0.8, 0.3, Math.PI - 0.3, { color: '#c9a36b', width: 2.2, jitter: 1.2 });
  }

  /* THE ELECTRIC BIRD - the Eagle at a tenth the size, drawn in the same
     forked lightning and pointed at whatever it is about to throw itself at. */
  drawBird(ctx, t) {
    Rough.boil(this.id, t * 1.4);
    const flying = !!this.dash;
    const bob = flying ? 0 : Math.sin(t * 3.4 + this.wob) * 2;
    const x = this.x, y = this.y + bob;
    const a = this.dash
      ? Math.atan2(this.dash.toY - this.dash.fromY, this.dash.toX - this.dash.fromX)
      : this.aim;
    const beat = Math.sin(t * (flying ? 26 : 8) + this.wob);

    // the streak it tears while it is out
    if (flying) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      for (const off of [-4, 4]) {
        Rough.line(ctx, x - Math.cos(a) * 34 + off, y - Math.sin(a) * 34,
          x - Math.cos(a) * 6, y - Math.sin(a) * 6,
          { color: '#8ea6ff', width: 2.4, jitter: 2.8, passes: 1 });
      }
      ctx.restore();
    }

    // no meter - it just visibly winds up, sparking harder the closer it is
    const k = flying ? 0 : E.clamp01(1 - this.dashCool / this.dashWait(Game));
    if (k > 0.6) {
      const heat = (k - 0.6) / 0.4;
      ctx.save();
      ctx.globalAlpha = heat * 0.45;
      Rough.bloom(ctx, x, y, 14 + heat * 8, '#8ea6ff', 0.5);
      ctx.globalAlpha = heat * (0.5 + Math.sin(t * 22) * 0.4);
      for (let i = 0; i < 3; i++) {
        const sa = t * 7 + i * 2.1 + this.wob;
        const rr = 11 + heat * 5;
        Rough.line(ctx, x + Math.cos(sa) * rr, y + Math.sin(sa) * rr,
          x + Math.cos(sa) * (rr + 4), y + Math.sin(sa) * (rr + 4),
          { color: '#8ea6ff', width: 2, jitter: 1.6, passes: 1 });
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);          // -y is the way it is looking

    // wings: one forked bolt each side, swept back, thin enough to read
    const span = 16 + beat * 3 + k * 2;
    for (const s of [-1, 1]) {
      Rough.poly(ctx, [[s * 3, -2], [s * span * 0.45, -1 - beat], [s * span * 0.7, 3],
      [s * span, 1 + beat * 2]],
        { color: '#8ea6ff', width: 2.6, jitter: 1.6, closed: false });
      Rough.poly(ctx, [[s * span * 0.7, 3], [s * span * 0.8, 7]],
        { color: '#8ea6ff', width: 2, jitter: 1.4, closed: false });
    }

    // a forked tail, the way the Eagle's reads
    Rough.poly(ctx, [[-3.5, 8], [0, 4], [3.5, 8]], { color: '#8ea6ff', width: 2.2, jitter: 1.4, closed: false });

    // body: a pointed lozenge rather than a lump, so the silhouette has a nose
    const body = [[0, -10], [4.2, -2], [2.8, 7], [-2.8, 7], [-4.2, -2]]
      .map(pt => [pt[0] + Rough.jit(0.9), pt[1] + Rough.jit(0.9)]);
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    body.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
    ctx.closePath(); ctx.fill();
    Rough.scribble(ctx, body, { color: '#8ea6ff', spacing: 4, width: 4, overflow: 1.1 });
    Rough.poly(ctx, body, { color: '#3a4a7a', width: 1.7, jitter: 0.9 });

    // beak and one hard little eye
    Rough.poly(ctx, [[-1.8, -8], [0, -13], [1.8, -8]], { color: '#d99a26', width: 1.8, jitter: 0.8 });
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(1.5, -6, 1.1, 1.1, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
}

/* The blob'd-tier's shot: an ink blot that swings out on an oval instead of
   flying straight, one over the top and one underneath. */
class InkBlotShot {
  constructor(x, y, target, dmg, side) {
    this.id = nextId();
    this.sx = x; this.sy = y;
    this.x = x; this.y = y;
    this.target = target; this.dmg = dmg; this.side = side;
    this.tx = target.x; this.ty = target.y;
    this.t = 0; this.dur = 0.55 + Math.random() * 0.1;
    this.spin = Math.random() * 6;
  }
  update(dt, game) {
    this.t += dt;
    if (this.target && !this.target.dead) { this.tx = this.target.x; this.ty = this.target.y; }
    const u = Math.min(1, this.t / this.dur);
    const dx = this.tx - this.sx, dy = this.ty - this.sy;
    const len = Math.hypot(dx, dy) || 1;
    // straight line plus a sine bulge across it: the two shots make an oval
    const bulge = Math.sin(u * Math.PI) * Math.min(70, len * 0.45) * this.side;
    this.x = this.sx + dx * u + (-dy / len) * bulge;
    this.y = this.sy + dy * u + (dx / len) * bulge;
    this.spin += dt * 9;
    if (u >= 1) {
      if (this.target && !this.target.dead) game.sentryHurt(this.target, this.dmg, { color: '#6b4fb0' });
      game.effects.push(new Splash(this.x, this.y, 16));
      return false;
    }
    return true;
  }
  draw(ctx, t) {
    Rough.boil(this.id, Math.floor(t * 12));
    const u = Math.min(1, this.t / this.dur);
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, 16, '#8a6fd8', 0.5);
    ctx.save();
    ctx.globalAlpha = 0.85;
    Rough.blob(ctx, this.x, this.y, 5.5 - u * 1.2, '#6b4fb0', '#2b2b2b',
      { spacing: 4, fillWidth: 3.5, sides: 8, width: 1.6 });
    ctx.globalAlpha = 0.35;
    Rough.circle(ctx, this.x, this.y, 8, { color: '#6b4fb0', width: 1.6, jitter: 2, wobble: 2 });
    ctx.restore();
  }
}

/* What the Blot leaves behind, half the time. Click it to take it in. */
/* The Electric Bird's shot: a short forked bolt rather than an arrow. */
class BirdBolt {
  constructor(x, y, target, dmg) {
    this.id = nextId(); this.x = x; this.y = y; this.target = target; this.dmg = dmg;
    this.speed = 620; this.trail = [];
  }
  update(dt, game) {
    if (!this.target || this.target.dead) return false;
    const tx = this.target.x, ty = this.target.y;
    const d = Math.hypot(tx - this.x, ty - this.y) || 1;
    this.a = Math.atan2(ty - this.y, tx - this.x);
    this.x += (tx - this.x) / d * this.speed * dt;
    this.y += (ty - this.y) / d * this.speed * dt;
    this.trail.push([this.x + Rough.jit(3), this.y + Rough.jit(3)]);
    if (this.trail.length > 5) this.trail.shift();
    if (d < 15) {
      game.sentryHurt(this.target, this.dmg, { color: '#8ea6ff' });
      for (let i = 0; i < 3; i++) game.effects.push(new Crumb(this.x, this.y, '#8ea6ff'));
      return false;
    }
    return true;
  }
  draw(ctx) {
    for (let i = 1; i < this.trail.length; i++) {
      ctx.save();
      ctx.globalAlpha = i / this.trail.length * 0.6;
      Rough.line(ctx, this.trail[i - 1][0], this.trail[i - 1][1], this.trail[i][0], this.trail[i][1],
        { color: '#8ea6ff', width: 2.2, jitter: 1.6, passes: 1 });
      ctx.restore();
    }
    const a = this.a || 0;
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, 18, '#8ea6ff', 0.7);
    Rough.poly(ctx, [[this.x - Math.cos(a) * 7 + Rough.jit(2), this.y - Math.sin(a) * 7 + Rough.jit(2)],
    [this.x - Math.cos(a) * 3, this.y - Math.sin(a) * 3 + 3], [this.x, this.y]],
      { color: '#dfe6ff', width: 2.4, jitter: 1.4, closed: false });
  }
}

/* What the Thunder Eagle leaves behind, half the time. */
class BirdDrop {
  constructor(x, y) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.t = 0; this.life = 22;
    this.taken = false;
    this.r = 19;
  }
  update(dt, game) {
    this.t += dt;
    this.life -= dt;
    return this.life > 0 && !this.taken;
  }
  tryTake(x, y, game) {
    if (this.taken) return false;
    if (Math.hypot(x - this.x, y - this.y) > this.r + 14) return false;
    this.taken = true;
    game.installSentry('bird');
    game.effects.push(new FloatText(this.x, this.y - 24, 'electric bird', '#8ea6ff', 20, true));
    for (let i = 0; i < 16; i++) game.effects.push(new Crumb(this.x, this.y, '#8ea6ff'));
    Sfx.play('card_buy', { volume: 0.9 });
    return true;
  }
  draw(ctx, t) {
    const bob = Math.sin(t * 3 + this.id) * 4;
    const y = this.y + bob;
    const fade = this.life < 4 ? (Math.sin(t * 12) * 0.35 + 0.65) : 1;
    Rough.boil(this.id, Math.floor(t * 4));
    ctx.save();
    ctx.globalAlpha = fade * (0.4 + Math.sin(t * 3) * 0.2);
    Rough.circle(ctx, this.x, y, this.r + 7 + Math.sin(t * 3) * 3,
      { color: '#d99a26', width: 2.4, jitter: 2.4, wobble: 3 });
    ctx.globalAlpha = fade;
    Rough.bloom(ctx, this.x, y, 22, '#8ea6ff', 0.4);
    // a folded little bolt-bird sitting in the ring
    const beat = Math.sin(t * 9);
    for (const sd of [-1, 1]) {
      Rough.poly(ctx, [[this.x + sd * 2, y - 1], [this.x + sd * 9, y - 5 - beat * 2],
      [this.x + sd * 11, y - 1], [this.x + sd * 14, y + 4]],
        { color: '#8ea6ff', width: 2.4, jitter: 1.8, closed: false });
    }
    Rough.blob(ctx, this.x, y, 6, '#8ea6ff', '#2b2b2b', { spacing: 4, fillWidth: 3.5, sides: 8, width: 1.8 });
    Rough.blob(ctx, this.x, y - 8, 4, '#dfe6ff', '#2b2b2b', { spacing: 3, fillWidth: 3, sides: 7, width: 1.6 });
    Rough.poly(ctx, [[this.x - 1.8, y - 10], [this.x, y - 15], [this.x + 1.8, y - 10]],
      { color: '#d99a26', width: 1.8, jitter: 1 });
    ctx.globalAlpha = fade * 0.9;
    Rough.text(ctx, 'CLICK', this.x, y - this.r - 16, 12, '#d99a26');
    ctx.restore();
  }
}

class BlobdDrop {
  constructor(x, y) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.t = 0; this.life = 22;          // it waits, but not forever
    this.taken = false;
    this.r = 19;
  }
  update(dt, game) {
    this.t += dt;
    this.life -= dt;
    return this.life > 0 && !this.taken;
  }
  /* Called from the click handler before enemies are considered. */
  tryTake(x, y, game) {
    if (this.taken) return false;
    if (Math.hypot(x - this.x, y - this.y) > this.r + 14) return false;
    this.taken = true;
    game.installSentry('blobd');
    game.effects.push(new FloatText(this.x, this.y - 24, "blob'd-tier", '#6b4fb0', 20, true));
    for (let i = 0; i < 16; i++) game.effects.push(new Crumb(this.x, this.y, '#6b4fb0'));
    Sfx.play('card_buy', { volume: 0.9 });
    return true;
  }
  draw(ctx, t) {
    const bob = Math.sin(t * 2.6 + this.id) * 4;
    const y = this.y + bob;
    const fade = this.life < 4 ? (Math.sin(t * 12) * 0.35 + 0.65) : 1;
    Rough.boil(this.id, Math.floor(t * 4));
    ctx.save();
    ctx.globalAlpha = fade;
    // a ring so it reads as a pickup and not another enemy
    ctx.globalAlpha = fade * (0.4 + Math.sin(t * 3) * 0.2);
    Rough.circle(ctx, this.x, y, this.r + 7 + Math.sin(t * 3) * 3,
      { color: '#d99a26', width: 2.4, jitter: 2.4, wobble: 3 });
    ctx.globalAlpha = fade;
    Rough.blob(ctx, this.x, y, this.r * 0.75, '#6b4fb0', '#2b2b2b',
      { spacing: 5, fillWidth: 4.5, sides: 10, width: 2.2 });
    ctx.fillStyle = '#e8e0ff';
    ctx.beginPath(); ctx.ellipse(this.x, y - 2, 4.5, 4.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(this.x, y - 2, 4.5, 4.5, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = fade * 0.9;
    Rough.text(ctx, 'CLICK', this.x, y - this.r - 16, 12, '#d99a26');
    ctx.restore();
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
      if (this.target && !this.target.dead) game.sentryHurt(this.target, this.dmg, { color: '#4c9f70' });
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
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, 14, '#4c9f70', 0.45);
    Rough.line(ctx, this.x - Math.cos(a) * 8, this.y - Math.sin(a) * 8, this.x, this.y,
      { color: '#2f6f4f', width: 2.4, jitter: 0.8, passes: 1 });
  }
}

/* The stick sentry's shot: an arrow, or under the Zeus skin a thunderbolt
   that flies and hits exactly the same. */
function sentryArrow(x, y, target, dmg) {
  const look = sentryLook('stick');
  return look && look.shot === 'bolt' ? new ZeusBolt(x, y, target, dmg) : new Arrow(x, y, target, dmg);
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
    Rough.circle(ctx, this.x, this.y, this.r * (0.7 + E.out(p) * 1.1),
      { color: this.color, width: 3, jitter: 4, alpha: (1 - E.out(p)) * 0.85 });
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
    // the ring fades as it spreads (strokes take alpha explicitly)
    Rough.circle(ctx, this.x, this.y, 6 + p * (this.crit ? 46 : 26),
      { color: this.color, width: this.crit ? 3 : 2, jitter: 2.5, alpha: (1 - p) * (this.crit ? 0.95 : 0.7) });
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
        e.hurt(damage, game, { color: '#e0562d', fire: true });
        if (!e.dead) e.ignite(3 + game.statusBonus());
      }
    }
    for (let i = 0; i < 10; i++) game.effects.push(new Ember(x, y, radius * 0.7));
    game.shake(7);
  }
  update(dt) { this.life -= dt; return this.life > 0; }
  draw(ctx, t) {
    const lin = 1 - this.life / this.max;
    const p = E.outQuint(lin);
    const r = this.radius * (0.3 + p * 0.75);
    Rough.boil(this.id, t * 2);
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, r * 1.3, '#ff7a2d', E.hold(lin, 0.35) * 0.8);   // heat under it
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

/* The Thunder Eagle's exit: it rears, then climbs out of the page, leaving
   smear frames stretched behind it the whole way up. */
class EagleAscend {
  constructor(x, y, r, game) {
    this.id = nextId();
    this.x = x; this.y = y; this.r = r;
    this.t = 0; this.rear = 0.55; this.dur = 1.9;
    this.top = -(game.h / 2) - r * 4;
    this.trail = [];
    this.flash = 0;
  }
  update(dt, game) {
    this.t += dt;
    const k = E.clamp01((this.t - this.rear) / (this.dur - this.rear));
    if (this.t > this.rear) {
      const prevY = this.cy;
      this.cy = this.y + (this.top - this.y) * Math.pow(E.clamp01(k), 1.45);
      if (prevY != null && Math.abs(this.cy - prevY) > 1) {
        this.trail.unshift({ y: prevY, stretch: Math.abs(this.cy - prevY) });
        if (this.trail.length > 10) this.trail.pop();
      }
      if (this.flash === 0) {
        this.flash = 1;
        for (let i = 0; i < 18; i++) game.effects.push(new Crumb(this.x, this.y, '#8ea6ff'));
      }
    } else {
      this.cy = this.y - E.out(this.t / this.rear) * this.r * 0.5;   // the rear-up
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const k = E.clamp01((this.t - this.rear) / (this.dur - this.rear));
    const fade = this.t > this.dur - 0.6 ? E.clamp01((this.dur - this.t) / 0.6) : 1;
    Rough.boil(this.id, Math.floor(time * 20));

    // the column of air it leaves on the way out
    if (this.t > this.rear) {
      ctx.save();
      ctx.globalAlpha = fade * 0.5;
      for (let i = 0; i < 4; i++) {
        const off = (i - 1.5) * this.r * 0.45;
        Rough.line(ctx, this.x + off, this.cy, this.x + off + Rough.jit(8), this.y + this.r,
          { color: '#8ea6ff', width: 3 - i * 0.4, jitter: 6, passes: 1 });
      }
      ctx.restore();
    }

    // smear frames: each one stretched along the direction of travel, but
    // never so far that it stops reading as a bird
    for (let i = 0; i < this.trail.length; i++) {
      const s = this.trail[i];
      const a = (1 - i / this.trail.length) * 0.75 * fade;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(this.x, s.y);
      ctx.scale(1 - i * 0.04, 1 + Math.min(2.2, s.stretch / (this.r * 0.8)));
      this.eagleGhost(ctx, this.r * (1 - i * 0.03), false, a);
      ctx.restore();
    }

    // the bird itself, stretched thin as it goes
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(this.x, this.cy);
    const stretch = this.t > this.rear ? 1 + E.out(k) * 1.6 : 1;
    ctx.scale(1 / Math.sqrt(stretch), stretch);
    this.eagleGhost(ctx, this.r, true);
    ctx.restore();

    // the clap of light where it tore free
    if (this.t > this.rear && this.t < this.rear + 0.4) {
      const f = 1 - (this.t - this.rear) / 0.4;
      ctx.save();
      ctx.globalAlpha = f * 0.85;
      Rough.circle(ctx, this.x, this.y, this.r * (1 + (1 - f) * 3), { color: '#dfe6ff', width: 5, jitter: 5 });
      ctx.restore();
    }
  }
  /* A flattened silhouette - smears want shape, not detail. */
  eagleGhost(ctx, r, solid, alpha) {
    const wing = [[0, -r * 0.2], [-r * 1.5, -r * 0.5], [-r * 0.5, r * 0.1],
    [0, r * 0.9], [r * 0.5, r * 0.1], [r * 1.5, -r * 0.5]];
    if (solid) {
      Rough.scribble(ctx, wing, { color: '#4a5b8f', spacing: 7, width: 6, overflow: 1.1, alpha: 0.85 });
      Rough.poly(ctx, wing, { color: '#2b2b2b', width: 3, jitter: 2 });
      return;
    }
    // a ghost gets a solid body, or it vanishes once it is stretched
    ctx.save();
    ctx.globalAlpha = (alpha == null ? 0.5 : alpha) * 0.55;
    ctx.fillStyle = '#8ea6ff';
    ctx.beginPath();
    wing.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fill();
    ctx.restore();
    Rough.poly(ctx, wing, { color: '#6d84d6', width: 2.6, jitter: 2 });
  }
}

/* The magnet's haul: everything nearby is dragged to one point. */
class MagnetPull {
  constructor(x, y, radius, damage, game, hold) {
    this.id = nextId();
    // never haul them onto the castle - that would be handing the wave the
    // front door, which is exactly what it did the first time
    const safe = game.castleRadius + BLOCK * 2.6;
    const d = Math.hypot(x, y);
    if (d < safe) {
      const a = d > 1 ? Math.atan2(y, x) : Math.random() * Math.PI * 2;
      x = Math.cos(a) * safe;
      y = Math.sin(a) * safe;
    }
    this.x = x; this.y = y; this.radius = radius;
    this.t = 0; this.dur = 0.45 + (hold || 0);
    this.hold = hold || 0;
    this.caught = [];
    for (const en of game.enemies) {
      if (en.dead) continue;
      if (Math.hypot(en.x - x, en.y - y) <= radius + en.r) {
        this.caught.push({ e: en, fromX: en.x, fromY: en.y, a: Math.random() * 6 });
        if (damage > 0) en.hurt(damage, game, { color: '#3f7d8c' });
      }
    }
    this.filings = [];
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = radius * (0.3 + Math.random() * 0.8);
      this.filings.push({ a, d, spin: Math.random() * 6 });
    }
  }
  update(dt, game) {
    this.t += dt;
    const k = E.out(Math.min(1, this.t / 0.45));
    for (const c of this.caught) {
      if (c.e.dead) continue;
      // they end up packed round the point rather than all inside each other
      const tx = this.x + Math.cos(c.a) * c.e.r * 1.1;
      const ty = this.y + Math.sin(c.a) * c.e.r * 1.1;
      c.e.x = c.fromX + (tx - c.fromX) * k;
      c.e.y = c.fromY + (ty - c.fromY) * k;
      c.e.stun = Math.max(c.e.stun, 0.12 + this.hold);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const k = E.out(Math.min(1, this.t / 0.45));
    const fade = this.t > this.dur - 0.3 ? E.clamp01((this.dur - this.t) / 0.3) : 1;
    Rough.boil(this.id, Math.floor(time * 10));
    ctx.save();
    ctx.globalAlpha = fade * 0.7;
    // field lines curling into the point
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + this.t * 1.5;
      const r1 = this.radius * (1 - k * 0.5), r2 = r1 * 0.35;
      Rough.poly(ctx, [
        [this.x + Math.cos(a) * r1, this.y + Math.sin(a) * r1],
        [this.x + Math.cos(a + 0.4) * (r1 + r2) / 2, this.y + Math.sin(a + 0.4) * (r1 + r2) / 2],
        [this.x + Math.cos(a + 0.9) * r2, this.y + Math.sin(a + 0.9) * r2]
      ], { color: '#3f7d8c', width: 2.4, jitter: 2.4, closed: false });
    }
    // iron filings skidding in
    ctx.fillStyle = '#2b2b2b';
    for (const f of this.filings) {
      const d = f.d * (1 - k);
      ctx.save();
      ctx.globalAlpha = fade * 0.5;
      ctx.translate(this.x + Math.cos(f.a) * d, this.y + Math.sin(f.a) * d);
      ctx.rotate(f.a + Math.PI / 2);
      ctx.fillRect(-1, -3, 2, 6);
      ctx.restore();
    }
    ctx.globalAlpha = fade * 0.9;
    Rough.circle(ctx, this.x, this.y, 10 + (1 - k) * 8, { color: '#3f7d8c', width: 3, jitter: 2, wobble: 3 });
    ctx.restore();
  }
}

/* Everything the magnet gathered, thrown back out. */
class MagnetBurst {
  constructor(x, y, caught, damage, game) {
    this.id = nextId(); this.x = x; this.y = y;
    this.t = 0; this.dur = 0.8;
    for (const c of caught) {
      const en = c.e || c;
      if (!en || en.dead) continue;
      const a = Math.atan2(en.y - y, en.x - x) + (Math.random() - 0.5) * 0.6;
      const throwTo = BLOCK * (3.5 + Math.random() * 2);
      en.x += Math.cos(a) * throwTo;
      en.y += Math.sin(a) * throwTo;
      en.stun = Math.max(en.stun, 0.5 + game.statusBonus());
      en.hurt(damage, game, { color: '#3f7d8c' });
    }
    game.shake(16);
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const k = E.out(this.t / this.dur);
    Rough.boil(this.id, Math.floor(time * 14));
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.9;
    Rough.circle(ctx, this.x, this.y, 20 + k * BLOCK * 6, { color: '#3f7d8c', width: 6 * (1 - k) + 1, jitter: 4, wobble: 8 });
    Rough.circle(ctx, this.x, this.y, 10 + k * BLOCK * 4, { color: '#9fc4cc', width: 4 * (1 - k) + 1, jitter: 3, wobble: 6 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      Rough.line(ctx, this.x + Math.cos(a) * 16, this.y + Math.sin(a) * 16,
        this.x + Math.cos(a) * (16 + k * BLOCK * 5), this.y + Math.sin(a) * (16 + k * BLOCK * 5),
        { color: '#3f7d8c', width: 3 * (1 - k) + 1, jitter: 3, passes: 1 });
    }
    ctx.restore();
  }
}

/* A thrown boomerang: out along a loop, then home, cutting on both legs. */
class Boomerang {
  constructor(x, y, angle, reach, damage, game, dur, laps) {
    this.id = nextId();
    this.sx = x; this.sy = y;
    this.a = angle; this.reach = reach; this.damage = damage;
    this.t = 0; this.dur = dur || 1.15;
    this.laps = laps || 1;
    this.drift = 0;            // rad/s the whole loop swings round by
    this.spin = 0;
    this.hit = new Set();
    this.leg = 0;
    this.x = x; this.y = y;
    this.trail = [];
  }
  update(dt, game) {
    this.t += dt;
    this.a += this.drift * dt;     // so a second lap never retraces the first
    const ride = (this.t / this.dur) * this.laps;
    const u = Math.min(1, this.laps > 1 ? ride % 1 : ride);
    // out and back, with a swing to one side: a loop, not a straight line
    const along = Math.sin(u * Math.PI) * this.reach;
    const across = Math.sin(u * Math.PI * 2) * this.reach * 0.3;
    const c = Math.cos(this.a), s = Math.sin(this.a);
    this.x = this.sx + c * along - s * across;
    this.y = this.sy + s * along + c * across;
    this.spin += dt * 22;

    this.trail.unshift([this.x, this.y]);
    if (this.trail.length > 9) this.trail.pop();

    // a fresh list of victims on the way out and again on the way home
    const leg = Math.floor(ride * 2);
    if (leg !== this.leg) { this.leg = leg; this.hit.clear(); }
    for (const e of game.enemies) {
      if (e.dead || this.hit.has(e.id)) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= e.r + 22) {   // it is a spinning blade
        this.hit.add(e.id);
        e.hurt(this.damage, game, { color: '#8a6a3a' });
      }
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    ctx.save();
    for (let i = 1; i < this.trail.length; i++) {
      ctx.globalAlpha = (1 - i / this.trail.length) * 0.35;
      Rough.line(ctx, this.trail[i - 1][0], this.trail[i - 1][1], this.trail[i][0], this.trail[i][1],
        { color: '#8a6a3a', width: 3, jitter: 1.6, passes: 1 });
    }
    ctx.restore();

    Rough.boil(this.id, Math.floor(time * 18));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    const arm = [[-13, 10], [-3, -12], [3, -12], [2, -2], [12, 8], [8, 13], [-8, 14]];
    Rough.scribble(ctx, arm, { color: '#c9a36b', spacing: 5, width: 5, overflow: 1.14 });
    Rough.poly(ctx, arm, { color: '#5c4326', width: 2.4, jitter: 1.2 });
    ctx.restore();
  }
}

/* SECOND DRAFT: the page is scrubbed back to nothing and drawn again - the
   enemies come back smaller and weaker, the castle comes back mended. */
class SecondDraft {
  constructor(game, cut, damage) {
    this.id = nextId();
    this.t = 0; this.dur = 2.2; this.wiped = false; this.redrew = false;
    this.cut = cut; this.damage = damage || 0;
    this.w = game.w; this.h = game.h;
    this.strokes = [];
    for (let i = 0; i < 14; i++) {
      this.strokes.push({ y: -this.h / 2 + (i + 0.5) * (this.h / 14), at: i * 0.035, flip: i % 2 ? 1 : -1 });
    }
  }
  update(dt, game) {
    this.t += dt;
    if (!this.wiped && this.t >= 0.55) {
      this.wiped = true;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const take = e.boss ? this.cut * 0.5 : this.cut;    // bosses are harder to rub out
        e.maxHp = Math.max(1, Math.round(e.maxHp * (1 - take)));
        e.hp = Math.min(e.hp, e.maxHp);
        e.hpShown = Math.max(0, e.hp / e.maxHp);
        e.r = Math.max(7, e.r * (1 - take * 0.3));
        e.baseSpeed *= 0.75;
        e.applySlow(6 + game.statusBonus(), 0.75);
        e.faded = 1;
        if (this.damage > 0) e.hurt(this.damage, game, { color: '#b06078' });
        game.effects.push(new FloatText(e.x, e.y - e.r - 10, 'redrawn', '#b06078', 15, false));
      }
      // the castle is part of the page too, and it gets the clean copy
      if (game.castleHp < game.maxHp) {
        game.castleHp++;
        game.effects.push(new FloatText(0, -game.castleRadius - 30, '+1', '#4c9f70', 24, true));
      }
      game.shake(12);
    }
    return this.t < this.dur;
  }
  draw(ctx, time) {
    const fade = this.t > this.dur - 0.7 ? E.clamp01((this.dur - this.t) / 0.7) : 1;
    Rough.boil(this.id, 0);

    // the scrub: band by band, the page goes blank
    ctx.save();
    for (const s of this.strokes) {
      const k = E.clamp01((this.t - s.at) / 0.42);
      if (k <= 0) continue;
      const gone = E.clamp01((this.t - 0.75 - s.at) / 0.6);
      ctx.globalAlpha = (1 - gone) * fade;
      ctx.fillStyle = '#fffdf4';
      const bandH = this.h / 14 + 6;
      ctx.fillRect(-this.w / 2 - 10 + (1 - E.out(k)) * this.w * s.flip, s.y - bandH / 2,
        this.w + 20, bandH);
      // the edge of the rubber, still moving
      if (k < 1) {
        const ex = -this.w / 2 - 10 + (1 - E.out(k)) * this.w * s.flip + (s.flip > 0 ? 0 : this.w + 20);
        ctx.globalAlpha = (1 - gone) * fade * 0.8;
        Rough.line(ctx, ex, s.y - bandH / 2, ex, s.y + bandH / 2,
          { color: '#e58ba0', width: 4, jitter: 3, passes: 1 });
      }
    }
    ctx.restore();

    // crumbs swept off the page
    if (this.t > 0.3) {
      Rough.srand(this.id);
      ctx.save();
      ctx.fillStyle = '#d8d2c2';
      for (let i = 0; i < 40; i++) {
        const age = E.clamp01((this.t - 0.3 - Rough.rnd() * 0.5) / 1.0);
        if (age <= 0) continue;
        ctx.globalAlpha = (1 - age) * 0.7 * fade;
        ctx.fillRect(-this.w / 2 + Rough.rnd() * this.w,
          -this.h / 2 + Rough.rnd() * this.h + age * 70, 3, 6);
      }
      ctx.restore();
    }
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
