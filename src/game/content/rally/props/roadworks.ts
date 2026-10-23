/**
 * The road works' props and the police display (RULES, wave B; docs/design/rally.md §4 "lap 2", §5,
 * §7.4; docs/api/rally.md "B.R"): drawn by code on one small page (`WORKS_PAGE`, one 16-colour CLUT
 * from the PAL_HD ramps), our own designs:
 *
 * - **Cones** (pylonen): orange with two white bands, a taper of them from the far edge of the closed
 *   lane to the line before a zone, along the line through it, and a taper back after it.
 * - **Barrier boards** (afzethekken): red and white diagonal stripes across the closed lane on two
 *   posts, an amber lamp on top, where the rules' barrier bodies stand (works.ts).
 * - **The arrow-board truck** (pijlwagen): a yellow and white works lorry at the start of the closed
 *   lane with a raised black board at the back; its amber LED arrow points to the open lanes and
 *   flashes (`arrow` mesh), its amber beacons flash with it (`lamps`).
 * - **The yellow temporary lines**: a solid yellow line along the closed lanes, yellow dashes between
 *   the open ones (decals on the road).
 * - **A mobile speed camera** on a tripod on the verge where a zone has no fixed camera.
 * - **The police display**: a raised `STOP` / `POLITIE` matrix of red LEDs on the police estate's roof
 *   bar (our own lettering), drawn with the police car's matrix while it chases or stops someone.
 *
 * World geometry is built in world space from the track's spline (static: `m` null); it is cut
 * into pieces of `PIECE_LEN` m along a zone for the per-view culling. Pure and deterministic.
 */
import type { Color } from '../../../../engine/color';
import { splineSample, type SplineSample } from '../../../../engine/r3/spline';
import type { Mesh3, TexturePage } from '../../../../engine/view3d';
import type { RallyTrack } from '../../../rally/api';
import { PAGE_IDS } from '../../../rally/ids';
import { BARRIER_FROM, BARRIER_GAP, TAPER_LEN, taperSide, TRUCK_AT } from '../../../rally/rules/works';
import { wrapOff, type RulesPlan, type WorksPlan } from '../../../rally/rules/plan';
import { MeshBuilder, type P3, type UV4 } from '../mesh';
import { clutOf, PageBuilder, ramp, type TexRect } from '../tex/kit';

/** The page of the road works and the police display (the sky, lights and effects range 300–399). */
export const WORKS_PAGE = PAGE_IDS.works;
/** A zone's solid props are cut into pieces of this length (m) for the culling. */
export const PIECE_LEN = 80;
/** The cones' taper after a zone (m; the one before it is works.ts `TAPER_LEN`), the gap between the cones along it (m). */
export const TAPER_OUT = 40;
export const CONE_GAP = 8;
/** The decals float this far above the road (m) and carry a depth bias. */
const DECAL_Y = 0.03;
const DECAL_BIAS = 6;

/** The 16 colours (CLUT row 0). */
const C = {
  ink: 0,
  dark: 1,
  grey: 2,
  light: 3,
  white: 4,
  orangeDk: 5,
  orange: 6,
  redDk: 7,
  red: 8,
  yellowDk: 9,
  yellow: 10,
  amberHi: 11,
  amber: 12,
  ledOff: 13,
  led: 14,
  panel: 15,
} as const;

function worksClut(): Color[] {
  const hd = (name: Parameters<typeof ramp>[0], i: number): Color => ramp(name, i, i)[0];
  return clutOf(hd('ink', 0), hd('steel', 1), hd('steel', 3), hd('steel', 5), hd('steel', 7), hd('orange', 2), hd('orange', 3), hd('red', 3), hd('red', 5), hd('gold', 4), hd('gold', 5), hd('gold', 6), hd('orange', 4), hd('red', 1), hd('red', 6), hd('steel', 0));
}

/** The page's texture rectangles. */
interface WorksTex {
  readonly cone: TexRect;
  readonly board: TexRect;
  readonly yellow: TexRect;
  readonly dark: TexRect;
  readonly grey: TexRect;
  readonly truckYellow: TexRect;
  readonly truckWhite: TexRect;
  readonly glass: TexRect;
  readonly arrowBoard: TexRect;
  readonly arrowLit: TexRect;
  readonly lamp: TexRect;
  readonly camera: TexRect;
  readonly stop: TexRect;
  readonly politie: TexRect;
  readonly displayOff: TexRect;
}

