/**
 * THE TABLE of the compressed A10 (docs/design/rally.md §3, §4, §5): the ring of Amsterdam
 * clockwise from the Zuidas, about 6.5 km (about 1:5 of the real 32 km), as ten hand-made
 * sections. A rough likeness of the real ring, NOT to scale: the Zuid straight runs east → west, the
 * West side south → north, the Coentunnel takes the road north under the water in the north-west,
 * the Noord stretch runs east, the Zeeburgertunnel takes it south under the IJ in the east, the
 * Oost side runs south, and the Amstel corner turns it west past the RAI back to the Zuidas.
 *
 * Every offset (`at`, `from`, `to`) is metres of design distance from the start of its section.
 * Real A10 names are allowed (the ring exception, docs/ORIGINALITY.md); the S-exit names are the
 * ones the 2D ring already uses (ring/landmarks.ts). Buildings carry no real company names:
 * landmark ids are generic. The same table always gives the same track (the seed varies only the
 * traffic and the event details).
 */
import type { GantryKind, SectionId } from './types';

export type ElemSpec =
  | { readonly kind: 'straight'; readonly len: number; readonly close?: 'x' | 'z' }
  | { readonly kind: 'bend'; readonly turn: number; readonly r: number; readonly t: number };

/** A straight of `len` metres (`close`: one of the two straights the layout stretches to close the loop). */
export const S = (len: number, close?: 'x' | 'z'): ElemSpec => (close ? { kind: 'straight', len, close } : { kind: 'straight', len });
/** A bend of `turn` degrees (+ = left) at the minimum radius `r` with transitions of `t` metres. */
export const B = (turn: number, r: number, t = 80): ElemSpec => ({ kind: 'bend', turn, r, t });

export interface SectionSpec {
  readonly id: SectionId;
  readonly name: string;
  readonly elems: readonly ElemSpec[];
  /** The tube (from..to), the ramps outside it, the depth of the road in it, water above it. */
  readonly tunnel?: { readonly name: string; readonly from: number; readonly to: number; readonly ramp: number; readonly depth: number; readonly water?: readonly [number, number] };
  /** Decks (from..to) at `height`, with ramps (embankments) outside them. */
  readonly decks?: readonly { readonly name: string; readonly kind: 'bridge' | 'viaduct'; readonly from: number; readonly to: number; readonly height: number; readonly ramp: number }[];
  readonly gantries?: readonly { readonly at: number; readonly kind: GantryKind }[];
  readonly cameras?: readonly { readonly at: number; readonly limit: number }[];
  readonly avg?: { readonly from: number; readonly to: number; readonly limit: number };
  readonly roadworks?: readonly { readonly from: number; readonly to: number; readonly closed: readonly number[]; readonly limit: number }[];
  readonly spits?: readonly (readonly [number, number])[];
  readonly noise?: readonly (readonly [number, number])[];
  /** S-exits: the off-ramp at `at` (block marks on the shoulder line before it). */
  readonly exits?: readonly { readonly code: string; readonly name: string; readonly at: number }[];
  readonly landmarks?: readonly { readonly id: string; readonly at: number; readonly side: number }[];
}

/** The start heading: west (forward(yaw) = (sin yaw, 0, cos yaw); x = east, z = south). */
export const A10_YAW0 = -Math.PI / 2;

/** The finish / start line: metres into ZUIDAS. */
export const A10_FINISH_AT = 190;

