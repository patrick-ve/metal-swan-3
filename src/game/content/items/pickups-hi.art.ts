/**
 * HD pickup sprites (2× and 4×, mission ams; docs/ART_GUIDE.md "UHD art"): the pickups of
 * pickups.art.ts drawn natively by one density-generic drawer per id — the same logical size,
 * anchor and frame count as the 1× frames, PAL_HD only, outline A (1 logical px of ink), light
 * from the upper left:
 *
 * - weapon medallions: a beaded gold rim (milled at 4×), a domed ivory enamel face, the crate
 *   letter embossed in navy enamel (bevelled from the big-font glyph), a cut-stone family pip,
 *   the sweeping glint;
 * - the bombs crate: three olive grenades with gold bands and steel caps on a grained crate;
 * - food: a soft scored loaf, a cheese wedge with holes and rind, an iced teacake in a pleated
 *   case with a glossy cherry, a fluted glossy jelly on a plate, a two-tier birthday cake with
 *   striped candles and flickering flames;
 * - treasure: a polished golden note, a faceted crimson gem with a twinkle, a medal with an
 *   embossed star on a striped ribbon, a grooved golden record with a turning shine.
 *
 * `weaponStripHd(letter, accent, id, d)` and `PICKUP_HD[id](id, d)` return the frames.
 */
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { PAL_HD, hdHome } from '../../../engine/palette-hd';
import type { Frame } from '../../../engine/render';
import type { TexSample } from '../../art/hd/index';
import { wood } from '../../art/hd/index';
import { fireMat, hash, hdStrip, metalMat, paintMat, sat, type HdCanvas } from '../fx/hd/kit';
import { drawGlows, Xf, type Glow } from '../fx/hd/shapes';

/** A lit sprite: AO, separations, outline A, the thin cool rim. */
function render(c: HdCanvas): PixelBuffer {
  return c.render({ outline: 'A', ao: 0.3, sep: true, sepZ: 0.3, rimLight: 1 });
}

/** HD ramp of a 64-palette colour (accents). */
function rampOf(c: Color): Ramp {
  return hdHome(c)?.ramp ?? PAL_HD.gold;
}