/** Paint the page (once). */
export function buildWorksPage(): { page: TexturePage; tex: WorksTex } {
  const pb = new PageBuilder(WORKS_PAGE, 128, 128);
  pb.addRow(worksClut());
  const a = (w: number, h: number): TexRect => pb.alloc(w, h)!;
  // A cone: orange, two white bands, a darker side line (the shading of the era is baked a little).
  const cone = a(8, 16);
  pb.fill(cone, C.orange);
  pb.rect(cone, 0, 4, 8, 2, C.white);
  pb.rect(cone, 0, 9, 8, 2, C.white);
  pb.rect(cone, 6, 0, 2, 16, C.orangeDk);
  // A barrier board: red and white diagonal stripes, a thin dark frame.
  const board = a(32, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 32; x++) pb.set(board, x, y, ((x + y) >> 2) % 2 === 0 ? C.red : C.white);
  pb.rect(board, 0, 0, 32, 1, C.redDk);
  pb.rect(board, 0, 7, 32, 1, C.redDk);
  const flat = (i: number): TexRect => {
    const r = a(4, 4);
    pb.fill(r, i);
    return r;
  };
  const yellow = flat(C.yellow);
  const dark = flat(C.dark);
  const grey = flat(C.grey);
  // The works lorry: yellow with a white band; the windscreen dark glass.
  const truckYellow = a(16, 8);
  pb.fill(truckYellow, C.yellow);
  pb.rect(truckYellow, 0, 6, 16, 2, C.yellowDk);
  const truckWhite = a(16, 8);
  pb.fill(truckWhite, C.white);
  for (let x = 0; x < 16; x += 4) pb.rect(truckWhite, x, 3, 2, 2, C.red);
  const glass = flat(C.panel);
  // The arrow board: black with dim LED dots; the lit arrow (amber) is its own texture (an overlay).
  const arrowBoard = a(32, 32);
  pb.fill(arrowBoard, C.panel);
  for (let y = 2; y < 30; y += 3) for (let x = 2; x < 30; x += 3) pb.set(arrowBoard, x, y, C.ledOff);
  pb.rect(arrowBoard, 0, 0, 32, 1, C.yellow);
  pb.rect(arrowBoard, 0, 31, 32, 1, C.yellow);
  pb.rect(arrowBoard, 0, 0, 1, 32, C.yellow);
  pb.rect(arrowBoard, 31, 0, 1, 32, C.yellow);
  const arrowLit = a(32, 32);
  pb.fill(arrowLit, C.panel);
  // An arrow pointing to +u (the overlay flips it for the other side): shaft and head of LED dots.
  const dot = (x: number, y: number): void => {
    pb.set(arrowLit, x, y, C.amberHi);
    pb.set(arrowLit, x + 1, y, C.amber);
  };
  for (let x = 4; x <= 20; x += 2) for (let y = 13; y <= 18; y += 2) dot(x, y);
  for (let k = 0; k <= 10; k++) {
    dot(16 + k, 4 + k);
    dot(16 + k, 27 - k);
  }
  // The four corner lamps of the board.
  for (const [x, y] of [
    [2, 2],
    [28, 2],
    [2, 28],
    [28, 28],
  ] as const)
    pb.rect(arrowLit, x, y, 2, 2, C.amberHi);
  const lamp = a(4, 4);
  pb.fill(lamp, C.amber);
  pb.rect(lamp, 1, 1, 2, 2, C.amberHi);
  // The mobile camera: a grey box with a dark lens and a red rim.
  const camera = a(8, 8);
  pb.fill(camera, C.grey);
  pb.rect(camera, 2, 2, 4, 4, C.ink);
  pb.rect(camera, 3, 3, 2, 2, C.dark);
  pb.rect(camera, 0, 0, 8, 1, C.light);
  // The police display: STOP and POLITIE in red LEDs on black (our lettering), and the display off.
  const stop = a(48, 12);
  pb.fill(stop, C.panel);
  pb.text(stop, 'STOP', 24 - (4 * 5 - 1) / 2, 3, C.led, 'big');
  const politie = a(48, 12);
  pb.fill(politie, C.panel);
  pb.text(politie, 'POLITIE', 24 - (7 * 5 - 1) / 2, 3, C.led, 'big');
  const displayOff = a(8, 4);
  pb.fill(displayOff, C.panel);
  return { page: pb.build(), tex: { cone, board, yellow, dark, grey, truckYellow, truckWhite, glass, arrowBoard, arrowLit, lamp, camera, stop, politie, displayOff } };
}

