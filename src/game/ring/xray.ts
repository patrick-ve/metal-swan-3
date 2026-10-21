/**
 * The x-ray of a covered wagon (readability; integrator, wave B): a vehicle in a nearer lane (a
 * civilian camper, a van, the convoy, the road-works truck, the lorry, the other wagon) can hide a
 * player's wagon completely. While more than `XRAY.cover` of a driven wagon's body is behind
 * nearer vehicles, a thin outline of the wagon (with its driver and its hero in the window) is
 * drawn OVER the cover, in the player's colour, like the x-ray of a belt scroller. Only where the
 * cover is (the visible part keeps its plain look); never for enemies.
 *
 * How: the wagon draws itself once more into a small private software renderer at the art density
 * (at most `XRAY.maxDensity` 2×; transparent clear); the outline is every transparent px next to an
 * opaque one (½ logical px at 2×, 1 px at 1×), masked to the covered rows of each column; it goes
 * on screen as a streamed frame. Cosmetic only (draw time): no game state, no rng. Buffers are reused (no per-frame
 * allocation once the density is known).
 *
 * ```ts
 * const xray = new RingXray();
 * xray.draw(r, world.entities, artDensity);   // after the entities and the light
 * ```
 */
import type { Color } from '../../engine/color';
import type { Entity } from '../../engine/entity';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../engine/render';
import { SoftRenderer } from '../../engine/render-soft';
import { PAL } from '../../engine/palette';
import { WAGON_H, WAGON_W, type Wagon } from './wagon';

export const XRAY = Object.freeze({
  /** Share of the wagon's body that must be covered before the outline shows. */
  cover: 0.4,
  /** The private canvas around the wagon (logical px): x from the centre, y from the feet. */
  w: 128,
  up: 76,
  down: 8,
  /** Alpha (0 … 255) of the faint fill of the hidden body and of the dark ring outside the line. */
  fillAlpha: 0x50,
  ringAlpha: 0xd8,
  /** The outline's art density at most (cost: the private canvas and the streamed frame). */
  maxDensity: 2,
});

/** The dark ring's colour (the palette's ink). */
const INK_RING: Color = PAL.ink[0];

/** Tags of the things that count as cover: vehicles in a nearer lane. */
const COVER_TAGS: readonly string[] = ['ring-car', 'ring-block', 'ring-big', 'ring-wagon', 'boss'];
const streamOpts: DrawOpts = { stream: true };
/**
 * The outline's colour per slot: the HUD's player hues (app.ts `PLAYER_COLORS`: P1 sky, P2 gold),
 * one tone deeper so the line reads on the white and pale vehicles too.
 */
const COLORS: readonly Color[] = [PAL.sky[1], PAL.gold[2]];

function isCover(e: Entity): boolean {
  for (let i = 0; i < COVER_TAGS.length; i++) if (e.hasTag(COVER_TAGS[i])) return true;
  return false;
}

/** The draw key of the ring's depth sort (runner.ts: `y · 100 + z`). */
function keyOf(e: Entity): number {
  return e.y * 100 + e.z;
}

export class RingXray {
  private density = 0;
  private soft: SoftRenderer | null = null;
  private out: PixelBuffer | null = null;
  private frame: Frame | null = null;
  /** Covered from this logical y down, per logical column of the private canvas (Infinity: open). */
  private readonly coverTop = new Float64Array(XRAY.w);
  /** Wagons that showed an outline in the last `draw` (tests, the debug overlay). */
  shown = 0;

