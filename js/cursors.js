/* FANDHARN - cursor weapons and the drawn pointer itself.
   The cursor IS the weapon: buying a new one throws the old one away. */

// The Wet Cursor scatters its drops across 9 fixed directions, picked at random.
const NINE_DIRS = [];
for (let i = 0; i < 9; i++) NINE_DIRS.push((i / 9) * Math.PI * 2);

const CursorPowers = {
  plain: null,
  pen: null,       // the Pen Tool works by dragging, not by charging

  wet(game, x, y) {
    const r = 20 * game.aoeScale();
    const dmg = game.aoeDamage(3);
    for (let i = 0; i < 6; i++) {
      const a = NINE_DIRS[Math.floor(Math.random() * NINE_DIRS.length)] + (Math.random() - 0.5) * 0.12;
      game.effects.push(new WaterDrop(x, y, a, game, r, dmg));
    }
  },

  storm(game, x, y) {
    const live = game.enemies.filter(e => !e.dead && e.spawnT > 0.3);
    const pick = live.length ? live[Math.floor(Math.random() * live.length)] : null;
    const tx = pick ? pick.x : x + Rough.jit(BLOCK * 3);
    const ty = pick ? pick.y : y + Rough.jit(BLOCK * 3);
    game.effects.push(new GatheringCloud(tx, ty, game,
      game.aoeDamage(game.clickDamage() * 0.5),   // the bolt itself
      BLOCK * game.aoeScale(),                    // one block of splash
      game.aoeDamage(4)));                        // which only ever does 4
  },

  magnet(game, x, y) {
    game.effects.push(new MagnetPull(x, y, BLOCK * 4 * game.aoeScale(), game.aoeDamage(2), game, 0));
    Sfx.play('magnet_pull', { volume: 0.75 });
  },

  boomerang(game, x, y) {
    // thrown AT something. Aiming it away from the castle meant it sailed off
    // past everything; instead it goes at the nearest body and the reach is
    // set so that body sits mid-loop, where the arc passes twice.
    let best = null, bd = Infinity;
    for (const e of game.enemies) {
      if (e.dead || e.spawnT < 0.3) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    const a = best ? Math.atan2(best.y - y, best.x - x) : Math.atan2(y, x);
    const reach = best
      ? Math.max(BLOCK * 2.2, Math.min(BLOCK * 7, bd * 1.5))
      : BLOCK * 5 * game.aoeScale();
    game.effects.push(new Boomerang(x, y, a, reach * game.aoeScale(), game.aoeDamage(3), game));
    Sfx.play('boomerang', { volume: 0.7 });
  },

  eraser(game, x, y) {
    game.effects.push(new EraseBurst(x, y, BLOCK * 1.5 * game.aoeScale(), game));
    Sfx.play('erase', { volume: 0.7 });
  },

  compass(game, x, y) {
    game.effects.push(new CompassRing(x, y, BLOCK * 3 * game.aoeScale(), game.aoeDamage(5)));
    Sfx.play('compass_ring', { volume: 0.7 });
  },

  buzz(game, x, y) {
    const range = BLOCK * 4;
    const pool = game.enemies
      .filter(e => !e.dead && Math.hypot(e.x - x, e.y - y) <= range)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
      .slice(0, 3);
    const pts = [[x, y]];
    for (const e of pool) {
      pts.push([e.x, e.y]);
      e.hurt(game.aoeDamage(3), game, { color: '#b99a1c' });
      if (!e.dead) e.stun = Math.max(e.stun, 0.35 + game.statusBonus());
    }
    Sfx.play('zap', { volume: 0.7 });
    if (pts.length > 1) game.effects.push(new Bolt(pts));
    else game.effects.push(new Bolt([[x, y], [x + Rough.jit(34), y + Rough.jit(34)]]));
  }
};

/* Hooks that run on a landed click, for cursors whose trick isn't a charge. */
const CursorOnHit = {
  scissor(game, enemy) {
    if (enemy.dead || enemy.boss) return;               // bosses don't get snipped
    if (enemy.hp > enemy.maxHp * 0.18) return;
    game.effects.push(new ScissorCut(enemy.x, enemy.y, enemy.r * 1.6));
    Sfx.play('snip', { volume: 0.8, throttle: 40 });
    game.effects.push(new FloatText(enemy.x, enemy.y - enemy.r - 8, 'snip', '#c8433a', 20, false));
    enemy.hurt(enemy.hp, game, { silent: true });
  }
};

/* ------------------------------------------------------------- the sprite */
const CursorSprites = {
  plain(ctx, x, y, s, color) {
    const p = [[x, y], [x + 13 * s, y + 13 * s], [x + 6 * s, y + 14 * s], [x + 10 * s, y + 22 * s],
    [x + 6 * s, y + 24 * s], [x + 2.5 * s, y + 16 * s], [x - 1 * s, y + 20 * s]];
    Rough.scribble(ctx, p, { color, spacing: 4, width: 4, overflow: 1.2, alpha: 0.9 });
    Rough.poly(ctx, p, { color: '#2b2b2b', width: 2, jitter: 0.7 });
  },

  wet(ctx, x, y, s, color, t) {
    CursorSprites.plain(ctx, x, y, s, color);
    const drip = (Math.sin(t * 2) * 0.5 + 0.5) * 5;
    Rough.blob(ctx, x + 9 * s, y + 26 * s + drip, 3.6 * s, '#2f8fd6', '#1d5f92', { spacing: 4, fillWidth: 3, sides: 8 });
  },

  /* A pencil like the old Windows pencil cursor: tip on the hotspot, body
     going up to the right, metal band and a pink eraser at the end. */
  pen(ctx, x, y, s, color) {
    const L = 26 * s, w = 5 * s;
    const ax = Math.cos(-0.72), ay = Math.sin(-0.72);      // body direction
    const px = -ay, py = ax;                               // across the body
    const at = (d, o) => [x + ax * d + px * o, y + ay * d + py * o];

    const wood = [at(3.5 * s, 0), at(9 * s, -w * 0.75), at(9 * s, w * 0.75)];
    const body = [at(9 * s, -w), at(L, -w), at(L, w), at(9 * s, w)];
    const band = [at(L, -w), at(L + 4 * s, -w), at(L + 4 * s, w), at(L, w)];
    const rub = [at(L + 4 * s, -w * 0.9), at(L + 9 * s, -w * 0.7), at(L + 9 * s, w * 0.7), at(L + 4 * s, w * 0.9)];

    Rough.line(ctx, x, y, at(4 * s, 0)[0], at(4 * s, 0)[1], { color: '#2b2b2b', width: 2.2, jitter: 0.6, passes: 1 });
    Rough.scribble(ctx, wood, { color: '#e8cf9a', spacing: 4, width: 4, overflow: 1.15 });
    Rough.poly(ctx, wood, { color: '#2b2b2b', width: 1.9, jitter: 0.6 });
    Rough.scribble(ctx, body, { color, spacing: 4.5, width: 4, overflow: 1.12 });
    Rough.poly(ctx, body, { color: '#2b2b2b', width: 2, jitter: 0.6 });
    Rough.scribble(ctx, band, { color: '#b9bec4', spacing: 3.5, width: 3, overflow: 1.1 });
    Rough.poly(ctx, band, { color: '#2b2b2b', width: 1.7, jitter: 0.5 });
    Rough.scribble(ctx, rub, { color: '#e58ba0', spacing: 3.5, width: 3.5, overflow: 1.12 });
    Rough.poly(ctx, rub, { color: '#2b2b2b', width: 1.8, jitter: 0.6 });
  },

  eraser(ctx, x, y, s, color) {
    const p = [[x + 1 * s, y + 2 * s], [x + 15 * s, y - 3 * s], [x + 21 * s, y + 12 * s], [x + 7 * s, y + 17 * s]];
    Rough.scribble(ctx, p, { color, spacing: 4, width: 4.5, overflow: 1.16 });
    Rough.poly(ctx, p, { color: '#2b2b2b', width: 2, jitter: 0.7 });
    Rough.line(ctx, x + 4 * s, y + 9 * s, x + 18 * s, y + 4 * s, { color: '#2b2b2b', width: 1.4, jitter: 1, passes: 1 });
  },

  /* A pair of compasses: spike on the hotspot, hinge up top, pencil leg out
     to the side, opening and closing a little as it idles. */
  compass(ctx, x, y, s, color, t) {
    const open = 0.34 + Math.sin(t * 1.6) * 0.07;
    const L = 26 * s;
    const hx = x + 5 * s, hy = y - L;                    // hinge
    Rough.line(ctx, hx, hy, x, y, { color, width: 2.6, jitter: 0.8 });
    const px = hx + Math.sin(open) * L, py = hy + Math.cos(open) * L;
    Rough.line(ctx, hx, hy, px, py, { color, width: 2.6, jitter: 0.8 });
    Rough.circle(ctx, hx, hy, 3.2 * s, { color: '#2b2b2b', width: 2, jitter: 0.7 });
    // pencil stub on the swinging leg
    Rough.line(ctx, px, py, px + Math.sin(open) * 6 * s, py + Math.cos(open) * 6 * s,
      { color: '#e8cf9a', width: 3.4, jitter: 0.6, passes: 1 });
    Rough.line(ctx, x, y, x + 2 * s, y - 5 * s, { color: '#2b2b2b', width: 2, jitter: 0.5, passes: 1 });
  },

  /* Scissors: blade tips on the hotspot, pivot behind them, handle loops at
     the back. They close while you hold the button. */
  scissor(ctx, x, y, s, color, t, pressed) {
    const open = (pressed ? 0.42 : 1) * (1 + Math.sin(t * 2.2) * 0.06);
    const th = 0.92;                                  // pointing down-right
    const cos = Math.cos(th), sin = Math.sin(th);
    const at = (u, v) => [x + (cos * u - sin * v) * s, y + (sin * u + cos * v) * s];

    for (const side of [-1, 1]) {
      const o = side * open;
      const blade = [at(0, side * 0.6), at(13, o * 6), at(21, o * 3.4), at(20, side * 0.4)];
      Rough.scribble(ctx, blade, { color: '#ccd2d8', spacing: 3.5, width: 3.5, overflow: 1.1 });
      Rough.poly(ctx, blade, { color: '#2b2b2b', width: 1.9, jitter: 0.6 });

      // handle: leg out the back, ending in a finger loop
      const legEnd = at(31, o * 9);
      const loop = at(37, o * 12);
      Rough.line(ctx, at(20, side * 0.4)[0], at(20, side * 0.4)[1], legEnd[0], legEnd[1],
        { color, width: 2.8, jitter: 0.7, passes: 1 });
      Rough.circle(ctx, loop[0], loop[1], 5.5 * s, { color, width: 2.4, jitter: 1 });
    }
    const pivot = at(19, 0);
    Rough.circle(ctx, pivot[0], pivot[1], 2.6 * s, { color: '#2b2b2b', width: 1.8, jitter: 0.5 });
  },

  /* A little storm cloud with the bolt dangling where the arrow tip would be. */
  storm(ctx, x, y, s, color, t) {
    const drift = Math.sin(t * 1.4) * 1.5;
    Rough.blob(ctx, x + 11 * s + drift, y + 7 * s, 8 * s, color, '#2b2b2b', { spacing: 5, fillWidth: 4, sides: 9, width: 2 });
    Rough.blob(ctx, x + 4 * s + drift * 0.6, y + 10 * s, 6 * s, color, '#2b2b2b', { spacing: 4, fillWidth: 3.5, sides: 8, width: 1.8 });
    Rough.blob(ctx, x + 19 * s + drift * 1.3, y + 10 * s, 5.5 * s, color, '#2b2b2b', { spacing: 4, fillWidth: 3.5, sides: 8, width: 1.8 });
    const flick = 0.55 + Math.abs(Math.sin(t * 7)) * 0.45;
    ctx.save();
    ctx.globalAlpha = flick;
    const bolt = [[x + 10 * s, y + 15 * s], [x + 6 * s, y + 23 * s], [x + 11 * s, y + 23 * s], [x + 6 * s, y + 32 * s]];
    Rough.poly(ctx, bolt, { color: '#e8c33a', width: 2.6, jitter: 1, closed: false });
    ctx.restore();
    Rough.line(ctx, x, y, x + 5 * s, y + 5 * s, { color: '#2b2b2b', width: 2, jitter: 0.6, passes: 1 });
  },

  /* A horseshoe magnet, poles down, humming. */
  magnet(ctx, x, y, s, color, t) {
    const cx = x + 11 * s, cy = y + 11 * s, R = 9.5 * s, L = 13 * s;
    // the two legs
    for (const side of [-1, 1]) {
      const lx = cx + side * R;
      const leg = [[lx - 3.4 * s, cy], [lx + 3.4 * s, cy], [lx + 3.4 * s, cy + L], [lx - 3.4 * s, cy + L]];
      Rough.scribble(ctx, leg, { color, spacing: 4, width: 4, overflow: 1.12 });
      Rough.poly(ctx, leg, { color: '#2b2b2b', width: 2, jitter: 0.7 });
      // silver tips
      const tip = [[lx - 3.4 * s, cy + L], [lx + 3.4 * s, cy + L], [lx + 3.4 * s, cy + L + 4 * s], [lx - 3.4 * s, cy + L + 4 * s]];
      Rough.scribble(ctx, tip, { color: '#c6ccd2', spacing: 3, width: 3, overflow: 1.1 });
      Rough.poly(ctx, tip, { color: '#2b2b2b', width: 1.8, jitter: 0.6 });
    }
    // the arch over the top
    const arch = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      arch.push([cx + Math.cos(a) * (R + 3.4 * s), cy + Math.sin(a) * (R + 3.4 * s)]);
    }
    for (let i = 10; i >= 0; i--) {
      const a = Math.PI + (i / 10) * Math.PI;
      arch.push([cx + Math.cos(a) * (R - 3.4 * s), cy + Math.sin(a) * (R - 3.4 * s)]);
    }
    Rough.scribble(ctx, arch, { color, spacing: 4, width: 4, overflow: 1.1 });
    Rough.poly(ctx, arch, { color: '#2b2b2b', width: 2, jitter: 0.8 });
    // the pull, sparking between the poles
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(t * 4)) * 0.45;
    Rough.arc(ctx, cx, cy + L + 3 * s, R * 0.85, Math.PI * 0.15, Math.PI * 0.85,
      { color: '#9fc4cc', width: 2, jitter: 2.4 });
    ctx.restore();
    Rough.line(ctx, x, y, cx - R * 0.6, cy - R * 0.4, { color: '#2b2b2b', width: 2, jitter: 0.6, passes: 1 });
  },

  /* A boomerang, held at the elbow, turning gently. */
  boomerang(ctx, x, y, s, color, t) {
    ctx.save();
    ctx.translate(x + 13 * s, y + 14 * s);
    ctx.rotate(Math.sin(t * 1.5) * 0.25 - 0.4);
    const arm = [[-14 * s, 11 * s], [-4 * s, -13 * s], [3 * s, -13 * s], [2 * s, -2 * s],
    [13 * s, 9 * s], [9 * s, 14 * s], [-9 * s, 15 * s]];
    Rough.scribble(ctx, arm, { color: '#c9a36b', spacing: 4.5, width: 4.5, overflow: 1.14 });
    Rough.poly(ctx, arm, { color: '#5c4326', width: 2.2, jitter: 0.9 });
    // the grain, painted on
    ctx.save();
    ctx.globalAlpha = 0.55;
    Rough.line(ctx, -2 * s, -9 * s, -6 * s, 8 * s, { color, width: 2, jitter: 1, passes: 1 });
    Rough.line(ctx, 3 * s, 2 * s, 9 * s, 8 * s, { color, width: 2, jitter: 1, passes: 1 });
    ctx.restore();
    ctx.restore();
    Rough.line(ctx, x, y, x + 5 * s, y + 5 * s, { color: '#2b2b2b', width: 2, jitter: 0.6, passes: 1 });
  },

  buzz(ctx, x, y, s, color, t) {
    CursorSprites.plain(ctx, x, y, s, color);
    const f = Math.sin(t * 9) * 0.5 + 0.5;
    const b = [[x + 16 * s, y + 4 * s], [x + 11 * s, y + 13 * s], [x + 16 * s, y + 13 * s], [x + 10 * s, y + 24 * s]];
    ctx.save();
    ctx.globalAlpha = 0.5 + f * 0.5;
    Rough.poly(ctx, b, { color: '#e8c33a', width: 2.6, jitter: 1.6, closed: false });
    ctx.restore();
  }
};

