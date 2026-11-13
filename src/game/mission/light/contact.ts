/**
 * SUN-STRETCHED CAST SHADOWS of the actors (docs/design/oat.md (deleted; git show eb3316a) §8.4
 * "Actors"). An OPT-IN of a day section's light config
 * (`SectionLight.sunShadows`), drawn by the light pass's ground hook on a floor (after the floor band
 * and the water overlays, before the floor's contact ovals and the entities). The floor's ovals stay
 * the ambient contact under the feet; this adds the cast shadow: a tail from the feet along the sun's
 * floor direction (to the right and a little up the screen, the sun is LEFT and in front), as long
 * as the caster is tall times `along`, tapering from the body's width to a third of it, soft at
 * 2× / 4× and a hard checkered rim at 1×. The tail lies only on the sunlit floor along its length
 * (`lit` sampled along it, the borders found by bisection; a `src` clip): a hero walking into the
 * shade sees the tail shrink, not blink (the smooth review); shorter and fainter in the air (as the ovals).
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
/** Default core alpha (about a tone and a half on a street floor). */
const STRENGTH = 0.4;
/** Length buckets (px) and the longest tail drawn. */
const LEN_STEP = 4;
const MAX_LEN = 160;
/** Samples of `lit` along a tail, and the bisection steps that find a sun / shade border between two. */
const LIT_SAMPLES = 6;
const LIT_BISECT = 5;

/** The sun tails of one section (made by the light pass). */
export class SunShadows {
  readonly cfg: SunShadowConfig;
  private readonly frames = new Map<number, Frame>();
  private readonly opts: DrawOpts = { alpha: STRENGTH };
  private readonly src = { x: 0, y: 0, w: 0, h: 0 };
  private readonly placer = new FramePlacer();
  /** The sunlit part of the current tail, [ta, tb] along it (0 feet … 1 tip), and its light. */
  private ta = 0;
  private tb = 1;
  private lv = 1;
  /** The tail `on` samples: its start x, length and floor line. */
  private sx = 0;
  private slen = 0;
  private sfloor = 0;
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
      const k = 1 - (0.5 * Math.max(0, air)) / SHADOW_MAX_AIR;
      const h = e.hitbox.h;
      const len = Math.min(MAX_LEN, Math.round((h * cfg.along) / LEN_STEP) * LEN_STEP);
      if (len < LEN_STEP) continue;
      // In the air the tail starts where the feet's shadow lands: further along the sun.
      const lift = Math.max(0, air) * cfg.along;
      if (!this.sunlitPart(e.x + lift, len, floor)) continue;
      const rise = Math.max(0, Math.min(len, Math.round(h * cfg.up)));
      const w = Math.max(6, Math.min(32, Math.round(e.hitbox.w * 0.9)));
      o.alpha = strength * k * Math.min(1, this.lv);
      const f = this.tail(len, rise, w, d);
      if (this.ta > 0 || this.tb < 1) {
        // Only the sunlit part (logical px of the frame: the feet at x 2, the tip at 2 + len).
        const src = this.src;
        const fx0 = this.ta > 0 ? f.ox + this.ta * len : 0;
        const fx1 = this.tb < 1 ? f.ox + this.tb * len : f.buf.w / d;
        src.x = fx0;
        src.y = 0;
        src.w = Math.max(0, fx1 - fx0);
        src.h = f.buf.h / d;
        if (src.w <= 0) continue;
        o.src = src;
      } else o.src = undefined;
      this.placer.x = e.x + lift;
      this.placer.y = floor - Math.max(0, air) * cfg.up;
      this.placer.put(r, f, o);
      this.drawn++;
    }
  }

  /**
   * The sunlit part of a tail from x0 over `len` px (`ta`, `tb`, `lv`): from the feet to the first
   * shade when the feet stand in sun; from the first sun to the next shade when they stand in shade.
   * False: no sun on it.
   */
  private sunlitPart(x0: number, len: number, floor: number): boolean {
    const lit = this.cfg.lit;
    this.ta = 0;
    this.tb = 1;
    this.lv = 1;
    if (!lit) return true;
    this.sx = x0;
    this.slen = len;
    this.sfloor = floor;
    let prev = 0;
    let state = this.on(0);
    let found = state;
    if (state) this.lv = lit(x0, floor);
    for (let i = 1; i <= LIT_SAMPLES; i++) {
      const t = i / LIT_SAMPLES;
      const now = this.on(t);
      if (now !== state) {
        // The border lies in (prev, t]: bisect it.
        let a = prev;
        let b = t;
        for (let j = 0; j < LIT_BISECT; j++) {
          const m = (a + b) * 0.5;
          if (this.on(m) === state) a = m;
          else b = m;
        }
        if (!state) {
          // Shade → sun: the lit part starts here (the first one only).
          if (!found) {
            this.ta = b;
            this.lv = lit(x0 + len * b, floor);
            found = true;
          }
        } else {
          // Sun → shade: the lit part ends here.
          this.tb = a;
          return found;
        }
        state = now;
      }
      prev = t;
    }
    return found;
  }

  /** Is the floor sunlit at fraction t along the tail `sunlitPart` looks at (no closure: no allocation)? */
  private on(t: number): boolean {
    const lit = this.cfg.lit;
    return !lit || lit(this.sx + this.slen * t, this.sfloor) > 0.05;
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
