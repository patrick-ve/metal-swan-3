/**
 * Art of the set pieces: `prop/willow-tree/…` (stand, fall, stump, bridge), `prop/avalanche/…`
 * (front, body tile, snowball, mound, hat) and `prop/rising-water/surface`. Palette ramps only,
 * 1-px INK outline, light from the upper left. Big strips (the willow's fall, the avalanche's
 * 216-px front) are generated once, on first use.
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { Composer, hash2, layerOf } from '../../art/paint';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------------------------ willow-tree

/** Willow canvas: 64×120 plus the outline; the trunk's base centre (the feet anchor) is (33, 121). */
const WW = 66;
const WH = 122;
const WCX = 33;
const WBASE = 120;
/** Rows of the red target ring's centre (on the trunk base, inside the 16×44 hitbox). */
const RING_Y = WBASE - 20;

/** Half width of the trunk at row y (flared roots at the base, thinner where the boughs split). */
function trunkHalf(y: number): number {
  const k = Math.max(0, (y - 46) / (WBASE - 46));
  let half = 4.5 + k * 3.5;
  if (y > WBASE - 6) half += (y - (WBASE - 6)) * 0.6;
  return half;
}

/** The bark: lit on the left, dark on the right, with 2-px furrow clusters. */
function trunkLayer(c: Composer): PixelBuffer {
  const b = layerOf(c);
  const br = PAL.brown;
  for (let y = 44; y <= WBASE; y++) {
    const half = trunkHalf(y);
    const x0 = Math.round(WCX - half);
    const x1 = Math.round(WCX + half) - 1;
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      b.set(x, y, u < 0.22 ? br[3] : u < 0.72 ? br[2] : br[1]);
    }
    // Furrows: short vertical dark runs, 2 px long.
    for (let x = x0 + 3; x < x1 - 1; x += 4) if (hash2(x, y >> 1, 3) < 0.55) b.set(x, y, br[1]);
  }
  // Boughs up into the crown.
  b.thickLine(WCX - 2, 50, WCX - 15, 24, 3, br[2]);
  b.thickLine(WCX + 2, 50, WCX + 13, 20, 3, br[1]);
  b.thickLine(WCX, 50, WCX + 1, 16, 3, br[2]);
  // The red target ring painted on the trunk base: red, white, red bullseye.
  b.ellipse(WCX - 6, RING_Y - 7, 12, 14, PAL.red[2]);
  b.ellipse(WCX - 4, RING_Y - 5, 8, 10, PAL.snow[3]);
  b.ellipse(WCX - 2, RING_Y - 3, 4, 6, PAL.red[2]);
  b.vline(WCX - 6, RING_Y - 3, RING_Y + 2, PAL.red[3]);
  b.vline(WCX + 5, RING_Y - 3, RING_Y + 2, PAL.red[1]);
  b.set(WCX - 2, RING_Y - 2, PAL.red[3]);
  return b;
}

/**
 * The crown: a dome of foliage with two long hanging curtains (the willow's fronds) on the
 * sides, so the trunk and its target show in the middle. `sway` (−1, 0, 1) moves the lower
 * fronds sideways. Leaf texture: drooping 4-px scallops in rows, lit from the upper left.
 */
