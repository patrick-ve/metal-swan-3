/**
 * `fatbike-youth` — a hang youth on a fat-tyre e-bike (docs/design/amsterdam.md §2). 20 HP
 * (pair 30), soft, 300 points (pair 500).
 *
 * - Enters from either side at 1.8 px/tick and brakes to 0.8 px/tick within 90 px of the player.
 * - TELL 24 (inside the view, with an attack token, player ≤ 48 px ahead): a wheelie,
 *   `ams/bass-thump`, bubble `OI!`. ATTACK 8: a kick box ahead at shin / knee height
 *   (y −22 … −6) — a jump clears it. RECOVER: rides on and off screen, or (50 %) turns around
 *   once for one more pass.
 * - Gag `circles`: slow laps (±40 px) round its spawn point, music thumping; it notices a player
 *   within 120 px (or a shot nearby), double-takes, then rides at him.
 * - Death: tumbles off, the cap flies, he gets up and runs off yelling `MAMA!`; the bike skids
 *   away and fades (burnt / crushed youths stay down).
 *
 * Params: `pair` (true: a passenger on the rack does the kick), `gag` (`circles` / true / false),
 * `enter` / `entry` (`left` / `right`), `facing`, `look` (0–3), `skin` (`a` / `b` / `c`),
 * `turn` (true / false: force the second pass), + the Enemy params `hp`, `drop`, `tag`.
 */
