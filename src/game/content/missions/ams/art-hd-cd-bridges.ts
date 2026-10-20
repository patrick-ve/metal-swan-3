/**
 * UHD art (d 2 and 4) of the bridges of section c (AMSTEL; 1× art in art.ts): the white wooden
 * Amstel bridge span `white-bridge` and its overhead balance beams `white-portal`, the Blauwbrug
 * lamp `blauwbrug-lamp` and the Blauwbrug's brick arch face `bridge-face-200x16`.
 *
 * - White bridge and portal: white-painted timber (the gable ramp, warm at the lit edges), grain
 *   and plank seams under the paint, worn paint at the edges, iron straps and bolts, warm bulbs;
 *   the piers wet and green with algae at the water line. Static decor: outline C.
 * - Blauwbrug lamp: a dressed granite base with a blue enamel plaque and a white crown, a fluted
 *   cast-iron post with gilded rings, the glowing lantern and the gilded crown with jewels.
 *   Outline C.
 * - Arch face: front decor painted like the terrain (no outline): brick in running bond with
 *   recessed mortar and per-brick tone, a stone coping along the hump, a ring of voussoirs with a
 *   keystone, the vault receding into the dark, the canal under it with lit ripples, damp and moss
 *   at the water.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { wood as woodTex, type TexSample } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { hillY } from './art';
import { band, decoMat, Facade, glowMat, HdCanvas, hdStrip, metalMat } from './art-hd-cd-kit';

const D = 'decor/ams/';

/** Shared materials of the white timber pieces. */
function whiteMats(c: HdCanvas): { white: number; iron: number; bulb: number; moss: number } {
  return {
    white: decoMat(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.25, shine: 14, edge: 'C' }),
    iron: metalMat(c, PAL_HD.slate, { lo: 1, hi: 5, edge: 'C', spec: 0.6 }),
    bulb: glowMat(c, PAL_HD.gold, 4, 7, { edge: 'C' }),
    moss: decoMat(c, PAL_HD.moss, { lo: 1, hi: 4, edge: 'C' }),
  };
}

/** Painted timber: grain showing through the paint, worn paint at the edges (darker), knots at 4×. */
function paintedTimber(seed: number, dir: 'h' | 'v'): (s: TexSample) => void {
  const g = woodTex({ seed, dir });
  return (s) => {
    const t0 = s.tone;
    g(s);
    // The paint hides most of the grain: keep a fifth of it; a few chips at 4×.
    s.tone = t0 + (s.tone - t0) * 0.2;
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed) > 0.994) s.tone -= 0.25;
  };
}

/** A round lit bolt head. */
function bolt(c: HdCanvas, x: number, y: number, mat: number, z: number): void {
  c.ellipsoid(x, y, 0.42, 0.42, { mat, z });
}

// =============================================================================================
// The white wooden Amstel bridge (130 × 72, ox 1, oy 28 = the deck)
// =============================================================================================

