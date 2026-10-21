/**
 * `ring-handhaver-moto` — a handhaver on a city motorbike (the `ams` handhaver look: navy uniform
 * and cap, the yellow hi-vis vest; docs/design/ring.md §5.3; GDD §4.11 fairness). He comes from
 * behind and rides up to the hero's window, in the lane next to the wagon (the near side, the
 * camera side, where the hero hangs out; the far side when the near lane is closed or taken). One
 * attack per bike (param `attack`):
 *
 * - BATON (`tell-baton` ≥ 18 ticks: he draws the baton and cocks it overhead → `baton`): a swing up
 *   at the window. Still beside the window → ½ cell (a light hit). A lane change or a swerve dodges it.
 * - STICKER (`tell-sticker` ≥ 18 ticks: a fine card out of his vest, peeled → `sticker`): he slaps a
 *   fine sticker on the wagon's glass (`RingSticker`, behind the hero). While it sticks it BLOCKS
 *   THE HERO'S BACK AIMS (←, ↖, ↙: the card covers the rear quarter glass; spec §5.3; the status
 *   `ring-fine-sticker`: its icon and timer bar in the HUD; the card on the glass flaps with every
 *   shot); a swerve (JUMP) shakes it off; it falls off by itself after `STICKER.ticks`. The driver
 *   says the `sticker` line.
 * After a strike he drops back a little, then rides up again. Light (30 HP): a swerve into him is
 * the wagon's side ram (tags `ram` + `side-ram`, he is tagged `ring-small`), the knife reaches him at
 * the window. Bloodless: on any death he tumbles onto the hard shoulder and sits there dazed, the
 * bike slides over on its side. He speeds off ahead after his stay; at most `MOTO_AI.crowd` ride at
 * the windows at once (the others hang back). Gloat: he rolls up beside the spot where the last
 * wagon went and writes a fine for parking on the hard shoulder; cower: he ducks behind his arm.
 *
 * Params: `attack` ('baton' | 'sticker', default 'baton'), `hp`, `drop`. Inert-safe in a plain world.
 */
import { damageHas, Entity, type Damage } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { telegraphTicks } from '../../../enemy';
import { debris, dust } from '../../../fx';
import type { Player } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { defineEntity, defineStatus, NO_PARAMS, type SpawnParams } from '../../../registry';
import { ringOf } from '../../../ring/entity';
import { clampLane, LANE_COUNT, laneY, nearestLane, SHOULDER_TOP } from '../../../ring/lanes';
import { WAGON_W, WINDOW_DX, type Wagon } from '../../../ring/wagon';
import { drivenWagons, ENTER_GIVE_UP, nearestWagon, slabsTouch, tumbleOff, wagonSlab } from '../traffic/road-kit';
import { CONVOY_ID, CONVOY_TAG, MOTO, MOTO_AI, MOTO_ID, STICKER, STICKER_STATUS } from './geometry';
import { ConvoyEnemy } from './kit';

export type MotoAttack = 'baton' | 'sticker';

const drawOpts: DrawOpts = {};

// ---------------------------------------------------------------------------------------------
// The sticker's status: the back aims are blocked
// ---------------------------------------------------------------------------------------------

/**
 * The card covers the rear quarter glass behind the hero: he cannot aim back (←, ↖, ↙) while it
 * sticks (spec §5.3: it blocks a part of the hero's aim). Content-side: the status hook sets the
 * ring hero's `backAimBlock` every tick (`RingHero.updateArmsRing` reads it).
 */
export const STICKER_DEF: StatusEffectDef = {
  id: STICKER_STATUS,
  ticks: STICKER.ticks,
  icon: MOTO_ID.icon,
  onTick(p: Player) {
    const h = p as Player & { backAimBlock?: number };
    if (h.backAimBlock !== undefined) h.backAimBlock = 1;
  },
};
defineStatus(STICKER_DEF);

/** The hero riding wagon `w` (null when none). */
function heroOf(w: Wagon): Player | null {
  return w.driver ?? null;
}

// ---------------------------------------------------------------------------------------------
// The sticker on the glass
// ---------------------------------------------------------------------------------------------

