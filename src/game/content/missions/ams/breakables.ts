/**
 * Breakable street furniture of Amsterdam (mission `ams`): `ams-herring-cart`, `ams-tulip-stall`,
 * `ams-market-stall`, `ams-bike-rack` (pattern: props/breakables.ts). Team 'enemy', tags
 * shootable / soft / prop (never 'enemy'). Params: the table at the top of `entities.ts`.
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { awardScore } from '../../../events';
import { debris, dust, type DebrisKind } from '../../../fx';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { dropItems } from '../../items/drops';
import { spawnReveal } from '../../props/breakables';
import { sfxNear } from '../../props/common';

const drawOpts: DrawOpts = {};

// ============================================================================== breakables

interface BreakableKind {
  w: number;
  h: number;
  hp: number;
  contains: unknown;
  debris: DebrisKind;
  sfx: string;
}

export const AMS_BREAKABLES: Readonly<Record<string, BreakableKind>> = {
  'ams-herring-cart': { w: 46, h: 36, hp: 20, contains: 'cheese', debris: 'wood', sfx: 'item/crate-break' },
  'ams-tulip-stall': { w: 46, h: 34, hp: 20, contains: 'gem', debris: 'plant', sfx: 'item/crate-break' },
  'ams-market-stall': { w: 54, h: 36, hp: 30, contains: 'auto', debris: 'wood', sfx: 'item/crate-break' },
  'ams-bike-rack': { w: 50, h: 22, hp: 30, contains: 'bombs', debris: 'metal', sfx: 'hit/metal' },
};
export const AMS_BREAKABLE_SCORE = 100;

export class AmsBreakable extends Entity {
  readonly kind: BreakableKind;
  readonly sprite: string;
  broken = false;
  private readonly contains: unknown;
  private readonly reveal: unknown;
  private wobble = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams, id: string) {
    super(world, x, y);
    const k = AMS_BREAKABLES[id];
    this.kind = k;
    this.sprite = `decor/ams/${id}`;
    this.team = 'enemy';
    this.hp = this.maxHp = paramNum(p, 'hp', k.hp);
    this.contains = p.contains === undefined ? k.contains : p.contains;
    this.reveal = p.reveal;
    this.z = 24;
    this.despawnMargin = 200;
    this.hitbox = { x: -k.w / 2, y: -k.h, w: k.w, h: k.h };
    this.addTag('shootable', 'soft', 'prop');
  }

  override onHit(d: Damage): boolean {
    if (this.broken || d.amount <= 0) return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    this.wobble = 8;
    if (this.hp <= 0) this.smash(d);
    else sfxNear(this.world, this.x, this.y, 'hit/metal', 0.35, 1.3);
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
    const k = this.kind;
    debris(this.world, this.x, this.y - k.h / 2, k.debris, 8);
    dust(this.world, this.x, this.y, 4);
    this.world.audio.sfx(k.sfx);
    awardScore(this.world, d?.owner, AMS_BREAKABLE_SCORE, this.x, this.y - k.h - 4);
    dropItems(this.world, this.contains, this.x, this.y - 8);
    spawnReveal(this.world, this.reveal, this.x, this.y);
  }

  override update(): void {
    if (this.wobble > 0) this.wobble--;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = !this.broken && this.flashTicks > 0;
    const dx = this.wobble > 0 ? ((this.wobble >> 1) & 1 ? 1 : -1) : 0;
    r.sprite(this.sprite, this.broken ? 1 : 0, this.x + dx, this.y, drawOpts);
    drawOpts.flash = false;
  }
}

for (const id of Object.keys(AMS_BREAKABLES)) {
  defineEntity(id, (w, x, y, p) => new AmsBreakable(w, x, y, p, id), { category: 'prop', score: AMS_BREAKABLE_SCORE, description: `ams breakable ${id.slice(4)} (reveals items).` });
}
