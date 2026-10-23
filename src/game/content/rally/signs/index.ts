/**
 * The road's furniture (WORLD, wave B; docs/design/rally.md §3, §5; docs/api/rally.md "B.2", "B.W"):
 * - the GANTRIES (TRACK's 17 anchors): steel truss columns and beam, a dark housing per lane with
 *   its MATRIX SIGN (one dynamic mesh per gantry whose faces follow `runner.race.signs`), the blue
 *   S-exit panel on the 'exit' gantries, the finish banner on the start gantry and the blue boards of
 *   the average-speed zone;
 * - the FLITSPALEN (TRACK's 3 speed cameras): a grey cabinet with its lens on a pole;
 * - the blue S-exit signs on the verge before each exit (the real codes and places, our lettering);
 * - the green HECTOMETRE boards every 100 m (our own numbering).
 * TRACK's placeholder gantries and flitspalen stay in its segment meshes; these enclose them (each
 * box a little larger), so the track may also be built with `props: false` without a gap.
 *
 * Registered as the scenery `world/signs` (order 150). Built once per track; `fill` culls per view
 * (no allocation per frame); the matrix faces are rewritten only when the sign table's `version`
 * changes. Signs and the LEDs are emissive: they read at night.
 */
import type { DrawItem, Mesh3 } from '../../../../engine/view3d';
import type { RallyTrack } from '../../../rally/api';
import { defineRallyScenery, type RallyDrawCtx, type RallyScenery } from '../../../rally/registry';
import { gantriesOf, SIGN_LANES, SIGN_STATES, type SignState } from '../../../rally/signs';
import { CellCuller, Frame, WorldBatch, type LayerDef, type UV4, type V3, type WorldCell } from '../sections/batch';
import { isA10 } from '../sections/index';
import { WORLD_PAGES } from '../sections/pages';
import { CB, HALF, LANE_X } from '../track/geometry';
import type { A10Track } from '../track/types';
import { TF } from '../track/types';
import { hectoText, signTex, type SignTex } from './page';

/** Place names for the S-exits that THE TABLE leaves blank (real districts of those parts of the ring). */
export const EXIT_PLACES: Readonly<Record<string, string>> = { S108: 'ZUID', S110: 'BUITENVELDERT', S115: 'ZEEBURG', S116: 'NIEUWENDAM', S117: 'NOORD', S118: 'OOSTZAAN' };

const LAYERS: Readonly<Record<string, LayerDef>> = {
  /** Lit steel and housings. */
  steel: { page: WORLD_PAGES.signs, normals: true },
  /** The sign faces (blue panels, boards, banners): emissive, so they read at night. */
  face: { page: WORLD_PAGES.signs, emissive: true, normals: false, bias: 2 },
};

/** The matrix face: its size (m), its centre above the road and its distance in front of the gantry. */
/** Fixer (wave B): 1.7 m (was 1.5): the limits read from further away at 1× and in the split views. */
export const FACE_M = 1.7;
export const FACE_Y = 5.55;
const FACE_Z = -0.28;
const POST_X = [-HALF - CB / 2, HALF + 1.4];
const BEAM_X0 = -HALF - CB / 2 - 0.55, BEAM_X1 = HALF + 3.35;

const W = [128, 128, 128] as const;

/** The world frame of the track at s (x right of our centre line, y up from the ground at 0). */
function frameAt(track: A10Track, s: number): { fr: Frame; h: number } {
  const t = track.sample(s);
  return { fr: new Frame(t.pos[0], 0, t.pos[2], t.fwd[0], t.fwd[2]), h: t.pos[1] };
}

/** A box face uv for a flat swatch rect. */
const flatOf = (r: { x: number; y: number; w: number; h: number }): UV4 => [r.x + 0.5, r.y + 0.5, r.x + r.w - 0.5, r.y + r.h - 0.5];

/** A face toward the traffic (−z of the frame), u left → right as the driver sees it. */
function face(b: WorldBatch, fr: Frame, x0: number, y0: number, x1: number, y1: number, z: number, r: { x: number; y: number; w: number; h: number }): void {
  b.quad('face', 'both', fr.p(x0, y1, z), fr.p(x1, y1, z), fr.p(x1, y0, z), fr.p(x0, y0, z), [r.x, r.y, r.x + r.w, r.y + r.h], W, fr.d(0, 0, -1));
}

