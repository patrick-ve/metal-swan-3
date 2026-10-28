/**
 * The floor of `ams` d STOPERA (docs/design/floor.md §4.4 d, §12.2 d) — AMS-D's folder: the street
 * layout of the section and its FloorDef (section-d.ts sets `floor: dFloor(decor)` and spreads
 * `dFloorDecor()` into its decor list).
 *
 * | u | stretch |
 * |---|---|
 * | 0–860 | the Waterlooplein flea market: the house fronts at 14 behind their pavement (kerb 11, the lamp and the flag on it, Amsterdammertjes on its kerb); the market's SQUARE of cobbles in fans in front of it — the far pavement widened past the walk line, flush (the kit's bulb, spec §11 R2): the back stalls stand on it as boxes (`STALL_DEPTH`), and in the walk plane the breakable stalls, the bike rack, the crates, the chest and the lamp the gull sleeps on (the breakables and crates draw their own faces); a flush granite edge, then a cobbled street (the roadway: nothing stands in it), the near kerb, the near pavement with the front row of poles at the market's edge (gaps in front of the stalls and the rack the heroes fight at) and the parked bikes |
 * | 824–860 | the house kerb and the street's far edge bend back behind the Stopera's facade (≥ 32 px): the street opens into the forecourt |
 * | 860–1280 | the Stopera's forecourt: big pale stone slabs in a grid from the facade (`STOPERA_DEPTH`) to the near kerb, the near pavement on; the Stopera with its sides and its glass doors in depth (stopera.ts); ROBO-HALSEMA steps out of them in the walk plane (art and hitbox together, spec §3.7); the planter and the flags on the forecourt; no front row in the arena |
 *
 * Physics is untouched (spec §0.1): the terrain is flat; this folder only says how it looks. Street
 * logic (spec §11 R2): nothing stands in the cobbled street but traffic (the riders, the handhavers'
 * bikes); whatever the script keeps in the walk plane stands on the square or the forecourt.
 */
