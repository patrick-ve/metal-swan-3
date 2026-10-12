/**
 * Mission-local entities of m1 (GDD §11.0 "Mission-local entities", §11.1). The generic ones are
 * prefixed `m1-` so the other missions' own hatch / sign can never replace them in the registry.
 *
 * | id | what | params |
 * |---|---|---|
 * | `m1-hatch` | the storm-drain lid (32×8, top-left at x, y): a dynamic solid until `open()`; opening slides it aside and a Legion head pops out with a bubble | `w` (32), `bubble` (text) |
 * | `m1-sign` | a route sign (feet at x, y) that drops into place | `frame` (0 ROOFTOPS ↑, 1 DRAIN ↓) |
 * | `mk1-head` | Swan Mk1's rusty head in the river (anchor = the water line). 3 hits (a Swan stomp counts 3): it surfaces, honks sadly and a `pickup-bombs` floats up; a stomp makes the two swans honk at each other. Once | — |
 * | `drum-mine` | the Legion kettledrum mine (anchor = the water line, hurtbox 18×12 at y−9…y+3). Touch by a player or a Swan, a player's shot or blast, or another mine's blast 6 ticks later: explodes (r 24, 100 to enemies and props; a touch also hurts players). 100 points | — |
 * | `m1-float-crate` | a floating crate in the boss arena: a one-way platform 32 wide (top at y) bobbing ±4 | `bob` (4), `period` (90) |
 * | `m1-duck-rush` | cosmetic: 8 small rubber ducks racing left on a rush of water along y | `count` (8) |
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { awardScore } from '../../../events';
import { blast, explosion } from '../../../fx';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { isSwan } from '../../vehicles/swan/swan';
import './art';

const drawOpts: DrawOpts = {};
const TAU = Math.PI * 2;

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ------------------------------------------------------------------------------------ hatch

export class M1Hatch extends Entity {
  readonly w: number;
  private box: SolidBox | null;
  private readonly text: string;
  /** Ticks since it opened (−1 = closed). */
  openT = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.w = Math.max(16, paramNum(p, 'w', 32));
    this.text = paramStr(p, 'bubble', "DON'T COME DOWN HERE!");
    this.z = 12;
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: this.w, h: 8 };
    this.addTag('prop');
    this.box = world.addSolid(new SolidBox(x, y, this.w, 8, false, this));
  }

  get isOpen(): boolean {
    return this.openT >= 0;
  }

  /** The lid clanks open (the hole is open from this tick on) and a Legion head pops out. */
  open(): void {
    if (this.openT >= 0) return;
    this.openT = 0;
    if (this.box) this.world.removeSolid(this.box);
    this.box = null;
    this.world.audio.sfx('hit/metal');
  }

  override update(): void {
    if (this.openT < 0) return;
    this.openT++;
    if (this.openT === 24) hudOf(this.world).bubble({ x: this.x + this.w / 2, y: this.y - 26 }, this.text, { kind: 'gag', ticks: 90 });
  }

  /** Head offset above the rim while it peeks (pops up at 16, ducks back at 110). */
  private headRise(): number {
    const t = this.openT;
    if (t < 16 || t > 124) return 0;
    if (t < 24) return (t - 16) * 2;
    if (t < 110) return 16;
    return Math.max(0, 16 - (t - 110) * 2);
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const rise = this.headRise();
    if (rise > 0) r.sprite('decor/m1/drain-head', 0, x + (this.w >> 1), y + 22 - rise, drawOpts);
    const f = this.openT < 0 ? 0 : this.openT < 8 ? 1 : 2;
    r.sprite('decor/m1/hatch', f, x, y, drawOpts);
  }
}

// ------------------------------------------------------------------------------------ sign

