/**
 * The bridge railings of oat-a (STREET-A, wave A; docs/design/oat.md §2.1, §8.2 "Bridges", §8.7 a 6):
 * the three canal bridges (Berensluis, bridges 48 and 25) are brick arches with dark green cast-iron
 * railings and bikes chained to them. The floor draws the deck and the arch (floor/); these sprites
 * are the two railings, drawn at their depths with the terrain's hump (+12 on the walk line) baked
 * in at that depth's scale:
 *
 * - `decor/oat/a/bridge-rail-back`: the far railing at depth 15.5 (s 0.866), seen from the front over
 *   the deck, a granite coping under it, two or three bikes chained to it;
 * - `decor/oat/a/bridge-rail-front`: the near railing at depth −13.6 (s 1.117), front decor: low and
 *   see-through (thin balusters, wide gaps) so the heroes on the deck stay readable.
 *
 * Static (no outline). The sun stands left: the iron's left faces lit, the coping's top lit.
 */
import type { Color } from '../../../../../engine/color';
import { humpAt, ladder, mx, reg, T, type Dn, type Pen } from './kit';
import { drawBike, lf, SKY_CAST, SUN, type BikeKind } from './street';

/** The bridge's world length and the hump on the walk line (terrain.ts). */
const SPAN = 224;
const HUMP = 12;

function ironLad(d: Dn): readonly Color[] {
  return ladder([T('ink', 1, 2), T('oat.green', 0, 2), T('oat.green', 1, 2), T('oat.green', 2, 2), T('oat.green', 3, 2), mx(T('oat.green', 3, 2), SUN, 0.35, 2)], 2, d);
}

function graniteLad(d: Dn): readonly Color[] {
  return ladder([T('slate', 2, 2), T('steel', 2, 2), T('steel', 3, 2), mx(T('steel', 4, 2), T('stone', 4, 2), 0.4, 2), mx(T('stone', 5, 2), SUN, 0.2, 2)], 2, d);
}

/**
 * A railing w × h on a hump of `hump` px (at the frame's middle), its base on the deck line: the
 * coping band `cope` px tall, the railing `rail` px over it; balusters every `pitch` px, posts
 * every `postEvery`.
 */
