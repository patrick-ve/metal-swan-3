/**
 * `ring-scooter` — the scooter gang, the ring's first enemy (docs/design/ring.md §5.1, §9; GDD
 * §4.11 fairness). Two-up scooters in groups of 3–5 that come from behind or ahead (the plan gives
 * one entry per scooter with a shared `gang`, or one entry with `count`). They weave between the
 * lanes in front of the wagons; the pillion turns round on the seat and attacks backwards:
 *
 * - BOTTLE: `tell-throw` (≥ 18 ticks: he turns, raises a bottle) → `throw`: a bottle lobbed into
 *   the target wagon's lane (`RingBottle`): it flies over everything (its shadow runs along the road
 *   to the spot) and smashes where it lands — a thrown object, 1 cell to a wagon in that slab.
 * - PISTOL: only when it rides in the target's lane: `tell-shoot` (≥ 18 ticks: he turns, levels the
 *   pistol) → `shoot`: a bullet back along the lane (½ cell).
 * Attacks start only with the scooter fully on screen and an attack token (GDD §4.11), and a tell
 * that would carry it off screen is dropped. Light: two pistol shots. A swerve into it is the
 * wagon's SIDE RAM (wagon.ts: Damage tags 'ram' + 'side-ram'): the riders are knocked off. Bloodless:
 * on any death the riders tumble onto the hard shoulder and sit there dazed, the scooter slides on
 * its side and fades; `drop` falls as a `ring-crate`.
 * Reactions: the gloat (every player out) is a slow wheelie in place, no pointing, no laughing; the
 * cower when a hero drops back in; neither attacks.
 *
 * Params: `look` (0 … 2; default from `gang`), `gang` (a group id), `count` (this entry spawns a
 * group of that many), `index` (its place in the gang: staggers its spot and its first attack),
 * `pillion` ('bottle' | 'pistol': the pillion's only attack; a pistol pillion seeks the target's
 * lane; default both), `hp`, `drop` (a drop value for its crate).
 */
