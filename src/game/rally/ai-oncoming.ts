/**
 * The oncoming decor traffic (FIELD, wave B; docs/design/rally.md §3, §7.5; docs/api/rally.md
 * "B.F"): the cars on the other carriageway, beyond the central barrier — decor only (no bodies, no
 * contact, never in the sim): a fixed plan of cars per track (a fixed seed), each at a constant speed
 * in its lane, against our direction. The scenery part (content/rally/traffic/oncoming.ts) draws the
 * ones near each view as cheap boxes (headlights at night). Its density follows the race: light on
 * lap 1, busy on lap 3. Pure; deterministic (a fixed `Rng`, + − × ÷ only).
 */
import { Rng } from '../../engine/rng';

/** The oncoming lanes: side offsets (m, + = right of our centre line; the mirror of ours across the central barrier) and speeds (km/h). */
export const ONCOMING_LANES: readonly { readonly side: number; readonly kmh: number }[] = [
  { side: -10.6, kmh: 112 },
  { side: -14.1, kmh: 100 },
  { side: -17.6, kmh: 86 },
];

/** The kinds of decor vehicle: a car, a van, a lorry (their half length, half width, body height in m). */
export const ONCOMING_KINDS: readonly { readonly hl: number; readonly hw: number; readonly y0: number; readonly y1: number }[] = [
  { hl: 2.2, hw: 0.86, y0: 0.32, y1: 1.42 },
  { hl: 2.5, hw: 0.95, y0: 0.35, y1: 2.05 },
  { hl: 7.6, hw: 1.25, y0: 0.55, y1: 3.9 },
];

/** Cars per lane per kilometre of the loop (the busiest the road gets). */
const PER_KM: readonly number[] = [9, 12, 14];

/** One decor car: where it is at frame 0, its speed (m per frame at 60 frames a second), its lane, kind, colour and rank (0..1: it shows when the density is above it). */
export interface OncomingCar {
  readonly s0: number;
  readonly v: number;
  readonly lane: number;
  readonly kind: number;
  readonly skin: number;
  readonly rank: number;
}

/** The plan of a loop `length` m long: every decor car (deterministic; the same every time). */
export function oncomingPlan(length: number, skins: number): OncomingCar[] {
  const rng = new Rng('rally/oncoming');
  const out: OncomingCar[] = [];
  for (let lane = 0; lane < ONCOMING_LANES.length; lane++) {
    const n = Math.max(1, Math.round((PER_KM[lane] * length) / 1000));
    const v = ONCOMING_LANES[lane].kmh / 3.6 / 60;
    for (let i = 0; i < n; i++) {
      const s0 = ((i + rng.range(0.1, 0.9)) * length) / n;
      // Lorries stay out of the fast lane; vans now and then.
      const r = rng.next();
      const kind = lane > 0 && r < 0.18 ? 2 : r < 0.32 ? 1 : 0;
      out.push({ s0, v: v * (kind === 2 ? 0.85 : rng.range(0.95, 1.05)), lane, kind, skin: rng.int(0, skins - 1), rank: rng.next() });
    }
  }
  return out;
}

/** The arc length of a decor car at frame `t` (it drives against the track's direction). */
export function oncomingS(c: OncomingCar, length: number, t: number): number {
  const s = c.s0 - c.v * t;
  return s - Math.floor(s / length) * length;
}

/** How much of the plan shows at a race progress (laps from the start): about half on lap 1, all of it on lap 3. */
export function oncomingDensity(progress: number): number {
  const p = progress < 0 ? 0 : progress > 2.2 ? 2.2 : progress;
  return 0.45 + (0.55 * p) / 2.2;
}
