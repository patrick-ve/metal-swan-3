/**
 * Set pieces (GDD §9.5, §15.9 item 3): `willow-tree` (m1-c: shoot it and it falls into a bridge),
 * `avalanche` (m3-a: the pursuit wall) and `rising-water` (m3-b2: the meltwater climb).
 * Sprites: `prop/<id>/…` (set-pieces.art.ts).
 */
import type { Damage } from '../../../engine/entity';
import { Entity } from '../../../engine/entity';
import { overlaps, type Rect } from '../../../engine/math';
import { PAL } from '../../../engine/palette';
import type { ParticlePreset } from '../../../engine/particles';
import { SolidBox } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { HazardDef } from '../../../engine/terrain';
import type { World } from '../../../engine/world';
import { flash, hudOf } from '../../context';
import { Enemy } from '../../enemy';
import { awardScore } from '../../events';
import { splash } from '../../fx';
import { isPlayer, type Player } from '../../player/player';
import { NO_PARAMS, paramNum, paramStr, type SpawnParams } from '../../registry';
import { waterSurfaceAt } from '../../water';
import { addHazard, crushHit, nearestSlot, popHat, removeHazard, setPiece, sfxNear } from './common';

const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { alpha: 0.5 };
const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
const zone: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Snow powder thrown up by the avalanche and by snow hitting rock (cosmetic). */
const POWDER: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 3,
  life: [18, 36],
  drag: 0.92,
  gravity: 0.03,
  colors: [PAL.snow[3], PAL.snow[2], PAL.snow[1]],
  fadeFrom: 0.5,
};

/** A spot for the respawn drop-in (Player.respawnRule). */
type Spot = { x: number; y: number };
type RespawnRule = (p: Player) => Spot | null;

// ---------------------------------------------------------------------------------------------
// willow-tree (GDD §9.5, m1-c @1500–@1700)
// ---------------------------------------------------------------------------------------------

export const WILLOW = {
  /** Trunk HP and the score for felling it. */
  hp: 200,
  score: 1000,
  /** It falls in 40 ticks. */
  fallTicks: 40,
  /** The fallen tree: a solid bridge 160×12 starting 10 px past the trunk (m1-c: 1950–2110). */
  length: 160,
  thick: 12,
  gap: 10,
  /** SHOOT! shows after this many ticks in view without a hit. */
  hint: 180,
  /** Rotation frames of the fall (0° … 90°). */
  frames: 8,
} as const;

/**
 * A giant willow (64×120) with a red target ring on its trunk base. Only the trunk (16×44) is
 * shootable: 200 HP. After 180 ticks in view without a hit a SHOOT! pointer (HUD) shows over it.
 * Felled (1,000 points to the player who broke it), it falls in 40 ticks (`env/timber`, its
 * shadow grows on the water) and becomes a solid bridge 160×12. Where it lands, team-'enemy'
 * targets are crushed (SET PIECE +200 each and their kill score, to the feller); players, ridden
 * or empty Swans, hostages and items are pushed out to the nearest end of the bridge, unhurt.
 * Params: `dir` (1 right / −1 left, default right), `bridgeY` (the bridge top, default y + 2),
 * `length`, `hp`.
 */
