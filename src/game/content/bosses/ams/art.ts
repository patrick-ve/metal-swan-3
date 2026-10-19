/**
 * ROBO-HALSEMA — body art (docs/design/amsterdam.md §3; likeness rules: docs/ORIGINALITY.md,
 * "Exception: mission ams"). A walking robot caricature of the mayor, hand-built from shapes:
 * big wavy dark-brown hair (one wig piece over a steel skull) with a side sweep, a long face plate
 * with strong arched brows, brown almond eyes with heavy lashes, deep red lips in a closed smile,
 * a round gold disc earring; a cream boucle jacket with a wide shawl collar over a crimson blouse,
 * the silver chain of office with enamel shields and the round pendant with the city arms; navy
 * trousers and black low-heeled shoes; steel neck, joints and mitten hands; and a giant rubber
 * stamp that reads GESLOTEN. Drawn FACING RIGHT; every piece shares the anchor (0, 0) = the floor
 * point between her feet (geometry.ts).
 *
 * Strips (`boss/ams-mayor/…`):
 * - `legs` (5): stand, step A, step B, squat, sit
 * - `body-0|1|2` (1): trousers, boucle jacket, blouse and collar, steel neck (by the boss damage state)
 * - `arm-back` (3): rest, holding the whirling chain loop high, low
 * - `stamp-arm-0|1|2` (3): low, raised, slammed; `stamp-arm-gone`: the sparking shoulder stump
 * - `chain-0|1|2` (1), `chain-gone` (1): the chain of office with its enamel shields
 * - `medallion-0|1|2` (3): closed (armoured), open core, firing glow
 * - `head-0|1|2` (6): smile, hatch open, shout, blink / powered off, bald + off, bald + dizzy
 * - `wig` (1, anchor at local (−6, −128), the launch point in mayor.ts), `spring` (4, bottom anchor), `shadow` (2, centre), `lash` (2, root anchor)
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import type { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import { scuff, sparkle } from '../m4/art-kit';
import { DCanvas, type Pt } from './canvas';
import * as hi from './art-hi';
import { MAYOR } from './geometry';
import { BLOUSE, BOOT, ENAMEL, FACE, HAIR, JACKET, JACKET_FAR, METAL, PANTS, PANTS_FAR, SILVER, WOOD } from './look';

const ART = 'boss/ams-mayor';
type Canvas = DCanvas;

function canvas(d = 1): Canvas {
  const k = MAYOR.canvas;
  return new DCanvas(k.x0, k.y0, k.x1, k.y1, d);
}

/**
 * Draw a filled shape on a fresh layer with `draw`, shade it and put it on the canvas. The light
 * box is the logical box moved by the canvas origin (−x0, −y0): the look the 1× art was tuned with.
 */
function shaded(c: Canvas, ramp: Ramp, box: readonly [number, number, number, number], draw: (L: PixelBuffer) => void, round = true): void {
  const L = c.layer();
  draw(L);
  c.shade(L, box[0] - c.x0, box[1] - c.y0, box[2], box[3], ramp, round);
  c.put(L);
}

function rivet(c: Canvas, x: number, y: number, ramp: Ramp = METAL): void {
  if (c.d === 2) return hi.rivet(c, x, y, ramp);
  c.set(x, y, ramp[ramp.length - 1]);
  c.set(x + 1, y + 1, ramp[0]);
}

/** A limb segment: a shaded capsule (local coords). */
function limb(c: Canvas, x0: number, y0: number, x1: number, y1: number, w: number, ramp: Ramp): void {
  const bx = Math.min(x0, x1) - w;
  const by = Math.min(y0, y1) - w;
  shaded(c, ramp, [bx, by, Math.abs(x1 - x0) + 2 * w, Math.abs(y1 - y0) + 2 * w], (L) => c.capsule(x0, y0, x1, y1, w, ramp[2], L));
  // Tube shading along the segment: a highlight on the top-left flank, a shade on the other.
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  let nx = -(y1 - y0) / len;
  let ny = (x1 - x0) / len;
  if (nx + ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  // Both lines stay inside the tube (radius w / 2), so the outline never wraps a shade line.
  const hi = Math.max(1, Math.round(w * 0.25));
  const lo = Math.max(1, Math.round(w * 0.3));
  const hx = Math.round(nx * hi);
  const hy = Math.round(ny * hi);
  const sx = Math.round(-nx * lo);
  const sy = Math.round(-ny * lo);
  c.line(Math.round(x0 + hx), Math.round(y0 + hy), Math.round(x1 + hx), Math.round(y1 + hy), ramp[ramp.length - 1]);
  c.line(Math.round(x0 + sx), Math.round(y0 + sy), Math.round(x1 + sx), Math.round(y1 + sy), ramp[1]);
}

/** A steel ball joint. */
function joint(c: Canvas, x: number, y: number, r: number): void {
  shaded(c, METAL, [x - r, y - r, 2 * r + 1, 2 * r + 1], (L) => c.circle(x, y, r, METAL[2], L));
  if (c.d === 2) hi.jointGlint(c, x, y, r);
  else c.set(x - 1, y - 1, METAL[4]);
}

/**
 * Boucle: the nubby wool texture. Each nub is a fixed 3-px cluster (a 2-px shaded underside and
 * a lit pixel on top) on a regular staggered 6×4 grid; a hash skips about a quarter of them. No
 * nubs on the lit tone, on the darkest tone or next to the silhouette edge; on the shade tone the
 * nub is only its darker underside.
 */
function boucle(c: Canvas, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, seed: number, skip?: PixelBuffer): void {
  if (c.d === 2) return hi.boucle(c, x0, y0, x1, y1, ramp, seed, skip);
  const top = ramp.length - 1;
  const idx = (x: number, y: number): number => ramp.indexOf(c.b.get(c.X(x), c.Y(y)));
  const inside = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((c.b.get(c.X(x + dx), c.Y(y + dy)) & 255) === 0) return false;
    return true;
  };
  for (let gy = y0; gy <= y1; gy += 4) {
    const row = Math.floor((gy - y0) / 4);
    for (let gx = x0 + (row % 2) * 3; gx <= x1; gx += 6) {
      if (hash2(gx, gy, seed) < 0.25) continue;
      const i = idx(gx, gy);
      if (i <= 0 || i >= top) continue;
      if (idx(gx + 1, gy) !== i || idx(gx, gy - 1) !== i) continue;
      if (!inside(gx, gy) || !inside(gx + 1, gy) || !inside(gx, gy - 1)) continue;
      c.set(gx, gy, ramp[i - 1]);
      c.set(gx + 1, gy, ramp[i - 1]);
      if (i >= top - 1 && i > 1) c.set(gx, gy - 1, ramp[Math.min(i + 1, top)]);
    }
  }
}

/** Scuffs over a LOGICAL box (2×: the same marks, drawn finer). */
function scuffs(c: Canvas, x: number, y: number, w: number, h: number, state: number, seed: number, light?: Color): void {
  if (c.d === 2) hi.scuff(c, x, y, w, h, state, seed, light);
  else scuff(c.b, c.X(x), c.Y(y), w, h, state, seed, light);
}

function finish(c: Canvas, state = 0, seed = 1, box?: readonly [number, number, number, number]): Frame {
  if (state > 0 && box) scuffs(c, box[0], box[1], box[2], box[3], state, seed);
  return c.frame(true);
}

// ---------------------------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------------------------

/** One leg: a navy trouser leg, a steel ball joint at the knee, a black low-heeled shoe. */
function leg(c: Canvas, hip: readonly [number, number], knee: readonly [number, number], ankle: readonly [number, number], far: boolean): void {
  const ramp = far ? PANTS_FAR : PANTS;
  limb(c, hip[0], hip[1], knee[0], knee[1], 11, ramp);
  limb(c, knee[0], knee[1], ankle[0], ankle[1], 9, ramp);
  joint(c, knee[0], knee[1], 4);
  // Shoe: a black court shoe, toe forward, a small heel at the back.
  shaded(c, BOOT, [ankle[0] - 7, ankle[1] - 3, 20, 9], (L) => {
    c.roundRect(ankle[0] - 6, ankle[1] - 2, 18, 6, 3, BOOT[2], L);
    c.rect(ankle[0] + 1, ankle[1] + 4, 11, 2, BOOT[1], L);
    c.rect(ankle[0] - 6, ankle[1] + 4, 4, 2, BOOT[1], L);
  }, false);
  if (c.d === 2) hi.shoe(c, ankle[0], ankle[1]);
  c.set(ankle[0] + 9, ankle[1] - 1, PAL.steel[2]);
}

function legsFrame(f: number, d = 1): Frame {
  const c = canvas(d);
  if (f === 4) {
    // Sitting on the floor: both legs stretched out in front.
    leg(c, [-6, -16], [14, -12], [34, -8], true);
    leg(c, [2, -14], [22, -10], [42, -6], false);
    return c.frame(true);
  }
  if (f >= 5 && f <= 8) return walkLegs(WALK_K[f - 5], c);
  if (f === 10) {
    // Push-off for the stomp hop: hips up, both legs straight, toes down.
    leg(c, [-10, -43], [-11, -24], [-11, -6], true);
    leg(c, [8, -43], [10, -24], [10, -6], false);
    return c.frame(true);
  }
  const squat = f === 3 ? 6 : f === 9 ? 3 : 0;
  const hipY = -40 + squat;
  const stepA = f === 1 ? 6 : f === 2 ? -6 : 0;
  leg(c, [-10, hipY], [-12 - stepA - squat, -22 + squat / 2], [-14 - stepA, -6], true);
  leg(c, [8, hipY], [12 + stepA + squat, -22 + squat / 2], [12 + stepA, -6], false);
  return c.frame(true);
}

