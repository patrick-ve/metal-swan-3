/**
 * Pooled particles (docs/ARCHITECTURE.md §5.12).
 *
 * Fixed capacity, struct-of-arrays storage, no allocation per tick. A particle is spawned from a
 * `ParticlePreset` (usually a module-level constant) plus per-spawn position / velocity:
 * ```ts
 * const SPARK: ParticlePreset = { kind: 'rect', w: 2, h: 1, life: [6, 12], drag: 0.9, colors: [...], additive: true };
 * world.particles.burst(SPARK, x, y, 8, 1, 3);          // 8 sparks in every direction
 * world.particles.emit(SPARK, x, y, vx, vy);             // one particle
 * world.particles.debris(x, y, 10);                      // built-in helpers
 * ```
 * When the pool is full, new particles overwrite old ones (round-robin). Randomness comes from
 * the cosmetic rng (`world.fxRng`) so particles never change gameplay.
 */
import type { Color } from './color';
import type { DrawOpts, Renderer } from './render';
import { Rng } from './rng';
import type { Terrain } from './terrain';

export type ParticleKind = 'pixel' | 'rect' | 'sprite';
/** What happens when a particle moves into ground or a solid rect. */
export type GroundMode = 'none' | 'bounce' | 'stop' | 'die';

export interface ParticlePreset {
  /** 'pixel' (1×1), 'rect' (w×h, centred) or 'sprite' (a frame of a sprite strip). Default 'pixel'. */
  kind?: ParticleKind;
  w?: number;
  h?: number;
  sprite?: string;
  /** First sprite frame. */
  frame?: number;
  /** Start on a random frame in [frame, frame + randomFrames). */
  randomFrames?: number;
  /** Advance the sprite frame every N ticks (0 = static frame). */
  ticksPerFrame?: number;
  /** Lifetime in ticks: fixed or a random [min, max] range. Default 30. */
  life?: number | readonly [number, number];
  /** px/tick² (negative rises, e.g. smoke). */
  gravity?: number;
  /** Velocity multiplier per tick (1 = no drag). */
  drag?: number;
  /** Colour ramp over the lifetime (first → last). Default white. */
  colors?: readonly Color[];
  /** Start fading out at this fraction of the lifetime (0..1, default 1 = no fade). */
  fadeFrom?: number;
  /** Base opacity 0..1 (default 1). */
  alpha?: number;
  /** Additive blending (glows, sparks). */
  additive?: boolean;
  /** Terrain interaction (default 'none'; needs the terrain passed to update). */
  ground?: GroundMode;
  /** Restitution for 'bounce' (default 0.4). */
  bounce?: number;
  /** Horizontal speed kept on each bounce (default 0.7). */
  friction?: number;
  /** Random horizontal flip for sprites. */
  randomFlip?: boolean;
}

/** Preset with every field filled, so all particles share one object shape. */
interface Compiled {
  kind: 0 | 1 | 2;
  w: number;
  h: number;
  sprite: string;
  frame: number;
  randomFrames: number;
  ticksPerFrame: number;
  lifeMin: number;
  lifeMax: number;
  gravity: number;
  drag: number;
  colors: readonly Color[];
  fadeFrom: number;
  alpha: number;
  blend: 'normal' | 'add';
  ground: 0 | 1 | 2 | 3;
  bounce: number;
  friction: number;
  randomFlip: boolean;
}

const WHITE: readonly Color[] = [0xffffffff];
const compiledCache = new WeakMap<ParticlePreset, Compiled>();

