/**
 * Small car textures shared by every model (docs/design/rally.md §7.4): the rim faces (wheel covers,
 * five-spoke alloys, steel wheels, chrome hubcaps), the tyre tread, a round spot lamp's face and the
 * glass painter (the dark interior low, the glass, the era's diagonal highlight streak). Palette
 * slots of tex/car-palette.ts. Pure; deterministic (+ − × ÷, Math.sqrt / floor, the r3 trig tables).
 */
import { atan2T, TAU } from '../../../../engine/r3/trig';
import { S } from './car-palette';
import type { CarSheet } from './car-sheet';
import type { TexRect } from './kit';

export type WheelStyle = 'cover' | 'alloy' | 'steel' | 'chrome';

/** The rim face (WHEEL_TEX square = the tyre's full diameter). */
export function paintWheel(sh: CarSheet, style: WheelStyle): void {
  const r = sh.wheel;
  const c = r.w / 2;
  sh.paintRect(r, (i, j) => {
    const dx = i + 0.5 - c;
    const dy = j + 0.5 - c;
    const d = Math.sqrt(dx * dx + dy * dy) / c; // 0 centre … 1 the tyre's edge
    if (d > 0.97) return S.BLACK;
    if (d > 0.68) return d > 0.9 || d < 0.74 ? S.BLACK : S.PLASTIC; // the sidewall with a lighter band
    const a = atan2T(dy, dx); // −π … π
    switch (style) {
      case 'cover': {
        if (d > 0.6) return S.SILVER;
        if (d < 0.16) return S.PLASTIC;
        // Eight slots round the cover.
        const k = ((a + TAU) * 8) / TAU;
        const f = k - Math.floor(k);
        return d > 0.3 && d < 0.5 && f > 0.35 && f < 0.65 ? S.PLASTIC : dy < 0 ? S.LENS : S.SILVER;
      }
      case 'alloy': {
        if (d > 0.6) return S.SILVER;
        if (d < 0.18) return dy < 0 ? S.LENS : S.SILVER;
        const k = ((a + TAU) * 5) / TAU;
        const f = k - Math.floor(k);
        return f < 0.3 || f > 0.86 ? (dy < 0 ? S.LENS : S.SILVER) : S.BLACK;
      }
      case 'steel': {
        if (d > 0.58) return S.PLASTIC;
        if (d < 0.22) return S.SILVER;
        return d < 0.3 ? S.BLACK : S.PLASTIC;
      }
      case 'chrome': {
        if (d < 0.12) return S.PLASTIC;
        return dy < -1 && dx < 2 ? S.LENS : d > 0.55 ? S.SILVER : d < 0.35 ? S.LENS : S.SILVER;
      }
    }
  });
}

/** The tyre tread: black with lighter grooves across it (tread blocks). */
export function paintTread(sh: CarSheet): void {
  sh.paintRect(sh.tread, (i, j) => ((j & 3) === 0 && i > 0 && i < 7 ? S.PLASTIC : S.BLACK));
}

/** A round spot lamp's face on a black square: a silver rim, the lens and a grille (`grille`). */
export function paintSpotLamp(sh: CarSheet, r: TexRect, grille = true): void {
  const c = r.w / 2;
  sh.paintRect(r, (i, j) => {
    const dx = i + 0.5 - c;
    const dy = j + 0.5 - (r.h / 2);
    const d = Math.sqrt(dx * dx + dy * dy) / c;
    if (d > 1) return S.BLACK;
    if (d > 0.78) return S.SILVER;
    if (grille && (i === Math.floor(c) || j === Math.floor(r.h / 2))) return S.BLACK;
    return dx < 0 && dy < 0 ? S.LENS : S.GLASS_L;
  });
}

/**
 * Glass at a texel: `depth` 0 at the glass' foot … 1 at its top (the interior is dark low down),
 * `streak` a coordinate along the glass (the diagonal highlight repeats along it).
 */
export function glassAt(depth: number, streak: number, i: number, j: number): number {
  const t = streak - Math.floor(streak);
  if (t < 0.07) return S.GLASS_L;
  if (t > 0.11 && t < 0.14 && ((i + j) & 1) === 0) return S.GLASS_L;
  if (depth < 0.3) return ((i + j) & 1) === 0 && depth > 0.2 ? S.GLASS : S.GLASS_D;
  return S.GLASS;
}
