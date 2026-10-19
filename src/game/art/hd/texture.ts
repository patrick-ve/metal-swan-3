/**
 * UHD material textures (docs/ART_GUIDE.md "UHD art"): `Texture` functions for HdCanvas
 * primitives. Every size is in LOGICAL px, so a texture keeps its layout at 2× and 4×; finer
 * detail (speckles, chips, hairline cracks, grain) appears only where the art px are small
 * enough (s.d = 4). Textures change the normal (so the key light models the relief), the tone
 * (wear, stains), the height (recessed joints) or the material (mortar between bricks).
 * Deterministic: hashes of logical cells and the seed, never Math.random.
 */
import { hash2, noise2 } from '../paint';
import type { TexSample, Texture } from './canvas';

/** Chain several textures. */
export function texAll(...t: ReadonlyArray<Texture | null | undefined>): Texture {
  const list = t.filter((x): x is Texture => !!x);
  return (s) => {
    for (const f of list) {
      f(s);
      if (s.cut) return;
    }
  };
}

function tilt(s: TexSample, ex: number, ey: number): void {
  s.nx += ex;
  s.ny += ey;
}

export interface BrickOpts {
  /** Material id of the mortar. */
  mortar: number;
  /** Brick size, logical px (default 4 × 2: the small Dutch brick). */
  bw?: number;
  bh?: number;
  /** Joint width, logical px (default 0.5: one art px at 2×, two at 4×). */
  joint?: number;
  /** 0..1: tone variation between bricks, chipped corners, soot / damp. */
  wear?: number;
  seed?: number;
  /** World offset of the bond (to line rows up across primitives). */
  ox?: number;
  oy?: number;
}

/** Running-bond brick and mortar: lit top / left brick edges, shaded bottom / right, per-brick tone, chips at 4×. */
export function brick(o: BrickOpts): Texture {
  const bw = o.bw ?? 4;
  const bh = o.bh ?? 2;
  const j = o.joint ?? 0.5;
  const wear = o.wear ?? 0.5;
  const seed = o.seed ?? 1;
  const ox = o.ox ?? 0;
  const oy = o.oy ?? 0;
  return (s) => {
    const y = s.y - oy;
    const row = Math.floor(y / bh);
    const x = s.x - ox + (row & 1 ? bw / 2 : 0);
    const col = Math.floor(x / bw);
    const fx = x - col * bw;
    const fy = y - row * bh;
    const e = 1 / s.d;
    const hj = Math.max(j, e) ;
    if (fy < hj || fx < hj) {
      s.mat = o.mortar;
      s.dz = -0.3;
      // Mortar under a brick is in its shadow; a joint's lower lip catches light.
      s.tone += fy < hj && fy < e ? -0.18 : -0.06;
      return;
    }
    const r = hash2(col, row, seed);
    s.tone += (r - 0.5) * 0.28 * (0.4 + wear);
    // Bevel: one art px at the edges (two at 4×) faces up / left / down / right.
    const b = Math.max(e, 0.25);
    if (fy - hj < b) tilt(s, 0, -0.55);
    else if (bh - fy < b) tilt(s, 0, 0.5);
    if (fx - hj < b) tilt(s, -0.45, 0);
    else if (bw - fx < b) tilt(s, 0.45, 0);
    // Chipped corners and pits (fine detail: only visible at 4×).
    if (s.d >= 4) {
      const pit = hash2(Math.floor(s.x * s.d), Math.floor(s.y * s.d), seed + 7);
      if (pit > 0.94) s.tone -= 0.14;
      else if (pit < 0.03) s.tone += 0.1;
      if (wear > 0.3 && hash2(col, row, seed + 3) < wear * 0.25 && fx - hj < 0.75 && fy - hj < 0.75 && fx + fy - 2 * hj < 0.75) {
        s.mat = o.mortar;
        s.dz = -0.3;
        s.tone -= 0.1;
      }
    }
    // Damp / soot: large soft blotches.
    s.tone -= Math.max(0, noise2(s.x, s.y, 9, seed + 11) - 0.62) * wear * 0.9;
  };
}

export interface PlasterOpts {
  seed?: number;
  /** 0..1 amount of hairline cracks. */
  cracks?: number;
  /** 0..1 amount of rain streaks running down from ledges. */
  stains?: number;
}

