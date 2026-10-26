/**
 * A raised drawbridge in the walk path (docs/design/floor.md §11 R2, the side canal of `ams` a: "the
 * bridge is up, so we jump over the boats"). The street's lane leads to it and stops: a stop line
 * (painter), barrier arms down across the lane on both banks with red lamps on their posts, the
 * pole rows stopping at the barriers; the leaf stands raised on the near bank BEHIND the heroes: it
 * spans the lane's far half only (from the far kerb to the centre line), so no solid part of it stands
 * in their walk depth (the lead's rule) — they walk and jump in front of it, "the bridge stands up
 * behind us". In front of it the bank lies open: the hinge pit's steel plate (painter, layout.ts
 * `HingePit`). The far bank shows its landing (a steel strip, painter).
 *
 * - The gallows: the drawbridge's side elevation (`decor/ams/drawbridge`, the old 2D art) in a back row
 *   on the far kerb, scaled for its depth — its leaf strip is the leaf's far end.
 * - The leaf: a face group (spec §11 R1) — a box `thick` px along u, `len` px high, from the far kerb
 *   to the lane's centre line: its deck (the lane's far half goes on up the raised leaf) toward the
 *   near bank, the steel underside toward the water, the white lattice of its near end. Drawn behind
 *   the world: the heroes pass in front of it (art only; the gap and the boats are physics, unchanged).
 * - The barriers: a post on each kerb (rows; the near one a front-row prop, low: it covers legs only),
 *   the arms as thin boxes across the lane at knee height, their tips stopping 3 world px short of the
 *   walk line (the heroes slip between them). The near arm is drawn over the world.
 */
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { Frame } from '../../../../../engine/render';
import { HdCanvas } from '../../../../art/hd/index';
import { hash2 } from '../../../../art/paint';
import { defineFloorProp, defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import { scaleFrame } from '../../../../mission/floor/scale';
import type { FaceDef, FaceGroupDef, PropRowDef } from '../../../../mission/floor/types';
import { G } from '../art';
import { deco, fr } from '../art-hd-ab-kit';
import { capFace, topFace, wallFace } from '../../../../mission/floor/faces';
import { depthBehind, depthPx } from './sides';
import { asphalt, dt, mod, paint } from './mat';

/** A raised drawbridge: the hinge (the near bank's edge), the leaf, its width in depth, the barriers. */
export interface Drawbridge {
  /** World u of the hinge (the bank's edge): the leaf stands just before it on the bank. */
  readonly hinge: number;
  /** The leaf's thickness along u and its length (raised: its height), world px. */
  readonly thick: number;
  readonly len: number;
  /**
   * The leaf's far edge (DEPTH: just behind the far kerb) and near edge (the lane's centre line, behind
   * the heroes' feet with room for their width: the near half of the lane ends at its stop line).
   */
  readonly far: number;
  readonly near: number;
  /** The lane's far edge (DEPTH) on the leaf's deck (its white edge line; the centre line runs along the near edge). */
  readonly laneFar: number;
  /** The barriers (u) on both banks, and the kerb-top depths their posts stand on. */
  readonly barriers: readonly number[];
  readonly postFar: number;
  readonly postNear: number;
}

/** The arms: their height over the street (world px) and how far their tips stop short of the walk line. */
const ARM_Y0 = 11;
const ARM_Y1 = 12.6;
const ARM_TIP = 3;

// ------------------------------------------------------------------------------- tiles

/** World v of a depth (the anchor's sprite px at depth 0 are world px: `depthPx(0, d)` is |v|). */
function vOf(depth: number): number {
  return depth > 0 ? -depthPx(0, depth) : depthPx(0, depth);
}

/** The leaf's depth span in tile px (world v between its near and far edge). */
function leafSpan(b: Drawbridge): number {
  return vOf(b.near) - vOf(b.far);
}

/** The leaf's deck, raised: a (down from its free end) × b (depth from the near edge): the red lane's far half, its lines, the steel kerb. */
function ensureDeckTile(b: Drawbridge): string {
  const id = `ams/drawbridge-deck/${b.hinge}`;
  if (hasFloorTile(id)) return id;
  const l = Math.ceil(leafSpan(b) + 0.5);
  // b from the near edge (world px; the centre line) to the lane's far edge.
  const bf = vOf(b.near) - vOf(b.laneFar);
  defineFloorTile(id, {
    w: b.len,
    h: Math.ceil(l / 4) * 4,
    paint: (a, bb, d) => {
      const X = Math.floor(bb * d);
      const Y = Math.floor(a * d);
      // The free end's steel nose; cross girders every 16 px show as seams.
      if (a < 2) return dt(PAL_HD.steel, a < 0.7 ? 5.4 : 3.2, X, Y);
      if (mod(a, 16) < 0.8) return dt(PAL_HD.steel, 2.2, X, Y);
      if (bb > bf + 0.4) {
        // The far pavement's steel tread plate.
        return dt(PAL_HD.steel, 3 + ((X + Y) & 2 ? 0.5 : 0) + (hash2(X, Y, 3) - 0.5) * 0.4, X, Y);
      }
      // The lane's far half: its white edge line, the dashed centre line along the near edge, red asphalt.
      const e = Math.max(1.4, 1 / d);
      if (bf - bb < e + 0.6 && bf - bb > 0.6) return paint(a, bb, X, Y, 0.3);
      if (bb > 0.3 && bb < 0.3 + e * 0.9 && mod(a, 26) < 14) return paint(a, bb, X, Y, 0.3);
      return asphalt(a, bb, X, Y, 0.1, 0);
    },
  });
  return id;
}

/** The leaf's underside toward the water: steel girders and cross beams (a = down, b = depth). */
function ensureUnderTile(): string {
  const id = 'ams/drawbridge-under';
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 28,
    h: 24,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      // Two long girders down the leaf (lit flange, web), cross beams between them, the deck plate behind.
      const g = mod(b + 4, 24);
      if (g < 3) return dt(PAL_HD.steel, g < 0.8 ? 5 : g > 2.2 ? 2.4 : 3.8, X, Y);
      const c = mod(a, 28);
      if (c < 2) return dt(PAL_HD.steel, c < 0.7 ? 4.2 : 2.6, X, Y);
      return dt(PAL_HD.steel, 2.9 + (hash2(X >> 1, Y >> 1, 9) - 0.5) * 0.4 - (c < 4.5 ? 0.6 : 0) - (g < 5 ? 0.5 : 0), X, Y);
    },
  });
  return id;
}

