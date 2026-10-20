/**
 * Mission `ams` UHD canal decor of sections a and b (docs/ART_GUIDE.md "UHD art"): the raised white
 * drawbridge, the canal bridges (iron railing with chained bikes, the brick arch face), the
 * Museumplein lawn and pool (the canal water pieces are art-hd-terrain-water.ts'). One density-generic drawer per id (d 2 and 4) with the 1× frame's size and anchor
 * (art.ts `drawbridge`, `bridgeRailSprite`, `bridgeFaceSprite`,
 * `lawnSprite`, `poolSprite`).
 *
 * Pieces that tile side by side (the lawn) use patterns periodic in x with a period that
 * divides 128 (the piece width), so neighbouring pieces meet without a seam. Lawn, pool and the
 * arch face have no outline (as at 1×: terrain-like, painted); the rest outline C.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, brick, grime, plaster, texAll, wood } from '../../../art/hd/index';
import { hash2, noise2, noise2x } from '../../../art/paint';
import { BIKE_COLOURS, hillY } from './art';
import { deco, face, fr, glow, outlineC, type D, type P } from './art-hd-ab-kit';
import { bikeHd, bikeMatsHd, wheelHoles } from './art-hd-ab-street';

/** Period (logical px) of every pattern of the tiling pieces: divides 128. */
const PER = 64;

// ============================================================================== drawbridge

/** A raised white drawbridge: two posts, the cross beam, balance beams, the leaf standing up (70 × 150, feet). */
export function drawbridgeHd(d: D): Frame {
  const W = 70;
  const H = 150;
  const c = new HdCanvas(W, H, d);
  const white = deco(c, PAL_HD.gable, { lo: 2, hi: 6, spec: 0.25, shine: 12 });
  const leafM = deco(c, PAL_HD.gable, { lo: 2, hi: 5, wrap: 0.15 });
  const iron = deco(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.6, shine: 18 });
  const red = deco(c, PAL_HD.red, { lo: 2, hi: 6 });
  const stone = face(c, PAL_HD.stone, { lo: 2, hi: 6 });
  const mortar = face(c, PAL_HD.stone, { lo: 1, hi: 3 });
  const grain = wood({ seed: 4, dir: 'v' });
  // Portal posts, the cross beam, the X braces.
  for (const x of [8, 40]) c.box(x, 30, 4, H - 31, { mat: white, z: 1, bevel: 0.7, tex: texAll(grain, grime(x, 0.25, 4)) });
  c.box(4, 26, 44, 5, { mat: white, z: 1.4, bevel: 0.8, tex: wood({ seed: 5, dir: 'h' }) });
  c.capsule(10.5, 31, 42.5, 50.5, 0.75, 0.75, { mat: white, z: 0.8 });
  c.capsule(42.5, 31, 10.5, 50.5, 0.75, 0.75, { mat: white, z: 0.7 });
  // The balance beams raised, the counterweight end low at the left.
  c.capsule(12.5, 22.5, 64.5, 6.5, 1.6, 1.4, { mat: white, z: 2, tex: wood({ seed: 6, dir: 'h' }) });
  c.box(9.5, 20.5, 6, 5, { mat: white, z: 2.2, bevel: 0.8, r: 0.6 });
  // The leaf standing up at the right: planks, iron straps, the warning stripes on its edge.
  c.box(52, 10, 14, H - 18, {
    mat: leafM,
    z: 0.6,
    bevel: 0.5,
    tex: texAll(wood({ seed: 7, dir: 'v', plank: 2.4 }), (s) => {
      if (((s.y - 16) % 8 + 8) % 8 < 0.7) {
        s.mat = iron;
        s.dz = 0.3;
      }
    }),
  });
  c.paint(66, 12, 1, H - 22, (_x, y) => (Math.floor(y / 4) % 2 === 0 ? 0 : PAL_HD.snow[6]));
  c.box(66, 12, 1, H - 22, { mat: red, z: 0.7, bevel: 0.3 });
  c.capsule(64.5, 6.5, 64.5, 10.5, 0.4, 0.4, { mat: iron, z: 2.4 });
  // The chain from the beam to the leaf: links (4×) or a twisted line (2×).
  const steps = 16;
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps;
    const t1 = (k + 0.7) / steps;
    c.capsule(46.5 + 12 * t0, 30.5 - 16 * t0, 46.5 + 12 * t1, 30.5 - 16 * t1, 0.32, 0.32, { mat: iron, z: 2.3, tone: k % 2 ? -0.1 : 0.1 });
  }
  c.box(1, H - 3, W - 2, 3, { mat: stone, z: 0.5, bevel: 0.6, n: [0, -0.3, 0.95], tex: brick({ mortar, bw: 6, bh: 3, joint: 0.4, wear: 0.7, seed: 12 }) });
  return fr(c.render({ outline: 'C', sep: true, ao: 0.3, shadow: 0.25, shadowMax: 2.5 }), 35, H, d);
}

