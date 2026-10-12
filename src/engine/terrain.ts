/**
 * Static terrain of one section (docs/ARCHITECTURE.md §5.9).
 *
 * - `ground`: polylines with non-decreasing x. Everything below a polyline is solid, and so is
 *   everything below its two end points (the ends are cliff walls down to infinity).
 *   Slopes up to `maxSlope` (default 1:1) are walkable; steeper parts and vertical steps act
 *   as walls unless they are no taller than the body's step-up height.
 * - `platforms`: one-way polylines (strictly increasing x): land on them from above, jump
 *   through from below, drop through with down + jump.
 * - `solids`: axis-aligned rects that block from every side.
 * - `hazards`: rects tagged with a kind; game code decides what they do.
 *
 * Coordinates: pixels, y grows downward. A body standing on flat ground at y = 170 has its feet
 * at y = 170; the first ground pixel row is 170. Queries scan 64-px column buckets.
 */
import type { Rect } from './math';

export type HazardKind = 'pit' | 'water' | 'spikes' | 'lava' | 'kill';
export type Point = [number, number];
export type Polyline = Point[];

export interface SolidDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional label (painter material hints, debugging). */
  tag?: string;
}

export interface HazardDef {
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TerrainBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Plain serialisable terrain data (what mission files contain). */
export interface TerrainDef {
  bounds: TerrainBounds;
  ground: Polyline[];
  platforms: Polyline[];
  solids: SolidDef[];
  hazards: HazardDef[];
  /** Bodies below this y fell out of the world. Default: bottom of bounds + 32. */
  killY?: number;
}

/** `cellAt` results (same numbers as TerrainCell in src/game/art/art-registry.ts). */
export const CELL_EMPTY = 0;
export const CELL_GROUND = 1;
export const CELL_PLATFORM = 2;
export const CELL_SOLID = 3;
export type CellKind = 0 | 1 | 2 | 3;

/** Thickness of the painted band under a one-way platform line. */
export const PLATFORM_BAND = 4;
/** Width of the query buckets. */
export const COLUMN = 64;

export type RayHitKind = 'ground' | 'solid' | 'platform' | 'dynamic';

/** Result of a ray / sweep. `t` is the fraction of the segment travelled (0..1). */
export interface RayHit {
  x: number;
  y: number;
  t: number;
  /** Surface normal at the hit (unit vector, pointing out of the obstacle). */
  nx: number;
  ny: number;
  kind: RayHitKind;
  /** Index of the segment / solid / platform polyline that was hit (-1 for dynamic solids). */
  index: number;
}

export function makeRayHit(): RayHit {
  return { x: 0, y: 0, t: 0, nx: 0, ny: 0, kind: 'ground', index: -1 };
}

// ---------------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------------

/**
 * Fluent polyline builder.
 * ```ts
 * ground().at(0, 170).flat(400).slope(200, -40).step(-20).flat(100).gap(48).flat(300).build()
 * ```
 * `gap` ends the current polyline (a pit) and the next one starts `len` px further at the same
 * height. `step` (ground only) adds a vertical step; negative dy = up.
 */
export class PathBuilder {
  readonly kind: 'ground' | 'platform';
  private readonly lines: Polyline[] = [];
  private cur: Polyline | null = null;
  private px = 0;
  private py = 0;
  private started = false;

  constructor(kind: 'ground' | 'platform' = 'ground') {
    this.kind = kind;
  }

  /** Current pen position. */
  get x(): number {
    return this.px;
  }

  get y(): number {
    return this.py;
  }

  /** Start a new polyline at (x, y). */
  at(x: number, y: number): this {
    this.end();
    this.px = x;
    this.py = y;
    this.started = true;
    return this;
  }

  /** Flat run of `len` px. */
  flat(len: number): this {
    return this.lineTo(this.px + len, this.py);
  }

  /** Straight slope over `len` px; dy < 0 goes up. */
  slope(len: number, dy: number): this {
    return this.lineTo(this.px + len, this.py + dy);
  }

  /** Straight line to an absolute point (x must not decrease). */
  to(x: number, y: number): this {
    return this.lineTo(x, y);
  }

  /** Vertical step (ground only); dy < 0 = up. */
  step(dy: number): this {
    if (this.kind === 'platform') throw new Error('PathBuilder: platforms cannot have vertical steps');
    return this.lineTo(this.px, this.py + dy);
  }

  /** End the polyline here; the next one starts `len` px to the right at the same height. */
  gap(len: number): this {
    this.end();
    this.px += len;
    return this;
  }

  /**
   * Smooth bump of `len` px that rises by `height` (negative = dip) and comes back down,
   * made of `steps` straight segments.
   */
  hill(len: number, height: number, steps = 8): this {
    const x0 = this.px;
    const y0 = this.py;
    const n = Math.max(2, Math.floor(steps));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const y = y0 - (height * (1 - Math.cos(t * Math.PI * 2))) / 2;
      this.lineTo(x0 + len * t, i === n ? y0 : Math.round(y * 100) / 100);
    }
    return this;
  }

