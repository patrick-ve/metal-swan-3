/**
 * `ui/logo` (GDD §13.3, restyled 2026-10-16 by docs/design/squad.md §2.3): METAL / SWAN as
 * riveted army-green plates with gunmetal rims, stencil gaps and scratches, and a large gold 3
 * whose top curls into a swan's neck and head with an orange beak. Top-left anchored, about
 * 196 × 64 px (it sits at C, y 18–84 on the title).
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { Rng } from '../../../engine/rng';
import { defineSprite } from '../../../engine/sprites';
import { HdCanvas } from '../../art/hd/index';
import { noise2 } from '../../art/paint';
import { contourCells, insideDist, stencilMask, type HdD } from './military.art';

const MASK: Color = 0xff00ffff;

/**
 * Riveted army plates (docs/design/squad.md §2.3): the big font at `scale` with stencil gaps
 * (military.art.ts `stencilMask`), army-green paint lighter toward the top of each letter, a
 * gunmetal rim (lit top-left, dark bottom-right), a gunmetal seam with a lit line under it, steel
 * rivets above and below the seam, and scratches of bare metal.
 */
function plateLetters(text: string, scale: number): PixelBuffer {
  const m = stencilMask(text, scale, 1);
  const b = new PixelBuffer(m.w, m.h);
  const on = (x: number, y: number): boolean => m.get(x, y) === MASK;
  const glyphH = 8 * scale;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!on(x, y)) continue;
      const row = y - 1;
      let c: Color = row < glyphH * 0.4 ? PAL.olive[3] : row < glyphH * 0.75 ? PAL.olive[2] : PAL.olive[1];
      if (!on(x - 1, y) || !on(x, y - 1)) c = PAL.steel[3];
      if (!on(x + 1, y) || !on(x, y + 1)) c = PAL.steel[0];
      else if (!on(x + 2, y) || !on(x, y + 2)) c = PAL.olive[0];
      b.set(x, y, c);
    }
  }
  // The gunmetal seam across each letter at mid height, with a lit line under it.
  const seam = 1 + Math.round(glyphH * 0.5);
  for (let x = 0; x < b.w; x++) {
    if (on(x, seam) && on(x - 1, seam) && on(x + 1, seam)) b.set(x, seam, PAL.steel[1]);
    if (on(x, seam + 1) && on(x, seam) && on(x - 1, seam + 1) && on(x + 1, seam + 1)) b.set(x, seam + 1, PAL.olive[3]);
  }
  // Scratches: short diagonal strokes of bare steel with a dark lip, inside the paint only.
  const rng = new Rng(`logo:${text}`);
  const inside = (x: number, y: number): boolean => on(x, y) && on(x - 2, y) && on(x + 2, y) && on(x, y - 2) && on(x, y + 2);
  for (let i = 0; i < Math.floor(b.w / 9); i++) {
    const x0 = rng.int(3, b.w - 6);
    const y0 = rng.int(3, b.h - 6);
    for (let k = 0; k < 4; k++) {
      const x = x0 + k;
      const y = y0 + (k >> 1);
      if (!inside(x, y) || y === seam || y === seam + 1) continue;
      b.set(x, y, PAL.steel[2]);
      if (inside(x, y + 1)) b.set(x, y + 1, PAL.olive[0]);
    }
  }
  // Rivets: on solid stroke centres along two bands above and below the seam.
  const step = 2 * scale;
  for (const ry of [1 + scale + 1, seam + scale + 1]) {
    for (let x = scale; x < b.w - 1; x += step) {
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1 && solid; dx++) solid = on(x + dx, ry + dy);
      if (!solid) continue;
      b.set(x, ry, PAL.steel[4]);
      b.set(x + 1, ry + 1, PAL.steel[1]);
    }
  }
  return b;
}

/**
 * The gold 3: two bowls of thick strokes; the top stroke's left end rises into an S-curved
 * neck and a head looking right, with an orange beak and an ink eye.
 */
