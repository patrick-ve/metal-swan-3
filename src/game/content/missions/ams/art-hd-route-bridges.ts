/**
 * UHD art (d 2 and 4) of the canal cruise's bridges and Carré (mission ams, section c2;
 * docs/design/ams-extras.md §4; 1× art in art-route.ts). ONE drawer per id on an `HdCanvas` of its
 * 1× frame's logical size (`hdStrip`: the 1× anchor), PAL_HD only.
 *
 * - `decor/ams/low-bridge` (the near face of a low brick bridge, front decor: outline C): a dressed
 *   sandstone coping with joints, brick in running bond with recessed mortar and damp at the
 *   bottom, the stone beam with slanted yellow-and-black clearance stripes, the white enamel bridge
 *   number plate.
 * - `decor/ams/low-bridge/back` (outline C): the iron railing over the walkway with a classic
 *   Amsterdam lantern on its post, the dark vault under the deck with the far opening's light on
 *   the water, the brick piers into the river with a green wet foot.
 * - `decor/ams/magere-brug/back` (outline C): the two white timber portals of the Magere Brug:
 *   posts, cross beams, X braces, iron straps and bolts, and its famous strings of light bulbs
 *   along every beam; the stone piers into the river.
 * - `decor/ams/magere-brug` (4 frames, the leaves lifting 0° → 80°; it moves: outline A): per side
 *   the white bascule leaf (plank deck, a deep girder with a moulded lower edge and bolts, the
 *   white lattice railing with bulbs on the posts) and the balance beam over the portal with its
 *   bulbs, tilting with the leaf, the iron rods down to the leaf tip.
 * - `decor/ams/carre` (far across the river, painted: no outline): Royal Theatre Carré in warm
 *   plaster with cornices and pilasters, slate roofs with turrets and domes, arched windows in
 *   the low sun, the name over the tall centre windows, the arcade and the roofline figures.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { brick as brickTex, plaster as plasterTex, wood as woodTex, type TexSample } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { lightHd } from './art-hd-ab-kit';
import { decoMat, glowMat, HdCanvas, hdStrip, letters, metalMat, propMat } from './art-hd-cd-kit';
import { CARRE, LOW_BACK, LOW_FACE, MAGERE_ANGLES, MAGERE_BACK, MAGERE_LEAVES, MAGERE_PORTAL } from './art-route';
import { LOW_BRIDGE, MAGERE_BRUG } from './cruise';

const D = 'decor/ams/';
const DEG = Math.PI / 180;

/** Painted timber: a fifth of the grain shows through the white paint; chips at 4×. */
function paintedTimber(seed: number, dir: 'h' | 'v'): (s: TexSample) => void {
  const g = woodTex({ seed, dir });
  return (s) => {
    const t0 = s.tone;
    g(s);
    s.tone = t0 + (s.tone - t0) * 0.2;
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed) > 0.994) s.tone -= 0.25;
  };
}

/** A glowing bulb (hot at the filament, warm at the rim). */
function bulb(c: HdCanvas, x: number, y: number, mat: number, z: number, r = 0.75): void {
  c.ellipsoid(x, y, r, r, {
    mat,
    z,
    tex: (s) => {
      s.tone = 0.95 - Math.hypot(s.x - x + 0.2, s.y - y + 0.2) * (0.55 / r);
    },
  });
}

function bolt(c: HdCanvas, x: number, y: number, mat: number, z: number): void {
  c.ellipsoid(x, y, 0.42, 0.42, { mat, z });
}

// =============================================================================================
// Low bridges: the near face (64 × 17, ox 32, oy 1 = the walkway)
// =============================================================================================

