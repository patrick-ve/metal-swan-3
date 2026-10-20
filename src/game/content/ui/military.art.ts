/**
 * Military menu art (docs/design/squad.md §2.3): the REPORT FOR DUTY select screen and the
 * stencil titles of the menus. Our own designs, drawn by code from the palette: rust-brown
 * riveted steel with bolts, weld seams and scratches, olive corrugated shutters with the squad
 * emblem (a stencilled swan head inside a chevron with a small 3), hazard stripes, lamp badges,
 * khaki nameplates and a glass preview window. Every id is top-left anchored.
 *
 * - `ui/mil/frame`      384 × 216, the select-screen frame; transparent panel windows (64 × 120)
 *                       at x = 14 + i·74, y 46 (MIL_PANEL_X / MIL_PANEL_Y / MIL_PANEL_W / MIL_PANEL_H)
 * - `ui/mil/shutter`    8 frames, 68 × 128: frame 0 closed … frame 7 fully raised (the door moves up)
 * - `ui/mil/hazard`     64 × 6 yellow / black strip (tiles every 8 px)
 * - `ui/mil/badge-off`, `ui/mil/badge-p1`, `ui/mil/badge-p2`  28 × 10 lamps (unlit, red P1, blue P2)
 * - `ui/mil/plate`      64 × 14 riveted nameplate (names go on top in the small font, ink)
 * - `ui/mil/preview`    44 × 52 grey-blue glass window with a steel bevel
 * - `ui/mil/emblem`     40 × 36 the squad emblem (stencil paint), also baked into the shutter
 * - `ui/mil/bolt`       5 × 5 corner bolt of the menu panels (`drawMilPanel`)
 * - `ui/mil/stencil-<slug>`  stencil lettering for the menu titles (STENCIL_TITLES, bone paint;
 *                       STENCIL_GOLD, gold paint: `PRESS START`; slug = the text in lower case
 *                       with '-' for spaces), the big font at scale 2
 */
import type { Color } from '../../../engine/color';
import { drawText, getFont, layoutText, measureText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { Rng } from '../../../engine/rng';
import { defineSprite } from '../../../engine/sprites';
import { HdCanvas, type Texture } from '../../art/hd/index';
import { hash1, hash2, noise2 } from '../../art/paint';

const MASK: Color = 0xff00ffff;
const TL = { anchor: 'top-left' } as const;

/** Select-screen layout (docs/design/squad.md §3.4), shared with the scene. */
export const MIL_PANELS = 5;
export const MIL_PANEL_W = 64;
export const MIL_PANEL_H = 120;
export const MIL_PANEL_Y = 46;
export const MIL_PANEL_STEP = 74;
export const MIL_PANEL_X0 = 14;
export const MIL_SHUTTER_FRAMES = 8;
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
export function stencilMask(text: string, scale: number, pad = 0): PixelBuffer {
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
        if (groups >= 2) for (const y of rows) cuts.push(gx + cut, y);
      }
    } else {
      const mid = gx + (w >> 1) - 1;
      for (const y of [0, 1, glyphH - 2, glyphH - 1]) {
        if (on(mid, y) && on(mid - 1, y) && on(mid + 1, y)) cuts.push(mid, y);
      }
    }
  });
  for (let i = 0; i < cuts.length; i += 2) m1.set(cuts[i], cuts[i + 1], 0);
  const out = new PixelBuffer(size.w * scale + pad * 2, size.h * scale + pad * 2);
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) if (on(x, y)) out.rect(pad + x * scale, pad + y * scale, scale, scale, MASK);
  }
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
// Rust-brown steel
// ---------------------------------------------------------------------------------------------

/**
 * A rust-brown steel plate filling (x, y, w, h): mottled 2 × 2 rust clusters, bevelled edges (lit
 * top-left, dark bottom-right), an ink seam on its right and bottom, scratches with a dark lip and
 * rust runs under a few bolts. Bolts sit in the corners and every ~20 px along the top and bottom.
 */
function rustPlate(b: PixelBuffer, x: number, y: number, w: number, h: number, rng: Rng, bolts = true): void {
  if (w <= 2 || h <= 2) return;
  b.rect(x, y, w, h, PAL.brown[1]);
  // Mottling: 2 × 2 clusters of darker rust and lighter brown.
  const blobs = Math.floor((w * h) / 70);
  for (let i = 0; i < blobs; i++) {
    const bx = x + 1 + rng.int(0, Math.max(0, w - 4));
    const by = y + 1 + rng.int(0, Math.max(0, h - 4));
    const r = rng.next();
    const c = r < 0.45 ? PAL.rust[1] : r < 0.8 ? PAL.brown[2] : PAL.brown[0];
    b.rect(bx, by, 2, 2, c);
    if (r < 0.3) b.rect(bx + 2, by, 2, 2, c);
  }
  // Bevel and seams.
  b.rect(x, y, w, 1, PAL.brown[3]);
  b.rect(x, y, 1, h, PAL.brown[2]);
  b.rect(x, y + h - 2, w, 1, PAL.brown[0]);
  b.rect(x + w - 2, y, 1, h - 1, PAL.brown[0]);
  b.rect(x, y + h - 1, w, 1, INK);
  b.rect(x + w - 1, y, 1, h, INK);
  // Scratches: a light stroke with a dark lip under it.
  const scratches = Math.max(1, Math.floor((w * h) / 900));
  for (let i = 0; i < scratches; i++) {
    const sx = x + 3 + rng.int(0, Math.max(0, w - 12));
    const sy = y + 3 + rng.int(0, Math.max(0, h - 8));
    const len = rng.int(4, 9);
    const dir = rng.next() < 0.5 ? 1 : -1;
    for (let k = 0; k < len; k++) {
      const px = sx + k;
      const py = sy + ((k * dir) >> 1) + (dir < 0 ? 3 : 0);
      if (px >= x + w - 3 || py <= y + 1 || py >= y + h - 3) continue;
      b.set(px, py, PAL.stone[2]);
      b.set(px, py + 1, PAL.brown[0]);
    }
  }
  if (!bolts) return;
  const boltAt = (bx: number, by: number, run: boolean): void => {
    bolt(b, bx, by);
    if (run && by + 4 < y + h - 3) {
      const len = rng.int(2, Math.min(9, y + h - 4 - (by + 3)));
      for (let k = 0; k < len; k++) b.set(bx + 1, by + 3 + k, k < len - 1 ? PAL.rust[2] : PAL.rust[1]);
    }
  };
  const top = y + 3;
  const bot = y + h - 6;
  if (w >= 10 && h >= 10) {
    boltAt(x + 3, top, rng.next() < 0.4);
    boltAt(x + w - 6, top, rng.next() < 0.4);
    if (h >= 16) {
      boltAt(x + 3, bot, false);
      boltAt(x + w - 6, bot, false);
    }
    const n = Math.floor((w - 12) / 22);
    for (let i = 1; i <= n; i++) {
      const bx = x + 3 + Math.round(((w - 9) * i) / (n + 1));
      boltAt(bx, top, rng.next() < 0.3);
      if (h >= 16) boltAt(bx, bot, false);
    }
  }
}

