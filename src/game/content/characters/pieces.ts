/**
 * Small hand-drawn props the heroes use in their fidgets, victories and deaths (GDD §3.1–§3.4),
 * stacked onto rig frames with `withPieces` (docs/ART_GUIDE.md "Props and instruments"). Every
 * piece is a tiny ascii drawing with its own 1-px INK outline (withPieces does not outline),
 * built once and cached. Letters per piece are listed in its key.
 *
 * UHD art (docs/ART_GUIDE.md "UHD art"): every piece also has an `hd` drawer — ONE density-generic
 * drawer on the HD kit (`HdCanvas`, logical px, PAL_HD ramps, lit volumes, outline A) that makes
 * its 2× and its 4× art. `pieceHd(lo, d)` returns that art for a cached 1× piece buffer: exactly
 * d times the 1× buffer's size, the same logical layout (the drawing sits in the same 1-logical-px
 * border, so `at` / `onGround` place it the same way). `decorateFrames` (the hero files' hook)
 * draws the HD art on every 2× and 4× frame. The old `hiRows` 2× twins stay registered with
 * `setHiTwin` (direct `withPieces` callers) until the rig's HD body path retires them.
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { frameW, type Frame } from '../../../engine/render';
import { HdCanvas, folds, type HdDensity, type Texture } from '../../art/hd';
import { setHiTwin, withPieces, type Piece } from '../../art/human-fx';
import { outlineHi } from '../../art/hi';
import { hash2 } from '../../art/paint';

/** Draws a piece's HD art on a canvas of the 1× buffer's logical size (the 1-px border included). */
export type PieceHdDraw = (c: HdCanvas, d: HdDensity) => void;

interface PieceOpts {
  /** Own INK outline (default true): outline A at HD. */
  outline?: boolean;
  /** Hand-drawn 2× twin rows (retired once the rig's HD path uses `pieceHd`). */
  hiRows?: readonly string[];
  hiKey?: Readonly<Record<string, Color>>;
  /** The UHD drawer (2× and 4×). */
  hd?: PieceHdDraw;
}

interface HdEntry {
  name: string;
  outline: boolean;
  draw: PieceHdDraw;
}

const cache = new Map<string, PixelBuffer>();
const HD_OF = new WeakMap<PixelBuffer, HdEntry>();
const hdCache = new Map<string, PixelBuffer>();

/**
 * Build (once) an outlined piece from ascii rows. `hiRows` (mission ams, docs/ART_GUIDE.md "2x
 * art (mission ams)"): a hand-drawn 2× twin, exactly twice the 1× rows, with the same key plus
 * any extra letters in `hiKey`; it gets the 2-px outline and is registered with `setHiTwin`, so
 * `withPieces` draws it on 2× frames. `hd`: the UHD drawer (see `pieceHd`).
 */
function piece(name: string, rows: readonly string[], key: Readonly<Record<string, Color>>, o: PieceOpts = {}): PixelBuffer {
  let b = cache.get(name);
  if (!b) {
    const outline = o.outline ?? true;
    const raw = ascii(rows as string[], key);
    // One px of room on every side for the outline.
    b = new PixelBuffer(raw.w + 2, raw.h + 2);
    b.blit(raw, 1, 1);
    if (outline) b.outline(INK);
    cache.set(name, b);
    const hiRows = o.hiRows;
    if (hiRows) {
      if (hiRows.length !== raw.h * 2 || hiRows.some((r) => r.length !== raw.w * 2)) {
        throw new Error(`2× piece ${name}: ${hiRows[0]?.length ?? 0}×${hiRows.length}, expected ${raw.w * 2}×${raw.h * 2}`);
      }
      const rawHi = ascii(hiRows as string[], { ...key, ...(o.hiKey ?? {}) });
      const hb = new PixelBuffer(b.w * 2, b.h * 2);
      hb.blit(rawHi, 2, 2);
      if (outline) outlineHi(hb, 2);
      setHiTwin(b, hb);
    }
    if (o.hd) HD_OF.set(b, { name, outline, draw: o.hd });
  }
  return b;
}

/**
 * The UHD art of a 1× piece buffer (one returned by this module) at density d: (w·d) × (h·d),
 * the same logical layout; built once per (piece, d) and cached. Undefined for a buffer that is
 * not a piece with an HD drawer.
 */
export function pieceHd(lo: PixelBuffer, d: HdDensity): PixelBuffer | undefined {
  const e = HD_OF.get(lo);
  if (!e) return undefined;
  const k = `${e.name}@${d}`;
  let b = hdCache.get(k);
  if (!b) {
    const c = new HdCanvas(lo.w, lo.h, d);
    e.draw(c, d);
    b = c.render({ outline: e.outline ? 'A' : 'none', ao: 0.25, rimLight: e.outline ? 2 : 0 });
    if (b.w !== lo.w * d || b.h !== lo.h * d) throw new Error(`HD piece ${e.name}@${d}x: ${b.w}×${b.h}`);
    hdCache.set(k, b);
  }
  return b;
}

