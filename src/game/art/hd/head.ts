/**
 * UHD heads (docs/ART_GUIDE.md "UHD art", rig contracts): ONE density-generic drawer paints every
 * HeadStyle × Expression at 2× and 4×.
 *
 * `renderHeadHd(s, expr, d)` returns exactly HEAD_W·d × HEAD_H·d with the logical layout of
 * `renderHead` (facing right; NECK and HEAD_CENTER at d times them), no outline (the rig outlines
 * the whole figure). The SILHOUETTE comes from the 1× head: the skull, every hair style, headgear
 * and facial-hair extra keep the footprint of their 1× template (smoothed on the art grid), with
 * the same layer order, hair cut-off under the headgear and hat slip (in 1 / d px steps). The
 * INSIDE is painted natively with the kit's lit height fields:
 * - the head: one rounded skull and face (no second dome, so no light band across the cheek), the
 *   brow ridge and eye socket, a nose with a lit bridge and a shaded underside, muzzle and chin,
 *   the jaw turning under, the neck in the jaw's shadow; the ear a rim (helix) round a dark bowl
 *   opening to the front, a crease where it joins the cheek (an ear, never a blush spot);
 * - the eye: lid line, white, iris ring, pupil and a catchlight (2 × 2 at 4×); brows as brushes;
 *   the mouth with a lit lower lip, teeth and tongue when open; every expression and face trait;
 * - hair as LOCKS per style (lock domes meeting in grooves, one highlight cluster per lock; curls
 *   for curly hair, puffs, tufts and beards), the fringe casting a soft shadow on the forehead;
 * - headgear as shells with seams, brims, peaks, bands, knit, fur, badges, lenses and shine.
 * The five squad members keep the likeness cues of their select portraits (portrait-kit ramps
 * and traits: Vincent's arched brow, forehead line and dark stubble; Thom's toothy grin, happy
 * squint, crow's feet and rosy cheeks; Dirk's ruddy round face and thick moustache; Bob's blue
 * eyes and pale skin; Patrick's glossy black hair, strong dark brows and jaw).
 *
 * Results are cached per style, expression, density and glint (a clone is returned).
 */
import type { Color } from '../../../engine/color';
import type { Ramp } from '../../../engine/palette';
import { PAL_HD, hdHome, hdRampOf } from '../../../engine/palette-hd';
import type { PixelBuffer } from '../../../engine/pixel';
import {
  BASE_AT,
  EXTRAS,
  EYESHINE_EXPR,
  FACE_TRAITS,
  GEAR,
  HAIR,
  HEAD_H,
  HEAD_W,
  SKULL,
  type Expression,
  type FaceExtra,
  type HairStyle,
  type Headgear,
  type HeadStyle,
  type Tpl,
} from '../humanoid-head';
import { hash2, noise2 } from '../paint';
import { IRIS_BLUE, IRIS_BROWN, SKIN_FAIR, SKIN_PALE, SKIN_RUDDY } from '../portrait-kit';
import { HdCanvas, type Texture } from './canvas';
import { oneHue } from './light';

export type HdDensity = 2 | 4;

// ---------------------------------------------------------------------------------------------
// Layout (logical px in the head buffer; the 1× features' places)
// ---------------------------------------------------------------------------------------------

/**
 * The eye centre: over the 1× eye column (x 11, rows 12–13), a little forward (the style round's
 * big eye in a big face), the white showing in front of the iris.
 */
export const HD_EYE: readonly [number, number] = [12.05, 12.95];
/** The mouth centre: the 1× mouth row (x 12–13, row 15). */
export const HD_MOUTH: readonly [number, number] = [13.05, 15.5];
/** The ear centre: the 1× ear block (x 6–8, rows 12–15). */
export const HD_EAR: readonly [number, number] = [7.45, 13.85];
const [EYE_X, EYE_Y] = HD_EYE;
const [MOUTH_X, MOUTH_Y] = HD_MOUTH;
const [EAR_X, EAR_Y] = HD_EAR;
/** The nose tip (the 1× nose px at x 14, row 13). */
const NOSE_X = 14.35;
const NOSE_Y = 13.55;

// ---------------------------------------------------------------------------------------------
// Template grids, smoothed on the art grid
// ---------------------------------------------------------------------------------------------

const GW = HEAD_W;
const GH = HEAD_H;

/** A layer's cells (1 = in) on the head grid, from 1× template rows. */
class Grid {
  readonly on = new Uint8Array(GW * GH);
  any = false;
  /**
   * Stamp template rows at a skull-relative offset (as `put` in humanoid-head.ts); `pick` gets the
   * letter and the head-grid cell and says whether the cell belongs to this layer.
   */
  stamp(t: Tpl, dy = 0, pick: (ch: string, gx: number, gy: number) => boolean = () => true): this {
    const ox = BASE_AT[0] + t.at[0];
    const oy = BASE_AT[1] + t.at[1] + dy;
    for (let y = 0; y < t.rows.length; y++) {
      const row = t.rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const gx = ox + x;
        const gy = oy + y;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        if (ch === '-') {
          this.on[gy * GW + gx] = 0;
          continue;
        }
        if (!pick(ch, gx, gy)) continue;
        this.on[gy * GW + gx] = 1;
        this.any = true;
      }
    }
    return this;
  }
}

/** erf (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

/** Coverage of the cells [i, i+1) under a Gaussian of spread σ at each art px (separable tables). */
const tables = new Map<string, Float32Array>();
function coverTable(n: number, cells: number, d: number, sigma: number, shift: number): Float32Array {
  const key = `${n}:${cells}:${d}:${sigma}:${shift}`;
  let t = tables.get(key);
  if (t) return t;
  t = new Float32Array(n * cells);
  const k = 1 / (sigma * Math.SQRT2);
  for (let X = 0; X < n; X++) {
    const x = (X + 0.5) / d - shift;
    for (let i = 0; i < cells; i++) t[X * cells + i] = 0.5 * (erf((i + 1 - x) * k) - erf((i - x) * k));
  }
  tables.set(key, t);
  return t;
}

/** A smoothed mask of a grid per art px (0..1; 0.5 = the edge), optionally shifted by (sx, sy). */
class Field {
  readonly v: Float32Array;
  readonly W: number;
  readonly H: number;
  readonly d: number;
  constructor(W: number, H: number, d: number, g: Grid, sigma: number, sx = 0, sy = 0) {
    this.W = W;
    this.H = H;
    this.d = d;
    const fx = coverTable(W, GW, d, sigma, sx);
    const fy = coverTable(H, GH, d, sigma, sy);
    const tmp = new Float32Array(GH * W);
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        if (!g.on[j * GW + i]) continue;
        for (let X = 0; X < W; X++) tmp[j * W + X] += fx[X * GW + i];
      }
    }
    this.v = new Float32Array(W * H);
    for (let Y = 0; Y < H; Y++) {
      for (let j = 0; j < GH; j++) {
        const w = fy[Y * GH + j];
        if (w < 1e-4) continue;
        for (let X = 0; X < W; X++) this.v[Y * W + X] += w * tmp[j * W + X];
      }
    }
  }
  /** The value at logical (x, y) (the art px holding it; 0 outside the buffer). */
  at(x: number, y: number): number {
    const X = Math.floor(x * this.d);
    const Y = Math.floor(y * this.d);
    if (X < 0 || Y < 0 || X >= this.W || Y >= this.H) return 0;
    return this.v[Y * this.W + X];
  }
}

/** A layer's sharp edge (the silhouette, at 0.5) and soft body (for the edge roll). */
interface Shape {
  edge: Field;
  body: Field;
}

function shapeOf(c: HdCanvas, g: Grid, soft = 1.1): Shape {
  return { edge: new Field(c.W, c.H, c.d, g, 0.42), body: new Field(c.W, c.H, c.d, g, soft) };
}

function smooth(a: number, b: number, v: number): number {
  const t = (v - a) / (b - a);
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

/** The edge roll of a layer: 0 just outside its edge, rising steeply to 1 inside (a rounded rim, not a cut-out). */
function roll(b: number): number {
  return b <= 0.22 ? 0 : b >= 1 ? 1 : Math.sqrt((b - 0.22) / 0.78);
}

function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const u = (x - cx) / sx;
  const v = (y - cy) / sy;
  return Math.exp(-(u * u + v * v) / 2);
}

/** Height of an ellipsoid cap (0 outside). */
function dome(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  const q = 1 - u * u - v * v;
  return q > 0 ? Math.sqrt(q) : 0;
}

// ---------------------------------------------------------------------------------------------
// Ramps and likeness
// ---------------------------------------------------------------------------------------------

/**
 * The HD ramp of a style's hair: for a short custom ramp (a hero's own hair: Vincent's dark brown,
 * Thom's blond, Patrick's glossy black; the 3-tone hair ramps) only the part of the HD ramp it
 * covers, plus one tone above for the sheen, so dark hair stays dark and blond stays blond.
 */
function hairRampOf(r: Ramp): { ramp: Ramp; lo: number; hi: number } {
  const full = hdRampOf(r);
  const idx: number[] = [];
  for (const c of r) {
    const h = hdHome(c);
    if (h && h.ramp === full) idx.push(h.i);
    else {
      const i = full.indexOf(c);
      if (i >= 0) idx.push(i);
    }
  }
  if (idx.length >= 2 && r.length < 4) {
    const lo = Math.max(0, Math.min(...idx) - 1);
    const hi = Math.min(full.length - 2, Math.max(...idx) + 1);
    if (hi - lo >= 2) {
      const ramp = full.slice(lo, hi + 2);
      return { ramp, lo: 0, hi: ramp.length - 2 };
    }
  }
  return { ramp: full, lo: full.length > 4 ? 1 : 0, hi: Math.max(1, full.length - 2) };
}

type SquadId = 'vincent' | 'thom' | 'dirk' | 'bob' | 'patrick';

/** Likeness cues of a squad member's select portrait (src/game/content/characters/select.art.ts). */
interface Likeness {
  /** The portrait's iris (HD ramp). */
  iris: Ramp;
  /** Brow half-thickness, logical px. */
  brow: number;
  /** Crow's feet at the eye corner (Thom, Dirk). */
  crow: boolean;
  /** Rosy cheeks (Thom, Dirk). */
  rosy: boolean;
  /** Skin tone shift: + paler (Bob's SKIN_PALE), − ruddier (Dirk's SKIN_RUDDY). */
  skin: number;
  /** Jaw: + square and strong (Patrick), − round (Dirk). */
  jaw: number;
  /** Lines on the forehead (Vincent). */
  forehead: boolean;
  /** Glossy hair with a sharp sheen (Patrick's HAIR_BLACK). */
  gloss: boolean;
}

const BASE_LOOK: Likeness = { iris: hdRampOf(IRIS_BROWN), brow: 0.34, crow: false, rosy: false, skin: 0, jaw: 0, forehead: false, gloss: false };

/** Mean luma (0..1) of a portrait skin ramp's tones (without its ink). */
function skinLuma(r: Ramp): number {
  let s = 0;
  for (let i = 1; i < r.length; i++) {
    const c = r[i] >>> 0;
    s += 0.3 * ((c >>> 24) & 255) + 0.59 * ((c >>> 16) & 255) + 0.11 * ((c >>> 8) & 255);
  }
  return s / Math.max(1, r.length - 1) / 255;
}

/** Tone shift of a portrait's skin against the fair skin most of the squad has (Bob's pale skin: lighter). */
const skinShift = (r: Ramp): number => Math.round((skinLuma(r) - skinLuma(SKIN_FAIR)) * 250) / 100;

