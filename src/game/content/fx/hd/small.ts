/**
 * HD small fx (2× and 4×; docs/ART_GUIDE.md "UHD art"): the hit and impact bursts, dust, the
 * water splash, debris chunks, the POOF, confetti, the music note and the snore — the same
 * logical sizes, anchors, timings and layouts as the 1× art (fx/art.ts, fx/gags.art.ts,
 * fx/snore.art.ts), drawn natively: hot bursts as emissive glows, clods and chunks as lit
 * volumes (wood grain, a bent metal shard with a bright edge, a leaf with a midrib), water as
 * glossy lit drops and a foaming crown, puffs as fraying billows.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD, hdHome } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { CONFETTI_COLORS } from '../gags.art';
import { billow, fireMat, frayCut, gasMat, glowMat, hash, hdStrip, metalMat, paintMat, type HdCanvas } from './kit';
import { drawGlows, Xf, type Glow } from './shapes';

const INK: Color = PAL_HD.ink[0];

/** A glow-only render without an outline (additive bursts). */
function renderBare(c: HdCanvas): PixelBuffer {
  return c.render({ outline: 'none', ao: 0, sep: false });
}

/** A lit sprite with outline A. */
function renderLit(c: HdCanvas, ink: Color = INK): PixelBuffer {
  return c.render({ outline: 'A', ink, ao: 0.3, sep: true, sepZ: 0.3, rimLight: 1 });
}

// ------------------------------------------------------------------------------------ impact

/** The 1× dirt cells of fx/impact per frame (unpadded rows; the frame adds a 1-px margin). */
const IMPACT_DIRT: readonly (readonly string[])[] = [
  [],
  ['.d...d.', '..d.d..', '.d...d.', 'd.d.d.d', '..d.d..'],
  ['d.....d', '.d...d.', '...d...', '.d.d.d.', 'd.....d'],
  ['.......', 'd.....d', '.......', '..d.d..', '.......'],
];

/** A bullet hits the ground (9 × 7, 4 frames): a hot star, then lit clods flying out. */
export function impactHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const fire = fireMat(c);
    const part = c.newPart();
    const xf = Xf.at(4.5, 3.5);
    if (i < 2) {
      const r = i === 0 ? 2.6 : 1.6;
      const g: Glow[] = [];
      for (const [u, v] of [[r, 0], [-r, 0], [0, r * 0.85], [0, -r * 0.85]] as const) g.push({ k: 'spike', u0: 0, v0: 0, u1: u, v1: v, r0: 0.6, r1: 0.18, h0: 0.85, h1: 0.45 });
      g.push({ k: 'blob', u: 0, v: 0, ru: i === 0 ? 1.4 : 0.95, h: i === 0 ? 1.1 : 0.85, fall: 0.45 });
      drawGlows(c, xf, g, { glow: fire, part });
    }
    const clod = paintMat(c, PAL_HD.brown, 0.25, 2, 6);
    IMPACT_DIRT[i].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'd') continue;
        const cx = x + 1.5;
        const cy = y + 1.5;
        const glow = i === 1 && Math.hypot(cx - 4.5, cy - 3.5) < 2.4;
        c.ellipsoid(cx, cy, 0.6, 0.6, { mat: glow ? fire : clod, z: 2, tone: glow ? -0.2 : 0 });
      }
    });
    return renderBare(c);
  });
}

// ------------------------------------------------------------------------------------ hit

/** Spikes of fx/hit per frame: [core u, core v, core radius, ends…] in frame px (10 × 8). */
const HIT: ReadonlyArray<{ cx: number; cy: number; r: number; h: number; ends: ReadonlyArray<readonly [number, number]> }> = [
  { cx: 5, cy: 4, r: 1.25, h: 1.1, ends: [[3.5, 1.5], [8.5, 1.5], [1.4, 3.5], [2.5, 6.5], [7.5, 6.5]] },
  { cx: 5, cy: 4, r: 1.05, h: 0.9, ends: [[8.5, 1.5], [3.5, 2.5], [2.5, 3.5], [3.5, 5.5], [6.5, 5.5], [6.5, 2.5]] },
  { cx: 4.5, cy: 3.5, r: 0.9, h: 0.55, ends: [] },
];

