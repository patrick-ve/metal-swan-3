/**
 * The ring's set-piece sprites (docs/design/ring.md §4, §11): `decor/ring/<landmark>/…` for the
 * ten landmarks, `decor/ring/road/…` for the furniture every stretch shares (the median lamp
 * posts, the oncoming cars), and the light sprites `fx/ring/light/…` of light.ts.
 *
 * ONE density-generic drawer per id (kit.ts `Pen`): d 1 = the 1× art in PAL, d 2 and 4 = PAL_HD
 * with the same logical size, anchor and shapes (GEOMETRY IS LAW) and finer detail. Parallax
 * pieces (skyline, verge) are painted backgrounds: no ink outline, a little haze; the static
 * furniture in the playfield (lamp posts, portals, signs, the bascule tower) gets outline C;
 * moving things (the oncoming cars, the train) outline A. Our own lettering only (kit TINY); no
 * maker badge on any vehicle.
 */
import type { Color } from '../../../../engine/color';
import type { HdRampName } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { dq, h2, haze, outlineA, outlineC, Pen, tinyText, tinyWidth, toneI, type Dn } from './kit';
import { facade, tree, turbine } from './layers-far';

type Draw = (p: Pen, frame: number) => void;

/** All ids registered here (tests). */
export const RING_SCENERY_SPRITES: string[] = [];

/** Register a piece: `n` frames of w × h logical px, anchor (ox, oy), drawn at d 1, 2 and 4. */
function piece(id: string, w: number, h: number, ox: number, oy: number, n: number, draw: Draw, o: { defer?: boolean; ticksPerFrame?: number } = {}): void {
  const frames = (d: Dn): Frame[] => {
    const out: Frame[] = [];
    for (let i = 0; i < n; i++) {
      const p = new Pen(w, h, d);
      draw(p, i);
      out.push(p.frame(ox, oy));
    }
    return out;
  };
  defineSprite(id, () => frames(1), { hd: (d) => frames(d), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8 });
  RING_SCENERY_SPRITES.push(id);
}

const T = (r: HdRampName, k: number, d: Dn): Color => toneI(r, k, d);
const A = (r: HdRampName, k: number, air: number, d: Dn): Color => haze(toneI(r, k, d), air, d);

/** A vertical cylinder shaded across (lit left): tones of `r` from k0 (shade) to k1 (lit). */
function cylV(p: Pen, x: number, y: number, w: number, h: number, r: HdRampName, k0: number, k1: number, air = 0): void {
  const d = p.d;
  p.fill(x, y, w, h, (X) => {
    const u = ((X + 0.5) / d - x) / w;
    const t = 1 - Math.abs(u - 0.32) * 1.6;
    const k = k0 + Math.max(0, Math.min(1, t)) * (k1 - k0);
    return A(r, Math.round(k), air, d);
  });
}

// =============================================================================================
// Road furniture (every stretch): the median lamp post and the oncoming cars
// =============================================================================================

/** The median lamp post (14 × 62, anchor at its foot): a slim galvanised pole, a twin LED head. */
piece('decor/ring/road/lamp', 14, 62, 7, 62, 1, (p) => {
  const d = p.d;
  cylV(p, 6.25, 6, 1.75, 56, 'steel', 3, 6);
  p.rect(5, 59, 4, 3, T('steel', 3, d));
  p.rect(5, 59, 1, 3, T('steel', 5, d));
  // The head: a flat housing over the pole, its lens glowing underneath.
  p.rect(1, 3, 12, 3, T('steel', 4, d));
  p.rect(1, 3, 12, d === 1 ? 1 : 0.5, T('steel', 6, d));
  p.rect(2, 6, 10, 1, T('snow', 6, d));
  if (d > 1) p.rect(3, 6, 8, 0.5, T('gold', 7, d));
  p.rect(6, 1, 2, 2, T('steel', 3, d));
  outlineC(p);
});

interface CarLook {
  w: number;
  h: number;
  body: HdRampName;
  k: number;
  kind: 'hatch' | 'estate' | 'van' | 'lorry';
}

const ONCOMING: CarLook[] = [
  { w: 26, h: 10, body: 'red', k: 4, kind: 'hatch' },
  { w: 30, h: 10, body: 'steel', k: 5, kind: 'estate' },
  { w: 30, h: 13, body: 'gable', k: 5, kind: 'van' },
  { w: 26, h: 10, body: 'denim', k: 4, kind: 'hatch' },
  { w: 58, h: 18, body: 'gable', k: 4, kind: 'lorry' },
  { w: 30, h: 10, body: 'black', k: 3, kind: 'estate' },
  { w: 26, h: 10, body: 'green', k: 4, kind: 'hatch' },
];

/** Oncoming car ids (they face right; the view draws them mirrored). */
export const ONCOMING_IDS: string[] = ONCOMING.map((_, i) => `decor/ring/road/oncoming-${i}`);

ONCOMING.forEach((c, i) => {
  piece(ONCOMING_IDS[i], c.w + 2, c.h + 2, Math.round((c.w + 2) / 2), c.h + 1, 1, (p) => smallCar(p, c));
});