// ============================================================================== bridges

/** Iron bridge railing with chained bikes along a hill deck; (len + 2) × 32, anchor (1, 31). */
export function bridgeRailHd(len: number, h: number, d: D): Frame {
  const top = 30;
  const c = new HdCanvas(len + 2, top + 2, d);
  // The deck line of the 1× sprite (its x is the 1× buffer column; the deck rounded to px).
  const deck = (x: number): number => top + hillY(x, len, h);
  const stone = deco(c, PAL_HD.stone, { lo: 2, hi: 7, wrap: 0.1 });
  const mortar = face(c, PAL_HD.stone, { lo: 1, hi: 3 });
  const iron = deco(c, PAL_HD.green, { lo: 0, hi: 3, spec: 0.6, shine: 18 });
  // Stone end posts with caps.
  for (const x of [2, len - 6]) {
    const dy = top + Math.round(hillY(x, len, h));
    c.box(x, dy - 18, 6, 18, { mat: stone, z: 2, bevel: 0.5, tex: brick({ mortar, bw: 3, bh: 2, joint: 0.35, wear: 0.6, seed: x }) });
    c.box(x - 1, dy - 20, 8, 3, { mat: stone, z: 2.4, bevel: 0.7, n: [0, -0.3, 0.95] });
    c.box(x + 1, dy - 21, 4, 1.2, { mat: stone, z: 2.5, bevel: 0.4, r: 0.4 });
  }
  // Railing: top rail, a lower rail, bars every 4 px, rings every 16.
  const railPts = (off: number): P[] => {
    const pts: P[] = [];
    for (let x = 8; x <= len - 6; x += 2) pts.push([x + 0.5, deck(x) + off + 0.5]);
    return pts;
  };
  c.stroke(railPts(-13.5), 0.75, 0.75, { mat: iron, z: 1.6 });
  c.stroke(railPts(-6), 0.45, 0.45, { mat: iron, z: 1.5 });
  for (let x = 8; x < len - 6; x++) {
    if (x % 4 === 0) c.capsule(x + 0.5, deck(x) - 13, x + 0.5, deck(x) - 0.5, 0.3, 0.3, { mat: iron, z: 1.4 });
    if (x % 16 === 8) {
      const cx = x + 2.5;
      const cy = deck(x) - 8.5;
      c.plane(cx - 2.6, cy - 2.6, 5.2, 5.2, {
        mat: iron,
        z: 1.45,
        mask: (px, py) => Math.abs(Math.hypot(px - cx, py - cy) - 2) < 0.4,
        normal: (px, py, n) => {
          n[0] = (px - cx) * 0.3;
          n[1] = (py - cy) * 0.3;
          n[2] = 1;
        },
      });
    }
  }
  // Bikes chained to the railing.
  const m = bikeMatsHd(c);
  const wheels: P[] = [];
  for (let x = 14, i = 0; x < len - 30; x += 22 + (i % 3) * 6, i++) {
    wheels.push(...bikeHd(c, m, x, top + Math.round(hillY(x + 10, len, h)), BIKE_COLOURS[(i * 5 + 1) % BIKE_COLOURS.length], i % 2 === 0, 3));
  }
  return fr(outlineC(c.render({ outline: 'none', sep: true, ao: 0.25 }), d, wheelHoles(wheels, d)), 1, top + 1, d);
}

