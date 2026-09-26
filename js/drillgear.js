/* FANDHARN - what the Sentry Drill looks like on whoever holds the post.

   The Drill has always changed what a sentry does; now it changes how it
   looks too, so you can tell at a glance that the post has been upgraded:
   the stick figure (and Zeus) wear a hard hat and nock drill-tipped arrows,
   the Blob'd-Tier grows a spinning drill horn, the Electric Bird's beak is a
   drill bit, the Trapper sprouts one out of its crown. The Moleman already
   carries a drill - his gets bigger and hotter, and he puts a hat on.

   Drawing only, laid over each sentry after it draws itself. */

function drillOn() { return typeof Game !== 'undefined' && Game.oneshot && !!Game.oneshot.drill; }

/* A drill bit: a cone from its base at (x, y) out along angle a, with
   spiral grooves that crawl along it as it turns. */
function drawDrillBit(ctx, x, y, a, len, w, t, o) {
  o = o || {};
  const c = Math.cos(a), s = Math.sin(a), px = -s, py = c;
  const tip = [x + c * len, y + s * len];
  const cone = [[x + px * w / 2, y + py * w / 2], tip, [x - px * w / 2, y - py * w / 2]];
  if (o.glow && !Fx.low) Rough.bloom(ctx, tip[0], tip[1], len * 0.9, '#ffb347', o.glow);
  Rough.scribble(ctx, cone, { color: o.color || '#b8bcc4', spacing: 2, width: 2.4, overflow: 1.1, alpha: o.alpha });
  // grooves: slanted cuts across the cone, sliding tipward as it spins
  const n = 4, off = (t * (o.speed || 6)) % 1;
  for (let i = 0; i < n; i++) {
    const u = (i + off) / n;                      // 0 at the base, 1 at the tip
    const half = (w / 2) * (1 - u);
    const bx = x + c * len * u, by = y + s * len * u;
    Rough.line(ctx, bx + px * half, by + py * half, bx + c * len * 0.12 - px * half, by + s * len * 0.12 - py * half,
      { color: '#4a4f5a', width: 1.2, jitter: 0.2, passes: 1, alpha: o.alpha });
  }
  Rough.poly(ctx, cone, { color: '#2b2b2b', width: 1.5, jitter: 0.3, alpha: o.alpha });
  // the collar it is chucked into
  Rough.line(ctx, x + px * w * 0.6, y + py * w * 0.6, x - px * w * 0.6, y - py * w * 0.6,
    { color: o.collar || '#d99a26', width: 3, jitter: 0.3, passes: 1, alpha: o.alpha });
}

/* A yellow hard hat with a lamp on the front, sat on a head at (x, y). */
function drawHardHat(ctx, x, y, s, facing) {
  const dome = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    dome.push([x + Math.cos(a) * 6.5 * s, y + Math.sin(a) * 5.5 * s]);
  }
  Rough.scribble(ctx, dome, { color: '#e8b52e', spacing: 2.5, width: 2.6, overflow: 1.08 });
  Rough.poly(ctx, dome, { color: '#2b2b2b', width: 1.5, jitter: 0.3 });
  Rough.line(ctx, x - 8.5 * s, y, x + 8.5 * s, y, { color: '#2b2b2b', width: 2.2, jitter: 0.3, passes: 1 });
  Rough.line(ctx, x, y - 5.5 * s, x, y - 1 * s, { color: '#b5871e', width: 1.4, jitter: 0.2, passes: 1 });
  const lx = x + (facing || 1) * 4 * s, ly = y - 2.5 * s;
  if (!Fx.low) Rough.bloom(ctx, lx, ly, 8 * s, '#fff1b0', 0.6);
  Rough.circle(ctx, lx, ly, 1.8 * s, { color: '#2b2b2b', width: 1.2, jitter: 0.2, wobble: 0.2 });
}

