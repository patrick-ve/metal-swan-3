/**
 * 2× decor of mission ams sections c (AMSTEL) and d (STOPERA) (docs/ART_GUIDE.md "2x art (mission
 * ams)"): the Stopera, the Waterlooplein market stalls, the white Amstel bridge and its portal,
 * the Blauwbrug (its lamps and the brick arch face), the Amstel houseboats and the canal houses in
 * the golden and the sunset light. Each generator follows its 1× recipe in art.ts call by call on
 * the 2× grid (`Pen2`): the same design, footprint and anchor, a 2-px INK outline (the 1× weight),
 * and the finer detail the 2× grid can show (1-px mortar joints, window frames and glazing bars,
 * marble veins, plank seams, fluting, rivets). Palette only, light from the top-left.
 *
 * Only ams draws these frames (`MissionDef.artDensity`); the 1× frames in art.ts stay as they are.
 */
import type { Color } from '../../../../engine/color';
import { measure } from '../../../../engine/font';
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineHiSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import { feet2, Pen2 } from './art-hi-cd-pen';
import './art-hi-cd-breakables';

type Ramp = readonly Color[];

const D = 'decor/ams/';

/** A wooden plank board with a lit top edge (art.ts `board`), with 1-px plank seams. */
function board2(p: Pen2, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.brown): void {
  p.rect(x, y, w, h, ramp[2]);
  p.fineH(x, x + w - 0.5, y, ramp[3]);
  p.fineH(x, x + w - 0.5, y + h - 0.5, ramp[1]);
  p.fineV(x + w - 0.5, y, y + h - 0.5, ramp[1]);
  // Grain: short dark streaks.
  for (let k = 0; k < w / 6; k++) {
    const gx = x + 1 + ((k * 6 + (k * 7) % 4) % Math.max(1, w - 4));
    const gy = y + 0.5 + ((k * 3) % Math.max(1, (h - 1) * 2)) / 2;
    if (gy < y + h - 0.5) p.fineH(gx, gx + 2, gy, ramp[1]);
  }
}

/** A vertical post (art.ts `post`): lit left side, a 1-px highlight, shaded right side. */
function post2(p: Pen2, x: number, y0: number, y1: number, w: number, ramp: Ramp): void {
  p.rect(x, y0, w, y1 - y0 + 1, ramp[1]);
  p.vline(x, y0, y1, ramp[2]);
  p.fineV(x, y0, y1 + 0.5, ramp[3] ?? ramp[2]);
  if (w > 2) p.vline(x + w - 1, y0, y1, ramp[0]);
  else p.fineV(x + w - 0.5, y0, y1 + 0.5, ramp[0]);
}

// =============================================================================================
// The Stopera (section d)
// =============================================================================================

