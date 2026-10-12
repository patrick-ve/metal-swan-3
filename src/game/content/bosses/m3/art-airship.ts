/**
 * THE WINDBAG — the airship's pixel art (GDD §10.3, §15.6). Procedural, palette only, lit from
 * the top-left, drawn FACING LEFT (the chanter and the gondola's bow point at the players; the
 * airship never flips). Geometry: `layout.ts`.
 *
 * - `boss/windbag/bag-0|1|2`        the patched red-and-gold tartan bag (centre anchor): frames
 *                                    rest, swell, big swell (the Gust telegraph)
 * - `boss/windbag/drone-N-0|1|2`    drone pipe N = 1..3 (anchor = its base on the bag): frame 0;
 *                                    `-2` adds frame 1 = the broken stump
 * - `boss/windbag/chanter-0|1|2`    the chanter (anchor = its top centre); `-2` adds frame 1 = stump
 * - `boss/windbag/gondola`          the wooden gondola (anchor = top centre): 0 hatch shut, 1 open
 * - `boss/windbag/prop`             the pusher propeller (centre), 4 frames
 * - `boss/windbag/leak`             the popped patch flapping over the leak (centre), 2 frames
 * - `boss/windbag/deflate`          the bag going down (death), 5 frames, smaller and smaller
 * - `boss/windbag/peak-rag`         a far-off peak with the empty bag wrapped round its tip
 */
import type { Color } from '../../../../engine/color';
import { bayer4, PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { damage } from '../../../art/machines';
import { BAG, CHANTER, DRONE, DRONES, GONDOLA } from './layout';

const DEG = Math.PI / 180;

/** Ordered-dither threshold 0..1. */
const bay = (x: number, y: number): number => bayer4(x, y) / 16;

/** Small deterministic hash (art only). */
function hash(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------------------------- tartan

/** Tartan sett: which ramp and shade a point of the cloth has (before lighting). */
function sett(sx: number, sy: number, alt: boolean): [readonly Color[], number] {
  const P = 22;
  const mx = ((Math.floor(sx) % P) + P) % P;
  const my = ((Math.floor(sy) % P) + P) % P;
  if (alt) {
    // Patch cloth: a navy-and-green check.
    const bx = mx < 8;
    const by = my < 8;
    if (mx === 14 || my === 14) return [PAL.gold, 1];
    return bx && by ? [PAL.navy, 0] : bx || by ? [PAL.green, 1] : [PAL.green, 2];
  }
  // A thin gold overcheck on every other sett only (so it reads as cloth, not as a globe).
  const sx2 = ((Math.floor(sx / P) % 2) + 2) % 2 === 0;
  const sy2 = ((Math.floor(sy / P) % 2) + 2) % 2 === 0;
  if ((mx === 13 && sx2) || (my === 13 && sy2)) return [PAL.gold, mx === 13 && my === 13 ? 2 : 1];
  const bx = mx < 6;
  const by = my < 6;
  if (bx && by) return [PAL.red, 0];
  if (bx || by) return [PAL.red, 1];
  if (mx === 18 || my === 18) return [PAL.red, 3];
  return [PAL.red, 2];
}

interface BagOpts {
  rx: number;
  ry: number;
  /** Wrinkles (death frames): 0 smooth … 1 crumpled. */
  wrinkle?: number;
  state?: number;
  seed?: number;
}

/** Shade a shape pixel of a sphere-ish blob with the tartan, lit from the top-left. */
function tartanEllipse(b: PixelBuffer, cx: number, cy: number, o: BagOpts): void {
  const { rx, ry } = o;
  const wr = o.wrinkle ?? 0;
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      let u = (x + 0.5 - cx) / rx;
      let v = (y + 0.5 - cy) / ry;
      if (wr > 0) {
        // A crumpled rim: the radius wobbles with the angle.
        const a = Math.atan2(v, u);
        const k = 1 + wr * 0.12 * Math.sin(a * 7 + (o.seed ?? 0)) + wr * 0.06 * Math.sin(a * 13);
        u /= k;
        v /= k;
      }
      const d = u * u + v * v;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d);
      // Wrap the cloth over the curve (the checks bunch up toward the rim).
      const uu = Math.max(-1, Math.min(1, u / Math.sqrt(Math.max(0.05, 1 - v * v))));
      const vv = Math.max(-1, Math.min(1, v / Math.sqrt(Math.max(0.05, 1 - u * u))));
      const sx = (Math.asin(uu) / (Math.PI / 2)) * rx * 1.1 + 200;
      const sy = (Math.asin(vv) / (Math.PI / 2)) * ry * 1.1 + 200;
      const [ramp, base] = sett(sx, sy, false);
      let light = -0.45 * u - 0.55 * v + 0.7 * nz;
      if (wr > 0) light += wr * 0.35 * Math.sin((u * 9 + v * 4) * 2.2 + (o.seed ?? 0));
      let shift = light > 0.86 ? 1 : light < 0.12 ? -2 : light < 0.42 ? -1 : 0;
      if (light > 0.86 && bay(x, y) > 0.7) shift = 0;
      const i = Math.max(0, Math.min(ramp.length - 1, base + shift));
      b.set(x, y, ramp[i]);
    }
  }
}