function swanThree(): PixelBuffer {
  const w = 54;
  const h = 66;
  const m = new PixelBuffer(w, h);
  const stroke = (pts: readonly number[], width: number): void => {
    for (let i = 0; i + 3 < pts.length; i += 2) m.thickLine(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width, MASK);
  };
  // Top bowl (from the neck root round to the middle notch) and the bottom bowl.
  stroke([12, 26, 20, 20, 30, 19, 38, 22, 41, 29, 37, 35, 28, 39, 22, 40], 9);
  stroke([22, 40, 31, 41, 39, 45, 43, 52, 40, 59, 31, 63, 20, 63, 10, 59], 9);
  // The neck: up from the top bowl's left end in an S, thinner toward the head.
  stroke([12, 26, 8, 20, 7, 14, 10, 9], 7);
  stroke([10, 9, 15, 6], 6);
  // Head (a round dome) facing right.
  m.ellipse(13, 1, 11, 9, MASK);
  const b = new PixelBuffer(w, h);
  const on = (x: number, y: number): boolean => m.get(x, y) === MASK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      // Gold, lit from the top left; a dark rim on the bottom right; a warm core.
      let c: Color = PAL.gold[2];
      if (!on(x - 1, y) || !on(x, y - 1) || !on(x - 1, y - 1)) c = PAL.gold[3];
      else if (!on(x - 2, y) || !on(x, y - 2)) c = PAL.gold[3];
      if (!on(x + 1, y) || !on(x, y + 1)) c = PAL.orange[1];
      else if (!on(x + 2, y) || !on(x, y + 2) || !on(x + 1, y + 1)) c = PAL.gold[1];
      b.set(x, y, c);
    }
  }
  // Glints on the bowls.
  b.set(23, 20, PAL.snow[3]);
  b.set(24, 20, PAL.snow[3]);
  b.set(33, 42, PAL.snow[3]);
  // The beak: orange, from the dome's front to a steel tip; an ink eye with a gold lens ring.
  for (let i = 0; i < 9; i++) {
    const x = 23 + i;
    b.set(x, 5, i < 8 ? PAL.orange[3] : PAL.steel[3]);
    if (i < 7) b.set(x, 6, PAL.orange[2]);
    if (i < 4) b.set(x, 7, PAL.orange[1]);
  }
  b.set(19, 4, PAL.navy[0]);
  b.set(20, 5, PAL.navy[0]);
  b.set(21, 5, PAL.navy[0]);
  b.set(17, 3, PAL.gold[3]);
  b.set(18, 3, INK);
  b.set(17, 4, INK);
  b.set(18, 4, PAL.snow[3]);
  return b;
}

/** A drop shadow: the silhouette of `src` in `c`, `d` px down and right, under `src`. */
function withShadow(src: PixelBuffer, c: Color, d: number): PixelBuffer {
  const out = new PixelBuffer(src.w + d, src.h + d);
  out.blit(src, d, d, { solid: c });
  out.blit(src, 0, 0);
  return out;
}

function logo(): Frame[] {
  const metal = plateLetters('METAL', 3);
  const swan = plateLetters('SWAN', 3);
  const three = swanThree();
  const gap = 4;
  const left = Math.max(metal.w, swan.w);
  const w = left + gap + three.w + 6;
  const h = 66;
  const b = new PixelBuffer(w, h);
  // METAL over SWAN (SWAN centred under METAL), the 3 at the right spanning both lines.
  const top = h - (metal.h + 3 + swan.h) - 1;
  b.blit(metal, 1, top);
  b.blit(swan, 1 + ((metal.w - swan.w) >> 1), top + metal.h + 3);
  b.blit(three, left + gap, 0);
  b.outline(INK);
  return [{ buf: withShadow(b, PAL.navy[0], 2), ox: 0, oy: 0 }];
}


// ---------------------------------------------------------------------------------------------
// HD (2× and 4×): the same logo painted natively (docs/ART_GUIDE.md "UHD art")
// ---------------------------------------------------------------------------------------------

/** The logo's layout in logical px (shared by the 1× and the HD drawer). */
interface LogoLayout {
  w: number;
  h: number;
  metal: { x: number; y: number; text: string };
  swan: { x: number; y: number; text: string };
  threeX: number;
}

function logoLayout(): LogoLayout {
  const size = (t: string): { w: number; h: number } => {
    const m = stencilMask(t, 3, 1);
    return { w: m.w, h: m.h };
  };
  const metal = size('METAL');
  const swan = size('SWAN');
  const gap = 4;
  const left = Math.max(metal.w, swan.w);
  const w = left + gap + 54 + 6;
  const h = 66;
  const top = h - (metal.h + 3 + swan.h) - 1;
  return { w, h, metal: { x: 1, y: top, text: 'METAL' }, swan: { x: 1 + ((metal.w - swan.w) >> 1), y: top + metal.h + 3, text: 'SWAN' }, threeX: left + gap };
}

/**
 * One word of riveted army plate at density d into the canvas: the stencilled big font at
 * scale 3 with 45° stair cuts, a chamfered gunmetal rim (lit top-left), army-green enamel lighter
 * toward the top, a seam across the middle with a lit line under it, rivets above and below it,
 * scratches and chipped edges of bare steel. (ox, oy) = the 1× plate buffer's top-left.
 */
