/**
 * The bridges of `ams` c2 RONDVAART in perspective (docs/design/floor.md §12.2 c2: "the two low bridges
 * span the band from the back edge to the front …; the Magere Brug spans the band"): the boat carries
 * the camera along the river and passes under them, so each bridge is a deck crossing the river in
 * depth: from its 2D front at the walk line (the slab face in front of the world, as today) back over
 * the water to the far bank — `C2_BRIDGE_BACK`, the depth whose speed is the far bank layer's
 * (`C2_BANK_FACTOR`), so a bridge lands on the bank and scrolls with it. Under the deck the river
 * runs on (the boat's passage); the bridge stands on the far bank's abutment.
 *
 * - The low bridges (`ams-low-bridge`, cruise.ts; art-route.ts: the slab 64 px wide, its underside
 *   15 px under the walkway): an entity kind's faces (the entity calls them: render only) — the
 *   walkway's klinkers between two low brick parapets with stone copings, the parapets' inner sides and
 *   near ends, the slab's sides (brick, from the copings down to its underside); at the far bank the 2D
 *   back sprite (its railing and lamp, the dark arch, the piers into the water) pre-scaled for that
 *   depth (`ensureFarArch`): the far arch. The 2D back sprite at the walk line would put piers in the
 *   boat's path: it is hidden there. The deck stands on two brick PIERS just behind the fairway
 *   (`C2_PIER_FRONT`: the boat passes in front of them, as it passed the 2D piers), from its underside
 *   down into the water, their fronts and sides in perspective, the dark of the arch between them;
 *   under the deck the river lies in its shade (`c2ShadeSurface`, water.ts: a cut over the bridge's
 *   footprint), seen under the near span and through the arch — the deck spans, it does not float.
 * - The Magere Brug (`ams-magere-brug`): the kit's bascule faces (closed: the walkway and the slab's
 *   ends; lifting: the leaves' walkways turned up) reaching back to the far bank; the white portals
 *   stay at the walk line (the near gallows: split at the walkway's line, `ensureNearPortals`, their
 *   tops over the receding walkway) and a second pair stands at the far bank (`ensureFarPortals`,
 *   pre-scaled for that depth).
 *
 * Every face lies behind the walk plane: drawn under every entity (the officers on the walkways), the
 * slab face over the boat and its riders as in 2D. A bridge's body (the slab from its underside up)
 * projects above the boat's passage at every camera: it never hides the boat or its riders.
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../../../engine/pixel';
import type { Frame } from '../../../../../../engine/render';
import { defineSprite, getFrame, hasSprite, readyFrames } from '../../../../../../engine/sprites';
import { hash2 } from '../../../../../art/paint';
import { capFace, quadFace, topFace, wallFace, type FaceSide } from '../../../../../mission/floor/faces';
import { scaleFrame } from '../../../../../mission/floor/scale';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { EntityFacesDef, FaceDef, FacePoint } from '../../../../../mission/floor/types';
import { ROUTE_BRIDGES_HD } from '../../art-hd-route-bridges';
import { LOW_BRIDGE } from '../../cruise';
import { G } from '../../terrain';
import { WATER_LEVEL } from '../layout';
import { dt, klinkers, mix, mod } from '../mat';
import { depthPx } from '../sides';

/** The far bank layer's scroll factor (section-c2.ts C2_BANK_FACTOR; a literal: no import cycle) and the depth that scrolls at it. */
const BANK_FACTOR = 0.5;
export const C2_BRIDGE_BACK = (1 - BANK_FACTOR) * (G - 60);

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);
/** Tone shift of a side: −1 left (toward the sun), +1 right (in shade) — sides.ts. */
const SHADE = (side: FaceSide): number => (side < 0 ? -0.15 : -1.25);

// ------------------------------------------------------------------------------- tiles

