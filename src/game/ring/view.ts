/**
 * The ring's view (docs/design/ring.md §2, §11, §13 "Scenery streaming", "Drawing order";
 * docs/api/ring.md "Scenery"). Owner: the SCENERY builder (with light.ts).
 *
 * The contract the runner uses (kept from the core stage):
 * - `new RingView(plan, seed, density)`; `dispose()` when the play ends.
 * - `sky`: the clear colour of the frame.
 * - `update(host)`: once per runner tick (scenery state, ambience).
 * - `drawBack(r, host)`: everything behind the entities; the camera is already set.
 * - `drawFront(r, host)`: the front layer (the near crash barrier, parallax 1.25).
 * - `drawLight(r, host)`: the light pass after the front layer (light.ts: tunnel darkness, lamp
 *   bands, headlights, muzzle flashes, blasts).
 *
 * LAYERS (far first; screen y, parallax factor f): the sky (one tile, f 0.04); `far` the hazy
 * skyline (0.2); `city` the district (0.35); `verge` the far side of the oncoming carriageway
 * (0.75: trees, noise screens, fences, the bridge parapet, direction signs); `farroad` the
 * oncoming carriageway or the railway between the carriageways at Zuid (0.9) with the oncoming
 * traffic as scenery sprites; `tunnel` the tunnel interior and covered stretches (1.0, only
 * between portals); `road` the median, the hectometre boards, the 4 lanes and the hard shoulder
 * (1.0, world space: it moves with the entities); `front` the near crash barrier (1.25, drawn
 * after the entities).
 *
 * STREAMING (after mission/view.ts): every layer is cut into chunks of CHUNK_W layer px; chunk i
 * of a layer is drawn by its bg generator (`ring-<layer>`, art-registry) with params that say
 * what it shows (the district look, features such as tunnels, bridges and the exit ramp, signs and
 * hectometre boards with their numbers) and `seed = mixSeed(seed, layer, i)`. A chunk is made when
 * it comes within one chunk of the view's right edge, from the plan around it (`planOf`): the plan
 * distance a layer point shows when it passes the middle of the screen. Textures hash GLOBAL layer
 * x, so neighbouring chunks of one look join seamlessly. The 1× buffer is built at once; the dense
 * buffer (density min(the mission's 4, the art tier), never above the renderer's res) is built in
 * the ring's scenery worker (the browser, scenery-job.ts; a queued main-thread art job without a
 * worker) or when first drawn (tools, tests), cropped to its opaque box.
 * Chunks left of the view are EVICTED at once (the ring only scrolls forward). The dense chunk
 * buffers and the sky stay inside RING_SCENERY_RESERVE (a test).
 *
 * SET PIECES: landmark decor sprites (`decor/ring/<landmark>/…`) placed by the scenery table
 * (`defineRingScenery`, content/ring/scenery) at fractions of their landmark, in a layer; plus the
 * median lamp posts and the oncoming cars (`decor/ring/road/…`), drawn as sprites (no chunk
 * memory). Pieces belong to the chunk that holds them and leave with it.
 *
 * ROAD MARKS: yellow temporary lines (road works, lane closures): from the plan's chunks with
 * `closed` lanes, and from any caller through `markRoad(host, mark)` (ROAD's closures).
 */
import { PAL } from '../../engine/palette';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../engine/render';
import {
  artPreloadActive,
  artTier,
  cancelArtJobs,
  HI_ART_FRAME_BUDGET_MS,
  hiArtDeferred,
  hiArtOn,
  queueArtJob,
  runArtJobs,
  withArtDensity,
  type ArtDensity,
} from '../../engine/sprites';
import { getBgGenerator, hasBgGenerator, makeHiBgLayer, type SceneryDensity } from '../art/art-registry';
import type { RingLandmarkId } from './ids';
import { LANE_SPLIT, ROAD_BOTTOM, ROAD_TOP } from './lanes';
import { RingLight } from './light';
import { formatKm, ringKmAt } from './landmarks';
import { chunkAt } from './plan';
import { cancelRingScenery, requestRingScenery, trimmedFrame } from './scenery-job';
import type { RingPlan, RingViewHost } from './types';

// =============================================================================================
// The scenery table (filled by content/ring/scenery; the view draws plain road without it)
// =============================================================================================

/** The look of a stretch per layer: the `kind` param of each layer's generator. */
export interface RingLook {
  readonly far: string;
  readonly city: string;
  readonly verge: string;
  /** 'road' (the oncoming carriageway) or 'rail' (the railway between the carriageways). */
  readonly farroad: string;
  /** The sky's tint key (one summer day; 'day'). */
  readonly sky?: string;
}

/** Layer keys (far → near). */
export type RingLayerKey = 'far' | 'city' | 'verge' | 'farroad' | 'tunnel' | 'road' | 'front';

/**
 * What a piece or feature is placed along: its landmark (default), its whole stretch, or the
 * plan chunk of a set-piece part ('part:rozenoordbrug', 'part:offramp', … the plan's `part`).
 */
export type RingAnchor = 'landmark' | 'stretch' | `part:${string}`;

/** A set piece: a sprite at a fraction of its anchor, in a layer. */
export interface RingPieceDef {
  readonly id: string;
  readonly layer: RingLayerKey;
  /** Placed along (default: the landmark). */
  readonly of?: RingAnchor;
  /** Where along the anchor (0 = its start … 1 = its end); may be < 0 or > 1. */
  readonly at: number;
  /** Plan px added to `at` (fixed offsets such as "just after the tunnel"). */
  readonly dx?: number;
  /** Screen y of the sprite's anchor. */
  readonly y: number;
  readonly frame?: number;
  /** Animated: ticks per frame (the sprite's whole strip loops). */
  readonly tpf?: number;
  /** Own motion in layer px per tick (a train). */
  readonly vx?: number;
  readonly flipX?: boolean;
}

/** A road feature along a landmark (plan px from its start; `len` < 0 = to the landmark's end). */
export interface RingFeatureDef {
  readonly kind: 'bridge' | 'covered' | 'exit' | 'cut';
  /** Placed along (default: the landmark). */
  readonly of?: RingAnchor;
  /** Start: a fraction of the anchor's length plus `dx` plan px. */
  readonly at: number;
  readonly dx?: number;
  readonly len: number;
  /** Name on a bridge / tunnel plate. */
  readonly name?: string;
}