const LIKENESS: Readonly<Record<SquadId, Likeness>> = {
  vincent: { ...BASE_LOOK, brow: 0.4, forehead: true },
  thom: { ...BASE_LOOK, iris: hdRampOf(IRIS_BLUE), crow: true, rosy: true },
  dirk: { ...BASE_LOOK, crow: true, rosy: true, skin: skinShift(SKIN_RUDDY), jaw: -1 },
  bob: { ...BASE_LOOK, iris: hdRampOf(IRIS_BLUE), brow: 0.3, skin: skinShift(SKIN_PALE) },
  patrick: { ...BASE_LOOK, brow: 0.44, jaw: 1, gloss: true },
};

/** Which squad member a style is (their signature face traits are theirs alone), or null. */
function squadOf(s: HeadStyle): SquadId | null {
  const x = s.extras;
  if (x.includes('raised-brow') || x.includes('smirk')) return 'vincent';
  if (x.includes('grin') || x.includes('beam')) return 'thom';
  if (x.includes('thick-mustache')) return 'dirk';
  if (x.includes('blue-eyes')) return 'bob';
  if (x.includes('thin-mustache')) return 'patrick';
  return null;
}

// ---------------------------------------------------------------------------------------------
// The head
// ---------------------------------------------------------------------------------------------

interface Ctx {
  c: HdCanvas;
  s: HeadStyle;
  expr: Expression;
  look: Likeness;
  squad: SquadId | null;
  face: number;
  skin: number;
  hair: number;
  skinR: Ramp;
  hairR: Ramp;
  hairLo: number;
  /** Logical y above which hair is cut by the headgear (−∞ without gear), and the column rule. */
  cutY: number;
  cutX: number;
  slip: number;
  /** Stubble: the jaw hairs' material (0 = none); `heavy` for Vincent's dark stubble. */
  stubble: number;
  heavy: boolean;
}

const cache = new Map<string, PixelBuffer>();
const CACHE_MAX = 192;
/** Hits and misses of the head cache (tools and tests). */
export const HEAD_HD_STATS = { hits: 0, misses: 0 };

function rampKey(r: Ramp): string {
  let k = '';
  for (const c of r) k += (c >>> 0).toString(36) + ',';
  return k;
}

/**
 * The HD head for a style and expression at density 2 or 4: HEAD_W·d × HEAD_H·d, facing right,
 * no outline. `glint: false` (a tilted head) drops the catchlight (it would drift off the pupil
 * when the rig rotates the head), as the 2× path does. d = 8 draws the head twice as large at 4×
 * natively (the rig's `headScale: 2`, instead of enlarging a 4× head).
 */
export function renderHeadHd(s: HeadStyle, expr: Expression, d: HdDensity | 8, opts: { glint?: boolean } = {}): PixelBuffer {
  const glint = opts.glint !== false;
  const key = `${d}|${expr}|${glint ? 1 : 0}|${s.hairStyle}|${s.headgear}|${s.hat === false ? 0 : 1}|${s.hatDy ?? 0}|${s.extras.join('+')}|${rampKey(s.skin)}|${rampKey(s.hair)}|${rampKey(s.gear)}|${rampKey(s.accent)}`;
  const hit = cache.get(key);
  if (hit) {
    HEAD_HD_STATS.hits++;
    return hit.clone();
  }
  HEAD_HD_STATS.misses++;
  const out = paintHead(s, expr, d, glint);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, out);
  return out.clone();
}

function paintHead(s: HeadStyle, expr: Expression, d: HdDensity | 8, glint: boolean): PixelBuffer {
  const c = new HdCanvas(HEAD_W, HEAD_H, d);
  const squad = squadOf(s);
  const look = squad ? LIKENESS[squad] : BASE_LOOK;
  const skinR = hdRampOf(s.skin);
  // The lit band of the skin is the 1× ramp's lightest tone (so dark skin stays as dark as today).
  const skinTop = clothSpan(s.skin).hi;
  const hs = hairRampOf(s.hair);
  const hairR = hs.ramp;
  const gloss = look.gloss || s.hairStyle === 'slick-back';
  const hairLo = hs.lo;
  const hairHi = hs.hi;
  const gearT = s.headgear === 'none' || s.hat === false ? null : s.headgear;
  // The hat slips in 1 / d steps (the 1× rounds to whole px).
  const slip = gearT ? Math.max(0, Math.round((s.hatDy ?? 0) * d) / d) : 0;
  const tpl = gearT ? GEAR[gearT] : null;
  const ctx: Ctx = {
    c,
    s,
    expr,
    look,
    squad,
    face: c.newPart(),
    skin: c.material({ ramp: skinR, spec: d >= 4 ? 0.62 : 0.3, shine: 30, rim: 0.04, amb: 0.2, wrap: 0.2, bounce: 0.34, lo: Math.max(1, skinTop - 3), hi: skinTop }),
    hair: c.material({ ramp: hairR, spec: gloss ? 0.95 : 0.3, shine: gloss ? 34 : 14, rim: 0.12, amb: 0.1, wrap: 0.06, lo: hairLo, hi: hairHi }),
    skinR,
    hairR,
    hairLo,
    cutY: tpl ? BASE_AT[1] + tpl.hairBelow + slip : -1e9,
    cutX: tpl && tpl.hairRightOf !== undefined ? BASE_AT[0] + tpl.hairRightOf : -1e9,
    slip,
    heavy: s.extras.includes('heavy-stubble'),
    stubble:
      s.extras.includes('heavy-stubble') || s.extras.includes('stubble')
        ? // Heavy stubble is DARK (the select portrait's dark stone and brown hairs). The hairs are a
          // pattern of lone px, so the cluster clean-up would hand each one the skin's band (mid-light
          // greys: a grey mesh on the jaw at 4×); a near-zero dither zone marks the material as a
          // pattern the clean-up keeps, without dithering anything.
          c.material({ ramp: PAL_HD.stone, spec: 0.1, shine: 20, rim: 0.04, amb: 0.14, wrap: 0.2, bounce: 0.34, lo: s.extras.includes('heavy-stubble') ? 1 : 3, hi: s.extras.includes('heavy-stubble') ? 3 : 6, dither: 1e-6 })
        : 0,
  };

  drawSkull(ctx);
  const under: readonly FaceExtra[] = s.extras.filter((x) => x === 'heavy-stubble' || x === 'stubble');
  for (const x of under) drawStubble(ctx, x);
  drawSkinMarks(ctx);
  drawEye(ctx, glint);
  drawMouth(ctx);
  for (const x of s.extras) if (!under.includes(x)) drawExtra(ctx, x);
  const hairShape = drawHair(ctx);
  if (hairShape) hairShadow(ctx, hairShape);
  drawBrows(ctx);
  if (s.extras.includes('bushy-brows')) drawFacialHair(ctx, 'bushy-brows');
  if (gearT) drawGear(ctx, gearT);
  return c.render({ outline: 'none', ao: 0.28, rimLight: 2, shadow: 0.24, shadowMax: 1.6 });
}

// ---------------------------------------------------------------------------------------------
// Skin: skull, face, ear, neck
// ---------------------------------------------------------------------------------------------

const skullGrid = new Grid().stamp({ at: [0, 0], rows: SKULL });
const skullShapes = new Map<number, Shape>();

function skullShape(c: HdCanvas): Shape {
  let sk = skullShapes.get(c.d);
  if (!sk) {
    sk = shapeOf(c, skullGrid, 1.25);
    skullShapes.set(c.d, sk);
  }
  return sk;
}

/** Inside the ear (0..1: 1 in the middle, 0 at its rim). */
function earQ(x: number, y: number): number {
  // An ear a little wider at the top, the lobe narrower.
  const ry = 1.5;
  const v = (y - EAR_Y) / ry;
  const rx = 1.02 - Math.max(0, v) * 0.2;
  const u = (x - EAR_X) / rx;
  return u * u + v * v;
}

/**
 * Depth order without big base-depth steps (which would draw separations and cast shadows): the
 * face (dz −14 in its texture), the neck and the hair sink below the layers on top of them through
 * the depth offset only.
 */
const sinkNeck: Texture = (p) => {
  p.dz = -16;
};
const HAIR_SINK = -6;