function crownLayer(c: Composer, sway: number): PixelBuffer {
  const b = layerOf(c);
  const g = PAL.green; // teal0, green0, green1, green2, green3
  // Per column: the scalloped top of the dome, where the dome ends and where the foliage ends
  // (fronds in groups of 3 columns, the third one shorter: a dark parting between fronds).
  const top = new Int16Array(WW);
  const domeEnd = new Int16Array(WW);
  const bottom = new Int16Array(WW).fill(-1);
  for (let x = 1; x <= 64; x++) {
    const u = (x - WCX + 0.5) / 32; // −1 … 1
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    top[x] = Math.round(29 - 26 * r + 2.2 * (0.5 + 0.5 * Math.cos((x / 10) * TAU)));
    domeEnd[x] = Math.round(28 + 24 * r);
    const frond = Math.floor((x - 1) / 3);
    const parting = (x - 1) % 3 === 2;
    const side = Math.abs(u);
    let end = domeEnd[x] + 1 + Math.round(hash2(frond, 3, 17) * 4);
    if (side > 0.42) end = Math.round(domeEnd[x] + 8 + (side - 0.42) * 70 + hash2(frond, 1, 17) * 12);
    if (parting) end -= 3 + Math.round(hash2(frond, 2, 17) * 5);
    bottom[x] = Math.min(WBASE - 18, end);
  }
  for (let x = 1; x <= 64; x++) {
    const u = (x - WCX + 0.5) / 32;
    for (let y = Math.max(1, top[x]); y <= bottom[x]; y++) {
      // Fronds sway below the dome: the lower the more.
      const below = y - domeEnd[x];
      const dx = below > 6 ? Math.round(sway * Math.min(1, (below - 6) / 16)) : 0;
      const xx = x + dx;
      if (xx < 1 || xx > 64) continue;
      const v = (y - 30) / 30;
      const light = -u * 0.55 - v * 0.75;
      const tone = light > 0.55 ? 4 : light > 0.05 ? 3 : light > -0.45 ? 2 : 1;
      b.set(xx, y, g[tone]);
    }
  }
  // Scallops: rows of drooping leaf bunches (a darker 4-px arc under a lit tip).
  for (let row = 0; row < 14; row++) {
    const y = 6 + row * 6;
    const off = row % 2 === 0 ? 0 : 3;
    for (let x = 2 + off; x < 64; x += 6) {
      const cx = x + Math.round(hash2(x, row, 23) * 2);
      if ((b.get(cx, y) & 255) === 0 || (b.get(cx + 3, y + 2) & 255) === 0) continue;
      const here = b.get(cx + 1, y);
      const t = here === g[4] ? 4 : here === g[3] ? 3 : here === g[2] ? 2 : 1;
      const dark = g[Math.max(0, t - 1)];
      b.set(cx, y + 1, dark);
      b.set(cx + 1, y + 2, dark);
      b.set(cx + 2, y + 2, dark);
      b.set(cx + 3, y + 1, dark);
      b.set(cx + 1, y, g[Math.min(4, t + 1)]);
      b.set(cx + 2, y, g[Math.min(4, t + 1)]);
    }
  }
  // Frond lines: from the dome's lower half down every frond (every third column, dark).
  for (let x = 2; x <= 64; x += 3) {
    const u = Math.abs((x - WCX + 0.5) / 32);
    const from = u > 0.42 ? domeEnd[x] - 10 : domeEnd[x] - 4;
    for (let y = from; y < bottom[x] - 1; y++) {
      const below = y - domeEnd[x];
      const dx = below > 6 ? Math.round(sway * Math.min(1, (below - 6) / 16)) : 0;
      if ((b.get(x + dx, y) & 255) !== 0 && (y + x) % 5 !== 0) b.set(x + dx, y, g[1]);
    }
  }
  return b;
}

/** The whole willow (no outline yet): trunk behind, crown in front with internal lines. */
function willowBody(sway: number): PixelBuffer {
  const c = new Composer(WW, WH);
  c.add(trunkLayer(c), { ramp: PAL.brown });
  c.add(crownLayer(c, sway), { ramp: PAL.green });
  return c.buf;
}

function willowStand(sway: number): Frame {
  const b = willowBody(sway).clone().outline(INK);
  return { buf: b, ox: WCX, oy: WBASE + 1 };
}

/**
 * The fall (8 frames, 0° … 90° to the right about the trunk base): the tree is rotated with the
 * base on the buffer centre, outlined, then trimmed; the anchor stays on the base.
 */
