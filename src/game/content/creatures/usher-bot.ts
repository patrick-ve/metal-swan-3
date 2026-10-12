/**
 * `usher-bot` — the Usher-Bot (docs/GAME_DESIGN.md §9.3; m4-c1, m4-d, m5-b). 60 HP, 700 points.
 * A robot theatre usher that patrols at 0.5 px/tick with a visible yellow flashlight cone (96 px
 * long, 30°). No contact damage.
 *
 * - Shush: a player inside the cone → T 30 (`SHHH!` bubble, the beam turns crimson,
 *   `creature/shush`) → 3 ticket darts in a narrow spread (±8°) at 2.5 px/tick → R 60.
 * - Death: its head spins, it prints a long paper receipt that reads `ADMIT NONE` and folds up.
 * - Gags (`params.gag`): `ticket` (checks an imaginary ticket) or `polish` (polishes its
 *   flashlight); the beam is off during a gag (free time, rule 1).
 *
 * Params: `patrol` (px each side of the spawn x, default 80; 0 = stands guard), `gag` (`ticket` |
 * `polish` | true | false; default 30 % of placed ushers), `facing`, `enter` (`left` / `right`:
 * walks in alerted), plus the Enemy params `hp`, `drop`, `tag`.
 * Our choices where the GDD is silent: the cone points 8° down from the lamp so it sweeps the
 * floor ahead; it waits 40 ticks at each end of its patrol; the darts aim at the player's chest
 * (kept inside the cone) and deal 10 ('bullet', ½ vehicle cell); a hit from behind turns it round;
 * the cone needs a clear line of sight (no seeing through walls).
 */
import type { Damage, DamageKind, Entity } from '../../../engine/entity';
import type { Color } from '../../../engine/color';
import { PAL } from '../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { debris } from '../../fx';
import { defineEntity, paramFacing, paramNum, type SpawnParams } from '../../registry';
import { Creature, entryParam, gagParam } from './common';
import { BEAM } from './usher-beam';

/** Usher-bot numbers (GDD §9.3; NORMAL). */
export const USHER = {
  hp: 60,
  score: 700,
  w: 16,
  h: 34,
  patrol: 0.5,
  patrolRange: 80,
  pause: 40,
  beamLen: BEAM.len,
  beamHalf: BEAM.half,
  beamTilt: BEAM.tilt,
  tele: 30,
  darts: 3,
  spread: (8 * Math.PI) / 180,
  dartSpeed: 2.5,
  dartDamage: 10,
  recover: 60,
  gagChance: 0.3,
  /** Beam alpha (it is light, not a wall). */
  beamAlpha: 0.3,
} as const;

const A = 'creature/usher-bot';
const lamp: [number, number] = [0, 0];
const muzzle: [number, number] = [0, 0];
const beamOpts: DrawOpts = {};
const GAGS = ['ticket', 'polish'] as const;

