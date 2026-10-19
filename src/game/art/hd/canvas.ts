/**
 * HdCanvas — the density-generic UHD painter (docs/ART_GUIDE.md "UHD art").
 *
 * A canvas is w × h LOGICAL px at density d ∈ {2, 4}: it draws into a (w·d) × (h·d) buffer, and
 * every coordinate and size is in logical px (floats; 1 / d is one art px). The same drawer
 * therefore makes the 2× and the 4× frame of an id.
 *
 * Drawing is deferred: primitives (ellipsoid, capsule, box, cylinder, poly, plane, height field)
 * write a G-buffer — material, part id, depth, unit normal and a tone offset per art px — with a
 * depth test, so parts can be drawn in any order. `render()` then lights every px (light.ts: key,
 * cool bounce, rim, specular; ambient occlusion where a part meets a nearer one), quantises the
 * tone to the material's HD ramp (hard bands for sprites, an ordered dither at band borders for
 * backgrounds), cleans the clusters (no orphan px except speculars), draws interior separations
 * (the deepest tone of the part behind) and the outline variant:
 *   A — ink, 1 logical px (d art px) wide;
 *   B — ink, ½ logical px wide;
 *   C — selective, ½ logical px: the material's deepest tone on the lit side, ink only on the
 *       shadow side (right / bottom).
 *
 * Fast: per-px work is in tight loops over typed arrays; the only per-px object is one reused
 * sample record handed to textures. Deterministic: no randomness except the hashes callers pass.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer, bandIndex, type Ramp } from '../../../engine/pixel';
import { PAL_HD, hdHome } from '../../../engine/palette-hd';
import { KEY, LIGHT_DEFAULTS, diffuse, specular, type LightParams } from './light';

export type Outline = 'A' | 'B' | 'C' | 'none';

/** A material: an HD ramp and its light. */
export interface HdMaterial extends LightParams {
  ramp: Ramp;
  /** Lowest ramp index of diffuse light (default 1: index 0 is kept for separations, crevices and outline C). */
  lo?: number;
  /** Highest ramp index of diffuse light (default n − 2: the top tone is kept for specular and rim). */
  hi?: number;
  /** Ordered dither at band borders (backgrounds, sky, big gradients): true = 0.22, or the zone width 0..0.5. */
  dither?: boolean | number;
  /** No light: the tone offset alone picks the band (emissive: fire, lamps, lit windows). */
  flat?: boolean;
  /**
   * Static facade decor in a painted scene (style decision: outline C — selective): the px of the
   * parts BEHIND this material, along its silhouette, take its deepest tone on the lit side and
   * ink on the shadow side (right / bottom), ½ logical px wide. Backgrounds never set it.
   */
  edge?: 'C';
  /** Rim light px on the shadow-side silhouette (RenderOpts.rimLight): false turns it off for this material. */
  rimPx?: boolean;
}

/** Per-px record a texture reads and changes (reused: never keep a reference). */
export interface TexSample {
  /** Logical position. */
  x: number;
  y: number;
  /** Art px. */
  X: number;
  Y: number;
  /** Density. */
  d: number;
  /** Local coordinates of the primitive (see each primitive). */
  u: number;
  v: number;
  /** Unit normal (renormalised after the texture). */
  nx: number;
  ny: number;
  nz: number;
  /** Tone offset (+ lighter, − darker; 1 = the whole diffuse range). */
  tone: number;
  /** Material id (a texture may switch it: mortar in a brick wall). */
  mat: number;
  /** A fixed colour (0 = none): no light, kept by the clean-up. */
  fix: Color;
  /** Height offset in logical px (a recessed mortar joint: negative). */
  dz: number;
  /** Set to true to drop this px (holes, ragged edges). */
  cut: boolean;
}

export type Texture = (s: TexSample) => void;

/** Options of every primitive. */
export interface DrawOpts {
  /** Material id (from `material()`). */
  mat: number;
  /** Part id: separations and AO happen between different parts (default: a new id per call). */
  part?: number;
  /** Base depth in logical px (larger = nearer the viewer). */
  z?: number;
  /** Tone offset for the whole primitive. */
  tone?: number;
  tex?: Texture | null;
  /** 0 = flat (normal faces the viewer) … 1 = fully round (default 1). */
  round?: number;
}

export interface RenderOpts {
  outline?: Outline;
  /** Ambient-occlusion strength in tone units (default 0.35; 0 = off). */
  ao?: number;
  /** Cluster clean-up (default true). */
  clean?: boolean;
  /** Interior separations (default true). */
  sep?: boolean;
  /** Minimum base-depth difference for a separation / AO, logical px (default 0.5). */
  sepZ?: number;
  /** Width of a separation line in art px (default 1). */
  sepW?: number;
  /** Outline colour (default ink). */
  ink?: Color;
  /**
   * Cast shadows from the key light (tone units, default 0 = off; 0.3 is a good value): a part
   * that stands dz logical px in front of the surface behind it throws a shadow about dz px long
   * down and to the right (cornices, sills, window recesses, an arm on the torso).
   */
  shadow?: number;
  /** Longest cast shadow, logical px (default 3). */
  shadowMax?: number;
  /**
   * Thin cool rim light (sprites): a px in shade on the silhouette's shadow side (an empty px to
   * its right or lower right) is lifted to the band `lo + rimLight` of its ramp — the low bands
   * of every HD ramp lean cool, so the rim reads as cool sky light. 0 = off (default).
   */
  rimLight?: number;
}