function plateWordHd(c: HdCanvas, text: string, ox: number, oy: number, mats: { olive: number; rim: number; bare: number; rivet: number }): void {
  const d = c.d;
  const m1 = stencilMask(text, 1, 0);
  const m3 = stencilMask(text, 3, 1);
  const cw = m1.w;
  const ch = m1.h;
  const on1 = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < cw && y < ch && m1.get(x, y) === MASK;
  const cell = 3 * d;
  const mw = cw * cell;
  const mh = ch * cell;
  const mk = contourCells(on1, cw, ch, cell);
  const dist = insideDist(mk, mw, mh);
  const gx = ox + 1;
  const gy = oy + 1;
  const at = (x: number, y: number): number => {
    const X = Math.floor((x - gx) * d);
    const Y = Math.floor((y - gy) * d);
    return X < 0 || Y < 0 || X >= mw || Y >= mh ? 0 : dist[Y * mw + X];
  };
  const glyphH = 24;
  const seam = oy + 1 + Math.round(glyphH * 0.5);
  const B = 0.9;
  const rng = new Rng(`logo-hd:${text}`);
  const scr: Array<[number, number, number, number]> = [];
  for (let i = 0; i < Math.floor(m3.w / 8); i++) {
    const x0 = gx + rng.range(2, m3.w - 6);
    const y0 = gy + rng.range(2, m3.h - 6);
    const l = rng.range(2.5, 5);
    scr.push([x0, y0, x0 + l, y0 + l * 0.45]);
  }
  const part = c.newPart();
  c.heightField(gx, gy, cw * 3, ch * 3, (x, y) => {
    const e = at(x, y);
    if (e === 0) return NaN;
    let h = Math.min(1, (e - 0.5) / (B * d)) * B;
    if (y >= seam && y < seam + 0.75) h -= 0.3;
    return h;
  }, {
    mat: mats.olive,
    part,
    z: 0,
    tex: (s) => {
      const e = (at(s.x, s.y) - 0.5) / d;
      if (e < B * 0.95) {
        s.mat = mats.rim;
        return;
      }
      const row = (s.y - gy) / glyphH;
      s.tone += 0.28 - row * 0.55;
      if (s.y >= seam && s.y < seam + 0.75) {
        s.mat = mats.rim;
        s.tone -= 0.2;
        return;
      }
      if (s.y >= seam + 0.75 && s.y < seam + 0.75 + 1 / d) s.tone += 0.35;
      // Chipped enamel near the rim, scratches of bare steel with a dark lip.
      if (e < B + 0.6 && noise2(s.x, s.y, 0.8, 701) > 0.8) {
        s.mat = mats.bare;
        return;
      }
      for (const [x0, y0, x1, y1] of scr) {
        const vx = x1 - x0;
        const vy = y1 - y0;
        let t = ((s.x - x0) * vx + (s.y - y0) * vy) / (vx * vx + vy * vy);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const q = Math.hypot(x0 + t * vx - s.x, y0 + t * vy - s.y);
        if (q < 0.25) {
          s.mat = mats.bare;
          s.tone += 0.1;
        } else if (q < 0.25 + 1 / d && s.y > y0 + t * vy) s.tone -= 0.35;
      }
    },
  });
  // Rivets on solid stroke centres along the bands above and below the seam (the 1× rule).
  const on3 = (x: number, y: number): boolean => m3.get(x, y) === MASK;
  for (const ry of [1 + 3 + 1, 1 + Math.round(glyphH * 0.5) + 3 + 1]) {
    for (let x = 3; x < m3.w - 1; x += 6) {
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1 && solid; dx++) solid = on3(x + dx, ry + dy);
      if (solid) c.ellipsoid(ox + x + 0.5, oy + ry + 0.5, 0.85, 0.85, { mat: mats.rivet, z: B, round: 0.85 });
    }
  }
}

/**
 * The gold 3 at density d: polished gold tubes along the 1× strokes (two bowls, the S-neck
 * thinning toward the head), a domed head with the orange beak and its steel tip, an ink eye in
 * a gold lens ring. (ox, oy) = the 1× three's top-left.
 */
