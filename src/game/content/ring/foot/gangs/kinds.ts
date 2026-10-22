/**
 * The three ring gangs ON FOOT (docs/design/ring.md §R.5; docs/api/ring.md "Final jam, alight,
 * rf-a"). HP and timings are tuned for a HUMAN (the bot is faster): every tell ≥ 18 ticks on
 * screen (24–28 at NORMAL), one attack token per attack, shots along the ground at chest height
 * (a crouch ducks them), lobs that land where the hero stood (a step aside dodges them).
 *
 * - `ring-foot-rider` (the scooter gang's pillion, 20 HP, 300): the PISTOL (tell 24: the pistol
 *   comes up with a cock — one shot along the ground) and the BOTTLE lob (tell 24: the bottle
 *   cocked overhead; it smashes where it lands: glass, no blood). A hero above or below him (a car
 *   roof) gets the bottle. Params `look` ('a' red scooter's, 'b' sky-blue scooter's).
 * - `ring-foot-courier` (the parcel courier, 20 HP, 300): PARCEL lobs (tell 26: the parcel lifted
 *   overhead, `PAKKETJE!` now and then; the parcel bursts where it lands). The NIET THUIS gag
 *   (param `gag`): he stands at a stopped car and slaps a NIET THUIS card on its window (the card
 *   stays), until he notices a hero (the double-take).
 * - `ring-foot-crew` (the van crew, 50 HP, 500, heavier and slower): the CROWBAR swing up close
 *   (tell 22: raised over the shoulder; a short box in front for 6 ticks) and the SHOTGUN burst at
 *   range (tell 28: he racks it; three short-lived pellets in a narrow fan).
 *
 * Gloat lines (Dutch, once per hold, never a laugh or a point): `MOOI WEER, HE?`, `HANDTEKENING,
 * GRAAG.`, `PAUZE.`
 */
import { Entity, type Damage } from '../../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../../engine/render';
import type { World } from '../../../../../engine/world';
import { hudOf } from '../../../../context';
import type { Entity as GameEntity } from '../../../../../engine/entity';
import { debris } from '../../../../fx';
import { isPlayer } from '../../../../player/player';
import type { ImpactFn } from '../../../../projectile';
import { defineEntity, paramStr, type SpawnParams } from '../../../../registry';
import { GANG_ART } from './art';
import { FootGang, GANG, type GangSpec } from './kit';

/** Entity ids. */
export const FOOT_GANG = { rider: 'ring-foot-rider', courier: 'ring-foot-courier', crew: 'ring-foot-crew', card: 'ring-foot-card' } as const;

export const RIDER: GangSpec & { shotSpeed: number; bottleTicks: number } = { hp: 20, score: 300, walk: 0.7, hold: 120, range: 230, recover: 30, cool: 70, coolJitter: 30, shotSpeed: 2.2, bottleTicks: 46 };
export const COURIER_AI: GangSpec & { parcelTicks: number } = { hp: 20, score: 300, walk: 0.6, hold: 140, range: 250, recover: 34, cool: 80, coolJitter: 30, parcelTicks: 50 };
export const CREW_AI: GangSpec & { reach: number; swingTicks: number; pellet: number } = {
  hp: 50,
  score: 500,
  walk: 0.5,
  hold: 40,
  range: 200,
  recover: 36,
  cool: 60,
  coolJitter: 24,
  w: 16,
  h: 32,
  reach: 34,
  swingTicks: 6,
  pellet: 2.4,
};

/** Tell lengths (NORMAL base; `tele` scales them, never below 18). */
export const GANG_TELL = { shoot: 24, throw: 24, parcel: 26, swing: 22, shotgun: 28 } as const;

/** Lob gravity (px/tick²) and the shards / scraps a lob leaves. */
const LOB_G = 0.12;

/** A lob from (x0, y0) that lands at (tx, ty) after about `ticks` ticks: [speed, angle]. */
function lobAim(x0: number, y0: number, tx: number, ty: number, ticks: number): [number, number] {
  const T = Math.max(20, ticks);
  const vx = Math.max(-3, Math.min(3, (tx - x0) / T));
  const vy = (ty - y0 - 0.5 * LOB_G * T * T) / T;
  return [Math.hypot(vx, vy), Math.atan2(vy, vx)];
}

const bottleImpact: ImpactFn = (p, _target, x, y) => {
  p.world.audio.sfx('ring/bottle');
  debris(p.world, x, y, 'glass', 6);
};
const parcelImpact: ImpactFn = (p, target, x, y) => {
  p.world.audio.sfx(target ? 'ring/parcel-thud' : 'ring/parcel-tear');
  debris(p.world, x, y, 'cloth', 5);
};

