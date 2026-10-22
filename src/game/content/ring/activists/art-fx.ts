/**
 * The blockade's props and effects (wave B; docs/design/ring.md §R.6, §R.9; docs/ART_GUIDE.md "UHD
 * art"): ONE density-generic drawer per id (`HdCanvas` at d = 1, 2, 4: the 1× art in `PAL`, the 2× /
 * 4× art in `PAL_HD`, the same logical size and anchor at every density).
 *
 * - `npc/ring/prop/sign-<i>` (the `BANNERS`), `sign-gezegd` (the continue sign `WIJ HADDEN HET
 *   GEZEGD`): hand-painted cardboard on a wooden stick (anchor: the stick's foot); our own 3 × 5
 *   lettering at half a logical px per bit (readable at 2× / 4×; at 1× the marker strokes). Drawn
 *   unflipped (never mirrored). Outline A (held, carried). `sign-dropped`: a sign lying on the road.
 * - `npc/ring/prop/barrel` (the ketting's blue drum), `npc/ring/prop/crate` (the megafoon's fruit
 *   crate): static road props, outline C.
 * - `fx/ring/act/balloon-<colour>` (2: the paint balloon wobbling), `pot` (4: the glue tin tumbling),
 *   `can` (4: the soup can tumbling): shots, centre anchor, outline A.
 * - `fx/ring/act/splat` (one frame per paint colour: pink, yellow, sky, green), `soup` (ORANGE tomato
 *   soup and the dented can), `glue` (4: spreading, wet ×2 with the shine moving, dried): decals on
 *   the road (anchor: the ground under the middle). Bloodless: never a red pool.
 * - `fx/ring/act/shout` (3: the megaphone's sound ring rolling on the road), `squeal` (3: the
 *   feedback whine's zig-zags; anchor at the megaphone's mouth), `note` (2: the hum), `strands` (4:
 *   glue strands from a hero's boots to the road), `links` (2: the chain from a sitter's waist to the
 *   barrel / partner; snapped).
 * The rare strips are deferred (the dropped sign).
 */
import { INK, PAL } from '../../../../engine/palette';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, type SpriteOpts } from '../../../../engine/sprites';
import { HdCanvas } from '../../../art/hd';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { glyphHit } from '../traffic/lettering';
import { BANNERS, CONTINUE_SIGN } from '../foot/lines';
import { ACT_ART, PAINT_COLOURS } from './looks';

void PAL;

type Gen = (d: Dn) => Frame[];

/** Register an id: 1× from the drawer at d 1; 2× / 4× from the same drawer. */
function def(id: string, gen: Gen, o: SpriteOpts = {}): void {
  defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d as Dn) });
}

/** A frame of a canvas buffer with its anchor at logical (ax, ay). */
function frame(buf: PixelBuffer, ax: number, ay: number, d: Dn): Frame {
  return d === 1 ? { buf, ox: ax, oy: ay } : { buf, ox: ax, oy: ay, density: d };
}

/** Static road decor: outline C (the deepest tone on the lit side, ink on the shadow side). */
function finishC(c: HdCanvas, ao = 0.3): PixelBuffer {
  return c.render({ outline: 'C', ink: INK, ao, rimLight: c.d === 1 ? 0 : 2 });
}

/** A decal flat on the road: no ink outline (it neither moves nor can be hit). */
function finishDecal(c: HdCanvas): PixelBuffer {
  return c.render({ outline: 'none', ao: 0.1, rimLight: 0 });
}

/** Deterministic hash 0 … 1 of an integer pair (wear, speckles; no rng). */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// Our lettering (3 × 5 bits; the comma and the full stop added here)
// ---------------------------------------------------------------------------------------------

const PUNCT: Readonly<Record<string, readonly string[]>> = {
  ',': ['000', '000', '000', '010', '100'],
  '.': ['000', '000', '000', '000', '010'],
};

