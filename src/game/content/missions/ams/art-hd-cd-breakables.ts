/**
 * UHD art (d 2 and 4) of the Amsterdam breakables (breakables.ts; 1× art in npc.art.ts
 * `breakable`): the herring cart, the tulip stall, the flea-market stall and the bike rack, each
 * intact (frame 0) and wrecked (frame 1). One drawer per id on an `HdCanvas` of the 1× frame's
 * logical size (the 1× anchor), PAL_HD, outline A (they can be shot), `rimLight` for the cool rim.
 *
 * Intact: enamel, canvas, zinc, wood and chrome as lit volumes (the kiosk a bevelled box, wheels
 * with tyres, spokes and hubs, herrings with dark backs and silver bellies on crushed ice, tulip
 * cups in zinc buckets, records, a radio, a lamp, books). Wrecked (the HD damage state): dented
 * and scorched enamel with a torn hole, shattered glass, snapped and splintered planks, spilled
 * fish, ice, tulips and water, buckled wheels and bent tubes — the 1× composition, seen closer.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { hdRampOf, PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { wood as woodTex } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { HdCanvas, hdStrip, letters, metalMat, propMat, wheelHd, type WheelMats } from './art-hd-cd-kit';

const D = 'decor/ams/';

/** Render options of every breakable frame (outline A, the thin cool rim of sprites). */
function done(c: HdCanvas): PixelBuffer {
  return c.render({ outline: 'A', ao: 0.3, sepZ: 0.3, rimLight: 1 });
}

function wheelMats(c: HdCanvas): WheelMats {
  return {
    tyre: propMat(c, PAL_HD.black, { lo: 0, hi: 4, spec: 0.35, shine: 14 }),
    rim: metalMat(c, PAL_HD.steel, { lo: 2, hi: 6 }),
    hub: metalMat(c, PAL_HD.steel, { lo: 2, hi: 6 }),
  };
}

/** Crushed ice / sugar texture: small facets catching the light. */
function iceTex(seed: number): (s: import('../../../art/hd/index').TexSample) => void {
  return (s) => {
    const cx = Math.floor(s.x * 2);
    const cy = Math.floor(s.y * 2);
    s.nx += (hash2(cx, cy, seed) - 0.5) * 1.3;
    s.ny += (hash2(cx, cy, seed + 1) - 0.6) * 1.3;
  };
}

/** A herring lying sideways in the box (x, y, 5, 2) of its 1× ellipse: dark back, silver belly, an eye, a forked tail. */
function fishHd(c: HdCanvas, x: number, y: number, mat: number, flip: boolean, z: number, angle = 0): void {
  const cx = x + 2.5;
  const cy = y + 1;
  const part = c.newPart();
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  // The body: a slim ellipsoid along the (rotated) axis.
  c.heightField(cx - 3.2, cy - 2.4, 6.4, 4.8, (px, py) => {
    const u = ((px - cx) * ca + (py - cy) * sa) / 2.45;
    const v = (-(px - cx) * sa + (py - cy) * ca) / 0.98;
    const q = u * u + v * v;
    return q > 1 ? NaN : Math.sqrt(1 - q) * 0.9;
  }, {
    mat,
    z,
    part,
    tex: (s) => {
      const v = -(s.x - cx) * sa + (s.y - cy) * ca;
      // The blue-black back over the silver belly, a lighter lateral line.
      if (v < -0.12) s.tone -= 0.55;
      else if (v < 0.08) s.tone += 0.12;
    },
  });
  // Tail fork at the tail end.
  const tx = flip ? 2.75 : -2.75;
  const ex = cx + tx * ca;
  const ey = cy + tx * sa;
  const k = flip ? 1 : -1;
  c.poly([[ex - k * 0.2 * ca, ey], [ex + k * 1.1 * ca - 0.7 * sa, ey - 0.75], [ex + k * 0.55 * ca, ey], [ex + k * 1.1 * ca + 0.7 * sa, ey + 0.75]], { mat, z: z - 0.05, part, tone: -0.25 });
  // Eye near the head.
  const hx = cx - tx * 0.62 * ca;
  const hy = cy - tx * 0.62 * sa - 0.1;
  c.dot(hx, hy, PAL_HD.ink[1]);
  if (c.d >= 4) c.dot(hx - 0.25, hy - 0.25, PAL_HD.steel[7]);
}

/** A three-stripe flag (top-left x, y; stripes 1 logical px high) with a soft wave in the cloth. */
function flagHd(c: HdCanvas, x: number, y: number, w: number, mats: readonly number[], z: number, phase = 0): void {
  const part = c.newPart();
  c.plane(x, y, w, mats.length, {
    mat: mats[0],
    z,
    part,
    tex: (s) => {
      const i = Math.min(mats.length - 1, Math.floor(s.y - y));
      s.mat = mats[i];
      const a = (s.x - x) * 2.1 + phase;
      s.nx += Math.cos(a) * 0.55;
      s.tone += Math.sin(a) * 0.12;
    },
  });
}

