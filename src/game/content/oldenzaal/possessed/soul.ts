/**
 * Mission oldenzaal — the free soul (`oz-soul`) and the ejected soul (`oz-soul-eject`)
 * (docs/design/oldenzaal.md §3.2–3.4). Owner: POSSESSED.
 *
 * `FreeSoul`: a pale see-through soldier's soul (a flyer, `body: false`; soft: the knife reaches
 * it). It comes out of a drain, a chimney or a chandelier (param `from`), drifts near the heroes
 * at about head height, and swoops (tell ≥ 18 on screen: it rears back, the eyes flare, a wail;
 * the touch is live only in the swoop). Few HP. It looks for a frightened or dazed townsperson:
 * when the cap allows (`MAX_REPOSSESS` on screen), it circles above him (the 30-tick tell) and
 * dives in — he becomes a host again. The gloat: the souls circle above the spot (no pointing,
 * no laughing); the cower: they pull back, away from the hero.
 *
 * `SoulEject`: the soul driven out of a host. It rises with a wail, flickers and fades (~40
 * ticks). It can be shot while it rises: `EJECT.bonus` points more. No 'enemy' tag (waves never
 * wait for it).
 */
import { Entity, type Damage } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { Renderer } from '../../../../engine/render';
import { framePoint, getFrame } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import type { ReactionKind } from '../../../enemy';
import { awardScore } from '../../../events';
import { paramStr, type SpawnParams } from '../../../registry';
import { Creature, contactHit } from '../../creatures/common';
import { drawGhost, type GhostOpts } from '../kit/ghost-draw';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { canRepossess, clearRepossession, markRepossession, OZ_HOLY_TAG, OZ_SOUL_TAG, OZ_TOWN_TAG, type Ejectable } from './api';
import { mistAt } from './mist';
import { EJECT, SOUL } from './numbers';
import type { Townsperson } from './townsperson';

export type SoulFrom = 'drain' | 'chimney' | 'chandelier' | 'air';

const ghost: GhostOpts = { alpha: 0.6, t: 0, flipX: false, glow: 'fx/oz/soul/glow', glowAlpha: 0.45, glowDx: 0, glowDy: -10, tint: undefined, tintAlpha: 0.35 };
const FLASH = PAL.snow[3];