export class M1Sign extends Entity {
  readonly frame: number;
  private readonly restY: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.frame = Math.max(0, Math.round(paramNum(p, 'frame', 0)));
    this.restY = y;
    this.y = y - 40;
    this.z = 12;
    this.despawnMargin = Infinity;
    this.addTag('prop');
  }

  override update(): void {
    if (this.y < this.restY || this.vy < 0) {
      this.vy = Math.min(4, this.vy + 0.4);
      this.y += this.vy;
      if (this.y >= this.restY) {
        this.y = this.restY;
        this.vy = this.vy > 2 ? -1.2 : 0;
        if (this.vy === 0) this.world.audio.sfx('hit/metal');
      }
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    r.sprite('decor/m1/sign', this.frame, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ------------------------------------------------------------------------------------ mk1-head

export class Mk1Head extends Entity {
  hits = 0;
  /** 'idle' → 'surface' (honks, gives bombs) → 'sink' (back under, stays a decor head). */
  mode: 'idle' | 'surface' | 'done' = 'idle';
  private t = 0;
  private stomped = false;

  constructor(world: World, x: number, y: number, _p: SpawnParams) {
    super(world, x, y);
    this.team = 'enemy';
    this.hp = this.maxHp = 1e6;
    this.z = 24;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -8, y: -24, w: 16, h: 16 };
    this.addTag('prop', 'shootable', 'soft');
  }

  override onHit(d: Damage): boolean {
    if (this.mode !== 'idle' || d.amount <= 0) return false;
    this.flashTicks = 2;
    if (d.kind === 'crush') {
      this.hits = 3;
      this.stomped = true;
    } else this.hits++;
    this.world.audio.sfx('hit/metal', { vol: 0.6 });
    if (this.hits >= 3) this.surface();
    return true;
  }

  private surface(): void {
    this.mode = 'surface';
    this.t = 0;
    this.removeTag('shootable');
    this.removeTag('soft');
    this.world.audio.sfx('env/water-splash');
  }

  override update(): void {
    this.t++;
    if (this.mode !== 'surface') return;
    if (this.t === 20) {
      this.world.audio.sfx('swan/honk', { pitch: 0.7, vol: 0.8 });
      hudOf(this.world).bubble(this, 'honk...', { kind: 'gag', ticks: 60, dy: -34 });
      this.world.spawn('pickup-bombs', this.x, this.y - 30, { dropped: true });
    }
    if (this.stomped && this.t === 50) this.world.audio.sfx('swan/honk', { pitch: 1.0 });
    if (this.stomped && this.t === 70) this.world.audio.sfx('swan/honk', { pitch: 0.8 });
    if (this.t >= 120) this.mode = 'done';
  }

  override draw(r: Renderer): void {
    let f = 0;
    if (this.mode === 'surface') f = this.t >= 20 && this.t < 44 ? 3 : 2;
    else if (this.t % 180 < 8) f = 1;
    drawOpts.flipX = false;
    drawOpts.flash = this.flashTicks > 0;
    const bob = Math.round(Math.sin((this.t / 60) * TAU));
    r.sprite('prop/mk1-head', f, Math.round(this.x), Math.round(this.y) + bob, drawOpts);
    drawOpts.flash = false;
  }
}

// ------------------------------------------------------------------------------------ drum-mine

/** A chain of mine blasts: who started it and how. */
export interface MineChain {
  owner: number;
  /** Started by a player's shot or blast (a DRUM ROLL can only come from such a chain). */
  byShot: boolean;
  count: number;
}

export const DRUM_MINE = { hp: 10, radius: 24, damage: 100, chainDelay: 6, score: 100 } as const;

const mineBox: Rect = { x: 0, y: 0, w: 0, h: 0 };

export class DrumMine extends Entity {
  chain: MineChain | null = null;
  /** Ticks until a chained detonation (−1 = none). */
  private fuse = -1;
  private t: number;

  constructor(world: World, x: number, y: number, _p: SpawnParams) {
    super(world, x, y);
    this.team = 'enemy';
    this.hp = this.maxHp = DRUM_MINE.hp;
    this.z = 26;
    this.despawnMargin = Infinity;
    // 18×12 at y 171–183 for a water line at 180 (it does not bob).
    this.hitbox = { x: -9, y: -9, w: 18, h: 12 };
    this.t = Math.floor(x) % 40;
    this.addTag('prop', 'shootable', 'mine');
  }

  override onHit(d: Damage): boolean {
    if (this.dead || d.amount <= 0) return false;
    const src = d.source;
    if (src instanceof DrumMine) {
      // Another mine's blast: go off 6 ticks later, in its chain.
      if (this.fuse < 0 && !this.chain) {
        this.chain = src.chain;
        this.fuse = DRUM_MINE.chainDelay;
      }
      return true;
    }
    this.chain = { owner: d.owner ?? -1, byShot: true, count: 0 };
    this.detonate(false);
    return true;
  }

  override update(): void {
    this.t++;
    if (this.dead) return;
    if (this.fuse > 0 && --this.fuse === 0) {
      this.detonate(false);
      return;
    }
    // Touch: a player on foot or any Swan.
    const box = this.hitRect(mineBox);
    for (const p of this.world.players) {
      if (!isPlayer(p) || p.state !== 'play' || !overlap(box, p.hitRect())) continue;
      this.chain = { owner: p.index, byShot: false, count: 0 };
      this.detonate(true);
      return;
    }
    for (const v of this.world.byTag('vehicle')) {
      if (!isSwan(v) || !v.alive) continue;
      const hb = v.hurtboxes();
      for (let i = 0; i < hb.length; i++) {
        if (!overlap(box, hb[i])) continue;
        this.chain = { owner: v.driver ? v.driver.index : -1, byShot: false, count: 0 };
        this.detonate(true);
        return;
      }
    }
  }

  private detonate(touched: boolean): void {
    if (this.dead) return;
    this.dead = true;
    const chain = this.chain ?? { owner: -1, byShot: false, count: 0 };
    this.chain = chain;
    chain.count++;
    const x = this.x;
    const y = this.y - 4;
    this.world.audio.sfx('hit/drum');
    // The visible blast: harmful to players only when a player or a Swan set it off by touch.
    explosion(this.world, x, y, 'm', touched ? { team: 'enemy', damage: DRUM_MINE.damage, radius: DRUM_MINE.radius, lift: 0, debris: null, tags: ['heavy'] } : { lift: 0, debris: null });
    // The player-side blast: enemies, props and the next mines (owner = the chain's player).
    blast(this.world, x, y, DRUM_MINE.radius, DRUM_MINE.damage, 'player', {
      kind: 'explosion',
      owner: chain.owner >= 0 ? chain.owner : undefined,
      source: this,
      falloff: 0,
      exclude: this,
    });
    if (chain.owner >= 0) awardScore(this.world, chain.owner, DRUM_MINE.score, x, y - 12);
    this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    drawOpts.flash = this.flashTicks > 0;
    const bob = Math.round(2 * Math.sin((this.t / 40) * TAU));
    r.sprite('prop/drum-mine', bob > 0 ? 1 : 0, Math.round(this.x), Math.round(this.y) + bob, drawOpts);
    drawOpts.flash = false;
  }
}

// ------------------------------------------------------------------------------------ float crate

export class FloatCrate extends Entity {
  readonly box: SolidBox;
  private readonly baseY: number;
  private readonly amp: number;
  private readonly period: number;
  private t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.baseY = y;
    this.amp = paramNum(p, 'bob', 4);
    this.period = Math.max(16, paramNum(p, 'period', 90));
    this.t = Math.floor(x) % this.period;
    this.z = 22;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -16, y: 0, w: 32, h: 18 };
    this.addTag('prop', 'platform', 'moving-platform');
    this.box = world.addSolid(new SolidBox(x - 16, y, 32, 4, true, this));
  }

  get top(): number {
    return this.box.y;
  }

  override update(): void {
    this.t++;
    const ty = this.baseY + Math.round(this.amp * Math.sin((this.t / this.period) * TAU));
    if (ty !== this.box.y) this.world.moveSolid(this.box, 0, ty - this.box.y);
    this.y = this.box.y;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    r.sprite('decor/m1/float-crate', 0, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

// ------------------------------------------------------------------------------------ duck rush

export class DuckRush extends Entity {
  private readonly count: number;
  private t = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.count = Math.max(1, Math.round(paramNum(p, 'count', 8)));
    this.z = 27;
    this.despawnMargin = Infinity;
    this.world.audio.sfx('env/water-rush');
  }

  override update(): void {
    this.t++;
    if (this.t > 360) this.remove();
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = true;
    const cam = this.world.camera;
    for (let i = 0; i < this.count; i++) {
      const x = this.x - (this.t - i * 9) * 2.6;
      if (this.t < i * 9 || x < cam.left - 16) continue;
      const bob = Math.round(Math.sin((this.t + i * 13) / 6));
      r.sprite('decor/m1/duck-small', (this.t >> 3) & 1, Math.round(x), Math.round(this.y) + bob, drawOpts);
    }
    drawOpts.flipX = false;
  }
}

defineEntity('m1-hatch', (w, x, y, p) => new M1Hatch(w, x, y, p), { category: 'prop', description: 'm1-a storm-drain lid (dynamic solid; open()).' });
defineEntity('m1-sign', (w, x, y, p) => new M1Sign(w, x, y, p), { category: 'prop', description: 'm1 route sign dropping into place (param frame).' });
defineEntity('mk1-head', (w, x, y, p) => new Mk1Head(w, x, y, p), { category: 'prop', description: 'm1-c Swan Mk1 head gag (3 hits: honk + bombs).' });
defineEntity('drum-mine', (w, x, y, p) => new DrumMine(w, x, y, p), { category: 'prop', description: 'm1-c floating kettledrum mine (chain blasts).' });
defineEntity('m1-float-crate', (w, x, y, p) => new FloatCrate(w, x, y, p), { category: 'prop', description: 'm1-c boss arena floating crate (bobbing one-way platform).' });
defineEntity('m1-duck-rush', (w, x, y, p) => new DuckRush(w, x, y, p), { category: 'prop', description: 'm1-b2 cosmetic rubber duck stampede.' });
