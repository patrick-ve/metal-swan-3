/**
 * The blockade's set of `rf-b` DE BLOKKADE (docs/design/ring.md §R.6): `ring-blok-scene`, one
 * hidden entity per section that draws, after the terrain and behind every actor (z −20):
 * - the hard shoulder and the verge (`ring/foot/verge`, as in rf-a);
 * - the police van with its blue lamps and the head of the standing queue in the near lane;
 * - the police tape across the shoulder (`ring/foot/police-line`): it flutters when a hero comes
 *   near and snaps when one walks through (`ring/blok/tape`);
 * - the blockade's props in the walking plane: the painted barrels and their chains, the small
 *   banners, the lunch table (layout-rf-b.ts).
 * The far lanes (the standing cars up to the blockade line, the sitting crowds with their placards,
 * the big spandoek) are the section's static decor (section-rf-b.ts). The crowd chants now and then
 * (`ring/blok/chant`, a fixed rhythm: no rng) while a crowd is in view.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { defineEntity } from '../../../registry';
import { CAR_GEO, carSprite, WHEEL_R } from '../traffic/geometry';
import { POLICE_LINE_W, POLICE_VAN, VERGE_W } from './art-jam';
import { BLOK_SPR, CHAIN_W } from './art-blok';
import { RF_GROUND } from './ids';
import { CAR_Y } from './layout-rf-a';
import { RF_B_BANNERS, RF_B_BARRELS, RF_B_CARS, RF_B_CHAINS, RF_B_CROWDS, RF_B_PICNIC_X, RF_B_TAPE_X, RF_B_VAN_X } from './layout-rf-b';

/** The entity id. */
export const RF_B_SCENE = 'ring-blok-scene';

const opts: DrawOpts = {};
/** Ticks between two chants of the crowd. */
const CHANT = 420;

export class RfBlokScene extends Entity {
  private lineState: 0 | 1 | 2 = 0;
  private t = 0;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.type = RF_B_SCENE;
    this.team = 'neutral';
    this.z = -20;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -260, y: -220, w: 520, h: 230 };
  }

  /** The police tape: 0 taut, 1 fluttering (a hero near), 2 snapped (a hero walked through). */
  get policeLine(): number {
    return this.lineState;
  }

  override update(): void {
    this.t++;
    const cam = this.world.camera;
    this.x = cam.x + cam.w / 2;
    this.y = RF_GROUND + 8;
    if (this.t === 30) this.world.audio.sfx('ring/blok/van', { vol: 0.7 });
    if (this.t % CHANT === 200) {
      for (const [cx] of RF_B_CROWDS) {
        if (cx > cam.x - 20 && cx < cam.x + cam.w + 20) {
          this.world.audio.sfx('ring/blok/chant');
          break;
        }
      }
    }
    if (this.lineState < 2) {
      let near = false;
      for (const p of this.world.byTag('player')) {
        if (!p.alive) continue;
        if (p.x >= RF_B_TAPE_X + 4 && p.x <= RF_B_TAPE_X + POLICE_LINE_W + 30) {
          this.lineState = 2;
          this.world.audio.sfx('ring/blok/tape');
          return;
        }
        if (Math.abs(p.x - RF_B_TAPE_X) < 60) near = true;
      }
      this.lineState = near ? 1 : 0;
    }
  }

  override draw(r: Renderer): void {
    const cam = this.world.camera;
    const x0 = Math.floor(cam.x);
    const x1 = x0 + cam.w;
    const vis = (x: number, m = 80): boolean => x > x0 - m && x < x1 + m;
    for (let tx = Math.floor(x0 / VERGE_W) * VERGE_W; tx < x1; tx += VERGE_W) {
      const v = ((tx / VERGE_W) | 0) % 5 === 3 ? 1 : 0;
      r.sprite('ring/foot/verge', v, tx, RF_GROUND, opts);
    }
    // The near lane: the head of the queue, the police van.
    for (const c of RF_B_CARS) {
      if (!vis(c.x, 120)) continue;
      const g = CAR_GEO[c.model];
      r.sprite(carSprite(c.model, c.colour), 0, c.x, CAR_Y, opts);
      const wy = CAR_Y - Math.round(WHEEL_R[g.wheel] + 0.5);
      for (const wx of g.wheels) r.sprite(`ring/car/wheel-${g.wheel}`, 0, c.x + wx, wy, opts);
    }
    if (vis(RF_B_VAN_X, 120)) {
      r.sprite('ring/foot/police-van', (this.t >> 4) & 1, RF_B_VAN_X, CAR_Y, opts);
      const wy = CAR_Y - Math.round(POLICE_VAN.wheelR + 0.5);
      for (const wx of POLICE_VAN.wheels) r.sprite('ring/car/wheel-m', 0, RF_B_VAN_X + wx, wy, opts);
    }
    // The blockade's props in the walking plane.
    for (const [bx, i] of RF_B_BANNERS) if (vis(bx)) r.sprite(BLOK_SPR.banner, i, bx, RF_GROUND - 2, opts);
    if (vis(RF_B_PICNIC_X)) r.sprite(BLOK_SPR.picnic, 0, RF_B_PICNIC_X, RF_GROUND, opts);
    for (const [bx, v] of RF_B_BARRELS) if (vis(bx, 20)) r.sprite(BLOK_SPR.barrel, v, bx, RF_GROUND, opts);
    for (const cx of RF_B_CHAINS) if (vis(cx, 40)) r.sprite(BLOK_SPR.chain, 0, cx, RF_GROUND, opts);
    if (vis(RF_B_TAPE_X)) {
      const f = this.lineState === 2 ? 2 : this.lineState === 1 ? (this.t >> 3) & 1 : 0;
      r.sprite('ring/foot/police-line', f, RF_B_TAPE_X, RF_GROUND, opts);
    }
  }
}

/** Spawn the blockade's set (once, at the section's start). */
export function spawnBlokScene(world: World): RfBlokScene {
  const e = new RfBlokScene(world, world.camera.x, RF_GROUND);
  world.add(e);
  return e;
}

defineEntity(RF_B_SCENE, (w, x, y) => new RfBlokScene(w, x, y), {
  category: 'prop',
  description: 'rf-b DE BLOKKADE: the blockade set (the shoulder, the police van and tape, the queue\'s head, the barrels, chains, banners and the lunch table).',
});

/** Kept for the layout's users. */
export { CHAIN_W };
