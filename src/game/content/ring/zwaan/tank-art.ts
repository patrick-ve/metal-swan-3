/**
 * The tanker's art (`boss/ring-zwaan/tank/`; docs/design/ring.md §R.3; docs/ART_GUIDE.md "UHD art"):
 * ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× / 4×), every frame cropped to
 * its 1× box. Outline A for the tanker, its valves, the hose and the rolling tank; the slick, the
 * streak and the flames lie on the road (no ink: a decal and an emissive). Our own livery and
 * lettering (`FRITUURVET` in our block face; nothing mirrors).
 *
 * | id | frames | what |
 * |---|---|---|
 * | `body-<0\|1\|2>` | 1 | the running gear and the white tank: the rust-red band with `FRITUURVET`, `ZWAAN` and the swan, domes, the walkway rail, the ladder (by damage) |
 * | `valve` | 3 | a valve under the tank (anchor: its middle): shut, hot (the tell: glowing, sizzling), broken off |
 * | `hose` | 3 | the dump hose at the rear: stowed, swung out, spraying |
 * | `blob` | 3 | a gob of frying fat in the air (centre anchor) |
 * | `slick` | 5 | the slick on the road: the rear end, three middles, the front end (anchor: the tile's left edge on the lane line) |
 * | `streak` | 2 | the glistening fat line before the flames (the tell; tile, left edge) |
 * | `flame` | 4 | the flame trail (a tile, left edge on the lane line; it flickers) |
 * | `roll` | 4 (deferred) | the tank rolling onto the shoulder: turned 45°, 90°, 135°, 180° (anchor: its middle on the road) |
 * | `chassis` | 1 (deferred) | the running gear without the tank (the wreck) |
 * | `lamps` | 2 | the rear lamp lit: brake, indicator |
 */
import type { Frame } from '../../../../engine/render';
import { defStrip, frac, hash2, Pen, roll } from '../boss/art-kit';
import { finishA, mat, type Dn } from '../../stag/kit.art';
import { drawChassis, lampsFrame, swanHit, w5Hit, w5Width, zwMats, type ZwMats } from './autos-kit';
import { TANK, TANK_SPR, TILE } from './tank-geo';

const B = TANK.barrel;
const BAND = { y0: -39.5, y1: -30.5 } as const;
const WORD = 'FRITUURVET';
const WORD_S = 1;
const WORD_X = (B.x0 + B.x1) / 2 - w5Width(WORD, WORD_S) / 2 - 6;
const LINE = 'ZWAAN';
const LINE_X = 108;

/** The barrel's height field over its silhouette (a cylinder, dished ends; NaN off it). */
function barrelH(x: number, y: number): number {
  const dy = y - B.cy;
  if (Math.abs(dy) > B.r) return NaN;
  const e = Math.min(x - B.x0, B.x1 - x);
  if (e < 0) return NaN;
  // The dished ends: a rounded corner of radius 7 in the silhouette.
  const rc = 7;
  if (e < rc) {
    const cy = Math.abs(dy) > B.r - rc ? Math.abs(dy) - (B.r - rc) : 0;
    if (Math.hypot(rc - e, cy) > rc) return NaN;
  }
  const h = Math.sqrt(Math.max(0, B.r * B.r - dy * dy));
  return h * (0.55 + 0.45 * (roll(e, 6) / 6));
}

/**
 * The tank's surface look at local (x, y) turned by `rot`° about its axis (0 = upright): sets the
 * material (white, the band, the lettering, the grimy underside) and a little wear.
 */
