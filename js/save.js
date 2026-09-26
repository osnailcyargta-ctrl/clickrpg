/* FANDHARN - what survives closing the tab: coins, the skins you own and
   the ones you have equipped. Kept in localStorage.

   Every read and write is wrapped, because localStorage can be missing or
   throw (private windows, cleared site data, some file:// setups). When it
   does, everything still works for the session - it just is not kept. */

const Save = {
  KEY: 'fandharn.save.v1',
  data: { coins: 0, owned: [], equipped: {}, seen: [], killed: [] },
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
