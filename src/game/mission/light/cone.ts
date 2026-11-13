/**
 * THE HERO FLASHLIGHT (docs/design/sewers.md §5.1; owner: wave P1b C). Every living hero carries a
 * flashlight on the gun, always on: a cone from the gun's muzzle point (the point bullets spawn
 * from, crouching and jumping too) along the aim (8 directions; a horizontal aim tilts 5° down).
 * Two users share this one geometry:
 *
 * - the light pass (pass.ts, a section whose light config sets `cones`): `LightMap.addCone` cuts
 *   every cone into the darkness (dithered edge bands, the far end fades);
 * - the sim's light test (`litByHeroes`; mission sewers' `isLit`): is a point inside any living
 *   hero's cone or glow circle? The rats read it ONLY to pick their art (the whole body or the
 *   eyes only); it never changes a hit, a speed, a timing or an rng draw.
 *
 * The battery (`pickup-battery`, content/sewers/items/battery.ts): while its hero carries the status
 * `BATTERY_STATUS`, the cone is longer and wider (`FLASHLIGHT.battery`).
 *
 * Pure: no allocation per call (module scratch records), no rng, nothing written to the world.
 * Imports are type-only except the player's aim helpers.
 */
import type { World } from '../../../engine/world';
import type { Player } from '../../player/player';
import { aimAngle } from '../../weapons';

const DEG = Math.PI / 180;

/** The numbers of spec §5.1 (*start*). */
export const FLASHLIGHT = {
  /** Cone length (px) and half-angle (radians). */
  len: 210,
  half: 20 * DEG,
  /** A horizontal aim tilts this far down (radians). */
  tilt: 5 * DEG,
  /** The dithered edge: two bands of this width each (radians) inside the cone's rim. */
  band: 3 * DEG,
  /** The last share of the length fades out. */
  fade: 0.35,
  /**
   * The lamp head's SPILL (added by wave C): a soft circle of this radius round the muzzle, so a rat
   * at the hero's feet (30–42 px ahead: under the cone's lower edge, outside the hero glow r 28)
   * still shows its body at its bite tell. Strength in the pass: `spillLight`.
   */
  spill: 24,
  spillLight: 1.6,
  /** With a battery: length, half-angle, ticks; the HUD icon blinks in the last `warn` ticks. */
  battery: { len: 280, half: 28 * DEG, ticks: 1200, warn: 120 },
} as const;

/** The status id a battery gives its hero (content/sewers/items/battery.ts defines the effect). */
export const BATTERY_STATUS = 'flashlight-battery';

/** One hero's cone (world px, radians). */
export interface HeroCone {
  x: number;
  y: number;
  angle: number;
  len: number;
  half: number;
}

/** The forward aim band (|elev| below this is a horizontal aim; player.ts DIAG_MIN). */
const FORWARD_MAX = Math.PI / 8 - 1e-6;

const muzzle: [number, number] = [0, 0];

/** Is the hero alive and on the field (the cone and the glow follow him)? */
export function heroShines(p: Player): boolean {
  return !p.removed && p.state !== 'dead' && p.state !== 'out';
}

/** Ticks of battery left for this hero (0: none). No allocation (player.status.ticksLeft makes a closure). */
export function batteryTicks(p: Player): number {
  const list = p.status.list;
  for (let i = 0; i < list.length; i++) if (list[i].def.id === BATTERY_STATUS) return list[i].ticks;
  return 0;
}

/** Fill `out` with hero `p`'s cone now (the muzzle point, the aim with the tilt, the battery). */
export function heroCone(p: Player, out: HeroCone): HeroCone {
  p.muzzleWorld(muzzle);
  out.x = muzzle[0];
  out.y = muzzle[1];
  const elev = p.elev;
  out.angle = aimAngle(p.facing, Math.abs(elev) < FORWARD_MAX ? elev + FLASHLIGHT.tilt : elev);
  const bat = batteryTicks(p) > 0;
  out.len = bat ? FLASHLIGHT.battery.len : FLASHLIGHT.len;
  out.half = bat ? FLASHLIGHT.battery.half : FLASHLIGHT.half;
  return out;
}

/** Is world point (x, y) inside the cone (the full sector: the rim bands count)? */
export function inCone(c: HeroCone, x: number, y: number): boolean {
  const dx = x - c.x;
  const dy = y - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > c.len * c.len) return false;
  if (d2 < 1) return true;
  const along = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
  if (along <= 0) return false;
  const perp = -dx * Math.sin(c.angle) + dy * Math.cos(c.angle);
  return Math.abs(perp) <= along * Math.tan(c.half);
}

const scratch: HeroCone = { x: 0, y: 0, angle: 0, len: 0, half: 0 };

/**
 * Is world point (x, y) inside any living hero's cone or its spill circle (when `cones`) or glow
 * circle (radius `glow`, centred 14 px over the feet as the pass draws it)? Pure, no allocation.
 */
export function litByHeroes(world: World, x: number, y: number, glow: number, cones: boolean): boolean {
  const ps = world.players as readonly Player[];
  const g2 = glow * glow;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (!heroShines(p)) continue;
    if (glow > 0) {
      const dx = x - p.x;
      const dy = y - (p.y - HERO_GLOW_UP);
      if (dx * dx + dy * dy <= g2) return true;
    }
    if (!cones) continue;
    const c = heroCone(p, scratch);
    const sx = x - c.x;
    const sy = y - c.y;
    if (sx * sx + sy * sy <= FLASHLIGHT.spill * FLASHLIGHT.spill || inCone(c, x, y)) return true;
  }
  return false;
}

/** The hero glow's centre sits this far over the feet (pass.ts draws it there). */
export const HERO_GLOW_UP = 14;
