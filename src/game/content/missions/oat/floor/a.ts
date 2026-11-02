/**
 * The floor of oat-a DE 9 STRAATJES (STREET-A, wave A; docs/design/oat.md §2.1, §8.4, §8.7 a 6,
 * §8.10; docs/api/floor.md §3): the `FloorDef` the section file sets (`floor: OAT_A_FLOOR`).
 *
 * | u | stretch (layout.ts `A_STRETCHES`) |
 * |---|---|
 * | 0–320 | the Prinsengracht west quay: the quay paving up to the stone coping (the canal behind: the far bank, art) |
 * | 320–544 | bridge 65 (Berensluis): a herringbone deck over the hump, the canal under it in front (a water cut, the brick arch as the deck's face) |
 * | 544–1,568 | the Berenstraat: the far pavement (dikformaat, stretcher bond), the granite kerb, the one-way clinker street in herringbone, the near kerb, the grey tiles |
 * | 1,568–1,792 | bridge 48 over the Keizersgracht |
 * | 1,792–2,816 | the Wolvenstraat |
 * | 2,816–3,040 | bridge 25 over the Herengracht |
 * | 3,040–4,096 | the Oude Spiegelstraat (6.6 m: the deepest shade) |
 * | 4,096–4,352 | the Singel quay; 4,352–4,608 the Singel's row (the TE KOOP house, De Makelaar's arena) |
 *
 * Physics is untouched: the bridges are the terrain's hills (terrain.ts `bridgeStreet`); this file
 * only says how they look. Light: LIGHT-WATER's shade model (`sectionShade('oat-a')`) with the casters
 * of this section's decor (registered here, before any paint: one source of truth).
 */
import { vAtDepth } from '../../../../../engine/floor/cam';
import type { FloorDef, FloorFeature, FloorSurface, PropRowDef } from '../../../../mission/floor/types';
import type { DecorDef, TerrainStyleDef } from '../../../../mission/types';
import { A_DEPTH, OAT_A_DECOR } from '../art/place-a';
import { addShadeCasters, boxShape, castersFromDecor, defineCasterShape, elmShape, ensureWaterTiles, lanternShape, OAT_WATER, postShape, type ShadeCaster } from '../light/index';
import { OAT_SECTION } from '../ids';
import { G, OAT_A } from '../terrain';
import { A_STRETCHES, BACK_ROW, DECK_NEAR, FAR_KERB, FRONT_ROW, KERB_H, NEAR_KERB, OAT_CAMERA, WATER_LEVEL } from './layout';
import { ensureStreetPainter } from './painter';
import { ensureArchTile, OAT_KERB_FACE, OAT_QUAY_WALL, type OatBridge } from './tiles';

/** The canal's surface by day: LIGHT-WATER's calm morning water (spec §8.8: the morning mirror). */
export const A_WATER: FloorSurface = OAT_WATER.calm;

/** The three bridges (terrain.ts `OAT_A.bridges`, the hump +12; the water spans of layout.ts). */
export const A_BRIDGES: readonly OatBridge[] = A_STRETCHES.filter((s) => s.kind === 'bridge').map((s) => ({
  x0: s.u0,
  len: s.u1 - s.u0,
  hump: 12,
  water: s.water as readonly [number, number],
  name: s.name ?? `b${s.u0}`,
}));

/** The house stretches (Amsterdammertjes along both kerbs). */
const HOUSES: readonly (readonly [number, number])[] = A_STRETCHES.filter((s) => s.kind === 'house').map((s) => [s.u0, s.u1] as const);

/**
 * Where the front rows keep clear (docs/api/floor.md §3 `keepClear`): the player start, the bins, the
 * shop's goods, the spawn points and the golden record of section-a.ts, the organ, the arena's exit.
 */
export const A_KEEP_CLEAR: readonly number[] = [
  48, ...OAT_A.bins, OAT_A.haverbar[0] + 16, OAT_A.haverbar[1] - 16, 1000, 1100, OAT_A.conceptstore[0] + 32, OAT_A.recordX, OAT_A.hoistX, OAT_A.organX, ...OAT_A.checkpoints, OAT_A.bossX, OAT_A.w - 16,
];