/** The brick arch face of a canal bridge below the deck (front decor); len × (h + 42), anchor (0, h + 2). */
export function bridgeFaceHd(len: number, h: number, d: D): Frame {
  const top = h + 2;
  const H = top + 40;
  const c = new HdCanvas(len, H, d);
  const brickM = face(c, PAL_HD.brick, { lo: 1, hi: 5 });
  const mortar = face(c, PAL_HD.stone, { lo: 1, hi: 3 });
  const coping = face(c, PAL_HD.stone, { lo: 3, hi: 7 });
  const arch = face(c, PAL_HD.gable, { lo: 2, hi: 5 });
  const dark = glow(c, PAL_HD.canal, { lo: 0, hi: 2, dither: 0.3 });
  const water = glow(c, PAL_HD.canal, { lo: 0, hi: 5, dither: 0.25 });
  const moss = face(c, PAL_HD.moss, { lo: 1, hi: 4 });
  const cx = len / 2;
  const ar = len * 0.3;
  // The deck line and the arch top per art column (looked up per px by the masks below).
  const cols = Math.ceil(len * d) + 1;
  const deckCol = new Float64Array(cols);
  const archCol = new Float64Array(cols);
  for (let X = 0; X < cols; X++) {
    const x = (X + 0.5) / d;
    deckCol[X] = top + hillY(x, len, h) + 2;
    const dx = (x - cx) / ar;
    archCol[X] = Math.abs(dx) < 1 ? H - 2 - Math.sqrt(1 - dx * dx) * (H - top - 12) : Infinity;
  }
  const col = (x: number): number => Math.min(cols - 1, Math.max(0, Math.floor(x * d)));
  const deckY = (x: number): number => deckCol[col(x)];
  const archTop = (x: number): number => archCol[col(x)];
  const inArch = (x: number, y: number): boolean => y >= archTop(x);
  // Brick face (minus the arch), the stone coping along the deck.
  c.plane(0, 0, len, H, {
    mat: brickM,
    z: 0,
    mask: (x, y) => y >= deckY(x) + 2 && !inArch(x, y),
    tex: texAll(brick({ mortar, bw: 4, bh: 2, joint: 0.5, wear: 0.7, seed: 6 }), (s) => {
      // Damp and moss towards the water line.
      if (s.y > H - 12) {
        s.tone -= (s.y - (H - 12)) * 0.03;
        if (s.y > H - 6 && noise2(s.x, s.y, 2, 9) > 0.45) s.mat = moss;
      }
    }),
  });
  c.plane(0, 0, len, top + 5, {
    mat: coping,
    z: 0.6,
    mask: (x, y) => y >= deckY(x) && y < deckY(x) + 2,
    normal: (x, y, n) => {
      const t = y - deckY(x);
      n[0] = 0;
      n[1] = t < 0.8 ? -0.6 : 0.2;
      n[2] = 0.85;
    },
  });
  // The arch: white voussoirs round the opening, the dark vault, the canal under it.
  const ax0 = Math.max(0, cx - ar - 3);
  const ay0 = Math.max(0, H - 2 - (H - top - 12) - 3);
  c.plane(ax0, ay0, Math.min(len, cx + ar + 3) - ax0, H - ay0, {
    mat: arch,
    z: 0.4,
    mask: (x, y) => {
      const t = archTop(x);
      if (t === Infinity) return false;
      const dx = (x - cx) / ar;
      const ry = H - top - 12;
      const q = Math.hypot(dx * ar, ((H - 2 - y) / ry) * ar);
      return y < H && y >= t - 2.2 && q <= ar + 2.2 && q > ar - 0.01 && !inArch(x, y);
    },
    tex: (s) => {
      const a = Math.atan2(H - 2 - s.y, s.x - cx);
      if (Math.abs(((a / (Math.PI / 24)) % 1) - 0.5) > 0.44) {
        s.tone -= 0.3;
        s.dz = -0.2;
      }
    },
  });
  c.plane(ax0, ay0, Math.min(len, cx + ar + 3) - ax0, H - 8 - ay0, {
    mat: dark,
    z: -3,
    mask: (x, y) => inArch(x, y),
    tex: (s) => {
      // The vault: darkest under the crown, a faint glow of the far opening near the water.
      s.tone = -0.32 + Math.max(0, s.y - (H - 16)) * 0.035;
    },
  });
  c.plane(0, H - 8, len, 8, {
    mat: water,
    z: -2.5,
    mask: (x, y) => inArch(x, y),
    tex: (s) => {
      const dy = s.y - (H - 8);
      s.tone = -0.2 + dy * 0.02 + (noise2(s.x * 0.4, s.y * 2.5, 2, 3) - 0.5) * 0.3;
      // The light at the far end of the arch, broken by ripples.
      if (Math.abs(s.x - cx) < ar * 0.5 && noise2(s.x * 0.5, s.y * 3, 2, 5) > 0.6) s.tone += 0.3;
    },
  });
  return fr(c.render({ outline: 'none', sep: false, ao: 0.35 }), 0, top, d);
}

