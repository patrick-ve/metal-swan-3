/**
 * The town's sky and far parallax layers (TOWN, wave A; docs/design/oldenzaal.md §10.1): one
 * density-generic drawer per background generator (art-kit.ts `regBg`; 1×, 2× and 4× from the same
 * shapes), every layer tiling seamlessly in x, painted without ink.
 *
 * - `oz-sky` — the sky (params `light`: `dusk` | `late` | `night`). Dusk: a deep violet zenith over a
 *   purple-red band down to the glow of a low red-orange sun (`sunX`, `sunY` fractions) sinking
 *   behind the roofs, long thin clouds dark above and lit from below near the sun. Late dusk: the
 *   sun gone, a dull red glow low on the horizon, colder clouds and the first stars. Night: a cold
 *   desaturated blue-black, a full moon (`moonX`, `moonY`) with a halo and dark maria, stars,
 *   moonlit cloud rims.
 * - `oz-far` — the far town (params `y` base fraction 0.66, `light`, `air` 0.55): a hazy roofline of
 *   gables, roofs, trees and two small spires, a few warm windows.
 * - `oz-roofs` — the near roofs over the street (params `y` base fraction 0.6, `light`, `air` 0.25):
 *   dark backlit houses of two to four storeys with gable ends, eaves roofs, stepped gables and
 *   flat parapets, chimneys, dormers, aerials, dark windows with a rare warm one, the sun-side rim
 *   on the ridges.
 */
import type { Color } from '../../../../engine/color';
import { noise2x } from '../../../art/paint';
import { dq, F, h2, ladder, num, ozLight, pick, regBg, snap, T, tones, type Dn, type OzLight } from './art-kit';

/** The sky ladder (zenith → horizon) of a mood. */
function skyStops(light: OzLight, d: Dn): Color[] {
  const n = (k: number): Color => T('night', k, 2);
  const u = (k: number): Color => T('dusk', k, 2);
  void d;
  if (light === 'night') return [n(0), n(1), n(2), n(3)];
  if (light === 'late') return [n(0), n(1), u(1), u(2), u(3), u(4)];
  return [n(1), u(1), u(2), u(3), u(4), u(5), u(6)];
}

/** The horizon colour (the far layers' haze) of a mood. */
export function horizon(light: OzLight): Color {
  return light === 'night' ? T('night', 3, 2) : light === 'late' ? T('dusk', 3, 2) : T('dusk', 5, 2);
}

/** a − b wrapped into (−w/2, w/2]. */
function wrapSigned(v: number, w: number): number {
  let r = v % w;
  if (r > w / 2) r -= w;
  else if (r <= -w / 2) r += w;
  return r;
}

function wrapDx(a: number, b: number, w: number): number {
  const dx = Math.abs(a - b) % w;
  return Math.min(dx, w - dx);
}

