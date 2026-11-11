/**
 * The floor materials of the oat streets (STREET-A, wave A; docs/design/oat.md §8.5, §8.7 a 6, §8.7
 * d 4, §8.10): tone ladders per material and light, and the brick patterns in WORLD space.
 *
 * - Materials (spec §8.7 a 6, research §2.3): the red-brown keiformaat clinkers of the street in
 *   herringbone ("elleboog", 45° to the kerb), the dikformaat pavement bricks in stretcher bond, the
 *   grey 30 × 30 concrete tiles, the blue-grey granite of kerbs and deck edges, the sandstone-grey
 *   quay coping with moss.
 * - Light: every material has a SUN and a SHADE ladder of the same length (shade ≤ 1.5 tones lower
 *   and a little cooler: the sky lights the shade, spec §8.3, §8.4) and a WET variant (one tone
 *   darker; the sky's sheen on the brick domes and in the joints, spec §8.10). At night (oat-d) the
 *   ladders sink toward the night water's wet black, and the LAMP ladder lifts brick near a light
 *   into its own warm lit ramp (spec §8.9 "lit brick in its own ramp").
 * - Every ladder colour is in the oat set (PAL_HD ∪ PAL_HD_OAT) at 2× / 4× and in PAL at 1× (the
 *   kit's `ladder` snaps); the floor's bilinear sampling then blends, as every floor does.
 * - Density rule (spec §8.10): fine detail at 4×, 2 × 2 clusters at 2×, only tone at 1× (no joints,
 *   no single-px noise: the 1× bricks are a calm tone field).
 *
 * The brick functions write their result into module scratch fields (no object per texel).
 */
import type { Color } from '../../../../../engine/color';
import { F, ladder, mx, snap, T, type Dn, type Rn } from '../art/kit';

/** The sun's colour at 09:30 (spec §8.3: 4,500 K, ≈ #ffd9b6) and the shade's sky cast (≈ #bfd3ff). */
export const SUN_A: Color = 0xffd9b6ff;
export const SKY_CAST: Color = 0xbfd3ffff;

/** A material's ladders: sun / shade × dry / wet, plus its joint tones. Same length per pair. */
export interface Mat {
  readonly sun: readonly Color[];
  readonly shade: readonly Color[];
  readonly sunWet: readonly Color[];
  readonly shadeWet: readonly Color[];
  /** The joints (sand, dirt): dry and wet. */
  readonly joint: readonly Color[];
  readonly jointWet: readonly Color[];
  /** Flat slabs: wet joints stay dark (no sky sheen: that is for the clinkers' domes). */
  readonly flatJoints?: boolean;
}

function stops(names: readonly (readonly [Rn, number])[], d: Dn): Color[] {
  return names.map(([n, k]) => T(n, k, d));
}

function cool(list: readonly Color[], t: number, d: Dn): Color[] {
  return list.map((c) => mx(c, SKY_CAST, t, d));
}

function darker(list: readonly Color[], k: number): readonly Color[] {
  return list.map((_, i) => list[Math.max(0, i - k)]);
}

function build(key: Rn[][], d: Dn, o: { warm?: number; coolT?: number; shadeShift?: number; wetShift?: number; joint: readonly Color[] }): Mat {
  const base = stops(key.map((k) => [k[0], Number(k[1])] as const) as unknown as readonly (readonly [Rn, number])[], d);
  return buildFrom(base, d, o);
}

function buildFrom(base: readonly Color[], d: Dn, o: { warm?: number; coolT?: number; shadeShift?: number; wetShift?: number; joint: readonly Color[] }): Mat {
  // The sun ladder: the base warmed toward the morning sun at the top.
  const warm = o.warm ?? 0.25;
  const sunStops = base.map((c, i) => mx(c, SUN_A, (warm * i) / Math.max(1, base.length - 1), d));
  const sun = ladder(sunStops, 2, d);
  // The shade: the same stops 1.5 tones lower (3 ladder steps), cooled by the sky.
  const shift = o.shadeShift ?? 3;
  const shadeStops = cool(base, o.coolT ?? 0.14, d);
  const shadeL = ladder(shadeStops, 2, d);
  const shade = sun.map((_, i) => shadeL[Math.max(0, Math.min(shadeL.length - 1, i - shift))]);
  const wk = o.wetShift ?? 2;
  return {
    sun,
    shade,
    sunWet: darker(sun, wk),
    shadeWet: darker(shade, wk),
    joint: ladder(o.joint, 2, d),
    jointWet: ladder(o.joint.map((c) => mx(c, T('oat.nightWater', 1, d), 0.35, d)), 2, d),
  };
}

