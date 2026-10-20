/**
 * Hostage bind art (`item/bind/…`) and the pieces hostage.art.ts stacks onto the figures: the
 * folding chair, the hanging cage (back and front bars), the burlap sack, the parachute canopy.
 *
 * Sprites: `rope` (8 frames = 1…8 px rope segments, drawn stacked by binds.ts `drawRope`),
 * `rope-bit` (a cut rope end tumbling), `rope-band` (float ropes across the chest / knees),
 * `chair-break`, `cage-break`, `sack-off` (the free animations), `mast` (the parade-float pole),
 * `balloon` (the weather balloon). All palette ramps, 1-px INK outlines, light from the top-left.
 *
 * UHD art (docs/ART_GUIDE.md "UHD art"): every bind and piece has one density-generic drawer for
 * 2× and 4× (`…Hd`: HdCanvas, PAL_HD, outline A, rim light; twisted rope, oiled wood with grain,
 * woven burlap, lit steel), fitted into its 1× footprint. `HD_RENDER`, `hdOf`, `fitHd` and
 * `hdCached` are shared with hostage.art.ts.
 */
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import type { Frame } from '../../../engine/render';
import { defineHdSprite, defineSprite, type SpriteOpts } from '../../../engine/sprites';
import { HdCanvas, wood, type RenderOpts, type Texture } from '../../art/hd';
import { hash2, shadeLayer } from '../../art/paint';

// ------------------------------------------------------------------------------------ rope

/** A rope segment `len` px long (4 px wide: ink, light strand, dark strand, ink), top anchor. */
function ropeSegment(len: number): Frame {
  const b = new PixelBuffer(4, len);
  for (let y = 0; y < len; y++) {
    b.set(0, y, INK);
    b.set(3, y, INK);
    // Twisted strands: the light strand crosses over every 3 px.
    const twist = y % 3 === 0;
    b.set(1, y, twist ? PAL.sand[2] : PAL.sand[3]);
    b.set(2, y, twist ? PAL.sand[3] : PAL.sand[1]);
  }
  return { buf: b, ox: 2, oy: 0 };
}

/** A cut end of rope, 7 px, tumbling in 4 frames (centre anchor). */
function ropeBitFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new PixelBuffer(11, 11);
    const a = (i * Math.PI) / 4;
    const dx = Math.round(Math.cos(a) * 3);
    const dy = Math.round(Math.sin(a) * 3);
    b.thickLine(5 - dx, 5 - dy, 5 + dx, 5 + dy, 2, PAL.sand[2]);
    b.set(5 - dx, 5 - dy, PAL.sand[3]);
    b.set(5 + dx, 5 + dy, PAL.sand[1]);
    b.outline(INK);
    out.push({ buf: b, ox: 5, oy: 5 });
  }
  return out;
}

/** Rope bands of the float bind: frame 0 across the chest (16 px), 1 across the knees (12 px). */
function ropeBandFrames(): Frame[] {
  return [16, 12].map((w) => {
    const b = new PixelBuffer(w + 2, 5);
    for (let x = 1; x <= w; x++) {
      b.set(x, 2, (x & 1) === 0 ? PAL.sand[3] : PAL.sand[2]);
      b.set(x, 3, PAL.sand[1]);
    }
    // A knot on the front.
    b.rect(w - 4, 1, 3, 3, PAL.sand[2]);
    b.set(w - 4, 1, PAL.sand[3]);
    b.outline(INK);
    return { buf: b, ox: (w + 2) >> 1, oy: 3 };
  });
}

// ------------------------------------------------------------------------------------ chair

/**
 * Wooden folding chair seen from the side, drawn behind a sitting figure. `broken` 0 = whole,
 * 1 = legs splayed, 2 = backrest gone. Origin = the seat's back corner at (2, 12).
 */
export function chairPiece(broken = 0): PixelBuffer {
  const b = new PixelBuffer(16, 22);
  const wood = PAL.brown;
  if (broken < 2) {
    b.rect(2, 1, 2, 12, wood[2]);
    b.rect(1, 2, 4, 2, wood[3]);
  }
  b.rect(2, 12, 12, 2, wood[2]);
  b.hline(2, 13, 12, wood[3]);
  if (broken < 1) {
    b.line(3, 14, 3, 20, wood[1]);
    b.line(12, 14, 12, 20, wood[1]);
    b.line(4, 15, 11, 19, wood[1]);
  } else {
    b.line(3, 14, 6, 20, wood[1]);
    b.line(12, 14, 9, 20, wood[1]);
  }
  shadeLayer(b, wood, {});
  return b.padded(1).outline(INK);
}

/** A loose plank / chair stick for the break frames. */
function stick(len: number, angle: number): PixelBuffer {
  const s = len + 4;
  const b = new PixelBuffer(s, s);
  const c = s / 2;
  const dx = Math.cos(angle) * (len / 2);
  const dy = Math.sin(angle) * (len / 2);
  b.thickLine(Math.round(c - dx), Math.round(c - dy), Math.round(c + dx), Math.round(c + dy), 2, PAL.brown[2]);
  b.set(Math.round(c - dx), Math.round(c - dy), PAL.brown[3]);
  return b.outline(INK);
}

