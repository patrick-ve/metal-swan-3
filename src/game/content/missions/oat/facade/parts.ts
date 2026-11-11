/**
 * The part drawers of the façade grammar (docs/design/oat.md §8.6 gables, windows, doors and
 * ground floors, walls and details; §8.2 the MIXED scale; §8.4 the shadows on the wall; §8.10
 * façade wear; §8.11 NO ink outline: every edge comes from tone, the sun's lit side and the cast
 * shadows). One drawer per part for every density (1× / 2× / 4×): geometry is the lot's world
 * plan (grammar.ts) mapped onto the art grid (raster.ts), fine detail only at 4×, 2 × 2 clusters at
 * 2×, only tone at 1×.
 *
 * The sun is LEFT and in front (decision 37): left-facing edges and tops take the lit tone, right
 * faces and undersides the dark one; protrusions cast their shadow down and to the right on their
 * own wall (`wallShadowPx`, LIGHT-WATER's model). The opposite row's shade and the night light are
 * the light pass's (light.ts): here only the mask flags (SHADE for a cast shadow, DEEP for a soffit
 * or a reveal, EMIT for an emitter).
 *
 * Pure: every choice is the lot's seed hashed with a key, never an rng.
 */
import { getFont } from '../../../../../engine/font';
import { PAL_HD } from '../../../../../engine/palette-hd';
import { hash2 } from '../../../../art/paint';
import { wallShadowPx, type SunGeom, type WallShadowPx } from '../light/shadow';
import type { RowPlan } from './grammar';
import {
  AWNING,
  BLEACH,
  CURTAIN,
  DIM,
  FLOWER,
  FRESH,
  GLASS,
  GRIME,
  HARDSTONE,
  INTERIOR,
  IRON,
  isPlaster,
  ix,
  LANTERN,
  LEAF,
  LIT_WINDOW,
  M_DEEP,
  M_EMIT,
  M_LIT,
  M_SHADE,
  NEON_CYAN,
  NEON_PINK,
  PAINT,
  PANTILE,
  RED_CURTAIN,
  RED_LIGHT,
  RUST,
  SANDSTONE,
  SLATE,
  tone,
  WHITE,
  ZINC,
} from './palette';
import type { Art } from './raster';
import type { LotPlan, Opening, WindowId } from './types';

/** What the drawers of one lot share. */
export interface LotCtx {
  readonly a: Art;
  readonly l: LotPlan;
  readonly row: RowPlan;
  /** Night bake (oat-d) and the 03:00 dark set. */
  readonly night: boolean;
  readonly dark: boolean;
  readonly geom: SunGeom | null;
  /** Art columns of the lot [X0, X1) and the art y of its eaves and band top. */
  readonly X0: number;
  readonly X1: number;
  readonly eY: number;
  readonly bY: number;
  readonly wall: Uint8Array;
  readonly base: number;
  readonly joint: number;
  /** The lot's number in the plan (the light pass finds its band top per column). */
  readonly gi: number;
}

const sh: WallShadowPx = { dx: 0, dy: 0 };
const GOLD = Uint8Array.from(PAL_HD.gold.slice(1, 7).map((c) => ix(c)));
const ACCENT = [ix(PAL_HD.sky[4]), ix(PAL_HD.gold[5]), ix(PAL_HD.pink[3]), ix(PAL_HD.green[5]), ix(PAL_HD.snow[5]), ix(PAL_HD.orange[3])];
/** The shelves' heights in the shop glass (share of its height, from the foot). */
const SHELVES = [0.1, 0.36, 0.58];
/** Goods behind shop glass: muted colours (the street's saturation stays low by day: spec §8.13). */
const GOODS = [ix(PAL_HD.denim[3]), ix(PAL_HD.rust[2]), ix(PAL_HD.olive[4]), ix(PAL_HD.cloth[4]), ix(PAL_HD.sand[5]), ix(PAL_HD.brickDark[4])];
const TAG = [ix(PAL_HD.purple[3]), ix(PAL_HD.sky[2]), ix(PAL_HD.snow[4]), ix(PAL_HD.green[3])];
const SMALL = getFont('small');

/** The stone of a lot's dressings: white-painted or Bentheimer sandstone. */
function stoneOf(c: LotCtx): Uint8Array {
  return c.l.frame === 'white' ? WHITE : SANDSTONE;
}

/** Sizes in art px by density: [1×, 2×, 4×]. */
function by(a: Art, one: number, two: number, four: number): number {
  return a.d === 4 ? four : a.d === 2 ? two : one;
}

// ------------------------------------------------------------------------------------ the silhouette

/** Height of the cornice block of a cornice / plastered front (world px). */
export function corniceH(l: LotPlan): number {
  return l.gable === 'plastered' ? 7 : Math.min(9, Math.max(6, l.ridge - l.eaves - l.roofH - (l.attic ? 9 : 0)));
}
const ATTIC_H = 9;

/**
 * The silhouette's height (world px over the base) at du world px from the lot's gable axis (spec
 * §8.6 gables): step, neck (with its klauwstukken), bell, spout, cornice (with the roof's hipped
 * end and the raised attic), plastered and infill fronts.
 */
export function gableTop(l: LotPlan, du: number): number {
  const half = l.w / 2;
  const a = Math.abs(du);
  const e = l.eaves;
  const r = l.ridge;
  if (a > half) return e;
  switch (l.gable) {
    case 'lijst':
    case 'plastered': {
      const cTop = e + corniceH(l);
      let t = cTop;
      if (l.attic && a < l.w * 0.28) t = cTop + ATTIC_H;
      if (l.roofH > 0 && a < half - 2) t = Math.max(t, cTop + l.roofH * (1 - a / (half - 2)));
      return t;
    }
    case 'infill':
      return r;
    case 'none':
      return e;
    case 'trap': {
      const edge = half - a;
      let acc = 0;
      let h = e;
      for (const s of l.steps) {
        if (edge < acc + s.w) return h + s.hh;
        acc += s.w;
        h += s.hh;
      }
      return r;
    }
    case 'hals':
    case 'verhoogde-hals': {
      const nh = l.neckW / 2;
      const crown = Math.min(6, (r - e) * 0.2);
      if (a <= nh) return r - crown + crown * Math.sqrt(Math.max(0, 1 - (a / nh) ** 2));
      const t = (a - nh) / Math.max(1, half - nh);
      let h = e + (r - crown - e) * 0.62 * Math.pow(1 - t, 1.6);
      if (l.gable === 'verhoogde-hals' && t > 0.7) h = Math.max(h, e + 5);
      return h;
    }
    case 'klok': {
      const th = l.topW / 2 + 1;
      const crown = Math.min(7, (r - e) * 0.22);
      const body = r - crown;
      if (a <= th) return body + crown * Math.sqrt(Math.max(0, 1 - (a / th) ** 2));
      const t = (a - th) / Math.max(1, half - th);
      const f = 0.5 * (1 + Math.cos(Math.PI * Math.pow(t, 0.85)));
      return e + 2 + (body - e - 2) * f;
    }
    case 'tuit': {
      const sp = Math.max(4, l.topW / 2);
      if (a <= sp) return r;
      if (a > half - 3) return e + 3;
      const t = (a - sp) / Math.max(1, half - 3 - sp);
      return e + 3 + (r - 3 - e - 3) * (1 - t);
    }
  }
}

/** Is the gable zone of this type edged with stone (bell, neck), brick-on-edge (spout) or capped (step)? */
function edgeOf(c: LotCtx): number {
  const a = c.a;
  switch (c.l.gable) {
    case 'klok':
      return by(a, 1, 3, 5);
    case 'hals':
    case 'verhoogde-hals':
      return by(a, 1, 2, 3);
    case 'tuit':
      return by(a, 1, 2, 4);
    case 'trap':
      return by(a, 1, 2, 3);
    default:
      return 0;
  }
}

// ------------------------------------------------------------------------------------ the wall

/**
 * One wall px: bricks in stretcher bond with a warm recessed joint (6–8 tones per material at 4×:
 * per-brick tone spread, a lit top row on some bricks), 2 × 2 clusters at 2×, flat tone at 1×;
 * plaster and painted fronts smooth with large soft blotches. Courses are true scale in the ground
 * band and compressed above its top (the seam rule: the scale changes at the band's line).
 */
