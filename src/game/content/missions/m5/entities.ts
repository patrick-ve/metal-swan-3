/**
 * Mission m5 local entities (GDD §11.0 "Mission-local entities", §11.5):
 *
 * | id | what |
 * |---|---|
 * | `organ-distant` | m5-a decor: the Grand Organ far away, growing over 600 ticks in 3 sizes (screen-fixed, behind the actors) |
 * | `m5-dusk` | m5-a: the full-screen navy fade behind the actors, alpha 0.3 × camera x / 4016 |
 * | `m5-door` | m5-b exit door (closed until `open()`) |
 * | `m5-console-tier` | m5-c keyboard tier: a one-way platform `w` wide at (x = left, y = top); a note on each landing; `collapse()` drops it away as debris |
 *
 * None of them is tagged `enemy` or `shootable`: they never hold a wave and are never hit.
 */
import type { Color } from '../../../../engine/color';
import { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';

const opts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// organ-distant
// ---------------------------------------------------------------------------------------------

/** Growth: frame 0 → 1 → 2 every `grow / 3` ticks (GDD: grows over 600 ticks in 3 sizes). */
export const ORGAN_DISTANT = { grow: 600, viewX: 300, viewY: 92, rise: 18 } as const;

export class OrganDistant extends Entity {
  private readonly grow: number;

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y);
    this.grow = Math.max(3, paramNum(params, 'grow', ORGAN_DISTANT.grow));
    this.z = 4;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    this.addTag('decor');
  }

  get frame(): number {
    return Math.min(2, Math.floor((this.age * 3) / this.grow));
  }

  override update(): void {
    // Screen-fixed: it hangs over the horizon and climbs a little as it nears.
    const cam = this.world.camera;
    const t = Math.min(1, this.age / this.grow);
    this.x = cam.left + ORGAN_DISTANT.viewX;
    this.y = cam.top + ORGAN_DISTANT.viewY - Math.round(t * ORGAN_DISTANT.rise) + Math.round(Math.sin(this.age / 40) * 2);
  }

  override draw(r: Renderer): void {
    // Hazy: it is far away (never fully opaque, so it never reads as a target).
    opts.alpha = Math.min(0.8, 0.3 + this.age / 120);
    opts.flipX = false;
    r.sprite('decor/m5/organ-distant', this.frame, this.x, this.y, opts);
    opts.alpha = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// m5-dusk
// ---------------------------------------------------------------------------------------------

/** The sky darkens over m5-a: navy at alpha 0.3 × camera x / `endX`. */
export class Dusk extends Entity {
  private readonly endX: number;
  private readonly maxAlpha: number;
  private readonly color: Color = PAL.navy[0];

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y);
    this.endX = Math.max(1, paramNum(params, 'endX', 4016));
    this.maxAlpha = paramNum(params, 'alpha', 0.3);
    this.z = 2;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    this.addTag('decor');
  }

  get alpha(): number {
    return this.maxAlpha * Math.max(0, Math.min(1, this.world.camera.x / this.endX));
  }

  override update(): void {
    this.x = this.world.camera.left;
    this.y = this.world.camera.top;
  }

  override draw(r: Renderer): void {
    const a = this.alpha;
    if (a <= 0.01) return;
    opts.alpha = a;
    opts.screen = true;
    r.rect(0, 0, this.world.camera.w, this.world.camera.h, this.color, opts);
    opts.alpha = 1;
    opts.screen = false;
  }
}

// ---------------------------------------------------------------------------------------------
// m5-door
// ---------------------------------------------------------------------------------------------

export class ExitDoor extends Entity {
  opened = false;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.z = 8;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -42, y: -52, w: 84, h: 52 };
    this.addTag('decor');
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.world.audio.sfx('machine/brake');
    this.world.camera.shake(2, 12);
    this.world.particles.dust(this.x - 30, this.y);
    this.world.particles.dust(this.x + 30, this.y);
  }

  override draw(r: Renderer): void {
    opts.alpha = 1;
    opts.flipX = false;
    r.sprite('decor/m5/door', this.opened ? 1 : 0, this.x, this.y, opts);
  }
}

