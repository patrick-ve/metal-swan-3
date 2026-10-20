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
 * Look: glossy white paint (the neutral `gable` whites) over a lit body volume (rolled edges round
 * the profile, the arches and the glass, the shoulder under the windows, the bonnet's top face
 * rising to the wing crease, the lower doors tucking under towards the black sill), door, bonnet
 * and tailgate shut lines, the red livery painted on the same volume, glossy black pillars,
 * textured black arch trims, the slim swept LED headlight in a black housing, a black grille with
 * a thin chrome bar and a plain round emblem, the fog lamp, yellow plates, the red tail light, the
 * black mirror, body-colour handles; near-black tinted glass with sky reflections and the
 * handhaver's silhouette with his cap; the big thick white scanner box (a lid seen a little from
 * above, sides sloping in, smoked camera windows with a lens, a grey band with the number; a faint
 * red cast while scanning) on a black rack with feet; silver multi-spoke alloys in black tyres.
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
import { BOX_DENT, crackAt, dents, DRIVER_EXPR, glintAt, HEADLIGHT, scuffs, sootAt, SPOKES, SPOKE_TURN, TAIL } from './art';
import { ID, SCAN } from './geometry';
import {
  bandPart,
  barAt,
  beltY,
  boxLocal,
  camAt,
  creaseY,
  inBand,
  inBody,
  inCross,
  inGlass,
  inGreyBand,
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

/** Distance to the nearest shut line (continuous): the doors, the bonnet's edge on the crease, the tailgate. */
function seamDist(x: number, y: number): number {
  const S = SCAN;
  let e = 9;
  const belt = beltY(x);
  if (y > belt + 0.3) {
    // The rear door's rear edge stops at the arch trim; the B seam and the front door's front edge run to the sill.
    if (y < S.wheelCY - Math.sqrt(S.trimR ** 2 - (S.seams[0] - S.wheelC[0]) ** 2)) e = Math.min(e, Math.abs(x - S.seams[0]));
    if (y < S.sill[0]) e = Math.min(e, Math.abs(x - S.seams[1]), Math.abs(x - S.seams[2]));
  }
  // The bonnet's shut line along the wing crease, from the A-pillar's foot to the headlight.
  if (x > 22.2 && x < 34.6) e = Math.min(e, Math.abs(y - creaseY(x)));
  // The tailgate's shut line behind the tail light.
  if (y > -17 && y < -8.5) e = Math.min(e, Math.abs(x - (-40.6 - (y + 17) * 0.03)));
  return e;
}

export function bodyHd(state: 0 | 1 | 2, d: number): Frame {
  const S = SCAN;
  const p = new HdPiece(geomOf(lo(ID.body[state])), d);
  const paint = p.material({ ramp: R.gable, lo: 3, hi: 6, spec: 0.85, shine: 46, wrap: 0.06, rim: 0.3, bounce: 0.3 });
  const red = p.material({ ramp: R.red, lo: 4, hi: 6, spec: 0.3, shine: 40, wrap: 0.06 });
  const black = p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.6, shine: 34, wrap: 0.05 });
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
    // The shoulder just under the windows, and the waist below it.
    const sb = y - beltY(x);
    if (x > -41 && x < 21) h += 0.75 * Math.exp(-(((sb - 1.4) / 0.75) ** 2)) - 0.25 * Math.exp(-(((sb - 3.0) / 1.2) ** 2));
    // The bonnet's top face (seen from above: it rises to the wing crease) and the wing rolling
    // down from the crease.
    if (x > 21.5) {
      const dc = y - creaseY(x);
      const k = Math.min(1, (x - 21.5) / 1.5);
      h += k * (dc < 0 ? Math.max(0, 1.3 + dc * 0.55) : 1.3 - Math.min(0.5, dc * 0.3));
    }
    // The lower doors tuck under towards the sill; the nose and the tailgate turn away.
    if (y > -9.5) h -= (y + 9.5) * 0.42;
    if (x > 39.5) h -= (x - 39.5) * 0.35;
    if (x < -40.4) h -= (-40.4 - x) * 0.5;
    // Dents.
    for (const [dx, dy] of ds) {
      const q = ((x - dx) ** 2 + (y - dy) ** 2) / 1.6;
      if (q < 5) h -= 0.8 * Math.exp(-q);
    }
    if (state === 2) {
      // The bonnet buckles up into a ridge.
      const k = Math.exp(-(((x - 30) / 3.2) ** 2)) * Math.exp(-(((y + 17.2) / 0.9) ** 2));
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
          if (q < 0.22 && barAt(x, y) >= 0) s.fix = (t * 7) % 2 < 1 ? R.snow[5] : R.red[6];
        }
      }
      if (state === 2) {
        const q = sootAt(x, y) * (0.75 + 0.5 * hash2(Math.floor(x * 1.5), Math.floor(y * 1.5), 7));
        if (q > 0.15) s.tone -= q * 1.6;
        // The gap under the buckled ridge.
        if (Math.abs(y - (-16.4 + (x - 27) * 0.2)) < 0.18 && x > 27 && x < 33.5) s.fix = R.ink[1];
      }
    }),
  });
  // 2. The window band's black pillars (the glass is a hole: the cabin strip covers it).
  p.field(-43, -29, 66, 12, (x, y) => {
    const part = bandPart(x, y);
    if (part !== 'pillar' && part !== 'apillar') return NaN;
    return roll(polyDist(x, y, S.band), 0.8) * 0.6 + 0.2;
  }, { mat: black, z: -0.4 });
  // 3. Wheel wells, the textured black arch trims, the sill and the lower bumpers.
  p.field(-36, -16, 72, 15, (x, y) => (inWell(x, y) ? -(S.archR - wheelDist(x, y)) * 0.4 - 1.2 : NaN), { mat: well, z: -3 });
  p.field(-37, -17, 74, 16, (x, y) => {
    if (!inTrim(x, y)) return NaN;
    const r = wheelDist(x, y);
    return Math.sqrt(Math.max(0, 0.36 - (r - (S.archR + S.trimR) / 2) ** 2)) * 1.4 + 0.4;
  }, {
    mat: plastic,
    z: 0.6,
    tex: (s) => {
      if (s.d >= 4 && hash2(s.X, s.Y, 11) > 0.8) s.tone -= 0.12;
    },
  });
  p.field(S.canvas.x0, -8, S.canvas.x1 - S.canvas.x0 + 1, 7, (x, y) => {
    if (!inSill(x, y)) return NaN;
    return roll(Math.min(polyDist(x, y, S.profile), y - Math.min(S.sill[0], S.lowBumper) + 0.5), 0.7) * 0.8;
  }, {
    mat: plastic,
    z: 0.3,
    tex: (s) => {
      if (s.d >= 4 && hash2(s.X, s.Y, 13) > 0.82) s.tone -= 0.12;
    },
  });
  // 4. Lamps: the tail light under the band's rear end, the slim swept LED headlight (a black
  //    housing, the lamp, the LED line), the black grille with its thin chrome bar and a plain
  //    round emblem, the fog lamp in the bumper, the yellow plates (the rear one with the blue
  //    EU strip at its near end and a made-up number's marks at 4×).
  p.field(-43, -24, 4, 8, (x, y) => (x < TAIL.x && y > TAIL.y0 && y < TAIL.y1 && inBody(x, y) ? roll(Math.min(TAIL.x - x + 0.6, y - TAIL.y0, TAIL.y1 - y), 0.9) : NaN), {
    mat: tail,
    z: 1,
    tex: (s) => {
      // The light's inner bars.
      if (s.d >= 4 && Math.abs(((s.y - TAIL.y0) % 1.4) - 0.7) < 0.12) s.tone -= 0.3;
    },
  });
  p.poly(HEADLIGHT, { mat: black, z: 1 });
  p.poly([[35.2, -13.4], [38.6, -13.5], [40.4, -13.1], [40.9, -12.5], [40.2, -12.3], [36.8, -12.9]], { mat: lamp, z: 1.3 });
  p.paint(34.8, -14, 7, 2, (x, y) => (Math.abs(y - (-13.25 + (x - 35.4) * 0.05)) < 0.14 && x > 35.4 && x < 40.4 ? R.snow[6] : 0), 2);
  p.box(40.5, -12.2, 1.9, 3.2, { mat: black, z: 0.8, r: 0.5, bevel: 0.6 });
  p.box(40.6, -11.1, 1.8, 0.4, { mat: chrome, z: 1.2, r: 0.15 });
  p.ell(41.6, -10.2, 0.45, 0.45, { mat: chrome, z: 1.4 });
  p.ell(38.4, -7.6, 0.85, 0.5, { mat: black, z: 1 });
  p.ell(38.4, -7.6, 0.6, 0.32, { mat: lamp, z: 1.2 });
  p.box(41.2, -9.2, 0.9, 2.4, { mat: plate, z: 1.2, r: 0.2, bevel: 0.3 });
  p.box(-42.2, -13.0, 0.9, 3.0, { mat: plate, z: 1.2, r: 0.2, bevel: 0.3 });
  p.paint(-42.2, -13.0, 0.9, 3.0, (x, y) => (y < -12.3 ? R.sky[1] : d >= 4 && Math.abs(x + 41.75) < 0.12 && Math.floor((y + 12.3) * 2.5) % 2 === 0 ? R.ink[1] : 0), 2);
  // 5. The black mirror on its arm, the door handles (body colour over a dark recess), the city
  //    emblem by the rear arch.
  const [mx, my] = S.mirror;
  const md = state === 2 ? 1.1 : 0;
  p.cap(mx + 0.6, my + 0.9, mx + 1.6, my + 0.4 + md * 0.5, 0.35, 0.3, { mat: black, z: 2 });
  p.ell(mx - 0.2, my + md, 1.6, 1.05, { mat: black, z: 2.3 });
  for (const [hx, hy] of S.handles) {
    p.cap(hx + 0.4, hy + 0.75, hx + 1.7, hy + 0.75, 0.32, 0.32, { mat: plastic, z: 0.8 });
    p.cap(hx + 0.4, hy + 0.45, hx + 1.7, hy + 0.45, 0.34, 0.34, { mat: paint, z: 1.2 });
  }
  const [ex, ey] = S.emblem;
  p.ell(ex, ey, 1.0, 0.85, { mat: red, z: 0.8 });
  p.paint(ex - 1, ey - 1, 2, 2, (x, y) => (Math.abs(x - ex) < 0.22 && Math.abs(y - ey) < 0.5 ? R.snow[6] : 0), 2);
  if (state === 2) {
    // The front bumper's lower lip hangs.
    p.poly([[38.6, -6.8], [42.0, -5.6], [42.2, -1.4], [39.0, -2.2]], { mat: plastic, z: 1.6 });
  }
  return p.frame(RENDER);
}

