/**
 * The pink boat's body art (`boss/ring-boot/…`; docs/design/ring.md §R.7; docs/ART_GUIDE.md "UHD
 * art"): ONE density-generic drawer per strip (`PAL` at 1×, `PAL_HD` at 2× / 4× through the stag
 * kit's `mat`), every frame cropped to its 1× box (`defStrip`), the anchor = the boat's anchor (the
 * road under the trailer's middle; geometry.ts). Outline A (the boat can be hit). Our own design and
 * lettering: a chunky Dutch flat-bottomed boat painted pink by hand, never mirrored.
 *
 * | id | frames | what |
 * |---|---|---|
 * | `trailer` | 1 | the twin-axle boat trailer: the galvanised beam, the A-frame drawbar with its hitch and jockey wheel, the winch post and strap, the bunks, the mudguards, the light board (the wheels: `ring/car/wheel-m`) |
 * | `hull-<0\|1\|2>` | 1 | the hull's near side with the bulwark rail, the leeboard, the hand-painted flowers and waves, the water drop at the bow, the name `DE LAATSTE DRUPPEL`: clean, scuffed with paint splats, cracked |
 * | `hull-wreck` | 1 (deferred) | the end: broken in the middle, both halves sagging onto the trailer |
 * | `deck` | 1 | behind the crew: the deckhouse aft (portholes, a hatch), the leader's fruit crate, coiled rope |
 * | `mast` | 3 | the mast with the bunting to the bow and the stern and the streamer `EXHAUSTING REBELLION` (flutter) |
 * | `mast-fall` | 4 (deferred) | the mast toppling aft (15°, 40°, 65°, lying) |
 * | `boom` | 6 | the boom with the furled patchwork sail (anchor: the gooseneck): rest, the creak (tell), across, forward, out, out low |
 * | `speaker-<l\|r>-<0\|1\|2>` | 1 | a horn loudspeaker on its pole: whole, dented, broken (bent down, the cone torn) |
 */
import type { Frame } from '../../../../engine/render';
import { INK } from '../../../../engine/palette';
import type { TexSample } from '../../../art/hd/canvas';
import { defStrip, frac, hash2, lineW, Pen, turnPt, type Turn } from '../boss/art-kit';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';
import { faceHit, faceWidth, SMALL } from '../foot/art-blok-letters';
import { BOAT_TITLE, PENNANT_TEXT } from '../foot/lines';
import {
  BOAT_G,
  BOOM_ENDS,
  BUNTING_BOW,
  BUNTING_STERN,
  CABIN,
  DECK_Y,
  HULL,
  LEADER_HIP,
  MAST,
  MASTHEAD,
  sheerY,
  SPEAKER_L,
  SPEAKER_R,
  TRAILER,
  type Pt,
} from './geometry';

export const BOAT_SPR = 'boss/ring-boot';
const S = (name: string): string => `${BOAT_SPR}/${name}`;

/** Sprite ids of the body (the crew and the effects: art-crew.ts, art-fx.ts). */
export const BODY_SPR = {
  trailer: S('trailer'),
  hull: (s: 0 | 1 | 2) => S(`hull-${s}`),
  wreck: S('hull-wreck'),
  deck: S('deck'),
  mast: S('mast'),
  mastFall: S('mast-fall'),
  boom: S('boom'),
  speaker: (side: 'l' | 'r', s: 0 | 1 | 2) => S(`speaker-${side}-${s}`),
} as const;

/** The angles of the toppling mast (deg, clockwise: it falls aft, over the deckhouse). */
export const MAST_FALL = [15, 40, 65, 84] as const;

const rough = (x: number, y: number, k: number, d: number): number => (d === 1 ? 0 : (hash2(Math.floor(x * d * 0.5) + k, Math.floor(y * d * 0.5) - k) - 0.5) * 0.5);

// ---------------------------------------------------------------------------------------------
// The trailer
// ---------------------------------------------------------------------------------------------

