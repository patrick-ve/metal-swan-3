/**
 * The side faces of the `ams` props (docs/design/floor.md §11 R1; the engine's face groups, docs/api/
 * floor.md §8): what was a flat 2D edge shows its side in perspective.
 *
 * - **Houses** (`houseSides`): a house at a row's end or beside an alley shows its side wall — the
 *   facade's own brick or plaster, a plain wall with a few small windows and iron wall anchors, the
 *   cornice line, the plinth — and the side of its pitched roof (slate) receding from the facade (the
 *   facade's depth) to the floor's back edge. A house taller than its neighbour shows the part of its
 *   side above the neighbour's eave. Found from the decor list: the house fronts at the facade's
 *   depth, a row = fronts that touch.
 * - **Houseboats** (`boatSides`): the hull's ends (stern and bow) and the cabin's ends, under the deck
 *   and roof tops (the hull ~22 world px wide in depth).
 * - **Boxes** (`boxSides`): a plain box in the walk plane or at a depth (the FABEL FRIET counter).
 *
 * Geometry: the engine's face helpers (mission/floor/faces.ts). Lighting: the morning sun stands to the left (the sky's sun), so a left side is lit and a right
 * side in shade. Tiles: a = down the face from its top edge, b = back in depth from the front (the
 * foreshortened direction, which the tiles mip). Written for every ams section (wave B: the house
 * rows of b, c, c1, d, the six houseboats of c, the stalls, the hot-dog stand).
 */
import { depthAtV, sAtDepth, vAtDepth, type FloorCam } from '../../../../../engine/floor/cam';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import { hash2 } from '../../../../art/paint';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import { slopeFace, topFace, wallFace } from '../../../../mission/floor/faces';
import type { FaceDef, FaceGroupDef } from '../../../../mission/floor/types';
import type { DecorDef } from '../../../../mission/types';
import { G, HOUSE_VARIANTS, type HouseSpec, type Light, type Wall } from '../art';
import { FACADE } from './layout';
import { dt, mod } from './mat';

/** A wall's look (the dense facades' families: art-hd-ab-houses.ts `WALL_HD`). */
interface WallLook {
  ramp: Ramp;
  lo: number;
  hi: number;
  kind: 'brick' | 'painted' | 'plaster';
  mortar: Ramp;
}

const LOOKS: Readonly<Record<Wall, WallLook>> = {
  brown: { ramp: PAL_HD.brown, lo: 1, hi: 6, kind: 'brick', mortar: PAL_HD.stone },
  rust: { ramp: PAL_HD.rust, lo: 1, hi: 5, kind: 'brick', mortar: PAL_HD.stone },
  red: { ramp: PAL_HD.red, lo: 3, hi: 6, kind: 'brick', mortar: PAL_HD.stone },
  darkred: { ramp: PAL_HD.red, lo: 1, hi: 4, kind: 'brick', mortar: PAL_HD.stone },
  green: { ramp: PAL_HD.green, lo: 1, hi: 4, kind: 'painted', mortar: PAL_HD.green },
  ink: { ramp: PAL_HD.black, lo: 1, hi: 5, kind: 'painted', mortar: PAL_HD.black },
  cream: { ramp: PAL_HD.plaster, lo: 2, hi: 6, kind: 'plaster', mortar: PAL_HD.plaster },
  grey: { ramp: PAL_HD.stone, lo: 2, hi: 6, kind: 'plaster', mortar: PAL_HD.stone },
};

/** Tone shift of a side: −1 left (toward the sun), +1 right (in shade). */
type Side = -1 | 1;
const SHADE: Readonly<Record<Side, number>> = { [-1]: -0.15, [1]: -1.25 } as Record<Side, number>;

/** The depth unit's camera of `ams` (floor/section-a.ts AMS_CAMERA; the walk line at G). */
const CAM: Pick<FloorCam, 'yh' | 'yw' | 'f'> = { yh: 60, yw: G, f: 210 };

/** Tile px of depth between two depths, in the px of a sprite drawn at `front` (the corners' units). */
export function depthPx(front: number, back: number): number {
  const c = CAM as FloorCam;
  return Math.abs(vAtDepth(c, front) - vAtDepth(c, back)) * sAtDepth(c, front);
}

/** The depth `px` world px behind (or in front of, < 0) a depth. */
export function depthBehind(depth: number, px: number): number {
  const c = CAM as FloorCam;
  return depthAtV(c, vAtDepth(c, depth) - px);
}

// ------------------------------------------------------------------------------- tiles