/** An exit of the ring (signs): the S-number and the place. */
export interface RingExitDef {
  readonly code: string;
  readonly name: string;
}

export interface RingLandmarkScenery {
  /** The look of the landmark and of the generated road after it (its stretch). */
  readonly look: RingLook;
  /** The look of the generated road after the landmark, when it differs. */
  readonly after?: RingLook;
  readonly pieces?: readonly RingPieceDef[];
  readonly features?: readonly RingFeatureDef[];
  /** Exits signed along the stretch (when the plan's landmark has none). */
  readonly exits?: readonly RingExitDef[];
  /** Name on the tunnel portal. */
  readonly tunnelName?: string;
}

export interface RingSceneryDef {
  readonly landmarks: Readonly<Partial<Record<RingLandmarkId, RingLandmarkScenery>>>;
  /** Looks by the plan chunks' skyline `district` (GEN: 'oost', 'zuidas', 'lake', 'port' …). */
  readonly districts?: Readonly<Record<string, RingLook>>;
  /** Overrides by the plan chunks' set-piece `part` ('rozenoordbrug', 'zuidas' …). */
  readonly parts?: Readonly<Record<string, Partial<RingLook>>>;
  /** Place names of S-exits ('S113' → 'WATERGRAAFSMEER') when the plan has no exit signs. */
  readonly exitNames?: Readonly<Record<string, string>>;
  /** Bridge names on their name plates, by the plan chunk part ('rozenoordbrug' → 'ROZENOORDBRUG'). */
  readonly bridgeNames?: Readonly<Record<string, string>>;
  /** Sprite of the median lamp posts and their spacing (plan px). */
  readonly lamp?: { readonly id: string; readonly every: number; readonly y: number };
  /** Oncoming car sprites (they face right; drawn mirrored). */
  readonly oncoming?: readonly string[];
  /** Tunnel portal sprites per landmark (frame 0 = entry with the name, 1 = exit). */
  readonly portals?: Readonly<Partial<Record<RingLandmarkId, string>>>;
  /** Sprite of the building over the road at a covered stretch (drawn at its start, top y 0). */
  readonly overbuild?: string;
}

let scenery: RingSceneryDef | null = null;

/** Register the scenery table (content/ring/scenery does this at import). */
export function defineRingScenery(def: RingSceneryDef): void {
  scenery = def;
}

const PLAIN: RingLook = { far: 'city', city: 'flats', verge: 'trees', farroad: 'road' };

// =============================================================================================
// Road marks (yellow temporary lines)
// =============================================================================================

/** A yellow temporary marking: the lane `lane` (1 far … 4 near) closed between world x0 and x1. */
export interface RingRoadMark {
  readonly x0: number;
  readonly x1: number;
  readonly lane: number;
}

const marksOf = new WeakMap<object, RingRoadMark[]>();

/**
 * Paint yellow temporary lines along `mark.lane` between world x0 and x1 (a taper across the lane
 * at x0). `host` is the running ring (`ringOf(world)`); marks behind the view are dropped.
 */
export function markRoad(host: object, mark: RingRoadMark): void {
  let list = marksOf.get(host);
  if (!list) marksOf.set(host, (list = []));
  list.push(mark);
}

/** The explicit road marks of a host (tests, tools). */
export function roadMarks(host: object): readonly RingRoadMark[] {
  return marksOf.get(host) ?? [];
}

// =============================================================================================
// Layers and chunks
// =============================================================================================

/** Chunk width in layer px. */
export const CHUNK_W = 256;
/** Screen middle (the plan distance a parallax point shows is taken there). */
const MID = 192;
/** The sky tile. */
const SKY_W = 512;
const SKY_H = 104;
const SKY_F = 0.04;
/**
 * The scenery's 4× working memory (dense chunk buffers and the sky), outside the sprites' tier-4
 * budget: the ring's dense budget test subtracts it (spec §13 "Tier 4", §15).
 */
export const RING_SCENERY_RESERVE = 32 * 1024 * 1024;

interface LayerSpec {
  readonly key: RingLayerKey;
  readonly gen: string;
  readonly f: number;
  /** Screen y of the buffer top and its height (logical px). */
  readonly y: number;
  readonly h: number;
  readonly front?: boolean;
}

/** The streamed layers, far → near (spec §2 screen layout). */
export const RING_LAYERS: readonly LayerSpec[] = [
  { key: 'far', gen: 'ring-far', f: 0.2, y: 20, h: 80 },
  { key: 'city', gen: 'ring-city', f: 0.35, y: 8, h: 92 },
  { key: 'verge', gen: 'ring-verge', f: 0.75, y: 36, h: 64 },
  { key: 'farroad', gen: 'ring-farroad', f: 0.9, y: 64, h: 44 },
  { key: 'tunnel', gen: 'ring-tunnel', f: 1, y: 0, h: 113 },
  { key: 'road', gen: 'ring-road', f: 1, y: 85, h: 123 },
  { key: 'front', gen: 'ring-front', f: 1.25, y: 194, h: 22, front: true },
];

/** A sprite placed in a layer (layer x; screen y). */
interface Placed {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly frame: number;
  readonly tpf: number;
  readonly vx: number;
  readonly t0: number;
  readonly flipX: boolean;
}

interface Chunk {
  readonly i: number;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seed: number;
  /** 1× buffer (null = empty: nothing drawn). */
  buf: PixelBuffer | null;
  built: boolean;
  /** Dense frames by density: undefined = not built (yet), null = none. */
  hi: Record<SceneryDensity, Frame | null | undefined>;
  readonly pieces: Placed[];
}

/** A plan range of a feature, resolved. */
interface Span {
  readonly kind: 'tunnel' | 'bridge' | 'covered' | 'exit' | 'cut';
  readonly p0: number;
  readonly p1: number;
  readonly landmark: RingLandmarkId;
  readonly name: string;
}

/** A tunnel portal (or covered stretch end) on the road, in WORLD x (fixed when its chunk was made). */
export interface RingPortal {
  readonly x: number;
  readonly side: 'in' | 'out';
  readonly kind: 'tunnel' | 'covered';
}