/** The chair falls apart behind the freed hostage: it collapses, sticks fly, they settle. */
function chairBreakFrames(draw: (len: number, angle: number) => PixelBuffer = stick, d = 1): Frame[] {
  const out: Frame[] = [];
  const W = 40;
  const H = 30;
  const layouts: Array<Array<[number, number, number, number]>> = [
    // [x, y (top-left from the anchor), length, angle]
    [[-10, -24, 12, 1.5], [-8, -12, 12, 0.1], [-9, -9, 9, 1.2], [1, -9, 9, 1.9]],
    [[-14, -26, 12, 1.1], [-9, -16, 12, -0.3], [-14, -10, 9, 0.6], [4, -12, 9, 2.4]],
    [[-17, -16, 12, 0.6], [-8, -14, 12, 0.5], [-17, -6, 9, 0.2], [7, -7, 9, 2.9]],
    [[-17, -6, 12, 0.05], [-6, -6, 12, 3.1], [-14, -5, 9, 0], [6, -5, 9, 0.1]],
  ];
  for (const lay of layouts) {
    const b = new PixelBuffer(W * d, H * d);
    for (const [x, y, len, a] of lay) b.blit(draw(len, a), (W / 2 + x) * d, (H + y) * d);
    out.push(d === 1 ? { buf: b, ox: W / 2, oy: H } : { buf: b, ox: W / 2, oy: H, density: d });
  }
  return out;
}

// ------------------------------------------------------------------------------------ cage

/** Cage frame size (GDD §7.2: 20×30), plus 1 px of outline each side. */
export const CAGE = { w: 20, h: 30 } as const;
const BAR_XS = [1, 5, 9, 14, 18];

/**
 * The cage behind the figure: dark back bars, the floor plate, the domed roof and the hanging
 * ring. Top-left at (−11, −32) from the feet anchor (the cage stands on y 0).
 */
export function cageBack(): PixelBuffer {
  const b = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  const s = PAL.steel;
  // Silhouette (outlined), then the back bars and plates.
  const sil = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  sil.rect(1, 5, CAGE.w, CAGE.h - 4, s[0]);
  sil.ellipse(1, 2, CAGE.w, 8, s[0]);
  sil.rect(CAGE.w / 2 - 1, 0, 4, 3, s[0]);
  for (let y = 0; y < sil.h; y++) for (let x = 0; x < sil.w; x++) if ((sil.get(x, y) & 255) !== 0) b.set(x, y, 0);
  // Back bars (darker, between the front bars).
  for (const x of [3, 7, 12, 16]) b.vline(x + 1, 6, CAGE.h - 2, s[1]);
  // Roof dome and ring.
  b.ellipse(1, 2, CAGE.w, 8, s[2]);
  b.ellipse(3, 3, CAGE.w - 4, 5, s[3]);
  b.hline(2, CAGE.w - 1, 6, s[1]);
  b.rect(CAGE.w / 2, 0, 2, 3, PAL.gold[1]);
  b.set(CAGE.w / 2, 0, PAL.gold[2]);
  // Floor plate.
  b.rect(1, CAGE.h - 2, CAGE.w, 3, s[2]);
  b.hline(1, CAGE.w, CAGE.h - 2, s[3]);
  b.hline(1, CAGE.w, CAGE.h, s[0]);
  b.outline(INK);
  // Clear the inside between the back bars so the figure shows there (the back is open air).
  return b;
}

/** The front bars and rims, drawn over the figure (same placement as `cageBack`). */
export function cageFront(): PixelBuffer {
  const b = new PixelBuffer(CAGE.w + 2, CAGE.h + 2);
  const s = PAL.steel;
  for (const x of BAR_XS) {
    b.vline(x + 1, 6, CAGE.h - 2, s[3]);
    // Bars are lit on the left: a dark right edge only on the outer bars.
  }
  b.vline(CAGE.w, 6, CAGE.h - 2, s[2]);
  // Rims: top band under the dome, middle band, the floor lip.
  b.hline(1, CAGE.w, 7, s[3]);
  b.hline(1, CAGE.w, 8, s[1]);
  b.hline(1, CAGE.w, 18, s[2]);
  b.hline(1, CAGE.w, CAGE.h - 3, s[3]);
  // A padlock on the front bar.
  b.rect(CAGE.w - 6, 16, 4, 4, PAL.gold[1]);
  b.set(CAGE.w - 6, 16, PAL.gold[3]);
  b.set(CAGE.w - 5, 15, PAL.gold[2]);
  b.set(CAGE.w - 4, 15, PAL.gold[2]);
  return b;
}

/** The cage break layout: per frame the dome's and each bar's top-left (from the anchor), bar length and angle. */
const CAGE_BREAK: ReadonlyArray<{ dome: readonly [number, number]; bars: ReadonlyArray<readonly [number, number, number, number]> }> = [
  { dome: [-11, -34], bars: [[-14, -28, 22, 1.45], [-4, -30, 22, 1.6], [6, -28, 22, 1.7]] },
  { dome: [-12, -38], bars: [[-20, -28, 20, 1.1], [-5, -33, 20, 1.5], [9, -27, 20, 2.0]] },
  { dome: [-13, -26], bars: [[-24, -18, 18, 0.7], [-4, -30, 18, 1.3], [13, -18, 18, 2.4]] },
  { dome: [-24, -11], bars: [[-23, -6, 18, 0.05], [-6, -6, 18, 3.1], [9, -6, 18, 0.1]] },
];

