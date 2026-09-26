/* FANDHARN - the title screen, and the two books off it.

   The title is three buttons in the corner and the castle standing behind
   them, with the things that want it dead circling on the canvas. PLAY opens
   the run setup (what the title used to be), BESTIARY opens the book, SKIN
   opens the shop. */

const Menu = {
  current: 'front',
  ids: ['front', 'menu', 'bestiary', 'skins', 'more'],

  bind(game) {
    this.game = game;
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      Sfx.play('button', { volume: 0.7 });
      const to = b.dataset.go;
      this.go(to === 'play' ? 'menu' : to);
    }));
    // a click on the dimmed page around a popup (not on the popup) closes it
    document.querySelectorAll('.popup-screen, .book-screen').forEach(scr => scr.addEventListener('click', e => {
      if (e.target !== scr || this.current === 'front') return;
      Sfx.play('button', { volume: 0.5 });
      this.go('front');
    }));
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.game.state === 'menu' && this.current !== 'front') this.go('front');
    });
  },

  go(name) {
    this.current = name;
    for (const id of this.ids) document.getElementById(id).classList.toggle('hidden', id !== name);
    if (name === 'bestiary') Bestiary.open(); else Bestiary.close();
    if (name === 'skins') SkinShop.open(); else SkinShop.close();
    if (name === 'more') More.open(); else More.close();
    if (name === 'front') this.syncDot();
    Doodle.scan(document.getElementById(name));
  },

  /* A dot on MORE when there is something waiting in it: an achievement to
     claim, a chest to open, or a search that has come back. */
  syncDot() {
    const dot = document.getElementById('more-dot');
    if (!dot) return;
    const st = Relics.searchState(Date.now());
    const waiting = ACHIEVEMENTS.some(a => Achievements.state(a.id) === 'done')
      || Save.data.chests > 0 || (st && st.done);
    dot.classList.toggle('hidden', !waiting);
  },

  hideAll() {
    for (const id of this.ids) document.getElementById(id).classList.add('hidden');
    Bestiary.close(); SkinShop.close(); More.close();
  }
};

/* ------------------------------------------------ the scene behind the title

   The castle on its lawn, and a crowd going round it on slow orbits: the
   ordinary ones close in, a boss drifting at the back, the Auger stalking
   the outside. Every so often one of them pops and a new one walks in. Pure
   decoration - nothing here runs game logic. */
const MenuScene = {
  things: [], t: 0, next: 2.5, effects: [],

  init() {
    this.things = [];
    this.effects = [];
    const cast = [['blob', 150, 0.22], ['dart', 190, -0.34], ['brick', 225, 0.15], ['blob', 260, -0.2],
      ['bee', 175, 0.5], ['blotling', 205, -0.42], ['dart', 300, 0.26], ['auger', 330, -0.08],
      ['warden', 395, 0.05]];
    cast.forEach(([k, rad, sp], i) => this.add(k, rad, sp, (i / cast.length) * Math.PI * 2));
  },

  add(kind, rad, speed, ang) {
    const e = new Enemy(kind, 10, 0, 0, 0);
    e.spawnT = 0; e.hpShown = 1;
    if (kind === 'auger') e.augerState();
    this.things.push({ e, kind, rad, speed, ang });
  },

  update(dt) {
    this.t += dt;
    for (const th of this.things) {
      th.ang += th.speed * dt * (140 / th.rad);
      th.e.x = Math.cos(th.ang) * th.rad;
      th.e.y = Math.sin(th.ang) * th.rad * 0.72;
      if (th.e.spawnT < 1) th.e.spawnT = Math.min(1, th.e.spawnT + dt / 0.6);
      if (th.e.hitT > 0) th.e.hitT = Math.max(0, th.e.hitT - dt / 0.22);
      if (th.e.flash > 0) th.e.flash -= dt;
      if (th.kind === 'auger') {
        // it pauses now and then, and every eye turns to look
        const a = th.e.aug, cyc = this.t % 7;
        a.mode = cyc > 5.6 ? (cyc > 6.1 ? 'wind' : 'halt') : 'walk';
        a.t = a.mode === 'halt' ? 6.1 - cyc : (a.mode === 'wind' ? 7 - cyc : 0);
        th.speed = a.mode === 'walk' ? -0.08 : 0;
        a.gait += dt * 2; a.spin += dt * (a.mode === 'wind' ? 30 : 3);
      }
    }
    // every few seconds one of the small ones pops, and another walks in
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 2.4 + Math.random() * 2;
      const small = this.things.filter(th => !th.e.boss && th.kind !== 'auger');
      const th = small[Math.floor(Math.random() * small.length)];
      if (th) {
        const fake = { effects: this.effects };
        this.effects.push(new DeathSplat(th.e.x, th.e.y, th.e.r, th.e.fill, false));
        this.effects.push(new KillPop(th.e.x, th.e.y, th.e.r, th.e.fill, false, fake));
        th.e.spawnT = 0;
        th.ang += Math.PI * (0.6 + Math.random() * 0.8);
      }
    }
    const fake = { effects: this.effects, enemies: [] };
    for (let i = 0; i < this.effects.length; i++) {
      if (!this.effects[i].update(dt, fake)) { this.effects.splice(i, 1); i--; }
    }
  },

  draw(ctx, game) {
    // the castle sits right of centre, clear of the buttons in the corner
    ctx.save();
    ctx.translate(game.w * 0.16, game.h * 0.02);
    if (game.ground) {
      const s = game.ground.size;
      ctx.drawImage(game.ground.canvas, -s / 2, -s / 2, s, s);
    }
    for (const f of this.effects) if (f.under) f.draw(ctx, game.time);
    game.drawCastle(ctx);
    // back to front, so the near ones overlap the far ones
    const order = this.things.slice().sort((a, b) => a.e.y - b.e.y);
    for (const th of order) th.e.draw(ctx, game.time);
    for (const f of this.effects) if (!f.under) f.draw(ctx, game.time);
    ctx.restore();
  }
};