/** Every piece (name, 1× buffer) — for tests and tools. */
export function allPieces(): Array<[string, PixelBuffer]> {
  const list: PixelBuffer[] = [
    pocketWatch(),
    yarnBall(),
    knitting(),
    knittedSwan(),
    bobbleHat(),
    helmet(),
    bubble(0),
    bubble(1),
    bubble(2),
    gumSplat(),
    screwdriver(),
    dentures(false),
    dentures(true),
    scarfEnd(),
    rag(),
    sparkle(true),
    sparkle(false),
    dustPuff(0),
    dustPuff(1),
    heliumPuff(),
    planSheet(),
    boardingPass(),
    pocketDevice(),
    deviceGlow(),
  ];
  return list.map((b) => [HD_OF.get(b)?.name ?? '?', b]);
}

// ------------------------------------------------------------------------------- HD helpers

/** Fixed-colour stroke from (x0, y0) to (x1, y1), w logical px wide (at least about 1 art px). */
function seg(c: HdCanvas, d: number, x0: number, y0: number, x1: number, y1: number, w: number, col: Color): void {
  const r = Math.max(w / 2, 0.62 / d);
  const vx = x1 - x0;
  const vy = y1 - y0;
  const ll = vx * vx + vy * vy || 1;
  c.paint(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.abs(vx) + 2 * r, Math.abs(vy) + 2 * r, (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / ll));
    return Math.hypot(x - x0 - vx * t, y - y0 - vy * t) <= r ? col : 0;
  });
}

/**
 * A union of spheroids (puffs, gum, cotton): (cx, cy, r) each, or (cx, cy, rx, ry) for a lobe
 * squashed or stretched vertically; one lit height field. `smooth` blends them into one soft
 * mass (summed caps) instead of separate lumps; `relief` scales the height (below 1: a flatter
 * mass, fewer bands).
 */
function puffs(
  c: HdCanvas,
  balls: ReadonlyArray<readonly [number, number, number, number?]>,
  o: { mat: number; z?: number; tex?: Texture; smooth?: boolean; relief?: number },
): void {
  const k = o.relief ?? 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y, r, ry = r] of balls) {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - ry);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + ry);
  }
  c.heightField(x0, y0, x1 - x0, y1 - y0, (x, y) => {
    let h = NaN;
    let sum = 0;
    for (const [bx, by, r, ry = r] of balls) {
      const dy = ((y - by) * r) / ry;
      const q = r * r - (x - bx) * (x - bx) - dy * dy;
      if (q > 0) {
        sum += q;
        const v = Math.sqrt(q);
        if (!(h >= v)) h = v;
      }
    }
    return (o.smooth && sum > 0 ? Math.sqrt(sum) * 0.8 : h) * k;
  }, { mat: o.mat, z: o.z ?? 0, tex: o.tex });
}

/** Knit stitches: little V columns (cream wool, scarves, hats). */
function knit(seed: number, pitch = 1): Texture {
  return (s) => {
    const u = s.x / pitch;
    const v = s.y / pitch;
    const fu = u - Math.floor(u);
    const fv = (v + Math.abs(fu - 0.5)) % 1;
    if (fv < 0.22) s.tone -= 0.16;
    s.nx += (fu - 0.5) * 0.5;
    if (hash2(Math.floor(u), Math.floor(v), seed) > 0.9) s.tone -= 0.06;
  };
}

/** A shiny sphere's glint: a near-white highlight cluster up left of (cx, cy). */
function glint(c: HdCanvas, d: number, cx: number, cy: number, r: number, col: Color = PAL_HD.snow[6]): void {
  const gx = cx - r * 0.42;
  const gy = cy - r * 0.42;
  const gr = Math.max(0.6 / d, r * 0.16);
  c.paint(gx - gr, gy - gr, gr * 2, gr * 2, (x, y) => (Math.hypot(x - gx, y - gy) <= gr ? col : 0));
}

// ------------------------------------------------------------------------------- the pieces

/** Grace's pocket watch: a gold case with a white face and a chain. */
export function pocketWatch(): PixelBuffer {
  return piece('watch', ['.gg.', 'gWwg', 'gwWg', '.gg.'], { g: PAL.gold[2], W: PAL.snow[3], w: PAL.snow[1] }, {
    hd: (c, d) => {
      const gold = c.material({ ramp: PAL_HD.gold, spec: 1, shine: 22, rim: 0.4, lo: 2 });
      const face = c.material({ ramp: PAL_HD.snow, spec: 0.6, shine: 30, lo: 4 });
      // The case (a polished gold ring), the domed face set into it.
      c.ellipsoid(3, 3, 2, 2, { mat: gold, z: 0 });
      c.ellipsoid(3, 3, d >= 4 ? 1.25 : 1, d >= 4 ? 1.25 : 1, { mat: face, z: 2.2, round: 0.3 });
      // The hands at three o'clock (an L reads as a clock at this size; a V reads as a smile):
      // one art px wide, the minute hand up, the shorter hour hand right.
      const hand = d >= 4 ? PAL_HD.ink[1] : PAL_HD.steel[2];
      const e = 1 / d;
      c.paint(3 - e, 2, e, 1, () => hand);
      c.paint(3 - e, 3 - e, d >= 4 ? 0.75 : 0.5 + e, e, () => hand);
      glint(c, d, 3, 3, 1.9);
    },
  });
}

