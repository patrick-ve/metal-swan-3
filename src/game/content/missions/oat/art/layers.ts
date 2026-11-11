/**
 * The background layers of mission `oat` (STREET-A, wave A; docs/design/oat.md §8.1 items 1–2, §8.7
 * a 1–3 and d 1–2; scenery research §3 a 1–3, d 1–2, §4 colours, §6 light): one drawer per
 * generator for its 1×, 2× and 4× art (kit.ts `regBg`, the `Pen`), over the oat colour set.
 *
 * - `oat-a-sky` (screen-fixed, NOT lifted: the FloorDefs list it in `skyLayers`): a late-September
 *   09:30 sky, morning blue at the zenith (≈ #4583c0) paling to a pale warm horizon, broken cumulus
 *   lit from the LEFT (decision 37): warm-white tops and left flanks, cool grey-blue undersides.
 * - `oat-a-tower`: the Westertoren (about 87 m: the brick shaft, the stone clock stage, the wooden
 *   octagonal stages, the blue-and-gold crown and its vane; our own drawing), hazed and cooled by the
 *   distance, lit from the left. A narrow layer drawn once (`repeatX: false`).
 * - `oat-a-roofs` / `oat-a-roofs-far`: the roofscape behind our street (98 % pitched: red-orange pan
 *   tiles, slate and zinc, chimneys, dormers, a roof terrace with plants; gable tops of the next
 *   streets: step, spout, neck, bell and cornice), hazed toward `HAZE_MORNING`.
 * - `oat-d-sky` (screen-fixed): 22:30, deep navy, low clouds lit faintly orange-brown from below by
 *   the city, a warm glow over the horizon; no stars in the glow.
 * - `oat-d-tower`: the Oude Kerk tower (about 70 m: a Gothic brick tower with a stone lantern and a
 *   spire), floodlit warm from below against the navy; backdrop only (spec §2.5 "Respect").
 * - `oat-d-roofs`: dark roofs and narrow step / spout gables against the glow, about 30 % of the
 *   windows lit warm, chimneys; the rims toward the glow lit faintly warm.
 *
 * Every non-sky layer is lifted by the floor (16 px: the façade base at y 160), so its art sits 16 px
 * lower in its buffer than it shows. Ordered dither only at band borders (`dq`); fine detail at 4×,
 * 2 × 2 clusters at 2×, only tone at 1× (spec §8.10 density rule). Same params, same pixels.
 */
import type { Color } from '../../../../../engine/color';
import { bay, dq, h2, HAZE_MORNING, HAZE_NIGHT, ladder, mx, num, pick, regBg, str, T, type Dn, type Params, type Pen } from './kit';

/** The morning sun's colour (spec §8.3: 4,500 K, ≈ #ffd9b6). */
const SUN_A: Color = 0xffd9b6ff;

// ------------------------------------------------------------------------------------ helpers

/** Smooth step 0 … 1. */
function sstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A list of colours seen through `air` of the haze `hz` (once per drawer call). */
function hazed(list: readonly Color[], hz: Color, air: number, d: Dn): Color[] {
  return list.map((c) => (air <= 0 ? c : mx(c, hz, air, d)));
}

/** Cells of fine noise: 1 art px at 4×, 2 × 2 at 2×, one logical px at 1× (world-anchored in the buffer). */
function cell(X: number, d: Dn): number {
  return d >= 4 ? X : d === 2 ? X >> 1 : X;
}

/** Fill art rows [Y0, Y1) of the whole pen width with a vertical gradient through `list` (index by y). */
function vgrad(p: Pen, list: readonly Color[], vAt: (y: number) => number, z: number): void {
  const d = p.d;
  for (let Y = 0; Y < p.H; Y++) {
    const v = vAt((Y + 0.5) / d);
    for (let X = 0; X < p.W; X++) {
      const k = dq(v, X, Y, z);
      p.dot(X, Y, list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k]);
    }
  }
}

// ------------------------------------------------------------------------------------ clouds

interface Lobe {
  x: number;
  y: number;
  r: number;
  /** The cloud's flat base (logical y) and its thickness (for the underside shade). */
  base: number;
  th: number;
}

/** Cumulus lobes over the sky's width: `n` clouds between y0 and y1 (logical), sized by `size`. */
function cumulus(w: number, n: number, y0: number, y1: number, size: number, seed: number): Lobe[] {
  const out: Lobe[] = [];
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.15 + h2(i, 1, seed) * 0.7) / n) * w;
    const base = y0 + h2(i, 2, seed) * (y1 - y0);
    const cw = size * (0.55 + h2(i, 3, seed) * 0.9) * (0.6 + (base / Math.max(1, y1)) * 0.6);
    const m = 4 + Math.floor(h2(i, 4, seed) * 4);
    const th = cw * (0.32 + h2(i, 5, seed) * 0.18);
    for (let k = 0; k < m; k++) {
      const t = m === 1 ? 0.5 : k / (m - 1);
      const mid = 1 - Math.abs(t - 0.5) * 2;
      const r = cw * (0.13 + 0.14 * mid + h2(i, 10 + k, seed) * 0.06);
      out.push({ x: cx + (t - 0.5) * cw * 0.85 + (h2(i, 20 + k, seed) - 0.5) * cw * 0.12, y: base - r * 0.55 - mid * th * 0.45, r, base, th });
    }
  }
  return out;
}