export class WillowTree extends Entity {
  state: 'stand' | 'fall' | 'bridge' = 'stand';
  readonly dir: 1 | -1;
  /** Where the bridge will lie (world rect). */
  readonly bridgeRect: Rect;
  box: SolidBox | null = null;
  /** Ticks into the fall. */
  fallT = 0;
  owner: number | undefined = undefined;
  /** Enemies crushed when it landed. */
  crushed = 0;
  private seenTicks = 0;
  private touched = false;
  private pointed = false;
  private hitSfx = 0;
  private readonly water: number;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    const d = params.dir ?? params.facing;
    this.dir = d === -1 || d === 'left' ? -1 : 1;
    this.facing = this.dir;
    const len = Math.max(32, paramNum(params, 'length', WILLOW.length));
    const by = paramNum(params, 'bridgeY', y + 2);
    this.bridgeRect = { x: this.dir > 0 ? x + WILLOW.gap : x - WILLOW.gap - len, y: by, w: len, h: WILLOW.thick };
    const s = waterSurfaceAt(this, this.bridgeRect.x + len / 2, by - 16, 0);
    this.water = Number.isFinite(s) ? s : by + 10;
    this.team = 'enemy';
    this.z = 13;
    this.hp = this.maxHp = paramNum(params, 'hp', WILLOW.hp);
    this.hitbox = { x: -8, y: -44, w: 16, h: 44 };
    this.despawnMargin = 320;
    this.addTag('shootable', 'prop');
  }

  override onHit(d: Damage): boolean {
    if (this.state !== 'stand') return false;
    this.hp -= d.amount;
    this.flashTicks = 3;
    if (!this.touched) {
      this.touched = true;
      if (this.pointed) hudOf(this.world).clearPointer(this);
    }
    if (this.hp <= 0) this.fell(d);
    else if (this.hitSfx <= 0) {
      this.hitSfx = 5;
      sfxNear(this.world, this.x, this.y, 'enemy/fumble', 0.45);
    }
    return true;
  }

  override die(d?: Damage): void {
    this.fell(d ?? { amount: this.hp, kind: 'impact', dirX: this.dir });
  }

  /** TIMBER: 1,000 points, the creak, and down it goes. */
  private fell(d: Damage): void {
    if (this.state !== 'stand') return;
    this.state = 'fall';
    this.dead = true;
    this.fallT = 0;
    this.owner = d.owner;
    this.removeTag('shootable');
    hudOf(this.world).clearPointer(this);
    awardScore(this.world, d.owner, WILLOW.score, this.x, this.y - 64);
    this.world.audio.sfx('env/timber');
  }

  /** Fall angle in degrees: slow start, fast finish (like a real tree). */
  get angle(): number {
    const t = Math.min(1, this.fallT / WILLOW.fallTicks);
    return 90 * t * t;
  }

  override update(): void {
    if (this.hitSfx > 0) this.hitSfx--;
    if (this.state === 'stand') {
      if (!this.touched && !this.pointed && this.onScreen(-16) && ++this.seenTicks >= WILLOW.hint) {
        this.pointed = true;
        hudOf(this.world).pointer(this, 'SHOOT!', { dy: 6 });
      }
    } else if (this.state === 'fall') {
      if (++this.fallT >= WILLOW.fallTicks) this.land();
    }
  }

  /** It lands: the bridge appears, enemies under it are crushed, everyone else is pushed out. */
  private land(): void {
    this.state = 'bridge';
    const r = this.bridgeRect;
    this.box = this.world.addSolid(new SolidBox(r.x, r.y, r.w, r.h, false, this));
    zone.x = r.x;
    zone.y = r.y - 6;
    zone.w = r.w;
    zone.h = r.h + 6;
    let n = 0;
    const list = this.world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || !overlaps(e.hitRect(scratch), zone)) continue;
      if (e.team === 'enemy') {
        if (!e.hasTag('shootable') || e.hasTag('boss')) continue;
        this.world.damage(e, crushHit(this, this.owner, this.dir));
        if (e.dead && e.hasTag('enemy')) n++;
      } else if (isPlayer(e)) {
        // A rider is moved with his vehicle.
        if (e.state !== 'mounted') this.pushOut(e);
      } else if (e.hasTag('vehicle') || e.hasTag('hostage') || e.hasTag('item')) this.pushOut(e);
    }
    this.crushed = n;
    setPiece(this.world, this.owner, n, r.x + r.w / 2, r.y - 16);
    for (let x = r.x + 8; x < r.x + r.w; x += 24) splash(this.world, x, this.water, 5);
    this.world.audio.sfx('env/water-splash');
    this.world.audio.sfx('explosion/m', { vol: 0.6 });
    this.world.camera.shake(3, 14);
  }

  /** Out to the nearer end of the bridge, onto the floor there when there is one. */
  private pushOut(e: Entity): void {
    const r = this.bridgeRect;
    const half = (e.body ? e.body.w : e.hitbox.w) / 2 + 1;
    const nx = e.x - r.x < r.x + r.w - e.x ? r.x - half : r.x + r.w + half;
    const y = this.world.terrain.surfaceY(nx, e.y - 48, e.y + 64);
    e.x = e.prevX = nx;
    if (Number.isFinite(y)) {
      e.y = e.prevY = y;
      e.vy = 0;
    }
    e.vx = 0;
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flipX = this.dir < 0;
    drawOpts.flash = this.flashTicks > 0;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.state === 'stand') {
      // The hanging branches sway slowly.
      r.sprite('prop/willow-tree/stand', (this.world.tick >> 5) % 2, x, y, drawOpts);
    } else if (this.state === 'fall') {
      // Its shadow grows on the water where it will land.
      const k = this.angle / 90;
      const br = this.bridgeRect;
      const sw = Math.round(br.w * Math.sin((this.angle * Math.PI) / 180));
      tintOpts.alpha = 0.15 + 0.35 * k;
      if (sw > 0) r.rect(this.dir > 0 ? Math.round(br.x) : Math.round(br.x + br.w - sw), Math.round(this.water), sw, 3, PAL.navy[0], tintOpts);
      const f = Math.min(WILLOW.frames - 1, Math.round(k * (WILLOW.frames - 1)));
      r.sprite('prop/willow-tree/fall', f, x, y, drawOpts);
    } else {
      r.sprite('prop/willow-tree/stump', 0, x, y, drawOpts);
      const br = this.bridgeRect;
      r.sprite('prop/willow-tree/bridge', 0, Math.round(this.dir > 0 ? br.x : br.x + br.w - 1), Math.round(br.y), drawOpts);
    }
    drawOpts.flash = false;
    drawOpts.flipX = false;
  }
}