const WHITE: P3 = [128, 128, 128];
const uv = (r: TexRect, flip = false): UV4 => (flip ? [r.x + r.w, r.y, r.x, r.y + r.h] : [r.x, r.y, r.x + r.w, r.y + r.h]);
/** The middle texel of a flat swatch (no bleeding at the edges). */
const mid = (r: TexRect): UV4 => [r.x + 1, r.y + 1, r.x + r.w - 1, r.y + r.h - 1];

/** A local frame at a lap offset: the road centre, forward and right (horizontal), up. */
interface Frame {
  p: [number, number, number];
  f: [number, number, number];
  r: [number, number, number];
}

function frameAt(track: RallyTrack, plan: RulesPlan, off: number, sp: SplineSample): Frame {
  const s = track.spline.wrap(track.startS + wrapOff(off, plan.L));
  track.spline.sample(s, sp);
  const fl = Math.sqrt(sp.t[0] * sp.t[0] + sp.t[2] * sp.t[2]) || 1;
  return { p: [sp.p[0], sp.p[1], sp.p[2]], f: [sp.t[0] / fl, 0, sp.t[2] / fl], r: [sp.r[0], 0, sp.r[2]] };
}

/** A point of a frame: `x` m right, `y` m up, `z` m forward. */
function at(fr: Frame, x: number, y: number, z: number): P3 {
  return [fr.p[0] + fr.r[0] * x + fr.f[0] * z, fr.p[1] + y, fr.p[2] + fr.r[2] * x + fr.f[2] * z];
}

/** A direction of a frame (right x, up y, forward z). */
function dir(fr: Frame, x: number, y: number, z: number): P3 {
  return [fr.r[0] * x + fr.f[0] * z, y, fr.r[2] * x + fr.f[2] * z];
}

/** An upright box in a frame: x0..x1 right, y0..y1 up, z0..z1 forward (no bottom). */
function box(mb: MeshBuilder, fr: Frame, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, side: UV4, top: UV4 = side, back: UV4 = side, front: UV4 = side): void {
  mb.quad(at(fr, x0, y1, z0), at(fr, x1, y1, z0), at(fr, x1, y1, z1), at(fr, x0, y1, z1), top, WHITE, [0, 1, 0]);
  mb.quad(at(fr, x0, y0, z0), at(fr, x1, y0, z0), at(fr, x1, y1, z0), at(fr, x0, y1, z0), back, WHITE, dir(fr, 0, 0, -1));
  mb.quad(at(fr, x1, y0, z1), at(fr, x0, y0, z1), at(fr, x0, y1, z1), at(fr, x1, y1, z1), front, WHITE, dir(fr, 0, 0, 1));
  mb.quad(at(fr, x1, y0, z0), at(fr, x1, y0, z1), at(fr, x1, y1, z1), at(fr, x1, y1, z0), side, WHITE, dir(fr, 1, 0, 0));
  mb.quad(at(fr, x0, y0, z1), at(fr, x0, y0, z0), at(fr, x0, y1, z0), at(fr, x0, y1, z1), side, WHITE, dir(fr, -1, 0, 0));
}

/** A cone (a four-sided pyramid, 0.75 m) at a frame's (x, 0, 0). */
function cone(mb: MeshBuilder, fr: Frame, x: number, t: WorksTex): void {
  const h = 0.75;
  const w = 0.2;
  const tip = at(fr, x, h, 0);
  const c = [at(fr, x - w, 0, -w), at(fr, x + w, 0, -w), at(fr, x + w, 0, w), at(fr, x - w, 0, w)];
  const u0 = t.cone.x;
  const u1 = t.cone.x + t.cone.w;
  const v0 = t.cone.y;
  const v1 = t.cone.y + t.cone.h;
  for (let k = 0; k < 4; k++) {
    const a = c[k];
    const b = c[(k + 1) % 4];
    const ox = (a[0] + b[0]) / 2 - (fr.p[0] + fr.r[0] * x);
    const oz = (a[2] + b[2]) / 2 - (fr.p[2] + fr.r[2] * x);
    const ol = Math.sqrt(ox * ox + oz * oz + 0.09 * w * w) || 1;
    const n: P3 = [ox / ol, (0.3 * w) / ol, oz / ol];
    const ia = mb.vertex(a, u0, v1, WHITE, n);
    const ib = mb.vertex(b, u1, v1, WHITE, n);
    const ic = mb.vertex(tip, (u0 + u1) / 2, v0, WHITE, n);
    // Outward: (b − a) × (tip − a) along the outward side.
    const ex = b[0] - a[0], ez = b[2] - a[2];
    const uy = tip[1] - a[1];
    if (-ez * uy * ox + ex * uy * oz >= 0) mb.tri(ia, ib, ic);
    else mb.tri(ia, ic, ib);
  }
}

