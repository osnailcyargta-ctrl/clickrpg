# FANDHARN

A top-down doodle tower defense you play with your cursor.

A castle sits in the middle of the paper with a 5 segment HP bar over it. Ten
waves of scribbled-on monsters walk in from the edges. There are no towers to
place and nothing to aim — you *are* the weapon, and you kill things by clicking
them.

Open `index.html` in a browser. That's the whole install.

## Rules

- **Click an enemy.** The damage depends on the cursor you hold (2 to 4); 10% of clicks crit for 50% more.
- Touch works exactly like a click, so it plays fine on a phone.
- **5 castle HP**, drawn as five even 20% segments. Every leak costs one, and
  the castle is redrawn for each one it loses: cracks, then broken merlons,
  then a hole in the wall and smoke, then it collapses.
- **10 waves.** Wave 5 brings the Blot, wave 10 brings the Warden. Both boss
  waves hold a smaller crowd than the ones around them, because the bosses
  keep adding to it themselves. Each boss has a trick of its own:
  - **Wave 5 is a coin flip.** Half the time it's **the Blot**, which coughs
    up a fast blotling every 4.5s and bursts into three more when it dies.
  - The other half it's **the Thunder Eagle** — a raptor cut out of lightning
    with less than half the Blot's HP, which never closes in. It holds a
    standoff five blocks out, looses a bolt at the castle every 3.2s that has
    **1 HP and has to be shot down** before it lands, and swoops in and back
    out every few seconds. She is **immune to everything the Storm Caller
    throws** — its bolts, its splash and THUNDERHEAD all get drunk — so that
    is the one cursor you cannot bring to this fight. Killing it plays it out: it rears, tears free in a
    clap of light and climbs off the top of the page, leaving smear frames
    stretched behind it.
  - **The Warden** — a slab with one enormous eye in it — chalks a barrier
    around itself every 9s that eats all damage for 2.5s (its iris turns
    chalk-blue and the pupil narrows, so you can see it coming), and calls two
    bricks the first time it drops to half HP.
- Enemy **counts stop growing once you've beaten a boss** — after that the
  waves get meaner through HP and speed, not bigger crowds.