// ---------------------------------------------------------------------------------------------
// avalanche (GDD §9.5, §15.9 item 3; docs/design/swan-mount/levels.md §4.3)
// ---------------------------------------------------------------------------------------------

export const AVALANCHE = {
  /** Gains on a player at this speed (px/tick) … */
  speed: 1,
  /** … and never moves faster than this. */
  maxSpeed: 3,
  /** It holds the view's left part: front at view x 40 at most … */
  holdX: 40,
  /** … and never closer than this to the rearmost living player. */
  gap: 104,
  /** It rolls in with its front at view x 8. */
  enter: 8,
  /** Its leading 24 px are a kill zone; the snow body behind the front is 64 px. */
  zone: 24,
  body: 64,
  /** Respawns land at least this far right of the front. */
  respawn: 160,
} as const;

/**
 * The m3-a pursuit wall: a rolling snow wall 64 px wide and as tall as the view. Every tick its
 * front moves by clamp(target − front, `speed`, `maxSpeed`) px, with target = min(view left +
 * `holdX`, rearmost living player's x − `gap`): it holds the view's left part at any player
 * speed but gains on a player only at `speed` (a player who stops is caught after ~100 ticks).
 * It rolls in with its front at view x 8 (never closer than `gap` to a player). Its leading 24 px
 * are a `kill` terrain hazard (players die through invulnerability; vehicles are destroyed). It
 * swallows every enemy it touches (a hat pops out; SET PIECE +200 to the nearest player).
 * Respawns land at least 160 px right of its front (it wraps each player's respawn rule while it
 * chases). At `stopX` it smashes into the rock: shake 6 px, a white flash of 20 ticks, the kill
 * zone switches off and a snow mound stays. Params: `speed`, `maxSpeed`, `holdX`, `gap`, `stopX`
 * (default: never), `startX` (front at the start, default as above), `respawn`.
 */