/** The cage bursts open where it lands: front bars spring off, the frame falls apart. */
function cageBreakFrames(): Frame[] {
  const out: Frame[] = [];
  const W = 48;
  const H = 40;
  const bar = (len: number, a: number): PixelBuffer => {
    const s = len + 4;
    const p = new PixelBuffer(s, s);
    const c = s / 2;
    const dx = Math.cos(a) * (len / 2);
    const dy = Math.sin(a) * (len / 2);
    p.line(Math.round(c - dx), Math.round(c - dy), Math.round(c + dx), Math.round(c + dy), PAL.steel[3]);
    return p.outline(INK);
  };
  const dome = (): PixelBuffer => {
    const p = new PixelBuffer(CAGE.w + 2, 10);
    p.ellipse(1, 1, CAGE.w, 8, PAL.steel[2]);
    p.ellipse(3, 2, CAGE.w - 4, 5, PAL.steel[3]);
    return p.outline(INK);
  };
  const floor = (): PixelBuffer => {
    const p = new PixelBuffer(CAGE.w + 2, 5);
    p.rect(1, 1, CAGE.w, 3, PAL.steel[2]);
    p.hline(1, CAGE.w, 1, PAL.steel[3]);
    return p.outline(INK);
  };
  for (const st of CAGE_BREAK) {
    const b = new PixelBuffer(W, H);
    b.blit(floor(), W / 2 - 11, H - 5);
    for (const [x, y, len, a] of st.bars) b.blit(bar(len, a), W / 2 + x, H + y);
    b.blit(dome(), W / 2 + st.dome[0], H + st.dome[1]);
    out.push({ buf: b, ox: W / 2, oy: H });
  }
  return out;
}

// ------------------------------------------------------------------------------------ sack

/**
 * A burlap sack with a figure inside (tied at the top), `h` px tall, `w` wide at the bottom.
 * The bottom edge sits on row h + 1 of the buffer (1 px outline margin).
 */
export function sackPiece(w: number, h: number, tilt = 0): PixelBuffer {
  const b = new PixelBuffer(w + 6, h + 6);
  const cx = (w + 6) / 2;
  const body: Array<[number, number]> = [
    [cx - w / 2, h + 2],
    [cx + w / 2, h + 2],
    [cx + w / 2 - 1 + tilt, 10],
    [cx + 2 + tilt, 5],
    [cx - 2 + tilt, 5],
    [cx - w / 2 + 1 + tilt, 10],
  ];
  b.poly(body.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), PAL.sand[1]);
  shadeLayer(b, PAL.sand, { base: 1 });
  // The tied neck and the tuft above it.
  const nx = Math.round(cx + tilt);
  b.rect(nx - 2, 4, 4, 2, PAL.brown[2]);
  b.hline(nx - 2, nx + 1, 5, PAL.brown[1]);
  b.set(nx - 2, 2, PAL.sand[2]);
  b.set(nx - 1, 1, PAL.sand[2]);
  b.set(nx, 2, PAL.sand[1]);
  b.set(nx + 1, 1, PAL.sand[2]);
  b.set(nx - 1, 3, PAL.sand[2]);
  b.set(nx, 3, PAL.sand[1]);
  // Weave seams and a stitched patch.
  for (let y = 12; y < h; y += 5) {
    for (let x = Math.round(cx - w / 2) + 2; x < cx + w / 2 - 2; x += 4) {
      if ((b.get(x, y) & 255) !== 0) b.set(x, y, PAL.sand[0]);
    }
  }
  const px = Math.round(cx + 1);
  const py = Math.round(h * 0.55);
  b.rect(px, py, 4, 4, PAL.brown[2]);
  b.set(px, py, PAL.brown[3]);
  b.set(px + 3, py + 3, PAL.brown[1]);
  // Stamped lettering: a little crimson Legion stencil mark.
  b.hline(Math.round(cx - 4), Math.round(cx - 2), py - 4, PAL.red[1]);
  b.hline(Math.round(cx - 4), Math.round(cx - 2), py - 2, PAL.red[1]);
  return b.outline(INK);
}

/** The empty sack slumps to the ground once the hostage is out (`d` 2 / 4: the HD sack). */
function sackOffFrames(d = 1): Frame[] {
  return [
    [16, 18, 0],
    [18, 10, 1],
    [20, 5, 1],
  ].map(([w, h, t]) => {
    if (d !== 1) return { buf: sackPieceHd(w, h, t, hdOf(d)), ox: (w + 6) >> 1, oy: h + 3, density: d };
    const p = sackPiece(w, h, t);
    return { buf: p, ox: p.w >> 1, oy: h + 3 };
  });
}

// ------------------------------------------------------------------------------------ parachute

/** A small round parachute canopy (crimson and ivory gores), 26 px wide. */
export function canopyPiece(phase = 0): PixelBuffer {
  const w = 26;
  const b = new PixelBuffer(w + 2, 12);
  const sag = phase ? 1 : 0;
  b.ellipse(1, 1, w, 16, PAL.snow[2]);
  // Cut the lower half off: a dome with a scalloped hem.
  for (let y = 9 - sag; y < 12; y++) for (let x = 0; x < w + 2; x++) b.set(x, y, 0);
  for (let x = 1; x < w + 1; x += 5) {
    b.set(x + 2, 9 - sag, PAL.snow[1]);
    b.set(x + 3, 9 - sag, PAL.snow[1]);
  }
  // Crimson gores.
  for (let y = 1; y < 10; y++) {
    for (let x = 1; x < w + 1; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const gore = Math.floor(((x - 1) / w) * 5);
      if (gore % 2 === 1) b.set(x, y, y < 4 ? PAL.red[3] : PAL.red[2]);
      else if (y < 4) b.set(x, y, PAL.snow[3]);
    }
  }
  return b.outline(INK);
}

// ------------------------------------------------------------------------------------ mast

/**
 * The parade-float pole the `float` hostage is tied to: a striped crimson-and-ivory pole with a
 * gold finial and a small pennant, 44 px tall (feet anchor).
 */
