/* FANDHARN - doctor's handwriting.

   What the bestiary shows for anything you have not earned the right to
   read: every word turned into one continuous pen stroke - a big looping
   capital, then lazy humps and loops and long flat runs, a descender here, a
   zigzag there, a hooked tail - lifting the pen only at the spaces. Each
   word's scrawl is grown from the word itself, so it is the same every time
   you look but no two words look alike, and a long word makes a long scrawl. */

const Scrawl = {
  /* A canvas `width` CSS pixels wide with `text` scrawled across it,
     wrapped onto as many lines as it needs. */
  render(text, width, size, color) {
    size = size || 15;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const words = String(text).split(/\s+/).filter(Boolean);
    const lineH = size * 1.55;
    // lay the words out first, each scrawl roughly as long as the word would be
    let rnd = this.rng(this.hash(text));
    const laid = [];
    let x = 0, line = 0;
    for (let i = 0; i < words.length; i++) {
      const w = Math.max(size * 0.8, words[i].length * size * (0.46 + rnd() * 0.16));
      if (x > 0 && x + w > width - 4) { x = 0; line++; }
      laid.push({ word: words[i], x, w, line, seed: this.hash(words[i] + ':' + i + ':' + text.length) });
      x += w + size * (0.45 + rnd() * 0.3);
    }
    const lines = line + 1;
    const cv = document.createElement('canvas');
    cv.className = 'scrawl';
    cv.width = Math.round(width * dpr);
    cv.height = Math.round((lines * lineH + size * 0.4) * dpr);
    cv.style.width = width + 'px';
    cv.style.height = (lines * lineH + size * 0.4) + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const l of laid) this.word(ctx, l.x + 2, l.line * lineH + size * 1.05, l.w, size, l.seed, color);
    return cv;
  },

  /* One word: a single stroke from left to right, built from a run of
     letter-like moves chosen at random. */
  word(ctx, x0, base, w, size, seed, color) {
    const rnd = this.rng(seed);
    const xh = size * 0.42;                        // how tall a small letter is
    const pts = [];
    const add = (x, y) => pts.push([x, y]);
    let x = x0, y = base;

    // the capital: a big loop that the rest of the word trails off
    const capH = size * (0.75 + rnd() * 0.35);
    add(x, y - capH * 0.25);
    this.loop(add, x + size * 0.12, y - capH * 0.55, size * 0.18, capH * 0.5, rnd() < 0.5);
    x += size * 0.3; add(x, y);

    const end = x0 + w - size * 0.35;
    while (x < end) {
      const room = end - x;
      const r = rnd();
      if (r < 0.3) {                                // a lazy flat run, barely moving
        const len = Math.min(room, size * (0.5 + rnd() * 1.4));
        const n = 6;
        for (let i = 1; i <= n; i++) add(x + (len * i) / n, y - Math.sin(i / n * Math.PI) * xh * 0.15 * rnd());
        x += len;
      } else if (r < 0.55) {                        // humps: n, m
        const humps = 1 + Math.floor(rnd() * 3), hw = size * (0.18 + rnd() * 0.12);
        for (let k = 0; k < humps && x < end; k++) {
          for (let i = 1; i <= 6; i++) add(x + (hw * i) / 6, y - Math.sin(i / 6 * Math.PI) * xh * (0.7 + rnd() * 0.5));
          x += hw;
        }
      } else if (r < 0.7) {                         // a tall loop: l, h, b
        this.loop(add, x + size * 0.1, y - size * 0.5, size * 0.09, size * (0.45 + rnd() * 0.3), true);
        x += size * 0.22; add(x, y);
      } else if (r < 0.8) {                         // something hanging below: g, y
        this.loop(add, x + size * 0.1, y + size * 0.3, size * 0.1, size * (0.35 + rnd() * 0.2), false);
        x += size * 0.22; add(x, y);
      } else if (r < 0.9) {                         // a small e-loop
        this.loop(add, x + size * 0.08, y - xh * 0.45, size * 0.07, xh * 0.4, true);
        x += size * 0.16; add(x, y);
      } else {                                      // a zigzag: w, v
        const zw = size * (0.25 + rnd() * 0.2);
        add(x + zw * 0.25, y - xh * 0.8); add(x + zw * 0.5, y); add(x + zw * 0.75, y - xh * 0.8); add(x + zw, y - xh * 0.2);
        x += zw;
      }
      y = base + (rnd() - 0.5) * size * 0.08;         // the baseline wanders
    }
    // the tail: a hook off the end, up or down
    if (rnd() < 0.6) { add(x + size * 0.15, y - xh * 0.9); add(x + size * 0.25, y - xh * 0.5); }
    else { add(x + size * 0.2, y + size * 0.2); add(x + size * 0.1, y + size * 0.32); }

    // a bit of hand shake over the whole thing
    for (const p of pts) { p[0] += (rnd() - 0.5) * 0.9; p[1] += (rnd() - 0.5) * 0.9; }
    ctx.save();
    ctx.strokeStyle = color || '#2b2b2b';
    ctx.lineWidth = Math.max(1.3, size * 0.1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {        // smoothed, the way a pen actually moves
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
    // doctors dot their i's somewhere near where an i might have been
    if (rnd() < 0.5) {
      ctx.beginPath(); ctx.arc(x0 + w * (0.3 + rnd() * 0.5), base - size * 0.72, 1.1, 0, 7); ctx.fillStyle = color || '#2b2b2b'; ctx.fill();
    }
    ctx.restore();
  },

  /* A loop: up the right side and back down the left (or the reverse,
     hanging down), centred on cx, cy. */
  loop(add, cx, cy, rw, rh, upward) {
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const a = (upward ? Math.PI / 2 : -Math.PI / 2) + (i / n) * Math.PI * 2;
      add(cx + Math.cos(a) * rw, cy + Math.sin(a) * rh * 0.5);
    }
  },

  hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  rng(seed) {
    let a = seed || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
};
