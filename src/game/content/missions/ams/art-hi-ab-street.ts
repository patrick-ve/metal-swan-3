/**
 * Mission `ams` 2× street decor (docs/ART_GUIDE.md "2x art (mission ams)"): the twins of the art.ts
 * street furniture (lamp, bollard, bikes and the bike rack, bench, elm, tulips, flags, awnings,
 * chimney smoke, the stone balustrade), the section b hot-dog stand set (stand, front, roof flag,
 * electrical cabinet, grey lamp) and the npc.art.ts breakables of sections a and b (bike rack,
 * tulip stall, herring cart). Each follows its 1× recipe on the 2× grid (`Q`): the same design,
 * footprint and anchor, the 2-px INK outline, and the finer detail of the 2× grid (spokes, chains,
 * leaves, petals, lettering edges, rivets). Palette only, light from the top-left.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { hash2 } from '../../../art/paint';
import { AWNING_SETS, BIKE_COLOURS, TULIPS } from './art';
import { Q, textHi } from './art-hi-ab-kit';
import { fillHoles, openSilhouette } from './art-hi-canopy';

type Ramp = readonly Color[];

// =============================================================================================
// Shared painters
// =============================================================================================

/** art.ts `board` on the 2× grid: a lit top edge, a shadow line and 1-px grain. */
export function boardHi(q: Q, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.brown): void {
  q.rect(x, y, w, h, ramp[2]);
  q.hline(x, x + w - 1, y, ramp[3]);
  q.hline(x, x + w - 1, y + h - 1, ramp[1]);
  q.vline(x + w - 1, y, y + h - 1, ramp[1]);
  if (h >= 3) {
    q.fineRow(x, x + w - 2, y + 0.5, ramp[2]);
    for (let k = x + 2; k < x + w - 4; k += 7) q.fine(k, y + 1.5, k + 2.5, y + 1.5, ramp[1]);
  }
}

/** art.ts `post` on the 2× grid: lit left side with a 1-px highlight, shaded right side. */
export function postHi(q: Q, x: number, y0: number, y1: number, w: number, ramp: Ramp): void {
  q.rect(x, y0, w, y1 - y0 + 1, ramp[1]);
  q.vline(x, y0, y1, ramp[2]);
  q.fineCol(x + 0.5, y0, y1, ramp[3] ?? ramp[2]);
  if (w > 2) q.vline(x + w - 1, y0, y1, ramp[0]);
  else q.fineCol(x + w - 0.5, y0, y1, ramp[0]);
}

/** art.ts `xxx` (three St Andrew's crosses stacked) with 1-px diagonal strokes 2 px wide. */
export function xxxHi(q: Q, cx: number, y: number, c: Color, gap = 4): void {
  for (let k = 0; k < 3; k++) {
    const yy = y + k * gap;
    q.fine(cx - 1, yy, cx + 1.5, yy + 2.5, c);
    q.fine(cx - 0.5, yy, cx + 1.5, yy + 2, c);
    q.fine(cx + 1.5, yy, cx - 1, yy + 2.5, c);
    q.fine(cx + 1, yy, cx - 1, yy + 2, c);
  }
}

/**
 * art.ts `drawBike` on the 2× grid: thin tyres with a fine rim and spokes, the step-through frame
 * as 2-px tubes, the rack, a saddle with a lit top, handlebars, a mudguard and the lamp.
 */
export function drawBikeHi(q: Q, x: number, y: number, frame: Color, flip = false): void {
  const fx = (dx: number): number => (flip ? x + 21 - dx : x + dx);
  // A fine position (half steps allowed), mirrored onto the matching 2× pixel.
  const fs = (dx: number): number => (flip ? x + 21.5 - dx : x + dx);
  for (const cx of [4, 17]) {
    q.circle(fx(cx), y - 5, 5, PAL.ink[1], false);
    q.ellipseFine(fx(cx) - 3.5, y - 8.5, 8, 8, PAL.steel[1]);
    // Spokes: fine lines through the hub.
    for (const [a, b] of [[-3, 0], [0, -3], [-2, -2], [2, -2]] as const) {
      q.fine(fs(cx + 0.5 + a), y - 4.5 + b, fs(cx + 0.5 - a), y - 4.5 - b, PAL.steel[2]);
    }
    q.dot(fs(cx), y - 5, PAL.steel[3]).dot(fs(cx + 0.5), y - 5, PAL.steel[3]).dot(fs(cx), y - 4.5, PAL.steel[2]).dot(fs(cx + 0.5), y - 4.5, PAL.steel[1]);
  }
  // Mudguards over the top of the wheels.
  q.fine(fs(1), y - 8.5, fs(3.5), y - 10, PAL.ink[0]);
  q.fine(fs(15), y - 10, fs(19.5), y - 9, PAL.ink[0]);
  // Frame.
  q.line(fx(4), y - 5, fx(9), y - 5, frame);
  q.line(fx(9), y - 5, fx(14), y - 11, frame);
  q.line(fx(8), y - 11, fx(9), y - 5, frame);
  q.line(fx(14), y - 11, fx(17), y - 5, frame);
  q.fine(fs(9), y - 5, fs(14), y - 11, PAL.snow[1] === frame ? PAL.snow[3] : lighter(frame));
  // Chain guard.
  q.fine(fs(5), y - 4.5, fs(9), y - 4.5, PAL.ink[0]);
  q.line(fx(4), y - 9, fx(8), y - 10, PAL.ink[1]); // rack
  q.fine(fs(4), y - 9.5, fs(8), y - 10.5, PAL.steel[2]);
  q.line(fx(3), y - 9, fx(4), y - 5, PAL.ink[1]);
  q.hline(Math.min(fx(6), fx(10)), Math.max(fx(6), fx(10)), y - 12, PAL.ink[0]); // saddle
  q.fineRow(Math.min(fx(6), fx(10)), Math.max(fx(6), fx(10)), y - 12, PAL.brown[1]);
  q.line(fx(14), y - 11, fx(14), y - 14, PAL.steel[3]); // stem
  q.line(fx(12), y - 14, fx(15), y - 14, PAL.steel[3]); // bars
  q.fineRow(Math.min(fx(12), fx(15)), Math.max(fx(12), fx(15)), y - 13.5, PAL.steel[1]);
  q.dot(fs(12), y - 14, PAL.ink[1]).dot(fs(12), y - 13.5, PAL.ink[1]); // grip
  q.set(fx(16), y - 11, PAL.gold[3]); // lamp
  q.dot(fs(16.5), y - 10.5, PAL.gold[1]);
}