// ---------------------------------------------------------------------------------------------
// The cabin (the dark tinted glass; drawn behind the body's glass holes, no outline)
// ---------------------------------------------------------------------------------------------

/** The glass colour at (x, y) (no interior): near-black tint, the far windows a little lighter, sky along the top edge. */
function glassAt(x: number, y: number): Color {
  if (bandPart(x, y) === 'screen') {
    const t = (y + 28) / 9;
    return t < 0.25 ? R.steel[5] : t < 0.6 ? R.steel[4] : R.steel[3];
  }
  const g = glintAt(x, y, 0.8);
  if (g === 0) return R.steel[4];
  if (g === 1) return R.steel[3];
  if (!inBand(x, y - 0.6)) return R.steel[4];
  if (!inBand(x, y - 1.2)) return R.steel[3];
  const belt = beltY(x);
  if (y > belt - 1) return R.steel[0];
  return y > belt - 2.4 ? R.steel[1] : R.steel[2];
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
    if (Math.hypot((x + 15.5) / 1.6, (y + 22.4) / 1.4) < 1 || (x > -17.1 && x < -13.9 && y > -22.4 && y < -20.6)) return g === 0 ? R.steel[3] : R.black[1];
    const dv = driver(x, y);
    if (dv !== 0) return g === 0 ? R.steel[3] : dv;
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
  const black = p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.45, shine: 22 });
  const K = SCAN.scanner;
  // The mounting bar and the feet (rubber pads on the roof, a lit top edge).
  p.field(-26, -35, 32, 7, (x, y) => {
    if (!inRack(x, y, bent)) return NaN;
    const top = y < K.bar[3] ? 0.35 : 0;
    return 0.5 + top + (y > K.feetTo - 0.6 ? -0.2 : 0);
  }, {
    mat: black,
    z: 0,
    tex: (s) => {
      // The foot's clamp seam at 4×.
      if (s.d >= 4 && Math.abs(s.y - (K.bar[3] + 1.2)) < 0.1) s.tone -= 0.3;
    },
  });
}

