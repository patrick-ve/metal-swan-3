/**
 * Art kit for the wind soldiers (oompah-trooper, piccolo, bassoonist): skin tones (GDD §9.0;
 * outfits come from the shared `outfitStyle` in ../art.ts), instrument pieces drawn in BODY
 * SPACE so they follow every pose (lean, tumble, prone), and frame effects (puff, frost,
 * pancake, ice block, shatter, soot).
 *
 * Body space = the humanoid rig's convention (x forward, y down, origin at the pelvis). A pose
 * frame from `renderHuman` carries `hip` and `head` points; `bodyOf(frame)` turns them into a
 * transform, so a sousaphone drawn once in body space sits on the torso in every frame and turns
 * with the body in deaths. Pieces are rasterised AFTER the transform (crisp at any angle), shaded
 * with a top-left light like the rig, and outlined in INK.
 */
import type { Color } from '../../../../engine/color';
import { TRANSPARENT } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type HumanStyle, type Pose } from '../../../art/humanoid';
import { Composer, FLAT, hash2, shadeLayer, type ShadeOpts } from '../../../art/paint';
import type { Skin } from './looks';

export type Pt = readonly [number, number];
type Pts = Record<string, readonly [number, number]>;

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------------
// Skin tones (GDD §9.0)
// ---------------------------------------------------------------------------------------------

/**
 * Skin tones (GDD §9.0: picked per spawn). Looks are rendered with `skinA`; the B and C looks
 * are recoloured copies (the skin ramp swapped pixel for pixel), so a skin variant costs a
 * fraction of a rig render. Only the skin ramp changes (no other art uses its colours).
 */
export function skinMap(skin: Skin): Map<Color, Color> {
  const to = skin === 'b' ? PAL.skinB : skin === 'c' ? PAL.skinC : PAL.skinA;
  const m = new Map<Color, Color>();
  PAL.skinA.forEach((c, i) => m.set(c, to[i]));
  return m;
}

/** A frame with its skin recoloured (see `skinMap`). */
export function reskin(f: Frame, map: ReadonlyMap<Color, Color>): Frame {
  return { buf: f.buf.clone().recolor(map), ox: f.ox, oy: f.oy, pts: f.pts };
}

// ---------------------------------------------------------------------------------------------
// Body frame: where the torso is in a rendered pose
// ---------------------------------------------------------------------------------------------

/** A rendered pose frame's body transform (body space → anchor-relative pixels). */
export interface Body {
  /** Pelvis, relative to the frame anchor. */
  hip: Pt;
  /** Body rotation in degrees (clockwise; 0 = upright, 90 = lying face-down head forward). */
  angle: number;
}

/** Angle of hip→head in an upright reference pose (the neck sits a little forward). */
const restAngles = new WeakMap<HumanStyle, number>();

function restAngle(style: HumanStyle): number {
  let a = restAngles.get(style);
  if (a === undefined) {
    const f = renderHuman(style, { legN: { hip: 20, knee: 14 }, legF: { hip: -16, knee: 10 } }, 'full');
    a = axisAngle(f.pts.hip, f.pts.head);
    restAngles.set(style, a);
  }
  return a;
}

function axisAngle(hip: Pt | undefined, head: Pt | undefined): number {
  if (!hip || !head) return 0;
  return Math.atan2(head[0] - hip[0], -(head[1] - hip[1])) / DEG;
}

/** The body transform of a rig frame (needs its `hip` and `head` points). */
export function bodyOf(style: HumanStyle, f: Frame, extraRot = 0): Body {
  const hip = f.pts?.hip ?? [0, -15];
  const head = f.pts?.head;
  let angle = axisAngle(hip, head) - restAngle(style) + extraRot;
  // Small tilts (breathing, a lean of a few degrees) keep the pieces upright and crisp.
  if (Math.abs(angle) < 5) angle = 0;
  return { hip, angle };
}

/** Body-space point → anchor-relative pixel (not rounded). */
export function toFrame(b: Body, p: Pt): [number, number] {
  const a = b.angle * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [b.hip[0] + p[0] * c - p[1] * s, b.hip[1] + p[0] * s + p[1] * c];
}

// ---------------------------------------------------------------------------------------------
// Shapes: instrument parts drawn in body space
// ---------------------------------------------------------------------------------------------