let viewSerial = 0;
const screenOpts: DrawOpts = { screen: true };
const hiScreen: Record<SceneryDensity, DrawOpts> = { 2: { screen: true }, 4: { screen: true } };
const pieceOpts: DrawOpts = { screen: true };
const flipOpts: DrawOpts = { screen: true, flipX: true };
const markOpts: DrawOpts = { screen: true };
const YELLOW = PAL.gold[2];

/** A dense buffer as a frame without its transparent margins (whole logical px). */
const trimmed = trimmedFrame;

function frameBytes(f: Frame | null | undefined): number {
  return f ? f.buf.w * f.buf.h * 4 : 0;
}

export class RingView {
  readonly plan: RingPlan;
  readonly seed: number;
  readonly density: ArtDensity;
  readonly light: RingLight;
  /** Layer chunks by layer index and chunk index. */
  private readonly chunks: Map<number, Chunk>[];
  /** Moving pieces (a train) by layer: they outlive their chunk until they leave the screen. */
  private readonly movers: Placed[][];
  /** Resolved features (plan ranges). */
  readonly spans: readonly Span[];
  /** Portals seen so far (world x), for the light pass. */
  readonly portals: RingPortal[] = [];
  private readonly jobKey: string;
  private sky1: PixelBuffer | null = null;
  private skyHi: Record<SceneryDensity, PixelBuffer | null | undefined> = { 2: undefined, 4: undefined };
  /** Debug / tests: chunks made, dense buffers made, chunks evicted, peak dense bytes. */
  made = 0;
  hiMade = 0;
  evicted = 0;
  peakBytes = 0;
  /** The plan's closed-lane chunks paint yellow lines (ROAD may switch it off). */
  planMarks = true;
  /** The ambience the scenery asks for now (tunnel echo, bridge rumble) or null. */
  ambience: string | null = null;
  private lastHost: RingViewHost | null = null;

  constructor(plan: RingPlan, seed: number, density: ArtDensity) {
    this.plan = plan;
    this.seed = seed >>> 0;
    this.density = density;
    this.light = new RingLight(this);
    this.chunks = RING_LAYERS.map(() => new Map<number, Chunk>());
    this.movers = RING_LAYERS.map(() => []);
    this.jobKey = `ring-scenery/${++viewSerial}/`;
    this.spans = resolveSpans(plan);
  }

  /** Clear colour of the frame (the sky's horizon tone). */
  get sky(): number {
    return PAL.sky[3];
  }

  // ------------------------------------------------------------------------------- update

  update(host: RingViewHost): void {
    this.lastHost = host;
    const p = host.planDist + MID;
    let amb: string | null = null;
    for (const s of this.spans) {
      if (p < s.p0 || p >= s.p1) continue;
      if (s.kind === 'tunnel' || s.kind === 'covered') amb = 'ring/tunnel-bed';
      else if (s.kind === 'bridge' && amb === null) amb = 'ring/bridge-rumble';
    }
    if (amb !== this.ambience) {
      this.ambience = amb;
      (host as Partial<AmbienceHost>).setAmbience?.(amb);
    }
  }

  // ------------------------------------------------------------------------------- mapping

  /** The camera offset o = camX − planDist (world x of a plan point = plan + o). */
  private offset(host: RingViewHost): number {
    return host.camX - host.planDist;
  }

  /** The plan distance a layer point (factor f) shows when it passes the screen middle. */
  planOf(L: number, f: number, o: number): number {
    return (L - MID) / f - o + MID;
  }

  /** The layer x (factor f) of a plan distance (inverse of `planOf`). */
  layerOf(P: number, f: number, o: number): number {
    return MID + f * (P + o - MID);
  }

  // ------------------------------------------------------------------------------- density

  /** The density the view draws at now: min(`density`, `artTier()`) (dense art on), else 1. */
  drawDensity(): 1 | 2 | 4 {
    if (this.density <= 1 || !hiArtOn()) return 1;
    const t = artTier();
    return (t < this.density ? t : this.density) as 1 | 2 | 4;
  }

  private static atRes(want: number, k: number): 1 | 2 | 4 {
    if (want >= 4 && k >= 4 && k % 4 === 0) return 4;
    return want >= 2 && k >= 2 ? 2 : 1;
  }

  // ------------------------------------------------------------------------------- drawing

  drawBack(r: Renderer, host: RingViewHost): void {
    this.lastHost = host;
    const d = RingView.atRes(this.drawDensity(), r.res);
    this.drawSky(r, d);
    const o = this.offset(host);
    for (let li = 0; li < RING_LAYERS.length; li++) {
      const L = RING_LAYERS[li];
      if (L.front) continue;
      this.drawLayer(r, host, li, o, d);
      if (L.key === 'farroad') this.drawOncoming(r, host, o);
      if (L.key === 'road') this.drawMarks(r, host, o);
    }
    if (this.density > 1 && hiArtDeferred() && !artPreloadActive()) runArtJobs(HI_ART_FRAME_BUDGET_MS);
    this.trackBytes();
  }

  drawFront(r: Renderer, host: RingViewHost): void {
    const d = RingView.atRes(this.drawDensity(), r.res);
    const o = this.offset(host);
    for (let li = 0; li < RING_LAYERS.length; li++) if (RING_LAYERS[li].front) this.drawLayer(r, host, li, o, d);
  }

  drawLight(r: Renderer, host: RingViewHost): void {
    this.light.draw(r, host);
  }

  private drawSky(r: Renderer, d: 1 | 2 | 4): void {
    if (!this.sky1) {
      this.sky1 = hasBgGenerator('ring-sky')
        ? withArtDensity(1, () => getBgGenerator('ring-sky')(SKY_W, SKY_H, { kind: 'day' }, this.seed))
        : new PixelBuffer(SKY_W, SKY_H).fill(PAL.sky[2]);
    }
    let buf: PixelBuffer = this.sky1;
    let dd = 1;
    if (d > 1) {
      const hd = d as SceneryDensity;
      let hi = this.skyHi[hd];
      if (hi === undefined) {
        const build = (): void => {
          if (this.skyHi[hd] !== undefined) return;
          this.skyHi[hd] = withArtDensity(1, () => makeHiBgLayer('ring-sky', SKY_W, SKY_H, { kind: 'day' }, this.seed, hd));
          this.hiMade++;
        };
        const key = `${this.jobKey}sky:${hd}`;
        const install = (f: Frame | null): void => {
          if (this.skyHi[hd] !== undefined) return;
          this.skyHi[hd] = f ? f.buf : null;
          this.hiMade++;
        };
        // The browser: built in the scenery worker (scenery-job.ts), else a main-thread job.
        if (hiArtDeferred()) {
          if (!requestRingScenery(key, { gen: 'ring-sky', w: SKY_W, h: SKY_H, params: { kind: 'day' }, seed: this.seed, d: hd, trim: false }, install, () => queueArtJob(key, build))) queueArtJob(key, build);
        } else build();
        hi = this.skyHi[hd];
      }
      if (!hi && hd === 4) hi = this.skyHi[2];
      if (hi) {
        buf = hi;
        dd = hi.w / SKY_W;
      }
    }
    r.parallax(buf, SKY_F, 0, 0, 0, dd > 1 ? { repeatX: true, density: dd } : { repeatX: true });
  }