  /** Finish the current polyline (the next segment needs a new `at` or follows a `gap`). */
  end(): this {
    if (this.cur && this.cur.length < 2) {
      const i = this.lines.indexOf(this.cur);
      if (i >= 0) this.lines.splice(i, 1);
    }
    this.cur = null;
    return this;
  }

  /** Copy of the polylines built so far. */
  build(): Polyline[] {
    this.end();
    return this.lines.map((l) => l.map((p): Point => [p[0], p[1]]));
  }

  private lineTo(x: number, y: number): this {
    if (!this.started) throw new Error('PathBuilder: call at(x, y) first');
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`PathBuilder: bad point ${x},${y}`);
    if (x < this.px) throw new Error(`PathBuilder: x must not decrease (${this.px} → ${x})`);
    if (this.kind === 'platform' && x === this.px && y !== this.py) {
      throw new Error('PathBuilder: platforms cannot have vertical segments');
    }
    if (!this.cur) {
      this.cur = [[this.px, this.py]];
      this.lines.push(this.cur);
    }
    const last = this.cur[this.cur.length - 1];
    if (last[0] !== x || last[1] !== y) this.cur.push([x, y]);
    this.px = x;
    this.py = y;
    return this;
  }
}

/** Standalone ground path builder. */
export function ground(): PathBuilder {
  return new PathBuilder('ground');
}

/** Standalone one-way platform path builder (for sloped platforms). */
export function platformPath(): PathBuilder {
  return new PathBuilder('platform');
}

/**
 * Collects a whole TerrainDef.
 * ```ts
 * const t = terrain(2400, 216);
 * t.ground().at(0, 170).flat(600).slope(120, -40).flat(300).gap(64).flat(800);
 * t.platform(300, 120, 96).solid(900, 98, 32, 32).hazard('water', 1100, 180, 200, 40);
 * const def = t.build();
 * ```
 */
export class TerrainBuilder {
  private readonly bounds: TerrainBounds;
  private readonly paths: PathBuilder[] = [];
  private readonly flatPlatforms: Polyline[] = [];
  private readonly solids: SolidDef[] = [];
  private readonly hazards: HazardDef[] = [];
  private kill: number | undefined;

  constructor(bounds: TerrainBounds) {
    this.bounds = { ...bounds };
  }

  /** New ground path (start it with `.at(x, y)`). */
  ground(): PathBuilder {
    const p = new PathBuilder('ground');
    this.paths.push(p);
    return p;
  }

  /** New sloped one-way platform path (start it with `.at(x, y)`). */
  platforms(): PathBuilder {
    const p = new PathBuilder('platform');
    this.paths.push(p);
    return p;
  }

  /** Flat one-way platform from (x, y) to (x + len, y). */
  platform(x: number, y: number, len: number): this {
    this.flatPlatforms.push([
      [x, y],
      [x + len, y],
    ]);
    return this;
  }

  solid(x: number, y: number, w: number, h: number, tag?: string): this {
    this.solids.push(tag === undefined ? { x, y, w, h } : { x, y, w, h, tag });
    return this;
  }

  hazard(kind: HazardKind, x: number, y: number, w: number, h: number): this {
    this.hazards.push({ kind, x, y, w, h });
    return this;
  }

  killY(y: number): this {
    this.kill = y;
    return this;
  }

  build(): TerrainDef {
    const groundLines: Polyline[] = [];
    const platformLines: Polyline[] = [];
    for (const p of this.paths) (p.kind === 'ground' ? groundLines : platformLines).push(...p.build());
    for (const l of this.flatPlatforms) platformLines.push(l.map((pt): Point => [pt[0], pt[1]]));
    const def: TerrainDef = {
      bounds: { ...this.bounds },
      ground: groundLines,
      platforms: platformLines,
      solids: this.solids.map((s) => ({ ...s })),
      hazards: this.hazards.map((h) => ({ ...h })),
    };
    if (this.kill !== undefined) def.killY = this.kill;
    return def;
  }
}

/** Start a terrain of `w` × `h` px (bounds origin at x, y). */
export function terrain(w: number, h: number, x = 0, y = 0): TerrainBuilder {
  return new TerrainBuilder({ x, y, w, h });
}

// ---------------------------------------------------------------------------------------------
// Terrain (queries)
// ---------------------------------------------------------------------------------------------

const warned = new Set<string>();
function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

/** Segment (px,py)+t*(rx,ry) against segment q→q2. Returns t in [0,1] or -1. */
function segT(
  px: number,
  py: number,
  rx: number,
  ry: number,
  qx: number,
  qy: number,
  q2x: number,
  q2y: number,
): number {
  const sx = q2x - qx;
  const sy = q2y - qy;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return -1; // parallel or degenerate
  const qpx = qx - px;
  const qpy = qy - py;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return -1;
  return t;
}