/** A 3 × 3 bolt head: a lit top-left, a dark bottom-right and an ink rim on the shadow side. */
function bolt(b: PixelBuffer, x: number, y: number): void {
  b.rect(x, y, 3, 3, PAL.stone[2]);
  b.set(x, y, PAL.stone[3]);
  b.set(x + 1, y, PAL.stone[3]);
  b.set(x, y + 1, PAL.stone[3]);
  b.set(x + 2, y + 1, PAL.stone[1]);
  b.set(x + 1, y + 2, PAL.stone[1]);
  b.set(x + 2, y + 2, PAL.stone[0]);
  b.set(x + 3, y + 1, PAL.brown[0]);
  b.set(x + 3, y + 2, PAL.brown[0]);
  b.set(x + 1, y + 3, PAL.brown[0]);
  b.set(x + 2, y + 3, PAL.brown[0]);
}

/** A vertical weld bead (2 px wide) from y0 to y1 at x. */
function weldV(b: PixelBuffer, x: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    const p = (y - y0) % 3;
    b.set(x, y, p === 0 ? PAL.brown[3] : p === 1 ? PAL.stone[2] : PAL.brown[2]);
    b.set(x + 1, y, p === 0 ? PAL.brown[2] : p === 1 ? PAL.brown[1] : PAL.brown[0]);
  }
}

/** A horizontal weld bead (2 px tall) from x0 to x1 at y. */
function weldH(b: PixelBuffer, y: number, x0: number, x1: number): void {
  for (let x = x0; x < x1; x++) {
    const p = (x - x0) % 3;
    b.set(x, y, p === 0 ? PAL.brown[3] : p === 1 ? PAL.stone[2] : PAL.brown[2]);
    b.set(x, y + 1, p === 0 ? PAL.brown[2] : p === 1 ? PAL.brown[1] : PAL.brown[0]);
  }
}

/** A recessed dark slot: an ink rim, a gunmetal fill, a shadow along the top and left inside. */
function recess(b: PixelBuffer, x: number, y: number, w: number, h: number, fill: Color = PAL.steel[0]): void {
  b.rect(x, y, w, h, INK);
  b.rect(x + 1, y + 1, w - 2, h - 2, fill);
  b.rect(x + 1, y + 1, w - 2, 1, PAL.ink[1]);
  b.rect(x + 1, y + 1, 1, h - 2, PAL.ink[1]);
  // The lit lip of the plate under the slot.
  b.rect(x, y + h, w + 1, 1, PAL.brown[3]);
  b.rect(x + w, y, 1, h, PAL.brown[3]);
}

/** Diagonal hazard stripes (gold / ink, period 8) in (x, y, w, h), with ink edges. */
function hazardRect(b: PixelBuffer, x: number, y: number, w: number, h: number, phase = 0): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (i + j + phase) & 7;
      let c: Color = k < 4 ? PAL.gold[2] : PAL.ink[1];
      if (k < 4 && j === 1) c = PAL.gold[3];
      if (k < 4 && j === h - 2) c = PAL.gold[1];
      b.set(x + i, y + j, c);
    }
  }
  b.rect(x, y, w, 1, INK);
  b.rect(x, y + h - 1, w, 1, INK);
}

// ---------------------------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------------------------

/** The select-screen frame (384 × 216) with five transparent windows. */
function frame(): PixelBuffer {
  const W = 384;
  const H = 216;
  const b = new PixelBuffer(W, H);
  const rng = new Rng('mil-frame');
  // The top band (y 0–44): three wide plates.
  rustPlate(b, 0, 0, 62, 45, rng);
  rustPlate(b, 62, 0, 260, 45, rng, false);
  rustPlate(b, 322, 0, 62, 45, rng);
  // Pillars between and beside the windows (y 45–170).
  for (let i = 0; i <= MIL_PANELS; i++) {
    const x0 = i === 0 ? 0 : milPanelX(i - 1) + MIL_PANEL_W;
    const x1 = i === MIL_PANELS ? W : milPanelX(i);
    rustPlate(b, x0, 45, x1 - x0, 126, rng, false);
    // A bolt column down each pillar.
    for (let y = 52; y < 166; y += 18) bolt(b, ((x0 + x1) >> 1) - 1, y);
  }
  // The nameplate rail (y 170–189) and the bottom band (y 189–216).
  rustPlate(b, 0, 170, 192, 20, rng);
  rustPlate(b, 192, 170, 192, 20, rng);
  rustPlate(b, 0, 189, 128, 27, rng);
  rustPlate(b, 128, 189, 128, 27, rng);
  rustPlate(b, 256, 189, 128, 27, rng);
  weldH(b, 44, 0, W);
  weldH(b, 169, 0, W);
  weldV(b, 191, 170, 189);
  // Title recess and hazard corners.
  const tr = MIL_TITLE_RECESS;
  recess(b, tr.x, tr.y, tr.w, tr.h);
  for (const x of [8, 330]) {
    b.rect(x - 1, 9, 48, 14, INK);
    hazardRect(b, x, 10, 46, 12, x);
  }
  // Badge slots (one per panel, y 30–42) and the window bezels.
  for (let i = 0; i < MIL_PANELS; i++) {
    const px = milPanelX(i);
    recess(b, px + 1, 30, 62, 13, PAL.ink[1]);
    const x = px - 3;
    const y = MIL_PANEL_Y - 3;
    const w = MIL_PANEL_W + 6;
    const h = MIL_PANEL_H + 6;
    // A gunmetal bezel 3 px wide, lit top-left, with a rivet in each corner.
    b.rect(x - 1, y - 1, w + 2, h + 2, INK);
    b.rect(x, y, w, h, PAL.steel[1]);
    b.rect(x, y, w, 1, PAL.steel[3]);
    b.rect(x, y, 1, h, PAL.steel[2]);
    b.rect(x, y + h - 1, w, 1, PAL.steel[0]);
    b.rect(x + w - 1, y, 1, h, PAL.steel[0]);
    for (const [cx, cy] of [
      [x + 1, y + 1],
      [x + w - 3, y + 1],
      [x + 1, y + h - 3],
      [x + w - 3, y + h - 3],
    ]) {
      b.set(cx, cy, PAL.steel[4]);
      b.set(cx + 1, cy + 1, PAL.steel[0]);
    }
    // The window: transparent, with an ink edge inside the bezel.
    b.rect(px - 1, MIL_PANEL_Y - 1, MIL_PANEL_W + 2, MIL_PANEL_H + 2, INK);
    b.rect(px, MIL_PANEL_Y, MIL_PANEL_W, MIL_PANEL_H, 0);
  }
  // The bottom text band.
  const bb = MIL_BOTTOM_BAND;
  recess(b, bb.x, bb.y + 1, bb.w, bb.h, PAL.ink[1]);
  return b;
}

