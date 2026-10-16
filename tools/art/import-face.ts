/**
 * npm run art:import-face — the one raster import of the first-person mode (docs/design/fps.md §8.7).
 *
 * Reads the user's face crop `art-src/user/mecha-hofmans-head.png` (PNG decode here only, with
 * node:zlib; never in src/), cuts out the background (the blue sky around the head and the dark
 * suit below the chin become transparent; hair, face, ears and neck stay), scales the head with a
 * box filter to the billboard sizes and maps every pixel to the nearest palette colour (no
 * dithering). The red eye glow maps to the red ramp; each eye centre becomes the brightest red so
 * the suit painter can flare it.
 *
 * Writes `src/game/content/fps/art/mecha-face.gen.ts` (pure data, committed). Re-running the
 * import gives the same text (tests/art/fps-face-import.test.ts checks this).
 *
 *   npm run art:import-face            write the module
 *   npm run art:import-face -- --check exit 1 when the module is out of date
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PAL, SWATCHES } from '../../src/engine/palette';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const FACE_SRC = resolve(ROOT, 'art-src/user/mecha-hofmans-head.png');
export const FACE_OUT = resolve(ROOT, 'src/game/content/fps/art/mecha-face.gen.ts');

// ------------------------------------------------------------------------------------ PNG decode

export interface Rgba {
  w: number;
  h: number;
  /** r, g, b, a per pixel, row-major. */
  data: Uint8Array;
}

/** Minimal PNG decoder: 8-bit greyscale / RGB / RGBA / grey+alpha, non-interlaced. */
export function decodePng(buf: Uint8Array): Rgba {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ctype = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  while (p < buf.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(buf[p + 4], buf[p + 5], buf[p + 6], buf[p + 7]);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = dv.getUint32(p + 8);
      h = dv.getUint32(p + 12);
      depth = body[8];
      ctype = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const chans = ctype === 0 ? 1 : ctype === 2 ? 3 : ctype === 4 ? 2 : ctype === 6 ? 4 : 0;
  if (chans === 0) throw new Error(`unsupported PNG colour type ${ctype}`);
  const total = idat.reduce((s, b) => s + b.length, 0);
  const z = new Uint8Array(total);
  let o = 0;
  for (const b of idat) {
    z.set(b, o);
    o += b.length;
  }
  const raw = inflateSync(z);
  const stride = w * chans;
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const a = x >= chans ? px[y * stride + x - chans] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= chans && y > 0 ? px[(y - 1) * stride + x - chans] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * chans;
    if (chans === 1 || chans === 2) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = px[s];
      data[i * 4 + 3] = chans === 2 ? px[s + 1] : 255;
    } else {
      data[i * 4] = px[s];
      data[i * 4 + 1] = px[s + 1];
      data[i * 4 + 2] = px[s + 2];
      data[i * 4 + 3] = chans === 4 ? px[s + 3] : 255;
    }
  }
  return { w, h, data };
}

// ------------------------------------------------------------------------------------ cut-out

/** True for the blue sky behind the head (and the near-black suit around it). */
function isBackground(r: number, g: number, b: number): boolean {
  return (b > r + 18 && b >= g) || r + g + b < 60;
}

/** True for the red eye glow. */
export function isGlow(r: number, g: number, b: number): boolean {
  return r > 190 && r - g > 130 && r - b > 130;
}

/** True for skin (warm, red over blue). */
function isSkin(r: number, g: number, b: number): boolean {
  return r > 90 && r - b > 40 && r >= g;
}

/**
 * Mask of the head (1 = keep). The sky and the black suit are flooded from the image border;
 * the head grows from the face centre over everything that is not background. Below the chin
 * line only the skin of the neck may grow (the collar goes), and nothing grows outside an
 * ellipse around the head (the machinery at the image edges goes).
 */
