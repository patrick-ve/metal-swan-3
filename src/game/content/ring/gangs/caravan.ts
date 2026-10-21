/**
 * `ring-caravan` — the caravan car (docs/design/ring.md §5.4, §8, §9, §11; GDD §4.11 fairness): a
 * car towing a 1970s caravan in the near lanes (the lane rule flavour: caravans keep to lanes
 * 3–4). Armoured (260 HP, scaled for difficulty and co-op), not knifeable.
 *
 * - THE GUNNER in the roof hatch (`gunner: true`): with the target behind it, `tell-shoot`
 *   (≥ 18 ticks on screen: he levels a pistol backwards) → `shoot`: two shots aimed at the target
 *   across the lanes (within ±24° of straight back; ½ cell each).
 * - LOOSE: after damage (half its hp) or `looseAfter` ticks in play, `tell-loose` (≥ 18 ticks on
 *   screen: the drawbar strains, sparks and a metal groan; the nearest driver shouts his 'caravan'
 *   line) → `loose`: the hitch snaps, the tow car flees ahead, the caravan drops back and swerves
 *   one lane toward the median and back (it never covers more than two lanes: never every lane),
 *   then `tip`: it tips over away from us (the livery stays in view, the underside and the wheels
 *   turn toward us) and `slide`s onto the hard shoulder, where it lies (a wreck, out of play). A
 *   wagon it touches while loose or tipping is rammed (2 cells; sliding onto the shoulder it only
 *   shoves); a swerve dodges. The gunner tumbles off onto the shoulder (bloodless).
 * - BEATEN: score, a crate (`drop`, else the ring roll), the gunner tumbles off, the tow car flees
 *   and the caravan comes loose and tips at once.
 * - HOSTAGE (`hostage: true`, `item`): the door stands open with a barred grille over the doorway
 *   and a tied hostage inside (the carrier hook, items/carrier.ts); when it tips over with the
 *   hostage still tied, the grille bursts and the hostage is freed for the nearest wagon.
 * - GLOAT: the rig holds its place, the gunner pours a coffee from his thermos and sips (no
 *   pointing, no laughing). COWER: he ducks into the hatch. Loose or crashing it does not react.
 * After its stay (`CARAVAN_AI.stay`) the rig speeds off ahead (no score).
 *
 * Params: `gunner` (bool; default true, false for a hostage caravan), `looseAfter` (ticks in play,
 * 0 = only after damage), `hostage`, `item`, `side`, `gang`, `hp`, `drop`.
 */