/** The next lighter tone of a bike colour (for the 1-px tube highlight). */
function lighter(c: Color): Color {
  const ramps: readonly Ramp[] = [PAL.ink, PAL.red, PAL.sky, PAL.green, PAL.steel, PAL.pink, PAL.gold, PAL.black, PAL.teal];
  for (const r of ramps) {
    const i = r.indexOf(c);
    if (i >= 0 && i + 1 < r.length) return r[i + 1];
  }
  return c;
}

// =============================================================================================
// Street furniture
// =============================================================================================

/** The cast-iron street lamp: green post with a fine highlight, collar, base, glazed lantern. */
export function lampHi(): Frame {
  const q = new Q(16, 72);
  postHi(q, 6, 16, 70, 3, [PAL.green[0], PAL.ink[1], PAL.green[0], PAL.ink[0]]);
  q.fineCol(6.5, 18, 62, PAL.green[1]);
  q.rect(4, 64, 8, 7, PAL.ink[1]);
  q.hline(4, 11, 64, PAL.green[0]);
  q.fineRow(4, 11, 64, PAL.green[1]);
  q.fineCol(4.5, 65, 70, PAL.green[0]);
  q.fineRow(4, 11, 67, PAL.ink[0]);
  q.rect(5, 40, 6, 2, PAL.ink[1]);
  q.fineRow(5, 10, 40, PAL.green[1]);
  // Ring mouldings on the post.
  for (const y of [28, 52]) q.fineRow(6, 8, y, PAL.green[1]);
  // Lantern: four panes of warm glass with fine bars, a dark roof and a finial.
  q.poly([[3, 6], [12, 6], [11, 15], [4, 15]], PAL.gold[3]);
  q.vline(7, 6, 15, PAL.ink[1]);
  q.fine(4.5, 10.5, 11, 10.5, PAL.ink[1]);
  q.rect(5, 8, 2, 5, PAL.snow[3]);
  q.dot(9, 7, PAL.snow[3]).dot(9.5, 7, PAL.gold[3]).dot(9, 7.5, PAL.snow[3]);
  q.fine(11.5, 6.5, 10.5, 15, PAL.gold[1]);
  q.hline(2, 13, 5, PAL.ink[1]);
  q.tri(4, 4, 11, 4, 7, 0, PAL.ink[1]);
  q.fine(4.5, 4, 7, 0.5, PAL.steel[0]);
  q.hline(4, 11, 16, PAL.ink[1]);
  q.dot(7, 0, PAL.gold[2]).dot(7.5, 0, PAL.gold[1]);
  return q.outline().feet();
}

/** An Amsterdammertje: rust-brown with three white crosses, a round lit cap and a foot ring. */
export function bollardHi(): Frame {
  const q = new Q(9, 21);
  q.rect(2, 4, 5, 16, PAL.rust[1]);
  q.vline(2, 4, 19, PAL.rust[2]);
  q.fineCol(2.5, 5, 18, PAL.rust[3]);
  q.vline(6, 4, 19, PAL.brown[0]);
  q.fineCol(5.5, 4, 19, PAL.rust[0]);
  q.ellipse(1, 1, 7, 5, PAL.rust[1]);
  q.ellipse(1.5, 1.5, 5, 3, PAL.rust[2]);
  q.set(3, 2, PAL.rust[3]);
  q.dot(2.5, 2.5, PAL.rust[3]);
  q.fineRow(2, 6, 5.5, PAL.brown[0]);
  q.rect(1, 18, 7, 2, PAL.brown[0]);
  q.fineRow(1, 7, 18, PAL.rust[1]);
  xxxHi(q, 4, 7, PAL.snow[3], 4);
  return q.outline().feet();
}

export function bikeFramesHi(): Frame[] {
  return BIKE_COLOURS.map((c, i) => {
    const q = new Q(24, 17);
    drawBikeHi(q, 1, 16, c, i % 2 === 1);
    return q.outline().feet();
  });
}

export function bikeRackHi(): Frame {
  const q = new Q(68, 18);
  q.hline(2, 65, 12, PAL.steel[3]);
  q.fineRow(2, 65, 12.5, PAL.steel[1]);
  for (const x of [4, 22, 40, 58]) {
    q.vline(x, 12, 17, PAL.steel[2]);
    q.fineCol(x + 0.5, 13, 17, PAL.steel[1]);
  }
  for (let i = 0; i < 4; i++) drawBikeHi(q, 2 + i * 15, 17, BIKE_COLOURS[(i * 3) % BIKE_COLOURS.length], i % 2 === 1);
  return q.outline().feet();
}

export function benchHi(): Frame {
  const q = new Q(34, 16);
  boardHi(q, 1, 1, 32, 3, PAL.green);
  boardHi(q, 1, 6, 32, 3, PAL.green);
  boardHi(q, 1, 9, 32, 2, PAL.green);
  for (const x of [3, 29]) postHi(q, x, 4, 15, 2, PAL.steel);
  // Bolt heads on the slats.
  for (const x of [3, 29]) for (const y of [2, 7]) q.dot(x + 0.5, y, PAL.steel[3]);
  return q.outline().feet();
}