/**
 * The squad emblem (40 × 36): a down-pointing chevron, a swan's neck rising out of it in an S to
 * a head facing right (the eye a stencil hole, a stencil gap between head and beak) and a "3" in
 * the top left corner. Our own mark: never an "M3" monogram.
 */
function emblemMask(): PixelBuffer {
  const w = 40;
  const h = 36;
  const m = new PixelBuffer(w, h);
  // The chevron: two thick strokes meeting at the bottom, a stencil gap at the apex.
  m.thickLine(3, 17, 19, 32, 6, MASK);
  m.thickLine(36, 17, 20, 32, 6, MASK);
  m.rect(19, 24, 2, 12, 0);
  // The swan: a neck in an S (thicker at its base) from the chevron's inside up to the head.
  m.thickLine(19, 28, 15, 22, 7, MASK);
  m.thickLine(15, 22, 15, 16, 6, MASK);
  m.thickLine(15, 16, 18, 10, 6, MASK);
  m.ellipse(13, 1, 12, 10, MASK);
  // The beak: a wedge to the right, a stencil gap where it meets the head; the eye is a hole.
  m.tri(26, 4, 37, 8, 26, 11, MASK);
  m.rect(25, 3, 1, 9, 0);
  m.rect(19, 4, 2, 2, 0);
  // The "3" in the top left corner.
  drawText(m, '3', 2, 1, { font: 'big', color: MASK });
  return m;
}

/** The emblem as stencil paint (sand, lit at the top) on a transparent ground. */
function emblem(): PixelBuffer {
  const m = emblemMask();
  const b = new PixelBuffer(m.w, m.h);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (m.get(x, y) !== MASK) continue;
      let c: Color = y < 12 ? PAL.sand[3] : PAL.sand[2];
      if (m.get(x, y + 1) !== MASK) c = PAL.sand[1];
      b.set(x, y, c);
    }
  }
  // Worn paint: a few bare 2 × 1 chips.
  const rng = new Rng('mil-emblem');
  for (let i = 0; i < 7; i++) {
    const x = rng.int(2, m.w - 4);
    const y = rng.int(2, m.h - 3);
    if (b.get(x, y) !== 0 && b.get(x + 1, y) !== 0 && b.get(x - 1, y) !== 0) {
      b.set(x, y, PAL.sand[0]);
      b.set(x + 1, y, PAL.sand[0]);
    }
  }
  return b;
}

/** The full shutter door (68 × 128): olive corrugated slats, side guides, the emblem, a hazard foot. */
function shutterDoor(): PixelBuffer {
  const W = 68;
  const H = 128;
  const b = new PixelBuffer(W, H);
  const slat: Color[] = [PAL.olive[3], PAL.olive[2], PAL.olive[2], PAL.olive[1], PAL.olive[0]];
  for (let y = 0; y < H; y++) b.rect(0, y, W, 1, slat[y % 5]);
  // Side guides (steel channels).
  for (const x of [0, W - 4]) {
    b.rect(x, 0, 4, H, PAL.steel[1]);
    b.rect(x + 1, 0, 1, H, PAL.steel[2]);
    b.rect(x + 3, 0, 1, H, PAL.steel[0]);
  }
  const rng = new Rng('mil-shutter');
  // Weathering: rust clusters on the slats, a few dents (lit / dark pairs).
  for (let i = 0; i < 26; i++) {
    const x = rng.int(6, W - 10);
    const y = rng.int(2, H - 22);
    if (y % 5 === 4) continue;
    b.rect(x, y, 2, 1, rng.next() < 0.6 ? PAL.rust[1] : PAL.brown[1]);
    if (rng.next() < 0.4) b.set(x + 1, y + 1, PAL.rust[2]);
  }
  for (let i = 0; i < 6; i++) {
    const x = rng.int(8, W - 14);
    const y = rng.int(4, H - 26);
    for (let k = 0; k < 5; k++) b.set(x + k, y + (k >> 1), PAL.olive[3]);
    for (let k = 0; k < 5; k++) b.set(x + k, y + 1 + (k >> 1), PAL.olive[0]);
  }
  // The squad emblem in the upper part.
  const e = emblem();
  b.blit(e, (W - e.w) >> 1, 9);
  // The foot: a hazard band and a steel bottom lip with a handle.
  hazardRect(b, 4, H - 14, W - 8, 8);
  b.rect(0, H - 6, W, 6, PAL.steel[2]);
  b.rect(0, H - 6, W, 1, PAL.steel[4]);
  b.rect(0, H - 2, W, 1, PAL.steel[0]);
  b.rect(0, H - 1, W, 1, INK);
  b.rect((W >> 1) - 7, H - 5, 14, 2, PAL.steel[0]);
  b.rect((W >> 1) - 6, H - 4, 12, 1, PAL.steel[3]);
  return b;
}

/** 8 frames: the door raised by 0, 1/7 … 7/7 of its height (frame 7: fully open, empty). */
function shutterFrames(): PixelBuffer[] {
  const door = shutterDoor();
  const out: PixelBuffer[] = [];
  for (let k = 0; k < MIL_SHUTTER_FRAMES; k++) {
    const f = new PixelBuffer(door.w, door.h);
    const d = Math.round((door.h * k) / (MIL_SHUTTER_FRAMES - 1));
    if (d < door.h) f.blit(door, 0, -d);
    out.push(f);
  }
  return out;
}

function hazard(): PixelBuffer {
  const b = new PixelBuffer(64, 6);
  hazardRect(b, 0, 0, 64, 6);
  return b;
}

