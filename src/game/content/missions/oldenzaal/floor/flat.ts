/**
 * The Oldenzaal floor kit's hooks for the town's entities (docs/design/floor.md §3.7; docs/api/
 * floor.md §8): RENDER ONLY, and only in a section that has a floor (every call answers "no
 * floor" otherwise, so the entities draw exactly as before).
 *
 * - `ozFacadeDepth(world)`: the depth the floor draws the shop fronts at (0 without a floor): the
 *   boarded doors and windows sit in the fronts (`drawDepth`).
 * - `FxDepths`, `dustAt`: the short-lived fx of a burst (the planks, the dust) drawn at the front's
 *   depth (spec §3.7: fx can neither hit nor be hit, so they may stand at a depth). The fx are
 *   spawned at their walk-plane spots exactly as without a floor — the sims never see the floor —
 *   and only their `drawDepth` (render only) puts them on the drawn opening. The dead themselves
 *   are drawn in the walk plane from the first tick they can be hit (art and hitbox together).
 * - `FlatCover`: draws a round thing flat on the floor in perspective at v = 0 (the manhole's
 *   lifted cover, its open shaft, the cover pushed aside), from the kit's tiles through a small
 *   quad canvas per density (made once; nothing is allocated per frame).
 */
import type { Entity } from '../../../../../engine/entity';
import { FLOOR_CX, FLOOR_YW, sOfV } from '../../../../../engine/floor/cam';
import { QuadCanvas } from '../../../../../engine/floor/quad';
import type { DrawOpts, Renderer } from '../../../../../engine/render';
import { artTier, hasSprite, hiArtOn } from '../../../../../engine/sprites';
import type { World } from '../../../../../engine/world';
import { FX_DUST, FxEntity, type FxOpts } from '../../../../fx';
import { decorDepthOf, worldFloor } from '../../../../mission/floor/hooks';
import type { SectionFloor } from '../../../../mission/floor/section-floor';
import type { OzLight } from './kit';

const SHOP = { sprite: 'decor/oz/shop', x: 0, y: FLOOR_YW };

/** The facade depth of the world's floor (the shop decor's depth), 0 without a floor. */
export function ozFacadeDepth(world: World): number {
  const floor = worldFloor(world);
  if (!floor) return 0;
  const d = decorDepthOf(floor, SHOP, -1);
  return d === null ? 0 : d;
}

/** The light mood of a floor's town painter ('dusk' when it names none). */
export function ozFloorLight(floor: SectionFloor): OzLight {
  const v = floor.def.painter.params?.light;
  return v === 'late' || v === 'night' ? v : 'dusk';
}

/** The density the floor's passes draw at for this renderer (the view's rule: the art tier, 4 needs 4 | res). */
export function floorDrawDensity(r: Renderer): number {
  const want = hiArtOn() ? artTier() : 1;
  if (want >= 4 && r.res >= 4 && r.res % 4 === 0) return 4;
  return want >= 2 && r.res >= 2 ? 2 : 1;
}

const opts: DrawOpts = { stream: true };

/** A round (or square) thing drawn flat on the floor around (x, 0), one quad canvas per density. */
export class FlatCover {
  private readonly canvases = new Map<number, QuadCanvas>();
  private readonly X = new Float64Array(4);
  private readonly Y = new Float64Array(4);
  private readonly Q = new Float64Array(4);
  private readonly A = new Float64Array(4);
  private readonly B = new Float64Array(4);
  /** Half size along u and v (world px). */
  private readonly r: number;

  constructor(r: number) {
    this.r = r;
  }

  /**
   * Draw tile `tile` (its square of 2r world px) flat at u = cx, v = cv ± r, `lift` px over the
   * floor, masked to the inscribed ellipse when `round`. Returns whether anything was drawn.
   */
  draw(r: Renderer, floor: SectionFloor, cx: number, cv: number, lift: number, tile: string, round = true): boolean {
    const cam = floor.cam;
    const d = floorDrawDensity(r);
    const tex = floor.store.tile(floor.tileIndex(tile), d);
    if (!tex) return false;
    const rr = this.r;
    const k1 = cam.yw - cam.yh;
    const camX = r.camX;
    const camY = r.camY;
    const X = this.X;
    const Y = this.Y;
    let minX = Infinity;
    let minY = Infinity;
    for (let c = 0; c < 4; c++) {
      const u = c === 0 || c === 3 ? cx - rr : cx + rr;
      const v = c < 2 ? cv - rr : cv + rr;
      const s = sOfV(cam, v);
      const h = floor.heightAt(u, v);
      X[c] = FLOOR_CX + (u - camX - FLOOR_CX) * s;
      Y[c] = cam.yh - camY + (k1 - (Number.isFinite(h) ? h : 0) - lift) * s;
      this.Q[c] = s;
      this.A[c] = u - cx + rr;
      this.B[c] = v - cv + rr;
      if (X[c] < minX) minX = X[c];
      if (Y[c] < minY) minY = Y[c];
    }
    let cv2 = this.canvases.get(d);
    if (!cv2) {
      cv2 = new QuadCanvas(rr * 3 + 8, rr * 2 + 8, d);
      this.canvases.set(d, cv2);
    }
    // The canvas on the backbuffer's grid, drawn in world space: it moves with the floor in backbuffer px.
    cv2.begin(minX, minY, r.res);
    cv2.ellipse(round ? 2 * rr : 0, round ? 2 * rr : 0);
    cv2.quad(X, Y, this.Q, this.A, this.B, tex);
    if (cv2.drawn) r.frame(cv2.frame, cv2.ox + camX, cv2.oy + camY, opts);
    return cv2.drawn;
  }
}

