/* FANDHARN - IGNIS, the last attacker: his sprite sheet.

   A skeleton in a tattered mantle, a crown of fire on his skull and fire in
   his eye, carrying a long staff - a caged ember at the top, a spear blade
   at the bottom. He is far too much drawing to redo with crayon every frame,
   so every pose of every animation is drawn once, in crayon, into a strip of
   frames (one canvas per animation), and the fight just picks frames. Each
   frame is drawn with its own seed, so the crayon boils from frame to frame
   the way everything else on the page does.

   Poses are a little skeleton rig: hip, lean, head, two legs, two arms, the
   staff through the near hand. The collapse, the pile of bones and the
   reassembly move the very same bones between the standing rig and where
   each one lies on the ground. Frames also remember where the eye, the
   staff's ember and the spear tip were, for the effects drawn over them. */

const IG = {
  bone: '#ece3c9', boneDark: '#c2b48f', ink: '#2b2b2b', ember: '#ff7a2d', emberHi: '#ffd24a',
  emberDeep: '#c8433a', cloak: '#2a1f2e', cloakHi: '#4a2e44', trim: '#8a2a1f',
  wood: '#4a3528', steel: '#6b7280', socket: '#1a1410'
};
const IG_STAFF = 140;

/* ------------------------------------------------------------- the rig */
const IG_REST = {
  x: 0, y: 0, lean: 0.06, head: 0, jaw: 0.05,
  hipL: -0.12, kneeL: 0.08, hipR: 0.12, kneeR: 0.06,
  shL: 0.15, elL: 0.35, shR: 0.5, elR: 0.9, sa: 0.12, grip: 0.42,
  eyes: 0.8, crown: 0.8, glow: 0.5, blur: 0, wind: 0, flutter: 0, crack: 0, core: 0.6
};
const igPose = o => Object.assign({}, IG_REST, o);
const igLerp = (a, b, k) => a + (b - a) * k;

/* Where every bone of a pose is. Each part: type, centre, angle (its local
   +y axis runs along the bone), plus what it needs to draw itself. */
function igRig(p) {
  const H = [p.x, -50 + p.y];
  const up = [Math.sin(p.lean), -Math.cos(p.lean)];
  const at = (b, d, v) => [b[0] + d[0] * v, b[1] + d[1] * v];
  const S = at(H, up, 38), neck = at(H, up, 44), chest = at(H, up, 25);
  const ha = p.lean + p.head;
  const head = [neck[0] + Math.sin(ha) * 13, neck[1] - Math.cos(ha) * 13];
  const seg = (A, B, extra) => Object.assign({
    x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2, a: Math.atan2(-(B[0] - A[0]), B[1] - A[1]),
    L: Math.hypot(B[0] - A[0], B[1] - A[1])
  }, extra);
  const leg = (hipA, bend) => {
    const k = [H[0] + Math.sin(hipA) * 25, H[1] + Math.cos(hipA) * 25];
    const a2 = hipA - bend;
    return { k, f: [k[0] + Math.sin(a2) * 25, k[1] + Math.cos(a2) * 25] };
  };
  const arm = (sh, el) => {
    const a1 = sh + p.lean, e = [S[0] + Math.sin(a1) * 21, S[1] + Math.cos(a1) * 21];
    const a2 = a1 + el;
    return { e, h: [e[0] + Math.sin(a2) * 20, e[1] + Math.cos(a2) * 20] };
  };
  const lL = leg(p.hipL, p.kneeL), lR = leg(p.hipR, p.kneeR);
  const aL = arm(p.shL, p.elL), aR = arm(p.shR, p.elR);
  const dt = [Math.sin(p.sa), -Math.cos(p.sa)];
  const top = at(aR.h, dt, IG_STAFF * (1 - p.grip)), bottom = at(aR.h, dt, -IG_STAFF * p.grip);
  const parts = [
    seg(S, aL.e, { type: 'bone', w: 5, dark: 1 }), seg(aL.e, aL.h, { type: 'bone', w: 4.5, dark: 1, hand: 1 }),
    seg(H, lL.k, { type: 'bone', w: 6, dark: 1 }), seg(lL.k, lL.f, { type: 'bone', w: 5, dark: 1, foot: 1 }),
    { type: 'pelvis', x: H[0], y: H[1], a: p.lean * 0.5 },
    seg(at(H, up, 4), at(H, up, 20), { type: 'spine' }),
    { type: 'ribs', x: chest[0], y: chest[1], a: p.lean, core: p.core, crack: p.crack },
    { type: 'skull', x: head[0], y: head[1], a: ha, jaw: p.jaw, eyes: p.eyes, crown: p.crown, crack: p.crack },
    seg(H, lR.k, { type: 'bone', w: 6 }), seg(lR.k, lR.f, { type: 'bone', w: 5, foot: 1 }),
    Object.assign(seg(top, bottom, { type: 'staff', glow: p.glow, blur: p.blur })),
    seg(S, aR.e, { type: 'bone', w: 5 }), seg(aR.e, aR.h, { type: 'bone', w: 4.5, hand: 1 })
  ];
  const eyeOff = [6 * Math.cos(ha) + 2 * Math.sin(ha), 6 * Math.sin(ha) - 2 * Math.cos(ha)];
  return {
    parts, H, S, neck, head, chest,
    anchors: { eye: [head[0] + eyeOff[0], head[1] + eyeOff[1]], top, tip: bottom, hand: aR.h, chest, head }
  };
}