/** A ball of red yarn (Mittens). */
export function yarnBall(): PixelBuffer {
  // 2×: wound strands (1-px dark lines) across a ball lit from the top-left.
  return piece('yarn', ['.rR.', 'rRrR', 'rrRr', '.rr.'], { r: PAL.red[1], R: PAL.red[3] }, {
    hiRows: ['..RRRr..', '.RRrRRr.', 'RRrRRrrd', 'RrRRrrdr', 'rRRrrdrr', 'rrrrdrrd', '.rrdrrd.', '..rrdd..'],
    hiKey: { d: PAL.red[0] },
    hd: (c, d) => {
      const wool = c.material({ ramp: PAL_HD.red, spec: 0.15, shine: 8, rim: 0.4 });
      // Two crossing layers of wound strands: grooves between the strands, the top layer at 35°.
      c.ellipsoid(3, 3, 2, 2, {
        mat: wool,
        z: 0,
        tex: (s) => {
          const a = (s.x * 0.82 + s.y * 0.57) * (d >= 4 ? 2.2 : 1.6);
          const b = (s.x * 0.5 - s.y * 0.87) * (d >= 4 ? 2.2 : 1.6);
          const top = s.u + s.v < 0.1;
          const f = (top ? a : b) % 1;
          if (f < 0.25) s.tone -= 0.2;
          else if (f > 0.75) s.tone += 0.06;
        },
      });
      // The loose end trailing down the right.
      seg(c, d, 4.7, 3.7, 5, 4.9, d >= 4 ? 0.35 : 0, PAL_HD.red[4]);
    },
  });
}

/** A few rows of knitting hanging off the needles (cream with a red stripe). */
export function knitting(): PixelBuffer {
  return piece('knitting', ['ccc', 'rrr', 'ccc'], { c: PAL.snow[2], r: PAL.red[2] }, {
    hd: (c, d) => {
      // Cream wool (the snow ramp's light end), a red stripe; soft and slightly curled at the sides.
      const wool = c.material({ ramp: PAL_HD.snow, spec: 0.05, rim: 0.3, lo: 3 });
      const red = c.material({ ramp: PAL_HD.red, spec: 0.05, rim: 0.3, lo: 2 });
      const st = knit(7, d >= 4 ? 0.5 : 1);
      c.box(1, 1, 3, 3, {
        mat: wool,
        z: 0,
        bevel: 0.5,
        r: 0.3,
        tex: (s) => {
          if (s.y >= 2 && s.y < 3) s.mat = red;
          st(s);
          // The cast-off edge hangs a little lower in the middle (4×).
          if (d >= 4 && s.y > 3.75 + Math.abs(s.x - 2.5) * 0.2) s.cut = true;
        },
      });
    },
  });
}

/** Mittens' freshly knitted tiny swan: cream body, red scarf stripe, orange beak. */
export function knittedSwan(): PixelBuffer {
  return piece('knit-swan', ['...ww.', '...wwo', '....w.', 'wwwww.', 'wrrrw.', '.www..'], { w: PAL.snow[2], r: PAL.red[2], o: PAL.orange[2] }, {
    hd: (c, d) => {
      const wool = c.material({ ramp: PAL_HD.snow, spec: 0.05, rim: 0.3, lo: 3 });
      const red = c.material({ ramp: PAL_HD.red, spec: 0.05, lo: 2 });
      const beak = c.material({ ramp: PAL_HD.orange, spec: 0.3, lo: 2 });
      const st = knit(11, d >= 4 ? 0.5 : 1);
      // Body with a raised tail, the red scarf stripe; the neck; the head; the beak.
      c.blob([[1, 3.8], [5.8, 4], [6, 5.2], [5.3, 6.5], [4.4, 7], [2, 7], [1, 5.8]], 0.7, {
        mat: wool,
        z: 0,
        tex: (s) => {
          if (s.y >= 5 && s.y < 6 && s.x > 1.6 && s.x < 5.4) s.mat = red;
          st(s);
        },
      });
      c.capsule(5.5, 4.3, 5.2, 2.6, 0.55, 0.5, { mat: wool, z: 0.8, tex: st });
      c.ellipsoid(4.9, 2.1, 1.05, 0.95, { mat: wool, z: 1.2, tex: st });
      c.poly([[5.7, 1.8], [7, 2.3], [5.7, 2.8]], { mat: beak, z: 1.5, n: [0.1, -0.4, 0.9] });
      c.dot(5.1, 1.8, PAL_HD.ink[0]);
      if (d >= 4) c.dot(5.35, 1.8, PAL_HD.ink[0]);
    },
  });
}

/** Mittens' bobble hat on its own (it pops off in his death). */
export function bobbleHat(): PixelBuffer {
  return piece('bobble', ['..rR..', '..rr..', '.cCCc.', 'cCCCcc', 'rRrRrr', 'cccccc'], {
    r: PAL.red[1],
    R: PAL.red[3],
    c: PAL.snow[1],
    C: PAL.snow[3],
  }, {
    hd: (c, d) => {
      const wool = c.material({ ramp: PAL_HD.snow, spec: 0.05, rim: 0.3 });
      const red = c.material({ ramp: PAL_HD.red, spec: 0.05, rim: 0.3 });
      // The crown (cream knit, red band), the ribbed brim, the fuzzy pompom.
      c.blob([[2.2, 3], [5.8, 3], [7, 4.3], [7, 6], [1, 6], [1, 4.3]], 1.1, {
        mat: wool,
        z: 0,
        tex: (s) => {
          if (s.y >= 5 && s.y < 6) s.mat = red;
          knit(13, 0.7)(s);
        },
      });
      c.box(1, 6, 6, 1, {
        mat: wool,
        z: 0.6,
        bevel: 0.4,
        r: 0.3,
        tex: (s) => {
          if (((s.x * (d >= 4 ? 2 : 1)) % 1) < 0.3) s.tone -= 0.18;
        },
      });
      c.ellipsoid(4, 2.1, 1.2, 1.1, {
        mat: red,
        z: 1,
        tex: (s) => {
          if (hash2(s.X, s.Y, 21) > 0.7) s.tone -= 0.15;
          if (s.u * s.u + s.v * s.v > 0.75 && hash2(s.X, s.Y, 22) > 0.6) s.cut = true;
        },
      });
    },
  });
}

