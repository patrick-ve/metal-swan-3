/**
 * The small open canal boat in perspective (docs/design/floor.md §11 R1: "canal boats more 3D"): the
 * `ams-boat-platform` the heroes ride over a canal is a moving entity, so its faces cannot be a static
 * face group (docs/api/floor.md §8.1). On a section with a floor it draws them itself, RENDER ONLY,
 * each frame before its sprite, at its x and bob:
 *
 * - the top: the open hull seen from above, from the near gunwale (the sprite's top edge, v = 0) back
 *   over its beam — the far gunwale's rim, the inner side of the far planking, the floorboards, three
 *   thwarts; the bow end narrower (the hull closes to its stem);
 * - the ends: the transom (the stern, square, with the motor on it) and the bow, from the gunwale to
 *   the waterline, receding over the beam — only the end that faces the screen's centre column shows,
 *   narrowing to nothing as the boat passes it (the line-scroll rule of the side faces);
 * - the hull in its own wood (the sprite's brown planks, the light gunwale, the teal stripe).
 *
 * Geometry from the 1× art (npc.art.ts `smallBoat`: 64 × 22, anchor (32, 2); the gunwale on row 3
 * from x 2 to 61, the stern raking to x 8 and the stem to x 57 at the keel; the motor at the stern).
 * One quad canvas per density (made once), the faces rastered every frame (the boat moves): nothing is
 * allocated per frame. Without a floor nothing changes: the entity draws its sprite as before.
 */
import type { Entity } from '../../../../../engine/entity';
import { FLOOR_CX, sOfV } from '../../../../../engine/floor/cam';
import { QUAD_EDGES, QuadCanvas } from '../../../../../engine/floor/quad';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../../engine/render';
import { artTier, hiArtOn } from '../../../../../engine/sprites';
import { hash2 } from '../../../../art/paint';
import { worldFloor } from '../../../../mission/floor/hooks';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import type { SectionFloor } from '../../../../mission/floor/section-floor';
import { G } from '../art';
import { WATER_LEVEL } from './layout';
import { dt, mod } from './mat';
import { ensureBandTile } from './sides';

/** The boat's beam (world px of depth behind the near gunwale; a sloep of ~1.4 m beside the 1.8 m heroes). */
export const ROWBOAT_BEAM = 13;
/** Its length at the gunwale (world px, centred on the entity's x) and at the waterline: the stern rakes, the stem less. */
const HALF = 30;
const STERN_WL = 25.8;
const BOW_WL = 27.2;
/** The far gunwale's bow end sits this far back from the near one's (the hull closes to its stem). */
const BOW_TAPER = 6;
/** The gunwale is 1 px under the entity's y (the sprite's row 3, its anchor on row 2). */
const GUNWALE = 1;

const INSIDE = 'ams/rowboat-inside';
const END_H = 8;
const END_L = 16;

/** The inside of the open hull (a = along u from the stern, b = back from the far gunwale toward the near one). */
function ensureInsideTile(): string {
  if (hasFloorTile(INSIDE)) return INSIDE;
  defineFloorTile(INSIDE, {
    w: 64,
    h: 16,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      // The far gunwale's rim (the sprite's light cap), the inner side of the far planking in shade.
      if (b < 1.3) return dt(PAL_HD.cloth, b < 0.6 ? 4.4 : 3.4, X, Y);
      if (b < 4.2) return dt(PAL_HD.wood, 2.2 + (mod(b - 1.3, 1.5) < 0.4 ? -0.6 : 0) + (b - 1.3) * 0.15, X, Y);
      // Three thwarts across the hull (lit tops, a shadow on their near side).
      for (const t of [13, 30, 46]) {
        const q = a - t;
        if (q >= 0 && q < 3) return dt(PAL_HD.wood, q < 0.6 ? 5.2 : 4.4, X, Y);
        if (q >= 3 && q < 4) return dt(PAL_HD.wood, 1.6, X, Y);
      }
      // The floorboards along the boat, a joint every 2.4 px across.
      if (mod(b, 2.4) < 0.45) return dt(PAL_HD.wood, 1.9, X, Y);
      return dt(PAL_HD.wood, 3.1 + (hash2(Math.floor(a / 9), Math.floor(b / 2.4), 61) - 0.5) * 0.5, X, Y);
    },
  });
  return INSIDE;
}