/** Walk cycle phase (of 6) of the in-between leg frames 5–8 (phase 0 = frame 1, phase 3 = frame 2). */
const WALK_K = [1, 2, 4, 5] as const;
/** The 6-frame walk loop as `legs` frame indices (docs/ART_GUIDE.md "Motion"). */
export const MAYOR_WALK = [1, 5, 6, 2, 7, 8] as const;

/** One walk in-between: the stride eases on a cosine, the swinging foot lifts at the passing point. */
function walkLegs(k: number, c: Canvas): Frame {
  const ph = (k / 6) * Math.PI * 2;
  const stepA = Math.round(6 * Math.cos(ph));
  const sn = Math.sin(ph);
  const liftN = sn > 0 ? Math.round(4 * sn) : 0;
  const liftF = sn < 0 ? Math.round(-4 * sn) : 0;
  const hipY = -40 - (Math.abs(sn) > 0.5 ? 1 : 0);
  leg(c, [-10, hipY], [-12 - stepA + liftF, -22 - liftF], [-14 - stepA, -6 - liftF], true);
  leg(c, [8, hipY], [12 + stepA + liftN, -22 - liftN], [12 + stepA, -6 - liftN], false);
  return c.frame(true);
}

// ---------------------------------------------------------------------------------------------
// Body: trousers, boucle jacket, blouse, steel neck
// ---------------------------------------------------------------------------------------------

function bodyFrame(state: number, d = 1): Frame {
  const c = canvas(d);
  // Trousers at the hips (the jacket hem covers their top).
  shaded(c, PANTS, [-24, -56, 48, 20], (L) => c.poly([[-21, -56], [19, -56], [22, -37], [-23, -37]], PANTS[2], L));
  c.line(-1, -48, -1, -38, PANTS[0]);
  // The jacket: sloped shoulders from the neck, a soft waist, a slightly flared hip-length hem.
  shaded(c, JACKET, [-33, -110, 64, 62], (L) => {
    c.poly(
      [
        [-11, -108],
        [13, -108],
        [28, -99],
        [29, -91],
        [25, -74],
        [27, -58],
        [28, -51],
        [26, -49],
        [3, -48],
        [-27, -49],
        [-29, -51],
        [-29, -58],
        [-26, -74],
        [-30, -91],
        [-29, -99],
      ],
      JACKET[2],
      L,
    );
  });
  // Chest (3/4 view facing right).
  shaded(c, JACKET, [4, -100, 26, 34], (L) => c.ellipse(6, -100, 22, 32, JACKET[2], L));
  // The far flank and the back edge one shade darker; a soft shade just above the hem.
  for (let y = -108; y <= -48; y++) {
    for (let x = -32; x <= 30; x++) {
      const i = JACKET.indexOf(c.at(x, y));
      if (i <= 0) continue;
      const fold = y > -52 || x > 22 || (x < -25 && y > -92);
      if (fold) c.set(x, y, JACKET[Math.min(i, 2) - 1]);
    }
  }
  // Soft vertical drape folds (wool hangs, it is not quilted).
  for (const [xa, ya, xb, yb] of [
    [-16, -82, -18, -52],
    [15, -70, 17, -52],
  ] as const) {
    c.line(xa, ya, xb, yb, JACKET[1]);
    c.line(xa + 1, ya + 3, xb + 1, yb, JACKET[1]);
  }
  // The shawl collar stands up behind the neck.
  shaded(c, JACKET, [-10, -111, 25, 8], (L) => c.ellipse(-10, -111, 25, 8, JACKET[2], L));
  // The crimson blouse in the deep V (red on both sides of the neck), and down the open front.
  shaded(c, [BLOUSE[0], BLOUSE[1], BLOUSE[1], BLOUSE[2]], [-9, -106, 23, 58], (L) => {
    c.poly([[-9, -106], [13, -106], [6, -74], [0, -74]], BLOUSE[1], L);
    c.rect(0, -75, 6, 12, BLOUSE[1], L);
  });
  // Steel neck with a ring (the blouse collar sits round its base).
  c.rect(-4, -118, 9, 15, METAL[2]);
  c.line(-4, -118, -4, -104, METAL[3]);
  c.line(4, -118, 4, -104, METAL[1]);
  c.line(-3, -110, 3, -110, METAL[0]);
  c.line(-3, -109, 3, -109, METAL[1]);
  c.line(-4, -107, 4, -107, METAL[0]);
  c.line(-3, -106, 3, -106, METAL[4]);
  // The stand collar round the neck base, and the dark V of the throat under the collar points.
  c.rect(-5, -103, 11, 2, BLOUSE[2]);
  c.line(-5, -101, 5, -101, BLOUSE[1]);
  const v = c.layer();
  c.poly([[-2, -101], [5, -101], [2, -94]], METAL[1], v);
  c.put(v);
  c.line(2, -101, 2, -95, METAL[0]);
  // The pointed shirt collar: two light points with a dark underside edge.
  const collar = c.layer();
  // The open pointed shirt collar: long points that lie down and out on the lapels.
  c.poly([[-8, -104], [-1, -101], [-10, -94]], BLOUSE[2], collar);
  c.poly([[12, -104], [5, -101], [10, -93]], BLOUSE[2], collar);
  c.put(collar);
  c.line(-7, -104, -2, -102, BLOUSE[3]);
  c.line(-1, -101, -9, -95, BLOUSE[0]);
  c.line(5, -101, 10, -94, BLOUSE[0]);
  c.line(12, -103, 11, -95, BLOUSE[1]);
  // Covered buttons down the front (2×2).
  for (const [x, y] of [
    [1, -93],
  ] as const) {
    c.set(x, y, BLOUSE[2]);
    c.set(x + 1, y, BLOUSE[1]);
    c.set(x, y + 1, BLOUSE[1]);
    c.set(x + 1, y + 1, BLOUSE[0]);
  }
  c.line(5, -73, 5, -64, BLOUSE[0]);
  // The wide rolled shawl collar: two lapels from behind the neck down to where the jacket
  // closes under the medallion. The near lapel catches the light; the far one turns away.
  const lapN: Array<[number, number]> = [
    [-21, -109],
    [-8, -107],
    [-5, -96],
    [-2, -78],
    [0, -64],
    [-6, -66],
    [-14, -73],
    [-21, -85],
    [-24, -98],
  ];
  const lapF: Array<[number, number]> = [
    [21, -109],
    [12, -107],
    [9, -96],
    [6, -78],
    [5, -64],
    [9, -67],
    [15, -75],
    [20, -87],
    [23, -99],
  ];
  const lap = c.layer();
  c.poly(lapN, JACKET[3], lap);
  c.poly(lapF, JACKET[2], lap);
  c.put(lap);
  // Roll shading: a 2-px shadow where each lapel rolls over onto the jacket, the edge against the
  // red one shade down; the far lapel gets an inner shade too.
  const roll = (pts: ReadonlyArray<readonly [number, number]>, col: Color, w: number): void => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[k + 1];
      for (let d = 0; d < w; d++) c.line(ax + d, ay, bx + d, by, col);
    }
  };
  roll(
    [
      [-24, -98],
      [-21, -85],
      [-14, -73],
      [-6, -66],
    ],
    JACKET[0],
    2,
  );
  roll(
    [
      [-22, -98],
      [-19, -85],
    ],
    JACKET[1],
    1,
  );
  roll(
    [
      [-8, -107],
      [-5, -96],
      [-2, -78],
      [0, -65],
    ],
    JACKET[1],
    1,
  );
  roll(
    [
      [22, -99],
      [19, -87],
      [14, -75],
      [8, -67],
    ],
    JACKET[0],
    2,
  );
  roll(
    [
      [13, -107],
      [10, -96],
      [7, -78],
      [6, -65],
    ],
    JACKET[1],
    1,
  );
  roll(
    [
      [18, -99],
      [16, -88],
    ],
    JACKET[1],
    1,
  );
  // Below the pendant the jacket closes: one front edge down to the hem.
  c.rect(-1, -62, 8, 14, JACKET[2]);
  c.line(3, -62, 3, -49, JACKET[0]);
  // 2×: the shawl collar stays smooth (plush, no nubs), so it reads as its own rolled form.
  boucle(c, -33, -112, 30, -49, JACKET, 23, c.d === 2 ? lap : undefined);
  if (c.d === 2) {
    hi.shawl(c);
    hi.bodyDetail(c);
  }
  return finish(c, state, 23, [-30, -108, 60, 60]);
}