function lowFaceHd(c: HdCanvas): PixelBuffer {
  const { w, oy } = LOW_FACE;
  const under = oy + LOW_BRIDGE.under - LOW_BRIDGE.top;
  const sand = decoMat(c, PAL_HD.sand, { lo: 2, hi: 6, spec: 0.15, edge: 'C' });
  const brick = decoMat(c, PAL_HD.brick, { lo: 1, hi: 6, edge: 'C' });
  const mortar = decoMat(c, PAL_HD.stone, { lo: 1, hi: 4, edge: 'C' });
  const stone = decoMat(c, PAL_HD.stone, { lo: 1, hi: 6, spec: 0.2, edge: 'C' });
  const yellow = decoMat(c, PAL_HD.gold, { lo: 4, hi: 7, spec: 0.3, edge: 'C' });
  const black = decoMat(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.3, edge: 'C' });
  const enamel = decoMat(c, PAL_HD.snow, { lo: 3, hi: 6, spec: 0.5, shine: 20, edge: 'C' });
  const navy = decoMat(c, PAL_HD.navy, { lo: 1, hi: 4, edge: 'C' });
  // The brick face: running bond, damp and darker towards the water.
  c.box(2, oy + 2, w - 4, under - oy - 6, {
    mat: brick,
    z: 0,
    bevel: 0.2,
    tex: (s) => {
      brickTex({ mortar, bw: 4, bh: 2, wear: 0.6, seed: 21, oy: oy + 2 })(s);
      s.tone -= Math.max(0, s.y - (under - 8)) * 0.07;
    },
  });
  // The dressed sandstone coping: blocks with joints every 8 px, a lit nosing, the drip shadow.
  c.box(0.5, oy - 0.2, w - 1, 2.4, {
    mat: sand,
    z: 1,
    bevel: 0.5,
    n: [0, -0.45, 0.89],
    tex: (s) => {
      if ((s.x - 0.5) % 8 < Math.max(0.5, 1 / s.d)) {
        s.tone -= 0.4;
        s.dz = -0.2;
      }
      s.tone += (noise2(s.x, s.y, 2, 4) - 0.5) * 0.2;
    },
  });
  // The stone beam over the arch with the slanted clearance stripes.
  c.box(2, under - 4, w - 4, 4, {
    mat: stone,
    z: 0.6,
    bevel: 0.5,
    tex: (s) => {
      if (s.y < under - 3.4) s.ny -= 0.6;
      s.tone += (noise2(s.x, s.y, 2.5, 6) - 0.5) * 0.18;
    },
  });
  c.box(5, under - 3, w - 10, 2, {
    mat: yellow,
    z: 0.9,
    bevel: 0.25,
    tex: (s) => {
      if (Math.floor((s.x - s.y * 0.8) / 3) & 1) s.mat = black;
      // Worn paint: a few scuffs at 4×.
      if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), 7) > 0.97) s.tone -= 0.3;
    },
  });
  // The bridge number on a white enamel plate (a navy rim and the number as a short dash).
  const px = (w >> 1) - 5;
  c.box(px, oy + 3, 10, 5, { mat: enamel, z: 1.4, bevel: 0.4, r: 0.6 });
  c.box(px + 0.6, oy + 3.6, 8.8, 3.8, {
    mat: enamel,
    z: 1.6,
    bevel: 0.2,
    tex: (s) => {
      const e = Math.max(0.25, 1 / s.d);
      if (s.x - px - 0.6 < e || px + 9.4 - s.x < e || s.y - oy - 3.6 < e || oy + 7.4 - s.y < e) s.mat = navy;
    },
  });
  c.box((w >> 1) - 3, oy + 5, 6, 1, { mat: navy, z: 1.9, bevel: 0.1 });
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.2, shadowMax: 1.5 });
}

// =============================================================================================
// Low bridges: the back (68 × 116, ox 34, oy 28 = the walkway)
// =============================================================================================

