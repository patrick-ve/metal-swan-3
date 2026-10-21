/**
 * `ring-tow-truck` — the city's tow truck (the `ams` truck: a navy cab, a yellow crane boom at the
 * rear with a hook on a cable) on the ring (docs/design/ring.md §5.3; GDD §4.11 fairness):
 *
 * - It COMES FROM BEHIND in a lane beside its target wagon, overtakes it, blinks its indicator
 *   (`signal`, 24 ticks) and merges into the wagon's lane just ahead of it, its boom over the
 *   wagon's nose (a real wrecker lifts a car by its front).
 * - HOOK (`tell-hook`, ≥ 18 ticks, the whole truck on screen and an attack token): the hook swings
 *   out on its cable, wider and wider, the beacon flashes, the winch clanks; then `hook`: it is cast
 *   back at the wagon's push bar. A wagon still in the lane with its nose in reach is HOOKED.
 * - TOW (`tow`): the cable is taut, the truck brakes and drags the wagon back (its screen x falls);
 *   the wagon cannot change lanes or pull away. Pinned at the left of its screen band, the winch
 *   hauls it in: 1 cell every `TOW_AI.haul` ticks. The driver says the `tow` line. FREE: a swerve
 *   (JUMP) yanks the hook off; or shoot the CABLE (`TowCable`, `TOW_AI.cableHp`; player shots along
 *   the lane hit it first, a lob's blast snaps it); the truck also lets go after `maxTow` ticks.
 * About 400 HP (big). Beaten: smoke, the cab's glass cracks, it coasts onto the hard shoulder and
 * falls back out of view; a ring crate drops. Gloat: it backs its boom over the spot where the last
 * wagon went and lowers the hook onto the wreck (`WEGSLEPEN!`); cower: it shakes, the beacon
 * flashes fast and the driver ducks below the sill, hands over his head, and peeks
 * (`ring/tow-truck/cower`).
 *
 * Params: `hp`, `drop`. Inert-safe in a plain world.
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { INK } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { telegraphTicks, type ReactionKind } from '../../../enemy';
import { debris, dust, explosion, hitSpark, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, type SpawnParams } from '../../../registry';
import { ringOf } from '../../../ring/entity';
import { DEPTH_HALF, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { wagonBandEnd, WAGON_W, type Wagon } from '../../../ring/wagon';
import { ENTER_GIVE_UP } from '../traffic/road-kit';
import { CONVOY_ID, CONVOY_TAG, TOW, TOW_AI, TOW_TRUCK_ID } from './geometry';
import { ConvoyEnemy } from './kit';

const drawOpts: DrawOpts = {};
const NO_BOXES: readonly Rect[] = [];
const ORANGE_INK = 0x2a1a10ff;
/** The cower overlay's frames in turn (`ring/tow-truck/cower`: 0 duck, 1 tremble, 2 peek). */
const COWER_SEQ = [0, 1, 0, 1, 0, 1, 2, 2, 2] as const;

/** Why a tow ended. */
export type TowEnd = 'swerve' | 'snap' | 'done' | 'lost';

/**
 * The tow cable and the hook: drawn over the hooked wagon (it sorts just after the truck's lane),
 * and — while a wagon hangs on it — a shootable enemy-team slab along the lane between the wagon's
 * nose and the truck's bed. Player hits only; `TOW_AI.cableHp` (a blast snaps it at once).
 */
export class TowCable extends Entity {
  readonly truck: RingTowTruck;
  active = false;
  private readonly box: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly boxes: Rect[] = [this.box];

  constructor(world: World, truck: RingTowTruck) {
    super(world, truck.x, truck.y + 0.6);
    this.truck = truck;
    this.team = 'enemy';
    this.z = 31;
    this.hitbox = { x: -60, y: -60, w: 120, h: 60 };
    this.despawnMargin = Infinity;
    this.addTag(CONVOY_TAG.cable);
  }

  /** A wagon hangs on it: shootable, full HP. */
  activate(): void {
    this.active = true;
    this.hp = this.maxHp = TOW_AI.cableHp;
    this.addTag('shootable');
  }