regBg('oz-sky', (p, params, seed) => {
  const d = p.d;
  const light = ozLight(params);
  const w = p.w;
  const h = p.h;
  const lad = ladder(skyStops(light, d), d === 1 ? 2 : 5, d);
  const top = lad.length - 1;
  const hz = num(params, 'horizon', 0.8) * h;
  const sun = light === 'dusk';
  const sx = num(params, 'sunX', 0.72) * w;
  const sy = num(params, 'sunY', 0.7) * h;
  const sr = num(params, 'sunR', 11);
  const moon = light === 'night';
  const mx0 = num(params, 'moonX', 0.28) * w;
  const my0 = num(params, 'moonY', 0.2) * h;
  const mr = num(params, 'moonR', 10);
  const glowX = light === 'late' ? num(params, 'sunX', 0.72) * w : sx;
  const cloudRim = light === 'night' ? T('night', 5, d) : light === 'late' ? T('dusk', 3, d) : T('dusk', 6, d);
  const cloudHot = light === 'dusk' ? T('candle', 4, d) : cloudRim;
  // Long cloud bars (the evening's stratus): a flat underside, a lumpy top, tapering ends.
  const nCloud = light === 'night' ? 7 : 9;
  const bars: Array<readonly [number, number, number, number, number]> = [];
  for (let i = 0; i < nCloud; i++) {
    bars.push([h2(i, 1, seed) * w, (0.06 + h2(i, 2, seed) * 0.36) * h, 60 + h2(i, 3, seed) * 150, 3 + h2(i, 4, seed) * 6, i]);
  }
  const cloud = (x: number, y: number): boolean => {
    for (const [cx, cy, len, th, i] of bars) {
      const dx = wrapSigned(x - cx, w);
      const u = (2 * dx) / len;
      if (u <= -1 || u >= 1 || y > cy + th * (0.12 + 0.3 * Math.abs(Math.sin(dx * 0.07 + i * 2.3)))) continue;
      const lump = 0.35 + 0.65 * Math.abs(Math.sin(dx * 0.09 + i * 1.7)) * (0.6 + 0.4 * Math.cos(dx * 0.031 + i));
      if (y > cy - th * Math.sqrt(1 - u * u) * lump) return true;
    }
    return false;
  };
  for (let Y = 0; Y < p.H; Y++) {
    const y = (Y + 0.5) / d;
    const base = Math.min(1, y / hz) * top;
    for (let X = 0; X < p.W; X++) {
      const x = (X + 0.5) / d;
      let v = base;
      // The glow round the sun (dusk) or the red afterglow low on the horizon (late), the moon's halo.
      if (sun || light === 'late') {
        const dx = wrapDx(x, glowX, w);
        const dy = y - (sun ? sy : h * 0.86);
        const r = Math.sqrt(dx * dx * (sun ? 1 : 0.25) + dy * dy * 1.6);
        const reach = sun ? sr * 7 : 120;
        if (r < reach) v += (1 - r / reach) * (sun ? 3.2 : 1.6);
      } else if (moon) {
        const dx = wrapDx(x, mx0, w);
        const r = Math.sqrt(dx * dx + (y - my0) * (y - my0));
        if (r < mr * 4) v += (1 - r / (mr * 4)) * 1.4;
      }
      let c = pick(lad, dq(v, X, Y, 1));
      if (cloud(x, y)) {
        const lit = !cloud(x, y + Math.max(0.5, 1 / d) + 0.01);
        const near = sun ? Math.max(0, 1 - wrapDx(x, sx, w) / 110) : moon ? Math.max(0, 1 - wrapDx(x, mx0, w) / 90) : 0.3;
        // Lit undersides toward the sun (moon), dark violet bodies with a lighter top.
        if (lit && near > (d >= 2 ? 0.08 : 0.35)) c = near > 0.5 ? cloudHot : cloudRim;
        else c = pick(lad, dq(v - 2.4 + (cloud(x, y - 1.2) ? 0 : 0.8), X, Y, 0.5));
      }
      p.dot(X, Y, c);
    }
  }
  // Stars (late dusk: a few; night: more), on the logical grid so every density shows the same.
  if (light !== 'dusk') {
    const cut = light === 'night' ? 0.9965 : 0.9985;
    for (let y = 0; y < h * 0.58; y++) {
      for (let x = 0; x < w; x++) {
        const k = h2(x, y, seed + 21);
        if (k < cut || cloud(x + 0.5, y + 0.5)) continue;
        const bright = k > 0.9993;
        const c = bright ? T('snow', 6, d) : light === 'night' ? T('snow', 3, d) : T('night', 6, d);
        if (d === 1) p.rect(x, y, 1, 1, c);
        else {
          const cx = x * d + (d >> 1);
          const cy = y * d + (d >> 1);
          p.dot(cx, cy, c);
          if (bright && d >= 4) {
            const dimC = T('snow', 2, d);
            p.dot(cx - 1, cy, dimC);
            p.dot(cx + 1, cy, dimC);
            p.dot(cx, cy - 1, dimC);
            p.dot(cx, cy + 1, dimC);
          }
        }
      }
    }
  }
  // The sun: a red-orange disc low over the roofs (the roofs hide its lower half).
  if (sun) {
    p.disc(sx, sy, sr, sr * 0.92, (_X, _Y, u, v) => {
      const r = u * u + v * v;
      if (r > 0.82) return T('dusk', 7, d);
      return v < -0.2 && r < 0.4 ? T('candle', 6, d) : T('candle', 5, d);
    });
    // Thin cloud bars across the sun.
    for (const [oy, ow] of [[-0.15, 1.3], [0.35, 1.5]] as const) p.rect(sx - sr * ow, sy + sr * oy, sr * ow * 2, Math.max(1, 0.9), T('dusk', 4, d));
  }
  // The full moon: pale, dark maria, a lit limb.
  if (moon) {
    const pale = T('snow', 5, d);
    const mid = T('snow', 3, d);
    const mare = T('snow', 2, d);
    p.disc(mx0, my0, mr, mr, (_X, _Y, u, v) => {
      const r = u * u + v * v;
      const m = noise2x(u * 4 + 9, v * 4 + 9, 1.6, 4096, seed + 9);
      if (r > 0.86) return mid;
      if (m > 0.7 && r < 0.7) return mare;
      if (m > 0.6 && r < 0.75) return mid;
      return u + v < -0.3 ? snap(T('snow', 6, d), d) : pale;
    });
  }
});