/** Bilinear sample of a 1-px mask at logical (x, y) (pixel centres at +0.5): smooth glyph edges. */
function maskAt(m: Uint8Array, w: number, h: number, x: number, y: number): number {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const g = (X: number, Y: number): number => (X < 0 || Y < 0 || X >= w || Y >= h ? 0 : m[Y * w + X]);
  return (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
}

/** A small 4-point twinkle (gold arms, white core) centred at (x, y). */
function twinkle(c: HdCanvas, x: number, y: number, arm = 1.6): void {
  const g: Glow[] = [];
  for (const [u, v] of [[arm, 0], [-arm, 0], [0, arm], [0, -arm]] as const) g.push({ k: 'spike', u0: 0, v0: 0, u1: u, v1: v, r0: 0.42, r1: 0.12, h0: 0.82, h1: 0.4 });
  g.push({ k: 'blob', u: 0, v: 0, ru: 0.55, h: 1.1, fall: 0.2 });
  drawGlows(c, Xf.at(x, y), g, { glow: c.material({ ramp: PAL_HD.gold, flat: true, lo: 2, hi: 7 }), part: c.newPart() });
}

/** A specular glint (white core, short soft cross) painted over the art at (x, y). */
function glint(c: HdCanvas, x: number, y: number): void {
  c.paint(x - 1, y - 1, 2, 2, (px, py) => {
    const dx = Math.abs(px - x);
    const dy = Math.abs(py - y);
    if (dx < 0.3 && dy < 0.3) return PAL_HD.snow[6];
    if ((dx < 0.2 && dy < 0.75) || (dy < 0.2 && dx < 0.75)) return PAL_HD.gold[7];
    return 0;
  });
}

// ------------------------------------------------------------------------------------ weapons

/**
 * The HD weapon medallion (19 × 19): a beaded gold rim with a milled edge, a domed ivory face,
 * the embossed navy letter, the family pip, the glint (`glintAt` ≥ 0 sweeps it across).
 */
function drawMedal(c: HdCanvas, letter: string, accent: Color, glintAt: number): void {
  const cx = 9.5;
  const cy = 9.5;
  const gold = metalMat(c, PAL_HD.gold, 1, 2, 6);
  const ivory = c.material({ ramp: PAL_HD.cloth, spec: 0.6, shine: 22, lo: 3, hi: 6, wrap: 0.1 });
  const navy = c.material({ ramp: PAL_HD.navy, spec: 0.7, shine: 26, lo: 1, hi: 5 });
  const fine = c.d >= 4;
  // The rim: a bead round the face.
  c.heightField(cx - 8.5, cy - 8.5, 17, 17, (x, y) => {
    const r = Math.hypot(x - cx, y - cy);
    if (r > 8.4 || r < 6.2) return NaN;
    const k = (r - 7.3) / 1.15;
    return 0.9 * Math.sqrt(Math.max(0, 1 - k * k));
  }, {
    mat: gold,
    z: 0.4,
    tex: fine
      ? (s) => {
          const r = Math.hypot(s.x - cx, s.y - cy);
          const a = Math.atan2(s.y - cy, s.x - cx);
          const m = Math.abs(a / (Math.PI / 18) - Math.round(a / (Math.PI / 18)));
          if (r > 7.9 && m < 0.16) s.tone -= 0.35;
        }
      : null,
  });
  // The face: domed ivory enamel, a soft lower shade; the letter is one surface with it (no
  // separation line or occlusion round its strokes: the bevel alone shapes it).
  const face = c.newPart();
  const gx0 = 4 + glintAt + 0.5;
  const gy0 = 11 - glintAt + 0.5;
  c.heightField(cx - 6.4, cy - 6.4, 12.8, 12.8, (x, y) => {
    const r = Math.hypot(x - cx, y - cy);
    return r > 6.3 ? NaN : 0.45 * Math.sqrt(1 - (r / 6.3) ** 2);
  }, {
    mat: ivory,
    z: 0,
    part: face,
    tex: glintAt >= 0
      ? (s) => {
          // The glint: a short diagonal band of light across the face.
          const t = ((s.x - gx0) - (s.y - gy0)) / 2;
          const along = Math.min(2, Math.max(0, t));
          const px = gx0 + along;
          const py = gy0 - along;
          if (Math.hypot(s.x - px, s.y - py) < 0.55) s.tone += 0.7;
        }
      : null,
  });
  // The letter: a bevelled navy enamel relief from the big-font glyph.
  const L = new PixelBuffer(19, 19);
  drawText(L, letter, 10, 5, { font: 'big', color: 0xffffffff, align: 'center' });
  const m = new Uint8Array(19 * 19);
  for (let i = 0; i < m.length; i++) m[i] = L.data[i] & 255 ? 1 : 0;
  c.heightField(3, 3, 13, 12, (x, y) => {
    const v = maskAt(m, 19, 19, x, y);
    return v < 0.5 ? NaN : 0.25 + (v - 0.5) * 0.9;
  }, { mat: navy, z: 0.9, part: face });
  // The family pip: a cut stone on the rim.
  const pip = c.material({ ramp: rampOf(accent), spec: 1, shine: 34, lo: 1 });
  c.ellipsoid(9.1, 16.6, 1.25, 0.72, { mat: pip, z: 1.6 });
}

/** The medallion strip (4 frames: glint off, off, sweeping; the 1× bob is in the anchors). */
export function weaponStripHd(letter: string, accent: Color, id: string, d: number): Frame[] {
  const glints = [-1, -1, 1, 4];
  return hdStrip(id, d, (c, i) => {
    drawMedal(c, letter, accent, glints[i]);
    return render(c);
  });
}

// ------------------------------------------------------------------------------------ bombs

/** One grenade of the bombs crate (centre, radius). */
function grenade(c: HdCanvas, x: number, y: number, r: number, z: number, olive: number, gold: number, steel: number): void {
  const part = c.newPart();
  c.ellipsoid(x, y, r, r * 1.02, {
    mat: olive,
    part,
    z,
    tex: (s) => {
      if (Math.abs(s.v - 0.05) < 0.17) s.mat = gold;
      // Segment grooves at 4×.
      else if (s.d >= 4 && Math.abs(s.u) % 0.5 < 0.06) s.tone -= 0.25;
    },
  });
  c.box(x - 0.9, y - r - 0.9, 1.8, 1.4, { mat: steel, z: z + 1.5, bevel: 0.35, r: 0.3 });
}

/** The bombs crate (18 × 14, 2 frames: the second glints). */
function bombsHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const olive = paintMat(c, PAL_HD.olive, 0.4, 1, 6);
    const gold = metalMat(c, PAL_HD.gold, 0.8, 2, 6);
    const steel = metalMat(c, PAL_HD.steel, 1, 2, 6);
    const woodM = c.material({ ramp: PAL_HD.wood, spec: 0.25, shine: 12, lo: 1, hi: 6 });
    const white = paintMat(c, PAL_HD.snow, 0.2, 2, 5);
    grenade(c, 4, 5.6, 2.75, 0, olive, gold, steel);
    grenade(c, 14, 5.6, 2.75, 0, olive, gold, steel);
    grenade(c, 9, 4.6, 2.85, 1, olive, gold, steel);
    // The crate: a lit lid edge, planks with grain, side boards, a stencil band.
    c.box(1.1, 9.0, 15.8, 1.3, { mat: woodM, z: 3, bevel: 0.35, n: [0, -0.55, 0.83], tex: wood({ seed: 3 }) });
    c.box(1.1, 10.2, 15.8, 2.9, { mat: woodM, z: 3, bevel: 0.25, tex: wood({ seed: 4, plank: 1.45 }) });
    c.box(1.1, 10.2, 1.2, 2.9, { mat: woodM, z: 3.3, bevel: 0.3, tone: 0.1 });
    c.box(15.7, 10.2, 1.2, 2.9, { mat: woodM, z: 3.3, bevel: 0.3, tone: -0.15 });
    c.box(7.1, 10.6, 3.8, 1.6, { mat: white, z: 3.4, round: 0 });
    if (i === 1) for (const [x, y] of [[2.6, 4.4], [7.6, 3.4], [12.6, 4.4]] as const) glint(c, x, y);
    return render(c);
  });
}

