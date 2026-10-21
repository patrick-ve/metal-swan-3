/**
 * `oz-swan-jet` — the finale of oz-f (docs/design/oldenzaal.md §9): the Metal Swan with two rocket
 * units under her wings flies in from the storm, hovers beside the roof, the heroes jump on (in 2P
 * the second hero rides on her tail perch), she turns and flies off into the clouds with a long jet
 * trail. Modelled on the m5 finale's ship (`m5/finale.ts`): a cosmetic `Mountable` (players climb
 * in with `enterVehicle`), NOT a `Vehicle` (no cells, no HUD, a zero hitbox). Owner: TOWER.
 *
 * Her look stays her own: the ridden `vehicle/swan/glide` strip (body, `-front` overlay, the
 * relaxed neck at the frame's `neck` point, the riders at `seat` and `perch`); only the jet units
 * (`vehicle/oz-swan-jet/unit`: 3 nozzle angles), their blue-white flames (`fx/oz/tower/jet-flame`)
 * and the trail (`fx/oz/tower/trail`) are new.
 *
 * Modes: 'enter' (eases in from `SWAN_JET.from…` to the hover point, nozzles swinging down),
 * 'hover' (bobs; takes every hero whose feet reach the seat zone), 'turn' (she turns to face the
 * clouds), 'leave' (up and away, the trail behind her).
 * `boardSwan(ctx, swan, patience)` (below) takes the heroes' pads over: run to her, jump on;
 * stragglers are seated when the patience runs out (as in m5).
 */
