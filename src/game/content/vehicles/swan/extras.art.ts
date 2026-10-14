/**
 * SWAN-3 art rig, part 5: the small extras (docs/design/swan-mount/look.md §10.10, §12.3, §16
 * item 5).
 *
 * - `scuffFrames()`: the damage decal `vehicle/swan/scuffs` (anchor = the `hull` point): frame 0
 *   (≤ 2 cells) 3 dents and 2 bullet holes, frame 1 (≤ 1 cell) 6 dents, 4 holes, 2 scorch
 *   smudges and a lifted panel corner on the rump. Hand-placed on the rest hull, clear of the
 *   seat zone that the front overlay covers, so every mark lands on ivory plating.
 * - `eggFrames()`: the nervous egg (`vehicle/swan/egg`, 8 × 10, feet anchor): an ivory steel
 *   capsule with a gold rivet band and a tiny navy "3"; lands, wobbles, cracks, pops its lid.
 * - `tinFeatherFrames()`: `fx/tin-feather`, a stiff stamped ivory plate (5 × 2, navy tip, steel
 *   edge glint, gold rivet dot at the quill) in 4 rigid turning frames (centre anchor).
 * - `beakFlashFrames()`: `fx/muzzle-swan-beak-gun`, a round 5 × 5 flash in 2 frames with no
 *   direction, so it fits all 9 neck angles (centre anchor, drawn with additive blending).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { bayer } from '../../../art/paint';
import type { Pt } from './kit.art';
import { OWN, Stack, dot, fine, harvest, kitDensity, placeHi, poly, rot, shade, take, withHiCover, withKitDensity } from './kit.art';

// ------------------------------------------------------------------------------------ scuffs

/**
 * Rest-space hull mark positions (look.md §12.3). The near wing and the seat rim live in the
 * `-front` overlay and the neck is drawn last, so every mark sits on plating that both leave
 * visible: the rump behind the seat (x −33..−16, y −50..−45) and the band under the wing
 * (y −36..−35). The breast is under the neck at most aims; the lower belly is under the water
 * line when she swims. The first 3 dents and 2 holes are frame 0 (≤ 2 cells); frame 1 (≤ 1 cell)
 * shows all of them.
 */
const DENTS: readonly Pt[] = [[-13, -36], [-29, -50], [4, -36], [-9, -36], [13, -37], [-26, -47]];
const HOLES: readonly Pt[] = [[-5, -36], [-22, -48], [0, -36], [-16, -49]];
const SCORCH: readonly Pt[] = [[-19, -46], [8, -36]];
/** The lifted panel corner on the rump (frame 1). */
const PANEL: Pt = [-32, -47];

/** The hull point (tilt pivot and the decal's anchor). */
const HULL: Pt = [-3, -38];

/**
 * Damage decals, anchored on the `hull` point. Light comes from the upper left, so a dent (a
 * 3 px crease, concave) is dark on its upper wall and lit on its lower lip; a bullet hole is a
 * 2 × 2 ink pit with a dark burr on its lower right and a lit burr on its upper left; a scorch
 * is an ordered smudge of soot; the lifted panel corner is a bent-up lit edge over its shadow.
 */
export function scuffFrames(): Frame[] {
  return [0, 1].map((level) => {
    const nDent = level === 0 ? 3 : 6;
    const nHole = level === 0 ? 2 : 4;
    const w = 60;
    const h = 24;
    // Buffer pixel (bx, by) = rest (bx − ax + HULL.x, by − ay + HULL.y).
    const ax = 32;
    const ay = 15;
    const b = new PixelBuffer(w, h);
    const put = (p: Pt, dx: number, dy: number, c: Color): void => {
      b.set(Math.round(p[0] - HULL[0]) + ax + dx, Math.round(p[1] - HULL[1]) + ay + dy, c);
    };
    if (level === 1) {
      // Soot first: dents and holes stay crisp on top of it.
      for (const p of SCORCH) {
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -3; xx <= 3; xx++) {
            if (Math.abs(xx) + Math.abs(yy) * 2 > 3) continue;
            const v = bayer(Math.round(p[0]) + xx + 8, Math.round(p[1]) + yy + 8);
            if (v < 0.75) put(p, xx, yy, v < 0.35 ? PAL.ink[1] : PAL.steel[1]);
          }
        }
      }
    }
    for (let i = 0; i < nDent; i++) {
      const p = DENTS[i];
      put(p, -1, 0, PAL.steel[2]);
      put(p, 0, 0, PAL.steel[1]);
      put(p, 1, 0, PAL.steel[2]);
      put(p, 0, 1, PAL.snow[3]);
      put(p, 1, 1, PAL.snow[3]);
    }
    for (let i = 0; i < nHole; i++) {
      const p = HOLES[i];
      put(p, 0, 0, INK);
      put(p, 1, 0, INK);
      put(p, 0, 1, INK);
      put(p, 1, 1, PAL.steel[1]);
      put(p, -1, -1, PAL.snow[3]);
      put(p, 0, -1, PAL.snow[3]);
      put(p, 2, 1, PAL.steel[3]);
      put(p, 1, 2, PAL.steel[3]);
    }
    if (level === 1) {
      // The lifted panel corner: a lit bent-up edge, the dark gap it opens under it.
      const c = PANEL;
      put(c, 0, -1, PAL.snow[3]);
      put(c, 1, -1, PAL.snow[3]);
      put(c, 2, -1, PAL.snow[2]);
      put(c, 0, 0, PAL.snow[2]);
      put(c, 1, 0, INK);
      put(c, 2, 0, INK);
      put(c, 3, 0, PAL.steel[2]);
      put(c, 0, 1, INK);
      put(c, 1, 1, PAL.steel[2]);
    }
    b.touch();
    return { buf: b, ox: ax, oy: ay };
  });
}