/** A gantry's matrix signs: one dynamic mesh of 4 faces (3 on the start gantry). */
interface Leds {
  readonly g: number;
  readonly lanes: number;
  readonly mesh: Mesh3;
  readonly item: DrawItem;
  readonly x: number;
  readonly z: number;
  readonly states: (SignState | null)[];
}

export interface SignsPart extends RallyScenery {
  readonly tex: SignTex | null;
  readonly cells: readonly WorldCell[];
  readonly leds: readonly Leds[];
  readonly cullers: readonly CellCuller[];
}

/** Build the road's furniture of a track (empty on a test track). */
export function buildSigns(track: RallyTrack): SignsPart {
  const cullers = [new CellCuller(), new CellCuller()];
  if (!isA10(track)) return { meshes: [], pages: [], tex: null, cells: [], leds: [], cullers, fill: (_c, _o, k) => k };
  const exits = track.exits.map((e) => ({ code: e.code, name: e.name || EXIT_PLACES[e.code] || '' }));
  const hectos: string[] = [];
  for (let s = 0; s < track.length; s += 100) hectos.push(hectoText(s));
  const tex = signTex(exits, hectos);
  const b = new WorldBatch('fx/world-signs', LAYERS);
  const steel = flatOf(tex.grey);
  const dark = flatOf(tex.housing);
  const truss = tex.truss;
  const trussUv = (face: string, w: number): UV4 => (face === 'front' || face === 'back' ? [truss.x, truss.y, truss.x + Math.min(truss.w, w * 2), truss.y + truss.h] : steel);
  const leds: Leds[] = [];
  const gantries = gantriesOf(track);
  const exitAt = (s: number): { code: string } | null => {
    let best: { code: string } | null = null;
    let bd = Infinity;
    for (const e of track.exits) {
      const d = e.s - s;
      if (d >= -20 && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  };

  gantries.forEach((g, gi) => {
    if ((track.flagsAt(g.s) & TF.tunnel) !== 0) return;
    const { fr, h } = frameAt(track, g.s);
    b.at(fr.ox, fr.oz);
    // Columns (truss faces front and back) and their foot plates.
    for (const x of POST_X) {
      b.box('steel', 'both', fr, x - 0.3, h, -0.3, x + 0.3, h + 7.55, 0.3, (f) => (f === 'front' || f === 'back' ? [truss.x, truss.y, truss.x + 4, truss.y + truss.h] : steel), W, ['right', 'left', 'front', 'back']);
      b.box('steel', 'near', fr, x - 0.5, h, -0.5, x + 0.5, h + 0.25, 0.5, () => steel, W, ['top', 'right', 'left', 'front', 'back']);
    }
    // The beam: a truss box across both our carriageway and the shoulder.
    b.box('steel', 'both', fr, BEAM_X0, h + 6.3, -0.55, BEAM_X1, h + 7.55, 0.55, (f, w) => trussUv(f, w), W);
    if (g.kind === 'exit') {
      // The blue S-exit panel over the right lanes (the code and the place).
      const e = exitAt(g.s);
      const r = e ? tex.exits.get(e.code) : undefined;
      b.box('steel', 'both', fr, 0.1, h + 3.85, -0.2, 6.9, h + 6.55, 0.2, () => dark, W);
      if (r) face(b, fr, 0.2, h + 3.95, 6.8, h + 6.45, -0.23, r);
      return;
    }
    const lanes = g.kind === 'start' ? 3 : SIGN_LANES;
    for (let l = 0; l < lanes; l++) {
      const x = LANE_X[l];
      b.box('steel', 'both', fr, x - FACE_M / 2 - 0.12, h + FACE_Y - FACE_M / 2 - 0.17, -0.26, x + FACE_M / 2 + 0.12, h + FACE_Y + FACE_M / 2 + 0.17, 0.26, () => dark, W);
    }
    if (g.kind === 'start') {
      // The finish banner on the beam's face.
      face(b, fr, -7.4, h + 6.32, 3.6, h + 7.53, -0.58, tex.finish);
    }
    if (g.kind === 'avg-start' || g.kind === 'avg-end') {
      // The blue board of the zone on the right column.
      face(b, fr, POST_X[1] + 0.35, h + 2.4, POST_X[1] + 3.15, h + 3.3, -0.32, g.kind === 'avg-start' ? tex.zoneStart : tex.zoneEnd);
      b.box('steel', 'near', fr, POST_X[1] + 0.3, h + 2.35, -0.3, POST_X[1] + 3.2, h + 3.35, -0.2, () => dark, W, ['top', 'right', 'left', 'back', 'bottom']);
    }
    // The matrix faces: one dynamic mesh (4 quads), uv rewritten when a state changes.
    const pos = new Float32Array(lanes * 12);
    const uv = new Float32Array(lanes * 8);
    const idx = new Uint16Array(lanes * 6);
    const hf = FACE_M / 2;
    for (let l = 0; l < lanes; l++) {
      const x = LANE_X[l];
      const pts: V3[] = [fr.p(x - hf, h + FACE_Y + hf, FACE_Z), fr.p(x + hf, h + FACE_Y + hf, FACE_Z), fr.p(x + hf, h + FACE_Y - hf, FACE_Z), fr.p(x - hf, h + FACE_Y - hf, FACE_Z)];
      pts.forEach((p, k) => pos.set(p, l * 12 + k * 3));
      // Winding: front toward −z of the frame (the traffic).
      const n = fr.d(0, 0, -1);
      const a = pts[0], c1 = pts[1], c2 = pts[2];
      const cx = (c1[1] - a[1]) * (c2[2] - a[2]) - (c1[2] - a[2]) * (c2[1] - a[1]);
      const cz = (c1[0] - a[0]) * (c2[1] - a[1]) - (c1[1] - a[1]) * (c2[0] - a[0]);
      const front = cx * n[0] + cz * n[2] >= 0;
      const o = l * 4;
      idx.set(front ? [o, o + 1, o + 2, o, o + 2, o + 3] : [o, o + 2, o + 1, o, o + 3, o + 2], l * 6);
    }
    const id = `fx/world-signs/leds/${gi}`;
    const mesh: Mesh3 = { id, pos, uv, rgb: new Uint8Array(lanes * 12).fill(128), idx, page: WORLD_PAGES.signs, clutRow: 0, blend: 'opaque', emissive: true, dynamic: true, bias: 2 };
    const states: (SignState | null)[] = [];
    for (let l = 0; l < lanes; l++) states.push(null);
    leds.push({ g: gi, lanes, mesh, item: { mesh: id, m: null }, x: fr.ox, z: fr.oz, states });
    setFaces(leds[leds.length - 1], tex, null);
  });

  // The flitspalen: a pole and a grey cabinet facing the traffic (enclosing TRACK's placeholder).
  for (const c of track.cameras) {
    const { fr, h } = frameAt(track, c.s);
    const base = h > 0.3 ? h - 0.15 : 0;
    const top = Math.max(h, base) + 3.0;
    b.at(fr.ox, fr.oz);
    b.box('steel', 'both', fr, c.side - 0.14, base, -0.14, c.side + 0.14, top - 0.6, 0.14, () => steel, W, ['right', 'left', 'front', 'back']);
    b.box('steel', 'both', fr, c.side - 0.42, top - 0.62, -0.5, c.side + 0.42, top + 0.62, 0.5, () => flatOf(tex.grey), [118, 118, 122]);
    face(b, fr, c.side - 0.4, top - 0.6, c.side + 0.4, top + 0.6, -0.52, tex.cabinet);
  }

  // The blue S-exit signs on the verge, 250 m before each exit (none where a gantry signs it).
  const apart = (a: number, c: number): number => Math.abs(track.spline.wrap(a - c + track.length / 2) - track.length / 2);
  for (const e of track.exits) {
    const s = track.spline.wrap(e.s - 250);
    if (gantries.some((g) => g.kind === 'exit' && apart(g.s, e.s) < 300)) continue;
    if ((track.flagsAt(s) & (TF.tunnel | TF.cutting)) !== 0) continue;
    const r = tex.exits.get(e.code);
    if (!r) continue;
    const { fr, h } = frameAt(track, s);
    b.at(fr.ox, fr.oz);
    const x0 = HALF + 2.2, x1 = x0 + 4.4;
    const y0 = Math.max(0, h) + 2.0, y1 = y0 + 1.65;
    for (const x of [x0 + 0.8, x1 - 0.8]) b.box('steel', 'both', fr, x - 0.06, Math.min(0, h) - 0.5, -0.06, x + 0.06, y0, 0.06, () => steel, W, ['right', 'left', 'front', 'back']);
    b.box('steel', 'both', fr, x0 - 0.05, y0 - 0.05, 0, x1 + 0.05, y1 + 0.05, 0.08, () => dark, W, ['top', 'right', 'left', 'back']);
    face(b, fr, x0, y0, x1, y1, -0.02, r);
  }

  // The average-speed zone's boards on the verge before the zone and after it.
  {
    const z = track.avgZone;
    for (const [s, r] of [
      [z.s0 - 160, tex.zoneStart],
      [z.s1 + 40, tex.zoneEnd],
    ] as const) {
      const { fr, h } = frameAt(track, track.spline.wrap(s));
      b.at(fr.ox, fr.oz);
      const x0 = HALF + 1.6, x1 = x0 + 2.6, y0 = Math.max(0, h) + 1.6, y1 = y0 + 0.82;
      b.box('steel', 'both', fr, (x0 + x1) / 2 - 0.06, Math.min(0, h) - 0.5, -0.06, (x0 + x1) / 2 + 0.06, y0, 0.06, () => steel, W, ['right', 'left', 'front', 'back']);
      face(b, fr, x0, y0, x1, y1, -0.02, r);
    }
  }

  // The hectometre boards (every 100 m on the verge behind the guard rail).
  for (let s = 0; s < track.length; s += 100) {
    if ((track.flagsAt(s) & TF.tunnel) !== 0) continue;
    const r = tex.hecto.get(hectoText(s));
    if (!r) continue;
    const { fr, h } = frameAt(track, s);
    b.at(fr.ox, fr.oz);
    const x = HALF + 0.95;
    b.box('steel', 'near', fr, x - 0.04, h - 0.4, -0.04, x + 0.04, h + 0.62, 0.04, () => steel, W, ['right', 'left', 'front', 'back']);
    face(b, fr, x - 0.32, h + 0.62, x + 0.32, h + 0.94, -0.02, r);
  }

  const { meshes, cells } = b.build();
  for (const l of leds) meshes.push(l.mesh);
  let version = -1;
  return {
    meshes,
    pages: [tex.page],
    tex,
    cells,
    leds,
    cullers,
    fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number {
      const cull = cullers[ctx.view] ?? cullers[0];
      k = cull.fill(cells, ctx.cam, ctx.aspect, ctx.far, -1, out, k);
      const signs = ctx.runner.race.signs;
      if (signs && signs.version !== version) {
        version = signs.version;
        for (const l of leds) if (setFaces(l, tex, signs)) ctx.v3.updateMesh?.(l.mesh.id);
      }
      const cx = ctx.cam.pos[0], cz = ctx.cam.pos[2];
      const far2 = ctx.far * ctx.far;
      for (const l of leds) {
        const dx = l.x - cx, dz = l.z - cz;
        if (dx * dx + dz * dz > far2) continue;
        out[k++] = l.item;
      }
      return k;
    },
  };
}

/** Write a gantry's face uvs from the sign table (null: every face blank). True when one changed. */
function setFaces(l: Leds, tex: SignTex, signs: { sign(g: number, lane: number): SignState } | null): boolean {
  let changed = false;
  const uv = l.mesh.uv as Float32Array;
  for (let lane = 0; lane < l.lanes; lane++) {
    const st = signs ? signs.sign(l.g, lane) : 'blank';
    if (st === l.states[lane]) continue;
    l.states[lane] = st;
    changed = true;
    const r = tex.faces[st] ?? tex.faces.blank;
    const o = lane * 8;
    uv[o] = r.x + 0.02;
    uv[o + 1] = r.y + 0.02;
    uv[o + 2] = r.x + r.w - 0.02;
    uv[o + 3] = r.y + 0.02;
    uv[o + 4] = r.x + r.w - 0.02;
    uv[o + 5] = r.y + r.h - 0.02;
    uv[o + 6] = r.x + 0.02;
    uv[o + 7] = r.y + r.h - 0.02;
  }
  return changed;
}

/** Every state has a face on the page (tests). */
export function faceStates(): readonly SignState[] {
  return SIGN_STATES;
}

defineRallyScenery({ id: 'world/signs', order: 150, build: buildSigns });
