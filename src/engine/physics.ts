/**
 * Platformer physics (docs/ARCHITECTURE.md §5.9).
 *
 * A mover (usually an Entity) owns its position and velocity (`x, y, vx, vy`) and a `Body` that
 * holds the collision size, the settings and the contact state. The anchor is the FEET CENTRE:
 * the collision box spans [x - w/2, x + w/2] × [y - h, y].
 *
 * Collision model
 * - Ground and one-way platforms are lines followed by the feet centre, so a body stands
 *   exactly on slopes (no hopping going down, no sinking going up).
 * - Solid rects and dynamic solids are boxes: the whole body width can stand on them.
 * - Walls: ground parts reached through a rise steeper than `maxSlope` (and polyline ends),
 *   and the sides of rects / dynamic solids. Obstacles whose top is within `stepUp` of the
 *   feet are stepped onto instead — but only as far as the head has room to rise.
 * - Landing happens only when moving down onto a surface (or when it is at most `stepUp`
 *   above the feet). One-way platforms are ignored while moving up and while dropping through.
 * - A pit narrower than the body (rims within `stepUp` of each other) is rolled over.
 * - Motion is split into sub-steps of at most SUB_STEP px, and every test is a crossing test,
 *   so even 16 px/tick never tunnels. After each sub-step the body must fit (feet not below
 *   the ground, nothing solid above the step zone); otherwise its horizontal part is undone.
 *   tests/engine/physics-fuzz.test.ts checks these rules on random terrain.
 * - Dynamic solids (`SolidBox`, registered with the World) block like rects, carry the bodies
 *   standing on them and push (or crush) bodies when moved with `moveSolid`.
 */
import type { Terrain, RayHit } from './terrain';
import { makeRayHit, rayRectEntry } from './terrain';

// ---------------------------------------------------------------------------------------------
// Defaults & types
// ---------------------------------------------------------------------------------------------

export interface PhysicsDefaults {
  /** px/tick² */
  gravity: number;
  /** Terminal fall speed, px/tick. */
  maxFall: number;
  /** Obstacles up to this height (px) are stepped onto instead of blocking. */
  stepUp: number;
  /** Walking keeps contact with surfaces up to this far below (plus the slope drop). */
  snapDown: number;
  /** Steepest walkable slope (dy/dx). 1 = 45°. */
  maxSlope: number;
  /** One-way platforms are ignored for this many ticks after `dropThrough`. */
  dropThroughTicks: number;
}

/**
 * Defaults copied into every new Body. The game applies src/game/tuning.ts once at boot via
 * `setPhysicsDefaults(TUNING.physics)` (see `applyTuning()` there).
 */
export const physicsDefaults: PhysicsDefaults = {
  gravity: 0.13,
  maxFall: 4,
  stepUp: 4,
  snapDown: 4,
  maxSlope: 1,
  dropThroughTicks: 12,
};

export function setPhysicsDefaults(p: Partial<PhysicsDefaults>): void {
  for (const k of Object.keys(p) as (keyof PhysicsDefaults)[]) {
    const v = p[k];
    if (typeof v === 'number' && Number.isFinite(v)) physicsDefaults[k] = v;
  }
}

/** Largest distance moved per collision sub-step (px). */
export const SUB_STEP = 2;
/** Bounces slower than this (px/tick) settle instead. */
export const BOUNCE_MIN = 0.6;

/** What a body stands on. */
export const SUPPORT_NONE = 0;
export const SUPPORT_GROUND = 1;
export const SUPPORT_PLATFORM = 2;
export const SUPPORT_SOLID = 3;
export const SUPPORT_DYNAMIC = 4;
export type SupportKind = 0 | 1 | 2 | 3 | 4;

/** Contact flags of the last `moveBody` call (one object per body, reused). */
export interface Contact {
  /** Touched down this tick. */
  landed: boolean;
  hitWall: boolean;
  /** Side of the wall that was hit: 1 right, -1 left, 0 none. */
  wallDir: -1 | 0 | 1;
  hitCeiling: boolean;
  /** On a surface after the move. */
  onGround: boolean;
  /** Walked off a ledge this tick (was grounded, now airborne, without jumping). */
  leftGround: boolean;
  /** Bounced off a floor or wall this tick (bodies with `bounce > 0`). */
  bounced: boolean;
}

