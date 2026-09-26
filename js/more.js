/* FANDHARN - the MORE page off the title: achievements, relics (searching
   and chests), and the inventory. Plus the two small popups that can open
   over anything: a chest being opened, and a skin pack's settings. */

const More = {
  view: 'home', timer: 0, sel: 0,

  open() {
    this.settle();
    this.show('home');
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
  },

  close() { clearInterval(this.timer); this.timer = 0; SearchAnim.stop(); },

  /* A search that finished while nobody was looking hands its chests over. */
  settle() {
    const got = Relics.settleSearch(Date.now());
    if (got) this.flash = 'the search came back with ' + got + (got === 1 ? ' chest' : ' chests');
    Menu.syncDot();
    return got;
  },

  show(view) {
    this.view = view;
    this.render();
  },

  tick() {
    if (Menu.current !== 'more') return;
    if (this.settle()) { this.render(); return; }
    // the live bits only: the search clock and the purse
    const clock = document.getElementById('search-clock');
    const st = Relics.searchState(Date.now());
    if (clock && st) {
      clock.textContent = hms(st.left) + ' left';
      const bar = document.getElementById('search-fill');
      if (bar) bar.style.width = (100 * st.elapsed / SEARCH_MS).toFixed(2) + '%';
      const found = document.getElementById('search-found');
      if (found) found.textContent = st.found;
    }
    const coin = document.getElementById('inv-coin-n');
    if (coin) coin.textContent = Save.coins;
  },

  render() {
    SearchAnim.stop();
    const body = document.getElementById('more-body');
    body.innerHTML = '';
    const back = this.view === 'home' ? '' :
      '<button class="more-back" data-doodle="ink" data-paper="1">&lsaquo; back</button>';
    if (this.view === 'home') body.innerHTML = this.homeHtml();
    if (this.view === 'ach') body.innerHTML = back + this.achHtml();
    if (this.view === 'relics') body.innerHTML = back + this.relicsHtml();
    if (this.view === 'inv') body.innerHTML = back + this.invHtml();
    const b = body.querySelector('.more-back');
    if (b) b.onclick = () => { Sfx.play('button', { volume: 0.6 }); this.show('home'); };
    body.querySelectorAll('[data-view]').forEach(el => el.onclick = () => {
      Sfx.play('button', { volume: 0.7 }); this.show(el.dataset.view);
    });
    if (this.view === 'ach') this.bindAch(body);
    if (this.view === 'relics') this.bindRelics(body);
    if (this.view === 'inv') this.bindInv(body);
    body.querySelectorAll('canvas[data-icon]').forEach(cv => paintIcon(cv));
    Doodle.scan(body);
  },

  /* ---------------------------------------------------------- the menu */
  homeHtml() {
    const claim = ACHIEVEMENTS.some(a => Achievements.state(a.id) === 'done');
    const chests = Save.data.chests > 0 || (Relics.searchState(Date.now()) || {}).done;
    const dot = on => on ? '<i class="more-dot"></i>' : '';
    return '<h2>MORE</h2>'
      + '<div class="more-menu">'
      + '<button class="more-big" data-view="ach" data-doodle="#a5741b" data-paper="1"><b>ACHIEVEMENTS</b>' + dot(claim) + '</button>'
      + '<button class="more-big" data-view="relics" data-doodle="#9a6a36" data-paper="1"><b>RELICS</b>' + dot(chests) + '</button>'
      + '<button class="more-big" data-view="inv" data-doodle="ink" data-paper="1"><b>INVENTORY</b></button>'
      + '</div>';
  },

  /* ---------------------------------------------------- achievements */
  achHtml() {
    let h = '<h2>ACHIEVEMENTS</h2><div class="ach-list">';
    for (const a of ACHIEVEMENTS) {
      const st = Achievements.state(a.id);
      const col = st ? '#a5741b' : '#b8b2a3';
      let prog = '';
      if (a.goal && !st) {
        prog = '<div class="ach-prog">best run: ' + (Save.data.achBest[a.id] || 0) + ' / ' + a.goal
          + (a.note ? ' &middot; ' + a.note : '') + '</div>';
      }
      let act;
      if (st === 'claimed') act = '<span class="ach-claimed">&check; claimed</span>';
      else if (st === 'done') act = '<button class="ach-claim" data-claim="' + a.id + '" data-doodle="#a5741b" data-fill="#f2c230">CLAIM</button>';
      else act = '<span class="ach-locked">not yet</span>';
      h += '<div class="ach-row' + (st ? ' done' : '') + '" data-doodle="' + col + '" data-paper="1" data-weight="2.4">'
        + '<div class="ach-text"><b>' + a.name + '</b><span>' + a.text + '</span>' + prog
        + '<div class="ach-reward">reward: ' + Achievements.rewardText(a) + '</div></div>'
        + act + '</div>';
    }
    return h + '</div>' + (this.claimed ? '<p class="more-flash">' + this.claimed + '</p>' : '');
  },

  bindAch(body) {
    this.claimed = null;
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      const line = Achievements.claim(b.dataset.claim);
      if (line == null) return;
      Sfx.play('card_buy', { volume: 0.9, rateVar: 0 });
      this.render();
      this.claimed = null;
      const list = document.querySelector('.ach-list');
      if (list) list.insertAdjacentHTML('afterend', '<p class="more-flash">' + line + '</p>');
      Menu.syncDot();
    });
  },

  /* ------------------------------------------------ relics: search, chests */
  relicsHtml() {
    const now = Date.now();
    const st = Relics.searchState(now);
    let search = '<canvas id="search-canvas" class="search-canvas"></canvas>';
    if (!st) {
      search += '<p>Send someone out to look. They are gone four hours, tab open or shut, and turn up a chest every hour and a half to two and a bit.</p>'
        + '<button id="search-go" data-doodle="#4c9f70" data-fill="#4c9f70">SEARCH NOW</button>';
    } else {
      search += '<div class="search-bar" data-doodle="ink" data-weight="2"><div id="search-fill" class="search-fill" style="width:'
        + (100 * st.elapsed / SEARCH_MS).toFixed(2) + '%"></div></div>'
        + '<div class="search-line"><span id="search-clock">' + hms(st.left) + ' left</span>'
        + '<span>found so far: <b id="search-found">' + st.found + '</b></span></div>'
        + '<button id="search-stop" data-doodle="ink">CALL IT OFF &middot; keep what was found</button>';
    }
    const n = Save.data.chests;
    const flash = this.flash ? '<p class="more-flash">' + this.flash + '</p>' : '';
    this.flash = null;
    return '<h2>RELICS</h2>' + flash
      + '<div class="relic-panels">'
      + '<div class="relic-panel" data-doodle="#4c9f70" data-paper="1" data-weight="2.4"><h3>SEARCH</h3>' + search + '</div>'
      + '<div class="relic-panel" data-doodle="#9a6a36" data-paper="1" data-weight="2.4"><h3>CHESTS</h3>'
      + '<canvas class="chest-icon" data-icon="chest" width="120" height="96"></canvas>'
      + '<div class="chest-count"><b>' + n + '</b> ' + (n === 1 ? 'chest' : 'chests') + '</div>'
      + '<button id="chest-open" data-doodle="#9a6a36" ' + (n ? '' : 'disabled') + '>OPEN A CHEST</button>'
      + '<p class="hint">won on Normal or Hard, every tenth Endless wave, or searched for</p></div>'
      + '</div>';
  },

  bindRelics(body) {
    SearchAnim.start(body.querySelector('#search-canvas'));
    const go = body.querySelector('#search-go');
    if (go) go.onclick = () => { Relics.startSearch(Date.now()); Sfx.play('card_draw', { volume: 0.7 }); this.render(); };
    const stop = body.querySelector('#search-stop');
    if (stop) stop.onclick = () => {
      const got = Relics.stopSearch(Date.now());
      this.flash = got ? 'called off: +' + got + (got === 1 ? ' chest' : ' chests') : 'called off: nothing found yet';
      Sfx.play('skip', { volume: 0.7 });
      this.render();
    };
    const open = body.querySelector('#chest-open');
    if (open) open.onclick = () => ChestModal.open(() => this.render());
  },

  /* ---------------------------------------------------------- inventory */
  invHtml() {
    const slots = Relics.slots();
    const rows = Relics.rows(slots.length);
    if (this.sel >= slots.length) this.sel = 0;
    let grid = '<div class="inv-grid">';
    for (let i = 0; i < rows * 4; i++) {
      const it = slots[i];
      const worn = it && it.type === 'relic' && Save.data.relicOn === it.id;
      const col = !it ? '#d8d2c3' : worn ? '#4c9f70' : i === this.sel ? 'ink' : '#b8b2a3';
      grid += '<button class="inv-slot' + (it ? '' : ' empty') + (i === this.sel && it ? ' on' : '') + '" data-slot="' + i + '"'
        + ' data-doodle="' + col + '" data-weight="' + (i === this.sel && it ? 2.8 : 2) + '"' + (it ? '' : ' disabled') + '>';
      if (it) {
        grid += '<canvas data-icon="' + (it.type === 'relic' ? it.id : it.type) + '" width="96" height="96"></canvas>'
          + '<span class="inv-n"' + (it.type === 'coin' ? ' id="inv-coin-n"' : '') + '>' + it.n + '</span>'
          + (worn ? '<span class="inv-worn">worn</span>' : '');
      }
      grid += '</button>';
    }
    grid += '</div>';
    return '<h2>INVENTORY</h2><div class="inv-wrap">' + grid
      + '<div class="inv-detail" data-doodle="#b8b2a3" data-paper="1" data-weight="2">' + this.detailHtml(slots[this.sel]) + '</div></div>';
  },

  detailHtml(it) {
    if (!it) return '';
    if (it.type === 'coin') {
      return '<h3>Coins</h3><p>What skins are bought with. You have <b>' + Save.coins + '</b>.</p>';
    }
    if (it.type === 'chest') {
      return '<h3>Chest</h3><p>Could be a relic in it. Could be coins. Usually it is nothing.</p>'
        + '<button id="inv-open" data-doodle="#9a6a36">OPEN</button>';
    }
    const r = relicById(it.id);
    const held = Save.data.relics[it.id] || 0;
    const worn = Save.data.relicOn === it.id;
    return '<h3 style="color:' + r.color + '">' + r.name + '</h3>'
      + '<p>' + r.text(Math.min(r.cap, held)) + '</p>'
      + '<p class="hint">only one relic can be worn at a time</p>'
      + (worn
        ? '<button id="inv-wear" class="equipped" data-doodle="#4c9f70">WORN &check; (take off)</button>'
        : '<button id="inv-wear" data-doodle="ink">WEAR</button>');
  },

  bindInv(body) {
    body.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
      Sfx.play('button', { volume: 0.5 });
      this.sel = +b.dataset.slot;
      this.render();
    });
    const slots = Relics.slots();
    const it = slots[this.sel];
    const open = body.querySelector('#inv-open');
    if (open) open.onclick = () => ChestModal.open(() => this.render());
    const wear = body.querySelector('#inv-wear');
    if (wear) wear.onclick = () => {
      Save.wearRelic(Save.data.relicOn === it.id ? null : it.id);
      Sfx.play('card_buy', { volume: 0.6 });
      this.render();
    };
  }
};

