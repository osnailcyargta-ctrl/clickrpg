#!/usr/bin/env python3
"""
FANDHARN - sound effect renderer.

Every sound here is paper-and-pencil foley built out of shaped noise: taps,
scratches, crumples, tears and scrubs. There are no oscillator tones, so
nothing beeps like a synth - it should sound like a notebook being attacked.

Run it to rebuild assets/sfx/*.mp3:

    python3 tools/make_sfx.py

The game only looks sounds up by file name, so any of these can be replaced
with your own recording of the same name.
"""
import os
import numpy as np
from scipy import signal
import lameenc

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'sfx')
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- primitives
def secs(d):
    return np.zeros(int(SR * d))


def noise(d):
    return rng.standard_normal(int(SR * d))


def env(d, attack=0.002, decay=None, curve=3.0):
    """Percussive envelope: quick attack, exponential tail."""
    n = int(SR * d)
    t = np.linspace(0, d, n, endpoint=False)
    a = int(SR * attack) or 1
    e = np.exp(-curve * t / d)
    e[:a] *= np.linspace(0, 1, a)
    return e


def swell(d, peak=0.35, curve=2.5):
    """Rises to a peak then falls away - whooshes and shimmers."""
    n = int(SR * d)
    t = np.linspace(0, 1, n, endpoint=False)
    up = np.clip(t / peak, 0, 1) ** 1.6
    down = np.exp(-curve * np.clip(t - peak, 0, None) / (1 - peak))
    return up * down