function mastFrames(): Frame[] {
  const H = 46;
  const b = new PixelBuffer(16, H);
  const x = 2;
  for (let y = 6; y < H - 1; y++) {
    const band = Math.floor((y + 1) / 4) % 2 === 0;
    b.set(x, y, band ? PAL.red[2] : PAL.snow[2]);
    b.set(x + 1, y, band ? PAL.red[1] : PAL.snow[1]);
  }
  // Base block and finial.
  b.rect(x - 1, H - 4, 4, 3, PAL.brown[2]);
  b.hline(x - 1, x + 2, H - 4, PAL.brown[3]);
  b.rect(x - 1, 3, 4, 3, PAL.gold[2]);
  b.set(x, 3, PAL.gold[3]);
  b.set(x, 2, PAL.gold[2]);
  b.set(x + 1, 2, PAL.gold[1]);
  // Pennant (gold with a crimson stripe) fluttering forward.
  b.poly([[x + 2, 7], [x + 12, 9], [x + 2, 12]], PAL.gold[2]);
  b.hline(x + 3, x + 8, 9, PAL.red[2]);
  b.set(x + 3, 7, PAL.gold[3]);
  b.outline(INK);
  return [{ buf: b, ox: x + 1, oy: H }];
}

// ------------------------------------------------------------------------------------ balloon

/**
 * A weather balloon (pale latex, a crimson Legion band) with the knot at the bottom (anchor):
 * 2 frames, the second slightly stretched (bobbing).
 */
function balloonFrames(): Frame[] {
  return [0, 1].map((i) => {
    const W = 22;
    const H = 27 + i;
    const b = new PixelBuffer(W + 2, H + 2);
    b.ellipse(1, 1, W, H - 4, PAL.snow[1]);
    b.sphere(W / 2 + 1, (H - 4) / 2 + 1, W / 2 - 1, PAL.snow, { light: 'tl', dither: false });
    // Band and knot.
    for (let x = 1; x <= W; x++) {
      const y = Math.round((H - 4) * 0.62 + 1);
      if ((b.get(x, y) & 255) !== 0) {
        b.set(x, y, PAL.red[2]);
        if ((b.get(x, y + 1) & 255) !== 0) b.set(x, y + 1, PAL.red[1]);
      }
    }
    b.rect(W / 2, H - 4, 3, 2, PAL.snow[1]);
    b.set(W / 2 + 1, H - 2, PAL.snow[0]);
    b.set(W / 2 + 1, H - 1, PAL.snow[0]);
    // A shine spot.
    b.rect(6, 5 + i, 2, 3, PAL.snow[3]);
    b.outline(INK);
    return { buf: b, ox: W / 2 + 1, oy: H + 1 };
  });
}

// ------------------------------------------------------------------------------------ UHD

/** A dense density of the UHD art. */
export type HdD = 2 | 4;

/** The cast's sprite look (style decisions): outline A, a cool rim light, AO — as the rig. */
export const HD_RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** 2 or 4 for a dense density. */
export function hdOf(d: number): HdD {
  return d >= 4 ? 4 : 2;
}

/**
 * Keep a drawing inside the 1× footprint `lo` (geometry is law): every art px outside the opaque
 * box of the 1× buffer less its 1-px outline is dropped BEFORE the render, so outline A wraps a
 * clean edge inside the 1× box (as the rig's `fitFrame`).
 */
export function fitHd(c: HdCanvas, lo: PixelBuffer): void {
  const b = lo.trimBounds();
  if (!b) return;
  const x0 = b.x + 1;
  const y0 = b.y + 1;
  const x1 = b.x + b.w - 1;
  const y1 = b.y + b.h - 1;
  c.erase(0, 0, c.w, c.h, (x, y) => x < x0 || x > x1 || y < y0 || y > y1);
}

/** Finished HD pieces (each a pure function of its key). */
const hdPieces = new Map<string, PixelBuffer>();
export function hdCached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = hdPieces.get(key);
  if (!b) {
    b = make();
    hdPieces.set(key, b);
  }
  return b;
}

/** Rope material: sand-coloured hemp. */
const ropeMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.sand, lo: 1, hi: 6, wrap: 0.1, spec: 0.15, shine: 8 });

/**
 * Twisted rope along a direction (ux, uy): strands as diagonal ridges with dark grooves between
 * them (the normal rolls across each strand), `phase` shifts the twist along the rope.
 */
function twist(ux: number, uy: number, x0: number, y0: number, pitch = 1.1, phase = 0): Texture {
  return (s) => {
    const a = (s.x - x0) * ux + (s.y - y0) * uy;
    const b = -(s.x - x0) * uy + (s.y - y0) * ux;
    const f = ((((a + b * 0.9) / pitch + phase) % 1) + 1) % 1;
    const r = (f - 0.5) * 2;
    s.nx += ux * r * 0.45;
    s.ny += uy * r * 0.45;
    if (f < 0.16) s.tone -= 0.3;
  };
}

/** A rope segment `len` px long at density d (4 logical wide, top anchor): a twisted vertical rope, no outline at its cut ends (segments stack). */
function ropeSegmentHd(len: number, d: HdD): Frame {
  const c = new HdCanvas(4, len, d);
  c.cylinder(1, -1, 2, len + 2, { mat: ropeMat(c), z: 0, tex: twist(0, 1, 0, 0, 1.2) });
  return { buf: c.render(HD_RENDER), ox: 2, oy: 0, density: d };
}

