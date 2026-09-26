/* FANDHARN - the Protector relic. Worn, small shields circle the cursor -
   one for each Protector held, up to four - and anything a shield runs into
   takes half your click damage. Each shield can only hit the same thing
   once every 0.4s, so it grinds rather than shreds. */

const Protector = {
  angle: 0,
  cool: new Map(),              // `${shield}:${enemy id}` -> seconds until it can hit again
  R: 34,                        // how far out they circle
  HIT: 9,                       // how big a shield is, for touching things
  flash: [0, 0, 0, 0],

  count() { return Relics.val('protector'); },

  reset() { this.cool.clear(); this.flash = [0, 0, 0, 0]; },

  /* Where shield i is, in world coordinates, right now. */
  pos(game, i, n) {
    const c = Depth.toWorld(game, game.pointer.x, game.pointer.y);
    const a = this.angle + (i / n) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * this.R, y: c.y + Math.sin(a) * this.R * 0.85, a };
  },

  update(dt, game) {
    const n = this.count();
    if (!n || game.state !== 'playing' || game.paused || !game.pointer.inside) return;
    this.angle += dt * 3.2;
    for (const [k, v] of this.cool) { if (v - dt <= 0) this.cool.delete(k); else this.cool.set(k, v - dt); }
    for (let i = 0; i < 4; i++) if (this.flash[i] > 0) this.flash[i] -= dt;
    const dmg = game.clickDamage() * 0.5;
    for (let i = 0; i < n; i++) {
      const p = this.pos(game, i, n);
      for (const e of game.enemies) {
        if (e.dead || e.untouchable || e.spawnT < 0.5) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + this.HIT) continue;
        const key = i + ':' + e.id;
        if (this.cool.has(key)) continue;
        this.cool.set(key, 0.4);
        this.flash[i] = 0.15;
        e.hurt(dmg, game, { color: '#4a7fb5' });
        game.effects.push(new HitSpark(p.x, p.y, '#8ec5e8', false));
        Sfx.play('click_hit', { volume: 0.35, throttle: 50, voices: 3, rate: 1.3 });
      }
    }
  },

  /* Drawn on the top layer with the cursor, at the cursor's screen spot. */
  draw(ctx, game) {
    const n = this.count();
    if (!n || !game.pointer.inside || (game.state !== 'playing' && game.state !== 'offers')) return;
    Rough.boil(3131, Math.floor(game.time * 7));
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const x = game.pointer.x + Math.cos(a) * this.R, y = game.pointer.y + Math.sin(a) * this.R * 0.85;
      drawShield(ctx, x, y, 1, a + Math.PI / 2, this.flash[i] > 0);
    }
  }
};

/* A little heater shield, point down, turned to face along its orbit. */
function drawShield(ctx, x, y, s, rot, lit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(rot) * 0.35);
  const pts = [[-7 * s, -8 * s], [7 * s, -8 * s], [7 * s, 0], [3.5 * s, 6 * s], [0, 9 * s], [-3.5 * s, 6 * s], [-7 * s, 0]];
  if (lit || !Fx.low) Rough.bloom(ctx, 0, 0, lit ? 22 * s : 13 * s, '#8ec5e8', lit ? 0.9 : 0.35);
  Rough.scribble(ctx, pts, { color: lit ? '#dfefff' : '#4a7fb5', spacing: 2.5, width: 2.6, overflow: 1.1 });
  Rough.poly(ctx, pts, { color: '#1f3350', width: 1.8, jitter: 0.3 });
  Rough.line(ctx, 0, -7 * s, 0, 7 * s, { color: '#e8c33a', width: 1.8, jitter: 0.2, passes: 1 });
  Rough.line(ctx, -6 * s, -2 * s, 6 * s, -2 * s, { color: '#e8c33a', width: 1.8, jitter: 0.2, passes: 1 });
  ctx.restore();
}
