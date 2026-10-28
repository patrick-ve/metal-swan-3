/**
 * The white wooden Amstel bridge of `ams` c1 BRUG in perspective (docs/design/floor.md §4.4, §12.2 c1):
 * a long white footbridge over the river, the heroes walking its deck (a one-way platform at y 152 over
 * the water, physics unchanged).
 *
 * - The DECK: a raised strip around v = 0 in the height field (a `cut` at the deck's level over the
 *   river's gap: a dh feature has no profile to stand on there), its planks a TILE surface
 *   (`DECK_TOP`: the painter's planks in the painter's light, one tile 102 px long that holds the
 *   deck's whole depth): the chunks under the deck hold nothing else, so they are never painted — two
 *   4× chunks less at tier 4 (CPU and GPU); its near face
 *   (`ams/c1/deck-face`) is the bridge's side seen from the river: the white edge beam, the white
 *   fish-belly girders between the piles, the shadow under the deck, the piles' wet green feet. The near
 *   edge stands just in front of the walk line (`C1_DECK_NEAR`): the river's tour boats (the script's,
 *   their waterline at y 182) sail in front of it, on the water.
 * - The RAMP down to the quay (760–860, a sloping platform): not a height field (a level is constant);
 *   a face group — its plank top and its near face — drawn under every entity (`rampFaces`).
 * - The white RAILINGS: one low railing design (`ensureWhiteRail`: white posts with caps, cross bracing,
 *   the round handrail with its bulbs; 1× and 2× / 4× on an HdCanvas), as a back row on the far edge
 *   (scaled by the row) and as front decor over the walk line (legs only: the front-row rule's height),
 *   flat over the deck and sloping over the ramp.
 * - The GALLOWS (the white portals, spec "spanning the deck in depth, the heroes walk under them"): the
 *   old portal sprite stays at the walk line (the near frame: the secret crate hangs from its balance
 *   beam), a second one stands on the far edge (a back row, index.ts): the two frames span the deck,
 *   their tops at the eye's height (a beam between them would show only as an edge).
 *
 * Units: u = world x, h over the walk plane (G), depths in the kits' DEPTH (docs/api/floor.md §2).
 */
import type { Color } from '../../../../../../engine/color';
import { INK, PAL } from '../../../../../../engine/palette';
import { PAL_HD } from '../../../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../../../engine/pixel';
import type { Frame } from '../../../../../../engine/render';
import { defineSprite, hasSprite, type DenseDensity } from '../../../../../../engine/sprites';
import { hash2 } from '../../../../../art/paint';
import { quadFace, topFace, wallFace } from '../../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { FaceDef, FaceGroupDef } from '../../../../../mission/floor/types';
import { decoMat, glowMat, HdCanvas, metalMat } from '../../art-hd-cd-kit';
import { fr } from '../../art-hd-ab-kit';
import { C_AMSTEL, C_BRIDGE_END, C_BRIDGE_Y, G } from '../../terrain';
import { depthAtAms, WATER_LEVEL } from '../layout';
import { depthLight, dt, floorLight, mix, mod, planks } from '../mat';
import { depthBehind, depthPx, ensureBandTile } from '../sides';

/** The deck's height over the walk plane (the platform at y 152). */
export const C1_DECK_H = G - C_BRIDGE_Y;
/**
 * The deck's far edge (DEPTH: a little behind the quay lane's far kerb, the bridge as wide as the street
 * with its far pavement) and its near edge: just in front of the walk line, so the near face's foot
 * meets the water at y ≈ 181.6 — the tour boats' waterline (182) lies in front of it.
 */
export const C1_DECK_FAR = 21;
export const C1_DECK_NEAR = -1.6;
/** The ramp: from the deck's end (760, h 24) down to the quay (860, h 4). */
export const C1_RAMP: readonly [number, number] = [C_BRIDGE_END, C_AMSTEL[1]];
export const C1_RAMP_FOOT_H = 4;

/** The railing's height over the deck (world px; low: a front railing covers legs only) and the post pitch. */
export const WHITE_RAIL_H = 9.5;
const POST_PITCH = 16;
const POST_W = 3;

/** The deck face tile, the deck's plank top and the ramp's plank tile. */
export const DECK_FACE = 'ams/c1/deck-face';
export const DECK_TOP = 'ams/c1/deck-planks';
const RAMP_TOP = 'ams/c1/ramp-planks';
/** The deck top's tile: 30 planks of 3.4 px along u; 56 px of v (the deck's −46.4 … 2.9: no wrap inside it). */
const DECK_TOP_W = 102;
const DECK_TOP_H = 56;
/** The tile's b wraps between the deck's near edge (v 2.9) and its far edge (b 9.6 = v −46.4). */
const DECK_V_WRAP = 6;