/** One zone's meshes and pieces. */
export interface WorksDraw {
  readonly zone: number;
  /** The solid props, cut along the zone: mesh id and a bounding sphere. */
  readonly pieces: readonly { readonly mesh: string; readonly x: number; readonly y: number; readonly z: number; readonly r: number }[];
  /** The yellow lines (one decal mesh) and the lit arrow and lamps (emissive, flashing). */
  readonly decal: { readonly mesh: string; readonly x: number; readonly y: number; readonly z: number; readonly r: number };
  readonly arrow: string;
  readonly lamps: string;
  /** The truck's place (the culling of the arrow and lamps). */
  readonly truck: readonly [number, number, number];
}

/** The road works of a track: every zone's meshes (built once). */
export function buildWorksMeshes(track: RallyTrack, plan: RulesPlan, tex: WorksTex): { meshes: Mesh3[]; zones: WorksDraw[] } {
  const meshes: Mesh3[] = [];
  const zones: WorksDraw[] = [];
  const sp = splineSample();
  for (const w of plan.works) zones.push(buildZone(track, plan, w, tex, sp, meshes));
  return { meshes, zones };
}

function buildZone(track: RallyTrack, plan: RulesPlan, w: WorksPlan, t: WorksTex, sp: SplineSample, meshes: Mesh3[]): WorksDraw {
  const { line, edge, openDir, cones } = w;
  const from = -TAPER_LEN;
  const to = w.len + TAPER_OUT;
  const nPieces = Math.max(1, Math.ceil((to - from) / PIECE_LEN));
  const builders: MeshBuilder[] = [];
  for (let i = 0; i < nPieces; i++) builders.push(new MeshBuilder());
  const piece = (o: number): MeshBuilder => builders[Math.max(0, Math.min(nPieces - 1, Math.floor((o - from) / PIECE_LEN)))];
  const fr = (o: number): Frame => frameAt(track, plan, w.off0 + o, sp);
  // The cones: the taper in (where the rules' cone bodies stand, works.ts, and between them), along the zone, the taper out.
  for (let o = from; o < 0; o += 5) cone(piece(o), fr(o), taperSide(w, o), t);
  for (let o = 0; o <= w.len; o += CONE_GAP) cone(piece(o), fr(o), cones, t);
  for (let o = w.len + 5; o <= to; o += 5) cone(piece(o), fr(o), cones + ((edge - cones) * (o - w.len)) / (to - w.len), t);
  // The barrier boards where the barrier bodies stand (works.ts), an amber lamp on each.
  const lamps = new MeshBuilder();
  for (const lane of w.closed) {
    for (let o = BARRIER_FROM; o < w.len - 8; o += BARRIER_GAP) {
      const f = fr(o);
      const mb = piece(o);
      const x = plan.laneX[Math.min(3, lane)];
      const hw = 1.25;
      // The board (both sides) on two posts.
      mb.quad(at(f, x - hw, 0.35, 0), at(f, x + hw, 0.35, 0), at(f, x + hw, 1.05, 0), at(f, x - hw, 1.05, 0), uv(t.board), WHITE, dir(f, 0, 0, -1));
      mb.quad(at(f, x + hw, 0.35, 0.02), at(f, x - hw, 0.35, 0.02), at(f, x - hw, 1.05, 0.02), at(f, x + hw, 1.05, 0.02), uv(t.board), WHITE, dir(f, 0, 0, 1));
      for (const px of [x - hw + 0.15, x + hw - 0.15]) box(mb, f, px - 0.04, px + 0.04, 0, 0.35, -0.04, 0.06, mid(t.dark));
      lampQuad(lamps, f, x, 1.2, -0.05, 0.13, t);
    }
  }
  // The arrow-board truck in the first closed lane, at the zone's start.
  const lane0 = w.closed.find((l) => l < 3) ?? w.closed[0];
  const tf = fr(TRUCK_AT);
  const tx = plan.laneX[Math.min(3, lane0)];
  const tb = piece(TRUCK_AT);
  const hw = 1.15;
  // Chassis and wheels.
  box(tb, tf, tx - hw, tx + hw, 0.35, 0.6, -3.7, 3.7, mid(t.dark));
  for (const zz of [-2.4, 2.4]) for (const xx of [-1, 1]) box(tb, tf, tx + xx * hw - 0.15, tx + xx * hw + 0.15, 0, 0.7, zz - 0.45, zz + 0.45, mid(t.dark));
  // The cab (front) and the bed (back), yellow with the white band.
  box(tb, tf, tx - hw, tx + hw, 0.6, 2.7, 2.0, 3.7, uv(t.truckYellow), mid(t.truckWhite), uv(t.truckYellow), mid(t.glass));
  box(tb, tf, tx - hw, tx + hw, 0.6, 1.35, -3.7, 2.0, uv(t.truckWhite));
  // The board's mast and the board (raised, facing the traffic behind).
  box(tb, tf, tx - 0.12, tx + 0.12, 1.35, 2.0, -3.4, -3.2, mid(t.dark));
  const by0 = 1.7;
  const by1 = 3.7;
  const bz = -3.55;
  // u grows toward the open lanes: the arrow (painted pointing to +u) points there.
  const right = openDir > 0;
  tb.quad(at(tf, tx - hw, by0, bz), at(tf, tx + hw, by0, bz), at(tf, tx + hw, by1, bz), at(tf, tx - hw, by1, bz), arrowUV(t.arrowBoard, right), WHITE, dir(tf, 0, 0, -1));
  tb.quad(at(tf, tx + hw, by0, bz + 0.1), at(tf, tx - hw, by0, bz + 0.1), at(tf, tx - hw, by1, bz + 0.1), at(tf, tx + hw, by1, bz + 0.1), mid(t.dark), WHITE, dir(tf, 0, 0, 1));
  const ab = new MeshBuilder();
  ab.quad(at(tf, tx - hw, by0, bz - 0.01), at(tf, tx + hw, by0, bz - 0.01), at(tf, tx + hw, by1, bz - 0.01), at(tf, tx - hw, by1, bz - 0.01), arrowUV(t.arrowLit, right), WHITE, dir(tf, 0, 0, -1));
  // Two amber beacons on the cab.
  for (const xx of [-0.7, 0.7]) lampQuad(lamps, tf, tx + xx, 2.85, 1.95, 0.18, t);
  // A mobile camera on a tripod on the verge (only where the plan put one).
  for (const c of plan.cameras) {
    if (c.works !== w.index) continue;
    const o = wrapOff(c.off - w.off0, plan.L);
    const f = fr(o);
    const mb = piece(o);
    const cx = c.side;
    for (const [lx2, lz] of [
      [-0.35, -0.3],
      [0.35, -0.3],
      [0, 0.4],
    ] as const)
      box(mb, f, cx + lx2 - 0.03, cx + lx2 + 0.03, 0, 1.1, lz - 0.03, lz + 0.03, mid(t.dark));
    box(mb, f, cx - 0.3, cx + 0.3, 1.1, 1.55, -0.25, 0.3, mid(t.grey), mid(t.grey), uv(t.camera), mid(t.grey));
  }
  // The yellow lines: solid along the closed lanes, dashed between the open lanes (decals).
  const dm = new MeshBuilder();
  stripe(dm, track, plan, w, sp, line, -20, w.len + 10, 3.5, 0, t);
  for (let b = 0; b < 2; b++) {
    if (w.closed.includes(b) || w.closed.includes(b + 1)) continue;
    stripe(dm, track, plan, w, sp, plan.borders[b], -80, w.len + 30, 3, 6, t);
  }
  const id = `rules/works/${w.index}`;
  const pieces: { mesh: string; x: number; y: number; z: number; r: number }[] = [];
  for (let i = 0; i < nPieces; i++) {
    if (builders[i].triangles === 0) continue;
    const mid0 = from + (i + 0.5) * PIECE_LEN;
    const f = fr(mid0);
    const m = builders[i].build(`${id}/p${i}`, WORKS_PAGE, 0);
    meshes.push(m);
    pieces.push({ mesh: m.id, x: f.p[0], y: f.p[1], z: f.p[2], r: PIECE_LEN * 0.75 + 4 });
  }
  const decal = { ...dm.build(`${id}/lines`, WORKS_PAGE, 0), bias: DECAL_BIAS };
  meshes.push(decal);
  const fm = fr(w.len / 2);
  meshes.push(ab.build(`${id}/arrow`, WORKS_PAGE, 0, { emissive: true }));
  meshes.push(lamps.build(`${id}/lamps`, WORKS_PAGE, 0, { emissive: true, blend: 'add', twoSided: true }));
  return {
    zone: w.index,
    pieces,
    decal: { mesh: decal.id, x: fm.p[0], y: fm.p[1], z: fm.p[2], r: w.len / 2 + 100 },
    arrow: `${id}/arrow`,
    lamps: `${id}/lamps`,
    truck: [tf.p[0] + tf.r[0] * tx, tf.p[1], tf.p[2] + tf.r[2] * tx],
  };
}

