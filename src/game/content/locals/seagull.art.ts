/**
 * `enemy/seagull/…` — the aggressive herring gull (docs/design/amsterdam.md §2): a big white body,
 * a pale grey back and wings with black tips (white mirror spots), a yellow beak with a red spot,
 * a mean yellow eye under a frown, pink legs.
 *
 * Flying frames are anchored at the body centre; perched frames (perch, gag, gag-fries, alert)
 * at the feet; death strips at the feet (the game moves the anchor down when it dies).
 *
 * Strips: walk (6: the flap cycle, eased at the top and bottom), idle (6), perch (2), gag (2: asleep, head tucked), gag-fries
 * (4: pecking a stolen fries cone), alert (2: perched, head up), tell (2: wings up, KAW),
 * attack (2: the dive, wings folded back), die (3), die-blast, die-burn, die-crush, photo-pose,
 * feather (4: a falling feather, centre anchor), takeoff (3: crouch, push off, first down-stroke;
 * perched art lifted, anchored at the body centre like the flying frames), pull-up (2: out of the
 * dive, wings flared), turn (2: `turnSquash` of the gliding gull, for the Turner).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineHiSprite, defineSprite, getFrames } from '../../../engine/sprites';
import { HI, HiSketch, asHi, fitHi, liftHi, outlineHi, squashedHi, type HiPen } from '../../art/hi';
import { crumble, scorch, sootify, withFlames } from '../../art/human-fx';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, reground, turnSquash, xEye } from '../creatures/draw';

const W = 44;
const H = 40;
const OX = 22;
const OY = 20;

const WHITE = PAL.snow;
const GREY = PAL.steel;
const TIP = PAL.black;
const BEAK = PAL.gold;

export type GullWings = 'up' | 'mid' | 'down' | 'wide' | 'folded' | 'rest';
export type GullFace = 'open' | 'shut' | 'kaw' | 'x' | 'happy' | 'dive';

export interface GullPose {
  wings?: GullWings;
  face?: GullFace;
  /** Standing on its feet (anchor = feet). */
  perched?: boolean;
  /** Head tucked into the back (asleep). */
  tucked?: boolean;
  /** Head dipped down (pecking). */
  peck?: number;
  /** A fries cone in front (0 = none, 1 = in the beak, 2 = on the ground). */
  fries?: number;
  /** Wing-tip override (shoulder space): the flap in-betweens between the named `wings`. */
  tip?: readonly [number, number];
}

