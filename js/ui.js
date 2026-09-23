/* FANDHARN - DOM layer: title menu, HUD, end screen. The between-wave offers
   are drawn on the canvas, so there is no shop markup here. */

const UI = {
  game: null,

  bind(game) {
    this.game = game;
    this.menu = document.getElementById('menu');
    this.hud = document.getElementById('hud');
    this.end = document.getElementById('end');
    const tag = document.getElementById('build-tag');
    if (tag) tag.textContent = 'build ' + (window.BUILD_V || '?');

    // the mode toggle sits above the difficulties and just flags the next start
    this.endless = false;
    const modeBtns = document.querySelectorAll('[data-mode]');
    const paintMode = () => modeBtns.forEach(b2 =>
      b2.classList.toggle('on', (b2.dataset.mode === 'endless') === this.endless));
    modeBtns.forEach(b2 => b2.addEventListener('click', () => {
      Sfx.play('button', { volume: 0.7 });
      this.endless = b2.dataset.mode === 'endless';
      paintMode();
    }));
    paintMode();

    document.querySelectorAll('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => { Sfx.play('button', { volume: 0.7 }); game.start(btn.dataset.diff, this.endless); });
    });
    const skillBtn = document.getElementById('skill-button');
    skillBtn.addEventListener('click', e => { e.stopPropagation(); game.castSkill(); });
    skillBtn.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); game.castSkill(); }, { passive: false });
    skillBtn.addEventListener('contextmenu', e => e.preventDefault());

    const pause = document.getElementById('hud-pause');
    pause.addEventListener('click', e => { e.stopPropagation(); game.togglePause(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') game.togglePause();
    });

    const mute = document.getElementById('hud-mute');
    const paint = () => {
      mute.textContent = Sfx.muted ? 'SOUND OFF' : 'SOUND ON';
      mute.classList.toggle('off', Sfx.muted);
    };
    mute.addEventListener('click', e => { e.stopPropagation(); Sfx.toggleMute(); paint(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'm' || e.key === 'M') { Sfx.toggleMute(); paint(); }
    });
    paint();

    document.querySelectorAll('[data-action="menu"]').forEach(btn => {
      btn.addEventListener('click', () => { Sfx.play('button', { volume: 0.7 }); this.showMenu(); });
    });
    this.showMenu();
  },

  /* The button is there for everyone - right-click still works too. */
  showSkillButton() {
    const b = document.getElementById('skill-button');
    if (b) b.classList.remove('hidden');
  },

  paintPause(on) {
    const b = document.getElementById('hud-pause');
    if (b) { b.textContent = on ? 'RESUME' : 'PAUSE'; b.classList.toggle('off', on); }
  },

  hideSkillButton() {
    const b = document.getElementById('skill-button');
    if (b) b.classList.add('hidden');
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
    this.hideSkillButton();
  },

  hideAll() {
    this.menu.classList.add('hidden');
    this.end.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.showSkillButton();
  },

  syncHud(g) {
    const d = DIFFICULTIES[g.difficulty];

    // wave pips, with the boss waves marked. Past the tenth there is no end to
    // count toward, so the row becomes the block of five you are inside.
    const pips = [];
    const past = g.endless && g.wave > WAVES_PER_RUN;
    const from = past ? Math.floor((g.wave - 1) / ENDLESS_BOSS_EVERY) * ENDLESS_BOSS_EVERY + 1 : 1;
    const to = past ? from + ENDLESS_BOSS_EVERY - 1 : WAVES_PER_RUN;
    for (let i = from; i <= to; i++) {
      const boss = past ? (i % ENDLESS_BOSS_EVERY === 0) : !!WAVE_TABLE[i - 1].boss;
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
    diffEl.textContent = g.endless ? d.name + ' \u00b7 ENDLESS' : d.name;
    diffEl.style.color = d.color;
    diffEl.style.borderColor = d.color;

    const cur = cursorById(g.cursorId);
    const chip = document.getElementById('hud-cursor');
    const chipText = cur.name + '  ' + g.clickDamage() + ' dmg'
      + (cur.every > 0 ? '  ' + (g.cursorCharge % cur.every) + '/' + cur.every : '');
    if (chip.textContent !== chipText) chip.textContent = chipText;
    chip.style.color = cur.color;
    chip.style.borderColor = cur.color;

    // skill chip: charging, ready, or cooling down
    const skill = skillFor(g.cursorId);
    const chipEl = document.getElementById('hud-skill');
    const btnEl = document.getElementById('skill-button');
    const btnLabel = document.getElementById('skill-button-label');
    let txt, cls;
    if (g.skillCd > 0) { txt = skill.name + '  ' + Math.ceil(g.skillCd) + 's'; cls = 'cooling'; }
    else if (g.skillCharge >= SKILL_CHARGE) { txt = skill.name + '  READY'; cls = 'ready'; }
    else { txt = skill.name + '  ' + g.skillCharge + '/' + SKILL_CHARGE; cls = ''; }
    chipEl.textContent = txt;
    chipEl.className = 'skill-chip ' + cls;
    chipEl.style.borderColor = cls === 'ready' ? cur.color : '';
    chipEl.style.color = cls === 'ready' ? cur.color : '';
    if (btnEl) {
      btnLabel.textContent = cls === 'cooling' ? Math.ceil(g.skillCd) + 's' : (cls === 'ready' ? skill.name : g.skillCharge + '/' + SKILL_CHARGE);
      btnEl.className = 'skill-button ' + cls;
      btnEl.style.borderColor = cls === 'ready' ? cur.color : '';
      btnEl.style.color = cls === 'ready' ? cur.color : '';
    }

    const badges = [];
    for (const u of ONESHOT) {
      if (u.sentry) continue;                       // shown as the post, below
      if (g.oneshot[u.id]) badges.push(badge(u.name, u.color, ''));
    }
    if (g.sentryType) {
      const post = ONESHOT.find(u => SENTRY_OF[u.id] === g.sentryType);
      if (post) badges.push(badge(post.name, post.color, ''));
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
    this.hideSkillButton();
    const title = document.getElementById('end-title');
    if (won) Sfx.play('victory', { volume: 1, rateVar: 0 });   // the loss plays with the collapse
    title.textContent = won ? 'FANDHARN HOLDS' : 'THE CASTLE FELL';
    title.style.color = won ? '#4c9f70' : '#c8433a';
    const stacks = STACKING
      .map(u => ({ u, lv: g.stacking[u.id] || 0 }))
      .filter(s => s.lv > 0)
      .map(s => s.u.name + ' ×' + s.lv);
    document.getElementById('end-body').innerHTML =
      '<div>' + DIFFICULTIES[g.difficulty].name
      + (g.endless ? ' &middot; endless &middot; wave ' + g.wave + ' reached'
        : ' &middot; wave ' + g.wave + ' of ' + WAVES_PER_RUN) + '</div>'
      + '<div>' + g.totalKills + ' scribbles erased</div>'
      + '<div>castle ' + g.castleHp + '/' + g.maxHp + '</div>'
      + '<div>holding: ' + cursorById(g.cursorId).name + '</div>'
      + (stacks.length ? '<div class="end-small">' + stacks.join(' &middot; ') + '</div>' : '');
  }
};

function badge(name, color, suffix) {
  return '<span class="badge" style="border-color:' + color + ';color:' + color + '">'
    + name + (suffix ? ' ' + suffix : '') + '</span>';
}