  deactivate(): void {
    this.active = false;
    this.removeTag('shootable');
  }

  override hurtboxes(): readonly Rect[] {
    const w = this.truck.hooked;
    if (!this.active || !w) return NO_BOXES;
    const x0 = w.x + WAGON_W / 2 - 2;
    const x1 = this.truck.x + TOW.rear;
    this.box.x = Math.min(x0, x1 - 4);
    this.box.w = Math.max(4, x1 - x0);
    this.box.y = this.truck.y - DEPTH_HALF;
    this.box.h = DEPTH_HALF * 2;
    return this.boxes;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override onHit(d: Damage): boolean {
    if (!this.active || d.owner === undefined || d.owner < 0) return false;
    this.hp -= d.kind === 'explosion' ? this.hp : d.amount;
    this.flashTicks = 4;
    if (this.hp <= 0) {
      this.hp = 0;
      this.truck.release('snap');
    }
    return true;
  }

  override update(): void {
    if (this.truck.removed) {
      this.remove();
      return;
    }
    this.x = this.truck.x;
    this.y = this.truck.y + 0.6;
  }

  override draw(r: Renderer): void {
    if (this.truck.removed) return;
    this.truck.drawRig(r, this.flashTicks > 0);
  }
}

export class RingTowTruck extends ConvoyEnemy {
  /** The wagon on the hook (null: none). */
  hooked: Wagon | null = null;
  /** The cable (and the hook's drawing). */
  cable: TowCable | null = null;
  /** The hook: its point (world), the cable length, the swing angle. */
  hookX = 0;
  hookY = 0;
  private hookLen: number = TOW_AI.hookRest;
  private hookAng = 0;
  private castFromX = 0;
  private castFromY = 0;
  private towT = 0;
  private haulT = 0;
  private wheelDist = 0;
  private shake = 0;
  breakT = -1;
  /** The gloat: the hook lowered onto the spot. */
  private gloatHook = false;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: 'ring/tow-truck', hp: TOW_AI.hp, w: TOW.box.w, h: -TOW.box.y, soft: false, big: true, score: TOW_AI.score });
    this.hitbox = { ...TOW.box };
    this.shadowW = 92;
    this.shotLift = 30;
    this.despawnMargin = 160;
    this.cool = TOW_AI.firstDelay;
    this.addTag(CONVOY_ID.towTruck, 'ring-block');
    this.hookX = x + TOW.tip[0];
    this.hookY = y + TOW.tip[1] + TOW_AI.hookRest;
  }

  get tellTicks(): number {
    return telegraphTicks(this.world, TOW_AI.tell);
  }

  /** World x of the boom tip. */
  get tipX(): number {
    return this.x + TOW.tip[0];
  }

  get tipY(): number {
    return this.y + TOW.tip[1];
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    // The cower's shake runs out on the tick (react1 sets it every cowering tick).
    if (this.shake > 0) this.shake--;
    if (!this.cable) {
      this.cable = new TowCable(this.world, this);
      this.world.add(this.cable);
    }
    this.modeT++;
    this.facing = 1;
    if (this.mode !== 'tow') this.findPrey();
    const cam = this.world.camera;
    const t = this.prey;
    switch (this.mode) {
      case 'enter':
        // From behind: overtake beside the target (never in its lane).
        if (t && this.laneTarget === nearestLane(t.y)) this.laneTarget = this.besideLane(t);
        if (this.wholeOnScreen(4) && (!t || this.x + TOW.rear > t.x + WAGON_W / 2 + TOW_AI.passGap - 8 || this.x + TOW.front > cam.x + cam.w - 12)) this.setMode('ride');
        else if (this.modeT >= ENTER_GIVE_UP && !this.world.onScreen(this, 0)) {
          // Boxed in off screen by traffic: it never showed; it gives up (no score).
          this.remove();
          return;
        }
        break;
      case 'ride':
        if (++this.inPlay >= TOW_AI.stay) {
          this.setMode('leave');
          break;
        }
        if (!t) break;
        if (nearestLane(this.y) !== nearestLane(t.y)) {
          // Ahead of it beside its lane: signal, then merge in when the lane is free there.
          if (this.x + TOW.rear > t.x + WAGON_W / 2 + TOW_AI.passGap - 10 && this.laneTarget === nearestLane(this.y) && this.mergeFree(t)) {
            this.setMode('signal');
            this.world.audio.sfx('ring/indicator');
          }
        } else if (this.x < t.x) {
          // In its lane but behind it (the wagon pulled ahead): out beside it to overtake again.
          const l = this.besideLane(t);
          if (!this.laneBusy(l, this.x + TOW.rear - 6, this.x + TOW.front + 6)) this.laneTarget = l;
        } else if (--this.cool <= 0) this.tryHook();
        break;
      case 'signal':
        if (!t) this.setMode('ride');
        else if (this.modeT % 12 === 0) this.world.audio.sfx('ring/indicator');
        if (t && this.modeT >= TOW_AI.signal) {
          if (this.mergeFree(t)) this.laneTarget = nearestLane(t.y);
          this.setMode('ride');
        }
        break;
      case 'tell-hook':
        if (!t || !this.wholeOnScreen(0) || nearestLane(t.y) !== nearestLane(this.y)) this.cancelAttack();
        else if (this.modeT >= this.tellTicks) this.cast();
        break;
      case 'hook':
        if (this.modeT >= TOW_AI.cast) this.bite();
        break;
      case 'tow':
        this.tow();
        break;
      case 'recover':
        if (this.modeT >= TOW_AI.recover) {
          this.setMode('ride');
          this.cool = this.fireInterval(TOW_AI.every, TOW_AI.jitter);
        }
        break;
      case 'leave':
        if (this.x + this.hitbox.x > cam.x + cam.w + 40 || !this.world.onScreen(this, 8)) {
          this.remove();
          return;
        }
        break;
    }
    if (this.mode !== 'tow') this.drive();
    this.swingHook();
    if (this.mode !== 'tow') this.pushWagons(TOW.front - TOW.rear);
  }

  /** A lane beside the target's (the far side first). */
  private besideLane(t: Wagon): number {
    const open = this.openLanes();
    const tl = nearestLane(t.y, 1, open);
    return tl > 1 ? tl - 1 : Math.min(open, tl + 1);
  }

  /** Is the target's lane free where the truck would merge (from just ahead of the wagon's nose)? */
  private mergeFree(t: Wagon): boolean {
    return !this.laneBusy(nearestLane(t.y), this.x + TOW.rear - 6, this.x + TOW.front + 8, t) && this.x + TOW.rear > t.x + WAGON_W / 2 + 6;
  }

  private tryHook(): void {
    const t = this.prey;
    if (!t || t.arriving || !this.wholeOnScreen(8) || this.reacting) {
      this.cool = 20;
      return;
    }
    const gap = this.x + TOW.rear - (t.x + WAGON_W / 2);
    if (gap < 4 || gap > TOW_AI.reach - 6) {
      this.cool = 10;
      return;
    }
    if (!this.takeToken()) {
      this.cool = 30;
      return;
    }
    this.setMode('tell-hook');
    this.world.audio.sfx('ring/hook-swing');
  }

  /** The tell is over: the hook flies back at the wagon's push bar. */
  private cast(): void {
    this.setMode('hook');
    this.castFromX = this.hookX;
    this.castFromY = this.hookY;
    this.world.audio.sfx('ring/hook-swing');
  }

  /** The hook arrives: a wagon in the lane with its nose in reach is hooked; else it clanks on the road. */
  private bite(): void {
    const w = this.prey;
    const nose = w ? w.x + WAGON_W / 2 : 0;
    const inLane = w !== null && Math.abs(w.y - laneY(nearestLane(this.y))) < 6 && w.swerveT <= 0 && !w.arriving;
    if (w && inLane && nose <= this.tipX + 6 && nose >= this.tipX - TOW_AI.reach - 8) {
      this.hooked = w;
      this.towT = 0;
      this.haulT = 0;
      this.cable?.activate();
      this.setMode('tow');
      this.world.audio.sfx('ring/hook-clank');
      hitSpark(this.world, nose, w.y - 10, 1);
      w.say('tow');
      if (w.driver) hudOf(this.world).message(w.driver.index, 'TOWED!', 70);
      return;
    }
    this.world.audio.sfx('ring/hook-clank', { pitch: 0.8, vol: 0.6 });
    dust(this.world, this.hookX, this.y, 2);
    this.releaseToken();
    this.setMode('recover');
  }

  /** On the hook: brake and drag the wagon back; pinned, the winch hauls it in. */
  private tow(): void {
    const w = this.hooked;
    if (!w || !w.alive || w.state !== 'driven' || w.arriving || w.scripted) {
      this.release('lost');
      return;
    }
    if (w.swerveT > 0 || Math.abs(w.y - this.y) > 10) {
      this.release('swerve');
      return;
    }
    const lane = nearestLane(this.y);
    if (this.openLanes(this.x + 64) < lane || this.openLanes(w.x) < lane) {
      this.release('done');
      return;
    }
    this.towT++;
    const road = this.road;
    // The truck brakes; the wagon follows at the cable's length (it cannot pull away or close in).
    // Pinned: at the left end of its band (or queued in front of the other wagon there).
    const end = wagonBandEnd(w) - 2;
    const pinned = w.x <= end + 0.5;
    const rel = pinned ? 0 : TOW_AI.drag;
    this.vx = road + rel;
    this.x += this.vx;
    this.wheelDist += this.vx;
    let wx = this.x + TOW.rear - TOW_AI.towGap - WAGON_W / 2;
    if (ringOf(this.world) && wx < end) {
      wx = end;
      this.x = wx + WAGON_W / 2 + TOW_AI.towGap - TOW.rear;
    }
    w.x = wx;
    w.sideV = 0;
    w.laneTarget = lane;
    this.hookX = w.x + WAGON_W / 2 - 2;
    this.hookY = w.y - 11;
    if (this.towT % 30 === 1) this.world.audio.sfx('ring/winch');
    if (pinned) {
      if (++this.haulT >= TOW_AI.haul) {
        this.haulT = 0;
        this.world.damage(w, { amount: 1, kind: 'impact', dirX: 1, source: this, tags: ['tow'] });
        this.world.audio.sfx('ring/winch', { pitch: 0.8 });
        this.world.camera.shake(1, 6);
      }
    } else this.haulT = 0;
    if (this.towT >= TOW_AI.maxTow) this.release('done');
  }

  /** The wagon comes off the hook (a swerve, the cable shot, the truck lets go, it was lost). */
  release(why: TowEnd): void {
    const w = this.hooked;
    this.hooked = null;
    this.cable?.deactivate();
    this.releaseToken();
    if (this.mode === 'tow' || this.mode === 'hook' || this.mode === 'tell-hook') this.setMode('recover');
    this.cool = this.fireInterval(TOW_AI.every, TOW_AI.jitter);
    if (why === 'snap') {
      this.world.audio.sfx('ring/cable-snap');
      debris(this.world, this.hookX, this.hookY, 'metal', 3);
    } else if (why === 'swerve') {
      this.world.audio.sfx('ring/hook-clank', { pitch: 1.3 });
      if (w) hitSpark(this.world, w.x + WAGON_W / 2, w.y - 10, 1);
    }
  }

  protected cancelAttack(): void {
    if (this.mode === 'tow') this.release('lost');
    else if (this.mode === 'tell-hook' || this.mode === 'hook') {
      this.releaseToken();
      this.setMode('recover');
    }
  }

  /** The hook's point: hanging, swinging out (the tell), cast, on the wagon, back. */
  private swingHook(): void {
    if (this.mode === 'tow' && this.hooked) return;
    let len: number = TOW_AI.hookRest;
    let ang = Math.sin(this.age * 0.08) * 0.12;
    if (this.mode === 'tell-hook') {
      const k = Math.min(1, this.modeT / this.tellTicks);
      len = TOW_AI.hookRest + (TOW_AI.hookOut - TOW_AI.hookRest) * k;
      ang = Math.sin(this.modeT * 0.42) * TOW_AI.swing * (0.25 + 0.75 * k);
    }
    if (this.gloatHook && this.reactionSource) {
      const s = this.reactionSource;
      this.hookX += (s.x - this.hookX) * 0.1;
      this.hookY += (s.y - 4 - this.hookY) * 0.06;
      return;
    }
    if (this.mode === 'hook') {
      const w = this.prey;
      const k = Math.min(1, this.modeT / TOW_AI.cast);
      const tx = w ? w.x + WAGON_W / 2 - 2 : this.tipX - TOW_AI.reach;
      const ty = w ? w.y - 11 : this.y - 8;
      this.hookX = this.castFromX + (tx - this.castFromX) * k;
      this.hookY = this.castFromY + (ty - this.castFromY) * k - Math.sin(k * Math.PI) * 6;
      return;
    }
    // Ease back to the hanging point (after a release, a miss).
    this.hookLen += (len - this.hookLen) * 0.2;
    this.hookAng += (ang - this.hookAng) * (this.mode === 'tell-hook' ? 1 : 0.15);
    const hx = this.tipX + Math.sin(this.hookAng) * this.hookLen;
    const hy = this.tipY + Math.cos(this.hookAng) * this.hookLen;
    const k = this.mode === 'recover' && this.modeT < 12 ? 0.3 : 1;
    this.hookX += (hx - this.hookX) * k;
    this.hookY += (hy - this.hookY) * k;
  }

  /** Motion: overtake, hold just ahead of the target in its lane, the lane. */
  private drive(): void {
    const cam = this.world.camera;
    const t = this.prey;
    let rel = 0;
    if (this.mode === 'enter') rel = this.x - cam.x < cam.w * 0.75 ? TOW_AI.enterRel : 0.4;
    else if (this.mode === 'leave') rel = TOW_AI.leaveRel;
    else if (t) {
      const sameLane = nearestLane(this.y) === nearestLane(t.y);
      const gap = sameLane ? TOW_AI.holdGap : TOW_AI.passGap;
      // Behind the wagon in its lane: keep clear of its tail until it is out beside it.
      const want = sameLane && this.x < t.x ? t.x - WAGON_W / 2 - 12 - TOW.front : t.x + WAGON_W / 2 + gap - TOW.rear;
      const k = this.mode === 'tell-hook' || this.mode === 'hook' ? 0.06 : 0.03;
      rel = Math.max(-1.4, Math.min(1.4, (want - this.x) * k));
      // Never off the right edge.
      if (this.x + TOW.front > cam.x + cam.w - 4) rel = Math.min(rel, -0.6);
    }
    if (this.gapAhead(TOW.front) < 14) rel = Math.min(rel, -0.5);
    if (!ringOf(this.world)) rel = 0;
    this.vx = this.road + rel;
    this.x += this.vx;
    this.wheelDist += this.vx;
    if (this.mode === 'tell-hook' || this.mode === 'hook') this.laneTarget = nearestLane(this.y);
    this.steerLane(this.mode === 'enter' ? TOW_AI.laneSpeed * 1.6 : TOW_AI.laneSpeed);
  }

  // ------------------------------------------------------------------------------- reactions

  /** The gloat: it brings its boom over the spot and lowers the hook onto the wreck (no laughing). */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    if (!spot) return;
    const dx = spot.x - this.tipX;
    this.reactRel = Math.max(-0.8, Math.min(0.8, dx * 0.05));
    this.gloatHook = true;
    this.swingHook();
    if (t === 30) this.world.audio.sfx('ring/hook-clank');
    if (t > 30 && t % 40 === 0) this.world.audio.sfx('ring/winch');
    if (t >= 40) this.sayGloat('WEGSLEPEN!', 80);
  }

  protected override react1(kind: ReactionKind): void {
    if (kind === 'cower') this.shake = 2;
    this.swingHook();
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    if (kind === 'gloat') this.gloatHook = false;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(): void {
    this.release('lost');
    this.releaseToken();
    this.breakT = 0;
    this.removeTag('ring-block');
    explosion(this.world, this.x + 26, this.y - 20, 's');
    debris(this.world, this.x + 26, this.y - 20, 'metal', 5);
    this.world.audio.sfx('ring/hook-clank', { pitch: 0.6 });
    this.dropCrate(true);
  }

  protected override updateDeath(): void {
    if (this.shake > 0) this.shake--;
    const t = ++this.breakT;
    const road = this.road;
    this.vx = road - Math.min(road, t * 0.04);
    this.x += this.vx;
    this.wheelDist += this.vx;
    if (t > 20 && this.y < SHOULDER_TOP + 4) this.y = Math.min(SHOULDER_TOP + 4, this.y + 0.35);
    if (t % 4 === 0) smokeTrail(this.world, this.x + 26, this.y - 30, true);
    this.swingHook();
    const cam = this.world.camera;
    if (this.x + this.hitbox.x + this.hitbox.w < cam.x - 20 || t > 600) this.remove();
  }

  protected override dropItem(): void {
    // The crate falls in onDeath.
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x) + (this.shake > 0 ? (this.world.tick % 2 ? 1 : -1) : 0);
    const y = Math.round(this.y - this.lift);
    const dead = this.breakT >= 0;
    drawOpts.flipX = false;
    drawOpts.flash = !dead && this.flashTicks > 0;
    r.sprite(TOW_TRUCK_ID.body, dead || this.hp <= this.maxHp / 2 ? 1 : 0, x, y, drawOpts);
    drawOpts.flash = false;
    const f = ((Math.floor(this.wheelDist / 1.9) % 4) + 4) % 4;
    for (let i = 0; i < TOW.wheelX.length; i++) r.sprite(TOW_TRUCK_ID.wheel, f, x + TOW.wheelX[i], y + TOW.wheelY, drawOpts);
    if (dead) return;
    // The cower: the driver ducks below the sill, hands over his head, trembles, peeks.
    if (this.reaction === 'cower') {
      const f = COWER_SEQ[Math.floor(this.world.tick / 6) % COWER_SEQ.length];
      r.sprite(TOW_TRUCK_ID.cower, (this.hp <= this.maxHp / 2 ? 3 : 0) + f, x, y, drawOpts);
    }
    // The beacon: slow, fast while it hooks, tows or cowers.
    const fast = this.mode === 'tell-hook' || this.mode === 'hook' || this.mode === 'tow' || this.reaction === 'cower';
    const period = fast ? 4 : 14;
    const on = Math.floor(this.world.tick / period) % 2;
    r.sprite(TOW_TRUCK_ID.blink, 0, x + TOW.beacon[on][0], y + TOW.beacon[on][1], drawOpts);
    // The indicator (the merge's tell).
    if (this.mode === 'signal' && this.modeT % 12 < 7) r.sprite(TOW_TRUCK_ID.blink, 0, x + TOW.indicator[0], y + TOW.indicator[1], drawOpts);
  }

  /** The cable and the hook (drawn by the cable entity, over the wagon on the hook). */
  drawRig(r: Renderer, flash: boolean): void {
    const tx = Math.round(this.tipX);
    const ty = Math.round(this.tipY - this.lift);
    const hx = Math.round(this.hookX);
    const hy = Math.round(this.hookY);
    r.line(tx, ty, hx, hy, flash ? 0xffffffff : this.hooked ? INK : ORANGE_INK);
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(TOW_TRUCK_ID.hook, 0, hx, hy, drawOpts);
  }

  override onRemove(): void {
    this.hooked = null;
    super.onRemove();
  }
}

defineEntity(CONVOY_ID.towTruck, (w, x, y, p) => new RingTowTruck(w, x, y, p), {
  category: 'enemy',
  score: TOW_AI.score,
  description: 'The city tow truck on the ring: overtakes, merges in ahead of you and hooks your nose; towed, you are dragged back until you swerve free or shoot the cable (params hp, drop).',
});
