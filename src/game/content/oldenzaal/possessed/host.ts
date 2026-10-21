/**
 * Mission oldenzaal — the possessed hosts (docs/design/oldenzaal.md §3): townspeople with a soldier's
 * soul in them. Owner: POSSESSED.
 *
 * `PossessedHost` (the shared base): the person is the hit box (shots hurt his HP as usual); a
 * pale see-through soldier soul hovers over and behind him, following a little delayed
 * (`drawGhost`), a ghostly grey helmet sits on his head and his eyes glow green (and light the
 * street: `LIGHT_TAG` / `lightOf`). At 0 HP (shot, knifed, a grenade, a holy hit) the soul is
 * ejected (`oz-soul-eject`: it rises with a wail and fades) and the person drops, sits up dazed and
 * runs off (an `oz-townsperson` in mode 'freed'). It scores as a kill.
 *
 * Kinds: `Shambler` (slow walk, arms forward; the grab / claw: tell ≥ 18 on screen, the claw box
 * live only in the strike), `Gunner` (stands; its soul raises a ghost rifle: a long glowing tell,
 * a slow spectral shot along the ground or in a low arc), `Brute` (the butcher, a bouncer: more HP,
 * a heavy charge after a tell, knocks over street furniture).
 *
 * Continue reactions: the gloat (every player out) — the hosts sway and groan, the souls rise and
 * circle above them (no pointing, no laughing); the cower — the soul pulls back into the host, the
 * host flinches.
 */
