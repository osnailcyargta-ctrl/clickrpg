/* FANDHARN - cursor weapons. Whatever cursor you hold IS your weapon, so only
   one can ever be active. Each one charges on its own click counter. */

// The Wet Cursor scatters its drops across 9 fixed directions, picked at random.
const NINE_DIRS = [];
for (let i = 0; i < 9; i++) NINE_DIRS.push((i / 9) * Math.PI * 2);

const CursorPowers = {
  plain: null,

  wet(game, x, y) {
    for (let i = 0; i < 6; i++) {
      const a = NINE_DIRS[Math.floor(Math.random() * NINE_DIRS.length)] + (Math.random() - 0.5) * 0.12;
      game.effects.push(new WaterDrop(x, y, a, game));
    }
  },

  graphite(game, x, y) {
    const prev = game.prevClick || { x: x - BLOCK, y: y - BLOCK };
    game.effects.push(new ScribbleLine(prev.x, prev.y, x, y));
  },

  eraser(game, x, y) {
    game.effects.push(new EraseBurst(x, y, BLOCK * 1.5, game));
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
      e.hurt(3, game, { color: '#b99a1c' });
      if (!e.dead) e.stun = Math.max(e.stun, 0.35);
    }
    if (pts.length > 1) game.effects.push(new Bolt(pts));
    else game.effects.push(new Bolt([[x, y], [x + Rough.jit(30), y + Rough.jit(30)]]));
  }
};

function cursorById(id) {
  return CURSORS.find(c => c.id === id) || CURSORS[0];
}

/* The pointer itself, drawn as a doodle, with charge pips underneath. */
function drawCursor(ctx, cursor, x, y, charge, need, pressed) {
  const s = pressed ? 0.85 : 1;
  Rough.boil(999, 0);
  const tip = [[x, y], [x + 13 * s, y + 13 * s], [x + 6 * s, y + 14 * s], [x + 10 * s, y + 22 * s],
  [x + 6 * s, y + 24 * s], [x + 2.5 * s, y + 16 * s], [x - 1 * s, y + 20 * s]];
  Rough.scribble(ctx, tip, { color: cursor.color, spacing: 4, width: 4, overflow: 1.2, alpha: 0.9 });
  Rough.poly(ctx, tip, { color: '#2b2b2b', width: 2, jitter: 0.7 });

  if (need > 0) {
    const pipR = 2.6, span = Math.min(need, 15);
    const startX = x - (span - 1) * 7 / 2;
    for (let i = 0; i < span; i++) {
      ctx.save();
      const on = i < (charge % need);
      ctx.globalAlpha = on ? 0.95 : 0.25;
      ctx.fillStyle = on ? cursor.color : '#8a8a8a';
      ctx.beginPath();
      ctx.arc(startX + i * 7, y - 12, pipR, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }
}
