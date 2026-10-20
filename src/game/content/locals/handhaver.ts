/**
 * `handhaver` — a city enforcement officer (docs/design/amsterdam.md §2). 20 HP, soft, 300 points.
 * Boss add in `ams-mayor` and an enemy of sections c / d.
 *
 * - Walks in (0.6 px/tick) until 130 px from the player, then stands.
 * - TELL 24 (inside the view, with an attack token, player within 220 px and 40 px of height):
 *   opens the ticket book, licks the pencil, bubble `BOETE!`.
 * - ATTACK: throws a fluttering `boete-ticket` at chest height (25 px above his feet),
 *   1.6 px/tick with a small sine flutter (±1.5 px) — a crouch (hurtbox 20 px) dodges it.
 *   RECOVER 40, then a 50 ± 20 tick pause (difficulty-scaled). Never more than 2 tickets in the
 *   air per officer.
 * - Death: he swoons; his tickets scatter like confetti.
 * - A driven player vehicle that touches him breaks him like the riders and gulls (GDD §8.5:
 *   the vehicle takes ½ cell; docs/design/ams-extras.md §7.5), in reactions too.
 * - The gloat (every player out, docs/design/ams-extras.md §1): he walks toward the spot (at most
 *   `gloatWalk` px, only over his own floor; he stops `gloatStand` px short of it), writes the
 *   fine in his book (`ams/gloat-scribble`, bubble `VERBODEN TE LIGGEN!` once per hold), tears the
 *   page off (`ams/gloat-tear`), lets it flutter down onto the spot (`ams/ticket`, a `GloatPage`)
 *   and stands back. No attacks.
 * - Motion (draw only, docs/ART_GUIDE.md "Motion"): the walk cadence follows the speed
 *   (strideRate); while walking he turns with a `Turner` (the player ≥ 12 px behind for 8 ticks,
 *   then the 2-frame `turn` strip narrowing, the flip, widening); the tell and the throw still
 *   face the player at once. After the flick the throw strip plays its 2-frame recover before
 *   the idle breathing.
 *
 * Params: `enter` / `entry` (`left` / `right`: walks in), `facing`, `skin` (`a` / `b` / `c`), `hold`
 * (px: stand this far from the player, default 130), + the Enemy params `hp`, `drop`, `tag`.
 *
 * `boete-ticket` (projectile): y = the thrower's feet; params `facing`, `speed`.
 */
import { Entity, type Damage } from '../../../engine/entity';
import { strideRate } from '../../../engine/math';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { confetti, tumble } from '../../fx';
import { Projectile, type ProjectileOpts } from '../../projectile';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../registry';
import type { ReactionKind } from '../../enemy';
import { Creature, contactHit, entryParam, held, Turner } from '../creatures/common';

const turnOpts: DrawOpts = {};

/** Handhaver numbers (NORMAL). */
export const HANDHAVER = {
  hp: 20,
  score: 300,
  walk: 0.6,
  hold: 130,
  range: 220,
  tele: 24,
  throwTicks: 8,
  recover: 40,
  cool: 50,
  coolJitter: 20,
  maxTickets: 2,
  ticketSpeed: 1.6,
  /** Ticket flight height above the feet, flutter amplitude (px) and period (ticks). */
  chestY: 25,
  flutter: 1.5,
  flutterTicks: 24,
  ticketW: 8,
  ticketH: 5,
  ticketLife: 300,
  /** The gloat: the longest walk to the spot, how far short of it he stops, the phase lengths. */
  gloatWalk: 40,
  gloatStand: 12,
  gloatReach: 24,
  gloatWrite: 48,
  gloatTear: 12,
  gloatDrop: 14,
} as const;

/** The frames of the `gloat` strip (handhaver.art.ts draws them in this order); the game picks one per phase. */
export const GLOAT_FRAME = { write: 0, write2: 1, tear: 2, drop: 3, done: 4 } as const;

/** The torn-off page (the gloat): its fall speed (px/tick), sway (px, ticks), rest on the ground. */
export const GLOAT_PAGE = { fall: 0.45, sway: 2, swayTicks: 24, rest: 600, blink: 30, maxFall: 400 } as const;

const pageOpts: DrawOpts = {};

/**
 * The page the handhaver tears off during the gloat: it flutters down (swaying, its frames
 * turning) onto the spot where the last player went down, lies there a while, blinks and goes.
 * Harmless (no hitbox use); without a floor under the spot it falls out of the view and goes.
 */
export class GloatPage extends Entity {
  private readonly x0: number;
  private readonly y0: number;
  private readonly tx: number;
  private readonly floor: number;
  private readonly fallT: number;
  private t = 0;
  /** Ticks on the ground (−1: still falling). */
  private rest = -1;

