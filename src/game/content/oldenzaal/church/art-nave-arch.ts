/**
 * The nave's architecture (CHURCH, wave B; docs/design/oldenzaal.md §7.1; our own drawing of a
 * Gothic nave in grey-brown Bentheimer sandstone, never a copy of a real interior): ONE drawer
 * per id for the 1×, 2× and 4× art.
 *
 * - `oz-nave-far` (background generator, tiles in x): the far side of the nave seen across it:
 *   the arcade of slim pillars and pointed arches into the dim north aisle (its tall stained-glass
 *   lancets, the Stations of the Cross as tiny frames between them), the triforium's blind
 *   arcade, the clerestory windows and the rib vault with its bosses. Cold, hazy, deep.
 * - `decor/oz-nave/pillar`: a near compound pier (a round drum with attached shafts, a moulded
 *   base, a carved leaf capital, the vault shaft rising out of view).
 * - `decor/oz-nave/west`: the west end: the wall with the deep pointed doorway (the doors are an
 *   entity, `oz-nave-doors`), the organ gallery's oak balustrade and the organ case with its pipe
 *   towers above it.
 * - `decor/oz-nave/apse`: the east end behind the choir: the chancel arch, three tall lancets,
 *   the dark dossal behind the altar, the stepped predella, choir stalls, and the round-arched
 *   doorway with the stair down to the crypt.
 * - `decor/oz-nave/chapel`: the side chapel of the dead (a recess under a moulded pointed arch:
 *   a small altar with a plain cross, a tomb chest, memorial tablets); its iron grille is an entity.
 *
 * Abandoned for weeks: soot and dust, cobwebs, nothing broken on purpose (respect, spec §7).
 */
import { archPointed, archRound, ashlar, brassT, cobweb, COLD, ct, dp, dustOn, h2, ironT, lancet, moulding, mx, num, oakBox, outlineC, pick, regC, regCBg, shaft, T, type Pen } from './kit';

// ============================================================================================
// The far side of the nave (background, factorX ≈ 0.5)
// ============================================================================================

/** The far bay's width (the layer tiles in multiples of it). */
export const FAR_BAY = 128;

regCBg('oz-nave-far', (p, params, seed) => {
  const d = p.d;
  const air = num(params, 'air', 0.34);
  const st = ct('sandstone', d, air);
  const W = p.w;
  // The deep space of the nave: a dark gradient (the vault darkest at the top).
  p.fill(0, 0, W, p.h, (X, Y) => dp(st, 1.4 + (Y / d / p.h) * 1.2, X, Y, 0.9));
  const bays = Math.max(1, Math.round(W / FAR_BAY));
  for (let b = 0; b < bays; b++) farBay(p, b * FAR_BAY, seed + b * 7, air);
  // A faint cold haze over the lower half (the air of the nave between us and the far wall).
  if (d >= 2) {
    const hz = mx(T('night', 3, d), COLD, 0.2, d);
    p.tint(0, 120, W, 96, (X, Y, old) => (((X * 7 + Y * 3) & 7) === 0 ? mx(old, hz, 0.35, d) : 0));
  }
});

