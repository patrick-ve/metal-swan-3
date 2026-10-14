/**
 * Hostage bind art (`item/bind/…`) and the pieces hostage.art.ts stacks onto the figures: the
 * folding chair, the hanging cage (back and front bars), the burlap sack, the parachute canopy.
 *
 * Sprites: `rope` (8 frames = 1…8 px rope segments, drawn stacked by binds.ts `drawRope`),
 * `rope-bit` (a cut rope end tumbling), `rope-band` (float ropes across the chest / knees),
 * `chair-break`, `cage-break`, `sack-off` (the free animations), `mast` (the parade-float pole),
 * `balloon` (the weather balloon). All palette ramps, 1-px INK outlines, light from the top-left.
 *
 * 2× art (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): the binds ams uses (chair, sack,
 * the cut rope end) have `…Hi` twins drawn on the 2× grid (wood grain, burlap weave, rope twist).
 */
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { HI, outlineHi } from '../../art/hi';
import { shadeLayer } from '../../art/paint';

// ------------------------------------------------------------------------------------ rope

/** A rope segment `len` px long (4 px wide: ink, light strand, dark strand, ink), top anchor. */
function ropeSegment(len: number): Frame {
  const b = new PixelBuffer(4, len);
  for (let y = 0; y < len; y++) {
    b.set(0, y, INK);
    b.set(3, y, INK);
    // Twisted strands: the light strand crosses over every 3 px.
    const twist = y % 3 === 0;
    b.set(1, y, twist ? PAL.sand[2] : PAL.sand[3]);
    b.set(2, y, twist ? PAL.sand[3] : PAL.sand[1]);
  }
  return { buf: b, ox: 2, oy: 0 };
}

/** A cut end of rope, 7 px, tumbling in 4 frames (centre anchor). */
function ropeBitFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new PixelBuffer(11, 11);
    const a = (i * Math.PI) / 4;
    const dx = Math.round(Math.cos(a) * 3);
    const dy = Math.round(Math.sin(a) * 3);
    b.thickLine(5 - dx, 5 - dy, 5 + dx, 5 + dy, 2, PAL.sand[2]);
    b.set(5 - dx, 5 - dy, PAL.sand[3]);
    b.set(5 + dx, 5 + dy, PAL.sand[1]);
    b.outline(INK);
    out.push({ buf: b, ox: 5, oy: 5 });
  }
  return out;
}

/** The 2× cut rope end: a 4-px rope with its two strands twisting, a frayed end. */
function ropeBitFramesHi(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new PixelBuffer(22, 22);
    const a = (i * Math.PI) / 4;
    const dx = Math.round(Math.cos(a) * 3);
    const dy = Math.round(Math.sin(a) * 3);
    // The 1× capsule (2 px wide, even: centred on pixel corners) on the 2× grid.
    const x0 = (5 - dx) * HI + 1;
    const y0 = (5 - dy) * HI + 1;
    const x1 = (5 + dx) * HI + 1;
    const y1 = (5 + dy) * HI + 1;
    b.thickLine(x0, y0, x1, y1, 4, PAL.sand[2]);
    // Twist: short light strokes across the rope every 2 px along it.
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    const ux = (x1 - x0) / n;
    const uy = (y1 - y0) / n;
    for (let k = 0; k <= n; k += 2) {
      const cx = x0 + ux * k;
      const cy = y0 + uy * k;
      b.set(Math.round(cx - uy), Math.round(cy + ux), PAL.sand[3]);
      b.set(Math.round(cx + uy * 0.5), Math.round(cy - ux * 0.5), PAL.sand[1]);
    }
    // Frayed end (light) and the cut end (dark).
    b.set(x0, y0, PAL.sand[3]);
    b.set(x0 - 1, y0, PAL.sand[3]);
    b.set(x1, y1, PAL.sand[0]);
    out.push({ buf: outlineHi(b, 2), ox: 5, oy: 5, density: HI });
  }
  return out;
}

