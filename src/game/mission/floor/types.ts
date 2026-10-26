/**
 * The perspective floor's data contract (docs/design/floor.md §3.1, docs/api/floor.md): a section
 * opts in with `SectionDef.floor`. Everything here is data (ids, numbers, colours, small rule
 * functions); the kits register the looks (painters, tiles, procedural props) by id.
 *
 * Units: world px (u = world x). DEPTH = screen px behind the walk line on flat ground (the spec's
 * "at 14 px"): a thing at depth D stands on the floor row at screen y `yw − D` and scrolls at
 * s = 1 − D / (yw − yh); D 0 is the walk plane, D < 0 is in front of it (front rows).
 */
import type { Color } from '../../../engine/color';
import type { DecorDef } from '../types';

/** A depth line: a constant depth, or [u, depth] points (straight in the world between, constant beyond). */
export type DepthLine = number | readonly (readonly [number, number])[];

/** One layer of an animated tile surface (world-anchored drift in px per tick). */
export interface FloorTileLayerDef {
  /** A tile id (`defineFloorTile`). */
  tile: string;
  du?: number;
  dv?: number;
}

/**
 * What a floor surface shows: 'chunk' (the floor painter; the default), a tile id (a static
 * repeating material), or an animated tile: a layer with a drift and optionally a second layer
 * mixed over it at `alpha` (two drifts = a cheap shimmer: water).
 */
export type FloorSurface = 'chunk' | string | (FloorTileLayerDef & { over?: FloorTileLayerDef & { alpha: number } });

/**
 * A region of the height field (spec §1.2), later features win:
 * - 'kerb' / 'step' / 'raise': the walk profile + `dh` (a raised pavement, a step) over u0…u1 and
 *   the depths from…to (`from` the far edge, larger; `to` the near edge);
 * - 'deck': the same with `dh` default 0 (a bridge deck over water: put it AFTER its cut);
 * - 'cut': the absolute height `level` (h over the walk plane, e.g. G − WATER_Y = −4): water cuts,
 *   pools. Its walls are its `face` material (quay walls).
 * The vertical faces between two regions of different height take the `face` of the later one.
 * Never put a 'kerb' across depth 0: the walk line stays on the physics surface (the walk-line test).
 */
export interface FloorFeature {
  kind: 'kerb' | 'step' | 'raise' | 'deck' | 'cut';
  /** u range [u0, u1) (default the whole section). */
  u0?: number;
  u1?: number;
  /** Far edge (default the back edge) and near edge (default the front) as depths. */
  from?: DepthLine;
  to?: DepthLine;
  /** Height over the walk profile (kerb/step/raise/deck). */
  dh?: number;
  /** Absolute height (cut). */
  level?: number;
  /** The top surface (default 'chunk': the painter paints it). */
  surface?: FloorSurface;
  /** Tile id of the vertical faces it makes (kerb face, quay wall, deck side; default the def's `baseFace`). */
  face?: string;
}

/** The floor painter by registered id (`defineFloorPainter`): data, so it can run as an art job. */
export interface FloorPainterRef {
  id: string;
  params?: Readonly<Record<string, unknown>>;
  seed?: number;
}

/** A sagging chain between neighbouring props of a row (the iron posts). */
export interface PropLinkDef {
  /** Frame point of each prop where the chain hangs (default 'chain'; none: 70 % of the prop's height). */
  pt?: string;
  /** Sag at the middle (logical px at the row's scale). */
  sag: number;
  /** Link colours (light, dark). */
  colors: readonly [Color, Color];
  /** Only between props at most this far apart (world px; default 1.5 × spacing). */
  max?: number;
}

/**
 * A row of props at one depth (spec §3.6): a registered sprite (scaled ONCE per row to the row's
 * scale at the drawing density) or a procedural prop (`defineFloorProp`), placed along u.
 */
export interface PropRowDef {
  /** Optional name (debug, the review). */
  name?: string;
  sprite?: string;
  frame?: number;
  /** A procedural prop id (`defineFloorProp`) instead of a sprite. */
  prop?: string;
  /** The row's depth (negative = a FRONT row, drawn over the world). */
  depth: number;
  /** Extra scale on top of the row's perspective scale (default 1). */
  scale?: number;
  /** u range [u0, u1) (default the section). */
  u0?: number;
  u1?: number;
  /** Regular placement: every `spacing` px from u0 + offset … */
  spacing?: number;
  offset?: number;
  /** … or explicit u positions. */
  at?: readonly number[];
  /** No props inside these [a, b] ranges (crossings, bridges, doors). */
  gaps?: readonly (readonly [number, number])[];
  flipX?: boolean;
  link?: PropLinkDef;
}

/**
 * A platform's art on a lifted front (spec §3.5): a quad from the facade (back edge, at `depth`, its
 * shift and speed) to the platform line (front edge, v = 0, world y `y`). The old sprite (valance,
 * rail) stays as decor at the front edge.
 */
export interface OverhangDef {
  kind: 'awning' | 'slab' | 'roof';
  /** The platform: u range and line (world y), where physics has it. */
  x0: number;
  x1: number;
  y: number;
  /** The facade's depth (the back edge). */
  depth: number;
  /** 'roof': the back edge sits this much higher (a sloped bay roof). Default 0. */
  rise?: number;
  /** 'awning': the two stripe colours and the stripe width (world px, default 4). */
  colors?: readonly [Color, Color];
  stripe?: number;
  /** 'slab' / 'roof' (or an awning without colours): a tile id. */
  tile?: string;
  /**
   * The facade decor's anchor x: the back edge then sits exactly on the unscaled facade art (it is
   * drawn at its depth's shift). Default: the true projection of the corners.
   */
  anchorX?: number;
}