function farBay(p: Pen, x0: number, seed: number, air: number): void {
  const d = p.d;
  const st = ct('sandstone', d, air);
  const B = FAR_BAY;
  const floor = 174;
  const spring = 116;
  const apex = 86;
  const pw = 9;
  // --- the vault: webs between the ribs, the diagonal ribs and the transverse arch, a boss.
  p.fill(x0, 0, B, 36, (X, Y) => {
    const lx = (X + 0.5) / d - x0;
    const ly = (Y + 0.5) / d;
    // Each web is a cell lit from its upper left (concave); darker toward the crown.
    const w = Math.abs(lx - B / 2) / (B / 2);
    return dp(st, 1.6 + w * 1.2 - ly * 0.012 + (h2(Math.floor(lx / 6), Math.floor(ly / 3), seed) - 0.5) * 0.4, X, Y, 0.8);
  });
  const rib = pick(st, 3.4);
  const ribD = pick(st, 1.4);
  for (const s of [-1, 1]) {
    // Diagonal ribs from the pillar heads (x0, 40) and (x0 + B, 40) up to the boss in the middle.
    const xa = s < 0 ? x0 : x0 + B;
    for (let t = 0; t <= 1; t += 1 / (24 * d)) {
      const x = xa + (x0 + B / 2 - xa) * t;
      const y = 40 - Math.sin(t * Math.PI * 0.5) * 34;
      p.rect(x - 0.6, y, 1.2, 1.4, rib);
      if (d >= 2) p.rect(x - 0.6, y + 1.2, 1.2, 0.5, ribD);
    }
  }
  // The transverse arch over each pillar.
  p.rect(x0 - 1.5, 0, 3, 42, pick(st, 2.8));
  if (d >= 2) p.rect(x0 - 1.5, 0, 0.75, 42, pick(st, 3.8));
  // The boss at the crown.
  p.disc(x0 + B / 2, 6, 2.6, 2.2, (_X, _Y, u, v) => pick(st, 4.2 - (u + v) * 1.2));
  // --- the clerestory: a pair of lancets per bay over a sill, the vault shafts.
  const cy = 38;
  for (const lx of [B / 2 - 15, B / 2 + 3]) {
    p.rect(x0 + lx - 2, cy - 1, 16, 34, pick(st, 1.2));
    lancet(p, x0 + lx, cy, 12, 32, seed + lx, 0.35);
  }
  moulding(p, x0 + 6, 70, B - 12, 2, 3, air);
  // --- the triforium: a blind arcade of small pointed arches.
  for (let i = 0; i < 6; i++) {
    const ax = x0 + 12 + i * ((B - 24) / 6);
    archPointed(p, ax + 1.5, 73, (B - 24) / 6 - 3, 11, pick(st, 0.8));
  }
  moulding(p, x0 + 4, 84, B - 8, 2, 3.2, air);
  // --- the arcade: the opening into the aisle (dark, with the aisle's window and its sill).
  const ax0 = x0 + pw / 2 + 1;
  const aw = B - pw - 2;
  archPointed(p, ax0, apex, aw, floor - apex, (X, Y) => {
    const ly = (Y + 0.5) / d;
    return dp(st, 0.7 + Math.max(0, (ly - 120) / 60) * 0.8, X, Y, 0.8);
  });
  // The aisle's outer wall: a tall lancet window and its splay.
  const wx = x0 + B / 2 - 9;
  p.rect(wx - 3, 96, 24, 66, pick(st, 1.6));
  lancet(p, wx, 98, 18, 60, seed + 3, 0.45);
  p.rect(wx - 4, 160, 26, 2, pick(st, 2.6));
  // Tiny Stations of the Cross either side of the window (dark frames, a pale panel).
  for (const sx of [wx - 22, wx + 30]) {
    p.rect(sx, 128, 8, 10, pick(ct('wood', d, air), 1.2));
    p.rect(sx + 1.5, 130, 5, 6, pick(st, 4.2));
    if (d >= 2) p.rect(sx + 3.5, 125, 1, 3, pick(ct('wood', d, air), 1.4));
  }
  // The arch's moulded orders (a lit inner edge).
  if (d >= 2) {
    archPointed(p, ax0, apex, 1.2, floor - apex, pick(st, 4));
  }
  // --- the pillar between the bays (slim, round, lit from the left) and its capital.
  shaft(p, x0 - pw / 2, 42, pw, floor - 42, { k: 4, seed: seed + 11, bh: 6, air });
  p.rect(x0 - pw / 2 - 2, spring - 4, pw + 4, 3, pick(st, 4.6));
  p.rect(x0 - pw / 2 - 1.5, spring - 1, pw + 3, 2, pick(st, 2.6));
  p.rect(x0 - pw / 2 - 2, floor - 6, pw + 4, 6, pick(st, 3));
  p.rect(x0 - pw / 2 - 2, floor - 6, pw + 4, 1, pick(st, 4.4));
  // The far floor line (the pews in the far aisle are lost in the dark).
  p.rect(x0, floor, B, p.h - floor, pick(st, 0.8));
}