export class Avalanche extends Entity {
  state: 'chase' | 'stopped' = 'chase';
  /** The front x (also `x`). */
  front: number;
  readonly speed: number;
  readonly maxSpeed: number;
  readonly holdX: number;
  readonly gap: number;
  readonly stopX: number;
  readonly clearance: number;
  /** The live kill zone (a terrain hazard while it chases). */
  readonly hazard: HazardDef = { kind: 'kill', x: 0, y: 0, w: AVALANCHE.zone, h: 0 };
  /** Enemies swallowed so far. */
  swallowed = 0;
  /** Floor y under the mound once stopped. */
  moundY = 0;
  private started = false;
  private readonly startX: number;
  private readonly rules = new Map<Player, { orig: RespawnRule | null; wrap: RespawnRule }>();
  private readonly loopKey: string;
  private looping = false;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.front = x;
    this.speed = paramNum(params, 'speed', AVALANCHE.speed);
    this.maxSpeed = Math.max(this.speed, paramNum(params, 'maxSpeed', AVALANCHE.maxSpeed));
    this.holdX = paramNum(params, 'holdX', AVALANCHE.holdX);
    this.gap = paramNum(params, 'gap', AVALANCHE.gap);
    this.stopX = paramNum(params, 'stopX', Infinity);
    this.clearance = paramNum(params, 'respawn', AVALANCHE.respawn);
    this.startX = paramNum(params, 'startX', NaN);
    this.hitbox = { x: -AVALANCHE.body, y: -216, w: AVALANCHE.body, h: 216 };
    this.z = 64;
    this.despawnMargin = Infinity;
    this.loopKey = `avalanche-${this.id}`;
    this.addTag('prop', 'hazard');
  }

  /** The rearmost living player's x (+∞ when nobody is alive). */
  rearmost(): number {
    const list = this.world.alivePlayers();
    let x = Infinity;
    for (let i = 0; i < list.length; i++) if (list[i].x < x) x = list[i].x;
    return x;
  }

  override update(): void {
    if (this.state === 'stopped') return;
    const cam = this.world.camera;
    const rear = this.rearmost();
    if (!this.started) {
      this.started = true;
      this.front = Number.isFinite(this.startX) ? this.startX : Math.min(cam.left + AVALANCHE.enter, rear - this.gap);
      addHazard(this.world, this.hazard);
      this.looping = true;
      this.world.audio.sfxLoop?.(this.loopKey, 'env/avalanche', { vol: 0.55 });
    } else {
      const target = Math.min(cam.left + this.holdX, rear - this.gap);
      const step = Math.max(this.speed, Math.min(this.maxSpeed, target - this.front));
      this.front += step;
    }
    if (this.front >= this.stopX) {
      this.front = this.stopX;
      this.x = this.front;
      this.stop();
      return;
    }
    this.x = this.front;
    this.y = cam.bottom;
    const h = this.hazard;
    h.x = this.front - AVALANCHE.zone;
    h.y = cam.top - 64;
    h.h = cam.h + 128;
    this.swallow();
    this.wrapRules();
    if (this.world.tick % 2 === 0 && this.onScreen(16)) {
      const rng = this.world.fxRng;
      this.world.particles.emit(POWDER, this.front - rng.range(0, 10), cam.top + rng.range(10, cam.h - 10), rng.range(0.6, 2.2), rng.range(-1.6, 0.2));
    }
  }

  /** Every enemy it touches is swallowed: a hat pops out, SET PIECE to the nearest player. */
  private swallow(): void {
    const cam = this.world.camera;
    zone.x = this.front - AVALANCHE.body;
    zone.y = cam.top - 64;
    zone.w = AVALANCHE.body;
    zone.h = cam.h + 128;
    const list = this.world.snapshotTag('enemy');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.hasTag('boss') || !overlaps(e.hitRect(scratch), zone)) continue;
        this.world.damage(e, crushHit(this, undefined, 1));
        if (!e.dead) continue;
        this.swallowed++;
        popHat(this.world, Math.min(e.x, this.front - 6), e.y + e.hitbox.y, e instanceof Enemy ? `${e.art}/hat` : '');
        sfxNear(this.world, e.x, e.y, 'enemy/scream', 0.7);
        setPiece(this.world, nearestSlot(this.world, e.x, e.y), 1, this.front + 8, e.y + e.hitbox.y);
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  /** While it chases, every player's respawn rule is wrapped: never closer than `clearance`. */
  private wrapRules(): void {
    const list = this.world.players;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p)) continue;
      const cur = this.rules.get(p);
      if (cur && p.respawnRule === cur.wrap) continue;
      const orig = p.respawnRule;
      const wrap: RespawnRule = (pl) => this.respawnSpot(pl, orig);
      this.rules.set(p, { orig, wrap });
      p.respawnRule = wrap;
    }
  }

  private unwrapRules(): void {
    for (const [p, r] of this.rules) if (p.respawnRule === r.wrap) p.respawnRule = r.orig;
    this.rules.clear();
  }

  /** The section's own spot when it is far enough ahead, else the first floor ≥ front + clearance. */
  respawnSpot(p: Player, orig: RespawnRule | null): Spot | null {
    const base = orig ? orig(p) : null;
    if (this.state !== 'chase') return base;
    const minX = this.front + this.clearance;
    if (base && base.x >= minX) return base;
    return this.spotFrom(minX) ?? base;
  }

  /** The nearest safe floor in view at or right of minX (else the rightmost one in view). */
  spotFrom(minX: number): Spot | null {
    const cam = this.world.camera;
    const lo = Math.max(minX, cam.left + 16);
    const hi = cam.right - 16;
    for (let x = Math.ceil(lo); x <= hi; x += 8) {
      const y = this.floorAt(x);
      if (Number.isFinite(y)) return { x, y };
    }
    for (let x = Math.floor(hi); x >= cam.left + 16; x -= 8) {
      const y = this.floorAt(x);
      if (Number.isFinite(y)) return { x, y };
    }
    return null;
  }

  /** A floor at x in view with room and no hazard on it, or +∞. */
  private floorAt(x: number): number {
    const cam = this.world.camera;
    const t = this.world.terrain;
    const y = t.surfaceY(x, cam.top + 8, cam.bottom + 32);
    if (!Number.isFinite(y)) return Infinity;
    scratch.x = x - 8;
    scratch.y = y - 30;
    scratch.w = 16;
    scratch.h = 32;
    return t.hazardAt(scratch) ? Infinity : y;
  }

  /** The front hits the rock: shake, white flash, the kill zone goes, a mound stays. */
  stop(): void {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    const cam = this.world.camera;
    removeHazard(this.world, this.hazard);
    this.unwrapRules();
    this.stopLoop();
    cam.shake(6, 30);
    flash(this.world, PAL.snow[3], 0.9, 20);
    this.world.audio.sfx('explosion/l');
    const y = this.world.terrain.surfaceY(this.front - 24, cam.top, cam.bottom + 64);
    this.moundY = Number.isFinite(y) ? y : cam.bottom - 40;
    this.y = this.moundY;
    this.world.particles.burst(POWDER, this.front - 8, this.moundY - 30, 40, 0.8, 3.4, -Math.PI / 2, Math.PI * 1.4);
  }

  private stopLoop(): void {
    if (this.looping) this.world.audio.stopSfx?.(this.loopKey, 30);
    this.looping = false;
  }

  /** It follows the view bottom (below the kill line in a deep section); never despawned. */
  override onOutOfWorld(): void {}

  override onRemove(): void {
    removeHazard(this.world, this.hazard);
    this.unwrapRules();
    this.stopLoop();
  }

  override draw(r: Renderer): void {
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    drawOpts.flash = false;
    if (this.state === 'stopped') {
      r.sprite('prop/avalanche/mound', 0, Math.round(this.front), Math.round(this.moundY), drawOpts);
      return;
    }
    if (!this.started) return;
    const cam = this.world.camera;
    const fx = Math.round(this.front);
    const bottom = Math.round(cam.top) + cam.h;
    const t = this.world.tick;
    // The snow mass behind the front reaches the view's left edge.
    for (let x = fx - AVALANCHE.body - 32; x > cam.left - 40; x -= 32) r.sprite('prop/avalanche/body', (t >> 2) & 3, x, bottom, drawOpts);
    r.sprite('prop/avalanche/front', (t >> 2) % 4, fx, bottom, drawOpts);
    // Snowballs tumble in the front face (deterministic, cosmetic).
    for (let i = 0; i < 4; i++) {
      const by = bottom - 30 - ((i * 53 + t * (1 + (i & 1))) % (cam.h - 50));
      const bx = fx - 4 - ((i * 7 + (t >> 3)) % 9);
      r.sprite('prop/avalanche/snowball', (t >> 2) + i, bx, by, drawOpts);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// rising-water (GDD §9.5, m3-b2)
// ---------------------------------------------------------------------------------------------

export const RISING_WATER = {
  /** px/tick. */
  speed: 0.3,
  /** Never more than this far below the view bottom (it jumps up when it falls behind). */
  lag: 48,
} as const;

/**
 * The meltwater: a `kill` terrain hazard across the whole section whose top rises at `speed`
 * px/tick from `startY` (default: the spawn y). It is never more than `lag` (48) px below the
 * view bottom: when it falls behind it jumps up to view bottom + 48. With `cap` set it never
 * rises above view bottom − cap (the final fight of m3-b2: `setSpeed(0.15, 48)`). Params:
 * `startY`, `speed`, `lag`, `cap`, `delay` (ticks before it starts), `kind` (`kill` default, or
 * `water`: a real water surface that players wade in and drown in). The band is drawn
 * see-through in front of everything below its surface.
 */
export class RisingWater extends Entity {
  /** The surface y. */
  top: number;
  speed: number;
  lag: number;
  cap: number | null;
  delay: number;
  readonly hazard: HazardDef;
  private readonly loopKey: string;
  private looping = false;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.top = paramNum(params, 'startY', y);
    this.speed = paramNum(params, 'speed', RISING_WATER.speed);
    this.lag = paramNum(params, 'lag', RISING_WATER.lag);
    this.cap = typeof params.cap === 'number' && Number.isFinite(params.cap) ? params.cap : null;
    this.delay = Math.max(0, paramNum(params, 'delay', 0));
    const b = world.terrain.bounds;
    this.hazard = {
      kind: paramStr(params, 'kind', 'kill') === 'water' ? 'water' : 'kill',
      x: b.x - 64,
      y: this.top,
      w: b.w + 128,
      h: Math.max(1, b.y + b.h + 64 - this.top),
    };
    this.y = this.top;
    this.hitbox = { x: -192, y: 0, w: 384, h: 16 };
    this.z = 70;
    this.despawnMargin = Infinity;
    this.loopKey = `rising-water-${this.id}`;
    this.addTag('prop', 'hazard');
    addHazard(world, this.hazard);
  }

  /** Change the rise speed (and the cap above the view bottom; null = none). */
  setSpeed(speed: number, cap?: number | null): void {
    this.speed = speed;
    if (cap !== undefined) this.cap = cap;
  }

  override update(): void {
    const cam = this.world.camera;
    if (this.delay > 0) this.delay--;
    else this.top -= this.speed;
    if (this.top > cam.bottom + this.lag) this.top = cam.bottom + this.lag;
    if (this.cap !== null && this.top < cam.bottom - this.cap) this.top = cam.bottom - this.cap;
    this.x = cam.centerX;
    this.y = this.top;
    const h = this.hazard;
    const b = this.world.terrain.bounds;
    h.y = this.top;
    h.h = Math.max(1, b.y + b.h + 64 - this.top);
    if (!this.looping) {
      this.looping = true;
      this.world.audio.sfxLoop?.(this.loopKey, 'env/ice-melt', { vol: 0.4 });
    }
    if (this.top < cam.bottom && this.world.tick % 6 === 0) {
      const rng = this.world.fxRng;
      this.world.particles.emit(BUBBLE, cam.left + rng.range(0, cam.w), Math.min(cam.bottom, this.top + rng.range(20, 60)), 0, -rng.range(0.3, 0.7));
    }
  }

  /** Its surface may sit below the kill line while it waits; it lives as long as its section. */
  override onOutOfWorld(): void {}

  override onRemove(): void {
    removeHazard(this.world, this.hazard);
    if (this.looping) this.world.audio.stopSfx?.(this.loopKey);
    this.looping = false;
  }

  override draw(r: Renderer): void {
    const cam = this.world.camera;
    const top = Math.round(this.top);
    if (top > cam.bottom + 4) return;
    const left = Math.floor(cam.left) - 1;
    const w = cam.w + 2;
    const bottom = Math.ceil(cam.bottom);
    if (bottom > top + 3) {
      waterOpts.alpha = 0.5;
      r.rect(left, top + 3, w, bottom - top - 3, PAL.teal[1], waterOpts);
    }
    if (bottom > top + 18) {
      waterOpts.alpha = 0.4;
      r.rect(left, top + 18, w, bottom - top - 18, PAL.navy[1], waterOpts);
    }
    // The foamy surface: a tiled strip that rolls sideways.
    const shift = (this.world.tick >> 2) % 32;
    const f = (this.world.tick >> 4) % 2;
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    for (let x = Math.floor(cam.left / 32) * 32 - 32 + shift; x < cam.right + 32; x += 32) r.sprite('prop/rising-water/surface', f, x, top, drawOpts);
  }
}

const waterOpts: DrawOpts = { alpha: 0.5 };

/** Air bubbles rising in the meltwater (cosmetic). */
const BUBBLE: ParticlePreset = {
  kind: 'pixel',
  life: [30, 60],
  drag: 0.99,
  gravity: -0.004,
  colors: [PAL.snow[2], PAL.sky[3]],
  alpha: 0.8,
  fadeFrom: 0.7,
};
