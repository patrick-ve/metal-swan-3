/**
 * The stage of mission `ams2`: the contract between the hero kit (src/game/art/herokit) and the
 * section builders. The rules, the names and examples: docs/design/ams2-contract.md, and the top of
 * ./index.ts. In short:
 *
 * - Everything but the sky is a SPRITE drawn as DECOR, so it is generated in the art workers, cached
 *   and counted as all sprites are. Long things (a floor band, a house row, a water band) are cut in
 *   TILES of at most 256 px, frames of one sprite. The sky is one background layer.
 * - The plane of an item is its `parallax` (its speed). A band x p is drawn at screen x p − camX · s.
 *   World x maps to band x by the line-scroll rule, `bandX`, so all planes line up at screen centre.
 * - All the art of a sprite comes from one `paint` function at three art tiers (1, 2, 4).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { defineSprite, type Frame, hasSprite } from '../../../../engine/sprites';
import { defineBgGenerator, type BackgroundDef, type BgLayerDef } from '../../../art/art-registry';
import { kitTier, S, withKitTier } from '../../../art/herokit/canvas';
import { cobbles, drain, gravel, kerb, lane, leaves, manhole, pavers, PostOnWrongGround } from '../../../art/herokit/floors';
import { hashSeed, idsToBuffer, lightTable, renderBuffer, renderFrames, renderIds } from '../../../art/herokit/hi';
import { COL, hexrgb, type LightName, R } from '../../../art/herokit/palette';
import { skyBands } from '../../../art/herokit/sky';
import { waterBand } from '../../../art/herokit/water';
import type { DecorDef, SectionDef } from '../../../mission/index';
import { AMS2_SPRITE_PREFIX } from './ids';

/** The view. */
export const VW = 384;
export const VH = 216;
/** The floor bands: far [B0 − 3, B1), walk [B1, B2), near [B2, VH). Seams lie on kerbs or lane edges. */
export const B0 = 146;
export const B1 = 166;
export const B2 = 190;
/** The ground line of the figures and the surface of the canals (as `ams`). */
export const G = 176;
export const WATER_Y = 180;
/** The speeds of the planes. */
export const S_SKY = 0.03;
export const S_FAR = 0.18;
export const S_MID = 0.42;
export const S_BACK = 0.88;
export const S_WALK = 1;
export const S_NEAR = 1.16;
/** The rows of the post feet: the kerbstones of the far and of the near band. */
export const FAR_FOOT = B1 - 3;
export const NEAR_FOOT = B2 + 1;
/** The longest piece of a band: the view culls decor by its anchor with a 256 px margin. */
export const TILE_W = 256;
/** The width of a floor band's tile (a multiple of the lane's 32 px dashes). */
export const FLOOR_W = 768;

/** Line-scroll rule: the band x of world x on a plane of speed s (they line up at screen centre). */
export function bandX(wx: number, s: number): number {
  return Math.round(VW / 2 + (wx - VW / 2) * s);
}

/** The highest band x a section shows on a plane of speed s. */
export function bandEnd(sectionW: number, s: number): number {
  return Math.ceil((sectionW - VW) * s) + VW;
}

/** The sprite id of a kit drawing in a light. */
export function artId(light: LightName, name: string): string {
  return `${AMS2_SPRITE_PREFIX}${light}/${name}`;
}

export interface ArtOpts {
  /**
   * 'bl' (default): (x, y) is the left end of the line it stands on (its lowest row is y − 1). 'tl':
   * the top-left. 'bc': the middle of that line (the anchor a twin of a breakable needs: `overrideSprite`
   * twins must keep the anchor of the shared sprite).
   */
  anchor?: 'bl' | 'tl' | 'bc';
  /** Art of the finer tiers only (a bin, a rack): at art 1 the frames stay empty (spec §1.3 step 4). */
  fine?: boolean;
  /** Ticks per frame for `animate: true` (default 6). */
  ticksPerFrame?: number;
  /** Seed of the finer tiers' detail (default: the light's name). */
  part?: string;
  /** A still drawing that bobs: one frame per y offset, all on the same buffer (no extra memory). */
  bob?: readonly number[];
}

function seedOf(o: S, part: string): number {
  return hashSeed(part) + o.w * 7 + o.h;
}

/**
 * Define one drawing in one light: `paint` runs once per art tier (`kitTier()` tells which) and
 * returns a finished canvas, or one per animation frame. Frames keep their size at every tier.
 */