// ============================================================================================
// The near pillar (decor; anchor: the floor at its centre)
// ============================================================================================

export const PILLAR_W = 40;
export const PILLAR_H = 176;
/** The capital's top (the vault shaft rises above it). */
export const PILLAR_CAP_Y = 36;

regC('decor/oz-nave/pillar', [{ w: PILLAR_W, h: PILLAR_H, ox: PILLAR_W / 2, oy: PILLAR_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d);
  const c = PILLAR_W / 2;
  // The vault shaft rising out of view (one attached shaft in front, a ring at y 14).
  shaft(p, c - 4, 0, 8, PILLAR_CAP_Y - 6, { k: 3.6, seed: 4, bh: 9 });
  p.rect(c - 5, 14, 10, 2, pick(st, 4.4));
  if (d >= 2) p.rect(c - 5, 16, 10, 0.5, pick(st, 1.4));
  // The abacus and the carved leaf capital (a bell with curling leaves at its corners).
  p.rect(c - 17, PILLAR_CAP_Y - 6, 34, 3, pick(st, 4.6));
  if (d >= 2) p.rect(c - 17, PILLAR_CAP_Y - 6, 34, 0.5, pick(st, 6));
  p.rect(c - 17, PILLAR_CAP_Y - 3, 34, 1, pick(st, 2));
  p.poly(
    [
      [c - 15, PILLAR_CAP_Y - 2],
      [c + 15, PILLAR_CAP_Y - 2],
      [c + 11, PILLAR_CAP_Y + 8],
      [c - 11, PILLAR_CAP_Y + 8],
    ],
    (X, Y) => {
      const u = ((X + 0.5) / d - (c - 15)) / 30;
      const v = ((Y + 0.5) / d - (PILLAR_CAP_Y - 2)) / 10;
      let k = 3.4 + Math.cos((u - 0.32) * Math.PI) * 1.4 - v * 0.6;
      // Leaves: lobes in two rows.
      if (d >= 2) {
        const lobe = Math.sin(u * Math.PI * 7) * Math.sin(v * Math.PI * 2 + 0.6);
        k += lobe * 0.9;
      }
      return dp(st, k, X, Y, 0.8);
    },
  );
  // Corner crockets (curled leaves).
  for (const s of [-1, 1]) p.disc(c + s * 14, PILLAR_CAP_Y - 1, 2.4, 2, (_X, _Y, u, v) => pick(st, 4.6 - v * 1.2 - u * s * 0.6));
  // The necking ring.
  p.rect(c - 11, PILLAR_CAP_Y + 8, 22, 2, pick(st, 4));
  if (d >= 2) p.rect(c - 11, PILLAR_CAP_Y + 9.5, 22, 0.5, pick(st, 1.4));
  // The pier: two attached shafts (darker, behind) and the round drum.
  const top = PILLAR_CAP_Y + 10;
  const base = PILLAR_H - 16;
  shaft(p, c - 14, top, 6, base - top, { k: 3, seed: 7, bh: 7, warmLow: 0.6 });
  shaft(p, c + 8, top, 6, base - top, { k: 2.4, seed: 8, bh: 7, warmLow: 0.4 });
  shaft(p, c - 10, top, 20, base - top, { k: 4.2, seed: 9, bh: 7, warmLow: 0.8 });
  // Soot from centuries of candles, darker low on the shaft's right.
  if (d >= 2) p.tint(c - 14, base - 40, 28, 40, (X, Y, old) => (h2(X >> 1, Y >> 2, 3) > 0.7 ? mx(old, T('ink', 1, d), 0.25, d) : 0));
  // The base: torus mouldings and the square plinth.
  p.rect(c - 15, base, 30, 2, pick(st, 4.4));
  p.disc(c, base + 3, 15, 1.8, (_X, _Y, u, v) => pick(st, 4.2 - v * 1.6 - u * 0.6));
  p.fill(c - 17, base + 5, 34, PILLAR_H - base - 5, ashlar(p, { k: 3.4, seed: 12, bw: 34, bh: 6, x0: c - 17, y0: base + 5, grime: 0.4 }));
  p.rect(c - 17, base + 5, 34, d === 1 ? 1 : 0.5, pick(st, 5));
  dustOn(p, c - 17, base + 5, 34, 1, 0.5, 21);
  cobweb(p, c + 17, PILLAR_CAP_Y - 3, 7, 1, 5);
  outlineC(p);
});

