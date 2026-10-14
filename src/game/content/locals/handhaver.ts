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
 *
 * Params: `enter` / `entry` (`left` / `right`: walks in), `facing`, `skin` (`a` / `b` / `c`), `hold`
 * (px: stand this far from the player, default 130), + the Enemy params `hp`, `drop`, `tag`.
 *
 * `boete-ticket` (projectile): y = the thrower's feet; params `facing`, `speed`.
 */
import type { Damage } from '../../../engine/entity';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { confetti, tumble } from '../../fx';
import { Projectile, type ProjectileOpts } from '../../projectile';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../registry';
import { Creature, entryParam } from '../creatures/common';

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
} as const;

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
    this.setMode('walk');
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
        this.play('idle');
        if (this.modeT >= HANDHAVER.recover) {
          this.releaseToken();
          this.cool = this.fireInterval(HANDHAVER.cool, HANDHAVER.coolJitter);
          this.setMode('walk');
        }
        return;
    }
  }

  private thinkWalk(): void {
    const t = this.facePlayer();
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
    if (dist > this.hold && !blocked) {
      this.vx = HANDHAVER.walk * this.facing;
      this.play('walk');
    } else {
      this.vx = 0;
      this.play('idle');
    }
    if (--this.cool > 0) return;
    if (dist <= HANDHAVER.range && Math.abs(t.y - this.y) < 40 && this.handInView() && this.onScreen(-8) && this.airborne() < HANDHAVER.maxTickets && this.takeToken()) {
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
    const p = throwTicket(this.world, this.x + this.facing * 10, this.y, this.facing, HANDHAVER.ticketSpeed * this.mods.enemyBulletSpeed, this);
    const slot = this.tickets[0] && !this.tickets[0].removed ? 1 : 0;
    this.tickets[slot] = p;
    this.world.audio.sfx('ams/ticket');
    this.setMode('throw');
    this.play('throw', { restart: true });
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    if (this.mode === 'tell' || this.mode === 'throw' || this.mode === 'recover') {
      this.cool = 30;
      this.setMode('walk');
    }
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
