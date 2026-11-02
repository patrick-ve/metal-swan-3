/**
 * The façade grammar's ids and plan types (docs/design/oat.md §8.2 the MIXED scale, §8.6 the
 * grammar, §8.10 wear; docs/api/oat.md "Grammar"). Pure types and small constants: the sequencer
 * (grammar.ts) fills a `LotPlan` per lot, the painters (wall.ts, windows.ts, ground.ts,
 * details.ts, wear.ts) read it, the light (light.ts) reads its protrusions and features.
 *
 * Units: WORLD px (logical) along the street (u) and up from the façade base (h). The ground band
 * is true scale (20 px/m, both axes for every opening and object); lot widths are 0.6 scale
 * (12 px/m, Amsterdam feet); the upper band is ~0.4 vertical (8 px/m) and its openings keep their
 * real ratio by narrowing (spec §8.2).
 */

/** The street style sheets (spec §8.6 table). */
export type StreetSheetId = '9-straatjes' | 'canal-front' | 'grimburgwal' | 'oudezijds' | 'trompettersteeg' | 'oudekerksplein';

/** The gable types (spec §8.6 "Gables"; 'plastered' = 19th-century fronts, 'infill' = 20th century). */
export type GableType = 'trap' | 'hals' | 'verhoogde-hals' | 'klok' | 'tuit' | 'lijst' | 'plastered' | 'infill' | 'none';

/** Wall materials (spec §8.6 "Walls"; research §2.2 colours). */
export type WallId =
  | 'brick-red' // 18th-century red-brown brick
  | 'brick-orange' // soft orange-red early 17th-century brick
  | 'brick-purple' // hard-fired dark purple-brown brick
  | 'brick-black' // near-black over-painted brick (19th-century painters)
  | 'brick-yellow' // yellow-brown 19th / 20th-century brick
  | 'painted-red' // a red-painted front
  | 'painted-grey' // dark grey painted brick
  | 'plaster-cream' // cream plaster
  | 'plaster-white'; // grey-white plaster

/** Window types (spec §8.6 "Windows"). */
export type WindowId =
  | 'sash-12' // a 12-pane sash (6-over-6): white is required with small panes
  | 'sash-2-2' // 2-over-2
  | 'sash-1-1' // big panes (green allowed), with a transom
  | 'casement' // two casements under a transom
  | 'kruis' // the 17th-century kruiskozijn (cross frame, sandstone colour, shutters)
  | 'loading' // warehouse: stacked loading doors with hourglass shutters in the middle bay
  | 'modern'; // 20th-century infill: big plain panes in thin dark frames

/** Ground-floor types (spec §8.6 "Doors and ground floors"). */
export type GroundKind =
  | 'shop' // white wooden pui, thin columns, fascia with painted letters, awning
  | 'slot' // a blank shop front for a decor sprite on top (STREET-A's Haverbar, conceptstore)
  | 'stoep' // the raised door on a stoep with two flights, the half-sunk basement
  | 'flat' // a door at street level (a stone step), tall ground-floor windows
  | 'warehouse' // big loading doors with shutters
  | 'bar' // d: a bar front, warm interior, neon in our own words
  | 'frames'; // d: window frames (architecture only: closed curtains, red tubes, a number)

/** Paint colours of doors, sashes, shutters and railings (research §2.2, S13). */
export type PaintId = 'green' | 'black' | 'oxblood' | 'white' | 'red' | 'wood';

/** One opening (window, door, glass) in world px: left u, bottom h, width, height. */
export interface Opening {
  u: number;
  h: number;
  w: number;
  hh: number;
}

/** A protrusion that casts a shadow on its own wall (spec §8.4): world px, depth in metres. */
export interface Protrusion {
  readonly kind: string;
  readonly u0: number;
  readonly u1: number;
  /** Its underside's height above the façade base (world px). */
  readonly y: number;
  readonly depthM: number;
}

/** A wear mark of a lot (spec §8.10 "Façade wear": ≥ 6 per lot). */
export interface WearMark {
  readonly kind: 'damp' | 'salt' | 'rust' | 'soot' | 'patch' | 'streak' | 'peel' | 'sticker' | 'spikes' | 'tag' | 'crack';
  readonly u: number;
  readonly h: number;
  readonly w: number;
  readonly hh: number;
  readonly seed: number;
}

/**
 * A feature others place things at (docs/api/oat.md "Grammar"): the hoist beams (the set piece
 * hangs its rope there), the neon words, the red tubes, the lit windows and the wall lamps (the
 * night light pass, the water reflections and the 03:00 lamp groups), the shop slots.
 */