// ============================================================================== Museumplein

/**
 * The front strip of lawn along the ground line (w × 48, top-left): mowed grass in clean tone
 * clusters, not per-px noise. A flat field in wide mowing stripes (darker towards the viewer)
 * carries staggered grass TUFTS: three blades each, lit on their light side and towards the tips,
 * with a short shade under the tuft; nearer rows are taller. The top edge is a fringe of tufts
 * standing over the lawn; a few small flowers. Periodic in x (PER), so the pieces tile.
 */
export function lawnHd(w: number, d: D): Frame {
  const c = new HdCanvas(w, 48, d);
  const grass = glow(c, PAL_HD.green, { lo: 2, hi: 7 });
  const blooms = [PAL_HD.red, PAL_HD.pink, PAL_HD.gold, PAL_HD.snow].map((r) => glow(c, r, { lo: 2, hi: r.length - 2 }));
  /** Tuft grid (logical px): CW divides PER, rows staggered by half a cell. */
  const CW = 3.2;
  const CH = 2.4;
  const NI = Math.round(PER / CW);
  const hit = { kind: 0, lit: 0 };
  // Cell hashes, once per cell (rows −2 … 22, NI cells a row).
  const NJ = 26;
  const HC = new Float32Array(NJ * NI * 3);
  for (let j = 0; j < NJ; j++) {
    for (let i = 0; i < NI; i++) {
      const o = (j * NI + i) * 3;
      HC[o] = hash2(i, (j - 2) & 1023, 51);
      HC[o + 1] = hash2(i, (j - 2) & 1023, 52);
      HC[o + 2] = hash2(i, (j - 2) & 1023, 53);
    }
  }
  /** What covers (x, y): kind 0 the field, 1 a blade (lit 0 … 1 towards its tip), 2 the shade under a tuft. */
  const tuftAt = (x: number, y: number): typeof hit => {
    hit.kind = 0;
    hit.lit = 0;
    const jy = Math.floor((y - 4) / CH);
    for (let j = jy - 1; j <= jy + 2; j++) {
      const stag = (j & 1) * CW * 0.5;
      const ix = Math.floor((x - stag) / CW);
      for (let i = ix - 1; i <= ix + 1; i++) {
        const ii = ((i % NI) + NI) % NI;
        const jj = j & 1023;
        if (j < -2 || j >= NJ - 2) continue;
        const o = ((j + 2) * NI + ii) * 3;
        const h1 = HC[o];
        const h2 = HC[o + 1];
        const h3 = HC[o + 2];
        if (j >= 0 && h3 < 0.18) continue; // some cells stay plain field
        const by = j < 0 ? 4.4 + h2 * 0.6 : 4 + (j + 1) * CH - h2 * CH * 0.5;
        const bx = (i + 0.5) * CW + stag + (h1 - 0.5) * CW * 0.6;
        const near = Math.min(1, Math.max(0, (by - 4) / 44));
        const th = (j < 0 ? 2.2 + h3 * 1.6 : 1.3 + h3 * 1.1) * (1 + near * 0.7);
        const hw = 1 + near * 0.5;
        const lean = (h1 - 0.5) * 0.5;
        if (y > by + 0.75 || y < by - th * 1.05 || Math.abs(x - bx) > hw + th * 0.5 + 1) continue;
        let inBlade = false;
        let lit = 0;
        for (let k = -1; k <= 1; k++) {
          const hk = th * (k === 0 ? 1 : 0.62 + hash2(ii * 3 + k + 1, jj, 54) * 0.25);
          const up = by - y;
          if (up < 0 || up > hk) continue;
          const cx = bx + k * hw * 0.62 + (lean + k * 0.18) * up;
          const half = (0.42 + near * 0.12) * (1 - up / hk);
          if (Math.abs(x - cx) <= half) {
            inBlade = true;
            lit = Math.max(lit, up / hk + (x < cx ? 0.25 : 0));
          }
        }
        if (inBlade) {
          hit.kind = 1;
          hit.lit = lit;
        } else if (y >= by && y < by + 0.75 && Math.abs(x - bx) < hw * 1.1) {
          hit.kind = 2;
        }
      }
    }
    return hit;
  };
  c.plane(0, 0, w, 48, {
    mat: grass,
    z: 0,
    mask: (x, y) => y >= 4 || tuftAt(x, y).kind === 1,
    tex: (s) => {
      const dd = s.y - 4;
      // Wide mowing stripes (period 32 px); the strip darker towards the viewer.
      const stripe = Math.floor((((s.x % 32) + 32) % 32) / 16) ? 0.06 : -0.03;
      // As at 1×: a lit band on top, the front of the strip (from 30 px down) in shade.
      const base = stripe - Math.max(0, dd) * 0.004 + (dd < 1.2 ? 0.12 : 0) - (dd >= 30 ? 0.12 : 0);
      const t = tuftAt(s.x, s.y);
      s.tone = t.kind === 1 ? base + 0.12 + t.lit * 0.2 : t.kind === 2 ? base - 0.16 : base;
      // Flowers: a small bloom (½ logical px at 4×, 1 at 2×) on a few cells, lit at its top left.
      const fx = ((Math.floor(s.x) % 128) + 128) % 128;
      const fy = Math.floor(s.y);
      if (dd > 6 && t.kind === 0 && hash2(fx, fy, 13) > 0.985) {
        const size = d >= 4 ? 0.5 : 1;
        const lx = s.x - Math.floor(s.x);
        const ly = s.y - fy;
        if (lx < size && ly < size) {
          s.mat = blooms[Math.floor(hash2(fx, fy, 16) * blooms.length)];
          s.tone = d >= 4 && lx < 0.25 && ly < 0.25 ? 0.3 : 0.05;
        }
      }
    },
  });
  return fr(c.render({ outline: 'none', sep: false, ao: 0, clean: false }), 0, 0, d);
}

