/**
 * The playing hero on the ring (docs/design/ring.md §3, §9, §10; docs/api/ring.md §5). Owner: the
 * WAGON builder.
 *
 * `RingHero extends Player` and never leaves the wagon (spec §0 row 15). It keeps what the rest
 * of the game reads from a Player (`isPlayer`, the 'player' tag, the slot, `giveWeapon`,
 * `addBombs`, `addLife`, pickups, the HUD's vehicle panel through `state 'mounted'` + `vehicle`)
 * and replaces the on-foot parts: `update`, `draw`, `respawn`, `continueGame`, the life loss.
 *
 * States it reaches (every other one recovers, tests/game/ring/hero-states.test.ts):
 * - 'mounted': in play in its wagon (the wagon takes every hit: the hero is never 'shootable').
 * - 'spawn': its wagon drives in from the left (a respawn, a continue, a join) — or the boarding
 *   scene runs (`boarding`): the hero stands on the hard shoulder and jumps in (boarding.ts).
 * - 'dead': the wagon wrecked (`wrecked`): he tumbles onto the hard shoulder (no harm shown), a
 *   life is lost; after `RING.respawnTicks` a fresh wagon with the same driver (`respawn`), or
 *   'out' without lives.
 * - 'out': no lives left: the continue countdown (continue.ts).
 * His anchor (x, y) is the window on the wagon's PLANE line (y = the road line, so enemy plane
 * aim and `nearestPlayer` read the depth); the wagon draws his torso from the hip on the sill.
 *
 * Aim (steer lock, spec §3): while FIRE is held the D-pad sets one of 8 plane aims (lanes.ts);
 * the aim stays when FIRE is released; a tap fires along the last aim (default forward). The
 * hero's own `gun` fires on the plane from his muzzle (the torso strip's `muzzle` point: the shot
 * leaves at its x and is drawn at its height, `shotLift`). Back aims flip the torso. FIRE next to
 * an enemy on the bonnet or at the window is the knife; BOMB lobs a grenade into the aimed lane
 * (content/ring/wagon/lob.ts).
 */
import type { Entity } from '../../engine/entity';
import { VirtualPad } from '../../engine/input';
import { overlaps, type Rect } from '../../engine/math';
import type { DrawOpts, Renderer } from '../../engine/render';
import { frameCount, framePoint, getFrame, hasSprite } from '../../engine/sprites';
import type { World } from '../../engine/world';
import { muzzleLift, SEAT } from '../content/ring/wagon/geometry';
import { lob } from '../content/ring/wagon/lob';
import { difficultyOf } from '../context';
import type { DeathCause } from '../events';
import { hitSpark } from '../fx';
import { Player, type DismountOpts, type Mountable, type PlayerOpts } from '../player/player';
import { eraseEnemyShots } from '../projectile';
import { hasWeapon } from '../registry';
import { TUNING } from '../tuning';
import type { FireArgs } from '../weapons';
import type { RingDrawable } from './entity';
import { aimOf, aimsBack, DEPTH_HALF, planeAngle, SHOULDER_TOP, type Aim8 } from './lanes';
import { RING } from './types';
import { spawnWagon, Wagon, WINDOW_LIFT, WRECK_SPIN, type WagonMode } from './wagon';

const NO_INPUT = new VirtualPad();
const args: FireArgs = { x: 0, y: 0, angle: 0, facing: 1 };
const poofCircle = { x: 0, y: 0, r: 64 };
const pt: [number, number] = [0, 0];
const drawOpts: DrawOpts = {};
const flipOpts: DrawOpts = { flipX: true };
const winSrc = { x: 0, y: 0, w: 0, h: 0 };
const winOpts: DrawOpts = { src: winSrc };
const winFlipOpts: DrawOpts = { src: winSrc, flipX: true };
const knifeA: Rect = { x: 0, y: 0, w: 0, h: 0 };
const knifeB: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** The torso action of each aim (back aims flip the forward ones). */
const AIM_ACTION: Readonly<Record<Aim8, { idle: string; shoot: string }>> = {
  forward: { idle: 'idle', shoot: 'shoot' },
  back: { idle: 'idle', shoot: 'shoot' },
  'forward-far': { idle: 'diag-up', shoot: 'shoot-diag-up' },
  'back-far': { idle: 'diag-up', shoot: 'shoot-diag-up' },
  far: { idle: 'up', shoot: 'shoot-up' },
  near: { idle: 'down', shoot: 'shoot-down' },
  'forward-near': { idle: 'diag-down', shoot: 'shoot-diag-down' },
  'back-near': { idle: 'diag-down', shoot: 'shoot-diag-down' },
};

