/* FANDHARN - IGNIS, THE LAST ATTACKER. Wave 15, alone.

   He climbs out of the ground, walks at the castle from the left, and four
   blocks off the lawn raises his staff and throws himself back to his post.
   Then the pattern, which never changes - only gets meaner:

     SUMMON  three burning hearts fly off the staff and circle the castle a
             block outside the lawn. While any heart lives he cannot be
             touched: he spins his staff and, every few seconds, reaches the
             spear end of it all the way to the castle (1 damage).
     HEART   4 HP. Broken, it unravels into an ORB (1 HP) that backs off a
             block and runs at the castle faster than an Auger (2 damage).
     EXPOSED all three gone: he kneels, and can be hit.
     ROAR    shatters the Chalk Ward and stuns you for a second - no clicks.
     ...and round again.

   Phase one is 250 HP. At zero he falls into a pile of bones; click the
   bones twice and he pulls himself back together - the bar doubles to 500
   and fills. Phase two: hearts unravel on their own after five seconds, the
   thrusts come faster, and instead of just roaring after he is exposed he
   leaps in and drives the spear into the lawn (2 damage) first.

   At any time he may catch a projectile - 45% of the time one comes within
   his 3x3-block reach - and spin the staff into a shield that eats every
   projectile in that reach for 1.5 seconds. Sentry shots, blots, bolts,
   boomerangs, drops.

   When he dies for good: ten seconds of cutscene. He speaks, breaks apart,
   and his bones rise into the sky and are gone. */

const IGNIS = {
  P1: 250, P2: 500,
  WALK: 22,
  THRUST: [3.4, 2.5], EXPOSED: [5, 4],
  HEART_LIFE: 5,
  BLOCK_CHANCE: 0.45, BLOCK_TIME: 1.5, BLOCK_COOL: 1.2, BLOCK_BOX: BLOCK * 1.5,
  ORB_SPEED: 560, HEAL_CHANCE: 0.25, HEAL: 0.5,
  HEART_R: GROUND_RADIUS + BLOCK,
  SCALE: 1.1, CHEST: 62
};

/* Which things are projectiles, for his shield. Looked up late: some are
   declared after this file. */
function igIsProjectile(fx) {
  return (typeof Arrow !== 'undefined' && fx instanceof Arrow)
    || (typeof BirdBolt !== 'undefined' && fx instanceof BirdBolt)
    || (typeof InkBlotShot !== 'undefined' && fx instanceof InkBlotShot)
    || (typeof Boomerang !== 'undefined' && fx instanceof Boomerang)
    || (typeof WaterDrop !== 'undefined' && fx instanceof WaterDrop);
}

const IGNIS_LINES = [
  { at: 0.6, text: 'Hah... so the little castle holds.' },
  { at: 3.7, text: 'Do not smile yet. This is not over.' },
  { at: 6.6, text: 'I was only the last attacker... not the last who will come.' }
];

const Ignis = {
  spawn(game) {
    const wide = game.w >= 620;
    const dir = wide ? [-1, 0] : [0, -1];
    const half = wide ? game.w / 2 : game.h / 2;
    const e = new Enemy('ignis', IGNIS.P1, 0, 0, 0);
    const stop = Math.max(IGNIS.HEART_R + 50, Math.min(GROUND_RADIUS + BLOCK * 4, half - 70));
    const post = Math.max(stop + 30, Math.min(stop + BLOCK * 2.5, half - 50));
    const start = Math.max(post + 10, Math.min(half - 60, GROUND_RADIUS + BLOCK * 8));
    e.ig = {
      state: 'intro', t: 0, animT: 0, anim: 'emerge', phase: 1, dir, dist: start, stop, post,
      thrustT: 0, blockT: 0, blockCool: 0, clicks: 0, hop: 0, rise: 0, did: {},
      barMax: IGNIS.P1, barFill: 0, fromDist: start
    };
    e.spawnT = 1;
    e.untouchable = true;
    e.guardText = '...';
    // the castle is put right for the last fight
    if (game.castleHp < game.maxHp) {
      game.castleHp = game.maxHp;
      game.effects.push(new FloatText(0, -game.castleRadius - 40, 'the castle is mended', '#4c9f70', 22, true));
      game.effects.push(new Flare(0, 0, { color: '#8fd18a', r: game.castleRadius * 1.6, dur: 0.8, rays: 12, motes: 10, rings: 2 }));
      Sfx.play('ward', { volume: 0.9 });
      UI.syncHud(game);
    }
    e.igPlace();
    game.enemies.push(e);
    game.cutscene = true;
    return e;
  },

  alive(game) { return game.enemies.find(e => e.kind === 'ignis' && !e.dead) || null; },

  /* A player's click (or slam) on the pile of bones. True if it landed. */
  boneClick(game, x, y) {
    const e = this.alive(game);
    if (!e || e.ig.state !== 'bones') return false;
    const f = e.igFeet();
    if (Math.hypot(x - f[0], y - (f[1] - 12)) > 60) return false;
    const g = e.ig;
    g.clicks++;
    g.rattle = 0.25;
    Sfx.play('bones_click', { volume: 0.9, rateVar: 0.1 });
    game.effects.push(new FloatText(f[0], f[1] - 50, g.clicks + ' / 2', '#e0562d', 22, true));
    for (let i = 0; i < 6; i++) game.effects.push(new Crumb(f[0] + Rough.jit(20), f[1] - 8, '#ece3c9'));
    game.shake(4);
    return true;
  },

  /* A heart comes undone into an orb. */
  decompile(game, heart) {
    const o = new Enemy('ignisorb', 1, 0, heart.x, heart.y);
    o.spawnT = 1;
    o.orb = { t: 0, sx: heart.x, sy: heart.y, mode: 'back', trail: [] };
    game.spawnQueue.push(o);
    game.effects.push(new IgnisUnravel(heart.x, heart.y));
    Sfx.play('heart_break', { volume: 0.8, throttle: 40 });
  },

  /* Everything of his on the page crumbles: when he falls, and when he dies. */
  clearBrood(game, parent) {
    for (const list of [game.enemies, game.spawnQueue]) {
      for (const h of list) {
        if (h.dead || (h.kind !== 'heart' && h.kind !== 'ignisorb' && h.kind !== 'ignisspear')) continue;
        if (h.kind === 'heart' && h.heart && h.heart.parent !== parent) continue;
        h.dead = true;
        game.effects.push(new IgnisUnravel(h.x, h.y, true));
      }
    }
  }
};

