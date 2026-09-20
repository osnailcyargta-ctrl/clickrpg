/* FANDHARN - the between-wave flourish: three boxes get drawn, then coloured
   in with crayon that spills a little past the outline, one stroke at a time. */

class WaveClear {
  constructor(wave, scribbles, hp, maxHp, isFinal) {
    this.t = 0;
    this.id = nextId();
    this.done = false;
    this.boxes = [
      { label: isFinal ? 'CLEARED' : 'WAVE', value: isFinal ? 'ALL 5' : (wave + ' / ' + WAVES_PER_RUN), color: '#4c9f70' },
      { label: 'SCRIBBLES', value: '+' + scribbles, color: '#d99a26' },
      { label: 'CASTLE', value: hp + ' / ' + maxHp, color: hp === maxHp ? '#3f97c9' : '#c8433a' }
    ];
    this.outlineStart = 0.15; this.outlineDur = 0.7; this.outlineStagger = 0.3;
    this.fillStart = 1.15; this.fillDur = 0.95; this.fillStagger = 0.45;
    this.total = this.fillStart + this.fillStagger * 2 + this.fillDur + 0.75;
  }

  skip() { this.t = Math.max(this.t, this.total - 0.35); }

  update(dt) {
    this.t += dt;
    if (this.t >= this.total) this.done = true;
    return !this.done;
  }

  draw(ctx, w, h, time) {
    const bw = Math.min(150, w * 0.24), bh = bw * 1.15, gap = bw * 0.22;
    const totalW = bw * 3 + gap * 2;
    const x0 = (w - totalW) / 2, y0 = h / 2 - bh / 2;

    ctx.save();
    ctx.globalAlpha = Math.min(0.72, this.t * 2);
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const headerA = Math.min(1, Math.max(0, (this.t - 0.05) * 3));
    ctx.save();
    ctx.globalAlpha = headerA;
    Rough.text(ctx, 'WAVE CLEAR', w / 2, y0 - bh * 0.42, Math.min(46, w * 0.08), '#2b2b2b');
    ctx.restore();

    for (let i = 0; i < 3; i++) {
      const b = this.boxes[i];
      const bx = x0 + i * (bw + gap);
      Rough.boil(this.id * 31 + i, time);
      const pts = [
        [bx, y0], [bx + bw, y0], [bx + bw, y0 + bh], [bx, y0 + bh]
      ].map(p => [p[0] + Rough.jit(2.5), p[1] + Rough.jit(2.5)]);

      const op = clamp01((this.t - (this.outlineStart + i * this.outlineStagger)) / this.outlineDur);
      const fp = clamp01((this.t - (this.fillStart + i * this.fillStagger)) / this.fillDur);

      // opaque paper first, so the battlefield doesn't show through the crayon
      if (op > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, op * 2);
        ctx.fillStyle = '#fffdf4';
        ctx.fillRect(bx - 2, y0 - 2, bw + 4, bh + 4);
        ctx.restore();
      }

      // crayon goes down first so the ink outline still reads on top
      if (fp > 0) {
        Rough.boil(this.id * 97 + i, 0);   // frozen seed: strokes stay put as they accumulate
        Rough.scribble(ctx, pts, {
          color: b.color, spacing: 8, width: 7,
          overflow: 1.16,                   // <- the deliberate spill past the outline
          angle: -0.6 + i * 0.35, progress: fp, alpha: 0.8
        });
      }
      Rough.boil(this.id * 31 + i, time);
      if (op > 0) Rough.poly(ctx, pts, { color: '#2b2b2b', width: 3, jitter: 1.6, progress: op });

      if (fp > 0.55) {
        ctx.save();
        ctx.globalAlpha = clamp01((fp - 0.55) / 0.35);
        Rough.text(ctx, b.label, bx + bw / 2, y0 + bh * 0.34, Math.max(11, bw * 0.13), '#2b2b2b');
        Rough.text(ctx, b.value, bx + bw / 2, y0 + bh * 0.62, Math.max(16, bw * 0.2), '#2b2b2b');
        ctx.restore();
      }
    }

    if (this.t > this.total - 0.9) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.3;
      Rough.text(ctx, 'tap to continue', w / 2, y0 + bh * 1.42, 16, '#6b6b6b');
      ctx.restore();
    }
  }
}

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
