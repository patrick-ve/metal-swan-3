/**
 * The hostage carrier hook (docs/design/ring.md §8; docs/api/ring.md "Entities"): a vehicle that
 * carries a tied `ring-hostage` (items/hostage.ts) behind a door the player shoots open. Wave A's
 * carrier is the hostage van (`ring-car` with `hostage: true`); wave B's parcel vans and caravans
 * implement the same interface and spawn the hostage with
 * `world.spawn('ring-hostage', x, y, { carrier: this, item })`.
 *
 * The hostage owns the door: while tied it is a `shootable` on the enemy team whose only hurt box
 * is the door's depth slab (`hostageDoor`) at the carrier's plane y, with `doorHp` (spawn param
 * `doorHp`, default `RING_HOSTAGE.doorHp`). The carrier keeps its cover off that slab, draws the
 * door (`drawHostageDoor`, called by the hostage right after it draws itself, so the door is in
 * front of it) and hears when it is dented (`hostageDoorState`) and opened (`hostageOpened`).
 */
import type { Entity } from '../../../../engine/entity';
import type { Renderer } from '../../../../engine/render';

/** Where the hostage sits: world x, plane y and the drawn lift of its feet. */
export interface SeatOut {
  x: number;
  y: number;
  lift: number;
}

export interface HostageCarrier extends Entity {
  /** The hostage's seat now (it rides there while tied and during its hop out). */
  hostageSeat(out: SeatOut): void;
  /** The door's world x range (its hurt slab lies on the carrier's plane y). */
  hostageDoor(out: { x0: number; x1: number }): void;
  /** The door took damage: 0 = shut, 1 = dented (below half its hp). */
  hostageDoorState?(state: number): void;
  /** The door was shot open by player `slot` (−1 unknown): drop the cover gap, show it open. */
  hostageOpened(slot: number): void;
  /** Draw the door over the hostage (nothing once it is open). */
  drawHostageDoor?(r: Renderer): void;
}

/** Is `e` a hostage carrier? */
export function isCarrier(e: unknown): e is HostageCarrier {
  const c = e as Partial<HostageCarrier> | null;
  return !!c && typeof c.hostageSeat === 'function' && typeof c.hostageDoor === 'function' && typeof c.hostageOpened === 'function';
}