/** The leaf's near end: white lattice steel with the red-white edge band (the 2D leaf's look; a = down, b = across). */
function ensureEndTile(thick: number): string {
  const id = `ams/drawbridge-end/${thick}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 12,
    h: Math.ceil(thick / 4) * 4,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (b > thick - 2) return mod(a, 8) < 4 ? dt(PAL_HD.red, 4.6, X, Y) : dt(PAL_HD.gable, 5.6, X, Y);
      if (b < 1.2 || b > thick - 3.2) return dt(PAL_HD.gable, 4.4, X, Y);
      if (mod(a, 12) < 1.2) return dt(PAL_HD.gable, 4.8, X, Y);
      return dt(PAL_HD.gable, 2.4 + (mod(a + b, 6) < 1 ? 1 : 0), X, Y);
    },
  });
  return id;
}

/** A barrier arm: red and white along it (b), lit on top. */
function ensureArmTile(): string {
  const id = 'ams/barrier-arm';
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 2,
    h: 8,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      return mod(b, 8) < 4 ? dt(PAL_HD.red, 4.8 - a * 0.6, X, Y) : dt(PAL_HD.snow, 5.6 - a * 0.6, X, Y);
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- the barrier post

/** The barrier's post: a white housing with a red band and a red lamp on top (feet anchor). */
function barrierPostFrame(k: number, d: number): Frame {
  const W = Math.max(4, Math.ceil(4.6 * k + 1));
  const H = Math.max(8, Math.ceil(16 * k));
  const dd = d >= 2 ? d : 2;
  const c = new HdCanvas(W, H, dd);
  const white = deco(c, PAL_HD.gable, { lo: 2, hi: 6, spec: 0.3 });
  const red = deco(c, PAL_HD.red, { lo: 2, hi: 6, spec: 0.4 });
  const lamp = deco(c, PAL_HD.fire, { lo: 3, hi: 7, spec: 1, shine: 20 });
  const cx = W / 2;
  const K = (a: number): number => a * k;
  const foot = H - 0.5;
  c.box(cx - K(1.8), foot - K(12.5), K(3.6), K(12.5), { mat: white, z: 1, bevel: 0.3 });
  c.box(cx - K(1.8), foot - K(9), K(3.6), K(2), { mat: red, z: 1.1, bevel: 0.2 });
  c.ellipsoid(cx, foot - K(14), K(1.6), K(1.6), { mat: lamp, z: 1.6, round: 0.8 });
  const f = fr(c.render({ outline: 'C', sep: true, ao: 0.2, rimLight: 1 }), cx, H, dd);
  return d >= 2 ? f : scaleFrame(f, 1, 1);
}

defineFloorProp('ams/barrier-post', (scale, d) => barrierPostFrame(scale, d));

// ------------------------------------------------------------------------------- the floor parts

/** A thin box along the depth axis at u = 0 of its anchor: its top and its two sides (world px). */
function armFaces(far: number, near: number, tile: string, l: number): FaceDef[] {
  return [topFace(-1, 1, ARM_Y1, far, near, tile, l, true), wallFace(-1, ARM_Y0, ARM_Y1, near, far, -1, tile, l, 0, true), wallFace(1, ARM_Y0, ARM_Y1, near, far, 1, tile, l, 0, true)];
}

/** The drawbridge's rows (the gallows, the barrier posts) and faces (the leaf, the arms). */
export function drawbridgeFloor(b: Drawbridge): { rows: PropRowDef[]; faces: FaceGroupDef[] } {
  const rows: PropRowDef[] = [
    // The gallows' side elevation at the far kerb: its leaf strip ends at the hinge (the sprite's leaf is 15 px from its anchor + 16).
    { name: 'drawbridge gallows', sprite: 'decor/ams/drawbridge', depth: b.postFar + 0.5, at: [b.hinge - b.thick - 16] },
    { name: 'barrier posts (far)', prop: 'ams/barrier-post', depth: b.postFar, at: [...b.barriers] },
    { name: 'barrier posts (near)', prop: 'ams/barrier-post', depth: b.postNear, at: [...b.barriers] },
  ];
  const lLeaf = Math.ceil(leafSpan(b) + 0.5);
  const thick = b.thick;
  const endTile = ensureEndTile(thick);
  const leaf: FaceDef[] = [
    // The deck toward the near bank (seen from the left), the underside toward the water, the near end.
    wallFace(0, 0, b.len, b.near, b.far, -1, ensureDeckTile(b), lLeaf, 0, true),
    wallFace(thick, 0, b.len, b.near, b.far, 1, ensureUnderTile(), lLeaf, 0, true),
    capFace(0, thick, 0, b.len, b.near, endTile, true),
  ];
  const faces: FaceGroupDef[] = [{ name: 'drawbridge leaf', x: b.hinge - thick, y: G, depth: 0, order: b.postFar + 0.4, faces: leaf }];
  const arm = ensureArmTile();
  // The tips: 3 world px short of the walk line on each side.
  const tipFar = depthBehind(0, ARM_TIP);
  const tipNear = depthBehind(0, -ARM_TIP);
  for (const u of b.barriers) {
    const lf = Math.ceil(depthPx(tipFar, b.postFar));
    const ln = Math.ceil(depthPx(b.postNear, tipNear));
    faces.push({ name: `barrier arm (far) @${u}`, x: u, y: G, depth: 0, order: b.postFar - 0.1, faces: armFaces(b.postFar, tipFar, arm, lf) });
    faces.push({ name: `barrier arm (near) @${u}`, x: u, y: G, depth: 0, order: b.postNear + 0.1, front: true, faces: armFaces(tipNear, b.postNear, arm, ln) });
  }
  return { rows, faces };
}