export interface BodyOptions extends Partial<PhysicsDefaults> {
  /** Collision width (px), centred on the anchor. */
  w: number;
  /** Collision height (px), upward from the feet. */
  h: number;
  /** Stand on one-way platforms (default true). */
  platforms?: boolean;
  /** Collide with terrain at all (default true; false = only gravity and velocity). */
  collide?: boolean;
  /** Restitution on floors, walls and ceilings (default 0 = no bounce). */
  bounce?: number;
  /** vx multiplier per grounded tick (default 1 = no friction). */
  groundFriction?: number;
}

/** Physics settings and contact state of one mover. Position and velocity live on the mover. */
export class Body {
  w: number;
  h: number;
  gravity: number;
  maxFall: number;
  stepUp: number;
  snapDown: number;
  maxSlope: number;
  dropThroughTicks: number;
  platforms: boolean;
  collide: boolean;
  bounce: number;
  groundFriction: number;

  // ---- state (read freely; written by the physics functions) ----
  onGround = false;
  /** What the body stands on (SUPPORT_*). */
  support: SupportKind = SUPPORT_NONE;
  /** Platform polyline index or solid rect index of the support (-1 otherwise). */
  supportIndex = -1;
  /** The dynamic solid the body stands on (it carries the body when it moves). */
  supportSolid: SolidBox | null = null;
  /** Slope dy/dx under the feet (0 in the air). */
  slope = 0;
  /** Ticks left during which one-way platforms at or above `dropY` are ignored. */
  dropTimer = 0;
  dropY = 0;
  /**
   * The platform polyline (or one-way dynamic box) the body dropped through: ignored until the
   * body lands again, so running down a sloped platform never lands on it again (-1 / null = none).
   */
  dropLine = -1;
  dropSolid: SolidBox | null = null;
  /** Ticks since the body last stood on something (0 while grounded) — for coyote time. */
  ticksSinceGrounded = 0;
  readonly contact: Contact = {
    landed: false,
    hitWall: false,
    wallDir: 0,
    hitCeiling: false,
    onGround: false,
    leftGround: false,
    bounced: false,
  };
  /** @internal marker used by moveSolid. */
  carryStamp = 0;

  constructor(o: BodyOptions) {
    const d = physicsDefaults;
    this.w = o.w;
    this.h = o.h;
    this.gravity = o.gravity ?? d.gravity;
    this.maxFall = o.maxFall ?? d.maxFall;
    this.stepUp = o.stepUp ?? d.stepUp;
    this.snapDown = o.snapDown ?? d.snapDown;
    this.maxSlope = o.maxSlope ?? d.maxSlope;
    this.dropThroughTicks = o.dropThroughTicks ?? d.dropThroughTicks;
    this.platforms = o.platforms ?? true;
    this.collide = o.collide ?? true;
    this.bounce = o.bounce ?? 0;
    this.groundFriction = o.groundFriction ?? 1;
  }

  /** Stands on a one-way surface (so `dropThrough` would work). */
  get onOneWay(): boolean {
    return (
      this.onGround &&
      (this.support === SUPPORT_PLATFORM || (this.support === SUPPORT_DYNAMIC && !!this.supportSolid?.oneWay))
    );
  }
}

/**
 * A dynamic solid: an axis-aligned box that blocks bodies (or, with `oneWay`, only supports
 * them from above like a platform). Register it with `world.addSolid(box)` and move it with
 * `world.moveSolid(box, dx, dy)` so that riders are carried and bodies are pushed.
 */
export class SolidBox {
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay: boolean;
  enabled = true;
  /** Usually the entity that owns the box (the world removes the box with its owner). */
  owner: object | null;
  /** Movement applied by the last moveSolid call. */
  dx = 0;
  dy = 0;

  constructor(x: number, y: number, w: number, h: number, oneWay = false, owner: object | null = null) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.oneWay = oneWay;
    this.owner = owner;
  }
}

/** Something physics can move. Entities implement this. */
export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
  body: Body | null;
  removed?: boolean;
  /** Called when a dynamic solid squeezes the mover against terrain. */
  onCrushed?(by: SolidBox): void;
}

/** Dynamic-solid source; the World implements it. */
export interface PhysicsEnv {
  readonly solids: readonly SolidBox[];
}

// ---------------------------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------------------------

/** Results of the last findSupport (module scratch, no allocation). */
let supKind: SupportKind = SUPPORT_NONE;
let supIndex = -1;
let supSolid: SolidBox | null = null;
let supSlope = 0;

/** One-way surfaces at or above dropY + this are ignored while dropping through. */
const DROP_MARGIN = 2;
/** Largest distance (px) a wall check pushes an overlapping body back out. */
const MAX_PUSH_OUT = 3;
/** Geometric tolerance (px) for touching / floating-point noise. */
const EPS = 1e-6;
const rims = { lx: 0, ly: 0, rx: 0, ry: 0 };

