/**
 * Military menu art (docs/design/squad.md §2.3; the select screen redrawn at 1x in
 * docs/design/select40.md): the REPORT FOR DUTY select screen and the stencil titles of the
 * menus. Our own designs, drawn by code from the palette, lit by one strong key light from the
 * top front: rust-brown riveted steel plates (worn paint, chips, scratches, rust runs, grime
 * streaks, domed bolt heads, recesses with bevelled walls), olive corrugated shutters with the
 * squad emblem sprayed on (a stencilled swan on the water with a small 3), worn hazard
 * stripes, glass lamps, khaki nameplates and a glass preview window. Every id is top-left
 * anchored. The select-screen ids are 1x only (pixel grid path B); `ui/mil/bolt` and the other
 * stencil titles keep their 2x / 4x art.
 *
 * - `ui/mil/frame`      384 × 216, the select-screen frame; transparent panel windows (64 × 120)
 *                       at x = 14 + i·74, y 46 (MIL_PANEL_X / MIL_PANEL_Y / MIL_PANEL_W / MIL_PANEL_H)
 * - `ui/mil/shutter`    MIL_SHUTTER_FRAMES frames, 68 × 128: frame k is the door raised by
 *                       MIL_SHUTTER_OFFSETS[k] px (0 closed … the last fully raised, empty)
 * - `ui/mil/shutter-slam`  2 frames, 68 × 128: the closed door at its impact (slats bunched 3 px, 1 px)
 * - `ui/mil/dust`       6 frames, 24 × 12: a dust puff rolling out to the right (mirror it for the left)
 * - `ui/mil/hazard`     64 × 6 worn yellow / black strip
 * - `ui/mil/badge-off`, `ui/mil/badge-p1`, `ui/mil/badge-p2`  28 × 10 lamps (unlit; red P1, blue
 *                       P2: frame 0 lit, frame 1 the blink's bright peak)
 * - `ui/mil/glow-p1`, `ui/mil/glow-p2`  36 × 18 glow halo of a lit lamp (drawn at −4, −4, additive)
 * - `ui/mil/plate`      64 × 14 nameplate (the scene stencils the name on it)
 * - `ui/mil/preview`    44 × 52 dark glass window in a raised steel frame
 * - `ui/mil/preview-glare`  44 × 52 reflection streaks drawn over the preview figure (additive)
 * - `ui/mil/emblem`     40 × 36 the squad emblem (sprayed stencil paint), also sprayed on the shutter
 * - `ui/mil/bolt`       5 × 5 corner bolt of the menu panels (`drawMilPanel`)
 * - `ui/mil/stencil-<slug>`  stencil lettering for the menu titles (STENCIL_TITLES, bone paint;
 *                       STENCIL_GOLD, gold paint: `PRESS START`; slug = the text in lower case
 *                       with '-' for spaces), the big font at scale 2; REPORT FOR DUTY is sprayed
 *                       (overspray, chips, drips; 1x only)
 */