// ------------------------------------------------------------------------------- tiles

/** The golden light of c1 over a tile texel (as the painter mixes it over the chunks). */
const GOLDEN = floorLight('golden');
function lit(c: Color): Color {
  return mix(c, GOLDEN.tint, GOLDEN.k);
}

/**
 * The deck's near face (a = world u, b = px below the deck's top edge, down to the water 28 px lower):
 * the edge board and beam, the fish-belly girders between the piles (the 2D span's soffit, period 64),
 * the shadow under the deck with the river seen beneath it, the white piles with iron collars and a wet
 * green foot.
 */
function ensureDeckFace(): string {
  if (hasFloorTile(DECK_FACE)) return DECK_FACE;
  const depth = C1_DECK_H - WATER_LEVEL;
  defineFloorTile(DECK_FACE, {
    w: 64,
    h: depth,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      const g = PAL_HD.gable;
      // The deck board's lit edge, then the white edge beam with a shadow line under it.
      if (b < 0.9) return lit(dt(g, 6, X, Y));
      if (b < 3.6) return lit(dt(g, 4.6 + (hash2(X >> 2, Y, 201) - 0.5) * 0.35 - (b > 3 ? 0.9 : 0), X, Y));
      // The piles (the 2D span's piers at u ≡ 61 mod 64, 6 px wide): lit left, shaded right, collars, the wet foot.
      const p = mod(a - 61, 64);
      if (p < 6) {
        if (b > depth - 3.2) return lit(dt(PAL_HD.moss, 1.6 + (hash2(X, Y, 202) - 0.5) * 0.8, X, Y));
        if (Math.abs(b - 6) < 0.7 || Math.abs(b - 20) < 0.7) return lit(dt(PAL_HD.slate, 2.4, X, Y));
        const t = p < 1 ? 5.6 : p > 5 ? 2.8 : 4.4 - p * 0.15;
        return lit(dt(g, t - (b > depth - 6 ? 0.5 : 0) + (hash2(X >> 1, Y >> 2, 203) - 0.5) * 0.3, X, Y));
      }
      // The girder between two piles: a white fish belly from the beam down to its moulded lower edge.
      const q = mod(a - 67, 64);
      if (q < 58) {
        const edge = 4 + Math.sin((q / 58) * Math.PI) * 10;
        if (b < edge + 1) {
          const t = b > edge + 0.3 ? 5.4 : b < 4.6 ? 3.4 : 4.4;
          return lit(dt(g, t + (hash2(X >> 2, Y >> 1, 204) - 0.5) * 0.25, X, Y));
        }
      }
      // Under the deck: dark, the river under the bridge near the foot.
      if (b > depth - 3.6) return lit(dt(PAL_HD.teal, 1.3 + (hash2(X >> 1, Y, 205) > 0.86 ? 1.2 : 0), X, Y));
      return lit(dt(PAL_HD.navy, 0.9 + Math.max(0, 1.2 - (b - 4) * 0.12), X, Y));
    },
  });
  return DECK_FACE;
}

/** The ramp's planks seen from above (a = u, b = depth): the painter's planks under the golden light. */
/**
 * The deck's top (a = u, b = v mod `DECK_TOP_H`): the planks the floor painter laid there before, in its
 * light — the far rows darker (`depthLight`), the golden tint — so the deck looks as it did.
 */
function ensureDeckTop(): string {
  if (hasFloorTile(DECK_TOP)) return DECK_TOP;
  defineFloorTile(DECK_TOP, {
    w: DECK_TOP_W,
    h: DECK_TOP_H,
    paint: (a, b, d) => {
      const v = b < DECK_V_WRAP ? b : b - DECK_TOP_H;
      return lit(planks(a, v, Math.floor(a * d), Math.floor(b * d), depthLight(depthAtAms(v)) + GOLDEN.tone, d));
    },
  });
  return DECK_TOP;
}

function ensureRampTile(): string {
  if (hasFloorTile(RAMP_TOP)) return RAMP_TOP;
  defineFloorTile(RAMP_TOP, {
    w: 68,
    h: 40,
    paint: (a, b, d) => lit(planks(a, b, Math.floor(a * d), Math.floor(b * d), GOLDEN.tone - 0.2, d)),
  });
  return RAMP_TOP;
}

// ------------------------------------------------------------------------------- the railing sprite