import { damageHas, type Damage, type Entity } from '../../../../engine/entity';
import { rectAt, strideRate, type Rect } from '../../../../engine/math';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { framePoint, getFrame, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import type { EnemyOpts, ReactionKind } from '../../../enemy';
import { paramBool, paramStr, type SpawnParams } from '../../../registry';
import { Creature, contactHit, entryParam } from '../../creatures/common';
import { drawGhost } from '../kit/ghost-draw';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { OZ_HOLY_TAG, OZ_HOST_TAG, clearRepossession, markRepossession, type Ejectable } from './api';
import { hostArt, isOzLook, OZ_BRUTE_LOOKS, OZ_STREET_LOOKS, type OzLook } from './looks';
import { BRUTE, GUNNER, HOST_SOUL, SHAMBLER } from './numbers';
import { mistAt } from './mist';
import { fireGhostShot, type GhostShot } from './shot';

const soulOpts = { alpha: 0.42, t: 0, flipX: false, glow: 'fx/oz/soul/glow' as string | null, glowAlpha: 0.35, glowDx: 0, glowDy: -12 };
const helmetOpts = { alpha: 0.6, flipX: false, tintAlpha: 0.25, glow: null as string | null };
const eyeOpts: DrawOpts = {};
const eyeGlow: DrawOpts = { blend: 'add', alpha: 0.3 };
const ptA: [number, number] = [0, 0];
const NO_BOXES: readonly Rect[] = [];

/** Spawn the eject fx and the freed person for a host that just lost its soul. */
const freedParams: Record<string, unknown> = { look: 'shopper', mode: 'freed', facing: 1 };
const ejectParams: Record<string, unknown> = { facing: 1 };

/** Pick a look: the `look` param, else one of `pool` (cosmetic: fxRng). */
export function lookParam(world: World, p: SpawnParams, pool: readonly OzLook[]): OzLook {
  const l = paramStr(p, 'look', '');
  if (isOzLook(l)) return l;
  return pool[world.fxRng.int(0, pool.length - 1)];
}

export interface HostOpts extends Omit<EnemyOpts, 'art'> {
  look: OzLook;
}

export abstract class PossessedHost extends Creature implements Ejectable, LightSource {
  readonly look: OzLook;
  /** A townsperson a free soul possessed again (counts toward the cap of spec §3.4). */
  readonly repossessed: boolean;
  /** The soul over him (cosmetic: world px of its pelvis, its strip and frame, its alpha factor). */
  soulX: number;
  soulY: number;
  soulSprite = 'enemy/oz-soul/hover';
  soulFrame = 0;
  /** 1 = out over him, 0 = pulled into him (the cower). */
  soulOut = 1;
  /** The eye point (world px; cosmetic, the light). */
  eyeX: number;
  eyeY: number;
  /** Ticks the player has been behind him (the slow turn). */
  protected behind = 0;
  protected readonly touch: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams, o: HostOpts) {
    super(world, x, y, p, { ...o, art: hostArt(o.look) });
    this.look = o.look;
    this.repossessed = paramBool(p, 'repossessed', false);
    this.addTag(OZ_HOST_TAG, LIGHT_TAG);
    this.fineDraw = true;
    this.alerted = true;
    this.touch = contactHit(this, 'bullet');
    const entry = entryParam(p);
    if (entry === 'left') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else this.facePlayer();
    this.soulX = x + HOST_SOUL.dx * this.facing;
    this.soulY = y - 30;
    this.eyeX = x;
    this.eyeY = y - 26;
    if (this.repossessed) markRepossession(world, this);
    if (paramStr(p, 'entry', '') === 'rise') {
      this.setMode('rise');
      this.play('rise', { restart: true, loop: false });
      this.soulOut = 0;
      world.audio.sfx('oz/possessed/groan', { vol: 0.7 });
    } else this.setMode('walk');
  }

  // ------------------------------------------------------------------------------- the soul out

  /** A holy hit is lethal whatever the HP (the soul is driven out). */
  override onHit(d: Damage, part = 0): boolean {
    if (this.alive && damageHas(d, OZ_HOLY_TAG)) {
      this.invulnTicks = 0;
      return super.onHit({ ...d, amount: Math.max(d.amount, this.hp) }, part);
    }
    return super.onHit(d, part);
  }

  /**
   * The soul contract of the holy-mayo blast (items/index.ts `SoulHost`, duck-typed; WUGHOST's
   * request, wired by INTEGRATE): the soul out now, credited to `cause.owner`, pushed away from
   * the blast. False when there is no soul left to drive out.
   */
  ejectSoul(cause: { readonly owner: number; readonly x: number }): boolean {
    if (!this.alive || this.removed) return false;
    this.ejectNow(cause.owner, this.x < cause.x ? -1 : 1);
    return true;
  }

  /** `ejectSoul` (api.ts): the soul out now, credited to `owner`. */
  ejectNow(owner: number, dirX: number): void {
    this.world.damage(this, { amount: this.hp + 1e6, kind: 'explosion', dirX, owner, tags: [OZ_HOLY_TAG] });
  }

  /** The soul is ejected and the person is freed (never a death animation: bloodless). */
  protected override onDeath(d: Damage): void {
    this.releaseToken();
    this.contactDamage = null;
    clearRepossession(this.world, this);
    this.onFreed(d);
    const w = this.world;
    ejectParams.facing = this.facing;
    w.spawn('oz-soul-eject', this.soulX, this.soulY, ejectParams);
    freedParams.look = this.look;
    freedParams.facing = this.facing;
    freedParams.dirX = d.dirX || -this.facing;
    w.spawn('oz-townsperson', this.x, this.y, freedParams);
    mistAt(w, this.x, this.y - 22);
    w.audio.sfx('oz/possessed/eject');
    this.remove();
  }

  /** Hook: the soul is out (kind effects). */
  protected onFreed(_d: Damage): void {}

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    super.update();
    if (!this.dead) this.followSoul();
  }

  /** The soul's strip for this tick (kinds override: the reach, the rifle, the charge). */
  protected soulPose(): void {
    this.soulSprite = 'enemy/oz-soul/hover';
    this.soulFrame = (this.age >> 3) & 3;
  }

  /** Move the soul a little after the body (cosmetic), and the eye point. */
  private followSoul(): void {
    this.soulPose();
    const id = this.anim.id;
    let hipY = -15;
    let eye: readonly [number, number] | undefined;
    if (id && hasSprite(id)) {
      const f = getFrame(id, this.anim.index, 1);
      hipY = f.pts?.hip?.[1] ?? -15;
      eye = f.pts?.eye ? framePoint(f, 'eye', this.facing < 0, false, ptA) : undefined;
    }
    const gloat = this.reaction === 'gloat' ? 1 : 0;
    const cower = this.reaction === 'cower';
    this.soulOut += ((cower ? 0 : 1) - this.soulOut) * 0.15;
    const k = this.soulOut;
    const tx = this.x + HOST_SOUL.dx * this.facing * k + (gloat ? Math.sin(this.age * 0.05) * 10 : 0);
    const ty = this.y + hipY + HOST_SOUL.dy * k - gloat * (14 + Math.cos(this.age * 0.05) * 4) + Math.sin(this.age * 0.06) * 1.5;
    this.soulX += (tx - this.soulX) * HOST_SOUL.follow;
    this.soulY += (ty - this.soulY) * HOST_SOUL.follow;
    if (eye) {
      this.eyeX = this.x + eye[0];
      this.eyeY = this.y + eye[1];
    } else {
      this.eyeX = this.x + 2 * this.facing;
      this.eyeY = this.y - 27;
    }
  }

  /** Turn toward the player only after he has been behind for a while (a heavy, slow turn). */
  protected slowTurn(t: Entity, delay: number): void {
    const dx = t.x - this.x;
    if (Math.abs(dx) >= 12 && Math.sign(dx) !== this.facing) {
      if (++this.behind >= delay) {
        this.facing = this.facing > 0 ? -1 : 1;
        this.behind = 0;
      }
    } else this.behind = 0;
  }

  /** Is there floor at his own height `dist` px ahead (no wall, no drop)? */
  protected floorAhead(dir: number, dist = 10): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * dist;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 6, this.y + 8);
    return Number.isFinite(fy) && Math.abs(fy - this.y) <= 4;
  }

  /** The rise of a fresh possession: no attacks until the strip is done. */
  protected thinkRise(): boolean {
    if (this.mode !== 'rise') return false;
    this.vx = 0;
    if (this.anim.done || this.modeT > 40) this.setMode('walk');
    return true;
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onGloatStart(): void {
    this.world.audio.sfx('oz/possessed/groan', { vol: 0.6 });
  }

  /** The gloat: sway on the spot and groan now and then; the soul rises and circles above (followSoul). */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    this.vx = 0;
    this.faceSpot(spot);
    this.play(this.reactionAnim('gloat'));
    if (t > 0 && t % 150 === 75) this.world.audio.sfx('oz/possessed/groan', { vol: 0.5 });
  }

  protected override onReact(): void {
    super.onReact();
    if (this.reaction === 'cower') this.world.audio.sfx('oz/possessed/flinch', { vol: 0.7 });
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    if ((kind === 'gloat' || kind === 'cower') && this.alive && this.mode !== 'rise') this.setMode('walk');
  }

  // ------------------------------------------------------------------------------- light, draw

  lightOf(out: LightSpot, tick: number): boolean {
    out.x = this.eyeX;
    out.y = this.eyeY;
    out.r = 14;
    out.color = PAL_HD_OZ.ghost[5];
    out.intensity = 0.35 + (this.mode === 'tell' ? 0.25 : 0) + 0.05 * Math.sin(tick * 0.2);
    out.flicker = 0.15;
    return true;
  }

  /** The eyes flare in a tell. */
  protected eyesFlare(): boolean {
    return this.mode === 'tell';
  }

  override draw(r: Renderer): void {
    // The soul behind and over him.
    const flip = this.facing < 0;
    const k = this.soulOut;
    soulOpts.alpha = HOST_SOUL.alpha * (0.45 + 0.55 * k);
    soulOpts.t = this.age + this.id * 17;
    soulOpts.flipX = flip;
    soulOpts.glowAlpha = 0.3 * k;
    drawGhost(r, this.soulSprite, this.soulFrame, this.soulX, this.soulY, soulOpts);
    super.draw(r);
    const id = this.anim.id;
    if (!id) return;
    // The ghost helmet on the head, then the glowing eyes.
    const f = getFrame(id, this.anim.index);
    const head = framePoint(f, 'head', flip, false, ptA);
    if (head) {
      helmetOpts.flipX = flip;
      drawGhost(r, 'fx/oz/soul/helmet', 0, this.x + head[0], this.y + head[1], helmetOpts);
    }
    const flare = this.eyesFlare();
    eyeOpts.flipX = flip;
    r.sprite('fx/oz/soul/eyes', flare ? 1 : 0, this.eyeX, this.eyeY, eyeOpts);
    eyeGlow.alpha = flare ? 0.55 : 0.28;
    r.sprite('fx/oz/soul/glow', 0, this.eyeX, this.eyeY, eyeGlow);
  }
}