/** Rope bands of the float bind: frame 0 across the chest (16 px), 1 across the knees (12 px). */
function ropeBandFrames(): Frame[] {
  return [16, 12].map((w) => {
    const b = new PixelBuffer(w + 2, 5);
    for (let x = 1; x <= w; x++) {
      b.set(x, 2, (x & 1) === 0 ? PAL.sand[3] : PAL.sand[2]);
      b.set(x, 3, PAL.sand[1]);
    }
    // A knot on the front.
    b.rect(w - 4, 1, 3, 3, PAL.sand[2]);
    b.set(w - 4, 1, PAL.sand[3]);
    b.outline(INK);
    return { buf: b, ox: (w + 2) >> 1, oy: 3 };
  });
}

// ------------------------------------------------------------------------------------ chair

/**
 * Wooden folding chair seen from the side, drawn behind a sitting figure. `broken` 0 = whole,
 * 1 = legs splayed, 2 = backrest gone. Origin = the seat's back corner at (2, 12).
 */
export function chairPiece(broken = 0): PixelBuffer {
  const b = new PixelBuffer(16, 22);
  const wood = PAL.brown;
  if (broken < 2) {
    b.rect(2, 1, 2, 12, wood[2]);
    b.rect(1, 2, 4, 2, wood[3]);
  }
  b.rect(2, 12, 12, 2, wood[2]);
  b.hline(2, 13, 12, wood[3]);
  if (broken < 1) {
    b.line(3, 14, 3, 20, wood[1]);
    b.line(12, 14, 12, 20, wood[1]);
    b.line(4, 15, 11, 19, wood[1]);
  } else {
    b.line(3, 14, 6, 20, wood[1]);
    b.line(12, 14, 9, 20, wood[1]);
  }
  shadeLayer(b, wood, {});
  return b.padded(1).outline(INK);
}

/**
 * The 2× chair (`chairPiece` on the 2× grid, 36 × 48 with its outline): the same parts, lit with
 * 1-px bands, wood grain lines along the post and seat, a screw on each joint.
 */
export function chairPieceHi(broken = 0): PixelBuffer {
  const b = new PixelBuffer(32, 44);
  const wood = PAL.brown;
  const leg = (x0: number, y0: number, x1: number, y1: number): void => {
    b.thickLine(x0 * HI, y0 * HI, x1 * HI, y1 * HI, 2, wood[1]);
  };
  if (broken < 2) {
    b.rect(4, 2, 4, 24, wood[2]);
    b.rect(2, 4, 8, 4, wood[3]);
  }
  b.rect(4, 24, 24, 4, wood[2]);
  if (broken < 1) {
    leg(3, 14, 3, 20);
    leg(12, 14, 12, 20);
    leg(4, 15, 11, 19);
  } else {
    leg(3, 14, 6, 20);
    leg(12, 14, 9, 20);
  }
  shadeLayer(b, wood, { density: HI, hi: 0.5, lo: 0.5 });
  // Grain: broken 1-px lines along the post and the seat; screws at the joints.
  if (broken < 2) {
    for (let y = 9; y < 23; y++) if (y % 5 !== 0) b.set(6, y, wood[1]);
    b.set(8, 5, wood[0]);
    b.set(5, 26, PAL.steel[3]);
  }
  for (let x = 6; x < 26; x++) if (x % 7 !== 3) b.set(x, 26, wood[1]);
  b.set(24, 26, PAL.steel[3]);
  return outlineHi(b.padded(HI), 2);
}

/** The 2× loose stick: a 4-px plank with a lit edge, grain and a splintered end. */
function stickHi(len: number, angle: number): PixelBuffer {
  const s = (len + 4) * HI;
  const b = new PixelBuffer(s, s);
  const c = (len + 4) / 2;
  const dx = Math.cos(angle) * (len / 2);
  const dy = Math.sin(angle) * (len / 2);
  const ax = Math.round(c - dx) * HI + 1;
  const ay = Math.round(c - dy) * HI + 1;
  const bx = Math.round(c + dx) * HI + 1;
  const by = Math.round(c + dy) * HI + 1;
  b.thickLine(ax, ay, bx, by, 4, PAL.brown[2]);
  shadeLayer(b, PAL.brown, { density: HI, hi: 0.5, lo: 0.5 });
  b.line(ax, ay, bx, by, PAL.brown[1]);
  b.set(ax - 1, ay - 1, PAL.brown[3]);
  b.set(ax, ay - 1, PAL.brown[3]);
  return outlineHi(b, 2);
}