/** An end of the hull (the sprite's bands: the gunwale cap, the planks, the teal stripe), lit on the left. */
function endTile(side: -1 | 1): string {
  return ensureBandTile({
    key: 'rowboat-end',
    h: END_H,
    l: END_L,
    side,
    joint: 0,
    bands: [
      [0, PAL_HD.cloth, 4.2],
      [1, PAL_HD.wood, 4.2],
      [2, PAL_HD.wood, 3.4],
      [5, PAL_HD.wood, 2.6],
      [6.4, PAL_HD.teal, 2.6],
    ],
  });
}

/** Register the boat's tiles (once; `withRowboatFaces` does it). */
export function ensureRowboatTiles(): void {
  ensureInsideTile();
  endTile(-1);
  endTile(1);
}

const opts: DrawOpts = { stream: true };

/** The density the boat's faces draw at: the art tier on this renderer, at most 2× (the canopies' cap). */
function faceDensity(r: Renderer): number {
  const want = hiArtOn() ? artTier() : 1;
  return want >= 2 && r.res >= 2 ? 2 : 1;
}

/** The faces of one boat (a canvas per density, made once). */
export class RowboatFaces {
  private readonly canvases = new Map<number, QuadCanvas>();
  private readonly X = new Float64Array(4);
  private readonly Y = new Float64Array(4);
  private readonly Q = new Float64Array(4);
  private readonly A = new Float64Array(4);
  private readonly B = new Float64Array(4);
  private readonly pu = new Float64Array(12);
  private readonly pv = new Float64Array(12);
  private readonly ph = new Float64Array(12);
  private minX = 0;
  private minY = 0;

  /**
   * Draw the top and the end facing the eye for a boat at (x, y) (the entity's x and y: the platform's
   * top), its stern on the left (`flip`: on the right). Before the sprite.
   */
  draw(r: Renderer, floor: SectionFloor, x: number, y: number, flip: boolean): void {
    const d = faceDensity(r);
    const top = floor.store.tile(floor.tileIndex(INSIDE), d);
    if (!top) return;
    const k = flip ? -1 : 1;
    const hTop = G - y - GUNWALE;
    const hWl = WATER_LEVEL;
    const vb = -ROWBOAT_BEAM;
    const eye = r.camX + FLOOR_CX;
    let cv = this.canvases.get(d);
    if (!cv) {
      cv = new QuadCanvas(2 * HALF + 16, 32, d);
      this.canvases.set(d, cv);
    }
    // The corners: 0–3 the top (near stern, far stern, far bow, near bow); 4–7 the stern end, 8–11 the bow end
    // (front top, back top, back bottom, front bottom).
    this.corner(0, x - HALF * k, 0, hTop);
    this.corner(1, x - HALF * k, vb, hTop);
    this.corner(2, x + (HALF - BOW_TAPER) * k, vb, hTop);
    this.corner(3, x + HALF * k, 0, hTop);
    this.corner(4, x - HALF * k, 0, hTop);
    this.corner(5, x - HALF * k, vb, hTop);
    this.corner(6, x - STERN_WL * k, vb, hWl);
    this.corner(7, x - STERN_WL * k, 0, hWl);
    this.corner(8, x + HALF * k, 0, hTop);
    this.corner(9, x + (HALF - BOW_TAPER) * k, vb, hTop);
    this.corner(10, x + (BOW_WL - BOW_TAPER) * k, vb, hWl);
    this.corner(11, x + BOW_WL * k, 0, hWl);
    this.minX = Infinity;
    this.minY = Infinity;
    for (let i = 0; i < 12; i++) this.bound(floor, r, i);
    cv.begin(this.minX - 1, this.minY - 1, r.res);
    // The ends: the one whose outside faces the eye (the stern looks to −k, the bow to +k).
    const stern = (eye - (x - HALF * k)) * k < 0;
    const bow = (eye - (x + HALF * k)) * k > 0;
    const span = hTop - hWl;
    if (stern) this.face(cv, floor, r, 4, endTile(flip ? 1 : -1), span, d);
    if (bow) this.face(cv, floor, r, 8, endTile(flip ? -1 : 1), span, d);
    // The top: a = along from the stern, b = from the far gunwale (0) to the near one (the beam).
    this.load(floor, r, 0);
    const A = this.A;
    const B = this.B;
    A[0] = 0;
    A[1] = 0;
    A[2] = 2 * HALF - BOW_TAPER;
    A[3] = 2 * HALF;
    B[0] = ROWBOAT_BEAM;
    B[1] = 0;
    B[2] = 0;
    B[3] = ROWBOAT_BEAM;
    cv.quad(this.X, this.Y, this.Q, A, B, top, QUAD_EDGES);
    if (cv.drawn) r.frame(cv.frame, cv.ox + r.camX, cv.oy + r.camY, opts);
  }

