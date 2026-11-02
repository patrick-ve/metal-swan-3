/**
 * The statiegeld bin of mission oat, `oat-bin` (docs/design/oat.md §6.1, §8.11, §7.10): the city's
 * 100 L and 200 L street bins on the pavement bulbs of the walk plane. HP 30; shot dead it bursts
 * (100 L) or tips and spills (200 L): 4–8 cans and bottles fly out (cans.ts), bounce and settle.
 *
 * - Params: `size` (100 | 200, default 100: 20 / 24 px tall), `hp` (30), `seed` (an extra salt for
 *   the spill; default 0).
 * - The spill rolls with the bin's OWN rng (seeded from the world's seed, the bin's place and
 *   `seed`), never `world.rng` (spec §7.10: no gameplay rng call on a shared path). Same world seed
 *   and place → the same cans, the same flight.
 * - Team 'enemy' so player shots, blasts and the knife hit it; tags `shootable`, `soft`, `oat-bin`
 *   (never 'enemy': no kill, no wave; never 'prop': it pays nothing itself, its cans pay). The
 *   wreck stays as decor (frame 1, mirrored to the side the 200 L falls).
 * - Deposit hunters are never enemies or targets; no animals take the cans in this build.
 *
 * ```ts
 * world.spawn('oat-bin', 600, floorY, { size: 200 });
 * ```
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { mix32, Rng } from '../../../../engine/rng';
import type { World } from '../../../../engine/world';
import { debris, dust } from '../../../fx';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { OAT_PIECE } from '../../missions/oat/ids';
import { sfxNear } from '../../props/common';
import { BIN_SPRITE } from './art';
import { spawnDeposit, type DepositId } from './cans';

export type BinSize = 100 | 200;

/** The start values of spec §6.1. */
export const BIN = {
  hp: 30,
  /** Pickups per bin (inclusive). */
  minDrops: 4,
  maxDrops: 8,
  /** Body size (logical px) per size. */
  w: { 100: 14, 200: 16 } as const,
  h: { 100: 20, 200: 24 } as const,
  /** The mix of the spill: a can half the time, a small bottle 30 %, a big bottle 20 %. */
  canShare: 0.5,
  smallShare: 0.3,
} as const;

const drawOpts: DrawOpts = {};

/** The bin's own spill rng: the world's seed, the bin's place (whole px) and a salt. */
export function binRng(world: World, x: number, y: number, salt = 0): Rng {
  const h = mix32(world.rng.seed ^ mix32(Math.round(x) | 0) ^ mix32((Math.round(y) | 0) + 0x3c6ef372) ^ mix32((salt | 0) + 0x5be0cd19));
  return new Rng(h);
}

export class OatBin extends Entity {
  readonly size: BinSize;
  broken = false;
  private readonly salt: number;
  private wobble = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.size = paramNum(p, 'size', 100) >= 200 ? 200 : 100;
    this.salt = Math.floor(paramNum(p, 'seed', 0));
    this.team = 'enemy';
    this.hp = this.maxHp = paramNum(p, 'hp', BIN.hp);
    this.z = 24;
    this.despawnMargin = 200;
    const w = BIN.w[this.size];
    const h = BIN.h[this.size];
    this.hitbox = { x: -w / 2, y: -h, w, h };
    this.addTag('shootable', 'soft', 'oat-bin');
  }

  override onHit(d: Damage): boolean {
    if (this.broken || d.amount <= 0) return false;
    // Any knife or explosion breaks it at once (the crate rule); other hits chip its 30 HP.
    this.hp -= d.kind === 'knife' || d.kind === 'explosion' ? this.hp : d.amount;
    this.flashTicks = 3;
    this.wobble = 8;
    if (this.hp <= 0) this.smash(d);
    else sfxNear(this.world, this.x, this.y, 'hit/metal', 0.35, 1.2);
    return true;
  }

  override die(d?: Damage): void {
    this.smash(d);
  }

  private smash(d?: Damage): void {
    if (this.broken) return;
    this.broken = true;
    this.dead = true;
    this.removeTag('shootable');
    this.removeTag('soft');
    // The 200 L tips away from the shot.
    if (d && d.dirX !== 0) this.facing = d.dirX < 0 ? -1 : 1;
    const h = BIN.h[this.size];
    debris(this.world, this.x, this.y - h / 2, 'metal', 6);
    dust(this.world, this.x, this.y, 4);
    sfxNear(this.world, this.x, this.y, 'hit/metal', 0.8, 0.7);
    this.spill();
  }

  /** 4–8 pickups fly out (the bin's own rng): a burst both ways (100 L), a spill to the falling side (200 L). */
  private spill(): void {
    const rng = binRng(this.world, this.x, this.y, this.salt);
    const n = rng.int(BIN.minDrops, BIN.maxDrops);
    const h = BIN.h[this.size];
    for (let i = 0; i < n; i++) {
      const r = rng.next();
      const id: DepositId = r < BIN.canShare ? OAT_PIECE.can : r < BIN.canShare + BIN.smallShare ? OAT_PIECE.bottleS : OAT_PIECE.bottleL;
      let vx: number;
      let vy: number;
      let x: number;
      let y: number;
      if (this.size === 100) {
        vx = rng.range(-2.2, 2.2);
        vy = -rng.range(2, 3.6);
        x = this.x + rng.range(-4, 4);
        y = this.y - h + 4;
      } else {
        vx = this.facing * rng.range(0.6, 2.6);
        vy = -rng.range(0.8, 2.2);
        x = this.x + this.facing * rng.range(6, 12);
        y = this.y - 4;
      }
      spawnDeposit(this.world, id, x, y, vx, vy);
    }
  }

  override update(): void {
    if (this.wobble > 0) this.wobble--;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.broken && this.facing < 0;
    drawOpts.flash = !this.broken && this.flashTicks > 0;
    const dx = this.wobble > 0 ? ((this.wobble >> 1) & 1 ? 1 : -1) : 0;
    r.sprite(BIN_SPRITE[this.size], this.broken ? 1 : 0, this.x + dx, this.y, drawOpts);
    drawOpts.flash = false;
  }
}

defineEntity(OAT_PIECE.bin, (w, x, y, p) => new OatBin(w, x, y, p), {
  category: 'prop',
  description: 'oat statiegeld bin (params size 100 | 200, hp, seed): shot dead it spills 4-8 cans and bottles.',
});