function stopera2(): Frame {
  const W = 384;
  const H = 168;
  const p = new Pen2(W + 2, H + 1);
  const base = H;
  const B = 2 * (base + 1) - 1; // last 2× row
  // --- the music theatre: the curved front, white marble bands and glass ---
  const tx1 = 230;
  for (let X = 2; X < tx1 * 2; X++) {
    const lx = X / 2;
    const x = X >> 1;
    const t = (x - 1) / (tx1 - 2);
    // The curve on the 2× grid (the 1× top at the logical column, refined by half a pixel).
    const t2 = (lx - 0.75) / (tx1 - 2);
    const top1 = 30 + Math.round(Math.pow(t - 0.45, 2) * 70);
    const top = Math.max(top1 * 2, Math.min(top1 * 2 + 1, Math.round((30 + Math.pow(t2 - 0.45, 2) * 70) * 2)));
    const dark = t > 0.8;
    for (let Y = top; Y <= B; Y++) {
      const row = Y - top;
      const band = row % 52;
      let c: Color;
      if (band < 18) {
        // Marble: a lit edge, the slab with fine grey veins, the 1× grey shadow under the ledge
        // (2 logical rows) with a 1-px soft step above it.
        if (band === 0) c = PAL.snow[3];
        else if (band >= 14) c = PAL.snow[0];
        else if (band === 13) c = PAL.snow[1];
        else if (dark) c = band < 2 ? PAL.snow[2] : PAL.snow[1];
        else {
          // Slab joints every 22 px, veins in the stone.
          const slab = (X + ((row / 52) | 0) * 11) % 22;
          const vein = hash2(X >> 2, (Y >> 1) + ((X * 3) >> 3), 51) > 0.96;
          c = slab === 0 ? PAL.snow[1] : vein ? PAL.snow[1] : band < 2 ? PAL.snow[3] : PAL.snow[2];
        }
      } else {
        // Glass: dusk-purple panes, 1-px mullions and a transom bar, a lit top edge on each pane,
        // a thin warm sunset streak across a few panes.
        const m = X % 24;
        const g = band - 18;
        const streak = !dark && (((X >> 1) + row) % 72 < 5) && (((X + row) & 1) === 0 || ((X >> 1) + row) % 72 < 4);
        if (m === 0) c = PAL.stone[1];
        else if (m === 1) c = PAL.stone[2];
        else if (g <= 1) c = PAL.purple[0];
        else if (g === 16 || g === 17) c = g === 16 ? PAL.stone[2] : PAL.stone[1];
        else if (streak) c = PAL.pink[1];
        else if (dark) c = g === 2 || g === 18 ? PAL.purple[1] : PAL.purple[0];
        else c = g < 12 ? PAL.purple[2] : PAL.purple[1];
        if (!dark && m === 2 && g > 2 && g < 16 && g % 4 === 0) c = PAL.purple[1];
      }
      p.put(X, Y, c);
    }
  }
  // The roof edge and the fly tower behind (ribbed white cladding).
  p.rect(60, 10, 90, 22, PAL.snow[1]);
  p.hline(60, 149, 10, PAL.snow[2]);
  p.fineH(60, 149.5, 10, PAL.snow[3]);
  for (let x = 64; x < 146; x += 8) {
    p.fineV(x, 11, 30.5, PAL.snow[0]);
    p.fineV(x + 0.5, 11, 30.5, PAL.snow[2]);
  }
  p.fineH(60, 149.5, 31.5, PAL.snow[0]);
  // --- the city hall wing: red brick with white bands, a flat roof ---
  const hx0 = tx1;
  p.each(hx0, 22, W, base, (X, Y) => {
    // Bricks: 6 rows high with a 1-px bed joint, 12 px long with a 1-px head joint (stretcher bond).
    const r2 = B - Y;
    const course = (r2 / 6) | 0;
    const inB = r2 % 6;
    const head = (X + course * 6) % 12;
    const brickId = hash2(((X + course * 6) / 12) | 0, course, 41);
    let c: Color = inB === 0 || head === 0 ? PAL.red[0] : brickId > 0.95 ? PAL.red[2] : PAL.red[1];
    // A lit top edge on some bricks.
    if (c === PAL.red[1] && inB === 5 && head > 0 && head < 11 && brickId > 0.82) c = PAL.red[2];
    const by = (Y >> 1) - 22;
    const bm = by % 30;
    if (bm < 4) {
      const sub = Y - (22 + by - bm) * 2;
      c = sub === 0 ? PAL.snow[3] : sub >= 7 ? PAL.snow[1] : PAL.snow[2];
    }
    p.put(X, Y, c);
  });
  p.vline(hx0, 22, base, PAL.ink[1]);
  // Windows in the hall wing: a steel frame, two sashes, a glint and a stone sill.
  for (let y = 30; y < base - 60; y += 30) {
    for (let x = hx0 + 8; x < W - 8; x += 18) {
      p.rect(x, y, 12, 16, PAL.navy[1]);
      p.strokeRect(x, y, 12, 16, PAL.navy[0]);
      p.fineH(x, x + 11.5, y, PAL.steel[1]);
      p.fineV(x, y, y + 15.5, PAL.steel[1]);
      p.fineV(x + 6, y + 0.5, y + 15, PAL.steel[2]);
      p.hline(x, x + 11, y + 8, PAL.steel[2]);
      p.fineH(x, x + 11.5, y + 8, PAL.steel[3]);
      p.set(x + 1, y + 1, PAL.sky[2]);
      p.dot(x + 2, y + 1, PAL.sky[1]);
      p.fine(x + 3, y + 6.5, x + 5.5, y + 2, PAL.sky[0]);
      p.fine(x + 8, y + 15, x + 11, y + 10, PAL.sky[0]);
      p.fineH(x - 0.5, x + 12, y + 16, PAL.stone[3]);
    }
  }
  // The big glass doors (centre 294) under a white canopy.
  const dx = 294;
  p.rect(dx - 46, base - 106, 92, 5, PAL.snow[3]);
  p.fineH(dx - 46, dx + 45.5, base - 103, PAL.snow[2]);
  p.fineH(dx - 46, dx + 45.5, base - 102.5, PAL.snow[1]);
  p.hline(dx - 46, dx + 45, base - 102, PAL.steel[3]);
  p.rect(dx - 40, base - 100, 80, 100, PAL.steel[1]);
  p.fineH(dx - 40, dx + 39.5, base - 100, PAL.steel[2]);
  p.fineV(dx - 40, base - 100, base + 0.5, PAL.steel[2]);
  p.each(dx - 38, base - 98, dx + 37, base, (X, Y, lx, ly) => {
    const m = X - (dx - 40) * 2;
    const mm = m % 40;
    let c: Color = ly < base - 70 ? PAL.sky[0] : PAL.navy[1];
    if (mm === 0) c = PAL.steel[3];
    else if (mm === 1) c = PAL.steel[2];
    else if (ly >= base - 70 && ly < base - 69.5) c = PAL.steel[2];
    else if (ly < base - 70 && ((X - Y * 0.5) | 0) % 48 < 2 && mm > 4) c = PAL.sky[1];
    else if (ly >= base - 69 && ((X + Y) % 64) < 2 && mm > 4) c = PAL.navy[2];
    void lx;
    p.put(X, Y, c);
  });
  p.vline(dx, base - 98, base, PAL.steel[3]);
  p.fineV(dx + 0.5, base - 98, base + 0.5, PAL.steel[2]);
  // Push bars and handles.
  for (const s of [-1, 1]) {
    p.fineH(dx + s * 2 - (s < 0 ? 12 : 0), dx + s * 2 + (s > 0 ? 12 : 0), base - 46, PAL.steel[3]);
    p.dot(dx + s * 3, base - 50, PAL.gold[3]);
    p.dot(dx + s * 3, base - 49.5, PAL.gold[2]);
  }
  p.set(dx - 3, base - 50, PAL.gold[3]);
  p.set(dx + 3, base - 50, PAL.gold[3]);
  // Our own STADHUIS lettering on its dark plaque (the doubled 1× letters: they read as at 1×).
  const tw = measure('STADHUIS');
  p.rect(dx - (tw >> 1) - 4, base - 120, tw + 8, 12, PAL.steel[1]);
  p.fineH(dx - (tw >> 1) - 4, dx - (tw >> 1) + tw + 3.5, base - 120, PAL.steel[2]);
  p.fineV(dx - (tw >> 1) - 4, base - 120, base - 108.5, PAL.steel[2]);
  p.rect(dx - (tw >> 1) - 3, base - 119, tw + 6, 10, PAL.ink[1]);
  p.fineH(dx - (tw >> 1) - 3, dx - (tw >> 1) + tw + 2.5, base - 119, PAL.ink[0]);
  for (const sx of [dx - (tw >> 1) - 3, dx - (tw >> 1) + tw + 2]) p.dot(sx + 0.5, base - 114, PAL.steel[2]);
  p.text('STADHUIS', dx, base - 117, { font: 'small', color: PAL.snow[3], align: 'center' }, PAL.ink[0]);
  // Steps: two treads with lit nosings.
  p.rect(dx - 52, base - 3, 104, 4, PAL.stone[3]);
  p.hline(dx - 52, dx + 51, base - 3, PAL.snow[2]);
  p.fineH(dx - 52, dx + 51.5, base - 3, PAL.snow[3]);
  p.fineH(dx - 52, dx + 51.5, base - 1, PAL.snow[1]);
  p.fineH(dx - 52, dx + 51.5, base - 0.5, PAL.stone[2]);
  p.fineH(dx - 52, dx + 51.5, base - 2.5, PAL.stone[2]);
  p.outline();
  return p.frame(1, H + 1);
}