function willowFall(): Frame[] {
  const tree = willowBody(0);
  // A square-ish canvas with the pivot (the base) on its centre.
  const P = new PixelBuffer(WW, WH * 2);
  P.blit(tree, 0, WH - (WBASE + 1));
  const out: Frame[] = [];
  for (let k = 0; k < 8; k++) {
    const r = P.rotated((k / 7) * (Math.PI / 2)).outline(INK);
    const cx = r.w >> 1;
    const cy = r.h >> 1;
    const t = r.trimBounds();
    if (!t) {
      out.push({ buf: r, ox: cx, oy: cy });
      continue;
    }
    out.push({ buf: r.crop(t.x, t.y, t.w, t.h), ox: cx - t.x, oy: cy - t.y });
  }
  return out;
}

/** The stump left on the jetty: the flared base with a splintered top and a pale cut face. */
function willowStump(): Frame {
  const W = 24;
  const H = 14;
  const b = new PixelBuffer(W, H);
  const br = PAL.brown;
  const base = 12;
  for (let y = 2; y <= base; y++) {
    const half = trunkHalf(WBASE - (base - y));
    const x0 = Math.round(12 - half);
    const x1 = Math.round(12 + half) - 1;
    for (let x = x0; x <= x1; x++) {
      // Splinters: a jagged top, higher in the middle.
      const tip = 2 + ((x * 7) % 5 === 0 ? 0 : (x * 3) % 4);
      if (y < tip + 1) continue;
      const u = (x - x0) / Math.max(1, x1 - x0);
      b.set(x, y, y === tip + 1 ? PAL.sand[3] : u < 0.22 ? br[3] : u < 0.72 ? br[2] : br[1]);
    }
  }
  b.outline(INK);
  return { buf: b, ox: 12, oy: base + 1 };
}

/**
 * The fallen willow as a bridge (160×12 solid, top-left anchor on the standing surface): the bare
 * trunk with its cut end and the target ring, then the flattened crown lying along the log with
 * fronds hanging into the water.
 */
function willowBridge(): Frame {
  const L = 160;
  const W = L + 2;
  const H = 24;
  const top = 1;
  const b = new PixelBuffer(W, H);
  const br = PAL.brown;
  const g = PAL.green;
  // The log: 12 rows, lit on top, a dark belly; bark furrows run along it.
  for (let x = 1; x <= L; x++) {
    for (let y = top; y < top + 12; y++) {
      const v = (y - top) / 11;
      let c: Color = v < 0.17 ? br[3] : v < 0.7 ? br[2] : br[1];
      if ((y - top) % 4 === 2 && hash2(x >> 1, y, 5) < 0.5) c = br[1];
      b.set(x, y, c);
    }
  }
  // The cut end: a pale face with growth rings.
  b.ellipse(1, top, 7, 12, PAL.sand[2]);
  b.ellipse(2, top + 3, 4, 6, PAL.sand[3]);
  b.vline(4, top + 4, top + 7, br[2]);
  // The target ring, now lying on its side near the cut.
  b.ellipse(12, top + 1, 14, 10, PAL.red[2]);
  b.ellipse(15, top + 3, 8, 6, PAL.snow[3]);
  b.ellipse(17, top + 4, 4, 4, PAL.red[2]);
  b.hline(14, 23, top + 1, PAL.red[3]);
  // The crown: foliage heaped on the log and fronds hanging down from x 64 on.
  for (let x = 60; x <= L; x++) {
    const u = (x - 60) / (L - 60);
    const heap = Math.round(3 + 3 * Math.sin(u * Math.PI));
    const frond = Math.floor(x / 3);
    const hang = top + 12 + Math.round(3 + hash2(frond, 2, 29) * 7 * Math.min(1, u * 3));
    for (let y = top; y <= hang; y++) {
      if (y < top + 12 - heap && x < 64) continue;
      const v = (y - top) / 18;
      const tone = v < 0.12 ? 4 : v < 0.45 ? 3 : v < 0.8 ? 2 : 1;
      b.set(x, y, g[tone]);
    }
    if (x % 3 === 0) for (let y = top + 9; y < hang; y++) b.set(x, y, g[1]);
  }
  // Scallops over the heaped foliage.
  for (let x = 63; x < L - 3; x += 6) {
    const y = top + 3 + ((x >> 2) % 2) * 3;
    b.set(x, y + 1, g[2]);
    b.set(x + 1, y + 2, g[2]);
    b.set(x + 2, y + 2, g[2]);
    b.set(x + 3, y + 1, g[2]);
    b.set(x + 1, y, g[4]);
  }
  b.outline(INK);
  return { buf: b, ox: 1, oy: top };
}