export interface Shape {
  /** 'tube' = thick polyline, 'poly' = filled polygon, 'disc' = filled circle, 'dots' = pixels. */
  kind: 'tube' | 'poly' | 'disc' | 'dots';
  pts: readonly Pt[];
  /** Tube width / disc radius (default 1). */
  w?: number;
  ramp: Ramp;
  shade?: ShadeOpts;
  /** One flat colour (no shading): bell interiors, bands, glints. */
  color?: Color;
  /** Painted without a ring onto the parts behind (small details). */
  detail?: boolean;
}

/** Working canvas: anchor-relative (0, 0) sits at (CX, CY). */
const CW = 128;
const CH = 128;
const CX = 64;
const CY = 88;

function rasterShape(L: PixelBuffer, s: Shape, b: Body, col: Color): void {
  const P = s.pts.map((p) => {
    const q = toFrame(b, p);
    return [Math.round(q[0] + CX), Math.round(q[1] + CY)] as [number, number];
  });
  const w = s.w ?? 1;
  if (s.kind === 'tube') {
    if (P.length === 1) L.circle(P[0][0], P[0][1], Math.max(0, Math.round((w - 1) / 2)), col, true);
    for (let i = 1; i < P.length; i++) {
      if (w <= 1) L.line(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], col);
      else L.thickLine(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], w, col);
    }
  } else if (s.kind === 'poly') {
    L.poly(P, col);
  } else if (s.kind === 'disc') {
    L.circle(P[0][0], P[0][1], Math.max(0, Math.round(w)), col, true);
  } else {
    for (const p of P) L.set(p[0], p[1], col);
  }
}

/** Rasterise shapes (back to front) into one outlined piece; null when nothing was drawn. */
export function drawShapes(shapes: readonly Shape[], b: Body, outline = true): Piece | null {
  const comp = new Composer(CW, CH);
  let any = false;
  for (const s of shapes) {
    const L = new PixelBuffer(CW, CH);
    rasterShape(L, s, b, s.color ?? FLAT);
    if (s.color === undefined) shadeLayer(L, s.ramp, s.shade ?? {});
    if (s.detail) comp.paint(L, s.ramp[0]);
    else comp.add(L, { ramp: s.ramp });
    any = true;
  }
  if (!any) return null;
  const buf = outline ? comp.finish(INK) : comp.buf;
  const t = buf.trimBounds();
  if (!t) return null;
  return { buf: buf.crop(t.x, t.y, t.w, t.h), x: t.x - CX, y: t.y - CY };
}

/** Pieces behind and in front of the figure. */
export interface Layers {
  back?: readonly Shape[];
  front?: readonly Shape[];
  /** Extra points in body space (e.g. a bell mouth as `muzzle`). */
  pts?: Readonly<Record<string, Pt>>;
}

/** Stack instrument layers onto a rig frame; body-space points become frame points. */
export function dress(f: Frame, b: Body, layers: Layers): Frame {
  const pieces: Piece[] = [];
  if (layers.back) {
    const p = drawShapes(layers.back, b);
    if (p) pieces.push({ ...p, behind: true });
  }
  if (layers.front) {
    const p = drawShapes(layers.front, b);
    if (p) pieces.push(p);
  }
  const pts: Pts = {};
  if (layers.pts) {
    for (const [k, v] of Object.entries(layers.pts)) {
      const q = toFrame(b, v);
      pts[k] = [Math.round(q[0]), Math.round(q[1])];
    }
  }
  return pieces.length > 0 || layers.pts ? withPieces(f, pieces, pts) : f;
}

// ---------------------------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------------------------

