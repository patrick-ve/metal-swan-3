/**
 * SWAN-3 art rig, part 2: the ringed neck and the head (docs/design/swan-mount/look.md §5.6,
 * §5.7, §11).
 *
 * - The neck is six ivory rings on a steel hose, placed along a cubic Bézier from the socket
 *   (P0 = (0, 0)) to the head centre P3. Ring thickness 7, 7, 6, 6, 5, 5 from the base. Longer
 *   than 24 px, the rings spread apart and the hose shows between them: the neck telescopes.
 * - The head: an ivory dome 9 × 8, one lens eye with a steel shutter lid (the expressions), a
 *   navy face patch and the long orange beak — the gun. Muzzle = P3 + 12u (u = the beak
 *   direction). Past −90° the head faces back (drawn mirrored, the eye stays on top).
 * - Never a helmet, visor, goggles, crest, plume, knob, stick, lever or panel on the head or neck.
 *
 * `drawSwanHead` / `swanHeadIcon` draw the same head for the HUD and menus (ui/icon-life,
 * ui/cursor-swan).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import type { Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Pt, V } from './kit.art';
import { OWN, OX, OY, Stack, add, bez, dot, fine, harvest, kitDensity, lerp2, placeHi, poly, release, shade, sub, take, thick, unit, withHiCover, withKitDensity } from './kit.art';

/** Colour scheme: SWAN-3 (ivory) or P2's "the Mute" (black neck, head and beak). */
export type SwanColour = 'ivory' | 'mute';

/**
 * Eye expressions (look.md §5.7) and the four looks of `empty-look` (pupil back / front,
 * low / high).
 */
export type SwanEye =
  | 'normal'
  | 'angry'
  | 'blink'
  | 'half'
  | 'squint'
  | 'happy'
  | 'wide'
  | 'dizzy'
  | 'back-low'
  | 'front-low'
  | 'back-high'
  | 'front-high';

/** One neck pose: Bézier control points relative to the socket, beak direction, face. */
export interface NeckSpec {
  p1: Pt;
  p2: Pt;
  /** Head centre. */
  p3: Pt;
  /** Beak direction in degrees (0 = her facing, − = up, + = down). */
  angle: number;
  eye?: SwanEye;
  /** Beak opening at the tip (px). */
  gap?: number;
  /** The head lies on its side (dazed): drawn without the face patch, beak a little open. */
  flop?: boolean;
}

export interface NeckOut {
  /** Head centre (body space). */
  head: V;
  /** Beak tip: P3 + 12u (body space, rounded). */
  muzzle: [number, number];
}

const RINGS = [7, 7, 6, 6, 5, 5] as const;

interface Paint {
  ring: Ramp;
  ringBase: number;
  beak: Ramp;
  glint: Color | null;
}

function paintOf(colour: SwanColour): Paint {
  return colour === 'mute'
    ? { ring: PAL.black, ringBase: 2, beak: PAL.black, glint: PAL.steel[3] }
    : { ring: PAL.snow, ringBase: 2, beak: PAL.orange, glint: null };
}