/** The elm: a tapered trunk with bark streaks and a canopy of leaf clusters on the 2× grid. */
export function elmHi(): Frame {
  const W = 104;
  const H = 136;
  const q = new Q(W, H);
  const b = q.b;
  q.taper(52, H - 1, 50, 60, 9, 5, PAL.brown[1]);
  q.vline(48, 64, H - 2, PAL.brown[2]);
  q.taper(50, 74, 30, 44, 4, 2, PAL.brown[1]);
  q.taper(52, 70, 76, 40, 4, 2, PAL.brown[1]);
  q.taper(51, 64, 52, 24, 4, 2, PAL.brown[1]);
  // Bark: fine furrows down the trunk and a lit left edge.
  for (let Y = 120; Y < H * 2 - 2; Y++) {
    for (let X = 92; X < 112; X++) {
      const c = b.get(X, Y);
      if (c !== PAL.brown[1]) continue;
      if ((X * 5 + ((Y / 7) | 0) * 3) % 9 === 0) b.set(X, Y, PAL.brown[0]);
    }
  }
  q.fineCol(48.5, 66, H - 3, PAL.brown[3]);
  const blobs: readonly (readonly [number, number, number])[] = [
    [28, 44, 20], [52, 30, 24], [76, 44, 20], [40, 62, 18], [66, 62, 18], [52, 50, 22], [18, 60, 13], [88, 60, 13], [52, 14, 14],
  ];
  for (const [x, y, r] of blobs) {
    for (let Y = (y - r) * 2; Y <= (y + r) * 2 + 1; Y++) {
      for (let X = (x - r) * 2; X <= (x + r) * 2 + 1; X++) {
        if (X < 0 || Y < 0 || X >= W * 2 || Y >= H * 2) continue;
        const dx = (X - 0.5) / 2 - x;
        const dy = (Y - 0.5) / 2 - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 0.25) continue;
        // A ragged edge of leaf clumps (logical-pixel clumps, as at 1×).
        if (d > r - 3 && hash2(X >> 2, Y >> 2, 3) < 0.45) continue;
        // Leaf texture: each 2 × 2 clump lit on its top-left pixel.
        const leaf = hash2(X >> 1, Y >> 1, 4);
        const lit = -dx - dy + (leaf - 0.5) * 10 + ((X & 1) === 0 && (Y & 1) === 0 ? 1.5 : 0);
        const c = lit > r * 0.7 ? PAL.green[4] : lit > 0 ? PAL.green[3] : lit > -r * 0.6 ? PAL.green[2] : PAL.green[1];
        b.set(X, Y, c);
      }
    }
  }
  // Gaps that show the branches: dark holes with a branch stub.
  for (let k = 0; k < 14; k++) {
    const x = 14 + Math.floor(hash2(k, 1, 8) * 76);
    const y = 18 + Math.floor(hash2(k, 2, 8) * 56);
    if ((q.get(x, y) & 255) !== 0) {
      q.set(x, y, PAL.green[0]);
      q.dot(x + 0.5, y + 0.5, PAL.brown[0]);
      q.dot(x - 0.5, y, PAL.green[0]);
    }
  }
  // Close the small holes of the ragged edge (dark leaves) and drop thin leaf strands and loose
  // clumps, so the outline is one closed ring round the canopy.
  fillHoles(b, PAL.green[1], 64);
  openSilhouette(b, 2);
  return q.outline().feet();
}

/** A planter of tulips (4 frames): cupped flowers with a lit petal, stems with leaves. */
export function tulipsHi(): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const q = new Q(30, 20);
    boardHi(q, 1, 12, 28, 7, PAL.brown);
    q.hline(1, 28, 12, PAL.brown[3]);
    for (let x = 4; x < 28; x += 6) q.fineCol(x, 13.5, 17.5, PAL.brown[1]);
    for (let i = 0; i < 8; i++) {
      const x = 3 + i * 3 + (i % 2);
      const sway = Math.round(Math.sin((f + i * 0.7) * (Math.PI / 2)) * 1);
      const top = 3 + (i % 3);
      q.line(x, 12, x + sway, top + 2, PAL.green[2]);
      q.fine(x + 0.5, 12, x + sway + 0.5, top + 2.5, PAL.green[3]);
      q.set(x - 1, 10, PAL.green[3]);
      q.dot(x - 1.5, 9.5, PAL.green[3]).dot(x - 0.5, 10.5, PAL.green[2]);
      const c = TULIPS[i % TULIPS.length];
      const dark = c === PAL.red[2] ? PAL.red[1] : c === PAL.pink[2] ? PAL.pink[1] : c === PAL.gold[2] ? PAL.gold[1] : c === PAL.red[3] ? PAL.red[2] : c === PAL.orange[2] ? PAL.orange[1] : PAL.pink[0];
      const tx = x + sway;
      // The cup: three petal tips on top, a shaded right side, a lit left petal.
      q.rect(tx - 1, top, 3, 3, c);
      q.dot(tx - 1, top - 1, c).dot(tx - 1, top - 0.5, c);
      q.dot(tx + 0.5, top - 1, c).dot(tx, top - 0.5, c).dot(tx + 0.5, top - 0.5, c);
      q.dot(tx + 1.5, top - 1, c).dot(tx + 1.5, top - 0.5, c);
      q.fineCol(tx + 1.5, top, top + 2.5, dark);
      q.fineRow(tx - 1, tx + 1, top + 2.5, dark);
      q.dot(tx - 1, top, PAL.snow[3]).dot(tx - 1, top + 0.5, PAL.snow[3]).dot(tx - 0.5, top, c);
      q.fineCol(tx + 0.5, top + 0.5, top + 2, dark);
    }
    return q.outline().feet();
  });
}

