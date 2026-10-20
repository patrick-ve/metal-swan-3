/**
 * HUD and menu icons (GDD §13, §15.6; docs/ARCHITECTURE.md §7.1). All top-left anchored.
 *
 * - `ui/icon-life`     a 6×6 SWAN-3 head (+ ink outline): ivory dome, gold lens eye, navy face
 *                      patch, orange beak (docs/design/swan-mount/look.md §5.7)
 * - `ui/swan-marker`   the same head outlined in the rider's colour (frame 0 P1 sky, 1 P2 gold)
 *                      and ink outside (GDD §13.7 Swan marker)
 * - `ui/cursor-swan`   the menu cursor: her head and the top of her neck, facing right
 * - `ui/icon-cell`     a vehicle HP cell 8×5: 0 empty, 1 half, 2 full, 3 half red, 4 full red
 * - `ui/onward`        three gold chevrons: frame 0 right, 1 left, 2 up, 3 down
 * - `ui/star`          a tally rating star
 * - `ui/icon-balloon`  the Helium Head status icon (a party balloon)
 * - `ui/ride`          a ready-made RIDE? bubble, anchored at its tail tip (GDD §8.1)
 * - `ui/bubble`        a small empty speech bubble (the pause gag's snore)
 *
 * HD (UHD wave, 2× and 4×): every id above has a density-generic drawer (`hd` of its
 * registration) with the 1× geometry, PAL_HD only, outline A where the 1× art has its ink
 * outline: the head in ivory enamel with a gold lens eye, a navy face patch and an orange beak;
 * glossy HP cells in a recessed trough; bevelled gold chevrons and a faceted star; a latex
 * balloon; smooth speech bubbles with the HD glyphs (the bubble painters of hud.ts, which also
 * paints the HD timer frame, bars and the special-ready gem the 1× HUD draws as rects).
 */
import { ascii, type AsciiKey } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { drawText, measure } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, type DenseDensity } from '../../../engine/sprites';
import { HdCanvas, inPoly, polyDist } from '../../art/hd/index';
import { bubbleBoxHd, bubbleTailHd, glossTone, paintHd, sdBox } from '../../hud';
import { hdRampOf, ICON_RENDER, paintIcon } from '../weapons/icons.art';

const topLeft = { anchor: 'top-left' as const };

/** Her head colours (look.md §4): ivory enamel, gold lens ring, navy face patch, orange beak. */
const HEAD: AsciiKey = {
  W: PAL.snow[3],
  w: PAL.snow[2],
  v: PAL.snow[1],
  g: PAL.gold[2],
  k: INK,
  n: PAL.navy[0],
  O: PAL.orange[3],
  o: PAL.orange[2],
  s: PAL.steel[3],
};

/** The 6×6 head: dome top-left lit, lens eye, navy patch from the eye to the beak base. */
const HEAD_6 = ['.WWw..', 'WWgnOo', 'WWwnos', 'wWwv..', '.Ww...', '.wv...'];

function head6(): PixelBuffer {
  return ascii(HEAD_6, HEAD);
}

