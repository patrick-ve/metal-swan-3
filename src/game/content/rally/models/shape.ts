/**
 * A car body's shape in metres (docs/design/rally.md §6): the numbers one model's mesh
 * (models/loft.ts) and its painter (tex/*.ts) share, and the cross-sections (`Station`s) of the
 * loft. A three-box car of the era: a bonnet, a raked windscreen, a long roof, an upright tail; the
 * sides upright up to the belt, the glass leaning in to the roof; octagonal wheel arches.
 *
 * Model space: the nose points +z, y up, +x the car's left, the wheels on y = 0. Pure.
 */
import type { Station } from './loft';

export type Line = readonly (readonly [number, number])[];

export interface ShapeParams {
  readonly nose: number;
  readonly tail: number;
  /** Half width of the upright sides, and of the chamfered end sections. */
  readonly halfW: number;
  readonly endW: number;
  readonly wheelR: number;
  readonly wheelW: number;
  /** The wheel centres' |x| and z (front, rear). */
  readonly wheelX: number;
  readonly wheelF: number;
  readonly wheelB: number;
  readonly archR: number;
  /** The arch's 45° stations sit at ± archD from the wheel centre. */
  readonly archD: number;
  readonly sill: number;
  /** The bumpers' lower edge, used where |z| is beyond `endZone`. */
  readonly endBottom: number;
  readonly endZone: number;
  /** The side glass' foot, the glass top, the roof height. */
  readonly belt: number;
  readonly glassTop: number;
  readonly roof: number;
  /** The top line (z, y) from the nose to the tail. */
  readonly top: Line;
  /** The windscreen's foot and top (z, y). */
  readonly screenFoot: readonly [number, number];
  readonly screenTop: readonly [number, number];
  /** Top half widths: at the nose, on the bonnet, at the windscreen's foot, on the roof. */
  readonly noseTopW: number;
  readonly bonnetW: number;
  readonly screenFootW: number;
  readonly roofW: number;
  /** The tail's top half widths (z, wt) behind the roof, nose → tail. */
  readonly tailW: Line;
  /** The bonnet's shoulder sits this far under its top. */
  readonly shoulderDrop: number;
  /** The side glass' front edge is this far behind the windscreen line. */
  readonly aInset: number;
}

/** Piecewise-linear y of a polyline at z (z descending along the line; clamped at the ends). */
export function lineY(line: Line, z: number): number {
  if (z >= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    if (z >= line[i][0]) {
      const [z0, y0] = line[i - 1];
      const [z1, y1] = line[i];
      return z1 === z0 ? y1 : y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
    }
  }
  return line[line.length - 1][1];
}

export class CarShape {
  readonly p: ShapeParams;

  constructor(p: ShapeParams) {
    this.p = p;
  }

  /** The bottom of the side panel at z: the arch over a wheel, else the sill (the bumpers at the ends). */
  bottom(z: number): number {
    const p = this.p;
    for (const zw of [p.wheelF, p.wheelB]) {
      const dz = z - zw;
      if (dz * dz <= p.archR * p.archR + 1e-9) return p.wheelR + Math.sqrt(Math.max(0, p.archR * p.archR - dz * dz));
    }
    return z > p.endZone || z < -p.endZone ? p.endBottom : p.sill;
  }

  /** The z of the side glass' front edge at height y (the windscreen line, inset). */
  aPillarZ(y: number): number {
    const [fz, fy] = this.p.screenFoot;
    const [tz, ty] = this.p.screenTop;
    return fz + ((tz - fz) * (y - fy)) / (ty - fy) - this.p.aInset;
  }

  /** The cross-section at z. */
  station(z: number): Station {
    const p = this.p;
    const yt = lineY(p.top, z);
    const end = z >= p.nose - 1e-6 || z <= p.tail + 1e-6;
    const w = end ? p.endW : p.halfW;
    const bonnet = z > p.screenFoot[0] + 1e-6;
    let ym: number;
    let wt: number;
    if (bonnet) {
      ym = yt - p.shoulderDrop;
      wt = z >= p.nose - 1e-6 ? p.noseTopW : p.bonnetW;
    } else {
      ym = p.belt;
      if (z > p.screenTop[0]) wt = p.screenFootW + ((p.roofW - p.screenFootW) * (p.screenFoot[0] - z)) / (p.screenFoot[0] - p.screenTop[0]);
      else wt = z >= p.tailW[0][0] ? p.roofW : lineY(p.tailW, z);
    }
    return { z, yb: this.bottom(z), ym, yt, wb: w, wm: w, wt };
  }

  /** The stations of an arch round a wheel at zw (front to back), with a sill station each side. */
  archZ(zw: number): number[] {
    const r = this.p.archR;
    const d = this.p.archD;
    return [zw + r + 0.03, zw + r, zw + d, zw, zw - d, zw - r, zw - r - 0.03];
  }

  /** Stations at the given z values, sorted nose → tail, near-duplicates (< 5 mm) merged. */
  stations(zs: readonly number[]): Station[] {
    const sorted = [...zs].sort((a, b) => b - a);
    const out: number[] = [];
    for (const z of sorted) if (out.length === 0 || out[out.length - 1] - z > 0.005) out.push(z);
    return out.map((z) => this.station(z));
  }
}