export function defineArt(light: LightName, name: string, paint: () => S | readonly S[], o: ArtOpts = {}): string {
  const id = artId(light, name);
  if (hasSprite(id)) return id;
  const anchor = o.anchor ?? 'bl';
  const part = o.part ?? light;
  const make = (u: 1 | 2 | 4): Frame[] =>
    withKitTier(u, () => {
      const r = paint();
      const list: readonly S[] = Array.isArray(r) ? (r as readonly S[]) : [r as S];
      for (const c of list) if (c.w > TILE_W) throw new Error(`${id}: ${c.w} px wide, the most is ${TILE_W}: use defineBand`);
      // Frames of one size are one drawing that changes a little; a list of other drawings stays as it is.
      const animated = list.length > 1 && list.every((c) => c.w === list[0].w && c.h === list[0].h);
      const steady = animated && !o.fine ? renderFrames(list, light, u, seedOf(list[0], part)) : null;
      const frames = list.map((c, k): Frame => {
        const buf = steady ? steady[k] : o.fine && u === 1 ? new PixelBuffer(c.w, c.h) : renderBuffer(c, light, u, seedOf(c, part));
        return { buf, ox: anchor === 'bc' ? c.w >> 1 : 0, oy: anchor === 'tl' ? 0 : c.h };
      });
      return o.bob ? o.bob.map((dy): Frame => ({ buf: frames[0].buf, ox: frames[0].ox, oy: frames[0].oy - dy })) : frames;
    });
  defineSprite(id, () => make(1), { hd: (d) => make(d), ticksPerFrame: o.ticksPerFrame });
  return id;
}

/** The four lights. */
export const LIGHT_NAMES: readonly LightName[] = ['morning', 'noon', 'golden', 'sunset'];

/** A long drawing cut in tiles: `frames` tiles per animation step, one sprite. */
export interface Band {
  readonly id: string;
  readonly speed: number;
  /** The top row. */
  readonly y: number;
  readonly width: number;
  readonly tiles: number;
  /** Animation frames (1 = still) and ticks per frame. */
  readonly anim: number;
  readonly tpf: number;
}

export interface BandOpts {
  light: LightName;
  name: string;
  speed: number;
  /** Rows [y0, y1) of the painted canvas that the band keeps. */
  rows: readonly [number, number];
  /** The canvas width. */
  width: number;
  /** Returns a canvas of `width` × at least y1 rows, or one per animation frame. */
  paint?: () => S | readonly S[];
  /**
   * A drawing with a slope: canvases of `width` × VH, drawn in this order. A layer with `shear` is drawn level
   * and each of its columns moves down by `shear(x)` rows after the finer-pixel step, so that a slope has one
   * regular step pattern at each tier. EPX would make the 1× stairs lumpy. No animation. `paint` is not used.
   */
  layers?: () => ReadonlyArray<{ readonly canvas: S; readonly shear?: (x: number) => number }>;
  /** The band starts at this column of the canvas (default 0). */
  fromX?: number;
  /** Animation frames that `paint` returns (default 1). */
  anim?: number;
  /** Ticks per animation frame (default 20). */
  tpf?: number;
  part?: string;
}

/** The layers of a drawing at tier u, one over the other, with their shear. */
function shearedLayers(layers: ReadonlyArray<{ readonly canvas: S; readonly shear?: (x: number) => number }>, light: LightName, u: 1 | 2 | 4, seed: number): PixelBuffer {
  const w = layers[0].canvas.w * u;
  const h = layers[0].canvas.h * u;
  const out = new Int16Array(w * h);
  layers.forEach(({ canvas, shear }, q) => {
    const r = renderIds(canvas, seed + q * 17, u);
    for (let x = 0; x < w; x++) {
      const dy = shear ? Math.round(shear(x / u) * u) : 0;
      for (let y = Math.max(0, -dy); y < h - Math.max(0, dy); y++) {
        const v = r.c[y * w + x];
        if (v > 0) out[(y + dy) * w + x] = v;
      }
    }
  });
  return idsToBuffer(out, w, h, lightTable(light, u));
}

/** Ticks per step of the water on a plane: slow, and not the same on any two planes. */
export const WATER_TPF: Readonly<Record<'mid' | 'far' | 'walk' | 'near' | 'surface', number>> = { mid: 53, far: 47, walk: 41, near: 37, surface: 43 };