// =============================================================================================
// Herring cart (48 × 38 → 50 × 40)
// =============================================================================================

function herringCart(c: HdCanvas, broken: boolean): PixelBuffer {
  const white = propMat(c, PAL_HD.gable, { lo: 3, hi: 5, spec: 0.45, shine: 18 });
  const blue = propMat(c, PAL_HD.sky, { lo: 0, hi: 5, spec: 0.4, shine: 16 });
  const navy = propMat(c, PAL_HD.navy, { lo: 0, hi: 4 });
  const steel = metalMat(c);
  const fish = metalMat(c, PAL_HD.steel, { lo: 2, hi: 6, rim: 0.2 });
  const ice = propMat(c, PAL_HD.snow, { lo: 2, hi: 5, spec: 0.8, shine: 26 });
  const red = propMat(c, PAL_HD.red, { lo: 2, hi: 6 });
  const cloth = propMat(c, PAL_HD.cloth, { lo: 2, hi: 6 });
  const glass = metalMat(c, PAL_HD.glass, { lo: 1, hi: 4, spec: 1, shine: 40 });
  const wm = wheelMats(c);
  const grime = (s: import('../../../art/hd/index').TexSample): void => {
    // Road dirt splashed up the lower panels; a few scuffs.
    if (s.y > 27) s.tone -= (s.y - 27) * 0.035 * (0.6 + noise2(s.x, s.y, 2, 5));
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), 9) > 0.985) s.tone -= 0.2;
  };
  if (broken) {
    // The kiosk keeled over: dented, scorched enamel with a torn hole into the dark inside.
    const body: [number, number][] = [[4, 38], [6, 22], [34.5, 18], [39, 34]];
    c.blob(body, 1.3, {
      mat: white,
      z: 0,
      tex: (s) => {
        grime(s);
        const dent = noise2(s.x, s.y, 3.5, 21);
        if (dent > 0.62) {
          s.nx += (dent - 0.62) * 3;
          s.ny -= (dent - 0.62) * 2;
        }
        // Scorch round the hole; the torn hole shows the dark inside.
        const hx = (s.x - 27) / 3.4;
        const hy = (s.y - 24.5) / 2.1;
        const q = hx * hx + hy * hy + (noise2(s.x, s.y, 1.2, 4) - 0.5) * 0.9;
        if (q < 1) {
          s.mat = navy;
          s.tone -= 0.6;
          s.dz = -1;
        } else if (q < 2.4) s.tone -= (2.4 - q) * 0.32;
      },
    });
    c.capsule(6.6, 22.4, 34.6, 18.4, 0.75, 0.75, { mat: white, z: 0.9, round: 0.7 });
    // A crack across the box.
    c.shade(25, 19, 6, 8, (x, y) => (Math.abs(x - (26 + (y - 19) * 0.45 + Math.sin(y * 2.2) * 0.35)) < 0.24 ? -0.9 : 0));
    // The blue band with what is left of the name.
    c.poly([[5, 30], [36, 26], [37.2, 32.5], [5, 37]], { mat: blue, z: 0.5, n: [-0.12, -0.08, 0.99] });
    letters(c, 'HAR', 12, 28, { face: PAL_HD.gable[6], lit: PAL_HD.gable[6], edge: PAL_HD.gable[4], drop: PAL_HD.sky[0] });
    // The hatch window: a dark gap with shattered glass.
    c.box(10, 22, 18, 4, { mat: navy, z: 0.45, tone: -0.2 });
    for (const [x0, y0, x1, y1, x2, y2] of [[10.4, 22.3, 13.6, 22.3, 11.2, 25.6], [15.5, 22.3, 19.8, 22.3, 18.2, 24.2], [21.8, 25.7, 27.6, 25.7, 25.6, 23.4], [24.6, 22.3, 27.6, 22.3, 27.6, 23.6]]) {
      c.poly([[x0, y0], [x1, y1], [x2, y2]], { mat: glass, z: 0.6, n: [-0.35, -0.4, 0.85] });
    }
    // The striped roof edge snapped off, on the street, its end splintered.
    c.box(30, 33, 16.6, 1.2, { mat: blue, z: 1.1, bevel: 0.4, n: [0, -0.5, 0.86] });
    for (let x = 30; x < 46; x += 3) c.box(x, 33.6, 3, 3.4, { mat: (x - 30) % 6 === 0 ? cloth : blue, z: 1, r: 1, bevel: 0.6 });
    c.poly([[46.2, 33], [47.6, 33.4], [46.4, 34.1], [47.3, 34.9], [46, 35.2]], { mat: blue, z: 1.15, tone: 0.2 });
    // The flag pole on the floor with its flag.
    c.capsule(36.5, 31.5, 46.5, 26.5, 0.5, 0.45, { mat: steel, z: 1.4 });
    flagHd(c, 43, 24, 3.2, [red, cloth], 1.5, 1.3);
    wheelHd(c, 42.5, 34.5, 3.5, wm, { z: 2, spokes: 6, seed: 3 });
    // Spilled herrings and ice.
    fishHd(c, 1.6, 34, fish, false, 2.2, 0.2);
    fishHd(c, 21.5, 35.2, fish, true, 2.2, -0.12);
    fishHd(c, 14, 16.6, fish, false, 2.3, -0.5);
    for (let i = 0; i < 9; i++) {
      const x = 8 + ((i * 13) % 23) + hash2(i, 2, 7) * 2;
      const y = 36.4 + hash2(i, 3, 7) * 1.6;
      const s = 0.45 + hash2(i, 4, 7) * 0.35;
      c.box(x, y, s * 1.4, s, { mat: ice, z: 2.4, bevel: 0.25, tex: iceTex(i) });
    }
    return done(c);
  }
  // The roof: a domed blue sheet with a lit front edge.
  c.box(2, 4, 44, 3.4, { mat: blue, z: 2, bevel: 0.8, r: 0.3, n: [0, -0.35, 0.94] });
  c.capsule(2.5, 4.4, 45.5, 4.4, 0.35, 0.35, { mat: blue, z: 2.6, round: 0.6, tone: 0.2 });
  // The striped valance: rounded cloth tongues, white and blue.
  for (let x = 2; x < 46; x += 3) c.box(x, 6.2, 3, 3.8, { mat: (x - 2) % 6 === 0 ? cloth : blue, z: 1.8, r: 0.5, bevel: 0.6, tone: (x - 2) % 6 === 0 ? 0 : -0.12 });
  // The flag on its pole.
  c.cylinder(40, -0.4, 1, 5.6, { mat: steel, z: 2.4 });
  flagHd(c, 41, 0, 5, [red, cloth, blue], 2.3);
  // The kiosk body: white enamel panels, the hatch under a lip, rivets.
  c.box(4, 10, 40, 22, {
    mat: white,
    z: 0,
    bevel: 0.9,
    tex: (s) => {
      grime(s);
      // Panel seams under the band.
      if (s.y > 28 && s.y < 30.5) for (const sx of [14, 24, 34]) if (Math.abs(s.x - sx) < 0.5 / s.d + 0.01) s.tone -= 0.5;
    },
  });
  for (const [x, y] of [[5.2, 11.2], [42.8, 11.2], [5.2, 18.8], [42.8, 18.8]]) c.ellipsoid(x, y, 0.38, 0.38, { mat: steel, z: 1.2 });
  // The hatch: the dark inside lit from below by the counter lamp (in front of the bevelled body's face at z 0.9).
  c.box(8, 11, 32, 7.3, {
    mat: navy,
    z: 1,
    tex: (s) => {
      s.tone += (s.y - 11) * 0.06 - 0.25;
    },
  });
  // The lip round the hatch (a thin raised frame) and a hinged flap propped up.
  c.box(7.4, 10.6, 33.2, 0.8, { mat: white, z: 1.6, bevel: 0.35, tone: 0.1 });
  c.box(7.4, 10.6, 0.8, 8, { mat: white, z: 1.6, bevel: 0.35 });
  c.box(39.8, 10.6, 0.8, 8, { mat: white, z: 1.6, bevel: 0.35 });
  // Crushed ice in the tray, the herrings on it, a flag pick in the first one.
  c.box(9, 15.8, 30, 2.4, { mat: ice, z: 1.3, bevel: 0.3, tex: iceTex(3) });
  for (let i = 0; i < 5; i++) fishHd(c, 10 + i * 6, 14.6, fish, (i & 1) === 1, 1.8, (i & 1 ? 0.12 : -0.1));
  c.capsule(12.6, 12.2, 12.6, 14.8, 0.14, 0.14, { mat: cloth, z: 2.6, round: 0.5 });
  c.paint(12.75, 12, 1.2, 0.9, (_x, y) => (y < 12.3 ? PAL_HD.red[5] : y < 12.6 ? PAL_HD.gable[6] : PAL_HD.sky[3]), 1e6);
  // The counter ledge.
  c.box(6, 18, 36, 1.4, { mat: steel, z: 2.2, bevel: 0.5, n: [0, -0.65, 0.76] });
  // The blue band with the name in raised white letters.
  c.box(4, 20, 40, 8, { mat: blue, z: 1.1, bevel: 0.6 });
  letters(c, 'HARING', 24, 21, { face: PAL_HD.gable[6], lit: PAL_HD.gable[6], edge: PAL_HD.gable[4], drop: PAL_HD.sky[0] }, { align: 'center' });
  // The skirt rail, the wheels, the push handle with a grip.
  c.box(4, 30.6, 40, 1.4, { mat: steel, z: 1.1, bevel: 0.45 });
  wheelHd(c, 12.5, 34.5, 4.5, wm, { z: 2, spokes: 8, seed: 1 });
  wheelHd(c, 36.5, 34.5, 4.5, wm, { z: 2, spokes: 8, seed: 2 });
  c.capsule(44.2, 28.5, 47.4, 30.1, 0.55, 0.55, { mat: steel, z: 1.2 });
  c.capsule(47.2, 30, 48.6, 30.7, 0.65, 0.65, { mat: wm.tyre, z: 1.3 });
  return done(c);
}

