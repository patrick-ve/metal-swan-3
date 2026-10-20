/**
 * `stag-partier` — a member of a stag party (docs/design/ams-extras.md §2.1). 20 HP (the groom
 * 40), soft, 300 points (the groom 1,000). A walker with a ranged tell, on foot or on a beer-bike
 * stool (`stag-beer-bike` seats its riders with `seatOn`).
 *
 * - Walks 0.7 px/tick toward the nearest player until he is ≤ 160 px away; closer than 48 px he
 *   steps back (until 64 px). Stops at walls and ledges.
 * - TELL 24 (difficulty-scaled, ≥ 18; inside the view, with an attack token, the player ≤ 230 px
 *   and ≤ 40 px of height away): he shakes the fizzy-wine bottle, foam round the cork,
 *   `ams/cork-shake`. ATTACK: one `cork` at chest height (25 px above his feet; the groom: 3 corks,
 *   one straight and two rising a little), `ams/cork-pop`; a crouch dodges a standing partier's
 *   cork. RECOVER 50, then a pause of 60 ± 30 (difficulty-scaled).
 * - Seated (on the beer bike): the same tell and cork from the stool, one rider at a time (the bike
 *   hands out turns: `PartyBike.mayFire`), range 260 px.
 * - Gags (free time, CAUGHT NAPPING): `toast` (clinks bottles with a partier near him, `ams/clink`),
 *   `selfie` (phone up); he notices a player within 160 px in front / 48 px behind, or a shot.
 * - Reactions: SAY CHEESE (bottle up), the continue's gloat (the group selfie with the spot: his
 *   back to it, phone up, a small flash every ~50 ticks, at most one line per hold) and cower (the
 *   T-shirt pulled over the head; seated: the stool strips).
 * - Death: he sits down hard and the bottle foams over (seated: he tips off the stool); the
 *   groom's veil flies off. Bloodless.
 *
 * Params: `groom` (bool), `look` (0–3), `gag` (`toast` / `selfie` / true / false), `facing`,
 * `enter` / `entry` / `from` (`left` / `right`: walks in from that side), + the Enemy params `hp`,
 * `drop`, `tag`. `cork` (projectile): y = the thrower's feet; params `facing`, `speed`, `vy`.
 */
import type { Damage, Entity } from '../../../engine/entity';
import { strideRate } from '../../../engine/math';
import { Body } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { FxEntity, tumble } from '../../fx';
import { Projectile, type ProjectileOpts } from '../../projectile';
import { defineEntity, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';
import type { ReactionKind } from '../../enemy';
import { Creature, contactHit, entryParam, gagParam, Turner } from '../creatures/common';
import { gagBubble } from '../locals/rider';
import { partySet } from './art';

/** Stag-partier numbers (NORMAL). */
export const STAG = {
  hp: 20,
  groomHp: 40,
  score: 300,
  groomScore: 1000,
  walk: 0.7,
  /** Walks in until the player is this close; steps back closer than `back` (until `backTo`). */
  far: 160,
  back: 48,
  backTo: 64,
  range: 230,
  seatedRange: 260,
  tele: 24,
  /** The fire strip (aim 3, pop 8, recover 10); the cork leaves on the pop frame. */
  fireTicks: 21,
  popAt: 3,
  recover: 50,
  cool: 60,
  coolJitter: 30,
  corkSpeed: 2.2,
  /** Cork flight height above the feet and its box: a crouch (hurtbox 20 px) dodges it. */
  chestY: 25,
  corkW: 6,
  corkH: 4,
  corkLife: 300,
  /** The groom's three corks: vertical speeds (px/tick; negative rises). */
  groomVy: [0, -0.22, -0.44] as readonly number[],
  /** The seated hitbox (above the stool). */
  seatBox: { x: -7, y: -40, w: 14, h: 27 },
  /** The gloat's selfie flash period (ticks) and the phone's place (unflipped, from the anchor). */
  flashEvery: 50,
  phone: [9, -39] as readonly [number, number],
  seatedPhone: [9, -42] as readonly [number, number],
} as const;

/** The bike a rider sits on (stag-beer-bike), seen from the rider. */
export interface PartyBike {
  readonly x: number;
  readonly y: number;
  readonly facing: 1 | -1;
  /** May this rider start a tell now (one rider at a time, with a gap)? */
  mayFire(p: StagPartier): boolean;
  /** The rider's attack ended (or was cancelled). */
  doneFiring(p: StagPartier): void;
  /** The rider died or got off. */
  riderGone(p: StagPartier): void;
}

// ------------------------------------------------------------------------------------ cork

const corkOpts: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };

/**
 * Fire one cork from a thrower's feet point (x, feetY) along `dir` at `speed` (vy: a small rise).
 * Straight, chest high, erasable (POOF, HONK), 10 damage like every hit.
 */
export function fireCork(world: World, x: number, feetY: number, dir: number, speed: number, vy = 0, shooter: Projectile['shooter'] = null): Projectile {
  const o = corkOpts;
  o.x = x;
  o.y = feetY - STAG.chestY;
  o.vx = dir * speed;
  o.vy = vy;
  o.damage = 10;
  o.kind = 'bullet';
  o.w = STAG.corkW;
  o.h = STAG.corkH;
  o.life = STAG.corkLife;
  o.sprite = 'enemy/cork/fly';
  o.look = 'anim';
  o.ticksPerFrame = 3;
  o.offscreen = 32;
  o.type = 'cork';
  o.shooter = shooter;
  const p = Projectile.spawn(world, o);
  o.shooter = null;
  return p;
}

// ------------------------------------------------------------------------------------ partier

const turnOpts: DrawOpts = {};
const GAGS = ['toast', 'selfie'] as const;

export class StagPartier extends Creature {
  /** One sprite per draw: drawn at the sub-pixel position (Enemy.fineDraw). */
  protected override fineDraw = true;

  readonly groom: boolean;
  readonly look: number;
  /** The bike this rider sits on (null on foot) and the stool's x (body space of the bike). */
  seat: PartyBike | null = null;
  stoolX = 0;
  private telegraph: number = STAG.tele;
  private cool: number;
  private backing = false;
  private readonly touch: Damage;
  private readonly turner: Turner;
  private turnId = '';
  private lastToastFrame = -1;
  private saidLine = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const groom = paramBool(p, 'groom', false);
    const look = Math.max(0, Math.min(3, Math.round(paramNum(p, 'look', world.rng.int(0, 3)))));
    super(world, x, y, p, { art: `enemy/${partySet(look, groom)}`, hp: groom ? STAG.groomHp : STAG.hp, w: 14, h: 30, score: groom ? STAG.groomScore : STAG.score });
    this.groom = groom;
    this.look = look;
    this.touch = contactHit(this, 'bullet');
    this.cool = world.rng.int(20, 60);
    const entry = entryParam(p) || paramStr(p, 'from', '');
    if (entry === 'left') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else if (p.facing === 1 || p.facing === 'right') this.facing = 1;
    else if (p.facing === -1 || p.facing === 'left') this.facing = -1;
    else this.facePlayer();
    this.turner = new Turner(this.facing, 2, 2);
    const gag = entry ? null : gagParam(p, world, 0);
    if (gag !== null) {
      this.startGag(gag === '' ? 'toast' : GAGS.includes(gag as (typeof GAGS)[number]) ? gag : 'toast');
    } else {
      this.alerted = true;
      this.setMode('walk');
    }
  }

  // ------------------------------------------------------------------------------- the stool

  /** Sit on a bike's stool (riders of `stag-beer-bike`): no physics, the bike places him. */
  seatOn(bike: PartyBike, stoolX: number): void {
    this.seat = bike;
    this.stoolX = stoolX;
    this.body = null;
    this.vx = this.vy = 0;
    this.hitbox = { ...STAG.seatBox };
    this.despawnMargin = Infinity;
    this.alerted = true;
    this.setMode('ride');
    this.play('sit');
    this.syncSeat();
  }

  /** Follow the stool (called by the bike every tick). */
  syncSeat(): void {
    const b = this.seat;
    if (!b) return;
    this.x = this.prevX = b.x + this.stoolX * b.facing;
    this.y = this.prevY = b.y;
  }

  /** Hop off the stool and walk on (the bike's `unload`). */
  dismount(): void {
    const b = this.seat;
    if (!b || this.dead) return;
    this.seat = null;
    this.body = new Body({ w: 14, h: 30 });
    this.hitbox = { x: -7, y: -30, w: 14, h: 30 };
    this.despawnMargin = 96;
    this.vy = -2;
    this.releaseToken();
    this.setMode('walk');
    this.play('idle');
  }

  /** Draw on the bike (the bike calls it between its layers). */
  drawSeated(r: Renderer): void {
    super.draw(r);
  }

  // ------------------------------------------------------------------------------- AI

  /** The bottle hand is inside the view (rule 3). */
  private bottleInView(): boolean {
    return this.inView(this.x + this.facing * 10, this.y - STAG.chestY, -8);
  }

  protected override think(): void {
    this.modeT++;
    if (!this.seat && this.breakOnVehicle(this.touch)) return;
    switch (this.mode) {
      case 'gag':
        return this.thinkGag();
      case 'notice':
        if (this.thinkNotice()) this.setMode('walk');
        return;
      case 'walk':
        return this.thinkWalk();
      case 'ride':
        return this.thinkRide();
      case 'tell':
        return this.thinkTell();
      case 'fire':
        return this.thinkFire();
      case 'recover':
        this.vx = 0;
        if (this.modeT >= STAG.recover) {
          this.releaseToken();
          this.seat?.doneFiring(this);
          this.cool = this.fireInterval(STAG.cool, STAG.coolJitter);
          this.setMode(this.seat ? 'ride' : 'walk');
        } else if (this.anim.done || !this.playing(this.seat ? 'sit-fire' : 'fire')) this.play(this.seat ? 'sit' : 'idle');
        return;
    }
  }

  private thinkGag(): void {
    this.vx = 0;
    if (this.gagAnim === 'gag-toast') {
      // Clink: the bottle meets its neighbour's on frame 1.
      const f = this.anim.index;
      if (f === 1 && this.lastToastFrame !== 1 && this.onScreen(0)) this.world.audio.sfx('ams/clink', { vol: 0.45 });
      this.lastToastFrame = f;
    }
    if (this.heardShout()) this.startNotice(14, 0);
    else this.gagNotices();
  }

  /** Walk-time facing with the Turner (hysteresis, turn frames). */
  private turnToPlayer(): ReturnType<StagPartier['target']> {
    const t = this.target();
    if (!t) return t;
    if (this.turner.facing !== this.facing && !this.turner.turning) this.turner.snap(this.facing);
    this.turner.update(t.x - this.x);
    this.facing = this.turner.facing;
    return t;
  }

  private thinkWalk(): void {
    const t = this.turnToPlayer();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    const dist = Math.abs(t.x - this.x);
    if (dist < STAG.back) this.backing = true;
    else if (dist >= STAG.backTo) this.backing = false;
    const dir = this.backing ? -this.facing : this.facing;
    const terr = this.world.terrain;
    const ahead = this.x + dir * 10;
    const floorAhead = terr.surfaceY(ahead, this.y - 12, this.y + 24);
    const blocked = terr.isSolid(ahead, this.y - 12) || !Number.isFinite(floorAhead);
    const wants = this.backing || dist > STAG.far;
    if (this.turner.turning || !wants || blocked) {
      this.vx = 0;
      this.play('idle');
    } else {
      this.vx = STAG.walk * dir;
      this.play('walk');
      // Cadence by speed (Enemy.update adds 1 tick).
      this.anim.tick += strideRate(this.vx, STAG.walk) - 1;
    }
    if (--this.cool > 0) return;
    if (dist <= STAG.range && Math.abs(t.y - this.y) < 40 && this.bottleInView() && this.onScreen(-8) && this.takeToken()) {
      this.facePlayer();
      this.turner.snap(this.facing);
      this.startTell();
    } else this.cool = 10;
  }

  private thinkRide(): void {
    this.vx = 0;
    const t = this.facePlayer();
    if (!this.playing('sit')) this.play('sit');
    if (!t || --this.cool > 0) return;
    const b = this.seat;
    if (b && Math.abs(t.x - this.x) <= STAG.seatedRange && Math.abs(t.y - this.y) < 48 && this.bottleInView() && this.onScreen(-8) && b.mayFire(this) && this.takeToken()) {
      this.startTell();
    } else this.cool = 8;
  }

  private startTell(): void {
    this.telegraph = this.tele(STAG.tele);
    this.vx = 0;
    this.setMode('tell');
    this.play(this.seat ? 'sit-tell' : 'tell', { restart: true });
    this.world.audio.sfx('ams/cork-shake', { vol: 0.6 });
    if (this.groom && !this.saidLine) {
      this.saidLine = gagBubble(this.world, this, 'LAST NIGHT OF FREEDOM!', Math.min(60, this.telegraph + 30));
    }
  }

  private thinkTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    // Rule 3: only from inside the view, and only at a player.
    if (!this.bottleInView() || !this.target()) return this.cancelAttack();
    this.facePlayer();
    this.turner.snap(this.facing);
    this.setMode('fire');
    this.play(this.seat ? 'sit-fire' : 'fire', { restart: true });
  }

  private thinkFire(): void {
    this.vx = 0;
    if (this.modeT === STAG.popAt) {
      const speed = STAG.corkSpeed * this.mods.enemyBulletSpeed;
      const x = this.x + this.facing * 12;
      if (this.groom) for (const vy of STAG.groomVy) fireCork(this.world, x, this.y, this.facing, speed, vy * this.mods.enemyBulletSpeed, this);
      else fireCork(this.world, x, this.y, this.facing, speed, 0, this);
      this.world.audio.sfx('ams/cork-pop');
    }
    if (this.modeT >= STAG.fireTicks) this.setMode('recover');
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    if (this.mode === 'tell' || this.mode === 'fire' || this.mode === 'recover') {
      this.seat?.doneFiring(this);
      this.cool = 30;
      this.setMode(this.seat ? 'ride' : 'walk');
    }
  }

  // ------------------------------------------------------------------------------- reactions

  /** Seated, the reactions play their stool strips. */
  protected override reactionAnim(kind: ReactionKind): string {
    if (!this.seat) return super.reactionAnim(kind);
    if (kind === 'cower') return 'sit-cower';
    if (kind === 'photo' || kind === 'gloat') return 'sit-gloat';
    return 'sit';
  }

  /** A reaction while seated never moves him off the stool (the bike carries him). */
  protected override thinkReaction(kind: ReactionKind): void {
    super.thinkReaction(kind);
    if (this.seat) {
      this.vx = 0;
      this.syncSeat();
    }
  }

  /**
   * The gloat (docs/design/ams-extras.md §1): the group selfie WITH the spot — he turns his back
   * to it and holds the phone up in front of him (the spot is in the picture behind him), a small
   * flash every ~50 ticks, one line per hold. On a stool he faces along the bike.
   */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    this.vx = 0;
    if (this.seat) this.facing = this.seat.facing;
    else if (spot && Math.abs(spot.x - this.x) >= 2) this.facing = spot.x > this.x ? -1 : 1;
    this.turner.snap(this.facing);
    this.play(this.reactionAnim('gloat'));
    if (!this.onScreen(0)) return;
    if (t >= 6 + (this.id % 5) * 4) this.sayGloat('FOR THE GROUP CHAT!', 70);
    if ((t + this.id * 7) % STAG.flashEvery === STAG.flashEvery - 1) {
      const ph = this.seat ? STAG.seatedPhone : STAG.phone;
      FxEntity.spawn(this.world, { sprite: 'enemy/stag-partier/flash', x: this.x + ph[0] * this.facing, y: this.y + ph[1], z: 61 });
    }
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    // On the bike the bike draws him (between its counter and its posts).
    if (this.seat && !this.dead) return;
    const f = this.dead ? -1 : this.turner.frame();
    if (f < 0) return super.draw(r);
    if (!this.turnId) this.turnId = this.spriteId('turn');
    turnOpts.flipX = this.facing < 0;
    turnOpts.flash = this.flashTicks > 0;
    r.sprite(this.turnId, f, this.x, this.y, turnOpts);
  }

  // ------------------------------------------------------------------------------- death

  /** Seated, a hit tips him off the stool backwards. */
  override deathAnim(kind: Damage['kind']): string | null {
    if (this.seat && (kind === 'bullet' || kind === 'laser' || kind === 'impact' || kind === 'knife')) return 'die-stool';
    return super.deathAnim(kind);
  }

  protected override deathEffects(d: Damage): void {
    const b = this.seat;
    if (b) {
      this.seat = null;
      b.riderGone(this);
    }
    this.world.audio.sfx('ams/foam', { vol: 0.5 });
    if (this.groom) {
      tumble(this.world, 'enemy/stag-groom/veil', this.x - this.facing * 3, this.y - 32, -this.facing * 0.7 + d.dirX * 0.5, -2.2, { gravity: 0.05, life: 70 });
    }
  }

  override onRemove(): void {
    const b = this.seat;
    if (b) {
      this.seat = null;
      b.riderGone(this);
    }
    super.onRemove();
  }
}

defineEntity('stag-partier', (w, x, y, p) => new StagPartier(w, x, y, p), {
  category: 'enemy',
  score: STAG.score,
  description: 'Stag partier (ams): walks to 100–160 px, shakes his bottle (tell 24), fires a cork at chest height (crouch dodges); groom: 3 corks, 40 HP, 1,000 points. Gags toast / selfie.',
});

defineEntity(
  'cork',
  (w, x, y, p) => {
    const dir = p.facing === 1 || p.facing === 'right' ? 1 : -1;
    return fireCork(w, x, y, dir, paramNum(p, 'speed', STAG.corkSpeed), paramNum(p, 'vy', 0));
  },
  { category: 'projectile', description: 'Cork from a fizzy-wine bottle: chest high (25 px over y), 2.2 px/tick; a crouch dodges it (params facing, speed, vy).' },
);