  private corner(i: number, u: number, v: number, h: number): void {
    this.pu[i] = u;
    this.pv[i] = v;
    this.ph[i] = h;
  }

  /** Screen position of corner i (the floor's camera at the renderer's camera). */
  private sx(floor: SectionFloor, r: Renderer, i: number): number {
    return FLOOR_CX + (this.pu[i] - r.camX - FLOOR_CX) * sOfV(floor.cam, this.pv[i]);
  }

  private sy(floor: SectionFloor, r: Renderer, i: number): number {
    const cam = floor.cam;
    return cam.yh - r.camY + (cam.yw - cam.yh - this.ph[i]) * sOfV(cam, this.pv[i]);
  }

  private bound(floor: SectionFloor, r: Renderer, i: number): void {
    const x = this.sx(floor, r, i);
    const y = this.sy(floor, r, i);
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
  }

  /** Project corners i0 … i0 + 3 into X, Y, Q. */
  private load(floor: SectionFloor, r: Renderer, i0: number): void {
    for (let c = 0; c < 4; c++) {
      const i = i0 + c;
      this.X[c] = this.sx(floor, r, i);
      this.Y[c] = this.sy(floor, r, i);
      this.Q[c] = sOfV(floor.cam, this.pv[i]);
    }
  }

  /** An end (corners i0 …: front top, back top, back bottom, front bottom): a = down from the gunwale, b = back. */
  private face(cv: QuadCanvas, floor: SectionFloor, r: Renderer, i0: number, tile: string, span: number, d: number): void {
    const tex = floor.store.tile(floor.tileIndex(tile), d);
    if (!tex) return;
    this.load(floor, r, i0);
    const A = this.A;
    const B = this.B;
    A[0] = 0;
    A[1] = 0;
    A[2] = span;
    A[3] = span;
    B[0] = 0;
    B[1] = ROWBOAT_BEAM;
    B[2] = ROWBOAT_BEAM;
    B[3] = 0;
    cv.quad(this.X, this.Y, this.Q, A, B, tex, QUAD_EDGES);
  }
}

/**
 * Give a canal boat entity (`ams-boat-platform`) its faces on a perspective floor: RENDER ONLY (its
 * draw first draws the faces, then itself; the simulation never sees it). Without a floor in its
 * world the faces are skipped and the boat draws exactly as before; so it does when its tiles fail
 * to build (fail soft, logged).
 */
export function withRowboatFaces<T extends Entity>(e: T): T {
  try {
    ensureRowboatTiles();
  } catch (err) {
    console.warn('[floor] the canal boat\'s faces failed to build; the boat draws flat:', err);
    return e;
  }
  const faces = new RowboatFaces();
  const own = e.draw.bind(e);
  e.draw = (r: Renderer): void => {
    const floor = worldFloor(e.world);
    if (floor) faces.draw(r, floor, e.x, e.y, e.facing < 0);
    own(r);
  };
  return e;
}
