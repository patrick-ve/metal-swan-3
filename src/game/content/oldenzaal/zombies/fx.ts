/**
 * Mission oldenzaal — the dead soldiers' effects (revision 2, spec §3). Owner: ZOMBIES.
 *
 * | id | category | params |
 * |---|---|---|
 * | `oz-bones` | fx | `art` (the body set's sprite prefix), `head`, `facing`, `kind`, `broken` (the MG), `vx` (a blast's push): the collapse — the body sags and folds (the head on it), crumbles into bones and dust (the helmet rolls away), the pile lies `COLLAPSE.lie` ticks, then blinks out. Bloodless. |
 * | `oz-helmet` | fx | `gear` ('helm' / 'cap'), `vx`, `vy`, `flip`: a helmet (or a field cap) knocked off: it flies, bounces, rolls and lies, then blinks out |
 * | `oz-rise` | fx | `look` ('pavers' / 'earth' / 'stone' / 'manhole'), `tell` (ticks): the floor cracks (the tell) and breaks open (`open()`) where a zombie climbs out; the hole lingers, then fades |
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { dust } from '../../../fx';
import { defineEntity, paramNum, paramStr } from '../../../registry';
import { OZ_ZOMBIES } from '../../missions/oldenzaal/ids';
import { ZTABLE } from './art';
import { HEADS, type HeadName } from './art-head';
import { DUST_ID, GUN_ANGLES, MG_GUN, RISE_FRAMES, gunAngleIndex, mgGunFrame, riseId, type RiseLook } from './art-gear';
import { COLLAPSE } from './numbers';
import { ZSFX, drawOverlays } from './soldier';

const opts: DrawOpts = {};

/** The collapse (see the module comment). */
export class OzBones extends Entity {
  private readonly strip: string;
  private readonly head: HeadName;
  private readonly kind: string;
  private readonly broken: boolean;
  private frame = 0;
  private ft = 0;
  private t = 0;
  private lying = 0;
  private dropped = false;
  private readonly durations: readonly number[];

  constructor(world: World, x: number, y: number, art: string, head: HeadName, facing: number, kind: string, broken: boolean, vx: number) {
    super(world, x, y);
    this.strip = `${art}/die`;
    this.head = head in HEADS ? head : 'bare-a';
    this.kind = kind;
    this.broken = broken;
    this.facing = facing < 0 ? -1 : 1;
    this.vx = vx;
    this.z = 25;
    this.team = 'neutral';
    this.despawnMargin = 96;
    this.addTag('fx');
    const n = ZTABLE.get(this.strip)?.length ?? 6;
    this.durations = n === 5 ? [8, 10, 8, 8, 9999] : [8, 8, 10, 8, 8, 9999];
  }

  private get frames(): number {
    return ZTABLE.get(this.strip)?.length ?? 6;
  }

  override update(): void {
    const w = this.world;
    this.t++;
    // A blast's push dies away; the body stays on its floor.
    if (this.vx !== 0) {
      const nx = this.x + this.vx;
      const fy = w.terrain.surfaceY(nx, this.y - 6, this.y + 8);
      if (Number.isFinite(fy) && Math.abs(fy - this.y) <= 4 && !w.terrain.isSolid(nx, this.y - 8)) {
        this.x = nx;
        this.y = fy;
      }
      this.vx *= 0.85;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
    if (this.frame < this.frames - 1) {
      if (++this.ft >= this.durations[Math.min(this.frame, this.durations.length - 1)]) {
        this.ft = 0;
        this.frame++;
        const info = ZTABLE.get(this.strip)?.[this.frame];
        if (info && info.head < 0 && !this.dropped) this.crumble();
      }
      return;
    }
    if (++this.lying >= COLLAPSE.lie + COLLAPSE.blink) this.remove();
  }

  /** The head falls into the pile: the helmet / cap rolls away, dust bursts, the bones rattle down. */
  private crumble(): void {
    this.dropped = true;
    const w = this.world;
    const gear = HEADS[this.head].gear;
    if (gear !== 'bare') w.spawn(OZ_ZOMBIES.helmet, this.x + this.facing * 6, this.y - 10, { gear, vx: this.facing * 0.9, vy: -1.6, flip: this.facing < 0 });
    dust(w, this.x, this.y - 6, 8);
    w.audio.sfx(ZSFX.collapse, { vol: 0.8 });
  }

  override draw(r: Renderer): void {
    if (this.lying > COLLAPSE.lie && this.lying % 4 < 2) return;
    opts.flipX = this.facing < 0;
    opts.alpha = undefined;
    r.sprite(this.strip, this.frame, Math.round(this.x), Math.round(this.y), opts);
    const info = ZTABLE.get(this.strip)?.[this.frame];
    if (info) drawOverlays(r, this, this.strip, this.frame, info, this.facing, this.head, false, this.broken, NaN, false);
    // The MG falls beside the pile and lies there.
    if (this.kind === 'gunner' && (!info || !info.gun)) {
      opts.flipX = this.facing < 0;
      r.sprite(MG_GUN.carry, mgGunFrame(gunAngleIndex(0), this.broken), Math.round(this.x) + this.facing * 4, Math.round(this.y) - 3, opts);
    }
    // The bone dust rises off the crumbling body.
    if (this.dropped && this.frame >= this.frames - 3) {
      const k = Math.min(4, Math.floor((this.t - 30) / 6));
      if (k >= 0 && k < 5 && this.lying < 30) {
        opts.flipX = false;
        opts.alpha = 0.55;
        r.sprite(DUST_ID, k, Math.round(this.x), Math.round(this.y), opts);
        opts.alpha = undefined;
      }
    }
  }
}

/** A helmet / cap knocked off (see the module comment). */
export class OzHelmet extends Entity {
  private readonly sprite: string;
  private turn = 0;
  private settled = 0;
  private bounces = 0;