// ============================================================================================
// The west end (decor; anchor bottom-left at x 0): the doorway, the organ gallery and the organ
// ============================================================================================

export const WEST_W = 208;
export const WEST_H = 176;
/** The doorway (local px): the opening's left x, width, the apex y (the opening reaches the floor). */
export const WEST_DOOR = { x: 32, w: 40, apex: 102 } as const;
/** The gallery's balustrade top and the gallery floor's underside. */
const GAL_TOP = 74;
const GAL_BOT = 94;

regC('decor/oz-nave/west', [{ w: WEST_W, h: WEST_H, ox: 0, oy: WEST_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d);
  const H = WEST_H;
  // The wall (ashlar), shaded under the gallery.
  p.fill(0, 0, WEST_W, H, ashlar(p, { k: 3.2, seed: 31, bw: 14, bh: 6, grime: 0.45, grad: -0.004 }));
  p.tint(0, GAL_BOT, WEST_W, 22, (X, Y, old) => {
    const t = 1 - ((Y + 0.5) / d - GAL_BOT) / 22;
    return h2(X, Y, 7) < t * 0.9 ? mx(old, T('ink', 0, d), 0.35 * t, d) : 0;
  });
  // The doorway: three receding moulded orders, the deep reveal, the opening (dark; the doors draw over it).
  const { x: dx, w: dw, apex } = WEST_DOOR;
  for (let o = 3; o >= 1; o--) {
    const e = o * 4;
    archPointed(p, dx - e, apex - e * 1.2, dw + 2 * e, H - apex + e * 1.2, (X, Y) => {
      const lx = (X + 0.5) / d - (dx - e);
      const ring = lx < 2 || lx > dw + 2 * e - 2;
      return dp(st, (o % 2 ? 4.2 : 2.6) + (ring ? 0.6 : 0) - (lx > (dw + 2 * e) / 2 ? 0.8 : 0), X, Y, 0.7);
    });
  }
  archPointed(p, dx, apex, dw, H - apex, pick(st, 0.4));
  // Hood moulding over the door and two small head stops.
  if (d >= 2) archPointed(p, dx - 13, apex - 17, 1.5, 4, pick(st, 5));
  // --- the gallery: its floor beam on stone corbels, the oak balustrade with blind tracery.
  for (let x = 10; x < WEST_W; x += 40) {
    p.poly([[x, GAL_BOT], [x + 8, GAL_BOT], [x + 6, GAL_BOT + 6], [x + 2, GAL_BOT + 6]], pick(st, 3.6));
  }
  oakBox(p, 0, GAL_BOT - 5, WEST_W, 5, 2.2, 3);
  oakBox(p, 0, GAL_TOP, WEST_W, GAL_BOT - 5 - GAL_TOP, 1.6, 4);
  const wd = ct('wood', d);
  for (let x = 4; x + 14 <= WEST_W; x += 17) {
    archPointed(p, x + 1, GAL_TOP + 3, 13, GAL_BOT - 9 - GAL_TOP, pick(wd, 0.6));
    if (d >= 2) {
      archPointed(p, x + 1, GAL_TOP + 3, 0.6, GAL_BOT - 9 - GAL_TOP, pick(wd, 3.2));
      p.disc(x + 7.5, GAL_TOP + 8, 2.4, 2.4, (_X, _Y, u, v) => (u * u + v * v > 0.5 ? pick(wd, 2.8) : 0));
    }
  }
  // The gilt top rail.
  const br = brassT(d);
  p.rect(0, GAL_TOP - 2, WEST_W, 2, pick(br, 2.4));
  if (d >= 2) p.rect(0, GAL_TOP - 2, WEST_W, 0.5, pick(br, 4.2));
  // The wall's end toward the nave: a moulded respond (a half pillar) in the light of the nave.
  shaft(p, WEST_W - 10, 0, 10, H - 8, { k: 3.8, seed: 35, bh: 7, warmLow: 0.4 });
  p.rect(WEST_W - 12, H - 8, 12, 8, pick(st, 3.2));
  p.rect(WEST_W - 12, H - 8, 12, d === 1 ? 1 : 0.5, pick(st, 4.8));
  // --- the organ case: towers and flats of pipes in dark oak with gilt pipe shades.
  organ(p);
  dustOn(p, 0, GAL_TOP - 2, WEST_W, 1, 0.6, 33);
  cobweb(p, WEST_W - 1, GAL_BOT + 1, 9, -1, 2);
  cobweb(p, 1, GAL_BOT + 1, 7, 1, 4);
});

