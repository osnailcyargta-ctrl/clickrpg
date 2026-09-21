/* FANDHARN - the between-wave screen. Three cards get drawn on the paper and
   coloured in with crayon that spills past the outline; you buy one of them,
   or skip and keep your scribbles. */

function buildOffers(game) {
  const pool = [];

  for (const c of CURSORS) {
    if (c.id === 'plain' || c.id === game.cursorId) continue;
    pool.push({ kind: 'cursor', id: c.id, name: c.name, color: c.color, cost: offerCost(c.cost, game.wave), desc: c.desc, detail: c.detail, tag: 'CURSOR' });
  }
  for (const u of ONESHOT) {
    if (game.oneshot[u.id]) continue;
    pool.push({ kind: 'oneshot', id: u.id, name: u.name, color: u.color, cost: offerCost(u.cost, game.wave), desc: u.desc, detail: u.detail, tag: 'ONE-SHOT' });
  }
  for (const u of STACKING) {
    if (u.id === 'patch' && game.castleHp >= CASTLE_HP) continue;   // nothing to tape
    const lv = game.stacking[u.id] || 0;
    pool.push({
      kind: 'stack', id: u.id, name: u.name, color: u.color, cost: offerCost(stackingCost(u, lv), game.wave),
      desc: u.desc, detail: u.detail(lv + 1), level: lv, tag: lv > 0 ? 'LEVEL ' + (lv + 1) : 'STACKS'
    });
  }

  const picked = [];
  while (picked.length < 3 && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

class OfferScreen {
  constructor(game, wave, earned) {
    this.game = game;
    this.wave = wave;
    this.earned = earned;
    this.offers = buildOffers(game);
    this.id = nextId();
    this.t = 0;
    this.done = false;
    this.hover = -1;
    this.hoverSkip = false;
    this.chosen = -1;
    this.chosenT = 0;
    this.denied = -1;
    this.deniedT = 0;
    this.cardIn = this.offers.map(() => 0);
    this.outlineStart = 0.3; this.outlineDur = 0.55; this.stagger = 0.26;
    this.fillStart = 0.85; this.fillDur = 0.7;
    this.ready = this.fillStart + this.stagger * 2 + this.fillDur;
  }

  skipIntro() { if (this.t < this.ready) this.t = this.ready; }

  layout(w, h) {
    const stack = w < 680;
    const cards = [];
    if (stack) {
      const cw = Math.min(430, w - 36), ch = Math.min(112, (h * 0.52) / 3);
      const gap = 12;
      const total = ch * 3 + gap * 2;
      const y0 = Math.max(h * 0.24, h / 2 - total / 2 + 10);
      for (let i = 0; i < 3; i++) cards.push({ x: (w - cw) / 2, y: y0 + i * (ch + gap), w: cw, h: ch });
      return { cards, stack, skip: { x: (w - 190) / 2, y: y0 + total + 18, w: 190, h: 44 } };
    }
    const cw = Math.min(210, (w - 90) / 3), ch = Math.min(280, h * 0.46), gap = 22;
    const total = cw * 3 + gap * 2;
    const x0 = (w - total) / 2, y0 = h / 2 - ch / 2 + 14;
    for (let i = 0; i < 3; i++) cards.push({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ch });
    return { cards, stack, skip: { x: (w - 200) / 2, y: y0 + ch + 22, w: 200, h: 46 } };
  }

  cardProgress(i) {
    return {
      outline: E.clamp01((this.t - (this.outlineStart + i * this.stagger)) / this.outlineDur),
      fill: E.clamp01((this.t - (this.fillStart + i * this.stagger)) / this.fillDur)
    };
  }

  update(dt, w, h) {
    this.t += dt;
    for (let i = 0; i < this.cardIn.length; i++) {
      const want = (this.hover === i && this.chosen < 0) ? 1 : 0;
      this.cardIn[i] += (want - this.cardIn[i]) * Math.min(1, dt * 12);
    }
    if (this.deniedT > 0) this.deniedT = Math.max(0, this.deniedT - dt / 0.5);
    if (this.chosen >= 0) {
      this.chosenT += dt;
      if (this.chosenT > 1.0) this.done = true;
    }
    return !this.done;
  }

  move(x, y, w, h) {
    if (this.chosen >= 0) return;
    const L = this.layout(w, h);
    this.hover = -1;
    for (let i = 0; i < L.cards.length; i++) {
      const c = L.cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) this.hover = i;
    }
    const s = L.skip;
    this.hoverSkip = x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
  }

  click(x, y, w, h) {
    if (this.chosen >= 0) return;
    if (this.t < this.ready) { this.skipIntro(); return; }
    this.move(x, y, w, h);
    if (this.hoverSkip) { this.done = true; return; }
    if (this.hover < 0) return;
    const off = this.offers[this.hover];
    if (this.game.scribbles < off.cost) {
      this.denied = this.hover;
      this.deniedT = 1;
      return;
    }
    this.game.buyOffer(off);
    this.chosen = this.hover;
    this.chosenT = 0;
  }

  draw(ctx, w, h, time) {
    const L = this.layout(w, h);

    ctx.save();
    ctx.globalAlpha = Math.min(0.93, this.t * 3);
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // header slides down and settles
    const hp = E.clamp01(this.t / 0.5);
    ctx.save();
    ctx.globalAlpha = hp;
    const hy = L.cards[0].y - (L.stack ? 62 : 74) - (1 - E.back(hp)) * 26;
    Rough.text(ctx, 'WAVE ' + this.wave + ' CLEAR', w / 2, hy, Math.min(42, w * 0.075), '#2b2b2b');
    Rough.text(ctx,
      '+' + this.earned + ' scribbles  ·  purse ' + this.game.scribbles + '  ·  castle ' + this.game.castleHp + '/' + CASTLE_HP,
      w / 2, hy + 26, Math.min(16, w * 0.033), '#6b6b6b');
    ctx.restore();

    for (let i = 0; i < this.offers.length; i++) this.drawCard(ctx, L, i, time);

    // skip button
    const ready = this.t >= this.ready && this.chosen < 0;
    if (ready) {
      const s = L.skip;
      ctx.save();
      ctx.globalAlpha = E.clamp01((this.t - this.ready) / 0.3);
      const lift = this.hoverSkip ? 2 : 0;
      const pts = Rough.rectPts(s.x, s.y - lift, s.w, s.h).map(p => [p[0] + Rough.jit(2), p[1] + Rough.jit(2)]);
      if (this.hoverSkip) Rough.scribble(ctx, pts, { color: '#d9d3c4', spacing: 7, width: 5, overflow: 1.1, alpha: 0.5 });
      Rough.poly(ctx, pts, { color: '#6b6b6b', width: 2.4, jitter: 1.4 });
      Rough.text(ctx, 'SKIP, KEEP THE LOT', s.x + s.w / 2, s.y + s.h / 2 - lift, 16, '#6b6b6b');
      ctx.restore();
    }
  }

  drawCard(ctx, L, i, time) {
    const off = this.offers[i];
    const c = L.cards[i];
    const pr = this.cardProgress(i);
    if (pr.outline <= 0) return;

    const afford = this.game.scribbles >= off.cost;
    const lift = this.cardIn[i] * (L.stack ? 3 : 7);
    const grow = 1 + this.cardIn[i] * 0.02;
    const shakeX = this.denied === i ? Math.sin(this.deniedT * 40) * this.deniedT * 7 : 0;
    const fade = this.chosen >= 0 && this.chosen !== i ? 1 - E.clamp01(this.chosenT / 0.45) : 1;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(c.x + c.w / 2 + shakeX, c.y + c.h / 2 - lift);
    ctx.scale(grow, grow);
    ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));

    Rough.boil(this.id * 17 + i, time * 0.5);
    const pts = Rough.rectPts(c.x, c.y, c.w, c.h).map(p => [p[0] + Rough.jit(2.5), p[1] + Rough.jit(2.5)]);

    // opaque paper first so the battlefield doesn't show through the crayon
    ctx.save();
    ctx.globalAlpha = fade * Math.min(1, pr.outline * 2);
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6);
    ctx.restore();

    if (pr.fill > 0) {
      Rough.boil(this.id * 91 + i, 0);      // frozen seed: strokes stay put as they pile up
      Rough.scribble(ctx, pts, {
        color: off.color, spacing: L.stack ? 9 : 8, width: 7,
        overflow: L.stack ? 1.07 : 1.15,      // the deliberate spill past the outline
        angle: -0.6 + i * 0.3, progress: pr.fill, alpha: this.cardIn[i] > 0.5 ? 0.42 : 0.3
      });
      Rough.grain(ctx, pts, off.color, 0.0015, this.id + i);
    }
    Rough.boil(this.id * 17 + i, time * 0.5);
    Rough.poly(ctx, pts, {
      color: this.hover === i && this.chosen < 0 ? off.color : '#2b2b2b',
      width: this.hover === i ? 3.6 : 2.8, jitter: 1.6, progress: pr.outline
    });

    if (pr.fill > 0.5) {
      const ta = E.clamp01((pr.fill - 0.5) / 0.4);
      ctx.save();
      ctx.globalAlpha = fade * ta;
      const pad = L.stack ? 14 : 12;
      if (L.stack) {
        Rough.text(ctx, off.tag, c.x + pad, c.y + 20, 11, '#8a8a8a', 'left');
        Rough.text(ctx, off.name, c.x + pad, c.y + 40, 19, off.color, 'left');
        const lines = Rough.wrap(ctx, off.desc, 13, c.w - pad * 2 - 62);
        lines.slice(0, 2).forEach((ln, k) => Rough.text(ctx, ln, c.x + pad, c.y + 62 + k * 17, 13, '#4a4a4a', 'left'));
        this.drawPrice(ctx, c.x + c.w - pad - 26, c.y + c.h / 2, off, afford);
      } else {
        Rough.text(ctx, off.tag, c.x + c.w / 2, c.y + 24, 11, '#8a8a8a');
        const nameLines = Rough.wrap(ctx, off.name, 20, c.w - pad * 2);
        nameLines.forEach((ln, k) => Rough.text(ctx, ln, c.x + c.w / 2, c.y + 50 + k * 22, 20, off.color));
        const dy = c.y + 50 + nameLines.length * 22;
        Rough.wrap(ctx, off.desc, 14, c.w - pad * 2).slice(0, 3)
          .forEach((ln, k) => Rough.text(ctx, ln, c.x + c.w / 2, dy + 8 + k * 18, 14, '#3a3a3a'));
        const detailY = dy + 74;
        ctx.globalAlpha = fade * ta * 0.75;
        Rough.wrap(ctx, off.detail, 11, c.w - pad * 2).slice(0, 5)
          .forEach((ln, k) => Rough.text(ctx, ln, c.x + c.w / 2, detailY + k * 14, 11, '#6b6b6b'));
        ctx.globalAlpha = fade * ta;
        this.drawPrice(ctx, c.x + c.w / 2, c.y + c.h - 26, off, afford);
      }
      ctx.restore();
    }

    // "TAKEN" stamp
    if (this.chosen === i) {
      const st = E.back(E.clamp01(this.chosenT / 0.35));
      ctx.save();
      ctx.globalAlpha = E.clamp01(this.chosenT / 0.2);
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(-0.22);
      ctx.scale(st, st);
      Rough.boil(this.id + 500, 0);
      const sp = Rough.rectPts(-72, -22, 144, 44).map(p => [p[0] + Rough.jit(3), p[1] + Rough.jit(3)]);
      Rough.poly(ctx, sp, { color: '#c8433a', width: 4, jitter: 2.5 });
      Rough.text(ctx, 'TAKEN', 0, 0, 28, '#c8433a');
      ctx.restore();
    }
    ctx.restore();
  }

  drawPrice(ctx, x, y, off, afford) {
    const col = off.cost === 0 ? '#4c9f70' : (afford ? '#d99a26' : '#b8b2a3');
    Rough.boil(this.id + 900 + off.cost, 0);
    Rough.circle(ctx, x, y, 19, { color: col, width: 2.4, jitter: 1.6 });
    Rough.text(ctx, String(off.cost), x, y, 17, col);
  }
}