/**
 * Paint cumulus lobes over what is in the pen: the density field per art px (wrapping in x), then the
 * light from the upper left: the lit rim where the cloud is denser than toward the sun, the shaded
 * underside near the flat base. `tones` runs from the underside's shade to the sunlit top. `below`: the
 * light comes from under the cloud (the city at night): the base lit, the top dark.
 */
function paintClouds(p: Pen, lobes: readonly Lobe[], tones: readonly Color[], o: { rim: number; seed: number; under: number; below?: boolean }): void {
  const d = p.d;
  const W = p.W;
  const H = p.H;
  const dens = new Float32Array(W * H);
  const baseOf = new Float32Array(W * H);
  const thOf = new Float32Array(W * H);
  for (const L of lobes) {
    const X0 = Math.floor((L.x - L.r) * d);
    const X1 = Math.ceil((L.x + L.r) * d);
    const Y0 = Math.max(0, Math.floor((L.y - L.r) * d));
    const Y1 = Math.min(H - 1, Math.ceil(Math.min(L.base + 1, L.y + L.r) * d));
    for (let Y = Y0; Y <= Y1; Y++) {
      const y = (Y + 0.5) / d;
      const dy = (y - L.y) / L.r;
      // The flat base: the lobe fades out within a logical px over it.
      const flat = 1 - sstep(L.base - 1.2, L.base + 0.4, y);
      if (flat <= 0) continue;
      for (let X = X0; X <= X1; X++) {
        const dx = ((X + 0.5) / d - L.x) / L.r;
        const f = 1 - (dx * dx + dy * dy);
        if (f <= 0) continue;
        const xi = ((X % W) + W) % W;
        const i = Y * W + xi;
        const v = Math.min(1, f * 1.6) * flat;
        if (v > dens[i]) {
          dens[i] = v;
          baseOf[i] = L.base;
          thOf[i] = L.th;
        }
      }
    }
  }
  const off = Math.max(1, Math.round(o.rim * d));
  const n = tones.length - 1;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      const v = dens[i];
      if (v <= 0.02) continue;
      // Fluffy edges: noise on the threshold (cells of the density rule), dithered.
      const nz = d === 1 ? 0 : (h2(X >> 1, Y >> 1, o.seed) - 0.5) * 0.1;
      if (v + nz < 0.18 + bay(X, Y) * 0.1) continue;
      const xu = (((X - off) % W) + W) % W;
      const Yu = Y - off;
      const up = Yu >= 0 ? dens[Yu * W + xu] : 0;
      const rim = Math.max(0, Math.min(1, (v - up) * 2.6));
      const y = (Y + 0.5) / d;
      const under = 1 - sstep(baseOf[i] - thOf[i] * o.under, baseOf[i], y);
      const t = o.below ? 0.12 + 0.8 * (1 - under) * (0.5 + 0.5 * v) - 0.1 * rim : 0.32 + 0.42 * rim + 0.35 * under * (0.6 + 0.4 * v) - (1 - under) * 0.28;
      p.dot(X, Y, tones[Math.max(0, Math.min(n, dq(t * n, X, Y, 0.6)))]);
    }
  }
}

// ------------------------------------------------------------------------------------ oat-a-sky

/** The sky's gradient top → horizon (logical y of the horizon band's end: `hy`). */
function skyA(p: Pen, params: Params, seed: number): void {
  const d = p.d;
  const hy = num(params, 'horizon', 150);
  const list = ladder([T('sky', 1, d), T('sky', 2, d), mx(T('sky', 3, d), T('sky', 2, d), 0.4, d), T('sky', 4, d), T('sky', 5, d), mx(T('sky', 6, d), T('snow', 4, d), 0.5, d), mx(T('snow', 5, d), SUN_A, 0.18, d), mx(T('stone', 7, d), SUN_A, 0.12, d)], 2, d);
  const n = list.length - 1;
  // A slight curve: the blue holds high up, the pale band gathers toward the horizon.
  vgrad(p, list, (y) => n * Math.pow(Math.max(0, Math.min(1, y / hy)), 1.35) + 0.2, d === 1 ? 0 : 0.7);
  const tones = ladder([mx(T('snow', 1, d), T('sky', 3, d), 0.35, d), T('snow', 2, d), T('snow', 3, d), T('snow', 4, d), T('snow', 5, d), mx(T('snow', 5, d), SUN_A, 0.3, d), mx(T('stone', 7, d), SUN_A, 0.25, d)], 2, d);
  const s = seed | 0;
  // Two decks: big broken cumulus high, smaller flatter ones lower toward the horizon (haze-paled).
  paintClouds(p, cumulus(p.w, num(params, 'clouds', 6), 40, 74, 64, s + 11), tones, { rim: 2.5, seed: s + 1, under: 0.7 });
  const low = tones.map((c) => mx(c, mx(T('snow', 5, d), SUN_A, 0.15, d), 0.45, d));
  paintClouds(p, cumulus(p.w, num(params, 'lowClouds', 7), 92, 120, 36, s + 23), low, { rim: 1.5, seed: s + 2, under: 0.6 });
}

