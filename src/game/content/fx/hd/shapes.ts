/**
 * Shapes in a LOCAL frame for the HD flashes and shots: a shape is drawn pointing right (u along
 * the shot, v across it, + = down) and placed by a transform that reproduces exactly where the
 * 1× art put its turned copy (`Xf`): a quarter turn (the 1× `rotated(-π/2)` pixel map), a 45° or a
 * 22.5°-step turn about the frame centre (the 1× `rotated(a)` map), or none. The light stays the
 * world's key light (upper left), so a turned rocket is lit from the top like a straight one —
 * the HD art is drawn per direction, never a turned bitmap.
 *
 * Glow primitives (`Glow`) write a flat emissive material whose tone is the heat (0..1): a cone
 * (tapered capsule), a blob (ellipse), a spike, a dot, an arc, plus lit smoke puffs.
 */
import type { TexSample } from '../../../art/hd/index';
import { billow, frayCut, sat, type HdCanvas } from './kit';

/** Local (u, v) → world (logical px of the frame) and back. */
export class Xf {
  private readonly cx: number;
  private readonly cy: number;
  readonly a: number;
  private readonly ox: number;
  private readonly oy: number;
  private readonly quarter: number;

  /** World = c + R(a) · (local + o) for the general case; see the factories. */
  private constructor(cx: number, cy: number, a: number, ox: number, oy: number, quarter: number) {
    this.cx = cx;
    this.cy = cy;
    this.a = a;
    this.ox = ox;
    this.oy = oy;
    this.quarter = quarter;
  }

  /** No turn: local (u, v) = world − (bx, by). */
  static at(bx: number, by: number): Xf {
    return new Xf(bx, by, 0, 0, 0, 0);
  }

  /**
   * The 1× `rotated(a)` map of a w × h source whose local origin is source point (bx, by), into a
   * frame of size W × H (centre on centre; the 1× art pads symmetrically).
   */
  static turn(a: number, w: number, h: number, bx: number, by: number, W: number, H: number): Xf {
    return new Xf(W / 2, H / 2, a, bx - w / 2, by - h / 2, 0);
  }

  /** The 1× quarter turn counter-clockwise (`rotated(-π/2)`) of a source of width w: (x, y) → (y, w − x). */
  static up(w: number, bx: number, by: number): Xf {
    return new Xf(w, 0, -Math.PI / 2, bx, by, 1);
  }

  /** World point of local (u, v). */
  pt(u: number, v: number): [number, number] {
    if (this.quarter === 1) {
      // Source (bx + u, by + v) → (y, w − x).
      return [this.oy + v, this.cx - (this.ox + u)];
    }
    const x = u + this.ox;
    const y = v + this.oy;
    const c = Math.cos(this.a);
    const s = Math.sin(this.a);
    return [this.cx + x * c - y * s, this.cy + x * s + y * c];
  }

  /** Local (u, v) of world (x, y). */
  inv(x: number, y: number): [number, number] {
    if (this.quarter === 1) return [this.cx - y - this.ox, x - this.oy];
    const dx = x - this.cx;
    const dy = y - this.cy;
    const c = Math.cos(this.a);
    const s = Math.sin(this.a);
    return [dx * c + dy * s - this.ox, -dx * s + dy * c - this.oy];
  }
}

/** A glow primitive in local coordinates; h = heat 0..1 (tone of the flat material). */
export type Glow =
  /** Tapered capsule along u from u0 to u1 (radii w0 → w1), heat h0 → h1, cooler across by `edge`. */
  | { k: 'cone'; u0: number; u1: number; v?: number; w0: number; w1: number; h0: number; h1: number; edge?: number }
  /** Ellipse at (u, v), radii ru × rv, heat h at the centre, `fall` cooler at the rim; lit from the upper left by `lit`. */
  | { k: 'blob'; u: number; v: number; ru: number; rv?: number; h: number; fall?: number; lit?: number }
  /** A tapered stroke from (u0, v0) to (u1, v1). */
  | { k: 'spike'; u0: number; v0: number; u1: number; v1: number; r0: number; r1: number; h0: number; h1: number }
  /** An arc of radius R about (u, v) from angle a0 to a1 (radians, 0 = +u), width r, heat h (leading edge hotter by `lead`). */
  | { k: 'arc'; u: number; v: number; R: number; a0: number; a1: number; r: number; h: number; lead?: number; rv?: number }
  /** A lit smoke puff (gas material) of radius r, fraying with `fade`. */
  | { k: 'smoke'; u: number; v: number; r: number; fade?: number; seed?: number; tone?: number };

export interface GlowMats {
  /** Flat emissive material. */
  glow: number;
  /** Lit gas material (for 'smoke'). */
  gas?: number;
  /** One part for every glow primitive (no separations between them). */
  part: number;
  /** Cut everything behind this local u (the muzzle: round caps must not poke out behind it). */
  uMin?: number;
}