/** A building silhouette's outline: [x0, w, roof kind, wall top, roof top] in logical px. */
type Kind = 'gable' | 'eaves' | 'flat' | 'step' | 'tree' | 'spire';

function kindOf(h: number, trees: boolean): Kind {
  if (trees && h < 0.12) return 'tree';
  if (h < 0.42) return 'gable';
  if (h < 0.7) return 'eaves';
  if (h < 0.84) return 'step';
  if (h < 0.97) return 'flat';
  return 'spire';
}

/** The outline polygon of a house with a roof of `kind` (x0, wall top y, width, base y, roof rise). */
function housePoly(kind: Kind, x0: number, w: number, top: number, base: number, rise: number): Array<[number, number]> {
  if (kind === 'gable') return [[x0, base], [x0, top], [x0 + w / 2, top - rise], [x0 + w, top], [x0 + w, base]];
  if (kind === 'eaves')
    return [[x0, base], [x0, top], [x0 + rise * 0.6, top - rise * 0.8], [x0 + w - rise * 0.6, top - rise * 0.8], [x0 + w, top], [x0 + w, base]];
  if (kind === 'step') {
    const pts: Array<[number, number]> = [[x0, base], [x0, top]];
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const sx = x0 + ((i + 1) * w) / (steps * 2 + 1);
      pts.push([sx - 0.0001, top - (i * rise) / steps], [sx, top - ((i + 1) * rise) / steps]);
    }
    for (let i = steps - 1; i >= 0; i--) {
      const sx = x0 + w - ((i + 1) * w) / (steps * 2 + 1);
      pts.push([sx, top - ((i + 1) * rise) / steps], [sx + 0.0001, top - (i * rise) / steps]);
    }
    pts.push([x0 + w, top], [x0 + w, base]);
    return pts;
  }
  if (kind === 'spire') return [[x0, base], [x0, top], [x0 + w * 0.3, top], [x0 + w * 0.5, top - rise * 3], [x0 + w * 0.7, top], [x0 + w, top], [x0 + w, base]];
  return [[x0, base], [x0, top - 2], [x0 + w, top - 2], [x0 + w, base]];
}