/** The organ (local px): towers [x, w, top y, shape]. */
const ORGAN_TOWERS: ReadonlyArray<readonly [number, number, number, 'point' | 'round' | 'flat']> = [
  [14, 26, 10, 'round'],
  [40, 40, 22, 'flat'],
  [80, 46, 2, 'point'],
  [126, 40, 22, 'flat'],
  [166, 26, 10, 'round'],
];

function organ(p: Pen): void {
  const d = p.d;
  const wd = ct('wood', d);
  const br = brassT(d);
  const tin = ct('steel', d, 0.22);
  const impost = GAL_TOP - 12;
  // The case's lower part (the impost) behind the balustrade.
  oakBox(p, 10, impost, WEST_W - 20, GAL_TOP - 2 - impost, 1.2, 8);
  for (const [tx, tw, top, shape] of ORGAN_TOWERS) {
    // The tower's back (dark) and its frame.
    p.rect(tx, top + 4, tw, impost - top - 4, pick(wd, 0.4));
    // The pipes: a row of cylinders, longest in the middle (round / point) or rising (flat).
    const n = Math.max(3, Math.round(tw / 4.4));
    const pw = tw / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const lenK = shape === 'flat' ? 0.55 + 0.4 * Math.abs(u - 0.5) * 2 : 1 - Math.abs(u - 0.5) * 0.9;
      const pt = top + 8 + (1 - lenK) * 24;
      const px = tx + i * pw + 0.4;
      const mouth = impost - 9;
      p.fill(px, pt, pw - 0.8, mouth - pt, (X, Y) => {
        const v = ((X + 0.5) / d - px) / (pw - 0.8);
        return dp(tin, 3.2 + Math.cos((v - 0.3) * Math.PI) * 1.8 - (h2(i, Math.floor(Y / (4 * d)), tx) > 0.85 ? 0.8 : 0), X, Y, 0.6);
      });
      // The mouth (a dark lip with a lit upper edge) and the tapering foot.
      p.rect(px + 0.4, mouth - 3, pw - 1.6, 2, pick(tin, 0.6));
      if (d >= 2) p.rect(px + 0.4, mouth - 3, pw - 1.6, 0.5, pick(tin, 4.4));
      p.poly(
        [
          [px, mouth],
          [px + pw - 0.8, mouth],
          [px + (pw - 0.8) / 2 + 0.4, impost],
          [px + (pw - 0.8) / 2 - 0.4, impost],
        ],
        pick(tin, 2.2),
      );
    }
    // The tower's frame and its top: gilt shades over the pipes, the crest.
    p.rect(tx - 1, top + 4, 1.5, impost - top - 4, pick(wd, 2.4));
    p.rect(tx + tw - 0.5, top + 4, 1.5, impost - top - 4, pick(wd, 1));
    if (shape === 'point') {
      p.poly([[tx - 1, top + 8], [tx + tw / 2, top - 2], [tx + tw + 1, top + 8]], pick(wd, 2));
      p.poly([[tx + 3, top + 8], [tx + tw / 2, top + 1], [tx + tw - 3, top + 8]], pick(br, 2.2));
      p.rect(tx + tw / 2 - 0.6, top - 6, 1.2, 5, pick(br, 3.6));
      p.rect(tx + tw / 2 - 2, top - 4.5, 4, 1.2, pick(br, 3.6));
    } else if (shape === 'round') {
      p.disc(tx + tw / 2, top + 6, tw / 2 + 1, 5, (_X, _Y, _u, v) => (v < 0.2 ? pick(wd, 2.2) : 0));
      p.rect(tx + 2, top + 6, tw - 4, 3, pick(br, 2));
    } else {
      p.rect(tx - 1, top + 2, tw + 2, 3, pick(wd, 2.4));
      p.rect(tx + 1, top + 5, tw - 2, 3, pick(br, 1.8));
    }
    // Gilt fretwork shades (a row of small arches over the pipes).
    if (d >= 2) for (let x = tx + 1; x < tx + tw - 2; x += 4) archRound(p, x, top + 6, 3, 3, pick(br, 3));
  }
  // Dust and a cobweb between the towers.
  cobweb(p, 80, 22, 8, -1, 9);
  cobweb(p, 126, 22, 8, 1, 10);
}