function wallPx(c: LotCtx, x: number, y: number): number {
  const a = c.a;
  const d = a.d;
  const w = c.wall;
  if (d === 1) return tone(w, c.base);
  const gx = a.gx0 + x;
  if (isPlaster(c.l.wall)) {
    // Plaster: smooth, with rare soft stains (horizontal, as weather leaves them).
    const h = hash2(gx >> 4, y >> 1, c.l.seed);
    return tone(w, c.base + (h < 0.05 ? -1 : h > 0.97 ? 1 : 0));
  }
  const upper = y >= c.bY;
  const ch = d === 4 ? (upper ? 3 : 4) : upper ? 2 : 3;
  const bl = d === 4 ? (upper ? 8 : 10) : upper ? 4 : 6;
  const yy = upper ? y - c.bY : y;
  const course = Math.floor(yy / ch);
  const cy = yy - course * ch;
  const off = (course & 1) * (bl >> 1);
  const bi = Math.floor((gx + off) / bl);
  const bx = gx + off - bi * bl;
  const painted = c.l.wall.startsWith('painted') || c.l.wall === 'brick-black';
  if (cy === 0 || (bx === 0 && (d === 4 || !upper))) {
    if (d === 2 || painted) return tone(w, c.base - 1);
    return c.joint;
  }
  const h = hash2(bi, course + (upper ? 4099 : 0), c.l.seed);
  let t = c.base;
  if (!painted) {
    if (h < 0.025) t -= 2;
    else if (h < 0.15) t -= 1;
    else if (h > 0.96) t += 2;
    else if (h > 0.76) t += 1;
  } else if (h > 0.86) t += 1;
  else if (h < 0.1) t -= 1;
  if (d === 4 && cy === ch - 1 && h > 0.35 && !painted) t += 1;
  return tone(w, t);
}

/** The silhouette scratch (reused: no allocation per paint). */
let TOP = new Int32Array(1024);

/** Fill the lot's silhouette: wall below the eaves, gable zone by type (edging, ornament, roof). */
export function drawBody(c: LotCtx): void {
  const { a, l } = c;
  const x0 = Math.max(0, c.X0);
  const x1 = Math.min(a.W, c.X1);
  if (x0 >= x1) return;
  const E = edgeOf(c);
  const st = stoneOf(c);
  const mid = l.u0 + l.w / 2 + l.tilt;
  const flat = l.gable === 'lijst' || l.gable === 'plastered';
  const cTopY = flat ? a.Y(l.eaves + corniceH(l)) : 0;
  const atticHalf = l.w * 0.28;
  // The silhouette top per column, with E columns of margin for the edge test.
  const n = x1 - x0 + 2 * E;
  if (TOP.length < n) TOP = new Int32Array(n * 2);
  const top = TOP;
  for (let i = 0; i < n; i++) {
    const x = x0 - E + i;
    if (x < c.X0 || x >= c.X1) {
      top[i] = c.eY;
      continue;
    }
    top[i] = a.Y(gableTop(l, a.uOf(x) - mid));
  }
  const yHi = a.yHi;
  for (let x = x0; x < x1; x++) {
    const i = x - x0 + E;
    const t = top[i];
    a.colLot[x] = c.gi;
    const ux = a.uOf(x);
    const far = Math.abs(ux - mid);
    const yEnd = Math.min(yHi, t);
    for (let y = a.yLo; y < yEnd; y++) {
      let v: number;
      if (y < c.eY) v = wallPx(c, x, y);
      else if (flat) {
        const du = far;
        if (y < cTopY) v = wallPx(c, x, y); // the cornice block overdraws this (drawCornice)
        else if (l.attic && du < atticHalf && y < cTopY + a.Y(ATTIC_H)) v = wallPx(c, x, y);
        else v = roofPx(c, x, y, ux < mid);
      } else {
        v = wallPx(c, x, y);
        if (E > 0) {
          // Distance to the outline: straight up, or sideways to a lower column.
          let dh = E;
          for (let k = 1; k < E; k++) {
            if (top[i - k] <= y || top[i + k] <= y) {
              dh = k;
              break;
            }
          }
          const dv = t - 1 - y;
          const leftOpen = top[i - Math.min(E - 1, 1)] <= y;
          if (l.gable === 'trap') {
            // Stone caps on the steps (the step sides stay brick).
            if (dv < E) v = tone(st, 5 + (dv === 0 ? 1 : 0));
          } else if (l.gable === 'tuit') {
            if (dv < E || dh < E) v = (y + (a.gx0 + x)) % 3 === 0 && a.d > 1 ? c.joint : tone(c.wall, c.base + (leftOpen ? 1 : -1 + 1));
          } else if (dv < E || dh < E) {
            v = tone(st, (leftOpen ? 6 : dh < E && top[i + 1] <= y ? 3 : 5) - (dv === 0 ? 0 : 0));
          }
          // The klauwstukken: carved sandstone between the neck and the shoulders.
          if ((l.gable === 'hals' || l.gable === 'verhoogde-hals') && dv >= E && far > l.neckW / 2) {
            const g = Math.floor((a.gx0 + x) * 0.7 + y * 1.3) % (a.d === 4 ? 5 : 3);
            v = tone(st, g === 0 && a.d > 1 ? 3 : leftOpen ? 6 : 4);
          }
        }
      }
      const o = a.at(x, y);
      a.idx[o] = v;
      a.mask[o] = M_LIT;
    }
  }
}

/** A roof px (the hipped end behind a cornice): slate or pan tiles, the left slope lit. */
function roofPx(c: LotCtx, x: number, y: number, left: boolean): number {
  const a = c.a;
  const r = c.l.seed & 1 ? SLATE : PANTILE;
  const course = a.d === 4 ? 3 : 2;
  const t = (left ? 3 : 1) + (a.d > 1 && y % course === 0 ? -1 : 0) + (hash2((a.gx0 + x) >> 2, y >> 1, c.l.seed) > 0.8 ? 1 : 0);
  return tone(r, t);
}

// ------------------------------------------------------------------------------------ cornices, caps, crowns

/** The cornice of a cornice gable (white-painted wood or stone; dentils and consoles at 4×), its soffit and cast shadow. */
export function drawCornice(c: LotCtx): void {
  const { a, l } = c;
  if (l.gable !== 'lijst' && l.gable !== 'plastered' && l.gable !== 'infill') return;
  const ramp = l.gable === 'plastered' ? c.wall : l.gable === 'infill' ? HARDSTONE : l.frame === 'sandstone' ? SANDSTONE : WHITE;
  const lit = l.gable === 'infill' ? 4 : ramp.length - 2;
  if (l.gable === 'infill') {
    const y0 = a.Y(l.ridge) - by(a, 1, 2, 4);
    a.rect(c.X0, y0, c.X1, a.Y(l.ridge), tone(ramp, lit));
    return;
  }
  const y0 = c.eY;
  const y1 = a.Y(l.eaves + corniceH(l));
  const hh = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const f = (y - y0 + 0.5) / hh;
    for (let x = c.X0 - 1; x < c.X1 + 1; x++) {
      if (x < 0 || x >= a.W) continue;
      let t: number;
      let m = M_LIT;
      if (f < 0.14) {
        t = lit - 3;
        m = M_DEEP; // the soffit
      } else if (f < 0.34) {
        t = a.d === 4 && ((a.gx0 + x) >> 1) % 3 === 0 ? lit - 3 : lit - 1; // dentils
      } else if (f < 0.62) t = lit;
      else if (f < 0.74) t = lit - 2;
      else t = f > 0.9 ? lit + 1 : lit;
      a.put(x, y, tone(ramp, t), m);
    }
  }
  // Consoles at the ends (a lit left face, a dark right one).
  const cw = by(a, 1, 2, 4);
  const below = by(a, 2, 4, 9);
  for (const xs of [c.X0, c.X1 - cw]) {
    a.rect(xs, y0 - below, xs + cw, y1, tone(ramp, lit - 1));
    a.rect(xs, y0 - below, xs + 1, y1, tone(ramp, lit + 1));
  }
  // The attic's own small cornice and window.
  if (l.attic) {
    const mid = l.u0 + l.w / 2 + l.tilt;
    const ax0 = a.X(mid - l.w * 0.28);
    const ax1 = a.X(mid + l.w * 0.28);
    const at = y1 + a.Y(ATTIC_H);
    a.rect(ax0 - 1, at - by(a, 1, 2, 3), ax1 + 1, at, tone(ramp, lit));
    a.rect(ax0, at - by(a, 1, 2, 3) - 1, ax1, at - by(a, 1, 2, 3), tone(ramp, lit - 3), M_DEEP);
  }
  // The cornice's shadow on the wall below (down-right).
  if (c.geom) {
    const p = l.protrusions.find((q) => q.kind === 'cornice');
    wallShadowPx(c.geom, p ? p.depthM : 0.5, l.eaves, l.bandTop, sh);
    a.shadow(a.X(l.u0 + sh.dx), a.Y(l.eaves - sh.dy), a.X(l.u0 + l.w + sh.dx), y0 - (a.d > 1 ? 0 : 0), M_SHADE);
  }
}

