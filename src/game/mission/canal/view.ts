/**
 * Draws a section's canal scene (docs/api/canal.md §3): the kit's layer stack, in its order, with its
 * maths — `SectionView` calls `draw(r, tick, false, d)` in the back pass (the non-`over` layers) and
 * `draw(r, tick, true, d)` in the front pass (the `over` layers).
 *
 * Per layer and visible column the best tier that is in: the wanted tier's tile, else a lower
 * tier's (tier 1 loads first), else nothing (the scene is still loading). Every tile is one
 * `Renderer.rows` call: `img` / `frames` at their speed, `tile` wrapped (two copies) and drifting,
 * `rows` sheared (each row at its own speed). Frames step every 10 ticks. No allocation per frame.
 */
import type { Renderer, RowsDraw } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { VIEW_W } from '../../../engine/render';
import { CanalSprites } from './sprites';
import { canalState, releaseCanal, wantCanal, type CanalSceneState, type CanalTier } from './store';
import type { CanalDef } from './types';

/** Ticks per frame of a `frames` / `rows` layer with more than one frame (the kit's page). */
export const CANAL_FRAME_TICKS = 10;
/** Ticks per second (a drifting layer's drift is in logical px per second). */
const TICKS_PER_SECOND = 60;

/** The density the last canal frame drew at (0 before the first): a section start loads no more than this. */
let lastCanalDensity = 0;

export function canalDrawDensity(): number {
  return lastCanalDensity;
}

/** CPU time of the canal draws (both passes) and the tiles drawn, last frame and smoothed (the browser check, `window.__ms3.canal`). */
export interface CanalDrawStats {
  ms: number;
  avgMs: number;
  maxMs: number;
  draws: number;
  frames: number;
}

const stats: CanalDrawStats = { ms: 0, avgMs: 0, maxMs: 0, draws: 0, frames: 0 };
let frameMs = 0;
let frameDraws = 0;
const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function canalDrawStats(): CanalDrawStats {
  return stats;
}

/** Forget the maximum (a measurement window starts). */
export function resetCanalDrawStats(): void {
  stats.maxMs = 0;
  stats.frames = 0;
  stats.avgMs = 0;
}

export class CanalView {
  readonly def: CanalDef;
  readonly state: CanalSceneState;
  /**
   * The scene's canal sprites (docs/api/canal.md §7; null: none): the frame overlay the mission runner
   * sets around its drawing while the scene draws (engine/sprites.ts `setFrameOverlay`).
   */
  readonly sprites: CanalSprites | null;
  private readonly o: RowsDraw = { rows: 1, j0: 0, s0: 0, s1: 0, cam: 0, add: 0, period: 0, wrap: 0 };
  /** The tiers to try (the wanted one, then each lower baked one), refreshed when the density changes. */
  private readonly cands: (CanalTier | null)[] = [null, null, null];
  private candN = 0;
  private candD = -1;

  /**
   * The world of the last frame drawn (`SectionView.drawShadows`), for the layer rules (`CanalDef.show`);
   * null: every layer draws.
   */
  world: World | null = null;
  /** Per layer: the index of its rule in `ruleFns` (`CanalDef.show`, by id prefix), or −1. */
  private readonly ruleOf: Int16Array;
  private readonly ruleFns: ((world: World) => boolean)[] = [];
  /** The rules' answers this frame (the back pass asks them; the front pass reuses them). */
  private readonly ruleOn: boolean[] = [];

  private constructor(def: CanalDef, state: CanalSceneState) {
    this.def = def;
    this.state = state;
    this.sprites = CanalSprites.of(state);
    const layers = state.sec.layers;
    this.ruleOf = new Int16Array(layers.length).fill(-1);
    for (const [prefix, fn] of Object.entries(def.show ?? {})) {
      const ri = this.ruleFns.length;
      this.ruleFns.push(fn);
      this.ruleOn.push(true);
      for (let li = 0; li < layers.length; li++) if (this.ruleOf[li] < 0 && layers[li].id.startsWith(prefix)) this.ruleOf[li] = ri;
    }
  }

  /** The view of a section's scene (null: the scene is not registered). */
  static make(def: CanalDef): CanalView | null {
    const st = canalState(def.scene, def.skip ?? []);
    return st ? new CanalView(def, st) : null;
  }

  /** A file of the scene failed: the section draws its old scenery. */
  get failed(): boolean {
    return this.state.failed;
  }