type V = readonly [number, number];
const lerp = (a: V, b: V, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A long gull wing from the shoulder: grey arm, black tip with a white mirror spot. */
function wingParts(s: Sketch, sh: V, tip: V, far: boolean): void {
  const lead: V = [sh[0] + 4, sh[1]];
  const trail: V = [sh[0] - 9, sh[1] + 2];
  const mid = lerp(lead, tip, 0.62);
  const midT = lerp(trail, tip, 0.62);
  s.add(GREY, (b, X, Y) => b.poly([X(lead[0]), Y(lead[1]), X(mid[0]), Y(mid[1]), X(midT[0]), Y(midT[1]), X(trail[0]), Y(trail[1])], FLAT), { base: far ? 2 : 3, shift: 0 });
  s.add(TIP, (b, X, Y) => b.poly([X(mid[0]), Y(mid[1]), X(tip[0]), Y(tip[1]), X(midT[0]), Y(midT[1])], FLAT), { base: 1 });
  s.detail((b, X, Y) => {
    const m = lerp(mid, tip, 0.45);
    b.set(X(m[0]), Y(m[1]), PAL.snow[3]);
  });
}

/** One gull facing right. Flying: anchor at the body centre; perched: anchor at the feet. */
export function gull(p: GullPose = {}): Frame {
  const perched = p.perched === true;
  const oy = perched ? H - 2 : OY;
  const s = new Sketch(W, H, OX, oy);
  const by = perched ? -11 : 0;
  const wings = p.wings ?? (perched ? 'rest' : 'mid');
  const tips: Record<GullWings, V> = {
    up: [-8, -20],
    mid: [-21, -5],
    down: [-12, 13],
    wide: [-3, -22],
    folded: [-15, 0],
    rest: [-13, 1],
  };
  const tip = p.tip ?? tips[wings];
  const sh: V = [1, by - 3];
  // Far wing (behind, only when the wings are spread).
  if (wings === 'up' || wings === 'wide' || wings === 'mid') wingParts(s, sh, [tip[0] + 5, tip[1] - 2], true);
  // Legs (perched): pink, with webbed feet.
  if (perched) {
    s.add(PAL.pink, (b, X, Y) => {
      b.vline(X(-2), Y(-6), Y(-1), FLAT);
      b.vline(X(1), Y(-6), Y(-1), FLAT);
      b.hline(X(-4), X(0), Y(-1), FLAT);
      b.hline(X(-1), X(3), Y(-1), FLAT);
    }, { hi: 0, lo: 0, base: 1 });
  }
  // Tail (white, a little dark edge under it).
  s.add(WHITE, (b, X, Y) => b.poly([X(-8), Y(by - 2), X(-15), Y(by - 1 + (perched ? 3 : 0)), X(-14), Y(by + 2 + (perched ? 3 : 0)), X(-7), Y(by + 3)], FLAT), { base: 2 });
  // Body: a big white teardrop, grey on the back.
  s.add(WHITE, (b, X, Y) => b.ellipse(X(-9), Y(by - 5), 18, 10, FLAT), { base: 3, glint: true });
  s.add(GREY, (b, X, Y) => b.ellipse(X(-8), Y(by - 5), 13, 4, FLAT), { base: 3, lo: 0 });
  // Head and neck.
  const hx = p.tucked ? 2 : p.face === 'dive' ? 8 : 6;
  const hy = by + (p.tucked ? -3 : p.face === 'dive' ? 1 : -6) + (p.peck ?? 0);
  s.add(WHITE, (b, X, Y) => {
    b.circle(X(hx), Y(hy), 4, FLAT);
    if (!p.tucked) b.thickLine(X(3), Y(by - 2), X(hx), Y(hy), 4, FLAT);
  }, { base: 3, glint: true });
  // Beak: yellow, hooked, a red spot near the tip.
  const face = p.face ?? 'open';
  if (!p.tucked) {
    const down = face === 'dive' ? 2 : 0;
    s.add(BEAK, (b, X, Y) => {
      if (face === 'kaw') {
        b.poly([X(hx + 3), Y(hy - 1), X(hx + 10), Y(hy - 4), X(hx + 9), Y(hy - 2), X(hx + 4), Y(hy)], FLAT);
        b.poly([X(hx + 3), Y(hy + 1), X(hx + 9), Y(hy + 3), X(hx + 4), Y(hy + 2)], FLAT);
      } else {
        b.poly([X(hx + 3), Y(hy - 1), X(hx + 10), Y(hy + down), X(hx + 10), Y(hy + 2 + down), X(hx + 3), Y(hy + 2)], FLAT);
      }
    }, { hi: 0, lo: 0, base: 2 });
    s.detail((b, X, Y) => {
      if (face === 'kaw') {
        b.set(X(hx + 6), Y(hy + 2), PAL.red[2]);
        b.set(X(hx + 5), Y(hy), PAL.red[0]);
      } else b.set(X(hx + 8), Y(hy + 1 + down), PAL.red[2]);
      b.set(X(hx + 10), Y(hy + 1 + down), BEAK[0]);
    });
  }
  // Eye: a mean yellow eye with a frown (x when dead, a line when asleep).
  s.detail((b, X, Y) => {
    if (p.tucked) {
      b.hline(X(hx), X(hx + 1), Y(hy), INK);
      return;
    }
    if (face === 'x') xEye(b, X(hx + 1), Y(hy - 1));
    else if (face === 'shut') b.hline(X(hx), X(hx + 2), Y(hy - 1), INK);
    else if (face === 'happy') {
      b.set(X(hx), Y(hy - 1), INK);
      b.set(X(hx + 1), Y(hy - 2), INK);
      b.set(X(hx + 2), Y(hy - 1), INK);
    } else {
      b.set(X(hx + 1), Y(hy - 1), PAL.gold[3]);
      b.set(X(hx + 2), Y(hy - 1), INK);
      // The frown: a dark brow slanting down to the beak.
      b.set(X(hx), Y(hy - 3), INK);
      b.set(X(hx + 1), Y(hy - 3), INK);
      b.set(X(hx + 2), Y(hy - 2), INK);
    }
  });
  // Near wing in front.
  if (wings === 'rest' || wings === 'folded') {
    s.add(GREY, (b, X, Y) => b.poly([X(2), Y(by - 4), X(-6), Y(by - 5), X(tip[0]), Y(by + tip[1] - 1), X(-4), Y(by + 1)], FLAT), { base: 2 });
    s.add(TIP, (b, X, Y) => b.poly([X(-8), Y(by - 3), X(tip[0] - 1), Y(by + tip[1] - 1), X(-8), Y(by)], FLAT), { base: 1 });
    s.detail((b, X, Y) => b.set(X(-10), Y(by - 1), PAL.snow[3]));
  } else wingParts(s, [sh[0] - 1, sh[1] + 1], tip, false);
  // Flying feet tucked under the tail.
  if (!perched) s.detail((b, X, Y) => b.hline(X(-6), X(-4), Y(4), PAL.pink[1]));
  // Fries: a red-and-white paper cone with yellow sticks.
  if (p.fries) {
    const fx = p.fries === 1 ? hx + 9 : 12;
    const fy = p.fries === 1 ? hy + 3 : -1;
    s.add(PAL.red, (b, X, Y) => b.poly([X(fx - 3), Y(fy - 6), X(fx + 3), Y(fy - 6), X(fx), Y(fy)], FLAT), { base: 2 });
    s.detail((b, X, Y) => {
      b.vline(X(fx - 1), Y(fy - 6), Y(fy - 3), PAL.snow[3]);
      b.vline(X(fx + 1), Y(fy - 6), Y(fy - 3), PAL.snow[3]);
      for (let k = -2; k <= 2; k++) b.vline(X(fx + k), Y(fy - 9 + (k & 1)), Y(fy - 7), PAL.gold[3]);
    });
  }
  return s.frame({ head: [hx, hy], mouth: [hx + 9, hy + 1] });
}

/** Feet-anchored copy (death strips: the gull lands on the floor). */
function grounded(f: Frame): Frame {
  return reground(f.buf.clone(), f.pts);
}

/** A white feather (4 turning frames, centre anchor). */
function featherFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(9, 9);
    const pts = [
      [1, 4, 7, 4],
      [2, 6, 6, 2],
      [4, 1, 4, 7],
      [2, 2, 6, 6],
    ][i];
    b.line(pts[0], pts[1], pts[2], pts[3], PAL.snow[3]);
    b.set(pts[2], pts[3], PAL.steel[3]);
    b.outline(PAL.steel[2]);
    return { buf: b, ox: 4, oy: 4 };
  });
}