/** A lamp badge (28 × 10): a dark glass cell; lit, a glowing P1 (red) or P2 (blue). */
function badge(kind: 'off' | 'p1' | 'p2'): PixelBuffer {
  const W = 28;
  const H = 10;
  const b = new PixelBuffer(W, H);
  b.rect(0, 0, W, H, INK);
  if (kind === 'off') {
    b.rect(1, 1, W - 2, H - 2, PAL.steel[0]);
    for (let x = 3; x < W - 2; x += 3) b.rect(x, 1, 1, H - 2, PAL.ink[1]);
    b.rect(1, 1, W - 2, 1, PAL.steel[1]);
    return b;
  }
  const ramp = kind === 'p1' ? [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]] : [PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2]];
  b.rect(1, 1, W - 2, H - 2, ramp[1]);
  b.rect(2, 2, W - 4, H - 4, ramp[2]);
  b.rect(1, 1, W - 2, 1, ramp[3]);
  b.rect(1, H - 2, W - 2, 1, ramp[0]);
  // The text: white core with a glow ring in the lamp's light colour.
  const t = new PixelBuffer(W, H);
  drawText(t, kind === 'p1' ? 'P1' : 'P2', W >> 1, 2, { font: 'small', color: PAL.snow[3], align: 'center' });
  const glow = t.clone().outline(ramp[3]);
  b.blit(glow, 0, 0);
  return b;
}

/** The nameplate (64 × 14): khaki paint on steel, bevelled, a brass rivet at each end. */
function plate(): PixelBuffer {
  const W = 64;
  const H = 14;
  const b = new PixelBuffer(W, H);
  b.rect(0, 0, W, H, INK);
  b.rect(1, 1, W - 2, H - 2, PAL.sand[2]);
  b.rect(1, 1, W - 2, 1, PAL.sand[3]);
  b.rect(1, 1, 1, H - 2, PAL.sand[3]);
  b.rect(1, H - 2, W - 2, 1, PAL.sand[0]);
  b.rect(W - 2, 1, 1, H - 2, PAL.sand[0]);
  b.rect(2, H - 3, W - 4, 1, PAL.sand[1]);
  for (const x of [3, W - 6]) {
    b.rect(x, 5, 3, 3, PAL.brass[1]);
    b.set(x, 5, PAL.brass[3]);
    b.set(x + 2, 7, PAL.brass[0]);
  }
  // Worn paint chips.
  b.rect(12, 2, 3, 1, PAL.sand[1]);
  b.rect(47, 10, 2, 1, PAL.sand[1]);
  return b;
}

/** The preview window (44 × 52): a steel bevel round grey-blue glass with a diagonal glint. */
function preview(): PixelBuffer {
  const W = 44;
  const H = 52;
  const b = new PixelBuffer(W, H);
  b.rect(0, 0, W, H, INK);
  b.rect(1, 1, W - 2, H - 2, PAL.steel[2]);
  b.rect(1, 1, W - 2, 1, PAL.steel[4]);
  b.rect(1, 1, 1, H - 2, PAL.steel[3]);
  b.rect(1, H - 2, W - 2, 1, PAL.steel[0]);
  b.rect(W - 2, 1, 1, H - 2, PAL.steel[0]);
  b.rect(3, 3, W - 6, H - 6, INK);
  // The glass: navy at the top to slate at the bottom, banded.
  const glass: Color[] = [PAL.navy[0], PAL.navy[1], PAL.steel[0], PAL.steel[1]];
  const gh = H - 8;
  for (let y = 0; y < gh; y++) b.rect(4, 4 + y, W - 8, 1, glass[Math.min(3, Math.floor((y * 4) / gh))]);
  // The glint: two thin diagonal streaks at the top left.
  for (let k = 0; k < 10; k++) {
    b.set(6 + k, 14 - k, PAL.steel[2]);
    if (k < 6) b.set(6 + k, 18 - k, PAL.steel[1]);
  }
  // Rivets in the bevel corners.
  for (const [x, y] of [
    [1, 1],
    [W - 3, 1],
    [1, H - 3],
    [W - 3, H - 3],
  ]) b.set(x, y, PAL.steel[4]);
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
const RUST_PAINT: Ramp = [PAL_HD.ink[0], PAL_HD.brown[0], PAL_HD.brown[1], PAL_HD.brown[2], PAL_HD.rust[1], PAL_HD.brown[3], PAL_HD.brown[4], PAL_HD.brown[6]];
const RUST: Ramp = [PAL_HD.brown[0], PAL_HD.rust[0], PAL_HD.rust[1], PAL_HD.rust[2], PAL_HD.rust[3], PAL_HD.rust[4], PAL_HD.rust[6]];
const GUNMETAL: Ramp = [PAL_HD.ink[0], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[3], PAL_HD.steel[4], PAL_HD.steel[5], PAL_HD.steel[7]];
const BOLT: Ramp = [PAL_HD.ink[0], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4], PAL_HD.stone[5], PAL_HD.stone[6], PAL_HD.stone[7]];
const WELD: Ramp = [PAL_HD.ink[0], PAL_HD.brown[1], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4], PAL_HD.stone[6]];
const SLOT: Ramp = [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[3]];
const HAZ_GOLD: Ramp = [PAL_HD.gold[0], PAL_HD.gold[1], PAL_HD.gold[2], PAL_HD.gold[3], PAL_HD.gold[4], PAL_HD.gold[5], PAL_HD.gold[6]];
const HAZ_INK: Ramp = [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2]];

/** Bolt-head positions (3 × 3 heads, top-left) of a 1× rust plate with bolts (as `rustPlate`). */
function plateBolts(x: number, y: number, w: number, h: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (w < 10 || h < 10) return out;
  const top = y + 3;
  const bot = y + h - 6;
  out.push([x + 3, top], [x + w - 6, top]);
  if (h >= 16) out.push([x + 3, bot], [x + w - 6, bot]);
  const n = Math.floor((w - 12) / 22);
  for (let i = 1; i <= n; i++) {
    const bx = x + 3 + Math.round(((w - 9) * i) / (n + 1));
    out.push([bx, top]);
    if (h >= 16) out.push([bx, bot]);
  }
  return out;
}

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

/** A weld bead along a line: overlapping ripples of lit steel. */
function weldHd(c: HdCanvas, x0: number, y0: number, x1: number, y1: number, mat: number, z: number, seed: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(len / 0.7));
  const p = c.newPart();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = (hash1(i, seed) - 0.5) * 0.15;
    c.ellipsoid(x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t + j, 0.95, 0.95, { mat, z: z + i * 0.0005, part: p, round: 0.7 });
  }
}

