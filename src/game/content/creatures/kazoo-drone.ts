/**
 * `kazoo-drone` — the Kazoo Drone (docs/GAME_DESIGN.md §9.3; m4, m5). 16×12, 10 HP (20 in flight:
 * while a player flies a `trumpeter`), 100 points. Contact kills (a small creature: touching a
 * driven player vehicle breaks it and costs the vehicle ½ cell, GDD §8.5).
 *
 * One spawn is a whole formation of 5 (`params.formation`); the spawned drone is the leader and
 * puts its 4 wingmen behind it on its first tick. The spawn point is the leader's start; the
 * formation flies toward the view centre (or along `facing` / `enter`).
 * - `v`: a V, 16 px back and 12 px up / down per rank, crosses at 1.5 px/tick.
 * - `sine`: a line 20 px apart, y = base ± 24·sin(t/30), at 1.5 px/tick (each drone follows the
 *   leader's path, so the line snakes).
 * - `loop`: flies 128 px in, one loop of radius 64 (up, or down when there is no room above and
 *   room below), and leaves; the line is 20 px apart. Spawn y ≥ view top + 136 keeps an upward
 *   loop fully in view.
 * - `dive`: flies to a row at the top of the view (48 px apart), hovers 60 ticks, then each in turn
 *   (24 ticks apart) telegraphs 20 ticks (buzzes higher and glows) and dives at the player's
 *   position at 2.5 px/tick, then swoops away off the screen.
 * - Shot (`params.shooter`): T 20 (buzzes higher and glows) → one slow note bullet at 1.5 px/tick
 *   aimed at the player, then 150 ticks until the next one (first one 40–120 ticks after the drone
 *   comes into view). `shooter: true` arms every drone, a number arms that many (from the leader).
 * - FULL SET +1,000 (GDD §14.2): all 5 killed by players (none escaped); the last killer scores.
 * - Death: pops into confetti (die); blasted or burnt it tumbles down.
 * - One `creature/kazoo` loop per formation while a drone of it is in view (higher pitch while
 *   one of them telegraphs).
 *
 * Params: `formation` (`v` default | `sine` | `loop` | `dive`), `shooter` (true | count), `count`
 * (formation size, default 5), `facing` / `enter`, plus the Enemy params `hp`, `drop`, `tag`.
 * Our choices: V rank offsets, the sine speed, the 128 px run-in of the loop, the dive row (28 px
 * under the view top), the dive stagger, the shot interval, note damage 10.
 */
