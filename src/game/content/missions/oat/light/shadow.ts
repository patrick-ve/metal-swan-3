/**
 * THE SUN'S CAST SHADOWS of mission `oat` (docs/design/oat.md §8.3, §8.4; art map lever L2;
 * docs/api/oat.md "LIGHT-WATER"). Owner: LIGHT-WATER. ONE SOURCE OF TRUTH: the
 * façade strips (GRAMMAR), the floor painters (STREET-A), the strips store (STRIPS) and the
 * stretched contact shadows ask the same pure function whether a point lies in the sun, so the
 * shadows of houses, posts, trees and heroes agree everywhere and follow every layout change.
 *
 * Space (metres, spec §8.3): x = world u to the RIGHT (world px; 20 px per metre on the floor and in
 * the ground band), z = depth from the façade row we look at ("our façade", z 0) TOWARD THE CAMERA,
 * h = height over the street. The sun is a game convention: LEFT and in front of the façades (the
 * camera side, decision 37), so shadows fall to the right and toward the back:
 * - a point at height h casts its floor shadow at Δu = h · cot e · cos yaw (right) and
 *   Δz = −h · cot e · sin yaw (back);
 * - a sun ray from a point toward the camera rises tan e / sin yaw and moves cot yaw to the LEFT per
 *   metre of depth, so the unseen OPPOSITE ROW (behind the camera, W metres from our façade) puts
 *   its shadow line on our façade at H_s = H_opp − W · tan e / sin yaw, shifted right by W · cot yaw,
 *   with its gable silhouettes and its gaps (side streets: sun shafts) stretched along it;
 * - a protrusion of depth d (cornice, sill, awning, hoist beam, anchor) casts on its own wall
 *   Δx = d · cot yaw (right) and Δy = d · tan e / sin yaw (down): `wallShadowPx`.
 *
 * The mixed scale (spec §8.2, decision 36): the ground band is true scale (20 px/m both ways), the
 * upper band about 0.4 vertical (8 px/m) and lot widths 0.6 (12 px/m). `facadeMetres` / `facadePx`
 * convert a façade height. The floor's depth is compressed by the floor camera: the band from our
 * façade's base (`vFacade`) to the opposite façade's line (`vOpposite`, just below the view) is the
 * street's W metres, so z = W · (v − vFacade) / (vOpposite − vFacade) (every street fills the same
 * band; an open stretch uses its own depth scale).
 *
 * `StreetShade.floor(u, v, d)` and `.facade(u, m, d)` return 0 (full sun) … 1 (full shade): a hard
 * edge at d 1 (the 1× snap), a soft penumbra at 2× / 4× (`FloorShade`-style). The painter decides
 * how dark shade paints (≤ `SHADE_TONES` tones, spec §8.4: a fight in shade stays readable). Pure
 * and deterministic (hashes only, no Math.random); nothing allocates per call. A section without a
 * sun (oat-d, oat-e) is never shaded.
 */
import { hash2 } from '../../../../art/paint';

/** True scale: the floor, the ground band and the street furniture (spec §8.2: 20 px per metre). */
export const PX_PER_M = 20;
/** The upper band's storeys and gables, vertical (spec §8.2: about 8 px per metre). */
export const PX_PER_M_UPPER = 8;
/** Lot widths along the street and the upper band's horizontal (spec §8.2: 0.6 = 12 px per metre). */
export const PX_PER_M_LOT = 12;
/** The depth scale of an open stretch (no opposite row: a bridge, a quay, a vista), metres across the floor band. */
export const OPEN_DEPTH_M = 10;
/** Spec §8.4: shade is at most 1.5 tones darker than sun (the painters' rule). */
export const SHADE_TONES = 1.5;

/** Penumbra half-width, metres: a base plus a share of the ray's length to the caster (the sun's disc is 0.53°). */
const SOFT_BASE = 0.04;
const SOFT_PER_M = 0.0046;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------------
// The geometry of one sun
// ---------------------------------------------------------------------------------------------

/** A sun's angles in degrees (a `SectionSun` fits: `elevationEnd` sinks it along the section, oat-c1). */
export interface SunAngles {
  readonly elevation: number;
  readonly yaw: number;
  readonly elevationEnd?: number;
}