/** Define a long drawing as tiles of one sprite. */
export function defineBand(o: BandOpts): Band {
  const id = artId(o.light, o.name);
  const tiles = Math.ceil(o.width / TILE_W);
  const part = o.part ?? o.light;
  const [y0, y1] = o.rows;
  const anim = o.anim ?? 1;
  if (!hasSprite(id)) {
    const make = (u: 1 | 2 | 4): Frame[] =>
      withKitTier(u, () => {
        if (o.layers) {
          const b = shearedLayers(o.layers(), o.light, u, hashSeed(part));
          const from = o.fromX ?? 0;
          const out: Frame[] = [];
          for (let k = 0; k < tiles; k++) {
            const w = Math.min(TILE_W, o.width - k * TILE_W);
            out.push({ buf: b.crop((from + k * TILE_W) * u, y0 * u, w * u, (y1 - y0) * u), ox: 0, oy: 0 });
          }
          return out;
        }
        if (!o.paint) throw new Error(`${id}: a band needs paint or layers`);
        const r = o.paint();
        const list: readonly S[] = Array.isArray(r) ? (r as readonly S[]) : [r as S];
        if (list.length !== anim) throw new Error(`${id}: ${list.length} canvases, expected ${anim}`);
        const out: Frame[] = [];
        const cut = list.map((canvas) => (canvas.h === y1 - y0 ? canvas : canvas.cropRows(y0, y1)));
        for (const b of renderFrames(cut, o.light, u, seedOf(cut[0], part))) {
          for (let k = 0; k < tiles; k++) {
            const x = k * TILE_W;
            const w = Math.min(TILE_W, o.width - x);
            out.push({ buf: b.crop(x * u, 0, w * u, (y1 - y0) * u), ox: 0, oy: 0 });
          }
        }
        return out;
      });
    defineSprite(id, () => make(1), { hd: (d) => make(d) });
  }
  return { id, speed: o.speed, y: y0, width: o.width, tiles, anim, tpf: o.tpf ?? 20 };
}

export interface TileOpts {
  /** Draw in front of the figures (default behind). */
  front?: boolean;
  /** Only the part of the plane from band x `from` (default 0) up to `to` (default the section's end). */
  from?: number;
  to?: number;
}

/** The decor of a band, repeated along the section. */
export function bandTiles(b: Band, sectionW: number, o: TileOpts = {}): DecorDef[] {
  const out: DecorDef[] = [];
  const end = o.to ?? bandEnd(sectionW, b.speed);
  const from = o.from ?? 0;
  for (let r = Math.floor(from / b.width); r * b.width < end; r++) {
    for (let k = 0; k < b.tiles; k++) {
      const x = r * b.width + k * TILE_W;
      if (x >= end || x + TILE_W <= from) continue;
      const d: DecorDef = { sprite: b.id, frame: k, x, y: b.y, parallax: b.speed };
      if (o.front) d.front = true;
      if (b.anim > 1) {
        d.animate = b.tpf;
        d.animStep = b.tiles;
      }
      out.push(d);
    }
  }
  return out;
}

/** The decor of a long drawing that stands once, from band x `x` on (a museum, a quay, a long bridge). */
export function placeBand(b: Band, x: number, o: { front?: boolean } = {}): DecorDef[] {
  const out: DecorDef[] = [];
  for (let k = 0; k < b.tiles; k++) {
    const d: DecorDef = { sprite: b.id, frame: k, x: x + k * TILE_W, y: b.y, parallax: b.speed };
    if (o.front) d.front = true;
    if (b.anim > 1) {
      d.animate = b.tpf;
      d.animStep = b.tiles;
    }
    out.push(d);
  }
  return out;
}

export interface PropOpts {
  frame?: number;
  /** true = the sprite's own speed, a number = ticks per frame. */
  animate?: boolean | number;
  front?: boolean;
  flipX?: boolean;
}

/** A prop at band x `x` on a plane of speed s (x as a position on that plane's own layout). */
export function atBand(sprite: string, x: number, y: number, s: number, o: PropOpts = {}): DecorDef {
  return { sprite, x, y, parallax: s, ...o };
}

/** A prop at world x `wx` on a plane of speed s (it stands at wx when wx is at screen centre). */
export function atWorld(sprite: string, wx: number, y: number, s: number, o: PropOpts = {}): DecorDef {
  return atBand(sprite, bandX(wx, s), y, s, o);
}

