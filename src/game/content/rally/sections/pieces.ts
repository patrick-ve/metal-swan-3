/**
 * WORLD's building blocks (wave B; docs/design/rally.md §3, §7.3–7.5): buildings with façades and a
 * seeded pattern of lit windows, trees as crossed cards, the central lamp posts with their night
 * glows and pools, billboards, water, fields, containers, boats, cranes, wind turbines, floodlights,
 * viaducts and flyovers. Each writes into a `WorldBatch` (world space). Likenesses drawn from general
 * knowledge, our own design: no real company name or logo anywhere (spec §11).
 *
 * Setup code (it allocates); pure and deterministic (the r3 trig tables; no Math.sin & co.).
 */
import { cosT, sinT } from '../../../../engine/r3/trig';
import { glowTex, GLOW_ROWS } from '../lights/page';
import { WORLD_PAGES, facadeTex, propsTex, type FacadeKind, type Swatch } from './pages';
import { Frame, SIDES, WorldBatch, type LayerDef, type Lod, type Rgb, type UV4, type V3 } from './batch';
import { NIGHT_ROWS } from './pages';

/** The layers of the sections' scenery (one mesh per cell and layer). */
export const WORLD_LAYERS: Readonly<Record<string, LayerDef>> = {
  /** Lit façades (Gouraud per face: the low sun leaves the far sides dark). */
  facade: { page: WORLD_PAGES.facade, normals: true },
  /** Lit props: posts, boards, decks, hulls, masts. */
  props: { page: WORLD_PAGES.props, normals: true },
  /** Two-sided cut-out cards with baked shading: trees, reeds, lattices, fences. */
  cut: { page: WORLD_PAGES.props, twoSided: true, normals: false },
  /** Flat decals on the ground: water, fields, pitches (a depth bias over the track's fields). */
  ground: { page: WORLD_PAGES.props, normals: true, bias: 2 },
  /** The night: the lit windows over the façades (cut out elsewhere). */
  win: { page: WORLD_PAGES.facade, emissive: true, normals: false, bias: 1, nightRows: NIGHT_ROWS },
  /** The night: glows (lamp heads, floodlights), additive. */
  glow: { page: WORLD_PAGES.lights, blend: 'add', emissive: true, twoSided: true, normals: false, nightRows: GLOW_ROWS },
  /** The night: the pools of light on the road and the pitches, additive, near only. */
  pool: { page: WORLD_PAGES.lights, blend: 'add', emissive: true, normals: false, bias: 3, nightRows: [-1, GLOW_ROWS[0], GLOW_ROWS[1], GLOW_ROWS[2]], maxDist: 170 },
};

/** Colours (vertex tints; 128 = as painted). */
export const TINT = {
  white: [128, 128, 128] as Rgb,
  shade: [104, 104, 108] as Rgb,
  sodium: [255, 146, 44] as Rgb,
  pool: [140, 98, 32] as Rgb,
  led: [210, 220, 240] as Rgb,
  flood: [235, 235, 220] as Rgb,
};

const tw = (): ReturnType<typeof facadeTex> => facadeTex();
const tp = (): ReturnType<typeof propsTex> => propsTex();

/** A flat uv rect of a props swatch. */
export function flat(name: Swatch): UV4 {
  return tp().flat(name);
}

/** Options of a building. */
export interface BuildingOpts {
  /** Storey offset of the window pattern (varies the lit windows). */
  readonly vOff?: number;
  /** Bay offset into the strip. */
  readonly uOff?: number;
  /** A flat roof (default true). */
  readonly roof?: boolean;
  /** The lit-window overlay (default: the strip's own setting). */
  readonly lit?: boolean;
  readonly lod?: Lod;
  /** Faces to emit (default the four sides). */
  readonly faces?: readonly ('right' | 'left' | 'front' | 'back')[];
}

/**
 * A building: a box w (across, frame x) × d (along, frame z) × h in frame `fr` (its base centre at
 * the origin) with façade `kind` on its four sides (cut into quads of at most one strip width) and a
 * gravel roof; lit windows at night over the façades of a strip with windows.
 */
