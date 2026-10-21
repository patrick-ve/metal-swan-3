/**
 * The crypt and the openings (CHURCH, wave B; docs/design/oldenzaal.md §7.2): our own drawing of
 * a low Romanesque crypt under the choir (squat columns, cushion capitals, round groin vaults,
 * rough stone, wall niches with old coffins, tombs, iron gates). ONE drawer per id for 1×, 2×, 4×.
 *
 * - `oz-crypt-far` (background generator, tiles in x): the back wall: a low arcade of slim
 *   columns, rows of wall niches (loculi) with coffin ends and sealed plates, the vault above.
 * - `decor/oz-crypt/vault`: a near bay: the squat column with its cushion capital and the round
 *   arches springing from it to the next columns (the bays join seamlessly every 160 px).
 * - `decor/oz-crypt/coffin` (on trestles / upright), `candles` (3 flicker frames), `lantern`
 *   (3 frames, hanging), `stair-down` (from the nave), `stair-up` (to the tower door), `gate`
 *   (the iron gate across the crypt: 3 frames, shut → open; the `oz-crypt-gate` entity).
 * - The openings' art (entities): `prop/oz-tomb/tomb` (4 frames: closed, the lid grinding twice,
 *   open with the lid slid off) and `prop/oz-slab/slab` (4 frames: whole, cracked, cracking with
 *   chips, broken open).
 */
import type { Color } from '../../../../engine/color';
import { archRound, ashlar, brassT, cobweb, ct, dp, dustOn, flame, h2, ironT, mx, num, outlineC, pick, regC, regCBg, same, shaft, T, type Pen } from './kit';

// ============================================================================================
// The back wall of the crypt (background, factorX ≈ 0.6)
// ============================================================================================

export const CRYPT_FAR_BAY = 96;

regCBg('oz-crypt-far', (p, params, seed) => {
  const d = p.d;
  const air = num(params, 'air', 0.3);
  const st = ct('sandstone', d, air);
  const W = p.w;
  // Rough rubble stone everywhere (the vault's webs above, the wall below), dark and damp.
  p.fill(0, 0, W, p.h, rubble(p, 1.6, seed, air));
  const bays = Math.max(1, Math.round(W / CRYPT_FAR_BAY));
  for (let b = 0; b < bays; b++) {
    const x0 = b * CRYPT_FAR_BAY;
    const B = CRYPT_FAR_BAY;
    // The arch into the back aisle: its round head at y 62, the wall with niches inside.
    archRound(p, x0 + 7, 66, B - 14, 108, rubble(p, 1.1, seed + b, air));
    // The arch's voussoirs (a lit ring).
    p.disc(x0 + B / 2, 66 + (B - 14) / 2, (B - 14) / 2 + 3, (B - 14) / 2 + 3, (X, Y, u, v) => {
      if (v > 0) return 0;
      const q = Math.sqrt(u * u + v * v);
      if (q < (B - 14) / (B - 8)) return 0;
      const n = Math.floor((Math.atan2(v, u) + Math.PI) * 6);
      return dp(st, 3.2 - (n % 2) * 0.5 + (u < 0 ? 0.4 : -0.6), X, Y, 0.6);
    });
    // The loculi: two rows of three niches; old coffins lie in some (their ends toward us), others
    // are sealed with a stone plate and a small incised cross.
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 3; i++) {
        const nx = x0 + 16 + i * 22;
        const ny = 118 + r * 22;
        const hh = h2(b * 6 + i, r, seed + 5);
        archRound(p, nx - 1, ny - 1, 18, 16, pick(st, 0.4));
        if (hh > 0.45) {
          // A coffin's end: dark wood, a brass plate.
          p.rect(nx + 1, ny + 4, 14, 10, pick(ct('wood', d, air), 1 + hh));
          if (d >= 2) p.rect(nx + 6, ny + 7, 4, 2, pick(brassT(d), 1.4));
        } else {
          p.rect(nx, ny + 2, 16, 13, pick(st, 2.6 + hh));
          if (d >= 2) {
            p.rect(nx + 7.75, ny + 5, 0.5, 6, pick(st, 1));
            p.rect(nx + 6, ny + 6.5, 4, 0.5, pick(st, 1));
          }
        }
      }
    }
    // The slim column between the far bays.
    shaft(p, x0 - 4, 70, 8, 104, { k: 3, seed: seed + b * 3, bh: 7, air });
    p.rect(x0 - 6, 64, 12, 6, pick(st, 3.6));
    p.rect(x0 - 6, 170, 12, 4, pick(st, 2.8));
  }
  // The floor line.
  p.rect(0, 174, W, p.h - 174, pick(st, 0.6));
});

