/**
 * The canal cruise of mission ams, section c2 RONDVAART (docs/design/ams-extras.md §4): the boat
 * the players ride, the low bridges it passes under, the Magere Brug set piece and the small party
 * boat of the stag-party hook. Art: `art-route.ts` (1×) and `art-hd-route.ts` (2× / 4×).
 *
 * | id | params | what |
 * |---|---|---|
 * | `ams-cruise-boat` | x = the STERN, y = the deck (= the quay ground, 176) | A long, low tour boat with a glass roof (192 px). The deck (x + 4 … x + 188) and the glass roof (x + 44 … x + 164, 24 px above the deck) are one-way platforms that carry their riders. While it `leads` it holds the camera: the view's left edge is `CRUISE.sternVx` px behind the stern, so the view edges push the players. `depart()`, `cruiseTo(x)` (sails on and stops with its stern at x, slowing down in 1/8-px steps), `go()` (no stop), `release()` (stops holding the camera). It holds still while every player is out (the continue countdown). Its skipper says `BUKKEN!` when a low bridge comes into view. z 18 |
 * | `ams-low-bridge` | x = the centre, y = the walkway (the slab top, 112); `w` (56), `under` (127) | A low brick bridge over the river: a solid slab from y to `under`, so enemies stand on it and a jump bonks on its underside. A player standing on the roof (head above `under`) is stopped by its face and killed (`crush`); a crouching player passes under. It never kills before it has been in view `LOW_BRIDGE.warn` ticks (else, and in god mode, it only sweeps the player off the roof). `warnT` = ticks in view (−1 = not yet), `kills`. Art: decor `decor/ams/low-bridge` (front) and `…/back` |
 * | `ams-magere-brug` | x = the centre, y = the walkway (112) | The Magere Brug: two white portal frames with their lights (decor `decor/ams/magere-brug/back`) and the bascule between them (this entity, `decor/ams/magere-brug`, 4 frames closed → open). Closed, the bascule is a solid slab like a low bridge's; `open()` rings the bell and lifts the leaves (`CRUISE.openTicks`); `state` 'closed' / 'opening' / 'open' |
 * | `ams-party-boat` | x, y = its deck top (172); `to` (target x), `speed` (0.8) | A small open boat (the canal boat sprite) for a party alongside the cruise: a one-way platform that sails to `to`, bobs there and `leave()`s to the right (removed off-screen). Its riders are carried |
 */
import { Entity } from '../../../../engine/entity';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { gameOf, hudOf } from '../../../context';
import { isPlayer, type Player } from '../../../player/player';
import { defineEntity, paramNum, type SpawnParams } from '../../../registry';
import { G } from './art';

const drawOpts: DrawOpts = {};
const TAU = Math.PI * 2;

/** Cruise numbers (logical px, ticks). */
export const CRUISE = {
  /** The boat: length, the deck and the glass roof (boat-local x from the stern), their heights. */
  len: 192,
  deck: [4, 188] as readonly [number, number],
  roof: [44, 164] as readonly [number, number],
  deckY: G,
  roofY: G - 24,
  /**
   * Cruising speed: 5/8 px per tick (≈ 0.6, docs/design/ams-extras.md §4). Every speed step is a
   * multiple of 1/8 px, so the boat, its riders and the camera stay on one exact grid (no jitter
   * between the deck and the view at any resolution).
   */
  speed: 0.625,
  /** Slowing down: 1/8 px less per tick for every `brake` px closer than 5 × brake to the stop. */
  brake: 5,
  /** Speeding up after a stop: 1/8 px more every `accel` ticks. */
  accel: 6,
  /** While it leads, the stern sits this far right of the view's left edge. */
  sternVx: 56,
  /** The Magere Brug's leaves lift in this many ticks. */
  openTicks: 96,
  /** The engine loop (the tour boat's diesel) and its volume. */
  sfx: 'ams/tour-boat',
  vol: 0.45,
} as const;

/** A low bridge: its slab underside, the warning it gives before it may kill (ticks in view). */
export const LOW_BRIDGE = {
  w: 56,
  top: 112,
  under: 127,
  /** ≥ 2 s in view before it may kill (docs/design/ams-extras.md §4). */
  warn: 120,
  /** The face strip that stops and kills a standing roof rider (px either side of the slab's left face). */
  face: 2,
} as const;

/** The Magere Brug: the bascule between the portals, the whole span with the portals. */
export const MAGERE_BRUG = { w: 120, gap: 100, top: 112, under: 127 } as const;