/* Where each bone lies once he has fallen apart - same order as igRig. */
const IG_PILE = [
  [-36, -10, 2.4], [20, -16, 0.6], [-30, -5, 1.2], [26, -4, 1.7],
  [16, -8, -0.9], [-20, -6, 1.3], [-4, -15, 1.45], [8, -31, 0.25],
  [-10, -4, 1.9], [34, -9, 0.9], [0, -3, Math.PI / 2 + 0.08], [0, -22, -1.1], [-24, -18, 2.0]
];
const IG_ARC = [14, 10, 8, 6, 12, 10, 16, 22, 8, 7, 5, 12, 11];

/* A pose part-way between standing and the pile: k 0 standing, 1 fallen. */
function igBlend(rig, k, extra) {
  const e = E.inOut(k);
  return rig.parts.map((pt, i) => {
    const [px, py, pa] = IG_PILE[i];
    let da = pa - pt.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return Object.assign({}, pt, extra || {}, {
      x: igLerp(pt.x, px, e), y: igLerp(pt.y, py, e) - Math.sin(k * Math.PI) * IG_ARC[i],
      a: pt.a + da * e
    });
  });
}

/* ------------------------------------------------------------ the parts */
function igBone(g, L, w, dark, hand, foot) {
  const c = dark ? IG.boneDark : IG.bone;
  Rough.line(g, 0, -L / 2, 0, L / 2, { color: IG.ink, width: w + 3.2, jitter: 0.5, passes: 1 });
  Rough.line(g, 0, -L / 2, 0, L / 2, { color: c, width: w, jitter: 0.4, passes: 1 });
  for (const s of [-1, 1]) Rough.blob(g, 0, s * L / 2, w * 0.72, c, IG.ink, { spacing: 2, fillWidth: 2, sides: 7, width: 1.4, wobble: 0.4 });
  if (hand) {                                     // three long fingers, curled
    for (const f of [-3, 0, 3]) {
      Rough.poly(g, [[f * 0.6, L / 2 + 2], [f, L / 2 + 6], [f * 1.2 + 2, L / 2 + 9]], { color: IG.ink, width: 1.8, jitter: 0.3, closed: false, passes: 1 });
    }
  }
  if (foot) {
    Rough.line(g, 0, L / 2 + 1, 8, L / 2 + 2, { color: IG.ink, width: 4.5, jitter: 0.3, passes: 1 });
    Rough.line(g, 0, L / 2 + 1, 8, L / 2 + 2, { color: c, width: 2.2, jitter: 0.3, passes: 1 });
  }
}

function igFlame(g, x, y, h, w, seedA) {
  const tip = [x + Rough.jit(w * 0.5), y - h];
  const outer = [[x - w, y], [x - w * 0.5, y - h * 0.45], tip, [x + w * 0.5, y - h * 0.5], [x + w, y]];
  Rough.scribble(g, outer, { color: IG.ember, spacing: 2, width: 2.4, overflow: 1.1 });
  const inner = [[x - w * 0.45, y], [x, y - h * 0.6], [x + w * 0.45, y]];
  Rough.scribble(g, inner, { color: IG.emberHi, spacing: 1.6, width: 2, overflow: 1.1 });
  Rough.poly(g, outer, { color: IG.emberDeep, width: 1.2, jitter: 0.4, closed: false, passes: 1 });
}