/** A small side-view car (no badge): a lit body, the glasshouse, wheels, lights; outline A. */
function smallCar(p: Pen, c: CarLook): void {
  const d = p.d;
  const x = 1;
  const base = 1 + c.h;
  const bodyC = [T(c.body, c.k - 2, d), T(c.body, c.k - 1, d), T(c.body, c.k, d), T(c.body, c.k + 1, d)];
  const glass = [T('glass', 2, d), T('glass', 4, d)];
  const tyre = T('ink', 1, d);
  const hub = T('steel', 4, d);
  if (c.kind === 'lorry') {
    // A box trailer and a cab at the right (the front).
    const boxW = c.w - 14;
    p.rect(x, base - c.h, boxW, c.h - 4, bodyC[2]);
    p.rect(x, base - c.h, boxW, 1, bodyC[3]);
    p.rect(x, base - 5, boxW, 1, bodyC[0]);
    if (d > 1) for (let rx = x + 4; rx < x + boxW; rx += 4) p.rect(rx, base - c.h + 1, 0.25, c.h - 6, bodyC[1]);
    const cx = x + boxW + 1;
    p.rect(cx, base - c.h + 3, 12, c.h - 6, T('navy', 4, d));
    p.rect(cx, base - c.h + 3, 12, 1, T('navy', 5, d));
    p.rect(cx + 6, base - c.h + 4, 5, 4, glass[0]);
    p.rect(cx + 6, base - c.h + 4, 2, 1.5, glass[1]);
    p.rect(x, base - 4, c.w - 1, 1.5, T('steel', 2, d));
    for (const wx of [x + 4, x + 10, x + boxW + 8]) wheel(p, wx, base - 1.5, 1.6, tyre, hub);
    p.rect(x + c.w - 1.5, base - 5, 1, 1, T('gold', 6, d));
    return;
  }
  const roofH = c.kind === 'van' ? c.h - 3 : c.h * 0.48;
  const beltY = base - c.h * (c.kind === 'van' ? 0.55 : 0.52);
  // Lower body.
  p.rect(x, beltY, c.w, base - 1.5 - beltY, bodyC[2]);
  p.rect(x, beltY, c.w, d === 1 ? 1 : 0.5, bodyC[3]);
  p.rect(x, base - 3, c.w, 1.5, bodyC[0]);
  // Glasshouse: a sloped windscreen at the front (right), the rear by model.
  const top = base - c.h;
  const rear = c.kind === 'hatch' ? x + 3 : x + 1;
  const front = x + c.w - (c.kind === 'van' ? 4 : 7);
  p.poly(
    [
      [rear, beltY],
      [rear + (c.kind === 'hatch' ? 2 : 0.5), top],
      [front - 2, top],
      [front + 2, beltY],
    ],
    bodyC[1],
  );
  p.rect(rear + 1, top, front - rear - 2, d === 1 ? 1 : 0.5, bodyC[3]);
  p.poly(
    [
      [rear + 1.5, beltY - 0.5],
      [rear + (c.kind === 'hatch' ? 2.8 : 1.5), top + 1],
      [front - 2.4, top + 1],
      [front + 1, beltY - 0.5],
    ],
    glass[0],
  );
  if (d > 1) {
    p.rect(rear + 3, top + 1, (front - rear) * 0.35, 1, glass[1]);
    p.rect(x + c.w * 0.55, top + 1, 0.5, beltY - top - 1.5, bodyC[1]);
  }
  void roofH;
  wheel(p, x + 5, base - 1.6, 1.8, tyre, hub);
  wheel(p, x + c.w - 6, base - 1.6, 1.8, tyre, hub);
  // Lights: a head lamp at the front, a tail lamp at the back.
  p.rect(x + c.w - 1, beltY + 0.5, 1, 1, T('gold', 6, d));
  p.rect(x, beltY + 0.5, 1, 1, T('red', 5, d));
  outlineA(p);
}

function wheel(p: Pen, cx: number, cy: number, r: number, tyre: Color, hub: Color): void {
  p.disc(cx, cy, r, r, tyre);
  p.disc(cx, cy, r * 0.45, r * 0.45, hub);
}

// =============================================================================================
// Light sprites (light.ts): additive glows in low tones
// =============================================================================================

/**
 * The band of a glow value v at an art px: hard bands at d 1 and 2 (fx never dither on single 2×
 * px), an ordered dither on 2 × 2 art-px cells at d 4 (half a logical px).
 */
function glowBand(v: number, X: number, Y: number, d: Dn): number {
  return d === 4 ? dq(v, X >> 1, Y >> 1, 0.7) : Math.floor(v);
}

/** A soft glow: tones of `r` from k0 (rim) to k1 (core), elliptic falloff. */
function glow(p: Pen, cx: number, cy: number, rx: number, ry: number, r: HdRampName, k0: number, k1: number, core = 1): void {
  const d = p.d;
  p.disc(cx, cy, rx, ry, (X, Y, u, v) => {
    const q = Math.max(0, 1 - Math.sqrt(u * u + v * v));
    const t = Math.pow(q, 1.4) * core;
    const n = k1 - k0 + 1;
    const i = glowBand(t * n, X, Y, d);
    if (i <= 0) return 0;
    return T(r, k0 + Math.min(n - 1, i - 1), d);
  });
}

piece('fx/ring/light/band', 48, 22, 24, 1, 1, (p) => {
  glow(p, 24, 1, 24, 20, 'slate', 1, 4);
  glow(p, 24, 1, 20, 4, 'snow', 0, 2);
});
/** The lamp band's sheen on the asphalt: a thin streak, brighter in the middle. */
piece('fx/ring/light/pool', 48, 4, 24, 2, 1, (p) => glow(p, 24, 2, 24, 1.6, 'steel', 1, 3));
piece('fx/ring/light/beam', 64, 18, 0, 9, 1, (p) => {
  const d = p.d;
  // A cone from the lamp (left, x 0) widening to the right, brightest near the lamp.
  p.fill(0, 0, 64, 18, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d - 9;
    const half = 2 + x * 0.11;
    if (Math.abs(y) > half) return 0;
    const t = (1 - x / 64) * (1 - (Math.abs(y) / half) * 0.7);
    const i = glowBand(t * (d === 1 ? 4 : 4.2), X, Y, d);
    return i <= 0 ? 0 : T('gold', Math.min(4, i), d);
  });
});
piece('fx/ring/light/glow-s', 16, 16, 8, 8, 1, (p) => glow(p, 8, 8, 8, 8, 'orange', 0, 4));
piece('fx/ring/light/glow-l', 72, 56, 36, 28, 1, (p) => glow(p, 36, 28, 36, 28, 'fire', 0, 4, 1.1));