function lifeFrames(): Frame[] {
  return [{ buf: head6().padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** The head outlined in the rider's colour, then in ink (readable on sky and snow). */
function markerFrames(): Frame[] {
  return [PAL.sky[3], PAL.gold[3]].map((c) => ({ buf: head6().padded(2).outline(c).outline(INK), ox: 0, oy: 0 }));
}

/** The cursor: a bigger head with a lens eye and a bit of neck, pointing right at the item. */
function cursorFrames(): Frame[] {
  const b = ascii(['..WWW....', '.WWWWw...', 'WWgkWnOO.', 'WWwgnoOos', '.wWWv....', '..Ww.....', '.Ww......', '.wv......'], HEAD);
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** HP cells: an 8×5 cell inside an ink frame (10×7). */
function cellFrames(): Frame[] {
  const out: Frame[] = [];
  const fills: readonly (readonly [number, Color, Color, Color] | null)[] = [
    null,
    [4, PAL.snow[3], PAL.snow[1], PAL.snow[3]],
    [8, PAL.snow[3], PAL.snow[1], PAL.snow[3]],
    [4, PAL.red[3], PAL.red[1], PAL.red[3]],
    [8, PAL.red[3], PAL.red[1], PAL.red[3]],
  ];
  for (const f of fills) {
    const b = new PixelBuffer(10, 7).fill(INK);
    b.rect(1, 1, 8, 5, PAL.navy[0]);
    if (f) {
      const [w, base, shade, lit] = f;
      b.rect(1, 1, w, 5, base);
      b.rect(1, 5, w, 1, shade);
      b.rect(1, 1, w, 1, lit);
      if (w === 4) b.rect(5, 1, 1, 5, INK);
    }
    out.push({ buf: b, ox: 0, oy: 0 });
  }
  return out;
}

/** Three chevrons pointing right (4×7 each, 2 px apart), then the same turned left, up and down. */
function onwardFrames(): Frame[] {
  const row = ['G..', 'gG.', '.gG', '..g', '.gG', 'gG.', 'G..'];
  const right = ascii(row.map((r) => `${r}..${r}..${r}`), { G: PAL.gold[3], g: PAL.gold[2] });
  const left = right.flipped(true, false);
  // Up / down: transpose the right-pointing strip.
  const down = new PixelBuffer(right.h, right.w);
  for (let y = 0; y < right.h; y++) for (let x = 0; x < right.w; x++) down.set(y, x, right.get(x, y));
  const up = down.flipped(false, true);
  return [right, left, up, down].map((b) => ({ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }));
}

/** A five-point gold star (tally ratings), lit from the top left. */
function starFrames(): Frame[] {
  const b = ascii(['....W....', '...GGg...', 'WGGGGGGgg', '.GGGGGgg.', '..GGgGg..', '.GGg.Ggg.', 'Gg.....gg'], {
    W: PAL.gold[3],
    G: PAL.gold[3],
    g: PAL.gold[2],
  });
  b.set(4, 0, PAL.snow[3]);
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** A pink party balloon on a string (Helium Head). */
function balloonFrames(): Frame[] {
  const b = ascii(['.PPP.', 'PpPPP', 'PPPPP', 'PPPPq', '.PPq.', '..s..', '..w..', '.w...', '..w..'], {
    P: PAL.pink[2],
    p: PAL.snow[3],
    q: PAL.pink[1],
    s: PAL.pink[1],
    w: PAL.stone[3],
  });
  return [{ buf: b.padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** A speech bubble with `text` (small font, ink on white), anchored at the tip of its 3 px tail. */
export function bubbleFrame(text: string, fill: Color = PAL.snow[3], ink: Color = INK): Frame {
  const tw = measure(text, 'small');
  const w = Math.max(11, tw + 7);
  const h = 12;
  const b = new PixelBuffer(w + 2, h + 6);
  // Rounded box with an ink edge, then the tail at the middle of the bottom edge.
  b.rect(2, 0, w - 2, h + 2, INK).rect(0, 2, w + 2, h - 2, INK).rect(1, 1, w, h, INK);
  b.rect(2, 1, w - 2, h, fill).rect(1, 2, w, h - 2, fill);
  const tx = (w + 2) >> 1;
  b.rect(tx - 1, h + 1, 3, 1, fill);
  b.set(tx, h + 2, fill);
  for (const [x, y] of [[-2, 1], [-2, 2], [2, 1], [2, 2], [-1, 2], [1, 2], [0, 3]] as const) b.set(tx + x, h + y, INK);
  drawText(b, text, tx, 3, { font: 'small', color: ink, align: 'center' });
  return { buf: b, ox: tx, oy: h + 3 };
}

/** A small empty bubble for thoughts and snores ('Z' drawn by the scene). */
function smallBubble(): Frame[] {
  const b = ascii(['.kkkkk.', 'kWWWWWk', 'kWWWWWk', 'kWWWWWk', '.kkkkk.', '..kWk..', '...k...'], { k: INK, W: PAL.snow[3] });
  return [{ buf: b, ox: 3, oy: 6 }];
}

/** Register the HUD and menu icons (called again after content loads so these ids win). */
export function defineHudArt(): void {
  defineSprite('ui/icon-life', lifeFrames, { ...topLeft, hd: (d) => [hdTL(paintIcon(8, 8, d, (c) => swanHead(c, LIFE_HEAD)), d)] });
  defineSprite('ui/swan-marker', markerFrames, { ...topLeft, hd: markerHd });
  defineSprite('ui/cursor-swan', cursorFrames, { ...topLeft, hd: (d) => [hdTL(paintIcon(11, 10, d, (c) => swanHead(c, CURSOR_HEAD)), d)] });
  defineSprite('ui/icon-cell', cellFrames, { ...topLeft, hd: cellHd });
  defineSprite('ui/onward', onwardFrames, { ...topLeft, hd: onwardHd });
  defineSprite('ui/star', starFrames, { ...topLeft, hd: (d) => [hdTL(paintIcon(11, 9, d, drawStar), d)] });
  defineSprite('ui/icon-balloon', balloonFrames, { ...topLeft, hd: (d) => [hdTL(paintIcon(7, 11, d, drawBalloon), d)] });
  defineSprite('ui/ride', () => [bubbleFrame('RIDE?')], { hd: (d) => [bubbleFrameHd('RIDE?', d)] });
  defineSprite('ui/bubble', smallBubble, { hd: (d) => [{ buf: smallBubbleHd(d), ox: 3, oy: 6, density: d }] });
}

// ---------------------------------------------------------------------------------------------
// HD (2× and 4×)
// ---------------------------------------------------------------------------------------------

/** A top-left anchored HD frame. */
function hdTL(buf: PixelBuffer, d: number): Frame {
  return { buf, ox: 0, oy: 0, density: d };
}

/** The swan head layout of one icon (logical px of its frame). */
interface HeadSpec {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  /** Neck from (n0) to (n1), radius r0 → r1. */
  readonly neck: readonly [number, number, number, number, number, number];
  /** Eye centre and lens ring radius. */
  readonly eye: readonly [number, number, number];
  /** Beak polygon (pointing right). */
  readonly beak: ReadonlyArray<readonly [number, number]>;
  /** Navy face patch polygon (eye to beak base). */
  readonly patch: ReadonlyArray<readonly [number, number]>;
}

const LIFE_HEAD: HeadSpec = {
  cx: 3.3,
  cy: 3.05,
  rx: 2.25,
  ry: 2.05,
  neck: [3.2, 4.6, 2.9, 6.15, 0.95, 0.8],
  eye: [3.55, 2.65, 0.72],
  beak: [[4.9, 2.0], [6.95, 2.45], [6.95, 3.05], [5.7, 3.85], [4.9, 3.95]],
  patch: [[3.9, 2.0], [5.2, 2.0], [5.2, 4.0], [4.2, 4.2], [3.7, 3.3]],
};

const CURSOR_HEAD: HeadSpec = {
  cx: 4.0,
  cy: 3.6,
  rx: 2.95,
  ry: 2.55,
  neck: [3.9, 5.5, 3.0, 8.05, 1.1, 0.88],
  eye: [4.15, 3.75, 0.9],
  beak: [[6.5, 2.95], [9.9, 3.55], [9.95, 4.3], [8.2, 5.0], [6.5, 5.05]],
  patch: [[4.7, 2.8], [6.9, 2.8], [6.9, 5.1], [5.4, 5.3], [4.6, 4.4]],
};

/** Her head: an ivory enamel dome and neck, the navy face patch, the gold lens eye, the orange beak. */
function swanHead(c: HdCanvas, h: HeadSpec): void {
  const fine = c.d >= 4;
  const enamel = c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, spec: 1, shine: 30, gain: 1.05, wrap: 0.05 });
  const navy = c.material({ ramp: PAL_HD.navy, lo: 1, hi: 4, spec: 0.8, shine: 26 });
  const gold = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 30, rim: 0.4 });
  const beak = c.material({ ramp: PAL_HD.orange, lo: 1, hi: 5, spec: 0.6, shine: 22, wrap: 0.05 });
  const [n0x, n0y, n1x, n1y, r0, r1] = h.neck;
  const skin = c.newPart();
  c.capsule(n0x, n0y, n1x, n1y, r0, r1, { mat: enamel, z: 0, part: skin, tone: -0.1 });
  c.ellipsoid(h.cx, h.cy, h.rx, h.ry, { mat: enamel, z: 0.2, part: skin });
  c.poly(h.beak, { mat: beak, z: 0.6 });
  // The lower mandible a tone darker, the nostril at 4×.
  const by = (h.beak[0][1] + h.beak[h.beak.length - 1][1]) / 2 + 0.15;
  c.shade(h.beak[0][0], by, 6, 3, () => -0.35);
  c.poly(h.patch, { mat: navy, z: 3 });
  const [ex, ey, er] = h.eye;
  c.ellipsoid(ex, ey, er, er, { mat: gold, z: 3.4 });
  // The lens: deep navy glass with a catchlight (upper left).
  c.paint(ex - er, ey - er, 2 * er, 2 * er, (px, py) => {
    const r = Math.hypot(px - ex, py - ey);
    if (r > er * 0.55) return 0;
    if (px < ex - er * 0.05 && py < ey - er * 0.05 && r < er * 0.4) return fine || r < er * 0.3 ? PAL_HD.snow[6] : 0;
    return PAL_HD.navy[0];
  });
  if (fine) {
    const [bx, bty] = h.beak[1];
    c.dot(bx - 1.2, bty + 0.2, PAL_HD.orange[0]);
  }
}

/**
 * Grow `src` by a ring `d` art px wide (one logical px, the pen of outline A): lit tone on the
 * upper-left side, `dark` on the lower-right, `mid` between.
 */
function ring(src: PixelBuffer, d: number, lit: Color, mid: Color, dark: Color): PixelBuffer {
  const out = src.clone();
  const pen: [number, number][] = [];
  for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (dx * dx + dy * dy <= d * d + d * 0.5) pen.push([dx, dy]);
  for (let Y = 0; Y < src.h; Y++) {
    for (let X = 0; X < src.w; X++) {
      if ((src.data[Y * src.w + X] & 255) !== 0) continue;
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const [dx, dy] of pen) {
        const x = X + dx;
        const y = Y + dy;
        if (x < 0 || y < 0 || x >= src.w || y >= src.h || (src.data[y * src.w + x] & 255) === 0) continue;
        sx += dx;
        sy += dy;
        n++;
      }
      if (n === 0) continue;
      // The shape lies towards (sx, sy): down-right of this px = the lit (upper-left) side.
      const t = (sx + sy) / n;
      out.data[Y * src.w + X] = (t > 0.35 * d ? lit : t < -0.35 * d ? dark : mid) >>> 0;
    }
  }
  return out.touch();
}

/** The Swan marker: her head, a ring in the rider's colour (P1 sky, P2 gold), then ink. */
function markerHd(d: DenseDensity): Frame[] {
  const spec: HeadSpec = {
    ...LIFE_HEAD,
    cx: LIFE_HEAD.cx + 1,
    cy: LIFE_HEAD.cy + 1,
    neck: [LIFE_HEAD.neck[0] + 1, LIFE_HEAD.neck[1] + 1, LIFE_HEAD.neck[2] + 1, LIFE_HEAD.neck[3] + 1, LIFE_HEAD.neck[4], LIFE_HEAD.neck[5]],
    eye: [LIFE_HEAD.eye[0] + 1, LIFE_HEAD.eye[1] + 1, LIFE_HEAD.eye[2]],
    beak: LIFE_HEAD.beak.map(([x, y]) => [x + 1, y + 1] as const),
    patch: LIFE_HEAD.patch.map(([x, y]) => [x + 1, y + 1] as const),
  };
  const c = new HdCanvas(10, 10, d);
  swanHead(c, spec);
  const head = c.render({ ...ICON_RENDER, outline: 'none' });
  return [PAL.sky[3], PAL.gold[3]].map((col) => {
    const ramp = hdRampOf(col, PAL_HD.sky);
    const i = Math.max(1, Math.min(ramp.length - 2, ramp.indexOf(col) < 0 ? ramp.length - 3 : ramp.indexOf(col)));
    const rider = ring(head, d, ramp[i + 1], ramp[i], ramp[i - 1]);
    return hdTL(ring(rider, d, PAL_HD.ink[0], PAL_HD.ink[0], PAL_HD.ink[0]), d);
  });
}

/** HP cells: a recessed navy trough in an ink frame, a glossy snow or crimson charge (half: an ink divider). */
function cellHd(d: DenseDensity): Frame[] {
  const kinds: readonly (readonly [number, Ramp] | null)[] = [null, [4, PAL_HD.snow], [8, PAL_HD.snow], [4, PAL_HD.red], [8, PAL_HD.red]];
  return kinds.map((k) => {
    const buf = paintHd(10, 7, d, (x, y) => {
      if (sdBox(x, y, 0, 0, 10, 7, 0.6) > 0) return 0;
      if (x < 1 || x > 9 || y < 1 || y > 6) return PAL_HD.ink[0];
      if (k && x < 1 + k[0]) return glossTone(k[1], (y - 1) / 5, x - 1, k[0], d);
      if (k && k[0] === 4 && x < 6) return PAL_HD.ink[0];
      // The trough: its top lip throws a shadow, its lower lip catches light.
      if (y < 1 + 1 / d) return PAL_HD.navy[0];
      if (y > 6 - 1 / d) return PAL_HD.navy[2];
      return PAL_HD.navy[1];
    });
    return hdTL(buf, d);
  });
}

/** Three bevelled gold chevrons: frame 0 right, 1 left, 2 up, 3 down (the 1× geometry). */
function onwardHd(d: DenseDensity): Frame[] {
  // One chevron pointing right in its 3 × 7 cell.
  // Both edges at a 2 : 1 slope: even stair steps at 2× and 4×.
  const cell: [number, number][] = [[0, 0], [1.25, 0], [3, 3.5], [1.25, 7], [0, 7], [1.75, 3.5]];
  const tf: ((p: readonly [number, number]) => [number, number])[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [15 - x, y],
    ([x, y]) => [y, 15 - x],
    ([x, y]) => [y, x],
  ];
  return tf.map((f, i) => {
    const w = i < 2 ? 15 : 9;
    const h = i < 2 ? 9 : 15;
    return hdTL(paintIcon(w, h, d, (c) => {
      const gold = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.8, shine: 30, rim: 0.4, gain: 1.05, wrap: 0.1 });
      for (let k = 0; k < 3; k++) {
        const pts = cell.map(([x, y]) => f([1 + k * 5 + x, 1 + y]));
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const [x, y] of pts) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        c.heightField(x0, y0, x1 - x0, y1 - y0, (x, y) => (inPoly(x, y, pts) ? Math.min(0.3, polyDist(x, y, pts)) * 0.8 : NaN), { mat: gold, z: 0 });
      }
    }), d);
  });
}