function bodyOf(m: Mover): Body {
  const b = m.body;
  if (!b) throw new Error('physics: this mover has no body (set `this.body = new Body({ w, h })`)');
  return b;
}

/**
 * Highest surface whose top is in [yTop, yBottom] under the body at its current x.
 * Ground counts at any height above yBottom (below a ground line is always solid, so a body
 * found inside ground is pushed back up). Returns +Infinity when there is none.
 */
function findSupport(
  m: Mover,
  b: Body,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  yTop: number,
  yBottom: number,
  exclude: SolidBox | null,
): number {
  const x = m.x;
  const half = b.w / 2;
  let best = Infinity;
  supKind = SUPPORT_NONE;
  supIndex = -1;
  supSolid = null;
  supSlope = 0;

  let g = terrain.groundY(x);
  // Over a pit narrower than the body (rims within step height of each other): rest on the
  // higher rim, so wide bodies roll over cracks instead of sinking into them.
  if (g === Infinity && terrain.pitRims(x, b.w - 2, rims) && Math.abs(rims.ly - rims.ry) <= b.stepUp) {
    g = rims.ly < rims.ry ? rims.ly : rims.ry;
  }
  if (g <= yBottom) {
    best = g;
    supKind = SUPPORT_GROUND;
  }
  // One-way surfaces: while dropping, only those clearly below the drop height count.
  const oneWayOk = b.platforms;
  const oneWayTop = b.dropTimer > 0 ? Math.max(yTop, b.dropY + DROP_MARGIN) : yTop;
  if (oneWayOk && oneWayTop <= yBottom) {
    const p = terrain.platformY(x, oneWayTop, yBottom, b.dropLine);
    if (p < best) {
      best = p;
      supKind = SUPPORT_PLATFORM;
      supIndex = terrain.lastPlatform;
      supSlope = terrain.platformSlope(terrain.lastPlatformSeg);
    }
  }
  const s = terrain.solidTopIn(x - half, x + half, yTop, yBottom);
  if (s < best) {
    best = s;
    supKind = SUPPORT_SOLID;
    supIndex = terrain.lastSolid;
    supSlope = 0;
  }
  if (env) {
    const list = env.solids;
    for (let i = 0; i < list.length; i++) {
      const box = list[i];
      if (!box.enabled || box === exclude || box.owner === m) continue;
      if (!(x - half < box.x + box.w && x + half > box.x)) continue;
      const top = box.y;
      if (box.oneWay) {
        if (!oneWayOk || box === b.dropSolid || top < oneWayTop || top > yBottom) continue;
      } else if (top < yTop || top > yBottom) continue;
      if (top < best) {
        best = top;
        supKind = SUPPORT_DYNAMIC;
        supIndex = -1;
        supSolid = box;
        supSlope = 0;
      }
    }
  }
  if (supKind === SUPPORT_GROUND) supSlope = terrain.groundSlope(x);
  return best;
}

/** Lowest ceiling (rect / dynamic solid bottom) crossed by the head moving up from headFrom to headTo. */
function findCeiling(
  m: Mover,
  b: Body,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  headFrom: number,
  headTo: number,
  exclude: SolidBox | null,
  spanTo = m.x,
): number {
  // Checks the body's x-span, widened to also cover a body centre at `spanTo`.
  const half = b.w / 2;
  const x0 = Math.min(m.x, spanTo) - half;
  const x1 = Math.max(m.x, spanTo) + half;
  let best = terrain.solidBottomIn(x0, x1, headFrom, headTo);
  if (env) {
    const list = env.solids;
    for (let i = 0; i < list.length; i++) {
      const box = list[i];
      if (!box.enabled || box.oneWay || box === exclude || box.owner === m) continue;
      if (!(x0 < box.x + box.w && x1 > box.x)) continue;
      const bottom = box.y + box.h;
      if (bottom <= headFrom && bottom >= headTo && bottom > best) best = bottom;
    }
  }
  return best;
}