// =============================================================================================
// Tulip stall (48 × 36 → 50 × 38)
// =============================================================================================

const TULIP: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.pink[2], PAL.purple[2], PAL.orange[2], PAL.red[3]];

/** The HD ramp of a tulip colour and the light band range of its petals. */
function tulipRamp(c: Color): Ramp {
  return hdRampOf(c === PAL.gold[2] ? PAL.gold : c === PAL.pink[2] ? PAL.pink : c === PAL.purple[2] ? PAL.purple : c === PAL.orange[2] ? PAL.orange : PAL.red);
}

/** One tulip: a stem from (x, y1) up to the cup centred (x, y0), the cup a lit egg split at the top. */
function tulipHd(c: HdCanvas, x: number, y0: number, y1: number, cup: number, stem: number, z: number, lean = 0): void {
  c.capsule(x, y1, x + lean, y0 + 0.6, 0.2, 0.18, { mat: stem, z, round: 0.6 });
  const part = c.newPart();
  c.ellipsoid(x + lean, y0, 0.78, 1.1, {
    mat: cup,
    z: z + 0.2,
    part,
    tex: (s) => {
      // The petal split: a dark notch at the top middle, the petal edges catching light.
      const dx = s.x - (x + lean);
      if (s.y < y0 - 0.45 && Math.abs(dx) < 0.13 + (s.d >= 4 ? 0 : 0.12)) s.cut = true;
      else if (Math.abs(dx) < 0.18) s.tone -= 0.2;
    },
  });
}

