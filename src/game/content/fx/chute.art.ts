/**
 * The player's drop canopy for the ams intro drop (anim wave p1, plan Phase 1 row 3): our own
 * ram-air wing (a flat arc of cells, navy and teal, a gold leading edge, a swan-white centre
 * cell), not a round soldier canopy. Both strips have HD twins (2× and 4×, `wingHd`): lit
 * inflated cells with seams, a gold leading edge, thin risers, the same logical geometry.
 *
 * - `fx/chute`: 6-frame sway loop (the wing tilts and breathes), 8 ticks per frame.
 * - `fx/chute-collapse`: 8 frames, once: the wing loses pressure, sags, folds and drops.
 *
 * Anchor: the centre of the wing's lower rim. Point `harness`: where the risers meet, 16 px below
 * the anchor (put it at the player's shoulders). The risers are part of the frames.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { PAL_HD } from '../../../engine/palette-hd';
import { HdCanvas } from './hd/kit';

/** Logical frame box around the anchor. */
const LEFT = 20;
const TOP = 12;
const W = 40;
const H = 36;
/** Riser meeting point below the anchor. */
const HARNESS: readonly [number, number] = [0, 16];

interface Wing {
  /** Span (logical px). */
  span: number;
  /** Tip height difference: + lifts the right (forward) tip. */
  tilt: number;
  /** Tips droop down by this much. */
  sag: number;
  /** Centre thickness. */
  thick: number;
  /** The whole wing moves down by this much. */
  drop: number;
  /** Risers: 0 = taut, > 0 = slack (bow sideways), < 0 = none. */
  slack: number;
}

const CELL: readonly Color[] = [PAL.navy[1], PAL.teal[1]];
const CELL_LIT: readonly Color[] = [PAL.sky[0], PAL.teal[2]];

function wing(w: Wing, d: number): Frame {
  const b = new PixelBuffer(W * d, H * d);
  const half = w.span / 2;
  for (let X = 0; X < W * d; X++) {
    const x = (X + 0.5) / d - LEFT;
    if (Math.abs(x) > half) continue;
    const u = x / half;
    // Upper surface: an arc, higher in the middle; tips droop by `sag`; tilt turns the span.
    const top = -w.thick - 4 + 4 * u * u + w.sag * u * u - w.tilt * u + w.drop;
    const bot = top + w.thick * (1 - 0.45 * u * u) + w.sag * 0.3 * u * u;
    const cell = Math.floor((x + half) / 4);
    const centre = Math.abs(x) < 2;
    const base = centre ? PAL.snow[1] : CELL[cell % 2];
    const lit = centre ? PAL.snow[3] : CELL_LIT[cell % 2];
    const rib = Math.abs(((x + half) % 4) - 0) < 1 / d && !centre;
    for (let Y = Math.round((top + TOP) * d); Y < Math.round((bot + TOP) * d); Y++) {
      const y = Y / d - TOP;
      let c = rib ? PAL.navy[0] : base;
      if (y - top < 1) c = PAL.gold[2];
      else if (y - top < 2 && !rib) c = lit;
      b.set(X, Y, c);
    }
  }
  b.outline(INK);
  if (w.slack >= 0) {
    // Risers from four points of the lower rim to the harness.
    for (const u of [-0.9, -0.4, 0.4, 0.9]) {
      const x = u * half;
      const y = -4 + 4 * u * u + w.sag * u * u - w.tilt * u + w.drop + w.sag * 0.3 * u * u + w.thick * (1 - 0.45 * u * u) - w.thick;
      const mx = (x + HARNESS[0]) / 2 + w.slack * Math.sign(u);
      const my = (y + HARNESS[1]) / 2;
      const P = (lx: number, ly: number): [number, number] => [Math.round((lx + LEFT) * d), Math.round((ly + TOP) * d)];
      const [x0, y0] = P(x, y + 1);
      const [x1, y1] = P(mx, my);
      const [x2, y2] = P(HARNESS[0] + Math.sign(u), HARNESS[1]);
      b.line(x0, y0, x1, y1, PAL.stone[3]);
      b.line(x1, y1, x2, y2, PAL.stone[3]);
    }
  }
  return { buf: b.touch(), ox: LEFT, oy: TOP, pts: { harness: HARNESS }, ...(d > 1 ? { density: d } : {}) };
}

/** The sway loop's wing per frame (tilt and span on a sine, so no two frames match). */
export function chuteWings(): Wing[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (2 * Math.PI * (i + 0.5)) / 6;
    return { span: 30 + Math.round(Math.cos(a) * 1.2), tilt: Math.round(Math.sin(a) * 2), sag: 0, thick: 5, drop: 0, slack: 0 };
  });
}

/** The collapse: span shrinks, tips sag, the wing thins and drops, risers go slack then vanish. */
export function collapseWings(): Wing[] {
  const span = [30, 28, 25, 22, 18, 15, 13, 12];
  const sag = [1, 3, 5, 7, 8, 9, 9, 6];
  const thick = [5, 5, 4, 4, 3, 3, 3, 2];
  const drop = [0, 1, 3, 5, 8, 11, 14, 17];
  const slack = [0, 1, 2, 3, -1, -1, -1, -1];
  return span.map((s, i) => ({ span: s, tilt: i < 4 ? -i * 0.5 : -2, sag: sag[i], thick: thick[i], drop: drop[i], slack: slack[i] }));
}