/** A flag on a pole (4 frames): the cloth waved per 2× column, folds shaded, a gold finial. */
export function flagHi(bands: readonly Color[], crosses: boolean): Frame[] {
  const shadeOf = (c: Color): Color => (c === PAL.snow[3] ? PAL.snow[1] : c === PAL.ink[1] ? PAL.ink[0] : c === PAL.red[2] ? PAL.red[1] : c === PAL.sky[0] ? PAL.navy[1] : c);
  return [0, 1, 2, 3].map((f) => {
    const W = 34;
    const H = 64;
    const q = new Q(W, H);
    const b = q.b;
    postHi(q, 1, 1, H - 1, 2, PAL.steel);
    q.set(1, 0, PAL.gold[2]);
    q.set(2, 0, PAL.gold[2]);
    q.dot(1, 0, PAL.gold[3]);
    const fw = 28;
    const fh = 21;
    const bandH = fh / bands.length;
    const wave = (t: number): number => Math.sin(t * Math.PI * 2 - f * (Math.PI / 2)) * 2 * t;
    for (let X = 6; X < (3 + fw) * 2; X++) {
      const t = (X - 6) / 2 / fw;
      const dy2 = Math.round(wave(t) * 2);
      const s = Math.sin(t * Math.PI * 2 - f * (Math.PI / 2) + 0.8);
      const shade = s > 0.55;
      // The fold edge: a 1-px darker line where the cloth turns into shadow.
      const edge = !shade && s > 0.5;
      for (let Y = 0; Y < fh * 2; Y++) {
        let c = bands[Math.min(bands.length - 1, Math.floor(Y / 2 / bandH))];
        if (shade || edge) c = shadeOf(c);
        b.set(X, 6 + Y + dy2, c);
      }
    }
    if (crosses) {
      for (const x of [7, 14, 21]) {
        const t = x / fw;
        const dy = Math.round(wave(t));
        const yc = 3 + Math.floor(fh / 2) + dy;
        for (let k = -2; k <= 2; k++) {
          q.set(3 + x + k, yc + k, PAL.snow[3]);
          q.set(3 + x + k, yc - k, PAL.snow[3]);
        }
        // Sharper arms: trim the stair corners on the 2× grid.
        for (let k = -2; k < 2; k++) {
          q.dot(3 + x + k + 1, yc + k, PAL.snow[3]);
          q.dot(3 + x + k + 0.5, yc - k - 0.5, PAL.snow[3]);
        }
      }
    }
    // The hoist: a 1-px rope line along the pole side.
    q.fineCol(3, 3, 3 + fh, PAL.stone[3]);
    return q.outline().frame(2, H);
  });
}

/** Striped awning (frames: colour sets): valance scallops, a lit top, fine seams, iron brackets. */
export function awningHi(w: number): Frame[] {
  return AWNING_SETS.map(([a, c]) => {
    const q = new Q(w + 2, 18);
    for (let x = 1; x <= w; x++) {
      const col = Math.floor((x - 1) / 6) % 2 === 0 ? a : c;
      q.vline(x, 1, 8, col);
      if ((x - 1) % 6 < 5) q.set(x, 9, col);
    }
    // Scalloped valance: round the lower corners of each tab.
    for (let x = 1; x <= w; x += 6) {
      q.dot(x, 9.5, 0);
      q.dot(Math.min(w, x + 4) + 0.5, 9.5, 0);
    }
    // Fold shadows: a fine line at the right of each stripe.
    for (let x = 6; x <= w; x += 6) q.fineCol(x + 0.5, 3, 7.5, Math.floor((x - 1) / 6) % 2 === 0 ? shadeAw(a) : shadeAw(c));
    q.hline(1, w, 1, PAL.snow[3]);
    q.hline(1, w, 2, a);
    q.fineRow(1, w, 2.5, shadeAw(a));
    q.hline(1, w, 8, PAL.ink[1]);
    q.fineRow(1, w, 8, shadeAw(a));
    q.line(3, 10, 8, 16, PAL.ink[1]);
    q.line(w - 2, 10, w - 7, 16, PAL.ink[1]);
    q.fine(3.5, 10, 8.5, 16, PAL.steel[1]);
    q.fine(w - 1.5, 10, w - 6.5, 16, PAL.steel[1]);
    return q.outline().frame(1, 1);
  });
}

function shadeAw(c: Color): Color {
  if (c === PAL.green[2]) return PAL.green[1];
  if (c === PAL.red[2]) return PAL.red[1];
  if (c === PAL.sky[0]) return PAL.navy[1];
  if (c === PAL.orange[1]) return PAL.orange[0];
  if (c === PAL.gold[3]) return PAL.gold[2];
  return PAL.snow[1];
}

/** Chimney smoke (6 frames): the same puffs, round on the 2× grid with a lit rim. */
export function smokeHi(): Frame[] {
  return [0, 1, 2, 3, 4, 5].map((f) => {
    const q = new Q(20, 40);
    for (let k = 0; k < 5; k++) {
      const t = ((k * 6 + f) % 30) / 30;
      const y = 38 - t * 34;
      const x = 8 + Math.sin(t * 5 + k) * 3 + t * 6;
      const r = 1 + Math.round(t * 3);
      const fill = t > 0.6 ? PAL.snow[1] : PAL.stone[3];
      q.circle(Math.round(x), Math.round(y), r, fill);
      q.set(Math.round(x) - 1, Math.round(y) - r + 1, PAL.snow[2]);
      q.dot(Math.round(x) - 0.5, Math.round(y) - r + 0.5, PAL.snow[3]);
    }
    return q.feet();
  });
}

