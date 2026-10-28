/**
 * THE PASSAGE through the Rijksmuseum on the floor of `ams` b (docs/design/floor.md §12.2 b, §4.4 b):
 * the museum's cycle passage as a tunnel in depth over 400–720.
 *
 * - The museum's front stands at the facade's depth (FACADE): the art's painted interior (the vault,
 *   the niches with their lamps, the tiled dado) is the passage's FAR WALL.
 * - The lane runs THROUGH it at the walk line, as on every other stretch (the riders ride on it): the
 *   street's own kerb lines, so it connects at both mouths without a bend — from the street at the
 *   left, to the crossing onto the square at the right; a far walkway along the far wall. The museum
 *   crate (470) stands on a small pavement bulb of its own (index.ts; street logic: nothing in the lane
 *   but traffic).
 * - The vault's SHADE lies only where the roof covers the floor: from the far wall to the platform
 *   line (v ≈ 0), soft over about 8 px at both mouths and 3 px at the roof's front edge
 *   (`passageShade`, a `FloorShade` the painter applies to whatever material lies there); the lane's
 *   near half and the near pavement stay in the light. The far kerb's face under the vault is the
 *   darker granite (`passageKerbs`).
 * - The roof the heroes walk on stays the platform it is (the terrain's solid, y 84–96): its top is a
 *   SLAB from the facade to the platform line (a face group like an overhang), seen from above. Its underside is not
 *   drawn: the floor's eye is 116 px over the walk plane, so a ceiling 80 px up is seen from above
 *   in a true view (hidden behind the slab's front); the art's own painted vault shows under it.
 * - The mouths: a pier under each end of the slab, from the facade's stone pilaster to the far
 *   walkway (`PIER_FRONT`, behind the far kerb's granite top: never in the lane), tiled like the
 *   passage (cream tiles, the blue band, the dado; darker toward the facade) with a stone cap in
 *   front; the slab's end (brick) above it.
 *   Slanted like an awning's cheek: on the art at the back, on the platform's end at the front — so
 *   its outer side faces the eye from the street and from most of the passage (the tiles wrap round
 *   the jamb); the line-scroll rule picks the side.
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import type { Color } from '../../../../../../engine/color';
import { capFace, quadFace, wallFace } from '../../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { DepthLine, FaceDef, FaceGroupDef, FloorFeature } from '../../../../../mission/floor/types';
import { G } from '../../art';
import { B_CEILING_Y, B_PASSAGE } from '../../terrain';
import { AMS_CAMERA, FACADE, FAR_KERB_TOP, HOUSE_FAR, KERB_H, vAtAms, type Bulb, type FloorShade } from '../layout';
import { dt, mod, STONE } from '../mat';
import { depthPx, ensureWallTile } from '../sides';
import { ensurePassageWallTile } from '../tiles';

/** The museum's anchor (section-b.ts: `x: B_PASSAGE[0] + 160`) and its art's passage (80…400 px from the left; ox 241). */
export const MUSEUM_X = B_PASSAGE[0] + 160;
/** The passage's mouths in the art, relative to the anchor (sprite px), and the stone pilasters' half width. */
const MOUTH_L = 81 - 241;
const MOUTH_R = 400 - 241;
const PILASTER = 3;
/** The platform (the passage roof the heroes walk on): its top line and the vault's springing (px over the walk line). */
export const ROOF_TOP_Y = B_CEILING_Y - 12;
const ROOF_H = G - ROOF_TOP_Y;
const CEIL_H = G - B_CEILING_Y;
/** The piers reach from the facade to this depth: on the far walkway, behind the far kerb's granite top (the lane's far edge at HOUSE_FAR). */
const PIER_FRONT = HOUSE_FAR + FAR_KERB_TOP + 0.2;
/** How much darker the floor under the vault is than the street outside (ramp tones). */
export const PASSAGE_SHADE = 2.1;
/** The shade's soft edges (world px): across each mouth, across the roof's front edge. */
const SHADE_SOFT = 8;
const SHADE_SOFT_NEAR = 3;

/** The far kerb's face under the vault (a darker twin of `ams/kerb-face`). */
export const PASSAGE_KERB = 'ams/b/passage-kerb';

function registerTiles(): void {
  if (hasFloorTile(PASSAGE_KERB)) return;
  defineFloorTile(PASSAGE_KERB, {
    w: 26,
    h: 4,
    paint: (a, b, d): Color => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (mod(a, 26) < 0.7) return dt(STONE, 1.2, X, Y);
      return dt(STONE, (b < 0.45 ? 4.2 : b < 1.1 ? 2.6 : 1.6) + ((X * 7 + Y * 13) % 5) * 0.08, X, Y);
    },
  });
}