/** Rough rubble stone (irregular small stones, wide dark joints), tone k. */
function rubble(p: Pen, k: number, seed: number, air = 0.16): (X: number, Y: number) => Color {
  const d = p.d;
  const st = ct('sandstone', d, air);
  return (X: number, Y: number): Color => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const row = Math.floor(y / 5);
    const sh = h2(row, 7, seed) * 9;
    const col = Math.floor((x + sh) / (7 + (h2(row, 8, seed) * 4 | 0)));
    const fy = y - row * 5;
    const fx = ((x + sh) % 7) / 7;
    let kk = k + (h2(col, row, seed) - 0.5) * 1.2;
    if (d >= 2 && (fy < 0.6 || fx < 0.08)) kk -= 1.2;
    else if (d >= 2 && fy < 1.3) kk += 0.4;
    if (d === 1 && (fy < 1 || fx < 0.12)) kk -= 1;
    if (d >= 4 && h2(X, Y, seed + 3) > 0.92) kk -= 0.6;
    // Damp: darker patches low on the wall.
    if (h2(Math.floor(x / 9), Math.floor(y / 7), seed + 9) > 0.86) kk -= 0.6;
    return dp(st, kk, X, Y, 0.7);
  };
}

// ============================================================================================
// A near bay of the crypt (decor; anchor bottom-centre at the column)
// ============================================================================================

export const VAULT_W = 160;
export const VAULT_H = 176;
const ABACUS_Y = 100;
const ARCH_R = 64;

regC('decor/oz-crypt/vault', [{ w: VAULT_W, h: VAULT_H, ox: VAULT_W / 2, oy: VAULT_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d, 0.2);
  const c = VAULT_W / 2;
  const rub = rubble(p, 2.2, 211, 0.2);
  // The vault webs and the arches: a round arch from this column to each neighbour (centred on
  // the bay edges x 0 and x 160), voussoirs 9 px deep, solid masonry above.
  p.fill(0, 0, VAULT_W, ABACUS_Y, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const ex = x < c ? 0 : VAULT_W;
    const dx = x - ex;
    const dy = y - ABACUS_Y;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < ARCH_R && y < ABACUS_Y) return 0;
    if (r < ARCH_R + 9) {
      // Voussoirs: wedge stones along the curve, the intrados' lit edge.
      const a = Math.atan2(-dy, dx * (x < c ? 1 : -1));
      const n = Math.floor(a * 9);
      let k = 3.4 + (h2(n, x < c ? 1 : 2, 213) - 0.5) * 0.8 - (r - ARCH_R) * 0.06;
      if (d >= 2 && Math.abs(a * 9 - Math.round(a * 9)) < 0.05 * (4 / d)) k -= 1.4;
      if (r < ARCH_R + 1) k += 0.9;
      return dp(st, k, X, Y, 0.6);
    }
    // The web of the groin vault: rubble, darker toward the crown.
    return mx(rub(X, Y), T('ink', 0, d), Math.max(0, 0.45 - y / 220), d);
  });
  // The abacus, the cushion capital (a cube rounded off below, flat lunettes on its face).
  p.rect(c - 16, ABACUS_Y, 32, 4, pick(st, 4.4));
  if (d >= 2) p.rect(c - 16, ABACUS_Y, 32, 0.5, pick(st, 5.8));
  p.rect(c - 16, ABACUS_Y + 3.5, 32, 0.5, pick(st, 1.6));
  p.fill(c - 14, ABACUS_Y + 4, 28, 12, (X, Y) => {
    const u = ((X + 0.5) / d - (c - 14)) / 28;
    const v = ((Y + 0.5) / d - ABACUS_Y - 4) / 12;
    const round = Math.abs(u - 0.5) * 2;
    if (v > 0.35 && round > 1 - (v - 0.35) * 1.4) return 0;
    const lunette = d >= 2 && Math.abs(Math.sqrt((u - 0.5) * (u - 0.5) * 4 + v * v) - 0.6) < 0.05 && v < 0.6;
    return dp(st, 4 + Math.cos((u - 0.3) * Math.PI) * 1.1 - v * 1.2 - (lunette ? 1 : 0), X, Y, 0.6);
  });
  // The squat shaft and its base (a torus on a square plinth).
  shaft(p, c - 8, ABACUS_Y + 14, 16, VAULT_H - ABACUS_Y - 24, { k: 3.6, seed: 215, bh: 8, air: 0.2, warmLow: 0.5 });
  p.disc(c, VAULT_H - 9, 10, 2, (_X, _Y, u, v) => pick(st, 4 - v * 1.4 - u * 0.6));
  p.fill(c - 12, VAULT_H - 7, 24, 7, ashlar(p, { k: 3, seed: 217, bw: 24, bh: 7, x0: c - 12, y0: VAULT_H - 7, grime: 0.5, air: 0.2 }));
  p.rect(c - 12, VAULT_H - 7, 24, d === 1 ? 1 : 0.5, pick(st, 4.6));
  // Damp and soot on the column, cobwebs in the arches' corners.
  if (d >= 2) p.tint(c - 8, ABACUS_Y + 16, 16, 40, (X, Y, old) => (h2(X >> 1, Y >> 3, 219) > 0.75 ? mx(old, T('ink', 1, d), 0.3, d) : 0));
  cobweb(p, c - 15, ABACUS_Y + 1, 9, -1, 221);
  cobweb(p, c + 15, ABACUS_Y + 1, 7, 1, 222);
  outlineC(p);
});

