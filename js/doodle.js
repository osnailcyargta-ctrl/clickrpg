/* FANDHARN - crayon frames for the DOM screens.

   The menus are HTML (so text and taps just work), but they must look like
   the rest of the game: straight crayon lines with a little wobble, colour
   scribbled in and spilling past the edge, and the lines re-drawn in steps
   so they boil - the same way the between-wave cards are drawn. So any
   element marked data-doodle gets a small canvas behind it, and this draws
   its frame with Rough exactly as those cards do. No CSS borders, radii,
   shadows or gradients anywhere in the menus: those were smooth, and
   nothing else in the game is.

   data-doodle   outline colour ('ink' for the usual pencil black)
   data-fill     crayon colour scribbled in (optional; always on hover)
   data-shape    rect (default) | circle | spiky
   data-weight   outline thickness (default 2.6)
   data-when     'on' - only draw while the element has the class .on */

const Doodle = {
  items: [],
  raf: 0,
  step: -1,
  RATE: 3.5,          // re-draws a second, like Rough.boil(time * 0.5) on the cards
  PAD: 16,            // room around the element for the crayon (and a lifted button's shadow) to spill into

  /* Frame every element under `root` that asks for it and does not have one. */
  scan(root) {
    (root || document).querySelectorAll('[data-doodle]').forEach(el => {
      if (el._doodle) return;
      const cv = document.createElement('canvas');
      cv.className = 'doodle-bg';
      el.insertBefore(cv, el.firstChild);
      el.classList.add('doodled');
      const item = { el, cv, hover: false, seed: 1 + Math.floor(Math.random() * 90000), w: 0, h: 0 };
      el._doodle = item;
      el.addEventListener('mouseenter', () => { item.hover = true; this.draw(item, true); });
      el.addEventListener('mouseleave', () => { item.hover = false; this.draw(item, true); });
      this.items.push(item);
      this.draw(item, true);
    });
    this.items = this.items.filter(it => it.el.isConnected);
    if (!this.raf) this.loop();
  },

  loop() {
    const tick = (now) => {
      const step = Math.floor(now / 1000 * this.RATE);
      if (step !== this.step) {
        this.step = step;
        for (const it of this.items) this.draw(it, false);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },

  draw(it, force) {
    const el = it.el;
    if (!el.isConnected || !el.getClientRects().length) return;      // hidden screen
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const P = this.PAD, dpr = Math.min(2, window.devicePixelRatio || 1);
    // browser zoom changes the pixel ratio without changing the CSS size:
    // the canvas has to be re-made for it too, or the old frame is left
    // behind at the old scale and the button shows two outlines
    if (w !== it.w || h !== it.h || dpr !== it.dpr) {
      it.w = w; it.h = h; it.dpr = dpr;
      it.cv.width = Math.round((w + P * 2) * dpr);
      it.cv.height = Math.round((h + P * 2) * dpr);
      it.cv.style.width = (w + P * 2) + 'px';
      it.cv.style.height = (h + P * 2) + 'px';
    }
    const d = el.dataset;
    const ctx = it.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, it.cv.width, it.cv.height);      // the whole bitmap, whatever the scale
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const on = d.when === 'on' ? el.classList.contains('on') : true;
    if (!on && !it.hover) return;

    const ink = d.doodle === 'ink' || !d.doodle ? '#2b2b2b' : d.doodle;
    const disabled = el.disabled;
    const weight = parseFloat(d.weight || '2.6') + (it.hover && !disabled ? 0.8 : 0);
    const lift = 0;                        // the button itself nudges up in CSS on hover
    const shape = d.shape || 'rect';

    // the outline boils; the fill underneath stays put
    Rough.boil(it.seed, this.step / 7);    // boil() steps on floor(time * 7): one new seed per step
    let pts;
    if (shape === 'circle') {
      pts = Rough.circlePts(P + w / 2, P + h / 2 - lift, Math.min(w, h) / 2, 1.2, 12);
    } else if (shape === 'spiky') {
      pts = spikyOutline({ x: P, y: P - lift, w, h }, 1.5);
    } else {
      pts = Rough.rectPts(P, P - lift, w, h).map(p => [p[0] + Rough.jit(2.2), p[1] + Rough.jit(2.2)]);
    }
    // a button lifts toward you when hovered (in CSS); its shadow stays on
    // the page underneath, set off the way the lift moved it
    if (it.hover && el.tagName === 'BUTTON' && !disabled) {
      const sh = pts.map(p => [p[0] + 6, p[1] + 12]);
      Rough.boil(it.seed + 3, 0);
      Rough.scribble(ctx, sh, { color: '#2b2b2b', spacing: 5, width: 3, overflow: 1, alpha: 0.16, angle: -0.8 });
      Rough.boil(it.seed, this.step / 7);
    }
    if (d.paper) {                          // opaque paper, so nothing behind shows through
      ctx.fillStyle = '#fffdf4';
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.fill();
    }
    // hovering scribbles a button in, like the cards' buttons do - panels
    // are not buttons, so they stay clean however long the mouse sits there
    const pressable = el.tagName === 'BUTTON' && !disabled;
    const fill = d.fill || (it.hover && pressable ? ink : null);
    if (fill) {
      Rough.boil(it.seed + 7, 0);           // frozen seed: the strokes stay where they fell
      const small = Math.min(w, h);           // tiny things need finer strokes to fill at all
      Rough.scribble(ctx, pts, { color: fill, spacing: Math.min(7, Math.max(2.2, small / 6)),
        width: Math.min(5, Math.max(1.6, small / 7)), overflow: 1.1,
        alpha: d.fill ? (it.hover && pressable ? 0.5 : 0.4) : 0.22 });
      Rough.boil(it.seed, this.step / 7);
    }
    Rough.poly(ctx, pts, { color: disabled ? '#b8b2a3' : ink, width: weight, jitter: 1.4 });
  }
};