(function () {
  const baseDraw = Sentry.prototype.draw;
  Sentry.prototype.draw = function (ctx, t) {
    baseDraw.call(this, ctx, t);
    if (!drillOn()) return;
    if (this.type === 'stick') {
      const y = this.y + Math.sin(t * 2 + this.bob) * 1.5;
      const facing = Math.cos(this.aim) >= 0 ? 1 : -1;
      if (sentryLook('stick')) {                      // Zeus: hat over the wreath
        drawHardHat(ctx, this.x, y - 17, 1, facing);
        return;
      }
      drawHardHat(ctx, this.x, y - 16.5, 1, facing);
      // a drill-tipped arrow nocked on the bow
      const pull = E.pop(this.recoil) * 3;
      const ax = this.x + Math.cos(this.aim) * (11 - pull), ay = y - 2 + Math.sin(this.aim) * (11 - pull);
      drawDrillBit(ctx, ax, ay, this.aim, 8, 4.5, t, { speed: 3 });
    } else if (this.type === 'blobd') {
      const y = this.y + Math.sin(t * 2.4 + this.wob) * 1.8;
      drawDrillBit(ctx, this.x, y - 11, -Math.PI / 2, 13, 8, t, { speed: 4, glow: 0.25 });
      // a steel collar with rivets instead of the leather one
      Rough.arc(ctx, this.x, y + 13 * 0.35, 13 * 0.8, 0.3, Math.PI - 0.3, { color: '#8a8f96', width: 3, jitter: 0.8 });
      for (let i = 0; i < 3; i++) {
        const a = 0.7 + i * 0.85;
        Rough.circle(ctx, this.x + Math.cos(a) * 10.4, y + 4.5 + Math.sin(a) * 10.4, 0.9, { color: '#2b2b2b', width: 1.2, jitter: 0.1, wobble: 0.1 });
      }
    } else if (this.type === 'bird') {
      const flying = !!this.dash;
      const y = this.y + (flying ? 0 : Math.sin(t * 3.4 + this.wob) * 2);
      const a = this.dash ? Math.atan2(this.dash.toY - this.dash.fromY, this.dash.toX - this.dash.fromX) : this.aim;
      drawDrillBit(ctx, this.x + Math.cos(a) * 8, y + Math.sin(a) * 8, a, 10, 5, t, { speed: flying ? 14 : 5, glow: flying ? 0.5 : 0.15 });
    } else if (this.type === 'trapper' && !sentryLook('trapper')) {
      const s = this.trapState();
      if (s.mode !== 'idle' && s.mode !== 'sink' && s.mode !== 'rise') return;
      const k = E.clamp01(s.t / (s.dur || 1));
      const up = s.mode === 'idle' ? 1 : s.mode === 'sink' ? 1 - E.inOut(k) : E.back(k);
      if (up <= 0.05) return;
      const h = 18 * 0.9 * up;
      const cx = s.px + Math.cos(s.face) * 18 * 0.25 * up;
      drawDrillBit(ctx, cx, s.py - h - 8, -Math.PI / 2, 11 * up, 7 * up, t, { speed: 4 });
    }
  };

  const baseOver = Sentry.prototype.drawTrapperOver;
  Sentry.prototype.drawTrapperOver = function (ctx, t) {
    baseOver.call(this, ctx, t);
    if (!drillOn() || sentryLook('trapper')) return;
    const s = this.trapState();
    if (s.mode !== 'burst' && s.mode !== 'chew') return;
    const k = E.clamp01(s.t / (s.dur || 1));
    const up = s.mode === 'burst' ? E.back(k) : 1;
    drawDrillBit(ctx, s.px, s.py - 28 * 0.3 * up - 14, -Math.PI / 2, 14 * up, 9 * up, t, { speed: 12, glow: 0.5 });
  };

  // the stick sentry's arrows fly drill-first
  const baseArrow = Arrow.prototype.draw;
  Arrow.prototype.draw = function (ctx) {
    baseArrow.call(this, ctx);
    if (!drillOn() || this instanceof ZeusBolt) return;
    drawDrillBit(ctx, this.x - Math.cos(this.a || 0) * 2, this.y - Math.sin(this.a || 0) * 2, this.a || 0, 7, 4.5, performance.now() / 1000, { speed: 10 });
  };
})();