export const RING_LIGHT_SPRITES = ['fx/ring/light/band', 'fx/ring/light/pool', 'fx/ring/light/beam', 'fx/ring/light/glow-s', 'fx/ring/light/glow-l'];

// =============================================================================================
// Tunnel portals (coentunnel, zeeburg): 100 × 113, anchor (76, 113) = the portal at the road top
// =============================================================================================

/** Portal sprite: 100 × 113, the portal (the tube's first px) at x 76 of the sprite. */
const PORTAL_W = 100;
const PORTAL_X = 76;

/**
 * Frame 0 = the entry (the open air on the left, the tube to the right): the concrete face of the
 * portal with lane signals, the header beam over the entrance reaching a little into the tube, a
 * grassy roof, and the blue name plate hung on the face over the approach (its lettering faces
 * the driver; we cheat it round to the camera). Frame 1 = the exit (mirrored geometry, no plate:
 * lettering never mirrors).
 */
function portal(name: string): Draw {
  return (p, f) => {
    const d = p.d;
    const conc = [T('stone', 2, d), T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
    const entry = f === 0;
    const fx = entry ? PORTAL_X - 7 : PORTAL_X;
    const slabX = entry ? PORTAL_X - 7 : PORTAL_X - 16;
    const slabW = 23;
    // The header beam over the entrance (y 0 … 50): lit lower edge, a dark joint at the tube side.
    p.rect(slabX, 0, slabW, 50, conc[1]);
    p.rect(slabX, 44, slabW, 6, conc[2]);
    p.rect(slabX, 44, slabW, d === 1 ? 1 : 0.5, conc[3]);
    p.rect(slabX, 49.5, slabW, 0.5, conc[0]);
    // The portal face: lit concrete, panel joints, a foot.
    p.rect(fx, 0, 7, 104, conc[3]);
    p.rect(fx + (entry ? 0 : 6), 0, 1, 104, conc[4]);
    p.rect(fx + (entry ? 6 : 0), 0, 1, 104, conc[1]);
    if (d > 1) for (let y = 12; y < 104; y += 16) p.rect(fx + 1, y, 5, 0.5, conc[2]);
    p.rect(fx - 1, 100, 9, 4, conc[2]);
    p.rect(fx - 1, 100, 9, 1, conc[4]);
    // Earth and grass on the roof.
    const gx = entry ? fx : slabX;
    p.rect(gx, 0, slabW, 3, T('green', 3, d));
    p.rect(gx, 0, slabW, 1, T('green', 5, d));
    // Lane signals on the face: three small heads with green arrows.
    for (let k = 0; k < 3; k++) {
      const sy = 56 + k * 8;
      p.rect(fx + 1, sy, 5, 5, T('ink', 1, d));
      p.rect(fx + 2, sy + 1, 3, 3, T('green', 6, d));
      if (d > 1) p.rect(fx + 2.5, sy + 1.5, 1, 1, T('green', 7, d));
    }
    if (entry) {
      // The name plate on brackets over the approach: white letters on blue.
      const pw = tinyWidth(name) + 6;
      const px = fx - pw + 2;
      for (const bx of [fx - 3, px + 3]) p.rect(bx, 28, 1, 3, T('steel', 3, d));
      p.rect(px, 30, pw, 11, T('navy', 3, d));
      p.rect(px + 1, 31, pw - 2, 9, T('navy', 4, d));
      p.rect(px + 1, 31, pw - 2, d === 1 ? 1 : 0.5, T('navy', 5, d));
      tinyText(p, name, px + 3, 33, T('snow', 6, d));
      p.rect(px, 27.5, fx - px + 1, 1, T('steel', 4, d));
    }
    outlineC(p);
  };
}

piece('decor/ring/coentunnel/portal', PORTAL_W, 113, PORTAL_X, 113, 2, portal('COENTUNNEL'));
piece('decor/ring/zeeburg/portal', PORTAL_W, 113, PORTAL_X, 113, 2, portal('ZEEBURGERTUNNEL'));

// =============================================================================================
// oost — the Rembrandt tower, Amstel station (city layer, base y 96)
// =============================================================================================

const CITY_AIR = 0.2;

piece('decor/ring/oost/rembrandt-tower', 30, 100, 15, 100, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  // Shaft: dark blue-grey glass between white vertical bands; a lit left face.
  const x0 = 4;
  const w = 22;
  const top = 26;
  p.fill(x0, top, w, 100 - top, (X, Y) => {
    const x = (X + 0.5) / d - x0;
    const y = (Y + 0.5) / d - top;
    const band = x % 3 < 1;
    if (band) return A('gable', x < 2 ? 6 : x > w - 2 ? 3 : 5, air, d);
    let v = 2 + (1 - y / 74) * 1.5 + (x < 4 ? 1 : x > w - 4 ? -1 : 0);
    if (d > 1 && y % 3 < 1 / d) v -= 1;
    return A('glass', Math.max(1, Math.min(5, d === 1 ? Math.round(v) : dq(v, X, Y, 0.6))), air, d);
  });
  // Setbacks and the tapering crown (lit left facet, shaded right).
  p.rect(x0 - 1, top, w + 2, 2, A('gable', 5, air, d));
  p.poly(
    [
      [x0 + 1, top],
      [15, 8],
      [15, top],
    ],
    A('gable', 6, air, d),
  );
  p.poly(
    [
      [15, 8],
      [x0 + w - 1, top],
      [15, top],
    ],
    A('steel', 4, air, d),
  );
  if (d > 1) for (let y = 12; y < top; y += 2) p.rect(15 - ((y - 8) / 18) * 10 + 1, y, ((y - 8) / 18) * 18 - 2, 0.25, A('glass', 3, air, d));
  // The mast.
  p.rect(14.5, 0, 1, 9, A('steel', 5, air, d));
  p.rect(14, 3, 2, 1, A('steel', 4, air, d));
  if (d > 1) p.rect(14.75, 0, 0.5, 1, A('red', 5, 0, d));
});

