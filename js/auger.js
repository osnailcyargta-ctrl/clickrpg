/* FANDHARN - THE AUGER.

   Endless only, wave 13 and up, one or two a wave. A spider that got the
   count wrong - three legs on its right, two on its left and a stump where
   the third should be - with a drill where its mouth ought to go and eyes
   over every inch of it.

   It walks in until it is four blocks off the castle's lawn, stops dead for
   a beat while every eye turns the same way, winds up for a second backing
   away slowly with the drill screaming, then runs. Anything that hurts it
   mid-run stops it cold, and it has to wind up from the start. If it gets
   there it costs a segment, like anything else - it is meant to be horrible
   to look at, not to be the hardest thing on the page.

   Its methods hang off Enemy, the way the Hive's do. */

const AUGER_HALT = 0.3;          // the beat where it stops and looks
const AUGER_WIND = 1.0;          // backing away with the drill spinning up
const AUGER_BACK = 14;           // px/s it gives up while it winds
const AUGER_DASH = 7;            // x its walking speed, on the run

Object.assign(Enemy.prototype, {

  augerState() {
    if (this.aug) return this.aug;
    // the eyes are laid out once, from its own id, so they never swim
    let seed = (this.id * 7919 + 104729) % 233280;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const eyes = [];
    const add = (x, y, s) => eyes.push({
      x, y, s,
      blink: rnd() * 9, shot: rnd() < 0.55, dart: rnd() * Math.PI * 2,
      // some are only whites - rolled back into the head
      rolled: s < 0.2 && rnd() < 0.22,
      slit: rnd() < 0.35,
      weep: rnd() < 0.18,
      lid: rnd() < 0.3 ? 0.3 + rnd() * 0.35 : 0
    });
    // one enormous eye in the face, two big ones flanking it, then a crowd
    // packed over everything else, overlapping, none of them the same size
    add(0, -0.46, 0.3);
    add(-0.4, -0.66, 0.15); add(0.43, -0.6, 0.17);
    for (let i = 0; i < 26; i++) {
      const onBack = i > 8;
      const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
      const x = Math.cos(ang) * rr * (onBack ? 0.82 : 0.58);
      const y = onBack ? 0.5 + Math.sin(ang) * rr * 0.72 : -0.4 + Math.sin(ang) * rr * 0.5;
      add(x, y, 0.045 + Math.pow(rnd(), 1.8) * 0.17);
    }
    // small ones drawn first so the big ones sit over them
    eyes.sort((p, q) => p.s - q.s);
    this.aug = { mode: 'walk', t: 0, gait: rnd() * 6, spin: 0, trail: [], eyes, jolt: 0 };
    return this.aug;
  },

  augerUpdate(dt, game, d) {
    const a = this.augerState();
    const inX = -this.x / d, inY = -this.y / d;         // toward the castle
    if (a.jolt > 0) a.jolt = Math.max(0, a.jolt - dt / 0.25);

    if (a.mode === 'walk') {
      const step = this.speed * dt;
      this.x += inX * step; this.y += inY * step;
      a.gait += step * 0.09;
      a.spin += dt * 4;
      if (d <= AUGER_STOP) {
        a.mode = 'halt'; a.t = AUGER_HALT;
        Sfx.play('auger_chitter', { volume: 0.75, throttle: 80 });
      }
      return;
    }

    if (a.mode === 'halt') {                 // dead still, every eye turning
      a.t -= dt;
      a.spin += dt * 2;
      if (a.t <= 0) this.augerWind(game);
      return;
    }

    if (a.mode === 'wind') {                 // backing off, drill screaming
      a.t -= dt;
      const k = 1 - a.t / AUGER_WIND;
      this.x -= inX * AUGER_BACK * dt;
      this.y -= inY * AUGER_BACK * dt;
      a.gait -= AUGER_BACK * dt * 0.09;
      a.spin += dt * (8 + k * k * 60);
      if (a.t <= 0) {
        a.mode = 'dash';
        a.trail.length = 0;
        game.shake(9);
        Sfx.play('auger_dash', { volume: 1, rateVar: 0.04 });
      }
      return;
    }

    if (a.mode === 'dash') {
      const step = Math.max(200, this.speed * AUGER_DASH) * dt;
      this.x += inX * step; this.y += inY * step;
      a.gait += step * 0.05;
      a.spin += dt * 70;
      a.trail.unshift([this.x, this.y]);
      if (a.trail.length > 8) a.trail.pop();
      if (Math.random() < 0.6) game.effects.push(new Crumb(this.x - inX * this.r, this.y - inY * this.r, '#9a8f86'));
      if (d <= game.castleRadius + this.r * 0.6) {
        game.castleHit(this);
        game.shake(16);
        game.effects.push(new KillPop(this.x, this.y, this.r, '#7a1f1f', true, game));
        this.dead = true;
        game.effects.push(new DeathSplat(this.x, this.y, this.r, this.fill, true));
      }
    }
  },

  augerWind(game) {
    const a = this.augerState();
    a.mode = 'wind'; a.t = AUGER_WIND;
    Sfx.play('auger_charge', { volume: 0.9, rateVar: 0.03, throttle: 60 });
  },

  /* Called from hurt(). A hit while it is running stops it dead. */
  augerStruck(game) {
    const a = this.augerState();
    if (a.mode !== 'dash') return;
    a.jolt = 1;
    a.trail.length = 0;
    // knocked back on its heels a little, then straight back to winding up
    const d = Math.hypot(this.x, this.y) || 1;
    this.x += (this.x / d) * 10; this.y += (this.y / d) * 10;
    game.effects.push(new FloatText(this.x, this.y - this.r - 14, 'stopped', '#c8433a', 18, true));
    for (let i = 0; i < Fx.n(8); i++) game.effects.push(new Crumb(this.x, this.y, '#7a1f1f'));
    game.shake(5);
    this.augerWind(game);
  },

  /* ------------------------------------------------------------ drawing */
  drawAuger(ctx, x, y, rx, ry, fill, t) {
    const a = this.augerState();
    const r = (rx + ry) / 2;
    const face = Math.atan2(-this.y, -this.x);
    const winding = a.mode === 'wind' ? 1 - a.t / AUGER_WIND : 0;
    const dashing = a.mode === 'dash';
    const tense = a.mode === 'halt' || a.mode === 'wind' || dashing;

    // the path it is about to take, scribbled in red while it winds up
    if (a.mode === 'wind') {
      ctx.save();
      const d = Math.hypot(x, y) || 1;
      const ex = x - (x / d) * (d - 30), ey = y - (y / d) * (d - 30);
      Rough.line(ctx, x, y, ex, ey, { color: '#c8433a', width: 2 + winding * 4, jitter: 3 + winding * 4, passes: 2,
        alpha: 0.15 + winding * 0.55 });
      Rough.bloom(ctx, ex, ey, 26 + winding * 20, '#c8433a', winding * 0.7);
      ctx.restore();
    }

    // on the run it leaves torn streaks and a wake of red where its eyes were
    if (dashing && a.trail.length > 1) {
      ctx.save();
      const [hx, hy] = a.trail[0], [tx, ty] = a.trail[a.trail.length - 1];
      const nx = -Math.sin(face), ny = Math.cos(face);
      for (let i = -2; i <= 2; i++) {
        Rough.line(ctx, hx + nx * i * r * 0.4, hy + ny * i * r * 0.4, tx + nx * i * r * 0.5, ty + ny * i * r * 0.5,
          { color: i === 0 ? '#c8433a' : '#1c1219', width: i === 0 ? 3 : 2, jitter: 2, passes: 1,
            alpha: 0.4 - Math.abs(i) * 0.07 });
      }
      if (!Fx.low) {
        for (let i = 2; i < a.trail.length; i += 2) {
          ctx.globalAlpha = (1 - i / a.trail.length) * 0.22;
          ctx.fillStyle = '#1c1219';
          ctx.beginPath(); ctx.ellipse(a.trail[i][0], a.trail[i][1], r * 0.8, r * 0.6, face + Math.PI / 2, 0, 7); ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.save();
    const shake = (a.mode === 'wind' ? 1 + winding * 3 : 0) + a.jolt * 4;
    ctx.translate(x + Rough.jit(shake), y + Rough.jit(shake));
    ctx.rotate(face + Math.PI / 2);                 // -y is where it is going
    // it gathers itself: squats low and wide before the run
    ctx.scale(1 + winding * 0.1, 1 - winding * 0.08);

    // a tight shadow, darkening as it tenses
    ctx.save();
    ctx.globalAlpha = 0.18 + winding * 0.12;
    ctx.fillStyle = '#1c1219';
    ctx.beginPath(); ctx.ellipse(5, r * 0.25 + 6, r * 1.05, r * 1.25, 0, 0, 7); ctx.fill();
    ctx.restore();

    this.augerLegs(ctx, r, t, a, winding, dashing, tense);

    // --- the body: a small head up front and a swollen, hunched abdomen
    const abdomen = [], head = [];
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const lump = 1 + Math.sin(ang * 5 + this.wobblePhase) * 0.08 + Math.sin(ang * 3 + t * 1.6) * 0.035;
      abdomen.push([Math.cos(ang) * r * 0.95 * lump, r * 0.55 + Math.sin(ang) * r * 0.9 * lump]);
      const lh = 1 + Math.sin(ang * 4 + this.wobblePhase * 2) * 0.06;
      head.push([Math.cos(ang) * r * 0.66 * lh, -r * 0.42 + Math.sin(ang) * r * 0.56 * lh]);
    }
    // bristles off the whole outline, so it never reads smooth
    ctx.save();
    for (const shape of Fx.low ? [] : [abdomen, head]) {
      for (let i = 0; i < shape.length; i += 1) {
        const [px, py] = shape[i];
        const cy = shape === abdomen ? r * 0.55 : -r * 0.42;
        const ang = Math.atan2(py - cy, px);
        const len = r * (0.12 + ((i * 37) % 7) * 0.025) * (1 + winding * 0.6);
        Rough.line(ctx, px, py, px + Math.cos(ang) * len, py + Math.sin(ang) * len,
          { color: '#140c14', width: 1.3, jitter: 0.8, passes: 1, alpha: 0.85 });
      }
    }
    ctx.restore();
    for (const shape of [abdomen, head]) {
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#1f1420';
      ctx.beginPath();
      shape.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
      ctx.closePath(); ctx.fill();
      Rough.scribble(ctx, shape, { color: fill, spacing: 5, width: 6, overflow: 1.03, alpha: 0.9 });
      if (!Fx.low) Rough.scribble(ctx, shape, { color: '#6b2a4a', spacing: 10, width: 4, overflow: 1.02, alpha: 0.35, angle: 1.1 });
    }
    // veins, and a wet sheen that catches the light
    ctx.save();
    for (let i = 0; i < (Fx.low ? 0 : 5); i++) {
      const va = this.wobblePhase + i * 1.3;
      Rough.poly(ctx, [[Math.cos(va) * r * 0.15, r * 0.55 + Math.sin(va) * r * 0.15],
      [Math.cos(va + 0.5) * r * 0.5, r * 0.55 + Math.sin(va + 0.5) * r * 0.5],
      [Math.cos(va + 0.25) * r * 0.85, r * 0.55 + Math.sin(va + 0.25) * r * 0.8]],
        { color: '#8a1f2a', width: 1.4, jitter: 1.2, closed: false, alpha: 0.6 });
    }
    Rough.arc(ctx, -r * 0.1, r * 0.4, r * 0.62, -2.6, -1.5, { color: '#fffdf4', width: 2.4, jitter: 0.8, alpha: 0.28 });
    ctx.restore();
    Rough.poly(ctx, abdomen, { color: '#0e080e', width: 3.2, jitter: 1.6 });
    Rough.poly(ctx, head, { color: '#0e080e', width: 3, jitter: 1.4 });

    this.augerEyes(ctx, r, t, a, tense, winding);
    this.augerDrill(ctx, r, t, a, winding, dashing);
    ctx.restore();
  },

  /* Five legs, not eight: three on its right, two on its left and a
     twitching stump where the left side's middle leg was torn off. The left
     pair are heavier and longer, carrying more than they should, so it
     lurches. Each leg kinks at a knee held up off the page - the shadow
     underneath is what shows how high. */
  augerLegs(ctx, r, t, a, winding, dashing, tense) {
    // [side, hip angle, gait phase]; angles are from +x, and -PI/2 is forward
    const legs = [
      [1, -0.72, 0.0], [1, 0.05, 2.1], [1, 0.82, 4.2],
      [-1, Math.PI + 0.62, 1.0], [-1, Math.PI - 0.9, 3.5]
    ];
    const tremble = tense && !dashing ? 0.7 + winding * 2.4 : 0;
    for (const [side, hipA, phase] of legs) {
      const heavy = side < 0;
      const g = a.gait * (heavy ? 0.8 : 1) + phase;
      const stride = (heavy ? 0.36 : 0.24) * (dashing ? 0.3 : 1) * (a.mode === 'walk' ? 1 : 0.25);
      const swing = Math.sin(g) * stride;
      const lift = Math.max(0, Math.cos(g)) * (a.mode === 'walk' ? 1 : 0.2);
      // on the run every leg is thrown back behind it
      const sweep = dashing ? (hipA < -Math.PI / 2 || hipA > Math.PI / 2 ? -0.55 : 0.55) * (heavy ? -1 : 1) : 0;
      const th = hipA + swing + sweep;
      const L1 = r * (heavy ? 1.45 : 1.2) * (1 + winding * 0.12);
      const L2 = r * (heavy ? 1.55 : 1.3);
      const hx = Math.cos(th) * r * 0.62, hy = -r * 0.1 + Math.sin(th) * r * 0.55;
      // the knee: straight out along the leg, pushed further out as it lifts
      const kx = hx + Math.cos(th) * L1 * (1 + lift * 0.12);
      const ky = hy + Math.sin(th) * L1 * (1 + lift * 0.12);
      // the shin kinks toward whichever end of the body the leg is on
      const bend = (Math.sin(th) < 0 ? -0.95 : 0.95) * (heavy ? 1.1 : 1);
      const fx = kx + Math.cos(th + bend * side * (Math.cos(th) > 0 ? 1 : -1)) * L2 + Rough.jit(tremble);
      const fy = ky + Math.sin(th + bend * side * (Math.cos(th) > 0 ? 1 : -1)) * L2 + Rough.jit(tremble);
      const lh = 8 + lift * 8;                       // how far the knee is off the page

      if (!Fx.low) {
        Rough.poly(ctx, [[hx + 3, hy + 5], [kx + lh * 0.6, ky + lh], [fx + 2, fy + 3]],
          { color: '#1c1219', width: heavy ? 4 : 3, jitter: 1, closed: false, alpha: 0.22, passes: 1 });
      }
      Rough.line(ctx, hx, hy, kx, ky, { color: '#140c14', width: heavy ? 5.6 : 4.4, jitter: 1.2, passes: 2 });
      Rough.line(ctx, kx, ky, fx, fy, { color: '#140c14', width: heavy ? 3.4 : 2.6, jitter: 1.1, passes: 2 });
      ctx.fillStyle = '#2a1a28';
      ctx.beginPath(); ctx.arc(kx, ky, heavy ? 4 : 3.2, 0, 7); ctx.fill();
      // a pale hooked claw at the end
      const ca = Math.atan2(fy - ky, fx - kx);
      Rough.line(ctx, fx, fy, fx + Math.cos(ca + 0.6) * 7, fy + Math.sin(ca + 0.6) * 7,
        { color: '#d8cfc0', width: 2, jitter: 0.6, passes: 1 });
    }
    // the stump, jerking where the missing left leg should be
    const twitch = Math.sin(t * 17 + this.wobblePhase) * 0.35 + (tense ? Rough.jit(0.2) : 0);
    const sa = Math.PI + 0.05 + twitch;
    const sx = Math.cos(sa) * r * 0.62, sy = -r * 0.1 + Math.sin(sa) * r * 0.55;
    const tx = sx + Math.cos(sa) * r * 0.5, ty = sy + Math.sin(sa) * r * 0.5;
    Rough.line(ctx, sx, sy, tx, ty, { color: '#140c14', width: 5, jitter: 1.2, passes: 2 });
    ctx.fillStyle = '#8a1f2a';
    ctx.beginPath(); ctx.ellipse(tx, ty, 4, 3.2, sa, 0, 7); ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.6;
    Rough.line(ctx, tx, ty, tx + Math.cos(sa + 1.4) * 5, ty + 7, { color: '#8a1f2a', width: 1.6, jitter: 0.6, passes: 1, alpha: 0.6 });
    ctx.restore();
  },

  /* The mouth is a drill: a long steel cone with a spiral flute that turns
     faster the closer it is to going, coming out of a ring of teeth, with a
     tip that has already been through something. */
  augerDrill(ctx, r, t, a, winding, dashing) {
    const base = -r * 0.86, tip = -r * (2.35 + winding * 0.15);
    const w = r * 0.4;
    // teeth first, so the drill looks like it comes out of the mouth
    const teeth = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, ang = Math.PI + u * Math.PI;
      const rr = r * (0.5 + (i % 2 ? 0.2 : 0));
      teeth.push([Math.cos(ang) * rr, base + r * 0.12 + Math.sin(ang) * rr * 0.55]);
    }
    ctx.fillStyle = '#0e080e';
    ctx.beginPath(); ctx.ellipse(0, base + r * 0.1, r * 0.52, r * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8e0cc';
    for (let i = 0; i < teeth.length - 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(teeth[i][0], teeth[i][1]);
      ctx.lineTo(teeth[i + 1][0], teeth[i + 1][1]);
      ctx.lineTo(teeth[Math.min(teeth.length - 1, i + 2)][0], teeth[Math.min(teeth.length - 1, i + 2)][1]);
      ctx.lineTo(0, base + r * 0.12);
      ctx.closePath(); ctx.fill();
    }
    Rough.poly(ctx, teeth, { color: '#0e080e', width: 1.6, jitter: 0.6, closed: false, passes: 1 });

    // the bit runs hot when it spins fast
    if (winding > 0.25 || dashing) {
      Rough.bloom(ctx, 0, tip + r * 0.2, r * (0.6 + winding * 0.7 + (dashing ? 0.6 : 0)), '#ff6a3d',
        dashing ? 0.85 : winding * 0.75);
    }
    const cone = [[-w, base], [-w * 0.18, tip + r * 0.12], [0, tip], [w * 0.18, tip + r * 0.12], [w, base]];
    ctx.fillStyle = '#9a9690';
    ctx.beginPath(); cone.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); cone.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
    ctx.closePath(); ctx.clip();
    // the flute: diagonals scrolling down the cone as it turns
    const len = base - tip, bands = 7;
    const off = (a.spin % 1 + 1) % 1;
    for (let i = -1; i < bands + 1; i++) {
      const yy = tip + ((i + off) / bands) * len;
      Rough.line(ctx, -w * 1.2, yy + len * 0.1, w * 1.2, yy - len * 0.1,
        { color: '#3f3c39', width: 2.8, jitter: 0.5, passes: 1 });
    }
    // a steel highlight down one side, and blood caked on the business end
    ctx.globalAlpha = 0.5;
    Rough.line(ctx, -w * 0.45, base, -w * 0.08, tip + len * 0.2, { color: '#fffdf4', width: 2, jitter: 0.4, passes: 1, alpha: 0.5 });
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#7a1f1f';
    ctx.beginPath(); ctx.moveTo(-w * 0.5, tip + len * 0.45); ctx.lineTo(0, tip); ctx.lineTo(w * 0.5, tip + len * 0.45);
    ctx.lineTo(w * 0.1, tip + len * 0.3); ctx.lineTo(-w * 0.15, tip + len * 0.36); ctx.closePath(); ctx.fill();
    ctx.restore();
    Rough.poly(ctx, cone, { color: '#0e080e', width: 2.6, jitter: 0.9 });
    // sparks off the tip when it is really going
    if ((winding > 0.5 || dashing) && Math.random() < 0.8) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? '#ffb347' : '#fffdf4';
        ctx.fillRect(Rough.jit(w * 0.8), tip + Rough.jit(8), 2.6, 2.6);
      }
      ctx.restore();
    }
  },

  /* The eyes. Walking, they wander on their own and blink out of step. When
     it stops they all shut at once - and open again together, every one of
     them on the castle, pupils gone to pinpricks, irises burning. */
  augerEyes(ctx, r, t, a, tense, winding) {
    // the synchronised blink at the start of the halt
    let together = 1;
    if (a.mode === 'halt') {
      const k = 1 - a.t / AUGER_HALT;
      together = k < 0.35 ? 1 - k / 0.35 : Math.min(1.15, (k - 0.35) / 0.25 * 1.15);
    }
    for (const e of a.eyes) {
      const ex = e.x * r, ey = e.y * r, er = e.s * r;
      const bc = (t * 0.45 + e.blink) % 3.4;
      const blink = tense ? 0 : (bc < 0.14 ? Math.sin(bc / 0.14 * Math.PI) : 0);
      let open = (1 - blink) * (1 - (tense ? 0 : e.lid || 0));
      if (a.mode === 'halt') open = together;
      open = Math.max(0.06, open);
      // a sunken socket around every one
      ctx.fillStyle = '#0a050a';
      ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.22, er * Math.max(0.35, open) * 1.22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#d6cba2';
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * open, 0, 0, 7); ctx.fill();
      if (open > 0.25) {
        if ((e.shot || tense) && !Fx.low) {       // bloodshot, and worse when it is looking at you
          ctx.save();
          ctx.globalAlpha = tense ? 0.9 : 0.65;
          for (let v = 0; v < (tense ? 4 : 3); v++) {
            const va = e.dart + v * 1.6;
            Rough.line(ctx, ex + Math.cos(va) * er * 0.95, ey + Math.sin(va) * er * 0.95 * open,
              ex + Math.cos(va + 0.35) * er * 0.4, ey + Math.sin(va + 0.35) * er * 0.4 * open,
              { color: '#b8323a', width: 0.9, jitter: 0.5, passes: 1, alpha: tense ? 0.9 : 0.65 });
          }
          ctx.restore();
        }
        if (!e.rolled || tense) {
          // where it looks: each on its own, or all at once at the castle
          const la = -Math.PI / 2 + (tense ? 0 : Math.sin(t * 0.8 + e.dart) * 1.7);
          const lk = er * (tense ? 0.38 : 0.3);
          const px = ex + Math.cos(la) * lk, py = ey + Math.sin(la) * lk * open;
          const iris = er * (tense ? 0.46 : 0.56);
          ctx.fillStyle = tense ? '#d63a2a' : '#b8a03a';
          ctx.beginPath(); ctx.ellipse(px, py, iris, iris * open, 0, 0, 7); ctx.fill();
          if (tense && !Fx.low && er > r * 0.1) Rough.bloom(ctx, px, py, iris * 3.4, '#ff3b2a', 0.35 + winding * 0.45);
          ctx.fillStyle = '#050205';
          const pupil = iris * (tense ? 0.24 : 0.55);
          ctx.beginPath();
          ctx.ellipse(px, py, pupil * (e.slit ? 0.35 : 1), pupil * (e.slit ? 1.8 : 1) * open, 0, 0, 7);
          ctx.fill();
        }
      }
      ctx.strokeStyle = '#0e080e';
      ctx.lineWidth = Math.max(0.9, er * 0.15);
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * open, 0, 0, 7); ctx.stroke();
      // a few of them weep something dark down the body
      if (e.weep && er > r * 0.07) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        Rough.line(ctx, ex, ey + er * 0.9, ex + Math.sin(e.dart) * 2, ey + er * 0.9 + r * 0.25,
          { color: '#4a0f16', width: Math.max(1.2, er * 0.3), jitter: 0.6, passes: 1, alpha: 0.7 });
        ctx.restore();
      }
    }
  }
});