/** Caps and crowns of the stone-edged gables: a finial on a step gable, a pediment on neck and bell, the spout's cap. */
export function drawCrown(c: LotCtx): void {
  const { a, l } = c;
  const st = stoneOf(c);
  const mid = l.u0 + l.w / 2 + l.tilt;
  const top = a.Y(l.ridge);
  if (l.gable === 'trap') {
    // A small stone finial on the top step, ball on a post.
    const fx = a.X(mid);
    const fw = by(a, 1, 1, 2);
    a.rect(fx - fw, top, fx + fw, top + by(a, 1, 2, 5), tone(st, 5));
    a.rect(fx - fw - 1, top + by(a, 1, 2, 5), fx + fw + 1, top + by(a, 2, 3, 8), tone(st, 6));
  } else if (l.gable === 'tuit') {
    const sp = Math.max(4, l.topW / 2);
    a.rect(a.X(mid - sp - 1), top - by(a, 1, 2, 3), a.X(mid + sp + 1), top, tone(st, 6));
  } else if (l.gable === 'hals' || l.gable === 'verhoogde-hals' || l.gable === 'klok') {
    // The crown's cornice band at the foot of the pediment.
    const hw = (l.gable === 'klok' ? l.topW / 2 + 2 : l.neckW / 2 + 1) + 0.5;
    const crown = Math.min(l.gable === 'klok' ? 7 : 6, (l.ridge - l.eaves) * (l.gable === 'klok' ? 0.22 : 0.2));
    const y = a.Y(l.ridge - crown);
    a.rect(a.X(mid - hw), y - by(a, 1, 1, 2), a.X(mid + hw), y + by(a, 0, 1, 1), tone(st, 6));
    a.rect(a.X(mid - hw), y - by(a, 1, 2, 3), a.X(mid + hw), y - by(a, 1, 1, 2), tone(st, 2), M_DEEP);
  }
}

// ------------------------------------------------------------------------------------ windows

/**
 * One window (spec §8.6 "Windows"): its frame (white or sandstone), the reveal's shadow inside the
 * opening (down-right of the left jamb and the head), the glass (net curtains, a dark interior or
 * the sky's sheen), the glazing of its type (12-pane and 2-over-2 sashes, big panes, casements under
 * a transom, the cross frame with its shutters, stacked loading doors with hourglass shutters, thin
 * modern frames), the stone sill with its shadow and a relieving arch of bricks on edge above it.
 * `lit` (night): the warm glow of an inhabited room through its curtain.
 */
export function drawWindow(c: LotCtx, o: Opening, kind: WindowId, key: number, lit: boolean, dx = 0): void {
  const { a, l } = c;
  const x0 = a.X(o.u + dx);
  const x1 = Math.max(x0 + 3, a.X(o.u + o.w + dx));
  const y0 = a.Y(o.h);
  const y1 = Math.max(y0 + 4, a.Y(o.h + o.hh));
  const fr = kind === 'kruis' ? SANDSTONE : l.frame === 'white' ? WHITE : SANDSTONE;
  const sash = PAINT[l.sashPaint];
  const f = kind === 'modern' ? 1 : by(a, 1, 1, 2);
  const brick = !isPlaster(l.wall);
  // Relieving arch (bricks on edge) or a plaster lintel above; the stone sill below.
  const ah = by(a, 1, 2, 4);
  if (kind !== 'modern') {
    for (let x = x0 - 1; x < x1 + 1; x++)
      for (let y = y1; y < y1 + ah; y++) {
        const v = brick && a.d > 1 ? ((a.gx0 + x) % 2 === 0 ? c.joint : tone(c.wall, c.base + ((a.gx0 + x) % 6 === 1 ? 1 : 0))) : tone(c.wall, c.base + 1);
        a.put(x, y, v);
      }
  }
  // The frame.
  a.rect(x0, y0, x1, y1, tone(fr, fr.length - 2));
  a.rect(x0, y0, x0 + 1, y1, tone(fr, fr.length - 1));
  a.rect(x0, y1 - 1, x1, y1, tone(fr, fr.length - 1));
  a.rect(x1 - 1, y0, x1, y1 - 1, tone(fr, fr.length - 4));
  const ix0 = x0 + f;
  const ix1 = x1 - f;
  const iy0 = y0 + f;
  const iy1 = y1 - f;
  if (ix1 <= ix0 || iy1 <= iy0) return;
  const h = hash2(key, 7, l.seed);
  const W = ix1 - ix0;
  const Hh = iy1 - iy0;
  // Glass.
  if (kind === 'loading') {
    drawShutterPair(c, ix0, iy0, ix1, iy1, l.shutters ?? 'green');
  } else {
    const curtain = !lit && h < 0.5;
    for (let y = iy0; y < iy1; y++) {
      const fy = (y - iy0) / Hh;
      for (let x = ix0; x < ix1; x++) {
        let v: number;
        let m = M_LIT;
        if (lit) {
          const fold = a.d > 1 && (a.gx0 + x) % (a.d === 4 ? 3 : 2) === 0 ? 1 : 0;
          v = tone(LIT_WINDOW, 2 + (fy > 0.5 ? 1 : 0) - fold);
          m = M_EMIT;
        } else if (curtain && fy < 0.72) {
          const fold = a.d > 1 && (a.gx0 + x) % (a.d === 4 ? 4 : 2) === 0 ? 1 : 0;
          v = tone(CURTAIN, 3 - fold - (fy < 0.06 ? 1 : 0));
        } else if (h > 0.82) {
          v = tone(GLASS, fy > 0.55 ? 4 : 3); // the sky's sheen
        } else {
          v = tone(GLASS, fy > 0.6 ? 2 : 1);
          if (a.d === 4 && h > 0.68 && Math.abs((x - ix0) - (y - iy0) * 0.6 - W * 0.5) < 1) v = tone(GLASS, 3); // a reflection
        }
        a.put(x, y, v, m);
      }
    }
  }
  // Glazing.
  const bar = tone(sash, sash.length - 2);
  const barD = tone(sash, Math.max(0, sash.length - 4));
  const mx = (ix0 + ix1) >> 1;
  const my = (iy0 + iy1) >> 1;
  const rail = by(a, 1, 1, 2);
  switch (kind) {
    case 'sash-12':
    case 'sash-2-2':
    case 'sash-1-1': {
      a.rect(ix0, my, ix1, my + rail, bar);
      if (a.d > 1) {
        // The sashes' own frames (inner).
        a.rect(ix0, iy0, ix1, iy0 + 1, barD);
        a.rect(ix0, iy1 - 1, ix1, iy1, bar);
      }
      if (kind === 'sash-12' && a.d > 1) {
        for (const fx of [1 / 3, 2 / 3]) a.rect(ix0 + Math.round(W * fx), iy0, ix0 + Math.round(W * fx) + 1, iy1, bar);
        for (const fy of [0.25, 0.75]) a.rect(ix0, iy0 + Math.round(Hh * fy), ix1, iy0 + Math.round(Hh * fy) + 1, bar);
      } else if (kind === 'sash-2-2' && a.d > 1) a.rect(mx, iy0, mx + 1, iy1, bar);
      break;
    }
    case 'casement': {
      const ty = iy0 + Math.round(Hh * 0.68);
      a.rect(ix0, ty, ix1, ty + rail, bar);
      a.rect(mx, iy0, mx + rail, ty, bar);
      break;
    }
    case 'kruis': {
      // The cross frame (sandstone), leaded upper lights, shutters over the lower ones.
      const ty = iy0 + Math.round(Hh * 0.58);
      const cr = by(a, 1, 1, 2);
      const sp = PAINT[l.shutters ?? 'red'];
      for (let y = iy0; y < ty; y++)
        for (let x = ix0; x < ix1; x++) {
          const v = tone(sp, 2 + ((x - ix0) % Math.max(2, (W >> 1)) === 0 ? 1 : 0));
          a.put(x, y, a.d === 4 && (y - iy0) % 4 === 0 ? tone(sp, 1) : v);
        }
      if (a.d === 4)
        for (let y = ty; y < iy1; y++) for (let x = ix0; x < ix1; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) a.put(x, y, tone(GLASS, 0));
      a.rect(ix0, ty, ix1, ty + cr, tone(fr, fr.length - 2));
      a.rect(mx, iy0, mx + cr, iy1, tone(fr, fr.length - 2));
      break;
    }
    case 'modern': {
      const ty = iy0 + Math.round(Hh * 0.7);
      a.rect(ix0, ty, ix1, ty + 1, tone(PAINT.black, 2));
      break;
    }
    case 'loading':
      break;
  }
  // The reveal: the left jamb and the head cast into the opening (down-right; spec §8.4).
  if (c.geom && kind !== 'loading') {
    wallShadowPx(c.geom, 0.09, o.h + o.hh, l.bandTop, sh);
    const rw = Math.max(1, a.L(sh.dx * 0.5, 1));
    const rh = Math.max(1, a.L(sh.dy * 0.5, 1));
    a.shadow(x0 + 1, y0, Math.min(x1, x0 + 1 + rw), y1 - 1, M_SHADE);
    a.shadow(x0 + 1, Math.max(y0, y1 - 1 - rh), x1, y1 - 1, M_SHADE);
  } else if (!c.geom) {
    a.shadow(x0 + 1, y0, x0 + 2, y1 - 1, M_DEEP);
  }
  // The sill (lit top), and its shadow below (down-right).
  const sh0 = by(a, 1, 1, 2);
  const sill = l.frame === 'white' ? WHITE : SANDSTONE;
  a.rect(x0 - 1, y0 - sh0, x1 + 1, y0, tone(sill, sill.length - 3));
  a.rect(x0 - 1, y0 - 1, x1 + 1, y0, tone(sill, sill.length - 1));
  if (c.geom) {
    wallShadowPx(c.geom, 0.07, o.h, l.bandTop, sh);
    a.shadow(x0 + a.L(sh.dx, 1), y0 - sh0 - a.L(sh.dy, 1), x1 + 1 + a.L(sh.dx, 1), y0 - sh0, M_SHADE);
  }
}