/** The cut rope end at density d (the 11 × 11 `ropeBitFrames` box, centre anchor): a twisted rope tumbling, a frayed end and a clean cut. */
function ropeBitFramesHd(d: HdD): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    const dx = Math.round(Math.cos(a) * 3);
    const dy = Math.round(Math.sin(a) * 3);
    const c = new HdCanvas(11, 11, d);
    const m = ropeMat(c);
    const x0 = 5.5 - dx;
    const y0 = 5.5 - dy;
    const x1 = 5.5 + dx;
    const y1 = 5.5 + dy;
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    c.capsule(x0, y0, x1, y1, 0.95, 0.95, { mat: m, z: 0, tex: twist((x1 - x0) / l, (y1 - y0) / l, x0, y0, 1.1) });
    // The frayed end: loose fibres fanning out; the cut end shows the darker core.
    for (const k of [-1, 0, 1]) {
      const ang = Math.atan2(y0 - y1, x0 - x1) + k * 0.45;
      c.capsule(x0, y0, x0 + Math.cos(ang) * 1.4, y0 + Math.sin(ang) * 1.4, 0.32, 0.22, { mat: m, z: 0.3, tone: 0.15 });
    }
    c.ellipsoid(x1, y1, 0.7, 0.7, { mat: m, z: 0.6, tone: -0.35, round: 0.3 });
    fitHd(c, ropeBitLo(i));
    out.push({ buf: c.render(HD_RENDER), ox: 5, oy: 5, density: d });
  }
  return out;
}

/** The 1× buffer of rope-bit frame i (its footprint for the HD fit). */
function ropeBitLo(i: number): PixelBuffer {
  return ropeBitFrames()[i].buf;
}

/** The float's rope bands at density d (chest 16, knees 12): a twisted rope across with a knot on the front. */
function ropeBandFramesHd(d: HdD): Frame[] {
  return [16, 12].map((w) => {
    const c = new HdCanvas(w + 2, 5, d);
    const m = ropeMat(c);
    c.cylinder(1, 2, w, 2, { mat: m, z: 0, axis: 'h', tex: twist(1, 0, 0, 0, 1.2) });
    c.ellipsoid(w - 2.5, 2.5, 1.5, 1.4, { mat: m, z: 1, tex: twist(0.7, 0.7, w - 2.5, 2.5, 0.9) });
    return { buf: c.render(HD_RENDER), ox: (w + 2) >> 1, oy: 3, density: d };
  });
}

/** Wood (the chair, planks): the 1× brown family, oiled, with grain. */
const woodMat = (c: HdCanvas): number => c.material({ ramp: PAL_HD.brown, lo: 2, hi: 7, spec: 0.3, shine: 14, wrap: 0.05 });

/**
 * The HD folding chair (the `chairPiece` box, 18 × 24 with its outline; `broken` as there):
 * bevelled slats with wood grain, a lit seat edge, splayed legs when broken, steel screws.
 */
export function chairPieceHd(broken: number, d: HdD): PixelBuffer {
  return hdCached(`chair:${broken}@${d}`, () => {
    const c = new HdCanvas(18, 24, d);
    const w = woodMat(c);
    const steel = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 1, shine: 26 });
    const leg = (x0: number, y0: number, x1: number, y1: number, z: number): void => {
      c.capsule(x0, y0, x1, y1, 0.55, 0.55, { mat: w, z, tone: -0.12, tex: wood({ seed: 7 + x0, dir: 'v' }) });
    };
    if (broken < 1) {
      leg(5.5, 16.5, 12.5, 20.5, 0);
      leg(4.5, 15.5, 4.5, 21.5, 0.5);
      leg(13.5, 15.5, 13.5, 21.5, 0.5);
    } else {
      leg(4.5, 15.5, 7.5, 21.5, 0.5);
      leg(13.5, 15.5, 10.5, 21.5, 0.5);
    }
    if (broken < 2) {
      c.box(3, 2, 2, 12, { mat: w, z: 1, bevel: 0.45, tex: wood({ seed: 11, dir: 'v' }) });
      c.box(2, 3, 4, 2, { mat: w, z: 1.4, bevel: 0.5, tone: 0.1, tex: wood({ seed: 12 }) });
      c.ellipsoid(4, 13.4, 0.35, 0.35, { mat: steel, z: 2.4 });
    }
    c.box(3, 13, 12, 2, { mat: w, z: 2, bevel: 0.5, tex: wood({ seed: 13 }) });
    c.ellipsoid(13.2, 14, 0.35, 0.35, { mat: steel, z: 2.6 });
    fitHd(c, chairPiece(broken));
    return c.render(HD_RENDER);
  });
}

/** A loose chair plank at density d (the `stick` box): a bevelled slat with grain, a splintered end. */
function stickHd(len: number, angle: number, d: HdD): PixelBuffer {
  return hdCached(`stick:${len}:${angle}@${d}`, () => {
    const s = len + 4;
    const c = new HdCanvas(s, s, d);
    const w = woodMat(c);
    const k = s / 2;
    const dx = Math.cos(angle) * (len / 2);
    const dy = Math.sin(angle) * (len / 2);
    const ax = Math.round(k - dx);
    const ay = Math.round(k - dy);
    const bx = Math.round(k + dx);
    const by = Math.round(k + dy);
    const l = Math.hypot(bx - ax, by - ay) || 1;
    c.capsule(ax, ay, bx, by, 1, 1, {
      mat: w,
      z: 0,
      round: 0.7,
      tex: (sm) => {
        const along = ((sm.x - ax) * (bx - ax) + (sm.y - ay) * (by - ay)) / l;
        const across = (-(sm.x - ax) * (by - ay) + (sm.y - ay) * (bx - ax)) / l;
        if (Math.abs(across - 0.3 * Math.sin(along * 0.9)) < 0.5 / sm.d) sm.tone -= 0.22;
        // The splintered end: ragged.
        if (along > l - 0.2 && (Math.floor(across * 2.5) & 1) === 0) sm.cut = true;
      },
    });
    fitHd(c, stick(len, angle));
    return c.render(HD_RENDER);
  });
}