// ------------------------------------------------------------------------------------ oat-d-sky

function skyD(p: Pen, params: Params, seed: number): void {
  const d = p.d;
  const hy = num(params, 'horizon', 118);
  const list = ladder([T('navy', 0, d), T('oat.nightSky', 0, d), mx(T('oat.nightSky', 0, d), T('oat.nightSky', 1, d), 0.5, d), T('oat.nightSky', 1, d), mx(T('oat.nightSky', 1, d), T('oat.nightSky', 2, d), 0.5, d), T('oat.nightSky', 2, d), mx(T('oat.nightSky', 2, d), T('oat.nightSky', 3, d), 0.5, d)], 2, d);
  const n = list.length - 1;
  vgrad(p, list, (y) => n * Math.pow(Math.max(0, Math.min(1, y / hy)), 1.7) + 0.1, d === 1 ? 0 : 0.7);
  // Low clouds: dark bodies, their undersides lit orange-brown by the city (the light comes from BELOW).
  const tones = ladder([T('navy', 1, d), T('oat.nightSky', 1, d), mx(T('oat.nightSky', 1, d), T('oat.nightSky', 2, d), 0.5, d), T('oat.nightSky', 2, d), T('oat.nightSky', 3, d)], 2, d);
  paintClouds(p, cumulus(p.w, num(params, 'clouds', 7), 26, 66, 80, (seed | 0) + 31), tones, { rim: 2, seed: (seed | 0) + 3, under: 0.65, below: true });
}

// ------------------------------------------------------------------------------------ roofscapes

type Gable = 'slope' | 'trap' | 'tuit' | 'hals' | 'klok' | 'lijst';

/** The top of a gable front of width 1 at t ∈ [0, 1]: 0 = the eave line, 1 = the tip. */
function gableTop(g: Gable, t: number, steps: number): number {
  const m = 1 - Math.abs(t * 2 - 1);
  switch (g) {
    case 'tuit':
      return Math.min(1, m * 1.08);
    case 'trap': {
      const k = Math.floor(m * (steps + 0.999));
      return Math.min(1, k / steps);
    }
    case 'hals':
      // The neck (the middle half at full height) on shoulders, curved klauwstukken between.
      return m > 0.5 ? 1 : m > 0.12 ? 0.42 + 0.58 * sstep(0.12, 0.5, m) * sstep(0.12, 0.5, m) : 0.42 * (m / 0.12);
    case 'klok':
      return m > 0.86 ? 1 : Math.pow(m / 0.86, 0.55) * 0.94;
    default:
      return 0;
  }
}

interface RoofTones {
  brick: readonly (readonly Color[])[];
  tile: readonly Color[];
  slate: readonly Color[];
  zinc: readonly Color[];
  glass: readonly Color[];
  frame: readonly Color[];
  stone: readonly Color[];
  lit: readonly Color[];
  plant: readonly Color[];
  rim: readonly Color[];
}

const roofCache = new Map<string, RoofTones>();