/** A loose plank / chair stick for the break frames. */
function stick(len: number, angle: number): PixelBuffer {
  const s = len + 4;
  const b = new PixelBuffer(s, s);
  const c = s / 2;
  const dx = Math.cos(angle) * (len / 2);
  const dy = Math.sin(angle) * (len / 2);
  b.thickLine(Math.round(c - dx), Math.round(c - dy), Math.round(c + dx), Math.round(c + dy), 2, PAL.brown[2]);
  b.set(Math.round(c - dx), Math.round(c - dy), PAL.brown[3]);
  return b.outline(INK);
}

/** The chair falls apart behind the freed hostage: it collapses, sticks fly, they settle. */
function chairBreakFrames(draw: (len: number, angle: number) => PixelBuffer = stick, d = 1): Frame[] {
  const out: Frame[] = [];
  const W = 40;
  const H = 30;
  const layouts: Array<Array<[number, number, number, number]>> = [
    // [x, y (top-left from the anchor), length, angle]
    [[-10, -24, 12, 1.5], [-8, -12, 12, 0.1], [-9, -9, 9, 1.2], [1, -9, 9, 1.9]],
    [[-14, -26, 12, 1.1], [-9, -16, 12, -0.3], [-14, -10, 9, 0.6], [4, -12, 9, 2.4]],
    [[-17, -16, 12, 0.6], [-8, -14, 12, 0.5], [-17, -6, 9, 0.2], [7, -7, 9, 2.9]],
    [[-17, -6, 12, 0.05], [-6, -6, 12, 3.1], [-14, -5, 9, 0], [6, -5, 9, 0.1]],
  ];
  for (const lay of layouts) {
    const b = new PixelBuffer(W * d, H * d);
    for (const [x, y, len, a] of lay) b.blit(draw(len, a), (W / 2 + x) * d, (H + y) * d);
    out.push(d === 1 ? { buf: b, ox: W / 2, oy: H } : { buf: b, ox: W / 2, oy: H, density: d });
  }
  return out;
}

/** The 2× chair break: the same sticks in the same places, drawn with `stickHi`. */
function chairBreakFramesHi(): Frame[] {
  return chairBreakFrames(stickHi, HI);
}

// ------------------------------------------------------------------------------------ cage

/** Cage frame size (GDD §7.2: 20×30), plus 1 px of outline each side. */
export const CAGE = { w: 20, h: 30 } as const;
const BAR_XS = [1, 5, 9, 14, 18];

/**
 * The cage behind the figure: dark back bars, the floor plate, the domed roof and the hanging
 * ring. Top-left at (−11, −32) from the feet anchor (the cage stands on y 0).
 */
export function cageBack(): PixelBuffer {
  const b = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  const s = PAL.steel;
  // Silhouette (outlined), then the back bars and plates.
  const sil = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  sil.rect(1, 5, CAGE.w, CAGE.h - 4, s[0]);
  sil.ellipse(1, 2, CAGE.w, 8, s[0]);
  sil.rect(CAGE.w / 2 - 1, 0, 4, 3, s[0]);
  for (let y = 0; y < sil.h; y++) for (let x = 0; x < sil.w; x++) if ((sil.get(x, y) & 255) !== 0) b.set(x, y, 0);
  // Back bars (darker, between the front bars).
  for (const x of [3, 7, 12, 16]) b.vline(x + 1, 6, CAGE.h - 2, s[1]);
  // Roof dome and ring.
  b.ellipse(1, 2, CAGE.w, 8, s[2]);
  b.ellipse(3, 3, CAGE.w - 4, 5, s[3]);
  b.hline(2, CAGE.w - 1, 6, s[1]);
  b.rect(CAGE.w / 2, 0, 2, 3, PAL.gold[1]);
  b.set(CAGE.w / 2, 0, PAL.gold[2]);
  // Floor plate.
  b.rect(1, CAGE.h - 2, CAGE.w, 3, s[2]);
  b.hline(1, CAGE.w, CAGE.h - 2, s[3]);
  b.hline(1, CAGE.w, CAGE.h, s[0]);
  b.outline(INK);
  // Clear the inside between the back bars so the figure shows there (the back is open air).
  return b;
}

