/* FANDHARN - the Bestiary. A book of everything that comes at the castle.

   Each page plays the thing's real attack: a small stand-in for the game is
   built for the page and the enemy's own update() runs inside it, with the
   sound off. So the Warden really shields, the Eagle really swoops, the
   Auger really stops and winds up - the book cannot drift out of step with
   the game, because it is the same code. */

const BESTIARY = [
  // --- ordinary
  { group: 'ENEMIES', kind: 'blob', name: 'Blob', where: 'every wave', castle: '1 segment',
    text: 'A lump of crayon that walks at the castle. It does nothing else, which is the point: there are a lot of them.',
    scene: 'walk' },
  { group: 'ENEMIES', kind: 'dart', name: 'Paper Dart', where: 'from wave 3', castle: '1 segment',
    text: 'Folded, thin and fast - half again the speed of a blob, and it goes down in two thirds of the hits. You notice it late.',
    scene: 'walk' },
  { group: 'ENEMIES', kind: 'brick', name: 'Brick', where: 'from wave 5', castle: '1 segment',
    text: 'Slow and fat: nearly twice a blob\'s HP, at two thirds the pace. It holds up everything behind it.',
    scene: 'walk' },
  { group: 'ENEMIES', kind: 'auger', name: 'The Auger', where: 'endless only, wave 13 on - one or two a wave', castle: '1 segment',
    text: 'Stops four blocks off the lawn and every eye shuts, then opens on you. It backs away for a second with the drill screaming, then runs. Hit it while it is running and it stops dead and has to wind up again.',
    scene: 'auger' },
  // --- summoned by something bigger
  { group: 'SUMMONED', kind: 'blotling', name: 'Blotling', where: 'spat out by the Blot', castle: '1 segment',
    text: 'A drop of the Blot, fast and small. One every few seconds while the Blot lives, and three more when it bursts.',
    scene: 'walk' },
  { group: 'SUMMONED', kind: 'boltshot', name: 'Bolt', where: 'loosed by the Thunder Eagle', castle: '1 segment',
    text: 'One HP and very fast. The Eagle never lands; these are how it hurts you. Shoot them down before they arrive.',
    scene: 'volley' },
  { group: 'SUMMONED', kind: 'worker', name: 'Worker Bee', where: 'the Hive\'s ten haulers', castle: 'none - it hauls',
    text: 'Ten of them drag the Hive in on strands. Nothing can be hit until the nest is three blocks off the green; then the haulers can, and the nest only stops coming once the last one is down.',
    scene: 'haul' },
  { group: 'SUMMONED', kind: 'bee', name: 'Swarm Bee', where: 'three out of the Hive for every 25 damage', castle: '1 segment',
    text: 'They boil out of the door for a beat - that is your moment - and then all eight make for the castle.',
    scene: 'swarm' },
  { group: 'SUMMONED', kind: 'larva', name: 'Larva', where: 'lobbed by the Queen, three at a time', castle: 'none - it hatches',
    text: 'Comes down on a mortar arc onto a random block and lies there twitching. Two seconds later - or the moment you poke it - it splits open.',
    scene: 'larva' },
  { group: 'SUMMONED', kind: 'steroid', name: 'Steroid Bee', where: 'hatches out of a larva', castle: '1 segment',
    text: 'All shoulders. Walks in, stops three blocks out to wind up for a second, then runs the rest.',
    scene: 'walk' },
  { group: 'SUMMONED', kind: 'lavaball', name: 'Lava Ball', where: 'climbs out of the Queen\'s ground crack', castle: '2 - if it lands on the lawn',
    text: 'Rises out of the crack, hangs, and drops. Shoot it before it lands: on bare paper it leaves a burning puddle, on the castle\'s lawn it sets the whole lawn alight.',
    scene: 'lava' },
  // --- bosses
  { group: 'BOSSES', kind: 'boss', name: 'The Blot', where: 'wave 5 (half the time), random in endless', castle: '1 segment',
    text: 'Coughs up a blotling every four and a half seconds, and bursts into three more when it dies. Half the time it leaves a Blob\'d-Tier behind.',
    scene: 'boss' },
  { group: 'BOSSES', kind: 'eagle', name: 'The Thunder Eagle', where: 'wave 5 (the other half), random in endless', castle: 'never lands',
    text: 'Holds off five blocks out, looses a bolt at the castle every 3.2 seconds and swoops in and back out. Immune to everything the Storm Caller throws. Half the time it drops an Electric Bird.',
    scene: 'boss' },
  { group: 'BOSSES', kind: 'warden', name: 'The Warden', where: 'wave 10 (half the time), random in endless', castle: '1 segment',
    text: 'Every nine seconds it chalks a barrier that eats all damage for two and a half - the eye goes pale and the pupil narrows first. The first time it drops to half, it calls two bricks.',
    scene: 'warden' },
  { group: 'BOSSES', kind: 'hive', name: 'The Hive', where: 'wave 10 (the other half), random in endless', castle: '1 segment',
    text: 'Three fights in one. Hauled in by ten workers and untouchable until it is three blocks off the green; then 200 HP that lets three bees out for every 25 you put in; then the Queen walks out of the wreck.',
    scene: 'hive' },
  { group: 'BOSSES', kind: 'queen', name: 'The Queen', where: 'the Hive\'s third act', castle: 'keeps her distance',
    text: 'Takes 15% more from fire. Every 3.4 seconds: lobs three larvae, rallies her swarm to run faster, or drives her stinger through the paper to open a crack that burns - and coughs up a lava ball.',
    scene: 'boss' }
];

