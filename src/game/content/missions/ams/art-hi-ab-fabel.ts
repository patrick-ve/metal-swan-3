/**
 * Mission `ams` 2× FABEL FRIET (docs/ART_GUIDE.md "2x art (mission ams)"): the twins of art.ts
 * `fabelFriet` (`decor/ams/fabel-friet-<light>`), `neighbour` (`neighbour-<light>`), `fabelSign`
 * (`fabel-sign`) and `fabelCounter` (`fabel-counter`). The same shopfront, sign and footprint on
 * the 2× grid: our own `Fabel` script with a smooth slant and crisp curves (no traced logo), spaced
 * FRIET capitals, brick with 1-px joints, sash windows with glazing bars, fine dentils and
 * mouldings, leaded glass with 1-px lead lines, the wrought-iron bracket as 1-px scrolls.
 */
import type { Color } from '../../../../engine/color';
import { getFont } from '../../../../engine/font';
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { hash2 } from '../../../art/paint';
import { applyLight, FABEL_SCRIPT, type Light } from './art';
import { Q, textHi } from './art-hi-ab-kit';
import { brickHi, sashWindowHi } from './art-hi-ab-houses';

/** Width of a small-font capital (for the spaced lettering). */
function capW(ch: string): number {
  return getFont('small').glyph(ch.charCodeAt(0)).w;
}

/** Spaced capitals (art.ts `spaced`), each letter with crisp 2× edges. */
function spacedHi(q: Q, text: string, cx: number, y: number, c: Color, gap: number): void {
  let total = 0;
  for (const ch of text) total += capW(ch) + gap;
  total -= gap;
  let x = Math.round(cx - total / 2);
  for (const ch of text) {
    textHi(q, ch, x, y, { color: c });
    x += capW(ch) + gap;
  }
}

/** The script mask at 2×: EPX-rounded strokes, slanted by a smooth per-2×-row shift. */
let scriptMask: { w: number; h: number; m: Uint8Array } | null = null;
function fabelMask(): { w: number; h: number; m: Uint8Array } {
  if (scriptMask) return scriptMask;
  const rows = FABEL_SCRIPT.length;
  const cols = FABEL_SCRIPT[0].length;
  const at = (c: number, r: number): number => (r >= 0 && r < rows && c >= 0 && c < cols && FABEL_SCRIPT[r][c] === '#' ? 1 : 0);
  const maxShift = 2 * Math.floor((rows - 1) / 3);
  const W = cols * 2 + maxShift + 2;
  const H = rows * 2;
  const m = new Uint8Array(W * H);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const P = at(c, r);
      const A = at(c, r - 1);
      const B = at(c + 1, r);
      const C = at(c - 1, r);
      const D = at(c, r + 1);
      const sub = [
        C === A && C !== D && A !== B ? A : P,
        A === B && A !== C && B !== D ? B : P,
        D === C && D !== B && C !== A ? C : P,
        B === D && B !== A && D !== C ? D : P,
      ];
      for (let k = 0; k < 4; k++) {
        if (!sub[k]) continue;
        const Y = r * 2 + (k >> 1);
        const shift = Math.round(((H - 1 - Y) / (H - 1)) * maxShift);
        m[Y * W + c * 2 + (k & 1) + shift] = 1;
      }
    }
  }
  scriptMask = { w: W, h: H, m };
  return scriptMask;
}

/** art.ts `fabelScript` on the 2× grid: the drop shadow (1 logical px down-right), the word, the swash. */
function fabelScriptHi(q: Q, x: number, y: number, c: Color, shadow: Color): void {
  const { w, h, m } = fabelMask();
  const X0 = q.X(x);
  const Y0 = q.Y(y);
  for (const pass of [0, 1]) {
    const o = pass === 0 ? 2 : 0;
    for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) if (m[Y * w + X]) q.b.set(X0 + X + o, Y0 + Y + o, pass === 0 ? shadow : c);
  }
  // A swash under the word: a fine flourish that thickens in the middle.
  const sw = c === PAL.gold[2] ? PAL.gold[1] : c;
  const yy = y + FABEL_SCRIPT.length + 1;
  q.fineRow(x + 6, x + 24, yy, sw);
  q.fineRow(x + 9, x + 21, yy + 0.5, sw);
  q.dot(x + 24.5, yy - 0.5, sw).dot(x + 25, yy - 1, sw);
}