import type { Color } from '../../../engine/color';
import { drawText, getFont, layoutText, measureText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { Rng } from '../../../engine/rng';
import { defineSprite } from '../../../engine/sprites';
import { HdCanvas } from '../../art/hd/index';
import { hash2, noise2 } from '../../art/paint';

const MASK: Color = 0xff00ffff;
const TL = { anchor: 'top-left' } as const;

/** Select-screen layout (docs/design/squad.md §3.4), shared with the scene. */
export const MIL_PANELS = 5;
export const MIL_PANEL_W = 64;
export const MIL_PANEL_H = 120;
export const MIL_PANEL_Y = 46;
export const MIL_PANEL_STEP = 74;
export const MIL_PANEL_X0 = 14;
/** The shutter sprite sits 2 px left of and 4 px above its window. */
export const MIL_SHUTTER_DX = -2;
export const MIL_SHUTTER_DY = -4;
/** The preview window and its hazard strip on the shutter (shutter coordinates). */
export const MIL_PREVIEW_X = 12;
export const MIL_PREVIEW_Y = 48;
export const MIL_HAZARD_Y = 100;
/** The title recess in the frame (y 3–28) and the bottom text band (y 190–213). */
export const MIL_TITLE_RECESS = { x: 62, y: 3, w: 260, h: 26 } as const;
export const MIL_BOTTOM_BAND = { x: 8, y: 190, w: 368, h: 22 } as const;

/** The menu titles drawn as stencil sprites (`ui/mil/stencil-<slug>`). */
export const STENCIL_TITLES: readonly string[] = ['REPORT FOR DUTY', 'SELECT OPERATION', 'OPTIONS', 'HALL OF FAME', 'HOW TO PLAY', 'ENTER YOUR INITIALS'];
/** Stencil lines painted gold instead of bone (the title's blinking prompt). */
export const STENCIL_GOLD: readonly string[] = ['PRESS START'];

/** The sprite id of a stencil title. */
export function stencilId(text: string): string {
  return `ui/mil/stencil-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** The x of panel i's window. */
export function milPanelX(i: number): number {
  return MIL_PANEL_X0 + i * MIL_PANEL_STEP;
}

// ---------------------------------------------------------------------------------------------
// Stencil lettering
// ---------------------------------------------------------------------------------------------

/**
 * The big font at `scale` as a mask (MASK pixels on transparent) with stencil bridges cut into
 * each glyph: where a horizontal bar meets the glyph's left (or right) stem, a gap one font pixel
 * wide separates them when the glyph has two or more bars (O, D, E, P, R, B, A, 3 …; L, U, H
 * stay whole); glyphs without a stem get a gap in the middle of their top and bottom bars (S,
 * Z …); a stem in the middle (I, T, 1, Y) stays whole.
 * Cuts are made on the font grid, so they scale with the letters.
 */
export function stencilMask(text: string, scale: number, pad = 0, thin = false): PixelBuffer {
  const font = getFont('big');
  const size = measureText(text, { font: 'big', scale: 1 });
  const m1 = new PixelBuffer(size.w, size.h);
  drawText(m1, text, 0, 0, { font: 'big', color: MASK });
  const on = (x: number, y: number): boolean => m1.get(x, y) === MASK;
  const cuts: number[] = [];
  const glyphH = font.ascent;
  layoutText(text, 0, 0, font, 'left', (g, gx) => {
    const w = g.w;
    const count = (c: number): number => {
      let n = 0;
      for (let y = 0; y < glyphH; y++) if (on(gx + c, y)) n++;
      return n;
    };
    let s0 = -1;
    for (let c = 0; c < w; c++) {
      if (count(c) >= 6) {
        s0 = c;
        break;
      }
    }
    // A stem in the middle (I, T, 1, Y): no cut; the letter reads better whole.
    if (s0 > 0 && s0 < w - 3) return;
    if (s0 >= 0) {
      let s1 = s0;
      while (s1 + 1 < w && count(s1 + 1) >= 6) s1++;
      // A stem at the right edge (3, J …) cuts its bars on the left side instead.
      const right = s1 + 1 >= w - 1;
      const cut = right ? s0 - 1 : s1 + 1;
      const beyond = right ? cut - 1 : cut + 1;
      const stem = right ? s0 : s1;
      if (cut >= 0 && cut < w) {
        // Only glyphs with two or more bars get cuts (E, O, D, R …); L, U, H, M stay whole.
        const rows: number[] = [];
        let groups = 0;
        for (let y = 0; y < glyphH; y++) {
          const bar = on(gx + cut, y) && on(gx + beyond, y) && on(gx + stem, y);
          if (bar) {
            if (rows.length === 0 || rows[rows.length - 1] !== y - 1) groups++;
            rows.push(y);
          }
        }
        // thin: one bridge only, in the top bar (the glyph keeps its silhouette at a glance)
        if (groups >= 2) for (const y of rows) if (!thin || y <= rows[0] + 1) cuts.push(gx + cut, y);
      }
    } else {
      const mid = gx + (w >> 1) - 1;
      for (const y of [0, 1, glyphH - 2, glyphH - 1]) {
        if (on(mid, y) && on(mid - 1, y) && on(mid + 1, y)) cuts.push(mid, y);
      }
    }
  });
  if (!thin) for (let i = 0; i < cuts.length; i += 2) m1.set(cuts[i], cuts[i + 1], 0);
  const out = new PixelBuffer(size.w * scale + pad * 2, size.h * scale + pad * 2);
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) if (on(x, y)) out.rect(pad + x * scale, pad + y * scale, scale, scale, MASK);
  }
  // thin: the bridge is one px wide at any scale (the stem side of the font pixel stays painted)
  if (thin) for (let i = 0; i < cuts.length; i += 2) out.rect(pad + cuts[i] * scale + scale - 1, pad + cuts[i + 1] * scale, 1, scale, 0);
  return out;
}

/**
 * A stencil title: bone-white spray paint (lighter at the top of each letter), worn by a few
 * diagonal scratches, with an ink outline and a 2-px dark drop shadow so it reads on steel and
 * on the base backdrop alike.
 */
function stencilTitle(text: string, gold = false): PixelBuffer {
  const scale = 2;
  const m = stencilMask(text, scale, 1);
  const on = (x: number, y: number): boolean => m.get(x, y) === MASK;
  const glyphH = 8 * scale;
  const b = new PixelBuffer(m.w + 2, m.h + 2);
  const paint = new PixelBuffer(m.w, m.h);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!on(x, y)) continue;
      const row = y - 1;
      const ramp = gold ? PAL.gold : PAL.sand;
      let c: Color = row < glyphH * 0.3 ? ramp[3] : row < glyphH * 0.7 ? ramp[2] : ramp[1];
      if (!on(x, y - 1)) c = gold ? PAL.fire[6] : PAL.snow[2];
      else if (!on(x, y + 1)) c = ramp[0];
      paint.set(x, y, c);
    }
  }
  // Scratches: short diagonal strokes of bare dark metal through the paint.
  const rng = new Rng(`stencil:${text}`);
  const n = Math.max(2, Math.floor(m.w / 28));
  for (let i = 0; i < n; i++) {
    const x0 = rng.int(4, m.w - 8);
    const y0 = rng.int(3, m.h - 6);
    const len = rng.int(3, 5);
    for (let k = 0; k < len; k++) {
      const x = x0 + k;
      const y = y0 + (k >> 1);
      if (on(x, y) && on(x + 1, y) && on(x - 1, y)) paint.set(x, y, gold ? PAL.gold[0] : PAL.sand[0]);
    }
  }
  // Shadow (2 px down-right), then the outlined paint.
  b.blit(paint, 2, 2, { solid: PAL.ink[0] });
  const lettered = paint.clone().outline(INK);
  b.blit(lettered, 0, 0);
  return b;
}

// ---------------------------------------------------------------------------------------------
// 1× painting (docs/design/select40.md): the select-screen furniture at 1× only, palette colours
// only, lit by one strong key light from the top front. Ramps run dark → light; a tone is a float
// on a ramp, quantised with an ordered (Bayer) threshold for glass and glow, and with a rough
// threshold (half Bayer, half hash) for painted and worn metal.
// ---------------------------------------------------------------------------------------------

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The 4 × 4 ordered threshold at (x, y), 0..1. */
function bayer(x: number, y: number): number {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

/** A rough threshold for worn paint: mostly ordered, a quarter hashed. */
function grit(x: number, y: number, seed: number): number {
  return 0.75 * bayer(x, y) + 0.25 * hash2(x, y, seed);
}

/** The colour of a ramp at tone t (0 … n − 1), dithered between neighbours by threshold th. */
function rampAt(ramp: readonly Color[], t: number, th: number): Color {
  const n = ramp.length;
  if (t <= 0) return ramp[0];
  if (t >= n - 1) return ramp[n - 1];
  const i = Math.floor(t);
  return ramp[t - i > th ? i + 1 : i];
}

/**
 * The colour of a ramp at tone t with flat bands: the dither only in a zone of ±`zone` round each
 * band border (clean clusters; a gradient still turns over smoothly).
 */
function bandAt(ramp: readonly Color[], t: number, th: number, zone = 0.2): Color {
  const n = ramp.length;
  if (t <= 0) return ramp[0];
  if (t >= n - 1) return ramp[n - 1];
  const i = Math.floor(t);
  const f = t - i;
  if (f < 0.5 - zone) return ramp[i];
  if (f > 0.5 + zone) return ramp[i + 1];
  return ramp[(f - (0.5 - zone)) / (2 * zone) > th ? i + 1 : i];
}

/** Rust-brown painted steel (the frame). */
const R_PAINT: readonly Color[] = [PAL.ink[0], PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3], PAL.sand[2]];
/** Rust and primer showing through (patches, runs). */
const R_RUST: readonly Color[] = PAL.rust;
/** Bare worn metal (chips, scratches, bolt heads). */
const R_BARE: readonly Color[] = [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[2]];
/** Cold gunmetal (bezels, guides, the preview frame). */
const R_GUN: readonly Color[] = [PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]];
/** Olive drab paint (the shutter slats). */
const R_OLIVE: readonly Color[] = [PAL.ink[0], PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3], PAL.sand[2]];
/** Bone stencil paint. */
const R_BONE: readonly Color[] = [PAL.sand[0], PAL.sand[1], PAL.sand[2], PAL.sand[3], PAL.snow[2]];
/** Hazard yellow. */
const R_HAZ: readonly Color[] = [PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]];
/** Lamp lights: P1 red, P2 blue (dark → hot). */
const R_LAMP_P1: readonly Color[] = [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3], PAL.orange[2], PAL.gold[3], PAL.snow[3]];
const R_LAMP_P2: readonly Color[] = [PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.snow[2], PAL.snow[3]];
/** Dark glass. */
const R_GLASS: readonly Color[] = [PAL.ink[0], PAL.navy[0], PAL.navy[1], PAL.steel[0], PAL.steel[1]];

/** Every 1× ramp a colour can be shaded along (the first ramp listing a colour wins). */
const HOME = new Map<Color, { r: readonly Color[]; i: number }>();
for (const r of [R_PAINT, R_RUST, R_BARE, R_GUN, R_OLIVE, R_BONE, R_HAZ, R_GLASS, R_LAMP_P1, R_LAMP_P2]) {
  r.forEach((c, i) => {
    if (!HOME.has(c)) HOME.set(c, { r, i });
  });
}

/** Shade the px at (x, y) k steps along its home ramp (− darker, + lighter); empty px stay empty. */
function shadePx(b: PixelBuffer, x: number, y: number, k: number): void {
  if (!b.inBounds(x, y)) return;
  const c = b.get(x, y);
  if ((c & 255) === 0) return;
  const h = HOME.get(c);
  if (!h) return;
  b.set(x, y, h.r[Math.max(0, Math.min(h.r.length - 1, h.i + k))]);
}

/** Shade a rectangle k steps, every px or (dither) only where the ordered threshold is below `cover`. */
function shadeRect(b: PixelBuffer, x: number, y: number, w: number, h: number, k: number, cover = 1): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (cover >= 1 || bayer(xx, yy) < cover) shadePx(b, xx, yy, k);
}

/** A string map of ramp indices ('0'–'9'; 'k' ink; '.' empty) stamped at (x, y). */
function stamp(b: PixelBuffer, x: number, y: number, rows: readonly string[], ramp: readonly Color[]): void {
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.') continue;
      b.set(x + i, y + j, ch === 'k' ? PAL.ink[0] : ramp[Math.min(ramp.length - 1, ch.charCodeAt(0) - 48)]);
    }
  }
}

/** A 5 × 5 domed bolt head (lit top left, a glint, ink on the shadow side) with its cast shadow. */
const BOLT5 = ['.233.', '24321', '33210', '3210k', '.10k.'];
function bolt5(b: PixelBuffer, x: number, y: number, ramp: readonly Color[] = R_BARE): void {
  for (let k = 1; k < 5; k++) shadePx(b, x + k, y + 5, -1);
  for (let k = 1; k < 5; k++) shadePx(b, x + 5, y + k, -1);
  shadePx(b, x + 5, y + 5, -1);
  shadePx(b, x + 2, y + 6, -1);
  stamp(b, x, y, BOLT5, ramp);
}

/** A 3 × 3 rivet with a 1-px cast shadow under it. */
const RIVET3 = ['43.', '321', '.1k'];
function rivet3(b: PixelBuffer, x: number, y: number, ramp: readonly Color[] = R_BARE): void {
  for (let k = 1; k < 4; k++) shadePx(b, x + k, y + 3, -1);
  stamp(b, x, y, RIVET3, ramp);
}

/** A rust run under (x, y): a thin streak of rust that fades down the paint. */
function rustRun(b: PixelBuffer, x: number, y: number, len: number, seed: number): void {
  for (let k = 0; k < len; k++) {
    const yy = y + k;
    if (hash2(x, yy, seed) < 0.15 + (k / len) * 0.5) continue;
    b.set(x, yy, k < len * 0.5 ? R_RUST[2] : R_RUST[1]);
    if (k < 2) shadePx(b, x + 1, yy, -1);
  }
}

/** A grime streak: the paint a step darker, thinning out with length (dithered). */
function grimeRun(b: PixelBuffer, x: number, y: number, w: number, len: number): void {
  for (let k = 0; k < len; k++) {
    const cover = 1 - k / len;
    for (let i = 0; i < w; i++) if (bayer(x + i, y + k) < cover * 0.8) shadePx(b, x + i, y + k, -1);
  }
}

/**
 * A rust-brown painted steel plate (x, y, w, h): lit at its top by the key light, mottled, with
 * vertical grime streaks, rust patches with a dark rim, chipped edges showing bare metal and a
 * few scratches; a raised 2-px bevel (lit top and left, ink seam right and bottom).
 */
function steelPlate(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: number, base = 2.15): void {
  if (w <= 3 || h <= 3) return;
  for (let py = y; py < y + h; py++) {
    const v = (py - y) / Math.max(1, h - 1);
    for (let px = x; px < x + w; px++) {
      let t = base + 0.85 * (1 - v) * (1 - v) * (1 - v) - 0.3 * v;
      t += (noise2(px, py, 13, seed) - 0.5) * 0.85 + (noise2(px, py, 5, seed + 1) - 0.5) * 0.3;
      const g = noise2(px, py * 0.09, 2.3, seed + 2);
      if (g > 0.6) t -= (g - 0.6) * 3.2 * (0.25 + v);
      let c = bandAt(R_PAINT, Math.max(1, Math.min(4.3, t)), grit(px, py, seed + 3), 0.3);
      const r = noise2(px, py, 9, seed + 4) * 0.75 + noise2(px, py, 3, seed + 5) * 0.25;
      if (r > 0.72) c = bandAt(R_RUST, 1 + (r - 0.72) * 6 + (noise2(px, py, 2, seed + 6) - 0.5) * 0.6, grit(px, py, seed + 7), 0.3);
      else if (r > 0.695) c = R_PAINT[1];
      b.set(px, py, c);
    }
  }
  // Chipped paint near the edges: bare metal, lit on its upper lip.
  for (let py = y + 2; py < y + h - 2; py++) {
    for (let px = x + 2; px < x + w - 2; px++) {
      const e = Math.min(px - x, py - y, x + w - 1 - px, y + h - 1 - py);
      if (e > 4) continue;
      if (noise2(px, py, 2.2, seed + 8) > 0.8 + e * 0.03) b.set(px, py, noise2(px, py - 1, 2.2, seed + 8) > 0.8 + e * 0.03 ? R_BARE[1] : R_BARE[2]);
    }
  }
  // Scratches: short strokes of bare metal with a dark lip under them.
  const rng = new Rng(`mil-scr:${seed}`);
  const n = Math.max(1, Math.floor((w * h) / 650));
  for (let i = 0; i < n; i++) {
    const sx = x + 4 + rng.int(0, Math.max(0, w - 14));
    const sy = y + 4 + rng.int(0, Math.max(0, h - 10));
    const len = rng.int(4, 11);
    const slope = (rng.next() - 0.5) * 0.9;
    for (let k = 0; k < len; k++) {
      const px = sx + k;
      const py = sy + Math.round(k * slope);
      if (px >= x + w - 3 || py <= y + 2 || py >= y + h - 3) continue;
      b.set(px, py, k === 0 || k === len - 1 ? R_BARE[1] : R_BARE[2 + (hash2(px, py, seed + 9) < 0.3 ? 1 : 0)]);
      shadePx(b, px, py + 1, -1);
    }
  }
  // The bevel: a lit top edge with glints, a lit left edge, a dark lip and an ink seam right and bottom.
  for (let px = x; px < x + w; px++) {
    b.set(px, y, hash2(px, y, seed + 10) < 0.12 ? R_PAINT[5] : R_PAINT[4]);
    if (bayer(px, y + 1) < 0.5) shadePx(b, px, y + 1, 1);
    b.set(px, y + h - 1, PAL.ink[0]);
    b.set(px, y + h - 2, R_PAINT[1]);
  }
  for (let py = y; py < y + h - 1; py++) {
    if (py > y) b.set(x, py, rampAt(R_PAINT, 3.6 - ((py - y) / h) * 0.8, bayer(x, py)));
    b.set(x + w - 1, py, PAL.ink[0]);
    if (py > y) b.set(x + w - 2, py, R_PAINT[1]);
  }
}

/**
 * A recess pressed into the plate (x, y, w, h): the plate's edge round it (dark above, lit
 * below), an ink rim, 2-px inner walls (the top and left in shadow, the bottom lit by the key
 * light) and a dark gunmetal floor, deepest under its top wall, brushed with faint streaks.
 */
function recess1x(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: number, floor = 1.2): void {
  for (let px = x - 1; px <= x + w; px++) {
    shadePx(b, px, y - 1, -1);
    b.set(px, y + h, rampAt(R_PAINT, 4, bayer(px, y + h)));
  }
  for (let py = y; py < y + h; py++) {
    shadePx(b, x - 1, py, -1);
    b.set(x + w, py, R_PAINT[3]);
  }
  b.rect(x, y, w, h, PAL.ink[0]);
  for (let py = y + 1; py < y + h - 1; py++) {
    const v = (py - y - 1) / Math.max(1, h - 3);
    for (let px = x + 1; px < x + w - 1; px++) {
      let t = floor + v * 0.9 + (noise2(px * 0.25, py, 2, seed) - 0.5) * 0.35;
      if (hash2(px, py, seed + 1) < 0.01) t += 1;
      b.set(px, py, bandAt(R_GUN, t, bayer(px, py), 0.15));
    }
  }
  // Walls: top (shadow), left (shadow), bottom (lit), right (half lit).
  for (let px = x + 1; px < x + w - 1; px++) {
    b.set(px, y + 1, PAL.ink[1]);
    b.set(px, y + 2, bayer(px, y + 2) < 0.5 ? PAL.ink[1] : R_GUN[1]);
    b.set(px, y + h - 2, R_GUN[4]);
    b.set(px, y + h - 3, bayer(px, y + h - 3) < 0.5 ? R_GUN[3] : b.get(px, y + h - 3));
  }
  for (let py = y + 1; py < y + h - 1; py++) {
    b.set(x + 1, py, PAL.ink[1]);
    b.set(x + w - 2, py, py > y + 2 ? R_GUN[2] : PAL.ink[1]);
  }
}

/**
 * Worn hazard stripes (x, y, w, h): yellow and black diagonals (period 8), the yellow lit at the
 * top and dark at the bottom, chipped to bare steel, grimy, with ink edges.
 */
function hazard1x(b: PixelBuffer, x: number, y: number, w: number, h: number, seed: number, phase = 0): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      const k = (i + j + phase) & 7;
      let c: Color;
      if (k < 4) {
        let t = 2.2 - (j / Math.max(1, h - 1)) * 1.2 + (noise2(px, py, 5, seed) - 0.5) * 0.8;
        if (j === 1) t += 1;
        c = rampAt(R_HAZ, t, grit(px, py, seed + 1));
      } else c = j === 1 && hash2(px, py, seed + 2) < 0.4 ? R_GUN[1] : PAL.ink[1];
      const chip = noise2(px, py, 2.4, seed + 3);
      if (chip > 0.8) c = chip > 0.86 ? R_BARE[2] : R_BARE[1];
      b.set(px, py, c);
      if (hash2(px, py, seed + 4) < 0.1 && j > h / 2) shadePx(b, px, py, -1);
    }
  }
  b.rect(x, y, w, 1, PAL.ink[0]);
  b.rect(x, y + h - 1, w, 1, PAL.ink[0]);
}

/** Distance (Chebyshev, up to `max`) from each empty px of a MASK buffer to the nearest MASK px; 0 on the mask. */
function maskDist(m: PixelBuffer, max: number): Uint8Array {
  const out = new Uint8Array(m.w * m.h).fill(255);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (m.get(x, y) === MASK) {
        out[y * m.w + x] = 0;
        continue;
      }
      for (let r = 1; r <= max; r++) {
        let hit = false;
        for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r && !hit; dx++) if (m.get(x + dx, y + dy) === MASK) hit = true;
        if (hit) {
          out[y * m.w + x] = r;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Spray paint through a stencil (`m`: MASK px): uneven paint (blotches, thinner along the edges),
 * a few chips where the bare ground shows (left empty), overspray speckles round the letters and
 * short drips under some strokes. `under(x, y)` gives the tone (0..1) of the ground the paint
 * lies on (1 lit, 0 deep shadow): the paint follows it.
 */
function spray(m: PixelBuffer, seed: number, ramp: readonly Color[], over: Color, under: (x: number, y: number) => number = () => 1, drips = 0.035, mist = 0.16, chip = 0.84): PixelBuffer {
  const b = new PixelBuffer(m.w, m.h);
  const on = (x: number, y: number): boolean => m.get(x, y) === MASK;
  const dist = maskDist(m, 2);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const d = dist[y * m.w + x];
      if (d === 0) {
        if (noise2(x, y, 2.1, seed) > chip) continue;
        let t = 1.3 + 1.6 * under(x, y) + (noise2(x, y, 6, seed + 1) - 0.5) * 1.1;
        if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y + 1)) t -= 0.6;
        if (!on(x, y - 1)) t += 0.6;
        b.set(x, y, bandAt(ramp, t, grit(x, y, seed + 2), 0.3));
      } else if (d <= 2 && hash2(x, y, seed + 3) < (d === 1 ? mist : mist * 0.3)) b.set(x, y, over);
    }
  }
  // Drips: under a few bottom edges, 2–5 px runs ending in a bead.
  for (let y = 1; y < m.h - 1; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!on(x, y) || on(x, y + 1) || hash2(x, y, seed + 4) > drips) continue;
      const len = 2 + Math.floor(hash2(x, y, seed + 5) * 4);
      for (let k = 1; k <= len && y + k < m.h; k++) {
        if (on(x, y + k)) break;
        b.set(x, y + k, k === len ? ramp[2] : ramp[1]);
      }
    }
  }
  return b;
}

// ---------------------------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------------------------

/** The title row of the select screen: REPORT FOR DUTY as sprayed, chipped stencil paint. */
const SELECT_TITLE = 'REPORT FOR DUTY';

/**
 * REPORT FOR DUTY (`ui/mil/stencil-report-for-duty`): the stencilled big font at scale 2 sprayed
 * in bone paint (blotchy, thin at the edges, lit toward the top of the letters), chipped,
 * overspray round the letters and drips under some strokes. No outline: paint on steel. 3 px of
 * padding round the letters (overspray), 3 more under them (drips).
 */
function sprayTitle(text: string): PixelBuffer {
  const m0 = stencilMask(text, 2, 3, true);
  const m = new PixelBuffer(m0.w, m0.h + 3);
  m.blit(m0, 0, 0);
  const glyphH = 16;
  // Few chips (a chip in a 2-px stem splits the letter) and few drips: the title must read.
  return spray(m, 3101, R_BONE, PAL.stone[1], (_x, y) => 1 - Math.max(0, Math.min(1, (y - 3) / glyphH)) * 0.8, 0.02, 0.16, 0.95);
}

/** The select-screen frame (384 × 216) with five transparent windows. */
function frame(): PixelBuffer {
  const W = 384;
  const H = 216;
  const b = new PixelBuffer(W, H);
  // Plates: the top band, a pillar beside each window, the nameplate rail and the bottom band.
  const plates: Array<[number, number, number, number]> = [
    [0, 0, 62, 45],
    [62, 0, 260, 45],
    [322, 0, 62, 45],
  ];
  for (let i = 0; i <= MIL_PANELS; i++) {
    const x0 = i === 0 ? 0 : milPanelX(i - 1) + MIL_PANEL_W;
    const x1 = i === MIL_PANELS ? W : milPanelX(i);
    plates.push([x0, 45, x1 - x0, 125]);
  }
  plates.push([0, 170, 192, 20], [192, 170, 192, 20], [0, 189, 128, 27], [128, 189, 128, 27], [256, 189, 128, 27]);
  plates.forEach(([x, y, w, h], k) => steelPlate(b, x, y, w, h, 7001 + k * 37, y >= 170 ? 1.9 : 2.15));
  // Bolts in the corners of the outer plates and along the top band, a few with a rust run and grime.
  const bolts: Array<[number, number]> = [];
  for (const [x, y, w, h] of plates) {
    if (w < 16 || h < 40) continue;
    bolts.push([x + 3, y + 3], [x + w - 9, y + 3], [x + 3, y + h - 9], [x + w - 9, y + h - 9]);
    const n = Math.floor((w - 16) / 26);
    for (let k = 1; k <= n; k++) bolts.push([x + 3 + Math.round(((w - 12) * k) / (n + 1)), y + 3]);
  }
  // The nameplate rail: one bolt in each gap between the plates, and one at each end.
  bolts.push([3, 176], [W - 9, 176]);
  for (let i = 0; i < MIL_PANELS - 1; i++) bolts.push([milPanelX(i) + MIL_PANEL_W + 2, 176]);
  const rng = new Rng('mil-frame-bolts');
  for (const [x, y] of bolts) {
    const r = rng.next();
    if (r < 0.3) rustRun(b, x + 2, y + 6, rng.int(4, 12), x * 7 + y);
    else if (r < 0.65) grimeRun(b, x + 1, y + 6, 3, rng.int(6, 16));
    bolt5(b, x, y);
  }
  // The title recess and the hazard plates beside it.
  const tr = MIL_TITLE_RECESS;
  recess1x(b, tr.x, tr.y, tr.w, tr.h, 7301, 0.9);
  grimeRun(b, tr.x + 30, tr.y + tr.h + 1, 40, 6);
  grimeRun(b, tr.x + 170, tr.y + tr.h + 1, 24, 9);
  for (const x of [8, 330]) {
    recess1x(b, x - 1, 9, 48, 14, 7311 + x);
    hazard1x(b, x + 1, 11, 44, 10, 7321 + x, x);
  }
  // Badge housings (one per panel, y 30–42).
  for (let i = 0; i < MIL_PANELS; i++) recess1x(b, milPanelX(i) + 1, 30, 62, 13, 7401 + i, 0.6);
  // The window bezels: raised gunmetal frames, rivets down their sides, a cast shadow under them.
  for (let i = 0; i < MIL_PANELS; i++) {
    const px = milPanelX(i);
    const x = px - 3;
    const y = MIL_PANEL_Y - 3;
    const w = MIL_PANEL_W + 6;
    const h = MIL_PANEL_H + 6;
    shadeRect(b, x + 1, y + h + 1, w + 1, 1, -2);
    shadeRect(b, x + 1, y + h + 2, w, 1, -1, 0.5);
    shadeRect(b, x + w + 1, y + 2, 1, h, -1);
    b.strokeRect(x - 1, y - 1, w + 2, h + 2, PAL.ink[0]);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const li = xx - x;
        const ri = x + w - 1 - xx;
        const ti = yy - y;
        const bi = y + h - 1 - yy;
        const e = Math.min(li, ri, ti, bi);
        if (e > 2) continue;
        // Which side: top / left lit, bottom / right in shade; the inner edge the other way round.
        let t: number;
        if (e === ti) t = [4.2, 2.9, 1.3][ti];
        else if (e === bi) t = [0.9, 1.7, 3.2][bi];
        else if (e === li) t = [3.3, 2.4, 1.3][li];
        else t = [1, 1.7, 2.4][ri];
        t += (noise2(xx, yy, 4, 7501 + i) - 0.5) * 0.5;
        let c = bandAt(R_GUN, t, grit(xx, yy, 7511 + i), 0.25);
        if (noise2(xx, yy, 2, 7521 + i) > 0.9) c = R_RUST[1];
        b.set(xx, yy, c);
      }
    }
    for (let ry = y + 10; ry < y + h - 10; ry += 16) {
      rivet3(b, x, ry, R_GUN.slice(1));
      rivet3(b, x + w - 3, ry, R_GUN.slice(1));
    }
    for (const [cx, cy] of [
      [x, y],
      [x + w - 3, y],
      [x, y + h - 3],
      [x + w - 3, y + h - 3],
    ] as const) rivet3(b, cx, cy, R_GUN.slice(1));
    grimeRun(b, x + 6, y + h + 3, w - 12, 4);
    // The window: transparent, with an ink edge inside the bezel.
    b.strokeRect(px - 1, MIL_PANEL_Y - 1, MIL_PANEL_W + 2, MIL_PANEL_H + 2, PAL.ink[0]);
    b.rect(px, MIL_PANEL_Y, MIL_PANEL_W, MIL_PANEL_H, 0);
  }
  // The bottom text band.
  const bb = MIL_BOTTOM_BAND;
  recess1x(b, bb.x, bb.y + 1, bb.w, bb.h, 7601, 0.5);
  return b;
}

/**
 * The squad emblem (40 × 36): a swan in profile on a stencil bar (the water), swimming to the
 * left: a full body with the tail tip up at the right, the wing a stencil gap, the neck rising in
 * an S from the breast to a small head with a beak (the eye a stencil hole), and a "3" over the
 * back. Our own mark: never an "M3" monogram.
 */
function emblemMask(): PixelBuffer {
  const w = 40;
  const h = 36;
  const m = new PixelBuffer(w, h);
  // The body: a long oval, the breast round at the left, the tail rising to a point at the right.
  m.ellipse(7, 20, 27, 11, MASK);
  m.tri(28, 22, 37, 14, 35, 27, MASK);
  // The wing: a stencil gap curving over the back.
  m.thickLine(14, 24, 22, 21, 1, 0);
  m.thickLine(22, 21, 31, 22, 1, 0);
  // The neck in an S: up from the breast, back, then forward to the head.
  m.thickLine(10, 25, 7, 18, 4, MASK);
  m.thickLine(7, 18, 8, 11, 4, MASK);
  m.thickLine(8, 11, 12, 6, 4, MASK);
  // The head and the beak (pointing left and down), the eye a hole.
  m.ellipse(9, 3, 7, 6, MASK);
  m.tri(10, 5, 2, 9, 10, 9, MASK);
  m.set(12, 5, 0);
  // The water: a bar under the swan, a stencil gap in it.
  m.rect(3, 33, 34, 2, MASK);
  m.rect(19, 33, 1, 2, 0);
  // The "3" over the back.
  drawText(m, '3', 27, 2, { font: 'big', color: MASK });
  return m;
}

/** The emblem (`ui/mil/emblem`, 40 × 36): sprayed sand paint on a transparent ground. */
function emblem(): PixelBuffer {
  return spray(emblemMask(), 3201, R_BONE, PAL.stone[1], (_x, y) => 1 - y / 48, 0.02, 0.14, 0.93);
}

/** Shutter geometry: the door (68 × 128), its slat period and the rows of its parts. */
const DOOR_W = 68;
const DOOR_H = 128;
const SLAT = 6;
/** The slat profile: tone per row of a slat (the crest lit by the key light, the groove dark). */
const SLAT_TONE = [3.5, 3.0, 2.55, 2.15, 1.6, 0.7];
const KICK_Y = MIL_HAZARD_Y + 6;
const BAR_Y = 116;

/**
 * The shutter door (68 × 128): olive corrugated slats (6-px period, the crest of each lit, a dark
 * groove with rust), steel side guides, the squad emblem sprayed over the slats (its paint follows
 * them), the hazard band at MIL_HAZARD_Y, a riveted steel kick plate, the bottom bar with a grip
 * slot, and a rubber seal. Grime streaks, chips, dents and scratches. `squash` bunches the lowest
 * slats by that many px (the impact frames): the door above them sits lower.
 */
function shutterDoor(squash = 0): PixelBuffer {
  const W = DOOR_W;
  const H = DOOR_H;
  const b = new PixelBuffer(W, H);
  const seed = 8101;
  for (let y = 0; y < KICK_Y; y++) {
    const k = y % SLAT;
    for (let x = 4; x < W - 4; x++) {
      let t = SLAT_TONE[k] - 0.25 + (noise2(x, y, 14, seed) - 0.5) * 0.45;
      // Grime runs down from the top of the door (the shaft's dirt), each column its own length.
      const run = 18 + noise2(x, 0, 2.2, seed + 1) * 46;
      if (y < run) t -= (1 - y / run) * 1.8;
      const g = noise2(x, y * 0.1, 2.6, seed + 17);
      if (g > 0.64) t -= (g - 0.64) * 2.5;
      let c = bandAt(R_OLIVE, Math.max(0.6, t), bayer(x, y), 0.18);
      if (k === SLAT - 1 && noise2(x, y, 4, seed + 3) > 0.8) c = R_RUST[1];
      if (k === 0 && noise2(x, y, 2.6, seed + 5) > 0.87) c = R_BARE[2];
      else if (k === 0 && hash2(x, y, seed + 6) < 0.015) c = R_OLIVE[5];
      b.set(x, y, c);
    }
  }
  // Rust weeping from the grooves.
  for (let y = SLAT - 1; y < KICK_Y - 8; y += SLAT) {
    for (let x = 6; x < W - 6; x++) if (hash2(x, y, seed + 7) < 0.01) rustRun(b, x, y + 1, 2 + Math.floor(hash2(x, y, seed + 8) * 4), seed + x);
  }
  // Dents: a dark crease with a lit lip under it.
  const rng = new Rng('mil-shutter-dents');
  for (let i = 0; i < 5; i++) {
    const x = rng.int(8, W - 16);
    const y = rng.int(50, KICK_Y - 10);
    for (let k = 0; k < 6; k++) {
      shadePx(b, x + k, y + (k >> 1), -2);
      shadePx(b, x + k, y + 1 + (k >> 1), 1);
    }
  }
  // The emblem sprayed over the slats: the paint takes the light of each slat row.
  const mask = emblemMask();
  const em = spray(mask, 3301, R_BONE, PAL.olive[3], (_x, y) => 0.25 + (SLAT_TONE[(y + 8) % SLAT] - 0.8) / 3.1, 0.02, 0.14, 0.93);
  const ex = (W - em.w) >> 1;
  // A dark edge round the paint (the stencil's shadow) separates the swan from the slats.
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      if (mask.get(x, y) === MASK) continue;
      if (mask.get(x - 1, y) === MASK || mask.get(x + 1, y) === MASK || mask.get(x, y - 1) === MASK || mask.get(x, y + 1) === MASK) b.set(ex + x, 8 + y, R_OLIVE[0]);
    }
  }
  b.blit(em, ex, 8);
  // The hazard band and the kick plate (riveted, scuffed, darker at its foot).
  hazard1x(b, 4, MIL_HAZARD_Y, W - 8, 6, seed + 10);
  for (let y = KICK_Y; y < BAR_Y; y++) {
    for (let x = 4; x < W - 4; x++) {
      let t = 3 - ((y - KICK_Y) / (BAR_Y - KICK_Y)) * 1.3 + (noise2(x, y, 3, seed + 11) - 0.5) * 0.9;
      if (y === KICK_Y) t = 1;
      if (y === KICK_Y + 1) t += 1.2;
      b.set(x, y, rampAt(R_GUN, t, grit(x, y, seed + 12)));
    }
  }
  for (let x = 8; x < W - 8; x += 12) rivet3(b, x, KICK_Y + 3, R_GUN.slice(1));
  // The bottom bar: a lit top edge, the grip slot, a dark underside; then the seal.
  for (let x = 0; x < W; x++) {
    b.set(x, BAR_Y, PAL.ink[0]);
    b.set(x, BAR_Y + 1, R_GUN[5]);
    for (let y = BAR_Y + 2; y < BAR_Y + 6; y++) b.set(x, y, rampAt(R_GUN, 3.6 - (y - BAR_Y - 2) * 0.6 + (noise2(x, y, 3, seed + 13) - 0.5) * 0.6, grit(x, y, seed + 14)));
    b.set(x, BAR_Y + 6, R_GUN[1]);
    b.set(x, BAR_Y + 7, PAL.ink[0]);
    for (let y = BAR_Y + 8; y < H; y++) b.set(x, y, (x + y) % 5 === 0 ? PAL.ink[1] : PAL.ink[0]);
  }
  const gx = (W >> 1) - 9;
  b.rect(gx, BAR_Y + 2, 18, 4, PAL.ink[0]);
  b.rect(gx + 1, BAR_Y + 3, 16, 2, R_GUN[1]);
  b.rect(gx + 1, BAR_Y + 5, 16, 1, R_GUN[4]);
  // The side guides: steel channels with a lit edge and bolt heads.
  for (const left of [true, false]) {
    const x0 = left ? 0 : W - 4;
    const cols = left ? [PAL.ink[0], R_GUN[4], R_GUN[3], R_GUN[1]] : [R_GUN[1], R_GUN[3], R_GUN[2], PAL.ink[0]];
    for (let y = 0; y < BAR_Y; y++) for (let i = 0; i < 4; i++) b.set(x0 + i, y, noise2(x0 + i, y, 2, seed + 15) > 0.82 && i > 0 && i < 3 ? R_RUST[1] : cols[i]);
    for (let y = 6; y < BAR_Y - 4; y += 14) {
      b.set(x0 + 1, y, R_GUN[6]);
      b.set(x0 + 2, y, R_GUN[3]);
      b.set(x0 + 1, y + 1, R_GUN[3]);
      b.set(x0 + 2, y + 1, R_GUN[1]);
    }
  }
  if (squash <= 0) return b;
  // Impact: the lowest slats bunch up (a row of each lost), the door above drops; the bar flares.
  const out = new PixelBuffer(W, H);
  const drop: number[] = [];
  for (let k = 0; k < squash; k++) drop.push(MIL_HAZARD_Y - 1 - k * SLAT * 2);
  let dst = H - 1;
  for (let y = H - 1; y >= 0 && dst >= 0; y--) {
    if (drop.includes(y)) continue;
    for (let x = 0; x < W; x++) out.set(x, dst, b.get(x, y));
    dst--;
  }
  for (let x = 1; x < W - 1; x++) out.set(x, BAR_Y + 1, hash2(x, squash, seed + 16) < 0.5 ? R_GUN[6] : R_GUN[5]);
  return out;
}

/**
 * The shutter positions (px the door is raised): frame k of `ui/mil/shutter` is the door raised
 * by MIL_SHUTTER_OFFSETS[k]; frame 0 is closed, the last one fully raised (empty). The rise and
 * the drop of the scene pick their frames from this list.
 */
export const MIL_SHUTTER_OFFSETS: readonly number[] = [0, 2, 8, 18, 32, 50, 70, 90, 106, 114, 116, 118, 120, 122, 126, 128];
/** Frames of `ui/mil/shutter` (0 closed … MIL_SHUTTER_FRAMES − 1 fully raised). */
export const MIL_SHUTTER_FRAMES = MIL_SHUTTER_OFFSETS.length;
/** Ticks per frame of the door's impact squash (ui/mil/shutter-slam) and of the dust puffs (ui/mil/dust). */
export const MIL_SLAM_TICKS = 3;
export const MIL_DUST_TICKS = 3;

/** The frame of `ui/mil/shutter` that shows the door raised by `offset` px (the nearest in the list). */
export function milShutterFrame(offset: number): number {
  let best = 0;
  for (let k = 1; k < MIL_SHUTTER_OFFSETS.length; k++) if (Math.abs(MIL_SHUTTER_OFFSETS[k] - offset) < Math.abs(MIL_SHUTTER_OFFSETS[best] - offset)) best = k;
  return best;
}

/** Frames of the door raised by each offset (the last one empty). */
function shutterFrames(): PixelBuffer[] {
  const door = shutterDoor();
  return MIL_SHUTTER_OFFSETS.map((d) => {
    const f = new PixelBuffer(door.w, door.h);
    if (d < door.h) f.blit(door, 0, -d);
    return f;
  });
}

/** The impact frames of a dropped door (`ui/mil/shutter-slam`): bunched by 3 px, then by 1 px. */
function slamFrames(): PixelBuffer[] {
  return [shutterDoor(3), shutterDoor(1)];
}

/**
 * Dust puffs (`ui/mil/dust`, 6 frames, 24 × 12, top-left; drawn at the foot of a dropped door,
 * mirrored for the left side): a low cloud rolling out to the right and up, thinning out.
 */
function dustFrames(): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  const R_DUST: readonly Color[] = [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.sand[1], PAL.stone[3]];
  for (let f = 0; f < 6; f++) {
    const b = new PixelBuffer(24, 12);
    const grow = f / 5;
    const blobs: Array<[number, number, number]> = [
      [3 + grow * 5, 9 - grow * 2, 3 + grow * 2],
      [8 + grow * 8, 8.5 - grow * 3, 3.5 + grow * 2.5],
      [13 + grow * 8, 9.5 - grow * 4, 2.5 + grow * 2.5],
    ];
    const keep = 1.15 - grow * 0.7;
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 24; x++) {
        let best = 0;
        let lit = 0;
        for (const [cx, cy, r] of blobs) {
          const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.8));
          if (d < 1 && 1 - d > best) {
            best = 1 - d;
            lit = (cy - y) / r;
          }
        }
        if (best <= 0 || hash2(x, y, 8201 + f) > keep * (0.8 + best)) continue;
        b.set(x, y, rampAt(R_DUST, 1.6 + lit * 1.6 + best * 0.8 - grow * 0.8, bayer(x, y)));
      }
    }
    out.push(b);
  }
  return out;
}

/** The hazard strip (64 × 6): worn yellow / black stripes. */
function hazard(): PixelBuffer {
  const b = new PixelBuffer(64, 6);
  hazard1x(b, 0, 0, 64, 6, 8301);
  return b;
}

/**
 * A lamp (28 × 10): a steel housing, a domed glass lens behind a grille line. Off: dark smoked
 * glass with a dim glint. Lit (P1 red, P2 blue): the lens glows from a hot core, the letters
 * white-hot with a glow ring; `bright` (the blink's peak) lifts every tone.
 */
function badge(kind: 'off' | 'p1' | 'p2', bright = false): PixelBuffer {
  const W = 28;
  const H = 10;
  const b = new PixelBuffer(W, H);
  b.roundRect(0, 0, W, H, 2, PAL.ink[0]);
  for (let x = 1; x < W - 1; x++) {
    b.set(x, 1, x < 3 || x > W - 4 ? R_GUN[2] : R_GUN[4]);
    b.set(x, H - 2, R_GUN[1]);
  }
  for (let y = 2; y < H - 2; y++) {
    b.set(1, y, R_GUN[3]);
    b.set(W - 2, y, R_GUN[1]);
  }
  const ramp = kind === 'p1' ? R_LAMP_P1 : R_LAMP_P2;
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const d = Math.hypot((x - cx) / 12, (y - cy) / 3.2);
      if (kind === 'off') {
        let t = 1.1 - d * 0.5 + (y === 2 ? 0.8 : 0);
        if (x >= 5 && x <= 7 && y === 3) t = 3.4;
        b.set(x, y, rampAt(R_GLASS, t, bayer(x, y)));
      } else {
        const t = (bright ? 3.6 : 3) - d * 2.2 + (y === 2 ? 0.6 : 0);
        b.set(x, y, rampAt(ramp, t, bayer(x, y)));
      }
    }
  }
  if (kind === 'off') return b;
  // The letters: a white-hot core and a glow ring in the lamp's light.
  const t = new PixelBuffer(W, H);
  drawText(t, kind === 'p1' ? 'P1' : 'P2', W >> 1, 2, { font: 'small', color: MASK, align: 'center' });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (t.get(x, y) === MASK) continue;
      let near = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) if (t.get(x + dx, y + dy) === MASK) near = true;
      if (near && x > 1 && x < W - 2 && y > 1 && y < H - 2) b.set(x, y, ramp[bright ? 5 : 4]);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.get(x, y) === MASK) b.set(x, y, ramp[6]);
  // A glint on the glass, top left.
  b.set(4, 2, PAL.snow[3]);
  b.set(5, 2, ramp[5]);
  return b;
}

/**
 * The glow halo of a lit lamp (`ui/mil/glow-p1`, `ui/mil/glow-p2`, 36 × 18; drawn 4 px up and
 * left of the lamp with an additive blend): light falling off round the housing, none inside it.
 */
function glow(kind: 'p1' | 'p2'): PixelBuffer {
  const W = 36;
  const H = 18;
  const b = new PixelBuffer(W, H);
  const ramp = kind === 'p1' ? [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]] : [PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.max(4 - x, 0, x - 31);
      const dy = Math.max(4 - y, 0, y - 13);
      if (dx === 0 && dy === 0) continue;
      const d = Math.hypot(dx, dy * 1.3);
      const t = 3.2 - d * 0.8;
      if (t <= 0.2 || bayer(x, y) > t / 1.6) continue;
      b.set(x, y, rampAt(ramp, t, bayer(x + 1, y + 2)));
    }
  }
  return b;
}

/**
 * The nameplate (64 × 14): a khaki-painted card in a steel bezel, mottled and grimy at its foot,
 * chipped at the corners, a screw at each end. The scene stencils the name on it.
 */
function plate(): PixelBuffer {
  const W = 64;
  const H = 14;
  const b = new PixelBuffer(W, H);
  b.rect(0, 0, W, H, PAL.ink[0]);
  for (let x = 1; x < W - 1; x++) {
    b.set(x, 1, R_GUN[4]);
    b.set(x, H - 2, R_GUN[1]);
  }
  for (let y = 1; y < H - 1; y++) {
    b.set(1, y, y === 1 ? R_GUN[4] : R_GUN[3]);
    b.set(W - 2, y, R_GUN[1]);
  }
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      let t = 2.6 - ((y - 2) / (H - 5)) * 1.1 + (noise2(x, y, 5, 8401) - 0.5) * 0.8;
      if (y === 2) t += 0.8;
      let c = rampAt(R_BONE, t, grit(x, y, 8402));
      const e = Math.min(x - 2, W - 3 - x, y - 2, H - 3 - y);
      if (e < 2 && noise2(x, y, 1.8, 8403) > 0.72) c = R_GUN[2];
      b.set(x, y, c);
    }
  }
  for (const x of [3, W - 6]) stamp(b, x, 5, ['23.', '342', '.21'], R_GUN.slice(1));
  return b;
}

/**
 * The preview window (44 × 52): a raised steel frame with a screw in each corner round dark
 * glass (navy at the top to steel at the bottom), a shadow under its top edge and a lit lower
 * lip. The reflections go on top of the figure (`ui/mil/preview-glare`).
 */
function preview(): PixelBuffer {
  const W = 44;
  const H = 52;
  const b = new PixelBuffer(W, H);
  b.rect(0, 0, W, H, PAL.ink[0]);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const li = x - 1;
      const ri = W - 2 - x;
      const ti = y - 1;
      const bi = H - 2 - y;
      const e = Math.min(li, ri, ti, bi);
      if (e > 2) continue;
      let t: number;
      if (e === ti) t = [4.7, 3.5, 1.6][ti];
      else if (e === bi) t = [1.2, 2.4, 3.9][bi];
      else if (e === li) t = [3.9, 3, 1.7][li];
      else t = [1.3, 2.3, 3.1][ri];
      t += (noise2(x, y, 3, 8501) - 0.5) * 0.5;
      b.set(x, y, rampAt(R_GUN, t, grit(x, y, 8502)));
    }
  }
  b.strokeRect(4, 4, W - 8, H - 8, PAL.ink[0]);
  for (let y = 5; y < H - 5; y++) {
    for (let x = 5; x < W - 5; x++) {
      let t = 0.9 + ((y - 5) / (H - 10)) * 2.4;
      if (y < 8) t -= (8 - y) * 0.45;
      b.set(x, y, rampAt(R_GLASS, t, bayer(x, y)));
    }
  }
  for (const [x, y] of [
    [1, 1],
    [W - 4, 1],
    [1, H - 4],
    [W - 4, H - 4],
  ] as const) rivet3(b, x, y, R_GUN.slice(1));
  return b;
}

/** Reflections on the preview glass (44 × 52; drawn over the figure with an additive blend). */
function previewGlare(): PixelBuffer {
  const W = 44;
  const H = 52;
  const b = new PixelBuffer(W, H);
  for (let y = 5; y < H - 5; y++) {
    for (let x = 5; x < W - 5; x++) {
      const g = x + y;
      const fade = 1 - (y - 5) / (H - 10);
      let t = -1;
      if (g >= 22 && g <= 25) t = g === 23 || g === 24 ? 3 : 1.6;
      else if (g === 30) t = 1.8;
      else if (x + y < 16) t = 1.2;
      if (t < 0) continue;
      t *= 0.35 + fade;
      if (t < 0.5 || bayer(x, y) > fade + 0.25) continue;
      b.set(x, y, rampAt(R_GUN, t + 1, bayer(x + 2, y)));
    }
  }
  return b;
}

// ---------------------------------------------------------------------------------------------
// HD (2× and 4×): the same parts painted natively (docs/ART_GUIDE.md "UHD art"). Each id has one
// drawer for d 2 and 4 with exactly its 1× size; lit from the upper left; PAL_HD only. Painted
// menu furniture (frame, shutter, plates) has no ink outline; the lettering floats over the
// backdrop and keeps outline A and its drop shadow.
// ---------------------------------------------------------------------------------------------

/** A dense density of the UHD art. */
export type HdD = 2 | 4;

/**
 * The art-px mask (cw·cell × ch·cell) of a grid of cells (`on`), with every one-cell stair cut
 * to a 45° edge through the step midpoints and real corners kept square: the contour rule of the
 * HD 'big' glyphs (engine/font.ts), so stencil lettering and HD text share one letterform.
 */
export function contourCells(on: (x: number, y: number) => boolean, cw: number, ch: number, cell: number): Uint8Array {
  const W = cw * cell;
  const H = ch * cell;
  const out = new Uint8Array(W * H);
  const t = 0.5 + 1e-9;
  for (let Y = 0; Y < H; Y++) {
    const v = (Y + 0.5) / cell;
    const y = Math.floor(v);
    const fy = v - y;
    for (let X = 0; X < W; X++) {
      const u = (X + 0.5) / cell;
      const x = Math.floor(u);
      const fx = u - x;
      const L = on(x - 1, y);
      const R = on(x + 1, y);
      const U = on(x, y - 1);
      const B = on(x, y + 1);
      let ink: boolean;
      if (on(x, y)) {
        ink = !(
          (!L && !U && (on(x - 1, y + 1) || on(x + 1, y - 1)) && fx + fy <= t) ||
          (!R && !U && (on(x + 1, y + 1) || on(x - 1, y - 1)) && 1 - fx + fy <= t) ||
          (!L && !B && (on(x - 1, y - 1) || on(x + 1, y + 1)) && fx + 1 - fy <= t) ||
          (!R && !B && (on(x + 1, y - 1) || on(x - 1, y + 1)) && 2 - fx - fy <= t)
        );
      } else {
        ink =
          (R && B && (!on(x + 1, y + 1) || (!on(x + 1, y - 1) && !on(x - 1, y + 1))) && 2 - fx - fy <= t) ||
          (L && B && (!on(x - 1, y + 1) || (!on(x - 1, y - 1) && !on(x + 1, y + 1))) && fx + 1 - fy <= t) ||
          (R && U && (!on(x + 1, y - 1) || (!on(x + 1, y + 1) && !on(x - 1, y - 1))) && 1 - fx + fy <= t) ||
          (L && U && (!on(x - 1, y - 1) || (!on(x - 1, y + 1) && !on(x + 1, y - 1))) && fx + fy <= t);
      }
      if (ink) out[Y * W + X] = 1;
    }
  }
  return out;
}

/**
 * Distance (art px, chamfer 1 / √2) from every set px of the mask to the nearest unset px or the
 * buffer edge: 1 on the rim, growing inwards; 0 outside.
 */
export function insideDist(m: Uint8Array, W: number, H: number): Float32Array {
  const D = new Float32Array(W * H);
  const big = 1e9;
  const R2 = Math.SQRT2;
  for (let i = 0; i < D.length; i++) D[i] = m[i] ? big : 0;
  const at = (X: number, Y: number): number => (X < 0 || Y < 0 || X >= W || Y >= H ? 0 : D[Y * W + X]);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (!m[i]) continue;
      D[i] = Math.min(D[i], at(X - 1, Y) + 1, at(X, Y - 1) + 1, at(X - 1, Y - 1) + R2, at(X + 1, Y - 1) + R2);
    }
  }
  for (let Y = H - 1; Y >= 0; Y--) {
    for (let X = W - 1; X >= 0; X--) {
      const i = Y * W + X;
      if (!m[i]) continue;
      D[i] = Math.min(D[i], at(X + 1, Y) + 1, at(X, Y + 1) + 1, at(X + 1, Y + 1) + R2, at(X - 1, Y + 1) + R2);
    }
  }
  return D;
}

/** A scratch: a short straight stroke in logical px (start, end, half width). */
interface Scratch {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
}

/** Distance from (x, y) to the scratch's axis, and whether (x, y) lies on its lower (lip) side. */
function scratchDist(s: Scratch, x: number, y: number): number {
  const vx = s.x1 - s.x0;
  const vy = s.y1 - s.y0;
  const l2 = vx * vx + vy * vy || 1;
  let t = ((x - s.x0) * vx + (y - s.y0) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(s.x0 + t * vx - x, s.y0 + t * vy - y);
}

/** Random scratches in a box (logical px), seeded. */
function scratches(seed: string, x: number, y: number, w: number, h: number, n: number, len: [number, number], wid = 0.22): Scratch[] {
  const rng = new Rng(seed);
  const out: Scratch[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = x + rng.range(0, w);
    const y0 = y + rng.range(0, h);
    const l = rng.range(len[0], len[1]);
    const a = rng.range(0.15, 0.6) * (rng.next() < 0.5 ? 1 : -1);
    out.push({ x0, y0, x1: x0 + Math.cos(a) * l, y1: y0 + Math.sin(a) * l, w: wid });
  }
  return out;
}

/** The night-lit ramps of the menu furniture (all PAL_HD). */
const GUNMETAL: Ramp = [PAL_HD.ink[0], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[3], PAL_HD.steel[4], PAL_HD.steel[5], PAL_HD.steel[7]];
const BOLT: Ramp = [PAL_HD.ink[0], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4], PAL_HD.stone[5], PAL_HD.stone[6], PAL_HD.stone[7]];


/** A bolt: a washer and a domed hex head with a cross slot, lit from the upper left. */
function boltHd(c: HdCanvas, cx: number, cy: number, mat: number, z: number, r = 1.5): void {
  const p = c.newPart();
  c.ellipsoid(cx, cy, r + 0.1, r + 0.1, { mat, z, part: p, round: 0.25, tone: -0.15 });
  const hex: Array<[number, number]> = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    hex.push([cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82]);
  }
  c.blob(hex, r * 0.35, { mat, z: z + 0.2, part: p, bulge: 0.3 });
  if (c.d === 4) c.shade(cx - r * 0.5, cy - 0.12, r, 0.25, () => -0.45, p);
}




/**
 * A stencil title at density d (`ui/mil/stencil-<slug>`): the stencilled big font at scale 2 as
 * thick enamel letters (bone, or gold), a rounded lit edge, lighter toward the top of each line,
 * worn by scratches and chips of dark metal; outline A and the 2-px dark drop shadow of the 1×.
 */
function stencilTitleHd(text: string, gold: boolean, d: HdD): PixelBuffer {
  const m1 = stencilMask(text, 1, 0);
  const cw = m1.w;
  const ch = m1.h;
  const on1 = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < cw && y < ch && m1.get(x, y) === MASK;
  const cell = 2 * d;
  const mw = cw * cell;
  const mh = ch * cell;
  const mk = contourCells(on1, cw, ch, cell);
  const dist = insideDist(mk, mw, mh);
  // The 1× frame: the stencil mask at scale 2 with 1 px of padding, plus 2 px for the shadow.
  const wl = cw * 2 + 4;
  const hl = ch * 2 + 4;
  const c = new HdCanvas(wl, hl, d);
  const ramp = gold ? PAL_HD.gold : PAL_HD.sand;
  const paint = c.material({ ramp, lo: 1, hi: 6, spec: 0.3, shine: 20, wrap: 0.18, bounce: 0.15 });
  const metal = c.material({ ramp: GUNMETAL, lo: 0, hi: 3, spec: 0.2 });
  const glyphH = 16;
  const scr = scratches(`stencil-hd:${text}`, 1, 2, wl - 6, hl - 8, Math.max(2, Math.floor(wl / 26)), [2.5, 5]);
  const at = (x: number, y: number): number => {
    const X = Math.floor(x * d) - d;
    const Y = Math.floor(y * d) - d;
    return X < 0 || Y < 0 || X >= mw || Y >= mh ? 0 : dist[Y * mw + X];
  };
  const bev = 0.6 * d;
  c.heightField(
    1,
    1,
    cw * 2,
    ch * 2,
    (x, y) => {
      const e = at(x, y);
      if (e === 0) return NaN;
      const t = Math.min(1, (e - 0.5) / bev);
      return 0.6 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    },
    {
      mat: paint,
      z: 0,
      tex: (s) => {
        const row = (s.y - 1) / glyphH;
        s.tone += 0.22 - row * 0.5;
        // Bare dark metal in the scratches, a lit lip under them.
        for (const k of scr) {
          const e = scratchDist(k, s.x, s.y);
          if (e < k.w) {
            s.mat = metal;
            s.tone -= 0.1;
            s.dz = -0.3;
          } else if (e < k.w + 1 / d && s.y > (k.y0 + k.y1) / 2) s.tone += 0.25;
        }
        // Chips along the edges.
        const e = at(s.x, s.y) / d;
        if (e < 0.9 && noise2(s.x, s.y, 0.7, 211) > 0.78) {
          s.mat = metal;
          s.dz = -0.2;
        }
      },
    },
  );
  const lettered = c.render({ outline: 'A', ao: 0, sep: false, clean: true });
  const out = new PixelBuffer(wl * d, hl * d);
  const sh = PAL_HD.ink[0];
  for (let Y = 0; Y < mh; Y++) {
    for (let X = 0; X < mw; X++) if (mk[Y * mw + X]) out.set(X + 3 * d, Y + 3 * d, sh);
  }
  out.blit(lettered, 0, 0);
  return out;
}










/** A panel corner bolt (5 × 5, `drawMilPanel`): 1× the look of the panel's rect bolt. */
function panelBolt(): PixelBuffer {
  const b = new PixelBuffer(5, 5);
  b.rect(0, 0, 5, 5, INK);
  b.rect(1, 1, 3, 3, PAL.stone[2]);
  b.rect(1, 1, 2, 1, PAL.stone[3]);
  b.rect(3, 2, 1, 2, PAL.stone[0]);
  return b;
}

/** The panel corner bolt at density d: an ink socket, a domed hex bolt head with a slot. */
function panelBoltHd(d: HdD): PixelBuffer {
  const c = new HdCanvas(5, 5, d);
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  const bolt = c.material({ ramp: BOLT, lo: 1, hi: 5, spec: 0.7, shine: 26 });
  c.box(0, 0, 5, 5, { mat: ink, z: 0, round: 0 });
  boltHd(c, 2.5, 2.5, bolt, 0.5, 1.6);
  return c.render({ outline: 'none', ao: 0.2, sep: false });
}


export function defineMilitaryArt(): void {
  defineSprite('ui/mil/bolt', () => [panelBolt()], { ...TL, hd: (d) => [panelBoltHd(d)] });
  // The select-screen furniture: 1x only (docs/design/select40.md; pixel grid path B).
  defineSprite('ui/mil/frame', () => [frame()], TL);
  defineSprite('ui/mil/shutter', shutterFrames, { ...TL, ticksPerFrame: 2, loop: false });
  defineSprite('ui/mil/shutter-slam', slamFrames, { ...TL, ticksPerFrame: MIL_SLAM_TICKS, loop: false });
  defineSprite('ui/mil/dust', dustFrames, { ...TL, ticksPerFrame: MIL_DUST_TICKS, loop: false });
  defineSprite('ui/mil/hazard', () => [hazard()], TL);
  defineSprite('ui/mil/badge-off', () => [badge('off')], TL);
  defineSprite('ui/mil/badge-p1', () => [badge('p1'), badge('p1', true)], { ...TL, ticksPerFrame: 4 });
  defineSprite('ui/mil/badge-p2', () => [badge('p2'), badge('p2', true)], { ...TL, ticksPerFrame: 4 });
  defineSprite('ui/mil/glow-p1', () => [glow('p1')], TL);
  defineSprite('ui/mil/glow-p2', () => [glow('p2')], TL);
  defineSprite('ui/mil/plate', () => [plate()], TL);
  defineSprite('ui/mil/preview', () => [preview()], TL);
  defineSprite('ui/mil/preview-glare', () => [previewGlare()], TL);
  defineSprite('ui/mil/emblem', () => [emblem()], TL);
  for (const t of STENCIL_TITLES) {
    if (t === SELECT_TITLE) defineSprite(stencilId(t), () => [sprayTitle(t)], TL);
    else defineSprite(stencilId(t), () => [stencilTitle(t)], { ...TL, hd: (d) => [stencilTitleHd(t, false, d)] });
  }
  for (const t of STENCIL_GOLD) defineSprite(stencilId(t), () => [stencilTitle(t, true)], { ...TL, hd: (d) => [stencilTitleHd(t, true, d)] });
}
