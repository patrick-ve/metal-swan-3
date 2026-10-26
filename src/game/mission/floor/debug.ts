/**
 * The debug floor (docs/design/floor.md §3.9, docs/api/floor.md §8): a registered painter that
 * shows the geometry — a checker of 16 px world cells, darker lines every 64 px with u / v labels,
 * a red line at v = 0 (the walk line), every feature tinted by its index — plus coloured face tiles,
 * an animated debug water, a thin post prop for rows, and `debugFloorDef(section)`, a floor for ANY
 * section (tools: `npm run shot -- --floor-debug`, `npm run floor-clip -- --floor-debug`): the
 * mission's camera of spec §1.1, two kerbs, a cut on every water hazard (ams a: the side canal),
 * a back and a front post row.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import type { SectionDef } from '../types';
import { defineFloorPainter, defineFloorProp, defineFloorTile, hasFloorPainter } from './registry';
import type { FloorDef, FloorFeature } from './types';

/** 3 × 5 digit glyphs (rows top → bottom, bit 2 = left column) for 0-9 and '-'. */
const GLYPHS: Record<string, readonly number[]> = {
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 3, 1, 7],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7],
  '7': [7, 1, 2, 2, 2],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
  '-': [0, 0, 7, 0, 0],
};

/** World px per glyph pixel along u and along v (v is foreshortened, so taller). */
const GU = 1;
const GV = 2;

/** Is world point (u, v) inside the label `text` whose top-left is at (u0, v0)? */
function inLabel(text: string, u0: number, v0: number, u: number, v: number): boolean {
  const gx = Math.floor((u - u0) / GU);
  const gy = Math.floor((v - v0) / GV);
  if (gy < 0 || gy >= 5 || gx < 0) return false;
  const ci = Math.floor(gx / 4);
  if (ci >= text.length) return false;
  const col = gx % 4;
  if (col === 3) return false;
  const g = GLYPHS[text[ci]];
  return g !== undefined && ((g[gy] >> (2 - col)) & 1) === 1;
}

/** Feature tints (by feature index; −2 = a pit). */
const TINTS: readonly Color[] = [0xe0a040ff, 0x40b0e0ff, 0xa060e0ff, 0x60d070ff, 0xe06090ff, 0xd0d040ff];

function blend(a: Color, b: Color, k: number): Color {
  const r = Math.round((a >>> 24) * (1 - k) + (b >>> 24) * k);
  const g = Math.round(((a >>> 16) & 255) * (1 - k) + ((b >>> 16) & 255) * k);
  const bl = Math.round(((a >>> 8) & 255) * (1 - k) + ((b >>> 8) & 255) * k);
  return ((r << 24) | (g << 16) | (bl << 8) | 255) >>> 0;
}

/** Register the debug painter, tiles and prop (once; the view does it for a debug def). */
export function ensureDebugFloor(): void {
  if (hasFloorPainter('floor/debug')) return;
  defineFloorPainter('floor/debug', (c) => {
    // Pixel art at the density: a 1-texel line is 1/d world px wide.
    const line = 1 / c.d;
    return (u, v) => {
      // Labels: u every 64 px just behind the walk line; v every 32 px at u ≡ 24 (mod 64).
      const lu = Math.floor(u / 64) * 64;
      if (inLabel(String(lu), lu + 2, -14, u, v)) return 0x101010ff;
      const lv = Math.round(v / 32) * 32;
      if (lv !== 0 && inLabel(String(lv), lu + 24, lv - 5, u, v)) return 0xf8f8f8ff;
      if (Math.abs(v) < 0.75) return 0xe02020ff;
      let col: Color = ((Math.floor(u / 16) + Math.floor(v / 16)) & 1) === 0 ? 0x9c9c9cff : 0x7c7c7cff;
      const mu = ((u % 64) + 64) % 64;
      const mv = ((v % 64) + 64) % 64;
      if (mu < line || mv < line) col = 0x4a4a4aff;
      const k = c.featureAt(u, v);
      if (k >= 0) col = blend(col, TINTS[k % TINTS.length], 0.45);
      return col;
    };
  });
  defineFloorTile('floor/debug-face', {
    w: 16,
    h: 8,
    paint: (a, b) => (b < 1 ? 0xffe8a0ff : ((Math.floor(a / 4) & 1) === 0 ? 0xe08020ff : 0xb05010ff)),
  });
  defineFloorTile('floor/debug-quay', {
    w: 16,
    h: 8,
    paint: (a, b) => {
      const row = Math.floor(b / 4);
      const off = row & 1 ? 4 : 0;
      const joint = Math.floor(b) % 4 === 3 || Math.floor(a + off) % 8 === 7;
      return joint ? 0x3a2418ff : row & 1 ? 0x8a3a24ff : 0x9c4a2cff;
    },
  });
  // Water: diagonal ripple bands (two layers drift against each other).
  defineFloorTile('floor/debug-water', {
    w: 32,
    h: 16,
    paint: (a, b) => {
      const t = ((a + 2 * b) % 16 + 16) % 16;
      return t < 2 ? 0x8ad0f0ff : t < 8 ? 0x2c6aa8ff : 0x1e5590ff;
    },
  });
  defineFloorTile('floor/debug-water2', {
    w: 24,
    h: 12,
    paint: (a, b) => {
      const t = ((a - 2 * b) % 12 + 12) % 12;
      return t < 1.5 ? 0xb8e8ffff : 0x24609cff;
    },
  });
  defineFloorProp('floor/debug-post', debugPost);
}

