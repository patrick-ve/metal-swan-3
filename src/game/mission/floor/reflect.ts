/**
 * DYNAMIC REFLECTIONS on the water of a floor (docs/design/oat.md (deleted; git show eb3316a) §8.8 "Dynamic reflections",
 * decision 54; docs/api/oat.md (deleted; git show eb3316a) "LIGHT-WATER"). Owner: LIGHT-WATER. An ADDITIVE OPT-IN: a section's
 * light config names its water bands (`SectionLight.water`), and the light pass draws this overlay
 * in its ground hook (`MissionLight.drawGround`: after the floor band, before the contact shadows and
 * the entities). The GL floor shader stays texture-only: the overlay uses only the `Renderer` API, so
 * the GL and CPU floor paths, the node `shot` tool and the tests all see the same pixels.
 *
 * What reflects: at most `max` (6) live entities with the tag `REFLECT_TAG` that implement
 * `reflectOf(out, tick)` (the Swan, boats, the taxi on a quay, figures at the edge): the entity fills
 * a reused `ReflectSpot` with the sprite and frame it draws now, its x and its water line. The
 * sprite is drawn flipped about the water line, sliced in rows of `SLICE` px, each row shifted by
 * a fixed, world-anchored ripple table (more the deeper the reflection) and fading from `alpha[0]`
 * at the line to `alpha[1]` at its far end; rows outside the band's water (its screen rows, and in
 * x the band's u range through the floor's row scale s(y)) are not drawn. The static reflections
 * (the far bank, bridges, moored boats, the night lights) are baked in the water tiles
 * (the floor's water tiles); the night streaks are the light pass's.
 *
 * Cosmetic only, deterministic (the ripple is a function of world y and the tick), no allocation per
 * frame (one reused spot, one src rect, one DrawOpts).
 */
import type { Entity } from '../../../engine/entity';
import { FLOOR_CX, sOfY } from '../../../engine/floor/cam';
import type { DrawOpts, Renderer, SrcRect } from '../../../engine/render';
import { VIEW_H } from '../../../engine/render';
import { getFrame } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import type { SectionFloor } from './section-floor';

/** The tag of an entity that mirrors in the water (it also implements `Reflector`). */
export const REFLECT_TAG = 'reflects';
/** At most this many reflections per frame (spec §8.8: 6). */
export const REFLECT_MAX = 6;
/** Row slice height, logical px. */
const SLICE = 2;
/** The ripple table: one period of smooth per-row offsets (−1 … 1), indexed by world row and time. */
const RIPPLE_N = 64;
const RIPPLE = new Float32Array(RIPPLE_N);
for (let i = 0; i < RIPPLE_N; i++) {
  const a = (i / RIPPLE_N) * Math.PI * 2;
  RIPPLE[i] = Math.sin(a) * 0.65 + Math.sin(a * 3 + 1.1) * 0.35;
}

/** One reflection as the entity gives it (reused: fill every field). */
export interface ReflectSpot {
  /** The sprite id and frame index the entity draws now. */
  sprite: string;
  frame: number;
  /** World x of the sprite's anchor and the water line it stands on or floats in (world y). */
  x: number;
  y: number;
  flipX: boolean;
}

/** An entity that mirrors (tag `REFLECT_TAG`). */
export interface Reflector {
  /** Fill `out` with this frame's reflection; false = none now (out of the water, hidden). */
  reflectOf(out: ReflectSpot, tick: number): boolean;
}

/** Does `e` reflect (the tag and the method)? */
export function isReflector(e: Entity): e is Entity & Reflector {
  return e.hasTag(REFLECT_TAG) && typeof (e as Partial<Reflector>).reflectOf === 'function';
}

/**
 * A band of water (flat-ground screen rows on a floor; world x along it at the walk line's scale):
 * the canal in front of the d quay (y 193–216), a cut under a bridge, the whole c1 canal.
 */
export interface WaterBand {
  /** World x range of the water. */
  u0: number;
  u1: number;
  /** Screen rows of the water (the coping's edge … the view's bottom). */
  y0: number;
  y1: number;
  /** The default mirror line (screen y) for a spot whose water line lies above the band (default y0). */
  level?: number;
}

/** A section's reflections (`SectionLight.water`). */
export interface ReflectConfig {
  bands: readonly WaterBand[];
  /** Alpha at the water line and at the reflection's far end (spec: 0.35–0.5; default [0.5, 0.35]). */
  alpha?: readonly [number, number];
  /** Ripple amplitude, logical px at the far end (default 2.5; the calm 03:00 water 1). */
  ripple?: number;
  /** Ripple drift, table rows per tick (default 0.12). */
  speed?: number;
  /** At most this many reflections (default REFLECT_MAX). */
  max?: number;
}