// =============================================================================================
// Waterlooplein flea-market stalls (decor, frames 0–2)
// =============================================================================================

const STALL_SETS: readonly (readonly [Color, Color, Color])[] = [
  [PAL.red[2], PAL.snow[3], PAL.sky[1]],
  [PAL.green[2], PAL.snow[3], PAL.gold[2]],
  [PAL.sky[0], PAL.gold[3], PAL.pink[2]],
];

/** The shade of an awning stripe colour (its fold side). */
function foldOf(c: Color): Color {
  if (c === PAL.red[2]) return PAL.red[1];
  if (c === PAL.green[2]) return PAL.green[1];
  if (c === PAL.sky[0]) return PAL.navy[1];
  if (c === PAL.gold[3]) return PAL.gold[2];
  if (c === PAL.snow[3]) return PAL.snow[1];
  return c;
}

/** Striped awning on the 2× grid: stripes `sw` px wide, a fold shadow, a scalloped lower edge. */
function awning2(p: Pen2, x0: number, x1: number, y0: number, y1: number, sw: number, a: Color, c: Color, scallop: boolean): void {
  p.each(x0, y0, x1, y1 + 1, (X, Y, lx, ly) => {
    const sx = Math.floor(lx / sw) % 2 === 0 ? a : c;
    const inStripe = lx - Math.floor(lx / sw) * sw; // 0 … sw − 0.5
    // Scallops: each stripe ends in a round tongue below y1.
    if (ly > y1 + 0.5 - 1e-9 || (ly > y1 - 1 && scallop)) {
      if (!scallop) return;
      const u = (inStripe + 0.25 - sw / 2) / (sw / 2);
      const depth = 1.5 * Math.sqrt(Math.max(0, 1 - u * u));
      if (ly - (y1 - 1) > depth) return;
    }
    let col: Color = sx;
    if (inStripe >= sw - 1) col = foldOf(sx);
    if (ly < y0 + 1.5) col = ly < y0 + 0.5 ? PAL.snow[3] : sx;
    p.put(X, Y, col);
  });
}