/** A brick wall seen on its side (a = down from its top, b = depth): courses level in the world, a stone coping, a stone beam at its foot. */
function brickWall(side: FaceSide, h: number, l: number, coping: number, beam = 0): string {
  const id = `ams/c2/brick-wall/${side < 0 ? 'l' : 'r'}/${h}x${l}/${coping}/${beam}`;
  if (hasFloorTile(id)) return id;
  const sh = SHADE(side);
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (a < coping) return dt(PAL_HD.stone, (a < 0.6 ? 5.6 : 4.4) + sh, X, Y);
      if (a > h - beam) return dt(PAL_HD.stone, (a > h - 0.7 ? 2 : 3.4) + sh + (hash2(X >> 1, Y, 221) - 0.5) * 0.4, X, Y);
      const course = Math.floor((a - coping) / 2.4);
      const la = a - coping - course * 2.4;
      const bb = b + (course & 1) * 3;
      const lb = mod(bb, 6);
      const jw = Math.max(0.45, 1 / d);
      if (la < jw * 0.8 || lb < jw) return dt(PAL_HD.sand, 1.4 + sh * 0.5, X, Y);
      const k = hash2(Math.floor(bb / 6), course, 222);
      return dt(k < 0.55 ? PAL_HD.brickDark : PAL_HD.brick, (k < 0.55 ? 3.6 : 2.4) + sh + (hash2(X, Y, 223) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/** A parapet's stone coping seen from above (a = along x, b = depth): long dressed slabs. */
function copingTop(l: number): string {
  const id = `ams/c2/coping/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 4,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (mod(b, 18) < Math.max(0.5, 1 / d)) return dt(PAL_HD.stone, 3, X, Y);
      return dt(PAL_HD.stone, 5.2 - a * 0.25 + (hash2(Math.floor(b / 18), X, 224) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/** The walkway's klinkers seen from above (a = along x, b = depth), in the golden light. */
function walkTop(l: number): string {
  const id = `ams/c2/walk/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 61,
    h: l,
    paint: (a, b, d) => klinkers(a, b, Math.floor(a * d), Math.floor(b * d), -0.15, d),
  });
  return id;
}

/** A parapet's near end (a = down, b = across): brick under the coping. */
function parapetEnd(): string {
  const id = 'ams/c2/parapet-end';
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 8,
    h: 4,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (a < 1.6) return dt(PAL_HD.stone, a < 0.6 ? 5.8 : 4.6, X, Y);
      if (mod(a - 1.6, 2.4) < Math.max(0.45, 1 / d)) return dt(PAL_HD.sand, 1.6, X, Y);
      return dt(PAL_HD.brick, 2.8 + (hash2(X >> 1, Y >> 1, 225) - 0.5) * 0.6, X, Y);
    },
  });
  return id;
}

/**
 * A pier's brick (a = down from the deck's underside, b = across: along x on its front, the depth on a
 * side): a stone impost under the deck, brick courses level in the world, the wet dark band and moss
 * at the waterline (a = `h`). `tone`: the face's light (0 the front, a side's `SHADE`).
 */