// ============================================================================================
// Coffins, candles, lanterns
// ============================================================================================

regC(
  'decor/oz-crypt/coffin',
  [
    { w: 40, h: 18, ox: 0, oy: 18 },
    { w: 16, h: 44, ox: 8, oy: 44 },
  ],
  (p, f) => {
    const d = p.d;
    const wd = ct('wood', d, 0.22);
    const br = brassT(d);
    if (f === 0) {
      // A coffin on two trestles: its lid (the `oz-pew` rail at the top, G − 14) and the tapered box.
      p.poly([[1, 4], [39, 4], [38, 11], [3, 12]], (X, Y) => dp(wd, 1.6 + (h2(X >> 2, 1, 231) - 0.5) * 0.4 - ((Y + 0.5) / d - 4) * 0.06, X, Y, 0.6));
      p.rect(1, 4, 38, 2, pick(wd, 2.6));
      if (d >= 2) p.rect(1, 6, 38, 0.5, pick(wd, 0.6));
      for (const x of [9, 30]) {
        p.rect(x, 8, 4, 1.4, pick(br, 2));
        if (d >= 2) p.rect(x, 8, 4, 0.5, pick(br, 3.6));
      }
      if (d >= 2) {
        p.rect(19.75, 7, 0.5, 4, pick(br, 2.4));
        p.rect(18.5, 8, 3, 0.5, pick(br, 2.4));
      }
      for (const x of [5, 31]) {
        p.line(x, 12, x - 2, 18, pick(wd, 1.4), Math.max(1, d >> 1));
        p.line(x + 2, 12, x + 4, 18, pick(wd, 1.2), Math.max(1, d >> 1));
        p.rect(x - 1, 14, 6, 1, pick(wd, 1.6));
      }
      dustOn(p, 1, 4, 38, 2, 0.6, 233);
    } else {
      // An old coffin stood upright against the wall, its lid a little warped.
      p.poly([[3, 2], [13, 2], [15, 12], [13, 43], [3, 43], [1, 12]], (X, Y) => dp(wd, 1.8 + (((X + 0.5) / d < 8 ? 0.5 : -0.4)) + (h2(X >> 1, Y >> 3, 235) - 0.5) * 0.4, X, Y, 0.6));
      if (d >= 2) p.poly([[4, 3], [12, 3], [13.6, 12], [12, 42], [4, 42], [2.4, 12]], (X, Y) => (h2(X, Y, 236) > 0.93 ? pick(wd, 0.6) : 0));
      p.rect(7.4, 10, 1.2, 12, pick(br, 2));
      p.rect(5, 13, 6, 1.2, pick(br, 2));
      dustOn(p, 1, 2, 14, 2, 0.6, 237);
    }
    outlineC(p);
  },
);