// ------------------------------------------------------------------------------------ egg

const eggStacks: Partial<Record<1 | 2, Stack>> = {};

/** Outline of the 8 × 10 capsule (feet anchor: its base sits on y −1). */
function eggOutline(n: number): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    // A little fuller at the bottom, like an egg.
    const rx = Math.sin(a) > 0 ? 3.7 : 3.4;
    pts.push([Math.cos(a) * rx - 0.5, -6.2 + Math.sin(a) * 4.6]);
  }
  return pts;
}

/**
 * The nervous egg (look.md §10.10): 8 × 10 ivory capsule, gold rivet band round its middle, a
 * tiny navy "3". f0 lands · f1 wobbles (10°) · f2 cracks (ink zigzag on the band) · f3 the top
 * half pops up 3 px like a lid, with a wisp of steam. Feet anchor (stands on its base).
 */
export function eggFrames(density: 1 | 2 = 1): Frame[] {
  if (density === 2) return hiTwins(withKitDensity(1, () => eggFrames(1)), () => withKitDensity(2, () => eggFrames(1)));
  const st = (eggStacks[kitDensity()] ??= new Stack());
  const out: Frame[] = [];
  const shape = eggOutline(28);
  for (let f = 0; f < 4; f++) {
    st.reset();
    // The wobble turns the egg about its base: vertices turn, never pixels.
    const tilt = f === 1 ? 10 : 0;
    const T = (q: Pt): [number, number] => {
      const r = rot(q, tilt);
      return [r[0], r[1]];
    };
    const lid = f === 3 ? -3 : 0;
    const L = take();
    // f3: only the lower half stays on the ground; the lid is drawn on its own.
    poly(L, (f === 3 ? shape.filter((q) => q[1] >= -5.6) : shape).map(T), PAL.snow[2]);
    shade(L, PAL.snow, { glint: f !== 3 });
    st.put(L, OWN.hull, PAL.snow[0]);
    if (f === 3) {
      const Lid = take();
      poly(Lid, shape.filter((q) => q[1] <= -5.4).map((q) => T([q[0], q[1] + lid])), PAL.snow[2]);
      shade(Lid, PAL.snow, { glint: true });
      st.put(Lid, OWN.head, PAL.snow[0]);
    }
    // The gold rivet band round the middle (it rides up with the lid).
    if (st.d === 2) {
      // 2×: the 1× band (one logical px high), each rivet with a lit 2× pixel and a dark one.
      for (let x = -3; x <= 2; x++) {
        // The open lid's 2× rim ends half a pixel higher than the 1× one: the band follows it.
        const q = T([x, -6 + lid - (f === 3 ? 1 : 0)]);
        st.detail(q[0], q[1], (x & 1) === 0 ? PAL.gold[2] : PAL.gold[1]);
        if ((x & 1) === 0) {
          st.fine(Math.round(q[0]), Math.round(q[1]), PAL.gold[3]);
          st.fine(Math.round(q[0]) + 0.5, Math.round(q[1]) + 0.5, PAL.gold[0]);
        }
      }
    } else {
      for (let x = -3; x <= 2; x++) {
        const q = T([x, -6 + lid]);
        st.detail(q[0], q[1], (x & 1) === 0 ? PAL.gold[3] : PAL.gold[1]);
      }
    }
    if (f === 2) {
      // The crack: an ink zigzag along the band.
      if (st.d === 2) {
        // 2×: a thin 1-px zigzag with a branch.
        const zig: ReadonlyArray<readonly [number, number]> = [[-3.5, -5], [-3, -4.5], [-2.5, -4], [-2, -4.5], [-1.5, -5], [-1, -5.5], [-0.5, -5], [0, -4.5], [0.5, -4], [1, -4.5], [1.5, -5], [2, -4.5], [2.5, -4], [0.5, -3.5], [1, -3]];
        for (const [x, y] of zig) st.fine(x, y, INK);
      } else for (let x = -3; x <= 2; x++) st.detail(x, (x & 1) === 0 ? -5 : -4, INK);
    }
    if (f < 3) {
      // A tiny navy "3" under the band (2 × 3).
      for (const [x, y] of [[-1, -4], [0, -4], [0, -3], [-1, -2], [0, -2]] as const) {
        const q = T([x, y]);
        st.detail(q[0], q[1], PAL.navy[1]);
      }
    } else {
      // A wisp of steam rising out of the open egg.
      const S = take();
      if (S.d === 2) {
        // 2×: a thinner curl of steam.
        for (const [x, y, c] of [[-1, -8.5, PAL.snow[3]], [-1, -9, PAL.snow[3]], [-0.5, -9.5, PAL.snow[3]], [0, -10, PAL.snow[3]], [0, -10.5, PAL.snow[2]], [0, -11, PAL.snow[2]], [0.5, -11.5, PAL.snow[3]], [1, -12, PAL.snow[3]], [1.5, -12, PAL.snow[2]]] as const) fine(S, x, y, c);
      } else {
        dot(S, -1, -9, PAL.snow[3]);
        dot(S, 0, -10, PAL.snow[3]);
        dot(S, 0, -11, PAL.snow[2]);
        dot(S, 1, -12, PAL.snow[3]);
      }
      st.put(S, OWN.fx, PAL.snow[1], false);
    }
    const h = harvest(st);
    out.push({ buf: h.buf, ox: h.ox, oy: h.oy });
  }
  st.reset();
  return out;
}

