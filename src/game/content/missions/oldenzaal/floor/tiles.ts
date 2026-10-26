/**
 * The Oldenzaal floor kit's tiles and props (docs/design/floor.md §3.5, §3.6, §3.7, §5.1;
 * docs/api/floor.md §4): the faces, canopies, slabs, roofs, top faces and covers of the town,
 * per light mood (the id carries it: `OZ_FLOOR_IDS`), and the iron post with its chain.
 *
 * Tile coordinates (registry.ts `FloorTileDef`): a top face (a, b) = (u, v) with v from the top's
 * depth (negative) to 0 at its front edge (the tile wraps: its front arris is at b → h); a face a
 * = along it, b = px below its top edge; a canopy / slab / roof a = u, b = 0 at the facade … the
 * overhang's depth (+ rise) at its front edge (the platform line); an opening (a, b) = (u − x0,
 * v − v far) over its whole rectangle.
 *
 * - `kerb-face`: the sandstone kerb's face (a lit top arris, block joints, the dark foot).
 * - `awning/<colour>/<phase>`: the canvas of a shop awning in the sprite's own colour pairs and
 *   stripe phase (art-street.ts `decor/oz/awning`: green, red, navy stripes of 6 px from the
 *   awning's left edge), darker under the facade, lit at the valance, rot stains and seams.
 * - `slab`: a balcony's sandstone slab (joints, shade at the wall, a lit front arris).
 * - `bay-roof`: the bay windows' lead roof (standing seams, a gutter lip at the front).
 * - `wall-top`: the low garden walls' brick coping (bricks laid across, a lit front arris).
 * - `car/<frame>`, `car-glass`: the abandoned cars' roof, bonnet and boot tops in their paint
 *   (dust; the burnt one in soot and rust), the windscreen glass.
 * - `manhole`, `manhole-shaft`: the round drain cover (cast ribs, rust, a lit far rim) and the open
 *   shaft (dark, rungs) — 16 × 16 world px, the opening's square.
 * - prop `post`: the old-town cast-iron post (a plinth, a fluted shaft, a brass collar, the chain
 *   ring, a ball top), thin enough for the front row (≤ 8 px wide at its scale), with its `chain`
 *   point for the row's sagging chains.
 */
import type { Color } from '../../../../../engine/color';
import type { Frame } from '../../../../../engine/render';
import { PAL_HD_OZ_R2 } from '../../../../../engine/palette-hd';
import { HdCanvas } from '../../../../art/hd/index';
import { hash2 } from '../../../../art/paint';
import { defineFloorProp, defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import { snap, T, tones, type Dn, type Rn } from '../art-kit';
import { blendRamps, dn, jointW, moodShift, moodTones, OZ_FLOOR_IDS, toneAt, vnoise, type OzLight } from './kit';
import { MANHOLE_R } from './town';

/** The awning sprite's colour pairs (art-street.ts `AWNING_COLOURS`, same order) and stripe width. */
export const AWNING_PAIRS: ReadonlyArray<readonly [Rn, Rn]> = [
  ['green', 'cloth'],
  ['red', 'cloth'],
  ['navy', 'steel'],
];
export const AWNING_STRIPE = 6;
/** The awning tile's width (4 stripe pairs: no visible repeat on a 48 px canopy). */
export const AWNING_TILE_W = 48;
/** The car frames (ruin/art.ts `CARS`): paint ramp and burnt. */
const CAR_PAINT: ReadonlyArray<{ paint: Rn; burnt: boolean }> = [
  { paint: 'red', burnt: false },
  { paint: 'steel', burnt: false },
  { paint: 'steel', burnt: true },
];

/** The town's own cold grade (art-street.ts `gt`): the sprites' colours, so canopies meet their valances. */
function townGrade(n: Rn, d: Dn, t: number): readonly Color[] {
  return tones(n, d, T('night', 3, 2), t);
}

function pickT(list: readonly Color[], v: number): Color {
  const k = Math.floor(v);
  return list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k];
}