// ------------------------------------------------------------------------------------ food

/** Bread (14 × 10): a soft scored bloomer, flour in the scores; frame 1 glints. */
function breadHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const crust = c.material({ ramp: PAL_HD.brown, spec: 0.3, shine: 14, lo: 2, hi: 7, wrap: 0.08 });
    const flour = paintMat(c, PAL_HD.sand, 0.1, 4, 7);
    const pts: Array<[number, number]> = [[1.4, 8.8]];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push([1.1 + t * 11.8, 7.9 - Math.pow(Math.sin(Math.PI * t), 0.55) * 6.7 + t * 0.4]);
    }
    pts.push([12.6, 8.8]);
    c.blob(pts, 2.2, {
      mat: crust,
      bulge: 0.3,
      tex: (s) => {
        // Three diagonal scores with flour inside.
        for (let k = 0; k < 3; k++) {
          const ax = 3.6 + k * 3;
          const t = (s.x - ax) * 0.55 + (s.y - 6.2) * -0.83;
          const n = (s.x - ax) * 0.83 + (s.y - 6.2) * 0.55;
          if (t > 0 && t < 3.6 && Math.abs(n) < 0.42) {
            s.mat = flour;
            s.tone += 0.1 - Math.abs(n) * 0.4;
          }
        }
        // Darker baked base.
        if (s.y > 8) s.tone -= 0.25;
      },
    });
    if (i === 1) glint(c, 4.6, 2.6);
    return render(c);
  });
}