const MAX_MATS = 255;
const INK_MAT = 1;

export class HdCanvas {
  readonly w: number;
  readonly h: number;
  readonly d: number;
  /** Art px. */
  readonly W: number;
  readonly H: number;
  readonly mat: Uint8Array;
  readonly part: Uint16Array;
  /** Surface depth (z-test). */
  readonly zb: Float32Array;
  /** Base depth of the part (separations, AO). */
  readonly pz: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  readonly tone: Float32Array;
  readonly fix: Uint32Array;
  private readonly mats: HdMaterial[] = [];
  private nextPart = 1;
  /** Scratch for heightField: the field per art px (reused; never kept). */
  private hfGrid = new Float64Array(0);
  private readonly s: TexSample = { x: 0, y: 0, X: 0, Y: 0, d: 1, u: 0, v: 0, nx: 0, ny: 0, nz: 1, tone: 0, mat: 0, fix: 0, dz: 0, cut: false };

  constructor(w: number, h: number, d: number) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.W = Math.round(w * d);
    this.H = Math.round(h * d);
    const n = this.W * this.H;
    this.mat = new Uint8Array(n);
    this.part = new Uint16Array(n);
    this.zb = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.tone = new Float32Array(n);
    this.fix = new Uint32Array(n);
    this.mats.push({ ramp: PAL_HD.ink }); // 0: empty (unused)
    this.mats.push({ ramp: PAL_HD.ink, flat: true, lo: 0, hi: 0 }); // 1: ink (fixed colours)
    this.s.d = d;
  }

  /** Register a material; returns its id. */
  material(m: HdMaterial): number {
    if (this.mats.length >= MAX_MATS) throw new Error('HdCanvas: too many materials');
    this.mats.push(m);
    return this.mats.length - 1;
  }

  getMaterial(id: number): HdMaterial {
    return this.mats[id];
  }

  /** A fresh part id (share one between primitives that form one surface). */
  newPart(): number {
    return this.nextPart++;
  }

  /** Art-px bounds of a logical box, clipped. */
  private bx0(x: number): number {
    return Math.max(0, Math.floor(x * this.d));
  }
  private bx1(x: number): number {
    return Math.min(this.W, Math.ceil(x * this.d));
  }
  private by1(y: number): number {
    return Math.min(this.H, Math.ceil(y * this.d));
  }

  /** The common write: texture, renormalise, depth test, store. */
  private put(X: number, Y: number, x: number, y: number, u: number, v: number, nx: number, ny: number, nz: number, h: number, o: DrawOpts, part: number): void {
    const s = this.s;
    s.x = x;
    s.y = y;
    s.X = X;
    s.Y = Y;
    s.u = u;
    s.v = v;
    s.nx = nx;
    s.ny = ny;
    s.nz = nz;
    s.tone = o.tone ?? 0;
    s.mat = o.mat;
    s.fix = 0;
    s.dz = 0;
    s.cut = false;
    if (o.tex) {
      o.tex(s);
      if (s.cut) return;
      const l = Math.hypot(s.nx, s.ny, s.nz) || 1;
      s.nx /= l;
      s.ny /= l;
      s.nz /= l;
    }
    const base = o.z ?? 0;
    const z = base + h + s.dz;
    const i = Y * this.W + X;
    if (this.mat[i] !== 0 && this.zb[i] > z) return;
    this.mat[i] = s.mat;
    this.part[i] = part;
    this.zb[i] = z;
    this.pz[i] = base;
    this.nx[i] = s.nx;
    this.ny[i] = s.ny;
    this.nz[i] = s.nz;
    this.tone[i] = s.tone;
    this.fix[i] = s.fix;
  }

  /** Normal towards the viewer by `round` (0 flat … 1 round). */
  private static flatten(round: number, nx: number, ny: number, nz: number, out: Float64Array): void {
    const x = nx * round;
    const y = ny * round;
    const z = nz * round + (1 - round);
    const l = Math.hypot(x, y, z) || 1;
    out[0] = x / l;
    out[1] = y / l;
    out[2] = z / l;
  }
  private readonly nv = new Float64Array(3);

  /** Ellipsoid centred (cx, cy), radii rx, ry; u, v = −1..1 across it. Depth relief = min(rx, ry). */
  ellipsoid(cx: number, cy: number, rx: number, ry: number, o: DrawOpts): this {
    const d = this.d;
    const part = o.part ?? this.nextPart++;
    const round = o.round ?? 1;
    const rz = Math.min(rx, ry);
    const X0 = this.bx0(cx - rx);
    const X1 = this.bx1(cx + rx);
    const Y0 = this.bx0(cy - ry);
    const Y1 = this.by1(cy + ry);
    const nv = this.nv;
    for (let Y = Y0; Y < Y1; Y++) {
      const y = (Y + 0.5) / d;
      const dy = (y - cy) / ry;
      for (let X = X0; X < X1; X++) {
        const x = (X + 0.5) / d;
        const dx = (x - cx) / rx;
        const q = dx * dx + dy * dy;
        if (q > 1) continue;
        const nz = Math.sqrt(1 - q);
        HdCanvas.flatten(round, dx, dy, nz, nv);
        this.put(X, Y, x, y, dx, dy, nv[0], nv[1], nv[2], nz * rz * round, o, part);
      }
    }
    return this;
  }

  /**
   * Tapered capsule from (x0, y0) radius r0 to (x1, y1) radius r1 (limbs, necks, barrels):
   * u = 0..1 along the axis, v = −1..1 across it (negative on the left of the direction).
   */
  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, o: DrawOpts): this {
    const d = this.d;
    const part = o.part ?? this.nextPart++;
    const round = o.round ?? 1;
    const m = Math.max(r0, r1);
    const vx = x1 - x0;
    const vy = y1 - y0;
    const l2 = vx * vx + vy * vy;
    const len = Math.sqrt(l2) || 1;
    const X0 = this.bx0(Math.min(x0, x1) - m);
    const X1 = this.bx1(Math.max(x0, x1) + m);
    const Y0 = this.bx0(Math.min(y0, y1) - m);
    const Y1 = this.by1(Math.max(y0, y1) + m);
    const nv = this.nv;
    for (let Y = Y0; Y < Y1; Y++) {
      const y = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const x = (X + 0.5) / d;
        let t = l2 === 0 ? 0 : ((x - x0) * vx + (y - y0) * vy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = x0 + vx * t;
        const cy = y0 + vy * t;
        const r = r0 + (r1 - r0) * t;
        const ex = x - cx;
        const ey = y - cy;
        const dd = ex * ex + ey * ey;
        if (dd >= r * r) continue;
        const px = ex / r;
        const py = ey / r;
        const nz = Math.sqrt(Math.max(0, 1 - px * px - py * py));
        HdCanvas.flatten(round, px, py, nz, nv);
        const side = (vx * ey - vy * ex) / len / r;
        this.put(X, Y, x, y, t, side, nv[0], nv[1], nv[2], nz * r * round, o, part);
      }
    }
    return this;
  }

  /** A polyline of capsules with radius r0 → r1 along it (one part). */
  stroke(pts: ReadonlyArray<readonly [number, number]>, r0: number, r1: number, o: DrawOpts): this {
    const part = o.part ?? this.nextPart++;
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = r0 + ((r1 - r0) * i) / n;
      const b = r0 + ((r1 - r0) * (i + 1)) / n;
      this.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], a, b, { ...o, part });
    }
    return this;
  }

  /**
   * Box x, y, w, h with rounded corners `r` and a bevel `bevel` (logical px) where the normal
   * turns to the edges; `n` = the face normal (default: towards the viewer). u, v = 0..1.
   */
  box(x: number, y: number, w: number, h: number, o: DrawOpts & { r?: number; bevel?: number; n?: readonly [number, number, number] }): this {
    const d = this.d;
    const part = o.part ?? this.nextPart++;
    const r = o.r ?? 0;
    const b = o.bevel ?? 0;
    const fn = o.n ?? [0, 0, 1];
    const X0 = this.bx0(x);
    const X1 = this.bx1(x + w);
    const Y0 = this.bx0(y);
    const Y1 = this.by1(y + h);
    const x1 = x + w;
    const y1 = y + h;
    for (let Y = Y0; Y < Y1; Y++) {
      const py = (Y + 0.5) / d;
      if (py < y || py > y1) continue;
      for (let X = X0; X < X1; X++) {
        const px = (X + 0.5) / d;
        if (px < x || px > x1) continue;
        if (r > 0) {
          const cx = px < x + r ? x + r : px > x1 - r ? x1 - r : px;
          const cy = py < y + r ? y + r : py > y1 - r ? y1 - r : py;
          const ex = px - cx;
          const ey = py - cy;
          if (ex * ex + ey * ey > r * r) continue;
        }
        let nx = fn[0];
        let ny = fn[1];
        let nz = fn[2];
        let hgt = 0;
        if (b > 0) {
          const dl = px - x;
          const dr = x1 - px;
          const dt = py - y;
          const db = y1 - py;
          const ex = dl < b ? -(1 - dl / b) : dr < b ? 1 - dr / b : 0;
          const ey = dt < b ? -(1 - dt / b) : db < b ? 1 - db / b : 0;
          nx += ex * 0.8;
          ny += ey * 0.8;
          const l = Math.hypot(nx, ny, nz) || 1;
          nx /= l;
          ny /= l;
          nz /= l;
          hgt = b * (1 - Math.max(Math.abs(ex), Math.abs(ey)));
        }
        this.put(X, Y, px, py, (px - x) / w, (py - y) / h, nx, ny, nz, hgt, o, part);
      }
    }
    return this;
  }

  /**
   * Upright (axis 'v') or lying (axis 'h') cylinder in the box x, y, w, h: round across the
   * axis, straight along it. `cap` = the height of a visible elliptic end at the top / right.
   */
  cylinder(x: number, y: number, w: number, h: number, o: DrawOpts & { axis?: 'v' | 'h'; cap?: number }): this {
    const d = this.d;
    const part = o.part ?? this.nextPart++;
    const vert = (o.axis ?? 'v') === 'v';
    const cap = o.cap ?? 0;
    const round = o.round ?? 1;
    const X0 = this.bx0(x);
    const X1 = this.bx1(x + w);
    const Y0 = this.bx0(y);
    const Y1 = this.by1(y + h);
    const nv = this.nv;
    for (let Y = Y0; Y < Y1; Y++) {
      const py = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const px = (X + 0.5) / d;
        const a = vert ? ((px - x) / w) * 2 - 1 : ((py - y) / h) * 2 - 1;
        const along = vert ? py - y : x + w - px;
        const span = vert ? h : w;
        if (a < -1 || a > 1 || along < 0 || along > span) continue;
        const k = Math.sqrt(Math.max(0, 1 - a * a));
        if (cap > 0 && along < cap) {
          // The elliptic end: a disc seen at an angle, outward normal mostly up (or right).
          const e = (along - cap / 2) / (cap / 2);
          if (a * a + e * e > 1) {
            if (along < cap / 2) continue;
          } else {
            const cx = vert ? a * 0.35 : 0.9;
            const cy = vert ? -0.9 : a * 0.35;
            const l = Math.hypot(cx, cy, 0.45);
            this.put(X, Y, px, py, a, e, cx / l, cy / l, 0.45 / l, (vert ? w : h) / 2, o, part);
            continue;
          }
        }
        if (vert) HdCanvas.flatten(round, a, 0, k, nv);
        else HdCanvas.flatten(round, 0, a, k, nv);
        this.put(X, Y, px, py, a, along / span, nv[0], nv[1], nv[2], k * (vert ? w : h) * 0.5 * round, o, part);
      }
    }
    return this;
  }

  /** Polygon (even-odd) with a constant normal `n` (default: towards the viewer); u, v = the logical px. */
  poly(pts: ReadonlyArray<readonly [number, number]>, o: DrawOpts & { n?: readonly [number, number, number] }): this {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    const n = o.n ?? [0, 0, 1];
    return this.plane(minX, minY, maxX - minX, maxY - minY, {
      ...o,
      mask: (x, y) => inPoly(x, y, pts),
      normal: (_x, _y, out) => {
        out[0] = n[0];
        out[1] = n[1];
        out[2] = n[2];
      },
    });
  }

  /**
   * A plane over the box x, y, w, h: `mask` keeps a px (default all), `normal` writes its normal
   * (default towards the viewer), `height` its relief (logical px). u, v = 0..1 over the box.
   */
  plane(
    x: number,
    y: number,
    w: number,
    h: number,
    o: DrawOpts & {
      mask?: (x: number, y: number) => boolean;
      normal?: (x: number, y: number, out: Float64Array) => void;
      height?: (x: number, y: number) => number;
    },
  ): this {
    const d = this.d;
    const part = o.part ?? this.nextPart++;
    const X0 = this.bx0(x);
    const X1 = this.bx1(x + w);
    const Y0 = this.bx0(y);
    const Y1 = this.by1(y + h);
    const nv = this.nv;
    for (let Y = Y0; Y < Y1; Y++) {
      const py = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const px = (X + 0.5) / d;
        if (o.mask && !o.mask(px, py)) continue;
        nv[0] = 0;
        nv[1] = 0;
        nv[2] = 1;
        if (o.normal) o.normal(px, py, nv);
        this.put(X, Y, px, py, (px - x) / (w || 1), (py - y) / (h || 1), nv[0], nv[1], nv[2], o.height ? o.height(px, py) : 0, o, part);
      }
    }
    return this;
  }

  /**
   * A lit height field over the box x, y, w, h (the portrait-kit painter, generalised): `hf`
   * gives the height in logical px at (x, y), or NaN outside the shape. Normals come from central
   * differences one art px apart. u, v = 0..1 over the box.
   */
  heightField(x: number, y: number, w: number, h: number, hf: (x: number, y: number) => number, o: DrawOpts): this {
    const d = this.d;
    const e = 1 / d;
    const part = o.part ?? this.nextPart++;
    const X0 = this.bx0(x);
    const X1 = this.bx1(x + w);
    const Y0 = this.bx0(y);
    const Y1 = this.by1(y + h);
    if (X1 <= X0 || Y1 <= Y0) return this;
    // The field once per art px centre (with a 1 px border for the differences): 1 call per px, not 5.
    const gw = X1 - X0 + 2;
    const gh = Y1 - Y0 + 2;
    if (this.hfGrid.length < gw * gh) this.hfGrid = new Float64Array(gw * gh);
    const g = this.hfGrid;
    for (let gy = 0; gy < gh; gy++) {
      const py = (Y0 - 1 + gy + 0.5) / d;
      for (let gx = 0; gx < gw; gx++) g[gy * gw + gx] = hf((X0 - 1 + gx + 0.5) / d, py);
    }
    for (let Y = Y0; Y < Y1; Y++) {
      const py = (Y + 0.5) / d;
      const row = (Y - Y0 + 1) * gw + 1 - X0;
      for (let X = X0; X < X1; X++) {
        const px = (X + 0.5) / d;
        const gi = row + X;
        const c = g[gi];
        if (c !== c) continue;
        let l = g[gi - 1];
        let r = g[gi + 1];
        let t = g[gi - gw];
        let b = g[gi + gw];
        if (l !== l) l = c;
        if (r !== r) r = c;
        if (t !== t) t = c;
        if (b !== b) b = c;
        const gx = (r - l) / (2 * e);
        const gy = (b - t) / (2 * e);
        const n = Math.hypot(gx, gy, 1);
        this.put(X, Y, px, py, (px - x) / w, (py - y) / h, -gx / n, -gy / n, 1 / n, c, o, part);
      }
    }
    return this;
  }

  /**
   * A soft volume over the polygon `pts` (cloth panels, vests, boots, hands): flat in the middle
   * with the edge rolling away over `r` logical px, plus a gentle `bulge` (default 0.25) towards
   * the middle. Reads as stuffed cloth or leather, not a tube. u, v = 0..1 over the bounds.
   */
  blob(pts: ReadonlyArray<readonly [number, number]>, r: number, o: DrawOpts & { bulge?: number }): this {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    const bulge = o.bulge ?? 0.25;
    const rr = Math.max(0.05, r);
    return this.heightField(minX, minY, maxX - minX, maxY - minY, (x, y) => {
      if (!inPoly(x, y, pts)) return NaN;
      const dist = polyDist(x, y, pts);
      const t = dist >= rr ? 1 : dist / rr;
      return rr * Math.sqrt(1 - (1 - t) * (1 - t)) + bulge * Math.sqrt(dist);
    }, o);
  }

  /** Add `fn(x, y)` to the tone of every drawn px in the box (folds, cast shadows, stains). Only `part` when given. */
  shade(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => number, part?: number): this {
    const d = this.d;
    const X0 = this.bx0(x);
    const X1 = this.bx1(x + w);
    const Y0 = this.bx0(y);
    const Y1 = this.by1(y + h);
    for (let Y = Y0; Y < Y1; Y++) {
      const py = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const i = Y * this.W + X;
        if (this.mat[i] === 0 || (part !== undefined && this.part[i] !== part)) continue;
        this.tone[i] += fn((X + 0.5) / d, py);
      }
    }
    return this;
  }

  /**
   * Fixed colours over the box: `fn(x, y, X, Y)` returns a colour (0 = leave the px). The px is
   * not lit and the clean-up keeps it (eyes, catchlights, painted signs). On an empty px it
   * becomes part of the silhouette (depth `z`, default in front of everything).
   */
  paint(x: number, y: number, w: number, h: number, fn: (x: number, y: number, X: number, Y: number) => Color, z = 1e6): this {
    const d = this.d;
    const X0 = this.bx0(x);
    const X1 = this.bx1(x + w);
    const Y0 = this.bx0(y);
    const Y1 = this.by1(y + h);
    for (let Y = Y0; Y < Y1; Y++) {
      const py = (Y + 0.5) / d;
      for (let X = X0; X < X1; X++) {
        const c = fn((X + 0.5) / d, py, X, Y);
        if (c === 0) continue;
        const i = Y * this.W + X;
        if (this.mat[i] === 0) {
          this.mat[i] = INK_MAT;
          this.part[i] = 0;
          this.zb[i] = z;
          this.pz[i] = z;
          this.nz[i] = 1;
        }
        this.fix[i] = c >>> 0;
      }
    }
    return this;
  }

  /**
   * Place a finished buffer of the SAME density (a head, a gun) with its top-left at logical
   * (x, y), as fixed colours of one part at depth `z`: it joins the silhouette (the outline wraps
   * it) and parts behind it get a separation. `flipX` mirrors it.
   */
  image(src: PixelBuffer, x: number, y: number, o: { z?: number; part?: number; flipX?: boolean } = {}): this {
    const X0 = Math.round(x * this.d);
    const Y0 = Math.round(y * this.d);
    const z = o.z ?? 0;
    const part = o.part ?? this.nextPart++;
    for (let sy = 0; sy < src.h; sy++) {
      const Y = Y0 + sy;
      if (Y < 0 || Y >= this.H) continue;
      for (let sx = 0; sx < src.w; sx++) {
        const X = X0 + sx;
        if (X < 0 || X >= this.W) continue;
        const c = src.data[sy * src.w + (o.flipX ? src.w - 1 - sx : sx)];
        if ((c & 255) === 0) continue;
        const i = Y * this.W + X;
        if (this.mat[i] !== 0 && this.zb[i] > z) continue;
        this.mat[i] = INK_MAT;
        this.part[i] = part;
        this.zb[i] = z;
        this.pz[i] = z;
        this.fix[i] = c >>> 0;
      }
    }
    return this;
  }

  /** One fixed art px at logical (x, y). */
  dot(x: number, y: number, c: Color): this {
    const X = Math.floor(x * this.d);
    const Y = Math.floor(y * this.d);
    if (X < 0 || Y < 0 || X >= this.W || Y >= this.H) return this;
    const i = Y * this.W + X;
    if (this.mat[i] === 0) {
      this.mat[i] = INK_MAT;
      this.zb[i] = 1e6;
      this.pz[i] = 1e6;
    }
    this.fix[i] = c >>> 0;
    return this;
  }

  /** Remove every px in the box where `keep(x, y)` is false (cut-outs, gaps between fingers). */
  erase(x: number, y: number, w: number, h: number, cut: (x: number, y: number) => boolean): this {
    const d = this.d;
    for (let Y = this.bx0(y); Y < this.by1(y + h); Y++) {
      for (let X = this.bx0(x); X < this.bx1(x + w); X++) {
        if (cut((X + 0.5) / d, (Y + 0.5) / d)) {
          const i = Y * this.W + X;
          this.mat[i] = 0;
          this.fix[i] = 0;
        }
      }
    }
    return this;
  }

  /** Light, quantise, clean, separate and outline into a new (w·d) × (h·d) buffer. */
  render(o: RenderOpts = {}): PixelBuffer {
    const { W, H, d } = this;
    const n = W * H;
    const out = new PixelBuffer(W, H);
    const px = out.data;
    const idx = new Int8Array(n);
    const prot = new Uint8Array(n);
    const aoK = o.ao ?? 0.35;
    const sepZ = o.sepZ ?? 0.5;
    const mats = this.mats;
    const { mat, part, pz, nx, ny, nz, tone, fix } = this;

    // 1. Ambient occlusion: a px next to a nearer part, sampled in 8 directions out to ¾ logical px.
    const ao = aoK > 0 ? new Float32Array(n) : null;
    if (ao) {
      const R = Math.max(1, Math.round(0.75 * d));
      let norm = 0;
      for (let k = 1; k <= R; k++) norm += 8 / k;
      for (let Y = 0; Y < H; Y++) {
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (mat[i] === 0 || fix[i] !== 0) continue;
          const p = part[i];
          const z0 = pz[i] + sepZ;
          let occ = 0;
          for (let k = 1; k <= R; k++) {
            for (let dir = 0; dir < 8; dir++) {
              const XX = X + DX8[dir] * k;
              const YY = Y + DY8[dir] * k;
              if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
              const j = YY * W + XX;
              if (mat[j] !== 0 && part[j] !== p && pz[j] > z0) occ += 1 / k;
            }
          }
          ao[i] = occ / norm;
        }
      }
    }

    // 1b. Cast shadows: march towards the light (up-left); an occluder nearer by more than the
    // distance travelled puts this px in shade.
    const shK = o.shadow ?? 0;
    const shade = shK > 0 ? new Float32Array(n) : null;
    if (shade) {
      const steps = Math.max(1, Math.round((o.shadowMax ?? 3) * d * 1.2));
      const sx = KEY[0] / Math.hypot(KEY[0], KEY[1]);
      const sy = KEY[1] / Math.hypot(KEY[0], KEY[1]);
      for (let Y = 0; Y < H; Y++) {
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (mat[i] === 0 || fix[i] !== 0) continue;
          const z0 = pz[i];
          const p = part[i];
          for (let k = 1; k <= steps; k++) {
            const XX = Math.round(X + sx * k);
            const YY = Math.round(Y + sy * k);
            if (XX < 0 || YY < 0 || XX >= W || YY >= H) break;
            const j = YY * W + XX;
            if (mat[j] !== 0 && part[j] !== p && pz[j] - z0 > (k / d) * 0.8 + 0.2) {
              shade[i] = shK;
              break;
            }
          }
        }
      }
    }

    // 2. Light and quantise.
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        const m = mat[i];
        if (m === 0) continue;
        if (fix[i] !== 0) {
          prot[i] = 2;
          continue;
        }
        const M = mats[m];
        const rn = M.ramp.length;
        const lo = Math.min(rn - 1, M.lo ?? (rn > 4 ? 1 : 0));
        const hi = Math.max(lo, Math.min(rn - 1, M.hi ?? (rn > 4 ? rn - 2 : rn - 1)));
        let t: number;
        if (M.flat) t = 0.5 + tone[i];
        else {
          t =
            diffuse(nx[i], ny[i], nz[i], M.amb ?? LIGHT_DEFAULTS.amb, M.gain ?? LIGHT_DEFAULTS.gain, M.wrap ?? LIGHT_DEFAULTS.wrap, M.bounce ?? LIGHT_DEFAULTS.bounce, M.rim ?? LIGHT_DEFAULTS.rim) +
            tone[i];
          if (ao) t -= ao[i] * aoK * 2.2;
          if (shade) t -= shade[i];
        }
        const bands = hi - lo + 1;
        const z = M.dither === true ? 0.22 : typeof M.dither === 'number' ? M.dither : 0;
        let k = lo + bandIndex(t * bands, bands, z, X, Y);
        if (t < -0.12 && lo > 0) k = lo - 1;
        const sp = M.spec ?? 0;
        if (sp > 0 && !M.flat) {
          const s = sp * specular(nx[i], ny[i], nz[i], M.shine ?? LIGHT_DEFAULTS.shine);
          if (s > 0.55) {
            k = rn - 1;
            prot[i] = 1;
          } else if (s > 0.28 && k < rn - 2) k = Math.min(rn - 2, k + 1);
        }
        idx[i] = k;
      }
    }

    // 3. Cluster clean-up: an art px with no same-tone 4-neighbour in its part takes the most common neighbour tone.
    if (o.clean ?? true) {
      for (let pass = 0; pass < 2; pass++) {
        for (let Y = 0; Y < H; Y++) {
          for (let X = 0; X < W; X++) {
            const i = Y * W + X;
            if (mat[i] === 0 || prot[i] !== 0) continue;
            const M = mats[mat[i]];
            if (M.dither) continue;
            const p = part[i];
            const k = idx[i];
            let same = 0;
            let c0 = -1;
            let n0 = 0;
            let c1 = -1;
            let n1 = 0;
            for (let dir = 0; dir < 4; dir++) {
              const XX = X + DX8[dir];
              const YY = Y + DY8[dir];
              if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
              const j = YY * W + XX;
              if (mat[j] === 0 || part[j] !== p || prot[j] === 2) continue;
              const kj = idx[j];
              if (kj === k) same++;
              else if (kj === c0 || c0 < 0) {
                c0 = kj;
                n0++;
              } else if (kj === c1 || c1 < 0) {
                c1 = kj;
                n1++;
              }
            }
            if (same === 0 && (n0 > 0 || n1 > 0)) idx[i] = n1 > n0 ? c1 : c0;
          }
        }
      }
    }

    // 3b. Rim light on the shadow-side silhouette.
    const rimL = o.rimLight ?? 0;
    if (rimL > 0) {
      for (let Y = 0; Y < H; Y++) {
        for (let X = 0; X < W - 1; X++) {
          const i = Y * W + X;
          if (mat[i] === 0 || prot[i] !== 0) continue;
          const M = mats[mat[i]];
          if (M.flat || M.rimPx === false) continue;
          const open = mat[i + 1] === 0 || (Y + 1 < H && mat[i + 1 + W] === 0 && mat[i + W] !== 0);
          if (!open) continue;
          const rn = M.ramp.length;
          const lo = Math.min(rn - 1, M.lo ?? (rn > 4 ? 1 : 0));
          const k = Math.min(rn - 2, lo + rimL);
          if (idx[i] < k) idx[i] = k;
        }
      }
    }

    // 4. Interior separations: the px of the part BEHIND a nearer part gets its deepest tone.
    //    Behind an `edge: 'C'` material the px instead take that material's deepest tone (lit
    //    side) or ink (shadow side): the selective outline of facade decor.
    const edgeCol = new Uint32Array(n);
    let anyEdge = false;
    for (const M of mats) if (M.edge) anyEdge = true;
    if (anyEdge) {
      const ew = Math.max(1, d >> 1);
      const inkC = o.ink ?? PAL_HD.ink[0];
      for (let Y = 0; Y < H; Y++) {
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (mat[i] === 0 || mats[mat[i]].edge) continue;
          const z0 = pz[i] + sepZ;
          let found = false;
          for (let k = 1; k <= ew && !found; k++) {
            for (let dir = 0; dir < 8; dir++) {
              const XX = X + DX8[dir] * k;
              const YY = Y + DY8[dir] * k;
              if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
              const j = YY * W + XX;
              const Mj = mats[mat[j]];
              if (mat[j] === 0 || !Mj.edge || pz[j] <= z0) continue;
              // This px lies right of / below the decor px: the shadow side.
              edgeCol[i] = -DX8[dir] + -DY8[dir] > 0 ? inkC : Mj.ramp[0];
              found = true;
              break;
            }
          }
        }
      }
    }
    if (o.sep ?? true) {
      const sw = Math.max(1, o.sepW ?? 1);
      for (let Y = 0; Y < H; Y++) {
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (mat[i] === 0 || prot[i] === 2) continue;
          const p = part[i];
          const z0 = pz[i] + sepZ;
          let hit = false;
          for (let k = 1; k <= sw && !hit; k++) {
            for (let dir = 0; dir < 4; dir++) {
              const XX = X + DX8[dir] * k;
              const YY = Y + DY8[dir] * k;
              if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
              const j = YY * W + XX;
              if (mat[j] !== 0 && part[j] !== p && pz[j] > z0) {
                hit = true;
                break;
              }
            }
          }
          if (hit) idx[i] = -1;
        }
      }
    }

    // 5. Colours.
    for (let i = 0; i < n; i++) {
      const m = mat[i];
      if (m === 0) continue;
      if (edgeCol[i] !== 0) {
        px[i] = edgeCol[i];
        continue;
      }
      if (fix[i] !== 0) {
        px[i] = fix[i];
        continue;
      }
      const r = mats[m].ramp;
      const k = idx[i];
      px[i] = k < 0 ? r[0] : r[k];
    }

    // 6. Outline.
    const ol = o.outline ?? 'A';
    if (ol !== 'none') {
      const ink = o.ink ?? PAL_HD.ink[0];
      const rad = ol === 'A' ? d : Math.max(1, d >> 1);
      const offs = ringOffsets(rad);
      // Summed-area table of drawn px: an empty px with nothing drawn in its (2·rad + 1)² box (a
      // superset of the ring) skips the ring scan — most of a sprite frame is empty.
      const W1 = W + 1;
      const sat = new Int32Array(W1 * (H + 1));
      for (let Y = 0; Y < H; Y++) {
        let row = 0;
        for (let X = 0; X < W; X++) {
          if (mat[Y * W + X] !== 0) row++;
          sat[(Y + 1) * W1 + X + 1] = sat[Y * W1 + X + 1] + row;
        }
      }
      for (let Y = 0; Y < H; Y++) {
        const y0 = Y - rad < 0 ? 0 : Y - rad;
        const y1 = Y + rad + 1 > H ? H : Y + rad + 1;
        for (let X = 0; X < W; X++) {
          const i = Y * W + X;
          if (mat[i] !== 0) continue;
          const x0 = X - rad < 0 ? 0 : X - rad;
          const x1 = X + rad + 1 > W ? W : X + rad + 1;
          if (sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0] === 0) continue;
          for (let q = 0; q < offs.length; q += 2) {
            const XX = X + offs[q];
            const YY = Y + offs[q + 1];
            if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
            const j = YY * W + XX;
            if (mat[j] === 0) continue;
            if (ol === 'C' && offs[q] + offs[q + 1] >= 0) {
              const home = fix[j] !== 0 ? hdHome(fix[j]) : null;
              px[i] = fix[j] === 0 ? mats[mat[j]].ramp[0] : home ? home.ramp[0] : ink;
            } else px[i] = ink;
            break;
          }
        }
      }
    }
    out.touch();
    return out;
  }
}