/** Soot of the revision-2 ramps at d (1×: PAL). */
function r2(n: 'soot', d: Dn): readonly Color[] {
  return PAL_HD_OZ_R2[n].map((c) => (d === 1 ? snap(c >>> 0, 1) : c >>> 0));
}

/**
 * Rust on the floor's iron (the manholes, the burnt car): the rust ramp leaned half toward brown
 * (1×: PAL), and only its orange-brown tones (`RUST_MIN` up): under the dusk the deeper rust tones
 * turn a dark wine red, and nothing on the floor may read as blood.
 */
function rusty(d: Dn): readonly Color[] {
  return blendRamps('rust', 'brown', 0.5).map((c) => (d === 1 ? snap(c >>> 0, 1) : c >>> 0));
}
const RUST_MIN = 3;
/** The lowest tone of a red awning stripe; its shade and stains go brown below it (the no-blood rule). */
const RED_MIN = 3;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** A tone list per density, made once (tiles paint per texel: no key strings per call). */
function perD(make: (d: Dn) => readonly Color[]): (d: number) => readonly Color[] {
  const lists: Array<readonly Color[] | undefined> = [];
  return (d) => {
    const D = dn(d);
    let l = lists[D];
    if (!l) {
      l = make(D);
      lists[D] = l;
    }
    return l;
  };
}