/** Plaster / paint: a soft trowel texture, hairline cracks and rain stains. */
export function plaster(o: PlasterOpts = {}): Texture {
  const seed = o.seed ?? 2;
  const cracks = o.cracks ?? 0.4;
  const stains = o.stains ?? 0.4;
  return (s) => {
    s.tone += (noise2(s.x, s.y, 3, seed) - 0.5) * 0.1;
    if (s.d >= 4) s.tone += (hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed) - 0.5) * 0.05;
    // Rain stains: vertical streaks that fade downwards from random tops.
    const sx = Math.floor(s.x * 0.8);
    const top = hash2(sx, 0, seed + 5) * 30;
    if (hash2(sx, 1, seed + 5) < stains * 0.5 && s.y > top) {
      const f = 1 - Math.min(1, (s.y - top) / 14);
      s.tone -= f * 0.16 * (0.5 + noise2(s.x, s.y, 1.5, seed + 9));
    }
    // Hairline cracks: thin ridges of value noise.
    if (cracks > 0) {
      const n = noise2(s.x, s.y, 7, seed + 13);
      const w = 0.006 + 0.012 / s.d;
      if (Math.abs(n - 0.5) < w && noise2(s.x, s.y, 5, seed + 17) < cracks * 0.6) {
        s.tone -= 0.32;
        s.dz = -0.2;
      }
    }
  };
}

export interface WoodOpts {
  seed?: number;
  /** 'h' planks along x, 'v' along y. */
  dir?: 'h' | 'v';
  /** Plank width, logical px (0 = one board). */
  plank?: number;
  /** Seam material (default: the same, darker). */
  seam?: number;
}

/** Wood: long grain lines, knots (at 4×) and plank seams. */
export function wood(o: WoodOpts = {}): Texture {
  const seed = o.seed ?? 3;
  const horiz = (o.dir ?? 'h') === 'h';
  const pw = o.plank ?? 0;
  return (s) => {
    const a = horiz ? s.x : s.y;
    const b = horiz ? s.y : s.x;
    const plank = pw > 0 ? Math.floor(b / pw) : 0;
    const g = noise2(a * 0.12, b * 1.6 + plank * 7, 1, seed + plank);
    s.tone += (g - 0.5) * 0.3;
    if (s.d >= 4 && Math.abs(noise2(a * 0.3, b * 3, 1, seed + 5) - 0.5) < 0.03) s.tone -= 0.12;
    if (pw > 0) {
      const f = b - plank * pw;
      const e = 1 / s.d;
      if (f < e) {
        if (o.seam) s.mat = o.seam;
        s.tone -= 0.3;
        s.dz = -0.2;
      } else if (f < 2 * e) {
        if (horiz) tilt(s, 0, -0.4);
        else tilt(s, -0.4, 0);
      }
    }
    if (s.d >= 4) {
      const k = noise2(a, b, 5, seed + 9);
      if (k > 0.86) s.tone -= (k - 0.86) * 2.2;
    }
  };
}

export interface CobbleOpts {
  /** Material of the gaps (sand / dark grit). */
  gap: number;
  /** Stone size, logical px (default 3 × 2). */
  cw?: number;
  ch?: number;
  seed?: number;
}

/** Cobbles / klinkers: rows of rounded stones, each a small lit dome, grit in the gaps. */
export function cobbles(o: CobbleOpts): Texture {
  const cw = o.cw ?? 3;
  const ch = o.ch ?? 2;
  const seed = o.seed ?? 4;
  return (s) => {
    const row = Math.floor(s.y / ch);
    const x = s.x + hash2(row, 0, seed) * cw;
    const col = Math.floor(x / cw);
    const fx = (x - col * cw) / cw - 0.5;
    const fy = (s.y - row * ch) / ch - 0.5;
    const q = fx * fx * 3.2 + fy * fy * 3.2;
    if (q > 0.62) {
      s.mat = o.gap;
      s.dz = -0.4;
      s.tone -= 0.1;
      return;
    }
    tilt(s, fx * 1.1, fy * 1.3);
    s.tone += (hash2(col, row, seed) - 0.5) * 0.22;
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed + 1) > 0.95) s.tone -= 0.12;
  };
}

export interface FoldOpts {
  /** Direction of the creases in radians (0 = horizontal creases). */
  angle?: number;
  /** Mean distance between creases, logical px. */
  spacing?: number;
  /** Strength 0..1. */
  amp?: number;
  /** 0..1: share of the surface that has creases (they come in patches, never as even stripes). */
  cover?: number;
  seed?: number;
}

/**
 * Cloth folds: a few curved creases in patches (never periodic stripes). Each crease is a soft
 * ridge: its upper / left flank catches the key light, a dark valley line under it.
 */
export function folds(o: FoldOpts = {}): Texture {
  const ang = o.angle ?? 0;
  const sp = o.spacing ?? 3;
  const amp = o.amp ?? 0.6;
  const cover = o.cover ?? 0.55;
  const seed = o.seed ?? 5;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  return (s) => {
    const a = s.x * c + s.y * sn;
    const b = -s.x * sn + s.y * c;
    // Curved crease lines: the phase bends with a slow noise along the crease.
    const ph = (b + (noise2(a, b * 0.3, sp * 1.5, seed) - 0.5) * sp * 1.6) / sp;
    const k = Math.floor(ph);
    const f = ph - k;
    // Only some creases exist, and each fades along its length.
    const on = hash2(k, 0, seed) < cover ? 1 : 0;
    if (!on) return;
    const fade = noise2(a, k * 7.1, sp, seed + 3);
    if (fade < 0.35) return;
    const st = amp * Math.min(1, (fade - 0.35) * 3);
    // Triangle ridge with a sharp valley at f ≈ 0.
    const r = f < 0.5 ? f * 2 : (1 - f) * 2;
    const slope = f < 0.15 ? 1 : f > 0.85 ? -1 : 0;
    s.nx += -sn * slope * st * 0.7;
    s.ny += c * slope * st * 0.7;
    if (r < 0.12) s.tone -= st * 0.22;
  };
}