/** Clean one polyline: finite points, non-decreasing x (strictly increasing for platforms). */
function cleanLine(line: readonly Point[], strict: boolean, label: string): Point[] {
  const out: Point[] = [];
  for (const p of line) {
    const x = p?.[0];
    const y = p?.[1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      warnOnce(`${label}:nan`, `[terrain] ${label}: skipped a non-finite point`);
      continue;
    }
    const last = out[out.length - 1];
    if (last) {
      if (x < last[0] || (strict && x === last[0])) {
        warnOnce(`${label}:order`, `[terrain] ${label}: skipped a point that goes backwards in x`);
        continue;
      }
      if (x === last[0] && y === last[1]) continue;
    }
    out.push([x, y]);
  }
  return out;
}

export class Terrain {
  readonly def: TerrainDef;
  readonly bounds: Readonly<TerrainBounds>;
  readonly killY: number;
  readonly solids: readonly SolidDef[];
  /**
   * Hazard rects (static data plus the live ones added with `addHazard`). Readers scan this
   * array on every call, so a rect added, moved or removed at runtime is seen at once.
   */
  readonly hazards: readonly HazardDef[];
  private readonly hazardList: HazardDef[];

  // ---- Internal tables. Public for physics.ts and debug drawing; treat as read-only. ----
  /** Ground segments. */
  readonly gx0: Float64Array;
  readonly gy0: Float64Array;
  readonly gx1: Float64Array;
  readonly gy1: Float64Array;
  readonly groundCount: number;
  /** Polyline end caps: start (S) and end (E) points of each ground polyline. */
  readonly capSX: Float64Array;
  readonly capSY: Float64Array;
  readonly capEX: Float64Array;
  readonly capEY: Float64Array;
  readonly capCount: number;
  /** Platform segments and the polyline each belongs to. */
  readonly px0: Float64Array;
  readonly py0: Float64Array;
  readonly px1: Float64Array;
  readonly py1: Float64Array;
  readonly pLine: Int32Array;
  readonly platformCount: number;
  readonly originX: number;
  readonly nCols: number;
  private readonly gCols: Int32Array[];
  private readonly pCols: Int32Array[];
  private readonly sCols: Int32Array[];
  private readonly capCols: Int32Array[];

  /** Platform polyline index found by the last `platformY` hit (-1 if none). */
  lastPlatform = -1;
  /** Platform segment index found by the last `platformY` hit (-1 if none). */
  lastPlatformSeg = -1;
  /** Solid index found by the last `solidTopIn` / `solidBottomIn` hit (-1 if none). */
  lastSolid = -1;

  constructor(def: TerrainDef) {
    this.def = def;
    const b = def.bounds ?? { x: 0, y: 0, w: 384, h: 216 };
    this.bounds = { x: b.x, y: b.y, w: b.w, h: b.h };
    this.killY = Number.isFinite(def.killY) ? (def.killY as number) : b.y + b.h + 32;
    this.solids = (def.solids ?? []).filter((s) => s.w > 0 && s.h > 0);
    this.hazardList = (def.hazards ?? []).filter((h) => h.w > 0 && h.h > 0);
    this.hazards = this.hazardList;

    const groundLines = (def.ground ?? []).map((l, i) => cleanLine(l, false, `ground[${i}]`)).filter((l) => l.length >= 2);
    const platformLines = (def.platforms ?? []).map((l, i) => cleanLine(l, true, `platforms[${i}]`)).filter((l) => l.length >= 2);

    // Flatten segments.
    let gn = 0;
    for (const l of groundLines) gn += l.length - 1;
    this.gx0 = new Float64Array(gn);
    this.gy0 = new Float64Array(gn);
    this.gx1 = new Float64Array(gn);
    this.gy1 = new Float64Array(gn);
    this.capSX = new Float64Array(groundLines.length);
    this.capSY = new Float64Array(groundLines.length);
    this.capEX = new Float64Array(groundLines.length);
    this.capEY = new Float64Array(groundLines.length);
    let k = 0;
    groundLines.forEach((l, li) => {
      for (let i = 0; i + 1 < l.length; i++, k++) {
        this.gx0[k] = l[i][0];
        this.gy0[k] = l[i][1];
        this.gx1[k] = l[i + 1][0];
        this.gy1[k] = l[i + 1][1];
      }
      this.capSX[li] = l[0][0];
      this.capSY[li] = l[0][1];
      this.capEX[li] = l[l.length - 1][0];
      this.capEY[li] = l[l.length - 1][1];
    });
    this.groundCount = gn;
    this.capCount = groundLines.length;

    let pn = 0;
    for (const l of platformLines) pn += l.length - 1;
    this.px0 = new Float64Array(pn);
    this.py0 = new Float64Array(pn);
    this.px1 = new Float64Array(pn);
    this.py1 = new Float64Array(pn);
    this.pLine = new Int32Array(pn);
    k = 0;
    platformLines.forEach((l, li) => {
      for (let i = 0; i + 1 < l.length; i++, k++) {
        this.px0[k] = l[i][0];
        this.py0[k] = l[i][1];
        this.px1[k] = l[i + 1][0];
        this.py1[k] = l[i + 1][1];
        this.pLine[k] = li;
      }
    });
    this.platformCount = pn;

    // Column range covering all geometry and the bounds.
    let minX = this.bounds.x;
    let maxX = this.bounds.x + this.bounds.w;
    const see = (x: number): void => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    };
    for (let i = 0; i < gn; i++) {
      see(this.gx0[i]);
      see(this.gx1[i]);
    }
    for (let i = 0; i < pn; i++) {
      see(this.px0[i]);
      see(this.px1[i]);
    }
    for (const s of this.solids) {
      see(s.x);
      see(s.x + s.w);
    }
    this.originX = Math.floor(minX / COLUMN) * COLUMN;
    this.nCols = Math.max(1, Math.floor((maxX - this.originX) / COLUMN) + 1);