function roofTones(night: boolean, air: number, d: Dn): RoofTones {
  const key = `${night ? 1 : 0}:${air}:${d}`;
  let t = roofCache.get(key);
  if (t) return t;
  const hz = night ? HAZE_NIGHT : HAZE_MORNING;
  const H = (list: readonly Color[]): Color[] => hazed(ladder(list, 2, d), hz, air, d);
  if (!night) {
    t = {
      brick: [
        H([T('oat.brick', 1, d), T('oat.brick', 3, d), T('oat.brick', 4, d), T('oat.brick', 5, d), T('oat.brick', 6, d)]),
        H([T('oat.brick', 0, d), T('oat.brick', 1, d), T('oat.brick', 2, d), T('oat.brick', 3, d)]),
        H([T('brick', 2, d), T('brick', 3, d), T('brick', 4, d), T('brick', 5, d)]),
        H([T('stone', 3, d), T('stone', 5, d), T('plaster', 5, d), T('stone', 7, d)]),
        H([T('oat.brick', 0, d), T('slate', 2, d), T('black', 3, d), T('stone', 2, d)]),
      ],
      tile: H([T('rust', 1, d), T('brick', 2, d), T('brick', 3, d), mx(T('brick', 3, d), T('oat.brick', 5, d), 0.5, d), T('oat.brick', 5, d), mx(T('oat.brick', 6, d), SUN_A, 0.2, d)]),
      slate: H([T('slate', 1, d), T('slate', 2, d), T('slate', 3, d), T('steel', 3, d), T('slate', 5, d)]),
      zinc: H([T('steel', 2, d), T('steel', 3, d), T('steel', 4, d), T('steel', 5, d), T('steel', 6, d)]),
      glass: H([T('glass', 1, d), T('glass', 2, d), T('glass', 3, d)]),
      frame: H([T('gable', 2, d), T('gable', 3, d), T('gable', 4, d)]),
      stone: H([T('oat.mortar', 1, d), T('oat.mortar', 2, d), T('oat.mortar', 3, d), T('sand', 6, d)]),
      lit: H([T('glass', 3, d), T('glass', 4, d)]),
      plant: H([T('olive', 2, d), T('olive', 3, d), T('olive', 4, d), T('gold', 4, d)]),
      rim: H([T('snow', 5, d), mx(T('stone', 7, d), SUN_A, 0.3, d)]),
    };
  } else {
    t = {
      brick: [
        H([T('oat.nightWater', 0, d), T('oat.brick', 0, d), T('oat.brick', 1, d), T('oat.brick', 2, d)]),
        H([T('navy', 0, d), T('oat.nightSky', 0, d), T('oat.brick', 0, d), T('oat.brick', 1, d)]),
        H([T('oat.nightWater', 0, d), T('slate', 1, d), T('oat.brick', 1, d), T('oat.nightSky', 2, d)]),
        H([T('navy', 1, d), T('slate', 1, d), T('slate', 2, d), T('slate', 3, d)]),
        H([T('oat.nightWater', 0, d), T('oat.nightWater', 1, d), T('oat.brick', 0, d), T('oat.brick', 1, d)]),
      ],
      tile: H([T('oat.nightWater', 0, d), T('oat.nightWater', 1, d), T('oat.brick', 0, d), T('oat.brick', 1, d)]),
      slate: H([T('navy', 0, d), T('oat.nightSky', 0, d), T('navy', 1, d), T('slate', 1, d)]),
      zinc: H([T('navy', 0, d), T('slate', 1, d), T('slate', 2, d), T('slate', 3, d)]),
      glass: H([T('oat.nightWater', 0, d), T('navy', 0, d), T('navy', 1, d)]),
      frame: H([T('slate', 1, d), T('slate', 2, d)]),
      stone: H([T('oat.nightSky', 1, d), T('slate', 2, d), T('slate', 3, d)]),
      lit: ladder([T('oat.lantern', 0, d), mx(T('oat.lantern', 0, d), T('oat.lantern', 1, d), 0.5, d), T('oat.lantern', 1, d), T('oat.lantern', 2, d)], 2, d),
      plant: H([T('oat.nightWater', 0, d), T('navy', 0, d)]),
      rim: H([T('oat.nightSky', 2, d), T('oat.nightSky', 3, d)]),
    };
  }
  roofCache.set(key, t);
  return t;
}

/** A roof slope seen side-on (the front slope faces the camera): pan tiles, slate or zinc courses. */
function slopeRoof(p: Pen, x0: number, x1: number, ridge: number, eave: number, list: readonly Color[], o: { tiles: boolean; night: boolean; seed: number; rim: readonly Color[] }): void {
  const d = p.d;
  const hip = (eave - ridge) * 0.9;
  const n = list.length - 1;
  const ch = 1.5;
  p.poly(
    [
      [x0, eave],
      [x0 + hip, ridge],
      [x1 - hip, ridge],
      [x1, eave],
    ],
    (X, Y) => {
      const x = (X + 0.5) / d;
      const y = (Y + 0.5) / d;
      // The hip ends: the left one faces the sun (lighter), the right one away (darker).
      const left = x - x0 < (eave - y) * (hip / (eave - ridge)) + 1.2 ? 1 : 0;
      const right = x1 - x < (eave - y) * (hip / (eave - ridge)) + 1.2 ? 1 : 0;
      // Courses: lit lip at the top of each, a dark line under it (only tone at 1×).
      let v = n * (0.62 - 0.2 * ((y - ridge) / Math.max(1, eave - ridge)));
      if (d >= 2) {
        const c = (y - ridge) / ch;
        const f = c - Math.floor(c);
        if (f < 0.22) v += 0.9;
        else if (f > 0.8) v -= 1.2;
        if (o.tiles) {
          const tc = Math.floor((x + Math.floor(c) * 0.75) / 1.5);
          v += (h2(tc, Math.floor(c), o.seed) - 0.5) * 1.3;
        }
      }
      if (left) v += 1;
      if (right) v -= 1.6;
      if (y - ridge < 1 / d + 0.01) v = o.night ? -1 : v + 1.2;
      if (o.night && y - ridge < 0.6 + 1 / d) return pick(o.rim, 0);
      return list[Math.max(0, Math.min(n, dq(v, X, Y, 0.6)))];
    },
  );
}

/**
 * A front below its eaves, from logical y `from` down to the layer's bottom (the bridge vistas and the
 * canal openings show it): the brick grain lit from the left, sinking a little toward the street, and
 * window rows every 9 px from `eave` + 3 in `bays` bays (lit windows at night by `lit`).
 */
