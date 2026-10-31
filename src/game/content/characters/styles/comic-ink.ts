/**
 * COMIC INK (comic.ts): the renderer. It turns the rig's HD G-buffer (comic-capture.ts) into a
 * comic-book figure:
 * - flat colour, two tones per material (light and shadow) with a hard terminator, from the
 *   G-buffer's normals and the key light (upper left), plus hard cast shadows where a nearer part
 *   overhangs (the chin on the collar, an arm on the jacket);
 * - a comic form shadow: besides the normals' terminator, every part turns to shadow in a band
 *   along its own lower-right edge (40 % of a thin limb, at most `band` px of a broad panel);
 *   limbs behind the body (the far arm and leg) sit in shadow as a whole;
 * - halftone dots in the shadows: a clean 45° dot grid tied to the pelvis, the dots growing
 *   (2 × 2 → rounded 4 × 4 at 4×) where the form turns deeper away from the light;
 * - a few white highlights on leather, metal and brass; a herringbone tick pattern on the lit
 *   tweed (4× only);
 * - brush ink with VARIABLE weight: the silhouette line is thin on the lit edges (up / left) and
 *   swells on the side away from the light (down / right), partly eating into the fill; every part
 *   that overlaps another draws the same weighted line onto the part behind it; material seams
 *   inside a part (the boot's sole, the belt) get a one-px line.
 * Fixed-colour parts (the gun, the hands, props) are re-toned by their ramp (their deepest tones
 * become ink); parts listed in `final` (the comic head, already inked) keep their colours.
 *
 * Every colour is a PAL_HD colour.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { PAL_HD, type HdRampName } from '../../../../engine/palette-hd';
import type { HdCanvas } from '../../../art/hd/canvas';
import { BLACK_ONE_HUE, KEY, specular } from '../../../art/hd/light';

export const INK: Color = PAL_HD.ink[0];

/** Two tones per ramp: the index of the light tone, the shadow tone, the dot tone and the highlight. */
export interface Tones {
  light: Color;
  shadow: Color;
  dot: Color;
  high: Color;
  /** Ramp index at and above which a fixed colour counts as lit. */
  split: number;
}

const rampKey = (r: Ramp): string => `${r.length}:${r[0]}:${r[r.length - 1]}`;

/** Comic tones per HD ramp (light, shadow, dot, highlight, split), chosen by eye. */
const TONE_TABLE: Readonly<Partial<Record<HdRampName, readonly [number, number, number, number, number]>>> = {
  brown: [4, 2, 1, 6, 4],
  hairB: [3, 2, 1, 5, 3],
  skinA: [5, 3, 2, 6, 5],
  red: [5, 3, 2, 6, 4],
  olive: [5, 3, 2, 6, 4],
  snow: [6, 3, 1, 6, 4],
  steel: [5, 3, 2, 7, 4],
  black: [4, 2, 1, 6, 3],
  gold: [5, 3, 2, 6, 4],
  sand: [5, 3, 2, 7, 4],
  cloth: [5, 3, 1, 6, 4],
  stone: [5, 3, 2, 7, 4],
  green: [5, 3, 1, 7, 4],
};

const toneCache = new Map<string, Tones>();
const nameOf = new Map<string, HdRampName>();
for (const n of Object.keys(PAL_HD) as HdRampName[]) {
  const k = rampKey(PAL_HD[n]);
  if (!nameOf.has(k)) nameOf.set(k, n);
}

/** The comic tones of a ramp (a material's `lo`..`hi` range guides unknown ramps). */
export function tonesOf(r: Ramp, lo?: number, hi?: number): Tones {
  const key = `${rampKey(r)}|${lo ?? ''}|${hi ?? ''}`;
  let t = toneCache.get(key);
  if (t) return t;
  const n = r.length;
  const name = nameOf.get(rampKey(r));
  // Black leather (boots, belt): a cool grey-blue light, near-ink shadow (spot blacks).
  const row = rampKey(r) === rampKey(BLACK_ONE_HUE) ? ([4, 1, 0, 6, 3] as const) : name ? TONE_TABLE[name] : undefined;
  const at = (i: number): Color => r[Math.max(0, Math.min(n - 1, i))];
  if (row && n >= 6) {
    t = { light: at(row[0]), shadow: at(row[1]), dot: at(row[2]), high: at(row[3]), split: row[4] };
    // Black leather shines with a near-white glint (a comic's white highlight).
    if (rampKey(r) === rampKey(BLACK_ONE_HUE)) t.high = PAL_HD.steel[7];
  } else {
    const a = lo ?? (n > 4 ? 1 : 0);
    const b = hi ?? (n > 4 ? n - 2 : n - 1);
    const li = Math.round(a + (b - a) * 0.8);
    const si = Math.round(a + (b - a) * 0.3);
    t = { light: at(li), shadow: at(si), dot: at(Math.max(0, si - 1)), high: at(n - 1), split: Math.round((li + si) / 2 + 0.5) };
  }
  toneCache.set(key, t);
  return t;
}

