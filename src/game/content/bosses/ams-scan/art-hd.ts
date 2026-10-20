/**
 * The parking scan car — the UHD art (docs/ART_GUIDE.md "UHD art"): ONE density-generic drawer per
 * strip makes its 2× and 4× frames natively with the HD kit (lit height fields and primitives,
 * PAL_HD ramps, the key light from the upper left, a cool bounce, ambient occlusion, rim light,
 * outline A for everything that moves or can be hit; the glass and the lettering are inner layers
 * without an outline). Never the 1× art scaled.
 *
 * Every frame is drawn in the strip's LOCAL logical coordinates (geometry.ts; the car's anchor is
 * the floor point under its middle) on an `HdPiece` sized from the 1× frame of the same strip and
 * index, and the shapes come from shape.ts (the same predicates as the 1× art), so each HD frame
 * has exactly its 1× frame's logical size and anchor.
 *
 * Look: glossy white paint over a lit body volume (rolled edges round the profile, the arches and
 * the glass, a sharp shoulder crease under the windows, the lower doors tucking under towards the
 * black sill), panel and bonnet shut lines, the red livery painted on the same volume, black
 * glossy pillars, textured black arch trims, a slim LED headlight in a chrome rim, a black grille
 * with a thin chrome bar and a plain emblem, yellow plates, the red tail light, mirror and handles;
 * dark tinted glass with sky reflections, the handhaver's silhouette with his cap; the big white
 * scanner box (a rounded slab, smoked camera windows that glow red while scanning, a slanted seam)
 * on a black rack; silver multi-spoke alloys in black tyres.
 */
import type { Color } from '../../../../engine/color';
import { getFont, type Glyph } from '../../../../engine/font';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import { HdCanvas, polyDist, type RenderOpts, type TexSample } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { HdPiece, geomOf } from '../ams/canvas';
import { crackAt, dents, DRIVER_EXPR, glintAt, scuffs, sootAt, SPOKES, SPOKE_TURN } from './art';
import { ID, SCAN } from './geometry';
import {
  bandPart,
  barAt,
  beltY,
  boxLocal,
  camAt,
  inBand,
  inBody,
  inCross,
  inGlass,
  inRack,
  inShell,
  inSill,
  inStripe,
  inTrim,
  inWell,
  shellEdge,
  wheelDist,
} from './shape';

const R = PAL_HD;

/** Sprites: outline A (style decision), AO where parts meet, the thin cool rim. */
const RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };
/** Inner layers (the glass, the lettering): no outline. */
const INNER: RenderOpts = { outline: 'none', ao: 0.2, rimLight: 0 };

/** The 1× frame i of a strip (the HD frame's geometry). */
function lo(id: string, i = 0): Frame {
  return getFrames(id, 1)[i];
}

/** A rolled edge: height over distance e from an edge with roll radius r. */
function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

// ---------------------------------------------------------------------------------------------
// The car body
// ---------------------------------------------------------------------------------------------

/** Distance along x / y to the nearest seam line (continuous): door shut lines, bonnet, tailgate. */
function seamDist(x: number, y: number): number {
  const S = SCAN;
  let e = 9;
  const belt = beltY(x);
  if (y > belt + 0.3) {
    // The rear door's rear edge stops at the arch trim; the B seam and the front door's front edge run to the sill.
    if (y < S.wheelCY - 8.6) e = Math.min(e, Math.abs(x - S.seams[0]));
    if (y < S.sill[0]) e = Math.min(e, Math.abs(x - S.seams[1]), Math.abs(x - S.seams[2]));
  }
  // The bonnet shut line: from the windscreen base along the wing to the headlight.
  if (x > 22 && x < 35.6) {
    const yb = -18.2 + (x - 22) * 0.16;
    e = Math.min(e, Math.abs(y - yb) + (x < 22.6 ? 0.6 - (x - 22) : 0));
  }
  // The tailgate shut line near the rear end.
  if (y > -22 && y < -8) e = Math.min(e, Math.abs(x - (-42.6 + (y + 22) * 0.02)));
  return e;
}