function tulipStall(c: HdCanvas, broken: boolean): PixelBuffer {
  const wood = propMat(c, PAL_HD.wood, { lo: 1, hi: 6, spec: 0.15 });
  const zinc = metalMat(c, PAL_HD.steel, { lo: 1, hi: 4, spec: 0.6, shine: 16 });
  const stem = propMat(c, PAL_HD.green, { lo: 2, hi: 6 });
  const green = propMat(c, PAL_HD.green, { lo: 2, hi: 6, wrap: 0.15 });
  const cloth = propMat(c, PAL_HD.cloth, { lo: 2, hi: 6, wrap: 0.15 });
  const water = c.material({ ramp: PAL_HD.sky, flat: true, lo: 2, hi: 7 });
  const cups = TULIP.map((t) => propMat(c, tulipRamp(t), { lo: 2, hi: tulipRamp(t).length - 2, spec: 0.35, shine: 14 }));
  if (broken) {
    // The collapsed tiers: snapped planks, splinters.
    const planks: [number, number, number, number, number][] = [[2, 31.4, 19, 1.9, -0.06], [19.5, 31, 15, 1.9, 0.03], [33, 30, 14, 2, 0.09], [6, 33.2, 38, 2, 0]];
    for (const [x, y, w, h, a] of planks) {
      c.poly([[x, y], [x + w, y + a * w], [x + w, y + a * w + h], [x, y + h]], { mat: wood, z: 0.2, n: [0, -0.3, 0.95], tex: woodTex({ seed: Math.round(x) }) });
    }
    for (const [x, y] of [[18.8, 31], [33.2, 30.2], [19.6, 32.6]]) c.poly([[x, y], [x + 1.2, y - 0.8], [x + 0.5, y + 0.6]], { mat: wood, z: 0.4, tone: 0.25 });
    // The bucket on its side: the open end dark, water spilled from it.
    c.cylinder(25, 22.5, 9, 7, { mat: zinc, z: 1, axis: 'h' });
    c.ellipsoid(34, 26, 1.5, 3.4, { mat: zinc, z: 1.4, round: 0.4, tone: -0.15 });
    c.ellipsoid(34.1, 26, 1.0, 2.7, { mat: zinc, z: 1.5, round: 0, tone: -1 });
    c.plane(35, 31, 8, 1.4, { mat: water, z: 0.6, mask: (x, y) => ((x - 39) / 4) ** 2 + ((y - 31.7) / 0.7) ** 2 < 1, tex: (s) => { s.tone = 0.25 + (hash2(Math.floor(s.x * 2), 0, 5) > 0.7 ? 0.35 : 0); } });
    // Tulips scattered over the street.
    for (let i = 0; i < 12; i++) {
      const x = 3 + ((i * 7) % 42);
      const y = 28 + ((i * 5) % 6);
      c.capsule(x + 0.5, y + 0.5, x + 3.5, y + 1.5, 0.22, 0.2, { mat: stem, z: 2 });
      const cupM = cups[i % cups.length];
      c.ellipsoid(x + 4, y + 1, 0.95, 0.75, { mat: cupM, z: 2.2 });
      if (i % 3 === 0) c.ellipsoid(x + 6.3, y + 1.8, 0.45, 0.3, { mat: cupM, z: 2.1 });
      if (i % 4 === 1) c.capsule(x + 1.5, y + 1, x + 2.6, y - 0.2, 0.3, 0.12, { mat: stem, z: 2.05 });
    }
    return done(c);
  }
  // Awning: green and white canvas stripes sloping to the front, a scalloped hem.
  c.box(1, 0, 46, 5.2, {
    mat: green,
    z: 2,
    bevel: 0.5,
    n: [0, -0.4, 0.92],
    tex: (s) => {
      const k = Math.floor((s.x - 1) / 3);
      if ((k & 1) === 0) s.mat = cloth;
      // A seam shadow at each stripe's right edge, a soft sag between the ribs.
      if (s.x - 1 - k * 3 > 3 - 1 / s.d) s.tone -= 0.25;
      s.tone += Math.sin(((s.x - 1) / 46) * Math.PI * 4) * 0.08;
    },
  });
  for (let x = 1; x < 47; x += 3) c.box(x, 3.8, Math.min(3, 47 - x), 3.2, { mat: (x - 1) % 6 === 0 ? cloth : green, z: 1.8, r: 1.1, bevel: 0.7 });
  // Posts.
  for (const x of [3, 44]) c.cylinder(x, 6, 1, 30, { mat: wood, z: 0.2 });
  // Three tiers of zinc buckets with tulips.
  for (let row = 0; row < 3; row++) {
    const y = 14 + row * 7;
    c.box(5, y + 4, 38, 2, { mat: wood, z: 0.4 + row * 0.1, bevel: 0.4, n: [0, -0.3, 0.95], tex: woodTex({ seed: row + 3 }) });
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 6 + (row & 1) * 2;
      const z = 1 + row * 0.3;
      const cupM = cups[(i + row * 2) % cups.length];
      // Leaves first (behind the stems), then the stems and cups.
      c.capsule(x + 1.2, y + 1, x - 0.2, y - 1.6, 0.42, 0.1, { mat: green, z: z + 0.1 });
      c.capsule(x + 3.6, y + 1, x + 5.1, y - 1.2, 0.4, 0.1, { mat: green, z: z + 0.1 });
      for (const dx of [0, 2, 4]) tulipHd(c, x + dx + 0.5, y - 2, y + 1, cupM, stem, z + 0.2, dx === 0 ? -0.15 : dx === 4 ? 0.15 : 0);
      c.cylinder(x + 0.3, y + 1.2, 4.4, 3.8, {
        mat: zinc,
        z: z + 0.5,
        cap: 0.9,
        tex: (s) => {
          // A pressed hoop round the middle, the body a little darker than the lit rim.
          if (Math.abs(s.y - (y + 3.1)) < 0.3) s.ny += 0.6;
          else if (s.y > y + 1.8) s.tone -= 0.12;
        },
      });
    }
  }
  // The crate at the foot.
  c.box(5, 33, 38, 3, { mat: wood, z: 0.6, bevel: 0.4, tex: woodTex({ seed: 9, plank: 1.5 }) });
  return done(c);
}