/** A patch sewn on: alternate cloth or leather, with light stitches round it. */
function patch(b: PixelBuffer, x: number, y: number, w: number, h: number, kind: 'check' | 'leather' | 'denim'): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (!b.inBounds(x + xx, y + yy) || (b.get(x + xx, y + yy) & 255) === 0) continue;
      let c: Color;
      if (kind === 'check') {
        const [ramp, base] = sett(xx * 2 + 3, yy * 2 + 3, true);
        c = ramp[Math.min(ramp.length - 1, base + (yy === 0 ? 1 : 0))];
      } else if (kind === 'leather') c = yy === 0 || xx === 0 ? PAL.brown[3] : yy === h - 1 || xx === w - 1 ? PAL.brown[1] : PAL.brown[2];
      else c = yy === 0 || xx === 0 ? PAL.sky[2] : yy === h - 1 || xx === w - 1 ? PAL.navy[1] : PAL.sky[1];
      b.set(x + xx, y + yy, c);
    }
  }
  // Stitches: every other pixel just outside the edge.
  const st = PAL.cloth[3];
  for (let xx = -1; xx <= w; xx += 2) {
    if ((b.get(x + xx, y - 1) & 255) !== 0) b.set(x + xx, y - 1, st);
    if ((b.get(x + xx, y + h) & 255) !== 0) b.set(x + xx, y + h, st);
  }
  for (let yy = 1; yy < h; yy += 2) {
    if ((b.get(x - 1, y + yy) & 255) !== 0) b.set(x - 1, y + yy, st);
    if ((b.get(x + w, y + yy) & 255) !== 0) b.set(x + w, y + yy, st);
  }
}

/** A torn hole: dark inside, frayed light threads round it. */
function hole(b: PixelBuffer, cx: number, cy: number, r: number, seed: number): void {
  for (let y = cy - r - 2; y <= cy + r + 2; y++) {
    for (let x = cx - r - 2; x <= cx + r + 2; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const a = Math.atan2(y - cy, x - cx);
      const rr = r * (0.8 + 0.35 * hash(Math.round(a * 4), 1, seed));
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rr - 1) b.set(x, y, d < rr - 2 ? PAL.ink[0] : PAL.ink[1]);
      else if (d <= rr + 0.6 && hash(x, y, seed) > 0.4) b.set(x, y, PAL.red[3]);
    }
  }
}

/** Soot: an ordered dark smudge on the cloth. */
function soot(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, level: number): void {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if ((b.get(x, y) & 255) === 0 || b.get(x, y) === INK) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1) continue;
      if (bay(x, y) < level * (1 - d * 0.7)) b.set(x, y, PAL.ink[1]);
    }
  }
}