function whiteBridge(c: HdCanvas): PixelBuffer {
  const m = whiteMats(c);
  const deck = 28;
  const water = 180 - (152 - deck); // the canal surface in sprite rows (WATER_Y − the sprite top)
  // Piers: square timbers into the water, two plank seams, iron collars, a wet green foot.
  for (const x of [2, 66]) {
    c.box(x, deck + 4, 6, 72 - deck - 5, {
      mat: m.white,
      z: 0,
      bevel: 0.9,
      tex: (s) => {
        paintedTimber(x, 'v')(s);
        for (const sx of [x + 2, x + 4]) if (Math.abs(s.x - sx) < 0.5 / s.d + 0.01) s.tone -= 0.35;
        // A grey tide line, a band of algae at the water, wet (darker) paint under it.
        if (s.y > water - 2.6) {
          if (s.y < water + 0.6 && noise2(s.x * 2, s.y * 1.5, 1.5, 5 + x) > 0.5) s.mat = m.moss;
          else s.tone -= s.y < water - 1.6 ? 0.25 : 0.45;
        }
      },
    });
    for (const by of [deck + 6, deck + 20]) {
      c.box(x - 0.2, by - 0.7, 6.4, 1.4, { mat: m.iron, z: 1.1, bevel: 0.35 });
      bolt(c, x + 1.5, by, m.iron, 1.6);
      bolt(c, x + 4.5, by, m.iron, 1.6);
    }
  }
  // The arched girders between the piers (the 1× soffit): a deep white beam with a moulded lower edge.
  const arcY = (x: number): number => {
    if (x < 8 || x >= 128) return NaN;
    const t = ((x - 8) % 64) / 58;
    return t > 1 ? NaN : deck + 4 + Math.sin(t * Math.PI) * 10;
  };
  c.plane(8, deck + 4, 120, 12, {
    mat: m.white,
    z: -0.4,
    mask: (x, y) => {
      const a = arcY(x);
      return a === a && y <= a + 1;
    },
    tex: (s) => {
      paintedTimber(17, 'h')(s);
      const a = arcY(s.x);
      // In the deck's shadow at the top; the rounded lower moulding with its lit lip.
      if (s.y < deck + 5) s.tone -= 0.45;
      else s.tone += 0.08;
      const below = a + 1 - s.y;
      if (below < 0.35) s.ny += 0.8;
      else if (below < 0.9) s.ny -= 0.6;
      // A row of carriage bolts along the beam.
      if (s.d >= 4 && Math.abs(s.y - (deck + 6.5)) < 0.3 && ((s.x - 8) % 8) < 0.5) s.tone -= 0.5;
    },
  });
  // The railing: kick rail, cross bracing, posts with caps, the round handrail, bulbs.
  c.box(1, deck - 1, 128, 1.1, { mat: m.white, z: 0.6, bevel: 0.35, n: [0, -0.3, 0.95], tex: paintedTimber(3, 'h') });
  for (let x = 1; x < 129; x += 16) {
    // Cross bracing behind the posts, one brace a little nearer at the crossing.
    if (x + 15 < 130) {
      c.capsule(x + 3.5, deck - 11.5, x + 15.5, deck - 1.5, 0.55, 0.55, { mat: m.white, z: 0.2, round: 0.7 });
      c.capsule(x + 3.5, deck - 1.5, x + 15.5, deck - 11.5, 0.55, 0.55, { mat: m.white, z: 0.35, round: 0.7 });
      bolt(c, x + 9.5, deck - 6.5, m.iron, 1);
    }
    c.box(x, deck - 16, 3, 16, { mat: m.white, z: 1, bevel: 0.6, tex: paintedTimber(x, 'v') });
    c.box(x - 0.3, deck - 16.4, 3.6, 1.1, { mat: m.white, z: 1.7, bevel: 0.45, n: [0, -0.6, 0.8] });
    bolt(c, x + 1.5, deck - 10.5, m.iron, 2);
    bolt(c, x + 1.5, deck - 3.5, m.iron, 2);
  }
  c.cylinder(1, deck - 14.1, 128, 2.1, { mat: m.white, z: 1.4, axis: 'h', tex: paintedTimber(5, 'h') });
  for (let x = 9; x < 130; x += 16) {
    c.ellipsoid(x + 0.5, deck - 14.6, 0.85, 0.8, {
      mat: m.bulb,
      z: 2.4,
      tex: (s) => {
        // Glowing glass: hot at the filament (upper left), warm at the rim.
        const r = Math.hypot(s.x - x - 0.3, s.y - (deck - 14.85));
        s.tone = 0.95 - r * 0.7;
      },
    });
  }
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.22, shadowMax: 2 });
}

// =============================================================================================
// The balance beams over the white bridge (72 × 120, feet)
// =============================================================================================