function marketStall2(): Frame[] {
  return STALL_SETS.map(([a, c, goods], i) => {
    const p = new Pen2(58, 46);
    for (const x of [3, 53]) post2(p, x, 8, 45, 2, PAL.steel);
    // The awning: stripes 6 px with a fold shadow; the 1× zigzag hem as rounded scallops.
    awning2(p, 1, 56, 4, 11, 6, a, c, true);
    p.hline(1, 56, 4, PAL.snow[3]);
    p.fineH(1, 56.5, 4.5, PAL.snow[2]);
    board2(p, 2, 28, 54, 4, PAL.brown);
    p.rect(4, 32, 50, 13, PAL.brown[1]);
    // The table front: panels and a dark gap underneath.
    for (let x = 4; x < 54; x += 10) p.fineV(x + 9.5, 32, 44.5, PAL.brown[0]);
    p.fineH(4, 53.5, 32, PAL.brown[0]);
    p.fineH(4, 53.5, 44.5, PAL.brown[0]);
    // Goods: clothes on a rail, records in crates, lamps and vases.
    if (i === 0) {
      for (let x = 8; x < 50; x += 6) {
        const col = x % 12 === 8 ? goods : PAL.pink[1];
        const sh = col === goods ? PAL.sky[0] : PAL.pink[0];
        p.rect(x, 16, 5, 10, col);
        p.rect(x + 0.5, 15, 4, 1, col);
        p.fineV(x + 4.5, 16, 25.5, sh);
        p.fineV(x + 2, 17, 25.5, sh);
        p.dot(x + 1, 16, PAL.snow[3]);
        p.fine(x + 2, 14, x + 2.5, 15, PAL.steel[3]); // hanger hook
      }
    }
    if (i === 1) {
      for (let x = 6; x < 52; x += 4) {
        const rec = x % 8 === 6;
        p.rect(x, 22, 3, 6, rec ? PAL.ink[1] : goods);
        p.fineV(x, 22, 27.5, rec ? PAL.steel[1] : PAL.gold[3]);
        p.fineV(x + 2.5, 22, 27.5, rec ? PAL.ink[0] : PAL.gold[1]);
        if (rec) p.dot(x + 1.5, 24, PAL.red[2]);
      }
    }
    if (i === 2) {
      for (let x = 8; x < 50; x += 9) {
        p.ellipse(x, 18, 6, 10, goods);
        p.ellipse(x + 3, 18.5, 3, 9, PAL.pink[1]);
        p.ellipse(x, 18, 6, 10, goods, false);
        p.rect(x + 2, 17, 2, 1, PAL.pink[1]);
        p.fineH(x + 1.5, x + 4, 17, PAL.pink[0]);
        p.set(x + 2, 19, PAL.snow[3]);
        p.dot(x + 1.5, 20.5, PAL.snow[2]);
      }
    }
    p.hline(5, 52, 15, PAL.steel[2]);
    p.fineH(5, 52.5, 15, PAL.steel[3]);
    p.outline();
    return feet2(p);
  });
}