/** The long shallow Museumplein pool (w × 10, 4 frames, top-left): stone rim, rippling sky water. */
export function poolHd(w: number, d: D): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const c = new HdCanvas(w, 10, d);
    const stone = face(c, PAL_HD.stone, { lo: 3, hi: 7 });
    const wat = glow(c, PAL_HD.sky, { lo: 1, hi: 7, dither: 0.2 });
    c.box(0, 0, w, 10, { mat: stone, z: 0, tex: plaster({ seed: 4, cracks: 0.3, stains: 0.3 }) });
    c.box(0, 0, w, 2, { mat: stone, z: 0.3, n: [0, -0.6, 0.8] });
    c.box(0, 9, w, 1, { mat: stone, z: 0.2, tone: -0.35 });
    c.plane(2, 2, w - 4, 6, {
      mat: wat,
      z: 0.5,
      tex: (s) => {
        const x = s.x;
        const y = s.y - 2;
        s.tone = -0.05 + y * 0.03;
        if (y < 0.6) s.tone = -0.3;
        const k = (((x + f * 3) % 16) + 16) % 16;
        if (Math.abs(y - 1.4) < 0.5 && k < 3) s.tone = 0.5;
        if (Math.abs(y - 4.2) < 0.4 && (((Math.floor(x) * 3 + f * 5) & 31) === 7 || ((Math.floor(x) * 5 + f * 3) & 31) === 21)) s.tone = 0.42;
        s.tone += (noise2x(x + f * 2, y * 3, 4, 32, 7) - 0.5) * 0.12;
      },
    });
    return fr(c.render({ outline: 'none', sep: false, ao: 0.2 }), 0, 0, d);
  });
}