function drawSkull(k: Ctx): void {
  const { c, look } = k;
  const sk = skullShape(c);
  const jaw = look.jaw;
  const matte = c.material({ ...c.getMaterial(k.skin), spec: 0 });
  // The skin between the stubble hairs: the same skin, also kept out of the cluster clean-up
  // (a lone skin px between hairs would take the hairs' band and darken the jaw to a smudge).
  const between = k.stubble ? c.material({ ...c.getMaterial(k.skin), dither: 1e-6 }) : 0;
  // Small features are softer at 2× (they would break into blotches on the coarse grid).
  const f = c.d >= 4 ? 1 : 0.35;
  // The neck: behind the jaw, in its shadow.
  c.capsule(8.5, 15.6, 8.5, 19.6, 1.55, 1.55, { mat: k.skin, part: k.face, z: -0.6, round: 0.7, tone: -0.12, tex: sinkNeck });
  c.heightField(2.5, 6, 14, 13, (x, y) => {
    if (sk.edge.at(x, y) < 0.5) return NaN;
    // ONE head mass shaped like a rounded box: the side of the head and the cheek a broad plane
    // facing the viewer, turning up into the crown, back behind the ear, forward into the face's
    // front plane (the shade side) and under the jaw. One smooth form: no band across the cheek.
    const u = Math.abs((x - 9.0) / 7.2);
    const v = Math.abs((y - 12.5) / 7.4);
    const r = Math.pow(u, 2.5) + Math.pow(v, 2.5);
    let h = r >= 1 ? 0 : 5.4 * Math.pow(1 - r, 1 / 2.5);
    h += 1.3 * roll(sk.body.at(x, y));
    // A round face bulges at the cheek and jaw; a strong jaw keeps a square corner.
    if (jaw < 0) h += 0.55 * gauss(x, y, 11.0, 15.4, 1.8, 1.2);
    if (jaw > 0) h += 0.35 * gauss(x, y, 11.8, 16.6, 1.2, 0.5);
    // Brow ridge over the eye, the socket under it.
    h += 0.4 * f * gauss(x, y, EYE_X + 0.15, EYE_Y - 1.8, 1.45, 0.48);
    h -= 0.38 * f * gauss(x, y, EYE_X - 0.1, EYE_Y + 0.05, 0.95, 0.85);
    // The cheekbone: a soft round cluster below and behind the eye.
    h += 0.3 * f * gauss(x, y, EYE_X - 1.4, EYE_Y + 1.3, 1.0, 0.8);
    // Nose: the bridge from the brow, the tip; the muzzle round the mouth and the chin.
    h += 0.7 * gauss(x, y, NOSE_X, NOSE_Y, 0.62, 0.75);
    h += 0.3 * gauss(x, y, NOSE_X - 0.55, NOSE_Y - 1.05, 0.45, 0.85);
    h += 0.45 * f * gauss(x, y, MOUTH_X + 0.25, MOUTH_Y - 0.15, 1.25, 0.85);
    h += 0.45 * f * gauss(x, y, 12.6, 16.75, 1.1, 0.55);
    // The ear: a low rim (helix) round a bowl that opens to the front.
    // (Its tones come from the ear shade below; the relief only lifts its rim off the skull.)
    const q = earQ(x, y);
    if (q < 1.2) h += 0.3 * smooth(1.2, 0.85, q);
    return h;
  }, {
    mat: k.skin,
    part: k.face,
    z: 0,
    tone: look.skin,
    tex: (p) => {
      p.dz = -14;
      // The ear is matte (a sheen there reads as a light spot).
      if (earQ(p.x, p.y) < 1.3) p.mat = matte;
      if (k.stubble) {
        const zn = jawZone(p.x, p.y, k.heavy);
        if (k.heavy) {
          // Heavy stubble (a 5 o'clock shadow): a cool stubble shadow on the skin with clustered
          // hair strokes on it (1 × 2 or 2 × 1 art px per 2 × 2 cell, from hashes), denser along
          // the jaw line and the upper lip, sparser toward the cheek; never an even checker.
          if (zn >= 1 && p.mat === k.skin) {
            p.mat = between;
            p.tone -= zn === 2 ? 0.3 : 0.14;
            const cx = p.X >> 1;
            const cy = p.Y >> 1;
            const lip = Math.abs(p.y - (MOUTH_Y - 0.75)) < 0.6 && p.x > 11.4;
            const jaw = p.y > 16.2;
            const fill = zn === 1 ? 0.22 : lip || jaw ? 0.62 : p.y < 15.4 ? 0.3 : 0.45;
            const h = hash2(cx, cy, 977);
            if (h < fill) {
              const o = hash2(cx, cy, 983);
              const a = (p.X & 1) === (o < 0.5 ? 0 : 1);
              const b = (p.Y & 1) === (o < 0.25 || o >= 0.75 ? 0 : 1);
              // Mostly vertical hairs (they grow down the jaw); a few lie across.
              if (h < fill * 0.75 ? a : b) {
                p.mat = k.stubble;
                p.tone += 0.22;
              }
            }
          }
        } else {
          // Light stubble: hairs on skin, one px in four (sparser at the fringe).
          const sparse = p.X % 2 === 0 && p.Y % 2 === 0;
          if (zn >= 1 && sparse && (zn === 2 || (p.X + p.Y) % 4 === 0)) p.mat = k.stubble;
          else if (zn >= 1 && p.mat === k.skin) p.mat = between;
        }
      }
    },
  });

  const two = c.d < 4;
  // The ear's tones (the 1× / 2× ear is a DARK oval with a darker core: keep that read): a
  // contour round it, lit only where the rim faces the light; the helix rim; inside it a C-shaped
  // groove opening to the front; the bowl (concha) in shade and the canal deepest.
  const ear = (x: number, y: number): number => {
    const q = earQ(x, y);
    if (q > 1) return 0;
    const r = Math.sqrt(q);
    const dx = x - EAR_X;
    const dy = y - EAR_Y;
    const lit = -dx * 0.62 - dy * 0.78 > 0.25;
    const cu = (x - (EAR_X + 0.38)) / 0.3;
    const cv = (y - (EAR_Y + 0.25)) / 0.4;
    if (cu * cu + cv * cv < 1) return two ? -0.7 : -0.8;
    if (two) return r > 0.62 ? (lit ? -0.05 : -0.45) : -0.5;
    // 4×: the dark C of the rim's inner edge is the ear's signature; the bowl inside it stays mid.
    if (r > 0.8) return lit ? 0.05 : -0.42;
    if (r > 0.56 && dx < 0.32) return -0.62;
    if (r > 0.56) return -0.12;
    return -0.16;
  };
  c.shade(EAR_X - 1.6, EAR_Y - 2, 3.4, 4.2, ear, k.face);
  // The ear casts a little shade on the cheek in front of and under it.
  c.shade(EAR_X, EAR_Y - 1, 2.6, 3.6, (x, y) => {
    const q = earQ(x - 0.45, y - 0.55);
    return q < 1 && earQ(x, y) > 1.05 ? -0.2 : 0;
  }, k.face);
  // The jaw throws a shadow on the neck.
  c.shade(5.5, 15.5, 7, 4, (x, y) => (y > 16.55 + (x - 7) * 0.32 && sk.edge.at(x, y - 0.6) < 0.5 ? -0.22 : 0), k.face);
  // The nose's shadow on the upper lip, and the nostril at 4×.
  c.shade(NOSE_X - 1.3, NOSE_Y, 1.9, 1.4, (x, y) => (y > NOSE_Y + 0.5 && y < NOSE_Y + 0.9 && x > NOSE_X - 1.0 + (y - NOSE_Y - 0.5) * 0.8 && x < NOSE_X + 0.3 ? -0.26 : 0), k.face);
  if (c.d >= 4) c.shade(NOSE_X - 1, NOSE_Y - 0.2, 1, 1, (x, y) => ((x - (NOSE_X - 0.5)) ** 2 / 0.04 + (y - (NOSE_Y + 0.3)) ** 2 / 0.025 < 1 ? -0.45 : 0), k.face);
}

/**
 * Stubble over the jaw and the upper lip: hairs on skin, as an even pattern of a cool grey-beige
 * stubble tone in the skin (lit and shaded like the skin; see drawSkull). Heavy (Vincent's dark
 * stubble, a 5 o'clock shadow): clustered hair strokes of the darker stubble ramp on a cool
 * stubble shadow (drawSkull). Light: every fourth px, the jaw a touch darker.
 */
function drawStubble(k: Ctx, x: FaceExtra): void {
  if (x === 'heavy-stubble') return;
  k.c.shade(8, 13.6, 7.6, 5, (px, py) => (jawZone(px, py, false) > 0 ? -0.1 : 0), k.face);
}

/**
 * The stubble zone: below the cheek, behind the chin tip, above the jaw line, not on the lips.
 * 2 = inside, 1 = its fringe (½ logical px wide, drawn as an even checker), 0 = outside.
 */
function jawZone(x: number, y: number, heavy: boolean): number {
  if (Math.abs(y - MOUTH_Y) < 0.42 && x > 11.7) return 0;
  const top = 14.5 + Math.max(0, 10.4 - x) * 0.5 - (heavy ? 0.2 : 0);
  let m = Math.min(y - top, x - 8.4, 14.6 - x);
  if (!heavy) m = Math.min(m, Math.max(y - 15.75, x - 13.1));
  return m > 0.5 ? 2 : m > 0 ? 1 : 0;
}

