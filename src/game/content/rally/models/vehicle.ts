/**
 * FIELD's vehicle kit (wave B; docs/design/rally.md §6, §7.3, §7.4): what the rally teams' and the
 * traffic's models share beyond CARS' building blocks (models/loft.ts, parts.ts, tex/car-sheet.ts) —
 * `assemble` (the wheels, the shadow, the lamps, the far version and the anchors of a
 * `RallyCarModel`), panels and prisms for boxy bodies, and the painters' helpers (windows, scaled
 * lettering, cap lamps). Model space as CARS': the nose +z, y up, +x the LEFT side, the wheels on
 * y = 0. Pure; setup code (it allocates freely); deterministic.
 */
import type { TexturePage } from '../../../../engine/view3d';
import { cosT, sinT, TAU } from '../../../../engine/r3/trig';
import { MeshBuilder, type P3 as MP3 } from '../mesh';
import { S, type Slot } from '../tex/car-palette';
import type { CarSheet } from '../tex/car-sheet';
import type { TexRect } from '../tex/kit';
import { glyphRows, letterWidth } from '../tex/letters';
import { blobShadow, face, GREY, wheel } from './loft';
import { lampMeshes, wheelAnchors, wheelMeshes, withBias, type LampQuad, type LampSet } from './parts';
import type { CarBox, P3, RallyCarModel } from './types';

export interface VehicleParts {
  readonly id: string;
  readonly sheet: CarSheet;
  readonly page: TexturePage;
  /** The body (loft, wells, plates, extras), built by the caller. */
  readonly body: MeshBuilder;
  /** The far version's body (the wheels are added here as 4-sided prisms). */
  readonly lod: MeshBuilder;
  /** The four spinning wheels: |x|, radius, width, the front and rear axle z; `sides` of the tread. */
  readonly wheel: { readonly x: number; readonly r: number; readonly w: number; readonly zf: number; readonly zb: number; readonly sides?: number };
  /** Static extra axles (a lorry's tandem, a coach's tag axle): their z; the same wheels with `axleSides` sides (default 4). */
  readonly axles?: readonly number[];
  readonly axleSides?: number;
  /** The blob shadow: half width, half length, the soft edge. */
  readonly shadow: readonly [number, number, number];
  readonly lamps: LampSet;
  readonly box: CarBox;
  readonly bumperCam: P3;
  /** CLUT row names (row 0 = the model's own). */
  readonly rows: readonly string[];
}

/** A lamp quad's centre. */
function centres(qs: readonly LampQuad[]): [number, number, number][] {
  return qs.map((x) => [x[0][0], x[0][1], x[0][2]]);
}

/** The `RallyCarModel` of a vehicle: its spinning wheels, the shadow, the lamps, the far version and the anchors. */
export function assemble(p: VehicleParts): RallyCarModel {
  const { id, sheet: sh, page: pg } = p;
  const page = pg.id;
  const W = p.wheel;
  const anchors = wheelAnchors(id, W.x, W.r, W.w, W.zf, W.zb);
  for (const z of p.axles ?? []) for (const g of [1, -1]) wheel(p.body, sh, W.r, W.w, g > 0, p.axleSides ?? 4, [g * W.x, W.r, z]);
  const body = p.body.build(`car/${id}/body`, page, 0);
  const wheels = wheelMeshes(id, sh, page, anchors, W.sides ?? 8);
  const shb = new MeshBuilder();
  blobShadow(shb, sh, p.shadow[0], p.shadow[1], p.shadow[2]);
  const shadow = withBias(shb.build(`car/${id}/shadow`, page, 0, { blend: 'sub', emissive: true }), 4);
  const lamps = lampMeshes(id, sh, page, p.lamps);
  for (const w of anchors) wheel(p.lod, sh, w.r, w.width, w.left, 4, [w.x, w.y, w.z]);
  const lod = p.lod.build(`car/${id}/lod`, page, 0);
  const L = p.lamps;
  const b = p.box;
  return {
    id,
    meshes: [body, ...wheels.meshes, shadow, ...lamps.meshes, lod],
    pages: [pg],
    parts: [body.id, shadow.id, `car/${id}/wheels`],
    tris: p.body.triangles + shb.triangles + wheels.tris,
    body: [body.id, shadow.id],
    wheelsStatic: `car/${id}/wheels`,
    anchors: {
      length: b.z1 - b.z0,
      width: b.x1 - b.x0,
      height: b.y1,
      box: b,
      wheelbase: W.zf - W.zb,
      track: 2 * W.x,
      wheels: anchors,
      lamps: { head: centres(L.head), tail: centres(L.tail), brake: centres(L.brake), indL: centres(L.indL), indR: centres(L.indR), spots: centres(L.spots ?? []), beacons: (L.beacons ?? []).flatMap(centres) },
      bumperCam: p.bumperCam,
    },
    lights: {
      head: `car/${id}/head`,
      tail: `car/${id}/tail`,
      brake: `car/${id}/brake`,
      indL: `car/${id}/ind-l`,
      indR: `car/${id}/ind-r`,
      ...(L.spots ? { spots: `car/${id}/spots` } : {}),
    },
    lod: { parts: [lod.id, shadow.id], tris: p.lod.triangles + shb.triangles },
    rows: p.rows,
    lightTris: lamps.tris,
  };
}