function igSkull(g, pt) {
  // the crown of fire first, so the skull sits in it
  const crown = pt.crown || 0;
  if (crown > 0.05) {
    for (let i = 0; i < 5; i++) {
      const a = -2.55 + i * 0.5;
      const bx = Math.cos(a) * 11, by = Math.sin(a) * 11;
      igFlame(g, bx, by + 2, (7 + (i % 2) * 6 + Rough.rnd() * 5) * crown, 3.4, i);
    }
  }
  const cran = Rough.circlePts(0, 0, 13, 0.8, 14);
  Rough.scribble(g, cran, { color: IG.bone, spacing: 2.2, width: 2.8, overflow: 1.06 });
  Rough.poly(g, cran, { color: IG.ink, width: 2, jitter: 0.5 });
  // the face: brow, cheek, the bony snout
  const face = [[4, -3], [15, 1], [15, 7], [3, 8]];
  Rough.scribble(g, face, { color: IG.bone, spacing: 2, width: 2.4, overflow: 1.05 });
  Rough.poly(g, face, { color: IG.ink, width: 1.7, jitter: 0.4 });
  // the eye: a deep socket with fire in it
  g.fillStyle = IG.socket;
  g.beginPath(); g.ellipse(7, -1.5, 4.4, 3.8, 0, 0, 7); g.fill();
  const eyes = pt.eyes || 0;
  if (eyes > 0.05) igFlame(g, 7, 1, 7 * eyes, 2.2 * Math.min(1.2, eyes), 9);
  Rough.poly(g, [[12, 2], [14, 4.5], [11.5, 4.5]], { color: IG.socket, width: 1.8, jitter: 0.2 });
  for (let i = 0; i < 4; i++) Rough.line(g, 6 + i * 2.5, 7, 6 + i * 2.5, 9.5, { color: IG.ink, width: 1.2, jitter: 0.2, passes: 1 });
  // the jaw, hinged under the ear
  g.save();
  g.translate(1, 6);
  g.rotate((pt.jaw || 0) * 0.75);
  const jaw = [[0, 0], [14, 3], [13, 7.5], [2, 7]];
  Rough.scribble(g, jaw, { color: IG.bone, spacing: 2, width: 2.2, overflow: 1.05 });
  Rough.poly(g, jaw, { color: IG.ink, width: 1.6, jitter: 0.4 });
  for (let i = 0; i < 4; i++) Rough.line(g, 5 + i * 2.4, 2.4, 5 + i * 2.4, 0.2, { color: IG.ink, width: 1.1, jitter: 0.2, passes: 1 });
  g.restore();
  // an old crack across the crown - glowing when he is breaking
  const crack = [[-7, -10], [-3, -6], [-5, -2], [0, 1]];
  Rough.poly(g, crack, { color: pt.crack ? IG.ember : IG.ink, width: pt.crack ? 2.4 : 1.3, jitter: 0.3, closed: false, passes: 1 });
}

function igRibs(g, pt) {
  if ((pt.core || 0) > 0.05) {                     // the ember his hearts come from
    Rough.blob(g, 3, -1, 3.4 * Math.min(1.5, pt.core + 0.3), IG.ember, IG.emberDeep, { spacing: 1.8, fillWidth: 2, sides: 7, width: 1.2, wobble: 0.5 });
  }
  for (let i = 0; i < 4; i++) {
    const y = -11 + i * 6;
    const rib = [[-5, y], [2, y - 4 + i * 0.4], [9, y - 1], [11, y + 3]];
    Rough.poly(g, rib, { color: IG.ink, width: 4.4, jitter: 0.4, closed: false, passes: 1 });
    Rough.poly(g, rib, { color: i === 3 ? IG.boneDark : IG.bone, width: 2.2, jitter: 0.3, closed: false, passes: 1 });
  }
  Rough.line(g, -5, -14, -5, 13, { color: IG.ink, width: 5, jitter: 0.4, passes: 1 });
  Rough.line(g, -5, -14, -5, 13, { color: IG.bone, width: 2.6, jitter: 0.3, passes: 1 });
  Rough.line(g, 11.5, -9, 12, 10, { color: IG.ink, width: 1.6, jitter: 0.3, passes: 1 });
  if (pt.crack) Rough.poly(g, [[0, -12], [4, -5], [1, 2], [6, 9]], { color: IG.ember, width: 2.2, jitter: 0.3, closed: false, passes: 1 });
}