defineHiSprite(`${D}stopera`, stopera2);
defineHiSprite(`${D}market-stall`, marketStall2);

// =============================================================================================
// The white Amstel bridge, its portal and the Blauwbrug (section c)
// =============================================================================================

const WHITE: Ramp = [PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];

/** A railway-style bolt head: a lit 2× pixel over a shaded one. */
function bolt(p: Pen2, x: number, y: number): void {
  p.dot(x, y, PAL.snow[3]);
  p.dot(x + 0.5, y + 0.5, PAL.snow[0]);
}

/** One 128-px span of the white wooden Amstel bridge (art.ts `whiteBridge`). */
function whiteBridge2(): Frame {
  const W = 130;
  const H = 72;
  const p = new Pen2(W, H);
  const deck = 28;
  // Piers into the water: painted planks with 1-px seams, a lit left edge, a shaded right one.
  for (const x of [2, 66]) {
    p.rect(x, deck + 4, 6, H - deck - 5, PAL.snow[2]);
    p.vline(x, deck + 4, H - 2, PAL.snow[3]);
    p.vline(x + 5, deck + 4, H - 2, PAL.steel[3]);
    p.fineV(x + 2.5, deck + 4, H - 1.5, PAL.snow[1]);
    p.fineV(x + 4.5, deck + 4, H - 1.5, PAL.snow[1]);
    // A tide line near the water and a bolted collar under the deck.
    p.fineH(x + 0.5, x + 5, H - 9, PAL.snow[1]);
    p.fineH(x + 0.5, x + 5, H - 8.5, PAL.teal[2]);
    for (const by of [deck + 6, deck + 20]) bolt(p, x + 2, by);
  }
  // The soffit arcs between the piers: a lit lower edge, a shaded band under the deck.
  for (let X = 16; X < 256; X++) {
    const lx = X / 2;
    const t = ((lx - 8) % 64) / 58;
    if (t > 1 || lx < 8) continue;
    const t1 = (((X >> 1) - 8) % 64) / 58;
    const y1 = deck + 4 + Math.round(Math.sin(t1 * Math.PI) * 10);
    const y = Math.max(y1 * 2, Math.min(y1 * 2 + 1, Math.round((deck + 4 + Math.sin(t * Math.PI) * 10) * 2 + 1)));
    for (let Y = (deck + 4) * 2; Y <= y; Y++) p.put(X, Y, Y < (deck + 5) * 2 ? PAL.snow[0] : PAL.snow[1]);
    p.put(X, y, PAL.snow[3]);
    if (y - 1 >= (deck + 5) * 2) p.put(X, y - 1, PAL.snow[2]);
  }
  // Railing: the top rail (lit), a handrail shadow, the kick rail along the deck.
  for (let x = 1; x < W - 1; x++) {
    p.set(x, deck - 14, PAL.snow[3]);
    p.set(x, deck - 13, PAL.snow[1]);
    p.set(x, deck - 1, PAL.snow[1]);
  }
  p.fineH(1, W - 1.5, deck - 13.5, PAL.snow[0]);
  p.fineH(1, W - 1.5, deck - 1, PAL.snow[2]);
  p.fineH(1, W - 1.5, deck - 0.5, PAL.snow[0]);
  for (let x = 1; x < W - 1; x += 16) {
    // Cross bracing (behind the posts), each brace with a lit upper edge.
    p.line(x + 3, deck - 12, x + 15, deck - 2, PAL.snow[2]);
    p.line(x + 3, deck - 2, x + 15, deck - 12, PAL.snow[2]);
    p.fine(x + 3, deck - 12.5, x + 15, deck - 2.5, PAL.snow[3]);
    p.fine(x + 3.5, deck - 2.5, x + 15, deck - 12.5, PAL.snow[3]);
    p.dot(x + 9, deck - 7, PAL.snow[0]);
    // Post with a cap and two bolts.
    p.rect(x, deck - 16, 3, 16, PAL.snow[2]);
    p.vline(x, deck - 16, deck - 1, PAL.snow[3]);
    p.fineV(x + 2.5, deck - 16, deck - 0.5, PAL.snow[1]);
    p.fineH(x, x + 2.5, deck - 16, PAL.snow[3]);
    p.fineH(x, x + 2.5, deck - 15.5, PAL.snow[1]);
    bolt(p, x + 1, deck - 11);
    bolt(p, x + 1, deck - 4);
  }
  // The bridge lights: bulbs along the rail, each with a white glint.
  for (let x = 9; x < W; x += 16) {
    p.set(x, deck - 15, PAL.gold[3]);
    p.dot(x, deck - 15, PAL.snow[3]);
    p.dot(x + 0.5, deck - 14.5, PAL.gold[2]);
  }
  p.outline();
  return p.frame(1, deck);
}