/** Nearest wall crossed by the leading edge moving to `edgeTo` (NaN if none). */
function findWall(
  m: Mover,
  b: Body,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  dir: 1 | -1,
  edgeTo: number,
  exclude: SolidBox | null,
): number {
  const feet = m.y;
  const head = feet - b.h;
  // Obstacles can be stepped onto only as far as the head has room to rise (a low ceiling over
  // a step turns the step into a wall).
  let rise = b.stepUp;
  const ceil = findCeiling(m, b, terrain, env, head + EPS, head - rise, exclude, edgeTo - dir * (b.w / 2));
  if (ceil !== -Infinity) rise = Math.max(0, head - ceil);
  const stepY = feet - rise;
  let best = terrain.groundWall(dir, m.x, edgeTo, stepY, b.maxSlope);
  const s = terrain.solidWall(dir, m.x, edgeTo, head, feet, stepY);
  if (s === s && !(dir > 0 ? best <= s : best >= s)) best = s;
  if (env) {
    const list = env.solids;
    for (let i = 0; i < list.length; i++) {
      const box = list[i];
      if (!box.enabled || box.oneWay || box === exclude || box.owner === m) continue;
      if (!(box.y < feet && box.y + box.h > head)) continue; // no vertical overlap
      if (box.y >= stepY) continue; // low enough to step onto
      if (dir > 0) {
        const wx = box.x;
        if (wx > m.x && wx < edgeTo && !(wx >= best)) best = wx;
      } else {
        const wx = box.x + box.w;
        if (wx < m.x && wx > edgeTo && !(wx <= best)) best = wx;
      }
    }
  }
  return best;
}

function setSupport(b: Body): void {
  b.support = supKind;
  b.supportIndex = supIndex;
  b.supportSolid = supSolid;
  b.slope = supSlope;
}

function clearSupport(b: Body): void {
  b.support = SUPPORT_NONE;
  b.supportIndex = -1;
  b.supportSolid = null;
  b.slope = 0;
}

/** Horizontal sub-step with wall checks. Returns true when a wall stopped the move. */
function stepX(
  m: Mover,
  b: Body,
  sx: number,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  exclude: SolidBox | null,
): boolean {
  const dir = sx > 0 ? 1 : -1;
  const half = b.w / 2;
  const nx = m.x + sx;
  const wall = findWall(m, b, terrain, env, dir, nx + dir * half, exclude);
  if (wall === wall) {
    // Stop with the edge on the wall. A slight overlap is pushed out; a deep one (something
    // else put the body there) is left alone instead of teleporting the body.
    const target = wall - dir * half;
    if ((target - m.x) * dir >= -MAX_PUSH_OUT) m.x = target;
    return true;
  }
  m.x = nx;
  return false;
}

/**
 * findSupport, but a surface above the feet only counts when the head has room to rise there
 * (otherwise only surfaces at or below the feet are considered).
 */
function supportWithRoom(
  m: Mover,
  b: Body,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  yTop: number,
  yBottom: number,
  exclude: SolidBox | null,
): number {
  let y = findSupport(m, b, terrain, env, yTop, yBottom, exclude);
  if (y < m.y - EPS) {
    const head = m.y - b.h;
    if (findCeiling(m, b, terrain, env, head + EPS, y - b.h, exclude) !== -Infinity) {
      y = findSupport(m, b, terrain, env, m.y - EPS, yBottom, exclude);
      if (y < m.y - EPS) y = Infinity; // only ground far above: squeezed, no support
    }
  }
  return y;
}

/** Keep a grounded body on its surface after a horizontal sub-step of |dx| = adx. */
function followGround(
  m: Mover,
  b: Body,
  adx: number,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  exclude: SolidBox | null,
): boolean {
  const slack = adx * b.maxSlope;
  const y = supportWithRoom(m, b, terrain, env, m.y - b.stepUp - slack, m.y + b.snapDown + slack, exclude);
  if (y === Infinity) {
    b.onGround = false;
    clearSupport(b);
    return false;
  }
  m.y = y;
  setSupport(b);
  return true;
}

function wallHit(m: Mover, b: Body, c: Contact, dir: 1 | -1): void {
  c.hitWall = true;
  c.wallDir = dir;
  if (b.bounce > 0 && Math.abs(m.vx) > BOUNCE_MIN) {
    m.vx = -m.vx * b.bounce;
    c.bounced = true;
  } else m.vx = 0;
}

/**
 * Is there room for the body at its position? The feet must not be below the ground and no
 * solid rect / dynamic solid may overlap the body above its step-up zone.
 */
