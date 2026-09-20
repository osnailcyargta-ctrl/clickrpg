# FANDHARN

A top-down doodle tower defense you play with your cursor.

**"Fandharn" doesn't mean anything.** It's gibberish, and that's the whole story
behind the name.

A castle sits in the middle of the paper with 3 hearts drawn over it. Five waves
of scribbled-on monsters walk in from the edges. There are no towers to place and
nothing to aim — you *are* the weapon, and you kill things by clicking them.

Open `index.html` in a browser. That's the whole install.

## Rules

- **Click an enemy = 2 damage.** 10% of clicks crit for 50% more.
- Touch works exactly like a click, so it plays fine on a phone.
- **3 castle HP.** Every enemy that reaches the castle takes one heart.
- **5 waves per run**, then the run is over either way.
- Difficulty is picked at the start and sets enemy HP and how many spawn per wave:

  | | enemy HP | enemies per wave | enemy speed |
  |---|---|---|---|
  | EASY | 65% | 65% | 85% |
  | NORMAL | 100% | 100% | 100% |
  | HARD | 170% | 155% | 120% |

Kills pay out **scribbles**, the currency. After every wave the three-box clear
animation plays (the boxes get drawn, then coloured in with crayon that spills
past the outline) and the shop opens.

## Cursors

The cursor **is** the weapon, so buying one swaps out whatever you were holding.
Only one is ever active, and each keeps its own click counter.

| Cursor | Charge | What it does |
|---|---|---|
| **Plain Cursor** | — | The arrow you start with. Nothing up its sleeve. |
| **Wet Cursor** | 15 clicks | Spits 6 water drops. Each one swells, hops one block in one of 9 random directions, shrinks as gravity grabs it, then pops for 2 damage. |
| **Graphite Cursor** | 10 clicks | Scribbles a live pencil line between your previous and current click. Stays on the paper 2.5s and grinds 1 damage every 0.25s into anything crossing it. |
| **Eraser Cursor** | 12 clicks | Rubs a 1.5 block hole in the drawing. Enemies caught lose 20% of max HP outright and crawl 25% slower for 2s — their legs got erased. |
| **Buzz Cursor** | 8 clicks | Arcs static to the 3 nearest enemies within 4 blocks: 3 damage each, frozen mid-scribble for 0.35s. |

## Upgrades

Passive, three levels each, and they keep working with any cursor.

| Upgrade | What it does |
|---|---|
| **Molten Leftkey** | Every 5 clicks (4 at lv2, 3 at lv3) a fire blast erupts 2 blocks around your cursor for half your click damage and sets everything it touches on fire for 3s: 2–3 damage per second, and burning enemies move 15% faster. |
| **Ink Overflow** | Every crit bursts the cartridge into an ink puddle (1.2–1.8 blocks, 4s) that slows enemies 30% and stains them for 1–3 damage per second. |
| **Chalk Ward** | The castle gets 1–3 chalk shield charges. Each eats a hit instead of a heart, and the whole ward is re-drawn at the start of every wave. |

## Files

```
index.html        markup, HUD and screens
style.css         paper-and-ink styling
js/rough.js       crayon renderer: wobbly strokes, scribble fills that overflow
js/config.js      difficulties, wave table, cursor and upgrade tables
js/entities.js    enemies, status effects, every flying doodle
js/waveanim.js    the three-box wave clear animation
js/cursors.js     cursor weapon powers + the drawn pointer
js/ui.js          menu, HUD, shop, end screens
js/game.js        loop, input, waves, castle
```

No build step, no dependencies. The handwriting fonts load from Google Fonts and
fall back to whatever cursive font the system has if you're offline.