/** Cheese (14 × 10): a wedge, thick end left, lit top, holes with lit inner walls, an orange rind. */
function cheeseHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const cheese = paintMat(c, PAL_HD.gold, 0.35, 2, 6);
    const rind = paintMat(c, PAL_HD.orange, 0.3, 1, 5);
    const holes: ReadonlyArray<[number, number, number]> = [
      [3, 5, 1.0],
      [7, 7, 1.05],
      [3.5, 7.4, 0.62],
      [10.5, 7.4, 0.62],
    ];
    c.poly([[1.1, 1.1], [13, 6.4], [13, 8.0], [1.1, 8.0]], {
      mat: cheese,
      z: 0,
      tex: (s) => {
        for (const [hx, hy, r] of holes) {
          const q = Math.hypot((s.x - hx) / r, (s.y - hy) / (r * 0.85));
          if (q < 1) {
            // Recess: dark upper-left wall (in shadow), lit lower-right wall.
            const lit = (s.x - hx) + (s.y - hy) > 0.25 * r;
            s.tone += lit ? 0.12 : -0.8;
            s.dz = -0.4;
          }
        }
      },
    });
    // The top face (the wedge's slope), catching the light.
    c.poly([[1.1, 1.1], [13, 6.4], [13, 7.2], [1.1, 2.3]], { mat: cheese, z: 0.4, n: [-0.25, -0.75, 0.6] });
    c.box(1.1, 8.0, 11.9, 0.95, { mat: rind, z: 0.6, bevel: 0.3 });
    if (i === 1) glint(c, 3.5, 2.6);
    return render(c);
  });
}

/** Teacake (14 × 12): an iced cake in a pleated pink case, a glossy cherry on a stem; frame 1 glints. */
function teacakeHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const pink = paintMat(c, PAL_HD.pink, 0.3, 1, 6);
    const icing = c.material({ ramp: PAL_HD.snow, spec: 0.7, shine: 22, lo: 1, hi: 5 });
    const sponge = paintMat(c, PAL_HD.brown, 0.2, 2, 6);
    const cherry = c.material({ ramp: PAL_HD.red, spec: 1, shine: 34, lo: 1, hi: 6 });
    const stem = paintMat(c, PAL_HD.green, 0.2, 1, 5);
    // The pleated case.
    c.poly([[1.1, 7.8], [12.9, 7.8], [11.3, 10.9], [2.7, 10.9]], {
      mat: pink,
      z: 0,
      tex: (s) => {
        const f = (s.x - 7) * 1.1;
        s.nx += Math.sin(f * Math.PI) * 0.55;
      },
    });
    c.box(1.3, 6.6, 11.4, 1.5, { mat: sponge, z: 0.3, bevel: 0.3 });
    // The icing dome with three drips.
    c.ellipsoid(7, 6.6, 5.8, 2.6, { mat: icing, z: 0.8, tex: (s) => { if (s.v > 0.15) s.cut = true; } });
    for (const x of [2.6, 5.6, 9.4]) c.capsule(x, 6.6, x, 7.7, 0.55, 0.45, { mat: icing, z: 0.9 });
    c.stroke([[7, 3.4], [6.6, 2.0], [7.4, 1.1]], 0.3, 0.25, { mat: stem, z: 1.5 });
    c.ellipsoid(6.9, 3.4, 1.25, 1.2, { mat: cherry, z: 2 });
    if (i === 1) glint(c, 6.4, 2.9);
    return render(c);
  });
}