/** The far arm: shoulder (−24, −97), a boucle sleeve and a steel mitten hand. */
function armBackFrame(f: number, d = 1): Frame {
  const c = canvas(d);
  const sh: [number, number] = [-24, -97];
  if (f === 0) {
    // At rest: the sleeve hangs clearly behind the back edge, the mitten below the hem.
    limb(c, sh[0], sh[1], -32, -77, 10, JACKET_FAR);
    limb(c, -32, -77, -30, -51, 8, JACKET_FAR);
    boucle(c, -38, -104, -22, -50, JACKET_FAR, 51);
    if (c.d === 2) hi.sleeveFar(c);
    joint(c, -32, -77, 3);
    shaded(c, METAL, [-35, -52, 10, 10], (L) => c.circle(-30, -47, 4, METAL[2], L));
    if (c.d === 2) hi.mitten(c, -30, -47, 4);
    return c.frame(true);
  }
  // Frames 1 / 2: the loop high / low at phase 0; 3–7 high and 8–12 low at phases 1–5 (the whirl).
  const high = f === 1 || (f >= 3 && f <= 7);
  const p = f <= 2 ? 0 : high ? f - 2 : f - 7;
  const ph = (p / 6) * Math.PI * 2;
  // The hand circles a little as it swings the loop; the loop centre lags behind it.
  const hdx = Math.round(2 * Math.sin(ph));
  const hdy = Math.round(-2 * Math.cos(ph)) + 2;
  // High: the forearm passes under the chin, so the face stays clear.
  const elbow: [number, number] = high ? [-2, -95] : [-10, -74];
  const hand: [number, number] = high ? [26 + hdx, -118 + hdy] : [12 + hdx, -48 + hdy];
  limb(c, sh[0], sh[1], elbow[0], elbow[1], 10, JACKET);
  limb(c, elbow[0], elbow[1], hand[0], hand[1], 8, JACKET);
  boucle(c, -30, high ? -124 : -106, 30, high ? -86 : -44, JACKET, 53);
  joint(c, elbow[0], elbow[1], 3);
  // The whirling chain loop (held by the hand): the loop sways, the shields travel round it.
  // (Both offsets are 0 at phase 0, so frames 1 / 2 keep their old shape.)
  const lx = (high ? 46 : 30) + Math.round(3 * (Math.sin(ph - 1) + Math.sin(1)));
  const ly = (high ? -142 : -26) + Math.round(2 * (Math.cos(1) - Math.cos(ph - 1)));
  const rx = high ? 18 : 22;
  const ry = high ? 12 : 14;
  // The same links as the chain on her chest.
  chainBand(c, curvePts((t) => [lx + Math.cos(t * Math.PI * 2) * rx, ly + Math.sin(t * Math.PI * 2) * ry], 160), p);
  for (let k = 0; k < 4; k++) {
    const t = ((k + p / 6) / 4) * Math.PI * 2 + 0.4;
    chainShield(c, Math.round(lx + Math.cos(t) * rx), Math.round(ly + Math.sin(t) * ry), ENAMEL[k % 4]);
  }
  chainBand(c, curvePts((t) => [hand[0] + (lx - rx * 0.7 - hand[0]) * t, hand[1] + (ly + ry * 0.7 - hand[1]) * t], 40));
  shaded(c, METAL, [hand[0] - 5, hand[1] - 5, 11, 11], (L) => c.circle(hand[0], hand[1], 4, METAL[2], L));
  if (c.d === 2) hi.mitten(c, hand[0], hand[1], 4);
  return c.frame(true);
}

// ---------------------------------------------------------------------------------------------
// Stamp arm
// ---------------------------------------------------------------------------------------------

/** The giant rubber stamp: knob on top, a wooden stem and a 56-px block with the GESLOTEN label. */
function stamp(c: Canvas, cx: number, bottom: number, state: number): void {
  const top = bottom - 24;
  // Stem and knob.
  shaded(c, WOOD, [cx - 4, top - 14, 9, 16], (L) => c.rect(cx - 3, top - 12, 7, 13, WOOD[2], L), false);
  shaded(c, WOOD, [cx - 6, top - 22, 13, 12], (L) => c.circle(cx, top - 16, 5, WOOD[3], L));
  // Block.
  shaded(c, WOOD, [cx - 28, top, 57, 22], (L) => c.roundRect(cx - 28, top, 57, 21, 2, WOOD[2], L), false);
  c.line(cx - 27, top + 1, cx + 27, top + 1, WOOD[3]);
  // Rubber pad.
  c.rect(cx - 27, bottom - 3, 55, 3, PAL.red[1]);
  c.line(cx - 27, bottom - 3, cx + 27, bottom - 3, PAL.red[2]);
  // Label.
  c.rect(cx - 25, top + 5, 51, 11, PAL.cloth[2]);
  c.line(cx - 25, top + 15, cx + 25, top + 15, PAL.cloth[1]);
  if (c.d === 2) {
    hi.stampDetail(c, cx, top, bottom);
    // 2×: keep the clean label face, so no scuff falls over the letters (restored in stampArmPose).
    labelFace = c.b.clone();
  }
  labels.push([cx, top + 7]);
  if (state > 0) scuffs(c, cx - 28, top - 20, 57, 44, state, 7, WOOD[3]);
}

/**
 * Stamp arm poses (elbow, hand = the knob, block bottom): 0 low (idle), 1 raised (telegraph),
 * 2 impact (slam), 3 anticipation (a dip and pull back before the lift), 4 smear (mid swing),
 * 5 recoil (the block bounces off the floor). 0–2 keep their old indices and shapes.
 */
const ARM_POSES: ReadonlyArray<readonly [readonly [number, number], readonly [number, number], number]> = [
  [[32, -76], [55, -60], -12],
  [[40, -122], [46, -148], -106],
  [[42, -72], [57, -40], 0],
  [[28, -72], [50, -54], -6],
  [[44, -100], [58, -96], -54],
  [[40, -80], [56, -50], -8],
];
/** Poses per facing in the `stamp-arm-*` strips (frames 0–5 face right, 6–11 pre-mirrored). */
export const ARM_FRAMES = ARM_POSES.length;

/** Label text spots (local: the block centre x, the text top) of the stamp being drawn. */
const labels: Array<[number, number]> = [];
/** 2×: the canvas with the clean label face, before any scuffs. */
let labelFace: PixelBuffer | null = null;

/**
 * Stamp arm frames 0–5 face right; frames 6–11 are the same poses pre-mirrored for facing left
 * (drawn without flipX) so the GESLOTEN label always reads left to right.
 */
function stampArmFrame(f: number, state: number, mirror = false, d = 1): Frame {
  labels.length = 0;
  const fr = stampArmPose(f, state, d);
  const tw = measure('GESLOTEN');
  // The label at the art density (2×: the same letters, each pixel a 2 × 2 block).
  const label = (buf: PixelBuffer, x: number, y: number): void => {
    if (d === 1) drawText(buf, 'GESLOTEN', x, y, { color: PAL.red[2] });
    else hi.label(buf, 'GESLOTEN', x, y, d, PAL.red[2]);
  };
  if (!mirror) {
    for (const [cx, ty] of labels) label(fr.buf, fr.ox + cx - (tw >> 1), fr.oy + ty);
    return fr;
  }
  const buf = fr.buf.flipped(true);
  const ox = fr.buf.w / d - 1 - fr.ox;
  for (const [cx, ty] of labels) label(buf, ox - cx - (tw >> 1), fr.oy + ty);
  return d === 1 ? { buf, ox, oy: fr.oy } : { buf, ox, oy: fr.oy, density: d };
}

function stampArmPose(f: number, state: number, d = 1): Frame {
  const c = canvas(d);
  const sh: [number, number] = [24, -97];
  const [elbow, hand, bottom] = ARM_POSES[f];
  if (f === 4) {
    // Smear: speed streaks above the block as it travels (the frame between raised and the floor).
    for (const dx of [-24, -12, 0, 12, 24]) c.rect(hand[0] + dx, bottom - 58, 1, 28 - (Math.abs(dx) >> 1), dx % 24 === 0 ? WOOD[1] : SILVER[2]);
  }
  // The stamp hangs from the hand (raised: the hand holds the knob, the block above the head line).
  // The arm is drawn first so the block (and its GESLOTEN face) always sits in front of it.
  limb(c, sh[0], sh[1], elbow[0], elbow[1], 11, JACKET);
  limb(c, elbow[0], elbow[1], hand[0], hand[1], 9, JACKET);
  boucle(c, 12, -160, 70, -30, JACKET, 41);
  joint(c, elbow[0], elbow[1], 4);
  stamp(c, hand[0], bottom, state);
  // Steel mitten round the knob.
  shaded(c, METAL, [hand[0] - 6, hand[1] - 6, 13, 13], (L) => c.circle(hand[0], hand[1], 5, METAL[2], L));
  if (c.d === 2) hi.mitten(c, hand[0], hand[1], 5);
  // The jacket shoulder cap (kept small and low: the neck and the chest stay clear) with two rivets.
  shaded(c, JACKET, [sh[0] - 5, sh[1] - 5, 16, 13], (L) => c.ellipse(sh[0] - 5, sh[1] - 5, 16, 13, JACKET[2], L));
  boucle(c, sh[0] - 5, sh[1] - 5, sh[0] + 11, sh[1] + 8, JACKET, 43);
  rivet(c, sh[0] - 1, sh[1] - 2, METAL);
  rivet(c, sh[0] + 6, sh[1] - 2, METAL);
  if (f === 2) {
    // Slam: ink splats round the pad.
    for (const dx of [-34, -31, 31, 34]) c.rect(hand[0] + dx, -2, 2, 2, PAL.red[1]);
  }
  if (c.d === 2 && state > 0 && labelFace) {
    scuffs(c, 18, -150, 70, 150, state, 41);
    const face = labelFace;
    for (const [cx, ty] of labels) c.each(cx - 25, ty - 2, cx + 25, ty + 8, (X, Y) => c.b.set(X, Y, face.get(X, Y)));
    labelFace = null;
    return c.frame(true);
  }
  return finish(c, state, 41, [18, -150, 70, 150]);
}