function fits(
  m: Mover,
  b: Body,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  exclude: SolidBox | null = null,
): boolean {
  if (m.y > terrain.groundY(m.x) + EPS) return false;
  // The tested box is shrunk by EPS so touching and float noise do not count as overlap.
  const half = b.w / 2 - EPS;
  const x0 = m.x - half;
  const x1 = m.x + half;
  const top = m.y - b.h + EPS;
  const low = m.y - b.stepUp - EPS;
  if (terrain.solidOverlaps(x0, top, x1, low)) return false;
  if (env) {
    const list = env.solids;
    for (let i = 0; i < list.length; i++) {
      const box = list[i];
      if (!box.enabled || box.oneWay || box === exclude || box.owner === m) continue;
      if (x0 < box.x + box.w && x1 > box.x && top < box.y + box.h && low > box.y) return false;
    }
  }
  return true;
}

/** Does a solid rect or dynamic solid overlap the top pixel of the body (the head is inside it)? */
function headInSolid(m: Mover, b: Body, terrain: Terrain, env: PhysicsEnv | null | undefined): boolean {
  const half = b.w / 2 - EPS;
  const x0 = m.x - half;
  const x1 = m.x + half;
  const top = m.y - b.h + EPS;
  const low = top + 1;
  if (terrain.solidOverlaps(x0, top, x1, low)) return true;
  if (env) {
    const list = env.solids;
    for (let i = 0; i < list.length; i++) {
      const box = list[i];
      if (!box.enabled || box.oneWay || box.owner === m) continue;
      if (x0 < box.x + box.w && x1 > box.x && top < box.y + box.h && low > box.y) return true;
    }
  }
  return false;
}