/** Muzzle (hip-relative) when a strip has no 'muzzle' point. */
const FALLBACK_MUZZLE: Readonly<Record<Aim8, readonly [number, number]>> = {
  forward: [15, -7],
  back: [15, -7],
  'forward-far': [12, -14],
  'back-far': [12, -14],
  far: [5, -21],
  near: [4, 10],
  'forward-near': [14, 2],
  'back-near': [14, 2],
};

/** The hero's part in the boarding scene (boarding.ts sets it; he is drawn on foot). */
export interface FootPose {
  /** Feet position (world) and the height above the road (a jump). */
  x: number;
  y: number;
  lift: number;
  /** 'stand' idles, 'jump' plays the somersault (frame by `t`). */
  mode: 'stand' | 'jump';
  t: number;
}

/** The forward aim that mirrors a back aim (a blocked back aim turns to it). */
const FORWARD_MIRROR: Readonly<Record<Aim8, Aim8>> = {
  forward: 'forward',
  'forward-far': 'forward-far',
  far: 'far',
  'back-far': 'forward-far',
  back: 'forward',
  'back-near': 'forward-near',
  near: 'near',
  'forward-near': 'forward-near',
};

export class RingHero extends Player implements RingDrawable {
  /** The 8-way aim of the steer lock (kept while FIRE is up). */
  aim8: Aim8 = 'forward';
  /**
   * The back aims (back, back-far, back-near) are blocked while this is above 0: a status sets it
   * every tick (the fine sticker on the rear quarter glass behind him, docs/design/ring.md §5.3).
   * He cannot turn to aim back then; a back aim he had turns to its forward mirror.
   */
  backAimBlock = 0;
  /** Drawn height of the hip above the road (the window sill), and of his gun (shots). */
  lift = WINDOW_LIFT;
  shotLift: number = RING.heroGunLift;
  /** The squad hero who drives this player's wagons (set by the runner; null = none found). */
  driverId: string | null = null;
  /** The lane a fresh wagon starts in (the last lane driven). */
  lane = 0;
  /** Draw-only: ticks of the shooting pose, the knife and the throw. */
  shootT = 0;
  knifeT = 0;
  throwT = 0;
  /** The boarding scene runs (boarding.ts): he waits on the hard shoulder, then jumps in. */
  boarding = false;
  /** His pose on foot during the boarding (null in the wagon). */
  foot: FootPose | null = null;
  /** Ticks until a fresh wagon after a wreck. */
  private respawnT = 0;
  /** Ticks since the wreck (the tumble onto the shoulder). */
  private wreckT = 0;
  private knifeCool = 0;
  private ringKnives = 0;
  private lobCool = 0;
  /** The running drive-in is a continue: its arrival emits `continueLanded`. */
  private ringContinued = false;
  private readonly strips: Readonly<Record<'pistol' | 'heavy', Readonly<Record<string, string>>>>;

  constructor(world: World, x: number, y: number, o: PlayerOpts) {
    super(world, x, y, o);
    this.facing = 1;
    this.body.collide = false;
    // Visual box over the window: bubbles and pop-ups hang above his head.
    this.hitbox = { x: -6, y: -(WINDOW_LIFT + 24), w: 12, h: 24 };
    this.removeTag('shootable');
    this.addTag('ring-hero');
    const acts = ['idle', 'shoot', 'diag-up', 'shoot-diag-up', 'up', 'shoot-up', 'down', 'shoot-down', 'diag-down', 'shoot-diag-down', 'knife', 'knife-b', 'throw'];
    const set = (w: string): Record<string, string> => Object.fromEntries(acts.map((a) => [a, `${this.art}/torso-${w}-${a}`]));
    this.strips = { pistol: set('pistol'), heavy: set('heavy') };
  }