    const build = (n: number, range: (i: number) => [number, number]): Int32Array[] => {
      const cols: number[][] = Array.from({ length: this.nCols }, () => []);
      for (let i = 0; i < n; i++) {
        const [a, b2] = range(i);
        const c0 = this.clampCol(a);
        const c1 = this.clampCol(b2);
        for (let c = c0; c <= c1; c++) cols[c].push(i);
      }
      return cols.map((c) => Int32Array.from(c));
    };
    this.gCols = build(gn, (i) => [this.gx0[i], this.gx1[i]]);
    this.pCols = build(pn, (i) => [this.px0[i], this.px1[i]]);
    this.sCols = build(this.solids.length, (i) => [this.solids[i].x, this.solids[i].x + this.solids[i].w]);
    // A cap is listed in the columns of both of its x positions (start and end).
    const capColsTmp: number[][] = Array.from({ length: this.nCols }, () => []);
    for (let i = 0; i < this.capCount; i++) {
      const cs = this.clampCol(this.capSX[i]);
      const ce = this.clampCol(this.capEX[i]);
      capColsTmp[cs].push(i);
      if (ce !== cs) capColsTmp[ce].push(i);
    }
    this.capCols = capColsTmp.map((c) => Int32Array.from(c));
  }

  /** Terrain with no geometry (everything is air). */
  static empty(w = 384, h = 216): Terrain {
    return new Terrain({ bounds: { x: 0, y: 0, w, h }, ground: [], platforms: [], solids: [], hazards: [] });
  }

  /** Column index of x, or -1 outside the bucketed range. */
  colOf(x: number): number {
    const c = Math.floor((x - this.originX) / COLUMN);
    return c >= 0 && c < this.nCols ? c : -1;
  }

  private clampCol(x: number): number {
    const c = Math.floor((x - this.originX) / COLUMN);
    return c < 0 ? 0 : c >= this.nCols ? this.nCols - 1 : c;
  }

  // ---------------------------------------------------------------------------- point queries

  /** Ground surface y at x (the top of the ground), or +Infinity over a pit / outside. */
  groundY(x: number): number {
    const c = this.colOf(x);
    if (c < 0) return Infinity;
    const list = this.gCols[c];
    let best = Infinity;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const x0 = this.gx0[i];
      const x1 = this.gx1[i];
      if (x < x0 || x >= x1) continue; // half-open; vertical segments never match
      const y = this.gy0[i] + ((x - x0) * (this.gy1[i] - this.gy0[i])) / (x1 - x0);
      if (y < best) best = y;
    }
    return best;
  }

  /** Slope dy/dx of the ground at x (0 over a pit). Positive = going down to the right. */
  groundSlope(x: number): number {
    const c = this.colOf(x);
    if (c < 0) return 0;
    const list = this.gCols[c];
    let best = Infinity;
    let slope = 0;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const x0 = this.gx0[i];
      const x1 = this.gx1[i];
      if (x < x0 || x >= x1) continue;
      const s = (this.gy1[i] - this.gy0[i]) / (x1 - x0);
      const y = this.gy0[i] + (x - x0) * s;
      if (y < best) {
        best = y;
        slope = s;
      }
    }
    return slope;
  }

  /**
   * Highest one-way platform y at x within [yFrom, yTo], or +Infinity. `excludeLine` skips one
   * platform polyline (the one a body is dropping through). Sets `lastPlatform` / `lastPlatformSeg`.
   */
  platformY(x: number, yFrom = -Infinity, yTo = Infinity, excludeLine = -1): number {
    this.lastPlatform = -1;
    this.lastPlatformSeg = -1;
    const c = this.colOf(x);
    if (c < 0) return Infinity;
    const list = this.pCols[c];
    let best = Infinity;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const x0 = this.px0[i];
      const x1 = this.px1[i];
      if (x < x0 || x >= x1) continue;
      if (excludeLine >= 0 && this.pLine[i] === excludeLine) continue;
      const y = this.py0[i] + ((x - x0) * (this.py1[i] - this.py0[i])) / (x1 - x0);
      if (y < yFrom || y > yTo || y >= best) continue;
      best = y;
      this.lastPlatform = this.pLine[i];
      this.lastPlatformSeg = i;
    }
    return best;
  }

  /** Slope dy/dx of platform segment `seg`. */
  platformSlope(seg: number): number {
    if (seg < 0 || seg >= this.platformCount) return 0;
    return (this.py1[seg] - this.py0[seg]) / (this.px1[seg] - this.px0[seg]);
  }

  /** Is (x, y) inside a solid rect? (half-open: right/bottom edges are outside) */
  inSolid(x: number, y: number): boolean {
    const c = this.colOf(x);
    if (c < 0) return false;
    const list = this.sCols[c];
    for (let k = 0; k < list.length; k++) {
      const s = this.solids[list[k]];
      if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    }
    return false;
  }

  /** Is (x, y) inside ground or a solid rect? Points exactly on the ground surface are not solid. */
  isSolid(x: number, y: number): boolean {
    return y > this.groundY(x) || this.inSolid(x, y);
  }

  /**
   * First walkable surface at x whose y is in [yFrom, yTo]: ground, platforms (unless
   * `platforms: false`) and solid-rect tops. Returns +Infinity if there is none.
   * Typical use: `surfaceY(x, y)` = the floor at or below (x, y), e.g. to place an enemy.
   */
  surfaceY(x: number, yFrom = -Infinity, yTo = Infinity, opts?: { platforms?: boolean }): number {
    let best = Infinity;
    const g = this.groundY(x);
    if (g >= yFrom && g <= yTo) best = g;
    if (opts?.platforms !== false) {
      const p = this.platformY(x, yFrom, yTo);
      if (p < best) best = p;
    }
    const c = this.colOf(x);
    if (c >= 0) {
      const list = this.sCols[c];
      for (let k = 0; k < list.length; k++) {
        const s = this.solids[list[k]];
        if (x < s.x || x >= s.x + s.w) continue;
        if (s.y >= yFrom && s.y <= yTo && s.y < best) best = s.y;
      }
    }
    return best;
  }

  /**
   * Nearest ceiling (bottom of a solid rect) at x at or above `y`, at most `maxDist` px up.
   * Returns -Infinity if there is none. Ground never forms a ceiling.
   */
  ceilingY(x: number, y: number, maxDist = Infinity): number {
    const c = this.colOf(x);
    if (c < 0) return -Infinity;
    const list = this.sCols[c];
    let best = -Infinity;
    for (let k = 0; k < list.length; k++) {
      const s = this.solids[list[k]];
      if (x < s.x || x >= s.x + s.w) continue;
      const bottom = s.y + s.h;
      if (bottom <= y && bottom >= y - maxDist && bottom > best) best = bottom;
    }
    return best;
  }

  /**
   * Slope dy/dx of the ground or platform surface at x that is nearest to y (within 8 px).
   * 0 when there is no surface near y.
   */
  slopeAt(x: number, y: number): number {
    const g = this.groundY(x);
    const p = this.platformY(x, y - 8, y + 8);
    const seg = this.lastPlatformSeg;
    const dg = Math.abs(g - y);
    const dp = Math.abs(p - y);
    if (dg <= 8 && dg <= dp) return this.groundSlope(x);
    if (dp <= 8) return this.platformSlope(seg);
    return 0;
  }

  /**
   * Sampler for the terrain painter (integer pixel coordinates, sampled at the pixel centre):
   * 0 empty, 1 ground, 2 one-way platform band (PLATFORM_BAND px under the line), 3 solid rect.
   */
  cellAt(px: number, py: number): CellKind {
    const x = px + 0.5;
    const y = py + 0.5;
    if (this.inSolid(x, y)) return CELL_SOLID;
    if (y > this.groundY(x)) return CELL_GROUND;
    if (this.platformY(x, y - PLATFORM_BAND, y) <= y) return CELL_PLATFORM;
    return CELL_EMPTY;
  }

  /**
   * Add a live hazard rect (a prop's moving kill zone, rising meltwater). The rect is kept by
   * reference: move or resize it in place and every reader sees the change. Adding the same
   * object twice is a no-op. Returns true when it was added.
   */
  addHazard(h: HazardDef): boolean {
    if (this.hazardList.includes(h)) return false;
    this.hazardList.push(h);
    return true;
  }

  /** Remove a hazard (by reference) added with `addHazard` or from the def. Returns true when found. */
  removeHazard(h: HazardDef): boolean {
    const i = this.hazardList.indexOf(h);
    if (i < 0) return false;
    this.hazardList.splice(i, 1);
    return true;
  }

  /** First hazard overlapping the rect, or null. */
  hazardAt(r: Rect): HazardDef | null {
    for (const h of this.hazards) {
      if (r.x < h.x + h.w && r.x + r.w > h.x && r.y < h.y + h.h && r.y + r.h > h.y) return h;
    }
    return null;
  }

  /** All hazards overlapping the rect, appended to `out`. Returns how many were added. */
  hazardsAt(r: Rect, out: HazardDef[]): number {
    let n = 0;
    for (const h of this.hazards) {
      if (r.x < h.x + h.w && r.x + r.w > h.x && r.y < h.y + h.h && r.y + r.h > h.y) {
        out.push(h);
        n++;
      }
    }
    return n;
  }

  // ---------------------------------------------------------------------------- rays

  /** True when no ground or solid rect blocks the segment (platforms never block sight). */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.raycast(x0, y0, x1, y1, false, scratchHit) === null;
  }

  /**
   * First point where the segment (x0,y0)→(x1,y1) enters ground or a solid rect, and, with
   * `platforms`, crosses a one-way platform from above. Returns null when the path is clear.
   * A start point inside solid terrain hits at t = 0.
   */
  raycast(x0: number, y0: number, x1: number, y1: number, platforms = false, out?: RayHit): RayHit | null {
    const hit = out ?? makeRayHit();
    if (this.isSolid(x0, y0)) {
      hit.x = x0;
      hit.y = y0;
      hit.t = 0;
      hit.nx = 0;
      hit.ny = -1;
      hit.kind = this.inSolid(x0, y0) ? 'solid' : 'ground';
      hit.index = -1;
      return hit;
    }
    const dx = x1 - x0;
    const dy = y1 - y0;
    let bestT = Infinity;
    let kind: RayHitKind = 'ground';
    let index = -1;
    let nx = 0;
    let ny = 0;
    const c0 = this.clampCol(Math.min(x0, x1));
    const c1 = this.clampCol(Math.max(x0, x1));
    for (let c = c0; c <= c1; c++) {
      // Ground segments.
      const gl = this.gCols[c];
      for (let k = 0; k < gl.length; k++) {
        const i = gl[k];
        // Only entering crossings count (moving from above the line to below it).
        const sx = this.gx1[i] - this.gx0[i];
        const sy = this.gy1[i] - this.gy0[i];
        if (sx * dy - sy * dx <= 0) continue;
        const t = segT(x0, y0, dx, dy, this.gx0[i], this.gy0[i], this.gx1[i], this.gy1[i]);
        if (t < 0 || t >= bestT) continue;
        bestT = t;
        kind = 'ground';
        index = i;
        // Outward normal of a left-to-right segment points up: (sy, -sx) normalised.
        const len = Math.hypot(sx, sy) || 1;
        nx = sy / len;
        ny = -sx / len;
      }
      // Polyline end caps: vertical walls from the end point down to infinity.
      if (dx !== 0) {
        const cl = this.capCols[c];
        for (let k = 0; k < cl.length; k++) {
          const i = cl[k];
          // Start caps face left (entered moving right); end caps face right.
          const capX = dx > 0 ? this.capSX[i] : this.capEX[i];
          const capY = dx > 0 ? this.capSY[i] : this.capEY[i];
          const t = (capX - x0) / dx;
          if (t >= 0 && t <= 1 && t < bestT && y0 + dy * t >= capY) {
            bestT = t;
            kind = 'ground';
            index = -1;
            nx = dx > 0 ? -1 : 1;
            ny = 0;
          }
        }
      }
      // Solid rects (slab test; also gives the entry face).
      const sl = this.sCols[c];
      for (let k = 0; k < sl.length; k++) {
        const s = this.solids[sl[k]];
        const t = rayRectEntry(x0, y0, dx, dy, s.x, s.y, s.w, s.h, scratchNormal);
        if (t < 0 || t >= bestT) continue;
        bestT = t;
        kind = 'solid';
        index = sl[k];
        nx = scratchNormal.nx;
        ny = scratchNormal.ny;
      }
      // One-way platforms, only when crossing from above.
      if (platforms) {
        const pl = this.pCols[c];
        for (let k = 0; k < pl.length; k++) {
          const i = pl[k];
          const sx = this.px1[i] - this.px0[i];
          const sy = this.py1[i] - this.py0[i];
          if (sx * dy - sy * dx <= 0) continue; // not moving downward through the line
          const t = segT(x0, y0, dx, dy, this.px0[i], this.py0[i], this.px1[i], this.py1[i]);
          if (t < 0 || t >= bestT) continue;
          bestT = t;
          kind = 'platform';
          index = this.pLine[i];
          const len = Math.hypot(sx, sy) || 1;
          nx = sy / len;
          ny = -sx / len;
        }
      }
    }
    if (bestT === Infinity) return null;
    hit.t = bestT;
    hit.x = x0 + dx * bestT;
    hit.y = y0 + dy * bestT;
    hit.nx = nx;
    hit.ny = ny;
    hit.kind = kind;
    hit.index = index;
    return hit;
  }

  // ---------------------------------------------------------------------------- physics support

  /**
   * Ground wall crossed by a body's leading edge (used by physics.ts).
   * The edge moves from the body centre side toward `edgeTo` in direction `dir`. A wall is a
   * ground part higher than `stepY` that is reached through a rise steeper than `maxSlope`
   * (or a vertical step, or a polyline end cap). Only walls strictly between the body centre
   * `cx` and `edgeTo` count, so a body whose centre is already past a wall can still escape.
   * Returns the wall x nearest to the centre, or NaN.
   */
  groundWall(dir: 1 | -1, cx: number, edgeTo: number, stepY: number, maxSlope: number): number {
    const lo = dir > 0 ? cx : edgeTo;
    const hi = dir > 0 ? edgeTo : cx;
    if (!(hi > lo)) return NaN;
    let best = NaN;
    const c0 = this.clampCol(lo);
    const c1 = this.clampCol(hi);
    for (let c = c0; c <= c1; c++) {
      const gl = this.gCols[c];
      for (let k = 0; k < gl.length; k++) {
        const i = gl[k];
        const x0 = this.gx0[i];
        const x1 = this.gx1[i];
        if (x1 < lo || x0 > hi) continue;
        const y0 = this.gy0[i];
        const y1 = this.gy1[i];
        let wx: number;
        if (dir > 0) {
          // Rises to the right and is too steep to walk?
          if (!(y1 < y0) || y0 - y1 <= maxSlope * (x1 - x0)) continue;
          if (y1 >= stepY) continue; // top is within step-up reach
          wx = y0 <= stepY ? x0 : x0 + ((x1 - x0) * (y0 - stepY)) / (y0 - y1);
          if (wx > cx && wx < edgeTo && !(wx >= best)) best = wx;
        } else {
          if (!(y0 < y1) || y1 - y0 <= maxSlope * (x1 - x0)) continue;
          if (y0 >= stepY) continue;
          wx = y1 <= stepY ? x1 : x1 - ((x1 - x0) * (y1 - stepY)) / (y1 - y0);
          if (wx < cx && wx > edgeTo && !(wx <= best)) best = wx;
        }
      }
      const cl = this.capCols[c];
      for (let k = 0; k < cl.length; k++) {
        const i = cl[k];
        if (dir > 0) {
          const wx = this.capSX[i];
          if (this.capSY[i] < stepY && wx > cx && wx < edgeTo && !(wx >= best)) best = wx;
        } else {
          const wx = this.capEX[i];
          if (this.capEY[i] < stepY && wx < cx && wx > edgeTo && !(wx <= best)) best = wx;
        }
      }
    }
    return best;
  }

  /**
   * Solid-rect wall crossed by a body's leading edge (same rules as `groundWall`).
   * The body spans (headY, feetY) vertically; rects whose top is at or below `stepY` can be
   * stepped onto and do not block. Returns the wall x nearest to the centre, or NaN.
   */
  solidWall(dir: 1 | -1, cx: number, edgeTo: number, headY: number, feetY: number, stepY: number): number {
    const lo = dir > 0 ? cx : edgeTo;
    const hi = dir > 0 ? edgeTo : cx;
    if (!(hi > lo)) return NaN;
    let best = NaN;
    const c0 = this.clampCol(lo);
    const c1 = this.clampCol(hi);
    for (let c = c0; c <= c1; c++) {
      const sl = this.sCols[c];
      for (let k = 0; k < sl.length; k++) {
        const s = this.solids[sl[k]];
        if (!(s.y < feetY && s.y + s.h > headY)) continue; // no vertical overlap
        if (s.y >= stepY) continue; // low enough to step onto
        if (dir > 0) {
          const wx = s.x;
          if (wx > cx && wx < edgeTo && !(wx >= best)) best = wx;
        } else {
          const wx = s.x + s.w;
          if (wx < cx && wx > edgeTo && !(wx <= best)) best = wx;
        }
      }
    }
    return best;
  }

  /**
   * For an x over a pit (where `groundY(x)` is Infinity): the pit's rims — the end point of the
   * ground to its left and the start point of the ground to its right — when the pit is at most
   * `maxWidth` wide. Returns false when x is not over such a narrow pit.
   */
  pitRims(x: number, maxWidth: number, out: { lx: number; ly: number; rx: number; ry: number }): boolean {
    let lx = -Infinity;
    let ly = 0;
    let rx = Infinity;
    let ry = 0;
    const c0 = this.clampCol(x - maxWidth);
    const c1 = this.clampCol(x + maxWidth);
    for (let c = c0; c <= c1; c++) {
      const cl = this.capCols[c];
      for (let k = 0; k < cl.length; k++) {
        const i = cl[k];
        const ex = this.capEX[i];
        if (ex <= x && ex > lx) {
          lx = ex;
          ly = this.capEY[i];
        }
        const sx = this.capSX[i];
        if (sx > x && sx < rx) {
          rx = sx;
          ry = this.capSY[i];
        }
      }
    }
    if (lx === -Infinity || rx === Infinity || rx - lx > maxWidth) return false;
    out.lx = lx;
    out.ly = ly;
    out.rx = rx;
    out.ry = ry;
    return true;
  }

  /** Does any solid rect overlap the open box (x0, x1) × (y0, y1)? */
  solidOverlaps(x0: number, y0: number, x1: number, y1: number): boolean {
    const c0 = this.clampCol(x0);
    const c1 = this.clampCol(x1);
    for (let c = c0; c <= c1; c++) {
      const sl = this.sCols[c];
      for (let k = 0; k < sl.length; k++) {
        const s = this.solids[sl[k]];
        if (x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y) return true;
      }
    }
    return false;
  }

  /**
   * Highest solid-rect top in [yFrom, yTo] among rects overlapping the open x-range (x0, x1).
   * Returns +Infinity if none. Sets `lastSolid`.
   */
  solidTopIn(x0: number, x1: number, yFrom: number, yTo: number): number {
    this.lastSolid = -1;
    let best = Infinity;
    const c0 = this.clampCol(x0);
    const c1 = this.clampCol(x1);
    for (let c = c0; c <= c1; c++) {
      const sl = this.sCols[c];
      for (let k = 0; k < sl.length; k++) {
        const s = this.solids[sl[k]];
        if (!(x0 < s.x + s.w && x1 > s.x)) continue;
        if (s.y >= yFrom && s.y <= yTo && s.y < best) {
          best = s.y;
          this.lastSolid = sl[k];
        }
      }
    }
    return best;
  }

  /**
   * Lowest solid-rect bottom in [yTo, yFrom] (yTo <= yFrom: searching upward) among rects
   * overlapping the open x-range (x0, x1). Returns -Infinity if none. Sets `lastSolid`.
   */
  solidBottomIn(x0: number, x1: number, yFrom: number, yTo: number): number {
    this.lastSolid = -1;
    let best = -Infinity;
    const c0 = this.clampCol(x0);
    const c1 = this.clampCol(x1);
    for (let c = c0; c <= c1; c++) {
      const sl = this.sCols[c];
      for (let k = 0; k < sl.length; k++) {
        const s = this.solids[sl[k]];
        if (!(x0 < s.x + s.w && x1 > s.x)) continue;
        const bottom = s.y + s.h;
        if (bottom <= yFrom && bottom >= yTo && bottom > best) {
          best = bottom;
          this.lastSolid = sl[k];
        }
      }
    }
    return best;
  }
}