/** Two hourglass shutters (warehouse loading doors; spec §8.6): a frame, two leaves, the hourglass in a second tone. */
function drawShutterPair(c: LotCtx, x0: number, y0: number, x1: number, y1: number, paint: keyof typeof PAINT): void {
  const a = c.a;
  const p = PAINT[paint];
  const mx = (x0 + x1) >> 1;
  const H = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const fy = Math.abs((y - y0 + 0.5) / H - 0.5) * 2; // 0 at the waist, 1 at top and bottom
    for (let x = x0; x < x1; x++) {
      const left = x < mx;
      const fx = left ? (x - x0 + 0.5) / (mx - x0) : (x - mx + 0.5) / (x1 - mx);
      const inGlass = Math.abs(fx - 0.5) * 2 < fy;
      let v = tone(p, inGlass ? 3 : 1);
      if (x === x0 || x === mx) v = tone(p, 4);
      if (x === mx - 1 || x === x1 - 1) v = tone(p, 0);
      a.put(x, y, v);
    }
  }
}

/** The upper storeys' windows (with the lot's tilt), and their night glow. */
export function drawStoreys(c: LotCtx): void {
  const { l } = c;
  for (let k = 0; k < l.storeys.length; k++) {
    const s = l.storeys[k];
    const dx = l.tilt === 0 ? 0 : Math.round((l.tilt * (s.h + s.hh / 2)) / Math.max(1, l.ridge));
    for (let b = 0; b < s.windows.length; b++) {
      const lit = c.night && ((l.lit[k] ?? 0) & (1 << b)) !== 0 && (!c.dark || hash2(k, b, l.seed) < 0.35);
      const o = s.windows[b];
      const kind = l.window === 'loading' && o.w > s.windows[0].w && s.windows.length > 1 ? 'loading' : l.window === 'loading' ? 'sash-2-2' : l.window;
      drawWindow(c, o, l.window === 'loading' && s.windows.length === 1 ? 'loading' : kind, k * 16 + b, lit, dx);
    }
  }
  for (let g = 0; g < l.gableWindows.length; g++) {
    const o = l.gableWindows[g];
    const lit = c.night && !c.dark && hash2(g, 91, l.seed) < 0.2;
    drawWindow(c, o, l.window === 'loading' && g === 0 ? 'loading' : l.window === 'kruis' ? 'kruis' : 'casement', 200 + g, lit, l.tilt);
  }
}

// ------------------------------------------------------------------------------------ the ground band

/** The seam line at the band top (spec §8.2): the shop front's beam, a stone string course, the stoep door's lintel band. */
export function drawSeam(c: LotCtx): void {
  const { a, l } = c;
  const y1 = c.bY;
  const y0 = y1 - by(a, 1, 2, 5);
  if (l.seam === 'beam') {
    const r = PAINT[l.ground === 'bar' || l.ground === 'frames' ? 'black' : 'white'];
    a.rect(c.X0, y0, c.X1, y1, tone(r, r.length - 2));
    a.rect(c.X0, y1 - 1, c.X1, y1, tone(r, r.length - 1));
    a.rect(c.X0, y0, c.X1, y0 + 1, tone(r, Math.max(0, r.length - 4)), M_DEEP);
  } else {
    const st = l.seam === 'string' ? HARDSTONE : stoneOf(c);
    a.rect(c.X0, y0 + 1, c.X1, y1, tone(st, st.length - 3));
    a.rect(c.X0, y1 - 1, c.X1, y1, tone(st, st.length - 1));
  }
  if (c.geom) {
    const p = l.protrusions.find((q) => q.kind === 'beam' || q.kind === 'string');
    wallShadowPx(c.geom, p ? p.depthM : 0.1, l.bandTop - 2, l.bandTop, sh);
    a.shadow(a.X(l.u0 + sh.dx), y0 - a.L(sh.dy, 1), a.X(l.u0 + l.w + sh.dx), y0, M_SHADE);
  }
}

/** The hardstone plinth at the wall's foot. */
function plinth(c: LotCtx, x0: number, x1: number): void {
  const a = c.a;
  const ph = a.Y(3);
  a.rect(x0, 0, x1, ph, tone(HARDSTONE, 3));
  a.rect(x0, ph - 1, x1, ph, tone(HARDSTONE, 5));
}

/**
 * A door (spec §8.6): the frame, the panelled leaf in the lot's paint (lit left edges, dark right),
 * the brass letter slot, the fanlight with its carved centre post, the stone step.
 */
function drawDoor(c: LotCtx, o: Opening, fan: number, glazed: boolean): void {
  const { a, l } = c;
  const x0 = a.X(o.u);
  const x1 = a.X(o.u + o.w);
  const y0 = a.Y(o.h);
  const y1 = a.Y(o.h + o.hh);
  const fr = l.frame === 'white' ? WHITE : SANDSTONE;
  const p = PAINT[l.doorPaint];
  const f = by(a, 1, 1, 2);
  a.rect(x0, y0, x1, y1 + (fan > 0 ? a.Y(fan) : 0), tone(fr, fr.length - 2));
  a.rect(x0, y0, x0 + 1, y1, tone(fr, fr.length - 1));
  // The leaf.
  const lx0 = x0 + f;
  const lx1 = x1 - f;
  const W = lx1 - lx0;
  for (let y = y0; y < y1 - f; y++)
    for (let x = lx0; x < lx1; x++) {
      const fx = (x - lx0) / W;
      const fy = (y - y0) / (y1 - y0);
      let t = 2;
      if (glazed && fy > 0.42 && fy < 0.92 && fx > 0.16 && fx < 0.84) {
        a.put(x, y, tone(GLASS, fy > 0.75 ? 2 : 1));
        continue;
      }
      // Two raised panels (4×, 2×): a lit left/top edge, a dark right/bottom edge.
      if (a.d > 1 && !glazed) {
        const inP = (fx > 0.14 && fx < 0.44) || (fx > 0.56 && fx < 0.86);
        const inY = (fy > 0.08 && fy < 0.42) || (fy > 0.52 && fy < 0.9);
        if (inP && inY) t = 3;
        const xl = fx > 0.13 && fx < 0.16 ? 1 : fx > 0.55 && fx < 0.58 ? 1 : 0;
        const xr = (fx > 0.42 && fx < 0.45) || (fx > 0.84 && fx < 0.87) ? 1 : 0;
        if (inY && xl) t = 4;
        if (inY && xr) t = 1;
      }
      a.put(x, y, tone(p, t));
    }
  a.rect(lx1 - 1, y0, lx1, y1 - f, tone(p, 0));
  // The brass letter slot and the knob.
  if (a.d > 1) {
    const sy = y0 + Math.round((y1 - y0) * 0.48);
    a.rect(lx0 + Math.round(W * 0.3), sy, lx0 + Math.round(W * 0.7), sy + by(a, 1, 1, 2), tone(GOLD, 3));
    a.rect(lx0 + Math.round(W * 0.5), sy + by(a, 1, 3, 6), lx0 + Math.round(W * 0.5) + by(a, 1, 1, 2), sy + by(a, 1, 4, 8), tone(GOLD, 4));
  }
  // The fanlight with its carved centre post (levensboom) and two bars.
  if (fan > 0) {
    const fy0 = y1;
    const fy1 = y1 + a.Y(fan) - f;
    const fmx = (lx0 + lx1) >> 1;
    for (let y = fy0; y < fy1; y++)
      for (let x = lx0; x < lx1; x++) {
        const lit = c.night && !c.dark && hash2(1, 2, l.seed) < 0.4;
        a.put(x, y, lit ? tone(LIT_WINDOW, 2) : tone(GLASS, y > (fy0 + fy1) / 2 ? 2 : 1), lit ? M_EMIT : M_LIT);
      }
    const pw = by(a, 1, 1, 2);
    a.rect(fmx - (pw >> 1), fy0, fmx - (pw >> 1) + pw, fy1, tone(fr, fr.length - 3));
    if (a.d > 1) {
      a.line(fmx, fy0, lx0, fy1 - 1, tone(fr, fr.length - 2));
      a.line(fmx, fy0, lx1 - 1, fy1 - 1, tone(fr, fr.length - 2));
    }
  }
  // The reveal's shadow in the opening.
  if (c.geom) {
    wallShadowPx(c.geom, 0.15, o.h + o.hh, l.bandTop, sh);
    a.shadow(x0 + 1, y0, x0 + 1 + a.L(sh.dx * 0.5), y1, M_SHADE);
  }
  // The step.
  if (o.h > 0 && o.h < 8) {
    a.rect(x0 - 1, 0, x1 + 1, y0, tone(HARDSTONE, 4));
    a.rect(x0 - 1, y0 - 1, x1 + 1, y0, tone(HARDSTONE, 6));
  }
}