/** The overhead balance beams of the white bridge (art.ts `whitePortal`). */
function whitePortal2(): Frame {
  const W = 72;
  const H = 120;
  const p = new Pen2(W, H);
  post2(p, 6, 24, H - 1, 4, WHITE);
  post2(p, 62, 24, H - 1, 4, WHITE);
  for (const x of [6, 62]) {
    p.fineV(x + 2, 26, H - 1.5, PAL.snow[1]);
    for (let y = 30; y < H - 4; y += 18) bolt(p, x + 1, y);
  }
  // The cross beam with its lit top and a shaded underside.
  p.rect(2, 20, 68, 5, PAL.snow[2]);
  p.hline(2, 69, 20, PAL.snow[3]);
  p.fineH(2, 69.5, 21, PAL.snow[2]);
  p.fineH(2, 69.5, 24.5, PAL.snow[0]);
  for (let x = 8; x < 68; x += 10) bolt(p, x, 22.5);
  // Braces down to the middle.
  p.line(10, 25, 36, 50, PAL.snow[2]);
  p.line(62, 25, 36, 50, PAL.snow[2]);
  p.fine(10.5, 24.5, 36, 49.5, PAL.snow[3]);
  p.fine(61.5, 24.5, 36.5, 49.5, PAL.snow[3]);
  p.set(36, 50, PAL.snow[1]);
  bolt(p, 36, 50);
  // The balance beam on top with its row of lights.
  p.thick(4, 12, 68, 12, 3, PAL.snow[2]);
  p.hline(4, 68, 11, PAL.snow[3]);
  p.fineH(4.5, 68, 13.5, PAL.snow[1]);
  p.fineH(5, 67.5, 14, PAL.snow[0]);
  for (let x = 6; x < 68; x += 8) {
    p.set(x, 10, PAL.gold[3]);
    p.dot(x, 10, PAL.snow[3]);
    p.dot(x + 0.5, 10.5, PAL.gold[2]);
  }
  p.outline();
  return feet2(p);
}