export function scannerHd(state: 0 | 1 | 2, frame: number, d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.scanner[state], frame)), d);
  const K = SCAN.scanner;
  const rise = K.rise[frame];
  const scanning = frame === 3;
  const askew = state === 2;
  const shell = p.material({ ramp: R.gable, lo: 3, hi: 6, spec: 0.7, shine: 36, wrap: 0.06, rim: 0.3 });
  const grey = p.material({ ramp: R.steel, lo: 3, hi: 6, spec: 0.5, shine: 30, wrap: 0.06 });
  const smoke = p.material({ ramp: R.steel, lo: 0, hi: 2, spec: 1, shine: 70 });
  const glow = p.material({ ramp: [R.red[0], R.red[1], R.red[2], R.red[3], R.red[5]], flat: true, lo: 0, hi: 4 });
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 1, shine: 34, rim: 0.4 });
  rackHd(p, false);
  if (rise > 0) {
    for (const sx of K.struts) p.cyl(sx, K.bar[2] - rise - 0.4, 1.2, rise + 0.6, { mat: steel, z: -0.2, axis: 'v' });
  }
  const top = K.shell[0][1];
  p.field(-36, -44, 46, 13, (x, y) => {
    const [u, v] = boxLocal(x, y, rise, askew, pt);
    if (!inShell(u, v)) return NaN;
    let h = roll(shellEdge(u, v), 1.2) + 0.3;
    // The lid's top face rises towards its rim (seen from above), the rim rolls over, the lower
    // body's sides slope in towards the bottom (they face down, away from the light).
    if (v < K.lidTop) h += 1.0 + (v - top) * 1.6;
    else if (v < K.shut) h += 1.9 - ((v - K.lidTop) / (K.shut - K.lidTop)) * 0.2;
    else h += 1.3 - (v - K.shut) * 0.32;
    if (state >= 1 && Math.hypot(u - BOX_DENT[0], v - BOX_DENT[1]) < 1.1) h -= 0.5 * (1.1 - Math.hypot(u - BOX_DENT[0], v - BOX_DENT[1]));
    // The camera windows sit in shallow recesses.
    if (camAt(u, v) >= 0) h -= 0.3;
    return h;
  }, {
    mat: shell,
    z: 1,
    tex: p.tex((s) => {
      const [u, v] = boxLocal(s.x, s.y, rise, askew, pt);
      const cam = camAt(u, v);
      if (cam >= 0) {
        if (crackAt(u, v, state)) {
          s.fix = scanning ? R.red[4] : R.snow[5];
          return;
        }
        const lens = cam === 1 ? Math.hypot((u - K.lens[0]) / 1.3, (v - K.lens[1]) / 0.8) : 9;
        if (scanning) {
          // A faint red cast behind the smoked glass (never a light bar), the lens lit.
          s.mat = glow;
          const [x0, x1, y0, y1] = cam < 2 ? K.windows[cam] : [u - 0.6, u + 0.6, -36.8, -34.3];
          const q = Math.hypot((u - (x0 + x1) / 2) / ((x1 - x0) / 2), (v - (y0 + y1) / 2) / ((y1 - y0) / 2));
          s.tone = (q < 0.55 ? -0.2 : -0.4) + (lens < 1 ? (lens < 0.5 ? 0.6 : 0.36) : 0);
        } else {
          s.mat = smoke;
          if (lens < 1) s.tone += lens < 0.45 ? 0.75 : 0.45;
          // A sky reflection along the top of the smoked glass.
          else if (cam < 2 && v < K.windows[cam][2] + 0.45) s.tone += 0.5;
        }
        return;
      }
      if (inGreyBand(u, v)) s.mat = grey;
      // The seam line round the lid and the joint at the bottom.
      if (Math.abs(v - K.shut) < 0.16) s.tone -= 0.9;
      if (state === 2) {
        const q = Math.max(0, 1 - Math.hypot((u + 18) / 5, (v + 35) / 3));
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
  const shell = p.material({ ramp: R.gable, lo: 3, hi: 6, spec: 0.6, shine: 34 });
  const K = SCAN.scanner;
  const y0 = K.bar[2];
  rackHd(p, true);
  // Sheared strut stubs with jagged tops, a dangling wire, a shard of the shell on the bar.
  for (const sx of K.struts) p.poly([[sx, y0], [sx, y0 - 1.4], [sx + 0.5, y0 - 2.2], [sx + 0.8, y0 - 1.2], [sx + 1.2, y0 - 1.8], [sx + 1.2, y0]], { mat: steel, z: 0.4 });
  p.stroke([[-5.4, y0 - 1.4], [-4.6, y0 - 0.2], [-4.2, y0 + 1.2], [-3.4, y0 + 2.4]], 0.28, 0.24, { mat: wire, z: 1 });
  p.stroke([[-5.8, y0 - 1.2], [-5.4, y0 + 0.4], [-5.6, y0 + 1.4]], 0.24, 0.2, { mat: wire2, z: 1.1 });
  p.poly([[-12.6, y0 - 0.1], [-9.4, y0 - 0.1], [-9.8, y0 - 1.8], [-11.2, y0 - 1.3], [-12.3, y0 - 2.1]], { mat: shell, z: 0.8 });
  return p.frame(RENDER);
}

// ---------------------------------------------------------------------------------------------
// The lettering (never mirrored): designed glyphs at the art-px grid
// ---------------------------------------------------------------------------------------------

/** 3 × 5 capitals and digits for the 2× lettering (rows top → bottom; C, E and L are 2 wide so the door text fits). */
const CAPS: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.#', '#.', '#.', '#.', '.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['##', '#.', '##', '#.', '##'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#.', '#.', '#.', '#.', '##'],
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

/**
 * 3 × 4 capitals for the 2× `GEMEENTE AMSTERDAM` (two lines must fit between the shoulder and the
 * rear wheel arch, left of the crosses; E and S are 2 wide).
 */
const CAPS4: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#'],
  D: ['##.', '#.#', '#.#', '##.'],
  E: ['##', '#.', '##', '##'],
  G: ['.##', '#..', '#.#', '.##'],
  M: ['#.#', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#'],
  R: ['##.', '#.#', '##.', '#.#'],
  S: ['.#', '#.', '.#', '#.'],
  T: ['###', '.#.', '.#.', '.#.'],
};

type Line = (buf: PixelBuffer | null, s: string, x0: number, y0: number, col: Color) => number;

interface TextSpec {
  lines: readonly string[];
  col: Color;
  /** 3 × 4 capitals at 2× (else 3 × 5). */
  caps4?: boolean;
  /** The block's top (art px from the frame's top) per density; centred when absent. */
  top?: Readonly<Record<number, number>>;
  /** Set against the frame's right / left edge (the margin in art px per density); centred when absent. */
  align?: { side: 'right' | 'left'; margin: Readonly<Record<number, number>> };
}

/**
 * The lettering of text frame i (geometry.ts `ID.text`). `Gemeente Amsterdam` sits high, under the
 * shoulder (its second line clears the rear wheel arch), set close to the crosses: frame 1 on
 * their left (the car facing right), frame 3 on their right (facing left; the crosses mirror,
 * the lettering never does).
 */
const GEMEENTE = { lines: ['Gemeente', 'Amsterdam'], col: R.red[4], caps4: true, top: { 2: 1, 4: 4 } } as const;
const TEXTS: readonly TextSpec[] = [
  { lines: ['PARKEERCONTROLE'], col: R.black[1] },
  { ...GEMEENTE, align: { side: 'right', margin: { 2: 2, 4: 3 } } },
  { lines: ['24'], col: R.black[2] },
  { ...GEMEENTE, align: { side: 'left', margin: { 2: 2, 4: 3 } } },
];

/** Draw one line in a capitals table at (x0, y0) art px (1 art px between glyphs); returns its width. */
function tableLine(table: Readonly<Record<string, readonly string[]>>): Line {
  return (buf, s, x0, y0, col) => {
    let x = x0;
    for (const ch of s.toUpperCase()) {
      const g = table[ch];
      if (!g) {
        x += 2;
        continue;
      }
      if (buf) for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) if (g[r][k] === '#') buf.set(x + k, y0 + r, col);
      x += g[0].length + 1;
    }
    return x - x0 - 1;
  };
}

const capsLine = tableLine(CAPS);
const caps4Line = tableLine(CAPS4);

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
  const line: Line = d >= 4 ? smallLine : T.caps4 ? caps4Line : capsLine;
  const lh = d >= 4 ? 7 : T.caps4 ? 4 : 5;
  const gap = d >= 4 ? 2 : 1;
  const widths = T.lines.map((s) => line(null, s, 0, 0, T.col));
  const bw = Math.max(...widths);
  const bh = T.lines.length * lh + (T.lines.length - 1) * gap;
  const al = T.align;
  const x0 = !al ? Math.round((W - bw) / 2) : al.side === 'left' ? al.margin[d] : W - al.margin[d] - bw;
  const y0 = T.top?.[d] ?? Math.round((H - bh) / 2);
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