function stampStump(d = 1): Frame {
  const c = canvas(d);
  shaded(c, JACKET, [19, -102, 16, 13], (L) => c.ellipse(19, -102, 16, 13, JACKET[2], L));
  boucle(c, 19, -102, 35, -89, JACKET, 45);
  // Torn cables and a stub.
  limb(c, 26, -95, 30, -88, 6, METAL);
  c.line(30, -88, 36, -82, PAL.red[2]);
  c.line(29, -86, 33, -78, PAL.gold[2]);
  c.line(31, -89, 38, -86, PAL.sky[2]);
  c.outline();
  if (c.d === 2) hi.sparkle(c, 37, -82, PAL.gold[3]);
  else sparkle(c.b, c.X(37), c.Y(-82), PAL.gold[3]);
  return c.frame(false);
}

// ---------------------------------------------------------------------------------------------
// Chain of office and medallion
// ---------------------------------------------------------------------------------------------

/**
 * A chain band along `pts` (pixel steps): a 5-px band, a steel edge round a bright white-silver
 * core, with a dark openwork hole every few steps. It reads as broad silver lace links.
 */
function chainBand(c: Canvas, pts: ReadonlyArray<readonly [number, number]>, phase = 0): void {
  if (c.d === 2) return hi.chainBand(c, pts, phase);
  for (const [x, y] of pts) c.rect(x - 2, y - 2, 5, 5, PAL.steel[1]);
  for (const [x, y] of pts) c.rect(x - 1, y - 1, 3, 3, SILVER[3]);
  const cyc = [SILVER[4], PAL.steel[0], SILVER[4], SILVER[3]];
  pts.forEach(([x, y], k) => c.set(x, y, cyc[(k + phase) % 4]));
}

/** An enamel shield on the chain: a 5×5 silver rim round a 3×3 enamel core. */
function chainShield(c: Canvas, x: number, y: number, col: Color): void {
  if (c.d === 2) return hi.chainShield(c, x, y, col);
  c.rect(x - 2, y - 2, 5, 5, SILVER[2]);
  c.rect(x - 1, y - 1, 3, 3, col);
  c.set(x, y + 3, SILVER[2]);
  c.set(x - 1, y - 1, col === PAL.snow[3] ? PAL.snow[2] : PAL.snow[3]);
}

/** Pixel steps along a polyline-ish curve f(t), t 0..1, with no repeated pixels. */
function curvePts(f: (t: number) => readonly [number, number], n = 80): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const [fx, fy] = f(i / n);
    const p: [number, number] = [Math.round(fx), Math.round(fy)];
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return out;
}

/**
 * The two runs of the chain of office: from behind the neck down along the lapel rolls (bowed a
 * little outward) to the medallion rim at about 10 and 2 o'clock. The medallion is drawn after
 * them and forms the bottom of the U: it is the pendant.
 */
const CHAIN_RUNS: ReadonlyArray<(t: number) => readonly [number, number]> = [
  (t) => [-18 + 4 * t - 2 * Math.sin(Math.PI * t), -107 + 23 * t],
  (t) => [19 - 9 * t + 1.5 * Math.sin(Math.PI * t), -105 + 21 * t],
];

function chainFrame(state: number, broken = false, d = 1): Frame {
  const c = canvas(d);
  const gone = (t: number): boolean => broken && t > 0.3 && t < 0.68;
  CHAIN_RUNS.forEach((run, r) => {
    const pts = curvePts(run).filter((_, k, a) => !gone(k / (a.length - 1)));
    chainBand(c, pts, r);
    if (broken) {
      // The cut ends dangle.
      const top = run(0.3);
      const bot = run(0.68);
      chainBand(
        c,
        curvePts((t) => [top[0] + (r === 0 ? 2 : -2) * t, top[1] + 7 * t], 8),
        r,
      );
      chainBand(
        c,
        curvePts((t) => [bot[0] + (r === 0 ? -1 : 1) * t, bot[1] - 3 * t], 4),
        r,
      );
    }
    // Two enamel shields per run.
    [0.4, 0.75].forEach((t, k) => {
      if (gone(t)) return;
      const [x, y] = run(t);
      chainShield(c, Math.round(x), Math.round(y), ENAMEL[(r * 2 + k) % 4]);
    });
  });
  // The chain runs under the hair high at the back of the neck: clear what the wig crown covers
  // (the curl ends lower down lie under the chain).
  const hair = lockMask(c, -110);
  for (let i = 0; i < hair.data.length; i++) if ((hair.data[i] & 255) !== 0) c.b.data[i] = 0;
  c.b.touch();
  return finish(c, broken ? 0 : state, 13, [-20, -110, 46, 26]);
}

/** Medallion frames: 0 closed (the city emblem: a red shield, a black pale, three white crosses), 1 open core, 2 firing glow. */
function medallionFrame(f: number, state: number, d = 1): Frame {
  const c = canvas(d);
  const [cx, cy] = MAYOR.medallionC;
  const r = 14;
  shaded(c, SILVER, [cx - r, cy - r, 2 * r + 1, 2 * r + 1], (L) => c.circle(cx, cy, r, SILVER[2], L));
  // A 2-px rim, lit top-left and shaded bottom-right, with dark openwork dots like the chain.
  c.each(cx - r, cy - r, cx + r, cy + r, (X, Y, lx, ly) => {
    const x = lx - cx;
    const y = ly - cy;
    const dd = Math.hypot(x, y);
    if (dd > r + 0.35 || dd < r - 2.2) return;
    c.b.set(X, Y, x + y < 0 ? SILVER[3] : SILVER[1]);
  });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    c.set(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)), PAL.steel[0]);
  }
  if (f === 0) {
    // The city arms: a red shield, a black pale, three white saltires, a small gold crown.
    c.circle(cx, cy, r - 3, SILVER[0]);
    const sh = c.layer();
    c.poly([[cx - 9, cy - 9], [cx + 9, cy - 9], [cx + 9, cy + 4], [cx, cy + 12], [cx - 9, cy + 4]], PAL.red[2], sh);
    // Keep the shield inside the rim.
    for (let y = 0; y < sh.h; y++) for (let x = 0; x < sh.w; x++) if (Math.hypot(c.lx(x) - cx, c.ly(y) - cy) > r - 2.6) sh.set(x, y, 0);
    c.put(sh);
    c.line(cx + 8, cy - 8, cx + 8, cy + 4, PAL.red[1]);
    c.line(cx + 7, cy + 5, cx + 1, cy + 11, PAL.red[1]);
    c.line(cx - 8, cy - 8, cx - 8, cy + 3, PAL.red[3]);
    c.rect(cx - 2, cy - 9, 5, 19, INK);
    c.rect(cx - 1, cy + 10, 3, 1, INK);
    for (const dy of [-5, 0, 5]) {
      for (const [dx, ddy] of [
        [-1, -1],
        [1, -1],
        [0, 0],
        [-1, 1],
        [1, 1],
      ] as const)
        c.set(cx + dx, cy + dy + ddy, PAL.snow[3]);
    }
    // Crown on the rim, where the chain runs end.
    c.rect(cx - 4, cy - 12, 9, 2, PAL.gold[2]);
    for (const dx of [-4, 0, 4]) c.set(cx + dx, cy - 13, PAL.gold[3]);
    c.line(cx - 3, cy - 11, cx + 4, cy - 11, PAL.gold[1]);
    if (c.d === 2) hi.arms(c, cx, cy);
  } else {
    // Open: a dark socket and a glowing core.
    c.circle(cx, cy, r - 3, SILVER[0]);
    c.circle(cx, cy, 9, INK);
    const glow = f === 2;
    c.circle(cx, cy, 7, glow ? PAL.pink[2] : PAL.teal[2]);
    c.circle(cx, cy, 5, glow ? PAL.gold[3] : PAL.teal[3]);
    c.circle(cx, cy, 2, PAL.snow[3]);
    if (c.d === 2) hi.core(c, cx, cy, glow);
    if (glow) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        c.set(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 11), PAL.gold[3]);
      }
    }
  }
  if (c.d === 2) hi.rimDetail(c, cx, cy, r);
  else c.set(cx - 8, cy - 9, PAL.snow[3]);
  return finish(c, state, 5, [cx - r, cy - r, 2 * r, 2 * r]);
}

// ---------------------------------------------------------------------------------------------
// Head: the face plate, the big wavy wig (one piece, it flies off at death), the steel skull
// ---------------------------------------------------------------------------------------------

/** Pixels of a disc (helper for the hair locks and the curls). */
function disc(L: PixelBuffer, c: Canvas, x: number, y: number, r: number, col: Color): void {
  c.circle(x, y, r, col, L);
}

