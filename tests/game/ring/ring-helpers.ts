/**
 * Helpers for the ring runtime tests: a RingRunner on a tiny hand-made plan (the tests never
 * depend on the generator), pads driven by held / tapped buttons, and small test entities in the
 * plane (a target, a foe that records its reactions, a civilian SolidBox).
 */
import { vi } from 'vitest';
import type { Damage, Entity } from '../../../src/engine/entity';
import { buttonMask, VirtualPad, type Button } from '../../../src/engine/input';
import type { Rect } from '../../../src/engine/math';
import { SolidBox } from '../../../src/engine/physics';
import type { World } from '../../../src/engine/world';
import '../../../src/game/content/characters/index';
import '../../../src/game/content/weapons/index';
import { Enemy, type ReactionKind } from '../../../src/game/enemy';
import { defineEntity, type SpawnParams } from '../../../src/game/registry';
import { RingEntity, ringOf, slabBoxes, slabCache } from '../../../src/game/ring/entity';
import type { RingHero } from '../../../src/game/ring/hero';
import type { RingLandmarkId } from '../../../src/game/ring/ids';
import { RingRunner } from '../../../src/game/ring/runner';
import type { RingPlan, RingSpawn } from '../../../src/game/ring/types';
import type { Wagon } from '../../../src/game/ring/wagon';
import { GameSession, type Difficulty } from '../../../src/game/session';
import { applyTuning } from '../../../src/game/tuning';

applyTuning();

const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[ring] plan entry')) return;
  warn(...args);
});

/** A plan of `length` px: one stretch per landmark given (default oost then exit), no chunks. */
export function tinyPlan(o: { length?: number; spawns?: RingSpawn[]; seed?: number; difficulty?: Difficulty; landmarks?: RingLandmarkId[] } = {}): RingPlan {
  const length = o.length ?? 3000;
  const ids = o.landmarks ?? ['oost', 'exit'];
  const step = Math.floor(length / ids.length);
  const landmarks = ids.map((id, i) => ({ id, district: id, start: i * step, length: 256, lanes: 4 as const }));
  const stretches = ids.map((id, i) => ({ id, index: i, start: i * step, end: i + 1 < ids.length ? (i + 1) * step : length }));
  return {
    seed: o.seed ?? 1,
    difficulty: o.difficulty ?? 'normal',
    length,
    landmarks,
    stretches,
    chunks: [],
    spawns: o.spawns ?? [],
    bosses: [],
    drivers: ['thom', 'dirk', 'bob', 'patrick', 'vincent'],
    goldenRecord: -1,
    hostages: Object.fromEntries(ids.map((id) => [id, 0])),
  };
}

export interface RingRigOptions {
  players?: 1 | 2;
  seed?: number;
  plan?: RingPlan;
  god?: boolean;
  characters?: string[];
  credits?: number;
  lives?: number;
}

/** A started RingRunner with pads; `hold` / `tap` / `run` / `until` like the game-layer Rig. */
export class RingRig {
  readonly runner: RingRunner;
  readonly session: GameSession;
  readonly pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  readonly masks = [0, 0];

  constructor(o: RingRigOptions = {}) {
    const chars = o.characters ?? (o.players === 2 ? ['vincent', 'grace'] : ['vincent']);
    this.session = new GameSession({ characters: chars, seed: o.seed ?? 3, credits: o.credits });
    if (o.lives !== undefined) for (const s of this.session.slots) if (s.joined) s.lives = o.lives;
    this.runner = new RingRunner({ session: this.session, pads: this.pads, seed: o.seed ?? 3, plan: o.plan ?? tinyPlan() });
    this.runner.world.god = o.god ?? false;
    this.runner.start();
  }

  get world(): World {
    return this.runner.world;
  }

  get hero(): RingHero {
    return this.runner.players[0];
  }

  get wagon(): Wagon {
    const w = this.hero.wagon;
    if (!w) throw new Error('no wagon');
    return w;
  }