// ---------------------------------------------------------------------------------------------
// 2× art (mission ams only; docs/ART_GUIDE.md "2x art (mission ams)")
// ---------------------------------------------------------------------------------------------

/** A stroke `w` 2× px wide between logical positions (w = 2: one logical pixel). */
function stroke(p: HiPen, x0: number, y0: number, x1: number, y1: number, w: number, c: number): void {
  p.fine(x0, y0, x1, y1, c);
  if (w > 1) p.fine(x0 + 0.5, y0, x1 + 0.5, y1, c);
}

/** The 2× wing: the 1× shape, plus a white trailing edge, primary seams and the mirror spot. */
function wingPartsHi(s: HiSketch, sh: V, tip: V, far: boolean): void {
  const lead: V = [sh[0] + 4, sh[1]];
  const trail: V = [sh[0] - 9, sh[1] + 2];
  const mid = lerp(lead, tip, 0.62);
  const midT = lerp(trail, tip, 0.62);
  s.add(GREY, (p) => p.poly([lead[0], lead[1], mid[0], mid[1], midT[0], midT[1], trail[0], trail[1]], FLAT), { base: far ? 2 : 3, shift: 0 });
  s.add(TIP, (p) => p.poly([mid[0], mid[1], tip[0], tip[1], midT[0], midT[1]], FLAT), { base: 1 });
  s.detail((p) => {
    // Secondaries: a fine white trailing edge (lit wing only).
    if (!far) p.fine(trail[0] + 0.5, trail[1] + 0.5, midT[0], midT[1], PAL.snow[3]);
    // Covert line across the arm.
    const a = lerp(lead, trail, 0.45);
    const b = lerp(mid, midT, 0.45);
    p.fine(a[0], a[1], b[0], b[1], GREY[far ? 1 : 2]);
    // Primary seams in the black tip, and the white mirror spot near the end.
    const m = lerp(mid, tip, 0.45);
    p.fine(lerp(mid, midT, 0.5)[0], lerp(mid, midT, 0.5)[1], lerp(m, tip, 0.5)[0], lerp(m, tip, 0.5)[1], TIP[0]);
    p.dot(m[0], m[1], PAL.snow[3]);
    p.dot(m[0] + 0.5, m[1], PAL.snow[3]);
    p.dot(m[0], m[1] + 0.5, PAL.snow[2]);
  });
}