import { Entity } from '../../../../engine/entity';
import { toMask, VirtualPad, type Button } from '../../../../engine/input';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import { framePoint, getFrame, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import type { SectionContext } from '../../../mission/index';
import type { Mountable, Player } from '../../../player/player';
import { NO_PARAMS, type SpawnParams } from '../../../registry';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { SWAN_JET } from './layout';

/** Sprite ids: her own art + the new jet parts. */
export const SWAN_JET_ART = {
  body: 'vehicle/swan/glide',
  front: 'vehicle/swan/glide-front',
  neck: 'vehicle/swan/neck-relax',
  /** The rocket unit: frame 0 nozzle back (flight), 1 at 45°, 2 straight down (hover). */
  unit: 'vehicle/oz-swan-jet/unit',
  /** The flame: frames 0–2 back, 3–5 at 45°, 6–8 down (a flicker of 3 each). */
  flame: 'fx/oz/tower/jet-flame',
  /** A trail puff: frames 0–3 by age (a hot core → grey vapour). */
  trail: 'fx/oz/tower/trail',
} as const;

/** Seat zone (feet of a hero, relative to her feet anchor, facing right), timings. */
export const SWAN_JET_RIDE = {
  zone: { x: -30, y: -66, w: 50, h: 40 },
  /** Ticks of the ease in and of the turn. */
  enterTicks: 120,
  turnTicks: 24,
  /** The units hang under the wings: offsets from the anchor (facing right), the far one behind. */
  unitNear: [-4, -26],
  unitFar: [5, -30],
  /** Nozzle (flame) offset from a unit's anchor per angle frame (facing right). */
  nozzle: [
    [-10, 0],
    [-7, 7],
    [0, 10],
  ],
  /** Fallback seat / perch when a frame has no such point. */
  seat: [-4, -40],
  perch: [-22, -38],
} as const;

export type SwanJetMode = 'enter' | 'hover' | 'turn' | 'leave';

/** Trail puffs kept (a ring buffer: no allocation in play). */
const TRAIL_N = 56;
const opts: DrawOpts = {};
const pt: [number, number] = [0, 0];

export class SwanJet extends Entity implements Mountable, LightSource {
  mode: SwanJetMode = 'enter';
  readonly passengers: Player[] = [];
  private t = 0;
  private readonly fromX: number;
  private readonly fromY: number;
  /** The hover point (world px; the camera holds at the top of the tower). */
  readonly hoverX: number;
  readonly hoverY: number;
  /** She faces left while she comes in and hovers (from the right), right when she leaves. */
  private flip = true;
  /** Nozzle angle frame 0 (back) … 2 (down), eased. */
  private nozzleK = 0;
  private readonly trailX = new Float32Array(TRAIL_N);
  private readonly trailY = new Float32Array(TRAIL_N);
  private readonly trailT = new Int32Array(TRAIL_N).fill(-1);
  private trailHead = 0;
  private looping = false;
  private readonly loopKey: string;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    void p;
    this.fromX = x;
    this.fromY = y;
    const cam = world.camera;
    this.hoverX = cam.left + SWAN_JET.hoverX;
    this.hoverY = Math.min(SWAN_JET.hoverY, cam.top + 200);
    this.z = 74;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    this.loopKey = `oz-swan-jet-${this.id}`;
    this.addTag('decor', 'oz-swan-jet', LIGHT_TAG);
    world.audio.sfx('oz/swan/ignite', { vol: 0.9 });
  }

  get arrived(): boolean {
    return this.mode === 'hover';
  }

  get facing1(): 1 | -1 {
    return this.flip ? -1 : 1;
  }

  /** Is this hero's feet point inside the seat zone? */
  inZone(p: Player): boolean {
    const z = SWAN_JET_RIDE.zone;
    const zx = this.flip ? this.x - z.x - z.w : this.x + z.x;
    return p.x >= zx && p.x <= zx + z.w && p.y >= this.y + z.y && p.y <= this.y + z.y + z.h;
  }

  /** The zone's centre x (where a hero aims his jump). */
  zoneCenterX(): number {
    const z = SWAN_JET_RIDE.zone;
    return this.flip ? this.x - z.x - z.w / 2 : this.x + z.x + z.w / 2;
  }

  canMount(p: Player): boolean {
    return this.mode === 'hover' && p.state === 'play' && p.alive && !this.passengers.includes(p) && this.passengers.length < 2;
  }

  mount(p: Player): void {
    if (this.passengers.includes(p)) return;
    // A mounted player cannot be hit (Player.onHit), and invulnerability would make him blink.
    p.enterVehicle(this, 0);
    p.invulnTicks = 0;
    this.passengers.push(p);
    this.world.audio.sfx('swan/honk', { vol: 0.6, pitch: 1.15 });
    this.world.particles.dust(p.x, p.y);
    this.placeRiders();
  }

  /** Seat every hero still on foot (the script's patience ran out). */
  boardAll(players: readonly Player[]): void {
    for (const p of players) if (this.canMount(p)) this.mount(p);
  }

  /** Every hero who can still play is aboard. */
  allAboard(players: readonly Player[]): boolean {
    for (const p of players) {
      if (this.passengers.includes(p)) continue;
      if (p.state === 'out' || p.state === 'victory') continue;
      return false;
    }
    return true;
  }

  /** Turn to the clouds and fly off. */
  leave(): void {
    if (this.mode === 'turn' || this.mode === 'leave') return;
    this.mode = 'turn';
    this.t = 0;
  }

  /** Has she flown out of the view (the script may end the mission)? */
  get gone(): boolean {
    const cam = this.world.camera;
    return this.mode === 'leave' && (this.x > cam.right + 80 || this.y < cam.top - 90);
  }

  override update(): void {
    this.t++;
    const t = this.t;
    if (this.mode === 'enter') {
      const n = SWAN_JET_RIDE.enterTicks;
      const u = Math.min(1, t / n);
      const e = 1 - (1 - u) * (1 - u) * (1 - u);
      this.x = this.fromX + (this.hoverX - this.fromX) * e;
      // A low arc: she dips under the clouds, then rises to the roof's edge.
      this.y = this.fromY + (this.hoverY - this.fromY) * e - Math.sin(u * Math.PI) * 10;
      this.nozzleK = Math.min(2, u * 2.6);
      if (u >= 1) {
        this.mode = 'hover';
        this.t = 0;
      }
    } else if (this.mode === 'hover') {
      this.x = this.hoverX;
      this.y = this.hoverY + Math.round(Math.sin(t / 14) * 1.5);
      this.nozzleK = 2;
      for (const e of this.world.players) {
        const p = e as Player;
        if (this.inZone(p) && this.canMount(p)) this.mount(p);
      }
    } else if (this.mode === 'turn') {
      const n = SWAN_JET_RIDE.turnTicks;
      if (t === n >> 1) {
        this.flip = false;
        this.world.particles.dust(this.x, this.y - 20);
      }
      this.y -= 0.3;
      this.nozzleK = Math.max(1, 2 - t / n);
      if (t >= n) {
        this.mode = 'leave';
        this.t = 0;
        this.world.audio.sfx('oz/swan/flyby', { vol: 1 });
      }
    } else {
      // Up and away into the clouds, faster and faster.
      const k = Math.min(1, t / 50);
      this.x += SWAN_JET.leaveVx * k + 0.4;
      this.y += SWAN_JET.leaveVy * k - 0.2;
      this.nozzleK = Math.max(0, 1 - t / 20);
    }
    this.placeRiders();
    // The trail: a puff every other tick from the near unit's nozzle (cosmetic).
    for (let i = 0; i < TRAIL_N; i++) if (this.trailT[i] >= 0 && ++this.trailT[i] > 90) this.trailT[i] = -1;
    if ((this.mode === 'leave' || this.mode === 'turn' || this.mode === 'enter') && (t & 1) === 0) {
      const nz = this.nozzleAt(SWAN_JET_RIDE.unitNear);
      const h = this.trailHead;
      this.trailX[h] = nz[0];
      this.trailY[h] = nz[1];
      this.trailT[h] = 0;
      this.trailHead = (h + 1) % TRAIL_N;
    }
    if (!this.looping && !this.gone) {
      this.looping = true;
      this.world.audio.sfxLoop?.(this.loopKey, 'oz/swan/jet', { vol: 0.7 });
    } else if (this.looping && this.gone) {
      this.looping = false;
      this.world.audio.stopSfx?.(this.loopKey, 30);
    }
  }

  override onRemove(): void {
    if (this.looping) this.world.audio.stopSfx?.(this.loopKey);
    this.looping = false;
  }

  /** The riders sit at her `seat` (P1) and stand on her tail `perch` (P2). */
  private placeRiders(): void {
    for (let i = 0; i < this.passengers.length; i++) {
      const p = this.passengers[i];
      const s = this.riderPoint(i);
      p.x = this.x + s[0];
      p.y = this.y + s[1];
      p.facing = this.flip ? -1 : 1;
    }
  }

  /** The seat (i 0) or perch (i 1) offset now (mirrored when she faces left). */
  private riderPoint(i: number): [number, number] {
    const name = i === 0 ? 'seat' : 'perch';
    const fb = i === 0 ? SWAN_JET_RIDE.seat : SWAN_JET_RIDE.perch;
    const f = hasSprite(SWAN_JET_ART.body) ? getFrame(SWAN_JET_ART.body, this.bodyFrame(), 1) : null;
    const got = f ? framePoint(f, name, this.flip, false, pt) : undefined;
    if (got) return got;
    pt[0] = this.flip ? -fb[0] : fb[0];
    pt[1] = fb[1];
    return pt;
  }

  private bodyFrame(): number {
    return (this.world.tick >> 3) & 1;
  }

  private readonly nz: [number, number] = [0, 0];

  /** A unit's nozzle in world px (facing-aware). */
  private nozzleAt(unit: readonly number[]): [number, number] {
    const k = Math.round(this.nozzleK);
    const n = SWAN_JET_RIDE.nozzle[k];
    const d = this.flip ? -1 : 1;
    this.nz[0] = this.x + (unit[0] + n[0]) * d;
    this.nz[1] = this.y + unit[1] + n[1];
    return this.nz;
  }

  /** The jets light the roof and her underside (the light pass). */
  lightOf(out: LightSpot, tick: number): boolean {
    const n = this.nozzleAt(SWAN_JET_RIDE.unitNear);
    out.x = n[0];
    out.y = n[1] + 4;
    out.r = 50 + ((tick >> 1) & 3) * 2;
    out.color = PAL_HD.sky[6];
    out.intensity = 0.6;
    out.flicker = 0.2;
    return true;
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const t = this.world.tick;
    const flip = this.flip;
    const d = flip ? -1 : 1;
    const k = Math.round(this.nozzleK);
    // The trail first (behind her): old puffs fade.
    for (let i = 0; i < TRAIL_N; i++) {
      const age = this.trailT[i];
      if (age < 0) continue;
      opts.flipX = false;
      opts.alpha = Math.max(0, 0.9 - age / 100);
      r.sprite(SWAN_JET_ART.trail, Math.min(3, age >> 3), Math.round(this.trailX[i]), Math.round(this.trailY[i] - age * 0.08), opts);
    }
    opts.alpha = 1;
    opts.flipX = flip;
    const fi = this.bodyFrame();
    const far = SWAN_JET_RIDE.unitFar;
    const near = SWAN_JET_RIDE.unitNear;
    // The far unit and its flame behind her body.
    this.drawFlame(r, far, k, t + 1);
    opts.flipX = flip;
    r.sprite(SWAN_JET_ART.unit, k, x + far[0] * d, y + far[1], opts);
    r.sprite(SWAN_JET_ART.body, fi, x, y, opts);
    // The riders: P1 in the seat, P2 on the tail perch.
    for (let i = this.passengers.length - 1; i >= 0; i--) {
      const s = this.riderPoint(i);
      this.passengers[i].drawRide(r, x + s[0], y + s[1], flip, i === 0 ? 'lean' : 'cheer');
    }
    opts.flipX = flip;
    opts.alpha = 1;
    if (hasSprite(SWAN_JET_ART.front)) r.sprite(SWAN_JET_ART.front, fi, x, y, opts);
    const bf = hasSprite(SWAN_JET_ART.body) ? getFrame(SWAN_JET_ART.body, fi, 1) : null;
    const nk = bf ? framePoint(bf, 'neck', flip, false, pt) : undefined;
    if (nk && hasSprite(SWAN_JET_ART.neck)) r.sprite(SWAN_JET_ART.neck, 0, x + nk[0], y + nk[1], opts);
    // The near unit and its flame in front.
    r.sprite(SWAN_JET_ART.unit, k, x + near[0] * d, y + near[1], opts);
    this.drawFlame(r, near, k, t);
    opts.flipX = false;
  }

  private drawFlame(r: Renderer, unit: readonly number[], k: number, t: number): void {
    const n = this.nozzleAt(unit);
    opts.flipX = this.flip;
    opts.alpha = 1;
    r.sprite(SWAN_JET_ART.flame, k * 3 + (t % 3), Math.round(n[0]), Math.round(n[1]), opts);
  }
}

