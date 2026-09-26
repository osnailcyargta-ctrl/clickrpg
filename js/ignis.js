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
  ORB_SPEED: 560,
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
        if (h.dead || (h.kind !== 'heart' && h.kind !== 'ignisorb')) continue;
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
    const canBlock = g.state === 'walk' || g.state === 'guard' || g.state === 'exposed';
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
        if (g.thrustT <= 0) this.igSet('thrust');
        break;
      case 'thrust':
        g.anim = 'thrust';
        if (g.t >= 0.22 && once('hit')) {
          const tip = (this.igA && this.igA.tip) || [this.x, this.y];
          game.effects.push(new IgnisThrust(tip[0], tip[1], game));
          Sfx.play('ignis_thrust', { volume: 1, rateVar: 0.05 });
          game.castleHit(this);
        }
        if (g.t >= 0.62) {
          g.thrustT = IGNIS.THRUST[g.phase - 1];
          if (this.igHeartsAlive(game) === 0) this.igExpose(game); else this.igSet('guard');
        }
        break;
      case 'exposed':
        g.anim = 'exposed';
        if (g.t >= IGNIS.EXPOSED[g.phase - 1]) this.igSet(g.phase === 1 ? 'roar' : 'charge');
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
          game.shake(22);
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
          game.shake(18);
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
    const anim = g.blockT > 0 ? 'block' : g.anim;
    const fi = IgnisSheet.frameAt(anim, g.animT);
    const S = IGNIS.SCALE;
    let fy = f[1] - (g.hop || 0);
    let fx = f[0];
    if (g.rattle > 0) { fx += Rough.jit(3); fy += Rough.jit(2); }
    if (g.state === 'dying') { fx += Rough.jit(2 + g.t); }

    // heat off him, and a crown of fire that grows in phase two
    if (!Fx.low && g.state !== 'bones' && g.state !== 'intro') {
      Rough.bloom(ctx, this.x, this.y, 70 + (g.phase === 2 ? 20 : 0), '#ff7a2d', 0.18 + (g.phase === 2 ? 0.1 : 0));
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
      this.igA = IgnisSheet.draw(ctx, anim, fi, fx, fy + (1 - g.rise) * 150 * S, flip, S);
      ctx.restore();
    } else {
      this.igA = IgnisSheet.draw(ctx, anim, fi, fx, fy, flip, S);
    }
    if (this.flash > 0) {                                  // struck: a flash of white heat
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      IgnisSheet.draw(ctx, anim, fi, fx, fy, flip, S);
      ctx.restore();
    }
    // live fire over the baked frame: the eye and the staff's ember
    if (this.igA && !Fx.low && g.state !== 'bones') {
      const flick = 0.7 + Math.sin(t * 17 + this.id) * 0.2 + Math.random() * 0.1;
      Rough.bloom(ctx, this.igA.eye[0], this.igA.eye[1], 14 * flick, '#ff7a2d', 0.8);
      Rough.bloom(ctx, this.igA.top[0], this.igA.top[1], 22 * flick * (anim === 'summon' ? 1.8 : 1), '#ffb347', 0.7);
    }
    // the shield: the staff spun into a wheel of fire
    if (g.blockT > 0 && this.igA) {
      const h = this.igA.hand, a = t * 22;
      Rough.boil(this.id + 9, Math.floor(t * 20));
      Rough.bloom(ctx, h[0], h[1], 64, '#ffb347', 0.5);
      for (let i = 0; i < 3; i++) {
        Rough.arc(ctx, h[0], h[1], 50 + i * 6, a + i * 2, a + i * 2 + 2.2, { color: i ? '#ffd24a' : '#ff7a2d', width: 3 - i * 0.6, jitter: 1, passes: 1, alpha: 0.9 });
      }
      Rough.circle(ctx, this.x, this.y, IGNIS.BLOCK_BOX * 1.1, { color: '#ffd24a', width: 1.4, jitter: 2, wobble: 3, passes: 1, alpha: 0.25 + Math.sin(t * 12) * 0.1 });
    }
    // the pile: a hint that it wants clicking
    if (g.state === 'bones') {
      const k = 0.5 + Math.sin(t * 5) * 0.5;
      Rough.bloom(ctx, f[0], f[1] - 16, 50, '#ff7a2d', 0.2 + k * 0.25);
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
    if (!Fx.low) Rough.bloom(ctx, x, y, r * 2.6, '#ff4a2d', 0.45);
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
      const k = Math.max(0, Math.min(1, o.t / 0.4));
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
    if (d <= game.castleRadius + this.r) {
      this.dead = true;
      game.effects.push(new Flare(this.x, this.y, { color: '#ff7a2d', r: 34, dur: 0.4, rays: 8, motes: 6, rings: 1 }));
      game.castleHit(this);
      if (game.state === 'playing') game.castleHit(this);      // two
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
    if (!Fx.low) Rough.bloom(ctx, x, y, r * 3.2, '#ff7a2d', 0.7);
    Rough.blob(ctx, x, y, r, this.flash > 0 ? '#ffffff' : '#ff7a2d', '#5a1a0a', { spacing: 2, fillWidth: 2.4, sides: 9, width: 1.8, wobble: 1.2 });
    Rough.blob(ctx, x, y, r * 0.45, '#fff1b0', null, { spacing: 1.6, fillWidth: 2, sides: 7, width: 0.1, wobble: 0.4 });
  }
});

/* ------------------------------------------------------------ effects */

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
    if (heat > 0 && !Fx.low) Rough.bloom(ctx, this.x, this.y - 6, 60 * grow, '#ff4a2d', 0.7 * heat);
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
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, R * 1.6, '#ff7a2d', 0.5 * a);
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
    if (!Fx.low) Rough.bloom(ctx, ex, ey, 30, '#ff7a2d', 0.8);
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
    if (!Fx.low) Rough.bloom(ctx, this.x, this.y, 60 + k * 200, '#ff7a2d', (1 - k) * 0.5);
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
    if (!this.crumble && !Fx.low) Rough.bloom(ctx, this.x, this.y, 20 + k * 20, '#ffd24a', 1 - k);
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
      this.pieces = IgnisSheet.pieces('death', 0).map((p, i) => ({
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
      if (!Fx.low) Rough.bloom(ctx, p.x, p.y, 16, '#ff7a2d', 0.35 * fade);
    }
  }
}

/* ------------------------------------------------------------- HUD */
/* His bar across the top, the letterbox for his entrance and his death, the
   title card, and what he says. Drawn in screen space over the page. */
const IgnisHud = {
  lb: 0,
  shown: 0, trail: 0,

  draw(ctx, game) {
    const w = game.w, h = game.h;
    const e = game.enemies.find(x => x.kind === 'ignis' && !x.dead);
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