import type { SfxOpts } from '../../../engine/audio';
import type { Damage } from '../../../engine/entity';
import { PAL } from '../../../engine/palette';
import type { Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { awardScore } from '../../events';
import { confetti } from '../../fx';
import { isPlayer } from '../../player/player';
import { defineEntity, paramFacing, paramStr, type SpawnParams } from '../../registry';
import { Creature, contactHit, entryParam } from './common';

/** Kazoo drone numbers (GDD §9.3; NORMAL). */
export const KAZOO = {
  hp: 10,
  hpFlight: 20,
  score: 100,
  fullSet: 1000,
  count: 5,
  speed: 1.5,
  /** V: px back and px up / down per rank. */
  vBack: 16,
  vSide: 12,
  /** Sine and loop lines: px between drones. */
  gap: 20,
  sineAmp: 24,
  /** y = base ± amp·sin(t / sinePeriod). */
  sinePeriod: 30,
  loopR: 64,
  loopLead: 128,
  /** Dive: the row under the view top, its spacing, hover, stagger, telegraph, speeds. */
  rowY: 28,
  rowGap: 48,
  approach: 2.5,
  hover: 60,
  stagger: 24,
  tele: 20,
  dive: 2.5,
  swoopVy: -1.6,
  /** Shot: telegraph, note speed, damage, interval, first shot window after entering the view. */
  noteSpeed: 1.5,
  noteDamage: 10,
  shotEvery: 150,
  firstShot: [40, 120],
  box: { x: -8, y: -6, w: 16, h: 12 },
} as const;

export type Formation = 'v' | 'sine' | 'loop' | 'dive';
const A = 'creature/kazoo-drone';
const TAU = Math.PI * 2;
const muzzle: [number, number] = [0, 0];
/** The formation's kazoo loop options (reused every tick). */
const loopOpts: SfxOpts = { vol: 0.45, pitch: 1 };

/** One formation: shared by its drones (FULL SET tally, the kazoo loop, the path start). */
export class KazooFormation {
  readonly kind: Formation;
  readonly size: number;
  readonly dir: 1 | -1;
  readonly x0: number;
  readonly y0: number;
  /** Loop: -1 = up, 1 = down. */
  readonly loopDir: 1 | -1;
  readonly members: KazooDrone[] = [];
  readonly loopKey: string;
  killed = 0;
  /** A drone left the screen or died without a player's hit: no FULL SET. */
  broken = false;
  /** Members still in the world. */
  live = 0;
  /** Ticks the loop sound has run this tick (one owner per tick: the first member that thinks). */
  soundTick = -1;
  telling = false;

  constructor(world: World, kind: Formation, size: number, dir: 1 | -1, x0: number, y0: number, id: number) {
    this.kind = kind;
    this.size = size;
    this.dir = dir;
    this.x0 = x0;
    this.y0 = y0;
    // Up when the loop fits under the view top; else down when it fits above the floor and the
    // view bottom; else up anyway (the top of the loop leaves the view for a moment).
    const d = 2 * KAZOO.loopR + 8;
    const cam = world.camera;
    const floor = world.terrain.surfaceY(x0 + dir * (KAZOO.loopLead + KAZOO.loopR), y0);
    this.loopDir = y0 - d >= cam.top || y0 + d > Math.min(floor, cam.top + cam.h) ? -1 : 1;
    this.loopKey = `kazoo-drone-${id}`;
  }
}

export class KazooDrone extends Creature {
  readonly group: KazooFormation;
  readonly slot: number;
  /** Ticks along the formation path (paused while a reaction runs). */
  private pt = 0;
  private shooter: boolean;
  private shotCool = -1;
  private telegraph: number = KAZOO.tele;
  /** Dive: hover end, dive velocity and the distance left before it swoops away. */
  private hoverLeft = 0;
  private diveVx = 0;
  private diveVy = 0;
  private diveLeft = 0;
  /** The running telegraph is a dive (else the note shot). */
  private diveTell = false;
  private flash = false;
  private readonly touch: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const flight = anyoneFlying(world);
    super(world, x, y, p, { art: A, hp: flight ? KAZOO.hpFlight : KAZOO.hp, w: KAZOO.box.w, h: KAZOO.box.h, body: false });
    this.hitbox.x = KAZOO.box.x;
    this.hitbox.y = KAZOO.box.y;
    this.touch = contactHit(this, 'bullet');
    this.alerted = true;
    const g = p.group;
    if (g instanceof KazooFormation) {
      this.group = g;
      this.slot = typeof p.slot === 'number' ? p.slot : g.members.length;
      // Wingmen join on the leader's first tick: start one path tick in, level with it.
      this.pt = typeof p.pt === 'number' ? p.pt : 0;
    } else {
      const f = paramStr(p, 'formation', 'v');
      const kind: Formation = f === 'sine' || f === 'loop' || f === 'dive' ? f : 'v';
      const n = typeof p.count === 'number' ? Math.max(1, Math.min(8, Math.round(p.count))) : KAZOO.count;
      const entry = entryParam(p);
      const toward: 1 | -1 = entry === 'left' ? 1 : entry === 'right' ? -1 : x > world.camera.left + world.camera.w / 2 ? -1 : 1;
      const dir = paramFacing(p, toward);
      this.group = new KazooFormation(world, kind, n, dir, x, y, this.id);
      this.slot = 0;
    }
    this.group.members.push(this);
    this.group.live++;
    const sh = p.shooter;
    this.shooter = sh === true || (typeof sh === 'number' && this.slot < sh);
    this.facing = this.group.dir;
    this.hoverLeft = KAZOO.hover + this.slot * KAZOO.stagger;
    this.setMode(this.group.kind === 'dive' ? 'enter' : 'fly');
    this.placeOnPath();
    this.prevX = this.x;
    this.prevY = this.y;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    this.flash = false;
    if (this.slot === 0 && this.pt === 0) this.spawnWingmen();
    this.pt++;
    switch (this.mode) {
      case 'fly':
        this.placeOnPath();
        this.thinkShot();
        break;
      case 'tell':
        if (this.diveTell) this.thinkDiveTell();
        else {
          this.placeOnPath();
          this.thinkShotTell();
        }
        break;
      case 'enter':
        this.thinkEnter();
        break;
      case 'hover':
        this.thinkHover();
        break;
      case 'dive':
        this.thinkDive();
        break;
      case 'leave':
        this.moveBy(this.vx, this.vy);
        break;
    }
    if (Math.abs(this.vx) > 0.2) this.facing = this.vx < 0 ? -1 : 1;
    this.play(this.mode === 'tell' ? 'tell' : this.mode === 'dive' ? 'attack' : 'walk');
    this.dangerous();
    if (this.dead) return;
    this.sound();
  }

  /** The leader's first tick: the wingmen take their places behind it. */
  private spawnWingmen(): void {
    const g = this.group;
    for (let i = 1; i < g.size; i++) this.world.spawn('kazoo-drone', g.x0, g.y0, { group: g, slot: i, pt: 1, shooter: this.params.shooter ?? false, hp: this.maxHp });
  }

  /** Move to the formation path point for the current path time (v, sine, loop; dive enters). */
  private placeOnPath(): void {
    const g = this.group;
    const d = g.dir;
    const i = this.slot;
    let x: number;
    let y: number;
    if (g.kind === 'v') {
      const rank = (i + 1) >> 1;
      const side = i % 2 === 1 ? -1 : 1;
      x = g.x0 + d * (KAZOO.speed * this.pt - KAZOO.vBack * rank);
      y = g.y0 + side * KAZOO.vSide * rank;
    } else if (g.kind === 'dive') {
      // Waiting behind the leader before the run to the row.
      x = g.x0 - d * KAZOO.gap * i;
      y = g.y0;
      if (this.pt > 0) return;
    } else {
      const tau = this.pt - (i * KAZOO.gap) / KAZOO.speed;
      const s = KAZOO.speed * tau;
      if (g.kind === 'sine') {
        x = g.x0 + d * s;
        y = g.y0 + (tau > 0 ? KAZOO.sineAmp * Math.sin(tau / KAZOO.sinePeriod) : 0);
      } else {
        const R = KAZOO.loopR;
        const lead = KAZOO.loopLead;
        if (s < lead) {
          x = g.x0 + d * s;
          y = g.y0;
        } else if (s < lead + TAU * R) {
          // A full circle tangent to the run-in line: forward, then up (or down), over and back.
          const th = (s - lead) / R;
          x = g.x0 + d * (lead + R * Math.sin(th));
          y = g.y0 + g.loopDir * R * (1 - Math.cos(th));
        } else {
          x = g.x0 + d * (s - TAU * R);
          y = g.y0;
        }
      }
    }
    this.vx = x - this.x;
    this.vy = y - this.y;
    this.x = x;
    this.y = y;
  }

  private moveBy(dx: number, dy: number): void {
    this.vx = dx;
    this.vy = dy;
    this.x += dx;
    this.y += dy;
  }

  // ------------------------------------------------------------------------------- the note shot

  private thinkShot(): void {
    if (!this.shooter) return;
    if (this.shotCool < 0) {
      // Armed once the drone is in view.
      if (this.onScreen(-8)) this.shotCool = this.world.rng.int(KAZOO.firstShot[0], KAZOO.firstShot[1]);
      return;
    }
    if (this.shotCool > 0) {
      this.shotCool--;
      return;
    }
    if (this.onScreen(-8) && this.target() && this.takeToken()) this.startTell(false);
    else this.shotCool = 10;
  }

  private startTell(dive: boolean): void {
    this.diveTell = dive;
    this.telegraph = this.tele(KAZOO.tele);
    this.setMode('tell');
  }

  private thinkShotTell(): void {
    this.flash = this.modeT % 4 < 2;
    this.group.telling = true;
    if (this.modeT < this.telegraph) return;
    this.point('muzzle', 8, 0, muzzle);
    // Rule 3: it fires only from inside the view.
    if (this.inView(muzzle[0], muzzle[1]) && this.target()) {
      const n = this.shoot({ speed: KAZOO.noteSpeed, damage: KAZOO.noteDamage, sprite: `${A}/note`, angle: this.aimAt(muzzle[0], muzzle[1]), x: muzzle[0], y: muzzle[1], w: 6, h: 6, life: 320, look: 'anim' });
      n.type = 'note-bullet';
      this.world.audio.sfx('enemy/piccolo-shot', { pitch: 0.7, vol: 0.6 });
    }
    this.releaseToken();
    this.shotCool = KAZOO.shotEvery;
    this.setMode(this.group.kind === 'dive' ? 'hover' : 'fly');
  }

  // ------------------------------------------------------------------------------- dive

  /** Run to its place in the row under the view top (kept relative to the camera). */
  private thinkEnter(): void {
    const c = this.world.camera;
    const gx = c.left + c.w / 2 + (this.slot - (this.group.size - 1) / 2) * KAZOO.rowGap * -this.group.dir;
    const gy = c.top + KAZOO.rowY + (this.slot % 2) * 8;
    const dx = gx - this.x;
    const dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= KAZOO.approach) {
      this.moveBy(dx, dy);
      this.setMode('hover');
      return;
    }
    this.moveBy((dx / d) * KAZOO.approach, (dy / d) * KAZOO.approach);
  }

  private thinkHover(): void {
    // Keep the place in the row while the camera scrolls; bob a little.
    const c = this.world.camera;
    const gx = c.left + c.w / 2 + (this.slot - (this.group.size - 1) / 2) * KAZOO.rowGap * -this.group.dir;
    const gy = c.top + KAZOO.rowY + (this.slot % 2) * 8 + Math.round(Math.sin(this.age / 10) * 2);
    this.moveBy(gx - this.x, gy - this.y);
    this.vx = 0;
    this.facePlayer();
    if (this.hoverLeft > 0) {
      this.hoverLeft--;
      this.thinkShot();
      return;
    }
    if (this.onScreen(-8) && this.target() && this.takeToken()) {
      this.startTell(true);
    } else this.hoverLeft = 6;
  }

  private thinkDiveTell(): void {
    this.flash = this.modeT % 4 < 2;
    this.group.telling = true;
    this.moveBy(0, 0);
    if (this.modeT < this.telegraph) return;
    const t = this.target();
    // Rule 3: it dives only from inside the view.
    if (!t || !this.onScreen(-8)) {
      this.releaseToken();
      this.hoverLeft = 30;
      this.setMode('hover');
      return;
    }
    const tx = t.x;
    const ty = t.y + t.hitbox.y * 0.5;
    const d = Math.hypot(tx - this.x, ty - this.y) || 1;
    this.diveVx = ((tx - this.x) / d) * KAZOO.dive;
    this.diveVy = ((ty - this.y) / d) * KAZOO.dive;
    this.diveLeft = d + 8;
    this.setMode('dive');
  }

  private thinkDive(): void {
    this.diveLeft -= KAZOO.dive;
    if (this.diveLeft <= 0 || this.world.terrain.isSolid(this.x + this.diveVx * 3, this.y + this.diveVy * 3 + 6)) return this.swoop();
    this.moveBy(this.diveVx, this.diveVy);
  }

  /** Past the aim point (or about to touch the ground): pull up and fly off the screen. */
  private swoop(): void {
    this.releaseToken();
    const sx = Math.abs(this.diveVx) > 0.3 ? Math.sign(this.diveVx) : this.group.dir;
    this.setMode('leave');
    this.moveBy(sx * KAZOO.dive, KAZOO.swoopVy);
  }

  // ------------------------------------------------------------------------------- contact, sound

  /** Always dangerous to touch; touching a driven vehicle breaks it (½ cell, GDD §8.5). */
  private dangerous(): void {
    this.touch.dirX = this.facing;
    this.contactDamage = this.touch;
    this.breakOnVehicle(this.touch);
  }

  /** One kazoo loop per formation: the first member in view this tick drives it. */
  private sound(): void {
    const g = this.group;
    const tick = this.world.tick;
    if (g.soundTick === tick || !this.onScreen(16)) return;
    g.soundTick = tick;
    loopOpts.pitch = g.telling ? 1.5 : 1;
    this.world.audio.sfxLoop?.(g.loopKey, 'creature/kazoo', loopOpts);
    g.telling = false;
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.flash = false;
    if (this.mode === 'tell') {
      this.shotCool = 30;
      this.hoverLeft = 30;
      this.setMode(this.group.kind === 'dive' ? 'hover' : 'fly');
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override deathEffects(d: Damage): void {
    const w = this.world;
    const g = this.group;
    confetti(w, this.x, this.y, 14, 2);
    w.audio.sfx('hit/metal', { pitch: 1.7, vol: 0.6 });
    this.corpseTicks = 6;
    this.vx = d.dirX * 0.5;
    this.vy = -1;
    const slot = d.owner === 0 || d.owner === 1 ? d.owner : -1;
    if (slot < 0) g.broken = true;
    else g.killed++;
    if (!g.broken && g.killed === g.size) {
      awardScore(w, slot, KAZOO.fullSet, this.x, this.y - 20);
      hudOf(w).callout(`FULL SET! +${KAZOO.fullSet}`);
    }
  }

  /**
   * Blasted, burnt or crushed drones tumble down to the floor (no physics body: fall by hand);
   * those strips stand on (x, y). The confetti pop stays where it burst.
   */
  protected override updateDeath(): void {
    if (Number.isFinite(this.vy) && !this.playing('die')) {
      const ny = this.y + this.vy;
      const floor = this.world.terrain.surfaceY(this.x, this.y - 1, ny);
      if (Number.isFinite(floor) && this.vy > 0) {
        this.y = floor;
        this.vy = NaN;
      } else {
        this.y = ny;
        this.x += this.vx;
        this.vy = Math.min(this.vy + 0.18, 4);
      }
    }
    super.updateDeath();
  }

  override onRemove(): void {
    const g = this.group;
    if (!this.dead) g.broken = true;
    if (--g.live <= 0) this.world.audio.stopSfx?.(g.loopKey, 10);
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.flash && !this.dead) this.drawTint(r, PAL.gold[3], 0.6);
  }
}

/** Is any player flying a Trumpeter (m5-a)? Then drones have 20 HP (GDD §9.3 "in flight"). */
function anyoneFlying(world: World): boolean {
  const ps = world.players;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (isPlayer(p) && p.vehicle && (p.vehicle as { type?: string }).type === 'trumpeter') return true;
  }
  return false;
}

defineEntity('kazoo-drone', (w, x, y, p) => new KazooDrone(w, x, y, p), {
  category: 'enemy',
  score: KAZOO.score,
  description: 'Kazoo Drone: a formation of 5 (v | sine | loop | dive), optional note shooters; FULL SET +1,000 (m4, m5).',
});
