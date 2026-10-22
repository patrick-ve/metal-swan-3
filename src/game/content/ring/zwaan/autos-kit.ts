/**
 * TRAIN-2's shared kit for the ZWAAN train's car transporter, tanker and livestock trailer
 * (docs/design/ring.md §R.3; docs/api/ring.md "ZWAAN train: car transporter, tanker, livestock").
 * (The file sits under the `autos` prefix only because TRAIN-2 owns `autos*`, `tank*` and `vee*`.)
 *
 * ART (one density-generic drawer per strip: `PAL` at 1×, `PAL_HD` at 2× / 4×):
 * - `zwMats(c)`: the trailers' materials (the ZWAAN livery: white, the orange band, the rust-red
 *   line colour; steel, chrome, aluminium, tyres, lamps);
 * - `w5Hit` / `w5Width`: our own 5 × 5 block lettering (never a real hauler's face);
 * - `swanHit`: the ZWAAN swan mark (a swan in profile, our own drawing; no circle, no badge);
 * - `drawChassis`: a full trailer's running gear (beams, the rust-red side skirt with the line name
 *   and the mark, the mud guards over the rear bogie, the underrun guard, the rear lamp bar); the
 *   drawbar, the converter dolly, the wheels and the hitch are TRAIN-1's kit (kit.ts `drawZwaan*`).
 *
 * LOGIC:
 * - `ZwaanObstacle`: a road obstacle a part drops (a car off the transporter, a cow, a pig): a
 *   neutral `SolidBox` over its depth slab (it stops both teams' shots, only in its lane, like a
 *   civilian car; tags `ring-car`, `solid`, `cover`: the bots, the scooters and the cargo treat it
 *   as one), a wagon that drives into it pays a cell (`pushWagons`, a side touch ½), the shots that
 *   end on it are counted (`onShot`: the moo, the dent); `solid = false` while it is in the air.
 * - `freeLanes(world, part, tags)`: the open lanes without one of our obstacles / hazards on
 *   screen; `pickLanes` keeps at least one open lane free (spec §R.3: one lane always passable).
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { World } from '../../../../engine/world';
import type { HdCanvas } from '../../../art/hd';
import { hitSpark } from '../../../fx';
import { ringOf, RingEntity } from '../../../ring/entity';
import { LANE_COUNT, laneY, nearestLane } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { frac, hash2, Pen as PenC, type Pen } from '../boss/art-kit';
import type { Frame } from '../../../../engine/render';
import { BumpCooldown, pushWagons, type ContactRule } from '../gangs/kit';
import { mat, top, type Dn } from '../../stag/kit.art';
import { nearestWagon } from '../traffic/road-kit';

// =============================================================================================
// Art
// =============================================================================================

export interface ZwMats {
  white: number;
  orange: number;
  rust: number;
  rustIn: number;
  black: number;
  steel: number;
  chrome: number;
  alu: number;
  tyre: number;
  tail: number;
  amber: number;
  glass: number;
  well: number;
  plastic: number;
}

/** The ZWAAN train's materials at the canvas's density. */
export function zwMats(c: HdCanvas): ZwMats {
  return {
    white: mat(c, 'gable', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3, bounce: 0.3 }),
    orange: mat(c, 'orange', { spec: 0.8, shine: 40, lo1: 0, hi1: 3, lo: 1, hi: 5, rim: 0.3, bounce: 0.3 }),
    rust: mat(c, 'rust', { spec: 0.45, shine: 22, lo1: 0, hi1: 3, lo: 1, hi: 5, rim: 0.25, bounce: 0.3 }),
    rustIn: mat(c, 'rust', { spec: 0.1, shine: 10, lo1: 0, hi1: 1, lo: 0, hi: 2, amb: 0.2 }),
    black: mat(c, 'black', { spec: 0.7, shine: 34, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    steel: mat(c, 'steel', { spec: 0.9, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 }),
    chrome: mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 4, lo: 3, hi: 6, rim: 0.4 }),
    alu: mat(c, 'stone', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3 }),
    tyre: mat(c, 'black', { spec: 0.3, shine: 12, lo1: 0, hi1: 1, lo: 1, hi: 3 }),
    tail: mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 }),
    amber: mat(c, 'orange', { spec: 1, shine: 50, lo1: 0, hi1: 1, lo: 2, hi: 5 }),
    glass: mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 }),
    well: mat(c, 'black', { spec: 0, amb: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 }),
    plastic: mat(c, 'slate', { spec: 0.25, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
  };
}