/** Cheeks, crow's feet, forehead lines and freckles: marks on the lit skin. */
function drawSkinMarks(k: Ctx): void {
  const { c, look, s } = k;
  const blush = s.extras.includes('blush');
  if (look.rosy || blush) {
    // Rosy cheeks: a warm cluster on the cheekbone (the accent's ramp for a blush extra when the
    // accent is warm; a cool accent, e.g. a teal collar, blushes in PAL_HD.pink).
    const acc = blush ? hdRampOf(s.accent) : PAL_HD.pink;
    const warm = acc === PAL_HD.pink || acc === PAL_HD.red || acc === PAL_HD.orange || acc === PAL_HD.rust;
    const own = blush && warm;
    const pink = own ? acc : PAL_HD.pink;
    const a = pink[Math.min(pink.length - 1, own ? 4 : 5)];
    const b = pink[Math.min(pink.length - 1, own ? 5 : 6)];
    // The apple of the cheek, under and behind the eye (clear of a moustache).
    const cx = EYE_X - 1.15;
    const cy = EYE_Y + 1.1;
    c.paint(cx - 1.4, cy - 0.8, 2.8, 1.6, (x, y, X, Y) => {
      const q = ((x - cx) / 1.05) ** 2 + ((y - cy) / 0.5) ** 2;
      if (q > 1) return 0;
      // A solid core, the rim as an even checker at 4× (a soft edge without noise).
      if (q < 0.45) return look.rosy && !blush ? b : a;
      return c.d >= 4 && (X + Y) % 2 === 0 ? (look.rosy && !blush ? b : a) : 0;
    }, 0.1);
  }
  if (look.crow && c.d >= 4) {
    // Crow's feet: two short creases fanning back from the outer eye corner.
    c.shade(EYE_X - 2.6, EYE_Y - 1, 1.6, 2.2, (x, y) => {
      for (const [a, b] of [[-0.35, -0.2], [0.1, 0.35]] as const) {
        const t = (EYE_X - 1.1 - x) / 1.2;
        if (t < 0 || t > 1) continue;
        const cy = EYE_Y + a + (b - a) * t + t * 0.3 * (a < 0 ? -1 : 1);
        if (Math.abs(y - cy) < 0.13) return -0.34;
      }
      return 0;
    }, k.face);
  }
  if (look.forehead && c.d >= 4) {
    // Vincent: lines across the forehead over the raised brow.
    c.shade(EYE_X - 2, EYE_Y - 4, 3.6, 1.8, (x, y) => {
      for (const ly of [EYE_Y - 3.0, EYE_Y - 3.6]) {
        const cy = ly + Math.sin((x - EYE_X) * 1.3) * 0.12;
        if (Math.abs(y - cy) < 0.12 && Math.abs(x - EYE_X + 0.2) < 1.35) return -0.3;
      }
      return 0;
    }, k.face);
  }
  if (s.extras.includes('freckles')) {
    const dot = k.skinR[3];
    for (const [fx, fy] of [[11.0, 14.3], [12.3, 14.65], [13.3, 14.15], [10.2, 14.85], [12.0, 13.95]] as const) {
      c.paint(fx - 0.3, fy - 0.3, 0.6, 0.6, (px, py) => ((px - fx) ** 2 + (py - fy) ** 2 < (c.d >= 4 ? 0.07 : 0.2) ? dot : 0), 0.1);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Eye, brows, mouth
// ---------------------------------------------------------------------------------------------

function trait(s: HeadStyle, expr: Expression, part: 'eye' | 'mouth' | 'brow'): FaceExtra | null {
  let hit: FaceExtra | null = null;
  for (const x of s.extras) {
    const t = FACE_TRAITS[x];
    if (t && t.part === part && t.on.has(expr)) hit = x;
  }
  return hit;
}

function drawEye(k: Ctx, glint: boolean): void {
  const { c, s, expr, look } = k;
  const ink = PAL_HD.ink[0];
  const lash = PAL_HD.ink[1];
  const white = PAL_HD.snow[5];
  const whiteSh = PAL_HD.snow[3];
  const t = trait(s, expr, 'eye');
  const blue = t === 'blue-eyes';
  const iris = blue ? PAL_HD.sky : look.iris;
  const ex = EYE_X;
  const ey = EYE_Y;
  const lid = k.skinR[3];
  // Closed and squinted eyes: a curved lash line, the lid fold over it at 4×.
  const arc = (bend: number, dy: number, w0: number): void => {
    c.paint(ex - 1.25, ey - 1.5, 2.6, 2.8, (x, y) => {
      const tt = (x - (ex - 1.0)) / 2.0;
      if (tt < 0 || tt > 1) return 0;
      const cy = ey + dy - bend * Math.sin(tt * Math.PI);
      const w = w0 * (0.75 + 0.25 * Math.sin(tt * Math.PI));
      if (Math.abs(y - cy) < w) return ink;
      if (c.d >= 4 && bend < 0 && y < cy - w && y > cy - w - 0.3 && tt > 0.18 && tt < 0.82) return lid;
      return 0;
    });
  };
  if (expr === 'blink' || expr === 'yawn' || expr === 'chew') {
    arc(-0.3, 0.4, 0.3);
    return;
  }
  if (t === 'beam' || expr === 'happy') {
    // Happy squint: an upturned arc (the 2× ∩).
    arc(0.6, 0.55, 0.3);
    return;
  }
  if (c.d === 2) {
    // 2×: the eye is 3 × 4 art px; a designed cluster reads better than a sampled shape.
    const rows = eye2x(expr, blue, s.extras.includes('eyeshine') && EYESHINE_EXPR.has(expr));
    if (rows) {
      const X0 = Math.round((ex - 0.75) * 2);
      const Y0 = Math.round((ey - 0.95) * 2);
      const key = (ch: string): Color => {
        switch (ch) {
          case 'k':
            return ink;
          case 'w':
            return white;
          case 's':
            return whiteSh;
          case 'W':
            return glint ? white : ink;
          case 'l':
            return iris[3];
          default:
            return 0;
        }
      };
      c.paint(X0 / 2, Y0 / 2, 2, 2.5, (_x, _y, X, Y) => {
        const r = rows[Y - Y0];
        return r === undefined ? 0 : key(r[X - X0] ?? '.');
      });
      return;
    }
  }
  if (expr === 'hurt') {
    // Squeezed shut: a chevron pointing back.
    c.paint(ex - 1.1, ey - 1.3, 2.4, 2.6, (x, y) => {
      const dx = x - (ex - 0.85);
      if (dx < 0 || dx > 1.75) return 0;
      const a = ey - 0.05 - dx * 0.5;
      const b = ey - 0.05 + dx * 0.5;
      return Math.abs(y - a) < 0.27 || Math.abs(y - b) < 0.27 ? ink : 0;
    });
    return;
  }
  const wide = expr === 'panic' || expr === 'dazed' || expr === 'soot';
  const rx = wide ? 1.0 : 0.98;
  const ry = wide ? 1.3 : 1.28;
  const shine = s.extras.includes('eyeshine') && EYESHINE_EXPR.has(expr);
  // The big dark iris fills the eye; the white shows as a crescent in front of it (the style
  // round's eye). Wide eyes: a small pupil low in front in a ring of white.
  const icx = wide ? ex + 0.25 : ex - 0.12;
  const icy = wide ? ey + 0.35 : ey + 0.05;
  const ir = wide ? 0.5 : 0.9;
  const pr = wide ? 0.32 : 0.46;
  // Catchlight: one art px at 2×, a 2 × 2 cluster at 4× (d/2 square above), upper back of the pupil.
  const gs = c.d >= 4 ? c.d / 2 : 1;
  const gX = Math.floor((icx - pr - 0.05) * c.d + (c.d >= 4 ? 0 : 0.5));
  const gY = Math.floor((icy - pr - 0.05) * c.d + (c.d >= 4 ? 0 : 0.5));
  const irisCol = c.d >= 4 || blue;
  c.paint(ex - 1.3, ey - 1.6, 2.7, 3.2, (x, y, X, Y) => {
    const u = (x - ex) / rx;
    const v = (y - ey) / ry;
    // The opening: an almond, rounder at the back, the lower lid flatter.
    const q = u * u + (v > 0 ? v * v * 1.12 : v * v);
    if (q > 1) return 0;
    if (glint && X >= gX && X < gX + gs && Y >= gY && Y < gY + gs) return white;
    if (shine && X === gX - 1 && Y >= gY && Y < gY + gs) return white;
    // The upper lid: a thick lash line.
    if (v < -0.66 || (v < -0.42 && u < -0.6)) return ink;
    const di = Math.hypot(x - icx, y - icy);
    if (!wide || di < ir) {
      if (di < ir) {
        if (di < pr || !irisCol) return ink;
        // The iris: a dark ring, lit low on the side away from the catchlight (light passes through).
        // Dark, so the eye still reads as the big dark eye at sprite size.
        if (di > ir - (c.d >= 4 ? 0.22 : 0.3)) return blue ? iris[0] : lash;
        const lit = (x - icx) * 0.5 + (y - icy) * 0.9;
        return lit > 0.3 ? iris[3] : iris[1];
      }
    }
    // The white: in the lid's shade at the top.
    return v < -0.25 ? whiteSh : white;
  });
  if (c.d >= 4 && !wide) {
    // The lower lid: a soft skin line under the eye.
    c.shade(ex - 1, ey + 0.9, 2.2, 0.6, (x, y) => (Math.abs(y - (ey + ry * 0.95 + 0.12)) < 0.13 && Math.abs(x - ex) < 0.7 ? -0.3 : 0), k.face);
  }
}

/**
 * The 2× open eyes (3 × 4 art px from the eye's top-left): k ink, w white, s white in shade,
 * W the catchlight (ink on a tilted head), l the iris. Closed eyes are drawn as arcs.
 */
function eye2x(expr: Expression, blue: boolean, shine: boolean): readonly string[] | null {
  switch (expr) {
    case 'normal':
    case 'shout':
      return blue ? ['kkk', 'Wls', 'lkw', 'll.'] : shine ? ['kkk', 'WWs', 'kkw', 'kk.'] : ['kkk', 'Wks', 'kkw', 'kk.'];
    case 'panic':
      return ['ss.', 'www', 'wkk', 'wkk'];
    case 'dazed':
      return ['.w.', 'wkw', 'wwk', '.w.'];
    case 'soot':
      return ['www', 'wkw', 'www', '.w.'];
    case 'hurt':
      return ['...', '.kk', 'k..', '.kk'];
    default:
      return null;
  }
}

function drawBrows(k: Ctx): void {
  const { c, s, expr, look } = k;
  if (expr === 'dazed' || expr === 'soot') return;
  const dark = k.hairR[Math.max(0, k.hairLo)];
  const mid = k.hairR[Math.min(k.hairR.length - 1, k.hairLo + 1)];
  const t = trait(s, expr, 'brow');
  // Brow: from the temple (t = 0) to over the front of the eye (t = 1).
  let lift = 0;
  let tilt = 0;
  let arch = 0.3;
  if (expr === 'shout') lift = -0.35; // raised and flat: shouting, never angry (as the 2× brow)
  if (expr === 'happy') lift = -0.3;
  if (expr === 'panic') {
    lift = -0.6;
    tilt = -0.45;
    arch = 0.45;
  }
  if (expr === 'hurt') tilt = -0.55;
  if (t === 'raised-brow') {
    lift = -0.95;
    arch = 0.85;
  }
  const w0 = look.brow;
  const x0 = EYE_X - 1.25;
  const len = 2.55;
  const y0 = EYE_Y - 2.05 + lift;
  c.paint(x0 - 0.3, y0 - 1.7, len + 0.6, 3.0, (x, y) => {
    const tt = (x - x0) / len;
    if (tt < 0 || tt > 1) return 0;
    const cy = y0 - Math.sin(tt * Math.PI * 0.9) * arch + (tt - 0.5) * tilt;
    // Full over the eye, a fine tail towards the temple, the front end rounded off.
    const w = w0 * (0.42 + 0.58 * smooth(0, 0.6, tt)) * (tt > 0.88 ? 0.8 : 1);
    const dy = y - cy;
    if (Math.abs(dy) >= w) return 0;
    // Hairs: the upper edge in the mid tone at 4×.
    return c.d >= 4 && dy < -w * 0.35 && tt > 0.2 && tt < 0.85 ? mid : dark;
  });
}

function drawMouth(k: Ctx): void {
  const { c, s, expr } = k;
  if (expr === 'soot') {
    // A small startled mouth in the blackened face.
    const ink = PAL_HD.ink[1];
    c.paint(MOUTH_X - 0.8, MOUTH_Y, 1.8, 1, (x, y) => (Math.abs(y - (MOUTH_Y + 0.55)) < 0.25 && x > MOUTH_X - 0.6 && x < MOUTH_X + 0.8 ? ink : 0));
    return;
  }
  const ink = PAL_HD.ink[0];
  const inside = PAL_HD.red[1];
  const tongue = PAL_HD.red[4];
  const teeth = PAL_HD.snow[5];
  const teethSh = PAL_HD.snow[3];
  const sk = k.skinR;
  const lipLo = sk[2];
  const lip = sk[3];
  const lipHi = sk[Math.min(sk.length - 1, 6)];
  const t = trait(s, expr, 'mouth');
  const open = expr === 'shout' || expr === 'panic' || expr === 'yawn';
  if (s.extras.includes('walrus') && !open) return;
  const mx = MOUTH_X;
  const my = MOUTH_Y;
  if (t === 'grin') {
    // Thom's huge toothy grin: a half-moon from the back corner (pulled up into the cheek) to the
    // front; the upper teeth fill it, the lower teeth in shade under a dark gap, a lit lower lip.
    const x0 = mx - 2.75;
    const x1 = mx + 1.35;
    c.paint(x0 - 0.3, my - 1.6, x1 - x0 + 0.6, 3.4, (x, y) => {
      const tt = (x - x0) / (x1 - x0);
      if (tt < 0 || tt > 1) return 0;
      const top = my - 0.55 - (1 - tt) * (1 - tt) * 0.65;
      const bot = top + 0.25 + 1.45 * Math.sin(Math.min(1, tt * 1.15) * Math.PI * 0.92);
      if (y < top - 0.26 || y > bot + 0.28) return 0;
      if (y < top || y > bot) return y > bot + 0.1 && c.d >= 4 && tt > 0.3 && tt < 0.85 ? lipHi : lipLo;
      const gap = top + (bot - top) * 0.58;
      if (Math.abs(y - gap) < (c.d >= 4 ? 0.13 : 0.2)) return ink;
      if (y > gap) return tt < 0.2 || tt > 0.9 ? ink : teethSh;
      // Tooth seams on the upper row at 4×.
      if (c.d >= 4 && Math.abs(((x - x0) / 0.62) % 1) < 0.16 && tt > 0.15) return teethSh;
      return teeth;
    });
    return;
  }
  if (expr === 'hurt') {
    // A grimace: the lips pulled wide and tight over clenched teeth, the corners down.
    c.paint(mx - 1.9, my - 1.0, 3.5, 2.1, (x, y) => {
      const tt = (x - (mx - 1.6)) / 2.9;
      if (tt < 0 || tt > 1) return 0;
      const sag = Math.abs(tt - 0.5) * 2;
      const top = my - 0.42 + sag * sag * 0.3;
      const bot = my + 0.48 + sag * sag * 0.05 - sag * sag * sag * 0.35;
      if (y < top - 0.24 || y > bot + 0.24) return 0;
      if (y < top || y > bot || tt < 0.06 || tt > 0.94) return lipLo;
      // The teeth: a light row with seams at 4×, the gap between the rows in ink.
      if (Math.abs(y - (top + bot) / 2) < (c.d >= 4 ? 0.12 : 0.18)) return ink;
      if (c.d >= 4 && Math.abs(((x - mx + 3) / 0.55) % 1) < 0.2) return teethSh;
      return y > (top + bot) / 2 ? teethSh : teeth;
    });
    return;
  }
  if (open) {
    const h = expr === 'yawn' ? 1.9 : 1.3;
    const w = expr === 'panic' ? 0.82 : 1.0;
    c.paint(mx - 1.4, my - 0.9, 2.9, h + 1.6, (x, y) => {
      const u = (x - (mx + 0.05)) / w;
      const v = (y - (my + h * 0.32)) / (h * 0.64);
      const q = u * u + v * v;
      if (q > 1) return 0;
      if (q > 0.62) return v < 0 ? lipLo : lip;
      if (expr === 'shout' && v < -0.2 && c.d >= 4) return teeth;
      if (v > 0.2 && q < 0.48) return tongue;
      return v < -0.35 && expr !== 'yawn' ? ink : inside;
    });
    return;
  }
  if (t === 'smirk') {
    // Vincent's lopsided smirk: the back corner pulled up hard, a dimple there.
    c.paint(mx - 2.1, my - 1.5, 3.4, 2.4, (x, y) => {
      const tt = (x - (mx - 1.8)) / 2.75;
      if (tt < 0 || tt > 1) return 0;
      const cy = my + 0.1 - (1 - tt) * (1 - tt) * 1.15;
      if (Math.abs(y - cy) < 0.26) return lipLo;
      if (c.d >= 4 && y > cy + 0.26 && y < cy + 0.52 && tt > 0.35 && tt < 0.9) return lipHi;
      return 0;
    });
    if (c.d >= 4) c.shade(mx - 2.3, my - 1.8, 0.8, 0.9, (x, y) => (Math.abs(x - (mx - 2.0)) < 0.13 && Math.abs(y - (my - 1.25)) < 0.3 ? -0.3 : 0), k.face);
    return;
  }
  // Line mouths: the lip parting in the deep skin tone, the lower lip catching the light at 4×.
  let smile = 0;
  let wav = 0;
  let span = 2.15;
  let x0 = mx - 1.25;
  if (expr === 'happy') smile = 0.45;
  if (expr === 'dazed') wav = 0.3;
  if (expr === 'chew') {
    span = 1.6;
    x0 = mx - 0.6;
    smile = -0.15;
  }
  if (k.squad === 'patrick' || k.squad === 'bob') smile = Math.max(smile, 0.18); // a confident / calm half-smile
  c.paint(x0 - 0.2, my - 1.3, span + 0.5, 2.5, (x, y) => {
    const tt = (x - x0) / span;
    if (tt < 0 || tt > 1) return 0;
    const cy = my - smile * Math.sin(tt * Math.PI * 0.85) * (k.squad ? 1 : 1) + (tt - 0.5) * 0.12 + Math.sin(tt * 9) * wav;
    if (Math.abs(y - cy) < 0.26) return tt > 0.86 || tt < 0.1 ? lip : lipLo;
    if (c.d >= 4 && y > cy + 0.26 && y < cy + 0.52 && tt > 0.22 && tt < 0.8) return lipHi;
    return 0;
  });
}

// ---------------------------------------------------------------------------------------------
// Face extras
// ---------------------------------------------------------------------------------------------

function drawExtra(k: Ctx, x: FaceExtra): void {
  const { c } = k;
  switch (x) {
    case 'moustache':
    case 'thick-mustache':
    case 'walrus':
    case 'beard':
      drawFacialHair(k, x);
      return;
    case 'thin-mustache': {
      // Patrick's trimmed line under the nose, the lit top hairs at 4×.
      const dark = k.hairR[Math.min(k.hairR.length - 1, k.hairLo)];
      const hi = k.hairR[Math.min(k.hairR.length - 1, k.hairLo + 2)];
      c.paint(MOUTH_X - 1.4, MOUTH_Y - 1.4, 2.9, 1.1, (px, py) => {
        const tt = (px - (MOUTH_X - 1.2)) / 2.4;
        if (tt < 0 || tt > 1) return 0;
        const cy = MOUTH_Y - 0.75 + Math.abs(tt - 0.55) * 0.3;
        const w = 0.2 + Math.sin(tt * Math.PI) * 0.08;
        if (Math.abs(py - cy) >= w) return 0;
        return c.d >= 4 && py < cy - 0.04 && tt > 0.3 && tt < 0.75 ? hi : dark;
      });
      return;
    }
    case 'glasses':
    case 'shades': {
      const shades = x === 'shades';
      const frame = PAL_HD.ink[0];
      const arm = PAL_HD.ink[1];
      const lx0 = EYE_X - 1.3;
      const lx1 = EYE_X + 1.45;
      const ly0 = EYE_Y - (shades ? 1.1 : 1.35);
      const ly1 = EYE_Y + (shades ? 0.95 : 1.2);
      c.paint(8.4, ly0 - 0.6, 7.6, ly1 - ly0 + 1.2, (px, py) => {
        // The arm back to the ear.
        if (px < lx0 + 0.1 && py > ly0 + 0.02 && py < ly0 + 0.4 && px > 8.6) return arm;
        if (px < lx0 - 0.05 || px > lx1 + 0.05) return 0;
        const inside = py > ly0 && py < ly1 && px > lx0 && px < lx1;
        if (!inside) return 0;
        const e = Math.min(py - ly0, ly1 - py, px - lx0, lx1 - px);
        const corner = (px - lx0 < 0.5 || lx1 - px < 0.5) && (py - ly0 < 0.5 || ly1 - py < 0.5);
        if (corner && e < 0.14) return 0;
        if (e < (c.d >= 4 ? 0.3 : 0.4)) return frame;
        // The lens: a diagonal glare band over the glass.
        const g = px - lx0 + (py - ly0) * 0.9;
        if (shades) return g > 0.45 && g < 0.95 ? PAL_HD.sky[3] : g > 1.3 && g < 1.45 && c.d >= 4 ? PAL_HD.steel[4] : py > ly1 - 0.45 ? PAL_HD.navy[2] : PAL_HD.navy[1];
        return g > 0.5 && g < 0.95 ? PAL_HD.sky[6] : 0;
      });
      return;
    }
    default:
      // freckles, blush, eyeshine, stubble, bushy-brows and the face traits: drawn elsewhere.
      return;
  }
}

// ---------------------------------------------------------------------------------------------
// Hair: locks and curls
// ---------------------------------------------------------------------------------------------

/**
 * A lock: an elongated dome centred (cx, cy), half length `len` along the angle `a` (radians,
 * 0 = pointing right, + = down), half width `wid`; it tapers towards its tip (+ along `a`).
 */
interface Lock {
  cx: number;
  cy: number;
  len: number;
  wid: number;
  a: number;
}

const L = (cx: number, cy: number, len: number, wid: number, a: number): Lock => ({ cx, cy, len, wid, a });

/**
 * Locks per hair style (head-buffer coordinates; the footprint is the 1× template). Each lock
 * makes one highlight cluster on its upper left; locks meet in grooves.
 */
const LOCKS: Readonly<Partial<Record<HairStyle | 'moustache' | 'thick-mustache' | 'walrus' | 'bushy-brows', readonly Lock[]>>> = {
  // The recruit (style round 1, lead-approved): the crown along the part, a fringe swept forward
  // over the forehead, a short lock at the temple, the back swept down and back, the nape.
  short: [L(9.4, 7.0, 3.6, 1.3, 0.1), L(11.6, 8.7, 3.0, 1.4, 0.5), L(13.3, 9.7, 1.7, 0.95, 0.7), L(9.6, 9.4, 1.3, 0.85, 1.2), L(5.4, 8.6, 3.6, 1.9, 2.2), L(4.4, 12.4, 2.2, 1.4, 1.75)],
  parted: [L(6.3, 7.3, 2.6, 1.3, 2.7), L(4.9, 9.6, 2.6, 1.4, 2.0), L(4.3, 12.4, 2.0, 1.2, 1.75), L(10.4, 7.5, 2.8, 1.25, 0.3), L(12.5, 9.0, 2.2, 1.05, 0.7), L(9.7, 9.7, 1.3, 0.8, 1.15)],
  'short-crop': [L(9.0, 6.9, 3.2, 1.2, 0.05), L(11.4, 8.0, 1.9, 0.95, 0.55), L(5.7, 8.4, 3.0, 1.6, 2.2), L(4.4, 11.6, 2.0, 1.25, 1.8), L(7.8, 9.7, 1.4, 0.9, 1.35)],
  'slick-back': [L(11.6, 6.4, 3.4, 1.05, 3.08), L(7.2, 6.3, 3.0, 1.05, 3.0), L(11.6, 8.2, 3.4, 1.0, 2.98), L(6.8, 8.4, 3.2, 1.15, 2.75), L(4.9, 10.8, 2.2, 1.15, 2.1), L(4.2, 12.4, 1.3, 0.9, 1.8)],
  'swept-up': [L(12.0, 6.3, 3.2, 1.2, -1.95), L(9.5, 5.3, 3.0, 1.2, -2.35), L(7.0, 6.6, 2.9, 1.25, -2.65), L(13.2, 7.6, 1.8, 0.9, -1.6), L(5.0, 9.0, 2.6, 1.4, 2.35), L(4.1, 11.6, 1.8, 1.1, 1.9)],
  spiky: [L(5.6, 5.8, 2.3, 0.95, -1.95), L(8.6, 5.6, 2.3, 0.95, -1.6), L(11.6, 5.8, 2.3, 0.95, -1.25), L(13.6, 7.6, 1.6, 0.85, -0.7), L(11.2, 8.8, 2.4, 1.2, 0.45), L(13.4, 9.7, 1.5, 0.9, 0.75), L(6.6, 8.4, 2.4, 1.4, -2.6), L(4.6, 10.4, 2.4, 1.3, 2.2), L(4.4, 12.6, 1.8, 1.1, 1.8)],
  'spiky-messy': [L(4.6, 5.6, 2.1, 0.9, -2.05), L(7.5, 5.4, 2.3, 0.9, -1.65), L(10.5, 5.5, 2.2, 0.9, -1.35), L(12.6, 5.8, 1.9, 0.8, -0.95), L(14.2, 7.3, 1.6, 0.8, -0.45), L(13.9, 9.2, 1.7, 0.85, 0.35), L(11.0, 8.4, 2.2, 1.15, 0.55), L(6.6, 8.2, 2.3, 1.35, -2.6), L(3.4, 9.4, 2.2, 1.05, 2.75), L(4.0, 12.0, 2.0, 1.1, 2.0), L(8.9, 9.8, 1.2, 0.8, 1.0)],
  mohawk: [L(6.6, 5.4, 2.0, 0.95, -1.8), L(5.6, 6.9, 1.9, 0.95, -2.3), L(7.9, 7.3, 1.5, 0.85, -1.35)],
  long: [L(9.3, 7.0, 3.4, 1.3, 0.2), L(11.6, 8.6, 2.6, 1.3, 0.55), L(13.2, 9.6, 1.5, 0.9, 0.8), L(6.1, 8.1, 3.0, 1.6, 2.5), L(3.4, 11.2, 3.3, 1.15, 1.62), L(5.2, 12.0, 3.0, 1.1, 1.75), L(3.3, 14.6, 1.9, 1.0, 1.5), L(4.8, 15.0, 1.6, 0.9, 1.65)],
  ponytail: [L(9.3, 7.0, 3.4, 1.3, 0.2), L(11.6, 8.6, 2.6, 1.3, 0.55), L(13.2, 9.6, 1.5, 0.9, 0.8), L(6.1, 8.1, 3.0, 1.6, 2.5), L(4.4, 10.8, 2.2, 1.2, 2.3), L(2.4, 12.9, 2.6, 1.05, 1.68), L(4.5, 12.2, 1.5, 0.8, 1.9)],
  bob: [L(9.1, 7.0, 3.4, 1.3, 0.2), L(11.6, 8.7, 2.6, 1.3, 0.6), L(13.2, 10.0, 1.6, 0.85, 0.95), L(6.0, 8.2, 3.0, 1.6, 2.4), L(3.5, 11.3, 2.9, 1.25, 1.6), L(5.4, 12.0, 2.4, 1.1, 1.72), L(3.9, 13.7, 1.4, 1.0, 1.4)],
  // Facial hair: locks hanging down (a moustache droops over the lip).
  moustache: [L(11.4, 14.4, 1.4, 0.75, 2.2), L(13.3, 14.4, 1.4, 0.75, 1.0), L(10.6, 15.3, 0.9, 0.6, 1.9), L(14.4, 15.3, 0.9, 0.6, 1.3)],
  'thick-mustache': [L(11.6, 14.5, 1.7, 0.95, 2.45), L(13.6, 14.4, 1.7, 0.95, 0.75), L(12.6, 15.4, 1.2, 0.7, 1.6), L(14.9, 15.3, 0.9, 0.6, 1.2)],
  walrus: [L(11.2, 14.7, 1.8, 1.1, 2.0), L(13.6, 14.6, 1.8, 1.1, 1.2), L(10.2, 16.3, 1.4, 0.8, 1.7), L(12.4, 16.4, 1.4, 0.8, 1.6), L(14.7, 16.3, 1.3, 0.8, 1.45)],
  'bushy-brows': [L(11.2, 11.0, 1.6, 0.7, -0.3), L(12.6, 10.6, 1.2, 0.6, -0.2)],
};

/** Styles drawn as curls (round tufts) instead of locks. */
const CURLY: ReadonlySet<string> = new Set(['curly', 'puffs', 'tufts', 'beard']);

interface LockHit {
  best: number;
  second: number;
  /** Position along the best lock (−1 root … 1 tip) and across it (−1 … 1). */
  u: number;
  v: number;
}
const hitScratch: LockHit = { best: -1, second: -1, u: 0, v: 0 };

function lockAt(x: number, y: number, locks: readonly Lock[], out: LockHit): LockHit {
  out.best = -1;
  out.second = -1;
  for (const lk of locks) {
    const ca = Math.cos(lk.a);
    const sa = Math.sin(lk.a);
    const u = ((x - lk.cx) * ca + (y - lk.cy) * sa) / lk.len;
    const v = (-(x - lk.cx) * sa + (y - lk.cy) * ca) / lk.wid;
    // Tapered towards the tip: a lock ends in a point.
    const w = u > 0 ? 1 - u * 0.5 : 1;
    const q = u * u + (v * v) / (w * w);
    const b = q >= 1 ? -1 + (q < 2 ? (2 - q) * 0.0 : 0) : Math.sqrt(1 - q);
    if (b > out.best) {
      out.second = out.best;
      out.best = b;
      out.u = u;
      out.v = v / w;
    } else if (b > out.second) out.second = b;
  }
  return out;
}

interface CurlHit {
  /** Dome height of the topmost curl here (0 = between curls). */
  h: number;
  /** Distance from that curl's centre, in its radii. */
  r: number;
  /** Direction from the centre (unit-free). */
  dx: number;
  dy: number;
}
const curlScratch: CurlHit = { h: 0, r: 1, dx: 0, dy: 0 };

/**
 * Curls: round tufts on a jittered staggered grid (each a little different in size and place,
 * never a knitted grid), the topmost one at (x, y). Seeded per style; pure.
 */
function curlAt(x: number, y: number, size: number, seed: number, out: CurlHit = curlScratch): CurlHit {
  const rh = size * 0.86;
  const row0 = Math.floor(y / rh);
  out.h = 0;
  out.r = 9;
  out.dx = 0;
  out.dy = 0;
  for (let row = row0 - 1; row <= row0 + 1; row++) {
    const off = (row & 1) * 0.5;
    const col0 = Math.floor(x / size - off);
    for (let col = col0 - 1; col <= col0 + 1; col++) {
      const cx = (col + 0.5 + off) * size + (hash2(col, row, seed) - 0.5) * size * 0.45;
      const cy = (row + 0.5) * rh + (hash2(row, col, seed + 1) - 0.5) * size * 0.4;
      const rad = size * (0.56 + 0.18 * hash2(col + 7, row - 3, seed + 2));
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy) / rad;
      if (r >= 1) continue;
      const h = Math.sqrt(1 - r * r) * (0.8 + 0.4 * hash2(col - 5, row + 9, seed + 3));
      if (h > out.h) {
        out.h = h;
        out.r = r;
        out.dx = dx;
        out.dy = dy;
      }
    }
  }
  return out;
}

/** The head volume under hair and hats: a sphere round the skull (0..1). */
function headSphere(x: number, y: number): number {
  return dome(x, y, 9.1, 12.0, 7.4, 7.5);
}

/** Scalp hair sits below facial hair and headgear, above the face (see sinkNeck). */
function sunk(t: Texture): Texture {
  return (p) => {
    t(p);
    p.dz = HAIR_SINK;
  };
}

/** Draw the style's hair; returns where it is (for the fringe's shadow) or null. */
function drawHair(k: Ctx): ((x: number, y: number) => boolean) | null {
  const { c, s } = k;
  const style = s.hairStyle;
  if (style === 'bald') return null;
  const g = new Grid().stamp(HAIR[style], 0, (ch) => ch === 'h' || ch === 'H' || ch === 'L');
  if (!g.any) return null;
  const sh = shapeOf(c, g, style === 'buzz' ? 0.8 : 1.1);
  const part = c.newPart();
  const cutY = k.cutY;
  const cutX = k.cutX;
  const cut = (x: number, y: number): boolean => y < cutY || x < cutX;
  const inside = (x: number, y: number): boolean => sh.edge.at(x, y) >= 0.5 && !cut(x, y);
  if (style === 'buzz') {
    // A close crop: a thin even cap over the skull, the skin glowing through at a soft hairline.
    c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
      if (sh.edge.at(x, y) < 0.5 || cut(x, y)) return NaN;
      return 4.2 * headSphere(x, y) + 0.55 * roll(sh.body.at(x, y));
    }, { mat: k.hair, part, z: 0.4, tone: -0.06, tex: sunk(buzzTex(sh)) });
    return inside;
  }
  if (CURLY.has(style)) {
    const size = (style === 'tufts' ? 1.5 : 1.8) * (c.d >= 4 ? 1 : 1.1);
    const seed = style === 'puffs' ? 11 : style === 'tufts' ? 5 : 3;
    const amp = c.d >= 4 ? 0.55 : 0.7;
    c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
      if (sh.edge.at(x, y) < 0.5 || cut(x, y)) return NaN;
      const cu = curlAt(x, y, size, seed);
      return 3.0 * headSphere(x, y) + 1.4 * roll(sh.body.at(x, y)) + amp * cu.h;
    }, { mat: k.hair, part, z: 0.4, tex: sunk(curlTex(size, seed)) });
    return inside;
  }
  const locks = LOCKS[style] ?? LOCKS.short ?? [];
  const glossy = style === 'slick-back';
  if (style === 'short') {
    // The recruit's hair as the style round approved it: a squarish cap (flat on top), the
    // hairline clear of the ear, the fringe of locks hanging over the forehead. The outer
    // silhouette is the 1× head's (hair and skull); inside it the fringe may cover the skull.
    const outer = shapeOf(c, new Grid().stamp(HAIR.short, 0, (ch) => ch === 'h' || ch === 'H' || ch === 'L').stamp({ at: [0, 0], rows: SKULL }), 1.1);
    const has = (x: number, y: number): boolean => {
      if (outer.edge.at(x, y) < 0.5 || cut(x, y)) return false;
      const dx = (x - 9.1) / 6.3;
      const dy = (y - 11.3) / 5.0;
      const q = Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6);
      const bottom = x < 6.0 ? 14.6 - Math.max(0, 4.4 - x) * 0.6 : x < 8.3 ? 11.2 : x < 8.8 ? 11.9 : 9.5;
      return (q < 1 && y < bottom) || lockAt(x, y, locks, hitScratch).best > 0;
    };
    c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
      if (!has(x, y)) return NaN;
      const dx = (x - 9.1) / 6.3;
      const dy = (y - 11.3) / 5.0;
      const q = Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6);
      const hit = lockAt(x, y, locks, hitScratch);
      const cap = q < 1 ? Math.sqrt(1 - q) * 4.2 : 0.6;
      return 0.6 + cap + (hit.best > 0 ? hit.best * (c.d >= 4 ? 0.7 : 0.5) : -0.12);
    }, { mat: k.hair, part, z: 0.4, tone: -0.04, tex: sunk(lockTex(locks, false)) });
    return has;
  }
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (sh.edge.at(x, y) < 0.5 || cut(x, y)) return NaN;
    const hit = lockAt(x, y, locks, hitScratch);
    const lockH = hit.best > 0 ? hit.best * (glossy ? 0.5 : 0.95) * (c.d >= 4 ? 1 : 0.7) : -0.2;
    return 2.4 * headSphere(x, y) + 1.0 * roll(sh.body.at(x, y)) + lockH;
  }, { mat: k.hair, part, z: 0.4, tone: glossy ? -0.14 : -0.03, tex: sunk(lockTex(locks, glossy)) });
  return inside;
}

