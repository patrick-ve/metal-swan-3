/**
 * The floor of `ams` c2 RONDVAART (docs/design/floor.md §4.4, §12.2 c2) — AMS-RIVER's folder (with c1).
 *
 * | u | stretch |
 * |---|---|
 * | 0–60 | the boarding quay: paved to its edge, its steps down to the water behind the walk line, the lamp and the RONDVAART sign on the far side |
 * | 60–2492 | the Amstel over the whole band (the boat carries the camera), its far rows fading into the far bank layer's water (water.ts); its fairway in front (the boat's beam, the party boat) kept free; mooring piles behind it; the far bank's quay lifted with its layer; the houseboat at the far quay (its tourist and gulls on its platforms) a box |
 * | 700, 1660 | the low bridges: from their slab face at the walk line (in front of the world as today) back over the river to the far bank, their walkway between low brick parapets, two brick piers just behind the fairway with the dark of the arch between them, the river in the deck's shade under it, the far arch on the bank (bridges.ts, water.ts) |
 * | 2000–2120 | the Magere Brug: the bascule's walkway to the far bank, the white portals near (their tops over the receding walkway) and far |
 * | 2492–2632 | the Waterlooplein jetty: paved, its steps down to the water, the lamp behind them, the WATERLOOPLEIN sign in front of them (it reads whole), a market stall right of it, the flag |
 *
 * Physics is untouched (spec §0.1): the river is the terrain's gap and water hazard, the boats and the
 * bridges are entities with their own solids. Street logic (spec §11 R2; common-b.md 4): in c2 "the
 * street" is the river and its quays — the fairway (the layout's `lane` over the river: its paint never
 * shows, the river's cut has its own surface) keeps everything off where a boat sails but boats and
 * ducks; the piles stand behind it, the furniture on the quays. The ducks (`ams-ducks`, cosmetic) paddle
 * behind the fairway (`C2_DUCK_DEPTH`, the floor's `entityDepth`).
 */