/** A recess (a slot pressed into the plate): sloped inner walls in `wall`, a dark floor in `floor`. */
function recessHd(c: HdCanvas, x: number, y: number, w: number, h: number, wall: number, floor: number, depth = 0.9): void {
  const b = 0.8;
  const p = c.newPart();
  c.erase(x - 0.5, y - 0.5, w + 1, h + 1, () => true);
  c.heightField(
    x - 0.5,
    y - 0.5,
    w + 1,
    h + 1,
    (px, py) => {
      const e = Math.min(px - (x - 0.5), x + w + 0.5 - px, py - (y - 0.5), y + h + 0.5 - py);
      return -Math.min(depth, (e * depth) / b);
    },
    {
      mat: floor,
      part: p,
      z: 0,
      tex: (s) => {
        const e = Math.min(s.x - (x - 0.5), x + w + 0.5 - s.x, s.y - (y - 0.5), y + h + 0.5 - s.y);
        if (e < b) s.mat = wall;
        else {
          // The plate's shadow inside the slot (top and left), faint brushed grain on the floor.
          if (s.x - x < 1.2 || s.y - y < 1.2) s.tone -= 0.3;
          s.tone += (noise2(s.x * 0.15, s.y * 2.5, 1, 337) - 0.5) * 0.18;
        }
      },
    },
  );
}

/** Hazard stripes painted on a steel strip (gold / black, period 8 px, worn). */
function hazardTex(gold: number, black: number, bare: number, x0: number, y0: number, phase: number, seed: number): Texture {
  return (s) => {
    const k = (((s.x - x0 + (s.y - y0) + phase) % 8) + 8) % 8;
    s.mat = k < 4 ? gold : black;
    // A soft lift at the stripe borders (thick paint), grime toward the bottom, chips of bare steel.
    s.tone -= Math.max(0, s.v - 0.6) * 0.35;
    const chip = noise2(s.x, s.y, 1.3, seed);
    if (chip > 0.88) {
      s.mat = bare;
      s.tone -= 0.35;
      s.dz = -0.05;
    } else if (chip > 0.83) s.tone -= 0.2;
  };
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

/** The select-screen frame at density d: riveted rust-brown steel plates, welds, slots, bezels, five windows. */
function frameHd(d: HdD): PixelBuffer {
  const W = 384;
  const H = 216;
  const c = new HdCanvas(W, H, d);
  const paint = c.material({ ramp: RUST_PAINT, lo: 1, hi: 6, spec: 0.12, shine: 10, wrap: 0.1 });
  const rust = c.material({ ramp: RUST, lo: 0, hi: 4, spec: 0.05, wrap: 0.1 });
  const bare = c.material({ ramp: BOLT, lo: 2, hi: 5, spec: 0.5, shine: 28 });
  const bolt = c.material({ ramp: BOLT, lo: 1, hi: 5, spec: 0.7, shine: 26 });
  const weld = c.material({ ramp: WELD, lo: 1, hi: 5, spec: 0.6, shine: 22 });
  const steel = c.material({ ramp: GUNMETAL, lo: 1, hi: 6, spec: 0.55, shine: 26 });
  const slot = c.material({ ramp: SLOT, lo: 0, hi: 3, wrap: 0.1 });
  const back = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.brown[0]], flat: true, lo: 0, hi: 0 });
  const gold = c.material({ ramp: HAZ_GOLD, lo: 1, hi: 5, spec: 0.15 });
  const black = c.material({ ramp: HAZ_INK, lo: 0, hi: 3, spec: 0.15 });
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  // The dark gap behind the plates (the seams).
  c.box(0, 0, W, H, { mat: back, z: -3, round: 0 });
  // Plates: 1× rects; the right and bottom ½ px left open as the seam.
  const plates: Array<[number, number, number, number, boolean]> = [
    [0, 0, 62, 45, true],
    [62, 0, 260, 45, false],
    [322, 0, 62, 45, true],
  ];
  for (let i = 0; i <= MIL_PANELS; i++) {
    const x0 = i === 0 ? 0 : milPanelX(i - 1) + MIL_PANEL_W;
    const x1 = i === MIL_PANELS ? W : milPanelX(i);
    plates.push([x0, 45, x1 - x0, 125, false]);
  }
  plates.push([0, 170, 192, 19, true], [192, 170, 192, 19, true], [0, 189, 128, 27, true], [128, 189, 128, 27, true], [256, 189, 128, 27, true]);
  const scr = scratches('mil-frame-hd', 4, 4, W - 8, H - 8, 34, [3, 8]);
  const runs: Array<[number, number, number]> = [];
  plates.forEach(([x, y, w, h, withBolts], i) => {
    if (withBolts) {
      for (const [bx, by] of plateBolts(x, y, w, h)) if (hash2(bx, by, 307) < 0.45 && by < y + h - 10) runs.push([bx + 1.5, by + 3, 2 + hash2(bx, by, 311) * 6]);
    }
    c.box(x, y, w - 0.5, h - 0.5, {
      mat: paint,
      z: 0,
      bevel: 1,
      tex: (s) => {
        const n = noise2(s.x, s.y, 6, 401 + i) * 0.6 + noise2(s.x, s.y, 2.2, 431 + i) * 0.4;
        if (n > 0.6) {
          s.mat = rust;
          s.tone += (n - 0.6) * 1.2 - 0.05;
          s.nx += (noise2(s.x, s.y, 0.5, 461) - 0.5) * 0.9;
          s.ny += (noise2(s.x + 9, s.y, 0.5, 461) - 0.5) * 0.9;
        } else s.tone += (n - 0.4) * 0.35;
        // Grime toward the bottom of each plate.
        s.tone -= Math.max(0, s.v - 0.65) * 0.45;
        for (const [rx, ry, len] of runs) {
          const t = (s.y - ry) / len;
          if (t >= 0 && t <= 1 && Math.abs(s.x - rx) < 0.55 * (1 - t * 0.7)) {
            s.mat = rust;
            s.tone += 0.15 - t * 0.35;
          }
        }
        for (const k of scr) {
          const e = scratchDist(k, s.x, s.y);
          if (e < k.w) {
            s.mat = bare;
            s.tone -= 0.15;
          } else if (e < k.w + 0.6 && s.y > Math.min(k.y0, k.y1) + 0.3) s.tone -= 0.3;
        }
      },
    });
    if (withBolts) for (const [bx, by] of plateBolts(x, y, w, h)) boltHd(c, bx + 1.5, by + 1.5, bolt, 0.9);
  });
  // A bolt column down each pillar.
  for (let i = 0; i <= MIL_PANELS; i++) {
    const x0 = i === 0 ? 0 : milPanelX(i - 1) + MIL_PANEL_W;
    const x1 = i === MIL_PANELS ? W : milPanelX(i);
    for (let y = 52; y < 166; y += 18) boltHd(c, ((x0 + x1) >> 1) + 0.5, y + 1.5, bolt, 0.9, 1.3);
  }
  // Welds along the plate seams.
  weldHd(c, 0, 44.9, W, 44.9, weld, 0.5, 503);
  weldHd(c, 0, 169.9, W, 169.9, weld, 0.5, 509);
  weldHd(c, 191.9, 170.5, 191.9, 189, weld, 0.5, 521);
  // The title recess, hazard corners, the badge slots and the bottom text band.
  const tr = MIL_TITLE_RECESS;
  recessHd(c, tr.x, tr.y, tr.w, tr.h, paint, slot, 1.1);
  for (const x of [8, 330]) {
    c.box(x - 1, 9, 48, 14, { mat: ink, z: 1.2, round: 0 });
    c.box(x, 10, 46, 12, { mat: gold, z: 1.4, bevel: 0.5, tex: hazardTex(gold, black, bare, x, 10, x, 541 + x) });
  }
  for (let i = 0; i < MIL_PANELS; i++) recessHd(c, milPanelX(i) + 1, 30, 62, 13, paint, slot, 0.8);
  const bb = MIL_BOTTOM_BAND;
  recessHd(c, bb.x, bb.y + 1, bb.w, bb.h, paint, slot, 1);
  // The window bezels: gunmetal bars, lit top-left, a screw in each corner; the windows open.
  for (let i = 0; i < MIL_PANELS; i++) {
    const px = milPanelX(i);
    const x = px - 3;
    const y = MIL_PANEL_Y - 3;
    const w = MIL_PANEL_W + 6;
    const h = MIL_PANEL_H + 6;
    const p = c.newPart();
    c.box(x - 0.5, y - 0.5, w + 1, h + 1, { mat: ink, z: 1.1, round: 0 });
    c.box(x, y, w, 2.5, { mat: steel, z: 1.3, bevel: 0.7, part: p });
    c.box(x, y + h - 2.5, w, 2.5, { mat: steel, z: 1.3, bevel: 0.7, part: p });
    c.box(x, y, 2.5, h, { mat: steel, z: 1.3, bevel: 0.7, part: p });
    c.box(x + w - 2.5, y, 2.5, h, { mat: steel, z: 1.3, bevel: 0.7, part: p });
    for (const [sx, sy] of [
      [x + 1.25, y + 1.25],
      [x + w - 1.25, y + 1.25],
      [x + 1.25, y + h - 1.25],
      [x + w - 1.25, y + h - 1.25],
    ] as const) c.ellipsoid(sx, sy, 0.75, 0.75, { mat: bolt, z: 1.9, round: 0.8 });
    c.erase(px, MIL_PANEL_Y, MIL_PANEL_W, MIL_PANEL_H, () => true);
  }
  const out = c.render({ outline: 'none', ao: 0.3, sep: false, shadow: 0.35, shadowMax: 2 });
  // The ink edge inside each bezel (½ px, as the 1× edge reads at this size).
  const e = d >> 1;
  for (let i = 0; i < MIL_PANELS; i++) {
    const X = milPanelX(i) * d;
    const Y = MIL_PANEL_Y * d;
    out.rect(X - e, Y - e, MIL_PANEL_W * d + 2 * e, e, PAL_HD.ink[0]);
    out.rect(X - e, Y + MIL_PANEL_H * d, MIL_PANEL_W * d + 2 * e, e, PAL_HD.ink[0]);
    out.rect(X - e, Y, e, MIL_PANEL_H * d, PAL_HD.ink[0]);
    out.rect(X + MIL_PANEL_W * d, Y, e, MIL_PANEL_H * d, PAL_HD.ink[0]);
  }
  return out;
}