/** Beak direction unit vector. */
function dirOf(angle: number): V {
  const r = (angle * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

/**
 * Draw the neck (hose, rings, collar) and the head into a stack, with the socket at `socket`
 * (body space). Rings go base first, so each ring's edge is a steel joint line on the one before.
 */
export function drawNeck(st: Stack, socket: Pt, spec: NeckSpec, colour: SwanColour, collar = true): NeckOut {
  return withHiCover(NECK_NEAR, NECK_INSET, () => drawNeckAt(st, socket, spec, colour, collar));
}

/** The neck and head's tighter 2× coverage (`withHiCover`): the 2× masks match the 1× ones. */
const NECK_NEAR = 0.4;
const NECK_INSET = 0.75;

function drawNeckAt(st: Stack, socket: Pt, spec: NeckSpec, colour: SwanColour, collar: boolean): NeckOut {
  const pa = paintOf(colour);
  const P0: Pt = socket;
  const P1 = add(socket, spec.p1);
  const P2 = add(socket, spec.p2);
  const P3 = add(socket, spec.p3);
  // Arc-length samples of the Bézier.
  const pts: V[] = [];
  const acc: number[] = [];
  let total = 0;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const q = bez(P0, P1, P2, P3, i / steps);
    if (i > 0) total += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
    pts.push(q);
    acc.push(total);
  }
  const at = (d: number): V => {
    if (d <= 0) return pts[0];
    for (let i = 1; i < acc.length; i++) {
      if (acc[i] >= d) return lerp2(pts[i - 1], pts[i], (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1));
    }
    return pts[pts.length - 1];
  };
  // The hose: steel, 1 px on the inside of the curve (and between spread rings).
  const hose = take();
  const mid = at(total / 2);
  const chordMid = lerp2(P0, P3, 0.5);
  const inside = unit(sub(chordMid, mid));
  const off = Math.hypot(inside[0], inside[1]) > 0.1 ? inside : ([0, 0] as V);
  for (let i = 1; i < pts.length; i++) {
    const t0 = Math.min(1, acc[i - 1] / Math.max(1, total));
    if (t0 > 0.92) break;
    const w = 3;
    const a = add(pts[i - 1], off, 1.6);
    const b = add(pts[i], off, 1.6);
    thick(hose, a, b, w, PAL.steel[1]);
  }
  st.put(hose, OWN.neck, PAL.steel[0], false);
  // Rings.
  const ringLen = total <= 24 ? total / 6 : 4;
  for (let k = 0; k < 6; k++) {
    const c = total <= 24 ? (k + 0.5) * ringLen : 2 + ((k + 0.5) * (total - 4)) / 6;
    const a = at(Math.max(0, c - ringLen / 2));
    const b = at(Math.min(total, c + ringLen / 2));
    const L = take();
    thick(L, a, b, RINGS[k], pa.ring[2]);
    shade(L, pa.ring, { base: pa.ringBase });
    if (pa.glint !== null) {
      // The Mute: a steel glint on the lit edge of each ring.
      const mx = Math.round((a[0] + b[0]) / 2 - RINGS[k] / 2 + 1);
      const my = Math.round((a[1] + b[1]) / 2 - RINGS[k] / 2 + 1);
      if (L.d === 2) {
        // 2×: a short 1-px glint streak on the lit shoulder of the ring.
        for (const [gx, gy] of [[0, 0.5], [0.5, 0], [1, 0]] as const) if (L.get(mx + gx, my + gy) !== 0) fine(L, mx + gx, my + gy, pa.glint);
      } else if (L.get(mx, my) !== 0) dot(L, mx, my, pa.glint);
    }
    st.put(L, OWN.neck, pa.ring[0]);
  }
  // The navy collar at the base (9 across × 5 along, two gold rivets).
  if (collar) drawCollar(st, P0, unit(sub(at(3), P0)));
  return drawHeadAt(st, P3, spec, colour);
}

/** The navy neck collar on the socket, across the neck's first direction `t`. */
export function drawCollar(st: Stack, socket: Pt, t: Pt): void {
  const n: V = [-t[1], t[0]];
  const c = add(socket, t, 0.5);
  const corner = (a: number, b: number): V => [c[0] + t[0] * a + n[0] * b, c[1] + t[1] * a + n[1] * b];
  const L = take();
  poly(L, [corner(-2.2, -4.2), corner(2.2, -4.2), corner(2.2, 4.2), corner(-2.2, 4.2)], PAL.navy[1]);
  shade(L, PAL.navy, { base: 1 });
  st.add(L, OWN.neck, PAL.navy[0]);
  release(L);
  for (const s of [-2.6, 2.6]) {
    const p = add(c, n, s);
    if (st.d === 2) {
      // A round 2× stud: lit up-left, dark down-right.
      const x = Math.round(p[0]);
      const y = Math.round(p[1]);
      st.fine(x, y, PAL.gold[3]);
      st.fine(x + 0.5, y, PAL.gold[2]);
      st.fine(x, y + 0.5, PAL.gold[2]);
      st.fine(x + 0.5, y + 0.5, PAL.gold[0]);
    } else st.detail(p[0], p[1], PAL.gold[3]);
  }
}

/**
 * The head: dome, face patch, lens eye, beak. Returns the head centre and the muzzle
 * (P3 + 12u). `P3` is in body space. The head is designed in local coordinates (x along the
 * beak, y down on the head) and mapped with the beak direction, so every aim angle and the
 * mirrored back-facing head share one drawing.
 */
export function drawHead(st: Stack, P3: Pt, spec: NeckSpec, colour: SwanColour): NeckOut {
  return withHiCover(NECK_NEAR, NECK_INSET, () => drawHeadAt(st, P3, spec, colour));
}

function drawHeadAt(st: Stack, P3: Pt, spec: NeckSpec, colour: SwanColour): NeckOut {
  const pa = paintOf(colour);
  const u = dirOf(spec.angle);
  // Past −90° she looks back: the head is drawn mirrored, the eye stays on top.
  const f = Math.cos((spec.angle * Math.PI) / 180) < -0.01 ? -1 : 1;
  // Local "down" on the head (the beak's normal away from the eye).
  const dn: V = f > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
  const loc = (x: number, y: number): V => [P3[0] + u[0] * x + dn[0] * y, P3[1] + u[1] * x + dn[1] * y];
    // Dome about 9 × 8: round at the back, tapering forward into the beak base (an egg that
  // points along the beak), so the head reads as a bird's head at every aim.
  const dome = take();
  const domePts: V[] = [];
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI / 2 + (k / 10) * Math.PI;
    domePts.push(loc(-0.6 + Math.cos(a) * 4.2, -0.3 + Math.sin(a) * 3.9));
  }
  domePts.push(loc(1.6, -4), loc(3.3, -2.6), loc(4, -0.6), loc(3.6, 1.8), loc(1.8, 3.4));
  poly(dome, domePts, pa.ring[2]);
  if (dome.d === 2) {
    // 2×: the small chin tuft that the 1× dome's flat bottom row makes under its centre.
    for (const [x, y] of [[-1.3, 3.9], [-0.8, 3.9], [-0.3, 3.9], [-1.1, 4.4], [-0.6, 4.4]] as const) {
      const p = loc(x, y);
      fine(dome, p[0] + 0.25, p[1] + 0.25, pa.ring[2]);
    }
  }
  shade(dome, pa.ring, { base: pa.ringBase, glint: colour === 'ivory' });
  st.put(dome, OWN.head, pa.ring[0]);
  // Face patch (ivory only): a navy wedge from the lower front of the eye to the beak base, like
  // the dark face skin of a real swan (never a band round the head).
  if (colour === 'ivory' && !spec.flop) {
    const L = take();
    const patch = [loc(1.2, -0.2), loc(3.6, -2.2), loc(4.2, -0.4), loc(3.8, 1.8), loc(2, 1.2)];
    // At 2× the corners snap to the logical grid as the 1× polygon's do (the same wedge).
    poly(L, st.d === 2 ? patch.map((q): V => [Math.round(q[0]), Math.round(q[1])]) : patch, PAL.navy[0]);
    st.put(L, OWN.head, PAL.navy[0], false);
  }
  // Beak (= the gun barrel): base half width 2 at x 3, tip half width 1 at x 11.
  const gap = spec.gap ?? (spec.flop ? 1 : 0);
  const open = gap > 0 ? (Math.atan2(gap / 2, 8) * 180) / Math.PI : 0;
  const mandibles: Array<{ pts: V[]; tip: V; along: V }> = [];
  if (open === 0) {
    mandibles.push({ pts: [loc(3, -2), loc(11, -1), loc(11, 1), loc(3, 2)], tip: loc(11, 0), along: u });
  } else {
    // Each mandible turns about the beak base by half the opening.
    for (const side of [-1, 1]) {
      const a = (side * open * Math.PI) / 180;
      const lu: V = [Math.cos(a), Math.sin(a)];
      const m = (x: number, y: number): V => loc(3 + (x - 3) * lu[0] - y * lu[1], (x - 3) * lu[1] + y * lu[0]);
      const pts = side < 0 ? [m(3, -2), m(11, -1), m(11, 0), m(3, 0)] : [m(3, 0), m(11, 0), m(11, 1), m(3, 2)];
      mandibles.push({ pts, tip: m(11, side < 0 ? -0.5 : 0.5), along: unit(sub(m(11, 0), m(3, 0))) });
    }
  }
  for (const md of mandibles) {
    const L = take();
    poly(L, md.pts, pa.beak[2]);
    shade(L, pa.beak, { base: 2 });
    // The steel nail: the last 2 px.
    if (L.d === 2) {
      // 2×: the nail on the finer grid, lit along its upper edge, a dark seam where it meets the bill.
      for (let k = 0; k <= 5; k++) {
        for (const w of [-1.35, -0.95, -0.55, -0.15, 0.25, 0.65, 1.05, 1.45]) {
          const p = add(add(md.tip, md.along, -k * 0.45), dn, w);
          const x = p[0] + 0.25;
          const y = p[1] + 0.25;
          if (L.get(x, y) === 0) continue;
          fine(L, x, y, k === 5 ? pa.beak[0] : k <= 1 ? PAL.steel[2] : w < -0.5 ? PAL.steel[4] : PAL.steel[3]);
        }
      }
    } else {
      for (let k = 0; k <= 2; k++) {
        for (const w of [-1.2, -0.4, 0.4, 1.2]) {
          const p = add(add(md.tip, md.along, -k * 0.9), dn, w);
          if (L.get(p[0], p[1]) !== 0) dot(L, p[0], p[1], k === 0 ? PAL.steel[2] : PAL.steel[3]);
        }
      }
    }
    st.put(L, OWN.head, pa.beak[0]);
  }
  // Gold breech ring across the beak at x 4, the bore at the tip.
  if (st.d === 2) {
    // 2×: a lit band and a dark band, 1 px each, across the whole beak.
    for (let w = -2; w <= 2; w += 0.4) {
      for (const [x, c] of [[3.9, w < 0 ? PAL.gold[3] : PAL.gold[2]], [4.4, w < 0 ? PAL.gold[1] : PAL.gold[0]]] as const) {
        const p = loc(x, w);
        st.fine(p[0] + 0.25, p[1] + 0.25, c, OWN.head);
      }
    }
    if (open === 0) {
      // The bore: a dark 2× pixel pair at the tip with the lit lip above it.
      for (const [x, w, c] of [[10.8, -0.25, INK], [10.8, 0.25, INK], [10.3, -0.25, PAL.steel[1]]] as const) {
        const p = loc(x, w);
        st.fine(p[0] + 0.25, p[1] + 0.25, c, OWN.head);
      }
    }
  } else {
    for (const w of [-1.8, -0.9, 0, 0.9, 1.8]) {
      const p = loc(4.2, w);
      st.detail(p[0], p[1], w < 0 ? PAL.gold[2] : PAL.gold[1], OWN.head);
    }
    if (open === 0) {
      const t = loc(11, 0);
      st.detail(t[0], t[1], INK, OWN.head);
    }
  }
  // The lens eye on the upper half of the dome, 1 px toward the beak.
  const e = loc(1, -1.5);
  drawEye(st, [Math.round(e[0]), Math.round(e[1])], f, spec.eye ?? 'normal', colour);
  return { head: [P3[0], P3[1]], muzzle: [Math.round(P3[0] + u[0] * 12) + 0, Math.round(P3[1] + u[1] * 12) + 0] };
}

