/* FANDHARN - what survives closing the tab: coins, the skins you own and
   the ones you have equipped. Kept in localStorage.

   Every read and write is wrapped, because localStorage can be missing or
   throw (private windows, cleared site data, some file:// setups). When it
   does, everything still works for the session - it just is not kept. */

const Save = {
  KEY: 'fandharn.save.v1',
  data: {
    coins: 0, owned: [], equipped: {}, seen: [], killed: [],
    ach: {},            // achievement id -> 'done' | 'claimed'
    achBest: {},        // the best a run has got towards one, for the progress line
    chests: 0,
    relics: {},         // relic id -> how many
    relicOrder: [],     // the order they were first found, for the inventory
    relicOn: null,      // the one relic worn, if any
    search: null        // { start, finds: [ms after start] } while a search runs
  },
  persistent: true,

  load() {
    try {
      const raw = window.localStorage.getItem(this.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // take only what is well-formed; a hand-edited or half-written save
        // must not be able to break the menu
        this.data.coins = Number.isFinite(d.coins) && d.coins >= 0 ? Math.floor(d.coins) : 0;
        this.data.owned = Array.isArray(d.owned) ? d.owned.filter(x => typeof x === 'string') : [];
        this.data.equipped = d.equipped && typeof d.equipped === 'object' ? d.equipped : {};
        this.data.seen = Array.isArray(d.seen) ? d.seen.filter(x => typeof x === 'string') : [];
        this.data.killed = Array.isArray(d.killed) ? d.killed.filter(x => typeof x === 'string') : [];
        const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        const whole = v => Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
        this.data.ach = obj(d.ach);
        this.data.achBest = obj(d.achBest);
        this.data.chests = whole(d.chests);
        this.data.relics = {};
        for (const [k, v] of Object.entries(obj(d.relics))) if (whole(v) > 0) this.data.relics[k] = whole(v);
        this.data.relicOrder = Array.isArray(d.relicOrder) ? d.relicOrder.filter(k => this.data.relics[k]) : [];
        for (const k of Object.keys(this.data.relics)) if (!this.data.relicOrder.includes(k)) this.data.relicOrder.push(k);
        this.data.relicOn = typeof d.relicOn === 'string' && this.data.relics[d.relicOn] ? d.relicOn : null;
        const sr = d.search;
        this.data.search = sr && Number.isFinite(sr.start) && Array.isArray(sr.finds)
          ? { start: sr.start, finds: sr.finds.filter(Number.isFinite) } : null;
      }
    } catch (e) {
      this.persistent = false;
    }
    return this;
  },

  store() {
    try {
      window.localStorage.setItem(this.KEY, JSON.stringify(this.data));
      this.persistent = true;
    } catch (e) {
      this.persistent = false;
    }
  },

  get coins() { return this.data.coins; },

  addCoins(n) {
    if (!(n > 0)) return;
    this.data.coins += n;
    this.store();
  },

  owns(skinId) { return this.data.owned.includes(skinId); },

  /* Pay for a skin. Returns false if it is already owned or you are short. */
  buy(skin) {
    if (this.owns(skin.id) || this.data.coins < skin.price) return false;
    this.data.coins -= skin.price;
    this.data.owned.push(skin.id);
    this.store();
    return true;
  },

  /* A skin can cover several things at once (a pack). Equipping it puts it
     on every one of them, taking over from whatever was on each before. */
  equip(skin) {
    if (!this.owns(skin.id)) return false;
    for (const target of Object.keys(skin.applies)) this.data.equipped[target] = skin.id;
    this.store();
    return true;
  },

  unequip(skin) {
    for (const target of Object.keys(skin.applies)) {
      if (this.data.equipped[target] === skin.id) delete this.data.equipped[target];
    }
    this.store();
  },

  isEquipped(skin) {
    return Object.keys(skin.applies).some(t => this.data.equipped[t] === skin.id);
  },

  /* The skin id worn by a target such as 'cursor:storm', if any. */
  wornBy(target) { return this.data.equipped[target] || null; },

  /* ---- the bestiary: what you have met, and what you have put down.
     Called every frame for everything on the field, so the already-known
     case is one array lookup and writes nothing. */
  see(kind) {
    if (this.data.seen.includes(kind)) return;
    this.data.seen.push(kind);
    this.store();
  },
  kill(kind) {
    this.see(kind);
    if (this.data.killed.includes(kind)) return;
    this.data.killed.push(kind);
    this.store();
  },
  /* ---- chests and relics */
  addChests(n) {
    if (!(n > 0)) return;
    this.data.chests += n;
    this.store();
  },
  takeChest() {
    if (this.data.chests <= 0) return false;
    this.data.chests--;
    this.store();
    return true;
  },
  addRelic(id, n) {
    n = n || 1;
    this.data.relics[id] = (this.data.relics[id] || 0) + n;
    if (!this.data.relicOrder.includes(id)) this.data.relicOrder.push(id);
    this.store();
  },
  wearRelic(id) {
    this.data.relicOn = id && this.data.relics[id] ? id : null;
    this.store();
  },

  /* ---- skins that come whole in a pack, handed over rather than bought */
  grant(skinIds) {
    for (const id of skinIds) if (!this.data.owned.includes(id)) this.data.owned.push(id);
    this.store();
  },

  /* 0 never met, 1 met, 2 killed */
  known(kind) {
    return this.data.killed.includes(kind) ? 2 : this.data.seen.includes(kind) ? 1 : 0;
  }
};

/* ---- how coins are earned ---------------------------------------------
   Finishing the ten-wave run: 1 on Normal, 2 on Hard.
   Endless, every tenth wave cleared: on Normal the first pays 1 and each
   after pays 1 more, up to 5 a time; on Hard the first pays 2, up to 10.
   Easy pays nothing - it is there to learn on. */
const COIN_RULES = {
  victory: { normal: 1, hard: 2 },
  endless: { normal: { first: 1, cap: 5 }, hard: { first: 2, cap: 10 } },
  every: 10
};

function coinsForVictory(diff) {
  return COIN_RULES.victory[diff] || 0;
}

/* milestone 1 is wave 10, milestone 2 is wave 20, and so on */
function coinsForEndlessMilestone(diff, milestone) {
  const r = COIN_RULES.endless[diff];
  if (!r || milestone < 1) return 0;
  return Math.min(r.cap, r.first + (milestone - 1));
}

Save.load();