/** A side wall of a house: its look, the side, its height (a) and depth (b) in px, the windows. */
export interface WallTileOpts {
  wall: Wall;
  side: Side;
  /** Height (a extent, from the cornice down to the foot) and depth (b extent, a multiple of 4). */
  h: number;
  l: number;
  /** The top band: a deep white cornice (a flat top) or a thin coping. */
  cornice: number;
  /** Storey lines (a, from the top) where the iron anchors sit and small windows may open. */
  floors: readonly number[];
  seed: number;
  light: Light;
}

/** The id of a side wall tile (registered on first use). */
export function ensureWallTile(o: WallTileOpts): string {
  const id = `ams/side-wall/${o.wall}/${o.side < 0 ? 'l' : 'r'}/${o.h}x${o.l}/${o.cornice}/${o.seed}/${o.light}`;
  if (hasFloorTile(id)) return id;
  const look = LOOKS[o.wall];
  const mid = (look.lo + look.hi) / 2 + SHADE[o.side];
  const trim = PAL_HD.gable;
  const stone = PAL_HD.stone;
  // Small windows: on a few storeys, near the front (Amsterdam end walls are mostly blind).
  const wins: [number, number][] = [];
  o.floors.forEach((fa, i) => {
    if (i === 0 || hash2(i, 5, o.seed) > 0.42) return;
    const b0 = 6 + Math.floor(hash2(i, 6, o.seed) * Math.max(1, o.l - 18));
    wins.push([fa + 5, b0]);
  });
  defineFloorTile(id, {
    w: o.h,
    h: o.l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      // The cornice (a flat top) or the coping along the wall's top edge.
      if (a < o.cornice) {
        if (a < 0.6) return dt(trim, 5.6 + SHADE[o.side], X, Y);
        if (a > o.cornice - 0.8) return dt(stone, 2.2, X, Y);
        return dt(trim, 4.4 + SHADE[o.side] + (o.cornice > 3 && mod(b, 3) < 0.7 ? -0.8 : 0), X, Y);
      }
      // The plinth.
      if (a > o.h - 3) return dt(stone, 2.6 + SHADE[o.side] * 0.6 + (hash2(X >> 1, Y, 7) - 0.5) * 0.6, X, Y);
      // Windows: a white frame, dark panes with a sky glint.
      for (const [wa, wb] of wins) {
        const da = a - wa;
        const db = b - wb;
        if (da >= 0 && da < 8 && db >= 0 && db < 5) {
          if (da < 0.8 || da > 7.2 || db < 0.8 || db > 4.2) return dt(trim, 4.6 + SHADE[o.side], X, Y);
          if (Math.abs(da - 4) < 0.4) return dt(trim, 3.6, X, Y);
          return dt(PAL_HD.navy, da < 2 && db < 2 ? 4 : 1.6, X, Y);
        }
        // The sill under it.
        if (da >= 8 && da < 9 && db >= -0.6 && db < 5.6) return dt(stone, 4.2 + SHADE[o.side], X, Y);
      }
      // Iron wall anchors at the storey lines, near the front edge: a short upright with a cross bar.
      for (const fa of o.floors) {
        const da = a - (fa - 1.5);
        const db = b - 3;
        if ((Math.abs(da) < 1.6 && Math.abs(db) < 0.5) || (Math.abs(da) < 0.5 && Math.abs(db) < 1.2)) return dt(PAL_HD.black, 1.5, X, Y);
      }
      // Damp at the foot, soot under the top.
      let t = mid;
      if (a > o.h - 9) t -= ((a - (o.h - 9)) / 9) * 0.7;
      else if (a < o.cornice + 5) t -= ((o.cornice + 5 - a) / 5) * 0.5;
      if (look.kind === 'brick') {
        const ch = d >= 2 ? 1.5 : 3;
        const bl = d >= 2 ? 3 : 6;
        const course = Math.floor(a / ch);
        const la = a - course * ch;
        const bb = b + (course & 1) * bl * 0.5;
        const lb = mod(bb, bl);
        const joint = 1 / d;
        if (la < joint || lb < joint) return dt(look.mortar, 2.4 + SHADE[o.side] * 0.6, X, Y);
        const brick = Math.floor(bb / bl);
        t += (hash2(brick, course, o.seed) - 0.5) * 1.1;
        return dt(look.ramp, t, X, Y);
      }
      if (look.kind === 'plaster') {
        t += (hash2(X >> 1, Y >> 1, o.seed) - 0.5) * 0.5 + (hash2(Math.floor(b / 7), Math.floor(a / 9), o.seed + 1) - 0.5) * 0.5;
        if (hash2(X, Y, o.seed + 2) > 0.985) t -= 1;
        return dt(look.ramp, t, X, Y);
      }
      // Painted brick: faint courses.
      const course = Math.floor(a / (d >= 2 ? 1.5 : 3));
      if (a - course * (d >= 2 ? 1.5 : 3) < 1 / d) t -= 0.45;
      t += (hash2(X >> 1, Y, o.seed) - 0.5) * 0.4;
      return dt(look.ramp, t, X, Y);
    },
  });
  return id;
}