export function headMask(img: Rgba): Uint8Array {
  const { w, h, data } = img;
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const rgb = (i: number): [number, number, number] => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const pushBg = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i]) return;
    const [r, g, b] = rgb(i);
    if (!isBackground(r, g, b)) return;
    bg[i] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) {
    pushBg(x, 0);
    pushBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushBg(0, y);
    pushBg(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    pushBg(x + 1, y);
    pushBg(x - 1, y);
    pushBg(x, y + 1);
    pushBg(x, y - 1);
  }
  const chinY = Math.round(h * CHIN);
  const neckEnd = Math.round(h * NECK_END);
  const ecx = w * 0.5;
  const ecy = h * 0.45;
  const erx = w * 0.44;
  const ery = h * 0.5;
  const keep = new Uint8Array(w * h);
  const ok = (x: number, y: number): boolean => {
    const i = y * w + x;
    if (bg[i] || keep[i]) return false;
    const dx = (x - ecx) / erx;
    const dy = (y - ecy) / ery;
    if (dx * dx + dy * dy > 1) return false;
    if (y >= neckEnd) return false;
    if (y >= chinY) {
      const [r, g, b] = rgb(i);
      return isSkin(r, g, b);
    }
    return true;
  };
  const cx = w >> 1;
  const cy = Math.round(h * 0.42);
  keep[cy * w + cx] = 1;
  stack.push(cx, cy);
  while (stack.length) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !ok(nx, ny)) continue;
      keep[ny * w + nx] = 1;
      stack.push(nx, ny);
    }
  }
  // Drop thin fringes: a kept pixel with fewer than 2 kept 4-neighbours goes (stray sky edge
  // pixels and laser streaks).
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!keep[i]) continue;
      let n = 0;
      if (x > 0 && keep[i - 1]) n++;
      if (x < w - 1 && keep[i + 1]) n++;
      if (y > 0 && keep[i - w]) n++;
      if (y < h - 1 && keep[i + w]) n++;
      if (n >= 2) mask[i] = 1;
    }
  }
  return mask;
}

/** The chin line and the end of the kept neck, as a share of the source height. */
const CHIN = 0.8;
const NECK_END = 0.93;

/** Bounding box of a mask. */
export function maskBounds(mask: Uint8Array, w: number, h: number): { x: number; y: number; w: number; h: number } {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ------------------------------------------------------------------------------------ scale + map

interface Sample {
  r: number;
  g: number;
  b: number;
  /** coverage 0..1 */
  a: number;
  /** share of eye-glow pixels 0..1 */
  glow: number;
}

/** Box filter of the masked region (sx, sy, sw, sh) to w × h. */
function boxScale(img: Rgba, mask: Uint8Array, sx: number, sy: number, sw: number, sh: number, w: number, h: number): Sample[] {
  const out: Sample[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx0 = sx + (x * sw) / w;
      const fx1 = sx + ((x + 1) * sw) / w;
      const fy0 = sy + (y * sh) / h;
      const fy1 = sy + ((y + 1) * sh) / h;
      let r = 0;
      let g = 0;
      let b = 0;
      let cov = 0;
      let area = 0;
      let glow = 0;
      for (let py = Math.floor(fy0); py < Math.ceil(fy1); py++) {
        const wy = Math.min(fy1, py + 1) - Math.max(fy0, py);
        if (wy <= 0) continue;
        for (let px = Math.floor(fx0); px < Math.ceil(fx1); px++) {
          const wx = Math.min(fx1, px + 1) - Math.max(fx0, px);
          if (wx <= 0) continue;
          const wgt = wx * wy;
          area += wgt;
          if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
          const i = py * img.w + px;
          if (!mask[i]) continue;
          const pr = img.data[i * 4];
          const pg = img.data[i * 4 + 1];
          const pb = img.data[i * 4 + 2];
          r += pr * wgt;
          g += pg * wgt;
          b += pb * wgt;
          cov += wgt;
          if (isGlow(pr, pg, pb)) glow += wgt;
        }
      }
      out.push(cov > 0 ? { r: r / cov, g: g / cov, b: b / cov, a: cov / area, glow: glow / cov } : { r: 0, g: 0, b: 0, a: 0, glow: 0 });
    }
  }
  return out;
}

/**
 * Edge-keeping smoothing (a 3 × 3 bilateral pass): neighbours of a similar colour are averaged,
 * so the fine wrinkles of the source do not turn into speckle at 34 px, while the eyes, brows,
 * mouth and hair edges (large colour steps) stay sharp. The eye glow is never smoothed.
 */
