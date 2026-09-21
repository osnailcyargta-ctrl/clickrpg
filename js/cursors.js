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
    const dmg = game.aoeDamage(2);
    for (let i = 0; i < 6; i++) {
      const a = NINE_DIRS[Math.floor(Math.random() * NINE_DIRS.length)] + (Math.random() - 0.5) * 0.12;
      game.effects.push(new WaterDrop(x, y, a, game, r, dmg));
    }
  },

  eraser(game, x, y) {
    game.effects.push(new EraseBurst(x, y, BLOCK * 1.5 * game.aoeScale(), game));
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
      if (!e.dead) e.stun = Math.max(e.stun, 0.35);
    }
    if (pts.length > 1) game.effects.push(new Bolt(pts));
    else game.effects.push(new Bolt([[x, y], [x + Rough.jit(34), y + Rough.jit(34)]]));
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

function drawCursor(ctx, cursor, x, y, charge, pressed, t) {
  const s = 1 - pressed * 0.16;           // squash while held
  Rough.boil(999, t * 1.5);
  ctx.save();
  ctx.globalAlpha = 1;
  (CursorSprites[cursor.id] || CursorSprites.plain)(ctx, x, y, s, cursor.color, t);
  ctx.restore();

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