// ------------------------------------------------------------------------------------ avalanche

/** The view height the avalanche fills. */
const AV_H = 216;
/** Snow lumps per lattice row type: [x, radius] (3 row types, rows every 16 px, period 48). */
const LUMPS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [6, 9],
    [26, 11],
    [46, 9],
    [62, 7],
  ],
  [
    [15, 10],
    [36, 8],
    [55, 10],
  ],
  [
    [2, 8],
    [22, 9],
    [41, 11],
    [60, 8],
  ],
];

/** Shade a snow lump of radius r at (cx, cy) inside the mass mask: lit rim upper left, crease lower right. */
function lump(b: PixelBuffer, mask: Uint8Array, w: number, cx: number, cy: number, r: number): void {
  const s = PAL.snow; // steel3, snow0, snow1, white
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= b.h) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= w || mask[y * w + x] === 0) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const dir = (dx + dy) / (d || 1);
      let c: Color = s[2];
      if (d > r - 2.2 && dir < -0.35) c = s[3];
      else if (d > r - 1.6 && dir > 0.45) c = s[1];
      if (d > r - 0.9 && dy > 0 && dx > -r * 0.2) c = s[0];
      b.set(x, y, c);
    }
  }
}

/** One step darker on the snow ramp (shadowed snow). */
function darker(c: Color): Color {
  const s = PAL.snow;
  return c === s[3] ? s[2] : c === s[2] ? s[1] : c === s[1] ? s[0] : c;
}

/** Things the wall has picked up (dark bits that tumble in it): rock, plank, pine sprig. */
function debrisBit(b: PixelBuffer, x: number, y: number, kind: number): void {
  if (kind === 0) {
    b.rect(x, y, 4, 3, PAL.stone[1]);
    b.hline(x, x + 2, y, PAL.stone[2]);
    b.set(x + 3, y + 2, PAL.stone[0]);
  } else if (kind === 1) {
    b.line(x, y + 3, x + 5, y, PAL.brown[2]);
    b.line(x + 1, y + 3, x + 6, y, PAL.brown[1]);
  } else {
    b.vline(x + 2, y, y + 4, PAL.brown[1]);
    b.hline(x, x + 4, y + 1, PAL.green[1]);
    b.hline(x + 1, x + 3, y + 3, PAL.green[2]);
  }
}

/**
 * Fill the snow mass of width w (columns 0 … edge(y)) and churn it with the lump lattice moved
 * down by `shift` px (the face rolls forward and down). `wrap`: lumps repeat every w px across
 * (seamless body tiles; no debris there, it would repeat). The bottom rows and the last px before the edge (the face turned away
 * from the light) are one shade darker; picked-up debris tumbles in the snow.
 */