function pierWall(key: string, tone: number, h: number, l: number): string {
  const id = `ams/c2/pier/${key}/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: r4(h),
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (a < 1.8) return dt(PAL_HD.stone, (a < 0.6 ? 4.6 : 3.6) + tone, X, Y);
      const wet = h - a;
      if (wet < 2.2) return dt(PAL_HD.moss, 1.2 + wet * 0.3 + tone * 0.5 + (hash2(X >> 1, Y, 226) - 0.5) * 0.6, X, Y);
      const course = Math.floor((a - 1.8) / 2.4);
      const la = a - 1.8 - course * 2.4;
      const bb = b + (course & 1) * 3;
      const jw = Math.max(0.45, 1 / d);
      // Damp toward the water: the bricks darken over the last 9 px.
      const damp = -0.9 * Math.max(0, 1 - (wet - 2.2) / 9);
      if (la < jw * 0.8 || mod(bb, 6) < jw) return dt(PAL_HD.sand, 1.2 + tone * 0.5 + damp, X, Y);
      const k = hash2(Math.floor(bb / 6), course, 227);
      return dt(k < 0.55 ? PAL_HD.brickDark : PAL_HD.brick, (k < 0.55 ? 3.4 : 2.2) + tone + damp + (hash2(X, Y, 228) - 0.5) * 0.5, X, Y);
    },
  });
  return id;
}

/** The dark under the deck between the piers (a = down from the underside, b = across): the arch's shade, a little light at the water. */
function archDark(h: number, w: number): string {
  const id = `ams/c2/arch-dark/${h}x${w}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: r4(h),
    h: r4(w),
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      const k = a / h;
      // The light from beyond the bridge on the water at the arch's foot: a faint teal sheen.
      if (k > 0.86) return mix(dt(PAL_HD.teal, 1.1 + (hash2(Math.floor(b / 4), Y, 229) - 0.5) * 0.8, X, Y), PAL_HD.slate[1], 0.4);
      return dt(PAL_HD.slate, 0.2 + k * 1.1, X, Y);
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- the low bridges

/** The parapets: their outer and inner x (the slab's outline ±32.5; 2 px thick) and their height over the walkway. */
const OUTER = 32.5;
const INNER = 30.5;
const PARAPET = 6;
/** A low bridge's half width (its deck's outline): the shade under it (c2/index.ts) covers ±this. */
export const C2_BRIDGE_HALF = OUTER;
/**
 * The piers: their front just behind the fairway (C2_FAIRWAY_FAR 16: the cruise boat's beam), their
 * back (DEPTH), and how wide each is at the deck's ends.
 */
export const C2_PIER_FRONT = 18;
const PIER_BACK = 22;
const PIER_W = 8;

/**
 * The faces of a low bridge (`ams-low-bridge`): its walkway between the parapets, their copings, inner
 * sides and near ends, the slab's sides down to its underside, from the walk plane back to `back`.
 */
export function c2LowBridgeFaces(back = C2_BRIDGE_BACK, max = 1): EntityFacesDef {
  const l = r4(depthPx(0, back));
  // Heights over the entity's y (its walkway): the parapet's top, the slab's underside.
  const top = PARAPET;
  const under = -(LOW_BRIDGE.under - LOW_BRIDGE.top);
  const side = (s: FaceSide): string => brickWall(s, Math.ceil(top - under), l, 1.6, 4);
  const pInner = (s: FaceSide): string => brickWall(s, PARAPET, l, 0);
  const faces: FaceDef[] = [
    // The piers and the dark of the arch between them (first: the deck's faces lie above them).
    ...pierFaces(under),
    // The walkway between the parapets, the parapets' copings.
    topFace(-INNER, INNER, 0, back, 0, walkTop(l), l),
    topFace(-OUTER, -INNER, top, back, 0, copingTop(l), l),
    topFace(INNER, OUTER, top, back, 0, copingTop(l), l),
    // The parapets' inner sides (the left one faces +u), the slab's sides down to its underside.
    wallFace(-INNER, 0, top, 0, back, 1, pInner(1), l),
    wallFace(INNER, 0, top, 0, back, -1, pInner(-1), l),
    wallFace(-OUTER, under, top, 0, back, -1, side(-1), l),
    wallFace(OUTER, under, top, 0, back, 1, side(1), l),
    // The parapets' near ends at the walk line (over the slab face's coping).
    capFace(-OUTER, -INNER, 0, top, 0, parapetEnd()),
    capFace(INNER, OUTER, 0, top, 0, parapetEnd()),
  ];
  return { max, y: LOW_BRIDGE.top, states: [faces] };
}

/**
 * The two piers under a low bridge's deck (from its underside `under`, px under the walkway, down to
 * the water: world corners there, so they stand in the river whatever the walkway's height) at the
 * deck's ends, `C2_PIER_FRONT` … `PIER_BACK` deep: their fronts, their outer and inner sides, and the
 * dark of the arch between them at their back.
 */
function pierFaces(under: number): FaceDef[] {
  const h = G - LOW_BRIDGE.top + under - WATER_LEVEL;
  const F = C2_PIER_FRONT;
  const B = PIER_BACK;
  const l = r4(depthPx(F, B));
  const top = (x: number, d: number): FacePoint => [x, under, d];
  const foot = (x: number, d: number): FacePoint => [x, WATER_LEVEL, d, 1];
  /** A front at depth d from x0 to x1 (a = down, b = along x). */
  const front = (x0: number, x1: number, d: number, tile: string): FaceDef =>
    quadFace([top(x0, d), top(x1, d), foot(x1, d), foot(x0, d)], [[0, 0], [0, x1 - x0], [h, x1 - x0], [h, 0]], tile);
  /** A side at x from F back to B, facing −u (side −1) or +u (+1) (a = down, b = depth). */
  const wall = (x: number, s: FaceSide): FaceDef =>
    s > 0
      ? quadFace([top(x, F), top(x, B), foot(x, B), foot(x, F)], [[0, 0], [0, l], [h, l], [h, 0]], pierWall(`r${h}`, SHADE(1), h, l))
      : quadFace([top(x, F), foot(x, F), foot(x, B), top(x, B)], [[0, 0], [h, 0], [h, l], [0, l]], pierWall(`l${h}`, SHADE(-1), h, l));
  const fr = pierWall(`f${h}`, -0.5, h, 8);
  const inner = OUTER - PIER_W;
  return [
    front(-inner, inner, B, archDark(h, 2 * inner)),
    front(-OUTER, -inner, F, fr),
    front(inner, OUTER, F, fr),
    wall(-OUTER, -1),
    wall(-inner, 1),
    wall(inner, -1),
    wall(OUTER, 1),
  ];
}

// ------------------------------------------------------------------------------- sprites

/** The HD frame of an art-route id at density d (the made one when there, else its generator). */
function routeHd(id: string, d: number, frame = 0): Frame {
  const made = readyFrames(id, d);
  if (made) return made[frame];
  const gen = ROUTE_BRIDGES_HD.find(([k]) => k === id);
  if (!gen) throw new Error(`no HD art for ${id}`);
  return gen[1](d)[frame];
}

/**
 * The 1× frame f scaled by s with nearest sampling (the 1× art stays in the 64-colour palette, hard
 * edges, like every 1× sprite); the anchor scaled onto the pixel grid.
 */
function nearest1x(f: Frame, s: number): Frame {
  const ox = Math.round(f.ox * s);
  const oy = Math.round(f.oy * s);
  const W = Math.max(1, Math.round(f.buf.w * s));
  const H = Math.max(1, Math.round(f.buf.h * s));
  const b = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(f.buf.h - 1, Math.floor((y - oy + 0.5) / s + f.oy));
    if (sy < 0) continue;
    for (let x = 0; x < W; x++) {
      const sx = Math.min(f.buf.w - 1, Math.floor((x - ox + 0.5) / s + f.ox));
      if (sx >= 0) b.data[y * W + x] = f.buf.data[sy * f.buf.w + sx];
    }
  }
  b.touch();
  return { buf: b, ox, oy };
}