export const CANDLES_W = 28;
export const CANDLES_H = 22;

regC(
  'decor/oz-crypt/candles',
  same(3, { w: CANDLES_W, h: CANDLES_H, ox: CANDLES_W / 2, oy: CANDLES_H }),
  (p, f) => {
    const d = p.d;
    const wax = ct('cloth', d, 0.2);
    const red = ct('red', d, 0.08);
    // Pillar candles of many heights in their own pooled wax, a few red votive cups among them.
    p.disc(CANDLES_W / 2, CANDLES_H - 1, 13, 2, (_X, _Y, u) => pick(wax, 3 - u * 0.6));
    const sticks: ReadonlyArray<readonly [number, number, number]> = [
      [5, 9, 3],
      [9, 14, 2.4],
      [13, 6, 3.4],
      [17.5, 11, 2.6],
      [22, 7, 3],
    ];
    sticks.forEach(([x, h, w], i) => {
      const top = CANDLES_H - 1 - h;
      p.rect(x - w / 2, top, w, h, (pick(wax, 3.8 - (i % 2) * 0.5)));
      if (d >= 2) {
        p.rect(x - w / 2, top, w * 0.3, h, pick(wax, 4.8));
        p.rect(x + w / 2 - 0.6, top + 1, 0.6, h * 0.6, pick(wax, 4.4));
      }
      flame(p, x, top, 3.4, (f + i) % 4);
    });
    for (const x of [2.5, 25]) {
      p.rect(x - 1.3, CANDLES_H - 4, 2.6, 3, pick(red, 4));
      flame(p, x, CANDLES_H - 4, 2.4, (f + 2) % 4);
    }
    outlineC(p);
  },
  { ticksPerFrame: 7 },
);

export const LANTERN_W = 14;
export const LANTERN_H = 64;

regC(
  'decor/oz-crypt/lantern',
  same(3, { w: LANTERN_W, h: LANTERN_H, ox: LANTERN_W / 2, oy: 0 }),
  (p, f) => {
    const d = p.d;
    const ir = ironT(d);
    const c = LANTERN_W / 2;
    const glassC = ct('candle', d, 0.15);
    for (let y = 0; y < 40; y += 2) p.rect(c - 0.5, y, 1, 1.4, pick(ir, y % 4 === 0 ? 3.2 : 2));
    // The cap, the four panes with their frame, the base.
    p.poly([[c - 5, 46], [c, 40], [c + 5, 46]], pick(ir, 2.6));
    p.rect(c - 5, 46, 10, 1.4, pick(ir, 3));
    p.fill(c - 4, 47.4, 8, 10, (X, Y) => {
      const u = ((X + 0.5) / d - (c - 4)) / 8;
      const v = ((Y + 0.5) / d - 47.4) / 10;
      return dp(glassC, 3.4 + (1 - Math.abs(u - 0.5) * 2) * 1.6 - Math.abs(v - 0.6) + [0, 0.5, -0.3][f], X, Y, 0.6);
    });
    for (const x of [c - 4.5, c - 0.5, c + 3.5]) p.rect(x, 47.4, 1, 10, pick(ir, 2.2));
    flame(p, c + 1.5, 55, 3, f);
    p.rect(c - 5, 57.4, 10, 2, pick(ir, 2.8));
    p.rect(c - 2, 59.4, 4, 2, pick(ir, 2));
    outlineC(p);
  },
  { ticksPerFrame: 8 },
);

// ============================================================================================
// The stairs: down from the nave (the crypt's start), up to the tower door (its end)
// ============================================================================================

export const STAIR_W = 112;
export const STAIR_H = 176;

