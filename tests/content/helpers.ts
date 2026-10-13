/**
 * Helpers for the content tests: a flat test world (floor at y = 176) with the game context and
 * one player on a virtual pad, plus quiet logs for art that other agents are still drawing.
 */
import { vi } from 'vitest';
import type { Entity } from '../../src/engine/entity';
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

// ---------------------------------------------------------------------------------------------
// Fairness watcher (GDD §4.11): shared by the creature and locals tests
// ---------------------------------------------------------------------------------------------

/** An enemy with a traced behaviour mode (Creature and friends). */
export type ModeEntity = Entity & { mode: string; holdsToken?: boolean; killedBy?: unknown };

export interface FairnessWatch {
  /** Every telegraph run (ticks) that ended while the enemy was alive. */
  tells: number[];
  /**
   * Attacks: the mode, the telegraph run before it (`tell` ticks, `tellInView` of them with the
   * enemy on screen), the mode before it, whether the enemy was in view at the attack.
   */
  attacks: Array<{ id: string; mode: string; tell: number; tellInView: number; prev: string; inView: boolean }>;
  /** Enemy shots that appeared outside the view (8 px margin). */
  outsideShots: number;
  /** Bursts (see `FairnessOpts.burst`) with the telegraph run before them. */
  bursts: number[];
  maxTokens: number;
}

export interface FairnessOpts {
  /** Attack mode → the telegraph mode that must come right before it. */
  attacks: Readonly<Record<string, string>>;
  tells: ReadonlySet<string>;
  /** Which entities to trace (default: enemies with a string `mode`). */
  watched?: (e: Entity) => boolean;
  /** An entity removed while alive right after a telegraph counts as a burst (self-destructs). */
  burst?: (e: ModeEntity) => boolean;
}

const isModeEnemy = (e: Entity): boolean => e.team === 'enemy' && typeof (e as unknown as { mode?: unknown }).mode === 'string';

/** Run a world and record mode changes of every traced enemy, enemy shots and attack tokens. */
export function watchFairness(tw: TestWorld, ticks: number, o: FairnessOpts, each?: (t: number) => void): FairnessWatch {
  const w: FairnessWatch = { tells: [], attacks: [], outsideShots: 0, bursts: [], maxTokens: 0 };
  const watched = o.watched ?? isModeEnemy;
  const state = new Map<ModeEntity, { mode: string; n: number; seen: number }>();
  const seenShots = new Set<Entity>();
  for (let t = 0; t < ticks; t++) {
    tw.run(1);
    each?.(t);
    let tokens = 0;
    for (const e of tw.world.entities) {
      if (e.team === 'enemy' && e.hasTag('shot') && !seenShots.has(e)) {
        seenShots.add(e);
        if (!tw.world.camera.containsPoint(e.x, e.y, -8)) w.outsideShots++;
      }
      if (watched(e) && !state.has(e as ModeEntity)) {
        const m = e as ModeEntity;
        state.set(m, { mode: m.mode, n: 0, seen: 0 });
      }
    }
    for (const [e, s] of state) {
      if (e.holdsToken) tokens++;
      if (e.removed) {
        if (!e.killedBy && o.tells.has(s.mode) && o.burst?.(e)) w.bursts.push(s.n);
        state.delete(e);
        continue;
      }
      if (e.dead) continue;
      if (e.mode === s.mode) {
        s.n++;
        if (e.onScreen(0)) s.seen++;
        continue;
      }
      if (o.tells.has(s.mode)) w.tells.push(s.n);
      if (o.attacks[e.mode]) w.attacks.push({ id: e.type, mode: e.mode, tell: s.n, tellInView: s.seen, prev: s.mode, inView: e.onScreen(0) });
      s.mode = e.mode;
      s.n = 1;
      s.seen = e.onScreen(0) ? 1 : 0;
    }
    w.maxTokens = Math.max(w.maxTokens, tokens);
  }
  return w;
}