/** Pip's steel helmet on its own (it bounces off in his death). */
export function helmet(): PixelBuffer {
  return piece('helmet', ['..sSSs..', '.sSSSSs.', 'ssssssss'], { s: PAL.steel[2], S: PAL.steel[4] }, {
    hd: (c, d) => {
      const steel = c.material({ ramp: PAL_HD.steel, spec: 0.8, shine: 18, rim: 0.4, gain: 1.05, lo: 3 });
      const strap = c.material({ ramp: PAL_HD.brown, spec: 0.15 });
      // Dome (painted steel, a few scuffs), the rolled brim, a strap end hanging under it.
      c.ellipsoid(5, 4.1, 3.6, 3.1, {
        mat: steel,
        z: 0,
        tex: (s) => {
          if (s.y > 3.4) s.cut = true;
          if (hash2(s.X, s.Y, 31) > 0.95) s.tone -= 0.12;
        },
      });
      c.capsule(1.45, 3.5, 8.55, 3.5, 0.5, 0.5, { mat: steel, z: 1, tone: -0.05 });
      if (d >= 4) c.box(6.4, 3.75, 0.5, 0.25, { mat: strap, z: 1.2 });
      for (const rx of [3.2, 6.8]) c.dot(rx, 3.35, PAL_HD.steel[6]);
    },
  });
}

/** Bubble-gum bubbles for Pip's fidget: size 0 (small) … 2 (big). */
export function bubble(size: 0 | 1 | 2): PixelBuffer {
  const key = { p: PAL.pink[1], P: PAL.pink[2], w: PAL.snow[3] };
  // 2×: a round bubble with a 1-px glint at the top-left and a darker rim at the bottom-right.
  const dk = { d: PAL.pink[0] };
  const hd = (cx: number, r: number): PieceHdDraw => (c, d) => {
    const gum = c.material({ ramp: PAL_HD.pink, spec: 1, shine: 40, rim: 0.5, wrap: 0.2 });
    c.ellipsoid(cx, cx, r, r, { mat: gum, z: 0, round: 0.85 });
    glint(c, d, cx, cx, r);
    // A second, smaller window reflection at 4× on the bigger bubbles.
    if (d >= 4 && r > 1.5) c.dot(cx + r * 0.38, cx + r * 0.42, PAL_HD.pink[6]);
  };
  if (size === 0) return piece('bubble0', ['Pp', 'pp'], key, { hiRows: ['.Pp.', 'PwPp', 'Pppp', '.pd.'], hiKey: dk, hd: hd(2, 1.05) });
  if (size === 1) {
    return piece('bubble1', ['.Pp.', 'Pwpp', 'pppp', '.pp.'], key, {
      hiRows: ['..PPpp..', '.PwPPpp.', 'PwPPpppp', 'PPPppppp', 'Pppppppp', 'pppppppd', '.ppppdd.', '..pddd..'],
      hiKey: dk,
      hd: hd(3, 2.05),
    });
  }
  return piece('bubble2', ['..PPp..', '.PwPppp.', 'PwPpppp', 'PPppppp', 'ppppppp', '.ppppp.', '..ppp..'], key, {
    hiRows: [
      '....PPPpp.......',
      '..PPPPPPpppp....',
      '..PwwPPPppppp...',
      '.PwPPPPpppppp...',
      'PwPPPPppppppp...',
      'PPPPPppppppppp..',
      'PPPPpppppppppp..',
      'PPPppppppppppp..',
      'Ppppppppppppp...',
      'pppppppppppppd..',
      '.pppppppppppdd..',
      '.ppppppppppdd...',
      '...ppppppddd....',
      '....pppddd......',
    ],
    hiKey: dk,
    hd: hd(4.5, 3.5),
  });
}

/** The popped bubble: pink gum splattered over a face (no outline: it sits on the face). */
export function gumSplat(): PixelBuffer {
  return piece('splat', ['.p.pp.', 'pPppPp', 'ppPppp', '.pp.p.'], { p: PAL.pink[1], P: PAL.pink[2] }, {
    outline: false,
    hiRows: ['..p...pp....', '.ppp.pPPp...', '.pPpppPpppp.', 'ppPPppppPpp.', 'pppppPpppppp', '.ppPpppppPp.', '..pp..ppp...', '...p...p....'],
    hd: (c, d) => {
      // Gum squashed flat over the face: one low, wet mass with lobes and two drips (a soft sheen,
      // not a bumpy pile), a glint on the biggest lobe.
      const gum = c.material({ ramp: PAL_HD.pink, spec: 0.5, shine: 14, rim: 0.3, lo: 2, wrap: 0.2 });
      puffs(c, [
        [3.9, 2.9, 1.5], [2.5, 2.7, 1.1], [5.5, 2.7, 1.1], [2.6, 1.6, 0.6], [4.6, 1.6, 0.75],
        [1.5, 2.6, 0.6], [6.4, 2.6, 0.6], [2.6, 4.2, 0.55], [5.5, 4.2, 0.5],
      ], { mat: gum, smooth: true, relief: 0.55 });
      glint(c, d, 3.9, 2.9, 1.5, PAL_HD.pink[6]);
    },
  });
}

