/**
 * The in-world continue of the ring (GDD §4.6; docs/design/ring.md §9; docs/api/ring.md §7).
 * The rules of the mission runner's continue (mission/runner.ts `onPlayerOut` … `continuePlayer`),
 * copied for the ring (no refactor of MissionRunner):
 *
 * - A hero out of lives: his countdown starts (`continueTicks`); the game never pauses for it.
 * - Every joined player out: HOLD — the plan cursor and the road speed hold (the runner reads
 *   `held`: no new spawns, the scroll eases to 0), the boss adds hold (`Boss.addsHeld`); the
 *   enemies on screen GLOAT at the spot where the last hero went down (their own business there,
 *   `Enemy.thinkGloat`; never a laugh or a point, mechanics.md §23), renewed every
 *   `TUNING.continues.gloatEvery` ticks.
 * - START on an out slot: a credit, full lives, a fresh wagon drives in from the left; its
 *   arrival (`continueLanded`) makes every non-boss enemy on screen COWER, the boss STAGGERS and
 *   the hold ends. Fire / jump speed the countdown up; no credits: it ends after `noCreditTicks`.
 * - Every countdown run out with every hero out: GAME OVER (`runner.endGame()`).
 */
import type { Entity } from '../../engine/entity';
import { Boss } from '../boss';
import { reactInArea, startGloatHold } from '../enemy';
import type { SlotIndex } from '../session';
import { TUNING } from '../tuning';
import type { RingHero } from './hero';
import type { RingRunner } from './runner';

/** Every hero is out (a plain loop: it runs every tick of a countdown). */
function allOut(players: readonly RingHero[]): boolean {
  for (let i = 0; i < players.length; i++) if (players[i].state !== 'out') return false;
  return true;
}

/** A hero is in play again (mounted, on foot or in the victory pose). */
function anyInPlay(players: readonly RingHero[]): boolean {
  for (let i = 0; i < players.length; i++) {
    const st = players[i].state;
    if (st === 'mounted' || st === 'play' || st === 'victory') return true;
  }
  return false;
}

export class RingContinue {
  private readonly runner: RingRunner;
  /** Every joined player is out: the plan, the scroll and the boss adds hold. */
  held = false;
  /** Ticks since the hold started; the countdown number last heard. */
  private heldT = 0;
  private countShown = -1;
  /** The gloat's spot: the last hero out (he stays on the hard shoulder, where the wagon went). */
  private gloatSpot: Entity | null = null;

  constructor(runner: RingRunner) {
    this.runner = runner;
  }

  /** A hero lost the last life: his countdown; with every hero out the world holds. */
  onPlayerOut(slot: SlotIndex, p: Entity): void {
    const r = this.runner;
    // The last hero out during the victory drive: no countdown can run there.
    if (r.state === 'victory' && r.session.allOut) {
      r.endGame();
      return;
    }
    r.continueTicks[slot] = TUNING.continues.seconds * TUNING.continues.ticksPerCount;
    r.events.emit('playerOut', { slot });
    if (r.session.allOut) {
      this.gloatSpot = p;
      if (!this.held) {
        this.hold(true);
        r.events.emit('allOut', { slot });
      }
    }
  }

  /** Start / end a hold (a new hold is a new gloat hold: each enemy gloats afresh). */
  hold(on: boolean): void {
    if (this.held === on) return;
    this.held = on;
    this.heldT = 0;
    this.countShown = -1;
    const world = this.runner.world;
    if (on) startGloatHold(world);
    const bosses = world.byTag('boss');
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      if (b instanceof Boss) b.addsHeld = on;
    }
  }

  /** The countdown number on show (9 … 0) while held; −1 when none runs. */
  get countdownNumber(): number {
    if (!this.held) return -1;
    const ct = this.runner.continueTicks;
    const t = Math.max(ct[0], ct[1]);
    return t < 0 ? -1 : Math.max(0, Math.ceil(t / TUNING.continues.ticksPerCount) - 1);
  }

  /** Once per tick while playing (after the world update). */
  update(): void {
    this.updateCountdowns();
    if (this.held && this.runner.state === 'playing') this.updateHeld();
  }

  private updateCountdowns(): void {
    const r = this.runner;
    const C = TUNING.continues;
    if (this.held) this.heldT++;
    for (let i = 0; i < 2; i++) {
      const t = r.continueTicks[i];
      if (t < 0) continue;
      const pad = r.pads[i];
      if (pad.pressed('start') && this.continuePlayer(i as SlotIndex)) {
        r.audio.sfx('ui/confirm');
        continue;
      }
      let left = t - 1 - (pad.pressed('fire') || pad.pressed('jump') ? C.skipTicks : 0);
      if (this.held && r.session.credits <= 0 && this.heldT >= C.noCreditTicks) left = -1;
      r.continueTicks[i] = left < 0 ? -1 : left;
    }
    if (!this.held) return;
    const n = this.countdownNumber;
    if (n >= 0 && n !== this.countShown) {
      if (this.countShown >= 0) r.audio.sfx('ui/countdown');
      this.countShown = n;
    }
    if (r.continueTicks[0] < 0 && r.continueTicks[1] < 0 && allOut(r.players)) r.endGame();
  }

  /** While held: a hero in play again ends it; until then the enemies on screen gloat at the spot. */
  private updateHeld(): void {
    const r = this.runner;
    const C = TUNING.continues;
    if (anyInPlay(r.players)) {
      this.hold(false);
      return;
    }
    if (this.heldT % C.gloatEvery === 1) {
      reactInArea(r.world, r.world.camera.view(), 'gloat', C.gloatTicks, { onScreen: true, source: this.gloatSpot });
    }
  }

  /** A continued hero's wagon arrived: the enemies on screen cower, the boss staggers, the world runs on. */
  onContinueLanded(p: RingHero): void {
    const r = this.runner;
    const C = TUNING.continues;
    reactInArea(r.world, r.world.camera.view(), 'cower', C.cowerTicks, { onScreen: true, source: p });
    const bosses = r.world.byTag('boss');
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      if (b instanceof Boss) b.stagger(C.bossStaggerTicks);
    }
    this.hold(false);
  }

  /**
   * Use a continue for a slot that is out: full lives, a fresh wagon drives in. A slot without a
   * hero yet (out before this play) gets one.
   */
  continuePlayer(slot: SlotIndex): boolean {
    const r = this.runner;
    let p = r.player(slot);
    const s = r.session.slots[slot];
    if (p ? p.state !== 'out' : !(s.joined && s.gameOver)) return false;
    if (!r.session.continueSlot(slot)) return false;
    r.continueTicks[slot] = -1;
    if (!p) p = r.addHero(slot);
    p.continueGame();
    r.resumeAfterGameOver();
    return true;
  }
}