/** The vault's shade over the passage's floor (the street layout's `shades`): from the far wall to the platform line. */
export function passageShade(): FloorShade {
  return { u0: B_PASSAGE[0], u1: B_PASSAGE[1], near: 0, tone: PASSAGE_SHADE, soft: SHADE_SOFT, softNear: SHADE_SOFT_NEAR };
}

/**
 * The far kerb under the vault with its darker face (after the street's features, `far` the street's
 * far kerb line): over the passage's u range except where a bulb lies flush (the museum crate's: its
 * own `raise` must stay the last word there).
 */
export function passageKerbs(far: DepthLine, bulbs: readonly Bulb[]): FloorFeature[] {
  registerTiles();
  const out: FloorFeature[] = [];
  let u = B_PASSAGE[0];
  for (const b of [...bulbs].sort((p, q) => p.u0 - q.u0)) {
    if (b.u3 <= u || b.u0 >= B_PASSAGE[1]) continue;
    if (b.u0 > u) out.push({ kind: 'kerb', u0: u, u1: b.u0, to: far, dh: KERB_H, face: PASSAGE_KERB });
    u = Math.max(u, b.u3);
  }
  if (u < B_PASSAGE[1]) out.push({ kind: 'kerb', u0: u, u1: B_PASSAGE[1], to: far, dh: KERB_H, face: PASSAGE_KERB });
  return out;
}

/**
 * The passage roof's top (spec §3.5 "a slab that sticks out of the front"): a stone slab from the
 * facade (its back edge on the art, over the opening) to the platform line (its front edge where the
 * heroes stand, v = 0). A face group (the roof is the terrain's SOLID, not a one-way platform, so it
 * is not an overhang: the overhangs' check looks for platforms), drawn after the piers.
 */
export function passageRoof(): FaceGroupDef {
  const l = r4(depthPx(0, FACADE));
  const x0 = B_PASSAGE[0] - MUSEUM_X;
  const x1 = B_PASSAGE[1] - MUSEUM_X;
  const w = x1 - x0;
  return {
    name: 'passage roof',
    x: MUSEUM_X,
    y: G,
    depth: FACADE,
    order: PIER_FRONT / 2,
    faces: [
      quadFace(
        [
          [x0, ROOF_H, FACADE],
          [x1, ROOF_H, FACADE],
          [x1, ROOF_H, 0, 1],
          [x0, ROOF_H, 0, 1],
        ],
        [
          [0, 0],
          [w, 0],
          [w, l],
          [0, l],
        ],
        'ams/b/passage-roof',
      ),
    ],
  };
}

defineFloorTile('ams/b/passage-roof', {
  w: 24,
  h: 4,
  paint: (a, b, d): Color => {
    const X = Math.floor(a * d);
    const Y = Math.floor(b * d);
    // Dressed sandstone slabs (the museum's cream bands), a joint every 24 px, lit toward the front lip.
    if (mod(a, 24) < 0.6) return dt(PAL_HD.sand, 2.4, X, Y);
    return dt(PAL_HD.sand, 4.6 + (((X * 5 + Y * 3) % 7) - 3) * 0.06 + b * 0.04, X, Y);
  },
});

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/**
 * The two mouths (spec §12.2 b "its arches' side faces at both mouths"; §12.1 item 1): per mouth a
 * pier from the facade to the far walkway (its inner face tiled, its outer face brick, its front a
 * stone cap) and the slab's end above it. Anchored on the museum at the facade's depth: the back
 * corners on the art's pilaster (sprite px), the front ones on the platform's end (world px).
 */