/* ------------------------------------------------------------ Ignis */
Object.assign(Enemy.prototype, {
  igFeet() { const g = this.ig; return [g.dir[0] * g.dist, g.dir[1] * g.dist]; },

  igPlace() {
    const f = this.igFeet();
    this.x = f[0];
    this.y = f[1] - IGNIS.CHEST;
    this.shadowY = f[1];
  },

  igSet(state) {
    const g = this.ig;
    g.state = state; g.t = 0; g.animT = 0; g.did = {};
  },

  igHeartsAlive(game) {
    let n = 0;
    for (const list of [game.enemies, game.spawnQueue]) {
      for (const h of list) if (!h.dead && h.kind === 'heart' && h.heart && h.heart.parent === this) n++;
    }
    return n;
  },

  /* His shield: the moment a projectile comes into reach he may catch it,
     and while the staff spins every projectile in reach is eaten. */
  igSweep(game, active) {
    const g = this.ig, B = IGNIS.BLOCK_BOX;
    for (let i = game.effects.length - 1; i >= 0; i--) {
      const fx = game.effects[i];
      if (!igIsProjectile(fx)) continue;
      if (Math.abs(fx.x - this.x) > B || Math.abs(fx.y - this.y) > B) continue;
      if (!active) {
        if (fx._igRoll) continue;
        fx._igRoll = true;
        if (g.blockCool > 0 || Math.random() >= IGNIS.BLOCK_CHANCE) continue;
        g.blockT = IGNIS.BLOCK_TIME;
        active = true;
        Sfx.play('ignis_block', { volume: 0.9, rateVar: 0.04 });
        game.effects.push(new FloatText(this.x, this.y - 70, 'blocked', '#ffd24a', 20, true));
      }
      game.effects.splice(i, 1);
      game.effects.push(new HitSpark(fx.x, fx.y, '#ffd24a', true));
      Sfx.play('ignis_block', { volume: 0.35, throttle: 90, rate: 1.4 });
    }
  },

  ignisUpdate(dt, game) {
    const g = this.ig;
    if (g.preview) return this.igPreview(dt);
    if (g.rattle > 0) g.rattle -= dt;
    // nothing moves him but himself: magnets, knockback and stuns slide off
    this.igPlace();
    const canBlock = !g.staffOut && (g.state === 'walk' || g.state === 'guard' || g.state === 'exposed');
    if (g.blockCool > 0) g.blockCool -= dt;
    if (g.blockT > 0) {
      g.blockT -= dt;
      this.igSweep(game, true);
      if (g.blockT <= 0) g.blockCool = IGNIS.BLOCK_COOL;
    } else if (canBlock) this.igSweep(game, false);
    g.animT += dt;
    if (g.blockT > 0) return;                 // the pattern waits while he blocks
    g.t += dt;
    const once = key => { if (g.did[key]) return false; g.did[key] = true; return true; };
    const f = this.igFeet();
    const hearts = this.igHeartsAlive(game);
    if (g.state !== 'intro' && g.state !== 'bones' && g.state !== 'collapse') {
      const P2 = g.phase === 2, rate = (P2 ? 22 : 6) * (Fx.low ? 0.3 : 1);
      if (Math.random() < dt * rate) game.effects.push(new IgnisCinder(this.x + Rough.jit(26), this.y + Rough.jit(40), P2 && Math.random() < 0.6));
      const moving = g.state === 'walk' || g.state === 'charge' || g.state === 'retreat' || g.state === 'dashback';
      g.scorchT = (g.scorchT || 0) - dt;
      if (P2 && g.scorchT <= 0 && (moving || Math.random() < dt * 1.5)) {
        g.scorchT = moving ? 0.07 : 0.4;
        game.effects.push(new IgnisScorch(f[0], f[1], moving ? 14 : 20));
      }
    }

    switch (g.state) {
      case 'intro': {
        if (once('rift')) { game.effects.push(new IgnisRift(f[0], f[1])); Sfx.play('ignis_rise', { volume: 1, rateVar: 0 }); game.shake(8); }
        if (g.t < 0.9) { g.anim = 'emerge'; g.rise = 0; }
        else if (g.t < 2.9) {
          g.anim = 'emerge'; g.rise = E.out((g.t - 0.9) / 2);
          if (Math.random() < dt * 14) game.effects.push(new Chunk(f[0] + Rough.jit(22), f[1] - 4, { shape: 'gob', color: '#7a5a3a', size: 3 + Math.random() * 3, speed: 90, up: 240, life: 1 }));
          if (Math.random() < dt * 10) game.effects.push(new Ember(f[0], f[1] - 20, 20));
        } else if (g.t < 3.7) {
          g.anim = 'idle'; g.rise = 1;
          if (once('eyes')) { game.effects.push(new Flare(this.x + 8, this.y - 44, { color: '#ff7a2d', r: 26, dur: 0.5, rays: 8, motes: 6, rings: 1 })); Sfx.play('ignis_summon', { volume: 0.5, rate: 1.5 }); }
        } else if (g.t < 5.0) {
          g.anim = 'roar';
          if (once('roar')) this.igRoar(game, false);
        } else if (g.t >= 5.2) {
          game.cutscene = false;
          this.igSet('walk');
        }
        break;
      }
      case 'walk':
        g.anim = 'walk';
        g.dist -= IGNIS.WALK * dt;
        if (Math.random() < dt * 3) game.effects.push(new Ember(this.x, this.y + 30, 16));
        if (g.dist <= g.stop) { g.dist = g.stop; this.igSet('raise'); }
        break;
      case 'raise':
        g.anim = 'raise';
        if (once('s')) Sfx.play('ignis_summon', { volume: 0.6, rate: 0.8 });
        if (g.t >= 0.6) { g.fromDist = g.dist; this.igSet('dashback'); Sfx.play('orb_dash', { volume: 0.7, rate: 0.7 }); }
        break;
      case 'dashback': {
        g.anim = 'dashback';
        const k = Math.min(1, g.t / 0.45);
        g.dist = igLerp(g.fromDist, g.post, E.out(k));
        if (!Fx.low && Math.random() < dt * 30) game.effects.push(new Dust(f[0], f[1] - 4, 30, '#b8ad9c'));
        if (k >= 1) this.igSet('summon');
        break;
      }
      case 'summon':
        g.anim = 'summon';
        if (once('circle')) { game.effects.push(new IgnisSigil(f[0], f[1])); Sfx.play('ignis_summon', { volume: 1, rateVar: 0 }); }
        if (g.t >= 0.5 && once('hearts')) this.igHearts(game);
        if (g.t >= 1.2) { g.thrustT = 1.0; this.igSet('guard'); }          // the first stab comes quickly
        break;
      case 'guard':
        g.anim = 'guard';
        g.thrustT -= dt;
        if (hearts === 0) { this.igExpose(game); break; }
        if (g.thrustT <= 0 && !g.staffOut) this.igSet('thrust');
        break;
      case 'thrust':
        g.anim = 'thrust';
        if (g.t >= 0.22 && once('hit')) {
          const tip = (this.igA && this.igA.tip) || [this.x, this.y];
          // he throws the staff itself, spear end first, at the castle: it
          // has to be broken in the air (5 HP) or it lands for 1 - and
          // either way he calls the pieces home and it is whole again
          const hand = (this.igA && this.igA.hand) || [this.x, this.y];
          const d = Math.hypot(hand[0], hand[1]) || 1;
          const half = IgnisSheet.staff(g.phase === 2 ? 1 : 0).len / 2;
          const jv = new Enemy('ignisspear', 5, 0, hand[0] - hand[0] / d * half * 0.3, hand[1] - hand[1] / d * half * 0.3);
          jv.spawnT = 1;
          jv.spear = { t: 0, speed: g.phase === 2 ? 215 : 170, trail: [], v: g.phase === 2 ? 1 : 0, owner: this };
          game.spawnQueue.push(jv);
          g.staffOut = true;
          game.effects.push(new Flare(hand[0], hand[1], { color: '#ff7a2d', r: 30, dur: 0.35, rays: 8, motes: 6, rings: 1 }));
          for (let i = 0; i < Fx.n(g.phase === 2 ? 12 : 6); i++) game.effects.push(new IgnisCinder(tip[0] + Rough.jit(20), tip[1], i % 2));
          Sfx.play('ignis_thrust', { volume: 1, rateVar: 0.05 });
          game.shake(6);
        }
        if (g.t >= 0.62) {
          g.thrustT = IGNIS.THRUST[g.phase - 1];
          if (this.igHeartsAlive(game) === 0) this.igExpose(game); else this.igSet('guard');
        }
        break;
      case 'exposed':
        g.anim = 'exposed';
        if (g.t >= IGNIS.EXPOSED[g.phase - 1] && !g.staffOut) this.igSet(g.phase === 1 ? 'roar' : 'charge');
        break;
      case 'roar':
        g.anim = 'roar';
        if (g.t >= 0.3 && once('roar')) this.igRoar(game, true);
        if (g.t >= 1.3) this.igSet('summon');
        break;
      case 'charge': {
        // phase two: a leap in to the edge of the lawn...
        g.anim = 'slam';
        const k = Math.min(1, g.t / 0.5);
        if (once('go')) { g.fromDist = g.dist; Sfx.play('orb_dash', { volume: 0.8, rate: 0.6 }); }
        g.dist = igLerp(g.fromDist, GROUND_RADIUS + BLOCK * 1.1, E.inOut(k));
        g.hop = Math.sin(k * Math.PI) * 46;
        g.animT = Math.min(g.animT, 0.24);        // hold the leap frames
        if (k >= 1) { g.hop = 0; this.igSet('slam'); g.animT = 0.25; }
        break;
      }
      case 'slam':
        // ...and the spear driven into it
        g.anim = 'slam';
        if (g.t >= 0.12 && once('hit')) {
          const tip = (this.igA && this.igA.tip) || f;
          game.effects.push(new HammerSlam(tip[0], tip[1], BLOCK * 1.4, 2, game));
          game.effects.push(new Flare(tip[0], tip[1], { color: '#ff7a2d', r: 60, dur: 0.6, rays: 16, motes: 12, rings: 3 }));
          game.effects.push(new IgnisFireRing(tip[0], tip[1], BLOCK * 2.6));
          game.effects.push(new IgnisScorch(tip[0], tip[1], 34));
          for (let i = 0; i < Fx.n(16); i++) game.effects.push(new IgnisCinder(tip[0] + Rough.jit(30), tip[1] - 10, i % 2));
          IgnisHud.flash = Math.max(IgnisHud.flash, 0.55);
          game.shake(26);
          Sfx.play('ignis_slam', { volume: 1, rateVar: 0 });
          game.castleHit(this);
          if (game.state === 'playing') game.castleHit(this);      // two
        }
        if (g.t >= 0.6) { g.fromDist = g.dist; this.igSet('retreat'); }
        break;
      case 'retreat': {
        g.anim = 'dashback';
        const k = Math.min(1, g.t / 0.5);
        g.dist = igLerp(g.fromDist, g.post, E.out(k));
        if (k >= 1) this.igSet('roar');
        break;
      }
      case 'collapse':
        g.anim = 'collapse';
        if (g.t >= 0.75) this.igSet('bones');
        break;
      case 'bones':
        g.anim = 'bones';
        if (g.clicks >= 2) {
          this.igSet('reform');
          Sfx.play('ignis_reform', { volume: 1, rateVar: 0 });
          game.effects.push(new IgnisSigil(f[0], f[1], true));
        }
        break;
      case 'reform': {
        g.anim = 'rise';
        // the bar grows to twice the length and fills as he stands
        const k = Math.min(1, g.t / 1.6);
        g.barMax = igLerp(IGNIS.P1, IGNIS.P2, E.out(k));
        g.barFill = E.inOut(k);
        if (g.t >= 1.0 && once('lit')) {
          g.phase = 2;
          this.maxHp = IGNIS.P2; this.hp = IGNIS.P2;
          game.effects.push(new Flare(this.x, this.y, { color: '#ff7a2d', r: 90, dur: 0.8, rays: 18, motes: 16, rings: 3 }));
          game.effects.push(new IgnisPillar(f[0], f[1], game));
          IgnisHud.flash = 1;
          game.shake(30);
          game.slowmo(0.35, 0.4);
          Sfx.play('fire_blast', { volume: 1, rate: 0.6 });
          Sfx.play('ignis_roar', { volume: 0.8, rate: 0.8 });
        }
        if (g.t >= 1.7) { g.barMax = IGNIS.P2; g.barFill = 1; this.igSet('roar'); }
        break;
      }
      case 'dying':
        g.anim = 'death';
        break;
    }

    // what can touch him right now
    // on his way in and while he calls the hearts, his own fire keeps you off
    const safe = { intro: 1, walk: 1, raise: 1, dashback: 1, collapse: 1, bones: 1, reform: 1, dying: 1 };
    const guarded = (g.state === 'summon' || g.state === 'guard' || g.state === 'thrust') && this.igHeartsAlive(game) > 0;
    this.untouchable = !!safe[g.state] || guarded;
    this.guardText = g.state === 'bones' ? 'click the bones' : guarded ? 'the hearts guard him'
      : g.state === 'walk' || g.state === 'raise' || g.state === 'dashback' ? 'his fire keeps you off' : '...';
    this.hpShown += (Math.max(0, this.hp / this.maxHp) - this.hpShown) * Math.min(1, dt * 6);
  },

  igExpose(game) {
    this.igSet('exposed');
    game.effects.push(new FloatText(this.x, this.y - 80, 'exposed!', '#e0562d', 24, true));
    Sfx.play('bones_fall', { volume: 0.5, rate: 1.3 });
  },

  /* Three hearts off the staff, flying out to circle the castle. */
  igHearts(game) {
    const top = (this.igA && this.igA.top) || [this.x, this.y - 80];
    const base = Math.random() * Math.PI * 2, spin = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const h = new Enemy('heart', 4, 0, top[0], top[1]);
      h.spawnT = 1;
      h.heart = { parent: this, ang: base + (i / 3) * Math.PI * 2, spin, fly: 0, from: [top[0], top[1]], life: 0, beat: Math.random() * 6 };
      game.spawnQueue.push(h);
    }
    game.effects.push(new Flare(top[0], top[1], { color: '#ff7a2d', r: 40, dur: 0.5, rays: 10, motes: 8, rings: 2 }));
  },

  /* The roar: rings of heat off his skull; when it is for real, the Chalk
     Ward shatters and your hands are knocked off the cursor for a second. */
  igRoar(game, forReal) {
    const head = (this.igA && this.igA.head) || [this.x, this.y - 40];
    game.effects.push(new IgnisRoarWave(head[0], head[1], game));
    if (this.ig.phase === 2) { const f = this.igFeet(); game.effects.push(new IgnisFireRing(f[0], f[1], BLOCK * 4)); }
    IgnisHud.flash = Math.max(IgnisHud.flash, this.ig.phase === 2 ? 0.45 : 0.25);
    Sfx.play('ignis_roar', { volume: 1, rateVar: 0.03 });
    game.shake(forReal ? 20 : 16);
    if (!forReal) return;
    if (game.shield > 0) {
      for (let i = 0; i < game.shield; i++) game.effects.push(new ShieldPop(game.castleRadius + 17 + i * 8));
      game.effects.push(new FloatText(0, -game.castleRadius - 30, 'ward shattered', '#8ec5e8', 22, true));
      Sfx.play('ward', { volume: 1, rate: 0.7 });
      game.shield = 0;
    }
    game.playerStun = 1;
    UI.syncHud(game);
  },

  /* Hit to zero: the first time he falls to bones, the second time he dies. */
  ignisDown(game) {
    const g = this.ig;
    if (g.preview) return true;
    if (g.state === 'collapse' || g.state === 'bones' || g.state === 'reform' || g.state === 'dying') return true;
    this.hp = 0;
    g.blockT = 0;
    Ignis.clearBrood(game, this);
    g.staffOut = false;                           // it goes down with him, and comes back up with him
    if (g.phase === 1) {
      this.igSet('collapse');
      g.clicks = 0;
      g.hop = 0;
      Sfx.play('bones_fall', { volume: 1, rateVar: 0 });
      game.shake(14);
      game.slowmo(0.4, 0.35);
      return true;
    }
    this.igSet('dying');
    g.hop = 0;
    game.cutscene = true;
    game.hold = null;
    game.effects.push(new IgnisDeath(this, game));
    Sfx.play('ignis_death', { volume: 1, rateVar: 0 });
    return true;
  },

  /* In the bestiary he just shows his repertoire, standing still. */
  igPreview(dt) {
    const g = this.ig;
    g.animT += dt; g.t += dt;
    const reel = ['idle', 'walk', 'raise', 'summon', 'guard', 'thrust', 'block', 'roar', 'exposed', 'collapse', 'bones', 'rise', 'slam'];
    const len = n => Math.max(1.2, IgnisSheet.length(n) * (IG_ANIMS[n].loop ? 3 : 1.4));
    if (g.animT >= len(g.anim)) { g.reel = ((g.reel || 0) + 1) % reel.length; g.anim = reel[g.reel]; g.animT = 0; }
    this.igPlace();
  },

  drawIgnis(ctx, t) {
    const g = this.ig;
    if (!g) return;
    const f = this.igFeet();
    const flip = f[0] > 1;
    if (g.state === 'dying' && g.t >= 3) return;          // in pieces: the cutscene draws him
    // empty-handed, the spin of the guard makes no sense: he stands
    const anim = g.blockT > 0 ? 'block' : g.staffOut && (g.anim === 'guard' || g.anim === 'summon') ? 'idle' : g.anim;
    const fi = IgnisSheet.frameAt(anim, g.animT);
    const P2 = g.phase === 2 && !g.preview, v = (P2 ? 1 : 0) | (g.staffOut ? 2 : 0);
    const S = IGNIS.SCALE;
    let fy = f[1] - (g.hop || 0);
    let fx = f[0];
    if (g.rattle > 0) { fx += Rough.jit(3); fy += Rough.jit(2); }
    if (g.state === 'dying') { fx += Rough.jit(2 + g.t); }

    // heat off him: a glow that breathes, and a pool of firelight at his feet
    if (g.state !== 'bones' && g.state !== 'intro' && !g.preview) {
      const pulse = 0.85 + Math.sin(t * (P2 ? 7 : 3.5)) * 0.15;
      igGlow(ctx, this.x, this.y, (P2 ? 110 : 80) * pulse, P2 ? '#ff3a12' : '#ff7a2d', P2 ? 0.3 : 0.18);
      ctx.save();
      ctx.translate(f[0], f[1]); ctx.scale(1, 0.32);
      igGlow(ctx, 0, 0, (P2 ? 130 : 80) * pulse, P2 ? '#ff4a1d' : '#ff7a2d', P2 ? 0.5 : 0.28);
      ctx.restore();
    }
    // pulling himself back together: fire spiralling into the bones
    if (g.state === 'reform' && g.t < 1.05) {
      Rough.boil(this.id + 3, Math.floor(t * 12));
      const k = g.t / 1.05;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + k * 5;
        const r = (1 - E.inOut(k)) * 170 + 12;
        const x = f[0] + Math.cos(a) * r, y = f[1] - 30 + Math.sin(a) * r * 0.6;
        const x2 = f[0] + Math.cos(a - 0.35) * (r + 26), y2 = f[1] - 30 + Math.sin(a - 0.35) * (r + 26) * 0.6;
        Rough.line(ctx, x2, y2, x, y, { color: i % 2 ? '#ffd24a' : '#ff7a2d', width: 3, jitter: 1, passes: 1, alpha: 0.4 + k * 0.6 });
        igGlow(ctx, x, y, 14, '#ff7a2d', 0.6);
      }
      igGlow(ctx, f[0], f[1] - 30, 30 + k * 90, '#ff4a1d', k);
    }
    // fire threads from the staff to every heart it holds up
    if (this.igA && (g.state === 'guard' || g.state === 'thrust' || g.state === 'summon')) {
      Rough.boil(this.id + 5, Math.floor(t * 10));
      for (const h of (Game.enemies || [])) {
        if (h.dead || h.kind !== 'heart' || !h.heart || h.heart.parent !== this) continue;
        const a = this.igA.top;
        const mx = (a[0] + h.x) / 2 + Rough.jit(12), my = (a[1] + h.y) / 2 + Rough.jit(12);
        Rough.poly(ctx, [a, [mx, my], [h.x, h.y]], { color: '#ff7a2d', width: 1.6, jitter: 1.5, closed: false, passes: 1, alpha: 0.4 });
      }
    }

    if (g.state === 'intro') {
      // climbing out: only what is above the ground shows
      if (g.rise <= 0) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(fx - 200, fy - 400, 400, 402); ctx.clip();
      this.igA = IgnisSheet.draw(ctx, anim, fi, fx, fy + (1 - g.rise) * 150 * S, flip, S, v);
      ctx.restore();
    } else {
      this.igA = IgnisSheet.draw(ctx, anim, fi, fx, fy, flip, S, v);
    }
    if (this.flash > 0) {                                  // struck: a flash of white heat
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      IgnisSheet.draw(ctx, anim, fi, fx, fy, flip, S, v);
      ctx.restore();
    }
    // in his second life the whole drawing glows through itself
    if (P2 && !Settings.data.low && g.state !== 'bones') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.08 + Math.sin(t * 9) * 0.04;
      IgnisSheet.draw(ctx, anim, fi, fx, fy, flip, S, v);
      ctx.restore();
    }
    // live fire over the baked frame: the eye and the staff's ember, and in
    // phase two, flames licking up off him
    if (this.igA && g.state !== 'bones') {
      const A = this.igA;
      const flick = 0.7 + Math.sin(t * 17 + this.id) * 0.2 + Math.random() * 0.1;
      {
        igGlow(ctx, A.eye[0], A.eye[1], (P2 ? 26 : 16) * flick, P2 ? '#ff4a1d' : '#ff7a2d', 0.9);
        igGlow(ctx, A.eye[0], A.eye[1], (P2 ? 10 : 6) * flick, '#fff1b0', 0.9);
        igGlow(ctx, A.top[0], A.top[1], (P2 ? 40 : 26) * flick * (anim === 'summon' ? 1.8 : 1), '#ffb347', 0.8);
        igGlow(ctx, A.chest[0], A.chest[1], (P2 ? 34 : 18) * flick, '#ff7a2d', P2 ? 0.8 : 0.45);
      }
      if (P2) {
        Rough.boil(this.id + 11, Math.floor(t * 12));
        igLiveFlame(ctx, A.head[0], A.head[1] - 10, 34, 12, t, 1);
        igLiveFlame(ctx, A.chest[0] - 6, A.chest[1] - 12, 13, 5, t, 2);
        igLiveFlame(ctx, A.hand[0], A.hand[1], 16, 6, t, 3);
        igLiveFlame(ctx, A.top[0], A.top[1] - 6, 26, 8, t, 4);
      }
    }
    // the shield: the staff spun into a wheel of fire
    if (g.blockT > 0 && this.igA) {
      const h = this.igA.hand, a = t * 22;
      Rough.boil(this.id + 9, Math.floor(t * 20));
      igGlow(ctx, h[0], h[1], 64, '#ffb347', 0.5);
      for (let i = 0; i < 3; i++) {
        Rough.arc(ctx, h[0], h[1], 50 + i * 6, a + i * 2, a + i * 2 + 2.2, { color: i ? '#ffd24a' : '#ff7a2d', width: 3 - i * 0.6, jitter: 1, passes: 1, alpha: 0.9 });
      }
      Rough.circle(ctx, this.x, this.y, IGNIS.BLOCK_BOX * 1.1, { color: '#ffd24a', width: 1.4, jitter: 2, wobble: 3, passes: 1, alpha: 0.25 + Math.sin(t * 12) * 0.1 });
    }
    // the pile: a hint that it wants clicking
    if (g.state === 'bones') {
      const k = 0.5 + Math.sin(t * 5) * 0.5;
      igGlow(ctx, f[0], f[1] - 16, 50, '#ff7a2d', 0.2 + k * 0.25);
      Rough.text(ctx, 'click! ' + g.clicks + '/2', f[0], f[1] - 62 - k * 4, 16, '#e0562d');
    }
  },

  /* ---------------------------------------------------------- hearts */
  heartUpdate(dt, game) {
    const h = this.heart;
    if (!h) return;
    h.beat += dt * (h.parent && h.parent.ig && h.parent.ig.phase === 2 ? 9 : 6);
    if (h.preview) return;
    const p = h.parent;
    if (!p || p.dead) { this.dead = true; return; }
    h.ang += dt * 0.75 * h.spin;
    const ox = Math.cos(h.ang) * IGNIS.HEART_R, oy = Math.sin(h.ang) * IGNIS.HEART_R;
    if (h.fly < 1) {
      h.fly = Math.min(1, h.fly + dt / 0.6);
      const e = E.out(h.fly);
      this.x = igLerp(h.from[0], ox, e);
      this.y = igLerp(h.from[1], oy, e) - Math.sin(h.fly * Math.PI) * 40;
      if (!Fx.low && Math.random() < dt * 30) game.effects.push(new Ember(this.x, this.y, 8));
      return;
    }
    this.x = ox; this.y = oy;
    if (Math.random() < dt * (Fx.low ? 2 : 7)) game.effects.push(new IgnisCinder(this.x, this.y, true));
    // in phase two they do not wait to be broken
    if (p.ig.phase === 2) {
      h.life += dt;
      if (h.life >= IGNIS.HEART_LIFE) { this.dead = true; Ignis.decompile(game, this); }
    }
  },

  drawHeart(ctx, t) {
    const h = this.heart || { beat: t * 6, life: 0 };
    const beat = 1 + Math.max(0, Math.sin(h.beat)) * 0.18;
    const r = this.r * beat * (this.hitT > 0 ? 1.15 : 1);
    const x = this.x + (this.flash > 0 ? Rough.jit(2) : 0), y = this.y;
    Rough.boil(this.id, Math.floor(t * 7));
    {
      igGlow(ctx, x, y, r * 4.2 * beat, '#ff2a1d', 0.5);
      igGlow(ctx, x, y, r * 1.8, '#ffb347', 0.45);
    }
    // a heart, the drawn kind but lumpier: two lobes and a point
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3);
      const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      pts.push([x + hx * r / 17, y + hy * r / 17]);
    }
    const fill = this.flash > 0 ? '#ffffff' : '#c8233a';
    Rough.scribble(ctx, pts, { color: fill, spacing: 2.2, width: 2.8, overflow: 1.08 });
    Rough.scribble(ctx, pts, { color: '#ff7a2d', spacing: 6, width: 2, overflow: 0.9, alpha: 0.5, angle: 0.9 });
    Rough.poly(ctx, pts, { color: '#2b1014', width: 2, jitter: 0.5 });
    Rough.poly(ctx, [[x - r * 0.1, y - r * 0.5], [x - r * 0.3, y - r * 0.1], [x - r * 0.1, y + r * 0.3]],
      { color: '#ffd24a', width: 1.4, jitter: 0.3, closed: false, passes: 1, alpha: 0.8 });
    // a flame on top, and in phase two a ring showing how long it has left
    Rough.poly(ctx, [[x - 3, y - r * 0.7], [x + Rough.jit(2), y - r * 1.4 - Math.random() * 4], [x + 3, y - r * 0.7]],
      { color: '#ff7a2d', width: 2, jitter: 0.5, closed: false, passes: 1 });
    if (h.parent && h.parent.ig && h.parent.ig.phase === 2 && h.fly >= 1) {
      const left = 1 - h.life / IGNIS.HEART_LIFE;
      Rough.arc(ctx, x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2, { color: '#ffd24a', width: 2, jitter: 0.4, passes: 1, alpha: 0.8 });
    }
  },

  /* ------------------------------------------------------------ orbs */
  orbUpdate(dt, game, d) {
    const o = this.orb;
    if (!o) return;
    o.t += dt;
    if (o.mode === 'back') {
      // a step back, gathering itself...
      const k = Math.max(0, Math.min(1, o.t / 0.6));
      const dd = Math.hypot(o.sx, o.sy) || 1;
      this.x = o.sx + (o.sx / dd) * BLOCK * E.out(k);
      this.y = o.sy + (o.sy / dd) * BLOCK * E.out(k);
      if (k >= 1) { o.mode = 'dash'; o.t = 0; Sfx.play('orb_dash', { volume: 0.55, throttle: 60 }); }
      return;
    }
    // ...then straight at the castle, faster than an Auger
    const step = IGNIS.ORB_SPEED * dt;
    this.x -= (this.x / d) * step;
    this.y -= (this.y / d) * step;
    o.trail.push([this.x, this.y]);
    if (o.trail.length > 8) o.trail.shift();
    if (Math.random() < dt * (Fx.low ? 10 : 40)) game.effects.push(new IgnisCinder(this.x, this.y, true));
    if (d <= game.castleRadius + this.r) {
      this.dead = true;
      game.effects.push(new Flare(this.x, this.y, { color: '#ff7a2d', r: 34, dur: 0.4, rays: 8, motes: 6, rings: 1 }));
      game.castleHit(this);
      if (game.state === 'playing') game.castleHit(this);      // two
    }
  },

  /* ------------------------------------------------- his thrown staff */
  spearUpdate(dt, game, d) {
    const s = this.spear;
    if (!s) return;
    s.t += dt;
    const step = s.speed * Math.min(1, 0.45 + s.t * 1.6) * dt;     // it leaves the hand fast and keeps coming
    this.x -= (this.x / d) * step;
    this.y -= (this.y / d) * step;
    s.ang = Math.atan2(-this.y, -this.x);
    const len = IgnisSheet.staff(s.v || 0).len;
    const tipX = this.x + Math.cos(s.ang) * len / 2, tipY = this.y + Math.sin(s.ang) * len / 2;
    s.trail.push([this.x - Math.cos(s.ang) * len / 2, this.y - Math.sin(s.ang) * len / 2]);
    if (s.trail.length > 10) s.trail.shift();
    if (Math.random() < dt * (Fx.low ? 8 : 26)) game.effects.push(new IgnisCinder(this.x + Rough.jit(20), this.y + Rough.jit(20), Math.random() < 0.5));
    if (Math.hypot(tipX, tipY) <= game.castleRadius) {
      this.dead = true;
      game.effects.push(new Flare(tipX, tipY, { color: '#ff7a2d', r: 44, dur: 0.5, rays: 12, motes: 10, rings: 2 }));
      game.effects.push(new IgnisFireRing(tipX, tipY, BLOCK * 1.4));
      game.shake(10);
      Sfx.play('ignis_slam', { volume: 0.7, rate: 1.4 });
      game.castleHit(this);
      game.effects.push(new IgnisStaffReturn(this, game));
    }
  },

  /* A click on it counts anywhere along its length. */
  hitDist(x, y) {
    if (this.kind !== 'ignisspear' || !this.spear) return Math.hypot(x - this.x, y - this.y);
    const a = this.spear.ang || Math.atan2(-this.y, -this.x), L = IgnisSheet.staff(this.spear.v || 0).len / 2;
    const c = Math.cos(a), sn = Math.sin(a);
    const u = Math.max(-L, Math.min(L, (x - this.x) * c + (y - this.y) * sn));
    return Math.hypot(x - (this.x + c * u), y - (this.y + sn * u));
  },

  drawSpear(ctx, t) {
    const s = this.spear || { t, trail: [], v: 0 };
    const st = IgnisSheet.staff(s.v || 0);
    const a = s.ang != null ? s.ang : Math.atan2(-this.y, -this.x);
    Rough.boil(this.id, Math.floor(t * 12));
    for (let i = 1; i < s.trail.length; i++) {
      const p = s.trail[i - 1], q = s.trail[i];
      Rough.line(ctx, p[0], p[1], q[0], q[1], { color: i % 2 ? '#ff7a2d' : '#ffd24a', width: 1 + i * 0.7, jitter: 1, passes: 1, alpha: i / s.trail.length * 0.8 });
    }
    igGlow(ctx, this.x, this.y, st.len * 0.45, '#ff5a1d', 0.5);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a - Math.PI / 2);                 // the staff's spear end (+y) leads
    ctx.rotate(Math.sin(s.t * 18) * 0.02);       // a shiver in flight
    ctx.drawImage(st.cv, -st.cx, -st.cy);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
      ctx.drawImage(st.cv, -st.cx, -st.cy);
    }
    ctx.restore();
    const tip = [this.x + Math.cos(a) * st.len / 2, this.y + Math.sin(a) * st.len / 2];
    igGlow(ctx, tip[0], tip[1], 22, '#fff1b0', 0.7);
    // how much is left of it: five notches along the shaft
    const left = Math.max(0, Math.ceil(this.hp)), nx = -Math.sin(a), ny = Math.cos(a);
    for (let i = 0; i < 5; i++) {
      const u = -st.len * 0.3 + i * st.len * 0.12;
      const px = this.x + Math.cos(a) * u + nx * 11, py = this.y + Math.sin(a) * u + ny * 11;
      ctx.fillStyle = i < left ? '#ffd24a' : 'rgba(43,16,20,0.35)';
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
  },

  drawOrb(ctx, t) {
    const o = this.orb || { mode: 'back', t: t, trail: [] };
    const x = this.x, y = this.y;
    Rough.boil(this.id, Math.floor(t * 12));
    for (let i = 1; i < o.trail.length; i++) {
      const a = o.trail[i - 1], b = o.trail[i];
      Rough.line(ctx, a[0], a[1], b[0], b[1], { color: i % 2 ? '#ff7a2d' : '#ffd24a', width: 2 + i * 0.9, jitter: 1, passes: 1, alpha: i / o.trail.length * 0.8 });
    }
    const gather = o.mode === 'back' ? 1 + Math.sin(o.t * 40) * 0.12 : 1;
    const r = this.r * gather;
    if (o.mode === 'back') {
      // where it is about to go: a line of fire drawn to the castle, filling in
      const d = Math.hypot(x, y) || 1, k = Math.min(1, o.t / 0.6);
      const ex = x - (x / d) * (d - 40) * k, ey = y - (y / d) * (d - 40) * k;
      Rough.line(ctx, x, y, ex, ey, { color: '#ff4a1d', width: 2 + k * 2, jitter: 1.2, passes: 1, alpha: 0.35 + k * 0.4 });
      for (let i = 0; i < 6; i++) {                     // sparks sucked into it
        const a = i / 6 * Math.PI * 2 + o.t * 8, rr = r * (3.2 - k * 2);
        Rough.line(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, x + Math.cos(a) * (rr - 7), y + Math.sin(a) * (rr - 7),
          { color: '#ffd24a', width: 2, jitter: 0.4, passes: 1, alpha: 0.9 });
      }
    }
    {
      igGlow(ctx, x, y, r * 5, '#ff3a12', 0.7);
      igGlow(ctx, x, y, r * 2, '#fff1b0', 0.6);
    }
    Rough.blob(ctx, x, y, r, this.flash > 0 ? '#ffffff' : '#ff7a2d', '#5a1a0a', { spacing: 2, fillWidth: 2.4, sides: 9, width: 1.8, wobble: 1.2 });
    Rough.blob(ctx, x, y, r * 0.45, '#fff1b0', null, { spacing: 1.6, fillWidth: 2, sides: 7, width: 0.1, wobble: 0.4 });
  }
});