import { damageHas, Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { debris, dust, FX_SPARK, hitSpark, muzzleFlash, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, paramBool, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY, RING_ENTITY_B } from '../../../ring/ids';
import { clampLane, LANE_GAP, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import type { DoorFallOut, HostageCarrier, SeatOut } from '../items/carrier';
import { doorBox, doorFallAnchor } from '../traffic/geometry';
import type { RingHostage } from '../items/hostage';
import { ENTER_GIVE_UP, nearestWagon } from '../traffic/road-kit';
import { CARAVAN, CARAVAN_ART, CARAVAN_DOOR, GANG_IDS, TOW_CAR_HALF, TOW_CAR_WHEELS, TOW_CARS } from './geometry';
import { BumpCooldown, dropCrate, flingPerson, followRel, gapAhead, gapBehind, laneFree, openAt, pushWagons, slotOf, type ContactRule } from './kit';

export type CaravanMode = 'enter' | 'ride' | 'tell-shoot' | 'shoot' | 'recover' | 'tell-loose' | 'loose' | 'tip' | 'slide' | 'wreck' | 'leave';

/** Tuning (ticks, px, px/tick). */
export const CARAVAN_AI = {
  hp: 260,
  score: 1500,
  /** Telegraph bases (scaled by difficulty, never below 18): the gunner, the straining hitch. */
  tell: 26,
  looseTell: 30,
  every: 140,
  jitter: 30,
  firstDelay: 60,
  shots: 2,
  shotGap: 8,
  shootTicks: 16,
  recover: 24,
  bulletSpeed: 3.2,
  /** The gunner aims within this angle of straight back (radians). */
  aimMax: 0.42,
  /** It comes loose at this fraction of its hp. */
  looseAt: 0.5,
  /** Ticks of the loose swerve, the tip-over, the screen speed while loose (it drops back). */
  loose: 72,
  tip: 24,
  looseRel: -1.1,
  /** Where the rig drives: the caravan's middle this far ahead of the target, its screen band. */
  ahead: [116, 156] as const,
  minX: 140,
  maxX: 236,
  rel: 1,
  enterRel: 1.4,
  leaveRel: 2.4,
  laneTicks: 22,
  stay: 900,
  /** The tow car's screen speed when it flees. */
  carFlee: 2.8,
} as const;

/** An attack starts only with the hatch this far inside the view (px). */
const ATTACK_INSET = 22;
const NO_BOXES: readonly Rect[] = [];
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = {};
const ptA: [number, number] = [0, 0];

/** Is a mode part of the crash (loose, tipping, sliding, lying)? */
function crashing(m: CaravanMode): boolean {
  return m === 'loose' || m === 'tip' || m === 'slide' || m === 'wreck';
}

export class RingCaravan extends Enemy implements HostageCarrier, RingDrawable {
  mode: CaravanMode = 'enter';
  modeT = 0;
  lift = 0;
  shadowW = 0;
  shotLift = 46;
  holdsToken = false;
  readonly gunner: boolean;
  readonly hostageCaravan: boolean;
  readonly looseAfter: number;
  readonly carModel: 'hatch' | 'estate';
  readonly carColour: string;
  /** The tow car's middle relative to the caravan's middle (while hitched). */
  readonly carDx: number;
  laneTarget: number;
  hitched = true;
  /** The gunner has tumbled off. */
  gunnerGone = false;
  grille = -1;
  inPlay = 0;
  stay: number = CARAVAN_AI.stay;
  rel = 0;
  hostage: RingHostage | null = null;
  car: RingTowCar | null = null;
  private cool: number = CARAVAN_AI.firstDelay;
  private laneT = 0;
  private prefDx: number = CARAVAN_AI.ahead[0];
  private prey: Wagon | null = null;
  private started = false;
  private shotsLeft = 0;
  private roll = 0;
  private swerveY0 = 0;
  private swerveY1 = 0;
  private readonly hurt: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  private readonly hurt1: Rect[] = [];
  private readonly bodySlab: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly bumps = new BumpCooldown();
  private readonly rammed: Wagon[] = [];
  private readonly contact: ContactRule;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const pick = TOW_CARS[Math.abs(Math.round(paramNum(p, 'gang', Math.floor(x / 97)))) % TOW_CARS.length];
    const half = TOW_CAR_HALF[pick[0]];
    const carDx = CARAVAN.hitch[0] + half;
    super(world, x, y, p, { art: `${CARAVAN_ART}/gunner`, hp: CARAVAN_AI.hp, body: false, w: 10, h: CARAVAN.height, soft: false, big: true, score: CARAVAN_AI.score });
    this.carModel = pick[0];
    this.carColour = pick[1];
    this.carDx = carDx;
    // The visual box spans the caravan and its tow car.
    this.hitbox = { x: -CARAVAN.len / 2, y: -CARAVAN.height - 12, w: CARAVAN.len / 2 + carDx + half, h: CARAVAN.height + 12 };
    this.hostageCaravan = p.hostage === true;
    this.gunner = paramBool(p, 'gunner', !this.hostageCaravan);
    this.looseAfter = Math.max(0, paramNum(p, 'looseAfter', 0));
    // The lane rule flavour: caravans keep to the near lanes (3–4).
    this.laneTarget = Math.max(3, nearestLane(y));
    this.y = laneY(nearestLane(y));
    this.facing = 1;
    this.z = 30;
    this.despawnMargin = 220;
    if (this.hostageCaravan) this.grille = 0;
    const self = this;
    this.contact = {
      // Loose and tipping it rams; sliding onto the shoulder it only shoves (free).
      get ram(): boolean {
        return self.mode === 'loose' || self.mode === 'tip';
      },
      rearCost: (closing) => (self.mode === 'slide' ? 0 : closing > 1.4 ? 1 : closing > 0.5 ? 0.5 : 0),
      // One ram per wagon for the whole crash (loose + tip + slide).
      ramCool: CARAVAN_AI.loose + CARAVAN_AI.tip + 60,
    };
    this.addTag(RING_ENTITY_B.caravan, 'ring-block');
    this.play('ride');
  }

  /** The gunner stands in the hatch (and can act). */
  get gunnerUp(): boolean {
    return this.gunner && !this.gunnerGone && !crashing(this.mode) && !this.dead;
  }

  /** Front of the rig (the tow car's nose while hitched, the drawbar's head after). */
  get frontX(): number {
    return this.hitched ? this.x + this.carDx + TOW_CAR_HALF[this.carModel] : this.x + CARAVAN.hitch[0];
  }

  override hurtboxes(): readonly Rect[] {
    if (this.dead || this.mode === 'tip' || this.mode === 'slide' || this.mode === 'wreck') return NO_BOXES;
    const rear = this.x - CARAVAN.len / 2;
    const front = this.frontX;
    const a = this.hurt[0];
    a.y = this.y - 8;
    a.h = 16;
    if (this.grille >= 0 && this.hostage && this.hostage.state === 'tied') {
      // The grille's slab belongs to the hostage while it is shut.
      const b = this.hurt[1];
      a.x = rear;
      a.w = this.x + CARAVAN.door[0] - rear;
      b.x = this.x + CARAVAN.door[1];
      b.w = front - b.x;
      b.y = a.y;
      b.h = a.h;
      return this.hurt;
    }
    a.x = rear;
    a.w = front - rear;
    if (this.hurt1.length === 0) this.hurt1.push(a);
    return this.hurt1;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  private setMode(m: CaravanMode): void {
    this.mode = m;
    this.modeT = 0;
    if (m === 'tell-shoot') this.play('tell', { restart: true });
    else if (m === 'shoot') this.play('shoot', { restart: true });
    else if (m === 'tell-loose' || m === 'loose') this.play('cower');
    else this.play('ride');
  }

  // ------------------------------------------------------------------------------- the AI

  private start(): void {
    this.started = true;
    if (this.hostageCaravan) {
      const h = this.world.spawn(RING_ENTITY.hostage, this.x + CARAVAN.seat, this.y, { carrier: this, item: this.params.item });
      this.hostage = (h as RingHostage).carrier === this ? (h as RingHostage) : null;
    }
    const cam = this.world.camera;
    if (this.x < cam.x && ringOf(this.world)) {
      // From behind: into a near lane no wagon drives in (it overtakes them).
      const open = openAt(this.world, this.x);
      for (const l of [3, 4, 2, 1]) {
        if (l > open) continue;
        if (laneFree(this.world, this, l, this.x - 50, cam.right, true)) {
          this.laneTarget = l;
          this.y = laneY(l);
          break;
        }
      }
    }
  }

  protected override acceptsReaction(kind: ReactionKind): boolean {
    // Loose or crashing it has no time for anything else.
    return this.hitched && !crashing(this.mode) && super.acceptsReaction(kind);
  }

  protected override think(): void {
    this.modeT++;
    this.facing = 1;
    if (!this.started) this.start();
    const cam = this.world.camera;
    const sx = this.x - cam.x;
    this.prey = nearestWagon(this.world, this.x, this.y);
    if (crashing(this.mode)) {
      this.crashStep();
      this.touchWagons();
      return;
    }
    // Half its hp gone, or its time: the hitch gives (with a tell on screen).
    if (this.hitched && this.mode !== 'tell-loose' && this.mode !== 'enter' && this.mode !== 'leave' && this.looseDue() && this.inView()) {
      this.cancelAttack();
      this.setMode('tell-loose');
      this.world.audio.sfx('ring/hitch-creak');
      nearestWagon(this.world, this.x, this.y)?.say('caravan');
    }
    switch (this.mode) {
      case 'enter':
        if (this.x - CARAVAN.len / 2 >= cam.x + 4 && this.frontX <= cam.right + 4) this.setMode('ride');
        else if (this.modeT >= ENTER_GIVE_UP && (this.frontX < cam.x || this.x - CARAVAN.len / 2 > cam.right)) {
          // Boxed in off screen by traffic: it never showed; it gives up (no score).
          this.remove();
          return;
        }
        break;
      case 'ride':
        this.inPlay++;
        if (this.inPlay >= this.stay) {
          this.setMode('leave');
          break;
        }
        this.pickLane();
        if (--this.cool <= 0) this.tryAttack();
        break;
      case 'tell-shoot':
        if (!this.prey || !this.inView() || !this.gunnerUp) this.cancelAttack();
        else if (this.modeT >= telegraphTicks(this.world, CARAVAN_AI.tell)) {
          this.setMode('shoot');
          this.shotsLeft = CARAVAN_AI.shots;
          this.fireOnce();
        }
        break;
      case 'shoot':
        if (this.shotsLeft > 0 && this.modeT % CARAVAN_AI.shotGap === 0) this.fireOnce();
        if (this.modeT >= CARAVAN_AI.shootTicks) this.setMode('recover');
        break;
      case 'recover':
        if (this.modeT >= CARAVAN_AI.recover) this.endAttack();
        break;
      case 'tell-loose':
        if (this.modeT % 5 === 0) hitSpark(this.world, this.x + CARAVAN.hitch[0] - 2, this.y + CARAVAN.hitch[1], 1);
        if (this.modeT >= telegraphTicks(this.world, CARAVAN_AI.looseTell)) this.snap();
        break;
      case 'leave':
        if (this.x - CARAVAN.len / 2 - cam.x > cam.w + 8 || this.frontX < cam.x - 8) {
          this.remove();
          return;
        }
        break;
    }
    this.drive(sx);
    this.touchWagons();
  }

  /** Damage or time says the hitch gives. */
  private looseDue(): boolean {
    return this.hp <= this.maxHp * CARAVAN_AI.looseAt || (this.looseAfter > 0 && this.inPlay >= this.looseAfter);
  }

  /** The rig and its hatch in view (GDD §4.11: no attack from off screen). */
  private inView(): boolean {
    const cam = this.world.camera;
    return this.x - CARAVAN.len / 2 >= cam.x + 4 && this.x + CARAVAN.gunHip[0] >= cam.x + ATTACK_INSET && this.x + CARAVAN.len / 2 <= cam.right - 4;
  }

  /** Now and then a near lane (3 or 4), when it is free beside the rig. */
  private pickLane(): void {
    if (--this.laneT > 0) return;
    const rng = this.world.rng;
    this.laneT = rng.int(90, 170);
    this.prefDx = rng.int(CARAVAN_AI.ahead[0], CARAVAN_AI.ahead[1]);
    const open = openAt(this.world, this.x + 80);
    const cur = nearestLane(this.y, 1, open);
    let want = clampLane(cur < 3 ? 3 : rng.chance(0.5) ? 3 : 4, open);
    if (want === cur && cur >= 3) want = clampLane(cur === 3 ? 4 : 3, open);
    if (want < 3 && cur >= want) return;
    this.tryLane(want, cur);
  }

  private tryLane(want: number, cur: number): void {
    if (want === cur) return;
    const step = cur + Math.sign(want - cur);
    if (laneFree(this.world, this, step, this.x - CARAVAN.len / 2 - 14, this.frontX + 14, true)) this.laneTarget = step;
  }

  /** Motion: the road speed + a screen speed toward its spot; the lane (3–4) toward its target. */
  private drive(sx: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const cam = this.world.camera;
    let rel: number;
    if (this.mode === 'enter') {
      const want = this.prey ? this.prey.x - cam.x + this.prefDx : 200;
      rel = sx < Math.min(CARAVAN_AI.maxX, Math.max(CARAVAN_AI.minX, want)) ? CARAVAN_AI.enterRel * 1.3 : -CARAVAN_AI.enterRel;
    } else if (this.mode === 'leave') rel = CARAVAN_AI.leaveRel;
    else {
      const t = this.prey;
      const want = Math.max(CARAVAN_AI.minX, Math.min(CARAVAN_AI.maxX, t ? t.x - cam.x + this.prefDx : 200));
      const busy = this.mode !== 'ride' && this.mode !== 'recover';
      rel = Math.max(-CARAVAN_AI.rel, Math.min(CARAVAN_AI.rel, (want - sx) * (busy ? 0.01 : 0.025)));
    }
    const gap = gapAhead(this.world, this, this.y, this.frontX, 40);
    if (gap < 16) {
      rel = followRel(rel, gap, road);
      if ((this.mode === 'ride' || this.mode === 'enter' || this.mode === 'leave') && this.world.tick % 14 === 0) {
        const open = openAt(this.world, this.x + 80);
        const cur = nearestLane(this.y, 1, open);
        this.tryLane(cur >= open ? cur - 1 : cur + 1, cur);
      }
    }
    if (rel < 0 && gapBehind(this.world, this, this.y, this.x - CARAVAN.len / 2, 30) < 12) rel = Math.max(rel, 0.3);
    this.rel = rel;
    this.vx = road + rel;
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
    const open = openAt(this.world, this.x + 80);
    this.laneTarget = clampLane(this.laneTarget, open);
    const dy = laneY(this.laneTarget) - this.y;
    const step = LANE_GAP / CARAVAN_AI.laneTicks;
    this.y += Math.abs(dy) <= step ? dy : Math.sign(dy) * step;
  }

  /** Wagons touching the rig: pushed out behind (a bump), rammed by the loose caravan (2 cells). */
  private touchWagons(): void {
    if (this.mode === 'wreck') return;
    const s = this.bodySlab;
    s.x = this.x - CARAVAN.len / 2;
    s.w = this.frontX - s.x;
    s.y = this.y - 8;
    s.h = 16;
    const back = pushWagons(this.world, this, s, this.contact, this.bumps, this.rammed);
    // A wagon ahead holds it back (not while it crashes); one at the band's end behind it holds it
    // up (also while it drops back loose).
    if (back > 0 || (back < 0 && !crashing(this.mode))) this.x += back;
  }

  // ------------------------------------------------------------------------------- the gunner

  private tryAttack(): void {
    const t = this.prey;
    if (!t || this.reacting || !this.gunnerUp || !this.inView() || t.x > this.x - 20) {
      this.cool = 20;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 30;
      return;
    }
    this.holdsToken = true;
    this.setMode('tell-shoot');
    this.world.audio.sfx('ring/pistol-cock');
  }

  /** One shot at the target across the lanes (within ±`aimMax` of straight back). */
  private fireOnce(): void {
    if (this.shotsLeft <= 0) return;
    this.shotsLeft--;
    const m = this.point('muzzle', CARAVAN.muzzle[0], CARAVAN.muzzle[1], ptA);
    const t = this.prey;
    let a = Math.PI;
    if (t) {
      const raw = Math.atan2(t.y - this.y, t.x - m[0]);
      const off = Math.atan2(Math.sin(raw - Math.PI), Math.cos(raw - Math.PI));
      a = Math.PI + Math.max(-CARAVAN_AI.aimMax, Math.min(CARAVAN_AI.aimMax, off));
    }
    this.shotLift = Math.max(8, Math.round(this.y - m[1]));
    const p = this.shoot({ speed: CARAVAN_AI.bulletSpeed, damage: 10, sprite: 'weapon/enemy-bullet', angle: a, x: m[0], y: this.y, life: 150, kind: 'bullet' });
    p.vx += ringOf(this.world)?.roadSpeed ?? 0;
    muzzleFlash(this.world, m[0], m[1], a, { kind: 'pistol' });
    this.world.audio.sfx('enemy/shot');
  }

  private cancelAttack(): void {
    this.shotsLeft = 0;
    if (this.mode === 'tell-shoot' || this.mode === 'shoot' || this.mode === 'recover') this.endAttack(40);
  }

  private endAttack(cool?: number): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.cool = cool ?? this.fireInterval(CARAVAN_AI.every, CARAVAN_AI.jitter);
    if (!crashing(this.mode) && this.mode !== 'tell-loose') this.setMode('ride');
  }

  // ------------------------------------------------------------------------------- the crash

  /** The hitch snaps: the tow car flees, the caravan drops back and swerves. */
  private snap(): void {
    if (!this.hitched) return;
    this.hitched = false;
    this.world.audio.sfx('ring/hitch-snap');
    this.world.audio.sfx('ring/caravan-scrape');
    debris(this.world, this.x + CARAVAN.hitch[0], this.y - 8, 'metal', 4);
    this.car = new RingTowCar(this.world, this.x + this.carDx, this.y, this.carModel, this.carColour, this.vx);
    this.world.add(this.car);
    // The swerve: one lane toward the median (when it is open and not off the road) and back,
    // into a lane free of road things over its drop-back (review B: it swerved into a parcel
    // van); wagons do not count (the ram is the threat). Both sides taken: a wobble in its lane.
    const open = openAt(this.world, this.x);
    const cur = nearestLane(this.y, 1, open);
    const x0 = this.x - CARAVAN.len / 2 - 70;
    const x1 = this.x + CARAVAN.len / 2 + 8;
    const up = cur > 1 ? cur - 1 : 0;
    const down = cur < open ? cur + 1 : 0;
    const lane = up && laneFree(this.world, this, up, x0, x1, false) ? up : down && laneFree(this.world, this, down, x0, x1, false) ? down : 0;
    this.swerveY0 = this.y;
    this.swerveY1 = lane ? laneY(lane) : this.y + (cur > 1 ? -5 : 5);
    this.rel = Math.min(this.rel, 0);
    this.cancelAttack();
    this.setMode('loose');
  }

  /** Loose → tip → slide → wreck (alive or beaten). */
  private crashStep(): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    switch (this.mode) {
      case 'loose': {
        const k = Math.min(1, this.modeT / CARAVAN_AI.loose);
        this.y = this.swerveY0 + (this.swerveY1 - this.swerveY0) * Math.sin(k * Math.PI);
        this.rel += (CARAVAN_AI.looseRel - this.rel) * 0.05;
        if (this.modeT % 4 === 0) hitSpark(this.world, this.x + CARAVAN.hitch[0] - 2, this.y - 2, -1);
        if (this.modeT >= CARAVAN_AI.loose) this.tipOver();
        break;
      }
      case 'tip':
        this.rel += (-road * 0.6 - this.rel) * 0.06;
        this.y += Math.min(1, Math.max(0, SHOULDER_TOP + 5 - this.y) * 0.08);
        if (this.modeT % 3 === 0) dust(this.world, this.x + this.world.fxRng.range(-30, 30), this.y, 2);
        // It lands on its far side (the last tip frame): a puff of dust along the whole length.
        if (this.modeT === 18) for (let dx = -30; dx <= 30; dx += 15) dust(this.world, this.x + dx, this.y, 3);
        if (this.modeT >= CARAVAN_AI.tip) this.setMode('slide');
        break;
      case 'slide':
        this.rel += (-road - this.rel) * 0.05;
        this.y += Math.min(1, Math.max(0, SHOULDER_TOP + 5 - this.y));
        if (this.modeT % 4 === 0) hitSpark(this.world, this.x - 20 + this.world.fxRng.range(0, 40), this.y - 1, -1);
        // The scrape: sparks fly back off the chassis and the drawbar head, dust trails the rear.
        if (this.modeT % 2 === 0) this.world.particles.burst(FX_SPARK, this.x + this.world.fxRng.range(-34, 34), this.y - 1, 2, 0.8, 2.6, Math.PI + 0.3, 0.8);
        if (this.modeT % 3 === 0) this.world.particles.burst(FX_SPARK, this.x + CARAVAN.hitch[0], this.y - 2, 2, 0.6, 2, Math.PI + 0.4, 0.8);
        if (this.modeT % 3 === 1) dust(this.world, this.x - CARAVAN.len / 2 - 2, this.y, 2);
        if (this.y >= SHOULDER_TOP + 5 && this.modeT > 12) {
          this.setMode('wreck');
          this.world.audio.sfx('ring/caravan-tip');
        }
        break;
      case 'wreck':
        this.rel = -road;
        if (this.modeT % 9 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-20, 20), this.y - 16, false);
        break;
      default:
        break;
    }
    this.vx = road + this.rel;
    this.x += this.vx;
    const cam = this.world.camera;
    if (this.x + CARAVAN.len / 2 + 24 < cam.x || this.modeT > 1200) this.remove();
  }

  /** It tips over: the gunner tumbles off, a tied hostage is freed. */
  private tipOver(): void {
    this.setMode('tip');
    this.world.audio.sfx('ring/caravan-tip');
    this.world.camera.shake(2, 8);
    this.throwGunner(false);
    if (this.hostage && this.hostage.state === 'tied') this.hostage.open(slotOf(nearestWagon(this.world, this.x, this.y)));
  }

  private throwGunner(blast: boolean): void {
    if (!this.gunner || this.gunnerGone) return;
    this.gunnerGone = true;
    flingPerson(this.world, this.x + CARAVAN.gunHip[0], this.y, `${CARAVAN_ART}/gunner`, -1, blast);
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(_kind: ReactionKind): void {
    this.cancelAttack();
  }

  protected override onReactionEnd(_kind: ReactionKind): void {
    this.play('ride');
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'gloat') super.thinkReaction(kind);
    else if (kind === 'cower') this.play('cower');
    else this.play('ride');
    this.facing = 1;
    // It holds its place on screen (the road holds while everyone is out); traffic drifting back
    // into it pushes it back a little.
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const gap = gapAhead(this.world, this, this.y, this.frontX, 30);
    this.vx = road + followRel(0, gap, road);
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
  }

  /** The gloat: a coffee from the thermos (his own business). */
  protected override thinkGloat(_spot: Entity | null, _t: number): void {
    this.play('gloat');
  }

  // ------------------------------------------------------------------------------- the hostage carrier

  hostageSeat(out: SeatOut): void {
    out.x = this.x + CARAVAN.seat;
    out.y = this.y;
    out.lift = CARAVAN.seatLift + this.lift;
  }

  hostageDoor(out: { x0: number; x1: number }): void {
    out.x0 = this.x + CARAVAN.door[0];
    out.x1 = this.x + CARAVAN.door[1];
  }

  hostageDoorState(state: number): void {
    if (this.grille >= 0) this.grille = state;
  }

  hostageOpened(): void {
    this.grille = -1;
    this.stay = Math.min(this.stay, this.inPlay + 180);
  }

  drawHostageDoor(r: Renderer): void {
    if (this.grille < 0 || this.mode === 'tip' || this.mode === 'slide' || this.mode === 'wreck') return;
    drawOpts.flipX = false;
    r.sprite(`${CARAVAN_ART}/grille`, this.grille, Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
  }

  hostageDoorFall(out: DoorFallOut): void {
    const b = doorBox(CARAVAN_DOOR);
    const a = doorFallAnchor(b);
    out.sprite = `${CARAVAN_ART}/grille-fall`;
    out.ax = a.ax;
    out.ay = a.ay;
    out.h = b[3] - b[1];
  }

  // ------------------------------------------------------------------------------- death

  /** Beaten: the gunner tumbles off, the car flees, the caravan comes loose and tips at once. */
  protected override onDeath(d: Damage): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.shotsLeft = 0;
    const blast = d.kind === 'explosion' || damageHas(d, 'ram');
    debris(this.world, this.x, this.y - 22, 'metal', 6);
    debris(this.world, this.x - 10, this.y - 26, 'glass', 4);
    if (this.hitched) {
      this.snap();
      this.mode = 'loose';
    }
    this.throwGunner(blast);
    if (this.mode === 'loose' || this.mode === 'tell-loose' || !crashing(this.mode)) this.tipOver();
  }

  /** The beaten caravan keeps sliding to the shoulder and lies there until it is off screen. */
  protected override updateDeath(): void {
    this.modeT++;
    this.crashStep();
    this.touchWagons();
  }

  protected override dropItem(): void {
    const spec = this.drop;
    this.drop = null;
    dropCrate(this.world, this.x, this.y, spec, 24);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const wob = this.mode === 'loose' ? (Math.floor(this.modeT / 3) % 2 === 0 ? -1 : 0) : 0;
    const shake = this.mode === 'tell-loose' && Math.floor(this.modeT / 2) % 2 === 0 ? 1 : 0;
    const rock = this.reaction === 'cower' && Math.floor(this.reactionTicks / 4) % 2 === 0 ? 1 : 0;
    const y = Math.round(this.y - this.lift) + wob - rock;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    if (this.mode === 'tip' || this.mode === 'slide' || this.mode === 'wreck') {
      const f = this.mode === 'tip' ? Math.min(3, Math.floor(this.modeT / 6)) : 3;
      r.sprite(`${CARAVAN_ART}/tip`, f, x, y, drawOpts);
      return;
    }
    // The tow car first (ahead), then the gunner (the roof hides his legs), the caravan, its parts.
    if (this.hitched) this.drawCar(r, x + shake, y);
    if (this.gunnerUp && this.anim.id) r.sprite(this.anim.id, this.anim.index, x + shake, y, drawOpts);
    const battered = this.hp < this.maxHp * 0.5 || this.dead;
    const hatch = this.gunner && !this.gunnerGone;
    r.sprite(`${CARAVAN_ART}/body`, (battered ? 2 : 0) + (hatch ? 1 : 0), x + shake, y, drawOpts);
    if (this.hostageCaravan) r.sprite(`${CARAVAN_ART}/open`, 0, x + shake, y, drawOpts);
    const bar = this.hitched ? (this.mode === 'tell-loose' && Math.floor(this.modeT / 3) % 2 === 0 ? 1 : 0) : 2;
    r.sprite(`${CARAVAN_ART}/drawbar`, bar, x + shake, y, drawOpts);
    const k = this.hp / Math.max(1, this.maxHp);
    if (k < 0.67) {
      const n = k < 0.34 ? CARAVAN.dents.length : 2;
      for (let i = 0; i < n; i++) {
        const [dx, dy, f] = CARAVAN.dents[i];
        r.sprite('ring/car/dent', f, x + shake + dx, y + dy, drawOpts);
      }
    }
    const f = Math.floor(this.roll / 2.5) & 3;
    r.sprite('ring/car/wheel-m', f, x + shake + CARAVAN.wheel, y - Math.round(CARAVAN.wheelR + 0.5), drawOpts);
    if (this.flashTicks > 0) {
      tintOpts.tint = 0xffffffff;
      tintOpts.alpha = 0.4;
      r.sprite(`${CARAVAN_ART}/body`, hatch ? 1 : 0, x + shake, y, tintOpts);
    }
    if (this.mode === 'tell-shoot' && this.anim.id) {
      const T = telegraphTicks(this.world, CARAVAN_AI.tell);
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) {
        tintOpts.tint = 0xff6040ff;
        tintOpts.alpha = 0.35;
        r.sprite(this.anim.id, this.anim.index, x, y, tintOpts);
      }
    }
  }

  private drawCar(r: Renderer, x: number, y: number): void {
    const cx = x + this.carDx;
    r.sprite(`ring/car/${this.carModel}-${this.carColour}`, 0, cx, y, drawOpts);
    const f = Math.floor(this.roll / 2.5) & 3;
    const wh = TOW_CAR_WHEELS[this.carModel];
    for (let i = 0; i < wh.length; i++) r.sprite('ring/car/wheel-s', f, cx + wh[i], y - 6, drawOpts);
  }
}