/** A five-point gold star with a facet per half arm (a low pyramid) and a glint on the top point. */
function drawStar(c: HdCanvas): void {
  const gold = c.material({ ramp: PAL_HD.gold, lo: 1, hi: 6, spec: 1, shine: 34, rim: 0.4, gain: 1.15 });
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 1 : 0.42;
    pts.push([5.5 + Math.cos(a) * 4.5 * r, 4.95 + Math.sin(a) * 3.85 * r]);
  }
  c.heightField(1, 1, 9, 8, (x, y) => (inPoly(x, y, pts) ? polyDist(x, y, pts) * 0.9 : NaN), { mat: gold, z: 0 });
  c.dot(5.5, 1.6, PAL_HD.snow[6]);
  if (c.d >= 4) {
    c.dot(5.5, 1.35, PAL_HD.gold[7]);
    c.dot(5.25, 1.6, PAL_HD.gold[7]);
    c.dot(5.75, 1.6, PAL_HD.gold[7]);
  }
}

/** A pink latex balloon with a soft window highlight, its knot and a curly string. */
function drawBalloon(c: HdCanvas): void {
  const fine = c.d >= 4;
  const latex = c.material({ ramp: PAL_HD.pink, lo: 1, hi: 5, spec: 1, shine: 40, gain: 1.05, wrap: 0.1 });
  const str = c.material({ ramp: PAL_HD.stone, lo: 3, hi: 6, spec: 0.2 });
  c.stroke([[3.5, 6.6], [2.75, 7.7], [3.3, 8.7], [2.9, 9.7]], 0.24, 0.22, { mat: str, z: 0 });
  c.poly([[3.5, 6.0], [4.2, 6.95], [2.8, 6.95]], { mat: latex, z: 0.4, tone: -0.4 });
  // The body: a little narrower at the bottom (an egg).
  c.heightField(1, 1, 5, 6, (x, y) => {
    const v = (y - 3.65) / 2.6;
    const rx = 2.45 * (1 - 0.12 * Math.max(0, v));
    const u = (x - 3.5) / rx;
    const e = u * u + v * v;
    return e > 1 ? NaN : 1.3 * Math.sqrt(1 - e);
  }, { mat: latex, z: 1 });
  // The window reflection: a soft white oval upper left.
  c.paint(1.8, 1.6, 2, 2, (px, py) => {
    const e = ((px - 2.65) / (fine ? 0.42 : 0.5)) ** 2 + ((py - 2.45) / (fine ? 0.7 : 0.5)) ** 2;
    return e <= 1 ? PAL_HD.pink[6] : 0;
  });
}