/**
 * The light grey 30 × 30 concrete tiles (research §4 #a9a7a1): warm mortar greys in the sun; the shade
 * is the clinker's cool-tint build (`cool`, the sky's cast: spec §8.3, §8.4) about one tone lower,
 * never a cool gable mix. The cast is 0.06 (at the clinker's 0.14 the dark stop snaps to a mauve
 * #7d6d80, lighter than the next stop) and the shade ladder has no in-between steps (the mix of
 * #635857 and #7b746a snaps to the green-grey #58615c, which checkers against the warm tiles). At 1×
 * one PAL step down, no cast (as the clinker). The joints are warm and recessed (spec §8.5: never the
 * even cool grid of `ams`): the stone / mortar greys one to two steps below the tile (the painter
 * varies them per joint run), the wet joints sunk toward the wet black, still warm.
 */
function tileMat(d: Dn): Mat {
  const base = [T('stone', 2, d), T('oat.mortar', 0, d), T('oat.mortar', 1, d), T('oat.mortar', 2, d), T('stone', 5, d), T('cloth', 4, d)];
  const sun = ladder(base, 2, d);
  const shadeL = ladder(cool(base, d === 1 ? 0 : 0.06, d), 1, d);
  const shade = sun.map((_, i) => shadeL[Math.max(0, Math.min(shadeL.length - 1, Math.floor((i * (shadeL.length - 1)) / (sun.length - 1)) - 1))]);
  const joint = [T('stone', 1, d), mx(T('stone', 1, d), T('stone', 2, d), 0.5, d), T('stone', 2, d), T('oat.mortar', 0, d), T('oat.mortar', 1, d)];
  return {
    sun,
    shade,
    sunWet: darker(sun, 1),
    shadeWet: darker(shade, 1),
    joint: ladder(joint, 1, d),
    jointWet: ladder(joint.map((c) => mx(c, T('oat.nightWater', 1, d), 0.35, d)), 1, d),
    flatJoints: true,
  };
}

/** The day materials at density d (cached). */
export interface DayMats {
  readonly clinker: Mat;
  readonly paver: Mat;
  readonly tile: Mat;
  readonly granite: Mat;
  readonly coping: Mat;
  /** The sky's sheen on wet brick (shade sees the bright slot of sky; sun sees the low sky). */
  readonly sheen: readonly Color[];
  /** A puddle: the sky mirrored (pale), its dark rim. */
  readonly puddle: readonly Color[];
  /**
   * Wear: moss, gum, ash, paper, leaves (yellow-green elm leaves of late September), iron, oil (a dark
   * warm grey-brown stain: core, body, rim, and the thin sheen it shows on wet brick only).
   */
  readonly moss: readonly Color[];
  readonly gum: readonly Color[];
  readonly butt: readonly Color[];
  readonly paper: readonly Color[];
  readonly leaf: readonly Color[];
  readonly iron: readonly Color[];
  readonly oil: readonly Color[];
}

const dayCache = new Map<Dn, DayMats>();