/* ------------------------------------------------------------ effects */

/* Glow for his fight. Rough.bloom goes dark in low graphics; this is the
   same soft additive light but it stays on (one drawImage each), so the fight
   keeps its fire on a slow phone too. */
const IG_GLOW = {};
function igGlow(ctx, x, y, r, color, alpha) {
  if (!(r > 0.5)) return;
  const a = (alpha == null ? 0.5 : alpha) * (Rough.isLow() ? 0.45 : 0.55);
  if (a <= 0.004) return;
  let c = IG_GLOW[color];
  if (!c) {
    c = IG_GLOW[color] = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.45, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const op = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op; ctx.globalAlpha = pa;
}

/* A tongue of fire drawn live at 12 fps: outer red, orange, a white-hot core,
   with a glow behind it. */
function igLiveFlame(ctx, x, y, h, w, t, seed) {
  const f = Math.floor(t * 12);
  const sway = Math.sin(f * 0.9 + seed * 2) * w * 0.5;
  const hh = h * (0.8 + ((f * 7 + seed * 13) % 5) * 0.08);
  const layer = (k, color, alpha) => {
    const H = hh * k, W = w * k;
    const pts = [[x - W, y], [x - W * 0.55, y - H * 0.45], [x + sway * k, y - H], [x + W * 0.5, y - H * 0.5], [x + W, y]];
    Rough.scribble(ctx, pts, { color, spacing: 2.2, width: 2.4, overflow: 1.05, alpha });
    return pts;
  };
  igGlow(ctx, x, y - hh * 0.4, hh * 0.9, '#ff5a1d', 0.55);
  const outer = layer(1, '#e0402a', 0.9);
  layer(0.72, '#ff9a2d', 0.95);
  layer(0.42, '#fff1b0', 0.95);
  Rough.poly(ctx, outer, { color: '#7a1a0a', width: 1.3, jitter: 0.5, closed: false, passes: 1, alpha: 0.8 });
}

/* A cinder: a glowing flake that rises, swirls and burns out. */
class IgnisCinder {
  constructor(x, y, hot) {
    this.x = x; this.y = y; this.hot = hot;
    this.vx = Rough.jit(40); this.vy = -40 - Math.random() * 80;
    this.life = 0.8 + Math.random() * 1.1; this.max = this.life;
    this.ph = Math.random() * 6; this.s = 1.5 + Math.random() * 2.5;
  }
  update(dt) {
    this.life -= dt;
    this.x += (this.vx + Math.sin(this.ph + this.life * 5) * 30) * dt; this.y += this.vy * dt; this.vy *= 1 - dt * 0.4;
    return this.life > 0;
  }
  draw(ctx) {
    const p = this.life / this.max;
    if (!Fx.low) igGlow(ctx, this.x, this.y, this.s * 5, this.hot ? '#ff4a1d' : '#ff9a2d', p * 0.8);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p * 1.4);
    ctx.fillStyle = p > 0.5 ? '#fff1b0' : this.hot ? '#ff5a1d' : '#ffb347';
    ctx.translate(this.x, this.y); ctx.rotate(this.ph + this.life * 4);
    ctx.fillRect(-this.s / 2, -this.s / 2, this.s, this.s * 0.6);
    ctx.restore();
  }
}