const BCX = BAG.canvasW / 2;
const BCY = BAG.canvasH / 2;

/** The bag (facing left; the blowpipe on the top front). */
function bagFrame(state: number, swell: number): Frame {
  const b = new PixelBuffer(BAG.canvasW, BAG.canvasH);
  const rx = BAG.rx + swell * 3;
  const ry = BAG.ry + swell * 3;
  // Blowpipe at the top front (behind the bag's rim): black pipe, brass mouthpiece.
  const bx0 = BCX - 48;
  const by0 = BCY - ry + 6;
  b.thickLine(bx0, by0, bx0 - 12, by0 - 14, 4, PAL.black[1]);
  b.line(bx0 - 1, by0 - 1, bx0 - 12, by0 - 14, PAL.black[3]);
  b.thickLine(bx0 - 12, by0 - 14, bx0 - 15, by0 - 18, 3, PAL.gold[2]);
  b.set(bx0 - 13, by0 - 16, PAL.gold[3]);
  b.hline(bx0 - 9, bx0 - 6, by0 - 9, PAL.gold[2]);
  tartanEllipse(b, BCX, BCY, { rx, ry });
  const k = (v: number, r: number): number => Math.round((v * (r + 0)) / (r - swell * 3));
  // Patches (move with the swell).
  patch(b, BCX + k(-44, rx), BCY + k(8, ry), 15, 12, 'check');
  patch(b, BCX + k(26, rx), BCY + k(-22, ry), 11, 10, 'leather');
  patch(b, BCX + k(-6, rx), BCY + k(20, ry), 9, 7, 'denim');
  // The tied neck at the back (where the air would come out).
  const nx = BCX + rx - 2;
  b.rect(nx - 1, BCY - 4, 5, 8, PAL.red[1]);
  b.vline(nx + 1, BCY - 5, BCY + 4, PAL.gold[2]);
  b.vline(nx + 2, BCY - 4, BCY + 3, PAL.gold[1]);
  if (state >= 1) {
    hole(b, BCX + k(-58, rx), BCY + k(-8, ry), 3, 7);
    hole(b, BCX + k(14, rx), BCY + k(6, ry), 2, 9);
    soot(b, BCX + k(-20, rx), BCY + k(-14, ry), 12, 7, 0.45);
    patch(b, BCX + k(44, rx), BCY + k(4, ry), 8, 8, 'check');
  }
  if (state >= 2) {
    hole(b, BCX + k(-30, rx), BCY + k(24, ry), 4, 11);
    hole(b, BCX + k(58, rx), BCY + k(-14, ry), 3, 13);
    soot(b, BCX + k(34, rx), BCY + k(16, ry), 16, 9, 0.6);
    soot(b, BCX + k(-62, rx), BCY + k(10, ry), 10, 8, 0.5);
    // Loose threads hanging under the bag.
    for (const lx of [-20, 8, 30]) {
      const x = BCX + lx;
      let y = BCY + Math.round(ry * Math.sqrt(1 - (lx / rx) ** 2));
      for (let i = 0; i < 4; i++, y++) b.set(x + (i > 1 ? 1 : 0), y, PAL.red[3]);
    }
  }
  b.outline(INK);
  return { buf: b, ox: BCX, oy: BCY };
}

for (const s of [0, 1, 2]) {
  defineSprite(`boss/windbag/bag-${s}`, () => [0, 1, 2].map((sw) => bagFrame(s, sw)), { ticksPerFrame: 8 });
}