/** The railing's frame box: `len` px long, its deck line dropping `drop(x)` px along it. */
function railBox(len: number, dropMax: number): { W: number; H: number; ox: number; oy: number } {
  const W = len + 2;
  const H = Math.ceil(WHITE_RAIL_H + 2.5 + dropMax) + 2;
  return { W, H, ox: 1, oy: Math.ceil(WHITE_RAIL_H + 2.5) };
}

/** The 1× railing: palette whites, the ink outline. */
function rail1x(len: number, dropMax: number, drop: (x: number) => number): Frame {
  const { W, H, ox, oy } = railBox(len, dropMax);
  const b = new PixelBuffer(W, H);
  const base = (x: number): number => oy + Math.round(drop(x - ox));
  const top = Math.round(WHITE_RAIL_H);
  for (let x = ox; x <= ox + len; x++) {
    const y = base(x);
    b.set(x, y - 1, PAL.snow[1]);
    b.set(x, y - top + 1, PAL.snow[3]);
    b.set(x, y - top + 2, PAL.snow[1]);
  }
  for (let x0 = 0; x0 < len; x0 += POST_PITCH) {
    const X = ox + x0;
    // Cross bracing to the next post, then the post with its cap.
    if (x0 + POST_PITCH <= len) {
      const xa = X + POST_W;
      const xb = X + POST_PITCH;
      b.line(xa, base(xa) - top + 3, xb, base(xb) - 2, PAL.snow[2]);
      b.line(xa, base(xa) - 2, xb, base(xb) - top + 3, PAL.snow[2]);
      b.set(X + 8, base(X + 8) - top, PAL.gold[3]);
    }
    const y = base(X + 1);
    b.rect(X, y - top, POST_W, top, PAL.snow[2]);
    b.vline(X, y - top, y - 1, PAL.snow[3]);
    b.vline(X + POST_W - 1, y - top + 1, y - 1, PAL.steel[3]);
  }
  b.outline(INK);
  return { buf: b, ox, oy };
}

/** The 2× / 4× railing: painted timber posts and braces, the round handrail, warm bulbs (outline C). */
function railHd(len: number, dropMax: number, drop: (x: number) => number, d: DenseDensity): Frame {
  const { W, H, ox, oy } = railBox(len, dropMax);
  const c = new HdCanvas(W, H, d);
  const white = decoMat(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.25, shine: 14, edge: 'C' });
  const iron = metalMat(c, PAL_HD.slate, { lo: 1, hi: 5, edge: 'C', spec: 0.6 });
  const bulb = glowMat(c, PAL_HD.gold, 4, 7, { edge: 'C' });
  const Y = (x: number, z: number): number => oy + drop(x - ox) - z;
  const pts = (z: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let x = ox; x <= ox + len + 0.01; x += 2) out.push([x, Y(x, z)]);
    return out;
  };
  // The kick rail along the deck.
  c.stroke(pts(0.6), 0.5, 0.5, { mat: white, z: 0.6 });
  for (let x0 = 0; x0 < len; x0 += POST_PITCH) {
    const X = ox + x0;
    if (x0 + POST_PITCH <= len) {
      const xa = X + POST_W + 0.5;
      const xb = X + POST_PITCH - 0.5;
      c.capsule(xa, Y(xa, WHITE_RAIL_H - 2.6), xb, Y(xb, 1.4), 0.5, 0.5, { mat: white, z: 0.2, round: 0.7 });
      c.capsule(xa, Y(xa, 1.4), xb, Y(xb, WHITE_RAIL_H - 2.6), 0.5, 0.5, { mat: white, z: 0.35, round: 0.7 });
      c.ellipsoid(X + 8.5, Y(X + 8.5, WHITE_RAIL_H - 2.4 + 0.2), 0.42, 0.42, { mat: iron, z: 1 });
    }
    const yb = Y(X + POST_W / 2, 0);
    c.box(X, yb - WHITE_RAIL_H, POST_W, WHITE_RAIL_H, { mat: white, z: 1, bevel: 0.6 });
    c.box(X - 0.3, yb - WHITE_RAIL_H - 0.4, POST_W + 0.6, 1.1, { mat: white, z: 1.7, bevel: 0.45, n: [0, -0.6, 0.8] });
    c.ellipsoid(X + POST_W / 2, yb - WHITE_RAIL_H * 0.5, 0.4, 0.4, { mat: iron, z: 2 });
  }
  c.stroke(pts(WHITE_RAIL_H - 1.1), 0.95, 0.95, { mat: white, z: 1.4 });
  for (let x = ox + 8; x < ox + len; x += POST_PITCH) {
    const y = Y(x, WHITE_RAIL_H - 0.4);
    c.ellipsoid(x + 0.5, y, 0.8, 0.75, {
      mat: bulb,
      z: 2.4,
      tex: (s) => {
        s.tone = 0.95 - Math.hypot(s.x - x - 0.3, s.y - y + 0.25) * 0.7;
      },
    });
  }
  return fr(c.render({ outline: 'C', ao: 0.25, sepZ: 0.3 }), ox, oy, d);
}