/**
 * The 2× gull: the 1× pose (same shapes, same logical geometry) with finer details — a yellow eye
 * with a red orbital ring under the frown, a hooked beak with the red gonys spot and a gape line,
 * white tertial crescents on the grey mantle, a white trailing edge and mirror spots on the
 * wings, shaded pink legs. `line`: outline and ring width in 2× px (2 = the 1× weight).
 */
export function gullHi(p: GullPose = {}, line: 1 | 2 = 2): Frame {
  const perched = p.perched === true;
  const oy = perched ? H - 2 : OY;
  const s = new HiSketch(W, H, OX, oy, line);
  const by = perched ? -11 : 0;
  const wings = p.wings ?? (perched ? 'rest' : 'mid');
  const tips: Record<GullWings, V> = {
    up: [-8, -20],
    mid: [-21, -5],
    down: [-12, 13],
    wide: [-3, -22],
    folded: [-15, 0],
    rest: [-13, 1],
  };
  const tip = p.tip ?? tips[wings];
  const sh: V = [1, by - 3];
  if (wings === 'up' || wings === 'wide' || wings === 'mid') wingPartsHi(s, sh, [tip[0] + 5, tip[1] - 2], true);
  if (perched) {
    s.add(PAL.pink, (q) => {
      q.vline(-2, -6, -1, FLAT);
      q.vline(1, -6, -1, FLAT);
      q.hline(-4, 0, -1, FLAT);
      q.hline(-1, 3, -1, FLAT);
    }, { hi: 0, lo: 0, base: 1 });
    s.detail((q) => {
      // Lit shin edge, a knee joint and the toe webs.
      for (const x of [-2, 1]) {
        q.fine(x, -6, x, -2, PAL.pink[2]);
        q.dot(x + 0.5, -4, PAL.pink[0]);
      }
      q.fine(-4, -1, -3, -1, PAL.pink[2]);
      q.fine(-1, -1, 0, -1, PAL.pink[2]);
    });
  }
  s.add(WHITE, (q) => q.poly([-8, by - 2, -15, by - 1 + (perched ? 3 : 0), -14, by + 2 + (perched ? 3 : 0), -7, by + 3], FLAT), { base: 2 });
  s.add(WHITE, (q) => q.ellipse(-9, by - 5, 18, 10, FLAT), { base: 3, glint: true });
  s.add(GREY, (q) => q.ellipse(-8, by - 5, 13, 4, FLAT), { base: 3, lo: 0 });
  // Tertial crescent: a fine white row along the mantle's lower edge, and soft belly shading.
  s.detail((q) => {
    q.fine(-6, by - 1.5, 2, by - 1.5, PAL.snow[3]);
    q.fine(-6, by + 3.5, 0, by + 3.5, PAL.snow[1]);
  });
  const hx = p.tucked ? 2 : p.face === 'dive' ? 8 : 6;
  const hy = by + (p.tucked ? -3 : p.face === 'dive' ? 1 : -6) + (p.peck ?? 0);
  s.add(WHITE, (q) => {
    q.circle(hx, hy, 4, FLAT);
    if (!p.tucked) q.thick(3, by - 2, hx, hy, 4, FLAT);
  }, { base: 3, glint: true });
  const face = p.face ?? 'open';
  if (!p.tucked) {
    const down = face === 'dive' ? 2 : 0;
    s.add(BEAK, (q) => {
      if (face === 'kaw') {
        q.poly([hx + 3, hy - 1, hx + 10, hy - 4, hx + 9, hy - 2, hx + 4, hy], FLAT);
        q.poly([hx + 3, hy + 1, hx + 9, hy + 3, hx + 4, hy + 2], FLAT);
      } else {
        q.poly([hx + 3, hy - 1, hx + 10, hy + down, hx + 10, hy + 2 + down, hx + 3, hy + 2], FLAT);
      }
    }, { hi: 0, lo: 0, base: 2 });
    s.detail((q) => {
      if (face === 'kaw') {
        // Open gape: a red throat and a pink tongue tip.
        q.px(hx + 6, hy + 2, PAL.red[2]);
        q.px(hx + 5, hy, PAL.red[0]);
        q.dot(hx + 7, hy + 2.5, PAL.pink[2]);
        q.fine(hx + 4, hy - 1, hx + 9, hy - 3.5, PAL.gold[3]);
      } else {
        // Gape line, lit ridge, the red gonys spot and the darker hook.
        q.fine(hx + 3.5, hy + 1, hx + 8, hy + 1 + down * 0.5, BEAK[1]);
        q.fine(hx + 4, hy - 0.5, hx + 8.5, hy + down * 0.5, PAL.gold[3]);
        q.px(hx + 8, hy + 1.5 + down, PAL.red[2]);
        q.dot(hx + 8, hy + 1.5 + down, PAL.red[3]);
      }
      // The darker hook (the open 'kaw' beak has no tip there).
      if (face !== 'kaw') {
        q.px(hx + 10, hy + 1 + down, BEAK[0]);
        q.dot(hx + 10, hy + 1 + down, BEAK[1]);
      }
    });
  }
  s.detail((q) => {
    if (p.tucked) {
      q.fine(hx, hy, hx + 1.5, hy, INK);
      if (line > 1) q.fine(hx, hy + 0.5, hx + 1.5, hy + 0.5, INK);
      return;
    }
    if (face === 'x') {
      stroke(q, hx, hy - 2, hx + 2, hy, line, INK);
      stroke(q, hx, hy, hx + 2, hy - 2, line, INK);
    } else if (face === 'shut') {
      q.fine(hx, hy - 1, hx + 2.5, hy - 1, INK);
      if (line > 1) q.fine(hx, hy - 0.5, hx + 2.5, hy - 0.5, INK);
    } else if (face === 'happy') {
      stroke(q, hx, hy - 1, hx + 1, hy - 2, line, INK);
      stroke(q, hx + 1, hy - 2, hx + 2, hy - 1, line, INK);
    } else {
      // Pale yellow iris with a small black pupil, a red orbital ring at the front.
      q.px(hx + 1, hy - 1, PAL.gold[3]);
      q.dot(hx + 1, hy - 0.5, PAL.gold[2]);
      q.dot(hx + 2, hy - 1, INK);
      q.dot(hx + 2, hy - 0.5, INK);
      q.dot(hx + 2.5, hy - 1, PAL.red[2]);
      // The frown: a brow slanting down to the beak.
      stroke(q, hx - 0.5, hy - 3, hx + 1.5, hy - 2.5, line, INK);
      stroke(q, hx + 1.5, hy - 2.5, hx + 2.5, hy - 1.5, line, INK);
    }
  });
  if (wings === 'rest' || wings === 'folded') {
    s.add(GREY, (q) => q.poly([2, by - 4, -6, by - 5, tip[0], by + tip[1] - 1, -4, by + 1], FLAT), { base: 2 });
    s.add(TIP, (q) => q.poly([-8, by - 3, tip[0] - 1, by + tip[1] - 1, -8, by], FLAT), { base: 1 });
    s.detail((q) => {
      // Folded wing: tertial crescent, a covert line and the mirror spot.
      q.fine(-5, by - 4, 1, by - 3.5, PAL.snow[3]);
      q.fine(-6, by - 1.5, 0, by - 1, GREY[1]);
      q.px(-10, by - 1, PAL.snow[3]);
      q.dot(-9.5, by - 0.5, PAL.snow[2]);
      q.fine(-8.5, by - 2, tip[0], by + tip[1] - 1, TIP[0]);
    });
  } else wingPartsHi(s, [sh[0] - 1, sh[1] + 1], tip, false);
  if (!perched) s.detail((q) => {
    q.hline(-6, -4, 4, PAL.pink[1]);
    q.fine(-6, 4, -4.5, 4, PAL.pink[2]);
  });
  if (p.fries) {
    const fx = p.fries === 1 ? hx + 9 : 12;
    const fy = p.fries === 1 ? hy + 3 : -1;
    s.add(PAL.red, (q) => q.poly([fx - 3, fy - 6, fx + 3, fy - 6, fx, fy], FLAT), { base: 2 });
    s.detail((q) => {
      q.vline(fx - 1, fy - 6, fy - 3, PAL.snow[3]);
      q.vline(fx + 1, fy - 6, fy - 3, PAL.snow[3]);
      // Fries: thinner sticks at 2×, lit on the left.
      for (let k = -2; k <= 2; k++) {
        const top = fy - 9 + (k & 1);
        q.fine(fx + k, top, fx + k, fy - 6.5, PAL.gold[3]);
        q.fine(fx + k + 0.5, top + 0.5, fx + k + 0.5, fy - 6.5, PAL.gold[2]);
      }
      q.fine(fx - 3, fy - 6, fx + 3, fy - 6, PAL.red[3]);
    });
  }
  return s.frame();
}