export function bodyHd(state: 0 | 1 | 2, d: number): Frame {
  const S = SCAN;
  const p = new HdPiece(geomOf(lo(ID.body[state])), d);
  const paint = p.material({ ramp: R.snow, lo: 2, hi: 5, spec: 0.8, shine: 42, wrap: 0.06, rim: 0.3, bounce: 0.3 });
  const red = p.material({ ramp: R.red, lo: 4, hi: 6, spec: 0.7, shine: 40, wrap: 0.06 });
  const black = p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.55, shine: 30, wrap: 0.05 });
  const plastic = p.material({ ramp: R.black, lo: 0, hi: 4, spec: 0.2, shine: 12, wrap: 0.05 });
  const well = p.material({ ramp: R.black, lo: 0, hi: 2, spec: 0.05, amb: 0 });
  const tail = p.material({ ramp: R.red, lo: 3, hi: 7, spec: 1, shine: 60 });
  const lamp = p.material({ ramp: R.glass, lo: 3, hi: 5, spec: 1, shine: 70 });
  const chrome = p.material({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 44, rim: 0.4, gain: 1.1 });
  const plate = p.material({ ramp: R.gold, lo: 4, hi: 6, spec: 0.5, shine: 30 });
  const ds = dents(state);
  const sc = scuffs(state);
  // 1. The body shell: one painted volume; the livery is the same volume in red.
  p.field(S.canvas.x0, S.canvas.y0, S.canvas.x1 - S.canvas.x0 + 1, S.canvas.y1 - S.canvas.y0 + 1, (x, y) => {
    if (!inBody(x, y) || inBand(x, y) || inSill(x, y) || inTrim(x, y)) return NaN;
    const r = wheelDist(x, y);
    const e = Math.min(polyDist(x, y, S.profile), r - S.trimR + 0.4);
    let h = roll(e, 2.4);
    // The glass edge: the panel folds in under the window seal.
    h -= Math.max(0, 0.9 - polyDist(x, y, S.band)) * 0.6;
    // The shoulder crease just under the windows, and the waist below it.
    const sb = y - beltY(x);
    if (x > -41.5 && x < 21) h += 0.75 * Math.exp(-(((sb - 1.6) / 0.75) ** 2)) - 0.25 * Math.exp(-(((sb - 3.2) / 1.2) ** 2));
    // The lower doors tuck under towards the sill; the nose turns away.
    if (y > -9.5) h -= (y + 9.5) * 0.42;
    if (x > 39) h -= (x - 39) * 0.35;
    // Dents.
    for (const [dx, dy] of ds) {
      const q = ((x - dx) ** 2 + (y - dy) ** 2) / 1.6;
      if (q < 5) h -= 0.8 * Math.exp(-q);
    }
    if (state === 2) {
      // The bonnet buckles up into a ridge.
      const k = Math.exp(-(((x - 31) / 3.2) ** 2)) * Math.exp(-(((y + 16.8) / 0.9) ** 2));
      h += k * 1.4;
    }
    return h;
  }, {
    mat: paint,
    z: 0,
    tex: p.tex((s: TexSample) => {
      const { x, y } = s;
      if (barAt(x, y) >= 0 || inStripe(x, y) || inCross(x, y, 0.42)) s.mat = red;
      // Shut lines: a dark groove with a lit lip on its lower side at 4×.
      const se = seamDist(x, y);
      if (se < 0.2) s.tone -= 0.9;
      else if (se < 0.45 && s.d >= 4) s.tone += 0.12;
      // Road dust along the sill, a little on the lower doors.
      if (y > -6.5) s.tone -= (y + 6.5) * 0.06;
      if (state >= 1) {
        for (const [x0, y0, x1, y1] of sc) {
          const vx = x1 - x0;
          const vy = y1 - y0;
          const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy)));
          const q = Math.hypot(x - x0 - vx * t, y - y0 - vy * t);
          if (q < 0.22 && barAt(x, y) >= 0) s.fix = t * 7 % 2 < 1 ? R.snow[5] : R.red[6];
        }
      }
      if (state === 2) {
        const q = sootAt(x, y) * (0.75 + 0.5 * hash2(Math.floor(x * 1.5), Math.floor(y * 1.5), 7));
        if (q > 0.15) s.tone -= q * 1.6;
        // The gap under the buckled ridge.
        if (Math.abs(y - (-16.1 + (x - 28) * 0.05)) < 0.18 && x > 28 && x < 34.5) s.fix = R.ink[1];
      }
    }),
  });
  // 2. The window band's black pillars (the glass is a hole: the cabin strip covers it).
  p.field(-43, -28, 66, 12, (x, y) => {
    const part = bandPart(x, y);
    if (part !== 'pillar' && part !== 'apillar') return NaN;
    return roll(polyDist(x, y, S.band), 0.8) * 0.6 + 0.2;
  }, { mat: black, z: -0.4 });
  // 3. Wheel wells, the textured black arch trims, the sill and the lower bumpers.
  p.field(-36, -16, 72, 15, (x, y) => (inWell(x, y) ? -(S.archR - wheelDist(x, y)) * 0.4 - 1.2 : NaN), { mat: well, z: -3 });
  p.field(-37, -17, 74, 16, (x, y) => {
    if (!inTrim(x, y)) return NaN;
    const r = wheelDist(x, y);
    return Math.sqrt(Math.max(0, 0.25 - (r - (S.archR + S.trimR) / 2) ** 2)) * 1.6 + 0.4;
  }, {
    mat: plastic,
    z: 0.6,
    tex: (s) => {
      if (s.d >= 4 && hash2(s.X, s.Y, 11) > 0.8) s.tone -= 0.12;
    },
  });
  p.field(S.canvas.x0, -8, S.canvas.x1 - S.canvas.x0 + 1, 7, (x, y) => {
    if (!inSill(x, y)) return NaN;
    return roll(Math.min(polyDist(x, y, S.profile), y - S.sill[0] + 0.5), 0.7) * 0.8;
  }, {
    mat: plastic,
    z: 0.3,
    tex: (s) => {
      if (s.d >= 4 && hash2(s.X, s.Y, 13) > 0.82) s.tone -= 0.12;
    },
  });
  // 4. Lamps: the tail light round the rear corner, the slim swept LED headlight in a chrome rim,
  //    the grille with its chrome bar and a plain emblem, the fog lamp, the plates.
  p.field(-45, -24, 4, 8, (x, y) => (x < -42 && y > -23 && y < -16.5 && inBody(x, y) ? roll(Math.min(-42 - x + 0.6, y + 23, -16.5 - y), 0.9) : NaN), { mat: tail, z: 1 });
  p.poly([[35.2, -16.9], [40.4, -15.9], [42, -14.4], [41.4, -13.8], [37.6, -14.8]], { mat: chrome, z: 1 });
  p.poly([[35.8, -16.4], [40.2, -15.5], [41.4, -14.4], [37.8, -15.1]], { mat: lamp, z: 1.3 });
  p.paint(35.8, -16.6, 6, 2.4, (x, y) => (Math.abs(y - (-16 + (x - 36) * 0.24)) < 0.17 && x < 40.6 ? R.snow[6] : 0), 2);
  p.box(41.7, -12.6, 2.4, 4.3, { mat: black, z: 0.8, r: 0.6, bevel: 0.7 });
  p.box(41.8, -11.3, 2.3, 0.55, { mat: chrome, z: 1.2, r: 0.2 });
  p.ell(43, -10.2, 0.55, 0.55, { mat: chrome, z: 1.4 });
  p.ell(41.6, -5.4, 0.75, 0.55, { mat: lamp, z: 1 });
  p.box(43.1, -8.3, 0.9, 2.6, { mat: plate, z: 1.2, r: 0.2, bevel: 0.3 });
  p.box(-44.2, -12.4, 0.9, 2.8, { mat: plate, z: 1.2, r: 0.2, bevel: 0.3 });
  p.paint(-44.2, -12.4, 0.9, 0.6, () => R.sky[1], 2);
  // 5. The mirror on its arm, the door handles, the city emblem by the rear arch.
  const [mx, my] = S.mirror;
  const md = state === 2 ? 1.1 : 0;
  p.cap(mx - 1.6, my + 0.9, mx - 0.4, my + 0.4 + md * 0.5, 0.35, 0.3, { mat: black, z: 2 });
  p.ell(mx + 0.3, my + md, 1.7, 1.15, { mat: black, z: 2.3 });
  for (const [hx, hy] of S.handles) p.cap(hx + 0.4, hy + 0.5, hx + 1.7, hy + 0.5, 0.38, 0.38, { mat: black, z: 1.2 });
  const [ex, ey] = S.emblem;
  p.ell(ex, ey, 1.05, 0.95, { mat: red, z: 0.8 });
  p.paint(ex - 1, ey - 1, 2, 2, (x, y) => (Math.abs(x - ex) < 0.22 && Math.abs(y - ey) < 0.55 ? R.snow[6] : 0), 2);
  if (state === 2) {
    // The front bumper's tip hangs.
    p.poly([[40.4, -7.2], [44.1, -6.2], [44.3, -1.6], [41, -2.4]], { mat: plastic, z: 1.6 });
  }
  return p.frame(RENDER);
}