export function building(b: WorldBatch, fr: Frame, w: number, d: number, h: number, kind: FacadeKind, col: Rgb, o: BuildingOpts = {}, y0 = 0): void {
  const ft = tw();
  const st = ft.strips[kind];
  const lod = o.lod ?? 'both';
  const lit = (o.lit ?? st.lit) && st.lit;
  const tpv = st.storeyTx / st.storeyM;
  const vBase = 1024 + (o.vOff ?? 0) * st.storeyTx;
  const vTop = vBase - (h - y0) * tpv;
  const perStrip = Math.floor(32 / st.bayTx);
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const wall = (a: V3, bb: V3, n: V3, len: number): void => {
    // a → bb: the wall's bottom edge (left to right seen from outside).
    const bays = Math.max(1, Math.round(len / st.bayM));
    const pieces = Math.ceil(bays / perStrip);
    let done = 0;
    for (let k = 0; k < pieces; k++) {
      const nb = Math.min(perStrip, bays - done);
      const f0 = done / bays, f1 = (done + nb) / bays;
      done += nb;
      const uOff = Math.min(perStrip - nb, o.uOff ?? 0) * st.bayTx;
      const u0 = st.rect.x + uOff, u1 = u0 + nb * st.bayTx - 0.02;
      const p0: V3 = [a[0] + (bb[0] - a[0]) * f0, y0, a[2] + (bb[2] - a[2]) * f0];
      const p1: V3 = [a[0] + (bb[0] - a[0]) * f1, y0, a[2] + (bb[2] - a[2]) * f1];
      const top0: V3 = [p0[0], h, p0[2]], top1: V3 = [p1[0], h, p1[2]];
      b.quad('facade', lod, top0, top1, p1, p0, [u0 + 0.01, vTop, u1, vBase], col, n);
      if (lit) {
        const e = 0.06;
        const q = (p: V3): V3 => [p[0] + n[0] * e, p[1], p[2] + n[2] * e];
        b.quad('win', lod, q(top0), q(top1), q(p1), q(p0), [u0 + 0.01, vTop, u1, vBase], TINT.white, n);
      }
    }
  };
  const faces = o.faces ?? SIDES;
  const P = (x: number, z: number): V3 => fr.p(x, 0, z);
  if (faces.includes('back')) wall(P(x1, z0), P(x0, z0), fr.d(0, 0, -1), w);
  if (faces.includes('front')) wall(P(x0, z1), P(x1, z1), fr.d(0, 0, 1), w);
  if (faces.includes('right')) wall(P(x1, z1), P(x1, z0), fr.d(1, 0, 0), d);
  if (faces.includes('left')) wall(P(x0, z0), P(x0, z1), fr.d(-1, 0, 0), d);
  if (o.roof ?? true) {
    const r = ft.roof;
    b.quad('facade', lod, fr.p(x0, h, z0), fr.p(x1, h, z0), fr.p(x1, h, z1), fr.p(x0, h, z1), [r.x + 1, 4, r.x + 15, 4 + Math.min(200, d * 2)], [112, 112, 112], [0, 1, 0]);
  }
}

/** A box of a flat props swatch (posts, beams, decks, hulls): the faces given. */
export function block(b: WorldBatch, layer: 'props' | 'ground', lod: Lod, fr: Frame, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, sw: Swatch, col: Rgb, faces?: readonly ('top' | 'bottom' | 'right' | 'left' | 'front' | 'back')[]): void {
  const uv = flat(sw);
  b.box(layer, lod, fr, x0, y0, z0, x1, y1, z1, () => uv, col, faces);
}

/** Tree kinds: their card, size (width / height) and baked tint. */
export type TreeKind = 'A' | 'B' | 'conifer' | 'poplar' | 'bush';

/**
 * A tree: two crossed cut-out cards (4 triangles), `h` tall, turned by `turn` (0..1 of a quarter).
 * Baked shading: the vertex colour (`shade` 0..1 darkens it).
 */
export function tree(b: WorldBatch, x: number, z: number, y: number, h: number, kind: TreeKind, turn: number, shade = 1, lod: Lod = 'both'): void {
  const t = tp();
  const r = kind === 'A' ? t.treeA : kind === 'B' ? t.treeB : kind === 'conifer' ? t.conifer : kind === 'poplar' ? t.poplar : t.bush;
  const w = (h * r.w) / r.h;
  const a = turn * 1.5707963;
  const s = sinT(a), c = cosT(a);
  const uv: UV4 = [r.x + 0.02, r.y + 0.02, r.x + r.w - 0.02, r.y + r.h - 0.02];
  const k = Math.round(118 * shade);
  const col: Rgb = [k, k, k];
  for (const [dx, dz] of [
    [c, s],
    [-s, c],
  ]) {
    const hx = (dx * w) / 2, hz = (dz * w) / 2;
    b.quad('cut', lod, [x - hx, y + h, z - hz], [x + hx, y + h, z + hz], [x + hx, y, z + hz], [x - hx, y, z - hz], uv, col, [dz, 0, -dx]);
  }
}