// =============================================================================================
// The shambler
// =============================================================================================

const CLAW_BOX: Rect = SHAMBLER.clawBox;

export class Shambler extends PossessedHost {
  private telegraph: number = SHAMBLER.tell;
  private cool: number;
  private readonly claw: Damage;
  private readonly clawBoxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { look: lookParam(world, p, OZ_STREET_LOOKS), hp: SHAMBLER.hp, score: SHAMBLER.score, w: 14, h: 30 });
    this.cool = world.rng.int(10, 40);
    this.claw = contactHit(this, 'bullet');
  }

  /** Only the claw hurts, and only in the strike's live ticks. */
  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return NO_BOXES;
    rectAt(this.x, this.y, CLAW_BOX, this.facing < 0, this.clawBoxes[0]);
    return this.clawBoxes;
  }

  protected override soulPose(): void {
    if (this.mode === 'tell' || this.mode === 'strike') {
      this.soulSprite = 'enemy/oz-soul/reach';
      this.soulFrame = this.mode === 'strike' ? 1 : 0;
    } else super.soulPose();
  }

  protected override think(): void {
    this.modeT++;
    if (this.thinkRise()) return;
    switch (this.mode) {
      case 'walk':
        return this.thinkWalk();
      case 'tell':
        return this.thinkTell();
      case 'strike':
        return this.thinkStrike();
      case 'recover':
        this.vx = 0;
        if (this.modeT >= SHAMBLER.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(SHAMBLER.cool, SHAMBLER.coolJitter);
          this.setMode('walk');
        }
        return;
    }
  }

  private thinkWalk(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    this.slowTurn(t, SHAMBLER.turnDelay);
    const dx = (t.x - this.x) * this.facing;
    if (dx > SHAMBLER.reach - 6 && this.floorAhead(this.facing)) {
      this.vx = SHAMBLER.walk * this.facing;
      this.play('walk');
      this.anim.tick += strideRate(this.vx, SHAMBLER.walk) - 1;
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (--this.cool > 0) return;
    this.cool = 0;
    if (dx > -4 && dx <= SHAMBLER.reach && Math.abs(t.y - this.y) <= 24 && this.onScreen(-8) && this.takeToken()) {
      this.telegraph = this.tele(SHAMBLER.tell);
      this.vx = 0;
      this.setMode('tell');
      this.play('tell', { restart: true, loop: false });
      this.world.audio.sfx('oz/possessed/grab-tell');
    }
  }

  private thinkTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    // Rule 3: no strike from outside the view.
    if (!this.onScreen(-8) || !this.target()) return this.cancelAttack();
    this.setMode('strike');
    this.play('strike', { restart: true, loop: false });
    this.world.audio.sfx('oz/possessed/claw');
  }

  private thinkStrike(): void {
    this.vx = (this.modeT <= SHAMBLER.active ? SHAMBLER.lunge : 0) * this.facing;
    if (!this.floorAhead(this.facing)) this.vx = 0;
    if (this.modeT <= SHAMBLER.active) {
      this.claw.dirX = this.facing;
      this.contactDamage = this.claw;
    } else this.contactDamage = null;
    if (this.modeT >= SHAMBLER.strike) {
      this.contactDamage = null;
      this.setMode('recover');
    }
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'strike' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('walk');
    }
  }
}