/** FABEL FRIET, 96 wide (the 1× recipe on the 2× grid; see the file comment). */
export function fabelFrietHi(light: Light): Frame {
  const W = 98;
  const H = 150;
  const q = new Q(W, H);
  const base = H - 1;
  const shopTop = base - 46;
  const red = [PAL.red[0], PAL.red[0], PAL.red[1], PAL.red[2]];
  q.each(1, 12, W - 2, shopTop - 1, (X, Y) => q.b.set(X, Y, brickHi(X, Y, H * 2 - 1, red, 77)));
  q.vline(1, 12, shopTop, PAL.red[2]);
  for (const fy of [22, 56]) {
    for (const wx of fy === 56 ? [10, 42] : [10, 42, 74]) {
      // Stone lintel with a keystone, the window, a lit sill.
      q.hline(wx - 2, wx + 13, fy - 2, PAL.snow[2]);
      q.fineRow(wx - 2, wx + 13, fy - 2, PAL.snow[3]);
      q.rect(wx - 1, fy - 1, 14, 2, PAL.snow[1]);
      q.fineRow(wx - 1, wx + 12, fy - 0.5, PAL.stone[3]);
      q.rect(wx + 5, fy - 3, 2, 3, PAL.snow[3]);
      q.fineCol(wx + 6.5, fy - 3, fy - 1, PAL.snow[1]);
      sashWindowHi(q, wx, fy, 12, 22, true, false);
      q.hline(wx - 1, wx + 12, fy + 22, PAL.stone[3]);
      q.fineRow(wx - 1, wx + 12, fy + 22.5, PAL.stone[2]);
    }
  }
  // Cornice on top: a lit edge, a moulding, dentils and the shadow; the raised centre.
  q.rect(1, 6, W - 2, 6, PAL.snow[2]);
  q.hline(1, W - 2, 6, PAL.snow[3]);
  q.fineRow(1, W - 2, 7.5, PAL.snow[1]);
  for (let x = 3; x < W - 2; x += 3) {
    q.dot(x, 10, PAL.snow[1]).dot(x + 0.5, 10, PAL.stone[3]).dot(x, 9.5, PAL.snow[1]).dot(x + 0.5, 9.5, PAL.snow[1]);
    q.dot(x - 0.5, 9.5, PAL.snow[3]);
  }
  q.hline(1, W - 2, 11, PAL.stone[2]);
  q.fineRow(1, W - 2, 11.5, PAL.stone[1]);
  q.rect(30, 1, 38, 5, PAL.snow[2]);
  q.hline(30, 67, 1, PAL.snow[3]);
  q.fineRow(30, 67, 2, PAL.snow[3]);
  q.fineCol(67.5, 1, 5, PAL.snow[1]);
  // --- the cream wooden shopfront ---
  const cream = PAL.sand[3];
  q.rect(1, shopTop, W - 2, base - shopTop + 1, cream);
  q.rect(0, shopTop, W, 7, PAL.snow[3]);
  q.hline(0, W - 1, shopTop + 2, PAL.sand[3]);
  q.fineRow(0, W - 1, shopTop + 1.5, PAL.snow[2]);
  for (let x = 2; x < W - 1; x += 3) {
    q.dot(x, shopTop + 4, PAL.sand[2]).dot(x + 0.5, shopTop + 4, PAL.sand[1]).dot(x, shopTop + 4.5, PAL.sand[2]).dot(x + 0.5, shopTop + 4.5, PAL.sand[1]);
  }
  q.fineRow(0, W - 1, shopTop + 5.5, PAL.sand[3]);
  q.hline(0, W - 1, shopTop + 6, PAL.sand[1]);
  q.hline(1, W - 2, shopTop + 7, PAL.sand[2]);
  q.fineRow(1, W - 2, shopTop + 7.5, PAL.sand[1]);
  // Pilasters with a fluting line and a capital.
  for (const px of [1, 56, W - 4]) {
    q.rect(px, shopTop + 8, 3, base - shopTop - 8, PAL.snow[3]);
    q.vline(px + 2, shopTop + 8, base, PAL.sand[2]);
    q.fineCol(px + 1, shopTop + 10, base - 2, PAL.snow[2]);
    q.fineRow(px, px + 2, shopTop + 9, PAL.sand[3]);
  }
  // Display window.
  const wx0 = 5;
  const wx1 = 54;
  const wy0 = shopTop + 10;
  const wy1 = base - 6;
  q.rect(wx0 - 1, wy0 - 1, wx1 - wx0 + 3, wy1 - wy0 + 3, PAL.snow[3]);
  q.rect(wx0, wy0, wx1 - wx0 + 1, wy1 - wy0 + 1, PAL.navy[0]);
  for (let x = wx0; x <= wx1; x += 7) q.fine(x, wy0, x + 6.5, wy0 + 8.5, PAL.navy[1]);
  q.fineCol(wx0, wy0, wy1, PAL.ink[1]);
  q.fineRow(wx0, wx1, wy0, PAL.ink[1]);
  fabelScriptHi(q, wx0 + 9, wy0 + 2, PAL.gold[2], PAL.gold[0]);
  spacedHi(q, 'FRIET', (wx0 + wx1) / 2 + 1, wy0 + 13, PAL.gold[2], 3);
  // Potatoes: round tubers on the 2× grid, lit top-left, with eyes.
  for (let y = wy1 - 6; y <= wy1; y++) {
    for (let x = wx0; x <= wx1; x++) {
      const k = hash2(x >> 1, y >> 1, 9);
      const top = y === wy1 - 6 && k < 0.5;
      if (top) continue;
      q.set(x, y, k > 0.8 ? PAL.sand[2] : k > 0.35 ? PAL.brown[3] : k > 0.12 ? PAL.sand[1] : PAL.brown[2]);
    }
  }
  // One tuber per 1× tone block (2 × 2 logical px): a lit top-left px on the light tubers, a
  // shaded bottom-right px, an eye on a few.
  for (let ty = (wy1 - 6) & ~1; ty <= wy1; ty += 2) {
    for (let tx = wx0 & ~1; tx <= wx1 - 1; tx += 2) {
      const k = hash2(tx >> 1, ty >> 1, 9);
      if (ty < wy1 - 6 || tx < wx0 || (ty === wy1 - 6 && k < 0.5)) continue;
      if (k > 0.35) q.dot(tx, ty, PAL.sand[3]);
      q.dot(tx + 1.5, ty + 1.5, PAL.brown[1]);
      if (hash2(tx, ty, 10) > 0.9) q.dot(tx + 1, ty + 0.5, PAL.brown[1]);
    }
  }
  q.hline(wx0, wx1, wy1 + 1, PAL.snow[3]);
  // Panelled stall riser: raised panels with a lit and a shaded edge.
  for (let x = wx0; x < wx1; x += 12) {
    q.strokeRect(x + 1, wy1 + 2, 10, base - wy1 - 3, PAL.sand[2]);
    q.fineRow(x + 2, x + 9, wy1 + 3, PAL.snow[3]);
    q.fineCol(x + 2, wy1 + 3, base - 3, PAL.snow[3]);
  }
  // The open door: dark brick inside, a fryer glint, the white door leaf.
  const dx0 = 61;
  const dx1 = 79;
  const dy0 = shopTop + 10;
  q.rect(dx0 - 1, dy0 - 1, dx1 - dx0 + 3, base - dy0 + 2, PAL.snow[3]);
  q.each(dx0, dy0, dx1, base, (X, Y, lx, ly) => {
    const row2 = Y - dy0 * 2;
    const joint = row2 % 8 === 7 || (X + ((row2 >> 3) % 2) * 6) % 12 === 0;
    q.b.set(X, Y, joint ? PAL.ink[1] : ly - dy0 < 10 ? PAL.brown[0] : PAL.rust[0]);
    void lx;
  });
  q.rect(dx0, dy0, dx1 - dx0 + 1, 4, PAL.ink[1]);
  q.rect(dx0 + 2, dy0 + 6, 6, 3, PAL.steel[1]);
  q.hline(dx0 + 2, dx0 + 7, dy0 + 6, PAL.steel[3]);
  q.fineRow(dx0 + 2, dx0 + 7, dy0 + 7, PAL.steel[2]);
  q.dot(dx0 + 3, dy0 + 8, PAL.gold[2]).dot(dx0 + 3.5, dy0 + 8, PAL.gold[3]).dot(dx0 + 5, dy0 + 8, PAL.gold[2]);
  q.rect(dx1 + 1, dy0, 5, base - dy0 + 1, PAL.snow[3]);
  q.rect(dx1 + 2, dy0 + 2, 3, 14, PAL.sky[1]);
  q.set(dx1 + 2, dy0 + 2, PAL.sky[3]);
  q.fine(dx1 + 2, dy0 + 6, dx1 + 4.5, dy0 + 3.5, PAL.sky[2]);
  q.fineRow(dx1 + 2, dx1 + 4, dy0 + 9, PAL.snow[3]);
  q.rect(dx1 + 2, dy0 + 19, 3, base - dy0 - 21, PAL.sand[3]);
  q.vline(dx1 + 4, dy0 + 19, base - 2, PAL.sand[2]);
  q.fineRow(dx1 + 2, dx1 + 4, dy0 + 19, PAL.snow[3]);
  q.fineRow(dx1 + 2, dx1 + 4, Math.round((dy0 + 19 + base - 2) / 2), PAL.sand[2]);
  q.vline(dx1 + 5, dy0, base, PAL.stone[2]);
  q.dot(dx1 + 1.5, dy0 + 18, PAL.gold[3]).dot(dx1 + 1.5, dy0 + 18.5, PAL.gold[1]);
  // Transom with the house number (two gold numerals on a 1-px line).
  q.rect(dx0, shopTop + 8, dx1 - dx0 + 1, 1, PAL.sand[2]);
  q.dot(dx0 + 9, shopTop + 8, PAL.gold[1]).dot(dx0 + 9, shopTop + 8.5, PAL.gold[1]).dot(dx0 + 10, shopTop + 8, PAL.gold[1]).dot(dx0 + 10.5, shopTop + 8, PAL.gold[1]).dot(dx0 + 10, shopTop + 8.5, PAL.gold[1]);
  // Step.
  q.rect(dx0 - 2, base - 1, dx1 - dx0 + 5, 2, PAL.stone[2]);
  q.hline(dx0 - 2, dx1 + 2, base - 1, PAL.stone[3]);
  q.fineRow(dx0 - 2, dx1 + 2, base - 0.5, PAL.snow[1]);
  // The wrought-iron bracket: 2-px bars, fine scrolls.
  const by = shopTop - 42;
  q.rect(94, by - 3, 2, 8, PAL.ink[1]);
  q.hline(76, 95, by, PAL.ink[1]);
  q.line(80, by + 1, 94, by + 10, PAL.ink[1]);
  q.circle(90, by + 4, 2, PAL.ink[1], false);
  q.circle(82, by + 3, 1, PAL.ink[1], false);
  q.circle(77, by - 2, 1, PAL.ink[1], false);
  q.dot(94, by - 3, PAL.steel[0]).dot(94, by - 2.5, PAL.steel[0]);
  q.dot(89.5, by + 3.5, PAL.ink[1]).dot(76.5, by - 1.5, PAL.ink[1]);
  q.outline();
  applyLight(q.b, light);
  return q.frame(49, H);
}