// ============================================================================================
// The apse (decor; anchor bottom-left at CHOIR_X): the east end behind the altar
// ============================================================================================

export const APSE_W = 320;
export const APSE_H = 176;
/** The predella's top step (local y, measured from the sprite top) where the altar stands. */
export const APSE_PREDELLA_TOP = APSE_H - 16;
/** The crypt doorway (local): centre x and its width. */
export const APSE_CRYPT_X = 278;
export const APSE_CRYPT_W = 32;

regC('decor/oz-nave/apse', [{ w: APSE_W, h: APSE_H, ox: 0, oy: APSE_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d);
  const H = APSE_H;
  // The apse wall (darker, deeper than the nave), the three tall lancets.
  p.fill(14, 0, APSE_W - 28, H, ashlar(p, { k: 2.6, seed: 51, bw: 13, bh: 6, grime: 0.4, grad: 0.004 }));
  for (const [lx, n] of [
    [104, 0],
    [148, 1],
    [192, 2],
  ] as const) {
    // The splayed reveal, then the glass (the brightest windows: the moon is on this side).
    archPointed(p, lx - 4, 14, 32, 108, (X, Y) => dp(st, 1.6 + ((X + 0.5) / d - lx + 4 < 6 ? 1.2 : 0), X, Y, 0.7));
    lancet(p, lx, 20, 24, 100, 60 + n * 5, 0.6);
    p.rect(lx - 5, 122, 34, 3, pick(st, 4.2));
    if (d >= 2) p.rect(lx - 5, 122, 34, 0.5, pick(st, 5.6));
  }
  // The dossal behind the altar: dark oak panels under a gilt crest of small arches.
  const br = brassT(d);
  oakBox(p, 104, 128, 112, 32, 1.2, 52, { vertical: true });
  const wd = ct('wood', d);
  for (let x = 108; x < 212; x += 13) {
    archPointed(p, x, 132, 9, 24, pick(wd, 0.5));
    if (d >= 2) archPointed(p, x, 132, 0.5, 24, pick(wd, 2.6));
  }
  p.rect(102, 126, 116, 2, pick(br, 2.6));
  for (let x = 104; x < 216; x += 6) p.poly([[x, 126], [x + 3, 122.5], [x + 6, 126]], pick(br, 2.2));
  // The predella: three steps of sandstone across the middle of the choir.
  for (let s = 0; s < 3; s++) {
    const y = H - 16 + s * 5;
    const x0 = 90 - s * 10;
    const w = 140 + s * 20;
    p.fill(x0, y, w, 5, ashlar(p, { k: 3.6 - s * 0.3, seed: 55 + s, bw: 20, bh: 5, x0, y0: y, grime: 0.2 }));
    p.rect(x0, y, w, d === 1 ? 1 : 0.75, pick(st, 5.4));
    dustOn(p, x0, y, w, 1.5, 0.55, 57 + s);
  }
  // Choir stalls on the left: dark oak seats under a row of small pointed canopies.
  oakBox(p, 22, 140, 66, 36, 1.4, 61);
  for (let x = 24; x < 86; x += 12) {
    archPointed(p, x, 126, 10, 14, pick(wd, 2));
    if (d >= 2) archPointed(p, x + 1.5, 128, 7, 12, pick(wd, 0.6));
    p.rect(x + 1, 152, 8, 2, pick(wd, 2.8));
  }
  p.rect(22, 124, 66, 2, pick(wd, 2.6));
  // --- the chancel arch: moulded orders on both sides, springing at y 58 and rising out of view.
  for (const side of [0, 1] as const) {
    const x0 = side === 0 ? 0 : APSE_W - 14;
    p.fill(x0, 0, 14, H, (X, Y) => {
      const lx = (X + 0.5) / d - x0;
      const ring = Math.floor(lx / 3.5);
      return dp(st, 3.8 - (ring % 2) * 1.2 + (side === 0 ? 0.3 : -0.6) + (Y / d > 150 ? -0.5 : 0), X, Y, 0.7);
    });
    // Capitals of the chancel arch.
    p.rect(x0 - 2, 56, 18, 3, pick(st, 4.8));
    p.rect(x0, 59, 14, 4, pick(st, 3.4));
  }
  // The arch's curve at the top (the inner order of a big pointed arch, seen in part).
  p.fill(14, 0, APSE_W - 28, 12, (X, Y) => {
    const lx = (X + 0.5) / d - APSE_W / 2;
    const ly = (Y + 0.5) / d;
    const curve = 12 - (lx * lx) / 2600;
    return ly < curve ? dp(st, 3.2 - (Math.abs(lx) > 120 ? 0.6 : 0), X, Y, 0.7) : 0;
  });
  // --- the crypt doorway: a round-arched opening, the stair going down into the dark.
  cryptDoor(p);
  cobweb(p, 14, 63, 9, 1, 12);
  cobweb(p, APSE_W - 14, 63, 9, -1, 13);
  outlineC(p);
});