/** The front bars and rims, drawn over the figure (same placement as `cageBack`). */
export function cageFront(): PixelBuffer {
  const b = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  const s = PAL.steel;
  for (const x of BAR_XS) {
    b.vline(x + 1, 6, CAGE.h - 2, s[3]);
    // Bars are lit on the left: a dark right edge only on the outer bars.
  }
  b.vline(CAGE.w, 6, CAGE.h - 2, s[2]);
  // Rims: top band under the dome, middle band, the floor lip.
  b.hline(1, CAGE.w, 7, s[3]);
  b.hline(1, CAGE.w, 8, s[1]);
  b.hline(1, CAGE.w, 18, s[2]);
  b.hline(1, CAGE.w, CAGE.h - 3, s[3]);
  // A padlock on the front bar.
  b.rect(CAGE.w - 6, 16, 4, 4, PAL.gold[1]);
  b.set(CAGE.w - 6, 16, PAL.gold[3]);
  b.set(CAGE.w - 5, 15, PAL.gold[2]);
  b.set(CAGE.w - 4, 15, PAL.gold[2]);
  return b;
}

/** The cage bursts open where it lands: front bars spring off, the frame falls apart. */
function cageBreakFrames(): Frame[] {
  const out: Frame[] = [];
  const W = 48;
  const H = 40;
  const bar = (len: number, a: number): PixelBuffer => {
    const s = len + 4;
    const p = new PixelBuffer(s, s);
    const c = s / 2;
    const dx = Math.cos(a) * (len / 2);
    const dy = Math.sin(a) * (len / 2);
    p.line(Math.round(c - dx), Math.round(c - dy), Math.round(c + dx), Math.round(c + dy), PAL.steel[3]);
    return p.outline(INK);
  };
  const dome = (): PixelBuffer => {
    const p = new PixelBuffer(CAGE.w + 2, 10);
    p.ellipse(1, 1, CAGE.w, 8, PAL.steel[2]);
    p.ellipse(3, 2, CAGE.w - 4, 5, PAL.steel[3]);
    return p.outline(INK);
  };
  const floor = (): PixelBuffer => {
    const p = new PixelBuffer(CAGE.w + 2, 5);
    p.rect(1, 1, CAGE.w, 3, PAL.steel[2]);
    p.hline(1, CAGE.w, 1, PAL.steel[3]);
    return p.outline(INK);
  };
  const steps: Array<{ dome: [number, number]; bars: Array<[number, number, number, number]> }> = [
    { dome: [-11, -34], bars: [[-14, -28, 22, 1.45], [-4, -30, 22, 1.6], [6, -28, 22, 1.7]] },
    { dome: [-12, -38], bars: [[-20, -28, 20, 1.1], [-5, -33, 20, 1.5], [9, -27, 20, 2.0]] },
    { dome: [-13, -26], bars: [[-24, -18, 18, 0.7], [-4, -30, 18, 1.3], [13, -18, 18, 2.4]] },
    { dome: [-24, -11], bars: [[-23, -6, 18, 0.05], [-6, -6, 18, 3.1], [9, -6, 18, 0.1]] },
  ];
  for (const st of steps) {
    const b = new PixelBuffer(W, H);
    b.blit(floor(), W / 2 - 11, H - 5);
    for (const [x, y, len, a] of st.bars) b.blit(bar(len, a), W / 2 + x, H + y);
    b.blit(dome(), W / 2 + st.dome[0], H + st.dome[1]);
    out.push({ buf: b, ox: W / 2, oy: H });
  }
  return out;
}

// ------------------------------------------------------------------------------------ sack

/**
 * A burlap sack with a figure inside (tied at the top), `h` px tall, `w` wide at the bottom.
 * The bottom edge sits on row h + 1 of the buffer (1 px outline margin).
 */