function lowBackHd(c: HdCanvas): PixelBuffer {
  const { w, oy } = LOW_BACK;
  const under = oy + LOW_BRIDGE.under - LOW_BRIDGE.top;
  const water = oy + 180 - LOW_BRIDGE.top;
  const brick = decoMat(c, PAL_HD.brickDark, { lo: 1, hi: 5, edge: 'C' });
  const mortar = decoMat(c, PAL_HD.stone, { lo: 0, hi: 3, edge: 'C' });
  const vault = decoMat(c, PAL_HD.ink, { lo: 0, hi: 1, edge: 'C' });
  const dusk = decoMat(c, PAL_HD.navy, { lo: 0, hi: 3, edge: 'C' });
  const moss = decoMat(c, PAL_HD.moss, { lo: 1, hi: 4, edge: 'C' });
  const iron = metalMat(c, PAL_HD.black, { lo: 1, hi: 5, edge: 'C', spec: 0.5 });
  const glassM = glowMat(c, PAL_HD.gold, 4, 7, { edge: 'C' });
  // The dark vault under the deck: the far side's opening lets in a band of light on the water.
  c.box(4, oy, w - 8, under - oy + 18, {
    mat: vault,
    z: -1,
    bevel: 0,
    tex: (s) => {
      const k = s.y - under;
      if (k >= 0 && k < 7) {
        s.mat = dusk;
        // Ripples of light from the far opening.
        s.tone += 0.15 + Math.sin(s.x * 1.3 + k * 2.1) * 0.15 - k * 0.06;
      } else if (k >= 7) s.tone -= 0.3;
    },
  });
  // The brick piers, from the walkway into the river: a green wet foot at the water line.
  for (const x of [1, w - 7]) {
    c.box(x, oy, 6, water - oy + 10, {
      mat: brick,
      z: 0,
      bevel: 0.35,
      tex: (s) => {
        brickTex({ mortar, bw: 3, bh: 2, wear: 0.7, seed: 30 + x, ox: x })(s);
        if (s.y > water - 3) {
          if (s.y < water + 1 && noise2(s.x * 2, s.y * 1.4, 1.5, 9 + x) > 0.45) s.mat = moss;
          else s.tone -= s.y < water - 1.5 ? 0.2 : 0.45;
        }
      },
    });
  }
  // The iron railing: a top rail, a middle rail and posts every 5 px with ball finials.
  c.box(2, oy - 9, w - 4, 1, { mat: iron, z: 0.8, bevel: 0.3 });
  c.box(2, oy - 5, w - 4, 0.8, { mat: iron, z: 0.6, bevel: 0.25 });
  for (let x = 3; x < w - 2; x += 5) {
    c.box(x - 0.2, oy - 9, 0.9, 8.6, { mat: iron, z: 0.7, bevel: 0.3 });
    c.ellipsoid(x + 0.25, oy - 9.4, 0.55, 0.55, { mat: iron, z: 1 });
  }
  // The lantern on its post (a classic Amsterdam lamp: a fluted black post, the glass lantern
  // glowing in the low sun, a black crown).
  const cx = w >> 1;
  c.cylinder(cx - 0.4, oy - 21, 2.2, 20, { mat: iron, z: 1.4, axis: 'v' });
  c.box(cx - 1.4, oy - 3, 4.2, 2.4, { mat: iron, z: 1.6, bevel: 0.5 });
  c.poly(
    [
      [cx - 3, oy - 27],
      [cx + 4, oy - 27],
      [cx + 3, oy - 21],
      [cx - 2, oy - 21],
    ],
    {
      mat: glassM,
      z: 2,
      tex: (s) => {
        s.tone = 0.9 - Math.abs(s.x - cx - 0.5) * 0.1 - Math.max(0, s.y - (oy - 24)) * 0.08;
        // The lantern's frame bars.
        if (Math.abs(s.x - cx - 0.5) < 0.3) s.mat = iron;
      },
    },
  );
  c.box(cx - 3.4, oy - 28.4, 7.8, 1.6, { mat: iron, z: 2.2, bevel: 0.5 });
  c.ellipsoid(cx + 0.5, oy - 28.8, 1, 0.7, { mat: iron, z: 2.3 });
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.2, shadowMax: 2 });
}

// =============================================================================================
// The Magere Brug: the portals (128 × 156, ox 64, oy 72 = the walkway)
// =============================================================================================

function whiteMats(c: HdCanvas, prop = false): { white: number; iron: number; bulb: number; moss: number; stone: number } {
  const m = prop ? propMat : decoMat;
  return {
    white: m(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.25, shine: 14, ...(prop ? {} : { edge: 'C' as const }) }),
    iron: metalMat(c, PAL_HD.slate, { lo: 1, hi: 5, spec: 0.6, ...(prop ? {} : { edge: 'C' as const }) }),
    bulb: glowMat(c, PAL_HD.gold, 4, 7, prop ? {} : { edge: 'C' }),
    moss: decoMat(c, PAL_HD.moss, { lo: 1, hi: 4, edge: 'C' }),
    stone: decoMat(c, PAL_HD.stone, { lo: 1, hi: 6, edge: 'C' }),
  };
}