/** Our own 5 × 5 block face (the line name, FRITUURVET, LEVEND VEE). */
const W5: Readonly<Record<string, readonly string[]>> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '11110', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  Z: ['11111', '00010', '00100', '01000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000'],
};

/** Logical width of `text` in the block face (bits of `s` px, one bit between letters). */
export function w5Width(text: string, s: number): number {
  return (text.length * 6 - 1) * s;
}

/** Is (px, py) on a bit of `text` set from its top-left (x, y) with bits of `s` × `sy` px? */
export function w5Hit(text: string, x: number, y: number, s: number, px: number, py: number, sy: number = s): boolean {
  const u = (px - x) / s;
  const v = (py - y) / sy;
  if (u < 0 || v < 0 || v >= 5) return false;
  const i = Math.floor(u / 6);
  const cu = Math.floor(u - i * 6);
  if (i >= text.length || cu >= 5) return false;
  const rows = W5[text[i]];
  return rows !== undefined && rows[Math.floor(v)][cu] === '1';
}

/** Distance from (px, py) to the segment a–b. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

const NECK: ReadonlyArray<readonly [number, number]> = [[8.4, -3.2], [9.3, -5.4], [8.7, -7.6], [9.1, -9.4], [9.9, -10.3]];

/**
 * The ZWAAN swan mark: a swan in profile facing right (body, raised wing, an S neck, the head and
 * the beak), set from its bottom-left (x, y) at `s` px per unit (about 12.6 × 11.6 units). Our own
 * drawing. Returns 1 on the swan, 2 on the beak, 0 off it.
 */
export function swanHit(x: number, y: number, s: number, px: number, py: number): 0 | 1 | 2 {
  const u = (px - x) / s;
  const v = (py - y) / s;
  if (u < -0.5 || u > 13 || v > 0.5 || v < -12.5) return 0;
  // The beak.
  if (u > 10.4 && u < 12.6 && v > -10.9 && v < -9.5 && v > -10.9 + (u - 10.4) * 0.35 && v < -9.5 - (u - 10.4) * 0.3) return 2;
  // The head.
  if (Math.hypot(u - 10.1, v + 10.3) < 1.05) return 1;
  // The neck: a thick S.
  for (let i = 0; i + 1 < NECK.length; i++) {
    const w = 0.62 + (1 - i / NECK.length) * 0.32;
    if (segDist(u, v, NECK[i][0], NECK[i][1], NECK[i + 1][0], NECK[i + 1][1]) < w) return 1;
  }
  // The body (flat-bottomed) and the raised wing; the tail rises at the left.
  const body = Math.hypot((u - 5.4) / 4.9, (v + 1.9) / 2.1) < 1 && v < 0;
  const wing = Math.hypot((u - 4.6) / 3.9, (v + 3.4) / 1.9) < 1 && u - 1.2 > (-v - 3.6) * 0.9;
  const tail = u > 0 && u < 2.2 && v < -1 && v > -3.8 + u * 0.4;
  return body || wing || tail ? 1 : 0;
}

/** Options of a trailer's running gear. */
export interface ChassisOpts {
  /** Length rear (x 0) → front (px). */
  length: number;
  /** The top of the beams (the floor line, negative = up). */
  deck: number;
  /** Wheel centres (x) of the rear bogie (the guards sit over them; the front runs on the kit's dolly). */
  wheels: readonly number[];
  /** Draw the rust-red side skirt with the line name and the mark between [x0, x1]. */
  skirt?: readonly [number, number];
  /** Skirt depth below the deck (px; default 7). */
  skirtH?: number;
  /** Damage state 0 … 2 (holes, soot on the skirt). */
  state?: number;
}

