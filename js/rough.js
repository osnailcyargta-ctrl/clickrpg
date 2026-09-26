/* FANDHARN - crayon / doodle rendering helpers.
   Everything is drawn with wobbly multi-pass strokes and scribble fills so the
   whole game looks like it was drawn on paper with cheap wax crayons. */
const HAND_FONT = '"Gloria Hallelujah", "Patrick Hand", "Comic Sans MS", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive';

const Rough = (function () {
  let seed = 1;

  function srand(s) {
    seed = Math.floor(Math.abs(s)) % 2147483647;
    if (seed <= 0) seed += 2147483646;
  }
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  function jit(a) { return (rnd() - 0.5) * 2 * a; }

  // Boil: re-seed from an id + a slow clock so a shape wobbles like hand-drawn
  // animation instead of vibrating every single frame.
  function boil(id, time) { srand(id * 7919 + Math.floor(time * 7) * 104729); }

  function tracePoly(ctx, pts, scale, cx, cy) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = cx + (pts[i][0] - cx) * scale;
      const y = cy + (pts[i][1] - cy) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function centroid(pts) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    return [cx / pts.length, cy / pts.length];
  }

  /* A single wobbly stroke, drawn a couple of times with different jitter. */
  /* NB: strokes set their alpha from `o.alpha`, they do not multiply into
     the ctx.globalAlpha they were called at - a wrapper fade is ignored. Every
     visual in the game was tuned by eye against that, so it stays; anything
     that wants to fade passes `alpha` explicitly. */
  function line(ctx, x1, y1, x2, y2, o) {
    o = o || {};
    const w = o.width || 2.2, passes = o.passes || 2, j = o.jitter == null ? 1.6 : o.jitter;
    ctx.save();
    ctx.strokeStyle = o.color || '#2b2b2b';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const segs = Math.max(2, Math.round(len / 14));
    for (let p = 0; p < passes; p++) {
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = x1 + (x2 - x1) * t + jit(j);
        const y = y1 + (y2 - y1) * t + jit(j);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Wobbly outline through a list of points. `progress` (0..1) draws only part
     of the perimeter, which is what the wave-clear boxes animate with. */
  function poly(ctx, pts, o) {
    o = o || {};
    const closed = o.closed !== false;
    const list = closed ? pts.concat([pts[0]]) : pts;
    let total = 0;
    const segLen = [];
    for (let i = 0; i < list.length - 1; i++) {
      const l = Math.hypot(list[i + 1][0] - list[i][0], list[i + 1][1] - list[i][1]);
      segLen.push(l); total += l;
    }
    const want = total * (o.progress == null ? 1 : Math.max(0, Math.min(1, o.progress)));
    let walked = 0;
    for (let i = 0; i < list.length - 1; i++) {
      if (walked >= want) break;
      const remain = want - walked;
      const t = Math.min(1, remain / (segLen[i] || 1));
      line(ctx, list[i][0], list[i][1],
        list[i][0] + (list[i + 1][0] - list[i][0]) * t,
        list[i][1] + (list[i + 1][1] - list[i][1]) * t, o);
      walked += segLen[i];
    }
  }

  function circlePts(x, y, r, wobble, n) {
    n = n || Math.max(10, Math.round(r / 2.2));
    wobble = wobble == null ? r * 0.08 : wobble;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r + jit(wobble);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    return pts;
  }

  function circle(ctx, x, y, r, o) {
    poly(ctx, circlePts(x, y, r, o && o.wobble), o);
  }

  function rectPts(x, y, w, h) {
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }

  /* Crayon fill: short diagonal strokes that deliberately spill past the
     outline (overflow > 1) with uneven pressure, like colouring in a hurry.
     `progress` reveals the strokes one by one. */
  function scribble(ctx, pts, o) {
    o = o || {};
    const overflow = o.overflow == null ? 1.07 : o.overflow;
    const spacing = o.spacing || 7;
    const angle = o.angle == null ? -0.6 : o.angle;
    const progress = o.progress == null ? 1 : Math.max(0, Math.min(1, o.progress));
    if (progress <= 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const [cx, cy] = centroid(pts);
    const diag = Math.hypot(maxX - minX, maxY - minY) * overflow + spacing * 2;

    ctx.save();
    tracePoly(ctx, pts, overflow, cx, cy);
    ctx.clip();
    ctx.strokeStyle = o.color || '#e0562d';
    ctx.lineCap = 'round';
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const count = Math.max(1, Math.round(diag / spacing));
    const shown = Math.round(count * progress);
    for (let i = 0; i < shown; i++) {
      const off = -diag / 2 + i * spacing;
      const mx = cx + -sin * off, my = cy + cos * off;
      const half = diag / 2;
      ctx.globalAlpha = (o.alpha == null ? 0.85 : o.alpha) * (0.55 + rnd() * 0.45);
      ctx.lineWidth = (o.width || 5) * (0.7 + rnd() * 0.6);
      ctx.beginPath();
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const t = -half + (half * 2) * (s / steps);
        const x = mx + cos * t + jit(3.2);
        const y = my + sin * t + jit(3.2);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Convenience: coloured blob with crayon guts and an inked outline. */
  function blob(ctx, x, y, r, fill, stroke, o) {
    o = o || {};
    const pts = circlePts(x, y, r, o.wobble == null ? r * 0.12 : o.wobble, o.sides);
    if (fill) scribble(ctx, pts, { color: fill, spacing: o.spacing || 6, width: o.fillWidth || 5, overflow: o.overflow || 1.1, alpha: o.fillAlpha });
    poly(ctx, pts, { color: stroke || '#2b2b2b', width: o.width || 2.4, jitter: o.jitter == null ? 1.1 : o.jitter, alpha: o.alpha });
    return pts;
  }

  /* `halo` is the edge drawn round the letters so they read over a drawing:
     paper by default, or something dark for light letters on a dark ground */
  function text(ctx, str, x, y, size, color, align, halo) {
    ctx.save();
    ctx.font = size + 'px ' + HAND_FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = halo || 'rgba(255,253,244,0.9)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color || '#2b2b2b';
    ctx.fillText(str, x, y);
    ctx.restore();
  }


  /* A closed ring with layered noise on its radius, so the edge reads as
     hand-drawn ground rather than a compass circle. */
  function noisyRing(x, y, radius, seedVal, n, amount) {
    srand(seedVal);
    n = n || 80;
    amount = amount == null ? 0.14 : amount;
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const wob = Math.sin(a * 3 + ph[0]) * 0.55
        + Math.sin(a * 5 + ph[1]) * 0.3
        + Math.sin(a * 9 + ph[2]) * 0.15;
      const rr = radius * (1 + wob * amount);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    return pts;
  }

  /* Crayon grain: sparse dots that break up a flat fill. */
  function grain(ctx, pts, color, density, seedVal) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    srand(seedVal || 1234);
    ctx.save();
    tracePoly(ctx, pts, 1, (minX + maxX) / 2, (minY + maxY) / 2);
    ctx.clip();
    ctx.fillStyle = color;
    const n = Math.round((maxX - minX) * (maxY - minY) * (density || 0.0025));
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.05 + rnd() * 0.16;
      const s = 1 + rnd() * 2;
      ctx.fillRect(minX + rnd() * (maxX - minX), minY + rnd() * (maxY - minY), s, s);
    }
    ctx.restore();
  }

  /* Crayon progress arc - used for cursor charge. */
  function arc(ctx, x, y, r, from, to, o) {
    o = o || {};
    const steps = Math.max(3, Math.round(Math.abs(to - from) * r / 4));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = from + (to - from) * (i / steps);
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    poly(ctx, pts, Object.assign({ closed: false }, o));
  }

  function wrap(ctx, str, size, maxWidth) {
    ctx.save();
    ctx.font = size + 'px ' + HAND_FONT;
    const words = String(str).split(' ');
    const lines = [];
    let line = '';
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = wd; }
      else line = test;
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  /* Additive glow. Crayon on paper has no light of its own, so anything that
     is supposed to be BRIGHT - lightning, static, a magnet letting go - gets
     one of these underneath it. */
  /* Bloom is drawn from a pre-rendered sprite per colour rather than a fresh
     radial gradient every call. It looks the same, and a TV browser can stamp
     a cached image far faster than it can build and fill a gradient - which
     is what lets the game afford a lot more of them. */
  const bloomCache = {};
  const BLOOM_RES = 96;
  function bloomSprite(color) {
    let c = bloomCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = BLOOM_RES;
    const g2 = c.getContext('2d');
    const h = BLOOM_RES / 2;
    const g = g2.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = g;
    g2.fillRect(0, 0, BLOOM_RES, BLOOM_RES);
    bloomCache[color] = c;
    return c;
  }

  function bloom(ctx, x, y, r, color, alpha) {
    if (!(r > 0.5)) return;
    const a = (alpha == null ? 0.5 : alpha) * 0.55;
    if (a <= 0.004) return;
    // absolute alpha, like the strokes and like the gradient version always
    // was - callers were tuned against that, so this stays a pure speed-up
    const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(bloomSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  }

  /* Darkened edges, so the middle of the page is where you look. */
  function vignette(ctx, w, h, strength, tint) {
    if (strength <= 0.005) return;
    ctx.save();
    ctx.globalAlpha = strength;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28,
      w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, tint || 'rgba(16,12,20,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // easings, for animation that lands softly instead of snapping
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3),
    outQuint: t => 1 - Math.pow(1 - t, 5),
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    pop: t => Math.sin(t * Math.PI),
    clamp01: v => v < 0 ? 0 : (v > 1 ? 1 : v),
    // full strength for the first `keep` of a life, then an eased fade out -
    // the curve for anything that should land hard and then go
    hold: (t, keep) => t <= keep ? 1 : Math.max(0, 1 - Math.pow((t - keep) / (1 - keep), 1.6))
  };

  return { srand, rnd, jit, boil, line, poly, circle, circlePts, rectPts, scribble, blob, text, centroid, noisyRing, grain, arc, wrap, ease, bloom, vignette };
})();