export class UsherBot extends Creature {
  private readonly homeX: number;
  private readonly range: number;
  private telegraph: number = USHER.tele;
  /** The player caught in the beam (aimed at when the darts fly). */
  private caught: Entity | null = null;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: A, hp: USHER.hp, w: USHER.w, h: USHER.h });
    this.clampToSection();
    this.homeX = this.x;
    this.range = Math.max(0, paramNum(p, 'patrol', USHER.patrolRange));
    const t = world.nearestPlayer(this.x, this.y);
    this.facing = paramFacing(p, t && t.x < this.x ? -1 : 1);
    const entry = entryParam(p);
    if (entry === 'left' || entry === 'right') {
      this.alerted = true;
      this.facing = entry === 'left' ? 1 : -1;
      this.setMode('patrol');
      return;
    }
    const gag = gagParam(p, world, USHER.gagChance);
    if (gag !== null) this.startGag(gag === '' ? world.rng.pick(GAGS) : gag);
    else this.setMode('patrol');
  }

  /** The beam shines while it patrols, waits, telegraphs, shoots and recovers. */
  get beamOn(): boolean {
    return !this.dead && !this.reacting && (this.mode === 'patrol' || this.mode === 'wait' || this.mode === 'tell' || this.mode === 'shoot' || this.mode === 'recover');
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.heardShout() && this.mode === 'gag') this.startNotice(this.world.rng.int(10, 16));
    switch (this.mode) {
      case 'gag':
        this.vx = 0;
        this.play(this.gagAnim);
        this.gagNotices();
        return;
      case 'notice':
        if (this.thinkNotice()) this.setMode('patrol');
        return;
      case 'patrol':
        return this.thinkPatrol();
      case 'wait':
        this.vx = 0;
        this.play('idle');
        if (this.spotPlayer()) return;
        if (this.modeT >= USHER.pause) {
          this.facing = this.facing > 0 ? -1 : 1;
          this.setMode('patrol');
        }
        return;
      case 'tell':
        return this.thinkTell();
      case 'shoot':
        this.vx = 0;
        if (this.modeT >= 16) this.play('idle');
        if (this.modeT >= USHER.recover) {
          this.releaseToken();
          this.setMode('patrol');
        }
        return;
    }
  }

  private thinkPatrol(): void {
    if (this.spotPlayer()) return;
    // Turn at the patrol ends, at walls and at ledges (it never walks off).
    const b = this.body;
    const ahead = this.x + this.facing * (USHER.w / 2 + 4);
    const floor = this.world.terrain.surfaceY(ahead, this.y - 6, this.y + 10);
    const atEnd = this.range > 0 && (this.facing > 0 ? this.x >= this.homeX + this.range : this.x <= this.homeX - this.range);
    if (this.range === 0 || atEnd || !Number.isFinite(floor) || (b?.contact.hitWall && b.contact.wallDir === this.facing)) {
      this.vx = 0;
      this.setMode('wait');
      this.play('idle');
      return;
    }
    this.vx = this.facing * USHER.patrol;
    this.play('walk');
  }

  /** A player inside the flashlight cone (with a clear line of sight) starts the shush. */
  private spotPlayer(): boolean {
    if (!this.onScreen(-8)) return false;
    const t = this.inBeam();
    if (!t || !this.takeToken()) return false;
    this.caught = t;
    this.alert();
    this.vx = 0;
    this.telegraph = this.tele(USHER.tele);
    this.setMode('tell');
    this.play('tell');
    this.world.audio.sfx('creature/shush');
    hudOf(this.world).bubble(this, 'SHHH!', { kind: 'gag', ticks: this.telegraph });
    return true;
  }

  /** The first player with its head, chest or feet inside the cone. */
  inBeam(): Entity | null {
    this.point('lamp', 18, -19, lamp);
    const players = this.world.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive || p.team !== 'player') continue;
      const h = -p.hitbox.y;
      for (const k of PROBES) {
        const px = p.x;
        const py = p.y - h * k;
        if (this.coneHas(px, py) && this.world.terrain.lineOfSight(lamp[0], lamp[1], px, py)) return p;
      }
    }
    return null;
  }

  /** Is a world point inside the beam (96 px, ±15° around an axis 8° below horizontal)? */
  private coneHas(px: number, py: number): boolean {
    const dx = (px - lamp[0]) * this.facing;
    const dy = py - lamp[1];
    if (dx <= 0 || dx * dx + dy * dy > USHER.beamLen * USHER.beamLen) return false;
    return Math.abs(Math.atan2(dy, dx) - USHER.beamTilt) <= USHER.beamHalf;
  }

  private thinkTell(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    // Rule 3: the punch fires only from inside the view.
    this.point('muzzle', 12, -16, muzzle);
    if (!this.inView(muzzle[0], muzzle[1])) return this.cancelAttack();
    this.fireDarts();
    this.setMode('shoot');
    this.play('attack', { restart: true, loop: false });
  }

  /** 3 ticket darts at the caught player's chest (kept inside the cone), ±8° apart. */
  private fireDarts(): void {
    this.play('attack', { restart: true, loop: false });
    this.point('muzzle', 12, -16, muzzle);
    const t = this.caught && this.caught.alive ? this.caught : this.target();
    // Aim in the facing frame (0 = straight ahead), clamped to the cone.
    let a = USHER.beamTilt;
    if (t) {
      const dx = (t.x - muzzle[0]) * this.facing;
      const dy = t.y + t.hitbox.y * 0.5 - muzzle[1];
      if (dx > 4) a = Math.max(USHER.beamTilt - USHER.beamHalf, Math.min(USHER.beamTilt + USHER.beamHalf, Math.atan2(dy, dx)));
    }
    for (let i = 0; i < USHER.darts; i++) {
      const local = a + (i - 1) * USHER.spread;
      const angle = this.facing > 0 ? local : Math.PI - local;
      const d = this.shoot({ speed: USHER.dartSpeed, damage: USHER.dartDamage, sprite: `${A}/ticket-dart`, angle, x: muzzle[0], y: muzzle[1], w: 6, h: 4, life: 150 });
      d.type = 'ticket-dart';
    }
    this.world.audio.sfx('hit/metal', { pitch: 1.8, vol: 0.5 });
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.caught = null;
    if (this.mode === 'tell' || this.mode === 'shoot') {
      hudOf(this.world).clearBubble(this);
      this.setMode('patrol');
    }
  }

  /** A shot from behind turns it round (to catch the culprit in its beam). */
  override onHit(d: Damage, part = 0): boolean {
    const hit = super.onHit(d, part);
    if (hit && this.alive && d.dirX !== 0 && (this.mode === 'patrol' || this.mode === 'wait')) {
      const from = d.dirX > 0 ? -1 : 1;
      if (from !== this.facing) {
        this.facing = from;
        this.setMode('patrol');
      }
    }
    return hit;
  }

  // ------------------------------------------------------------------------------- death

  /** Facing left the sprite is drawn flipped: `die-left` keeps the receipt text readable. */
  override deathAnim(kind: DamageKind): string | null {
    const pick = super.deathAnim(kind);
    return pick === 'die' && this.facing < 0 && this.hasAnim('die-left') ? 'die-left' : pick;
  }

  protected override deathEffects(d: Damage): void {
    this.caught = null;
    hudOf(this.world).clearBubble(this);
    this.world.audio.sfx('hit/metal', { pitch: 0.7 });
    if (this.playing('die') || this.playing('die-left')) this.corpseTicks = 40;
    else {
      if (d.kind === 'explosion') debris(this.world, this.x, this.y - 20, 'metal', 4);
      this.corpseTicks = d.kind === 'crush' ? 8 : 20;
    }
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.beamOn) {
      const red = this.mode === 'tell' || (this.mode === 'shoot' && this.modeT < 12);
      const pulse = this.mode === 'tell' && this.modeT % 6 < 3 ? 0.1 : 0;
      this.drawBeam(r, red ? PAL.red : PAL.gold, USHER.beamAlpha + pulse);
    }
    super.draw(r);
  }

  /**
   * The flashlight cone, column by column from the lamp: a bright core, a softer rim, and every
   * column cut off at the floor (the light pools on the ground instead of shining through it).
   */
  private drawBeam(r: Renderer, ramp: readonly Color[], alpha: number): void {
    this.point('lamp', 18, -19, lamp);
    const lx = Math.round(lamp[0]);
    const ly = Math.round(lamp[1]);
    const terr = this.world.terrain;
    const t0 = Math.tan(USHER.beamTilt - USHER.beamHalf);
    const t1 = Math.tan(USHER.beamTilt + USHER.beamHalf);
    const c0 = Math.tan(USHER.beamTilt - USHER.beamHalf * 0.45);
    const c1 = Math.tan(USHER.beamTilt + USHER.beamHalf * 0.45);
    beamOpts.alpha = alpha;
    for (let d = 1; d <= USHER.beamLen; d++) {
      const x = lx + d * this.facing;
      const top = ly + Math.round(d * t0);
      let bot = ly + Math.round(d * t1);
      const floor = terr.surfaceY(x, ly, bot + 1);
      if (Number.isFinite(floor)) bot = Math.min(bot, Math.round(floor) - 1);
      if (bot < top) continue;
      r.rect(x, top, 1, bot - top + 1, ramp[2], beamOpts);
      const ct = ly + Math.round(d * c0);
      const cb = Math.min(bot, ly + Math.round(d * c1));
      if (cb >= ct) r.rect(x, ct, 1, cb - ct + 1, ramp[3], beamOpts);
    }
  }
}

/** Where a player is tested against the cone: feet, chest, head (fractions of its height). */
const PROBES = [0.1, 0.5, 0.9] as const;

defineEntity('usher-bot', (w, x, y, p) => new UsherBot(w, x, y, p), {
  category: 'enemy',
  score: USHER.score,
  description: 'Usher-Bot: patrols with a flashlight cone, shushes and fires 3 ticket darts (m4, m5).',
});