/** Jelly (14 × 14; frame 1 15 × 14 leans): a fluted glossy green mould on a white plate. */
function jellyHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const jelly = c.material({ ramp: PAL_HD.green, spec: 1, shine: 30, lo: 2, hi: 7, wrap: 0.1 });
    const plate = c.material({ ramp: PAL_HD.snow, spec: 0.6, shine: 22, lo: 1, hi: 5 });
    c.ellipsoid(7, 12.1, 6.1, 1.25, { mat: plate, z: 0, round: 0.6 });
    const lean = i === 1 ? 1 : 0;
    // Half-width of the mould by height (1× rows 0–9 at y 1–10): a dome over straight sides.
    const halfW = (y: number): number => {
      if (y < 1.1 || y > 10.6) return 0;
      if (y < 5.5) return 3.1 + 2.9 * Math.sqrt(Math.max(0, (y - 1.1) / 4.4));
      return 6 - Math.max(0, y - 9.4) * 0.8;
    };
    c.heightField(0.5, 0.5, 14, 10.5, (x, y) => {
      const sh = y < 6 ? lean * (1 - Math.max(0, y - 3) / 3) : 0;
      const dx = x - 7 - sh;
      const w = halfW(y);
      if (w <= 0 || Math.abs(dx) > w) return NaN;
      const k = dx / w;
      // A round body with vertical flutes.
      return 2.6 * Math.sqrt(1 - k * k) + (y < 5.5 ? 0.1 : 0.14) * Math.cos(dx * 2.4);
    }, { mat: jelly, z: 1 });
    return render(c);
  });
}

/** Birthday cake (16 × 16, 2 frames): two iced tiers on a plate, striped candles, flickering flames. */
function cakeHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, phase) => {
    const sponge = paintMat(c, PAL_HD.sand, 0.25, 2, 7);
    const pink = c.material({ ramp: PAL_HD.pink, spec: 0.6, shine: 20, lo: 1, hi: 6 });
    const plate = c.material({ ramp: PAL_HD.snow, spec: 0.6, shine: 22, lo: 1, hi: 5 });
    const candle = paintMat(c, PAL_HD.snow, 0.3, 2, 6);
    const fire = fireMat(c);
    c.ellipsoid(8, 14.8, 7.6, 1.1, { mat: plate, z: 0, round: 0.6 });
    const tier = (x: number, y: number, w: number, h: number, z: number, drips: readonly number[]): void => {
      c.cylinder(x, y, w, h, {
        mat: sponge,
        z,
        cap: 1.0,
        tex: (s) => {
          const top = s.y - y;
          const drip = drips.some((dx) => Math.abs(s.x - (x + dx)) < 0.55 && top < 2.2);
          if (top < 1.15 || drip) s.mat = pink;
          // The filling line.
          else if (Math.abs(top - h * 0.55) < 0.32) {
            s.mat = pink;
            s.tone -= 0.25;
          }
        },
      });
    };
    tier(1.2, 9, 13.6, 5.2, 1, [1.5, 4.5, 7.5, 10.5]);
    tier(3.2, 5, 9.6, 4.1, 2, [1.5, 6]);
    for (const [k, x] of [4.5, 7.5, 10.5].entries()) {
      c.cylinder(x - 0.42, 2.9, 0.84, 2.3, {
        mat: candle,
        z: 3,
        tex: (s) => {
          if (Math.floor((s.y - s.x * 0.6) * 1.6) % 2 === 0) s.mat = pink;
        },
      });
      const tall = (k + phase) % 2 === 0;
      const top = tall ? 0.15 : 0.85;
      c.capsule(x, 2.5, x, top + 0.5, 0.55, 0.22, { mat: fire, z: 4, tex: (s) => { s.tone = sat(1.05 - s.u * 0.55 - Math.abs(s.v) * 0.3) * 0.999 - 0.5; } });
    }
    return render(c);
  });
}

// ------------------------------------------------------------------------------------ treasure