/** The 2× feather (18×18): a white vane on a grey shaft, grey outline `line` px wide. */
function featherFramesHi(line: number): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(9 * HI, 9 * HI);
    const pts = [
      [1, 4, 7, 4],
      [2, 6, 6, 2],
      [4, 1, 4, 7],
      [2, 2, 6, 6],
    ][i];
    const q = (v: number): number => v * HI + 0.5;
    b.thickLine(q(pts[0]), q(pts[1]), q(pts[2]), q(pts[3]), 2, PAL.snow[3]);
    b.line(pts[0] * HI + 1, pts[1] * HI + 1, pts[2] * HI + 1, pts[3] * HI + 1, PAL.snow[2]);
    b.rect(pts[2] * HI, pts[3] * HI, 2, 2, PAL.steel[3]);
    outlineHi(b, line, PAL.steel[2]);
    return { buf: b, ox: 4, oy: 4, density: HI };
  });
}

type Pose = GullPose;

/** Flap wing tips (shoulder space): up, ease out, mid, ease in, down, the up-stroke. */
const FLAP_TIPS: readonly (readonly [number, number])[] = [[-8, -20], [-16, -13], [-21, -5], [-17, 6], [-12, 13], [-18, -9]];
/** Flap timing: the turning points (up, down) hold a little longer. */
export const FLAP_WALK = [4, 3, 3, 3, 4, 3];
export const FLAP_IDLE = [5, 4, 3, 4, 5, 3];