export class FreeSoul extends Creature implements Ejectable, LightSource {
  readonly from: SoulFrom;
  private cool: number;
  private telegraph: number = SOUL.tell;
  private aimX = 0;
  private aimY = 0;
  /** The townsperson it circles / dives at. */
  private prey: Townsperson | null = null;
  private readonly hit: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/oz-soul', hp: SOUL.hp, score: SOUL.score, w: SOUL.w, h: SOUL.h, body: false, soft: true });
    this.hitbox = { x: -SOUL.w / 2, y: -20, w: SOUL.w, h: 24 };
    this.addTag(OZ_SOUL_TAG, LIGHT_TAG);
    this.z = 34;
    this.alerted = true;
    this.fineDraw = true;
    const f = paramStr(p, 'from', 'air');
    this.from = f === 'drain' || f === 'chimney' || f === 'chandelier' ? f : 'air';
    this.cool = world.rng.int(40, 90);
    this.hit = contactHit(this, 'bullet');
    this.facePlayer();
    this.setMode('emerge');
    this.play('hover');
    if (this.from !== 'air') world.audio.sfx('oz/possessed/emerge', { vol: 0.7 });
  }

  /** The hover height over the floor under x (world y of the soul's pelvis). */
  private hoverY(x: number, from: number): number {
    const f = this.world.terrain.surfaceY(x, from, from + 400);
    const floor = Number.isFinite(f) ? f : this.world.camera.bottom - 40;
    return floor - SOUL.hover;
  }

  // ------------------------------------------------------------------------------- the soul out

  ejectNow(owner: number, dirX: number): void {
    this.world.damage(this, { amount: this.hp + 1e6, kind: 'explosion', dirX, owner, tags: [OZ_HOLY_TAG] });
  }

  /** It bursts into pale mist (no death strip, no explosion). */
  protected override onDeath(): void {
    this.releaseToken();
    this.contactDamage = null;
    clearRepossession(this.world, this);
    mistAt(this.world, this.x, this.y - 8);
    this.world.audio.sfx('oz/possessed/soul-burst');
    this.remove();
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    super.update();
    if (this.dead || this.removed) return;
    this.x += this.vx;
    this.y += this.vy;
  }

  /** Steer toward (gx, gy) at `speed` (eased in the last 12 px). */
  private steer(gx: number, gy: number, speed: number): void {
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) {
      this.vx = this.vy = 0;
      return;
    }
    const s = Math.min(speed, d / 12 + 0.1);
    this.vx = (dx / d) * s;
    this.vy = (dy / d) * s;
  }

  protected override think(): void {
    this.modeT++;
    switch (this.mode) {
      case 'emerge':
        return this.thinkEmerge();
      case 'drift':
        return this.thinkDrift();
      case 'tell':
        return this.thinkTell();
      case 'swoop':
        return this.thinkSwoop();
      case 'rise':
        this.contactDamage = null;
        this.play('hover');
        this.vx *= 0.9;
        this.vy = this.y > this.hoverY(this.x, this.y) ? -SOUL.rise : 0;
        if (this.modeT >= SOUL.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(SOUL.cool, SOUL.coolJitter);
          this.setMode('drift');
        }
        return;
      case 'circle':
        return this.thinkCircle();
      case 'dive':
        return this.thinkDive();
    }
  }

  private thinkEmerge(): void {
    this.play('hover');
    const k = this.modeT / SOUL.emerge;
    if (this.from === 'drain') this.vy = -1.2 * (1 - k * 0.6);
    else if (this.from === 'chimney') this.vy = this.modeT < 16 ? -0.8 : 0.4;
    else if (this.from === 'chandelier') this.vy = 0.9;
    else this.vy = 0;
    this.vx = this.facing * 0.2;
    if (this.modeT >= SOUL.emerge) this.setMode('drift');
  }

  private thinkDrift(): void {
    this.play('hover');
    const t = this.facePlayer();
    if (!t) {
      this.vx *= 0.9;
      this.vy *= 0.9;
      return;
    }
    // Possession first (spec §3.4): a frightened or dazed townsperson near, inside the cap.
    if (this.modeT % 15 === 0 && this.lookForPrey()) return;
    const side = this.x < t.x ? -1 : 1;
    const gx = t.x + side * 64;
    const gy = this.hoverY(t.x, t.y - 40) + Math.sin((this.age + this.id * 23) * 0.05) * SOUL.bob;
    this.steer(gx, gy, SOUL.drift);
    if (--this.cool > 0) return;
    this.cool = 0;
    if (Math.abs(t.x - this.x) <= SOUL.range && this.onScreen(-8) && this.takeToken()) {
      this.telegraph = this.tele(SOUL.tell);
      this.vx = this.vy = 0;
      this.setMode('tell');
      this.play('tell', { restart: true });
      this.world.audio.sfx('oz/possessed/wail', { vol: 0.8 });
    } else this.cool = 15;
  }

  private thinkTell(): void {
    this.vx = 0;
    this.vy = this.modeT < 10 ? -0.3 : 0;
    const t = this.facePlayer();
    if (this.modeT < this.telegraph) return;
    // Rule 3: no swoop from outside the view.
    if (!t || !this.onScreen(-8)) return this.cancelAttack();
    this.aimX = t.x;
    this.aimY = t.y - 14;
    const dx = this.aimX - this.x;
    const dy = this.aimY - this.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.vx = (dx / d) * SOUL.swoop;
    this.vy = (dy / d) * SOUL.swoop;
    this.facing = dx < 0 ? -1 : 1;
    this.setMode('swoop');
    this.play('swoop', { restart: true });
    this.world.audio.sfx('oz/possessed/swoop');
  }

  private thinkSwoop(): void {
    this.hit.dirX = this.facing;
    this.contactDamage = this.hit;
    const passed = (this.aimX - this.x) * this.vx + (this.aimY - this.y) * this.vy < 0;
    const floor = this.world.terrain.surfaceY(this.x, this.y - 4, this.y + 12);
    if (passed || this.modeT >= SOUL.swoopMax || Number.isFinite(floor)) {
      this.contactDamage = null;
      this.setMode('rise');
    }
  }

  /** A possessable townsperson on screen within reach, and room under the cap: start circling him. */
  private lookForPrey(): boolean {
    if (!this.onScreen(-8) || !canRepossess(this.world)) return false;
    const list = this.world.byTag(OZ_TOWN_TAG);
    let best: Townsperson | null = null;
    let bd: number = SOUL.possessRange;
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Townsperson;
      if (!e.alive || typeof e.possessable !== 'function' || !e.possessable() || !e.onScreen(-8)) continue;
      const d = Math.hypot(e.x - this.x, e.y - 20 - this.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) return false;
    this.prey = best;
    markRepossession(this.world, this);
    this.setMode('circle');
    this.world.audio.sfx('oz/possessed/circle', { vol: 0.8 });
    return true;
  }

  private dropPrey(): void {
    this.prey = null;
    clearRepossession(this.world, this);
    this.setMode('drift');
  }

  private thinkCircle(): void {
    const p = this.prey;
    if (!p || !p.possessable()) return this.dropPrey();
    this.play('hover');
    const a = (this.modeT / SOUL.circle) * Math.PI * 2;
    this.steer(p.x + Math.cos(a) * SOUL.circleR, p.y - 36 + Math.sin(a) * SOUL.circleR * 0.5, 2.2);
    this.facing = p.x < this.x ? -1 : 1;
    if (this.modeT >= SOUL.circle) {
      this.setMode('dive');
      this.play('swoop', { restart: true });
      this.world.audio.sfx('oz/possessed/dive');
    }
  }

  private thinkDive(): void {
    const p = this.prey;
    if (!p || !p.possessable() || this.modeT > SOUL.diveMax) return this.dropPrey();
    const dx = p.x - this.x;
    const dy = p.y - 16 - this.y;
    const d = Math.hypot(dx, dy);
    this.facing = dx < 0 ? -1 : 1;
    if (d < 6) {
      clearRepossession(this.world, this);
      p.startPossession(true);
      this.prey = null;
      this.dead = true;
      this.remove();
      return;
    }
    this.vx = (dx / d) * SOUL.dive;
    this.vy = (dy / d) * SOUL.dive;
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'swoop' || this.mode === 'rise') {
      this.cool = 30;
      this.setMode('drift');
    }
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(): void {
    if (this.prey) this.dropPrey();
    super.onReact();
  }

  /** The gloat: circle above the spot where the last player went down (no pointing, no laughing). */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    this.play('hover');
    if (!spot) {
      this.vx = this.vy = 0;
      return;
    }
    const a = t * 0.035 + this.id * 1.7;
    this.steer(spot.x + Math.cos(a) * 30, spot.y - 60 + Math.sin(a) * 8, 1);
    this.facing = spot.x < this.x ? -1 : 1;
  }

  /** The cower: it pulls back, up and away from the hero who came back. */
  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'cower') {
      this.play('hover');
      const src = this.reactionSource ?? this.target();
      const away = src ? (this.x < src.x ? -1 : 1) : -this.facing;
      this.facing = (away > 0 ? -1 : 1) as 1 | -1;
      this.vx = away * 0.7;
      this.vy = -0.35;
      return;
    }
    super.thinkReaction(kind);
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    if (this.alive && (kind === 'gloat' || kind === 'cower')) this.setMode('drift');
  }

  // ------------------------------------------------------------------------------- light, draw

  lightOf(out: LightSpot, tick: number): boolean {
    out.x = this.x;
    out.y = this.y - 12;
    out.r = 24;
    out.color = PAL_HD_OZ.ghost[5];
    out.intensity = (this.mode === 'tell' ? 0.75 : 0.5) + 0.05 * Math.sin(tick * 0.15);
    out.flicker = 0.25;
    return true;
  }

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    const fade = this.mode === 'emerge' ? Math.min(1, 0.15 + this.modeT / SOUL.emerge) : 1;
    // The flicker: now and then the soul nearly goes out for a tick or two.
    const flick = (this.age * 7 + this.id * 13) % 61 < 3 ? 0.45 : 1;
    ghost.alpha = 0.72 * fade * flick;
    ghost.t = this.age + this.id * 11;
    ghost.flipX = this.facing < 0;
    ghost.glowAlpha = this.mode === 'tell' ? 0.8 : 0.45;
    ghost.tint = this.flashTicks > 0 ? FLASH : undefined;
    ghost.tintAlpha = this.flashTicks > 0 ? 0.9 : 0.35;
    drawGhost(r, this.anim.id, this.anim.index, this.x, this.y, ghost);
    const head = framePoint(getFrame(this.anim.id, this.anim.index), 'head', this.facing < 0, false, ptS);
    if (head) {
      eyeOpts.flipX = this.facing < 0;
      r.sprite('fx/oz/soul/eyes', this.mode === 'tell' || this.mode === 'circle' ? 1 : 0, this.x + head[0] + 2 * this.facing, this.y + head[1], eyeOpts);
    }
  }
}

