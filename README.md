# FANDHARN

A top-down doodle tower defense you play with your cursor.

A castle sits in the middle of the paper with a 5 segment HP bar over it. Ten
waves of scribbled-on monsters walk in from the edges. There are no towers to
place and nothing to aim — you *are* the weapon, and you kill things by clicking
them.

Open `index.html` in a browser. That's the whole install.

## Rules

- **Click an enemy = 3 damage.** 10% of clicks crit for 50% more.
- Touch works exactly like a click, so it plays fine on a phone.
- **5 castle HP**, drawn as five even 20% segments. Every leak costs one.
- **10 waves.** Wave 5 brings the Blot, wave 10 brings the Warden, and each
  boss has a trick of its own:
  - **The Blot** coughs up a fast blotling every 4.5s, and bursts into three
    more when it dies.
  - **The Warden** chalks a barrier around itself every 9s that eats all damage
    for 2.5s, and calls two bricks the first time it drops to half HP.
- Enemy **counts stop growing once you've beaten a boss** — after that the
  waves get meaner through HP and speed, not bigger crowds.
- Kills pay out **scribbles**. After each wave you get **three cards** — a
  cursor or an upgrade each — and you buy one of them, or skip and keep the
  money. The cards take half a second to appear and draw themselves in; the
  animation doesn't skip.

| | enemy HP | enemies per wave | speed | spawn rate |
|---|---|---|---|---|
| EASY | 65% | 65% | 85% | slower |
| NORMAL | 100% | 100% | 100% | — |
| HARD | 170% | 140% | 120% | faster |

## Cursors

The cursor **is** the weapon. Buying one throws the old one away for good —
there's no inventory, so going back means buying it again.

| Cursor | Charge | What it does |
|---|---|---|
| **Plain Cursor** | — | The arrow you start with. 3 damage a click. |
| **Wet Cursor** | 15 clicks | Spits 6 water drops. Each swells, hops one block in one of 9 random directions, shrinks as gravity grabs it, then pops for 2 damage. |
| **Pen Tool** | drag | A pencil that never stops drawing. Leaves a live ink trail wherever you drag it; the trail lingers 1.4s and grinds 1 damage into anything crossing it. |
| **Eraser Cursor** | 12 clicks | Rubs a 1.5 block hole in the drawing. Enemies caught lose 20% of max HP outright and crawl 25% slower for 2s. |
| **Buzz Cursor** | 8 clicks | Arcs static to the 3 nearest enemies within 4 blocks: 3 damage each, frozen for 0.35s. |

## Upgrades

**One-shot** — bought once, then gone from the offers forever:

| | What it does |
|---|---|
| **Molten Leftkey** | Every 5 clicks a fire blast erupts 2 blocks around your cursor for half your click damage, and sets what it touches on fire for 3s: 2–3 damage a second, +15% enemy speed while burning. |
| **Ink Overflow** | Every crit dumps a 1.4 block ink puddle for 4s: 30% slow, 2 damage a second. |
| **Chalk Ward** | Two shield charges that eat a hit instead of your HP, re-drawn every wave. |
| **Stick Sentry** | A doodled archer by the castle plinks the nearest enemy every 1.6s for 3 damage. |

**Stacking** — no level cap, they keep coming back and cost more each time:

| | What it does |
|---|---|
| **Thick Lead** | +0.5 click damage per level. |
| **Sharp Nib** | +3% crit chance per level. |
| **Fat Crayon** | +12% size and +10% damage on every blast, puddle and pop. |
| **Tape Patch** | Tapes one castle segment back together. Only offered while damaged. |

## Files

```
index.html        markup, HUD and screens
style.css         paper-and-ink styling
js/rough.js       crayon renderer: wobbly strokes, scribble fills, noise, easings
js/config.js      difficulties, wave table, cursor and upgrade tables
js/entities.js    enemies, status effects, sentry, every flying doodle
js/offers.js      the three-card between-wave screen
js/cursors.js     cursor powers and the drawn pointer sprites
js/ui.js          menu, HUD, end screen
js/game.js        loop, input, waves, castle, ground
```

No build step, no dependencies. The handwriting fonts load from Google Fonts and
fall back to whatever cursive font the system has if you're offline.