/** Take-off: crouch (head down, wings half up), push off (wings up), first down-stroke. */
const TAKEOFF_POSES: Pose[] = [
  { perched: true, peck: 1, wings: 'mid', tip: [-12, -9] },
  { perched: true, wings: 'up' },
  { perched: true, wings: 'down', tip: [-13, 9] },
];
/**
 * How far (px) each take-off frame lifts the bird above its anchor. All 0: the anchor itself rises
 * ~0.85 px a tick during the take-off (the fly mode), so an extra lift made the body jump 4 px and
 * then drop 5 px back at the hand-off to the flap (verifier, arena trace).
 */
const TAKEOFF_LIFT = [0, 0, 0];
export const TAKEOFF_TIMING = [3, 3, 4];
export const PULLUP_TIMING = [3, 3];
export const TURN_TICKS = 2;

/** The poses of each plain strip (the 1× generator above uses the same lists). */
const POSES: Record<string, Pose[]> = {
  walk: FLAP_POSES(),
  idle: FLAP_POSES(),
  perch: [{ perched: true }, { perched: true, peck: 1 }],
  gag: [{ perched: true, tucked: true }, { perched: true, tucked: true, peck: 1 }],
  'gag-fries': [{ perched: true, fries: 2 }, { perched: true, fries: 2, peck: 4 }, { perched: true, fries: 1 }, { perched: true, fries: 1, peck: 1 }],
  alert: [{ perched: true, face: 'kaw' }, { perched: true, wings: 'up', face: 'open' }],
  tell: [{ wings: 'wide', face: 'kaw' }, { wings: 'up', face: 'kaw' }],
  attack: [{ wings: 'folded', face: 'dive' }, { wings: 'folded', face: 'dive', peck: 1 }],
  die: [{ wings: 'up', face: 'x' }, { wings: 'down', face: 'x' }, { wings: 'rest', face: 'x' }],
  'photo-pose': [{ wings: 'wide', face: 'happy' }],
  'pull-up': [{ wings: 'down', face: 'dive', tip: [-15, 9] }, { wings: 'mid', tip: [-20, 1] }],
};

