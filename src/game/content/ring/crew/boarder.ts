/**
 * `ring-boarder` — the jam boarders (docs/design/ring.md §5 last paragraph, §7.2; GDD §4.11).
 *
 * In a STANDING jam only (`jamOf(world).level > ½`), foot enemies from `ams` — handhavers (three
 * skins) and stag partiers (four looks) — run between the stopped cars along the lane splits (the
 * lines between the lanes, clear of the cars) to a wagon's bonnet:
 *
 * 1. `run`: to the bonnet of the nearest wagon, on the split beside its lane (the near one; lane 4:
 *    the far one).
 * 2. `tell-hop` (≥ 18 ticks on screen, with an attack token: he crouches, the arms swung back),
 *    then `hop`: up and over to where the bonnet was at the release (on screen); the bonnet out of
 *    reach there — the wagon changed lanes or moved on — he lands on the road and runs again.
 * 3. On the bonnet (`perch`), kneeling and facing the windscreen: `tell-hit` (≥ 18 ticks: the fist /
 *    the bottle right up) → `hit`: ½ cell to the wagon per swing. The driver says `boarder`.
 *    He stays until the hero knifes him (FIRE at close range: the bonnet is in the knife box,
 *    `RingHero.knifeBoxes`), a shot or a blast takes him off, or a swerve shakes him off (a kill).
 * Bloodless: a boarder taken off tumbles onto the hard shoulder and sits there dazed.
 * The jam clears (its level ≤ ½): a boarder on foot runs for the hard shoulder and is left behind;
 * one on a bonnet jumps off first (no score). A wrecked wagon throws its boarder off (on foot).
 * Reactions: the gloat (every player out) is the ams one — the handhaver writes a fine at the spot
 * (`VLUCHTSTROOK? BOETE!`, the page flutters onto it), the stag partier takes a selfie with his back
 * to it (`JAM SELFIE! #A10`, a flash); never a point or a laugh. The cower: the ams cower strips.
 *
 * Params: `look` ('handhaver' | 'stag', or a set number 0 … 6 of `BOARDER_SETS`; default by its id),
 * `index` (its place in the wave: staggers its first attack and picks the skin), `hp`, `drop`,
 * `wait` (ticks it may wait, hidden, for a jam to stand before it gives up; default 0: it leaves at
 * once outside a standing jam — the jam controller spawns its waves only while it stands).
 * From the jam controller's `waves` (hazards/jam.ts): `{ id: 'ring-boarder', from: 'ahead' |
 * 'behind', dx, lane, params: { look, index } }`.
 */