  constructor(world: World, x: number, y: number, gear: string, vx: number, vy: number, flip: boolean) {
    super(world, x, y);
    this.sprite = gear === 'cap' ? 'fx/oz/zombie/cap' : 'fx/oz/zombie/helmet';
    this.vx = vx;
    this.vy = vy;
    this.facing = flip ? -1 : 1;
    this.z = 34;
    this.team = 'neutral';
    this.despawnMargin = 64;
    this.addTag('fx');
  }

  override update(): void {
    const w = this.world;
    if (this.settled > 0) {
      if (++this.settled > 150) this.remove();
      return;
    }
    this.vy += 0.2;
    const nx = this.x + this.vx;
    const ny = this.y + this.vy;
    if (w.terrain.isSolid(nx, this.y - 2)) this.vx = -this.vx * 0.4;
    else this.x = nx;
    const fy = w.terrain.surfaceY(this.x, this.y - 4, ny + 2);
    if (this.vy > 0 && Number.isFinite(fy) && ny >= fy - 2) {
      this.y = fy - 2;
      if (this.bounces < 2 && this.vy > 0.8) {
        this.vy = -this.vy * 0.35;
        this.vx *= 0.7;
        this.bounces++;
        w.audio.sfx('oz/zombie/helmet', { vol: 0.35 });
      } else {
        // It rolls a little, then lies (upside down or on its side).
        this.vy = 0;
        this.vx *= 0.9;
        if (Math.abs(this.vx) < 0.08) {
          this.vx = 0;
          this.settled = 1;
        }
      }
    } else this.y = ny;
    this.turn += Math.abs(this.vx) * 0.35 + (this.bounces === 0 ? 0.2 : 0);
    if (this.y > w.terrain.bounds.y + w.terrain.bounds.h + 32) this.remove();
  }

  override draw(r: Renderer): void {
    if (this.settled > 120 && this.settled % 4 < 2) return;
    opts.flipX = this.facing < 0;
    opts.alpha = undefined;
    const f = this.settled > 0 ? 4 : Math.floor(this.turn) % 8;
    r.sprite(this.sprite, f, Math.round(this.x), Math.round(this.y), opts);
  }
}

/** The cracks and the hole of a rise (see the module comment). */
export class OzRise extends Entity {
  private readonly sprite: string;
  private readonly tell: number;
  private t = 0;
  private openedAt = -1;

  constructor(world: World, x: number, y: number, look: RiseLook, tell: number) {
    super(world, x, y);
    this.sprite = riseId(look);
    this.tell = Math.max(1, tell);
    this.z = 18;
    this.team = 'neutral';
    this.despawnMargin = 96;
    this.addTag('fx');
  }

  /** It breaks open now (idempotent). */
  open(): void {
    if (this.openedAt >= 0) return;
    this.openedAt = this.t;
    dust(this.world, this.x, this.y - 2, 5);
  }

  override update(): void {
    this.t++;
    if (this.openedAt >= 0 && this.t - this.openedAt > 600) this.remove();
  }

  override draw(r: Renderer): void {
    let f: number;
    let dx = 0;
    if (this.openedAt < 0) {
      f = Math.min(2, Math.floor((this.t / this.tell) * 3));
      if (this.sprite.endsWith('manhole') && this.t % 6 < 3) dx = 1; // the cover rattles
    } else f = this.t - this.openedAt < 8 ? 3 : RISE_FRAMES - 1;
    const age = this.openedAt >= 0 ? this.t - this.openedAt : 0;
    opts.flipX = false;
    opts.alpha = age > 540 ? Math.max(0, (600 - age) / 60) : undefined;
    r.sprite(this.sprite, f, Math.round(this.x) + dx, Math.round(this.y), opts);
    opts.alpha = undefined;
  }
}

defineEntity(
  OZ_ZOMBIES.bones,
  (w, x, y, p) =>
    new OzBones(w, x, y, paramStr(p, 'art', 'enemy/oz-grunt/tunic'), paramStr(p, 'head', 'bare-a') as HeadName, paramNum(p, 'facing', 1), paramStr(p, 'kind', 'grunt'), p.broken === true, paramNum(p, 'vx', 0)),
  { category: 'fx', description: 'oldenzaal: a dead soldier collapses into bones and dust (bloodless); the helmet rolls away.' },
);
defineEntity(OZ_ZOMBIES.helmet, (w, x, y, p) => new OzHelmet(w, x, y, paramStr(p, 'gear', 'helm'), paramNum(p, 'vx', 1), paramNum(p, 'vy', -2), p.flip === true), {
  category: 'fx',
  description: 'oldenzaal: a steel helmet (or a field cap) knocked off a dead soldier: it flies, bounces, rolls and lies.',
});
defineEntity(OZ_ZOMBIES.rise, (w, x, y, p) => new OzRise(w, x, y, paramStr(p, 'look', 'pavers') as RiseLook, paramNum(p, 'tell', 30)), {
  category: 'fx',
  description: 'oldenzaal: the floor cracks and breaks open where a dead soldier climbs out (pavers, earth, stone, a drain cover).',
});

export { GUN_ANGLES };