  constructor(world: World, x: number, y: number, tx: number) {
    super(world, x, y);
    this.x0 = x;
    this.y0 = y;
    this.tx = tx;
    this.z = 29;
    this.despawnMargin = 64;
    const f = world.terrain.surfaceY(tx, y, y + 160);
    this.floor = Number.isFinite(f) ? f - 3 : Infinity;
    this.fallT = Number.isFinite(f) ? Math.max(1, (this.floor - y) / GLOAT_PAGE.fall) : 120;
  }

  /** Lying on the ground? */
  get landed(): boolean {
    return this.rest >= 0;
  }

  override update(): void {
    this.t++;
    if (this.rest >= 0) {
      if (++this.rest > GLOAT_PAGE.rest + GLOAT_PAGE.blink) this.remove();
      return;
    }
    const k = Math.min(1, this.t / this.fallT);
    this.x = this.x0 + (this.tx - this.x0) * k + Math.sin((this.t * Math.PI * 2) / GLOAT_PAGE.swayTicks) * GLOAT_PAGE.sway * (1 - k);
    this.y = this.y0 + this.t * GLOAT_PAGE.fall;
    if (this.y >= this.floor) {
      this.x = this.tx;
      this.y = this.floor;
      this.rest = 0;
    } else if (this.t > GLOAT_PAGE.maxFall) this.remove();
  }

  override draw(r: Renderer): void {
    if (this.rest > GLOAT_PAGE.rest && this.rest % 4 < 2) return;
    pageOpts.flipX = this.tx < this.x0;
    // Falling: the fluttering frames; on the ground: the flat one.
    r.sprite('enemy/boete-ticket/fly', this.rest >= 0 ? 2 : (this.t >> 2) & 3, this.x, this.y, pageOpts);
  }
}

/** The fluttering ticket: straight flight with a small sine bob round its start height. */
export class BoeteTicket extends Projectile {
  private baseY = 0;

  override init(o: ProjectileOpts): void {
    super.init(o);
    this.baseY = this.y;
  }

  protected override move(): void {
    this.x += this.vx;
    this.y = this.baseY + Math.sin((this.t * Math.PI * 2) / HANDHAVER.flutterTicks) * HANDHAVER.flutter;
    if (this.vx !== 0) this.facing = this.vx < 0 ? -1 : 1;
  }
}

const ticketOpts: ProjectileOpts = { team: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 10 };

/** Fire one ticket from a thrower's feet point (x, feetY) along `dir`. */
export function throwTicket(world: World, x: number, feetY: number, dir: number, speed: number, shooter: Projectile['shooter'] = null): BoeteTicket {
  const o = ticketOpts;
  o.x = x;
  o.y = feetY - HANDHAVER.chestY;
  o.vx = dir * speed;
  o.vy = 0;
  o.damage = 10;
  o.kind = 'bullet';
  o.w = HANDHAVER.ticketW;
  o.h = HANDHAVER.ticketH;
  o.life = HANDHAVER.ticketLife;
  o.sprite = 'enemy/boete-ticket/fly';
  o.look = 'anim';
  o.ticksPerFrame = 4;
  o.offscreen = 32;
  o.type = 'boete-ticket';
  o.shooter = shooter;
  const p = BoeteTicket.spawn(world, o);
  o.shooter = null;
  return p;
}

const SKINS = ['a', 'b', 'c'] as const;

export class Handhaver extends Creature {
  /** One sprite per draw: drawn at the sub-pixel position (Enemy.fineDraw). */
  protected override fineDraw = true;