/** Lock grooves: where two locks meet, a dark crease (4×); slick hair gets a sheen streak along each lock. */
function lockTex(locks: readonly Lock[], glossy: boolean): Texture {
  const hit: LockHit = { best: -1, second: -1, u: 0, v: 0 };
  return (p) => {
    lockAt(p.x, p.y, locks, hit);
    if (hit.best <= 0) {
      p.tone -= p.d >= 4 ? 0.22 : 0.12;
      return;
    }
    // Grooves only at 4× (thinner than an art px at 2×, they would break into dots there).
    const gap = hit.best - Math.max(0, hit.second);
    if (p.d >= 4 && gap < 0.16) p.tone -= 0.26 * (1 - gap / 0.16);
    if (glossy && p.d >= 4 && Math.abs(hit.v + 0.2) < 0.12 && hit.u > -0.7 && hit.u < 0.4) p.tone += 0.12;
  };
}

/** Curl texture: each curl a round tuft, a dark crescent on its lower right. */
function curlTex(size: number, seed: number): Texture {
  const hit: CurlHit = { h: 0, r: 1, dx: 0, dy: 0 };
  return (p) => {
    const cu = curlAt(p.x, p.y, size, seed, hit);
    // Between curls a dark gap; each curl's lower-right rim in shade (a crescent), at 4× only the
    // gaps are lines thin enough to keep clean.
    if (cu.h === 0) p.tone -= p.d >= 4 ? 0.3 : 0.2;
    else if (cu.r > 0.68 && cu.dx * 0.6 + cu.dy * 0.8 > 0) p.tone -= p.d >= 4 ? 0.22 : 0.1;
  };
}

