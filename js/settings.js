/* FANDHARN - settings: the 3D lean, low graphics, and sound. Kept in the
   browser like the save, and opened from MORE or from the pause screen.

   Low graphics is for weak phones: the renderer draws in one pass with
   batched strokes and no glow (Rough.setLow), the decorative extras are off
   (Fx.low, held on), the canvas drops to one pixel per CSS pixel, the menu
   frames redraw less often, and the game runs at a steady 30 frames a second
   instead of a stuttering 40-something. On a first visit from what looks
   like a low-end phone it starts switched on. */

const Settings = {
  KEY: 'fandharn.settings',
  data: { parallax: true, low: null },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.parallax === 'boolean') this.data.parallax = d.parallax;
        if (typeof d.low === 'boolean') this.data.low = d.low;
      }
    } catch (e) { /* no storage: defaults */ }
    if (this.data.low == null) this.data.low = this.guessLow();
    this.apply();
    return this;
  },

  /* A touch screen with few cores or little memory: probably a cheap phone. */
  guessLow() {
    try {
      const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const cores = navigator.hardwareConcurrency || 8;
      const mem = navigator.deviceMemory || 8;
      return !!touch && (cores <= 4 || mem <= 3);
    } catch (e) { return false; }
  },

  set(key, value) {
    this.data[key] = value;
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { }
    this.apply();
  },

  apply() {
    const low = !!this.data.low;
    Rough.setLow(low);
    Fx.forced = low;
    Fx.low = low;
    if (!low) { Fx.slowFor = 0; Fx.fastFor = 0; }
    if (typeof Doodle !== 'undefined') Doodle.RATE = low ? 2 : 3.5;
    if (typeof Game !== 'undefined' && Game.canvas) Game.resize();
  }
};

/* The settings panel, drawn into any container: MORE's settings page and
   the popup over the pause screen use the same one. */
function renderSettings(el) {
  el.innerHTML = '';
  const row = (label, hint) => {
    const r = document.createElement('div');
    r.className = 'set-row';
    r.dataset.doodle = '#b8b2a3'; r.dataset.paper = '1'; r.dataset.weight = '2';
    r.innerHTML = '<div class="set-label"><b>' + label + '</b>' + (hint ? '<span>' + hint + '</span>' : '') + '</div>';
    el.appendChild(r);
    return r;
  };
  const toggle = (r, on, flip) => {
    const b = document.createElement('button');
    b.className = 'set-toggle' + (on ? ' equipped' : '');
    b.textContent = on ? 'ON ✓' : 'OFF';
    b.dataset.doodle = on ? '#4c9f70' : 'ink';
    b.onclick = () => { flip(); Sfx.play('button', { volume: 0.7 }); renderSettings(el); };
    r.appendChild(b);
  };
  toggle(row('3D PARALLAX', 'the page leans toward the cursor'), Settings.data.parallax,
    () => Settings.set('parallax', !Settings.data.parallax));
  toggle(row('LOW GRAPHICS', 'for slow phones: plainer drawing, steady 30 fps'), Settings.data.low,
    () => Settings.set('low', !Settings.data.low));
  toggle(row('SOUND'), !Sfx.muted, () => { Sfx.toggleMute(); if (UI.paintMute) UI.paintMute(); });
  // volume: ten notches, like a crayon-drawn slider
  const vr = row('VOLUME');
  const notches = document.createElement('div');
  notches.className = 'set-notches';
  const level = Math.round(Sfx.volume * 10);
  for (let i = 1; i <= 10; i++) {
    const n = document.createElement('button');
    n.className = 'set-notch' + (i <= level ? ' on' : '');
    n.dataset.doodle = i <= level ? '#2f8fd6' : '#b8b2a3';
    if (i <= level) n.dataset.fill = '#2f8fd6';
    n.dataset.weight = '1.8';
    n.style.height = (10 + i * 2.4) + 'px';
    n.setAttribute('aria-label', 'volume ' + i * 10 + '%');
    n.onclick = () => {
      Sfx.setVolume(i / 10);
      if (Sfx.muted) { Sfx.toggleMute(); if (UI.paintMute) UI.paintMute(); }
      Sfx.play('button', { volume: 0.9 });
      renderSettings(el);
    };
    notches.appendChild(n);
  }
  vr.appendChild(notches);
  Doodle.scan(el);
}

const SettingsModal = {
  open() {
    renderSettings(document.getElementById('settings-body'));
    document.getElementById('settings-modal').classList.remove('hidden');
    Doodle.scan(document.getElementById('settings-modal'));
  },
  close() {
    const m = document.getElementById('settings-modal');
    if (m) m.classList.add('hidden');
  }
};

window.addEventListener('load', () => {
  document.getElementById('settings-close').onclick = e => { e.stopPropagation(); Sfx.play('button', { volume: 0.6 }); SettingsModal.close(); };
  document.getElementById('settings-modal').addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.id === 'settings-modal') SettingsModal.close();
  });
  ['pointerdown', 'mousedown', 'touchstart'].forEach(ev =>
    document.getElementById('settings-modal').addEventListener(ev, e => e.stopPropagation()));
});