/** The squad emblem as an art-px mask at density d (the 1× strokes, drawn at d). */
function emblemMaskHd(d: HdD): PixelBuffer {
  const m = new PixelBuffer(40 * d, 36 * d);
  const L = (x0: number, y0: number, x1: number, y1: number, w: number): void => {
    m.thickLine((x0 + 0.5) * d - 0.5, (y0 + 0.5) * d - 0.5, (x1 + 0.5) * d - 0.5, (y1 + 0.5) * d - 0.5, w * d, MASK);
  };
  L(3, 17, 19, 32, 6);
  L(36, 17, 20, 32, 6);
  m.rect(19 * d, 24 * d, 2 * d, 12 * d, 0);
  L(19, 28, 15, 22, 7);
  L(15, 22, 15, 16, 6);
  L(15, 16, 18, 10, 6);
  m.ellipse(13 * d, d, 12 * d, 10 * d, MASK);
  m.tri(26 * d, 4 * d, 37 * d, 8 * d, 26 * d, 11 * d, MASK);
  m.rect(25 * d, 3 * d, d, 9 * d, 0);
  m.rect(19 * d, 4 * d, 2 * d, 2 * d, 0);
  drawText(m, '3', 2, 1, { font: 'big', color: MASK }, d);
  return m;
}

/** The squad emblem (40 × 36) at density d: worn stencil paint, lit toward the top. */
function emblemHd(d: HdD): PixelBuffer {
  const m = emblemMaskHd(d);
  const c = new HdCanvas(40, 36, d);
  c.paint(0, 0, 40, 36, (x, y, X, Y) => {
    if (m.get(X, Y) !== MASK) return 0;
    if (noise2(x, y, 2.2, 223) > 0.78 || noise2(x, y, 0.7, 227) > 0.86) return 0;
    const t = y < 12 ? 5 : y < 24 ? 4 : 3;
    return m.get(X, Y + 1) !== MASK ? PAL_HD.sand[2] : PAL_HD.sand[t];
  });
  return c.render({ outline: 'none', ao: 0, sep: false, clean: false });
}

