/**
 * Draws a section's canal scene (docs/api/canal.md §3): the kit's layer stack, in its order, with its
 * maths — `SectionView` calls `draw(r, tick, false, d)` in the back pass (the non-`over` layers) and
 * `draw(r, tick, true, d)` in the front pass (the `over` layers).
 *
 * Per layer and visible column the best tier that is in: the wanted tier's tile, else a lower
 * tier's (tier 1 loads first), else nothing (the scene is still loading). Every tile is one
 * `Renderer.rows` call: `img` / `frames` at their speed, `tile` wrapped (two copies) and drifting,
 * `rows` sheared (each row at its own speed). Frames step every 10 ticks. No allocation per frame.
 *
 * A LIT PAIR (docs/api/canal.md "A lit section"; mission `sewers` c, d, e): a scene whose manifest
 * has a lit stack (a section with `litOf` = this one: the same layers and geometry, what the
 * flashlight shows) loads both. Each pass draws the ambient layers, then — when the section's light
 * pass is in the entity-only mode and something is lit — the lit layers of the same pass into the
 * renderer's layer, clipped to the lit box, kept where the pass's lit mask is opaque
 * (`Renderer.layerMask`; the mask's dither at the lit layers' tier), and drawn over them. The mask is asked for once per frame in the back
 * pass (`LightControl.litMask`: the pass the runner set, `light`); after the back pass the entities go to
 * the pass's entity layer (`entitiesBegin`), and before the `over` layers the pass darkens them and
 * draws them (`entitiesEnd`). Without a pass (a headless scenery frame, the fidelity test) or a
 * pass in that mode, or a renderer without the layer, only the ambient stack draws.
 */
import type { Renderer, RowsDraw } from '../../../engine/render';
import type { Entity } from '../../../engine/entity';
import { setFrameOverlay } from '../../../engine/sprites';
import type { World } from '../../../engine/world';
import { VIEW_W } from '../../../engine/render';
import { lightControl, type LightControl } from '../light/api';
import type { LitMask } from '../light/litmask';
import { canalLitOf } from './registry';
import { CanalSprites } from './sprites';
import { canalLitState, canalState, releaseCanal, wantCanal, type CanalSceneState, type CanalTier } from './store';
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

/**
 * A renderer that draws nothing (the scenic probe of `CanalView.hook`): it notes whether a draw asks
 * for one of `ids` by sprite id (a frame asked through the overlay counts in `CanalSprites.hits`).
 */
class ProbeRenderer implements Renderer {
  readonly w = VIEW_W;
  readonly h = 216;
  readonly res = 1;
  readonly mode = 'pixel' as const;
  readonly subpixel = 'all' as const;
  camX = 0;
  camY = 0;
  ids: ReadonlySet<string> = new Set();
  hit = false;
  setMode(): void {}
  setSubpixel(): void {}
  begin(): void {}
  end(): void {}
  setCamera(): void {}
  sprite(id: string): void {
    if (this.ids.has(id)) this.hit = true;
  }
  frame(): void {}
  image(): void {}
  rect(): void {}
  line(): void {}
  text(): void {}
  parallax(): void {}
  fade(): void {}
}

const PROBE = new ProbeRenderer();

/** One stack drawn (the ambient one, or the lit one of a pair): its state and the tiers to try. */
class Stack {
  readonly state: CanalSceneState;
  /** The tiers to try (the wanted one, then each lower baked one), refreshed when the density changes. */
  readonly cands: (CanalTier | null)[] = [null, null, null];
  n = 0;
  private d = -1;

  constructor(state: CanalSceneState) {
    this.state = state;
  }

  tiers(d: number): void {
    if (d === this.d) return;
    this.d = d;
    this.n = 0;
    const s = this.state;
    for (const t of [4, 2, 1]) {
      if (t > d) continue;
      const st = s.tier(t);
      if (st) this.cands[this.n++] = st;
    }
  }
}

export class CanalView {
  readonly def: CanalDef;
  readonly state: CanalSceneState;
  /** The lit stack of a lit pair (docs/api/canal.md "A lit section"), else null. */
  readonly lit: CanalSceneState | null;
  private readonly amb: Stack;
  private readonly litStack: Stack | null;
  /** This frame's lit mask (the back pass asks the light pass; the front pass reuses it), or null. */
  private mask: LitMask | null = null;
  /** The light pass whose entity layer this frame's back pass opened (the front pass closes it), or null. */
  private entities: LightControl | null = null;
  /** Lit composites drawn last frame (tests / debug: 0, 1 or 2 passes). */
  litDrawn = 0;
  /** A whole screen of the ambient stack was in once (until then the view draws black). */
  ready = false;