/** The bag going down (death): crumpled, smaller and smaller, the drone stumps poking out. */
defineSprite(
  'boss/windbag/deflate',
  () => {
    const sizes: Array<[number, number]> = [
      [74, 30],
      [58, 24],
      [44, 19],
      [30, 14],
      [18, 9],
    ];
    return sizes.map(([rx, ry], i) => {
      const w = rx * 2 + 24;
      const h = ry * 2 + 24;
      const b = new PixelBuffer(w, h);
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      // Drone stumps and the drooping chanter.
      for (let k = 0; k < 3; k++) {
        const a = (20 + k * 14) * DEG;
        const x0 = cx + Math.round(rx * 0.7);
        const y0 = cy - Math.round(ry * 0.5) + k * 3;
        const len = Math.max(4, Math.round(rx * 0.22));
        b.thickLine(x0, y0, x0 + Math.round(len * Math.cos(a)), y0 - Math.round(len * Math.sin(a)), 3, PAL.black[1]);
      }
      b.thickLine(cx - Math.round(rx * 0.6), cy + ry - 4, cx - Math.round(rx * 0.75), cy + ry + Math.max(3, Math.round(ry * 0.5)), 3, PAL.black[1]);
      tartanEllipse(b, cx, cy, { rx, ry, wrinkle: 0.6 + i * 0.1, seed: i * 3 + 1 });
      if (rx > 30) {
        hole(b, cx - Math.round(rx * 0.3), cy + 2, 3, 3 + i);
        soot(b, cx + Math.round(rx * 0.25), cy - 3, Math.round(rx * 0.25), Math.round(ry * 0.4), 0.5);
      }
      b.outline(INK);
      return { buf: b, ox: cx, oy: cy };
    });
  },
  { ticksPerFrame: 12 },
);

/** The popped patch flapping over the leak (phase 3). */
defineSprite(
  'boss/windbag/leak',
  () =>
    [0, 1].map((f) => {
      const b = new PixelBuffer(16, 14);
      // The hole.
      b.ellipse(4, 5, 8, 6, PAL.ink[0]);
      b.set(5, 6, PAL.ink[1]);
      // The leather patch, hanging by one corner (two flap angles).
      if (f === 0) {
        b.poly([
          [10, 3],
          [15, 6],
          [12, 12],
          [8, 9],
        ], PAL.brown[2]);
        b.line(10, 3, 15, 6, PAL.brown[3]);
      } else {
        b.poly([
          [10, 3],
          [15, 2],
          [15, 9],
          [10, 8],
        ], PAL.brown[2]);
        b.line(10, 3, 15, 2, PAL.brown[3]);
      }
      b.outline(INK);
      return { buf: b, ox: 8, oy: 7 };
    }),
  { ticksPerFrame: 3 },
);

// ------------------------------------------------------------------------------------- drones

const DC = DRONE.canvas / 2;