/** Fascia letters (the font's small glyphs, our product words), or a tone stroke at 1×. */
function letters(c: LotCtx, word: string, cx: number, cy: number, ramp: Uint8Array, t: number, m: number): void {
  const a = c.a;
  if (!word) return;
  if (a.d === 1) {
    const w = word.length * 2;
    a.rect(cx - (w >> 1), cy, cx - (w >> 1) + w, cy + 1, tone(ramp, t), m);
    return;
  }
  const k = a.d === 4 ? 2 : 1;
  const gw = (SMALL.maxW + 1) * k;
  let total = 0;
  for (const ch of word) total += (SMALL.glyph(ch.charCodeAt(0)).w + 1) * k;
  let x = cx - (total >> 1);
  const gh = SMALL.ascent * k;
  const y0 = cy + (gh >> 1);
  for (const ch of word) {
    const g = SMALL.glyph(ch.charCodeAt(0));
    for (let r = 0; r < SMALL.ascent; r++) {
      const bits = g.rows[r];
      for (let col = 0; col < g.w; col++) {
        if (((bits >> (g.w - 1 - col)) & 1) === 0) continue;
        for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) a.put(x + col * k + xx, y0 - r * k - yy, tone(ramp, t + (yy === 0 && r === 0 ? 1 : 0)), m);
      }
    }
    x += (g.w + 1) * k;
  }
  void gw;
}

/** The ground band of a lot by its kind. */
export function drawGround(c: LotCtx): void {
  const { l } = c;
  switch (l.ground) {
    case 'shop':
    case 'slot':
    case 'bar':
      drawShop(c);
      break;
    case 'stoep':
      plinth(c, c.X0, c.X1);
      for (let i = 0; i < l.groundWindows.length; i++) drawWindow(c, l.groundWindows[i], l.window === 'kruis' ? 'kruis' : 'sash-12', 100 + i, c.night && hash2(i, 77, l.seed) < 0.3);
      drawDoor(c, l.door, l.fanlight, false);
      drawStoep(c);
      break;
    case 'flat':
      plinth(c, c.X0, c.X1);
      for (let i = 0; i < l.groundWindows.length; i++) drawWindow(c, l.groundWindows[i], l.window === 'kruis' ? 'kruis' : l.window === 'modern' ? 'modern' : 'sash-2-2', 100 + i, c.night && hash2(i, 77, l.seed) < 0.3);
      drawDoor(c, l.door, l.fanlight, false);
      if (l.door2) drawDoor(c, l.door2, l.fanlight, false);
      break;
    case 'warehouse':
      plinth(c, c.X0, c.X1);
      for (const o of l.groundWindows) {
        const a = c.a;
        const x0 = a.X(o.u);
        const x1 = a.X(o.u + o.w);
        const y0 = a.Y(o.h);
        const y1 = a.Y(o.h + o.hh);
        a.rect(x0 - 1, y0, x1 + 1, y1 + 1, tone(SANDSTONE, 4));
        drawShutterPair(c, x0, y0, x1, y1, l.shutters ?? 'green');
      }
      drawDoor(c, l.door, 0, false);
      break;
    case 'frames':
      drawFrames(c);
      break;
  }
}

/** The interior recipes of the shop glass, keyed by the shop's word (spec §8.13 Variety, §8.6 goods by trade). */
type Recipe = 'shelves' | 'stands' | 'lamps' | 'bins' | 'walls';
const RECIPE: Readonly<Record<string, Recipe>> = {
  HOEDEN: 'stands',
  TASSEN: 'stands',
  LAMPEN: 'lamps',
  PLATEN: 'bins',
  VINTAGE: 'bins',
  GALERIE: 'walls',
  PAPIER: 'walls',
  ANTIEK: 'walls',
  BRILLEN: 'walls',
  SIERADEN: 'walls',
  KAPPER: 'walls',
};

/**
 * One art px of a shop interior seen through the glass (2× / 4×): (px, py) from the window's lower
 * left in art px, h its height, u art px per logical px, `lit` the lamps on inside. Returns a set
 * index, or −1 for the plain back wall. Recipes: `stands` (hats or bags on stands over a table),
 * `lamps` (lamps hanging on cords, their bulbs lit), `bins` (record crates with sleeves and covers on
 * the wall, or a clothes rail), `walls` (frames on a light wall: pictures, mirrors, small cards). The
 * `shelves` recipe (jars and bottles) stays in `drawShop`.
 */
function shopInterior(k: Recipe, word: string, px: number, py: number, h: number, u: number, seed: number, lit: boolean): number {
  const x = px / u;
  const y = py / u;
  const H = h / u;
  const lift = lit ? 2 : 0;
  // A display table at the foot (stands, walls), its lit top edge.
  const table = k === 'stands' || k === 'walls' ? H * 0.14 : 0;
  if (y < table) return tone(INTERIOR, (y > table - 0.75 ? 4 : 2) + lift * 0.5);
  if (k === 'stands') {
    const i = Math.floor((x - 1.5) / 8);
    const cx = 1.5 + i * 8 + 4;
    const top = H * (0.36 + 0.16 * hash2(i, 41, seed));
    const dx = x - cx;
    const c = GOODS[Math.floor(hash2(i, 43, seed) * GOODS.length)];
    if (word === 'TASSEN') {
      // A bag on a stand: the body, a handle arc above it.
      if (Math.abs(dx) < 2.6 && y > top - 1.2 && y < top + 3.4) return dx < -1.6 ? tone(INTERIOR, 4) : c;
      const r = Math.hypot(dx, (y - top - 3.4) * 1.2);
      if (y > top + 3.4 && r > 1.3 && r < 2) return tone(INTERIOR, 4);
    } else {
      // A hat on a head stand: the crown (rounded) and the brim, lit from the left.
      if (Math.abs(dx) < 2.1 - Math.max(0, y - top - 2) * 0.6 && y > top + 0.4 && y < top + 2.9) return dx < -0.9 ? tone(INTERIOR, 5) : c;
      if (Math.abs(dx) < 3.6 && y > top && y < top + 0.6) return c;
      if (Math.abs(dx) < 1.4 && y > top - 2.2 && y <= top) return tone(INTERIOR, 3 + lift * 0.5);
    }
    if (Math.abs(dx) < Math.max(0.5, 1 / u) && y < top) return tone(INTERIOR, 4);
    // Hat boxes on a high shelf.
    if (y > H * 0.64 && y < H * 0.64 + 3 && hash2(Math.floor(x / 5), 47, seed) < 0.6 && x % 5 < 4) return GOODS[Math.floor(hash2(Math.floor(x / 5), 49, seed) * GOODS.length)];
    return -1;
  }
  if (k === 'lamps') {
    const i = Math.floor(x / 7);
    const cx = i * 7 + 3.5;
    const hang = H * (0.42 + 0.3 * hash2(i, 51, seed));
    const dx = x - cx;
    // The shade (wider at its foot), the bulb under it, the glow on the back wall, the cord.
    if (y > hang - 3 && y <= hang && Math.abs(dx) < 1.1 + (hang - y) * 0.8) return dx < -0.6 ? tone(INTERIOR, 5) : GOODS[Math.floor(hash2(i, 53, seed) * GOODS.length)];
    if (y > hang - 4 && y <= hang - 3 && Math.abs(dx) < 1) return tone(LANTERN, 3);
    if (Math.abs(dx) < Math.max(0.25, 1 / u) && y > hang && y < H * 0.8) return tone(INTERIOR, 0);
    const g = Math.hypot(dx, (y - hang + 4) * 1.3);
    if (g < 5) return tone(INTERIOR, g < 2.5 ? 5 : 4);
    return -1;
  }
  if (k === 'bins') {
    if (word === 'VINTAGE') {
      // A clothes rail: the bar, garments hanging from it in muted colours.
      const rail = H * 0.66;
      if (y > rail && y < rail + 0.6) return tone(IRON, 3);
      const i = Math.floor(x / 2.6);
      const len = 9 + 5 * hash2(i, 55, seed);
      const fx = x - i * 2.6;
      if (y < rail && y > rail - len && fx > 0.2 && fx < 2.4 - (y > rail - 1 ? 0.6 : 0)) return fx < 0.7 ? tone(INTERIOR, 4) : GOODS[Math.floor(hash2(i, 57, seed) * GOODS.length)];
      return -1;
    }
    // Record crates at the foot, sleeves standing in them; covers on the back wall.
    const crate = H * 0.26;
    if (y < crate) return tone(INTERIOR, (y > crate - 0.75 ? 4 : 2) + lift * 0.5);
    const j = Math.floor(x / 1.2);
    if (y < crate + 2.4 + 1.2 * hash2(j, 59, seed) && x % 1.2 < 0.9) return hash2(j, 61, seed) < 0.5 ? GOODS[Math.floor(hash2(j, 63, seed) * GOODS.length)] : tone(INTERIOR, 1 + (j & 1) * 2);
    const ci = Math.floor(x / 7);
    const cx = x - ci * 7;
    if (y > H * 0.48 && y < H * 0.48 + 5.5 && cx > 0.8 && cx < 6.3) return y < H * 0.48 + 1.8 ? ACCENT[Math.floor(hash2(ci, 65, seed) * ACCENT.length)] : GOODS[Math.floor(hash2(ci, 67, seed) * GOODS.length)];
    return -1;
  }
  // walls: a light wall with frames: two big pictures in a gallery, small frames (mirrors, cards,
  // spectacles, jewellery boards) elsewhere.
  const big = word === 'GALERIE';
  const sw = big ? 14 : 6;
  const shh = big ? 12 : 6;
  const i = Math.floor(x / sw);
  const fx = x - i * sw;
  const y0 = big ? H * 0.32 : H * 0.24 + Math.floor((y - H * 0.24) / (shh + 2)) * (shh + 2);
  const fy = y - y0;
  if (y > H * 0.24 && y < H * 0.76 && fx > 1 && fx < sw - 1 && fy > 0 && fy < shh) {
    if (fx < 1.8 || fx > sw - 1.8 || fy < 0.8 || fy > shh - 0.8) return tone(word === 'KAPPER' || word === 'BRILLEN' ? IRON : INTERIOR, word === 'KAPPER' || word === 'BRILLEN' ? 3 : 5);
    if (word === 'KAPPER') return tone(GLASS, fy > shh * 0.6 ? 4 : 3);
    // A muted picture: a sky or a light ground over a darker field (an accent on the small cards).
    if (fy > shh * (0.45 + 0.2 * hash2(i, 71, seed))) return big || hash2(i, 73, seed) < 0.6 ? (hash2(i, 77, seed) < 0.5 ? tone(WHITE, 3 + lift * 0.5) : GOODS[0]) : ACCENT[Math.floor(hash2(i, 73, seed) * ACCENT.length)];
    return GOODS[1 + Math.floor(hash2(i, 75, seed) * (GOODS.length - 1))];
  }
  return tone(WHITE, 2 + lift);
}