regC('decor/oz-crypt/stair-down', [{ w: STAIR_W, h: STAIR_H, ox: 0, oy: STAIR_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d, 0.2);
  // The stairwell's wall (rubble) under a low sloping vault; the steps come down from the upper
  // left (the nave) to the crypt floor at x ≈ 96.
  const steps = 11;
  const tread = 8.6;
  const rise = 9.4;
  const yTop = STAIR_H - steps * rise;
  p.fill(0, 0, STAIR_W, STAIR_H, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const stairY = yTop + (x / tread) * rise;
    // The vault's soffit follows the stair 54 px above it; above that, solid rock (out of reach).
    if (y < stairY - 58) return dp(st, 0.9 - y * 0.002, X, Y, 0.6);
    return rubble(p, 1.8 + (y - (stairY - 58)) * 0.01, 241, 0.2)(X, Y);
  });
  // The soffit's edge (a lit arris along the slope).
  p.line(0, yTop - 58, steps * tread, STAIR_H - 58, pick(st, 3.4), Math.max(1, d >> 1));
  // At the top the glow of the nave's candles above (warm, faint).
  p.fill(0, yTop - 54, 18, 54, (X, Y) => (h2(X, Y, 243) > 0.55 ? pick(ct('candle', d, 0.5), 1.6) : 0));
  // The steps: each a block with a lit nosing, worn hollow in the middle.
  for (let i = 0; i < steps; i++) {
    const x = i * tread;
    const y = yTop + i * rise;
    p.fill(x, y, tread + 0.5, STAIR_H - y, ashlar(p, { k: 2.8 - i * 0.05, seed: 245 + i, bw: tread + 1, bh: rise, x0: x, y0: y, grime: 0.3, air: 0.2 }));
    p.rect(x, y, tread + 0.5, d === 1 ? 1 : 1, pick(st, 4.6));
    if (d >= 2) {
      p.rect(x, y, tread + 0.5, 0.5, pick(st, 5.6));
      p.rect(x + tread * 0.3, y + 0.5, tread * 0.4, 0.5, pick(st, 3.4));
    }
  }
  // An iron handrail along the wall, a candle on a step.
  const ir = ironT(d);
  p.line(0, yTop - 22, steps * tread, STAIR_H - 22, pick(ir, 3), Math.max(1, d >> 1));
  for (let i = 1; i < steps; i += 3) p.rect(i * tread, yTop + i * rise - 22, d === 1 ? 1 : 0.5, 22, pick(ir, 2.4));
  cobweb(p, 1, yTop - 57, 10, 1, 247);
  outlineC(p);
});