/** Heat → tone texture (cut where the heat is gone). */
function setHeat(s: TexSample, h: number): void {
  if (!(h > 0.001)) {
    s.cut = true;
    return;
  }
  s.tone = (h >= 1 ? 0.999 : h) - 0.5;
}

/** Draw glow primitives through the transform `xf`. Later primitives win where they overlap (z). */
export function drawGlows(c: HdCanvas, xf: Xf, glows: readonly Glow[], m: GlowMats): void {
  const uMin = m.uMin;
  const behind = uMin === undefined ? null : (s: TexSample): boolean => xf.inv(s.x, s.y)[0] < uMin;
  glows.forEach((g, i) => {
    const z = i * 0.01;
    switch (g.k) {
      case 'cone': {
        const v = g.v ?? 0;
        const [x0, y0] = xf.pt(g.u0, v);
        const [x1, y1] = xf.pt(g.u1, v);
        const edge = g.edge ?? 0.3;
        c.capsule(x0, y0, x1, y1, g.w0, g.w1, {
          mat: m.glow,
          part: m.part,
          z,
          tex: (s) => {
            if (behind?.(s)) s.cut = true;
            else setHeat(s, g.h0 + (g.h1 - g.h0) * s.u - edge * s.v * s.v);
          },
        });
        break;
      }
      case 'blob': {
        const [x, y] = xf.pt(g.u, g.v);
        const rv = g.rv ?? g.ru;
        const fall = g.fall ?? 0.35;
        const lit = g.lit ?? 0;
        // An ellipse turned with the frame: test it in local coordinates on a plane.
        const R = Math.max(g.ru, rv) + 0.5;
        // Blobs (cores, blooms) sit in front of the strokes (capsules carry a relief of their radius).
        c.plane(x - R, y - R, R * 2, R * 2, {
          mat: m.glow,
          part: m.part,
          z: z + 2,
          tex: (s) => {
            const [u, vv] = xf.inv(s.x, s.y);
            const du = (u - g.u) / g.ru;
            const dv = (vv - g.v) / rv;
            const q2 = du * du + dv * dv;
            if (q2 > 1 || (uMin !== undefined && u < uMin)) {
              s.cut = true;
              return;
            }
            // World-space light bias (upper left), independent of the turn.
            const wx = (s.x - x) / R;
            const wy = (s.y - y) / R;
            setHeat(s, g.h - fall * q2 - lit * (wx + wy) * 0.5);
          },
        });
        break;
      }
      case 'spike': {
        const [x0, y0] = xf.pt(g.u0, g.v0);
        const [x1, y1] = xf.pt(g.u1, g.v1);
        c.capsule(x0, y0, x1, y1, g.r0, g.r1, {
          mat: m.glow,
          part: m.part,
          z,
          tex: (s) => {
            if (behind?.(s)) s.cut = true;
            else setHeat(s, g.h0 + (g.h1 - g.h0) * s.u - 0.2 * s.v * s.v);
          },
        });
        break;
      }
      case 'arc': {
        const pts: Array<[number, number]> = [];
        const n = Math.max(4, Math.ceil((Math.abs(g.a1 - g.a0) * g.R) / 0.7));
        const rv = g.rv ?? g.R;
        for (let k = 0; k <= n; k++) {
          const a = g.a0 + ((g.a1 - g.a0) * k) / n;
          pts.push(xf.pt(g.u + Math.cos(a) * g.R, g.v + Math.sin(a) * rv));
        }
        const lead = g.lead ?? 0;
        c.stroke(pts, g.r, g.r, {
          mat: m.glow,
          part: m.part,
          z,
          tex: (s) => {
            // Leading edge (outward side of the arc) hotter; the tips cooler.
            const [u, vv] = xf.inv(s.x, s.y);
            const out = Math.hypot((u - g.u) / g.R, (vv - g.v) / rv) - 1;
            const tip = Math.abs(Math.atan2(vv - g.v, u - g.u)) / Math.max(0.01, Math.max(Math.abs(g.a0), Math.abs(g.a1)));
            setHeat(s, g.h + lead * sat(out * g.R / g.r) - 0.25 * tip * tip);
          },
        });
        break;
      }
      case 'smoke': {
        if (m.gas === undefined) break;
        const [x, y] = xf.pt(g.u, g.v);
        const fade = g.fade ?? 0;
        billow(c, x, y, g.r, g.seed ?? i * 7 + 3, {
          mat: m.gas,
          z: -1 + z,
          tone: g.tone ?? 0,
          lumps: g.r < 1.6 ? 3 : undefined,
          tex: fade > 0 ? (s, q) => {
            if (frayCut(Math.min(1, q), fade, s.X, s.Y)) s.cut = true;
          } : undefined,
        });
        break;
      }
    }
  });
}
