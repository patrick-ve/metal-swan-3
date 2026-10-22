/**
 * The standing jam of `rf-a` DE FILE (docs/design/ring.md §R.5): `ring-foot-scene`, one hidden
 * entity per section that draws, after the terrain and behind every actor:
 * - the hard shoulder and the verge (`ring/foot/verge` tiles over the feet line: the terrain under
 *   them only gives the collision);
 * - the near lane's stopped vehicles (layout-rf-a.ts `RF_A_VEHICLES`): the drive's civilian cars
 *   (`ring/car/<model>-<colour>` + wheels), the gang's parcel van with its rear doors open (the
 *   hostage's van), the coach, the police van; their roofs are the platforms of the layout;
 * - the PARKED WAGONS with their drivers at the wheel (the drive's `Wagon` drawn as decor: never in
 *   the world, never hit; P2's only when slot 2 plays); the drivers stay silent;
 * - the scooters the gang dumped (`ring/scooter/<L>/down`, lying), the concrete blocks (cover);
 * - the police line at the end (`ring/foot/police-line`): it flutters when a hero comes near and
 *   snaps when one walks through (`ring/foot/tape`).
 * Now and then a driver in the queue leans on the horn (`ring/foot/honk`; a fixed rhythm, no rng).
 *
 * The drivers: `rfPlanDrivers` holds the drive plan's driver list per foot def (index.ts sets it);
 * the slots pick from it as the drive did (ring-route.ts `expectedDrivers`).
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { frameCount, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { defineEntity, hasCharacter, NO_PARAMS } from '../../../registry';
import { Wagon } from '../../../ring/wagon';
import { sessionOf } from '../../../context';
import { VAN } from '../gangs/geometry';
import { SCOOTER_LOOKS } from '../scooter/art';
import { CAR_GEO, carSprite, WHEEL_R } from '../traffic/geometry';
import { BUS, KBARRIER, POLICE_VAN, VERGE_W } from './art-jam';
import { RF_GROUND } from './ids';
import { CAR_Y, RF_A_BLOCKS, RF_A_POLICE_LINE_W, RF_A_POLICE_LINE_X, RF_A_SCOOTERS, RF_A_VEHICLES, type RfVehicle } from './layout-rf-a';

/** The entity id. */
export const RF_SCENE = 'ring-foot-scene';

/** The drive plan's drivers per foot def (ringFootDef sets it; the scene reads `world`'s def). */
export const rfPlanDrivers = new WeakMap<object, readonly string[]>();

/** The driver of each slot: the first plan driver nobody plays and the other slot does not drive. */
export function footDrivers(planDrivers: readonly string[], slots: ReadonlyArray<{ joined: boolean; character: string }>): [string | null, string | null] {
  const out: [string | null, string | null] = [null, null];
  const playing = slots.filter((s) => s.joined).map((s) => s.character);
  for (const slot of [0, 1] as const) {
    if (!slots[slot]?.joined) continue;
    for (const id of planDrivers) {
      if (playing.includes(id) || id === out[1 - slot] || !hasCharacter(id)) continue;
      out[slot] = id;
      break;
    }
  }
  return out;
}

const opts: DrawOpts = {};

/** Ticks between the queue's horns (two drivers, out of step). */
const HONK = [337, 523] as const;

export class RfJamScene extends Entity {
  private readonly wagons: Array<Wagon | null> = [null, null];
  private lineState: 0 | 1 | 2 = 0;
  private t = 0;