/** Register the tiles of a light mood (once per mood). */
export function ensureOzTiles(light: OzLight): void {
  const id = OZ_FLOOR_IDS;
  if (hasFloorTile(id.kerbFace(light))) return;
  const sh = moodShift(light);
  const SST = perD((D) => moodTones('sandstone', light, D));
  const LEAD = perD((D) => moodTones('slate', light, D));
  const BRK = perD((D) => moodTones('brick', light, D));
  const BRD = perD((D) => moodTones('brickDark', light, D));
  const SND = perD((D) => moodTones('sand', light, D));
  const IRN = perD((D) => moodTones('black', light, D));
  const SOOT = perD((D) => r2('soot', D));
  const RUST = perD((D) => rusty(D));
  const DUST = perD((D) => townGrade('stone', D, 0.3));
  const GLASS = perD((D) => townGrade('night', D, 0.1));
  const GLINT = perD((D) => townGrade('steel', D, 0.5));

  defineFloorTile(id.kerbFace(light), {
    w: 24,
    h: 4,
    paint: (a, b, d) => {
      const S = SST(d);
      if (mod(a, 24) < jointW(d)) return toneAt(S, 1.6 + sh);
      if (b < 0.4) return toneAt(S, 4.8 + sh);
      if (b > 1.15) return toneAt(S, 1.2 + sh);
      return toneAt(S, 3.3 - b * 0.6 + (hash2(Math.floor(a / 24), 9, 85) - 0.5) * 0.5 + sh);
    },
  });

  defineFloorTile(id.slab(light), {
    w: 20,
    h: 16,
    paint: (a, b, d) => {
      const S = SST(d);
      if (b >= 13.3) return toneAt(S, 6 + sh);
      if (mod(a, 10) < jointW(d) * 0.8) return toneAt(S, 2.2 + sh);
      const g = hash2(Math.floor(a * 2), Math.floor(b * 2), 31) - 0.5;
      return toneAt(S, 4.4 - (1 - b / 14) * 1.3 + g * 0.5 + sh);
    },
  });

  defineFloorTile(id.bayRoof(light), {
    w: 16,
    h: 20,
    paint: (a, b, d) => {
      const Ld = LEAD(d);
      if (b >= 18.4) return toneAt(Ld, 4 + sh);
      if (b >= 17.2) return toneAt(Ld, 1.3 + sh);
      const seam = mod(a, 4) < Math.max(0.5, jointW(d) * 0.8);
      const g = hash2(Math.floor(a * 2), Math.floor(b), 33) - 0.5;
      return toneAt(Ld, (seam ? 3.1 : 2.1) + (b / 17) * 0.8 + g * 0.35 + sh);
    },
  });

  defineFloorTile(id.wallTop(light), {
    w: 6,
    h: 8,
    paint: (a, b, d) => {
      if (b >= 7.35) return toneAt(BRK(d), 5.2 + sh);
      if (mod(a, 3) < jointW(d)) return toneAt(SND(d), 1.6 + sh);
      const h = hash2(Math.floor(a / 3), 1, 37);
      return toneAt(h < 0.3 ? BRD(d) : BRK(d), 3.9 + (h - 0.5) * 0.8 - (b < 3 ? 0.6 : 0) + sh);
    },
  });

  CAR_PAINT.forEach((cp, frame) => {
    const PAINT = perD((D) => townGrade(cp.paint, D, 0.45));
    defineFloorTile(id.car(light, frame), {
      w: 16,
      h: 20,
      paint: (a, b, d) => {
        const g = hash2(Math.floor(a * 2), Math.floor(b * 2), 41 + frame) - 0.5;
        if (cp.burnt) {
          if (hash2(Math.floor(a / 2), Math.floor(b / 2), 43) > 0.72) return pickT(RUST(d), RUST_MIN + 0.6 + g * 1.2);
          return pickT(SOOT(d), (b >= 19.2 ? 3.2 : 1.8) + g * 1.2 + sh);
        }
        const paint = PAINT(d);
        const top = paint.length - 1;
        // A dust film on the top in clusters, a lit front arris.
        if (b >= 19.2) return pickT(paint, top * 0.9 + sh);
        if (hash2(Math.floor(a / 1.5), Math.floor(b / 1.5), 47 + frame) > 0.7) return pickT(DUST(d), 3.2 + g + sh);
        return pickT(paint, top * 0.72 - (b < 8 ? 0.8 : 0) + g * 0.8 + sh);
      },
    });
  });

  defineFloorTile(id.carGlass(light), {
    w: 16,
    h: 20,
    paint: (a, b, d) => {
      if (mod(a + b * 0.8, 13) < 1.2) return pickT(GLINT(d), 3 + sh);
      return pickT(GLASS(d), 1.6 + (b / 20) * 0.8 + sh);
    },
  });

  const R = MANHOLE_R;
  defineFloorTile(id.manhole(light), {
    w: 2 * R,
    h: 2 * R,
    paint: (a, b, d) => {
      const x = (a - R) / R;
      const y = (b - R) / R;
      const r = x * x + y * y;
      // The rim: lit far, dark near; cast ribs in a grid; orange-brown rust in the low parts.
      if (r > 0.82) return toneAt(IRN(d), (y < 0 ? 4.2 : 1.4) + sh);
      if (d >= 2 && hash2(Math.floor(a), Math.floor(b), 57) > 0.84) return pickT(RUST(d), RUST_MIN + hash2(Math.floor(a * 2), Math.floor(b * 2), 58) * 0.9);
      const rib = (Math.floor(a / 2.7) + Math.floor(b / 2.7)) % 2 === 0;
      return toneAt(IRN(d), (rib ? 3 : 2.2) - y * 0.5 + sh);
    },
  });

  defineFloorTile(id.manholeShaft(light), {
    w: 2 * R,
    h: 2 * R,
    paint: (a, b, d) => {
      const D = dn(d);
      // The far inner wall catches a little light; two rungs on it; the depth is black.
      if (Math.abs(a - R) < 3 && ((b > 5 && b < 5.7) || (b > 8 && b < 8.7))) return pickT(RUST(d), RUST_MIN + sh);
      if (b < 5) return T('stone', 1, D);
      return T('ink', b < 9 ? 1 : 0, D);
    },
  });
}

/**
 * The canopy tile of an awning in colour pair `colour` whose sprite starts at world x `x0` (the
 * stripes start at the awning's left edge, as the sprite's do): registered on first use.
 */