/** Is (px, py) on a bit of `text` set at top-left (x, y) with bits of `s` px (gap 1 bit)? */
function letterHit(text: string, x: number, y: number, s: number, px: number, py: number): boolean {
  const u = (px - x) / s;
  const v = (py - y) / s;
  if (v < 0 || v >= 5 || u < 0) return false;
  const i = Math.floor(u / 4);
  if (i >= text.length) return false;
  const ch = text[i];
  const p = PUNCT[ch];
  if (!p) return glyphHit(ch, x + i * 4 * s, y, s, 1, px, py);
  const cu = Math.floor(u - i * 4);
  return cu < 3 && p[Math.floor(v)][cu] === '1';
}

/** Width of a line at `s` px per bit. */
function lineW(text: string, s: number): number {
  return (text.length * 4 - 1) * s;
}

/** Split a sign text into lines of at most `max` characters (at spaces). */
export function signLines(text: string, max = 12): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The signs
// ---------------------------------------------------------------------------------------------

/** Bits of the lettering on a sign (logical px). */
const SIGN_S = 0.5;
const STICK = 14;
/** The marker colours of the signs (hand-painted: each its own). */
const MARKER = ['green', 'navy', 'purple', 'teal'] as const;

/** The sign's board size for `text` (logical px). */
export function signSize(text: string): { w: number; h: number; lines: string[] } {
  const lines = signLines(text);
  const w = Math.ceil(Math.max(...lines.map((l) => lineW(l, SIGN_S))) + 4);
  const h = Math.ceil(lines.length * 5 * SIGN_S + (lines.length - 1) * 1 + 4);
  return { w, h, lines };
}