function swanThreeHd(c: HdCanvas, ox: number, oy: number, mats: { gold: number; beak: number; tip: number }): void {
  // The 1× stroke points (px centres) as a smooth Catmull-Rom path, a point every ~½ px.
  const P = (pts: readonly number[]): Array<[number, number]> => {
    const k: Array<[number, number]> = [];
    for (let i = 0; i + 1 < pts.length; i += 2) k.push([ox + pts[i] + 0.5, oy + pts[i + 1] + 0.5]);
    const out: Array<[number, number]> = [k[0]];
    for (let i = 0; i + 1 < k.length; i++) {
      const p0 = k[Math.max(0, i - 1)];
      const p1 = k[i];
      const p2 = k[i + 1];
      const p3 = k[Math.min(k.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
      for (let j = 1; j <= n; j++) {
        const t = j / n;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a0: number, a1: number, a2: number, a3: number): number =>
          0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    return out;
  };
  const part = c.newPart();
  const o = { mat: mats.gold, part, z: 1 };
  c.stroke(P([12, 26, 20, 20, 30, 19, 38, 22, 41, 29, 37, 35, 28, 39, 22, 40]), 4.5, 4.5, o);
  c.stroke(P([22, 40, 31, 41, 39, 45, 43, 52, 40, 59, 31, 63, 20, 63, 10, 59]), 4.5, 4.5, o);
  c.stroke(P([12, 26, 8, 20, 7, 14, 10, 9]), 3.6, 3.1, o);
  c.stroke(P([10, 9, 15, 6]), 3.1, 3, o);
  c.ellipsoid(ox + 18.5, oy + 5.5, 5.5, 4.6, { ...o, z: 1.5 });
  // The beak: a tapered cone to the right, its steel tip; the gape a dark line.
  const bp = c.newPart();
  c.capsule(ox + 22.5, oy + 6.4, ox + 30.6, oy + 5.7, 1.55, 0.55, { mat: mats.beak, part: bp, z: 3 });
  c.ellipsoid(ox + 31.2, oy + 5.65, 0.7, 0.55, { mat: mats.tip, z: 3.2 });
  c.paint(ox + 23.2, oy + 6.35, 6.5, 0.3, (x) => (x < ox + 29 ? PAL_HD.orange[0] : 0));
  // Eye: a gold lens ring round an ink pupil with a catchlight; the brow line over it.
  c.paint(ox + 15.9, oy + 2.4, 3.2, 3.2, (x, y) => {
    const r = Math.hypot(x - (ox + 17.5), y - (oy + 4));
    return r < 0.95 ? (Math.hypot(x - (ox + 17.25), y - (oy + 3.7)) < 0.32 ? PAL_HD.snow[6] : PAL_HD.ink[0]) : r < 1.55 ? PAL_HD.gold[6] : r < 1.6 + 0.5 / c.d ? PAL_HD.gold[2] : 0;
  });
}

function logoHd(d: HdD): Frame[] {
  const L = logoLayout();
  const c = new HdCanvas(L.w, L.h, d);
  const olive = c.material({ ramp: PAL_HD.olive, lo: 1, hi: 6, spec: 0.25, shine: 18, wrap: 0.12 });
  const rim = c.material({ ramp: GUNMETAL_HD, lo: 1, hi: 6, spec: 0.6, shine: 26 });
  const bare = c.material({ ramp: GUNMETAL_HD, lo: 3, hi: 6, spec: 0.5, shine: 26 });
  const rivet = c.material({ ramp: GUNMETAL_HD, lo: 1, hi: 6, spec: 0.9, shine: 30 });
  const gold = c.material({ ramp: PAL_HD.gold, lo: 1, hi: 6, spec: 0.85, shine: 34, bounce: 0.3, wrap: 0.1 });
  const beak = c.material({ ramp: PAL_HD.orange, lo: 1, hi: 5, spec: 0.5, shine: 24 });
  const tip = c.material({ ramp: GUNMETAL_HD, lo: 2, hi: 6, spec: 0.8 });
  const mats = { olive, rim, bare, rivet };
  plateWordHd(c, L.metal.text, L.metal.x, L.metal.y, mats);
  plateWordHd(c, L.swan.text, L.swan.x, L.swan.y, mats);
  swanThreeHd(c, L.threeX, 0, { gold, beak, tip });
  const body = c.render({ outline: 'A', ao: 0.25, sep: true, shadow: 0, rimLight: 1 });
  const out = new PixelBuffer((L.w + 2) * d, (L.h + 2) * d);
  out.blit(body, 2 * d, 2 * d, { solid: PAL_HD.navy[0] });
  out.blit(body, 0, 0);
  return [{ buf: out, ox: 0, oy: 0, density: d }];
}

/** Gunmetal of the plate rims and rivets (PAL_HD). */
const GUNMETAL_HD = [PAL_HD.ink[0], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[3], PAL_HD.steel[4], PAL_HD.steel[5], PAL_HD.steel[7]] as const;

export function defineLogoArt(): void {
  defineSprite('ui/logo', logo, { anchor: 'top-left', hd: (d) => logoHd(d) });
}