// ---------------------------------------------------------------------------------------------
// Boarding (the heroes' pads are taken over)
// ---------------------------------------------------------------------------------------------

const RIGHT: Button[] = ['right'];
const LEFT: Button[] = ['left'];
const RIGHT_JUMP: Button[] = ['right', 'jump'];
const LEFT_JUMP: Button[] = ['left', 'jump'];
const JUMP: Button[] = ['jump'];

/**
 * The heroes run to the Swan and jump on (a private `VirtualPad` per hero, as in the m5 finale).
 * Runs until every hero is aboard or out; `patience` ticks after she arrives the stragglers are
 * seated (`boardAll`).
 */
export function* boardSwan(ctx: SectionContext, swan: SwanJet, patience = 240): ScriptGen {
  const players = ctx.players as readonly Player[];
  const pads = players.map(() => new VirtualPad());
  const lastX = players.map((p) => p.x);
  const prevJump = players.map(() => false);
  for (let i = 0; i < players.length; i++) players[i].pad = pads[i];
  let waited = 0;
  for (;;) {
    if (swan.allAboard(players)) return;
    if (swan.arrived && ++waited > patience) {
      swan.boardAll(players);
      return;
    }
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (swan.passengers.includes(p)) continue;
      const dx = swan.zoneCenterX() - p.x;
      const dir = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
      const stuck = dir !== 0 && Math.abs(p.x - lastX[i]) < 0.2 && p.onGround;
      const wantJump = p.onGround && !prevJump[i] && ((dir !== 0 && stuck) || (swan.arrived && Math.abs(dx) < 26));
      const spec = dir > 0 ? (wantJump ? RIGHT_JUMP : RIGHT) : dir < 0 ? (wantJump ? LEFT_JUMP : LEFT) : wantJump ? JUMP : null;
      pads[i].update(toMask(spec));
      prevJump[i] = wantJump;
      lastX[i] = p.x;
    }
    yield;
  }
}
