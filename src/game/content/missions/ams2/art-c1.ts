/**
 * The white wooden Amstel bridge (the fork of section c and all of c1) and the Blauwbrug (c1):
 * docs/design/ams2.md §3. The bridge is a function of its deck line, from the terrain's numbers.
 */
import { addMargin, S } from '../../../art/herokit/canvas';
import { K, R } from '../../../art/herokit/palette';
import { stall, tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import type { DecorDef } from '../../../mission/index';
import { hillY } from '../ams/art';
import { C_AMSTEL, C_BASIN, C_BLAUWBRUG, C_BRIDGE_END, C_BRIDGE_Y, C_DECK_Y, C_PONTOON_Y, C_RAMP, C_RAMP_FOOT_Y, C_STEPS_X, C_W } from '../ams/terrain';
import { defineTwin, L } from './art-c';
import { B1, B2, defineArt, defineBand, G, S_WALK, VH, WATER_Y } from './stage';

const SPAN = 64;

export interface WhiteBridgeOpts {
  /** World x of the first and past-last column. */
  x0: number;
  x1: number;
  /** The deck line (a figure's feet) at world x. */
  deck: (x: number) => number;
  /** The lowest row of a pier at world x (default: in the water). */
  pierEnd?: (x: number) => number;
  /** The canvas: its column 0 is world x `cx`. */
  cx: number;
  /** World x where the spans' rhythm starts (default x0). */
  phase?: number;
  /** A closed end of the railing at the left. */
  newelLeft?: boolean;
  /** Left of this world x the bridge rests on a solid wall: no piers, no arches. */
  solidTo?: number;
  /**
   * For a drawing in layers (`defineBand` `layers`): 'piers' draws only the piers from world x `piersFrom` on,
   * 'span' all but those. A pier stands straight while the span's layer is sheared along the slope.
   */
  layer?: 'piers' | 'span';
  piersFrom?: number;
}

/** The white bridge on a canvas whose rows are world rows. The deck, the railing behind it, the girder, the arched spans, the piers. */
export function paintWhiteBridge(s: S, o: WhiteBridgeOpts): void {
  const { x0, x1, cx, deck } = o;
  const [w0, w1, w2, w3] = R.white;
  const [d0, d1, d2, d3] = R.wood;
  const [st0, st1, st2, st3] = R.stone;
  const phase = o.phase ?? x0;
  const pierEnd = o.pierEnd ?? (() => B2);
  const rail = 11;
  const piersFrom = o.piersFrom ?? -Infinity;
  // The piers, each a white post on a stone foot in the water.
  const piers = (): void => {
    for (let wx = phase; wx < x1 + SPAN; wx += SPAN) {
      if (wx < x0 - 4 || wx >= x1 + 4 || wx < (o.solidTo ?? -1)) continue;
      if (o.layer === 'piers' && wx < piersFrom) continue;
      if (o.layer === 'span' && wx >= piersFrom) continue;
      const x = wx - cx;
      const y = Math.round(deck(Math.min(x1 - 1, Math.max(x0, wx))));
      const end = pierEnd(wx);
      s.use(4, 1.5);
      tube(s, 'white', x - 3, y + 8, 7, end - y - 8);
      s.use(5, 1.6);
      const foot = Math.max(y + 16, end - 14);
      s.rect(st1, x - 5, foot, 11, end - foot);
      s.hl(st0, x - 5, foot, 11);
      s.vl(st0, x + 5, foot, end - foot);
      s.vl(st3, x - 5, foot, end - foot);
      for (let q = foot + 3; q < end; q += 4) s.hl(st2, x - 4, q, 9);
      if (end > 176) {
        s.use(6, 1.7);
        s.rect(R.moss[2], x - 5, Math.max(foot + 1, 176), 11, 2);
        s.hl(R.moss[1], x - 3, Math.max(foot + 1, 176), 6);
      }
    }
  };
  if (o.layer === 'piers') {
    piers();
    s.use(1, 1);
    return;
  }
  // The railing, behind the deck.
  s.use(1, 1);
  for (let wx = x0; wx < x1; wx++) {
    const x = wx - cx;
    const y = Math.round(deck(wx));
    s.px(w1, x, y - rail - 3);
    s.px(w0, x, y - rail - 4);
    s.px(w3, x, y - rail - 2);
    s.px(w2, x, y - 5);
    s.px(w1, x, y - 6);
  }
  s.use(2, 1.2);
  for (let wx = Math.ceil(x0 / 16) * 16; wx < x1; wx += 16) {
    const x = wx - cx;
    const y = Math.round(deck(wx));
    const y2 = Math.round(deck(Math.min(x1 - 1, wx + 16)));
    tube(s, 'white', x, y - rail - 4, 2, rail);
    // A cross in each field of the railing.
    s.line(w1, x + 2, y - rail - 2, x + 15, y2 - 7);
    s.line(w2, x + 2, y - 7, x + 15, y2 - rail - 2);
    // A bulb on every other post: the bridge's lights.
    if (Math.floor(wx / 16) % 2 === 0) {
      s.use(3, 1.4);
      s.rect(R.yellow[1], x, y - rail - 7, 2, 2);
      s.px(R.yellow[0], x + 1, y - rail - 7);
      s.px(R.yellow[2], x, y - rail - 6);
      s.use(2, 1.2);
    }
  }
  piers();
  // The girder, arched from pier to pier.
  for (let wx = x0; wx < x1; wx++) {
    const x = wx - cx;
    const y = Math.round(deck(wx));
    const u = ((wx - phase) % SPAN + SPAN) % SPAN / SPAN;
    const d = wx < (o.solidTo ?? -1) ? 0 : Math.round(13 * (2 * u - 1) ** 2);
    s.use(7, 2);
    s.rect(w1, x, y + 3, 1, 5 + d);
    s.px(w0, x, y + 3);
    s.px(w3, x, y + 6);
    s.px(w2, x, y + 7);
    if (d > 0) {
      s.px(w0, x, y + 8 + d - 1);
      s.px(w2, x, y + 8);
    }
    if (d > 3) s.rect(w2, x, y + 9, 1, d - 3);
    if (wx % 8 === 0) s.px(w3, x, y + 5);
  }
  // The deck: planks across, seen from above; a figure's feet land on its middle.
  s.use(8, 3);
  for (let wx = x0; wx < x1; wx++) {
    const x = wx - cx;
    const y = Math.round(deck(wx));
    const seam = wx % 5 === 0;
    s.rect(seam ? d2 : d1, x, y - 3, 1, 6);
    s.px(d0, x, y - 3);
    s.px(seam ? d3 : d2, x, y + 2);
    if (!seam && (wx * 7 + 3) % 11 === 0) s.px(d0, x, y - 1 + (wx % 3));
    if (!seam && (wx * 5 + 1) % 13 === 0) s.px(d2, x, y + (wx % 2));
  }
  s.use(1, 1);
}

/** The balance beams over the deck: two posts, the beam a crate hangs from, its bulbs. Its feet stand on the deck line. */
export const WHITE_PORTAL = defineArt(
  L,
  'river/white-portal',
  () => {
    const W = 76;
    const H = 76;
    const s = new S(W, H);
    const [w0, w1, w2, w3] = R.white;
    const m = W >> 1;
    // The balance beam, its counterweight ends over the posts.
    s.use(4, 3);
    s.rect(w1, 0, 2, W, 5);
    s.hl(w0, 0, 2, W);
    s.hl(w3, 0, 6, W);
    s.hl(w2, 0, 5, W);
    s.vl(w0, W - 1, 2, 5);
    s.use(5, 3.2);
    for (let x = 3; x < W - 2; x += 8) {
      s.rect(R.yellow[1], x, 0, 2, 2);
      s.px(R.yellow[0], x + 1, 0);
      s.px(R.yellow[2], x, 1);
    }
    // The second beam and the braces.
    s.use(3, 2.5);
    s.rect(w2, 5, 17, W - 10, 3);
    s.hl(w1, 5, 17, W - 10);
    s.hl(w3, 5, 19, W - 10);
    for (const [a, b] of [
      [8, 12],
      [W - 9, W - 13],
    ]) {
      s.line(w1, a, 8, m + (a < m ? -14 : 14), 16);
      s.line(w2, b, 8, m + (a < m ? -10 : 10), 16);
    }
    // The posts.
    s.use(2, 2);
    for (const x of [4, W - 10]) {
      tube(s, 'white', x, 7, 6, H - 7);
      s.rect(w2, x - 1, 28, 8, 2);
      s.hl(w0, x - 1, 28, 8);
      s.rect(w2, x - 1, 54, 8, 2);
      s.hl(w0, x - 1, 54, 8);
      s.rect(w1, x - 2, H - 6, 10, 6);
      s.hl(w0, x - 2, H - 6, 10);
      s.vl(w0, x + 7, H - 6, 6);
      s.vl(w3, x - 2, H - 6, 6);
    }
    // The hoist hook in the middle of the beam.
    s.use(6, 3.4);
    s.rect(R.iron[2], m - 1, 7, 3, 2);
    s.px(R.iron[0], m, 7);
    const o = addMargin(s);
    o.finish();
    return o;
  },
  { anchor: 'bc' },
);

// ------------------------------------------------------------------------------- the fork of section c

export const FORK_X = C_RAMP[0] - 4;
const FORK_END = C_W + 12;
const FORK_TOP = 120;

/** The deck line of the fork: the ramp's slope, then the deck. */
function forkDeck(x: number): number {
  if (x >= C_RAMP[1]) return C_DECK_Y;
  const t = (x - C_RAMP[0]) / (C_RAMP[1] - C_RAMP[0]);
  return C_RAMP_FOOT_Y + (C_DECK_Y - C_RAMP_FOOT_Y) * Math.max(0, t);
}

/** The ramp rests on a wall of stone from its foot up to the first pier behind the jetty steps. */
const RAMP_WALL_TO = C_RAMP[0] + 12 + SPAN;
/** The wall's foot on the quay: the figures' ground line. */
const RAMP_WALL_FOOT = G + 1;

function rampWall(s: S): void {
  const [a, b, c, d] = R.stone;
  const r = rngf(2451);
  for (let wx = C_RAMP[0]; wx < RAMP_WALL_TO; wx++) {
    const x = wx - FORK_X;
    const top = Math.round(forkDeck(wx)) + 6;
    s.use(30, 0.5);
    s.rect(c, x, top, 1, RAMP_WALL_FOOT - top);
    // A course of stone every five rows, each stone's joint at its own place.
    for (let y = RAMP_WALL_FOOT - 5; y > top; y -= 5) {
      s.px(d, x, y);
      const course = (y >> 1) & 7;
      if ((wx + course * 7) % 13 === 0) s.vl(d, x, y - 4 > top ? y - 4 : top, Math.min(4, y - top));
      if ((wx + course * 5) % 13 === 4) s.vl(b, x, y + 1, 2);
    }
    // The foot is in the shade, on the quay.
    s.px(d, x, RAMP_WALL_FOOT - 1);
    if (r.random() < 0.5) s.px(R.stone[3], x, RAMP_WALL_FOOT - 2);
    s.px(a, x, top);
  }
}

/** The stone post that ends the railing at the ramp's foot. */
function rampNewel(s: S): void {
  const [a, b, c, d] = R.stone;
  const x = C_RAMP[0] - FORK_X - 3;
  const y = Math.round(forkDeck(C_RAMP[0]));
  const h = RAMP_WALL_FOOT - y + 16;
  s.use(31, 4);
  s.rect(b, x, y - 16, 7, h);
  s.vl(a, x + 6, y - 16, h);
  s.vl(a, x + 5, y - 16, h);
  s.vl(c, x, y - 16, h);
  s.hl(d, x, y - 16 + h - 1, 7);
  for (let q = y - 10; q < y - 16 + h - 1; q += 6) s.hl(c, x, q, 7);
  s.rect(a, x - 1, y - 18, 9, 3);
  s.hl(R.white[0], x, y - 18, 7);
  s.hl(c, x - 1, y - 16, 9);
}

const FORK_W = FORK_END - FORK_X;
const forkOpts: WhiteBridgeOpts = {
  x0: C_RAMP[0],
  x1: FORK_END - 1,
  cx: FORK_X,
  deck: forkDeck,
  phase: C_RAMP[0] + 12,
  pierEnd: (x) => (x < C_STEPS_X ? B1 + 8 : B2),
  solidTo: RAMP_WALL_TO,
  piersFrom: C_RAMP[0],
};

export const FORK_BRIDGE = defineBand({
  light: L,
  name: 'c/fork-bridge',
  speed: S_WALK,
  rows: [FORK_TOP, B2 + 2],
  width: FORK_W,
  layers: () => {
    const under = new S(FORK_W, VH);
    rampWall(under);
    paintWhiteBridge(under, { ...forkOpts, layer: 'piers' });
    under.finish();
    const span = new S(FORK_W, VH);
    paintWhiteBridge(span, { ...forkOpts, layer: 'span', deck: () => C_DECK_Y });
    span.finish();
    const over = new S(FORK_W, VH);
    rampNewel(over);
    over.finish();
    return [{ canvas: under }, { canvas: span, shear: (x) => forkDeck(x + FORK_X) - C_DECK_Y }, { canvas: over }];
  },
});

export const FORK_STAIR_X = C_STEPS_X - 2;
export const FORK_STAIR_Y = B1;

/**
 * The jetty steps: two pale treads with dark risers that go down to the right, a rail that goes down with them,
 * no wall behind: the ramp's own wall and the water show there. Treads on the terrain's lines 182 and 188.
 * Open on the right: the lower tread runs on to the pontoon.
 */
export const FORK_STAIR = defineArt(
  L,
  'c/fork-stair',
  () => {
    const w = C_BASIN[0] - C_STEPS_X + 4;
    const h = 32;
    const s = new S(w, h);
    const [a, b, c, d] = R.stone;
    const Y = (y: number): number => y - B1;
    const low = w - 18;
    // A tread: a lit top edge, a pale top, a dark riser.
    const tread = (x0: number, x1: number, feet: number, part: number, z: number): void => {
      s.use(part, z);
      const top = Y(feet) - 3;
      s.rect(b, x0, top, x1 - x0, 5);
      s.rect(R.white[0], x0, top, x1 - x0, 1);
      s.hl(a, x0, top + 1, x1 - x0);
      s.hl(c, x0, top + 4, x1 - x0);
      s.rect(d, x0, top + 5, x1 - x0, h - top - 5);
      s.hl(K, x0, top + 5, x1 - x0);
      for (let q = x0 + 5; q < x1; q += 9) s.vl(c, q, top + 7, h - top - 7);
    };
    tread(0, low, 182, 2, 2);
    tread(low, w, 188, 3, 3);
    // The rail goes down with the treads: two posts and a sloped bar.
    s.use(5, 4);
    const railAt = (x: number): number => Y(182) - 15 + Math.round(((x - 3) * 6) / (w - 6));
    for (const [x, feet] of [
      [3, 182],
      [w - 4, 188],
    ] as const) {
      s.rect(R.iron[2], x, railAt(x), 2, Y(feet) - railAt(x));
      s.vl(R.iron[0], x + 1, railAt(x), Y(feet) - railAt(x));
    }
    for (let x = 1; x < w - 1; x++) {
      s.px(R.iron[0], x, railAt(x));
      s.px(R.iron[2], x, railAt(x) + 1);
    }
    const o = addMargin(s);
    o.finish();
    // No line between the lower tread and the pontoon.
    for (let y = Y(188) - 3 + 1; y < o.h; y++) if (o.c[y * o.w + o.w - 1] === K) o.c[y * o.w + o.w - 1] = 0;
    return o;
  },
  { anchor: 'tl' },
);

/** The steel pontoon of the tour boat: the deck's foot line on the terrain's 188, tyres on its side. */
const PONTOON_ART = defineBand({
  light: L,
  name: 'c/pontoon',
  speed: S_WALK,
  rows: [C_PONTOON_Y - 5, C_PONTOON_Y + 12],
  width: C_W + 12 - C_BASIN[0],
  paint: () => {
    const w = C_W + 12 - C_BASIN[0];
    const s = new S(w, VH);
    const y = C_PONTOON_Y;
    const [a, b, c] = R.wood;
    const [h0, h1, h2, h3] = R.hull;
    s.use(1, 1);
    s.rect(h2, 0, y + 2, w, 8);
    s.hl(h0, 0, y + 2, w);
    s.hl(h1, 0, y + 3, w);
    s.hl(h3, 0, y + 9, w);
    for (let x = 6; x < w; x += 14) s.vl(h3, x, y + 4, 5);
    s.use(2, 2);
    s.rect(b, 0, y - 3, w, 5);
    s.hl(a, 0, y - 3, w);
    s.hl(c, 0, y + 1, w);
    for (let x = 0; x < w; x += 9) {
      s.vl(c, x, y - 2, 3);
      s.px(R.pole[0], x + 2, y - 2);
    }
    s.use(3, 3);
    for (let x = 12; x < w; x += 32) {
      s.ell(h3, x, y + 7, 3, 3);
      s.ell(h1, x, y + 7, 1.5, 1.5);
      s.px(h0, x + 2, y + 5);
    }
    s.finish();
    return s;
  },
});
export const PONTOON: DecorDef[] = [{ sprite: PONTOON_ART.id, x: C_BASIN[0], y: PONTOON_ART.y, frame: 0 }, ...(PONTOON_ART.tiles > 1 ? [{ sprite: PONTOON_ART.id, x: C_BASIN[0] + 256, y: PONTOON_ART.y, frame: 1 }] : [])];

// ------------------------------------------------------------------------------- c1: the Amstel bridge

const C1_BRIDGE_X = 0;
const C1_FOOT_X = C_AMSTEL[1] + 40;

/** The line a figure walks on the bridge: the terrain's up-slope, the deck, the ramp down, the last slope to the quay. */
function c1Deck(x: number): number {
  if (x < C_AMSTEL[0]) return G + ((C_BRIDGE_Y - G) * x) / C_AMSTEL[0];
  if (x < C_BRIDGE_END) return C_BRIDGE_Y;
  if (x < C_AMSTEL[1]) return C_BRIDGE_Y + ((172 - C_BRIDGE_Y) * (x - C_BRIDGE_END)) / (C_AMSTEL[1] - C_BRIDGE_END);
  return 172 + ((G - 172) * (x - C_AMSTEL[1])) / 40;
}

const C1_W = C1_FOOT_X - C1_BRIDGE_X;
const c1Opts: WhiteBridgeOpts = {
  x0: C_AMSTEL[0] - 28,
  x1: C_AMSTEL[1] + 4,
  cx: C1_BRIDGE_X,
  deck: c1Deck,
  phase: C_AMSTEL[0] + 44,
  pierEnd: (x) => (x >= C_AMSTEL[1] - 8 ? B2 - 8 : B2),
  piersFrom: C_BRIDGE_END,
};

/** The bridge of c1: the piers of the ramp stand straight, the rest is drawn level and follows the slope by the shear. */
function c1Layers(): ReadonlyArray<{ canvas: S; shear?: (x: number) => number }> {
  const under = new S(C1_W, VH);
  paintWhiteBridge(under, { ...c1Opts, layer: 'piers' });
  under.finish();
  const s = new S(C1_W, VH);
  paintWhiteBridge(s, { ...c1Opts, layer: 'span', deck: (x) => (x >= C_BRIDGE_END ? C_BRIDGE_Y : c1Deck(x)) });
  // The stone foot of the bridge on this bank: the slope up on solid ground, a wall down into the water.
  const [a, b, c, d] = R.stone;
  s.use(20, 4);
  for (let x = 0; x < C_AMSTEL[0] + 2; x++) {
    const y = Math.round(c1Deck(x));
    s.rect(c, x, y + 3, 1, VH - y - 3);
    s.px(a, x, y + 3);
    s.px(b, x, y + 4);
    s.px(d, x, y + 8);
  }
  for (let y = 165; y < VH; y += 5) {
    for (let x = 0; x < C_AMSTEL[0] + 2; x++) {
      const dy = Math.round(c1Deck(x)) + 9;
      if (y > dy) s.px(d, x, y);
    }
    for (let x = (y % 10 === 0 ? 3 : 8); x < C_AMSTEL[0] + 2; x += 10) {
      const dy = Math.round(c1Deck(x)) + 9;
      for (let j = y - 4; j < y; j++) if (j > dy) s.px(d, x, j);
    }
  }
  // The planks start on the slope.
  s.use(21, 4.5);
  for (let x = 0; x < C_AMSTEL[0] - 28; x++) {
    const y = Math.round(c1Deck(x));
    s.rect(x % 6 === 0 ? b : a, x, y - 3, 1, 6);
    s.px(c, x, y + 2);
    s.px(R.stone[0], x, y - 3);
  }
  s.use(22, 4.6);
  s.rect(d, C_AMSTEL[0], C_BRIDGE_Y + 20, 3, VH - C_BRIDGE_Y - 20);
  s.finish();
  return [{ canvas: under }, { canvas: s, shear: (x) => (x + C1_BRIDGE_X >= C_BRIDGE_END ? c1Deck(x + C1_BRIDGE_X) - C_BRIDGE_Y : 0) }];
}

export const C1_BRIDGE = defineBand({
  light: L,
  name: 'c1/bridge',
  speed: S_WALK,
  rows: [C_BRIDGE_Y - 20, VH],
  width: C1_W,
  layers: c1Layers,
});

/** World x where the ramp of c1 comes down into the surface rows: from here on it stands in front of the surface. */
export const C1_FOOT_FRONT_X = 836;
/** The foot of the ramp over the water's surface in front of the figures: else the surface cuts across it as a straight box. */
export const C1_FOOT_FRONT = defineBand({
  light: L,
  name: 'c1/ramp-foot-front',
  speed: S_WALK,
  rows: [WATER_Y + 2, B2 + 2],
  width: C_AMSTEL[1] + 6 - C1_FOOT_FRONT_X,
  fromX: C1_FOOT_FRONT_X - C1_BRIDGE_X,
  layers: c1Layers,
});

// ------------------------------------------------------------------------------- c1: the Blauwbrug

const [BB_X, BB_LEN, BB_H] = C_BLAUWBRUG;
/** The road over it: the terrain's hill. */
const bbDeck = (x: number): number => G + hillY(x - BB_X, BB_LEN, BB_H);
const BB_TOP = G - BB_H - 22;
const BB_W = BB_LEN + 8;
const BB_PAD = 4;

/** The balustrade and the road, behind the figures. */
export const BLAUW_BACK = defineBand({
  light: L,
  name: 'c1/blauw-back',
  speed: S_WALK,
  rows: [BB_TOP, B2],
  width: BB_W,
  paint: () => {
    const s = new S(BB_W, VH);
    const [a, b, c, d] = R.stone;
    const [ca, cb, cc, cd] = R.cobble;
    const X = (wx: number): number => wx - BB_X + BB_PAD;
    // The balustrade: a coping and balusters.
    for (let wx = BB_X; wx < BB_X + BB_LEN; wx++) {
      const x = X(wx);
      const y = Math.round(bbDeck(wx));
      s.use(1, 1);
      s.px(a, x, y - 16);
      s.px(b, x, y - 15);
      s.px(d, x, y - 14);
      s.px(b, x, y - 5);
      s.px(c, x, y - 4);
      if (wx % 6 < 3) {
        s.use(2, 0.9);
        s.rect(wx % 6 === 2 ? a : b, x, y - 13, 1, 8);
        if (wx % 6 === 0) s.rect(c, x, y - 13, 1, 8);
      }
    }
    // The road: setts, over the crown of the bridge.
    s.use(3, 2);
    for (let wx = BB_X - BB_PAD; wx < BB_X + BB_LEN + BB_PAD; wx++) {
      const x = X(wx);
      const y = Math.round(bbDeck(Math.max(BB_X, Math.min(BB_X + BB_LEN, wx))));
      s.rect(cb, x, y - 4, 1, B2 - y + 4);
      s.px(ca, x, y - 4);
      for (let j = 0; j < 30; j += 3) {
        const yy = y - 1 + j;
        if (yy < B2) {
          if ((wx + (j % 2) * 3) % 6 === 0) s.px(cc, x, yy);
          s.px((wx * 3 + j) % 7 < 3 ? cc : cb, x, yy);
        }
      }
      if (y + 2 < B2) s.px(cd, x, y + 2);
    }
    const o = s;
    o.finish();
    return o;
  },
});

/** The brick arch under the road: in front of the figures, it starts just under their feet. */
export const BLAUW_FACE = defineBand({
  light: L,
  name: 'c1/blauw-face',
  speed: S_WALK,
  rows: [G - BB_H, VH],
  width: BB_W,
  paint: () => {
    const s = new S(BB_W, VH);
    const [a, b, c, d] = R.brickb;
    const [t0, t1, t2, t3] = R.stone;
    const X = (wx: number): number => wx - BB_X + BB_PAD;
    const cx = X(BB_X + (BB_LEN >> 1));
    const rx = 74;
    const ry = 38;
    const cy = VH + 2;
    const inside = (x: number, y: number, m = 0): boolean => ((x - cx) / (rx + m)) ** 2 + ((y - cy) / (ry + m)) ** 2 < 1;
    // The wall, brick courses in hard patches.
    for (let wx = BB_X - BB_PAD; wx < BB_X + BB_LEN + BB_PAD; wx++) {
      const x = X(wx);
      const y = Math.round(bbDeck(Math.max(BB_X, Math.min(BB_X + BB_LEN, wx)))) + 3;
      s.use(1, 1);
      for (let j = y; j < VH; j++) {
        if (inside(x, j)) continue;
        const row = j >> 1;
        const seam = j % 2 === 1 || (x + (row % 2) * 3) % 7 === 0;
        const patch = ((x >> 3) * 5 + (j >> 3) * 3) % 5 === 0;
        s.px(seam ? c : patch ? a : b, x, j);
      }
    }
    // The stone ring of the arch.
    s.use(2, 2);
    for (let x = 0; x < BB_W; x++) {
      for (let j = G - BB_H; j < VH; j++) {
        if (!inside(x, j, 7) || inside(x, j)) continue;
        const an = Math.atan2(j - cy, x - cx);
        const seg = Math.floor(an * 18);
        const odd = ((seg % 2) + 2) % 2;
        s.px(x > cx ? (odd ? t0 : t1) : odd ? t1 : t2, x, j);
      }
    }
    // The dark under the arch; at the foot the water shows through.
    s.use(3, 0.5);
    for (let x = 0; x < BB_W; x++) {
      for (let j = G - BB_H; j < VH - 12; j++) {
        if (!inside(x, j)) continue;
        s.px(j < VH - 20 ? R.hull[3] : d, x, j);
      }
    }
    // The stone keystone with a little shield, and the coping under the road.
    s.use(4, 3);
    s.rect(t1, cx - 5, cy - ry - 8, 10, 9);
    s.hl(t0, cx - 5, cy - ry - 8, 10);
    s.vl(t0, cx + 4, cy - ry - 8, 9);
    s.vl(t3, cx - 5, cy - ry - 8, 9);
    s.rect(R.dred[1], cx - 2, cy - ry - 6, 4, 4);
    s.rect(R.hull[3], cx - 1, cy - ry - 6, 2, 4);
    s.use(5, 4);
    for (let wx = BB_X - BB_PAD; wx < BB_X + BB_LEN + BB_PAD; wx++) {
      const x = X(wx);
      const y = Math.round(bbDeck(Math.max(BB_X, Math.min(BB_X + BB_LEN, wx)))) + 2;
      s.px(t0, x, y);
      s.px(t1, x, y + 1);
      s.px(t3, x, y + 2);
    }
    // Stone piers at the two ends of the arch.
    s.use(6, 3);
    for (const x of [cx - rx - 14, cx + rx + 6]) {
      const top = 196;
      s.rect(t1, x, top, 8, VH - top);
      s.hl(t0, x, top, 8);
      s.vl(t0, x + 7, top, VH - top);
      s.vl(t2, x, top, VH - top);
      for (let q = top + 4; q < VH; q += 4) s.hl(t2, x + 1, q, 6);
    }
    return s;
  },
});

/** The Blauwbrug's lamp: an ornate stone base, a fluted post, a lantern and a gold crown. Feet on the road. */
export const BLAUW_LAMP = defineArt(L, 'c1/blauw-lamp', () => {
  const s = new S(22, 86);
  const [t0, t1, t2, t3] = R.stone;
  s.use(1, 1);
  s.rect(t1, 4, 66, 14, 20);
  s.vl(t0, 17, 66, 20);
  s.vl(t2, 4, 66, 20);
  s.hl(t3, 4, 85, 14);
  s.rect(t1, 3, 64, 16, 3);
  s.hl(t0, 3, 64, 16);
  s.use(2, 1.5);
  s.rect(R.blue[1], 7, 70, 8, 8);
  s.hl(R.blue[0], 7, 70, 8);
  s.vl(R.blue[2], 7, 70, 8);
  s.px(R.white[0], 12, 72);
  s.use(3, 1.2);
  tube(s, 'navy', 9, 24, 4, 40);
  for (const y of [32, 46, 58]) {
    s.rect(R.brass[1], 8, y, 6, 2);
    s.hl(R.brass[0], 8, y, 6);
  }
  s.use(4, 2);
  s.rect(R.brass[1], 6, 22, 10, 3);
  s.hl(R.brass[0], 6, 22, 10);
  s.hl(R.brass[3], 6, 24, 10);
  s.use(5, 3);
  s.poly(R.glow[1], [
    [5, 10],
    [16, 10],
    [14, 21],
    [7, 21],
  ]);
  s.vl(R.glow[0], 12, 11, 9);
  s.vl(R.glow[0], 13, 11, 9);
  s.vl(R.glow[2], 8, 11, 9);
  s.vl(K, 10, 10, 12);
  s.use(6, 3.5);
  s.hl(K, 4, 9, 14);
  s.rect(R.brass[1], 6, 4, 10, 5);
  s.hl(R.brass[0], 6, 4, 10);
  s.vl(R.brass[0], 15, 4, 5);
  s.vl(R.brass[2], 6, 4, 5);
  for (const x of [6, 9, 12, 15]) s.px(R.brass[0], x, 3);
  s.px(R.dred[1], 8, 6);
  s.px(R.blue[1], 13, 6);
  s.px(R.brass[0], 10, 1);
  s.px(R.brass[1], 10, 2);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** Market stalls of Waterlooplein: three cloths, hanging goods that sway. */
const STALLS: ReadonlyArray<readonly [number, readonly [string, string]]> = [
  [60, ['dgreen', 'white']],
  [56, ['dred', 'white']],
  [62, ['navy', 'yellow']],
];
export const STALL_IDS: readonly string[] = STALLS.map(([w, cl], i) =>
  defineArt(L, `river/stall-${i}`, () => {
    const { box, cloth } = stall(w, 410 + i * 3, cl);
    box.paste(cloth[0], 3, 2);
    return box;
  }),
);

// ------------------------------------------------------------------------------- the secret

/** The twin of the secret `decor/ams/secret-hoist` (3 frames: the crate in its sling, it bursts, the empty sling; the anchor at the hook). */
export const HOIST_TWIN = defineTwin(
  'c1/hoist',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(16, 26);
      const [ra, rb, rc] = R.cloth;
      const [a, b, c, d] = R.wood;
      s.use(1, 1);
      for (let y = 0; y <= 7; y++) s.px(y % 2 === 0 ? ra : rb, 8, y);
      s.use(2, 2);
      s.hl(R.iron[0], 7, 8, 3);
      s.px(R.iron[2], 7, 8);
      s.use(1, 1);
      if (f === 2) {
        s.vl(rb, 7, 9, 7);
        s.vl(rb, 9, 9, 6);
        s.px(ra, 6, 16);
        s.px(rc, 10, 15);
      } else if (f === 0) {
        s.line(rb, 7, 9, 3, 13);
        s.line(rc, 9, 9, 12, 13);
        s.use(3, 3);
        s.rect(b, 2, 13, 12, 11);
        s.hl(a, 2, 13, 12);
        s.vl(a, 13, 13, 11);
        s.vl(c, 2, 13, 11);
        s.hl(d, 2, 23, 12);
        for (const y of [16, 19]) s.hl(c, 3, y, 10);
        s.line(d, 3, 22, 12, 15);
        for (const [x, y] of [
          [3, 14],
          [12, 14],
          [3, 22],
          [12, 22],
        ]) {
          s.px(R.pole[1], x, y);
        }
      } else {
        s.line(rb, 7, 9, 3, 13);
        s.line(rc, 9, 9, 12, 13);
        s.use(3, 3);
        for (const x of [1, 9]) {
          s.rect(b, x, 14, 6, 10);
          s.hl(a, x, 14, 6);
          s.vl(c, x, 14, 10);
          s.hl(d, x, 23, 6);
        }
        s.use(4, 4);
        s.rect(R.yellow[1], 7, 16, 2, 4);
        s.px(R.yellow[0], 7, 16);
      }
      s.finish();
      return s;
    }),
  8,
  0,
);

export { C_AMSTEL };
