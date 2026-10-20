/**
 * The ten fixed landmarks of the ring (docs/design/ring.md §4; docs/api/ring.md "The generator").
 *
 * The A10 inner ring (binnenring) clockwise from A10 Oost, 32.3 km in reality. The S-exits count
 * DOWN in our direction (S113 → S101, then S118 → S114) and the hectometre posts RISE (about 13
 * at Watergraafsmeer → 32.3, a wrap to 0 at Coenplein, about 9–10 at the Zeeburgertunnel). Real
 * names are allowed in mission `ring` (spec §12); the km values are flavour, not survey data.
 *
 * A landmark is a fixed SET PIECE (its chunks and lengths never change with the seed) followed by
 * the generated road of its stretch (director.ts). `share` is the landmark's part of the
 * generated road: the real distance to the next landmark, compressed (half the real share + half
 * an equal share) so the long West and Noord stretches do not swallow the ring.
 *
 * Tunnel landmarks are only the tube (`lanes: 3`, `tunnel`): what follows the tube (Coenplein;
 * S114 and the Zeeburgerbrug) is in `after` — fixed set-piece chunks outside the landmark's range,
 * so the view's tunnel darkness and the 3 lanes end at the portal.
 */
import type { RingLandmarkId } from './ids';
import { RING_LANDMARKS } from './ids';
import type { RingChunkType, RingPlan } from './types';

/** One fixed chunk of a set piece. */
export interface RingSetPieceChunk {
  readonly type: RingChunkType;
  readonly part: string;
  readonly length: number;
  /** 3 = the near lane (lane 4) is the tunnel kerb. */
  readonly lanes?: 3 | 4;
  /** A scene (boarding, off-ramp): no enemies, outside the 4-second rule. */
  readonly scene?: boolean;
  /** Skyline district when it differs from the landmark's. */
  readonly district?: string;
}

export interface RingLandmarkDef {
  readonly id: RingLandmarkId;
  readonly name: string;
  /** Skyline district of the set piece … */
  readonly district: string;
  /** … and of the generated road after it. */
  readonly roadDistrict: string;
  /** The landmark proper (its `start` / `length` in the plan). */
  readonly setPiece: readonly RingSetPieceChunk[];
  /** Fixed chunks right after the landmark proper (outside its range; still set pieces). */
  readonly after?: readonly RingSetPieceChunk[];
  /** S-exits passed in its stretch, in our order (direction signs). */
  readonly exits: readonly string[];
  /**
   * Unwrapped ring km at the landmark start (13.0 … 45.3; the posts show it modulo 32.3) and,
   * for the tunnels, at the end of the tube (Coenplein = 32.3 → 0).
   */
  readonly ringKm: number;
  readonly ringKmEnd?: number;
  readonly limit: 80 | 100;
  readonly junction?: string;
  readonly bridge?: string;
  readonly tunnelName?: string;
  /** Relative share of the generated road (0 = no road after it: the exit). */
  readonly share: number;
  /** A boss slot `offset` px into the set piece (the plan's `bosses`). */
  readonly boss?: { readonly id: string; readonly offset: number; readonly lane: number };
  /** Its road may hold a jam (the director picks 1–2 of these stretches). */
  readonly jam?: boolean;
  /** Flavour for the scenery and the docs (what its skyline shows). */
  readonly places: readonly string[];
}

/** The ring's length in km (the posts wrap to 0 here). */
export const RING_KM = 32.3;

/** Unwrapped km at the plan end (back at S113 Watergraafsmeer). */
export const RING_KM_END = 13.0 + RING_KM;

/** Place names of the S-exits on the direction signs ('' = the number only). */
export const EXIT_NAMES: Readonly<Record<string, string>> = {
  S113: 'WATERGRAAFSMEER',
  S112: 'CENTRUM',
  S111: 'OVERAMSTEL',
  S110: '',
  S109: 'RAI',
  S108: '',
  S107: 'SLOTERVAART',
  S106: 'LELYLAAN',
  S105: 'DE BAARSJES',
  S104: 'BOS EN LOMMER',
  S103: '',
  S102: 'SLOTERDIJK',
  S101: 'HEMHAVENS',
  S118: '',
  S117: '',
  S116: '',
  S115: '',
  S114: 'IJBURG',
};