/**
 * The hair silhouette: overlapping round locks (a curly cloud). Big mass at the back and the
 * near side, flaring wide at the shoulders; a full fall behind the far cheek (it frames the
 * face); a high crown.
 */
const HAIR_LOCKS: ReadonlyArray<readonly [number, number, number]> = [
  // crown
  [-4, -152, 12],
  [8, -153, 11],
  [-18, -149, 12],
  [17, -149, 8],
  // back and near side (behind the ear), flaring at the bottom
  [-28, -140, 11],
  [-31, -127, 11],
  [-30, -114, 10],
  [-27, -104, 7],
  [-20, -108, 6],
  [-17, -124, 10],
  // small fillers: no see-through gaps beside the face
  [-16, -136, 3],
  [-11, -135, 2],
  [-8, -116, 3],
  [-18, -112, 3],
  // far side fall behind the cheek, flaring out at the jaw and the shoulder
  [24, -140, 6],
  [26, -129, 6],
  [26, -118, 6],
  [28, -108, 5],
  [27, -113, 2],
  [21, -109, 3],
  [26, -140, 6],
  [29, -130, 7],
  [31, -119, 7],
  [32, -109, 7],
  [35, -101, 5],
];

/**
 * The loose wave ends at the shoulders: a flare under the back mass (and the far fall) whose
 * bottom edge splits into tapered tips that point down and out. Each entry is a polygon; `TIPS`
 * lists the tip points (a lit pixel on the upper outer side, a dark one on the underside).
 */
const HAIR_FLARES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [-36, -128],
    [-40, -121],
    [-43, -112],
    [-44, -106],
    [-45, -100],
    [-41, -105],
    [-40, -95],
    [-36, -101],
    [-32, -93],
    [-28, -100],
    [-24, -96],
    [-21, -102],
    [-20, -108],
    [-26, -118],
  ],
  [
    [30, -110],
    [36, -108],
    [39, -104],
    [38, -100],
    [37, -97],
    [34, -102],
    [31, -95],
    [29, -100],
    [27, -104],
  ],
];
const TIPS: ReadonlyArray<readonly [number, number, number]> = [
  // x, y, the side that faces out (−1 left, +1 right)
  [-45, -100, -1],
  [-40, -95, -1],
  [-32, -93, -1],
  [-24, -96, -1],
  [37, -97, 1],
  [31, -95, 1],
];

/** Wavy strands (from, to, amplitude, half-waves, phase): the loose big S-waves of the hair. */
const STRANDS: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  // back mass: from the crown out and down to the shoulder ends
  [-8, -162, -40, -106, 5, 2.5, 0],
  [-14, -158, -29, -97, 5.5, 2, 1.4],
  [-22, -154, -45, -116, 5, 2, 0.6],
  [-3, -158, -15, -101, 5, 2.5, 2.2],
  [-28, -150, -36, -98, 6, 2.5, 2.8],
  [-9, -150, -22, -100, 5, 2, 0.9],
  // far side fall
  [16, -161, 29, -104, 3, 2.5, 0.3],
  [23, -152, 25, -112, 2, 2, 1.8],
  [24, -150, 34, -100, 3, 2.5, 1],
];

/** The hair locks (only those centred above local y `above`) as a mask layer. */
function lockMask(c: Canvas, above = Infinity): PixelBuffer {
  const L = c.layer();
  for (const [x, y, r] of HAIR_LOCKS) if (y < above) disc(L, c, x, y, r, HAIR[1]);
  return L;
}

/** Wavy line points along a strand. */
function strandPts(s: readonly [number, number, number, number, number, number, number]): Array<[number, number]> {
  const [x0, y0, x1, y1, a, k, ph] = s;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const pts: Array<[number, number]> = [];
  const n = Math.ceil(len);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI * k + ph) * a * Math.min(1, t * 3);
    pts.push([x0 + (x1 - x0) * t + nx * w, y0 + (y1 - y0) * t + ny * w]);
  }
  return pts;
}

/**
 * The back of the wig: a dark chocolate curly cloud (near black in the shadows). Each lock gets
 * a dark rim at the bottom right and, high up, a thin lit crescent at the top left; chestnut
 * only on the crown crests. Wavy strands add chestnut crest lines and dark grooves.
 */
/** hairBack's finished layer per canvas geometry, density and dy (it reads nothing but its own layer). */
const hairBackCache = new Map<string, PixelBuffer>();

function hairBack(c: Canvas, dy: number): void {
  const key = `${c.x0},${c.y0},${c.b.w},${c.b.h},${c.d},${dy}`;
  const done = hairBackCache.get(key);
  if (done) {
    c.put(done);
    return;
  }
  const L = c.layer();
  hairBackCache.set(key, L);
  // The flare under the locks: dark at the nape, mid brown toward the outer edge.
  for (const poly of HAIR_FLARES) {
    const F = c.layer();
    c.poly(
      poly.map(([x, y]) => [x, y + dy] as const),
      HAIR[1],
      F,
    );
    c.shade(F, -46, -130 + dy, 90, 38, [HAIR[0], HAIR[1], HAIR[1], HAIR[2]]);
    for (let i = 0; i < F.data.length; i++) if ((F.data[i] & 255) !== 0) L.data[i] = F.data[i];
  }
  for (const [x, y0, r] of HAIR_LOCKS) {
    const y = y0 + dy;
    c.each(x - r, y - r, x + r, y + r, (X, Y, lx, ly) => {
      {
        const px = lx - x;
        const py = ly - y;
        const d = Math.hypot(px, py);
        if (d > r + 0.35) return;
        const u = (px - py) / (r * 1.414);
        const v = (px + py) / (r * 1.414);
        let col = HAIR[1];
        const high = y + py < -128;
        // Lit side: a thin crescent at the upper left (only on the upper locks).
        if (y0 < -110 && v < (high ? -0.4 : -0.6) && d > r * 0.4) col = HAIR[2];
        // Chestnut sheen: a 2-px band on the crown locks only.
        if (y0 < -145 && v < -0.6 && d > r - 2.8 && d < r - 0.8 && Math.abs(u) < 0.4) col = HAIR[3];
        // Shadow: a crescent at the bottom right; the low locks shade their lower half (the nape).
        if (v > 0.5 && d > r - 1.4) col = HAIR[0];
        if (y0 > -115 && py > 0 && v > -0.2) col = HAIR[0];
        L.set(X, Y, col);
      }
    });
  }
  // Strands: dark ribbons with a chestnut crest on the lit (left) edge where the wave peaks, and
  // a dark groove on the shaded (right) edge in the troughs.
  const inHair = (X: number, Y: number): boolean => (L.get(X, Y) & 255) !== 0;
  if (c.d === 2) hi.strands(c, L, dy, STRANDS);
  else for (const s of STRANDS) {
    const pts = strandPts([s[0], s[1] + dy, s[2], s[3] + dy, s[4], s[5], s[6]]);
    for (let i = 0; i < pts.length; i++) {
      const X = c.X(pts[i][0]);
      const Y = c.Y(pts[i][1]);
      const crest = Math.sin((i / pts.length) * Math.PI * s[5] + s[6]);
      const high = pts[i][1] < -124;
      for (let k = -1; k <= 1; k++) if (inHair(X + k, Y)) L.set(X + k, Y, HAIR[1]);
      if (inHair(X - 2, Y) && crest > 0.3) L.set(X - 2, Y, high && crest > 0.6 ? HAIR[3] : HAIR[2]);
      if (inHair(X + 2, Y) && crest < 0) L.set(X + 2, Y, HAIR[0]);
    }
  }
  // The wave tips: a lit pixel on the upper outer side, the underside dark.
  for (const [x, y, o] of TIPS) {
    const Y = y + dy;
    c.set(x, Y, HAIR[1], L);
    c.set(x - o, Y - 1, HAIR[1], L);
    c.set(x, Y - 2, HAIR[2], L);
    c.set(x + o, Y - 3, HAIR[2], L);
    c.set(x - o, Y - 2, HAIR[0], L);
    c.set(x - 2 * o, Y - 2, HAIR[0], L);
  }
  c.put(L);
}

/**
 * The front of the wig: the side part high on the far side and the big sweep across the top of
 * the forehead down to the near temple (it frames the face), and the letter hatch in the crown.
 */