// =============================================================================================
// Flea-market stall (56 × 38 → 58 × 40)
// =============================================================================================

function marketStallBreak(c: HdCanvas, broken: boolean): PixelBuffer {
  const red = propMat(c, PAL_HD.red, { lo: 2, hi: 6, wrap: 0.15 });
  const cloth = propMat(c, PAL_HD.cloth, { lo: 2, hi: 6, wrap: 0.15 });
  const steel = metalMat(c);
  const wood = propMat(c, PAL_HD.wood, { lo: 1, hi: 6, spec: 0.2 });
  const tablecloth = propMat(c, PAL_HD.sky, { lo: 0, hi: 4, wrap: 0.2 });
  const vinyl = propMat(c, PAL_HD.black, { lo: 0, hi: 4, spec: 0.9, shine: 30 });
  const brass = metalMat(c, PAL_HD.gold, { lo: 2, hi: 6 });
  const shade = propMat(c, PAL_HD.gold, { lo: 3, hi: 6, wrap: 0.3 });
  const cream = propMat(c, PAL_HD.stone, { lo: 3, hi: 6 });
  const record = (x: number, y: number, label: Color, z: number): void => {
    c.ellipsoid(x + 0.5, y + 0.5, 3.4, 3.4, {
      mat: vinyl,
      z,
      round: 0.35,
      tex: (s) => {
        // Grooves: fine rings.
        const r = Math.hypot(s.x - x - 0.5, s.y - y - 0.5);
        if (s.d >= 4 && (r * 4) % 1 < 0.25) s.tone -= 0.15;
      },
    });
    c.paint(x - 0.6, y - 0.6, 2.2, 2.2, (px, py) => (Math.hypot(px - x - 0.5, py - y - 0.5) < 1.05 ? (Math.hypot(px - x - 0.5, py - y - 0.5) < 0.3 ? PAL_HD.ink[0] : label) : 0), 1e6);
  };
  if (broken) {
    // The awning down on the table, torn; the stripes follow the fold.
    const aw: [number, number][] = [[2, 30], [28, 24], [54.5, 31], [54.5, 37.5], [2, 37.5]];
    c.blob(aw, 1.4, {
      mat: red,
      z: 0.5,
      tex: (s) => {
        const ridge = s.x < 28 ? 30 - (s.x - 2) * (6 / 26) : 24 + (s.x - 28) * (7 / 26.5);
        // The stripes hang straight down from the ridge (4 white of every 8, as on the stall).
        const k = Math.floor((s.x - 1) / 4);
        if ((k & 1) === 0) s.mat = cloth;
        // Folds where the canvas slumps over the goods, deeper away from the ridge.
        const depth = s.y - ridge;
        s.nx += Math.sin(s.x * 0.7 + depth * 0.35) * 0.45 * Math.min(1, depth / 4);
        s.tone -= Math.max(0, depth - 5) * 0.05;
        // A tear.
        if (Math.abs(s.x - 40 - (s.y - 30) * 0.5) < 0.25 && s.y > 29 && s.y < 34.5) s.cut = true;
      },
    });
    record(13.5, 32.5, PAL_HD.red[5], 3.2);
    // The radio smashed: its case split, the dial knocked out.
    c.box(36, 32, 7, 4, { mat: wood, z: 1.6, bevel: 0.5, tex: woodTex({ seed: 4 }) });
    c.shade(36, 32, 7, 4, (x, y) => (Math.abs(x - 39.2 - (y - 32) * 0.4) < 0.2 ? -0.8 : 0));
    c.ellipsoid(38.4, 34, 1.1, 1.1, { mat: cream, z: 1.9 });
    c.ellipsoid(45.5, 36.4, 0.5, 0.5, { mat: brass, z: 2 });
    // The snapped table board.
    c.capsule(4.5, 36.4, 26, 35.6, 0.65, 0.6, { mat: wood, z: 2.2, round: 0.6 });
    c.capsule(27.2, 35.2, 50.5, 34.4, 0.6, 0.65, { mat: wood, z: 2.2, round: 0.6 });
    c.poly([[25.6, 35], [27.6, 34.6], [26.6, 35.6], [27.8, 36.3], [26, 36.6]], { mat: wood, z: 2.3, tone: 0.3 });
    // Bent posts sticking out, books spilled over the canvas.
    c.capsule(52.5, 37.5, 55.4, 30.5, 0.5, 0.45, { mat: steel, z: 0.3 });
    c.capsule(3.5, 37.5, 1.2, 31.2, 0.5, 0.45, { mat: steel, z: 0.3 });
    const books: readonly Ramp[] = [PAL_HD.teal, PAL_HD.purple, PAL_HD.gold];
    books.forEach((r, k) => {
      const bm = propMat(c, r, { lo: 1, hi: r.length - 3 });
      const bx = 20 + k * 4.6;
      const by = 26.6 + k * 0.4;
      const a = (k - 1) * 0.35;
      c.poly([[bx, by], [bx + 3.2 * Math.cos(a), by + 3.2 * Math.sin(a)], [bx + 3.2 * Math.cos(a) - 1.6 * Math.sin(a), by + 3.2 * Math.sin(a) + 1.6 * Math.cos(a)], [bx - 1.6 * Math.sin(a), by + 1.6 * Math.cos(a)]], { mat: bm, z: 3.2, n: [-0.2, -0.5, 0.85] });
    });
    return done(c);
  }
  // The red-white awning: a canvas roof with stripes, a scalloped hem.
  c.box(1, 0, 54, 6.2, {
    mat: red,
    z: 2,
    bevel: 0.5,
    n: [0, -0.4, 0.92],
    tex: (s) => {
      const k = Math.floor((s.x - 1) / 4);
      if ((k & 1) === 0) s.mat = cloth;
      if (s.x - 1 - k * 4 > 4 - 1 / s.d) s.tone -= 0.25;
      s.tone += Math.sin(((s.x - 1) / 54) * Math.PI * 5) * 0.08;
    },
  });
  for (let x = 1; x < 55; x += 2) c.box(x, 5.2, 2, 2.8, { mat: (x - 1) % 8 < 4 ? cloth : red, z: 1.8, r: 0.9, bevel: 0.6 });
  for (const x of [3, 52]) c.cylinder(x, 7, 1, 31, { mat: steel, z: 0.2 });
  // The table: a board with a lit front edge, a blue cloth with folds hanging to the street.
  c.box(4, 24, 48, 3, { mat: wood, z: 1, bevel: 0.5, n: [0, -0.35, 0.94], tex: woodTex({ seed: 2 }) });
  c.box(6, 27, 44, 8.4, {
    mat: tablecloth,
    z: 0.9,
    tex: (s) => {
      // Soft folds of uneven width, deeper towards the hem.
      const f = Math.sin((s.x - 6) * 1.1 + noise2(s.x, 0, 3, 8) * 4) * 0.55;
      s.nx += f * Math.min(1, (s.y - 26) / 5);
      if (s.y > 34.4) s.tone -= 0.25;
    },
  });
  // Records, a radio, a lamp, books.
  record(10, 20, PAL_HD.red[5], 1.4);
  record(17, 21, PAL_HD.gold[5], 1.5);
  c.box(22, 17, 9, 7, { mat: wood, z: 1.4, bevel: 0.6, r: 0.6, tex: woodTex({ seed: 7 }) });
  c.ellipsoid(25.5, 20.5, 2.3, 2.3, {
    mat: cream,
    z: 1.6,
    round: 0.3,
    tex: (s) => {
      // Speaker grille.
      if (s.d >= 4 && (Math.floor(s.x * 2) + Math.floor(s.y * 2)) % 2 === 0) s.tone -= 0.3;
    },
  });
  c.box(28, 18, 2, 4, { mat: cream, z: 1.6, bevel: 0.3 });
  c.ellipsoid(29, 22.6, 0.45, 0.45, { mat: brass, z: 1.8 });
  c.capsule(23.5, 17.2, 21.2, 13.8, 0.12, 0.1, { mat: steel, z: 1.3, round: 0.5 });
  c.cylinder(36, 14, 1, 10, { mat: brass, z: 1.3 });
  c.box(34.4, 23, 4.2, 1, { mat: brass, z: 1.35, bevel: 0.3 });
  c.blob([[33, 14.6], [39.2, 14.6], [37.6, 10], [34.6, 10]], 0.7, { mat: shade, z: 1.6, bulge: 0.2 });
  const books: readonly Ramp[] = [PAL_HD.teal, PAL_HD.red, PAL_HD.gold, PAL_HD.purple];
  for (let i = 0; i < 4; i++) {
    const bm = propMat(c, books[i], { lo: 1, hi: books[i].length - 3 });
    c.box(42 + i * 2, 17 + (i & 1), 2, 7 - (i & 1), {
      mat: bm,
      z: 1.4,
      bevel: 0.35,
      tex: (s) => {
        // Gilt bands on the spine.
        if (Math.abs(s.y - (19.4 + (i & 1))) < 0.25) s.mat = brass;
      },
    });
  }
  return done(c);
}