/** Steel of the cage. */
const cageSteel = (c: HdCanvas): number => c.material({ ramp: PAL_HD.steel, lo: 1, hi: 6, spec: 1, shine: 26 });

/** The HD cage behind the figure (the `cageBack` box): dark back bars, the lit dome, the brass ring, the floor plate. */
export function cageBackHd(d: HdD): PixelBuffer {
  return hdCached(`cage-back@${d}`, () => {
    const c = new HdCanvas(CAGE.w + 2, CAGE.h + 2, d);
    const st = cageSteel(c);
    const gold = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 });
    for (const x of [3, 7, 12, 16]) c.cylinder(x + 1, 6, 1, CAGE.h - 7, { mat: st, z: 0, tone: -0.3 });
    c.plane(1, 2, CAGE.w, 4.6, {
      mat: st,
      z: 1,
      mask: (x, y) => ((x - 11) / 10) ** 2 + ((y - 6.5) / 4.5) ** 2 < 1 && y < 6.6,
      normal: (x, y, out) => {
        out[0] = ((x - 11) / 10) * 0.9;
        out[1] = (y - 6.5) / 4.5;
        out[2] = 0.6;
      },
    });
    c.box(1, 6, CAGE.w, 1, { mat: st, z: 1.2, bevel: 0.3, tone: -0.2 });
    c.capsule(11, 0.9, 11, 2.4, 0.9, 0.9, { mat: gold, z: 1.5 });
    c.box(1, CAGE.h - 2, CAGE.w, 3, { mat: st, z: 2, bevel: 0.5 });
    fitHd(c, cageBack());
    return c.render(HD_RENDER);
  });
}

/** The HD front bars and rims (drawn over the figure, no ink outline as at 1×): lit round bars, rims, a brass padlock. */
export function cageFrontHd(d: HdD): PixelBuffer {
  return hdCached(`cage-front@${d}`, () => {
    const c = new HdCanvas(CAGE.w + 2, CAGE.h + 2, d);
    const st = cageSteel(c);
    const gold = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 });
    for (const x of BAR_XS) c.cylinder(x + 1, 6, 1, CAGE.h - 7, { mat: st, z: 1 });
    c.cylinder(CAGE.w, 6, 1, CAGE.h - 7, { mat: st, z: 1, tone: -0.15 });
    for (const [y, t] of [[7, 0.1], [18, 0], [CAGE.h - 3, 0.1]] as const) c.cylinder(1, y, CAGE.w, 1.1, { mat: st, z: 2, axis: 'h', tone: t });
    c.box(CAGE.w - 6, 16, 4, 4, { mat: gold, z: 3, bevel: 0.6, r: 0.4 });
    c.capsule(CAGE.w - 5.2, 16, CAGE.w - 4.4, 15, 0.3, 0.3, { mat: gold, z: 3 });
    c.capsule(CAGE.w - 3.6, 15, CAGE.w - 2.8, 16, 0.3, 0.3, { mat: gold, z: 3 });
    return c.render({ outline: 'none', ao: 0.2, rimLight: 0 });
  });
}

/** The cage bursting open at density d (the `cageBreakFrames` layout): springing bars, the dome, the floor plate. */
function cageBreakFramesHd(d: HdD): Frame[] {
  const W = 48;
  const H = 40;
  const lo = cageBreakFrames();
  const bar = (len: number, a: number): PixelBuffer =>
    hdCached(`cage-bar:${len}:${a}@${d}`, () => {
      const s = len + 4;
      const c = new HdCanvas(s, s, d);
      const k = s / 2;
      const dx = Math.cos(a) * (len / 2);
      const dy = Math.sin(a) * (len / 2);
      c.capsule(Math.round(k - dx) + 0.5, Math.round(k - dy) + 0.5, Math.round(k + dx) + 0.5, Math.round(k + dy) + 0.5, 0.5, 0.5, { mat: cageSteel(c), z: 0 });
      return c.render(HD_RENDER);
    });
  const dome = hdCached(`cage-dome@${d}`, () => {
    const c = new HdCanvas(CAGE.w + 2, 10, d);
    c.plane(1, 1, CAGE.w, 8, {
      mat: cageSteel(c),
      z: 0,
      mask: (x, y) => ((x - 11) / 10) ** 2 + ((y - 5) / 4) ** 2 < 1,
      normal: (x, y, out) => {
        out[0] = ((x - 11) / 10) * 0.9;
        out[1] = ((y - 5) / 4) * 0.9;
        out[2] = 0.6;
      },
    });
    return c.render(HD_RENDER);
  });
  const floor = hdCached(`cage-floor@${d}`, () => {
    const c = new HdCanvas(CAGE.w + 2, 5, d);
    c.box(1, 1, CAGE.w, 3, { mat: cageSteel(c), z: 0, bevel: 0.5 });
    return c.render(HD_RENDER);
  });
  const steps = CAGE_BREAK;
  return steps.map((st, i) => {
    const b = new PixelBuffer(W * d, H * d);
    b.blit(floor, (W / 2 - 11) * d, (H - 5) * d);
    for (const [x, y, len, a] of st.bars) b.blit(bar(len, a), (W / 2 + x) * d, (H + y) * d);
    b.blit(dome, (W / 2 + st.dome[0]) * d, (H + st.dome[1]) * d);
    return { buf: b, ox: lo[i].ox, oy: lo[i].oy, density: d };
  });
}