/* A stand-in for the game, just big enough for an enemy's own code to run
   in. Anything that would touch the real HUD, the save or the score is a
   no-op here. */
class BeastSim {
  constructor(entry, left) {
    this.entry = entry;
    this.startLeft = left;
    this.w = 100000; this.h = 100000;     // "on screen" is everywhere, as far as the Hive is concerned
    this.waveSpec = { hp: 30, speed: 75, interval: 1, hpScale: 1, bossMul: 1 };
    this.lawnBurnt = true;                // the lawn in the book never catches
    this.castleHp = 5; this.maxHp = 5; this.state = 'playing';
    this.oneshot = {}; this.difficulty = 'normal'; this.endless = false; this.stillT = 0;
    this.pointer = { x: 0, y: 0 };
    this.reset();
  }
  get castleRadius() { return Game.castleRadius; }
  reset() {
    this.enemies = []; this.effects = []; this.spawnQueue = [];
    this.t = 0; this.time = 0; this.hitT = 0; this.flags = {}; this.gone = 0;
    this.left = this.startLeft;
    this.lead = BeastScenes[this.entry.scene](this, this.entry.kind);
  }
  spawnMinion(kind, x, y, hp, speed) {
    const e = new Enemy(kind, rolledHp(kind, this.waveSpec, hp), speed * ENEMY_KINDS[kind].speedMul, x, y);
    this.spawnQueue.push(e);
    return e;
  }
  add(kind, x, y) {
    const e = this.spawnMinion(kind, x, y, this.waveSpec.hp, this.waveSpec.speed);
    e.spawnT = 0.3;
    this.flushSpawns();
    return e;
  }
  flushSpawns() { for (const e of this.spawnQueue) if (!e.dead) this.enemies.push(e); this.spawnQueue.length = 0; }
  castleHit() { this.hitT = 1; }
  shake() { } slowmo() { } onEnemyKilled() { } buildGround() { } earnCoins() { }
  statusBonus() { return 0; } aoeScale() { return 1; } aoeDamage(d) { return d; }
  sentryHurt(e, d, o) { return e.hurt(d, this, o); }
  hitchHaulers(hive, w) { return Game.hitchHaulers.call(this, hive, w); }

  update(dt) {
    this.t += dt; this.time += dt;
    if (this.hitT > 0) this.hitT = Math.max(0, this.hitT - dt / 0.4);
    const play = Sfx.play;
    Sfx.play = () => { };                 // the book is silent
    try {
      const script = BeastScripts[this.entry.scene];
      if (script) script(this, this.t, dt);
      for (const e of this.enemies) if (!e.dead) e.update(dt, this);
      this.flushSpawns();
      this.enemies = this.enemies.filter(e => !e.dead);
      for (let i = 0; i < this.effects.length; i++) {
        if (!this.effects[i].update(dt, this)) { this.effects.splice(i, 1); i--; }
      }
      this.flushSpawns();
    } finally {
      Sfx.play = play;
    }
    // once the star of the page is gone, let it settle and play it again
    const lead = this.lead;
    if (!lead || lead.dead || !this.enemies.includes(lead)) this.gone += dt;
    if (this.gone > 1.1 || this.t > (this.entry.loop || 13)) this.reset();
  }
}