  hold(buttons: Button[], slot = 0): this {
    this.masks[slot] = buttonMask(...buttons);
    return this;
  }

  release(slot = 0): this {
    this.masks[slot] = 0;
    return this;
  }

  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pads[0].update(this.masks[0]);
      this.pads[1].update(this.masks[1]);
      this.runner.update();
    }
    return this;
  }

  /** Press for one tick on top of the held buttons, then one tick without. */
  tap(buttons: Button[], slot = 0): this {
    const keep = this.masks[slot];
    this.masks[slot] = keep | buttonMask(...buttons);
    this.run(1);
    this.masks[slot] = keep;
    this.run(1);
    return this;
  }

  until(pred: () => boolean, max = 600): number {
    for (let i = 0; i < max; i++) {
      if (pred()) return i;
      this.run(1);
    }
    throw new Error(`condition not met within ${max} ticks`);
  }

  /** Spawn at a screen x and plane y (keeps pace with the road by itself when it is a ring test entity). */
  spawnAt<E extends Entity>(id: string, screenX: number, y: number, params: SpawnParams = {}): E {
    const e = this.world.spawn(id, this.world.camera.x + screenX, y, params) as E;
    this.world.flush();
    return e;
  }
}

/** A ring target in the plane: an enemy RingEntity that keeps pace and logs its hits. Visual box 40 px tall. */
export class TestTarget extends RingEntity {
  readonly hits: Damage[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.team = 'enemy';
    this.hp = this.maxHp = typeof p.hp === 'number' ? p.hp : 1e6;
    const w = typeof p.w === 'number' ? p.w : 24;
    this.hitbox = { x: -w / 2, y: -40, w, h: 40 };
    this.despawnMargin = Infinity;
    this.addTag('enemy', 'shootable');
  }

  override update(): void {
    this.keepPace(0);
    this.x += this.vx;
  }

  override onHit(d: Damage, part = 0): boolean {
    this.hits.push(d);
    return super.onHit(d, part);
  }
}
defineEntity('test-ring-target', (w, x, y, p) => new TestTarget(w, x, y, p), { category: 'enemy' });

/** An Enemy in the plane (slab boxes, keeps pace) that records the reactions it accepted. */
export class TestFoe extends Enemy {
  readonly reactions: ReactionKind[] = [];
  private readonly slab = slabCache();

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/test-foe', hp: 1e6, body: false, w: 20, h: 30 });
    this.despawnMargin = Infinity;
  }

  protected override think(): void {
    this.vx = ringOf(this.world)?.roadSpeed ?? 0;
    this.x += this.vx;
  }

  protected override thinkReaction(): void {
    this.vx = ringOf(this.world)?.roadSpeed ?? 0;
    this.x += this.vx;
  }

  protected override onReact(kind: ReactionKind): void {
    this.reactions.push(kind);
  }

  override hurtboxes(): readonly Rect[] {
    return slabBoxes(this, this.slab);
  }
}
defineEntity('test-ring-foe', (w, x, y, p) => new TestFoe(w, x, y, p), { category: 'enemy' });

/** A civilian as cover: a SolidBox over its depth slab that keeps pace (never hurt). */
export class TestCivilian extends RingEntity {
  readonly box: SolidBox;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'neutral';
    this.hitbox = { x: -20, y: -24, w: 40, h: 24 };
    this.despawnMargin = Infinity;
    const r = this.hurtboxes()[0];
    this.box = world.addSolid(new SolidBox(r.x, r.y, r.w, r.h, false, this));
  }

  override update(): void {
    this.keepPace(0);
    this.x += this.vx;
    const r = this.hurtboxes()[0];
    this.box.x = r.x;
    this.box.y = r.y;
  }
}
defineEntity('test-ring-civ', (w, x, y) => new TestCivilian(w, x, y), { category: 'prop' });