function snowMass(w: number, h: number, shift: number, edge: (y: number) => number, wrap: boolean): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const mask = new Uint8Array(w * h);
  const edges = new Int16Array(h);
  for (let y = 0; y < h; y++) {
    const e = Math.min(w - 1, Math.round(edge(y)));
    edges[y] = e;
    for (let x = 0; x <= e; x++) {
      mask[y * w + x] = 1;
      b.set(x, y, PAL.snow[2]);
    }
  }
  for (let j = -2; j * 16 + shift - 16 < h + 16; j++) {
    const cy = j * 16 + shift;
    const type = ((j % 3) + 3) % 3;
    for (const [lx, r] of LUMPS[type]) {
      if (wrap) {
        const x = ((lx % w) + w) % w;
        for (const ox of [-w, 0, w]) lump(b, mask, w, x + ox, cy, r);
      } else if (lx < w) lump(b, mask, w, lx, cy, r);
    }
    // One bit of debris every third lattice row, tumbling down with the lumps.
    if (type === 1 && !wrap) {
      const kind = ((j % 9) + 9) % 9 < 3 ? 0 : ((j % 9) + 9) % 9 < 6 ? 1 : 2;
      const dx = 30 + ((((j * 7) % 20) + 20) % 20);
      if (cy + 4 >= 0 && cy < h && dx + 7 < w) debrisBit(b, dx, cy - 2, kind);
    }
  }
  for (let y = 0; y < h; y++) {
    const shadeEdge = wrap ? -1 : edges[y] - 5;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === 0) continue;
      if ((shadeEdge >= 0 && x > shadeEdge) || y > h - 22 + Math.round(3 * Math.sin(x * 0.4))) b.set(x, y, darker(b.get(x, y)));
    }
  }
  return b;
}

/** The front's leading edge at row y (its shape rolls down with the shift; a curl at the top). */
function frontEdge(y: number, shift: number): number {
  const s = y - shift;
  const roll = 3 * Math.sin((s / 48) * TAU) + 2 * Math.sin((s / 16) * TAU + 1);
  const curl = y < 56 ? 5 * (1 - y / 56) : 0;
  return 62 + roll + curl;
}

/**
 * The front of the wall (4 frames, 74×216): the churning snow face whose leading edge sits on the
 * anchor (x 64, bottom). Clumps break off just ahead of it. Only the leading edge is outlined.
 */
function avalancheFront(frame: number): Frame {
  const W = 74;
  const shift = frame * 12;
  const b = snowMass(W, AV_H, shift, (y) => frontEdge(y, shift), false);
  // Loose clumps flying ahead of the face.
  for (let k = 0; k < 5; k++) {
    const y = (((k * 47 + shift * 2) % AV_H) + AV_H) % AV_H;
    const x = Math.round(frontEdge(y, shift)) + 3 + (k % 3);
    if (x + 2 >= W) continue;
    b.rect(x, y, 3, 2, PAL.snow[2]);
    b.hline(x, x + 1, y, PAL.snow[3]);
  }
  b.outline(INK);
  return { buf: b, ox: 64, oy: AV_H };
}

/** A 32-px tile of the snow mass behind the front (4 frames rolling down with the front; seamless across). */
function avalancheBody(frame: number): Frame {
  const b = snowMass(32, AV_H, frame * 12, () => 31, true);
  return { buf: b, ox: 0, oy: AV_H };
}

/** A snowball tumbling in the face (4 frames: a dent turns round it). */
function snowball(frame: number): Frame {
  const b = new PixelBuffer(13, 13);
  b.circle(6, 6, 5, PAL.snow[2]);
  b.circle(5, 5, 3, PAL.snow[3]);
  b.circle(6, 6, 2, PAL.snow[2]);
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < 13; x++) if ((b.get(x, y) & 255) !== 0 && x + y > 15) b.set(x, y, PAL.snow[1]);
  }
  const a = (frame / 4) * TAU + 0.6;
  const dx = Math.round(6 + Math.cos(a) * 3);
  const dy = Math.round(6 + Math.sin(a) * 3);
  b.rect(dx, dy, 2, 2, PAL.snow[0]);
  b.outline(INK);
  return { buf: b, ox: 6, oy: 6 };
}