  /** The wagon he rides (null while waiting for a fresh one). */
  get wagon(): Wagon | null {
    return this.vehicle instanceof Wagon ? this.vehicle : null;
  }

  /** The input this tick (none while a status takes control away). */
  private get ringInput(): VirtualPad {
    return this.status.noControl ? NO_INPUT : this.pad;
  }

  private get torsoSet(): Readonly<Record<string, string>> {
    return this.strips[this.weapon.pose === 'heavy' ? 'heavy' : 'pistol'];
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (this.backAimBlock > 0) this.backAimBlock--;
    if (this.state !== 'out') this.status.update();
    if (this.shootT > 0) this.shootT--;
    if (this.knifeT > 0) this.knifeT--;
    if (this.throwT > 0) this.throwT--;
    if (this.knifeCool > 0) this.knifeCool--;
    if (this.lobCool > 0) this.lobCool--;
    switch (this.state) {
      case 'mounted':
        this.updateArmsRing();
        break;
      case 'dead':
        this.wreckT++;
        this.updateWrecked();
        break;
      case 'spawn': {
        // The wagon drives in (or the boarding scene runs); the triggers stay calm.
        this.gun.tick();
        this.bombGun.tick();
        this.meleeGun.tick();
        const w = this.wagon;
        if (this.boarding) break;
        if (!w || !w.alive) this.recover();
        else if (!w.arriving && !w.scripted) this.arrive();
        break;
      }
      case 'victory':
        // Never on foot on the ring: the victory is a cheer from the window.
        this.cheering = true;
        this.recover();
        break;
      case 'play':
        // Never on foot on the ring: back into the wagon, or wait for a fresh one.
        this.recover();
        break;
      case 'out':
        break;
    }
    if (this.wagon) this.lane = this.wagon.laneTarget;
    this.legs.update();
    this.torso.update();
    this.full.update();
  }

  /** Aim (while FIRE is held), the knife, fire, the lob (spec §3). */
  private updateArmsRing(): void {
    const pad = this.ringInput;
    const st = this.status;
    this.facing = 1;
    if (pad.held('fire')) {
      const a = aimOf(pad.axisX(), pad.held('up') ? -1 : pad.held('down') ? 1 : 0);
      if (a && !(this.backAimBlock > 0 && aimsBack(a))) this.aim8 = a;
    }
    if (this.backAimBlock > 0 && aimsBack(this.aim8)) this.aim8 = FORWARD_MIRROR[this.aim8];
    this.gun.setWeapon(this.weapon);
    this.bombGun.setWeapon(this.bombDef);
    this.gun.pitch = st.sfxPitch;
    const w = this.wagon;
    const knife = !st.noFire && !this.cheering && w !== null && !w.scripted && this.knifeTarget(w);
    if (!st.noFire && pad.pressed('fire') && !knife) this.gun.press();
    this.gun.tick(knife);
    this.bombGun.tick();
    this.meleeGun.tick();
    if (knife && (pad.pressed('fire') || pad.held('fire')) && this.knifeCool <= 0) {
      this.gun.buffer = 0;
      this.knifeRing(w);
    } else if (!st.noFire && !this.cheering && this.knifeT <= 0 && this.gun.wants(pad.held('fire'))) this.shootRing();
    if (!st.noBomb && !this.cheering && pad.pressed('bomb')) this.lobRing();
  }

  /** The torso strip id and flip of the current aim (draw and muzzle). */
  private aimStrip(shooting: boolean): { id: string; flip: boolean } {
    const set = this.torsoSet;
    const act = AIM_ACTION[this.aim8];
    let id = set[shooting ? act.shoot : act.idle];
    if (!hasSprite(id)) id = set[act.idle];
    if (!hasSprite(id)) id = set[shooting ? 'shoot' : 'idle'];
    return { id, flip: aimsBack(this.aim8) };
  }