/**
 * The foot line of what stands at speed 1 beside the street (a lamp a gull sleeps on, an elm): the top
 * rows of the walk band, right under the far kerb, behind the figures' feet.
 */
export const HIT_FOOT = B1 + 3;

/** A prop that a hitbox touches: speed 1, always (a platform, a ledge, a lamp a gull sleeps on …). */
export function hitProp(sprite: string, wx: number, y: number, o: PropOpts = {}): DecorDef {
  return { sprite, x: wx, y, ...o };
}

/** A small far mover: band x, wrapping over `span`, repeated along the section so it comes by again. */
export function mover(sprite: string, s: number, x0: number, y: number, v: number, span: number, sectionW: number, fps = 8): DecorDef[] {
  const out: DecorDef[] = [];
  const end = bandEnd(sectionW, s);
  for (let k = 0; k * span - 40 < end; k++) {
    out.push({ sprite, x: k * span - 40, y, parallax: s, animate: Math.max(1, Math.round(60 / fps)), moveX: v, moveSpan: span, moveFrom: x0 });
  }
  return out;
}

// ------------------------------------------------------------------------------------- the sky

defineBgGenerator(
  'ams2-sky',
  (w, h, p) => skyLayer(w, h, p, 1),
  { hd: (w, h, p, _seed, d) => skyLayer(w, h, p, d) },
);

function skyLayer(w: number, h: number, p: Readonly<Record<string, unknown>>, u: 1 | 2 | 4): PixelBuffer {
  const light = p.light as LightName;
  const seed = p.seed as number;
  const tones = R[p.ramp as string];
  const paintOver = p.paintOver as ((s: S) => void) | undefined;
  return withKitTier(u, () => {
    const s = new S(w, h);
    skyBands(s, tones, tones.length === 6 ? [28, 52, 74, 94, 112] : [20, 38, 54, 70, 88, 106], seed);
    if (paintOver) paintOver(s);
    return renderBuffer(s, light, u, hashSeed(light) + w * 7 + h);
  });
}