// ------------------------------------------------------------------------------------ fx

const featherStacks: Partial<Record<1 | 2, Stack>> = {};

/**
 * `fx/tin-feather`: a stiff stamped ivory plate 5 × 2 with a navy tip, a 1 px steel edge glint
 * and a gold rivet dot at the quill. Four rigid turning frames: the plate's vertices turn
 * (0°, 50°, 95° nearly edge-on, 140°); it never curls like down.
 */
export function tinFeatherFrames(density: 1 | 2 = 1): Frame[] {
  if (density === 2) return hiTwins(withKitDensity(1, () => tinFeatherFrames(1)), () => withKitDensity(2, () => tinFeatherFrames(1)));
  const st = (featherStacks[kitDensity()] ??= new Stack());
  const angles = [0, 50, 95, 140];
  return angles.map((deg) => {
    st.reset();
    const k = (x: number, y: number): [number, number] => {
      const q = rot([x, y], deg);
      return [q[0], q[1]];
    };
    // Turning through edge-on: the plate's depth shrinks with |cos| of the tumble.
    const depth = Math.max(0.5, Math.abs(Math.cos(((deg - 10) * Math.PI) / 180)) * 1.6);
    const L = take();
    if (L.d === 2) {
      // 2×: the 1× plate's full area (its edge pixels included) with a slanted tip that ends in
      // the 1-px nib, drawn with tight coverage so the corners stay square and the tip sharp.
      // Half height: flat or upright, the 1× rows the plate touches (3 flat, 1 edge-on); on a
      // diagonal the 1× staircase reads thinner, so the plate keeps about its true depth.
      const diag = Math.abs(Math.sin((deg * Math.PI) / 90)) > 0.5;
      const e = diag ? depth / 2 + 0.3 : Math.floor(depth / 2 + 0.5) + 0.3;
      withHiCover(0, 0, () => poly(L, [k(-3.3, -e), k(2.3, -e), k(3.3, -0.3), k(3.3, 0.3), k(1.8, e), k(-3.3, e)], PAL.snow[2]));
    } else poly(L, [k(-2.6, -depth / 2), k(2.4, -depth / 2), k(2.8, 0), k(2.4, depth / 2), k(-2.6, depth / 2)], PAL.snow[2]);
    shade(L, PAL.snow, {});
    // The navy tip (the last px toward +x) and the quill's gold rivet dot.
    const a = k(2.2, 0);
    const q = k(-2.2, 0);
    st.put(L, OWN.hull, PAL.snow[0]);
    if (st.d === 2) {
      // 2×: the navy tip, a 1-px steel glint along the edge, the gold quill dot (its 1× pixel, dark
      // on the lower right).
      st.detail(a[0], a[1], PAL.navy[1]);
      // The stamped shaft: a 1-px line down the middle from the quill to the tip.
      for (let t = -1.5; t <= 1.5; t += 0.5) {
        const p = k(t, 0);
        st.fine(p[0] + 0.25, p[1] + 0.25, PAL.snow[1]);
      }
      for (const t of [-1.2, -0.6, 0, 0.6, 1.2]) {
        const p = k(t, -depth / 2);
        st.fine(p[0] + 0.25, p[1] + 0.25, PAL.steel[4]);
      }
      st.detail(q[0], q[1], PAL.gold[3]);
      st.fine(Math.round(q[0]) + 0.5, Math.round(q[1]) + 0.5, PAL.gold[1]);
    } else {
      st.detail(a[0], a[1], PAL.navy[1]);
      const g = k(0, -depth / 2);
      st.detail(g[0], g[1], PAL.steel[3]);
      st.detail(q[0], q[1], PAL.gold[3]);
    }
    const h = harvest(st);
    // Centre anchor on the plate's middle (body 0, 0).
    return { buf: h.buf, ox: h.ox, oy: h.oy };
  });
}