/** A drone pipe drawn level (pointing right from the base at the canvas centre). */
function dronePipe(len: number, broken: boolean, seed: number): PixelBuffer {
  const b = new PixelBuffer(DRONE.canvas, DRONE.canvas);
  const x0 = DC - DRONE.root;
  const x1 = DC + len;
  const top = DC - 4;
  const shadeRow = (r: number, ramp: readonly Color[]): Color => {
    // 8 rows: lit top, dark bottom.
    const n = ramp.length;
    const i = r === 0 ? n - 1 : r === 1 ? n - 2 : r >= 6 ? 0 : Math.max(0, n - 3);
    return ramp[i];
  };
  for (let x = x0; x <= x1; x++) {
    for (let r = 0; r < 8; r++) b.set(x, top + r, shadeRow(r, PAL.black));
  }
  // Ivory stock (where it meets the bag), brass ferrules along the pipe.
  for (let x = DC - 2; x <= DC + 5; x++) for (let r = 0; r < 8; r++) b.set(x, top + r, shadeRow(r, PAL.cloth));
  const rings = broken ? [12] : [12, 26, 40];
  for (const rx of rings) {
    for (let x = DC + rx; x <= DC + rx + 2; x++) for (let r = -1; r < 9; r++) b.set(x, top + r, r < 1 ? PAL.gold[3] : r > 6 ? PAL.gold[0] : x === DC + rx + 2 ? PAL.gold[1] : PAL.gold[2]);
  }
  if (!broken) {
    // The flared cap (the "bell" of the drone).
    for (let x = x1 - 5; x <= x1 + 1; x++) {
      const half = 5 + (x >= x1 - 1 ? 1 : 0);
      for (let r = -half + 4; r < 4 + half; r++) b.set(x, top + r, r < -half + 6 ? PAL.cloth[3] : r > 4 + half - 3 ? PAL.cloth[0] : PAL.cloth[2]);
    }
    b.vline(x1 + 1, top - 1, top + 8, PAL.ink[1]);
    b.set(x1 - 4, top - 1, PAL.snow[3]);
    // Glint along the pipe.
    b.hline(DC + 16, DC + 22, top + 1, PAL.steel[2]);
  } else {
    // Jagged broken end: a few uneven columns and a scorched edge.
    for (let r = 0; r < 8; r++) {
      const cut = x1 - Math.floor(hash(r, 3, seed) * 4);
      for (let x = cut + 1; x <= x1 + 1; x++) b.set(x, top + r, 0);
      b.set(cut, top + r, PAL.ink[1]);
      b.set(cut - 1, top + r, r < 2 ? PAL.stone[1] : PAL.black[0]);
    }
  }
  return b;
}

function droneFrame(i: number, state: number, stump: boolean): Frame {
  const g = DRONES[i];
  let b = dronePipe(stump ? DRONE.stump : DRONE.len, stump, 5 + i).rotated(-g.deg * DEG);
  const ox = Math.floor(b.w / 2);
  const oy = Math.floor(b.h / 2);
  if (!stump) {
    // Cord and tassel hanging under the pipe, two thirds of the way out.
    const along = DRONE.len * 0.62;
    const cx = Math.round(ox + along * Math.cos(g.deg * DEG));
    const cy = Math.round(oy - along * Math.sin(g.deg * DEG)) + 4;
    const hang = 9 + i * 2;
    b.vline(cx, cy, cy + hang, i === 1 ? PAL.gold[2] : PAL.red[2]);
    b.rect(cx - 1, cy + hang, 3, 4, PAL.red[2]);
    b.set(cx - 1, cy + hang, PAL.red[3]);
    b.hline(cx - 1, cx + 1, cy + hang + 4, PAL.gold[2]);
    b.set(cx, cy + hang + 5, PAL.gold[1]);
  }
  b.outline(INK);
  if (state > 0 && !stump) b = damage(b, state === 1 ? 0.25 : 0.6, 40 + i * 3 + state);
  if (stump) b = damage(b, 0.8, 50 + i);
  return { buf: b, ox, oy };
}

for (let i = 0; i < 3; i++) {
  for (const s of [0, 1, 2]) {
    defineSprite(`boss/windbag/drone-${i + 1}-${s}`, () => (s === 2 ? [droneFrame(i, 2, false), droneFrame(i, 2, true)] : [droneFrame(i, s, false)]), { trim: true });
  }
}

// ------------------------------------------------------------------------------------- chanter

const CW = CHANTER.canvasW;
const CX = Math.floor(CW / 2);