/* ------------------------------------------------ who does the searching
   The Blob'd-Tier, out on the page. It hops about; on every minute of the
   search it lobs a blot straight up out of sight and sits and waits; ten
   seconds later the blot comes down and where it lands there is either a
   chest or nothing. It lands on a chest exactly when the search really did
   turn one up since the last blot came down. */
const SearchAnim = {
  raf: 0, cv: null,
  start(cv) {
    this.stop();
    if (!cv) return;
    this.cv = cv;
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.cv = null; },

  draw() {
    const cv = this.cv;
    if (!cv || !cv.isConnected) return this.stop();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 240, h = cv.clientHeight || 130;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const now = Date.now(), t = now / 1000;
    const ground = h - 18;
    Rough.boil(4242, Math.floor(t * 3.5));
    Rough.line(ctx, 6, ground + 12, w - 6, ground + 12, { color: '#b8b2a3', width: 1.6, jitter: 0.8, passes: 1 });
    const s = Save.data.search;
    const blob = { id: 4242, recoil: 0, wob: 0, x: w * 0.3, y: ground, aim: -Math.PI / 2 };
    if (!s) {
      // nobody out looking: it naps
      blob.recoil = 0.5 + Math.sin(t * 1.5) * 0.3;
      this.blob(ctx, blob, t, true);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        ctx.save(); ctx.globalAlpha = Math.sin(k * Math.PI);
        Rough.text(ctx, 'z', blob.x + 18 + k * 20, blob.y - 30 - k * 26, 12 + k * 8, '#8a8a8a');
        ctx.restore();
      }
      return;
    }
    const E0 = Math.max(0, now - s.start);
    const m = Math.floor(E0 / 60000), sec = (E0 % 60000) / 1000;
    const landX = w * (0.45 + ((m * 0.618) % 1) * 0.4);
    // what the blot of minute m finds: any chest turned up since the last
    // blot landed
    const landAt = m * 60000 + 10000;
    const found = s.finds.some(f => f > landAt - 60000 && f <= landAt);
    if (sec < 10) {
      // shoot, then sit still and look up
      const shot = sec < 1.2;
      blob.recoil = shot ? Math.max(0, 1 - sec / 0.4) : 0;
      blob.x = w * 0.3;
      this.blob(ctx, blob, t, false);
      if (shot) {
        const k = sec / 1.2;
        const bx = blob.x + (landX - blob.x) * k * 0.3, by = blob.y - 14 - k * k * (h + 30);   // slow off the mark, then gone
        Rough.line(ctx, bx, by + 6, bx, by + 20, { color: '#6b4fb0', width: 2, jitter: 0.6, passes: 1, alpha: 0.5 });
        Rough.blob(ctx, bx, by, 5, '#6b4fb0', '#2b2b2b', { spacing: 3, fillWidth: 3, sides: 7, width: 1.6 });
      } else {
        // waiting: a little '...' over its head
        const dots = 1 + Math.floor(sec * 2) % 3;
        Rough.text(ctx, '.'.repeat(dots), blob.x, blob.y - 36, 16, '#6b4fb0');
      }
      return;
    }
    // the blot comes down, then whatever was under it
    const since = sec - 10;
    if (since < 0.7) {
      const k = E.clamp01(since / 0.5);
      const by = -10 + (ground - 4 + 10) * k * k;
      Rough.blob(ctx, landX, by, 5, '#6b4fb0', '#2b2b2b', { spacing: 3, fillWidth: 3, sides: 7, width: 1.6 });
      if (k >= 1) Rough.circle(ctx, landX, ground, 6 + (since - 0.5) * 60, { color: '#6b4fb0', width: 2, jitter: 1, alpha: 1 - (since - 0.5) / 0.2 });
    } else if (since < 8) {
      const a = since > 6.5 ? 1 - (since - 6.5) / 1.5 : 1;
      const pop = E.back(E.clamp01((since - 0.7) / 0.35));
      if (found) {
        Rough.bloom(ctx, landX, ground - 10, 34, '#f2c230', 0.7 * a);
        ctx.save(); ctx.globalAlpha = a;
        ItemIcons.chest(ctx, landX, ground - 8 * pop, 15 * pop, since < 2);
        ctx.restore();
        for (let i = 0; i < 4; i++) {
          const ang = -Math.PI / 2 + (i - 1.5) * 0.5;
          Rough.line(ctx, landX + Math.cos(ang) * 20, ground - 12 + Math.sin(ang) * 20, landX + Math.cos(ang) * 28, ground - 12 + Math.sin(ang) * 28,
            { color: '#e8a93a', width: 2, jitter: 0.3, passes: 1, alpha: a });
        }
      } else {
        ctx.save(); ctx.globalAlpha = 0.35 * a * (1 - pop * 0.5);
        ctx.fillStyle = '#b8ad9c';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(landX + (i - 1) * 9, ground - 4 - pop * 4, 6 + pop * 4, 0, 7); ctx.fill(); }
        ctx.restore();
        ctx.save(); ctx.globalAlpha = a * 0.8;
        Rough.text(ctx, 'nothing', landX, ground - 22, 12, '#8a8a8a');
        ctx.restore();
      }
    }
    // and in between shots it hops about
    const hopT = t * 1.6;
    const ph = hopT % 1;
    blob.x = w * 0.3 + Math.sin(t * 0.7) * w * 0.14;
    blob.y = ground - Math.sin(ph * Math.PI) * 14;
    blob.recoil = ph < 0.15 ? 1 - ph / 0.15 : 0;
    blob.aim = Math.cos(t * 0.7) > 0 ? 0 : Math.PI;
    if (since < 1) { blob.x = w * 0.3; blob.y = ground; blob.aim = Math.atan2(-10, landX - blob.x); blob.recoil = 0; }
    this.blob(ctx, blob, t, false);
  },

  blob(ctx, b, t, asleep) {
    ctx.save();
    ctx.translate(b.x, b.y - 12);
    ctx.scale(1.25, 1.25);
    Sentry.prototype.drawBlobd.call(Object.assign({}, b, { x: 0, y: 0 }), ctx, t);
    if (asleep) {                                  // eye shut
      ctx.fillStyle = '#6b4fb0';
      ctx.beginPath(); ctx.ellipse(0, -2, 6.5, 6.5, 0, 0, 7); ctx.fill();
      Rough.line(ctx, -4, -2, 4, -2, { color: '#2b2b2b', width: 1.6, jitter: 0.3, passes: 1 });
    }
    ctx.restore();
  }
};