export const A10_TABLE: readonly SectionSpec[] = [
  {
    id: 'zuidas',
    name: 'ZUIDAS',
    // The Zuid straight, heading west under the towers: the start gantry, then a gentle kink.
    elems: [S(260), B(5, 800, 40), S(60), B(-5, 800, 40), S(80, 'x')],
    gantries: [{ at: A10_FINISH_AT, kind: 'start' }, { at: 560, kind: 'matrix' }],
    exits: [{ code: 'S108', name: '', at: 470 }],
    landmarks: [
      { id: 'zuidas-towers', at: 120, side: 70 },
      { id: 'zuidas-station', at: 300, side: -60 },
      { id: 'zuidas-cranes', at: 470, side: 80 },
    ],
  },
  {
    id: 'nieuwe-meer',
    name: 'NIEUWE MEER',
    // The A4 junction, the bridge over the Schinkel, then the long right-hander north.
    elems: [S(60), B(-40, 300, 60), S(110), B(-50, 260, 60)],
    decks: [{ name: 'SCHINKELBRUG', kind: 'bridge', from: 360, to: 420, height: 6, ramp: 130 }],
    gantries: [{ at: 120, kind: 'matrix' }],
    cameras: [{ at: 200, limit: 100 }],
    exits: [{ code: 'S107', name: 'SLOTERVAART', at: 620 }],
    noise: [[500, 726]],
    landmarks: [
      { id: 'a4-junction', at: 60, side: -60 },
      { id: 'schinkel-water', at: 390, side: 40 },
      { id: 'nieuwe-meer-woods', at: 600, side: -70 },
    ],
  },
  {
    id: 'ring-west',
    name: 'RING WEST',
    // Heading north past the 1960s flats, the metro beside the road: the average-speed zone.
    elems: [S(140, 'z'), B(6, 800, 40), S(60), B(-6, 800, 40), S(40)],
    avg: { from: 20, to: 450, limit: 100 },
    gantries: [{ at: 20, kind: 'avg-start' }, { at: 240, kind: 'matrix' }, { at: 450, kind: 'avg-end' }],
    decks: [{ name: 'VIADUCT WEST', kind: 'viaduct', from: 260, to: 300, height: 6, ramp: 110 }],
    exits: [
      { code: 'S106', name: 'LELYLAAN', at: 200 },
      { code: 'S105', name: 'DE BAARSJES', at: 430 },
    ],
    noise: [[0, 200], [300, 472]],
    spits: [[40, 440]],
    roadworks: [{ from: 150, to: 400, closed: [0], limit: 70 }],
    landmarks: [
      { id: 'west-flats', at: 100, side: 60 },
      { id: 'west-metro', at: 250, side: 26 },
      { id: 'west-flats-2', at: 400, side: -70 },
    ],
  },
  {
    id: 'sloterdijk',
    name: 'SLOTERDIJK',
    // The busy junction by the station: a jog right and left under the gantry.
    elems: [S(20), B(-6, 600, 30), S(30), B(6, 600, 30), S(10)],
    gantries: [{ at: 60, kind: 'exit' }],
    exits: [
      { code: 'S104', name: 'BOS EN LOMMER', at: 60 },
      { code: 'S102', name: 'SLOTERDIJK', at: 230 },
    ],
    landmarks: [
      { id: 'sloterdijk-station', at: 120, side: 70 },
      { id: 'sloterdijk-offices', at: 200, side: -60 },
    ],
  },
  {
    id: 'coentunnel',
    name: 'COENTUNNEL',
    // The ramps and the tube under the water, heading north-north-east.
    elems: [S(40), B(-15, 700, 40), S(300)],
    tunnel: { name: 'COENTUNNEL', from: 220, to: 460, ramp: 150, depth: 8, water: [270, 410] },
    gantries: [{ at: 50, kind: 'matrix' }],
    exits: [{ code: 'S101', name: 'HEMHAVENS', at: 40 }],
    landmarks: [
      { id: 'coentunnel-portal-south', at: 220, side: 0 },
      { id: 'harbour-cranes', at: 330, side: -90 },
      { id: 'coentunnel-portal-north', at: 460, side: 0 },
    ],
  },
  {
    id: 'noord',
    name: 'NOORD',
    // The big right-hander east, the flat polder, the canal bridge, the wind turbines.
    elems: [B(-75, 320, 70), S(260), B(9, 900, 50), S(100), B(-9, 900, 50), S(220)],
    decks: [{ name: 'KANAALBRUG', kind: 'bridge', from: 960, to: 1020, height: 6, ramp: 130 }],
    gantries: [{ at: 160, kind: 'matrix' }, { at: 560, kind: 'matrix' }, { at: 1300, kind: 'exit' }],
    cameras: [{ at: 700, limit: 100 }],
    exits: [
      { code: 'S118', name: '', at: 300 },
      { code: 'S117', name: '', at: 700 },
      { code: 'S116', name: '', at: 1250 },
    ],
    spits: [[500, 900]],
    roadworks: [{ from: 1100, to: 1350, closed: [2, 3], limit: 70 }],
    landmarks: [
      { id: 'noord-sheds', at: 300, side: 60 },
      { id: 'wind-turbines', at: 600, side: -120 },
      { id: 'canal-water', at: 990, side: 40 },
    ],
  },
  {
    id: 'zeeburgertunnel',
    name: 'ZEEBURGERTUNNEL',
    // The right-hander south-east, then the tube under the IJ; the towers of the islands at the exit.
    elems: [B(-70, 300, 70), S(80), S(240), B(-25, 500, 50)],
    tunnel: { name: 'ZEEBURGERTUNNEL', from: 520, to: 780, ramp: 150, depth: 8, water: [560, 740] },
    gantries: [{ at: 200, kind: 'matrix' }],
    exits: [{ code: 'S115', name: '', at: 200 }],
    landmarks: [
      { id: 'zeeburg-portal-north', at: 520, side: 0 },
      { id: 'ij-water', at: 650, side: 60 },
      { id: 'islands-towers', at: 950, side: 90 },
    ],
  },
  {
    id: 'oost',
    name: 'OOST',
    // South past the Watergraafsmeer: sports fields, the science park, the tall office tower.
    elems: [S(260), B(6, 800, 40), S(100), B(-6, 800, 40), S(140)],
    decks: [{ name: 'VIADUCT OOST', kind: 'viaduct', from: 180, to: 220, height: 6, ramp: 110 }],
    gantries: [{ at: 60, kind: 'matrix' }, { at: 460, kind: 'exit' }],
    cameras: [{ at: 600, limit: 100 }],
    exits: [
      { code: 'S114', name: 'IJBURG', at: 80 },
      { code: 'S113', name: 'WATERGRAAFSMEER', at: 500 },
    ],
    spits: [[280, 700]],
    roadworks: [{ from: 380, to: 600, closed: [0], limit: 70 }],
    noise: [[0, 200]],
    landmarks: [
      { id: 'sports-fields', at: 120, side: 70 },
      { id: 'science-park', at: 330, side: -80 },
      { id: 'office-tower', at: 620, side: 80 },
    ],
  },
  {
    id: 'amstel',
    name: 'AMSTEL',
    // The A2 junction, the bridge over the Amstel (boats below), the turn west.
    elems: [B(-40, 300, 60), S(120), B(-45, 320, 60)],
    decks: [{ name: 'AMSTELBRUG', kind: 'bridge', from: 300, to: 360, height: 6, ramp: 130 }],
    gantries: [{ at: 150, kind: 'matrix' }, { at: 560, kind: 'matrix' }],
    exits: [
      { code: 'S112', name: 'CENTRUM', at: 120 },
      { code: 'S111', name: 'OVERAMSTEL', at: 600 },
    ],
    landmarks: [
      { id: 'a2-junction', at: 150, side: -70 },
      { id: 'amstel-river', at: 330, side: 50 },
    ],
  },
  {
    id: 'rai',
    name: 'RAI',
    // The exhibition halls; back to the Zuidas.
    elems: [S(240)],
    gantries: [{ at: 120, kind: 'matrix' }],
    exits: [
      { code: 'S110', name: '', at: 40 },
      { code: 'S109', name: 'RAI', at: 200 },
    ],
    noise: [[0, 240]],
    landmarks: [{ id: 'rai-halls', at: 120, side: 80 }],
  },
];