/** The x of every decor item between depths lo and hi (the rows step round them). */
function decorAt(decor: readonly DecorDef[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (const it of decor) if (typeof it.depth === 'number' && it.depth >= lo && it.depth <= hi) out.push(it.x);
  return out;
}

/** Explicit positions along the house stretches: every `spacing` px, minus the gaps and the kept spots. */
function rowAt(spacing: number, offset: number, gaps: readonly (readonly [number, number])[], clear: readonly number[], clearDist: number): number[] {
  const at: number[] = [];
  for (const [u0, u1] of HOUSES) {
    for (let u = u0 + offset; u < u1 - 8; u += spacing) {
      if (gaps.some(([a, b]) => u >= a && u <= b)) continue;
      if (clear.some((c) => Math.abs(c - u) < clearDist)) continue;
      at.push(u);
    }
  }
  return at;
}

/** The Amsterdammertjes along the far kerb (back row) and the near kerb (front row, ≥ 34 px apart). */
export const A_BACK_POLES = rowAt(
  30,
  14,
  // The shop doors and the hoist warehouse keep their kerb free; the te-koop stoep projects.
  [
    [700, 772],
    [1176, 1248],
    [1896, 1968],
    [2196, 2284],
    [3416, 3488],
    [4352, 4480],
  ],
  decorAt(OAT_A_DECOR, 12.5, 15.4),
  10,
);
export const A_FRONT_POLES = rowAt(70, 34, [[OAT_A.arena[0] - 16, OAT_A.w]], [...A_KEEP_CLEAR, ...decorAt(OAT_A_DECOR, -16.5, -13)], 30);

/** The street floor's features: both kerbs, and at each bridge the canal under the deck (spec §8.2). */
function features(): FloorFeature[] {
  const out: FloorFeature[] = [
    { kind: 'kerb', to: FAR_KERB, dh: KERB_H, face: OAT_KERB_FACE },
    { kind: 'kerb', from: NEAR_KERB, dh: KERB_H, face: OAT_KERB_FACE },
  ];
  for (const b of A_BRIDGES) {
    const u0 = b.x0;
    const u1 = b.x0 + b.len;
    const [w0, w1] = b.water;
    // In front of the deck: the abutments at pavement height, the canal running toward the camera …
    out.push({ kind: 'cut', u0, u1, from: DECK_NEAR, level: KERB_H, face: OAT_QUAY_WALL });
    out.push({ kind: 'cut', u0: w0, u1: w1, from: DECK_NEAR, level: WATER_LEVEL, surface: A_WATER, face: OAT_QUAY_WALL });
    // … and the deck over the hump from the back edge (the vista's canal behind it) to its near railing.
    out.push({ kind: 'deck', u0, u1, to: DECK_NEAR, face: ensureArchTile(b, WATER_LEVEL) });
  }
  return out;
}

// ------------------------------------------------------------------------------------ the cast shadows

/** The shadow shapes of the street props (spec §8.2 true sizes; LIGHT-WATER's shapes). */
function registerCasterShapes(): void {
  defineCasterShape('decor/oat/a/lantern', lanternShape(4.3));
  defineCasterShape('decor/oat/a/elm-', elmShape(13, 4.6, 0.34));
  defineCasterShape('decor/oat/a/paal', postShape(0.75, 0.05));
  defineCasterShape('decor/oat/a/bike-', boxShape(1.8, 0.4, 0.95));
  defineCasterShape('decor/oat/a/staple', postShape(0.8, 0.03));
  defineCasterShape('decor/oat/a/waste-column', boxShape(0.6, 0.6, 1.25));
  defineCasterShape('decor/oat/a/power-box', boxShape(0.6, 0.4, 1.0));
  defineCasterShape('decor/oat/a/chalkboard', boxShape(0.55, 0.45, 0.9));
  defineCasterShape('decor/oat/a/plant-', postShape(0.8, 0.22));
  defineCasterShape('decor/oat/a/person-', postShape(1.75, 0.22));
  defineCasterShape('decor/oat/a/cafe-chair', postShape(0.9, 0.2));
}

/** The decor and the rows' poles as casters of oat-a's shade (added once). */
let castersAdded = false;
export function addOatACasters(): void {
  if (castersAdded) return;
  castersAdded = true;
  registerCasterShapes();
  const places = [
    ...OAT_A_DECOR.filter((it) => it.depth !== null).map((it) => ({ sprite: it.sprite, x: it.x, depth: it.depth ?? 0 })),
    ...A_BACK_POLES.map((x) => ({ sprite: 'decor/oat/a/paal', x, depth: BACK_ROW })),
    ...A_FRONT_POLES.map((x) => ({ sprite: 'decor/oat/a/paal', x, depth: FRONT_ROW })),
  ];
  const list: ShadeCaster[] = castersFromDecor(OAT_SECTION.a, places);
  addShadeCasters(OAT_SECTION.a, list);
}

// ------------------------------------------------------------------------------------ the FloorDef

/** The camera's depth unit (the walk line at G). */
const CAM = { yh: OAT_CAMERA.yh, yw: G, f: OAT_CAMERA.f };

/** oat-a's floor (built once; the casters registered before any chunk paints). */
export function oatAFloor(): FloorDef {
  ensureStreetPainter();
  ensureWaterTiles();
  addOatACasters();
  const rows: PropRowDef[] = [
    { name: 'back poles (far kerb)', sprite: 'decor/oat/a/paal', depth: BACK_ROW, at: A_BACK_POLES },
    { name: 'front poles (near kerb)', sprite: 'decor/oat/a/paal', depth: FRONT_ROW, at: A_FRONT_POLES },
  ];
  return {
    camera: { ...OAT_CAMERA },
    painter: { id: ensureStreetPainter(), params: { light: 'morning', section: OAT_SECTION.a }, seed: 11 },
    features: features(),
    baseFace: OAT_KERB_FACE,
    rows,
    skyLayers: ['oat-a-sky', 'oat-d-sky', 'sky-gradient', 'clouds'],
    shadow: 0.32,
    keepClear: A_KEEP_CLEAR,
    // The decor carries its own depth (art/place-a.ts); anything without one stands in the walk plane.
    decorDepth: (it) => (it.depth === undefined ? 0 : undefined),
  };
}

/** The floor v of a depth on this camera (the painter's bands; tests). */
export function aVAt(depth: number): number {
  return vAtDepth(CAM, depth);
}

/** oat-a's floor (built at import; section-a.ts sets it). */
export const OAT_A_FLOOR: FloorDef = oatAFloor();

/** The depth of the front decor items (re-exported for the tests' front-row check). */
export const A_FRONT_DEPTH = A_DEPTH.front;

/** oat-a's terrain style (the platforms and solids; the street itself is the floor's). */
export const OAT_A_STYLE: TerrainStyleDef = { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick', seed: 11 };