function igPelvis(g) {
  const p = [[-9, -4], [2, -9], [10, -3], [8, 5], [-2, 7], [-10, 3]];
  Rough.scribble(g, p, { color: IG.bone, spacing: 2, width: 2.4, overflow: 1.05 });
  Rough.poly(g, p, { color: IG.ink, width: 1.8, jitter: 0.4 });
  g.fillStyle = IG.socket;
  g.beginPath(); g.arc(1, 0, 2.2, 0, 7); g.fill();
}

function igSpine(g, pt) {
  const L = pt.L || 16;
  for (let i = 0; i <= 4; i++) {
    const y = -L / 2 + (L * i) / 4;
    Rough.blob(g, 0, y, 2.6, IG.bone, IG.ink, { spacing: 1.6, fillWidth: 2, sides: 6, width: 1.2, wobble: 0.3 });
  }
}

/* The staff: local y from -70 (the ember in its crook) to +70 (the spear). */
function igStaff(g, pt) {
  if (pt.blur > 0.05) {                          // spinning: the blur of it
    for (const r of [60, 68]) {
      Rough.arc(g, 0, 0, r, -0.2, Math.PI * 2 - 0.4, { color: '#8a7a6a', width: 2, jitter: 1, passes: 1, alpha: 0.35 * pt.blur });
    }
  }
  const shaft = [[-2.6, -58], [2.6, -58], [2.2, 50], [-2.2, 50]];
  Rough.scribble(g, shaft, { color: IG.wood, spacing: 2, width: 2.4, overflow: 1.2 });
  Rough.poly(g, shaft, { color: IG.ink, width: 1.6, jitter: 0.4 });
  for (const y of [-42, -14, 22]) {                // bone wrapped round it
    Rough.line(g, -4, y, 4, y + 2, { color: IG.bone, width: 3, jitter: 0.3, passes: 1 });
  }
  // the crook, and the caged ember hanging in it
  Rough.arc(g, 7, -62, 8, Math.PI * 0.95, Math.PI * 2.35, { color: IG.ink, width: 4.4, jitter: 0.4, passes: 1 });
  Rough.arc(g, 7, -62, 8, Math.PI * 0.95, Math.PI * 2.35, { color: IG.wood, width: 2.2, jitter: 0.3, passes: 1 });
  const glow = pt.glow || 0;
  Rough.blob(g, 8, -57, 5 + glow * 1.6, IG.ember, IG.emberDeep, { spacing: 1.8, fillWidth: 2, sides: 8, width: 1.4, wobble: 0.6 });
  Rough.blob(g, 8, -57, 2.4 + glow, IG.emberHi, null, { spacing: 1.4, fillWidth: 2, sides: 7, width: 0.1, wobble: 0.4 });
  for (const dx of [-4, 0, 4]) Rough.line(g, 8 + dx, -63, 8 + dx * 0.6, -51, { color: IG.ink, width: 1, jitter: 0.2, passes: 1 });
  // the spear at the foot of it
  Rough.line(g, -4.5, 50, 4.5, 51, { color: IG.bone, width: 3.2, jitter: 0.3, passes: 1 });
  const blade = [[-4, 52], [4, 52], [5.5, 58], [0, 73], [-5.5, 58]];
  Rough.scribble(g, blade, { color: IG.steel, spacing: 1.8, width: 2.2, overflow: 1.1 });
  Rough.poly(g, blade, { color: IG.ink, width: 1.6, jitter: 0.3 });
  Rough.line(g, 0, 54, 0, 68, { color: '#e8ecf2', width: 1, jitter: 0.2, passes: 1, alpha: 0.8 });
}