  /** Section start: load (or queue) what the camera needs at density `want`. */
  prepare(camX: number, want: number): void {
    const cap = lastCanalDensity > 0 && lastCanalDensity < want ? lastCanalDensity : want;
    wantCanal(this.state, cap, camX);
  }

  /** The section is over: its tiles go. */
  dispose(): void {
    releaseCanal(this.state.id);
  }

  private tiers(d: number): void {
    if (d === this.candD) return;
    this.candD = d;
    this.candN = 0;
    const s = this.state;
    for (const t of [4, 2, 1]) {
      if (t > d) continue;
      const st = s.tier(t);
      if (st) this.cands[this.candN++] = st;
    }
  }

  /**
   * Draw the stack's layers of one pass (`over`: the front pass) at density d (the view's density at
   * this res). The back pass also keeps the store going (load ahead, free behind).
   */
  draw(r: Renderer, tick: number, over: boolean, d: number): void {
    const t0 = clock();
    if (!over) {
      frameMs = 0;
      frameDraws = 0;
    }
    this.drawPass(r, tick, over, d);
    frameMs += clock() - t0;
    if (over) {
      stats.ms = frameMs;
      stats.draws = frameDraws;
      stats.frames++;
      stats.avgMs = stats.frames === 1 ? frameMs : stats.avgMs * 0.95 + frameMs * 0.05;
      if (frameMs > stats.maxMs) stats.maxMs = frameMs;
    }
  }

  private drawPass(r: Renderer, tick: number, over: boolean, d: number): void {
    const s = this.state;
    if (!over) {
      lastCanalDensity = d;
      wantCanal(s, d, r.camX);
    }
    if (!r.rows || s.failed) return;
    if (!over) {
      const w = this.world;
      for (let i = 0; i < this.ruleFns.length; i++) this.ruleOn[i] = w === null || this.ruleFns[i](w);
    }
    this.tiers(d);
    const n = this.candN;
    if (n === 0) return;
    const top = this.cands[0] as CanalTier;
    const layers = s.sec.layers;
    const col = s.man.col;
    const camX = r.camX;
    const k = r.res;
    const o = this.o;
    o.cam = camX;
    for (let li = 0; li < layers.length; li++) {
      const meta = layers[li];
      if (meta.over !== over || s.skip.has(li)) continue;
      const rule = this.ruleOf[li];
      if (rule >= 0 && !this.ruleOn[rule]) continue;
      const frame = meta.n > 1 ? Math.floor(tick / CANAL_FRAME_TICKS) % meta.n : 0;
      // The visible columns (layer x, logical), from the top tier's speeds.
      const L0 = top.man.layers[li];
      const ncol = top.cols(li);
      let c0 = 0;
      let c1 = ncol - 1;
      if (meta.kind !== 'tile') {
        const a = meta.kind === 'rows' ? (L0.s0 ?? L0.speed) : L0.speed;
        const b = meta.kind === 'rows' ? (L0.s1 ?? L0.speed) : L0.speed;
        c0 = Math.max(0, Math.floor((camX * Math.min(a, b) - 2) / col));
        c1 = Math.min(ncol - 1, Math.floor((camX * Math.max(a, b) + VIEW_W + 2) / col));
      }
      for (let c = c0; c <= c1; c++) {
        for (let ti = 0; ti < n; ti++) {
          const st = this.cands[ti] as CanalTier;
          const idx = st.at(li, frame, c);
          if (idx < 0) break; // empty at this tier: nothing to draw
          const t = st.tiles[idx];
          if (!t.img) continue; // not in yet: a lower tier
          const L = st.man.layers[li];
          const T = st.tier;
          o.rows = L.rows;
          o.j0 = t.y;
          if (meta.kind === 'rows') {
            o.s0 = L.s0 ?? L.speed;
            o.s1 = L.s1 ?? L.speed;
          } else {
            o.s0 = L.speed;
            o.s1 = L.speed;
          }
          o.wrap = 0;
          if (meta.kind === 'tile') {
            o.add = ((meta.drift ?? 0) * tick) / TICKS_PER_SECOND;
            o.period = Math.round((L.pw * k) / T);
          } else {
            o.add = 0;
            o.period = 0;
          }
          const x = t.x / T;
          const y = (L.y0 + t.y) / T;
          r.rows(t.img, T, x, y, o);
          frameDraws++;
          if (meta.kind === 'tile') {
            o.wrap = o.period;
            r.rows(t.img, T, x, y, o);
            frameDraws++;
          }
          break;
        }
      }
      // One layer done: a renderer that batched its sheared rows draws them now (render.ts `rowsEnd`).
      r.rowsEnd?.();
    }
  }
}
