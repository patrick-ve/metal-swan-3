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
 * - `ui/mil/stencil-<slug>`  stencil lettering for the menu titles (STENCIL_TITLES, bone paint;
 *                       STENCIL_GOLD, gold paint: `PRESS START`; slug = the text in lower case
 *                       with '-' for spaces), the big font at scale 2
 */
import type { Color } from '../../../engine/color';
import { drawText, getFont, layoutText, measureText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { Rng } from '../../../engine/rng';
import { defineSprite } from '../../../engine/sprites';

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

export function defineMilitaryArt(): void {
  defineSprite('ui/mil/frame', () => [frame()], TL);
  defineSprite('ui/mil/shutter', shutterFrames, { ...TL, ticksPerFrame: 2, loop: false });
  defineSprite('ui/mil/hazard', () => [hazard()], TL);
  defineSprite('ui/mil/badge-off', () => [badge('off')], TL);
  defineSprite('ui/mil/badge-p1', () => [badge('p1')], TL);
  defineSprite('ui/mil/badge-p2', () => [badge('p2')], TL);
  defineSprite('ui/mil/plate', () => [plate()], TL);
  defineSprite('ui/mil/preview', () => [preview()], TL);
  defineSprite('ui/mil/emblem', () => [emblem()], TL);
  for (const t of STENCIL_TITLES) defineSprite(stencilId(t), () => [stencilTitle(t)], TL);
  for (const t of STENCIL_GOLD) defineSprite(stencilId(t), () => [stencilTitle(t, true)], TL);
}