/**
 * A full trailer's running gear in LOCAL coordinates (x 0 = the rear, y 0 = the road): the main
 * beams, the rust-red skirt with `ZWAAN` and the swan mark, black mud guards over the wheels, the
 * steel underrun guard, the rear lamp bar (tail lamps, amber, the red-white striped bar) and the
 * (the kit draws the drawbar, the dolly and the wheels).
 */
export function drawChassis(p: Pen, m: ZwMats, o: ChassisOpts): void {
  const d = p.d;
  const L = o.length;
  const dk = o.deck;
  // The beams under the floor and the crossmembers' ends.
  p.box(2, dk, L - 4, 4.4, { mat: m.black, z: 0.6, r: 0.5, bevel: 0.6 });
  if (d > 1) for (let x = 8; x < L - 8; x += 11) p.box(x, dk + 1.2, 0.9, 1.6, { mat: m.steel, z: 0.9, r: 0.2 });
  // The skirt: rust-red line colour, the name and the mark (our own lettering).
  if (o.skirt) {
    const [x0, x1] = o.skirt;
    const h = o.skirtH ?? 7;
    const part = p.c.newPart();
    p.box(x0, dk + 0.4, x1 - x0, h, {
      mat: m.rust,
      z: 1.4,
      r: 0.5,
      bevel: 0.6,
      part,
      tex: (t) => {
        const x = t.x + p.x0;
        const y = t.y + p.y0;
        // A paler top edge, a little road grime toward the bottom.
        if (y < dk + 1.4) t.tone += 0.15;
        if (y > dk + h - 2) t.tone -= 0.12 * hash2(Math.floor(x * 2), 3);
      },
    });
    const ink = top('snow', d, d === 1 ? 0 : 1);
    const name = 'ZWAAN';
    const s = 1;
    const mark = h >= 9;
    const nw = w5Width(name, s);
    const mx = (x0 + x1) / 2;
    const nx = mark ? mx - nw / 2 + 6 * s : mx - nw / 2;
    const ny = dk + 0.4 + (h - 5 * s) / 2;
    const ss = (h - 1.4) / 11.6;
    p.paint(x0, dk, x1 - x0, h + 1, (x, y) => {
      if (w5Hit(name, nx, ny, s, x, y)) return ink;
      if (!mark) return 0;
      const sw = swanHit(nx - 15 * ss, dk + 0.4 + h - 0.7, ss, x, y);
      return sw === 2 ? top('orange', d, 1) : sw === 1 ? ink : 0;
    }, 2);
    if ((o.state ?? 0) >= 1) {
      p.shade(x0, dk, x1 - x0, h + 1, (x, y) => {
        const a = Math.hypot((x - (x0 + (x1 - x0) * 0.3)) / 6, (y - dk - h * 0.5) / 3);
        return a < 1 ? -0.5 * (1 - a) : 0;
      }, part);
    }
  }
  // Mud guards over the wheels (black, a rolled top edge).
  for (const wx of o.wheels) {
    p.body(
      [[wx - 9.5, -8], [wx - 9, -14.4], [wx - 6, -17], [wx + 6, -17], [wx + 9, -14.4], [wx + 9.5, -8], [wx + 7.8, -8], [wx + 7.4, -13.2], [wx + 5, -15.2], [wx - 5, -15.2], [wx - 7.4, -13.2], [wx - 7.8, -8]],
      0.8,
      { mat: m.black, z: 1.6 },
    );
  }
  // The rear: the lamp bar (tail lamp, amber), the striped underrun bar, the mud flap.
  p.box(-0.6, dk - 0.4, 3.6, 5.6, { mat: m.black, z: 1.8, r: 0.4 });
  p.box(-0.8, dk + 0.4, 1.6, 1.8, { mat: m.tail, z: 2, r: 0.3, bevel: 0.4 });
  p.box(-0.8, dk + 2.6, 1.6, 1.2, { mat: m.amber, z: 2, r: 0.2 });
  const white = mat(p.c, 'snow', { spec: 0.4, lo1: 2, hi1: 3, lo: 3, hi: 5 });
  const red = mat(p.c, 'red', { spec: 0.85, shine: 42, lo1: 0, hi1: 3, lo: 2, rim: 0.3, bounce: 0.3 });
  p.box(-0.8, -10.4, 6, 2.8, {
    mat: red,
    z: 2.1,
    r: 0.4,
    bevel: 0.4,
    tex: (t) => {
      if (frac((t.x + p.x0 + (t.y + p.y0)) / 3) < 0.5) t.mat = white;
    },
  });
  p.box(4.4, dk + 4, 1.8, -dk - 6.4, { mat: m.plastic, z: 1.2, r: 0.3 });
  // (The drawbar, the dolly under the front and the wheels are the kit's: kit.ts drawZwaan*.)
}