/** The shutter door (68 × 128) at density d: corrugated olive slats, steel guides, the emblem, the hazard foot. */
function shutterDoorHd(d: HdD): PixelBuffer {
  const W = 68;
  const H = 128;
  const c = new HdCanvas(W, H, d);
  const olive = c.material({ ramp: PAL_HD.olive, lo: 1, hi: 5, spec: 0.18, shine: 14, wrap: 0.1 });
  const rust = c.material({ ramp: RUST, lo: 0, hi: 4, wrap: 0.1 });
  const paint = c.material({ ramp: PAL_HD.sand, lo: 2, hi: 6, spec: 0.1, wrap: 0.15 });
  const steel = c.material({ ramp: GUNMETAL, lo: 1, hi: 6, spec: 0.55, shine: 24 });
  const bare = c.material({ ramp: BOLT, lo: 2, hi: 5, spec: 0.4 });
  const gold = c.material({ ramp: HAZ_GOLD, lo: 1, hi: 5, spec: 0.15 });
  const black = c.material({ ramp: HAZ_INK, lo: 0, hi: 3, spec: 0.15 });
  const em = emblemMaskHd(d);
  const ex = (W - 40) >> 1;
  const ey = 9;
  // Dents: shallow dimples (lit on the lower right edge, dark on the upper left).
  const rng = new Rng('mil-shutter-hd');
  const dents: Array<[number, number, number]> = [];
  for (let i = 0; i < 7; i++) dents.push([rng.range(8, W - 10), rng.range(4, H - 26), rng.range(1.6, 3)]);
  c.heightField(
    4,
    0,
    W - 8,
    H - 14,
    (x, y) => {
      const v = (((y % 5) + 5) % 5) / 5;
      let h = 0.85 * Math.sqrt(Math.max(0, Math.sin(Math.PI * v)));
      for (const [dx, dy, r] of dents) {
        const q = ((x - dx) / r) ** 2 + ((y - dy) / (r * 0.6)) ** 2;
        if (q < 1) h -= 0.5 * (1 - q) * (1 - q);
      }
      return h;
    },
    {
      mat: olive,
      z: 0,
      tex: (s) => {
        const v = (((s.y % 5) + 5) % 5) / 5;
        // Rust where water stands in the grooves, vertical grime streaks.
        if ((v > 0.8 || v < 0.06) && noise2(s.x, s.y, 4, 601) > 0.72) {
          s.mat = rust;
          s.tone -= 0.25;
        }
        const g = noise2(s.x * 0.9, s.y * 0.06, 2, 607);
        if (g > 0.62) s.tone -= (g - 0.62) * 0.6;
        s.tone -= Math.max(0, s.y / H - 0.75) * 0.5;
        // The emblem in worn stencil paint.
        const X = s.X - ex * d;
        const Y = s.Y - ey * d;
        if (X >= 0 && Y >= 0 && X < em.w && Y < em.h && em.get(X, Y) === MASK) {
          const wear = Math.max(noise2(s.x, s.y, 2.4, 613), noise2(s.x, s.y, 0.8, 617) - 0.08);
          if (wear < 0.78) {
            s.mat = paint;
            s.tone += s.y < ey + 12 ? 0.12 : 0;
          } else if (wear < 0.86) s.mat = bare;
        }
      },
    },
  );
  // Side guides: steel channels with a groove.
  for (const x of [0, W - 4]) {
    const p = c.newPart();
    c.box(x, 0, 4, H - 6, { mat: steel, z: 1, bevel: 0.9, part: p });
    c.shade(x + 1.6, 0, 0.8, H - 6, () => -0.45, p);
  }
  // The foot: a hazard band, the steel bottom lip with its handle.
  c.box(4, H - 14, W - 8, 8, { mat: gold, z: 0.4, bevel: 0.4, tex: hazardTex(gold, black, bare, 4, H - 14, 0, 619) });
  c.box(0, H - 6, W, 5.5, { mat: steel, z: 1.2, bevel: 0.9 });
  const hp = c.newPart();
  c.box(W / 2 - 7, H - 5, 2, 3, { mat: steel, z: 1.6, bevel: 0.5, part: hp, tone: -0.2 });
  c.box(W / 2 + 5, H - 5, 2, 3, { mat: steel, z: 1.6, bevel: 0.5, part: hp, tone: -0.2 });
  c.capsule(W / 2 - 6, H - 4.2, W / 2 + 6, H - 4.2, 0.8, 0.8, { mat: steel, z: 2.1 });
  const out = c.render({ outline: 'none', ao: 0.35, sep: true, sepZ: 0.6, shadow: 0.3, shadowMax: 2 });
  out.rect(0, (H - 0.5) * d, W * d, d >> 1, PAL_HD.ink[0]);
  return out;
}

/** 8 frames at density d: the HD door raised by 0, 1/7 … 7/7 of its height (as `shutterFrames`). */
function shutterFramesHd(d: HdD): PixelBuffer[] {
  const door = shutterDoorHd(d);
  const H = 128;
  const out: PixelBuffer[] = [];
  for (let k = 0; k < MIL_SHUTTER_FRAMES; k++) {
    const f = new PixelBuffer(door.w, door.h);
    const dk = Math.round((H * k) / (MIL_SHUTTER_FRAMES - 1));
    if (dk < H) f.blit(door, 0, -dk * d);
    out.push(f);
  }
  return out;
}

/** The hazard strip (64 × 6) at density d: painted stripes on steel, ink rims, worn. */
function hazardHd(d: HdD): PixelBuffer {
  const c = new HdCanvas(64, 6, d);
  const gold = c.material({ ramp: HAZ_GOLD, lo: 1, hi: 5, spec: 0.15 });
  const black = c.material({ ramp: HAZ_INK, lo: 0, hi: 3, spec: 0.15 });
  const bare = c.material({ ramp: BOLT, lo: 2, hi: 5, spec: 0.4 });
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  c.box(0, 0, 64, 6, { mat: ink, z: 0, round: 0 });
  c.box(0, 1, 64, 4, { mat: gold, z: 0.3, bevel: 0.6, tex: hazardTex(gold, black, bare, 0, 0, 0, 631) });
  return c.render({ outline: 'none', ao: 0, sep: false });
}

/** A lamp badge (28 × 10) at density d: dark glass behind a grille, or a glowing P1 / P2 lens. */
function badgeHd(kind: 'off' | 'p1' | 'p2', d: HdD): PixelBuffer {
  const W = 28;
  const H = 10;
  const c = new HdCanvas(W, H, d);
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  c.box(0, 0, W, H, { mat: ink, z: 0, round: 0 });
  if (kind === 'off') {
    const glass = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.slate[1], PAL_HD.slate[2], PAL_HD.slate[3], PAL_HD.slate[5]], lo: 1, hi: 3, spec: 0.8, shine: 30 });
    const grille = c.material({ ramp: GUNMETAL, lo: 1, hi: 4, spec: 0.4 });
    c.box(1, 1, W - 2, H - 2, { mat: glass, z: 0.2, bevel: 1.2, r: 0.8 });
    for (let x = 3; x < W - 2; x += 3) c.capsule(x + 0.5, 1.2, x + 0.5, H - 1.2, 0.35, 0.35, { mat: grille, z: 0.8 });
    return c.render({ outline: 'none', ao: 0.3, sep: false, shadow: 0.3, shadowMax: 1 });
  }
  const ramp = kind === 'p1' ? PAL_HD.red : PAL_HD.sky;
  const lens = c.material({ ramp, flat: true, lo: 1, hi: ramp.length - 2 });
  // The lens glows brightest in the middle; a curved glass glint across its upper left.
  c.box(1, 1, W - 2, H - 2, {
    mat: lens,
    z: 0.2,
    r: 0.8,
    tex: (s) => {
      const gx = (s.u - 0.5) * 2;
      const gy = (s.v - 0.45) * 2;
      s.tone += 0.35 - (gx * gx * 0.5 + gy * gy) * 0.55;
    },
  });
  c.paint(2.5, 1.5, W - 6, 0.5, (x) => (x < W * 0.6 ? ramp[ramp.length - 1] : ramp[ramp.length - 2]));
  c.paint(2, 2, 0.5, 2.5, () => ramp[ramp.length - 2]);
  const out = c.render({ outline: 'none', ao: 0, sep: false, clean: false });
  const glow = kind === 'p1' ? PAL_HD.red[6] : PAL_HD.sky[5];
  drawText(out, kind === 'p1' ? 'P1' : 'P2', W >> 1, 2, { font: 'small', color: PAL_HD.snow[6], align: 'center', outline: glow }, d);
  return out;
}