function compile(p: ParticlePreset): Compiled {
  let c = compiledCache.get(p);
  if (c) return c;
  const life = p.life ?? 30;
  const [lifeMin, lifeMax] = typeof life === 'number' ? [life, life] : [life[0], life[1]];
  c = {
    kind: p.kind === 'rect' ? 1 : p.kind === 'sprite' ? 2 : 0,
    w: p.w ?? (p.kind === 'rect' ? 2 : 1),
    h: p.h ?? (p.kind === 'rect' ? 2 : 1),
    sprite: p.sprite ?? '',
    frame: p.frame ?? 0,
    randomFrames: Math.max(0, Math.floor(p.randomFrames ?? 0)),
    ticksPerFrame: Math.max(0, Math.floor(p.ticksPerFrame ?? 0)),
    lifeMin: Math.max(1, Math.floor(lifeMin)),
    lifeMax: Math.max(1, Math.floor(Math.max(lifeMin, lifeMax))),
    gravity: p.gravity ?? 0,
    drag: p.drag ?? 1,
    colors: p.colors && p.colors.length ? p.colors : WHITE,
    fadeFrom: Math.min(1, Math.max(0, p.fadeFrom ?? 1)),
    alpha: p.alpha ?? 1,
    blend: p.additive ? 'add' : 'normal',
    ground: p.ground === 'bounce' ? 1 : p.ground === 'stop' ? 2 : p.ground === 'die' ? 3 : 0,
    bounce: p.bounce ?? 0.4,
    friction: p.friction ?? 0.7,
    randomFlip: !!p.randomFlip,
  };
  compiledCache.set(p, c);
  return c;
}

// ---------------------------------------------------------------------------------------------
// Built-in presets (palette-neutral defaults; content can define its own)
// ---------------------------------------------------------------------------------------------

export const SPARK: ParticlePreset = {
  kind: 'rect',
  w: 1,
  h: 1,
  life: [6, 14],
  gravity: 0.08,
  drag: 0.9,
  colors: [0xffffffff, 0xfff2a0ff, 0xffc040ff, 0xe06020ff],
  additive: true,
};

export const DEBRIS: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [40, 70],
  gravity: 0.2,
  colors: [0x8a8070ff, 0x6a6052ff],
  fadeFrom: 0.75,
  ground: 'bounce',
  bounce: 0.35,
  friction: 0.6,
};

export const SMOKE: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 3,
  life: [30, 50],
  gravity: -0.015,
  drag: 0.94,
  colors: [0xd8d4ccc0, 0xa8a49cb0, 0x78746ca0, 0x50504880],
  fadeFrom: 0.35,
};

export const CASING: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 1,
  life: [50, 80],
  gravity: 0.25,
  colors: [0xe8c050ff, 0xb08828ff],
  fadeFrom: 0.8,
  ground: 'bounce',
  bounce: 0.3,
  friction: 0.5,
};

export const DUST: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [12, 24],
  gravity: -0.01,
  drag: 0.88,
  colors: [0xd8c8a0c0, 0xb8a888a0, 0x98886880],
  fadeFrom: 0.3,
};

export const EMBER: ParticlePreset = {
  kind: 'pixel',
  life: [20, 40],
  gravity: -0.03,
  drag: 0.97,
  colors: [0xfff0a0ff, 0xffb040ff, 0xe05020ff, 0x802010ff],
  additive: true,
  fadeFrom: 0.6,
};

/** Shared, mutated per draw call (renderers must not keep DrawOpts). */
const drawOpts: DrawOpts = { alpha: 1, blend: 'normal', flipX: false };

export class Particles {
  readonly capacity: number;
  private n = 0;
  private cursor = 0;
  private readonly rng: Rng;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pvx: Float32Array;
  private readonly pvy: Float32Array;
  private readonly age: Int32Array;
  private readonly life: Int32Array;
  private readonly frame0: Int32Array;
  private readonly color: Uint32Array;
  private readonly flip: Uint8Array;
  private readonly preset: (Compiled | null)[];