/** A hand-painted cardboard sign on a stick (anchor: the stick's foot). */
function signFrame(text: string, ink: string, seed: number, d: Dn): Frame {
  const { w, h, lines } = signSize(text);
  const W = w + 4;
  const H = h + STICK + 3;
  const c = new HdCanvas(W, H, d);
  const card = mat(c, 'sand', { spec: 0.15, shine: 12, lo1: 1, hi1: 3, lo: 2, hi: 5, wrap: 0.1 });
  const wood = mat(c, 'brown', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const cx = W / 2;
  const by = H - STICK - 1;
  // The stick (behind the board), a little off centre.
  c.box(cx - 0.6, by - h * 0.6, 1.3, STICK + h * 0.6, { mat: wood, z: 0, r: 0.3 });
  // The board: a slightly crooked quad (cut from a box), corrugation and wear at 4×.
  const tilt = ((seed % 3) - 1) * 0.5;
  const x0 = cx - w / 2;
  const y0 = by - h;
  c.poly(
    [
      [x0, y0 + tilt],
      [x0 + w, y0 - tilt],
      [x0 + w, by - tilt * 0.5],
      [x0, by + tilt * 0.5],
    ],
    {
      mat: card,
      z: 1,
      round: 0.15,
      tex: (t) => {
        if (t.d === 4 && Math.floor(t.X / 2) % 3 === 0) t.tone -= 0.06;
        const n = hash(Math.floor(t.x * 1.5) + seed * 31, Math.floor(t.y * 1.5));
        if (n > 0.93) t.tone -= 0.18;
        // A dog-ear and a scuffed corner.
        if (t.x > x0 + w - 1.4 && t.y < y0 + 1.6 - tilt) t.tone -= 0.25;
      },
    },
  );
  // The lettering in marker (fixed colour: unlit), each line centred.
  const markerC = bot(ink, d, d === 1 ? 0 : 1);
  const lh = 5 * SIGN_S;
  for (let i = 0; i < lines.length; i++) {
    const lw = lineW(lines[i], SIGN_S);
    const lx = cx - lw / 2;
    const ly = y0 + 2 + i * (lh + 1);
    c.paint(lx - 0.5, ly - 0.5, lw + 1, lh + 1, (x, y) => (letterHit(lines[i], lx, ly, SIGN_S, x, y) ? markerC : 0), 9);
  }
  return frame(finishA(c, 0.2), cx, H - 1, d);
}

BANNERS.forEach((text, i) => def(ACT_ART.sign(i), (d) => [signFrame(text, MARKER[i % MARKER.length], i, d)]));
def(ACT_ART.signGezegd, (d) => [signFrame(CONTINUE_SIGN, 'navy', 7, d)], { defer: true });

/** A sign lying flat on the road (dropped): the board seen edge-on, the stick beside it. */
def(
  ACT_ART.signDropped,
  (d) => {
    const c = new HdCanvas(30, 6, d);
    const card = mat(c, 'sand', { spec: 0.15, lo1: 1, hi1: 3, lo: 2, hi: 5 });
    const wood = mat(c, 'brown', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
    c.box(3, 3.4, 22, 1.6, { mat: card, z: 1, r: 0.3 });
    c.box(13, 2.6, 15, 1.1, { mat: wood, z: 1.2, r: 0.3 });
    const ink = top('navy', d, 2);
    c.paint(4, 3.4, 20, 1.2, (x) => (Math.floor(x * (d === 1 ? 1 : 2)) % 3 !== 0 ? ink : 0), 9);
    return [frame(finishA(c, 0.2), 15, 5, d)];
  },
  { defer: true },
);

// ---------------------------------------------------------------------------------------------
// Road props: the barrel, the crate
// ---------------------------------------------------------------------------------------------

/** The ketting's blue plastic drum (12 × 15; anchor: the ground under its middle). */
def(ACT_ART.barrel, (d) => {
  const c = new HdCanvas(16, 18, d);
  const blue = mat(c, 'sky', { spec: 0.7, shine: 24, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const rim = mat(c, 'navy', { spec: 0.5, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const steel = mat(c, 'steel', { spec: 1.1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  c.cylinder(2, 2, 12, 15, {
    mat: blue,
    z: 1,
    cap: 1.4,
    tex: (t) => {
      // Two moulded ribs, scuffs at the foot.
      const yy = t.y;
      if (Math.abs(yy - 7) < 0.6 || Math.abs(yy - 12) < 0.6) t.mat = rim;
      if (yy > 15 && hash(Math.floor(t.x * 2), 3) > 0.6) t.tone -= 0.2;
    },
  });
  // The chain's ring bolted on the side (the chain hooks here).
  c.ellipsoid(13.6, 9.2, 1.2, 1.2, { mat: steel, z: 2 });
  return [frame(finishC(c, 0.3), 8, 17, d)];
});

/** The megafoon's wooden fruit crate (16 × 9; anchor: the ground under its middle). */
def(ACT_ART.crate, (d) => {
  const c = new HdCanvas(20, 12, d);
  const wood = mat(c, 'sand', { spec: 0.2, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const dark = mat(c, 'brown', { spec: 0.2, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const part = c.newPart();
  // Three slats with gaps, two posts at the ends, a stencilled band at 4×.
  for (let i = 0; i < 3; i++) c.box(2, 2.4 + i * 3, 16, 2.4, { mat: wood, z: 1, part, r: 0.2, tex: (t) => (hash(Math.floor(t.x * 1.2), i) > 0.85 ? void (t.tone -= 0.15) : undefined) });
  c.box(2, 2, 2, 9, { mat: dark, z: 1.3, r: 0.2 });
  c.box(16, 2, 2, 9, { mat: dark, z: 1.3, r: 0.2 });
  return [frame(finishC(c, 0.3), 10, 11, d)];
});

// ---------------------------------------------------------------------------------------------
// Thrown things
// ---------------------------------------------------------------------------------------------

/** A paint balloon of `colour` (8 × 8, centre anchor): a fat water balloon, the knot behind. */
function balloonBuf(colour: string, k: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(9, 9, d);
  const skin = mat(c, colour, { spec: 1.2, shine: 46, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const sq = k === 0 ? 0 : 0.35;
  c.ellipsoid(4.6, 4.8, 3 + sq, 3 - sq, { mat: skin, z: 1 });
  c.capsule(1.6, 3.4, 0.9, 2.6, 0.6, 0.4, { mat: skin, z: 0.8 });
  return finishA(c, 0.15);
}
for (const col of PAINT_COLOURS) def(`${ACT_ART.balloon}-${col}`, (d) => [0, 1].map((k) => frame(balloonBuf(col, k, d), 4.5, 4.5, d)), { ticksPerFrame: 6 });

/** The glue tin (centre anchor), tumbling: `deg` turns it. */
function potBuf(deg: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(10, 10, d);
  const tin = mat(c, 'steel', { spec: 1.1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const label = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const band = mat(c, 'gold', { spec: 0.3, lo1: 1, hi1: 3 });
  const wood = mat(c, 'brown', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const P = (s: number, q = 0): [number, number] => [5 + s * ux - q * uy, 5 + s * uy + q * ux];
  c.poly([P(-2.6, -2.1), P(2.6, -2.1), P(2.6, 2.1), P(-2.6, 2.1)], {
    mat: tin,
    z: 1,
    round: 0.6,
    tex: (t) => {
      const s = (t.x - 5) * ux + (t.y - 5) * uy;
      if (s > -1.4 && s < 1.2) t.mat = label;
      if (s > -0.4 && s < 0.3) t.mat = band;
    },
  });
  // The brush handle sticking out of the lid.
  c.capsule(...P(-2.6, 0.6), ...P(-4.4, 0.9), 0.5, 0.45, { mat: wood, z: 1.4 });
  return finishA(c, 0.15);
}
def(ACT_ART.pot, (d) => [0, 90, 180, 270].map((deg) => frame(potBuf(deg - 90, d), 5, 5, d)), { ticksPerFrame: 4 });

/** The soup can (centre anchor), tumbling: an orange label with a white band, no brand. */
function canBuf(deg: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(9, 9, d);
  const tin = mat(c, 'steel', { spec: 1.2, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const label = mat(c, 'orange', { spec: 0.3, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const white = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const Q = (s: number, q: number): [number, number] => [4.5 + s * ux - q * uy, 4.5 + s * uy + q * ux];
  c.poly([Q(-2.6, -1.8), Q(2.6, -1.8), Q(2.6, 1.8), Q(-2.6, 1.8)], {
    mat: label,
    z: 1,
    round: 0.6,
    tex: (t) => {
      const s = (t.x - 4.5) * ux + (t.y - 4.5) * uy;
      if (Math.abs(s) > 2) t.mat = tin;
      else if (Math.abs(s) < 0.35) t.mat = white;
    },
  });
  return finishA(c, 0.15);
}
def(ACT_ART.can, (d) => [0, 90, 180, 270].map((deg) => frame(canBuf(deg - 90, d), 4.5, 4.5, d)), { ticksPerFrame: 4 });

// ---------------------------------------------------------------------------------------------
// Decals on the road
// ---------------------------------------------------------------------------------------------

/** A flat puddle shape: an ellipse with lobes (`lobes` [dx, rx]) and drops. */
function puddle(c: HdCanvas, cx: number, cy: number, rx: number, ry: number, m: number, seed: number, lobes: readonly (readonly [number, number])[]): void {
  const part = c.newPart();
  c.ellipsoid(cx, cy, rx, ry, { mat: m, z: 0.2, round: 0.25, part });
  for (const [dx, r] of lobes) c.ellipsoid(cx + dx, cy + (hash(seed, dx) - 0.5) * 0.6, r, ry * 0.8, { mat: m, z: 0.2, round: 0.25, part });
}

/** A paint splat on the road (one frame per colour; 20 × 6, anchor: the ground under the middle). */
def(ACT_ART.splat, (d) =>
  PAINT_COLOURS.map((col, i) => {
    const c = new HdCanvas(22, 7, d);
    const m = mat(c, col, { spec: 1.1, shine: 40, lo1: 0, hi1: 3, lo: 1, hi: 5 });
    puddle(c, 11, 4.6, 6, 1.7, m, i, [
      [-5.5, 2],
      [5, 2.4],
      [1.5, 2.6],
    ]);
    // Flecks flung out.
    c.ellipsoid(2, 4.6, 0.9, 0.6, { mat: m, z: 0.3, round: 0.3 });
    c.ellipsoid(19.6, 4.2, 0.8, 0.6, { mat: m, z: 0.3, round: 0.3 });
    c.ellipsoid(14 + i, 2.6, 0.7, 0.5, { mat: m, z: 0.3, round: 0.3 });
    return frame(finishDecal(c), 11, 6, d);
  }),
);

/** The tomato soup (ORANGE, never red) with the dented can lying in it (anchor: ground middle). */
def(ACT_ART.soup, (d) => {
  const c = new HdCanvas(24, 8, d);
  const soup = mat(c, 'orange', { spec: 1.1, shine: 36, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  puddle(c, 12, 5.6, 7, 1.6, soup, 5, [
    [-6, 2.2],
    [6, 2],
  ]);
  // The can on its side, dented, the lid peeled.
  const tin = mat(c, 'steel', { spec: 1.2, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const label = mat(c, 'orange', { spec: 0.3, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  c.capsule(13, 4.2, 17.4, 4.6, 1.6, 1.6, { mat: label, z: 1.2, tex: (t) => (t.x > 16.6 || t.x < 13.6 ? void (t.mat = tin) : undefined) });
  c.ellipsoid(15, 3.2, 0.7, 0.5, { mat: label, z: 1.4, tone: -0.4 });
  return [frame(finishDecal(c), 12, 7, d)];
});

/** The glue puddle (26 × 4; 4 frames: spreading, wet ×2 with the shine moving, dried and cracked). */
def(ACT_ART.glue, (d) =>
  [0, 1, 2, 3].map((f) => {
    const c = new HdCanvas(30, 7, d);
    const glue = mat(c, 'snow', { spec: f === 3 ? 0.2 : 1.4, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6 });
    const dry = mat(c, 'sand', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
    const tinM = mat(c, 'steel', { spec: 1.1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6 });
    const k = f === 0 ? 0.55 : 1;
    puddle(c, 15, 4.8, 12 * k, 1.6, f === 3 ? dry : glue, 9, [
      [-9 * k, 2.4 * k],
      [8 * k, 2.6 * k],
    ]);
    // Bubbles in the wet glue and a moving shine; cracks when dry.
    if (f === 1 || f === 2) {
      c.ellipsoid(f === 1 ? 10 : 18, 4.3, 1.2, 0.5, { mat: glue, z: 0.4, tone: 0.5, round: 0.6 });
      if (d > 1) c.ellipsoid(13.5, 5, 0.5, 0.4, { mat: glue, z: 0.45, tone: 0.3 });
    }
    if (f === 3 && d > 1) c.shade(5, 4, 20, 2, (x) => (Math.abs(((x * 1.7) % 4) - 2) < 0.2 ? -0.3 : 0));
    // Shards of the tin.
    if (f > 0) {
      c.box(20.5, 3.6, 2, 1.2, { mat: tinM, z: 1, r: 0.2 });
      c.box(8, 4.2, 1.4, 0.9, { mat: tinM, z: 1, r: 0.2 });
    }
    return frame(finishDecal(c), 15, 6, d);
  }),
);

// ---------------------------------------------------------------------------------------------
// Sound and glue
// ---------------------------------------------------------------------------------------------

/** The shout ring (3 frames: three arcs that grow; 14 tall; anchor: the ground under the front). */
def(ACT_ART.shout, (d) =>
  [0, 1, 2].map((f) => {
    const c = new HdCanvas(16, 17, d);
    const ring = mat(c, 'sky', { flat: true, lo1: 1, hi1: 3, lo: 3, hi: 6 });
    const core = mat(c, 'snow', { flat: true, lo1: 2, hi1: 3, lo: 4, hi: 7 });
    for (let i = 0; i < 3; i++) {
      const r = 3 + i * 3 + f * 0.8;
      const pts: [number, number][] = [];
      for (let a = -60; a <= 60; a += 12) {
        const t = (a * Math.PI) / 180;
        pts.push([2 + Math.cos(t) * r, 9 + Math.sin(t) * r * 0.95]);
      }
      c.stroke(pts, 0.55 - i * 0.08, 0.55 - i * 0.08, { mat: i === 0 ? core : ring, z: 1 + i * 0.1, tone: 0.4 - i * 0.2 });
    }
    return frame(finishA(c, 0), 4, 16, d);
  }),
);

/** The feedback squeal (3 frames: zig-zag whine lines out of the megaphone; anchor: its mouth). */
def(ACT_ART.squeal, (d) =>
  [0, 1, 2].map((f) => {
    const c = new HdCanvas(22, 13, d);
    const hot = mat(c, 'gold', { flat: true, lo1: 2, hi1: 3, lo: 3, hi: 6 });
    const pale = mat(c, 'snow', { flat: true, lo1: 2, hi1: 3, lo: 4, hi: 7 });
    for (let i = 0; i < 3; i++) {
      const y0 = 3 + i * 3.5;
      const pts: [number, number][] = [];
      for (let x = 1; x <= 19; x += 2) pts.push([x, y0 + ((Math.floor(x / 2) + f + i) % 2 === 0 ? -1 : 1) * (0.6 + x * 0.04)]);
      c.stroke(pts, 0.4, 0.3, { mat: i === 1 ? pale : hot, z: 1 + i * 0.1 });
    }
    return frame(finishA(c, 0), 0, 6.5, d);
  }),
);

/** A music note of the hum (2: a quaver, two beamed quavers; anchor: the note head). */
def(ACT_ART.note, (d) =>
  [0, 1].map((f) => {
    const c = new HdCanvas(8, 9, d);
    const ink = mat(c, 'navy', { spec: 0.3, lo1: 0, hi1: 2, lo: 1, hi: 4 });
    c.ellipsoid(2.2, 7, 1.4, 1, { mat: ink, z: 1 });
    c.box(3, 1.5, 0.7, 5.6, { mat: ink, z: 1, round: 0 });
    if (f === 0) c.capsule(3.3, 1.6, 5, 3.4, 0.45, 0.3, { mat: ink, z: 1 });
    else {
      c.ellipsoid(5.8, 6.4, 1.4, 1, { mat: ink, z: 1 });
      c.box(6.6, 1, 0.7, 5.4, { mat: ink, z: 1, round: 0 });
      c.box(3, 1, 4.3, 1, { mat: ink, z: 1, round: 0 });
    }
    return frame(finishA(c, 0), 2, 7, d);
  }),
);

/** Glue strands from a hero's boots to the road (4: stretched, longer, thin, sagging; anchor: the feet). */
def(ACT_ART.strands, (d) =>
  [0, 1, 2, 3].map((f) => {
    const c = new HdCanvas(18, 8, d);
    const glue = mat(c, 'snow', { spec: 1.2, shine: 46, lo1: 1, hi1: 3, lo: 3, hi: 6 });
    c.ellipsoid(9, 6.6, 7, 0.9, { mat: glue, z: 0.2, round: 0.3 });
    const reach = [3.4, 4.2, 4.8, 2][f];
    const w = f === 2 ? 0.25 : 0.4;
    for (const x of [4, 7.5, 11, 14]) {
      const sag = f === 3 ? 1 : 0;
      c.stroke(
        [
          [x, 6.4],
          [x + sag * 0.6, 6.4 - reach * 0.5],
          [x + 0.4, 6.4 - reach],
        ],
        w + 0.15,
        w,
        { mat: glue, z: 1 },
      );
    }
    return frame(finishA(c, 0), 9, 7, d);
  }),
);

/** The chain from a sitter's waist back to the barrel / the partner (2: whole, snapped; anchor: the sitter's feet, facing right). */
def(ACT_ART.links, (d) =>
  [0, 1].map((f) => {
    const c = new HdCanvas(24, 12, d);
    const steel = mat(c, 'steel', { spec: 1.3, shine: 50, lo1: 1, hi1: 3, lo: 2, hi: 6 });
    // From the waist (x 22, y 6) back to the barrel's ring (x 8.5, y 3.5), sagging; snapped: two short ends.
    const link = (x: number, y: number, k: number): void => {
      if (k % 2 === 0) c.ellipsoid(x, y, 0.95, 0.55, { mat: steel, z: 1 + (k % 3) * 0.01 });
      else c.ellipsoid(x, y, 0.5, 0.75, { mat: steel, z: 1.05 });
    };
    const n = 13;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const x = 22 - u * 13.5;
      let y = 6 - u * 2.5 + Math.sin(u * Math.PI) * 2.2;
      if (f === 1) {
        if (u > 0.35 && u < 0.65) continue;
        // The two ends hang down.
        y += u <= 0.35 ? u * 6 : (1 - u) * 5;
      }
      link(x, y, k);
    }
    return frame(finishA(c, 0.1), 23, 11, d);
  }),
);
