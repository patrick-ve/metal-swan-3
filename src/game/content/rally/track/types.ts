/**
 * The types of the compressed A10 (docs/design/rally.md §3, §4, §5; docs/api/rally.md "A.T The
 * track"). `A10Track` extends the frozen `RallyTrack` contract (rally/api.ts) with ADDED fields:
 * the sections, the segments and their culling, the frame sampler, the lanes, the AI lines and the
 * event anchors for wave B (gantries, speed cameras, the average-speed zone, road works, the
 * spitsstrook, S-exits, landmarks). Pure types and constants: the race sim may import them with
 * `import type` (the content stays lazy).
 *
 * Space (engine/view3d.ts): y up, metres; x = east, z = south (a map with north up draws +z down);
 * the race runs clockwise (seen from above), so the inner carriageway's right side faces the
 * city. Lateral offsets: + = right of the driving direction.
 */
import type { Vec3 } from '../../../../engine/r3/vec';
import type { CullSet } from '../../../../engine/r3/cull';
import type { Cam3, DrawItem } from '../../../../engine/view3d';
import type { RallyTrack } from '../../../rally/api';

/** The ten sections, clockwise from the Zuidas (spec §3). */
export const SECTION_IDS = ['zuidas', 'nieuwe-meer', 'ring-west', 'sloterdijk', 'coentunnel', 'noord', 'zeeburgertunnel', 'oost', 'amstel', 'rai'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Flags of a stretch of road (`TrackSample.flags`, `TrackSegment.flags`). */
export const TF = {
  /** Inside a tunnel tube (radio static, the sodium lamps). */
  tunnel: 1,
  /** The open ramp of a tunnel (the road below the ground between walls). */
  cutting: 2,
  /** A bridge deck over water. */
  bridge: 4,
  /** A viaduct deck over a road. */
  viaduct: 8,
  /** Noise barriers on the outer edge. */
  noise: 16,
  /** The average-speed zone (trajectcontrole). */
  avgZone: 32,
  /** The hard shoulder opens as a spitsstrook on lap 3 (green arrows). */
  spits: 64,
  /** A road-works zone of lap 2. */
  roadworks: 128,
  /** An exit or a junction: block marks on the shoulder line. */
  exit: 256,
  /** Water above a tunnel tube (the lid is water). */
  water: 512,
  /** On an embankment (the road above the ground). */
  raised: 1024,
} as const;

/** The frame and the road at an arc length (`A10Track.sample`). */
export interface TrackSample {
  /** The centre line (between the barrier faces of the driven carriageway). */
  readonly pos: Vec3;
  /** Unit tangent (the driving direction, with the slope). */
  readonly fwd: Vec3;
  /** Horizontal unit vector to the right. */
  readonly right: Vec3;
  /** Unit up of the frame (right × … orthonormal with fwd and right). */
  readonly up: Vec3;
  /** Barrier face to barrier face (m). */
  width: number;
  /** Driving lanes (the shoulder not counted). */
  lanes: number;
  /** TF bits. */
  flags: number;
  /** Index into `A10Track.sections`. */
  section: number;
  /** Signed curvature of the centre line (1/m; + = a left bend). */
  curv: number;
}

export function trackSample(): TrackSample {
  return { pos: [0, 0, 0], fwd: [0, 0, 1], right: [-1, 0, 0], up: [0, 1, 0], width: 0, lanes: 0, flags: 0, section: 0, curv: 0 };
}

/** A section of the ring (spec §3). */
export interface TrackSection {
  readonly id: SectionId;
  /** The name in our lettering (HUD, signs, the radio). */
  readonly name: string;
  readonly s0: number;
  readonly s1: number;
}

/** A piece of road of about 20 m: its arc lengths, flags, meshes and bounds. */
export interface TrackSegment {
  readonly i: number;
  readonly s0: number;
  readonly s1: number;
  /** TF bits of any part of it. */
  readonly flags: number;
  readonly section: number;
  /** The sunlit mesh (road, barriers, verges, ...). */
  readonly mesh: string;
  /** The tunnel interior (emissive: lit by its own lamps), or null. */
  readonly inner: string | null;
  /** Triangles of both meshes. */
  readonly tris: number;
  /** The far level of detail (one row of polygons along): its meshes and triangles. */
  readonly meshFar: string;
  readonly innerFar: string | null;
  readonly trisFar: number;
  /** The centre line at the middle (the level-of-detail distance). */
  readonly mid: readonly [number, number, number];
}

/** A far-ground chunk (flat fields out to the fog edge; several segments long). */
export interface TrackChunk {
  readonly s0: number;
  readonly s1: number;
  readonly mesh: string;
  readonly tris: number;
}

export type GantryKind = 'start' | 'matrix' | 'avg-start' | 'avg-end' | 'exit';
/** A gantry over the driven carriageway (placeholder boxes in wave A; wave B dresses them). */
export interface TrackGantry {
  readonly s: number;
  readonly kind: GantryKind;
  readonly section: number;
}

/** A speed camera (flitspaal) beside the road. */
export interface TrackCamera {
  readonly s: number;
  /** Lateral offset of the pole (m, + = right). */
  readonly side: number;
  /** km/h. */
  readonly limit: number;
  readonly section: number;
}

/** A stretch of arc length (s1 may be below s0 when it wraps over the start line). */
export interface TrackRange {
  readonly s0: number;
  readonly s1: number;
}

/** The average-speed zone (one per lap, in RING WEST): its gantries and limit. */
export interface TrackAvgZone extends TrackRange {
  readonly limit: number;
}

/** A road-works zone of lap 2: the closed lanes (0 = the left lane) and the limit. */
export interface TrackRoadworks extends TrackRange {
  readonly closed: readonly number[];
  readonly limit: number;
  readonly section: number;
}

/** A tunnel: the tube (s0..s1) and its ramps (ramp0 = where the road leaves the ground). */
export interface TrackTunnel extends TrackRange {
  readonly name: string;
  readonly ramp0: number;
  readonly ramp1: number;
}

/** A bridge (over water) or a viaduct (over a road): the deck. */
export interface TrackBridge extends TrackRange {
  readonly name: string;
  readonly kind: 'bridge' | 'viaduct';
}

/** An S-exit (the blue direction signs, our lettering): the off-ramp position. */
export interface TrackExit {
  readonly code: string;
  /** The place on the sign ('' = the number only). */
  readonly name: string;
  readonly s: number;
  readonly section: number;
}

/** A landmark anchor (wave B places the landmark): arc length, side (m, + = right). */
export interface TrackLandmark {
  readonly id: string;
  readonly s: number;
  readonly side: number;
  readonly section: number;
}

/**
 * The AI lines: sampled every `step` metres of arc length (index = floor(s / step)). `racing` is the
 * lateral offset of the racing line (m, + = right), `curv` the signed curvature (1/m), `lanes` the
 * offsets of the lane centres (0 = the left lane; the last entry = the hard shoulder).
 */
export interface TrackAiLines {
  readonly step: number;
  readonly count: number;
  readonly racing: Float64Array;
  readonly curv: Float64Array;
  readonly lanes: readonly number[];
}

/** The finish (and start) line. */
export interface TrackFinish {
  readonly s: number;
  readonly section: number;
}

/** A view's culler (`A10Track.createView`; view.ts `TrackView`). */
export interface TrackCuller {
  fill(cam: Readonly<Cam3>, aspect: number, far: number, out: DrawItem[], from?: number): number;
  readonly tris: number;
  readonly draws: number;
}

/** The compressed A10 (`buildTrack()`): the RallyTrack contract plus the ADDED fields. */
export interface A10Track extends RallyTrack {
  readonly sections: readonly TrackSection[];
  readonly segments: readonly TrackSegment[];
  readonly chunks: readonly TrackChunk[];
  /** Culling units: the segments (0..n−1), then the chunks (n..). */
  readonly cull: CullSet;
  /** The frame and the road at arc length s (wrapped). Allocates nothing with `out`. */
  sample(s: number, out?: TrackSample): TrackSample;
  /** The lateral offset of a lane's centre (0 = the left lane; `lanes` = the shoulder). */
  laneOffset(lane: number): number;
  /** TF bits at arc length s. */
  flagsAt(s: number): number;
  /** The section index at arc length s. */
  sectionAt(s: number): number;
  /** The AI lines. */
  readonly aiLines: TrackAiLines;
  /** The racing line's lateral offset at s (interpolated). */
  racingAt(s: number): number;
  /** The signed curvature at s (interpolated). */
  curvAt(s: number): number;
  readonly finish: TrackFinish;
  readonly gantries: readonly TrackGantry[];
  readonly cameras: readonly TrackCamera[];
  readonly avgZone: TrackAvgZone;
  readonly roadworks: readonly TrackRoadworks[];
  readonly spits: readonly TrackRange[];
  readonly tunnels: readonly TrackTunnel[];
  readonly bridges: readonly TrackBridge[];
  readonly exits: readonly TrackExit[];
  readonly landmarks: readonly TrackLandmark[];
  /**
   * A culler for one view (one per view: it keeps its own frustum and scratch): `fill(cam, aspect,
   * far, out, from)` writes the visible static items (near → far, the level of detail by distance)
   * into `out` from index `from`, sets `out.length` and returns the count; `tris` / `draws` hold the
   * last fill's numbers.
   */
  createView(): TrackCuller;
  /** The loop's closure gap before the fix (m; the layout closes it exactly). */
  readonly closure: number;
  /** Triangles of the whole track (all meshes). */
  readonly trisTotal: number;
}