/** The arrow board's uv: the painted arrow points to +u; flipped for an arrow to the left. */
function arrowUV(r: TexRect, toRight: boolean): UV4 {
  // The quad's a → b runs from the left (−x) to the right (+x) of the road; v grows downward.
  return toRight ? [r.x, r.y + r.h, r.x + r.w, r.y] : [r.x + r.w, r.y + r.h, r.x, r.y];
}

/** A small lamp (a quad facing the traffic behind) at (x, y, z) of a frame. */
function lampQuad(mb: MeshBuilder, f: Frame, x: number, y: number, z: number, h: number, t: WorksTex): void {
  mb.quad(at(f, x - h, y - h, z), at(f, x + h, y - h, z), at(f, x + h, y + h, z), at(f, x - h, y + h, z), mid(t.lamp), WHITE, dir(f, 0, 0, -1));
}

/** A yellow line `side` m right of the centre from `o0` to `o1` m of the zone: solid (`gap` 0) or dashes of `on` m. */
function stripe(mb: MeshBuilder, track: RallyTrack, plan: RulesPlan, w: WorksPlan, sp: SplineSample, side: number, o0: number, o1: number, on: number, gap: number, t: WorksTex): void {
  const hw = 0.08;
  const step = gap > 0 ? on + gap : on;
  for (let o = o0; o < o1; o += step) {
    const e = Math.min(o1, o + on);
    const a = frameAt(track, plan, w.off0 + o, sp);
    const b = frameAt(track, plan, w.off0 + e, sp);
    mb.quad(at(a, side - hw, DECAL_Y, 0), at(a, side + hw, DECAL_Y, 0), at(b, side + hw, DECAL_Y, 0), at(b, side - hw, DECAL_Y, 0), mid(t.yellow), WHITE, [0, 1, 0]);
  }
}

