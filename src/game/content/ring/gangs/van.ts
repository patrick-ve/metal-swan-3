/**
 * `ring-parcel-van` — the parcel van (docs/design/ring.md §5.2, §8, §9; GDD §4.11 fairness): a
 * high-roof delivery van in our own ZOEF! livery that drives ahead of the wagons. Armoured (300 HP,
 * scaled for difficulty and co-op), not knifeable.
 *
 * - THE REAR DOORS open first (`open`, 21 ticks on screen: the near door swings out, the hold shows
 *   its crew and a stack of parcels); they stay open.
 * - CREW `thrower`: `tell-throw` (≥ 18 ticks: he lifts a parcel over his head) → `throw`: a
 *   `ring-parcel` (parcel.ts) lobbed into the target wagon's lane, landing ahead of it; it tumbles
 *   back along the lane as an obstacle (1 cell; shot it breaks, one in four holds a crate).
 * - CREW `gunner`: only in the target's lane: `tell-shoot` (≥ 18 ticks: he levels a pistol
 *   backwards) → `shoot`: three shots back along the lane (½ cell each).
 * - BRAKE CHECK (`brakeCheck: true`): with the target in its lane behind it, `tell-brake` (the brake
 *   lights glow 24 ticks; the target's driver shouts his 'brake' line) → `brake`: it brakes hard
 *   (the van drops back fast); a wagon still in line behind it is rammed (2 cells, a hard shove);
 *   a swerve or a lane change dodges it.
 * Attacks start only with the hold fully on screen and an attack token; a tell that would carry it
 * off screen is dropped. It keeps its lane during an attack and changes lanes only into free road.
 * After its stay (`VAN_AI.stay`) it speeds off ahead (no score).
 * - BEATEN: score, a crate (`drop`, else the ring roll), the crew and the driver tumble out onto the
 *   hard shoulder (bloodless), the van limps onto the shoulder, smoking, and falls back off screen.
 * - HOSTAGE (`hostage: true`, `item`): the rear door stands open, a tied hostage (`ring-hostage`)
 *   rides in the hold behind a barred grille (the hold is the hostage's: no crew). It is the
 *   hostage's carrier (items/carrier.ts): shots on the grille's slab hit the grille, the van's own
 *   hurt slab leaves it free; the wave-A flow runs when it is shot open (the hostage leaps onto the
 *   rescuer's roof, bows, drops its gift). Beaten with the hostage still tied, the grille bursts.
 * - GLOAT (every player out): the van holds its place, the crew scans parcels, and the courier steps
 *   out of the cab, walks to the wreck (else to the hero on the shoulder) and sticks a NIET THUIS
 *   card on it (no pointing, no laughing). COWER: the crew ducks, the courier ducks and goes back.
 *
 * Params: `crew` ('thrower' default | 'gunner' | 'none'), `brakeCheck` (bool), `hostage` (bool),
 * `item` (the hostage's gift), `side` ('behind' | 'ahead', from the director), `gang`, `hp`, `drop`.
 */