import { damageHas, Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { debris, dust, muzzleFlash } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, slabBoxes, slabCache, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { clampLane, DEPTH_HALF, LANE_COUNT, LANE_GAP, LANE_SPLIT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { drivenWagons, jamOf, nearestWagon, slabsTouch, tumbleOff, wagonSlab } from '../traffic/road-kit';
import { SCOOTER, SCOOTER_LOOKS } from './art';

export type ScooterMode = 'enter' | 'ride' | 'tell-throw' | 'throw' | 'tell-shoot' | 'shoot' | 'recover' | 'wobble' | 'leave';

/** Tuning (ticks, px, px/tick). */
export const SCOOTER_AI = {
  hp: 20,
  score: 200,
  /** Telegraph base (scaled by difficulty, never below 18). */
  tell: 26,
  /**
   * Attack interval base and jitter (a gang of 3–4 is on screen at once: keep it a hail, not a
   * wall). User play-test 2026-10-21 (too many enemies): 170 → 200.
   */
  every: 200,
  jitter: 40,
  /** First attack after it is in play. */
  firstDelay: 70,
  /** Where the bottle lands: the target's screen x ± this (it lands where the wagon was). */
  scatter: 28,
  throwTicks: 10,
  shootTicks: 10,
  recover: 24,
  /** Where it rides: this far ahead of its target on screen, and its screen band. */
  ahead: [70, 150] as const,
  minX: 110,
  maxX: 352,
  /** Screen speed limits (px/tick) and the lane change speed (px/tick). */
  rel: 1.4,
  laneSpeed: 0.75,
  /** Ticks between weaves (lane changes). */
  weave: [50, 110] as const,
  /** The bottle: flight ticks and arc height; the bullet's screen speed. */
  bottleTicks: 34,
  bottleArc: 30,
  bulletSpeed: 3.4,
  /** Height of the pillion's hand (his shots are drawn this high). */
  gunLift: 22,
  /**
   * Ticks in play before it speeds off ahead (`leave`; + `stayStep` per gang index, so a gang
   * thins out one by one), and its screen speed then. Integrator 2026-10-20: without it an
   * unshot gang stayed for good and gangs piled up (up to 20 scooters on screen).
   */
  stay: 300,
  stayStep: 30,
  leaveRel: 3,
  /** Depth half of its hurt slab while it filters between the lanes of a standing jam. */
  filterHalf: 12,
  /**
   * More riding scooters than this: the one in play longest leaves (the road stays readable).
   * User play-test 2026-10-21: 5 → 4.
   */
  crowd: 4,
} as const;

const NO_BOXES: readonly Rect[] = [];

export class RingScooter extends Enemy implements RingDrawable {
  mode: ScooterMode = 'enter';
  modeT = 0;
  readonly look: number;
  lift = 0;
  shadowW = 34;
  shotLift: number = SCOOTER_AI.gunLift;
  /** The attack token is held (fairness watcher). */
  holdsToken = false;
  laneTarget: number;
  private cool: number = SCOOTER_AI.firstDelay;
  private weaveT = 0;
  private dodgeT = 0;
  private prefDx = 100;
  private prey: Entity | null = null;
  private readonly group: number;
  /** The pillion's attacks (param `pillion`). */
  readonly throws: boolean;
  readonly shoots: boolean;
  private readonly index: number;
  private spawnedGroup = false;
  private readonly slab = slabCache();
  /** Ticks in 'ride' (its stay; see `SCOOTER_AI.stay`). */
  inPlay = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const gang = paramNum(p, 'gang', 0);
    const look = Math.max(0, Math.round(paramNum(p, 'look', Math.abs(Math.round(gang)) % SCOOTER_LOOKS.length))) % SCOOTER_LOOKS.length;
    super(world, x, y, p, { art: `ring/scooter/${look}`, hp: SCOOTER_AI.hp, body: false, w: SCOOTER.len, h: 46, soft: true, score: SCOOTER_AI.score });
    this.look = look;
    this.group = Math.max(1, Math.min(6, Math.round(paramNum(p, 'count', 1))));
    this.throws = p.pillion !== 'pistol';
    this.shoots = p.pillion !== 'bottle';
    this.index = Math.max(0, Math.round(paramNum(p, 'index', 0)));
    this.cool += this.index * 23;
    this.prefDx = SCOOTER_AI.ahead[0] + ((this.index * 37) % (SCOOTER_AI.ahead[1] - SCOOTER_AI.ahead[0]));
    this.laneTarget = nearestLane(y);
    this.y = laneY(this.laneTarget);
    this.facing = 1;
    this.addTag(RING_ENTITY.scooter, 'ring-small');
    this.play('ride');
  }

  override hurtboxes(): readonly Rect[] {
    if (this.dead) return NO_BOXES;
    // Between the lanes of a standing jam: a deeper slab, so shots along both lanes beside it hit.
    return this.filtering() ? slabBoxes(this, this.slab, SCOOTER_AI.filterHalf) : slabBoxes(this, this.slab);
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  private setMode(m: ScooterMode): void {
    this.mode = m;
    this.modeT = 0;
    const strip = m === 'enter' || m === 'recover' || m === 'leave' ? 'ride' : m;
    this.play(strip, { restart: m !== 'ride' && m !== 'enter' && m !== 'recover' && m !== 'wobble' });
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    this.modeT++;
    this.facing = 1;
    if (!this.spawnedGroup) this.spawnGroup();
    const cam = this.world.camera;
    const sx = this.x - cam.x;
    this.prey = nearestWagon(this.world, this.x, this.y);
    switch (this.mode) {
      case 'enter':
        if (sx > 24 && sx < cam.w - 24) {
          this.setMode('ride');
          this.world.audio.sfx('ring/scooter-whine');
        }
        break;
      case 'ride':
        // Its stay is over, or the road is crowded and it has been here longest: off ahead and
        // out of view (no score; the gang thins out).
        if (++this.inPlay >= SCOOTER_AI.stay + (this.index % 4) * SCOOTER_AI.stayStep || ((this.age + this.id) % 15 === 0 && this.crowded())) {
          this.setMode('leave');
          break;
        }
        this.weave();
        if (--this.cool <= 0) this.tryAttack();
        break;
      case 'leave':
        if (sx > cam.w + 40) this.remove();
        break;
      case 'tell-throw':
      case 'tell-shoot':
        if (!this.world.camera.containsPoint(this.x, this.y - 10, -(ATTACK_INSET - 6)) || !this.prey) this.cancelAttack();
        else if (this.modeT >= telegraphTicks(this.world, SCOOTER_AI.tell)) this.release();
        break;
      case 'throw':
      case 'shoot':
        if (this.modeT >= (this.mode === 'throw' ? SCOOTER_AI.throwTicks : SCOOTER_AI.shootTicks)) this.setMode('recover');
        break;
      case 'recover':
        if (this.modeT >= SCOOTER_AI.recover) this.endAttack();
        break;
      case 'wobble':
        if (this.modeT >= 20) this.setMode('ride');
        break;
    }
    this.drive(sx);
    this.touchWagons();
  }

  /** The rest of an entry's group (param `count`): spaced behind it, lanes alternating. */
  private spawnGroup(): void {
    this.spawnedGroup = true;
    const cam = this.world.camera;
    const behind = this.x < cam.x + cam.w / 2;
    for (let i = 1; i < this.group; i++) {
      const lane = clampLane(this.laneTarget + (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2), ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT);
      const x = this.x + (behind ? -1 : 1) * i * 46;
      this.world.spawn(RING_ENTITY.scooter, x, laneY(lane), { look: this.look, gang: this.params.gang ?? 0, count: 1 });
    }
  }

  /** Steer: hold a screen x ahead of the target, change lanes now and then (into free lanes). */
  private weave(): void {
    if (--this.weaveT > 0) return;
    const rng = this.world.rng;
    this.weaveT = rng.int(SCOOTER_AI.weave[0], SCOOTER_AI.weave[1]);
    this.prefDx = rng.int(SCOOTER_AI.ahead[0], SCOOTER_AI.ahead[1]);
    const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
    const cur = nearestLane(this.y, 1, open);
    const t = this.prey;
    // Sometimes into the target's lane (the pistol: a pistol-only pillion seeks it), else a free
    // neighbour lane.
    const seek = this.shoots && (!this.throws || rng.chance(0.4));
    const want = t && seek ? nearestLane(t.y, 1, open) : clampLane(cur + (rng.chance(0.5) ? 1 : -1), open);
    if (!this.laneBlocked(want)) this.laneTarget = want;
  }

  /** A car, a closure or another scooter beside it in that lane? */
  private laneBlocked(lane: number): boolean {
    const y = laneY(lane);
    for (let k = 0; k < LANE_BLOCK_TAGS.length; k++) {
      const list = this.world.byTag(LANE_BLOCK_TAGS[k]);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === this || !e.alive || Math.abs(e.y - y) > 8) continue;
        const x0 = e.facing < 0 ? e.x - e.hitbox.x - e.hitbox.w : e.x + e.hitbox.x;
        if (this.x + 30 > x0 && this.x - 30 < x0 + e.hitbox.w) return true;
      }
    }
    return false;
  }

  /** Motion: road speed + a screen speed toward its spot; the lane toward its target. */
  private drive(sx: number): void {
    const ring = ringOf(this.world);
    const road = ring?.roadSpeed ?? 0;
    const cam = this.world.camera;
    let rel: number;
    if (this.mode === 'enter') rel = this.waiting(sx) ? 0 : sx < cam.w / 2 ? 1.6 : -1.3;
    else if (this.mode === 'leave') rel = SCOOTER_AI.leaveRel;
    else {
      const t = this.prey;
      const tx = t ? t.x - cam.x + this.prefDx : 250;
      const want = Math.max(SCOOTER_AI.minX, Math.min(SCOOTER_AI.maxX, tx));
      const attacking = this.mode !== 'ride' && this.mode !== 'wobble';
      rel = Math.max(-SCOOTER_AI.rel, Math.min(SCOOTER_AI.rel, (want - sx) * (attacking ? 0.01 : 0.03)));
      rel += Math.sin((this.age + this.id * 17) * 0.05) * 0.15;
    }
    // A standing jam: it filters between the lanes (on a lane split line, past the stopped cars).
    const filter = this.filtering();
    if (!filter && this.blockedAhead()) {
      rel = Math.min(rel, -0.4);
      // Nimble: out into a free neighbour lane (not during an attack: it holds its lane then; a
      // leaving one too, else it sat behind a car at the right edge).
      if ((this.mode === 'ride' || this.mode === 'enter' || this.mode === 'leave') && --this.dodgeT <= 0) {
        this.dodgeT = 16;
        const open = ring?.lanesOpenAt(this.x) ?? LANE_COUNT;
        const cur = nearestLane(this.y, 1, open);
        const first = this.world.rng.chance(0.5) ? -1 : 1;
        for (let k = 0; k < 2; k++) {
          const l = cur + (k === 0 ? first : -first);
          if (l >= 1 && l <= open && !this.laneBlocked(l)) {
            this.laneTarget = l;
            break;
          }
        }
      }
    }
    rel += this.separation();
    this.vx = road + rel;
    this.x += this.vx;
    // The lane (held while attacking).
    const open = ring?.lanesOpenAt(this.x) ?? LANE_COUNT;
    this.laneTarget = clampLane(this.laneTarget, open);
    const ty = filter ? filterY(this.laneTarget) : laneY(this.laneTarget);
    const dy = ty - this.y;
    const step = this.mode === 'wobble' ? LANE_GAP / 14 : SCOOTER_AI.laneSpeed;
    this.y += Math.abs(dy) <= step ? dy : Math.sign(dy) * step;
  }

  /**
   * More than `SCOOTER_AI.crowd` scooters are in play (riding, attacking, or entering on screen)
   * and this riding one is among the surplus that has been in play longest: it leaves. Every
   * scooter checks every 15 ticks, so the whole surplus goes within one check window (fix
   * 2026-10-21: 'enter' did not count and one left per check, so an idle player saw 8–12).
   */
  private crowded(): boolean {
    const list = this.world.byTag(RING_ENTITY.scooter);
    const cam = this.world.camera;
    let count = 0;
    let older = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!(e instanceof RingScooter) || !e.alive || e.dead || e.mode === 'leave') continue;
      if (e.mode === 'enter' && (e.x < cam.x || e.x > cam.right)) continue;
      count++;
      if (e !== this && e.mode === 'ride' && (e.inPlay > this.inPlay || (e.inPlay === this.inPlay && e.id < this.id))) older++;
    }
    return older < count - SCOOTER_AI.crowd;
  }

  /**
   * Still off screen while `SCOOTER_AI.crowd` scooters are on screen (any mode) or come in before
   * it: it waits there at the road's pace and comes in when one has gone (fix 2026-10-21: gangs
   * entered on top of the riders and an idle player saw 8–12 scooters).
   */
  private waiting(sx: number): boolean {
    const half = SCOOTER.len / 2;
    const w = this.world.camera.w;
    if (sx + half > 0 && sx - half < w) return false;
    const list = this.world.byTag(RING_ENTITY.scooter);
    let seen = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || (e instanceof RingScooter && e.dead)) continue;
      const ex = e.x - this.world.camera.x;
      if (ex + half > 0 && ex - half < w) seen++;
      // An earlier scooter that waits off screen too comes in first (one at a time, in order).
      else if (e instanceof RingScooter && e.mode === 'enter' && e.id < this.id) seen++;
    }
    return seen >= SCOOTER_AI.crowd;
  }

  /**
   * In a jam it rides between the lanes (not while it wobbles) — as long as the queue's cars are
   * parked (jam level over 0.05, traffic/car.ts `jamRel`), so also while the jam clears
   * (integrator, wave B: at the old ½ mark a new gang sat off screen behind the parked queue for
   * 5 s).
   */
  private filtering(): boolean {
    return this.mode !== 'wobble' && jamOf(this.world).level > 0.05;
  }

  /** Keep apart from the gang in the same lane: the one behind eases off, the one ahead pulls away. */
  private separation(): number {
    const list = this.world.byTag(RING_ENTITY.scooter);
    let push = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || Math.abs(e.y - this.y) > 12) continue;
      const dx = this.x - e.x;
      if (Math.abs(dx) >= 46) continue;
      push += (dx >= 0 ? 1 : -1) * 0.35 * (1 - Math.abs(dx) / 46) + (dx === 0 ? (this.id % 2 ? 0.2 : -0.2) : 0);
    }
    return Math.max(-0.6, Math.min(0.6, push));
  }

  /** Something in its lane just ahead (a car, a closure, a wagon): it slows down. */
  private blockedAhead(): boolean {
    for (let k = 0; k < AHEAD_TAGS.length; k++) {
      const list = this.world.byTag(AHEAD_TAGS[k]);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || Math.abs(e.y - this.y) > 10) continue;
        const rear = e.x + e.hitbox.x;
        if (rear > this.x && rear - this.x < SCOOTER.len / 2 + 14) return true;
      }
    }
    return false;
  }

  /** A wagon drove into it without a swerve: it wobbles away into another lane (no harm). */
  private touchWagons(): void {
    if (this.mode === 'wobble') return;
    const mine = this.hurtboxes()[0];
    if (!mine) return;
    // Filtering on a lane split line in a standing jam it passes the wagons in the lanes beside it
    // (its deeper hurt slab is for shots only); only a wagon on its line (a lane change) touches it.
    // Fix 2026-10-21: a jam-wave scooter got stuck behind a wagon off screen (touch → wobble → ride).
    const filter = this.filtering();
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.swerveT > 0 || !slabsTouch(wagonSlab(w), mine)) continue;
      if (filter && Math.abs(w.y - this.y) >= DEPTH_HALF) continue;
      this.cancelAttack();
      this.setMode('wobble');
      const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? LANE_COUNT;
      const away = w.y >= this.y ? -1 : 1;
      const lane = clampLane(nearestLane(this.y) + away, open);
      this.laneTarget = lane === nearestLane(this.y) ? clampLane(lane - away, open) : lane;
      this.x += w.x < this.x ? 3 : -3;
      this.world.audio.sfx('ring/scooter-honk');
      return;
    }
  }

  // ------------------------------------------------------------------------------- attacks

  private tryAttack(): void {
    const t = this.prey;
    // The whole rider in view: the middle at least `ATTACK_INSET` px inside (its hand and the
    // bottle or the muzzle flash start on screen; GDD §4.11: no attack from off screen).
    if (!t || !this.world.camera.containsPoint(this.x, this.y - 10, -ATTACK_INSET) || this.reacting) {
      this.cool = 20;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 30;
      return;
    }
    const sameLane = Math.abs(t.y - this.y) < 6 && this.x > t.x + 40;
    const shoot = this.shoots && (sameLane || !this.throws);
    if (shoot && !sameLane) {
      // A pistol-only pillion waits for the target's lane.
      releaseAttackToken(this.world, this);
      this.cool = 20;
      this.weaveT = 0;
      return;
    }
    this.holdsToken = true;
    this.setMode(shoot ? 'tell-shoot' : 'tell-throw');
    this.world.audio.sfx(shoot ? 'ring/pistol-cock' : 'ring/bottle-tell');
  }

  /** The tell is over: the bottle leaves, or the shot. */
  private release(): void {
    const t = this.prey;
    if (!t) {
      this.cancelAttack();
      return;
    }
    if (this.mode === 'tell-throw') {
      this.setMode('throw');
      this.throwBottle(t);
    } else {
      this.setMode('shoot');
      this.firePistol();
    }
  }

  private throwBottle(t: Entity): void {
    const cam = this.world.camera;
    const hand = this.point('hand', -10, -34);
    const T = SCOOTER_AI.bottleTicks;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    // Aim at the target's lane, where its middle will be on screen (it holds its screen x).
    const landSx = t.x - cam.x + this.world.rng.range(-SCOOTER_AI.scatter, SCOOTER_AI.scatter);
    const b = new RingBottle(this.world, this.x - 8, this.y, {
      lift: this.y - hand[1],
      ty: laneY(nearestLane(t.y)),
      vx: road + (landSx - (this.x - 8 - cam.x)) / T,
      ticks: T,
      arc: SCOOTER_AI.bottleArc,
    });
    this.world.add(b);
    this.world.audio.sfx('ring/throw');
  }

  private firePistol(): void {
    const m = this.point('muzzle', -18, -24);
    const p = this.shoot({ speed: SCOOTER_AI.bulletSpeed, damage: 10, sprite: 'weapon/enemy-bullet', angle: Math.PI, x: m[0], y: this.y, life: 150, kind: 'bullet' });
    // The bullet moves with the road (its screen speed is the shot's own).
    p.vx += ringOf(this.world)?.roadSpeed ?? 0;
    muzzleFlash(this.world, m[0], m[1], Math.PI, { kind: 'pistol' });
    this.world.audio.sfx('enemy/shot');
  }

  private cancelAttack(): void {
    if (this.mode === 'tell-throw' || this.mode === 'tell-shoot' || this.mode === 'throw' || this.mode === 'shoot' || this.mode === 'recover') this.endAttack(40);
  }

  private endAttack(cool?: number): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.cool = cool ?? this.fireInterval(SCOOTER_AI.every, SCOOTER_AI.jitter);
    if (this.mode !== 'wobble') this.setMode('ride');
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(_kind: ReactionKind): void {
    this.cancelAttack();
  }

  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'gloat') super.thinkReaction(kind);
    else this.play(this.reactionAnim(kind));
    this.facing = 1;
    // Hold its place on screen (the road holds while everyone is out).
    this.vx = ringOf(this.world)?.roadSpeed ?? 0;
    this.x += this.vx;
  }

  /** The gloat: slow wheelies in place (no pointing, no laughing). */
  protected override thinkGloat(): void {
    this.play(this.reactionAnim('gloat'));
  }

  // ------------------------------------------------------------------------------- death

  /** A swerve into it (the side ram) or anything that kills it: the riders are knocked off. */
  protected override onDeath(d: Damage): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    const ram = damageHas(d, 'side-ram') || damageHas(d, 'ram');
    const blast = d.kind === 'explosion';
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const dir = d.dirX || 1;
    const shoulder = SHOULDER_TOP + 5;
    const pre = this.art;
    const fling = (who: 'driver' | 'pillion', dx: number, k: number): void => {
      tumbleOff(this.world, this.x + dx, this.y, {
        sprite: `${pre}/${who}-tumble`,
        restSprite: `${pre}/${who}-sit`,
        vx: road * 0.5 + dir * (ram ? 1.2 : 0.6) + k * 0.3,
        vy: Math.max(0.6, (shoulder - this.y) / 28),
        lift: 16,
        vlift: blast ? 3.4 : ram ? 2.6 : 2,
        bounces: 1,
        rest: 70,
        tpf: 4,
        shoulder: true,
        shadowW: 14,
        z: 34,
      });
    };
    fling('driver', 2, 0);
    fling('pillion', -8, 1);
    tumbleOff(this.world, this.x, this.y, { sprite: `${pre}/down`, vx: road * 0.7, vy: 0, lift: 0, vlift: blast ? 1.6 : 0.8, bounces: 0, rest: 50, restFrame: 2, tpf: 6, shadowW: 30, z: 31 });
    dust(this.world, this.x, this.y, 5);
    if (blast) debris(this.world, this.x, this.y - 10, 'metal', 4);
    this.world.audio.sfx(ram ? 'ring/scooter-crash' : 'ring/scooter-down');
    this.remove();
  }

  /** The drop falls as a ring crate. */
  protected override dropItem(): void {
    const spec = this.drop;
    if (!spec) return;
    this.drop = null;
    const value = spec.id === 'loot' ? spec.params?.contains ?? 'auto' : spec.id === RING_ENTITY.crate ? spec.params?.contains : spec;
    this.world.spawn(RING_ENTITY.crate, this.x, this.y, { contains: value, dropped: true, vx: (ringOf(this.world)?.roadSpeed ?? 0) * 0.5, lift: 14, vlift: 2.4 });
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    // The last third of a tell blinks a warm tint (the attack is coming).
    if ((this.mode === 'tell-throw' || this.mode === 'tell-shoot') && !this.dead) {
      const T = telegraphTicks(this.world, SCOOTER_AI.tell);
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) this.drawTint(r, 0xff6040ff, 0.35);
    }
  }
}