/** The 6-frame flap: up, two down-stroke in-betweens, down, a swept-back up-stroke. */
function FLAP_POSES(): Pose[] {
  return FLAP_TIPS.map((tip) => ({ wings: tip[1] < 0 ? 'mid' : 'down', tip }));
}

/** A perched frame re-anchored at its body centre (11 px above the feet), lifted `lift` px. */
function lifted(f: Frame, lift: number): Frame {
  return { ...f, oy: f.oy - 11 + lift };
}

/**
 * The 2× strip `name` (an enemy/seagull/… suffix) with outline width `line`, each frame matched
 * to the 1× frame (`lo`) it doubles. Death strips repeat the 1× recipe on the 2× pose: colour
 * maps and quarter turns stay at 2× detail, flames and ash are whole logical pixels (liftHi).
 */
export function gullStripHi(name: string, line: 1 | 2, lo: readonly Frame[]): Frame[] {
  const poses = POSES[name];
  if (poses) return poses.map((pose, i) => asHi(gullHi(pose, line).buf, lo[i]));
  if (name === 'feather') return featherFramesHi(line);
  if (name === 'takeoff') return TAKEOFF_POSES.map((pose, i) => asHi(gullHi(pose, line).buf, lo[i]));
  if (name === 'turn') {
    const mid = gull({ wings: 'mid' });
    return turnSquash({ ...asHi(gullHi({ wings: 'mid' }, line).buf, mid), pts: mid.pts });
  }
  if (name === 'die-blast') {
    const f2 = gullHi({ wings: 'rest', face: 'x' }, line);
    const s2 = sootify(f2, 1, false).buf;
    return [asHi(scorch(f2, 2).buf, lo[0]), ...[1, 2, 3, 2].map((q, i) => asHi(s2.rotated((q * Math.PI) / 2), lo[i + 1]))];
  }
  if (name === 'die-burn') {
    const f1 = grounded(gull({ wings: 'rest', face: 'shut' }));
    const f2 = gullHi({ wings: 'rest', face: 'shut' }, line);
    const sc1 = scorch(f1, 1);
    const sc2 = scorch(f2, 1).buf;
    const s1 = sootify(f1, 1, false);
    const s2 = sootify(f2, 1, false).buf;
    const flames = (src1: Frame, src2: PixelBuffer, phase: number, seed?: number, height?: number): Frame =>
      liftHi(withFlames(src1, phase, seed, height), src1.buf, src2, 2, (height ?? 7) + 2);
    const ash = (t: number): Frame => liftHi(crumble(s1, t), s1.buf, s2, 4, 0);
    const out = [flames(sc1, sc2, 0), flames(sc1, sc2, 1), flames(s1, s2, 2, 9, 5), asHi(s2, lo[3]), asHi(s2, lo[4]), asHi(s2, lo[5]), ash(0.4), ash(0.75), ash(1), ash(1), ash(1), ash(1)];
    return out.map((f, i) => asHi(f.buf, lo[i]));
  }
  if (name === 'die-crush') {
    const f1 = grounded(gull({ wings: 'wide', face: 'x' }));
    const f2 = gullHi({ wings: 'wide', face: 'x' }, line).buf;
    const half = squashedHi(f1, f2, lo[0], line);
    const flat = squashedHi(f1, f2, lo[1], line);
    const peel = (angle: number, i: number): Frame => fitHi(flat.buf.rotated(angle, { align: HI }), lo[i]);
    return [half, flat, asHi(flat.buf, lo[2]), peel(-0.35, 3), peel(0.3, 4), peel(-0.25, 5), peel(0.2, 6)];
  }
  throw new Error(`no 2× strip "${name}"`);
}