/** Sounds of the route (sfx/ams-route.ts). */
export const ROUTE_SFX = { horn: 'ams/route-horn', bell: 'ams/route-bell', creak: 'ams/route-creak', bump: 'ams/route-bump' } as const;

/** Snap to the 1/8-px grid. */
function eighth(v: number): number {
  return Math.round(v * 8) / 8;
}

// =============================================================================================
// The cruise boat
// =============================================================================================

export type CruiseState = 'moored' | 'sailing' | 'stopped' | 'docked';

export class AmsCruiseBoat extends Entity {
  readonly deck: SolidBox;
  readonly roofBox: SolidBox;
  /** The stern x (exact, a multiple of 1/8). */
  fx: number;
  state: CruiseState = 'moored';
  /** Where the stern stops (Infinity = sail on). */
  stopX = Infinity;
  /** Current speed (px/tick, a multiple of 1/8). */
  v = 0;
  /** Holds the camera (the view follows the boat exactly). */
  leads = true;
  /** Ticks sailed (for the wake). */
  private t = 0;
  private accelT = 0;
  private looping = false;
  private silenced = false;
  private readonly loopKey: string;
  /** The skipper at the wheel (a bubble target that moves with the boat). */
  readonly skipper = { x: 0, y: 0, hitbox: { y: -20 } };

  constructor(world: World, x: number, y: number, _p: SpawnParams) {
    super(world, x, y);
    this.fx = eighth(x);
    this.x = this.fx;
    this.z = 18;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: CRUISE.roofY - y, w: CRUISE.len, h: y - CRUISE.roofY + 6 };
    this.addTag('prop', 'platform', 'moving-platform', 'cruise-boat');
    this.deck = world.addSolid(new SolidBox(this.fx + CRUISE.deck[0], y, CRUISE.deck[1] - CRUISE.deck[0], 4, true, this));
    this.roofBox = world.addSolid(new SolidBox(this.fx + CRUISE.roof[0], y - 24, CRUISE.roof[1] - CRUISE.roof[0], 3, true, this));
    this.loopKey = `cruise-boat-${this.id}`;
    world.events.on('stopLoops', () => {
      this.silenced = true;
      this.engine(false);
    });
    this.placeSkipper();
  }

  /** The deck top (feet y of a player on deck). */
  get deckY(): number {
    return this.deck.y;
  }

  get roofY(): number {
    return this.roofBox.y;
  }

  /** The bow x. */
  get bow(): number {
    return this.fx + CRUISE.len;
  }

  /** Cast off: sail on (no stop) until `cruiseTo`. */
  depart(): void {
    if (this.state === 'moored') this.world.audio.sfx(ROUTE_SFX.horn, { vol: 0.8 });
    this.go();
  }

  /** Sail on without a stop. */
  go(): void {
    this.stopX = Infinity;
    if (this.state !== 'sailing') this.accelT = 0;
    this.state = 'sailing';
  }

  /** Sail on and stop with the stern at x (a stop behind the boat is ignored). */
  cruiseTo(x: number): void {
    this.go();
    this.stopX = Math.max(this.fx, Math.round(x));
  }

  /** Is the boat standing still at its stop (or moored / docked)? */
  get still(): boolean {
    return this.state !== 'sailing';
  }

  /** Stop holding the camera (after docking: the players walk off). */
  release(): void {
    this.leads = false;
  }

  /** Dock: stop for good (the bump at the jetty). */
  dock(): void {
    this.state = 'docked';
    this.v = 0;
    this.world.audio.sfx(ROUTE_SFX.bump, { vol: 0.7 });
  }

  /** A low bridge came into view: the skipper calls it out and sounds the horn. */
  warn(): void {
    hudOf(this.world).bubble(this.skipper, 'BUKKEN!', { kind: 'gag', ticks: 150, voice: false });
    this.world.audio.sfx(ROUTE_SFX.horn, { vol: 0.6 });
  }

  /** Is a player standing on this boat (deck or roof)? */
  carries(p: Player): boolean {
    const s = p.body.supportSolid;
    return p.body.onGround && (s === this.deck || s === this.roofBox);
  }

  private engine(on: boolean): void {
    if (on === this.looping) return;
    this.looping = on;
    if (on) this.world.audio.sfxLoop?.(this.loopKey, CRUISE.sfx, { vol: CRUISE.vol });
    else this.world.audio.stopSfx?.(this.loopKey, 20);
  }

  override onRemove(): void {
    this.engine(false);
  }

  private placeSkipper(): void {
    this.skipper.x = this.fx + 158;
    this.skipper.y = this.deck.y - 6;
  }

  override update(): void {
    this.engine(!this.silenced && this.state === 'sailing');
    // The continue countdown holds the cruise like the runner's auto-scroll.
    const held = (gameOf(this.world).runner as { countdownHeld?: boolean } | null)?.countdownHeld === true;
    if (this.state === 'sailing' && !held) {
      const left = this.stopX - this.fx;
      if (left <= 0) {
        this.state = 'stopped';
        this.v = 0;
      } else {
        // Speed up in 1/8 steps; slow down in 1/8 steps near the stop.
        if (++this.accelT >= CRUISE.accel) {
          this.accelT = 0;
          this.v = Math.min(CRUISE.speed, this.v + 0.125);
        }
        if (this.v === 0) this.v = 0.125;
        const cap = Math.max(0.125, Math.floor(left / CRUISE.brake) * 0.125);
        const step = Math.min(this.v, cap, left);
        this.v = Math.min(this.v, cap);
        this.fx += step;
        this.t++;
        this.world.moveSolid(this.deck, step, 0);
        this.world.moveSolid(this.roofBox, step, 0);
        if (this.fx >= this.stopX) {
          this.fx = this.stopX;
          this.state = 'stopped';
          this.v = 0;
        }
      }
    }
    this.x = this.fx;
    this.placeSkipper();
    if (this.leads) {
      const cam = this.world.camera;
      cam.smoothing = 1;
      const lo = this.fx - CRUISE.sternVx;
      cam.lock(lo, lo + cam.w);
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    // Two wake frames while sailing; the calm frame 0 at rest.
    const f = this.state === 'sailing' ? 1 + ((this.t >> 4) & 1) : 0;
    r.sprite('decor/ams/ams-cruise-boat', f, this.fx, this.deck.y, drawOpts);
  }
}