/** Options of a thrown bottle. */
export interface BottleOpts {
  /** Start lift (px over the road), the target plane y, world vx, flight ticks, arc height. */
  lift: number;
  ty: number;
  vx: number;
  ticks: number;
  arc: number;
}

/**
 * A bottle lobbed into a lane: it flies over everything in the plane (it is not a shot: nothing
 * stops it), its shadow runs along the road to the landing spot, and it smashes there — the blast
 * slab hurts the wagons in that lane (a thrown object: 1 cell).
 */
/**
 * The line a scooter filters on in a standing jam: the lane split between lanes 2 and 3 for the far
 * lanes, between 3 and 4 for the near ones (more than 10 px from every lane's feet line, so the
 * stopped cars and wagons never block it).
 */
function filterY(lane: number): number {
  return lane <= 2 ? LANE_SPLIT[1] : LANE_SPLIT[2];
}

/** An attack starts only with the scooter's middle this far inside the view (px). */
const ATTACK_INSET = 22;
/**
 * What blocks a lane beside it (`laneBlocked`) and its lane just ahead (`blockedAhead`). The
 * wave-B vehicles (`ring-block`: vans, caravans, the scan car, the tow truck, the lorry;
 * `ring-big`: the road-works truck) count too (review B: scooters rode through the tow truck's cab
 * and piled up over the road-works crew).
 */