/** `bubbleFrame` at density d: the same geometry, the HD box and tail, the HD glyphs. */
export function bubbleFrameHd(text: string, d: number, fill: Color = PAL_HD.snow[6], ink: Color = INK): Frame {
  const tw = measure(text, 'small');
  const w = Math.max(11, tw + 7);
  const h = 12;
  const tx = (w + 2) >> 1;
  const b = new PixelBuffer((w + 2) * d, (h + 6) * d);
  b.blit(bubbleBoxHd(w + 2, h + 2, d, fill, INK), 0, 0);
  b.blit(bubbleTailHd(d, fill, INK), (tx - 2) * d, (h + 1) * d);
  drawText(b, text, tx, 3, { font: 'small', color: ink, align: 'center' }, d);
  return { buf: b, ox: tx, oy: h + 3, density: d };
}

/** The small thought / snore bubble (7 × 7, anchored at (3, 6)): an ink-edged oval with a tail. */
function smallBubbleHd(d: number): PixelBuffer {
  const fill = PAL_HD.snow[6];
  const shade = PAL_HD.snow[5];
  const tail: [number, number][] = [[2.2, 4.0], [4.8, 4.0], [3.5, 7.0]];
  return paintHd(7, 7, d, (x, y) => {
    const e = Math.hypot((x - 3.5) / 3.5, (y - 2.5) / 2.5);
    const inTail = inPoly(x, y, tail);
    if (e > 1 && !inTail) return 0;
    // One logical px of ink round the oval (and the tail), the fill inside.
    const ei = Math.hypot((x - 3.5) / 2.5, (y - 2.5) / 1.5);
    const tailIn = inTail && polyDist(x, y, tail) > 0.8 && y < 6;
    if (ei <= 1 || tailIn) return y > 3.3 ? shade : fill;
    return INK;
  });
}