  /**
   * Visible columns of the ambient stack at camera camX and density d that no loaded tier has a tile
   * for (a column whose tile is off the screen, or that is empty, does not count).
   */
  missing(camX: number, d: number): number {
    const stack = this.amb;
    const s = stack.state;
    stack.tiers(Math.min(d, s.layerCap));
    if (stack.n === 0) return 1;
    const top = stack.cands[0] as CanalTier;
    const layers = s.sec.layers;
    const col = s.man.col;
    let miss = 0;
    for (let li = 0; li < layers.length; li++) {
      if (s.skip.has(li)) continue;
      const meta = layers[li];
      const L0 = top.man.layers[li];
      const ncol = top.cols(li);
      const a = meta.kind === 'rows' ? (L0.s0 ?? L0.speed) : L0.speed;
      const b = meta.kind === 'rows' ? (L0.s1 ?? L0.speed) : L0.speed;
      const smin = Math.min(a, b);
      const smax = Math.max(a, b);
      const tile = meta.kind === 'tile';
      const c0 = tile ? 0 : Math.max(0, Math.floor((camX * smin - 2) / col));
      const c1 = tile ? ncol - 1 : Math.min(ncol - 1, Math.floor((camX * smax + VIEW_W + 2) / col));
      for (let c = c0; c <= c1; c++) {
        const ti = top.at(li, 0, c);
        if (ti >= 0 && !tile) {
          const t = top.tiles[ti];
          const T = top.tier;
          if ((t.x + t.w) / T - camX * smin < 0 || t.x / T - camX * smax > VIEW_W) continue;
        }
        let ok = false;
        for (let k = 0; k < stack.n; k++) {
          const st = stack.cands[k] as CanalTier;
          const idx = st.at(li, 0, c);
          if (idx < 0 || st.tiles[idx].img) {
            ok = true;
            break;
          }
        }
        if (!ok) miss++;
      }
    }
    return miss;
  }
  /**
   * The section's light pass (the mission runner sets it with the pass; docs/api/canal.md "A lit
   * section"): it gives the lit mask and the entity layer. Null: the pass bound to `world`, if any.
   */
  light: LightControl | null = null;
  /**
   * The scene's canal sprites (docs/api/canal.md §7; null: none): the frame overlay the mission runner
   * sets around its drawing while the scene draws (engine/sprites.ts `setFrameOverlay`).
   */
  readonly sprites: CanalSprites | null;
  /**
   * A lit pair's LIT canal sprites (docs/api/canal.md "A lit section"): an entity that draws a canal
   * sprite is drawn like the scenery — its ambient frames outside the entity darkness, its lit frames
   * through the lit mask (`hook`). Null without a lit pair or lit sprites.
   */
  private readonly litSprites: CanalSprites | null;
  /** Per entity: does it draw a canal sprite (it draws like the scenery)? Asked once (`probe`). */
  private readonly scenic = new WeakMap<Entity, boolean>();
  /** Scenic entity draws last frame (tests / debug). */
  scenicDrawn = 0;
  private readonly o: RowsDraw = { rows: 1, j0: 0, s0: 0, s1: 0, cam: 0, add: 0, period: 0, wrap: 0 };

  /**
   * The world of the last frame drawn (`SectionView.drawShadows`), for the layer rules (`CanalDef.show`);
   * null: every layer draws.
   */
  get world(): World | null {
    return this.worldRef;
  }

  set world(w: World | null) {
    if (this.worldRef && this.worldRef !== w && this.worldRef.drawHook === this.hook) this.worldRef.drawHook = null;
    this.worldRef = w;
    if (w && this.entities && this.litSprites) w.drawHook = this.hook;
  }

  private worldRef: World | null = null;

  /**
   * The world's draw hook while the entity layer is open (a lit pair with canal sprites): an entity
   * that drew a canal sprite last time closes the layer (`entitiesFlush`: what is behind it is
   * darkened and drawn), draws itself with the AMBIENT frames on the scenery, then with the LIT
   * frames into the layer under the lit mask, and the layer opens again — so its darkness is the
   * baked one, never the pass's, and every entity keeps its draw order. Any other entity draws into
   * the layer, and is remembered when it asked for a canal sprite.
   */
  private readonly hook = (r: Renderer, e: Entity): boolean => {
    const amb = this.sprites;
    const ctl = this.entities;
    if (!amb || !ctl || e.drawDepth !== 0) return false;
    let sc = this.scenic.get(e);
    if (sc === undefined) {
      // Once per entity: a draw into a renderer that draws nothing, counting the canal sprites it asks for.
      const h = amb.hits;
      PROBE.ids = amb.idSet;
      PROBE.hit = false;
      PROBE.camX = r.camX;
      PROBE.camY = r.camY;
      e.draw(PROBE);
      sc = PROBE.hit || amb.hits !== h;
      this.scenic.set(e, sc);
    }
    if (!sc) return false;
    ctl.entitiesFlush?.(r);
    e.draw(r);
    const m = this.mask;
    const lit = this.litSprites;
    if (m && lit && r.layerBegin && r.layerMask && r.layerEnd) {
      const was = setFrameOverlay(lit);
      r.layerBegin(m.box);
      try {
        e.draw(r);
      } finally {
        setFrameOverlay(was);
      }
      r.layerMask(m.buf, m.d, m.x, m.y, m.dirty);
      r.layerEnd();
    }
    ctl.entitiesReopen?.(r);
    this.scenicDrawn++;
    return true;
  };
  /** Per layer: the index of its rule in `ruleFns` (`CanalDef.show`, by id prefix), or −1. */
  private readonly ruleOf: Int16Array;
  private readonly ruleFns: ((world: World) => boolean)[] = [];
  /** The rules' answers this frame (the back pass asks them; the front pass reuses them). */
  private readonly ruleOn: boolean[] = [];