/** Vertical part of a sub-step. Returns the vertical step to use for the next sub-steps. */
function stepY(
  m: Mover,
  b: Body,
  adx: number,
  sy: number,
  terrain: Terrain,
  env: PhysicsEnv | null | undefined,
  c: Contact,
): number {
  if (b.onGround) {
    if (!followGround(m, b, adx, terrain, env, null)) c.leftGround = true;
    return sy;
  }
  if (sy >= 0) {
    // Falling (or level): land on the first surface crossed, or one just above the feet when
    // the head has room to go up there.
    const y = supportWithRoom(m, b, terrain, env, m.y - b.stepUp - adx * b.maxSlope, m.y + sy, null);
    if (y === Infinity) {
      m.y += sy;
      return sy;
    }
    m.y = y;
    if (b.bounce > 0 && m.vy > BOUNCE_MIN) {
      m.vy = -m.vy * b.bounce;
      c.bounced = true;
    } else {
      m.vy = 0;
      b.onGround = true;
      c.landed = true;
      setSupport(b);
      b.dropLine = -1;
      b.dropSolid = null;
    }
    return 0;
  }
  // Rising: stop at ceilings; never end a sub-step inside ground (jumping along a slope).
  const head = m.y - b.h;
  if (headInSolid(m, b, terrain, env)) {
    // Something already overlaps the head (it was put there): never rise further into it.
    c.hitCeiling = true;
    m.vy = 0;
    return 0;
  }
  const ceil = findCeiling(m, b, terrain, env, head + EPS, head + sy, null);
  if (ceil !== -Infinity) {
    m.y = ceil + b.h;
    c.hitCeiling = true;
    if (b.bounce > 0 && -m.vy > BOUNCE_MIN) {
      m.vy = -m.vy * b.bounce;
      c.bounced = true;
    } else m.vy = 0;
    return 0;
  }
  m.y += sy;
  const g = terrain.groundY(m.x);
  if (m.y > g) m.y = g;
  return sy;
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

/**
 * Advance a mover by one tick: gravity, velocity, terrain and dynamic-solid collisions.
 * Returns the body's contact flags (the same object every call).
 *
 * Jump by setting `vy < 0` (or calling `jump`) before the call; walk by setting `vx`.
 */
export function moveBody(m: Mover, terrain: Terrain, env?: PhysicsEnv | null): Contact {
  const b = bodyOf(m);
  const c = b.contact;
  c.landed = false;
  c.hitWall = false;
  c.wallDir = 0;
  c.hitCeiling = false;
  c.leftGround = false;
  c.bounced = false;
  if (b.dropTimer > 0) b.dropTimer--;

  // Leaving the ground by jumping.
  if (b.onGround && m.vy < 0) {
    b.onGround = false;
    clearSupport(b);
  }
  // Semi-implicit Euler: velocity first, then position.
  if (b.onGround) {
    m.vy = 0;
    if (b.groundFriction !== 1) m.vx *= b.groundFriction;
  } else {
    m.vy += b.gravity;
    if (m.vy > b.maxFall) m.vy = b.maxFall;
  }

  if (!b.collide) {
    m.x += m.vx;
    m.y += m.vy;
    b.onGround = false;
    clearSupport(b);
    b.ticksSinceGrounded++;
    c.onGround = false;
    return c;
  }

  const n = Math.max(1, Math.ceil(Math.max(Math.abs(m.vx), Math.abs(m.vy)) / SUB_STEP));
  let sx = m.vx / n;
  let sy = m.vy / n;
  for (let i = 0; i < n; i++) {
    // State before this sub-step, in case its horizontal part has to be undone.
    const ox = m.x;
    const oy = m.y;
    const ovy = m.vy;
    const wasGround = b.onGround;
    const sSupport = b.support;
    const sIndex = b.supportIndex;
    const sSolid = b.supportSolid;
    const sSlope = b.slope;
    const sLanded: boolean = c.landed;
    const sBounced: boolean = c.bounced;
    const sLeft: boolean = c.leftGround;
    const sCeiling: boolean = c.hitCeiling;
    const adx = Math.abs(sx);
    const dir = sx > 0 ? 1 : -1;
    const blocked = sx !== 0 && stepX(m, b, sx, terrain, env, null);
    if (blocked) {
      wallHit(m, b, c, dir);
      sx = 0;
    }
    const nsy = stepY(m, b, adx, sy, terrain, env, c);
    // The body must fit where it ended up (e.g. walking up a slope under a low ceiling, or
    // jumping sideways into a gap that is too narrow). If not, undo the horizontal part of this
    // sub-step and redo the vertical part in place.
    if (m.x !== ox && !fits(m, b, terrain, env)) {
      m.x = ox;
      m.y = oy;
      m.vy = ovy;
      b.onGround = wasGround;
      b.support = sSupport;
      b.supportIndex = sIndex;
      b.supportSolid = sSolid;
      b.slope = sSlope;
      c.landed = sLanded;
      c.bounced = sBounced;
      c.leftGround = sLeft;
      c.hitCeiling = sCeiling;
      if (!blocked) wallHit(m, b, c, dir);
      sx = 0;
      sy = stepY(m, b, 0, sy, terrain, env, c);
    } else sy = nsy;
  }

  if (b.onGround) b.ticksSinceGrounded = 0;
  else b.ticksSinceGrounded++;
  c.onGround = b.onGround;
  return c;
}

/** Start a jump: sets vy (negative = up) and leaves the ground. */
export function jump(m: Mover, vy: number): void {
  const b = bodyOf(m);
  m.vy = vy;
  if (vy < 0) {
    b.onGround = false;
    clearSupport(b);
  }
}

/**
 * Drop through the one-way platform the mover stands on (down + jump). Never drops through
 * ground or solid rects. Returns true when the drop started.
 */
export function dropThrough(m: Mover): boolean {
  const b = bodyOf(m);
  if (!b.onOneWay) return false;
  b.dropTimer = b.dropThroughTicks;
  b.dropY = m.y;
  // Ignore this very surface until the body lands again (sloped platforms run downhill with it).
  b.dropLine = b.support === SUPPORT_PLATFORM ? b.supportIndex : -1;
  b.dropSolid = b.support === SUPPORT_DYNAMIC ? b.supportSolid : null;
  b.onGround = false;
  clearSupport(b);
  if (m.vy < 0) m.vy = 0;
  return true;
}

/**
 * Put a mover on the surface below it (at most `maxDrop` px down, or up to `stepUp` above its
 * feet). Use after spawning. Returns true when it found ground.
 */
export function settle(m: Mover, terrain: Terrain, env?: PhysicsEnv | null, maxDrop = 256): boolean {
  const b = bodyOf(m);
  b.dropLine = -1;
  b.dropSolid = null;
  const y = findSupport(m, b, terrain, env, m.y - b.stepUp, m.y + maxDrop, null);
  if (y === Infinity) return false;
  m.y = y;
  m.vy = 0;
  b.onGround = true;
  b.ticksSinceGrounded = 0;
  setSupport(b);
  return true;
}

/**
 * Push a mover sideways by dx like walking, without gravity: it follows slopes and steps (so a
 * moving view edge can push a player up a slope), stops at walls and never ends inside terrain.
 * Returns true when the full distance was covered. Used for view-edge pushes.
 */
export function pushX(
  m: Mover,
  dx: number,
  terrain: Terrain,
  env?: PhysicsEnv | null,
  exclude: SolidBox | null = null,
): boolean {
  const b = bodyOf(m);
  if (dx === 0) return true;
  const n = Math.max(1, Math.ceil(Math.abs(dx) / SUB_STEP));
  const sx = dx / n;
  const adx = Math.abs(sx);
  for (let i = 0; i < n; i++) {
    const ox = m.x;
    const oy = m.y;
    if (stepX(m, b, sx, terrain, env, exclude)) return false;
    if (b.onGround) followGround(m, b, adx, terrain, env, exclude);
    else {
      // Airborne: may be lifted onto a rising slope by at most what walking would climb.
      const g = terrain.groundY(m.x);
      if (m.y > g && m.y - g <= adx * b.maxSlope + b.stepUp) m.y = g;
    }
    if (!fits(m, b, terrain, env, exclude)) {
      m.x = ox;
      m.y = oy;
      return false;
    }
  }
  return true;
}

/**
 * Move a mover by (dx, dy) without gravity, stopping at walls, ceilings and floors.
 * Returns true when the full distance was covered. Used for knock-backs, carrying and pushing.
 */
export function displace(
  m: Mover,
  dx: number,
  dy: number,
  terrain: Terrain,
  env?: PhysicsEnv | null,
  exclude: SolidBox | null = null,
): boolean {
  const b = bodyOf(m);
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / SUB_STEP));
  let sx = dx / n;
  let sy = dy / n;
  let ok = true;
  for (let i = 0; i < n; i++) {
    const ox = m.x;
    const oy = m.y;
    if (sx !== 0 && stepX(m, b, sx, terrain, env, exclude)) {
      ok = false;
      sx = 0;
    }
    if (sy < 0) {
      const head = m.y - b.h;
      const ceil = findCeiling(m, b, terrain, env, head + EPS, head + sy, exclude);
      if (ceil !== -Infinity) {
        m.y = ceil + b.h;
        ok = false;
        sy = 0;
      } else m.y += sy;
    } else if (sy > 0) {
      const y = findSupport(m, b, terrain, env, m.y, m.y + sy, exclude);
      if (y !== Infinity && y < m.y + sy) {
        m.y = y;
        ok = false;
        sy = 0;
      } else m.y += sy;
    }
    if (!fits(m, b, terrain, env, exclude)) {
      // No room here: stay at the last good spot.
      m.x = ox;
      m.y = oy;
      return false;
    }
  }
  return ok;
}

