/**
 * The floor of oat-d DE WALLEN BY NIGHT (STREET-A, wave A: the night proof strip 0–1,280;
 * docs/design/oat.md §2.5, §8.7 d 4–5, §8.9, §8.10; docs/api/floor.md §3): the `FloorDef` the
 * section file sets (`floor: OAT_D_FLOOR`).
 *
 * The quay street of the Oudezijds Achterburgwal: our row behind (back edge y 160), a narrow
 * pavement at its foot (stretcher-bond bricks, a granite kerb), the quay street in wet herringbone at
 * the walk line, the stone coping at about y 192 (depths −14 … −16.5) and the canal in front of it
 * to the screen bottom (a water cut: LIGHT-WATER's night water; its streaks are the light pass's).
 * The painter bakes the lamps' light into the wet brick (floor/painter.ts `D_LIGHTS`). NIGHT (wave
 * C) gives the bridge, the alley, the Voorburgwal and the square their own floors; until then the
 * same quay runs through the whole section so it stays walkable and viewable.
 */
import type { FloorDef, FloorFeature, PropRowDef } from '../../../../mission/floor/types';
import type { DecorDef, TerrainStyleDef } from '../../../../mission/types';
import { D_ALLEYS, D_STRIP, OAT_D_DECOR } from '../art/place-d';
import { ensureWaterTiles, OAT_WATER } from '../light/index';
import { OAT_SECTION } from '../ids';
import { D_COPING_NEAR, D_FAR_KERB, KERB_H, OAT_CAMERA, WATER_LEVEL } from './layout';
import { ensureStreetPainter } from './painter';
import { OAT_D_QUAY_WALL, OAT_KERB_FACE } from './tiles';

/** The back row's depth on the d pavement (Amsterdammertjes along the kerb). */
const D_BACK_ROW = D_FAR_KERB + 0.6;

/** The x of every decor item between depths lo and hi. */
function decorAt(decor: readonly DecorDef[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (const d of decor) if (typeof d.depth === 'number' && d.depth >= lo && d.depth <= hi) out.push(d.x);
  return out;
}

/** The Amsterdammertjes along the d strip's kerb (clear of the bikes, bins, masts and the alley mouths). */
export const D_BACK_POLES: readonly number[] = (() => {
  const busy = [...decorAt(OAT_D_DECOR, 12, 15.4), ...D_ALLEYS];
  const at: number[] = [];
  for (let u = D_STRIP[0] + 18; u < D_STRIP[1]; u += 32) if (!busy.some((b) => Math.abs(b - u) < 14)) at.push(u);
  return at;
})();

function features(): FloorFeature[] {
  return [
    { kind: 'kerb', to: D_FAR_KERB, dh: KERB_H, face: OAT_KERB_FACE },
    // The canal in front of the coping (spec §2.5: the near coping at about y 192, water to the bottom).
    { kind: 'cut', from: D_COPING_NEAR, level: WATER_LEVEL, surface: OAT_WATER.night, face: OAT_D_QUAY_WALL },
  ];
}

/** oat-d's floor (the proof strip's quay through the whole section). */
export function oatDFloor(): FloorDef {
  ensureStreetPainter();
  ensureWaterTiles();
  const rows: PropRowDef[] = [{ name: 'back poles (kerb)', sprite: 'decor/oat/d/paal', depth: D_BACK_ROW, at: D_BACK_POLES }];
  return {
    camera: { ...OAT_CAMERA },
    painter: { id: ensureStreetPainter(), params: { light: 'night', section: OAT_SECTION.d }, seed: 23 },
    features: features(),
    baseFace: OAT_KERB_FACE,
    rows,
    skyLayers: ['oat-d-sky', 'oat-a-sky', 'sky-gradient', 'clouds'],
    shadow: 0.4,
    keepClear: [48, 400, 1200, 1280],
    decorDepth: (it) => (it.depth === undefined ? 0 : undefined),
  };
}

/** oat-d's floor (built at import; section-d.ts sets it). */
export const OAT_D_FLOOR: FloorDef = oatDFloor();

/** oat-d's terrain style (platforms and solids; the street is the floor's). */
export const OAT_D_STYLE: TerrainStyleDef = { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick', seed: 23 };