/**
 * The shop front (spec §8.6): a white-painted wooden pui with thin columns, the glass from 0.4 to 3.0
 * m (52 px) with the interior behind (shelves and goods; warm and lit at night in a bar), the
 * panelled plinth, the fascia with painted letters, a glazed door, an awning (striped or plain)
 * with its big shadow, a hanging sign on an iron bracket. `slot`: a plain dark front for a decor
 * sprite on top (STREET-A's shops).
 */
function drawShop(c: LotCtx): void {
  const { a, l } = c;
  const bar = l.ground === 'bar';
  const slot = l.ground === 'slot';
  // The pui: white-painted wood mostly; some in the door's colour (a green, black or oxblood front).
  const pui = bar || slot ? PAINT.black : (l.seed >>> 8) % 5 < 2 && l.doorPaint !== 'wood' ? PAINT[l.doorPaint] : PAINT.white;
  const pl = pui.length - 2;
  const top = c.bY - by(a, 1, 2, 5);
  a.rect(c.X0, 0, c.X1, top, tone(pui, pl));
  a.rect(c.X0, 0, c.X0 + by(a, 1, 1, 2), top, tone(pui, pl + 1));
  // The fascia above the glass, with its letters.
  const fy0 = a.Y(60);
  const fp = PAINT[l.doorPaint === 'wood' ? 'green' : l.doorPaint];
  if (top - fy0 > 2) {
    a.rect(c.X0 + by(a, 1, 1, 2), fy0 + 1, c.X1 - by(a, 1, 1, 2), top - 1, tone(fp, 2));
    a.rect(c.X0 + by(a, 1, 1, 2), top - 2, c.X1 - by(a, 1, 1, 2), top - 1, tone(fp, 3));
    const word = slot ? '' : bar && c.night ? '' : l.shopWord;
    letters(c, word, (c.X0 + c.X1) >> 1, (fy0 + top) >> 1, bar ? LANTERN : GOLD, bar ? 1 : 3, M_LIT);
  }
  // Glass with the interior: the recipe by the shop's word; about a third of the interiors lit by day.
  const glow = bar && c.night && !c.dark;
  const recipe: Recipe = bar ? 'shelves' : (RECIPE[l.shopWord] ?? 'shelves');
  for (let i = 0; i < l.groundWindows.length; i++) {
    const o = l.groundWindows[i];
    const x0 = a.X(o.u) + by(a, 1, 1, 2);
    const x1 = a.X(o.u + o.w) - by(a, 1, 1, 2);
    const y0 = a.Y(o.h);
    const y1 = a.Y(o.h + o.hh);
    const lit = !c.night && !slot && (recipe === 'lamps' || hash2(i, 31, l.seed) < 0.34);
    for (let y = y0; y < y1; y++) {
      const fy = (y - y0) / (y1 - y0);
      for (let x = x0; x < x1; x++) {
        const fx = (x - x0) / Math.max(1, x1 - x0);
        let v: number;
        let m = lit ? M_EMIT : M_LIT;
        if (slot) v = tone(GLASS, fy > 0.7 ? 2 : 1);
        else if (recipe !== 'shelves' && !glow && !c.night && fy <= 0.8) {
          if (a.d === 1) v = tone(INTERIOR, (fy < 0.12 ? 2 : 1) + (lit ? 2 : 0));
          else {
            const r = shopInterior(recipe, l.shopWord, x - x0, y - y0, y1 - y0, a.d, l.seed, lit);
            v = r >= 0 ? r : tone(INTERIOR, (fy < 0.12 ? 2 : 1) + (lit ? 2 : 0));
          }
        } else {
          // The interior (4× / 2×): a dark back wall, three shelves with goods standing on them in
          // small clusters, a display table at the foot; the upper glass mirrors the sky.
          const gx = a.gx0 + x;
          const cw = a.d === 4 ? 7 : 4;
          const cell = Math.floor(gx / cw);
          let shelf = -1;
          for (const sy of SHELVES) if (fy >= sy - 0.02 && fy < sy + 0.13) shelf = sy;
          const onShelf = a.d > 1 && SHELVES.some((sy) => Math.abs(fy - sy) < 0.018);
          let good = false;
          let gv = 0;
          if (a.d > 1 && shelf >= 0 && !onShelf) {
            const g = hash2(cell, Math.round(shelf * 100), l.seed);
            const inCell = gx - cell * cw < Math.max(2, Math.round(cw * (0.45 + g * 0.5)));
            const tall = 0.04 + hash2(cell, 7, l.seed) * 0.08;
            good = g < 0.62 && inCell && fy < shelf + tall;
            const k = hash2(cell, Math.round(shelf * 100) + 3, l.seed);
            gv = k < 0.3 ? GOODS[Math.floor(k * 3.3 * GOODS.length) % GOODS.length] : tone(INTERIOR, 3 + (k > 0.7 ? 1 : 0) + (gx - cell * cw === 0 ? 1 : 0));
          }
          // Jars and bottles: a lighter lid or neck row on top of each.
          if (good && a.d > 1 && fy >= shelf + 0.04 + hash2(cell, 7, l.seed) * 0.08 - 1.5 / Math.max(1, y1 - y0)) gv = tone(INTERIOR, 5);
          if (glow) {
            v = tone(INTERIOR, onShelf ? 3 : good ? 5 : 4 + (fy > 0.6 ? 1 : 0));
            m = M_EMIT;
          } else if (fy > 0.8) {
            v = tone(GLASS, fy > 0.92 ? 3 : 2);
            m = M_LIT;
          } else if (onShelf) v = tone(INTERIOR, 3 + (lit ? 1 : 0));
          else if (good) v = gv;
          else v = tone(INTERIOR, (fy < 0.12 ? 2 : 1) + (lit ? 2 : 0));
          if (c.night && !glow) v = tone(GLASS, 0);
        }
        // The glass's sheen: a diagonal band of sky.
        if (!glow && a.d === 4 && (i & 1) === 0 && Math.abs(fx * 0.8 - fy - 0.1) < 0.02) v = tone(GLASS, 3);
        a.put(x, y, v, m);
      }
    }
    // The mullion between the lights and the panelled plinth below the glass.
    a.rect(x1, y0, x1 + by(a, 1, 1, 2), y1, tone(pui, pl + 1));
  }
  const py1 = a.Y(8);
  if (!slot) {
    for (let x = c.X0 + by(a, 1, 1, 2); x < c.X1 - 1; x++)
      for (let y = 0; y < py1; y++) {
        const fy = y / py1;
        a.put(x, y, tone(pui, pl - (a.d > 1 && (fy < 0.2 || fy > 0.85) ? 1 : 0)));
      }
  }
  drawDoor(c, l.door, 0, true);
  // The awning: cloth stripes over the glass top, a valance with scallops, the big shadow below.
  if (l.awning && !c.night) {
    const ar = AWNING[l.awning.paint % AWNING.length];
    const ay0 = a.Y(51);
    const ay1 = fy0;
    const stripe = a.L(3);
    for (let y = ay0; y < ay1; y++)
      for (let x = c.X0 + 1; x < c.X1 - 1; x++) {
        const st = l.awning.kind === 'stripe' && Math.floor((a.gx0 + x) / stripe) % 2 === 1;
        const val = y < ay0 + by(a, 1, 2, 4);
        const scallop = val && a.d > 1 && Math.abs(((a.gx0 + x) % (stripe * 2)) - stripe) < (y - ay0) * 1.5;
        if (val && !scallop && y === ay0) continue;
        a.put(x, y, st ? tone(WHITE, 4) : tone(ar, val ? 1 : 2 + ((y - ay0) > (ay1 - ay0) * 0.6 ? 1 : 0)));
      }
    if (c.geom) {
      wallShadowPx(c.geom, 1.0, 51, l.bandTop, sh);
      a.shadow(c.X0 + a.L(sh.dx), ay0 - a.L(sh.dy), c.X1 + a.L(sh.dx), ay0, M_SHADE);
    }
  }
  // The hanging sign on a wrought-iron bracket.
  if (l.sign) {
    const right = l.door.u > l.u0 + l.w / 2;
    const sx = right ? c.X0 + by(a, 1, 2, 4) : c.X1 - by(a, 2, 4, 10);
    const sy = a.Y(62);
    a.rect(sx, sy, sx + by(a, 2, 4, 10), sy + by(a, 1, 1, 2), tone(IRON, 2));
    const bw = by(a, 2, 3, 8);
    const bh = by(a, 4, 9, 20);
    const sp = PAINT[l.doorPaint];
    a.rect(sx + 1, sy - bh, sx + 1 + bw, sy, tone(sp, 3));
    a.rect(sx + 1, sy - bh, sx + 2, sy, tone(sp, 4));
    if (a.d > 1) a.rect(sx + 2, sy - bh + 2, sx + bw - 0, sy - 2, tone(GOLD, 2));
    if (c.geom) {
      wallShadowPx(c.geom, 0.8, 62, l.bandTop, sh);
      a.shadow(sx + a.L(sh.dx * 0.5), sy - bh - a.L(sh.dy * 0.4), sx + bw + a.L(sh.dx * 0.6), sy - a.L(sh.dy * 0.3), M_SHADE);
    }
  }
}