  private drawLayer(r: Renderer, host: RingViewHost, li: number, o: number, d: 1 | 2 | 4): void {
    const L = RING_LAYERS[li];
    const map = this.chunks[li];
    const lx = r.camX * L.f;
    const i0 = Math.floor(lx / CHUNK_W);
    const i1 = Math.floor((lx + r.w) / CHUNK_W);
    this.evict(li, i0, i1);
    for (let i = i0; i <= i1 + 1; i++) {
      const c = this.chunk(li, i, host, o);
      if (i > i1) {
        // The next chunk ahead: made now, its dense buffer queued (never drawn yet).
        if (d > 1 && c.buf) this.hiChunk(li, c, d as SceneryDensity);
        continue;
      }
      if (!c.buf) continue;
      const sx = i * CHUNK_W - lx;
      let f: Frame | null = null;
      if (d > 1) {
        f = this.hiChunk(li, c, d as SceneryDensity);
        if (!f && d === 4) f = c.hi[2] ?? null;
      }
      if (f) r.frame(f, sx, L.y, hiScreen[(f.density ?? 2) as SceneryDensity]);
      else r.image(c.buf, sx, L.y, screenOpts);
    }
    // Pieces of every chunk on screen (they may reach into the neighbours).
    const ticks = host.ticks;
    for (let i = i0 - 1; i <= i1 + 1; i++) {
      const c = map.get(i);
      if (!c) continue;
      for (const p of c.pieces) this.drawPiece(r, p, lx, ticks);
    }
    // Moving pieces until they have left the screen behind (or run far ahead).
    const mv = this.movers[li];
    if (mv.length) {
      let n = 0;
      for (const p of mv) {
        const x = p.x + p.vx * (ticks - p.t0) - lx;
        if (x < -400 || x > r.w + 4000) continue;
        mv[n++] = p;
        this.drawPiece(r, p, lx, ticks);
      }
      mv.length = n;
    }
  }

  private drawPiece(r: Renderer, p: Placed, lx: number, ticks: number): void {
    const x = p.x + p.vx * (ticks - p.t0) - lx;
    if (x < -320 || x > r.w + 320) return;
    const fr = p.tpf > 0 ? p.frame + Math.floor(ticks / p.tpf) : p.frame;
    r.sprite(p.id, fr, x, p.y, p.flipX ? flipOpts : pieceOpts);
  }

  /** Make (or get) chunk i of layer li. */
  private chunk(li: number, i: number, host: RingViewHost, o: number): Chunk {
    const map = this.chunks[li];
    const have = map.get(i);
    if (have) return have;
    const L = RING_LAYERS[li];
    const x0 = i * CHUNK_W;
    const p0 = this.planOf(x0, L.f, o);
    const p1 = this.planOf(x0 + CHUNK_W, L.f, o);
    const { params, pieces } = this.describe(li, i, p0, p1, o, host);
    const c: Chunk = { i, params, seed: mixSeed(this.seed, li + 1, i), buf: null, built: false, hi: { 2: undefined, 4: undefined }, pieces };
    map.set(i, c);
    this.made++;
    if (params.kind !== 'none' && hasBgGenerator(L.gen)) {
      try {
        const buf = withArtDensity(1, () => getBgGenerator(L.gen)(CHUNK_W, L.h, params, c.seed));
        c.buf = buf.countOpaque() > 0 ? buf : null;
      } catch (err) {
        console.warn(`[ring] scenery generator "${L.gen}" failed:`, err);
        c.buf = null;
      }
    } else if (L.key === 'road' && !hasBgGenerator(L.gen)) {
      c.buf = plainRoad(CHUNK_W, L.h, x0);
    }
    c.built = true;
    return c;
  }

  /**
   * Evict behind the view (the ring scrolls forward only): chunks left of the one just behind go
   * away; the one just behind keeps its record (its pieces may still reach onto the screen) but
   * drops its buffers and its queued jobs.
   */
  private evict(li: number, i0: number, i1 = Infinity): void {
    const map = this.chunks[li];
    for (const [i, c] of map) {
      // Far ahead (a jump back by a tool or a test): gone.
      if (i > i1 + 2) {
        map.delete(i);
        cancelArtJobs(`${this.jobKey}${li}:${i}:`);
        cancelRingScenery(`${this.jobKey}${li}:${i}:`);
        continue;
      }
      if (i >= i0) continue;
      if (c.buf || c.hi[2] || c.hi[4]) this.evicted++;
      c.buf = null;
      c.hi[2] = null;
      c.hi[4] = null;
      cancelArtJobs(`${this.jobKey}${li}:${i}:`);
      cancelRingScenery(`${this.jobKey}${li}:${i}:`);
      if (i < i0 - 1) map.delete(i);
    }
  }