// =============================================================================================
// Bike rack (52 × 24 → 54 × 26)
// =============================================================================================

const BIKE_PAINT: readonly Ramp[] = [PAL_HD.black, PAL_HD.red, PAL_HD.teal];

function bikeRack(c: HdCanvas, broken: boolean): PixelBuffer {
  const steel = metalMat(c, PAL_HD.steel, { lo: 2, hi: 6 });
  const tyre = propMat(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.3, shine: 14 });
  const saddle = propMat(c, PAL_HD.brown, { lo: 1, hi: 6, spec: 0.4, shine: 16 });
  const chain = metalMat(c, PAL_HD.gold, { lo: 2, hi: 6 });
  const paints = BIKE_PAINT.map((r) => c.material({ ramp: r, spec: 0.8, shine: 26, wrap: 0.05, rim: 0.3, lo: r === PAL_HD.black ? 1 : 2, hi: r.length - 2 }));
  const wm: WheelMats = { tyre, rim: steel, hub: steel };
  if (broken) {
    c.box(2, 23, 49, 1, { mat: steel, z: 0, bevel: 0.35, n: [0, -0.5, 0.86] });
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 15;
      // A buckled wheel: a squashed, kinked tyre ring with bent spokes.
      c.heightField(x - 0.5, 17.5, 12, 7, (px, py) => {
        const kink = Math.sin((px - x) * 1.3 + i) * 0.35;
        const q = Math.hypot((px - x - 5.5) / 5.4, (py - 21 - kink) / 2.9) - 0.82;
        return Math.abs(q) > 0.16 ? NaN : (0.16 - Math.abs(q)) * 4;
      }, { mat: tyre, z: 0.5 });
      c.capsule(x + 2.5, 19.5, x + 9.5, 21.5, 0.12, 0.12, { mat: steel, z: 0.4, round: 0.5 });
      c.capsule(x + 6, 19, x + 5.5, 23.5, 0.12, 0.12, { mat: steel, z: 0.4, round: 0.5 });
      // The bent frame tube and the loose bell.
      c.stroke([[x - 1.5, 20.5], [x + 4, 19.6], [x + 10.5, 17.5]], 0.55, 0.5, { mat: paints[i], z: 1 });
      c.heightField(x + 7.4, 19.4, 4.2, 4.2, (px, py) => {
        const q = Math.hypot(px - x - 9.5, py - 21.5) - 1.6;
        return Math.abs(q) > 0.35 ? NaN : 0.4;
      }, { mat: steel, z: 1.2 });
    }
    return done(c);
  }
  // The rack: a base rail and hoops (round tubes) with a lit front.
  c.cylinder(1, 22, 51, 1.2, { mat: steel, z: 0, axis: 'h' });
  for (let x = 4; x < 50; x += 8) c.stroke([[x + 0.5, 22.5], [x + 0.5, 13.4], [x + 1.6, 12.4], [x + 3.4, 12.4], [x + 4.5, 13.4], [x + 4.5, 22.5]], 0.45, 0.45, { mat: steel, z: 0.2 });
  // Three bikes, front wheels in the rack.
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 16;
    const p = paints[i];
    for (const wx of [x, x + 12]) wheelHd(c, wx + 0.5, 17.5, 5.5, wm, { z: 0.6, spokes: 8, tyre: 0.9, seed: i * 2 + wx });
    const z = 1.2;
    // Frame tubes (the 1× lines through the pixel centres), lit enamel.
    c.capsule(x + 0.5, 17.5, x + 6.5, 17.5, 0.45, 0.45, { mat: p, z });
    c.capsule(x + 6.5, 17.5, x + 4.5, 9.5, 0.5, 0.45, { mat: p, z });
    c.capsule(x + 6.5, 17.5, x + 10.5, 10.5, 0.5, 0.45, { mat: p, z });
    c.capsule(x + 10.5, 8.5, x + 12.5, 17.5, 0.45, 0.4, { mat: p, z: z + 0.1 });
    c.capsule(x + 4.5, 9.5, x + 0.5, 17.5, 0.4, 0.4, { mat: p, z });
    c.capsule(x + 4.5, 9.8, x + 10.5, 10.4, 0.42, 0.42, { mat: p, z });
    // The chain wheel, the saddle, the handlebar and its grip.
    c.ellipsoid(x + 6.5, 17.5, 1.1, 1.1, { mat: steel, z: z + 0.2 });
    c.blob([[x + 2, 8], [x + 7, 7.8], [x + 6.6, 9.1], [x + 2.4, 9.2]], 0.5, { mat: saddle, z: z + 0.3 });
    c.capsule(x + 9.3, 7.6, x + 12.6, 7.4, 0.32, 0.32, { mat: steel, z: z + 0.3 });
    c.capsule(x + 12.4, 7.4, x + 13.4, 7.8, 0.42, 0.42, { mat: tyre, z: z + 0.4 });
    if (i === 1) for (let k = 0; k < 5; k++) c.ellipsoid(x + 11.4 + k * 0.55, 19.4 + (k & 1) * 0.5, 0.36, 0.3, { mat: chain, z: z + 0.6 });
  }
  return done(c);
}

// =============================================================================================
// Registration
// =============================================================================================

const DRAWERS: Readonly<Record<string, (c: HdCanvas, broken: boolean) => PixelBuffer>> = {
  'ams-herring-cart': herringCart,
  'ams-tulip-stall': tulipStall,
  'ams-market-stall': marketStallBreak,
  'ams-bike-rack': bikeRack,
};

/** The HD frames of breakable `id` (0 intact, 1 wrecked) at density d. */
export function breakableHd(id: string, d: number): Frame[] {
  const draw = DRAWERS[id];
  return hdStrip(`${D}${id}`, d, (c, i) => draw(c, i === 1));
}

/** id → HD generator of the four breakables (registered by art-hd-cd.ts). */
export const BREAKABLES_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = Object.keys(DRAWERS).map((id) => [`${D}${id}`, (d: number) => breakableHd(id, d)] as const);