/** The stoep (spec §8.2: 7–9 steps, 26–32 px, two flights parallel to the façade), its railing in the door's colour, the basement under the landing. */
function drawStoep(c: LotCtx): void {
  const { a, l } = c;
  const s = l.stoep;
  if (!s) return;
  const sx0 = a.X(s.u0);
  const sx1 = a.X(s.u1);
  const dx0 = a.X(l.door.u - 1);
  const dx1 = a.X(l.door.u + l.door.w + 1);
  const H = a.Y(s.h);
  const steps = s.h >= 30 ? 9 : s.h >= 28 ? 8 : 7;
  const p = PAINT[l.doorPaint];
  for (let x = sx0; x < sx1; x++) {
    let hgt: number;
    if (x < dx0) hgt = Math.ceil(((x - sx0 + 1) / Math.max(1, dx0 - sx0)) * steps) / steps;
    else if (x >= dx1) hgt = Math.ceil(((sx1 - x) / Math.max(1, sx1 - dx1)) * steps) / steps;
    else hgt = 1;
    const yt = Math.round(H * hgt);
    for (let y = 0; y < yt; y++) {
      const tread = y === yt - 1 || (a.d > 1 && y % Math.max(2, Math.round(H / steps)) === 0);
      a.put(x, y, tone(HARDSTONE, tread ? 5 : x >= dx0 && x < dx1 ? 2 : 3));
    }
  }
  // The basement window under the landing (a grille) and its dark opening.
  const bx0 = dx0 + by(a, 1, 1, 3);
  const bx1 = dx1 - by(a, 1, 1, 3);
  const by0 = a.Y(4);
  const by1 = H - by(a, 1, 2, 5);
  if (by1 - by0 > 2)
    for (let y = by0; y < by1; y++)
      for (let x = bx0; x < bx1; x++) a.put(x, y, (x - bx0) % by(a, 2, 2, 4) === 0 && a.d > 1 ? tone(IRON, 3) : tone(GLASS, 0), M_DEEP);
  // The railings: posts at the outer ends and the landing, a rail along each flight.
  const rh = a.Y(18);
  const pw = by(a, 1, 1, 2);
  for (const x of [sx0, dx0 - pw, dx1, sx1 - pw]) a.rect(x, 0, x + pw, Math.min(H, a.Y(s.h)) + rh, tone(p, 3));
  a.line(sx0, rh, dx0, H + rh, tone(p, 4), M_LIT, pw);
  a.line(dx1, H + rh, sx1 - 1, rh, tone(p, 3), M_LIT, pw);
  a.rect(dx0, H + rh - pw, dx1, H + rh, tone(p, 4));
  if (a.d > 1)
    for (let x = sx0; x < sx1; x += by(a, 3, 3, 5)) {
      const f = x < dx0 ? (x - sx0) / Math.max(1, dx0 - sx0) : x >= dx1 ? (sx1 - x) / Math.max(1, sx1 - dx1) : 1;
      const yb = Math.round(H * f);
      a.rect(x, yb, x + 1, yb + rh, tone(p, 2));
    }
}

/** d: the window frames (architecture only): plain frames, glass doors, the curtain ALWAYS closed, a red tube on top and a small number; never a figure. */
function drawFrames(c: LotCtx): void {
  const { a, l } = c;
  plinth(c, c.X0, c.X1);
  const fr = PAINT[l.doorPaint === 'wood' ? 'black' : l.doorPaint];
  const on = c.night && !c.dark;
  for (let i = 0; i < l.groundWindows.length; i++) {
    const o = l.groundWindows[i];
    const x0 = a.X(o.u);
    const x1 = a.X(o.u + o.w);
    const y0 = a.Y(o.h);
    const y1 = a.Y(o.h + o.hh);
    const f = by(a, 1, 1, 2);
    a.rect(x0, y0, x1, y1, tone(fr, 3));
    for (let y = y0 + f; y < y1 - f; y++)
      for (let x = x0 + f; x < x1 - f; x++) {
        const fold = a.d > 1 && (a.gx0 + x) % by(a, 2, 2, 3) === 0 ? 1 : 0;
        a.put(x, y, tone(RED_CURTAIN, (on ? 2 : 1) - fold), on ? M_EMIT : M_LIT);
      }
    // The red tube along the top (an emitter while on; a dark tube after 03:00).
    const ty = y1 + by(a, 1, 1, 2);
    a.rect(x0, ty, x1, ty + by(a, 1, 1, 2), on ? tone(RED_LIGHT, 2) : tone(IRON, 3), on ? M_EMIT : M_LIT);
    // The small number plate.
    if (a.d > 1) a.rect(x1 - by(a, 1, 3, 6), y1 + by(a, 1, 3, 6), x1 - 1, y1 + by(a, 1, 5, 10), tone(WHITE, 5));
  }
  drawDoor(c, l.door, l.fanlight, false);
}

// ------------------------------------------------------------------------------------ details