/* Burnt ground where he has stood in his second life: a black scorch with
   embers dying in it, and for a moment, a little fire. */
class IgnisScorch {
  constructor(x, y, r) {
    this.id = nextId(); this.x = x + Rough.jit(8); this.y = y + Rough.jit(4); this.r = r || 16;
    this.under = true; this.t = 0; this.dur = 3.2;
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const k = this.t / this.dur, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = 0.5 * a;
    ctx.fillStyle = '#1a0c08';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r, this.r * 0.38, 0, 0, 7); ctx.fill();
    ctx.restore();
    const heat = Math.max(0, 1 - this.t / 1.4);
    if (heat > 0) {
      igGlow(ctx, this.x, this.y, this.r * 2.2, '#ff4a1d', heat * 0.7);
      Rough.boil(this.id, Math.floor(time * 12));
      if (this.t < 0.9) igLiveFlame(ctx, this.x, this.y + 2, this.r * 1.3 * heat, this.r * 0.4, time, this.id % 7);
    }
  }
}

/* His staff, broken or landed: it flies apart into pieces, then he calls
   them, and they dash back to his hand end over end, trailing fire, and
   click together into the staff he is holding. */
class IgnisStaffReturn {
  constructor(spear, game) {
    this.id = nextId(); this.game = game;
    const s = spear.spear || {};
    this.owner = s.owner || Ignis.alive(game);
    this.v = s.v || 0;
    const st = IgnisSheet.staff(this.v), a = s.ang != null ? s.ang : Math.atan2(-spear.y, -spear.x);
    this.st = st; this.t = 0; this.n = 6; this.done = false;
    this.pieces = [];
    for (let i = 0; i < this.n; i++) {
      const u = (i + 0.5) / this.n;                    // along the staff: 0 the ember end, 1 the spear
      const ly = -st.len / 2 + u * st.len;
      const out = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 120;
      this.pieces.push({
        i, u, x: spear.x + Math.cos(a) * ly, y: spear.y + Math.sin(a) * ly, a: a - Math.PI / 2,
        vx: Math.cos(out) * sp, vy: Math.sin(out) * sp - 40, va: Rough.jit(12), trail: []
      });
    }
    this.callAt = 0.45;                              // how long they hang apart before he calls them
    this.dur = 1.35;
    game.effects.push(new Flare(spear.x, spear.y, { color: '#ff7a2d', r: 40, dur: 0.4, rays: 10, motes: 10, rings: 1 }));
    Sfx.play('bones_fall', { volume: 0.55, rate: 1.4 });
  }
  /* where each piece belongs in his hand right now */
  home(p) {
    const e = this.owner, A = e && e.igA;
    if (!A) return null;
    const top = A.top, tip = A.tip;
    return { x: top[0] + (tip[0] - top[0]) * p.u, y: top[1] + (tip[1] - top[1]) * p.u, a: Math.atan2(tip[1] - top[1], tip[0] - top[0]) - Math.PI / 2 };
  }
  update(dt, game) {
    this.t += dt;
    const e = this.owner;
    const gone = !e || e.dead || !e.ig || !e.ig.staffOut;         // he fell (and it with him)
    for (const p of this.pieces) {
      if (this.t < this.callAt || gone) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; p.a += p.va * dt;
        continue;
      }
      // called home: a beat of pulling back, then a dash
      if (!p.from) {
        p.from = [p.x, p.y, p.a];
        p.go = this.callAt + p.i * 0.04;
        if (p.i === 0) Sfx.play('orb_dash', { volume: 0.7, rate: 0.8 });
      }
      const k = Math.max(0, Math.min(1, (this.t - p.go) / 0.5));
      const h = this.home(p);
      if (!h) continue;
      const ek = k * k * k;                                        // slow, then all at once
      let da = h.a - p.from[2];
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      p.x = p.from[0] + (h.x - p.from[0]) * ek + Math.sin(k * Math.PI) * 30 * (p.i % 2 ? 1 : -1);
      p.y = p.from[1] + (h.y - p.from[1]) * ek;
      p.a = p.from[2] + da * ek + (1 - ek) * this.t * 6;
      p.trail.push([p.x, p.y]); if (p.trail.length > 7) p.trail.shift();
      p.home = k >= 1;
    }
    if (!gone && !this.done && this.t > this.callAt && this.pieces.every(p => p.home)) {
      this.done = true;
      e.ig.staffOut = false;
      const A = e.igA;
      if (A) {
        game.effects.push(new Flare(A.hand[0], A.hand[1], { color: '#ffb347', r: 50, dur: 0.45, rays: 12, motes: 10, rings: 2 }));
        for (let i = 0; i < Fx.n(10); i++) game.effects.push(new IgnisCinder(A.hand[0] + Rough.jit(20), A.hand[1] + Rough.jit(40), true));
      }
      Sfx.play('ignis_reform', { volume: 0.5, rate: 1.8 });
      return false;
    }
    if (gone && this.t > this.callAt + 0.6) return false;
    return this.t < 4;
  }
  draw(ctx, time) {
    const st = this.st, seg = st.len / this.n;
    const fade = (!this.owner || !this.owner.ig || !this.owner.ig.staffOut) && this.t > this.callAt ? Math.max(0, 1 - (this.t - this.callAt) / 0.6) : 1;
    Rough.boil(this.id, Math.floor(time * 12));
    for (const p of this.pieces) {
      for (let i = 1; i < p.trail.length; i++) {
        const q0 = p.trail[i - 1], q1 = p.trail[i];
        Rough.line(ctx, q0[0], q0[1], q1[0], q1[1], { color: i % 2 ? '#ff7a2d' : '#ffd24a', width: 1 + i * 0.6, jitter: 0.8, passes: 1, alpha: i / p.trail.length * 0.8 * fade });
      }
      igGlow(ctx, p.x, p.y, 22, '#ff5a1d', 0.6 * fade);
      // its own stretch of the staff sprite
      const y0 = st.cy - st.len / 2 + p.i * seg - (p.i === 0 ? st.top - st.len / 2 : 0);
      const y1 = st.cy - st.len / 2 + (p.i + 1) * seg + (p.i === this.n - 1 ? st.bot - st.len / 2 : 0);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      const cyLocal = st.cy - st.len / 2 + (p.i + 0.5) * seg;
      ctx.drawImage(st.cv, 0, y0, st.cv.width, y1 - y0, -st.cx, y0 - cyLocal, st.cv.width, y1 - y0);
      ctx.restore();
    }
  }
}