/**
 * The police display (model space of the police estate: +z forward, +x its left, y up): a raised
 * matrix above the roof bar facing back (`top` = the roof bar's top), its frame (dark), and the two
 * texts as emissive faces drawn by turns.
 */
export function buildPoliceDisplay(top: number, t: WorksTex): Mesh3[] {
  const w = 0.62;
  const y0 = top + 0.06;
  const y1 = top + 0.4;
  const z = -0.06;
  const frame = new MeshBuilder();
  // The frame: a thin box behind the faces and two legs.
  frame.box(-w - 0.03, y0 - 0.03, z, w + 0.03, y1 + 0.03, z + 0.08, () => mid(t.dark), WHITE);
  frame.box(-0.4, top - 0.02, z + 0.01, -0.36, y0, z + 0.06, () => mid(t.dark), WHITE);
  frame.box(0.36, top - 0.02, z + 0.01, 0.4, y0, z + 0.06, () => mid(t.dark), WHITE);
  const face = (r: TexRect, id: string): Mesh3 => {
    const mb = new MeshBuilder();
    // Facing back (−z); seen from behind the car's left (+x) is on the viewer's right.
    mb.quad([w, y0, z - 0.005], [-w, y0, z - 0.005], [-w, y1, z - 0.005], [w, y1, z - 0.005], [r.x, r.y + r.h, r.x + r.w, r.y], WHITE, [0, 0, -1]);
    return { ...mb.build(id, WORKS_PAGE, 0, { emissive: true }), bias: 2 };
  };
  return [frame.build('rules/police/display', WORKS_PAGE, 0), face(t.stop, 'rules/police/stop'), face(t.politie, 'rules/police/politie')];
}
