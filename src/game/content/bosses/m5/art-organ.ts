/**
 * Art of THE GRAND ORGAN (`grand-organ`, GDD §10.5 stage 1): a flying cathedral organ seen from
 * the front (it faces the players on the left). Sprites (anchors = the top-left of each part box,
 * local face coordinates in ./geom.ts):
 *
 * - `boss/grand-organ/body` — the walnut casework with three gothic spires, gold trim, a rose
 *   window, lit lancet windows, rotor masts and a gold fringe under the keel. Anchor: face (0, 0).
 * - `boss/grand-organ/rotor` — 4 frames of a spinning rotor (centre anchor).
 * - `boss/grand-organ/pipes-top|pipes-mid|pipes-low-0|1|2` — a cluster of 7 brass pipes on a
 *   ledge; `-2` frame 1 = the destroyed stumps.
 * - `boss/grand-organ/speaker-0|1|2` — the gold loudspeaker horn; `-2` frame 1 = the blown-out hole
 *   (the landing hatch, warm light inside).
 * - `boss/grand-organ/shutters` — 4 frames, closed → open.
 * - `boss/grand-organ/bellows-0|1|2` — 4 pump frames (closed → wide open); `-2` frame 4 = torn.
 * - `boss/grand-organ/hatch` — the kazoo-drone hatch, closed / open.
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { rotor } from '../../../art/machines';
import { hash2 } from '../../../art/paint';
import { brassPipe, finial, frameOf, glint, walnutPanel, wear } from './art-kit';
import { ORGAN, PIPE_NAMES } from './geom';

const ART = 'boss/grand-organ';

// ---------------------------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------------------------

function bodyFrame(): Frame {
  const ox = 3;
  const oy = 34;
  const b = new PixelBuffer(ORGAN.w + 6, ORGAN.h + oy + 12);
  const X = (x: number) => x + ox;
  const Y = (y: number) => y + oy;
  // Spires (gables): left, centre, right.
  const gable = (x0: number, x1: number, peak: number): void => {
    const cx = (x0 + x1) / 2;
    b.poly([X(x0), Y(20), X(cx), Y(peak), X(x1), Y(20), X(x1), Y(30), X(x0), Y(30)], PAL.brown[1]);
    // Crockets along the slopes.
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const lx = Math.round(x0 + (cx - x0) * t);
      const ly = Math.round(20 + (peak - 20) * t);
      b.set(X(lx) - 1, Y(ly) - 1, PAL.gold[2]);
      const rx = Math.round(x1 - (x1 - cx) * t);
      b.set(X(rx) + 1, Y(ly) - 1, PAL.gold[1]);
    }
    b.line(X(x0), Y(20), X(cx), Y(peak), PAL.gold[2]);
    b.line(X(cx), Y(peak), X(x1), Y(20), PAL.gold[1]);
  };
  gable(0, 92, -8);
  gable(208, 300, -8);
  gable(88, 212, -28);
  // Main case.
  walnutPanel(b, X(0), Y(18), ORGAN.w, ORGAN.h - 18, 3);
  // Pilasters with gold capitals.
  for (const px of [88, 208]) {
    b.rect(X(px), Y(18), 5, ORGAN.h - 18, PAL.brown[2]);
    b.vline(X(px), Y(18), Y(ORGAN.h - 1), PAL.gold[2]);
    b.vline(X(px + 4), Y(18), Y(ORGAN.h - 1), PAL.brown[0]);
    b.rect(X(px - 1), Y(18), 7, 3, PAL.gold[3]);
  }
  // Gold cornices.
  for (const cy of [18, 84, 140]) {
    b.hline(X(0), X(ORGAN.w - 1), Y(cy), PAL.gold[3]);
    b.hline(X(0), X(ORGAN.w - 1), Y(cy + 1), PAL.gold[1]);
    for (let x = 4; x < ORGAN.w; x += 8) b.set(X(x), Y(cy + 2), PAL.gold[2]);
  }
  // Niches behind the pipe clusters, the speaker and the bellows (dark recesses with gold arches).
  for (const name of [...PIPE_NAMES, 'speaker', 'bellows']) {
    const r = ORGAN.parts[name];
    b.rect(X(r.x - 2), Y(r.y - 4), r.w + 4, r.h + 6, PAL.brown[0]);
    b.rect(X(r.x), Y(r.y - 2), r.w, r.h + 2, PAL.ink[1]);
    for (let k = 0; k <= r.w + 4; k++) {
      const u = k / (r.w + 4);
      const ay = Math.round(Math.sin(u * Math.PI) * 6);
      b.set(X(r.x - 2 + k), Y(r.y - 4 - ay), PAL.gold[2]);
      b.set(X(r.x - 2 + k), Y(r.y - 3 - ay), PAL.brown[0]);
    }
  }
  // Rose window in the centre gable.
  const rx = X(150);
  const ry = Y(14);
  b.circle(rx, ry, 18, PAL.gold[2]);
  b.circle(rx, ry, 16, INK);
  const glassC = [PAL.pink[2], PAL.purple[2], PAL.sky[2], PAL.gold[3], PAL.red[2], PAL.purple[1], PAL.sky[1], PAL.pink[1]];
  for (let y = -15; y <= 15; y++) {
    for (let x = -15; x <= 15; x++) {
      const d = Math.hypot(x, y);
      if (d > 15) continue;
      const a = Math.atan2(y, x) + Math.PI;
      const seg = Math.floor((a / (Math.PI * 2)) * 8) % 8;
      const ring = d < 5 ? 0 : d < 10 ? 1 : 2;
      const edge = Math.abs(((a / (Math.PI * 2)) * 8) % 1 - 0.5) > 0.44;
      let c = ring === 0 ? PAL.gold[3] : glassC[(seg + ring * 3) % 8];
      if (edge && ring > 0) c = INK;
      if (Math.abs(d - 5) < 0.6 || Math.abs(d - 10) < 0.6) c = INK;
      b.set(rx + x, ry + y, c);
    }
  }
  glint(b, rx - 6, ry - 8);
  // Lit lancet windows on the right half (warm light inside the organ).
  for (let k = 0; k < 4; k++) {
    const wx = X(218 + k * 20);
    const wy = Y(40);
    b.rect(wx, wy + 4, 10, 30, PAL.gold[1]);
    b.rect(wx + 1, wy + 2, 8, 2, PAL.gold[1]);
    b.rect(wx + 3, wy, 4, 2, PAL.gold[1]);
    b.rect(wx + 2, wy + 6, 3, 26, PAL.gold[3]);
    b.vline(wx + 5, wy + 2, wy + 33, INK);
    b.hline(wx, wx + 9, wy + 18, INK);
    b.strokeRect(wx - 1, wy + 3, 12, 32, PAL.gold[0]);
  }
  // Big carved wheel (gears) lower right.
  for (const [gx, gy, gr] of [
    [236, 170, 16],
    [272, 160, 11],
  ] as const) {
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      b.rect(Math.round(X(gx) + Math.cos(t) * (gr + 1)) - 1, Math.round(Y(gy) + Math.sin(t) * (gr + 1)) - 1, 3, 3, PAL.gold[1]);
    }
    b.circle(X(gx), Y(gy), gr, PAL.gold[2]);
    b.circle(X(gx), Y(gy), gr - 3, PAL.brown[0]);
    b.circle(X(gx), Y(gy), 3, PAL.gold[3]);
  }
  // Finials and rotor masts.
  finial(b, X(46), Y(-10));
  finial(b, X(254), Y(-10));
  finial(b, X(150), Y(-30));
  for (const [mx, my] of ORGAN.rotors) {
    b.rect(X(mx) - 1, Y(my), 3, -my - 8, PAL.steel[2]);
    b.vline(X(mx) - 1, Y(my), Y(-9), PAL.steel[3]);
    b.rect(X(mx) - 3, Y(my) - 1, 7, 3, PAL.steel[1]);
  }
  // Keel: a gold fringe and short hanging pipes.
  b.rect(X(0), Y(ORGAN.h - 2), ORGAN.w, 3, PAL.gold[2]);
  for (let x = 2; x < ORGAN.w; x += 4) b.vline(X(x), Y(ORGAN.h + 1), Y(ORGAN.h + 2 + ((x >> 2) % 2) * 2), PAL.gold[1]);
  for (let k = 0; k < 6; k++) {
    const px = 196 + k * 16;
    brassPipe(b, X(px), Y(ORGAN.h - 1), 5, Y(ORGAN.h + 6 + (k % 3) * 2), PAL.gold, false);
  }
  // Kazoo hatch frame.
  const [hx, hy] = ORGAN.hatch;
  b.strokeRect(X(hx - 3), Y(hy - 3), 18, 14, PAL.gold[2]);
  b.outline(INK);
  return frameOf(b, ox, oy);
}

function hatchFrame(open: boolean): Frame {
  const b = new PixelBuffer(16, 12);
  if (open) {
    b.rect(1, 1, 14, 10, INK);
    b.rect(3, 3, 10, 6, PAL.gold[1]);
    b.rect(5, 4, 6, 4, PAL.gold[3]);
  } else {
    b.rect(1, 1, 14, 10, PAL.steel[1]);
    b.hline(1, 14, 1, PAL.steel[3]);
    b.hline(1, 14, 6, PAL.steel[0]);
    b.set(12, 5, PAL.gold[3]);
  }
  b.outline(INK);
  return frameOf(b, 1, 1);
}

function rotorFrame(phase: number): Frame {
  const r = rotor(76, phase);
  const b = new PixelBuffer(r.w + 2, r.h + 2);
  b.blit(r, 1, 1);
  b.outline(INK);
  return frameOf(b, Math.floor(b.w / 2), Math.floor(b.h / 2));
}

// ---------------------------------------------------------------------------------------------
// Pipe clusters
// ---------------------------------------------------------------------------------------------

const PIPE_W = [6, 7, 7, 8, 7, 7, 6] as const;
const PIPE_H = [30, 36, 41, 46, 41, 36, 30] as const;

function clusterFrame(state: number, stump: boolean, seed: number): Frame {
  const W = 62;
  const H = 52;
  const b = new PixelBuffer(W, H);
  // Ledge.
  b.rect(1, H - 8, 60, 7, PAL.brown[1]);
  b.hline(1, 60, H - 8, PAL.gold[3]);
  b.hline(1, 60, H - 7, PAL.gold[1]);
  for (let x = 4; x < 60; x += 8) b.rect(x, H - 4, 4, 2, PAL.brown[0]);
  let x = 3;
  for (let i = 0; i < PIPE_W.length; i++) {
    const w = PIPE_W[i];
    let h: number = PIPE_H[i];
    if (stump) h = 6 + Math.floor(hash2(i, 1, seed) * 9);
    else if (state === 2 && i % 3 === 1) h = Math.round(h * 0.6);
    const top = H - 8 - h;
    brassPipe(b, x, top, w, H - 8, PAL.gold, !stump);
    if (stump) {
      // Jagged torn tops.
      for (let k = 0; k < w; k++) if (hash2(i, k, seed) < 0.5) b.set(x + k, top, PAL.ink[1]);
      b.hline(x, x + w - 1, top + 1, PAL.gold[0]);
    } else if (state === 2 && i % 3 === 1) {
      // Bent, torn top.
      b.line(x, top, x + w - 1, top - 3, PAL.gold[1]);
      b.set(x + 1, top, INK);
    }
    x += w + 1;
  }
  if (!stump) glint(b, 5, H - 8 - PIPE_H[0] + 4);
  b.outline(INK);
  const out = state > 0 ? wear(b, state, seed + state * 11) : b;
  return frameOf(out, 1, 1);
}

// ---------------------------------------------------------------------------------------------
// Speaker horn, shutters, bellows
// ---------------------------------------------------------------------------------------------

function speakerFrame(state: number, hole: boolean): Frame {
  const W = 66;
  const H = 50;
  const b = new PixelBuffer(W, H);
  const cx = 24;
  const cy = 25;
  if (hole) {
    // The blown-out horn: a ragged hole with warm light inside (the landing hatch).
    b.ellipse(cx - 21, cy - 23, 44, 46, PAL.brown[0]);
    b.ellipse(cx - 17, cy - 19, 36, 38, PAL.gold[1]);
    b.ellipse(cx - 12, cy - 14, 26, 28, PAL.gold[3]);
    b.ellipse(cx - 6, cy - 8, 14, 16, PAL.snow[3]);
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI * 2;
      const rr = 20 + hash2(a, 3, 5) * 4;
      b.line(Math.round(cx + Math.cos(t) * 17), Math.round(cy + Math.sin(t) * 18), Math.round(cx + Math.cos(t) * rr), Math.round(cy + Math.sin(t) * (rr + 1)), a % 2 ? PAL.gold[0] : INK);
    }
    // A landing light strip.
    for (let k = 0; k < 5; k++) b.rect(cx - 10 + k * 5, cy + 14, 2, 2, PAL.red[3]);
    b.outline(INK);
    return frameOf(b, 1, 1);
  }
  // Horn tube tapering to the right.
  b.taper(cx + 10, cy, W - 3, cy - 6, 30, 10, PAL.gold[2]);
  b.hline(cx + 10, W - 4, cy - 12, PAL.gold[3]);
  b.rect(W - 8, cy - 12, 4, 14, PAL.gold[1]);
  // The bell: concentric rings to a dark throat.
  b.ellipse(cx - 22, cy - 24, 44, 48, PAL.gold[3]);
  b.ellipse(cx - 20, cy - 22, 40, 44, PAL.gold[2]);
  b.ellipse(cx - 16, cy - 18, 32, 36, PAL.gold[1]);
  b.ellipse(cx - 12, cy - 13, 24, 26, PAL.gold[0]);
  b.ellipse(cx - 8, cy - 9, 16, 18, PAL.brown[0]);
  b.ellipse(cx - 4, cy - 5, 8, 10, INK);
  // Grille bars across the throat and a glint on the rim.
  for (let k = -2; k <= 2; k++) b.hline(cx - 7, cx + 6, cy + k * 3, PAL.gold[1]);
  glint(b, cx - 14, cy - 15);
  b.set(cx - 18, cy - 8, PAL.snow[3]);
  b.outline(INK);
  return frameOf(state > 0 ? wear(b, state, 31 + state) : b, 1, 1);
}

function shuttersFrame(k: number): Frame {
  const W = 66;
  const H = 50;
  const b = new PixelBuffer(W, H);
  // 6 wooden slats; open = they slide up and down out of the way.
  const open = k / 3;
  for (let i = 0; i < 6; i++) {
    const up = i < 3;
    const y0 = 1 + i * 8;
    const shift = Math.round(open * (up ? -(3 - i) * 8 + -2 : (i - 2) * 8 + 2) * 1);
    const y = y0 + shift;
    const h = Math.max(1, Math.round(7 - open * 5));
    if (y + h < 1 || y > H - 2) continue;
    b.rect(1, y, 64, h, PAL.brown[1]);
    b.hline(1, 64, y, PAL.brown[2]);
    if (h > 2) b.hline(1, 64, y + h - 1, PAL.brown[0]);
    b.set(32, y + (h >> 1), PAL.gold[3]);
  }
  b.strokeRect(0, 0, W, H, PAL.gold[2]);
  b.outline(INK);
  return frameOf(b, 1, 1);
}

/** Bellows: `open` 0..3 (the top board swings up on its right hinge); `torn` = destroyed. */
function bellowsFrame(open: number, state: number, torn: boolean): Frame {
  const W = 82;
  const H = 62;
  const b = new PixelBuffer(W, H);
  const hingeX = 79;
  const baseY = H - 6;
  const lift = torn ? 4 : 10 + open * 9;
  // Leather folds (crimson) between the boards: a fan of pleats.
  const topL = baseY - lift - 10;
  const folds = 5;
  for (let f = 0; f <= folds; f++) {
    const t = f / folds;
    const y = Math.round(baseY - 6 - (baseY - 6 - topL) * t);
    const out = f % 2 === 1 ? -4 : 0;
    b.line(2 + out, y, hingeX - 4, baseY - 6 - Math.round(t * 3), f % 2 ? PAL.red[2] : PAL.red[1]);
  }
  b.poly([2, baseY - 5, 2, topL + 5, hingeX - 3, baseY - 9, hingeX - 3, baseY - 4], PAL.red[1]);
  for (let f = 1; f < folds; f++) {
    const t = f / folds;
    const y = Math.round(baseY - 5 - (baseY - 5 - topL - 5) * t);
    b.line(f % 2 ? 0 : 3, y, hingeX - 4, baseY - 6 - Math.round(t * 3), f % 2 ? PAL.red[3] : PAL.red[0]);
  }
  if (torn) {
    for (let k = 0; k < 10; k++) {
      const x = 6 + Math.floor(hash2(k, 2, 9) * 60);
      const y = topL + 6 + Math.floor(hash2(k, 3, 9) * (baseY - topL - 12));
      b.rect(x, y, 3, 2, INK);
    }
  }
  // Bottom board.
  b.rect(0, baseY - 4, W - 1, 6, PAL.brown[1]);
  b.hline(0, W - 2, baseY - 4, PAL.gold[2]);
  // Top board (a thick walnut plank on the hinge) with gold studs and a handle.
  b.thickLine(1, topL + 3, hingeX, baseY - 8, 5, PAL.brown[2]);
  b.line(1, topL + 1, hingeX, baseY - 10, PAL.gold[3]);
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    b.set(Math.round(1 + (hingeX - 1) * t), Math.round(topL + 3 + (baseY - 8 - topL - 3) * t), PAL.gold[3]);
  }
  b.circle(hingeX - 1, baseY - 7, 3, PAL.gold[2]);
  b.rect(0, topL - 2, 3, 8, PAL.gold[2]);
  b.outline(INK);
  return frameOf(state > 0 ? wear(b, state, 51 + state) : b, 1, 1);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

defineSprite(`${ART}/body`, () => bodyFrame());
defineSprite(`${ART}/rotor`, () => [0, 1, 2, 3].map(rotorFrame), { ticksPerFrame: 2 });
defineSprite(`${ART}/hatch`, () => [hatchFrame(false), hatchFrame(true)]);
PIPE_NAMES.forEach((name, i) => {
  for (const s of [0, 1, 2]) {
    defineSprite(`${ART}/${name}-${s}`, () => (s === 2 ? [clusterFrame(2, false, 7 + i), clusterFrame(2, true, 7 + i)] : clusterFrame(s, false, 7 + i)));
  }
});
for (const s of [0, 1, 2]) {
  defineSprite(`${ART}/speaker-${s}`, () => (s === 2 ? [speakerFrame(2, false), speakerFrame(2, true)] : speakerFrame(s, false)));
  defineSprite(`${ART}/bellows-${s}`, () => {
    const f = [0, 1, 2, 3].map((k) => bellowsFrame(k, s, false));
    if (s === 2) f.push(bellowsFrame(0, 2, true));
    return f;
  });
}
defineSprite(`${ART}/shutters`, () => [0, 1, 2, 3].map(shuttersFrame));