/** A hit on an enemy (10 × 8, 3 frames, additive): a splintered white-hot star, then an ember ring. */
export function hitHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const h = HIT[i];
    const xf = Xf.at(h.cx, h.cy);
    const g: Glow[] = h.ends.map(([x, y]) => ({ k: 'spike', u0: 0, v0: 0, u1: x - h.cx, v1: y - h.cy, r0: 0.62, r1: 0.16, h0: h.h * 0.85, h1: h.h * 0.45 }));
    if (i < 2) g.push({ k: 'blob', u: 0, v: 0, ru: h.r, h: h.h, fall: 0.35 });
    else g.push({ k: 'arc', u: 0, v: 0, R: 1.1, a0: -Math.PI, a1: Math.PI, r: 0.42, h: 0.45 });
    drawGlows(c, xf, g, { glow: fireMat(c), part: c.newPart() });
    return renderBare(c);
  });
}

// ------------------------------------------------------------------------------------ dust

/** Dust at the feet (24 × 9, 4 frames): two sand billows spreading sideways and fraying. */
export function dustHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const sand = gasMat(c, PAL_HD.sand, 2, 6);
    const spread = 3 + i * 3;
    const r = [2.5, 3.4, 3.5, 2.6][i];
    const fade = [0, 0, 0.36, 0.7][i];
    for (const s of [-1, 1]) {
      billow(c, 12 + s * spread + 0.5, 5.4, r, 40 + i * 3 + (s > 0 ? 1 : 0), {
        mat: sand,
        lumps: r < 3 ? 3 : 4,
        tex: (t, q) => {
          if (frayCut(Math.min(1, q), fade, t.X, t.Y)) t.cut = true;
        },
      });
    }
    return c.render({ outline: 'none', ao: 0.3, sep: true, sepZ: 0.5, rimLight: 0 });
  });
}

// ------------------------------------------------------------------------------------ splash

/**
 * A water splash (26 × 22, 5 frames): a crown of three glossy jets with foam caps, side arcs
 * with foamy tips, flying drops, a surface ring with a foam lip.
 */
export function splashHd(id: string, d: number): Frame[] {
  const H = 22;
  return hdStrip(id, d, (c, i) => {
    const water = c.material({ ramp: PAL_HD.sky, spec: 1, shine: 26, gain: 1.05, lo: 2, hi: 6, rim: 0.4 });
    const foam = c.material({ ramp: PAL_HD.snow, spec: 0.5, shine: 16, lo: 2, hi: 6 });
    const t = i / 4;
    const hgt = Math.round(Math.sin(Math.min(1, t * 1.6) * Math.PI) * 12) + 2;
    const spread = 3 + Math.round(t * 7);
    const base = H - 2.2;
    const top = H - 2 - hgt + 0.6;
    // Surface ring with a foam lip on its far half.
    c.ellipsoid(13, H - 1.5, spread + 2.4, 0.78, { mat: water, z: 0, round: 0.5, tex: (s) => { if (s.v < -0.25 && Math.abs(s.u) < 0.85) s.mat = foam; } });
    if (hgt > 2) {
      // Three jets fanning out of the impact, foam caps on top.
      for (const j of [-1, 1, 0]) {
        const tx = 13 + j * (1.1 + t * 1.6);
        const ty = top + Math.abs(j) * hgt * 0.28;
        c.capsule(13 + j * 0.5, base, tx, ty + 0.6, j === 0 ? 0.95 : 0.7, j === 0 ? 0.5 : 0.4, { mat: water, z: 1.5 + (j === 0 ? 0.5 : 0) });
        c.ellipsoid(tx, ty + 0.3, j === 0 ? 0.95 : 0.75, j === 0 ? 0.8 : 0.65, { mat: foam, z: 2.5 });
      }
    } else c.ellipsoid(13, top + 0.6, 1.4, 0.9, { mat: foam, z: 2 });
    for (const s of [-1, 1]) {
      const n = Math.round(hgt * 0.6);
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < n; k += Math.max(1, n >> 2)) pts.push([13 + s * (spread - k * 0.3) + 0.5, H - 3 - k + 0.5]);
      pts.push([13 + s * (spread - (n - 1) * 0.3) + 0.5, H - 3 - (n - 1) + 0.5]);
      if (n > 1) c.stroke(pts, 0.55, 0.38, { mat: water, z: 1 });
      if (n > 3) c.ellipsoid(13 + s * (spread - n * 0.3) + 0.5, H - 3 - n + 0.5, 0.55, 0.5, { mat: foam, z: 2.5 });
      // Drops: one high, one low.
      const dy = H - 4 - Math.round(hgt * 0.7) + 0.5;
      c.ellipsoid(13 + s * (spread + 3) + 0.5, dy, 0.55, 0.65, { mat: water, z: 2 });
      if (hgt > 4) c.ellipsoid(13 + s * (spread + 1.2) + 0.5, dy - hgt * 0.35, 0.45, 0.5, { mat: water, z: 2 });
    }
    return renderLit(c, PAL_HD.navy[1]);
  });
}