def bp(x, f0, q=1.2):
    f0 = np.clip(f0, 20, SR / 2 - 200)
    sos = signal.butter(2, [max(20, f0 / (1 + 1 / q)), min(SR / 2 - 100, f0 * (1 + 1 / q))],
                        btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f0, order=2):
    sos = signal.butter(order, np.clip(f0, 30, SR / 2 - 100), btype='low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f0, order=2):
    sos = signal.butter(order, np.clip(f0, 20, SR / 2 - 100), btype='high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def ring(x, f0, q=12.0):
    """Narrow band - a struck object rather than a tone."""
    w = f0 / (SR / 2)
    b, a = signal.iirpeak(np.clip(w, 1e-4, 0.99), q)
    return signal.lfilter(b, a, x)


def sweep(x, f_start, f_end, q=1.4, blocks=48):
    """Band-pass whose centre slides across the sound."""
    out = np.zeros_like(x)
    edges = np.linspace(0, len(x), blocks + 1).astype(int)
    freqs = np.geomspace(max(30, f_start), max(40, f_end), blocks)
    for i in range(blocks):
        s, e = edges[i], edges[i + 1]
        if e <= s:
            continue
        pad = min(s, 512)
        seg = bp(x[s - pad:e], freqs[i], q)
        out[s:e] = seg[pad:]
    return out


def grains(d, count, spread=None, length=0.012, band=(1500, 4000), jitter=0.5, decay=2.5):
    """Scattered little bursts - crumples, crackles, scratches."""
    n = int(SR * d)
    out = np.zeros(n)
    spread = d if spread is None else spread
    for i in range(count):
        at = int(SR * rng.uniform(0, spread))
        ln = int(SR * length * rng.uniform(1 - jitter, 1 + jitter))
        if ln < 8 or at + ln > n:
            continue
        e = np.exp(-6.0 * np.arange(ln) / ln)
        a = max(1, int(SR * 0.0005))
        e[:a] *= np.linspace(0, 1, a)
        g = bp(rng.standard_normal(ln) * e, rng.uniform(*band), 1.1)
        out[at:at + ln] += g * np.exp(-decay * at / n) * rng.uniform(0.5, 1.0)
    return out


def am(x, rate, depth=0.8, phase=0.0):
    """Amplitude wobble - the back-and-forth of a hand scrubbing or scratching."""
    t = np.arange(len(x)) / SR
    m = 1 - depth * (0.5 + 0.5 * np.cos(2 * np.pi * rate * t + phase))
    return x * m


def fit(a, b):
    n = max(len(a), len(b))
    return np.pad(a, (0, n - len(a))), np.pad(b, (0, n - len(b)))


def mix(*parts):
    out = np.zeros(0)
    for p in parts:
        out, p = fit(out, p)
        out = out + p
    return out


def finish(x, peak=0.85, fade=0.004):
    x = np.nan_to_num(x)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    f = int(SR * fade) or 1
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def write(name, x, kbps=96):
    x = finish(x)
    # short transients smear badly at low bitrates, so spend a few more kB
    if len(x) / SR < 0.35:
        kbps = 128
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm) + enc.flush()
    path = os.path.join(OUT, name + '.mp3')
    with open(path, 'wb') as f:
        f.write(bytes(data))
    return path, len(data)


# -------------------------------------------------------------- the sounds
def s_click_hit():
    tick = bp(noise(0.07), 2600, 1.3) * env(0.07, 0.0004, curve=9)
    body = bp(noise(0.06), 320, 2.0) * env(0.06, 0.001, curve=11) * 0.5
    return mix(tick, body)


def s_click_miss():
    return bp(noise(0.055), 950, 1.0) * env(0.055, 0.0005, curve=12) * 0.7


def s_crit():
    scratch = am(bp(noise(0.16), 4200, 1.6), 55, 0.7) * env(0.16, 0.0008, curve=5)
    snap = bp(noise(0.05), 5200, 2.2) * env(0.05, 0.0003, curve=10)
    thump = bp(noise(0.09), 260, 1.8) * env(0.09, 0.001, curve=9) * 0.6
    return mix(scratch, snap * 0.9, thump)


def s_kill():
    return mix(grains(0.24, 12, spread=0.14, length=0.01, band=(1400, 5200), decay=3.2),
               bp(noise(0.1), 420, 1.4) * env(0.1, 0.001, curve=8) * 0.4)


def s_kill_big():
    return mix(grains(0.5, 26, spread=0.3, length=0.014, band=(900, 4600), decay=2.4),
               bp(noise(0.22), 170, 1.6) * env(0.22, 0.002, curve=6) * 0.8)


def s_castle_hit():
    thud = bp(noise(0.35), 95, 1.4) * env(0.35, 0.002, curve=5)
    tear = sweep(noise(0.3) * swell(0.3, 0.25, 3.0), 700, 4200, 1.5)
    debris = grains(0.55, 18, spread=0.35, length=0.012, band=(800, 4000), decay=2.2)
    return mix(thud * 1.1, tear * 0.7, debris * 0.6)


def s_ward():
    shimmer = am(hp(noise(0.45), 4200) * swell(0.45, 0.2, 3.2), 34, 0.45)
    return mix(shimmer, ring(noise(0.2), 2100, 16) * env(0.2, 0.004, curve=6) * 0.25)


def s_wave_start():
    return sweep(noise(0.45) * swell(0.45, 0.3, 3.0), 500, 2600, 1.2)


def s_wave_clear():
    flip1 = sweep(noise(0.26) * swell(0.26, 0.35, 3.4), 900, 3200, 1.3)
    flip2 = np.pad(sweep(noise(0.3) * swell(0.3, 0.3, 3.0), 700, 2400, 1.3), (int(SR * 0.2), 0))
    flap = np.pad(grains(0.2, 5, spread=0.12, length=0.02, band=(600, 2200), decay=2.0), (int(SR * 0.3), 0))
    return mix(flip1, flip2 * 0.8, flap * 0.7)


def s_card_draw():
    return am(sweep(noise(0.32) * swell(0.32, 0.25, 2.6), 1200, 3400, 1.5), 22, 0.6)


def s_card_buy():
    stamp = bp(noise(0.16), 220, 1.5) * env(0.16, 0.0015, curve=6)
    slap = bp(noise(0.08), 1800, 1.2) * env(0.08, 0.0005, curve=9)
    return mix(stamp, slap * 0.8)


def s_skip():
    return sweep(noise(0.26) * swell(0.26, 0.3, 3.2), 800, 2000, 1.2) * 0.75


def s_boss_spawn():
    rumble = lp(noise(1.0), 190, 3) * swell(1.0, 0.28, 2.2)
    groan = am(bp(noise(0.95), 150, 2.4) * swell(0.95, 0.35, 2.0), 5.5, 0.5)
    crack = grains(1.0, 22, spread=0.8, length=0.02, band=(500, 3200), decay=1.2)
    return mix(rumble * 1.2, groan * 0.9, crack * 0.45)


def s_warden_shield():
    scrape = am(hp(noise(0.55), 3200) * swell(0.55, 0.22, 2.6), 26, 0.55)
    body = bp(noise(0.4), 900, 1.2) * swell(0.4, 0.2, 3.0)
    return mix(scrape, body * 0.5)


def s_game_over():
    crumple = grains(1.3, 52, spread=0.9, length=0.016, band=(700, 4200), decay=1.4)
    tear = np.pad(sweep(noise(0.5) * swell(0.5, 0.2, 2.4), 1200, 400, 1.4), (int(SR * 0.15), 0))
    thud = np.pad(bp(noise(0.6), 80, 1.3) * env(0.6, 0.004, curve=3.5), (int(SR * 0.35), 0))
    return mix(crumple * 0.7, tear * 0.8, thud * 1.2)


def s_victory():
    parts = []
    for i, f in enumerate([1400, 1900, 2600]):
        g = ring(noise(0.3), f, 22) * env(0.3, 0.002, curve=5)
        parts.append(np.pad(g, (int(SR * 0.13 * i), 0)))
    shimmer = hp(noise(1.0), 5000) * swell(1.0, 0.45, 2.0) * 0.35
    rattle = grains(1.0, 16, spread=0.7, length=0.014, band=(1200, 4000), decay=1.5)
    return mix(*parts, shimmer, rattle * 0.4)


def s_fire_blast():
    whoosh = sweep(noise(0.5) * swell(0.5, 0.18, 2.6), 350, 1500, 1.1)
    crackle = grains(0.55, 26, spread=0.4, length=0.008, band=(1800, 6500), decay=2.6)
    boom = bp(noise(0.25), 120, 1.5) * env(0.25, 0.002, curve=6)
    return mix(whoosh, crackle * 0.55, boom * 0.9)


def s_water_pop():
    drop = sweep(noise(0.16) * env(0.16, 0.001, curve=7), 2600, 600, 6.0)
    return mix(drop, bp(noise(0.06), 900, 1.4) * env(0.06, 0.0005, curve=10) * 0.5)


def s_zap():
    x = hp(noise(0.22), 2800)
    gate = (rng.random(len(x)) < 0.4).astype(float)
    gate = signal.lfilter(np.ones(24) / 24, [1], gate)
    return x * gate * env(0.22, 0.0008, curve=5)


def s_erase():
    x = bp(noise(0.42), 1700, 1.0) * swell(0.42, 0.2, 2.2)
    return am(x, 9, 0.75) * 1.1


def s_compass_ring():
    arc = am(sweep(noise(0.62) * swell(0.62, 0.3, 2.2), 800, 3000, 1.6), 14, 0.5)
    tick = bp(noise(0.05), 3400, 2.0) * env(0.05, 0.0004, curve=10)
    return mix(arc, tick * 0.6)


def s_snip():
    out = secs(0.22)
    for i, (at, f) in enumerate([(0.0, 4300), (0.055, 5700)]):
        g = ring(noise(0.09), f, 20) * env(0.09, 0.0003, curve=11)
        g = mix(g, bp(noise(0.05), 2200, 1.4) * env(0.05, 0.0003, curve=12) * 0.6)
        a = int(SR * at)
        out[a:a + len(g)] += g[:len(out) - a] * (1.0 if i == 0 else 0.85)
    return out


def s_sentry_shot():
    flick = bp(noise(0.06), 2300, 1.3) * env(0.06, 0.0004, curve=10)
    twang = ring(noise(0.16), 720, 14) * env(0.16, 0.001, curve=7)
    return mix(flick, twang * 0.7)


def s_ink_splat():
    splat = lp(noise(0.22), 1300, 3) * env(0.22, 0.0008, curve=6)
    blip = bp(noise(0.1), 500, 2.2) * env(0.1, 0.001, curve=8)
    return mix(splat, blip * 0.7)


def s_button():
    return bp(noise(0.05), 1600, 1.2) * env(0.05, 0.0004, curve=11) * 0.8



def s_thunder_strike():
    # the crack of the bolt, then the air collapsing behind it
    crack = hp(noise(0.12), 2200) * env(0.12, 0.0004, curve=9)
    body = bp(noise(0.5), 260, 1.1) * env(0.5, 0.002, curve=4)
    boom = lp(noise(0.7), 140, 3) * env(0.7, 0.004, curve=3)
    return mix(crack * 1.2, body * 0.8, boom * 1.1)


def s_thunder_roll():
    # the long rumble under the whole skill
    roll = lp(noise(2.2), 150, 3) * swell(2.2, 0.22, 1.8)
    groan = am(bp(noise(2.2), 90, 2.0) * swell(2.2, 0.3, 1.6), 3.2, 0.45)
    debris = grains(2.2, 30, spread=1.8, length=0.03, band=(300, 2000), decay=0.8)
    return mix(roll * 1.2, groan, debris * 0.35)


def s_storm_cloud():
    # a cloud gathering: air pulled inward
    return sweep(noise(0.55) * swell(0.55, 0.6, 2.2), 300, 1400, 1.3) * 0.9


def s_skill_ready():
    # the pencil box rattling - your ultimate is charged
    parts = []
    for i, f in enumerate([1800, 2500]):
        g = ring(noise(0.22), f, 20) * env(0.22, 0.002, curve=6)
        parts.append(np.pad(g, (int(SR * 0.09 * i), 0)))
    return mix(*parts, hp(noise(0.4), 4500) * swell(0.4, 0.3, 3.0) * 0.4)


def s_skill_cast():
    # the wind-up: everything sucked in, then let go
    pull = sweep(noise(0.75) * swell(0.75, 0.75, 1.6), 400, 3000, 1.4)
    hit = np.pad(mix(bp(noise(0.3), 120, 1.4) * env(0.3, 0.001, curve=5),
                     hp(noise(0.25), 3000) * env(0.25, 0.0006, curve=7) * 0.7),
                 (int(SR * 0.6), 0))
    return mix(pull * 0.85, hit * 1.2)


def s_push_wave():
    # a broad shove of air
    return mix(sweep(noise(0.9) * swell(0.9, 0.25, 2.0), 250, 1200, 1.1) * 1.1,
               lp(noise(0.5), 200, 3) * env(0.5, 0.004, curve=4) * 0.6)


def s_guillotine():
    # one enormous pair of scissors closing on the paper
    slide = sweep(noise(0.42) * swell(0.42, 0.7, 2.4), 1200, 4200, 1.6)
    snap = np.pad(mix(ring(noise(0.16), 3800, 22) * env(0.16, 0.0003, curve=9),
                      bp(noise(0.3), 180, 1.4) * env(0.3, 0.0015, curve=5) * 0.9),
                  (int(SR * 0.34), 0))
    tear = np.pad(sweep(noise(0.45) * swell(0.45, 0.15, 2.6), 900, 3600, 1.4), (int(SR * 0.4), 0))
    return mix(slide * 0.8, snap * 1.2, tear * 0.7)



# ---- one per skill, so no two ultimates sound alike --------------------
def s_sk_thunderhead():
    # a sky tearing open: flashes, then the strike, then a tail that rolls
    pre = grains(0.5, 8, spread=0.45, length=0.03, band=(1500, 6000), decay=0.6)
    crack = np.pad(hp(noise(0.18), 2000) * env(0.18, 0.0003, curve=7), (int(SR * 0.45), 0))
    slam = np.pad(bp(noise(0.9), 85, 1.2) * env(0.9, 0.003, curve=3), (int(SR * 0.46), 0))
    roll = np.pad(lp(noise(2.4), 170, 3) * swell(2.4, 0.15, 1.7), (int(SR * 0.5), 0))
    stabs = []
    for i in range(5):
        g = hp(noise(0.14), 2600) * env(0.14, 0.0004, curve=8)
        stabs.append(np.pad(g, (int(SR * (0.6 + i * 0.16)), 0)) * (0.7 - i * 0.09))
    return mix(pre * 0.5, crack * 1.2, slam * 1.3, roll * 1.1, *stabs)


def s_sk_perimeter():
    # a compass arm dragged all the way round, shoving air out with it
    scrape = am(sweep(noise(1.1) * swell(1.1, 0.35, 1.9), 700, 2600, 1.5), 11, 0.55)
    shove = sweep(noise(1.0) * swell(1.0, 0.2, 2.0), 200, 900, 1.0)
    thump = np.pad(bp(noise(0.4), 110, 1.4) * env(0.4, 0.002, curve=4), (int(SR * 0.08), 0))
    return mix(scrape * 0.8, shove * 1.2, thump * 0.7)


def s_sk_guillotine():
    # the shears travelling, meeting, and the page coming apart
    travel = am(sweep(noise(0.5) * swell(0.5, 0.8, 2.6), 900, 4600, 1.7), 30, 0.4)
    meet = np.pad(mix(ring(noise(0.2), 3600, 24) * env(0.2, 0.0003, curve=8),
                      ring(noise(0.2), 5200, 20) * env(0.2, 0.0004, curve=9) * 0.7,
                      bp(noise(0.45), 150, 1.3) * env(0.45, 0.0015, curve=4)),
                 (int(SR * 0.44), 0))
    tear = np.pad(sweep(noise(0.8) * swell(0.8, 0.12, 2.0), 1400, 350, 1.3), (int(SR * 0.5), 0))
    return mix(travel * 0.85, meet * 1.25, tear * 0.9)


def s_sk_eightways():
    # eight cracks fanning out, then the buzz that stays in the air
    outs = []
    for i in range(8):
        g = hp(noise(0.16), 3000) * env(0.16, 0.0004, curve=8)
        outs.append(np.pad(g, (int(SR * (0.02 + i * 0.018)), 0)) * (0.9 - i * 0.05))
    hum = np.pad(am(hp(noise(0.9), 2400) * swell(0.9, 0.12, 2.4), 60, 0.5), (int(SR * 0.1), 0))
    return mix(*outs, hum * 0.75)


def s_sk_cloudburst():
    # the page taking a bucket of water
    roar = lp(noise(1.5), 2600, 2) * swell(1.5, 0.18, 1.8)
    hiss = hp(noise(1.5), 3600) * swell(1.5, 0.22, 1.9)
    slap = bp(noise(0.5), 400, 1.2) * env(0.5, 0.002, curve=4)
    return mix(roar * 1.1, hiss * 0.7, slap * 0.8)


def s_sk_crosshatch():
    # a hand scribbling across the whole page, fast
    strokes = []
    for i in range(12):
        g = bp(noise(0.14), rng.uniform(1100, 3400), 1.3) * env(0.14, 0.0008, curve=6)
        strokes.append(np.pad(g, (int(SR * (0.02 + i * 0.055)), 0)) * rng.uniform(0.6, 1.0))
    return mix(*strokes)


def s_sk_blankslate():
    # an enormous rub-out, crumbs and all
    scrub = am(bp(noise(1.0), 1600, 1.0) * swell(1.0, 0.2, 2.0), 7, 0.7)
    crumbs = grains(1.1, 30, spread=0.8, length=0.012, band=(800, 3600), decay=1.4)
    return mix(scrub * 1.1, crumbs * 0.55)


def s_sk_exclamation():
    # something very heavy landing on paper
    whistle = sweep(noise(0.32) * swell(0.32, 0.8, 2.6), 2400, 700, 2.2)
    slam = np.pad(mix(bp(noise(0.8), 70, 1.2) * env(0.8, 0.002, curve=3),
                      bp(noise(0.3), 300, 1.6) * env(0.3, 0.001, curve=6) * 0.8,
                      grains(0.6, 18, spread=0.2, length=0.014, band=(600, 3400), decay=2.0) * 0.6),
                 (int(SR * 0.3), 0))
    return mix(whistle * 0.7, slam * 1.3)


def s_skill_charge():
    # the wind-up: everything dragged inward before the release
    pull = am(sweep(noise(0.85) * swell(0.85, 0.85, 1.4), 300, 3600, 1.5), 7, 0.35)
    shimmer = hp(noise(0.85), 5000) * swell(0.85, 0.8, 1.5)
    return mix(pull, shimmer * 0.5)



# ---- the Thunder Eagle ------------------------------------------------
def s_eagle_screech():
    # a raptor cry: two harsh bands sliding down together
    base = noise(0.55) * swell(0.55, 0.12, 2.6)
    cry = mix(sweep(base, 2600, 1300, 9.0), sweep(base, 3900, 2000, 7.0) * 0.7)
    rasp = am(bp(noise(0.55), 2200, 1.4) * swell(0.55, 0.15, 2.4), 48, 0.7)
    return mix(cry * 1.2, rasp * 0.5)


def s_eagle_dash():
    # a body tearing past, trailing static
    whoosh = sweep(noise(0.42) * swell(0.42, 0.42, 2.8), 500, 2800, 1.2)
    crackle = grains(0.45, 16, spread=0.35, length=0.008, band=(2400, 7000), decay=2.2)
    return mix(whoosh * 1.1, crackle * 0.6)


def s_bolt_shot():
    # a thin bolt loosed at the castle
    zip_ = sweep(noise(0.2) * env(0.2, 0.0006, curve=6), 1400, 4200, 3.0)
    tick = hp(noise(0.06), 3600) * env(0.06, 0.0004, curve=10)
    return mix(zip_, tick * 0.8)


def s_eagle_death():
    # the cry, the thunderclap, and the climb away
    cry = s_eagle_screech() * 1.0
    clap = np.pad(mix(hp(noise(0.16), 2400) * env(0.16, 0.0003, curve=8),
                      bp(noise(0.8), 95, 1.2) * env(0.8, 0.003, curve=3)),
                  (int(SR * 0.3), 0))
    climb = np.pad(sweep(noise(0.9) * swell(0.9, 0.3, 2.0), 600, 3400, 1.3), (int(SR * 0.45), 0))
    return mix(cry * 0.9, clap * 1.2, climb * 0.8)


SOUNDS = {
    'click_hit': s_click_hit, 'click_miss': s_click_miss, 'crit': s_crit,
    'kill': s_kill, 'kill_big': s_kill_big, 'castle_hit': s_castle_hit,
    'ward': s_ward, 'wave_start': s_wave_start, 'wave_clear': s_wave_clear,
    'card_draw': s_card_draw, 'card_buy': s_card_buy, 'skip': s_skip,
    'boss_spawn': s_boss_spawn, 'warden_shield': s_warden_shield,
    'game_over': s_game_over, 'victory': s_victory, 'fire_blast': s_fire_blast,
    'water_pop': s_water_pop, 'zap': s_zap, 'erase': s_erase,
    'compass_ring': s_compass_ring, 'snip': s_snip, 'sentry_shot': s_sentry_shot,
    'ink_splat': s_ink_splat, 'button': s_button,
    'thunder_strike': s_thunder_strike, 'thunder_roll': s_thunder_roll,
    'storm_cloud': s_storm_cloud, 'skill_ready': s_skill_ready,
    'skill_cast': s_skill_cast, 'push_wave': s_push_wave, 'guillotine': s_guillotine,
    'skill_charge': s_skill_charge,
    'sk_thunderhead': s_sk_thunderhead, 'sk_perimeter': s_sk_perimeter,
    'sk_guillotine': s_sk_guillotine, 'sk_eightways': s_sk_eightways,
    'sk_cloudburst': s_sk_cloudburst, 'sk_crosshatch': s_sk_crosshatch,
    'sk_blankslate': s_sk_blankslate, 'sk_exclamation': s_sk_exclamation,
    'eagle_screech': s_eagle_screech, 'eagle_dash': s_eagle_dash,
    'bolt_shot': s_bolt_shot, 'eagle_death': s_eagle_death,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, fn in SOUNDS.items():
        path, size = write(name, fn())
        total += size
        print('%-16s %6.1f kB' % (name, size / 1024))
    print('%-16s %6.1f kB total, %d files' % ('', total / 1024, len(SOUNDS)))