/** A flat ground polygon (water, a field, a pitch) at height y with uv per corner. */
export function groundPoly(b: WorldBatch, pts: readonly V3[], uv: readonly number[], col: Rgb, lod: Lod = 'both'): void {
  b.poly('ground', lod, pts, uv, col, [0, 1, 0]);
}

/**
 * A strip of water (a river, a canal) along the frame's z from z0 to z1, w wide, at y: textured in
 * pieces of 64 m (the water texture: 2 m per texel), flat swatch beyond `texTo` m from the origin.
 */
export function water(b: WorldBatch, fr: Frame, z0: number, z1: number, w: number, y = 0.02, texTo = 200): void {
  const t = tp();
  const r = t.water;
  const step = 60;
  for (let z = z0; z < z1 - 1e-6; z += step) {
    const za = z, zb = Math.min(z1, z + step);
    const near = Math.min(Math.abs(za), Math.abs(zb)) < texTo;
    const uv: UV4 = near ? [r.x + 0.02, r.y + 0.02, r.x + Math.min(31.98, w / 2), r.y + Math.min(31.98, (zb - za) / 2)] : flat('water');
    b.quad('ground', 'both', fr.p(-w / 2, y, za), fr.p(w / 2, y, za), fr.p(w / 2, y, zb), fr.p(-w / 2, y, zb), uv, near ? TINT.white : [110, 118, 124], [0, 1, 0]);
  }
}

/** A field parcel (a flat swatch tinted by `col`) between four corners. */
export function parcel(b: WorldBatch, pts: readonly V3[], sw: Swatch, col: Rgb): void {
  const uv = flat(sw);
  const u: number[] = [];
  for (let i = 0; i < pts.length; i++) u.push(uv[0] + (i % 2) * 3, uv[1] + (i >> 1) * 3);
  groundPoly(b, pts, u, col);
}

/**
 * The A10's central lamp post (on the barrier between the carriageways): a 12 m mast, two arms and
 * two lamp heads; at night a sodium halo at each head and a pool of light on each carriageway.
 * `fr`: the track's frame at the post (x right of our centre line), `h` the road height.
 */
export function centralLamp(b: WorldBatch, fr: Frame, h: number, cb: number): void {
  const pole: Swatch = 'grey';
  const top = h + 12;
  block(b, 'props', 'both', fr, cb - 0.14, h + 0.9, -0.14, cb + 0.14, top, 0.14, pole, TINT.white, ['right', 'left', 'front', 'back']);
  const g = glowTex();
  for (const side of [-1, 1]) {
    const hx = cb + side * 3.4;
    // The arm and the head.
    block(b, 'props', 'near', fr, Math.min(cb, hx), top - 0.12, -0.07, Math.max(cb, hx), top, 0.07, pole, TINT.white, ['top', 'front', 'back', 'bottom']);
    block(b, 'props', 'near', fr, hx - 0.55, top - 0.28, -0.22, hx + 0.55, top - 0.04, 0.22, 'dark', TINT.white, ['bottom', 'front', 'back', 'right', 'left', 'top']);
    // The night: a halo at the head (two crossed cards), a pool on the road below.
    const hc = fr.p(hx, top - 0.35, 0);
    halo(b, hc, 2.6, TINT.sodium, g.disc);
    pool(b, fr, hx, h + 0.06, 0, 8, 12, TINT.pool);
  }
}

/** A glow halo: two crossed additive cards (`size` m across) at a point, tinted. */
export function halo(b: WorldBatch, c: V3, size: number, col: Rgb, r: { x: number; y: number; w: number; h: number }, layer = 'glow', lod: Lod = 'both'): void {
  const s = size / 2;
  const uv: UV4 = [r.x, r.y, r.x + r.w, r.y + r.h];
  b.quad(layer, lod, [c[0] - s, c[1] + s, c[2]], [c[0] + s, c[1] + s, c[2]], [c[0] + s, c[1] - s, c[2]], [c[0] - s, c[1] - s, c[2]], uv, col, [0, 0, 1]);
  b.quad(layer, lod, [c[0], c[1] + s, c[2] - s], [c[0], c[1] + s, c[2] + s], [c[0], c[1] - s, c[2] + s], [c[0], c[1] - s, c[2] - s], uv, col, [1, 0, 0]);
}