// ------------------------------------------------------------------------------------ debris

/** Debris kinds with HD art: the base size of the 1× chunk (before the quarter turns). */
const DEBRIS: Readonly<Record<string, { w: number; h: number; draw: (c: HdCanvas, xf: Xf) => void }>> = {
  dirt: {
    w: 3,
    h: 3,
    draw: (c, xf) => {
      const m = paintMat(c, PAL_HD.brown, 0.2, 1, 6);
      const part = c.newPart();
      for (const [u, v, r] of [[-0.25, -0.2, 0.95], [0.45, 0.25, 0.8], [-0.35, 0.5, 0.65]] as const) {
        const [x, y] = xf.pt(u, v);
        c.ellipsoid(x, y, r, r, { mat: m, part });
      }
    },
  },
  metal: {
    w: 5,
    h: 4,
    draw: (c, xf) => {
      const m = metalMat(c, PAL_HD.steel, 1, 1, 6);
      // A bent shard: two facets with different normals (the light picks the bend), a bright torn edge.
      const a: Array<[number, number]> = [xf.pt(-1.8, -1.2), xf.pt(0.6, -1.5), xf.pt(0.2, 0.3), xf.pt(-1.3, 0.6)];
      const b: Array<[number, number]> = [xf.pt(0.6, -1.5), xf.pt(1.9, 0.2), xf.pt(1.0, 1.6), xf.pt(0.2, 0.3)];
      const part = c.newPart();
      c.poly(a, { mat: m, part, n: [-0.45, -0.5, 0.74] });
      c.poly(b, { mat: m, part, n: [0.5, 0.35, 0.79] });
    },
  },
  plant: {
    w: 4,
    h: 4,
    draw: (c, xf) => {
      const m = paintMat(c, PAL_HD.green, 0.45, 1, 6);
      const [x0, y0] = xf.pt(-1.5, 1.4);
      const [x1, y1] = xf.pt(1.3, -1.4);
      c.capsule(x0, y0, x1, y1, 0.55, 0.85, {
        mat: m,
        round: 0.6,
        tex: (s) => {
          // The midrib: a light crease down the leaf.
          if (Math.abs(s.v) < 0.18) s.tone += 0.25;
        },
      });
    },
  },
  wood: {
    w: 7,
    h: 2,
    draw: (c, xf) => {
      const m = paintMat(c, PAL_HD.wood, 0.25, 1, 6);
      // A splintered stick: a box along u with grain streaks and a ragged end.
      const pts: Array<[number, number]> = [xf.pt(-3.4, -0.9), xf.pt(2.4, -0.9), xf.pt(3.4, -0.2), xf.pt(2.6, 0.2), xf.pt(3.2, 0.9), xf.pt(-3.4, 0.9)];
      c.poly(pts, {
        mat: m,
        tex: (s) => {
          const [u, v] = xf.inv(s.x, s.y);
          // Lit top edge, dark lower edge (a plank seen side-on), grain streaks along u.
          s.tone += v < -0.45 ? 0.3 : v > 0.5 ? -0.3 : 0;
          if (s.d >= 4 && Math.abs(Math.sin(v * 7 + u * 0.4)) > 0.92) s.tone -= 0.18;
        },
      });
    },
  },
};

/** Debris chunks (4 quarter-turned frames): a lit chunk per kind. */
export function debrisHd(id: string, d: number, kind: string): Frame[] {
  const k = DEBRIS[kind];
  return hdStrip(id, d, (c, q, f1) => {
    const xf = Xf.turn((q * Math.PI) / 2, k.w, k.h, k.w / 2, k.h / 2, f1.buf.w, f1.buf.h);
    k.draw(c, xf);
    return renderLit(c);
  });
}

/** Debris kinds drawn here. */
export const DEBRIS_HD = Object.keys(DEBRIS);

// ------------------------------------------------------------------------------------ POOF