  constructor(world: World, x: number, y: number, drivers: readonly (string | null)[] = [null, null], players = 1) {
    super(world, x, y);
    this.type = RF_SCENE;
    this.team = 'neutral';
    this.z = -20;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -260, y: -220, w: 520, h: 230 };
    for (const v of RF_A_VEHICLES) {
      if (v.kind !== 'wagon') continue;
      if (v.slot === 1 && players < 2) continue;
      const w = new Wagon(world, v.x, CAR_Y, NO_PARAMS, { slot: v.slot, driver: drivers[v.slot] ?? null });
      this.wagons[v.slot] = w;
    }
  }

  /** The police line: 0 taut, 1 fluttering (a hero near), 2 snapped (a hero walked through). */
  get policeLine(): number {
    return this.lineState;
  }

  override update(): void {
    this.t++;
    const cam = this.world.camera;
    this.x = cam.x + cam.w / 2;
    this.y = RF_GROUND + 8;
    if (this.t % HONK[0] === 120 || this.t % HONK[1] === 260) this.world.audio.sfx('ring/foot/honk', { vol: 0.7 });
    if (this.lineState < 2) {
      let near = false;
      for (const p of this.world.byTag('player')) {
        if (!p.alive) continue;
        if (p.x >= RF_A_POLICE_LINE_X + 4 && p.x <= RF_A_POLICE_LINE_X + RF_A_POLICE_LINE_W + 30) {
          this.lineState = 2;
          this.world.audio.sfx('ring/foot/tape');
          return;
        }
        if (Math.abs(p.x - RF_A_POLICE_LINE_X) < 60) near = true;
      }
      this.lineState = near ? 1 : 0;
    }
  }

  override draw(r: Renderer): void {
    const cam = this.world.camera;
    const x0 = Math.floor(cam.x);
    const x1 = x0 + cam.w;
    // The shoulder and the verge.
    for (let tx = Math.floor(x0 / VERGE_W) * VERGE_W; tx < x1; tx += VERGE_W) {
      const v = ((tx / VERGE_W) | 0) % 5 === 3 ? 1 : 0;
      r.sprite('ring/foot/verge', v, tx, RF_GROUND, opts);
    }
    for (const v of RF_A_VEHICLES) if (v.x > x0 - 120 && v.x < x1 + 120) this.drawVehicle(r, v);
    for (const [sx, look] of RF_A_SCOOTERS) {
      if (sx < x0 - 60 || sx > x1 + 60) continue;
      const id = `ring/scooter/${look % SCOOTER_LOOKS.length}/down`;
      if (hasSprite(id)) r.sprite(id, frameCount(id) - 1, sx, RF_GROUND - 1, opts);
    }
    for (const [bx] of RF_A_BLOCKS) if (bx > x0 - 60 && bx < x1 + 20) r.sprite('ring/foot/kbarrier', 0, bx, RF_GROUND, opts);
    if (RF_A_POLICE_LINE_X > x0 - 80 && RF_A_POLICE_LINE_X < x1 + 20) {
      const f = this.lineState === 2 ? 2 : this.lineState === 1 ? (this.t >> 3) & 1 : 0;
      r.sprite('ring/foot/police-line', f, RF_A_POLICE_LINE_X, RF_GROUND, opts);
    }
  }

  private wheels(r: Renderer, id: string, xs: readonly number[], x: number, rad: number, mirror = false): void {
    const wy = CAR_Y - Math.round(rad + 0.5);
    for (const wx of xs) r.sprite(id, 0, x + (mirror ? -wx : wx), wy, opts);
  }

  private drawVehicle(r: Renderer, v: RfVehicle): void {
    switch (v.kind) {
      case 'car': {
        const g = CAR_GEO[v.model];
        r.sprite(carSprite(v.model, v.colour), 0, v.x, CAR_Y, opts);
        this.wheels(r, `ring/car/wheel-${g.wheel}`, g.wheels, v.x, WHEEL_R[g.wheel]);
        break;
      }
      case 'wagon':
        this.wagons[v.slot]?.draw(r);
        break;
      case 'bus':
        r.sprite('ring/foot/bus', 0, v.x, CAR_Y, opts);
        this.wheels(r, 'ring/car/wheel-l', BUS.wheels, v.x, BUS.wheelR);
        break;
      case 'parcel-van':
        r.sprite('ring/parcel-van/body', 0, v.x, CAR_Y, opts);
        r.sprite('ring/parcel-van/rear', 2, v.x, CAR_Y, opts);
        this.wheels(r, 'ring/car/wheel-m', VAN.wheels, v.x, VAN.wheelR);
        break;
      case 'police-van':
        // Facing right like the queue (never mirrored: its lettering reads).
        r.sprite('ring/foot/police-van', (this.t >> 4) & 1, v.x, CAR_Y, opts);
        this.wheels(r, 'ring/car/wheel-m', POLICE_VAN.wheels, v.x, POLICE_VAN.wheelR);
        break;
    }
  }
}

/** Spawn the jam scene (the drivers of the drive, the players at the start). */
export function spawnJamScene(world: World, def: object | null): RfJamScene {
  const session = sessionOf(world);
  const planDrivers = (def && rfPlanDrivers.get(def)) ?? [];
  const slots = session.slots;
  const drivers = footDrivers(planDrivers, slots);
  const players = slots.filter((s) => s.joined).length;
  const e = new RfJamScene(world, world.camera.x, RF_GROUND, drivers, players);
  world.add(e);
  return e;
}

defineEntity(RF_SCENE, (w, x, y) => new RfJamScene(w, x, y), {
  category: 'prop',
  description: 'rf-a DE FILE: the standing jam (the shoulder, the near lane\'s stopped vehicles, the parked wagons with their drivers, the police line).',
});

/** Kept for the layout's users: the block size. */
export { KBARRIER };