  private readonly tickets: Array<BoeteTicket | null> = [null, null];
  private telegraph: number = HANDHAVER.tele;
  private cool: number;
  private readonly hold: number;
  /** Walk turns (hysteresis + the 2-frame turn strip). */
  private readonly turner: Turner;
  private turnId = '';
  /** A driven vehicle's touch (GDD §8.5). */
  private readonly touch: Damage;
  /** The gloat: where he walks to, the phase and its ticks. */
  private gloatGoal = 0;
  private gloatPhase: 'walk' | 'write' | 'tear' | 'drop' | 'done' = 'walk';
  private gloatPhaseT = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const sk = paramStr(p, 'skin', '');
    const skin = sk === 'a' || sk === 'b' || sk === 'c' ? sk : SKINS[world.rng.int(0, 2)];
    super(world, x, y, p, { art: skin === 'a' ? 'enemy/handhaver' : `enemy/handhaver-${skin}`, hp: HANDHAVER.hp, w: 14, h: 30, score: HANDHAVER.score });
    this.hold = paramNum(p, 'hold', HANDHAVER.hold);
    this.cool = world.rng.int(20, 50);
    this.alerted = true;
    const entry = entryParam(p);
    if (entry === 'left') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else this.facePlayer();
    this.turner = new Turner(this.facing, 2, 2);
    this.touch = contactHit(this, 'bullet');
    this.setMode('walk');
  }

  /** A driven player vehicle that touches him breaks him (the vehicle takes ½ cell). */
  private bumpVehicles(): boolean {
    this.touch.dirX = this.facing;
    return this.breakOnVehicle(this.touch);
  }

  /** Tickets of this officer still in the air. */
  private airborne(): number {
    let n = 0;
    for (let i = 0; i < this.tickets.length; i++) {
      const t = this.tickets[i];
      if (t && !t.removed && t.shooter === this) n++;
      else this.tickets[i] = null;
    }
    return n;
  }

  /** The throwing hand is inside the view (rule 3). */
  private handInView(): boolean {
    return this.inView(this.x + this.facing * 8, this.y - HANDHAVER.chestY, -8);
  }

  protected override think(): void {
    this.modeT++;
    if (this.bumpVehicles()) return;
    switch (this.mode) {
      case 'walk':
        return this.thinkWalk();
      case 'tell':
        return this.thinkTell();
      case 'throw':
        this.vx = 0;
        if (this.modeT >= HANDHAVER.throwTicks) this.setMode('recover');
        return;
      case 'recover':
        this.vx = 0;
        // The throw strip's recover frames finish first (draw only), then the idle breathing.
        if (!this.playing('throw') || this.anim.done) this.play('idle');
        if (this.modeT >= HANDHAVER.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(HANDHAVER.cool, HANDHAVER.coolJitter);
          this.setMode('walk');
        }
        return;
    }
  }

  /** Walk-time facing: the Turner (hysteresis, turn frames, flip at the midpoint). */
  private turnToPlayer(): ReturnType<Handhaver['target']> {
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
    const terr = this.world.terrain;
    const ahead = this.x + this.facing * 10;
    const floorAhead = terr.surfaceY(ahead, this.y - 12, this.y + 24);
    const blocked = terr.isSolid(ahead, this.y - 12) || !Number.isFinite(floorAhead);
    if (this.turner.turning) {
      this.vx = 0;
      this.play('idle');
    } else if (dist > this.hold && !blocked) {
      this.vx = HANDHAVER.walk * this.facing;
      this.play('walk');
      // Cadence by speed: Enemy.update adds 1 tick; the difference speeds / slows the stride.
      this.anim.tick += strideRate(this.vx, HANDHAVER.walk) - 1;
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (--this.cool > 0) return;
    if (dist <= HANDHAVER.range && Math.abs(t.y - this.y) < 40 && this.handInView() && this.onScreen(-8) && this.airborne() < HANDHAVER.maxTickets && this.takeToken()) {
      this.facePlayer();
      this.turner.snap(this.facing);
      this.telegraph = this.tele(HANDHAVER.tele);
      this.vx = 0;
      this.setMode('tell');
      this.play('tell', { restart: true });
      this.world.audio.sfx('ams/ticket', { vol: 0.5 });
      hudOf(this.world).bubble(this, 'BOETE!', { ticks: this.telegraph + 8, kind: 'gag', speaker: 'handhaver' });
    } else this.cool = 10;
  }

  private thinkTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    if (!this.handInView() || !this.target()) return this.cancelAttack();
    this.facePlayer();
    this.turner.snap(this.facing);
    const p = throwTicket(this.world, this.x + this.facing * 10, this.y, this.facing, HANDHAVER.ticketSpeed * this.mods.enemyBulletSpeed, this);
    const slot = this.tickets[0] && !this.tickets[0].removed ? 1 : 0;
    this.tickets[slot] = p;
    this.world.audio.sfx('ams/ticket');
    this.setMode('throw');
    this.play('throw', { restart: true });
  }

  // ------------------------------------------------------------------------------- reactions

  /** A reaction never stops a driven vehicle breaking him. */
  protected override thinkReaction(kind: ReactionKind): void {
    if (this.bumpVehicles()) return;
    super.thinkReaction(kind);
  }

  /** The gloat starts: the place short of the spot, at most `gloatWalk` px away. */
  protected override onGloatStart(spot: Entity | null): void {
    let goal = this.x;
    if (spot && Math.abs(spot.x - this.x) > HANDHAVER.gloatStand) {
      const side = spot.x > this.x ? 1 : -1;
      goal = spot.x - side * HANDHAVER.gloatStand;
      goal = Math.max(this.x - HANDHAVER.gloatWalk, Math.min(this.x + HANDHAVER.gloatWalk, goal));
    }
    this.gloatGoal = goal;
    this.turner.snap(this.facing);
    this.setGloatPhase('walk');
  }

  private setGloatPhase(p: Handhaver['gloatPhase']): void {
    this.gloatPhase = p;
    this.gloatPhaseT = 0;
  }

  /** Walk to the place, write the fine, tear the page off, let it flutter onto the spot, stand back. */
  protected override thinkGloat(spot: Entity | null, _t: number): void {
    const n = ++this.gloatPhaseT;
    if (this.gloatPhase === 'walk') {
      const dx = this.gloatGoal - this.x;
      const dir = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) > HANDHAVER.walk && this.floorAhead(dir)) {
        this.facing = dir;
        this.turner.snap(dir);
        this.vx = HANDHAVER.walk * dir;
        this.play('walk');
        this.anim.tick += strideRate(this.vx, HANDHAVER.walk) - 1;
        return;
      }
      this.setGloatPhase('write');
      this.gloatFrame(spot, GLOAT_FRAME.write);
      return;
    }
    let f: number = GLOAT_FRAME.done;
    switch (this.gloatPhase) {
      case 'write':
        f = (n >> 3) & 1 ? GLOAT_FRAME.write2 : GLOAT_FRAME.write;
        if (n === 1 || n === 25) this.world.audio.sfx('ams/gloat-scribble', { vol: 0.8 });
        this.sayGloat('VERBODEN TE LIGGEN!', 80, 'handhaver');
        if (n >= HANDHAVER.gloatWrite) this.setGloatPhase('tear');
        break;
      case 'tear':
        f = GLOAT_FRAME.tear;
        if (n === 1) this.world.audio.sfx('ams/gloat-tear');
        if (n >= HANDHAVER.gloatTear) this.setGloatPhase('drop');
        break;
      case 'drop':
        f = GLOAT_FRAME.drop;
        if (n === 1) this.dropPage(spot);
        if (n >= HANDHAVER.gloatDrop) this.setGloatPhase('done');
        break;
    }
    this.gloatFrame(spot, f);
  }

  /** Stand still facing the spot on gloat frame `f`. */
  private gloatFrame(spot: Entity | null, f: number): void {
    this.vx = 0;
    this.faceSpot(spot);
    this.turner.snap(this.facing);
    if (!this.hasAnim('gloat')) return this.play('idle');
    this.play('gloat', held());
    this.anim.index = f;
  }

  /** Let the torn page go from the raised hand: it flutters down onto the spot (at most `gloatReach` px in front). */
  private dropPage(spot: Entity | null): void {
    const r = HANDHAVER.gloatReach;
    const tx = spot ? Math.max(this.x - r, Math.min(this.x + r, spot.x)) : this.x + this.facing * HANDHAVER.gloatStand;
    this.world.add(new GloatPage(this.world, this.x + this.facing * 9, this.y - 32, tx));
    this.world.audio.sfx('ams/ticket', { vol: 0.6 });
  }

  /** Is there floor at his own height `dist` px ahead in `dir` (no wall, no drop)? */
  private floorAhead(dir: number, dist = 10): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * dist;
    if (t.isSolid(ax, this.y - 12)) return false;
    const fy = t.surfaceY(ax, this.y - 6, this.y + 6);
    return Number.isFinite(fy) && Math.abs(fy - this.y) <= 3;
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    // Back to his beat (walk and throw) once the gloat is over.
    if (kind === 'gloat' && this.alive) this.setMode('walk');
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    if (this.mode === 'tell' || this.mode === 'throw' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('walk');
    }
  }

  override draw(r: Renderer): void {
    const f = this.dead ? -1 : this.turner.frame();
    if (f < 0) return super.draw(r);
    if (!this.turnId) this.turnId = this.spriteId('turn');
    turnOpts.flipX = this.facing < 0;
    turnOpts.flash = this.flashTicks > 0;
    r.sprite(this.turnId, f, this.x, this.y, turnOpts);
  }

  protected override deathEffects(d: Damage): void {
    this.world.audio.sfx('ams/handhaver-down');
    confetti(this.world, this.x, this.y - 22, 12, 2);
    for (let i = 0; i < 3; i++) {
      tumble(this.world, 'enemy/boete-ticket/fly', this.x, this.y - 24, (i - 1) * 0.9 + d.dirX * 0.4, -2 - i * 0.4, { gravity: 0.06, life: 60 });
    }
  }
}

defineEntity('handhaver', (w, x, y, p) => new Handhaver(w, x, y, p), {
  category: 'enemy',
  score: HANDHAVER.score,
  description: 'City enforcement officer: walks in, BOETE! tell (book, pencil), throws a fluttering ticket at chest height (crouch dodges), max 2 in the air (ams).',
});

defineEntity(
  'boete-ticket',
  (w, x, y, p) => {
    const dir = p.facing === 1 || p.facing === 'right' ? 1 : -1;
    return throwTicket(w, x, y, dir, paramNum(p, 'speed', HANDHAVER.ticketSpeed));
  },
  { category: 'projectile', description: 'BOETE ticket: chest high (25 px over y), 1.6 px/tick with a ±1.5 px flutter; a crouch dodges it (params facing, speed).' },
);