/** A rear lamp lit (each part's `lamps` strip): 0 brake (red), 1 the indicator (amber); anchor = the lamp. */
export function lampsFrame(f: number, d: Dn): Frame {
  const p = new PenC(-3, -4, 6, 8, d);
  const c = p.c;
  if (f === 0) {
    p.box(-1.2, -1.2, 2.6, 3.2, { mat: mat(c, 'red', { flat: true, lo1: 1, hi1: 2, lo: 3, hi: 5 }), z: 0.5, r: 0.8 });
    p.box(-0.9, -0.6, 1.6, 1.8, { mat: mat(c, 'red', { flat: true, lo1: 2, hi1: 3, lo: 5, hi: 7 }), z: 1, r: 0.3, tone: 0.5 });
  } else {
    p.box(-1.2, 0.8, 2.6, 2.4, { mat: mat(c, 'orange', { flat: true, lo1: 1, hi1: 3, lo: 3, hi: 6 }), z: 0.5, r: 0.8 });
    p.box(-0.9, 1.4, 1.6, 1.2, { mat: mat(c, 'gold', { flat: true, lo1: 2, hi1: 3, lo: 4, hi: 7 }), z: 1, r: 0.2, tone: 0.5 });
  }
  return p.frame(c.render({ outline: 'none' }));
}


// =============================================================================================
// Logic
// =============================================================================================

const PROBE: Damage = { amount: 0, kind: 'impact', dirX: 0 };
const NO_BOXES: readonly Rect[] = [];
/** One cell for a wagon that drives into an obstacle (spec §R.3: "a bump costs a cell"). */
const RULE: ContactRule = { rearCost: () => 1, ram: false };

/**
 * A road obstacle dropped by a part (see the header). Subclasses move it (`vx`, `y`, `lift`) and
 * call `obstacleTick()` once per tick after the move.
 */
export class ZwaanObstacle extends RingEntity {
  readonly box: SolidBox;
  /** Length along the road and height (px): the hitbox is centred on x. */
  readonly len: number;
  readonly hgt: number;
  /** Solid (blocks shots, bumps wagons); false while it is in the air or off the road. */
  solid = true;
  /** Shots that ended on it (tests). */
  shots = 0;
  protected readonly cool = new BumpCooldown();
  private readonly rammed: Wagon[] = [];
  private readonly slabR: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(world: World, x: number, y: number, len: number, hgt: number) {
    super(world, x, y);
    this.len = len;
    this.hgt = hgt;
    this.hitbox = { x: -len / 2, y: -hgt, w: len, h: hgt };
    this.team = 'neutral';
    this.z = 31;
    this.shadowW = len - 4;
    this.despawnMargin = 120;
    // The probe that makes the World's contact pass call `contactBoxes()` (the shot hook).
    this.contactDamage = PROBE;
    this.box = world.addSolid(new SolidBox(0, 0, 0, 0, false, this));
    this.addTag('ring-car', 'solid', 'cover', 'ring-zwaan-obstacle');
    this.syncBox();
  }