  /** The dense frame of a chunk at d once built, else null (queued or built now). */
  private hiChunk(li: number, c: Chunk, d: SceneryDensity): Frame | null {
    const have = c.hi[d];
    if (have !== undefined) return have;
    const L = RING_LAYERS[li];
    const build = (): void => {
      if (c.hi[d] !== undefined) return;
      const buf = withArtDensity(1, () => makeHiBgLayer(L.gen, CHUNK_W, L.h, c.params, c.seed, d));
      c.hi[d] = buf ? trimmed(buf, d) : null;
      this.hiMade++;
    };
    const key = `${this.jobKey}${li}:${c.i}:${d}`;
    // The browser: built in the scenery worker, never inside a frame (review fix 2026-10-21: a 4×
    // road chunk took 5–14 ms); it arrives a few frames later (the chunk ahead is asked for one
    // chunk early). An evicted chunk (hi set to null) or a dropped one ignores the reply.
    const install = (f: Frame | null): void => {
      if (c.hi[d] !== undefined || this.chunks[li].get(c.i) !== c) return;
      c.hi[d] = f;
      this.hiMade++;
    };
    if (hiArtDeferred()) {
      if (!requestRingScenery(key, { gen: L.gen, w: CHUNK_W, h: L.h, params: c.params, seed: c.seed, d, trim: true }, install, () => queueArtJob(key, build))) queueArtJob(key, build);
    } else build();
    return c.hi[d] ?? null;
  }

  // ------------------------------------------------------------------------------- chunk content

  /** The stretch (landmark id) holding plan distance p. */
  stretchAt(p: number): RingLandmarkId {
    const st = this.plan.stretches;
    for (let k = st.length - 1; k >= 0; k--) if (p >= st[k].start) return st[k].id;
    return st[0]?.id ?? 'oost';
  }

  /**
   * The look at plan distance p: the plan chunk's skyline `district` (and its set-piece `part`
   * override) when the table has it, else the landmark's own look, or its `after` look past it.
   */
  lookAt(p: number): RingLook {
    const c = chunkAt(this.plan, p);
    if (c) {
      const have = this.lookCache.get(c);
      if (have) return have;
      const look = this.lookOf(c, p);
      this.lookCache.set(c, look);
      return look;
    }
    return this.lookOf(null, p);
  }

  private readonly lookCache = new Map<object, RingLook>();

  private lookOf(c: ReturnType<typeof chunkAt>, p: number): RingLook {
    let look: RingLook | undefined = c?.district ? scenery?.districts?.[c.district] : undefined;
    if (!look) {
      const id = this.stretchAt(p);
      const sc = scenery?.landmarks[id];
      if (!sc) look = PLAIN;
      else {
        const lm = this.plan.landmarks.find((l) => l.id === id);
        look = sc.after && lm && p >= lm.start + lm.length ? sc.after : sc.look;
      }
    }
    const part = c?.part ? scenery?.parts?.[c.part] : undefined;
    return part ? { ...look, ...part } : look;
  }

  /**
   * The look of a chunk covering the plan range [p0, p1): the look at its middle, with the part
   * override of any set-piece chunk that fills a good share of it (a parallax chunk spans more
   * plan than a bridge: the river must still show while the bridge passes).
   */
  lookFor(p0: number, p1: number): RingLook {
    const mid = (p0 + p1) / 2;
    const base = this.lookAt(mid);
    const parts = scenery?.parts;
    if (!parts) return base;
    let best: Partial<RingLook> | undefined;
    let bestShare = 0;
    for (const c of this.plan.chunks) {
      if (!c.part || c.start >= p1 || c.start + c.length <= p0) continue;
      const o = parts[c.part];
      if (!o) continue;
      const ov = Math.min(p1, c.start + c.length) - Math.max(p0, c.start);
      const share = Math.max(ov / (p1 - p0), ov / c.length);
      if (share > 0.4 && share > bestShare) {
        best = o;
        bestShare = share;
      }
    }
    return best ? { ...base, ...best } : base;
  }

  /** Spans overlapping the plan range [p0, p1). */
  private spansIn(p0: number, p1: number): Span[] {
    const out: Span[] = [];
    for (const s of this.spans) if (s.p1 > p0 && s.p0 < p1) out.push(s);
    return out;
  }