/**
 * The sprite id of a white railing `len` px long whose deck line drops `drop` px over its last `slope`
 * px (0: flat): registered once (1× and the dense twins).
 */
export function ensureWhiteRail(len: number, slope = 0, dropTotal = 0): string {
  const id = `decor/ams/c1-white-rail-${len}-${slope}-${dropTotal}`;
  if (hasSprite(id)) return id;
  const flat = len - slope;
  const drop = (x: number): number => (slope > 0 && x > flat ? ((x - flat) / slope) * dropTotal : 0);
  defineSprite(id, () => rail1x(len, dropTotal, drop), { hd: (d) => railHd(len, dropTotal, drop, d) });
  return id;
}

// ------------------------------------------------------------------------------- faces

/** World px of a tile's depth span between two depths (b of a top). */
const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/** The ramp (a face group under every entity): its plank top from the far to the near edge and its near face down to the water. */
export function rampFaces(): FaceGroupDef {
  const [u0, u1] = C1_RAMP;
  const L = u1 - u0;
  const h0 = C1_DECK_H;
  const h1 = C1_RAMP_FOOT_H;
  const wl = WATER_LEVEL;
  const l = r4(depthPx(C1_DECK_NEAR, C1_DECK_FAR));
  const top = ensureRampTile();
  const face = ensureDeckFace();
  const F = C1_DECK_FAR;
  const N = C1_DECK_NEAR;
  const faces: FaceDef[] = [
    // The top, seen from above (far edge first, clockwise on screen); a = u, b = depth.
    quadFace([[0, h0, F, 1], [L, h1, F, 1], [L, h1, N, 1], [0, h0, N, 1]], [[u0, 0], [u1, 0], [u1, l], [u0, l]], top),
    // The near face (toward the camera): the deck face's look with its top edge on the slope.
    quadFace([[0, h0, N, 1], [L, h1, N, 1], [L, wl, N, 1], [0, wl, N, 1]], [[u0, 0], [u1, 0], [u1, h1 - wl], [u0, h0 - wl]], face),
  ];
  return { name: 'c1 white bridge ramp', x: u0, y: G, depth: 0, order: 0, faces };
}

/** How deep a railing post is (world px): its sides recede that far from the railing's plane. */
const POST_DEEP = 2.6;

/**
 * The sides and caps of a white railing piece's posts (spec §12.2 c1 "white railings back and front with
 * post sides"): one face group per piece, in world px (exact on the deck for the back row the floor
 * places, and on the deck line for the front decor), each post's two sides receding `POST_DEEP` from
 * the railing's depth and its cap; the ramp piece's posts follow the slope. `front`: the front railing
 * (drawn over the world, before its sprite).
 */
export function railPostFaces(x0: number, len: number, slope: number, dropTotal: number, depth: number, front: boolean): FaceGroupDef {
  const back = depthBehind(depth, POST_DEEP);
  const l = r4(depthPx(depth, back));
  const side = (s: -1 | 1): string => ensureBandTile({ key: 'c1-white-post', h: 10, l, side: s, bands: [[0, PAL_HD.gable, 5.6], [1.2, PAL_HD.gable, 4.4], [8.6, PAL_HD.gable, 3.6]] });
  const cap = ensureBandTile({ key: 'c1-white-post-cap', h: 4, l, side: -1, bands: [[0, PAL_HD.gable, 5.8]] });
  const flat = len - slope;
  const faces: FaceDef[] = [];
  for (let x = 0; x < len; x += POST_PITCH) {
    const drop = slope > 0 && x + POST_W / 2 > flat ? ((x + POST_W / 2 - flat) / slope) * dropTotal : 0;
    const h0 = C1_DECK_H - drop;
    const h1 = h0 + WHITE_RAIL_H;
    faces.push(
      wallFace(x, h0, h1, depth, back, -1, side(-1), l, 0, true),
      wallFace(x + POST_W, h0, h1, depth, back, 1, side(1), l, 0, true),
      topFace(x, x + POST_W, h1, back, depth, cap, l, true),
    );
  }
  return { name: `c1 white railing posts @${x0}${front ? ' (front)' : ''}`, x: x0, y: G, depth, front, faces };
}

/** The tiles of the bridge (registered on first use; the def's builder calls this). */
export function ensureBridgeTiles(): void {
  ensureDeckFace();
  ensureDeckTop();
  ensureRampTile();
}