/* What a heart broken by hand sometimes leaves: a little green cross of
   life. Nobody has to click it - it hangs a beat, then goes home to the
   castle on its own and mends half a segment. */
class IgnisHeal {
  constructor(x, y) {
    this.id = nextId(); this.x = x; this.y = y; this.t = 0; this.trail = [];
    this.vx = Rough.jit(60); this.vy = -90;
    this.done = false;
    Sfx.play('skill_ready', { volume: 0.5, rate: 1.6 });
  }
  update(dt, game) {
    this.t += dt;
    if (this.t < 0.45) {                                  // popped out, hanging
      this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 1 - dt * 4; this.vy *= 1 - dt * 4;
    } else {                                              // then home, faster and faster
      const d = Math.hypot(this.x, this.y) || 1, sp = 120 + (this.t - 0.45) * 900;
      this.x -= this.x / d * Math.min(d, sp * dt); this.y -= this.y / d * Math.min(d, sp * dt);
      this.trail.push([this.x, this.y]); if (this.trail.length > 9) this.trail.shift();
      if (d <= game.castleRadius * 0.6) {
        game.castleHp = Math.min(game.maxHp, game.castleHp + IGNIS.HEAL);
        game.effects.push(new FloatText(0, -game.castleRadius - 30, '+' + IGNIS.HEAL + ' hp', '#3fae5a', 22, true));
        game.effects.push(new Flare(0, 0, { color: '#6fe08a', core: '#eaffef', r: game.castleRadius * 1.3, dur: 0.6, rays: 12, motes: 10, rings: 2 }));
        Sfx.play('ward', { volume: 0.8, rate: 1.4 });
        UI.syncHud(game);
        return false;
      }
    }
    return this.t < 6;
  }
  light() { return [this.x, this.y, 110, 0.9, '#6fe08a']; }
  draw(ctx, time) {
    Rough.boil(this.id, Math.floor(time * 12));
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i - 1], q = this.trail[i];
      Rough.line(ctx, p[0], p[1], q[0], q[1], { color: i % 2 ? '#6fe08a' : '#eaffef', width: 1 + i * 0.8, jitter: 0.8, passes: 1, alpha: i / this.trail.length });
    }
    const pulse = 1 + Math.sin(this.t * 12) * 0.12, s = 9 * pulse;
    igGlow(ctx, this.x, this.y, 40 * pulse, '#4fd06a', 0.9);
    igGlow(ctx, this.x, this.y, 16, '#eaffef', 0.8);
    const plus = [[-s * 0.35, -s], [s * 0.35, -s], [s * 0.35, -s * 0.35], [s, -s * 0.35], [s, s * 0.35], [s * 0.35, s * 0.35],
      [s * 0.35, s], [-s * 0.35, s], [-s * 0.35, s * 0.35], [-s, s * 0.35], [-s, -s * 0.35], [-s * 0.35, -s * 0.35]]
      .map(p => [this.x + p[0], this.y + p[1]]);
    Rough.scribble(ctx, plus, { color: '#3fae5a', spacing: 2.2, width: 2.6, overflow: 1.05 });
    Rough.scribble(ctx, plus, { color: '#b8f5c6', spacing: 5, width: 1.6, overflow: 0.8, alpha: 0.8, angle: 0.9 });
    Rough.poly(ctx, plus, { color: '#1c5a2c', width: 1.8, jitter: 0.4 });
  }
}