function wallDown(p: Pen, u0: number, w: number, from: number, eave: number, wall: readonly Color[], t: RoofTones, o: { bays: number; lot: number; seed: number; night: boolean; lit: number }): void {
  const d = p.d;
  const wn = wall.length - 1;
  const X0 = Math.round(u0 * d);
  const X1 = Math.round((u0 + w) * d);
  const Y0 = Math.max(0, Math.round(from * d));
  const e = Math.max(1, d >> 1);
  for (let X = X0; X < X1; X++) {
    const edge = X - X0 < e ? 1 : X1 - X <= e ? -1.4 : 0;
    for (let Y = Y0; Y < p.H; Y++) {
      // The fronts sink a little toward the street (the street's shade, the far rows' haze), capped.
      let v = wn * 0.62 + edge - Math.min(1.5, Math.max(0, (Y + 0.5) / d - eave) * 0.035);
      if (d >= 2) v += (h2(cell(X, d), cell(Y, d), o.seed + 7) - 0.5) * 0.7;
      p.dot(X, Y, wall[Math.max(0, Math.min(wn, dq(v, X, Y, 0.5)))]);
    }
  }
  const bw = w / o.bays;
  const ww = Math.max(1.5, bw * 0.34);
  for (let row = 0; eave + 3 + row * 9 < p.h; row++) {
    const wy = eave + 3 + row * 9;
    if (wy + 4 <= from) continue;
    for (let b = 0; b < o.bays; b++) {
      const wx = u0 + b * bw + (bw - ww) / 2;
      const on = o.night && h2(o.lot * 31 + row, b, o.seed + 77) < o.lit;
      if (d >= 2) p.rect(wx - 0.5, wy - 0.5, ww + 1, 5, pick(t.frame, o.night ? 0 : 1));
      p.rect(wx, wy, ww, 4, on ? pick(t.lit, 1 + h2(o.lot, row * 3 + b, o.seed) * 2.5) : pick(t.glass, 1 + (b === 0 ? 1 : 0)));
      if (d >= 4 && !on) p.rect(wx, wy + 1.75, ww, 0.5, pick(t.frame, 0));
    }
  }
}