function hairFront(c: Canvas, dy: number, hatch: 0 | 1): void {
  const L = c.layer();
  // The sweep: from the part (far side, high) across the forehead to the near temple.
  c.poly(
    SWEEP.map(([x, y]) => [x, y + dy] as const),
    HAIR[1],
    L,
  );
  // The far temple: a lock that falls past the far brow.
  c.poly(
    TEMPLE.map(([x, y]) => [x, y + dy] as const),
    HAIR[1],
    L,
  );
  c.shade(L, -14, -162 + dy, 40, 34, [HAIR[0], HAIR[1], HAIR[1], HAIR[2]]);
  // No near-black visor along the forehead: the darkest tone only at the near temple tuck.
  for (let Y = 0; Y < L.h; Y++) for (let X = c.X(-7); X < L.w; X++) if (L.get(X, Y) === HAIR[0]) L.set(X, Y, HAIR[1]);
  c.put(L);
  // Sweep strands: long curves from the part down to the temple, one chestnut sheen on top.
  const sweep = (x0: number, y0: number, x1: number, y1: number, bend: number, col: Color): void => {
    const n = 24 * c.d;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * bend;
      const X = c.X(x);
      const Y = c.Y(y + dy);
      if (HAIR_SET.has(c.b.get(X, Y))) c.b.set(X, Y, col);
    }
  };
  if (c.d === 2) hi.sweepWaves(c, dy);
  else {
    // The lowest strand rolls up and back off the forehead (chestnut).
    sweep(14, -157, -11, -139, 4, HAIR[2]);
    sweep(10, -159, -12, -143, 4, HAIR[3]);
    sweep(16, -155, -7, -141, 3, HAIR[1]);
    sweep(4, -160, -13, -149, 2, HAIR[1]);
    // The part line (a short dark groove on the far side of the crown).
    c.line(15, -160 + dy, 19, -155 + dy, HAIR[0]);
  }
  // The letter hatch: a hinged lid in the crown (a thin seam when shut).
  if (hatch === 0) {
    for (let x = -14; x <= 0; x++) {
      const y = -161 + Math.round(((x + 7) * (x + 7)) / 24) + dy;
      if (HAIR_SET.has(c.at(x, y))) c.set(x, y, HAIR[0]);
    }
  } else {
    // The lid flips up and back on its hinge; letters peek out of the slot.
    c.ellipse(-15, -164 + dy, 17, 6, INK);
    c.ellipse(-14, -163 + dy, 15, 4, PAL.ink[1]);
    const lid = c.layer();
    c.poly(
      [
        [-16, -161 + dy],
        [-23, -163 + dy],
        [-29, -169 + dy],
        [-28, -175 + dy],
        [-21, -174 + dy],
        [-14, -168 + dy],
        [-11, -163 + dy],
      ],
      HAIR[2],
      lid,
    );
    c.shade(lid, -29, -175 + dy, 19, 15, HAIR);
    // The lid's steel underside.
    c.line(-15, -162 + dy, -26, -173 + dy, METAL[2], lid);
    c.put(lid);
    c.set(-16, -161 + dy, METAL[3]);
    c.set(-15, -160 + dy, METAL[1]);
    // An envelope and a folded note.
    c.rect(-12, -168 + dy, 8, 6, PAL.snow[3]);
    c.line(-12, -168 + dy, -8, -165 + dy, PAL.stone[2]);
    c.line(-5, -168 + dy, -8, -165 + dy, PAL.stone[2]);
    c.rect(-3, -170 + dy, 6, 6, PAL.cloth[2]);
    c.rect(-1, -168 + dy, 2, 2, PAL.red[2]);
    if (c.d === 2) hi.letters(c, dy);
  }
}

/** The sweep over the forehead and the far temple lock (outlines for hairFront). */
const SWEEP: ReadonlyArray<Pt> = [
  [16, -158],
  [21, -152],
  [16, -151],
  [9, -150],
  [3, -150],
  [-2, -147],
  [-6, -144],
  [-9, -136],
  [-14, -134],
  [-14, -150],
  [-6, -160],
  [6, -162],
];
const TEMPLE: ReadonlyArray<Pt> = [
  [20, -154],
  [25, -150],
  [25, -138],
  [23, -134],
  [22, -145],
];

const HAIR_SET = new Set<number>([...HAIR, PAL.brown[3]]);

/**
 * The face plate outline (3/4 view facing right): a long oval with a cheekbone bulge on the far
 * side, a jaw angle beside the earring and a strong chin forward under the mouth.
 */
const FACE_POLY: ReadonlyArray<readonly [number, number]> = [
  [-8, -151],
  [4, -155],
  [15, -154],
  [20, -150],
  [22, -143],
  [23, -136],
  [23, -130],
  [22, -124],
  [21, -119],
  [19, -113],
  [16, -108],
  [13, -105],
  [8, -105],
  [3, -108],
  [-3, -111],
  [-7, -112],
  [-9, -116],
  [-9, -126],
  [-9, -138],
  [-9, -146],
];

/** The face plate: skin-tone enamel, shaded by hand (light from the top-left). */
function facePlate(c: Canvas): void {
  const L = c.layer();
  c.poly(FACE_POLY, FACE[2], L);
  c.put(L);
  const on = (x: number, y: number): boolean => c.at(x, y) === FACE[2];
  const tone = (x: number, y: number, col: Color): void => {
    if (on(x, y)) c.set(x, y, col);
  };
  // Far rim in shade: 1 px at the temple, 2 px down the cheek and the jaw.
  for (let y = -155; y <= -105; y++) {
    let xr = -99;
    for (let x = -9; x <= 24; x++) if (on(x, y)) xr = x;
    if (xr < 0) continue;
    c.set(xr, y, FACE[1]);
    if (y >= -146) tone(xr - 1, y, FACE[1]);
  }
  // Jaw underside in shade.
  for (let x = -9; x <= 22; x++) {
    for (let y = -116; y <= -104; y++) {
      if (on(x, y) && !on(x, y + 1)) c.set(x, y, FACE[1]);
    }
  }
  // Lit forehead (where it shows under the sweep); the face-plate shape gives the cheekbones.
  for (const [x, y] of [
    [5, -147],
    [6, -147],
    [7, -146],
  ] as const)
    tone(x, y, FACE[3]);
  // A high cheekbone catches the light under the outer corner of the near eye.
  for (const [x, y] of [
    [-2, -130],
    [-1, -130],
    [0, -131],
  ] as const)
    tone(x, y, FACE[3]);
  // Near ear (hair tucked behind it): a clean C with a lit rim, the inner fold and the bowl.
  const E = c.layer();
  c.ellipse(-13, -133, 6, 11, FACE[2], E);
  c.put(E);
  if (c.d === 2) {
    hi.faceForm(c);
    return hi.faceDetail(c);
  }
  c.set(-14, -135, FACE[3]);
  c.line(-12, -131, -11, -126, FACE[1]);
  c.rect(-11, -130, 2, 2, FACE[1]);
}

/** Brow columns [x, top y, rows]: thick at the inner head, a high arch, a thin tail. */
const BROW_NEAR: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -139, 1],
  [0, -140, 1],
  [1, -141, 2],
  [2, -142, 2],
  [3, -142, 2],
  [4, -142, 2],
  [5, -141, 2],
  [6, -141, 2],
  [7, -141, 2],
  [8, -141, 2],
  [9, -140, 1],
];
const BROW_FAR: ReadonlyArray<readonly [number, number, number]> = [
  [14, -141, 1],
  [15, -142, 1],
  [16, -143, 2],
  [17, -143, 2],
  [18, -142, 2],
  [19, -141, 1],
  [20, -141, 1],
  [21, -140, 1],
];

/** Brows: strong, dark and arched. `lift` raises them, `drop` lowers the inner heads (stern). */
function brows(c: Canvas, lift: number, drop: number): void {
  if (c.d === 2) return hi.brows(c, lift, drop);
  const draw = (cols: ReadonlyArray<readonly [number, number, number]>, inner: (x: number) => number): void => {
    for (const [x, top, n] of cols) {
      const y0 = top - lift + inner(x);
      for (let i = 0; i < n; i++) c.set(x, y0 + i, n > 1 && i === n - 1 ? PAL.ink[1] : PAL.brown[0]);
    }
  };
  draw(BROW_NEAR, (x) => (x >= 7 ? drop : x >= 5 ? drop >> 1 : 0));
  draw(BROW_FAR, (x) => (x <= 15 ? drop : 0));
}

/** Almond eyes with heavy dark lashes and liner, a little hooded (two rows open). `look` −1 = up. */
function eyesOpen(c: Canvas, look: number, narrow = false): void {
  if (c.d === 2) return hi.eyesOpen(c, look, narrow);
  const up = look < 0;
  const n = narrow ? -135 : -136; // near lash line
  const f = n - 1; // far lash line (the far eye sits a little higher)
  // Near eye (x 0..8): lid crease, the open rows (lid shadow on top), the iris.
  c.line(1, n - 2, 6, n - 2, FACE[1]);
  // The whites: warm grey at the outer corner, bright at the inner corner (by the nose).
  c.line(1, n + 1, 7, n + 1, PAL.stone[3]);
  c.set(7, n + 1, PAL.snow[2]);
  c.line(2, n + 2, 7, n + 2, FACE[3]);
  if (up) {
    c.rect(3, n + 1, 4, 1, PAL.brown[1]);
    c.set(5, n + 1, INK);
  } else {
    // A big warm brown iris, a 1-px pupil and a catchlight.
    c.rect(3, n + 1, 4, 2, PAL.brown[1]);
    c.set(5, n + 1, INK);
    c.set(5, n + 2, INK);
    c.set(4, n + 1, PAL.snow[3]);
  }
  // Heavy lash line (thicker toward the outer corner) with an outer flick, drawn over the iris.
  c.line(0, n, 8, n, INK);
  c.line(0, n - 1, 3, n - 1, INK);
  c.set(-1, n, INK);
  c.set(-2, n - 1, INK);
  // Lower lid: liner on the outer half, a soft smiling lid line on the inner half.
  c.set(1, n + 2, FACE[1]);
  c.line(2, n + 3, 4, n + 3, PAL.brown[1]);
  c.line(5, n + 3, 7, n + 3, FACE[1]);
  c.set(8, n + 1, FACE[1]);
  // Far eye (x 15..20), foreshortened.
  c.line(15, f - 1, 19, f - 1, FACE[1]);
  c.line(15, f + 1, 19, f + 1, PAL.stone[3]);
  c.set(15, f + 1, PAL.snow[2]);
  c.line(16, f + 2, 19, f + 2, FACE[3]);
  c.set(15, f + 2, FACE[1]);
  if (up) {
    c.rect(16, f + 1, 3, 1, PAL.brown[1]);
    c.set(17, f + 1, INK);
  } else {
    c.rect(16, f + 1, 3, 2, PAL.brown[1]);
    c.set(17, f + 1, INK);
    c.set(16, f + 1, PAL.snow[3]);
  }
  c.line(15, f, 20, f, INK);
  c.line(19, f - 1, 20, f - 1, INK);
  c.set(21, f - 1, INK);
  c.line(16, f + 3, 18, f + 3, FACE[1]);
  c.set(19, f + 3, PAL.brown[1]);
}