/** Gramps' screwdriver: steel shaft, red handle. */
export function screwdriver(): PixelBuffer {
  return piece('screwdriver', ['rR33', 'rr2.'], { r: PAL.red[1], R: PAL.red[3], '3': PAL.steel[3], '2': PAL.steel[2] }, {
    hd: (c, d) => {
      const plastic = c.material({ ramp: PAL_HD.red, spec: 0.9, shine: 26, rim: 0.4 });
      const steel = c.material({ ramp: PAL_HD.steel, spec: 1, shine: 30, rim: 0.4 });
      // Fluted handle, the ferrule, the shaft and the flat tip (the shaft dips a little at the tip).
      c.box(1, 1, 2.2, 2, {
        mat: plastic,
        z: 0,
        bevel: 0.7,
        r: 0.6,
        tex: (s) => {
          if (((s.y - 1) * (d >= 4 ? 2.5 : 1.5)) % 1 < 0.28) s.tone -= 0.22;
        },
      });
      c.box(3.05, 1.35, 0.55, 1.3, { mat: steel, z: 0.5, bevel: 0.25, r: 0.15, tone: -0.1 });
      c.cylinder(3.5, 1.55, 1.6, 0.7, { mat: steel, z: 0.3, axis: 'h' });
      c.poly([[3.4, 2.1], [4.1, 2.1], [4.1, 2.9], [3.4, 2.6]], { mat: steel, z: 0.2, n: [0.2, 0.5, 0.85] });
    },
  });
}

/** Gramps' dentures: open (chattering) or shut. */
export function dentures(open: boolean): PixelBuffer {
  const key = { t: PAL.snow[3], g: PAL.pink[2] };
  const hd = (rows: readonly number[]): PieceHdDraw => (c, d) => {
    const gum = c.material({ ramp: PAL_HD.pink, spec: 0.7, shine: 20, rim: 0.3, lo: 2 });
    const e = 1 / d;
    for (const [k, y] of rows.entries()) {
      const up = k === 0;
      // The pink plate along the jaw (lit, glossy), its ends wrapping round the molars.
      c.capsule(1.5, y + 0.5, 4.5, y + 0.5, 0.5, 0.5, { mat: gum, z: 0 });
      // The two front teeth over it, one logical px each like the 1× piece (enamel is painted:
      // tiny lit boxes go grey): lit on the left, rounding into shade on the right, a gap px;
      // the gum line shows above the upper teeth and below the lower ones at 4×; the biting edge
      // catches the light.
      const t0 = up && d >= 4 ? y + 0.25 : y;
      const t1 = !up && d >= 4 ? y + 0.75 : y + 1;
      c.paint(2, t0, 2, t1 - t0, (_x, py, X) => {
        const col = X % d;
        const edge = up ? py > t1 - e : py < t0 + e;
        const root = up ? py < t0 + e : py > t1 - e;
        if (col === d - 1) return root ? PAL_HD.snow[2] : PAL_HD.snow[3];
        if (col === d - 2 && d >= 4) return PAL_HD.snow[4];
        if (edge) return PAL_HD.snow[6];
        return root && d >= 4 ? PAL_HD.snow[4] : PAL_HD.snow[5];
      });
    }
  };
  return open
    ? piece('dentures-open', ['gttg', '....', 'gttg'], key, { hd: hd([1, 3]) })
    : piece('dentures', ['gttg', 'gttg'], key, { hd: hd([1, 2]) });
}

/** The end of Grace's ivory scarf, bunched in a hand (boot polish). */
export function scarfEnd(): PixelBuffer {
  // 2×: the bunched cloth with 1-px fold lines and a frayed end.
  return piece('scarf-end', ['wW.', 'WwW', '.ww', '..w'], { w: PAL.snow[1], W: PAL.snow[3] }, {
    hiRows: ['wWWW..', 'WWWw..', 'WWfWWW', 'WfWWww', '..wwWw', '..wfww', '....fw', '....w.'],
    hiKey: { f: PAL.snow[0] },
    hd: (c, d) => {
      // Ivory wool (Grace's scarf: the snow ramp's light end, like her rig scarf).
      const wool = c.material({ ramp: PAL_HD.snow, spec: 0.1, shine: 10, rim: 0.35, lo: 3 });
      // The bunch in the fist (top left), the end hanging down and right from it: one soft
      // twisted band along the 1× diagonal, creased across.
      c.stroke([[1.9, 1.8], [2.6, 2.4], [3.4, 3.6]], 0.95, 0.55, {
        mat: wool,
        z: 0,
        tex: folds({ angle: 0.7, spacing: 0.8, amp: 0.9, cover: 0.85, seed: 41 }),
      });
      // The fringe: separate tassels off the end (three at 4×).
      const n = d >= 4 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const x = 3.1 + (i * 0.75) / (n - 1);
        seg(c, d, x, 3.9, x + 0.1, 4.95 - (i % 2) * 0.25, 0, i % 2 ? PAL_HD.snow[3] : PAL_HD.snow[5]);
      }
    },
  });
}