/** Buzz cut: the hairline thins out (skin shows through as an even checker at 4×). */
function buzzTex(sh: Shape): Texture {
  return (p) => {
    // At 4× an even grain of lighter hair tips (short bristles catching the light).
    if (p.d >= 4 && (p.X + 2 * p.Y) % 5 === 0 && p.Y % 2 === 0) p.tone += 0.16;
    const e = sh.edge.at(p.x, p.y);
    if (e < 0.62 && p.x > 8.5) {
      if (p.d >= 4 && (p.X + p.Y) % 2 === 0) p.cut = true;
      else if (p.d < 4 && e < 0.55) p.cut = true;
    }
  };
}

/** The fringe and the hairline cast a soft shadow on the skin (light from the upper left). */
function hairShadow(k: Ctx, has: (x: number, y: number) => boolean): void {
  k.c.shade(3, 5, 13, 12, (x, y) => (!has(x, y) && has(x - 0.35, y - 0.55) && y >= k.cutY + 0.4 ? -0.24 : 0), k.face);
}

/** Facial hair as locks / curls over the 1× extra's footprint. */
function drawFacialHair(k: Ctx, x: FaceExtra): void {
  const { c } = k;
  const g = new Grid().stamp(EXTRAS[x], 0, (ch) => ch === 'h' || ch === 'H' || ch === 'L');
  if (!g.any) return;
  const sh = shapeOf(c, g, 0.9);
  const z = x === 'bushy-brows' ? 1.2 : 0.9;
  if (CURLY.has(x)) {
    c.heightField(0, 0, HEAD_W, HEAD_H, (px, py) => {
      if (sh.edge.at(px, py) < 0.5) return NaN;
      const cu = curlAt(px, py, 1.3, 9);
      return 1.2 * roll(sh.body.at(px, py)) + 0.6 * cu.h + 1.5 * dome(px, py, 11, 14.5, 5, 4);
    }, { mat: k.hair, z, tex: curlTex(1.3, 9) });
    return;
  }
  const locks = LOCKS[x as 'moustache'] ?? [];
  c.heightField(0, 0, HEAD_W, HEAD_H, (px, py) => {
    if (sh.edge.at(px, py) < 0.5) return NaN;
    const hit = lockAt(px, py, locks, hitScratch);
    return 1.2 * roll(sh.body.at(px, py)) + (hit.best > 0 ? hit.best * 0.6 : -0.1);
  }, { mat: k.hair, z, tex: lockTex(locks, false) });
}

// ---------------------------------------------------------------------------------------------
// Headgear
// ---------------------------------------------------------------------------------------------

interface GearMats {
  gear: number;
  accent: number;
  brass: number;
  lens: number;
}

/**
 * The light bands of a headgear / accent ramp: the HD tones the style's 1× ramp spans (so a black
 * cap stays black and a navy cap navy), widened by one tone below for the shade; the top tones stay
 * free for sheen.
 */