/**
 * A fine sticker on a wagon's rear quarter glass (behind the hero). It gives the hero the status
 * (no back aims) and lives as long as the status does; a swerve shakes it off (it flutters
 * away behind the wagon); a wreck takes it along. Param `wagon` (else the nearest driven wagon).
 */
export class RingSticker extends Entity {
  readonly wagon: Wagon | null;
  private flapT = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    const given = (p as { wagon?: unknown }).wagon;
    this.wagon = given && typeof given === 'object' ? (given as Wagon) : nearestWagon(world, x, y);
    this.team = 'neutral';
    this.z = 34;
    this.hitbox = { x: -8, y: -30, w: 16, h: 12 };
    this.despawnMargin = Infinity;
    this.addTag(CONVOY_TAG.sticker);
    const h = this.wagon ? heroOf(this.wagon) : null;
    if (h) h.status.add(STICKER_DEF);
  }

  /** The sticker of wagon `w`, if it has one. */
  static on(world: World, w: Wagon): RingSticker | null {
    const list = world.byTag(CONVOY_TAG.sticker);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s instanceof RingSticker && s.alive && s.wagon === w) return s;
    }
    return null;
  }

  /** Slap another one on: the timer starts again. */
  refresh(): void {
    const h = this.wagon ? heroOf(this.wagon) : null;
    if (h) h.status.add(STICKER_DEF, STICKER.ticks);
    this.flapT = 6;
  }

  override update(): void {
    const w = this.wagon;
    const h = w ? heroOf(w) : null;
    if (!w || !w.alive || w.state !== 'driven' || !h) {
      this.end(false);
      return;
    }
    this.x = w.x;
    this.y = w.y + 0.5;
    if (w.swerveT > 0) {
      this.end(true);
      return;
    }
    if (!h.status.has(STICKER_STATUS)) {
      this.end(true);
      return;
    }
    if (h.gun.sinceShot === 0) this.flapT = 4;
    else if (this.flapT > 0) this.flapT--;
  }

  /** It comes off: the status goes; `fly` = it flutters away (a swerve, the time ran out). */
  end(fly: boolean): void {
    if (this.removed) return;
    const w = this.wagon;
    const h = w ? heroOf(w) : null;
    if (h && h.status.has(STICKER_STATUS)) h.status.remove(STICKER_STATUS);
    if (fly && w) {
      const road = ringOf(this.world)?.roadSpeed ?? 0;
      tumbleOff(this.world, w.x + STICKER.at[0], w.y, {
        sprite: MOTO_ID.fine,
        vx: road * 0.6 - 1.2,
        vy: 0.2,
        lift: -STICKER.at[1],
        vlift: 1.2,
        gravity: 0.08,
        bounces: 0,
        rest: 30,
        restFrame: 1,
        tpf: 3,
        shadowW: 6,
        z: 34,
      });
      this.world.audio.sfx('ring/sticker-peel');
    }
    this.remove();
  }

  override draw(r: Renderer): void {
    const w = this.wagon;
    if (!w || w.view !== 'right') return;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite(MOTO_ID.fine, this.flapT > 0 ? 1 : 0, Math.round(w.x + STICKER.at[0]), Math.round(w.y + STICKER.at[1] - w.lift), drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// The motorbike
// ---------------------------------------------------------------------------------------------

export class RingHandhaverMoto extends ConvoyEnemy {
  readonly attack: MotoAttack;
  private gloatGoal = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y, p, { art: 'ring/handhaver-moto', hp: MOTO_AI.hp, w: MOTO.box.w, h: -MOTO.box.y, soft: true, score: MOTO_AI.score });
    this.hitbox = { ...MOTO.box };
    this.shadowW = 36;
    this.shotLift = MOTO_AI.handLift;
    this.despawnMargin = 120;
    this.attack = p.attack === 'sticker' ? 'sticker' : 'baton';
    this.cool = MOTO_AI.firstDelay + (this.id % 4) * 9;
    this.addTag(CONVOY_ID.moto, 'ring-small');
    this.play('ride');
  }

  /** The tell of its attack on this difficulty (never below 18). */
  get tellTicks(): number {
    return telegraphTicks(this.world, this.attack === 'baton' ? MOTO_AI.tellBaton : MOTO_AI.tellSticker);
  }

  protected override setMode(m: string): void {
    super.setMode(m);
    const strip = m === 'tell-baton' || m === 'baton' || m === 'tell-sticker' || m === 'sticker' || m === 'wobble' ? m : 'ride';
    this.play(strip, { restart: strip !== 'ride' && strip !== 'wobble' });
  }

  // ------------------------------------------------------------------------------- the AI

  protected override think(): void {
    this.modeT++;
    this.facing = 1;
    this.findPrey();
    const cam = this.world.camera;
    const sx = this.sx;
    switch (this.mode) {
      case 'enter':
        if (sx > 24 && sx < cam.w - 24) {
          this.setMode('ride');
          this.world.audio.sfx('ring/moto-whine');
        } else if (this.modeT >= ENTER_GIVE_UP && !this.world.onScreen(this, 0)) {
          // Boxed in off screen by traffic: it never showed; it gives up (no score).
          this.remove();
          return;
        }
        break;
      case 'ride':
        if (++this.inPlay >= MOTO_AI.stay + (this.id % 3) * 40) {
          this.setMode('leave');
          break;
        }
        if (--this.cool <= 0) this.tryAttack();
        break;
      case 'tell-baton':
      case 'tell-sticker':
        if (!this.prey || !this.world.camera.containsPoint(this.x, this.y - 10, -ATTACK_INSET + 6) || !this.beside(this.prey)) this.cancelAttack();
        else if (this.modeT >= this.tellTicks) this.strike();
        break;
      case 'baton':
      case 'sticker':
        if (this.modeT >= MOTO_AI.strike) this.setMode('recover');
        break;
      case 'recover':
        if (this.modeT >= MOTO_AI.recover) {
          this.releaseToken();
          this.setMode('peel');
        }
        break;
      case 'peel':
        if (this.modeT >= MOTO_AI.peel) {
          this.setMode('ride');
          this.cool = this.fireInterval(MOTO_AI.every, MOTO_AI.jitter);
        }
        break;
      case 'wobble':
        if (this.modeT >= 20) this.setMode('ride');
        break;
      case 'leave':
        if (sx > cam.w + 40 || !this.world.onScreen(this, 8)) {
          this.remove();
          return;
        }
        break;
    }
    this.drive();
    this.touchWagons();
  }

  /** Its place among the motos at this wagon (by id): 0 the near window, 1 the far side, 2+ hang back. */
  private slot(t: Wagon): number {
    const list = this.world.byTag(CONVOY_ID.moto);
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !(e instanceof RingHandhaverMoto) || !e.alive || e.dead || e.mode === 'leave') continue;
      if (e.prey === t && e.id < this.id) k++;
    }
    return k;
  }

  /** The lane it rides in next to wagon `t` (the near side first, the far side for slot 1 or a closed near lane). */
  private sideLane(t: Wagon, slot: number): number {
    const open = this.openLanes();
    const tl = nearestLane(t.y, 1, open);
    const near = tl + 1 <= open ? tl + 1 : -1;
    const far = tl - 1 >= 1 ? tl - 1 : -1;
    const first = slot === 1 ? far : near;
    const second = slot === 1 ? near : far;
    return first > 0 ? first : second > 0 ? second : tl;
  }

  /** Beside wagon `t`'s window: in the next lane, settled, its middle within reach of the window. */
  beside(t: Wagon): boolean {
    const l = nearestLane(this.y);
    if (Math.abs(nearestLane(t.y) - l) !== 1 || Math.abs(this.y - laneY(l)) > 4) return false;
    return Math.abs(this.x - (t.x + WINDOW_DX)) < MOTO_AI.reach;
  }

  private tryAttack(): void {
    const t = this.prey;
    if (!t || t.arriving || this.reacting || !this.world.camera.containsPoint(this.x, this.y - 10, -ATTACK_INSET) || !this.beside(t) || this.slot(t) >= MOTO_AI.crowd - 1) {
      this.cool = 12;
      return;
    }
    if (!this.takeToken()) {
      this.cool = 30;
      return;
    }
    this.setMode(this.attack === 'baton' ? 'tell-baton' : 'tell-sticker');
    this.world.audio.sfx(this.attack === 'baton' ? 'ring/baton-draw' : 'ring/sticker-peel');
  }

  /** The tell is over: the swing or the slap (only if the window is still there). */
  private strike(): void {
    const t = this.prey;
    const hit = t !== null && this.beside(t) && t.swerveT <= 0;
    if (this.attack === 'baton') {
      this.setMode('baton');
      this.world.audio.sfx('ring/baton-swing');
      if (t && hit) this.world.damage(t, { amount: 1, kind: 'impact', dirX: t.x >= this.x ? 1 : -1, source: this, tags: ['melee', 'bump-light'] });
      return;
    }
    this.setMode('sticker');
    if (t && hit) {
      this.world.audio.sfx('ring/sticker-slap');
      const old = RingSticker.on(this.world, t);
      if (old) old.refresh();
      else this.world.add(new RingSticker(this.world, t.x, t.y, { wagon: t }));
      t.say('sticker');
      return;
    }
    // Missed: the card flutters down onto the road.
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    tumbleOff(this.world, this.x, this.y, { sprite: MOTO_ID.fine, vx: road * 0.4, vy: 0, lift: 34, vlift: 0.6, gravity: 0.06, bounces: 0, rest: 30, restFrame: 1, tpf: 3, shadowW: 6, z: 34 });
  }

  protected cancelAttack(): void {
    if (this.mode === 'tell-baton' || this.mode === 'tell-sticker' || this.mode === 'baton' || this.mode === 'sticker' || this.mode === 'recover') {
      this.releaseToken();
      this.setMode('ride');
      this.cool = 40;
    }
  }

  /** Motion: road speed + a screen speed toward the window; the side lane. */
  private drive(): void {
    const cam = this.world.camera;
    const sx = this.sx;
    const t = this.prey;
    let rel = 0;
    const slot = t ? this.slot(t) : 0;
    switch (this.mode) {
      case 'enter':
        rel = sx < cam.w / 2 ? MOTO_AI.enterRel : -1.2;
        // Still in the wagon's lane right behind it: hold back until the lane change is done.
        if (t && Math.abs(this.y - t.y) < 14 && this.x < t.x && this.x + MOTO.len / 2 > t.x - WAGON_W / 2 - 14) rel = Math.min(rel, -0.2);
        break;
      case 'leave':
        rel = MOTO_AI.leaveRel;
        break;
      case 'peel':
        rel = MOTO_AI.peelRel;
        break;
      case 'wobble':
        rel = -0.2;
        break;
      default: {
        const back = slot >= MOTO_AI.crowd - 1 ? 64 + (slot - MOTO_AI.crowd + 1) * 36 : 0;
        const want = t ? t.x + WINDOW_DX - back : cam.x + 200;
        const k = this.mode === 'ride' ? 0.06 : 0.12;
        rel = Math.max(-MOTO_AI.rel, Math.min(MOTO_AI.rel, (want - this.x) * k));
        rel += Math.sin((this.age + this.id * 13) * 0.07) * 0.1;
      }
    }
    if (this.gapAhead(MOTO.len / 2) < 8 && this.mode !== 'leave') rel = Math.min(rel, -0.4);
    if (!ringOf(this.world)) rel = 0;
    this.vx = this.road + rel;
    this.x += this.vx;
    // The lane: beside the target (held while it strikes).
    const striking = this.mode !== 'ride' && this.mode !== 'enter' && this.mode !== 'peel' && this.mode !== 'leave';
    if (t && !striking && this.modeT % 6 === 0) {
      const want = this.sideLane(t, slot);
      if (want !== this.laneTarget && !this.laneBusy(want, this.x - 26, this.x + 26, t)) this.laneTarget = want;
    }
    this.steerLane(this.mode === 'wobble' ? 1.2 : MOTO_AI.laneSpeed);
  }

  /** A wagon drove into it without a swerve: it wobbles away into another lane (no harm). */
  private touchWagons(): void {
    if (this.mode === 'wobble') return;
    const mine = this.hurtboxes()[0];
    if (!mine) return;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.swerveT > 0 || !slabsTouch(wagonSlab(w), mine)) continue;
      this.cancelAttack();
      this.setMode('wobble');
      const open = this.openLanes();
      const away = w.y >= this.y ? -1 : 1;
      const lane = clampLane(nearestLane(this.y) + away, open);
      this.laneTarget = lane === nearestLane(this.y) ? clampLane(lane - away, open) : lane;
      this.x += w.x < this.x ? 3 : -3;
      this.world.audio.sfx('ring/moto-whine', { pitch: 1.3, vol: 0.5 });
      return;
    }
  }

  // ------------------------------------------------------------------------------- reactions

  /** The gloat: he rolls up beside the spot (the near lane) and writes a fine (no pointing, no laughing). */
  protected override onGloatStart(spot: Entity | null): void {
    this.gloatGoal = spot ? Math.max(this.x - 60, Math.min(this.x + 60, spot.x + 20)) : this.x;
  }

  protected override thinkGloat(_spot: Entity | null, t: number): void {
    const dx = this.gloatGoal - this.x;
    this.reactRel = Math.max(-0.7, Math.min(0.7, dx * 0.08));
    const open = this.openLanes();
    const ty = laneY(Math.min(open, LANE_COUNT));
    this.y += Math.max(-0.6, Math.min(0.6, ty - this.y));
    this.laneTarget = nearestLane(this.y);
    if (Math.abs(dx) > 3 && t < 40) {
      this.play('ride');
      return;
    }
    if (!this.playing('gloat')) this.play('gloat', { restart: true, loop: false });
    if (t % 50 === 12) this.world.audio.sfx('ams/gloat-scribble');
    if (t >= 30) this.sayGloat('PARKEREN OP DE\nVLUCHTSTROOK? BOETE!', 90);
  }

  // ------------------------------------------------------------------------------- death

  /** Knocked off (the side ram) or beaten: he tumbles onto the hard shoulder, the bike slides over. */
  protected override onDeath(d: Damage): void {
    this.releaseToken();
    const ram = damageHas(d, 'side-ram') || damageHas(d, 'ram');
    const blast = d.kind === 'explosion';
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const dir = d.dirX || 1;
    const shoulder = SHOULDER_TOP + 5;
    tumbleOff(this.world, this.x - 2, this.y, {
      sprite: MOTO_ID.tumble,
      restSprite: MOTO_ID.sit,
      vx: road * 0.5 + dir * (ram ? 1.2 : 0.6),
      vy: Math.max(0.6, (shoulder - this.y) / 28),
      lift: 18,
      vlift: blast ? 3.4 : ram ? 2.6 : 2,
      bounces: 1,
      rest: 70,
      tpf: 4,
      shoulder: true,
      shadowW: 14,
      z: 34,
    });
    tumbleOff(this.world, this.x, this.y, { sprite: MOTO_ID.down, vx: road * 0.7, vy: 0, lift: 0, vlift: blast ? 1.6 : 0.8, bounces: 0, rest: 50, restFrame: 2, tpf: 6, shadowW: 34, z: 31 });
    dust(this.world, this.x, this.y, 5);
    if (blast) debris(this.world, this.x, this.y - 10, 'metal', 4);
    this.world.audio.sfx(ram ? 'ring/scooter-crash' : 'ring/scooter-down');
    this.remove();
  }

  protected override dropItem(): void {
    this.dropCrate(false);
  }

  override draw(r: Renderer): void {
    super.draw(r);
    // The last third of a tell blinks a warm tint (the strike is coming).
    if ((this.mode === 'tell-baton' || this.mode === 'tell-sticker') && !this.dead) {
      const T = this.tellTicks;
      if (this.modeT > T * 0.6 && Math.floor(this.modeT / 3) % 2 === 0) this.drawTint(r, 0xff6040ff, 0.35);
    }
  }
}

/** A strike starts only with the bike's middle this far inside the view (px). */
const ATTACK_INSET = 22;

defineEntity(CONVOY_ID.moto, (w, x, y, p) => new RingHandhaverMoto(w, x, y, p), {
  category: 'enemy',
  score: MOTO_AI.score,
  description: 'A handhaver on a motorbike: rides up to your window and swings a baton (½ cell) or slaps a fine sticker on the glass (it blocks the back aims of the hero until a swerve shakes it off) (params attack, hp, drop).',
});

defineEntity(CONVOY_ID.sticker, (w, x, y, p) => new RingSticker(w, x, y, p), {
  category: 'fx',
  description: 'A fine sticker on a wagon’s glass (it blocks the hero’s back aims until a swerve shakes it off; param wagon).',
});