export interface StrandOpts {
  /** Direction of the strands in radians (0 = along x). */
  angle?: number;
  /** Strand-clump width, logical px. */
  width?: number;
  seed?: number;
}

/** Hair: clumps of strands — each clump a soft ridge along the strand direction, dark partings between. */
export function strands(o: StrandOpts = {}): Texture {
  const ang = o.angle ?? 0;
  const w = o.width ?? 1.6;
  const seed = o.seed ?? 9;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  return (s) => {
    const a = s.x * c + s.y * sn;
    const b = -s.x * sn + s.y * c;
    const ph = (b + (noise2(a, 0, 4, seed) - 0.5) * w * 0.5) / w;
    const f = ph - Math.floor(ph);
    const across = (f - 0.5) * 2;
    s.nx += -sn * across * 0.3;
    s.ny += c * across * 0.3;
    if (f < 0.1 && noise2(a, ph, 2, seed + 1) > 0.55) s.tone -= 0.2;
    if (s.d >= 4 && hash2(Math.floor(a * 4), Math.floor(b * 1.2), seed + 2) > 0.9) s.tone += 0.08;
  };
}

export interface LeafOpts {
  /** Leaf-clump size, logical px. */
  size?: number;
  seed?: number;
  /** 0..1: how much clumps break the silhouette (holes at the edge). */
  ragged?: number;
}

/** Foliage: clumps of leaves, each a small dome; dark gaps between clumps; ragged silhouette. */
export function leaves(o: LeafOpts = {}): Texture {
  const size = o.size ?? 3;
  const seed = o.seed ?? 6;
  const rag = o.ragged ?? 0.5;
  return (s) => {
    // Nearest clump centre on a jittered grid (Worley, 3 × 3 cells).
    const gx = Math.floor(s.x / size);
    const gy = Math.floor(s.y / size);
    let best = 9;
    let second = 9;
    let bx = 0;
    let by = 0;
    let bid = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = (gx + i + 0.15 + hash2(gx + i, gy + j, seed) * 0.7) * size;
        const cy = (gy + j + 0.15 + hash2(gx + i, gy + j, seed + 1) * 0.7) * size;
        const dx = (s.x - cx) / size;
        const dy = (s.y - cy) / size;
        const q = dx * dx + dy * dy;
        if (q < best) {
          second = best;
          best = q;
          bx = dx;
          by = dy;
          bid = hash2(gx + i, gy + j, seed + 2);
        } else if (q < second) second = q;
      }
    }
    // Clump dome normal, blended with the canopy's.
    s.nx = s.nx * 0.9 + bx * 1.1;
    s.ny = s.ny * 0.9 + by * 1.1;
    s.tone += (bid - 0.5) * 0.18;
    // Gaps between clumps (cell borders) read as deep shade.
    const edge = Math.sqrt(second) - Math.sqrt(best);
    if (edge < 0.12) s.tone -= 0.28;
    // Ragged silhouette: drop the outer part of clumps near the canopy edge.
    if (rag > 0 && s.nz < 0.45 && best > 0.12 + (1 - rag) * 0.3) s.cut = true;
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed + 3) > 0.93) s.tone += 0.12;
  };
}

export interface WaterOpts {
  seed?: number;
  /** Ripple spacing, logical px. */
  spacing?: number;
  /** Phase (animate by time). */
  phase?: number;
}

/** Canal water: horizontal ripples whose tops face the sky (lighter) and troughs dark. */
export function ripples(o: WaterOpts = {}): Texture {
  const seed = o.seed ?? 7;
  const sp = o.spacing ?? 2.5;
  const ph = o.phase ?? 0;
  return (s) => {
    const w = noise2(s.x * 0.25, s.y, 3, seed);
    const v = (s.y + w * sp * 1.2) / sp + ph;
    const f = Math.sin(v * Math.PI * 2);
    s.ny += -f * 0.5;
    s.nz += 0.2;
    // Short horizontal glints.
    const g = noise2(s.x * 0.35, s.y * 2.2, 2, seed + 5);
    if (f > 0.7 && g > 0.72) s.tone += 0.3;
  };
}

/** Rust / grime blotches on metal (tone only). */
export function grime(seed = 8, amount = 0.5, scale = 4): Texture {
  return (s) => {
    const n = noise2(s.x, s.y, scale, seed);
    if (n > 1 - amount * 0.5) s.tone -= (n - (1 - amount * 0.5)) * 1.4;
    if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), seed) > 0.96) s.tone -= 0.12;
  };
}