  /** The muzzle of the current aim, hip-relative (flipped for the back aims). */
  private muzzle(out: [number, number]): [number, number] {
    const { id, flip } = this.aimStrip(true);
    const m = hasSprite(id) ? framePoint(getFrame(id, 0, 1), 'muzzle', false, false, out) : undefined;
    if (!m) {
      const f = FALLBACK_MUZZLE[this.aim8];
      out[0] = f[0];
      out[1] = f[1];
    }
    if (flip) out[0] = -out[0];
    return out;
  }

  /**
   * Beams follow his gun on the PLANE (weapons.ts `GunMount`; fixer 2026-10-22): the laser beam
   * starts on his plane line at the muzzle's x and keeps his plane aim. Before this the beam
   * read the 2D player's state ('mounted' ≠ 'play') and ended before its first zap: the laser
   * did no damage on the ring.
   */
  get gunReady(): boolean {
    return this.state === 'mounted' && !this.boarding;
  }

  override muzzleWorld(out: [number, number] = [0, 0]): [number, number] {
    const m = this.muzzle(out);
    out[0] = this.x + m[0];
    out[1] = this.y;
    return out;
  }

  override get aimAngle(): number {
    return planeAngle(this.aim8);
  }

  /** One shot along the plane aim from his muzzle (drawn at the muzzle's height). */
  private shootRing(): void {
    const def = this.gun.def;
    const back = aimsBack(this.aim8);
    const m = this.muzzle(pt);
    args.x = this.x + m[0];
    args.y = this.y;
    args.angle = planeAngle(this.aim8);
    args.facing = back ? -1 : 1;
    args.aim = 'forward';
    args.crouching = false;
    args.airborne = false;
    args.vx = this.vx;
    args.vy = 0;
    this.shotLift = Math.max(2, muzzleLift(m[1]));
    this.gun.fire(args);
    this.slot.stats.shots++;
    this.shootT = TUNING.fire.shootAnimTicks * 2;
    if (def.ammo !== Infinity && !this.status.weapon) {
      this.slot.ammo -= def.ammoPerShot ?? 1;
      if (this.slot.ammo <= 0) this.ringOutOfAmmo();
    }
  }

  /** The pickup weapon ran dry: back to the start weapon (as on foot). */
  private ringOutOfAmmo(): void {
    this.slot.weapon = this.startWeapon;
    this.slot.ammo = Infinity;
    this.gun.setWeapon(this.weapon);
    this.gun.lock = TUNING.fire.drawTicks;
    this.gun.reset();
    this.sfx('weapon/empty');
    this.world.events.emit('weaponChanged', { player: this, slot: this.index, weapon: this.slot.weapon });
  }

  // ------------------------------------------------------------------------------- knife and lob

  /**
   * The knife boxes (spec §3): the bonnet (the wagon's own slab, from the window to the nose) and
   * the window (the near lane next to the hero). Fills `knifeA` / `knifeB`.
   */
  private knifeBoxes(w: Wagon): void {
    const front = w.view === 'left' ? -1 : 1;
    knifeA.x = front > 0 ? this.x - 12 : w.x - 52;
    knifeA.w = Math.abs(w.x + front * 52 - (this.x - front * 12));
    knifeA.y = w.y - DEPTH_HALF;
    knifeA.h = DEPTH_HALF * 2;
    knifeB.x = this.x - 16;
    knifeB.w = 38;
    knifeB.y = w.y + DEPTH_HALF;
    knifeB.h = 22;
  }