/* A ring of fire rolling out across the ground from where he stands. */
class IgnisFireRing {
  constructor(x, y, R) {
    this.id = nextId(); this.x = x; this.y = y; this.R = R || BLOCK * 3.5; this.t = 0; this.dur = 0.9; this.under = true;
    this.n = Fx.low ? 10 : 18;
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const k = this.t / this.dur, r = 16 + E.out(k) * this.R, a = 1 - k;
    Rough.boil(this.id, Math.floor(time * 12));
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(1, 0.42);
    igGlow(ctx, 0, 0, r * 1.2, '#ff4a1d', a * 0.6);
    Rough.circle(ctx, 0, 0, r, { color: '#ff7a2d', width: 7 * a + 1, jitter: 1.5, wobble: 4, passes: 1, alpha: a });
    Rough.circle(ctx, 0, 0, r * 0.93, { color: '#fff1b0', width: 2, jitter: 1.5, wobble: 4, passes: 1, alpha: a * 0.8 });
    ctx.restore();
    for (let i = 0; i < this.n; i++) {
      const ang = i / this.n * Math.PI * 2;
      igLiveFlame(ctx, this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r * 0.42, 22 * a, 6 * a + 1, time, i);
    }
  }
}

/* His second life starting: a pillar of fire straight up out of the bones. */
class IgnisPillar {
  constructor(x, y, game) {
    this.id = nextId(); this.x = x; this.y = y; this.t = 0; this.dur = 1.5;
    this.H = Math.max(260, game.h * 0.7);
    game.effects.push(new IgnisFireRing(x, y, BLOCK * 5));
    for (let i = 0; i < Fx.n(40); i++) game.effects.push(new IgnisCinder(x + Rough.jit(40), y - Math.random() * 200, i % 2));
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx, time) {
    const k = this.t / this.dur;
    const grow = E.out(Math.min(1, this.t / 0.25)), fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    const W = 46 * (1 - k * 0.5), H = this.H * grow;
    Rough.boil(this.id, Math.floor(time * 12));
    {
      igGlow(ctx, this.x, this.y - H * 0.5, H * 0.6, '#ff3a12', fade * 0.8);
      igGlow(ctx, this.x, this.y - H * 0.3, H * 0.3, '#fff1b0', fade * 0.6);
    }
    for (const [kw, col, al] of [[1, '#e0402a', 0.85], [0.66, '#ff9a2d', 0.9], [0.3, '#fff1b0', 1]]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push([this.x - W * kw * (1 - u * 0.4) + Math.sin(time * 14 + u * 9) * 6, this.y - H * u]);
      }
      for (let i = 8; i >= 0; i--) {
        const u = i / 8;
        pts.push([this.x + W * kw * (1 - u * 0.4) + Math.sin(time * 12 + u * 7 + 2) * 6, this.y - H * u]);
      }
      Rough.scribble(ctx, pts, { color: col, spacing: 3, width: 3.4, overflow: 1.05, alpha: al * fade, angle: 1.4 });
    }
  }
}

/* Where he comes up: the ground splits, glowing, and stays scarred. */
class IgnisRift {
  constructor(x, y) {
    this.id = nextId(); this.x = x; this.y = y; this.under = true;
    this.t = 0; this.dur = 9;
    this.cracks = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      const pts = [[0, 0]];
      let px = 0, py = 0;
      for (let k = 0; k < 4; k++) { const aa = a + Rough.jit(0.5); px += Math.cos(aa) * 14; py += Math.sin(aa) * 6; pts.push([px, py]); }
      this.cracks.push(pts);
    }
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const grow = E.out(Math.min(1, this.t / 0.9));
    const heat = Math.max(0, 1 - Math.max(0, this.t - 3) / 3);
    const a = this.t > this.dur - 2 ? (this.dur - this.t) / 2 : 1;
    Rough.boil(this.id, Math.floor(this.t * 5));
    ctx.save();
    ctx.globalAlpha = 0.75 * a;
    ctx.fillStyle = '#1a0c08';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 30 * grow, 9 * grow, 0, 0, 7); ctx.fill();
    ctx.restore();
    if (heat > 0) igGlow(ctx, this.x, this.y - 6, 60 * grow, '#ff4a2d', 0.7 * heat);
    for (const c of this.cracks) {
      const n = Math.max(2, Math.ceil(c.length * grow));
      const pts = c.slice(0, n).map(q => [this.x + q[0] * 1.6, this.y + q[1] * 1.6]);
      Rough.poly(ctx, pts, { color: '#1a0c08', width: 3, jitter: 0.5, closed: false, passes: 1, alpha: 0.8 * a });
      if (heat > 0) Rough.poly(ctx, pts, { color: '#ff7a2d', width: 1.4, jitter: 0.4, closed: false, passes: 1, alpha: heat });
    }
  }
}

/* A ring of fire runes under his feet while he calls the hearts - or pulls
   himself back together. */
class IgnisSigil {
  constructor(x, y, big) { this.id = nextId(); this.x = x; this.y = y; this.under = true; this.t = 0; this.dur = big ? 1.8 : 1.4; this.big = big; }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const k = this.t / this.dur, a = Math.sin(k * Math.PI);
    const R = (this.big ? 58 : 44) * (0.6 + E.out(Math.min(1, k * 2)) * 0.4);
    Rough.boil(this.id, Math.floor(this.t * 7));
    igGlow(ctx, this.x, this.y, R * 1.6, '#ff7a2d', 0.5 * a);
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(1, 0.4);
    Rough.circle(ctx, 0, 0, R, { color: '#ff7a2d', width: 2.6, jitter: 0.8, wobble: 1, passes: 1, alpha: a });
    Rough.circle(ctx, 0, 0, R * 0.72, { color: '#ffd24a', width: 1.6, jitter: 0.8, wobble: 1, passes: 1, alpha: a * 0.8 });
    for (let i = 0; i < 6; i++) {                            // the runes: little crossed strokes, turning
      const ang = i / 6 * Math.PI * 2 + this.t * 1.5;
      const rx = Math.cos(ang) * R * 0.86, ry = Math.sin(ang) * R * 0.86;
      Rough.line(ctx, rx - 4, ry - 4, rx + 4, ry + 4, { color: '#ff7a2d', width: 2, jitter: 0.3, passes: 1, alpha: a });
      Rough.line(ctx, rx + 4, ry - 4, rx - 4, ry + 4, { color: '#ff7a2d', width: 2, jitter: 0.3, passes: 1, alpha: a });
    }
    ctx.restore();
  }
}

/* The spear end of the staff, reaching all the way to the castle wall. */
class IgnisThrust {
  constructor(x, y, game) {
    this.id = nextId(); this.x = x; this.y = y; this.t = 0; this.dur = 0.5;
    const d = Math.hypot(x, y) || 1;
    this.tx = x / d * game.castleRadius * 0.95; this.ty = y / d * game.castleRadius * 0.95;
    game.effects.push(new Flare(this.tx, this.ty, { color: '#ff7a2d', r: 34, dur: 0.45, rays: 10, motes: 8, rings: 2 }));
    game.shake(10);
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const out = this.t < 0.1 ? E.out(this.t / 0.1) : this.t < 0.22 ? 1 : 1 - E.inOut((this.t - 0.22) / 0.28);
    if (out <= 0) return;
    const ex = igLerp(this.x, this.tx, out), ey = igLerp(this.y, this.ty, out);
    const a = Math.atan2(ey - this.y, ex - this.x);
    Rough.boil(this.id, Math.floor(this.t * 20));
    igGlow(ctx, ex, ey, 30, '#ff7a2d', 0.8);
    // a shaft of bone and fire, with the blade on the end of it
    Rough.line(ctx, this.x, this.y, ex, ey, { color: '#2b2b2b', width: 6.5, jitter: 1, passes: 1 });
    Rough.line(ctx, this.x, this.y, ex, ey, { color: '#4a3528', width: 3.4, jitter: 0.8, passes: 1 });
    Rough.line(ctx, this.x, this.y, ex, ey, { color: '#ff7a2d', width: 1.4, jitter: 2, passes: 1, alpha: 0.9 });
    const L = Math.hypot(ex - this.x, ey - this.y);
    for (let s = 30; s < L - 16; s += 34) {
      const bx = this.x + Math.cos(a) * s, by = this.y + Math.sin(a) * s;
      Rough.line(ctx, bx - Math.sin(a) * 5, by + Math.cos(a) * 5, bx + Math.sin(a) * 5, by - Math.cos(a) * 5, { color: '#ece3c9', width: 3, jitter: 0.3, passes: 1 });
    }
    const c = Math.cos(a), s = Math.sin(a);
    const blade = [[ex - c * 16 - s * 6, ey - s * 16 + c * 6], [ex + c * 6, ey + s * 6], [ex - c * 16 + s * 6, ey - s * 16 - c * 6]];
    Rough.scribble(ctx, blade, { color: '#6b7280', spacing: 2, width: 2.2, overflow: 1.1 });
    Rough.poly(ctx, blade, { color: '#2b2b2b', width: 1.8, jitter: 0.3 });
  }
}

