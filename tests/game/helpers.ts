/**
 * Shared helpers for the game-layer tests: a flat test world with players driven by virtual
 * pads, a soft target dummy, and quiet logs for missing sprites (art is built in parallel).
 */
import { vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import { VirtualPad, buttonMask } from '../../src/engine/input';
import { Terrain, terrain, type TerrainBuilder } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { attachGame, HudState } from '../../src/game/context';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import { Enemy } from '../../src/game/enemy';
import { Player } from '../../src/game/player/player';
import { defineEntity, gameEntityFactory, type SpawnParams } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { applyTuning } from '../../src/game/tuning';

applyTuning();

// Missing sprites are expected while the art agents work: keep the test output readable.
const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown')) return;
  warn(...args);
});

export const FLOOR = 170;

/** A soft enemy that just stands there (and logs the hits it took). */
export class Dummy extends Enemy {
  readonly hits: { amount: number; kind: string }[] = [];

  constructor(world: World, x: number, y: number, params: SpawnParams = {}) {
    super(world, x, y, params, { art: 'enemy/dummy', hp: 10, soft: params.soft !== false });
  }

  override onHit(d: Parameters<Enemy['onHit']>[0], part = 0): boolean {
    this.hits.push({ amount: d.amount, kind: d.kind });
    return super.onHit(d, part);
  }
}
defineEntity('test-dummy', (w, x, y, p) => new Dummy(w, x, y, p), { category: 'enemy', score: 100 });

export interface RigOptions {
  width?: number;
  /** Extra terrain on top of the flat floor (or replace it with `noFloor`). */
  build?: (t: TerrainBuilder) => void;
  noFloor?: boolean;
  players?: 1 | 2;
  x?: number;
  seed?: number;
}

/** A world with a flat floor at y = 170, a session, and players driven by `hold` / `run`. */
export class Rig {
  readonly world: World;
  readonly session: GameSession;
  readonly hud = new HudState();
  readonly pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  readonly masks = [0, 0];
  readonly players: Player[] = [];

  constructor(o: RigOptions = {}) {
    const width = o.width ?? 3000;
    const t = terrain(width, 216);
    if (!o.noFloor) t.ground().at(0, FLOOR).flat(width);
    o.build?.(t);
    this.world = new World({ terrain: new Terrain(t.build()), seed: o.seed ?? 7, factory: gameEntityFactory });
    this.session = new GameSession({ characters: o.players === 2 ? ['recruit', 'recruit'] : ['recruit'], seed: o.seed ?? 7 });
    attachGame(this.world, this.session, this.hud);
    const n = o.players ?? 1;
    for (let i = 0; i < n; i++) {
      const x = (o.x ?? 100) - i * 20;
      const p = new Player(this.world, x, FLOOR, { pad: this.pads[i], index: i as 0 | 1 });
      this.world.add(p);
      p.placeAt(x, FLOOR, 0);
      this.players.push(p);
    }
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.world.camera.snap();
  }

  get p(): Player {
    return this.players[0];
  }

  /** Hold these buttons (player 0, or `slot`) from now on (replaces the held set). */
  hold(buttons: Button[], slot = 0): this {
    this.masks[slot] = buttonMask(...buttons);
    return this;
  }

  release(slot = 0): this {
    this.masks[slot] = 0;
    return this;
  }

  /** Advance n ticks with the held buttons. */
  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pads[0].update(this.masks[0]);
      this.pads[1].update(this.masks[1]);
      this.world.update();
    }
    return this;
  }

  /** Press buttons for one tick (on top of the held ones), then release them for one tick. */
  tap(buttons: Button[], slot = 0): this {
    const keep = this.masks[slot];
    this.masks[slot] = keep | buttonMask(...buttons);
    this.run(1);
    this.masks[slot] = keep;
    this.run(1);
    return this;
  }

  /** Run until `pred` is true (or fail after `max` ticks). Returns the ticks it took. */
  until(pred: () => boolean, max = 600): number {
    for (let i = 0; i < max; i++) {
      if (pred()) return i;
      this.run(1);
    }
    throw new Error(`condition not met within ${max} ticks`);
  }

  /** Spawn a test dummy (soft enemy, 10 hp) on the floor. */
  dummy(x: number, params: SpawnParams = {}): Dummy {
    const d = this.world.spawn('test-dummy', x, FLOOR, params) as Dummy;
    this.world.flush();
    return d;
  }

  /** Live entities of a type (e.g. 'pistol' shots, 'grenade'). */
  ofType(type: string): readonly Entity[] {
    return this.world.entities.filter((e) => e.type === type && !e.removed);
  }
}