/** The shadow numbers of one sun (metres per metre; pure). */
export interface SunGeom {
  readonly elevation: number;
  readonly yaw: number;
  /** Floor shadow length per metre of height: cot e (spec §8.3 table: a 1.60, b 1.19, c 3.08, c1 3.73 → 5.14). */
  readonly length: number;
  /** Its parts: to the right (cot e · cos yaw) and toward the back (cot e · sin yaw). */
  readonly right: number;
  readonly back: number;
  /** A ray from a point toward the sun, per metre of depth toward the camera: it rises tan e / sin yaw … */
  readonly rise: number;
  /** … and moves cot yaw metres to the LEFT. */
  readonly left: number;
  /** 1 / sin e: a round thing's floor shadow is this much longer along the sun than across it. */
  readonly stretch: number;
}

/** The shadow numbers of a sun at elevation e and yaw (degrees; e clamped to 2°…85°, yaw to 5°…85°). */
export function sunGeom(elevation: number, yaw: number): SunGeom {
  const e = Math.max(2, Math.min(85, elevation)) * DEG;
  const y = Math.max(5, Math.min(85, yaw)) * DEG;
  const cot = 1 / Math.tan(e);
  return {
    elevation,
    yaw,
    length: cot,
    right: cot * Math.cos(y),
    back: cot * Math.sin(y),
    rise: Math.tan(e) / Math.sin(y),
    left: 1 / Math.tan(y),
    stretch: 1 / Math.sin(e),
  };
}

/**
 * The opposite row's shadow line on our façade (spec §8.4): H_s = H_opp − W · tan e / sin yaw,
 * metres over the street (≤ 0: our whole façade is in sun). a (32°/40°, 12.5 m eaves, 8.2 m) ≈ 4.5 m.
 */
export function shadowLine(g: SunGeom, oppositeHeight: number, streetWidth: number): number {
  return oppositeHeight - streetWidth * g.rise;
}

// ---------------------------------------------------------------------------------------------
// The mixed façade scale (spec §8.2)
// ---------------------------------------------------------------------------------------------

/** Metres over the façade base of a façade height in world px (20 px/m up to the lot's band top, 8 px/m above). */
export function facadeMetres(hPx: number, bandTopPx: number): number {
  if (hPx <= bandTopPx) return hPx / PX_PER_M;
  return bandTopPx / PX_PER_M + (hPx - bandTopPx) / PX_PER_M_UPPER;
}

/** World px over the façade base of a height in metres (the inverse of `facadeMetres`). */
export function facadePx(m: number, bandTopPx: number): number {
  const bm = bandTopPx / PX_PER_M;
  if (m <= bm) return m * PX_PER_M;
  return bandTopPx + (m - bm) * PX_PER_M_UPPER;
}

/** A reused offset (`wallShadowPx` writes it). */
export interface WallShadowPx {
  /** To the right, world px. */
  dx: number;
  /** Down, world px. */
  dy: number;
}

/**
 * The shadow a protrusion of depth `depthM` metres casts on its own wall, in façade px at the
 * height `yPx` over the base (spec §8.3: Δx = d · cot yaw right, Δy = d · tan e / sin yaw down),
 * converted with the scale of the band where the shadow falls (true scale in the ground band; 12 /
 * 8 px per metre above the lot's band top `bandTopPx`). Writes and returns `out`.
 */