/** The tow car after the hitch snapped: it flees ahead and is gone (drawn only). */
export class RingTowCar extends Entity implements RingDrawable {
  shadowW: number;
  readonly model: 'hatch' | 'estate';
  readonly colour: string;
  private roll = 0;
  private rel: number;

  constructor(world: World, x: number, y: number, model: 'hatch' | 'estate', colour: string, vx: number) {
    super(world, x, y);
    this.model = model;
    this.colour = colour;
    this.type = GANG_IDS.towCar;
    this.team = 'neutral';
    this.z = 30;
    const half = TOW_CAR_HALF[model];
    this.shadowW = half * 2 - 6;
    this.hitbox = { x: -half, y: -26, w: half * 2, h: 26 };
    this.despawnMargin = 64;
    this.rel = vx - (ringOf(world)?.roadSpeed ?? 0);
  }

  override update(): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.rel += (CARAVAN_AI.carFlee - this.rel) * 0.05;
    // A car ahead in its lane: it squeezes past (no harm) by holding back a little.
    if (gapAhead(this.world, this, this.y, this.x + TOW_CAR_HALF[this.model], 30) < 10) this.rel = Math.min(this.rel, 0.2);
    this.vx = road + this.rel;
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
    const cam = this.world.camera;
    if (this.x - TOW_CAR_HALF[this.model] > cam.right + 16 || this.x + TOW_CAR_HALF[this.model] < cam.x - 200) this.remove();
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(`ring/car/${this.model}-${this.colour}`, 0, x, y, drawOpts);
    const f = Math.floor(this.roll / 2.5) & 3;
    const wh = TOW_CAR_WHEELS[this.model];
    for (let i = 0; i < wh.length; i++) r.sprite('ring/car/wheel-s', f, x + wh[i], y - 6, drawOpts);
  }
}

defineEntity(RING_ENTITY_B.caravan, (w, x, y, p) => new RingCaravan(w, x, y, p), {
  category: 'enemy',
  score: CARAVAN_AI.score,
  description: 'A car towing a caravan in the near lanes: a gunner in the roof hatch; the caravan comes loose, swerves, tips onto the shoulder; a hostage behind a grille (params gunner, looseAfter, hostage, item, drop).',
});
