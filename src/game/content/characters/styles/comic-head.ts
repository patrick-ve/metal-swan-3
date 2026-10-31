/**
 * COMIC INK (comic.ts): VINCENT's head as a comic face, drawn over the rig's own HD head (the same
 * silhouette, hair locks, ear and features for every expression) and painted again in ink:
 * - skin in two flat tones (the face lit from the upper left, the back of the jaw and the neck in
 *   shadow, a hard shadow under the fringe), hair as one light and one shadow shape (normals
 *   averaged over the locks) with an ink strand line along each lock's lower edge;
 * - every face feature in ink: the raised brow as a bold stroke, the eye a black iris with a white
 *   catchlight, the smirk, the ear's inner curl;
 * - the heavy stubble as short ink hatching in staggered rows on a darker skin zone (round the
 *   rig's stubble flecks), dense on the jaw and chin, thinning out towards the cheekbone.
 * The head has no outline of its own: the body pass draws the figure's weighted silhouette.
 *
 * `comicHead(style, expr, d, glint)` returns HEAD_W·d × HEAD_H·d at d 2, 4 or 8 (8: the Helium
 * Head at 4×), cached. It reads the rig's head canvas by asking `renderHeadHd` for a cache-missing
 * copy (a hat offset without a hat: the same head, a new cache key) under a short-lived `render`
 * hook, as comic-capture.ts does for the body.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import { HdCanvas } from '../../../art/hd/canvas';
import { HD_EYE, HD_MOUTH, renderHeadHd } from '../../../art/hd/head';
import { KEY, specular } from '../../../art/hd/light';
import type { HumanStyle } from '../../../art/humanoid';
import type { Expression, HeadStyle } from '../../../art/humanoid-head';
import { hash2, R } from '../../../art/paint';
import { INK, edt } from './comic-ink';

const SKIN = PAL_HD.skinA;
const HAIR = PAL_HD.hairB;
const WHITE: Color = PAL_HD.snow[6];
const RED = PAL_HD.red;

/** Skin: light and shadow; the stubble zone a step darker (light, shadow) under its hatching. */
const SK_LIGHT = SKIN[5];
const SK_SHADOW = SKIN[3];
const STUB_LIGHT = SKIN[4];
const STUB_SHADOW = SKIN[3];
const HR_LIGHT = HAIR[3];
const HR_SHADOW = HAIR[2];
const HR_HIGH = HAIR[4];

/** The head style the rig gives this figure (hd/body.ts headStyleOf: the style's resolved ramps). */
function headStyle(s: HumanStyle): HeadStyle {
  return {
    skin: R(s.skin),
    hair: R(s.hair),
    hairStyle: s.hairStyle,
    headgear: s.headgear,
    gear: R(s.gear ?? 'olive'),
    accent: R(s.accent ?? 'red'),
    extras: s.face ?? [],
  };
}

let bust = 0;

/** The rig's head canvas (its G-buffer) for an expression; a fresh paint every call. */
function headCanvas(hs: HeadStyle, expr: Expression, d: 2 | 4 | 8, glint: boolean): HdCanvas | null {
  const proto = HdCanvas.prototype as unknown as { render: HdCanvas['render'] };
  const prev = proto.render;
  let last: HdCanvas | null = null;
  proto.render = function (this: HdCanvas, o) {
    last = this;
    return prev.call(this, o);
  };
  try {
    // hatDy moves only a hat; without headgear it changes the cache key, not the head: so the rig
    // paints the head again (and we see its canvas) instead of returning a cached copy.
    bust = (bust % 997) + 1;
    renderHeadHd({ ...hs, hatDy: bust * 1e-6 }, expr, d as 2 | 4, glint ? undefined : { glint: false });
  } finally {
    proto.render = prev;
  }
  return last;
}