/** 4-neighbours first (left, right, up, down), then the diagonals. */
const DX8 = [-1, 1, 0, 0, -1, 1, -1, 1];
const DY8 = [0, 0, -1, 1, -1, -1, 1, 1];

const ringCache = new Map<number, Int8Array>();

/** Offsets (dx, dy) of a round disc of radius r, nearest first (r = 1: the 4-neighbours). */
function ringOffsets(r: number): Int8Array {
  let o = ringCache.get(r);
  if (o) return o;
  const list: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const q = dx * dx + dy * dy;
      if (q === 0 || q > r * r + (r > 1 ? r * 0.5 : 0)) continue;
      list.push([dx, dy, q]);
    }
  }
  list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  o = Int8Array.from(list.flatMap(([dx, dy]) => [dx, dy]));
  ringCache.set(r, o);
  return o;
}

/** Distance from (x, y) to the nearest edge of the polygon `pts`. */
export function polyDist(x: number, y: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0];
    const ay = pts[j][1];
    const vx = pts[i][0] - ax;
    const vy = pts[i][1] - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 === 0 ? 0 : ((x - ax) * vx + (y - ay) * vy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - vx * t;
    const ey = y - ay - vy * t;
    const q = ex * ex + ey * ey;
    if (q < best) best = q;
  }
  return Math.sqrt(best);
}

/** Even-odd point-in-polygon test. */
export function inPoly(x: number, y: number, pts: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