function hms(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0');
}

/* Paint an item icon into a canvas marked data-icon. */
function paintIcon(cv) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const kind = cv.dataset.icon;
  const item = kind === 'coin' || kind === 'chest' ? { type: kind } : { type: 'relic', id: kind };
  Rough.boil(kind.length * 17 + 3, 0);
  drawItemIcon(g, item, cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.36);
}

/* ------------------------------------------------------ opening a chest */
const ChestModal = {
  raf: 0, t: 0, got: null, after: null,

  open(after) {
    this.after = after || this.after;
    const got = Relics.openChest();
    if (!got) return;
    this.got = got;
    this.t = 0;
    this.sounded = false;
    document.getElementById('chest-modal').classList.remove('hidden');
    document.getElementById('chest-result').innerHTML = '';
    document.getElementById('chest-again').classList.add('hidden');
    document.getElementById('chest-done').classList.add('hidden');
    Doodle.scan(document.getElementById('chest-modal'));
    Sfx.play('card_draw', { volume: 0.8 });
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      this.t += dt;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  close() {
    cancelAnimationFrame(this.raf);
    document.getElementById('chest-modal').classList.add('hidden');
    if (this.after) this.after();
    Menu.syncDot();
  },

  reveal() {
    const g = this.got;
    let line;
    if (g.kind === 'relic') {
      const r = relicById(g.id);
      line = '<b style="color:' + r.color + '">' + r.name + '</b><span>' + r.text(1).split('. Now')[0] + '.</span>';
      Sfx.play('crit', { volume: 0.9, rateVar: 0 });
    } else if (g.kind === 'coins') {
      line = '<b style="color:#a5741b">+' + g.n + ' coins</b>';
      Sfx.play('card_buy', { volume: 1, rateVar: 0 });
    } else {
      line = '<b style="color:#8a8a8a">empty</b><span>just dust</span>';
      Sfx.play('click_miss', { volume: 0.8 });
    }
    document.getElementById('chest-result').innerHTML = line;
    const again = document.getElementById('chest-again');
    again.classList.toggle('hidden', Save.data.chests <= 0);
    document.getElementById('chest-left').textContent = '(' + Save.data.chests + ')';   // not the button's own text: that would wipe its crayon frame
    document.getElementById('chest-done').classList.remove('hidden');
    Doodle.scan(document.getElementById('chest-modal'));
  },

  draw() {
    const cv = document.getElementById('chest-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 280, h = cv.clientHeight || 200;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const OPEN_AT = 0.95, t = this.t;
    const cx = w / 2, cy = h * 0.66;
    Rough.boil(77, Math.floor(t * 7));
    if (t < OPEN_AT) {
      // it rattles harder and harder, then the lid goes
      const k = t / OPEN_AT, sh = k * k * 6;
      const hop = Math.abs(Math.sin(t * 28)) * k * 5;
      ItemIcons.chest(ctx, cx + Rough.jit(sh), cy - hop, 42, false);
      return;
    }
    if (!this.sounded) { this.sounded = true; this.reveal(); }
    const p = Math.min(1, (t - OPEN_AT) / 0.6), o = E.out(p);
    const g = this.got;
    const glow = g.kind === 'relic' ? relicById(g.id).color : g.kind === 'coins' ? '#f2c230' : '#b8b2a3';
    if (g.kind !== 'empty') {
      Rough.bloom(ctx, cx, cy - 40, 70 + o * 30, glow, 0.8 - p * 0.3);
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i - 4.5) * 0.28;
        const r0 = 30 + o * 20, r1 = r0 + 26 * (1 - p * 0.5);
        Rough.line(ctx, cx + Math.cos(a) * r0, cy - 30 + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy - 30 + Math.sin(a) * r1,
          { color: glow, width: 2.2, jitter: 0.6, passes: 1, alpha: 1 - p * 0.6 });
      }
    }
    ItemIcons.chest(ctx, cx, cy, 42, true);
    const iy = cy - 30 - o * 50;
    if (g.kind === 'relic') drawItemIcon(ctx, { type: 'relic', id: g.id }, cx, iy, 26);
    else if (g.kind === 'coins') {
      for (let i = 0; i < Math.min(6, g.n); i++) ItemIcons.coin(ctx, cx + (i - (g.n - 1) / 2) * 16, iy + (i % 2) * 8, 11);
    } else {
      // a puff of dust and nothing else
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - p);
      ctx.fillStyle = '#b8ad9c';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx + (i - 2) * 16, iy + 18 - o * 10, 12 + o * 10, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  }
};