/* The roar: heat rings off his skull, the air bent into lines toward him. */
class IgnisRoarWave {
  constructor(x, y, game) { this.id = nextId(); this.x = x; this.y = y; this.t = 0; this.dur = 1.0; this.game = game; }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const k = this.t / this.dur;
    Rough.boil(this.id, Math.floor(this.t * 12));
    igGlow(ctx, this.x, this.y, 60 + k * 200, '#ff7a2d', (1 - k) * 0.5);
    for (let i = 0; i < 3; i++) {
      const q = E.out(Math.min(1, Math.max(0, (k - i * 0.12) / 0.8)));
      if (q <= 0 || q >= 1) continue;
      Rough.circle(ctx, this.x, this.y, 20 + q * 420, { color: i ? '#ffd24a' : '#ff7a2d', width: 5 * (1 - q) + 1, jitter: 2, wobble: 8, passes: 1, alpha: (1 - q) * 0.8 });
    }
    if (Fx.low || k > 0.6) return;
    const w = this.game.w, h = this.game.h, out = Math.hypot(w, h) * 0.6;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + Rough.jit(0.1);
      const inner = 70 + k * 120 + Math.abs(Rough.jit(40));
      Rough.line(ctx, this.x + Math.cos(ang) * inner, this.y + Math.sin(ang) * inner, this.x + Math.cos(ang) * out, this.y + Math.sin(ang) * out,
        { color: '#2b2b2b', width: 1.6, jitter: 1, passes: 1, alpha: (1 - k / 0.6) * 0.4 });
    }
  }
}

/* A heart coming undone: its pieces spiral into a bright point. */
class IgnisUnravel {
  constructor(x, y, crumble) {
    this.id = nextId(); this.x = x; this.y = y; this.t = 0; this.dur = crumble ? 0.5 : 0.3; this.crumble = crumble;
    this.bits = [];
    for (let i = 0; i < 8; i++) this.bits.push({ a: i / 8 * Math.PI * 2 + Math.random() * 0.4, r: 14 + Math.random() * 10 });
  }
  update(dt) { this.t += dt; return this.t < this.dur; }
  draw(ctx) {
    const k = this.t / this.dur;
    Rough.boil(this.id, 0);
    for (const b of this.bits) {
      const r = this.crumble ? b.r * (0.6 + k * 1.4) : b.r * (1 - k);
      const a = b.a + (this.crumble ? 0 : k * 3);
      const px = this.x + Math.cos(a) * r, py = this.y + Math.sin(a) * r + (this.crumble ? k * k * 30 : 0);
      Rough.line(ctx, px, py, px + Math.cos(a + 1.5) * 5, py + Math.sin(a + 1.5) * 5, { color: this.crumble ? '#6b4a3a' : '#ff7a2d', width: 2.2, jitter: 0.3, passes: 1, alpha: 1 - k * 0.6 });
    }
    if (!this.crumble && !Fx.low) igGlow(ctx, this.x, this.y, 20 + k * 20, '#ffd24a', 1 - k);
  }
}

/* ---------------------------------------------------- the death scene */
/* Ten seconds. He staggers, speaks, cracks with fire, breaks apart - and
   every bone of him lifts off the page and rises into the sky, fading as
   it goes. Then it is over (for now). */
class IgnisDeath {
  constructor(e, game) {
    this.e = e; this.game = game; this.t = 0; this.dur = 10;
    this.id = nextId();
    this.broke = false;
    this.pieces = null;
  }
  update(dt, game) {
    this.t += dt;
    const e = this.e, g = e.ig;
    g.t = this.t;
    // what he says, typed out under the middle of the page
    let line = null;
    for (const l of IGNIS_LINES) if (this.t >= l.at) line = l;
    g.dialog = line ? { text: line.text, shown: Math.min(line.text.length, Math.floor((this.t - line.at) * 34)), fade: this.t > 9.4 ? (10 - this.t) / 0.6 : 1 } : null;
    if (this.t < 3 && Math.random() < dt * 20) game.effects.push(new Ember(e.x + Rough.jit(20), e.y + Rough.jit(30), 14));
    if (!this.broke && this.t >= 3) {
      this.broke = true;
      const f = e.igFeet(), flip = f[0] > 1, S = IGNIS.SCALE;
      this.pieces = IgnisSheet.pieces('death', 0, 1).map((p, i) => ({
        cv: p.cv, R: p.R, type: p.type,
        x: f[0] + (flip ? -p.x : p.x) * S, y: f[1] + p.y * S, a: flip ? -p.a : p.a,
        vx: Rough.jit(90), vy: -40 - Math.random() * 60, va: Rough.jit(3),
        lift: 0.6 + Math.random() * 0.8, sway: Math.random() * 6, flip
      }));
      game.effects.push(new Flare(e.x, e.y, { color: '#ff7a2d', r: 110, dur: 0.9, rays: 20, motes: 20, rings: 3 }));
      game.shake(22);
      Sfx.play('bones_fall', { volume: 1, rate: 0.8 });
      for (let i = 0; i < Fx.n(18); i++) game.effects.push(new Crumb(e.x + Rough.jit(30), e.y + Rough.jit(40), i % 2 ? '#ece3c9' : '#ff7a2d'));
    }
    if (this.pieces) {
      const rising = this.t >= 4.5;
      for (const p of this.pieces) {
        if (!rising) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.vx *= 1 - dt * 2; p.a += p.va * dt; }
        else {
          const k = this.t - 4.5;
          p.x += Math.sin(this.t * 1.3 + p.sway) * 18 * dt;
          p.y -= (30 + k * k * 40 * p.lift) * dt;
          p.a += p.va * 0.3 * dt;
          if (!Fx.low && Math.random() < dt * 6) game.effects.push(new Ember(p.x, p.y, 8));
        }
      }
    }
    if (this.t >= this.dur) {
      g.dialog = null;
      e.dead = true;
      game.cutscene = false;
      game.onEnemyKilled(e);
      return false;
    }
    return true;
  }
  draw(ctx) {
    if (!this.pieces) return;
    // the fade: gentle at first, then gone - a smootherstep from 4.5s to 9.8s
    const k = Math.max(0, Math.min(1, (this.t - 4.5) / 5.3));
    const fade = 1 - k * k * k * (k * (k * 6 - 15) + 10);
    if (fade <= 0.001) return;
    for (const p of this.pieces) {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      if (p.flip) ctx.scale(-1, 1);
      ctx.scale(IGNIS.SCALE, IGNIS.SCALE);
      ctx.drawImage(p.cv, -p.R, -p.R);
      ctx.restore();
      igGlow(ctx, p.x, p.y, 16, '#ff7a2d', 0.35 * fade);
    }
  }
}

/* ------------------------------------------------------------- HUD */
/* His bar across the top, the letterbox for his entrance and his death, the
   title card, and what he says. Drawn in screen space over the page. */
