/**
 * Helpers for the content tests: a flat test world (floor at y = 176) with the game context and
 * one player on a virtual pad, plus quiet logs for art that other agents are still drawing.
 */
import { vi } from 'vitest';
import type { Button } from '../../src/engine/input';
import { buttonMask, VirtualPad } from '../../src/engine/input';
import { Terrain, terrain, type TerrainBuilder } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { attachGame, HudState } from '../../src/game/context';
import { Player } from '../../src/game/player/player';
import { gameEntityFactory } from '../../src/game/registry';
import { GameSession, type Difficulty } from '../../src/game/session';
import { applyTuning } from '../../src/game/tuning';

applyTuning();

const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

export const FLOOR = 176;

export interface TestWorldOptions {
  width?: number;
  seed?: number;
  difficulty?: Difficulty;
  /** Player x (null = no player). */
  playerX?: number | null;
  god?: boolean;
  /** Skip the default flat floor (build your own ground in `build`). */
  noFloor?: boolean;
  build?: (t: TerrainBuilder) => void;
}

export class TestWorld {
  readonly world: World;
  readonly session: GameSession;
  readonly hud = new HudState();
  readonly pad = new VirtualPad();
  readonly player: Player | null;
  private mask = 0;

  constructor(o: TestWorldOptions = {}) {
    const width = o.width ?? 1600;
    const t = terrain(width, 216);
    if (!o.noFloor) t.ground().at(0, FLOOR).flat(width);
    o.build?.(t);
    this.world = new World({ terrain: new Terrain(t.build()), seed: o.seed ?? 11, factory: gameEntityFactory });
    this.session = new GameSession({ difficulty: o.difficulty ?? 'normal', seed: o.seed ?? 11 });
    attachGame(this.world, this.session, this.hud);
    this.world.god = o.god ?? false;
    const px = o.playerX === undefined ? 100 : o.playerX;
    if (px !== null) {
      const p = new Player(this.world, px, FLOOR, { pad: this.pad, index: 0 });
      this.world.add(p);
      p.placeAt(px, FLOOR, 0);
      this.player = p;
    } else this.player = null;
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.world.camera.snap();
  }

  hold(...buttons: Button[]): this {
    this.mask = buttonMask(...buttons);
    return this;
  }

  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pad.update(this.mask);
      this.world.update();
    }
    return this;
  }

  /** Run until `pred` holds; returns the ticks it took (throws after `max`). */
  until(pred: () => boolean, max = 600): number {
    for (let i = 0; i < max; i++) {
      if (pred()) return i;
      this.run(1);
    }
    throw new Error(`condition not met within ${max} ticks`);
  }

  spawn(id: string, x: number, params: Record<string, unknown> = {}, y = FLOOR) {
    const e = this.world.spawn(id, x, y, params);
    this.world.flush();
    return e;
  }

  ofType(type: string) {
    return this.world.entities.filter((e) => e.type === type && !e.removed);
  }
}