/** A Blauwbrug lamp (art.ts `blauwbrugLamp`): stone base, fluted post, lantern, gold crown. */
function blauwbrugLamp2(): Frame {
  const p = new Pen2(22, 86);
  // The stone base: dressed blocks with 1-px joints, a moulded cap, the blue enamel plaque.
  p.rect(4, 66, 14, 19, PAL.stone[2]);
  p.vline(4, 66, 84, PAL.stone[3]);
  p.fineV(17.5, 66, 84.5, PAL.stone[1]);
  p.fineH(4.5, 17.5, 79, PAL.stone[1]);
  p.fineH(4.5, 17, 79.5, PAL.stone[3]);
  p.rect(3, 64, 16, 3, PAL.stone[3]);
  p.fineH(3, 18.5, 64, PAL.snow[2]);
  p.fineH(3, 18.5, 66.5, PAL.stone[1]);
  p.rect(6, 70, 10, 8, PAL.sky[0]);
  p.strokeRect(6, 70, 10, 8, PAL.navy[1]);
  p.fineH(6, 15.5, 70, PAL.snow[2]);
  p.fineV(6, 70, 77.5, PAL.snow[2]);
  p.set(7, 71, PAL.sky[1]);
  p.dot(7, 71, PAL.sky[2]);
  // A little white crown emblem on the plaque.
  p.fineH(9.5, 12.5, 74.5, PAL.snow[3]);
  for (const x of [9.5, 11, 12.5]) p.dot(x, 73.5, PAL.snow[3]);
  p.dot(11, 73, PAL.snow[3]);
  // The fluted post: 1-px flutes, a lit left edge.
  post2(p, 9, 24, 63, 4, PAL.steel);
  p.fineV(10.5, 25, 62.5, PAL.steel[1]);
  p.fineV(11.5, 25, 62.5, PAL.steel[1]);
  p.fineV(11, 25, 62.5, PAL.steel[3]);
  for (const y of [40, 52]) {
    p.rect(8.5, y, 5, 1, PAL.gold[1]);
    p.fineH(8.5, 13, y, PAL.gold[2]);
  }
  p.rect(6, 22, 10, 3, PAL.gold[1]);
  p.fineH(6, 15.5, 22, PAL.gold[3]);
  p.fineH(6, 15.5, 24.5, PAL.gold[0]);
  // Lantern: glowing panes, a dark mullion, a top band.
  p.poly([[5, 10], [16, 10], [14, 21], [7, 21]], PAL.gold[3]);
  p.poly([[11, 11], [15, 11], [13.5, 20.5], [11, 20.5]], PAL.gold[2]);
  p.fineV(6.5, 11, 13, PAL.snow[3]);
  p.dot(7, 11, PAL.snow[3]);
  p.vline(10, 10, 21, PAL.ink[1]);
  p.fineH(7, 14, 15.5, PAL.gold[1]);
  p.hline(4, 17, 9, PAL.ink[1]);
  p.fineH(4, 17.5, 9, PAL.steel[1]);
  p.fineH(7, 14.5, 21.5, PAL.ink[1]);
  // The crown: a gold band with jewels and points.
  p.rect(6, 4, 10, 5, PAL.gold[2]);
  p.fineH(6, 15.5, 4, PAL.gold[3]);
  p.fineH(6, 15.5, 8.5, PAL.gold[1]);
  p.fineV(15.5, 4, 8.5, PAL.gold[1]);
  for (const x of [6, 9, 12, 15]) {
    p.set(x, 3, PAL.gold[3]);
    p.dot(x + 0.5, 3.5, PAL.gold[2]);
  }
  p.set(8, 5, PAL.red[2]);
  p.dot(8, 5, PAL.red[3]);
  p.set(13, 5, PAL.sky[0]);
  p.dot(13, 5, PAL.sky[2]);
  p.dot(10.5, 6, PAL.snow[3]);
  p.set(10, 1, PAL.gold[3]);
  p.set(10, 2, PAL.gold[2]);
  p.dot(10.5, 1.5, PAL.gold[2]);
  p.outline();
  return feet2(p);
}