piece('decor/ring/oost/amstel-station', 104, 34, 52, 34, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  // Wings: brick, low, flat roofs.
  facade(p, { x: 1, top: 14, w: 30, bottom: 34, ramp: 'brick', k: 3, air, storey: 5, col: 4, winW: 2, winH: 3, seed: 3 });
  facade(p, { x: 73, top: 14, w: 30, bottom: 34, ramp: 'brick', k: 3, air, storey: 5, col: 4, winW: 2, winH: 3, seed: 5 });
  // The hall: a tall glass front in a stone frame under a flat roof, the name over it.
  facade(p, { x: 30, top: 4, w: 44, bottom: 34, ramp: 'stone', k: 5, air, storey: 0, col: 0, winW: 0, winH: 0, seed: 1 });
  p.fill(33, 11, 38, 21, (X, Y) => {
    const x = (X + 0.5) / d - 33;
    const y = (Y + 0.5) / d - 11;
    if (x % 4 < (d === 1 ? 1 : 0.5) || y % 5 < (d === 1 ? 1 : 0.5)) return A('stone', 4, air, d);
    const v = 2.5 + (1 - y / 21) * 1.5 - (x > 30 ? 1 : 0);
    return A('glass', Math.round(d === 1 ? v : dq(v, X, Y, 0.6)), air, d);
  });
  tinyText(p, 'AMSTEL', 52 - tinyWidth('AMSTEL') / 2, 5.5, A('ink', 1, air, d));
  // Platform canopies at both ends.
  p.rect(0, 22, 4, 1, A('steel', 5, air, d));
  p.rect(100, 22, 4, 1, A('steel', 5, air, d));
});

// =============================================================================================
// amstel, nieuwe-meer, coentunnel — interchange fly-overs (verge layer, base y 100)
// =============================================================================================

function flyover(seed: number, route: string): Draw {
  return (p) => {
    const d = p.d;
    const air = 0.1;
    const conc = [A('stone', 2, air, d), A('stone', 3, air, d), A('stone', 4, air, d), A('stone', 5, air, d), A('stone', 6, air, d)];
    // A gently curving deck: higher in the middle.
    const deckY = (x: number): number => 12 + Math.pow((x - 64) / 64, 2) * 10 + Math.sin(seed + x / 40) * 0.8;
    // Pillars (round) under the deck.
    for (const px of [20, 52, 84, 112]) {
      const top = deckY(px) + 6;
      cylV(p, px - 2.5, top, 5, 44 - top, 'stone', 2, 5, air);
      p.rect(px - 4, top - 1, 8, 2, conc[3]);
    }
    // The deck: the lit edge beam, its shaded soffit, a steel rail on top with small cars.
    for (let X = 0; X < p.W; X++) {
      const x = (X + 0.5) / d;
      const y0 = deckY(x);
      for (let Y = Math.round((y0 - 1) * d); Y < Math.round((y0 + 6) * d); Y++) {
        const y = (Y + 0.5) / d - y0;
        p.dot(X, Y, y < 0 ? conc[2] : y < 1 ? conc[4] : y < 4 ? conc[3] : conc[1]);
      }
      const rail = Math.round((y0 - 2.5) * d);
      p.dot(X, rail, conc[2]);
      if (d > 1) p.dot(X, rail + 1, conc[3]);
      if (d > 1 && Math.floor(x) % 6 === 0) for (let Y = rail; Y < Math.round((y0 - 1) * d); Y++) p.dot(X, Y, conc[1]);
    }
    for (let k = 0; k < 4; k++) {
      if (h2(k, seed, 7) < 0.35) continue;
      const cx = 12 + k * 28 + h2(k, seed, 8) * 10;
      const cy = deckY(cx) - 1;
      const body: HdRampName = (['red', 'denim', 'gable', 'steel'] as const)[k % 4];
      p.rect(cx, cy - 3, 9, 2, A(body, 4, air, d));
      p.rect(cx + 2, cy - 4.5, 5, 1.5, A('glass', 3, air, d));
      p.rect(cx + 1, cy - 1, 2, 1, A('ink', 1, air, d));
      p.rect(cx + 6, cy - 1, 2, 1, A('ink', 1, air, d));
    }
    // A blue route sign on the deck edge.
    p.rect(60, deckY(64) - 11, 14, 7, A('navy', 4, 0, d));
    tinyText(p, route, 67 - tinyWidth(route) / 2, deckY(64) - 10, T('snow', 6, d));
  };
}

piece('decor/ring/amstel/flyover', 128, 44, 64, 44, 1, flyover(1, 'A2'));
piece('decor/ring/nieuwe-meer/flyover', 128, 44, 64, 44, 1, flyover(5, 'A4'));
piece('decor/ring/coentunnel/flyover', 128, 44, 64, 44, 1, flyover(9, 'A8'));

/** A river barge on the Amstel (city layer; anchor at its waterline). */
piece('decor/ring/amstel/barge', 52, 14, 26, 11, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  p.poly(
    [
      [1, 6],
      [51, 6],
      [49, 12],
      [3, 12],
    ],
    A('ink', 1, air, d),
  );
  p.rect(1, 6, 50, 1, A('red', 3, air, d));
  p.rect(6, 4, 30, 2, A('brown', 3, air, d));
  facade(p, { x: 39, top: 0, w: 9, bottom: 6, ramp: 'gable', k: 5, air, storey: 3, col: 3, winW: 2, winH: 1.5, seed: 2 });
  // Its wake on the water.
  p.rect(0, 12, 6, 1, A('sky', 6, air, d));
});

// =============================================================================================
// zuid — the RAI halls, the Zuidas towers, the train between the carriageways
// =============================================================================================

