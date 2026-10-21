/**
 * `ring-scan-car` — the parking scan car follows the squad out of ams (docs/design/ring.md §5.3;
 * GDD §4.11 fairness). The `ams` likeness (docs/api/scan-car.md: the white hatchback, the black
 * window band, the red door bars, `PARKEERCONTROLE` / `Gemeente Amsterdam`) with a SMALLER roof box.
 * It drives in the lane next to its target wagon (the far side first), a little ahead of it, and
 * casts SCAN LOCK:
 *
 * - TELL (`tell-scan`, ≥ 18 ticks, only with the whole car on screen and an attack token): the box
 *   lights up and beeps, the red strip's outline blinks on the target's lane and the scan line
 *   sweeps along it from the car's front back to the view's left edge (`ScanStrip`).
 * - LOCK (`scan`): the strip turns solid. A wagon inside it (in that lane, over the strip) is
 *   slowed: it drifts back on screen (`SCAN_AI.drag` px/tick, down to the wagon's screen band) and
 *   cannot push forward. Its driver says the `scan` line. A lane change (or a swerve) frees it: with
 *   no wagon in the strip for `SCAN_AI.grace` ticks the lock ends; it ends anyway after
 *   `lockTicks`, and when the car is beaten.
 * About 300 HP (big: scales with difficulty and co-op). Beaten, it BREAKS DOWN: the airbag pops
 * (`AIRBAG!`), the hazard lights blink, smoke rises from the bonnet, it coasts onto the hard
 * shoulder and falls back out of view; a ring crate drops (the `drop` param, else the ring roll).
 * Gloat: it scans the spot where the last wagon went (`KENTEKEN GESCAND.`); cower: the handhaver
 * behind the glass ducks (the cabin's shock frame) and the car shakes.
 *
 * Params: `hp`, `drop`. Inert-safe in a plain world (no ring: no road speed, it just stands).
 */