/**
 * The lens eye (look.md §5.7): a 4 × 4 gold ring with a 2 × 2 white lens, an ink pupil and a
 * white glint; the steel shutter lid makes the expressions. `e` = the lens centre (rounded),
 * `f` = 1 facing right, −1 facing back.
 */
function drawEye(st: Stack, e: V, f: number, eye: SwanEye, colour: SwanColour): void {
  if (st.d === 2) {
    drawEyeHi(st, e, f, eye, colour);
    return;
  }
  const x0 = e[0] - 1;
  const y0 = e[1] - 1;
  // Local (lx, ly) in 0..3, mirrored when the head faces back.
  const P = (lx: number, ly: number, c: Color): void => {
    const x = f > 0 ? x0 + lx - 1 : x0 + (3 - lx) - 1;
    st.detail(x, y0 + ly - 1, c);
  };
  const skin = colour === 'mute' ? PAL.black[2] : PAL.snow[2];
  const lid = PAL.steel[3];
  if (colour === 'mute') {
    // A steel rim round the lens replaces the face patch.
    for (const [lx, ly] of [[0, -1], [1, -1], [2, -1], [3, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3], [4, 0], [4, 1], [4, 2], [4, 3], [0, 4], [1, 4], [2, 4], [3, 4]] as const) {
      P(lx, ly, PAL.steel[2]);
    }
  }
  if (eye === 'wide') {
    // Lens 5 × 5, pupil centred.
    for (let ly = -1; ly <= 3; ly++) for (let lx = -1; lx <= 3; lx++) {
      const corner = (lx === -1 || lx === 3) && (ly === -1 || ly === 3);
      if (corner) continue;
      const ring = lx === -1 || lx === 3 || ly === -1 || ly === 3;
      P(lx, ly, ring ? PAL.gold[2] : PAL.snow[3]);
    }
    P(1, 1, INK);
    P(0, 0, PAL.snow[3]);
    return;
  }
  if (eye === 'happy') {
    // An ink ^ arc.
    P(0, 2, INK);
    P(1, 1, INK);
    P(2, 1, INK);
    P(3, 2, INK);
    return;
  }
  if (eye === 'dizzy') {
    // A 4 × 4 ink spiral.
    const sp: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [1, 1], [2, 1], [2, 2]];
    for (const [lx, ly] of sp) P(lx, ly, INK);
    P(1, 2, skin);
    return;
  }
  // The gold ring (corners left out) and the lens.
  for (const [lx, ly] of [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]] as const) P(lx, ly, lx + ly <= 2 ? PAL.gold[2] : PAL.gold[1]);
  P(1, 1, PAL.snow[3]);
  P(2, 1, PAL.snow[3]);
  P(1, 2, PAL.snow[3]);
  P(2, 2, PAL.snow[3]);
  switch (eye) {
    case 'normal':
    case 'front-low':
      P(2, 2, INK);
      break;
    case 'back-low':
      P(1, 2, INK);
      break;
    case 'back-high':
      P(1, 1, INK);
      break;
    case 'front-high':
      P(2, 1, INK);
      break;
    case 'angry':
      // The lid slants down toward the beak over the top row.
      P(0, 0, lid);
      P(1, 0, lid);
      P(2, 0, lid);
      P(3, 0, lid);
      P(2, 1, lid);
      P(3, 1, lid);
      P(0, 1, INK);
      P(1, 1, INK);
      P(2, 2, INK);
      break;
    case 'half':
      for (let lx = 0; lx <= 3; lx++) P(lx, 0, lid);
      P(1, 1, lid);
      P(2, 1, lid);
      P(0, 1, INK);
      P(3, 1, INK);
      P(2, 2, INK);
      break;
    case 'blink':
      for (let ly = 0; ly <= 2; ly++) for (let lx = 0; lx <= 3; lx++) P(lx, ly, lid);
      for (let lx = 0; lx <= 3; lx++) P(lx, 2, INK);
      break;
    case 'squint':
      // An ink > pointing back.
      for (let ly = 0; ly <= 3; ly++) for (let lx = 0; lx <= 3; lx++) P(lx, ly, skin);
      P(2, 0, INK);
      P(1, 1, INK);
      P(0, 2, INK);
      P(1, 2, INK);
      P(2, 3, INK);
      break;
    default:
      break;
  }
}