/** One roofscape: a back row of slopes, a front row of gables and slopes with chimneys and windows. */
function roofs(p: Pen, params: Params, seed: number): void {
  const d = p.d;
  const night = str(params, 'light', 'morning') === 'night';
  const air = num(params, 'air', 0.35);
  const y0 = num(params, 'y0', 64);
  const y1 = num(params, 'y1', 100);
  const litShare = num(params, 'lit', 0.3);
  const gableShare = num(params, 'gables', 0.55);
  const lotMin = num(params, 'lotMin', 16);
  const lotMax = num(params, 'lotMax', 30);
  const s = seed | 0;
  const tb = roofTones(night, Math.min(0.85, air + 0.14), d);
  const tf = roofTones(night, air, d);
  const W = p.w;
  // ---- the back row: long slopes behind, higher, more hazed.
  {
    let x = -4;
    let i = 0;
    while (x < W + 4) {
      const w = 34 + h2(i, 1, s + 5) * 46;
      const ridge = y0 - 8 + h2(i, 2, s + 5) * (y1 - y0) * 0.6;
      const kind = h2(i, 3, s + 5);
      const list = kind < 0.6 ? tb.tile : kind < 0.85 ? tb.slate : tb.zinc;
      const eave = ridge + 12 + h2(i, 4, s + 5) * 6;
      slopeRoof(p, x, x + w, ridge, eave, list, { tiles: kind < 0.6, night, seed: s + i, rim: tb.rim });
      // The walls under the slopes (more hazed than the front row), with their window rows.
      const wk = h2(i, 5, s + 5);
      const wall = tb.brick[wk < 0.45 ? 1 : wk < 0.7 ? 0 : wk < 0.85 ? 3 : 2];
      wallDown(p, x + 1, w - 2, eave, eave, wall, tb, { bays: w > 52 ? 4 : 3, lot: 500 + i, seed: s + 5, night, lit: litShare });
      x += w - 6;
      i++;
    }
  }
  // ---- the front row: lots across the layer, scaled to end exactly at its width (it tiles).
  const ws: number[] = [];
  let sum = 0;
  for (let i = 0; sum < W; i++) {
    const w = lotMin + h2(i, 7, s) * (lotMax - lotMin);
    ws.push(w);
    sum += w;
  }
  const k = W / sum;
  let x = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i] * k;
    const u0 = x;
    x += w;
    const r = (j: number): number => h2(i, j, s + 101);
    const g: Gable = r(1) < gableShare ? (['trap', 'tuit', 'hals', 'klok', 'lijst', 'tuit', 'hals'] as const)[Math.floor(r(2) * 7)] : 'slope';
    const tip = y0 + r(3) * (y1 - y0);
    // Red-brown 40 %, purple-brown 20 %, orange-red 15 %, plaster 15 %, near-black painted 10 %.
    const wr = r(4);
    const wallK = wr < 0.4 ? 0 : wr < 0.6 ? 1 : wr < 0.75 ? 2 : wr < 0.9 ? 3 : 4;
    const wall = tf.brick[night ? Math.min(tf.brick.length - 1, wallK) : wallK];
    const wn = wall.length - 1;
    if (g === 'slope') {
      const eave = tip + 10 + r(5) * 6;
      const kind = r(6);
      slopeRoof(p, u0 - 1, u0 + w + 1, tip, eave, kind < 0.55 ? tf.tile : kind < 0.82 ? tf.slate : tf.zinc, { tiles: kind < 0.55, night, seed: s + 300 + i, rim: tf.rim });
      // A dormer now and then, a chimney, a roof terrace with plants.
      if (r(7) < 0.45) {
        const dx = u0 + w * (0.3 + r(8) * 0.3);
        const dy = tip + (eave - tip) * 0.45;
        p.rect(dx, dy, 4, 4, pick(wall, wn * 0.7));
        p.rect(dx - 0.5, dy - 0.8, 5, 1, pick(tf.slate, 1));
        p.rect(dx + 1, dy + 1, 2, 2.5, night && r(9) < litShare ? pick(tf.lit, 2) : pick(tf.glass, 1));
      }
      if (r(10) < 0.25 && !night) {
        // A roof terrace: a railing line and a few plants on the slope's top.
        const tx0 = u0 + w * 0.2;
        p.rect(tx0, tip - 1.5, w * 0.45, 0.5, pick(tf.frame, 0));
        for (let q = 0; q < 3; q++) p.disc(tx0 + 2 + q * (w * 0.14), tip - 1.5, 1.4, 1.2, pick(tf.plant, 1 + q));
      }
      wallDown(p, u0, w, eave, eave, wall, tf, { bays: w > 24 ? 3 : 2, lot: i, seed: s, night, lit: litShare });
    } else {
      const gh = g === 'lijst' ? 0 : w * (0.55 + r(5) * 0.35);
      const eave = tip + gh;
      const steps = 3 + Math.floor(r(6) * 2);
      if (g === 'lijst') {
        // A cornice house: the roof slope set back behind a straight cornice.
        slopeRoof(p, u0 + 1, u0 + w - 1, tip - 9, tip + 1, r(7) < 0.6 ? tf.tile : tf.slate, { tiles: r(7) < 0.6, night, seed: s + 500 + i, rim: tf.rim });
      }
      // The front: per art px column, from the gable's top down.
      const X0 = Math.round(u0 * d);
      const X1 = Math.round((u0 + w) * d);
      for (let X = X0; X < X1; X++) {
        const t = (X + 0.5 - X0) / Math.max(1, X1 - X0);
        const top = g === 'lijst' ? tip : eave - gh * gableTop(g, t, steps);
        const Yt = Math.round(top * d);
        // Lit from the left: the left two art px lighter, the right edge darker (the sun's side).
        const edge = X - X0 < Math.max(1, d >> 1) ? 1 : X1 - X <= Math.max(1, d >> 1) ? -1.4 : 0;
        // The gable down to the eaves; the storeys below are `wallDown`'s (the vistas show them).
        const Yd = Math.min(p.H, Math.round(eave * d));
        for (let Y = Math.max(0, Yt); Y < Yd; Y++) {
          let v = wn * 0.62 + edge;
          if (d >= 2) v += (h2(cell(X, d), cell(Y, d), s + 7) - 0.5) * 0.7;
          if (Y - Yt < Math.max(1, d >> 1)) v = g === 'tuit' || g === 'trap' ? wn * 0.3 : -100;
          p.dot(X, Y, v === -100 ? pick(tf.stone, 2) : wall[Math.max(0, Math.min(wn, dq(v, X, Y, 0.5)))]);
        }
        if (night && Yt - 1 >= 0) p.dot(X, Yt - 1, pick(tf.rim, 0));
      }
      // The storeys under the gable: brick and windows every 9 px, 2–3 bays, down to the layer's bottom.
      wallDown(p, u0, w, eave, eave, wall, tf, { bays: w > 24 ? 3 : 2, lot: i, seed: s, night, lit: litShare });
      if (g === 'lijst') p.rect(u0 - 0.5, tip - 1.2, w + 1, 1.4, pick(tf.stone, 2));
      if (gh > 6) {
        const on = night && r(11) < litShare;
        p.rect(u0 + w / 2 - 1.5, eave - gh * 0.55, 3, 4.5, on ? pick(tf.lit, 2) : pick(tf.glass, 1));
        // The hoist beam in the gable's top.
        if (!night && r(12) < 0.5) p.rect(u0 + w / 2 - 0.5, eave - gh * 0.8, 1, 1.2, pick(tf.brick[4], 1));
      }
    }
    // Chimneys on about half of the lots (lit left).
    if (r(13) < 0.5) {
      const cx = u0 + w * (0.2 + r(14) * 0.6);
      const cy = tip - 5 - r(15) * 3;
      p.rect(cx, cy, 2.5, tip - cy + 3, pick(tf.brick[0], 2));
      p.rect(cx, cy, 0.75, tip - cy + 3, pick(tf.brick[0], 3));
      p.rect(cx - 0.5, cy, 3.5, 0.75, pick(tf.stone, 1));
    }
  }
}

// ------------------------------------------------------------------------------------ towers

/** A lit column [x, x + w) × [y0, y1) on a tone list: the left lit, the right in shade. */
function column(p: Pen, x: number, y0: number, y1: number, w: number, list: readonly Color[], mid: number, sideLight = 1): void {
  const d = p.d;
  const n = list.length - 1;
  const X0 = Math.round(x * d);
  const X1 = Math.max(X0 + 1, Math.round((x + w) * d));
  for (let X = X0; X < X1; X++) {
    const t = (X + 0.5 - X0) / (X1 - X0);
    const v = mid + sideLight * (t < 0.3 ? 1.4 : t < 0.55 ? 0.5 : t > 0.8 ? -1.6 : -0.4);
    const c = list[Math.max(0, Math.min(n, Math.round(v)))];
    p.span(X, X + 1, Math.round(y0 * d), c);
    for (let Y = Math.round(y0 * d); Y < Math.round(y1 * d); Y++) p.dot(X, Y, c);
  }
}