/* How each page starts. Returns the enemy the page is about. */
const BeastScenes = {
  walk(sim, kind) { return sim.add(kind, sim.left, 0); },
  volley(sim) {
    // too quick to catch one at a time, so they keep coming
    sim.entry.loop = 99;
    const b = sim.add('boltshot', sim.left, 0);
    b.spawnT = 0.5;
    return b;
  },
  auger(sim) {
    const e = sim.add('auger', sim.left, 0);
    e.baseSpeed = 120;                    // the book skips the long walk in
    return e;
  },
  haul(sim) {
    const h = sim.add('hive', sim.left * 0.8, 0);
    sim.hitchHaulers(h, sim.waveSpec);
    sim.flushSpawns();
    return h.workers[0];
  },
  swarm(sim) {
    let first = null;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = sim.add('bee', sim.left * 0.75 + Math.cos(a) * 24, Math.sin(a) * 24);
      b.spawnT = 0.5; b.burst = 0.9; b.burstA = a;
      first = first || b;
    }
    return first;
  },
  larva(sim) {
    const l = sim.add('larva', sim.left * 0.9, -40);
    l.spawnT = 1;
    l.fall = { sx: l.x, sy: l.y, tx: sim.left * 0.55, ty: 20, t: 0, dur: 0.95, arc: 110 };
    sim.entry.loop = 9;
    return l;
  },
  lava(sim) {
    sim.effects.push(new GroundCrack(sim.left * 0.5, 10, sim));
    sim.entry.loop = 6.5;
    return null;                          // the ball it throws up is the point
  },
  boss(sim, kind) {
    const e = sim.add(kind, sim.left * (kind === 'queen' ? 0.62 : 0.8), 0);
    e.spawnT = 0.6;
    e.skillT = 1.2; e.dashT = 3;          // get to the tricks quickly
    sim.entry.loop = 12;
    return e;
  },
  warden(sim) {
    const e = BeastScenes.boss(sim, 'warden');
    return e;
  },
  hive(sim) {
    const h = sim.add('hive', sim.left * 0.6, 0);
    sim.hitchHaulers(h, sim.waveSpec);
    sim.flushSpawns();
    sim.entry.loop = 13;
    return h;
  }
};

/* Beats that happen part-way through a page, to show the whole of a fight. */
const BeastScripts = {
  volley(sim, t, dt) {
    sim.gone = 0;
    sim.flags.next = (sim.flags.next == null ? 0.9 : sim.flags.next) - dt;
    if (sim.flags.next <= 0) {
      sim.flags.next = 0.9;
      const b = sim.add('boltshot', sim.left, (Math.random() - 0.5) * 60);
      b.spawnT = 0.5;
      sim.lead = b;
    }
  },
  auger(sim, t, dt) {
    // the first run gets stopped by a hit; the second one lands
    const e = sim.lead;
    if (!e || e.dead || !e.aug) return;
    if (e.aug.mode === 'dash' && !sim.flags.stopped) {
      sim.flags.dashT = (sim.flags.dashT || 0) + dt;
      if (sim.flags.dashT > 0.12) { sim.flags.stopped = true; e.hurt(1, sim, {}); }
    }
  },
  warden(sim, t) {
    // half HP partway through, so it calls its bricks on the page
    if (t > 4 && !sim.flags.half && sim.lead && !sim.lead.dead) {
      sim.flags.half = true;
      sim.lead.hp = sim.lead.maxHp * 0.49;
    }
  },
  lava(sim) {
    // keep a lava ball as the page's lead once one exists
    if (!sim.lead) sim.lead = sim.enemies.find(e => e.kind === 'lavaball') || null;
    if (!sim.lead && sim.t < 5) sim.gone = 0;
  },
  hive(sim, t) {
    const h = sim.lead;
    if (!h) return;
    if (t > 2.6 && !sim.flags.haulersDown) {          // phase 1 ends
      sim.flags.haulersDown = true;
      h.entered = true;
      for (const w of h.workers) { w.untouchable = false; w.hurt(99, sim, {}); }
    }
    if (t > 4 && !sim.flags.swarm && !h.dead) {        // phase 2: hit it, and out they come
      sim.flags.swarm = true;
      h.untouchable = false;
      h.hurt(26, sim, {});
    }
    if (t > 6.6 && !sim.flags.broken && !h.dead) {     // phase 3: the nest breaks
      sim.flags.broken = true;
      h.hurt(9999, sim, {});
      sim.flushSpawns();
      const q = sim.enemies.find(e => e.kind === 'queen');
      if (q) { q.skillT = 0.9; sim.lead = q; }
    }
    if (h.dead && sim.lead === h) sim.gone = 0;
  }
};