// =============================================================================================
// The gunner
// =============================================================================================

export class Gunner extends PossessedHost {
  private telegraph: number = GUNNER.tell;
  private cool: number;
  private shots = 0;
  private readonly live: Array<GhostShot | null> = [null, null];
  private readonly hold: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { look: lookParam(world, p, OZ_STREET_LOOKS), hp: GUNNER.hp, score: GUNNER.score, w: 14, h: 30 });
    this.cool = world.rng.int(30, 70);
    this.hold = typeof p.hold === 'number' ? p.hold : GUNNER.hold;
    this.soulSprite = 'enemy/oz-gunner/rifle';
  }

  protected override soulPose(): void {
    this.soulSprite = 'enemy/oz-gunner/rifle';
    if (this.mode === 'tell') this.soulFrame = this.modeT < this.telegraph * 0.35 ? 1 : 2;
    else if (this.mode === 'shoot') this.soulFrame = 3;
    else this.soulFrame = 0;
  }

  private airborne(): number {
    let n = 0;
    for (let i = 0; i < this.live.length; i++) {
      const s = this.live[i];
      if (s && !s.removed && s.shooter === this) n++;
      else this.live[i] = null;
    }
    return n;
  }

  /** The rifle's muzzle (world px), from the soul's rifle frame (aimed). */
  private muzzle(out: [number, number]): [number, number] {
    const id = 'enemy/oz-gunner/rifle';
    const m = hasSprite(id) ? framePoint(getFrame(id, 2, 1), 'muzzle', this.facing < 0, false, out) : undefined;
    out[0] = this.soulX + (m ? m[0] : 14 * this.facing);
    out[1] = this.soulY + (m ? m[1] : -10);
    return out;
  }

  protected override think(): void {
    this.modeT++;
    if (this.thinkRise()) return;
    const t = this.target();
    switch (this.mode) {
      case 'walk': {
        if (!t) {
          this.vx = 0;
          this.play('idle');
          return;
        }
        this.slowTurn(t, 12);
        const dist = Math.abs(t.x - this.x);
        // He walks until he holds at his range — and never holds outside the view (INTEGRATE: a
        // gunner that entered behind the players stood just off screen and locked the arena).
        const far = dist > this.hold || !this.onScreen(-12);
        if (far && this.floorAhead(this.facing) && Math.sign(t.x - this.x) === this.facing) {
          this.vx = GUNNER.walk * this.facing;
          this.play('walk');
          this.anim.tick += strideRate(this.vx, SHAMBLER.walk) - 1;
        } else {
          this.vx = 0;
          this.play('idle');
        }
        if (--this.cool > 0) return;
        this.cool = 0;
        const m = this.muzzle(ptA);
        if (dist <= GUNNER.range && Math.sign(t.x - this.x) === this.facing && this.onScreen(-8) && this.inView(m[0], m[1]) && this.airborne() < GUNNER.maxShots && this.takeToken()) {
          this.telegraph = this.tele(GUNNER.tell);
          this.vx = 0;
          this.setMode('tell');
          this.play('idle');
          this.world.audio.sfx('oz/possessed/rifle-tell');
        } else this.cool = 12;
        return;
      }
      case 'tell': {
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        const m = this.muzzle(ptA);
        if (!t || !this.onScreen(-8) || !this.inView(m[0], m[1])) return this.cancelAttack();
        const arc = this.shots % 3 === 2 || Math.abs(t.y - this.y) > 24;
        const s = fireGhostShot(this.world, m[0], m[1], this.facing, this.y, arc, this);
        const slot = this.live[0] && !this.live[0].removed ? 1 : 0;
        this.live[slot] = s;
        this.shots++;
        this.world.audio.sfx('oz/possessed/rifle');
        this.setMode('shoot');
        return;
      }
      case 'shoot':
        this.vx = 0;
        if (this.modeT >= GUNNER.shoot) this.setMode('recover');
        return;
      case 'recover':
        this.vx = 0;
        this.play('idle');
        if (this.modeT >= GUNNER.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(GUNNER.cool, GUNNER.coolJitter);
          this.setMode('walk');
        }
        return;
    }
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    if (this.mode === 'tell' || this.mode === 'shoot' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('walk');
    }
  }

  override draw(r: Renderer): void {
    super.draw(r);
    // The long tell: the ghost rifle glows brighter and brighter at the muzzle.
    if (this.mode === 'tell' && !this.dead) {
      const k = Math.min(1, this.modeT / Math.max(1, this.telegraph));
      const m = this.muzzle(ptA);
      glowOpts.alpha = 0.25 + 0.6 * k;
      r.sprite('fx/oz/soul/glow', 0, m[0], m[1], glowOpts);
    }
  }
}

