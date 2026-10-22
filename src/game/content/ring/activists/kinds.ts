/**
 * The four activist kinds of EXHAUSTING REBELLION (wave B; docs/design/ring.md §R.6; docs/api/ring.md
 * "R.B1"). Fictional, likeable comic characters (two looks each, looks.ts); small HP (1–3 hits); every
 * tell ≥ 18 ticks on screen; their throws hurt like enemy shots (10); bloodless exits (kit.ts).
 *
 * - `ring-lijmer` (20 HP, 100): glued to the asphalt (a fixed turret, one palm stuck to the road).
 *   PAINT BALLOONS (tell 26: the balloon raised and wobbling) burst in bright splats; every third
 *   attack, when a hero stands within 170 px, the GLUE POT (tell 30) leaves a puddle that sticks a
 *   hero ~40 ticks (no move, no jump; can still shoot). Beaten: the glue lets go with a rip (`LOS!`),
 *   they stand up and stomp off in a huff.
 * - `ring-ketting` (30 HP, 150): chained to a barrel (default) or to a partner (`anchor: 'partner'`
 *   spawns the partner, another `ketting` chained wrist to wrist, same tag). SOUP CANS (tell 24: the
 *   can shaken overhead): the can is the hit, the soup splashes ORANGE. Beaten: the chain snaps
 *   (`MIJN KETTING!`), they sit stiff with crossed arms and a police pair carries them off as a plank.
 * - `ring-megafoon` (20 HP, 150): on a crate with a megaphone. The SHOUT (tell 24, `TOETER NIET, DOE
 *   MEE!` now and then): a sound ring rolls along the ground and pushes a hero back (no damage; a jump
 *   clears it). Every third attack, a hero within 128 px in front: the FEEDBACK SQUEAL (tell 32: the
 *   megaphone whines, they wince) stuns ~20 ticks. Beaten: the megaphone squeals, they hop off and run.
 * - `ring-loper` (10 HP, 100): runs in with a banner on a stick (`enter`), SITS DOWN AND GLUES at
 *   `sitAt` (the 40-tick tell, `ZITTEN BLIJVEN!`) and becomes a lijmer (balloons, the glue pot). Hit
 *   before the glue sets: drops the banner (`IK BEL MIJN MOEDER!`) and runs off.
 *
 * The in-world continue (never a laugh or a point): the lijmer hums with the eyes shut (notes rise),
 * the ketting and the glued loper hold up `WIJ HADDEN HET GEZEGD`, the megafoon eats a sandwich and
 * offers half; the cower: hands over their heads.
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import type { ReactionKind } from '../../../enemy';
import { dust } from '../../../fx';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { ACTIVIST, ACTIVIST_TUNE, KETTING_REACH, LOPER_SIT_AHEAD } from './api';
import { Activist, type ActSpec } from './kit';
import { ACT_ART, PAINT_COLOURS } from './looks';
import { balloonImpact, canImpact, potImpact, ShoutRing } from './fx';
import { callPoliceImpl } from './police';
import { stunHero } from './status';

export const LIJMER: ActSpec = { hp: 20, score: 100, range: 260, recover: 26, cool: 100, coolJitter: 24, w: 16, h: 25 };
export const KETTING: ActSpec = { hp: 30, score: 150, range: 250, recover: 26, cool: 96, coolJitter: 24, w: 16, h: 25 };
export const MEGAFOON: ActSpec = { hp: 20, score: 150, range: 220, recover: 30, cool: 110, coolJitter: 24, w: 14, h: 28 };
export const LOPER: ActSpec = { ...LIJMER, hp: 10 };

/** Tell lengths (NORMAL base; `tele` scales them, never below 18). */
export const ACT_TELL = { lob: 26, pot: 30, throw: 24, shout: 24, squeal: 32 } as const;
/** Flight times of the lobs (ticks). */
export const LOB_TICKS = { balloon: 52, pot: 48, can: 44 } as const;
/** The megaphone's crate (px) and the squeal's reach. */
export const CRATE_H = 9;
export const SQUEAL_REACH = 128;
/** The loper's run-in speed. */
export const LOPER_RUN = 1.4;

const propOpts: DrawOpts = {};