export function dayMats(d: Dn): DayMats {
  let m = dayCache.get(d);
  if (m) return m;
  const joint = [T('stone', 1, d), T('stone', 2, d), T('oat.mortar', 0, d)];
  // 1× (INTEGRATE-A): the sky cast of the shade pulled the shaded wet brick to the nearest PAL grey, so
  // the whole shaded street read flat grey at 1×; at 1× the shade keeps the brick's own hue (no cast),
  // one PAL step lower, so the red-brown clinkers stay red-brown in the shade too.
  const brick1 = d === 1 ? { coolT: 0, shadeShift: 1 } : {};
  m = {
    clinker: build([['oat.brick', 1], ['oat.brick', 2], ['oat.brick', 3], ['oat.brick', 4], ['oat.brick', 5], ['oat.brick', 6]] as unknown as Rn[][], d, { joint, ...brick1 }),
    paver: buildFrom([T('oat.brick', 2, d), mx(T('oat.brick', 3, d), T('brick', 3, d), 0.35, d), mx(T('oat.brick', 4, d), T('brick', 4, d), 0.35, d), mx(T('oat.brick', 5, d), T('brick', 5, d), 0.3, d), T('oat.brick', 6, d)], d, { joint, warm: 0.3, ...brick1 }),
    tile: tileMat(d),
    granite: buildFrom([T('slate', 2, d), T('steel', 2, d), T('steel', 3, d), mx(T('steel', 4, d), T('stone', 4, d), 0.4, d), mx(T('steel', 5, d), T('stone', 5, d), 0.4, d), T('stone', 6, d)], d, { joint: [T('slate', 1, d), T('slate', 2, d)], warm: 0.2 }),
    coping: buildFrom([T('stone', 2, d), T('oat.mortar', 0, d), T('oat.mortar', 1, d), T('oat.mortar', 2, d), T('oat.mortar', 3, d), T('stone', 6, d)], d, { joint: [T('stone', 1, d), T('moss', 1, d), T('stone', 2, d)], warm: 0.22 }),
    sheen: ladder([T('oat.canal', 3, d), T('oat.canal', 4, d), T('oat.canal', 5, d), mx(T('oat.canal', 5, d), T('sky', 6, d), 0.5, d)], 2, d),
    puddle: ladder([T('oat.canal', 2, d), T('oat.canal', 4, d), mx(T('sky', 5, d), T('stone', 6, d), 0.4, d), T('sky', 6, d)], 2, d),
    moss: ladder([T('moss', 1, d), T('moss', 2, d), T('moss', 3, d), T('olive', 4, d)], 1, d),
    gum: [T('stone', 1, d), T('stone', 2, d), T('stone', 3, d)],
    butt: [T('cloth', 3, d), T('cloth', 4, d), T('sand', 5, d), T('orange', 3, d)],
    paper: [T('stone', 4, d), T('stone', 5, d), T('cloth', 4, d)],
    leaf: [T('gold', 3, d), T('gold', 4, d), T('olive', 5, d), T('olive', 6, d), T('gold', 5, d)],
    iron: [T('ink', 1, d), T('black', 2, d), T('black', 3, d), T('steel', 2, d)],
    oil: [T('oat.nightWater', 1, d), mx(T('oat.nightWater', 1, d), T('stone', 1, d), 0.5, d), T('stone', 1, d), mx(T('oat.canal', 3, d), T('purple', 2, d), 0.25, d)],
  };
  dayCache.set(d, m);
  return m;
}

/** The night materials of oat-d (cached): everything wet; the lamp ladders for lit brick. */
export interface NightMats {
  /** The quay's clinkers in the dark (all wet), and lifted by warm lantern light. */
  readonly clinker: readonly Color[];
  readonly lamp: readonly Color[];
  /** Neon spill on the wet floor (pink, cyan) and the red-tube wash. */
  readonly pink: readonly Color[];
  readonly cyan: readonly Color[];
  readonly red: readonly Color[];
  readonly joint: readonly Color[];
  readonly granite: readonly Color[];
  readonly coping: readonly Color[];
  readonly paver: readonly Color[];
  readonly glass: readonly Color[];
  readonly paper: readonly Color[];
  readonly gum: readonly Color[];
  readonly iron: readonly Color[];
  /** The wet sheen of the dark sky (navy) on brick domes far from lamps. */
  readonly sheen: readonly Color[];
  /** A puddle's dark mirror: the wet black in the ripple's troughs → the navy sky on its crests. */
  readonly mirror: readonly Color[];
}

const nightCache = new Map<Dn, NightMats>();

