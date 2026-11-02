/**
 * SUN-STRETCHED CAST SHADOWS of the actors (docs/design/oat.md §8.4 "Actors", decision 37; docs/api/
 * oat.md "LIGHT-WATER"). Owner: LIGHT-WATER. An OPT-IN of a day section's light config
 * (`SectionLight.sunShadows`), drawn by the light pass's ground hook on a floor (after the floor band
 * and the water overlays, before the floor's contact ovals and the entities). The floor's ovals stay
 * the ambient contact under the feet; this adds the cast shadow: a tail from the feet along the sun's
 * floor direction (to the right and a little up the screen, the sun is LEFT and in front), as long
 * as the caster is tall times `along`, tapering from the body's width to a third of it, soft at
 * 2× / 4× and a hard checkered rim at 1×. No tail where the feet stand in shade (`lit`), shorter and
 * fainter in the air (as the ovals).
 *
 * The tails are cached frames per (length, rise, width, density) bucket (made on first use, never
 * per frame); drawing reuses one DrawOpts and the floor's placer (no allocation per frame).
 */
import type { Frame, DrawOpts, Renderer } from '../../../engine/render';
import { PixelBuffer } from '../../../engine/pixel';
import type { World } from '../../../engine/world';
import { SHADOW_MAX_AIR } from '../floor/section-floor';
import { FramePlacer } from '../floor/place';
import type { SunShadowConfig } from './api';

/** The shadow colour (the floor's oval ink). */
const INK = 0x100b14;
/** Default core alpha (about a tone and a half on the oat floors, spec §8.4). */
const STRENGTH = 0.4;
/** Length buckets (px) and the longest tail drawn. */
const LEN_STEP = 4;
const MAX_LEN = 160;

/** The sun tails of one section (made by the light pass). */
export class SunShadows {
  readonly cfg: SunShadowConfig;
  private readonly frames = new Map<number, Frame>();
  private readonly opts: DrawOpts = { alpha: STRENGTH };
  private readonly placer = new FramePlacer();
  /** Tails drawn last frame (tests / debug). */
  drawn = 0;

  constructor(cfg: SunShadowConfig) {
    this.cfg = cfg;
  }

  /** Draw the tails of this frame (world space through `r`'s camera). `d`: the art density at this res. */
  draw(r: Renderer, world: World, d: 1 | 2 | 4): void {
    this.drawn = 0;
    const cfg = this.cfg;
    const strength = cfg.strength ?? STRENGTH;
    if (strength <= 0 || cfg.along <= 0) return;
    const t = world.terrain;
    const list = world.entities;
    const o = this.opts;
    const x0 = r.camX - 8;
    const x1 = r.camX + r.w + 8;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.removed || e.dead) continue;
      if (!(e.tags.has('player') || e.tags.has('enemy') || e.tags.has('npc'))) continue;
      if (e.drawDepth !== 0 || !e.castsShadow) continue;
      if (e.x < x0 - MAX_LEN || e.x > x1) continue;
      const floor = t.surfaceY(e.x, e.y - 2, e.y + SHADOW_MAX_AIR);
      if (!Number.isFinite(floor)) continue;
      const air = floor - e.y;
      if (air < -2 || air > SHADOW_MAX_AIR) continue;
      const lit = cfg.lit ? cfg.lit(e.x, floor) : 1;
      if (lit <= 0.05) continue;
      const k = 1 - (0.5 * Math.max(0, air)) / SHADOW_MAX_AIR;
      const h = e.hitbox.h;
      const len = Math.min(MAX_LEN, Math.round((h * cfg.along) / LEN_STEP) * LEN_STEP);
      if (len < LEN_STEP) continue;
      const rise = Math.max(0, Math.min(len, Math.round(h * cfg.up)));
      const w = Math.max(6, Math.min(32, Math.round(e.hitbox.w * 0.9)));
      o.alpha = strength * k * Math.min(1, lit);
      // In the air the tail starts where the feet's shadow lands: further along the sun.
      const lift = Math.max(0, air) * cfg.along;
      this.placer.x = e.x + lift;
      this.placer.y = floor - Math.max(0, air) * cfg.up;
      this.placer.put(r, this.tail(len, rise, w, d), o);
      this.drawn++;
    }
  }

  /**
   * A tail frame: anchor at the feet (its left end, the floor line); it runs `len` px right and rises
   * `rise` px, `w` px wide at the feet (a thin ellipse in the floor: w · 2 / 5 tall) narrowing to half of it.
   */
  private tail(len: number, rise: number, w: number, d: 1 | 2 | 4): Frame {
    const key = ((len * 256 + rise) * 64 + w) * 8 + d;
    const have = this.frames.get(key);
    if (have) return have;
    const halfFoot = Math.max(2, w / 5);
    const pad = 2;
    const W = (len + pad * 2) * d;
    const Hl = rise + Math.ceil(halfFoot) * 2 + pad * 2;
    const H = Hl * d;
    const b = new PixelBuffer(W, H);
    const oxl = pad;
    const oyl = Hl - pad - Math.ceil(halfFoot);
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        // Logical position from the feet: along (0 … len) and off the centre line.
        const x = (X + 0.5) / d - oxl;
        const y = (Y + 0.5) / d - oyl;
        const tl = len > 0 ? x / len : 1;
        if (tl < -0.08 || tl > 1.02) continue;
        const cy = -rise * Math.max(0, tl);
        const half = halfFoot * (1 - 0.5 * Math.max(0, tl));
        const q = Math.abs(y - cy) / half;
        // The fade: full at the feet, thinning toward the tip; round ends.
        const end = tl < 0 ? 1 - Math.min(1, -tl / 0.08) : tl > 0.85 ? Math.max(0, (1.02 - tl) / 0.17) : 1;
        const along = 1 - 0.4 * Math.max(0, tl);
        let a: number;
        if (d === 1) {
          // 1×: a hard edge, checkered rim (the ovals' rule), no partial alpha.
          if (q >= 1 || end <= 0.3) continue;
          if ((q > 0.6 || tl > 0.7) && ((X + Y) & 1) === 1) continue;
          a = 1;
        } else {
          // 2× / 4×: a soft penumbra (wider toward the tip: the sun's disc).
          const soft = 0.25 + 0.35 * Math.max(0, tl);
          const edge = q <= 1 - soft ? 1 : q >= 1 + soft * 0.5 ? 0 : (1 + soft * 0.5 - q) / (soft * 1.5);
          a = edge * end * along;
          if (a <= 0.02) continue;
        }
        b.data[Y * W + X] = ((INK << 8) | Math.round(255 * Math.min(1, a))) >>> 0;
      }
    }
    b.touch();
    const f: Frame = { buf: b, ox: oxl, oy: oyl, density: d };
    this.frames.set(key, f);
    return f;
  }

  /** Bytes of the cached tails (accounting / tests). */
  get bytes(): number {
    let n = 0;
    for (const f of this.frames.values()) n += f.buf.data.byteLength;
    return n;
  }
}