export function sackPiece(w: number, h: number, tilt = 0): PixelBuffer {
  const b = new PixelBuffer(w + 6, h + 6);
  const cx = (w + 6) / 2;
  const body: Array<[number, number]> = [
    [cx - w / 2, h + 2],
    [cx + w / 2, h + 2],
    [cx + w / 2 - 1 + tilt, 10],
    [cx + 2 + tilt, 5],
    [cx - 2 + tilt, 5],
    [cx - w / 2 + 1 + tilt, 10],
  ];
  b.poly(body.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), PAL.sand[1]);
  shadeLayer(b, PAL.sand, { base: 1 });
  // The tied neck and the tuft above it.
  const nx = Math.round(cx + tilt);
  b.rect(nx - 2, 4, 4, 2, PAL.brown[2]);
  b.hline(nx - 2, nx + 1, 5, PAL.brown[1]);
  b.set(nx - 2, 2, PAL.sand[2]);
  b.set(nx - 1, 1, PAL.sand[2]);
  b.set(nx, 2, PAL.sand[1]);
  b.set(nx + 1, 1, PAL.sand[2]);
  b.set(nx - 1, 3, PAL.sand[2]);
  b.set(nx, 3, PAL.sand[1]);
  // Weave seams and a stitched patch.
  for (let y = 12; y < h; y += 5) {
    for (let x = Math.round(cx - w / 2) + 2; x < cx + w / 2 - 2; x += 4) {
      if ((b.get(x, y) & 255) !== 0) b.set(x, y, PAL.sand[0]);
    }
  }
  const px = Math.round(cx + 1);
  const py = Math.round(h * 0.55);
  b.rect(px, py, 4, 4, PAL.brown[2]);
  b.set(px, py, PAL.brown[3]);
  b.set(px + 3, py + 3, PAL.brown[1]);
  // Stamped lettering: a little crimson Legion stencil mark.
  b.hline(Math.round(cx - 4), Math.round(cx - 2), py - 4, PAL.red[1]);
  b.hline(Math.round(cx - 4), Math.round(cx - 2), py - 2, PAL.red[1]);
  return b.outline(INK);
}

/**
 * The 2× sack (`sackPiece` on the 2× grid, the same box): burlap with a woven texture of 1-px
 * threads, a rope tie wound twice round the neck, a frayed tuft, a patch with stitched edges and
 * the red stencil mark.
 */