// ---------------------------------------------------------------------------------------------
// The cabin (the tinted glass; drawn over the body's glass holes, no outline)
// ---------------------------------------------------------------------------------------------

/** The glass colour at (x, y) (no interior): sky reflection on the windscreen, tinted side glass. */
function glassAt(x: number, y: number): Color {
  if (bandPart(x, y) === 'screen') {
    const t = (y + 26.5) / 7.6;
    return t < 0.3 ? R.sky[6] : t < 0.65 ? R.sky[5] : R.glass[5];
  }
  const g = glintAt(x, y, 0.8);
  if (g === 0) return R.glass[4];
  if (g === 1) return R.glass[3];
  const belt = beltY(x);
  if (y < -25.6) return R.glass[3];
  if (y > belt - 1) return R.glass[1];
  return R.glass[2];
}

export function cabinHd(frame: number, d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.cabin, frame)), d);
  const K = SCAN.cabCanvas;
  const look = DRIVER_EXPR[frame];
  const [hx, hy] = SCAN.driverAt;
  // The driver (local: the cap's top-left at hx, hy): head centre, cap, shoulders.
  const hcx = hx + 3.4;
  const hcy = hy + 3.6;
  const driver = (x: number, y: number): Color => {
    if (!look) return 0;
    // The steering wheel rim (a dark ellipse seen edge-on).
    const wq = Math.hypot((x - (hx + 8.6)) / 0.9, (y - (hy + 4.4)) / 2.2);
    if (wq < 1 && wq > 0.45) return R.black[1];
    // The cap: crown and the peak forward.
    if (y >= hy && y < hy + 2.1 && x >= hx + 0.4 && x < hx + 6.2) return y < hy + 0.6 ? R.navy[3] : R.navy[1];
    if (y >= hy + 1.4 && y < hy + 2.1 && x >= hx + 6.2 && x < hx + 7.6) return R.navy[0];
    // The head: a dark silhouette with a dim face towards the front.
    const q = Math.hypot((x - hcx) / 2.6, (y - hcy) / 2.4);
    if (q < 1 && y >= hy + 2) {
      if (look === 'shout' && Math.hypot(x - (hcx + 1.9), y - (hcy + 0.9)) < 0.55) return R.red[2];
      if (look === 'shock' && Math.hypot(x - (hcx + 1.6), y - (hcy - 0.5)) < 0.42) return R.snow[5];
      if (x > hcx + 0.6) return q < 0.7 ? R.brown[2] : R.brown[1];
      return x < hcx - 1.6 ? R.ink[1] : R.hairA[1];
    }
    // The ear.
    if (Math.hypot(x - (hcx - 0.6), y - (hcy + 0.3)) < 0.6) return R.brown[1];
    // Shoulders and the collar.
    if (y >= hy + 5 && x >= hx - 2 && x < hx + 8 && y < hy + 7.4) return y < hy + 5.6 && x > hx + 1 ? R.navy[3] : R.navy[1];
    // Shock: a raised hand.
    if (look === 'shock' && Math.hypot((x - (hx + 6.6)) / 0.8, (y - (hy + 1.6)) / 1.2) < 1) return R.brown[2];
    return 0;
  };
  p.paint(K.x0, K.y0, K.x1 - K.x0 + 1, K.y1 - K.y0 + 1, (x, y) => {
    if (!inGlass(x, y)) return 0;
    if (bandPart(x, y) === 'screen') {
      // The parking permit behind the windscreen's foot.
      const [px, py] = SCAN.permit;
      if (Math.abs(x - px) < 0.8 && Math.abs(y - py) < 0.5) return Math.abs(y - py) < 0.15 ? R.green[4] : R.snow[5];
      return glassAt(x, y);
    }
    const g = glintAt(x, y, 0.8);
    // The rear headrests.
    if (Math.hypot((x + 15.5) / 1.6, (y + 22.4) / 1.4) < 1 || (x > -17.1 && x < -13.9 && y > -22.4 && y < -20.6)) return g === 0 ? R.glass[2] : R.black[1];
    const dv = driver(x, y);
    if (dv !== 0) return g === 0 ? R.glass[3] : dv;
    return glassAt(x, y);
  });
  if (look === 'airbag') {
    // The airbag: a big soft white cushion in his face (lit, behind the glass glare).
    const bag = p.material({ ramp: R.cloth, lo: 3, hi: 6, spec: 0.2, wrap: 0.25 });
    p.ell(hx + 8.4, hy + 3.4, 2.8, 2.6, { mat: bag, z: 4, tex: p.tex((s) => {
      if (Math.abs(s.x - (hx + 7.6) + (s.y - (hy + 3.4)) * 0.45) < 0.18) s.tone -= 0.35;
    }) });
  }
  p.erase(K.x0, K.y0, K.x1 - K.x0 + 1, K.y1 - K.y0 + 1, (x, y) => !inGlass(x, y));
  return p.frame(INNER);
}