/** A polishing rag (cloth). */
export function rag(): PixelBuffer {
  return piece('rag', ['cCc', 'Ccc', '.cC'], { c: PAL.cloth[1], C: PAL.cloth[3] }, {
    hd: (c, d) => {
      const cloth = c.material({ ramp: PAL_HD.cloth, spec: 0.05, rim: 0.3, lo: 2, wrap: 0.2 });
      // A bunched cloth: a soft lumpy wad at the top left (one lit height field), its corner
      // hanging down to the right as a creased tail; a shoe-polish smudge on the tail at 4×.
      const g = (x: number, y: number, r: number): number => Math.exp(-(x * x + y * y) / (r * r));
      c.heightField(1, 1, 3, 2.6, (x, y) => {
        const q = 1 - ((x - 2.3) / 1.45) ** 2 - ((y - 2.2) / 1.25) ** 2;
        if (q <= 0) return NaN;
        return Math.sqrt(q) * 0.9 + 0.35 * g(x - 1.8, y - 1.7, 0.6) + 0.3 * g(x - 2.9, y - 2.3, 0.55);
      }, { mat: cloth, z: 0.5 });
      c.stroke([[3.1, 2.7], [3.45, 3.3], [3.5, 3.95]], 0.55, 0.45, {
        mat: cloth,
        z: 0,
        tone: -0.1,
        tex: folds({ angle: 1.3, spacing: 0.7, amp: 0.8, cover: 0.8, seed: 43 }),
      });
      if (d >= 4) c.shade(3, 3.2, 1, 0.8, (x, y) => (Math.hypot(x - 3.5, y - 3.6) < 0.3 ? -0.3 : 0));
    },
  });
}

/** A sparkle star (no outline: it glows). */
export function sparkle(big: boolean): PixelBuffer {
  const key = { w: PAL.snow[3], y: PAL.gold[3] };
  // A four-point twinkle: white core, rays tapering to gold tips; at 4× faint diagonal rays.
  const hd = (cx: number, len: number): PieceHdDraw => (c, d) => {
    const e = 1 / d;
    c.paint(0, 0, cx * 2, cx * 2, (x, y) => {
      const ax = Math.abs(x - cx);
      const ay = Math.abs(y - cx);
      const r = Math.max(ax, ay);
      const across = Math.min(ax, ay);
      if (Math.hypot(ax, ay) < 0.55 + e) return PAL_HD.snow[6];
      if (r <= len && across <= Math.max(e * 0.6, (1 - r / len) * 0.55)) {
        return r < len * 0.45 ? PAL_HD.snow[6] : r < len * 0.75 ? PAL_HD.gold[6] : PAL_HD.gold[5];
      }
      if (d >= 4 && len > 2 && Math.abs(ax - ay) < e * 0.7 && r < len * 0.5) return PAL_HD.gold[6];
      return 0;
    });
  };
  return big
    ? piece('sparkle-big', ['..y..', '..w..', 'ywwwy', '..w..', '..y..'], key, {
        outline: false,
        hiRows: ['....y.....', '....w.....', '....ww....', '...wwww...', 'ywwwwwwww.', '.wwwwwwwwy', '...wwww...', '....ww....', '.....w....', '.....y....'],
        hd: hd(3.5, 2.5),
      })
    : piece('sparkle', ['.y.', 'ywy', '.y.'], key, {
        outline: false,
        hiRows: ['...y..', '..ww..', '.wwwwy', 'ywwww.', '..ww..', '..y...'],
        hd: hd(2.5, 1.5),
      });
}

/** A dust puff (cartoon cloud) of size 0 (small) or 1 (big). */
export function dustPuff(size: 0 | 1): PixelBuffer {
  const key = { s: PAL.stone[2], S: PAL.stone[3] };
  // 2×: rounder puffs, lit on top, a 1-px shadow along the underside.
  const dk = { d: PAL.stone[1] };
  // Soft cartoon dust: a few big lobes blended into one cloud (no rubble), lit on top, low contrast.
  const dust = (c: HdCanvas): number => c.material({ ramp: PAL_HD.stone, spec: 0, wrap: 0.6, amb: 0.2, rim: 0.2, lo: 3 });
  return size === 0
    ? piece('dust0', ['.SS.S.', 'SSsSSs', '.sssS.'], key, {
        hiRows: ['..SSS...SS..', '.SSSSS.SSSs.', 'SSSSsSSSSSss', 'SSsssSSSssss', '.sssssssssd.', '..ddsssddd..'],
        hiKey: dk,
        hd: (c) => {
          puffs(c, [[2.8, 2.3, 1.45, 1.2], [5.3, 2.25, 1.25, 1.1], [4, 3.2, 1.3, 0.85], [1.8, 3.2, 0.85, 0.7], [6.2, 3.1, 0.85, 0.7]], { mat: dust(c), smooth: true, relief: 0.8 });
        },
      })
    : piece('dust1', ['..SS..SS..', '.SSSsSSSs.', 'SSsssSSssS', '.ssssssss.'], key, {
        hiRows: [
          '....SSS.....SSS.....',
          '...SSSSS...SSSSSs...',
          '..SSSSSSssSSSSSSss..',
          '.SSSSsssssSSSSssss..',
          'SSSsssssSSSssssssSSs',
          'SSssssssSsssssssssss',
          '.sssssssssssssssssd.',
          '..dddsssssddsssddd..',
        ],
        hiKey: dk,
        hd: (c) => {
          puffs(c, [
            [3.8, 2.55, 1.75, 1.45], [7.9, 2.55, 1.75, 1.45], [5.8, 3.7, 1.6, 1.05], [2.2, 3.8, 1.25, 0.95], [9.7, 3.7, 1.25, 0.95], [10.5, 4.1, 0.7, 0.55], [1.6, 4.3, 0.7, 0.5],
          ], { mat: dust(c), smooth: true, relief: 0.8 });
        },
      });
}