/* What the one-shot upgrades leave on the cursor itself: fire around it,
   ink on its tip, chalk dust, an archer at its shoulder. */
const CursorMarks = {
  /* Molten Leftkey: the cursor is on fire. Flames climb off its body and
     rise, it glows from underneath, and it smokes. */
  molten(ctx, x, y, s, t) {
    // heat pooling under it
    ctx.save();
    const glow = ctx.createRadialGradient(x + 8 * s, y + 14 * s, 2, x + 8 * s, y + 14 * s, 30 * s);
    glow.addColorStop(0, 'rgba(224,86,45,0.45)');
    glow.addColorStop(0.5, 'rgba(232,195,58,0.18)');
    glow.addColorStop(1, 'rgba(232,195,58,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x + 8 * s, y + 14 * s, 30 * s, 0, 7); ctx.fill();
    ctx.restore();

    // flames climbing off the body itself - anchored to it, always rising
    const anchors = [[2, 6], [10, 12], [6, 20], [14, 20], [4, 13], [12, 4]];
    for (let i = 0; i < anchors.length; i++) {
      const ax = x + anchors[i][0] * s, ay = y + anchors[i][1] * s;
      const beat = Math.sin(t * 8 + i * 1.9) * 0.5 + 0.5;
      const h = (7 + beat * 9) * s;
      const sway = Math.sin(t * 5 + i) * 3 * s;
      const w = (3.2 + beat * 1.6) * s;
      const tongue = [
        [ax - w, ay],
        [ax - w * 0.35 + sway * 0.4, ay - h * 0.55],
        [ax + sway, ay - h],
        [ax + w * 0.35 + sway * 0.4, ay - h * 0.5],
        [ax + w, ay]
      ];
      ctx.save();
      ctx.globalAlpha = 0.45 + beat * 0.45;
      Rough.scribble(ctx, tongue, { color: '#e0562d', spacing: 4, width: 4, overflow: 1.15, alpha: 0.9 });
      ctx.globalAlpha = 0.5 + beat * 0.5;
      Rough.poly(ctx, tongue.map(p => [p[0], p[1] + h * 0.25]),
        { color: '#e8c33a', width: 2, jitter: 1.6, closed: false });
      ctx.restore();
    }
  },

  /* The part that has to sit on top of the cursor: embers and smoke. */
  moltenOver(ctx, x, y, s, t) {
    Rough.srand(Math.floor(t * 12) + 5);
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const life = (t * 1.6 + i * 0.37) % 1;
      const ex = x + (2 + Rough.rnd() * 14) * s + Math.sin(t * 3 + i) * 4;
      const ey = y + (18 - life * 34) * s;
      ctx.globalAlpha = (1 - life) * 0.9;
      ctx.fillStyle = i % 2 ? '#e8c33a' : '#e0562d';
      const sz = (2.4 - life * 1.4) * s;
      ctx.fillRect(ex, ey, sz, sz);
    }
    // smoke, once the embers have gone cold
    for (let i = 0; i < 3; i++) {
      const life = (t * 0.8 + i * 0.34) % 1;
      ctx.globalAlpha = (1 - life) * 0.1;
      Rough.circle(ctx, x + (6 + i * 3) * s + Math.sin(t * 1.5 + i) * 6, y + (6 - life * 34) * s,
        (2.5 + life * 7) * s, { color: '#8a8a8a', width: 1.4, jitter: 2, wobble: 2 });
    }
    ctx.restore();
  },

  /* Ink Overflow: the tip is permanently stained, and it drips. */
  ink(ctx, x, y, s, t) {
    const blot = Rough.circlePts(x - 1.5 * s, y + 5 * s, 4.2 * s, 1.6 * s, 9);
    ctx.save();
    ctx.globalAlpha = 0.9;
    Rough.scribble(ctx, blot, { color: '#37306b', spacing: 3.5, width: 3.5, overflow: 1.2, alpha: 0.85 });
    Rough.poly(ctx, blot, { color: '#241d4d', width: 1.6, jitter: 1.2 });
    // a bead gathering at the point, falling now and then
    const drip = (t * 0.7) % 1;
    const dy = drip < 0.6 ? drip * 5 : 3 + (drip - 0.6) * 34;
    ctx.globalAlpha = drip < 0.6 ? 0.9 : Math.max(0, 1 - (drip - 0.6) * 2.5);
    Rough.blob(ctx, x - 2 * s, y + 9 * s + dy * s, (2.2 - drip * 0.8) * s, '#37306b', '#241d4d',
      { spacing: 3, fillWidth: 3, sides: 7, width: 1.4 });
    ctx.restore();
  },

};

