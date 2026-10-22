/**
 * The pink boat's effects (`boss/ring-boot/…`; docs/design/ring.md §R.7): bloodless and bright.
 * ONE density-generic drawer per strip, every frame cropped to its 1× box; outline A for the things
 * that hurt (the balloon, the shock), the splat and the rings without ink.
 *
 * | id | frames | what |
 * |---|---|---|
 * | `balloon-<0\|1\|2>` | 2 | a paint balloon flying, wobbling (pink, yellow, sky; centre anchor) |
 * | `splat-<0\|1\|2>` | 4 | a balloon bursting on the asphalt: bright paint (never red), drops (anchor: the ground) |
 * | `shock` | 4 | the drum beat's ground shock rolling along the road: a dust wave with sound arcs (anchor: the ground under its middle) |
 * | `ring` | 3 | the megaphone's sound ring (the call's tell; centre anchor, drawn additive) |
 */
import type { Frame } from '../../../../engine/render';
import { defStrip, Pen } from '../boss/art-kit';
import { finishA, mat, type Dn } from '../../stag/kit.art';
import { BOAT_SPR } from './art-hull';

const S = (name: string): string => `${BOAT_SPR}/${name}`;

export const FX_SPR = { balloon: (col: number) => S(`balloon-${col}`), splat: (col: number) => S(`splat-${col}`), shock: S('shock'), ring: S('ring') } as const;

/** The balloons' and splats' paints (bright, never red). */
export const PAINTS = ['pink', 'gold', 'sky'] as const;

export function balloonFrame(i: number, k: number, d: Dn): Frame {
  const p = new Pen(-5, -5, 10, 10, d);
  const c = p.c;
  const rub = mat(c, PAINTS[i], { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 2, hi: 6, rim: 0.4 });
  // A sloshing blob (it wobbles: frame k), the knot trailing.
  p.ellipsoid(0, 0, 3.6 - k * 0.4, 3.2 + k * 0.4, { mat: rub, z: 2 });
  p.ellipsoid(2.6, 2.4, 0.9, 0.9, { mat: rub, z: 2.2 });
  return p.frame(finishA(c, 0.1));
}

export function splatFrame(k: number, col: number, d: Dn): Frame {
  const p = new Pen(-12, -12, 24, 13, d);
  const c = p.c;
  const paint = mat(c, PAINTS[col], { spec: 1, shine: 50, lo1: 0, hi1: 2, lo: 2, hi: 6, wrap: 0.2 });
  const spread = [0.5, 1, 1.15, 1.2][k];
  // The puddle flattening on the road and the drops flying out (fewer, lower, later).
  p.field(-10, -3, 20, 3.2, (x, y) => {
    const r = Math.hypot(x / (9 * spread), (y + 0.8) / 1.6);
    const lobe = 0.8 + 0.2 * Math.sin(Math.atan2(y, x) * 5 + col);
    return r < lobe ? (lobe - r) * 1.5 : NaN;
  }, { mat: paint, z: 1 });
  if (k < 3) {
    for (let j = 0; j < 5; j++) {
      const a = Math.PI * (0.12 + j * 0.19);
      const dist = [3, 6, 8][k] + j * 0.6;
      p.ellipsoid(Math.cos(a) * dist * 1.2, -Math.sin(a) * dist * 0.9 - 1, 1.1 - k * 0.2, 1.1 - k * 0.2, { mat: paint, z: 2 });
    }
  }
  return p.frame(c.render({ outline: 'none', ao: 0 }));
}

export function shockFrame(k: number, d: Dn): Frame {
  const p = new Pen(-12, -14, 24, 15, d);
  const c = p.c;
  const dust = mat(c, 'sand', { spec: 0, lo1: 1, hi1: 3, lo: 2, hi: 6, wrap: 0.4 });
  const arc = mat(c, 'snow', { spec: 0, lo1: 2, hi1: 3, lo: 4, hi: 6, flat: true });
  // A rolling dust wave: a fat curl, its crest leaning forward (left), with grit.
  const lean = [0, 1.5, 3, 1.5][k];
  p.field(-10, -10, 20, 10, (x, y) => {
    const u = (x + 10) / 20;
    const hgt = Math.sin(u * Math.PI) * (7 + (k % 2)) ;
    const top = -hgt - (u < 0.5 ? lean * (0.5 - u) : 0);
    return y >= top && y <= 0 ? Math.sqrt(Math.max(0, 1 - ((y - top / 2) / (top / 2 || 1)) ** 2)) * 2 : NaN;
  }, { mat: dust, z: 1 }, (t, x, y) => {
    if ((Math.floor(x * 3 + k * 5) * 7 + Math.floor(y * 3)) % 11 === 0) t.tone -= 0.4;
  });
  // Two sound arcs riding the crest (the drum's boom).
  for (let j = 0; j < 2; j++) {
    const r = 4 + j * 3 + (k % 2);
    p.field(-12, -14, 10, 12, (x, y) => {
      const e = Math.hypot(x + 2, y + 6);
      return Math.abs(e - r) < 0.55 && x < -2 - j && y < -2 ? 1 : NaN;
    }, { mat: arc, z: 3 });
  }
  return p.frame(finishA(c, 0));
}

export function ringFrame(k: number, d: Dn): Frame {
  const p = new Pen(-10, -10, 20, 20, d);
  const c = p.c;
  const glow = mat(c, 'gold', { spec: 0, lo1: 2, hi1: 3, lo: 4, hi: 6, flat: true });
  const r = 3 + k * 2.6;
  // Arcs opening forward (left: the megaphone points at the heroes).
  p.field(-10, -10, 20, 20, (x, y) => {
    const e = Math.hypot(x, y);
    return Math.abs(e - r) < 0.7 && x < -Math.abs(y) * 0.35 ? 1 : NaN;
  }, { mat: glow, z: 1 });
  return p.frame(c.render({ outline: 'none', ao: 0 }));
}

for (const col of [0, 1, 2]) {
  defStrip(FX_SPR.balloon(col), (d) => [0, 1].map((k) => balloonFrame(col, k, d)), { ticksPerFrame: 6 });
  defStrip(FX_SPR.splat(col), (d) => [0, 1, 2, 3].map((k) => splatFrame(k, col, d)), { ticksPerFrame: 5, loop: false });
}
defStrip(FX_SPR.shock, (d) => [0, 1, 2, 3].map((k) => shockFrame(k, d)), { ticksPerFrame: 4 });
defStrip(FX_SPR.ring, (d) => [0, 1, 2].map((k) => ringFrame(k, d)), { ticksPerFrame: 5, loop: false });