/** The deck line of `ground().hill(len, h)` (art.ts `hillY`), relative to the start. */
function hillY(x: number, len: number, h: number, steps = 8): number {
  const seg = len / steps;
  const i = Math.max(0, Math.min(steps - 1, Math.floor(x / seg)));
  const y = (k: number): number => (k === 0 || k === steps ? 0 : -(h * (1 - Math.cos((k / steps) * Math.PI * 2))) / 2);
  const t = (x - i * seg) / seg;
  return y(i) + (y(i + 1) - y(i)) * Math.max(0, Math.min(1, t));
}

/**
 * The brick arch face of a canal bridge (art.ts `bridgeFaceSprite`, front decor, no outline):
 * 1-px joints, a stone coping, voussoirs round the arch, ripples on the dark canal under it.
 */
function bridgeFace2(len: number, h: number): Frame {
  const top = h + 2;
  const H = top + 40;
  const p = new Pen2(len, H);
  const cx = len / 2;
  const ar = len * 0.3;
  const archH = H - top - 12;
  for (let X = 0; X < len * 2; X++) {
    const x = X >> 1;
    const d1 = top + Math.round(hillY(x, len, h)) + 2;
    for (let Y = d1 * 2; Y < H * 2; Y++) {
      const y = Y >> 1;
      const row2 = Y - d1 * 2;
      // Bricks 8 × 4 logical (16 × 8 2×) in stretcher bond with 1-px joints.
      const course = Y >> 3;
      const head = (X + (course % 2) * 8) % 16;
      const id = hash2((X + (course % 2) * 8) >> 4, course, 6);
      let c: Color = (Y & 7) === 7 || head === 0 ? PAL.rust[0] : id > 0.86 ? PAL.rust[2] : PAL.rust[1];
      if (c === PAL.rust[1] && (Y & 7) === 0 && id > 0.5) c = PAL.rust[2];
      // The coping: a lit nosing and a shaded underside.
      if (row2 < 4) c = row2 === 0 ? PAL.snow[2] : row2 === 3 ? PAL.stone[1] : row2 === 1 ? PAL.stone[3] : PAL.stone[2];
      // The arch: voussoirs, then the dark water under it.
      const dx = (X / 2 + 0.25 - cx) / ar;
      const arch = Math.sqrt(Math.max(0, 1 - dx * dx));
      const archTop = H - 2 - arch * archH;
      if (Math.abs(dx) < 1 && y >= Math.floor(archTop) - 3 && Y / 2 >= archTop - 3) {
        const into = Y / 2 - archTop;
        if (into < 0) {
          // The ring of voussoirs over the opening (radial joints).
          const ang = Math.atan2((H - 2 - Y / 2) / archH, dx);
          const k = Math.floor((ang / Math.PI) * 22);
          const joint = Math.abs((ang / Math.PI) * 22 - Math.round((ang / Math.PI) * 22)) < 0.06;
          c = joint ? PAL.stone[1] : into > -0.6 ? PAL.stone[1] : k % 2 === 0 ? PAL.stone[3] : PAL.stone[2];
          if (into < -2.6) c = PAL.rust[0];
        } else if (into < 2) {
          c = into < 1 ? PAL.snow[2] : PAL.snow[1];
          if (into < 0.5 && dx < 0) c = PAL.snow[3];
        } else if (y >= H - 8) {
          // Ripples: short lit dashes on the dark canal, denser near the surface.
          const wr = Y - (H - 8) * 2;
          const r = (X + wr * 13 + ((wr * 7) % 5) * 3) % (wr < 4 ? 12 : 20);
          c = wr === 0 ? PAL.teal[1] : r < 3 ? (wr < 6 ? PAL.teal[2] : PAL.teal[1]) : PAL.teal[0];
        } else c = into < 4 ? PAL.ink[0] : PAL.ink[1];
      }
      p.put(X, Y, c);
    }
  }
  return p.frame(0, top);
}

defineHiSprite(`${D}white-bridge`, whiteBridge2);
defineHiSprite(`${D}white-portal`, whitePortal2);
defineHiSprite(`${D}blauwbrug-lamp`, blauwbrugLamp2);
/** The Blauwbrug face of section c (C_BLAUWBRUG: 200 long, 16 high). */
defineHiSprite(`${D}bridge-face-200x16`, () => bridgeFace2(200, 16));