let carryStamp = 0;

/**
 * Move a dynamic solid and apply the consequences to the movers in `movers`:
 * - riders (grounded on the box) move with it (blocked by walls; squeezed into a ceiling → crushed),
 * - a solid box pushes bodies it runs into (squeezed against terrain → `onCrushed`),
 * - a box moving up catches bodies that it passes from below (one-way boxes too).
 * Movers without a body or with `removed` set are ignored.
 */
export function moveSolid(
  box: SolidBox,
  dx: number,
  dy: number,
  movers: readonly Mover[],
  terrain: Terrain,
  env?: PhysicsEnv | null,
): void {
  box.dx = dx;
  box.dy = dy;
  if (dx === 0 && dy === 0) return;
  const stamp = ++carryStamp;
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i];
    const b = m.body;
    if (!b || m.removed) continue;
    if (b.onGround && b.supportSolid === box) b.carryStamp = stamp;
  }
  const oldX = box.x;
  const oldY = box.y;
  box.x += dx;
  box.y += dy;
  if (!box.enabled) return;

  for (let i = 0; i < movers.length; i++) {
    const m = movers[i];
    const b = m.body;
    if (!b || m.removed || !b.collide || box.owner === m) continue;
    const half = b.w / 2;
    if (b.carryStamp === stamp) {
      // Rider: carried along. Walls block it, a ceiling squeezes it when going up, and other
      // floors stop it when going down (the box then sinks away under it).
      if (dx !== 0) displace(m, dx, 0, terrain, env, box);
      const onBox = m.x - half < box.x + box.w && m.x + half > box.x;
      if (dy < 0) {
        const head = m.y - b.h;
        const ceil = findCeiling(m, b, terrain, env, head + EPS, head + dy, box);
        if (ceil !== -Infinity) {
          m.y = ceil + b.h;
          m.onCrushed?.(box);
          continue;
        }
        if (onBox) m.y = box.y;
      } else if (dy > 0 && onBox) {
        if (!displace(m, 0, box.y - m.y, terrain, env, box)) followGround(m, b, 0, terrain, env, null);
      } else if (onBox) m.y = box.y;
      if (!onBox) {
        // Pushed off the edge by a wall: now airborne.
        b.onGround = false;
        clearSupport(b);
      }
      continue;
    }
    const left = m.x - half;
    const right = m.x + half;
    const top = m.y - b.h;
    const feet = m.y;
    const overlapX = left < box.x + box.w && right > box.x;
    if (!overlapX) continue;
    if (box.oneWay) {
      // A rising one-way box catches bodies whose feet it passed (if their head has room).
      if (
        dy < 0 &&
        m.vy >= 0 &&
        feet >= box.y &&
        feet <= oldY &&
        b.platforms &&
        !(b.dropTimer > 0) &&
        findCeiling(m, b, terrain, env, top + EPS, box.y - b.h, box) === -Infinity
      ) {
        m.y = box.y;
        m.vy = 0;
        b.onGround = true;
        b.support = SUPPORT_DYNAMIC;
        b.supportSolid = box;
        b.supportIndex = -1;
        b.slope = 0;
      }
      continue;
    }
    if (!(top < box.y + box.h && feet > box.y)) continue; // no overlap after the move
    const wasBeside = top < oldY + box.h && feet > oldY;
    const wasOverlapX = left < oldX + box.w && right > oldX;
    if (dx !== 0 && wasBeside && !wasOverlapX) {
      // Horizontal push.
      const target = dx > 0 ? box.x + box.w + half : box.x - half;
      if (!displace(m, target - m.x, 0, terrain, env, box)) m.onCrushed?.(box);
    } else if (dy > 0 && top >= oldY + box.h - 0.001) {
      // Pressed down from above.
      const target = box.y + box.h + b.h;
      if (!displace(m, 0, target - m.y, terrain, env, box)) m.onCrushed?.(box);
    } else if (dy < 0 && feet <= oldY + 0.001) {
      // Lifted from below: now standing on the box — unless a ceiling squeezes the body.
      const ceil = findCeiling(m, b, terrain, env, top + EPS, box.y - b.h, box);
      if (ceil !== -Infinity) {
        m.y = ceil + b.h;
        m.onCrushed?.(box);
        continue;
      }
      m.y = box.y;
      m.vy = 0;
      b.onGround = true;
      b.support = SUPPORT_DYNAMIC;
      b.supportSolid = box;
      b.supportIndex = -1;
      b.slope = 0;
    } else {
      // Was already inside (spawned in it, or several boxes at once): leave by the shortest way
      // (left, right or up).
      const outLeft = right - box.x;
      const outRight = box.x + box.w - left;
      const outUp = feet - box.y;
      let ok: boolean;
      if (outUp <= outLeft && outUp <= outRight) ok = displace(m, 0, -outUp, terrain, env, box);
      else if (outLeft <= outRight) ok = displace(m, -outLeft, 0, terrain, env, box);
      else ok = displace(m, outRight, 0, terrain, env, box);
      if (!ok) m.onCrushed?.(box);
    }
  }
}