import { damageHas, type Damage, type Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, telegraphTicks, type ReactionKind } from '../../../enemy';
import { dust, FxEntity, hitSpark } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, slabBoxes, slabCache, type RingDrawable } from '../../../ring/entity';
import { LANE_COUNT, LANE_SPLIT, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { GLOAT_FRAME, HANDHAVER } from '../../locals/handhaver';
import { STAG } from '../../stag/partier';
import { drivenWagons, jamOf, tumbleOff, wagonSlot } from '../traffic/road-kit';
import { BOARDER_SETS, boarderArt, BONNET } from './geometry';

/** The boarder's entity id. */
export const RING_BOARDER = 'ring-boarder';

export type BoarderMode = 'wait' | 'run' | 'tell-hop' | 'hop' | 'perch' | 'tell-hit' | 'hit' | 'recover' | 'flee';

/** Tuning (ticks, px, px/tick). */
export const BOARDER = {
  hp: 20,
  score: 300,
  /** Run speed on screen (x) and across the lanes (y). */
  run: 1.3,
  cross: 0.8,
  /** He starts the hop tell this close (x) to the bonnet, on his split line. */
  near: 8,
  /** Hop tell base (difficulty-scaled, never below 18) and the hop's length and height. */
  tellHop: 26,
  hop: 16,
  hopArc: 14,
  /** The tell is dropped when the wagon gets this far away (x) or changes lanes. */
  lose: 30,
  /** On the bonnet: settle, swing interval and jitter, swing tell base, the swing and its recover. */
  settle: 24,
  every: 70,
  jitter: 20,
  tellHit: 24,
  hitTicks: 10,
  recover: 16,
  /** Damage of a swing (Damage tag `bump-light`: ½ cell to a wagon). */
  swing: 1,
  /** The first attack after he is on screen (+ 23 per wave index). */
  firstDelay: 40,
  /** The jam level he needs (a standing jam). */
  jam: 0.5,
  /** Where a boarder waits while another has the bonnet: this far in front of the bonnet spot. */
  queueDx: 44,
  /** Off-screen margin of the walk-in point when he enters from a wait. */
  enterMargin: 20,
} as const;

/** An attack (the hop, a swing) starts only with his middle this far inside the view (px). */
const ATTACK_INSET = 20;
const NO_BOXES: readonly Rect[] = [];
const drawOpts: DrawOpts = {};
const HANDHAVER_SETS = [0, 1, 2] as const;
const STAG_SETS = [3, 4, 5, 6] as const;

/** The boarder set of the `look` param (see the header). */
function setOf(p: SpawnParams, id: number): number {
  const look = p.look;
  const index = Math.max(0, Math.round(paramNum(p, 'index', id)));
  if (typeof look === 'number' && look >= 0 && look < BOARDER_SETS.length) return Math.floor(look);
  if (look === 'handhaver') return HANDHAVER_SETS[index % HANDHAVER_SETS.length];
  if (look === 'stag') return STAG_SETS[index % STAG_SETS.length];
  return (index * 3 + id) % BOARDER_SETS.length;
}

export class RingBoarder extends Enemy implements RingDrawable {
  mode: BoarderMode = 'run';
  modeT = 0;
  lift = 0;
  shadowW = 12;
  holdsToken = false;
  readonly set: number;
  readonly kind: 'handhaver' | 'stag';
  /** The wagon he rides (perch, tell-hit, hit, recover) or hops at. */
  wagon: Wagon | null = null;
  private cool: number;
  private waitLeft: number;
  private readonly slab = slabCache();
  // The hop: its start point.
  private hx0 = 0;
  private hy0 = 0;
  /** The hop's goal: the bonnet's screen x and plane y at the release. */
  private htx = 0;
  private hty = 0;
  // The gloat.
  private gloatPhase: 'walk' | 'write' | 'tear' | 'drop' | 'done' = 'walk';
  private gloatPhaseT = 0;
  private gloatGoal = 0;
  private fleeY = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const set = setOf(p, 0);
    super(world, x, y, p, { art: boarderArt(set), hp: BOARDER.hp, body: false, soft: true, w: 14, h: 34, score: BOARDER.score });
    // A default look varies with the entity id (the id is known only after super).
    this.set = p.look === undefined && p.index === undefined ? setOf(p, this.id) : set;
    this.art = boarderArt(this.set);
    this.kind = BOARDER_SETS[this.set].kind;
    this.cool = BOARDER.firstDelay + Math.max(0, Math.round(paramNum(p, 'index', 0))) * 23;
    this.waitLeft = Math.max(0, Math.round(paramNum(p, 'wait', 0)));
    this.z = 36;
    this.y = splitNear(y);
    this.despawnMargin = 96;
    this.addTag(RING_BOARDER, 'ring-small');
    this.play('run');
    if (!standing(world)) this.mode = 'wait';
  }

  override hurtboxes(): readonly Rect[] {
    return this.dead || this.mode === 'wait' ? NO_BOXES : slabBoxes(this, this.slab);
  }

  override update(): void {
    super.update();
    // The visual box rides up with him onto the bonnet (bubbles, the view checks).
    this.hitbox.y = -34 - this.lift;
    this.hitbox.h = 34 + this.lift;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  /** On a wagon (the bonnet)? */
  get aboard(): boolean {
    return this.mode === 'perch' || this.mode === 'tell-hit' || this.mode === 'hit' || this.mode === 'recover';
  }

  private setMode(m: BoarderMode): void {
    this.mode = m;
    this.modeT = 0;
    switch (m) {
      case 'run':
      case 'flee':
        this.play('run');
        break;
      case 'tell-hop':
        this.play('crouch', { restart: true });
        break;
      case 'hop':
        this.play('hop', { restart: true });
        break;
      case 'tell-hit':
        this.play('tell-hit', { restart: true });
        break;
      case 'hit':
        this.play('hit', { restart: true });
        break;
      case 'perch':
        this.play('perch');
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    this.modeT++;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    if (this.mode === 'wait') {
      this.waitTick(road);
      return;
    }
    // The jam is over: off to the hard shoulder (a rider on a bonnet jumps off first).
    if (!standing(this.world) && this.mode !== 'flee') {
      this.endAttack();
      if (this.aboard) this.jumpOff(false);
      this.fleeY = SHOULDER_TOP + 4;
      this.setMode('flee');
    }
    if (this.aboard || this.mode === 'hop') {
      this.ride();
      return;
    }
    this.lift = 0;
    switch (this.mode) {
      case 'run':
        this.runTo(road);
        break;
      case 'tell-hop':
        this.tellHop(road);
        break;
      case 'flee':
        this.flee(road);
        break;
      default:
        break;
    }
  }

  /** Hidden, waiting for a standing jam (param `wait`); then he comes in from the nearer edge. */
  private waitTick(road: number): void {
    this.vx = road;
    this.x += road;
    if (standing(this.world)) {
      const cam = this.world.camera;
      const fromLeft = this.x < cam.x + cam.w / 2;
      this.x = fromLeft ? cam.x - BOARDER.enterMargin : cam.right + BOARDER.enterMargin;
      this.setMode('run');
      return;
    }
    if (--this.waitLeft <= 0) this.remove();
  }

  /** Run along the split beside the target wagon's lane to its bonnet; there, the hop's tell. */
  private runTo(road: number): void {
    const w = this.pickWagon();
    if (!w) {
      this.vx = road;
      this.x += road;
      this.play('idle');
      return;
    }
    // Another boarder has that bonnet: he waits his turn in front of the nose.
    const queue = bonnetTaken(w, this);
    const tx = w.x + BONNET.x + (queue ? BOARDER.queueDx : 0);
    const ty = splitBeside(w);
    const dx = tx - this.x;
    const dy = ty - this.y;
    // Across the lanes first when far off his line, then along it.
    const sx = Math.abs(dx) < 2 ? 0 : Math.sign(dx) * Math.min(BOARDER.run, Math.abs(dx));
    this.vx = road + sx;
    this.x += this.vx;
    this.y += Math.abs(dy) <= BOARDER.cross ? dy : Math.sign(dy) * BOARDER.cross;
    if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 1) {
      this.play('idle');
      this.facing = w.x + BONNET.x > this.x ? 1 : -1;
    } else this.play('run');
    if (--this.cool <= 0 && !queue && Math.abs(dx) < BOARDER.near && Math.abs(dy) < 2) this.tryHop(w);
    else if (this.cool < 0) this.cool = 0;
  }

  /** The wagon he goes for: the nearest one with a free bonnet, else the nearest one. */
  private pickWagon(): Wagon | null {
    const list = drivenWagons(this.world);
    let best: Wagon | null = null;
    let bd = Infinity;
    for (let pass = 0; pass < 2 && !best; pass++) {
      for (let i = 0; i < list.length; i++) {
        const w = list[i];
        if (pass === 0 && bonnetTaken(w, this)) continue;
        const d = Math.abs(w.x + BONNET.x - this.x) + Math.abs(w.y - this.y) * 3;
        if (d < bd) {
          bd = d;
          best = w;
        }
      }
    }
    return best;
  }

  private tryHop(w: Wagon): void {
    if (this.reacting || !this.inView(ATTACK_INSET)) {
      this.cool = 10;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 20;
      return;
    }
    this.holdsToken = true;
    this.wagon = w;
    this.facing = w.x + BONNET.x >= this.x ? 1 : -1;
    this.setMode('tell-hop');
    this.world.audio.sfx('ring/crew-hop-tell');
  }

  /** Crouched, ready to hop: the hop goes when the tell is over (dropped when the wagon got away). */
  private tellHop(road: number): void {
    const w = this.wagon;
    this.vx = road;
    this.x += road;
    if (!w || !isDriven(w) || Math.abs(w.x + BONNET.x - this.x) > BOARDER.lose || Math.abs(splitBeside(w) - this.y) > 4 || !this.inView(ATTACK_INSET - 6)) {
      this.endAttack(30);
      this.setMode('run');
      return;
    }
    if (this.modeT >= telegraphTicks(this.world, BOARDER.tellHop)) {
      // The hop goes for the bonnet where it is now (on screen): a lane change or a quick move
      // during the hop makes him miss.
      const cx = this.world.camera.x;
      this.hx0 = this.x - cx;
      this.hy0 = this.y;
      this.htx = w.x + BONNET.x - cx;
      this.hty = w.y;
      this.setMode('hop');
      this.world.audio.sfx('ring/crew-hop');
    }
  }

  /** On the hop, and on the bonnet: he goes where the bonnet goes. */
  private ride(): void {
    const w = this.wagon;
    if (this.mode === 'hop') {
      const T = BOARDER.hop;
      const k = Math.min(1, this.modeT / T);
      const cam = this.world.camera;
      const px = this.x;
      this.x = cam.x + this.hx0 + (this.htx - this.hx0) * k;
      this.y = this.hy0 + (this.hty - this.hy0) * k;
      this.vx = this.x - px;
      this.lift = BONNET.lift * k + Math.sin(k * Math.PI) * BOARDER.hopArc;
      this.anim.index = k < 0.5 ? 0 : 1;
      if (this.modeT >= T) this.land();
      return;
    }
    if (!w || !isDriven(w)) {
      // The wagon is wrecked or gone: he jumps off onto the road.
      this.jumpOff(true);
      return;
    }
    if (w.swerveT > 0) {
      // A swerve shakes him off (the player's doing: a kill).
      this.world.damage(this, { amount: this.hp, kind: 'impact', dirX: 1, source: w, owner: wagonSlot(w), tags: ['ram', 'side-ram'] });
      return;
    }
    this.x = w.x + BONNET.x;
    this.y = w.y;
    this.vx = w.vx;
    this.lift = BONNET.lift;
    this.facing = -1;
    switch (this.mode) {
      case 'perch':
        if (--this.cool <= 0) this.trySwing();
        break;
      case 'tell-hit':
        if (this.modeT >= telegraphTicks(this.world, BOARDER.tellHit)) {
          this.setMode('hit');
          this.swing(w);
        }
        break;
      case 'hit':
        if (this.modeT >= BOARDER.hitTicks) this.setMode('recover');
        break;
      case 'recover':
        if (this.modeT >= BOARDER.recover) {
          this.endAttack();
          this.setMode('perch');
        }
        break;
      default:
        break;
    }
  }

  /** The hop's end: on the bonnet when it is still in reach, else on the road. */
  private land(): void {
    const w = this.wagon;
    if (w && isDriven(w) && Math.abs(w.x + BONNET.x - this.x) < BONNET.reach && Math.abs(w.y - this.y) < 6) {
      this.endAttack(BOARDER.settle);
      this.setMode('perch');
      this.x = w.x + BONNET.x;
      this.y = w.y;
      this.lift = BONNET.lift;
      this.world.audio.sfx('ring/crew-boot');
      this.world.camera.shake(1, 4);
      w.driverMood('brace', 24);
      w.say('boarder');
      return;
    }
    this.endAttack(30);
    this.wagon = null;
    this.lift = 0;
    this.y = splitNear(this.y);
    dust(this.world, this.x, this.y, 2);
    this.setMode('run');
  }

  private trySwing(): void {
    if (this.reacting || !this.inView(ATTACK_INSET)) {
      this.cool = 10;
      return;
    }
    if (!takeAttackToken(this.world, this)) {
      this.cool = 20;
      return;
    }
    this.holdsToken = true;
    this.setMode('tell-hit');
    this.world.audio.sfx('ring/crew-swing-tell');
  }

  /** The slam onto the glass: ½ cell to the wagon (Damage tag `bump-light`). */
  private swing(w: Wagon): void {
    this.world.damage(w, { amount: BOARDER.swing, kind: 'impact', dirX: -1, source: this, tags: ['bump-light', 'melee'] });
    hitSpark(this.world, w.x + 21, w.y - 22, -1);
    this.world.audio.sfx('ring/crew-boot');
    this.world.camera.shake(1, 3);
  }

  /** Off the bonnet onto the road beside it (on his split line); `run` again or flee. */
  private jumpOff(toRun: boolean): void {
    this.endAttack();
    this.wagon = null;
    this.lift = 0;
    this.y = splitNear(this.y + 11);
    dust(this.world, this.x, this.y, 2);
    this.world.audio.sfx('ring/crew-hop');
    if (toRun) this.setMode('run');
  }

  private flee(road: number): void {
    const dy = this.fleeY - this.y;
    this.y += Math.abs(dy) <= BOARDER.cross ? dy : Math.sign(dy) * BOARDER.cross;
    // On the hard shoulder he stops (the traffic takes the wagons away from him).
    const moving = Math.abs(dy) > 0.5;
    this.vx = moving ? road - 0.4 : 0;
    this.x += this.vx;
    this.play(moving ? 'run' : 'idle');
    if (this.x < this.world.camera.x - 40) this.remove();
  }

  /** His middle at least `inset` px inside the view. */
  private inView(inset: number): boolean {
    return this.world.camera.containsPoint(this.x, this.y - this.lift - 16, -inset);
  }

  private endAttack(cool?: number): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.cool = cool ?? this.fireInterval(BOARDER.every, BOARDER.jitter);
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(kind: ReactionKind): void {
    if (this.mode === 'tell-hop') this.setMode('run');
    else if (this.mode === 'tell-hit' || this.mode === 'hit' || this.mode === 'recover') this.setMode('perch');
    if (this.mode === 'hop') this.land();
    this.endAttack(40);
    if (kind === 'gloat') this.gloatPhase = 'walk';
  }

  protected override thinkReaction(kind: ReactionKind): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    if (this.mode === 'wait') {
      this.waitTick(road);
      return;
    }
    if (this.aboard) {
      const w = this.wagon;
      if (!w || !isDriven(w)) this.jumpOff(true);
      else {
        this.x = w.x + BONNET.x;
        this.y = w.y;
        this.vx = w.vx;
      }
    } else {
      this.vx = road;
      this.x += road;
    }
    if (kind === 'gloat') {
      super.thinkReaction(kind);
      return;
    }
    // The cower (and any other reaction): the ams set's strip, in place.
    const set = BOARDER_SETS[this.set].set;
    this.anim.play(kind === 'cower' ? `enemy/${set}/cower` : `${this.art}/idle`);
  }

  protected override onGloatStart(spot: Entity | null): void {
    this.gloatPhase = 'walk';
    this.gloatPhaseT = 0;
    const reach = HANDHAVER.gloatWalk;
    const stand = HANDHAVER.gloatStand;
    const sx = spot ? spot.x : this.x;
    const goal = sx + (this.x < sx ? -stand : stand);
    this.gloatGoal = Math.max(this.x - reach, Math.min(this.x + reach, goal));
  }

  /**
   * The gloat (every player out): the handhaver walks up, writes the fine, tears the page off and
   * lets it flutter onto the spot; the partier takes a selfie with his back to it. One line each.
   */
  protected override thinkGloat(spot: Entity | null, _t: number): void {
    const set = BOARDER_SETS[this.set].set;
    if (this.kind === 'stag') {
      if (spot && Math.abs(spot.x - this.x) >= 2) this.facing = spot.x > this.x ? -1 : 1;
      this.anim.play(`enemy/${set}/gloat`);
      if (!this.onScreen(0)) return;
      const t = this.gloatPhaseT++;
      if (t >= 8 + (this.id % 5) * 4) this.sayGloat('JAM SELFIE!\n#A10', 70, 'stag');
      if ((t + this.id * 7) % STAG.flashEvery === STAG.flashEvery - 1) {
        FxEntity.spawn(this.world, { sprite: 'enemy/stag-partier/flash', x: this.x + STAG.phone[0] * this.facing, y: this.y - this.lift + STAG.phone[1], z: 61 });
      }
      return;
    }
    const n = ++this.gloatPhaseT;
    if (this.gloatPhase === 'walk' && !this.aboard) {
      const dx = this.gloatGoal - this.x;
      if (Math.abs(dx) > HANDHAVER.walk) {
        this.facing = dx > 0 ? 1 : -1;
        this.x += HANDHAVER.walk * this.facing;
        this.play('run');
        return;
      }
      this.gloatPhase = 'write';
      this.gloatPhaseT = 0;
    } else if (this.gloatPhase === 'walk') this.gloatPhase = 'write';
    if (spot && Math.abs(spot.x - this.x) >= 2) this.facing = spot.x > this.x ? 1 : -1;
    let f: number = GLOAT_FRAME.done;
    switch (this.gloatPhase) {
      case 'write':
        f = (n >> 3) & 1 ? GLOAT_FRAME.write2 : GLOAT_FRAME.write;
        if (n === 1 || n === 25) this.world.audio.sfx('ams/gloat-scribble', { vol: 0.8 });
        this.sayGloat('VLUCHTSTROOK?\nBOETE!', 80, 'handhaver');
        if (n >= HANDHAVER.gloatWrite) this.nextGloat('tear');
        break;
      case 'tear':
        f = GLOAT_FRAME.tear;
        if (n === 1) this.world.audio.sfx('ams/gloat-tear');
        if (n >= HANDHAVER.gloatTear) this.nextGloat('drop');
        break;
      case 'drop':
        f = GLOAT_FRAME.drop;
        if (n === 1) this.dropPage(spot);
        if (n >= HANDHAVER.gloatDrop) this.nextGloat('done');
        break;
      default:
        break;
    }
    this.anim.play(`enemy/${set}/gloat`);
    this.anim.index = f;
  }

  private nextGloat(p: RingBoarder['gloatPhase']): void {
    this.gloatPhase = p;
    this.gloatPhaseT = 0;
  }

  /** The torn page flutters down onto the spot and lies there (a tumbler on the plane). */
  private dropPage(spot: Entity | null): void {
    const r = HANDHAVER.gloatReach;
    const tx = spot ? Math.max(this.x - r, Math.min(this.x + r, spot.x)) : this.x + this.facing * 12;
    const ty = spot ? spot.y : this.y;
    tumbleOff(this.world, this.x + this.facing * 9, this.y, {
      sprite: 'enemy/boete-ticket/fly',
      vx: (tx - this.x - this.facing * 9) / 40,
      vy: (ty - this.y) / 40,
      lift: this.lift + 32,
      vlift: 0.3,
      gravity: 0.03,
      bounces: 0,
      rest: 600,
      restFrame: 2,
      tpf: 6,
      shadowW: 5,
      z: 29,
    });
    this.world.audio.sfx('ams/ticket', { vol: 0.6 });
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
    this.fling(damageHas(d, 'side-ram') ? 1.3 : d.kind === 'explosion' ? 1.4 : 1, d.kind === 'knife' ? 1 : d.dirX || 1);
    this.world.audio.sfx('ring/crew-knocked');
    this.remove();
  }

  /** Off in a tuck onto the hard shoulder, sitting up dazed (bloodless). */
  private fling(k: number, dir: number): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const shoulder = SHOULDER_TOP + 5;
    tumbleOff(this.world, this.x, this.y, {
      sprite: `${this.art}/tumble`,
      restSprite: `${this.art}/sit`,
      vx: road * 0.6 + dir * 0.8 * k,
      vy: Math.max(0.5, (shoulder - this.y) / 30),
      lift: this.lift + 6,
      vlift: 2.2 * k,
      bounces: 1,
      rest: 70,
      tpf: 4,
      shoulder: true,
      shadowW: 12,
      z: 34,
    });
    dust(this.world, this.x, this.y, 3);
  }

  /** The drop falls as a ring crate. */
  protected override dropItem(): void {
    const spec = this.drop;
    if (!spec) return;
    this.drop = null;
    const value = spec.id === 'loot' ? spec.params?.contains ?? 'auto' : spec.id === 'ring-crate' ? spec.params?.contains : spec;
    this.world.spawn('ring-crate', this.x, splitNear(this.y + 11), { contains: value, dropped: true, vx: (ringOf(this.world)?.roadSpeed ?? 0) * 0.5, lift: this.lift + 10, vlift: 2.2 });
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.mode === 'wait' || !this.anim.id) return;
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = this.flashTicks > 0;
    drawOpts.tint = undefined;
    drawOpts.alpha = undefined;
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
    // The last third of a tell blinks a warm tint (the hop / the swing is coming).
    if (this.mode === 'tell-hop' || this.mode === 'tell-hit') {
      const T = telegraphTicks(this.world, this.mode === 'tell-hop' ? BOARDER.tellHop : BOARDER.tellHit);
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) {
        drawOpts.flash = false;
        drawOpts.tint = 0xff6040ff;
        drawOpts.alpha = 0.35;
        r.sprite(this.anim.id, this.anim.index, x, y, drawOpts);
        drawOpts.tint = undefined;
        drawOpts.alpha = undefined;
      }
    }
  }
}