regC('decor/oz-crypt/stair-up', [{ w: STAIR_W, h: STAIR_H, ox: 0, oy: STAIR_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d, 0.2);
  const wd = ct('wood', d, 0.2);
  const ir = ironT(d);
  const steps = 8;
  const tread = 10;
  const rise = 9;
  const landY = STAIR_H - steps * rise;
  const landX = steps * tread;
  // The narrow passage: rubble walls, a low vault rising with the stair.
  p.fill(0, 0, STAIR_W, STAIR_H, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const stairY = x < landX ? STAIR_H - (x / tread) * rise : landY;
    if (y < stairY - 62) return dp(st, 0.8, X, Y, 0.6);
    return rubble(p, 1.6, 251, 0.2)(X, Y);
  });
  for (let i = 0; i < steps; i++) {
    const x = i * tread;
    const y = STAIR_H - (i + 1) * rise;
    p.fill(x, y, tread + 0.5, STAIR_H - y, ashlar(p, { k: 2.6 + i * 0.08, seed: 253 + i, bw: tread + 1, bh: rise, x0: x, y0: y, grime: 0.3, air: 0.2 }));
    p.rect(x, y, tread + 0.5, 1, pick(st, 4.4));
    if (d >= 2) p.rect(x, y, tread + 0.5, 0.5, pick(st, 5.4));
  }
  // The landing and the tower door: a round-arched oak door with iron straps, a cold line of storm
  // light under it and at its edge (the tower is open to the weather).
  p.fill(landX, landY, STAIR_W - landX, STAIR_H - landY, ashlar(p, { k: 2.8, seed: 259, bw: 16, bh: 9, x0: landX, y0: landY, air: 0.2 }));
  p.rect(landX, landY, STAIR_W - landX, 1, pick(st, 4.6));
  const dx = landX + 6;
  const dw = 22;
  const top = landY - 44;
  archRound(p, dx - 3, top - 3, dw + 6, 47, pick(st, 3.8));
  archRound(p, dx, top, dw, 44, (X, Y) => {
    const x = (X + 0.5) / d - dx;
    const plank = Math.floor(x / 4.4);
    return dp(wd, 1.8 + (h2(plank, 3, 261) - 0.5) * 0.6 - (d >= 2 && x % 4.4 < 0.5 ? 1 : 0), X, Y, 0.6);
  });
  for (const y of [top + 14, top + 34]) p.rect(dx, y, dw, 1.4, pick(ir, 2.6));
  p.disc(dx + dw - 5, top + 24, 1.5, 1.5, (_X, _Y, u, v) => (u * u + v * v > 0.4 ? pick(ir, 3.4) : 0));
  const storm = ct('night', d, 0);
  p.rect(dx, landY - 1, dw, 1, pick(storm, 5.6));
  p.rect(dx + dw - 0.5, top + 8, d === 1 ? 1 : 0.5, 36, pick(storm, 5));
  // A lantern hook by the door and a cobweb at the vault.
  p.rect(dx - 8, top + 4, 4, 1, pick(ir, 2.6));
  cobweb(p, STAIR_W - 1, landY - 61, 9, -1, 263);
  outlineC(p);
});

// ============================================================================================
// The iron gate across the crypt (the `oz-crypt-gate` entity; anchor bottom-centre; 3 frames)
// ============================================================================================

export const GATE_W = 30;
export const GATE_H = 84;

regC(
  'decor/oz-crypt/gate',
  same(3, { w: GATE_W, h: GATE_H, ox: GATE_W / 2, oy: GATE_H }),
  (p, f) => {
    const d = p.d;
    const ir = ironT(d);
    const W = GATE_W;
    const H = GATE_H;
    // The hinge post on the right; the leaf swings toward it (f 0 shut … f 2 open).
    p.rect(W - 3, 0, 3, H, pick(ir, 2));
    if (d >= 2) p.rect(W - 3, 0, 0.75, H, pick(ir, 3.6));
    const lw = [W - 3, (W - 3) * 0.5, 4][f];
    const x0 = W - 3 - lw;
    const n = Math.max(1, Math.round(lw / 3.4));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (i * (lw - 1)) / n;
      p.rect(x, 4, d === 1 ? 1 : 0.85, H - 4, pick(ir, f === 0 ? 2.8 : 2.2));
      if (d >= 2) p.rect(x, 4, 0.25, H - 4, pick(ir, 4.2));
      p.poly([[x - 0.7, 5], [x + 0.4, 1], [x + 1.5, 5]], pick(ir, 3.2));
    }
    for (const y of [12, H / 2, H - 8]) p.rect(x0, y, lw, 1.4, pick(ir, 3));
    if (f === 0) {
      // A heavy chain and a padlock on the latch side.
      for (let y = H / 2 - 6; y < H / 2 + 6; y += 2) p.rect(x0 + 0.5 + ((y / 2) % 2), y, 2, 1.2, pick(ir, 3.6));
      p.rect(x0 - 1, H / 2 + 6, 4, 4, pick(ir, 2.2));
      if (d >= 2) p.rect(x0, H / 2 + 6, 2, 0.5, pick(ir, 4.4));
    }
  },
);

// ============================================================================================
// The openings: the tomb (oz-tomb) and the grave slab (oz-slab)
// ============================================================================================

export const TOMB_W = 56;
export const TOMB_H = 32;