/** The chanter, hanging straight down (anchor = top centre). */
function chanterFrame(state: number, stump: boolean): Frame {
  const b = new PixelBuffer(CW, CHANTER.canvasH);
  const len = stump ? 14 : CHANTER.len;
  const half = CHANTER.w / 2;
  for (let y = 0; y < len; y++) {
    // Tapers a little toward the top, flares into the bell at the bottom.
    const flare = !stump && y > len - 8 ? Math.round((y - (len - 8)) * 0.6) : 0;
    const h = half - (y < 10 ? 1 : 0) + flare;
    for (let x = CX - h; x < CX + h; x++) {
      const u = (x - (CX - h)) / (2 * h);
      b.set(x, y, u < 0.2 ? PAL.black[3] : u < 0.38 ? PAL.black[2] : u > 0.8 ? PAL.black[0] : PAL.black[1]);
    }
  }
  // Silver rings.
  for (const ry of stump ? [4] : [4, 41, len - 2]) {
    if (ry >= len) continue;
    const h = half + (ry > len - 8 ? 3 : 0);
    b.hline(CX - h, CX + h - 1, ry, PAL.snow[3]);
    b.hline(CX - h, CX + h - 1, ry + 1, PAL.snow[1]);
  }
  if (!stump) {
    // Finger holes (the Reel telegraph lights them up in order).
    for (const hy of CHANTER.holes) {
      b.rect(CX - 1, hy, 2, 2, PAL.ink[0]);
      b.set(CX - 1, hy + 2, PAL.black[3]);
    }
    // The bell's dark mouth.
    b.hline(CX - half - 3, CX + half + 2, len - 1, PAL.ink[1]);
  } else {
    for (let x = CX - half; x < CX + half; x++) {
      if (hash(x, 1, 3) > 0.5) b.set(x, len - 1, 0);
      b.set(x, len - 2, PAL.ink[1]);
    }
  }
  b.outline(INK);
  let out = b;
  if (state > 0 || stump) out = damage(b, stump ? 0.9 : state === 1 ? 0.35 : 0.8, 70 + state);
  return { buf: out, ox: CX, oy: 0 };
}

for (const s of [0, 1, 2]) {
  defineSprite(`boss/windbag/chanter-${s}`, () => (s === 2 ? [chanterFrame(2, false), chanterFrame(2, true)] : [chanterFrame(s, false)]));
}

// ------------------------------------------------------------------------------------- gondola

const GW = GONDOLA.canvasW;
const GX = Math.floor(GW / 2);

/** The wooden gondola (bow to the left), anchor = top centre. */
function gondolaFrame(open: boolean): Frame {
  const b = new PixelBuffer(GW, GONDOLA.canvasH);
  const half = GONDOLA.w / 2;
  const h = GONDOLA.h;
  // Hull: a boat-ish tub, the bow (left) raked, the stern rounded.
  b.poly(
    [
      [GX - half - 2, 1],
      [GX + half - 1, 1],
      [GX + half + 1, 6],
      [GX + half - 3, h - 3],
      [GX + half - 8, h - 1],
      [GX - half + 10, h - 1],
      [GX - half + 3, h - 6],
    ],
    PAL.brown[2],
  );
  // Planks, light top, dark keel.
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < GW; x++) {
      if (b.get(x, y) !== PAL.brown[2]) continue;
      let c: Color = PAL.brown[2];
      if ((y - 2) % 5 === 0) c = PAL.brown[1];
      else if ((y - 3) % 5 === 0) c = PAL.brown[3];
      if (y > h - 5) c = PAL.brown[1];
      if (x > GX + half - 6 && c === PAL.brown[2]) c = PAL.brown[1];
      b.set(x, y, c);
    }
  }
  // Brass rail on top, brass bands, a red-gold tartan sash along the side.
  b.hline(GX - half - 2, GX + half - 1, 0, PAL.gold[3]);
  b.hline(GX - half - 2, GX + half - 1, 1, PAL.gold[2]);
  b.hline(GX - half - 1, GX + half, 2, PAL.gold[0]);
  for (let x = GX - half + 4; x < GX + half - 4; x++) {
    const [ramp, base] = sett(x * 2, 26, false);
    b.set(x, 8, ramp[Math.min(ramp.length - 1, base + 1)]);
    b.set(x, 9, ramp[base]);
    b.set(x, 10, ramp[Math.max(0, base - 1)]);
  }
  for (const bx of [GX - half + 8, GX, GX + half - 10]) b.vline(bx, 3, h - 3, PAL.gold[1]);
  // Rope rings on the rail.
  for (const rx of [GX - half + 2, GX + half - 4]) {
    b.set(rx, -1 + 1, PAL.steel[3]);
    b.set(rx + 1, 1, PAL.steel[1]);
  }
  // A little gold star on the bow.
  const sx = GX - half + 4;
  b.set(sx, 13, PAL.gold[3]);
  b.hline(sx - 1, sx + 1, 14, PAL.gold[2]);
  b.set(sx, 15, PAL.gold[1]);
  // The mine hatch in the floor.
  const hx = GX + GONDOLA.hatchX;
  if (!open) {
    b.hline(hx - 5, hx + 4, h - 2, PAL.ink[1]);
    b.set(hx - 5, h - 3, PAL.gold[1]);
    b.set(hx + 4, h - 3, PAL.gold[1]);
  } else {
    b.hline(hx - 5, hx + 4, h - 2, PAL.ink[0]);
    b.hline(hx - 5, hx + 4, h - 1, PAL.ink[0]);
    // The flap hanging down from its hinge.
    b.rect(hx - 6, h, 3, 6, PAL.brown[2]);
    b.vline(hx - 6, h, h + 5, PAL.brown[3]);
  }
  b.outline(INK);
  return { buf: b, ox: GX, oy: 0 };
}