  /** The cover box over the depth slab (disabled while it is not solid). */
  syncBox(): void {
    const b = this.box;
    b.enabled = this.solid && this.alive;
    b.x = this.x - this.len / 2;
    b.w = this.len;
    b.y = this.y - this.depthHalf;
    b.h = this.depthHalf * 2;
  }

  /** The bump pass and the box (call once per tick after the move). */
  protected obstacleTick(): void {
    this.syncBox();
    if (!this.solid) return;
    const s = this.slabR;
    s.x = this.x - this.len / 2;
    s.w = this.len;
    s.y = this.y - this.depthHalf;
    s.h = this.depthHalf * 2;
    const fix = pushWagons(this.world, this, s, RULE, this.cool, this.rammed);
    if (fix !== 0) {
      this.x += fix;
      this.syncBox();
    }
  }

  /** The contact-pass hook: count the shots that ended on the cover box. */
  override contactBoxes(): readonly Rect[] {
    if (!this.solid) return NO_BOXES;
    const shots = this.world.byTag('shot');
    if (shots.length === 0) return NO_BOXES;
    const b = this.box;
    const e = 0.02;
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.removed || s.dead) continue;
      if (s.x < b.x - e || s.x > b.x + b.w + e || s.y < b.y - e || s.y > b.y + b.h + e) continue;
      this.shots++;
      this.onShot(s.x);
    }
    return NO_BOXES;
  }

  /** A shot ended on it (a dent, a moo). */
  protected onShot(_x: number): void {}

  /** Never hurt (no damage reaches it). */
  override onHit(): boolean {
    return false;
  }
}


/**
 * A hit on a part's big body (it never flashes white): a spark where the shot struck the slab's
 * near end, every third tick (cosmetic; the fx rng only).
 */
export function bodySpark(world: World, box: Rect, y: number, dirX: number): void {
  if (world.tick % 3 !== 0) return;
  const x = dirX < 0 ? box.x + box.w : box.x;
  hitSpark(world, Math.max(box.x, Math.min(box.x + box.w, x)), y - 14 - world.fxRng.range(0, 24), -(dirX || 1));
}

/** Open lanes at the part (4; 3 in a tube). */
export function openLanesAt(world: World, x: number): number {
  return ringOf(world)?.lanesOpenAt(x) ?? LANE_COUNT;
}

/** Lanes (1 … open) with one of `tags` on screen in them (alive, on the road). */
export function busyLanes(world: World, tags: readonly string[], out: Set<number>): Set<number> {
  out.clear();
  const cam = world.camera;
  for (const tag of tags) {
    const list = world.byTag(tag);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.x < cam.x - 16 || e.x > cam.right + 16) continue;
      const busy = (e as { busyLane?: () => number }).busyLane;
      const l = typeof busy === 'function' ? busy.call(e) : nearestLane(e.y);
      if (l > 0) out.add(l);
    }
  }
  return out;
}

/**
 * Up to `n` lanes for an attack: the target wagon's lane first, never a lane in `busy`, and always
 * at least one open lane left free (spec §R.3). `rnd(k)` picks an index below k (the world's rng).
 */
export function pickLanes(world: World, n: number, busy: ReadonlySet<number>, atX: number, atY: number, rnd: (k: number) => number): number[] {
  const open = openLanesAt(world, atX);
  const free: number[] = [];
  for (let l = 1; l <= open; l++) if (!busy.has(l)) free.push(l);
  const k = Math.min(n, free.length - 1);
  if (k <= 0) return [];
  const out: number[] = [];
  const t = nearestWagon(world, atX, atY);
  const tl = t ? nearestLane(t.y, 1, open) : 0;
  if (free.includes(tl)) out.push(tl);
  const rest = free.filter((l) => l !== tl);
  while (out.length < k && rest.length) out.push(rest.splice(rnd(rest.length), 1)[0]);
  return out;
}

/** The plane y of a lane (re-export for the parts). */
export { laneY };