  /** Share of `w`'s body covered by nearer vehicles (0 … 1); fills `coverTop` for its canvas. */
  coverOf(w: Wagon, list: readonly Entity[]): number {
    const top = this.coverTop;
    top.fill(Infinity);
    const cx = Math.round(w.x);
    const x0 = cx - (XRAY.w >> 1);
    const key = keyOf(w);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === w || e.removed || !e.alive || keyOf(e) <= key || !isCover(e)) continue;
      const lift = (e as Entity & { lift?: number }).lift ?? 0;
      const ex0 = e.x + e.hitbox.x;
      const ex1 = ex0 + e.hitbox.w;
      const ey0 = e.y - lift + e.hitbox.y;
      // A nearer thing stands lower on screen: it covers from its top down to the wagon's feet.
      if (ex1 <= x0 || ex0 >= x0 + XRAY.w || ey0 >= w.y) continue;
      const c0 = Math.max(0, Math.floor(ex0 - x0));
      const c1 = Math.min(XRAY.w, Math.ceil(ex1 - x0));
      for (let c = c0; c < c1; c++) if (ey0 < top[c]) top[c] = ey0;
    }
    // The body: WAGON_W × WAGON_H above the feet.
    const b0 = Math.round(w.x - WAGON_W / 2) - x0;
    const yTop = w.y - WAGON_H;
    let covered = 0;
    for (let c = b0; c < b0 + WAGON_W; c++) {
      if (c < 0 || c >= XRAY.w) continue;
      const t = top[c];
      if (t < w.y) covered += w.y - Math.max(yTop, t);
    }
    return covered / (WAGON_W * WAGON_H);
  }

  /** Draw the outline of every covered player wagon in `list` (the world's entities). */
  draw(r: Renderer, list: readonly Entity[], density: number): void {
    this.shown = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.hasTag('ring-wagon') || e.removed) continue;
      const w = e as Wagon;
      if (w.state !== 'driven' || w.scripted || w.arriving || !w.hero) continue;
      if (this.coverOf(w, list) <= XRAY.cover) continue;
      // Never finer than the screen (below res d the renderers would thin the line away), and at
      // most 2× (review B: 1.3 ms per covered wagon per frame at 4×; the ½-px line is the same
      // width at 2×, a little coarser on the diagonals; the 4× buffer was 172k px per wagon).
      this.outline(r, w, Math.max(1, Math.min(density, r.res, XRAY.maxDensity)));
      this.shown++;
    }
  }

  private ensure(density: number): void {
    if (this.density === density && this.soft) return;
    this.density = density;
    const h = XRAY.up + XRAY.down;
    this.soft = new SoftRenderer(XRAY.w, h, undefined, { res: density });
    this.out = new PixelBuffer(XRAY.w * density, h * density);
    this.frame = { buf: this.out, ox: 0, oy: 0, density };
  }

  /** An opaque px of `src` at a distance `from` … `to` along a row or a column from (x, y). */
  private reach(src: Uint32Array, x: number, y: number, W: number, H: number, to: number, from: number): boolean {
    for (let k = from; k <= to; k++) {
      if (x >= k && (src[y * W + x - k] & 255) >= 128) return true;
      if (x + k < W && (src[y * W + x + k] & 255) >= 128) return true;
      if (y >= k && (src[(y - k) * W + x] & 255) >= 128) return true;
      if (y + k < H && (src[(y + k) * W + x] & 255) >= 128) return true;
    }
    return false;
  }

  private outline(r: Renderer, w: Wagon, density: number): void {
    this.ensure(density);
    const soft = this.soft!;
    const out = this.out!;
    const d = density;
    const x0 = Math.round(w.x) - (XRAY.w >> 1);
    const y0 = Math.round(w.y) - XRAY.up;
    soft.begin(0);
    soft.setCamera(x0, y0);
    try {
      w.draw(soft);
    } catch {
      return;
    }
    soft.end();
    const src = soft.target.data;
    const dst = out.data;
    const W = out.w;
    const H = out.h;
    const t = Math.max(1, d >> 1);
    const col = COLORS[w.slot] ?? COLORS[0];
    // A faint fill of the hidden body, the line in the player's colour, a dark ring outside it
    // (it reads on a white van and on a dark lorry alike).
    const fill = ((col & 0xffffff00) | XRAY.fillAlpha) >>> 0;
    const ring = ((INK_RING & 0xffffff00) | XRAY.ringAlpha) >>> 0;
    const top = this.coverTop;
    dst.fill(0);
    // Rows above the highest cover edge hold no outline: start below it.
    let minTop = Infinity;
    for (let c = 0; c < top.length; c++) if (top[c] < minTop) minTop = top[c];
    const yStart = Math.max(0, Math.min(H, Math.floor((minTop - 1 - y0) * d)));
    for (let y = yStart; y < H; y++) {
      const ly = y0 + y / d;
      for (let x = 0; x < W; x++) {
        // Only over the cover (with a logical px of slack at its top edge).
        if (ly < top[(x / d) | 0] - 1) continue;
        const i = y * W + x;
        if ((src[i] & 255) >= 128) {
          dst[i] = fill;
          continue;
        }
        const near = this.reach(src, x, y, W, H, t, 1);
        if (near) dst[i] = col;
        else if (this.reach(src, x, y, W, H, 2 * t, t + 1)) dst[i] = ring;
      }
    }
    out.touch();
    r.frame(this.frame!, x0, y0, streamOpts);
  }
}