/** The cruise boat of the world (or null). */
export function cruiseBoatOf(world: World): AmsCruiseBoat | null {
  const list = world.byTag('cruise-boat');
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e instanceof AmsCruiseBoat && !e.removed) return e;
  }
  return null;
}

// =============================================================================================
// Low bridges
// =============================================================================================

/**
 * Shared by the low bridge and the Magere Brug: stop / kill standing riders at the slab's face.
 * Returns the players it killed this tick.
 */
function sweepFace(e: Entity, x0: number, under: number, warned: boolean): number {
  let kills = 0;
  const list = e.world.players;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!isPlayer(p) || p.state !== 'play') continue;
    const r = p.hitRect();
    // The head above the underside, the body at the face.
    if (r.y >= under || r.y + r.h <= under - 40) continue;
    if (r.x + r.w < x0 - LOW_BRIDGE.face || r.x > x0 + LOW_BRIDGE.face) continue;
    if (!warned || e.world.god) continue; // stopped by the solid: swept off the roof
    if (p.kill('crush')) kills++;
  }
  return kills;
}

export class AmsLowBridge extends Entity {
  readonly w: number;
  readonly top: number;
  readonly under: number;
  readonly box: SolidBox;
  /** Ticks the bridge has been in view (−1 = not yet seen). */
  warnT = -1;
  /** Players it killed (tests). */
  kills = 0;
  /** The warn ticks at each kill (tests: never below LOW_BRIDGE.warn). */
  readonly killWarn: number[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.w = Math.max(24, paramNum(p, 'w', LOW_BRIDGE.w));
    this.top = y;
    this.under = Math.max(y + 4, paramNum(p, 'under', LOW_BRIDGE.under));
    this.z = 45;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -this.w / 2, y: 0, w: this.w, h: this.under - y };
    this.addTag('prop', 'low-bridge');
    this.box = world.addSolid(new SolidBox(x - this.w / 2, y, this.w, this.under - y, false, this));
  }

  get warned(): boolean {
    return this.warnT >= LOW_BRIDGE.warn;
  }

  override update(): void {
    const cam = this.world.camera;
    const x0 = this.x - this.w / 2;
    if (this.warnT < 0) {
      if (x0 < cam.right && this.x + this.w / 2 > cam.left) {
        this.warnT = 0;
        cruiseBoatOf(this.world)?.warn();
      }
      return;
    }
    this.warnT++;
    // (No closure per tick: the sweep returns its kills.)
    for (let k = sweepFace(this, x0, this.under, this.warned); k > 0; k--) {
      this.kills++;
      this.killWarn.push(this.warnT);
    }
  }
}

// =============================================================================================
// The Magere Brug
// =============================================================================================

export type BridgeState = 'closed' | 'opening' | 'open';

export class AmsMagereBrug extends Entity {
  readonly box: SolidBox;
  state: BridgeState = 'closed';
  private openT = 0;
  readonly top: number;
  readonly under: number;

