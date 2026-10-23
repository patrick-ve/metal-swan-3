/**
 * The car models' extra data beyond `RallyModel` (rally/api.ts; docs/api/rally.md "A.C The cars"):
 * the anchors DRIVE and the scene need (the collision box, the wheel centres and radius, the lamp
 * positions, the bumper-camera mount) and the mesh ids of the parts that are drawn apart (the
 * spinning wheels, the lights wave B switches on). Every model of content/rally/models is a
 * `RallyCarModel`; `carModelInfo(model)` narrows a registry `RallyModel` to it.
 *
 * Model space: the nose points +z, y up, +x is the car's LEFT side, the wheels stand on y = 0;
 * metres. Pure.
 */
import type { Mat4 } from '../../../../engine/r3/mat';
import { mat4Multiply, mat4RotateX, mat4RotateY } from '../../../../engine/r3/mat';
import type { RallyModel } from '../../../rally/api';

export type P3 = readonly [number, number, number];

/** One wheel: its centre, radius and width, and the local mesh drawn there. */
export interface WheelAnchor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Radius (m): the spin is distance / r. */
  readonly r: number;
  readonly width: number;
  readonly front: boolean;
  /** +x side (the car's left). */
  readonly left: boolean;
  /** The local wheel mesh (centre at the origin, the axle along x; its rim faces outward). */
  readonly mesh: string;
}

/** The collision box in model space (m). */
export interface CarBox {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Lamp centres (model space) per function; empty when the car has none. */
export interface CarLamps {
  readonly head: readonly P3[];
  readonly tail: readonly P3[];
  readonly brake: readonly P3[];
  /** The left (+x) and right indicators, front and rear. */
  readonly indL: readonly P3[];
  readonly indR: readonly P3[];
  /** Extra spot lamps (the push bar's, the roof lamps). */
  readonly spots: readonly P3[];
  /** The police beacons (blue). */
  readonly beacons: readonly P3[];
}

export interface CarAnchors {
  /** The body's size (m): length along z, width along x, height along y (roof gear included). */
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly box: CarBox;
  readonly wheelbase: number;
  /** The distance between the left and right wheel centres. */
  readonly track: number;
  /** FL, FR, RL, RR. */
  readonly wheels: readonly WheelAnchor[];
  readonly lamps: CarLamps;
  /** The bumper camera's eye (model space). */
  readonly bumperCam: P3;
}

/** The light meshes (emissive, blend 'add'; drawn with the car's matrix when the lamp is on). */
export interface CarLightParts {
  readonly head: string;
  readonly tail: string;
  readonly brake: string;
  readonly indL: string;
  readonly indR: string;
  /** The push bar's / roof lamps, when the car has them. */
  readonly spots?: string;
  /** The police beacons: two meshes for the alternating flash. */
  readonly beacons?: readonly [string, string];
}

export interface RallyCarModel extends RallyModel {
  /** `parts` without the static wheels: drawn with the car's matrix when the wheels spin apart. */
  readonly body: readonly string[];
  /** The four wheels in place (one mesh, the last of `parts`). */
  readonly wheelsStatic: string;
  readonly anchors: CarAnchors;
  readonly lights: CarLightParts;
  /** A far, low-poly version (same page): its parts (drawn with the car's matrix) and triangles. */
  readonly lod: { readonly parts: readonly string[]; readonly tris: number };
  /** The CLUT rows of the page by name (row 0 = the model's own; more = palette swaps). */
  readonly rows: readonly string[];
  /** Triangles of the light meshes (not in `tris`). */
  readonly lightTris: number;
}

/** The car data of a registry model, or null for a model without it (PREP's box stub). */
export function carModelInfo(m: RallyModel | null | undefined): RallyCarModel | null {
  return m && 'anchors' in m && 'wheelsStatic' in m ? (m as RallyCarModel) : null;
}

const tmpA = new Float32Array(16);
const tmpB = new Float32Array(16);
const tmpC = new Float32Array(16);

/**
 * A wheel's world matrix: `car` (the car's matrix) · translate(the anchor) · rotateY(steer) ·
 * rotateX(spin). `steer` + = left (front wheels only; pass 0 for the rear); `spin` = rolled distance
 * / r (+ = rolling forward). No allocation (module scratch); writes `out` and returns it.
 */
export function poseWheel<M extends Mat4>(out: M, car: Mat4, w: WheelAnchor, steer: number, spin: number): M {
  mat4RotateY(tmpA, steer);
  tmpA[12] = w.x;
  tmpA[13] = w.y;
  tmpA[14] = w.z;
  mat4RotateX(tmpB, spin);
  mat4Multiply(tmpC, tmpA, tmpB);
  return mat4Multiply(out, car, tmpC);
}