export interface FacadeFeature {
  readonly kind: 'hoist' | 'neon' | 'red-tube' | 'lit-window' | 'wall-lamp' | 'bar-window' | 'slot' | 'door';
  /** World px: left, bottom, width, height (a hoist: the beam end's point, w = h = 0). */
  readonly u: number;
  readonly h: number;
  readonly w: number;
  readonly hh: number;
  /** The neon word, the frame number, the slot's id. */
  readonly text?: string;
  /** The light's tint ('warm', 'red', 'pink', 'cyan'). */
  readonly tint?: Tint;
  /** The lamp group name for the 03:00 switch (spec §8.9). */
  readonly group?: string;
  /** The lot index in its row. */
  readonly lot: number;
}

/** Light tints of the night bake. */
export type Tint = 'warm' | 'red' | 'pink' | 'cyan';

/** A fixed lot the sequencer plants (row params `slots`): a shop slot or the hoist lot. */
export interface SlotDef {
  readonly u0: number;
  readonly u1: number;
  /** 'slot' (a blank shop front for a decor sprite), 'hoist' (a warehouse with its beam at `x`). */
  readonly kind: 'slot' | 'hoist';
  /** The hoist beam's world x (kind 'hoist'; default the lot's middle). */
  readonly x?: number;
  readonly id?: string;
}

/** The upper storeys of a lot (the upper band, ~8 px/m). */
export interface Storey {
  /** Bottom and height (world px). */
  readonly h: number;
  readonly hh: number;
  /** The window openings (u, h = sill top, w, hh) of this storey. */
  readonly windows: readonly Opening[];
}

/** The full plan of one lot (the public `FacadeLot` subset is in index.ts). */
export interface LotPlan {
  readonly index: number;
  readonly u0: number;
  readonly w: number;
  /** Amsterdam feet of the lot (0: an infill or a slot). */
  readonly ft: number;
  readonly sheet: StreetSheetId;
  readonly seed: number;
  readonly gable: GableType;
  readonly wall: WallId;
  readonly window: WindowId;
  /** True for the deliberate twin of its left neighbour (spec §8.6: once per street). */
  readonly twin: boolean;
  /** The ground band's top (true scale, 64–84 px) = the seam line (spec §8.2). */
  readonly bandTop: number;
  /** What the seam line is: the shop front's beam, the stoep door's lintel or a string course. */
  readonly seam: 'beam' | 'lintel' | 'string';
  /** The top of the last full storey (the eaves / the cornice's foot). */
  readonly eaves: number;
  /** The gable tip / the roof's top (world px above the base). */
  readonly ridge: number;
  readonly storeys: readonly Storey[];
  readonly bays: number;
  readonly ground: GroundKind;
  /** The ground floor's openings: the door (and a second door), the shop glass / windows, the cellar. */
  readonly door: Opening;
  readonly door2: Opening | null;
  readonly groundWindows: readonly Opening[];
  /** The stoep: its height (26–32 px; 0 = none) and its u range. */
  readonly stoep: { readonly h: number; readonly u0: number; readonly u1: number } | null;
  readonly fanlight: number;
  readonly doorPaint: PaintId;
  readonly sashPaint: PaintId;
  /** White or sandstone window frames. */
  readonly frame: 'white' | 'sandstone';
  readonly shutters: PaintId | null;
  /** The gable's shape numbers (each painter reads its own). */
  readonly neckW: number;
  readonly topW: number;
  readonly steps: readonly { readonly w: number; readonly hh: number }[];
  readonly attic: boolean;
  readonly roofH: number;
  /** The gable windows (loft, attic). */
  readonly gableWindows: readonly Opening[];
  readonly hoist: { readonly u: number; readonly h: number; readonly roof: boolean } | null;
  readonly anchors: 'cross' | 'rosette';
  readonly anchorPts: readonly (readonly [number, number])[];
  readonly downpipe: number | null;
  readonly flowerBox: boolean;
  readonly awning: { readonly kind: 'stripe' | 'plain'; readonly paint: number } | null;
  readonly sign: boolean;
  readonly shopWord: string;
  readonly number: number;
  readonly gableStone: boolean;
  /** Sideways tilt (subsidence; spec §8.2): world px at the ridge, + right. */
  readonly tilt: number;
  readonly protrusions: readonly Protrusion[];
  readonly wear: readonly WearMark[];
  readonly features: readonly FacadeFeature[];
  /** Night (d): which upper windows are lit (by storey, bay: a bit mask per storey). */
  readonly lit: readonly number[];
  /** Night: the neon word of a bar and its tint. */
  readonly neon: { readonly word: string; readonly tint: Tint } | null;
}

/** Scale constants (spec §8.2). */
export const PX_PER_M_GROUND = 20;
export const PX_PER_M_UPPER = 8;
export const PX_PER_M_LOT = 12;
/** The Amsterdam foot, metres (research S2). */
export const FOOT_M = 0.2831;
/** Lot widths in world px per Amsterdam feet (spec §8.2 table). */
export const LOT_PX: Readonly<Record<number, number>> = { 18: 61, 20: 68, 22: 74, 24: 82, 26: 89, 30: 102 };
/** No two lots within this many px of street share the triple (spec §8.6). */
export const NO_REPEAT_PX = 1536;
