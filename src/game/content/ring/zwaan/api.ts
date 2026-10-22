/**
 * THE ZWAAN TRUCK — the contract (docs/design/ring.md §R.3, R-16, R-18; docs/api/ring.md
 * "Revision R"). FROZEN at the end of the CORE stage of revision R: TRAIN-1 and TRAIN-2 replace the
 * internals of the parts (and TRAIN-1 the controller's), never these names and signatures (add,
 * never rename).
 *
 * The road train: an invisible controller `ring-zwaan` (the boss slot's id; no `boss` tag) and one
 * `Boss` subclass per part (`ZwaanPart`, part.ts), fought from the rear forward in the fixed order
 * (R-16): container → car transporter → tanker → livestock trailer → the cab ZWARE JONGEN. Only the
 * ACTIVE part is a live entity; the controller draws the waiting parts in front of it as decor.
 *
 * WHAT THE CONTROLLER OWNS (controller.ts):
 * - the plan lock for the whole train (`ringOf(world).lockPlan(ZWAAN_LOCK)`), the order
 *   (`params.order`, default `RING_ZWAAN_ORDER`), the lane (`params.lane`, 1);
 * - the ANCHOR: the screen x where the active part's REAR belongs (`ZWAAN.anchorX`, 150), the
 *   entry (the first part drives in from the right) and the CATCH-UP after each beaten part (the
 *   next part's rear eases back to the anchor over 130–180 ticks: about 190 px);
 * - spawning the next part at its place in the chain when the active one is beaten
 *   (`partBeaten`), the small gang during each catch-up (2 / 2 / 3 scooters by difficulty);
 * - the pips (`barPips`: total = the order's length, left = the parts not yet beaten);
 * - drawing the waiting parts (`defineZwaanPart(id, { drawWaiting })`), pushing wagons out of the
 *   waiting parts' slab;
 * - the world events 'ringTrainPart' (start / beaten per part) and, after the cab, 'ringTrainDone'
 *   (the ring's boss end, the music, the speed bonus react to it, never to a part's
 *   'bossDefeated'); then it unlocks the plan and removes itself (the road rolls on to the final jam).
 *
 * WHAT A PART MUST DO (part.ts `ZwaanPart`; every default works, override what you need):
 * - extend `ZwaanPart` with `super(world, x, y, p, { art, name, hp, score, length, ... })`;
 *   its anchor `x` is its REAR end (world x), `length` px forward is its FRONT (the coupling);
 *   `y` is its lane's plane y; keep `lane` 1 | 2 and the tag `ring-block` (added by the base);
 * - add its parts (`addPart`, slab boxes: `zwaanSlab(x0, x1)`) and its `phases` with attacks whose
 *   tells are ≥ 18 ticks (`telegraphFor`); a beaten part is a Boss death (`die`);
 * - keep pace: call `super.think()` (or `this.keepPace()`) every tick: the base drives it to the
 *   controller's anchor at the road speed;
 * - optional overrides: `*intro()` (default: invulnerable until the catch-up is done),
 *   `*beatenSequence()` (default: uncouple → brake → swerve onto the hard shoulder → tip → drop back
 *   as a wreck), `dropItem()` (default: a repair for a wagon at ≤ 6 cells, else a weapon),
 *   `draw(r)` (every part draws its own sprites; the base class only a minimal 1× box);
 * - register itself: `defineEntity(id, …)` and `defineZwaanPart(id, { length, drawWaiting })` (the
 *   look of the part while it waits in front of the active one: the same body as its `draw`).
 *
 * Bar names (spec §R.3): ZWAAN CONTAINER, ZWAAN AUTOTRANSPORT, ZWAAN TANKWAGEN, ZWAAN VEETRANSPORT,
 * ZWARE JONGEN. Points: 2,000 per trailer, 10,000 for the cab.
 */
import type { Renderer } from '../../../../engine/render';
import { RING_ZWAAN, RING_ZWAAN_ORDER, RING_ZWAAN_PART_TAG } from '../../../ring/ids';

export { RING_ZWAAN, RING_ZWAAN_ORDER, RING_ZWAAN_PART_TAG };

/** The plan-lock key of the controller (`ringOf(world).lockPlan`). */
export const ZWAAN_LOCK = 'ring-zwaan';

/** The health-bar names per part id (spec §R.3). */
export const ZWAAN_NAMES: Readonly<Record<string, string>> = {
  [RING_ZWAAN.container]: 'ZWAAN CONTAINER',
  [RING_ZWAAN.autos]: 'ZWAAN AUTOTRANSPORT',
  [RING_ZWAAN.tank]: 'ZWAAN TANKWAGEN',
  [RING_ZWAAN.vee]: 'ZWAAN VEETRANSPORT',
  [RING_ZWAAN.cab]: 'ZWARE JONGEN',
};