/** Stone bridge balustrade: a coping with a lit top, turned balusters, the base rail. */
export function balustradeHi(w: number): Frame {
  const q = new Q(w + 2, 18);
  q.rect(1, 1, w, 3, PAL.stone[3]);
  q.fineRow(1, w, 1, PAL.snow[2]);
  q.hline(1, w, 3, PAL.stone[1]);
  for (let x = 3; x < w - 1; x += 5) {
    // A baluster: a slim neck, a round belly and a foot.
    q.rect(x, 5, 3, 10, PAL.stone[2]);
    q.dot(x, 5, 0).dot(x + 2.5, 5, 0).dot(x, 5.5, 0).dot(x + 2.5, 5.5, 0);
    q.dot(x, 13.5, 0).dot(x + 2.5, 13.5, 0);
    q.set(x, 7, PAL.stone[3]);
    q.fineCol(x + 0.5, 8, 11, PAL.stone[3]);
    q.set(x + 2, 11, PAL.stone[1]);
    q.fineCol(x + 2.5, 8, 12, PAL.stone[1]);
  }
  q.rect(1, 15, w, 3, PAL.stone[2]);
  q.fineRow(1, w, 15, PAL.stone[3]);
  q.fineRow(1, w, 17.5, PAL.stone[1]);
  return q.outline().feet();
}

// =============================================================================================
// Section b: the hot-dog stand set
// =============================================================================================

export function hotdogStandHi(): Frame {
  const W = 84;
  const H = 62;
  const q = new Q(W, H);
  const bx = 14;
  const bw = 64;
  const by = 12;
  const bh = 38;
  // Drawbar and jockey wheel.
  q.line(2, by + bh - 2, bx, by + bh - 6, PAL.steel[2]);
  q.line(2, by + bh - 1, bx, by + bh - 5, PAL.steel[1]);
  q.vline(5, by + bh - 1, H - 4, PAL.steel[2]);
  q.fineCol(5.5, by + bh - 1, H - 4, PAL.steel[1]);
  q.circle(5, H - 3, 2, PAL.ink[1]);
  q.dot(5, H - 3, PAL.steel[2]).dot(5.5, H - 3, PAL.steel[1]);
  // Box.
  q.roundRect(bx, by, bw, bh, 3, PAL.snow[3]);
  q.hline(bx + 2, bx + bw - 3, by + bh - 1, PAL.snow[1]);
  q.vline(bx + bw - 1, by + 3, by + bh - 1, PAL.snow[1]);
  q.fineCol(bx + bw - 1.5, by + 3, by + bh - 2, PAL.snow[2]);
  // US-flag print: diagonal stripes on the 2× grid.
  q.each(bx + 30, by + 2, bx + bw - 2, by + bh - 3, (X, Y) => {
    const x = X / 2;
    const y = Y / 2;
    if (x - bx + (by + bh - y) * 0.8 < 46) return;
    if (y >= by + bh - 13 && y < by + bh - 2 && x < bx + bw / 2 + 18) return;
    const k = Math.floor((x - bx + (y - by) * 1.2) / 4);
    if (k % 2 === 0) q.b.set(X, Y, PAL.red[2]);
  });
  // Blue field with five-point stars (a 2× star: a cross with a dot).
  q.rect(bx + 2, by + 2, 15, 12, PAL.sky[0]);
  q.hline(bx + 2, bx + 16, by + 2, PAL.sky[1]);
  for (let y = by + 4; y < by + 13; y += 3) {
    for (let x = bx + 4 + ((y >> 1) & 1); x < bx + 16; x += 3) {
      q.dot(x, y, PAL.snow[3]).dot(x + 0.5, y, PAL.snow[3]).dot(x, y + 0.5, PAL.snow[3]).dot(x + 0.5, y + 0.5, PAL.snow[3]);
      q.dot(x, y - 0.5, PAL.snow[3]).dot(x - 0.5, y + 0.5, PAL.snow[3]).dot(x + 1, y, PAL.snow[3]);
    }
  }
  // Hatch.
  const hx0 = bx + 20;
  const hx1 = bx + 44;
  const hy0 = by + 5;
  const hy1 = by + 21;
  q.rect(hx0 - 1, hy0 - 1, hx1 - hx0 + 3, hy1 - hy0 + 3, PAL.steel[3]);
  q.fineCol(hx0 - 1, hy0 - 1, hy1 + 1, PAL.snow[2]);
  q.rect(hx0, hy0, hx1 - hx0 + 1, hy1 - hy0 + 1, PAL.ink[1]);
  q.rect(hx0, hy0, hx1 - hx0 + 1, 2, PAL.ink[0]);
  // A steamer with a lid and a sausage pot, a menu card with lines.
  q.rect(hx0 + 2, hy0 + 3, 4, 3, PAL.steel[2]);
  q.fineRow(hx0 + 2, hx0 + 5, hy0 + 3, PAL.steel[3]);
  q.fineCol(hx0 + 5.5, hy0 + 3, hy0 + 5, PAL.steel[1]);
  q.dot(hx0 + 3.5, hy0 + 2.5, PAL.steel[3]);
  q.rect(hx1 - 7, hy0 + 2, 5, 2, PAL.gold[2]);
  q.fineRow(hx1 - 6.5, hx1 - 4, hy0 + 2.5, PAL.gold[0]);
  q.fineRow(hx1 - 6.5, hx1 - 5, hy0 + 3, PAL.gold[0]);
  // The flap propped open above.
  q.poly([[hx0 - 2, hy0 - 2], [hx1 + 2, hy0 - 2], [hx1 + 5, hy0 - 9], [hx0 + 1, hy0 - 9]], PAL.snow[2]);
  q.fine(hx0 + 1.5, hy0 - 8.5, hx1 + 4.5, hy0 - 8.5, PAL.snow[3]);
  q.line(hx0 - 2, hy0 - 2, hx1 + 2, hy0 - 2, PAL.snow[1]);
  q.line(hx1 + 2, hy0 - 2, hx1 + 4, hy0 - 8, PAL.steel[3]);
  q.fine(hx1 + 1.5, hy0 - 2, hx1 + 3.5, hy0 - 8, PAL.steel[1]);
  q.rect(hx0 - 1, hy1 + 1, hx1 - hx0 + 3, 2, PAL.steel[3]);
  q.hline(hx0 - 1, hx1 + 1, hy1 + 1, PAL.snow[3]);
  q.fineRow(hx0 - 1, hx1 + 1, hy1 + 2.5, PAL.steel[1]);
  // HOTDOGS in blue with a white edge, crisp on the 2× grid.
  textHi(q, 'HOTDOGS', bx + bw / 2 - 6, by + bh - 11, { color: PAL.sky[0], outline: PAL.snow[3], align: 'center' });
  // The painted hot dog: bun, sausage with a lit top, a mustard zigzag.
  const hx = bx + 46;
  const hy = by + 15;
  q.roundRect(hx, hy, 16, 6, 3, PAL.sand[2]);
  q.fineRow(hx + 2, hx + 13, hy, PAL.sand[3]);
  q.roundRect(hx + 1, hy + 1, 14, 3, 1, PAL.red[1]);
  q.fineRow(hx + 2, hx + 13, hy + 1, PAL.red[2]);
  for (let x = hx + 2; x < hx + 14; x += 1) q.dot(x + 0.5, hy + 1.5 + ((x & 1) === 0 ? 0 : 0.5), PAL.gold[2]);
  q.hline(hx + 1, hx + 14, hy + 5, PAL.sand[1]);
  // Wheels and the chassis.
  q.rect(bx + 4, by + bh, bw - 8, 2, PAL.ink[1]);
  for (const wx of [bx + 18, bx + 30]) {
    q.circle(wx, H - 6, 5, PAL.ink[1]);
    q.ellipseFine(wx - 3.5, H - 9.5, 8, 8, PAL.black[2]);
    q.circle(wx, H - 6, 2, PAL.steel[3]);
    q.dot(wx - 1, H - 7, PAL.snow[3]).dot(wx + 1.5, H - 5, PAL.steel[1]);
    for (const [dx, dy] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as const) q.dot(wx + 0.25 + dx, H - 5.75 + dy, PAL.steel[2]);
  }
  q.rect(bx + 10, by + bh, 30, 3, PAL.ink[1]);
  // Roof vent with louvres and the flag pole.
  q.rect(bx + 40, by - 3, 8, 3, PAL.steel[3]);
  for (let x = bx + 41; x < bx + 47; x++) q.dot(x + 0.5, by - 2, PAL.steel[1]);
  q.fineRow(bx + 40, bx + 47, by - 1.5, PAL.steel[2]);
  q.vline(bx + bw - 8, 0, by, PAL.steel[2]);
  q.fineCol(bx + bw - 7.5, 0, by, PAL.steel[1]);
  q.outline();
  return q.frame(bx, H);
}

