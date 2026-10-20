/**
 * `ring-crate` — a crate lying on the road (docs/design/ring.md §8; docs/api/ring.md "Entities"),
 * the ring's `RingPickup`: it lies still on the road (world vx 0: it drifts back at the road
 * speed), and a driven wagon whose depth slab overlaps it (x AND depth) picks it up by driving over
 * it — no magnet, no touch from the side lanes. Shots pass it (it is not shootable: a shot crate
 * never breaks). Above the box floats the item inside, so the player sees what it holds.
 *
 * The item is a normal pickup (content/items/pickups.ts) built once and never added to the world:
 * the pickup's own `collect(hero)` applies it (weapon, bombs → the wagon's shells, repair, food,
 * gem, 1UP), plays its sound, scores, shows its message and emits 'pickup' (the runner marks the
 * golden record from `params.kind`).
 *
 * Params: `contains` (any drop value, content/items/drops.ts; also `kind` or `item`; default: the
 * ring roll `ringCrateRoll`), `dropped` (it falls from a wrecked vehicle: an arc, a bounce, a
 * tumble), `vx` / `vlift` (its throw). Weapons that need gravity or terrain (the flame shot, the
 * bounce mine) never come out of a ring crate: they become the machine gun (spec §3).
 */
import type { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { dust } from '../../../fx';
import { Pickup } from '../../../pickup';
import { isPlayer } from '../../../player/player';
import { defineEntity, getEntityFactory, NO_PARAMS, paramBool, paramNum, type SpawnParams, type SpawnSpec } from '../../../registry';
import { RingEntity } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { contentsSpecs, FOOD_SCORE, GEM_SCORE, roll } from '../../items/drops';
import { drivenWagons, slabsTouch, wagonSlab } from '../traffic/road-kit';

/** Weapons that work on the plane (spec §3): machine gun, shotgun, rockets, homing rockets. */
export const RING_WEAPONS: readonly (readonly [string, number])[] = [
  ['machine-gun', 40],
  ['shotgun', 25],
  ['rocket-launcher', 20],
  ['homing', 15],
];
/** Weapons a ring crate never holds (they need gravity or terrain) and what they become. */
const OFF_PLANE = new Set(['flamethrower', 'flame', 'bounce-mine', 'bouncer', 'F', 'B', 'f', 'b']);

/** Armour (cells) at or below which repair kits come far more often. */
export const LOW_ARMOUR = 4;

/** Is any driven wagon's armour low? */
export function armourLow(world: World): boolean {
  const list = drivenWagons(world);
  for (let i = 0; i < list.length; i++) if (list[i].cells <= LOW_ARMOUR) return true;
  return false;
}

/**
 * The ring's crate roll (gameplay rng): weapon 30 · bombs 25 · repair 12 (45 while a wagon's
 * armour is low) · food 18 · gem 15.
 */
export function ringCrateRoll(world: World): SpawnSpec {
  const pick = roll(world, [
    ['weapon', 30],
    ['bombs', 25],
    ['repair', armourLow(world) ? 45 : 12],
    ['food', 18],
    ['gem', 15],
  ] as const);
  if (pick === 'weapon') return { id: 'pickup-weapon', params: { weapon: roll(world, RING_WEAPONS) ?? 'machine-gun' } };
  if (pick === 'repair') return { id: 'pickup-repair' };
  if (pick === 'food') return { id: 'pickup-food', params: { kind: roll(world, [['bread', 40], ['cheese', 30], ['teacake', 20], ['jelly', 10]] as const) ?? 'bread' } };
  if (pick === 'gem') return { id: 'pickup-gem', params: { kind: roll(world, [['gem', 70], ['medal', 30]] as const) ?? 'gem' } };
  return { id: 'pickup-bombs' };
}

/** The spawn spec of a ring crate's contents (a drop value; see the header). */
export function ringContents(value: unknown, world: World): SpawnSpec {
  if (value === undefined || value === null || value === true || value === 'auto' || value === 'random' || value === 'crate') return ringCrateRoll(world);
  if (typeof value === 'string' && OFF_PLANE.has(value)) return { id: 'pickup-weapon', params: { weapon: 'machine-gun' } };
  if (typeof value === 'string' && (value in GEM_SCORE || value in FOOD_SCORE)) return { id: value in GEM_SCORE ? 'pickup-gem' : 'pickup-food', params: { kind: value } };
  const specs = contentsSpecs(value, world, 'crate');
  const s = specs[0];
  if (!s) return ringCrateRoll(world);
  const weapon = s.params?.weapon;
  if (s.id === 'pickup-weapon' && typeof weapon === 'string' && OFF_PLANE.has(weapon)) return { id: 'pickup-weapon', params: { weapon: 'machine-gun' } };
  return s;
}

/** Build the (never added) pickup entity of a spec, or null for a non-item. */
export function pickupOf(world: World, spec: SpawnSpec, x: number, y: number): Entity | null {
  const make = getEntityFactory(spec.id);
  if (!make) return null;
  const e = make(world, x, y, spec.params ?? NO_PARAMS);
  e.type = spec.id;
  return e;
}

/**
 * Give an item spec to a hero now (a crate driven over, a hostage's gift dropped into the window):
 * a pickup applies itself through `collect`; any other entity id is spawned at the hero's wagon.
 * Returns true when it was given.
 */
export function giveItem(world: World, spec: SpawnSpec, hero: Entity, item: Entity | null = null): boolean {
  if (!isPlayer(hero)) return false;
  const e = item ?? pickupOf(world, spec, hero.x, hero.y);
  if (e instanceof Pickup) {
    if (e.collect(hero)) return true;
    // Could not use it now (full): its points instead are the pickup's business; it is gone.
    return false;
  }
  world.spawn(spec.id, hero.x, hero.y, spec.params ?? NO_PARAMS);
  return true;
}

const drawOpts: DrawOpts = {};

/** Bob of the floating item (px, period ticks). */
const BOB = { amp: 1.5, period: 44 };

export class RingCrate extends RingEntity {
  readonly spec: SpawnSpec;
  /** The pickup inside (never in the world; it applies itself on collect). */
  readonly item: Entity | null;
  private readonly itemSprite: string;
  private vlift = 0;
  private airborne: boolean;
  private bounced = 0;
  private t = 0;
  taken = false;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    const value = p.contains ?? p.kind ?? p.item;
    this.spec = ringContents(value, world);
    this.item = pickupOf(world, this.spec, x, y);
    const sprite = (this.item as Partial<Pickup> | null)?.spec?.sprite;
    this.itemSprite = typeof sprite === 'string' ? sprite : '';
    this.team = 'neutral';
    this.z = 20;
    this.hitbox = { x: -8, y: -24, w: 16, h: 24 };
    this.shadowW = 16;
    this.despawnMargin = 64;
    this.addTag(RING_ENTITY.crate, 'item');
    this.airborne = paramBool(p, 'dropped', false);
    if (this.airborne) {
      this.lift = paramNum(p, 'lift', 10);
      this.vlift = paramNum(p, 'vlift', 2.2);
      this.vx = paramNum(p, 'vx', 0);
    }
  }

  /** The kind of a gem / food inside (`golden-record` …), or ''. */
  get kind(): string {
    const k = this.spec.params?.kind;
    return typeof k === 'string' ? k : '';
  }

  override update(): void {
    this.t++;
    if (this.airborne) {
      this.x += this.vx;
      this.vlift -= 0.25;
      this.lift += this.vlift;
      if (this.lift <= 0) {
        this.lift = 0;
        if (this.bounced++ < 1 && this.vlift < -1.2) {
          this.vlift = -this.vlift * 0.35;
          this.vx *= 0.5;
          dust(this.world, this.x, this.y, 3);
        } else {
          this.airborne = false;
          this.vlift = 0;
        }
      }
    } else {
      // Lying on the road: a thrown crate slides to a stop.
      this.vx *= 0.8;
      if (Math.abs(this.vx) < 0.02) this.vx = 0;
      this.x += this.vx;
    }
    if (this.lift < 8) this.checkPickup();
  }

  /** A driven wagon whose depth slab overlaps the crate's picks it up. */
  private checkPickup(): void {
    const list = drivenWagons(this.world);
    if (list.length === 0) return;
    const mine = this.hurtboxes()[0];
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!slabsTouch(wagonSlab(w), mine) || !w.driver) continue;
      this.collect(w.driver);
      return;
    }
  }

  /** Give the item to `hero` (once) and vanish. */
  collect(hero: Entity): boolean {
    if (this.taken) return false;
    this.taken = true;
    if (this.item) {
      this.item.x = this.x;
      this.item.y = this.y - 6;
    }
    giveItem(this.world, this.spec, hero, this.item);
    this.world.audio.sfx('ring/crate');
    this.remove();
    return true;
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    drawOpts.flipX = false;
    const f = this.airborne ? 1 + (Math.floor(this.t / 4) % 3) : 0;
    r.sprite('ring/item/crate', f, x, y, drawOpts);
    if (this.airborne || !this.itemSprite || !hasSprite(this.itemSprite)) return;
    const bob = Math.round(Math.sin((this.t / BOB.period) * Math.PI * 2) * BOB.amp);
    r.sprite('ring/item/glow', Math.floor(this.t / 6) % 4, x, y - 15 + bob, drawOpts);
    r.sprite(this.itemSprite, 0, x, y - 12 + bob, drawOpts);
  }
}

defineEntity(RING_ENTITY.crate, (w, x, y, p) => new RingCrate(w, x, y, p), {
  category: 'item',
  description: 'A crate on the ring road: driven over (x and depth overlap) it gives its item (params contains / kind / item, dropped, vx).',
});