piece('decor/ring/zuid/rai-hall', 124, 38, 62, 38, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  // A long hall with a shallow curved roof, silver cladding with ribs, a glass entrance.
  const roofY = (x: number): number => 10 - Math.sin((x / 124) * Math.PI) * 6;
  for (let X = 0; X < p.W; X++) {
    const x = (X + 0.5) / d;
    const top = roofY(x);
    for (let Y = Math.round(top * d); Y < p.H; Y++) {
      const y = (Y + 0.5) / d;
      let c: Color;
      if (y < top + 2) c = A('gable', y < top + 0.75 ? 6 : 4, air, d);
      else {
        const rib = d > 1 && x % 2 < 0.5;
        c = A('steel', rib ? 4 : 5, air, d);
      }
      p.dot(X, Y, c);
    }
  }
  // The entrance: a glass box with a canopy.
  p.fill(48, 22, 28, 16, (X, Y) => {
    const x = (X + 0.5) / d - 48;
    const y = (Y + 0.5) / d - 22;
    if (x % 4 < (d === 1 ? 1 : 0.5)) return A('steel', 3, air, d);
    return A('glass', Math.round(d === 1 ? 3 : dq(3.6 - y / 8, X, Y, 0.6)), air, d);
  });
  p.rect(44, 21, 36, 1.5, A('gable', 6, air, d));
  // Big letters on the cladding (our lettering, scale 2).
  tinyText(p, 'RAI', 14, 16, A('red', 4, air, d), { scale: 2 });
  // Flag poles.
  for (const fx of [88, 94, 100, 106]) {
    p.rect(fx, 8, d === 1 ? 1 : 0.5, 30, A('steel', 5, air, d));
    p.rect(fx + 0.5, 8, 3, 2, A((['red', 'gold', 'denim', 'green'] as const)[(fx / 6) % 4 | 0], 4, air, d));
  }
});

/** A Zuidas tower: style 0 glass with a slanted top, 1 a white grid, 2 twin slabs with a bridge. */
function zuidTower(style: number): Draw {
  return (p) => {
    const d = p.d;
    const air = CITY_AIR;
    const W = p.w;
    const H = p.h;
    if (style === 0) {
      const top = 8;
      p.fill(2, top, W - 4, H - top, (X, Y) => {
        const x = (X + 0.5) / d - 2;
        const y = (Y + 0.5) / d - top;
        if (d > 1 && (x % 3 < 0.25 || y % 3 < 0.25)) return A('glass', 1, air, d);
        let v = 1.6 + (1 - y / (H - top)) * 2.4 + (((x + y * 0.5) % 18) < 4 ? 1.2 : 0);
        if (x < 1.5) v += 1;
        if (x > W - 6) v -= 1;
        return A('glass', Math.max(1, Math.min(5, d === 1 ? Math.round(v) : dq(v, X, Y, 0.6))), air, d);
      });
      p.poly(
        [
          [2, top],
          [W - 2, 1],
          [W - 2, top],
        ],
        A('glass', 4, air, d),
      );
      p.line(2, top, W - 2, 1, A('gable', 6, air, d));
    } else if (style === 1) {
      facade(p, { x: 2, top: 4, w: W - 4, bottom: H, ramp: 'gable', k: 4, air, storey: 3, col: 3, winW: 2, winH: 2, glass: 2, seed: 11 });
      p.rect(1, 2, W - 2, 2, A('gable', 6, air, d));
    } else {
      facade(p, { x: 2, top: 10, w: 15, bottom: H, ramp: 'stone', k: 4, air, storey: 3, col: 3, winW: 2, winH: 2, seed: 21 });
      facade(p, { x: W - 17, top: 2, w: 15, bottom: H, ramp: 'stone', k: 4, air, storey: 3, col: 3, winW: 2, winH: 2, seed: 23 });
      p.rect(16, 26, W - 32, 6, A('glass', 3, air, d));
      p.rect(16, 26, W - 32, 1, A('gable', 6, air, d));
    }
  };
}

piece('decor/ring/zuid/tower-a', 30, 90, 15, 90, 1, zuidTower(0));
piece('decor/ring/zuid/tower-b', 26, 76, 13, 76, 1, zuidTower(1));
piece('decor/ring/zuid/tower-c', 42, 66, 21, 66, 1, zuidTower(2));

/** A double-deck train between the carriageways (farroad layer), facing left; outline A. */
piece('decor/ring/zuid/train', 124, 20, 62, 19, 1, (p) => {
  const d = p.d;
  const body = [T('gold', 3, d), T('gold', 4, d), T('gold', 5, d), T('gold', 6, d)];
  const blue = [T('denim', 2, d), T('denim', 3, d)];
  const glass = [T('glass', 1, d), T('glass', 3, d)];
  for (const [cx, cw] of [
    [2, 60],
    [63, 59],
  ] as const) {
    p.rect(cx, 4, cw, 12, body[2]);
    p.rect(cx, 4, cw, 1, body[3]);
    p.rect(cx, 14, cw, 2, blue[0]);
    p.rect(cx, 3, cw, 1, T('steel', 3, d));
    // Two decks of windows, doors.
    for (let wx = cx + 4; wx < cx + cw - 4; wx += 5) {
      p.rect(wx, 6, 3.5, 2.5, glass[0]);
      p.rect(wx, 10, 3.5, 2.5, glass[0]);
      if (d > 1) {
        p.rect(wx, 6, 1.5, 1, glass[1]);
        p.rect(wx, 10, 1.5, 1, glass[1]);
      }
    }
    p.rect(cx + cw / 2 - 2, 6, 4, 9, blue[1]);
    for (const bx of [cx + 6, cx + cw - 9]) {
      p.rect(bx, 16, 4, 2, T('ink', 1, d));
      p.disc(bx + 1, 17.5, 1, 1, T('steel', 3, d));
      p.disc(bx + 3, 17.5, 1, 1, T('steel', 3, d));
    }
  }
  // The nose (left, facing left): sloped black front, a headlight; a pantograph.
  p.poly(
    [
      [2, 4],
      [1, 9],
      [1, 15],
      [5, 15],
      [5, 4],
    ],
    T('ink', 1, d),
  );
  p.rect(1.5, 12, 1, 1, T('gold', 7, d));
  p.line(30, 3, 34, 1, T('steel', 4, d));
  p.line(34, 1, 38, 3, T('steel', 4, d));
  void body[0];
  outlineA(p);
});