/** A prop left on the road (the barrel, the crate, a dropped banner): decor, stays until despawn. */
export class RoadProp extends Entity {
  frame = 0;
  readonly sprite: string;
  constructor(world: World, x: number, y: number, sprite: string, facing: 1 | -1 = 1) {
    super(world, x, y);
    this.sprite = sprite;
    this.team = 'neutral';
    this.z = 8;
    this.facing = facing;
    this.hitbox = { x: -8, y: -14, w: 16, h: 14 };
    this.despawnMargin = 160;
  }
  override draw(r: Renderer): void {
    propOpts.flipX = this.facing < 0;
    r.sprite(this.sprite, this.frame, Math.round(this.x), Math.round(this.y), propOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The lijmer (and the glued loper)
// ---------------------------------------------------------------------------------------------

/** A glued sitter's attacks: paint balloons, every third (a hero close) the glue pot. */
function sitterChoose(n: number, dist: number, t: Entity): string {
  const grounded = isPlayer(t) ? t.body.onGround : true;
  return n % 3 === 2 && dist <= 170 && grounded ? 'pot' : 'lob';
}

export class Lijmer extends Activist {
  constructor(world: World, x: number, y: number, p: SpawnParams, spec: ActSpec = LIJMER, kind: 'lijmer' | 'loper' = 'lijmer') {
    super(world, x, y, p, kind, spec);
    this.play('sit');
  }

  protected choose(t: Entity, dist: number): string | null {
    return sitterChoose(this.n, dist, t);
  }

  protected tellOf(a: string): { ticks: number; sfx: string; say?: 'zitten' | 'lijm' | 'klimaatnood' } {
    if (a === 'pot') return { ticks: ACT_TELL.pot, sfx: 'ring/act/pot-tell', say: this.n % 2 === 0 ? 'lijm' : undefined };
    const say = this.n % 4 === 1 ? (this.n % 8 === 1 ? 'zitten' : 'klimaatnood') : undefined;
    return { ticks: ACT_TELL.lob, sfx: 'ring/act/balloon-tell', say };
  }

  protected strikeOf(a: string): { strip: string; ticks: number } {
    return { strip: a === 'pot' ? 'pot' : 'lob', ticks: 16 };
  }

  protected strike(a: string): void {
    if (a === 'pot') this.lob(ACT_ART.pot, LOB_TICKS.pot, potImpact, 7, 7);
    else {
      const c = PAINT_COLOURS[(this.n + (this.look === 'b' ? 2 : 0)) % PAINT_COLOURS.length];
      this.lob(`${ACT_ART.balloon}-${c}`, LOB_TICKS.balloon, balloonImpact(c), 7, 7);
    }
  }

  /** The glue lets go with a rip (`LOS!`), then off in a huff. */
  protected beaten(_d: Damage): void {
    this.say('los', 50);
    this.world.audio.sfx('ring/act/rip');
    this.play('rip', { restart: true, loop: false });
    this.markRunoff();
  }

  protected override exitDone(): void {
    this.runOff('huff');
    if (this.n % 2 === 1) this.world.audio.sfx('ring/act/huff');
  }

  protected override thinkGloat(_spot: Entity | null, t: number): void {
    // Humming with the eyes shut, swaying (never a laugh or a point).
    this.play('gloat');
    if (t % 90 === 10) this.world.audio.sfx('ring/act/hum', { vol: 0.5 });
  }

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.reaction === 'gloat' && !this.dead && this.kind === 'lijmer') {
      // The notes of the hum rise and drift.
      const t = this.world.tick;
      for (let i = 0; i < 2; i++) {
        const k = (t + i * 30) % 60;
        const nx = Math.round(this.x + this.facing * (5 + (k >> 3)) + (((k >> 2) & 1) === 0 ? 0 : 1));
        const ny = Math.round(this.y - 26 - k / 3);
        if (k < 54) r.sprite(ACT_ART.note, i, nx, ny, propOpts);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The ketting
// ---------------------------------------------------------------------------------------------

const linkOpts: DrawOpts = {};

export class Ketting extends Activist {
  readonly anchor: 'barrel' | 'partner' | 'linked';
  /** The chained partner (the one with anchor 'partner' owns the chain between them). */
  partner: Ketting | null = null;
  private placed = false;
  private snapped = false;
  private police = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, 'ketting', KETTING);
    const a = paramStr(p, 'anchor', 'barrel');
    this.anchor = a === 'partner' ? 'partner' : a === 'linked' ? 'linked' : 'barrel';
    this.play('sit');
  }

  /** The anchor's x (the barrel's middle or the partner's hip). */
  anchorX(): number {
    return this.x - this.facing * KETTING_REACH;
  }

  protected override thinkIdle(): void {
    if (!this.placed) this.place();
    super.thinkIdle();
  }

  /** Once: the barrel on the road, or the partner beside (chained wrist to wrist). */
  private place(): void {
    this.placed = true;
    if (this.anchor === 'barrel') {
      // `barrel: 'layout'`: chained to a barrel the section already paints there (no prop of its own).
      if (paramStr(this.params, 'barrel', 'own') !== 'layout') this.world.add(new RoadProp(this.world, this.anchorX(), this.y, ACT_ART.barrel, this.facing));
    }
    else if (this.anchor === 'partner') {
      const tag = paramStr(this.params, 'tag', '');
      const mate = this.world.spawn(ACTIVIST.ketting, this.anchorX(), this.y, {
        anchor: 'linked',
        facing: this.facing,
        look: this.look === 'a' ? 'b' : 'a',
        wait: paramNum(this.params, 'wait', 60) + 40,
        ...(tag ? { tag } : {}),
      });
      if (mate instanceof Ketting) {
        this.partner = mate;
        mate.partner = this;
      }
    }
  }

  protected choose(): string | null {
    return 'throw';
  }

  protected tellOf(): { ticks: number; sfx: string; say?: 'klimaatnood' | 'zitten' } {
    return { ticks: ACT_TELL.throw, sfx: 'ring/act/can-tell', say: this.n % 4 === 2 ? 'klimaatnood' : undefined };
  }

  protected strikeOf(): { strip: string; ticks: number } {
    return { strip: 'throw', ticks: 16 };
  }

  protected strike(): void {
    this.lob(ACT_ART.can, LOB_TICKS.can, canImpact, 6, 7);
  }

  /** The chain snaps (`MIJN KETTING!`); they sit stiff, arms crossed; the police come. */
  protected beaten(_d: Damage): void {
    this.snapped = true;
    if (this.partner) this.partner.snapped = true;
    this.say('ketting', 70);
    this.world.audio.sfx('ring/act/snap');
    this.play('snap', { restart: true, loop: false });
  }

  protected override exitMax(): number {
    return 40;
  }

  protected override exitDone(): void {
    this.endPhase = 'wait';
    this.leaveSign();
    if (this.police) return;
    this.police = true;
    this.out = 'carried';
    callPoliceImpl(this.world, this, { kind: 'ketting' });
  }

  protected override thinkGloat(): void {
    // Holds up the sign: WIJ HADDEN HET GEZEGD.
    this.play('gloat');
  }

  protected override signAt(out: [string, number, number]): [string, number, number] | null {
    if (this.reaction === 'gloat' && !this.dead) return heldSign(this, out);
    return super.signAt(out);
  }

  protected override signBehind(): boolean {
    return this.reaction !== 'gloat';
  }

  override draw(r: Renderer): void {
    // The chain: from the waist to the barrel / the partner (snapped: two short ends).
    if (!this.carried && this.anchor !== 'linked' && !this.removed) {
      linkOpts.flipX = this.facing < 0;
      const mateGone = this.anchor === 'partner' && (!this.partner || this.partner.removed || this.partner.carried);
      r.sprite(ACT_ART.links, this.snapped || mateGone || (this.partner?.snapped ?? false) ? 1 : 0, Math.round(this.x), Math.round(this.y), linkOpts);
    }
    super.draw(r);
  }
}

/** The continue sign held overhead with both hands (the gloat strip's `hand` point). */
function heldSign(e: Activist, out: [string, number, number]): [string, number, number] {
  const h = e.point('hand', 2, -30);
  out[0] = ACT_ART.signGezegd;
  out[1] = h[0];
  out[2] = h[1] + 4;
  return out;
}

// ---------------------------------------------------------------------------------------------
// The megafoon
// ---------------------------------------------------------------------------------------------

export class Megafoon extends Activist {
  private placed = false;
  private hop = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, 'megafoon', MEGAFOON);
    // Standing on the crate: the body (and its hit box) is the crate's height up.
    this.hitbox = { x: this.hitbox.x, y: this.hitbox.y - CRATE_H, w: this.hitbox.w, h: this.hitbox.h };
    this.play('idle');
  }

  protected override rest(): string {
    return 'idle';
  }

  protected override handInView(): boolean {
    return this.inView(this.x + this.facing * 10, this.y - 24 - CRATE_H, -8);
  }

  protected override liftPx(): number {
    return this.dead ? Math.max(0, CRATE_H - this.hop) : CRATE_H;
  }

  protected override thinkIdle(): void {
    if (!this.placed) {
      this.placed = true;
      this.world.add(new RoadProp(this.world, this.x, this.y, ACT_ART.crate, 1));
    }
    super.thinkIdle();
  }

  protected choose(t: Entity, dist: number): string | null {
    const close = dist <= SQUEAL_REACH && Math.abs(t.y - this.y) <= 30;
    return this.n % 3 === 2 && close ? 'squeal' : 'shout';
  }

  protected tellOf(a: string): { ticks: number; sfx: string; say?: 'toeter' } {
    if (a === 'squeal') return { ticks: ACT_TELL.squeal, sfx: 'ring/act/squeal-tell' };
    return { ticks: ACT_TELL.shout, sfx: 'ring/act/shout-tell', say: this.n % 3 === 0 ? 'toeter' : undefined };
  }

  protected strikeOf(a: string): { strip: string; ticks: number } {
    return a === 'squeal' ? { strip: 'squeal', ticks: 20 } : { strip: 'shout', ticks: 16 };
  }

  protected strike(a: string): void {
    if (a === 'squeal') {
      this.world.audio.sfx('ring/act/squeal');
      const list = this.world.alivePlayers();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!isPlayer(p) || p.state !== 'play') continue;
        const dx = (p.x - this.x) * this.facing;
        if (dx >= -8 && dx <= SQUEAL_REACH && Math.abs(p.y - this.y) <= 30) stunHero(p);
      }
      return;
    }
    this.world.audio.sfx('ring/act/shout');
    this.world.add(new ShoutRing(this.world, this.x + this.facing * 14, this.y, this.facing));
  }

  /** The megaphone squeals, they hop off the crate and run. */
  protected beaten(_d: Damage): void {
    this.hop = 0;
    this.world.audio.sfx('ring/act/squeal-out');
    this.play('hop', { restart: true, loop: false });
    if (this.n % 2 === 0) this.sayOff();
    this.markRunoff();
  }

  protected override updateDeath(): void {
    if (this.endPhase === 'exit' && this.hop < CRATE_H) this.hop = Math.min(CRATE_H, this.hop + 1);
    super.updateDeath();
  }

  protected override exitMax(): number {
    return 30;
  }

  protected override exitDone(): void {
    this.runOff('flee');
  }

  protected override thinkGloat(): void {
    // A sandwich: a bite, chewing, offering half (never a laugh or a point).
    this.play('gloat');
  }

  override draw(r: Renderer): void {
    super.draw(r);
    // The squeal's whine: zig-zag waves out of the megaphone (the tell's second half and the strike).
    if (this.dead || this.attack !== 'squeal') return;
    const on = (this.mode === 'tell' && this.modeT >= this.telegraph / 2) || this.mode === 'attack';
    if (!on) return;
    const m = this.point('hand', 12, -22);
    propOpts.flipX = this.facing < 0;
    r.sprite(ACT_ART.squeal, (this.world.tick >> 2) % 3, m[0] + this.facing * 6, m[1] - CRATE_H, propOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The loper
// ---------------------------------------------------------------------------------------------

export class Loper extends Lijmer {
  /** 'walk' → 'sit' (the glue tell) → 'glued'. */
  stage: 'walk' | 'sit' | 'glued' = 'walk';
  readonly sitAt: number;
  private sitT = 0;
  private sitLen: number = ACTIVIST_TUNE.sitTell;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, LOPER, 'loper');
    const enter = paramStr(p, 'enter', '');
    if (enter === 'right') this.facing = -1;
    else if (enter === 'left') this.facing = 1;
    this.sitAt = paramNum(p, 'sitAt', x + this.facing * (LOPER_SIT_AHEAD + 16));
    // On its feet: a standing hit box until it sits.
    this.hitbox = { x: -7, y: -30, w: 14, h: 30 };
    this.play('run');
  }

  protected override think(): void {
    if (this.stage === 'walk') {
      this.modeT++;
      const d = this.sitAt - this.x;
      if (Math.abs(d) <= LOPER_RUN) {
        this.x = this.sitAt;
        this.vx = 0;
        this.stage = 'sit';
        this.sitT = 0;
        this.hitbox = { x: -LOPER.w / 2, y: -LOPER.h, w: LOPER.w, h: LOPER.h };
        this.sitLen = Math.max(ACTIVIST_TUNE.minTell, this.tele(ACTIVIST_TUNE.sitTell));
        this.facePlayer();
        this.play('sitdown', { restart: true, loop: false });
        this.say('sit', this.sitLen + 30);
        this.world.audio.sfx('ring/act/sit');
      } else {
        this.facing = d > 0 ? 1 : -1;
        this.vx = this.facing * LOPER_RUN;
        this.play('run');
      }
      return;
    }
    if (this.stage === 'sit') {
      this.vx = 0;
      if (++this.sitT >= this.sitLen) {
        this.stage = 'glued';
        this.world.audio.sfx('ring/act/glue-slap');
        dust(this.world, this.x + this.facing * 6, this.y, 1);
        this.setMode('idle');
        this.play('sit');
      }
      return;
    }
    super.think();
  }

  /** Hit before the glue set: the banner drops, IK BEL MIJN MOEDER!, off they run. Glued: the rip. */
  protected override beaten(d: Damage): void {
    if (this.stage === 'glued') return super.beaten(d);
    this.vx = 0;
    this.sayOff();
    this.world.audio.sfx('ring/act/huff');
    this.play('drop', { restart: true, loop: false });
    this.markRunoff();
    if (this.signId) {
      this.signLeft = true;
      this.world.add(new RoadProp(this.world, this.x + this.facing * 8, this.y, ACT_ART.signDropped, this.facing));
    }
  }

  protected override exitDone(): void {
    if (this.stage === 'glued') return super.exitDone();
    this.runOff('flee');
  }

  protected override exitMax(): number {
    return this.stage === 'glued' ? 90 : 24;
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (this.stage !== 'walk') return super.thinkReaction(kind);
    // Still on its feet: stands with the banner (gloat) or ducks under it (cower).
    this.vx = 0;
    this.play(kind === 'cower' ? 'cower-stand' : 'stand');
  }

  protected override thinkGloat(): void {
    // Glued: holds up the sign WIJ HADDEN HET GEZEGD.
    this.play('gloat');
  }

  protected override signAt(out: [string, number, number]): [string, number, number] | null {
    if (this.dead || this.carried) return null;
    if (this.reaction === 'gloat' && this.stage !== 'walk') return heldSign(this, out);
    if (!this.signId) return null;
    if (this.stage === 'walk') {
      // Held up on its stick (the sign's anchor is the stick's foot).
      const h = this.point('hand', 4, -20);
      out[0] = this.signId;
      out[1] = h[0] + this.facing * 2;
      out[2] = h[1] + 7;
      return out;
    }
    return super.signAt(out);
  }

  protected override signBehind(): boolean {
    return this.stage !== 'walk' && this.reaction !== 'gloat';
  }
}