/** Wall anchors (black St Andrew's crosses or rosettes) with rust streaks, the hoist beam, the downpipe, the gable stone, the flower box, the house number. */
export function drawDetails(c: LotCtx): void {
  const { a, l } = c;
  // The downpipe (zinc), with its brackets and the shoe at the foot.
  if (l.downpipe !== null) {
    const x0 = a.X(l.downpipe);
    const w = by(a, 1, 2, 4);
    const y1 = c.eY;
    a.rect(x0, 0, x0 + w, y1, tone(ZINC, 3));
    a.rect(x0, 0, x0 + 1, y1, tone(ZINC, 4));
    if (a.d > 1) for (let y = a.Y(20); y < y1; y += a.Y(24)) a.rect(x0 - 1, y, x0 + w + 1, y + 1, tone(ZINC, 2));
    a.rect(x0 - 1, 0, x0 + w + 1, by(a, 1, 2, 3), tone(ZINC, 2));
  }
  // Anchors.
  const r = by(a, 0, 1, 2);
  for (const [u, h] of l.anchorPts) {
    const x = a.X(u);
    const y = a.Y(h);
    if (r === 0) {
      a.put(x, y, tone(IRON, 1));
      continue;
    }
    if (l.anchors === 'cross') {
      for (let k = -r; k <= r; k++) {
        a.put(x + k, y + k, tone(IRON, k < 0 ? 3 : 1));
        a.put(x + k, y - k, tone(IRON, k < 0 ? 3 : 1));
      }
    } else {
      for (let yy = -r; yy <= r; yy++)
        for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + r) a.put(x + xx, y + yy, tone(IRON, xx + yy < 0 ? 3 : xx + yy > 1 ? 0 : 1));
    }
  }
  // The hoist beam (a dark beam end, the hook, a small roof on some) and its long shadow.
  if (l.hoist) {
    const x = a.X(l.hoist.u);
    const y = a.Y(l.hoist.h);
    const bw = by(a, 1, 2, 4);
    const wood = PAINT.wood;
    a.rect(x - bw, y - bw, x + bw, y + bw, tone(wood, 1));
    a.rect(x - bw, y + bw - 1, x + bw, y + bw, tone(wood, 3));
    a.rect(x - bw, y - bw, x - bw + 1, y + bw, tone(wood, 3));
    const hk = by(a, 1, 3, 7);
    a.rect(x, y - bw - hk, x + 1, y - bw, tone(IRON, 2));
    if (a.d > 1) a.rect(x, y - bw - hk, x + by(a, 1, 1, 3), y - bw - hk + 1, tone(IRON, 2));
    if (l.hoist.roof) {
      const rr = by(a, 1, 3, 6);
      for (let k = 0; k < rr; k++) a.rect(x - rr + k, y + bw + k, x + rr - k, y + bw + k + 1, tone(SLATE, k === 0 ? 2 : 3));
    }
    if (c.geom) {
      wallShadowPx(c.geom, 1.0, l.hoist.h, l.bandTop, sh);
      a.shadowLine(x + bw, y - bw, x + bw + a.L(sh.dx), y - bw - a.L(sh.dy), M_SHADE, by(a, 1, 2, 4));
    }
  }
  // The gable stone (our own motif: a carved tablet) over the door or in the first storey.
  if (l.gableStone && l.storeys.length > 0) {
    const s = l.storeys[0];
    const gx = l.door.u + l.door.w / 2;
    const x0 = a.X(gx - 4);
    const x1 = a.X(gx + 4);
    const y0 = a.Y(s.h + 4);
    const y1 = a.Y(s.h + 10);
    a.rect(x0, y0, x1, y1, tone(SANDSTONE, 5));
    if (a.d > 1) {
      for (let y = y0 + 1; y < y1 - 1; y++)
        for (let x = x0 + 1; x < x1 - 1; x++) if (hash2(x - x0, y - y0, l.seed) < 0.35) a.put(x, y, tone(SANDSTONE, 3));
      a.rect(x0, y1 - 1, x1, y1, tone(SANDSTONE, 7));
    }
  }
  // The flower box under the first storey's windows (≤ 1 lot in 6).
  if (l.flowerBox && l.storeys.length > 0) {
    for (const o of l.storeys[0].windows) {
      const x0 = a.X(o.u) - 1;
      const x1 = a.X(o.u + o.w) + 1;
      const y0 = a.Y(o.h) - by(a, 2, 3, 6);
      a.rect(x0, y0, x1, y0 + by(a, 1, 2, 4), tone(PAINT.green, 2));
      for (let x = x0; x < x1; x++)
        for (let y = y0 + by(a, 1, 2, 4); y < y0 + by(a, 2, 4, 9); y++) {
          const h = hash2(a.gx0 + x, y, l.seed);
          if (h < 0.55) a.put(x, y, h < 0.14 ? tone(FLOWER, 2 + (h < 0.05 ? 1 : 0)) : tone(LEAF, 2 + (h > 0.4 ? 1 : 0)));
        }
    }
  }
  // The night's wall lamp (a warm lantern on a bracket).
  for (const f of l.features) {
    if (f.kind !== 'wall-lamp' || !c.night) continue;
    const x = a.X(f.u);
    const y = a.Y(f.h);
    a.rect(x, y, x + by(a, 1, 2, 4), y + by(a, 1, 2, 5), tone(LANTERN, 3), M_EMIT);
  }
  // The neon word over a bar (our own words; spec §8.9): an emitter while on, a dark tube after 03:00.
  if (c.night && l.neon) {
    const ramp = l.neon.tint === 'pink' ? NEON_PINK : l.neon.tint === 'cyan' ? NEON_CYAN : l.neon.tint === 'red' ? RED_LIGHT : LANTERN;
    const cx = (c.X0 + c.X1) >> 1;
    const cy = (a.Y(60) + c.bY) >> 1;
    if (!c.dark) {
      letters(c, l.neon.word, cx, cy, ramp, ramp.length - 1, M_EMIT);
    } else letters(c, l.neon.word, cx, cy, IRON, 3, M_LIT);
  }
}

// ------------------------------------------------------------------------------------ wear

/**
 * Façade wear (spec §8.10: ≥ 6 marks per lot; fine detail at 4×, 2 × 2 clusters at 2×, only tone
 * at 1×): damp at the foot (taller when wet), salt bloom, rust under anchors, soot under the eaves,
 * patched brick, dirt streaks under sills, peeling paint, stickers (invented marks) on the
 * downpipe, pigeon spikes on the ledges, tags (invented scribbles), cracks.
 */
export function drawWear(c: LotCtx): void {
  const { a, l } = c;
  const d = a.d;
  for (const w of l.wear) {
    const x0 = a.X(w.u);
    const x1 = Math.max(x0 + 1, a.X(w.u + w.w));
    const y0 = a.Y(w.h);
    const y1 = Math.max(y0 + 1, a.Y(w.h + w.hh));
    switch (w.kind) {
      case 'damp': {
        const hh = a.Y(w.hh * (0.6 + c.row.wet * 0.9));
        a.remap(x0, 0, x1, hh + by(a, 1, 2, 3), GRIME, (x, y) => {
          const edge = hh + Math.floor(hash2((a.gx0 + x) >> (d === 4 ? 2 : 1), 3, w.seed) * by(a, 1, 2, 4));
          return y < edge && (y < hh - 2 || ((x + y) & 1) === 0 || d === 1);
        });
        break;
      }
      case 'salt':
        if (d === 1) break;
        a.remap(x0, y0, x1, y1, BLEACH, (x, y) => hash2((a.gx0 + x) >> (d === 4 ? 0 : 1), y >> (d === 4 ? 0 : 1), w.seed) < 0.3);
        break;
      case 'rust': {
        if (d === 1) break;
        const x = a.X(w.u);
        for (let y = y0 - a.Y(w.hh); y < y0; y++) if (hash2(y, 1, w.seed) < 0.8) a.put(x, y, tone(RUST, y > y0 - a.Y(w.hh) / 2 ? 2 : 1));
        break;
      }
      case 'soot':
        a.remap(x0, y0, x1, y1, GRIME, (x, y) => (y - y0) / Math.max(1, y1 - y0) > (d === 1 ? 0.5 : (hash2(a.gx0 + x, y, w.seed) * 0.6 + 0.3)));
        break;
      case 'patch':
        if (d === 1) break;
        a.remap(x0, y0, x1, y1, FRESH, (x, y) => !(hash2((a.gx0 + x) >> 2, y >> 1, w.seed) < 0.25 && (x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1)));
        break;
      case 'streak':
        if (d === 1) break;
        a.remap(x0, y0, x0 + by(a, 1, 1, 2), y1, GRIME, (_x, y) => hash2(y, 5, w.seed) < 0.75);
        break;
      case 'peel':
        if (d < 4) break;
        for (let k = 0; k < 6; k++) {
          const px = x0 + Math.floor(hash2(k, 1, w.seed) * (x1 - x0));
          const py = y0 + Math.floor(hash2(k, 2, w.seed) * (y1 - y0));
          a.put(px, py, tone(PAINT.wood, 3));
          a.put(px + 1, py, tone(PAINT.wood, 2));
        }
        break;
      case 'sticker': {
        if (d === 1) break;
        const s = by(a, 1, 2, 4);
        const col = ACCENT[Math.floor(hash2(1, 1, w.seed) * ACCENT.length)];
        a.rect(x0 - (s >> 2), y0, x0 - (s >> 2) + s, y0 + s + (d === 4 ? 2 : 0), col);
        if (d === 4) a.rect(x0, y0 + 1, x0 + 2, y0 + 2, tone(WHITE, 5));
        break;
      }
      case 'spikes':
        if (d < 4) break;
        for (let x = x0; x < x1; x += 2) a.put(x, y0, tone(IRON, 3));
        break;
      case 'tag': {
        if (d === 1) break;
        const col = TAG[Math.floor(hash2(2, 2, w.seed) * TAG.length)];
        let x = x0;
        let y = (y0 + y1) >> 1;
        const n = (x1 - x0) * 2;
        for (let k = 0; k < n; k++) {
          a.put(x, y, col);
          if (d === 4) a.put(x, y + 1, col);
          const h = hash2(k, 3, w.seed);
          x += h < 0.7 ? 1 : 0;
          y += h < 0.35 ? 1 : h < 0.7 ? -1 : 0;
          y = Math.max(y0, Math.min(y1, y));
        }
        break;
      }
      case 'crack': {
        if (d === 1) break;
        let x = x0;
        for (let y = y1; y > y0; y--) {
          a.remap(x, y, x + 1, y + 1, GRIME);
          a.remap(x, y, x + 1, y + 1, DIM);
          x += hash2(y, 4, w.seed) < 0.3 ? 1 : hash2(y, 6, w.seed) < 0.3 ? -1 : 0;
        }
        break;
      }
    }
  }
}