/** The sprite prefix of a part (new art only under `boss/ring-zwaan/<part>/`, spec §R.10). */
export function zwaanArt(part: string): string {
  return `boss/ring-zwaan/${part.replace(/^ring-zwaan-/, '')}`;
}

/** Tuning of the train (ticks, px, px/tick; HP before difficulty × co-op). Builders may tune with a note. */
export const ZWAAN = {
  /** The screen x of the active part's REAR (spec §R.3: about 150). */
  anchorX: 150,
  /** A slow drift around the anchor while it fights (px, period ticks). */
  drift: 10,
  driftPeriod: 520,
  /** The first part drives in from the right edge (its rear starts this far right of the view). */
  enterFrom: 40,
  /** The catch-up after a beaten part: eased over this many ticks (by the distance; spec 130–180). */
  catchUp: { min: 130, max: 180, pxPerTick: 1.3 },
  /** The gap between two parts of the chain (the couplings, px). */
  coupling: 10,
  /** The pace controller: rel = clamp((target − x) × gain, ±maxRel) on top of the road speed. */
  gain: 0.15,
  maxRel: 3,
  /** The small gang a catch-up sends (scooters from behind in lanes 3–4), by difficulty. */
  adds: { easy: 2, normal: 2, hard: 3 } as Readonly<Record<string, number>>,
  /** Points per part (spec §R.3). */
  score: { trailer: 2_000, cab: 10_000 },
  /** The damage-rate bucket default (like the lorry's: HP per tick of the base HP, burst; × difficulty × co-op). */
  rate: { perTick: 2, burst: 150 },
  /** The beaten sequence (the default): uncouple, brake, swerve, tip; the screen speeds. */
  beaten: { uncouple: 16, brake: 30, swerve: 40, tip: 24, brakeRel: -1.6, dropRel: -3.2, maxTicks: 600 },
} as const;

/** The parts left and the total for the HUD pips under the boss bar (hud.ts `BossBarPips`). */
export interface ZwaanPips {
  readonly total: number;
  readonly left: number;
}

/**
 * What a part asks its controller (`ZwaanPart.train`; set by the controller right after the spawn).
 * The controller (controller.ts `RingZwaan`) implements it.
 */
export interface ZwaanTrain {
  /** The part ids in order (rear → front). */
  readonly order: readonly string[];
  /** Index of the active part in `order` (−1 before the first, `order.length` when done). */
  readonly index: number;
  /** The plane y of the train's lane (the active part's lane). */
  readonly laneY: number;
  /** The catch-up (or the entry) is running: the active part waits (invulnerable, intro). */
  readonly catchingUp: boolean;
  /** The pips (total, left incl. the active part). */
  readonly pips: ZwaanPips;
  /** World x where the active part's REAR belongs this tick (the anchor). */
  anchorWorldX(): number;
  /** May this part start its fight (the entry / catch-up is over and it is the active part)? */
  ready(part: ZwaanPartHandle): boolean;
  /** The active part's death starts (its `onDeathStart`): uncouple; the next part or the train's end. */
  partBeaten(part: ZwaanPartHandle): void;
}

/** What the controller reads from a part (part.ts `ZwaanPart` implements it). */
export interface ZwaanPartHandle {
  readonly type: string;
  /** Rear world x (its anchor) and its length (px, rear → front). */
  readonly x: number;
  readonly y: number;
  readonly length: number;
  /** Its index in the order. */
  index: number;
  train: ZwaanTrain | null;
}

/** How a part looks while it waits in the chain (drawn by the controller as decor, not hittable). */
export interface ZwaanPartDef {
  /** Length rear → front (px; the same as the entity's `length`). */
  readonly length: number;
  /**
   * Draw the waiting part with its REAR at world (x, y) (the plane y of the lane). Use the same
   * body as the part's own `draw` so the hand-over to the live part is seamless. `tick` animates
   * wheels and lights.
   */
  drawWaiting(r: Renderer, x: number, y: number, tick: number): void;
}

const PART_DEFS = new Map<string, ZwaanPartDef>();

/** Register (or replace) how a part waits in the chain (TRAIN-1 / TRAIN-2 replace the placeholders). */
export function defineZwaanPart(id: string, def: ZwaanPartDef): void {
  PART_DEFS.set(id, def);
}

/** The waiting look of a part (null: unknown id; the controller then skips it). */
export function zwaanPartDef(id: string): ZwaanPartDef | null {
  return PART_DEFS.get(id) ?? null;
}