function smooth(src: Sample[], w: number, h: number): Sample[] {
  const out: Sample[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const q = src[y * w + x];
      if (q.a < 0.5 || q.glow > 0.2) {
        out.push(q);
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const o = src[yy * w + xx];
          if (o.a < 0.5 || o.glow > 0.2) continue;
          const d = Math.abs(o.r - q.r) + Math.abs(o.g - q.g) + Math.abs(o.b - q.b);
          if (d > SMOOTH_RANGE) continue;
          const wgt = dx === 0 && dy === 0 ? 2 : 1;
          r += o.r * wgt;
          g += o.g * wgt;
          b += o.b * wgt;
          n += wgt;
        }
      }
      out.push({ r: r / n, g: g / n, b: b / n, a: q.a, glow: q.glow });
    }
  }
  return out;
}

/** Colour step (sum of |dr| + |dg| + |db|) up to which neighbours are averaged. */
const SMOOTH_RANGE = 55;

const hexOf = (c: number): string => `#${(c >>> 8).toString(16).padStart(6, '0')}`;
const rgbOf = (c: number): [number, number, number] => [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255];

/** CIE-ish weighted RGB distance ("redmean"), as `nearest` in src/engine/palette.ts. */
function dist(r: number, g: number, b: number, c: number): number {
  const [pr, pg, pb] = rgbOf(c);
  const rm = (pr + r) / 2;
  const dr = pr - r;
  const dg = pg - g;
  const db = pb - b;
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

function nearestOf(r: number, g: number, b: number, set: readonly number[]): number {
  let best = set[0];
  let bd = Infinity;
  for (const c of set) {
    const d = dist(r, g, b, c);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

const ALL = SWATCHES.map((s) => s.color >>> 0);
const RED = PAL.red.map((c) => c >>> 0);
/**
 * The colours a face may use: the warm skin, leather and rust ramps, the warm greys for the hair,
 * the snow highlights and the dark outline colours. The cool steel greys and the bright greens,
 * blues and purples never show on a face (the box filter would pick them for shaded hair).
 */
const FACE_SET: readonly number[] = [
  ...new Set(
    [...PAL.skinA, ...PAL.skinB, ...PAL.brown, ...PAL.rust, ...PAL.sand, ...PAL.stone, ...PAL.cloth, ...PAL.ink, PAL.hairA[2], PAL.red[0], PAL.red[1]].map((c) => c >>> 0),
  ),
];

export interface FaceImage {
  w: number;
  h: number;
  /** Palette colour per pixel (0 = transparent), row-major. */
  px: number[];
  /** Eye centres [left, right] as [x, y]. */
  eyes: [number, number][];
}

/** Find the two eye-glow centroids (left half / right half) in output coordinates. */
function eyeCentres(s: Sample[], w: number, h: number): [number, number][] {
  const res: [number, number][] = [];
  for (const half of [0, 1]) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < Math.round(h * 0.75); y++) {
      for (let x = half ? w >> 1 : 0; x < (half ? w : w >> 1); x++) {
        const q = s[y * w + x];
        if (q.a < 0.5 || q.glow <= 0.15) continue;
        sx += x * q.glow;
        sy += y * q.glow;
        n += q.glow;
      }
    }
    res.push(n > 0 ? [Math.round(sx / n), Math.round(sy / n)] : [half ? Math.round(w * 0.66) : Math.round(w * 0.34), Math.round(h * 0.45)]);
  }
  return res;
}

/**
 * Import the head at w × h. The head keeps its proportions at `aspectW` × h (it fits inside,
 * centred, the chin on the bottom row); a smaller `w` squeezes it sideways (the diagonal yaws).
 */
export function importFace(img: Rgba, w: number, h: number, aspectW = w): FaceImage {
  const mask = headMask(img);
  const bb = maskBounds(mask, img.w, img.h);
  const scale = Math.max(bb.w / aspectW, bb.h / h);
  const sw = aspectW * scale;
  const sh = h * scale;
  const sx = bb.x + (bb.w - sw) / 2;
  const sy = bb.y + bb.h - sh;
  const s = smooth(boxScale(img, mask, sx, sy, sw, sh, w, h), w, h);
  const px: number[] = [];
  for (const q of s) {
    if (q.a < 0.5) px.push(0);
    else if (q.glow > 0.45) px.push(PAL.red[2] >>> 0);
    else if (q.glow > 0.2) px.push(nearestOf(q.r, q.g, q.b, RED));
    else px.push(nearestOf(q.r, q.g, q.b, FACE_SET));
  }
  const eyes = eyeCentres(s, w, h);
  for (const [ex, ey] of eyes) {
    const i = ey * w + ex;
    if (px[i] !== 0) px[i] = PAL.red[3] >>> 0;
  }
  return { w, h, px, eyes };
}

// ------------------------------------------------------------------------------------ module text

const KEY_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-=?@';

export const FACE_SIZES: readonly { name: string; w: number; h: number; aspectW: number }[] = [
  { name: 'face34', w: 34, h: 42, aspectW: 34 },
  { name: 'face27', w: 27, h: 42, aspectW: 34 },
  { name: 'face16', w: 16, h: 20, aspectW: 16 },
];

export function renderModule(img: Rgba): string {
  const faces = FACE_SIZES.map((s) => ({ name: s.name, f: importFace(img, s.w, s.h, s.aspectW) }));
  const used = new Set<number>();
  for (const { f } of faces) for (const c of f.px) if (c) used.add(c);
  const colours = ALL.filter((c) => used.has(c));
  const keyOf = new Map<number, string>();
  colours.forEach((c, i) => keyOf.set(c, KEY_CHARS[i]));
  const nameOf = new Map(SWATCHES.map((s) => [s.color >>> 0, s.name]));
  const L: string[] = [];
  L.push('// generated by tools/art/import-face.ts — do not edit');
  L.push('// Source: art-src/user/mecha-hofmans-head.png (the user\'s own art, docs/design/fps.md §8.7).');
  L.push('// Re-run: npm run art:import-face');
  L.push('');
  L.push('export interface MechaFaceImage {');
  L.push('  w: number;');
  L.push('  h: number;');
  L.push('  /** One char per pixel; `.` = transparent, else a key of MECHA_FACE_KEY. */');
  L.push('  rows: readonly string[];');
  L.push('  /** Eye centres [left, right] as [x, y] (the tell flare). */');
  L.push('  eyes: readonly (readonly [number, number])[];');
  L.push('}');
  L.push('');
  L.push('/** Key char → palette colour (0xRRGGBBAA). */');
  L.push('export const MECHA_FACE_KEY: Readonly<Record<string, number>> = {');
  for (const c of colours) L.push(`  '${keyOf.get(c)}': 0x${c.toString(16).padStart(8, '0')}, // ${nameOf.get(c)} ${hexOf(c)}`);
  L.push('};');
  L.push('');
  for (const { name, f } of faces) {
    L.push(`export const ${name}: MechaFaceImage = {`);
    L.push(`  w: ${f.w},`);
    L.push(`  h: ${f.h},`);
    L.push(`  eyes: [[${f.eyes[0][0]}, ${f.eyes[0][1]}], [${f.eyes[1][0]}, ${f.eyes[1][1]}]],`);
    L.push('  rows: [');
    for (let y = 0; y < f.h; y++) {
      let row = '';
      for (let x = 0; x < f.w; x++) {
        const c = f.px[y * f.w + x];
        row += c ? keyOf.get(c) : '.';
      }
      L.push(`    '${row}',`);
    }
    L.push('  ],');
    L.push('};');
    L.push('');
  }
  return L.join('\n');
}

export function buildFaceModule(): string {
  return renderModule(decodePng(readFileSync(FACE_SRC)));
}

function main(): void {
  const text = buildFaceModule();
  if (process.argv.includes('--check')) {
    let cur = '';
    try {
      cur = readFileSync(FACE_OUT, 'utf8');
    } catch {
      /* missing */
    }
    if (cur !== text) {
      console.error(`${FACE_OUT} is out of date — run npm run art:import-face`);
      process.exitCode = 1;
    } else console.log('mecha face module is up to date');
    return;
  }
  writeFileSync(FACE_OUT, text);
  console.log(`wrote ${FACE_OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