import { sAtDepth } from '../../../../../../engine/floor/cam';
import type { FloorDef, FloorFeature, TopFaceDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { LOW_BRIDGE, MAGERE_BRUG } from '../../cruise';
import { C2_FAR_ROOF_Y, C2_HOUSEBOAT, C2_RIVER, C2_W, DECK_Y, G, ROOF_Y } from '../../terrain';
import { amsDecorDepth } from '../depth';
import { amsEntityFaces } from '../entities';
import { floorOnly, kitDecor, kitFloor } from '../guard';
import { AMS_BACK, AMS_CAMERA, stepFeatures, streetFeatures, WATER_LEVEL, type StreetLayout } from '../layout';
import { BOAT_CABIN, BOAT_HULL, BOAT_ROOF } from '../section-a';
import { boatSides } from '../sides';
import { stallFaces } from '../c1/market';
import { C2_BRIDGE_BACK, C2_BRIDGE_HALF, c2LowBridgeFaces, ensureFarArch, ensureFarPortals, ensureNearPortals } from './bridges';
import { C2_PILE } from './pile';
import { c2RiverSurface, c2ShadeSurface } from './water';

export { C2_BRIDGE_BACK, c2LowBridgeFaces } from './bridges';

/** The switch: c2 draws its floor (wave B, AMS-RIVER). */
export const C2_FLOOR_ON = true;

const [R0, R1] = C2_RIVER;

/** The fairway's far edge (DEPTH): the cruise boat's beam (30 world px behind its sprite) and a margin. */
export const C2_FAIRWAY_FAR = 16;
/** The quays' far and near lines: no kerbs (paved to the back edge and to the front). */
const QUAY_BACK = AMS_BACK;
const QUAY_FRONT = -45;

/** The low bridges and the Magere Brug (section-c2.ts C2_BRIDGES, C2_MAGERE_X: literals, no import cycle). */
export const C2_LOW_BRIDGES: readonly number[] = [700, 1660];
export const C2_MAGERE: number = 2060;

/** The mooring piles: their depth (behind the fairway) and where they stand (not at the bridges, the houseboat or the quays). */
export const C2_PILE_DEPTH = 25;
const PILE_GAPS: readonly (readonly [number, number])[] = [
  [R0, R0 + 50],
  [C2_LOW_BRIDGES[0] - 60, C2_LOW_BRIDGES[0] + 60],
  [C2_HOUSEBOAT.x0 - 30, C2_HOUSEBOAT.x0 + C2_HOUSEBOAT.w + 30],
  [C2_LOW_BRIDGES[1] - 60, C2_LOW_BRIDGES[1] + 60],
  [C2_MAGERE - 90, C2_MAGERE + 90],
  [R1 - 50, R1],
];
export const C2_PILES: readonly number[] = ((): number[] => {
  const out: number[] = [];
  for (let u = R0 + 66; u < R1; u += 84) if (!PILE_GAPS.some(([a, b]) => u >= a && u <= b)) out.push(u);
  return out;
})();

/** The street layout of c2: the paved quays, the river's fairway between them. */
export const C2_LAYOUT: StreetLayout = {
  light: 'golden',
  far: [
    [R0 - 0.5, QUAY_BACK],
    [R0 + 0.5, C2_FAIRWAY_FAR],
    [R1 - 0.5, C2_FAIRWAY_FAR],
    [R1 + 0.5, QUAY_BACK],
  ],
  near: QUAY_FRONT,
  street: [
    { u0: -1e9, kind: 'tiles' },
    // The fairway: kept free (roadwayAt); never painted (the river's cut has its own surface).
    { u0: R0, kind: 'lane' },
    { u0: R1, kind: 'tiles' },
  ],
  crossings: [],
  quays: [[-1e9, 1e9]],
  bridges: [],
  canals: [],
  bikes: { every: 0, phase: 0 },
};

/** The ducks' depth: behind the fairway (`C2_FAIRWAY_FAR`), in front of the mooring piles. */
export const C2_DUCK_DEPTH = 20;
/** The quays' steps down to the water: their near and far depth (DEPTH). */
const STEPS: readonly [number, number] = [10, 26];
/** The jetty's market stall (the section's 2D stall at C2_W − 30, moved right of the WATERLOOPLEIN sign) and its depth. */
export const C2_JETTY_STALL: readonly [number, number] = [C2_W + 20, 15];

/** Where the front rows keep clear (c2 has none). */
export const C2_KEEP_CLEAR: readonly number[] = [];

/** The houseboat at the far quay as a box (spec §11 R1): the hull and cabin ends, the deck and roof tops. */
const FAR_DECK_Y = C2_FAR_ROOF_Y + DECK_Y - ROOF_Y;
/** Its hull's art reaches 25 px under its deck (art.ts `houseboatSprite`). */
const HULL_FOOT = 25;

/** Where c2's decor stands in depth on the floor (spec §1.3; `DecorDef.depth` wins). */
export function c2DecorDepth(d: DecorDef): number | null | undefined {
  const s = d.sprite;
  // Carré rides on the far bank's layer: up with its lift.
  if (s === 'decor/ams/carre') return G - AMS_CAMERA.back;
  // The low bridges' back sprite: replaced (its vault stays as floor decor; the parapets are faces); the front bollard: none.
  // The Magere Brug's portals: split at the walkway's line (floor decor: tops over the receding walkway).
  if (s === 'decor/ams/low-bridge/back' || s === 'decor/ams/bollard' || s === 'decor/ams/magere-brug/back') return null;
  // The quays' steps down to the water lie 10 … 26 deep (`STEPS`): the furniture stands off them.
  // The jetty's lamp behind its steps; the boarding quay's in front of the tree line.
  if (s === 'decor/ams/lamp') return d.x > R1 ? STEPS[1] + 1 : 22;
  // The RONDVAART sign stood at the quay's edge (its board over the water): moved onto the quay (floor decor).
  if (s === 'decor/ams/route-sign' && d.x < R0) return null;
  // The WATERLOOPLEIN sign in front of the jetty's steps, where the heroes step off the boat (it reads whole).
  if (s === 'decor/ams/route-sign') return STEPS[0] - 1;
  // The jetty's market stall: moved right of the sign (floor decor, `C2_JETTY_STALL`), so it hides no letter.
  if (s === 'decor/ams/market-stall') return null;
  return amsDecorDepth(d);
}

/** The FloorDef of c2 (`decor`: the section's decor list). */
export function c2FloorDef(decor: readonly DecorDef[]): FloorDef {
  void decor;
  const L = C2_LAYOUT;
  const hb = C2_HOUSEBOAT;
  const tops: TopFaceDef[] = [
    { x0: hb.x0 + 1, x1: hb.x0 + hb.w - 1, y: FAR_DECK_Y, depth: BOAT_HULL, tile: 'ams/boat-deck' },
    { x0: hb.cx - 2, x1: hb.cx + hb.cw + 2, y: C2_FAR_ROOF_Y, depth: BOAT_ROOF, tile: 'ams/boat-roof' },
  ];
  return {
    camera: { ...AMS_CAMERA },
    painter: { id: 'ams/floor', params: { layout: L }, seed: 19 },
    features: [
      ...streetFeatures(L),
      // The river (its far rows fade into the far bank layer's water: water.ts), and the shade under each low bridge's deck.
      { kind: 'cut', u0: R0, u1: R1, level: WATER_LEVEL, surface: c2RiverSurface(), face: 'ams/quay-wall' },
      ...C2_LOW_BRIDGES.map((x): FloorFeature => ({ kind: 'cut', u0: x - C2_BRIDGE_HALF, u1: x + C2_BRIDGE_HALF, to: 0, level: WATER_LEVEL, surface: c2ShadeSurface() })),
      // The quays' steps down to the water, behind the walk line.
      ...stepFeatures({ u0: R0 - 28, u1: R0, dir: 1, top: 0, bottom: WATER_LEVEL + 0.6, n: 2, from: STEPS[1], to: STEPS[0] }),
      ...stepFeatures({ u0: R1, u1: R1 + 28, dir: -1, top: 0, bottom: WATER_LEVEL + 0.6, n: 2, from: STEPS[1], to: STEPS[0] }),
    ],
    baseFace: 'ams/kerb-face',
    rows: [{ name: 'mooring piles', prop: C2_PILE, depth: C2_PILE_DEPTH, at: C2_PILES }],
    tops,
    faces: [
      ...boatSides([hb], { deckY: FAR_DECK_Y, roofY: C2_FAR_ROOF_Y, bottom: G - FAR_DECK_Y - HULL_FOOT, hull: BOAT_HULL, cabin: BOAT_CABIN }),
      stallFaces(C2_JETTY_STALL[0], C2_JETTY_STALL[1], 1),
    ],
    // The boats, the low bridges and the bascule show their sides and tops (spec §12.1 item 4).
    entityFaces: {
      ...amsEntityFaces(['ams-cruise-boat', 'ams-party-boat', 'ams-magere-brug'], { magere: { back: C2_BRIDGE_BACK } }),
      'ams-low-bridge': c2LowBridgeFaces(),
    },
    // The ducks paddle behind the fairway, out of the boat's way (spec §12.2 c2 "ducks at their depth";
    // cosmetic: no hitbox, no damage — spec §3.7 allows the depth).
    entityDepth: { 'ams-ducks': () => C2_DUCK_DEPTH },
    decorDepth: c2DecorDepth,
    hideDecor: ['decor/ams/water-'],
    shadow: 0.3,
    keepClear: C2_KEEP_CLEAR,
  };
}

/** The section's `floor`: the def while the switch is on, else none (fail soft: a kit that throws gives none, logged). */
export function c2Floor(decor: readonly DecorDef[]): FloorDef | undefined {
  return C2_FLOOR_ON ? kitFloor('ams/c2', () => c2FloorDef(decor)) : undefined;
}

/**
 * Decor only the floor draws: the low bridges' far arches and the Magere Brug's far portals (pre-scaled,
 * on the far bank's depth), the quays' furniture on their far sides.
 */
export function c2FloorDecor(): DecorDef[] {
  return C2_FLOOR_ON
    ? kitDecor('ams/c2', () => {
        const back = C2_BRIDGE_BACK;
        const s = sAtDepth({ yh: AMS_CAMERA.yh, yw: G }, back);
        // Decor at a depth is drawn at y − depth (no lift over the river): its walkway on the true one there.
        const walk = (top: number): number => AMS_CAMERA.yh + (top - AMS_CAMERA.yh) * s + back;
        return floorOnly([
          ...C2_LOW_BRIDGES.map((x): DecorDef => ({ sprite: ensureFarArch(s), x, y: walk(LOW_BRIDGE.top), depth: back })),
          { sprite: ensureFarPortals(s), x: C2_MAGERE, y: walk(MAGERE_BRUG.top), depth: back },
          { sprite: ensureNearPortals('foot'), x: C2_MAGERE, y: MAGERE_BRUG.top, depth: 0 },
          { sprite: ensureNearPortals('top'), x: C2_MAGERE, y: MAGERE_BRUG.top, front: true, depth: 0 },
          // The RONDVAART sign on the boarding quay, in front of its steps (its board over the quay, not the water).
          { sprite: 'decor/ams/route-sign', frame: 1, x: 20, y: G, depth: STEPS[0] - 1 },
          { sprite: 'decor/ams/market-stall', frame: 1, x: C2_JETTY_STALL[0], y: G, depth: C2_JETTY_STALL[1] },
          // The boarding quay's furniture (seen at the start), the jetty's.
          { sprite: 'decor/ams/elm', x: -72, y: G, depth: 27 },
          { sprite: 'decor/ams/bench', x: -36, y: G, depth: 25 },
          { sprite: 'decor/ams/bike', frame: 2, x: -6, y: G, depth: 21 },
          { sprite: 'decor/ams/bench', x: R1 + 52, y: G, depth: 25 },
          { sprite: 'decor/ams/bike', frame: 1, x: R1 + 96, y: G, depth: 21 },
          { sprite: 'decor/ams/flag-ams', x: R1 + 124, y: G, animate: true, depth: 27 },
          { sprite: 'decor/ams/tulips', x: C2_W + 14, y: G, animate: true, depth: 24 },
          { sprite: 'decor/ams/elm', x: C2_W + 54, y: G, depth: 27 },
        ]);
      })
    : [];
}
