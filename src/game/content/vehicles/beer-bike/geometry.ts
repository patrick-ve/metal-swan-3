/**
 * Beer-bike geometry (docs/design/ams-extras.md §2.2, §2.3), shared by the art, the rideable
 * vehicle (`beer-bike`) and the enemy version (`stag-beer-bike`, content/stag). Body space: x
 * forward (the bike faces right), y up negative, the anchor on the ground at the middle.
 *
 * The bike is 100 px long: a long wooden bar counter on a steel chassis with four wheels (the far
 * two show behind the near two), a striped canopy roof on four posts, four stools on the near side
 * in front of the counter (the riders sit on them, pedalling), the driver's saddle and handlebar
 * at the front, a keg on the roof feeding the brass tap on the front crate (the cork cannon) and a
 * keg rack at the back.
 */

/** Numbers (NORMAL). */
export const BEER_BIKE = {
  /** Half the drawn length (the view clamp keeps the whole bike visible). */
  halfWidth: 53,
  /** Physics body. */
  body: { w: 80, h: 26 },
  /** Stool x positions, left to right (the riders' anchors; their hips sit `seatHip` above). */
  stools: [-34, -21, -8, 5] as readonly number[],
  seatHip: 18,
  /** The driver: his `mount` frame's anchor (its hip is 17 px above it) and the handlebar grips. */
  driver: [22, -1] as readonly [number, number],
  bar: [31, -23] as readonly [number, number],
  /** The bar counter: its top is the one-way platform of the partner (2P). */
  counter: { x0: -44, x1: 14, top: -27 },
  roof: { x0: -50, x1: 42, top: -64, bottom: -58 },
  /** Wheels: radius and centres (near pair, far pair). */
  wheelR: 7,
  nearWheels: [[-32, -7], [30, -7]] as ReadonlyArray<readonly [number, number]>,
  farWheels: [[-27, -8], [35, -8]] as ReadonlyArray<readonly [number, number]>,
  /**
   * The cork cannon: a brass tap on the front crate at chest height, fed by the keg on the roof
   * through a hose down the front post (from the roof a forward cork flew 69 px over the street
   * and hit nothing on foot). Pivot and spout length.
   */
  pivot: [46, -24] as readonly [number, number],
  spout: 7,
  /** The keg roll leaves here; the foam spray starts here. */
  kegStart: [46, -6] as readonly [number, number],
  foamStart: [44, -20] as readonly [number, number],
  /** The whole bike's box (hurtbox of the driven vehicle). */
  hurt: { x: -48, y: -58, w: 94, h: 58 },
} as const;

/** Cork cannon steps: 0 forward … 4 straight up, 22.5° apart. */
export const TURRET_STEPS = 5;
export const TURRET_STEP = Math.PI / 8;

/** Angle of a turret step relative to the facing (0 = forward, −π/2 = up). */
export function turretAngle(step: number): number {
  return -Math.max(0, Math.min(TURRET_STEPS - 1, step)) * TURRET_STEP;
}

/** Body-space muzzle of a turret step (unflipped). */
export function turretMuzzle(step: number, out: [number, number]): [number, number] {
  const a = turretAngle(step);
  out[0] = BEER_BIKE.pivot[0] + Math.cos(a) * BEER_BIKE.spout;
  out[1] = BEER_BIKE.pivot[1] + Math.sin(a) * BEER_BIKE.spout;
  return out;
}