export function ozAwningTile(light: OzLight, colour: number, x0: number): string {
  const c = mod(Math.round(colour), AWNING_PAIRS.length);
  const phase = mod(Math.round(x0), AWNING_TILE_W);
  const id = OZ_FLOOR_IDS.awning(light, c, phase);
  if (hasFloorTile(id)) return id;
  const [ra, rb] = AWNING_PAIRS[c];
  const A = perD((D) => townGrade(ra, D, 0.3));
  const B = perD((D) => townGrade(rb, D, 0.3));
  const DIM = perD((D) => townGrade('brown', D, 0.3));
  const sh = moodShift(light);
  defineFloorTile(id, {
    w: AWNING_TILE_W,
    h: 20,
    paint: (a, b, d) => {
      const x = mod(a - phase, AWNING_TILE_W);
      const k = Math.floor(x / AWNING_STRIPE);
      const first = k % 2 === 0;
      const stripe = first ? A(d) : B(d);
      const red = (first ? ra : rb) === 'red';
      const u = (x - k * AWNING_STRIPE) / AWNING_STRIPE;
      // Shade under the facade (b small), lit toward the valance; a seam at each stripe edge.
      let t = (first ? 3 : 3.6) - (1 - Math.min(1, b / 16)) * 1.3 + sh;
      if (d >= 2 && (u < 0.5 / AWNING_STRIPE || u > 1 - 0.5 / AWNING_STRIPE)) t -= 0.5;
      // Rot: soft stains, a few small torn holes (the dark under the canvas shows).
      const st = vnoise(x, b * 1.6, 4, 51 + c);
      if (st > 0.86 && b > 3 && b < 14) return T('ink', 0, dn(d));
      if (st > 0.68) t -= 0.7;
      if (b >= 16.4) t += 0.8;
      // A red canvas darkens toward a dull brown, never a deep red (the no-blood rule).
      if (red && t < RED_MIN) return pickT(DIM(d), t);
      return pickT(stripe, t);
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- the iron post

/** The post's size at scale 1 (logical px) and its chain ring's height over the foot. */
export const POST_W = 5;
export const POST_H = 22;
const CHAIN_UP = 15.5;

/** The post frame at final scale k and density d (feet anchor, point `chain`). */
export function postFrame(light: OzLight, k: number, d: number): Frame {
  const D = dn(d);
  const w = Math.max(2, Math.ceil(POST_W * k));
  const h = Math.max(4, Math.ceil(POST_H * k));
  const c = new HdCanvas(w, h, D);
  const iron = c.material({ ramp: tones('black', D, T('night', 3, 2), 0.18), wrap: 0.05, rim: 0.15, spec: 0.8, shine: 20 });
  const brass = c.material({ ramp: tones('gold', D, T('night', 3, 2), 0.35), wrap: 0.05, rim: 0.1, spec: 0.7, shine: 22 });
  const cx = w / 2;
  const K = (x: number): number => x * k;
  const dark = moodShift(light) * 0.5;
  // Plinth, shaft, collar, the chain ring's boss, the ball top (feet at the frame's bottom).
  c.cylinder(cx - K(2.3), h - K(2.4), K(4.6), K(2.4), { mat: iron, z: 1.1, cap: 0.5, tone: -0.1 + dark });
  c.cylinder(cx - K(1.35), h - K(17.5), K(2.7), K(15.4), { mat: iron, z: 1, tone: dark });
  c.cylinder(cx - K(1.8), h - K(9.6), K(3.6), K(1.1), { mat: brass, z: 1.3, cap: 0.5, tone: -0.3 + dark });
  c.ellipsoid(cx, h - K(CHAIN_UP), K(1.7), K(1.2), { mat: iron, z: 1.25, tone: dark });
  c.ellipsoid(cx, h - K(19.6), K(2.1), K(2.1), { mat: iron, z: 1.3, tone: dark });
  const buf = c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 1 });
  return { buf, ox: cx, oy: h, density: D, pts: { chain: [0, -K(CHAIN_UP)] } };
}

/** Register the post prop of a light mood (once). */
export function ensureOzPost(light: OzLight): void {
  defineFloorProp(OZ_FLOOR_IDS.post(light), (scale, d) => postFrame(light, scale, d));
}