/** Golden note (10 × 12, 4 frames): a polished gold eighth note; a glint hops over it. */
function goldenNoteHd(id: string, d: number): Frame[] {
  const spots: Array<[number, number] | null> = [null, [2, 8], [5, 3], [7, 3]];
  return hdStrip(id, d, (c, i) => {
    const gold = metalMat(c, PAL_HD.gold, 1, 2, 6);
    const part = c.newPart();
    c.plane(0.5, 6.5, 6.5, 5, {
      mat: gold,
      part,
      tex: (s) => {
        const dx = s.x - 3.1;
        const dy = s.y - 9.0;
        const u = (dx * 0.93 + dy * 0.37) / 2.3;
        const v = (-dx * 0.37 + dy * 0.93) / 1.45;
        const q = u * u + v * v;
        if (q > 1) {
          s.cut = true;
          return;
        }
        s.nx = u * 0.8;
        s.ny = v * 0.8;
        s.nz = Math.sqrt(1 - q);
      },
    });
    c.stroke([[5.4, 8.6], [5.5, 1.5]], 0.55, 0.5, { mat: gold, part, z: 0.2 });
    c.stroke([[5.6, 1.4], [6.9, 2.0], [7.6, 3.2], [7.5, 4.6]], 0.6, 0.35, { mat: gold, part, z: 0.3 });
    const s = spots[i];
    if (s) glint(c, s[0] + 0.5, s[1] + 0.5);
    return render(c);
  });
}

/** A faceted brilliant: height = the lowest of n facet planes (crown above the girdle, pavilion below). */
function gemHeight(x: number, y: number): number {
  const cx = 7;
  const gy = 5.9;
  const dx = x - cx;
  if (y < gy) {
    const top = 3.05;
    if (y < top) return NaN;
    const half = 2.0 + ((y - top) / (gy - top)) * 1.95;
    if (Math.abs(dx) > half) return NaN;
    // Crown: a flat table and six bevelled facets.
    const a = Math.atan2((y - gy) * 1.6, dx);
    const f = Math.round(a / (Math.PI / 3)) * (Math.PI / 3);
    const planes = 2.2 - 0.55 * Math.hypot(dx, (y - gy) * 1.6) * Math.cos(a - f);
    return Math.min(1.6, 1.0 + planes);
  }
  const bot = 10.2;
  if (y > bot) return NaN;
  const half = 3.95 * (1 - (y - gy) / (bot - gy)) + 0.2;
  if (Math.abs(dx) > half) return NaN;
  // Pavilion: facets falling to the point.
  const a = Math.atan2((y - gy) * 0.8, dx);
  const f = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  return Math.max(0.05, 3.1 - 0.75 * Math.hypot(dx, (y - gy) * 0.8) * (1 + 0.2 * Math.cos(a - f)) - 0.12 * (y - gy));
}

/** Gem (14 × 13, 4 frames): a faceted crimson brilliant with sharp glints; a twinkle hops around it. */
function gemHd(id: string, d: number): Frame[] {
  const spots: Array<[number, number] | null> = [null, [2, 2], [10, 4], [5, 9]];
  return hdStrip(id, d, (c, i) => {
    const ruby = c.material({ ramp: PAL_HD.red, spec: 1, shine: 40, lo: 1, hi: 6, gain: 1.15 });
    c.heightField(2.5, 2.8, 9, 7.6, gemHeight, { mat: ruby, z: 0 });
    const s = spots[i];
    if (s) twinkle(c, s[0] + 0.5, s[1] + 0.5);
    return render(c);
  });
}