function clothSpan(r: Ramp): { ramp: Ramp; lo: number; hi: number } {
  const ramp = hdRampOf(r);
  const n = ramp.length;
  let a = n;
  let b = -1;
  for (const col of r) {
    const h = hdHome(col);
    const i = h && h.ramp === ramp ? h.i : ramp.indexOf(col);
    if (i < 0) continue;
    a = Math.min(a, i);
    b = Math.max(b, i);
  }
  if (b < 0) return { ramp: oneHue(ramp), lo: 1, hi: n - 2 };
  const lo = Math.max(1, a - 1);
  const hi = Math.max(lo + 2, Math.min(n - 1, b));
  // A black cap keeps one hue (no purple / blue patches).
  return { ramp: oneHue(ramp), lo: Math.min(lo, n - 3), hi: Math.min(hi, n - 1) };
}

/** The headgear template's cells on the head grid (with the slip), filtered by letter and cell. */
function gearGrid(kind: Exclude<Headgear, 'none'>, slip: number, pick: (ch: string, gx: number, gy: number) => boolean): Grid {
  // The template moves in whole px on the grid; the sub-px rest of the slip shifts the fields.
  return new Grid().stamp(GEAR[kind], Math.floor(slip), pick);
}

function shapeAt(c: HdCanvas, g: Grid, soft: number, dy: number): Shape {
  return { edge: new Field(c.W, c.H, c.d, g, 0.42, 0, dy), body: new Field(c.W, c.H, c.d, g, soft, 0, dy) };
}

const isGear = (ch: string): boolean => ch === 'j' || ch === 'g' || ch === 'G';
const isAccent = (ch: string): boolean => ch === 'a' || ch === 'A';

function drawGear(k: Ctx, kind: Exclude<Headgear, 'none'>): void {
  const { c, s } = k;
  const t = GEAR[kind];
  const slip = k.slip;
  const fy = slip - Math.floor(slip);
  // Template origin on the grid (logical, with the slip).
  const oy = BASE_AT[1] + t.at[1] + slip;
  const hard = kind === 'helmet' || kind === 'rainhat' || kind === 'headset';
  const gs = clothSpan(s.gear);
  const as = clothSpan(s.accent);
  const m: GearMats = {
    gear: c.material({ ramp: gs.ramp, lo: gs.lo, hi: gs.hi, spec: kind === 'helmet' ? 0.75 : kind === 'rainhat' ? 0.6 : kind === 'headset' ? 0.5 : kind === 'goggles' ? 0.25 : 0.1, shine: hard ? 24 : 12, amb: 0.08, wrap: hard ? 0.05 : 0.18, rim: 0.2 }),
    accent: c.material({ ramp: as.ramp, lo: as.lo, hi: as.hi, spec: 0.12, shine: 10, amb: 0.1, wrap: 0.2 }),
    brass: c.material({ ramp: PAL_HD.gold, spec: 1, shine: 18, amb: 0.12 }),
    lens: c.material({ ramp: PAL_HD.glass, spec: 1, shine: 30, amb: 0.3 }),
  };
  const crownG = gearGrid(kind, slip, isGear);
  const accentG = gearGrid(kind, slip, isAccent);
  const brassG = gearGrid(kind, slip, (ch) => ch === 'b' || ch === 'B');
  const lensG = gearGrid(kind, slip, (ch) => ch === 'l' || ch === 's');
  const hairG = gearGrid(kind, slip, (ch) => ch === 'h' || ch === 'H' || ch === 'L');
  switch (kind) {
    case 'helmet':
      helmet(k, m, shapeAt(c, crownG, 1.1, fy), oy);
      break;
    case 'cap':
    case 'cap-back':
      cap(k, m, crownG, fy, oy, kind === 'cap-back');
      break;
    case 'beret':
    case 'beret-slouch':
      beret(k, m, crownG, fy, oy, kind === 'beret-slouch');
      break;
    case 'bandana':
      bandana(k, m, crownG, fy, oy);
      break;
    case 'goggles':
      goggles(k, m, crownG, lensG, fy, oy);
      break;
    case 'hood':
      hood(k, m, crownG, fy);
      break;
    case 'shako':
      shako(k, m, crownG, fy, oy);
      break;
    case 'bobble':
      bobble(k, m, crownG, fy, oy);
      break;
    case 'rainhat':
      rainhat(k, m, crownG, fy, oy);
      break;
    case 'headset':
      headset(k, m, oy);
      break;
    case 'fur-hat':
      furHat(k, m, crownG, fy, oy);
      break;
  }
  if (accentG.any && kind !== 'bobble' && kind !== 'fur-hat' && kind !== 'shako') {
    // Badges and cockades on berets.
    const sh = shapeAt(c, accentG, 0.6, fy);
    c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => (sh.edge.at(x, y) < 0.5 ? NaN : 1.0 * roll(sh.body.at(x, y)) + 2.2 * headSphere(x, y)), { mat: m.accent, z: 4.5 });
  }
  if (brassG.any) {
    const sh = shapeAt(c, brassG, 0.6, fy);
    c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => (sh.edge.at(x, y) < 0.5 ? NaN : 0.9 * roll(sh.body.at(x, y)) + 2.2 * headSphere(x, y)), { mat: m.brass, z: 4.6 });
  }
  if (hairG.any) {
    // Hair showing in the strap gap of a backwards cap.
    const sh = shapeAt(c, hairG, 0.6, fy);
    c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => (sh.edge.at(x, y) < 0.5 ? NaN : 0.6 * roll(sh.body.at(x, y)) + 2 * headSphere(x, y)), { mat: k.hair, z: 1.5 });
  }
  if (kind !== 'goggles' && kind !== 'headset') {
    // The brim / band shades the brow under it (light from the upper left), stronger than the
    // cast-shadow pass, so the forehead under a hat never reads as a light stripe.
    const all = shapeAt(c, gearGrid(kind, slip, (ch) => ch !== 'h' && ch !== 'H' && ch !== 'L'), 0.5, fy);
    c.shade(2, oy, 15, 8, (x, y) => (all.edge.at(x, y) < 0.5 && all.edge.at(x - 0.3, y - 0.8) >= 0.5 ? -0.32 : 0), k.face);
  }
}

/** A crown over a footprint: the head sphere, rounded at the footprint's edge, optionally a dome of its own. */
function crownH(sh: Shape, cx: number, cy: number, rx: number, ry: number, rz: number, rollH = 1.3): (x: number, y: number) => number {
  return (x, y) => {
    if (sh.edge.at(x, y) < 0.5) return NaN;
    return rz * dome(x, y, cx, cy, rx, ry) + rollH * roll(sh.body.at(x, y));
  };
}

/** A horizontal band / rim: a rolled capsule (lit top, dark underside). */
function band(c: HdCanvas, x0: number, x1: number, y: number, r: number, mat: number, z: number, tone = 0, tex: Texture | null = null): void {
  c.capsule(x0, y, x1, y, r, r, { mat, z, tone, round: 0.85, tex });
}

function helmet(k: Ctx, m: GearMats, sh: Shape, oy: number): void {
  const { c } = k;
  const part = c.newPart();
  const rimY = oy + 5.35;
  // The shell: a smooth dome with a strong sheen; scuffs and scratches at 4×.
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (sh.edge.at(x, y) < 0.5 || y > rimY + 0.1) return NaN;
    return 5.4 * dome(x, y, 9.1, rimY + 0.4, 7.2, 6.0) + 0.9 * roll(sh.body.at(x, y));
  }, {
    mat: m.gear,
    part,
    z: 2,
    tex: (p) => {
      if (p.d >= 4 && hash2(Math.floor(p.x * 2.5), Math.floor(p.y * 1.6), 5) > 0.94) p.tone += 0.2;
      if (p.d >= 4 && hash2(Math.floor(p.x * 1.5), Math.floor(p.y * 3), 6) > 0.95) p.tone -= 0.22;
    },
  });
  // The rim: a rolled lip all round, standing off the shell.
  band(c, 2.7, 15.3, rimY + 0.15, 0.62, m.gear, 2.6, -0.04);
  if (c.d >= 4) {
    // Rivets along the rim's band.
    for (const rx of [4.3, 9.0, 13.6]) c.ellipsoid(rx, rimY - 0.75, 0.3, 0.28, { mat: m.gear, z: 3.6, tone: 0.15 });
  }
}

function cap(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number, back: boolean): void {
  const { c } = k;
  const bandY = oy + 4.5;
  // Crown: the cells above the band row, off the peak.
  const crown = new Grid();
  const peak = new Grid();
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      if (!g.on[gy * GW + gx]) continue;
      const inPeak = back ? gx <= 3 && gy >= Math.floor(oy) + 3 : gx >= 13 && gy >= Math.floor(oy) + 3;
      (inPeak ? peak : crown).on[gy * GW + gx] = 1;
      if (inPeak) peak.any = true;
      else crown.any = true;
    }
  }
  const csh = shapeAt(c, crown, 1.15, fy);
  const part = c.newPart();
  const seamX = back ? [7.2, 10.6] : [7.0, 11.0];
  c.heightField(0, 0, HEAD_W, HEAD_H, crownH(csh, 9.0, bandY, 6.4, 5.1, 4.8, 1.0), {
    mat: m.gear,
    part,
    z: 2,
    tex: (p) => {
      // Panel seams curving from the button down to the band; stitching dots beside them at 4×.
      for (const sx0 of seamX) {
        const sx = 9.0 + (sx0 - 9.0) * Math.min(1, (p.y - (oy + 0.3)) / 3.6);
        const dx = Math.abs(p.x - sx);
        if (p.y > oy + 0.9 && dx < 0.14) p.tone -= 0.3;
        else if (p.d >= 4 && p.y > oy + 1.2 && Math.abs(dx - 0.42) < 0.13 && (p.Y & 3) === 0) p.tone -= 0.18;
      }
    },
  });
  // The button on top.
  c.ellipsoid(9.0, oy + 0.55, 0.62, 0.42, { mat: m.gear, z: 4.5, tone: 0.05 });
  // The band round the head (the headband / adjuster), a little darker.
  band(c, back ? 4.3 : 3.5, back ? 14.2 : 13.6, bandY, 0.5, m.gear, 2.7, -0.18);
  // The peak: a stiff plate, lit on top, its rim in shade; it shades the brow (cast shadow).
  const psh = shapeAt(c, peak, 0.5, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (psh.edge.at(x, y) < 0.5) return NaN;
    // Tilted to face up: height falls towards the tip and the underside edge.
    const tip = back ? (4.2 - x) / 4.2 : (x - 13) / 4.2;
    return 3.2 - tip * 0.9 + (y - (bandY - 0.6)) * 1.1;
  }, { mat: m.gear, z: 3.4, tone: 0.02 });
  if (c.d >= 4) {
    // The peak's stitched edge.
    c.shade(back ? 0 : 13, bandY - 1.3, 5, 1.8, (x, y) => (psh.edge.at(x, y) >= 0.5 && psh.edge.at(x, y + 0.3) < 0.5 ? -0.3 : 0));
  }
  if (back) {
    // The strap gap's adjuster above the forehead: a little metal clasp.
    c.box(12.0, bandY - 0.45, 1.0, 0.85, { mat: m.brass, z: 3.6, r: 0.25, bevel: 0.3 });
  }
}