/** Every strip of the gull (the 2× generators cover them all). */
export const GULL_STRIPS = [...Object.keys(POSES), 'feather', 'takeoff', 'turn', 'die-blast', 'die-burn', 'die-crush'];

const A = 'enemy/seagull/';

defineSprite(A + 'walk', () => FLAP_POSES().map((p) => gull(p)), { durations: FLAP_WALK });
defineSprite(A + 'idle', () => FLAP_POSES().map((p) => gull(p)), { durations: FLAP_IDLE });
defineSprite(A + 'takeoff', () => TAKEOFF_POSES.map((p, i) => lifted(gull(p), TAKEOFF_LIFT[i])), { durations: TAKEOFF_TIMING, loop: false });
defineSprite(A + 'pull-up', () => POSES['pull-up'].map((p) => gull(p)), { durations: PULLUP_TIMING, loop: false });
defineSprite(A + 'turn', () => turnSquash(gull({ wings: 'mid' })), { ticksPerFrame: TURN_TICKS });
defineSprite(A + 'perch', () => [gull({ perched: true }), gull({ perched: true, peck: 1 })], { durations: [40, 10] });
defineSprite(A + 'gag', () => [gull({ perched: true, tucked: true }), gull({ perched: true, tucked: true, peck: 1 })], { ticksPerFrame: 30 });
defineSprite(A + 'gag-fries', () => [gull({ perched: true, fries: 2 }), gull({ perched: true, fries: 2, peck: 4 }), gull({ perched: true, fries: 1 }), gull({ perched: true, fries: 1, peck: 1 })], { durations: [14, 8, 16, 8] });
defineSprite(A + 'alert', () => [gull({ perched: true, face: 'kaw' }), gull({ perched: true, wings: 'up', face: 'open' })], { ticksPerFrame: 6 });
defineSprite(A + 'tell', () => [gull({ wings: 'wide', face: 'kaw' }), gull({ wings: 'up', face: 'kaw' })], { ticksPerFrame: 3 });
defineSprite(A + 'attack', () => [gull({ wings: 'folded', face: 'dive' }), gull({ wings: 'folded', face: 'dive', peck: 1 })], { ticksPerFrame: 4 });
defineSprite(A + 'die', () => [grounded(gull({ wings: 'up', face: 'x' })), grounded(gull({ wings: 'down', face: 'x' })), grounded(gull({ wings: 'rest', face: 'x' }))], { durations: [6, 6, 40], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(grounded(gull({ wings: 'rest', face: 'x' })), null), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(grounded(gull({ wings: 'rest', face: 'shut' })), null), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(grounded(gull({ wings: 'wide', face: 'x' }))), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'photo-pose', () => gull({ wings: 'wide', face: 'happy' }));
defineSprite(A + 'feather', featherFrames, { ticksPerFrame: 6 });

// 2× (mission ams): the 2-px outline (the weight of the 1× art; the pilot settled it).
for (const name of GULL_STRIPS) defineHiSprite(A + name, () => gullStripHi(name, 2, getFrames(A + name, 1)));