const eyeOpts = { flipX: false };
const ptS: [number, number] = [0, 0];

// =============================================================================================
// The ejected soul
// =============================================================================================

const ejectGhost: GhostOpts = { alpha: 0.6, t: 0, flipX: false, glow: 'fx/oz/soul/glow', glowAlpha: 0.5, glowDy: -12 };

export class SoulEject extends Entity implements LightSource {
  t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.team = 'enemy';
    this.z = 32;
    this.hp = this.maxHp = 1;
    this.hitbox = { x: -EJECT.w / 2, y: -18, w: EJECT.w, h: EJECT.h };
    this.despawnMargin = 64;
    this.facing = p.facing === -1 || p.facing === 'left' ? -1 : 1;
    this.addTag('shootable', LIGHT_TAG);
  }

  override update(): void {
    if (this.t === 0) this.world.audio.sfx('oz/possessed/wail');
    this.t++;
    this.y -= EJECT.rise;
    this.x += Math.sin(this.t * 0.2) * 0.3;
    if (this.t >= EJECT.ticks) this.remove();
  }

  /** Shot while it rises: a few points more, and it bursts into mist. */
  override die(d?: Damage): void {
    if (this.dead) return;
    this.dead = true;
    awardScore(this.world, d?.owner, EJECT.bonus, this.x, this.y - 22);
    mistAt(this.world, this.x, this.y - 8);
    this.world.audio.sfx('oz/possessed/soul-burst');
    this.remove();
  }

  lightOf(out: LightSpot): boolean {
    out.x = this.x;
    out.y = this.y - 12;
    out.r = 26;
    out.color = PAL_HD_OZ.ghost[5];
    out.intensity = 0.7 * (1 - this.t / EJECT.ticks);
    out.flicker = 0.4;
    return true;
  }

  override draw(r: Renderer): void {
    const k = this.t / EJECT.ticks;
    const flick = this.t > 18 && (this.t * 5 + this.id) % 7 < 2 ? 0.3 : 1;
    ejectGhost.alpha = 0.7 * Math.pow(Math.max(0, 1 - k), 0.7) * flick;
    ejectGhost.t = this.t;
    ejectGhost.flipX = this.facing < 0;
    drawGhost(r, 'fx/oz/soul/eject', (this.t >> 3) & 3, this.x, this.y, ejectGhost);
  }
}