/* ----------------------------------------------------------------- the book */
const Bestiary = {
  built: false, sel: 0, sim: null, raf: 0, last: 0,

  open() {
    if (!this.built) this.build();
    this.refresh();
    this.select(this.sel);
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  close() { cancelAnimationFrame(this.raf); this.raf = 0; },

  build() {
    this.built = true;
    const list = document.getElementById('beast-list');
    let group = null;
    BESTIARY.forEach((b, i) => {
      if (b.group !== group) {
        group = b.group;
        list.insertAdjacentHTML('beforeend', '<div class="beast-group">' + group + '</div>');
      }
      const row = document.createElement('button');
      row.className = 'beast-row';
      row.dataset.doodle = 'ink'; row.dataset.when = 'on'; row.dataset.weight = '2.2';
      row.addEventListener('click', () => { Sfx.play('card_draw', { volume: 0.5 }); this.select(i); });
      list.appendChild(row);
      b.row = row;
      b.shown = -1;
    });
    Doodle.scan(list);
  },

  /* Bring every row up to what you know now: a black shape and a scrawl for
     what you have never met, the real thing once you have. Only rows whose
     state changed are redrawn. */
  refresh() {
    for (const b of BESTIARY) {
      const known = Save.known(b.kind);
      const state = known ? 1 : 0;             // the list only cares met / not met
      if (b.shown === state) continue;
      b.shown = state;
      const row = b.row, dood = row._doodle;
      for (const ch of [...row.childNodes]) if (ch !== (dood && dood.cv)) row.removeChild(ch);
      row.appendChild(this.thumb(b.kind, !state));
      if (state) row.insertAdjacentHTML('beforeend', '<span>' + b.name + '</span>');
      else row.appendChild(Scrawl.render(b.name, 110, 13));
      if (ENEMY_KINDS[b.kind].boss) row.insertAdjacentHTML('beforeend', '<span class="boss-tag">BOSS</span>');
    }
  },

  /* A still portrait: drawn big once, cropped to what was actually inked,
     and fitted into a `box`-pixel square. `dark` pours black over it - the
     shape of a thing you have not met yet. */
  thumb(kind, dark, box) {
    box = box || 92;
    const big = document.createElement('canvas');
    big.width = big.height = 360;
    const g = big.getContext('2d');
    const e = new Enemy(kind, 10, 0, -1, 0);
    e.spawnT = 1; e.hpShown = 1;
    if (kind === 'auger') e.augerState();
    g.translate(181, 180);
    e.draw(g, 1.3);
    const px = g.getImageData(0, 0, 360, 360).data;
    let x0 = 360, y0 = 360, x1 = 0, y1 = 0;
    for (let y = 0; y < 360; y += 2) for (let x = 0; x < 360; x += 2) {
      if (px[(y * 360 + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const out = document.createElement('canvas');
    out.className = 'thumb';
    out.width = out.height = box;
    const o = out.getContext('2d');
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const k = Math.min(box * 0.91 / bw, box * 0.91 / bh, box / 38);
    // drawn again at the size it will be seen, so a big portrait stays crisp
    o.translate(box / 2 - ((x0 + x1) / 2 - 181) * k, box / 2 - ((y0 + y1) / 2 - 180) * k);
    o.scale(k, k);
    e.draw(o, 1.3);
    o.setTransform(1, 0, 0, 1, 0, 0);
    if (dark) {
      o.globalCompositeOperation = 'source-in';
      o.fillStyle = '#1b1b1b';
      o.fillRect(0, 0, box, box);
      // stacked on itself so the thin crayon bits go solid too
      o.globalCompositeOperation = 'source-over';
      o.drawImage(out, 0, 0); o.drawImage(out, 0, 0);
    }
    return out;
  },

  select(i) {
    this.sel = i;
    const b = BESTIARY[i];
    BESTIARY.forEach((x, j) => {
      if (!x.row) return;
      x.row.classList.toggle('on', j === i);
      if (x.row._doodle) Doodle.draw(x.row._doodle, true);
    });
    // 0: never met - a black shape and a doctor's scrawl for everything
    // 1: met - its look and what it does, the numbers still unreadable
    // 2: killed - the whole page, and it moves
    const known = Save.known(b.kind);
    this.known = known;
    const k = ENEMY_KINDS[b.kind];
    const put = (id, text, readable, size, width) => {
      const el = document.getElementById(id);
      el.textContent = '';
      if (readable) { el.textContent = text; return; }
      el.appendChild(Scrawl.render(text, width || el.clientWidth || 400, size, '#2b2b2b'));
    };
    const wide = document.getElementById('beast-text').clientWidth || 420;
    put('beast-name', b.name, known > 0, 22, Math.min(wide, 260));
    put('beast-where', b.where, known > 1, 12, wide);
    const hp = b.kind === 'boltshot' ? '1'
      : k.flatHp ? String(k.flatHp) + (k.boss ? '+' : '')
        : '×' + k.hpMul + ' wave';
    const speed = k.speedMul === 0 ? 'still' : '×' + k.speedMul;
    const stat = (label) => '<div class="beast-stat" data-doodle="#b8b2a3" data-weight="2"><i>' + label + '</i><b></b></div>';
    const stats = document.getElementById('beast-stats');
    const vals = [['HP', hp], ['SPEED', speed], ['SIZE', String(k.r)], ['CASTLE', String(b.castle)]];
    stats.innerHTML = vals.map(v => stat(v[0])).join('');
    [...stats.querySelectorAll('.beast-stat b')].forEach((el, j) => {
      if (known > 1) el.textContent = vals[j][1];
      else el.appendChild(Scrawl.render(vals[j][1] + (known ? '' : ' ' + vals[j][0].toLowerCase()), 64, 12, '#2b2b2b'));
    });
    Doodle.scan(stats);
    put('beast-text', b.text, known > 0, 15, wide);
    this.sim = known > 1 ? new BeastSim(b, this.leftFor(b)) : null;
    this.still = known > 1 ? null : this.thumb(b.kind, known === 0, 230);
  },

  /* How close the page's camera sits. Small things up close; bosses, and
     anything whose trick needs room, from further back. */
  zoomFor(b) {
    const k = ENEMY_KINDS[b.kind];
    if (b.scene === 'hive' || b.scene === 'haul' || b.kind === 'eagle' || b.kind === 'queen') return 0.5;
    if (k.boss || b.scene === 'auger' || b.scene === 'lava') return 0.58;
    if (b.kind === 'steroid' || b.scene === 'larva' || b.scene === 'swarm') return 0.8;
    return 0.95;
  },
  castleX(w) { return w - 70; },
  /* where things walk in from: just inside the left edge of the page */
  leftFor(b) {
    const cv = document.getElementById('beast-canvas');
    const w = (cv && cv.clientWidth) || 470;
    return -(this.castleX(w) - 30) / this.zoomFor(b);
  },

  frame(dt) {
    const cv = document.getElementById('beast-canvas');
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h || (!this.sim && !this.still)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fffdf4';
    ctx.fillRect(0, 0, w, h);
    if (!this.sim) {
      // not earned yet: it only stands there, breathing a little
      this.stillT = (this.stillT || 0) + dt;
      const t = Math.floor(this.stillT * 3.5) / 3.5, s = Math.min(1, (h - 16) / 230);
      const bob = Math.sin(t * 2.2) * 2;
      ctx.drawImage(this.still, w / 2 - 115 * s, h / 2 - 115 * s + bob, 230 * s, 230 * s);
      return;
    }
    this.sim.update(dt);
    // the castle on the right, the page's creature coming at it from the left
    const scale = this.zoomFor(this.sim.entry);
    ctx.save();
    ctx.translate(this.castleX(w), h * 0.56);
    ctx.scale(scale, scale);
    if (Game.ground) {
      const s = Game.ground.size;
      ctx.drawImage(Game.ground.canvas, -s / 2, -s / 2, s, s);
    }
    const sim = this.sim;
    for (const f of sim.effects) if (f.under || f instanceof InkPuddle) f.draw(ctx, sim.time);
    Game.drawCastle(ctx);
    for (const e of sim.enemies) e.draw(ctx, sim.time);
    for (const f of sim.effects) if (!f.under && !(f instanceof InkPuddle)) f.draw(ctx, sim.time);
    ctx.restore();
    // a red flash when something gets to the wall
    if (sim.hitT > 0) {
      ctx.fillStyle = 'rgba(200,67,58,' + (sim.hitT * 0.25) + ')';
      ctx.fillRect(0, 0, w, h);
    }
  }
};