/* ------------------------------------------------------------ the skin shop */
const SkinShop = {
  raf: 0, cards: [],

  open() {
    this.render();
    const warn = document.getElementById('save-warn');
    if (warn) warn.classList.toggle('hidden', Save.persistent);
    cancelAnimationFrame(this.raf);
    const loop = (now) => { this.animate(now / 1000); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },

  close() { cancelAnimationFrame(this.raf); this.raf = 0; },

  render() {
    document.getElementById('coin-count').textContent = Save.coins;
    const list = document.getElementById('skin-list');
    list.innerHTML = '';
    this.cards = [];
    for (const skin of SKINS) {
      if (skin.inPack) continue;                 // shown inside their pack
      if (skin.pack) { this.packCard(skin, list); continue; }
      const target = Object.keys(skin.applies)[0];
      const look = skin.applies[target];
      const baseId = target.split(':')[1];
      const base = cursorById(baseId);
      const card = document.createElement('div');
      card.className = 'skin-card' + (look.card === 'spiky' ? ' spiky' : '');
      // a skinned card wears the same border it gets between waves
      card.dataset.doodle = look.card === 'spiky' ? '#e8a93a' : look.card === 'cryo' ? '#5fa8e0' : 'ink';
      if (look.card === 'cryo') card.dataset.weight = '3.2';
      card.dataset.paper = '1';
      if (look.card === 'spiky') { card.dataset.shape = 'spiky'; card.dataset.weight = '3'; }
      const view = document.createElement('div');
      view.className = 'skin-view';
      view.dataset.doodle = 'ink'; view.dataset.paper = '1'; view.dataset.weight = '2';
      const cv = document.createElement('canvas');
      cv.className = 'skin-preview';
      view.appendChild(cv);
      card.appendChild(view);
      const owned = Save.owns(skin.id), worn = Save.isEquipped(skin);
      card.insertAdjacentHTML('beforeend',
        '<h3 style="color:' + skin.color + '">' + skin.name + '</h3>'
        + '<div class="skin-for">' + (Object.keys(skin.applies).length > 1 ? 'skin pack' : targetName(target) + ' skin') + '</div>'
        + '<p>' + skin.blurb + '</p>');
      const btn = document.createElement('button');
      if (!owned) {
        btn.innerHTML = 'BUY &middot; ' + skin.price
          + '<i class="coin-inline" data-doodle="#a5741b" data-fill="#f2c230" data-shape="circle" data-weight="1.4"></i>';
        btn.dataset.doodle = '#a5741b';
        btn.disabled = Save.coins < skin.price;
        btn.title = btn.disabled ? 'need ' + (skin.price - Save.coins) + ' more' : '';
        btn.onclick = () => { if (Save.buy(skin)) { Save.equip(skin); Sfx.play('card_buy', { volume: 0.9 }); this.render(); } };
      } else if (worn) {
        btn.textContent = 'EQUIPPED ✓  (take off)';
        btn.className = 'equipped';
        btn.dataset.doodle = '#4c9f70';
        btn.onclick = () => { Save.unequip(skin); Sfx.play('button', { volume: 0.7 }); this.render(); };
      } else {
        btn.textContent = 'EQUIP';
        btn.dataset.doodle = 'ink';
        btn.onclick = () => { Save.equip(skin); Sfx.play('button', { volume: 0.7 }); this.render(); };
      }
      card.appendChild(btn);
      list.appendChild(card);
      this.cards.push({ cv, skin, look, stars: [], next: 0.3 });
    }
    // the whole list, not card by card: scanning a card only finds what is
    // inside it, and the card's own crayon frame was lost on every re-render
    Doodle.scan(list);
  },

  /* A pack's card: won, never bought. Owned, its button opens the settings
     where each skin in it is switched on or off. */
  packCard(pack, list) {
    const card = document.createElement('div');
    card.className = 'skin-card spiky';
    card.dataset.doodle = pack.color; card.dataset.paper = '1';
    card.dataset.shape = 'spiky'; card.dataset.weight = '3';
    const view = document.createElement('div');
    view.className = 'skin-view';
    view.dataset.doodle = 'ink'; view.dataset.paper = '1'; view.dataset.weight = '2';
    const cv = document.createElement('canvas');
    cv.className = 'skin-preview';
    view.appendChild(cv);
    card.appendChild(view);
    const owned = Save.owns(pack.id);
    const inside = pack.skins.map(id => skinById(id).name).join(' + ');
    card.insertAdjacentHTML('beforeend',
      '<h3 style="color:' + pack.color + '">' + pack.name + '</h3>'
      + '<div class="skin-for">skin pack</div>'
      + '<div class="pack-inside">' + inside + '</div>'
      + '<p>' + pack.blurb + '</p>');
    if (owned) {
      const btn = document.createElement('button');
      btn.textContent = 'SETTINGS';
      btn.dataset.doodle = pack.color;
      btn.onclick = () => { Sfx.play('button', { volume: 0.7 }); PackModal.open(pack, () => this.render()); };
      card.appendChild(btn);
    } else {
      const a = achievementById(pack.unlock);
      card.insertAdjacentHTML('beforeend', '<div class="locked">achievement: ' + (a ? a.text : '') + '</div>');
    }
    list.appendChild(card);
    this.cards.push({ cv, skin: pack, pack: true, next: 0.4, bolts: [] });
  },

  /* each card plays its skin: the cursor itself, and the strike it throws */
  animate(t) {
    const dt = this.lastT ? Math.max(0, Math.min(0.05, t - this.lastT)) : 1 / 60;
    this.lastT = t;
    for (const c of this.cards) {
      const cv = c.cv, dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) continue;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // on paper, like the game - the crayon is drawn for it
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, w, h);
      Rough.boil(c.skin.id.length * 31, Math.floor(t * 2));
      if (c.pack) { thunderPreview(ctx, w, h, t, dt, c); continue; }
      if (c.skin.id === 'cryo') { cryoPreview(ctx, w, h, t, dt, c); continue; }
      if (c.skin.id === 'moleman') { molePreview(ctx, w, h, t, dt, c); continue; }
      for (let i = 0; i < 10; i++) {           // a few twinkles in the sky
        const sx = (i * 97 % 100) / 100 * w, sy = (i * 53 % 100) / 100 * h * 0.6;
        const k = 2 + Math.sin(t * 3 + i) * 1.5;
        Rough.line(ctx, sx - k, sy, sx + k, sy, { color: '#e8a93a', width: 1.6, jitter: 0.3, passes: 1, alpha: 0.6 });
        Rough.line(ctx, sx, sy - k, sx, sy + k, { color: '#e8a93a', width: 1.6, jitter: 0.3, passes: 1, alpha: 0.6 });
      }
      // stars coming down on the right, the cursor itself on the left
      c.next -= dt;
      if (c.next <= 0) { c.next = 0.9; c.stars.push({ x: w * (0.55 + Math.random() * 0.35), y: h * 0.78, t: 0 }); }
      for (const s of c.stars) {
        s.t += dt;
        const k = Math.min(1, s.t / 0.5), e = k * k;
        if (k < 1) {
          const x = s.x + 50 * (1 - e), y = s.y - 110 * (1 - e);
          Rough.bloom(ctx, x, y, 30 - 18 * k, '#ffd24a', 0.7);
          drawStar(ctx, x, y, 22 - 16 * k, t * 5, 1);
        } else {
          const p = (s.t - 0.5) / 0.5;
          Rough.bloom(ctx, s.x, s.y, 20 + p * 40, '#ffd24a', (1 - p) * 0.9);
          Rough.circle(ctx, s.x, s.y, 6 + p * 34, { color: '#e8a93a', width: 2.5, jitter: 1.5, wobble: 2, alpha: 1 - p });
        }
      }
      c.stars = c.stars.filter(s => s.t < 1);
      ctx.save();
      ctx.translate(w * 0.2, h * 0.3);
      ctx.scale(2.6, 2.6);
      (CursorSprites[c.look.sprite] || CursorSprites.plain)(ctx, 0, 0, 1, c.look.color, t, 0);
      ctx.restore();
    }
  }
};