// ---------------------------------------------------------------------------------------------
// The scanner box and its rack
// ---------------------------------------------------------------------------------------------

const pt: [number, number] = [0, 0];

function rackHd(p: HdPiece, bent: boolean): void {
  const black = p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.4, shine: 20 });
  p.field(-34, -35, 40, 7, (x, y) => {
    if (!inRack(x, y, bent)) return NaN;
    return 0.5 + (y < SCAN.scanner.bar[2] + 0.6 ? 0.3 : 0);
  }, { mat: black, z: 0 });
}

export function scannerHd(state: 0 | 1 | 2, frame: number, d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.scanner[state], frame)), d);
  const K = SCAN.scanner;
  const rise = K.rise[frame];
  const scanning = frame === 3;
  const askew = state === 2;
  const shell = p.material({ ramp: R.snow, lo: 2, hi: 5, spec: 0.6, shine: 34, wrap: 0.06, rim: 0.3 });
  const smoke = p.material({ ramp: R.glass, lo: 0, hi: 3, spec: 1, shine: 70 });
  const glow = p.material({ ramp: [R.red[3], R.red[5], R.red[6], R.red[7], R.pink[6]], flat: true, lo: 0, hi: 4 });
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 1, shine: 34, rim: 0.4 });
  rackHd(p, false);
  if (rise > 0) {
    for (const sx of K.struts) p.cyl(sx, K.bar[2] - rise - 0.4, 1.2, rise + 0.6, { mat: steel, z: -0.2, axis: 'v' });
  }
  p.field(-36, -43, 46, 13, (x, y) => {
    const [u, v] = boxLocal(x, y, rise, askew, pt);
    if (!inShell(u, v)) return NaN;
    let h = roll(shellEdge(u, v), 1.5) + 0.3;
    // The top face bows up; the slanted front end turns forward.
    if (v < -36.6) h += (-36.6 - v) * 0.5;
    if (u > 4) h -= (u - 4) * 0.25;
    if (state >= 1 && Math.hypot(u + 7.5, v + 36.5) < 1.1) h -= 0.5 * (1.1 - Math.hypot(u + 7.5, v + 36.5));
    // The camera windows sit in shallow recesses.
    if (camAt(u, v) >= 0) h -= 0.25;
    return h;
  }, {
    mat: shell,
    z: 1,
    tex: p.tex((s) => {
      const [u, v] = boxLocal(s.x, s.y, rise, askew, pt);
      const cam = camAt(u, v);
      if (cam >= 0) {
        if (crackAt(u, v, state)) {
          s.fix = scanning ? R.gold[6] : R.snow[5];
          return;
        }
        if (scanning) {
          s.mat = glow;
          const [x0, x1, y0, y1] = cam < 2 ? K.windows[cam] : [4.8, 7.2, -37.4, -34.2];
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          // The glow is hottest in the middle of the window.
          s.tone = 0.48 - Math.hypot((u - cx) / ((x1 - x0) / 2), (v - cy) / ((y1 - y0) / 2)) * 0.55;
        } else {
          s.mat = smoke;
          // A sky reflection along the top of the smoked glass.
          if (cam < 2 && v < K.windows[cam][2] + 0.5) s.tone += 0.5;
        }
        return;
      }
      // The slanted seam behind the front end and the shut line low on the shell.
      const [tx, bx] = K.seam;
      const sx = tx + (bx - tx) * ((v + 38) / 6);
      if (Math.abs(u - sx) < 0.2) s.tone -= 0.85;
      if (Math.abs(v - (K.shut - 0.5)) < 0.15 && s.d >= 4) s.tone -= 0.5;
      if (state === 2) {
        const q = Math.max(0, 1 - Math.hypot((u + 29) / 5, (v + 34) / 3));
        if (q > 0.1) s.tone -= q * (1.1 + 0.4 * hash2(Math.floor(u * 2), Math.floor(v * 2), 3));
      }
    }),
  });
  return p.frame(RENDER);
}