/** Polygon of an ellipse (centre, radii, rotation in degrees), `n` points. */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 16): Pt[] {
  const out: Pt[] = [];
  const a = rot * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** Arc of an ellipse from angle t0 to t1 (degrees, 0 = +x, clockwise on screen), as a path. */
export function arcPts(cx: number, cy: number, rx: number, ry: number, t0: number, t1: number, n = 10, rot = 0): Pt[] {
  const out: Pt[] = [];
  const a = rot * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let i = 0; i <= n; i++) {
    const t = (t0 + ((t1 - t0) * i) / n) * DEG;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/**
 * A flared bell (trumpet profile) from a throat at `at` pointing along `dir` degrees
 * (0 = forward, −90 = up): length `len`, throat half-height `r0`, mouth half-height `r1`.
 */
export function bellPts(at: Pt, dir: number, len: number, r0: number, r1: number, flare = 2.6): Pt[] {
  const a = dir * DEG;
  const fx = Math.cos(a);
  const fy = Math.sin(a);
  const nx = -fy;
  const ny = fx;
  const top: Pt[] = [];
  const bot: Pt[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = r0 + (r1 - r0) * Math.pow(t, flare);
    const px = at[0] + fx * len * t;
    const py = at[1] + fy * len * t;
    top.push([px + nx * r, py + ny * r]);
    bot.push([px - nx * r, py - ny * r]);
  }
  return [...top, ...bot.reverse()];
}

/** Offset a point list. */
export function shift(pts: readonly Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => [p[0] + dx, p[1] + dy] as Pt);
}

/** Rotate a point list about a centre (degrees, clockwise on screen). */
export function turn(pts: readonly Pt[], cx: number, cy: number, deg: number): Pt[] {
  const a = deg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map((p) => {
    const x = p[0] - cx;
    const y = p[1] - cy;
    return [cx + x * c - y * s, cy + x * s + y * c] as Pt;
  });
}

// ---------------------------------------------------------------------------------------------
// Rendering a pose with its instrument
// ---------------------------------------------------------------------------------------------

/** A pose plus instrument instructions read by the type's dresser. */
export type WPose<I> = Pose & { inst?: I; fx?: FrameFx };

/** Post effects on a whole frame. */
export interface FrameFx {
  /** Widen the torso rows by this many px (the oompah's inhale). */
  puff?: number;
  /** Scorch steps (explosion deaths). */
  scorch?: number;
}

/** Render a figure (full body) and dress it. */
export function renderDressed<I>(style: HumanStyle, pose: WPose<I>, dresser: (f: Frame, b: Body, p: WPose<I>) => Frame, extraRot = 0): Frame {
  const f = renderHuman(style, pose, 'full');
  const b = bodyOf(style, f, extraRot);
  let out = dresser(f, b, pose);
  if (pose.fx?.puff) out = puff(out, b, pose.fx.puff);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Frame effects
// ---------------------------------------------------------------------------------------------

/**
 * Inflate the torso: rows from the waist to the shoulders get `n` px wider (half each side,
 * tapering at the ends), by duplicating the centre column of every row (outlines stay intact).
 */
export function puff(f: Frame, b: Body, n: number): Frame {
  if (n <= 0) return f;
  const src = f.buf;
  const out = new PixelBuffer(src.w + n * 2, src.h);
  const cx = f.ox + Math.round(b.hip[0]);
  const top = f.oy + Math.round(b.hip[1]) - 13;
  const bot = f.oy + Math.round(b.hip[1]) + 1;
  for (let y = 0; y < src.h; y++) {
    // Full puff in the middle rows, half at the ends.
    let k = 0;
    if (y >= top && y <= bot) k = y - top < 2 || bot - y < 2 ? Math.ceil(n / 2) : n;
    const left = Math.floor(k / 2);
    const right = k - left;
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if ((c & 255) === 0) continue;
      if (x < cx) out.set(x + n - left, y, c);
      else if (x > cx) out.set(x + n + right, y, c);
      else for (let d = -left; d <= right; d++) out.set(x + n + d, y, c);
    }
  }
  return { buf: out, ox: f.ox + n, oy: f.oy, pts: f.pts };
}

/** Luma of a colour (0..255). */
function luma(c: Color): number {
  return (((c >>> 24) & 255) * 299 + ((c >>> 16) & 255) * 587 + ((c >>> 8) & 255) * 114) / 1000;
}

/** Ice tones by brightness (frozen figures): deep sky → white. */
const ICE: readonly Color[] = [PAL.navy[1], PAL.sky[1], PAL.sky[2], PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]];

/** Recolour a frame in ice tones (outline kept). */
export function frost(f: Frame): Frame {
  const b = f.buf.clone();
  const d = b.data;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if ((c & 255) === 0 || c === INK) continue;
    const l = luma(c);
    d[i] = ICE[Math.min(ICE.length - 1, Math.floor((l / 256) * ICE.length * 1.15))];
  }
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/**
 * The figure frozen in a block of ice (the sundae-mortar `freeze` reaction): frosted figure, a
 * translucent-looking block (light rim, glints, a few frost specks), feet on the ground line.
 */