import type { FloorDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { amsDecorDepth } from '../depth';
import { amsEntityFaces } from '../entities';
import { floorOnly, kitDecor, kitFloor } from '../guard';
import { AMS_BACK, AMS_CAMERA, BULB_FAR, FAR_KERB_TOP, HOUSE_FRONT_ROW, HOUSE_NEAR, KERB_H, poleRow, streetFeatures, type Bulb, type StreetLayout } from '../layout';
import { houseSides } from '../sides';
import { marketStallSides, planterSides } from './market';
import { stoperaDecor, stoperaSides } from './stopera';

export { STALL_DEPTH } from './market';
export { DOORS_U, STOPERA_DEPTH, STOPERA_X } from './stopera';

/** The switch: d draws its floor (wave B, AMS-D). */
export const D_FLOOR_ON = true;

/** The house fronts' pavement: its kerb (the facades at FACADE 14), its street furniture and the back poles on its kerb top. */
export const D_HOUSE_KERB = 11;
export const D_PAVEMENT = 12.5;
const D_BACK_ROW = D_HOUSE_KERB + 0.7;
/** The market's square reaches to the cobbled street in front of it (a flush granite edge, the kit's bulb line) … */
export const D_SQUARE_EDGE = BULB_FAR;
/** … the street's near kerb, and the front row of poles on the near pavement (the market's edge). */
export const D_NEAR = HOUSE_NEAR;
export const D_FRONT_ROW = HOUSE_FRONT_ROW;
/**
 * The market ends here: the house kerb and the street's far edge bend back over ≥ 32 px (spec §4.4) to
 * behind the Stopera's facade, and the Stopera's forecourt begins (a granite band across the floor): the
 * cobbled street opens into it. The near kerb and its pavement run on along the whole section.
 */
const BEND: readonly [number, number] = [824, 860];
export const FORECOURT_U = BEND[1];
const FAR_ARENA = 18;
const line = (market: number, arena: number): [number, number][] => [
  [BEND[0], market],
  [BEND[1], arena],
];
/** The house kerb line (the pavement along the facades). */
const HOUSE_LINE = line(D_HOUSE_KERB, FAR_ARENA);

/**
 * The market's square is the far pavement widened past the walk line (the kit's flush bulb, spec §11
 * R2): the stalls, the rack, the crates, the chest and the lamp the gull sleeps on stand on it in the
 * walk plane; its surface is a fan of cobbles (an area) up to the flush granite edge at the street.
 */
const MARKET: Bulb = { u0: -1e9, u3: BEND[1], far: line(D_SQUARE_EDGE, FAR_ARENA), near: [[BEND[0], D_NEAR]] };

export const D_LAYOUT: StreetLayout = {
  light: 'sunset',
  far: line(D_SQUARE_EDGE, FAR_ARENA),
  near: D_NEAR,
  bulbs: [MARKET],
  street: [
    { u0: -1e9, kind: 'cobbles' },
    { u0: FORECOURT_U, kind: 'stone' },
  ],
  crossings: [],
  quays: [],
  bridges: [],
  canals: [],
  bikes: { every: 220, phase: 60 },
  areas: [
    // The square (the cobbles in fans) up to the granite edge's top; the house kerb's granite top behind it.
    { u0: -1e9, u1: BEND[1], far: HOUSE_LINE, near: line(D_SQUARE_EDGE + FAR_KERB_TOP, FAR_ARENA + FAR_KERB_TOP), kind: 'fan' },
    { u0: -1e9, u1: BEND[1], far: line(D_HOUSE_KERB + FAR_KERB_TOP, FAR_ARENA + FAR_KERB_TOP), near: HOUSE_LINE, kind: 'granite' },
  ],
};

/** The breakable stalls (section-d.ts `script`: 200, 560) and the breakable bike rack (336) by the front decor rack (330). */
const STALLS = [200, 560];
const RACK: readonly [number, number] = [330, 336];
/** The front row keeps this far from a stall's or the rack's centre (spec §12.2 d: never in front of a stall a hero fights at). */
const STALL_GAP = 46;
const RACK_GAP = 44;

/**
 * Where the front rows keep clear (spec §3.6): the script's spawn points, pickups and props
 * (section-d.ts `script`, `life`, the secrets): the stalls, the rack, the handhaver and the pigeons,
 * the chest (446), the repair crate (700), the lamp the gull sleeps on (820); in the arena the crate
 * (960), ROBO-HALSEMA (the doors, her spot) and the cheering crowd's spots.
 */
export const D_KEEP_CLEAR: readonly number[] = [200, 336, 420, 446, 560, 700, 760, 820, 960, 1010, 1080, 1140, 1150, 1190];

/** The back row stops at the street furniture on the pavement (the lamp at 310, the flag at 548). */
const BACK_GAPS: readonly (readonly [number, number])[] = [
  [298, 322],
  [540, 562],
];

/** The front rows also keep clear of the player start (the front-row check reads it). */
const ROW_CLEAR: readonly number[] = [48, ...D_KEEP_CLEAR];

/** The FloorDef of d (`decor`: the section's decor list: the side faces find their fronts there). */
export function dFloorDef(decor: readonly DecorDef[]): FloorDef {
  const L = D_LAYOUT;
  const frontGaps: [number, number][] = [
    ...STALLS.map((x): [number, number] => [x - STALL_GAP, x + STALL_GAP]),
    [RACK[0] - RACK_GAP, RACK[1] + RACK_GAP],
  ];
  return {
    camera: { ...AMS_CAMERA },
    painter: { id: 'ams/floor', params: { layout: L }, seed: 23 },
    // The street's kerbs and the flush square (the bulb), then the house fronts' pavement raised behind its kerb.
    features: [...streetFeatures(L), { kind: 'kerb', to: HOUSE_LINE, dh: KERB_H, face: 'ams/kerb-face' }],
    baseFace: 'ams/kerb-face',
    rows: [
      // The Amsterdammertjes on the house kerb (not where the lamp and the flag stand) and at the market's edge.
      poleRow({ name: 'back poles (houses)', prop: 'ams/pole', depth: D_BACK_ROW, u0: 0, u1: BEND[0] - 12, spacing: 34, offset: 14, gaps: BACK_GAPS }),
      poleRow({ name: 'front poles (market)', prop: 'ams/pole', depth: D_FRONT_ROW, u0: 0, u1: BEND[0] - 12, spacing: 38, offset: 22, gaps: frontGaps, clear: ROW_CLEAR }),
    ],
    faces: [...houseSides(decor, { back: AMS_BACK, light: 'sunset', depthOf: amsDecorDepth }), ...stoperaSides(), ...marketStallSides(decor), ...planterSides(decor)],
    // The breakables, the crates and the secret's chest (446). At most both breakable stalls (200, 560:
    // 360 px apart, faces ±30) and both crates (700, 960) show at once.
    entityFaces: amsEntityFaces(['crate', 'ams-bike-rack', 'ams-market-stall', 'ams-secret'], { max: { 'ams-market-stall': 2, crate: 2, 'ams-bike-rack': 1, 'ams-secret': 1 } }),
    decorDepth: amsDecorDepth,
    shadow: 0.3,
    keepClear: D_KEEP_CLEAR,
  };
}

/** The section's `floor`: the def while the switch is on, else none (fail soft: a kit that throws gives none, logged). */
export function dFloor(decor: readonly DecorDef[]): FloorDef | undefined {
  return D_FLOOR_ON ? kitFloor('ams/d', () => dFloorDef(decor)) : undefined;
}

/** Decor only the floor draws: the Stopera anchored on its doors at its depth (section-d.ts hides the 2D one on the floor). */
export function dFloorDecor(): DecorDef[] {
  return D_FLOOR_ON ? kitDecor('ams/d', () => floorOnly([stoperaDecor()])) : [];
}