// =============================================================================================
// nieuwe-meer — the Schinkelbrug bascule tower (verge layer), sailboats on the lake (city layer)
// =============================================================================================

piece('decor/ring/nieuwe-meer/schinkelbrug', 66, 64, 33, 64, 1, (p) => {
  const d = p.d;
  const st = [T('teal', 1, d), T('teal', 2, d), T('teal', 3, d), T('teal', 4, d)];
  const conc = [T('stone', 3, d), T('stone', 4, d), T('stone', 5, d), T('stone', 6, d)];
  // Two legs of the portal frame (riveted steel), the crossbeam, the counterweight block.
  for (const lx of [8, 52]) {
    p.rect(lx, 14, 6, 50, st[2]);
    p.rect(lx, 14, 1.5, 50, st[3]);
    p.rect(lx + 5, 14, 1, 50, st[0]);
    if (d > 1) for (let y = 18; y < 62; y += 4) p.line(lx + 1, y, lx + 5, y + 4, st[1]);
  }
  p.rect(6, 10, 54, 5, st[2]);
  p.rect(6, 10, 54, 1, st[3]);
  // The counterweight: a heavy concrete block hanging between the legs.
  p.rect(18, 15, 30, 14, conc[1]);
  p.rect(18, 15, 30, 1.5, conc[3]);
  p.rect(18, 15, 2, 14, conc[2]);
  p.rect(46, 15, 2, 14, conc[0]);
  // The bridge house: a small control cabin with windows at the foot.
  facade(p, { x: 24, top: 48, w: 18, bottom: 64, ramp: 'gable', k: 4, air: 0, storey: 5, col: 4, winW: 3, winH: 2, seed: 4 });
  p.rect(23, 47, 20, 1.5, st[2]);
  // Cables from the beam to the deck.
  for (const cx of [16, 50]) p.line(cx, 15, cx + (cx < 33 ? -6 : 6), 64, T('ink', 1, d));
  // The name plate.
  const nw = tinyWidth('SCHINKEL') + 4;
  p.rect(33 - nw / 2, 2, nw, 8, T('navy', 4, d));
  p.rect(33 - nw / 2, 2, nw, d === 1 ? 1 : 0.5, T('navy', 5, d));
  tinyText(p, 'SCHINKEL', 33 - nw / 2 + 2, 3.5, T('snow', 6, d));
  outlineC(p);
});

piece('decor/ring/nieuwe-meer/sailboat', 22, 28, 11, 26, 3, (p, f) => {
  const d = p.d;
  const air = CITY_AIR;
  const sails: HdRampName[] = ['gable', 'red', 'denim'];
  p.poly(
    [
      [2, 22],
      [20, 22],
      [17, 26],
      [5, 26],
    ],
    A('gable', 5, air, d),
  );
  p.rect(2, 22, 18, d === 1 ? 1 : 0.5, A('gable', 6, air, d));
  p.rect(11, 1, d === 1 ? 1 : 0.5, 21, A('steel', 4, air, d));
  p.poly(
    [
      [11.5, 2],
      [11.5, 21],
      [20, 21],
    ],
    A(sails[f], 5, air, d),
  );
  p.poly(
    [
      [10.5, 4],
      [10.5, 21],
      [3, 21],
    ],
    A(sails[f], 4, air, d),
  );
  if (d > 1) p.line(11.5, 6, 15, 20, A(sails[f], 6, air, d));
});

// =============================================================================================
// west — the buildings over the road at Bos en Lommer, Sloterdijk station and offices
// =============================================================================================

/** The office block over the road (224 × 58, top-left anchor; its soffit is the tunnel layer's). */
piece('decor/ring/west/overbuild', 224, 58, 0, 0, 1, (p) => {
  const d = p.d;
  // Brick and glass ribbons, four storeys, a lit roof edge; columns of the frame every 32 px.
  p.rect(0, 2, 224, 56, T('brickDark', 4, d));
  p.rect(0, 2, 224, 1.5, T('stone', 6, d));
  p.rect(0, 3.5, 224, 0.5, T('brickDark', 2, d));
  for (let s = 0; s < 4; s++) {
    const y = 8 + s * 12;
    p.fill(2, y, 220, 6, (X, Y) => {
      const x = (X + 0.5) / d - 2;
      const yy = (Y + 0.5) / d - y;
      if (x % 6 < (d === 1 ? 1 : 0.5)) return T('stone', 4, d);
      const v = 2.2 + (1 - yy / 6) * 1.8 + (((x + yy) % 40) < 6 ? 1 : 0);
      return T('glass', Math.round(d === 1 ? v : dq(v, X, Y, 0.6)), d);
    });
    p.rect(1, y + 6, 222, 1, T('stone', 5, d));
    if (d > 1) p.rect(1, y + 7, 222, 0.5, T('brickDark', 2, d));
  }
  for (let x = 0; x <= 224; x += 32) {
    p.rect(x - 1, 4, 2, 54, T('stone', 4, d));
    p.rect(x - 1, 4, 0.5, 54, T('stone', 6, d));
  }
  // A shop sign on the front.
  p.rect(88, 49.5, tinyWidth('BOS EN LOMMER') + 4, 7, T('red', 3, d));
  p.rect(88, 49.5, tinyWidth('BOS EN LOMMER') + 4, d === 1 ? 1 : 0.5, T('red', 5, d));
  tinyText(p, 'BOS EN LOMMER', 90, 50.5, T('snow', 6, d));
  p.rect(0, 57, 224, 1, T('ink', 1, d));
});