const IgnisHud = {
  lb: 0,
  shown: 0, trail: 0,
  flash: 0, heat: 0, ash: [], last: 0,

  /* The whole page while he is on it: the edges glow like the paper is
     starting to catch, and ash and cinders drift up across it. Hotter, and
     red, in his second life. */
  atmosphere(ctx, game, e) {
    const w = game.w, h = game.h;
    const dt = Math.min(0.05, Math.max(0, game.time - this.last)); this.last = game.time;
    const P2 = e && e.ig.phase === 2;
    const want = !e ? 0 : e.ig.state === 'dying' ? Math.max(0, 1 - e.ig.t / 8) : P2 ? 1 : 0.72;
    this.heat += (want - this.heat) * Math.min(1, dt * 2);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.heat < 0.01 && this.flash <= 0) { this.ash.length = 0; return; }
    const pulse = 0.85 + Math.sin(game.time * (P2 ? 5 : 2.5)) * 0.15;
    this.lighting(ctx, game, e, P2);
    Rough.vignette(ctx, w, h, this.heat * 0.35 * pulse, P2 ? 'rgba(90,10,0,0.95)' : 'rgba(40,16,20,0.9)');
    // ash and cinders, in screen space so they drift over everything
    const n = Math.round((Fx.low ? 18 : (P2 ? 70 : 38) * (Settings.gfx === 'high' ? 1 : 0.7)) * this.heat);
    while (this.ash.length < n) this.ash.push(this.flake(w, h, this.ash.length > 0));
    if (this.ash.length > n) this.ash.length = n;
    for (const a of this.ash) {
      a.y -= a.vy * dt; a.x += (a.vx + Math.sin(game.time * a.f + a.ph) * 20) * dt; a.life -= dt;
      if (a.y < -10 || a.life <= 0) Object.assign(a, this.flake(w, h, true));
      const al = Math.min(1, a.life) * this.heat;
      if (a.hot) {
        if (!Fx.low) igGlow(ctx, a.x, a.y, a.s * 4, P2 ? '#ff3a12' : '#ff7a2d', al * 0.7);
        ctx.fillStyle = '#ffd24a';
      } else ctx.fillStyle = '#5a4a44';
      ctx.globalAlpha = al * (a.hot ? 1 : 0.5);
      ctx.fillRect(a.x, a.y, a.s, a.s * 0.7);
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash * 0.45;
      ctx.fillStyle = '#ff6a2a';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
  /* Night falls on the page while he is on it, and his fire is what lights
     it: a dark layer with holes burnt in it wherever something is burning,
     then those lights glowing over the top. The castle and your cursor keep
     a little light of their own, so you can always see what you are doing. */
  lighting(ctx, game, e, P2) {
    const w = game.w, h = game.h, q = Settings.data.low ? 0.25 : Settings.gfx === 'high' ? 0.5 : 0.35;
    const A = Depth.off(Depth.ACTORS);
    const ox = w / 2 + game.shakeX + A.x, oy = h / 2 + game.shakeY + A.y;
    const t = game.time, flick = 0.9 + Math.sin(t * 13) * 0.05 + Math.sin(t * 29) * 0.05;
    const L = [];                                  // x, y (screen), radius, strength, glow colour
    const add = (x, y, r, i, c, core) => { if (r > 4 && i > 0.02) L.push([ox + x, oy + y, r, Math.min(1, i), c, core]); };
    add(0, 0, game.castleRadius * 2.4, 0.55, null);
    if (game.pointer.inside) L.push([game.pointer.x, game.pointer.y, 120, 0.75, null]);
    if (e && e.ig.state !== 'bones') {
      const A2 = e.igA, dying = e.ig.state === 'dying' ? Math.max(0, 1 - e.ig.t / 9) : 1;
      add(e.x, e.y, (P2 ? 300 : 230) * flick, 0.95 * dying, P2 ? '#ff3a12' : '#ff7a2d', false);
      if (A2) { add(A2.top[0], A2.top[1], 110 * flick, 0.9 * dying, '#ffb347'); add(A2.eye[0], A2.eye[1], 70, 0.8 * dying, '#ff4a1d'); }
    }
    for (const x of game.enemies) {
      if (x.dead) continue;
      if (x.kind === 'heart') add(x.x, x.y, 95 * flick, 0.85, '#ff2a1d');
      else if (x.kind === 'ignisorb') add(x.x, x.y, 115 * flick, 0.95, '#ff5a1d');
      else if (x.kind === 'ignisspear') add(x.x, x.y, 110 * flick, 0.9, '#ff7a2d');
    }
    for (const f of game.effects) {
      if (f instanceof IgnisPillar) { const k = f.t / f.dur; add(f.x, f.y - f.H * 0.35, f.H * 0.9, 1 - k * k, '#ff3a12'); }
      else if (f instanceof IgnisFireRing) { const k = f.t / f.dur; add(f.x, f.y, 60 + f.R * E.out(k) * 1.2, (1 - k) * 0.9, '#ff5a1d'); }
      else if (f instanceof IgnisScorch && f.t < 1.4) add(f.x, f.y, f.r * 4, (1 - f.t / 1.4) * 0.7, '#ff4a1d');
      else if (f instanceof IgnisThrust) add(f.tx, f.ty, 150, 1 - f.t / f.dur, '#ff7a2d');
      else if (f instanceof Flare && f.color === '#ff7a2d') add(f.x, f.y, f.r * 3, 0.7, '#ff7a2d');
      else if (f instanceof IgnisRoarWave) add(f.x, f.y, 120 + f.t * 300, (1 - f.t / f.dur) * 0.8, '#ff7a2d');
      else if (f instanceof IgnisSigil) add(f.x, f.y, 130, Math.sin(f.t / f.dur * Math.PI) * 0.8, '#ff7a2d');
      else if (f instanceof IgnisRift) add(f.x, f.y, 160, Math.max(0, 1 - Math.max(0, f.t - 3) / 3) * 0.9, '#ff4a1d');
      else if (f instanceof IgnisDeath) add(f.e.x, f.e.y, 260, Math.max(0, 1 - f.t / 9), '#ff7a2d');
      else if (f instanceof IgnisHeal) { const l = f.light(); add(l[0], l[1], l[2], l[3], l[4]); }
    }
    // the dark, at half size, with the lights burnt out of it
    const cv = this.cv || (this.cv = document.createElement('canvas'));
    const cw = Math.max(1, Math.round(w * q)), ch = Math.max(1, Math.round(h * q));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = P2 ? '#1c0604' : '#120a14';
    g.globalAlpha = this.heat * (P2 ? 0.68 : 0.55);
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'destination-out';
    const hole = this.hole || (this.hole = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const gg = c.getContext('2d'), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return c;
    })());
    for (const [x, y, r, i] of L) { g.globalAlpha = i; g.drawImage(hole, (x - r) * q, (y - r) * q, r * 2 * q, r * 2 * q); }
    ctx.drawImage(cv, 0, 0, w, h);
    // what the fire lights, it warms (soft light: coloured, not washed white),
    // and right at the fire itself, a glow
    if (!Settings.data.low) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    for (const [x, y, r, i, c] of L) {
      if (!c) continue;
      ctx.globalAlpha = Math.min(1, i * this.heat * 1.3);
      ctx.drawImage(this.warm(c), x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
    }
    ctx.restore();
    }
    else for (const [x, y, r, i, c] of L) if (c) igGlow(ctx, x, y, r * 0.5, c, i * this.heat * 0.45);   // low: a cheap warm glow instead
    for (const [x, y, r, i, c, core] of L) if (c && core !== false) igGlow(ctx, x, y, r * 0.16, c, i * this.heat * 0.45);
  },

  warm(c) {
    this.warmCache = this.warmCache || {};
    if (this.warmCache[c]) return this.warmCache[c];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    // a ring: what is round the fire is warmed, the fire's own drawing is left alone
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.22, 'rgba(0,0,0,0)'); gr.addColorStop(0.42, c); gr.addColorStop(0.62, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (this.warmCache[c] = cv);
  },

  flake(w, h, anywhere) {
    return { x: Math.random() * w, y: anywhere ? h + Math.random() * 40 : Math.random() * h, vy: 20 + Math.random() * 50, vx: Rough.jit(15),
      f: 1 + Math.random() * 2, ph: Math.random() * 6, s: 1.5 + Math.random() * 2.5, hot: Math.random() < 0.45, life: 3 + Math.random() * 4 };
  },

  draw(ctx, game) {
    const w = game.w, h = game.h;
    const e = game.enemies.find(x => x.kind === 'ignis' && !x.dead);
    this.atmosphere(ctx, game, e);
    this.lb += ((game.cutscene ? 1 : 0) - this.lb) * 0.1;
    if (this.lb > 0.01) {
      const bh = h * 0.1 * E.out(this.lb);
      ctx.save();
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(0, 0, w, bh);
      ctx.fillRect(0, h - bh, w, bh);
      ctx.restore();
    }
    if (!e) return;
    const g = e.ig;
    // the title card on his entrance
    if (g.state === 'intro' && g.t > 1.2) {
      const a = Math.min(1, (g.t - 1.2) / 0.6) * Math.min(1, (5.1 - g.t) / 0.5);
      if (a > 0) {
        const name = 'IGNIS';
        const n = Math.min(name.length, Math.floor((g.t - 1.2) * 6));
        const size = Math.min(96, w * 0.17);
        ctx.save();
        ctx.globalAlpha = a;
        Rough.boil(4545, Math.floor(g.t * 7));
        Rough.text(ctx, name.slice(0, n), w / 2, h * 0.3, size, '#ff7a2d', 'center', '#1a1410');
        if (g.t > 2.2) Rough.text(ctx, '- the last attacker -', w / 2, h * 0.3 + size * 0.62, Math.max(16, size * 0.26), '#ece3c9', 'center', '#1a1410');
        const u = Math.min(1, Math.max(0, (g.t - 2.4) / 0.8));
        if (u > 0) Rough.line(ctx, w / 2 - size * 1.6 * u, h * 0.3 + size * 0.42, w / 2 + size * 1.6 * u, h * 0.3 + size * 0.42, { color: '#ff7a2d', width: 3, jitter: 1.5, passes: 1, alpha: a });
        ctx.restore();
      }
    }
    // his bar - half the width in phase one; it grows to full when he rises
    const barOn = g.state !== 'intro' || g.t > 4.6;
    if (barOn && !(g.state === 'dying' && g.t > 1.2)) {
      // wide screens: along the bottom, clear of the HUD and the skill button;
      // narrow ones: under the HUD at the top
      const wide = w >= 700;
      const W = wide ? Math.min(460, w - 240) : Math.min(460, w - 40), y0 = wide ? h - 60 : 96;
      const bw = W * (g.barMax / IGNIS.P2), x0 = (w - W) / 2;
      const frac = g.state === 'reform' ? g.barFill : Math.max(0, e.hp / e.maxHp);
      this.shown += (frac - this.shown) * 0.25;
      this.trail += (frac - this.trail) * (frac < this.trail ? 0.04 : 1);
      Rough.boil(4646, Math.floor(game.time * 3.5));
      ctx.save();
      ctx.fillStyle = 'rgba(26,20,16,0.55)';
      ctx.fillRect(x0 - 6, y0 - 4, bw + 12, 34);
      ctx.restore();
      Rough.text(ctx, 'IGNIS', x0, y0 + 6, 17, '#ff7a2d', 'left', '#1a1410');
      Rough.text(ctx, 'the last attacker', x0 + 62, y0 + 6, 12, '#ece3c9', 'left', '#1a1410');
      const label = g.state === 'bones' ? 'CLICK THE BONES  ' + g.clicks + '/2' : Math.max(0, Math.ceil(e.hp)) + ' / ' + Math.round(g.barMax);
      Rough.text(ctx, label, x0 + bw, y0 + 6, 12, g.state === 'bones' ? '#ffd24a' : '#ece3c9', 'right', '#1a1410');
      const by = y0 + 15, bh = 11;
      const body = Rough.rectPts(x0, by, bw, bh);
      if (this.trail > 0.002) {
        ctx.save(); ctx.fillStyle = '#ece3c9'; ctx.globalAlpha = 0.6;
        ctx.fillRect(x0, by, bw * this.trail, bh); ctx.restore();
      }
      if (this.shown > 0.002) {
        const fillPts = Rough.rectPts(x0, by, bw * this.shown, bh);
        ctx.save(); ctx.fillStyle = g.phase === 2 || g.state === 'reform' ? '#c8433a' : '#e0562d';
        ctx.fillRect(x0, by, bw * this.shown, bh); ctx.restore();
        Rough.scribble(ctx, fillPts, { color: '#ffd24a', spacing: 5, width: 2, overflow: 1, alpha: 0.5 });
      }
      Rough.poly(ctx, body, { color: '#1a1410', width: 2.4, jitter: 0.8 });
    }
    // what he says as he goes
    if (g.dialog && g.dialog.shown > 0) {
      const W = Math.min(640, w - 32), H = 64;
      const x0 = (w - W) / 2, y0 = h - h * 0.1 - H - 14;
      ctx.save();
      ctx.globalAlpha = Math.max(0, g.dialog.fade);
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(x0, y0, W, H);
      ctx.restore();
      if (g.dialog.fade > 0.3) {
        Rough.boil(4747, Math.floor(game.time * 3.5));
        Rough.poly(ctx, Rough.rectPts(x0, y0, W, H), { color: '#1a1410', width: 2.6, jitter: 1.2 });
        Rough.text(ctx, 'IGNIS', x0 + 14, y0 + 14, 14, '#e0562d', 'left');
        const lines = Rough.wrap(ctx, g.dialog.text.slice(0, g.dialog.shown), 17, W - 28);
        lines.slice(0, 2).forEach((ln, i) => Rough.text(ctx, ln, x0 + 14, y0 + 34 + i * 18, 17, '#2b2b2b', 'left'));
      }
    }
  }
};