import type { Renderer, DrawOpts } from '../../../../engine/render';
import { Entity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import { PAL } from '../../../../engine/palette';
import { hudOf } from '../../../context';
import { gagBubble, telegraphTicks, type ReactionKind } from '../../../enemy';
import { debris, dust, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, type SpawnParams } from '../../../registry';
import { ringOf } from '../../../ring/entity';
import { LANE_SPLIT, laneY, nearestLane, ROAD_BOTTOM, ROAD_TOP, SHOULDER_TOP } from '../../../ring/lanes';
import { RING } from '../../../ring/types';
import { WAGON_W, type Wagon } from '../../../ring/wagon';
import { SCAN as AMS_SCAN } from '../../bosses/ams-scan/geometry';
import { drivenWagons, ENTER_GIVE_UP } from '../traffic/road-kit';
import { CABIN, CONVOY_ID, CONVOY_TAG, SCAN_AI, SCAN_CAR, SCAN_CAR_ID } from './geometry';
import { ConvoyEnemy } from './kit';

const drawOpts: DrawOpts = {};
const fillOpts: DrawOpts = { alpha: 0.25 };
const lineOpts: DrawOpts = { alpha: 0.8 };
const beamOpts: DrawOpts = { alpha: 0.45, blend: 'add' };

const RED = PAL.red[2];
const RED_HOT = PAL.red[3];

export type StripState = 'tell' | 'lock' | 'fade';

const band: [number, number] = [0, 0];

/** The plane band of a lane (top, bottom) on the road (a shared tuple: copy to keep it). */
function laneBand(lane: number): readonly [number, number] {
  band[0] = lane <= 1 ? ROAD_TOP + 2 : LANE_SPLIT[lane - 2] + 1;
  band[1] = lane >= 4 ? ROAD_BOTTOM - 1 : LANE_SPLIT[lane - 1] - 1;
  return band;
}

/**
 * The SCAN LOCK strip: a red band on one lane, fixed on screen (screen x `x0s` … `x1s`), drawn on
 * the road under everything in the lanes. During the tell its outline blinks and the scan line
 * sweeps back from the front end; then it locks (see the file header); then it fades.
 * For the bot: `lane`, `state`, `x0` / `x1` (world x now), `ticksToLock`.
 */
export class ScanStrip extends Entity {
  state: StripState = 'tell';
  t = 0;
  readonly lane: number;
  readonly x0s: number;
  readonly x1s: number;
  readonly tellTicks: number;
  /** The car that casts it (null once the car is gone: the strip fades). */
  car: RingScanCar | null;
  /** Wagons it has locked this cast (each gets its driver line once). */
  private readonly locked = new Set<Wagon>();
  private emptyT = 0;
  private fadeT = 0;

  constructor(world: World, car: RingScanCar | null, lane: number, x0s: number, x1s: number, tellTicks: number) {
    super(world, world.camera.x + x0s, ROAD_TOP - 1);
    this.car = car;
    this.lane = lane;
    this.x0s = x0s;
    this.x1s = x1s;
    this.tellTicks = tellTicks;
    this.team = 'neutral';
    this.z = 1;
    this.hitbox = { x: 0, y: -1, w: Math.max(1, x1s - x0s), h: 1 };
    this.despawnMargin = Infinity;
    this.addTag(CONVOY_TAG.strip);
  }

  /** World x of the strip's ends now. */
  get x0(): number {
    return this.world.camera.x + this.x0s;
  }

  get x1(): number {
    return this.world.camera.x + this.x1s;
  }

  /** Ticks until it locks (0 when locked or fading). */
  get ticksToLock(): number {
    return this.state === 'tell' ? Math.max(0, this.tellTicks - this.t) : 0;
  }

  /** Is wagon `w` inside the strip (in its lane, settled, over its x range)? */
  holds(w: Wagon): boolean {
    if (w.arriving || w.scripted) return false;
    if (nearestLane(w.y) !== this.lane || Math.abs(w.y - laneY(this.lane)) > 5) return false;
    return w.x + WAGON_W / 2 > this.x0 && w.x - WAGON_W / 2 < this.x1;
  }

  /** The tell is over: lock. */
  lock(): void {
    if (this.state !== 'tell') return;
    this.state = 'lock';
    this.t = 0;
    this.emptyT = 0;
    this.world.audio.sfx('ring/scan-lock');
  }

  /** End it now (it fades out). */
  end(): void {
    if (this.state === 'fade') return;
    this.state = 'fade';
    this.fadeT = 0;
  }

  override update(): void {
    this.t++;
    this.x = this.world.camera.x + this.x0s;
    if (this.car && (this.car.removed || this.car.dead)) {
      this.car = null;
      this.end();
    }
    switch (this.state) {
      case 'tell':
        if (!this.car) this.end();
        break;
      case 'lock':
        this.hold();
        break;
      case 'fade':
        if (++this.fadeT > 16) this.remove();
        break;
    }
  }

  /** The lock: every wagon inside drifts back and cannot push forward. */
  private hold(): void {
    const ring = ringOf(this.world);
    const cam = this.world.camera;
    const list = drivenWagons(this.world);
    let any = false;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!this.holds(w)) continue;
      any = true;
      if (!this.locked.has(w)) {
        this.locked.add(w);
        w.say('scan');
        if (w.driver) hudOf(this.world).message(w.driver.index, 'SCAN LOCK!', 70, RED_HOT);
      }
      if (ring && w.x - cam.x > RING.screenMinX + SCAN_AI.drag) w.x -= SCAN_AI.drag;
      if (w.sideV > SCAN_AI.capSide) w.sideV = SCAN_AI.capSide;
    }
    if (any) this.emptyT = 0;
    else if (++this.emptyT > SCAN_AI.grace) this.end();
    if (this.t >= SCAN_AI.lockTicks) this.end();
  }

  override draw(r: Renderer): void {
    const cam = this.world.camera;
    const [top, bottom] = laneBand(this.lane);
    const x0 = Math.round(cam.x + this.x0s);
    const x1 = Math.round(cam.x + this.x1s);
    const w = x1 - x0;
    const h = bottom - top;
    if (this.state === 'tell') {
      const k = Math.min(1, this.t / Math.max(1, this.tellTicks));
      // The outline blinks over the whole strip (where it will lock).
      if (Math.floor(this.t / 4) % 2 === 0) {
        lineOpts.alpha = 0.75;
        r.rect(x0, top, w, 1, RED, lineOpts);
        r.rect(x0, bottom - 1, w, 1, RED, lineOpts);
        r.rect(x1 - 1, top, 1, h, RED, lineOpts);
      }
      // The swept part fills; the scan line runs back along the lane.
      const sweep = Math.round(x1 - w * k);
      fillOpts.alpha = 0.2;
      r.rect(sweep, top + 1, x1 - sweep, h - 2, RED, fillOpts);
      lineOpts.alpha = 0.95;
      r.rect(sweep, top, 2, h, RED_HOT, lineOpts);
      return;
    }
    const a = this.state === 'fade' ? Math.max(0, 1 - this.fadeT / 16) : 1;
    if (a <= 0) return;
    fillOpts.alpha = (0.26 + 0.06 * Math.sin(this.t * 0.3)) * a;
    r.rect(x0, top, w, h, RED, fillOpts);
    lineOpts.alpha = 0.85 * a;
    r.rect(x0, top, w, 1, RED_HOT, lineOpts);
    r.rect(x0, bottom - 1, w, 1, RED_HOT, lineOpts);
    // Chevrons pointing back (the drag) moving back along the strip.
    const mid = Math.round((top + bottom) / 2);
    const step = 24;
    const off = (this.t * 2) % step;
    lineOpts.alpha = 0.6 * a;
    for (let x = x1 - 6 - off; x > x0 + 4; x -= step) {
      // A '<' (the tip back, the way the wagon is pulled).
      for (let j = 0; j < 4; j++) {
        r.rect(x + j, mid - j, 1, 1, RED_HOT, lineOpts);
        r.rect(x + j, mid + j, 1, 1, RED_HOT, lineOpts);
      }
    }
  }

  /**
   * Where the car's scan beam meets the strip now (null: no beam): the sweeping scan line during
   * the tell, the strip's front end (flickering) while it locks. The car draws the beam (over itself).
   */
  beamTarget(out: [number, number]): [number, number] | null {
    if (this.state === 'fade') return null;
    const cam = this.world.camera;
    const [top, bottom] = laneBand(this.lane);
    const x1 = cam.x + this.x1s;
    out[1] = (top + bottom) / 2;
    if (this.state === 'tell') {
      const k = Math.min(1, this.t / Math.max(1, this.tellTicks));
      out[0] = Math.round(x1 - (this.x1s - this.x0s) * k) + 1;
      return out;
    }
    if (this.t % 6 >= 4) return null;
    out[0] = x1 - 2;
    return out;
  }
}