export function scannerGoneHd(d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.scannerGone)), d);
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 1, shine: 34, rim: 0.4 });
  const wire = p.material({ ramp: R.red, lo: 3, hi: 6, spec: 0.5 });
  const wire2 = p.material({ ramp: R.gold, lo: 3, hi: 6, spec: 0.5 });
  const shell = p.material({ ramp: R.snow, lo: 2, hi: 5, spec: 0.6, shine: 34 });
  rackHd(p, true);
  // Sheared strut stubs with jagged tops, a dangling wire, a shard of the shell on the bar.
  for (const sx of SCAN.scanner.struts) p.poly([[sx, -32], [sx, -33.4], [sx + 0.5, -34.2], [sx + 0.8, -33.2], [sx + 1.2, -33.8], [sx + 1.2, -32]], { mat: steel, z: 0.4 });
  p.stroke([[-5.4, -33.4], [-4.6, -32.2], [-4.2, -30.8], [-3.4, -29.6]], 0.28, 0.24, { mat: wire, z: 1 });
  p.stroke([[-5.8, -33.2], [-5.4, -31.6], [-5.6, -30.6]], 0.24, 0.2, { mat: wire2, z: 1.1 });
  p.poly([[-12.6, -32.1], [-9.4, -32.1], [-9.8, -33.8], [-11.2, -33.3], [-12.3, -34.1]], { mat: shell, z: 0.8 });
  return p.frame(RENDER);
}