function whitePortal(c: HdCanvas): PixelBuffer {
  const m = whiteMats(c);
  const H = 120;
  for (const x of [6, 62]) {
    c.box(x, 24, 4, H - 24, { mat: m.white, z: 0, bevel: 0.7, tex: paintedTimber(x + 40, 'v') });
    for (let y = 30; y < H - 4; y += 18) bolt(c, x + 2, y + 0.5, m.iron, 0.9);
    // Iron shoe at the foot.
    c.box(x - 0.4, H - 4, 4.8, 4, { mat: m.iron, z: 0.8, bevel: 0.4 });
  }
  // The cross beam: lit top, shaded underside, a row of bolts.
  c.box(2, 20, 68, 5, { mat: m.white, z: 1, bevel: 0.8, tex: paintedTimber(9, 'h') });
  for (let x = 8; x < 68; x += 10) bolt(c, x, 22.5, m.iron, 2);
  // Braces down to the middle with an iron gusset where they meet.
  c.capsule(10.5, 25.5, 36.5, 50.5, 0.75, 0.7, { mat: m.white, z: 0.4, round: 0.7 });
  c.capsule(62.5, 25.5, 36.5, 50.5, 0.75, 0.7, { mat: m.white, z: 0.5, round: 0.7 });
  c.poly([[34.4, 48.8], [38.6, 48.8], [36.5, 52.2]], { mat: m.iron, z: 1.2 });
  bolt(c, 36.5, 50, m.iron, 1.6);
  // The balance beam on top with its lights.
  c.cylinder(4, 10.6, 65, 3.1, { mat: m.white, z: 1.6, axis: 'h', tex: paintedTimber(13, 'h') });
  for (const x of [4.6, 67.4]) c.ellipsoid(x, 12.2, 1, 1.55, { mat: m.white, z: 1.7, round: 0.8 });
  for (let x = 6; x < 68; x += 8) {
    c.ellipsoid(x + 0.5, 10.3, 0.75, 0.75, {
      mat: m.bulb,
      z: 2.4,
      tex: (s) => {
        s.tone = 0.95 - Math.hypot(s.x - x - 0.3, s.y - 10.1) * 0.7;
      },
    });
  }
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.22, shadowMax: 2 });
}

// =============================================================================================
// The Blauwbrug lamp (22 × 86, feet)
// =============================================================================================

function blauwbrugLamp(c: HdCanvas): PixelBuffer {
  const granite = decoMat(c, PAL_HD.stone, { lo: 1, hi: 6, edge: 'C' });
  const enamel = decoMat(c, PAL_HD.sky, { lo: 0, hi: 4, spec: 0.7, shine: 22, edge: 'C' });
  const white = decoMat(c, PAL_HD.gable, { lo: 3, hi: 6, edge: 'C' });
  const iron = metalMat(c, PAL_HD.slate, { lo: 1, hi: 5, edge: 'C', spec: 0.7 });
  const gilt = metalMat(c, PAL_HD.gold, { lo: 1, hi: 6, edge: 'C' });
  const glow = glowMat(c, PAL_HD.gold, 3, 7, { edge: 'C' });
  const ruby = metalMat(c, PAL_HD.red, { lo: 3, hi: 6, edge: 'C' });
  const sapphire = metalMat(c, PAL_HD.sky, { lo: 1, hi: 5, edge: 'C' });
  // The base: dressed granite blocks (a joint across, chisel texture), a moulded cap.
  c.box(4, 66, 14, 19, {
    mat: granite,
    z: 0,
    bevel: 0.6,
    tex: (s) => {
      if (Math.abs(s.y - 79.25) < 0.5 / s.d + 0.01) s.tone -= 0.45;
      s.tone += (hash2(Math.floor(s.x * 2), Math.floor(s.y * 2), 3) - 0.5) * 0.18;
      if (s.y > 82) s.tone -= (s.y - 82) * 0.08;
    },
  });
  c.box(3, 64, 16, 3, { mat: granite, z: 0.9, bevel: 0.6, n: [0, -0.35, 0.94] });
  // The blue enamel plaque with a white crown.
  c.box(6, 70, 10, 8, { mat: enamel, z: 0.9, bevel: 0.45, r: 0.3 });
  c.box(8.6, 73.2, 4.8, 1.4, { mat: white, z: 1.5, bevel: 0.25 });
  for (const x of [8.9, 11, 13.1]) c.ellipsoid(x, 72.8, 0.45, 0.55, { mat: white, z: 1.55 });
  // The fluted cast-iron post with gilded rings.
  c.cylinder(9, 24, 4, 40, {
    mat: iron,
    z: 0.5,
    tex: (s) => {
      // Flutes: four ridges round the visible half.
      const u = (s.x - 9) / 4;
      s.nx += Math.sin(u * Math.PI * 4) * 0.35;
    },
  });
  for (const y of [40, 52]) c.cylinder(8.5, y, 5, 1, { mat: gilt, z: 1 });
  c.cylinder(7.6, 61.6, 6.8, 2.6, { mat: iron, z: 0.8, cap: 0.6 });
  c.cylinder(6, 22, 10, 3, { mat: gilt, z: 1, cap: 0.8 });
  // The lantern: glowing panes in an iron frame.
  c.poly([[5, 10], [17, 10], [14.6, 22], [7.4, 22]], {
    mat: glow,
    z: 0.6,
    tex: (s) => {
      // Brightest at the flame (upper middle), warm towards the frame; a pane bar across.
      const r = Math.hypot((s.x - 10.8) * 0.8, s.y - 14);
      s.tone = 0.8 - r * 0.11;
      if (Math.abs(s.y - 16) < 0.25) s.tone -= 0.35;
    },
  });
  c.box(10.2, 10, 0.8, 12, { mat: iron, z: 1, bevel: 0.3 });
  c.box(4, 9, 14, 1.2, { mat: iron, z: 1.2, bevel: 0.4 });
  c.box(7.2, 21.4, 7.6, 0.9, { mat: iron, z: 1.2, bevel: 0.35 });
  // The gilded crown: a band with jewels, points with balls, the orb on top.
  c.cylinder(6, 4, 10, 5, {
    mat: gilt,
    z: 1.4,
    tex: (s) => {
      if (Math.abs(s.y - 5.2) < 0.25 || Math.abs(s.y - 7.8) < 0.25) s.ny -= 0.6;
    },
  });
  for (const x of [6.5, 9.5, 12.5, 15.5]) {
    c.poly([[x - 0.9, 4.2], [x + 0.9, 4.2], [x, 2.6]], { mat: gilt, z: 1.5 });
    c.ellipsoid(x, 2.7, 0.55, 0.55, { mat: gilt, z: 1.6 });
  }
  c.ellipsoid(8.5, 5.9, 0.75, 0.85, { mat: ruby, z: 2 });
  c.ellipsoid(13.5, 5.9, 0.75, 0.85, { mat: sapphire, z: 2 });
  c.ellipsoid(11, 6.4, 0.5, 0.5, { mat: white, z: 2 });
  c.capsule(10.5, 2.4, 10.5, 1.2, 0.35, 0.35, { mat: gilt, z: 1.7 });
  c.ellipsoid(10.5, 1.2, 0.75, 0.75, { mat: gilt, z: 1.8 });
  return c.render({ outline: 'C', ao: 0.3, sepZ: 0.3, shadow: 0.2, shadowMax: 2 });
}