  private constructor(def: CanalDef, state: CanalSceneState, lit: CanalSceneState | null) {
    this.def = def;
    this.state = state;
    this.lit = lit;
    this.amb = new Stack(state);
    this.litStack = lit ? new Stack(lit) : null;
    // A lit pair's canal sprites are the lit stack's (the entities are darkened by the light pass).
    this.sprites = CanalSprites.of(state);
    this.litSprites = lit && this.sprites ? CanalSprites.of(lit) : null;
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
    if (!st) return null;
    const litId = canalLitOf(def.scene);
    return new CanalView(def, st, litId ? canalLitState(litId, def.skip ?? []) : null);
  }

  /** A file of the scene failed: the section draws its old scenery. (A failed lit stack only stops the lit composite.) */
  get failed(): boolean {
    return this.state.failed;
  }

  /** Section start: load (or queue) what the camera needs at density `want`. */
  prepare(camX: number, want: number): void {
    const cap = lastCanalDensity > 0 && lastCanalDensity < want ? lastCanalDensity : want;
    wantCanal(this.state, cap, camX);
    if (this.lit) wantCanal(this.lit, cap, camX);
  }

  /** The section is over: its tiles go. */
  dispose(): void {
    releaseCanal(this.state.id);
    if (this.lit) releaseCanal(this.lit.id);
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
    // The first screen of the section is not in yet (the browser loads it in the background): black,
    // never a part of a picture (docs/api/canal.md §4). From the first whole screen on, the tier-1
    // fallback (the whole section) covers every column.
    if (!over && !this.ready) this.ready = this.missing(r.camX, d) === 0;
    if (over && !this.ready && !this.state.failed) r.fade(0x000000ff, 1);
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
    const lit = this.lit;
    if (!over) {
      lastCanalDensity = d;
      wantCanal(s, d, r.camX);
      if (lit) wantCanal(lit, d, r.camX);
    }
    // The front pass: the entities of the light pass's layer are darkened and drawn first.
    if (over && this.entities) {
      this.entities.entitiesEnd?.(r, tick, d);
      this.entities = null;
      const w = this.worldRef;
      if (w && w.drawHook === this.hook) w.drawHook = null;
    }
    if (!r.rows || s.failed) return;
    const w = this.world;
    if (!over) {
      for (let i = 0; i < this.ruleFns.length; i++) this.ruleOn[i] = w === null || this.ruleFns[i](w);
    }
    this.drawStack(r, this.amb, tick, over, d);
    // The lit pair: the mask (back pass: asked once per frame), the lit layers of this pass under it.
    const ctl = this.light ?? (w ? lightControl(w) : null);
    if (!over) {
      this.litDrawn = 0;
      this.mask = lit && !lit.failed && ctl?.litMask && r.layerBegin && r.layerMask && r.layerEnd ? ctl.litMask(r, Math.min(d, lit.layerCap)) : null;
    }
    const m = this.mask;
    if (m && this.litStack && r.layerBegin && r.layerMask && r.layerEnd) {
      r.layerBegin(m.box);
      this.drawStack(r, this.litStack, tick, over, d);
      r.layerMask(m.buf, m.d, m.x, m.y, m.dirty);
      r.layerEnd();
      this.litDrawn++;
    }
    // The back pass done: the light pass's entity layer opens (the entity-only mode).
    if (!over) {
      this.scenicDrawn = 0;
      if (ctl?.entitiesBegin && ctl.entitiesBegin(r, tick, d)) {
        this.entities = ctl;
        // The world's draw hook (its world comes with `drawShadows`, before the entities draw).
        const w = this.worldRef;
        if (w && this.litSprites) w.drawHook = this.hook;
      }
    }
  }

  /** One pass of one stack's layers. */
  private drawStack(r: Renderer, stack: Stack, tick: number, over: boolean, d: number): void {
    const s = stack.state;
    if (!r.rows || s.failed) return;
    stack.tiers(Math.min(d, s.layerCap));
    const n = stack.n;
    if (n === 0) return;
    const cands = stack.cands;
    const top = cands[0] as CanalTier;
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
          const st = cands[ti] as CanalTier;
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