// ---------------------------------------------------------------------------------------------
// The lettering (never mirrored): designed glyphs at the art-px grid
// ---------------------------------------------------------------------------------------------

/** 3 × 5 capitals and digits for the 2× lettering (rows top → bottom). */
const CAPS: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
};

/** The lettering of text frame i: lines and colour. */
const TEXTS: ReadonlyArray<{ lines: readonly string[]; col: Color }> = [
  { lines: ['PARKEERCONTROLE'], col: R.black[1] },
  { lines: ['Gemeente', 'Amsterdam'], col: R.red[4] },
  { lines: ['24'], col: R.black[2] },
];

/** Draw one line in the 3 × 5 caps at (x0, y0) art px; returns its width. */
function capsLine(buf: PixelBuffer | null, s: string, x0: number, y0: number, col: Color): number {
  let x = x0;
  for (const ch of s.toUpperCase()) {
    const g = CAPS[ch];
    if (!g) {
      x += 2;
      continue;
    }
    if (buf) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === '#') buf.set(x + k, y0 + r, col);
    x += 4;
  }
  return x - x0 - 1;
}

/** Draw one line in the 'small' font (1 art px per font px) at (x0, y0) art px; returns its width. */
function smallLine(buf: PixelBuffer | null, s: string, x0: number, y0: number, col: Color): number {
  const f = getFont('small');
  let x = x0;
  for (const ch of s) {
    const g: Glyph | undefined = f.glyphs.find((q) => q.code === ch.charCodeAt(0));
    if (!g) {
      x += 3;
      continue;
    }
    if (buf) {
      for (let r = 0; r < f.height; r++) {
        const row = g.rows[r];
        for (let k = 0; k < g.w; k++) if ((row >> (g.w - 1 - k)) & 1) buf.set(x + k, y0 + r, col);
      }
    }
    x += g.w + f.spacing;
  }
  return x - x0 - f.spacing;
}