export function wallShadowPx(g: SunGeom, depthM: number, yPx: number, bandTopPx: number, out: WallShadowPx): WallShadowPx {
  const dxM = depthM * g.left;
  const dyM = depthM * g.rise;
  const m0 = facadeMetres(yPx, bandTopPx);
  out.dy = yPx - facadePx(Math.max(0, m0 - dyM), bandTopPx);
  out.dx = dxM * (yPx > bandTopPx ? PX_PER_M_LOT : PX_PER_M);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The opposite row's skyline
// ---------------------------------------------------------------------------------------------

/** One lot of a skyline (world px along u; metres up). GRAMMAR's `FacadeLot` maps to it (`skylineFromLots`). */
export interface SkylineLot {
  readonly u0: number;
  readonly w: number;
  /** The eaves (or cornice) height and the gable's top, metres over the street. */
  readonly eaves: number;
  readonly top: number;
  /** The silhouette (default 'lijst': flat at `top`). */
  readonly gable?: string;
}

/**
 * The silhouette height of a lot at t = 0..1 across it (metres): the gable types of spec §8.6 as
 * plain profiles — trap (steps), hals / verhoogde-hals (a neck on shoulders), klok (a bell), tuit (a
 * spout), the rest flat at the top.
 */
export function lotProfile(lot: SkylineLot, t: number): number {
  const g = lot.top - lot.eaves;
  const c = Math.abs(t - 0.5) * 2;
  switch (lot.gable) {
    case 'trap':
      return lot.eaves + g * (1 - Math.min(3, Math.floor(c * 4)) / 4);
    case 'hals':
      return c < 0.45 ? lot.top : lot.eaves + g * 0.35;
    case 'verhoogde-hals':
      return c < 0.42 ? lot.top : c < 0.7 ? lot.eaves + g * 0.55 : lot.eaves + g * 0.2;
    case 'klok': {
      if (c < 0.34) return lot.top;
      const x = 1 - (c - 0.34) / 0.66;
      return lot.eaves + g * x * x * (3 - 2 * x);
    }
    case 'tuit':
      return c < 0.22 ? lot.top : lot.eaves + g * Math.max(0, (1 - c) / 0.78);
    default:
      return lot.top;
  }
}

/** A skyline function from planned lots (gaps between lots = 0: side streets let the sun through). */
export function skylineFromLots(lots: readonly SkylineLot[]): (u: number) => number {
  const sorted = [...lots].sort((a, b) => a.u0 - b.u0);
  return (u) => {
    // Lots are few (≤ ~80 per section) and the skyline is sampled once per px at build: a plain scan.
    for (let i = 0; i < sorted.length; i++) {
      const l = sorted[i];
      if (u < l.u0) return 0;
      if (u < l.u0 + l.w) return lotProfile(l, (u - l.u0) / l.w);
    }
    return 0;
  };
}

/** Street-sheet height numbers for the procedural opposite row (spec §8.6 table; metres, px). */
export interface SkylineSheet {
  /** Eaves height range, metres. */
  readonly eaves: readonly [number, number];
  /** Gable rise over the eaves, metres. */
  readonly gable: readonly [number, number];
  /** Lot width range, world px (Amsterdam feet at 0.6: 61 … 89). */
  readonly lot: readonly [number, number];
  /** Share of flat (lijst, plastered, infill) fronts. */
  readonly flat: number;
  /** Side streets and alleys behind the camera (sun shafts, spec §8.4): about one per `every` px, `w` px wide. */
  readonly gap?: { readonly every: number; readonly w: readonly [number, number] };
}

/** The 9 Straatjes (ridge 12.4–20.7 m, median 16.2; lijst 35 %, +19th/20th c. 10 %). */
export const SHEET_9_STRAATJES: SkylineSheet = { eaves: [11, 14], gable: [2.5, 5], lot: [61, 89], flat: 0.45, gap: { every: 900, w: [18, 30] } };
/** The Oudezijds canals (ridge 11.0–18.3 m, median 14.7). */
export const SHEET_OUDEZIJDS: SkylineSheet = { eaves: [10, 13], gable: [2.5, 4.5], lot: [55, 82], flat: 0.45, gap: { every: 640, w: [20, 40] } };
/** The Grimburgwal south row (3–5 storeys; the c/c1 numbers: 13 m eaves give H_s ≈ 2.4 m at 18°). */
export const SHEET_GRIMBURGWAL: SkylineSheet = { eaves: [11.5, 14.5], gable: [2.5, 4.5], lot: [61, 96], flat: 0.55, gap: { every: 560, w: [40, 80] } };

const GABLES = ['trap', 'hals', 'verhoogde-hals', 'klok', 'tuit'] as const;

/**
 * The procedural opposite row when the grammar has not planned one (`facadeLots(id, true)` empty):
 * seeded lots from a street sheet, from `u0` to `u1` (world px). Deterministic (hash2 only).
 */
export function proceduralLots(sheet: SkylineSheet, u0: number, u1: number, seed: number): SkylineLot[] {
  const out: SkylineLot[] = [];
  let u = u0;
  let i = 0;
  let nextGap = sheet.gap ? u0 + sheet.gap.every * (0.4 + 0.6 * hash2(-1, 7, seed)) : Infinity;
  while (u < u1) {
    const r = (k: number): number => hash2(i, k, seed);
    if (sheet.gap && u >= nextGap) {
      // A side street behind the camera: no lot, the sun comes through.
      u += Math.round(sheet.gap.w[0] + (sheet.gap.w[1] - sheet.gap.w[0]) * r(9));
      nextGap = u + sheet.gap.every * (0.6 + 0.8 * r(10));
      i++;
      continue;
    }
    const w = Math.round(sheet.lot[0] + (sheet.lot[1] - sheet.lot[0]) * r(1));
    const eaves = sheet.eaves[0] + (sheet.eaves[1] - sheet.eaves[0]) * r(2);
    const flat = r(3) < sheet.flat;
    const gable = flat ? 'lijst' : GABLES[Math.floor(r(4) * GABLES.length) % GABLES.length];
    const top = flat ? eaves + 0.6 * r(5) : eaves + sheet.gable[0] + (sheet.gable[1] - sheet.gable[0]) * r(5);
    out.push({ u0: u, w, eaves, top, gable });
    u += w;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Casters and the street model
// ---------------------------------------------------------------------------------------------

/**
 * A thing that casts a shadow (u in world px; z, h, r in metres). Posts (lamp posts, poles,
 * bollards, trunks, staples' legs), boxes (bikes, bins, cars, kiosks, stoeps, parapets), crowns (elm
 * crowns, lantern heads: an ellipsoid; `holes` 0..1 dapples it) and plates (awnings, balconies,
 * canopies at a height).
 */
export type ShadeCaster =
  | { readonly kind: 'post'; readonly u: number; readonly z: number; readonly h: number; readonly r: number }
  | { readonly kind: 'box'; readonly u0: number; readonly u1: number; readonly z0: number; readonly z1: number; readonly h: number }
  | { readonly kind: 'crown'; readonly u: number; readonly z: number; readonly h: number; readonly r: number; readonly holes?: number }
  | { readonly kind: 'plate'; readonly u0: number; readonly u1: number; readonly z0: number; readonly z1: number; readonly h: number };

/**
 * A stretch of street (world px): an opposite row W metres from our façade, or `open` (no opposite
 * row: a bridge, a quay with the canal behind the camera, a vista; W is then only the depth scale).
 * Outside every stretch: open with `StreetShadeDef.openDepth`.
 */
export interface StreetStretch {
  readonly u0: number;
  readonly u1: number;
  /** Façade to façade, metres (a 8.2; the Oude Spiegelstraat 6.6; b 8; c / c1 about 23). */
  readonly w: number;
  readonly open?: boolean;
}

/** The input of a section's shade model (`StreetShade`). */
export interface StreetShadeDef {
  /** The sun (none: never shaded — the night sections). */
  readonly sun: SunAngles | null | undefined;
  /** The section's width, world px. */
  readonly width: number;
  /** The stretches with an opposite row (bridges, canal vistas, open quays: leave them out). */
  readonly streets: readonly StreetStretch[];
  /** The opposite row's silhouette, metres at world u (0 = a gap). Sampled once per world px at build. */
  readonly opposite: (u: number) => number;
  /** The floor v of our façade's base (the row we look at: the floor's back edge). */
  readonly vFacade: number;
  /** The floor v of the opposite façade's line (beyond the view's bottom: the near pavement shows). */
  readonly vOpposite: number;
  /** The depth scale of the open stretches, metres (default `OPEN_DEPTH_M`). */
  readonly openDepth?: number;
  readonly casters?: readonly ShadeCaster[];
  /** The dapple hash seed. */
  readonly seed?: number;
}

/** A caster in one flat shape (monomorphic for the hot loop). */
interface Cast {
  k: 0 | 1 | 2 | 3; // post, box, crown, plate
  u0: number; // metres (post / crown: the centre in u0)
  u1: number;
  z0: number;
  z1: number;
  h: number;
  r: number;
  holes: number;
}

const BUCKET = 32;

function smooth01(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}

/** 0..1 shade from a signed clearance c (metres; > 0 = the ray passes, < 0 = blocked) and a soft half-width. */
function edge(c: number, soft: number, hard: boolean): number {
  if (hard) return c < 0 ? 1 : 0;
  return 1 - smooth01((c + soft) / (2 * soft));
}

/**
 * One section's shade (spec §8.4: built once at section load from the sun, the street widths, the
 * opposite row and the casters; every query is pure). See the module comment for the space.
 */
export class StreetShade {
  readonly sun: SunAngles | null;
  /** The sun's geometry at the section's start (null: no sun). */
  readonly geom: SunGeom | null;
  readonly width: number;
  readonly vFacade: number;
  readonly vOpposite: number;
  /** 1 / (vOpposite − vFacade). */
  private readonly invSpan: number;
  private readonly seed: number;
  /** The opposite row's height per world px, from `oMin` (metres). */
  private readonly sky: Float32Array;
  private readonly oMin: number;
  /** The street width per world px (0 = open) and the depth scale (metres across the band). */
  private readonly street: Float32Array;
  private readonly depth: Float32Array;
  /** Per 32 px column: rise, left, right, back (a sinking sun: oat-c1). */
  private readonly colRise: Float32Array;
  private readonly colLeft: Float32Array;
  private readonly colRight: Float32Array;
  private readonly colBack: Float32Array;
  private readonly colStretch: Float32Array;
  private readonly casts: Cast[] = [];
  /** Caster indices per 32 px bucket (start offsets into `bucketList`). */
  private readonly bucketStart: Int32Array;
  private readonly bucketList: Int32Array;

  constructor(def: StreetShadeDef) {
    this.sun = def.sun ?? null;
    this.width = Math.max(1, Math.ceil(def.width));
    this.vFacade = def.vFacade;
    this.vOpposite = def.vOpposite;
    this.invSpan = 1 / Math.max(1, def.vOpposite - def.vFacade);
    this.seed = (def.seed ?? 0x5a17) >>> 0;
    const sun = this.sun;
    this.geom = sun ? sunGeom(sun.elevation, sun.yaw) : null;
    const W = this.width;
    // Street widths per px.
    this.street = new Float32Array(W + 1);
    this.depth = new Float32Array(W + 1).fill(Math.max(1, def.openDepth ?? OPEN_DEPTH_M));
    let wMax = 0;
    for (const s of def.streets) {
      const a = Math.max(0, Math.floor(s.u0));
      const b = Math.min(W + 1, Math.ceil(s.u1));
      const w = Math.max(0, s.w);
      for (let u = a; u < b; u++) {
        this.street[u] = s.open ? 0 : w;
        if (w > 0) this.depth[u] = w;
      }
      if (!s.open && w > wMax) wMax = w;
    }
    // Sun geometry per 32 px column (constant unless the sun sinks along the section).
    const cols = Math.ceil(W / BUCKET) + 2;
    this.colRise = new Float32Array(cols);
    this.colLeft = new Float32Array(cols);
    this.colRight = new Float32Array(cols);
    this.colBack = new Float32Array(cols);
    this.colStretch = new Float32Array(cols);
    let leftMax = 0;
    for (let c = 0; c < cols; c++) {
      if (!sun) break;
      const t = Math.min(1, (c * BUCKET) / W);
      const e = sun.elevationEnd !== undefined ? sun.elevation + (sun.elevationEnd - sun.elevation) * t : sun.elevation;
      const g = sunGeom(e, sun.yaw);
      this.colRise[c] = g.rise;
      this.colLeft[c] = g.left;
      this.colRight[c] = g.right;
      this.colBack[c] = g.back;
      this.colStretch[c] = g.stretch;
      if (g.left > leftMax) leftMax = g.left;
    }
    // The opposite skyline, sampled from the far left of any ray (W · cot yaw to the left) to the end.
    this.oMin = -Math.ceil(wMax * leftMax * PX_PER_M) - 4;
    const n = W - this.oMin + 2;
    this.sky = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const h = def.opposite(i + this.oMin + 0.5);
      this.sky[i] = Number.isFinite(h) && h > 0 ? h : 0;
    }
    // Casters into flat records and 32 px buckets (by the u range their floor and wall shadows reach).
    const lists: number[][] = [];
    const nb = Math.ceil(W / BUCKET) + 1;
    for (let b = 0; b < nb; b++) lists.push([]);
    const g = this.geom;
    for (const c of def.casters ?? []) {
      const cast = toCast(c);
      if (!cast || !g) continue;
      const idx = this.casts.length;
      this.casts.push(cast);
      // Floor shadow: from the caster to its tip (h · right to the right); wall shadow: z · cot yaw to the right.
      const reachM = cast.h * g.right * 1.6 + cast.r * 2 + 0.5;
      const wallM = Math.max(cast.z1, cast.z0) * g.left * 1.3 + cast.r + 0.5;
      const uA = cast.u0 * PX_PER_M - cast.r * PX_PER_M - 2;
      const uB = cast.u1 * PX_PER_M + Math.max(reachM, wallM) * PX_PER_M + 2;
      const b0 = Math.max(0, Math.floor(uA / BUCKET));
      const b1 = Math.min(nb - 1, Math.floor(uB / BUCKET));
      for (let b = b0; b <= b1; b++) lists[b].push(idx);
    }
    this.bucketStart = new Int32Array(nb + 1);
    let total = 0;
    for (let b = 0; b < nb; b++) {
      this.bucketStart[b] = total;
      total += lists[b].length;
    }
    this.bucketStart[nb] = total;
    this.bucketList = new Int32Array(total);
    let k = 0;
    for (let b = 0; b < nb; b++) for (const i of lists[b]) this.bucketList[k++] = i;
  }

  /** Metres from our façade toward the camera of floor v at world u (the street's depth scale there). */
  zOfV(u: number, v: number): number {
    return (v - this.vFacade) * this.invSpan * this.depthAt(u);
  }

  /** Floor v of a depth z metres from our façade at world u. */
  vOfZ(u: number, z: number): number {
    return this.vFacade + (z / this.depthAt(u)) * (this.vOpposite - this.vFacade);
  }

  /** The depth scale at world u: metres from our façade to the opposite façade's line. */
  depthAt(u: number): number {
    const i = Math.floor(u);
    return this.depth[i < 0 ? 0 : i >= this.depth.length ? this.depth.length - 1 : i];
  }

  /** Façade to façade at world u, metres (0 = open: no opposite row). */
  streetAt(u: number): number {
    const i = Math.floor(u);
    return i < 0 || i >= this.street.length ? 0 : this.street[i];
  }

  /** The opposite row's silhouette at world u, metres (0 = a gap). */
  skylineAt(u: number): number {
    const i = Math.floor(u) - this.oMin;
    return i < 0 || i >= this.sky.length ? 0 : this.sky[i];
  }

  private col(u: number): number {
    const c = Math.floor(u / BUCKET);
    return c < 0 ? 0 : c >= this.colRise.length ? this.colRise.length - 1 : c;
  }

  /**
   * The opposite row's shadow line on our façade at world u (spec §8.4: H_s, metres over the street;
   * ≤ 0 = the whole wall in sun there; no sun or an open stretch: −Infinity).
   */
  facadeLine(u: number): number {
    if (!this.geom) return -Infinity;
    const W = this.streetAt(u);
    if (W <= 0) return -Infinity;
    const c = this.col(u);
    return this.skylineAt(u - W * this.colLeft[c] * PX_PER_M) - W * this.colRise[c];
  }

  /** The opposite row's shade at a point (u, z, h): 0 sun … 1 shade. */
  private opposite(u: number, z: number, h: number, d: number): number {
    const W = this.streetAt(u);
    if (W <= 0 || z >= W) return 0;
    const c = this.col(u);
    const run = W - z;
    const uo = u - run * this.colLeft[c] * PX_PER_M;
    const ray = h + run * this.colRise[c];
    const hard = d <= 1;
    const soft = SOFT_BASE + SOFT_PER_M * run * this.colStretch[c];
    // Clearance: how far the ray passes over the opposite row's silhouette there (> 0 = sun).
    const s0 = edge(ray - this.skylineAt(uo), soft, hard);
    if (hard) return s0;
    // Soft along u too (the edges of a gap's sun shaft): two more samples a penumbra apart.
    const du = soft * PX_PER_M;
    const sl = edge(ray - this.skylineAt(uo - du), soft, false);
    const sr = edge(ray - this.skylineAt(uo + du), soft, false);
    return (sl + 2 * s0 + sr) * 0.25;
  }

  /**
   * Shade of a floor point at world (u, v) at art density d (1 = a hard edge): 0 = full sun … 1 =
   * full shade (the opposite row and every caster). 0 everywhere without a sun.
   */
  floor(u: number, v: number, d = 4): number {
    if (!this.geom) return 0;
    const z = (v - this.vFacade) * this.invSpan * this.depthAt(u);
    let s = this.opposite(u, z, 0, d);
    if (s >= 1) return 1;
    const b = Math.floor(u / BUCKET);
    if (b < 0 || b + 1 >= this.bucketStart.length) return s;
    const a0 = this.bucketStart[b];
    const a1 = this.bucketStart[b + 1];
    if (a0 === a1) return s;
    const c = this.col(u);
    const right = this.colRight[c];
    const back = this.colBack[c];
    const stretch = this.colStretch[c];
    const um = u / PX_PER_M;
    const hard = d <= 1;
    for (let i = a0; i < a1; i++) {
      const k = this.casterFloor(this.casts[this.bucketList[i]], um, z, right, back, stretch, d, hard);
      if (k > s) {
        s = k;
        if (s >= 1) return 1;
      }
    }
    return s;
  }

  /** Light of a floor point (1 − shade). */
  sunlit(u: number, v: number, d = 4): number {
    return 1 - this.floor(u, v, d);
  }

  /**
   * Shade of a point on our façade at world u, `m` metres over the street (`facadeMetres` converts a
   * façade px height), at art density d: 0 = sun … 1 = shade (the opposite row's line and the casters'
   * shadows climbing the wall: posts, trees, lanterns). The façade's own protrusions are the
   * painter's (`wallShadowPx`).
   */
  facade(u: number, m: number, d = 4): number {
    if (!this.geom) return 0;
    let s = this.opposite(u, 0, m, d);
    if (s >= 1) return 1;
    const b = Math.floor(u / BUCKET);
    if (b < 0 || b + 1 >= this.bucketStart.length) return s;
    const a0 = this.bucketStart[b];
    const a1 = this.bucketStart[b + 1];
    if (a0 === a1) return s;
    const c = this.col(u);
    const rise = this.colRise[c];
    const left = this.colLeft[c];
    const um = u / PX_PER_M;
    const hard = d <= 1;
    for (let i = a0; i < a1; i++) {
      const k = this.casterWall(this.casts[this.bucketList[i]], um, m, rise, left, d, hard);
      if (k > s) {
        s = k;
        if (s >= 1) return 1;
      }
    }
    return s;
  }

  /** A caster's shade on the floor point (um metres, z). */
  private casterFloor(c: Cast, um: number, z: number, right: number, back: number, stretch: number, d: number, hard: boolean): number {
    switch (c.k) {
      case 0: {
        // A post: a thin strip from its foot along the sun, h · cot e long.
        const L = Math.hypot(right, back);
        const ux = right / L;
        const uz = -back / L;
        const du = um - c.u0;
        const dz = z - c.z0;
        const along = du * ux + dz * uz;
        const len = c.h * L;
        if (along < -c.r - 0.1 || along > len + 0.3) return 0;
        const perp = Math.abs(du * -uz + dz * ux);
        const soft = SOFT_BASE + SOFT_PER_M * Math.max(0, along) * stretch;
        return Math.min(edge(perp - c.r, soft, hard), edge(along - len, soft, hard), edge(-c.r - along, 0.05, hard));
      }
      case 1:
      case 3: {
        // A box (or a plate at a height): the points whose sun ray (back toward the sun) meets its footprint.
        // ray point at t metres of height: (um − t·right, z + t·back); the box needs t ∈ [0, h], the plate t = h.
        const tLo = c.k === 1 ? 0 : c.h - 0.08;
        const tHi = c.h;
        const ua = (um - c.u1) / right;
        const ub = (um - c.u0) / right;
        const za = (c.z0 - z) / back;
        const zb = (c.z1 - z) / back;
        const lo = Math.max(tLo, ua, za);
        const hi = Math.min(tHi, ub, zb);
        if (c.k === 3) {
          // The plate's footprint shifted by h along the sun: inside test with a soft margin.
          const pu = um - c.h * right;
          const pz = z + c.h * back;
          const m = Math.min(pu - c.u0, c.u1 - pu, pz - c.z0, c.z1 - pz);
          const soft = SOFT_BASE + SOFT_PER_M * c.h * stretch;
          return edge(-m, soft, hard);
        }
        if (hi < lo) {
          if (hard) return 0;
          // Just outside: a penumbra by the gap (metres of height → metres on the floor).
          const gap = (lo - hi) * Math.min(right, back);
          const soft = SOFT_BASE + SOFT_PER_M * c.h * stretch;
          return gap >= soft ? 0 : edge(gap, soft, false);
        }
        if (hard) return 1;
        const depth = (hi - lo) * Math.min(right, back);
        const soft = SOFT_BASE + SOFT_PER_M * c.h * stretch;
        return edge(-depth, soft, false);
      }
      case 2: {
        // A crown: an ellipse at its centre's shadow, stretched 1/sin e along the sun; dappled.
        const cu = c.u0 + c.h * right;
        const cz = c.z0 - c.h * back;
        const L = Math.hypot(right, back);
        const ux = right / L;
        const uz = -back / L;
        const du = um - cu;
        const dz = z - cz;
        const along = (du * ux + dz * uz) / (c.r * stretch);
        const perp = (du * -uz + dz * ux) / c.r;
        const q = along * along + perp * perp;
        if (q >= 1.15) return 0;
        const soft = hard ? 0 : 0.18;
        let k = hard ? (q < 1 ? 1 : 0) : 1 - smooth01((q - (1 - soft)) / (2 * soft));
        if (k > 0 && c.holes > 0) k *= this.dapple(um, z, c.holes, d);
        return k;
      }
    }
  }

  /** A caster's shade on our façade at (um metres, m metres up): the ray from the wall point toward the sun. */
  private casterWall(c: Cast, um: number, m: number, rise: number, left: number, d: number, hard: boolean): number {
    switch (c.k) {
      case 0: {
        // The ray at the post's depth: (um − z·left, m + z·rise) — blocked by the post's segment.
        const pu = um - c.z0 * left;
        const ph = m + c.z0 * rise;
        if (ph < 0 || ph > c.h + 0.2) return 0;
        const soft = SOFT_BASE + SOFT_PER_M * c.z0 * 2;
        return Math.min(edge(Math.abs(pu - c.u0) - c.r, soft, hard), edge(ph - c.h, soft, hard));
      }
      case 1:
      case 3: {
        // Boxes and plates in front of the wall: the ray crosses their depth range at heights m + z·rise.
        const zA = Math.max(0, c.z0);
        const zB = Math.max(zA, c.z1);
        const hA = m + zA * rise;
        if (hA > c.h + 0.05) return 0;
        if (c.k === 3 && m + zB * rise < c.h - 0.08) return 0;
        const puA = um - zA * left;
        const puB = um - zB * left;
        const lo = Math.min(puA, puB);
        const hi = Math.max(puA, puB);
        if (hi < c.u0 || lo > c.u1) return 0;
        const soft = SOFT_BASE + SOFT_PER_M * zB * 2;
        const inside = Math.min(hi - c.u0, c.u1 - lo, c.h - hA);
        return edge(-inside, soft, hard);
      }
      case 2: {
        // A crown in front of the wall: the ray at the crown's depth passes within r of its centre.
        const pu = um - c.z0 * left;
        const ph = m + c.z0 * rise;
        const du = (pu - c.u0) / c.r;
        const dh = (ph - c.h) / c.r;
        const q = du * du + dh * dh;
        if (q >= 1.15) return 0;
        const soft = hard ? 0 : 0.18;
        let k = hard ? (q < 1 ? 1 : 0) : 1 - smooth01((q - (1 - soft)) / (2 * soft));
        if (k > 0 && c.holes > 0) k *= this.dapple(um, m + 37.7, c.holes, d);
        return k;
      }
    }
  }

  /**
   * Leaf dapple (spec §8.4: the elm crowns as dappled shade): world-anchored cells (fine at 4×, 2 × 2
   * clusters at 2×, only tone at 1×, the §8.10 density rule): 1 = shade, 0 = a sun fleck.
   */
  private dapple(um: number, b: number, holes: number, d: number): number {
    if (d <= 1) return 1 - holes * 0.55;
    const cell = d >= 4 ? 0.1 : 0.15;
    const big = hash2(Math.floor(um / 0.6), Math.floor(b / 0.45), this.seed ^ 0x2d1);
    const small = hash2(Math.floor(um / cell), Math.floor(b / cell), this.seed ^ 0x9e3);
    return small * 0.6 + big * 0.4 < holes ? 0.15 : 1;
  }
}

function toCast(c: ShadeCaster): Cast | null {
  switch (c.kind) {
    case 'post':
      return { k: 0, u0: c.u / PX_PER_M, u1: c.u / PX_PER_M, z0: c.z, z1: c.z, h: c.h, r: c.r, holes: 0 };
    case 'box':
      return { k: 1, u0: Math.min(c.u0, c.u1) / PX_PER_M, u1: Math.max(c.u0, c.u1) / PX_PER_M, z0: Math.min(c.z0, c.z1), z1: Math.max(c.z0, c.z1), h: c.h, r: 0, holes: 0 };
    case 'crown':
      return { k: 2, u0: c.u / PX_PER_M, u1: c.u / PX_PER_M, z0: c.z, z1: c.z, h: c.h, r: Math.max(0.2, c.r), holes: Math.max(0, Math.min(0.9, c.holes ?? 0)) };
    case 'plate':
      return { k: 3, u0: Math.min(c.u0, c.u1) / PX_PER_M, u1: Math.max(c.u0, c.u1) / PX_PER_M, z0: Math.min(c.z0, c.z1), z1: Math.max(c.z0, c.z1), h: c.h, r: 0, holes: 0 };
    default:
      return null;
  }
}