/** A thin post 3 × 18 px (at scale 1) with a red cap and a chain point; feet anchor. */
function debugPost(scale: number, d: number): Frame {
  const w = Math.max(2, Math.round(4 * scale));
  const h = Math.max(4, Math.round(18 * scale));
  const W = w * d;
  const H = h * d;
  const b = new PixelBuffer(W, H);
  const cap = Math.max(1, Math.round(3 * scale * d));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || x === W - 1;
      b.data[y * W + x] = y < cap ? 0xd02828ff : edge ? 0x1a1a22ff : 0x3c3c48ff;
    }
  }
  b.touch();
  return { buf: b, ox: w / 2, oy: h, density: d, pts: { chain: [0, -h * 0.7] } };
}

/** The spec §1.1 camera of a section (by mission and section id; default the `ams` one). */
export function specCamera(mission: string, section: string): FloorDef['camera'] {
  if (mission === 'oldenzaal' || section.startsWith('oz-')) {
    if (section === 'oz-c') return { yh: 56, f: 200, back: 150 };
    if (section === 'oz-d') return { yh: 58, f: 200, back: 148 };
    if (section === 'oz-e') return { yh: 64, f: 190, back: 160 };
    return { yh: 56, f: 200, back: 162 };
  }
  return { yh: 60, f: 210, back: 146 };
}

/**
 * A debug floor for any section: the spec camera, a far pavement (a 1.5 px kerb two thirds of the
 * way to the back edge), a near pavement (from depth −16.5), a cut with debug water and quay walls on every water hazard,
 * post rows on both kerbs.
 */
export function debugFloorDef(section: SectionDef, mission = ''): FloorDef {
  ensureDebugFloor();
  const camera = specCamera(mission, section.id);
  const yw = 176;
  // The far kerb two thirds of the way to the back edge (ams: depth 20 of 30; oz-a: 9.3 of 14).
  const behind = yw - camera.back;
  const farKerb = Math.round(behind * 0.66 * 10) / 10;
  const features: FloorFeature[] = [
    { kind: 'kerb', to: farKerb, dh: 1.5, face: 'floor/debug-face' },
    { kind: 'kerb', from: -16.5, dh: 1.5, face: 'floor/debug-face' },
  ];
  const gaps: [number, number][] = [];
  for (const h of section.terrain.hazards ?? []) {
    if (h.kind !== 'water' || h.w < 8) continue;
    features.push({
      kind: 'cut',
      u0: h.x,
      u1: h.x + h.w,
      level: yw - h.y,
      surface: { tile: 'floor/debug-water', du: 0.12, over: { tile: 'floor/debug-water2', du: -0.08, alpha: 0.4 } },
      face: 'floor/debug-quay',
    });
    gaps.push([h.x - 12, h.x + h.w + 12]);
  }
  return {
    camera,
    painter: { id: 'floor/debug' },
    features,
    baseFace: 'floor/debug-face',
    rows: [
      { name: 'debug back', prop: 'floor/debug-post', depth: farKerb - 0.6, spacing: 34, offset: 8, gaps, link: { sag: 3, colors: [0xc8c8d0ff, 0x60606aff] } },
      { name: 'debug front', prop: 'floor/debug-post', depth: -16.5, spacing: 68, offset: 20, gaps },
    ],
    shadow: 0.35,
  };
}