/**
 * `fx/muzzle-swan-beak-gun`: a round flash with no direction (look.md §16 item 5). f0: a 5 × 5
 * disc, white-hot core, gold body, orange rim; f1: a 3 × 3 ember. Centre anchor; drawn additive,
 * so no outline.
 */
export function beakFlashFrames(density: 1 | 2 = 1): Frame[] {
  if (density === 2) return beakFlashFramesHi();
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const b = new PixelBuffer(7, 7);
    if (f === 0) {
      b.circle(3, 3, 2, PAL.orange[3]);
      b.rect(2, 2, 3, 3, PAL.gold[3]);
      b.set(3, 1, PAL.gold[3]);
      b.set(1, 3, PAL.gold[3]);
      b.set(5, 3, PAL.gold[2]);
      b.set(3, 5, PAL.gold[2]);
      b.set(3, 3, PAL.fire[6]);
      b.set(2, 3, PAL.fire[6]);
      b.set(3, 2, PAL.fire[6]);
    } else {
      b.circle(3, 3, 1, PAL.orange[3]);
      b.set(3, 3, PAL.gold[3]);
    }
    out.push({ buf: b, ox: 3, oy: 3 });
  }
  return out;
}

/**
 * The 2× round flash (14 × 14, the 1× 7 × 7 box): f0 a round 5-px disc with a 1-px orange rim,
 * gold body, four short gold rays and a white-hot core; f1 a 3-px ember with a gold heart.
 */
function beakFlashFramesHi(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const b = new PixelBuffer(14, 14);
    if (f === 0) {
      b.ellipse(2, 2, 10, 10, PAL.orange[3]);
      b.ellipse(3, 3, 8, 8, PAL.gold[2]);
      b.ellipse(4, 4, 6, 6, PAL.gold[3]);
      b.ellipse(5, 5, 4, 4, PAL.fire[6]);
      // Short rays (top, left: lit; right, bottom: gold).
      for (const [x, y] of [[6, 1], [7, 1], [1, 6], [1, 7]] as const) b.set(x, y, PAL.gold[3]);
      for (const [x, y] of [[12, 6], [12, 7], [6, 12], [7, 12]] as const) b.set(x, y, PAL.gold[2]);
    } else {
      b.ellipse(4, 4, 6, 6, PAL.orange[3]);
      b.ellipse(5, 5, 4, 4, PAL.gold[2]);
      b.set(6, 6, PAL.gold[3]);
    }
    out.push({ buf: b, ox: 3, oy: 3, density: 2 });
  }
  return out;
}

/**
 * The 2× twins of stack-drawn 1× frames whose body origin is their anchor: `hi` draws the same
 * frames at 2× (the kit's density); each is placed in the 2× rectangle of its 1× frame.
 */
function hiTwins(lo: Frame[], hi: () => Frame[]): Frame[] {
  return hi().map((f, i) => {
    const b = lo[i];
    const p = placeHi(f.buf, f.ox, f.oy, b.buf.w, b.buf.h, b.ox, b.oy, true);
    return { buf: p.buf, ox: b.ox, oy: b.oy, density: 2 };
  });
}