piece('decor/ring/west/sloterdijk', 124, 46, 62, 46, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  // The rail viaduct across, on pillars; the arched glass roof of the station over it.
  const conc = [A('stone', 2, air, d), A('stone', 3, air, d), A('stone', 4, air, d), A('stone', 5, air, d)];
  for (let x = 6; x < 124; x += 24) {
    p.rect(x, 30, 4, 16, conc[2]);
    p.rect(x, 30, 1, 16, conc[3]);
  }
  p.rect(0, 26, 124, 5, conc[2]);
  p.rect(0, 26, 124, 1, conc[3]);
  p.rect(0, 30, 124, 1, conc[0]);
  // The arched hall roof: steel ribs, glass between, lit on the left.
  for (let X = Math.round(30 * d); X < Math.round(94 * d); X++) {
    const x = (X + 0.5) / d;
    const u = (x - 62) / 32;
    const top = 26 - Math.sqrt(Math.max(0, 1 - u * u)) * 20;
    for (let Y = Math.round(top * d); Y < 26 * d; Y++) {
      const rib = x % 4 < (d === 1 ? 1 : 0.5);
      const v = 3.5 - u * 1.2 - ((Y / d - top) / 20) * 1.5;
      p.dot(X, Y, rib ? A('steel', 3, air, d) : A('glass', Math.max(1, Math.min(5, d === 1 ? Math.round(v) : dq(v, X, Y, 0.6))), air, d));
    }
  }
  p.rect(41, 32, 42, 7, A('navy', 3, air, d));
  tinyText(p, 'SLOTERDIJK', 62 - tinyWidth('SLOTERDIJK') / 2, 33, A('snow', 6, air, d));
});

piece('decor/ring/west/office', 36, 84, 18, 84, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  p.fill(3, 6, 30, 78, (X, Y) => {
    const x = (X + 0.5) / d - 3;
    const y = (Y + 0.5) / d - 6;
    if (y % 4 < 1) return A('gable', x < 2 ? 6 : x > 27 ? 3 : 5, air, d);
    const v = 2 + (1 - y / 78) * 2 + (x < 3 ? 1 : x > 26 ? -1 : 0);
    return A('glass', Math.max(1, Math.min(5, d === 1 ? Math.round(v) : dq(v, X, Y, 0.6))), air, d);
  });
  p.rect(1, 2, 34, 4, A('gable', 5, air, d));
  p.rect(1, 2, 34, 1, A('gable', 6, air, d));
  p.rect(16, 0, 4, 2, A('steel', 4, air, d));
});

// =============================================================================================
// westpoort — container cranes and a wind turbine (city layer)
// =============================================================================================

piece('decor/ring/westpoort/crane', 100, 92, 50, 92, 1, (p) => {
  const d = p.d;
  const air = CITY_AIR;
  const blue = [A('denim', 2, air, d), A('denim', 3, air, d), A('denim', 4, air, d), A('denim', 5, air, d)];
  // Two legs and the portal beam; the boom over the quay (left) and the backreach (right).
  for (const lx of [34, 62]) {
    p.rect(lx, 30, 4, 62, blue[2]);
    p.rect(lx, 30, 1, 62, blue[3]);
    p.rect(lx + 3, 30, 1, 62, blue[0]);
  }
  p.rect(30, 52, 40, 4, blue[2]);
  p.rect(30, 52, 40, 1, blue[3]);
  // The boom: a lattice girder from x 0 to 100 at y 22 … 28.
  p.rect(0, 22, 100, 1.5, blue[3]);
  p.rect(0, 27, 100, 1.5, blue[1]);
  for (let x = 0; x < 100; x += 4) p.line(x, 23.5, x + 2, 27, blue[2], d === 1 ? 1 : Math.max(1, d >> 1));
  // The A-frame and its stays.
  p.line(48, 4, 36, 30, blue[2], Math.max(1, d >> 1));
  p.line(52, 4, 64, 30, blue[2], Math.max(1, d >> 1));
  p.line(50, 4, 2, 22, A('ink', 1, air, d));
  p.line(50, 4, 98, 22, A('ink', 1, air, d));
  // The machinery house, the trolley and the spreader on its cables.
  facade(p, { x: 40, top: 14, w: 20, bottom: 22, ramp: 'gable', k: 5, air, storey: 0, col: 0, winW: 0, winH: 0, seed: 1 });
  p.rect(14, 28.5, 8, 3, A('gold', 4, air, d));
  p.rect(17.5, 31.5, 0.5, 18, A('ink', 1, air, d));
  p.rect(12, 49, 12, 2, A('gold', 5, air, d));
  // A container hanging under it.
  p.rect(12, 51, 12, 5, A('red', 4, air, d));
  p.rect(12, 51, 12, 1, A('red', 5, air, d));
});

function turbineDraw(p: Pen, f: number): void {
  const d = p.d;
  const air = CITY_AIR + 0.06;
  const white = A('snow', 6, air, d);
  const shade = A('snow', 4, air, d);
  // A tapered white tower lit on the left; the nacelle; three blades at the frame's angle.
  for (let Y = 20 * d; Y < p.H; Y++) {
    const y = (Y + 0.5) / d;
    const half = 1 + ((y - 20) / 70) * 1.2;
    p.rect(24 - half, y - 0.5 / d, half, 1 / d, white);
    p.rect(24, y - 0.5 / d, half, 1 / d, shade);
  }
  p.rect(22, 17.5, 6, 3, white);
  p.rect(22, 19.5, 6, 1, shade);
  const a0 = (f / 4) * ((Math.PI * 2) / 3);
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k * Math.PI * 2) / 3 - Math.PI / 2;
    const ex = 22 + Math.cos(a) * 19;
    const ey = 19 + Math.sin(a) * 19;
    p.line(22, 19, ex, ey, white, d === 1 ? 1 : Math.max(1, d >> 1));
    if (d > 1) p.line(22 + Math.cos(a + 0.08) * 2, 19 + Math.sin(a + 0.08) * 2, ex, ey, shade, 1);
  }
  p.disc(22, 19, 1.4, 1.4, A('snow', 5, air, d));
}

piece('decor/ring/westpoort/turbine', 48, 90, 24, 90, 4, turbineDraw, { ticksPerFrame: 10 });
piece('decor/ring/noord/turbine', 48, 90, 24, 90, 4, turbineDraw, { ticksPerFrame: 10 });