/**
 * The road pools' cells (across × along). Wave C (review): one big 8 × 12 m quad beside the car was
 * smeared across the left lanes by the PS1 affine warp; small cells keep the oval in place up close
 * (as the car's beam does, `carPoolMesh`).
 */
export const POOL_CELLS: readonly [number, number] = [4, 6];

/** A pool of light on the ground at (x, y, z) of a frame: `w` across, `l` along, cut into `nx` × `nz` cells. */
export function pool(b: WorldBatch, fr: Frame, x: number, y: number, z: number, w: number, l: number, col: Rgb, layer = 'pool', nx = POOL_CELLS[0], nz = POOL_CELLS[1]): void {
  const r = glowTex().pool;
  const yy = y - fr.oy;
  for (let j = 0; j < nz; j++) {
    const z0 = z - l / 2 + (l * j) / nz, z1 = z - l / 2 + (l * (j + 1)) / nz;
    const v0 = r.y + (r.h * j) / nz, v1 = r.y + (r.h * (j + 1)) / nz;
    for (let i = 0; i < nx; i++) {
      const x0 = x - w / 2 + (w * i) / nx, x1 = x - w / 2 + (w * (i + 1)) / nx;
      const u0 = r.x + (r.w * i) / nx, u1 = r.x + (r.w * (i + 1)) / nx;
      b.quad(layer, 'near', fr.p(x0, yy, z0), fr.p(x1, yy, z0), fr.p(x1, yy, z1), fr.p(x0, yy, z1), [u0, v0, u1, v1], col, [0, 1, 0]);
    }
  }
}

/** A billboard on two posts facing the road (the frame's −z faces the traffic): ad `k`. */
export function billboard(b: WorldBatch, fr: Frame, k: number, scale = 1): void {
  const t = tp();
  const r = t.ads[k % t.ads.length];
  const w = 8 * scale, hb = 2 * scale, y0 = 3.2 * scale;
  for (const x of [-w * 0.3, w * 0.3]) block(b, 'props', 'both', fr, x - 0.15, 0, -0.1, x + 0.15, y0, 0.1, 'grey', TINT.white, ['right', 'left', 'front', 'back']);
  block(b, 'props', 'both', fr, -w / 2 - 0.15, y0, 0.02, w / 2 + 0.15, y0 + hb + 0.3, 0.3, 'dark', TINT.white, ['top', 'right', 'left', 'front', 'back']);
  // The face toward −z (readable by the traffic coming along +z): u runs left to right as seen.
  face(b, 'props', fr, -w / 2, y0 + 0.15, w / 2, y0 + hb + 0.15, 0, [r.x, r.y, r.x + r.w, r.y + r.h], TINT.white);
}

/** A shipping container (12 × 2.6 × 2.4 m) tinted `col`. */
export function container(b: WorldBatch, fr: Frame, col: Rgb, y0 = 0): void {
  const r = tp().container;
  const uv: UV4 = [r.x, r.y, r.x + r.w, r.y + r.h];
  b.box('props', 'both', fr, -1.2, y0, -6, 1.2, y0 + 2.6, 6, () => uv, col);
}

/** A boat: a barge or a houseboat (side cards on a hull box), `len` m long, along the frame's z. */
export function boat(b: WorldBatch, fr: Frame, len: number, kind: 'barge' | 'houseboat', y = 0): void {
  const t = tp();
  const r = kind === 'barge' ? t.boat : t.houseboat;
  const w = kind === 'barge' ? len * 0.14 : 4.5;
  const h = (len * r.h) / r.w;
  const uv: UV4 = [r.x + 0.02, r.y + 0.02, r.x + r.w - 0.02, r.y + r.h - 0.02];
  // The two sides as cards (cut-out above the hull), the deck as a dark top.
  b.quad('cut', 'both', fr.p(w / 2, y + h, -len / 2), fr.p(w / 2, y + h, len / 2), fr.p(w / 2, y - 0.4, len / 2), fr.p(w / 2, y - 0.4, -len / 2), uv, TINT.white, fr.d(1, 0, 0));
  b.quad('cut', 'both', fr.p(-w / 2, y + h, len / 2), fr.p(-w / 2, y + h, -len / 2), fr.p(-w / 2, y - 0.4, -len / 2), fr.p(-w / 2, y - 0.4, len / 2), [uv[2], uv[1], uv[0], uv[3]], TINT.white, fr.d(-1, 0, 0));
  const deck = y + h * (kind === 'barge' ? 0.36 : 0.28);
  block(b, 'props', 'both', fr, -w / 2, y - 0.4, -len / 2, w / 2, deck, len / 2, kind === 'barge' ? 'black' : 'blue', TINT.white, ['top', 'front', 'back']);
  if (kind === 'houseboat') block(b, 'props', 'both', fr, -w / 2 + 0.1, deck, -len / 2 + 0.3, w / 2 - 0.1, y + h * 0.78, len / 2 - 0.3, 'wood', TINT.white, ['top', 'front', 'back']);
  else block(b, 'props', 'both', fr, -w / 2 + 0.2, deck, len * 0.2, w / 2 - 0.2, y + h * 0.75, len * 0.44, 'white', TINT.white, ['top', 'front', 'back']);
}