function cryptDoor(p: Pen): void {
  const d = p.d;
  const st = ct('sandstone', d);
  const cx = APSE_CRYPT_X;
  const w = APSE_CRYPT_W;
  const top = 118;
  const H = APSE_H;
  // The surround (a plain moulded round arch).
  archRound(p, cx - w / 2 - 4, top - 4, w + 8, H - top + 4, (X, Y) => dp(st, 4 - ((X + 0.5) / d > cx ? 1 : 0) + (h2(X >> 1, Y >> 1, 3) - 0.5) * 0.4, X, Y, 0.7));
  // The dark stairwell, the steps going down (their lit nosings fading into the dark).
  archRound(p, cx - w / 2, top, w, H - top, (X, Y) => dp(st, 0.25 + Math.max(0, ((Y + 0.5) / d - top - 20) / 40) * 0.6, X, Y, 0.8));
  for (let s = 0; s < 5; s++) {
    const y = H - 22 + s * 4.4;
    const inset = 2 + s * 0.6;
    p.rect(cx - w / 2 + inset, y, w - 2 * inset, 1, pick(st, 3.4 - s * 0.55));
    if (d >= 2) p.rect(cx - w / 2 + inset, y + 1, w - 2 * inset, 0.5, pick(st, 0.4));
  }
  // An iron handrail going down along the left wall.
  const ir = ironT(d);
  p.line(cx - w / 2 + 3, H - 34, cx + w / 2 - 6, H - 8, pick(ir, 4), Math.max(1, d >> 1));
  for (const t of [0.15, 0.6]) {
    const x = cx - w / 2 + 3 + t * (w - 9);
    const y = H - 34 + t * 26;
    p.rect(x, y, d === 1 ? 1 : 0.5, 10, pick(ir, 3));
  }
}

// ============================================================================================
// The side chapel of the dead (decor; anchor bottom-centre); its grille is the `oz-chapel-gate` entity
// ============================================================================================

export const CHAPEL_W = 152;
export const CHAPEL_H = 136;
/** The grille's height and width (the entity's art covers the opening's lower part). */
export const GRILLE_W = 124;
export const GRILLE_H = 76;