function igPart(g, pt) {
  g.save();
  g.translate(pt.x, pt.y);
  g.rotate(pt.a);
  if (pt.type === 'bone') igBone(g, pt.L, pt.w, pt.dark, pt.hand, pt.foot);
  else if (pt.type === 'skull') igSkull(g, pt);
  else if (pt.type === 'ribs') igRibs(g, pt);
  else if (pt.type === 'pelvis') igPelvis(g);
  else if (pt.type === 'spine') igSpine(g, pt);
  else if (pt.type === 'staff') igStaff(g, pt);
  g.restore();
}

/* The mantle, hood and all: hung off the shoulders, trailing behind (or
   blown forward), tattered at the hem. `k` 0..1 slumps it onto the ground. */
function igCloak(g, rig, p, k) {
  const { H, S, neck, head } = rig;
  const wind = p.wind || 0, fl = p.flutter || 0;
  if (k < 0.55) {
    const drop = k * 40;
    const hemY = H[1] + 38 - drop * 0.2;
    const back = -18 - wind * 16;
    const hem = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const x = H[0] + igLerp(back - 6, 8 - wind * 4, u) + Math.sin(fl * Math.PI * 2 + u * 7) * 3;
      hem.push([x, hemY + (i % 2 ? -7 : 2) + Math.sin(fl * Math.PI * 2 + i) * 2 + u * -6]);
    }
    const shape = [[S[0] + 5, S[1] - 2], [neck[0] - 6, neck[1] - 4], [H[0] + back * 0.7, H[1] + 4]]
      .concat(hem).concat([[H[0] + 8, H[1] + 10], [S[0] + 7, S[1] + 8]]);
    Rough.scribble(g, shape, { color: IG.cloak, spacing: 2.6, width: 3.2, overflow: 1.04 });
    Rough.scribble(g, shape, { color: IG.cloakHi, spacing: 7, width: 2.2, overflow: 1, alpha: 0.6, angle: 0.9 });
    Rough.poly(g, shape, { color: '#140e16', width: 1.8, jitter: 0.6 });
    Rough.poly(g, hem, { color: IG.trim, width: 2, jitter: 0.5, closed: false, passes: 1 });
    // the hood, behind the skull
    const hood = Rough.circlePts(head[0] - 3, head[1] - 1, 16, 1.2, 12);
    Rough.scribble(g, hood, { color: IG.cloak, spacing: 2.6, width: 3, overflow: 1.04 });
    Rough.poly(g, hood, { color: '#140e16', width: 1.6, jitter: 0.5 });
  } else {
    const s = (k - 0.55) / 0.45;                  // the mantle, fallen in a heap
    const rag = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rag.push([Math.cos(a) * 46 * s + Rough.jit(3), -5 + Math.sin(a) * 9 * s - (Math.sin(a) < 0 ? 6 * s : 0) + Rough.jit(2)]);
    }
    Rough.scribble(g, rag, { color: IG.cloak, spacing: 2.6, width: 3, overflow: 1.04 });
    Rough.poly(g, rag, { color: '#140e16', width: 1.6, jitter: 0.6 });
  }
}

/* One whole frame of him, standing (or part-fallen). */
function igDrawPose(g, p, fall) {
  const rig = igRig(p);
  const k = fall || 0;
  igCloak(g, rig, p, k);
  const parts = k > 0 ? igBlend(rig, k, { eyes: p.eyes, crown: p.crown, jaw: p.jaw }) : rig.parts;
  for (const pt of parts) igPart(g, pt);
  return rig.anchors;
}