regC(
  'prop/oz-tomb/tomb',
  same(4, { w: TOMB_W, h: TOMB_H, ox: TOMB_W / 2, oy: TOMB_H }),
  (p, f) => {
    const d = p.d;
    const st = ct('sandstone', d, 0.2);
    const H = TOMB_H;
    const chestTop = 11;
    // The chest: quatrefoil panels on its front, a moulded plinth and cornice.
    p.fill(5, chestTop, TOMB_W - 10, H - chestTop - 3, ashlar(p, { k: 3, seed: 271, bw: 46, bh: 22, x0: 5, y0: chestTop, grime: 0.4, joints: false, air: 0.2 }));
    for (let i = 0; i < 3; i++) {
      const qx = 13 + i * 15;
      const qy = chestTop + 8;
      p.rect(qx - 5.5, qy - 5.5, 11, 11, pick(st, 2.2));
      p.disc(qx, qy, 4.6, 4.6, (_X, _Y, u, v) => (Math.abs(u) < 0.4 || Math.abs(v) < 0.4 ? pick(st, 1.2) : u * u + v * v > 0.85 ? pick(st, 3.8) : 0));
      if (d >= 2) p.rect(qx - 5.5, qy - 5.5, 11, 0.5, pick(st, 4.2));
    }
    p.rect(3, H - 3, TOMB_W - 6, 3, pick(st, 2.6));
    if (d >= 2) p.rect(3, H - 3, TOMB_W - 6, 0.5, pick(st, 4.6));
    p.rect(4, chestTop, TOMB_W - 8, 1.6, pick(st, 4.2));
    // The open top (dark) once the lid moves.
    const shift = [0, 1.5, 4.5, 0][f];
    if (f >= 1) {
      p.rect(6, chestTop - 2, f === 3 ? TOMB_W - 12 : shift + 1, 2, T('ink', 0, d));
    }
    if (f < 3) {
      // The lid: its top in slight perspective and its edge, a cross in relief on the top.
      const lx = 3 + shift;
      p.rect(lx, 4, TOMB_W - 6, 4, (pick(st, 4.4)));
      p.rect(lx, 8, TOMB_W - 6, 3, pick(st, 3));
      if (d >= 2) {
        p.rect(lx, 4, TOMB_W - 6, 0.5, pick(st, 5.6));
        p.rect(lx, 10.5, TOMB_W - 6, 0.5, pick(st, 1.4));
      }
      p.rect(lx + TOMB_W / 2 - 13, 5.2, 20, 1.2, pick(st, 5.2));
      p.rect(lx + TOMB_W / 2 - 8, 4.4, 1.6, 3, pick(st, 5.2));
      if (f === 2) for (let i = 0; i < 4; i++) p.rect(4 + i * 1.5, 9 + (i % 2), 0.75, 0.75, T('stone', 3, d));
    } else {
      // The lid slid off: it leans against the chest's right end, the open chest dark inside.
      p.poly([[TOMB_W - 18, H], [TOMB_W - 13, H], [TOMB_W - 1, 6], [TOMB_W - 6, 4]], (X, Y) => dp(st, 3.8 - ((X + 0.5) / d > TOMB_W - 9 ? 1 : 0) + (h2(X >> 2, Y >> 2, 273) - 0.5) * 0.5, X, Y, 0.6));
      if (d >= 2) p.line(TOMB_W - 17.5, H - 0.5, TOMB_W - 5.5, 4.5, pick(st, 5.2));
      p.rect(6, chestTop - 2, TOMB_W - 12, 2.5, pick(st, 0.4));
    }
    dustOn(p, 3, 4, TOMB_W - 6, 2, 0.45, 275);
    outlineC(p);
  },
);

export const SLAB_W = 48;
export const SLAB_H = 16;
/** The floor line (G) in the slab's frame. */
const SLAB_G = 8;