/** A slate roof's side (a = up the slope, b = back in depth), lit on the left. */
export function ensureRoofTile(side: Side): string {
  const id = `ams/side-roof/${side < 0 ? 'l' : 'r'}`;
  if (hasFloorTile(id)) return id;
  const base = side < 0 ? 3.4 : 2.1;
  defineFloorTile(id, {
    w: 8,
    h: 8,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      const course = Math.floor(a / 2);
      if (a - course * 2 < 1 / d) return dt(PAL_HD.slate, base - 1.2, X, Y);
      const bb = b + (course & 1) * 1.5;
      if (mod(bb, 3) < 0.5 / d + 0.2) return dt(PAL_HD.slate, base - 0.7, X, Y);
      return dt(PAL_HD.slate, base + (hash2(Math.floor(bb / 3), course, 77) - 0.5) * 0.8 + (a - course * 2) * 0.25, X, Y);
    },
  });
  return id;
}

/** A plain painted end (boats, counters): bands of colour down the face (a), lit on the left. */
export interface BandTileOpts {
  /** [a start, ramp, tone] bands from the top; the last runs to the bottom. */
  bands: readonly (readonly [number, Ramp, number])[];
  h: number;
  l: number;
  side: Side;
  /** Plank or plate joints every `joint` px of depth (0 = none). */
  joint?: number;
  key: string;
}