function eyesClosed(c: Canvas): void {
  if (c.d === 2) return hi.eyesClosed(c);
  c.line(1, -136, 7, -136, FACE[1]);
  c.line(1, -134, 7, -134, INK);
  c.set(0, -135, INK);
  c.set(-1, -135, INK);
  c.set(8, -135, INK);
  c.line(15, -137, 19, -137, FACE[1]);
  c.line(16, -135, 19, -135, INK);
  c.set(15, -136, INK);
  c.set(20, -136, INK);
}

function eyesDizzy(c: Canvas): void {
  if (c.d === 2) return hi.eyesDizzy(c);
  // Small spirals (steel grey irises: she is dazed, not hurt).
  for (const [ex, ey] of [
    [4, -134],
    [17, -135],
  ] as const) {
    c.circle(ex, ey, 2, PAL.snow[2]);
    c.set(ex, ey, INK);
    c.set(ex + 1, ey, INK);
    c.set(ex + 1, ey - 1, INK);
    c.set(ex, ey - 2, INK);
    c.set(ex - 1, ey - 1, INK);
    c.set(ex - 2, ey, INK);
    c.set(ex - 1, ey + 2, INK);
    c.set(ex + 1, ey + 2, INK);
    c.set(ex + 2, ey + 1, INK);
  }
}

/** Nose: straight and long, from the brow heads to a rounded tip; shade on its far flank. */
function nose(c: Canvas): void {
  if (c.d === 2) return hi.nose(c);
  for (const [x, y] of [
    [13, -136],
    [13, -135],
    [13, -134],
    [14, -133],
    [14, -132],
    [14, -131],
    [15, -130],
    [15, -129],
    [16, -128],
    [16, -127],
    [16, -126],
    [16, -125],
    [13, -124],
    [14, -124],
    [15, -124],
    [11, -126],
    [10, -125],
  ] as const)
    c.set(x, y, FACE[1]);
  for (const [x, y] of [
    [12, -133],
    [13, -131],
    [13, -130],
    [14, -128],
    [15, -126],
  ] as const)
    c.set(x, y, FACE[3]);
  c.set(11, -124, FACE[0]);
  c.set(12, -124, FACE[1]);
}

/** Mouth: deep red lips. kind 0 smile (closed, the far corner higher), 1 flat, 2 shout, 3 wobbly. */
function mouth(c: Canvas, kind: number): void {
  if (c.d === 2) return hi.mouth(c, kind);
  const LIP_D = PAL.red[1];
  const LIP = PAL.red[2];
  if (kind === 2) {
    // A firm open "GESLOTEN!": an even mouth, the upper teeth, stern but not a scream.
    c.b.ellipse(c.X(9), c.Y(-121), 11, 5, INK);
    c.line(10, -121, 18, -121, LIP_D);
    c.line(9, -120, 19, -120, LIP_D);
    c.line(11, -119, 17, -119, PAL.snow[2]);
    c.line(10, -116, 18, -116, LIP_D);
    c.line(10, -115, 18, -115, LIP);
    c.line(11, -114, 17, -114, LIP);
    c.set(13, -115, PAL.red[3]);
    c.set(7, -120, FACE[1]);
    c.set(7, -119, FACE[1]);
    return;
  }
  if (kind === 1 || kind === 3) {
    for (let x = 8; x <= 19; x++) {
      const w = (kind === 3 ? (x % 4 < 2 ? 0 : 1) : 0) - (x >= 16 ? 1 : 0);
      c.set(x, -118 + w, LIP_D);
      if (x >= 9 && x <= 18) c.set(x, -117 + w, LIP);
    }
    return;
  }
  // The closed confident smile: a shallow U seam, both corners turn up, the far corner higher.
  const seam = (x: number): number => (x <= 8 ? -118 : x <= 15 ? -117 : x <= 18 ? -118 : -119);
  for (let x = 8; x <= 19; x++) c.set(x, seam(x), PAL.red[0]);
  for (let x = 9; x <= 19; x++) c.set(x, seam(x) - 1, LIP_D);
  for (let x = 13; x <= 16; x++) c.set(x, seam(x) - 2, LIP_D);
  for (let x = 9; x <= 18; x++) c.set(x, seam(x) + 1, x === 9 || x === 18 ? LIP_D : LIP);
  for (let x = 10; x <= 16; x++) c.set(x, seam(x) + 2, x === 10 || x === 16 ? LIP_D : LIP);
  c.set(12, -116, PAL.red[3]);
  c.set(13, -116, PAL.red[3]);
  c.set(7, -119, FACE[1]);
  c.set(20, -120, FACE[1]);
  // The smile lines (one curve from the nose wing on the near side, a crease on the far side)
  // and the chin crease.
  for (const [x, y] of [
    [9, -124],
    [8, -123],
    [7, -122],
    [6, -121],
    [6, -120],
    [21, -121],
  ] as const)
    c.set(x, y, FACE[1]);
  c.line(12, -112, 14, -112, FACE[1]);
}

/** The round gold disc earring with a centre hole, on a short gold bar. */
function earring(c: Canvas): void {
  if (c.d === 2) return hi.earring(c);
  c.line(-11, -122, -11, -118, PAL.gold[1]);
  c.line(-10, -122, -10, -118, PAL.gold[0]);
  c.set(-11, -122, PAL.gold[2]);
  const [x, y] = [-11, -114];
  c.circle(x, y, 3, PAL.gold[1]);
  for (const [dx, dy] of [
    [-2, -2],
    [-1, -3],
    [-3, -1],
    [0, -3],
    [-3, 0],
  ] as const)
    c.set(x + dx, y + dy, PAL.gold[2]);
  c.set(x - 2, y - 2, PAL.gold[3]);
  for (const [dx, dy] of [
    [2, 2],
    [1, 3],
    [3, 1],
    [3, 0],
    [0, 3],
  ] as const)
    c.set(x + dx, y + dy, PAL.gold[0]);
  c.set(x, y, INK);
  c.set(x - 1, y, PAL.gold[0]);
  c.set(x, y - 1, PAL.gold[0]);
}

/** The steel skull under the wig (frames 4 and 5). */
function skull(c: Canvas, front: boolean): void {
  const L = c.layer();
  if (front) {
    // The cap over the forehead (the seam where the wig's hairline was), two rivets.
    const seam = (x: number): number => -150 - Math.round((x - 4) / 7);
    c.ellipse(-16, -164, 39, 34, METAL[2], L);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (Math.round(c.ly(y)) > seam(Math.round(c.lx(x)))) L.set(x, y, 0);
    c.shade(L, -16, -164, 39, 20, METAL);
    c.put(L);
    for (let x = -12; x <= 20; x++) {
      const y = seam(x);
      if (c.at(x, y) === METAL[2] || c.at(x, y) === METAL[1] || c.at(x, y) === METAL[3]) c.set(x, y, METAL[0]);
    }
    for (const x of [-8, 15]) rivet(c, x, seam(x) - 4, METAL);
    c.set(-6, -160, METAL[4]);
    c.set(-5, -160, METAL[4]);
    if (c.d === 2) hi.skullFront(c, seam);
  } else {
    // The back of the skull, behind the face plate.
    c.ellipse(-17, -160, 30, 40, METAL[2], L);
    c.shade(L, -17, -160, 30, 40, METAL);
    c.put(L);
    c.line(-14, -136, -8, -136, METAL[0]);
    if (c.d === 2) hi.skullBack(c);
  }
}