export function iceBlock(f: Frame, crack = 0): Frame {
  const fig = frost(f);
  const fb = fig.buf.trimBounds() ?? { x: 0, y: 0, w: fig.buf.w, h: fig.buf.h };
  const pad = 2;
  const w = fb.w + pad * 2 + 2;
  const h = fb.h + pad + 2;
  const out = new PixelBuffer(w, h);
  // Block body: pale ice with a lit top-left band.
  out.rect(1, 1, w - 2, h - 2, PAL.snow[1]);
  for (let x = 1; x < w - 1; x++) out.set(x, 1, PAL.snow[3]);
  for (let y = 1; y < h - 1; y++) out.set(1, y, PAL.snow[3]);
  for (let x = 1; x < w - 1; x++) out.set(x, h - 2, PAL.snow[0]);
  for (let y = 1; y < h - 1; y++) out.set(w - 2, y, PAL.snow[0]);
  // The frozen figure inside (its outline turns deep blue: seen through the ice).
  const ix = 1 + pad - fb.x + 1;
  const iy = h - 1 - (fig.buf.h - 0) + (fig.buf.h - (fb.y + fb.h));
  out.blit(fig.buf, ix, iy, { map: (c) => (c === INK ? PAL.navy[1] : c) });
  // Glints and specks.
  out.set(3, 3, PAL.snow[3]);
  out.set(4, 3, PAL.snow[3]);
  out.set(3, 4, PAL.snow[3]);
  for (let i = 0; i < 6; i++) {
    const x = 2 + Math.floor(hash2(i, 3, 41) * (w - 4));
    const y = 2 + Math.floor(hash2(i, 7, 41) * (h - 4));
    out.set(x, y, PAL.snow[3]);
  }
  if (crack > 0) {
    // Crack lines spreading from the middle.
    const cx = w >> 1;
    const cy = h >> 1;
    for (let k = 0; k < 3 + crack * 2; k++) {
      const ang = hash2(k, 1, 77) * Math.PI * 2;
      const len = 4 + hash2(k, 2, 77) * (crack * 6);
      out.line(cx, cy, Math.round(cx + Math.cos(ang) * len), Math.round(cy + Math.sin(ang) * len), PAL.navy[1]);
    }
  }
  out.outline(INK);
  const big = out.padded(1).outline(INK);
  // Feet anchor: the block stands on the ground line.
  const anchorX = ix + f.ox + 1;
  return { buf: big, ox: anchorX, oy: big.h, pts: f.pts };
}

/**
 * Flattened like a pancake (crush deaths): squashed to `hFrac` of its height and `wFrac` wider,
 * still standing on the ground line. `lift` raises one end (peeling off the ground, 0..1).
 */
export function pancake(f: Frame, hFrac: number, wFrac: number, lift = 0, rot = 0): Frame {
  const t = f.buf.trimBounds();
  if (!t) return f;
  const src = f.buf.crop(t.x, t.y, t.w, t.h);
  const nw = Math.max(3, Math.round(t.w * wFrac));
  const nh = Math.max(3, Math.round(t.h * hFrac));
  let b = src.resized(nw, nh).padded(2);
  // Re-outline (nearest-neighbour scaling can thin the edges).
  b = b.outline(INK);
  if (lift > 0) b = b.padded(0, Math.ceil(lift * 6), 0, 0).rotated(-lift * 0.5);
  if (rot !== 0) b = b.padded(4).rotated(rot * DEG);
  const tb = b.trimBounds() ?? { x: 0, y: 0, w: b.w, h: b.h };
  const out = b.crop(tb.x, tb.y, tb.w, tb.h);
  return { buf: out, ox: out.w >> 1, oy: out.h + (rot !== 0 ? 6 : 0) };
}

/** Pile of ice cubes on the ground line (shatter deaths): `n` cubes spread over `spread` px. */
export function iceCubes(n: number, spread: number, seed: number, height = 0): Frame {
  const w = spread + 8;
  const h = 8 + height;
  const out = new PixelBuffer(w + 2, h + 2);
  for (let i = 0; i < n; i++) {
    const s = 3 + Math.floor(hash2(i, seed, 5) * 2);
    const x = 1 + Math.floor(hash2(i, seed, 9) * (w - s - 1));
    const y = h + 1 - s - Math.floor(hash2(i, seed, 13) * height * (i % 2 === 0 ? 1 : 0.4));
    out.rect(x, y, s, s, PAL.snow[1]);
    out.set(x, y, PAL.snow[3]);
    out.set(x + s - 1, y + s - 1, PAL.snow[0]);
  }
  out.outline(INK);
  return { buf: out, ox: out.w >> 1, oy: out.h };
}