/** The usual lamp set: two headlamps, two tail / brake lamps, the four indicators (half sizes in m). */
export function lampSet(o: {
  nose: number;
  tail: number;
  head: readonly [number, number, number, number];
  rear: readonly [number, number, number, number];
  indF: readonly [number, number, number, number];
  indB: readonly [number, number, number, number];
}): LampSet {
  const zf = o.nose + 0.012;
  const zb = o.tail - 0.012;
  const pair = (q: readonly [number, number, number, number], z: number, nz: number): LampQuad[] => [-1, 1].map((g): LampQuad => [[g * q[0], q[1], z], [0, 0, nz], q[2], q[3]]);
  const one = (q: readonly [number, number, number, number], g: number, z: number, nz: number): LampQuad => [[g * q[0], q[1], z], [0, 0, nz], q[2], q[3]];
  return {
    head: pair(o.head, zf, 1),
    tail: pair(o.rear, zb, -1),
    brake: pair(o.rear, zb, -1),
    indL: [one(o.indF, 1, zf, 1), one(o.indB, 1, zb, -1)],
    indR: [one(o.indF, -1, zf, 1), one(o.indB, -1, zb, -1)],
  };
}

// -- boxy geometry ------------------------------------------------------------------------------

/**
 * A side panel at x (the +x side faces left), z0 → z1 (any order), y0 → y1, mapped onto the sheet's
 * side texture and cut into `n` pieces along z (the affine warp stays mild on long panels).
 */
export function sidePanel(mb: MeshBuilder, sh: CarSheet, x: number, z0: number, z1: number, y0: number, y1: number, n = 1): void {
  const side = x > 0 ? 'L' : 'R';
  const g = x > 0 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const a = z0 + ((z1 - z0) * k) / n;
    const b = z0 + ((z1 - z0) * (k + 1)) / n;
    const pts: P3[] = [
      [x, y0, a],
      [x, y0, b],
      [x, y1, b],
      [x, y1, a],
    ];
    face(mb, pts, pts.map((p) => [sh.sideU(side, p[2]), sh.sideV(side, p[1])] as const), [g, 0, 0]);
  }
}

/** An upright end panel (the front +z or the back −z) at z, x ±hw, y0 → y1, mapped on the sheet's cap texture. */
export function endPanel(mb: MeshBuilder, sh: CarSheet, end: 'front' | 'back', z: number, hw: number, y0: number, y1: number): void {
  const pts: P3[] = [
    [-hw, y0, z],
    [hw, y0, z],
    [hw, y1, z],
    [-hw, y1, z],
  ];
  face(mb, pts, pts.map((p) => [sh.capU(end, p[0]), sh.capV(end, p[1])] as const), [0, 0, end === 'front' ? 1 : -1]);
}

