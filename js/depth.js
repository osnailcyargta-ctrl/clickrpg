/* FANDHARN - depth. The page is drawn as a few stacked layers, not one flat
   sheet, and the camera leans a little toward wherever the cursor is:

     paper      the sheet itself                       barely moves
     ground     the lawn, stains, frost, holes          moves a little
     actors     castle, enemies, sentry, every effect   moves more
     top        the cursor, and the buttons             stays under your hand

   Nearer layers slide further, so the world has thickness. Things standing
   on the ground cast a shadow onto it, and the cursor casts one onto the
   world below it - higher when you let go, closer when you press. Clicks go
   through the same shift as the drawing, so what you see is what you hit. */

const Depth = {
  cx: 0, cy: 0,                  // the camera's lean, -1..1 each way, eased
  PAPER: 4, GROUND: 9, ACTORS: 20,
  last: 0,

  update(game) {
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    let tx = 0, ty = 0;
    if (game.pointer && game.pointer.inside && game.w && game.h) {
      tx = Math.max(-1, Math.min(1, (game.pointer.x - game.w / 2) / (game.w / 2)));
      ty = Math.max(-1, Math.min(1, (game.pointer.y - game.h / 2) / (game.h / 2)));
    }
    const k = 1 - Math.exp(-dt * 4);
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
  },

  /* How far a layer is shifted on screen. The camera leans toward the
     cursor, so the world slides the other way. */
  off(amount) {
    if (typeof Settings !== 'undefined' && !Settings.data.parallax) return { x: 0, y: 0 };
    return { x: -this.cx * amount, y: -this.cy * amount };
  },

  /* A world point under a screen point, on the actors' layer. */
  toWorld(game, sx, sy) {
    const o = this.off(this.ACTORS);
    return { x: sx - game.w / 2 - o.x, y: sy - game.h / 2 - o.y };
  },

  /* Soft shadows on the ground for everything standing on it. Drawn on the
     ground layer, so as the camera leans they slide out from under the
     things casting them. */
  shadows(ctx, game) {
    if (Fx.low) return;
    ctx.save();
    ctx.fillStyle = '#2b2b2b';
    const sx = 4, sy = 6;                                      // light from the top left
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.ellipse(sx, game.castleRadius * 0.55 + sy, game.castleRadius * 1.05, game.castleRadius * 0.4, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.13;
    for (const e of game.enemies) {
      if (e.dead || e.spawnT < 0.2) continue;
      const k = Math.min(1, e.spawnT);
      ctx.beginPath(); ctx.ellipse(e.x + sx, e.y + e.r * 0.75 + sy, e.r * 0.95 * k, e.r * 0.36 * k, 0, 0, 7); ctx.fill();
    }
    if (game.sentry) {
      const s = game.sentry;
      ctx.beginPath(); ctx.ellipse(s.x + sx, s.y + 14 + sy, 12, 4.5, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  },

  /* The cursor's shadow on the world: a flat dark copy of it, set off down
     and to the right - further while it hovers, closer while pressed. */
  shadowCv: null,
  cursorShadow(ctx, game) {
    if (Fx.low) return;
    const S = 150;
    if (!this.shadowCv) { this.shadowCv = document.createElement('canvas'); this.shadowCv.width = this.shadowCv.height = S; }
    const g = this.shadowCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, S, S);
    drawCursor(g, cursorById(game.cursorId), 40, 40, 0, game.pointer.down > 0 ? 1 : 0, game.time, null, false,
      game.oneshot.double ? game.doubleId : null);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#2b2b2b';
    g.fillRect(0, 0, S, S);
    const lift = game.hold ? 1 + Math.min(1, game.hold.t / HAMMER_MAX) * 0.8 : 1;
    const h = (game.pointer.down > 0 ? 5 : 14) * lift;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.drawImage(this.shadowCv, game.pointer.x - 40 + h * 0.8, game.pointer.y - 40 + h, S, S);
    ctx.restore();
  }
};