/**
 * The 2× damage decal: every 1× mark keeps its full footprint (each 1× pixel a 2 × 2 block in
 * the 1× colour), so the damage reads at game scale as strongly as at 1×; the 2× grid adds the
 * fine detail inside it: a dent's darkest 1-px crease line, a hole's round dark pit with a lit
 * far wall and a torn petal, soot grain in the scorch, a 1-px bend line on the lifted panel.
 */
export function scuffFramesHi(): Frame[] {
  const lo = scuffFrames();
  return [0, 1].map((level) => {
    const nDent = level === 0 ? 3 : 6;
    const nHole = level === 0 ? 2 : 4;
    const src = lo[level];
    const ax = src.ox;
    const ay = src.oy;
    const b = new PixelBuffer(src.buf.w * 2, src.buf.h * 2);
    // The 1× footprint: each 1× pixel as its 2 × 2 block.
    for (let y = 0; y < src.buf.h; y++) {
      for (let x = 0; x < src.buf.w; x++) {
        const c = src.buf.data[y * src.buf.w + x];
        if ((c & 255) !== 0) b.rect(x * 2, y * 2, 2, 2, c);
      }
    }
    // 2× pixel (dx, dy) (half steps) from the logical mark position p.
    const put = (p: Pt, dx: number, dy: number, c: Color): void => {
      b.set((Math.round(p[0] - HULL[0]) + ax) * 2 + Math.round(dx * 2), (Math.round(p[1] - HULL[1]) + ay) * 2 + Math.round(dy * 2), c);
    };
    if (level === 1) {
      // Soot grain: the scorch's dark pixels get a lighter speck, its grey pixels a dark one.
      for (const p of SCORCH) {
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -3; xx <= 3; xx++) {
            if (Math.abs(xx) + Math.abs(yy) * 2 > 3) continue;
            const v = bayer(Math.round(p[0]) + xx + 8, Math.round(p[1]) + yy + 8);
            if (v >= 0.75) continue;
            const odd = ((xx + yy) & 1) === 0;
            put(p, xx + (odd ? 0.5 : 0), yy + 0.5, v < 0.35 ? PAL.steel[1] : PAL.ink[1]);
          }
        }
      }
    }
    for (let i = 0; i < nDent; i++) {
      const p = DENTS[i];
      // The crease's darkest line along the bottom of the dark wall, a lit glint on the lip.
      for (const [x, y, c] of [
        [-0.5, 0.5, PAL.steel[1]], [0, 0.5, PAL.ink[1]], [0.5, 0.5, PAL.ink[1]], [1, 0.5, PAL.steel[1]],
        [0, 0, PAL.steel[2]], [-1, 0, PAL.steel[3]],
        [0.5, 1, PAL.snow[3]], [1.5, 1.5, PAL.snow[2]],
      ] as const) put(p, x, y, c);
    }
    for (let i = 0; i < nHole; i++) {
      const p = HOLES[i];
      // A round pit: ink core, the lit far wall inside its lower right, a torn petal of plate
      // bent out on the lower right, and the lit burr on the upper left.
      for (const [x, y, c] of [
        [0, 0, PAL.steel[1]], [1.5, 0.5, PAL.steel[1]],
        [1, 1, PAL.steel[2]], [0.5, 1, INK], [1, 0.5, INK],
        [2, 1, PAL.steel[4]], [2.5, 1.5, PAL.steel[2]], [1, 2, PAL.steel[4]], [1.5, 2.5, PAL.steel[2]],
        [-1, -1, PAL.snow[3]], [-0.5, -0.5, PAL.snow[2]],
      ] as const) put(p, x, y, c);
    }
    if (level === 1) {
      // The lifted panel: a 1-px bend line where the plate leaves the hull, a lit glint on its edge.
      const c = PANEL;
      for (const [x, y, col] of [
        [0, -0.5, PAL.snow[1]], [0.5, -0.5, PAL.snow[1]], [1, -0.5, PAL.snow[1]], [1.5, -0.5, PAL.snow[0]], [2, -0.5, PAL.snow[0]],
        [0, -1, PAL.snow[3]], [2.5, -1, PAL.snow[3]],
        [1, 0.5, PAL.steel[1]], [3.5, 0.5, PAL.steel[1]],
      ] as const) put(c, x, y, col);
    }
    b.touch();
    return { buf: b, ox: ax, oy: ay, density: 2 };
  });
}