/**
 * The 2× lens eye: the 1× eye's 4 × 4 box as 8 × 8 2× pixels (the wide eye and the Mute's rim
 * reach 2 px further out), hand-drawn per expression. Keys: G / g gold ring lit / dark, Y gold
 * glint, W lens, k ink, L / l steel lid lit / dark, s skin (the dome tone), '.' = leave.
 * Columns run from the back of the head to the beak; mirrored when the head faces back.
 */
const EYE_HI: Readonly<Record<string, readonly string[]>> = {
  // Lens with the pupil (front-low) and a 1-px glint on the ring's lit top.
  normal: ['..YGGG..', '.GGGGGg.', 'GGWWWWgg', 'GGWWWWgg', 'GGWWkkgg', 'GGWWkkgg', '.gggggg.', '..gggg..'],
  'back-low': ['..YGGG..', '.GGGGGg.', 'GGWWWWgg', 'GGWWWWgg', 'GGkkWWgg', 'GGkkWWgg', '.gggggg.', '..gggg..'],
  'back-high': ['..YGGG..', '.GGGGGg.', 'GGkkWWgg', 'GGkkWWgg', 'GGWWWWgg', 'GGWWWWgg', '.gggggg.', '..gggg..'],
  'front-high': ['..YGGG..', '.GGGGGg.', 'GGWWkkgg', 'GGWWkkgg', 'GGWWWWgg', 'GGWWWWgg', '.gggggg.', '..gggg..'],
  // The lid slants down toward the beak; its ink edge runs into the pupil: a glare.
  angry: ['..LLLL..', '.LLLLLL.', 'GkkLLLLl', 'GWWkkLLl', 'GWWWWkkk', 'GWWWkkkg', '.gggggg.', '..gggg..'],
  half: ['..LLLL..', '.LLLLLL.', 'GLLLLLLl', 'GkkkkkkG', 'GWWWkkWg', 'GWWWkkWg', '.gggggg.', '..gggg..'],
  blink: ['..LLLL..', '.LLLLLL.', 'GLLLLLLl', 'GLLLLLLl', 'GllllllL', 'Gkkkkkkg', '.gggggg.', '..gggg..'],
  // An ink chevron pointing back, over skin.
  squint: ['sssskkss', 'ssskksss', 'sskkssss', 'skksssss', 'skksssss', 'sskkssss', 'ssskksss', 'sssskkss'],
  // An ink arch.
  happy: ['........', '........', '..kkkk..', '.kk..kk.', 'kk....kk', 'k......k', '........', '........'],
  // A 1-px ink spiral over skin.
  dizzy: ['kkkkkkkk', 'sssssssk', 'skkkkksk', 'sksssksk', 'sksksksk', 'skskkksk', 'skssssss', 'skkkkkkk'],
};

