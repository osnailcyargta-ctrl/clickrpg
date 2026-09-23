/* FANDHARN - sound. Every effect is a pre-rendered mp3 in assets/sfx; nothing
   is synthesised at runtime, so swapping any file for your own recording of
   the same name just works.

   Web Audio is used when it can be (lowest latency, proper polyphony). Opening
   index.html straight off the disk blocks fetch() on file:// URLs, so there is
   an <audio> element fallback that works there too. */

const Sfx = {
  names: [
    'click_hit', 'click_miss', 'crit', 'kill', 'kill_big', 'castle_hit', 'ward',
    'wave_start', 'wave_clear', 'card_draw', 'card_buy', 'skip', 'boss_spawn',
    'warden_shield', 'game_over', 'victory', 'fire_blast', 'water_pop', 'zap',
    'erase', 'compass_ring', 'snip', 'sentry_shot', 'ink_splat', 'button',
    'thunder_strike', 'thunder_roll', 'storm_cloud', 'skill_ready', 'skill_cast',
    'skill_charge', 'push_wave', 'guillotine',
    'sk_thunderhead', 'sk_perimeter', 'sk_guillotine', 'sk_eightways',
    'sk_cloudburst', 'sk_crosshatch', 'sk_blankslate', 'sk_exclamation',
    'eagle_screech', 'eagle_dash', 'bolt_shot', 'eagle_death',
    'magnet_pull', 'magnet_burst', 'boomerang',
    'sk_polereversal', 'sk_flightpath', 'sk_seconddraft',
    'hive_drone', 'bee_swarm', 'queen_screech', 'larva_pop',
    'steroid_charge', 'lava_erupt', 'lava_land', 'grass_fire',
    'auger_screech', 'auger_chitter', 'auger_charge', 'auger_dash',
    'trap_dig', 'trap_emerge', 'trap_snap'
  ],
  path: 'assets/sfx/',
  ver: (typeof window !== 'undefined' && window.BUILD_V) ? '?v=' + window.BUILD_V : '',

  ctx: null,
  master: null,
  buffers: {},        // name -> AudioBuffer
  pools: {},          // name -> [HTMLAudioElement] for the file:// fallback
  active: {},         // name -> how many voices are sounding right now
  lastAt: {},         // name -> when it last started, for throttling
  mode: 'idle',       // idle | webaudio | element | off
  volume: 0.7,
  muted: false,
  ready: false,

  init() {
    try {
      const v = localStorage.getItem('fandharn.volume');
      if (v !== null) this.volume = Math.max(0, Math.min(1, parseFloat(v)));
      this.muted = localStorage.getItem('fandharn.muted') === '1';
    } catch (e) { /* private window: defaults are fine */ }

    // browsers hold audio until the person interacts, so arm on first input
    const arm = () => this.unlock();
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('touchstart', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    this.preloadElements();      // cheap, and doubles as the fallback
  },

  unlock() {
    if (this.mode !== 'idle') {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.mode = 'element'; return; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.ctx.resume();
      this.mode = 'webaudio';
      this.loadBuffers();
    } catch (e) {
      this.mode = 'element';
    }
  },

  loadBuffers() {
    let failed = 0;
    for (const name of this.names) {
      fetch(this.path + name + '.mp3' + this.ver)
        .then(r => r.arrayBuffer())
        .then(buf => new Promise((res, rej) => this.ctx.decodeAudioData(buf, res, rej)))
        .then(audio => { this.buffers[name] = audio; this.ready = true; })
        .catch(() => {
          // file:// blocks fetch - fall back to the <audio> elements
          if (++failed > 2 && this.mode === 'webaudio') this.mode = 'element';
        });
    }
  },

  preloadElements() {
    for (const name of this.names) {
      const a = new Audio(this.path + name + '.mp3' + this.ver);
      a.preload = 'auto';
      a.volume = this.volume;
      this.pools[name] = [a];
    }
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    try { localStorage.setItem('fandharn.volume', String(this.volume)); } catch (e) { }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    try { localStorage.setItem('fandharn.muted', this.muted ? '1' : '0'); } catch (e) { }
    return this.muted;
  },

  /* play(name, { volume, rate, rateVar, throttle, voices }) */
  play(name, o) {
    if (this.muted || this.mode === 'off') return;
    o = o || {};
    const now = performance.now();
    const throttle = o.throttle == null ? 30 : o.throttle;
    if (this.lastAt[name] && now - this.lastAt[name] < throttle) return;
    const cap = o.voices == null ? 5 : o.voices;
    if ((this.active[name] || 0) >= cap) return;
    this.lastAt[name] = now;

    // a little pitch drift so a repeated sound never machine-guns
    const variance = o.rateVar == null ? 0.07 : o.rateVar;
    const rate = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * variance);
    const vol = o.volume == null ? 1 : o.volume;

    if (this.mode === 'webaudio' && this.buffers[name]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[name];
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.master);
      this.active[name] = (this.active[name] || 0) + 1;
      src.onended = () => { this.active[name] = Math.max(0, (this.active[name] || 1) - 1); };
      try { src.start(); } catch (e) { this.active[name]--; }
      return;
    }

    const pool = this.pools[name];
    if (!pool) return;
    let el = pool.find(a => a.paused || a.ended);
    if (!el) {
      if (pool.length >= 4) return;
      el = pool[0].cloneNode();
      pool.push(el);
    }
    el.volume = Math.max(0, Math.min(1, vol * this.volume));
    el.playbackRate = rate;
    try { el.currentTime = 0; el.play().catch(() => { }); } catch (e) { }
  }
};