- **Skills.** Every cursor has one. It charges over 50 clicks and you fire it
  by hand — **right-click** on a mouse, or the button in the bottom-right
  corner on a touchscreen (it only appears once you've touched the screen).
  It never fires itself, and there are **30 seconds between casts** whatever
  your click rate, so it stays an event rather than a rotation. The button is
  always on screen; right-click does the same thing. Every cast
  darkens the page, drags the world into slow motion and slams the skill's
  name down before the payload lands.
- Kills pay out **scribbles**. After each wave you get **three cards** — a
  cursor or an upgrade each — and you buy one of them, or skip and keep the
  money. You can also **reroll** the hand: it costs the three cards' prices
  added up and divided by 2.5, so throwing away a good hand costs more than
  throwing away a bad one, and the new hand draws itself in from scratch. The cards take half a second to appear and draw themselves in; the
  animation doesn't skip.

| | enemy HP | enemies per wave | speed | spawn rate |
|---|---|---|---|---|
| EASY | 65% | 65% | 85% | slower |
| NORMAL | 100% | 100% | 100% | — |
| HARD | 170% | 140% | 120% | faster |

## Cursors

The cursor **is** the weapon. Buying one throws the old one away for good —
there's no inventory, so going back means buying it again.

The crayon look is the art style, not a brief: a cursor can be anything, it
just gets drawn like the rest of the page.

Every cursor hits for its own number, and that number is the trade: the ones
with a strong charge hit softer per click, the ones that hit hard have little
else going on. They're balanced around a human click rate — about 5–6 a second
on a mouse, 7–8 on a phone with two thumbs — not around spamming.

| Cursor | Damage | Charge | What it does |
|---|---|---|---|
| **Plain Cursor** | 3 | — | The arrow you start with. Nothing else. |
| **Wet Cursor** | 2.5 | 15 clicks | Spits 6 water drops. Each swells, hops one block in one of 9 random directions, shrinks as gravity grabs it, then pops for 3 damage. |
| **Pen Tool** | 2 | drag | A live ink trail wherever you drag it. Lingers 1.4s and grinds 1 damage into everything crossing it, so a whole crowd walks through it. |
| **Eraser Cursor** | 2.5 | 12 clicks | Rubs a 1.5 block hole in the drawing: enemies caught lose 20% of max HP outright and crawl 25% slower for 2s. Best against fat targets. |
| **Buzz Cursor** | 2.5 | 8 clicks | Arcs static to the 3 nearest enemies within 4 blocks: 3 damage each, frozen for 0.35s. |
| **Compass Cursor** | 2 | 10 clicks | Softest click, widest hit: sweeps an ink ring out to 3 blocks over a second, carving 5 damage into **everything the circle swallows**, each enemy once. |
| **Storm Caller** | 2 | 15 clicks | A cloud gathers over a random enemy; half a second later the bolt lands for 50% of your click damage and splashes 4 into everything within a block of it. The Thunder Eagle is immune to all of it. |
| **Horseshoe Magnet** | 2.5 | 12 clicks | Hauls everything within 4 blocks to the point you clicked, for 2 on the way, and leaves them stacked on top of each other for whatever you throw next. |
| **Boomerang** | 3 | 10 clicks | The throw loops out five blocks and curves home again, cutting 3 into everything on the way out and 3 more on the way back — line the arc up and the same enemy pays twice. |
| **Scissor Cursor** | 4 | — | Hardest click, no charge at all. Any non-boss enemy already under 18% HP is cut clean out of the drawing instead of damaged. Useless against a crowd. |

### Skills

50 clicks to charge, 30s between casts, fired by hand.

| Cursor | Skill | What it does |
|---|---|---|
| **Storm Caller** | THUNDERHEAD | The sky opens. Every enemy within 5 blocks of your cursor, and every enemy standing on the castle's ground, is struck for 125% of your click damage — 105% on a boss. |
| **Compass** | PERIMETER | A circle drawn from the castle grows until it nearly fills the page, shoving every enemy out to the edge with it. No damage, just distance. |
| **Scissor** | GUILLOTINE | A slash tears right to left across whichever half holds more enemies, marking it, and then the blades close: 10 damage to everything in it. |
| **Buzz** | EIGHT WAYS | Static tears out of the cursor down eight lines and earths itself through every enemy on the paper: 125% of your click damage and a 0.6s freeze. |
| **Wet** | CLOUDBURST | The page floods — 8 damage to everything, and a 40% slow for 3s. |
| **Pen Tool** | CROSSHATCH | The whole screen is hatched over and the lines bite: 12 damage to everything. |
| **Eraser** | SECOND DRAFT | The page is scrubbed back band by band and drawn again. Everything on it comes back **permanently** worse — 35% off max HP (half that on a boss), smaller, and a quarter slower — and the castle comes back with a segment mended. The only skill that heals. |
| **Magnet** | POLE REVERSAL | Hauls the whole board into one heap, holds it, then flips polarity and flings it apart. The damage scales with how many it gathered — 6, plus 2 for every enemy in the pile. |
| **Boomerang** | FLIGHT PATH | Nine of them launch from the castle, two laps each, and the whole loop swings round as it goes so the second lap covers what the first one missed. 4 a pass, and a pass is easy to take twice. |
| **Plain** | EXCLAMATION | One enormous mark slams down where you point, for six times your click damage in 2 blocks. The biggest single hit in the game, and the smallest area. |

## Upgrades

**One-shot** — bought once, then gone from the offers forever. The two with
nothing to show on the battlefield leave their mark on the cursor instead:
**Molten Leftkey** sets it alight, with flames climbing off its body, heat
pooling under it and smoke coming off the top, and **Ink Overflow** stains
its tip and drips from the point. Chalk Ward and Stick Sentry already draw
themselves around the castle, so they leave the cursor alone.

| | What it does |
|---|---|
| **Molten Leftkey** | Every 5 clicks a fire blast erupts 2 blocks around your cursor for half your click damage, and sets what it touches on fire for 3s: 2–3 damage a second, +15% enemy speed while burning. |
| **Ink Overflow** | Every crit dumps a 1.4 block ink puddle for 4s: 30% slow, 2 damage a second. |
| **Chalk Ward** | Two shield charges that eat a hit instead of your HP, re-drawn every wave. |
| **Thick Paper** | One more castle segment, permanently — six instead of five — and the new one starts full. The castle is redrawn inside an uncoloured outer shell so you can see it. |
| **Stick Sentry** | A doodled archer by the castle plinks the nearest enemy every 1.6s for 3 damage. |

**Stacking** — no level cap, they keep coming back and cost more each time:

| | What it does |
|---|---|
| **Thick Lead** | +0.5 click damage per level. |
| **Sharp Nib** | +3% crit chance per level. |
| **Fat Crayon** | +12% size and +10% damage on every blast, puddle and pop. |
| **Extra Credit** | +5% scribbles from every kill, per level. |
| **Deep Ink** | +0.3s on every status you inflict, per level: burns, slows, stains, stuns. |
| **Tape Patch** | Tapes one castle segment back together. Only offered while damaged. |

## Sound

Every effect is a pre-rendered mp3 in `assets/sfx/` — paper-and-pencil foley
built out of shaped noise (taps, scratches, crumples, tears, scrubs), so
nothing beeps like a synthesiser. Nothing is generated at runtime: the game
just plays the files.

- Rebuild them with `python3 tools/make_sfx.py` (needs `numpy`, `scipy`,
  `lameenc`). Each sound is one function in that script.
- To use your own recording instead, drop an mp3 with the same name into
  `assets/sfx/` — the game only looks sounds up by file name.
- Web Audio is used when available; opening `index.html` straight off the disk
  blocks `fetch()` on `file://` URLs, so it falls back to `<audio>` elements
  there. Both paths work.
- **M** toggles sound, or use the chip in the top-right. The setting is
  remembered.

## Deploying, and why an update can look like it did nothing

The site is served by GitHub Pages straight from this branch. Pages lets
browsers hold on to `js` and `css` for a long time, so a fresh deploy can
still show you the old game.

Every local asset in `index.html` therefore carries a `?v=` stamp, and the
menu prints the build number it is actually running. **Bump it on every
deploy** so returning players get the new files:

```
python3 tools/bump.py        # 6 -> 7, rewrites every ?v= and window.BUILD_V
```

If the menu shows an older build than you just pushed, it is the cache, not
the deploy: hard-refresh (Ctrl/Cmd+Shift+R), or on a phone open it in a
private tab.

## Files

```
index.html        markup, HUD and screens
style.css         paper-and-ink styling
js/rough.js       crayon renderer: wobbly strokes, scribble fills, noise, easings
js/config.js      difficulties, wave table, cursor and upgrade tables
js/audio.js       mp3 playback: Web Audio with an <audio> fallback
js/entities.js    enemies, bosses, status effects, sentry, every flying doodle
js/skills.js      the cast cinematic and one payload per cursor
js/offers.js      the three-card between-wave screen
js/cursors.js     cursor powers and the drawn pointer sprites
js/ui.js          menu, HUD, end screen
js/game.js        loop, input, waves, castle (per-HP art + collapse), ground
tools/make_sfx.py renders assets/sfx/*.mp3
tools/bump.py     bumps the cache-busting build number
```

No build step, no dependencies. The handwriting fonts load from Google Fonts and
fall back to whatever cursive font the system has if you're offline.