const LANE_BLOCK_TAGS: readonly string[] = ['ring-car', 'ring-closure', 'ring-block', 'ring-big', RING_ENTITY.scooter];
const AHEAD_TAGS: readonly string[] = ['ring-car', 'ring-closure', 'ring-wagon', 'ring-block', 'ring-big'];

export class RingBottle extends Entity implements RingDrawable {
  lift: number;
  shadowW = 8;
  private readonly lift0: number;
  private readonly y0: number;
  private readonly o: BottleOpts;
  private t = 0;

  constructor(world: World, x: number, y: number, o: BottleOpts) {
    super(world, x, y);
    this.o = o;
    this.lift = this.lift0 = o.lift;
    this.y0 = y;
    this.vx = o.vx;
    this.team = 'enemy';
    this.z = 52;
    this.hitbox = { x: -4, y: -8, w: 8, h: 8 };
    this.despawnMargin = 64;
    this.addTag('ring-bottle');
  }

  /** Where and when it lands (the bot reads them): the plane y, the world x, ticks left. */
  get landY(): number {
    return this.o.ty;
  }

  get landX(): number {
    return this.x + this.vx * (this.o.ticks - this.t);
  }

  get ticksLeft(): number {
    return this.o.ticks - this.t;
  }

  override update(): void {
    this.t++;
    const T = this.o.ticks;
    const k = Math.min(1, this.t / T);
    this.x += this.vx;
    this.y = this.y0 + (this.o.ty - this.y0) * k;
    this.lift = Math.max(0, this.lift0 * (1 - k) + Math.sin(k * Math.PI) * this.o.arc);
    if (this.t >= T) this.smash();
  }

  private smash(): void {
    const w = this.world;
    w.damageArea({ x: this.x - 10, y: this.y - 7, w: 20, h: 14 }, { amount: 1, kind: 'impact', dirX: -1, source: this, tags: ['thrown'] }, 'enemy');
    debris(w, this.x, this.y - 2, 'glass', 6);
    w.audio.sfx('ring/bottle');
    this.remove();
  }

  override draw(r: Renderer): void {
    const f = Math.floor(this.t / 3) & 7;
    r.sprite('ring/scooter/bottle', f, Math.round(this.x), Math.round(this.y - this.lift));
  }
}

defineEntity(RING_ENTITY.scooter, (w, x, y, p) => new RingScooter(w, x, y, p), {
  category: 'enemy',
  score: SCOOTER_AI.score,
  description: 'A two-up scooter of the gang: weaves, the pillion lobs bottles into your lane or fires a pistol along it (params look, gang, count, drop).',
});