function railing(p: Pen, o: { hump: number; cope: number; rail: number; pitch: number; postEvery: number; mid: boolean; seed: number }): void {
  const d = p.d;
  const w = p.w;
  const h = p.h;
  const iron = ironLad(d);
  const gr = graniteLad(d);
  // The deck line per art column (the hump), computed once.
  const W = Math.round(w * d);
  const baseA = new Float64Array(W);
  for (let X = 0; X < W; X++) baseA[X] = h - humpAt(Math.max(0, Math.min(1, (X + 0.5) / d / w)), o.hump);
  const base = (x: number): number => baseA[Math.max(0, Math.min(W - 1, Math.floor(x * d)))];
  /** Fill art rows [y0, y1) (logical) of every column with `c(X, k)` (k 0 top … 1 bottom of the run). */
  const band = (top: (X: number) => number, hh: number, c: (X: number, k: number) => Color): void => {
    for (let X = 0; X < W; X++) {
      const y1 = top(X) + hh;
      const Y0 = Math.round(top(X) * d);
      const Y1 = Math.max(Y0 + 1, Math.round(y1 * d));
      for (let Y = Y0; Y < Y1; Y++) p.dot(X, Y, c(X, (Y - Y0 + 0.5) / (Y1 - Y0)));
    }
  };
  // The coping stones: a lit top arris, joints every ~11 px, weathering.
  band((X) => baseA[X] - o.cope, o.cope, (X, k) => {
    const x = (X + 0.5) / d;
    const blk = Math.floor(x / 11);
    if (d >= 2 && x - blk * 11 < 1 / d) return lf(gr, 0.1);
    let t = k < 0.22 ? 0.92 : 0.65 - k * 0.3;
    if (d >= 2) t += ((((blk * 2654435761) >>> 0) % 97) / 97 - 0.5) * 0.18;
    return lf(gr, t);
  });
  // Rails: the bottom rail, a middle rail, the top rail (lit on top).
  const railY = (x: number, up: number): number => base(x) - o.cope - up;
  const thick = (up: number, t: number, lit: number): void => {
    band((X) => baseA[X] - o.cope - up - t, t, (_X, k) => lf(iron, d === 1 || k < 0.4 ? lit : lit - 0.3));
  };
  // Balusters (thin round bars) and posts (square, with a cap and a ball).
  const bw = d === 1 ? 1 : d >= 4 ? 0.5 : 0.5;
  const pitch = d === 1 ? Math.max(o.pitch, 4) : o.pitch;
  for (let x = pitch / 2; x < w - 0.5; x += pitch) {
    const y0 = railY(x, o.rail);
    const y1 = railY(x, 0);
    p.rect(x, y0, bw, y1 - y0, lf(iron, 0.38));
    if (d >= 4) p.rect(x, y0, 0.25, y1 - y0, lf(iron, 0.72));
  }
  for (let x = 1; x < w; x += o.postEvery) {
    const px = Math.min(w - 2.4, x);
    const y0 = railY(px, o.rail + 1.6);
    const y1 = railY(px, 0);
    p.rect(px, y0, 1.8, y1 - y0, lf(iron, 0.45));
    p.rect(px, y0, 0.6, y1 - y0, lf(iron, 0.85));
    p.rect(px + 1.3, y0, 0.5, y1 - y0, lf(iron, 0.12));
    p.disc(px + 0.9, y0 - 0.6, 1.1, 1, (_X, _Y, u, v) => lf(iron, 0.6 - (u + v) * 0.3));
    if (d >= 2 && o.mid) {
      // A cast ring between the posts at mid height.
      const cx = px + o.postEvery / 2;
      if (cx < w - 3) {
        const cy = railY(cx, o.rail * 0.5);
        p.disc(cx, cy, 2.4, 2.4, (_X, _Y, u, v) => (u * u + v * v > 0.55 ? lf(iron, 0.55 - (u + v) * 0.2) : 0));
      }
    }
  }
  thick(0, 1, 0.5);
  if (o.mid) thick(o.rail * 0.5 + 0.4, 0.7, 0.55);
  thick(o.rail, 1.3, 0.92);
  // Wear: a little rust bleeding from the rail feet onto the coping (4×).
  if (d >= 4) {
    for (let x = 6; x < w; x += 23) {
      const b = base(x);
      p.rect(x, b - o.cope, 0.5, o.cope * 0.7, mx(T('rust', 1, 2), lf(gr, 0.4), 0.4, d));
    }
  }
  void SKY_CAST;
}

function drawRailBack(p: Pen): void {
  const s = 0.866;
  railing(p, { hump: HUMP * s, cope: 2.4, rail: 20, pitch: 2.6, postEvery: 32, mid: true, seed: 3 });
  // Bikes chained to the railing (true size), standing on the deck at the coping.
  const w = p.w;
  const h = p.h;
  const bikes: readonly [number, BikeKind, boolean][] = [
    [18, 'black', false],
    [74, 'child-seat', true],
    [140, 'rusty', false],
  ];
  for (const [x, kind, flip] of bikes) {
    const b = h - humpAt((x + 19) / w, HUMP * s);
    drawBike(p, x, b + 0.4, kind, { flip });
  }
}

function drawRailFront(p: Pen): void {
  const s = 1.117;
  railing(p, { hump: HUMP * s, cope: 3, rail: 15, pitch: 6, postEvery: 50, mid: false, seed: 5 });
}

reg('decor/oat/a/bridge-rail-back', [{ w: Math.round(SPAN * 0.866), h: 36, ox: 0, oy: 36 }], (p) => drawRailBack(p));
reg('decor/oat/a/bridge-rail-front', [{ w: Math.round(SPAN * 1.117), h: 34, ox: 0, oy: 34 }], (p) => drawRailFront(p));