/** The nearest hero's feet (or null). */
function feet(e: FootGang): { x: number; y: number } | null {
  const t = e.target();
  return t ? { x: t.x, y: t.y } : null;
}

// ---------------------------------------------------------------------------------------------
// The rider
// ---------------------------------------------------------------------------------------------

export class FootRider extends FootGang {
  private n = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const look = paramStr(p, 'look', Math.round(x / 32) % 2 === 0 ? 'a' : 'b');
    super(world, x, y, p, look === 'b' ? GANG_ART.riderB : GANG_ART.riderA, RIDER);
  }

  protected choose(t: { x: number; y: number }): string | null {
    // A hero on a roof (or below one): the bottle; else two shots to one bottle.
    if (Math.abs(t.y - this.y) > 20) return 'throw';
    return this.n++ % 3 === 2 ? 'throw' : 'shoot';
  }

  protected tellOf(kind: string): { ticks: number; sfx: string } {
    return kind === 'shoot' ? { ticks: GANG_TELL.shoot, sfx: 'ring/pistol-cock' } : { ticks: GANG_TELL.throw, sfx: 'ring/bottle-tell' };
  }

  protected strikeOf(kind: string): { strip: string; ticks: number } {
    return kind === 'shoot' ? { strip: 'shoot', ticks: 14 } : { strip: 'throw', ticks: 21 };
  }

  protected strike(kind: string): void {
    if (kind === 'shoot') {
      const m = this.point('muzzle', 12, -21);
      this.shoot({ speed: RIDER.shotSpeed, damage: 10, sprite: 'weapon/enemy-bullet', x: m[0], y: m[1], life: 170, kind: 'bullet' });
      this.world.audio.sfx('ring/foot/pistol');
      return;
    }
    const t = feet(this);
    const h = this.point('hand', 2, -38);
    const tx = t ? t.x : this.x + this.facing * 90;
    const ty = t ? t.y - 8 : this.y - 8;
    const [s, a] = lobAim(h[0], h[1], tx, ty, RIDER.bottleTicks);
    this.shoot({ speed: s, angle: a, damage: 10, sprite: 'ring/scooter/bottle', look: 'anim', gravity: LOB_G, x: h[0], y: h[1], w: 6, h: 6, life: 200, kind: 'impact', impact: bottleImpact });
    this.world.audio.sfx('ring/throw');
  }

  protected override thinkGloat(spot: GameEntity | null, t: number): void {
    super.thinkGloat(spot, t);
    if (t > 30) this.sayGloat('MOOI WEER, HE?', 90, '');
  }
}

// ---------------------------------------------------------------------------------------------
// The courier
// ---------------------------------------------------------------------------------------------

const cardOpts: DrawOpts = {};

/** The NIET THUIS card on a car window (stays while the section lasts). */
export class NietThuisCard extends Entity {
  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 6;
    this.hitbox = { x: -4, y: -4, w: 8, h: 8 };
    this.despawnMargin = 400;
  }

  override draw(r: Renderer): void {
    cardOpts.flipX = false;
    r.sprite('ring/parcel-van/card', 0, Math.round(this.x), Math.round(this.y), cardOpts);
  }
}

export class FootCourier extends FootGang {
  private n = 0;
  private carded = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, GANG_ART.courier, COURIER_AI);
    if (p.gag === true) {
      this.setMode('gag');
      this.play('stick', { restart: true, loop: false });
    }
  }

  /** The NIET THUIS card gag: slap the card on, pat it, look pleased, again (until he notices). */
  protected override thinkGag(): void {
    this.vx = 0;
    if (this.modeT === 18 && !this.carded) {
      this.carded = true;
      this.world.add(new NietThuisCard(this.world, this.x + this.facing * 12, this.y - 22));
      this.world.audio.sfx('ring/card-slap');
      hudOf(this.world).bubble(this, 'NIET THUIS!', { ticks: 60, kind: 'gag' });
    }
    if (this.anim.done && this.modeT % 90 === 0) this.play('stick', { restart: true, loop: false });
    if (this.modeT > 12 && this.gagNotices()) return;
  }

  protected choose(): string | null {
    return 'throw';
  }

  protected tellOf(): { ticks: number; sfx: string; say?: string } {
    return { ticks: GANG_TELL.parcel, sfx: 'ring/parcel-lift', say: this.n++ % 2 === 0 ? 'PAKKETJE!' : undefined };
  }

  protected strikeOf(): { strip: string; ticks: number } {
    return { strip: 'throw', ticks: 21 };
  }

  protected strike(): void {
    const t = feet(this);
    const h = this.point('hand', 0, -40);
    const tx = t ? t.x : this.x + this.facing * 100;
    const ty = t ? t.y - 6 : this.y - 6;
    const [s, a] = lobAim(h[0], h[1], tx, ty, COURIER_AI.parcelTicks);
    this.shoot({ speed: s, angle: a, damage: 10, sprite: 'ring/parcel-van/parcel', look: 'anim', gravity: LOB_G, x: h[0], y: h[1], w: 8, h: 7, life: 200, kind: 'impact', impact: parcelImpact });
    this.world.audio.sfx('ring/throw');
  }

  protected override thinkGloat(spot: GameEntity | null, t: number): void {
    super.thinkGloat(spot, t);
    if (t > 30) this.sayGloat('HANDTEKENING, GRAAG.', 90, '');
  }
}