function magereBackHd(c: HdCanvas): PixelBuffer {
  const { w, oy } = MAGERE_BACK;
  const top = MAGERE_PORTAL.top;
  const water = oy + 180 - MAGERE_BRUG.top;
  const m = whiteMats(c);
  // The stone piers in the river: dressed blocks, a wet dark band and algae at the water line.
  for (const x of [1, w - 15]) {
    c.box(x, oy + 12, 14, water - oy - 2, {
      mat: m.stone,
      z: -0.5,
      bevel: 0.5,
      tex: (s) => {
        const row = Math.floor((s.y - oy - 12) / 4);
        if ((s.y - oy - 12) % 4 < Math.max(0.5, 1 / s.d) || (s.x - x + (row & 1) * 3.5) % 7 < Math.max(0.5, 1 / s.d)) {
          s.tone -= 0.35;
          s.dz = -0.2;
        }
        s.tone += (hash2(Math.floor((s.x - x + (row & 1) * 3.5) / 7), row, 41) - 0.5) * 0.2;
        if (s.y > water - 4) {
          if (s.y < water + 0.6 && noise2(s.x * 2, s.y * 1.5, 1.5, 11 + x) > 0.5) s.mat = m.moss;
          else s.tone -= s.y < water - 2 ? 0.25 : 0.5;
        }
      },
    });
  }
  for (const side of [0, 1]) {
    const x0 = side === 0 ? MAGERE_PORTAL.posts[0] : MAGERE_PORTAL.posts[2];
    // The two posts: square white timbers with iron straps.
    for (const x of [x0, x0 + 7]) {
      c.box(x, top, 3, oy + 13 - top, { mat: m.white, z: 0, bevel: 0.6, tex: paintedTimber(x + 3, 'v') });
      for (let y = top + 14; y < oy + 8; y += 16) {
        c.box(x - 0.2, y, 3.4, 1, { mat: m.iron, z: 0.8, bevel: 0.3 });
        bolt(c, x + 1.5, y + 0.5, m.iron, 1.1);
      }
    }
    // The X braces between the posts (one a little nearer at the crossing), an iron gusset.
    c.capsule(x0 + 2.5, top + 4.5, x0 + 8, oy - 10.5, 0.6, 0.6, { mat: m.white, z: -0.3, round: 0.7 });
    c.capsule(x0 + 8, top + 4.5, x0 + 2.5, oy - 10.5, 0.6, 0.6, { mat: m.white, z: -0.15, round: 0.7 });
    // The cross beams: the top one with its lit cap, the lower one over the walkway.
    c.box(x0 - 2, top, 14, 3, { mat: m.white, z: 1, bevel: 0.7, tex: paintedTimber(x0 + 9, 'h') });
    c.box(x0 - 2.3, top - 0.5, 14.6, 1, { mat: m.white, z: 1.4, bevel: 0.4, n: [0, -0.6, 0.8] });
    c.box(x0 - 1, oy - 10, 12, 2, { mat: m.white, z: 0.8, bevel: 0.5, tex: paintedTimber(x0 + 5, 'h') });
    for (const bx of [x0 + 1.5, x0 + 8.5]) bolt(c, bx, top + 1.5, m.iron, 1.8);
    // The strings of light bulbs along the posts and over the top beam.
    for (let y = top + 6; y < oy; y += 6) {
      bulb(c, x0 - 0.6, y + 0.5, m.bulb, 1.6, 0.65);
      bulb(c, x0 + 10.6, y + 0.5, m.bulb, 1.6, 0.65);
    }
    for (let x = x0 - 1; x < x0 + 12; x += 3) bulb(c, x + 0.5, top - 0.9, m.bulb, 1.8, 0.65);
  }
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.22, shadowMax: 2 });
}

// =============================================================================================
// The Magere Brug: the bascule leaves (4 frames, 128 × 104, ox 64, oy 82 = the walkway)
// =============================================================================================

