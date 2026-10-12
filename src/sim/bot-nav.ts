/**
 * Navigation helpers shared by the bot modes (src/sim/bot.ts): standable ledges (terrain
 * platforms, solid tops and dynamic solids such as cable cars and moving platforms), floor
 * probes that see dynamic solids, deadly-hazard checks and ballistic predictions (there is no
 * air drag, so a jump's landing follows from the current velocity alone).
 *
 * Everything here is allocation-free per tick: scratch objects are reused.
 */
import type { SolidBox } from '../engine/physics';
import type { Terrain } from '../engine/terrain';
import type { World } from '../engine/world';

/** A standable surface: a one-way platform segment, the top of a solid rect or a dynamic solid. */
export interface Ledge {
  x0: number;
  x1: number;
  y: number;
  oneWay: boolean;
  /** The dynamic solid behind this ledge (null for terrain). */
  box: SolidBox | null;
}

const ledgeCache = new WeakMap<Terrain, Ledge[]>();

/** Platform segments and solid tops of a terrain (computed once per section). */
export function terrainLedges(t: Terrain): Ledge[] {
  let list = ledgeCache.get(t);
  if (list) return list;
  list = [];
  for (const line of t.def.platforms) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [x0, y0] = line[i];
      const [x1, y1] = line[i + 1];
      list.push({ x0, x1, y: Math.min(y0, y1), oneWay: true, box: null });
    }
  }
  for (const s of t.def.solids) list.push({ x0: s.x, x1: s.x + s.w, y: s.y, oneWay: false, box: null });
  ledgeCache.set(t, list);
  return list;
}

/**
 * The standable dynamic solids of a world right now (cable cars, lifts, floats, bridges), as
 * ledges in `out` (pooled: the array and its objects are reused). Boxes owned by `skipOwner`
 * (the bot's own vehicle) are left out. Returns the count.
 */
export function dynamicLedges(world: World, out: Ledge[], skipOwner: object | null = null): number {
  let n = 0;
  const solids = world.solids;
  for (let i = 0; i < solids.length; i++) {
    const b = solids[i];
    if (!b.enabled || b.owner === skipOwner || b.w < 12) continue;
    const l = out[n] ?? (out[n] = { x0: 0, x1: 0, y: 0, oneWay: true, box: null });
    l.x0 = b.x;
    l.x1 = b.x + b.w;
    l.y = b.y;
    l.oneWay = b.oneWay;
    l.box = b;
    n++;
  }
  return n;
}

/** The top of a standable dynamic solid at x with y in [yFrom, yTo] (+Infinity if none). */
export function boxTopAt(world: World, x: number, yFrom: number, yTo: number, skipOwner: object | null = null): number {
  let best = Infinity;
  const solids = world.solids;
  for (let i = 0; i < solids.length; i++) {
    const b = solids[i];
    if (!b.enabled || b.owner === skipOwner || x < b.x || x >= b.x + b.w) continue;
    if (b.y >= yFrom && b.y <= yTo && b.y < best) best = b.y;
  }
  return best;
}

/** First floor at x with y in [yFrom, yTo]: terrain (ground, platforms, solids) or a dynamic solid. */
export function floorAt(world: World, x: number, yFrom: number, yTo: number, skipOwner: object | null = null): number {
  const t = world.terrain.surfaceY(x, yFrom, yTo);
  const b = world.solids.length > 0 ? boxTopAt(world, x, yFrom, yTo, skipOwner) : Infinity;
  return t < b ? t : b;
}

const probe = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Is there a hazard at (x, feet y) that kills? Pits, spikes, kill zones and lava always; water
 * only when `deepWaterKills` (a player on foot drowns where the surface is above his head) and
 * the water is deeper than `wadeDepth` there (the ground under the surface).
 */
export function deadlyAt(world: World, x: number, y: number, h: number, deepWaterKills: boolean, wadeDepth = 26): boolean {
  const t = world.terrain;
  if (t.hazards.length === 0) return false;
  probe.x = x - 4;
  probe.y = y - 4;
  probe.w = 8;
  probe.h = h;
  for (let i = 0; i < t.hazards.length; i++) {
    const hz = t.hazards[i];
    if (probe.x >= hz.x + hz.w || probe.x + probe.w <= hz.x || probe.y >= hz.y + hz.h || probe.y + probe.h <= hz.y) continue;
    if (hz.kind !== 'water') return true;
    if (!deepWaterKills) continue;
    // Deep water: no floor within wading depth under the surface.
    const floor = t.surfaceY(x, hz.y - 2, hz.y + wadeDepth);
    if (!Number.isFinite(floor)) return true;
  }
  return false;
}

/** Is x over water (any 'water' hazard column)? */
export function waterAt(world: World, x: number, y0: number, y1: number): boolean {
  const hs = world.terrain.hazards;
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    if (h.kind === 'water' && x >= h.x && x < h.x + h.w && h.y < y1 && h.y + h.h > y0) return true;
  }
  return false;
}