/** The oval hanging sign (4 frames, a slow swing): gold rim with a fine inner line, script, FRIET. */
export function fabelSignHi(): Frame[] {
  const out: Frame[] = [];
  for (const swing of [0, 1, 0, -1]) {
    const q = new Q(42, 36);
    const cx = 20 + swing;
    q.vline(20, 1, 4, PAL.ink[1]);
    q.dot(20.5, 1, PAL.steel[0]);
    // Chains: fine links.
    q.fine(20, 4, cx - 8, 8, PAL.ink[1]);
    q.fine(20.5, 4, cx - 7.5, 8, PAL.ink[1]);
    q.fine(20.5, 4, cx + 8, 8, PAL.ink[1]);
    q.fine(21, 4, cx + 8.5, 8, PAL.ink[1]);
    q.ellipse(cx - 18, 7, 37, 28, PAL.gold[1]);
    q.ellipse(cx - 17, 8, 35, 26, PAL.ink[0]);
    q.ellipseFine(cx - 16, 9, 33, 24, PAL.gold[0]);
    // The rim's lit top-left arc.
    q.b.ellipse(q.X(cx - 18), q.Y(7), 74, 56, PAL.gold[2], false);
    q.each(cx - 18, 7, cx + 18, 34, (X, Y) => {
      if (q.b.get(X, Y) !== PAL.gold[2]) return;
      if (X - q.X(cx - 18) > 37 + (Y - q.Y(7)) * 0.4) q.b.set(X, Y, PAL.gold[1]);
    });
    fabelScriptHi(q, cx - 13, 11, PAL.gold[2], PAL.gold[0]);
    spacedHi(q, 'FRIET', cx + 1, 22, PAL.gold[2], 1);
    q.outline();
    out.push(q.frame(20, 1));
  }
  return out;
}