/** The hex colour of a palette id as a packed colour. */
function packed(id: number): number {
  const [r, g, b] = hexrgb(COL[id] as string);
  return ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

export interface SkyOpts {
  /** The sky's ramp (default: the light's). */
  ramp?: string;
  /** Draw on the sky (the sun of section d): runs at every tier, on a canvas of the kit. */
  paintOver?: (s: S) => void;
}

/** The section's background: the clear colour and the one layer of the sky. */
export function skyBackground(light: LightName, seed: number, o: SkyOpts = {}): BackgroundDef {
  const ramp = o.ramp ?? { morning: 'sky_m', noon: 'sky_n', golden: 'sky_g', sunset: 'sky_s' }[light];
  const tones = R[ramp];
  const layer: BgLayerDef = {
    gen: 'ams2-sky',
    params: { light, seed, ramp, paintOver: o.paintOver },
    width: 512,
    height: 132,
    factorX: S_SKY,
  };
  return { sky: packed(tones[tones.length - 1]), layers: [layer] };
}

// ------------------------------------------------------------------------------------ the floor

export type FarKind = 'pave' | 'none';
export type WalkKind = 'cobble' | 'slab' | 'gravel' | 'none';
export type NearKind = 'lane' | 'pave' | 'water';

export interface FloorSpec {
  light: LightName;
  /** Unique per floor: names the sprites. */
  name: string;
  seed: number;
  far?: FarKind;
  walk?: WalkKind;
  near?: NearKind;
  /** Draw more on the far band's canvas (a quay edge). Rows B0 − 3 … B1. */
  farExtra?: (s: S) => void;
  /** Draw more on the walk band's canvas. Rows B1 … B2. */
  walkExtra?: (s: S) => void;
  /** Draw more on the near band's canvas. Rows B2 … VH. */
  nearExtra?: (s: S) => void;
}

/** One painted floor: three bands and the posts that stand on it. */
export interface FloorPlan {
  readonly spec: Required<Pick<FloorSpec, 'far' | 'walk' | 'near'>> & FloorSpec;
  readonly far: Band;
  readonly walk: Band;
  readonly near: Band;
  /** Water cuts in world x. */
  readonly cuts: Array<readonly [number, number]>;
  /** World spans without posts: a bridge, a ramp (`keepClear`). `postRow` skips them. */
  readonly clear: Array<readonly [number, number]>;
  /** Every post placed by `kerbPosts`. */
  readonly posts: Array<{ readonly band: 'far' | 'near'; readonly x: number; readonly foot: number }>;
}

/** Every painted floor (tests/content/ams2.test.ts checks each post against the painted kerb). */
export const FLOORS: FloorPlan[] = [];

/** No post row in world span x0 … x1 of this floor (a bridge, a ramp, a jetty): `postRow` skips it. */
export function keepClear(plan: FloorPlan, x0: number, x1: number): void {
  plan.clear.push([x0, x1]);
}

/** The canvas of one band of a floor (it tiles; the kit's tier decides the small extras). */
export function paintFloorBand(spec: FloorPlan['spec'], band: 'far' | 'walk' | 'near'): S {
  const s = new S(FLOOR_W, VH);
  s.wrap = true;
  const seed = spec.seed;
  const fine = (): boolean => kitTier() >= 2;
  if (band === 'far') {
    if (spec.far === 'pave') pavers(s, B0, B1 - 4, seed);
    if (spec.far !== 'none') kerb(s, B1 - 4, 4, seed);
    if (fine() && spec.far !== 'none') leaves(s, B0, B1 - 4, seed + 70, Math.trunc(s.w / 34));
    spec.farExtra?.(s);
  } else if (band === 'walk') {
    if (spec.walk === 'cobble') cobbles(s, B1, B2, seed);
    else if (spec.walk === 'slab') pavers(s, B1, B2, seed, 5, 7, 2.4, 'pave', 0.33);
    else if (spec.walk === 'gravel') gravel(s, B1, B2, seed);
    if (fine() && (spec.walk === 'cobble' || spec.walk === 'slab')) {
      for (let x = 150; x < s.w; x += 310) manhole(s, x, 178);
      for (let x = 70; x < s.w; x += 170) drain(s, x, B1);
    }
    if (fine() && spec.walk !== 'none') leaves(s, B1 + 1, B2 - 1, seed + 71, Math.trunc(s.w / 30));
    spec.walkExtra?.(s);
  } else {
    if (spec.near !== 'water') {
      kerb(s, B2, 5, seed + 1);
      if (spec.near === 'lane') {
        lane(s, B2 + 5, VH - 7, seed + 2);
        pavers(s, VH - 7, VH, seed + 3, 5, 7);
      } else {
        pavers(s, B2 + 5, VH, seed + 3, 6, 8, 2.4, 'pave', 0.33);
      }
      if (fine()) leaves(s, B2 + 6, VH - 1, seed + 72, Math.trunc(s.w / 34));
    }
    spec.nearExtra?.(s);
  }
  return s;
}

/** Define a painted floor. Lay its bands with `bandTiles(plan.far, …)` and so on. */
export function defineFloor(spec: FloorSpec): FloorPlan {
  const full = { ...spec, far: spec.far ?? 'pave', walk: spec.walk ?? 'cobble', near: spec.near ?? 'lane' };
  const mk = (band: 'far' | 'walk' | 'near', speed: number, rows: readonly [number, number]): Band =>
    defineBand({ light: spec.light, name: `${spec.name}/floor-${band}`, speed, rows, width: FLOOR_W, paint: () => paintFloorBand(full, band) });
  const plan: FloorPlan = {
    spec: full,
    far: mk('far', S_BACK, [B0 - 3, B1]),
    walk: mk('walk', S_WALK, [B1, B2]),
    near: mk('near', S_NEAR, [B2, VH]),
    cuts: [],
    clear: [],
    posts: [],
  };
  FLOORS.push(plan);
  return plan;
}

/** The rows of the kerbstones of a band, or null when it has none. */
export function kerbRows(plan: FloorPlan, band: 'far' | 'near'): readonly [number, number] | null {
  if (band === 'far') return plan.spec.far === 'none' ? null : [B1 - 4, B1];
  return plan.spec.near === 'water' ? null : [B2, B2 + 5];
}

/** Is band x p of this band inside a water cut? */
function inCut(plan: FloorPlan, band: 'far' | 'near', p: number): boolean {
  const s = band === 'far' ? S_BACK : S_NEAR;
  return plan.cuts.some(([x0, x1]) => p >= bandX(x0, s) && p <= bandX(x1, s));
}

/** Is band x p of this band inside a span of `keepClear`? */
function inClear(plan: FloorPlan, band: 'far' | 'near', p: number): boolean {
  const s = band === 'far' ? S_BACK : S_NEAR;
  return plan.clear.some(([x0, x1]) => p >= bandX(x0, s) && p <= bandX(x1, s));
}

const POST_W = 9;

/**
 * Amsterdammertjes on a band's kerbstones, at band x `xs`: the far row behind the figures, the near
 * row in front of them. THE RULE (docs/design/ams2.md §0 #7): a post stands on a kerbstone and on
 * nothing else, so this throws `PostOnWrongGround` on any other ground: a row off the kerb, a band
 * without one, a water cut. `foot` is for a test only.
 */
export function kerbPosts(plan: FloorPlan, light: LightName, band: 'far' | 'near', xs: readonly number[], foot: number = band === 'far' ? FAR_FOOT : NEAR_FOOT): DecorDef[] {
  const rows = kerbRows(plan, band);
  const where = `${plan.spec.name} ${band} row`;
  const out: DecorDef[] = [];
  const s = band === 'far' ? S_BACK : S_NEAR;
  const id = band === 'far' ? artId(light, 'post-far') : artId(light, 'post');
  for (const x of xs) {
    if (!rows || foot < rows[0] || foot >= rows[1]) throw new PostOnWrongGround(`${where} x=${x} y=${foot}`);
    if (inCut(plan, band, x + 1) || inCut(plan, band, x + POST_W - 2)) throw new PostOnWrongGround(`${where} x=${x} y=${foot} (water)`);
    plan.posts.push({ band, x, foot });
    out.push(atBand(id, x, foot + 2, s, band === 'near' ? { front: true } : {}));
  }
  return out;
}

/** Band xs from `start` every `step` along the section, skipping the water cuts and `keepClear` spans (for `kerbPosts`). */
export function postRow(plan: FloorPlan, band: 'far' | 'near', start: number, step: number, sectionW: number): number[] {
  const s = band === 'far' ? S_BACK : S_NEAR;
  const out: number[] = [];
  for (let x = start; x < bandEnd(sectionW, s); x += step) {
    const free = (p: number): boolean => !inCut(plan, band, p) && !inClear(plan, band, p);
    if (free(x + 1) && free(x + POST_W - 2)) out.push(x);
  }
  return out;
}

// ------------------------------------------------------------------------------------ water cuts

const WATER_ROWS: Readonly<Record<'far' | 'walk' | 'near', readonly [number, number, number]>> = {
  far: [B0 - 3, B1, S_BACK],
  walk: [B1, B2, S_WALK],
  near: [B2, VH, S_NEAR],
};

/** The quay edge of a cut: a hard stone wall on each side. */
function paintCutEdges(s: S, y0: number, y1: number): void {
  const [a, b, c, d] = R.stone;
  s.use(5, 1);
  const h = y1 - y0;
  s.rect(b, 0, y0, 3, h);
  s.vl(a, 2, y0, h);
  s.vl(d, 0, y0, h);
  s.rect(c, s.w - 3, y0, 3, h);
  s.vl(d, s.w - 3, y0, h);
  s.vl(a, s.w - 1, y0, h);
}

export interface WaterCut {
  /** Draw these behind the figures, after the floor bands and before the back props. */
  readonly back: DecorDef[];
  /** Draw these in front of the figures: a figure in the water sinks behind the surface. */
  readonly front: DecorDef[];
}

/**
 * A water cut through the floor, from the same numbers as the terrain's hazard (world x0 … x1): one
 * band of water per floor band, each at its speed, with hard quay edges. Posts of the plan stay out.
 */
export function waterCut(plan: FloorPlan, light: LightName, name: string, x0: number, x1: number, seed = 51): WaterCut {
  plan.cuts.push([x0, x1]);
  const back: DecorDef[] = [];
  (['far', 'walk', 'near'] as const).forEach((band, i) => {
    const [y0, y1, s] = WATER_ROWS[band];
    const p0 = bandX(x0, s);
    const p1 = bandX(x1, s);
    const width = p1 - p0;
    const b = defineBand({
      light,
      name: `${plan.spec.name}/cut-${name}-${band}`,
      speed: s,
      rows: [y0, y1],
      width,
      anim: 3,
      tpf: band === 'far' ? WATER_TPF.far : band === 'near' ? WATER_TPF.near : WATER_TPF.walk,
      paint: () =>
        [0, 1, 2].map((f) => {
          // Two rows more on top: the shadow of the bank stays out of the cut.
          const w = waterBand(width, y0 - 2, y1, null, seed + i * 11, f);
          paintCutEdges(w, y0, y1);
          return w;
        }),
    });
    for (let k = 0; k < b.tiles; k++) back.push({ sprite: b.id, frame: k, x: p0 + k * TILE_W, y: y0, parallax: s, animate: b.tpf, animStep: b.tiles });
  });
  // The surface in front of the figures: walk rows only, at speed 1.
  const y0 = WATER_Y + 2;
  const y1 = B2;
  const width = x1 - x0;
  const f = defineBand({
    light,
    name: `${plan.spec.name}/cut-${name}-front`,
    speed: S_WALK,
    rows: [y0, y1],
    width,
    anim: 3,
    tpf: WATER_TPF.surface,
    paint: () =>
      [0, 1, 2].map((fr) => {
        const w = waterBand(width, y0 - 2, y1, null, seed + 40, fr);
        paintCutEdges(w, y0, y1);
        return w;
      }),
  });
  const front: DecorDef[] = [];
  for (let k = 0; k < f.tiles; k++) front.push({ sprite: f.id, frame: k, x: x0 + k * TILE_W, y: y0, front: true, animate: f.tpf, animStep: f.tiles });
  return { back, front };
}

// -------------------------------------------------------------------------------------- sections

export interface StageOpts {
  /** The section's background: `skyBackground(light, seed)`. */
  background: BackgroundDef;
  /** The whole decor list, in draw order. */
  decor: DecorDef[];
  /** `'all'` (default): the terrain painter draws nothing, every platform and solid is a sprite of the kit; true: ground off only. */
  paintedFloor?: true | 'all';
  /** More sprite ids or prefixes for the tier-4 working set (sprites a script spawns). */
  art?: readonly string[];
  /**
   * Shared sprite id → the kit's twin: while this section draws, an entity that draws the shared id
   * draws the twin (same frame order, same anchor). `ams` never sees it, game logic never sees it.
   * The twins join the section's `art` by themselves.
   */
  overrides?: Readonly<Record<string, string>>;
  /** Replace the base section's `art` entries (default: keep those that the base's decor does not name). */
  keepArt?: (id: string) => boolean;
}

/** Crowns sway slowly: this many ticks per step at least, and up to 30 more. */
const CROWN_TPF = 45;

/**
 * Motion in a section: no two items step in the same tick. Each animated item gets its own phase from
 * its sprite and its place; a tree crown also gets its own slow step. A water band keeps its tile's own phase too.
 */
export function settleMotion(decor: readonly DecorDef[]): DecorDef[] {
  return decor.map((d) => {
    if (!d.animate || d.animPhase !== undefined) return d;
    const h = Math.abs(Math.trunc(hashSeed(d.sprite) * 131 + d.x * 7 + d.y * 3));
    if (typeof d.animate === 'number' && d.sprite.includes('crown')) {
      const tpf = CROWN_TPF + (h % 31);
      return { ...d, animate: tpf, animPhase: h % 211 };
    }
    return { ...d, animPhase: h % 211 };
  });
}

/**
 * A section of `ams2` from its `ams` section: same script, terrain, exits, timers, checkpoints,
 * respawn. Only what the player sees as scenery changes.
 */
export function stageSection(base: SectionDef, o: StageOpts): SectionDef {
  const replaced = new Set((base.decor ?? []).map((d) => d.sprite));
  const kept = o.keepArt ?? ((id: string) => !replaced.has(id) || o.decor.some((d) => d.sprite === id));
  const over = Object.entries(o.overrides ?? {});
  const art = [...new Set([...(base.art ?? []).filter(kept), ...o.decor.map((d) => d.sprite), ...(o.art ?? []), ...over.map(([, twin]) => twin)])];
  return {
    ...base,
    background: o.background,
    decor: settleMotion(o.decor),
    floor: undefined,
    // ams2 paints its own scenery: never the base section's canal scene (docs/api/canal.md).
    canal: undefined,
    paintedFloor: o.paintedFloor ?? 'all',
    spriteOverrides: over.length ? new Map(over) : undefined,
    art,
  };
}