/** Where a ballistic fall lands: the surface crossed while falling (terrain or a moving box). */
export interface Landing {
  /** True when a surface was found before the fall left the section. */
  ok: boolean;
  x: number;
  y: number;
  /** Ticks until the landing. */
  t: number;
  /** The dynamic solid landed on (null: terrain). */
  box: SolidBox | null;
}

/**
 * Follow (x, y, vx, vy) under gravity `g` (terminal fall `maxFall`, constant vx: no air drag)
 * and report the first surface crossed while falling. Dynamic solids are moved along by their
 * last per-tick motion (`dx`, `dy`). `minFallTicks`: surfaces crossed before this many ticks are
 * ignored (so a body standing on a floor does not "land" where it stands). Solid walls in the
 * way are ignored (callers probe walls themselves).
 */
export function predictLanding(
  world: World,
  x: number,
  y: number,
  vx: number,
  vy: number,
  g: number,
  maxFall: number,
  out: Landing,
  skipOwner: object | null = null,
  maxTicks = 240,
): Landing {
  const t = world.terrain;
  const bottom = t.bounds.y + t.bounds.h + 64;
  const solids = world.solids;
  out.ok = false;
  out.box = null;
  for (let k = 1; k <= maxTicks; k++) {
    vy = Math.min(vy + g, maxFall);
    const ny = y + vy;
    x += vx;
    if (vy > 0) {
      let best = t.surfaceY(x, y, ny);
      let box: SolidBox | null = null;
      for (let i = 0; i < solids.length; i++) {
        const b = solids[i];
        if (!b.enabled || b.owner === skipOwner || b.w < 12) continue;
        // dx / dy are the last moveSolid step: a ride that waits or has arrived stands still.
        const still = isRideOwner(b.owner) && (b.owner as { state?: unknown }).state !== 'move';
        const bx = still ? b.x : b.x + b.dx * k;
        const by = still ? b.y : b.y + b.dy * k;
        if (x < bx || x >= bx + b.w) continue;
        if (by >= y - Math.max(0, b.dy) && by <= ny + Math.max(0, -b.dy) && by < best) {
          best = by;
          box = b;
        }
      }
      if (Number.isFinite(best)) {
        out.ok = true;
        out.x = x;
        out.y = best;
        out.t = k;
        out.box = box;
        return out;
      }
    }
    y = ny;
    if (y > bottom) break;
  }
  out.x = x;
  out.y = y;
  out.t = maxTicks;
  return out;
}

/** The mover fields the steering needs (players and vehicles). */
export interface Flyer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  body: { gravity: number; maxFall: number } | null;
}

/**
 * Air steering onto the span [lo, hi] at height y: where does the current drift (no air drag,
 * constant vx) come down through y? Push toward the span when that landing misses it, else let
 * go. Gravity and terminal fall come from the body (or `g` / `maxFall`). Returns −1, 0 or 1.
 */
export function steerOnto(p: Flyer, y: number, lo: number, hi: number, g = 0, maxFall = 0): number {
  const gr = g > 0 ? g : p.body && p.body.gravity > 0 ? p.body.gravity : 0.13;
  const mf = maxFall > 0 ? maxFall : p.body && p.body.maxFall > 0 ? p.body.maxFall : 4;
  let x = p.x;
  let py = p.y;
  let vy = p.vy;
  let land = x;
  for (let t = 0; t < 240; t++) {
    vy = Math.min(vy + gr, mf);
    const ny = py + vy;
    x += p.vx;
    land = x;
    if (vy > 0 && py <= y && ny >= y) break;
    py = ny;
    if (py > y + 400) break;
  }
  if (land > hi) return -1;
  if (land < lo) return 1;
  return 0;
}

/** Distance (px, up to `max`) to the end of the floor under (x, feet y) in direction `dir`. */
export function edgeDistance(world: World, x: number, y: number, dir: number, max = 64, skipOwner: object | null = null): number {
  for (let d = 2; d <= max; d += 2) {
    if (!Number.isFinite(floorAt(world, x + dir * d, y - 3, y + 3, skipOwner))) return d;
  }
  return max;
}

/** The path end of a cable car (or any owner with a flat `path` of points), else null. */
export function pathEnd(owner: unknown, out: { x: number; y: number }): { x: number; y: number } | null {
  const o = owner as { path?: unknown; state?: unknown } | null;
  if (!o || !Array.isArray(o.path) || o.path.length < 4) return null;
  const path = o.path as number[];
  out.x = path[path.length - 2];
  out.y = path[path.length - 1];
  return out;
}

function isRideOwner(o: unknown): boolean {
  return !!o && Array.isArray((o as { path?: unknown }).path);
}

/** Is this dynamic solid a ride (a cable car / lift that still has a way to go)? */
export function isRide(box: SolidBox | null): boolean {
  if (!box) return false;
  const o = box.owner as { state?: unknown; path?: unknown } | null;
  return !!o && Array.isArray(o.path) && (o.state === 'wait' || o.state === 'move');
}