function magereLeavesHd(c: HdCanvas, deg: number): PixelBuffer {
  const { ox, oy } = MAGERE_LEAVES;
  const m = whiteMats(c, true);
  const deckM = propMat(c, PAL_HD.wood, { lo: 2, hi: 6, spec: 0.15 });
  const a = deg * DEG;
  const half = MAGERE_BRUG.gap / 2;
  const thick = MAGERE_BRUG.under - MAGERE_BRUG.top;
  const beamY = oy - (MAGERE_BRUG.top - 50) + 3;
  for (const s of [-1, 1]) {
    // The leaf pivots at its outer end (the portal), its tip at the middle (the 1× geometry).
    const px = ox + s * half;
    const py = oy + thick / 2;
    const len = half;
    const ux = -s * Math.cos(a);
    const uy = -Math.sin(a);
    // "Up" from the deck: perpendicular to the leaf, away from the water (flat: straight up).
    const upx = s < 0 ? uy : -uy;
    const upy = s < 0 ? -ux : ux;
    const at = (k: number, h: number): [number, number] => [px + ux * len * k + upx * h, py + uy * len * k + upy * h];
    const quad = (k0: number, k1: number, h0: number, h1: number): [number, number][] => [at(k0, h0), at(k1, h0), at(k1, h1), at(k0, h1)];
    // The girder (the slab's side): a deep white beam with a moulded lower edge and bolts.
    c.poly(quad(0, 1, -thick / 2, thick / 2 - 2), {
      mat: m.white,
      z: 0,
      tex: (t) => {
        paintedTimber(7 + s, 'h')(t);
        // Height above the lower edge, along the leaf.
        const hx = t.x - px;
        const hy = t.y - py;
        const h = hx * upx + hy * upy + thick / 2;
        const k = (hx * ux + hy * uy) / len;
        if (h < 1.2) t.tone -= 0.3;
        else if (h < 2) t.tone += 0.15;
        if (h > thick - 4.5) t.tone -= 0.25;
        if (t.d >= 4 && Math.abs(h - 4.5) < 0.35 && (k * len) % 6 < 0.6) t.tone -= 0.45;
      },
    });
    // The plank deck on top (the walkway seen edge-on), its lit edge.
    c.poly(quad(0, 1, thick / 2 - 2, thick / 2), {
      mat: deckM,
      z: 0.4,
      tex: (t) => {
        woodTex({ seed: 5 + s, dir: 'h' })(t);
        t.tone += 0.2;
      },
    });
    // The lattice railing: posts every ~10 px with bulbs, the handrail and the diagonals.
    const rail = 7;
    for (let k = 0.04; k <= 1.0001; k += 0.19) {
      const [bx, by] = at(k, thick / 2);
      const [rx, ry] = at(k, thick / 2 + rail);
      c.capsule(bx, by, rx, ry, 0.55, 0.5, { mat: m.white, z: 1, round: 0.6 });
      bulb(c, rx + upx * 0.9, ry + upy * 0.9, m.bulb, 1.8, 0.7);
      if (k + 0.19 <= 1.0001) {
        const [nx2, ny2] = at(k + 0.19, thick / 2 + rail);
        const [mx, my] = at(k + 0.19, thick / 2);
        c.capsule(bx, by, nx2, ny2, 0.3, 0.3, { mat: m.white, z: 0.6, round: 0.6 });
        c.capsule(rx, ry, mx, my, 0.3, 0.3, { mat: m.white, z: 0.7, round: 0.6 });
      }
    }
    const [h0x, h0y] = at(0.04, thick / 2 + rail);
    const [h1x, h1y] = at(1, thick / 2 + rail);
    c.capsule(h0x, h0y, h1x, h1y, 0.6, 0.6, { mat: m.white, z: 1.3, round: 0.8 });
    // The balance beam over the portal: it tilts with the leaf (the inner end rises).
    const bx0 = ox + s * (half + 8);
    const bx1 = ox + s * 8;
    const by0 = beamY + Math.sin(a) * 6;
    const by1 = beamY - Math.sin(a) * 18;
    c.capsule(bx0, by0, bx1, by1, 1.5, 1.4, { mat: m.white, z: 1.5, round: 0.8, tex: paintedTimber(11 + s, 'h') });
    for (let k = 0.1; k < 1; k += 0.18) bulb(c, bx0 + (bx1 - bx0) * k, by0 + (by1 - by0) * k - 2, m.bulb, 2.4, 0.7);
    // The iron rods from the beam's inner end down to the leaf tip.
    const [tx2, ty2] = at(1, thick / 2);
    c.capsule(bx1, by1 + 1, tx2, ty2, 0.35, 0.35, { mat: m.iron, z: 1.2, round: 0.8 });
    c.capsule(bx1 - s * 1.2, by1 + 1, tx2 - s * 1.2 * Math.cos(a), ty2, 0.3, 0.3, { mat: m.iron, z: 1.1, round: 0.8 });
    bolt(c, bx1, by1 + 1, m.iron, 2);
  }
  return c.render({ outline: 'A', ao: 0.3, sepZ: 0.3, shadow: 0.2, shadowMax: 2, rimLight: 2 });
}