/** A route sprite pre-scaled by s at every density (decor at a depth is drawn unscaled: the far bank's arch and portals). */
function ensureScaled(src: string, key: string, s: number): string {
  const id = `decor/ams/c2-${key}-${Math.round(s * 1000)}`;
  if (hasSprite(id)) return id;
  defineSprite(id, () => nearest1x(getFrame(src, 0, 1), s), { hd: (d) => [scaleFrame(routeHd(src, d), s, d)] });
  return id;
}

/** The low bridge's back sprite (railing, lamp, the dark arch, the piers) pre-scaled for the far bank: the far arch. */
export function ensureFarArch(s: number): string {
  return ensureScaled('decor/ams/low-bridge/back', 'low-bridge-far', s);
}

/** A frame's rows [y0, y1) (buffer px) as a new frame, the anchor kept (relative to the crop). */
function cropRows(f: Frame, y0: number, y1: number): Frame {
  const d = f.density ?? 1;
  const w = f.buf.w;
  const b = new PixelBuffer(w, Math.max(1, y1 - y0));
  b.data.set(f.buf.data.subarray(y0 * w, y1 * w));
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy - y0 / d, density: d };
}

/**
 * The Magere Brug's near portals split at the walkway's line (`part` 'top': the posts above it, the
 * beams and bulbs; 'foot': the posts below it and the stone piers in the river). The bascule's walkway
 * recedes behind the portals, so their tops are drawn over it (front decor: they stand above every
 * rider's head) and their feet stay behind the world (the boat passes in front of the piers, as in 2D).
 */
export function ensureNearPortals(part: 'top' | 'foot'): string {
  const id = `decor/ams/c2-magere-portals-${part}`;
  if (hasSprite(id)) return id;
  const src = 'decor/ams/magere-brug/back';
  const crop = (f: Frame): Frame => {
    const d = f.density ?? 1;
    const y = Math.round(f.oy * d);
    return part === 'top' ? cropRows(f, 0, y) : cropRows(f, y, f.buf.h);
  };
  defineSprite(id, () => crop(getFrame(src, 0, 1)), { hd: (d) => [crop(routeHd(src, d))] });
  return id;
}

/** The Magere Brug's portals pre-scaled for the far bank (the far gallows). */
export function ensureFarPortals(s: number): string {
  return ensureScaled('decor/ams/magere-brug/back', 'magere-portals', s);
}