/** The Westertoren (oat-a): about 87 m; drawn in the layer's middle at scale `s`, the tip at logical y `top`. */
function westertoren(p: Pen, params: Params): void {
  const d = p.d;
  const air = num(params, 'air', 0.28);
  const k = num(params, 's', 1.25);
  const cx = p.w / 2;
  const top = num(params, 'top', 20);
  const H = (l: readonly Color[]): Color[] => hazed(ladder(l, 2, d), HAZE_MORNING, air, d);
  const brick = H([T('oat.brick', 1, d), T('oat.brick', 3, d), T('oat.brick', 4, d), T('oat.brick', 5, d), T('oat.brick', 6, d)]);
  const stone = H([T('oat.mortar', 0, d), T('oat.mortar', 1, d), T('oat.mortar', 2, d), T('oat.mortar', 3, d), T('sand', 6, d)]);
  const wood = H([T('black', 2, d), T('black', 3, d), T('slate', 3, d), T('steel', 3, d)]);
  const blue = H([T('denim', 1, d), T('denim', 2, d), T('denim', 3, d), T('denim', 4, d)]);
  const gold = H([T('gold', 2, d), T('gold', 4, d), T('gold', 5, d)]);
  const dark = H([T('ink', 1, d), T('black', 2, d)]);
  const face = H([T('stone', 6, d), T('stone', 7, d)]);
  const R = (x: number, y: number, w: number, h: number, c: Color): void => p.rect(cx + x * k, top + y * k, w * k, h * k, c);
  // The vane, the orb.
  R(-0.2, 0, 0.4, 6, pick(dark, 1));
  R(-1.5, 1, 3, 0.6, pick(gold, 1));
  p.disc(cx, top + 6.5 * k, 1.2 * k, 1.2 * k, (X) => pick(gold, (X + 0.5) / d < cx ? 2 : 0));
  // The crown: a blue onion body on a gold ring, gold ribs arching over it (our own simplified crown).
  const cy = 8;
  const crown: [number, number][] = [
    [-1.2, 0],
    [1.2, 0],
    [3.6, 1.6],
    [5.4, 4],
    [5.6, 5.8],
    [4.6, 7],
    [-4.6, 7],
    [-5.6, 5.8],
    [-5.4, 4],
    [-3.6, 1.6],
  ];
  p.poly(
    crown.map(([x, y]): [number, number] => [cx + x * k, top + (cy + y) * k]),
    (X, Y) => {
      const x = ((X + 0.5) / d - cx) / k;
      const y = ((Y + 0.5) / d - top) / k - cy;
      return pick(blue, x < -2.5 ? 3 : x < 1 ? 2 + (y < 3 ? 1 : 0) : x < 3.5 ? 1 : 0);
    },
  );
  // The ribs: from the ring up to the top, curving with the body.
  for (const f of [-0.8, -0.4, 0, 0.4, 0.8]) {
    for (let t = 0; t <= 1; t += 0.5 / (k * d)) {
      const y = 7 - t * 7;
      const half = y > 4 ? 5.5 - (y - 4) * 0.4 : y > 1.6 ? 3.6 + (y - 1.6) * 0.8 : 1.2 + y * 1.5;
      p.rect(cx + f * half * k - 0.25 * k, top + (cy + y) * k, 0.5 * k, 0.5 * k, pick(gold, f < 0.1 ? 2 : 1));
    }
  }
  R(-6, cy + 6.8, 12, 1.2, pick(gold, 1));
  R(-5.2, cy + 6.6, 1.2, 0.5, pick(gold, 2));
  // The wooden octagonal stages with their openings (narrowing upward) and stone balustrades.
  const stages: readonly [number, number, number][] = [
    [cy + 8.2, 13, 9],
    [cy + 17.2, 17, 13],
    [cy + 30.2, 21, 13],
  ];
  for (const [y, w, h] of stages) {
    column(p, cx - (w / 2) * k, top + y * k, top + (y + h) * k, w * k, wood, 2);
    for (let i = 0; i < 3; i++) {
      const ox = -w / 2 + (w / 3) * i + w / 6 - 0.8;
      R(ox, y + 3, 1.6, h - 5.5, pick(dark, 0));
      p.disc(cx + (ox + 0.8) * k, top + (y + 3) * k, 0.8 * k, 0.8 * k, pick(dark, 0));
    }
    R(-w / 2 - 1, y + h - 1.2, w + 2, 1.2, pick(stone, 3));
  }
  // The stone clock stage.
  const csy = cy + 43.4;
  column(p, cx - 12 * k, top + csy * k, top + (csy + 18) * k, 24 * k, stone, 2);
  p.disc(cx - 0.5 * k, top + (csy + 8) * k, 4 * k, 4 * k, (X) => pick(face, (X + 0.5) / d < cx ? 1 : 0));
  R(-0.75, csy + 5, 0.5, 3.2, pick(dark, 0));
  R(-0.5, csy + 7.7, 2.8, 0.5, pick(dark, 0));
  R(-13, csy + 17, 26, 1.6, pick(stone, 3));
  // The brick shaft with sandstone bands and tall arched openings, down past the roofs.
  const sy = csy + 18.6;
  column(p, cx - 12 * k, top + sy * k, p.h, 24 * k, brick, 2.2);
  for (let y = sy + 14; top + y * k < p.h; y += 19) R(-12, y, 24, 1.2, pick(stone, 2));
  for (let i = 0; i < 2; i++) {
    const ox = -7 + i * 10;
    R(ox, sy + 4, 3.5, 9, pick(dark, 1));
    p.disc(cx + (ox + 1.75) * k, top + (sy + 4) * k, 1.75 * k, 1.6 * k, pick(dark, 1));
  }
}