export function ensureBandTile(o: BandTileOpts): string {
  const id = `ams/side-band/${o.key}/${o.side < 0 ? 'l' : 'r'}/${o.h}x${o.l}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE[o.side] * 0.8;
  defineFloorTile(id, {
    w: o.h,
    h: o.l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      let k = 0;
      for (let i = 0; i < o.bands.length; i++) if (a >= o.bands[i][0]) k = i;
      const [a0, ramp, tone] = o.bands[k];
      let t = tone + sh + (hash2(X >> 1, Y >> 1, 3) - 0.5) * 0.35;
      if (a - a0 < 0.6 && k > 0) t += 0.6;
      if (o.joint && mod(b, o.joint) < 0.5 / d + 0.15) t -= 0.7;
      return dt(ramp, t, X, Y);
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- faces

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/** A house front as a box: its edges and heights in its sprite px (from its anchor), its wall. */
interface HouseBox {
  item: DecorDef;
  depth: number;
  /** World edges (for the row's neighbours) and sprite edges (the faces: half a px inside the art). */
  wl: number;
  wr: number;
  kl: number;
  kr: number;
  /** The eave (the wall's top at the edges), the ridge and its x (null: a flat top). */
  eave: number;
  ridge: number | null;
  rx: number;
  cornice: number;
  wall: Wall;
  floors: number[];
  seed: number;
}

/** The storey lines of a house (a from the eave down), for the anchors and windows. */
function storeys(eave: number, gf: number, floors: number, s: number): number[] {
  const out: number[] = [];
  for (let f = 0; f < floors; f++) out.push(eave - (gf + f * s) - s);
  return out.filter((a) => a > 4).reverse();
}

/** The box of a canal house frame (art.ts `paintHouse`: body, gable, lean, the 1-px outline). */
function houseBox(item: DecorDef, depth: number, spec: HouseSpec, s: number): HouseBox {
  const S = spec.s ?? 20;
  const gf = S + 8;
  const bodyH = gf + spec.floors * S;
  const gableH = spec.gable === 'flat' ? Math.max(4, Math.round(S * 0.35)) : spec.gable === 'spout' ? Math.round(S * 1.1) : Math.round(S * 1.35);
  const half = spec.w >> 1;
  const lean = Math.round(spec.lean);
  const kl = -half + 0.5 + Math.max(0, lean);
  const kr = spec.w - half - 0.5 + Math.min(0, lean);
  // A step gable's lowest step spans the whole front (its coping is the eave); a flat top's cornice
  // is a deep white band.
  const sh = spec.gable === 'step' ? Math.max(3, Math.floor(gableH / ((spec.w >= 40 ? 4 : 3) + 1))) : 0;
  const flat = spec.gable === 'flat';
  const eave = flat ? bodyH + gableH + 1 : bodyH + sh + 1;
  return {
    item,
    depth,
    wl: item.x + (-half - 1) / s,
    wr: item.x + (spec.w - half + 1) / s,
    kl,
    kr,
    eave,
    ridge: flat ? null : bodyH + Math.round(gableH * (spec.gable === 'spout' ? 0.75 : 0.82)),
    rx: lean,
    cornice: flat ? gableH + 1 : 1.6,
    wall: spec.wall,
    floors: storeys(eave, gf, spec.floors, S),
    seed: spec.seed,
  };
}

/** Other house fronts with a flat top (FABEL FRIET, its neighbour): measured from their frames. */
const FLAT_FRONTS: readonly { prefix: string; half: number; eave: number; wall: Wall; floors: readonly number[]; seed: number }[] = [
  { prefix: 'decor/ams/fabel-friet-', half: 48, eave: 145, wall: 'darkred', floors: [14, 44, 74, 104], seed: 31 },
  { prefix: 'decor/ams/neighbour-', half: 32, eave: 125, wall: 'brown', floors: [12, 48, 84], seed: 32 },
];

/** Options of `houseSides`. */
export interface HouseSidesOpts {
  /** The facade depth (default FACADE) and the depth the sides reach back to (the floor's back edge). */
  depth?: number;
  back: number;
  light: Light;
  /** The decor's depth rule (to find the fronts at the facade's depth). */
  depthOf: (d: DecorDef) => number | null | undefined;
  /** A taller house shows its side above a neighbour this much lower (px). Default 10. */
  step?: number;
}

/**
 * The side faces of the house fronts in a decor list (spec §11 R1): every row end and both sides of
 * every alley get the whole side (wall and roof); a house taller than its neighbour the part above the
 * neighbour's eave. One face group per house side.
 */
export function houseSides(decor: readonly DecorDef[], o: HouseSidesOpts): FaceGroupDef[] {
  const depth = o.depth ?? FACADE;
  const s = sAtDepth(CAM as FloorCam, depth);
  const boxes: HouseBox[] = [];
  for (const it of decor) {
    if ((it.depth ?? o.depthOf(it)) !== depth) continue;
    const m = /^decor\/ams\/house-/.exec(it.sprite);
    if (m) {
      const spec = HOUSE_VARIANTS[it.frame ?? 0];
      if (spec) boxes.push(houseBox(it, depth, spec, s));
      continue;
    }
    const fl = FLAT_FRONTS.find((f) => it.sprite.startsWith(f.prefix));
    if (fl) {
      boxes.push({
        item: it,
        depth,
        wl: it.x + (-fl.half - 1) / s,
        wr: it.x + (fl.half + 1) / s,
        kl: -fl.half + 0.5,
        kr: fl.half - 0.5,
        eave: fl.eave,
        ridge: null,
        rx: 0,
        cornice: 3,
        wall: fl.wall,
        floors: fl.floors.map((f) => fl.eave - f),
        seed: fl.seed,
      });
    }
  }
  boxes.sort((a, b) => a.wl - b.wl);
  const l = r4(depthPx(depth, o.back));
  const step = o.step ?? 10;
  const out: FaceGroupDef[] = [];
  boxes.forEach((h, i) => {
    for (const side of [-1, 1] as const) {
      const nb = side < 0 ? boxes[i - 1] : boxes[i + 1];
      const touching = nb !== undefined && (side < 0 ? h.wl - nb.wr : nb.wl - h.wr) < 2;
      const from = touching ? nb.eave : 0;
      if (touching && h.eave < nb.eave + step) continue;
      const kx = side < 0 ? h.kl : h.kr;
      const tile = ensureWallTile({ wall: h.wall, side, h: Math.round(h.eave), l, cornice: h.cornice, floors: h.floors, seed: h.seed, light: o.light });
      const faces: FaceDef[] = [wallFace(kx, from, h.eave, depth, o.back, side, tile, l)];
      if (h.ridge !== null) faces.push(slopeFace(kx, h.eave, h.rx, h.ridge, depth, o.back, side, ensureRoofTile(side), l));
      out.push({ name: `house side ${h.item.sprite}#${h.item.frame ?? 0} @${h.item.x} ${side < 0 ? 'L' : 'R'}`, x: h.item.x, y: h.item.y, depth, faces });
    }
  });
  return out;
}

/** A houseboat (terrain.ts `Houseboat`) and the water level under the walk plane. */
interface BoatLike {
  readonly x0: number;
  readonly w: number;
  readonly cx: number;
  readonly cw: number;
  readonly colour: number;
}