  /** Params and pieces of chunk i of layer li (plan range [p0, p1)). */
  private describe(li: number, i: number, p0: number, p1: number, o: number, host: RingViewHost): { params: Record<string, unknown>; pieces: Placed[] } {
    const L = RING_LAYERS[li];
    const x0 = i * CHUNK_W;
    const look = this.lookFor(p0, p1);
    const local = (P: number): number => Math.round(this.layerOf(P, L.f, o) - x0);
    const spans = this.spansIn(p0, p1);
    const params: Record<string, unknown> = { x0, rs: this.seed };
    const pieces: Placed[] = [];
    // Inside a tunnel (or under a covered stretch) the back layers are hidden: no art there.
    const hidden = (a: number, b: number): boolean => this.spans.some((s) => (s.kind === 'tunnel' || s.kind === 'covered') && a >= s.p0 + 48 && b <= s.p1 - 48);
    switch (L.key) {
      case 'far':
      case 'city':
      case 'verge': {
        params.kind = hidden(p0, p1) ? 'none' : look[L.key];
        if (L.key === 'verge') {
          const water = spans.filter((s) => s.kind === 'bridge').map((s) => [local(s.p0), local(s.p1)]);
          if (water.length) params.water = water.flat();
          const cut = spans.filter((s) => s.kind === 'cut').map((s) => [local(s.p0), local(s.p1)]);
          if (cut.length) params.cut = cut.flat();
          // Signs reaching over a chunk edge are drawn by both chunks.
          const reach = 56 / L.f;
          const signs = this.signsIn(p0 - reach, p1 + reach).map((s) => ({ x: local(s.at), code: s.code, name: s.name, kind: s.kind }));
          if (signs.length) params.signs = signs;
        }
        break;
      }
      case 'farroad': {
        params.kind = hidden(p0, p1) ? 'none' : look.farroad;
        const water = spans.filter((s) => s.kind === 'bridge').map((s) => [local(s.p0), local(s.p1)]);
        if (water.length) params.water = water.flat();
        break;
      }
      case 'tunnel': {
        const covers = spans.filter((s) => s.kind === 'tunnel' || s.kind === 'covered');
        if (!covers.length) {
          params.kind = 'none';
          break;
        }
        params.kind = 'tunnel';
        params.spans = covers.flatMap((s) => [local(s.p0), local(s.p1), s.kind === 'covered' ? 1 : 0]);
        for (const s of covers) {
          for (const [P, side] of [
            [s.p0, 'in'],
            [s.p1, 'out'],
          ] as const) {
            const lx = local(P);
            if (lx < 0 || lx >= CHUNK_W) continue;
            this.portals.push({ x: x0 + lx, side, kind: s.kind === 'covered' ? 'covered' : 'tunnel' });
            const portal = s.kind === 'tunnel' ? scenery?.portals?.[s.landmark] : undefined;
            if (portal) pieces.push(placed(portal, x0 + lx, 113, side === 'in' ? 0 : 1, host.ticks));
            if (s.kind === 'covered' && side === 'in' && scenery?.overbuild) pieces.push(placed(scenery.overbuild, x0 + lx, 0, 0, host.ticks));
          }
        }
        break;
      }
      case 'road': {
        params.kind = 'open';
        const tun = spans.filter((s) => s.kind === 'tunnel' || s.kind === 'covered');
        if (tun.length) params.tunnel = tun.flatMap((s) => [local(s.p0), local(s.p1), s.kind === 'covered' ? 1 : 0]);
        const br = spans.filter((s) => s.kind === 'bridge');
        if (br.length) params.bridge = br.flatMap((s) => [local(s.p0), local(s.p1)]);
        const ex = spans.filter((s) => s.kind === 'exit');
        if (ex.length) params.exit = ex.flatMap((s) => [local(s.p0), local(s.p1)]);
        // Hectometre boards on the median (km rising in our direction, 0,0 at Coenplein).
        // A board where the km on the posts (GEN's `ringKmAt`) passes a tenth, on a global 4 px
        // grid; a board near a chunk edge is drawn by both chunks (each paints its part).
        const hm: Array<{ x: number; t: string }> = [];
        let prev = Math.round(ringKmAt(this.plan, Math.floor((p0 - 18) / 4) * 4 - 4) * 10);
        for (let P = Math.floor((p0 - 18) / 4) * 4; P < p1 + 18; P += 4) {
          const k = Math.round(ringKmAt(this.plan, P) * 10);
          if (k === prev) continue;
          prev = k;
          if (this.inCover(P, 24)) continue;
          hm.push({ x: local(P), t: formatKm(k / 10) });
        }
        if (hm.length) params.hm = hm;
        // Median lamp posts (sprites), not in tunnels or covered stretches.
        const lamp = scenery?.lamp;
        if (lamp) {
          const a = Math.ceil(p0 / lamp.every);
          const b = Math.floor((p1 - 1) / lamp.every);
          for (let k = a; k <= b; k++) {
            const P = k * lamp.every + 40;
            if (this.inCover(P, 40)) continue;
            pieces.push(placed(lamp.id, x0 + local(P), lamp.y, 0, host.ticks));
          }
        }
        break;
      }
      case 'front': {
        params.kind = 'rail';
        // Only a tube has the near wall; under a covered stretch the guard rail runs on.
        const tun = spans.filter((s) => s.kind === 'tunnel');
        if (tun.length) params.tunnel = tun.flatMap((s) => [local(s.p0), local(s.p1)]);
        const br = spans.filter((s) => s.kind === 'bridge');
        if (br.length) params.bridge = br.flatMap((s) => [local(s.p0), local(s.p1)]);
        const ex = spans.filter((s) => s.kind === 'exit');
        if (ex.length) params.exit = ex.flatMap((s) => [local(s.p0), local(s.p1)]);
        break;
      }
    }
    // Landmark set pieces of this layer whose place falls in the chunk.
    for (const pc of this.pieceSpots) {
      if (pc.def.layer !== L.key || pc.at < p0 || pc.at >= p1) continue;
      const pd = pc.def;
      const pl: Placed = { id: pd.id, x: x0 + local(pc.at), y: pd.y, frame: pd.frame ?? 0, tpf: pd.tpf ?? 0, vx: pd.vx ?? 0, t0: host.ticks, flipX: pd.flipX ?? false };
      if (pl.vx !== 0) this.movers[li].push(pl);
      else pieces.push(pl);
    }
    return { params, pieces };
  }

  /** Every set piece of the table at its plan distance (resolved once). */
  private get pieceSpots(): ReadonlyArray<{ def: RingPieceDef; at: number }> {
    if (this.spotsCache) return this.spotsCache;
    const out: Array<{ def: RingPieceDef; at: number }> = [];
    for (const lm of this.plan.landmarks) {
      for (const def of scenery?.landmarks[lm.id]?.pieces ?? []) {
        for (const r of anchorRanges(this.plan, lm.id, def.of)) out.push({ def, at: r[0] + def.at * (r[1] - r[0]) + (def.dx ?? 0) });
      }
    }
    this.spotsCache = out;
    return out;
  }

  private spotsCache: Array<{ def: RingPieceDef; at: number }> | null = null;

  /** Is plan distance P inside a tunnel or a covered stretch (grown by `m`)? */
  private inCover(P: number, m = 0): boolean {
    for (const s of this.spans) if ((s.kind === 'tunnel' || s.kind === 'covered') && P >= s.p0 - m && P < s.p1 + m) return true;
    return false;
  }

  /** Direction and exit signs in the plan range [p0, p1) (verge layer). */
  private signsIn(p0: number, p1: number): Array<{ at: number; code: string; name: string; kind: 'exit' | 'ring' | 'name' }> {
    const out: Array<{ at: number; code: string; name: string; kind: 'exit' | 'ring' | 'name' }> = [];
    for (const s of this.signs) if (s.at >= p0 && s.at < p1) out.push(s);
    return out;
  }

  private signsCache: Array<{ at: number; code: string; name: string; kind: 'exit' | 'ring' | 'name' }> | null = null;