/** The wide eye: 12 × 12 2× px from 2 px before the box (lens 5 × 5 logical, pupil centred). */
const EYE_WIDE_HI = [
  '............',
  '....YGGG....',
  '..GGGGGGgg..',
  '..GGWWWWgg..',
  '.GWWWWWWWWg.',
  '.GWWWkkWWWg.',
  '.GWWWkkWWWg.',
  '.GWWWWWWWWg.',
  '..ggWWWWgg..',
  '..gggggggg..',
  '....gggg....',
  '............',
];

/** The Mute's steel rim round the lens (12 × 12 from 2 px before the box). */
const EYE_RIM_HI = [
  '...RRRRRR...',
  '..RRRRRRRR..',
  '.RR......Rr.',
  'RR........rr',
  'RR........rr',
  'RR........rr',
  'RR........rr',
  'RR........rr',
  'RR........rr',
  '.Rr......rr.',
  '..rrrrrrrr..',
  '...rrrrrr...',
];

function drawEyeHi(st: Stack, e: V, f: number, eye: SwanEye, colour: SwanColour): void {
  const skin = colour === 'mute' ? PAL.black[2] : PAL.snow[2];
  const key: Readonly<Record<string, Color>> = {
    G: PAL.gold[2],
    g: PAL.gold[1],
    Y: PAL.gold[3],
    W: PAL.snow[3],
    k: INK,
    L: PAL.steel[3],
    l: PAL.steel[2],
    s: skin,
    R: PAL.steel[3],
    r: PAL.steel[2],
  };
  // 2× pixel (i, j) of a w-wide pattern starting `o` 2× px before the box (logical e − 2).
  const put = (rows: readonly string[], o: number): void => {
    const w = rows[0].length;
    rows.forEach((row, j) => {
      for (let i = 0; i < w; i++) {
        const c = key[row[i]];
        if (c === undefined) continue;
        const col = f > 0 ? i - o : 7 - (i - o);
        st.fine(e[0] - 2 + col / 2, e[1] - 2 + (j - o) / 2, c);
      }
    });
  };
  if (colour === 'mute') put(EYE_RIM_HI, 2);
  if (eye === 'wide') {
    put(EYE_WIDE_HI, 2);
    return;
  }
  const rows = EYE_HI[eye === 'front-low' ? 'normal' : eye] ?? EYE_HI.normal;
  put(rows, 0);
}