export function passageMouths(): FaceGroupDef[] {
  const l = r4(depthPx(PIER_FRONT, FACADE));
  const lr = r4(depthPx(0, FACADE));
  const out: FaceGroupDef[] = [];
  for (const side of [-1, 1] as const) {
    // side −1: the left mouth (its inner face looks +u into the passage), +1 the right mouth.
    const edge = side < 0 ? MOUTH_L : MOUTH_R;
    const inner = edge - side * PILASTER;
    const outer = edge + side * PILASTER;
    // A face at x shows toward −u with side −1 (faces.ts): the inner face of the left pier looks +u.
    const inSide = (side < 0 ? 1 : -1) as -1 | 1;
    const outSide = (-inSide) as -1 | 1;
    // The pier is slanted (on the art's pilaster at the back, at the platform's end in front), so its
    // outer side faces the eye from the street AND from most of the passage: the tunnel's tiles wrap
    // round the jamb (both sides tiled); the slab's end over it is the roof's brick.
    const tileIn = ensurePassageWallTile(inSide, CEIL_H, l);
    const tileOut = ensurePassageWallTile(outSide, CEIL_H, l);
    const tileEnd = ensureWallTile({ wall: 'rust', side: outSide, h: ROOF_H - CEIL_H, l: lr, cornice: 0, floors: [], seed: 41, light: 'noon' });
    // The front corners in world px right of the anchor: the platform's end (400 / 720) ± the pilaster.
    const xIn = (side < 0 ? B_PASSAGE[0] : B_PASSAGE[1]) - MUSEUM_X - side * PILASTER;
    const xOut = xIn + side * 2 * PILASTER;
    const capL = slantX(Math.min(inner, outer), Math.min(xIn, xOut), PIER_FRONT);
    const capR = slantX(Math.max(inner, outer), Math.max(xIn, xOut), PIER_FRONT);
    const faces: FaceDef[] = [
      slant(inner, xIn, 0, CEIL_H, PIER_FRONT, FACADE, inSide, tileIn, l),
      slant(outer, xOut, 0, CEIL_H, PIER_FRONT, FACADE, outSide, tileOut, l),
      // The slab's end from the facade to the platform's end (its outer side: the inner one lies under the slab).
      slant(outer, xOut, CEIL_H, ROOF_H, 0, FACADE, outSide, tileEnd, lr),
      capFace(capL, capR, slantY(0, PIER_FRONT), slantY(CEIL_H, PIER_FRONT), PIER_FRONT, 'ams/b/pier-cap', true),
    ];
    // Drawn after the facade (the piers stand in front of it) and before the walk plane's decor.
    out.push({ name: `passage mouth ${side < 0 ? 'L' : 'R'}`, x: MUSEUM_X, y: G, depth: FACADE, order: PIER_FRONT, faces });
  }
  return out;
}

/** The walk line's height over the horizon (the `ams` camera) and the facade's scale (the art at FACADE is drawn unscaled: a sprite px there is 1/s world px). */
const K1 = 176 - AMS_CAMERA.yh;
const S_FACADE = 1 - FACADE / K1;

/** How far (0…1) a depth lies from the walk plane toward the facade (world u and h are linear in v along a cheek). */
function mixAt(depth: number): number {
  return (vAtAms(0) - vAtAms(depth)) / (vAtAms(0) - vAtAms(FACADE));
}

/** World x (right of the anchor) at `depth` on the cheek from the art's sprite px `xb` (facade) to world px `xf` (walk plane). */
function slantX(xb: number, xf: number, depth: number): number {
  return xf + (xb / S_FACADE - xf) * mixAt(depth);
}

/** World height at `depth` on the cheek from the art's y (sprite px over its feet at the facade) to world y at the walk plane. */
function slantY(y: number, depth: number): number {
  return y + (y / S_FACADE - y) * mixAt(depth);
}

/**
 * A cheek from depth `back` to depth `front` (front < back ≤ FACADE), from y0 to y1: at the facade its
 * corners lie on the art (sprite px `xb`, y px over its feet), elsewhere on the straight line to the
 * walk plane's world px `xf` (where the platform ends). Like `wallFace(…, 'front')`, slanted.
 */
function slant(xb: number, xf: number, y0: number, y1: number, front: number, back: number, side: -1 | 1, tile: string, l: number): FaceDef {
  const f = wallFace(0, y0, y1, front, back, side, tile, l);
  const pts = f.pts.map((p) => {
    const d = p[2];
    if (d === FACADE) return [xb, p[1], d] as const;
    return [slantX(xb, xf, d), slantY(p[1], d), d, 1] as const;
  });
  return { ...f, pts };
}

defineFloorTile('ams/b/pier-cap', {
  w: 8,
  h: 8,
  paint: (a, b, d): Color => {
    const X = Math.floor(a * d);
    const Y = Math.floor(b * d);
    // The pilaster's cream stone in front (a = down, b = across): courses every 8 px, lit at the left arris.
    if (mod(a, 8) < 0.6) return dt(PAL_HD.sand, 3, X, Y);
    return dt(PAL_HD.sand, (b < 1 ? 5.6 : 4.6) + (((X * 3 + Y * 5) % 7) - 3) * 0.05, X, Y);
  },
});