  /**
   * Every sign of the ring: the plan's exit-sign spots (an exit sign with the S-shield and the
   * place, or a RING A10 sign with the shield when the exit has no name), a RING A10 sign before
   * each named exit, and a name plate at the start of every named bridge.
   */
  get signs(): Array<{ at: number; code: string; name: string; kind: 'exit' | 'ring' | 'name' }> {
    if (this.signsCache) return this.signsCache;
    const out: Array<{ at: number; code: string; name: string; kind: 'exit' | 'ring' | 'name' }> = [];
    const bridges = scenery?.bridgeNames ?? {};
    for (const c of this.plan.chunks) {
      const name = c.type === 'bridge' && c.part ? bridges[c.part] : undefined;
      if (name) out.push({ at: c.start + 72, code: '', name, kind: 'name' });
    }
    const plan = this.plan.exitSigns;
    if (plan && plan.length) {
      for (const e of plan) {
        if (this.inCover(e.at, 160)) continue;
        out.push({ at: e.at, code: e.exit, name: e.name, kind: e.name ? 'exit' : 'ring' });
        const ring = e.at - 420;
        if (e.name && !this.inCover(ring, 160) && !plan.some((o) => o !== e && Math.abs(o.at - ring) < 200)) out.push({ at: ring, code: e.exit, name: 'RING A10', kind: 'ring' });
      }
      out.sort((a, b) => a.at - b.at);
      this.signsCache = out;
      return out;
    }
    const names = scenery?.exitNames ?? {};
    for (const st of this.plan.stretches) {
      const lm = this.plan.landmarks.find((l) => l.id === st.id);
      if (!lm) continue;
      const sc = scenery?.landmarks[st.id];
      const codes: string[] = lm.exits && lm.exits.length ? [...lm.exits] : (sc?.exits ?? []).map((e) => e.code);
      const tunnel = !!lm.tunnel;
      const from = tunnel ? lm.start + lm.length + 256 : lm.start + 160;
      const len = Math.max(256, st.end - from - 320);
      if (codes.length === 0) continue;
      for (let k = 0; k < codes.length; k++) {
        const code = codes[k];
        const name = names[code] ?? sc?.exits?.find((e) => e.code === code)?.name ?? 'A10';
        const at = from + ((k + 0.5) / codes.length) * len;
        if (this.inCover(at, 200)) continue;
        out.push({ at, code, name, kind: 'exit' });
        if (k === 0) {
          const ring = at - Math.min(600, len / (codes.length * 2));
          if (ring > from - 100 && !this.inCover(ring, 200)) out.push({ at: ring, code, name: 'RING A10', kind: 'ring' });
        }
      }
    }
    out.sort((a, b) => a.at - b.at);
    this.signsCache = out;
    return out;
  }

  // ------------------------------------------------------------------------------- oncoming traffic

  /**
   * The oncoming carriageway (scenery): cars in two rows driving left, a function of the ticks and
   * the camera only (no state, deterministic). Hidden in tunnels and where the railway runs.
   */
  private drawOncoming(r: Renderer, host: RingViewHost, o: number): void {
    const ids = scenery?.oncoming;
    if (!ids || ids.length === 0) return;
    const f = 0.9;
    const lx = r.camX * f;
    const t = host.ticks;
    for (let row = 0; row < 2; row++) {
      const v = row === 0 ? 2.2 : 2.7;
      const gap = row === 0 ? 150 : 190;
      const y = row === 0 ? 102 : 106;
      // Car k sits at layer x k·gap − v·t (plus a jitter); find the k range on screen.
      const shift = v * t;
      const ka = Math.floor((lx + shift - 80) / gap);
      const kb = Math.ceil((lx + shift + r.w + 80) / gap);
      for (let k = ka; k <= kb; k++) {
        const hk = mixSeed(this.seed, row + 77, k);
        if ((hk & 7) < 2) continue;
        const jitter = ((hk >>> 8) % 61) - 30;
        const x = k * gap + jitter - shift - lx;
        if (x < -80 || x > r.w + 80) continue;
        // The look where it is (no cars on the railway at Zuid, none in tunnels).
        const P = this.planOf(x + lx, f, o);
        if (this.inCover(P, 24) || this.lookAt(P).farroad !== 'road') continue;
        r.sprite(ids[(hk >>> 4) % ids.length], 0, x, y, flipOpts);
      }
    }
  }

  // ------------------------------------------------------------------------------- road marks

  private drawMarks(r: Renderer, host: RingViewHost, o: number): void {
    const camX = r.camX;
    const right = camX + r.w;
    if (this.planMarks) {
      for (const c of this.plan.chunks) {
        if (!c.closed || c.closed.length === 0) continue;
        const x0 = c.start + o;
        const x1 = c.start + c.length + o;
        if (x1 < camX || x0 > right) continue;
        for (const lane of c.closed) this.drawMark(r, camX, x0, x1, lane);
      }
    }
    const list = marksOf.get(host);
    if (list) {
      let n = 0;
      for (const m of list) {
        if (m.x1 < camX - 64) continue;
        list[n++] = m;
        if (m.x0 > right) continue;
        this.drawMark(r, camX, m.x0, m.x1, m.lane);
      }
      list.length = n;
    }
  }

  /** Yellow lines along lane `lane` (1 … 4) between world x0 and x1, a taper across it at x0. */
  private drawMark(r: Renderer, camX: number, x0: number, x1: number, lane: number): void {
    const top = lane <= 1 ? ROAD_TOP + 1 : LANE_SPLIT[lane - 2];
    const bot = lane >= 4 ? ROAD_BOTTOM - 1 : LANE_SPLIT[lane - 1];
    const a = Math.max(x0, camX - 2) - camX;
    const b = Math.min(x1, camX + r.w + 2) - camX;
    if (b <= a) return;
    r.rect(a, top, b - a, 1, YELLOW, markOpts);
    r.rect(a, bot, b - a, 1, YELLOW, markOpts);
    // The taper: a yellow line across the lane over 64 px, then hatching every 24 px.
    const sx = x0 - camX;
    if (sx > -80 && sx < r.w + 80) r.line(sx, bot, sx + 64, top, YELLOW, markOpts);
    for (let x = Math.ceil((x0 + 72) / 24) * 24; x < x1; x += 24) {
      const hx = x - camX;
      if (hx < -24 || hx > r.w + 24) continue;
      r.line(hx, bot - 1, hx + 6, top + 1, YELLOW, markOpts);
    }
  }

  // ------------------------------------------------------------------------------- memory

  /** Bytes of the resident dense scenery buffers at density d (the chunks and the sky). */
  residentBytes(d: SceneryDensity = 4): number {
    let n = 0;
    for (const map of this.chunks) for (const c of map.values()) n += frameBytes(c.hi[d]);
    const s = this.skyHi[d];
    if (s) n += s.w * s.h * 4;
    return n;
  }

  /** Chunks resident per layer (tests). */
  chunkCount(key?: RingLayerKey): number {
    let n = 0;
    for (let li = 0; li < RING_LAYERS.length; li++) if (!key || RING_LAYERS[li].key === key) n += this.chunks[li].size;
    return n;
  }