/** The dynamic reflections of one section (made by the light pass). */
export class WaterReflections {
  readonly cfg: ReflectConfig;
  private readonly spot: ReflectSpot = { sprite: '', frame: 0, x: 0, y: 0, flipX: false };
  private readonly src: SrcRect = { x: 0, y: 0, w: 0, h: SLICE };
  private readonly opts: DrawOpts = { flipY: true, flipX: false, alpha: 0.5, src: this.src };
  /** Slices drawn last frame (tests / debug). */
  slices = 0;
  /** Reflections drawn last frame (tests / debug). */
  drawn = 0;

  constructor(cfg: ReflectConfig) {
    this.cfg = cfg;
  }

  /** The band at world x (null: no water there). */
  bandAt(x: number): WaterBand | null {
    const bands = this.cfg.bands;
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      if (x >= b.u0 && x < b.u1) return b;
    }
    return null;
  }

  /**
   * Draw every reflection of this frame (world space through `r`'s camera). `floor`: the section's
   * floor (its row scale clips the bands in x; null: a flat walk plane, s = 1).
   */
  draw(r: Renderer, world: World, tick: number, floor: SectionFloor | null): void {
    this.slices = 0;
    this.drawn = 0;
    const list = world.byTag(REFLECT_TAG);
    if (list.length === 0) return;
    const cfg = this.cfg;
    const max = cfg.max ?? REFLECT_MAX;
    const a0 = cfg.alpha?.[0] ?? 0.5;
    const a1 = cfg.alpha?.[1] ?? 0.35;
    const amp = cfg.ripple ?? 2.5;
    const speed = cfg.speed ?? 0.12;
    const camX = r.camX;
    const camY = r.camY;
    const spot = this.spot;
    const src = this.src;
    const o = this.opts;
    for (let i = 0; i < list.length && this.drawn < max; i++) {
      const e = list[i];
      if (e.removed || !isReflector(e)) continue;
      if (!e.reflectOf(spot, tick)) continue;
      const band = this.bandAt(spot.x);
      if (!band) continue;
      const f = getFrame(spot.sprite, spot.frame, 1);
      const fw = f.density === undefined || f.density === 1 ? f.buf.w : f.buf.w / f.density;
      const fh = f.density === undefined || f.density === 1 ? f.buf.h : f.buf.h / f.density;
      if (spot.x + fw < camX - 8 || spot.x - fw > camX + r.w + 8) continue;
      // The mirror line: the spot's water line, or the band's level when it stands above the water.
      const m = Math.max(spot.y, band.level ?? band.y0);
      const oy = f.oy;
      o.flipX = spot.flipX;
      src.w = fw;
      let any = false;
      // Rows above the anchor only (k < oy + 1), slice by slice from the line down the water.
      for (let k = oy + 1 - SLICE; k > -SLICE; k -= SLICE) {
        const top = m + oy + 1 - k - SLICE; // screen-world rows [top, top + SLICE)
        const sy = top - camY;
        if (sy + SLICE <= band.y0 || sy >= band.y1 || sy >= VIEW_H) continue;
        const t = Math.min(1, (oy + 1 - k) / Math.max(1, fh));
        // Clip in x to the band through the row's scale (the water quad's edge at this row).
        const s = floor ? sOfY(floor.cam, Math.max(floor.cam.yh + 1, sy + 1)) : 1;
        const sx = spot.x - camX; // the reflection stays under its sprite (a mirror is vertical on screen)
        const xb0 = FLOOR_CX + (band.u0 - camX - FLOOR_CX) * s;
        const xb1 = FLOOR_CX + (band.u1 - camX - FLOOR_CX) * s;
        if (sx < xb0 || sx >= xb1) continue;
        // The ripple table read between its entries (a slow `speed` would otherwise hold a slice
        // still for 8–9 ticks and then jump: a 7 fps ripple).
        const f = top * 0.5 + tick * speed;
        const fi = Math.floor(f);
        const idx = ((fi % RIPPLE_N) + RIPPLE_N) % RIPPLE_N;
        const r0 = RIPPLE[idx];
        const rip = r0 + (RIPPLE[(idx + 1) % RIPPLE_N] - r0) * (f - fi);
        const off = rip * amp * (0.25 + 0.75 * t);
        src.y = k < 0 ? 0 : k;
        src.h = k < 0 ? SLICE + k : SLICE;
        o.alpha = a0 + (a1 - a0) * t;
        r.sprite(spot.sprite, spot.frame, spot.x + off, m, o);
        this.slices++;
        any = true;
      }
      if (any) this.drawn++;
    }
  }
}