import { damageHas, type Damage, type Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { debris, explosion, muzzleFlash, smokeTrail } from '../../../fx';
import { defineEntity, NO_PARAMS, paramBool, type SpawnParams } from '../../../registry';
import { ringOf, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY, RING_ENTITY_B } from '../../../ring/ids';
import { clampLane, LANE_GAP, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { WAGON_W, type Wagon } from '../../../ring/wagon';
import type { DoorFallOut, HostageCarrier, SeatOut } from '../items/carrier';
import { doorBox, doorFallAnchor } from '../traffic/geometry';
import type { RingHostage } from '../items/hostage';
import { drivenWagons, ENTER_GIVE_UP, nearestWagon } from '../traffic/road-kit';
import { RingCourier } from './courier';
import { GANG_IDS, VAN, VAN_ART } from './geometry';
import { BumpCooldown, dropCrate, flingPerson, followRel, gapAhead, gapBehind, laneFree, openAt, pushWagons, type ContactRule } from './kit';

export type VanMode = 'enter' | 'ride' | 'open' | 'tell-throw' | 'throw' | 'tell-shoot' | 'shoot' | 'tell-brake' | 'brake' | 'recover' | 'leave';
export type VanCrew = 'thrower' | 'gunner' | 'none';

/** Tuning (ticks, px, px/tick). */
export const VAN_AI = {
  hp: 300,
  score: 1500,
  /** Telegraph bases (scaled by difficulty, never below 18): the crew's tells, the brake lights. */
  tell: 26,
  brakeTell: 24,
  /** The rear doors swinging open (3 frames). */
  open: 21,
  /** Attack interval base and jitter; the first attack after it is in play. */
  every: 150,
  jitter: 30,
  firstDelay: 50,
  throwTicks: 10,
  /** The gunner's burst: shots, ticks between them, the mode's length. */
  shots: 3,
  shotGap: 7,
  shootTicks: 18,
  recover: 24,
  /** The brake check: ticks of hard braking, the screen speed then, the gap (wagon nose → van rear) it needs, and its cooldown. */
  brakeTicks: 34,
  brakeRel: -2.8,
  brakeGap: 150,
  brakeCool: 240,
  /** Where it drives: this far ahead of its target (centre to centre), its screen band (centre x). */
  ahead: [126, 176] as const,
  minX: 196,
  maxX: 326,
  /** Screen speeds: seeking its spot, entering from ahead, leaving; the lane change (ticks per lane). */
  rel: 1.2,
  enterRel: 1.5,
  leaveRel: 2.6,
  laneTicks: 18,
  /** Ticks between lane picks. */
  weave: [80, 150] as const,
  /** Ticks in play before it leaves (a hostage van: the hostage's chance). */
  stay: 900,
  hostageStay: 720,
  /** The parcel: flight ticks, arc height, where it lands (px ahead of the target's nose). */
  parcelTicks: 30,
  parcelArc: 22,
  land: [24, 70] as const,
  bulletSpeed: 3.2,
  /** The beaten van: its screen speed falling back, ticks before it is gone at the latest. */
  limpRel: -1.3,
  limpTicks: 900,
} as const;

/** An attack starts only with the hold this far inside the view (px). */
const ATTACK_INSET = 12;
const NO_BOXES: readonly Rect[] = [];
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = {};
const addOpts: DrawOpts = { blend: 'add' };
const ptA: [number, number] = [0, 0];

export class RingParcelVan extends Enemy implements HostageCarrier, RingDrawable {
  mode: VanMode = 'enter';
  modeT = 0;
  lift = 0;
  shadowW: number = VAN.len - 6;
  shotLift = 22;
  /** The attack token is held (fairness watcher). */
  holdsToken = false;
  readonly crew: VanCrew;
  readonly brakeCheck: boolean;
  readonly hostageVan: boolean;
  laneTarget: number;
  /** The rear: 0 shut, 1–3 the opening frames shown (3 = open). */
  doors = 0;
  /** The hostage's grille: 0 shut, 1 dented, −1 gone. */
  grille = -1;
  /** The brake lights are on (the tell and the brake). */
  braking = false;
  /** Ticks in play (its stay). */
  inPlay = 0;
  stay: number;
  /** Its screen speed this tick (the bot reads it). */
  rel = 0;
  hostage: RingHostage | null = null;
  courier: RingCourier | null = null;
  private cool: number = VAN_AI.firstDelay;
  private brakeCool = 60;
  private laneT = 0;
  private prefDx: number = VAN_AI.ahead[0];
  private prey: Wagon | null = null;
  private started = false;
  private shotsLeft = 0;
  private roll = 0;
  private limpT = 0;
  private readonly hurt: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly bodySlab: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly bumps = new BumpCooldown();
  private readonly rammed: Wagon[] = [];
  private readonly contact: ContactRule;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: `${VAN_ART}/crew`, hp: VAN_AI.hp, body: false, w: VAN.len, h: VAN.height, soft: false, big: true, score: VAN_AI.score });
    this.hostageVan = p.hostage === true;
    this.crew = this.hostageVan || p.crew === 'none' ? 'none' : p.crew === 'gunner' ? 'gunner' : 'thrower';
    this.brakeCheck = paramBool(p, 'brakeCheck', false);
    this.laneTarget = nearestLane(y);
    this.y = laneY(this.laneTarget);
    this.facing = 1;
    this.z = 30;
    this.despawnMargin = 200;
    this.stay = this.hostageVan ? VAN_AI.hostageStay : VAN_AI.stay;
    if (this.hostageVan) {
      this.doors = 3;
      this.grille = 0;
    }
    const self = this;
    this.contact = {
      get ram(): boolean {
        return self.mode === 'brake';
      },
      rearCost: (closing) => (closing > 1.4 ? 1 : closing > 0.5 ? 0.5 : 0),
    };
    this.addTag(RING_ENTITY_B.parcelVan, 'ring-block');
    this.play('idle');
  }

  /** The rear doors stand fully open. */
  get doorsOpen(): boolean {
    return this.doors >= 3;
  }

  override hurtboxes(): readonly Rect[] {
    if (this.dead) return NO_BOXES;
    const b = this.hurt[0];
    // The grille's slab belongs to the hostage while it is shut (shots there hit the grille).
    const x0 = this.grille >= 0 && this.hostage && this.hostage.state === 'tied' ? this.x + VAN.door[1] : this.x - VAN.len / 2;
    b.x = x0;
    b.w = this.x + VAN.len / 2 - x0;
    b.y = this.y - 8;
    b.h = 16;
    return this.hurt;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  private setMode(m: VanMode): void {
    this.mode = m;
    this.modeT = 0;
    if (m === 'tell-throw' || m === 'throw' || m === 'tell-shoot' || m === 'shoot') this.play(m, { restart: true });
    else if (m === 'ride' || m === 'recover' || m === 'enter' || m === 'leave') this.play('idle');
  }

  // ------------------------------------------------------------------------------- the AI

  /** First tick: a hostage van boards its hostage; one from behind takes a lane free of wagons. */
  private start(): void {
    this.started = true;
    if (this.hostageVan) {
      const h = this.world.spawn(RING_ENTITY.hostage, this.x + VAN.seat, this.y, { carrier: this, item: this.params.item });
      this.hostage = (h as RingHostage).carrier === this ? (h as RingHostage) : null;
    }
    const cam = this.world.camera;
    if (this.x < cam.x && ringOf(this.world)) {
      // From behind: into a lane no wagon drives in (it overtakes them), far lanes first.
      const open = openAt(this.world, this.x);
      for (const l of [1, 2, 3, 4]) {
        if (l > open) break;
        if (laneFree(this.world, this, l, this.x - 60, cam.right, true)) {
          this.laneTarget = l;
          this.y = laneY(l);
          break;
        }
      }
    }
  }

  protected override think(): void {
    this.modeT++;
    this.facing = 1;
    if (!this.started) this.start();
    const cam = this.world.camera;
    const sx = this.x - cam.x;
    this.prey = nearestWagon(this.world, this.x, this.y);
    if (this.brakeCool > 0) this.brakeCool--;
    switch (this.mode) {
      case 'enter':
        if (this.x - VAN.len / 2 >= cam.x + 4 && this.x + VAN.len / 2 <= cam.right - 4) this.setMode('ride');
        else if (this.modeT >= ENTER_GIVE_UP && !this.world.onScreen(this, 0)) {
          // Boxed in off screen by traffic: it never showed; it gives up (no score).
          this.remove();
          return;
        }
        break;
      case 'ride':
        if (++this.inPlay >= this.stay) {
          this.setMode('leave');
          break;
        }
        this.pickLane();
        if (--this.cool <= 0) this.tryAttack();
        break;
      case 'open':
        this.doors = Math.min(3, 1 + Math.floor((this.modeT * 3) / VAN_AI.open));
        if (this.modeT >= VAN_AI.open) {
          this.doors = 3;
          this.cool = 16;
          this.setMode('ride');
        }
        break;
      case 'tell-throw':
      case 'tell-shoot':
        if (!this.prey || !this.inView()) this.cancelAttack();
        else if (this.modeT >= telegraphTicks(this.world, VAN_AI.tell)) this.release();
        break;
      case 'tell-brake':
        if (!this.inView()) this.cancelAttack();
        else if (this.modeT >= telegraphTicks(this.world, VAN_AI.brakeTell)) {
          this.setMode('brake');
          this.world.audio.sfx('ring/brake-squeal');
        }
        break;
      case 'brake':
        if (this.modeT >= VAN_AI.brakeTicks) this.toRecover();
        break;
      case 'throw':
        if (this.modeT >= VAN_AI.throwTicks) this.toRecover();
        break;
      case 'shoot':
        if (this.shotsLeft > 0 && this.modeT % VAN_AI.shotGap === 0) this.fireOnce();
        if (this.modeT >= VAN_AI.shootTicks) this.toRecover();
        break;
      case 'recover':
        if (this.modeT >= VAN_AI.recover) this.endAttack();
        break;
      case 'leave':
        // Past either edge (one held back behind the left edge by traffic never comes back).
        if (sx - VAN.len / 2 > cam.w + 8 || sx + VAN.len / 2 < -8) {
          this.remove();
          return;
        }
        break;
    }
    this.drive(sx);
    this.touchWagons();
  }

  /** The hold and the van fully in view (GDD §4.11: no attack from off screen). */
  private inView(): boolean {
    const cam = this.world.camera;
    return this.x - VAN.len / 2 >= cam.x + ATTACK_INSET && this.x + VAN.len / 2 - 20 <= cam.right;
  }

  /** Now and then a new lane: the gunner and a brake checker seek the target's, the thrower one beside it. */
  private pickLane(): void {
    if (--this.laneT > 0) return;
    const rng = this.world.rng;
    this.laneT = rng.int(VAN_AI.weave[0], VAN_AI.weave[1]);
    this.prefDx = rng.int(VAN_AI.ahead[0], VAN_AI.ahead[1]);
    const open = openAt(this.world, this.x + 64);
    const cur = nearestLane(this.y, 1, open);
    const t = this.prey;
    const tl = t ? nearestLane(t.y, 1, open) : cur;
    let want: number;
    if (this.hostageVan) want = clampLane(rng.chance(0.5) ? 3 : 4, open);
    else if (this.crew === 'gunner' || (this.brakeCheck && this.brakeCool < 60)) want = tl;
    else if (this.crew === 'thrower') want = rng.chance(0.35) ? tl : clampLane(tl + (rng.chance(0.5) ? 1 : -1), open);
    else want = clampLane(cur + (rng.chance(0.5) ? 1 : -1), open);
    this.tryLane(want, cur);
  }

  /** Change one lane toward `want` when that lane is free beside it. */
  private tryLane(want: number, cur: number): void {
    if (want === cur) return;
    const step = cur + Math.sign(want - cur);
    if (laneFree(this.world, this, step, this.x - VAN.len / 2 - 14, this.x + VAN.len / 2 + 14, true)) this.laneTarget = step;
  }

  /** Motion: the road speed + a screen speed toward its spot; the lane toward its target. */
  private drive(sx: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const cam = this.world.camera;
    let rel: number;
    if (this.mode === 'enter') {
      const want = this.prey ? this.prey.x - cam.x + this.prefDx : 260;
      rel = sx < Math.min(VAN_AI.maxX, Math.max(VAN_AI.minX, want)) ? VAN_AI.enterRel * 1.3 : -VAN_AI.enterRel;
    } else if (this.mode === 'leave') rel = VAN_AI.leaveRel;
    else if (this.mode === 'brake') rel = VAN_AI.brakeRel;
    else {
      const t = this.prey;
      const want = Math.max(VAN_AI.minX, Math.min(VAN_AI.maxX, t ? t.x - cam.x + this.prefDx : 260));
      const attacking = this.mode !== 'ride' && this.mode !== 'recover';
      rel = Math.max(-VAN_AI.rel, Math.min(VAN_AI.rel, (want - sx) * (attacking ? 0.012 : 0.03)));
      rel += Math.sin((this.age + this.id * 13) * 0.04) * 0.1;
    }
    // Keep its gap to the road things ahead and behind; blocked ahead: out into a free lane.
    const front = this.x + VAN.len / 2;
    const rear = this.x - VAN.len / 2;
    const gap = gapAhead(this.world, this, this.y, front, 40);
    if (gap < 16) {
      rel = followRel(rel, gap, road);
      if ((this.mode === 'ride' || this.mode === 'enter' || this.mode === 'leave') && this.world.tick % 12 === 0) {
        const open = openAt(this.world, this.x + 64);
        const cur = nearestLane(this.y, 1, open);
        this.tryLane(cur === 1 ? 2 : cur === open ? cur - 1 : this.world.rng.chance(0.5) ? cur - 1 : cur + 1, cur);
      }
    }
    // A tailgater behind it: it eases forward; not while it enters from off screen (the follower
    // brakes for it: else a car close behind pinned it off screen ahead and it drove away).
    const entering = this.mode === 'enter' && (sx - VAN.len / 2 > cam.w || sx + VAN.len / 2 < 0);
    if (this.mode !== 'brake' && !entering && rel < 0 && gapBehind(this.world, this, this.y, rear, 30) < 12) rel = Math.max(rel, 0.3);
    this.rel = rel;
    this.vx = road + rel;
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
    // The lane (held during an attack; a closing lane forces it out).
    const open = openAt(this.world, this.x + 64);
    this.laneTarget = clampLane(this.laneTarget, open);
    const dy = laneY(this.laneTarget) - this.y;
    const step = LANE_GAP / VAN_AI.laneTicks;
    this.y += Math.abs(dy) <= step ? dy : Math.sign(dy) * step;
  }

  /** Wagons that touch it: pushed out behind (a bump), rammed in the brake check (2 cells). */
  private touchWagons(): void {
    const s = this.bodySlab;
    s.x = this.x - VAN.len / 2;
    s.w = VAN.len;
    s.y = this.y - 8;
    s.h = 16;
    const back = pushWagons(this.world, this, s, this.contact, this.bumps, this.rammed);
    if (back !== 0) this.x += back;
    if (this.rammed.length > 0 && this.mode === 'brake') {
      this.world.camera.shake(2, 8);
      this.toRecover();
    }
  }

  // ------------------------------------------------------------------------------- attacks

  /** The target wagon in its lane behind it, close enough, nothing between them. */
  private brakeTarget(): Wagon | null {
    const list = drivenWagons(this.world);
    const rear = this.x - VAN.len / 2;
    let best: Wagon | null = null;
    let bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (Math.abs(w.y - this.y) > 4 || w.x > this.x) continue;
      const gap = rear - (w.x + WAGON_W / 2);
      if (gap < -4 || gap > VAN_AI.brakeGap || gap >= bd) continue;
      if (gapBehind(this.world, this, this.y, rear, gap) < gap - 2) continue;
      best = w;
      bd = gap;
    }
    return best;
  }

  private tryAttack(): void {
    const t = this.prey;
    if (!t || this.reacting || !this.inView()) {
      this.cool = 20;
      return;
    }
    if (this.brakeCheck && this.brakeCool <= 0) {
      const w = this.brakeTarget();
      if (w) {
        if (!takeAttackToken(this.world, this)) {
          this.cool = 30;
          return;
        }
        this.holdsToken = true;
        this.braking = true;
        this.brakeCool = VAN_AI.brakeCool;
        this.setMode('tell-brake');
        this.world.audio.sfx('ring/brake-tell');
        w.say('brake');
        return;
      }
    }
    if (this.crew === 'none') {
      this.cool = 30;
      return;
    }
    if (!this.doorsOpen) {
      // The doors swing open first (21 ticks on screen): the hold and its crew show.
      this.setMode('open');
      this.world.audio.sfx('ring/van-door');
      return;
    }
    const sameLane = Math.abs(t.y - this.y) < 6 && t.x < this.x - 40;
    if (this.crew === 'gunner' && !sameLane) {
      // The gunner fires along the lane only: it waits for the target's lane.
      this.cool = 20;
      this.laneT = 0;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 30;
      return;
    }
    this.holdsToken = true;
    if (this.crew === 'gunner') {
      this.setMode('tell-shoot');
      this.world.audio.sfx('ring/pistol-cock');
    } else {
      this.setMode('tell-throw');
      this.world.audio.sfx('ring/parcel-lift');
    }
  }

  /** The tell is over: the parcel leaves, or the first shot of the burst. */
  private release(): void {
    const t = this.prey;
    if (!t) {
      this.cancelAttack();
      return;
    }
    if (this.mode === 'tell-throw') {
      this.setMode('throw');
      this.throwParcel(t);
    } else {
      this.setMode('shoot');
      this.shotsLeft = VAN_AI.shots;
      this.fireOnce();
    }
  }

  /** A parcel lobbed into the target's lane, landing a little ahead of its nose. */
  private throwParcel(t: Wagon): void {
    const cam = this.world.camera;
    const hand = this.point('hand', VAN.hand[0], VAN.hand[1], ptA);
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const T = VAN_AI.parcelTicks;
    const sx0 = hand[0] - cam.x;
    let landSx = t.x - cam.x + WAGON_W / 2 + this.world.rng.range(VAN_AI.land[0], VAN_AI.land[1]);
    landSx = Math.min(landSx, sx0 - 10);
    const ty = laneY(nearestLane(t.y, 1, openAt(this.world, t.x)));
    this.world.spawn(GANG_IDS.parcel, hand[0], this.y, { lift: Math.max(8, this.y - hand[1]), ty, vx: road + (landSx - sx0) / T, ticks: T, arc: VAN_AI.parcelArc });
    this.world.audio.sfx('ring/throw');
  }

  /** One shot of the gunner's burst back along the lane. */
  private fireOnce(): void {
    if (this.shotsLeft <= 0) return;
    this.shotsLeft--;
    const m = this.point('muzzle', VAN.muzzle[0], VAN.muzzle[1], ptA);
    this.shotLift = Math.max(8, Math.round(this.y - m[1]));
    const p = this.shoot({ speed: VAN_AI.bulletSpeed, damage: 10, sprite: 'weapon/enemy-bullet', angle: Math.PI, x: m[0], y: this.y, life: 150, kind: 'bullet' });
    p.vx += ringOf(this.world)?.roadSpeed ?? 0;
    muzzleFlash(this.world, m[0], m[1], Math.PI, { kind: 'pistol' });
    this.world.audio.sfx('enemy/shot');
  }

  private toRecover(): void {
    this.braking = false;
    this.setMode('recover');
  }

  private cancelAttack(): void {
    this.braking = false;
    this.shotsLeft = 0;
    if (this.mode === 'tell-throw' || this.mode === 'tell-shoot' || this.mode === 'tell-brake' || this.mode === 'throw' || this.mode === 'shoot' || this.mode === 'brake' || this.mode === 'recover') this.endAttack(40);
    else if (this.mode === 'open') {
      this.doors = 3;
      this.setMode('ride');
    }
  }

  private endAttack(cool?: number): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.braking = false;
    this.cool = cool ?? this.fireInterval(VAN_AI.every, VAN_AI.jitter);
    this.setMode('ride');
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(_kind: ReactionKind): void {
    this.cancelAttack();
  }

  protected override onReactionEnd(_kind: ReactionKind): void {
    this.play('idle');
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'gloat') super.thinkReaction(kind);
    else if (kind === 'cower') this.play('cower');
    else this.play('idle');
    this.facing = 1;
    // It holds its place on screen (the road holds while everyone is out); traffic drifting back
    // into it pushes it back a little.
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const gap = gapAhead(this.world, this, this.y, this.x + VAN.len / 2, 30);
    this.vx = road + followRel(0, gap, road);
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
  }

  /** The gloat starts: the courier steps out with a NIET THUIS card (once per hold). */
  protected override onGloatStart(spot: Entity | null): void {
    if (!spot || (this.courier && !this.courier.removed)) return;
    const cam = this.world.camera;
    if (this.x + VAN.cabDoor < cam.x + 8 || this.x + VAN.cabDoor > cam.right - 8) return;
    this.courier = new RingCourier(this.world, this, spot);
    this.world.add(this.courier);
  }

  /** The crew scans parcels in the hold (its own business; no pointing, no laughing). */
  protected override thinkGloat(_spot: Entity | null, _t: number): void {
    this.play('gloat');
  }

  // ------------------------------------------------------------------------------- the hostage carrier

  hostageSeat(out: SeatOut): void {
    out.x = this.x + VAN.seat;
    out.y = this.y;
    out.lift = VAN.seatLift + this.lift;
  }

  hostageDoor(out: { x0: number; x1: number }): void {
    out.x0 = this.x + VAN.door[0];
    out.x1 = this.x + VAN.door[1];
  }

  hostageDoorState(state: number): void {
    if (this.grille >= 0) this.grille = state;
  }

  hostageOpened(): void {
    this.grille = -1;
    // The hostage is out: the van does not stay long.
    this.stay = Math.min(this.stay, this.inPlay + 150);
  }

  drawHostageDoor(r: Renderer): void {
    if (this.grille < 0) return;
    drawOpts.flipX = false;
    r.sprite(`${VAN_ART}/grille`, this.grille, Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
  }

  hostageDoorFall(out: DoorFallOut): void {
    const b = doorBox(VAN.hold);
    const a = doorFallAnchor(b);
    out.sprite = `${VAN_ART}/grille-fall`;
    out.ax = a.ax;
    out.ay = a.ay;
    out.h = b[3] - b[1];
  }

  // ------------------------------------------------------------------------------- death

  /** Beaten: the crew and the driver tumble out (bloodless), a tied hostage is freed; it limps off. */
  protected override onDeath(d: Damage): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.braking = false;
    this.shotsLeft = 0;
    const blast = d.kind === 'explosion' || damageHas(d, 'ram');
    if (this.crew !== 'none') {
      this.doors = 3;
      flingPerson(this.world, this.x - 36, this.y, `${VAN_ART}/crew`, -1, blast);
    }
    flingPerson(this.world, this.x + VAN.cabDoor, this.y, `${VAN_ART}/driver`, 1, blast, 1);
    if (this.hostage && this.hostage.state === 'tied') this.hostage.open(d.owner ?? -1);
    explosion(this.world, this.x - 8, this.y - 22, 's');
    debris(this.world, this.x, this.y - 20, 'metal', 6);
    debris(this.world, this.x - 30, this.y - 16, 'wood', 4);
    this.world.audio.sfx('ring/van-limp');
    this.limpT = 0;
    this.rel = 0;
  }

  /** The beaten van limps onto the hard shoulder, smoking, and falls back off screen. */
  protected override updateDeath(): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.limpT++;
    this.rel += (VAN_AI.limpRel - this.rel) * 0.04;
    this.vx = road + this.rel;
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
    const sy = SHOULDER_TOP + 6;
    this.y += Math.max(-0.6, Math.min(0.6, sy - this.y));
    if (this.limpT % 4 === 0) smokeTrail(this.world, this.x + 34 + this.world.fxRng.range(-4, 4), this.y - 24, true);
    const cam = this.world.camera;
    if (this.limpT > VAN_AI.limpTicks || this.x + VAN.len / 2 < cam.x - 24) this.remove();
  }

  /** The drop falls as a ring crate (the `drop` param, else the ring roll). */
  protected override dropItem(): void {
    const spec = this.drop;
    this.drop = null;
    dropCrate(this.world, this.x - 30, this.y, spec);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    // A little rock while it cowers; the nose dips while it brakes.
    const rock = this.reaction === 'cower' && Math.floor(this.reactionTicks / 4) % 2 === 0 ? 1 : 0;
    const y = Math.round(this.y - this.lift) - rock;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    const beaten = this.dead;
    r.sprite(`${VAN_ART}/body`, beaten ? 1 : 0, x, y, drawOpts);
    if (this.doors > 0) r.sprite(`${VAN_ART}/rear`, Math.min(2, this.doors - 1), x, y, drawOpts);
    if (this.doorsOpen && this.crew !== 'none' && !this.dead && this.anim.id) r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
    // Dents with the damage taken (the shared car decals): two at a third, all and a crack at two thirds.
    const k = this.dead ? 0 : this.hp / Math.max(1, this.maxHp);
    if (k < 0.67 || this.dead) {
      const n = k < 0.34 || this.dead ? VAN.dents.length : 2;
      for (let i = 0; i < n; i++) {
        const [dx, dy, f] = VAN.dents[i];
        r.sprite('ring/car/dent', f, x + dx, y + dy, drawOpts);
      }
      if (k < 0.34 && !this.dead) r.sprite('ring/car/dent', 3, x + VAN.crack[0], y + VAN.crack[1], drawOpts);
    }
    // The wheels (the civilians' medium wheel) turning with the road.
    const f = Math.floor(this.roll / 2.5) & 3;
    const wy = y - Math.round(VAN.wheelR + 0.5);
    for (let i = 0; i < VAN.wheels.length; i++) r.sprite('ring/car/wheel-m', f, x + VAN.wheels[i], wy, drawOpts);
    // The brake lights: lit, with a glow that swells through the tell.
    if (this.braking && !this.dead) {
      r.sprite(`${VAN_ART}/brake`, 0, x, y, drawOpts);
      const tell = this.mode === 'tell-brake' ? Math.min(1, this.modeT / 12) : 1;
      addOpts.alpha = (0.6 + 0.4 * Math.abs(Math.sin(this.modeT * 0.35))) * tell;
      r.sprite(`${VAN_ART}/brake`, 1, x, y, addOpts);
    }
    if (this.flashTicks > 0 && !this.dead) {
      tintOpts.tint = 0xffffffff;
      tintOpts.alpha = 0.4;
      r.sprite(`${VAN_ART}/body`, 0, x, y, tintOpts);
    }
    // The last third of a crew tell blinks a warm tint (the attack is coming).
    if ((this.mode === 'tell-throw' || this.mode === 'tell-shoot') && !this.dead && this.anim.id) {
      const T = telegraphTicks(this.world, VAN_AI.tell);
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) {
        tintOpts.tint = 0xff6040ff;
        tintOpts.alpha = 0.35;
        r.sprite(this.anim.id, this.anim.index, x, y, tintOpts);
      }
    }
  }
}

defineEntity(RING_ENTITY_B.parcelVan, (w, x, y, p) => new RingParcelVan(w, x, y, p), {
  category: 'enemy',
  score: VAN_AI.score,
  description: 'A parcel van ahead of the wagons: the rear doors open, a crew throws parcels or fires back; brake checks; a hostage behind a grille (params crew, brakeCheck, hostage, item, drop).',
});