  /** The chunk indices resident in a layer (tests). */
  chunkIndices(key: RingLayerKey): number[] {
    const li = RING_LAYERS.findIndex((l) => l.key === key);
    return li < 0 ? [] : [...this.chunks[li].keys()].sort((a, b) => a - b);
  }

  /** The 1× buffer and params of a resident chunk (tests, tools). */
  chunkInfo(key: RingLayerKey, i: number): { params: Readonly<Record<string, unknown>>; buf: PixelBuffer | null; pieces: readonly string[] } | null {
    const li = RING_LAYERS.findIndex((l) => l.key === key);
    const c = li < 0 ? undefined : this.chunks[li].get(i);
    return c ? { params: c.params, buf: c.buf, pieces: c.pieces.map((p) => p.id) } : null;
  }

  private trackBytes(): void {
    const n = this.residentBytes(4);
    if (n > this.peakBytes) this.peakBytes = n;
  }

  /**
   * Make every chunk the view needs now at density d without drawing (tests, tools): the same
   * chunks, evictions and dense buffers as a frame at that density would make.
   */
  prepare(host: RingViewHost, d: 1 | 2 | 4 = 1): void {
    const o = this.offset(host);
    const camX = host.camX;
    for (let li = 0; li < RING_LAYERS.length; li++) {
      const L = RING_LAYERS[li];
      const lx = camX * L.f;
      const i0 = Math.floor(lx / CHUNK_W);
      const i1 = Math.floor((lx + 384) / CHUNK_W);
      this.evict(li, i0, i1);
      for (let i = i0; i <= i1 + 1; i++) {
        const c = this.chunk(li, i, host, o);
        if (d > 1 && c.buf) this.hiChunk(li, c, d as SceneryDensity);
      }
    }
    if (d > 1) {
      const hd = d as SceneryDensity;
      if (this.skyHi[hd] === undefined) this.skyHi[hd] = makeHiBgLayer('ring-sky', SKY_W, SKY_H, { kind: 'day' }, this.seed, hd);
    }
    this.trackBytes();
  }

  /** Drop the queued art jobs of this view (the play ends). */
  dispose(): void {
    cancelArtJobs(this.jobKey);
    cancelRingScenery(this.jobKey);
    this.ambience = null;
    if (this.lastHost) (this.lastHost as Partial<AmbienceHost>).setAmbience?.(null);
  }
}

/** The runner's optional ambience hook (RingRunner.setAmbience). */
interface AmbienceHost {
  setAmbience(id: string | null, fadeTicks?: number): void;
}

function placed(id: string, x: number, y: number, frame: number, t0: number): Placed {
  return { id, x, y, frame, tpf: 0, vx: 0, t0, flipX: false };
}

/** A deterministic 32-bit mix of integers (chunk seeds: mix(seed, layer, i)). */
export function mixSeed(a: number, b: number, c = 0): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The plan ranges [start, end) an anchor names: the landmark, its stretch, or every chunk of a
 * set-piece part inside that stretch.
 */
function anchorRanges(plan: RingPlan, id: RingLandmarkId, of: RingAnchor | undefined): Array<[number, number]> {
  const lm = plan.landmarks.find((l) => l.id === id);
  const st = plan.stretches.find((s) => s.id === id);
  if (!of || of === 'landmark') return lm ? [[lm.start, lm.start + lm.length]] : [];
  if (of === 'stretch') return st ? [[st.start, st.end]] : [];
  const part = of.slice(5);
  const out: Array<[number, number]> = [];
  for (const c of plan.chunks) if (c.part === part && c.stretch === id) out.push([c.start, c.start + c.length]);
  return out;
}

/** Feature spans of a plan: tunnels from its landmarks, the rest from the scenery table. */
function resolveSpans(plan: RingPlan): Span[] {
  const out: Span[] = [];
  for (const lm of plan.landmarks) {
    const sc = scenery?.landmarks[lm.id];
    if (lm.tunnel) {
      out.push({ kind: 'tunnel', p0: lm.start, p1: lm.start + lm.length, landmark: lm.id, name: sc?.tunnelName ?? '' });
      out.push({ kind: 'cut', p0: lm.start - 360, p1: lm.start, landmark: lm.id, name: '' });
    }
    for (const f of sc?.features ?? []) {
      for (const r of anchorRanges(plan, lm.id, f.of)) {
        const p0 = r[0] + f.at * (r[1] - r[0]) + (f.dx ?? 0);
        const p1 = f.len < 0 ? r[1] : p0 + f.len;
        if (p1 > p0) out.push({ kind: f.kind, p0, p1, landmark: lm.id, name: f.name ?? '' });
      }
    }
  }
  // Bridge chunks of the plan (GEN may place `bridge` chunks at their landmarks).
  for (const c of plan.chunks) {
    if (c.type !== 'bridge') continue;
    if (out.some((s) => s.kind === 'bridge' && s.p0 < c.start + c.length && s.p1 > c.start)) continue;
    out.push({ kind: 'bridge', p0: c.start + 32, p1: c.start + c.length - 32, landmark: c.stretch, name: '' });
  }
  for (const c of plan.chunks) {
    if (c.type !== 'tunnel') continue;
    if (out.some((s) => s.kind === 'tunnel' && s.p0 <= c.start && s.p1 >= c.start + c.length)) continue;
    out.push({ kind: 'tunnel', p0: c.start, p1: c.start + c.length, landmark: c.stretch, name: '' });
  }
  out.sort((a, b) => a.p0 - b.p0);
  return out;
}

/** Without the scenery content: a plain grey road with lane dashes (never crashes). */
function plainRoad(w: number, h: number, x0: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const y = (sy: number): number => sy - 85;
  b.rect(0, y(104), w, 9, PAL.stone[1]);
  b.rect(0, y(ROAD_TOP), w, ROAD_BOTTOM - ROAD_TOP, PAL.steel[1]);
  b.rect(0, y(200), w, 8, PAL.stone[2]);
  b.rect(0, y(ROAD_TOP), w, 1, PAL.snow[2]);
  b.rect(0, y(ROAD_BOTTOM - 1), w, 1, PAL.snow[2]);
  for (const sy of LANE_SPLIT) for (let x = 0; x < w; x++) if ((((x + x0) % 96) + 96) % 96 < 32) b.set(x, y(sy), PAL.snow[2]);
  return b;
}