// ------------------------------------------------------------------------------------ strips

const neckStacks: Partial<Record<1 | 2, Stack>> = {};
/** Where the socket sits while a neck strip is drawn (room for necks up and down). */
const SOCKET_Y = -44;

/**
 * One neck frame (look.md §8.2): anchored at the socket, points `muzzle` and `cannon` (the beak
 * tip) and `head` (the head centre), all relative to the socket. `density` 2: the 2× twin, in
 * the 2× rectangle of the 1× frame with its points.
 */
export function renderNeckFrame(spec: NeckSpec, colour: SwanColour, density: 1 | 2 = 1): Frame {
  const lo = withKitDensity(1, () => neckFrameAt(spec, colour));
  if (density === 1) return lo;
  return withKitDensity(2, () => {
    const st = (neckStacks[2] ??= new Stack());
    st.reset();
    drawNeck(st, [0, SOCKET_Y], spec, colour);
    const h = harvest(st);
    st.reset();
    const p = placeHi(h.buf, h.ox, h.oy, lo.buf.w, lo.buf.h, lo.ox, lo.oy - SOCKET_Y, true);
    neckCut.px += p.cut;
    return { buf: p.buf, ox: lo.ox, oy: lo.oy, pts: lo.pts, density: 2 };
  });
}

/** Pixels of 2× neck art cut off at the edge of the 1× frame rectangle (tests, tools). */
export const neckCut = { px: 0 };

