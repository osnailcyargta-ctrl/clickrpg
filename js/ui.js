/* FANDHARN - DOM layer: title menu, HUD, between-wave shop, end screens. */

const UI = {
  game: null,

  bind(game) {
    this.game = game;
    this.menu = document.getElementById('menu');
    this.hud = document.getElementById('hud');
    this.shop = document.getElementById('shop');
    this.end = document.getElementById('end');
    this.shopList = document.getElementById('shop-list');

    document.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => game.start(btn.dataset.diff));
    });
    document.getElementById('shop-continue').addEventListener('click', () => {
      this.hideAll();
      game.startWave();
    });
    document.querySelectorAll('[data-action="menu"]').forEach(btn => {
      btn.addEventListener('click', () => this.showMenu());
    });
    this.showMenu();
  },

  showMenu() {
    this.game.state = 'menu';
    this.game.enemies = [];
    this.game.effects = [];
    this.hideAll();
    this.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
  },

  hideAll() {
    this.menu.classList.add('hidden');
    this.shop.classList.add('hidden');
    this.end.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  syncHud(g) {
    const d = DIFFICULTIES[g.difficulty];
    document.getElementById('hud-wave').textContent = 'WAVE ' + Math.max(1, g.wave) + '/' + WAVES_PER_RUN;
    document.getElementById('hud-diff').textContent = d.name;
    document.getElementById('hud-diff').style.color = d.color;
    document.getElementById('hud-scribbles').textContent = g.scribbles + ' scribbles';
    const cur = cursorById(g.cursorId);
    const chargeTxt = cur.every > 0 ? ' (' + (g.cursorCharge % cur.every) + '/' + cur.every + ')' : '';
    const holder = document.getElementById('hud-cursor');
    holder.textContent = cur.name + chargeTxt;
    holder.style.color = cur.color;
    const badges = UPGRADES
      .filter(u => g.upgrades[u.id])
      .map(u => '<span class="badge" style="border-color:' + u.color + ';color:' + u.color + '">'
        + u.name + ' ' + 'I'.repeat(g.upgrades[u.id]) + '</span>')
      .join('');
    document.getElementById('hud-upgrades').innerHTML = badges;
  },

  showShop(g) {
    this.shop.classList.add('hidden');
    this.hud.classList.add('hidden');   // the shop covers the paper, HUD would just bleed through
    document.getElementById('shop-title').textContent = 'WAVE ' + g.wave + ' DOWN';
    this.renderShop(g);
    this.shop.classList.remove('hidden');
  },

  renderShop(g) {
    const html = [];
    document.getElementById('shop-purse').textContent = g.scribbles + ' scribbles';

    html.push('<h3 class="shop-head">CURSORS <small>the cursor is the weapon - only one at a time</small></h3>');
    for (const c of CURSORS) {
      const ownedIt = !!g.owned[c.id];
      const active = g.cursorId === c.id;
      const afford = g.scribbles >= c.cost;
      let btn;
      if (active) btn = '<button class="buy equipped" disabled>EQUIPPED</button>';
      else if (ownedIt) btn = '<button class="buy own" data-equip="' + c.id + '">EQUIP</button>';
      else btn = '<button class="buy' + (afford ? '' : ' poor') + '" data-buy-cursor="' + c.id + '"'
        + (afford ? '' : ' disabled') + '>' + c.cost + '</button>';
      html.push(
        '<div class="card' + (active ? ' active' : '') + '" style="--accent:' + c.color + '">'
        + '<div class="card-main"><div class="card-name">' + c.name + '</div>'
        + '<div class="card-desc">' + c.desc + '</div>'
        + '<div class="card-detail">' + c.detail + '</div></div>' + btn + '</div>');
    }

    html.push('<h3 class="shop-head">UPGRADES <small>passive, they keep working with any cursor</small></h3>');
    for (const u of UPGRADES) {
      const lv = g.upgrades[u.id] || 0;
      const maxed = lv >= u.levels;
      const cost = maxed ? 0 : u.cost[lv];
      const afford = g.scribbles >= cost;
      const btn = maxed
        ? '<button class="buy equipped" disabled>MAX</button>'
        : '<button class="buy' + (afford ? '' : ' poor') + '" data-buy-up="' + u.id + '"'
        + (afford ? '' : ' disabled') + '>' + cost + '</button>';
      html.push(
        '<div class="card' + (lv > 0 ? ' active' : '') + '" style="--accent:' + u.color + '">'
        + '<div class="card-main"><div class="card-name">' + u.name
        + (lv > 0 ? ' <span class="lvl">lv ' + lv + '/' + u.levels + '</span>' : '') + '</div>'
        + '<div class="card-desc">' + u.desc + '</div>'
        + '<div class="card-detail">' + upgradeDetail(u, Math.min(u.levels, lv + (maxed ? 0 : 1))) + '</div></div>'
        + btn + '</div>');
    }

    this.shopList.innerHTML = html.join('');

    this.shopList.querySelectorAll('[data-buy-cursor]').forEach(b => {
      b.addEventListener('click', () => {
        const c = cursorById(b.dataset.buyCursor);
        if (g.scribbles < c.cost) return;
        g.scribbles -= c.cost;
        g.owned[c.id] = true;
        g.cursorId = c.id;
        g.cursorCharge = 0;
        this.renderShop(g);
        this.syncHud(g);
      });
    });
    this.shopList.querySelectorAll('[data-equip]').forEach(b => {
      b.addEventListener('click', () => {
        g.cursorId = b.dataset.equip;
        g.cursorCharge = 0;
        this.renderShop(g);
        this.syncHud(g);
      });
    });
    this.shopList.querySelectorAll('[data-buy-up]').forEach(b => {
      b.addEventListener('click', () => {
        const u = UPGRADES.find(x => x.id === b.dataset.buyUp);
        const lv = g.upgrades[u.id] || 0;
        if (lv >= u.levels || g.scribbles < u.cost[lv]) return;
        g.scribbles -= u.cost[lv];
        g.upgrades[u.id] = lv + 1;
        if (u.id === 'molten') g.moltenCharge = 0;
        this.renderShop(g);
        this.syncHud(g);
      });
    });
  },

  showEnd(g, won) {
    this.end.classList.remove('hidden');
    this.hud.classList.add('hidden');
    document.getElementById('end-title').textContent = won ? 'FANDHARN HOLDS' : 'THE CASTLE FELL';
    document.getElementById('end-title').style.color = won ? '#4c9f70' : '#c8433a';
    document.getElementById('end-body').innerHTML =
      '<div>' + DIFFICULTIES[g.difficulty].name + ' &middot; wave ' + g.wave + '/' + WAVES_PER_RUN + '</div>'
      + '<div>' + g.totalKills + ' scribbles erased</div>'
      + '<div>castle ' + g.castleHp + '/' + CASTLE_HP + ' hp left</div>'
      + '<div>weapon: ' + cursorById(g.cursorId).name + '</div>';
  }
};