/* ------------------------------------------------------- the animations */
const IG_ANIMS = {
  idle: { n: 4, fps: 6, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2);
    return igPose({ y: s * 1.2, lean: 0.06 + s * 0.02, head: s * 0.03, flutter: u, eyes: 0.8 + 0.15 * s, crown: 0.8 + 0.2 * Math.sin(u * Math.PI * 4) });
  } },
  walk: { n: 8, fps: 8, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2), c = Math.cos(u * Math.PI * 2);
    return igPose({ hipR: 0.4 * s, hipL: -0.4 * s, kneeR: 0.15 + Math.max(0, c) * 0.5, kneeL: 0.15 + Math.max(0, -c) * 0.5,
      y: 2 - Math.abs(c) * 1.5, sa: 0.2 + 0.12 * s, shR: 0.5 + 0.1 * s, shL: 0.1 - 0.3 * s, lean: 0.12, flutter: u, wind: 0.4 });
  } },
  raise: { n: 5, fps: 9, loop: false, pose: u => {
    const e = E.out(u);
    return igPose({ shR: igLerp(0.5, 2.9, e), elR: igLerp(0.9, 0.2, e), shL: igLerp(0.15, 2.4, e), elL: 0.4,
      sa: igLerp(0.12, -0.05, e), grip: igLerp(0.42, 0.38, e), lean: igLerp(0.06, -0.12, e), head: igLerp(0, -0.25, e),
      glow: igLerp(0.5, 1.3, e), eyes: igLerp(0.8, 1.2, e), crown: igLerp(0.8, 1.3, e), jaw: igLerp(0.05, 0.35, e), flutter: u });
  } },
  dashback: { n: 3, fps: 12, loop: true, pose: u => igPose({ lean: 0.38, x: -4, hipR: 0.55, kneeR: 0.3, hipL: -0.45, kneeL: 0.5,
    shR: 1.3, elR: 0.3, sa: 1.25, grip: 0.5, shL: 1.0, elL: 0.5, wind: -1, flutter: u, eyes: 1.1, jaw: 0.2, crown: 1.1 }) },
  summon: { n: 4, fps: 8, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2);
    return igPose({ shR: 2.8, elR: 0.25, shL: 2.6, elL: 0.5, sa: 0, grip: 0.38, lean: -0.1, head: -0.2, jaw: 0.3 + 0.1 * s,
      glow: 1.3 + 0.3 * s, eyes: 1.2, crown: 1.3 + 0.2 * s, flutter: u, wind: -0.2, core: 0.15 });
  } },
  guard: { n: 8, fps: 12, loop: true, pose: u => igPose({ grip: 0.5, sa: u * Math.PI * 2, shR: 1.2, elR: 0.4, shL: 1.0, elL: 1.2,
    lean: 0.1, hipL: -0.3, kneeL: 0.2, hipR: 0.3, kneeR: 0.25, y: 3, blur: 0.5, eyes: 1, flutter: u, core: 0.2 }) },
  thrust: { n: 6, fps: 12, loop: false, pose: u => {
    const i = Math.round(u * 5);
    const wind = i < 2, out = i >= 2 && i <= 4;
    return igPose({ sa: -Math.PI / 2, grip: 0.5, lean: wind ? -0.15 : out ? 0.45 : 0.2,
      shR: wind ? 0.2 : out ? 1.5 : 0.9, elR: wind ? 1.6 : out ? 0.05 : 0.6,
      hipR: out ? 0.7 : 0.2, kneeR: out ? 0.2 : 0.1, hipL: out ? -0.55 : -0.2, kneeL: out ? 0.25 : 0.1, y: out ? 4 : 1,
      jaw: out ? 0.45 : 0.1, eyes: out ? 1.3 : 1, crown: out ? 1.2 : 0.9, wind: out ? 0.5 : 0, flutter: u, core: 0.2 });
  } },
  roar: { n: 4, fps: 10, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2);
    return igPose({ lean: -0.25, head: -0.55, jaw: 1, shL: 2.1, elL: 0.2, shR: 1.9, elR: 0.3, sa: 0.9, grip: 0.45,
      eyes: 1.4, crown: 1.5 + 0.2 * s, glow: 1, y: 1, wind: -0.6, flutter: u * 2, hipL: -0.25, hipR: 0.25 });
  } },
  block: { n: 4, fps: 16, loop: true, pose: u => igPose({ grip: 0.5, sa: u * Math.PI * 2 + 0.4, shR: 1.35, elR: 0.2, shL: 1.1, elL: 1.0,
    lean: 0.05, blur: 1, eyes: 1.1, crown: 1, hipL: -0.28, hipR: 0.28, kneeL: 0.2, kneeR: 0.2, y: 2, flutter: u }) },
  exposed: { n: 4, fps: 5, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2);
    return igPose({ y: 16 + s, lean: 0.4, head: 0.45, hipR: 1.25, kneeR: 1.25, hipL: -0.1, kneeL: 1.47,
      shR: 0.9, elR: 0.5, sa: 0.2, grip: 0.5, shL: 0.6, elL: 0.8, eyes: 0.35 + 0.1 * s, crown: 0.25, jaw: 0.15 + 0.1 * s, core: 0.25, flutter: u * 0.3 });
  } },
  collapse: { n: 7, fps: 10, loop: false, fall: u => u,
    pose: () => igPose({ y: 16, lean: 0.4, head: 0.45, hipR: 1.25, kneeR: 1.25, hipL: -0.1, kneeL: 1.47, shR: 0.9, elR: 0.5, sa: 0.2, grip: 0.5,
      shL: 0.6, elL: 0.8, eyes: 0.3, crown: 0.1, jaw: 0.4, core: 0.1 }) },
  bones: { n: 3, fps: 3, loop: true, fall: () => 1, pose: u => igPose({ eyes: 0.15 + 0.1 * Math.round(u * 2), crown: 0, jaw: 0.3, core: 0 }) },
  rise: { n: 8, fps: 8, loop: false, fall: u => 1 - u,
    pose: u => igPose({ eyes: u > 0.7 ? 1.3 : 0.2, crown: u > 0.8 ? 1.2 : 0, jaw: 0.3, core: u > 0.6 ? 1 : 0, glow: u > 0.8 ? 1 : 0.3 }) },
  slam: { n: 6, fps: 12, loop: false, pose: u => {
    const i = Math.round(u * 5);
    const P = [
      { y: 10, lean: 0.2, hipR: 0.4, kneeR: 0.8, hipL: -0.3, kneeL: 0.7, shR: 1.6, elR: 0.6, sa: 0.3 },
      { y: -18, lean: -0.05, hipR: 0.3, kneeR: 0.9, hipL: -0.2, kneeL: 0.9, shR: 2.9, elR: 0.2, sa: 0.05, grip: 0.3 },
      { y: -24, lean: -0.1, hipR: 0.4, kneeR: 1.0, hipL: -0.1, kneeL: 1.0, shR: 3.0, elR: 0.15, sa: -0.1, grip: 0.3 },
      { y: -6, lean: 0.3, hipR: 0.5, kneeR: 0.5, hipL: -0.3, kneeL: 0.5, shR: 2.0, elR: 0.2, sa: 0.2, grip: 0.4 },
      { y: 10, lean: 0.5, hipR: 0.8, kneeR: 0.9, hipL: -0.5, kneeL: 0.6, shR: 1.0, elR: 0.2, sa: 0.35, grip: 0.55 },
      { y: 9, lean: 0.45, hipR: 0.8, kneeR: 0.9, hipL: -0.5, kneeL: 0.6, shR: 1.0, elR: 0.25, sa: 0.33, grip: 0.55 }
    ][i];
    return igPose(Object.assign({ jaw: i >= 3 ? 0.6 : 0.2, eyes: 1.3, crown: 1.3, glow: 1.1, wind: i < 3 ? -0.5 : 0.6, flutter: u, shL: 1.5, elL: 0.6 }, P));
  } },
  death: { n: 4, fps: 6, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2);
    return igPose({ lean: 0.25 + 0.1 * s, head: 0.5, jaw: 0.6, hipR: 0.35, kneeR: 0.6, hipL: -0.2, kneeL: 0.5, y: 8,
      shR: 0.4, elR: 0.3, sa: 0.6, grip: 0.4, shL: 0.2, elL: 0.2, eyes: 0.6 + 0.4 * (Math.round(u * 3) % 2), crack: 1, crown: 0.4, core: 1.3, flutter: u });
  } },
  emerge: { n: 4, fps: 8, loop: true, pose: u => {
    const s = Math.sin(u * Math.PI * 2);
    return igPose({ shR: 2.7, elR: 0.4, shL: 2.9, elL: 0.3, sa: -0.1, grip: 0.4, lean: -0.05, head: -0.35, jaw: 0.5 + 0.2 * s,
      eyes: 1, crown: 0.6 + 0.3 * s, wind: -0.5, flutter: u, glow: 0.9 });
  } }
};