/** The snow mound left at the rock face (feet anchor on its right side, where the front stopped). */
function avalancheMound(): Frame {
  const W = 104;
  const H = 42;
  const peak = 86;
  const height = (x: number): number => {
    if (x <= peak) return 34 * Math.pow(Math.sin((x / peak) * (Math.PI / 2)), 1.4);
    return 34 - (x - peak) * 2.2;
  };
  const b = new PixelBuffer(W, H);
  const mask = new Uint8Array(W * H);
  for (let x = 1; x < W - 1; x++) {
    const top = Math.round(H - 1 - height(x) - 2 * Math.sin(x * 0.45));
    for (let y = Math.max(1, top); y < H; y++) {
      mask[y * W + x] = 1;
      b.set(x, y, PAL.snow[2]);
    }
  }
  for (let k = 0; k < 14; k++) {
    const x = 6 + k * 7 + Math.round(hash2(k, 1, 37) * 3);
    const y = H - 4 - height(x) * (0.35 + hash2(k, 2, 37) * 0.5);
    lump(b, mask, W, x, y, 5 + hash2(k, 3, 37) * 4);
  }
  b.outline(INK);
  return { buf: b, ox: peak + 6, oy: H };
}

/** Fallback hat (a Legion shako) that pops out of the snow: 4 quarter turns. */
function hat(frame: number): Frame {
  const src = ascii(['..wW..', '.kKKk.', '.kYyk.', '.kKKk.', '.gGGg.', 'kkkkkk'], {
    w: PAL.snow[2],
    W: PAL.snow[3],
    k: PAL.black[1],
    K: PAL.black[2],
    y: PAL.gold[2],
    Y: PAL.gold[3],
    g: PAL.gold[1],
    G: PAL.gold[2],
  }).padded(1);
  const r = src.rotated((frame * Math.PI) / 2).outline(INK);
  return { buf: r, ox: r.w >> 1, oy: r.h >> 1 };
}

// ------------------------------------------------------------------------------------ rising-water

/**
 * The meltwater's surface strip (32 px, tiles seamlessly; top-left anchor on the surface line):
 * foam crests on top, a bright band, then the cold teal water. 2 frames (the crests roll).
 */
function waterSurface(frame: number): Frame {
  const W = 32;
  const b = new PixelBuffer(W, 5);
  for (let x = 0; x < W; x++) {
    const k = (x + frame * 4) % 16;
    if (k >= 3 && k <= 6) b.set(x, 0, k === 3 ? PAL.snow[2] : PAL.snow[3]);
    b.set(x, 1, k >= 2 && k <= 8 ? PAL.snow[3] : PAL.sky[3]);
    b.set(x, 2, k >= 9 && k <= 12 ? PAL.snow[2] : PAL.teal[3]);
    b.set(x, 3, PAL.teal[2]);
    b.set(x, 4, (x + frame * 4) % 8 < 3 ? PAL.teal[2] : PAL.teal[1]);
  }
  return { buf: b, ox: 0, oy: 1 };
}

// ------------------------------------------------------------------------------------ registration

export function defineSetPieceSprites(): void {
  defineSprite('prop/willow-tree/stand', () => [willowStand(0), willowStand(1)], { ticksPerFrame: 32 });
  defineSprite('prop/willow-tree/fall', willowFall, { ticksPerFrame: 5, loop: false });
  defineSprite('prop/willow-tree/stump', willowStump);
  defineSprite('prop/willow-tree/bridge', willowBridge);
  defineSprite('prop/avalanche/front', () => [0, 1, 2, 3].map(avalancheFront), { ticksPerFrame: 4 });
  defineSprite('prop/avalanche/body', () => [0, 1, 2, 3].map(avalancheBody), { ticksPerFrame: 4 });
  defineSprite('prop/avalanche/snowball', () => [0, 1, 2, 3].map(snowball), { ticksPerFrame: 4 });
  defineSprite('prop/avalanche/mound', avalancheMound);
  defineSprite('prop/avalanche/hat', () => [0, 1, 2, 3].map(hat), { ticksPerFrame: 4 });
  defineSprite('prop/rising-water/surface', () => [0, 1].map(waterSurface), { ticksPerFrame: 16 });
}