/** The cartoon POOF (25 × 25, 6 frames): a white star, then a ring of fraying white billows. */
export function poofHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const cx = 12.5;
    const cy = 12.5;
    if (i === 0) {
      const g: Glow[] = [];
      for (const [u, v] of [[6, 0], [-6, 0], [0, 6], [0, -6]] as const) g.push({ k: 'spike', u0: 0, v0: 0, u1: u, v1: v, r0: 1.2, r1: 0.3, h0: 0.95, h1: 0.55 });
      for (const [u, v] of [[3.6, 3.6], [-3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]] as const) g.push({ k: 'blob', u, v, ru: 0.6, h: 0.6, fall: 0.2 });
      g.push({ k: 'blob', u: 0, v: 0, ru: 3.4, h: 1.0, fall: 0.35, lit: 0.3 });
      drawGlows(c, Xf.at(cx, cy), g, { glow: glowMat(c, PAL_HD.snow, 1, 6), part: c.newPart() });
      return c.render({ outline: 'A', ink: PAL.steel[3], ao: 0, sep: false });
    }
    const snow = gasMat(c, PAL_HD.snow, 1, 5);
    const t = (i - 1) / 4;
    const ringR = 3 + t * 6;
    const puffR = 3.6 - t * 1.2;
    const fade = t > 0.3 ? (t - 0.3) * 1.3 : 0;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + 0.3;
      billow(c, cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR - t * 2, puffR, 60 + k, {
        mat: snow,
        part: k + 1,
        z: k,
        lumps: 4,
        tex: (s, q) => {
          if (frayCut(Math.min(1, q), fade, s.X, s.Y)) s.cut = true;
        },
      });
    }
    return c.render({ outline: 'A', ink: PAL.steel[3], ao: 0.3, sep: true, sepZ: 0.5, rimLight: 0 });
  });
}

// ------------------------------------------------------------------------------------ confetti

/** HD ramp of a confetti colour. */
function confettiRamp(col: Color): Ramp {
  return hdHome(col)?.ramp ?? PAL_HD.gold;
}

/** One paper bit (2 × 1 logical px) at (x, y), turned by `a`, its tilt picking the lit or dark side. */
function paperBit(c: HdCanvas, mat: number, x: number, y: number, a: number, tilt: number): void {
  const xf = Xf.turn(a, 2, 1, 1, 0.5, 0, 0);
  const pts = [xf.pt(-1, -0.5), xf.pt(1, -0.5), xf.pt(1, 0.5), xf.pt(-1, 0.5)].map(([px, py]) => [px + x, py + y] as [number, number]);
  const n: [number, number, number] = [Math.cos(tilt) * 0.55, Math.sin(tilt) * 0.55, 0.65];
  c.poly(pts, { mat, n, z: 1 });
}

/** A confetti pop (31 × 31, 6 frames): a gold star, then paper bits flying out and falling. */
export function confettiHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i) => {
    const cx = 15.5;
    const cy = 15.5;
    if (i === 0) {
      const g: Glow[] = [];
      for (const [u, v] of [[4.3, 0], [-4.3, 0], [0, 4.3], [0, -4.3]] as const) g.push({ k: 'spike', u0: 0, v0: 0, u1: u, v1: v, r0: 0.6, r1: 0.2, h0: 0.8, h1: 0.5 });
      g.push({ k: 'blob', u: 0, v: 0, ru: 1.4, h: 1.1, fall: 0.4 });
      drawGlows(c, Xf.at(cx, cy), g, { glow: glowMat(c, PAL_HD.gold, 2, 7), part: c.newPart() });
      return renderBare(c);
    }
    const t = i / 5;
    const mats = CONFETTI_COLORS.map((col) => paintMat(c, confettiRamp(col), 0.35, 1, 6));
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + hash(k, 1, 7) * 0.4;
      const r = (5 + hash(k, 2, 7) * 8) * (0.4 + t * 0.8);
      const x = Math.round(cx - 0.5 + Math.cos(a) * r) + 1;
      const y = Math.round(cy - 0.5 + Math.sin(a) * r * 0.8 + t * t * 6) + 0.5;
      if (t > 0.75 && hash(k, 3, i) > 0.6) continue;
      const turn = (k + i) % 2 === 0 ? 0.25 * (hash(k, 4, i) - 0.5) : Math.PI / 2 + 0.25 * (hash(k, 5, i) - 0.5);
      const vx = (k + i) % 2 === 0 ? 0 : -0.5;
      paperBit(c, mats[k % mats.length], x + vx, y + ((k + i) % 2 === 0 ? 0 : 0.5), turn, hash(k, 6, i) * Math.PI * 2);
    }
    return renderBare(c);
  });
}