export function nightMats(d: Dn): NightMats {
  let m = nightCache.get(d);
  if (m) return m;
  const black = T('oat.nightWater', 0, d);
  const wet = T('oat.nightWater', 1, d);
  m = {
    clinker: ladder([black, wet, mx(T('oat.brick', 1, d), wet, 0.3, d), T('oat.brick', 1, d), T('oat.brick', 2, d)], 2, d),
    // Dark → bright with no dip (the lamp-lit wet #948267 before the warm brick), so the pool's fall-off reads as one ramp.
    lamp: ladder([T('oat.brick', 2, d), T('oat.brick', 3, d), T('oat.nightWater', 3, d), mx(T('oat.brick', 5, d), T('oat.lantern', 1, d), 0.35, d), mx(T('oat.lantern', 1, d), T('oat.lantern', 2, d), 0.5, d), T('oat.lantern', 2, d)], 2, d),
    pink: ladder([mx(T('oat.brick', 1, d), T('oat.neonPink', 0, d), 0.25, d), mx(T('oat.brick', 2, d), T('oat.neonPink', 0, d), 0.45, d), T('oat.neonPink', 0, d), T('oat.neonPink', 1, d)], 2, d),
    cyan: ladder([mx(T('oat.nightWater', 1, d), T('oat.neonCyan', 0, d), 0.25, d), mx(T('oat.nightWater', 2, d), T('oat.neonCyan', 0, d), 0.5, d), T('oat.neonCyan', 0, d), T('oat.neonCyan', 1, d)], 2, d),
    red: ladder([mx(T('oat.brick', 1, d), T('oat.redLight', 0, d), 0.3, d), T('oat.redLight', 0, d), mx(T('oat.redLight', 0, d), T('oat.redLight', 1, d), 0.5, d), T('oat.redLight', 1, d), T('oat.redLight', 2, d)], 2, d),
    joint: [black, black, wet],
    granite: ladder([black, T('slate', 1, d), T('slate', 2, d), T('steel', 2, d), T('steel', 3, d)], 2, d),
    coping: ladder([black, T('slate', 1, d), mx(T('oat.mortar', 0, d), T('slate', 1, d), 0.6, d), mx(T('oat.mortar', 1, d), T('slate', 2, d), 0.5, d)], 2, d),
    paver: ladder([black, wet, mx(T('oat.brick', 1, d), wet, 0.2, d), T('oat.brick', 1, d), T('oat.brick', 2, d)], 2, d),
    glass: [T('green', 3, d), T('olive', 5, d), T('oat.lantern', 2, d), T('gold', 4, d)],
    paper: [T('stone', 3, d), T('stone', 4, d), T('cloth', 3, d)],
    gum: [black, T('slate', 1, d)],
    iron: [black, T('ink', 1, d), T('slate', 2, d)],
    sheen: ladder([T('oat.nightSky', 1, d), T('navy', 3, d), T('navy', 4, d)], 2, d),
    mirror: ladder([black, wet, T('oat.nightSky', 1, d), T('navy', 3, d), T('navy', 4, d)], 2, d),
  };
  nightCache.set(d, m);
  return m;
}

// ------------------------------------------------------------------------------------ bricks

/** Scratch results of the brick functions (no object per texel). */
export const B = {
  /** The brick's hash 0 … 1 (its tone), a second hash (wear), joint 0 / 1, the arris −1 (shade) / 0 / 1 (lit). */
  h: 0,
  h2: 0,
  joint: 0,
  edge: 0,
  /** The texel's place in its brick: 0 … 1 across (toward the back for the sheen). */
  across: 0.5,
  /** Brick id (for decals that pick a brick: a sunken or cracked one). */
  id: 0,
};

function fh(a: number, b: number, s: number): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * Herringbone (elleboog) clinkers at 45° to the kerb, bricks W × 2W world px (keiformaat 10 × 20
 * cm at 20 px/m: W = 2), in world (u, v). jw = joint half width, bv = bevel width (world px).
 */
export function herringbone(u: number, v: number, W: number, jw: number, bv: number, seed: number): void {
  const k = 1 / (Math.SQRT2 * W);
  const x = (u + v) * k;
  const y = (u - v) * k;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = x - cx;
  const fy = y - cy;
  const r = (((cx - cy) % 4) + 4) % 4;
  let ix = cx;
  let iy = cy;
  // Local coordinates in brick cells: along (0 … 2) and across (0 … 1).
  let along: number;
  let across: number;
  let horiz: boolean;
  if (r === 0 || r === 1) {
    horiz = true;
    if (r === 1) ix = cx - 1;
    along = r === 0 ? fx : 1 + fx;
    across = fy;
  } else {
    horiz = false;
    if (r === 2) iy = cy - 1;
    along = r === 3 ? fy : 1 + fy;
    across = fx;
  }
  const jc = jw * k;
  const bc = bv * k;
  B.h = fh(ix, iy * 2 + (horiz ? 1 : 0), seed);
  B.h2 = fh(iy, ix * 3 + 7, seed + 11);
  B.id = (ix * 7919 + iy * 104729 + (horiz ? 1 : 0)) | 0;
  const dA = Math.min(along, 2 - along);
  const dC = Math.min(across, 1 - across);
  B.joint = dA < jc || dC < jc ? 1 : 0;
  B.edge = 0;
  if (!B.joint && bc > 0 && (dA < jc + bc || dC < jc + bc)) {
    // The arris: the sides that face the sun (left, front: −u, +v) lit, the others shaded.
    // H bricks run along (1, 1)/√2 in (u, v): across 0 faces (−1, +1) → lit; across 1 faces (+1, −1).
    // V bricks run along (1, −1)/√2: along 0 faces (−1, +1) → lit; along 2 faces (+1, −1).
    if (dC < dA) B.edge = horiz ? (across < 0.5 ? 1 : -1) : 0;
    else B.edge = horiz ? 0 : along < 1 ? 1 : -1;
  }
  // Toward the back (−v) within the brick: the sheen side.
  B.across = horiz ? 1 - across : along / 2;
}