/** Pink puffs of helium (the head deflates). */
export function heliumPuff(): PixelBuffer {
  return piece('helium-puff', ['.pP.', 'pPPp', '.pp.'], { p: PAL.pink[1], P: PAL.pink[2] }, {
    hd: (c) => {
      const gas = c.material({ ramp: PAL_HD.pink, spec: 0.2, wrap: 0.35, rim: 0.3, lo: 2 });
      puffs(c, [[2.6, 2.4, 0.95], [3.7, 2.1, 1], [1.8, 2.8, 0.7], [4.3, 2.8, 0.7], [3, 3.2, 0.75]], { mat: gas, smooth: true, relief: 0.7 });
    },
  });
}

// ------------------------------------------------------------------------------------ the squad

/** Vincent's battle plan, unrolled: cream paper, a blue route with arrows, red target crosses. */
export function planSheet(): PixelBuffer {
  return piece('plan-sheet', ['PPPPPPP', 'PbPPRPP', 'PPbPPPP', 'PPPbbbR', 'ppppppp'], { P: PAL.sand[3], p: PAL.sand[2], b: PAL.sky[1], R: PAL.red[2] }, {
    hiRows: [
      'PPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPP',
      'PPbPPPPPRPPRPP',
      'PPbbPPPPPRRPPP',
      'PPPbbPPPPRRPPP',
      'PPPPbbPPRPPRPP',
      'PPPPPbbPPPPPPP',
      'PPPPPPbbbbbbRR',
      'pppppppppppppp',
      'pPpppppppppPpp',
    ],
    hd: (c, d) => {
      const paper = c.material({ ramp: PAL_HD.sand, spec: 0.05, lo: 3, rim: 0.2 });
      // The sheet (a faint grid, a slight sag), the rolled bottom edge.
      c.plane(1, 1, 7, 4.1, {
        mat: paper,
        z: 0,
        normal: (x, y, n) => {
          n[0] = (x - 4.5) * 0.03;
          n[1] = (y - 3) * 0.05;
          n[2] = 1;
        },
        tex: (s) => {
          // A faint map grid at 4× (one art px lines every logical px).
          if (d >= 4 && (((s.x - 1) % 1) < 1 / d || ((s.y - 1) % 1) < 1 / d)) s.tone -= 0.07;
        },
      });
      c.cylinder(1, 4.9, 7, 1.1, { mat: paper, z: 0.6, axis: 'h', tone: -0.1 });
      // The route (dashed at 4×) with an arrowhead, and two red target crosses.
      const route = PAL_HD.sky[1];
      const pts = [[2.3, 2.2], [3.4, 3.3], [4.4, 4.3], [6.6, 4.3]] as const;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const steps = d >= 4 ? 3 : 1;
        for (let k = 0; k < steps; k++) {
          const t0 = k / steps;
          const t1 = d >= 4 ? (k + 0.65) / steps : 1;
          seg(c, d, ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, 0.45, route);
        }
      }
      seg(c, d, 6.6, 4.3, 6.0, 3.8, 0, route);
      const red = PAL_HD.red[5];
      for (const [x, y] of [[5.5, 2.5], [7.4, 4.3]] as const) {
        seg(c, d, x - 0.5, y - 0.5, x + 0.5, y + 0.5, d >= 4 ? 0.4 : 0, red);
        seg(c, d, x - 0.5, y + 0.5, x + 0.5, y - 0.5, d >= 4 ? 0.4 : 0, red);
      }
    },
  });
}

/** Bob's boarding pass: a blue stub and a white ticket with a barcode. */
export function boardingPass(): PixelBuffer {
  return piece('boarding-pass', ['bbSSS', 'bbS1S', 'bbSSS'], { b: PAL.sky[1], S: PAL.snow[3], '1': PAL.steel[1] }, {
    hiRows: ['bbbSSSSSSS', 'bBbSS1S1SS', 'bbbSSSSSSS', 'bBbS1S1S1S', 'bbbSSSSSSS', 'bbbSSSSSSS'],
    hiKey: { B: PAL.sky[2] },
    hd: (c, d) => {
      const blue = c.material({ ramp: PAL_HD.sky, spec: 0.15, rim: 0.2 });
      const paper = c.material({ ramp: PAL_HD.snow, spec: 0.1, lo: 3, rim: 0.2 });
      const part = c.newPart();
      // One card: the blue stub, the white ticket, slightly bent at the perforation.
      c.plane(1, 1, 5, 3, {
        mat: paper,
        part,
        z: 0,
        normal: (x, _y, n) => {
          n[0] = x < 3 ? -0.15 : 0.08;
          n[1] = 0;
          n[2] = 1;
        },
        tex: (s) => {
          if (s.x < 2.9) s.mat = blue;
          if (s.x < 2.9 && d >= 4 && s.y > 1.6 && s.y < 2.0) s.tone += 0.25;
        },
      });
      // Perforation dots; barcode bars of varied width.
      for (let y = 1.2; y < 4; y += d >= 4 ? 0.5 : 1) c.dot(2.95, y, PAL_HD.snow[1]);
      const bar = PAL_HD.ink[1];
      const e = 1 / d;
      c.paint(3.4, 2.1, 2.3, 1.3, (x, _y, X) => (X % 2 === 1 ? 0 : hash2(X >> 1, 0, 61) > 0.35 || x < 3.4 + e ? bar : 0));
      if (d >= 4) c.paint(3.4, 1.4, 1.6, 0.25, (_x, _y, X) => (X % 3 !== 2 ? PAL_HD.steel[3] : 0));
    },
  });
}