/** A flat roof (y) from z0 to z1, x ±hw, mapped onto the sheet's top texture from arc `s0` (+ = toward the tail), in `n` pieces. */
export function roofPanel(mb: MeshBuilder, sh: CarSheet, y: number, z0: number, z1: number, hw: number, s0: number, n = 1): void {
  for (let k = 0; k < n; k++) {
    const a = z0 + ((z1 - z0) * k) / n;
    const b = z0 + ((z1 - z0) * (k + 1)) / n;
    const sa = s0 + Math.abs(a - z0);
    const sb = s0 + Math.abs(b - z0);
    const pts: P3[] = [
      [hw, y, a],
      [-hw, y, a],
      [-hw, y, b],
      [hw, y, b],
    ];
    const uv = [
      [sh.topU(hw), sh.topV(sa)],
      [sh.topU(-hw), sh.topV(sa)],
      [sh.topU(-hw), sh.topV(sb)],
      [sh.topU(hw), sh.topV(sb)],
    ] as const;
    face(mb, pts, uv, [0, 1, 0]);
  }
}

/** A box with every face one texture rectangle (uv corners u0 v0 u1 v1), no bottom. */
export function texBox(mb: MeshBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, uv: readonly [number, number, number, number], col: MP3 = GREY): void {
  mb.box(x0, y0, z0, x1, y1, z1, () => uv, col, true);
}

/** A solid-colour box (a slot of the sheet). */
export function slotBox(mb: MeshBuilder, sh: CarSheet, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, slot: Slot, col: MP3 = GREY): void {
  texBox(mb, x0, y0, z0, x1, y1, z1, sh.solid(slot), col);
}

/**
 * An upright frustum (a cone of fries, an ice-cream cone): `n` sides from radius r0 at y0 to r1 at y1
 * round (x, z), its sides mapped across `r` (u around, v down), the top cap a slot; `cap` false
 * leaves the top open. Returns nothing; the faces face outward.
 */
export function frustum(mb: MeshBuilder, sh: CarSheet, x: number, z: number, y0: number, y1: number, r0: number, r1: number, n: number, r: TexRect, cap: Slot | null): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const b = ((k + 1) / n) * TAU;
    const ca = cosT(a), sa = sinT(a), cb = cosT(b), sb = sinT(b);
    const pts: P3[] = [
      [x + ca * r0, y0, z + sa * r0],
      [x + cb * r0, y0, z + sb * r0],
      [x + cb * r1, y1, z + sb * r1],
      [x + ca * r1, y1, z + sa * r1],
    ];
    const u0 = r.x + (r.w * k) / n;
    const u1 = r.x + (r.w * (k + 1)) / n;
    const mid = (a + b) / 2;
    face(
      mb,
      pts,
      [
        [u0, r.y + r.h],
        [u1, r.y + r.h],
        [u1, r.y],
        [u0, r.y],
      ],
      [cosT(mid), (r0 - r1) / Math.max(0.05, y1 - y0), sinT(mid)],
    );
  }
  if (cap !== null) {
    const uv = sh.solid(cap);
    const ring: P3[] = [];
    for (let k = 0; k < n; k++) ring.push([x + cosT((k / n) * TAU) * r1, y1, z + sinT((k / n) * TAU) * r1]);
    face(
      mb,
      ring,
      ring.map(() => [uv[0], uv[1]] as const),
      [0, 1, 0],
    );
  }
}

/** A downward cone (an ice-cream cone): `n` sides from a point at (x, y0, z) up to radius r at y1, mapped across `rect`. */
export function cone(mb: MeshBuilder, x: number, z: number, y0: number, y1: number, rad: number, n: number, rect: TexRect): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const b = ((k + 1) / n) * TAU;
    const pts: P3[] = [
      [x, y0, z],
      [x + cosT(b) * rad, y1, z + sinT(b) * rad],
      [x + cosT(a) * rad, y1, z + sinT(a) * rad],
    ];
    const mid = (a + b) / 2;
    const u0 = rect.x + (rect.w * k) / n;
    const u1 = rect.x + (rect.w * (k + 1)) / n;
    face(
      mb,
      pts,
      [
        [(u0 + u1) / 2, rect.y + rect.h],
        [u1, rect.y],
        [u0, rect.y],
      ],
      [cosT(mid), -rad / Math.max(0.05, y1 - y0), sinT(mid)],
    );
  }
}

// -- painting -----------------------------------------------------------------------------------