function beret(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number, slouch: boolean): void {
  const { c } = k;
  const sh = shapeAt(c, g, 1.4, fy);
  const bandY = oy + (slouch ? 5.4 : 4.4);
  const part = c.newPart();
  // A soft felt crown pulled to one side, soft folds; the slouch flops over the back of the head.
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (sh.edge.at(x, y) < 0.5) return NaN;
    let h = 3.6 * dome(x, y, slouch ? 7.6 : 8.4, oy + 3.4, 7.4, 4.6) + 1.4 * roll(sh.body.at(x, y));
    if (y > bandY - 0.3 && (!slouch || x > 4)) h -= 0.4;
    return h;
  }, {
    mat: m.gear,
    part,
    z: 2,
    tex: (p) => {
      const n = noise2(p.x * 0.7, p.y, 2.6, 4);
      p.nx += (n - 0.5) * 0.45;
      if (p.d >= 4 && n > 0.7) p.tone -= 0.12;
    },
  });
  // The leather band.
  band(c, slouch ? 4.6 : 3.4, slouch ? 13.0 : 13.6, bandY, 0.45, m.gear, 2.8, -0.25);
}

function bandana(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number): void {
  const { c } = k;
  const sh = shapeAt(c, g, 1.2, fy);
  const knotX = 2.6;
  const knotY = oy + 4.5;
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (sh.edge.at(x, y) < 0.5) return NaN;
    // The cloth over the skull; the knot's tails at the back hang free.
    return 3.8 * headSphere(x, y) + 1.2 * roll(sh.body.at(x, y)) + 0.8 * gauss(x, y, knotX, knotY, 0.8, 0.7);
  }, {
    mat: m.gear,
    z: 2,
    tex: (p) => {
      // The knot's tails hang behind the head, in shade, a fold down each.
      if (p.x < 4.2 && p.y > knotY + 0.4) {
        p.tone -= 0.22;
        if (p.d >= 4 && Math.abs(p.x - 2.3) < 0.13) p.tone -= 0.25;
        return;
      }
      // Creases fanning from the knot.
      const a = Math.atan2(p.y - knotY, p.x - knotX);
      const f = (a * 3.2 + 20) % 1;
      if (f < 0.1 && p.x > knotX + 0.8) p.tone -= 0.22;
      // A printed dot pattern at 4×.
      if (p.d >= 4 && ((Math.floor(p.x * 1.4) + Math.floor(p.y * 1.4)) & 1) === 0 && (p.X % 4 === 1 && p.Y % 4 === 1)) p.tone += 0.35;
    },
  });
}

function goggles(k: Ctx, m: GearMats, g: Grid, lensG: Grid, fy: number, oy: number): void {
  const { c } = k;
  // The strap round the head, the goggle pushed up on the forehead: frame and lens.
  const strapY = oy + 0.5;
  band(c, 3.4, 13.2, strapY, 0.45, m.gear, 2.4, -0.1, (p) => {
    if (p.d >= 4 && Math.abs(p.y - strapY) < 0.12) p.tone -= 0.15;
  });
  const fsh = shapeAt(c, g, 0.6, fy);
  c.heightField(9.5, 0, 8.5, HEAD_H, (x, y) => (fsh.edge.at(x, y) < 0.5 || x < 10 ? NaN : 1.2 * roll(fsh.body.at(x, y)) + 2.0), { mat: m.gear, z: 3, tone: -0.05 });
  const lsh = shapeAt(c, lensG, 0.6, fy);
  c.heightField(9.5, 0, 8.5, HEAD_H, (x, y) => (lsh.edge.at(x, y) < 0.5 ? NaN : 0.9 * dome(x, y, 12.3, oy + 1.5, 1.4, 0.9) + 3.0), { mat: m.lens, z: 3.5 });
}

function hood(k: Ctx, m: GearMats, g: Grid, fy: number): void {
  const { c } = k;
  const sh = shapeAt(c, g, 1.3, fy);
  // The face opening: the skull cells the hood leaves free. Round it, a thick rolled hem; just
  // inside the hem the hood's lining in deep shade.
  const open = new Grid();
  for (let i = 0; i < GW * GH; i++) {
    if (skullGrid.on[i] && !g.on[i]) {
      open.on[i] = 1;
      open.any = true;
    }
  }
  const fo = new Field(c.W, c.H, c.d, open, 0.75, 0, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (sh.edge.at(x, y) < 0.5) return NaN;
    const o = fo.at(x, y);
    const hem = o > 0.03 ? Math.exp(-(((o - 0.16) / 0.1) ** 2)) : 0;
    return 4.2 * headSphere(x, y) + 1.4 * roll(sh.body.at(x, y)) + 1.1 * hem - (o > 0.3 ? 0.6 : 0);
  }, {
    mat: m.gear,
    z: 2,
    tex: (p) => {
      const o = fo.at(p.x, p.y);
      if (o > 0.3) {
        p.tone -= 0.6;
        return;
      }
      if (o > 0.08) p.tone += 0.12;
      // Soft cloth: broad folds, the hem's stitched seam at 4×.
      const n = noise2(p.x * 0.6, p.y * 0.9, 2.4, 13);
      p.nx += (n - 0.5) * 0.5;
      p.ny += (noise2(p.x, p.y, 2.4, 14) - 0.5) * 0.3;
      if (p.d >= 4 && Math.abs(o - 0.07) < 0.025) p.tone -= 0.22;
    },
  });
}

function shako(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number): void {
  const { c, s } = k;
  void s;
  // A tall cylinder (felt), the peak (lacquered), the plume (accent), the brass plate (drawn after).
  const top = oy + 3;
  const brimY = oy + 8.5;
  c.cylinder(5.2, top, 6.6, brimY - top - 0.4, { mat: m.gear, z: 2, axis: 'v', cap: 0.6 });
  // The top cap's rim.
  band(c, 5.3, 11.7, top + 0.3, 0.35, m.gear, 2.6, 0.08);
  // The peak and the band: lacquered (the gear's dark tones with a sharp sheen).
  const brim = new Grid();
  for (let gy = Math.floor(oy) + 8; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (g.on[gy * GW + gx]) {
    brim.on[gy * GW + gx] = 1;
    brim.any = true;
  }
  const bsh = shapeAt(c, brim, 0.6, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => (bsh.edge.at(x, y) < 0.5 ? NaN : 2.6 * headSphere(x, y) + 0.9 * roll(bsh.body.at(x, y)) - (x > 12 ? (y - brimY) * 0.8 : 0)), { mat: c.material({ ...c.getMaterial(m.gear), hi: Math.max(2, (c.getMaterial(m.gear).lo ?? 1) + 2), spec: 0.9, shine: 26 }), z: 3 });
  // Plume: a fluffy tuft.
  const ag = gearGrid('shako', k.slip, isAccent);
  const ash = shapeAt(c, ag, 0.7, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (ash.edge.at(x, y) < 0.5) return NaN;
    return 1.3 * roll(ash.body.at(x, y)) + 0.5 * curlAt(x, y, 0.9, 21).h + 3;
  }, { mat: m.accent, z: 4, tex: curlTex(0.9, 21) });
}

function bobble(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number): void {
  const { c } = k;
  const sh = shapeAt(c, g, 1.1, fy);
  const cuffY = oy + 7.4;
  const stripeY = oy + 6.4;
  // Knit: rib columns at 4×, a striped band in the accent colour, a folded cuff.
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => (sh.edge.at(x, y) < 0.5 ? NaN : 4.2 * headSphere(x, y) + 1.3 * roll(sh.body.at(x, y))), {
    mat: m.gear,
    z: 2,
    tex: (p) => {
      const f = (p.x * (p.d >= 4 ? 1.6 : 0.8)) % 1;
      p.nx += (f - 0.5) * 0.6;
      if (Math.abs(p.y - stripeY) < 0.55) p.mat = m.accent;
    },
  });
  band(c, 3.3, 13.7, cuffY, 0.55, m.gear, 2.6, -0.12, (p) => {
    const f = (p.x * (p.d >= 4 ? 1.6 : 0.8)) % 1;
    p.nx += (f - 0.5) * 0.5;
  });
  // The pom-pom.
  const ag = gearGrid('bobble', k.slip, isAccent);
  const ash = shapeAt(c, ag, 0.7, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (ash.edge.at(x, y) < 0.5 || y > oy + 3.2) return NaN;
    return 1.4 * roll(ash.body.at(x, y)) + 0.5 * curlAt(x, y, 0.8, 17).h + 3;
  }, { mat: m.accent, z: 4, tex: curlTex(0.8, 17) });
}

function rainhat(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number): void {
  const { c } = k;
  const brimY = oy + 4.5;
  const crown = new Grid();
  const brim = new Grid();
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    if (!g.on[gy * GW + gx]) continue;
    const isBrim = gy >= Math.floor(oy) + 4;
    (isBrim ? brim : crown).on[gy * GW + gx] = 1;
    if (isBrim) brim.any = true;
    else crown.any = true;
  }
  const csh = shapeAt(c, crown, 1.1, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, crownH(csh, 8.6, brimY + 0.5, 5.6, 4.8, 4.4, 1.0), { mat: m.gear, z: 2 });
  // The brim and the back flap (oilskin): lit top, the flap hanging down behind the neck.
  const bsh = shapeAt(c, brim, 0.6, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (bsh.edge.at(x, y) < 0.5) return NaN;
    return 3 + 0.8 * roll(bsh.body.at(x, y)) - Math.max(0, y - brimY) * 0.5 - Math.abs(x - 8) * 0.08;
  }, { mat: m.gear, z: 3, tone: -0.04 });
  if (c.d >= 4) c.shade(0, brimY - 0.6, HEAD_W, 1.2, (x, y) => (Math.abs(y - (brimY - 0.25)) < 0.12 && x > 2 && x < 15.5 ? -0.25 : 0)); // the stitched seam
}

function headset(k: Ctx, m: GearMats, oy: number): void {
  const { c } = k;
  // The band over the head, the padded earcup behind the ear and the mic boom.
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.05 + i * 0.045);
    pts.push([9.4 - Math.cos(a) * 4.2 - 0.3, oy + 6.6 - Math.sin(a) * 5.4]);
  }
  c.stroke(pts, 0.42, 0.42, { mat: m.gear, z: 2.8 });
  c.box(3.9, oy + 5.9, 3.2, 3.2, { mat: m.gear, z: 3.4, r: 1.1, bevel: 0.7 });
  c.ellipsoid(5.5, oy + 7.5, 0.8, 0.9, { mat: m.gear, z: 3.9, tone: -0.12 });
  c.capsule(6.6, oy + 8.4, 9.1, oy + 8.6, 0.32, 0.26, { mat: m.gear, z: 3.6 });
  c.ellipsoid(9.2, oy + 8.6, 0.42, 0.4, { mat: m.gear, z: 3.8, tone: -0.2 });
}

function furHat(k: Ctx, m: GearMats, g: Grid, fy: number, oy: number): void {
  const { c } = k;
  const sh = shapeAt(c, g, 1.1, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, crownH(sh, 8.4, oy + 4.6, 6.4, 4.2, 4.2, 1.1), { mat: c.material({ ramp: hdRampOf(k.s.gear), spec: 0.3, shine: 16, amb: 0.08 }), z: 2 });
  // The fur: the band round the head and the ear flap, as fluffy curls.
  const ag = gearGrid('fur-hat', k.slip, isAccent);
  const ash = shapeAt(c, ag, 0.9, fy);
  c.heightField(0, 0, HEAD_W, HEAD_H, (x, y) => {
    if (ash.edge.at(x, y) < 0.5) return NaN;
    return 3.2 * headSphere(x, y) + 1.2 * roll(ash.body.at(x, y)) + 0.55 * curlAt(x, y, 0.95, 23).h + 0.5;
  }, { mat: m.accent, z: 3, tex: curlTex(0.95, 23) });
}

// ---------------------------------------------------------------------------------------------
// Test hooks
// ---------------------------------------------------------------------------------------------

/** Drop the head cache (tests and tools that time cold generation). */
export function clearHeadHdCache(): void {
  cache.clear();
}