/**
 * The HD burlap sack with a figure inside (the `sackPiece` box): coarse woven burlap (a fine weave
 * at 4×) with creases pulled from the tied neck, stitched seams, a rope tie wound twice with a
 * frayed tuft above it, a stitched patch and the red stencil mark. A low sack (h < 8, slumped
 * and empty) is a heap with its neck lying at the top.
 */
export function sackPieceHd(w: number, h: number, tilt: number, d: HdD): PixelBuffer {
  return hdCached(`sack:${w}:${h}:${tilt}@${d}`, () => {
    const c = new HdCanvas(w + 6, h + 6, d);
    const cx = (w + 6) / 2;
    const L = (x: number): number => Math.round(x);
    const R = (x: number): number => Math.round(x) + 1;
    const burlap = c.material({ ramp: PAL_HD.sand, lo: 2, hi: 6, wrap: 0.1, spec: 0.05, amb: 0.15 });
    const patch = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 4, wrap: 0.1 });
    const red = c.material({ ramp: PAL_HD.red, lo: 2, hi: 5 });
    const tie = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 6, spec: 0.2, shine: 10 });
    const nx = Math.round(cx + tilt) + 0.5;
    const py = Math.round(h * 0.55);
    const px = Math.round(cx + 1);
    const sx = Math.round(cx - 4);
    const weave: Texture = (s) => {
      // Coarse weave: alternating thread bumps; seams every 5 px, creases from the neck.
      if (s.d >= 4 && hash2(Math.floor(s.x * 2), Math.floor(s.y * 4), 61) > 0.88) s.tone -= 0.2;
      const cr = Math.abs((((s.x - nx) * 1.1 - (s.y - 5) * 0.25 * Math.sign(s.x - nx)) % 2.6) / 2.6);
      if (s.y > 7 && cr < 0.12) s.tone -= 0.22;
      if (s.y > 11 && (s.y - 12) % 5 < 1 / s.d && (Math.floor(s.x * 1.5) & 1) === 0) s.tone -= 0.3;
      // The stencil mark (two bars with bridge gaps) and the patch.
      if (s.x >= sx && s.x < sx + 3 && ((s.y >= py - 4 && s.y < py - 3) || (s.y >= py - 2 && s.y < py - 1)) && Math.abs(s.x - sx - 1.25) > 0.25) s.mat = red;
    };
    const body: ReadonlyArray<readonly [number, number]> =
      h >= 8
        ? [[L(cx - w / 2), R(h + 2)], [R(cx + w / 2), R(h + 2)], [R(cx + w / 2 - 1 + tilt), L(10)], [R(cx + 2 + tilt), L(5)], [L(cx - 2 + tilt), L(5)], [L(cx - w / 2 + 1 + tilt), L(10)]]
        : [[L(cx - w / 2), h + 5], [R(cx + w / 2), h + 5], [R(cx + w / 2) - 1.5, h + 1], [nx + 2.5, 5], [nx - 1.5, 5], [L(cx - w / 2) + 1.5, h + 1.5]];
    c.blob(body, 1.6, { mat: burlap, z: 0, bulge: 0.5, tex: weave });
    if (h >= 8) {
      c.box(px, py, 4, 4, {
        mat: patch,
        z: 4,
        bevel: 0.4,
        tex: (s) => {
          if (Math.abs(Math.min(s.x - px, px + 4 - s.x, s.y - py, py + 4 - s.y) - 0.45) < 0.5 / s.d && (Math.floor((s.x + s.y) * 2) & 1) === 0) s.tone += 0.35;
        },
      });
    }
    // The tie: rope wound twice round the neck, the frayed tuft above.
    c.capsule(nx - 2, 4.5, nx + 1.6, 4.5, 0.55, 0.55, { mat: tie, z: 4.5, tex: twist(1, 0, 0, 0, 0.9) });
    c.capsule(nx - 1.8, 5.5, nx + 1.4, 5.6, 0.5, 0.5, { mat: tie, z: 4.6, tex: twist(1, 0, 0, 0, 0.9, 0.4) });
    for (const [x, y, r] of [[-1.2, 2.3, 0.5], [-0.3, 1.6, 0.55], [0.6, 2.1, 0.5], [1.3, 2.9, 0.4], [-1.6, 3.3, 0.4]] as const) {
      c.capsule(nx + x * 0.5, 3.9, nx + x, y, 0.45, r * 0.6, { mat: burlap, z: 4, tone: 0.12 });
    }
    fitHd(c, sackPiece(w, h, tilt));
    return c.render(HD_RENDER);
  });
}

/**
 * The HD parachute canopy (the `canopyPiece` box, 28 × 12): a lit dome of five gores, crimson and
 * ivory, each gore bulging between its seams, the scalloped hem (lifting on `phase` 1).
 */
export function canopyPieceHd(phase: number, d: HdD): PixelBuffer {
  return hdCached(`canopy:${phase}@${d}`, () => {
    const w = 26;
    const c = new HdCanvas(w + 2, 12, d);
    const ivory = c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, wrap: 0.1, spec: 0.2 });
    const crimson = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, wrap: 0.1, spec: 0.2 });
    const sag = phase ? 1 : 0;
    c.plane(1, 1, w, 10, {
      mat: ivory,
      z: 0,
      mask: (x, y) => {
        const g = ((x - 1) / w) * 5;
        const hem = 9 - sag - 0.7 * Math.abs(Math.sin(g * Math.PI));
        return ((x - 14) / 13) ** 2 + ((y - 9) / 8) ** 2 < 1 && y < hem + 0.7;
      },
      normal: (x, y, out) => {
        const g = ((x - 1) / w) * 5;
        const f = g - Math.floor(g) - 0.5;
        out[0] = ((x - 14) / 13) * 0.8 + f * 0.6;
        out[1] = ((y - 9) / 8) * 0.9;
        out[2] = 0.6;
      },
      tex: (s) => {
        const g = Math.floor(((s.x - 1) / w) * 5);
        if (g % 2 === 1) s.mat = crimson;
      },
    });
    fitHd(c, canopyPiece(phase));
    return c.render(HD_RENDER);
  });
}