function surface(t: { mat: number; tone: number }, m: ZwMats, x: number, y: number, rot: number, s: number, under: number, ink: number): void {
  const dy = Math.max(-1, Math.min(1, (y - B.cy) / B.r));
  // The angle on the barrel's original surface (0 = the side toward the camera, −90 the top).
  const th = (Math.asin(dy) * 180) / Math.PI + rot;
  const a = ((((th + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(a) > 90) {
    // The far side (seen after a roll): the grimy underside.
    t.mat = under;
    t.tone -= 0.1 + 0.15 * hash2(Math.floor(x / 3), Math.floor(y));
    return;
  }
  // The original y on the upright barrel's face (the band and the letters squash with the turn).
  const v = B.cy + Math.sin((a * Math.PI) / 180) * B.r;
  if (v >= BAND.y0 && v <= BAND.y1 && x > B.x0 + 6 && x < B.x1 - 6) {
    t.mat = m.rust;
    if (w5Hit(WORD, WORD_X, BAND.y0 + 2, WORD_S, x, v)) t.mat = ink;
  } else if (v > BAND.y1 + 1.2 && v < BAND.y1 + 2.4 && x > B.x0 + 6 && x < B.x1 - 6) t.mat = m.orange;
  else if (w5Hit(LINE, LINE_X, -49, 1, x, v)) t.mat = m.rust;
  else {
    const sw = swanHit(LINE_X - 13, BAND.y0 - 1.2, 0.8, x, v);
    if (sw) t.mat = sw === 2 ? m.orange : m.rust;
  }
  // Road grime along the bottom, streaks from the domes.
  if (v > B.cy + 9) t.tone -= 0.12 * ((v - B.cy - 9) / 7);
  // Faint run-off stains under the three domes.
  for (const dx of [30, 78, 126]) if (Math.abs(x - dx - 1.5) < 1.2 && v < B.cy - 6) t.tone -= 0.08 * (1 - (v - B.cy + B.r) / 10);
  if (s >= 1 && hash2(Math.floor(x * 1.3), Math.floor(v * 1.3)) < (s >= 2 ? 0.02 : 0.008)) t.tone -= 0.9;
}

/** The barrel at turn `rot` (0 upright), damage `s`, onto `p`. */
function barrel(p: Pen, m: ZwMats, rot: number, s: number): void {
  const d = p.d;
  const ink = mat(p.c, 'snow', { spec: 0.6, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const under = mat(p.c, 'stone', { spec: 0.4, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const part = p.c.newPart();
  p.field(B.x0 - 0.5, B.cy - B.r - 0.5, B.x1 - B.x0 + 1, B.r * 2 + 1, barrelH, { mat: m.white, z: 1, part }, (t, x, y) => surface(t, m, x, y, rot, s, under, ink));
  if (s >= 2) {
    p.shade(B.x0, B.cy - B.r, B.x1 - B.x0, B.r * 2, (x, y) => {
      const a = Math.hypot((x - 40) / 18, (y - B.cy + 4) / 9);
      const b = Math.hypot((x - 112) / 14, (y - B.cy + 8) / 7);
      return (a < 1 ? -0.7 * (1 - a * a) : 0) + (b < 1 ? -0.55 * (1 - b * b) : 0);
    }, part);
  }
  if (s >= 1 && d > 1) {
    // Dents: dark crescents with a light lower lip.
    for (let i = 0; i < (s >= 2 ? 9 : 4); i++) {
      const hx = 20 + hash2(s, i) * 120;
      const hy = B.cy - 8 + hash2(i, s + 3) * 16;
      p.shade(hx - 3, hy - 3, 6, 6, (x, y) => {
        const r = Math.hypot(x - hx, (y - hy) * 1.3);
        return r < 1.6 ? (y < hy ? -0.5 : 0.2) : 0;
      }, part);
    }
  }
}

/** The tanker body: the running gear, the tank, the domes, the walkway rail, the ladder. */
export function bodyFrame(s: number, d: Dn): Frame {
  const p = new Pen(-6, -60, TANK.length + 18, 61, d);
  const c = p.c;
  const m = zwMats(c);
  drawChassis(p, m, { length: TANK.length, deck: TANK.deck, wheels: TANK.wheels, skirt: [64, 124], skirtH: 6.4, state: s });
  // The saddles that hold the tank on the beams.
  for (const x of [16, 70, 140]) p.box(x - 3, TANK.deck - 4, 6, 4.4, { mat: m.black, z: 1.2, r: 0.6 });
  barrel(p, m, 0, s);
  // The manhole domes and their lids on top, the walkway rail (folded down).
  for (const x of [30, 78, 126]) {
    p.ellipsoid(x, B.cy - B.r + 0.4, 5, 2.6, { mat: m.steel, z: 2.5 });
    p.box(x - 3, B.cy - B.r - 2.4, 6, 1.4, { mat: m.chrome, z: 2.8, r: 0.5 });
  }
  p.capsule(14, B.cy - B.r - 1.2, 142, B.cy - B.r - 1.2, 0.55, 0.55, { mat: m.chrome, z: 2.6 });
  for (let x = 20; x < 142; x += 24) p.box(x, B.cy - B.r - 1.4, 1, 2, { mat: m.steel, z: 2.4, r: 0.2 });
  // The ladder at the rear end.
  for (const lx of [2.2, 6.2]) p.box(lx, B.cy - B.r - 2, 0.9, B.r * 2 + 2, { mat: m.steel, z: 20, r: 0.3 });
  for (let y = B.cy - B.r + 1; y < B.cy + B.r - 1; y += 4) p.box(2.2, y, 4.9, 0.8, { mat: m.chrome, z: 20.5, r: 0.2 });
  // The outlet pipe under the tank along the beams to the dump valve.
  p.capsule(9, -19.6, 128, -19.6, 0.9, 0.9, { mat: m.steel, z: 3 });
  // An orange ID plate on the rear end (blank: our own design, no codes).
  p.box(B.x0 + 1.4, B.cy - 3, 3.2, 6, { mat: m.orange, z: 21, r: 0.4 });
  return p.frame(finishA(c, 0.3));
}

/** The running gear without the tank (the wreck after the roll). */
export function chassisFrame(d: Dn): Frame {
  const p = new Pen(-6, -26, TANK.length + 18, 27, d);
  const c = p.c;
  const m = zwMats(c);
  drawChassis(p, m, { length: TANK.length, deck: TANK.deck, wheels: TANK.wheels, skirt: [64, 124], skirtH: 6.4, state: 2 });
  for (const x of [16, 70, 140]) p.box(x - 3, TANK.deck - 4, 6, 4.4, { mat: m.black, z: 1.2, r: 0.6 });
  p.capsule(9, -19.6, 128, -19.6, 0.9, 0.9, { mat: m.steel, z: 3 });
  // Soot on the beams.
  p.shade(0, -26, TANK.length, 26, (x) => -0.4 * (0.5 + 0.5 * Math.sin(x * 0.07)));
  return p.frame(finishA(c, 0.3));
}

/** The tank rolled by `rot`° about its axis (anchor: its middle on the road line). */
export function rollFrame(rot: number, d: Dn): Frame {
  const mx = (B.x0 + B.x1) / 2;
  const p = new Pen(B.x0 - mx - 2, -B.r * 2 - 2, B.x1 - B.x0 + 4, B.r * 2 + 3, d);
  const c = p.c;
  const m = zwMats(c);
  // The barrel drawn with its axis at y −r (it lies on the road), shifted so x is centred.
  const ink = mat(c, 'snow', { spec: 0.6, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const under = mat(c, 'stone', { spec: 0.4, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const dyAxis = -B.r - B.cy;
  p.field(B.x0 - mx - 0.5, -B.r * 2 - 0.5, B.x1 - B.x0 + 1, B.r * 2 + 1, (x, y) => barrelH(x + mx, y - dyAxis), { mat: m.white, z: 1 }, (t, x, y) => {
    surface(t, m, x + mx, y - dyAxis, rot, 2, under, ink);
    // Scorch over the whole tank after the fireball.
    t.tone -= 0.15 + 0.12 * hash2(Math.floor((x + mx) * 1.5), Math.floor(y * 1.5)) + 0.12 * Math.sin((x + mx) * 0.11);
  });
  return p.frame(finishA(c, 0.3));
}

/** A valve under the tank (anchor: its middle): 0 shut, 1 hot (the tell), 2 broken off. */
export function valveFrame(f: number, d: Dn): Frame {
  const p = new Pen(-6, -7, 12, 14, d);
  const c = p.c;
  const m = zwMats(c);
  const wheel = mat(c, 'red', { spec: 0.7, shine: 30, lo1: 0, hi1: 3, lo: 2, hi: 5 });
  if (f === 2) {
    // A torn stub, its flange and a drip of fat (gold, never red).
    p.box(-1.4, -5.2, 2.8, 3.4, { mat: m.steel, z: 1.2, r: 0.5 });
    p.box(-2.2, -2.4, 4.4, 1.2, { mat: m.black, z: 1.4, r: 0.3 });
    p.ellipsoid(0.2, 1.4, 0.9, 1.3, { mat: mat(c, 'gold', { spec: 1.2, shine: 60, lo1: 1, hi1: 3, lo: 3, hi: 6 }), z: 2 });
    return p.frame(finishA(c, 0.2));
  }
  // The down-pipe, the valve body, the handwheel (seen edge-on: a red disc on its spindle).
  p.box(-1.2, -6, 2.4, 4, { mat: m.steel, z: 1.2, r: 0.5 });
  p.box(-2.6, -2.4, 5.2, 3.6, { mat: f === 1 ? mat(c, 'orange', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 3, hi: 6 }) : m.chrome, z: 1.5, r: 0.8, bevel: 0.6 });
  p.box(-0.5, 1.2, 1, 2.2, { mat: m.steel, z: 1.6, r: 0.2 });
  p.box(-3, 3, 6, 1.6, { mat: wheel, z: 1.8, r: 0.8 });
  if (f === 1) {
    // Sizzling fat: hot gold gobs at the seam and a heat glow.
    const hot = mat(c, 'gold', { flat: true, lo1: 2, hi1: 3, lo: 4, hi: 7 });
    p.ellipsoid(-2.6, -0.8, 0.9, 0.8, { mat: hot, z: 2.2, tone: 0.4 });
    p.ellipsoid(2.4, 0.2, 0.8, 0.8, { mat: hot, z: 2.2, tone: 0.4 });
  }
  return p.frame(finishA(c, 0.2));
}

/** The dump hose at the rear (anchor: the rear on the road line): 0 stowed, 1 swung out, 2 spraying. */
export function hoseFrame(f: number, d: Dn): Frame {
  const p = new Pen(-14, -24, 20, 18, d);
  const c = p.c;
  const m = zwMats(c);
  const hose = mat(c, 'black', { spec: 0.5, shine: 24, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const pts: ReadonlyArray<readonly [number, number]> =
    f === 0
      ? [[4, -19.6], [1, -19.8], [-0.6, -18.4], [1, -16.6], [4, -16.6]]
      : f === 1
        ? [[4, -19.6], [0, -19.6], [-3, -18], [-4.6, -14.6]]
        : [[4, -19.6], [0, -19.8], [-4, -19], [-8, -17.4]];
  p.stroke(pts, 1.1, 1.1, { mat: hose, z: 1.5 });
  const e = pts[pts.length - 1];
  p.box(e[0] - 1.3, e[1] - 1, 2.6, 2, { mat: m.chrome, z: 1.8, r: 0.6 });
  p.ellipsoid(4, -19.6, 1.6, 1.6, { mat: m.steel, z: 1.9 });
  if (f === 2) {
    const fat = mat(c, 'gold', { spec: 1.2, shine: 60, lo1: 1, hi1: 3, lo: 3, hi: 6 });
    p.ellipsoid(e[0] - 2.2, e[1] + 0.2, 1.8, 1.1, { mat: fat, z: 2 });
  }
  return p.frame(finishA(c, 0.2));
}

/** A gob of frying fat (centre anchor), wobbling. */
export function blobFrame(f: number, d: Dn): Frame {
  const p = new Pen(-3, -3, 6, 6, d);
  const c = p.c;
  const fat = mat(c, 'gold', { spec: 1.3, shine: 64, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  p.ellipsoid(0, 0, 1.6 + f * 0.25, 1.4 - f * 0.2, { mat: fat, z: 1 });
  return p.frame(finishA(c, 0));
}

/** A slick tile on the road (anchor: its left edge on the lane line): 0 rear end, 1–3 middles, 4 front end. */
export function slickFrame(f: number, d: Dn): Frame {
  const W = TILE;
  const p = new Pen(-1, -6, W + 2, 12, d);
  const c = p.c;
  const fat = mat(c, 'gold', { spec: 1.4, shine: 70, lo1: 1, hi1: 3, lo: 2, hi: 5, amb: 0.2 });
  const dark = mat(c, 'sand', { spec: 1, shine: 50, lo1: 0, hi1: 2, lo: 1, hi: 3, amb: 0.2 });
  // The edge: a wavy band about 9 px deep, round ends on the end tiles.
  const u = (x: number): number => (x / W) * Math.PI * 2;
  const edge = (x: number): number => 3.8 + [0.9, -0.7, 0.6, -0.9, 0.8][f] * Math.sin(u(x)) + [0.4, 0.5, -0.5, 0.3, -0.4][f] * Math.sin(2 * u(x));
  p.field(0, -5.5, W, 11, (x, y) => {
    const hw = edge(x);
    let k = 1;
    if (f === 0) k = Math.min(1, Math.max(0, (x - 0.5) / 5));
    if (f === 4) k = Math.min(1, Math.max(0, (W - 0.5 - x) / 5));
    const lim = hw * Math.sqrt(k);
    if (Math.abs(y) > lim || lim <= 0.3) return NaN;
    return 0.3 * (1 - Math.abs(y) / lim);
  }, { mat: fat, z: 0.2, round: 0.5 }, (t, x, y) => {
    // Darker oily pools and bright glints (the gloss).
    if (hash2(Math.floor(x * 1.5 + f * 7), Math.floor(y * 1.5)) < 0.18) t.mat = dark;
    if (d > 1 && hash2(Math.floor(x * 2 + f * 3), Math.floor(y * 2 + 9)) < 0.05) t.tone += 0.6;
  });
  return p.frame(c.render({ outline: 'none', ao: 0 }));
}

/** The glistening fat streak (the flame trail's tell; tile, left edge on the lane line). */
export function streakFrame(f: number, d: Dn): Frame {
  const W = TILE;
  const p = new Pen(0, -2, W, 4, d);
  const c = p.c;
  const fat = mat(c, 'gold', { spec: 1.4, shine: 70, lo1: 1, hi1: 3, lo: 2, hi: 6, amb: 0.2 });
  p.field(0, -1.5, W, 3, (x, y) => (Math.abs(y - 0.35 * Math.sin(x * 0.8)) < 0.9 ? 0.2 : NaN), { mat: fat, z: 0.2, round: 0.4 }, (t, x) => {
    if (frac((x + f * 4) / 6) < 0.18) t.tone += 0.5;
  });
  return p.frame(c.render({ outline: 'none', ao: 0 }));
}

/** A flame trail tile (left edge on the lane line), flickering frame `f`. */
export function flameFrame(f: number, d: Dn): Frame {
  const W = TILE;
  const p = new Pen(-1, -22, W + 2, 26, d);
  const c = p.c;
  const fire = mat(c, 'fire', { flat: true, lo1: 0, hi1: 6, lo: 0, hi: 9 });
  // Tongues: the height over x flickers with the frame; hotter (lighter) at the base and the core.
  const hgt = (x: number): number => 9 + 5 * Math.sin(x * 0.75 + f * 1.7) + 3 * Math.sin(x * 1.9 - f * 2.3) + 2 * Math.cos(x * 0.4 + f);
  p.field(0, -21.5, W, 24, (x, y) => {
    const h = hgt(x);
    // A tongue narrows to its tip; the base sits a little below the lane line (the depth).
    const top2 = -h;
    if (y < top2 || y > 2.5) return NaN;
    const k = (y - top2) / (h + 2.5);
    const w = Math.abs(Math.sin(x * 0.75 + f * 1.7));
    return k * (0.5 + 0.5 * w);
  }, { mat: fire, z: 1 }, (t, x, y) => {
    const h = hgt(x);
    const k = (y + h) / (h + 2.5);
    t.tone = -0.45 + k * 0.9 + (hash2(Math.floor(x * 2 + f * 5), Math.floor(y * 2)) - 0.5) * 0.25;
  });
  return p.frame(c.render({ outline: 'none', ao: 0, clean: false }));
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

for (const s of [0, 1, 2]) defStrip(TANK_SPR.body(s), (d) => [bodyFrame(s, d)]);
defStrip(TANK_SPR.valve, (d) => [0, 1, 2].map((f) => valveFrame(f, d)));
defStrip(TANK_SPR.hose, (d) => [0, 1, 2].map((f) => hoseFrame(f, d)));
defStrip(TANK_SPR.blob, (d) => [0, 1, 2].map((f) => blobFrame(f, d)), { ticksPerFrame: 4 });
defStrip(TANK_SPR.slick, (d) => [0, 1, 2, 3, 4].map((f) => slickFrame(f, d)));
defStrip(TANK_SPR.streak, (d) => [0, 1].map((f) => streakFrame(f, d)), { ticksPerFrame: 6 });
defStrip(TANK_SPR.flame, (d) => [0, 1, 2, 3].map((f) => flameFrame(f, d)), { ticksPerFrame: 4 });
defStrip(TANK_SPR.roll, (d) => [45, 90, 135, 180].map((r) => rollFrame(r, d)), { ticksPerFrame: 8, loop: false, defer: true });
defStrip(TANK_SPR.chassis, (d) => [chassisFrame(d)], { defer: true });
defStrip(TANK_SPR.lamps, (d) => [lampsFrame(0, d), lampsFrame(1, d)]);