/** A lattice box (crane mast, jib): four cut-out faces of the lattice card, x0..x1 / y0..y1 / z0..z1 in `fr`. */
export function lattice(b: WorldBatch, fr: Frame, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: Rgb, lod: Lod = 'both', along: 'y' | 'z' = 'y'): void {
  const r = tp().lattice;
  const len = along === 'y' ? y1 - y0 : z1 - z0;
  const rep = Math.max(1, len / Math.max(0.5, along === 'y' ? x1 - x0 : y1 - y0));
  const v1 = r.y + Math.min(r.h - 0.02, (rep * r.h) / 4);
  const uv: UV4 = [r.x + 0.02, r.y + 0.02, r.x + r.w - 0.02, v1];
  const P = (x: number, y: number, z: number): V3 => fr.p(x, y, z);
  if (along === 'y') {
    b.quad('cut', lod, P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0), uv, col, fr.d(0, 0, -1));
    b.quad('cut', lod, P(x1, y1, z1), P(x0, y1, z1), P(x0, y0, z1), P(x1, y0, z1), uv, col, fr.d(0, 0, 1));
    b.quad('cut', lod, P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0), uv, col, fr.d(1, 0, 0));
    b.quad('cut', lod, P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), uv, col, fr.d(-1, 0, 0));
  } else {
    // Along z: the u of the card runs along the jib (the card turned).
    const q = (a: V3, bb: V3, c: V3, d: V3, n: V3): void => b.poly('cut', lod, [a, bb, c, d], [uv[0], uv[1], uv[0], uv[3], uv[2], uv[3], uv[2], uv[1]], col, n);
    q(P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1), P(x0, y0, z0), fr.d(-1, 0, 0));
    q(P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0), fr.d(1, 0, 0));
    q(P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), [0, 1, 0]);
  }
}

/** A tower crane: lattice mast, jib and counter-jib, the cab and the counterweight. */
export function crane(b: WorldBatch, fr: Frame, h: number, jib: number): void {
  const yellow: Rgb = [150, 136, 96];
  lattice(b, fr, -1, 0, -1, 1, h, 1, yellow, 'near');
  block(b, 'props', 'far', fr, -0.6, 0, -0.6, 0.6, h, 0.6, 'yellow', TINT.shade, ['right', 'left', 'front', 'back']);
  block(b, 'props', 'both', fr, -0.5, h + 0.6, -jib * 0.28, 0.5, h + 1.4, jib, 'yellow', TINT.white, ['top', 'bottom', 'right', 'left', 'front', 'back']);
  block(b, 'props', 'both', fr, -1.1, h - 2.4, -1.1, 1.1, h, 1.1, 'yellow', TINT.white);
  block(b, 'props', 'both', fr, -1.2, h + 0.2, -jib * 0.28, 1.2, h + 1.8, -jib * 0.2, 'grey', TINT.white);
  block(b, 'props', 'near', fr, -0.25, h + 1.6, -0.25, 0.25, h + 6, 0.25, 'yellow', TINT.white, ['right', 'left', 'front', 'back']);
}

/** A floodlight mast (sports fields): a pole and a head; at night a big halo. */
export function floodlight(b: WorldBatch, fr: Frame, h: number): void {
  block(b, 'props', 'both', fr, -0.25, 0, -0.25, 0.25, h, 0.25, 'grey', TINT.white, ['right', 'left', 'front', 'back']);
  block(b, 'props', 'both', fr, -1.6, h, -0.4, 1.6, h + 1.8, 0.4, 'dark', TINT.white);
  halo(b, fr.p(0, h + 0.9, 0), 9, TINT.flood, glowTex().disc);
}