/** `hotdog-front`: the box below the hatch counter (everything above logical row 34 cleared). */
export function hotdogFrontHi(): Frame {
  const f = hotdogStandHi();
  f.buf.rect(0, 0, f.buf.w, 34 * 2, 0);
  return f;
}

export function flagRedHi(): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const q = new Q(16, 10);
    for (let X = 2; X < 30; X++) {
      const x = X / 2;
      const dy = Math.round(Math.sin(((x + f * 3.5) / 14) * Math.PI * 2) * (x / 14) * 3) / 2;
      const c = x < 3 ? PAL.red[1] : (Math.floor(x) + f) % 7 === 0 ? PAL.red[3] : PAL.red[2];
      q.fineCol(x, 1 + dy, 6 + dy, c);
      q.dot(x, 6.5 + dy, c);
    }
    return q.outline().frame(0, 1);
  });
}

/** The grey electrical box: hinged doors, a vent, graffiti tags (our own squiggles) and stickers. */
export function cabinetHi(): Frame {
  const q = new Q(22, 30);
  q.rect(1, 3, 20, 26, PAL.stone[2]);
  q.rect(0, 1, 22, 3, PAL.stone[3]);
  q.fineRow(0, 21, 1, PAL.snow[1]);
  q.fineRow(0, 21, 3.5, PAL.stone[1]);
  q.vline(11, 4, 27, PAL.stone[1]);
  q.fineCol(11.5, 4, 27, PAL.stone[3]);
  q.vline(20, 3, 28, PAL.stone[1]);
  q.fineCol(1, 4, 27, PAL.stone[3]);
  // Vent slits and a lock.
  for (let y = 5; y < 8; y++) q.fineRow(14, 18, y + 0.5, PAL.stone[1]);
  q.dot(10, 15, PAL.steel[3]).dot(13, 15, PAL.steel[3]);
  // Graffiti tags: the same strokes as 2-px lines, a fine second pass for a lighter core.
  q.line(3, 9, 7, 6, PAL.pink[1]);
  q.line(7, 6, 8, 11, PAL.pink[1]);
  q.line(8, 11, 13, 7, PAL.pink[1]);
  q.line(13, 7, 17, 12, PAL.pink[2]);
  q.fine(3, 9, 7, 6, PAL.pink[2]);
  q.fine(8, 11, 13, 7, PAL.pink[2]);
  q.line(4, 18, 9, 15, PAL.ink[1]);
  q.line(9, 15, 10, 20, PAL.ink[1]);
  q.line(10, 20, 15, 16, PAL.ink[1]);
  q.circle(16, 21, 2, PAL.teal[2], false);
  q.dot(15.5, 20.5, PAL.teal[3]);
  // Stickers with tiny print.
  q.rect(3, 22, 4, 3, PAL.gold[3]);
  q.fineRow(3.5, 5.5, 23, PAL.gold[1]);
  q.fineRow(3.5, 5, 24, PAL.gold[1]);
  q.rect(13, 13, 3, 4, PAL.snow[3]);
  q.dot(13.5, 14, PAL.red[2]).dot(14, 14, PAL.red[2]).dot(14.5, 14, PAL.red[2]);
  q.fineRow(13.5, 15, 15.5, PAL.stone[2]);
  q.rect(1, 27, 20, 2, PAL.stone[1]);
  q.fineRow(1, 20, 27, PAL.stone[2]);
  return q.outline().feet();
}