/* --------------------------------------------------------- the sheet */
const IgnisSheet = {
  CELL: 240, OX: 120, OY: 222,
  strips: {},             // name -> { cv, anchors: [], done }
  scale: 1,
  queue: null,

  names() { return Object.keys(IG_ANIMS); },

  strip(name) {
    let s = this.strips[name];
    if (!s) {
      const a = IG_ANIMS[name];
      this.scale = (typeof Settings !== 'undefined' && Settings.data.low) ? 0.75 : 1;
      const cv = document.createElement('canvas');
      cv.width = Math.round(this.CELL * a.n * this.scale);
      cv.height = Math.round(this.CELL * this.scale);
      s = this.strips[name] = { cv, anchors: [], done: 0, scale: this.scale };
    }
    return s;
  },

  /* Draw one frame into its strip (in full crayon, whatever the setting). */
  build(name, i) {
    const a = IG_ANIMS[name], s = this.strip(name);
    if (s.anchors[i]) return;
    const g = s.cv.getContext('2d');
    const low = Rough.isLow();
    Rough.setLow(false);
    Rough.srand(7000 + this.names().indexOf(name) * 97 + i * 13);
    g.setTransform(s.scale, 0, 0, s.scale, (i * this.CELL + this.OX) * s.scale, this.OY * s.scale);
    const u = a.loop ? i / a.n : (a.n > 1 ? i / (a.n - 1) : 0);
    s.anchors[i] = igDrawPose(g, a.pose(u), a.fall ? a.fall(u) : 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    Rough.setLow(low);
    s.done++;
  },

  ensure(name) {
    const a = IG_ANIMS[name];
    for (let i = 0; i < a.n; i++) this.build(name, i);
  },

  /* Build a few frames at a time in the background, so nothing hitches
     when he turns up. `budget` is milliseconds to spend now. */
  warm(budget) {
    if (!this.queue) {
      this.queue = [];
      for (const name of ['emerge', 'idle', 'walk', 'roar', 'raise', 'dashback', 'summon', 'guard', 'thrust',
        'block', 'exposed', 'collapse', 'bones', 'rise', 'slam', 'death']) {
        for (let i = 0; i < IG_ANIMS[name].n; i++) this.queue.push([name, i]);
      }
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budget) {
      const [name, i] = this.queue.shift();
      this.build(name, i);
    }
    return this.queue.length === 0;
  },

  /* Which frame of an animation `t` seconds in: looped or held on the last. */
  frameAt(name, t) {
    const a = IG_ANIMS[name];
    const f = Math.floor(t * a.fps);
    return a.loop ? ((f % a.n) + a.n) % a.n : Math.min(a.n - 1, Math.max(0, f));
  },
  length(name) { const a = IG_ANIMS[name]; return a.n / a.fps; },

  /* Blit one frame with his feet at (x, y). Returns that frame's anchors in
     world space (eye, top, tip, hand, chest, head). */
  draw(ctx, name, i, x, y, flip, scale) {
    const s = this.strip(name);
    this.build(name, i);
    const k = scale || 1;
    const C = this.CELL;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -k : k, k);
    ctx.drawImage(s.cv, i * C * s.scale, 0, C * s.scale, C * s.scale, -this.OX, -this.OY, C, C);
    ctx.restore();
    const A = s.anchors[i], out = {};
    for (const key in A) out[key] = [x + (flip ? -A[key][0] : A[key][0]) * k, y + A[key][1] * k];
    return out;
  },

  /* ---- the pieces he breaks into when he dies: each bone of a pose on a
     small canvas of its own, so it can fly off and fade on its own. */
  pieces(name, i) {
    const rig = igRig(IG_ANIMS[name].pose(IG_ANIMS[name].loop ? i / IG_ANIMS[name].n : 0));
    const low = Rough.isLow();
    Rough.setLow(false);
    const out = rig.parts.map((pt, j) => {
      const R = pt.type === 'staff' ? 80 : pt.type === 'skull' ? 34 : pt.type === 'bone' ? Math.max(20, pt.L / 2 + 12) : 22;
      const cv = document.createElement('canvas');
      cv.width = cv.height = R * 2;
      const g = cv.getContext('2d');
      Rough.srand(900 + j * 7);
      g.translate(R, R);
      igPart(g, Object.assign({}, pt, { x: 0, y: 0, a: 0 }));
      return { cv, R, x: pt.x, y: pt.y, a: pt.a, type: pt.type };
    });
    Rough.setLow(low);
    return out;
  }
};