// ---------------------------------------------------------------------------------------------
// m5-console-tier
// ---------------------------------------------------------------------------------------------

/** Pitches of the cosmetic step notes (tier 1 low … tier 3 high). */
const TIER_PITCH = [0.75, 1, 1.25] as const;
const MAX_PLAYERS = 2;

export class ConsoleTier extends Entity {
  readonly w: number;
  readonly box: SolidBox;
  /** 0 = tier 1 (lowest). */
  readonly level: number;
  collapsing = false;
  private fallT = 0;
  private spin = 0;
  private readonly standing: boolean[] = [false, false];

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y);
    this.w = Math.max(16, Math.round(paramNum(params, 'w', 120)));
    this.level = Math.max(0, Math.min(2, Math.round(paramNum(params, 'level', 0))));
    this.z = 32;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: this.w, h: 12 };
    this.addTag('decor', 'platform');
    this.box = world.addSolid(new SolidBox(x, y, this.w, 6, true, this));
  }

  /** The tier falls away as debris (end of stage 2): the platform is gone at once. */
  collapse(): void {
    if (this.collapsing) return;
    this.collapsing = true;
    this.world.removeSolid(this.box);
    this.vy = -1.2 - this.level * 0.3;
    this.vx = (this.level - 1) * 0.4;
    this.spin = this.level % 2 === 0 ? 1 : -1;
    this.world.audio.sfx('crate/break', { pitch: TIER_PITCH[this.level] });
  }

  override update(): void {
    if (this.collapsing) {
      this.fallT++;
      this.vy = Math.min(5, this.vy + 0.18);
      this.x += this.vx;
      this.y += this.vy;
      if (this.fallT % 6 === 0) this.world.particles.debris(this.x + this.world.fxRng.range(0, this.w), this.y + 4, 2, [PAL.brown[1], PAL.cloth[2], PAL.gold[1]]);
      if (this.y > this.world.camera.bottom + 40) this.remove();
      return;
    }
    // A note on each landing (cosmetic).
    const players = this.world.players;
    for (let i = 0; i < players.length && i < MAX_PLAYERS; i++) {
      const p = players[i];
      const on = !!p.body && p.body.onGround && p.body.supportSolid === this.box;
      const idx = (p as { index?: number }).index ?? i;
      const k = idx === 1 ? 1 : 0;
      if (on && !this.standing[k]) this.world.audio.sfx('ui/move', { pitch: TIER_PITCH[this.level], vol: 0.35 });
      this.standing[k] = on;
    }
  }

  override draw(r: Renderer): void {
    opts.flipX = false;
    opts.alpha = this.collapsing ? Math.max(0, 1 - this.fallT / 70) : 1;
    if (!this.collapsing) {
      r.sprite(`decor/m5/tier-${this.w}`, 0, this.x, this.y, opts);
      return;
    }
    // Falling: the keyboard breaks into 3 tumbling slabs.
    const seg = Math.floor(this.w / 3);
    for (let s = 0; s < 3; s++) {
      const dx = (s - 1) * this.fallT * 0.5;
      const dy = Math.abs(s - 1) * this.fallT * 0.15 * this.spin;
      opts.src = { x: s * seg, y: 0, w: seg, h: 12 };
      r.sprite(`decor/m5/tier-${this.w}`, 0, this.x + dx, this.y + dy, opts);
    }
    opts.src = undefined;
    opts.alpha = 1;
  }
}

defineEntity('organ-distant', (w, x, y, p) => new OrganDistant(w, x, y, p), {
  category: 'other',
  description: 'm5-a decor: the Grand Organ far away (grows in 3 sizes over 600 ticks).',
});
defineEntity('m5-dusk', (w, x, y, p) => new Dusk(w, x, y, p), {
  category: 'other',
  description: 'm5-a: the navy dusk fade behind the actors.',
});
defineEntity('m5-door', (w, x, y) => new ExitDoor(w, x, y), {
  category: 'other',
  description: 'm5-b exit door (open() by the script).',
});
defineEntity('m5-console-tier', (w, x, y, p) => new ConsoleTier(w, x, y, p), {
  category: 'prop',
  description: 'm5-c console keyboard tier: one-way platform; collapse() at the end of stage 2.',
});