export function lampGreyHi(): Frame {
  const q = new Q(16, 84);
  postHi(q, 7, 10, 82, 3, PAL.steel);
  q.rect(5, 78, 7, 5, PAL.steel[1]);
  q.fineRow(5, 11, 78, PAL.steel[2]);
  q.fineCol(5, 78, 82, PAL.steel[2]);
  q.line(8, 10, 13, 4, PAL.steel[2]);
  q.fine(8, 9.5, 12.5, 4, PAL.steel[3]);
  q.rect(10, 4, 5, 3, PAL.steel[3]);
  q.fineRow(10, 14, 4, PAL.snow[1]);
  q.hline(10, 14, 7, PAL.gold[3]);
  q.fineRow(10, 14, 7.5, PAL.gold[2]);
  return q.outline().feet();
}

// =============================================================================================
// Breakables of sections a and b (npc.art.ts `breakable`: frame 0 intact, 1 broken)
// =============================================================================================

function breakableHi(w: number, h: number, draw: (q: Q, broken: boolean) => void): () => Frame[] {
  return () =>
    [false, true].map((broken) => {
      const q = new Q(w + 2, h + 2);
      draw(q, broken);
      q.outline();
      return q.frame(Math.floor((w + 2) / 2), h + 1);
    });
}

function wheelHi(q: Q, x: number, y: number, r: number): void {
  q.circle(x, y, r, PAL.black[2]);
  q.circle(x, y, r - 1, PAL.stone[2], false);
  q.ellipseFine(x - r + 2, y - r + 2, (r - 2) * 2 + 1, (r - 2) * 2 + 1, PAL.black[1]);
  q.set(x, y, PAL.steel[3]);
  q.dot(x + 0.5, y + 0.5, PAL.steel[1]);
}

export const herringCartHi = breakableHi(48, 38, (q, broken) => {
  if (broken) {
    q.poly([[4, 37], [6, 22], [34, 18], [38, 33]], PAL.cloth[2]);
    q.line(6, 22, 34, 18, PAL.cloth[3]);
    q.poly([[5, 30], [36, 26], [37, 32], [5, 36]], PAL.sky[1]);
    textHi(q, 'HAR', 12, 28, { color: PAL.cloth[3] });
    q.rect(10, 22, 18, 4, PAL.navy[0]);
    q.fine(10, 22, 27.5, 22, PAL.navy[1]);
    for (let x = 30; x < 46; x += 6) q.rect(x, 34, 3, 3, PAL.cloth[3]);
    for (let x = 33; x < 46; x += 6) q.rect(x, 34, 3, 3, PAL.sky[1]);
    q.hline(30, 46, 33, PAL.sky[2]);
    q.line(36, 31, 46, 26, PAL.stone[3]);
    q.rect(43, 24, 3, 1, PAL.red[2]);
    q.rect(43, 25, 3, 1, PAL.cloth[3]);
    wheelHi(q, 42, 18 + 16, 3);
    for (const [x, y, c] of [[2, 34, PAL.steel[3]], [22, 35, PAL.snow[2]], [14, 17, PAL.steel[3]]] as const) fishHi(q, x, y, c);
    return;
  }
  q.rect(2, 4, 44, 4, PAL.sky[1]);
  for (let x = 2; x < 46; x += 6) q.rect(x, 7, 3, 3, PAL.cloth[3]);
  for (let x = 5; x < 46; x += 6) q.rect(x, 7, 3, 3, PAL.sky[1]);
  q.hline(2, 45, 4, PAL.sky[2]);
  q.fineRow(2, 45, 4, PAL.sky[3]);
  q.fineRow(2, 45, 6.5, PAL.sky[0]);
  q.vline(40, 0, 4, PAL.stone[3]);
  q.rect(41, 0, 5, 1, PAL.red[2]);
  q.rect(41, 1, 5, 1, PAL.cloth[3]);
  q.rect(41, 2, 5, 1, PAL.sky[1]);
  q.rect(4, 10, 40, 22, PAL.cloth[2]);
  q.hline(4, 43, 10, PAL.cloth[3]);
  q.rect(8, 11, 32, 7, PAL.navy[0]);
  q.fineRow(8, 39, 11, PAL.ink[1]);
  for (let i = 0; i < 5; i++) fishHi(q, 10 + i * 6, 15, i & 1 ? PAL.steel[3] : PAL.snow[2]);
  q.hline(6, 41, 18, PAL.stone[3]);
  q.fineRow(6, 41, 18.5, PAL.stone[2]);
  q.rect(4, 20, 40, 8, PAL.sky[1]);
  q.fineRow(4, 43, 20, PAL.sky[2]);
  q.fineRow(4, 43, 27.5, PAL.sky[0]);
  textHi(q, 'HARING', 24, 21, { color: PAL.cloth[3], align: 'center' });
  q.hline(4, 43, 31, PAL.stone[2]);
  wheelHi(q, 12, 34, 4);
  wheelHi(q, 36, 34, 4);
  q.line(44, 28, 48, 30, PAL.stone[2]);
});