/** Patrick's pocket device: a small glowing screen (the outline is its bezel). */
export function pocketDevice(): PixelBuffer {
  return piece('pocket-device', ['cCc', 'ccc'], { c: PAL.teal[3], C: PAL.snow[3] }, {
    hiRows: ['ccCCcc', 'cCCccc', 'cccccc', 'ccctcc'],
    hiKey: { t: PAL.teal[2] },
    hd: (c, d) => {
      const shell = c.material({ ramp: PAL_HD.black, spec: 0.9, shine: 30, rim: 0.4 });
      const e = 1 / d;
      // The dark glass bezel, the lit screen inside it (emissive), a diagonal glare and a status line.
      c.box(1, 1, 3, 2, { mat: shell, z: 0, bevel: 0.3, r: 0.3 });
      c.paint(1 + e, 1 + e, 3 - 2 * e, 2 - 2 * e, (x, y) => {
        const g = x - 1 + (y - 1) * 0.8;
        if (g > 0.5 && g < 1.1) return PAL_HD.teal[6];
        if (y > 2.4 && x > 1.6 && x < 3.2) return PAL_HD.teal[3];
        return PAL_HD.teal[5];
      });
    },
  });
}

/** The device's glow on the face (no outline: light). */
export function deviceGlow(): PixelBuffer {
  return piece('device-glow', ['c.', '.c'], { c: PAL.teal[3] }, {
    outline: false,
    hiRows: ['c...', '.c..', '..c.', '...c'],
    hd: (c, d) => {
      // The screen light caught on the jaw: a short diagonal glint (a long thin line reads as a
      // tear), one art px wide at 2×; at 4× two px wide, the bright core over a teal edge.
      const lo = d >= 4 ? 1 : 0;
      c.paint(1, 1, 2, 2, (_x, _y, X, Y) => {
        const a = X - d;
        const b = Y - d;
        if (a === b) return a >= lo && a <= 2 * d - 1 - lo ? PAL_HD.teal[6] : 0;
        return d >= 4 && a === b + 1 && b >= 2 && b <= 4 ? PAL_HD.teal[5] : 0;
      });
    },
  });
}

// ------------------------------------------------------------------------------------ placing

/** Point of a frame (relative to its anchor), or the fallback. */
export function pt(f: Frame, name: string, fb: readonly [number, number]): [number, number] {
  const p = f.pts?.[name];
  return p ? [p[0], p[1]] : [fb[0], fb[1]];
}

/** Put `buf` centred on (x, y) relative to the frame anchor. */
export function at(buf: PixelBuffer, x: number, y: number, behind = false): Piece {
  return { buf, x: Math.round(x - buf.w / 2), y: Math.round(y - buf.h / 2), behind };
}

/** Put `buf` standing on line y (default the ground line y = 0): its lowest row is y − 1. */
export function onGround(buf: PixelBuffer, x: number, y = 0): Piece {
  return { buf, x: Math.round(x - buf.w / 2), y: y - buf.h };
}

/**
 * `q` drawn with its UHD art at density d (`pieceHd`): the same logical place and size. A piece
 * that already has a density, or no HD drawer, is returned as it is.
 */
export function hdPiece(q: Piece, d: HdDensity): Piece {
  if ((q.density ?? 1) !== 1) return q;
  const hd = pieceHd(q.buf, d);
  return hd ? { ...q, buf: hd, density: d } : q;
}

/**
 * Stack pieces onto frame i (null = keep the frame). On a 2× or 4× frame every piece is drawn as
 * its UHD art at the frame's density (`hdPiece`); a 1× frame gets the 1× pieces exactly.
 */
export function decorateFrames(frames: readonly Frame[], fn: (f: Frame, i: number) => Piece[] | null): Frame[] {
  return frames.map((f, i) => {
    const p = fn(f, i);
    if (!p || !p.length) return f;
    const d = f.density ?? 1;
    return withPieces(f, d === 2 || d === 4 ? p.map((q) => hdPiece(q, d)) : p);
  });
}

/**
 * Mirror a full-body frame about its anchor (a spin frame: the figure faces the other way).
 * Works on 2× frames too: the anchor and pts are logical px, so the logical width is used.
 */
export function mirrored(f: Frame): Frame {
  const buf = f.buf.flipped(true, false);
  const pts: Record<string, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(f.pts ?? {})) pts[k] = [-p[0], p[1]];
  const out: Frame = { buf, ox: frameW(f) - 1 - f.ox, oy: f.oy, pts };
  return f.density === undefined ? out : { ...out, density: f.density };
}
