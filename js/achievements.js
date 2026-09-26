/* FANDHARN - achievements. Each is done once, then claimed once from the
   MORE page for what it pays. */

const ACHIEVEMENTS = [
  { id: 'endless3', name: 'Big Game', text: 'Kill 3 bosses in one Endless run.',
    goal: 3, reward: { coins: 3 }, note: 'the count starts over when the castle falls' },
  { id: 'plainwin', name: 'Just the Arrow', text: 'Win on Normal or Hard with only the Plain Cursor.',
    reward: { coins: 5 } },
  { id: 'hardwin', name: 'Hard Copy', text: 'Win on Hard.',
    reward: { pack: 'thunder' } }
];

function achievementById(id) { return ACHIEVEMENTS.find(a => a.id === id) || null; }

const Achievements = {
  state(id) { return Save.data.ach[id] || null; },       // null | 'done' | 'claimed'

  /* Mark one done. Says so on the page the first time. */
  complete(id, game) {
    if (this.state(id)) return false;
    Save.data.ach[id] = 'done';
    Save.store();
    const a = achievementById(id);
    if (game && game.effects) {
      game.effects.push(new FloatText(0, -game.h * 0.32, 'achievement: ' + a.name, '#a5741b', 26, true));
      Sfx.play('skill_ready', { volume: 0.9, rateVar: 0 });
      game.achRun = (game.achRun || []).concat([a.name]);
    }
    return true;
  },

  /* Keep the best a run has got towards a counted one, for the progress line. */
  progress(id, n) {
    if ((Save.data.achBest[id] || 0) >= n) return;
    Save.data.achBest[id] = n;
    Save.store();
  },

  /* Hand over what it pays. Returns a line saying what that was. */
  claim(id) {
    const a = achievementById(id);
    if (!a || this.state(id) !== 'done') return null;
    Save.data.ach[id] = 'claimed';
    Save.store();
    if (a.reward.coins) { Save.addCoins(a.reward.coins); return '+' + a.reward.coins + ' coins'; }
    if (a.reward.pack) {
      const pack = skinById(a.reward.pack);
      Save.grant([pack.id].concat(pack.skins));
      for (const id of pack.skins) Save.equip(skinById(id));
      return pack.name + ' unlocked';
    }
    return '';
  },

  rewardText(a) {
    if (a.reward.coins) return a.reward.coins + ' coins';
    if (a.reward.pack) return skinById(a.reward.pack).name;
    return '';
  },

  /* ---- the hooks the game calls */
  onBossKilled(game) {
    if (!game.endless) return;
    game.runBosses = (game.runBosses || 0) + 1;
    this.progress('endless3', Math.min(3, game.runBosses));
    if (game.runBosses >= 3) this.complete('endless3', game);
  },

  onVictory(game) {
    if (game.difficulty === 'hard') this.complete('hardwin', game);
    if ((game.difficulty === 'normal' || game.difficulty === 'hard') && game.onlyPlain) this.complete('plainwin', game);
  }
};