/** Head frames: 0 smile, 1 hatch open (looks up), 2 shout, 3 blink / powered off (eyes shut, smile kept), 4 bald + off, 5 bald + dizzy. */
function headFrame(f: number, state: number, d = 1): Frame {
  const c = canvas(d);
  const bald = f >= 4;
  if (bald) skull(c, false);
  else hairBack(c, 0);
  facePlate(c);
  if (f === 0) {
    brows(c, 0, 0);
    eyesOpen(c, 0);
    mouth(c, 0);
  } else if (f === 1) {
    brows(c, 1, 0);
    eyesOpen(c, -1);
    mouth(c, 0);
  } else if (f === 2) {
    brows(c, 0, 2);
    eyesOpen(c, 0, true);
    mouth(c, 2);
  } else if (f === 5) {
    brows(c, 1, 0);
    eyesDizzy(c);
    mouth(c, 3);
  } else {
    // Frame 3 is also the idle blink (mayor.ts): only the eyes change, the smile stays.
    brows(c, 0, 0);
    eyesClosed(c);
    mouth(c, f === 3 ? 0 : 1);
  }
  nose(c);
  if (bald) skull(c, true);
  else hairFront(c, 0, f === 1 ? 1 : 0);
  earring(c);
  if (state > 0) {
    // Scuffs on the wig and the skull only: the face plate keeps its features (a few clean
    // hairline panel seams instead), so the likeness stays dignified when she is hurt.
    const keep = c.b.clone();
    scuffs(c, -30, -164, 58, 60, state, 31);
    const face = c.layer();
    c.poly(FACE_POLY, FACE[2], face);
    for (let i = 0; i < face.data.length; i++) if ((face.data[i] & 255) !== 0) c.b.data[i] = keep.data[i];
    c.b.touch();
    const crack = (pts: ReadonlyArray<readonly [number, number]>): void => {
      if (c.d === 2) return hi.crack(c, pts);
      for (const [x, y] of pts) if (FACE.includes(c.at(x, y))) c.set(x, y, PAL.steel[1]);
      const [lx, ly] = pts[0];
      if (FACE.includes(c.at(lx - 1, ly))) c.set(lx - 1, ly, FACE[3]);
    };
    crack([
      [17, -149],
      [16, -148],
      [16, -147],
      [15, -146],
    ]);
    if (state > 1) {
      crack([
        [-8, -129],
        [-8, -128],
        [-7, -127],
      ]);
      crack([
        [21, -122],
        [20, -121],
      ]);
      crack([[14, -149]]);
    }
  }
  return c.frame(true);
}

/** The wig alone (death: it flies off). Anchor = local (−6, −128), where mayor.ts launches it. */
function wigFrame(d = 1): Frame {
  const c = canvas(d);
  hairBack(c, 0);
  // The inside of the wig where the face was.
  const L = c.layer();
  c.poly(FACE_POLY, PAL.ink[1], L);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if ((L.get(x, y) & 255) !== 0 && (c.b.get(x, y) & 255) !== 0) c.b.set(x, y, hash2(x, y, 5) < 0.5 ? HAIR[0] : PAL.ink[1]);
  hairFront(c, 0, 0);
  const fr = c.frame(true);
  const ox = -6 - c.x0;
  const oy = -128 - c.y0;
  return d === 1 ? { buf: fr.buf, ox, oy } : { buf: fr.buf, ox, oy, density: d };
}

/** Wig flight frames: the wig turned in 8 steps of 45° about its middle (PixelBuffer.rotated). */
export const WIG_STEPS = 8;
function wigFrames(d = 1): Frame[] {
  const raw = wigFrame(d);
  // Crop to whole logical pixels first, so both densities turn about the same middle.
  const b = raw.buf.trimBounds() ?? { x: 0, y: 0, w: d, h: d };
  const x0 = Math.floor(b.x / d) * d;
  const y0 = Math.floor(b.y / d) * d;
  const cw = Math.ceil((b.x + b.w) / d) * d - x0;
  const ch = Math.ceil((b.y + b.h) / d) * d - y0;
  const cropped = raw.buf.crop(x0, y0, cw, ch);
  const base: Frame = d === 1 ? { buf: cropped, ox: raw.ox - x0, oy: raw.oy - y0 } : { buf: cropped, ox: raw.ox - x0 / d, oy: raw.oy - y0 / d, density: d };
  const out: Frame[] = [base];
  // 1×: a 2-px clear margin round each turned frame, so the 2× twin (its own rounding) fits inside.
  const m = d === 1 ? 2 : 0;
  const w = base.buf.w / d;
  const h = base.buf.h / d;
  for (let k = 1; k < WIG_STEPS; k++) {
    const a = (k * Math.PI) / 4;
    const rot = base.buf.rotated(a, { align: d });
    const buf = m > 0 ? rot.padded(m) : rot;
    const rx = base.ox - w / 2;
    const ry = base.oy - h / 2;
    const ox = Math.round(rot.w / d / 2 + m + rx * Math.cos(a) - ry * Math.sin(a));
    const oy = Math.round(rot.h / d / 2 + m + rx * Math.sin(a) + ry * Math.cos(a));
    out.push(d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d });
  }
  return out;
}

/** A coil spring `h` px tall (bottom anchor). */
function springFrame(h: number, d = 1): Frame {
  const c = canvas(d);
  if (c.d === 2) {
    hi.spring(c, h);
    return c.frame(true);
  }
  for (let y = 0; y < h; y++) {
    const s = Math.sin((y / Math.max(4, h)) * Math.PI * 5);
    const x = Math.round(s * 5);
    c.rect(x - 1, -y - 1, 3, 1, Math.cos((y / Math.max(4, h)) * Math.PI * 5) > 0 ? SILVER[3] : SILVER[1]);
  }
  return c.frame(true);
}

// ---------------------------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------------------------

// Every strip has a 2× twin for mission ams (docs/ART_GUIDE.md "2x art (mission ams)"): the
// same recipe on a density-2 canvas, with finer details drawn by art-hi.ts.
const LEGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
defineSprite(`${ART}/legs`, () => LEGS.map((f) => legsFrame(f)), { trim: true, hi: () => LEGS.map((f) => legsFrame(f, 2)) });
for (const s of [0, 1, 2] as const) {
  defineSprite(`${ART}/body-${s}`, () => bodyFrame(s), { trim: true, hi: () => [bodyFrame(s, 2)] });
  const arm = (d: number): Frame[] => Array.from({ length: ARM_FRAMES * 2 }, (_, f) => stampArmFrame(f % ARM_FRAMES, s, f >= ARM_FRAMES, d));
  defineSprite(`${ART}/stamp-arm-${s}`, () => arm(1), { trim: true, hi: () => arm(2) });
  defineSprite(`${ART}/chain-${s}`, () => chainFrame(s), { trim: true, hi: () => [chainFrame(s, false, 2)] });
  defineSprite(`${ART}/medallion-${s}`, () => [0, 1, 2].map((f) => medallionFrame(f, s)), { trim: true, hi: () => [0, 1, 2].map((f) => medallionFrame(f, s, 2)) });
  defineSprite(`${ART}/head-${s}`, () => [0, 1, 2, 3, 4, 5].map((f) => headFrame(f, s)), { trim: true, hi: () => [0, 1, 2, 3, 4, 5].map((f) => headFrame(f, s, 2)) });
}
const ARM_BACK = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
defineSprite(`${ART}/arm-back`, () => ARM_BACK.map((f) => armBackFrame(f)), { trim: true, hi: () => ARM_BACK.map((f) => armBackFrame(f, 2)) });
defineSprite(`${ART}/stamp-arm-gone`, () => stampStump(), { trim: true, hi: () => [stampStump(2)] });
defineSprite(`${ART}/chain-gone`, () => chainFrame(2, true), { trim: true, hi: () => [chainFrame(2, true, 2)] });
defineSprite(`${ART}/wig`, () => wigFrames(1), { hi: () => wigFrames(2) });
defineSprite(`${ART}/spring`, () => [6, 14, 22, 30].map((h) => springFrame(h)), { trim: true, hi: () => [6, 14, 22, 30].map((h) => springFrame(h, 2)) });

/** A soft floor shadow (the stamp target and the stomp landing): 56 and 52 px wide. */
function shadowFrame(w: number, d: number): Frame {
  const c = new DCanvas(-w / 2, -4, w / 2, 4, d);
  // A red warning rim round the dark core so the target reads on grass, brick and paving.
  c.b.ellipse(0, 0, w * d, 9 * d, PAL.red[2]);
  c.b.ellipse(2 * d, 1 * d, (w - 4) * d, 7 * d, PAL.ink[1]);
  c.b.ellipse(4 * d, 2 * d, (w - 8) * d, 5 * d, INK);
  return d === 1 ? { buf: c.b, ox: c.X(0), oy: c.Y(0) } : { buf: c.b, ox: w / 2, oy: 4, density: d };
}
defineSprite(`${ART}/shadow`, () => [56, 52].map((w) => shadowFrame(w, 1)), { hi: () => [56, 52].map((w) => shadowFrame(w, 2)) });

/** The lashing chain: 160 px of links with enamel shields, root at the anchor; 2 frames. */
function lashFrame(p: number, d: number): Frame {
  const c = new DCanvas(0, -5, 164, 5, d);
  chainBand(c, curvePts((t) => [t * 158, Math.sin((t * 158 + p * 6) / 7) * 1.5], 320), p);
  for (let x = 20; x < 150; x += 26) {
    const k = (x / 26) | 0;
    chainShield(c, x, Math.round(Math.sin((x + p * 6) / 7) * 1.5), ENAMEL[k % 4]);
  }
  // The tip: a big red shield.
  if (d === 2) hi.lashTip(c);
  else {
    c.rect(156, -4, 8, 8, SILVER[3]);
    c.rect(157, -3, 6, 6, PAL.red[2]);
    c.set(160, 0, PAL.snow[3]);
  }
  return c.frame(true);
}
defineSprite(`${ART}/lash`, () => [0, 1].map((p) => lashFrame(p, 1)), { ticksPerFrame: 2, hi: () => [0, 1].map((p) => lashFrame(p, 2)) });