/** The Oude Kerk tower (oat-d): about 70 m, floodlit warm from below against the night (scale `s`). */
function oudeKerk(p: Pen, params: Params): void {
  const d = p.d;
  const cx = p.w / 2;
  const k = num(params, 's', 1.6);
  const top = num(params, 'top', 22);
  const air = num(params, 'air', 0.2);
  const lightTop = num(params, 'lightTop', 90);
  const H = (l: readonly Color[]): Color[] => hazed(ladder(l, 2, d), HAZE_NIGHT, air, d);
  // The floodlight: the lower parts warm and bright, fading up into the dark spire.
  const lit = H([T('navy', 1, d), T('oat.nightSky', 1, d), T('oat.nightSky', 2, d), T('brown', 2, d), T('oat.nightSky', 3, d), T('brown', 3, d), T('oat.lantern', 0, d), T('brown', 4, d)]);
  const n = lit.length - 1;
  const dark = H([T('oat.nightWater', 0, d), T('navy', 0, d), T('navy', 1, d)]);
  const glow = (y: number): number => Math.max(0, Math.min(1, (y - top) / Math.max(1, lightTop)));
  const shade = (X: number, Y: number, x0: number, w: number, m: number): Color => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const t = (x - x0) / w;
    let v = n * (0.1 + 0.85 * Math.pow(glow(y), 0.9)) * m;
    v += t < 0.35 ? 0.8 : t > 0.75 ? -1.2 : 0;
    if (d >= 2) v += (h2(X >> 1, Y >> 1, 41) - 0.5) * 0.5;
    return lit[Math.max(0, Math.min(n, dq(v, X, Y, 0.5)))];
  };
  const box = (x0: number, y0: number, w: number, h: number, m = 1): void =>
    p.fill(cx + x0 * k, top + y0 * k, w * k, h * k, (X, Y) => shade(X, Y, cx + x0 * k, w * k, m));
  // The spire: a slender pyramid with a small orb (a plain finial).
  p.rect(cx - 0.2 * k, top - 4 * k, 0.4 * k, 4 * k, pick(dark, 2));
  p.disc(cx, top - 0.5 * k, 0.9 * k, 0.9 * k, pick(lit, 3));
  p.poly(
    [
      [cx, top],
      [cx + 3.5 * k, top + 26 * k],
      [cx - 3.5 * k, top + 26 * k],
    ],
    (X, Y) => shade(X, Y, cx - 3.5 * k, 7 * k, 0.75),
  );
  // The open lantern stage (dark openings between stone posts), its clock face and the octagon.
  const ly = 26;
  box(-5, ly, 10, 12, 0.9);
  for (let i = 0; i < 3; i++) p.rect(cx + (-4 + i * 3) * k, top + (ly + 2) * k, 1.6 * k, 7 * k, pick(dark, 0));
  box(-7, ly + 12, 14, 12, 0.95);
  p.disc(cx, top + (ly + 18) * k, 2.6 * k, 2.6 * k, (X) => pick(lit, (X + 0.5) / d < cx ? n - 1 : n - 2));
  p.rect(cx - 8 * k, top + (ly + 23.5) * k, 16 * k, 1.2 * k, pick(lit, n - 2));
  // The brick tower: buttresses at the corners, tall pointed openings, down past the roofs.
  const ty = ly + 24.7;
  const rest = (p.h - top) / k - ty;
  box(-10, ty, 20, rest, 1);
  box(-12, ty + 10, 3, rest - 10, 1.05);
  box(9, ty + 10, 3, rest - 10, 0.92);
  for (let i = 0; i < 2; i++) {
    const ox = -6 + i * 8;
    p.poly(
      [
        [cx + ox * k, top + (ty + 8) * k],
        [cx + (ox + 2) * k, top + (ty + 4.5) * k],
        [cx + (ox + 4) * k, top + (ty + 8) * k],
        [cx + (ox + 4) * k, top + (ty + 24) * k],
        [cx + ox * k, top + (ty + 24) * k],
      ],
      pick(dark, 1),
    );
  }
}

// ------------------------------------------------------------------------------------ registration

regBg('oat-a-sky', skyA);
regBg('oat-d-sky', skyD);
regBg('oat-a-tower', (p, params) => westertoren(p, params));
regBg('oat-d-tower', (p, params) => oudeKerk(p, params));
regBg('oat-a-roofs', roofs);
regBg('oat-d-roofs', (p, params, seed) => roofs(p, { light: 'night', ...params }, seed));