/** The 12 confetti bits (6 colours × flat / upright) for particles: lit paper slips. */
export function confettiBitsHd(id: string, d: number): Frame[] {
  return hdStrip(id, d, (c, i, f1) => {
    const ramp = confettiRamp(CONFETTI_COLORS[i >> 1]);
    const m = paintMat(c, ramp, 0.4, 1, 6);
    const w = f1.buf.w;
    const h = f1.buf.h;
    // A slightly curled slip: lit along one long edge, shaded along the other.
    c.box(0, 0, w, h, {
      mat: m,
      tex: (s) => {
        const across = w > h ? s.v : s.u;
        const along = w > h ? s.u : s.v;
        s.tone += across < 0.4 ? 0.22 : -0.12;
        // At 4×: a crease across the middle of the slip.
        if (s.d >= 4 && along > 0.5 && along < 0.63) s.tone -= 0.3;
      },
    });
    return renderBare(c);
  });
}

// ------------------------------------------------------------------------------------ music note

/** A gold eighth note (10 × 10, 4 sway frames): a polished head, a stem, a curling flag, a glint. */
export function noteHd(id: string, d: number): Frame[] {
  const leans = [0, 1, 0, -1];
  return hdStrip(id, d, (c, i) => {
    const lean = leans[i];
    const gold = metalMat(c, PAL_HD.gold, 1, 2, 6);
    const part = c.newPart();
    // The head: a tilted ellipse (rows 5–7 of the 1× note, the frame adds 2 / 1 px).
    c.plane(1.5, 5.5, 5.5, 4, {
      mat: gold,
      part,
      tex: (s) => {
        const dx = s.x - 4.05;
        const dy = s.y - 7.45;
        const u = (dx * 0.94 + dy * 0.34) / 1.9;
        const v = (-dx * 0.34 + dy * 0.94) / 1.25;
        const q = u * u + v * v;
        if (q > 1) {
          s.cut = true;
          return;
        }
        const nz = Math.sqrt(1 - q);
        s.nx = u * 0.8;
        s.ny = v * 0.8;
        s.nz = nz;
      },
    });
    // The stem (its top half leans with the sway) and the flag.
    const top = 5.5 + lean;
    c.stroke([[5.6, 7.2], [5.6, 4.6], [top, 1.6]], 0.5, 0.45, { mat: gold, part, z: 0.2 });
    c.stroke([[top + 0.2, 1.5], [top + 1.25, 2.0], [top + 1.7, 3.1], [top + 1.55, 4.1]], 0.48, 0.3, { mat: gold, part, z: 0.3 });
    c.paint(2.6, 6.3, 1, 1, (x, y) => (Math.hypot(x - 3.1, y - 6.8) < 0.38 ? PAL_HD.snow[6] : 0));
    return renderLit(c);
  });
}

// ------------------------------------------------------------------------------------ snore

/** The snore (16 × 18, 6 frames): three white "z" letters on a rising path, lit, with outline A. */
export function snoreHd(id: string, d: number): Frame[] {
  const FR = 6;
  const H = 18;
  return hdStrip(id, d, (c, i) => {
    const white = paintMat(c, PAL_HD.snow, 0.3, 1, 5);
    const blue = paintMat(c, PAL_HD.sky, 0.3, 2, 6);
    for (let k = 0; k < 3; k++) {
      const t = (i + k * 2) % FR;
      const s = t < 2 ? 3 : t < 4 ? 4 : 5;
      const x = 1 + t * 2;
      const y = H - 5 - t * 2 - (s - 3);
      const mat = t === 5 ? blue : white;
      const part = c.newPart();
      const a: [number, number] = [x + 0.5, y + 0.5];
      const b: [number, number] = [x + s - 0.5, y + 0.5];
      const e: [number, number] = [x + 0.5, y + s - 0.5];
      const f: [number, number] = [x + s - 0.5, y + s - 0.5];
      c.stroke([a, b, e, f], 0.5, 0.5, { mat, part, z: k, round: 0.7 });
    }
    return renderLit(c);
  });
}