regBg('oz-far', (p, params, seed) => {
  const d = p.d;
  const light = ozLight(params);
  const air = num(params, 'air', 0.55);
  const base = num(params, 'y', 0.66) * p.h;
  const hz = horizon(light);
  const sil = tones('dusk', d, hz, air);
  const nsil = tones('night', d, hz, air);
  const body = (k: number): Color => (light === 'night' ? pick(nsil, k + 1) : pick(sil, k));
  const rim = light === 'night' ? pick(nsil, 4) : pick(sil, light === 'late' ? 2.6 : 3.4);
  const win = light === 'night' ? T('candle', 3, d) : tones('candle', d, hz, 0.3)[4];
  let x = -4;
  let i = 0;
  while (x < p.w) {
    const hh = h2(i, 1, seed);
    const kind = kindOf(hh, true);
    const w = kind === 'tree' ? 10 + Math.floor(h2(i, 2, seed) * 10) : kind === 'spire' ? 8 : 12 + Math.floor(h2(i, 2, seed) * 22);
    const top = base - 4 - Math.floor(h2(i, 3, seed) * 14);
    const rise = kind === 'flat' ? 0 : 4 + Math.floor(h2(i, 4, seed) * 7);
    const k = 1 + h2(i, 5, seed) * 0.8;
    if (kind === 'tree') {
      const r = w / 2;
      p.disc(x + r, top - r * 0.2, r, r * 0.9, (X, Y) => body(dq(k - 0.3, X, Y, 0.8)));
      p.rect(x + r - 1, top, 2, p.h - top, body(k));
    } else {
      p.poly(housePoly(kind, x, w, top, p.h, rise), (X, Y) => body(dq(k, X, Y, 0.6)));
      if (d >= 2) {
        // The rim of the low sky light on the roof edges.
        const pts = housePoly(kind, x, w, top, p.h, rise);
        for (let j = 1; j + 1 < pts.length - 1; j++) p.line(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], rim);
      }
      // A few warm windows.
      for (let wy = top + 2; wy < base + 6; wy += 4) {
        for (let wx = x + 2; wx < x + w - 2; wx += 4) {
          if (h2(Math.floor(wx), Math.floor(wy), seed + 13) > 0.94) p.rect(wx, wy, 1, 1, win);
        }
      }
    }
    x += w - (kind === 'tree' ? 3 : 0);
    i++;
  }
  // Below the roofline the far town is one haze-dark mass.
  p.rect(0, base + 8, p.w, p.h - base - 8, body(1));
});