  constructor(capacity = 1024, rng: Rng = new Rng('particles')) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.rng = rng;
    const c = this.capacity;
    this.px = new Float32Array(c);
    this.py = new Float32Array(c);
    this.pvx = new Float32Array(c);
    this.pvy = new Float32Array(c);
    this.age = new Int32Array(c);
    this.life = new Int32Array(c);
    this.frame0 = new Int32Array(c);
    this.color = new Uint32Array(c);
    this.flip = new Uint8Array(c);
    this.preset = new Array<Compiled | null>(c).fill(null);
  }

  /** Live particle count. */
  get count(): number {
    return this.n;
  }

  /**
   * Spawn one particle. `life` overrides the preset lifetime; `color` (non-zero) replaces the
   * colour ramp with one fixed colour.
   */
  emit(p: ParticlePreset, x: number, y: number, vx = 0, vy = 0, life?: number, color?: Color): void {
    const c = compile(p);
    let i: number;
    if (this.n < this.capacity) i = this.n++;
    else {
      i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
    }
    const rng = this.rng;
    this.px[i] = x;
    this.py[i] = y;
    this.pvx[i] = vx;
    this.pvy[i] = vy;
    this.age[i] = 0;
    this.life[i] =
      life !== undefined ? Math.max(1, Math.floor(life)) : c.lifeMin === c.lifeMax ? c.lifeMin : rng.int(c.lifeMin, c.lifeMax);
    this.frame0[i] = c.frame + (c.randomFrames > 0 ? rng.int(0, c.randomFrames - 1) : 0);
    this.color[i] = color ?? 0;
    this.flip[i] = c.randomFlip && rng.chance(0.5) ? 1 : 0;
    this.preset[i] = c;
  }

  /**
   * Spawn `count` particles at (x, y) with random speeds in [speedMin, speedMax] and directions
   * within `spread` radians around `angle` (default: every direction).
   */
  burst(
    p: ParticlePreset,
    x: number,
    y: number,
    count: number,
    speedMin: number,
    speedMax: number,
    angle = -Math.PI / 2,
    spread = Math.PI * 2,
    color?: Color,
  ): void {
    const rng = this.rng;
    for (let k = 0; k < count; k++) {
      const a = angle + (rng.next() - 0.5) * spread;
      const s = rng.range(speedMin, speedMax);
      this.emit(p, x, y, Math.cos(a) * s, Math.sin(a) * s, undefined, color);
    }
  }

  /** Advance all particles one tick. Pass the terrain for presets with a `ground` mode. */
  update(terrain?: Terrain | null): void {
    let i = 0;
    while (i < this.n) {
      const c = this.preset[i] as Compiled;
      const age = ++this.age[i];
      if (age >= this.life[i]) {
        this.kill(i);
        continue;
      }
      let vx = this.pvx[i];
      let vy = this.pvy[i] + c.gravity;
      if (c.drag !== 1) {
        vx *= c.drag;
        vy *= c.drag;
      }
      const x = this.px[i];
      const y = this.py[i];
      const nx = x + vx;
      const ny = y + vy;
      if (c.ground !== 0 && terrain && terrain.isSolid(nx, ny)) {
        if (c.ground === 3) {
          this.kill(i);
          continue;
        }
        if (c.ground === 2) {
          vx = 0;
          vy = 0;
        } else if (terrain.isSolid(x, ny)) {
          // Hit a floor or ceiling: reflect vertically, lose some sideways speed.
          vy = -vy * c.bounce;
          vx *= c.friction;
          if (Math.abs(vy) < 0.3) vy = 0;
        } else {
          vx = -vx * c.bounce; // hit a wall
        }
        this.pvx[i] = vx;
        this.pvy[i] = vy;
        i++;
        continue;
      }
      this.px[i] = nx;
      this.py[i] = ny;
      this.pvx[i] = vx;
      this.pvy[i] = vy;
      i++;
    }
  }

  /** Draw every particle that is near the view. */
  draw(r: Renderer): void {
    const x0 = r.camX - 32;
    const y0 = r.camY - 32;
    const x1 = r.camX + r.w + 32;
    const y1 = r.camY + r.h + 32;
    for (let i = 0; i < this.n; i++) {
      const x = this.px[i];
      const y = this.py[i];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const c = this.preset[i] as Compiled;
      const t = this.age[i] / this.life[i];
      let a = c.alpha;
      if (t > c.fadeFrom) a *= 1 - (t - c.fadeFrom) / (1 - c.fadeFrom);
      if (a <= 0.01) continue;
      drawOpts.alpha = a;
      drawOpts.blend = c.blend;
      drawOpts.flipX = this.flip[i] === 1;
      if (c.kind === 2) {
        const f = this.frame0[i] + (c.ticksPerFrame > 0 ? Math.floor(this.age[i] / c.ticksPerFrame) : 0);
        r.sprite(c.sprite, f, Math.round(x), Math.round(y), drawOpts);
        continue;
      }
      const ramp = c.colors;
      const col = this.color[i] !== 0 ? this.color[i] : ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
      if (c.kind === 0) r.rect(Math.floor(x), Math.floor(y), 1, 1, col, drawOpts);
      else r.rect(Math.round(x - c.w / 2), Math.round(y - c.h / 2), c.w, c.h, col, drawOpts);
    }
  }

  clear(): void {
    this.n = 0;
    this.cursor = 0;
    this.preset.fill(null);
  }

  // ------------------------------------------------------------------------------- helpers

  /** Sparks flying away from a hit; `dirX` 1/-1 aims them, 0 = every direction. */
  sparks(x: number, y: number, count = 6, dirX = 0): void {
    if (dirX === 0) this.burst(SPARK, x, y, count, 0.8, 2.6);
    else this.burst(SPARK, x, y, count, 0.8, 2.6, dirX > 0 ? 0 : Math.PI, 1.8);
  }

  /** Chunks thrown up that bounce on the ground. `colors` picks a random colour per chunk. */
  debris(x: number, y: number, count = 8, colors?: readonly Color[]): void {
    const rng = this.rng;
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + (rng.next() - 0.5) * 2.2;
      const s = rng.range(1, 3.6);
      const col = colors && colors.length ? colors[rng.int(0, colors.length - 1)] : undefined;
      this.emit(DEBRIS, x, y, Math.cos(a) * s, Math.sin(a) * s, undefined, col);
    }
  }

  /** Slow rising smoke puffs. */
  smoke(x: number, y: number, count = 4): void {
    const rng = this.rng;
    for (let k = 0; k < count; k++) {
      this.emit(SMOKE, x + rng.range(-3, 3), y + rng.range(-2, 2), rng.range(-0.3, 0.3), rng.range(-0.6, -0.1));
    }
  }

  /** One shell casing ejected backwards (dirX = the shooter's facing). */
  casing(x: number, y: number, dirX: number): void {
    const rng = this.rng;
    this.emit(CASING, x, y, -Math.sign(dirX || 1) * rng.range(0.6, 1.4), rng.range(-2.4, -1.4));
  }

  /** Dust puffs at the feet (landing, skidding). */
  dust(x: number, y: number, count = 4): void {
    const rng = this.rng;
    for (let k = 0; k < count; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      this.emit(DUST, x + side * rng.range(1, 4), y - 1, side * rng.range(0.4, 1.2), rng.range(-0.5, -0.1));
    }
  }

  /** Glowing embers that drift up (fires, explosions). */
  embers(x: number, y: number, count = 6): void {
    this.burst(EMBER, x, y, count, 0.3, 1.4, -Math.PI / 2, 2.4);
  }

  /** Swap-remove particle i (order is not preserved). */
  private kill(i: number): void {
    const last = --this.n;
    if (i !== last) {
      this.px[i] = this.px[last];
      this.py[i] = this.py[last];
      this.pvx[i] = this.pvx[last];
      this.pvy[i] = this.pvy[last];
      this.age[i] = this.age[last];
      this.life[i] = this.life[last];
      this.frame0[i] = this.frame0[last];
      this.color[i] = this.color[last];
      this.flip[i] = this.flip[last];
      this.preset[i] = this.preset[last];
    }
    this.preset[last] = null;
    if (this.cursor >= this.n && this.n > 0) this.cursor = 0;
  }
}