/** Every HD ramp holding a colour (fixed-colour parts vote for their ramp). */
const rampsOfColor = new Map<Color, Ramp[]>();
for (const n of Object.keys(PAL_HD) as HdRampName[]) {
  if (n === 'ink') continue;
  for (const c of PAL_HD[n]) {
    const list = rampsOfColor.get(c >>> 0) ?? [];
    list.push(PAL_HD[n]);
    rampsOfColor.set(c >>> 0, list);
  }
}
const INK_SET = new Set<Color>([PAL_HD.ink[0] >>> 0, PAL_HD.ink[1] >>> 0]);

/** Weights of the ink in art px at a density (lit side → shadow side). */
interface Weights {
  outLit: number;
  outShadow: number;
  inLit: number;
  inShadow: number;
  sepLit: number;
  sepShadow: number;
}
const WEIGHTS: Readonly<Record<2 | 4, Weights>> = {
  4: { outLit: 3.0, outShadow: 4.2, inLit: 0, inShadow: 2.8, sepLit: 1.0, sepShadow: 2.6 },
  2: { outLit: 1.6, outShadow: 2.2, inLit: 0, inShadow: 1.4, sepLit: 1.0, sepShadow: 1.5 },
};

/** Direction the shadow side faces (down and right, a little more down). */
const SX = 0.62;
const SY = 0.78;
/** Light of a unit normal (0 = turned away … 1 = facing the key light). */
const KX = KEY[0];
const KY = KEY[1];
const KZ = KEY[2];

export interface InkOpts {
  d: 2 | 4;
  /** The frame anchor on the canvas, art px (the halftone grid is tied to it). */
  ax: number;
  ay: number;
  /** Parts whose fixed colours are final (the comic head). */
  final?: ReadonlySet<number>;
  /** Terminator: a light value below this is shadow. */
  cut?: number;
  /** Width of the form shadow along each part's shadow-side edge, logical px. */
  band?: number;
  /** Spot blacks: a cast shadow within this many art px of its occluder is solid ink (default 0.9 · d). */
  spot?: number;
  /** First colour of the tweed cloth's ramp (its lit areas get a herringbone tick pattern). */
  tweed?: Color;
  /** The Helium Head: the silhouette ink round this part takes this colour (the status rim). */
  rim?: { part: number; color: Color };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/** Squared Euclidean distance to the nearest set px (Felzenszwalb & Huttenlocher). */
export function edt(set: Uint8Array, W: number, H: number): Float32Array {
  const INF = 1e9;
  const n = Math.max(W, H);
  const f = new Float64Array(n);
  const dd = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const out = new Float32Array(W * H);
  const tmp = new Float64Array(W * H);
  const pass = (len: number): void => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      const dq = q - v[k];
      dd[q] = dq * dq + f[v[k]];
    }
  };
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = set[y * W + x] ? 0 : INF;
    pass(H);
    for (let y = 0; y < H; y++) tmp[y * W + x] = dd[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = tmp[y * W + x];
    pass(W);
    for (let x = 0; x < W; x++) out[y * W + x] = dd[x];
  }
  return out;
}

/** Box blur (radius r) of a 0/1 mask, twice (≈ a Gaussian). */
function blurMask(m: Uint8Array, W: number, H: number, r: number): Float32Array {
  let a = new Float32Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = m[i];
  const k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let acc = 0;
      for (let x = 0; x <= r && x < W; x++) acc += a[row + x];
      for (let x = 0; x < W; x++) {
        b[row + x] = acc * k;
        if (x - r >= 0) acc -= a[row + x - r];
        if (x + r + 1 < W) acc += a[row + x + r + 1];
      }
    }
    const c = new Float32Array(W * H);
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = 0; y <= r && y < H; y++) acc += b[y * W + x];
      for (let y = 0; y < H; y++) {
        c[y * W + x] = acc * k;
        if (y - r >= 0) acc -= b[(y - r) * W + x];
        if (y + r + 1 < H) acc += b[(y + r + 1) * W + x];
      }
    }
    a = c;
  }
  return a;
}