export function trailerFrame(d: Dn): Frame {
  const p = new Pen(-124, -40, 210, 38, d);
  const c = p.c;
  const galv = mat(c, 'steel', { spec: 0.7, shine: 34, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const dark = mat(c, 'steel', { spec: 0.3, shine: 20, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const black = mat(c, 'black', { spec: 0.5, shine: 30, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const strap = mat(c, 'gold', { spec: 0.2, shine: 18, lo1: 1, hi1: 2, lo: 2, hi: 5, wrap: 0.3 });
  const carpet = mat(c, 'olive', { spec: 0, lo1: 0, hi1: 2, lo: 1, hi: 4, wrap: 0.3 });
  const lampR = mat(c, 'orange', { spec: 1, shine: 50, lo1: 1, hi1: 2, lo: 2, hi: 5 });
  const lampA = mat(c, 'gold', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const G = BOAT_G;
  const by = TRAILER.beamY;
  const zinc = (t: TexSample, x: number): void => {
    // Galvanised spangle: a soft mottle, rust-free; the odd darker smear of road grime low down.
    const g = hash2(Math.floor(x * d * 0.7), Math.floor(t.y * d * 0.7) + 7);
    t.tone += (g - 0.5) * 0.18;
    if (t.v > 0.7 && g > 0.8) t.tone -= 0.25;
  };
  // The beam (a C-channel seen from the side: a lit top flange, the web, the lower flange).
  p.box(TRAILER.x0, by - 2.6, TRAILER.x1 - TRAILER.x0, 5.2, {
    mat: galv,
    z: 3,
    r: 0.6,
    round: 0.4,
    tex: (t) => {
      const yy = t.y + p.y0;
      if (yy > by - 1.6 && yy < by + 1.4) t.tone -= 0.18;
      zinc(t, t.x + p.x0);
    },
  });
  // The A-frame drawbar to the hitch, the hitch head (a black ball cap) and its handle.
  p.capsule(TRAILER.x0 + 2, by, TRAILER.drawbarTip + 6, by + 1, 2.2, 1.8, { mat: galv, z: 3.2, tex: (t) => zinc(t, t.x + p.x0) });
  p.ellipsoid(TRAILER.drawbarTip + 3, by - 0.4, 4.2, 2.8, { mat: black, z: 3.6 });
  p.capsule(TRAILER.drawbarTip + 5, by - 2.6, TRAILER.drawbarTip + 9, by - 3.4, 0.6, 0.6, { mat: black, z: 3.7 });
  // The jockey wheel on its post (up off the road a little: the trailer stands on its wheels).
  const jx = TRAILER.jockeyX;
  p.box(jx - 1.3, by - 5, 2.6, 13, { mat: galv, z: 3.4, r: 0.4, tex: (t) => zinc(t, t.x + p.x0) });
  p.capsule(jx - 2, by - 5, jx + 2, by - 5, 1.4, 1.4, { mat: black, z: 3.6 });
  p.ellipsoid(jx, G - 3, 3, 3, { mat: black, z: 3.5, tex: (t) => (Math.hypot(t.x + p.x0 - jx, t.y + p.y0 - (G - 3)) < 1.2 ? void (t.mat = galv) : undefined) });
  // The winch post at the bow with the winch drum and the strap to the bow eye.
  const wx = TRAILER.x0 + 2;
  p.poly([[wx - 2, by], [wx + 1.4, by], [wx + 1.6, -36], [wx - 1.4, -36]], { mat: galv, z: 2.6, round: 0.5 });
  p.capsule(wx - 1, by - 2, wx + 10, by - 1, 1, 1, { mat: galv, z: 2.5 });
  p.ellipsoid(wx - 1.2, -30, 2.6, 2.6, { mat: dark, z: 2.9 });
  p.capsule(wx - 2.6, -30, wx - 5, -27.6, 0.5, 0.5, { mat: black, z: 3 });
  p.capsule(wx, -32.4, wx + 4, -36, 0.7, 0.7, { mat: strap, z: 2.8 });
  // The bunks under the hull (carpeted timber on short posts).
  for (const bx of [-64, -24, 30, 64]) {
    p.box(bx - 1.2, -20, 2.4, by - 1 + 20, { mat: galv, z: 2.4, r: 0.3, tex: (t) => zinc(t, t.x + p.x0) });
    p.box(bx - 5, -21.5, 10, 2.4, { mat: carpet, z: 2.6, r: 0.5, round: 0.4 });
  }
  // The mudguards over the axles (one arched guard over both wheels) and their stays.
  const ax0 = TRAILER.axles[0];
  const ax1 = TRAILER.axles[1];
  const r = TRAILER.wheelR + 1.8;
  const cy = G - TRAILER.wheelR;
  p.field(ax0 - r - 1, cy - r - 2, ax1 - ax0 + 2 * r + 2, r + 3, (x, y) => {
    const dx = x < ax0 ? x - ax0 : x > ax1 ? x - ax1 : 0;
    const e = Math.hypot(dx, y - cy);
    if (e > r || e < r - 1.6 || y > cy - 1) return NaN;
    return 1.2 - Math.abs(e - (r - 0.8)) * 0.8;
  }, { mat: galv, z: 4 }, (t, x, y) => zinc(t, x + y));
  // The light board at the stern: two lamps and a reflective chevron strip.
  const lx = TRAILER.x1 + 2;
  p.box(lx - 2, by - 4, 12, 4.6, { mat: black, z: 3.8, r: 0.6 });
  p.box(lx - 1, by - 3.2, 3.4, 2.8, { mat: lampR, z: 4, r: 0.6 });
  p.box(lx + 5, by - 3.2, 3.4, 2.8, { mat: lampA, z: 4, r: 0.6 });
  p.capsule(TRAILER.x1 - 2, by - 1, lx - 1, by - 2, 1.1, 1.1, { mat: galv, z: 3.4 });
  return p.frame(finishA(c, 0.25));
}

// ---------------------------------------------------------------------------------------------
// The hull
// ---------------------------------------------------------------------------------------------

/** The hull's bounding box (local, + the bulwark rail). */
const HX0 = -102;
const HY0 = -70;
const HW = 196;
const HH = 56;
const KEEL = -17;

/** A painted daisy at (fx, fy) of radius fr: 0 none, 1 petal, 2 centre. */
function daisy(x: number, y: number, fx: number, fy: number, fr: number): number {
  const dx = x - fx;
  const dy = y - fy;
  const rr = Math.hypot(dx, dy);
  if (rr > fr) return 0;
  if (rr < fr * 0.36) return 2;
  const a = Math.atan2(dy, dx);
  // Six round petals.
  const petal = 0.62 + 0.38 * Math.abs(Math.cos(a * 3));
  return rr < fr * petal ? 1 : 0;
}

/** The painted flowers on the hull side (x, y, radius, colour index 0 white, 1 gold, 2 sky). */
const FLOWERS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-62, -43, 4.2, 0],
  [-50, -31, 3.4, 1],
  [-68, -27, 2.8, 2],
  [-8, -31, 3.2, 2],
  [14, -30, 3.6, 0],
  [36, -31, 3.4, 1],
  [58, -30, 3.8, 2],
  [78, -44, 4, 0],
  [78, -30, 2.6, 1],
];

/** The water drop at the bow (a teardrop): inside? and its highlight. */
function dropHit(x: number, y: number): 0 | 1 | 2 {
  const cx = -80;
  const cy = -34;
  const rr = 6;
  const dy = y - cy;
  const dx = x - cx;
  let inside = false;
  if (dy >= 0) inside = Math.hypot(dx, dy) <= rr;
  else if (dy > -rr * 2.1) inside = Math.abs(dx) <= rr * (1 + dy / (rr * 2.1)) * Math.sqrt(Math.max(0, 1 + dy / (rr * 4.2)));
  if (!inside) return 0;
  // The highlight: a crescent upper left.
  if (Math.hypot(dx + 2.4, dy + 0.6) < 1.8 || (Math.abs(dx + 2.6) < 0.7 && dy > -5 && dy < -1)) return 2;
  return 1;
}

/** The name on the hull (centre and baseline of the 3 × 5 lettering). */
const NAME_CX = 34;
const NAME_Y = -43;

interface HullMats {
  pink: number;
  wood: number;
  white: number;
  gold: number;
  sky: number;
  navy: number;
  bottom: number;
  shadow: number;
  splat: number[];
  crack: number;
}

function hullMats(p: Pen): HullMats {
  const c = p.c;
  return {
    pink: mat(c, 'pink', { spec: 0.8, shine: 40, lo1: 0, hi1: 2, lo: 1, hi: 5, rim: 0.3, bounce: 0.3 }),
    wood: mat(c, 'wood', { spec: 0.6, shine: 34, lo1: 0, hi1: 3, lo: 1, hi: 6 }),
    white: mat(c, 'snow', { spec: 0.5, shine: 30, lo1: 1, hi1: 3, lo: 3, hi: 6 }),
    gold: mat(c, 'gold', { spec: 0.5, shine: 30, lo1: 1, hi1: 3, lo: 3, hi: 6 }),
    sky: mat(c, 'sky', { spec: 0.6, shine: 34, lo1: 0, hi1: 2, lo: 2, hi: 6 }),
    navy: mat(c, 'navy', { spec: 0.4, shine: 26, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    bottom: mat(c, 'slate', { spec: 0.2, shine: 18, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    shadow: mat(c, 'pink', { spec: 0.2, shine: 18, lo1: 0, hi1: 0, lo: 0, hi: 2 }),
    splat: [mat(c, 'gold', { spec: 0.9, shine: 50, lo1: 2, hi1: 3, lo: 4, hi: 6 }), mat(c, 'teal', { spec: 0.9, shine: 50, lo1: 1, hi1: 2, lo: 3, hi: 5 }), mat(c, 'sky', { spec: 0.9, shine: 50, lo1: 2, hi1: 3, lo: 4, hi: 6 })],
    crack: mat(c, 'ink', { spec: 0, lo1: 0, hi1: 1, lo: 0, hi: 1, flat: true }),
  };
}

/** Paint splats of a scuffed hull (x, y, r, colour). */
const SPLATS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-44, -36, 3.6, 0],
  [12, -30, 3, 1],
  [58, -38, 3.4, 2],
  [-20, -27, 2.4, 1],
];

/** A cracked hull's cracks (polylines). */
const CRACKS: ReadonlyArray<readonly Pt[]> = [
  [[4, -51], [6, -45], [3, -40], [7, -33], [5, -26], [8, -19]],
  [[-58, -52], [-55, -46], [-59, -41]],
  [[44, -53], [47, -47], [44, -43], [48, -38]],
];

function nearCrack(x: number, y: number, w: number): boolean {
  for (const line of CRACKS) {
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      if (Math.hypot(x - ax - u * dx, y - ay - u * dy) < w) return true;
    }
  }
  return false;
}

/**
 * The paint and the planking at hull-space (hx, hy) (the side's texture): switches the material
 * and the tone. `state` 0 clean, 1 scuffed (splats), 2 cracked.
 */
function hullTex(m: HullMats, state: number, d: number): (t: TexSample, hx: number, hy: number) => void {
  const lw = lineW(d);
  return (t, hx, hy) => {
    const sy = sheerY(hx);
    const fromTop = hy - sy;
    // The rubbing strake under the sheer (varnished wood) and the bulwark's cap.
    if (fromTop < 3.2) {
      t.mat = m.wood;
      t.tone += fromTop < 1 ? 0.3 : fromTop > 2.4 ? -0.3 : 0;
      if (frac((hx + hy * 0.1) / 9) < 0.05) t.tone -= 0.2;
      return;
    }
    // The bottom (dark anti-fouling under the boot stripe), the boot stripe with painted waves.
    const waveY = -23.5 + Math.sin(hx / 5.2) * 1.4;
    if (hy > waveY + 3) {
      t.mat = m.bottom;
      t.tone += (hash2(Math.floor(hx * d), Math.floor(hy * d)) - 0.5) * 0.2;
      return;
    }
    if (hy > waveY) {
      t.mat = m.sky;
      // A white crest along the top of each wave.
      if (hy < waveY + 0.9 && Math.sin(hx / 5.2) > 0.2) t.mat = m.white;
      return;
    }
    // Planking: a seam every 5.5 px following the sheer (fine at 2× / 4×, a tone at 1×).
    const plank = (fromTop - 3.2) / 5.5;
    if (frac(plank) < (d === 1 ? 0.12 : 0.06)) t.tone -= d === 1 ? 0.15 : 0.32;
    // Form: the lit shoulder under the strake, the side turning under toward the waterline.
    const v = Math.max(0, Math.min(1, fromTop / (waveY - sy)));
    t.tone += v < 0.18 ? 0.22 : -v * 0.28;
    // Hand-painted brush texture (2× / 4×): streaks along the planks.
    if (d > 1) t.tone += (hash2(Math.floor(hx * 0.6), Math.floor(hy * d)) - 0.5) * 0.12;
    // The water drop at the bow.
    const dh = dropHit(hx, hy);
    if (dh) {
      t.mat = dh === 2 ? m.white : m.sky;
      if (dh === 1) t.tone += (hy + 34) * -0.03;
      return;
    }
    // The name (white letters with a dark drop shadow down-right: painted on).
    const nw = faceWidth(SMALL, BOAT_TITLE, 1, 1);
    const nx = NAME_CX - nw / 2;
    const r = rough(hx, hy, 11, d);
    if (faceHit(SMALL, BOAT_TITLE, nx, NAME_Y + r * 0.4, 1, 1, hx, hy)) {
      t.mat = m.white;
      t.tone += 0.2;
      return;
    }
    if (faceHit(SMALL, BOAT_TITLE, nx + 0.6, NAME_Y + 0.6, 1, 1, hx, hy)) {
      t.mat = m.shadow;
      return;
    }
    // The flowers.
    for (const [fx, fy, fr, col] of FLOWERS) {
      const f = daisy(hx, hy, fx, fy, fr + r * 0.6);
      if (!f) continue;
      t.mat = f === 2 ? (col === 1 ? m.navy : m.gold) : col === 0 ? m.white : col === 1 ? m.gold : m.sky;
      t.tone += f === 2 ? 0.1 : 0.15;
      return;
    }
    // Wear: chips of paint (the wood shows) near the strake and the bow.
    const chip = hash2(Math.floor(hx * 1.4) + 91, Math.floor(hy * 1.4) - 33);
    if (chip > (hx < -80 || fromTop < 6 ? 0.965 : 0.992)) {
      t.mat = m.wood;
      t.tone -= 0.1;
      return;
    }
    if (state >= 1) {
      for (const [sx, sy2, sr, col] of SPLATS) {
        const dd = Math.hypot(hx - sx, (hy - sy2) * 1.3);
        const lobes = sr * (0.75 + 0.35 * Math.sin(Math.atan2(hy - sy2, hx - sx) * 5 + sx));
        // A splat and its drips running down.
        const drip = Math.abs(hx - sx - Math.round((sx % 3) - 1) * 1.6) < 0.7 && hy > sy2 && hy < sy2 + sr * 1.9;
        if (dd < lobes || drip) {
          t.mat = m.splat[col];
          return;
        }
      }
      // Dents (a darker dimple).
      if (Math.hypot(hx + 8, hy + 32) < 2.2 || Math.hypot(hx - 26, hy + 44) < 1.8) t.tone -= 0.35;
    }
    if (state >= 2 && nearCrack(hx, hy, Math.max(lw * 2, 0.5))) {
      t.mat = m.crack;
      return;
    }
    if (state >= 2 && nearCrack(hx, hy, 1.2)) t.tone -= 0.3;
  };
}

/** The leeboard (a pear-shaped varnished board hanging on the side): inside? */
function leeboard(x: number, y: number): boolean {
  const px = -34;
  const py = -50;
  const len = 28;
  const v = (y - py) / len;
  if (v < 0 || v > 1) return false;
  const half = 3 + 7.5 * Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.5) * (v > 0.82 ? Math.sqrt(Math.max(0, 1 - ((v - 0.82) / 0.18) ** 2)) : 1);
  const cx = px + v * 6;
  return Math.abs(x - cx) <= half;
}

/** The bulwark rail on the sheer: stanchions every 12 px and two lines (a white rope on top). */
function drawRail(p: Pen, m: HullMats, xs: readonly number[], turn: Turn | null = null, dy = 0): void {
  const steel = mat(p.c, 'steel', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const rope = mat(p.c, 'cloth', { spec: 0.1, shine: 16, lo1: 1, hi1: 3, lo: 2, hi: 5, wrap: 0.3 });
  const pts: Pt[] = [];
  for (const x of xs) {
    const y0 = sheerY(x) + dy;
    const a = turnPt(turn, x, y0 + 1);
    const b = turnPt(turn, x, y0 - 7.5);
    p.capsule(a[0], a[1], b[0], b[1], 0.5, 0.45, { mat: steel, z: 6 });
    pts.push(b);
  }
  p.stroke(pts, 0.6, 0.6, { mat: rope, z: 6.4 });
  if (p.d > 1) {
    const mid = xs.map((x) => turnPt(turn, x, sheerY(x) + dy - 3.6));
    p.stroke(mid, 0.3, 0.3, { mat: steel, z: 6.2 });
  }
  void m;
}

const RAIL_XS: readonly number[] = [-95, -78, -61, -44, -27, -10, 7, 24, 41, 58, 75, 89];

export function hullFrame(state: 0 | 1 | 2, d: Dn): Frame {
  const p = new Pen(HX0, HY0, HW, HH, d);
  const m = hullMats(p);
  const tex = hullTex(m, state, d);
  // The side: a rolled body with a bulge (the tumblehome: rounder high, flatter low).
  p.body(HULL, 2.4, { mat: m.pink, z: 2 }, (x, y) => {
    const s = sheerY(x);
    const v = Math.max(0, Math.min(1, (y - s) / (KEEL - s)));
    return Math.sin(v * Math.PI * 0.9) * 2.2;
  }, undefined, (t, x, y) => tex(t, x, y));
  // The leeboard (on the side, its pivot bolt).
  const wood = mat(p.c, 'wood', { spec: 0.7, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  p.field(-44, -51, 24, 30, (x, y) => (leeboard(x, y) ? 1.4 : NaN), { mat: wood, z: 9 }, (t, x, y) => {
    // Grain along the board, a darker rim, a brass bolt at the pivot.
    t.tone += (hash2(Math.floor(x * d * 0.4), Math.floor(y * 0.5)) - 0.5) * 0.25 + Math.sin(x * 1.3 + y * 0.2) * 0.06;
    if (!leeboard(x - 0.9, y) || !leeboard(x + 0.9, y) || !leeboard(x, y + 0.9)) t.tone -= 0.3;
    if (state >= 2 && Math.abs(x + 28 - (y + 36) * 0.4) < 0.4 && y > -40 && y < -30) t.tone -= 0.6;
  });
  p.ellipsoid(-34, -48, 1.5, 1.5, { mat: mat(p.c, 'gold', { spec: 1, shine: 60, lo1: 1, hi1: 3, lo: 3, hi: 6 }), z: 12 });
  drawRail(p, m, RAIL_XS);
  return p.frame(finishA(p.c, 0.25));
}

/** The part of a closed polygon left (`left`) or right of the vertical line x = bx (Sutherland–Hodgman). */
function clipX(poly: readonly Pt[], bx: number, left: boolean): Pt[] {
  const inside = (p: Pt): boolean => (left ? p[0] <= bx : p[0] >= bx);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const u = (bx - a[0]) / (b[0] - a[0]);
      // A jagged break: the cut points step in and out a little.
      out.push([bx + (out.length % 2 ? 1.2 : -1.2) * (left ? 1 : -1), a[1] + (b[1] - a[1]) * u]);
    }
  }
  return out;
}

/** The wreck: broken at x 6, the bow half and the stern half sagging toward the break. */
export function wreckFrame(d: Dn): Frame {
  const p = new Pen(HX0, HY0, HW, HH + 8, d);
  const m = hullMats(p);
  const tex = hullTex(m, 2, d);
  const BX = 6;
  const bow: Turn = { rot: -4, px: BX, py: KEEL };
  const stern: Turn = { rot: 4.5, px: BX, py: KEEL };
  const inv = (t: Turn): Turn => ({ rot: -t.rot, px: t.px, py: t.py });
  const halves: Array<[Turn, (x: number) => boolean]> = [
    [bow, (x) => x < BX - 0.5],
    [stern, (x) => x > BX + 0.5],
  ];
  for (const [turn, side] of halves) {
    const back = inv(turn);
    const poly = clipX(HULL, BX, side(BX - 5)).map(([x, y]) => turnPt(turn, x, y + 3));
    p.body(poly, 2.2, { mat: m.pink, z: 2 }, undefined, undefined, (t, x, y) => {
      const [hx, hy] = turnPt(back, x, y);
      tex(t, hx, hy - 3);
      t.tone -= 0.08;
    });
  }
  // Splinters at the break and the rail (bent with the halves).
  const wood = mat(p.c, 'wood', { spec: 0.4, shine: 26, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  for (let i = 0; i < 5; i++) {
    const y = -46 + i * 6;
    p.capsule(BX - 2, y, BX + 2 + (i % 2 ? 2 : -2), y - 3, 0.6, 0.3, { mat: wood, z: 5 });
  }
  drawRail(p, m, RAIL_XS.filter((x) => x < BX - 2), bow, 3);
  drawRail(p, m, RAIL_XS.filter((x) => x > BX + 2), stern, 3);
  return p.frame(finishA(p.c, 0.25));
}

// ---------------------------------------------------------------------------------------------
// The deck behind the crew: the deckhouse, the crate, the rope
// ---------------------------------------------------------------------------------------------

export function deckFrame(d: Dn): Frame {
  const p = new Pen(-70, -76, 160, 26, d);
  const c = p.c;
  const paint = mat(c, 'sky', { spec: 0.6, shine: 34, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const trim = mat(c, 'snow', { spec: 0.6, shine: 34, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const glass = mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const brass = mat(c, 'gold', { spec: 1, shine: 60, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const canvas = mat(c, 'sand', { spec: 0.1, shine: 14, lo1: 1, hi1: 3, lo: 2, hi: 6, wrap: 0.3 });
  const crate = mat(c, 'wood', { spec: 0.2, shine: 18, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const rope = mat(c, 'sand', { spec: 0.1, lo1: 1, hi1: 3, lo: 2, hi: 5, wrap: 0.3 });
  // The deckhouse: painted planks, a white trim, round brass portholes, a hatch door.
  const { x0, x1, roof } = CABIN;
  p.box(x0, roof, x1 - x0, DECK_Y - roof + 2, {
    mat: paint,
    z: 1,
    r: 1.2,
    round: 0.5,
    tex: (t) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      if (frac((y - roof) / 3.4) < (d === 1 ? 0.15 : 0.08)) t.tone -= 0.25;
      if (x > x1 - 14 && x < x1 - 5 && y > roof + 3) {
        t.mat = trim;
        if (Math.abs(x - (x1 - 9.5)) < (d === 1 ? 0.5 : 0.25)) t.tone -= 0.4;
      }
    },
  });
  p.box(x0 - 1.5, roof - 2.2, x1 - x0 + 3, 3, { mat: canvas, z: 1.6, r: 1, round: 0.6, tex: (t) => void (t.tone += Math.sin((t.x + p.x0) * 0.9) * 0.12) });
  for (const px of [x0 + 7, x0 + 18, x0 + 29]) {
    p.ellipsoid(px, roof + 7.5, 3.1, 3.1, { mat: brass, z: 1.8, round: 0.6 });
    p.ellipsoid(px, roof + 7.5, 2, 2, { mat: glass, z: 2, round: 0.3, tex: (t) => (t.u < 0.4 && t.v < 0.4 ? void (t.tone += 0.6) : undefined) });
  }
  // The leader's fruit crate (slats) at the bow.
  const [lx] = LEADER_HIP;
  p.box(lx - 7, DECK_Y - 6, 14, 7, { mat: crate, z: 1.2, r: 0.4, tex: (t) => (frac((t.y + p.y0 - DECK_Y) / 2.4) < 0.25 ? void (t.tone -= 0.35) : undefined) });
  // A coil of rope by the mast.
  p.field(MAST.x + 6, DECK_Y - 4, 12, 5, (x, y) => {
    const e = Math.hypot((x - MAST.x - 12) / 6, (y - DECK_Y + 1) / 2.2);
    return e < 1 ? 1 - e * 0.5 + Math.sin(e * 18) * 0.15 : NaN;
  }, { mat: rope, z: 1.4 });
  return p.frame(finishA(c, 0.25));
}

// ---------------------------------------------------------------------------------------------
// The mast, the bunting and the streamer
// ---------------------------------------------------------------------------------------------

const BUNTING_COLS = ['pink', 'gold', 'sky', 'orange', 'snow', 'teal'] as const;

/** A sagging line from a to b: the point at u (0..1). */
function sag(a: Pt, b: Pt, u: number, s: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * s];
}

/** The mast standing at `rot` degrees (0 upright; it topples aft about its foot). */
function drawMast(p: Pen, f: number, rot: number, d: Dn, rigging: boolean): void {
  const c = p.c;
  const spar = mat(c, 'wood', { spec: 0.7, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const line = mat(c, 'stone', { spec: 0.2, lo1: 1, hi1: 2, lo: 2, hi: 4 });
  const flag = mat(c, 'gold', { spec: 0.1, shine: 16, lo1: 2, hi1: 3, lo: 3, hi: 6, wrap: 0.3 });
  const ink = mat(c, 'black', { spec: 0, lo1: 0, hi1: 0, lo: 0, hi: 1, flat: true });
  const turn: Turn = { rot, px: MAST.x, py: MAST.foot };
  const T = (x: number, y: number): [number, number] => turnPt(rot ? turn : null, x, y);
  const foot = T(MAST.x, MAST.foot);
  const head = T(MAST.x, MAST.top);
  p.capsule(foot[0], foot[1], head[0], head[1], 1.8, 1.1, {
    mat: spar,
    z: 1,
    tex: (t) => {
      // Varnish streaks along the grain, a darker band at the hounds and at the foot.
      t.tone += (hash2(Math.floor(t.v * 3 * d), Math.floor(t.u * 60)) - 0.5) * 0.16;
      if (Math.abs(t.u - 0.78) < 0.012 || t.u < 0.03) t.tone -= 0.3;
    },
  });
  // The masthead truck and a little brass vane.
  const truck = T(MAST.x, MAST.top - 1.5);
  p.ellipsoid(truck[0], truck[1], 1.8, 1.4, { mat: spar, z: 1.2 });
  const flagCols = BUNTING_COLS.map((n) => mat(c, n, { spec: 0.1, shine: 16, lo1: 1, hi1: 2, lo: 2, hi: 5, wrap: 0.3 }));
  if (rigging) {
    // The bunting to the bow and to the stern: triangular flags every 7 px.
    const mh = T(MASTHEAD[0], MASTHEAD[1] + 8);
    for (const [end, s] of [[BUNTING_BOW, 9], [BUNTING_STERN, 7]] as const) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) pts.push(sag(mh, end, i / 24, s));
      p.stroke(pts, 0.35, 0.35, { mat: line, z: 0.6 });
      const len = Math.hypot(end[0] - mh[0], end[1] - mh[1]);
      const n = Math.floor(len / 7);
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const [x, y] = sag(mh, end, u, s);
        const sway = Math.sin(f * 2.1 + i * 1.3) * 0.8;
        p.poly([[x - 2.2, y], [x + 2.2, y], [x + sway, y + 4.6]], { mat: flagCols[(i + (end === BUNTING_BOW ? 0 : 3)) % flagCols.length], z: 0.8, round: 0.3 });
      }
    }
  }
  // The streamer from the masthead, flying aft: EXHAUSTING REBELLION (our lettering, never mirrored).
  const L = 96;
  const tw = faceWidth(SMALL, PENNANT_TEXT, 1, 1);
  const tx0 = 6;
  const wave = (u: number): number => Math.sin(u * 0.09 - f * 2.09) * (0.5 + u * 0.022);
  const half = (u: number): number => (u < tx0 + tw + 2 ? 4.4 : 4.4 - ((u - tx0 - tw - 2) / (L - tx0 - tw - 2)) * 3.4);
  const root = T(MASTHEAD[0] + 1, MASTHEAD[1] + 4);
  if (rot === 0) {
    p.field(root[0], root[1] - 8, L + 2, 18, (x, y) => {
      const u = x - root[0];
      if (u < 0 || u > L) return NaN;
      const cy = root[1] + wave(u);
      const hh = half(u);
      // The swallow tail at the end.
      if (u > L - 6 && Math.abs(y - cy) < (u - (L - 6)) * 0.7) return NaN;
      return Math.abs(y - cy) <= hh ? 1 + Math.cos(u * 0.11 - f * 2.09) * 0.6 : NaN;
    }, { mat: flag, z: 1.6 }, (t, x, y) => {
      const u = x - root[0];
      const cy = root[1] + wave(u);
      // The letters ride the wave one by one (each letter keeps its shape); a hem line along both edges.
      const lu = u - tx0;
      const lc = tx0 + Math.floor(lu / 4) * 4 + 1.5;
      const ly = root[1] + (d === 1 ? Math.round(wave(lc)) : wave(lc));
      if (lu >= 0 && lu < tw && faceHit(SMALL, PENNANT_TEXT, tx0, ly - 2.5, 1, 1, u, y)) t.mat = ink;
      else if (Math.abs(Math.abs(y - cy) - half(u)) < 0.5) t.tone -= 0.25;
    });
  }
}

export function mastFrame(f: number, d: Dn): Frame {
  const p = new Pen(-104, -162, 210, 116, d);
  drawMast(p, f, 0, d, true);
  return p.frame(finishA(p.c, 0.15));
}

export function mastFallFrame(i: number, d: Dn): Frame {
  const p = new Pen(-30, -162, 170, 126, d);
  drawMast(p, 0, MAST_FALL[i], d, false);
  return p.frame(finishA(p.c, 0.15));
}

// ---------------------------------------------------------------------------------------------
// The boom with the furled sail
// ---------------------------------------------------------------------------------------------

const SAIL_COLS = ['cloth', 'sand', 'pink', 'sky', 'gold'] as const;

/** The boom frame f: from the gooseneck (the anchor) to `BOOM_ENDS[f]`; nearer = thicker. */
export function boomFrame(f: number, d: Dn): Frame {
  const p = new Pen(-122, -14, 224, 52, d);
  const c = p.c;
  const spar = mat(c, 'wood', { spec: 0.7, shine: 40, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  const tie = mat(c, 'navy', { spec: 0.2, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const cols = SAIL_COLS.map((n) => mat(c, n, { spec: 0.1, shine: 14, lo1: 1, hi1: 3, lo: 2, hi: 6, wrap: 0.35 }));
  const [ex, ey] = BOOM_ENDS[f];
  // Foreshortening: the frames pointing at the viewer (2) and forward (3–5) are nearer.
  const near = f === 2 ? 1.6 : f >= 3 ? 1.25 : 1;
  const z = f >= 2 ? 3 : 1;
  p.capsule(0, 0, ex, ey, 1.3 * near, 1.1 * near, { mat: spar, z });
  // The furled sail: a fat bundle on top of the boom, patchwork, tied every 9 px.
  const len = Math.hypot(ex, ey);
  const nx = -ey / len;
  const ny = ex / len;
  const up = ny > 0 ? -1 : 1;
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    const u0 = 0.06 + (i / steps) * 0.86;
    const u1 = 0.06 + ((i + 1) / steps) * 0.86;
    const rr = (2.4 + Math.sin(((u0 + u1) / 2) * Math.PI) * 1.4) * near;
    const off = up * (1.6 * near + rr * 0.6);
    const a: Pt = [ex * u0 + nx * off, ey * u0 + ny * off];
    const b: Pt = [ex * u1 + nx * off, ey * u1 + ny * off];
    p.capsule(a[0], a[1], b[0], b[1], rr, rr, {
      mat: cols[(i * 3 + 1) % cols.length],
      z: z + 0.5,
      part: c.newPart(),
      tex: (t) => {
        // Folds across the bundle.
        t.tone += Math.sin(t.u * 9 + i) * 0.12 + (t.v > 0.4 ? -0.15 : 0);
      },
    });
    if (i % 2 === 1) p.capsule(b[0] - nx * rr * up, b[1] - ny * rr * up, b[0] + nx * rr * up, b[1] + ny * rr * up, 0.45 * near, 0.45 * near, { mat: tie, z: z + 1.2 });
  }
  // The gooseneck fitting.
  p.ellipsoid(0, 0, 1.8 * near, 1.8 * near, { mat: mat(c, 'steel', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6 }), z: z + 1.4 });
  return p.frame(finishA(c, 0.2));
}

// ---------------------------------------------------------------------------------------------
// The loudspeakers
// ---------------------------------------------------------------------------------------------

export function speakerFrame(side: 'l' | 'r', s: 0 | 1 | 2, d: Dn): Frame {
  const sp = side === 'l' ? SPEAKER_L : SPEAKER_R;
  const b = sp.box;
  const [px, py] = sp.pole;
  const p = new Pen(b.x - 6, b.y - 6, b.w + 14, py - b.y + 9, d);
  const c = p.c;
  const horn = mat(c, 'snow', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3 });
  const band = mat(c, 'pink', { spec: 0.8, shine: 40, lo1: 0, hi1: 2, lo: 2, hi: 5 });
  const body = mat(c, 'black', { spec: 0.6, shine: 34, lo1: 0, hi1: 2, lo: 1, hi: 5 });
  const pole = mat(c, 'steel', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const mouthM = mat(c, 'black', { spec: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 });
  const cy = b.y + b.h / 2;
  const back = b.x + b.w;
  // The pole and its clamp.
  p.capsule(px + 4, py, px + 4, cy + 2, 0.9, 0.9, { mat: pole, z: 1 });
  p.box(px + 2, cy + 1, 4, 2.4, { mat: body, z: 1.4, r: 0.5 });
  if (s === 2) {
    // Broken: the horn hangs down off its bracket, the cone torn (dark), a wire dangles.
    const hx = px + 1;
    const hy = cy + 4;
    p.capsule(hx + 3, hy - 2, hx - 5, hy + 7, 1.6, 4.8, { mat: horn, z: 2 });
    p.ellipsoid(hx - 5, hy + 7.5, 4.2, 1.6, { mat: mouthM, z: 2.4 });
    p.capsule(hx + 3, hy - 2, hx + 5, hy + 6, 0.35, 0.35, { mat: body, z: 2.2 });
    p.ellipsoid(hx + 4, hy - 3, 2.4, 2.2, { mat: body, z: 2.3 });
    return p.frame(finishA(c, 0.2));
  }
  // The driver unit at the back, the flared horn toward the heroes (left).
  p.ellipsoid(back - 2.6, cy, 3, 3.2, { mat: body, z: 2 });
  p.field(b.x, b.y, b.w - 3, b.h, (x, y) => {
    const u = (x - b.x) / (b.w - 3);
    const r = 1.6 + (1 - u) ** 1.6 * (b.h / 2 - 1.4);
    const e = Math.abs(y - cy);
    return e <= r ? Math.sqrt(1 - (e / r) ** 2) * r * 0.6 : NaN;
  }, { mat: horn, z: 2.2 }, (t, x, y) => {
    const u = (x - b.x) / (b.w - 3);
    if (u > 0.55 && u < 0.66) t.mat = band;
    if (s === 1) {
      // Dents and a crack line across the flare.
      if (Math.hypot(x - b.x - 4, y - cy + 2) < 1.6) t.tone -= 0.45;
      if (Math.abs(x - b.x - 2 - (y - cy) * 0.6) < 0.35 && Math.abs(y - cy) < 4) t.tone -= 0.7;
    }
  });
  // The mouth (the dark inside of the flare), a rim.
  p.ellipsoid(b.x + 0.6, cy, 1.2, b.h / 2 - 0.8, { mat: mouthM, z: 2.6, round: 0.2 });
  return p.frame(finishA(c, 0.2));
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

defStrip(BODY_SPR.trailer, (d) => [trailerFrame(d)]);
for (const s of [0, 1, 2] as const) defStrip(BODY_SPR.hull(s), (d) => [hullFrame(s, d)]);
defStrip(BODY_SPR.wreck, (d) => [wreckFrame(d)], { defer: true });
defStrip(BODY_SPR.deck, (d) => [deckFrame(d)]);
defStrip(BODY_SPR.mast, (d) => [0, 1, 2].map((f) => mastFrame(f, d)), { ticksPerFrame: 9 });
defStrip(BODY_SPR.mastFall, (d) => [0, 1, 2, 3].map((i) => mastFallFrame(i, d)), { ticksPerFrame: 5, loop: false, defer: true });
defStrip(BODY_SPR.boom, (d) => BOOM_ENDS.map((_, f) => boomFrame(f, d)), { ticksPerFrame: 4, loop: false });
for (const side of ['l', 'r'] as const) for (const s of [0, 1, 2] as const) defStrip(BODY_SPR.speaker(side, s), (d) => [speakerFrame(side, s, d)]);

/** Kept for tools: the ink colour of the outline. */
export const BOAT_INK = INK;
/** Kept for tools: a top tone (used by the docs' palette checks). */
export const HULL_PINK = (d: Dn): number => top('pink', d, 2);