/** The small counter: panelled front, a paper cone of fries and a mayonnaise pot on top. */
export function fabelCounterHi(): Frame {
  const q = new Q(30, 18);
  q.rect(1, 2, 28, 15, PAL.sand[3]);
  q.rect(0, 1, 30, 3, PAL.snow[3]);
  q.hline(0, 29, 3, PAL.sand[2]);
  q.fineRow(0, 29, 3.5, PAL.sand[1]);
  q.strokeRect(4, 6, 22, 8, PAL.sand[2]);
  q.fineRow(5, 24, 7, PAL.snow[3]);
  q.fineCol(5, 7, 12, PAL.snow[3]);
  q.fineCol(28.5, 4, 16, PAL.sand[2]);
  // Fries in a paper cone: a white cone with gold fries poking out.
  q.tri(20, 1, 26, 1, 23, 0, PAL.snow[3]);
  q.rect(21, 0, 4, 1, PAL.gold[2]);
  q.dot(21.5, -0.5 + 0.5, PAL.gold[3]).dot(23, 0, PAL.gold[3]).dot(24, 0, PAL.gold[1]);
  q.set(8, 0, PAL.snow[3]);
  q.set(9, 0, PAL.snow[3]);
  q.dot(9.5, 0.5, PAL.snow[1]);
  q.outline();
  return q.feet();
}