const scratchHit = makeRayHit();
const scratchNormal = { nx: 0, ny: 0 };

/**
 * Ray (x0,y0)+t*(dx,dy), t in [0,1], against a rect. Returns the entry t (0 if the start is
 * inside) or -1. A ray that only touches an edge, or starts on an edge moving away, misses.
 * The entry face normal is written to `normal` when given ((0, 0) for a start inside).
 */
export function rayRectEntry(
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  normal?: { nx: number; ny: number },
): number {
  let tMin = 0;
  let tMax = 1;
  let nx = 0;
  let ny = 0;
  if (dx === 0) {
    if (x0 < rx || x0 >= rx + rw) return -1;
  } else {
    const inv = 1 / dx;
    let t0 = (rx - x0) * inv;
    let t1 = (rx + rw - x0) * inv;
    let n = -1;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
      n = 1;
    }
    if (t0 >= tMin) {
      tMin = t0;
      nx = n;
      ny = 0;
    }
    if (t1 < tMax) tMax = t1;
    if (tMin >= tMax) return -1;
  }
  if (dy === 0) {
    if (y0 < ry || y0 >= ry + rh) return -1;
  } else {
    const inv = 1 / dy;
    let t0 = (ry - y0) * inv;
    let t1 = (ry + rh - y0) * inv;
    let n = -1;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
      n = 1;
    }
    if (t0 >= tMin) {
      tMin = t0;
      nx = 0;
      ny = n;
    }
    if (t1 < tMax) tMax = t1;
    if (tMin >= tMax) return -1;
  }
  if (normal) {
    normal.nx = nx;
    normal.ny = ny;
  }
  return tMin;
}