/** The landmarks in their real clockwise order (spec §4). */
export const RING_LANDMARK_DEFS: readonly RingLandmarkDef[] = [
  {
    id: 'oost',
    name: 'A10 OOST',
    district: 'oost',
    roadDistrict: 'oost',
    // The on-ramp at S113: the boarding scene, then the merge up the ramp into lane 4.
    setPiece: [
      { type: 'merge', part: 'boarding', length: 640, scene: true },
      { type: 'cruise', part: 'on-ramp', length: 384 },
    ],
    exits: ['S113', 'S112', 'S111'],
    ringKm: 13.0,
    limit: 100,
    share: 0.87,
    places: ['Watergraafsmeer', 'Amstel station', 'the Rembrandt tower'],
  },
  {
    id: 'amstel',
    name: 'KNOOPPUNT AMSTEL',
    district: 'amstel',
    roadDistrict: 'amstel',
    setPiece: [
      { type: 'cruise', part: 'interchange', length: 512 },
      { type: 'bridge', part: 'rozenoordbrug', length: 512 },
    ],
    exits: ['S110'],
    ringKm: 15.6,
    limit: 100,
    junction: 'A2',
    bridge: 'ROZENOORDBRUG',
    share: 0.77,
    places: ['knooppunt Amstel (A2) fly-overs', 'the Rozenoordbrug over the Amstel'],
  },
  {
    id: 'zuid',
    name: 'ZUID',
    district: 'zuid',
    roadDistrict: 'zuidas',
    setPiece: [
      { type: 'cruise', part: 'rai', length: 512 },
      { type: 'cruise', part: 'zuidas', length: 512 },
    ],
    exits: ['S109', 'S108'],
    ringKm: 17.5,
    limit: 100,
    share: 0.91,
    jam: true,
    places: ['the RAI exhibition halls', 'the Zuidas towers', 'the railway and metro in the median'],
  },
  {
    id: 'nieuwe-meer',
    name: 'DE NIEUWE MEER',
    district: 'lake',
    roadDistrict: 'lake',
    setPiece: [
      { type: 'bridge', part: 'schinkelbrug', length: 512 },
      { type: 'cruise', part: 'interchange', length: 512 },
    ],
    exits: [],
    ringKm: 20.4,
    limit: 100,
    junction: 'A4',
    bridge: 'SCHINKELBRUG',
    share: 0.66,
    places: ['the Schinkelbrug (a bascule bridge)', 'knooppunt De Nieuwe Meer (A4)', 'the lake and the woods'],
  },
  {
    id: 'west',
    name: 'A10 WEST',
    district: 'west',
    roadDistrict: 'west',
    // The 80 km/h stretch: the gantry with the 80s, then the average-speed zone in its road.
    setPiece: [{ type: 'cruise', part: 'limit-80', length: 512 }],
    exits: ['S107', 'S106', 'S105', 'S104', 'S103', 'S102'],
    ringKm: 21.5,
    limit: 80,
    share: 1.51,
    jam: true,
    places: ['Slotervaart', 'Lelylaan', 'De Baarsjes', 'Bos en Lommer (buildings over the road)', 'Sloterdijk station and offices'],
  },
  {
    id: 'westpoort',
    name: 'WESTPOORT',
    district: 'port',
    roadDistrict: 'port',
    // The mid-boss slot (the test lorry, wave B); wave A skips the unknown id.
    setPiece: [{ type: 'cruise', part: 'boss', length: 768 }],
    exits: ['S101'],
    ringKm: 28.6,
    limit: 100,
    share: 0.84,
    boss: { id: 'ring-lorry', offset: 192, lane: 1 },
    places: ['S101 Hemhavens', 'the port cranes'],
  },
  {
    id: 'coentunnel',
    name: 'COENTUNNEL',
    district: 'tunnel',
    roadDistrict: 'noord',
    setPiece: [{ type: 'tunnel', part: 'coentunnel', length: 1280, lanes: 3 }],
    after: [{ type: 'cruise', part: 'coenplein', length: 512, district: 'coenplein' }],
    exits: [],
    ringKm: 31.0,
    ringKmEnd: RING_KM,
    limit: 100,
    junction: 'A8',
    tunnelName: 'COENTUNNEL',
    share: 0.86,
    jam: true,
    places: ['the Coentunnel under the Noordzeekanaal', 'knooppunt Coenplein (A8)'],
  },
  {
    id: 'noord',
    name: 'A10 NOORD',
    district: 'noord',
    roadDistrict: 'noord',
    setPiece: [
      { type: 'cruise', part: 'noise-screens', length: 384 },
      { type: 'bridge', part: 'kanaal', length: 512 },
    ],
    exits: ['S118', 'S117', 'S116', 'S115'],
    ringKm: 1.2 + RING_KM,
    limit: 100,
    bridge: 'NOORDHOLLANDSCH KANAAL',
    share: 1.55,
    jam: true,
    places: ['long noise screens', 'the bridge over the Noordhollandsch Kanaal', 'the polders to the north'],
  },
  {
    id: 'zeeburg',
    name: 'ZEEBURGERTUNNEL',
    district: 'tunnel',
    roadDistrict: 'zeeburg',
    setPiece: [{ type: 'tunnel', part: 'zeeburgertunnel', length: 1024, lanes: 3 }],
    after: [
      { type: 'cruise', part: 'ijburg', length: 256, district: 'zeeburg' },
      { type: 'bridge', part: 'zeeburgerbrug', length: 512, district: 'zeeburg' },
    ],
    exits: ['S114'],
    ringKm: 8.6 + RING_KM,
    ringKmEnd: 9.6 + RING_KM,
    limit: 100,
    tunnelName: 'ZEEBURGERTUNNEL',
    bridge: 'ZEEBURGERBRUG',
    share: 1.04,
    jam: true,
    places: ['the Zeeburgertunnel under the Buiten-IJ', 'S114 IJburg', 'the Zeeburgerbrug over the Amsterdam-Rijnkanaal'],
  },
  {
    id: 'exit',
    name: 'AFRIT S113',
    district: 'oost',
    roadDistrict: 'oost',
    // The end-boss marker (unknown id: skipped), the exit gantry, the off-ramp (a scene).
    setPiece: [
      { type: 'cruise', part: 'boss', length: 512 },
      { type: 'merge', part: 'offramp', length: 512, scene: true },
    ],
    exits: ['S113'],
    ringKm: 12.4 + RING_KM,
    limit: 100,
    share: 0,
    boss: { id: 'ring-end-boss', offset: 64, lane: 1 },
    places: ['the exit sign S113', 'the off-ramp'],
  },
];