/** The HD float mast (the `mastFrames` box): a lacquered pole in crimson and ivory bands, a wooden base, a gold finial, a gold pennant with a crimson stripe. */
function mastFramesHd(d: HdD): Frame[] {
  const H = 46;
  const c = new HdCanvas(16, H, d);
  const x = 2;
  const red = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.8, shine: 22 });
  const ivory = c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, spec: 0.8, shine: 22 });
  const gold = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 });
  c.cylinder(x, 6, 2, H - 7, {
    mat: ivory,
    z: 0,
    tex: (s) => {
      if (Math.floor((s.y + 1) / 4) % 2 === 0) s.mat = red;
    },
  });
  c.box(x - 1, H - 4, 4, 3, { mat: woodMat(c), z: 1, bevel: 0.5, tex: wood({ seed: 5 }) });
  c.box(x - 1, 3, 4, 3, { mat: gold, z: 1, bevel: 0.6, r: 0.4 });
  c.ellipsoid(x + 1, 2.6, 1, 1, { mat: gold, z: 1.2 });
  c.blob([[x + 2, 7], [x + 12.6, 9.5], [x + 2, 12.8]], 0.4, {
    mat: gold,
    z: 0.5,
    bulge: 0.1,
    tex: (s) => {
      if (Math.abs(s.y - 9.6) < 0.5 && s.x < x + 9) s.mat = red;
      s.ny += Math.sin(s.x * 1.4) * 0.3;
    },
  });
  fitHd(c, mastFrames()[0].buf);
  return [{ buf: c.render(HD_RENDER), ox: x + 1, oy: H, density: d }];
}

/** The HD weather balloon (the `balloonFrames` boxes): glossy pale latex with a soft shine, a crimson band, the knot. */
function balloonFramesHd(d: HdD): Frame[] {
  const lo = balloonFrames();
  return [0, 1].map((i) => {
    const W = 22;
    const H = 27 + i;
    const c = new HdCanvas(W + 2, H + 2, d);
    const latex = c.material({ ramp: PAL_HD.snow, lo: 0, hi: 5, spec: 0.9, shine: 18, wrap: 0.1 });
    const red = c.material({ ramp: PAL_HD.red, lo: 2, hi: 6, spec: 0.6 });
    const by = Math.round((H - 4) * 0.62 + 1) + 0.5;
    c.ellipsoid(W / 2 + 1, (H - 4) / 2 + 1, W / 2, (H - 4) / 2, {
      mat: latex,
      z: 0,
      tex: (s) => {
        if (Math.abs(s.y - by - 0.4) < 0.95) s.mat = red;
      },
    });
    c.capsule(W / 2 + 1.5, H - 4, W / 2 + 1.5, H - 0.6, 1.1, 0.5, { mat: latex, z: 1, tone: -0.2 });
    fitHd(c, lo[i].buf);
    return { buf: c.render(HD_RENDER), ox: W / 2 + 1, oy: H + 1, density: d };
  });
}

// ------------------------------------------------------------------------------------ register

/**
 * Binds mission ams uses (the chair and the sack: chair-break, sack-off, the cut rope end) have HD
 * art at 2× and 4×; the others (cage, float, balloon: no mission at tier 4 shows them) the same HD
 * drawers at 2× only, so the tier-4 working set does not build them (the 4 → 2 fallback is automatic).
 */
const AMS_BINDS: ReadonlySet<string> = new Set(['rope-bit', 'chair-break', 'sack-off']);

/** Register a bind with its 1× generator and its HD generator (2× and 4× for `AMS_BINDS`, else 2×). */
function defineBind(name: string, gen: () => Frame[], hd: (d: number) => Frame[], opts: SpriteOpts): void {
  const id = `item/bind/${name}`;
  defineSprite(id, gen, opts);
  defineHdSprite(id, hd, AMS_BINDS.has(name) ? [4, 2] : [2]);
}

export function defineBindSprites(): void {
  defineBind('rope', () => [1, 2, 3, 4, 5, 6, 7, 8].map(ropeSegment), (d) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ropeSegmentHd(n, hdOf(d))), { ticksPerFrame: 60 });
  defineBind('rope-bit', ropeBitFrames, (d) => ropeBitFramesHd(hdOf(d)), { ticksPerFrame: 4 });
  defineBind('rope-band', ropeBandFrames, (d) => ropeBandFramesHd(hdOf(d)), { ticksPerFrame: 60 });
  defineBind('chair-break', () => chairBreakFrames(), (d) => chairBreakFrames((len, a) => stickHd(len, a, hdOf(d)), d), { durations: [4, 5, 6, 30], loop: false });
  defineBind('cage-break', cageBreakFrames, (d) => cageBreakFramesHd(hdOf(d)), { durations: [3, 4, 6, 40], loop: false });
  defineBind('sack-off', () => sackOffFrames(), (d) => sackOffFrames(d), { durations: [5, 6, 40], loop: false });
  defineBind('mast', mastFrames, (d) => mastFramesHd(hdOf(d)), { ticksPerFrame: 60 });
  defineBind('balloon', balloonFrames, (d) => balloonFramesHd(hdOf(d)), { ticksPerFrame: 16 });
}