export function sackPieceHi(w: number, h: number, tilt = 0): PixelBuffer {
  const B = new PixelBuffer((w + 6) * HI, (h + 6) * HI);
  const cx = (w + 6) / 2;
  // The 1× outline of the body: left / top vertices at the 2× pixel's start, right / bottom at its end.
  const L = (x: number): number => Math.round(x) * HI;
  const Rt = (x: number): number => Math.round(x) * HI + 1;
  B.poly([
    [L(cx - w / 2), Rt(h + 2)],
    [Rt(cx + w / 2), Rt(h + 2)],
    [Rt(cx + w / 2 - 1 + tilt), L(10)],
    [Rt(cx + 2 + tilt), L(5)],
    [L(cx - 2 + tilt), L(5)],
    [L(cx - w / 2 + 1 + tilt), L(10)],
  ], PAL.sand[1]);
  shadeLayer(B, PAL.sand, { base: 1, density: HI, hi: 0.5, lo: 0.5 });
  const S = PAL.sand;
  const inside = (x: number, y: number): boolean => (B.get(x, y) & 255) !== 0 && (B.get(x - 1, y) & 255) !== 0 && (B.get(x + 1, y) & 255) !== 0 && (B.get(x, y + 1) & 255) !== 0;
  // Weave: a few scattered thread flecks one step darker than the cloth (a hash, not a grid), kept
  // out of the lit top-left quarter so the sack keeps a clear light-to-shadow form.
  const midY = ((h + 6) / 2) * HI;
  for (let y = 22; y < (h + 1) * HI; y++) {
    for (let x = 0; x < B.w; x++) {
      if (x < cx * HI && y < midY) continue;
      const n = ((x * 73856093) ^ (y * 19349663) ^ (tilt * 83492791)) >>> 0;
      if (inside(x, y) && B.get(x, y) === S[1] && n % 67 === 0) B.set(x, y, S[0]);
    }
  }
  // Seams (the 1× dots, now short 1-px stitches: dark with a light catch below).
  for (let y = 24; y < h * HI; y += 10) {
    for (let x = L(cx - w / 2) + 4 + ((y / 10) % 2) * 6; x < (cx + w / 2 - 2) * HI; x += 12) {
      if (!inside(x, y) || !inside(x + 1, y)) continue;
      B.set(x, y, S[0]);
      B.set(x + 1, y, S[0]);
      B.set(x + 1, y + 1, S[2]);
    }
  }
  // The tied neck: rope wound twice, with a light twist on each turn.
  const nx = Math.round(cx + tilt) * HI;
  B.rect(nx - 4, 8, 8, 4, PAL.brown[2]);
  B.hline(nx - 4, nx + 3, 9, PAL.brown[1]);
  B.hline(nx - 4, nx + 3, 11, PAL.brown[1]);
  for (const x of [nx - 3, nx, nx + 2]) B.set(x, 8, PAL.brown[3]);
  for (const x of [nx - 2, nx + 1]) B.set(x, 10, PAL.brown[3]);
  // The frayed tuft above the tie.
  for (const [x, y, c] of [[-4, 4, 2], [-3, 5, 2], [-2, 2, 2], [-2, 6, 1], [-1, 3, 3], [0, 4, 1], [0, 6, 2], [1, 2, 2], [2, 3, 2], [2, 5, 1], [3, 4, 3], [-1, 7, 1], [1, 7, 2]] as const) {
    B.set(nx + x, y, S[c]);
  }
  // A stitched patch.
  const px = Math.round(cx + 1) * HI;
  const py = Math.round(h * 0.55) * HI;
  B.rect(px, py, 8, 8, PAL.brown[2]);
  B.hline(px, px + 7, py, PAL.brown[3]);
  B.vline(px, py, py + 7, PAL.brown[3]);
  B.hline(px + 1, px + 7, py + 7, PAL.brown[1]);
  for (let k = 1; k < 7; k += 2) {
    B.set(px + k, py + 1, S[3]);
    B.set(px + 6, py + k, S[3]);
  }
  // The red stencil mark: the two 1× bars, each with the stencil's bridge gaps.
  const sx = Math.round(cx - 4) * HI;
  for (const y of [py - 8, py - 4]) {
    B.rect(sx, y, 6, 2, PAL.red[1]);
    B.set(sx + 2, y + 1, S[1]);
    B.hline(sx, sx + 5, y, PAL.red[2]);
  }
  return outlineHi(B, 2);
}

/** The empty sack slumps to the ground once the hostage is out (`d` 2: the 2× sack). */
function sackOffFrames(d = 1): Frame[] {
  return [
    [16, 18, 0],
    [18, 10, 1],
    [20, 5, 1],
  ].map(([w, h, t]) => {
    if (d !== 1) return { buf: sackPieceHi(w, h, t), ox: (w + 6) >> 1, oy: h + 3, density: HI };
    const p = sackPiece(w, h, t);
    return { buf: p, ox: p.w >> 1, oy: h + 3 };
  });
}

// ------------------------------------------------------------------------------------ parachute

/** A small round parachute canopy (crimson and ivory gores), 26 px wide. */
export function canopyPiece(phase = 0): PixelBuffer {
  const w = 26;
  const b = new PixelBuffer(w + 2, 12);
  const sag = phase ? 1 : 0;
  b.ellipse(1, 1, w, 16, PAL.snow[2]);
  // Cut the lower half off: a dome with a scalloped hem.
  for (let y = 9 - sag; y < 12; y++) for (let x = 0; x < w + 2; x++) b.set(x, y, 0);
  for (let x = 1; x < w + 1; x += 5) {
    b.set(x + 2, 9 - sag, PAL.snow[1]);
    b.set(x + 3, 9 - sag, PAL.snow[1]);
  }
  // Crimson gores.
  for (let y = 1; y < 10; y++) {
    for (let x = 1; x < w + 1; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const gore = Math.floor(((x - 1) / w) * 5);
      if (gore % 2 === 1) b.set(x, y, y < 4 ? PAL.red[3] : PAL.red[2]);
      else if (y < 4) b.set(x, y, PAL.snow[3]);
    }
  }
  return b.outline(INK);
}

