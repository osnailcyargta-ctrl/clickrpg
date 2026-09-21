/* FANDHARN - DOM layer: title menu, HUD, end screen. The between-wave offers
   are drawn on the canvas, so there is no shop markup here. */

const UI = {
  game: null,

  bind(game) {
    this.game = game;
    this.menu = document.getElementById('menu');
    this.hud = document.getElementById('hud');
    this.end = document.getElementById('end');

    document.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => game.start(btn.dataset.diff));
    });
    document.querySelectorAll('[data-action="menu"]').forEach(btn => {
      btn.addEventListener('click', () => this.showMenu());
    });
    this.showMenu();
  },

  showMenu() {
    this._pipHtml = this._badgeHtml = null;
    this.game.state = 'menu';
    this.game.enemies = [];
    this.game.effects = [];
    this.game.banner = null;
    this.game.offerScreen = null;
    this.hideAll();
    this.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
  },

  hideAll() {
    this.menu.classList.add('hidden');
    this.end.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  syncHud(g) {
    const d = DIFFICULTIES[g.difficulty];

    // wave pips, with the boss waves marked
    const pips = [];
    for (let i = 1; i <= WAVES_PER_RUN; i++) {
      const boss = !!WAVE_TABLE[i - 1].boss;
      const cls = 'pip' + (i < g.wave ? ' done' : (i === g.wave ? ' now' : '')) + (boss ? ' boss' : '');
      pips.push('<i class="' + cls + '"></i>');
    }
    const pipHtml = '<span class="pip-label">W' + Math.max(1, g.wave) + '</span>' + pips.join('');
    if (this._pipHtml !== pipHtml) {
      this._pipHtml = pipHtml;
      document.getElementById('hud-pips').innerHTML = pipHtml;
    }

    const purse = document.getElementById('hud-scribbles');
    if (purse.textContent !== String(g.scribbles)) {
      purse.textContent = g.scribbles;
      purse.classList.remove('bump');
      void purse.offsetWidth;          // restart the little bump animation
      purse.classList.add('bump');
    }

    const diffEl = document.getElementById('hud-diff');
    diffEl.textContent = d.name;
    diffEl.style.color = d.color;
    diffEl.style.borderColor = d.color;

    const cur = cursorById(g.cursorId);
    const chip = document.getElementById('hud-cursor');
    const chipText = cur.name + (cur.every > 0 ? '  ' + (g.cursorCharge % cur.every) + '/' + cur.every : '');
    if (chip.textContent !== chipText) chip.textContent = chipText;
    chip.style.color = cur.color;
    chip.style.borderColor = cur.color;

    const badges = [];
    for (const u of ONESHOT) {
      if (g.oneshot[u.id]) badges.push(badge(u.name, u.color, ''));
    }
    for (const u of STACKING) {
      const lv = g.stacking[u.id] || 0;
      if (lv > 0 && u.id !== 'patch') badges.push(badge(u.name, u.color, '×' + lv));
    }
    const badgeHtml = badges.join('');
    if (this._badgeHtml !== badgeHtml) {
      this._badgeHtml = badgeHtml;
      document.getElementById('hud-upgrades').innerHTML = badgeHtml;
    }
  },

  showEnd(g, won) {
    this.end.classList.remove('hidden');
    this.hud.classList.add('hidden');
    const title = document.getElementById('end-title');
    title.textContent = won ? 'FANDHARN HOLDS' : 'THE CASTLE FELL';
    title.style.color = won ? '#4c9f70' : '#c8433a';
    const stacks = STACKING
      .map(u => ({ u, lv: g.stacking[u.id] || 0 }))
      .filter(s => s.lv > 0)
      .map(s => s.u.name + ' ×' + s.lv);
    document.getElementById('end-body').innerHTML =
      '<div>' + DIFFICULTIES[g.difficulty].name + ' &middot; wave ' + g.wave + ' of ' + WAVES_PER_RUN + '</div>'
      + '<div>' + g.totalKills + ' scribbles erased</div>'
      + '<div>castle ' + g.castleHp + '/' + CASTLE_HP + '</div>'
      + '<div>holding: ' + cursorById(g.cursorId).name + '</div>'
      + (stacks.length ? '<div class="end-small">' + stacks.join(' &middot; ') + '</div>' : '');
  }
};

function badge(name, color, suffix) {
  return '<span class="badge" style="border-color:' + color + ';color:' + color + '">'
    + name + (suffix ? ' ' + suffix : '') + '</span>';
}