/**
 * Projectile sweep: first hit of the segment (x0,y0)→(x1,y1) against ground, solid rects,
 * enabled dynamic solids and, with `platforms`, one-way platforms / boxes crossed from above.
 * Returns null when the path is clear.
 */
export function sweep(
  terrain: Terrain,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  platforms = false,
  env?: PhysicsEnv | null,
  out?: RayHit,
): RayHit | null {
  const hit = out ?? makeRayHit();
  const t = terrain.raycast(x0, y0, x1, y1, platforms, hit);
  let bestT = t ? t.t : Infinity;
  if (env) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const list = env.solids;
    for (let i = 0; i < list.length; i++) {
      const box = list[i];
      if (!box.enabled) continue;
      if (box.oneWay) {
        if (!platforms || !(dy > 0) || y0 > box.y) continue;
        const tt = (box.y - y0) / dy;
        if (tt < 0 || tt > 1 || tt >= bestT) continue;
        const hx = x0 + dx * tt;
        if (hx < box.x || hx >= box.x + box.w) continue;
        bestT = tt;
        hit.nx = 0;
        hit.ny = -1;
      } else {
        const tt = rayRectEntry(x0, y0, dx, dy, box.x, box.y, box.w, box.h, normalScratch);
        if (tt < 0 || tt >= bestT) continue;
        bestT = tt;
        hit.nx = normalScratch.nx;
        hit.ny = normalScratch.ny;
      }
      hit.kind = 'dynamic';
      hit.index = -1;
      hit.t = bestT;
      hit.x = x0 + dx * bestT;
      hit.y = y0 + dy * bestT;
    }
  }
  return bestT === Infinity ? null : hit;
}

const normalScratch = { nx: 0, ny: 0 };