/** A herring in the 5 × 2 box at (x, y): a pointed body, a dark back, a tail fork, an eye. */
function fishHi(q: Q, x: number, y: number, c: Color): void {
  q.ellipse(x, y, 5, 2, c);
  q.fineRow(x + 1, x + 3, y, PAL.steel[1]);
  q.dot(x + 4, y + 0.5, PAL.ink[1]);
  q.dot(x - 0.5, y, c).dot(x - 0.5, y + 1.5, c);
}

export const tulipStallHi = breakableHi(48, 36, (q, broken) => {
  const tulips: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.pink[2], PAL.purple[2], PAL.orange[2], PAL.red[3]];
  if (broken) {
    q.poly([[2, 32], [46, 30], [46, 35], [2, 35]], PAL.brown[1]);
    q.fine(2, 32, 46, 30, PAL.brown[2]);
    for (let i = 0; i < 12; i++) {
      const x = 3 + ((i * 7) % 42);
      const y = 28 + ((i * 5) % 6);
      q.line(x, y, x + 3, y + 1, PAL.green[2]);
      q.rect(x + 3, y, 2, 2, tulips[i % tulips.length]);
      q.dot(x + 3, y, PAL.snow[3]);
    }
    q.ellipse(30, 26, 8, 6, PAL.steel[2]);
    q.ellipseFine(30.5, 26.5, 7, 4, PAL.steel[3]);
    return;
  }
  q.rect(1, 0, 46, 5, PAL.green[2]);
  for (let x = 1; x < 47; x += 6) q.rect(x, 0, 3, 7, PAL.cloth[3]);
  for (let x = 4; x < 47; x += 6) q.rect(x, 5, 3, 2, PAL.green[2]);
  for (let x = 1; x < 47; x += 3) q.dot(x, 6.5, 0).dot(x + 2.5, 6.5, 0);
  q.fineRow(1, 46, 0, PAL.snow[3]);
  q.fineRow(1, 46, 4.5, PAL.green[1]);
  q.vline(3, 7, 35, PAL.brown[1]);
  q.vline(44, 7, 35, PAL.brown[1]);
  q.fineCol(3, 7, 35, PAL.brown[2]);
  q.fineCol(44, 7, 35, PAL.brown[2]);
  for (let row = 0; row < 3; row++) {
    const y = 14 + row * 7;
    q.rect(5, y + 4, 38, 2, PAL.brown[row === 2 ? 1 : 2]);
    q.fineRow(5, 42, y + 4, PAL.brown[3]);
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 6 + (row & 1) * 2;
      q.rect(x, y + 1, 5, 4, PAL.steel[2]);
      q.hline(x, x + 4, y + 1, PAL.steel[3]);
      q.fineCol(x + 4.5, y + 1, y + 4, PAL.steel[1]);
      const c = tulips[(i + row * 2) % tulips.length];
      for (const dx of [0, 2, 4]) {
        q.fineCol(x + dx, y - 2, y, PAL.green[2]);
        q.fineCol(x + dx + 0.5, y - 1, y, PAL.green[3]);
        q.dot(x + dx, y - 3, c).dot(x + dx + 0.5, y - 3, c).dot(x + dx, y - 2.5, c).dot(x + dx + 0.5, y - 2.5, c);
        q.dot(x + dx, y - 3.5, c).dot(x + dx + 0.5, y - 3.5, c === PAL.red[3] ? PAL.red[2] : c);
      }
    }
  }
  q.rect(5, 33, 38, 3, PAL.brown[1]);
  q.fineRow(5, 42, 33, PAL.brown[2]);
});

export const bikeRackBreakHi = breakableHi(52, 24, (q, broken) => {
  const colors: readonly Color[] = [PAL.black[2], PAL.red[1], PAL.teal[1]];
  if (broken) {
    q.hline(2, 50, 23, PAL.steel[2]);
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 15;
      q.ellipse(x, 18, 11, 6, PAL.black[2], false);
      q.ellipseFine(x + 1, 19, 9, 4, PAL.steel[1]);
      q.line(x - 2, 20, x + 10, 17, colors[i]);
      q.circle(x + 9, 21, 2, PAL.stone[2], false);
    }
    return;
  }
  q.hline(1, 51, 22, PAL.steel[2]);
  q.fineRow(1, 51, 22, PAL.steel[3]);
  for (let x = 4; x < 50; x += 8) {
    q.vline(x, 12, 22, PAL.steel[3]);
    q.vline(x + 4, 12, 22, PAL.steel[2]);
    q.hline(x, x + 4, 12, PAL.steel[3]);
    q.fineCol(x + 0.5, 13, 21, PAL.steel[2]);
    q.fineCol(x + 4.5, 13, 21, PAL.steel[1]);
  }
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 16;
    const c = colors[i];
    for (const wx of [x, x + 12]) {
      q.circle(wx, 17, 5, PAL.ink[1], false);
      q.ellipseFine(wx - 3.5, 13.5, 8, 8, PAL.steel[1]);
      q.fine(wx - 3, 17.5, wx + 4, 17.5, PAL.steel[2]);
      q.fine(wx + 0.5, 14, wx + 0.5, 21, PAL.steel[2]);
      q.dot(wx, 17, PAL.steel[3]);
    }
    q.line(x, 17, x + 6, 17, c);
    q.line(x + 6, 17, x + 4, 9, c);
    q.line(x + 6, 17, x + 10, 10, c);
    q.line(x + 10, 8, x + 12, 17, c);
    q.line(x + 4, 9, x, 17, c);
    q.hline(x + 2, x + 6, 8, PAL.brown[1]);
    q.fineRow(x + 2, x + 6, 8, PAL.brown[2]);
    q.hline(x + 9, x + 12, 7, PAL.steel[3]);
    q.fineRow(x + 9, x + 12, 7.5, PAL.steel[1]);
  }
});