// The defs follow ids.ts exactly (a programming error otherwise).
if (RING_LANDMARK_DEFS.map((d) => d.id).join() !== RING_LANDMARKS.join()) throw new Error('ring landmarks out of order');

/** The def of a landmark id. */
export function landmarkDef(id: RingLandmarkId): RingLandmarkDef {
  return RING_LANDMARK_DEFS[RING_LANDMARKS.indexOf(id)];
}

/** Length of a landmark proper (its set piece, without `after`). */
export function setPieceLength(def: RingLandmarkDef): number {
  let n = 0;
  for (const c of def.setPiece) n += c.length;
  return n;
}

/** Length of everything fixed at a landmark (the set piece and `after`). */
export function fixedLength(def: RingLandmarkDef): number {
  let n = setPieceLength(def);
  for (const c of def.after ?? []) n += c.length;
  return n;
}

/** The km on the posts (0 … 32.3) of an unwrapped ring km. */
export function wrapKm(ringKm: number): number {
  const k = ringKm % RING_KM;
  return Math.round(k * 10) / 10;
}

/**
 * The hectometre km at a plan distance (0 … 32.3, one decimal): linear between the landmarks'
 * anchors (each landmark start, the end of each tunnel tube, the plan end), wrapped at Coenplein.
 */
export function ringKmAt(plan: Pick<RingPlan, 'landmarks' | 'length'>, d: number): number {
  let prevD = 0;
  let prevK = RING_LANDMARK_DEFS[0].ringKm;
  const step = (atD: number, atK: number): number | null => {
    if (d < atD) {
      const f = atD > prevD ? (d - prevD) / (atD - prevD) : 0;
      return wrapKm(prevK + (atK - prevK) * Math.max(0, f));
    }
    prevD = atD;
    prevK = atK;
    return null;
  };
  for (const lm of plan.landmarks) {
    const def = landmarkDef(lm.id);
    const a = step(lm.start, def.ringKm);
    if (a !== null) return a;
    if (def.ringKmEnd !== undefined) {
      const b = step(lm.start + lm.length, def.ringKmEnd);
      if (b !== null) return b;
    }
  }
  const e = step(plan.length, RING_KM_END);
  return e !== null ? e : wrapKm(RING_KM_END);
}

/** '12,3' (the Dutch decimal comma of the hectometre boards: `A10 12,3 Re`). */
export function formatKm(km: number): string {
  const t = Math.round(km * 10);
  return `${Math.floor(t / 10)},${t % 10}`;
}