const luma = (c: Color): number => {
  const r = (c >>> 24) & 255;
  const g = (c >>> 16) & 255;
  const b = (c >>> 8) & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const caches = new WeakMap<HumanStyle, Map<string, PixelBuffer>>();

/**
 * The comic head of a figure (HEAD_W·d × HEAD_H·d, no outline), cached per style, expression,
 * density and glint. The tones are tuned for VINCENT (fair skin, brown hair, heavy stubble).
 */
export function comicHead(style: HumanStyle, expr: Expression, d: 2 | 4 | 8, glint = true): PixelBuffer {
  let cache = caches.get(style);
  if (!cache) caches.set(style, (cache = new Map()));
  const key = `${expr}|${d}|${glint ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit.clone();
  const hs = headStyle(style);
  const c = headCanvas(hs, expr, d, glint);
  const out = c ? paint(c, expr, d) : renderHeadHd(hs, expr, d as 2 | 4, glint ? undefined : { glint: false });
  cache.set(key, out);
  return out.clone();
}

function paint(c: HdCanvas, expr: Expression, d: number): PixelBuffer {
  const { W, H, mat, part, pz, nx, ny, nz, tone, fix } = c;
  const n = W * H;
  const out = new PixelBuffer(W, H);
  const px = out.data;
  const ink = new Uint8Array(n);
  // Materials by ramp: hair, skin (spec > 0: face and ear; spec 0: the stubble zone), stubble flecks (stone).
  const kind = new Uint8Array(n); // 0 empty, 1 skin, 2 hair, 3 stubble zone, 4 fixed
  for (let i = 0; i < n; i++) {
    if (mat[i] === 0) continue;
    if (fix[i] !== 0) {
      kind[i] = 4;
      continue;
    }
    const M = c.getMaterial(mat[i]);
    if (M.ramp[0] === PAL_HD.stone[0]) kind[i] = 3;
    else if (M.ramp.length <= 6) kind[i] = 2;
    else kind[i] = 1;
  }
  // The stubble zone: the skin round the rig's stubble flecks (closed over a short reach).
  {
    const fl = new Uint8Array(n);
    for (let i = 0; i < n; i++) fl[i] = kind[i] === 3 ? 1 : 0;
    const dist = edt(fl, W, H);
    const r = 1.1 * d;
    for (let i = 0; i < n; i++) if (kind[i] === 1 && dist[i] <= r * r) kind[i] = 3;
  }
  const s = d / 4; // weights are tuned at 4×
  // The hair part: the part id of most hair px.
  let hairPart = -1;
  {
    const cnt = new Map<number, number>();
    for (let i = 0; i < n; i++) if (kind[i] === 2) cnt.set(part[i], (cnt.get(part[i]) ?? 0) + 1);
    let best = 0;
    for (const [p, k] of cnt) if (k > best) {
      best = k;
      hairPart = p;
    }
  }
  // The brow's room: the skin over the eye keeps clear of the fringe's shadow and line, so the
  // raised brow reads as its own stroke.
  const [bx, by] = HD_EYE;
  const browRoom = (i: number): boolean => {
    const lx = ((i % W) + 0.5) / d;
    const ly = (((i / W) | 0) + 0.5) / d;
    return lx > bx - 2.2 && lx < bx + 3.2 && ly > by - 5.2 && ly < by - 1.0;
  };
  // Fringe shadow: a skin px with hair within a short step up-left (towards the light).
  const shade = new Uint8Array(n);
  {
    const steps = Math.round(1.6 * d);
    const kl = Math.hypot(KEY[0], KEY[1]);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (kind[i] !== 1 && kind[i] !== 3) continue;
      for (let k = 1; k <= steps; k++) {
        const XX = Math.round(X + (KEY[0] / kl) * k * 0.6);
        const YY = Math.round(Y + (KEY[1] / kl) * k);
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) break;
        const j = YY * W + XX;
        if (kind[j] === 2 && part[j] === hairPart && pz[j] > pz[i] - 0.01) {
          shade[i] = 1;
          break;
        }
      }
    }
  }
  const KX = KEY[0];
  const KY = KEY[1];
  const KZ = KEY[2];
  // Light per px from the normals smoothed within skin / within hair (clean shadow shapes).
  const light = new Float32Array(n);
  {
    const R1 = Math.max(1, Math.round(0.9 * d));
    const R2 = Math.max(1, Math.round(1.7 * d));
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      const k = kind[i];
      if (!k || k === 4) continue;
      const g = k === 2 ? 2 : 1;
      // Hair: one big light shape and one shadow shape (a wide average over the locks).
      const R = g === 2 ? R2 : R1;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (let dy = -R; dy <= R; dy++) {
        const YY = Y + dy;
        if (YY < 0 || YY >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const XX = X + dx;
          if (XX < 0 || XX >= W) continue;
          const j = YY * W + XX;
          const kj = kind[j];
          if (!kj || kj === 4 || (kj === 2 ? 2 : 1) !== g) continue;
          sx += nx[j];
          sy += ny[j];
          sz += nz[j];
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      light[i] = (sx * KX + sy * KY + sz * KZ) / l;
    }
  }
  const [eyeX, eyeY] = HD_EYE;
  // The neck starts a little under the mouth; its dot grid matches the body's cell (6 art px at 4×).
  const neckY = HD_MOUTH[1] + 1.6;
  const cell = d >= 8 ? 12 : d >= 4 ? 6 : 4;
  const dotHead = (X: number, Y: number): boolean => {
    const u = X + 0.5;
    const v = Y + 0.5;
    const h = cell / 2;
    const a = (u - Math.round(u / cell) * cell) ** 2 + (v - Math.round(v / cell) * cell) ** 2;
    const b = (u - Math.floor(u / cell) * cell - h) ** 2 + (v - Math.floor(v / cell) * cell - h) ** 2;
    return Math.min(a, b) <= (d >= 8 ? 2.5 : 0.5);
  };
  const open = expr === 'shout' || expr === 'panic' || expr === 'yawn' || expr === 'hurt' || expr === 'chew';
  for (let i = 0; i < n; i++) {
    const k = kind[i];
    if (!k) continue;
    if (k === 4) {
      const col = fix[i] >>> 0;
      const l = luma(col);
      const ri = RED.indexOf(col);
      const fx = ((i % W) + 0.5) / d;
      const fy = (((i / W) | 0) + 0.5) / d;
      const nearEye = Math.hypot(fx - eyeX, fy - eyeY) < 2.6;
      if (ri >= 0) px[i] = ri >= 5 ? RED[6] : ri >= 3 ? RED[4] : RED[2];
      else if (l > 0.78 && (nearEye || open)) px[i] = WHITE;
      else if (l > 0.55) px[i] = SK_LIGHT;
      else {
        px[i] = INK;
        ink[i] = 1;
      }
      continue;
    }
    const L = light[i] + (tone[i] < -0.2 ? tone[i] * 0.6 : 0);
    if (k === 2) {
      const M = c.getMaterial(mat[i]);
      const sp = specular(nx[i], ny[i], nz[i], 14) * (M.spec ?? 0.3);
      const Lh = light[i] + (tone[i] < -0.2 ? -0.5 : 0);
      px[i] = Lh >= 0.45 ? (sp > 0.2 && Lh > 0.72 ? HR_HIGH : HR_LIGHT) : HR_SHADOW;
      // A lock's lower-right edge against the groove below it: one ink px (the strand line).
      const X = i % W;
      const Y = (i / W) | 0;
      const groove = (j: number): boolean => kind[j] === 2 && tone[j] < -0.22;
      const edge = tone[i] > -0.12 && ((X < W - 1 && groove(i + 1)) || (Y < H - 1 && groove(i + W)));
      if (edge || tone[i] < -0.45) {
        px[i] = INK;
        ink[i] = 1;
      }
      continue;
    }
    const lit = L >= 0.3 && (!shade[i] || browRoom(i));
    if (k === 3) px[i] = lit ? STUB_LIGHT : STUB_SHADOW;
    else px[i] = lit ? SK_LIGHT : SK_SHADOW;
    // Halftone on the neck's shadow (under the jaw), never on the face.
    if (k === 1 && !lit && (((i / W) | 0) + 0.5) / d > neckY && dotHead(i % W, (i / W) | 0)) px[i] = SKIN[2];
    // The ear's curl and other deep creases of the skin: the valley line of the crease.
    if (tone[i] < -0.42) {
      const X = i % W;
      const Y = (i / W) | 0;
      const t0 = tone[i];
      const vx = X > 0 && X < W - 1 && tone[i - 1] > t0 - 1e-6 && tone[i + 1] > t0 - 1e-6;
      const vy = Y > 0 && Y < H - 1 && tone[i - W] > t0 - 1e-6 && tone[i + W] > t0 - 1e-6;
      if (d >= 4 ? true : t0 < -0.6 && (vx || vy)) {
        px[i] = INK;
        ink[i] = 1;
      } else px[i] = SK_SHADOW;
    }
  }
  // The hair's edge on the face: a thin line (heavier at the bottom of the fringe).
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const i = Y * W + X;
    if (kind[i] !== 1 && kind[i] !== 3) continue;
    const r = Math.max(1, Math.round(0.8 * s));
    let hit = false;
    for (let dy = -r; dy <= 0 && !hit; dy++) for (let dx = -r; dx <= r && !hit; dx++) {
      const XX = X + dx;
      const YY = Y + dy;
      if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
      const j = YY * W + XX;
      if (kind[j] === 2 && Math.hypot(dx, dy) <= r) hit = true;
    }
    if (hit && !browRoom(i)) {
      px[i] = INK;
      ink[i] = 1;
    }
  }
  // Stubble: short ink hatch strokes in staggered rows over the stubble zone (a regular hatch, a
  // little jitter), none at the corner of the mouth so the smirk reads.
  const [mx, my] = HD_MOUTH;
  // Depth into the zone from the clean cheek: the stubble thins out towards the cheekbone.
  const cheek = new Uint8Array(n);
  for (let i = 0; i < n; i++) cheek[i] = kind[i] === 1 ? 1 : 0;
  const dCheek = edt(cheek, W, H);
  const sx = d >= 8 ? 4 : 2;
  const sy = d >= 8 ? 5 : d >= 4 ? 3 : 2;
  const len = d >= 8 ? 3 : d >= 4 ? 2 : 1;
  for (let row = 0; row * sy < H; row++) {
    for (let col = 0; col * sx < W; col++) {
      const x0 = col * sx + (row & 1 ? sx >> 1 : 0) + (hash2(col, row, 11) < 0.35 ? 1 : 0);
      const y0 = row * sy + (hash2(col, row, 23) < 0.3 ? 1 : 0);
      if (x0 >= W || y0 >= H) continue;
      const i0 = y0 * W + x0;
      if (kind[i0] !== 3) continue;
      const lx = (x0 + 0.5) / d;
      const ly = (y0 + 0.5) / d;
      if (Math.abs(lx - mx) < 1.4 && Math.abs(ly - my) < 0.8) continue;
      const deep = Math.min(1, Math.sqrt(dCheek[i0]) / (1.6 * d));
      if (hash2(col, row, 41) < (d >= 4 ? 0.12 : 0.15) + (1 - deep) * 0.5) continue;
      for (let k = 0; k < len; k++) {
        const XX = x0 + (k >= len - 1 && len > 2 ? 1 : 0);
        const YY = y0 + k;
        if (XX >= W || YY >= H) continue;
        const j = YY * W + XX;
        if (kind[j] !== 3) continue;
        px[j] = INK;
        ink[j] = 1;
      }
    }
  }
  // The brow: one bold stroke. Thicken the rig's brow ink (fixed px above the eye) one step down.
  const [ex, ey] = HD_EYE;
  const thick = Math.max(1, Math.round(1 * s));
  const add: number[] = [];
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const i = Y * W + X;
    if (!ink[i] || kind[i] !== 4) continue;
    const lx = (X + 0.5) / d;
    const ly = (Y + 0.5) / d;
    if (ly > ey - 1.6 || ly < ey - 5 || Math.abs(lx - ex) > 3.2) continue;
    for (let k = 1; k <= thick; k++) {
      const YY = Y + k;
      if (YY < H && kind[YY * W + X]) add.push(YY * W + X);
    }
  }
  for (const i of add) {
    px[i] = INK;
    ink[i] = 1;
  }
  void expr;
  out.touch();
  return out;
}