// ---------------------------------------------------------------------------------------------
// The van crew
// ---------------------------------------------------------------------------------------------

export class FootCrew extends FootGang {
  private struck = new Set<GameEntity>();

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, GANG_ART.crew, CREW_AI);
  }

  protected choose(t: { x: number; y: number }, dist: number): string | null {
    const level = Math.abs(t.y - this.y) <= 16;
    if (level && dist <= CREW_AI.reach) return 'swing';
    if (Math.abs(t.y - this.y) <= GANG.dy && dist <= CREW_AI.range && dist > CREW_AI.reach + 16) return 'shoot';
    return null;
  }

  protected tellOf(kind: string): { ticks: number; sfx: string; say?: string } {
    return kind === 'swing' ? { ticks: GANG_TELL.swing, sfx: 'ring/foot/crowbar-tell', say: 'OPZIJ!' } : { ticks: GANG_TELL.shotgun, sfx: 'ring/foot/pump' };
  }

  protected strikeOf(kind: string): { strip: string; ticks: number } {
    return kind === 'swing' ? { strip: 'swing', ticks: 19 } : { strip: 'shoot', ticks: 17 };
  }

  protected strike(kind: string): void {
    if (kind === 'swing') {
      this.struck.clear();
      this.world.audio.sfx('ring/foot/crowbar');
      return;
    }
    const m = this.point('muzzle', 16, -20);
    const base = this.facing > 0 ? 0 : Math.PI;
    for (const da of [-0.12, 0, 0.12]) {
      this.shoot({ speed: CREW_AI.pellet, angle: base + da * this.facing, damage: 10, sprite: 'weapon/enemy-bullet', x: m[0], y: m[1], life: 70, kind: 'bullet' });
    }
    this.world.audio.sfx('ring/foot/shotgun');
  }

  /** The swing's box: in front of him, from the knees to above the head, for `swingTicks`. */
  protected override during(kind: string, t: number): void {
    if (kind !== 'swing' || t < 1 || t > CREW_AI.swingTicks) return;
    const x0 = this.facing > 0 ? this.x + 2 : this.x - 30;
    const list = this.world.byTag('player');
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p) || !p.alive || p.state !== 'play' || this.struck.has(p)) continue;
      const r = p.hitRect();
      if (r.x < x0 + 28 && r.x + r.w > x0 && r.y < this.y - 4 && r.y + r.h > this.y - 40) {
        this.struck.add(p);
        const hit: Damage = { amount: 10, kind: 'impact', dirX: this.facing, source: this };
        this.world.damage(p, hit);
      }
    }
  }

  protected override thinkGloat(spot: GameEntity | null, t: number): void {
    super.thinkGloat(spot, t);
    if (t > 40) this.sayGloat('PAUZE.', 80, '');
  }
}

defineEntity(FOOT_GANG.rider, (w, x, y, p) => new FootRider(w, x, y, p), {
  category: 'enemy',
  score: RIDER.score,
  description: 'Ring scooter gang on foot (rf-a): pistol along the ground (tell 24), bottle lob (tell 24; at heroes on roofs); bloodless: rolls, sits dazed, runs off (params look a|b, enter, hold).',
});
defineEntity(FOOT_GANG.courier, (w, x, y, p) => new FootCourier(w, x, y, p), {
  category: 'enemy',
  score: COURIER_AI.score,
  description: 'Ring parcel courier on foot (rf-a): parcel lobs (tell 26, PAKKETJE!), the NIET THUIS card gag (param gag); bloodless.',
});
defineEntity(FOOT_GANG.crew, (w, x, y, p) => new FootCrew(w, x, y, p), {
  category: 'enemy',
  score: CREW_AI.score,
  description: 'Ring van crew on foot (rf-a): crowbar swing up close (tell 22), shotgun burst of 3 short pellets (tell 28); 50 HP; bloodless.',
});