defineSprite('boss/windbag/gondola', () => [gondolaFrame(false), gondolaFrame(true)]);

/** The pusher propeller seen from the side: hub cone and a spinning blade. */
defineSprite(
  'boss/windbag/prop',
  () =>
    [22, 14, 4, 14].map((len, f) => {
      const b = new PixelBuffer(14, 28);
      const cy = 14;
      // Blade (a slim board, lighter at the tips).
      const half = Math.floor(len / 2);
      b.rect(6, cy - half, 3, len, f === 2 ? PAL.brown[1] : PAL.brown[2]);
      if (len > 6) {
        b.vline(6, cy - half, cy + half - 1, PAL.brown[3]);
        b.rect(6, cy - half, 3, 2, PAL.cloth[2]);
        b.rect(6, cy + half - 2, 3, 2, PAL.red[2]);
      }
      // Hub and spinner cone (pointing back = right).
      b.rect(3, cy - 2, 4, 5, PAL.steel[2]);
      b.hline(3, 6, cy - 2, PAL.steel[3]);
      b.tri(9, cy - 2, 9, cy + 2, 12, cy, PAL.red[2]);
      b.set(10, cy - 1, PAL.red[3]);
      b.outline(INK);
      return { buf: b, ox: 4, oy: cy };
    }),
  { ticksPerFrame: 2 },
);

/** A far-off peak with the empty bag wrapped round its tip (the end of the death sequence). */
defineSprite('boss/windbag/peak-rag', () => {
  const b = new PixelBuffer(44, 30);
  // Pale, low-contrast distance colours.
  b.poly([
    [2, 29],
    [22, 4],
    [42, 29],
  ], PAL.snow[0]);
  b.poly([
    [22, 4],
    [42, 29],
    [30, 29],
  ], PAL.steel[2]);
  b.poly([
    [16, 12],
    [22, 4],
    [28, 12],
    [25, 11],
    [22, 14],
    [19, 11],
  ], PAL.snow[2]);
  // The rag: a crumpled tartan scrap over the tip with one drone stump sticking out.
  const rag = new PixelBuffer(44, 30);
  tartanEllipse(rag, 22, 7, { rx: 9, ry: 4, wrinkle: 1, seed: 4 });
  rag.thickLine(27, 4, 31, 1, 2, PAL.black[1]);
  rag.vline(17, 9, 13, PAL.red[1]);
  rag.vline(25, 9, 12, PAL.red[2]);
  b.blit(rag, 0, 0);
  b.outline(INK);
  return [{ buf: b, ox: 22, oy: 29 }];
});