/** A window of a side: z from `z0` (rear) to `z1` (front), y from `y0` to `y1`; the front edge leans back by `lean` m per m up. */
export interface Win {
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
  readonly lean?: number;
  /** The rear edge leans forward by this (m per m up). */
  readonly leanB?: number;
}

/** 0 outside a window, 1 on its frame (`f` m wide), 2 the glass. */
export function inWin(w: Win, z: number, y: number, f = 0.035): 0 | 1 | 2 {
  if (y < w.y0 - f || y > w.y1 + f) return 0;
  const up = y - w.y0;
  const zf = w.z1 - (w.lean ?? 0) * up;
  const zb = w.z0 + (w.leanB ?? 0) * up;
  if (z > zf + f || z < zb - f) return 0;
  if (y < w.y0 || y > w.y1 || z > zf || z < zb) return 1;
  return 2;
}

/** The arch lip round a wheel at z (true within `lip` m outside the arch's radius, above the axle line). */
export function archLip(z: number, y: number, zw: number, r: number, archR: number, lip = 0.035): boolean {
  const dz = z - zw;
  const dy = y - r;
  const d = Math.sqrt(dz * dz + dy * dy);
  return d < archR + lip && y > r - 0.02;
}

/**
 * Text at `scale` texels per glyph cell (big team names on the vans), its top-left at texel (x, y) of
 * `r`, in the reading direction (never mirrored).
 */
export function textScaled(sh: CarSheet, r: TexRect, s: string, x: number, y: number, slot: number, scale: number, gap = 1): void {
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of s) {
    const rows = glyphRows(ch);
    for (let gy = 0; gy < rows.length; gy++) {
      const row = rows[gy];
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== '#') continue;
        for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) sh.b.set(r, cx + gx * scale + a, cy + gy * scale + b, slot);
      }
    }
    cx += (rows[0].length + gap) * scale;
  }
}

/** The width (texels) of scaled text. */
export function textScaledWidth(s: string, scale: number, gap = 1): number {
  return letterWidth(s, 'small', gap) * scale;
}

/** Scaled text on a side, centred at z = zc, its top at y = yTop (reads left to right on both sides). */
export function sideTextScaled(sh: CarSheet, side: 'L' | 'R', s: string, zc: number, yTop: number, slot: number, scale: number, gap = 1): void {
  const r = side === 'L' ? sh.sideL : sh.sideR;
  const w = textScaledWidth(s, scale, gap);
  textScaled(sh, r, s, Math.round(sh.sideU(side, zc) - r.x - w / 2), Math.round((sh.frame.y0 - yTop) * sh.D), slot, scale, gap);
}

/** Scaled text across the top at arc `at`, centred on the car's centre line (reads from behind). */
export function topTextScaled(sh: CarSheet, s: string, at: number, slot: number, scale: number, gap = 1): void {
  const w = textScaledWidth(s, scale, gap);
  textScaled(sh, sh.top, s, Math.round(sh.frame.x0 * sh.D - w / 2), Math.round(at * sh.D), slot, scale, gap);
}

/** Scaled text on an end, centred at x = xc, its top at y = yTop. */
export function capTextScaled(sh: CarSheet, end: 'front' | 'back', s: string, xc: number, yTop: number, slot: number, scale: number, gap = 1): void {
  const r = end === 'front' ? sh.front : sh.back;
  const w = textScaledWidth(s, scale, gap);
  textScaled(sh, r, s, Math.round(sh.capU(end, xc) - r.x - w / 2), Math.round(sh.capV(end, yTop) - r.y), slot, scale, gap);
}

/** A slot for the shared parts of a side texel (bumpers, the sill, the arch lips), or −1. */
export function lowerParts(z: number, y: number, o: { bumperF: number; bumperB: number; bumperTop: number; bumper: Slot; sill: number; wheels: readonly number[]; r: number; archR: number; lip: Slot }): number {
  if ((z > o.bumperF || z < o.bumperB) && y < o.bumperTop) return y > o.bumperTop - 0.03 && o.bumper === S.SILVER ? S.LENS : o.bumper;
  if (y < o.sill) return S.PLASTIC;
  for (const zw of o.wheels) if (archLip(z, y, zw, o.r, o.archR)) return o.lip;
  return -1;
}