regC('decor/oz-nave/chapel', [{ w: CHAPEL_W, h: CHAPEL_H, ox: CHAPEL_W / 2, oy: CHAPEL_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d);
  const H = CHAPEL_H;
  const c = CHAPEL_W / 2;
  // The moulded pointed arch of the opening (three orders) on its jamb shafts.
  for (let o = 0; o < 3; o++) {
    const inset = o * 5;
    archPointed(p, 4 + inset, 2 + inset * 1.2, CHAPEL_W - 8 - 2 * inset, H - 2 - inset * 1.2, (X, Y) => dp(st, (o % 2 ? 2.6 : 4.4) - ((X + 0.5) / d > c ? 0.7 : 0) + (h2(X >> 2, Y >> 2, o) - 0.5) * 0.4, X, Y, 0.7));
  }
  // The chapel inside: its back wall (dark ashlar), a small high lancet, memorial tablets.
  const inX = 20;
  const inW = CHAPEL_W - 40;
  archPointed(p, inX, 18, inW, H - 18, ashlar(p, { k: 1.8, seed: 71, bw: 12, bh: 6, x0: inX, y0: 18, grime: 0.5, air: 0.24 }));
  lancet(p, c - 6, 34, 12, 34, 72, 0.3);
  const slate = ct('slate', d, 0.1);
  for (const [tx, ty, tw, th] of [
    [inX + 6, 52, 18, 13],
    [inX + inW - 24, 50, 18, 15],
  ] as const) {
    p.rect(tx - 1, ty - 1, tw + 2, th + 2, pick(st, 4.4));
    p.rect(tx, ty, tw, th, pick(slate, 2));
    if (d >= 2) {
      // Incised lines (an illegible epitaph) and a small cross.
      for (let k = 0; k < 4; k++) p.rect(tx + 3, ty + 5 + k * 2.2, tw - 6 - (k % 2) * 3, 0.5, pick(slate, 4));
      p.rect(tx + tw / 2 - 0.25, ty + 1, 0.5, 3, pick(slate, 4.6));
      p.rect(tx + tw / 2 - 1.25, ty + 2, 2.5, 0.5, pick(slate, 4.6));
    }
  }
  // The small altar: a stone table with a plain dark cross on it, and a tomb chest on the left.
  const ax = c - 16;
  const ay = H - 26;
  p.fill(ax, ay, 32, 26, ashlar(p, { k: 3.2, seed: 75, bw: 16, bh: 7, x0: ax, y0: ay, grime: 0.2 }));
  p.rect(ax - 2, ay - 3, 36, 3, pick(st, 4.6));
  if (d >= 2) p.rect(ax - 2, ay - 3, 36, 0.5, pick(st, 6));
  const ir = ironT(d);
  p.rect(c - 1, ay - 21, 2, 18, pick(ir, 2.6));
  p.rect(c - 5, ay - 16, 10, 2, pick(ir, 2.6));
  if (d >= 2) {
    p.rect(c - 1, ay - 21, 0.5, 18, pick(ir, 4.6));
    p.rect(c - 5, ay - 16, 10, 0.5, pick(ir, 4.6));
  }
  // The tomb chest with a carved cross (the founder's tomb), quatrefoils on its front.
  const tx = inX + 4;
  const ty = H - 22;
  p.fill(tx, ty, 30, 22, ashlar(p, { k: 2.8, seed: 77, bw: 30, bh: 22, x0: tx, y0: ty, grime: 0.3, joints: false }));
  p.rect(tx - 1, ty - 3, 32, 3, pick(st, 4.2));
  for (const qx of [tx + 7, tx + 22]) p.disc(qx, ty + 10, 4, 4, (_X, _Y, u, v) => (Math.abs(u) < 0.3 || Math.abs(v) < 0.3 ? pick(st, 1.4) : u * u + v * v > 0.8 ? pick(st, 3.8) : 0));
  // A single red votive glass on the altar's step (the only colour in the chapel).
  p.rect(c + 10, H - 4, 3, 3, pick(ct('red', d, 0.1), 3));
  // Dust everywhere, cobwebs in the arch.
  dustOn(p, ax - 2, ay - 3, 36, 1, 0.6, 79);
  cobweb(p, inX + 2, 40, 9, 1, 81);
  cobweb(p, inX + inW - 2, 44, 8, -1, 82);
  outlineC(p);
});