// =============================================================================================
// Carré (176 × 84, feet; painted, far across the river: no outline)
// =============================================================================================

function carreHd(c: HdCanvas): PixelBuffer {
  const { w, h } = CARRE;
  const plasterM = decoMat(c, PAL_HD.plaster, { lo: 2, hi: 6 });
  const plasterLit = decoMat(c, PAL_HD.sand, { lo: 3, hi: 7 });
  const roofM = decoMat(c, PAL_HD.slate, { lo: 1, hi: 5, spec: 0.3 });
  const domeM = decoMat(c, PAL_HD.slate, { lo: 3, hi: 6, spec: 0.5, shine: 16 });
  const glass = c.material({ ramp: PAL_HD.navy, flat: true, lo: 0, hi: 4 });
  const sunGlass = c.material({ ramp: PAL_HD.gold, flat: true, lo: 3, hi: 7 });
  const dark = decoMat(c, PAL_HD.ink, { lo: 0, hi: 1 });
  const gold = metalMat(c, PAL_HD.gold, { lo: 3, hi: 7 });
  const red = decoMat(c, PAL_HD.red, { lo: 2, hi: 5 });
  const wall = (seed: number) => plasterTex({ seed, cracks: 0.03, stains: 0.3 });
  // The wings: two storeys over the arcade, a cornice and a slate roof.
  c.box(0, 30, w, h - 30, { mat: plasterM, z: 0, bevel: 0.2, tex: wall(3) });
  c.box(0, 24, w, 6, {
    mat: roofM,
    z: -0.5,
    bevel: 0.3,
    n: [0, -0.6, 0.8],
    tex: (s) => {
      if ((s.y - 24) % 1.5 < Math.max(0.25, 1 / s.d)) s.tone -= 0.3;
    },
  });
  c.box(0, 29.4, w, 1.4, { mat: plasterLit, z: 0.6, bevel: 0.4, n: [0, -0.5, 0.86] });
  c.box(0, 50.6, w, 1, { mat: plasterLit, z: 0.4, bevel: 0.3, n: [0, -0.5, 0.86] });
  // Pilasters between the window bays.
  for (let x = 4.5; x < w - 4; x += 9) c.box(x - 0.5, 31, 1, 37, { mat: plasterLit, z: 0.3, bevel: 0.3, tone: -0.05 });
  // The centre block: taller, with the curved pediment and the name.
  const c0 = 58;
  const c1 = 118;
  c.box(c0, 12, c1 - c0, h - 12, { mat: plasterLit, z: 1, bevel: 0.4, tex: wall(5) });
  c.plane(c0 + 4, 0, c1 - c0 - 8, 14, {
    mat: plasterLit,
    z: 1.2,
    mask: (x, y) => {
      const t = (x - c0 - 4) / (c1 - c0 - 8);
      return y >= 4 - Math.sin(t * Math.PI) * 4;
    },
    tex: (s) => {
      const t = (s.x - c0 - 4) / (c1 - c0 - 8);
      const edge = 4 - Math.sin(t * Math.PI) * 4;
      if (s.y - edge < 1) s.ny -= 0.6;
      else if (s.y - edge < 1.6) s.tone -= 0.2;
    },
  });
  c.box(c0 + 12, 16, c1 - c0 - 24, 7, { mat: plasterM, z: 1.4, bevel: 0.4, tone: -0.1 });
  letters(c, 'CARRE', c0 + 15, 16, { face: PAL_HD.gold[5], lit: PAL_HD.gold[7], edge: PAL_HD.gold[3], drop: PAL_HD.brown[2] });
  // The accent on the E (the 1× dot).
  c.box(c0 + 15 + 21 + 2, 15, 1, 0.8, { mat: gold, z: 1.8 });
  // The corner turrets with small domes and gilded finials.
  for (const x of [2, w - 12, c0 - 2, c1 - 8]) {
    // The dome sits behind the turret's top (only its upper half shows), a lit drum under it.
    c.ellipsoid(x + 5, 18.6, 4.6, 4.2, { mat: domeM, z: 0.9 });
    c.box(x, 18, 10, 12, { mat: plasterLit, z: 1.3, bevel: 0.4, tex: wall(x) });
    c.box(x - 0.4, 17.4, 10.8, 1.2, { mat: plasterLit, z: 1.5, bevel: 0.4, n: [0, -0.6, 0.8] });
    c.box(x + 4.6, 12, 0.8, 2.4, { mat: gold, z: 1.1 });
    c.ellipsoid(x + 5, 12.2, 0.6, 0.6, { mat: gold, z: 1.2 });
  }
  // Windows: arched, dark glass with the warm reflection of the low sun, a lit sill.
  for (let x = 6; x < w - 6; x += 9) {
    if (x > c0 - 4 && x < c1) continue;
    for (const y of [36, 54]) {
      c.plane(x, y - 1.5, 5, 10.5, {
        mat: glass,
        z: 0.5,
        mask: (px, py) => py >= y || Math.hypot(px - x - 2.5, py - y) <= 2.6,
        tex: (s) => {
          s.tone = 0.25 + (s.y - y) * 0.03;
          if (s.x - x < 1.6 && s.y > y + 1 && s.y < y + 3.5) s.mat = sunGlass;
          if (Math.abs(s.x - x - 2.5) < 0.25) s.tone += 0.3;
        },
      });
      c.box(x - 0.3, y + 9, 5.6, 0.8, { mat: plasterLit, z: 0.7, bevel: 0.3, n: [0, -0.6, 0.8] });
    }
  }
  // The centre: three tall arched windows with the sun in them.
  for (let k = 0; k < 3; k++) {
    const x = c0 + 10 + k * 15;
    c.plane(x, 25.5, 9, 22.5, {
      mat: glass,
      z: 1.5,
      mask: (px, py) => py >= 30 || Math.hypot(px - x - 4.5, py - 30) <= 4.6,
      tex: (s) => {
        s.tone = 0.3 + (s.y - 26) * 0.02;
        if (s.x - x < 3 && s.y > 28 && s.y < 34) s.mat = sunGlass;
        if (Math.abs(s.x - x - 4.5) < 0.35 || Math.abs(s.y - 38) < 0.3) {
          s.mat = plasterLit;
          s.tone = 0.1;
        }
      },
    });
  }
  // The ground-floor arcade and the quay under it.
  c.box(0, 67.6, w, 1.2, { mat: plasterLit, z: 0.5, bevel: 0.3, n: [0, -0.6, 0.8] });
  for (let x = 3; x < w - 3; x += 8) {
    c.plane(x, 68.5, 6, 14.5, {
      mat: dark,
      z: 0.6,
      mask: (px, py) => py >= 70 || Math.hypot(px - x - 3, py - 70) <= 3.1,
      tex: (s) => {
        s.tone = 0.2 - (s.y - 69) * 0.02;
      },
    });
  }
  c.box(0, h - 1, w, 1, { mat: plasterM, z: 0.2, tone: -0.4 });
  // The figures on the roofline (clowns and acrobats: small silhouettes with a red cap).
  for (const x of [c0 + 6, c0 + 20, c1 - 22, c1 - 8]) {
    c.box(x, 0.5, 2, 3.5, { mat: plasterLit, z: 1.6, bevel: 0.5 });
    c.ellipsoid(x + 1, 0.6, 0.9, 0.7, { mat: red, z: 1.8 });
  }
  return lightHd(c.render({ outline: 'none', ao: 0.25, sepZ: 0.4, shadow: 0.25, shadowMax: 2 }), 'golden');
}

/** The ids of this file → their HD generators. */
export const ROUTE_BRIDGES_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = [
  [`${D}low-bridge`, (d) => hdStrip(`${D}low-bridge`, d, (c) => lowFaceHd(c))],
  [`${D}low-bridge/back`, (d) => hdStrip(`${D}low-bridge/back`, d, (c) => lowBackHd(c))],
  [`${D}magere-brug/back`, (d) => hdStrip(`${D}magere-brug/back`, d, (c) => magereBackHd(c))],
  [`${D}magere-brug`, (d) => hdStrip(`${D}magere-brug`, d, (c, i) => magereLeavesHd(c, MAGERE_ANGLES[i]))],
  [`${D}carre`, (d) => hdStrip(`${D}carre`, d, (c) => carreHd(c))],
];