defineEntity(ACTIVIST.lijmer, (w, x, y, p) => new Lijmer(w, x, y, p), {
  category: 'enemy',
  score: LIJMER.score,
  description: 'Ring blockade (rf-b): glued sitter — paint balloons (tell 26), every third the glue pot (a puddle sticks a hero ~40 ticks); beaten: LOS!, off in a huff (params sign, tag, facing, look a|b, wait).',
});
defineEntity(ACTIVIST.ketting, (w, x, y, p) => new Ketting(w, x, y, p), {
  category: 'enemy',
  score: KETTING.score,
  description: 'Ring blockade (rf-b): chained to a barrel or a partner (anchor barrel|partner) — soup cans (tell 24, orange soup); beaten: the chain snaps, two police officers carry it off stiff as a plank.',
});
defineEntity(ACTIVIST.megafoon, (w, x, y, p) => new Megafoon(w, x, y, p), {
  category: 'enemy',
  score: MEGAFOON.score,
  description: 'Ring blockade (rf-b): megaphone on a crate — the shout ring pushes a hero back (no damage), the feedback squeal (tell 32) stuns ~20 ticks; beaten: hops off and runs.',
});
defineEntity(ACTIVIST.loper, (w, x, y, p) => new Loper(w, x, y, p), {
  category: 'enemy',
  score: LOPER.score,
  description: 'Ring blockade (rf-b): runs in with a banner (enter left|right), sits and glues at sitAt (tell 40, ZITTEN BLIJVEN!) → a lijmer; hit before: drops the banner, runs off.',
});