/** The shadow-side factor (0 lit … 1 shadow) of the outward normal of a mask, per px. */
function sideOf(blur: Float32Array, W: number, H: number): Float32Array {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const gx = (x + 1 < W ? blur[i + 1] : 0) - (x > 0 ? blur[i - 1] : 0);
      const gy = (y + 1 < H ? blur[i + W] : 0) - (y > 0 ? blur[i - W] : 0);
      const l = Math.hypot(gx, gy);
      // Outward = down the coverage slope.
      const f = l > 1e-6 ? (-gx * SX - gy * SY) / l : 0;
      out[i] = smooth(-0.25, 0.75, f);
    }
  }
  return out;
}

/** Disc offsets (dx, dy, dist) up to r, nearest first. */
const discCache = new Map<number, Float32Array>();
function disc(r: number): Float32Array {
  let o = discCache.get(r);
  if (o) return o;
  const list: [number, number, number][] = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const q = Math.hypot(dx, dy);
    if (q > 0 && q <= r) list.push([dx, dy, q]);
  }
  list.sort((a, b) => a[2] - b[2]);
  o = Float32Array.from(list.flat());
  discCache.set(r, o);
  return o;
}

/**
 * Render the canvas as comic ink: a W × H buffer (the caller crops it to the frame).
 */