/** Is another boarder on (or hopping onto, or crouched for) the bonnet of `w`? */
function bonnetTaken(w: Wagon, except: RingBoarder): boolean {
  const list = w.world.byTag(RING_BOARDER);
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b === except || !(b instanceof RingBoarder) || !b.alive || b.wagon !== w) continue;
    if (b.aboard || b.mode === 'hop' || b.mode === 'tell-hop') return true;
  }
  return false;
}

/** A standing jam (its level over ½)? */
function standing(world: World): boolean {
  return jamOf(world).level > BOARDER.jam;
}

/** Is the wagon still driven (a hero aboard, not scripted, not wrecked)? */
function isDriven(w: Wagon): boolean {
  if (!w.alive) return false;
  const list = drivenWagons(w.world);
  for (let i = 0; i < list.length; i++) if (list[i] === w) return true;
  return false;
}

/** The split line beside a wagon's lane he runs on: the near one (lane 4: the far one). */
function splitBeside(w: Wagon): number {
  const open = ringOf(w.world)?.lanesOpenAt(w.x) ?? LANE_COUNT;
  const lane = nearestLane(w.y, 1, open);
  return lane < LANE_COUNT && lane < open ? LANE_SPLIT[lane - 1] : LANE_SPLIT[lane - 2];
}

/** The split line nearest to a plane y. */
function splitNear(y: number): number {
  let best = LANE_SPLIT[0];
  for (let i = 1; i < LANE_SPLIT.length; i++) if (Math.abs(LANE_SPLIT[i] - y) < Math.abs(best - y)) best = LANE_SPLIT[i];
  return best;
}

defineEntity(RING_BOARDER, (w, x, y, p) => new RingBoarder(w, x, y, p), {
  category: 'enemy',
  score: BOARDER.score,
  description: 'A jam boarder (handhaver or stag partier): in a standing jam runs between the cars, hops onto a bonnet and hits it until knifed (params look, index, wait).',
});