// =============================================================================================
// noord — a polder windmill (city layer)
// =============================================================================================

piece('decor/ring/noord/windmill', 44, 58, 22, 58, 4, (p, f) => {
  const d = p.d;
  const air = CITY_AIR + 0.04;
  // The thatched body (tapering), the stage, the cap; four sails turning.
  p.poly(
    [
      [14, 58],
      [17, 22],
      [27, 22],
      [30, 58],
    ],
    A('olive', 3, air, d),
  );
  p.poly(
    [
      [14, 58],
      [17, 22],
      [21, 22],
      [19, 58],
    ],
    A('olive', 5, air, d),
  );
  p.rect(12, 44, 20, 1.5, A('brown', 2, air, d));
  p.rect(18, 50, 5, 8, A('green', 2, air, d));
  p.poly(
    [
      [16, 22],
      [22, 15],
      [28, 22],
    ],
    A('steel', 3, air, d),
  );
  const a0 = (f / 4) * (Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2;
    const ex = 22 + Math.cos(a) * 20;
    const ey = 19 + Math.sin(a) * 20;
    p.line(22, 19, ex, ey, A('brown', 2, air, d), d === 1 ? 1 : Math.max(1, d >> 1));
    // The lattice sail beside each stock.
    const nx = -Math.sin(a) * 3;
    const ny = Math.cos(a) * 3;
    for (let t = 0.3; t <= 1; t += 0.14) {
      const sx = 22 + Math.cos(a) * 20 * t;
      const sy = 19 + Math.sin(a) * 20 * t;
      p.line(sx, sy, sx + nx, sy + ny, A('gable', 5, air, d));
    }
  }
}, { ticksPerFrame: 14 });

// =============================================================================================
// zeeburg — an IJburg block (city layer)
// =============================================================================================

piece('decor/ring/zeeburg/ijburg', 64, 46, 32, 46, 1, (p) => {
  const air = CITY_AIR;
  facade(p, { x: 1, top: 18, w: 22, bottom: 46, ramp: 'orange', k: 3, air, storey: 4, col: 4, winW: 2, winH: 2, balcony: true, seed: 3 });
  facade(p, { x: 22, top: 4, w: 20, bottom: 46, ramp: 'gable', k: 4, air, storey: 4, col: 4, winW: 3, winH: 2, balcony: true, seed: 5 });
  facade(p, { x: 41, top: 12, w: 22, bottom: 46, ramp: 'brick', k: 4, air, storey: 4, col: 4, winW: 2, winH: 2, seed: 7 });
});

// =============================================================================================
// exit — the big exit sign before the off-ramp (verge layer)
// =============================================================================================

piece('decor/ring/exit/exit-sign', 96, 62, 48, 62, 1, (p) => {
  const d = p.d;
  const blue = [T('navy', 3, d), T('navy', 4, d), T('navy', 5, d)];
  const white = T('snow', 6, d);
  const ink = T('ink', 0, d);
  // Legs.
  for (const lx of [16, 78]) {
    p.rect(lx, 28, 2.5, 34, T('steel', 3, d));
    p.rect(lx, 28, 0.75, 34, T('steel', 5, d));
  }
  // The panel.
  p.rect(2, 2, 92, 28, blue[1]);
  if (d > 1) p.fill(2, 2, 92, 28, (X, Y) => (dq(1.2 - ((X + 0.5) / d / 92) * 0.7 - ((Y + 0.5) / d / 28) * 0.6, X, Y, 0.5) >= 1 ? blue[2] : 0));
  p.rect(3, 3, 90, 1, white);
  p.rect(3, 28, 90, 1, white);
  p.rect(3, 3, 1, 26, white);
  p.rect(92, 3, 1, 26, white);
  // The S-shield, the place, an arrow down to the right (the off-ramp on the near side).
  const sw = tinyWidth('S113') + 4;
  p.rect(7, 6, sw, 9, ink);
  p.rect(8, 7, sw - 2, 7, white);
  tinyText(p, 'S113', 9, 8, ink);
  tinyText(p, 'AFRIT', 7 + sw + 4, 8, white);
  tinyText(p, 'WATERGRAAFSMEER', 48 - tinyWidth('WATERGRAAFSMEER') / 2, 19, white);
  p.line(78, 7, 86, 15, white, d === 1 ? 1 : d >> 1);
  p.rect(82, 14, 5, 1, white);
  p.rect(86, 10, 1, 5, white);
  outlineC(p);
});

/** Every set-piece id per landmark (tests: all are registered at 1×, 2× and 4×). */
export const RING_PIECES_BY_LANDMARK: Readonly<Record<string, readonly string[]>> = {
  oost: ['decor/ring/oost/rembrandt-tower', 'decor/ring/oost/amstel-station'],
  amstel: ['decor/ring/amstel/flyover', 'decor/ring/amstel/barge'],
  zuid: ['decor/ring/zuid/rai-hall', 'decor/ring/zuid/tower-a', 'decor/ring/zuid/tower-b', 'decor/ring/zuid/tower-c', 'decor/ring/zuid/train'],
  'nieuwe-meer': ['decor/ring/nieuwe-meer/schinkelbrug', 'decor/ring/nieuwe-meer/sailboat', 'decor/ring/nieuwe-meer/flyover'],
  west: ['decor/ring/west/overbuild', 'decor/ring/west/sloterdijk', 'decor/ring/west/office'],
  westpoort: ['decor/ring/westpoort/crane', 'decor/ring/westpoort/turbine'],
  coentunnel: ['decor/ring/coentunnel/portal', 'decor/ring/coentunnel/flyover'],
  noord: ['decor/ring/noord/turbine', 'decor/ring/noord/windmill'],
  zeeburg: ['decor/ring/zeeburg/portal', 'decor/ring/zeeburg/ijburg'],
  exit: ['decor/ring/exit/exit-sign'],
};

void tree;
void turbine;