// ------------------------------------------------------------------------------------ HD (2× and 4×)

/** Top and bottom of the wing (logical px, relative to the anchor) at span position x. */
function wingRows(w: Wing, x: number): [number, number] {
  const u = x / (w.span / 2);
  const top = -w.thick - 4 + 4 * u * u + w.sag * u * u - w.tilt * u + w.drop;
  return [top, top + w.thick * (1 - 0.45 * u * u) + w.sag * 0.3 * u * u];
}

/** A line of art px (width `lw`) from (x0, y0) to (x1, y1) in logical px, drawn over `b`. */
function cord(b: PixelBuffer, d: number, x0: number, y0: number, x1: number, y1: number, c: Color, lw: number): void {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * d * 1.5) + 1;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const X = Math.floor((x0 + (x1 - x0) * t) * d);
    const Y = Math.floor((y0 + (y1 - y0) * t) * d);
    for (let o = 0; o < lw; o++) if (X + o >= 0 && X + o < b.w && Y >= 0 && Y < b.h) b.set(X + o, Y, c);
  }
}

/**
 * The HD wing (2× and 4×): an airfoil band lit from the upper left — each ram-air cell bulges
 * (light on its left, shade on its right, a dark seam between cells), the upper skin catches
 * the light, the gold leading edge runs along the top, the swan-white centre cell; outline A;
 * then the risers as thin cords (½ logical px) to the harness.
 */
function wingHd(w: Wing, d: number): Frame {
  const c = new HdCanvas(W, H, d);
  const navy = c.material({ ramp: PAL_HD.navy, spec: 0.3, shine: 12, lo: 1, hi: 5 });
  const teal = c.material({ ramp: PAL_HD.teal, spec: 0.3, shine: 12, lo: 1, hi: 5 });
  const white = c.material({ ramp: PAL_HD.snow, spec: 0.3, shine: 12, lo: 1, hi: 5 });
  const gold = c.material({ ramp: PAL_HD.gold, spec: 0.7, shine: 18, lo: 2, hi: 6 });
  const half = w.span / 2;
  const pad = w.thick + w.sag + 6;
  c.plane(LEFT - half, TOP - 10 + w.drop - pad / 2, w.span, 20 + pad, {
    mat: navy,
    tex: (s) => {
      const x = s.x - LEFT;
      const y = s.y - TOP;
      if (Math.abs(x) > half) {
        s.cut = true;
        return;
      }
      const [top, bot] = wingRows(w, x);
      if (y < top || y >= bot) {
        s.cut = true;
        return;
      }
      const a = (y - top) / Math.max(0.5, bot - top);
      const e = 0.05;
      const slope = (wingRows(w, x + e)[0] - wingRows(w, x - e)[0]) / (2 * e);
      const cx = x + half;
      const cell = Math.floor(cx / 4);
      const centre = Math.abs(x) < 2;
      const inCell = (cx % 4) / 4;
      s.nx = slope * 0.55 + (centre ? 0 : Math.sin((inCell - 0.5) * Math.PI) * 0.45);
      s.ny = -Math.cos(Math.PI * Math.min(1, a * 1.1)) * 0.85;
      s.nz = 0.62;
      s.mat = centre ? white : cell % 2 ? teal : navy;
      if (y - top < 0.85) s.mat = gold;
      else if (!centre && inCell < 0.25 / d + 0.02 && s.d >= 2) s.tone -= 0.55;
    },
  });
  const b = c.render({ outline: 'A', ao: 0, sep: false, rimLight: 1 });
  if (w.slack >= 0) {
    const lw = Math.max(1, d >> 1);
    for (const u of [-0.9, -0.4, 0.4, 0.9]) {
      const x = u * half;
      const y = -4 + 4 * u * u + w.sag * u * u - w.tilt * u + w.drop + w.sag * 0.3 * u * u + w.thick * (1 - 0.45 * u * u) - w.thick;
      const mx = (x + HARNESS[0]) / 2 + w.slack * Math.sign(u);
      const my = (y + HARNESS[1]) / 2;
      const ex = HARNESS[0] + Math.sign(u) + 0.5;
      cord(b, d, x + LEFT + 0.5, y + 1.5 + TOP, mx + LEFT + 0.5, my + TOP + 0.5, PAL_HD.stone[5], lw);
      cord(b, d, mx + LEFT + 0.5, my + TOP + 0.5, ex + LEFT, HARNESS[1] + TOP + 0.5, PAL_HD.stone[4], lw);
    }
    b.touch();
  }
  return { buf: b, ox: LEFT, oy: TOP, pts: { harness: HARNESS }, density: d };
}

defineSprite('fx/chute', () => chuteWings().map((w) => wing(w, 1)), { ticksPerFrame: 8, hd: (d) => chuteWings().map((w) => wingHd(w, d)) });
defineSprite('fx/chute-collapse', () => collapseWings().map((w) => wing(w, 1)), {
  durations: [4, 4, 4, 5, 5, 6, 6, 10],
  loop: false,
  hd: (d) => collapseWings().map((w) => wingHd(w, d)),
});