const glowOpts: DrawOpts = { blend: 'add', alpha: 0.5 };

// =============================================================================================
// The brute
// =============================================================================================

export class Brute extends PossessedHost {
  private telegraph: number = BRUTE.tell;
  private cool: number;
  private chargeX = 0;
  private readonly hit: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { look: lookParam(world, p, OZ_BRUTE_LOOKS), hp: BRUTE.hp, score: BRUTE.score, w: BRUTE.w, h: BRUTE.h, big: true });
    this.cool = world.rng.int(30, 60);
    this.hit = contactHit(this, 'impact');
  }

  protected override soulPose(): void {
    if (this.mode === 'charge') {
      this.soulSprite = 'enemy/oz-soul/swoop';
      this.soulFrame = (this.age >> 2) & 1;
    } else if (this.mode === 'tell') {
      this.soulSprite = 'enemy/oz-soul/tell';
      this.soulFrame = (this.age >> 3) & 1;
    } else super.soulPose();
  }

  protected override think(): void {
    this.modeT++;
    if (this.thinkRise()) return;
    const t = this.target();
    switch (this.mode) {
      case 'walk': {
        if (!t) {
          this.vx = 0;
          this.play('idle');
          return;
        }
        this.slowTurn(t, 16);
        const dx = (t.x - this.x) * this.facing;
        if (dx > 40 && this.floorAhead(this.facing)) {
          this.vx = BRUTE.walk * this.facing;
          this.play('walk');
          this.anim.tick += strideRate(this.vx, BRUTE.walk) - 1;
        } else {
          this.vx = 0;
          this.play('idle');
        }
        if (--this.cool > 0) return;
        this.cool = 0;
        if (dx > 0 && dx <= BRUTE.range && Math.abs(t.y - this.y) <= 30 && this.onScreen(-8) && this.takeToken()) {
          this.telegraph = this.tele(BRUTE.tell);
          this.vx = 0;
          this.chargeX = t.x;
          this.setMode('tell');
          this.play('tell', { restart: true });
          this.world.audio.sfx('oz/possessed/brute-tell');
        } else this.cool = 10;
        return;
      }
      case 'tell':
        this.vx = 0;
        if (this.modeT < this.telegraph) return;
        if (!t || !this.onScreen(-8)) return this.cancelAttack();
        this.chargeX = t.x;
        this.setMode('charge');
        this.play('charge', { restart: true });
        this.world.audio.sfx('oz/possessed/brute-charge');
        return;
      case 'charge': {
        const ahead = this.floorAhead(this.facing, 12);
        const past = (this.x - this.chargeX) * this.facing > BRUTE.overrun;
        if (!ahead || past || this.modeT > BRUTE.chargeMax) {
          this.vx = 0;
          this.contactDamage = null;
          this.setMode('recover');
          this.play('recover', { restart: true });
          if (!ahead) this.world.audio.sfx('oz/possessed/brute-thud');
          return;
        }
        this.vx = BRUTE.charge * this.facing;
        this.hit.dirX = this.facing;
        this.contactDamage = this.hit;
        this.knockFurniture();
        return;
      }
      case 'recover':
        this.vx = 0;
        if (this.modeT >= BRUTE.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(BRUTE.cool, BRUTE.coolJitter);
          this.setMode('walk');
        }
        return;
    }
  }

  /** Street furniture in his way (breakable props) is knocked over. */
  private knockFurniture(): void {
    const me = this.hitRect();
    const list = this.world.byTag('prop');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || !e.hasTag('shootable') || e === this) continue;
      const b = e.hitRect();
      if (b.x < me.x + me.w + 4 && b.x + b.w > me.x - 4 && b.y < me.y + me.h && b.y + b.h > me.y) {
        this.world.damage(e, { amount: 1e6, kind: 'impact', dirX: this.facing, source: this });
      }
    }
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'charge' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('walk');
    }
  }
}