/** A wind turbine's tower and nacelle (the rotor is an animated part: `rotorMesh`). */
export function turbineTower(b: WorldBatch, fr: Frame, h: number): void {
  const n = 6;
  for (let k = 0; k < n; k++) {
    const y0 = (h * k) / n, y1 = (h * (k + 1)) / n;
    const r0 = 2.2 - (1.1 * k) / n, r1 = 2.2 - (1.1 * (k + 1)) / n;
    const uv = flat('white');
    const P = (x: number, y: number, z: number): V3 => fr.p(x, y, z);
    for (const [ax, az] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const bx = -az, bz = ax;
      b.quad('props', k < 2 ? 'both' : 'both', P(ax * r1 + bx * r1, y1, az * r1 + bz * r1), P(ax * r1 - bx * r1, y1, az * r1 - bz * r1), P(ax * r0 - bx * r0, y0, az * r0 - bz * r0), P(ax * r0 + bx * r0, y0, az * r0 + bz * r0), uv, TINT.white, fr.d(ax, 0, az));
    }
  }
  block(b, 'props', 'both', fr, -1.5, h - 0.4, -2, 1.5, h + 2.4, 5, 'white', TINT.white);
}

/** Lettered plates and other faces: a quad on page `layer` with its uv as given (u left → right seen from `n`). */
export function face(b: WorldBatch, layer: string, fr: Frame, x0: number, y0: number, x1: number, y1: number, z: number, uv: UV4, col: Rgb, lod: Lod = 'both'): void {
  // Seen from −z by the traffic that comes along +z: the viewer looks along +z, so the frame's +x
  // is the viewer's right (right = forward × up): u runs from x0 to x1.
  b.quad(layer, lod, fr.p(x0, y1, z), fr.p(x1, y1, z), fr.p(x1, y0, z), fr.p(x0, y0, z), uv, col, fr.d(0, 0, -1));
}

/**
 * A deck on piers along a path of points (x, y, z: the deck's top), `w` wide: a metro viaduct, a
 * flyover. Piers every `pierEvery` m down to the ground.
 */
export function deck(b: WorldBatch, path: readonly V3[], w: number, thick: number, pierEvery: number, sw: Swatch = 'light', parapet = 1.0): void {
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i], c = path[i + 1];
    const dx = c[0] - a[0], dz = c[2] - a[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-6) continue;
    const fx = dx / len, fz = dz / len;
    const rx = -fz, rz = fx;
    const hw = w / 2;
    const uv = flat(sw);
    const C = (p: V3, s: number, y: number): V3 => [p[0] + rx * s, p[1] + y, p[2] + rz * s];
    b.quad('props', 'both', C(a, -hw, 0), C(a, hw, 0), C(c, hw, 0), C(c, -hw, 0), uv, TINT.white, [0, 1, 0]);
    b.quad('props', 'both', C(a, -hw, -thick), C(c, -hw, -thick), C(c, hw, -thick), C(a, hw, -thick), uv, TINT.shade, [0, -1, 0]);
    for (const s of [-1, 1]) {
      const n: V3 = [rx * s, 0, rz * s];
      b.quad('props', 'both', C(a, s * hw, parapet), C(c, s * hw, parapet), C(c, s * hw, -thick), C(a, s * hw, -thick), uv, TINT.white, n);
      if (parapet > 0) b.quad('props', 'near', C(a, s * (hw - 0.3), parapet), C(c, s * (hw - 0.3), parapet), C(c, s * (hw - 0.3), 0), C(a, s * (hw - 0.3), 0), uv, TINT.shade, [-n[0], 0, -n[2]]);
    }
    // Piers.
    while (acc <= len) {
      const p: V3 = [a[0] + fx * acc, a[1] + ((c[1] - a[1]) * acc) / len, a[2] + fz * acc];
      const top = p[1] - thick;
      if (top > 0.8) {
        const fr = new Frame(p[0], 0, p[2], fx, fz);
        block(b, 'props', 'both', fr, -0.7, 0, -0.7, 0.7, top, 0.7, sw, TINT.shade, ['right', 'left', 'front', 'back']);
      }
      acc += pierEvery;
    }
    acc -= len;
  }
}