// =============================================================================================
// The Blauwbrug arch face (front decor; len × (h + 42), ox 0, oy h + 2)
// =============================================================================================

/**
 * The arch face, painted per art px like the terrain (a `Facade`, no outline): brick in running
 * bond (4 × 2 px) with recessed mortar, per-brick tone and lit top edges, soot streaks from the
 * coping, damp and moss at the water; the stone coping along the hump (lit nosing, drip shadow,
 * joints); a ring of voussoirs with radial joints and a keystone; the vault's lit inner edge
 * receding into the dark; the canal under it with lit ripples.
 */
export function bridgeFaceHd(len: number, h: number, d: number): Frame[] {
  const top = h + 2;
  const H = top + 40;
  const cx = len / 2;
  const ar = len * 0.3;
  const archH = H - top - 12;
  const f = new Facade(len, H, d);
  const BR = PAL_HD.rust;
  const ST = PAL_HD.stone;
  const VA = PAL_HD.brickDark;
  const WA = PAL_HD.teal;
  const MO = PAL_HD.moss;
  const e = 1 / d;
  const j = Math.max(0.5, e);
  // Per art column: the deck line, the arch top, a soot streak strength.
  const deckY = new Float64Array(f.W);
  const archTop = new Float64Array(f.W);
  const soot = new Float64Array(f.W);
  const mossTop = new Float64Array(f.W);
  for (let X = 0; X < f.W; X++) {
    const x = (X + 0.5) / d;
    deckY[X] = top + hillY(x, len, h) + 2;
    const dx = (x - cx) / ar;
    archTop[X] = Math.abs(dx) >= 1 ? Infinity : H - 2 - Math.sqrt(1 - dx * dx) * archH;
    soot[X] = Math.max(0, noise2(x, 0, 3, 13) - 0.55) * 2.2;
    mossTop[X] = H - 2.5 - noise2(x, 0, 2.5, 9) * 4;
  }
  for (let Y = 0; Y < f.H; Y++) {
    const y = (Y + 0.5) / d;
    for (let X = 0; X < f.W; X++) {
      const x = (X + 0.5) / d;
      const dk = deckY[X];
      if (y < dk) continue;
      let c: number;
      const fc = y - dk;
      const at = archTop[X];
      if (fc < 1.6) {
        // The coping: a lit nosing, the face, the drip shadow; joints every 8 px.
        if (x % 8 < e) c = ST[1];
        else c = fc < 0.5 ? ST[6] : fc < 1.1 ? band(ST, 0.75 - fc * 0.2, X, Y, 3, 5) : ST[2];
      } else if (y >= at) {
        const into = y - at;
        if (y >= H - 8) {
          // The canal under the vault: dark, the lit ring reflected in broken ripples.
          const wr = y - (H - 8);
          const rip = hash2(Math.floor(x * 0.7), Math.floor(y * 2), 21);
          c = wr < 0.5 ? WA[3] : rip > 0.86 - wr * 0.01 ? (wr < 3 ? WA[3] : WA[2]) : wr < 2 ? WA[1] : WA[0];
        } else if (into < 0.6) c = VA[5];
        else {
          const t = 0.55 - into * 0.11 - ((Math.floor(into * 2) & 1) === 0 ? 0.06 : 0);
          c = band(VA, t, X, Y, 0, 4, 0.2);
        }
      } else if (Math.hypot((x - cx) / (ar + 2.6), (y - (H - 2)) / (archH + 2.6)) <= 1) {
        // The voussoirs: radial joints, stones a little varied, the keystone proud.
        const ang = Math.atan2((H - 2 - y) / archH, (x - cx) / ar);
        const k = (ang / Math.PI) * 23;
        const fk = k - Math.floor(k);
        if (fk < 0.07 || fk > 0.93) c = ST[1];
        else {
          let t = 0.55 + (hash2(Math.floor(k), 1, 4) - 0.5) * 0.3 + (x < cx ? 0.08 : -0.08);
          if (Math.abs(x - cx) < 2) t += 0.18;
          if (at - y < 0.5) t += 0.2;
          c = band(ST, t, X, Y, 2, 6);
        }
      } else {
        // Brick in running bond.
        const row = Math.floor(y / 2);
        const xx = x + (row & 1 ? 2 : 0);
        const col = Math.floor(xx / 4);
        const fx = xx - col * 4;
        const fy = y - row * 2;
        if (fy < j || fx < j) c = fc < 2.4 ? ST[0] : ST[1];
        else {
          let t = 0.5 + (hash2(col, row, 6) - 0.5) * 0.45;
          if (fy < j + e) t += 0.22;
          else if (fy > 2 - e) t -= 0.15;
          if (fx < j + e) t += 0.1;
          // The coping's shadow, soot streaks, damp up from the water.
          if (fc < 2.4) t -= 0.35;
          t -= soot[X] * Math.max(0, 1 - (fc - 1.6) / 14);
          if (y > H - 9) t -= (y - H + 9) * 0.06;
          if (y > mossTop[X]) {
            f.set(X, Y, band(MO, 0.5 + (hash2(col, row, 3) - 0.5) * 0.4, X, Y, 1, 4), MO[0]);
            continue;
          }
          c = band(BR, t, X, Y, 1, 4);
        }
      }
      f.set(X, Y, c, BR[0]);
    }
  }
  return [{ buf: f.buf, ox: 0, oy: top, density: d }];
}

// =============================================================================================
// Registration
// =============================================================================================

export const BRIDGES_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = [
  [`${D}white-bridge`, (d) => hdStrip(`${D}white-bridge`, d, (c) => whiteBridge(c))],
  [`${D}white-portal`, (d) => hdStrip(`${D}white-portal`, d, (c) => whitePortal(c))],
  [`${D}blauwbrug-lamp`, (d) => hdStrip(`${D}blauwbrug-lamp`, d, (c) => blauwbrugLamp(c))],
  [`${D}bridge-face-200x16`, (d) => bridgeFaceHd(200, 16, d)],
];