/** Medal (12 × 14, 4 frames): a gold medal with an embossed star on a striped ribbon; glints. */
function medalHd(id: string, d: number): Frame[] {
  const spots: Array<[number, number] | null> = [null, null, [3, 8], [8, 9]];
  return hdStrip(id, d, (c, i) => {
    const red = paintMat(c, PAL_HD.red, 0.35, 1, 6);
    const white = paintMat(c, PAL_HD.snow, 0.3, 1, 5);
    const gold = metalMat(c, PAL_HD.gold, 1, 2, 6);
    // The ribbon: red with a white centre stripe, a V-cut tail behind the medal.
    c.poly([[3.1, 1.1], [9, 1.1], [9, 5.1], [7.4, 6.2], [6, 5.0], [4.6, 6.2], [3.1, 5.1]], {
      mat: red,
      z: 0,
      tex: (s) => {
        if (Math.abs(s.x - 6.05) < 1.0) s.mat = white;
        // Soft fold across the ribbon.
        s.ny += Math.sin((s.y - 1) * 1.2) * 0.25;
      },
    });
    // The medal: a bead rim round a raised five-point star.
    const cx = 6;
    const cy = 9.6;
    c.heightField(cx - 4.2, cy - 4.2, 8.4, 8.4, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > 3.95) return NaN;
      const a = Math.atan2(dy, dx) + Math.PI / 2;
      const star = 1.0 + 0.55 * Math.cos(5 * a);
      const rim = r > 3.1 ? 0.5 * Math.sqrt(Math.max(0, 1 - ((r - 3.5) / 0.45) ** 2)) : 0;
      const relief = r < star * 1.6 ? 0.45 * (1 - r / (star * 1.6)) + 0.2 : 0;
      return 0.2 + Math.max(rim, relief);
    }, { mat: gold, z: 1 });
    const s = spots[i];
    if (s) glint(c, s[0] + 0.5, s[1] + 0.5);
    return render(c);
  });
}

/** Golden record (14 × 14, 4 frames): a gold disc with fine grooves, a crimson label, a shine that turns. */
function recordHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, f) => {
    const gold = c.material({ ramp: PAL_HD.gold, spec: 0.4, shine: 20, lo: 1, hi: 6, flat: true });
    const label = paintMat(c, PAL_HD.red, 0.4, 1, 6);
    const shine = -Math.PI * 0.75 + (f * Math.PI) / 2;
    const cx = 7;
    const cy = 7;
    c.ellipsoid(cx, cy, 6.45, 6.45, {
      mat: gold,
      round: 0.15,
      tex: (s: TexSample) => {
        const dx = s.x - cx;
        const dy = s.y - cy;
        const r = Math.hypot(dx, dy);
        if (r < 1) {
          s.fix = PAL_HD.ink[0];
          return;
        }
        if (r < 2.6) {
          s.mat = label;
          s.nx = dx * 0.08;
          s.ny = dy * 0.08;
          s.nz = 1;
          return;
        }
        // Grooves: fine rings (finer at 4×), and the anisotropic shine in two opposite wedges.
        let da = Math.atan2(dy, dx) - shine;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const groove = Math.sin(r * (s.d >= 4 ? 9 : 4.6)) * 0.08;
        const lit = Math.abs(da) < 0.42 ? 0.42 * (1 - Math.abs(da) / 0.42) : 0;
        const back = Math.abs(Math.abs(da) - Math.PI) < 0.26 ? 0.2 : 0;
        const edge = r > 6.0 ? -0.18 : 0;
        s.tone = -0.08 + groove + lit + back + edge + hash(Math.floor(r * 3), f, 5) * 0.04;
      },
    });
    return render(c);
  });
}

// ------------------------------------------------------------------------------------ register

/** HD builders by pickup id (all but the weapon medallions). */
export const PICKUP_HD: Readonly<Record<string, (id: string, d: number) => Frame[]>> = {
  'item/pickup-bombs': bombsHd,
  'item/pickup-food': breadHd,
  'item/pickup-food/bread': breadHd,
  'item/pickup-food/cheese': cheeseHd,
  'item/pickup-food/teacake': teacakeHd,
  'item/pickup-food/jelly': jellyHd,
  'item/pickup-food/birthday-cake': cakeHd,
  'item/pickup-gem': gemHd,
  'item/pickup-gem/golden-note': goldenNoteHd,
  'item/pickup-gem/gem': gemHd,
  'item/pickup-gem/medal': medalHd,
  'item/pickup-gem/golden-record': recordHd,
};