/**
 * Stretcher bond along u (dikformaat 21 × 10 cm at 20 px/m: L 4.2, W 2), rows along u in v, every
 * other row offset by half a brick.
 */
export function stretcher(u: number, v: number, L: number, W: number, jw: number, bv: number, seed: number): void {
  const row = Math.floor(v / W);
  const fv = v / W - row;
  const uu = u / L + (row & 1 ? 0.5 : 0);
  const col = Math.floor(uu);
  const fu = uu - col;
  B.h = fh(col, row, seed);
  B.h2 = fh(row, col, seed + 5);
  B.id = (col * 7919 + row * 104729) | 0;
  const ju = jw / L;
  const jv = jw / W;
  B.joint = fu < ju || fu > 1 - ju || fv < jv || fv > 1 - jv ? 1 : 0;
  B.edge = 0;
  if (!B.joint && bv > 0) {
    const bu = (jw + bv) / L;
    const bvv = (jw + bv) / W;
    if (fu < bu) B.edge = 1;
    else if (fu > 1 - bu) B.edge = -1;
    else if (fv > 1 - bvv) B.edge = 1;
    else if (fv < bvv) B.edge = -1;
  }
  B.across = 1 - fv;
}

/** Square slabs of `S` world px (the 30 × 30 tiles: S 6), a straight grid. */
export function slabs(u: number, v: number, S: number, jw: number, bv: number, seed: number): void {
  const a = u / S;
  const b = v / S;
  const ca = Math.floor(a);
  const cb = Math.floor(b);
  const fa = a - ca;
  const fb = b - cb;
  B.h = fh(ca, cb, seed);
  B.h2 = fh(cb, ca, seed + 3);
  B.id = (ca * 7919 + cb * 104729) | 0;
  const j = jw / S;
  B.joint = fa < j || fa > 1 - j || fb < j || fb > 1 - j ? 1 : 0;
  B.edge = 0;
  if (!B.joint && bv > 0) {
    const e = (jw + bv) / S;
    if (fa < e || fb > 1 - e) B.edge = 1;
    else if (fa > 1 - e || fb < e) B.edge = -1;
  }
  B.across = 1 - fb;
}

/** Long stones along u (kerbs, copings, deck edges): blocks of L world px. */
export function blocks(u: number, L: number, jw: number, seed: number): void {
  const a = u / L;
  const c = Math.floor(a);
  const f = a - c;
  B.h = fh(c, 3, seed);
  B.h2 = fh(c, 9, seed + 1);
  B.id = c | 0;
  const j = jw / L;
  B.joint = f < j || f > 1 - j ? 1 : 0;
  B.edge = f < j + 0.03 ? 1 : f > 1 - j - 0.03 ? -1 : 0;
  B.across = 0.5;
}

/** A world-anchored hash 0 … 1 of a texel cell (cells of 1 px at 1×, ½ px at 2× / 4×). */
export function grainAt(u: number, v: number, d: number, seed: number): number {
  const k = d <= 1 ? 1 : 2;
  return fh(Math.floor(u * k), Math.floor(v * k), seed);
}

/** Hash of a world cell (for decals). */
export function cellHash(a: number, b: number, seed: number): number {
  return fh(a, b, seed);
}

/** A ladder colour by continuous index (clamped). */
export function at(list: readonly Color[], t: number): Color {
  const k = Math.floor(t);
  return list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k];
}

/** The fraction tone of a PAL_HD / oat ramp (re-exported for the tiles). */
export { F, snap };