// ------------------------------------------------------------------------------------ mast

/**
 * The parade-float pole the `float` hostage is tied to: a striped crimson-and-ivory pole with a
 * gold finial and a small pennant, 44 px tall (feet anchor).
 */
function mastFrames(): Frame[] {
  const H = 46;
  const b = new PixelBuffer(16, H);
  const x = 2;
  for (let y = 6; y < H - 1; y++) {
    const band = Math.floor((y + 1) / 4) % 2 === 0;
    b.set(x, y, band ? PAL.red[2] : PAL.snow[2]);
    b.set(x + 1, y, band ? PAL.red[1] : PAL.snow[1]);
  }
  // Base block and finial.
  b.rect(x - 1, H - 4, 4, 3, PAL.brown[2]);
  b.hline(x - 1, x + 2, H - 4, PAL.brown[3]);
  b.rect(x - 1, 3, 4, 3, PAL.gold[2]);
  b.set(x, 3, PAL.gold[3]);
  b.set(x, 2, PAL.gold[2]);
  b.set(x + 1, 2, PAL.gold[1]);
  // Pennant (gold with a crimson stripe) fluttering forward.
  b.poly([[x + 2, 7], [x + 12, 9], [x + 2, 12]], PAL.gold[2]);
  b.hline(x + 3, x + 8, 9, PAL.red[2]);
  b.set(x + 3, 7, PAL.gold[3]);
  b.outline(INK);
  return [{ buf: b, ox: x + 1, oy: H }];
}

// ------------------------------------------------------------------------------------ balloon

/**
 * A weather balloon (pale latex, a crimson Legion band) with the knot at the bottom (anchor):
 * 2 frames, the second slightly stretched (bobbing).
 */
function balloonFrames(): Frame[] {
  return [0, 1].map((i) => {
    const W = 22;
    const H = 27 + i;
    const b = new PixelBuffer(W + 2, H + 2);
    b.ellipse(1, 1, W, H - 4, PAL.snow[1]);
    b.sphere(W / 2 + 1, (H - 4) / 2 + 1, W / 2 - 1, PAL.snow, { light: 'tl', dither: false });
    // Band and knot.
    for (let x = 1; x <= W; x++) {
      const y = Math.round((H - 4) * 0.62 + 1);
      if ((b.get(x, y) & 255) !== 0) {
        b.set(x, y, PAL.red[2]);
        if ((b.get(x, y + 1) & 255) !== 0) b.set(x, y + 1, PAL.red[1]);
      }
    }
    b.rect(W / 2, H - 4, 3, 2, PAL.snow[1]);
    b.set(W / 2 + 1, H - 2, PAL.snow[0]);
    b.set(W / 2 + 1, H - 1, PAL.snow[0]);
    // A shine spot.
    b.rect(6, 5 + i, 2, 3, PAL.snow[3]);
    b.outline(INK);
    return { buf: b, ox: W / 2 + 1, oy: H + 1 };
  });
}

// ------------------------------------------------------------------------------------ register

export function defineBindSprites(): void {
  defineSprite('item/bind/rope', () => [1, 2, 3, 4, 5, 6, 7, 8].map(ropeSegment), { ticksPerFrame: 60 });
  defineSprite('item/bind/rope-bit', ropeBitFrames, { ticksPerFrame: 4, hi: ropeBitFramesHi });
  defineSprite('item/bind/rope-band', ropeBandFrames, { ticksPerFrame: 60 });
  defineSprite('item/bind/chair-break', () => chairBreakFrames(), { durations: [4, 5, 6, 30], loop: false, hi: chairBreakFramesHi });
  defineSprite('item/bind/cage-break', cageBreakFrames, { durations: [3, 4, 6, 40], loop: false });
  defineSprite('item/bind/sack-off', () => sackOffFrames(), { durations: [5, 6, 40], loop: false, hi: () => sackOffFrames(HI) });
  defineSprite('item/bind/mast', mastFrames, { ticksPerFrame: 60 });
  defineSprite('item/bind/balloon', balloonFrames, { ticksPerFrame: 16 });
}