function neckFrameAt(spec: NeckSpec, colour: SwanColour): Frame {
  const st = (neckStacks[kitDensity()] ??= new Stack());
  st.reset();
  const o = drawNeck(st, [0, SOCKET_Y], spec, colour);
  const h = harvest(st);
  st.reset();
  const muzzle: [number, number] = [o.muzzle[0], o.muzzle[1] - SOCKET_Y];
  return {
    buf: h.buf,
    ox: h.ox,
    oy: h.oy + SOCKET_Y,
    pts: { muzzle, cannon: muzzle, head: [Math.round(o.head[0]) + 0, Math.round(o.head[1] - SOCKET_Y) + 0] },
  };
}

// ------------------------------------------------------------------------------------ HUD head

export interface SwanHeadOpts {
  colour?: SwanColour;
  eye?: SwanEye;
  /** Beak direction in degrees (default 0: facing right). */
  angle?: number;
  /** Beak opening (px). */
  gap?: number;
}

const iconStack = new Stack();

/**
 * Draw SWAN-3's head — ivory dome, lens eye, navy face patch, orange beak (the Mute: black
 * dome and beak, steel eye rim) — into `buf` with the dome centre on (cx, cy). Shaded, without
 * an outline: call `buf.outline(INK)` when the head stands alone (or use `swanHeadIcon`). The
 * head spans about cx − 5 … cx + 12 and cy − 5 … cy + 4 with the beak forward.
 */
export function drawSwanHead(buf: PixelBuffer, cx: number, cy: number, o: SwanHeadOpts = {}): void {
  const st = iconStack;
  st.reset();
  drawHead(st, [0, 0], { p1: [0, 0], p2: [0, 0], p3: [0, 0], angle: o.angle ?? 0, eye: o.eye ?? 'normal', gap: o.gap ?? 0 }, o.colour ?? 'ivory');
  const src = st.buf.data;
  for (let y = st.y0; y <= st.y1; y++) {
    for (let x = st.x0; x <= st.x1; x++) {
      const c = src[y * st.buf.w + x];
      if ((c & 255) === 0) continue;
      buf.set(cx + x - OX, cy + y - OY, c);
    }
  }
  buf.touch();
  st.reset();
}

/** A stand-alone outlined head (for `ui/icon-life`, `ui/cursor-swan`): buffer + dome centre. */
export function swanHeadIcon(o: SwanHeadOpts = {}): { buf: PixelBuffer; cx: number; cy: number } {
  const buf = new PixelBuffer(32, 24);
  drawSwanHead(buf, 12, 12, o);
  const b = buf.trimBounds();
  if (!b) return { buf, cx: 12, cy: 12 };
  const out = buf.crop(b.x - 1, b.y - 1, b.w + 2, b.h + 2).outline(INK);
  return { buf: out, cx: 12 - b.x + 1, cy: 12 - b.y + 1 };
}