/** Cartoon soot: every colour darkened toward ink by brightness (keeps the eyes white). */
export function soot(f: Frame, eyes: Pt | null = null): Frame {
  const SOOT: readonly Color[] = [PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.stone[0]];
  const b = f.buf.clone();
  const d = b.data;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if ((c & 255) === 0 || c === INK) continue;
    const l = luma(c);
    d[i] = SOOT[l < 60 ? 0 : l < 110 ? 1 : l < 170 ? 2 : 3];
  }
  if (eyes) {
    const ex = f.ox + Math.round(eyes[0]);
    const ey = f.oy + Math.round(eyes[1]);
    if ((b.get(ex, ey) & 255) !== 0) b.set(ex, ey, PAL.snow[3]);
    if ((b.get(ex + 2, ey) & 255) !== 0) b.set(ex + 2, ey, PAL.snow[3]);
  }
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** A frame shifted by (dx, dy) without changing its anchor (hops, bobs). */
export function nudge(f: Frame, dx: number, dy: number): Frame {
  return { buf: f.buf, ox: f.ox - dx, oy: f.oy - dy, pts: f.pts ? movePts(f.pts, dx, dy) : undefined };
}

function movePts(p: Readonly<Pts>, dx: number, dy: number): Pts {
  const o: Pts = {};
  for (const [k, v] of Object.entries(p)) o[k] = [v[0] + dx, v[1] + dy];
  return o;
}

/** Add points to a frame (anchor-relative). */
export function withPts(f: Frame, pts: Readonly<Pts>): Frame {
  return { buf: f.buf, ox: f.ox, oy: f.oy, pts: { ...(f.pts ?? {}), ...pts } };
}

/** Paste extra pixel art (already outlined) onto a frame at an anchor-relative position. */
export function stamp(f: Frame, art: PixelBuffer, x: number, y: number, behind = false): Frame {
  return withPieces(f, [{ buf: art, x, y, behind }]);
}

/** A small INK-outlined bubble (snore / thought) of radius r. */
export function bubbleArt(r: number): PixelBuffer {
  const b = new PixelBuffer(r * 2 + 3, r * 2 + 3);
  b.circle(r + 1, r + 1, r, PAL.snow[2], true);
  if (r >= 2) b.set(r, r - 0, PAL.snow[3]);
  b.set(r + 1 - Math.max(1, r - 1), r + 1 - Math.max(1, r - 1) + 1, PAL.snow[3]);
  return b.outline(INK);
}

/** Tiny music note (eighth note), gold with an INK outline. */
export function noteArt(flip = false): PixelBuffer {
  const b = new PixelBuffer(8, 9);
  const g = PAL.gold;
  // Stem, flag and head.
  b.vline(4, 1, 5, g[2]);
  b.set(5, 1, g[3]);
  b.set(6, 2, g[2]);
  b.set(6, 3, g[1]);
  b.rect(2, 5, 3, 2, g[2]);
  b.set(2, 5, g[3]);
  b.set(4, 6, g[1]);
  const out = b.outline(INK);
  return flip ? out.flipped(true, false) : out;
}

/** Dizzy stars ring (2 phases), for stunned frames. */
export function starsArt(phase: number): PixelBuffer {
  const b = new PixelBuffer(15, 7);
  const pos: Pt[] = phase === 0 ? [[2, 3], [7, 1], [12, 3]] : [[4, 1], [9, 4], [12, 1]];
  for (const [x, y] of pos) {
    b.set(x, y, PAL.gold[3]);
    b.set(x - 1, y, PAL.gold[2]);
    b.set(x + 1, y, PAL.gold[2]);
    b.set(x, y - 1, PAL.gold[2]);
    b.set(x, y + 1, PAL.gold[2]);
  }
  return b.outline(INK);
}

/** A coin held up in the JINGLE queue (4×4 gold disc). */
export function coinArt(): PixelBuffer {
  const b = new PixelBuffer(6, 6);
  b.circle(2, 2, 2, PAL.gold[2], true);
  b.set(1, 1, PAL.gold[3]);
  b.set(3, 3, PAL.gold[1]);
  return b.outline(INK);
}

/** Small exclamation / question glyph above a head (in-frame comedy marks). */
export function markArt(kind: '?' | '!' | 'z'): PixelBuffer {
  const rows =
    kind === '?'
      ? ['.ww.', 'w..w', '...w', '..w.', '.w..', '....', '.w..']
      : kind === '!'
        ? ['w', 'w', 'w', 'w', '.', 'w']
        : ['wwww', '..w.', '.w..', 'wwww'];
  const b = new PixelBuffer(rows[0].length + 2, rows.length + 2);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === 'w') b.set(x + 1, y + 1, PAL.snow[3]);
  });
  return b.outline(INK);
}

export { TRANSPARENT };