  constructor(world: World, x: number, y: number, _p: SpawnParams) {
    super(world, x, y);
    this.top = y;
    this.under = y + (MAGERE_BRUG.under - MAGERE_BRUG.top);
    this.z = 45;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -MAGERE_BRUG.gap / 2, y: 0, w: MAGERE_BRUG.gap, h: this.under - y };
    this.addTag('prop', 'magere-brug');
    this.box = world.addSolid(new SolidBox(x - MAGERE_BRUG.gap / 2, y, MAGERE_BRUG.gap, this.under - y, false, this));
  }

  /** Ring the bell and lift the leaves (the slab is gone at once: whoever stands on it falls). */
  open(): void {
    if (this.state !== 'closed') return;
    this.state = 'opening';
    this.openT = 0;
    this.box.enabled = false;
    this.world.audio.sfx(ROUTE_SFX.bell, { vol: 0.8 });
    this.world.audio.sfx(ROUTE_SFX.creak, { vol: 0.7 });
  }

  /** The leaf frame: 0 closed … 3 open. */
  get frame(): number {
    if (this.state === 'closed') return 0;
    if (this.state === 'open') return 3;
    return Math.min(3, 1 + Math.floor((this.openT / CRUISE.openTicks) * 3));
  }

  override update(): void {
    if (this.state === 'opening' && ++this.openT >= CRUISE.openTicks) this.state = 'open';
    if (this.state === 'closed') sweepFace(this, this.x - MAGERE_BRUG.gap / 2, this.under, true);
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = false;
    r.sprite('decor/ams/magere-brug', this.frame, this.x, this.top, drawOpts);
  }
}

// =============================================================================================
// The party boat
// =============================================================================================

export class AmsPartyBoat extends Entity {
  readonly box: SolidBox;
  readonly w = 52;
  private fx: number;
  private to: number;
  private readonly speed: number;
  private leaving = false;
  private t = 0;
  private readonly baseY: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.fx = x;
    this.to = paramNum(p, 'to', x);
    this.speed = Math.max(0.1, paramNum(p, 'speed', 0.8));
    this.baseY = y;
    this.z = 22;
    this.despawnMargin = Infinity;
    this.facing = this.to < x ? -1 : 1;
    this.hitbox = { x: -this.w / 2, y: 0, w: this.w, h: 14 };
    this.addTag('prop', 'platform', 'moving-platform', 'party-boat');
    this.box = world.addSolid(new SolidBox(x - this.w / 2, y, this.w, 4, true, this));
  }

  /** Has it reached its spot? */
  get arrived(): boolean {
    return !this.leaving && Math.abs(this.fx - this.to) < 0.5;
  }

  /** Sail off to the right (removed when out of view). */
  leave(): void {
    this.leaving = true;
    this.facing = 1;
  }

  override update(): void {
    this.t++;
    if (this.leaving) {
      this.fx += this.speed;
      if (this.fx - this.w > this.world.camera.right + 32) this.remove();
    } else if (Math.abs(this.to - this.fx) >= 0.5) this.fx += Math.sign(this.to - this.fx) * Math.min(this.speed, Math.abs(this.to - this.fx));
    const tx = this.fx - this.w / 2;
    const ty = this.baseY + Math.round(Math.sin((this.t / 110) * TAU));
    const dx = tx - this.box.x;
    const dy = ty - this.box.y;
    if (dx !== 0 || dy !== 0) this.world.moveSolid(this.box, dx, dy);
    this.x = this.box.x + this.w / 2;
    this.y = this.box.y;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    r.sprite('decor/ams/ams-boat-platform', (this.t >> 4) & 1, this.x, this.y, drawOpts);
  }
}

// =============================================================================================
// Registry
// =============================================================================================

defineEntity('ams-cruise-boat', (w, x, y, p) => new AmsCruiseBoat(w, x, y, p), { category: 'prop', description: 'ams c2: the canal tour boat the players ride (deck and glass roof platforms; holds the camera).' });
defineEntity('ams-low-bridge', (w, x, y, p) => new AmsLowBridge(w, x, y, p), { category: 'prop', description: 'ams c2: a low bridge over the river (a roof rider must crouch or get down).' });
defineEntity('ams-magere-brug', (w, x, y, p) => new AmsMagereBrug(w, x, y, p), { category: 'prop', description: 'ams c2: the Magere Brug bascule (closed, then opens for the cruise).' });
defineEntity('ams-party-boat', (w, x, y, p) => new AmsPartyBoat(w, x, y, p), { category: 'prop', description: 'ams c2: a small open party boat alongside the cruise (a moving one-way platform).' });