const beamPt: [number, number] = [0, 0];

export class RingScanCar extends ConvoyEnemy {
  strip: ScanStrip | null = null;
  /** The roof box frame (0 idle, 1 scanning, 2 the lens flares). */
  boxFrame = 0;
  /** Ticks since it broke down (−1 = running). */
  breakT = -1;
  private wheelDist = 0;
  private shake = 0;
  private gloatBeam = false;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: 'ring/scan-car', hp: SCAN_AI.hp, w: SCAN_CAR.box.w, h: -SCAN_CAR.box.y, soft: false, big: true, score: SCAN_AI.score });
    this.hitbox = { ...SCAN_CAR.box };
    this.shadowW = 84;
    this.shotLift = 30;
    this.z = 30;
    this.despawnMargin = 140;
    this.cool = SCAN_AI.firstDelay;
    this.addTag(CONVOY_ID.scanCar, 'ring-block');
  }

  /** Telegraph length of SCAN LOCK on this difficulty (never below 18). */
  get tellTicks(): number {
    return telegraphTicks(this.world, SCAN_AI.tell);
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    // The cower's shake runs out on the tick (react1 sets it every cowering tick).
    if (this.shake > 0) this.shake--;
    this.modeT++;
    this.facing = 1;
    this.findPrey();
    const cam = this.world.camera;
    switch (this.mode) {
      case 'enter':
        if (this.wholeOnScreen(4)) this.setMode('ride');
        else if (this.modeT >= ENTER_GIVE_UP && !this.world.onScreen(this, 0)) {
          // Boxed in off screen by traffic: it never showed; it gives up (no score).
          this.remove();
          return;
        }
        break;
      case 'ride':
        if (++this.inPlay >= SCAN_AI.stay) {
          this.setMode('leave');
          break;
        }
        this.pickLane();
        if (--this.cool <= 0) this.tryScan();
        break;
      case 'tell-scan': {
        this.boxFrame = this.modeT % 8 < 5 ? 1 : 2;
        if (this.modeT % 10 === 1) this.world.audio.sfx('ring/scan-beep');
        if (!this.wholeOnScreen(0) || !this.prey || !this.strip) this.cancelAttack();
        else if (this.modeT >= this.tellTicks) {
          this.setMode('scan');
          this.strip.lock();
          this.releaseToken();
        }
        break;
      }
      case 'scan':
        this.boxFrame = this.modeT % 12 < 9 ? 1 : 2;
        if (!this.strip || this.strip.state === 'fade' || this.strip.removed) {
          this.strip = null;
          this.setMode('recover');
        }
        break;
      case 'recover':
        this.boxFrame = 0;
        if (this.modeT >= SCAN_AI.recover) {
          this.setMode('ride');
          this.cool = this.fireInterval(SCAN_AI.every, SCAN_AI.jitter);
        }
        break;
      case 'leave':
        this.boxFrame = 0;
        if (this.x + this.hitbox.x > cam.x + cam.w + 40 || !this.world.onScreen(this, 8)) {
          this.remove();
          return;
        }
        break;
    }
    this.drive();
    this.pushWagons(84);
  }

  /** The lane next to its target (the far side first), when that lane is free beside it. */
  private pickLane(): void {
    const t = this.prey;
    if (!t || this.modeT % 20 !== 0) return;
    const open = this.openLanes();
    const tl = nearestLane(t.y, 1, open);
    for (let k = 0; k < 2; k++) {
      const l = k === 0 ? tl - 1 : tl + 1;
      if (l < 1 || l > open) continue;
      if (l === this.laneTarget) return;
      if (!this.laneBusy(l, this.x - 56, this.x + 56, this)) {
        this.laneTarget = l;
        return;
      }
    }
  }

  private tryScan(): void {
    const t = this.prey;
    if (!t || t.arriving || !this.wholeOnScreen(8) || this.reacting) {
      this.cool = 20;
      return;
    }
    if (!this.takeToken()) {
      this.cool = 30;
      return;
    }
    const cam = this.world.camera;
    const tx = t.x - cam.x;
    const x1s = Math.min(cam.w, Math.max(this.sx + SCAN_CAR.front + SCAN_AI.stripFront, tx + WAGON_W / 2 + 14));
    this.strip = new ScanStrip(this.world, this, nearestLane(t.y), 0, x1s, this.tellTicks);
    this.world.add(this.strip);
    this.setMode('tell-scan');
    this.boxFrame = 1;
    this.world.audio.sfx('ring/scan-beep');
  }

  protected cancelAttack(): void {
    if (this.mode === 'tell-scan' || this.mode === 'scan') {
      this.strip?.end();
      this.strip = null;
      this.releaseToken();
      this.setMode('ride');
      this.cool = 60;
      this.boxFrame = 0;
    }
  }

  /** Motion: road speed + a screen speed toward its spot (ahead of the target); the lane. */
  private drive(): void {
    const cam = this.world.camera;
    const sx = this.sx;
    let rel: number;
    if (this.mode === 'enter') rel = sx < cam.w / 2 ? 1.4 : -1.1;
    else if (this.mode === 'leave') rel = SCAN_AI.leaveRel;
    else {
      const t = this.prey;
      const ahead = SCAN_AI.ahead[0] + ((this.id * 29) % (SCAN_AI.ahead[1] - SCAN_AI.ahead[0]));
      const want = Math.max(SCAN_AI.minX, Math.min(SCAN_AI.maxX, t ? t.x - cam.x + ahead : 250));
      const k = this.mode === 'ride' ? 0.02 : 0.008;
      rel = Math.max(-SCAN_AI.rel, Math.min(SCAN_AI.rel, (want - sx) * k));
    }
    if (this.gapAhead(SCAN_CAR.front) < 14) rel = Math.min(rel, -0.5);
    if (!ringOf(this.world)) rel = 0;
    this.vx = this.road + rel;
    this.x += this.vx;
    this.wheelDist += this.vx;
    // Lanes: held during the scan.
    if (this.mode === 'tell-scan' || this.mode === 'scan') this.laneTarget = nearestLane(this.y);
    this.steerLane(SCAN_AI.laneSpeed);
  }

  // ------------------------------------------------------------------------------- reactions

  /** The gloat: it scans the spot where the last wagon went (no pointing, no laughing). */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    this.gloatBeam = spot !== null;
    this.boxFrame = t % 30 < 22 ? 1 : 2;
    if (t % 40 === 6) this.world.audio.sfx('ring/scan-beep');
    if (t >= 20) this.sayGloat('KENTEKEN GESCAND.', 80);
  }

  protected override react1(kind: ReactionKind): void {
    if (kind === 'cower') this.shake = 2;
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    if (kind === 'gloat') {
      this.gloatBeam = false;
      this.boxFrame = 0;
    }
  }

  // ------------------------------------------------------------------------------- the breakdown

  protected override onDeath(): void {
    this.cancelAttack();
    this.releaseToken();
    this.breakT = 0;
    this.boxFrame = 0;
    this.removeTag('ring-block');
    this.world.audio.sfx('ams/airbag');
    gagBubble(this.world, this, 'AIRBAG!', 70);
    debris(this.world, this.x + 20, this.y - 16, 'metal', 4);
    dust(this.world, this.x, this.y, 4);
    this.dropCrate(true);
  }

  /** Coasting to a stop onto the hard shoulder, hazards blinking, smoke from the bonnet. */
  protected override updateDeath(): void {
    if (this.shake > 0) this.shake--;
    const t = ++this.breakT;
    const road = this.road;
    const rel = -Math.min(road, t * SCAN_AI.coast);
    this.vx = road + rel;
    this.x += this.vx;
    this.wheelDist += this.vx;
    const ty = SHOULDER_TOP + 4;
    // Over to the hard shoulder before it falls back to the wagons (it no longer touches anything).
    if (t > 8 && this.y < ty) this.y = Math.min(ty, this.y + 0.6);
    if (t % 5 === 0) smokeTrail(this.world, this.x + SCAN_CAR.bonnet[0], this.y + SCAN_CAR.bonnet[1], t > 60);
    const cam = this.world.camera;
    if (this.x + this.hitbox.x + this.hitbox.w < cam.x - 20 || t > 600) this.remove();
  }

  protected override dropItem(): void {
    // The crate falls at the breakdown (onDeath), from the car's middle.
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x) + (this.shake > 0 ? (this.world.tick % 2 ? 1 : -1) : 0);
    const y = Math.round(this.y - this.lift);
    const dead = this.breakT >= 0;
    const cab = dead ? CABIN.airbag : this.reaction === 'cower' ? CABIN.shock : this.mode === 'tell-scan' ? CABIN.shout : CABIN.calm;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(SCAN_CAR_ID.cabin, cab, x, y, drawOpts);
    const k = this.hp / Math.max(1, this.maxHp);
    const state = dead || k <= 1 / 3 ? 2 : k <= 2 / 3 ? 1 : 0;
    drawOpts.flash = !dead && this.flashTicks > 0;
    r.sprite(SCAN_CAR_ID.body[state], 0, x, y, drawOpts);
    drawOpts.flash = false;
    for (let i = 0; i < 2; i++) {
      const [tx, ty] = AMS_SCAN.text[i];
      r.sprite(SCAN_CAR_ID.text, i, x + tx, y + ty, drawOpts);
    }
    const f = ((Math.floor(this.wheelDist / 1.9) % 4) + 4) % 4;
    for (let i = 0; i < AMS_SCAN.wheelX.length; i++) r.sprite(SCAN_CAR_ID.wheel, dead ? 0 : f, x + AMS_SCAN.wheelX[i], Math.round(this.y) + AMS_SCAN.wheelY, drawOpts);
    drawOpts.flash = !dead && this.flashTicks > 0;
    r.sprite(SCAN_CAR_ID.box, dead ? 0 : this.boxFrame, x, y, drawOpts);
    drawOpts.flash = false;
    // Hazard lights: while it breaks down, and a fast blink while it cowers.
    const fast = this.reaction === 'cower';
    if ((dead || fast) && Math.floor(this.world.tick / (fast ? 4 : 12)) % 2 === 0) {
      for (let i = 0; i < SCAN_CAR.lamps.length; i++) {
        const [lx, ly] = SCAN_CAR.lamps[i];
        r.sprite(SCAN_CAR_ID.blink, 0, x + lx, y + ly, drawOpts);
      }
    }
    // The scan beam from the lens to the strip (the sweep, the lock).
    const b = !dead && this.strip ? this.strip.beamTarget(beamPt) : null;
    if (b) {
      const [lx, ly] = SCAN_CAR.lens;
      r.line(x + lx, y + ly, Math.round(b[0]), Math.round(b[1]), RED_HOT, beamOpts);
    }
    // The gloat's beam onto the spot.
    if (this.gloatBeam && this.reactionSource && this.world.tick % 6 < 4) {
      const s = this.reactionSource;
      const [lx, ly] = SCAN_CAR.lens;
      r.line(x + lx, y + ly, Math.round(s.x), Math.round(s.y - 6), RED_HOT, beamOpts);
    }
  }
}

defineEntity(CONVOY_ID.scanCar, (w, x, y, p) => new RingScanCar(w, x, y, p), {
  category: 'enemy',
  score: SCAN_AI.score,
  description: 'The parking scan car on the ring: drives beside you and casts SCAN LOCK (a red strip that slows a wagon until it changes lanes); breaks down with an airbag (params hp, drop).',
});