const puffOpts: FxOpts = { sprite: 'fx/dust', x: 0, y: 0 };

/**
 * fx.ts `dust` — the same spawns in the same order (the puff, then the particles), so the sims
 * cannot tell the two apart — that returns its puff (null without the `fx/dust` art): the caller
 * can give it a render-only depth (`FxDepths`). The particles stay in the walk plane.
 */
export function dustAt(world: World, x: number, y: number, count: number): FxEntity | null {
  let puff: FxEntity | null = null;
  if (hasSprite('fx/dust')) {
    puffOpts.x = x;
    puffOpts.y = y - 3;
    puff = FxEntity.spawn(world, puffOpts);
  }
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    world.particles.emit(FX_DUST, x + side * (1 + (i >> 1) * 2), y - 1, side * (0.4 + i * 0.15), -0.3);
  }
  return puff;
}

/** Slots of an `FxDepths` (a burst's planks and the puffs of a tell: a handful at once). */
const FX_SLOTS = 12;

/**
 * Render-only depths for the short-lived fx of a thing at a depth (spec §3.7: an fx can neither hit
 * nor be hit): the planks and dust of a burst door start on the drawn opening in the shop front.
 * The fx are spawned at their walk-plane spots exactly as without a floor; this only sets their
 * `drawDepth` (never read by the simulation). A depth holds for `hold` ticks, then eases linearly
 * to the walk plane over `ease` ticks (a plank thrown out of the door toward the street).
 *
 * The fx entities are pooled (game/pool.ts recycles them without touching `drawDepth`), so every
 * depth set here goes back to 0 before its entity can draw for anyone else: when its ease ends, when
 * it has left the world or was recycled (its age went back), when the slots are full (the oldest),
 * and in `clear()`. The owner calls `tick()` once per update (before any frame is drawn) and `clear()`
 * in its `onRemove`. Fixed slots: nothing is allocated per tick.
 */
export class FxDepths {
  private readonly fx: (Entity | null)[] = new Array<Entity | null>(FX_SLOTS).fill(null);
  private readonly depth = new Float64Array(FX_SLOTS);
  private readonly hold = new Int32Array(FX_SLOTS);
  private readonly ease = new Int32Array(FX_SLOTS);
  private readonly t = new Int32Array(FX_SLOTS);
  private readonly age = new Int32Array(FX_SLOTS);

  /** Draw `e` at `depth` (render only) for `hold` ticks, then ease it to the walk plane over `ease` ticks. */
  add(e: Entity | null, depth: number, hold: number, ease: number): void {
    if (!e || depth === 0) return;
    let k = this.fx.indexOf(null);
    if (k < 0) {
      // Full: the oldest gives up its depth.
      k = 0;
      for (let i = 1; i < FX_SLOTS; i++) if (this.t[i] > this.t[k]) k = i;
      this.drop(k);
    }
    this.fx[k] = e;
    this.depth[k] = depth;
    this.hold[k] = Math.max(0, hold);
    this.ease[k] = Math.max(1, ease);
    this.t[k] = 0;
    this.age[k] = e.age;
    e.drawDepth = depth;
  }

  /** One tick: ease the depths; give back every depth whose fx is gone, recycled or done. */
  tick(): void {
    for (let i = 0; i < FX_SLOTS; i++) {
      const e = this.fx[i];
      if (!e) continue;
      if (e.removed || e.age < this.age[i]) {
        this.drop(i);
        continue;
      }
      this.age[i] = e.age;
      const t = ++this.t[i];
      if (t <= this.hold[i]) continue;
      const k = 1 - (t - this.hold[i]) / this.ease[i];
      if (k <= 0) this.drop(i);
      else e.drawDepth = this.depth[i] * k;
    }
  }

  /** Give back every depth (the owner leaves the world). */
  clear(): void {
    for (let i = 0; i < FX_SLOTS; i++) if (this.fx[i]) this.drop(i);
  }

  private drop(i: number): void {
    const e = this.fx[i];
    if (e) e.drawDepth = 0;
    this.fx[i] = null;
  }
}