export function inkRender(c: HdCanvas, o: InkOpts): PixelBuffer {
  const { W, H } = c;
  const d = o.d;
  const n = W * H;
  const { mat, part, pz, nx, ny, nz, tone, fix } = c;
  const final = o.final ?? new Set<number>();
  const wt = WEIGHTS[d];
  const cut = o.cut ?? 0.52;
  const out = new PixelBuffer(W, H);
  const px = out.data;

  // 0. Masks.
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = mat[i] !== 0 ? 1 : 0;

  // 1. The ramp of every fixed-colour part (a vote of its colours).
  const partRamp = new Map<number, Ramp>();
  {
    const votes = new Map<number, Map<Ramp, number>>();
    for (let i = 0; i < n; i++) {
      if (!mask[i] || fix[i] === 0 || final.has(part[i])) continue;
      const list = rampsOfColor.get(fix[i] >>> 0);
      if (!list) continue;
      let m = votes.get(part[i]);
      if (!m) votes.set(part[i], (m = new Map()));
      for (const r of list) m.set(r, (m.get(r) ?? 0) + 1);
    }
    for (const [p, m] of votes) {
      let best: Ramp | null = null;
      let bn = 0;
      for (const [r, k] of m) if (k > bn) {
        bn = k;
        best = r;
      }
      if (best) partRamp.set(p, best);
    }
  }

  // 2. Cast shadows: march towards the light; a part nearer by more than the distance travelled
  //    (and not the same part) puts this px in its shadow.
  const cast = new Uint8Array(n);
  {
    const steps = Math.round(2.2 * d);
    const spot = o.spot ?? 0.9 * d;
    const kl = Math.hypot(KX, KY);
    const sx = KX / kl;
    const sy = KY / kl;
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (!mask[i] || final.has(part[i])) continue;
        const z0 = pz[i];
        const p = part[i];
        for (let k = 1; k <= steps; k++) {
          const XX = Math.round(X + sx * k);
          const YY = Math.round(Y + sy * k);
          if (XX < 0 || YY < 0 || XX >= W || YY >= H) break;
          const j = YY * W + XX;
          if (mask[j] && part[j] !== p && pz[j] - z0 > (k / d) * 0.7 + 0.6) {
            // Right under the occluder the shadow is a spot black (the inker fills it).
            cast[i] = k <= spot ? 2 : 1;
            break;
          }
        }
      }
    }
  }

  // 3. Fill: two tones, halftone in the shadow, highlights.
  // The dot grid: a 45° (quincunx) lattice of cell `sp` tied to the frame anchor, the dot centres
  // on art-px corners (2 × 2 dots, growing to rounded 4 × 4 in the deep shadow).
  const sp = d === 4 ? 6 : 4;
  const half = sp / 2;
  const dotAt = (X: number, Y: number): number => {
    const u = X + 0.5 - o.ax;
    const v = Y + 0.5 - o.ay;
    const u0 = Math.round(u / sp) * sp;
    const v0 = Math.round(v / sp) * sp;
    const u1 = Math.floor(u / sp) * sp + half;
    const v1 = Math.floor(v / sp) * sp + half;
    const a = (u - u0) * (u - u0) + (v - v0) * (v - v0);
    const b = (u - u1) * (u - u1) + (v - v1) * (v - v1);
    return a < b ? a : b;
  };
  /** Dot radius² by depth in the shadow (0 at the terminator … 1 deep). */
  const dotR2 = (s: number): number => (s < 0.1 ? -1 : d === 4 ? (s < 0.55 ? 0.5 : s < 0.85 ? 2.5 : 4.5) : s < 0.6 ? 0.5 : 2.5);
  /** Tweed: a sparse herringbone of short diagonal ticks (cells of `tw` art px, tied to the anchor). */
  const tw = d === 4 ? 6 : 4;
  const tweedAt = (X: number, Y: number): boolean => {
    const u = X - o.ax + 4096 * tw;
    const v = Y - o.ay + 4096 * tw;
    const cx = Math.floor(u / tw);
    const cy = Math.floor(v / tw);
    const lx = u - cx * tw;
    const ly = v - cy * tw - ((cx & 1) * tw) / 2;
    const ly2 = ((ly % tw) + tw) % tw;
    if (d === 2) return lx === 1 && ly2 === ((cx & 1) ? 1 : 2);
    // '/' in even columns, '\' in odd ones: a 2-px tick in the cell's middle.
    return (cx & 1) === 0 ? (lx === 2 && ly2 === 3) || (lx === 3 && ly2 === 2) : (lx === 2 && ly2 === 2) || (lx === 3 && ly2 === 3);
  };
  /** Far limbs (behind the body) sit in shadow as a whole: depth reads at a glance. */
  const FAR_Z = -7.5;
  // Form band: how far (logical px) the part reaches on towards the shadow side (down-right)
  // before its own edge (an empty px or a part behind it). A px near that edge turns into shadow:
  // the crescent of a comic form shadow, on top of the normals' terminator.
  const B = o.band ?? 2.2;
  const bandK = new Float32Array(n).fill(1);
  {
    const maxS = Math.ceil(6 * d);
    const edge = (i: number, X: number, Y: number, sx: number, sy: number): number => {
      const zb = pz[i] - 0.5;
      for (let k = 1; k <= maxS; k++) {
        const XX = Math.round(X + sx * k);
        const YY = Math.round(Y + sy * k);
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) return k - 1;
        const j = YY * W + XX;
        if (!mask[j] || (part[j] !== part[i] && pz[j] < zb)) return k - 1;
      }
      return maxS;
    };
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (!mask[i] || fix[i] !== 0) continue;
        const ds = edge(i, X, Y, SX, SY);
        if (ds >= B * d) continue;
        const dl = edge(i, X, Y, -SX, -SY);
        // A thin part (an arm, a leg) is shadowed on its lower-right ~40 %, a broad one on a band B wide.
        const lim = Math.min(B * d, 0.4 * (ds + dl + 1));
        if (ds < lim) bandK[i] = ds / lim;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const X = i % W;
    const Y = (i / W) | 0;
    const p = part[i];
    if (fix[i] !== 0) {
      const col = fix[i] >>> 0;
      if (final.has(p)) {
        px[i] = col;
        continue;
      }
      if (INK_SET.has(col)) {
        px[i] = INK;
        continue;
      }
      let r = partRamp.get(p);
      let k = r ? r.indexOf(col) : -1;
      if (k < 0) {
        const list = rampsOfColor.get(col);
        r = list?.[0];
        k = r ? r.indexOf(col) : -1;
      }
      if (!r || k < 0) {
        px[i] = col;
        continue;
      }
      const t = tonesOf(r);
      const far = pz[i] <= FAR_Z;
      // The art's deepest lines (a slide's seams, a finger's crease) become ink.
      if (k <= 1 && r.length >= 7 && r !== PAL_HD.black) {
        px[i] = INK;
        continue;
      }
      if (k >= r.length - 1 && r.length >= 6 && !far) px[i] = t.high;
      else if (k >= t.split && !cast[i] && !far) px[i] = t.light;
      else {
        px[i] = t.shadow;
        if (far && dotAt(X, Y) <= dotR2(0.5)) px[i] = t.dot;
      }
      continue;
    }
    const M = c.getMaterial(mat[i]);
    if (M.ramp.length <= 2) {
      px[i] = INK;
      continue;
    }
    const t = tonesOf(M.ramp, M.lo, M.hi);
    const k = nx[i] * KX + ny[i] * KY + nz[i] * KZ;
    const tn = tone[i];
    // Small tone (texture) does not move the terminator; folds and crevices do.
    const tf = tn < -0.24 ? tn * 1.1 : tn > 0.12 ? tn * 0.5 : 0;
    let L = k + tf;
    if (bandK[i] < 1) L = Math.min(L, cut - 0.02 - (1 - bandK[i]) * 0.7);
    if (cast[i]) L = Math.min(L, cut - 0.2);
    if (pz[i] <= FAR_Z) L = Math.min(L, cut - 0.3);
    if (L >= cut) {
      px[i] = t.light;
      const s = M.spec ?? 0;
      if (s > 0.3 && specular(nx[i], ny[i], nz[i], (M.shine ?? 24) * 1.2) * s > 0.36) px[i] = t.high;
      else if (o.tweed !== undefined && M.ramp[0] === o.tweed && tweedAt(X, Y)) px[i] = t.shadow;
    } else {
      const deep = Math.max(0, Math.min(1, (cut - L) / 0.6));
      px[i] = t.shadow;
      if (dotAt(X, Y) <= dotR2(deep)) px[i] = t.dot;
    }
  }

  // 4. Ink: seams, interior lines between parts, the silhouette (the folds: comic-folds.ts).
  const ink = new Uint8Array(n);
  // 4a. Seams: where the material changes inside one part (a boot's sole, a lapel's edge, the
  //     belt), one ink px on the near side of the change (its right / lower neighbour).
  for (let Y = 0; Y < H - 1; Y++) {
    for (let X = 0; X < W - 1; X++) {
      const i = Y * W + X;
      if (!mask[i] || fix[i] !== 0) continue;
      const m = mat[i];
      const p = part[i];
      const r = i + 1;
      const b = i + W;
      if ((mask[r] && fix[r] === 0 && part[r] === p && mat[r] !== m) || (mask[b] && fix[b] === 0 && part[b] === p && mat[b] !== m)) ink[i] = 1;
    }
  }
  // 4b. Interior lines: the near part's weighted line drawn onto the part behind it.
  {
    const R = Math.max(wt.sepLit, wt.sepShadow);
    const off = disc(R);
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (!mask[i]) continue;
        const p = part[i];
        const z0 = pz[i] + 0.5;
        for (let q = 0; q < off.length; q += 3) {
          const XX = X + off[q];
          const YY = Y + off[q + 1];
          if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
          const j = YY * W + XX;
          if (!mask[j] || part[j] === p || pz[j] <= z0) continue;
          // This px lies (−dx, −dy) from the nearer part: its shadow side when that points down-right.
          const dist = off[q + 2];
          const f = (-off[q] * SX - off[q + 1] * SY) / dist;
          const w = wt.sepLit + (wt.sepShadow - wt.sepLit) * smooth(-0.25, 0.75, f);
          if (dist <= w) {
            ink[i] = 1;
            break;
          }
        }
      }
    }
  }
  // 4c. The silhouette: a signed distance, thin on the lit side, heavy on the shadow side.
  const inv = new Uint8Array(n);
  for (let i = 0; i < n; i++) inv[i] = mask[i] ? 0 : 1;
  const dOut = edt(mask, W, H); // outside px: distance² to the figure
  const dIn = edt(inv, W, H); // inside px: distance² to the outside
  const side = sideOf(blurMask(mask, W, H, Math.max(1, d)), W, H);
  for (let i = 0; i < n; i++) {
    const s = side[i];
    if (mask[i]) {
      const w = wt.inLit + (wt.inShadow - wt.inLit) * s;
      if (w > 0 && dIn[i] <= w * w) ink[i] = 1;
    } else {
      const w = wt.outLit + (wt.outShadow - wt.outLit) * s;
      if (dOut[i] <= w * w) ink[i] = 2;
    }
  }
  for (let i = 0; i < n; i++) if (ink[i] || cast[i] === 2) px[i] = INK;
  // 4d. The Helium Head's rim: the outer ink within reach of the head turns to the status colour.
  if (o.rim) {
    const head = new Uint8Array(n);
    for (let i = 0; i < n; i++) head[i] = mask[i] && part[i] === o.rim.part ? 1 : 0;
    const dh = edt(head, W, H);
    const r = wt.outShadow + 0.5;
    for (let i = 0; i < n; i++) if (ink[i] === 2 && dh[i] <= r * r) px[i] = o.rim.color;
  }
  out.touch();
  return out;
}