/** The neighbour: orange-brown wooden shop with leaded glass, brick above (the 1× recipe at 2×). */
export function neighbourHi(light: Light): Frame {
  const W = 66;
  const H = 132;
  const q = new Q(W, H);
  const base = H - 1;
  const shopTop = base - 44;
  const brown = [PAL.brown[0], PAL.brown[0], PAL.brown[2], PAL.brown[3]];
  q.each(1, 14, W - 2, shopTop - 1, (X, Y) => q.b.set(X, Y, brickHi(X, Y, H * 2 - 1, brown, 5)));
  for (const fy of [24, 58]) {
    for (const wx of [8, 37]) {
      sashWindowHi(q, wx, fy, 20, 22, true, false);
      q.hline(wx - 1, wx + 20, fy + 22, PAL.stone[3]);
      q.fineRow(wx - 1, wx + 20, fy - 0.5, PAL.snow[2]);
    }
  }
  q.rect(1, 8, W - 2, 6, PAL.snow[2]);
  q.hline(1, W - 2, 8, PAL.snow[3]);
  q.fineRow(1, W - 2, 13.5, PAL.stone[3]);
  for (let x = 3; x < W - 2; x += 3) q.dot(x, 11.5, PAL.snow[1]).dot(x + 0.5, 11.5, PAL.stone[3]);
  q.tri(20, 8, 46, 8, 33, 1, PAL.snow[2]);
  q.fine(20.5, 7.5, 33, 1.5, PAL.snow[3]);
  q.circle(33, 6, 2, PAL.navy[1]);
  q.ellipseFine(31, 4, 5, 5, PAL.snow[3]);
  q.dot(32, 5, PAL.sky[1]);
  // Orange-brown wood shopfront.
  q.rect(1, shopTop, W - 2, base - shopTop + 1, PAL.orange[0]);
  q.rect(0, shopTop, W, 5, PAL.rust[1]);
  q.hline(0, W - 1, shopTop, PAL.orange[2]);
  q.fineRow(0, W - 1, shopTop + 2, PAL.rust[2]);
  q.hline(0, W - 1, shopTop + 4, PAL.brown[1]);
  for (const px of [1, 40, W - 4]) {
    q.rect(px, shopTop + 5, 3, base - shopTop - 5, PAL.rust[1]);
    q.fineCol(px, shopTop + 5, base, PAL.rust[2]);
    q.fineCol(px + 2.5, shopTop + 5, base, PAL.brown[1]);
  }
  // Leaded glass: diamond panes with 1-px lead lines in the transom.
  q.each(5, shopTop + 7, 38, shopTop + 14, (X, Y) => {
    const lead = (X + Y) % 8 === 0 || (X - Y + 512) % 8 === 0;
    q.b.set(X, Y, lead ? PAL.ink[1] : (Math.floor((X + Y) / 8) + Math.floor((X - Y + 512) / 8)) % 2 === 0 ? PAL.gold[3] : PAL.sky[2]);
  });
  q.fineRow(5, 38, shopTop + 14.5, PAL.ink[1]);
  q.rect(5, shopTop + 16, 34, 20, PAL.navy[1]);
  for (let x = 6; x < 38; x += 6) q.fine(x, shopTop + 16, x + 5.5, shopTop + 24.5, PAL.sky[0]);
  q.fineCol(22, shopTop + 16, shopTop + 35.5, PAL.rust[1]);
  q.rect(5, base - 7, 34, 6, PAL.rust[1]);
  q.fineRow(5, 38, base - 7, PAL.rust[2]);
  q.strokeRect(7, base - 6, 14, 4, PAL.brown[1]);
  q.strokeRect(23, base - 6, 14, 4, PAL.brown[1]);
  // The door: a glazed upper part with leaded bars.
  q.rect(45, shopTop + 7, 16, base - shopTop - 7, PAL.rust[1]);
  q.fineCol(45, shopTop + 7, base, PAL.rust[2]);
  q.rect(47, shopTop + 9, 12, 14, PAL.sky[1]);
  for (let y = shopTop + 9; y < shopTop + 23; y += 3) q.fineRow(47, 58, y + 0.5, PAL.ink[1]);
  q.fineCol(53, shopTop + 9, shopTop + 22, PAL.ink[1]);
  q.fineCol(50, shopTop + 9, shopTop + 22, PAL.ink[1]);
  q.fineCol(56, shopTop + 9, shopTop + 22, PAL.ink[1]);
  q.dot(47.5, shopTop + 10, PAL.sky[3]).dot(48, shopTop + 10, PAL.sky[3]);
  q.strokeRect(47, shopTop + 25, 12, base - shopTop - 28, PAL.brown[1]);
  q.dot(58.5, shopTop + 26, PAL.gold[3]);
  q.outline();
  applyLight(q.b, light);
  return q.feet();
}
