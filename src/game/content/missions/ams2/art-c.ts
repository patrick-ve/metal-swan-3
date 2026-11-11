/**
 * The art of the golden sections c AMSTEL, c1 BRUG and c2 RONDVAART (docs/design/ams2.md §3): what they
 * share (the river in its planes, the far bank, the white bridge, the small boat, the route signs,
 * the quays) and what section c alone shows (the plank jetty, the houseboats at their collision
 * heights, the shop row, the breakables, the fork). The white bridge's and the Blauwbrug's long drawings
 * of c1 are in art-c1.ts, the cruise's in art-c2.ts. Every number of the world comes from ams/terrain.ts.
 */
import { addMargin, kitTier, S, text, textW, withKitTier } from '../../../art/herokit/canvas';
import { crown, STAMPS, swayCrown, trunk } from '../../../art/herokit/foliage';
import { pyRound } from '../../../art/herokit/canvas-math';
import { hashSeed, renderBuffer } from '../../../art/herokit/hi';
import { K, KM, R, VARIANTS } from '../../../art/herokit/palette';
import { houseboat, stall, tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { door, type GableKind, house, window_ } from '../../../art/herokit/walls';
import { waterBand } from '../../../art/herokit/water';
import { defineSprite, type Frame, hasSprite } from '../../../../engine/sprites';
import type { DecorDef } from '../../../mission/index';
import { C_BOATS, DECK_Y, type Houseboat, ROOF_Y } from '../ams/terrain';
import { defineBank, defineFarBand, houseRow, quayWall } from './scene';
import { artId, B0, B1, B2, type Band, bandX, defineArt, defineBand, paintFloorBand, type FloorPlan, S_BACK, S_MID, S_NEAR, S_WALK, TILE_W, VH, WATER_TPF, WATER_Y } from './stage';

export const L = 'golden';
const PILE_TOP = B1 - 22;

export const id = (name: string): string => artId(L, name);

// ------------------------------------------------------------------------------- twins

/**
 * A twin with the exact anchor of the shared sprite (a frame px on the entity's x and y). `defineArt`
 * knows three anchors; a shared boat, a bridge or a secret has its own.
 */
export function defineTwin(name: string, paint: () => readonly S[], ox: number, oy: number, ticksPerFrame?: number): string {
  const sid = id(name);
  if (hasSprite(sid)) return sid;
  const make = (u: 1 | 2 | 4): Frame[] =>
    withKitTier(u, () =>
      paint().map((c): Frame => {
        if (c.w > TILE_W) throw new Error(`${sid}: ${c.w} px wide`);
        return { buf: renderBuffer(c, L, u, hashSeed(L) + c.w * 7 + c.h), ox, oy };
      }),
    );
  defineSprite(sid, () => make(1), { hd: (d) => make(d), ticksPerFrame });
  return sid;
}

/** Nothing: what an entity draws when the scenery draws it instead (a waver in a window at the facade's speed). */
export const EMPTY = defineArt(L, 'river/empty', () => new S(1, 1), { anchor: 'tl' });

// ------------------------------------------------------------------------------- the river

const TILE = 768;
/** One row of crests where the water meets what stands in it: this tells the eye "this is the surface". */
function surfaceLine(s: S, y: number, seed: number, frame = 0): void {
  const [w0, w1] = R.water;
  const r = rngf(seed);
  let x = r.int(0, 9);
  let q = 0;
  const stop = x + s.w;
  while (x < stop) {
    const n = Math.min(r.int(3, 11), stop - x);
    // One crest in five moves on in a later frame; the line stays where it is.
    const dx = frame > 0 && q % 5 === frame - 1 ? 2 : 0;
    for (let i = x + dx; i < x + dx + n; i++) s.c[y * s.w + i % s.w] = i % 5 === 0 ? w0 : w1;
    x += n + r.int(4, 18);
    q++;
  }
}

/** Open dashes in the top rows of a band, fewer with depth: the bank's reflection under it runs out in hard dashes, not on a straight line. */
function fray(w: S, y0: number, rows: number, seed: number): void {
  const r = rngf(seed);
  for (let j = 0; j < rows; j++) {
    const open = 1 - (j + 1) / (rows + 1);
    let x = r.int(0, 12);
    const stop = x + w.w;
    while (x < stop) {
      const n = Math.min(r.int(4, 22), stop - x);
      if (r.random() < open) for (let i = x; i < x + n; i++) w.c[(y0 + j) * w.w + i % w.w] = 0;
      x += n;
    }
  }
}

function water(name: string, speed: number, rows: readonly [number, number], seed: number, line = false, width = TILE, frayRows = 0): Band {
  return defineBand({
    light: L,
    name: `river/${name}`,
    speed,
    rows,
    width,
    anim: 3,
    tpf: speed === S_BACK ? WATER_TPF.far : speed === S_NEAR ? WATER_TPF.near : line ? WATER_TPF.surface : WATER_TPF.walk,
    paint: () =>
      [0, 1, 2].map((f) => {
        // More rows on top: the shadow of the bank and its dark first rows stay out of a band in open water.
        const w = waterBand(width, rows[0] - 8, rows[1], null, seed, f);
        if (line) surfaceLine(w, rows[0], seed, f);
        if (frayRows) fray(w, rows[0], frayRows, seed + 500);
        return w;
      }),
  });
}

/** The river behind the walk rows, under them, and in the near rows: three planes, as the floor has. */
export const RIVER_FAR = water('far', S_BACK, [B0 - 2, B1 + 6], 261, false, TILE, 9);
export const RIVER_WALK = water('walk', S_WALK, [B1, B2 + 2], 271);
export const RIVER_NEAR = water('near', S_NEAR, [B2 + 2, VH], 281);
/** The surface in front of the figures: a figure in the water sinks behind it. */
const FRONT_ROWS: readonly [number, number] = [WATER_Y + 2, B2 + 2];
/** 800 px: the canal of c and the Amstel of c1 have that width. */
export const SURFACE_800 = water('surface-800', S_WALK, FRONT_ROWS, 291, true, 800);
/** Four of these are the river of c2. It starts lower: the tour boat's hull shows down to its water line. */
export const SURFACE_608 = water('surface-608', S_WALK, [WATER_Y + 6, B2 + 2], 301, true, 608);
/** Tiles of a band along band x from `from` to `to`, whole tiles (what lies past `to` must be covered or off the world). */
export function tiles(b: Band, from: number, to: number, extra: Partial<DecorDef> = {}): DecorDef[] {
  const out: DecorDef[] = [];
  const stepAnim = b.anim > 1 ? { animate: b.tpf, animStep: b.tiles } : {};
  let k = 0;
  for (let x = from; x < to; x += TILE_W) {
    // The last piece of a band is shorter when its width is not a multiple of a tile.
    const frame = k % b.tiles;
    out.push({ sprite: b.id, frame, x, y: b.y, parallax: b.speed, ...stepAnim, ...extra });
    k++;
    const w = Math.min(TILE_W, b.width - frame * TILE_W);
    x += w - TILE_W;
  }
  return out;
}

/** The river over a whole section. Lay quays over it, and the far plane's boats between `far` and `walk`. */
export function riverLayers(sectionW: number): { far: DecorDef[]; walk: DecorDef[]; near: DecorDef[] } {
  return {
    far: tiles(RIVER_FAR, 0, Math.ceil((sectionW - 384) * S_BACK) + 384),
    walk: tiles(RIVER_WALK, 0, sectionW),
    near: tiles(RIVER_NEAR, 0, Math.ceil((sectionW - 384) * S_NEAR) + 384),
  };
}

// ------------------------------------------------------------------------------- the far bank

export const FAR = defineFarBand(L, 'river/far-city', 231, 96, [
  [60, 76],
  [300, 50],
]);

export const BANK_Y = 104;
export const BANK_W = 1024;
/** The trees of the far bank (the first three are the reference's). */
export const BANK_TREES: readonly number[] = [40, 196, 452, 618, 880];

const CANAL = defineBank({
  light: L,
  name: 'river/c',
  speed: S_MID,
  width: BANK_W,
  rows: [12, BANK_Y + 6],
  waterRows: [BANK_Y + 6, B0 + 8],
  seed: 251,
  paint: (md) => {
    houseRow(md, BANK_Y, 241, { sh: 16, ww: 8, wh: 10, gr: 18, gh: 18, wmin: 34, wmax: 50 });
    quayWall(md, BANK_Y);
    for (const x of BANK_TREES) trunk(md, x, BANK_Y, 42, 4, 900 + x);
  },
  reflect: (bank) => {
    for (const x of BANK_TREES) bank.blit(renderBuffer(crown(56, 50, 900 + x, 0), L, 1, 0), x - 28, BANK_Y - 66);
  },
});

export const BANK: Band = CANAL.bank;
export const BANK_WATER: Band = CANAL.water;

/** The crown of a far tree of the bank at band x tx. */
export function bankCrown(tx: number): string {
  return defineArt(L, `river/far-crown-${tx}`, () => swayCrown(56, 50, 900 + tx), { anchor: 'tl' });
}
export const BANK_CROWN_Y = BANK_Y - 66;

// ------------------------------------------------------------------------------- the plank jetty

/** The plank jetty of the quay: a walk band of long planks that ends at the canal. */
export function plankBand(name: string, width: number, seed: number, ends: { left?: boolean; right?: boolean } = {}): Band {
  return defineBand({
    light: L,
    name,
    speed: S_WALK,
    rows: [B1, B2 + 2],
    width,
    paint: () => {
      const M = new S(width, VH);
      const r = rngf(seed);
      const [a, b, c, d] = R.wood;
      M.use(1, 0);
      for (const [y, h] of [
        [B1, 5],
        [B1 + 5, 5],
        [B1 + 10, 6],
        [B1 + 16, 6],
      ] as const) {
        M.rect(b, 0, y, M.w, h);
        M.hl(a, 0, y, M.w);
        M.hl(c, 0, y + h - 2, M.w);
        M.hl(K, 0, y + h - 1, M.w);
        let x = r.int(10, 90);
        while (x < M.w) {
          M.vl(K, x, y, h);
          M.px(R.pole[0], x + 2, y + 1);
          M.px(R.pole[0], x + 2, y + h - 3);
          M.px(R.pole[0], x - 2, y + 1);
          M.px(R.pole[0], x - 2, y + h - 3);
          x += r.int(70, 150);
        }
        for (let q = 0; q < Math.trunc(M.w / 16); q++) {
          const gx = r.int(0, M.w);
          const n = r.int(4, 14);
          const yy = y + r.int(1, Math.max(2, h - 2));
          M.hl(r.random() < 0.3 ? a : c, gx, yy, n);
        }
      }
      M.rect(d, 0, B2 - 1, M.w, 2);
      M.rect(K, 0, B2 + 1, M.w, 1);
      // A jetty ends in a heavy beam: nobody takes this edge for more floor.
      const cap = (x: number): void => {
        M.use(3, 3);
        M.rect(R.bark[2], x, B1, 5, B2 + 2 - B1);
        M.vl(R.bark[0], x + 3, B1, B2 + 2 - B1);
        M.vl(R.bark[1], x + 2, B1, B2 + 2 - B1);
        M.vl(K, x, B1, B2 + 2 - B1);
        M.vl(K, x + 4, B1, B2 + 2 - B1);
        for (let y = B1 + 3; y < B2; y += 7) M.px(R.pole[0], x + 2, y);
        M.use(1, 0);
      };
      if (ends.right) cap(M.w - 5);
      if (ends.left) cap(0);
      return M;
    },
  });
}

/** A jetty pile, its top over the planks. */
export const PILE = defineArt(
  L,
  'river/pile',
  () => {
    const pile = new S(10, 60);
    pile.use(1, 1);
    tube(pile, 'bark', 1, 2, 7, 58);
    pile.rect(R.bark[0], 1, 0, 7, 2);
    pile.hl(R.bark[2], 2, 0, 5);
    pile.use(2, 2);
    pile.rect(R.iron[1], 0, 20, 9, 2);
    pile.hl(R.iron[0], 0, 20, 9);
    pile.hl(R.iron[3], 0, 22, 9);
    const o = addMargin(pile);
    o.finish();
    return o;
  },
  { anchor: 'tl' },
);
export const PILE_Y = PILE_TOP;

/** A short pile in the water, with the waterline's green on it. Lower than any deck: nobody aims a jump at it. */
export const PILE_LOW = defineArt(
  L,
  'river/pile-low',
  () => {
    const p = new S(8, 34);
    p.use(1, 1);
    tube(p, 'bark', 1, 2, 5, 32);
    p.rect(R.bark[0], 1, 0, 5, 2);
    p.hl(R.bark[2], 2, 0, 3);
    p.use(2, 2);
    p.rect(R.moss[2], 1, 22, 5, 8);
    p.hl(R.moss[0], 1, 22, 5);
    p.px(R.moss[1], 5, 23);
    const o = addMargin(p);
    o.finish();
    return o;
  },
  { anchor: 'tl' },
);

// ------------------------------------------------------------------------------- small things

/** An iron mooring bollard with a rope. */
export const CLEAT = defineArt(L, 'river/cleat', () => {
  const s = new S(14, 12);
  s.use(1, 1);
  tube(s, 'iron', 4, 3, 6, 9);
  s.rect(R.iron[1], 3, 1, 8, 3);
  s.hl(R.iron[0], 3, 1, 8);
  s.hl(R.iron[3], 3, 3, 8);
  s.use(2, 2);
  const [c0, c1, c2] = R.cloth;
  s.hl(c1, 2, 6, 10);
  s.hl(c2, 2, 7, 10);
  for (let x = 3; x < 12; x += 3) s.px(c0, x, 6);
  s.rect(c2, 0, 8, 3, 3);
  s.hl(c1, 0, 8, 3);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A lifebuoy on a post: where the water starts, for anyone who looks. */
export const BUOY_POST = defineArt(L, 'river/buoy-post', () => {
  const s = new S(20, 42);
  s.use(1, 1);
  tube(s, 'bark', 8, 2, 5, 40);
  s.rect(R.bark[0], 8, 0, 5, 2);
  s.use(2, 2);
  s.ell(R.dred[1], 10, 16, 8, 8);
  for (const [x, y] of [
    [10, 9],
    [10, 23],
    [3, 16],
    [17, 16],
  ]) {
    s.rect(R.white[0], x - 2, y - 1, 4, 3);
  }
  s.ell(R.dred[2], 8, 18, 2, 2);
  s.use(3, 1.5);
  s.ell(R.bark[2], 10, 16, 4, 4);
  s.rect(R.bark[1], 8, 12, 5, 8);
  s.vl(R.bark[0], 11, 12, 8);
  s.use(4, 3);
  for (const [x, y] of [
    [14, 11],
    [15, 12],
    [13, 10],
  ]) {
    s.px(R.dred[0], x, y);
  }
  const o = addMargin(s);
  o.finish();
  return o;
});

/** Wooden crates and a barrel on the jetty. */
export const CARGO = defineArt(L, 'c/cargo', () => {
  const s = new S(52, 34);
  const [a, b, c, d] = R.wood;
  // The barrel.
  s.use(1, 1);
  s.ell(b, 44, 18, 7, 15);
  s.rect(b, 37, 7, 15, 23);
  for (const x of [38, 41]) s.vl(c, x, 5, 26);
  s.vl(d, 37, 6, 25);
  s.vl(a, 49, 6, 25);
  s.use(2, 2);
  for (const y of [9, 26]) {
    s.hl(R.iron[1], 37, y, 15);
    s.hl(R.iron[3], 37, y + 1, 15);
    s.hl(R.iron[0], 44, y, 8);
  }
  s.use(3, 1.5);
  s.rect(c, 39, 3, 11, 3);
  s.hl(a, 41, 3, 8);
  // The crates, one on the other.
  const box = (x: number, y: number, w: number, h: number, p: number, z: number): void => {
    s.use(p, z);
    s.rect(b, x, y, w, h);
    s.hl(a, x, y, w);
    s.hl(d, x, y + h - 1, w);
    s.vl(c, x, y, h);
    s.vl(a, x + w - 1, y, h);
    for (let q = y + 4; q < y + h - 1; q += 4) s.hl(c, x + 1, q, w - 2);
    s.line(c, x + 2, y + h - 3, x + w - 3, y + 2);
    s.line(d, x + 2, y + h - 2, x + w - 3, y + 3);
  };
  box(2, 14, 24, 20, 4, 3);
  box(8, 0, 16, 14, 5, 2.5);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A route sign: a navy board with cream letters on steel posts, its arrow painted beside the word. */
export function routeSign(label: string, arrow: 'up' | 'down' | 'none'): string {
  return defineArt(L, `river/sign-${label.toLowerCase()}`, () => {
    const tw = textW(label);
    const aw = arrow === 'none' ? 0 : 11;
    const bw = tw + aw + 8;
    const postH = 26;
    const bh = 14;
    const s = new S(bw, bh + postH);
    const [n0, n1, n2, n3] = R.navy;
    const posts = bw > 56 ? [5, bw - 8] : [(bw >> 1) - 1];
    for (const x of posts) {
      s.use(1, 1);
      tube(s, 'pole', x, bh, 3, postH);
      s.use(2, 1.5);
      s.rect(R.pole[2], x - 1, bh + postH - 2, 5, 2);
      s.hl(R.pole[1], x - 1, bh + postH - 2, 5);
    }
    s.use(3, 3);
    s.rect(n1, 0, 0, bw, bh);
    s.hl(n0, 0, 0, bw);
    s.vl(n0, bw - 1, 0, bh);
    s.hl(n3, 0, bh - 1, bw);
    s.vl(n2, 0, 0, bh);
    s.use(4, 4);
    const [p0, p1] = R.cloth;
    s.hl(p1, 1, 1, bw - 2);
    s.hl(p1, 1, bh - 2, bw - 2);
    s.vl(p1, 1, 1, bh - 2);
    s.vl(p1, bw - 2, 1, bh - 2);
    text(s, label, 4, 4, R.yellow[0]);
    if (arrow !== 'none') {
      s.use(5, 4);
      // A shaft and a head, 7 × 9, as stamps: EPX would close the shape to a diamond.
      const up = ['...a...', '..aaa..', '.aaaaa.', 'aaaaaaa', '..aaa..', '..aaa..', '..aaa..', '..aaa..', '..aaa..'];
      s.stampGrid(arrow === 'up' ? up : [...up].reverse(), 4 + tw + 4, 3, { a: p0 });
    }
    const o = addMargin(s);
    o.finish();
    return o;
  });
}

// ------------------------------------------------------------------------------- the small boat

/**
 * The twin of `decor/ams/ams-boat-platform` (2 wake frames, the anchor (32, 2), rail top on the anchor's
 * row; flipped when it goes left, as the shared one): a low open wooden boat with an outboard.
 */
export const BOAT_PLATFORM = defineTwin(
  'river/boat-platform',
  () =>
    [0, 1].map((phase) => {
      const s = new S(64, 22);
      const [a, b, c, d] = R.wood;
      const [h0, h1, h2, h3] = R.hull;
      s.use(1, 1);
      s.poly(b, [
        [2, 2],
        [61, 2],
        [56, 15],
        [8, 15],
      ]);
      s.hl(a, 2, 2, 60);
      s.hl(c, 4, 7, 56);
      s.hl(a, 5, 8, 54);
      s.hl(c, 6, 12, 52);
      s.hl(d, 8, 14, 49);
      for (let x = 13; x < 54; x += 10) s.vl(d, x, 4, 3);
      s.use(2, 1.2);
      s.rect(h2, 9, 3, 46, 2);
      s.hl(h3, 9, 4, 46);
      for (let x = 14; x < 54; x += 13) {
        s.rect(a, x, 3, 5, 1);
      }
      // The outboard at the stern.
      s.use(3, 2);
      s.rect(h1, 0, 0, 6, 7);
      s.hl(h0, 0, 0, 6);
      s.vl(h0, 5, 0, 7);
      s.vl(h3, 0, 0, 7);
      s.rect(h2, 2, 7, 2, 8);
      s.vl(h1, 3, 7, 8);
      // The bow fender.
      s.use(4, 2);
      s.ell(R.cloth[1], 59, 6, 2, 2);
      s.px(R.cloth[0], 60, 5);
      s.finish();
      // The wake: no outline, hard dashes on the water.
      const [w0, w1] = R.water;
      s.use(9, 5);
      const foam = phase ? [[0, 16, 4], [56, 15, 5], [50, 17, 3], [14, 17, 8], [34, 16, 6]] : [[2, 15, 3], [58, 16, 4], [48, 16, 5], [20, 16, 7], [38, 17, 5]];
      for (const [x, y, n] of foam) s.hl(y % 2 ? w0 : w1, x, y, n);
      return s;
    }),
  32,
  2,
  12,
);

// ------------------------------------------------------------------------------- quays: bands that stand once

/** A cut of a canvas: columns x … x + w of it. */
function cropCols(o: S, x: number, w: number): S {
  const c = new S(w, o.h);
  for (let j = 0; j < o.h; j++) {
    for (let i = 0; i < w; i++) {
      const a = j * o.w + ((x + i) % o.w);
      const b = j * w + i;
      c.c[b] = o.c[a];
      c.z[b] = o.z[a];
      c.p[b] = o.p[a];
    }
  }
  return c;
}

const ROWS = { far: [B0 - 3, B1], walk: [B1, B2], near: [B2, VH] } as const;

/**
 * One band of a floor plan laid exactly from band x p0 up to p1: whole tiles, then a shorter piece of the
 * same drawing. So a quay has a hard end where the terrain's numbers say.
 */
export function layExact(plan: FloorPlan, band: 'far' | 'walk' | 'near', p0: number, p1: number): DecorDef[] {
  const b = plan[band];
  const whole = Math.floor((p1 - p0) / TILE_W);
  const out: DecorDef[] = [];
  for (let k = 0; k < whole; k++) out.push({ sprite: b.id, frame: k % b.tiles, x: p0 + k * TILE_W, y: b.y, parallax: b.speed });
  const rest = p1 - p0 - whole * TILE_W;
  if (rest > 0) {
    const from = (whole % b.tiles) * TILE_W;
    const piece = defineBand({
      light: L,
      name: `${plan.spec.name}/end-${band}-${p0}-${rest}`,
      speed: b.speed,
      rows: ROWS[band],
      width: rest,
      paint: () => cropCols(paintFloorBand(plan.spec, band), from, rest),
    });
    out.push({ sprite: piece.id, frame: 0, x: p0 + whole * TILE_W, y: b.y, parallax: b.speed });
  }
  return out;
}

/** The stone wall of a quay's end, on one plane: a lit corner, then the wall into the water. */
function quayEndArt(name: string, h: number, side: 'l' | 'r'): string {
  return defineArt(
    L,
    `river/quay-end-${name}-${side}`,
    () => {
      const s = new S(6, h);
      const [a, b, c, d] = R.stone;
      s.use(1, 1);
      s.rect(c, 0, 0, 6, h);
      if (side === 'r') {
        s.vl(b, 5, 0, h);
        s.vl(a, 4, 0, h);
        s.vl(d, 0, 0, h);
      } else {
        s.vl(a, 0, 0, h);
        s.vl(b, 1, 0, h);
        s.vl(d, 5, 0, h);
      }
      for (let y = 3; y < h; y += 5) s.hl(d, 1, y, 4);
      const o = addMargin(s);
      o.finish();
      return o;
    },
    { anchor: 'tl' },
  );
}

/**
 * The hard end of a quay at world x `wx`: stone on each floor band's own plane. 'r': the water lies to the
 * right of the quay; 'l': to its left.
 */
export function quayEnd(wx: number, side: 'l' | 'r'): DecorDef[] {
  const out: DecorDef[] = [];
  const dx = side === 'r' ? -4 : -3;
  for (const [band, y0, y1, sp] of [
    ['far', B0 - 3, B1, S_BACK],
    ['walk', B1, B2, S_WALK],
    ['near', B2, VH, S_NEAR],
  ] as const) {
    out.push({ sprite: quayEndArt(band, y1 - y0, side), x: bandX(wx, sp) + dx, y: y0 - 1, parallax: sp });
  }
  return out;
}

// ------------------------------------------------------------------------------- section c: the moored boats of the quay

/** The tall houseboats moored behind the plank jetty (the reference's), on the back plane: band x, width. */
export const MOORED: ReadonlyArray<readonly [number, number, string]> = [
  [24, 150, 'plastg'],
  [240, 180, 'plastc'],
  [440, 92, 'navy'],
];

export const mooredId = (i: number): string => {
  const [, w, wall] = MOORED[i];
  return defineArt(L, `c/moored-${i}`, () => houseboat(w, 300 + i, wall).box, { bob: [0, 1, 0, -1] });
};

/** The feet line of those boats (under the planks). */
export const MOORED_FEET = 178;
/** Their smoke: x from the boat's left end, y of its line. */
export const mooredSmoke = (w: number): readonly [number, number] => [w - 32, 100];

// ------------------------------------------------------------------------------- section c: the houseboats at their collision heights

/** Above the roof: what stands on it (a chimney, plants). The canvas starts this far over the roof line. */
const OVER_ROOF = 30;
const WALLS: readonly string[] = ['plastc', 'dred', 'plastg', 'navy', 'plastw', 'plastp'];
const ROOFS: readonly string[] = ['roof', 'bark', 'roof', 'hull', 'moss', 'roof'];
const HULLS: readonly string[] = ['hull', 'hull', 'navy', 'hull', 'dgreen', 'hull'];

export interface LowBoat {
  /** Top-left (world). */
  x: number;
  y: number;
  id: string;
}

/**
 * A houseboat built on its collision numbers: the deck's foot line runs through the planks (`deckY`), the
 * roof's along the roof's front edge (`roofY`). The cabin stands from cx to cx + cw, as the platforms do.
 */
export function lowBoatArt(b: Houseboat, i: number, roofY: number, deckY: number, name: string, float = false): LowBoat {
  const top = roofY - OVER_ROOF;
  const bottom = deckY + 24;
  const left = 3;
  const cid = defineArt(
    L,
    name,
    () => {
      const r = rngf(700 + i);
      const W = b.w + 12;
      const s = new S(W, bottom - top);
      const X = (wx: number): number => wx - b.x0 + left;
      const Y = (wy: number): number => wy - top;
      const x0 = X(b.x0);
      const x1 = X(b.x0 + b.w);
      const cx = X(b.cx);
      const cw = b.cw;
      const wallM = R[WALLS[i]];
      const [wa, wb, wc, wd] = wallM;
      const [h0, h1, h2, h3] = R[HULLS[i]];
      const W_ = R.wood;

      // The hull, its bow raked, the stern round.
      s.use(1, 1);
      const yd = Y(deckY);
      s.poly(h2, [
        [x0, yd + 4],
        [x1 - 1, yd + 4],
        [x1 - 4, yd + 14],
        [x1 - 9, s.h - 1],
        [x0 + 6, s.h - 1],
        [x0 + 2, yd + 14],
      ]);
      s.hl(h0, x0, yd + 4, x1 - x0);
      s.hl(h1, x0, yd + 5, x1 - x0);
      s.hl(h3, x0 + 3, yd + 15, x1 - x0 - 7);
      s.hl(h3, x0 + 4, yd + 16, x1 - x0 - 9);
      // Plates and rivets.
      for (let x = x0 + 8; x < x1 - 6; x += 22) {
        s.vl(h3, x, yd + 6, 9);
        s.vl(h1, x + 1, yd + 6, 9);
      }
      for (let x = x0 + 5; x < x1 - 5; x += 6) s.px(h3, x, yd + 7);
      for (let q = 0; q < Math.floor(b.w / 8); q++) s.hl(r.random() < 0.5 ? h1 : h3, x0 + 4 + r.int(0, b.w - 12), yd + 9 + r.int(0, 5), r.int(2, 6));

      // The deck, seen a little from above; the foot line runs along its middle.
      s.use(2, 1.5);
      s.poly(W_[1], [
        [x0 + 5, yd - 4],
        [x1 - 5, yd - 4],
        [x1 - 1, yd + 3],
        [x0, yd + 3],
      ]);
      for (let j = yd - 3; j < yd + 3; j += 2) s.hl(W_[2], x0 + 3, j, x1 - x0 - 6);
      for (let q = 0; q < Math.floor(b.w / 7); q++) s.hl(r.random() < 0.5 ? W_[0] : W_[3], x0 + 3 + r.int(0, b.w - 10), yd - 3 + r.int(0, 6), r.int(2, 5));
      // The rubbing strake, lit along the top.
      s.use(3, 2);
      s.hl(W_[0], x0, yd + 3, x1 - x0);
      s.hl(W_[3], x0, yd + 4, x1 - x0);

      // The cabin wall. The roof's foot line is the front edge of the roof.
      const ry = Y(roofY);
      const wallTop = ry + 3;
      const wallBot = yd - 3;
      const wh = wallBot - wallTop;
      const side = 5;
      s.use(4, 1.8);
      s.poly(wa, [
        [cx + cw, wallTop],
        [cx + cw + side - 1, wallTop - 4],
        [cx + cw + side - 1, wallBot - 4],
        [cx + cw, wallBot],
      ]);
      for (let j = wallTop; j < wallBot; j += 3) s.line(wb, cx + cw, j, cx + cw + side - 1, j - 4);
      s.use(5, 2);
      s.rect(wb, cx, wallTop, cw, wh);
      for (let j = wallTop + 2; j < wallBot; j += 3) {
        s.hl(wc, cx, j, cw);
        s.hl(wa, cx + Math.trunc(cw * 0.55), j + 1, Math.trunc(cw * 0.45));
      }
      s.vl(wd, cx, wallTop, wh);
      s.vl(wc, cx + 1, wallTop, wh);
      s.hl(wd, cx, wallTop, cw);

      // Windows with a box of flowers; a door on some boats.
      const hasDoor = i % 2 === 1;
      const dw = hasDoor ? 11 : 0;
      const room = cw - dw - 6;
      const nw = Math.max(1, Math.floor(room / 13));
      const gap = (room - nw * 10) / (nw + 1);
      for (let k = 0; k < nw; k++) {
        const wx = Math.trunc(cx + 3 + gap + k * (10 + gap));
        window_(s, wx, wallTop + 1, 10, 8, r, 30 + k * 2, { z: 3, kind: k % 3 });
        s.use(50 + k, 3.8);
        s.rect(W_[1], wx - 1, wallTop + 10, 12, 2);
        s.hl(W_[3], wx - 1, wallTop + 11, 12);
        for (let q = wx; q < wx + 10; q += 2) {
          const cc = R[r.pick(['tulip', 'yellow', 'dred', 'cloth'])];
          s.px(cc[1], q, wallTop + 9);
          s.px(cc[0], q + 1, wallTop + 9);
          s.px(R.leaf[1], q, wallTop + 10);
        }
      }
      if (hasDoor) {
        s.use(58, 3);
        const dx = cx + cw - dw - 1;
        s.rect(R.white[1], dx - 1, wallTop, 9, wh);
        s.hl(R.white[0], dx - 1, wallTop, 9);
        s.vl(R.white[0], dx + 7, wallTop, wh);
        const dc = R[['dgreen', 'navy', 'dred'][(i >> 1) % 3]];
        s.rect(dc[1], dx, wallTop + 1, 7, wh - 1);
        s.vl(dc[0], dx + 6, wallTop + 1, wh - 1);
        s.vl(dc[2], dx, wallTop + 1, wh - 1);
        s.rect(R.glass[2], dx + 2, wallTop + 2, 3, 3);
        s.px(R.glass[0], dx + 4, wallTop + 2);
        s.px(R.brass[0], dx + 1, wallTop + 6);
      }

      // The lifebuoy.
      if (i % 3 === 0) {
        s.use(70, 3.5);
        const lx = cx + cw - 5;
        const ly = wallTop + 6;
        s.ell(R.dred[1], lx, ly, 3, 3);
        s.px(R.white[0], lx, ly - 3);
        s.px(R.white[0], lx, ly + 3);
        s.px(R.white[0], lx + 3, ly);
        s.px(R.white[0], lx - 3, ly);
        s.rect(wb, lx - 1, ly - 1, 2, 2);
      }

      // The roof: a slab, seen from above, a little wider than the cabin.
      const [ra, rb, rc, rd] = R[ROOFS[i]];
      s.use(6, 4);
      s.poly(rb, [
        [cx - 3, ry + 1],
        [cx + 3, ry - 4],
        [cx + cw + side + 3, ry - 4],
        [cx + cw + 3, ry + 1],
      ]);
      s.hl(ra, cx + 3, ry - 4, cw + side);
      for (let j = ry - 2; j < ry + 1; j += 2) {
        for (let q = cx + 2 + (j % 4); q < cx + cw + 2; q += 8) {
          s.hl(rc, q, j, 4);
          if (q > cx + cw / 2) s.px(ra, q + 5, j);
        }
      }
      s.rect(rd, cx - 3, ry + 1, cw + 6, 1);
      s.hl(rc, cx - 3, ry + 2, cw + 6);
      s.hl(ra, cx + Math.trunc(cw * 0.6), ry + 2, Math.trunc(cw * 0.4));

      // What stands on the roof, a little behind its front edge.
      const roofBack = ry - 4;
      const plants = (px0: number, px1: number, seedN: number): void => {
        s.use(80 + seedN, 3.6);
        const rp = rngf(1000 + i * 7 + seedN);
        for (let q = px0; q < px1; q += 5) {
          const n = rp.int(6, 12);
          for (let k = 0; k < n; k++) {
            const xx = q + rp.int(-4, 4);
            const yy = roofBack - rp.int(0, 7);
            const l = (xx - q) * 0.1 + (roofBack - yy) * 0.16;
            const tone = l > 0.8 ? R.leaf[0] : l > 0.3 ? R.leaf[1] : R.leaf[2];
            for (const [dx, dy] of STAMPS[rp.int(0, 5)]) s.px(tone, xx + dx, yy + dy);
          }
        }
        s.use(79 + seedN, 3.8);
        const pots = R.bricko;
        for (let q = px0 - 2; q < px1; q += 10) {
          s.rect(pots[1], q, roofBack - 1, 6, 3);
          s.hl(pots[0], q, roofBack - 1, 6);
          s.hl(pots[3], q, roofBack + 1, 6);
        }
      };
      const chimney = (cxx: number): void => {
        s.use(90, 3.4);
        tube(s, 'iron', cxx, roofBack - 15, 5, 16);
        s.rect(R.iron[2], cxx - 1, roofBack - 16, 7, 2);
        s.hl(R.iron[0], cxx, roofBack - 16, 6);
      };
      const panel = (px: number): void => {
        s.use(91, 3.4);
        const g = R.navy;
        s.poly(g[2], [
          [px, roofBack + 1],
          [px + 4, roofBack - 6],
          [px + 20, roofBack - 6],
          [px + 16, roofBack + 1],
        ]);
        for (let q = px + 5; q < px + 20; q += 5) s.line(g[3], q, roofBack - 6, q - 4, roofBack + 1);
        s.hl(g[0], px + 4, roofBack - 6, 16);
        s.hl(g[3], px, roofBack + 1, 17);
      };
      const hatch = (px: number): void => {
        s.use(92, 3.4);
        s.rect(W_[1], px, roofBack - 2, 12, 3);
        s.hl(W_[0], px, roofBack - 2, 12);
        s.hl(W_[3], px, roofBack + 1, 12);
        s.rect(R.glass[2], px + 2, roofBack - 1, 8, 1);
        s.px(R.glass[0], px + 8, roofBack - 1);
      };
      const antenna = (px: number): void => {
        s.use(93, 3.3);
        s.vl(R.pole[1], px, roofBack - 24, 25);
        for (const yy of [roofBack - 22, roofBack - 19, roofBack - 16]) s.hl(R.pole[1], px - 2, yy, 5);
        s.px(R.pole[0], px, roofBack - 25);
      };
      switch (i % 6) {
        case 0:
          plants(cx + 4, cx + 24, 0);
          chimney(cx + cw - 10);
          break;
        case 1:
          chimney(cx + 6);
          panel(cx + 16);
          antenna(cx + cw - 4);
          break;
        case 2:
          plants(cx + cw - 30, cx + cw - 6, 0);
          chimney(cx + 8);
          break;
        case 3:
          hatch(cx + 6);
          chimney(cx + cw - 12);
          plants(cx + 24, cx + 34, 1);
          break;
        case 4:
          panel(cx + 4);
          plants(cx + cw - 16, cx + cw - 4, 0);
          break;
        default:
          plants(cx + 4, cx + 34, 0);
          chimney(cx + 38);
          antenna(cx + cw - 8);
          break;
      }

      // What stands on the deck, at the bow and the stern. Low: it reads as a deck, not as a step.
      const deckFar = yd - 3;
      const barrel = (x: number): void => {
        s.use(100, 2.6);
        s.rect(W_[1], x, deckFar - 7, 6, 8);
        s.vl(W_[0], x + 4, deckFar - 7, 8);
        s.vl(W_[2], x, deckFar - 7, 8);
        s.hl(R.iron[1], x, deckFar - 5, 6);
        s.hl(R.iron[1], x, deckFar - 1, 6);
      };
      const pots = (x: number): void => {
        for (let k = 0; k < 2; k++) {
          s.use(101 + k, 2.6);
          const c = R.bricko;
          const px = x + k * 7;
          s.rect(c[1], px, deckFar - 3, 5, 4);
          s.hl(c[0], px, deckFar - 3, 5);
          s.hl(c[3], px, deckFar, 5);
          const tone = R[['tulip', 'yellow'][k]];
          s.rect(R.leaf[2], px, deckFar - 6, 5, 3);
          s.px(tone[0], px + 1, deckFar - 7);
          s.px(tone[1], px + 3, deckFar - 6);
          s.px(R.leaf[0], px + 4, deckFar - 5);
        }
      };
      const stern = i % 3;
      if (stern === 0) barrel(x0 + 4);
      else if (stern === 1) pots(x0 + 4);
      else {
        // A flag on the stern staff.
        s.use(103, 2.6);
        s.vl(R.pole[1], x0 + 5, deckFar - 18, 19);
        s.rect(R.dred[1], x0 + 6, deckFar - 18, 8, 2);
        s.rect(R.white[0], x0 + 6, deckFar - 16, 8, 2);
        s.rect(R.navy[1], x0 + 6, deckFar - 14, 8, 2);
      }
      if (x1 - (cx + cw + side) > 10) {
        if (i % 2) barrel(x1 - 11);
        else pots(x1 - 18);
      }

      // Tyres as fenders on the hull.
      s.use(110, 3);
      for (let x = x0 + 14; x < x1 - 10; x += 30) {
        s.ell(R.hull[3], x, yd + 9, 3, 3);
        s.ell(R.hull[1], x, yd + 9, 1.5, 1.5);
        s.px(R.hull[0], x + 2, yd + 7);
      }
      const o = addMargin(s);
      o.finish();
      if (float) {
        // No water in front of this one: its foot ends in a hard line of crests, not in an outline.
        const [w0, w1, , w3] = R.water;
        for (let x = 0; x < o.w; x++) {
          const a = (o.h - 1) * o.w + x;
          if (o.c[a] > 0) o.c[a] = x % 7 < 2 ? w0 : w1;
          const b2 = (o.h - 2) * o.w + x;
          if (o.c[b2] > 0 && x % 5 === 0) o.c[b2] = w3;
        }
      }
      return o;
    },
    { anchor: 'tl' },
  );
  return { x: b.x0 - left - 1, y: top - 1, id: cid };
}

export const C_LOW_BOATS: readonly LowBoat[] = C_BOATS.map((b, i) => lowBoatArt(b, i, ROOF_Y, DECK_Y, `c/boat-${i}`));

// ------------------------------------------------------------------------------- section c: the shop row

interface ShopRow {
  w: number;
  st: number;
  mat: string;
  gable: GableKind;
  seed: number;
  label?: string;
  kind?: 'bike' | 'coffee' | 'book' | 'cheese' | 'flower' | 'music' | 'bakery';
  side?: number;
}

const SH = 21;
const WW = 11;
const WH = 14;
const GR = 34;
const GH = 22;

/** The world's shop quay on the back plane, from left to right. Fourteen houses, none twice. */
const SHOPS: readonly ShopRow[] = [
  { w: 66, st: 3, mat: 'plastc', gable: 'step', seed: 1403, label: 'FIETSEN', kind: 'bike' },
  { w: 58, st: 4, mat: 'brickr', gable: 'bell', seed: 1412 },
  { w: 72, st: 3, mat: 'brickb', gable: 'neck', seed: 1422, label: 'KOFFIE', kind: 'coffee' },
  { w: 52, st: 3, mat: 'plastg', gable: 'spout', seed: 1436 },
  { w: 76, st: 3, mat: 'bricko', gable: 'flat', seed: 1445, label: 'BOEKEN', kind: 'book' },
  { w: 62, st: 4, mat: 'brickd', gable: 'neck', seed: 1458 },
  { w: 70, st: 3, mat: 'plastw', gable: 'bell', seed: 1464, label: 'KAAS', kind: 'cheese' },
  { w: 56, st: 3, mat: 'brickn', gable: 'step', seed: 1477 },
  { w: 74, st: 3, mat: 'plastp', gable: 'spout', seed: 1485, label: 'BLOEMEN', kind: 'flower' },
  { w: 60, st: 4, mat: 'brickr', gable: 'flat', seed: 1493 },
  { w: 68, st: 3, mat: 'brickb', gable: 'bell', seed: 1506, label: 'BAKKER', kind: 'bakery' },
  { w: 54, st: 4, mat: 'plastc', gable: 'neck', seed: 1518 },
  { w: 72, st: 3, mat: 'brickd', gable: 'step', seed: 1524, label: 'PLATEN', kind: 'music' },
  { w: 60, st: 3, mat: 'bricko', gable: 'flat', seed: 1534, side: 14 },
];

export const SHOP_FOOT = B0 + 1;

/** The band x (from the row's left end) where each house starts. */
function shopXs(): number[] {
  const xs: number[] = [];
  let x = 0;
  for (const h of SHOPS) {
    xs.push(x);
    x += h.w;
  }
  return xs;
}

/** The row's width: the row is one long drawing. */
export const SHOP_ROW_W = SHOPS.reduce((n, h) => n + h.w + (h.side ?? 0), 0) + 4;
export const SHOP_ROW_TOP = 10;

/** Top-left of window (i, j) of house k, in the row's own x and in rows (for a waver in that window). */
export function shopWindow(k: number, i: number, j: number): readonly [number, number] {
  const h = SHOPS[k];
  const n = Math.max(1, Math.floor((h.w - 4) / (WW + 4)));
  const gap = (h.w - n * WW) / (n + 1);
  const gh = h.gable === 'flat' ? 10 : GH;
  const H = gh + h.st * SH + GR;
  const wx = Math.trunc(pyRound(gap + i * (WW + gap)));
  return [shopXs()[k] + 2 + wx, SHOP_FOOT - H + gh + 5 + j * SH];
}

function goods(s: S, kind: NonNullable<ShopRow['kind']>, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rngf(seed);
  const by = y + h;
  if (kind === 'book') {
    let q = x + 1;
    for (const shelf of [y + 7, by - 1]) {
      q = x + 1;
      s.hl(R.wood[1], x, shelf, w);
      while (q < x + w - 2) {
        const c = R[r.pick(['dred', 'navy', 'dgreen', 'bricko', 'tulip', 'yellow'])];
        const bh = r.int(4, 7);
        const bw = r.int(2, 3);
        s.rect(c[1], q, shelf - bh, bw, bh);
        s.px(c[0], q + bw - 1, shelf - bh);
        q += bw + (r.random() < 0.2 ? 1 : 0);
      }
    }
  } else if (kind === 'coffee') {
    s.rect(R.wood[1], x, by - 2, w, 2);
    s.hl(R.wood[0], x, by - 2, w);
    for (let q = x + 2; q < x + w - 5; q += 8) {
      s.rect(R.white[0], q, by - 6, 4, 4);
      s.px(R.white[1], q, by - 3);
      s.px(R.white[1], q + 4, by - 5);
      s.hl(R.bark[2], q, by - 6, 4);
    }
    for (let q = x + 3; q < x + w - 6; q += 12) {
      s.rect(R.bark[2], q, y + 3, 6, 7);
      s.hl(R.bark[1], q, y + 3, 6);
      s.vl(R.bark[0], q + 5, y + 3, 7);
      s.rect(R.yellow[1], q + 2, y + 6, 2, 2);
    }
  } else if (kind === 'cheese') {
    s.rect(R.wood[1], x, by - 2, w, 2);
    s.hl(R.wood[0], x, by - 2, w);
    for (let q = x + 5; q < x + w - 4; q += 11) {
      s.ell(R.yellow[1], q, by - 7, 5, 4);
      s.ell(R.yellow[0], q + 1, by - 8, 2, 1);
      s.hl(R.yellow[2], q - 3, by - 4, 7);
    }
    for (let q = x + 8; q < x + w - 6; q += 11) {
      s.ell(R.yellow[1], q, by - 14, 4, 3);
      s.ell(R.yellow[0], q + 1, by - 15, 2, 1);
      s.hl(R.yellow[2], q - 2, by - 12, 5);
    }
  } else if (kind === 'bike') {
    for (let q = x + 7; q < x + w - 5; q += 16) {
      for (const dx of [-5, 5]) {
        s.ell(K, q + dx, by - 5, 4, 4);
        s.ell(R.glass[2], q + dx, by - 5, 3, 3);
        s.px(R.pole[1], q + dx, by - 5);
      }
      const c = R[r.pick(['dred', 'navy', 'dgreen'])];
      s.line(c[1], q - 5, by - 5, q, by - 9);
      s.line(c[1], q, by - 9, q + 5, by - 5);
      s.line(c[1], q, by - 9, q - 1, by - 5);
    }
  } else if (kind === 'flower') {
    for (let q = x + 2; q < x + w - 4; q += 6) {
      s.rect(R.iron[2], q, by - 5, 5, 5);
      s.hl(R.iron[0], q, by - 5, 5);
      for (let k = 0; k < 7; k++) {
        const c = R[r.pick(['tulip', 'yellow', 'dred', 'white'])];
        s.px(c[k % 2], q + r.int(0, 4), by - 6 - r.int(0, 5));
        s.px(R.leaf[r.int(0, 2)], q + r.int(0, 4), by - 6 - r.int(0, 4));
      }
    }
  } else if (kind === 'music') {
    for (let q = x + 2; q < x + w - 8; q += 11) {
      for (const yy of [y + 2, y + 12]) {
        if (yy + 9 > by) continue;
        const c = R[r.pick(['dred', 'navy', 'bricko', 'plastg'])];
        s.rect(c[1], q, yy, 9, 9);
        s.hl(c[0], q, yy, 9);
        s.ell(K, q + 4, yy + 4, 3, 3);
        s.px(R.yellow[1], q + 4, yy + 4);
      }
    }
  } else {
    s.rect(R.wood[1], x, by - 2, w, 2);
    s.hl(R.wood[0], x, by - 2, w);
    for (let q = x + 2; q < x + w - 6; q += 9) {
      s.ell(R.bricko[1], q + 3, by - 5, 3, 2);
      s.hl(R.bricko[0], q + 2, by - 6, 3);
      s.hl(R.bricko[3], q, by - 3, 7);
    }
    for (let q = x + 5; q < x + w - 7; q += 12) {
      s.rect(R.bricko[1], q, y + 3, 7, 4);
      s.hl(R.bricko[0], q + 1, y + 3, 5);
      s.hl(R.bricko[3], q, y + 6, 7);
    }
  }
}

/** A shop floor over the house's ground floor: fascia and letters, awning, display window, door, stall riser. */
function shopFront(s: S, o: ShopRow, x: number, floorTop: number, bot: number, seed: number): void {
  const w = o.w;
  const r = rngf(seed);
  const col = R[['navy', 'dgreen', 'dred', 'hull', 'bark', 'iron', 'navy'][seed % 7]];
  const [c0, c1, c2, c3] = col;
  const [s0, s1, s2, s3] = R.stone;
  // The fascia.
  s.use(300, 5);
  s.rect(c1, x, floorTop, w, 9);
  s.hl(c0, x, floorTop, w);
  s.hl(c3, x, floorTop + 8, w);
  s.vl(c0, x + w - 1, floorTop, 9);
  s.vl(c2, x, floorTop, 9);
  const label = o.label ?? '';
  text(s, label, x + ((w - textW(label)) >> 1), floorTop + 2, R.yellow[0]);
  // The riser.
  s.use(301, 4.6);
  s.rect(s1, x, bot - 5, w, 5);
  s.hl(s0, x, bot - 5, w);
  s.hl(s3, x, bot - 1, w);
  for (let q = x + 4; q < x + w; q += 7) s.vl(s2, q, bot - 4, 3);
  // The display window, the door at one end.
  const dw = 11;
  const doorLeft = seed % 2 === 0;
  const dx = doorLeft ? x + 3 : x + w - dw - 3;
  const gx = doorLeft ? dx + dw + 2 : x + 3;
  const gw = w - dw - 8;
  const gy = floorTop + 10;
  const gh = bot - 5 - gy;
  s.use(302, 4.7);
  s.rect(R.white[1], gx - 1, gy - 1, gw + 2, gh + 2);
  s.hl(R.white[0], gx - 1, gy - 1, gw + 2);
  s.vl(R.white[0], gx + gw, gy - 1, gh + 2);
  s.vl(R.white[2], gx - 1, gy, gh + 1);
  s.use(303, 4.8);
  s.rect(R.glass[2], gx, gy, gw, gh);
  s.hl(R.glass[3], gx, gy, gw);
  s.vl(R.glass[3], gx, gy, gh);
  s.marks.push(['win', gx - 1, gy - 1, gw + 2, gh + 2]);
  if (o.kind) goods(s, o.kind, gx + 1, gy + 1, gw - 2, gh - 2, seed);
  // The low sun in the glass: one slanted bright cluster.
  s.use(304, 4.9);
  for (let j = 0; j < 7; j++) {
    const xx = gx + gw - 3 - (j >> 1);
    if (gy + 1 + j < gy + gh) {
      s.px(R.glass[0], xx, gy + 1 + j);
      s.px(R.glass[1], xx - 1, gy + 1 + j);
    }
  }
  door(s, dx, gy, dw - 2, bot - 5 - gy + 1, ['dgreen', 'dred', 'navy', 'bricko'][seed % 4], r, 310, 4.8, 0);
  // The awning on some shops: cloth in hard stripes, a hem that throws a hard shade.
  if (seed % 3 !== 0) {
    const cl = [
      ['dred', 'white'],
      ['dgreen', 'white'],
      ['navy', 'yellow'],
    ][seed % 3];
    s.use(320, 5.5);
    for (let i = 0; i < gw + 2; i++) {
      const c = R[cl[Math.floor(i / 5) % 2]];
      const ax = gx - 1 + i;
      s.vl(i % 5 >= 2 ? c[0] : c[1], ax, gy - 1, 5);
      s.vl(c[2], ax, gy + 4, 1);
      if (i % 5 === 2) s.px(c[1], ax, gy + 5);
    }
  }
  s.use(1, 1);
}

/** The shop row: one long drawing with its foot under the far pavement's edge. */
export const SHOP_ROW = defineBand({
  light: L,
  name: 'c/shop-row',
  speed: S_BACK,
  rows: [SHOP_ROW_TOP, SHOP_FOOT],
  width: SHOP_ROW_W,
  paint: () => {
    const s = new S(SHOP_ROW_W, VH);
    const xs = shopXs();
    SHOPS.forEach((h, k) => {
      const r = rngf(h.seed);
      const mat = kitTier() >= 2 ? VARIANTS[h.mat][r.int(0, 5)] : h.mat;
      const hs = house(h.w, h.st, mat, h.gable, h.seed, {
        sh: SH,
        ww: WW,
        wh: WH,
        gr: GR,
        gh: GH,
        side: h.side ?? 0,
        plastered: h.mat.startsWith('plast'),
        doorm: ['dgreen', 'dred', 'navy'][k % 3],
        outline: KM,
        ground: h.kind ? 'none' : 'door',
      });
      s.paste(hs, xs[k] + 1, SHOP_FOOT - hs.h + 1);
      if (h.kind) shopFront(s, h, xs[k] + 2, SHOP_FOOT - GR, SHOP_FOOT, h.seed);
    });
    return s;
  },
});

// ------------------------------------------------------------------------------- wavers in the windows

/** A little figure in a window of the row, at the row's speed: the shared waver cannot move with a facade. */
export function waverFrames(): S[] {
    const blank = (): S => new S(WW, WH);
    const fig = (armUp: number, sink: number, hair: string, shirt: string): S => {
      const s = blank();
      const [sk0, sk1, sk2] = R.skin;
      const sh_ = R[shirt];
      const hr = R[hair];
      const y = 3 + sink;
      s.use(1, 1);
      s.rect(sh_[1], 2, y + 5, 7, WH - y - 6);
      s.vl(sh_[0], 8, y + 5, WH - y - 6);
      s.vl(sh_[2], 2, y + 5, WH - y - 6);
      s.use(2, 2);
      s.rect(sk1, 3, y, 5, 5);
      s.vl(sk0, 7, y + 1, 3);
      s.vl(sk2, 3, y + 1, 3);
      s.hl(hr[1], 3, y - 1, 5);
      s.hl(hr[2], 3, y, 2);
      s.px(hr[0], 7, y - 1);
      s.px(K, 4, y + 2);
      s.px(K, 6, y + 2);
      if (armUp > 0) {
        s.use(3, 3);
        const ax = armUp === 1 ? 9 : armUp === 2 ? 10 : 8;
        s.vl(sk1, ax, y - 3, 7);
        s.px(sk0, ax, y - 4);
      }
      // Keep the figure inside the glass: the window's frame stays.
      for (let j = 0; j < s.h; j++) {
        for (let i = 0; i < s.w; i++) {
          if (i === 0 || i === s.w - 1 || j === 0 || j === s.h - 1) s.c[j * s.w + i] = 0;
        }
      }
      return s;
    };
    const empty = blank();
    const low = fig(0, 4, 'bark', 'plastp');
    const idle = fig(0, 0, 'bark', 'plastp');
    const a = fig(1, 0, 'bark', 'plastp');
    const b = fig(2, 0, 'bark', 'plastp');
    return [empty, empty, empty, empty, empty, empty, empty, empty, low, idle, idle, a, b, a, b, a, b, a, idle, low];
}
export const WAVER = defineArt(L, 'c/waver', waverFrames, { anchor: 'tl' });

/** A cat on a sill: its tail swishes. */
export function catFrames(): S[] {
  return [0, 1, 2, 1].map((f) => {
      const s = new S(WW, WH);
      const [a, b, c] = R.hull;
      s.use(1, 1);
      s.rect(b, 2, 8, 6, 5);
      s.rect(b, 3, 5, 4, 3);
      s.px(b, 3, 4);
      s.px(b, 6, 4);
      s.vl(a, 7, 8, 4);
      s.px(R.yellow[1], 4, 6);
      s.px(R.yellow[1], 6, 6);
      s.use(2, 2);
      s.line(c, 8, 12, 9, 12 - f * 3);
      return s;
    });
}
export const CAT = defineArt(L, 'c/cat', catFrames, { anchor: 'tl' });

// ------------------------------------------------------------------------------- the breakables' twins

function wreckPlanks(s: S, x0: number, x1: number, y: number): void {
  const [a, b, c] = R.wood;
  s.use(9, 2);
  for (let q = x0; q < x1; q += 7) {
    s.line(b, q, y, q + 5, y - 3 - (q % 3));
    s.line(c, q, y + 1, q + 5, y - 2 - (q % 3));
    s.px(a, q + 5, y - 3 - (q % 3));
  }
}

/** The twin of `decor/ams/ams-herring-cart` (frame 0 whole, frame 1 wrecked, bottom centre; hitbox 46 × 36). */
export const HERRING_TWIN = defineArt(
  L,
  'c/herring-cart',
  () => {
    const whole = new S(54, 46);
    const s = whole;
    const [a, b, c, d] = R.navy;
    // Wheels.
    for (const x of [13, 39]) {
      s.use(1, 1);
      s.ell(R.hull[3], x, 38, 6, 6);
      s.ell(R.wood[1], x, 38, 4, 4);
      s.ell(R.hull[2], x, 38, 2, 2);
      s.px(R.wood[0], x + 2, 36);
    }
    // The cart.
    s.use(2, 2);
    s.rect(b, 4, 18, 46, 18);
    s.hl(a, 4, 18, 46);
    s.vl(a, 49, 18, 18);
    s.vl(c, 4, 18, 18);
    s.hl(d, 4, 35, 46);
    s.hl(R.white[0], 5, 21, 44);
    s.hl(R.white[0], 5, 32, 44);
    text(s, 'HARING', 15, 24, R.white[0]);
    // The Dutch flag on the side.
    s.use(3, 3);
    s.rect(R.dred[1], 7, 23, 6, 2);
    s.rect(R.white[0], 7, 25, 6, 2);
    s.rect(R.navy[2], 7, 27, 6, 2);
    // The counter with fish on ice.
    s.use(4, 2.5);
    s.rect(R.white[1], 2, 14, 50, 4);
    s.hl(R.white[0], 2, 14, 50);
    s.hl(R.white[2], 2, 17, 50);
    for (let q = 7; q < 46; q += 8) {
      s.rect(R.brickn[0], q, 12, 6, 2);
      s.hl(R.white[0], q + 1, 12, 4);
      s.px(R.brickn[2], q, 13);
      s.px(R.dred[1], q + 3, 13);
    }
    // Two poles and the striped roof.
    s.use(5, 2.2);
    for (const x of [6, 46]) tube(s, 'pole', x, 7, 2, 7);
    s.use(6, 4);
    for (let i = 0; i < 54; i++) {
      const cc = R[Math.floor(i / 6) % 2 ? 'navy' : 'white'];
      s.vl(i % 6 >= 2 ? cc[0] : cc[1], i, 0, 7);
      s.px(cc[2], i, 7);
    }
    whole.finish();
    const w2 = addMargin(whole);
    const wreck = new S(56, 48);
    const k = wreck;
    k.use(1, 1);
    k.ell(R.hull[3], 40, 41, 6, 6);
    k.ell(R.wood[1], 40, 41, 4, 4);
    k.use(2, 2);
    k.poly(c, [
      [4, 47],
      [10, 32],
      [34, 36],
      [36, 47],
    ]);
    k.line(a, 10, 32, 34, 36);
    k.hl(R.white[1], 8, 40, 22);
    wreckPlanks(k, 30, 52, 45);
    k.use(3, 3);
    k.rect(R.brickn[0], 16, 44, 6, 2);
    k.px(R.white[0], 17, 44);
    k.rect(R.brickn[0], 42, 45, 6, 2);
    k.finish();
    return [w2, wreck];
  },
  { anchor: 'bc' },
);

/** The twin of `decor/ams/ams-market-stall` (frame 0 whole, frame 1 wrecked, bottom centre; hitbox 54 × 36). */
export const MARKET_TWIN = defineArt(
  L,
  'c/market-stall',
  () => {
    const whole = new S(58, 52);
    const { box } = stall(50, 907, ['navy', 'white']);
    whole.paste(box, 0, 52 - box.h);
    const wreck = new S(58, 52);
    const k = wreck;
    k.use(1, 1);
    const [a, b, c] = R.wood;
    k.poly(b, [
      [8, 51],
      [14, 40],
      [36, 44],
      [38, 51],
    ]);
    k.line(a, 14, 40, 36, 44);
    wreckPlanks(k, 34, 54, 49);
    k.use(2, 2);
    k.poly(R.navy[1], [
      [2, 44],
      [22, 34],
      [28, 38],
      [8, 48],
    ]);
    k.line(R.white[0], 6, 45, 24, 35);
    k.line(R.white[0], 10, 47, 27, 38);
    k.use(3, 3);
    k.rect(R.brass[1], 42, 46, 4, 4);
    k.px(R.brass[0], 45, 46);
    k.rect(c, 46, 49, 6, 2);
    k.finish();
    return [whole, wreck];
  },
  { anchor: 'bc' },
);

/**
 * The twin of the secret `decor/ams/secret-canal-bike` (3 frames: hidden, the weed tips out, empty;
 * 26 × 19, the feet in the middle of the box): a rusty bike with weed in its basket.
 */
export const CANAL_BIKE_TWIN = defineArt(
  L,
  'c/canal-bike',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(26, 19);
      const [a, b, c] = R.bark;
      const [m0, m1, m2] = R.moss;
      s.use(1, 1);
      for (const x of [6, 20]) {
        s.ell(c, x, 13, 5, 5);
        s.ell(0, x, 13, 3, 3);
        for (let j = 9; j < 18; j++) for (let i = x - 3; i <= x + 3; i++) if ((i - x) ** 2 + (j - 13) ** 2 <= 9) s.c[j * 26 + i] = 0;
      }
      s.use(2, 2);
      s.line(b, 6, 13, 12, 7);
      s.line(b, 12, 7, 20, 7);
      s.line(b, 12, 7, 13, 13);
      s.line(b, 13, 13, 20, 7);
      s.line(a, 20, 7, 20, 13);
      s.line(b, 6, 13, 13, 13);
      s.hl(a, 9, 5, 5);
      s.vl(c, 11, 5, 2);
      s.hl(c, 18, 4, 5);
      s.vl(b, 20, 4, 3);
      // The basket with the weed.
      s.use(3, 3);
      s.rect(c, 20, 5, 5, 4);
      s.hl(a, 20, 5, 5);
      if (f < 2) {
        const dy = f === 0 ? 0 : 3;
        s.rect(m1, 20, 2 + dy, 5, 3);
        s.px(m0, 22, 2 + dy);
        s.px(m0, 24, 3 + dy);
        s.px(m2, 20, 4 + dy);
        s.vl(m2, 24, 5 + dy, 5);
        s.vl(m1, 21, 5 + dy, 3);
      }
      // Rust.
      s.use(4, 4);
      s.px(R.bricko[2], 8, 11);
      s.px(R.bricko[2], 16, 7);
      s.px(R.bricko[1], 13, 11);
      s.finish();
      return s;
    }),
  { anchor: 'bc' },
);

// ------------------------------------------------------------------------------- the jetty's small life

/** A coil of rope on the planks. */
export const ROPE = defineArt(L, 'c/rope', () => {
  const s = new S(18, 7);
  const [a, b, c] = R.cloth;
  s.use(1, 1);
  s.ell(c, 9, 4, 8, 3);
  s.ell(b, 9, 3, 7, 2);
  s.ell(c, 9, 3, 3, 1);
  s.hl(a, 10, 1, 5);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** An arena's parking sign, seen from the street. */
export const PARK_SIGN = defineArt(L, 'c/park-sign', () => {
  const s = new S(14, 44);
  s.use(1, 1);
  tube(s, 'pole', 5, 12, 3, 32);
  s.use(2, 2);
  const [n0, n1, n2, n3] = R.blue;
  s.rect(n1, 0, 0, 13, 13);
  s.hl(n0, 0, 0, 13);
  s.vl(n0, 12, 0, 13);
  s.hl(n3, 0, 12, 13);
  s.vl(n2, 0, 0, 13);
  s.use(3, 3);
  s.grid(['aaaa.', 'a...a', 'a...a', 'aaaa.', 'a....', 'a....', 'a....'], 4, 3, { a: R.white[0] });
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A parking meter. */
export const METER = defineArt(L, 'c/meter', () => {
  const s = new S(10, 28);
  s.use(1, 1);
  tube(s, 'pole', 3, 10, 3, 18);
  s.use(2, 2);
  const [a, b, c, d] = R.hull;
  s.rect(b, 0, 0, 9, 11);
  s.hl(a, 0, 0, 9);
  s.vl(a, 8, 0, 11);
  s.hl(d, 0, 10, 9);
  s.vl(c, 0, 0, 11);
  s.rect(R.glass[1], 2, 2, 5, 3);
  s.px(R.glass[0], 5, 2);
  s.rect(R.yellow[1], 2, 6, 5, 2);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A line of a parking bay on the cobbles (speed 1, under the figures): pale setts with a dark edge, as if laid in the street. */
export const BAY_MARK = defineArt(
  L,
  'c/bay-mark',
  () => {
    const s = new S(14, 20);
    const [a, b, c, d] = R.stone;
    for (let j = 0; j < 4; j++) {
      const x = 1 + j;
      const y = 1 + j * 5;
      const w = 8;
      s.use(1, 1);
      s.rect(K, x - 1, y - 1, w + 2, 5);
      s.use(2, 2);
      s.rect(b, x, y, w, 3);
      s.hl(a, x, y, w);
      s.vl(a, x + w - 1, y, 3);
      s.hl(c, x, y + 2, w);
      s.px(d, x, y + 2);
    }
    return s;
  },
  { anchor: 'tl' },
);

// ------------------------------------------------------------------------------- the crate's twins

const CRATE_SWAN: readonly string[] = ['......##.', '......###', '.....##..', '#....#...', '##..##...', '#######..', '.#####...'];

/** The supply crate in the low sun: planks, a lit lid, rope bands, the swan; 22 × 18 with no squash. */
function supplyCrate(squash: number, cracks: boolean): S {
  const w = 22 + squash;
  const h = 18 - squash;
  const s = new S(w, h);
  const [a, b, c, d] = R.wood;
  const [r0, r1, r2] = R.cloth;
  s.use(1, 1);
  s.rect(b, 0, 3, w, h - 3);
  for (let y = 7; y < h - 1; y += 5) {
    s.hl(c, 2, y, w - 4);
    s.hl(d, 2, y + 1, 5);
    s.hl(d, w - 7, y + 1, 5);
  }
  s.hl(d, 0, h - 1, w);
  // The lid and the corner boards: lit on the right, shade on the left.
  s.use(2, 2);
  s.rect(a, 0, 0, w, 3);
  s.hl(b, 0, 2, w);
  for (let q = 5; q < w - 2; q += 7) s.vl(b, q, 0, 2);
  s.hl(c, 0, 3, w);
  s.rect(c, 0, 3, 2, h - 3);
  s.vl(d, 0, 3, h - 3);
  s.rect(a, w - 2, 3, 2, h - 3);
  // The swan.
  s.use(3, 2.5);
  s.grid(CRATE_SWAN, (w - 9) >> 1, 5 + (h > 14 ? 1 : 0), { '#': R.white[0] });
  // The rope bands.
  s.use(4, 3);
  for (const x of [3, w - 5]) {
    for (let y = 0; y < h; y++) {
      s.px((y >> 1) & 1 ? r0 : r1, x, y);
      s.px((y >> 1) & 1 ? r1 : r2, x + 1, y);
    }
  }
  if (cracks) {
    s.use(5, 3.5);
    s.line(d, 6, 0, 10, h - 1);
    s.line(d, 16, 2, 13, h - 3);
    s.line(R.hull[3], 1, 8, w - 2, 11);
  }
  const o = addMargin(s);
  o.finish();
  return o;
}

/** The twin of `item/crate` (one frame, bottom centre). */
export const CRATE_TWIN = defineArt(L, 'river/crate-twin', () => supplyCrate(0, false), { anchor: 'bc' });
/** The twin of `item/crate-hit` (it squashes, it recovers). */
export const CRATE_HIT_TWIN = defineArt(L, 'river/crate-hit-twin', () => [supplyCrate(2, false), supplyCrate(0, false)], { anchor: 'bc' });

/** The planks of the shared break frames: [x, y from the bottom centre, length, upright]. */
const CRATE_PLANKS: ReadonlyArray<ReadonlyArray<readonly [number, number, number, boolean]>> = [
  [[-15, -24, 13, false], [-2, -28, 11, false], [-17, -16, 10, true], [10, -17, 10, true], [-9, -10, 15, false], [4, -21, 7, false]],
  [[-21, -27, 13, false], [-1, -33, 11, false], [-23, -13, 10, true], [15, -13, 10, true], [-10, -7, 15, false], [9, -25, 7, false]],
  [[-24, -5, 13, false], [-7, -6, 11, false], [-26, -9, 10, true], [17, -9, 10, true], [4, -5, 15, false], [13, -5, 7, false]],
];

/** The twin of `item/crate-break`: it cracks, the planks fly. */
export const CRATE_BREAK_TWIN = defineArt(
  L,
  'river/crate-break-twin',
  () => {
    const out: S[] = [supplyCrate(1, true)];
    for (const lay of CRATE_PLANKS) {
      const s = new S(66, 42);
      const [a, b, c] = R.wood;
      lay.forEach(([x, y, len, up], i) => {
        s.use(i + 1, 1 + i * 0.1);
        const px = 33 + x;
        const py = 42 + y;
        if (up) {
          s.rect(b, px, py, 3, len);
          s.vl(a, px + 2, py, len);
          s.vl(c, px, py, len);
        } else {
          s.rect(b, px, py, len, 3);
          s.hl(a, px, py, len);
          s.hl(c, px, py + 2, len);
        }
      });
      s.finish();
      out.push(s);
    }
    return out;
  },
  { anchor: 'bc' },
);

/** The crate's three ids and their twins, for a section's overrides. */
export const CRATE_OVERRIDES: Readonly<Record<string, string>> = {
  'item/crate': CRATE_TWIN,
  'item/crate-hit': CRATE_HIT_TWIN,
  'item/crate-break': CRATE_BREAK_TWIN,
};