/** The nameplate (64 × 14) at density d: khaki enamel on a steel blank, brass rivets, worn edges. */
function plateHd(d: HdD): PixelBuffer {
  const W = 64;
  const H = 14;
  const c = new HdCanvas(W, H, d);
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  const khaki = c.material({ ramp: PAL_HD.sand, lo: 2, hi: 6, spec: 0.2, shine: 16, wrap: 0.15 });
  const bare = c.material({ ramp: BOLT, lo: 2, hi: 5, spec: 0.5 });
  const brass = c.material({ ramp: PAL_HD.gold, lo: 1, hi: 5, spec: 0.8, shine: 26 });
  c.box(0, 0, W, H, { mat: ink, z: 0, round: 0 });
  c.box(1, 1, W - 2, H - 2, {
    mat: khaki,
    z: 0.3,
    bevel: 1,
    tex: (s) => {
      s.tone -= Math.max(0, s.v - 0.7) * 0.4;
      const e = Math.min(s.x - 1, W - 1 - s.x, s.y - 1, H - 1 - s.y);
      if (e < 0.9 && noise2(s.x, s.y, 0.8, 641) > 0.74) s.mat = bare;
      else if (noise2(s.x, s.y, 3, 643) > 0.7) s.tone -= 0.12;
    },
  });
  for (const x of [4.5, W - 4.5]) c.ellipsoid(x, 6.5, 1.5, 1.5, { mat: brass, z: 1, round: 0.8 });
  return c.render({ outline: 'none', ao: 0.3, sep: false, shadow: 0.3, shadowMax: 1 });
}

/** The preview window (44 × 52) at density d: a bevelled steel frame with screws round a grey-blue glass. */
function previewHd(d: HdD): PixelBuffer {
  const W = 44;
  const H = 52;
  const c = new HdCanvas(W, H, d);
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  const steel = c.material({ ramp: GUNMETAL, lo: 1, hi: 6, spec: 0.55, shine: 24 });
  const bolt = c.material({ ramp: BOLT, lo: 1, hi: 5, spec: 0.7, shine: 26 });
  const glassR: Ramp = [PAL_HD.navy[0], PAL_HD.navy[1], PAL_HD.navy[2], PAL_HD.slate[2], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.slate[4]];
  const glass = c.material({ ramp: glassR, flat: true, lo: 0, hi: 5, dither: 0.3 });
  c.box(0, 0, W, H, { mat: ink, z: 0, round: 0 });
  const p = c.newPart();
  c.box(0.5, 0.5, W - 1, 3, { mat: steel, z: 1, bevel: 0.8, part: p });
  c.box(0.5, H - 3.5, W - 1, 3, { mat: steel, z: 1, bevel: 0.8, part: p });
  c.box(0.5, 0.5, 3, H - 1, { mat: steel, z: 1, bevel: 0.8, part: p });
  c.box(W - 3.5, 0.5, 3, H - 1, { mat: steel, z: 1, bevel: 0.8, part: p });
  for (const [x, y] of [
    [2, 2],
    [W - 2, 2],
    [2, H - 2],
    [W - 2, H - 2],
  ] as const) c.ellipsoid(x, y, 0.8, 0.8, { mat: bolt, z: 1.5, round: 0.8 });
  c.box(4, 4, W - 8, H - 8, {
    mat: glass,
    z: 0.1,
    round: 0,
    tex: (s) => {
      // Navy at the top to slate at the bottom; two diagonal glints across the upper left.
      s.tone += -0.45 + s.v * 0.75;
      const g = s.x - 4 + (s.y - 4) * 1.0;
      if ((g > 7 && g < 8.2) || (g > 10 && g < 10.6)) s.tone += s.y < 26 ? 0.45 * (1 - (s.y - 4) / 22) : 0;
    },
  });
  return c.render({ outline: 'none', ao: 0.4, sep: false, shadow: 0.35, shadowMax: 2 });
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
  defineSprite('ui/mil/frame', () => [frame()], { ...TL, hd: (d) => [frameHd(d)] });
  defineSprite('ui/mil/shutter', shutterFrames, { ...TL, ticksPerFrame: 2, loop: false, hd: (d) => shutterFramesHd(d) });
  defineSprite('ui/mil/hazard', () => [hazard()], { ...TL, hd: (d) => [hazardHd(d)] });
  defineSprite('ui/mil/badge-off', () => [badge('off')], { ...TL, hd: (d) => [badgeHd('off', d)] });
  defineSprite('ui/mil/badge-p1', () => [badge('p1')], { ...TL, hd: (d) => [badgeHd('p1', d)] });
  defineSprite('ui/mil/badge-p2', () => [badge('p2')], { ...TL, hd: (d) => [badgeHd('p2', d)] });
  defineSprite('ui/mil/plate', () => [plate()], { ...TL, hd: (d) => [plateHd(d)] });
  defineSprite('ui/mil/preview', () => [preview()], { ...TL, hd: (d) => [previewHd(d)] });
  defineSprite('ui/mil/emblem', () => [emblem()], { ...TL, hd: (d) => [emblemHd(d)] });
  for (const t of STENCIL_TITLES) defineSprite(stencilId(t), () => [stencilTitle(t)], { ...TL, hd: (d) => [stencilTitleHd(t, false, d)] });
  for (const t of STENCIL_GOLD) defineSprite(stencilId(t), () => [stencilTitle(t, true)], { ...TL, hd: (d) => [stencilTitleHd(t, true, d)] });
}