export function textHd(i: number, d: number): Frame {
  const f1 = lo(ID.text, i);
  const W = f1.buf.w * d;
  const H = f1.buf.h * d;
  const buf = new PixelBuffer(W, H);
  const T = TEXTS[i];
  const line = d >= 4 ? smallLine : capsLine;
  const lh = d >= 4 ? 7 : 5;
  const gap = d >= 4 ? 2 : 2;
  const widths = T.lines.map((s) => line(null, s, 0, 0, T.col));
  const bw = Math.max(...widths);
  const bh = T.lines.length * lh + (T.lines.length - 1) * gap;
  const x0 = Math.round((W - bw) / 2);
  const y0 = Math.round((H - bh) / 2);
  T.lines.forEach((s, k) => line(buf, s, x0, y0 + k * (lh + gap), T.col));
  return { buf, ox: f1.ox, oy: f1.oy, density: d };
}

// ---------------------------------------------------------------------------------------------
// Wheel, lamp glow
// ---------------------------------------------------------------------------------------------

export function wheelHd(phase: number, d: number): Frame {
  const f1 = lo(ID.wheel, phase);
  const g = geomOf(f1);
  const c = new HdCanvas(g.w, g.h, d);
  const cx = f1.ox + 0.5;
  const cy = f1.oy + 0.5;
  const rubber = c.material({ ramp: R.black, lo: 0, hi: 4, spec: 0.3, shine: 12 });
  const alloy = c.material({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 40, rim: 0.35 });
  const deep = c.material({ ramp: R.steel, lo: 0, hi: 2, spec: 0.3, shine: 20 });
  const r = SCAN.wheelR + 0.5;
  // The tyre: a rubber torus, a fine tread line on the rolling face at 4×.
  c.heightField(cx - r - 0.5, cy - r - 0.5, 2 * r + 1, 2 * r + 1, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    if (q > r || q < 4.4) return NaN;
    const m = (r + 4.4) / 2;
    const w = (r - 4.4) / 2;
    return Math.sqrt(Math.max(0, w * w - (q - m) ** 2)) * 0.7;
  }, { mat: rubber, z: 0, tex: (s) => {
    const q = Math.hypot(s.x - cx, s.y - cy);
    if (s.d >= 4 && q > r - 0.35) {
      const a = Math.atan2(s.y - cy, s.x - cx) + phase * SPOKE_TURN;
      if (Math.sin(a * 24) > 0.65) s.tone -= 0.2;
    }
  } });
  // The alloy: a lit rim lip, five double spokes that turn with the phase, dark gaps (the brake
  // disc behind), the centre cap.
  c.heightField(cx - 4.9, cy - 4.9, 9.8, 9.8, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    if (q > 4.45) return NaN;
    if (q > 3.6) return 0.6 + Math.sqrt(Math.max(0, 0.18 - (q - 4) ** 2));
    if (q < 1.25) return 0.9 + Math.sqrt(Math.max(0, 1.5 - q * q)) * 0.5;
    const a = Math.atan2(y - cy, x - cx) - phase * SPOKE_TURN;
    const k = ((((a / (Math.PI * 2)) * SPOKES) % 1) + 1) % 1;
    // A double spoke: two ribs with a slot between them, narrowing outwards.
    const w = 0.34 - (q - 1.25) * 0.025;
    const off = Math.abs(k - w / 2 - 0.02);
    if (k < w) return 0.55 + (off < 0.04 * (q / 3) ? -0.25 : 0) + (q < 2 ? 0.2 : 0);
    return -0.4;
  }, { mat: alloy, z: 1, tex: (s) => {
    const q = Math.hypot(s.x - cx, s.y - cy);
    if (q <= 3.6 && q >= 1.25) {
      const a = Math.atan2(s.y - cy, s.x - cx) - phase * SPOKE_TURN;
      const k = ((((a / (Math.PI * 2)) * SPOKES) % 1) + 1) % 1;
      const w = 0.34 - (q - 1.25) * 0.025;
      if (k >= w) s.mat = deep;
    }
  } });
  c.ellipsoid(cx, cy, 0.55, 0.55, { mat: deep, z: 2 });
  return { buf: c.render(RENDER), ox: f1.ox, oy: f1.oy, density: d };
}

export function blinkHd(d: number): Frame {
  const f1 = lo(ID.blink);
  const g = geomOf(f1);
  const buf = new PixelBuffer(g.w * d, g.h * d);
  const cx = (g.ox + 0.5) * d;
  const cy = (g.oy + 0.5) * d;
  const tones: readonly Color[] = [R.orange[3], R.orange[4], R.gold[5], R.gold[6], R.gold[7]];
  for (let Y = 0; Y < buf.h; Y++) {
    for (let X = 0; X < buf.w; X++) {
      const dx = (X + 0.5 - cx) / d;
      const dy = (Y + 0.5 - cy) / d;
      // A round core with four short rays.
      const q = Math.hypot(dx, dy);
      const ray = Math.min(Math.abs(dx), Math.abs(dy)) < 0.32 ? 2.4 : 1.6;
      if (q > ray) continue;
      const t = 1 - q / ray;
      buf.set(X, Y, tones[Math.min(4, Math.floor(t * 5))]);
    }
  }
  return { buf, ox: f1.ox, oy: f1.oy, density: d };
}