/* ------------------------------------------------- a skin pack's settings */
const PackModal = {
  open(pack, after) {
    this.pack = pack; this.after = after;
    document.getElementById('pack-title').textContent = pack.name;
    this.render();
    document.getElementById('pack-modal').classList.remove('hidden');
  },
  close() {
    document.getElementById('pack-modal').classList.add('hidden');
    if (this.after) this.after();
  },
  render() {
    const list = document.getElementById('pack-list');
    list.innerHTML = '';
    for (const id of this.pack.skins) {
      const skin = skinById(id);
      const target = Object.keys(skin.applies)[0];
      const on = Save.isEquipped(skin);
      const row = document.createElement('div');
      row.className = 'pack-row';
      row.dataset.doodle = on ? '#4c9f70' : '#b8b2a3'; row.dataset.paper = '1'; row.dataset.weight = '2.4';
      const cv = document.createElement('canvas');
      cv.width = 96; cv.height = 96; cv.className = 'pack-icon';
      row.appendChild(cv);
      row.insertAdjacentHTML('beforeend', '<div class="pack-text"><b style="color:' + skin.color + '">' + skin.name + '</b><span>'
        + targetName(target) + ' skin</span></div>');
      const btn = document.createElement('button');
      btn.textContent = on ? 'ON ✓' : 'OFF';
      btn.className = on ? 'equipped' : '';
      btn.dataset.doodle = on ? '#4c9f70' : 'ink';
      btn.onclick = () => {
        if (on) Save.unequip(skin); else Save.equip(skin);
        Sfx.play('button', { volume: 0.7 });
        this.render();
      };
      row.appendChild(btn);
      list.appendChild(row);
      drawSkinIcon(cv, skin);
    }
    Doodle.scan(document.getElementById('pack-modal'));
  }
};

/* What a skin target is called, for the line under a skin's name. */
function targetName(target) {
  const [kind, id] = target.split(':');
  if (kind === 'cursor') return cursorById(id).name;
  if (kind === 'sentry') { const u = ONESHOT.find(o => SENTRY_OF[o.id] === id); return u ? u.name : id; }
  return id;
}

window.addEventListener('load', () => {
  document.getElementById('chest-done').onclick = () => { Sfx.play('button', { volume: 0.6 }); ChestModal.close(); };
  document.getElementById('chest-again').onclick = () => ChestModal.open();
  document.getElementById('pack-close').onclick = () => { Sfx.play('button', { volume: 0.6 }); PackModal.close(); };
  // outside the popup closes it too; a chest only once it has been opened
  document.getElementById('pack-modal').addEventListener('click', e => {
    if (e.target.id === 'pack-modal') PackModal.close();
  });
  document.getElementById('chest-modal').addEventListener('click', e => {
    if (e.target.id === 'chest-modal' && !document.getElementById('chest-done').classList.contains('hidden')) ChestModal.close();
  });
  More.settle();
});