/** The top face of a walk-plane prop (spec §3.5): its top edge (front, v = 0) back into depth. */
export interface TopFaceDef {
  x0: number;
  x1: number;
  /** World y of the top edge (at x0; at x1 `y1` for a sloped top such as a ramp). */
  y: number;
  y1?: number;
  /** How far back the top reaches (a depth). */
  depth: number;
  /** Tile id of its material. */
  tile: string;
}

/** A flat opening in the floor at v = 0 (spec §3.7): a cover, a grave slab, a tomb lid. */
export interface FloorOpeningDef {
  /** u range. */
  x0: number;
  x1: number;
  /** Its extent in depth (far, near; e.g. 4 and −4). */
  from: number;
  to: number;
  tile: string;
  /** An ellipse inside the quad (a round cover) instead of the whole quad. */
  ellipse?: boolean;
}

/** A face's corner: [x, y, depth] in its group anchor's sprite px, or [x, y, depth, 1] in world px. */
export type FacePoint = readonly [number, number, number] | readonly [number, number, number, 1];

/**
 * One flat face of a prop in perspective (spec §11 R1, the side faces): a house's side wall at a
 * row's end, its roof's side, a houseboat's bow, a car's tail, a raised bridge leaf. Four corners
 * in the frame of its group's anchor; drawn every frame as one perspective-correct textured quad
 * (the canopy machinery), and only while it faces the eye: a side face narrows to nothing as its
 * prop crosses the screen's centre column, then the other side shows.
 */
export interface FaceDef {
  /**
   * The corners [x, y, depth], in order around the face and CLOCKWISE on screen as seen from the
   * side that shows: x px right of the anchor and y px ABOVE its base, both at the scale of the
   * anchor's depth (the px of a decor sprite drawn there), and the corner's depth (DEPTH units).
   * A side wall: front-top, back-top, back-bottom, front-bottom (right side; mirrored on the left).
   * With a 4th element 1 the corner is in WORLD px instead: x right of the anchor, y over the walk
   * plane (a face that joins a facade to the walk plane: an awning's cheek). Helpers: faces.ts.
   */
  pts: readonly FacePoint[];
  /** Tile px of each corner. Put the depth (the foreshortened direction) on b: tiles mip along b. */
  tex: readonly (readonly [number, number])[];
  /** Tile id of its material (`defineFloorTile`). */
  tile: string;
  /** Shown from both sides (a thin panel: a raised bridge leaf, a barrier arm). Default false. */
  both?: boolean;
}

/**
 * The faces of one prop (spec §11 R1), drawn through one quad canvas, in the far → near order of the
 * decor and rows at `order` (BEFORE every decor item and row at that depth: a facade covers its own
 * edge, a nearer neighbour covers the side behind it).
 */
export interface FaceGroupDef {
  /** Optional name (debug, the review). */
  name?: string;
  /** The anchor: a decor item's x, y and depth (its sprite px are the corners' units; it stands on the floor there, `liftAt`). */
  x: number;
  y: number;
  depth: number;
  /** The depth it is drawn at among the decor and rows (default `depth`). */
  order?: number;
  /** Draw over the world (with the front decor and rows) instead of before it. */
  front?: boolean;
  faces: readonly FaceDef[];
}

/**
 * The floor of a section (spec §3.1). Start values per section: spec §1.1 (`ams` yh 60, f 210,
 * back 146; oz-a yh 56, f 200, back 162 …).
 */
export interface FloorDef {
  camera: {
    /** Horizon (screen y), focal length (world px), back edge (screen y on flat ground). */
    yh: number;
    f: number;
    back: number;
    /** The walk line of flat ground (default 176 = G). */
    yw?: number;
  };
  /** The floor painter (the top surface's texture chunks). */
  painter: FloorPainterRef;
  /** Height-field regions over the walk profile (later ones win). */
  features?: readonly FloorFeature[];
  /** Tile id of the faces of profile steps and of features without a `face` (default: none, no faces). */
  baseFace?: string;
  /** Under a gap of the ground: the pit (default 48 px deep, the built-in dark 'floor/pit' tiles). */
  pit?: { depth?: number; surface?: FloorSurface; face?: string };
  rows?: readonly PropRowDef[];
  overhangs?: readonly OverhangDef[];
  tops?: readonly TopFaceDef[];
  openings?: readonly FloorOpeningDef[];
  /** Side faces and other faces in perspective (spec §11 R1): house sides, boat ends, car ends, a bridge leaf. */
  faces?: readonly FaceGroupDef[];
  /**
   * The depth of a decor item (spec §1.3): a number (0 = the walk plane, as today), null = hide it,
   * undefined = the default. `DecorDef.depth` on the item wins. Front items default to 0.
   */
  decorDepth?: (d: DecorDef, index: number) => number | null | undefined;
  /** Default depth of back decor (default 0: the walk plane). */
  defaultDepth?: number;
  /** Decor sprite id prefixes to hide (the old water pieces, front bollards the rows replace). */
  hideDecor?: readonly string[];
  /** Background generator ids that are sky (never lifted). Default DEFAULT_SKY_GENS. */
  skyLayers?: readonly string[];
  /** Contact shadow strength 0..1 (spec §3.7: ams 0.3, oldenzaal 0.35, the church 0.45). Default 0.3; 0 = none. */
  shadow?: number;
  /**
   * u positions the front rows keep FRONT_CLEAR px away from (spawn points, pickups, hostages,
   * script doors: the section's script places them, so the kit lists them here).
   */
  keepClear?: readonly number[];
}

/** Background generators that are sky by default (not lifted). */
export const DEFAULT_SKY_GENS: readonly string[] = ['sky-gradient', 'clouds', 'oz-sky'];