regBg('oz-roofs', (p, params, seed) => {
  const d = p.d;
  const light = ozLight(params);
  const air = num(params, 'air', 0.25);
  const base = num(params, 'y', 0.6) * p.h;
  const hz = horizon(light);
  const wall = tones('brickDark', d, hz, air);
  const roof = tones('slate', d, hz, air * 0.8);
  const glass = tones('night', d, hz, air * 0.5);
  const warm = tones('candle', d, hz, air * 0.4);
  const rim = light === 'night' ? T('night', 5, d) : light === 'late' ? T('dusk', 4, d) : T('dusk', 6, d);
  const rimDim = light === 'night' ? T('night', 4, d) : T('dusk', light === 'late' ? 3 : 5, d);
  let x = -6;
  let i = 0;
  while (x < p.w) {
    const kind = kindOf(h2(i, 1, seed) * 0.97, false);
    const storeys = 2 + Math.floor(h2(i, 2, seed) * 2.6);
    const w = 26 + Math.floor(h2(i, 3, seed) * 26);
    const top = base - storeys * 9 + Math.floor(h2(i, 4, seed) * 5);
    const rise = kind === 'gable' ? Math.round(w * 0.5) : kind === 'step' ? Math.round(w * 0.45) : kind === 'eaves' ? 9 + Math.floor(h2(i, 5, seed) * 5) : 0;
    const k = 0.9 + h2(i, 6, seed) * 1.1;
    const poly = housePoly(kind, x, w, top, p.h, rise);
    // The wall (brick, in shadow: the sun is behind the houses).
    p.poly(poly, (X, Y) => {
      let kk = k - (Y / d - top) / 90;
      if (d >= 2 && Y % (3 * d) === 0) kk -= 0.5;
      return pick(wall, dq(kk, X, Y, 0.7));
    });
    // An eaves roof: a slate slab over the wall top, with a chimney or a dormer.
    if (kind === 'eaves') {
      p.poly(
        [
          [x, top],
          [x + rise * 0.6, top - rise * 0.8],
          [x + w - rise * 0.6, top - rise * 0.8],
          [x + w, top],
        ],
        (X, Y) => pick(roof, dq(1.6 + (d >= 2 && Y % (2 * d) === 0 ? -0.6 : 0), X, Y, 0.6)),
      );
      if (h2(i, 7, seed) > 0.4) {
        const dx = x + w * (0.3 + h2(i, 8, seed) * 0.3);
        p.rect(dx, top - rise * 0.8 + 2, 7, rise * 0.8 - 2, pick(roof, 1));
        p.poly(
          [
            [dx - 1, top - rise * 0.8 + 2],
            [dx + 3.5, top - rise * 0.8 - 2],
            [dx + 8, top - rise * 0.8 + 2],
          ],
          pick(roof, 2.2),
        );
        p.rect(dx + 2, top - rise * 0.8 + 3, 3, 3, h2(i, 9, seed) > 0.7 ? pick(warm, 4) : pick(glass, 1));
      }
    }
    if (kind === 'gable' && d >= 2) {
      // The gable's coping (a lighter verge).
      p.line(x, top, x + w / 2, top - rise, pick(wall, 3.2));
      p.line(x + w / 2, top - rise, x + w, top, pick(wall, 0.6));
    }
    // Chimneys.
    if (kind !== 'spire' && h2(i, 10, seed) > 0.35) {
      const cx = x + w * (0.15 + h2(i, 11, seed) * 0.6);
      const cyTop = top - (kind === 'gable' ? rise * 0.7 : kind === 'eaves' ? rise * 0.8 + 6 : 6);
      p.rect(cx, cyTop, 4, top - cyTop + 2, pick(wall, 1.2));
      p.rect(cx - 0.5, cyTop, 5, 1, pick(wall, 2.6));
      if (d >= 2) p.rect(cx + 3.5, cyTop, 0.5, top - cyTop, rim);
    }
    // An aerial on some roofs.
    if (h2(i, 12, seed) > 0.72) {
      const ax = x + w * 0.7;
      const ay = top - (kind === 'gable' ? rise * 0.4 : kind === 'eaves' ? rise * 0.8 : 0);
      p.rect(ax, ay - 9, d === 1 ? 1 : 1 / d, 9, pick(roof, 0.6));
      p.rect(ax - 3, ay - 8, 6, d === 1 ? 1 : 1 / d, pick(roof, 0.6));
      p.rect(ax - 2, ay - 6, 4, d === 1 ? 1 : 1 / d, pick(roof, 0.6));
    }
    // Windows: dark glass in rows, a rare warm one.
    for (let s = 0; s < storeys; s++) {
      const wy = top + 2 + s * 9;
      if (wy > p.h - 6) break;
      const n = Math.max(1, Math.floor((w - 6) / 8));
      const gap = (w - n * 3) / (n + 1);
      for (let j = 0; j < n; j++) {
        const wx = x + gap + j * (3 + gap);
        const lit = h2(i * 7 + j, s, seed + 31) > 0.93;
        p.rect(wx, wy, 3, 5, lit ? pick(warm, 3 + (h2(j, s, seed) > 0.5 ? 1 : 0)) : pick(glass, 1 + (d >= 2 ? 0.4 : 0)));
        if (d >= 2) p.rect(wx, wy + 5, 3, 0.5, pick(wall, 2.4));
        if (lit && d >= 2) p.rect(wx + 1.25, wy, 0.5, 5, pick(warm, 2));
      }
    }
    // The sun-side rim on the roofline (the light comes from behind the houses).
    if (d >= 2) for (let j = 1; j + 1 < poly.length - 1; j++) p.line(poly[j][0], poly[j][1], poly[j + 1][0], poly[j + 1][1], j === 1 ? rimDim : rim);
    x += w;
    i++;
  }
});

/** Re-export for the section backgrounds. */
export { F };