regC(
  'prop/oz-slab/slab',
  same(4, { w: SLAB_W, h: SLAB_H, ox: SLAB_W / 2, oy: SLAB_G }),
  (p, f) => {
    const d = p.d;
    const st = ct('sandstone', d, 0.18);
    // The slab lies in the floor (a trapezoid in perspective, wider toward the viewer), a moulded
    // border, an incised cross and an epitaph's lines worn almost away.
    const poly: Array<[number, number]> = [
      [6, SLAB_G + 0.5],
      [SLAB_W - 6, SLAB_G + 0.5],
      [SLAB_W - 3, SLAB_H],
      [3, SLAB_H],
    ];
    const x0 = (y: number): number => 6 - ((y - SLAB_G) / (SLAB_H - SLAB_G)) * 3;
    if (f < 3) {
      p.poly(poly, (X, Y) => {
        const x = (X + 0.5) / d;
        const y = (Y + 0.5) / d;
        const l = x0(y);
        const border = x - l < 1.6 || SLAB_W - l - x < 1.6 || y < SLAB_G + 1.2;
        let k = 4.3 - (border ? -0.4 : 0) + (h2(X >> 2, Y >> 1, 281) - 0.5) * 0.5;
        if (d >= 4 && h2(X, Y, 282) > 0.93) k -= 0.7;
        return dp(st, k, X, Y, 0.6);
      });
      // The cross (foreshortened) and the lines of the epitaph.
      p.rect(SLAB_W / 2 - 0.6, SLAB_G + 2, 1.2, 5, pick(st, 1.8));
      p.rect(SLAB_W / 2 - 3, SLAB_G + 3.4, 6, 0.8, pick(st, 1.8));
      if (d >= 2) for (let k = 0; k < 3; k++) p.rect(10 + k * 1.2, SLAB_G + 2.5 + k * 1.8, 10 - k, 0.4, pick(st, 2.6));
      if (d >= 2) for (let k = 0; k < 3; k++) p.rect(SLAB_W - 20 - k * 0.6, SLAB_G + 2.5 + k * 1.8, 9 - k, 0.4, pick(st, 2.6));
      if (f >= 1) {
        // The crack (a dark jagged line), then a second one and chips lifting (f 2).
        const crack: Array<[number, number]> = [
          [15, SLAB_G + 1],
          [19, SLAB_G + 3],
          [17, SLAB_G + 5],
          [22, SLAB_H - 1],
        ];
        for (let i = 0; i + 1 < crack.length; i++) p.line(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], T('ink', 0, d), Math.max(1, d >> 1));
        if (f === 2) {
          const c2: Array<[number, number]> = [
            [33, SLAB_G + 1],
            [30, SLAB_G + 4],
            [34, SLAB_H - 1],
          ];
          for (let i = 0; i + 1 < c2.length; i++) p.line(c2[i][0], c2[i][1], c2[i + 1][0], c2[i + 1][1], T('ink', 0, d), Math.max(1, d >> 1));
          for (const [cx, cy] of [
            [20, SLAB_G - 1],
            [29, SLAB_G - 2],
            [25, SLAB_G - 0.5],
          ] as const)
            p.rect(cx, cy, 1.4, 1.2, pick(st, 4.6));
        }
      }
    } else {
      // Broken open: a black hole, the fragments tilted up out of the floor, chips around.
      p.poly(poly, (X, Y) => {
        const x = (X + 0.5) / d;
        const y = (Y + 0.5) / d;
        const l = x0(y);
        if (x - l > 4 && SLAB_W - l - x > 4) return dp(ct('ink', d, 0), 1 - (y - SLAB_G) * 0.1, X, Y, 0.5);
        return dp(st, 2.6, X, Y, 0.6);
      });
      const frag = (pts: Array<[number, number]>, k: number): void => p.poly(pts, (X, Y) => dp(st, k + (h2(X >> 1, Y >> 1, 283) - 0.5) * 0.6, X, Y, 0.6));
      frag([[5, SLAB_G + 3], [15, SLAB_G - 4], [19, SLAB_G - 2], [10, SLAB_G + 5]], 4.4);
      frag([[30, SLAB_G - 5], [41, SLAB_G + 1], [38, SLAB_G + 4], [28, SLAB_G - 2]], 3.6);
      frag([[19, SLAB_G + 6], [27, SLAB_G + 5], [26, SLAB_H - 1], [18, SLAB_H - 0.5]], 3.2);
      for (const [cx, cy] of [
        [3, SLAB_G - 1],
        [44, SLAB_G - 0.5],
        [24, SLAB_G - 3],
      ] as const)
        p.rect(cx, cy, 1.4, 1.2, pick(st, 4.2));
    }
    outlineC(p);
  },
);