  /** A soft enemy on the bonnet or at the window? */
  private knifeTarget(w: Wagon): boolean {
    this.knifeBoxes(w);
    const list = this.world.byTag('soft');
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t.alive || !t.hasTag('shootable') || t.team === 'player' || t.team === 'neutral') continue;
      const boxes = t.hurtboxes();
      for (let k = 0; k < boxes.length; k++) if (overlaps(knifeA, boxes[k]) || overlaps(knifeB, boxes[k])) return true;
    }
    return false;
  }

  /** The knife: every soft enemy in the boxes is hit once (as `meleeStrike` on foot). */
  private knifeRing(w: Wagon): void {
    this.knifeBoxes(w);
    const def = this.meleeDef;
    const damage = def.melee?.damage ?? TUNING.knife.damage;
    const list = this.world.snapshotTag('soft');
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || !t.hasTag('shootable') || t.team === 'player' || t.team === 'neutral') continue;
        const boxes = t.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          const b = boxes[k];
          if (!overlaps(knifeA, b) && !overlaps(knifeB, b)) continue;
          this.world.damage(t, { amount: damage, kind: 'knife', dirX: Math.sign(t.x - this.x) || 1, source: this, owner: this.index, weapon: def.id }, k);
          hitSpark(this.world, b.x + b.w / 2, t.y - 10, Math.sign(t.x - this.x) || 1);
          break;
        }
      }
    } finally {
      this.world.releaseSnapshot();
    }
    this.sfx(def.sfx || 'weapon/knife');
    this.knifeCool = def.cooldown ?? TUNING.knife.cooldown;
    this.knifeT = TUNING.fire.knifeTicks;
    this.ringKnives++;
  }

  /** BOMB: a grenade lobbed into the aimed lane (content/ring/wagon/lob.ts). */
  private lobRing(): void {
    if (this.slot.bombs <= 0) {
      this.sfx('weapon/empty');
      return;
    }
    if (this.lobCool > 0 || this.lobsInAir() >= TUNING.grenade.inAir) return;
    const back = aimsBack(this.aim8);
    lob(this.world, this.x + (back ? -6 : 6), this.y, { aim: this.aim8, owner: this.index, lift: -SEAT.heroY + 12, shooter: this });
    this.lobCool = TUNING.grenade.cooldown;
    this.slot.bombs--;
    this.slot.stats.bombsThrown++;
    this.throwT = 18;
  }

  /** His lobs still in the air. */
  private lobsInAir(): number {
    const list = this.world.byTag('ring-lob');
    let n = 0;
    for (let i = 0; i < list.length; i++) if (list[i].alive && (list[i] as Entity & { owner?: number }).owner === this.index) n++;
    return n;
  }

  // ------------------------------------------------------------------------------- life

  /** Waiting on the hard shoulder after a wreck: a fresh wagon, or out of lives. */
  private updateWrecked(): void {
    if (--this.respawnT > 0) return;
    if (this.slot.lives > 0) this.respawn();
    else {
      this.state = 'out';
      this.slot.gameOver = true;
      this.world.events.emit('playerOut', { player: this, slot: this.index });
    }
  }

  /** A state the ring never uses ('play'): back into the wagon, else wait for a fresh one. */
  private recover(): void {
    const w = this.wagon;
    if (w && w.alive) {
      this.state = 'mounted';
      this.removeTag('shootable');
      return;
    }
    this.vehicle = null;
    this.state = 'dead';
    this.dead = true;
    this.removeTag('shootable');
    this.respawnT = 1;
  }

  /** The wagon wrecked (Wagon.wreck): a life is lost; a fresh wagon follows (or the continue). */
  wrecked(_w: Wagon | null = null): void {
    if (this.state === 'dead' || this.state === 'out') return;
    this.vehicle = null;
    this.state = 'dead';
    this.dead = true;
    this.cause = 'impact';
    this.respawnT = RING.respawnTicks;
    this.wreckT = 0;
    this.cheering = false;
    this.boarding = false;
    this.foot = null;
    this.removeTag('shootable');
    this.status.clear();
    this.gun.reset();
    this.bombGun.reset();
    // He tumbles out of the window onto the hard shoulder by the wreck (no harm shown).
    this.y = this.prevY = SHOULDER_TOP + 6;
    const keep = difficultyOf(this.world).hostageLoss === 'checkpoint' ? this.slot.checkpointRescued : 0;
    this.slot.loseLife(keep);
    this.world.events.emit('playerDied', { player: this, slot: this.index, cause: 'impact' });
  }

  /** On the ring a kill always means the wagon is gone (time-outs, scripts, `die`). */
  override kill(_cause: DeathCause): boolean {
    if (this.state === 'dead' || this.state === 'out') return false;
    const w = this.wagon;
    if (w && w.alive) w.wreck();
    else this.wrecked(null);
    return true;
  }

  /** Hits go to the wagon; the hero himself is never hit. */
  override onHit(): boolean {
    return false;
  }

  override onOutOfWorld(): void {}

  override onCrushed(): void {}

  /** A fresh wagon drives in from the left (`mode`: 'respawn', 'continue' or 'join'). */
  override respawn(mode: WagonMode = 'respawn'): void {
    this.dead = false;
    this.cheering = false;
    this.facing = 1;
    this.slot.resetLife(this.startBombs, this.startWeapon);
    this.gun.setWeapon(this.weapon);
    this.gun.reset();
    this.gun.lock = 0;
    this.aim8 = 'forward';
    this.boarding = false;
    this.foot = null;
    spawnWagon(this, mode);
    this.removeTag('shootable');
    this.world.events.emit('playerSpawned', { player: this, slot: this.index, respawn: true });
  }

  /** A continue: full lives, a fresh wagon drives in; its arrival emits `continueLanded`. */
  override continueGame(giftWeapon: string | null = TUNING.continues.giftWeapon): void {
    this.respawn('continue');
    this.ringContinued = true;
    if (giftWeapon && hasWeapon(giftWeapon)) this.giveWeapon(giftWeapon);
  }

  /** The drive-in (or the boarding) ended: in play; a continued hero's arrival makes the enemies cower. */
  arrive(): void {
    if (this.state !== 'spawn') return;
    this.state = 'mounted';
    this.boarding = false;
    this.foot = null;
    this.removeTag('shootable');
    // As the drop-in's POOF (GDD §4.5): enemy shots near the fresh wagon are erased.
    poofCircle.x = this.x;
    poofCircle.y = this.y;
    eraseEnemyShots(this.world, poofCircle);
    if (this.ringContinued) {
      this.ringContinued = false;
      this.world.events.emit('continueLanded', { player: this, slot: this.index });
    }
  }

  /** The mission is won: a cheer from the window (never the on-foot victory pose). */
  override victory(): void {
    if (this.state === 'dead' || this.state === 'out') return;
    this.cheering = true;
  }

  override enterVehicle(v: Mountable, invuln?: number): void {
    super.enterVehicle(v, invuln);
    this.facing = 1;
  }

  /** Nothing throws the hero out on the ring: a forced exit counts as a wreck. */
  override leaveVehicle(_o: DismountOpts): void {
    if (this.state === 'mounted' || this.state === 'spawn') this.wrecked(null);
  }

  /** Placed at a spot (tools): moves the anchor only, the state stays. */
  override placeAt(x: number, y: number, invuln = 60): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.invulnTicks = Math.max(this.invulnTicks, invuln);
  }

  override introDrop(): void {}

  // ------------------------------------------------------------------------------- drawing

  /** The torso strip and frame to draw now (knife, throw, cheer, shoot, aim). */
  private windowFrame(): { id: string; f: number; flip: boolean } {
    const set = this.torsoSet;
    const t = this.world.tick;
    if (this.knifeT > 0) {
      const id = hasSprite(set['knife-b']) && this.ringKnives % 2 === 0 ? set['knife-b'] : set.knife;
      const n = hasSprite(id) ? frameCount(id) : 1;
      const k = 1 - this.knifeT / TUNING.fire.knifeTicks;
      return { id, f: Math.min(n - 1, Math.floor(k * n)), flip: aimsBack(this.aim8) };
    }
    if (this.throwT > 0) {
      const id = set.throw;
      const n = hasSprite(id) ? frameCount(id) : 1;
      return { id, f: Math.min(n - 1, Math.floor((1 - this.throwT / 18) * n)), flip: aimsBack(this.aim8) };
    }
    if (this.cheering) {
      const id = `${this.art}/ride-cheer`;
      if (hasSprite(id)) return { id, f: Math.floor(t / 8) % frameCount(id), flip: false };
    }
    const shooting = this.shootT > 0;
    const { id, flip } = this.aimStrip(shooting);
    const n = hasSprite(id) ? frameCount(id) : 1;
    const f = shooting ? Math.min(n - 1, Math.floor((TUNING.fire.shootAnimTicks * 2 - this.shootT) / 3)) : Math.floor(t / 12) % n;
    return { id, f, flip };
  }

  /**
   * The wagon draws the hero in its window: his torso strip from the hip on the sill (x, y), the
   * gun along the aim; back aims flip him; `carFlip` = the car faces left (the boarding).
   */
  drawInWindow(r: Renderer, x: number, y: number, carFlip = false): void {
    if (this.state === 'dead' || this.state === 'out' || this.boarding) return;
    const { id, f, flip } = this.windowFrame();
    if (!hasSprite(id)) return;
    const mirror = flip !== carFlip;
    // He sits on the sill: his hips stay inside the door, except when he leans out to aim low.
    const low = this.knifeT <= 0 && this.throwT <= 0 && (this.aim8 === 'near' || this.aim8 === 'forward-near' || this.aim8 === 'back-near');
    const fr = getFrame(id, f);
    const d = fr.density ?? 1;
    if (low) {
      r.sprite(id, f, x, y, mirror ? flipOpts : drawOpts);
      return;
    }
    winSrc.x = 0;
    winSrc.y = 0;
    winSrc.w = fr.buf.w / d;
    // Down to the row above the hip: the door hides the hip row (fix 2026-10-21: it covered the
    // top row of the green wagon's ARTISANAL, which read as AKTISANAL at 4×).
    winSrc.h = Math.max(0, Math.min(fr.buf.h / d, fr.oy));
    r.sprite(id, f, x, y, mirror ? winFlipOpts : winOpts);
  }

  /** On foot (the boarding, the wreck): the legs and the idle torso at the legs' hip. */
  private drawStanding(r: Renderer, x: number, y: number, flip = false): void {
    const legs = `${this.art}/legs-idle`;
    const torso = this.torsoSet.idle;
    if (!hasSprite(legs) || !hasSprite(torso)) return;
    const t = this.world.tick;
    const lf = Math.floor(t / 16) % frameCount(legs);
    const hip = framePoint(getFrame(legs, lf), 'hip', flip, false, pt) ?? [0, -16];
    r.sprite(legs, lf, x, y, flip ? flipOpts : drawOpts);
    r.sprite(torso, Math.floor(t / 12) % frameCount(torso), x + hip[0], y + hip[1], flip ? flipOpts : drawOpts);
  }

  /** The somersault (`flip` strip) at frame by progress k (0 … 1). */
  private drawFlip(r: Renderer, x: number, y: number, k: number): void {
    const id = `${this.art}/flip`;
    if (!hasSprite(id)) return this.drawStanding(r, x, y);
    const n = frameCount(id);
    r.sprite(id, Math.min(n - 1, Math.floor(k * n)), x, y, drawOpts);
  }

  /** After a wreck: he tumbles onto the hard shoulder and stands by it. Boarding: on foot. */
  override draw(r: Renderer): void {
    const foot = this.foot;
    if (this.boarding && foot) {
      const x = Math.round(foot.x);
      const y = Math.round(foot.y - foot.lift);
      if (foot.mode === 'jump') this.drawFlip(r, x, y, foot.t);
      else this.drawStanding(r, x, y);
      return;
    }
    if (this.state !== 'dead') return;
    const t = this.wreckT;
    if (t < WRECK_SPIN) return; // still in the spinning wagon
    const k = Math.min(1, (t - WRECK_SPIN) / 18);
    const x = Math.round(this.x + k * 6);
    const y = Math.round(this.y - Math.sin(k * Math.PI) * 14);
    if (k < 1) this.drawFlip(r, x, y, k);
    else this.drawStanding(r, x, y);
  }
}