import type { Damage } from '../../../engine/entity';
import type { World } from '../../../engine/world';
import { tumble } from '../../fx';
import { defineEntity, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';
import { gagParam } from '../creatures/common';
import { gagBubble, Rider } from './rider';
import { youthSet, YOUTH_LOOKS, type SkinKey } from './rider.art';

/** Fatbike youth numbers (NORMAL). */
export const FATBIKE = {
  hp: 20,
  pairHp: 30,
  score: 300,
  pairScore: 500,
  fast: 1.8,
  slow: 0.8,
  brake: 90,
  /** The telegraph starts with the player at most this far ahead (and 4+ px ahead). */
  tellAt: 48,
  tele: 24,
  kick: 8,
  notice: 120,
  circle: 40,
  turnChance: 0.5,
  /** Ride this far past the player before a U-turn (or until the view edge). */
  turnPast: 100,
  turnTicks: 20,
  thump: 36,
  flee: 2,
} as const;

const SKIN_KEYS: readonly SkinKey[] = ['a', 'b', 'c'];
/** Looks that wear a cap (the others wear the hood up). */
const CAP_LOOKS = new Set([0, 2]);

export class FatbikeYouth extends Rider {
  readonly pair: boolean;
  private readonly look: number;
  private readonly cx: number;
  /** Turn round for one more pass after this kick (decided at the kick). */
  private willTurn = false;
  private turned = false;
  private fleeing = false;
  private fleeT = 0;
  private canFlee = false;
  /** Draw-side: the get-up strip plays between the fall and the flee. */
  private gettingUp = false;
  private readonly artSet: string;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const pair = paramBool(p, 'pair', false);
    const look = Math.max(0, Math.min(YOUTH_LOOKS.length - 1, Math.round(paramNum(p, 'look', world.rng.int(0, YOUTH_LOOKS.length - 1)))));
    const sk = paramStr(p, 'skin', '');
    const skin: SkinKey = sk === 'a' || sk === 'b' || sk === 'c' ? sk : SKIN_KEYS[world.rng.int(0, 2)];
    super(world, x, y, p, { art: `enemy/${youthSet(look, skin, pair)}`, hp: pair ? FATBIKE.pairHp : FATBIKE.hp, score: pair ? FATBIKE.pairScore : FATBIKE.score });
    this.pair = pair;
    this.speaker = 'youth';
    this.artSet = `enemy/${youthSet(look, skin, pair)}`;
    this.look = look;
    this.cx = x;
    const gag = gagParam(p, world, 0);
    if (gag !== null && !p.enter && !p.entry) {
      this.startGag(gag === 'circles' ? '' : gag);
    } else {
      this.alerted = true;
      this.setMode('ride');
    }
    if (p.turn === true) this.willTurn = true;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    this.contactDamage = null;
    if (this.bumpVehicles()) return;
    switch (this.mode) {
      case 'gag':
        return this.thinkGag();
      case 'notice':
        if (this.thinkNotice()) {
          this.facePlayer();
          this.setMode('ride');
        }
        return;
      case 'ride':
        return this.thinkRide();
      case 'tell':
        return this.thinkTell();
      case 'kick':
        if (this.thinkKick(FATBIKE.kick, FATBIKE.slow)) {
          this.releaseToken();
          if (!this.turned && !this.willTurn && this.params.turn !== false) this.willTurn = this.world.rng.chance(FATBIKE.turnChance);
          this.setMode('away');
        }
        return;
      case 'away':
        return this.thinkAway();
      case 'turn':
        return this.thinkTurn();
    }
  }

  /** Slow laps round the spawn point with the music on. */
  private thinkGag(): void {
    if (this.x > this.cx + FATBIKE.circle) this.facing = -1;
    else if (this.x < this.cx - FATBIKE.circle) this.facing = 1;
    this.pedal(FATBIKE.slow, 'gag');
    if (this.modeT % FATBIKE.thump === 1 && this.onScreen(0)) this.world.audio.sfx('ams/bass-thump', { vol: 0.5 });
    if (this.heardShout() || this.gagNotices(FATBIKE.notice, FATBIKE.notice)) {
      if (this.mode !== 'notice') this.startNotice(14, 0);
    }
  }

  private thinkRide(): void {
    const a = this.ahead();
    if (!Number.isFinite(a) || a < -16) {
      this.setMode('away');
      return;
    }
    this.pedal(a < FATBIKE.brake ? FATBIKE.slow : FATBIKE.fast);
    const t = this.target();
    if (t && a >= 4 && a <= FATBIKE.tellAt && Math.abs(t.y - this.y) < 40 && this.visible() && this.takeToken()) {
      this.startTell(FATBIKE.tele, 'ams/bass-thump', 'OI!');
    }
  }

  private thinkTell(): void {
    this.vx = FATBIKE.slow * this.facing;
    this.play('tell');
    if (this.modeT < this.telegraph) return;
    // Rule 3: the kick only from inside the view.
    if (!this.visible()) return this.cancelAttack();
    this.startKick();
  }

  private thinkAway(): void {
    this.pedal(FATBIKE.fast);
    if (!this.willTurn || this.turned) return;
    const a = this.ahead();
    if (a < -FATBIKE.turnPast || !this.inView(this.x + this.facing * 24, this.y - 20, 0)) this.setMode('turn');
  }

  /** Brake, swing round, ride back for one more pass. */
  private thinkTurn(): void {
    const k = 1 - this.modeT / FATBIKE.turnTicks;
    this.vx = this.facing * FATBIKE.fast * Math.max(0, k);
    this.play('idle');
    if (this.modeT === Math.round(FATBIKE.turnTicks / 2)) this.facing = this.facing > 0 ? -1 : 1;
    if (this.modeT >= FATBIKE.turnTicks) {
      this.turned = true;
      this.willTurn = false;
      this.facePlayer();
      this.setMode('ride');
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    this.wreckBike();
    this.canFlee = d.kind !== 'fire' && d.kind !== 'crush';
    if (CAP_LOOKS.has(this.look)) {
      tumble(this.world, 'enemy/fatbike-youth/cap', this.x - this.facing * 2, this.y - 34, -this.facing * 0.8 + d.dirX * 0.6, -2.4, { life: 50 });
    }
    this.corpseTicks = this.canFlee ? 9999 : 40;
    // Not launched by a blast: he falls off the seat (then gets up before the flee).
    if (this.canFlee && d.kind !== 'explosion' && this.hasAnim('die-seat')) this.play('die-seat', { restart: true, loop: false });
    if (this.pair) {
      // The passenger jumps off the rack and runs for it (yelling too), away from the player.
      const t = this.target();
      const dir = t && t.x > this.x ? -1 : 1;
      tumble(this.world, `${this.artSet}/passenger-flee`, this.x - this.facing * 8, this.y, dir * FATBIKE.flee * 1.1, 0, { gravity: 0, life: 110, flipX: dir < 0 });
      gagBubble(this.world, this, 'MAMA!', 40, this.speaker);
    }
  }

  protected override updateDeath(): void {
    if (this.fleeing) {
      this.fleeT++;
      this.vx = this.facing * FATBIKE.flee;
      if (this.body) this.physics();
      this.anim.update();
      if (this.fleeT > 200 || (this.fleeT > 20 && !this.onScreen(8))) this.remove();
      return;
    }
    if (this.gettingUp) {
      if (this.body) this.physics();
      this.anim.update();
      if (!this.anim.done) return;
    } else {
      super.updateDeath();
      if (this.canFlee && !this.removed && this.anim.done && this.hasAnim('get-up')) {
        this.gettingUp = true;
        this.play('get-up', { restart: true, loop: false });
        return;
      }
    }
    if (this.canFlee && !this.removed && this.anim.done) {
      // Up again, and away from the nearest player.
      this.fleeing = true;
      const t = this.target();
      this.facing = t && t.x > this.x ? -1 : 1;
      this.play('flee', { restart: true, loop: true });
      gagBubble(this.world, this, 'MAMA!', 60, this.speaker);
    }
  }
}

defineEntity('fatbike-youth', (w, x, y, p) => new FatbikeYouth(w, x, y, p), {
  category: 'enemy',
  score: FATBIKE.score,
  description: 'Hang youth on a fatbike: rides in, wheelie tell (OI!), kick at knee height (jump it), rides off or turns once; pair: +passenger (ams).',
});