function drawCursor(ctx, cursor, x, y, charge, pressed, t, marks, ghost, doubleId) {
  const s = 1 - pressed * 0.16;           // squash while held

  // fire and chalk sit behind the cursor, ink and the archer in front
  Rough.boil(998, Math.floor(t * 8));
  if (marks && marks.molten) CursorMarks.molten(ctx, x, y, s, t);

  Rough.boil(999, t * 1.5);
  ctx.save();
  if (doubleId) {
    // Double Trouble: your half on the left, the borrowed half on the right,
    // clipped down the middle of the hotspot
    const other = cursorById(doubleId);
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 60, y - 60, 60 + 9 * s, 130); ctx.clip();
    (CursorSprites[cursor.id] || CursorSprites.plain)(ctx, x, y, s, cursor.color, t, pressed);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 9 * s, y - 60, 70, 130); ctx.clip();
    (CursorSprites[other.id] || CursorSprites.plain)(ctx, x, y, s, other.color, t, pressed);
    ctx.restore();
    // the seam where the two of them meet
    ctx.save();
    ctx.globalAlpha = 0.5;
    Rough.line(ctx, x + 9 * s, y - 4 * s, x + 9 * s, y + 30 * s,
      { color: '#8a5cc4', width: 1.8, jitter: 1.6, passes: 1 });
    ctx.restore();
  } else {
    (CursorSprites[cursor.id] || CursorSprites.plain)(ctx, x, y, s, cursor.color, t, pressed);
  }
  ctx.restore();
  if (ghost) return;                       // the afterimage stops at the outline

  if (marks && marks.ink) {
    Rough.boil(997, Math.floor(t * 6));
    CursorMarks.ink(ctx, x, y, s, t);
  }
  if (marks && marks.molten) CursorMarks.moltenOver(ctx, x, y, s, t);

  // charge ring, filling as the weapon gets closer to firing
  if (cursor.every > 0) {
    const p = (charge % cursor.every) / cursor.every;
    const r = 13;
    ctx.save();
    ctx.globalAlpha = 0.16;
    Rough.circle(ctx, x, y - 2, r, { color: '#9a9a9a', width: 1.6, jitter: 1 });
    ctx.globalAlpha = 0.95;
    if (p > 0.001) {
      Rough.arc(ctx, x, y - 2, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2,
        { color: cursor.color, width: 3, jitter: 1.2, passes: 1 });
    }
    ctx.restore();
  }
}