/** The houseboats' paint (art-hd-cd-boats.ts `HULLS`: the hull, the cabin). */
const HULL_RAMPS: readonly (readonly [Ramp, Ramp])[] = [
  [PAL_HD.green, PAL_HD.green],
  [PAL_HD.navy, PAL_HD.sky],
  [PAL_HD.red, PAL_HD.red],
  [PAL_HD.brown, PAL_HD.brown],
];

/** Options of `boatSides`: the deck and roof lines (world y), the hull's foot (its art reaches under the water) and the depths. */
export interface BoatSidesOpts {
  deckY: number;
  roofY: number;
  /** Height of the hull's foot over the walk plane (the sprite's bottom; the waterline stripe is 11 px under the deck). */
  bottom: number;
  /** How far back the hull and the cabin reach (DEPTH). */
  hull: number;
  cabin: number;
}

/**
 * The ends of houseboats (spec §11 R1): the hull's stern (left) and bow (right) from its foot to the
 * deck, the cabin's ends from the deck to the roof; the deck and roof tops are `tops` quads.
 */
export function boatSides(boats: readonly BoatLike[], o: BoatSidesOpts): FaceGroupDef[] {
  const deck = G - o.deckY;
  const roof = G - o.roofY;
  const lh = r4(depthPx(0, o.hull));
  const lc = r4(depthPx(0, o.cabin));
  return boats.map((b) => {
    const [hr, cr] = HULL_RAMPS[b.colour % HULL_RAMPS.length];
    const hullH = deck - o.bottom;
    const faces: FaceDef[] = [];
    for (const side of [-1, 1] as const) {
      const hull = ensureBandTile({ key: `hull${b.colour}`, h: Math.ceil(hullH), l: lh, side, joint: 0, bands: [[0, hr, 2.6], [3, hr, 1.4], [11, PAL_HD.red, 3], [12, PAL_HD.black, 0.8]] });
      const cabin = ensureBandTile({ key: `cabin${b.colour}`, h: Math.ceil(roof - deck), l: lc, side, joint: 5, bands: [[0, PAL_HD.wood, 3], [3, cr, cr.length - 3]] });
      // The stern is square; the bow rounds off at the waterline (its face stops 2 px short).
      faces.push(wallFace(side < 0 ? 0.5 : b.w - 2, o.bottom, deck, 0, o.hull, side, hull, lh));
      faces.push(wallFace(side < 0 ? b.cx - b.x0 + 0.5 : b.cx - b.x0 + b.cw - 0.5, deck, roof - 3, 0, o.cabin, side, cabin, lc, 3));
    }
    return { name: `houseboat @${b.x0}`, x: b.x0, y: G, depth: 0, order: 0, faces };
  });
}

/**
 * The stone end posts of a bridge's front railing (props.ts `ensureFrontRail`: `postW` × `postH`
 * world px, drawn pre-scaled at the deck's near edge): their outer sides and tops, a stone post's
 * depth back from the edge. Front decor: drawn over the world, before the railing's sprite.
 */
export function railPostSides(x0: number, len: number, near: number, postW: number, postH: number): FaceGroupDef {
  const back = depthBehind(near, postW);
  const l = r4(depthPx(near, back));
  const tile = (side: Side): string => ensureBandTile({ key: 'rail-post', h: Math.ceil(postH), l, side, bands: [[0, PAL_HD.stone, 5.4], [1.4, PAL_HD.stone, 3.9], [postH - 1.2, PAL_HD.stone, 2.6]] });
  const top = ensureBandTile({ key: 'rail-post-top', h: Math.ceil(postW), l, side: -1, bands: [[0, PAL_HD.stone, 5.6]] });
  return {
    name: `rail posts @${x0}`,
    x: x0,
    y: G,
    depth: near,
    front: true,
    faces: [
      wallFace(0, 0, postH, near, back, -1, tile(-1), l, 0, true),
      wallFace(len, 0, postH, near, back, 1, tile(1), l, 0, true),
      topFace(0, postW, postH, back, near, top, l, true),
      topFace(len - postW, len, postH, back, near, top, l, true),
    ],
  };
}

/** A box's two side ends (front decor or walk-plane decor): from its front plane back to `back`. */
export function boxSides(
  name: string,
  x: number,
  kl: number,
  kr: number,
  y0: number,
  y1: number,
  depth: number,
  back: number,
  tiles: readonly [string, string],
  l: number,
  front = false,
): FaceGroupDef {
  return {
    name,
    x,
    y: G,
    depth,
    front,
    faces: [wallFace(kl, y0, y1, depth, back, -1, tiles[0], l), wallFace(kr, y0, y1, depth, back, 1, tiles[1], l)],
  };
}

